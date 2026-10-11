/* =============================================================================
 * quality.js — how hard the sky is allowed to push the GPU.
 *
 * One scene, two budgets, and they turn down PIXELS: how many each material
 * is shaded at, how many lights reach them, how wide the blur is. That is the
 * GPU half of a frame. The CPU half — how many separate meshes the engine has
 * to walk and draw — is not a tier, it is how the world is built: room.js
 * mergeStatic folds static parts into one mesh per material, which took the
 * title view from 2,541 draw calls and 10.7 ms of CPU to 797 and 4.9 ms
 * (headless Chrome, 2026-10-02). This header used to say "924 draw calls";
 * by then the real number was nearly three times that. Measure, then believe.
 *
 * So the lighter tier removes nothing you can point at. It shades fewer
 * pixels, lights them with two lamps instead of four, filters the shadow with
 * one tap instead of many, and stops the glow layer redrawing a thousand
 * meshes to find the fifty that are actually neon. Everything is still there.
 *
 * Every knob here is live. Nothing needs a reload, which matters because the
 * only way to set this is the pause menu, and a launcher that reloaded itself
 * would take the game running in the iframe with it.
 *
 * The tier is a choice, not a verdict. Touch starts on `lighter` because that
 * is the safe guess and a tablet is the common case; the pause menu overrides
 * it and the choice is remembered. `?q=` and `?scale=` override it again for
 * one session, unremembered, so a device can be measured without being talked
 * into anything — which is the whole point of a probe.
 *
 * THE GOVERNOR (lighter tier only). A tier is a guess made once; a frame rate
 * is a fact measured sixty times a second. So on `lighter` the resolution is
 * not fixed at 1.25: it walks down a short ladder — 1.25, 1.1, 1.0, 0.85,
 * 0.75 — when the frame cannot hold 60 fps, and back up when it plainly can.
 * Every rule below exists to stop it doing something stupid:
 *
 *  - It judges WHOLE SECONDS, by the share of frames that took longer than
 *    20 ms, never one frame. More than a quarter slow, two seconds running, is
 *    a step down. Fewer than one in twenty slow, eight seconds running, earns a
 *    trial step up. A share rather than an average because one GC pause should
 *    not cost anyone resolution, and a threshold in milliseconds rather than
 *    "60 fps" because a 120 Hz iPad delivers 8 ms frames and is not failing.
 *  - A step up that goes bad within three seconds is taken back, and the next
 *    attempt waits twice as long (8 s, 16 s … two minutes). That is what stops
 *    it oscillating on a device that sits right at the edge.
 *  - A step down that does NOT help is taken back too. If fewer pixels leave
 *    the frame as slow — no fewer slow frames and the average not 10% better —
 *    pixels were never the problem: the frame is CPU-bound on draw calls (the
 *    case `?scale=` exists to tell apart), or the browser is capping rAF at
 *    30 Hz (iOS Low Power Mode does).
 *    Either way a blurrier sky buys nothing, so it goes back and stays back,
 *    for a minute and then doubling.
 *  - It does not count frames it should not judge: the first second after
 *    boot, a camera dive to the glass (main.js calls hold()), and the first
 *    second after any gap of more than a quarter of a second — a background
 *    tab, or the render loop stopping while a game plays in the cabinet — so
 *    a throttled or resumed tab never reads as a slow GPU.
 *  - A `?scale=` probe switches it off: a measurement must not be adjusted
 *    while it is being taken. So does `?gov=0`, and so does `full`, which is
 *    the player saying they would rather have the pixels.
 *
 * The floor is 0.75. Below that the sky's thin masts and railings shimmer, and
 * a smooth sky nobody can read is not the win. PERFORMANCE.md's bar is that
 * the owner's iPad never leaves 1.0; `?perf=1` shows where it sits.
 *
 * `?perf=1` puts a small readout in the top left: fps, frame time p50/p95,
 * Babylon's CPU ms, draw calls, active meshes, the resolution in force and the
 * lowest the governor has gone. Off, it costs nothing — not one observer.
 * ========================================================================== */

import { IS_TOUCH } from './controls.js';

const KEY = 'arcade.cloudnine.quality.v1';

/**
 * `pixels` is a multiplier on CSS pixels, capped by the real device ratio —
 * asking for 2 on a 1x monitor renders twice and throws half away.
 *
 * 1.25 rather than 1 because the sky is full of thin masts, railings and sign
 * edges, and those are what go to pieces first when you drop resolution. It
 * is a 61% cut in fragment work against the 2x the panel would like.
 */
export const TIERS = {
  full: { pixels: 2, shadowTaps: 'many', lamps: true, blurKernel: 28, leanShading: false },
  lighter: { pixels: 1.25, shadowTaps: 'one', lamps: false, blurKernel: 16, leanShading: true },
};

const params = new URLSearchParams(location.search);

/** `?q=full|lighter` — a session override that is never written back. */
const forcedTier = TIERS[params.get('q')] ? params.get('q') : null;

/**
 * `?scale=<n>` — the measurement that splits the two ways a frame can be slow.
 * Quarter the pixels and watch: if it comes good, the GPU was the problem and
 * the answer is resolution. If it stays choppy at a quarter of the work, the
 * frame is CPU-bound on draw calls and no amount of resolution will touch it.
 */
const forcedScale = Number.parseFloat(params.get('scale'));

let current = forcedTier || stored() || (IS_TOUCH ? 'lighter' : 'full');

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return TIERS[v] ? v : null;
  } catch {
    return null;
  }
}

export const tier = () => current;
export const settings = () => TIERS[current];

/** True while a URL parameter is in charge, so the menu can say so. */
export const probing = () => Boolean(forcedTier) || Number.isFinite(forcedScale);

/** The backbuffer multiplier actually in force, probe and governor included. */
export function pixels() {
  const want = Number.isFinite(forcedScale) ? forcedScale : Math.min(TIERS[current].pixels, gov.cap);
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, want));
}

/**
 * Point the engine, the sun and the glow at the current tier. Safe to call
 * whenever; `lamps` may be empty during boot, before they exist.
 */
export function apply({ engine, shadows, lamps = [], glow }) {
  const s = TIERS[current];

  engine.setHardwareScalingLevel(1 / pixels());

  if (shadows) {
    // EVERY surface in the sky is a receiver (room.js and cabinets.js both
    // set receiveShadows), so the filter's cost lands on the whole screen
    // rather than on the one thing casting. Both tiers use PCF; what differs
    // is how many taps.
    //
    // The lighter tier used to switch filtering off altogether, and that was
    // the "minecraft" shadow: an unfiltered map is one depth compare per
    // pixel, and every texel edge shows as a stair. PCF at QUALITY_LOW is ALSO
    // one fetch — on WebGL2 it is a hardware shadow sampler, which compares
    // the 2×2 texels around the point and blends them in the same fetch — so
    // the edge comes out smooth for what the hard edge already cost. Measured
    // 2026-10-11, PCF-low against the old unfiltered path with everything else
    // equal, two runs each: no extra cost at all — the frame interval came out
    // 4–6% LOWER, the hardware compare being cheaper than doing it in the
    // shader. Full keeps the wider kernel on a desktop, which has it to spare.
    shadows.useContactHardeningShadow = false;
    shadows.usePoissonSampling = false;
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = s.shadowTaps === 'many' && !IS_TOUCH
      ? BABYLON.ShadowGenerator.QUALITY_MEDIUM
      : BABYLON.ShadowGenerator.QUALITY_LOW;
  }

  // Each of these multiplies the per-pixel cost of every lit material in view.
  // The neon is emissive rather than lights, so the room keeps its colour.
  for (const lamp of lamps) lamp.setEnabled(s.lamps);

  if (glow) glow.blurKernelSize = s.blurKernel;
}

/**
 * The lighter tier's shading trim: the two parts of Babylon's PBR shader
 * that only mean anything with an environment map, which this sky does not
 * have (main.js, where the metals are clamped, says why).
 *
 *  - The environment BRDF lookup: one texture fetch per pixel per material,
 *    scaling reflections of an environment that is not there.
 *  - Energy conservation for that same missing reflection, and the
 *    height-correlated Smith visibility term — a refinement of a specular
 *    highlight that, on these rough, mostly matte surfaces, is a few levels of
 *    grey on the brightest edge.
 *
 * Measured 2026-10-11 on the bench's fill-cost proxy (SwiftShader frame
 * interval, fixed resolution): 5–12% fewer milliseconds per view, and the
 * screenshots of title, gopher, dam and aquarium differ from untrimmed by a
 * mean of under 0.1 of 255 — the gopher's breathing moves more pixels.
 * Converting the sky to StandardMaterial was measured too and saved barely
 * more (11%) while changing half the pixels on screen: PBR lights in linear
 * space and the islands' vertex colours are linear, so no Standard setting
 * gets the same picture back. Rejected; see PERFORMANCE.md.
 *
 * Any material with a real reflection texture is left alone. The originals
 * are remembered, so `full` puts every material back exactly as it was.
 * main.js calls this once the world is built; setTier calls it again.
 */
const shadingWas = new WeakMap();
export function shade(scene) {
  const lean = TIERS[current].leanShading;
  for (const m of scene.materials) {
    if (m.getClassName() !== 'PBRMaterial' || m.reflectionTexture) continue;
    if (!shadingWas.has(m)) {
      shadingWas.set(m, {
        lut: m.environmentBRDFTexture,
        energy: m.brdf.useEnergyConservation,
        smith: m.brdf.useSmithVisibilityHeightCorrelated,
        gloss: m.brdf.useSpecularGlossinessInputEnergyConservation,
      });
    }
    const was = shadingWas.get(m);
    m.environmentBRDFTexture = lean ? null : was.lut;
    m.brdf.useEnergyConservation = lean ? false : was.energy;
    m.brdf.useSmithVisibilityHeightCorrelated = lean ? false : was.smith;
    m.brdf.useSpecularGlossinessInputEnergyConservation = lean ? false : was.gloss;
  }
  // main.js blocks Babylon's material dirty-checking after boot (it costs CPU
  // every frame and nothing changes). These are define changes, so the
  // shaders must be rebuilt: lifting the block marks every material dirty
  // once, and it goes straight back on.
  if (scene.blockMaterialDirtyMechanism) {
    scene.blockMaterialDirtyMechanism = false;
    scene.blockMaterialDirtyMechanism = true;
  }
}

export function setTier(name, targets) {
  if (!TIERS[name]) return;
  current = name;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Private mode. The tier still holds for this session, which is enough.
  }
  // A new tier is a fresh start: whatever the governor learned about the old
  // one says nothing about this one.
  resetGovernor(performance.now());
  // A frozen material never re-checks its shader, so it would go on lighting
  // with the lamps the tier just switched off, or filtering the shadow the old
  // way. Any material anybody froze (main.js freezes the sky's; foxrace.js its
  // riders') is thawed for the change and frozen again only once every mesh
  // wearing one has its new shader — including islands nobody is looking at,
  // which is why this asks each mesh rather than waiting a few frames: an
  // island out of view would otherwise be refrozen on its old shader and
  // come into view still lit by lamps that are off. A tier change is a menu
  // tap, so the checking is a few frames of work once, not a frame cost.
  const frozen = new Set(targets.engine.scenes.flatMap((s) => s.materials.filter((m) => m.isFrozen)));
  for (const m of frozen) m.unfreeze();
  apply(targets);
  for (const scene of targets.engine.scenes) shade(scene);
  if (!frozen.size) return;
  const wearing = targets.engine.scenes.flatMap((s) => s.meshes.filter((m) => frozen.has(m.material)));
  let frames = 0;
  const obs = targets.engine.onEndFrameObservable.add(() => {
    // isReady(true) builds the shader for a mesh even when it is off screen;
    // every mesh is asked every frame, so all of them start compiling at once.
    let pending = 0;
    for (const m of wearing) if (!m.isDisposed() && !m.isReady(true)) pending++;
    if (pending && ++frames < 240) return;
    targets.engine.onEndFrameObservable.remove(obs);
    for (const m of frozen) m.freeze();
  });
}

/* -----------------------------------------------------------------------
 * The resolution governor. See the header for the rules; the numbers are
 * here, named, so the rules and the code can be read side by side.
 * -------------------------------------------------------------------- */

const LADDER = [1.25, 1.1, 1, 0.85, 0.75];
const SLOW_MS = 20;          // a frame this long has missed 60 Hz
const BAD_SHARE = 0.25;      // a second with more slow frames than this is bad
const GOOD_SHARE = 0.05;     // ... and with fewer than this, good
const BAD_TO_STEP = 2;       // bad seconds in a row before a step down
const GOOD_TO_STEP = 8;      // good seconds before the first trial step up
const TRIAL_SECONDS = 3;     // a step up must survive this long
const HELPED = 0.85;         // a step down must cut the slow share by 15% ...
const FASTER = 0.9;          // ... or the average frame by 10%
const GAP_MS = 250;          // longer than this between frames is a pause, not a frame
const SETTLE_MS = 1000;      // ignore this long after boot, a pause or a dive
const REALLOC_MS = 1500;     // ... and after a resolution change reallocates targets
const NO_GAIN_MS = 60000;    // how long a step that did not help stays forbidden

const gov = {
  engine: null,
  cap: Infinity,       // the multiplier ceiling in force; Infinity = untouched
  rung: 0,             // index into the device's own ladder
  ladder: [1],
  last: 0,             // previous frame's timestamp
  holdUntil: 0,
  windowStart: 0, frames: 0, slow: 0, spent: 0,
  bad: 0, good: 0,
  upWait: GOOD_TO_STEP,
  trial: 0,            // seconds left in a step-up trial, 0 = none
  probation: null,     // { share, seconds, sum } after a step down
  noGainRung: -1, noGainUntil: 0, noGainMs: NO_GAIN_MS,
  lowest: Infinity,
};

/** Whether the governor may touch the resolution at all, right now. */
const governing = () => gov.engine && current === 'lighter' &&
  !Number.isFinite(forcedScale) && params.get('gov') !== '0';

function resetGovernor(now) {
  const dpr = window.devicePixelRatio || 1;
  // The ladder as this screen can use it: rungs above the panel's own ratio
  // are the same picture, so a 1x screen starts at 1.0 and has three rungs.
  gov.ladder = [...new Set(LADDER.map((v) => Math.min(v, dpr)))];
  gov.rung = 0;
  gov.cap = Infinity;
  gov.bad = gov.good = gov.trial = 0;
  gov.upWait = GOOD_TO_STEP;
  gov.probation = null;
  gov.noGainRung = -1;
  gov.noGainMs = NO_GAIN_MS;
  gov.lowest = Infinity;
  openWindow(now, SETTLE_MS);
}

function openWindow(now, settle = 0) {
  gov.holdUntil = Math.max(gov.holdUntil, now + settle);
  gov.windowStart = Math.max(now, gov.holdUntil);
  gov.frames = gov.slow = gov.spent = 0;
}

function stepTo(rung, now) {
  gov.rung = rung;
  gov.cap = rung === 0 ? Infinity : gov.ladder[rung];
  gov.engine.setHardwareScalingLevel(1 / pixels());
  gov.lowest = Math.min(gov.lowest, pixels());
  gov.bad = gov.good = 0;
  openWindow(now, REALLOC_MS);
}

/**
 * One second of frames, judged: `share` of them slow, `mean` ms on average.
 * The share decides; the mean only breaks a tie in probation, where a device
 * going from 30 ms frames to 24 ms is plainly helped and yet still has every
 * frame over the line.
 */
function judge(share, mean, now) {
  const bad = share > BAD_SHARE;
  const good = share < GOOD_SHARE;
  gov.bad = bad ? gov.bad + 1 : 0;
  gov.good = good ? gov.good + 1 : 0;

  // A step down on trial: did fewer pixels make the frame faster?
  if (gov.probation) {
    const p = gov.probation;
    p.sum += share;
    p.meanSum += mean;
    if (++p.seconds < BAD_TO_STEP) return;
    gov.probation = null;
    const after = p.sum / p.seconds;
    if (after > BAD_SHARE && after >= p.share * HELPED && p.meanSum / p.seconds >= p.mean * FASTER) {
      // No. Put the pixels back and do not try that rung again for a while.
      gov.noGainRung = gov.rung;
      gov.noGainUntil = now + gov.noGainMs;
      gov.noGainMs = Math.min(gov.noGainMs * 2, 8 * NO_GAIN_MS);
      stepTo(gov.rung - 1, now);
      return;
    }
  }

  // A step up on trial: one bad second and it goes back, and waits longer.
  if (gov.trial) {
    if (bad) {
      gov.trial = 0;
      gov.upWait = Math.min(gov.upWait * 2, 128);
      stepTo(gov.rung + 1, now);
      return;
    }
    gov.trial--;
  }

  if (gov.bad >= BAD_TO_STEP && gov.rung < gov.ladder.length - 1) {
    const next = gov.rung + 1;
    if (next === gov.noGainRung && now < gov.noGainUntil) return;
    gov.probation = { share, mean, seconds: 0, sum: 0, meanSum: 0 };
    stepTo(next, now);
  } else if (gov.good >= gov.upWait && gov.rung > 0) {
    gov.trial = TRIAL_SECONDS;
    stepTo(gov.rung - 1, now);
  }
}

function onFrame() {
  const now = performance.now();
  const gap = now - gov.last;
  gov.last = now;
  if (!governing()) return;
  // A long gap is the tab coming back or the loop restarting: not a slow frame.
  if (gap > GAP_MS) { openWindow(now, SETTLE_MS); return; }
  if (now < gov.holdUntil) return;
  if (now < gov.windowStart) return;
  gov.frames++;
  gov.spent += gap;
  if (gap > SLOW_MS) gov.slow++;
  if (now - gov.windowStart >= 1000) {
    const share = gov.slow / Math.max(gov.frames, 1);
    const mean = gov.spent / Math.max(gov.frames, 1);
    openWindow(now);
    judge(share, mean, now);
  }
}

/**
 * Start watching frames. Called once by main.js after the first apply();
 * costs one timestamp a frame, and nothing at all to the frame on `full`.
 */
export function govern({ engine }) {
  if (gov.engine) return;
  gov.engine = engine;
  resetGovernor(performance.now());
  engine.onBeginFrameObservable.add(onFrame);
}

/** Stop judging for a while — a camera dive is not the GPU's fault. */
export function hold(seconds) {
  openWindow(performance.now(), seconds * 1000);
}

/* -----------------------------------------------------------------------
 * The stats readout — fps, frame times, draw calls, the resolution in force.
 *
 * Two ways in: the pause menu's "Show stats" switch, remembered on the device
 * (STATS_KEY), and `?perf=1`, which turns it on for one session without being
 * remembered, like `?q=` and `?scale=`. Off costs nothing: the instrumentation,
 * the frame observer, the timer and the node are all created when it is
 * switched on and all torn down when it is switched off.
 * -------------------------------------------------------------------- */

const STATS_KEY = 'arcade.cloudnine.stats.v1';
const forcedStats = params.get('perf') === '1';
let stats = null;
let statsTargets = null;

function storedStats() {
  try {
    return localStorage.getItem(STATS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether the readout is on right now. */
export const statsShown = () => Boolean(stats);
/** True while `?perf=1` holds it on, so the menu can say so. */
export const statsForced = () => forcedStats;

/** Called once at boot; shows the readout if the player or the link asked. */
export function startOverlay(targets) {
  statsTargets = targets;
  if (forcedStats || storedStats()) showStats(true, { remember: false });
}

export function showStats(on, { remember = true } = {}) {
  if (remember && !forcedStats) {
    try {
      localStorage.setItem(STATS_KEY, on ? '1' : '0');
    } catch {
      // Private mode: it still holds for this session.
    }
  }
  if (on && !stats && statsTargets) stats = buildStats(statsTargets);
  else if (!on && stats) {
    stats.stop();
    stats = null;
  }
}

function buildStats({ engine, scene }) {
  const inst = new BABYLON.SceneInstrumentation(scene);
  inst.captureFrameTime = true;
  const box = document.createElement('pre');
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;z-index:36;margin:0;pointer-events:none;' +
    'top:calc(max(12px, env(safe-area-inset-top)) + 58px);left:max(14px, env(safe-area-inset-left));' +
    'padding:6px 8px;border-radius:6px;background:rgba(8,14,24,.72);color:#bfffe9;' +
    'font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre';
  document.body.append(box);

  // Two seconds of frame gaps at up to 120 Hz.
  const gaps = new Float32Array(256);
  const sorted = new Float32Array(256);
  let head = 0, count = 0, last = 0;
  const observer = engine.onBeginFrameObservable.add(() => {
    const now = performance.now();
    if (last && now - last < GAP_MS) { gaps[head] = now - last; head = (head + 1) % gaps.length; count = Math.min(count + 1, gaps.length); }
    last = now;
  });
  const timer = setInterval(() => {
    let n = 0, sum = 0;
    for (let i = 1; i <= count && sum < 2000; i++) {
      const g = gaps[(head - i + gaps.length) % gaps.length];
      sorted[n++] = g;
      sum += g;
    }
    const s = sorted.subarray(0, n).sort();
    const at = (q) => (n ? s[Math.min(n - 1, Math.floor(n * q))] : 0).toFixed(1);
    const px = 1 / engine.getHardwareScalingLevel();
    box.textContent =
      `${n ? (1000 * n / sum).toFixed(0) : '–'} fps   ${at(0.5)} / ${at(0.95)} ms p50/p95\n` +
      `cpu ${inst.frameTimeCounter.lastSecAverage.toFixed(1)} ms   draws ${inst.drawCallsCounter.current}   ` +
      `active ${scene.getActiveMeshes().length}\n` +
      `${current}  ${px.toFixed(2)}x` +
      (Number.isFinite(forcedScale) ? ' (?scale)' : governing()
        ? `  governed, low ${Number.isFinite(gov.lowest) ? gov.lowest.toFixed(2) : px.toFixed(2)}x` : '');
  }, 500);

  return {
    stop() {
      clearInterval(timer);
      engine.onBeginFrameObservable.remove(observer);
      inst.dispose();
      box.remove();
    },
  };
}

/* -----------------------------------------------------------------------
 * Why there is no focusGlow() here any more.
 *
 * There was one, and it was wrong. A GlowLayer renders the scene into its own
 * texture to build the bloom, and the obvious saving is to hand it only the
 * ~60 meshes that have any emissive at all rather than letting it walk all
 * 1,100 to find them. That is a real 90% cut in the pass, and it produces
 * neon that shines straight through the clouds.
 *
 * The thousand meshes were not waste. They render black into that texture,
 * but they still write DEPTH, and depth is the only reason a tube behind a
 * cloud is hidden by it. Name only the emissive ones and nothing occludes
 * them any more; the sky keeps its bloom and loses its solidity. What reads
 * as flicker is the near-cabinet pulse at cabinets.js:493 coming through
 * geometry that should have stopped it.
 *
 * So the glow layer keeps every mesh, and the tier turns its blur down
 * instead. If this pass ever needs to be cheaper, the honest lever is
 * mainTextureRatio — fewer pixels in the glow texture, every occluder still
 * in it — and not a shorter list of meshes.
 * -------------------------------------------------------------------- */
