/** Slow decorative gear trains; angle derives from elapsed time, never frame count.
 *
 * COST (PERFORMANCE.md, 2026-10-11): each rotor is already one mesh per
 * material (mergeUnder, below). What was left was turning them, and
 * recomputing their world matrices, from anywhere in the sky. They turn now
 * only while the train is in view and within FAR metres (moving.js); time is
 * the gears' own, so they pick up where they stopped. Nothing is allocated
 * per frame. */
import { mergeUnder } from './room.js';
import { FAR, watch } from './moving.js';

const ROTORS = new Map([
  ['Main flywheel', { teeth: 16, direction: 1 }],
  ['Companion cog', { teeth: 12, direction: -1 }],
  ['Perimeter gear 18', { teeth: 18, direction: 1 }],
  ['Perimeter gear 12', { teeth: 12, direction: -1 }],
  ['Perimeter gear 9', { teeth: 9, direction: 1 }],
]);

export function createGearAnimation(held) {
  const B = BABYLON;
  const movingMeshes = new Set();
  const rotors = held.transformNodes.flatMap((node) => {
    if (!node.name.startsWith('GearRotor ')) return [];
    const spec = ROTORS.get(node.name.slice('GearRotor '.length));
    if (!spec) return [];
    for (const child of [node, ...node.getDescendants(false)]) {
      if (child.unfreezeWorldMatrix) child.unfreezeWorldMatrix();
      movingMeshes.add(child);
    }
    // A rotor is a hub and a ring of separate teeth, each its own draw call;
    // fold them into one mesh per material that still turns with the rotor.
    for (const m of mergeUnder(node, `Gear ${spec.teeth}`)) movingMeshes.add(m);
    const rest = node.rotationQuaternion?.clone() || B.Quaternion.FromEulerVector(node.rotation);
    node.rotationQuaternion = rest.clone();
    return [{ node, ...spec, rest }];
  });

  // Every rotor's world box, joined and padded: a gear turning about its own
  // axle stays inside its box give or take its corners.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const { node } of rotors) {
    const { min, max } = node.getHierarchyBoundingVectors(true);
    [min.x, min.y, min.z].forEach((v, k) => { lo[k] = Math.min(lo[k], v - .5); });
    [max.x, max.y, max.z].forEach((v, k) => { hi[k] = Math.max(hi[k], v + .5); });
  }
  const seen = rotors.length ? watch(held.scene, lo, hi, { range: FAR }) : () => false;

  const turn = new B.Quaternion();
  let elapsed = 0;
  return {
    movingMeshes,
    animate(dt) {
      if (!seen()) return;
      elapsed += Math.max(0, Math.min(dt, .05));
      for (const { node, rest, teeth, direction } of rotors) {
        // Axles point along glTF local Z. The visible 18-tooth gear takes ~39s
        // per revolution, and its neighbours follow the corresponding ratios.
        const angle = (elapsed * .16 * 18 / teeth * direction) % (2 * Math.PI);
        B.Quaternion.RotationAxisToRef(B.Axis.Z, angle, turn);
        rest.multiplyToRef(turn, node.rotationQuaternion);
      }
    },
  };
}
