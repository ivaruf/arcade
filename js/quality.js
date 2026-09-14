/* =============================================================================
 * quality.js — how hard the sky is allowed to push the GPU.
 *
 * One scene, two budgets. The geometry is almost never what costs: the world
 * is 924 draw calls of PBR with no textures in it at all, and what actually
 * burns a frame is the number of PIXELS those materials are shaded at, times
 * the number of lights reaching them, times the passes laid over the top.
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
  full: { pixels: 2, softShadows: true, lamps: true, blurKernel: 28 },
  lighter: { pixels: 1.25, softShadows: false, lamps: false, blurKernel: 16 },
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

/** The backbuffer multiplier actually in force, probe included. */
export function pixels() {
  const want = Number.isFinite(forcedScale) ? forcedScale : TIERS[current].pixels;
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
    // PCSS is a many-tap shader and EVERY surface in the sky is a receiver
    // (room.js and cabinets.js both set receiveShadows), so the cost lands on
    // the whole screen rather than on the one thing casting. Hardware PCF is
    // a single tap and, for one gopher-shaped shadow, honestly close.
    shadows.usePercentageCloserFiltering = s.softShadows;
    shadows.useContactHardeningShadow = false;
    if (!s.softShadows) shadows.usePoissonSampling = false;
  }

  // Each of these multiplies the per-pixel cost of every lit material in view.
  // The neon is emissive rather than lights, so the room keeps its colour.
  for (const lamp of lamps) lamp.setEnabled(s.lamps);

  if (glow) glow.blurKernelSize = s.blurKernel;
}

export function setTier(name, targets) {
  if (!TIERS[name]) return;
  current = name;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Private mode. The tier still holds for this session, which is enough.
  }
  apply(targets);
}

/**
 * Tell the glow layer which meshes are actually neon.
 *
 * Left alone, a GlowLayer renders EVERY mesh in the scene into its texture to
 * collect the emissive ones — about 1,100 draws here to find the ~60 that
 * have any emissive at all. Naming them cuts that pass by better than 90%,
 * and on a tile-based GPU it also shrinks the tile binning behind it.
 *
 * Failure is safe by construction: find nothing and we add nothing, which
 * leaves Babylon's own behaviour exactly as it was rather than a dark sky.
 * Returns the count so boot can log what it caught.
 */
export function focusGlow(glow, scene) {
  const lit = scene.meshes.filter((m) => m.material && glows(m.material));
  for (const mesh of lit) glow.addIncludedOnlyMesh(mesh);
  return lit.length;
}

function glows(mat) {
  if (mat.subMaterials) return mat.subMaterials.some((m) => m && glows(m));
  if (mat.emissiveTexture) return true;
  const e = mat.emissiveColor;
  return Boolean(e) && e.r + e.g + e.b > 0.01;
}
