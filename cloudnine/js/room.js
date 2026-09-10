/* =============================================================================
 * room.js — the building: floor, walls, ceiling, benches, and where machines go.
 *
 * ---------------------------------------------------------------------------
 * BLENDER -> BABYLON, once, here, and nowhere else
 * ---------------------------------------------------------------------------
 * Every number in this file was read off assets/3d/source/build_arcade.py,
 * which authors the room in Blender's Z-up metres. Two conversions stack
 * between that script and this scene, and getting either backwards puts the
 * CLOUD NINE sign behind you:
 *
 *   1. Blender -> glTF is a -90 degrees turn about X:  (x, y, z) -> (x, z, -y)
 *   2. glTF -> Babylon is what the loader's `__root__` node does. It carries
 *      rotationQuaternion = Y 180 degrees AND scaling = (1, 1, -1), and the
 *      two together are a mirror in X:  (x, y, z) -> (-x, y, z)
 *
 * Composed, for anything we place ALONGSIDE the imported model:
 *
 *      babylon.x = -blender.x
 *      babylon.y =  blender.z        (height, unchanged)
 *      babylon.z = -blender.y
 *
 *      babylon.rotation.y = -blender.rotation.z      (a mirror flips yaw)
 *      babylon.rotation.x =  blender.rotation.x      (the mirror plane is
 *                                                     perpendicular to X, so
 *                                                     rotations about X survive)
 *
 * So in this scene: the back wall and its sign are at z = -7, the entrance is
 * the gap at z = +7, the floor's top face is y = 0, walls are 5.5 m, and a
 * cabinet with yaw 0 has its screen facing +Z. Anything hung off an imported
 * node's own children instead (we do not) would be in glTF space, not this one.
 * ========================================================================== */

const ASSETS = '../assets/3d/';

/**
 * Meshes whose emissive has to come down hard.
 *
 * The kit authors its neon for Cycles, where a bright emission plus area
 * lights reads as a glass tube. Under a glow layer, any emissive surface
 * broader than a strip blooms into a flat white slab instead: a bench cushion
 * stops being upholstery and becomes a lightbox, and the entrance mat becomes
 * a hole in the floor. The thin pieces — light strips, floor seams, runway
 * borders — are exactly what the glow layer is good at, so they are left alone.
 *
 * Matched by name prefix, and the dimmed material is shared per source
 * material so thirteen bunting flags of three colours cost three clones.
 */
const BROAD_EMISSIVE = ['Bench cushion', 'Mat trim', 'Token header', 'Poster', 'Bunting', 'Sign arrow'];
const BROAD_FACTOR = 0.2;

/** Room half-extents the gopher is kept inside; the walls sit a little beyond. */
export const FLOOR = {
  halfX: 8.5,
  halfZ: 6.5,
  /**
   * Flight ceiling. The room is 5.5 m tall, so this is not the roof: it is as
   * high as the gopher can go while the chase camera — which sits above and
   * behind — still has somewhere to be indoors. 3.6 m clears the 2.3 m
   * cabinets by a comfortable margin, which is all "flying over the machines"
   * actually needs.
   */
  ceiling: 3.6,
  /** Above this the camera has left the building; see hideRoofAbove. */
  wallTop: 5.4,
};

/**
 * The doorway. Blender puts entrance returns at x = ±7 spanning 4 m each, so
 * the actual opening in the front wall runs to x = ±5; half of 4.4 keeps the
 * gopher's 0.32 m radius clear of the returns while still matching what the
 * player can see. Narrower than the visible gap would read as an invisible
 * wall across half a doorway.
 */
export const DOOR = { halfX: 4.4, z: FLOOR.halfZ, exitZ: 7.5 };

/**
 * Cabinet standings, best seats first: what you see from the door is the back
 * wall, so the first games in games.json get it. Beyond twelve, games queue up
 * without a machine — the list is a floor plan, not a limit on the arcade.
 *
 * `yaw` is a Babylon Y rotation, and a cabinet's screen faces its local +Z.
 */
export const SLOTS = [
  { x: -2.7, z: -5.85, yaw: 0 },
  { x: 2.7, z: -5.85, yaw: 0 },
  { x: -5.8, z: -5.85, yaw: 0 },
  { x: 5.8, z: -5.85, yaw: 0 },
  { x: -8.1, z: -3.1, yaw: Math.PI / 2 },
  { x: 8.1, z: -3.1, yaw: -Math.PI / 2 },
  { x: -8.1, z: -0.5, yaw: Math.PI / 2 },
  { x: 8.1, z: -0.5, yaw: -Math.PI / 2 },
  { x: -8.1, z: 2.1, yaw: Math.PI / 2 },
  { x: 8.1, z: 2.1, yaw: -Math.PI / 2 },
  { x: -8.1, z: 4.7, yaw: Math.PI / 2 },
  { x: 8.1, z: 4.7, yaw: -Math.PI / 2 },
];

/**
 * Fixed furniture the gopher bumps into, in this scene's coordinates, each
 * with the height you can hop or fly over. Benches are Blender (±8, -5) with a
 * 0.92 x 1.7 cushion on top of a 0.85 x 1.6 base -> here (∓8, +5).
 */
const FURNITURE = [
  { x: -8, z: 5, hx: 0.48, hz: 0.87, top: 0.64 },
  { x: 8, z: 5, hx: 0.48, hz: 0.87, top: 0.64 },
];

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
  };
}

export const footprintOf = (kind) => FOOTPRINT[kind] || FOOTPRINT.classic;

/** Load one GLB as a container we can stamp out repeatedly. */
export async function container(file, scene) {
  return BABYLON.SceneLoader.LoadAssetContainerAsync(ASSETS, file, scene);
}

/**
 * Bring in the room, the ceiling, and whatever set dressing exists. Props are
 * optional by design: a missing arcade-props.glb costs the room a plant, not
 * the arcade. Static geometry gets its world matrix frozen and picking turned
 * off — nothing here moves, and the gopher's collisions are our own arithmetic
 * rather than ray casts.
 */
export async function buildRoom(scene, shadows) {
  const blockers = [...FURNITURE];
  const loaded = [];
  const dimmed = new Map(); // source material -> its toned-down clone

  for (const file of ['arcade-room.glb', 'arcade-ceiling.glb', 'arcade-props.glb']) {
    try {
      const held = await container(file, scene);
      held.addAllToScene();
      loaded.push(file);
      for (const mesh of held.meshes) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;

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
      // The props file is ours and may simply not have been built yet.
      if (file === 'arcade-props.glb') console.info('[cloudnine] no props file; bare room');
      else console.error(`[cloudnine] ${file} failed to load`, err);
    }
  }

  if (!loaded.includes('arcade-room.glb')) throw new Error('the room itself failed to load');

  // Props are one baked GLB placed at the room origin, so their blockers are
  // written here rather than derived from the mesh — and they have to be kept
  // in step with source/build_extras.py by hand. Only the four solid pieces
  // get one: the mat, the posters and the bunting are flat or out of reach.
  if (loaded.includes('arcade-props.glb')) {
    blockers.push(
      { x: -7.4, z: 6.1, hx: 0.54, hz: 0.44, top: 1.46 }, // token machine
      { x: 6.6, z: 6.2, hx: 0.36, hz: 0.36, top: 1.15 }, // planter
      { x: -5.6, z: 6.2, hx: 0.36, hz: 0.36, top: 1.15 }, // planter
      { x: 4.9, z: 6.25, hx: 0.28, hz: 0.28, top: 0.7 }, // bin
      { x: 2.6, z: 5.4, hx: 0.42, hz: 0.3, top: 1.0 }, // "THIS WAY" sign
    );
  }

  // The floor is the only shadow receiver worth paying for; the rest of the
  // room is vertical and the gopher never casts onto it convincingly anyway.
  const floor = scene.getMeshByName('Floor');
  if (floor && shadows) floor.receiveShadows = true;

  return {
    blockers,
    hasProps: loaded.includes('arcade-props.glb'),
    /**
     * The ceiling is a separate asset for exactly this reason. Drag the camera
     * far enough up and it ends up above the roof looking at the roof's top
     * face, which is opaque and makes the room vanish. Rather than fight the
     * orbit rig, the roof simply is not there while the camera is outside it —
     * you cannot see a ceiling you are standing on.
     */
    roof: scene.getTransformNodeByName('Removable_ceiling') || null,
  };
}
