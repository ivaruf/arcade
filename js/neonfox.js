/**
 * NeonFox's arena: the grid and six player colours animated inside the floor,
 * and since 2026-10-02 three foxes on orbs actually riding three of them.
 *
 * THE RACE ZONE. The six lines are bounded curves that roam the whole floor,
 * which is harmless for paint and impossible for a solid fox: it would ride
 * through the cabinet, the take-home machine and the mast, all on the west
 * side. So the three ridden lines use the same curves rescaled into RACE, the
 * east part of the arena, and the other three keep roaming the whole floor as
 * they always have — the owner likes the lines, and the lines stay.
 *
 * THE RIDERS come from neonfox-island.glb (ISLAND_MODELS in room.js): one
 * template, "NF Rider", whose children are "NF Rider orb" (rolled about its
 * local X) and "NF Rider fox" (rigid, facing +Z). Each rider is a clone with
 * its "NF tint…" materials recoloured to its line, moved to the line's head
 * every frame, turned along it, and given a blocker that moves with it so the
 * gopher is nudged aside rather than ridden through. No template (a missing
 * file) means no riders and the floor exactly as before.
 */
const RACE = { x: [-20.2, -13.6], z: [-23.4, -12.6] };
const RIDDEN = 3;          // lines 0..2 carry a fox
const TRAIL_STEP = .055;   // seconds between the samples a trail is drawn from

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
  // `wave` is the curve in -0.85..0.85 on both axes; `point` puts it on the
  // canvas, the whole floor for a roaming line and RACE for a ridden one.
  const out = [0, 0];
  function wave(t, i) {
    const a = t * (.34 + i * .023) + i * 1.047;
    out[0] = .69 * Math.sin(a) + .16 * Math.sin(a * 2.3 + i);
    out[1] = .65 * Math.sin(a * 1.37 + i * .7) + .18 * Math.cos(a * 2.1);
    return out;
  }
  const W = platform.x[1] - platform.x[0], H = platform.z[1] - platform.z[0];
  /** The ridden line's position on the floor, in world x/z. */
  function raceWorld(t, i, into) {
    const [u, v] = wave(t, i);
    into[0] = (RACE.x[0] + RACE.x[1]) / 2 + (u / .85) * (RACE.x[1] - RACE.x[0]) / 2;
    into[1] = (RACE.z[0] + RACE.z[1]) / 2 + (v / .85) * (RACE.z[1] - RACE.z[0]) / 2;
    return into;
  }
  // World to canvas: CreateGround runs u with +x and v with +z, and the
  // canvas's top row is v = 1, the floor's +z edge.
  const worldPt = [0, 0];
  function point(t, i) {
    if (i < RIDDEN) {
      raceWorld(t, i, worldPt);
      return [(worldPt[0] - platform.x[0]) / W * size, (platform.z[1] - worldPt[1]) / H * size];
    }
    const [u, v] = wave(t, i);
    return [c + edge * u, c + edge * v];
  }
  function paint() {
    ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      for (let j = 0; j < 48; j++) {
        const a = point(time - (48 - j) * TRAIL_STEP, i);
        const b = point(time - (47 - j) * TRAIL_STEP, i);
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
  const riders = createRiders(scene, platform.y, colors);
  const here = [0, 0], ahead = [0, 0];
  function ride(dt) {
    for (let i = 0; i < riders.length; i++) {
      const r = riders[i];
      raceWorld(time, i, here);
      raceWorld(time + .05, i, ahead);
      const dx = ahead[0] - here[0], dz = ahead[1] - here[1];
      r.pivot.position.x = here[0];
      r.pivot.position.z = here[1];
      if (dx * dx + dz * dz > 1e-8) r.pivot.rotation.y = Math.atan2(dx, dz);
      // Rolling without slipping: the orb turns by distance / radius.
      if (r.orb && r.last) {
        r.roll += Math.hypot(here[0] - r.last[0], here[1] - r.last[1]) / r.radius;
        r.orb.rotationQuaternion = r.rest.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, r.roll));
      }
      r.last = r.last || [0, 0];
      r.last[0] = here[0]; r.last[1] = here[1];
      r.blocker.x = here[0];
      r.blocker.z = here[1];
    }
  }
  ride(0);
  return {
    /** Live objects: their x/z move with the riders, and the gopher's
     *  collision reads them every frame (main.js keeps the references). */
    blockers: riders.map((r) => r.blocker),
    animate(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const elapsed = Math.min(dt, .1);
      time += elapsed; pending += elapsed;
      // The riders move every frame — 24 fps is fine for paint and visibly
      // juddery for a solid fox — and the floor repaints at 24.
      ride(elapsed);
      if (pending < 1 / 24) return;
      pending %= 1 / 24;
      paint();
    },
  };
}

/**
 * The tint recipe per part, as neonfox_island_v2.py authors it and as the
 * game's rider.js tintFox does it: fur takes the colour, its shadow side a
 * darker cut of it, the glowing accents and rings a whiter one so they read
 * as light rather than paint, and the orb a dimmer body under its own glow.
 */
const WHITE = new BABYLON.Color3(1, 1, 1);
function tintPart(mat, colour) {
  const name = mat.name;
  const set = (albedo, emissive) => {
    if (mat.albedoColor) mat.albedoColor = albedo;
    if (emissive && mat.emissiveColor) mat.emissiveColor = emissive;
  };
  if (name.startsWith('NF tint fur shadow')) set(colour.scale(.45));
  else if (name.startsWith('NF tint fur')) set(colour);
  else if (name.startsWith('NF tint accent')) set(BABYLON.Color3.Lerp(colour, WHITE, .3), colour);
  else if (name.startsWith('NF tint orb')) set(colour.scale(.6), colour);
  else if (name.startsWith('NF tint rings')) { const c = BABYLON.Color3.Lerp(colour, WHITE, .4); set(c, c); }
  else set(colour);
}

/**
 * Three riders cloned from the "NF Rider" template, each tinted to its line.
 * The clone keeps the template's world transform (the glTF loader's
 * handedness flip included) and hangs under a plain pivot that the race moves,
 * so nothing here has to know which way the loader mirrored the model.
 */
function createRiders(scene, floorY, colors) {
  const B = BABYLON;
  const template = scene.getTransformNodeByName('NF Rider') || scene.getMeshByName('NF Rider');
  if (!template) return [];
  template.computeWorldMatrix(true);
  const riders = [];
  for (let i = 0; i < RIDDEN; i++) {
    const clone = template.clone(`NF Rider ${i + 1}`, template.parent, false);
    if (!clone) continue;
    const pivot = new B.TransformNode(`NF Rider pivot ${i + 1}`, scene);
    clone.computeWorldMatrix(true);
    clone.setParent(pivot);
    pivot.position.y = floorY;
    const colour = B.Color3.FromHexString(colors[i]).toLinearSpace();
    const tinted = new Map();
    let orb = null;
    for (const node of clone.getDescendants(false)) {
      if (node.name.endsWith('NF Rider orb')) orb = node;
      if (!node.material) continue;
      node.isPickable = false;
      node.unfreezeWorldMatrix?.();
      const mat = node.material;
      if (!/^NF tint/.test(mat.name)) continue;
      if (!tinted.has(mat)) {
        const own = mat.clone(`${mat.name} (${colors[i]})`);
        tintPart(own, colour);
        tinted.set(mat, own);
      }
      node.material = tinted.get(mat);
    }
    let radius = .275;
    if (orb) {
      const b = orb.getHierarchyBoundingVectors?.(true);
      if (b) radius = Math.max(.05, (b.max.y - b.min.y) / 2);
      if (!orb.rotationQuaternion) orb.rotationQuaternion = B.Quaternion.FromEulerVector(orb.rotation);
    }
    riders.push({
      pivot, orb, radius, roll: 0, last: null,
      rest: orb ? orb.rotationQuaternion.clone() : null,
      blocker: { x: 0, z: 0, hx: .34, hz: .34, top: floorY + 1.3, base: floorY },
    });
  }
  template.setEnabled(false);
  return riders;
}
