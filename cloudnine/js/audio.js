/* =============================================================================
 * audio.js — the room, synthesized, and the one piece of music that is not.
 *
 * An arcade is mostly a sound: a low mains hum you stop hearing after a minute,
 * and other people's machines going off across the room. Both are here, and the
 * second one is what makes 18 x 14 metres of empty floor feel occupied — a blip
 * panned hard left is a machine over there, playing without you. All of it is
 * WebAudio oscillators and filtered noise, per house rule.
 *
 * The exception is the theme, which is a real file the owner wrote. It gets its
 * own bus and its own switch, because "I want the room but not the tune" and
 * "I want the tune but not the beeping" are both reasonable, and one volume
 * control cannot say either.
 *
 *      one-shots ─┐
 *      ambience ──┴─> sfx ──┐
 *                           ├─> master ─> destination
 *      theme ─────────────> music ──┘
 *
 * The AudioContext is created on the first gesture and never before: browsers
 * refuse otherwise, and a page that asks for audio before you have touched it
 * deserves to be refused.
 * ========================================================================== */

const KEY = 'arcade.cloudnine.sound.v1';
const MUSIC_KEY = 'arcade.cloudnine.music.v1';

/** Module-relative, so the path does not depend on where the page lives. */
const THEME_URL = new URL('../audio/theme.m4a', import.meta.url).href;

/** Loud enough to be the room's music, quiet enough to talk over. */
const MUSIC_LEVEL = 0.34;

let ctx = null;
let master = null;
let sfxBus = null; // one-shots and ambience
let musicBus = null; // the theme, and only the theme
let room = null; // ambience sits a little under the one-shots
let ambience = null; // { stop() } while the hum is running
let enabled = read(KEY);
let musicOn = read(MUSIC_KEY);
let blipTimer = 0;
let nextBlip = 3;

/** Pentatonic on C, so random picks never sound wrong. */
const BLIPS = [523.25, 587.33, 698.46, 783.99, 880, 1046.5];

function read(key) {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true; // private mode: default to on, forget the preference
  }
}

function write(key, on) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    /* nothing to do about it */
  }
}

/** Called from a real gesture. Safe to call repeatedly. */
export function unlock() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = enabled ? 1 : 0;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? MUSIC_LEVEL : 0;
    musicBus.connect(master);

    room = ctx.createGain();
    room.gain.value = 0.5;
    room.connect(sfxBus);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const isEnabled = () => enabled;

export function setEnabled(on) {
  enabled = on;
  write(KEY, on);
  if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.08);
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
  if (!ctx || !enabled) return;
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
  if (!ctx || !enabled) return;
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

async function loadTheme() {
  if (themeBuffer) return themeBuffer;
  if (!themeLoading) {
    themeLoading = (async () => {
      try {
        const res = await fetch(THEME_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        themeBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
        return themeBuffer;
      } catch (err) {
        // A missing or undecodable theme costs the room its music, nothing else.
        console.info('[cloudnine] no theme music:', err.message);
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

export const isMusicEnabled = () => musicOn;

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

/** Silence the theme without losing its place. */
export function duckMusic(on) {
  if (!musicBus) return;
  const target = on || !musicOn ? 0 : MUSIC_LEVEL;
  musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
}

export function setMusicEnabled(on) {
  musicOn = on;
  write(MUSIC_KEY, on);
  if (musicBus) musicBus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, ctx.currentTime, 0.2);
  if (on) startMusic();
}

// ---------------------------------------------------------------------------
// Ambience
// ---------------------------------------------------------------------------

/**
 * Two saws a few cents apart under a low-pass, which beat against each other
 * slowly and never settle into a pitch you can name. Plus mains buzz at 50 Hz,
 * because that is what a room full of CRTs sounds like.
 */
export function startAmbience() {
  if (!ctx || ambience) return;
  const nodes = [];
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 210;
  filter.Q.value = 0.6;

  const bed = ctx.createGain();
  bed.gain.value = 0;
  bed.gain.setTargetAtTime(0.09, ctx.currentTime, 1.5);
  filter.connect(bed).connect(room);

  for (const freq of [49.8, 50.6, 100.4]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.connect(filter);
    osc.start();
    nodes.push(osc);
  }

  ambience = {
    stop() {
      bed.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      for (const osc of nodes) osc.stop(ctx.currentTime + 2);
      ambience = null;
    },
  };
}

export function stopAmbience() {
  ambience?.stop();
}

/**
 * Somebody else's machine, somewhere else in the room. Called every frame; it
 * decides for itself when the room is due another noise.
 */
export function tickAmbience(dt) {
  if (!ctx || !enabled || !ambience) return;
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
