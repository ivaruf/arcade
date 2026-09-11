/** Peaceful display fish. No feeding, hunting, growth or game simulation. */
const TAU = Math.PI * 2;

/** Coordinates are relative to the imported Cloud_world node (glTF Y-up).
 * The tank spans local x 19.64..21.56, z -8.6..-1.4. Paths leave room
 * for the full fish body at the tightest part of each turn. */
export function swimPose(home, index, seconds) {
  const rate = TAU / (22 + index * 2.5);
  const phase = seconds * rate + index * 2.399;
  const radius = Math.max(0.1, Math.min(0.85, home.z + 8.6 - 0.65, -1.4 - home.z - 0.65));
  const dx = 0.12 * Math.cos(phase);
  const dz = -radius * Math.sin(phase);
  return {
    x: home.x + 0.12 * Math.sin(phase),
    y: home.y + 0.025 * Math.sin(phase * 2),
    z: home.z + radius * Math.cos(phase),
    // Imported Fishtank fish face local +Z. Follow the path's tangent.
    yaw: Math.atan2(dx, dz),
    pitch: Math.max(-0.10, Math.min(0.10, -Math.atan2(0.05 * Math.cos(phase * 2), Math.hypot(dx, dz)))),
    fin: Math.sin(seconds * 3.2 + index * 1.7) * 0.12,
  };
}

export function createAquariumSwimmers(held) {
  const movingMeshes = new Set();
  const fish = [...held.transformNodes, ...held.meshes]
    .filter((node) => /^Fishtank (clownfish|blue-tang|angelfish|royal-gramma) \d+$/.test(node.name))
    .map((node) => {
      const descendants = node.getDescendants(false);
      for (const child of [node, ...descendants]) {
        if (child.unfreezeWorldMatrix) child.unfreezeWorldMatrix();
        movingMeshes.add(child);
      }
      const fins = descendants
        .filter((child) => /^(Tail|PectoralPivot)(\.\d+)?$/.test(child.name))
        .map((child) => ({
          node: child,
          rest: child.rotationQuaternion?.clone() || BABYLON.Quaternion.FromEulerVector(child.rotation),
        }));
      return { node, home: node.position.clone(), index: Number(node.name.match(/\d+$/)[0]), fins };
    });
  let elapsed = 0;
  return {
    movingMeshes,
    animate(dt) {
      elapsed += Math.max(0, Math.min(dt, 0.05));
      for (const { node, home, index, fins } of fish) {
        const pose = swimPose(home, index, elapsed);
        node.position.set(pose.x, pose.y, pose.z);
        node.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(pose.yaw, pose.pitch, 0);
        for (const fin of fins) {
          fin.node.rotationQuaternion = fin.rest.multiply(
            BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, pose.fin),
          );
        }
      }
    },
  };
}
