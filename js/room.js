import { createAquariumSwimmers } from './aquarium.js';
import { createGearAnimation } from './gears.js';
import { createIslandSwirls } from './swirls.js';
import { createNeonFoxFloor } from './neonfox.js';

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
  { id: 'neonfox', name: 'The neon arena', x: [-25, -13], z: [-24, -12], y: 2 },
  { id: 'lobbots', name: 'The proving ground', x: [-25, -13], z: [12, 24], y: .5 },
  { id: 'welcome', name: 'The welcome cloud', x: [-6, 6], z: [-5, 5], y: 0 },
  { id: 'water', name: 'The aquarium', x: [-6.5, 6.5], z: [-24, -14], y: -2.5 },
  { id: 'race', name: 'The gyro hangar', x: [-23.5, -14.5], z: [-4, 4], y: 1.5 },
  { id: 'mine', name: 'The outcrop', x: [12, 28], z: [-6, 6], y: -5.5 },
  { id: 'adventure', name: 'The mining company', x: [14, 26], z: [12, 24], y: -5.5 },
  { id: 'mine_bridge', name: 'The miners’ bridge', x: [20.8, 23.2], z: [6, 12], y: -5.5 },
  { id: 'dam', name: 'The reservoir', x: [12.5, 23.5], z: [-23.5, -12.5], y: 1 },
  { id: 'calm', name: 'The quiet cloud', x: [-4.5, 4.5], z: [13.5, 22.5], y: 6 },
];

/**
 * How far you may go. One box, generous enough that flying feels open and
 * bounded so you cannot leave the world — and shallow enough at the bottom
 * that "down" is somewhere you come back from rather than somewhere you fall
 * out of.
 */
export const SKY = { x: [-36, 36], z: [-34, 34], y: [-20, 28] };

/** Where the gopher arrives, and where the world puts it back if it must. */
export const SPAWN = { x: 0, y: 0, z: 2.6, yaw: Math.PI };

/** Masts carrying each platform's name board; matches build_clouds.py. */
export const BEACONS = {
  lobbots: { x: -24.5, y: .5, z: 18, top: 5.2 },
  neonfox: { x: -24.5, y: 2, z: -18, top: 5.4 },
  dam: { x: 23, y: 1, z: -18, top: 5.0 },
  water: { x: 0, y: -2.5, z: -23.5, top: 5.4 },
  race: { x: -23, y: 1.5, z: 0, top: 5.0 },
  adventure: { x: 25.5, y: -5.5, z: 18, top: 5.2 },
  mine: { x: 27.5, y: -5.5, z: 0, top: 5.2 },
  calm: { x: 0, y: 6, z: 22.0, top: 4.6 },
};

/**
 * A game's platform, by slug. Anything not named here takes the first free
 * standing anywhere, so a new entry in games.json still gets a machine. The
 * welcome cloud has no standings on purpose: it is where you get your
 * bearings, and a machine on it would be the one everybody played.
 */
export const PLACEMENT = {
  lobbots: 'lobbots',
  neonfox: 'neonfox',
  maxgear: 'race',
  fishtank: 'water',
  dam_break: 'dam',
  supermine: 'mine',
  supermine_adventure: 'adventure',
  swirls: 'calm',
};

/**
 * Screens face local +Z. Most cabinets face the welcome cloud; where scenery
 * defines a walking lane, face back along that lane instead.
 */
const facingHub = (x, z) => Math.atan2(-x, -z);
const stand = (x, z) => ({ x, z, yaw: facingHub(x, z) });

export const SLOTS = {
  lobbots: [{ x: -22, z: 18, yaw: Math.PI / 2 }],
  neonfox: [{ x: -22, z: -18, yaw: Math.PI / 2 }],
  // Enter from the southwest, pass the reservoir on the right, then play.
  dam: [{ x: 15, z: -20.3, yaw: 0 }],
  water: [stand(4.0, -21.0), stand(4.0, -17.0)],
  race: [stand(-21.2, -2.4)],
  mine: [stand(24.0, 0.0)],
  // Arrive via the bridge, pass the assay office and minerals, then play.
  adventure: [{ x: 22, z: 20.5, yaw: Math.PI }],
  // Walk through the pergola and across the floor inlay to reach Swirls.
  calm: [stand(0.0, 20.0)],
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
  double: [{ x: 0, z: .11, hx: 1.2, hz: .62, top: 2.32 }],
  classic: [{ x: 0, z: 0.11, hx: 0.6, hz: 0.62, top: 2.32 }],
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

/**
 * Merge static meshes that share a material, cell by cell.
 *
 * WHY. The sky was 3,400 meshes and 2,500 draw calls a frame, most of them
 * cubes of a hundred-odd triangles — and the glow layer draws every one a
 * second time. On an old tablet that is the whole frame spent in the CPU
 * telling the GPU about cubes; fewer pixels (quality.js) cannot touch it.
 * Measured 2026-10-02 in headless Chrome. One draw call per material per
 * CELL-metre square instead keeps the count in the low hundreds while still
 * letting the camera cull whole islands it is not looking at, which merging
 * the entire sky per material would throw away.
 *
 * WHAT STAYS OUT. Anything a later line finds by name or by reference, or
 * that moves: pass those in `keep`. Anything with children (disposing it would
 * take them along), instances or instanced, skinned or morphing, disabled or
 * invisible. A group whose meshes do not share the same vertex attributes is
 * split by attributes, because MergeMeshes will not join a mesh with UVs to
 * one without. If a merge fails anyway the originals are left exactly as they
 * were — a slower sky, never a missing one.
 *
 * Returns the merged meshes, for the caller to set shadows and freeze.
 */
export function mergeStatic(meshes, { keep = () => false, cell = 12, label = 'Merged' } = {}) {
  const groups = new Map();
  for (const m of meshes) {
    if (m.getClassName() !== 'Mesh' || m.isDisposed() || keep(m)) continue;
    if (!m.isEnabled() || !m.isVisible || m.visibility !== 1 || !m.material) continue;
    if (!m.getTotalVertices() || m.skeleton || m.morphTargetManager) continue;
    if (m.getChildren().length || m.instances?.length || m.billboardMode) continue;
    // A mesh a glow layer was told to skip (a sign face, a marquee) would
    // lose that exclusion inside a merged mesh and bloom white.
    if (m.getScene().effectLayers?.some((l) => l._excludedMeshes?.includes(m.uniqueId))) continue;
    m.computeWorldMatrix(true);
    const c = m.getBoundingInfo().boundingBox.centerWorld;
    const kinds = m.getVerticesDataKinds().slice().sort().join(',');
    const key = `${m.material.uniqueId}|${kinds}|${m.receiveShadows}|${m.renderingGroupId}|${m.layerMask}|` +
      `${Math.floor(c.x / cell)},${Math.floor(c.z / cell)},${Math.floor(c.y / cell)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const merged = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const { material, receiveShadows } = group[0];
    try {
      const one = BABYLON.Mesh.MergeMeshes(group, true, true);
      if (!one) continue;
      one.name = `${label}: ${material.name}`;
      one.material = material;
      one.isPickable = false;
      one.receiveShadows = receiveShadows;
      merged.push(one);
    } catch (error) {
      console.warn(`[arcade] could not merge ${group.length} × ${material.name}; left as they were`, error);
    }
  }
  return merged;
}

/**
 * The same, for a part that MOVES: everything under `node` folded into one
 * mesh per material and put back under `node`, so the gear still turns and
 * the flap still swings — as one draw call instead of a dozen teeth.
 */
export function mergeUnder(node, label) {
  node.computeWorldMatrix(true);
  const merged = mergeStatic(node.getChildMeshes(false), { cell: 1e6, label });
  for (const m of merged) m.setParent(node);
  return merged;
}

/** True if the node or any ancestor's name matches `pattern`. */
function hasAncestorNamed(node, pattern) {
  for (let n = node; n; n = n.parent) if (pattern.test(n.name)) return true;
  return false;
}

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
  // The proving ground, in step with lobbots_island.py. Everything stands
  // along the rear and the two west corners, so the east and north
  // approaches, the landing pad and the cabinet lane stay open. The walkers
  // face north with their guns on the east side, hence the +.1 in x.
  ...[-18.5, -15.5].map((x) =>
    ({ x: x + .1, z: 21.6, hx: .9, hz: 1.5, top: 3.6, base: .5 })),
  { x: -24.5, z: 18, hx: .16, hz: .16, top: 5.7, base: .5 },        // name-board mast
  { x: -19, z: 23.5, hx: 6, hz: .48, top: 2.75, base: .5 },          // the berm
  { x: -23.6, z: 21.75, hx: .75, hz: 1.32, top: 1.85, base: .5 },    // nuke on its cradle
  { x: -24.25, z: 13.4, hx: .4, hz: 1.05, top: 1.7, base: .5 },      // shell rack
  { x: -13.85, z: 21.38, hx: .45, hz: .75, top: 1.85, base: .5 },    // ammo crates
  { x: -20.9, z: 21.9, hx: .85, hz: 1.5, top: 1.4, base: .5 },       // the cooked-off wreck
  { x: -13.55, z: 12.55, hx: .1, hz: .1, top: 3.3, base: .5 },       // wind sock
  // Gyro-wedge landing display and its rear diagnostics console.
  { x: -18, z: 1.05, hx: 1.6, hz: 1.6, top: 3.05, base: 1.5 },
  { x: -20.15, z: 2.48, hx: .42, hz: .31, top: 2.85, base: 1.5 },
  // Mining-company office, mineral beds and cargo; central route stays clear.
  { x: 17, z: 18.5, hx: 2.25, hz: 2.3, top: -1, base: -5.5 },
  ...[[24, 15.4], [24, 18.3], [16, 14]].map(([x, z]) =>
    ({ x, z, hx: .85, hz: .85, top: -3.8, base: -5.5, island: 'adventure' })),
  { x: 16.5, z: 21.4, hx: 1, hz: .5, top: -4.7, base: -5.5 },
  // Continuous bridge rails protect the sides, with both ends open.
  ...[20.85, 23.15].map((x) =>
    ({ x, z: 9, hx: .105, hz: 3.1, top: -4.25, base: -5.5 })),
  // Miniature dam and reservoir, east of the western walking lane.
  { x: 20, z: -19.7, hx: 3.3, hz: 3.2, top: 3.45, base: 1, island: 'dam' },
  // Steamworks plant stays at the west/south perimeter, clear of cabinet fronts.
  { x: -22, z: 2, hx: 0.8, hz: 0.75, top: 4.91, base: 1.5 },
  { x: -21.75, z: .72, hx: .55, hz: .4, top: 3, base: 1.5 },
  { x: -18.35, z: 3.48, hx: 2.15, hz: .3, top: 3.6, base: 1.5 },
  // welcome cloud: two benches and the side welcome board. The signpost's
  // blocker went with the signpost — the islands ring the hub now, so there is
  // nothing left to point at.
  { x: -4.6, z: -1.0, hx: 0.4, hz: 1.05, top: 0.46 },
  { x: 4.6, z: -.385, hx: 0.4, hz: 1.05, top: 0.46 },
  { x: 4.95, z: -3.25, hx: 0.22, hz: 1.28, top: 3.1 },
  // the aquarium: the tank, and the stools you watch from
  { x: -3.6, z: -19, hx: 1.1, hz: 3.8, top: 1.3, base: -2.5 },
  ...[-21.7, -19.9, -18.1, -16.3].map((z) => ({ x: 1.4, z, hx: 0.3, hz: 0.3, top: -1.8, base: -2.5 })),
  // Rig parked along the north edge; central entrance-to-cabinet lane stays open.
  { x: 18, z: -3.7, hx: 2.6, hz: 1.95, top: -2.7, base: -5.5, island: 'supermine' },
  { x: 14.85, z: -3.7, hx: .75, hz: 1.95, top: -4.25, base: -5.5, island: 'supermine' },
  { x: 13.85, z: -3.6, hx: .5, hz: 1.95, top: -4.3, base: -5.5, island: 'supermine' },
  ...[[22, -4.5], [25.7, 3.6], [18, 4.65]].map(([x, z]) =>
    ({ x, z, hx: 1.15, hz: 1, top: -3.7, base: -5.5, island: 'supermine' })),
  { x: 14.2, z: 4.2, hx: .65, hz: .68, top: -4.4, base: -5.5, island: 'supermine' },
  ...[[13.2, -.9], [20, -4.7]].map(([x, z]) =>
    ({ x, z, hx: .25, hz: .25, top: -2.8, base: -5.5, island: 'supermine' })),
  // the quiet cloud: pergola posts and two benches
  ...[-3, 3].flatMap((x) => [15, 21].map((z) => ({ x, z, hx: 0.13, hz: 0.13, top: 9.1, base: 6 }))),
  ...[[-2.2, 20.2], [2.2, 20.2]].map(([x, z]) => ({ x, z, hx: 0.85, hz: 0.32, top: 6.4, base: 6 })),
];

/**
 * Islands that ship as models of their own rather than inside cloud-world.
 *
 * WHY SEPARATE FILES. cloud-world.glb is 19 MB; rebuilding it to change one
 * island makes every visitor download all of it again, and risks moving
 * islands nobody asked to touch. An island here is its own small GLB with its
 * own ?v= (the worker's runtime cache keys on it, and sw.js preloads every
 * file listed here — tools/check-registry.mjs holds the two in step).
 *
 * `replaces` names the cloud-world meshes the new model stands in for, by
 * prefix; they are switched off before mergeStatic, which skips anything
 * disabled. `blockers` are the new model's solid props, and FURNITURE entries
 * tagged with the same `island` are the old props' — swapped together, and
 * ONLY when the new file actually arrived. A failed download keeps the old
 * island and the old blockers: it costs a nicer look, never a platform.
 * The old geometry is still inside cloud-world.glb until the next time that
 * file is rebuilt anyway; polish_environment.py says which scripts to drop.
 */
export const ISLAND_MODELS = [
  { id: 'lobbots', file: 'lobbots-island.glb?v=3', replaces: [], blockers: [] },
  {
    // A slice cut from a Dam Break level: banded terrain, the reservoir in the
    // game's depth bands, a player-built crib dam about to fail, the house it
    // is protecting. dam_island_v2.py. Prefixes checked against every node in
    // cloud-world — a bare 'Dam ' would also take the floor and the mast.
    id: 'dam',
    file: 'dam-island.glb?v=1',
    replaces: ['Dam wall segment', 'Dam crown ', 'Dam handrail post', 'Dam stepped buttress',
      'Dam diorama foundation', 'Dam control hut', 'Control hut ', 'Reservoir ', 'Spillway gate',
      'Gate ', 'Downstream ', 'Stilling block', 'Channel side'],
    blockers: [
      { x: 19.775, z: -19.875, hx: 2.5, hz: 3.375, top: 3.45, base: 1 },  // ridge, reservoir, dam
      { x: 19.775, z: -15.325, hx: 2.5, hz: 1.175, top: 1.6, base: 1 },   // floodplain, stockpile
      { x: 17.6, z: -16.72, hx: .06, hz: .24, top: 2.23, base: 1 },       // signpost
      { x: 17.95, z: -15.88, hx: .31, hz: .31, top: 2.77, base: 1 },      // pine
      { x: 21.45, z: -15.31, hx: .33, hz: .33, top: 2.27, base: 1 },      // round tree
      { x: 19.55, z: -15.22, hx: .68, hz: .63, top: 2.35, base: 1 },      // house
      { x: 21.4, z: -14.62, hx: .28, hz: .28, top: 2.57, base: 1 },       // pine
      { x: 18.55, z: -14.5, hx: .31, hz: .31, top: 2.19, base: 1 },       // round tree
      { x: 17.6, z: -14.92, hx: .25, hz: .25, top: 2.42, base: 1 },       // pine
    ],
  },
  {
    // The mining company's claim: six of the game's own minerals on plinths,
    // a strata face studded with deposits, and the game's auger rig parked
    // east of the lane. adventure_island_v2.py. The assay office, its crates
    // and the miners' bridge stay in cloud-world and keep their blockers.
    id: 'adventure',
    file: 'adventure-island.glb?v=1',
    replaces: ['Adventure specimen', 'Adventure mineral', 'Adventure AMETHYST', 'Adventure COPPER ORE',
      'Adventure QUARTZ'],
    blockers: [
      { x: 14.5, z: 14.25, hx: .5, hz: 1.95, top: -3.95, base: -5.5 },   // strata face
      { x: 17.47, z: 14.0, hx: 2.52, hz: .3, top: -4.0, base: -5.5 },    // specimen row
      { x: 24.75, z: 14.53, hx: 1.02, hz: 2.13, top: -4.2, base: -5.5 }, // the rig
    ],
  },
  {
    // The outcrop: the game's own rig with ten of its upgrades fitted, an ore
    // bank of the game's minerals in their baked sprite outlines, and a skip
    // per ore. supermine_island_v2.py. 'Supermine ' (with the space) is every
    // old prop and nothing else; floor, mast and bridge are all 'Mine …'.
    id: 'supermine',
    file: 'supermine-island.glb?v=1',
    replaces: ['Supermine '],
    blockers: [
      { x: 17.03, z: -3.30, hx: 3.17, hz: 1.65, top: -3.45, base: -5.5 },  // rig hull, hopper, conveyor, drills
      { x: 18.10, z: -3.30, hx: 1.25, hz: 2.72, top: -4.55, base: -5.5 },  // blade drum, side grinders
      { x: 16.02, z: -3.30, hx: 0.58, hz: 2.65, top: -4.05, base: -5.5 },  // magnet arms
      { x: 23.45, z: -3.85, hx: 3.15, hz: 2.10, top: -4.48, base: -5.5 },  // the ore bank
      { x: 16.65, z: 4.75, hx: 3.77, hz: 0.44, top: -4.60, base: -5.5 },   // six ore skips
    ],
  },
  {
    // The neon arena's rim, corner pylons and scoreboard (neonfox_island_v2.py),
    // and the "NF Rider" template that neonfox.js clones into three foxes
    // riding the floor's lines. Nothing to replace: the old island was floor.
    id: 'neonfox',
    file: 'neonfox-island.glb?v=1',
    replaces: [],
    dynamic: /^NF Rider/,
    blockers: [
      // Rim walls, leaving a 3 m gap on the north and east edges.
      { x: -22.725, z: -12.15, hx: 2.225, hz: .1, top: 2.225, base: 2 },
      { x: -15.275, z: -12.15, hx: 2.225, hz: .1, top: 2.225, base: 2 },
      { x: -19.0, z: -23.85, hx: 5.95, hz: .1, top: 2.225, base: 2 },
      { x: -24.85, z: -18.0, hx: .1, hz: 5.75, top: 2.225, base: 2 },
      { x: -13.15, z: -21.625, hx: .1, hz: 2.125, top: 2.225, base: 2 },
      { x: -13.15, z: -14.375, hx: .1, hz: 2.125, top: 2.225, base: 2 },
      // Gate posts at the gaps' ends.
      ...[[-20.62, -12.15], [-17.38, -12.15], [-13.15, -19.62], [-13.15, -16.38]].map(([x, z]) =>
        ({ x, z, hx: .12, hz: .12, top: 2.35, base: 2 })),
      // Corner pylons and the scoreboard.
      ...[[-24.6, -23.6], [-13.4, -23.6], [-24.6, -12.4], [-13.4, -12.4]].map(([x, z]) =>
        ({ x, z, hx: .15, hz: .15, top: 4.895, base: 2 })),
      { x: -24.0, z: -13.2, hx: .368, hz: .46, top: 4.885, base: 2 },
    ],
  },
];

/**
 * Bring the sky in. One file, one position, nothing that moves. Static
 * geometry gets its world matrix frozen and picking turned off: the gopher's
 * collisions are our own arithmetic rather than ray casts.
 */
export async function buildWorld(scene) {
  const dimmed = new Map();
  const islandMeshes = [];
  const dynamicMeshes = new Set();
  const held = await container('cloud-world.glb?v=centered-welcome-bench-3', scene);
  held.addAllToScene();

  // The islands that are models of their own (ISLAND_MODELS), fetched side by
  // side. Each one that arrives switches off what it replaces in cloud-world.
  const loaded = new Set();
  await Promise.all(ISLAND_MODELS.map(async (island) => {
    try {
      const model = await container(island.file, scene);
      model.addAllToScene();
      islandMeshes.push(...model.meshes);
      for (const mesh of model.meshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        // `dynamic` names what the runtime moves (the NeonFox riders): not
        // frozen in place, and kept out of mergeStatic below.
        if (island.dynamic && hasAncestorNamed(mesh, island.dynamic)) { dynamicMeshes.add(mesh); continue; }
        mesh.freezeWorldMatrix();
      }
      loaded.add(island.id);
    } catch (error) {
      console.warn(`[arcade] assets/3d/${island.file} unavailable; keeping what cloud-world has`, error);
    }
  }));
  // Disposed rather than switched off: a disabled mesh still costs memory
  // and still sits in the list the engine walks every frame, and three old
  // islands are several hundred of them. Dropped from the container's list
  // too, so nothing below ever touches a disposed mesh.
  const replaced = ISLAND_MODELS.filter((island) => loaded.has(island.id) && island.replaces.length);
  if (replaced.length) {
    // Over a COPY: disposing a mesh takes it out of held.meshes as well, so
    // walking the live array skipped every second one — half of each old
    // island survived, standing inside the new one (found 2026-10-02).
    for (const mesh of [...held.meshes]) {
      if (replaced.some((island) => island.replaces.some((prefix) => mesh.name.startsWith(prefix)))) mesh.dispose();
    }
    held.meshes = held.meshes.filter((mesh) => !mesh.isDisposed());
  }
  // Lobbots has no old island underneath, so a failed download would leave
  // nothing to stand on visibly: give it a plain deck instead.
  if (!loaded.has('lobbots')) {
    const deck = BABYLON.MeshBuilder.CreateBox('Lobbots fallback deck',
      { width: 12, height: .5, depth: 12 }, scene);
    deck.position.set(-19, .25, 18);
    deck.isPickable = false;
    const mat = new BABYLON.StandardMaterial('Lobbots fallback steel', scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString('#555b62');
    deck.material = mat;
    deck.freezeWorldMatrix();
  }

  // The base sky predates the southwest island. Clear decorative clouds by
  // their full bounds, not their centres: Drifting cloud.007 reaches into the
  // sign even though its centre sits outside the deck. Keep this at load time
  // too so an older cached cloud-world.glb cannot obscure a newly added island.
  const provingGround = PLATFORMS.find((p) => p.id === 'lobbots');
  for (const mesh of held.meshes) {
    if (!/^(Near cloud|Drifting cloud)/.test(mesh.name)) continue;
    mesh.computeWorldMatrix(true);
    const { minimumWorld: lo, maximumWorld: hi } = mesh.getBoundingInfo().boundingBox;
    if (hi.x > provingGround.x[0] - 3 && lo.x < provingGround.x[1] + 3 &&
        hi.z > provingGround.z[0] - 3 && lo.z < provingGround.z[1] + 3 &&
        hi.y > provingGround.y - 2 && lo.y < provingGround.y + 9) {
      mesh.setEnabled(false);
    }
  }

  const swimmers = createAquariumSwimmers(held);
  const gears = createGearAnimation(held);
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
    if (!swimmers.movingMeshes.has(mesh) && !gears.movingMeshes.has(mesh)) mesh.freezeWorldMatrix();
  }

  // Now that every material is final, fold the static sky into a few hundred
  // meshes (see mergeStatic). The sideboard lettering stays loose because
  // signs.js finds it by name and switches it off; the fish and gears because
  // they move; anything an animation group drives for the same reason.
  const animated = new Set();
  for (const group of held.animationGroups) {
    for (const t of group.targetedAnimations) {
      const target = t.target;
      if (target?.getChildMeshes) { animated.add(target); for (const c of target.getChildMeshes()) animated.add(c); }
    }
  }
  const keep = (m) => dynamicMeshes.has(m) || swimmers.movingMeshes.has(m) || gears.movingMeshes.has(m) || animated.has(m) ||
    /^Welcome sideboard (Brand|Arcade|Guide)/.test(m.name);
  const worldMeshes = [...held.meshes, ...islandMeshes];
  for (const one of mergeStatic(worldMeshes, { keep, label: 'Sky' })) one.freezeWorldMatrix();

  const swirls = createIslandSwirls(scene, PLATFORMS.find((p) => p.id === 'calm'));
  const neonfox = createNeonFoxFloor(scene, PLATFORMS.find((p) => p.id === 'neonfox'));
  // Old props' blockers go with the old props; the new model's come in.
  const swapped = ISLAND_MODELS.filter((island) => loaded.has(island.id));
  const swappedIds = new Set(swapped.map((island) => island.id));
  return {
    blockers: [
      ...FURNITURE.filter((b) => !swappedIds.has(b.island)),
      ...swapped.flatMap((island) => island.blockers),
      // Live: the riders move these every frame (neonfox.js).
      ...neonfox.blockers,
    ],
    animate(dt) { swimmers.animate(dt); gears.animate(dt); swirls.animate(dt); neonfox.animate(dt); },
  };
}
