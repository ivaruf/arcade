/** Peaceful display fish. No feeding, hunting, growth or game simulation.
 *
 * COST (PERFORMANCE.md, 2026-10-11). Each fish arrived as a dozen or so flat-
 * coloured primitives (body, eyes, stripes, fins), each its own draw call:
 * about eighty for six fish, all unfrozen because they swim. The parts that
 * move together are now one mesh each (moving.js foldRigid): the body with
 * every fin that does not flap, and each flapping pivot (Tail, PectoralPivot)
 * with what hangs from it, folded under that same pivot so its rest pose and
 * its hinge are untouched (ENVIRONMENT.md: animated nodes keep a local pivot).
 * All fish share one white material and carry their colours in their
 * vertices, which is how the rest of the sky is shaded anyway. The school
 * swims only while the tank is in view and within FAR metres, and nothing is
 * allocated per frame.
 */
import { FAR, foldRigid, watch, whiteCopy } from './moving.js';

const TAU = Math.PI * 2;
const FISH = /^Fishtank (clownfish|blue-tang|angelfish|royal-gramma) \d+$/;
const FLAPS = /^(Tail|PectoralPivot)(\.\d+)?$/;

/** Coordinates are relative to the imported Cloud_world node (glTF Y-up).
 * The tank spans local x 19.64..21.56, z -8.6..-1.4. Paths leave room
 * for the full fish body at the tightest part of each turn.
 * `out` is written and returned, so the per-frame caller allocates nothing;
 * leave it off for a fresh object. */
export function swimPose(home, index, seconds, out = {}) {
  const rate = TAU / (22 + index * 2.5);
  const phase = seconds * rate + index * 2.399;
  const radius = Math.max(0.1, Math.min(0.85, home.z + 8.6 - 0.65, -1.4 - home.z - 0.65));
  const dx = 0.12 * Math.cos(phase);
  const dz = -radius * Math.sin(phase);
  out.x = home.x + 0.12 * Math.sin(phase);
  out.y = home.y + 0.025 * Math.sin(phase * 2);
  out.z = home.z + radius * Math.cos(phase);
  // Imported Fishtank fish face local +Z. Follow the path's tangent.
  out.yaw = Math.atan2(dx, dz);
  out.pitch = Math.max(-0.10, Math.min(0.10, -Math.atan2(0.05 * Math.cos(phase * 2), Math.hypot(dx, dz))));
  out.fin = Math.sin(seconds * 3.2 + index * 1.7) * 0.12;
  return out;
}

export function createAquariumSwimmers(held) {
  const B = BABYLON;
  const scene = held.scene;
  const movingMeshes = new Set();
  let paint = null;   // the school's one white material, made from the first fish
  const fish = [...held.transformNodes, ...held.meshes]
    .filter((node) => FISH.test(node.name))
    .map((node) => {
      const descendants = node.getDescendants(false);
      for (const child of [node, ...descendants]) {
        if (child.unfreezeWorldMatrix) child.unfreezeWorldMatrix();
        movingMeshes.add(child);
      }
      const fins = descendants
        .filter((child) => FLAPS.test(child.name))
        .map((child) => ({
          node: child,
          rest: child.rotationQuaternion?.clone() || B.Quaternion.FromEulerVector(child.rotation),
        }));
      for (const fin of fins) fin.node.rotationQuaternion = fin.rest.clone();
      if (!node.rotationQuaternion) node.rotationQuaternion = B.Quaternion.FromEulerVector(node.rotation);

      // Fold: each flapping pivot's parts under that pivot, then the rest of
      // the fish under the fish. Materials-less parts (a loader run with
      // skipMaterials, as the check tool does) are left alone by foldRigid.
      const flapOf = (mesh) => fins.find((fin) => mesh.isDescendantOf(fin.node))?.node || node;
      const groups = new Map([[node, []], ...fins.map((fin) => [fin.node, []])]);
      for (const mesh of node.getChildMeshes(false)) if (mesh.material) groups.get(flapOf(mesh)).push(mesh);
      for (const [pivot, parts] of groups) {
        if (parts.length < 2) continue;
        paint ||= whiteCopy(parts[0].material, 'Fishtank fish (vertex colours)');
        const was = new Set(parts.map((m) => m.material));
        const one = foldRigid(pivot, parts, paint, `${node.name} ${pivot === node ? 'body' : pivot.name}`);
        if (!one) continue;
        one.receiveShadows = true;   // as room.js sets on every sky mesh
        movingMeshes.add(one);
        for (const mat of was) if (!scene.meshes.some((m) => m.material === mat)) mat.dispose();
      }
      return { node, home: node.position.clone(), index: Number(node.name.match(/\d+$/)[0]), fins };
    });

  // The tank, from where the fish are: the box of their homes, padded by the
  // swim radius and a body length. Fixed, so the test costs nothing.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const { node } of fish) {
    node.computeWorldMatrix(true);
    const p = node.getAbsolutePosition();
    [p.x, p.y, p.z].forEach((v, k) => { lo[k] = Math.min(lo[k], v - 1.5); hi[k] = Math.max(hi[k], v + 1.5); });
  }
  const seen = fish.length ? watch(scene, lo, hi, { range: FAR }) : () => false;

  const pose = {}, flap = new B.Quaternion();
  let elapsed = 0;
  return {
    movingMeshes,
    animate(dt) {
      if (!seen()) return;
      elapsed += Math.max(0, Math.min(dt, 0.05));
      for (const { node, home, index, fins } of fish) {
        swimPose(home, index, elapsed, pose);
        node.position.set(pose.x, pose.y, pose.z);
        B.Quaternion.RotationYawPitchRollToRef(pose.yaw, pose.pitch, 0, node.rotationQuaternion);
        B.Quaternion.RotationAxisToRef(B.Axis.Y, pose.fin, flap);
        for (const fin of fins) fin.rest.multiplyToRef(flap, fin.node.rotationQuaternion);
      }
    },
  };
}
