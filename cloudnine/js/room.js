/* =============================================================================
 * room.js — the building: four levels, where you may stand, and where machines go.
 *
 * ---------------------------------------------------------------------------
 * BLENDER -> BABYLON, once, here, and nowhere else
 * ---------------------------------------------------------------------------
 * The kit's `arcade-room.glb` is authored in Blender's Z-up metres. Two
 * conversions stack between that script and this scene, and getting either
 * backwards puts the CLOUD NINE sign behind you:
 *
 *   1. Blender -> glTF is a -90 degrees turn about X:  (x, y, z) -> (x, z, -y)
 *   2. glTF -> Babylon is what the loader's `__root__` does. It carries
 *      rotationQuaternion = Y 180 degrees AND scaling = (1, 1, -1), and the
 *      two together are a mirror in X:  (x, y, z) -> (-x, y, z)
 *
 * Composed:  babylon.x = -blender.x,  babylon.y = blender.z,  babylon.z = -blender.y
 *            babylon.rotation.y = -blender.rotation.z
 *
 * Everything the game added since is authored the other way round —
 * `source/build_world.py` writes GAME coordinates and converts on the way out —
 * so the numbers in this file and the numbers in that script are the same
 * numbers. Move one, move both.
 *
 * ---------------------------------------------------------------------------
 * THE WORLD IS A UNION OF BOXES
 * ---------------------------------------------------------------------------
 * There is no navmesh and no physics engine. Two lists describe the building:
 *
 *   VOLUMES    boxes you are allowed to be inside. You may stand anywhere in
 *              the union of them; the gaps between them ARE the walls. An
 *              archway is not a hole in a wall, it is a small box bridging two
 *              rooms — which is why openings need no special case anywhere.
 *
 *   PLATFORMS  rectangles at a height. The ground under you is the highest one
 *              at or below you, so a floor with a hole in it is just three or
 *              four rectangles that do not cover the hole, and falling through
 *              the skylight into the hall needs no code at all.
 *
 * Order matters in VOLUMES: the first box containing you wins, so the tight
 * connectors are listed before the rooms they join. Each carries the camera
 * distance that fits it, because a chase camera 5 m back does not belong in a
 * lift shaft.
 * ========================================================================== */

const ASSETS = '../assets/3d/';

/** Floor heights, so the numbers below read as levels rather than magic. */
export const LEVEL = { basement: -5, ground: 0, roof: 5.75, deck: 9 };

/**
 * Boxes you may occupy: [minX, maxX], [minZ, maxZ], [minY, maxY].
 * `cam` is the chase distance that suits the space; `mood` picks the lighting.
 * Connectors first — see the header.
 */
export const VOLUMES = [
  // -- connectors -----------------------------------------------------------
  { id: 'door', x: [-4.4, 4.4], z: [6.2, 7.7], y: [-0.2, 3.0], cam: 4.2, mood: 'hall', name: 'Main hall' },
  { id: 'pit', x: [4.2, 8.6], z: [-5.4, -1.0], y: [-5.2, 0.2], cam: 3.0, mood: 'mine', name: 'Lift shaft' },
  { id: 'skylight', x: [-3.2, 3.2], z: [-3.2, 3.2], y: [2.0, 6.4], cam: 3.4, mood: 'hall', name: 'Main hall' },
  { id: 'arch', x: [-9.5, -8.4], z: [-2.4, 2.4], y: [-0.2, 3.2], cam: 3.2, mood: 'water', name: 'The aquarium' },
  // -- rooms ----------------------------------------------------------------
  { id: 'basement', x: [-8.6, 8.6], z: [-6.6, 6.6], y: [-5.2, -0.4], cam: 5.0, mood: 'mine', name: 'Lower level' },
  { id: 'hall', x: [-8.5, 8.5], z: [-6.5, 6.5], y: [-0.2, 3.8], cam: 5.0, mood: 'hall', name: 'Main hall' },
  { id: 'wing', x: [-20.6, -9.2], z: [-5.6, 5.6], y: [-0.2, 3.8], cam: 5.0, mood: 'water', name: 'The aquarium' },
  // -- outdoors. `deck` is listed before `sky` so standing on the platform
  //    wins over hovering above the roof, and both are bounded to exactly what
  //    they have ground beneath: there is nowhere up here to fall out of the
  //    world, which is cheaper than catching it afterwards.
  { id: 'deck', x: [-8.0, 8.0], z: [-10.0, -1.0], y: [8.4, 18], cam: 6.5, mood: 'sky', name: 'Cloud deck' },
  { id: 'sky', x: [-9.0, 9.0], z: [-7.0, 7.0], y: [5.4, 18], cam: 6.5, mood: 'sky', name: 'Rooftop' },
];

/** Walkable rectangles. The highest one at or below you is the ground. */
export const PLATFORMS = [
  { x: [-9, 9], z: [-7, 7], y: LEVEL.basement },
  // The hall floor, as the four pieces around the lift pit.
  { x: [-9, 4.2], z: [-7, 7], y: LEVEL.ground },
  { x: [8.6, 9], z: [-7, 7], y: LEVEL.ground },
  { x: [4.2, 8.6], z: [-7, -5.4], y: LEVEL.ground },
  { x: [4.2, 8.6], z: [-1.0, 7], y: LEVEL.ground },
  { x: [-21, -8.89], z: [-6, 6], y: LEVEL.ground },
  { x: [-5, 5], z: [7, 7.9], y: LEVEL.ground }, // the step out onto the street
  // The roof, as the four pieces around the skylight.
  { x: [-9, -3], z: [-7, 7], y: LEVEL.roof },
  { x: [3, 9], z: [-7, 7], y: LEVEL.roof },
  { x: [-3, 3], z: [-7, -3], y: LEVEL.roof },
  { x: [-3, 3], z: [3, 7], y: LEVEL.roof },
  { x: [-8, 8], z: [-10, -1], y: LEVEL.deck },
];

/** The cage, its shaft, and how fast it runs. Matches build_world.py's LIFT. */
export const LIFT = {
  x: [5.5, 7.3],
  z: [-4.1, -2.3],
  top: LEVEL.ground,
  bottom: LEVEL.basement,
  speed: 2.1,
  /** How long you stand on it before it decides you meant it. */
  dwell: 0.65,
};

/** The street door, still the way out of the building entirely. */
export const DOOR = { halfX: 4.4, z: 6.5, exitZ: 7.5, warn: 5.7 };

/** Above this the camera has left the building and the roof is in its way. */
export const ROOF_HIDE_ABOVE = 5.35;

// ---------------------------------------------------------------------------
// Where the machines stand
// ---------------------------------------------------------------------------

/**
 * A game's room, by slug. Anything not named here goes in the hall, so a new
 * entry in games.json still gets a cabinet without touching this file.
 *
 * The grouping is the owner's: fishtank wanted a room you play together in,
 * swirls wanted somewhere calm, supermine wanted to be underground. dam_break
 * joins the water room and supermine_adventure joins its sibling because a
 * themed room with one machine in it is a shrine, not a room.
 */
export const PLACEMENT = {
  fishtank: 'wing',
  dam_break: 'wing',
  swirls: 'deck',
  supermine: 'basement',
  supermine_adventure: 'basement',
  maxgear: 'hall',
};

/**
 * Cabinet standings per room, best first. `yaw` is a Babylon Y rotation and a
 * cabinet's screen faces its local +Z. Beyond the slots listed, a game gets no
 * machine — these are floor plans, not a limit on the arcade.
 */
export const SLOTS = {
  hall: [
    { x: -2.7, z: -5.85, yaw: 0 },
    { x: 2.7, z: -5.85, yaw: 0 },
    { x: -5.8, z: -5.85, yaw: 0 },
    { x: -8.1, z: -3.1, yaw: Math.PI / 2 },
    { x: -8.1, z: 4.7, yaw: Math.PI / 2 },
    { x: 8.1, z: 4.7, yaw: -Math.PI / 2 },
  ],
  // Along the south wall facing the stools, not facing the tank: a machine
  // whose back is to the room is a machine nobody can watch you play.
  wing: [
    { x: -12.9, z: -5.35, yaw: 0 },
    { x: -15.6, z: -5.35, yaw: 0 },
    { x: -18.2, z: -5.35, yaw: 0 },
    { x: -15.6, z: 5.35, yaw: Math.PI },
  ],
  basement: [
    { x: -3.4, z: -5.9, yaw: 0 },
    { x: 3.4, z: -5.9, yaw: 0 },
    { x: -7.6, z: -2.0, yaw: Math.PI / 2 },
    { x: -7.6, z: 2.0, yaw: Math.PI / 2 },
  ],
  deck: [
    { x: 0, z: -8.6, yaw: 0 },
    { x: -4.6, z: -8.6, yaw: 0 },
    { x: 4.6, z: -8.6, yaw: 0 },
  ],
};

/** Where the gopher arrives, and where it lands if the world ever loses it. */
export const SPAWN = { x: 0, y: 0, z: 4.6, yaw: Math.PI };

// ---------------------------------------------------------------------------
// Lighting per space. Damped toward on every volume change.
// ---------------------------------------------------------------------------

/**
 * `air` is both the fog colour and what the camera sees past the geometry, so
 * it is the single thing that decides whether a space feels indoors. Getting
 * on the cloud deck has to feel like stepping outside, and no amount of light
 * does that while the background is still basement black.
 */
export const MOODS = {
  hall: {
    hemi: 0.55, hemiColor: [0.62, 0.72, 0.95], ground: [0.1, 0.14, 0.2],
    sun: 0.9, glow: 0.5, fog: 0.0, air: [0.02, 0.03, 0.05],
  },
  // Dark, warm, and lit mostly by its own ore. A mine that is evenly lit is a
  // basement.
  mine: {
    hemi: 0.30, hemiColor: [0.54, 0.44, 0.35], ground: [0.10, 0.08, 0.06],
    sun: 0.18, glow: 0.58, fog: 0.016, air: [0.030, 0.022, 0.016],
  },
  // The tank is the light source, so everything leans teal and comes up a bit.
  water: {
    hemi: 0.62, hemiColor: [0.36, 0.78, 0.82], ground: [0.06, 0.16, 0.18],
    sun: 0.5, glow: 0.44, fog: 0.012, air: [0.02, 0.08, 0.10],
  },
  // Bright, soft, almost shadowless. Nothing up here should feel urgent.
  sky: {
    hemi: 1.05, hemiColor: [0.88, 0.93, 1.0], ground: [0.62, 0.70, 0.86],
    sun: 1.2, glow: 0.34, fog: 0.008, air: [0.46, 0.62, 0.86],
  },
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const inRect = (v, x, z) => x >= v.x[0] && x <= v.x[1] && z >= v.z[0] && z <= v.z[1];

/** The first volume containing this point, or null if it is inside a wall. */
export function volumeAt(x, y, z) {
  for (const v of VOLUMES) {
    if (y >= v.y[0] && y <= v.y[1] && inRect(v, x, z)) return v;
  }
  return null;
}

export const insideWorld = (x, y, z) => volumeAt(x, y, z) !== null;

/**
 * The ground under a point: the highest platform at or below it, with a little
 * tolerance so standing exactly on a surface still finds it. `extra` carries
 * the lift's moving deck, which is a platform that is not in the list.
 *
 * Returns -Infinity when there is nothing below, which the caller treats as
 * "keep falling" — though the volumes are shaped so it should not happen.
 */
export function groundAt(x, z, y, extra = null) {
  let best = -Infinity;
  for (const p of PLATFORMS) {
    if (p.y <= y + 0.25 && p.y > best && inRect(p, x, z)) best = p.y;
  }
  if (extra && extra.y <= y + 0.25 && extra.y > best && inRect(LIFT, x, z)) best = extra.y;
  return best;
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
 * Per-kind footprints in cabinet-local metres, generous by a few centimetres so
 * the gopher never visually clips a bevel. Read straight off build_arcade.py:
 * the racer's seat runs 1.4 m out front, the dance kind's pad 1.8 m, and the
 * pad is only knee-high on a gopher so it is left hoppable on purpose.
 */
const FOOTPRINT = {
  classic: [{ x: 0, z: 0.11, hx: 0.6, hz: 0.62, top: 2.32 }],
  racer: [
    { x: 0, z: 0.11, hx: 0.6, hz: 0.62, top: 2.32 },
    { x: 0, z: 1.08, hx: 0.36, hz: 0.44, top: 0.95 },
  ],
  dance: [
    { x: 0, z: 0.11, hx: 0.6, hz: 0.62, top: 2.32 },
    { x: 0, z: 1.1, hx: 0.78, hz: 0.74, top: 0.3 },
  ],
  claw: [{ x: 0, z: 0.05, hx: 0.6, hz: 0.6, top: 2.4 }],
};

export const footprintOf = (kind) => FOOTPRINT[kind] || FOOTPRINT.classic;

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Meshes whose emissive has to come down hard.
 *
 * The kit authors its neon for Cycles, where a bright emission plus area
 * lights reads as a glass tube. Under a glow layer, any emissive surface
 * broader than a strip blooms into a flat white slab instead: a bench cushion
 * stops being upholstery and becomes a lightbox. The thin pieces — light
 * strips, floor seams, rails, ore veins — are exactly what the glow layer is
 * good at, so they are left alone.
 */
const BROAD_EMISSIVE = [
  'Bench cushion', 'Mat trim', 'Token header', 'Poster', 'Bunting', 'Sign arrow',
  'Tank water', 'Deck inlay', 'Stool seat', 'Cage lamp', 'Cart ore',
];
const BROAD_FACTOR = 0.2;

/**
 * Kit meshes the new building replaces. The hall's floor needed a hole for the
 * lift, its west wall an arch through to the wing, and its side light strips
 * would otherwise run straight across that arch. `hall-patch.glb` supplies all
 * three again in pieces. Matched on name, then on which side of the room the
 * mesh actually sits, because the kit has one strip mesh per side and only the
 * west ones are in the way.
 */
const REPLACED = (mesh, x) =>
  mesh.startsWith('Floor seam') ||
  mesh === 'Floor' ||
  ((mesh.startsWith('Right wall') || mesh.startsWith('Side light strip')) && x < -1);

/** Every file the building is made of. A missing one costs a room, not the game. */
const PARTS = [
  { file: 'arcade-room.glb', required: true },
  { file: 'arcade-props.glb' },
  { file: 'hall-patch.glb' },
  { file: 'level-basement.glb' },
  { file: 'wing-aquarium.glb' },
  { file: 'deck-cloud.glb' },
];

/** Load one GLB as a container we can stamp out repeatedly. */
export async function container(file, scene) {
  return BABYLON.SceneLoader.LoadAssetContainerAsync(ASSETS, file, scene);
}

/**
 * Blockers for everything built into the rooms, kept by hand in step with
 * `source/build_world.py` and `source/build_extras.py`. `base` is the floor the
 * blocker stands on, so a bench in the basement does not stop you on the roof.
 */
const FURNITURE = [
  // hall (from the kit and the props file)
  { x: -8, z: 5, hx: 0.48, hz: 0.87, top: 0.64 },
  { x: 8, z: 5, hx: 0.48, hz: 0.87, top: 0.64 },
  { x: -7.4, z: 6.1, hx: 0.54, hz: 0.44, top: 1.46 },
  { x: 6.6, z: 6.2, hx: 0.36, hz: 0.36, top: 1.15 },
  { x: -5.6, z: 6.2, hx: 0.36, hz: 0.36, top: 1.15 },
  { x: 4.9, z: 6.25, hx: 0.28, hz: 0.28, top: 0.7 },
  { x: 2.6, z: 5.4, hx: 0.42, hz: 0.3, top: 1.0 },
  // basement
  { x: 0, z: 4.1, hx: 0.62, hz: 0.82, top: -4.0, base: -5 }, // ore cart
  ...[-5.6, -1.4, 2.8].flatMap((x) =>
    [-3.4, 2.4].map((z) => ({ x, z, hx: 0.22, hz: 0.22, top: -1.2, base: -5 })),
  ),
  // wing
  { x: -20.0, z: 0, hx: 1.0, hz: 4.7, top: 4.2 }, // the tank
  ...[-3.3, -1.1, 1.1, 3.3].map((z) => ({ x: -13.2, z, hx: 0.3, hz: 0.3, top: 0.7 })),
  // deck
  ...[[-5.4, -7.4], [5.4, -7.4], [0, -2.4]].map(([x, z]) => ({
    x, z, hx: 1.05, hz: 0.4, top: 9.45, base: 9,
  })),
];

/**
 * Bring the building in. Static geometry gets its world matrix frozen and
 * picking turned off: nothing here moves except the lift, and the gopher's
 * collisions are our own arithmetic rather than ray casts.
 */
export async function buildWorld(scene) {
  const dimmed = new Map(); // source material -> its toned-down clone
  const loaded = new Set();

  for (const part of PARTS) {
    try {
      const held = await container(part.file, scene);
      held.addAllToScene();
      loaded.add(part.file);

      for (const mesh of held.meshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;

        // Absolute position has to be read before the matrix is frozen, and it
        // is the only way to tell the kit's two side-strip runs apart.
        const at = mesh.getAbsolutePosition();
        if (part.file === 'arcade-room.glb' && REPLACED(mesh.name, at.x)) {
          mesh.setEnabled(false);
          continue;
        }

        const mat = mesh.material;
        if (mat?.emissiveColor && BROAD_EMISSIVE.some((name) => mesh.name.startsWith(name))) {
          if (!dimmed.has(mat)) {
            const quiet = mat.clone(`${mat.name} (broad)`);
            quiet.emissiveColor = mat.emissiveColor.scale(BROAD_FACTOR);
            dimmed.set(mat, quiet);
          }
          mesh.material = dimmed.get(mat);
        }

        mesh.freezeWorldMatrix();
      }
    } catch (err) {
      if (part.required) throw new Error(`${part.file} failed to load: ${err.message}`);
      console.warn(`[cloudnine] no ${part.file}; that part of the building is missing`, err);
    }
  }

  // The lift is the one thing in the building that moves, so it stays unfrozen
  // and keeps its own root to slide up and down.
  let cage = null;
  try {
    const held = await container('lift-cage.glb', scene);
    const stamped = held.instantiateModelsToScene((n) => n, false);
    cage = new BABYLON.TransformNode('lift', scene);
    cage.position.set((LIFT.x[0] + LIFT.x[1]) / 2, LIFT.top, (LIFT.z[0] + LIFT.z[1]) / 2);
    for (const node of stamped.rootNodes) node.parent = cage;
    for (const mesh of cage.getChildMeshes()) {
      mesh.isPickable = false;
      mesh.receiveShadows = true;
    }
  } catch (err) {
    console.warn('[cloudnine] no lift cage; the mine is unreachable', err);
  }

  return {
    blockers: [...FURNITURE],
    cage,
    /**
     * The roof is its own file for exactly this reason. Fly high enough and the
     * camera ends up above it looking at its top face, which is opaque and
     * makes the room vanish — so the roof simply is not there while the camera
     * is outside it. You cannot see a ceiling you are standing on.
     */
    roofMeshes: scene.meshes.filter(
      (m) => m.name.startsWith('Roof ') || m.name.startsWith('Ceiling light') || m.name.startsWith('Skylight rim'),
    ),
    loaded,
  };
}
