/** Slow decorative gear trains; angle derives from elapsed time, never frame count. */
const ROTORS = new Map([
  ['Main flywheel', { teeth: 16, direction: 1 }],
  ['Companion cog', { teeth: 12, direction: -1 }],
  ['Perimeter gear 18', { teeth: 18, direction: 1 }],
  ['Perimeter gear 12', { teeth: 12, direction: -1 }],
  ['Perimeter gear 9', { teeth: 9, direction: 1 }],
]);

export function createGearAnimation(held) {
  const movingMeshes = new Set();
  const rotors = held.transformNodes.flatMap((node) => {
    if (!node.name.startsWith('GearRotor ')) return [];
    const spec = ROTORS.get(node.name.slice('GearRotor '.length));
    if (!spec) return [];
    for (const child of [node, ...node.getDescendants(false)]) {
      if (child.unfreezeWorldMatrix) child.unfreezeWorldMatrix();
      movingMeshes.add(child);
    }
    return [{
      node, ...spec,
      rest: node.rotationQuaternion?.clone() || BABYLON.Quaternion.FromEulerVector(node.rotation),
    }];
  });
  let elapsed = 0;
  return {
    movingMeshes,
    animate(dt) {
      elapsed += Math.max(0, Math.min(dt, .05));
      for (const { node, rest, teeth, direction } of rotors) {
        // Axles point along glTF local Z. The visible 18-tooth gear takes ~39s
        // per revolution, and its neighbours follow the corresponding ratios.
        const angle = (elapsed * .16 * 18 / teeth * direction) % (2 * Math.PI);
        node.rotationQuaternion = rest.multiply(
          BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, angle),
        );
      }
    },
  };
}
