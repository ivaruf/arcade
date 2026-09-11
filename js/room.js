import { createAquariumSwimmers } from './aquarium.js';

/* =============================================================================
 * room.js — the sky: five platforms, one big volume, and nothing underneath.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS SO MUCH SMALLER THAN IT WAS
 * ---------------------------------------------------------------------------
 * This used to describe a building: nine interlocking volumes, arches, a
 * skylight, a stairwell, a ceiling height per room, a roof to hide when the
 * camera rose past it, and camera fitting to stop the chase view filming from
 * inside a wall. Every one of those existed because flight had been bolted on
 * to a place with walls.
 *
 * Making the sky the level deleted all of it. There is one volume — the air
 * you are allowed to be in — and a list of platforms to stand on. No lids, no
 * openings, no occlusion. That is the whole model.
 *
 * ---------------------------------------------------------------------------
 * COORDINATES
 * ---------------------------------------------------------------------------
 * `assets/3d/source/build_clouds.py` authors in GAME coordinates and converts
 * once on export, so the numbers here and the numbers there are the same
 * numbers. Move a platform in one, move it in the other.
 *
 * The kit's own models (the cabinets, the gopher) are Blender Z-up and the
 * glTF loader mirrors X, which composes to:
 *
 *   babylon.x = -blender.x,  babylon.y = blender.z,  babylon.z = -blender.y
 *   babylon.rotation.y = -blender.rotation.z
 *
 * The welcome cloud is the origin, and a cabinet at yaw 0 faces +Z.
 * ========================================================================== */

const ASSETS = './assets/3d/';

/**
 * The platforms. Each is a rectangle you can stand on with nothing but air
 * around it — the ground query takes the highest one at or below you, and off
 * the edge there is simply nothing, which is what makes the cloud-catch in
 * main.js the only thing between the player and an endless drop.
 *
 * They are deliberately CLOSE: 17 to 22 m from the welcome cloud, three or
 * four seconds of flight. You can see all of them from where you arrive, so
 * finding a game is never the puzzle. The fun is the flying, not the hunting.
 */
export const PLATFORMS = [
  { id: 'welcome', name: 'The welcome cloud', x: [-6, 6], z: [-5, 5], y: 0 },
  { id: 'race', name: 'The steamworks', x: [-4.5, 4.5], z: [-21, -13], y: 1.5 },
  { id: 'water', name: 'The aquarium', x: [-23.5, -10.5], z: [-10, 0], y: -2.5 },
  { id: 'mine', name: 'The outcrop', x: [7, 23], z: [-14, -2], y: -5.5 },
  { id: 'calm', name: 'The quiet cloud', x: [-9.5, -0.5], z: [-25.5, -16.5], y: 10 },
];

/**
 * How far you may go. One box, generous enough that flying feels open and
 * bounded so you cannot leave the world — and shallow enough at the bottom
 * that "down" is somewhere you come back from rather than somewhere you fall
 * out of.
 */
export const SKY = { x: [-32, 32], z: [-44, 24], y: [-20, 28] };

/** Where the gopher arrives, and where the world puts it back if it must. */
export const SPAWN = { x: 0, y: 0, z: 2.6, yaw: Math.PI };

/** Stand in the ring on the welcome cloud to go back to the 2D launcher. */
export const HOME = { x: -3.6, y: 0, z: 2.2, radius: 1.5 };

/** The signpost's mast, which signs.js hangs one arm per platform on. */
export const SIGNPOST = { x: 2.6, y: 0, z: 1.4, top: 2.85 };

/** Masts carrying each platform's name board; matches build_clouds.py. */
export const BEACONS = {
  race: { x: 0, y: 1.5, z: -17.5, top: 5.0 },
  water: { x: -17, y: -2.5, z: -9.5, top: 5.4 },
  mine: { x: 15, y: -5.5, z: -13.5, top: 5.2 },
  calm: { x: -5, y: 10, z: -25.0, top: 4.6 },
};

/**
 * A game's platform, by slug. Anything not named here takes the first free
 * standing anywhere, so a new entry in games.json still gets a machine. The
 * welcome cloud has no standings on purpose: it is where you get your
 * bearings, and a machine on it would be the one everybody played.
 */
export const PLACEMENT = {
  maxgear: 'race',
  fishtank: 'water',
  dam_break: 'water',
  supermine: 'mine',
  supermine_adventure: 'mine',
  swirls: 'calm',
};

/** Cabinet standings per platform. A cabinet's screen faces its local +Z. */
export const SLOTS = {
  race: [
    { x: -2.2, z: -19.4, yaw: 0 },
    { x: 2.2, z: -19.4, yaw: 0 },
  ],
  water: [
    { x: -13.0, z: -7.0, yaw: -Math.PI / 2 },
    { x: -13.0, z: -3.0, yaw: -Math.PI / 2 },
  ],
  mine: [
    { x: 19.0, z: -10.0, yaw: -Math.PI / 2 },
    { x: 19.0, z: -6.0, yaw: -Math.PI / 2 },
  ],
  calm: [
    { x: -5.0, z: -23.6, yaw: 0 },
    { x: -5.0, z: -18.4, yaw: Math.PI },
  ],
};

/**
 * One sky, one mood. The building needed a lighting preset per room; up here
 * every platform is under the same weather, and what tells them apart is
 * their own materials and their own neon rather than the light.
 */
export const SKY_LOOK = {
  hemi: 1.0,
  hemiColour: [0.88, 0.93, 1.0],
  groundColour: [0.58, 0.66, 0.82],
  sun: 1.15,
  glow: 0.42,
  fog: 0.0075,
  air: [0.46, 0.62, 0.86],
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const inRect = (r, x, z) => x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1];

export const insideSky = (x, y, z) =>
  x >= SKY.x[0] && x <= SKY.x[1] && z >= SKY.z[0] && z <= SKY.z[1] && y >= SKY.y[0] && y <= SKY.y[1];

/** The platform under a point, or null. Highest at or below, small tolerance. */
export function platformAt(x, z, y) {
  let best = null;
  for (const p of PLATFORMS) {
    if (!inRect(p, x, z)) continue;
    if (p.y <= y + 0.25 && (!best || p.y > best.y)) best = p;
  }
  return best;
}

/** The height of that platform, or -Infinity when there is only air. */
export function groundAt(x, z, y) {
  const p = platformAt(x, z, y);
  return p ? p.y : -Infinity;
}

/** Whichever platform the gopher is over, for the HUD. */
export function platformNear(x, z) {
  for (const p of PLATFORMS) {
    if (inRect(p, x, z)) return p;
  }
  return null;
}

/**
 * A local box, placed and turned by a slot, as an axis-aligned blocker.
 * Babylon's Y rotation maps local (x, z) to (x·cos + z·sin, -x·sin + z·cos);
 * the half-extents grow to the turned box's bounding box, which is exact for
 * the right angles we use and safely generous for anything else.
 */
export function blockerFor(slot, local) {
  const c = Math.cos(slot.yaw);
  const s = Math.sin(slot.yaw);
  return {
    x: slot.x + local.x * c + local.z * s,
    z: slot.z - local.x * s + local.z * c,
    hx: Math.abs(local.hx * c) + Math.abs(local.hz * s),
    hz: Math.abs(local.hx * s) + Math.abs(local.hz * c),
    top: local.top,
    base: slot.base ?? 0,
  };
}

/**
 * Per-kind footprints in cabinet-local metres, generous by a few centimetres
 * so the gopher never visually clips a bevel. Only the upright is used: the
 * kit's racer carries a seat and its dance kind a floor pad, and both stick a
 * metre and a half into a platform that is only nine metres across.
 */
const FOOTPRINT = {
  classic: [{ x: 0, z: 0.11, hx: 0.6, hz: 0.62, top: 2.32 }],
  claw: [{ x: 0, z: 0.05, hx: 0.6, hz: 0.6, top: 2.4 }],
};

export const footprintOf = (kind) => FOOTPRINT[kind] || FOOTPRINT.classic;

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Meshes whose emissive has to come down hard. The kit authors its neon for
 * Cycles, where a bright emission plus area lights reads as a glass tube;
 * under a glow layer, any emissive surface broader than a strip blooms into a
 * flat white slab. Thin pieces — edge lights, rails, ore veins — are exactly
 * what the glow layer is good at and are left alone.
 */
const BROAD_EMISSIVE = ['Tank water', 'Stool seat', 'Cart ore', 'Pavilion rim', 'Pergola rim'];
const BROAD_FACTOR = 0.25;

/** Load one GLB as a container we can stamp out repeatedly. */
export async function container(file, scene) {
  return BABYLON.SceneLoader.LoadAssetContainerAsync(ASSETS, file, scene);
}

/**
 * Things on the platforms the gopher bumps into, kept by hand in step with
 * build_clouds.py. `base` is the platform they stand on, so a stool in the
 * aquarium is not in your way on the cloud ten metres above it.
 */
const FURNITURE = [
  // Steamworks boiler, between the machines at the back of the island.
  { x: 0, z: -20.05, hx: 0.8, hz: 0.75, top: 4.91, base: 1.5 },
  // welcome cloud: two benches, the side welcome board, the signpost
  { x: -4.6, z: -1.0, hx: 0.4, hz: 1.05, top: 0.46 },
  { x: 4.6, z: -1.0, hx: 0.4, hz: 1.05, top: 0.46 },
  { x: 4.95, z: -3.25, hx: 0.22, hz: 1.28, top: 3.1 },
  { x: 2.6, z: 1.4, hx: 0.22, hz: 0.22, top: 3.1 },
  // the aquarium: the tank, and the stools you watch from
  { x: -20.6, z: -5, hx: 1.1, hz: 3.8, top: 1.3, base: -2.5 },
  ...[-7.7, -5.9, -4.1, -2.3].map((z) => ({ x: -15.6, z, hx: 0.3, hz: 0.3, top: -1.8, base: -2.5 })),
  // the outcrop: the headframe's legs, and the cart
  ...[9.1, 13.9].flatMap((x) =>
    [-11, -7].map((z) => ({ x, z, hx: 0.2, hz: 0.2, top: -2.1, base: -5.5 })),
  ),
  { x: 11.5, z: -5.7, hx: 0.6, hz: 0.8, top: -4.5, base: -5.5 },
  // the quiet cloud: pergola posts and two benches
  ...[-8, -2].flatMap((x) => [-24, -18].map((z) => ({ x, z, hx: 0.13, hz: 0.13, top: 13.1, base: 10 }))),
  ...[[-7.2, -18.8], [-2.8, -18.8]].map(([x, z]) => ({ x, z, hx: 0.85, hz: 0.32, top: 10.4, base: 10 })),
];

/**
 * Bring the sky in. One file, one position, nothing that moves. Static
 * geometry gets its world matrix frozen and picking turned off: the gopher's
 * collisions are our own arithmetic rather than ray casts.
 */
export async function buildWorld(scene) {
  const dimmed = new Map();
  const held = await container('cloud-world.glb?v=floors-2-edge-trim', scene);
  held.addAllToScene();

  const swimmers = createAquariumSwimmers(held);
  for (const mesh of held.meshes) {
    mesh.isPickable = false;
    mesh.receiveShadows = true;

    const mat = mesh.material;
    if (mat?.emissiveColor && BROAD_EMISSIVE.some((n) => mesh.name.startsWith(n))) {
      if (!dimmed.has(mat)) {
        const quiet = mat.clone(`${mat.name} (broad)`);
        quiet.emissiveColor = mat.emissiveColor.scale(BROAD_FACTOR);
        dimmed.set(mat, quiet);
      }
      mesh.material = dimmed.get(mat);
    }
    if (!swimmers.movingMeshes.has(mesh)) mesh.freezeWorldMatrix();
  }

  return { blockers: [...FURNITURE], animate: swimmers.animate };
}
