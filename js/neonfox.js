/** NeonFox's arena grid and six player colors, animated inside the floor. */
export function createNeonFoxFloor(scene, platform) {
  const B = BABYLON;
  const size = 768;
  const base = document.createElement('canvas');
  base.width = base.height = size;
  const grid = base.getContext('2d');
  const c = size / 2, edge = size * .45, step = edge * 2 / 12;
  // Palette and grid treatment from NeonFox's render/scene.js paintFloor.
  grid.fillStyle = '#0a1128';
  grid.fillRect(0, 0, size, size);
  const wash = grid.createRadialGradient(c, c, 0, c, c, c);
  wash.addColorStop(0, 'rgba(46,72,150,0.35)');
  wash.addColorStop(1, 'rgba(10,17,40,0)');
  grid.fillStyle = wash;
  grid.fillRect(0, 0, size, size);
  grid.lineWidth = 1.5;
  grid.strokeStyle = 'rgba(120,160,255,0.08)';
  grid.beginPath();
  for (let i = 0; i <= 12; i++) {
    const p = c - edge + step * i;
    grid.moveTo(p, c - edge); grid.lineTo(p, c + edge);
    grid.moveTo(c - edge, p); grid.lineTo(c + edge, p);
  }
  grid.stroke();
  grid.strokeStyle = 'rgba(120,160,255,0.18)';
  grid.beginPath();
  grid.moveTo(c, c - edge); grid.lineTo(c, c + edge);
  grid.moveTo(c - edge, c); grid.lineTo(c + edge, c);
  grid.stroke();
  grid.strokeStyle = 'rgba(140,190,255,0.45)';
  grid.lineWidth = 2.25;
  grid.strokeRect(c - edge, c - edge, edge * 2, edge * 2);
  const texture = new B.DynamicTexture('NeonFox animated floor', { width: size, height: size }, scene, false);
  texture.wrapU = texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  const material = new B.StandardMaterial('NeonFox floor display', scene);
  // Unlit display preserves the navy surface under the world's bright lamps.
  material.disableLighting = true;
  material.emissiveTexture = texture;
  // StandardMaterial ADDS emissiveColor to emissiveTexture; white clips every
  // pixel. Let the texture supply all emission so its dark grid stays visible.
  material.emissiveColor = B.Color3.Black();
  material.diffuseColor = material.specularColor = B.Color3.Black();
  const floor = B.MeshBuilder.CreateGround('NeonFox animated inlay', {
    width: platform.x[1] - platform.x[0], height: platform.z[1] - platform.z[0],
  }, scene);
  floor.position.set((platform.x[0] + platform.x[1]) / 2, platform.y + .004,
    (platform.z[0] + platform.z[1]) / 2);
  floor.material = material;
  floor.isPickable = false;
  floor.freezeWorldMatrix();
  // Painted halos supply glow without blooming the whole display into white.
  for (const layer of scene.effectLayers || []) layer.addExcludedMesh?.(floor);
  const colors = ['#3aa0ff', '#ff5fb4', '#5cf07a', '#ffa03c', '#7838e8', '#ed3038'];
  const ctx = texture.getContext();
  let time = 0, pending = 0;
  // Bounded continuous paths at different tempos; sample past positions for
  // fading trails without retaining a growing history or allocating meshes.
  function point(t, i) {
    const a = t * (.34 + i * .023) + i * 1.047;
    return [c + edge * (.69 * Math.sin(a) + .16 * Math.sin(a * 2.3 + i)),
      c + edge * (.65 * Math.sin(a * 1.37 + i * .7) + .18 * Math.cos(a * 2.1))];
  }
  function paint() {
    ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      for (let j = 0; j < 48; j++) {
        const a = point(time - (48 - j) * .055, i);
        const b = point(time - (47 - j) * .055, i);
        const fade = (j + 1) / 48;
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b);
        ctx.globalAlpha = fade * .12; ctx.lineWidth = 12; ctx.stroke();
        ctx.globalAlpha = fade * .9; ctx.lineWidth = 3.2; ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    texture.update();
  }
  paint();
  return {
    animate(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const elapsed = Math.min(dt, .1);
      time += elapsed; pending += elapsed;
      if (pending < 1 / 24) return;
      pending %= 1 / 24;
      paint();
    },
  };
}
