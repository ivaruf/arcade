/* =============================================================================
 * geometrypong.js — the hexagon court: Geometry Pong's island, built in code.
 *
 * The island IS the table. Geometry Pong is played round one tablet lying flat
 * with a finger on each edge, so the deck is that tablet seen from above: a
 * near-black slab with a hexagon arena laid into it, every side a player's
 * goal edged in that player's neon (the game's own eight colours, the first
 * six of them here), a glowing paddle on each side, a pale round bumper at
 * each corner, and two faint copies of the hexagon echoing inward, as the
 * game's own background does. Outside each side sits that player's glyph —
 * circle, triangle, square, diamond, pentagon, hexagon — because the game
 * gives every colour a shape so it still reads to a colour-blind player.
 * Underneath, a tapered hexagonal keel echoes the arena once more for anyone
 * looking up at it from the reservoir below.
 *
 * WHAT MOVES. Two balls play a real, cheap game of it. A ball bounces off the
 * paddles the way the game's do — where it hits decides where it goes, up to
 * 55° either way — speeds up a little each hit, and takes the colour of the
 * last paddle to touch it. The paddles chase whichever ball is coming at them,
 * and they do not always get there: the corners are out of a paddle's reach,
 * as in the game, and now and then one is simply late. A ball through a side
 * seals it: a barrier in the scorer's colour slams in from both corners, hums
 * for two seconds while balls bank off it, and opens again from the middle
 * outward. Then the ball is served again from the centre, pale until somebody
 * hits it.
 *
 * COST (PERFORMANCE.md, CLAUDE.md §5). The ratified shape for an island:
 * flat colour by vertex, one material per glow colour.
 *   - Everything still is returned in `statics` for room.js to merge: the
 *     slab, keel, arena floor, echoes and the mast are ONE vertex-coloured
 *     matte material; the edges, glyphs, bumpers and the slab's light line are
 *     one emissive material per neon colour, seven in all.
 *   - The moving parts are six paddles and two balls, each its own mesh only
 *     because each moves on its own. A ball's colour is a material swap on a
 *     hit — a pointer write, never a new material. The four barrier halves are
 *     switched off unless a side is sealed.
 *   - animate() allocates nothing: every vector is a plain number in a fixed
 *     array, every pose a position.set(). It does nothing at all while the
 *     court is out of view or beyond FAR metres (moving.js); the balls wait
 *     where they are and play on from there.
 *   - Nothing here casts a shadow; nothing is a thin instance.
 *
 * Coordinates: the arena is centred on (HX, HZ) at deck height; a direction
 * at angle φ is (cos φ, sin φ) in (x, z). Corner j sits at angle j·60°, so the
 * hexagon points along ±x (Babylon's own six-sided cylinder does the same),
 * and side k, between corners k and k+1, faces outward at (k + ½)·60°. A slot
 * at yaw 0 faces +z, as in room.js.
 * ========================================================================== */

import { FAR, watch } from './moving.js';

/** The game's player colours (geometry_pong/DESIGN.md §5), in seat order. */
const PLAYERS = ['#3be8ff', '#ff4fd8', '#ffd23f', '#7dff6a', '#ff8a3d', '#a98bff'];
/** Its eighth colour, the near-white, for bumpers, a fresh serve and the slab's line. */
const ICE = '#e8f6ff';
/** Which side wears which colour: side k faces (k + ½)·60°. The side facing the
 * welcome cloud (150°, k = 2) is cyan, as the icon's bottom side is, and the
 * rest follow round in the icon's order. */
const SIDE_COLOUR = [4, 5, 0, 1, 2, 3];
/** The glyph beside each colour: a flat disc's sides and its turn from
 * pointing straight out. 20 sides reads as round; the square is turned to sit
 * square to its edge, the diamond is the same square left pointing out. */
const GLYPH = [[20, 0], [3, 0], [4, Math.PI / 4], [4, 0], [5, 0], [6, Math.PI / 6]];

const R = 4.8;                     // arena circumradius, m; side length is R too
const APOTHEM = R * Math.sqrt(3) / 2;
const PADDLE_LINE = APOTHEM - .3;  // paddle centres, inset from the edge
const PADDLE_LEN = 1.1;
const PADDLE_DEPTH = .16;
const BALL_R = .15;
/** Where a ball's centre meets a paddle's face (or a sealed side's barrier). */
const PLANE = PADDLE_LINE - PADDLE_DEPTH / 2 - BALL_R;
/** Beyond this a missed ball has gone in. */
const GOAL = APOTHEM + .3;
/** How far a paddle's centre may slide along its side: the corners stay open. */
const REACH = PADDLE_LINE / Math.sqrt(3) - PADDLE_LEN / 2 - .22;
const MAX_ANGLE = 55 * Math.PI / 180;
const SERVE_SPEED = 3.0, TOP_SPEED = 5.6, RAMP = 1.04;
const PADDLE_SPEED = 2.6;
const SEAL = 2.0;                  // seconds a scored-on side stays a wall
const SERVE_WAIT = .9;

/**
 * Lighting here is a 1.0 hemisphere plus a 1.15 sun (room.js SKY_LOOK); a dark
 * slab at true colour would read mid-grey. The matte colours are chosen dark
 * so the deck stays the near-black the neon needs to sit on.
 */
const SLAB = '#121726', KEEL = '#0d111d', FLOOR = '#05070d', TRIM = '#2b3350',
  ECHO = '#26315a', MAST = '#1b2133';

export function createGeometryPongIsland(scene, island, { mast } = {}) {
  const B = BABYLON;
  const floor = island.y;
  const W = island.x[1] - island.x[0];
  const D = island.z[1] - island.z[0];
  const cx = island.x[0] + W / 2, cz = island.z[0] + D / 2;
  // The arena sits west of the deck's middle, so the east apron has room for
  // the cabinet, its take-home machine and the mast (room.js SLOTS).
  const HX = cx - .9, HZ = cz;
  const blockers = [];
  const statics = [];

  // ---- materials ----------------------------------------------------------
  const matte = new B.StandardMaterial('Geometry Pong matte', scene);
  matte.diffuseColor = new B.Color3(1, 1, 1); // the vertex colour carries it
  matte.specularColor = new B.Color3(.06, .07, .1);
  function neon(name, colour) {
    const mat = new B.StandardMaterial(`Geometry Pong ${name}`, scene);
    mat.disableLighting = true;
    mat.diffuseColor = B.Color3.Black();
    mat.specularColor = B.Color3.Black();
    mat.emissiveColor = B.Color3.FromHexString(colour);
    return mat;
  }
  const playerMats = PLAYERS.map((c, i) => neon(`player ${i + 1}`, c));
  const iceMat = neon('ice', ICE);
  const sideMat = (k) => playerMats[SIDE_COLOUR[k]];

  // ---- builders -----------------------------------------------------------
  function paint(mesh, colour) {
    const c = B.Color3.FromHexString(colour);
    const n = mesh.getTotalVertices();
    const rgba = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      rgba[i * 4] = c.r; rgba[i * 4 + 1] = c.g; rgba[i * 4 + 2] = c.b; rgba[i * 4 + 3] = 1;
    }
    mesh.setVerticesData(B.VertexBuffer.ColorKind, rgba, false);
    // No textures anywhere here: UVs would only stop the merge.
    mesh.removeVerticesData(B.VertexBuffer.UVKind);
  }
  /** A still mesh: matte when `look` is a hex string, neon when it is a material. */
  function still(mesh, look, solid = false) {
    if (typeof look === 'string') { paint(mesh, look); mesh.material = matte; } else mesh.material = look;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.freezeWorldMatrix();
    statics.push(mesh);
    if (solid) {
      const { minimumWorld: lo, maximumWorld: hi } = mesh.getBoundingInfo().boundingBox;
      blockers.push({ x: (lo.x + hi.x) / 2, z: (lo.z + hi.z) / 2, hx: (hi.x - lo.x) / 2,
        hz: (hi.z - lo.z) / 2, base: floor, top: hi.y });
    }
    return mesh;
  }
  function box(name, x, y, z, width, height, depth, look, yaw = 0, solid = false) {
    const mesh = B.MeshBuilder.CreateBox(`Geometry Pong ${name}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    return still(mesh, look, solid);
  }
  function prism(name, x, y, z, top, bottom, height, sides, turn, look) {
    const mesh = B.MeshBuilder.CreateCylinder(`Geometry Pong ${name}`,
      { diameterTop: top, diameterBottom: bottom, height, tessellation: sides }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
    return still(mesh, look);
  }
  /** Babylon turns local +x to (cos ry, −sin ry); a strip along a side at
   * outward angle φ wants +x along the tangent (−sin φ, cos φ). */
  const along = (phi) => -phi - Math.PI / 2;

  // ---- the slab -----------------------------------------------------------
  box('slab', cx, floor - .25, cz, W, .5, D, SLAB);
  // Just under the top, so it shows as a band round the sides and never
  // shares a plane with the deck.
  box('rim', cx, floor - .05, cz, W + .06, .08, D + .06, TRIM);
  // A pale line round the slab's sides: what you see of it from the hub.
  box('slab line', cx, floor - .3, cz - D / 2 - .005, W - .4, .05, .02, iceMat);
  box('slab line', cx, floor - .3, cz + D / 2 + .005, W - .4, .05, .02, iceMat);
  box('slab line', cx - W / 2 - .005, floor - .3, cz, .02, .05, D - .4, iceMat);
  box('slab line', cx + W / 2 + .005, floor - .3, cz, .02, .05, D - .4, iceMat);
  // The keel: the arena's hexagon again, tapering away underneath.
  prism('keel', HX, floor - 1.3, HZ, 2 * R * .92, 2 * R * .42, 1.6, 6, 0, KEEL);
  prism('keel ring', HX, floor - .52, HZ, 2 * R * .93, 2 * R * .93, .05, 6, 0, iceMat);

  // ---- the arena ----------------------------------------------------------
  prism('arena floor', HX, floor + .003, HZ, 2 * R + .1, 2 * R + .1, .02, 6, 0, FLOOR);
  // Two faint echoes, the inner one turned half a side, as the game's
  // background counter-rotates (still here: it is a floor, not a screen).
  for (const [r, turn] of [[R * .62, 0], [R * .3, Math.PI / 6]]) {
    const a = r * Math.sqrt(3) / 2;
    for (let k = 0; k < 6; k++) {
      const phi = (k + .5) * Math.PI / 3 + turn;
      box('echo', HX + a * Math.cos(phi), floor + .02, HZ + a * Math.sin(phi), r, .006, .035, ECHO, along(phi));
    }
  }
  // Each side's edge in its player's neon, a bumper at every corner, and the
  // player's glyph on the deck just outside.
  for (let k = 0; k < 6; k++) {
    const phi = (k + .5) * Math.PI / 3;
    const ox = Math.cos(phi), oz = Math.sin(phi);
    box('edge', HX + APOTHEM * ox, floor + .03, HZ + APOTHEM * oz, R - .36, .045, .07, sideMat(k), along(phi));
    const corner = k * Math.PI / 3;
    prism('bumper', HX + R * Math.cos(corner), floor + .06, HZ + R * Math.sin(corner), .28, .28, .1, 16, 0, iceMat);
    const [sides, turn] = GLYPH[SIDE_COLOUR[k]];
    // A cylinder's corner 0 is +x; turn the glyph so it sits square to its side.
    prism('glyph', HX + (APOTHEM + .62) * ox, floor + .012, HZ + (APOTHEM + .62) * oz,
      .46, .46, .02, sides, -phi + turn, sideMat(k));
  }

  // ---- the name-board mast --------------------------------------------------
  if (mast) box('sign mast', mast.x, floor + mast.top / 2, mast.z, .16, mast.top, .16, MAST, 0, true);

  // ---- what moves -----------------------------------------------------------
  // Per side: outward normal (ox, oz), tangent (tx, tz), paddle place `s`.
  const OX = new Float64Array(6), OZ = new Float64Array(6);
  const paddleS = new Float64Array(6), sealed = new Float64Array(6);
  const paddles = [];
  for (let k = 0; k < 6; k++) {
    const phi = (k + .5) * Math.PI / 3;
    OX[k] = Math.cos(phi); OZ[k] = Math.sin(phi);
    const p = B.MeshBuilder.CreateBox('Geometry Pong paddle',
      { width: PADDLE_LEN, height: .14, depth: PADDLE_DEPTH }, scene);
    p.rotation.y = along(phi);
    p.material = sideMat(k);
    p.isPickable = false;
    paddles.push(p);
  }
  // A side's tangent is (−oz, ox). Which way round that runs does not matter
  // to anything here; it only has to be the same everywhere it is used.
  const TX = (k) => -OZ[k], TZ = (k) => OX[k];

  /** A ball: position and velocity in arena-local metres, who touched it last,
   * which side it is heading for and where along it (for the paddles to chase),
   * and the offset its target paddle will try to meet it at. */
  const balls = [0, 1].map((i) => {
    const mesh = B.MeshBuilder.CreateSphere('Geometry Pong ball', { diameter: 2 * BALL_R, segments: 8 }, scene);
    mesh.material = iceMat;
    mesh.isPickable = false;
    return { mesh, x: 0, z: 0, vx: 0, vz: 0, speed: SERVE_SPEED, last: -1, side: -1, hitS: 0, eta: 0,
      aim: 0, missed: false, wait: SERVE_WAIT * (1 + 1.6 * i) };
  });

  /** Two halves per barrier, two barriers: enough for both balls scoring at once.
   *
   * WARMED, NOT HIDDEN. A mesh's first frame on screen costs its effect and
   * glow-pass setup, and built switched off that first frame was the first
   * goal: a 150 ms hitch on the bench, the one moment worth seeing. So the
   * halves start switched ON, a centimetre long inside the slab where nothing
   * can see them, and animate() switches them off once the court has been
   * drawn a couple of times. */
  const barriers = [0, 1].map(() => ({
    side: -1, age: 0,
    halves: [0, 1].map(() => {
      const m = B.MeshBuilder.CreateBox('Geometry Pong seal', { width: 1, height: .3, depth: .06 }, scene);
      m.isPickable = false;
      m.material = iceMat;
      m.position.set(HX, floor - .25, HZ);
      m.scaling.set(.01, .01, .01);
      return m;
    }),
  }));
  let warm = 0;
  const HALF = PADDLE_LINE / Math.sqrt(3); // half a side, measured at the paddle line

  /** Which side the ball will reach, when, and where along it. */
  function predict(b) {
    let best = Infinity, side = -1;
    for (let k = 0; k < 6; k++) {
      const den = b.vx * OX[k] + b.vz * OZ[k];
      if (den <= 1e-6) continue;
      const t = (PLANE - (b.x * OX[k] + b.z * OZ[k])) / den;
      if (t >= 0 && t < best) { best = t; side = k; }
    }
    b.side = side;
    b.eta = best;
    if (side < 0) return;
    const hx = b.x + b.vx * best, hz = b.z + b.vz * best;
    b.hitS = hx * TX(side) + hz * TZ(side);
    // Mostly meet it somewhere on the paddle, so the angles vary; now and then
    // arrive a paddle's width off, which is how a goal happens.
    b.aim = Math.random() < .88 ? (Math.random() * 2 - 1) * .7 * PADDLE_LEN / 2
      : (Math.random() < .5 ? -1 : 1) * (PADDLE_LEN / 2 + BALL_R + .35);
  }

  function serve(b) {
    // At any side that is open; if all six are sealed, at any side at all.
    let k = Math.floor(Math.random() * 6);
    for (let n = 0; n < 6; n++) if (!(sealed[(k + n) % 6] > 0)) { k = (k + n) % 6; break; }
    const phi = (k + .5) * Math.PI / 3 + (Math.random() - .5) * .7;
    b.x = 0; b.z = 0;
    b.speed = SERVE_SPEED;
    b.vx = Math.cos(phi) * b.speed; b.vz = Math.sin(phi) * b.speed;
    b.last = -1;
    b.missed = false;
    b.mesh.material = iceMat;
    b.mesh.setEnabled(true);
    predict(b);
  }

  function seal(side, scorer) {
    sealed[side] = SEAL;
    const bar = barriers[0].side < 0 ? barriers[0] : barriers[1];
    bar.side = side;
    bar.age = 0;
    const mat = scorer >= 0 && scorer !== side ? sideMat(scorer) : iceMat;
    for (const h of bar.halves) {
      h.material = mat;
      h.rotation.y = along((side + .5) * Math.PI / 3);
      h.setEnabled(true);
    }
  }

  function goal(b, side) {
    seal(side, b.last);
    b.mesh.setEnabled(false);
    b.side = -1;
    b.wait = SERVE_WAIT;
  }

  function step(b, dt) {
    if (b.wait > 0) {
      b.wait -= dt;
      if (b.wait <= 0) serve(b);
      return;
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.eta -= dt;
    for (let k = 0; k < 6; k++) {
      const d = b.x * OX[k] + b.z * OZ[k];
      if (d > GOAL) { goal(b, k); return; }
      if (b.missed || d <= PLANE || b.vx * OX[k] + b.vz * OZ[k] <= 0) continue;
      if (sealed[k] > 0) {
        // A wall for now: a mirror bounce, and it keeps its colour.
        const dot = b.vx * OX[k] + b.vz * OZ[k];
        b.vx -= 2 * dot * OX[k]; b.vz -= 2 * dot * OZ[k];
      } else {
        const off = b.x * TX(k) + b.z * TZ(k) - paddleS[k];
        if (Math.abs(off) > PADDLE_LEN / 2 + BALL_R) { b.missed = true; continue; }
        // Classic Pong: where it hits decides where it goes.
        const u = Math.max(-1, Math.min(1, off / (PADDLE_LEN / 2)));
        const a = u * MAX_ANGLE, c = Math.cos(a), s = Math.sin(a);
        b.speed = Math.min(TOP_SPEED, b.speed * RAMP);
        b.vx = (-OX[k] * c + TX(k) * s) * b.speed;
        b.vz = (-OZ[k] * c + TZ(k) * s) * b.speed;
        b.last = k;
        b.mesh.material = sideMat(k);
      }
      b.x -= (d - PLANE) * OX[k]; b.z -= (d - PLANE) * OZ[k];
      predict(b);
      break;
    }
  }

  function pose() {
    const y = floor + .08;
    for (let k = 0; k < 6; k++) {
      paddles[k].position.set(HX + PADDLE_LINE * OX[k] + paddleS[k] * TX(k), y,
        HZ + PADDLE_LINE * OZ[k] + paddleS[k] * TZ(k));
    }
    for (const b of balls) if (b.wait <= 0) b.mesh.position.set(HX + b.x, floor + .02 + BALL_R, HZ + b.z);
  }

  let clock = 0;
  const seen = watch(scene, [island.x[0], floor - 2.2, island.z[0]], [island.x[1], floor + 1, island.z[1]],
    { range: FAR });

  function animate(dt) {
    if (dt > 0 && !seen()) return;
    if (warm < 3 && dt > 0 && ++warm === 3) {
      for (const bar of barriers) if (bar.side < 0) for (const h of bar.halves) h.setEnabled(false);
    }
    dt = Math.min(dt, .05);
    clock += dt;
    for (const b of balls) step(b, dt);
    // Each paddle chases the ball due at its side soonest, else drifts home.
    for (let k = 0; k < 6; k++) {
      let target = 0, soonest = Infinity;
      for (const b of balls) {
        if (b.wait > 0 || b.side !== k || b.missed || b.eta >= soonest) continue;
        soonest = b.eta;
        target = b.hitS - b.aim;
      }
      if (soonest === Infinity) target = paddleS[k] * .97;
      target = Math.max(-REACH, Math.min(REACH, target));
      const move = PADDLE_SPEED * dt;
      paddleS[k] += Math.max(-move, Math.min(move, target - paddleS[k]));
      if (sealed[k] > 0) sealed[k] -= dt;
    }
    // The seals: in from both corners, a hum, then open from the middle out.
    for (const bar of barriers) {
      if (bar.side < 0) continue;
      bar.age += dt;
      const f = bar.age < .14 ? bar.age / .14 : bar.age > SEAL - .45 ? Math.max(0, (SEAL - bar.age) / .45) : 1;
      const k = bar.side;
      const hum = 1 + .18 * Math.sin(clock * 38);
      for (let h = 0; h < 2; h++) {
        const m = bar.halves[h];
        if (f <= 0) { m.setEnabled(false); continue; }
        const sign = h ? 1 : -1;               // which corner this half grows from
        const s = sign * (HALF - HALF * f / 2);
        m.position.set(HX + PADDLE_LINE * OX[k] + s * TX(k), floor + .16, HZ + PADDLE_LINE * OZ[k] + s * TZ(k));
        m.scaling.set(HALF * f, hum, 1);
      }
      if (f <= 0) bar.side = -1;
    }
    pose();
  }
  animate(0);
  // Nothing about a material changes after this; a ball's colour is which
  // material it wears, not what the material holds.
  for (const mat of [matte, iceMat, ...playerMats]) mat.freeze();
  return { blockers, statics, animate };
}
