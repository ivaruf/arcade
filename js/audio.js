/* =============================================================================
 * audio.js — the room, synthesized, and the one piece of music that is not.
 *
 * An arcade is other people's machines going off across the room, and that is
 * what is synthesized here: footsteps, a coin, a tube striking, and the
 * occasional blip from a cabinet somebody else is playing. A blip panned hard
 * left is a machine over there, and that is what makes 18 x 14 metres of floor
 * feel occupied. All of it is WebAudio oscillators and filtered noise, per
 * house rule.
 *
 * The exception is the theme, which is a real file the owner wrote. It gets its
 * own bus and its own fader, because "I want the room but not the tune" and
 * "I want the tune but not the beeping" are both reasonable, and one volume
 * control cannot say either.
 *
 *      one-shots ────> sfx ──┐
 *                           ├─> master ─> destination
 *      theme ─────────────> music ──┘
 *
 * Each of those three gains is a control the player has.
 *
 *   sfx and music are LEVELS, 0–1, and 1 is the mix as it was authored: the
 *   trims below are where the calibration lives, so 100% means what the room
 *   has always sounded like and the sliders only ever take away. They used to
 *   be switches, which could not answer the question people actually have.
 *
 *   master is the MUTE, and it is a separate node for exactly one reason: one
 *   press has to give the whole mix back untouched afterwards. A mute that
 *   zeroed the two levels would be a mute that quietly ate what the player set.
 *
 * STORAGE, and the migration. The two level keys are the ones the switches used
 * — arcade.cloudnine.sound.v1 and .music.v1 — kept rather than renamed, per hub
 * CLAUDE.md §6: a new key silently discards what every existing visitor has
 * already chosen. They held the words 'on' and 'off'; they hold a number now,
 * and readLevel() reads the two old words once as a migration ('off' is 0, 'on'
 * is the default, which is what 'on' sounded like). It is not a one-shot
 * upgrade step run at boot — it is just how the value is parsed, so a browser
 * that has not been here since the switches still arrives at the right level
 * whenever it turns up. The trade going the other way is small and worth
 * naming: an older build (a worker still serving a previous shell for one
 * visit) reads a number back, finds it is not 'off', and plays. Loud rather
 * than silent, and the player can still turn it down — the level written by
 * this build survives, because that old switch writes only when pressed.
 *
 * The AudioContext is created on the first gesture and never before: browsers
 * refuse otherwise, and a page that asks for audio before you have touched it
 * deserves to be refused.
 * ========================================================================== */

const KEY = 'arcade.cloudnine.sound.v1';
const MUSIC_KEY = 'arcade.cloudnine.music.v1';
/** New, and in the hub's shape. Absent means "not muted", which is the point. */
const MUTED_KEY = 'arcade.cloudnine.muted.v1';

/** Module-relative, so the path does not depend on where the page lives. */
const THEME_URL = new URL('../audio/theme.m4a', import.meta.url).href;

/**
 * The theme's ceiling: loud enough to be the room's music, quiet enough to talk
 * over. The slider is a fraction OF this rather than a gain in its own right,
 * so MUSIC at 100% is the level this file was mixed at and not three times it.
 * The one-shots were authored against a bus at 1, so they need no trim.
 */
const MUSIC_TRIM = 0.34;

/** What a level is when nothing has been stored, and what the old 'on' meant. */
const DEFAULT_LEVEL = 1;

/* Above the levels below, and it has to stay there: readLevel() calls this
   while those very `let`s are being initialised, so a clamp01 declared further
   down would still be in its dead zone — and readLevel's own try/catch would
   swallow the ReferenceError and hand back the default, silently, for every
   level anyone had ever set. */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

let ctx = null;
let master = null;
let sfxBus = null; // one-shots and ambience
let musicBus = null; // the theme, and only the theme
let ambience = false; // is the room live enough to make its own noises?
let sfxVol = readLevel(KEY);
let musicVol = readLevel(MUSIC_KEY);
let muted = readMuted();
/** Set while a game has the machine: the theme is held down, not turned down. */
let ducked = false;
let blipTimer = 0;
let nextBlip = 3;

/** Pentatonic on C, so random picks never sound wrong. */
const BLIPS = [523.25, 587.33, 698.46, 783.99, 880, 1046.5];

/**
 * A level, with the switch era read as a special case. Anything unparseable
 * lands on the default rather than on silence — a store shared by every game on
 * this origin is a store anything at all may have written to.
 */
function readLevel(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return DEFAULT_LEVEL;
    if (raw === 'off') return 0; // the old switch, thrown
    if (raw === 'on') return DEFAULT_LEVEL; // the old switch, as it sounded
    // Number('') and Number(' ') are both 0, which would read an empty key as
    // silence rather than as nothing stored. Ask first.
    const level = raw.trim() === '' ? NaN : Number(raw);
    return Number.isFinite(level) ? clamp01(level) : DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL; // private mode: play, and forget the preference
  }
}

function writeLevel(key, level) {
  try {
    localStorage.setItem(key, String(Math.round(level * 100) / 100));
  } catch {
    /* nothing to do about it */
  }
}

function readMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeMuted(on) {
  try {
    localStorage.setItem(MUTED_KEY, on ? 'on' : 'off');
  } catch {
    /* nothing to do about it */
  }
}

// --- the three gains, each painted from the state above --------------------
// Ramped rather than set, because a gain that jumps clicks. Nothing here runs
// before the first gesture; unlock() builds the nodes at their right values.

function applyMaster() {
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.04);
}

function applySfx() {
  if (ctx) sfxBus.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.05);
}

function applyMusic(tau = 0.2) {
  if (ctx) musicBus.gain.setTargetAtTime(ducked ? 0 : musicVol * MUSIC_TRIM, ctx.currentTime, tau);
}

/** Worth scheduling a one-shot at all. Silence costs nothing to skip. */
const audible = () => !!ctx && !muted && sfxVol > 0;

/** Called from a real gesture. Safe to call repeatedly. */
export function unlock() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVol;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = ducked ? 0 : musicVol * MUSIC_TRIM;
    musicBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// ---------------------------------------------------------------------------
// Levels and the cutoff
// ---------------------------------------------------------------------------

export const sfxLevel = () => sfxVol;
export const musicLevel = () => musicVol;
export const isMuted = () => muted;

export function setSfxLevel(level) {
  sfxVol = clamp01(level);
  writeLevel(KEY, sfxVol);
  applySfx();
  liftMute(sfxVol);
}

export function setMusicLevel(level) {
  musicVol = clamp01(level);
  writeLevel(MUSIC_KEY, musicVol);
  applyMusic();
  liftMute(musicVol);
}

export function setMuted(on) {
  muted = !!on;
  writeMuted(muted);
  applyMaster();
}

/**
 * Reaching for a volume means wanting to hear something, so a level raised off
 * zero takes the cutoff off with it. It lives in here rather than in the click
 * handler so no caller can forget it: a slider silently cancelled by a mute set
 * somewhere else is worse than a slider that does nothing at all.
 */
function liftMute(level) {
  if (level > 0 && muted) setMuted(false);
}

// ---------------------------------------------------------------------------
// One-shots
// ---------------------------------------------------------------------------

function envelope(node, when, attack, hold, release, peak) {
  const g = node.gain;
  g.setValueAtTime(0.0001, when);
  g.exponentialRampToValueAtTime(peak, when + attack);
  g.setValueAtTime(peak, when + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
}

function tone({ freq, to, type = 'square', at = 0, attack = 0.004, hold = 0.02, release = 0.12, peak = 0.16, pan = 0 }) {
  if (!audible()) return;
  const when = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, when + attack + hold + release);

  const gain = ctx.createGain();
  envelope(gain, when, attack, hold, release, peak);

  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  osc.connect(gain).connect(panner).connect(sfxBus);
  osc.start(when);
  osc.stop(when + attack + hold + release + 0.02);
}

/** Filtered noise: footsteps, the poof of a landing, the whoosh of a takeoff. */
function noise({ at = 0, duration = 0.14, peak = 0.1, from = 1400, to = 400, q = 1.2 }) {
  if (!audible()) return;
  const when = ctx.currentTime + at;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, when);
  filter.frequency.exponentialRampToValueAtTime(to, when + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(when);
}

export const step = () => noise({ duration: 0.07, peak: 0.045, from: 900, to: 260, q: 0.8 });
export const hop = () => tone({ freq: 300, to: 700, type: 'triangle', hold: 0.01, release: 0.1, peak: 0.1 });
export const land = () => noise({ duration: 0.12, peak: 0.08, from: 700, to: 160 });

export function takeoff() {
  noise({ duration: 0.5, peak: 0.1, from: 320, to: 2600, q: 0.7 });
  tone({ freq: 440, to: 1320, type: 'sine', attack: 0.02, hold: 0.08, release: 0.3, peak: 0.09 });
}

/** The whole reason a coin slot exists: two clicks, a chime, and a thunk. */
export function coin() {
  tone({ freq: 1180, type: 'square', hold: 0.01, release: 0.05, peak: 0.1 });
  tone({ freq: 1560, type: 'square', at: 0.055, hold: 0.012, release: 0.06, peak: 0.11 });
  tone({ freq: 2340, type: 'sine', at: 0.1, hold: 0.03, release: 0.22, peak: 0.09 });
  noise({ at: 0.19, duration: 0.1, peak: 0.09, from: 500, to: 110 });
}

/** The cabinet coming up: a rising arpeggio, then the tube striking. */
export function boot() {
  [392, 523.25, 659.25, 783.99].forEach((freq, i) =>
    tone({ freq, type: 'square', at: i * 0.075, hold: 0.03, release: 0.16, peak: 0.085 }),
  );
  tone({ freq: 60, to: 30, type: 'sine', at: 0.3, attack: 0.01, hold: 0.05, release: 0.4, peak: 0.22 });
  noise({ at: 0.3, duration: 0.3, peak: 0.05, from: 6000, to: 2000, q: 0.5 });
}

export const click = () => tone({ freq: 880, type: 'square', hold: 0.008, release: 0.05, peak: 0.07 });

export const back = () => tone({ freq: 700, to: 320, type: 'triangle', hold: 0.01, release: 0.16, peak: 0.09 });

// ---------------------------------------------------------------------------
// The theme
//
// One file, decoded once, looped forever. Two details matter:
//
//  - `loopStart` is set past whatever silence the decoder puts at the head.
//    Compressed formats carry encoder priming, and some decoders hand it back
//    as real samples — which turns a seamless loop into an audible hiccup once
//    every three minutes. So we look for the first sample that is actually
//    above a noise floor and loop from there.
//  - Leaving a machine does not restart the tune. Going into a game ducks this
//    bus to silence and coming out unducks it, so the theme keeps its place
//    rather than starting from the top every time you step away.
// ---------------------------------------------------------------------------

let themeBuffer = null;
let themeLoading = null;
let themeSource = null;
let themeFailed = false;

async function loadTheme() {
  if (themeBuffer) return themeBuffer;
  if (!themeLoading) {
    themeLoading = (async () => {
      try {
        const res = await fetch(THEME_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        themeBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
        themeFailed = false;
        return themeBuffer;
      } catch (err) {
        // A missing or undecodable theme costs the room its music and nothing
        // else — but it says so in the pause menu rather than only in the
        // console, because "the music is not playing" is otherwise a mystery
        // with no way in. A stale service worker serving a build that asks for
        // a file that has since been renamed lands exactly here.
        console.warn('[cloudnine] no theme music:', err.message, THEME_URL);
        themeFailed = true;
        themeLoading = null;
        return null;
      }
    })();
  }
  return themeLoading;
}

/** Seconds until the first sample above the floor, looking only at the head. */
function firstSound(buffer, floor = 0.002) {
  const data = buffer.getChannelData(0);
  const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 2));
  for (let i = 0; i < limit; i++) {
    if (Math.abs(data[i]) > floor) return i / buffer.sampleRate;
  }
  return 0;
}

/** False once the theme has been tried and could not be had. */
export const isMusicAvailable = () => !themeFailed;

/** Resolves when there is either music playing or a reason there is not. */
export async function startMusic() {
  if (!ctx || themeSource) return;
  const buffer = await loadTheme();
  if (!buffer || themeSource) return; // a second call may have won the race

  const start = firstSound(buffer);
  themeSource = ctx.createBufferSource();
  themeSource.buffer = buffer;
  themeSource.loop = true;
  themeSource.loopStart = start;
  themeSource.loopEnd = buffer.duration;
  themeSource.connect(musicBus);
  themeSource.start(0, start);
}

export function stopMusic() {
  if (!themeSource) return;
  const source = themeSource;
  themeSource = null;
  try {
    source.stop(ctx.currentTime + 0.05);
  } catch {
    /* already stopped */
  }
}

/**
 * Silence the theme without losing its place — a game has the machine, or the
 * tab went away. Remembered rather than merely applied, so that a level set
 * while the theme is held down does not quietly bring it back up: applyMusic()
 * reads `ducked` every time and the two cannot argue.
 */
export function duckMusic(on) {
  ducked = !!on;
  applyMusic(0.25);
}

// ---------------------------------------------------------------------------
// Ambience
//
// There WAS a mains hum here — detuned saws at 50 Hz under a low-pass, on the
// theory that a room full of CRTs drones. It went, for two good reasons: it
// sits exactly where the theme's bass lives and muddies it, and a drone you
// cannot switch off separately is just noise on top of somebody's music.
// A room with a tune in it does not need a hum to feel occupied.
//
// What is left is the part that was doing the real work: other people's
// machines going off across the floor. A blip panned hard left is a machine
// over there, playing without you, and that is what makes 18 x 14 metres feel
// occupied rather than empty.
// ---------------------------------------------------------------------------

/** Not a node any more, just "the room is live and may make a noise". */
export function startAmbience() {
  if (!ctx) return;
  ambience = true;
}

export function stopAmbience() {
  ambience = false;
}

/**
 * Somebody else's machine, somewhere else in the room. Called every frame; it
 * decides for itself when the room is due another noise.
 */
export function tickAmbience(dt) {
  if (!audible() || !ambience) return;
  blipTimer += dt;
  if (blipTimer < nextBlip) return;
  blipTimer = 0;
  nextBlip = 2 + Math.random() * 5;

  const pan = Math.random() * 1.6 - 0.8;
  const root = BLIPS[Math.floor(Math.random() * BLIPS.length)];
  const notes = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < notes; i++) {
    tone({
      freq: root * (1 + i * 0.26),
      type: Math.random() < 0.5 ? 'square' : 'triangle',
      at: i * 0.09,
      hold: 0.02,
      release: 0.1,
      peak: 0.022, // distant on purpose: this is not your machine
      pan,
    });
  }
}
