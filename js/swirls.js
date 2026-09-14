/** Decorative 3D adaptations of Swirls' Aurora Veil and Still Orbits.
 * Source: games/swirls/effects.js — its palettes, 0.7 elliptical aspect,
 * circling aurora heads and slowly precessing orbit motes. No game simulation.
 * Fixed-size geometry updates at 30 Hz; no canvas textures or extra lights.
 */
export function createIslandSwirls(scene, island) {
  const B = BABYLON;
  const cx = (island.x[0] + island.x[1]) / 2;
  const cz = (island.z[0] + island.z[1]) / 2;
  const floor = island.y;
  const curves = [];
  const TAU = Math.PI * 2;
  const steps = 56, sides = 5;
  const palette = [[80, 220, 160], [110, 170, 235], [170, 120, 235], [230, 190, 255], [255, 200, 220]];
  const materials = palette.map((rgb, i) => {
    const mat = new B.StandardMaterial(`Swirls light ${i}`, scene);
    const color = B.Color3.FromInts(...rgb);
    mat.diffuseColor = B.Color3.Black();
    mat.emissiveColor = color.scale(.82);
    mat.specularColor = B.Color3.Black();
    mat.disableLighting = true;
    return mat;
  });

  function trail(name, material, radius, sample) {
    const positions = new Float32Array((steps + 1) * sides * 3);
    const indices = [];
    for (let i = 0; i < steps; i++) for (let s = 0; s < sides; s++) {
      const a = i * sides + s, b = i * sides + (s + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
    const mesh = new B.Mesh(name, scene);
    const data = new B.VertexData();
    data.positions = positions; data.indices = indices;
    data.applyToMesh(mesh, true);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    const head = B.MeshBuilder.CreateSphere(`${name} mote`, { diameter: radius * 4, segments: 8 }, scene);
    head.material = material; head.isPickable = false;
    const p = new B.Vector3();
    curves.push({ mesh, head, radius, sample, positions, p });
  }

  // Outside the deck: no ribbon sweeps across the pergola, game sign or cabinet.
  for (const [i, x, y, z, phase] of [
    [0, island.x[0] - 1.5, floor + 2.1, cz - .8, 0],
    [1, island.x[1] + 1.5, floor + 2.6, cz - 1.0, 2.1],
    [2, cx + 3.6, floor + 3.0, island.z[1] + 2.3, 4.2],
  ]) {
    trail(`Swirls Aurora Veil ${i}`, materials[i], .032, (u, t, p) => {
      // A circling head leaves a tapered, gently undulating two-turn spine.
      const a = t * .32 + phase - (1 - u) * TAU * 1.7;
      const r = .20 + u * .91;
      p.set(x + Math.cos(a) * r,
        y + Math.sin(a) * r * .7 + .12 * Math.sin(t * .55 + phase),
        z + .24 * Math.sin(a * .7 + t * .22));
    });
  }

  for (const [cluster, x, z] of [
    [0, island.x[0] - 1.3, cz + 2.4],
    [1, island.x[1] + 1.3, cz + 2.6],
  ]) {
    for (let j = 0; j < 3; j++) {
      const radius = .42 + j * .22;
      trail(`Swirls Still Orbits ${cluster}:${j}`, materials[3 + (j % 2)], .017, (u, t, p) => {
        const a = t * (.24 + j * .065) * (j % 2 ? -1 : 1) + j * TAU / 3 - (1 - u) * 2.7;
        const rotation = t * .09 + cluster;
        const ox = Math.cos(a) * radius, oy = Math.sin(a) * radius * .7;
        p.set(x + ox * Math.cos(rotation) - oy * Math.sin(rotation),
          floor + 3.75 + ox * Math.sin(rotation) + oy * Math.cos(rotation),
          z + .16 * Math.sin(a + cluster));
      });
    }
  }

  function update(t) {
    for (const { mesh, head, radius, sample, positions, p } of curves) {
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        sample(u, t, p);
        const width = radius * (.10 + .90 * Math.sin(u * Math.PI / 2));
        // All paths lie mainly in XY; their tangent supplies the tube frame.
        const px = p.x, py = p.y, pz = p.z;
        sample(u + .001, t, p);
        const tx = p.x - px, ty = p.y - py;
        const length = Math.hypot(tx, ty) || 1;
        const nx = -ty / length, ny = tx / length;
        for (let s = 0; s < sides; s++) {
          const a = s * TAU / sides, offset = (i * sides + s) * 3;
          positions[offset] = px + nx * Math.cos(a) * width;
          positions[offset + 1] = py + ny * Math.cos(a) * width;
          positions[offset + 2] = pz + Math.sin(a) * width;
        }
        if (i === steps) head.position.set(px, py, pz);
      }
      mesh.updateVerticesData(B.VertexBuffer.PositionKind, positions, true);
    }
  }
  update(0);
  let elapsed = 0, pending = 0;
  return {
    animate(dt) {
      const step = Math.max(0, Math.min(dt, .05));
      elapsed += step; pending += step;
      if (pending < 1 / 30) return;
      pending %= 1 / 30;
      update(elapsed);
    },
  };
}
