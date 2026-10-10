/* =============================================================================
 * zoodoku.js — the puzzle meadow: Zoodoku's island, built here in code.
 *
 * The island IS the game board. A floating 9×9 sudoku in the game's own cream
 * and teal ink, thick box borders and thin cell lines, standing on a slab of
 * its meadow teal with a sunflower reveal. Zoodoku starts children on a tiny
 * 4×4 board where animals go in the cells instead of numbers, and climbs to
 * the classic 9×9 with digits — so both are here: a 4×4 starter tray laid on
 * the big board's hub-facing corner with the first four animals standing on
 * their cells (a real, valid 4×4, with gaps left to fill), and the 9×9's own
 * givens as chunky number tiles in the animals' colours. A giant pencil has
 * been left along the back row.
 *
 * WHAT MOVES. Nine number blocks, one per digit in the game's animal order and
 * colour, circle the board. Every few seconds the block best placed to go
 * drifts in, settles into an empty cell where that digit genuinely belongs in
 * the board's solution, sits a moment and lifts back into the ring. Targets
 * are held to the western half of the board so no flight path crosses the
 * cabinet, the mast or the animals — the blocks are not blockers, and a block
 * passing through a mast reads as a bug rather than as life.
 *
 * COST. Everything static is returned in `statics` for room.js to fold into a
 * handful of draw calls with mergeStatic, so roughly two hundred little meshes
 * become one per material. The digits are one canvas atlas shared by the
 * tiles and the blocks; the tiles and blocks are one hand-built rounded slab
 * (`slab`) of ~80 triangles, so "chunky rounded tile" costs no CSG and no
 * earcut. The only per-frame work is nine position/rotation writes; nothing
 * is allocated in animate().
 *
 * Coordinates: cell (i, j) is column i along +x and row j along +z, (0, 0) at
 * the hub-facing northwest corner. A slot at yaw 0 faces +z, as in room.js.
 * ========================================================================== */

/** Zoodoku's nine animals, in the game's order: digit d is ANIMALS[d - 1]. */
const ANIMALS = [
  ['fox', '#f28c38'], ['frog', '#5cbf60'], ['whale', '#4a90d9'],
  ['lion', '#f2c230'], ['pig', '#f29bb5'], ['owl', '#9b6fd1'],
  ['bear', '#9a6a44'], ['penguin', '#2b2f3a'], ['crab', '#e0503c'],
];
const CREAM = '#fff6e3';
/** The board's cream, warmed: the sky's light is blue and turns #fff6e3 grey. */
const BOARD = '#ffe8bd';
const INK = '#2e4a48';
const MEADOW = '#1f5f5b';
const SUNFLOWER = '#ffc94a';
const CORAL = '#ff7a59';

/** A solved 9×9, row by row (j), column by column (i). */
const SOLUTION = [
  '534678912', '672195348', '198342567',
  '859761423', '426853791', '713924856',
  '961537284', '287419635', '345286179',
].map((row) => [...row].map(Number));

/** The board's givens, as raised tiles. Kept off the landing corner, the walk
 * from it to the cabinet, the cabinet's own stand and the pencil's row — and
 * off (22.6, 18.0), 2.4 m beside the cabinet, which is where a take-home
 * machine would stand once the game has a manifest (as Lobbots' does). */
const GIVENS = [[2, 0], [4, 2], [0, 2], [0, 5], [2, 5], [1, 7], [3, 7], [8, 5], [8, 4], [6, 8]];

/** The 4×4 starter: a valid solution in the first four animals (0 fox, 1 frog,
 * 2 whale, 3 lion), and which of its cells already hold a figurine. */
const STARTER = [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]];
const STARTER_SHOWN = [[1, 1, 0, 1], [0, 1, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1]];
/** The starter tray's corner cell on the big board: columns 5–8, rows 0–3. */
const TRAY_I = 5, TRAY_J = 0;

const CELL = 1.2;
const BLOCK = .95;

/**
 * Lighting here is a 1.0 hemisphere plus a 1.15 sun (SKY_LOOK), which takes a
 * true-colour StandardMaterial straight to white on any face pointing up. The
 * diffuse is scaled down so the TOP faces land near the game's own colours and
 * the sides fall into shade, instead of the cream board reading as a blank.
 */
const TONE = .48;

export function createZoodokuIsland(scene, island, { mast, cabinet } = {}) {
  const B = BABYLON;
  const floor = island.y;
  const x0 = island.x[0], z0 = island.z[0];
  const W = island.x[1] - island.x[0];
  const D = island.z[1] - island.z[0];
  const cx = x0 + W / 2, cz = z0 + D / 2;
  const blockers = [];
  const statics = [];
  const cellX = (i) => x0 + (i + .5) * CELL;
  const cellZ = (j) => z0 + (j + .5) * CELL;

  // ---- materials ----------------------------------------------------------
  const materials = new Map();
  function material(colour, shine = .03) {
    if (materials.has(colour)) return materials.get(colour);
    const mat = new B.StandardMaterial(`Zoodoku ${colour}`, scene);
    mat.diffuseColor = B.Color3.FromHexString(colour).scale(TONE);
    mat.specularColor = new B.Color3(shine, shine, shine);
    materials.set(colour, mat);
    return mat;
  }
  /** The animal's colour washed toward cream: the 4×4 token under a figurine,
   * so an orange fox does not vanish into an orange tile. */
  function tint(colour, k = .55) {
    const a = B.Color3.FromHexString(colour), b = B.Color3.FromHexString(CREAM);
    return B.Color3.Lerp(a, b, k).toHexString();
  }

  // ---- the digit atlas ----------------------------------------------------
  // 8 × 4 cells of 256 px. Cells 0–8: a block face, the digit in cream on its
  // animal colour. Cells 9–17: a tile top, the digit in its animal colour on
  // cream. Cell 18: plain cream, for the sides of the tiles. System fonts only.
  const ATLAS_W = 2048, ATLAS_H = 1024, COLS = 8, ROWS = 4, PX = 256;
  const atlas = new B.DynamicTexture('Zoodoku digits', { width: ATLAS_W, height: ATLAS_H }, scene, true);
  {
    const ctx = atlas.getContext();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const paint = (index, bg, fg, digit) => {
      const x = (index % COLS) * PX, y = Math.floor(index / COLS) * PX;
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, PX, PX);
      if (!digit) return;
      ctx.font = `900 ${PX * .74}px "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineWidth = PX * .07;
      ctx.strokeStyle = INK;
      ctx.strokeText(String(digit), x + PX / 2, y + PX * .54);
      ctx.fillStyle = fg;
      ctx.fillText(String(digit), x + PX / 2, y + PX * .54);
    };
    ANIMALS.forEach(([, colour], k) => {
      paint(k, colour, CREAM, k + 1);
      paint(9 + k, CREAM, colour, k + 1);
    });
    paint(18, CREAM, null, 0);
    atlas.update();
  }
  atlas.wrapU = atlas.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  const digitMat = new B.StandardMaterial('Zoodoku digit tiles', scene);
  digitMat.diffuseTexture = atlas;
  digitMat.diffuseColor = new B.Color3(TONE * 1.12, TONE * 1.06, TONE * .94); // warmed, as BOARD
  digitMat.specularColor = new B.Color3(.05, .05, .05);
  /** UV rectangle of atlas cell n, inset a few texels against mip bleed.
   * A DynamicTexture is flipped on upload, so canvas top is v = 1. */
  const cellUV = (n) => {
    const c = n % COLS, r = Math.floor(n / COLS), e = 4 / ATLAS_W, f = 4 / ATLAS_H;
    return [c / COLS + e, 1 - (r + 1) / ROWS + f, (c + 1) / COLS - e, 1 - r / ROWS - f];
  };

  // ---- builders -----------------------------------------------------------
  function finish(mesh, mat, solid, keepStatic = true) {
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (keepStatic) statics.push(mesh);
    if (solid) {
      mesh.computeWorldMatrix(true);
      const { minimumWorld: lo, maximumWorld: hi } = mesh.getBoundingInfo().boundingBox;
      blockers.push({ x: (lo.x + hi.x) / 2, z: (lo.z + hi.z) / 2, hx: (hi.x - lo.x) / 2,
        hz: (hi.z - lo.z) / 2, base: floor, top: hi.y });
    }
    return mesh;
  }
  function box(name, x, y, z, width, height, depth, colour, solid = false) {
    const mesh = B.MeshBuilder.CreateBox(`Zoodoku ${name}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    return finish(mesh, material(colour), solid);
  }

  /**
   * A rounded-square slab: w × w in plan with corner radius r, h tall, centred
   * on its origin. `top`, `side`, `bottom` are atlas UV rects (or null for no
   * cap). The top is mapped flat with +z toward the top of the picture, so a
   * digit reads upright from the hub; each side runs the picture left to
   * right as a viewer outside sees it, wrapping round the corners.
   */
  function slab(name, w, h, r, top, side, bottom) {
    const a = w / 2, k = (a - r) * Math.SQRT2, y0 = -h / 2, y1 = h / 2;
    const positions = [], normals = [], uvs = [], indices = [];
    const ring = [];
    // Four sections, one per side, each from mid-corner to mid-corner.
    for (let s = 0; s < 4; s++) {
      const theta = -Math.PI / 2 + s * Math.PI / 2;
      const pts = [];
      for (const [psi, from, to] of [[theta - Math.PI / 4, -Math.PI / 4, 0], [theta + Math.PI / 4, 0, Math.PI / 4]]) {
        const ccx = Math.cos(psi) * k, ccz = Math.sin(psi) * k;
        for (let t = 0; t <= 2; t++) {
          const phi = theta + from + (to - from) * t / 2;
          pts.push([ccx + Math.cos(phi) * r, ccz + Math.sin(phi) * r, phi]);
        }
      }
      // pts[2] and pts[3] are the two ends of the flat run.
      const lengths = [0];
      for (let p = 1; p < pts.length; p++) {
        lengths.push(lengths[p - 1] + Math.hypot(pts[p][0] - pts[p - 1][0], pts[p][1] - pts[p - 1][1]));
      }
      const total = lengths[lengths.length - 1];
      const base = positions.length / 3;
      pts.forEach(([x, z, phi], p) => {
        const u = side[0] + (side[2] - side[0]) * lengths[p] / total;
        positions.push(x, y0, z, x, y1, z);
        normals.push(Math.cos(phi), 0, Math.sin(phi), Math.cos(phi), 0, Math.sin(phi));
        uvs.push(u, side[1], u, side[3]);
      });
      for (let p = 0; p < pts.length - 1; p++) {
        const b0 = base + p * 2, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3;
        indices.push(b0, t1, t0, b0, b1, t1);
      }
      // The cap's ring skips each section's last point: it is the next one's first.
      for (let p = 0; p < pts.length - 1; p++) ring.push(pts[p]);
    }
    const cap = (uv, y, ny) => {
      if (!uv) return;
      const c = positions.length / 3;
      positions.push(0, y, 0); normals.push(0, ny, 0);
      uvs.push((uv[0] + uv[2]) / 2, (uv[1] + uv[3]) / 2);
      for (const [x, z] of ring) {
        positions.push(x, y, z); normals.push(0, ny, 0);
        uvs.push(uv[0] + (uv[2] - uv[0]) * (x / w + .5), uv[1] + (uv[3] - uv[1]) * (z / w + .5));
      }
      for (let p = 0; p < ring.length; p++) {
        const q = (p + 1) % ring.length;
        // Babylon's front faces wind clockwise seen from outside.
        if (ny > 0) indices.push(c, c + 1 + p, c + 1 + q);
        else indices.push(c, c + 1 + q, c + 1 + p);
      }
    };
    cap(top, y1, 1);
    cap(bottom, y0, -1);
    const mesh = new B.Mesh(`Zoodoku ${name}`, scene);
    const data = new B.VertexData();
    data.positions = positions; data.normals = normals; data.uvs = uvs; data.indices = indices;
    data.applyToMesh(mesh, false);
    return mesh;
  }

  // Primitives for the figurines, placed in a figurine's local frame.
  function part(root, mesh, colour, x, y, z) {
    mesh.parent = root;
    mesh.position.set(x, y, z);
    return finish(mesh, material(colour), false);
  }
  const ball = (root, colour, d, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = part(root, B.MeshBuilder.CreateSphere('Zoodoku figurine', { diameter: d, segments: 4 }, scene), colour, x, y, z);
    m.scaling.set(sx, sy, sz);
    return m;
  };
  const cone = (root, colour, d, h, x, y, z, rx = 0, rz = 0, tess = 6) => {
    const m = part(root, B.MeshBuilder.CreateCylinder('Zoodoku figurine',
      { diameterTop: 0, diameterBottom: d, height: h, tessellation: tess }, scene), colour, x, y, z);
    m.rotation.set(rx, 0, rz);
    return m;
  };

  // ---- the board ----------------------------------------------------------
  box('meadow slab', cx, floor - .53, cz, W, .7, D, MEADOW);
  box('sunflower reveal', cx, floor - .16, cz, W + .05, .08, D + .05, SUNFLOWER);
  box('cream board', cx, floor - .06, cz, W, .12, D, BOARD);
  // Cell lines thin, box lines thick, as on the game's own board.
  for (let n = 0; n <= 9; n++) {
    const heavy = n % 3 === 0;
    const t = heavy ? .12 : .04;
    const off = n === 0 ? t / 2 : n === 9 ? -t / 2 : 0;
    box('grid line', x0 + n * CELL + off, floor + .006, cz, t, .012, D, INK);
    box('grid line', cx, floor + .006, z0 + n * CELL + off, W, .012, t, INK);
  }
  // The nine animal colours in order, studded along the two faces the welcome
  // cloud looks at: the first thing that says "Zoodoku" from across the sky.
  ANIMALS.forEach(([, colour], k) => {
    const north = B.MeshBuilder.CreateCylinder('Zoodoku colour stud', { diameter: .62, height: .08, tessellation: 12 }, scene);
    north.rotation.x = Math.PI / 2;
    north.position.set(cellX(k), floor - .5, z0 - .04);
    finish(north, material(colour), false);
    const west = B.MeshBuilder.CreateCylinder('Zoodoku colour stud', { diameter: .62, height: .08, tessellation: 12 }, scene);
    west.rotation.z = Math.PI / 2;
    west.position.set(x0 - .04, floor - .5, cellZ(k));
    finish(west, material(colour), false);
  });

  // ---- the givens -----------------------------------------------------------
  const plain = cellUV(18);
  const taken = new Set();
  for (const [i, j] of GIVENS) {
    const d = SOLUTION[j][i];
    const tile = slab('given tile', 1.0, .3, .17, cellUV(8 + d), plain, null);
    tile.position.set(cellX(i), floor + .15, cellZ(j));
    finish(tile, digitMat, true);
    taken.add(`${i},${j}`);
  }

  // ---- the 4×4 starter tray, and the animals on it --------------------------
  const tx = x0 + TRAY_I * CELL + 2 * CELL, tz = z0 + TRAY_J * CELL + 2 * CELL;
  box('starter tray', tx, floor + .02, tz, 4 * CELL, .04, 4 * CELL, tint(SUNFLOWER, .75));
  for (const s of [-1, 1]) {
    box('tray rim', tx + s * (2 * CELL - .05), floor + .04, tz, .1, .08, 4 * CELL, CORAL);
    box('tray rim', tx, floor + .04, tz + s * (2 * CELL - .05), 4 * CELL, .08, .1, CORAL);
    box('tray line', tx + s * CELL, floor + .043, tz, .035, .01, 4 * CELL - .2, INK);
    box('tray line', tx, floor + .043, tz + s * CELL, 4 * CELL - .2, .01, .035, INK);
  }
  box('tray box line', tx, floor + .045, tz, .09, .012, 4 * CELL - .2, INK);
  box('tray box line', tx, floor + .045, tz, 4 * CELL - .2, .012, .09, INK);

  const facing = Math.atan2(-cx, -cz); // the figurines look toward the hub, at the origin
  const FIGURINES = [fox, frog, whale, lion];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const i = TRAY_I + c, j = TRAY_J + r;
      taken.add(`${i},${j}`);
      if (!STARTER_SHOWN[r][c]) continue;
      const kind = STARTER[r][c];
      const colour = ANIMALS[kind][1];
      const token = slab('animal token', .96, .16, .2, [0, 0, 1, 1], [0, 0, 1, 1], null);
      token.position.set(cellX(i), floor + .12, cellZ(j));
      finish(token, material(tint(colour)), false);
      const root = new B.TransformNode('Zoodoku figurine', scene);
      root.position.set(cellX(i), floor + .2, cellZ(j));
      root.rotation.y = facing;
      FIGURINES[kind](root, colour);
      blockers.push({ x: cellX(i), z: cellZ(j), hx: .5, hz: .5, base: floor, top: floor + 1.15 });
    }
  }

  function fox(root, c) {
    ball(root, c, 1, 0, .3, -.04, .44, .56, .44);           // sitting body
    ball(root, CREAM, 1, 0, .34, .14, .26, .34, .14);        // white chest
    ball(root, c, .42, 0, .72, .04);                         // head
    cone(root, c, .2, .26, 0, .68, .3, Math.PI / 2);         // snout
    ball(root, INK, .07, 0, .68, .43);                       // nose
    for (const s of [-1, 1]) {
      cone(root, c, .16, .24, s * .12, .97, .02, 0, -s * .25, 4);  // ears
      ball(root, INK, .06, s * .09, .78, .22);                     // eyes
    }
    cone(root, c, .26, .55, .24, .2, -.28, -1.2, -.5);       // brush tail
    ball(root, CREAM, .13, .38, .32, -.5);                   // its white tip
  }
  function frog(root, c) {
    ball(root, c, 1, 0, .2, 0, .62, .4, .56);                // squat body
    for (const s of [-1, 1]) {
      ball(root, c, .24, s * .15, .43, .1);                  // eye bumps
      ball(root, CREAM, .14, s * .16, .47, .18);
      ball(root, INK, .07, s * .16, .48, .24);
      ball(root, c, 1, s * .24, .06, .2, .16, .1, .24);      // front feet
      ball(root, c, 1, s * .28, .1, -.16, .22, .16, .3);     // haunches
    }
    ball(root, tint(c, .4), 1, 0, .22, .2, .4, .16, .2);     // pale throat
  }
  function whale(root, c) {
    ball(root, c, 1, 0, .38, .02, .5, .44, .86);             // body
    ball(root, CREAM, 1, 0, .26, .06, .4, .24, .7);          // belly
    cone(root, c, .22, .34, 0, .5, -.48, -Math.PI / 2 - .5); // tail stock
    for (const s of [-1, 1]) {
      ball(root, c, 1, s * .14, .66, -.62, .3, .05, .16);    // flukes
      ball(root, INK, .06, s * .22, .42, .3);                // eyes
    }
    ball(root, tint(c, .7), .16, 0, .9, .14);                // spout
    ball(root, tint(c, .7), .1, 0, .76, .14);
  }
  function lion(root, c) {
    ball(root, c, 1, 0, .22, -.08, .46, .42, .52);           // body
    const mane = part(root, B.MeshBuilder.CreateCylinder('Zoodoku figurine',
      { diameter: .66, height: .16, tessellation: 10 }, scene), '#c8742a', 0, .64, .0);
    mane.rotation.x = Math.PI / 2;
    ball(root, c, .42, 0, .64, .08);                         // head
    ball(root, CREAM, 1, 0, .56, .27, .22, .14, .12);        // muzzle
    ball(root, INK, .07, 0, .61, .33);                       // nose
    for (const s of [-1, 1]) {
      ball(root, c, .13, s * .15, .83, .06);                 // ears
      ball(root, INK, .06, s * .09, .7, .26);                // eyes
    }
  }

  // ---- the pencil, left on the back row --------------------------------------
  {
    const z = cellZ(8), r = .23, y = floor + r * .87;
    const pencil = (name, colour, len, dTop, dBot, x, tess = 6) => {
      const m = B.MeshBuilder.CreateCylinder(`Zoodoku pencil ${name}`,
        { height: len, diameterTop: dTop, diameterBottom: dBot, tessellation: tess }, scene);
      m.rotation.z = -Math.PI / 2;        // axis along +x, the top end pointing +x
      m.rotation.x = Math.PI / 6;         // a flat of the hexagon down on the board
      m.position.set(x, y, z);
      return finish(m, material(colour), false);
    };
    let x = x0 + .3;
    pencil('eraser', CORAL, .42, 2 * r * .96, 2 * r * .96, x + .21, 12); x += .42;
    pencil('ferrule', '#c9ccd1', .3, 2 * r * 1.02, 2 * r * 1.02, x + .15, 12); x += .3;
    pencil('body', SUNFLOWER, 3.7, 2 * r, 2 * r, x + 1.85); x += 3.7;
    pencil('wood', '#f3d9a7', .58, .11, 2 * r, x + .29); x += .58;
    pencil('lead', INK, .17, 0, .11, x + .085);
    blockers.push({ x: (x0 + .3 + x + .17) / 2, z, hx: (x + .17 - x0 - .3) / 2, hz: r + .02, base: floor, top: floor + 2 * r });
    for (let i = 0; i <= 4; i++) taken.add(`${i},8`);
  }

  // ---- the name-board mast ---------------------------------------------------
  if (mast) box('sign mast', mast.x, floor + mast.top / 2, mast.z, .16, mast.top, .16, INK, true);

  // ---- the orbiting digits -----------------------------------------------------
  // Each digit's landing cell: an empty cell where it belongs in SOLUTION, in
  // the western five columns (clear of cabinet, mast and animals, see header),
  // away from the cabinet's stand, nearest the middle of the board.
  // cabinets.js puts the stand 1.3 m in front of a classic cabinet's screen.
  const stand = cabinet ? { x: cabinet.x + Math.sin(cabinet.yaw) * 1.3, z: cabinet.z + Math.cos(cabinet.yaw) * 1.3 } : null;
  const targets = ANIMALS.map((_, k) => {
    let best = null, bestD = Infinity;
    for (let j = 0; j < 8; j++) for (let i = 0; i <= 4; i++) {
      if (SOLUTION[j][i] !== k + 1 || taken.has(`${i},${j}`)) continue;
      if (stand && Math.hypot(cellX(i) - stand.x, cellZ(j) - stand.z) < 2.6) continue;
      const dd = Math.hypot(i - 3, j - 4);
      if (dd < bestD) { bestD = dd; best = [cellX(i), cellZ(j)]; }
    }
    return best || [cellX(2), cellZ(3)];
  });

  const R = Math.hypot(W, D) / 2 + 1.15;
  const blocks = ANIMALS.map((_, k) => {
    const uv = cellUV(k);
    const mesh = slab(`number block ${k + 1}`, BLOCK, BLOCK, .17, uv, uv, uv);
    finish(mesh, digitMat, false, false);
    const [txk, tzk] = targets[k];
    return {
      mesh, k, tx: txk, tz: tzk, aim: Math.atan2(tzk - cz, txk - cx),
      phase: 'orbit', s: 0, fx: 0, fy: 0, fz: 0, fr: 0, wx: 0, wz: 0,
    };
  });
  const DOWN = 2.6, REST = 2.4, UP = 2.8, EVERY = 3.6;
  const restY = floor + BLOCK / 2 + .005;
  let clock = 0, nextLaunch = 2;
  // Where block k would be in the ring right now, written into one shared
  // object so nothing is allocated per frame.
  const ringPos = { x: 0, y: 0, z: 0, a: 0, spin: 0, wx: 0, wz: 0 };
  function ring(k, t) {
    const a = k * Math.PI * 2 / 9 + t * .1;
    ringPos.a = a;
    ringPos.x = cx + Math.cos(a) * R;
    ringPos.z = cz + Math.sin(a) * R;
    ringPos.y = floor + 2.7 + (k % 3) * .35 + Math.sin(t * .9 + k * 1.7) * .3;
    ringPos.spin = t * .35 + k * 1.3;
    ringPos.wx = Math.sin(t * .7 + k) * .12;
    ringPos.wz = Math.cos(t * .6 + k) * .1;
    return ringPos;
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  function animate(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    clock += Math.min(dt, .05);
    if (clock >= nextLaunch) {
      nextLaunch = clock + EVERY;
      // The idle block whose place in the ring is most nearly over its cell
      // goes next: its path is short and radial, and stays out of the east.
      let pick = null, gap = Infinity;
      for (const b of blocks) {
        if (b.phase !== 'orbit') continue;
        const g = angleGap(ring(b.k, clock).a, b.aim);
        if (g < gap) { gap = g; pick = b; }
      }
      if (pick) {
        const p = ring(pick.k, clock);
        pick.phase = 'down'; pick.s = 0;
        pick.fx = p.x; pick.fy = p.y; pick.fz = p.z;
        pick.fr = p.spin - Math.round(p.spin / (Math.PI * 2)) * Math.PI * 2;
        pick.wx = p.wx; pick.wz = p.wz;
      }
    }
    for (const b of blocks) {
      const m = b.mesh;
      b.s += Math.min(dt, .05);
      if (b.phase === 'orbit') {
        const p = ring(b.k, clock);
        m.position.set(p.x, p.y, p.z);
        m.rotation.set(p.wx, p.spin, p.wz);
        m.scaling.set(1, 1, 1);
      } else if (b.phase === 'down') {
        const t = Math.min(1, b.s / DOWN);
        const h = 1 - (1 - t) ** 3;       // arrive over the cell early...
        const v = t * t * t;               // ...and drop late, so it comes straight down
        m.position.set(b.fx + (b.tx - b.fx) * h, b.fy + (restY - b.fy) * v + Math.sin(Math.PI * t) * .5,
          b.fz + (b.tz - b.fz) * h);
        const e = 1 - smooth(t);
        m.rotation.set(b.wx * e, b.fr * e, b.wz * e);
        if (t >= 1) { b.phase = 'rest'; b.s = 0; }
      } else if (b.phase === 'rest') {
        // One soft squash as it lands, then still.
        const q = b.s < .4 ? Math.sin(b.s / .4 * Math.PI) : 0;
        const sy = 1 - .14 * q, sxz = 1 + .07 * q;
        m.scaling.set(sxz, sy, sxz);
        m.rotation.set(0, 0, 0);
        m.position.set(b.tx, restY - (1 - sy) * BLOCK / 2, b.tz);
        if (b.s >= REST) { b.phase = 'up'; b.s = 0; m.scaling.set(1, 1, 1); }
      } else {
        const t = Math.min(1, b.s / UP);
        const p = ring(b.k, clock);
        const h = t * t * t, v = 1 - (1 - t) ** 3;   // lift first, then glide out
        m.position.set(b.tx + (p.x - b.tx) * h, restY + (p.y - restY) * v + Math.sin(Math.PI * t) * .4,
          b.tz + (p.z - b.tz) * h);
        const spin = p.spin - Math.round(p.spin / (Math.PI * 2)) * Math.PI * 2;
        const e = smooth(t);
        m.rotation.set(p.wx * e, spin * e, p.wz * e);
        if (t >= 1) { b.phase = 'orbit'; b.s = 0; }
      }
    }
  }
  animate(1e-3);
  return { blockers, statics, animate };
}
