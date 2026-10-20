/* =============================================================================
 * heist.js — the night bank: HEIST's island, built in code.
 *
 * HEIST is a comic book at night — navy and mustard, cream paper, ink, and
 * siren red and blue arriving with the police (heist/js/art.js) — so the
 * island is one city block of that book, cut out and floated: a navy street
 * running all the way round, a mustard centre line and a cream crossing, and
 * in the middle a little stone bank. Columns, a mustard frieze, a gold coin in
 * the pediment (a bank is "columns and a coin" in the game, which puts no
 * words in its pictures, so neither does this), and between the columns a
 * giant round vault door that is the game's own icon: a steel rim, a cream
 * face ticked like a clock, a brass dial in the middle and the red index
 * mark above it. The windows either side are lit, with laser beams crossed in
 * front of them. Up on the roof the thief from the game — beanie, domino
 * mask, striped shirt, swag bag over his shoulder — stands by a skylight with
 * his rope already down it. Under the block, a band of brick and a tapered
 * keel of night-coloured rock.
 *
 * WHAT MOVES. Two things, both the game's own beats.
 *   - The vault: now and then the dial is worked through a combination —
 *     right, left, right, one click-stop at a time — and on the third number
 *     the door swings open on its hinge to show the gold glowing behind it,
 *     holds a moment, and swings shut. Then it rests for a while.
 *   - The police car, navy with cream doors as in the game, circling the
 *     block on the street with its light bar flashing red and blue four times
 *     a second, the same rhythm as the game's police meter.
 *
 * COST (PERFORMANCE.md, CLAUDE.md §5). The ratified shape for an island:
 * flat colour by vertex, one material per glow colour.
 *   - Everything still is returned in `statics` for room.js to merge: street,
 *     kerbs, bank, columns, thief, lamp posts, keel and mast are ONE
 *     vertex-coloured matte material; the lit parts are one emissive material
 *     per glow colour — window gold, lamp cream, laser red — plus siren blue,
 *     which only the car wears.
 *   - The moving parts are folded rigid groups (moving.js foldRigid): the door
 *     is one mesh, the dial one, the car's body one, its headlights one, and
 *     its two lamps one each, because a lamp's flash is a material swap — a
 *     pointer write between its colour and the one unlit lens material, never
 *     a new material.
 *   - animate() allocates nothing: every pose is a number written into a
 *     position or rotation that already exists. It does nothing at all while
 *     the block is out of view or beyond FAR metres (moving.js); the car and
 *     the dial wait where they are and carry on from there.
 *   - Nothing here casts a shadow, nothing is a thin instance, nothing is
 *     built hidden for later: the gold behind the door is always there, and
 *     simply covered while the door is shut.
 *
 * Coordinates: the bank faces the welcome cloud, which for an island west of
 * it is +x. Everything below is laid out in block-local (u, v) = (x − cx,
 * z − cz), so +u is "toward the hub" and the facade sits at u = FACADE. A slot
 * at yaw 0 faces +z, as in room.js.
 * ========================================================================== */

import { FAR, watch, foldRigid } from './moving.js';

/* The game's palette (heist/js/art.js PAL), the parts this island uses. A few
 * are taken a shade darker than the game's, because the sky's light is a 1.0
 * hemisphere plus a 1.15 sun (room.js SKY_LOOK) and a flat colour that reads
 * right on a phone screen reads pale under it. Noted where so. */
const INK = '#141625', NAVY = '#1c2a5e', NAVY_LO = '#141d45', MUSTARD = '#f4b63d',
  CREAM = '#fbe9c0', STEEL = '#a9b6c8', STEEL_DK = '#5f6c82', STEEL_HI = '#e4ebf3',
  BRASS = '#d9a43a', BRASS_DK = '#9a6d1c', SKIN = '#f1c39b', BURLAP = '#c99b5a',
  PAPER = '#fff6e0', BRICK = '#6b3440', GLASS = '#8fb3d9', RED_DK = '#a31f2a';
/** The thief's own (art.js "the thief"). */
const BEANIE = '#23264a', PANTS = '#262d55';
/** Street and stone, darker than the game's paper so they hold their colour. */
const ASPHALT = '#151d40', PAVE = '#3b4a7c', STONE = '#d8c69a', WALL = '#b9a57c',
  PLINTH = '#8d7c5c', ROCK = '#10163a';
/** The glow colours: lit window gold, lamp cream, siren red and blue, and the
 * game's mustard for the loot itself — the coin and the bars in the vault.
 * The loot is deliberately the deeper of the two golds: a broad emissive face
 * in the paler one blooms to white under the glow layer (room.js
 * BROAD_EMISSIVE), and gold that reads as white reads as a light, not a hoard. */
const GOLD = '#ffd76a', LAMP = '#fbe9c0', RED = '#e5373d', BLUE = '#2f7fe5', LOOT = '#e7a52c';

const HALF = 7;                 // the block is 14 m square
const KERB_OUT = 6.4;           // outer pavement: HALF − 0.6
const KERB_IN = 4.8;            // the block's own pavement starts here
const LANE = 5.6;               // the car's line, halfway across the street
const TURN = 1.2;               // and the radius it takes the corners at
const STRAIGHT = LANE - TURN;
const LAP = 8 * STRAIGHT + 2 * Math.PI * TURN;
const CAR_SPEED = 2.1;          // m/s: a patrol, not a chase

/* The bank, in block-local metres. */
const BACK = -4.0, FACADE = -0.2, WING = 3.5;  // u of back and front walls, v half-width
const STEP_TOP = .46;           // top of the steps above the deck
const DOOR_R = 1.12, DOOR_T = .28;
const DOOR_Y = STEP_TOP + 1.25; // the door's centre above the deck
const OPEN = 75 * Math.PI / 180;

/* The combination: a click is one of the dial's forty numbers. */
const CLICK = 2 * Math.PI / 40;
const CLICK_TIME = .1;          // a snap and a settle per number
const SNAP = .045;              // of which this long is the snap

export function createHeistIsland(scene, island, { mast } = {}) {
  const B = BABYLON;
  const floor = island.y;
  const cx = (island.x[0] + island.x[1]) / 2, cz = (island.z[0] + island.z[1]) / 2;
  const blockers = [];
  const statics = [];

  // ---- materials ----------------------------------------------------------
  const matte = new B.StandardMaterial('Heist matte', scene);
  matte.diffuseColor = new B.Color3(1, 1, 1); // the vertex colour carries it
  matte.specularColor = new B.Color3(.05, .05, .07);
  function glow(name, colour) {
    const mat = new B.StandardMaterial(`Heist ${name}`, scene);
    mat.disableLighting = true;
    mat.diffuseColor = B.Color3.Black();
    mat.specularColor = B.Color3.Black();
    mat.emissiveColor = B.Color3.FromHexString(colour);
    return mat;
  }
  const goldMat = glow('window gold', GOLD);
  const lootMat = glow('loot mustard', LOOT);
  const lampMat = glow('lamp cream', LAMP);
  const redMat = glow('laser red', RED);
  const blueMat = glow('siren blue', BLUE);
  // A lamp that is not lit: dark glass, no emission, so the glow pass skips it.
  const lensMat = new B.StandardMaterial('Heist unlit lens', scene);
  lensMat.diffuseColor = B.Color3.FromHexString(NAVY_LO);
  lensMat.specularColor = new B.Color3(.3, .3, .35);

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
  /** A still mesh: matte when `look` is a hex string, glowing when it is a material. */
  function still(mesh, look) {
    if (typeof look === 'string') { paint(mesh, look); mesh.material = matte; } else mesh.material = look;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.freezeWorldMatrix();
    statics.push(mesh);
    return mesh;
  }
  /** A blocker over a block-local box, standing on the deck. */
  function solid(u0, u1, v0, v1, top) {
    blockers.push({ x: cx + (u0 + u1) / 2, z: cz + (v0 + v1) / 2, hx: (u1 - u0) / 2, hz: (v1 - v0) / 2,
      base: floor, top: floor + top });
  }
  // Raw shapes at block-local (u, y above the deck, v). They come back unpainted
  // so the same builders serve the still parts and the moving ones.
  function boxAt(name, u, y, v, du, dy, dv) {
    const mesh = B.MeshBuilder.CreateBox(`Heist ${name}`, { width: du, height: dy, depth: dv }, scene);
    mesh.position.set(cx + u, floor + y, cz + v);
    return mesh;
  }
  function cylAt(name, u, y, v, d, h, sides = 16, d2 = d) {
    const mesh = B.MeshBuilder.CreateCylinder(`Heist ${name}`,
      { diameterTop: d, diameterBottom: d2, height: h, tessellation: sides }, scene);
    mesh.position.set(cx + u, floor + y, cz + v);
    return mesh;
  }
  /** A disc facing +u (the hub): a cylinder laid on its side. */
  function discAt(name, u, y, v, d, h, sides = 24) {
    const mesh = cylAt(name, u, y, v, d, h, sides);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  }
  function ballAt(name, u, y, v, d, segments = 8) {
    const mesh = B.MeshBuilder.CreateSphere(`Heist ${name}`, { diameter: d, segments }, scene);
    mesh.position.set(cx + u, floor + y, cz + v);
    return mesh;
  }
  const box = (name, u, y, v, du, dy, dv, look) => still(boxAt(name, u, y, v, du, dy, dv), look);
  const cyl = (name, u, y, v, d, h, look, sides, d2) => still(cylAt(name, u, y, v, d, h, sides, d2), look);
  const disc = (name, u, y, v, d, h, look, sides) => still(discAt(name, u, y, v, d, h, sides), look);
  const ball = (name, u, y, v, d, look) => still(ballAt(name, u, y, v, d), look);

  /**
   * The pediment: a triangular prism, built by hand because nothing in
   * MeshBuilder is one without CSG. Its triangle stands in the v–y plane,
   * `span` wide and `rise` tall from `y`, and runs u0..u1 deep. Every face has
   * its own vertices, so the normals are flat and it shades like the boxes.
   */
  function pediment(u0, u1, y, span, rise, colour) {
    const h = span / 2;
    // Corners: front-left, front-right, front-apex, then the same at the back.
    const P = [[u1, y, -h], [u1, y, h], [u1, y + rise, 0], [u0, y, -h], [u0, y, h], [u0, y + rise, 0]];
    const faces = [[0, 2, 1], [3, 4, 5], [0, 3, 5, 2], [1, 2, 5, 4], [0, 1, 4, 3]];
    const positions = [], indices = [];
    for (const f of faces) {
      const at = positions.length / 3;
      for (const i of f) positions.push(cx + P[i][0], floor + P[i][1], cz + P[i][2]);
      indices.push(at, at + 1, at + 2);
      if (f.length === 4) indices.push(at, at + 2, at + 3);
    }
    // Which way round a face is wound decides which side is its front, and
    // ComputeNormals agrees with MeshBuilder about that. So rather than reason
    // about handedness, wind every face so its computed normal points away
    // from the prism's middle — the same outside a box has.
    const mu = cx + (u0 + u1) / 2, my = floor + y + rise / 3, mv = cz;
    let normals = [];
    B.VertexData.ComputeNormals(positions, indices, normals);
    for (let t = 0; t < indices.length; t += 3) {
      const i = indices[t] * 3;
      const out = (positions[i] - mu) * normals[i] + (positions[i + 1] - my) * normals[i + 1] +
        (positions[i + 2] - mv) * normals[i + 2];
      if (out < 0) [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]];
    }
    normals = [];
    B.VertexData.ComputeNormals(positions, indices, normals);
    const data = new B.VertexData();
    data.positions = positions; data.indices = indices; data.normals = normals;
    const mesh = new B.Mesh('Heist pediment', scene);
    data.applyToMesh(mesh);
    return still(mesh, colour);
  }

  // ---- the block ----------------------------------------------------------
  // The deck is the street itself: navy asphalt, edge to edge.
  box('street', 0, -.25, 0, 2 * HALF, .5, 2 * HALF, ASPHALT);
  // A band of brick under it, as if the block had been lifted out whole.
  box('brick', 0, -.7, 0, 2 * HALF - .2, .4, 2 * HALF - .2, BRICK);
  // And a keel of night-coloured rock, a tapered square under that.
  const keel = cylAt('keel', 0, -1.7, 0, (2 * HALF - .4) * Math.SQRT2, 1.6, 4, 2.4 * Math.SQRT2);
  keel.rotation.y = Math.PI / 4; // a four-sided cylinder stands on a corner
  still(keel, ROCK);

  // The outer pavement, round the edge, and the block's own in the middle,
  // each with a cream kerb line at its street edge so the road reads as a road.
  for (const s of [-1, 1]) {
    box('pavement', s * (HALF + KERB_OUT) / 2, .05, 0, HALF - KERB_OUT, .1, 2 * HALF, PAVE);
    box('pavement', 0, .05, s * (HALF + KERB_OUT) / 2, 2 * KERB_OUT, .1, HALF - KERB_OUT, PAVE);
    box('kerb', s * (KERB_OUT + .02), .055, 0, .05, .11, 2 * KERB_OUT, CREAM);
    box('kerb', 0, .055, s * (KERB_OUT + .02), 2 * KERB_OUT, .11, .05, CREAM);
    box('kerb', s * (KERB_IN - .02), .055, 0, .05, .11, 2 * KERB_IN, CREAM);
    box('kerb', 0, .055, s * (KERB_IN - .02), 2 * KERB_IN, .11, .05, CREAM);
  }
  box('block', 0, .05, 0, 2 * KERB_IN, .1, 2 * KERB_IN, PAVE);
  // The mustard centre line, dashed, along every straight; the front street
  // has a cream crossing instead where you walk in from the hub.
  const CROSS = [-2.5, -.3];    // v range of the crossing, lined up with the cabinet
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, nu = Math.round(Math.cos(a)), nv = Math.round(Math.sin(a));
    for (let s = -STRAIGHT + .25; s <= STRAIGHT - .2; s += 1) {
      const u = nu * LANE - nv * s, v = nv * LANE + nu * s;
      if (k === 0 && v > CROSS[0] - .3 && v < CROSS[1] + .3) continue;
      box('dash', u, .006, v, nu ? .08 : .5, .012, nu ? .5 : .08, MUSTARD);
    }
  }
  for (let v = CROSS[0] + .2; v < CROSS[1]; v += .45) box('crossing', LANE, .006, v, 1.4, .012, .24, CREAM);

  // A fire hydrant on the front pavement and two manholes in the street:
  // enough that the block reads as a street and not a car park.
  cyl('hydrant', HALF - .3, .1 + .2, 3.4, .2, .4, '#c7303a', 10);
  ball('hydrant cap', HALF - .3, .1 + .42, 3.4, .2, '#c7303a');
  disc('hydrant nozzle', HALF - .3, .1 + .28, 3.4, .1, .34, STEEL_DK, 8);
  solid(HALF - .42, HALF - .18, 3.28, 3.52, .55);
  for (const [u, v] of [[LANE, 2.4], [-1.6, -LANE]]) cyl('manhole', u, .004, v, .7, .008, STEEL_DK, 16);

  // Street lamps on the block's four corners: an ink post and a cream globe.
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const u = su * (KERB_IN - .35), v = sv * (KERB_IN - .35);
    cyl('lamp post', u, .1 + 1.1, v, .08, 2.2, INK, 8);
    box('lamp foot', u, .18, v, .2, .16, .2, INK);
    ball('lamp globe', u, 2.42, v, .32, lampMat);
    cyl('lamp cap', u, 2.6, v, .26, .06, INK, 8, .12);
    solid(u - .12, u + .12, v - .12, v + .12, 2.6);
  }

  // ---- the bank -----------------------------------------------------------
  const BASE = .1;              // the block's pavement top
  const TOP = BASE + 3.3;       // the walls' top
  const mid = (BACK + FACADE) / 2, deep = FACADE - BACK;
  box('plinth', mid, BASE + .15, 0, deep + .12, .3, 2 * WING + .12, PLINTH);
  box('walls', mid, BASE + 1.65, 0, deep, 3.3, 2 * WING, WALL);
  box('cornice', mid + .05, TOP + .07, 0, deep + .3, .14, 2 * WING + .2, STONE);
  box('roof', mid, TOP + .17, 0, deep - .1, .08, 2 * WING - .1, NAVY);
  // Three steps the width of the front, up to the door.
  [[1.0, .12], [.7, .24], [.4, .36]].forEach(([front, h]) =>
    box('step', (FACADE + front) / 2, BASE + h / 2, 0, front - FACADE, h, 2 * WING, STONE));
  // Four columns standing on the top step, carrying the mustard frieze.
  const COL_U = .18, COL_V = [1.95, 3.1];
  const FRIEZE = 3.2;            // clear of the vault frame and its index mark
  for (const s of [-1, 1]) for (const cv of COL_V) {
    const v = s * cv, h = FRIEZE - STEP_TOP - .24;
    box('column base', COL_U, STEP_TOP + .06, v, .44, .12, .44, STONE);
    cyl('column', COL_U, STEP_TOP + .12 + h / 2, v, .32, h, STONE, 12, .36);
    box('column head', COL_U, FRIEZE - .06, v, .46, .12, .46, STONE);
  }
  box('frieze', (FACADE + .5) / 2, FRIEZE + .17, 0, .5 - FACADE, .34, 2 * WING + .2, MUSTARD);
  box('frieze lip', (FACADE + .54) / 2, FRIEZE + .37, 0, .54 - FACADE, .06, 2 * WING + .3, STONE);
  pediment(FACADE, .5, FRIEZE + .4, 2 * WING + .2, 1.0, STONE);
  // The coin in the pediment: the game's bank, with no word on it.
  disc('coin', .52, FRIEZE + .78, 0, .6, .04, lootMat, 24);
  const rim = B.MeshBuilder.CreateTorus('Heist coin rim', { diameter: .62, thickness: .05, tessellation: 24 }, scene);
  rim.position.set(cx + .54, floor + FRIEZE + .78, cz);
  rim.rotation.z = Math.PI / 2;
  still(rim, INK);

  // Lit windows: one in each bay between the columns and two down each side,
  // every one with two laser beams crossed in front of it.
  const WIN_Y = STEP_TOP + 1.2;
  function windowAt(u, v, facing) {
    // facing 'u' for the facade, 'v' for a side wall (sign gives which side).
    const s = Math.sign(facing === 'u' ? 1 : v);
    const across = facing === 'u';
    const at = (o) => (across ? [u + o * s, v] : [u, v + o * s]);
    const [fu, fv] = at(.005);
    box('window frame', fu, WIN_Y, fv, across ? .02 : .72, 1.46, across ? .72 : .02, INK);
    const [gu, gv] = at(.02);
    box('window', gu, WIN_Y, gv, across ? .02 : .56, 1.3, across ? .56 : .02, goldMat);
    const [mu, mv] = at(.035);
    box('mullion', mu, WIN_Y, mv, across ? .02 : .04, 1.3, across ? .04 : .02, INK);
    box('transom', mu, WIN_Y + .2, mv, across ? .02 : .56, .04, across ? .56 : .02, INK);
    const [lu, lv] = at(.09);
    for (const tilt of [-1, 1]) {
      const beam = boxAt('laser', lu, WIN_Y, lv, .025, 1.5, .025);
      // Lean the beam across the window: about the wall's normal.
      if (across) beam.rotation.x = tilt * .36; else beam.rotation.z = tilt * .36;
      still(beam, redMat);
    }
    // The emitters the beams run between, top and bottom.
    for (const dy of [-.78, .78]) {
      const [eu, ev] = at(.06);
      box('emitter', eu, WIN_Y + dy, ev, across ? .06 : .7, .06, across ? .7 : .06, STEEL_DK);
    }
  }
  for (const s of [-1, 1]) {
    windowAt(FACADE, s * (COL_V[0] + COL_V[1]) / 2, 'u');
    for (const u of [-1.2, -2.9]) windowAt(u, s * WING, 'v');
  }

  // The vault's frame, set into the facade, and the gold behind the door.
  const frame = B.MeshBuilder.CreateTorus('Heist vault frame',
    { diameter: 2 * DOOR_R + .14, thickness: .2, tessellation: 32 }, scene);
  frame.position.set(cx + FACADE + .02, floor + DOOR_Y, cz);
  frame.rotation.z = Math.PI / 2;
  still(frame, STEEL_DK);
  // Behind the door, the vault: dark, and gold bars stacked three, two, one,
  // drawn flat on the back of the opening like a comic panel's background —
  // the door closes to within a few centimetres of them.
  disc('vault dark', FACADE + .008, DOOR_Y, 0, 2 * DOOR_R - .04, .012, NAVY_LO, 32);
  [[3, -.62], [2, -.4], [1, -.18]].forEach(([n, dy]) => {
    for (let i = 0; i < n; i++) {
      box('gold bar', FACADE + .021, DOOR_Y + dy, (i - (n - 1) / 2) * .46, .012, .18, .4, lootMat);
    }
  });
  for (const [dv, dy, d] of [[-.62, -.12, .2], [.6, -.16, .16], [.72, -.02, .13]]) {
    disc('gold coin', FACADE + .021, DOOR_Y + dy, dv, d, .012, lootMat, 12);
  }
  // The red index mark above the door, pointing down at the dial's number.
  const mark = cylAt('index mark', FACADE + .1, DOOR_Y + DOOR_R + .19, 0, .24, .05, 3);
  mark.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  still(mark, redMat);

  // The thief, on the roof by the skylight, facing the hub with his swag —
  // off to one side, where the pediment is low enough to see him over.
  const ROOF = TOP + .21;
  const SKY_U = -2.5, SKY_V = 1.5;
  box('skylight curb', SKY_U, ROOF + .07, SKY_V, 1.2, .14, 1.0, INK);
  box('skylight', SKY_U, ROOF + .145, SKY_V, 1.0, .02, .8, goldMat);
  // Its glass hatch, flung open on the far side.
  const pane = boxAt('skylight pane', SKY_U - .82, ROOF + .32, SKY_V, .05, .64, .84);
  pane.rotation.z = .7;
  still(pane, '#4f6ea6');
  // The rope: coiled beside him, and one length down the open skylight.
  const coil = B.MeshBuilder.CreateTorus('Heist rope coil', { diameter: .36, thickness: .08, tessellation: 16 }, scene);
  coil.position.set(cx - 1.5, floor + ROOF + .04, cz + 1.0);
  still(coil, BURLAP);
  const rope = cylAt('rope', SKY_U + .05, ROOF + .3, SKY_V - .1, .035, 1.2, 6);
  rope.rotation.x = .9;
  still(rope, BURLAP);
  const T_U = -1.25, T_V = 2.3, T_Y = ROOF;
  for (const s of [-1, 1]) {
    box('thief shoe', T_U + .04, T_Y + .04, T_V + s * .09, .22, .08, .12, INK);
    cyl('thief leg', T_U, T_Y + .27, T_V + s * .085, .13, .38, PANTS, 8);
  }
  cyl('thief shirt', T_U, T_Y + .67, T_V, .32, .42, CREAM, 12, .38);
  for (const dy of [.53, .65, .77]) cyl('thief stripe', T_U, T_Y + dy, T_V, .37, .045, NAVY_LO, 12);
  cyl('thief belt', T_U, T_Y + .49, T_V, .39, .05, INK, 12);
  // One arm hanging, one up at his shoulder holding the bag's neck.
  const armDown = cylAt('thief arm', T_U + .02, T_Y + .66, T_V - .22, .1, .34, 8);
  armDown.rotation.x = -.25;
  still(armDown, CREAM);
  ball('thief glove', T_U + .03, T_Y + .48, T_V - .27, .11, INK);
  const armUp = cylAt('thief arm', T_U - .04, T_Y + .87, T_V + .2, .1, .3, 8);
  armUp.rotation.x = -.6;
  still(armUp, CREAM);
  ball('thief glove', T_U - .06, T_Y + 1.0, T_V + .1, .11, INK);
  ball('thief head', T_U, T_Y + 1.06, T_V, .36, SKIN);
  ball('thief nose', T_U + .18, T_Y + 1.02, T_V, .12, SKIN);
  cyl('thief mask', T_U, T_Y + 1.1, T_V, .375, .1, INK, 16);
  for (const s of [-1, 1]) {
    ball('thief eye', T_U + .165, T_Y + 1.11, T_V + s * .075, .09, PAPER);
    ball('thief pupil', T_U + .205, T_Y + 1.11, T_V + s * .07, .045, INK);
  }
  // The mask's two tails, flying out behind.
  for (const [dy, dv] of [[.03, .05], [-.03, -.04]]) {
    const tail = boxAt('thief mask tail', T_U - .25, T_Y + 1.1 + dy, T_V + dv, .18, .05, .02);
    tail.rotation.z = dy * 6;
    still(tail, INK);
  }
  const beanie = ballAt('thief beanie', T_U - .01, T_Y + 1.2, T_V, .37);
  beanie.scaling.y = .62;
  still(beanie, BEANIE);
  cyl('thief beanie band', T_U - .01, T_Y + 1.18, T_V, .38, .06, NAVY, 16);
  // The swag bag over his shoulder: burlap, a tied neck, the game's star patch.
  const bag = ballAt('swag bag', T_U - .2, T_Y + .9, T_V + .3, .46);
  bag.scaling.set(.9, 1.1, .9);
  still(bag, BURLAP);
  cyl('swag bag neck', T_U - .12, T_Y + 1.17, T_V + .22, .12, .08, '#a87a3e', 8);
  disc('swag bag star', T_U - .02, T_Y + .88, T_V + .3, .16, .02, MUSTARD, 5);
  // A second bag, already on the roof edge, ready to lower.
  const bag2 = ballAt('swag bag', -.7, ROOF + .2, -2.6, .42);
  bag2.scaling.set(1, .9, 1);
  still(bag2, BURLAP);
  cyl('swag bag neck', -.7, ROOF + .43, -2.6, .1, .08, '#a87a3e', 8);

  // The building, its steps and its columns, as one solid: the door and the
  // windows are pictures, not ways in.
  solid(BACK - .1, 1.0, -WING - .1, WING + .1, FRIEZE + 1.4);

  // ---- the name-board mast --------------------------------------------------
  if (mast) {
    const m = B.MeshBuilder.CreateBox('Heist sign mast', { width: .16, height: mast.top, depth: .16 }, scene);
    m.position.set(mast.x, floor + mast.top / 2, mast.z);
    still(m, INK);
    blockers.push({ x: mast.x, z: mast.z, hx: .08, hz: .08, base: floor, top: floor + mast.top });
  }

  // ---- what moves: the vault door and its dial ------------------------------
  // The hinge is the door's front edge on the +v side. Opening turns the far
  // edge out toward the hub: Babylon's yaw takes local −z to (−sin θ, −cos θ),
  // so −z → +u wants θ = −90°, and the door opens with a negative yaw.
  const DOOR_FRONT = FACADE + .04 + DOOR_T;
  const hinge = new B.TransformNode('Heist vault hinge', scene);
  hinge.position.set(cx + DOOR_FRONT, floor + DOOR_Y, cz + DOOR_R);
  const doorParts = [];
  const doorColour = new Map();
  const part = (list, colours, mesh, colour) => { mesh.material = matte; colours.set(mesh, B.Color3.FromHexString(colour)); list.push(mesh); return mesh; };
  part(doorParts, doorColour, discAt('vault door', DOOR_FRONT - DOOR_T / 2, DOOR_Y, 0, 2 * DOOR_R, DOOR_T, 32), STEEL);
  part(doorParts, doorColour, discAt('vault face', DOOR_FRONT + .01, DOOR_Y, 0, 1.82, .02, 32), CREAM);
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, long = i % 6 === 0;
    const r = long ? .74 : .79;
    const tick = boxAt('vault tick', DOOR_FRONT + .025, DOOR_Y + r * Math.cos(a), r * Math.sin(a),
      .015, long ? .18 : .1, .035);
    tick.rotation.x = a; // RotationX takes +y to (cos a, sin a) in (y, z): radial
    part(doorParts, doorColour, tick, INK);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) * Math.PI / 4;
    part(doorParts, doorColour, discAt('vault bolt', DOOR_FRONT + .02, DOOR_Y + 1.0 * Math.cos(a), 1.0 * Math.sin(a),
      .1, .05, 8), STEEL_HI);
  }
  for (const dy of [-.62, .62]) {
    part(doorParts, doorColour, boxAt('vault hinge block', DOOR_FRONT - .1, DOOR_Y + dy, DOOR_R - .02, .26, .26, .16), STEEL_DK);
  }
  const door = foldRigid(hinge, doorParts, matte, 'Heist vault door', (m) => doorColour.get(m));

  // The dial turns about the door's own axis, so its pivot rides the hinge.
  const dialPivot = new B.TransformNode('Heist vault dial', scene);
  dialPivot.parent = hinge;
  dialPivot.position.set(0, 0, -DOOR_R);
  const dialParts = [];
  const dialColour = new Map();
  part(dialParts, dialColour, discAt('dial', DOOR_FRONT + .05, DOOR_Y, 0, .62, .06, 32), BRASS);
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10, long = i % 5 === 0;
    const r = long ? .24 : .26;
    const tick = boxAt('dial tick', DOOR_FRONT + .085, DOOR_Y + r * Math.cos(a), r * Math.sin(a),
      .012, long ? .09 : .045, .02);
    tick.rotation.x = a; // RotationX takes +y to (cos a, sin a) in (y, z): radial
    part(dialParts, dialColour, tick, INK);
  }
  part(dialParts, dialColour, discAt('dial knob', DOOR_FRONT + .12, DOOR_Y, 0, .26, .1, 16), BRASS_DK);
  part(dialParts, dialColour, boxAt('dial grip', DOOR_FRONT + .18, DOOR_Y, 0, .04, .3, .07), BRASS_DK);
  const dial = foldRigid(dialPivot, dialParts, matte, 'Heist vault dial', (m) => dialColour.get(m));
  for (const m of [door, dial]) if (m) { m.receiveShadows = true; }

  // ---- what moves: the police car -------------------------------------------
  // Built round its own pivot at the world origin, facing +z, so foldRigid's
  // "keep the world placement" is the car's own local layout.
  const car = new B.TransformNode('Heist police car', scene);
  const carParts = [];
  const carColour = new Map();
  const carBox = (name, x, y, z, w, h, d, colour) => {
    const mesh = B.MeshBuilder.CreateBox(`Heist car ${name}`, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    return part(carParts, carColour, mesh, colour);
  };
  carBox('body', 0, .23, 0, .7, .22, 1.34, NAVY);
  carBox('doors', 0, .22, -.02, .72, .15, .52, CREAM);
  carBox('glass', 0, .42, -.06, .64, .12, .74, GLASS);
  carBox('roof', 0, .5, -.06, .62, .06, .56, CREAM);
  carBox('bar base', 0, .55, -.06, .42, .04, .14, INK);
  carBox('bumper', 0, .17, .68, .66, .08, .04, INK);
  carBox('bumper', 0, .17, -.68, .66, .08, .04, INK);
  for (const s of [-1, 1]) {
    carBox('tail light', s * .25, .27, -.675, .12, .05, .02, RED_DK);
    const star = B.MeshBuilder.CreateCylinder('Heist car star', { diameter: .11, height: .02, tessellation: 5 }, scene);
    star.position.set(s * .362, .23, -.02);
    star.rotation.z = Math.PI / 2;
    part(carParts, carColour, star, MUSTARD);
    for (const z of [-.42, .42]) {
      const wheel = B.MeshBuilder.CreateCylinder('Heist car wheel', { diameter: .26, height: .1, tessellation: 12 }, scene);
      wheel.position.set(s * .32, .13, z);
      wheel.rotation.z = Math.PI / 2;
      part(carParts, carColour, wheel, INK);
    }
  }
  const carBody = foldRigid(car, carParts, matte, 'Heist police car', (m) => carColour.get(m));
  if (carBody) carBody.receiveShadows = true;
  const lights = [-1, 1].map((s) => {
    const m = B.MeshBuilder.CreateBox('Heist car headlight', { width: .13, height: .06, depth: .02 }, scene);
    m.position.set(s * .22, .27, .675);
    return m;
  });
  const headlights = B.Mesh.MergeMeshes(lights, true);
  headlights.name = 'Heist police car headlights';
  headlights.material = lampMat;
  headlights.parent = car;
  /** The light bar: red on the driver's side, blue on the other. */
  const lamps = [[-.1, redMat], [.1, blueMat]].map(([x, mat]) => {
    const m = B.MeshBuilder.CreateBox('Heist car lamp', { width: .17, height: .08, depth: .11 }, scene);
    m.position.set(x, .61, -.06);
    m.material = mat;
    m.parent = car;
    return { mesh: m, lit: mat };
  });
  for (const m of [carBody, headlights, door, dial, ...lamps.map((l) => l.mesh)]) if (m) m.isPickable = false;

  /** Put the car `s` metres round its lap: four straights joined by quarter
   * circles. Side k's outward normal is k·90° in (u, v); along it the car
   * runs at +90°, which takes it round the block anticlockwise from above. */
  function drive(s) {
    s %= LAP;
    const seg = 2 * STRAIGHT + Math.PI * TURN / 2;
    const k = Math.floor(s / seg);
    let x = s - k * seg;
    const a = k * Math.PI / 2;
    const nu = Math.cos(a), nv = Math.sin(a);
    let u, v, tu, tv;
    if (x < 2 * STRAIGHT) {
      tu = -nv; tv = nu;
      u = LANE * nu + (x - STRAIGHT) * tu;
      v = LANE * nv + (x - STRAIGHT) * tv;
    } else {
      x -= 2 * STRAIGHT;
      const phi = a + x / TURN;
      u = STRAIGHT * (nu - nv) + TURN * Math.cos(phi);
      v = STRAIGHT * (nv + nu) + TURN * Math.sin(phi);
      tu = -Math.sin(phi); tv = Math.cos(phi);
    }
    car.position.set(cx + u, floor, cz + v);
    car.rotation.y = Math.atan2(tu, tv);
  }

  // ---- the vault's routine --------------------------------------------------
  // REST → three numbers, each SPIN clicks one way then a beat → the door
  // swings OPEN, HOLDs, CLOSEs → REST. All of it is a handful of numbers.
  const REST = 0, SPIN = 1, BEAT = 2, OPENING = 3, HOLD = 4, CLOSING = 5;
  let phase = REST, timer = 2.5, number = 0, clicks = 0, dir = 1, base = 0;
  const ease = (f) => (f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f));
  function vault(dt) {
    timer -= dt;
    if (phase === SPIN) {
      // A click: snap to the next number fast, then sit on it.
      const done = Math.min(clicks, Math.floor(-timer / CLICK_TIME));
      const f = done >= clicks ? 0 : ease((-timer - done * CLICK_TIME) / SNAP);
      dialPivot.rotation.x = base + dir * CLICK * (done + f);
      if (done >= clicks) {
        base += dir * CLICK * clicks;
        dialPivot.rotation.x = base;
        phase = BEAT;
        timer = number === 2 ? .55 : .35;
      }
      return;
    }
    if (timer > 0) {
      if (phase === OPENING) hinge.rotation.y = -OPEN * ease(1 - timer / 1.3);
      else if (phase === CLOSING) hinge.rotation.y = -OPEN * ease(timer / 1.5);
      return;
    }
    if (phase === REST || phase === BEAT) {
      if (phase === BEAT && number === 2) { phase = OPENING; timer = 1.3; return; }
      number = phase === REST ? 0 : number + 1;
      dir = number % 2 ? -1 : 1;        // right, left, right
      clicks = 5 + Math.floor(Math.random() * 14);
      phase = SPIN;
      timer = 0;
    } else if (phase === OPENING) {
      hinge.rotation.y = -OPEN;
      phase = HOLD; timer = 2.6;
    } else if (phase === HOLD) {
      phase = CLOSING; timer = 1.5;
    } else if (phase === CLOSING) {
      hinge.rotation.y = 0;
      phase = REST; timer = 5 + Math.random() * 6;
    }
  }

  let lap = Math.random() * LAP, clock = 0, flash = -1;
  const seen = watch(scene, [island.x[0], floor - 2.6, island.z[0]], [island.x[1], floor + 5.4, island.z[1]],
    { range: FAR });

  function animate(dt) {
    if (dt > 0 && !seen()) return;
    dt = Math.min(dt, .05);
    clock += dt;
    lap += CAR_SPEED * dt;
    drive(lap);
    // Four flips a second, as the game's own light bar (art.js drawCar).
    const flip = (clock * 4) % 2 < 1 ? 0 : 1;
    if (flip !== flash) {
      flash = flip;
      lamps[0].mesh.material = flip ? lensMat : lamps[0].lit;
      lamps[1].mesh.material = flip ? lamps[1].lit : lensMat;
    }
    vault(dt);
  }
  animate(0);
  // Nothing about a material changes after this; a lamp's flash is which
  // material it wears, not what the material holds.
  for (const mat of [matte, goldMat, lootMat, lampMat, redMat, blueMat, lensMat]) mat.freeze();
  return { blockers, statics, animate };
}
