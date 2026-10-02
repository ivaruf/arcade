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
 * About a dozen draw calls in all, and none of it touches the gopher: the roof
 * is not a platform and the riders are not blockers.
 *
 * THE RIDERS are clones of a template from the island models (room.js
 * ISLAND_MODELS): "NF Game Rider", made from the game's own fox model
 * (neonfox_rider_from_game.py), or, if that file did not arrive, the low-poly
 * "NF Rider" from neonfox-island.glb. Either has an "… orb" child to roll about
 * its local X and "NF tint …" materials to recolour. No template, no race; the
 * roof still stands.
 */

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
  const riders = COLORS.map((hex, i) => makeRider(scene, template, hex, i, y0));
  const sparks = makeSparks(scene, y0);

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
    for (const s of [-1, 0, 1]) {
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
      riders.forEach((rd, i) => {
        if (!rd.alive) return;
        if (rethink) decide(rd, i);
        rd.heading += rd.steer * TURN * dt;
        const step = SPEED * dt;
        const nx = rd.x + Math.sin(rd.heading) * step;
        const nz = rd.z + Math.cos(rd.heading) * step;
        if (!free(nx, nz, i, clock)) { crash(rd); return; }
        rd.x = nx; rd.z = nz;
        const c = cellOf(nx, nz);
        if (owner[c] !== i + 1) { owner[c] = i + 1; stamped[c] = clock; }
        rd.trail.extend(nx, nz);
        place(rd);
        rd.roll += step / rd.radius;
        if (rd.orb) rd.orb.rotationQuaternion = rd.rest.multiply(B.Quaternion.RotationAxis(B.Axis.X, rd.roll));
        alive++;
      });
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
}

// ---------------------------------------------------------------------------
// A rider: a tinted clone of the template, a pivot, and a trail
// ---------------------------------------------------------------------------

const WHITE = () => new BABYLON.Color3(1, 1, 1);

/** The game's tintFox recipe, by the names neonfox_rider_from_game.py gives. */
function tintPart(mat, colour) {
  const B = BABYLON;
  const name = mat.name;
  const set = (albedo, emissive) => {
    if (mat.albedoColor) mat.albedoColor = albedo;
    if (emissive && mat.emissiveColor) mat.emissiveColor = emissive;
  };
  if (name.startsWith('NF tint fur shadow')) set(colour.scale(.45));
  else if (name.startsWith('NF tint fur')) set(colour);
  else if (name.startsWith('NF tint tips')) set(B.Color3.Lerp(colour, WHITE(), .35));
  else if (name.startsWith('NF tint accent')) set(B.Color3.Lerp(colour, WHITE(), .3), colour.scale(.8));
  else if (name.startsWith('NF tint orb')) set(colour.scale(.6), colour.scale(.6));
  else if (name.startsWith('NF tint rings')) { const c = B.Color3.Lerp(colour, WHITE(), .4); set(c, c); }
}

function makeRider(scene, template, hex, i, y0) {
  const B = BABYLON;
  const colour = B.Color3.FromHexString(hex).toLinearSpace();
  const clone = template.clone(`${template.name} ${i + 1}`, template.parent, false);
  const pivot = new B.TransformNode(`Fox racer ${i + 1}`, scene);
  clone.setEnabled(true);
  clone.computeWorldMatrix(true);
  // Keep the template's world transform, the loader's handedness flip with it.
  clone.setParent(pivot);
  pivot.scaling.setAll(RIDER_SCALE);
  pivot.position.y = y0;
  const own = new Map();
  let orb = null;
  for (const node of clone.getDescendants(false)) {
    if (/Rider orb$/.test(node.name)) orb = node;
    node.unfreezeWorldMatrix?.();
    if (!node.material) continue;
    node.isPickable = false;
    const mat = node.material;
    if (!/^NF tint/.test(mat.name)) continue;
    if (!own.has(mat)) {
      const m = mat.clone(`${mat.name} (${hex})`);
      tintPart(m, colour);
      own.set(mat, m);
    }
    node.material = own.get(mat);
  }
  if (orb && !orb.rotationQuaternion) orb.rotationQuaternion = B.Quaternion.FromEulerVector(orb.rotation);
  return {
    pivot, orb, color: colour, x: 0, z: 0, heading: 0, steer: 0, alive: true, roll: 0,
    radius: .275 * RIDER_SCALE,
    rest: orb ? orb.rotationQuaternion.clone() : null,
    trail: makeTrail(scene, colour, y0, i),
  };
}

/**
 * A wall of light: MAX_POINTS pairs of vertices (foot and top), allocated
 * once. Unused pairs sit on the newest point, so the quads past it collapse to
 * nothing; extend() writes the new pair, re-pins the tail to it, and uploads.
 */
function makeTrail(scene, colour, y0, i) {
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
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;  // the buffer moves; never let a stale bound cull it
  let count = 0, lastX = 0, lastZ = 0;
  function write(k, x, z) {
    const o = k * 6;
    positions[o] = x; positions[o + 1] = y0 + .005; positions[o + 2] = z;
    positions[o + 3] = x; positions[o + 4] = y0 + WALL; positions[o + 5] = z;
  }
  function pinTail(x, z) {
    for (let k = count; k < MAX_POINTS; k++) write(k, x, z);
  }
  return {
    reset(x, z) {
      count = 1;
      write(0, x, z);
      pinTail(x, z);
      lastX = x; lastZ = z;
      mesh.updateVerticesData(B.VertexBuffer.PositionKind, positions);
    },
    extend(x, z) {
      if (count >= MAX_POINTS) return;
      if (Math.hypot(x - lastX, z - lastZ) < POINT_EVERY) return;
      write(count, x, z);
      count++;
      pinTail(x, z);
      lastX = x; lastZ = z;
      mesh.updateVerticesData(B.VertexBuffer.PositionKind, positions);
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
