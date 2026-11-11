/* =============================================================================
 * starswing.js — the star ladder: Starswing's island, built in code.
 *
 * The island IS the climb. Starswing is one button: hold to be tied to a star
 * and swing round it, let go to fly to the next. So over a night-blue deck
 * stands the game's sky turned on its edge to face the welcome cloud: five
 * stars zigzagging up eight metres, one in each of the game's zone colours
 * (ice, violet, rose, amber, aurora — the order you meet them climbing), each
 * with the four-point sparkle the game draws, and the gold stardust that lies
 * between them. Underneath, a tapering round keel, and on the deck a painted
 * nebula in the zones' colours, a ring of light under the ladder and a
 * scatter of small pale stars, so it reads as a piece of night from above.
 *
 * WHAT MOVES. One comet plays the game. It swings round a star on a beam of
 * light, lets go when it is heading for the next one, flies there, is caught,
 * and swings again, its tail taking the colour of the star it last held. Off
 * the top star it lets go the wrong way, as everybody does, and falls back
 * down to the first to start over.
 *
 * COST (PERFORMANCE.md, CLAUDE.md §5). The ratified shape for an island:
 * flat colour by vertex, one material per glow colour.
 *   - Everything still is returned in `statics` for room.js to merge: slab,
 *     rim, keel, mast and the deck's painted nebula are ONE vertex-coloured
 *     matte; the stars, sparkles,
 *     dust and light lines are one emissive material per colour, seven in all.
 *   - The moving parts are the comet, its beam and four tail beads: six
 *     meshes. The tail's colour is a material swap, never a new material.
 *   - animate() allocates nothing: positions are plain numbers in fixed
 *     arrays, every pose a position.set(). It does nothing at all while the
 *     island is out of view or beyond FAR metres (moving.js).
 *   - Nothing here casts a shadow; nothing is a thin instance; nothing
 *     appears on demand, so nothing needs warming.
 *
 * Coordinates: the ladder is a plane of constant x (LX), so a place on it is
 * (z, y). A slot at yaw 0 faces +z, as in room.js.
 * ========================================================================== */

import { FAR, watch } from './moving.js';

/** The game's zone colours (starswing/js/render.js ZONES), bottom star up. */
const ZONES = ['#5ac8ff', '#aa82ff', '#ff6ebe', '#ffbe5a', '#6effaa'];
const ICE = '#e8f2ff';   // sparkles, the comet, the deck's small stars
const GOLD = '#ffd678';  // stardust

/** Each star's place across the ladder (z from its middle) and its height. */
const ACROSS = [-1.7, 1.5, -1.3, 1.7, 0];
const FIRST = 2.7, RISE = 1.35; // clear of a gopher's head, then up
const ORBIT = .62;              // m
const SPEED = 3.3;              // m/s, swinging and flying alike
const BEADS = 4;
const GAP = .045;               // seconds between the tail's remembered places

/**
 * Lighting here is a 1.0 hemisphere plus a 1.15 sun (room.js SKY_LOOK), so a
 * dark deck at true colour reads mid-grey; these are chosen darker than they
 * should look.
 */
const SLAB = '#0b1024', KEEL = '#080b1a', TRIM = '#27305a', MAST = '#1b2133';
/** The deck's nebula: the first three zones' colours, far down toward the night. */
const CLOUDS = ['#12284a', '#221a4c', '#3a1a44'];

export function createStarswingIsland(scene, island, { mast } = {}) {
  const B = BABYLON;
  const floor = island.y;
  const W = island.x[1] - island.x[0];
  const D = island.z[1] - island.z[0];
  const cx = island.x[0] + W / 2, cz = island.z[0] + D / 2;
  // The ladder stands west of the middle, so the east apron has room for the
  // cabinet, its take-home machine and the mast (room.js SLOTS).
  const LX = cx - 1.2;
  const blockers = [];
  const statics = [];

  // ---- materials ----------------------------------------------------------
  const matte = new B.StandardMaterial('Starswing matte', scene);
  matte.diffuseColor = new B.Color3(1, 1, 1); // the vertex colour carries it
  matte.specularColor = new B.Color3(.05, .06, .1);
  function light(name, colour) {
    const mat = new B.StandardMaterial(`Starswing ${name}`, scene);
    mat.disableLighting = true;
    mat.diffuseColor = B.Color3.Black();
    mat.specularColor = B.Color3.Black();
    mat.emissiveColor = B.Color3.FromHexString(colour);
    return mat;
  }
  const zoneMats = ZONES.map((c, i) => light(`zone ${i + 1}`, c));
  const iceMat = light('ice', ICE);
  const goldMat = light('dust', GOLD);

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
  /** A still mesh: matte when `look` is a hex string, a light when it is a material. */
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
  function box(name, x, y, z, width, height, depth, look, solid = false) {
    const mesh = B.MeshBuilder.CreateBox(`Starswing ${name}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    return still(mesh, look, solid);
  }
  function round(name, x, y, z, top, bottom, height, look, sides = 24) {
    const mesh = B.MeshBuilder.CreateCylinder(`Starswing ${name}`,
      { diameterTop: top, diameterBottom: bottom, height, tessellation: sides }, scene);
    mesh.position.set(x, y, z);
    return still(mesh, look);
  }
  function ball(name, x, y, z, diameter, look) {
    const mesh = B.MeshBuilder.CreateSphere(`Starswing ${name}`, { diameter, segments: 8 }, scene);
    mesh.position.set(x, y, z);
    return still(mesh, look);
  }

  // ---- the deck -----------------------------------------------------------
  box('slab', cx, floor - .25, cz, W, .5, D, SLAB);
  // Just under the top, so it shows as a band round the sides and never
  // shares a plane with the deck.
  box('rim', cx, floor - .05, cz, W + .06, .08, D + .06, TRIM);
  // A pale line round the slab's sides: what you see of it from the hub.
  box('slab line', cx, floor - .3, cz - D / 2 - .005, W - .4, .05, .02, iceMat);
  box('slab line', cx, floor - .3, cz + D / 2 + .005, W - .4, .05, .02, iceMat);
  box('slab line', cx - W / 2 - .005, floor - .3, cz, .02, .05, D - .4, iceMat);
  box('slab line', cx + W / 2 + .005, floor - .3, cz, .02, .05, D - .4, iceMat);
  // The keel: round, tapering away underneath, with a ring of the first
  // zone's light where it meets the slab.
  round('keel', cx, floor - 1.5, cz, 9.4, 1.6, 2, KEEL);
  round('keel ring', cx, floor - .52, cz, 9.5, 9.5, .05, zoneMats[0], 32);
  // The nebula: wide flat discs of dim colour, each a hair above the last so
  // none shares a plane. Matte, so they merge into the slab's one draw.
  for (let i = 0; i < 9; i++) {
    const hx = Math.abs(Math.sin(i * 39.3467) * 9631.71) % 1;
    const hz = Math.abs(Math.sin(i * 17.117) * 5417.93) % 1;
    const d = 2.6 + 2.2 * (i % 3);
    round('nebula', island.x[0] + d / 2 + hx * (W - d), floor + .002 + i * .0008,
      island.z[0] + d / 2 + hz * (D - d), d, d, .002, CLOUDS[i % 3], 28);
  }
  // A ring of light on the deck under the ladder: the first swing, drawn.
  const ring = B.MeshBuilder.CreateTorus('Starswing deck ring', { diameter: 4.2, thickness: .05, tessellation: 40 }, scene);
  ring.position.set(LX, floor + .02, cz);
  ring.scaling.y = .2;
  still(ring, zoneMats[0]);
  // Small pale stars laid into the deck. Fixed places (a sine hash), so the
  // island is the same island every visit.
  for (let i = 0; i < 26; i++) {
    const hx = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const hz = Math.abs(Math.sin(i * 78.233) * 12543.123) % 1;
    round('deck star', island.x[0] + .5 + hx * (W - 1), floor + .014, island.z[0] + .5 + hz * (D - 1),
      .07 + .09 * (i % 3), .07 + .09 * (i % 3), .012, iceMat, 8);
  }

  // ---- the ladder ---------------------------------------------------------
  const SZ = new Float64Array(5), SY = new Float64Array(5);
  for (let i = 0; i < 5; i++) {
    SZ[i] = cz + ACROSS[i];
    SY[i] = floor + FIRST + RISE * i;
    ball('star', LX, SY[i], SZ[i], .36, zoneMats[i]);
    // The four-point sparkle: two thin beams through the star.
    box('sparkle', LX, SY[i], SZ[i], .03, .03, 1.3, iceMat);
    box('sparkle', LX, SY[i], SZ[i], .03, 1.3, .03, iceMat);
    // Stardust on the way to the next one, bowed a little off the line.
    if (i < 4) {
      const nz = cz + ACROSS[i + 1], ny = floor + FIRST + RISE * (i + 1);
      for (let k = 1; k <= 3; k++) {
        const f = k / 4;
        ball('dust', LX, SY[i] + (ny - SY[i]) * f + .16 * Math.sin(f * Math.PI),
          SZ[i] + (nz - SZ[i]) * f, .1, goldMat);
      }
    }
  }

  // ---- the name-board mast ------------------------------------------------
  if (mast) box('sign mast', mast.x, floor + mast.top / 2, mast.z, .16, mast.top, .16, MAST, true);

  // ---- what moves ---------------------------------------------------------
  const comet = B.MeshBuilder.CreateSphere('Starswing comet', { diameter: .26, segments: 8 }, scene);
  comet.material = iceMat;
  comet.isPickable = false;
  // The beam: a unit box along local z, stretched to the orbit and turned in
  // the ladder's plane.
  const beam = B.MeshBuilder.CreateBox('Starswing beam', { width: .025, height: .025, depth: 1 }, scene);
  beam.material = zoneMats[0];
  beam.isPickable = false;
  beam.scaling.z = ORBIT;
  const beads = [];
  for (let i = 0; i < BEADS; i++) {
    const m = B.MeshBuilder.CreateSphere('Starswing tail', { diameter: .2 * (1 - i / (BEADS + 1)), segments: 6 }, scene);
    m.material = zoneMats[0];
    m.isPickable = false;
    beads.push(m);
  }
  // Where the comet has been: (z, y) pairs, written round-robin every GAP.
  const TRAIL = BEADS + 1;
  const trail = new Float64Array(TRAIL * 2);
  let trailAt = 0, trailClock = 0;

  // The comet's state, all plain numbers. On a star: `at`, angle `a` (from
  // +z toward +y), which way round, how far it has turned. In flight: a
  // quadratic curve from (z0, y0) past (zc, yc) to (z1, y1), `u` along it.
  let at = 0, a = -Math.PI / 2, dir = 1, turned = 0;
  let flying = false, to = 0, u = 0, span = 1;
  let z0 = 0, y0 = 0, zc = 0, yc = 0, z1 = 0, y1 = 0;
  let pz = SZ[0], py = SY[0] - ORBIT;

  function release(next) {
    // Tangent of the swing at this moment, and a curve that leaves along it.
    const tz = -Math.sin(a) * dir, ty = Math.cos(a) * dir;
    z0 = pz; y0 = py;
    // Arrive on the near side of the next star's orbit.
    const dz = z0 - SZ[next], dy = y0 - SY[next], d = Math.hypot(dz, dy) || 1;
    z1 = SZ[next] + (dz / d) * ORBIT; y1 = SY[next] + (dy / d) * ORBIT;
    const reach = Math.hypot(z1 - z0, y1 - y0);
    zc = z0 + tz * reach * .5; yc = y0 + ty * reach * .5;
    span = Math.max(.35, reach / SPEED);
    to = next; u = 0; flying = true;
    beam.setEnabled(false);
  }

  function capture() {
    // Keep turning the way it arrived: the sign of (arm × velocity).
    const vz = z1 - zc, vy = y1 - yc;
    const rz = z1 - SZ[to], ry = y1 - SY[to];
    dir = rz * vy - ry * vz >= 0 ? 1 : -1;
    a = Math.atan2(ry, rz);
    at = to; turned = 0; flying = false;
    beam.material = zoneMats[at];
    beam.setEnabled(true);
    for (const m of beads) m.material = zoneMats[at];
  }

  function step(dt) {
    if (flying) {
      u += dt / span;
      if (u >= 1) { u = 1; capture(); }
      const v = 1 - u;
      pz = v * v * z0 + 2 * u * v * zc + u * u * z1;
      py = v * v * y0 + 2 * u * v * yc + u * u * y1;
      return;
    }
    const w = (SPEED / ORBIT) * dt;
    a += dir * w;
    turned += w;
    pz = SZ[at] + ORBIT * Math.cos(a);
    py = SY[at] + ORBIT * Math.sin(a);
    if (turned < 1.2 * Math.PI) return;
    // Let go when the swing is heading for the next star up; off the top one,
    // for the first again, which is a long fall.
    const next = (at + 1) % 5;
    const tz = -Math.sin(a) * dir, ty = Math.cos(a) * dir;
    const dz = SZ[next] - pz, dy = SY[next] - py, d = Math.hypot(dz, dy) || 1;
    if ((tz * dz + ty * dy) / d > .93 || turned > 5 * Math.PI) release(next);
  }

  function pose() {
    comet.position.set(LX, py, pz);
    if (!flying) {
      beam.position.set(LX, (SY[at] + py) / 2, (SZ[at] + pz) / 2);
      beam.rotation.x = Math.atan2(-(py - SY[at]), pz - SZ[at]);
    }
    for (let i = 0; i < BEADS; i++) {
      const k = ((trailAt - 1 - i) % TRAIL + TRAIL) % TRAIL;
      beads[i].position.set(LX, trail[k * 2 + 1], trail[k * 2]);
    }
  }

  const seen = watch(scene, [island.x[0], floor - 2.6, island.z[0]],
    [island.x[1], floor + FIRST + RISE * 4 + 1, island.z[1]], { range: FAR });

  function animate(dt) {
    if (dt > 0 && !seen()) return;
    dt = Math.min(dt, .05);
    step(dt);
    trailClock += dt;
    if (trailClock >= GAP) {
      trailClock = 0;
      trail[trailAt * 2] = pz; trail[trailAt * 2 + 1] = py;
      trailAt = (trailAt + 1) % TRAIL;
    }
    pose();
  }
  for (let i = 0; i < TRAIL; i++) { trail[i * 2] = pz; trail[i * 2 + 1] = py; }
  animate(0);
  // Nothing about a material changes after this; the tail's colour is which
  // material it wears, not what the material holds.
  for (const mat of [matte, iceMat, goldMat, ...zoneMats]) mat.freeze();
  return { blockers, statics, animate };
}
