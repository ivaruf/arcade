/**
 * foxrace.js — a round of NeonFox played on a glass roof over its island.
 *
 * The owner's idea, 2026-10-02: "the foxes should play in the ceiling — a see
 * through roof where the foxes will not get in your way, but they will still
 * have their ball moving around, and you could fly up and look at them. Closer
 * to the actual game, with neon stripes and crashes, but lower fidelity."
 *
 * So the arena gets a roof of dark glass on four legs above the corner pylons,
 * and on it four foxes play the game's own rule: ride, leave a wall of light,
 * touch any wall and you are out, last one riding wins the round. Watched from
 * the floor through the glass, or from above by flying up.
 *
 * LOWER FIDELITY, DELIBERATELY. The game's rules, not its engine:
 *   - Steering is a look-ahead over three choices (left, straight, right),
 *     re-decided a few times a second, which is the shape of the game's bots
 *     without their personalities.
 *   - Collision is an occupancy grid, like the game's grid.js, at 12 cm cells:
 *     each rider stamps the cell under its orb and dies on entering one that is
 *     a rival's, or its own from more than a moment ago.
 *   - A trail is a ribbon wall with a fixed, preallocated vertex buffer. A new
 *     point every 16 cm rewrites that buffer and widens the draw range; nothing
 *     is allocated while a round runs, and a round has a time cap so the buffer
 *     cannot run out.
 *   - A crash is a burst of a dozen sparks and a ring, reused every time.
 * None of it touches the gopher: the roof is not a platform and the riders
 * are not blockers.
 *
 * THE RIDERS are clones of a template from the island models (room.js
 * ISLAND_MODELS): "NF Game Rider", made from the game's own fox model
 * (neonfox_rider_from_game.py), or, if that file did not arrive, the low-poly
 * "NF Rider" from neonfox-island.glb. Either has an "… orb" child to roll about
 * its local X and "NF tint …" materials to recolour. No template, no race; the
 * roof still stands.
 *
 * COST (PERFORMANCE.md, 2026-10-11). Measured before this, the race was 75
 * meshes and ~150 draw calls a frame near the arena, and it ran — trails
 * uploading, foxes rolling — from anywhere in the sky. Now:
 *   - Each rider is folded into five draw calls (moving.js foldRigid): every
 *     part that does not glow is painted into its vertices and merged into
 *     one body, glossy bits into a second; the glowing accent keeps its own
 *     material, and the orb and its rings stay a separate child because they
 *     roll. The game's fox is kept rather than the low-poly one: 12k
 *     triangles each is nothing to a GPU, and it is the draw calls that cost.
 *   - The trails have a fixed bound over the roof and a frozen world matrix
 *     instead of alwaysSelectAsActiveMesh, so they cull like anything else;
 *     a new point uploads six floats instead of the whole buffer.
 *   - The race pauses, and the riders are switched off, while the roof is out
 *     of view or more than FAR metres away (moving.js watch). It resumes where
 *     it stopped: the step is clamped, so no time is "caught up".
 */

import { FAR, foldRigid, watch, whiteCopy } from './moving.js';

const COLORS = ['#3aa0ff', '#ff5fb4', '#5cf07a', '#ffa03c'];  // the game's first four seats
const RISE = 4.4;           // roof height above the arena floor
const INSET = .6;           // play area inside the roof's edge
const SPEED = 2.0;          // m/s along the roof
const TURN = 2.6;           // rad/s at full lock
const CELL = .12;           // collision grid
const POINT_EVERY = .16;    // trail sample spacing, metres
const MAX_POINTS = 480;     // per trail; ROUND_CAP keeps a round inside it
const ROUND_CAP = 34;       // seconds; then the round is called a draw
const WALL = .2;            // trail wall height
const SELF_GRACE = .45;     // seconds before your own trail can kill you
const RIDER_SCALE = .62;    // the template's 0.55 m orb, shrunk for the roof
const START_DELAY = 1.1, END_DELAY = 1.6;
const STEERS = [-1, 0, 1];  // one array, not one per look-ahead

export function createFoxRace(scene, platform) {
  const B = BABYLON;
  const y0 = platform.y + RISE;
  const x0 = platform.x[0] + INSET, x1 = platform.x[1] - INSET;
  const z0 = platform.z[0] + INSET, z1 = platform.z[1] - INSET;
  const cx = (platform.x[0] + platform.x[1]) / 2, cz = (platform.z[0] + platform.z[1]) / 2;

  buildRoof(scene, platform, y0);

  const template = scene.getTransformNodeByName('NF Game Rider') || scene.getTransformNodeByName('NF Rider');
  for (const name of ['NF Game Rider', 'NF Rider']) scene.getTransformNodeByName(name)?.setEnabled(false);
  if (!template) return { animate() {} };
  // The riders are the roof's only tall things; a metre above it covers a
  // fox mid-hop. The box is fixed, so asking about it costs nothing.
  const seen = watch(scene, [x0 - .3, y0 - .1, z0 - .3], [x1 + .3, y0 + 1, z1 + .3], { range: FAR });
  let showing = true;

  // ---- grid -----------------------------------------------------------------
  const GW = Math.ceil((x1 - x0) / CELL), GH = Math.ceil((z1 - z0) / CELL);
  const owner = new Int8Array(GW * GH);       // 0 empty, i+1 rider i
  const stamped = new Float32Array(GW * GH);  // when it was stamped
  const cellOf = (x, z) => {
    const gx = Math.floor((x - x0) / CELL), gz = Math.floor((z - z0) / CELL);
    return gx < 0 || gz < 0 || gx >= GW || gz >= GH ? -1 : gz * GW + gx;
  };
  /** Free to enter for rider i at time t? Out of bounds is a wall. */
  const free = (x, z, i, t) => {
    const c = cellOf(x, z);
    if (c < 0) return false;
    const o = owner[c];
    return o === 0 || (o === i + 1 && t - stamped[c] < SELF_GRACE);
  };

  // ---- riders ---------------------------------------------------------------
  const shared = new Map();  // 'matte' / 'glossy' -> one white material for every rider
  const riders = COLORS.map((hex, i) => makeRider(scene, template, hex, i, y0, shared,
    { x0, x1, z0, z1 }));
  const sparks = makeSparks(scene, y0);
  disposeTemplates(scene);
  const spin = new B.Quaternion();

  let clock = 0, roundTime = 0, phase = 'start', phaseLeft = START_DELAY, decideIn = 0;

  function startRound() {
    owner.fill(0);
    roundTime = 0;
    const r = Math.min(x1 - x0, z1 - z0) * .32;
    const spin = Math.random() * Math.PI * 2;
    riders.forEach((rd, i) => {
      const a = spin + i * Math.PI / 2;
      rd.x = cx + Math.cos(a) * r;
      rd.z = cz + Math.sin(a) * r;
      // Facing roughly along the circle, so they spread rather than collide.
      rd.heading = a + Math.PI / 2 + (Math.random() - .5) * .6;
      rd.steer = 0;
      rd.alive = true;
      rd.trail.reset(rd.x, rd.z);
      rd.pivot.setEnabled(true);
      rd.pivot.position.y = y0;
      place(rd);
    });
    phase = 'start';
    phaseLeft = START_DELAY;
  }

  function place(rd) {
    rd.pivot.position.x = rd.x;
    rd.pivot.position.z = rd.z;
    rd.pivot.rotation.y = rd.heading;
  }

  /** Look ahead along each of three arcs and take the longest clear one. */
  function decide(rd, i) {
    let best = 0, bestScore = -1;
    for (const s of STEERS) {
      let x = rd.x, z = rd.z, h = rd.heading, d = 0;
      for (let k = 0; k < 16; k++) {
        h += s * TURN * .08;
        x += Math.sin(h) * SPEED * .08;
        z += Math.cos(h) * SPEED * .08;
        if (!free(x, z, i, clock + 1e3)) break;   // in the future, own trail counts
        d += SPEED * .08;
      }
      const score = d + Math.random() * .35 + (s === 0 ? .15 : 0);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    rd.steer = best;
  }

  function crash(rd) {
    rd.alive = false;
    rd.pivot.setEnabled(false);
    sparks.burst(rd.x, rd.z, rd.color);
  }

  startRound();

  return {
    animate(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const now = seen();
      if (now !== showing) {
        showing = now;
        for (const rd of riders) rd.pivot.setEnabled(now && rd.alive);
        if (!now) sparks.hide();
      }
      // Out of view or far: the round simply waits. The trails stay up — they
      // are the race as seen from across the sky, and four static meshes.
      if (!now) return;
      dt = Math.min(dt, .05);
      clock += dt;
      sparks.animate(dt);

      if (phase !== 'ride') {
        phaseLeft -= dt;
        // The winner of the last round hops while it waits.
        for (const rd of riders) if (rd.alive) rd.pivot.position.y = y0 + (phase === 'end' ? Math.abs(Math.sin(clock * 7)) * .12 : 0);
        if (phaseLeft > 0) return;
        if (phase === 'end') { startRound(); return; }
        phase = 'ride';
      }

      roundTime += dt;
      decideIn -= dt;
      const rethink = decideIn <= 0;
      if (rethink) decideIn = .12;
      let alive = 0;
      // A plain loop: a forEach here built a fresh closure every frame.
      for (let i = 0; i < riders.length; i++) {
        const rd = riders[i];
        if (!rd.alive) continue;
        if (rethink) decide(rd, i);
        rd.heading += rd.steer * TURN * dt;
        const step = SPEED * dt;
        const nx = rd.x + Math.sin(rd.heading) * step;
        const nz = rd.z + Math.cos(rd.heading) * step;
        if (!free(nx, nz, i, clock)) { crash(rd); continue; }
        rd.x = nx; rd.z = nz;
        const c = cellOf(nx, nz);
        if (owner[c] !== i + 1) { owner[c] = i + 1; stamped[c] = clock; }
        rd.trail.extend(nx, nz);
        place(rd);
        rd.roll += step / rd.radius;
        if (rd.orb) {
          B.Quaternion.RotationAxisToRef(B.Axis.X, rd.roll, spin);
          rd.rest.multiplyToRef(spin, rd.orb.rotationQuaternion);
        }
        alive++;
      }
      if (alive <= 1 || roundTime > ROUND_CAP) {
        phase = 'end';
        phaseLeft = END_DELAY;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The roof
// ---------------------------------------------------------------------------

/**
 * Dark glass on four legs that rise from the corner pylons, a glowing edge,
 * and a faint grid etched into the top so it reads as an arena from above.
 * Built here rather than in Blender because it is six boxes and a plane.
 */
function buildRoof(scene, platform, y) {
  const B = BABYLON;
  const w = platform.x[1] - platform.x[0] - .3, d = platform.z[1] - platform.z[0] - .3;
  const cx = (platform.x[0] + platform.x[1]) / 2, cz = (platform.z[0] + platform.z[1]) / 2;
  const glass = new B.StandardMaterial('Fox roof glass', scene);
  glass.diffuseColor = B.Color3.FromHexString('#1a2a5c');
  glass.specularColor = new B.Color3(.5, .6, .9);
  glass.alpha = .22;
  glass.backFaceCulling = false;
  const pane = B.MeshBuilder.CreateBox('Fox roof pane', { width: w, height: .04, depth: d }, scene);
  pane.position.set(cx, y - .02, cz);
  pane.material = glass;

  const neon = new B.StandardMaterial('Fox roof neon', scene);
  neon.disableLighting = true;
  neon.emissiveColor = B.Color3.FromHexString('#33d9ff').scale(.85);
  const etch = new B.StandardMaterial('Fox roof grid', scene);
  etch.disableLighting = true;
  etch.emissiveColor = B.Color3.FromHexString('#2a3f8a');
  const parts = [], lines = [];
  for (const [ex, ez, ew, ed] of [[0, d / 2, w, .07], [0, -d / 2, w, .07], [w / 2, 0, .07, d], [-w / 2, 0, .07, d]]) {
    const edge = B.MeshBuilder.CreateBox('Fox roof edge', { width: ew, height: .07, depth: ed }, scene);
    edge.position.set(cx + ex, y + .01, cz + ez);
    parts.push(edge);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = B.MeshBuilder.CreateCylinder('Fox roof leg', { diameter: .07, height: RISE - 2.9, tessellation: 8 }, scene);
    leg.position.set(cx + sx * (w / 2 - .25), platform.y + 2.9 + (RISE - 2.9) / 2, cz + sz * (d / 2 - .25));
    parts.push(leg);
  }
  for (let k = 1; k < 12; k++) {
    const t = -w / 2 + (w / 12) * k, s = -d / 2 + (d / 12) * k;
    const a = B.MeshBuilder.CreateBox('Fox roof grid', { width: .015, height: .004, depth: d - .2 }, scene);
    a.position.set(cx + t, y + .002, cz);
    const b = B.MeshBuilder.CreateBox('Fox roof grid', { width: w - .2, height: .004, depth: .015 }, scene);
    b.position.set(cx, y + .002, cz + s);
    lines.push(a, b);
  }
  const frame = B.Mesh.MergeMeshes(parts, true, true);
  if (frame) { frame.name = 'Fox roof frame'; frame.material = neon; }
  const grid = B.Mesh.MergeMeshes(lines, true, true);
  if (grid) { grid.name = 'Fox roof etched grid'; grid.material = etch; }
  for (const m of [pane, frame, grid]) {
    if (!m) continue;
    m.isPickable = false;
    m.freezeWorldMatrix();
  }
  // The pane is a third alpha-blended material where ENVIRONMENT.md allows
  // two. It is the whole point of the roof (the race is watched through it),
  // so it stays, as a decision rather than a detail; see PERFORMANCE.md.
  for (const mat of [glass, neon, etch]) mat.freeze();
}

/**
 * Both rider templates go once the riders are built: hidden, they still sat
 * in the list the engine walks every frame, and the materials only they used
 * (every one, when the fold worked) go with them.
 */
function disposeTemplates(scene) {
  for (const name of ['NF Game Rider', 'NF Rider']) {
    const node = scene.getTransformNodeByName(name);
    if (!node) continue;
    const mats = new Set(node.getChildMeshes(false).map((m) => m.material).filter(Boolean));
    node.dispose(false, false);
    for (const mat of mats) if (!scene.meshes.some((m) => m.material === mat)) mat.dispose();
  }
}

// ---------------------------------------------------------------------------
// A rider: a tinted, folded clone of the template, a pivot, and a trail
// ---------------------------------------------------------------------------

/**
 * The game's tintFox recipe, by the names neonfox_rider_from_game.py gives:
 * the albedo a part takes in this rider's colour, and its emission where it
 * glows. Null for a part the tint leaves alone.
 */
function tintOf(name, colour) {
  const B = BABYLON, white = B.Color3.White();
  if (name.startsWith('NF tint fur shadow')) return { albedo: colour.scale(.45) };
  if (name.startsWith('NF tint fur')) return { albedo: colour };
  if (name.startsWith('NF tint tips')) return { albedo: B.Color3.Lerp(colour, white, .35) };
  if (name.startsWith('NF tint accent')) return { albedo: B.Color3.Lerp(colour, white, .3), emissive: colour.scale(.8) };
  if (name.startsWith('NF tint orb')) return { albedo: colour.scale(.6), emissive: colour.scale(.6) };
  if (name.startsWith('NF tint rings')) { const c = B.Color3.Lerp(colour, white, .4); return { albedo: c, emissive: c }; }
  return null;
}

/** Emission is a material property, so a glowing part cannot be painted. */
const glows = (mat) => !!(mat.emissiveColor && mat.emissiveColor.r + mat.emissiveColor.g + mat.emissiveColor.b > 0);
/** Shiny or metal parts (the riding suit, the inner ears, the brass) keep a
 * glossier surface than the fur; the rest is matte. */
const glossy = (mat) => (mat.metallic ?? 0) > .3 || (mat.roughness ?? 1) < .55;

/**
 * One rider. The clone keeps the template's world transform (the loader's
 * handedness flip with it) under a pivot the race moves. Then its parts are
 * folded: glowing ones get a tinted material of their own, as before; the
 * orb's stay a separate child because it rolls; everything else is painted
 * with its colour and merged into a matte body and a glossy one, sharing two
 * white materials across all four riders (moving.js foldRigid). If a fold
 * fails the parts stay as they were, tinted, and the race still runs.
 */
function makeRider(scene, template, hex, i, y0, shared, area) {
  const B = BABYLON;
  const colour = B.Color3.FromHexString(hex).toLinearSpace();
  const clone = template.clone(`${template.name} ${i + 1}`, template.parent, false);
  const pivot = new B.TransformNode(`Fox racer ${i + 1}`, scene);
  clone.setEnabled(true);
  clone.computeWorldMatrix(true);
  clone.setParent(pivot);
  pivot.scaling.setAll(RIDER_SCALE);
  pivot.position.y = y0;
  const nodes = clone.getDescendants(false);
  const orb = nodes.find((node) => /Rider orb$/.test(node.name)) || null;
  const own = new Map();
  const groups = { matte: [], glossy: [] };
  for (const node of nodes) {
    // Children of a pivot that moves every frame cannot be frozen.
    node.unfreezeWorldMatrix?.();
    if (!node.material) continue;
    node.isPickable = false;
    const mat = node.material;
    if (glows(mat) || (orb && node.isDescendantOf(orb))) {
      const tint = tintOf(mat.name, colour);
      if (!tint) continue;
      if (!own.has(mat)) {
        const m = mat.clone(`${mat.name} (${hex})`);
        if (m.albedoColor) m.albedoColor = tint.albedo;
        if (tint.emissive && m.emissiveColor) m.emissiveColor = tint.emissive;
        m.freeze();
        own.set(mat, m);
      }
      node.material = own.get(mat);
      continue;
    }
    groups[glossy(mat) ? 'glossy' : 'matte'].push(node);
  }
  for (const [kind, parts] of Object.entries(groups)) {
    if (!parts.length) continue;
    // The white copy takes its surface from the biggest part — the fur for
    // matte (sheen and all), the riding suit for glossy.
    if (!shared.has(kind)) {
      const base = parts.reduce((a, b) => (b.getTotalVertices() > a.getTotalVertices() ? b : a));
      shared.set(kind, whiteCopy(base.material, `Fox racer ${kind} (vertex colours)`));
    }
    const colourFor = (m) => tintOf(m.material.name, colour)?.albedo || m.material.albedoColor || m.material.diffuseColor;
    const one = foldRigid(clone, parts, shared.get(kind), `Fox racer ${i + 1} ${kind}`, colourFor);
    if (one) continue;
    // Not folded: tint in place, the way every rider was before.
    for (const node of parts) {
      const tint = tintOf(node.material.name, colour);
      if (!tint) continue;
      if (!own.has(node.material)) {
        const m = node.material.clone(`${node.material.name} (${hex})`);
        if (m.albedoColor) m.albedoColor = tint.albedo;
        own.set(node.material, m);
      }
      node.material = own.get(node.material);
    }
  }
  if (orb && !orb.rotationQuaternion) orb.rotationQuaternion = B.Quaternion.FromEulerVector(orb.rotation);
  return {
    pivot, orb, color: colour, x: 0, z: 0, heading: 0, steer: 0, alive: true, roll: 0,
    radius: .275 * RIDER_SCALE,
    rest: orb ? orb.rotationQuaternion.clone() : null,
    trail: makeTrail(scene, colour, y0, i, area),
  };
}

/**
 * A wall of light: MAX_POINTS pairs of vertices (foot and top), allocated
 * once, drawn up to the newest pair by narrowing the submesh's index count.
 * extend() writes one new pair into the buffer and uploads just those six
 * floats; nothing past the newest pair is ever drawn, so nothing there needs
 * pinning.
 *
 * Its bound is the whole play area, fixed, and its world matrix is frozen at
 * identity: the vertices move, the mesh never does, so it culls by a box that
 * is always right instead of being forced active every frame.
 */
function makeTrail(scene, colour, y0, i, area) {
  const B = BABYLON;
  const positions = new Float32Array(MAX_POINTS * 2 * 3);
  const indices = new Uint32Array((MAX_POINTS - 1) * 6);
  for (let k = 0; k < MAX_POINTS - 1; k++) {
    const a = k * 2, o = k * 6;
    indices[o] = a; indices[o + 1] = a + 1; indices[o + 2] = a + 2;
    indices[o + 3] = a + 1; indices[o + 4] = a + 3; indices[o + 5] = a + 2;
  }
  const mesh = new B.Mesh(`Fox trail ${i + 1}`, scene);
  const data = new B.VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(mesh, true);
  const mat = new B.StandardMaterial(`Fox trail ${i + 1}`, scene);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.emissiveColor = colour.scale(.75);
  mat.freeze();
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.setBoundingInfo(new B.BoundingInfo(new B.Vector3(area.x0, y0, area.z0),
    new B.Vector3(area.x1, y0 + WALL + .01, area.z1)));
  mesh.doNotSyncBoundingInfo = true;
  mesh.freezeWorldMatrix();
  const sub = mesh.subMeshes[0];
  // Straight to the engine rather than VertexBuffer.updateDirectly, which
  // drops the buffer's CPU copy on a partial write; `positions` IS that copy
  // and stays whole, so a lost context still restores the trail.
  const engine = scene.getEngine();
  const gpu = mesh.getVertexBuffer(B.VertexBuffer.PositionKind).getBuffer();
  const pair = new Float32Array(6);
  let count = 0, lastX = 0, lastZ = 0;
  function write(k, x, z) {
    pair[0] = x; pair[1] = y0 + .005; pair[2] = z;
    pair[3] = x; pair[4] = y0 + WALL; pair[5] = z;
    positions.set(pair, k * 6);
    engine.updateDynamicVertexBuffer(gpu, pair, k * 6 * 4);
    sub.indexCount = Math.max(0, count - 1) * 6;
  }
  return {
    reset(x, z) {
      count = 1;
      write(0, x, z);
      lastX = x; lastZ = z;
    },
    extend(x, z) {
      if (count >= MAX_POINTS) return;
      if (Math.hypot(x - lastX, z - lastZ) < POINT_EVERY) return;
      count++;
      write(count - 1, x, z);
      lastX = x; lastZ = z;
    },
  };
}

/** A crash: a ring and a dozen sparks, one shared set, reused per crash. */
function makeSparks(scene, y0) {
  const B = BABYLON;
  const mat = new B.StandardMaterial('Fox crash', scene);
  mat.disableLighting = true;
  const ring = B.MeshBuilder.CreateTorus('Fox crash ring', { diameter: 1, thickness: .05, tessellation: 24 }, scene);
  ring.material = mat;
  const bits = [];
  for (let k = 0; k < 12; k++) {
    const b = B.MeshBuilder.CreateBox('Fox crash spark', { size: .06 }, scene);
    b.material = mat;
    bits.push({ mesh: b, vx: 0, vy: 0, vz: 0 });
  }
  for (const m of [ring, ...bits.map((b) => b.mesh)]) { m.isPickable = false; m.setEnabled(false); }
  let left = 0;
  return {
    /** Paused mid-burst (the camera looked away): no frozen sparks left hanging. */
    hide() {
      left = 0;
      ring.setEnabled(false);
      for (const b of bits) b.mesh.setEnabled(false);
    },
    burst(x, z, colour) {
      mat.emissiveColor = colour;
      left = .7;
      ring.position.set(x, y0 + .15, z);
      ring.scaling.setAll(.2);
      ring.setEnabled(true);
      bits.forEach((b, k) => {
        const a = k / bits.length * Math.PI * 2;
        b.vx = Math.cos(a) * 2.2; b.vz = Math.sin(a) * 2.2; b.vy = 1.5 + Math.random();
        b.mesh.position.set(x, y0 + .2, z);
        b.mesh.setEnabled(true);
      });
    },
    animate(dt) {
      if (left <= 0) return;
      left -= dt;
      const t = 1 - left / .7;
      ring.scaling.setAll(.2 + t * 2.4);
      for (const b of bits) {
        b.vy -= 6 * dt;
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.y = Math.max(y0 + .03, b.mesh.position.y + b.vy * dt);
        b.mesh.position.z += b.vz * dt;
      }
      if (left <= 0) { ring.setEnabled(false); for (const b of bits) b.mesh.setEnabled(false); }
    },
  };
}
