/* =============================================================================
 * spectacles.js — Spectacles: the island the shows are put on from.
 *
 * Started 2026-10-30 with one thing on it, the free rocket pad (rockets.js),
 * and meant to grow: the arcade may one day put on bigger shows — paid ones,
 * a fireworks display ending in a thank-you across the sky — and this is
 * where they start. Whatever lands here keeps to the one rule the idea was
 * found with: shows are watched, never played, and no price ever appears in
 * the sky.
 *
 * WHERE. Beyond the quiet cloud from the hub (+z, and a little +x; the
 * README's compass calls that south-east), level with nothing else, so it
 * shows from the welcome cloud in the gap between the quiet cloud and the
 * puzzle meadow, and anything launched from it bursts above every other
 * island. Beyond it is open sky to the edge of the world (room.js SKY runs
 * to z 45), which is room for whatever comes next.
 *
 * WHAT IT LOOKS LIKE. A festival ground at dusk: a violet deck on a tapered
 * keel, a gold rim, a darker launch field in the middle with gold rays
 * running out from where the pad stands, and a ring of short posts round the
 * edge each carrying a coloured bulb — pink, gold, cyan in turn. At the back,
 * facing the hub, a board with the island's name on it, in the player's
 * language.
 *
 * COST (PERFORMANCE.md, CLAUDE.md §5): the ratified island shape. Everything
 * is still and returned in `statics` for room.js to merge — one
 * vertex-coloured matte material for deck, keel, rim, posts and board frame,
 * one emissive material per bulb colour. The board face is its own mesh,
 * kept out of the glow layer, and is repainted only on a language switch.
 * Nothing moves, so there is no animate().
 * ========================================================================== */
import { t } from './i18n.js';

const DECK = '#2a2350', FIELD = '#1f1a3d', RAY = '#5a4a2a', RIM = '#f6c945',
  KEEL = '#1b1638', POST = '#3a3360', BOARD = '#141127';
const BULBS = ['#ff5fb4', '#ffd23f', '#38e1f0'];

export function createSpectaclesIsland(scene, island) {
  const B = BABYLON;
  const floor = island.y;
  const W = island.x[1] - island.x[0];
  const D = island.z[1] - island.z[0];
  const cx = island.x[0] + W / 2, cz = island.z[0] + D / 2;
  const blockers = [];
  const statics = [];

  const matte = new B.StandardMaterial('Spectacles matte', scene);
  matte.diffuseColor = new B.Color3(1, 1, 1); // the vertex colour carries it
  matte.specularColor = new B.Color3(.06, .06, .08);
  const bulbMats = BULBS.map((c, i) => {
    const mat = new B.StandardMaterial(`Spectacles bulb ${i + 1}`, scene);
    mat.disableLighting = true;
    mat.diffuseColor = B.Color3.Black();
    mat.specularColor = B.Color3.Black();
    mat.emissiveColor = B.Color3.FromHexString(c);
    return mat;
  });

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
    const mesh = B.MeshBuilder.CreateBox(`Spectacles ${name}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.computeWorldMatrix(true);
    return still(mesh, look, solid);
  }
  function disc(name, x, y, z, top, bottom, height, look, sides = 32) {
    const mesh = B.MeshBuilder.CreateCylinder(`Spectacles ${name}`,
      { diameterTop: top, diameterBottom: bottom, height, tessellation: sides }, scene);
    mesh.position.set(x, y, z);
    mesh.computeWorldMatrix(true);
    return still(mesh, look);
  }

  // ---- the deck -------------------------------------------------------------
  box('deck', cx, floor - .25, cz, W, .5, D, DECK);
  // Just under the top, so it shows as a band round the sides and never
  // shares a plane with the deck.
  box('rim', cx, floor - .06, cz, W + .08, .1, D + .08, RIM);
  // The keel: a rounded cone of night under the deck, for anyone below.
  disc('keel', cx, floor - 1.6, cz, Math.min(W, D) * .95, Math.min(W, D) * .3, 2.2, KEEL, 24);

  // ---- the launch field -----------------------------------------------------
  // Centred on the pad (rockets.js padOn), the rays running out from it.
  const pad = padOn(island);
  disc('launch field', pad.x, floor + .004, pad.z, 5.2, 5.2, .02, FIELD, 40);
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    box('ray', pad.x + Math.cos(a) * 1.75, floor + .016, pad.z + Math.sin(a) * 1.75, 1.6, .006, .07, RAY, -a);
  }

  // ---- the bulbs ------------------------------------------------------------
  // Round the edge, a post every metre and a half or so, the entrance on the
  // hub-facing (−z) side left open between the two middle posts.
  const ring = [];
  const along = (from, to, n) => Array.from({ length: n + 1 }, (_, i) => from + (to - from) * i / n);
  const inset = .35;
  const xs = along(island.x[0] + inset, island.x[1] - inset, 6);
  const zs = along(island.z[0] + inset, island.z[1] - inset, 6);
  for (const x of xs) ring.push([x, island.z[1] - inset]);
  for (const z of zs.slice(1, -1)) ring.push([island.x[0] + inset, z], [island.x[1] - inset, z]);
  for (const x of xs) if (Math.abs(x - cx) > 1.4) ring.push([x, island.z[0] + inset]);
  ring.forEach(([x, z], i) => {
    box('post', x, floor + .45, z, .12, .9, .12, POST, 0, true);
    const bulb = B.MeshBuilder.CreateSphere('Spectacles bulb', { diameter: .24, segments: 8 }, scene);
    bulb.position.set(x, floor + 1.0, z);
    still(bulb, bulbMats[i % bulbMats.length]);
  });

  // ---- the name board -------------------------------------------------------
  // At the back, facing the welcome cloud: a plane's front looks down its
  // local −z, which a turn of atan2(x, z) points back at the origin.
  const bx = cx, bz = island.z[1] - 1.1;
  const face = Math.atan2(bx, bz);
  for (const s of [-1, 1]) {
    const px = bx + Math.cos(face) * 1.55 * s, pz = bz - Math.sin(face) * 1.55 * s;
    box('board leg', px, floor + 1.4, pz, .14, 2.8, .14, POST, face, true);
  }
  box('board back', bx, floor + 2.35, bz, 3.4, 1.1, .1, BOARD, face);
  box('board frame', bx, floor + 2.35, bz + .01, 3.5, 1.2, .08, RIM, face);

  const texture = new B.DynamicTexture('Spectacles name', { width: 1024, height: 320 }, scene, true);
  const letter = () => {
    const ctx = texture.getContext();
    ctx.fillStyle = BOARD; ctx.fillRect(0, 0, 1024, 320);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '700 150px system-ui, sans-serif';
    ctx.fillText(t('platform.spectacles'), 512, 170, 960);
    texture.update();
  };
  letter();
  document.addEventListener('arcade:lang', letter);
  const ink = new B.StandardMaterial('Spectacles name ink', scene);
  ink.disableLighting = true;
  ink.emissiveTexture = texture;
  ink.emissiveColor = ink.diffuseColor = ink.specularColor = B.Color3.Black();
  const plate = B.MeshBuilder.CreatePlane('Spectacles name face', { width: 3.3, height: 1.03 }, scene);
  plate.position.set(bx - Math.sin(face) * .06, floor + 2.35, bz - Math.cos(face) * .06);
  plate.rotation.y = face;
  plate.material = ink;
  plate.isPickable = false;
  for (const layer of scene.effectLayers || []) layer.addExcludedMesh?.(plate);
  plate.freezeWorldMatrix();

  return { statics, blockers };
}

/** Where the rocket pad stands on this island: in the middle, a few metres in
 *  from the hub-facing edge, so its rockets fly out over the deck. Shared with
 *  rockets.js so the launch field and the pad cannot drift apart. */
export function padOn(island) {
  return { x: (island.x[0] + island.x[1]) / 2, z: island.z[0] + 3.6, y: island.y };
}
