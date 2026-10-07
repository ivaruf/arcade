/* =============================================================================
 * wardrobe.js — what the gopher can wear, and what it is wearing.
 *
 * PROOF OF CONCEPT, 2026-10-07: the first thing in the hub that crosses from
 * the arcade into a game. NeonFox imports this file from ../arcade/js/ at
 * runtime and puts the same items on the player's own fox, so the top hat the
 * gopher picked at the dresser is the top hat the fox rides in. It is the
 * shape hub CLAUDE.md §7 designs toward, built small to see how it feels, and
 * two of §7's open questions are answered here only PROVISIONALLY:
 *
 *   - HOW SHARED CODE REACHES A GAME. By a dynamic import() of this file, the
 *     way exit.js reaches every game: one copy, in the arcade, loaded by URL.
 *     A dynamic import that fails is a rejected promise and not a broken
 *     module graph, so a game served without the arcade beside it — or one
 *     whose fetch is blocked — gets an undressed fox and nothing worse. That
 *     is why this file IMPORTS NOTHING: anything it pulled in would be one
 *     more file for a game to fail to fetch, and room.js would drag the whole
 *     sky in behind it. It reads the global BABYLON, which every caller has.
 *
 *   - THE STORAGE KEY. `arcade.outfit.poc.v1`, named as a placeholder so
 *     nobody mistakes it for the settled cosmetics namespace §7 says is still
 *     to be chosen. What it holds is a choice among items that are free to
 *     everyone, not anything earned or bought, so losing it to a later rename
 *     costs a player one visit to the dresser. That is what makes it safe to
 *     ship before the real key exists — and it would stop being safe the day
 *     an earned item is written here.
 *
 * The meshes are authored on the gopher's head: head-local, facing +Z, in the
 * gopher's head units. A wearer with a different head (the fox's is wider and
 * has a snout) fits them with its own transform; see neonfox rider.js.
 * ========================================================================== */

const OUTFIT_KEY = 'arcade.outfit.poc.v1';

/** One item per equipment slot; item meshes also supply the inventory photos. */
export const ACCESSORIES = [
  { id:'topHat', label:'Top hat', slot:'head', slotLabel:'Head' },
  { id:'antennae', label:'Alien antennae', slot:'head', slotLabel:'Head' },
  { id:'sunglasses', label:'Silly sunglasses', slot:'eyes', slotLabel:'Eyes' },
  { id:'monocle', label:'Monocle', slot:'eyes', slotLabel:'Eyes' },
  { id:'mustache', label:'Curly mustache', slot:'mouth', slotLabel:'Mouth' },
  { id:'clownNose', label:'Clown nose', slot:'nose', slotLabel:'Nose' },
  { id:'bowTie', label:'Bow tie', slot:'neck', slotLabel:'Neck' },
  { id:'earrings', label:'Golden hoops', slot:'ears', slotLabel:'Ears' },
];

export function selectAccessory(selection, id, enabled) {
  const item = ACCESSORIES.find(item => item.id === id);
  if (!item) return;
  if (enabled) for (const other of ACCESSORIES) {
    if (other.slot === item.slot) selection[other.id] = false;
  }
  selection[id] = !!enabled;
}

/**
 * A flat-coloured surface in the same material model as the rest of the sky.
 *
 * Everything the GLBs bring in is PBR, and the lighting rig in main.js is tuned
 * for it: two intensity-34 point lamps that PBR fades with the inverse square
 * of distance, so from the dresser's spot they land at well under 1x. A
 * StandardMaterial reads the very same lamps with Babylon's legacy linear
 * range falloff, 1 - d/range, which from anywhere on the platform is 15-20x
 * per lamp — pure white with cyan fringes. Capping the material at two lights
 * only worked while sky and sun happened to be created first, and even then
 * left this the one object on the floor that ignored the lamp pools everything
 * around it sits in. Using the world's material is the fix, not moving the
 * machine.
 *
 * Hex colours are authored by eye, in gamma space; PBR albedo and emissive are
 * linear, so both are converted. Glow is "this fraction of the colour, as
 * seen", which is why it scales before the conversion rather than after.
 */
export function paint(scene, name, hex, roughness = .55, glow = 0) {
  const B = BABYLON;
  const m = new B.PBRMaterial(name, scene);
  const tint = B.Color3.FromHexString(hex);
  m.albedoColor = tint.toLinearSpace();
  m.metallic = 0; m.roughness = roughness;
  m.emissiveColor = tint.scale(glow).toLinearSpace();
  return m;
}

/** Shared geometry for worn items, machine display and inventory photos. */
export function makeAccessories(head, scene, shadows) {
  const B = BABYLON;
  const root = new B.TransformNode('Gopher accessories', scene); root.parent = head;
  const hat = new B.TransformNode('Top hat', scene); hat.parent = root;
  const glasses = new B.TransformNode('Silly sunglasses', scene); glasses.parent = root;
  const material = (name, color, roughness) => paint(scene, name, color, roughness);
  const black = material('Hat felt', '#192033', .75);
  const pink = material('Silly pink frames', '#f653ad', .45);
  const lens = material('Sunglass lenses', '#172c46', .2);
  const band = material('Hat satin ribbon', '#36cdb9', .4);
  function add(mesh, parent, mat, x, y, z) {
    mesh.parent = parent; mesh.material = mat; mesh.position.set(x,y,z); mesh.isPickable = false;
    shadows?.addShadowCaster(mesh, false); return mesh;
  }
  const cyl = (name, opts) => B.MeshBuilder.CreateCylinder(name, { tessellation: 32, ...opts }, scene);
  add(cyl('Top hat brim',{diameter:.56,height:.035}),hat,black,0,.47,.015);
  add(cyl('Top hat crown',{diameterTop:.40,diameterBottom:.34,height:.34}),hat,black,0,.65,.015);
  add(cyl('Top hat band',{diameter:.365,height:.065}),hat,band,0,.515,.015);
  for (const side of [-1,1]) {
    const frame = B.MeshBuilder.CreateTorus('Round pink sunglass frame',{diameter:.215,thickness:.033,tessellation:32},scene);
    frame.rotation.x=Math.PI/2;
    add(frame,glasses,pink,side*.127,.25,.307);
    const glass = cyl('Dark sunglass lens',{diameter:.188,height:.015}); glass.rotation.x=Math.PI/2;
    add(glass,glasses,lens,side*.127,.25,.307);
    add(B.MeshBuilder.CreateBox('Sunglass arm',{width:.025,height:.028,depth:.23},scene),glasses,pink,side*.25,.25,.195);
  }
  add(B.MeshBuilder.CreateBox('Sunglass bridge',{width:.071,height:.025,depth:.026},scene),glasses,pink,0,.263,.308);
  const items = { topHat: hat, sunglasses: glasses };
  for (const item of ACCESSORIES) if (!items[item.id]) {
    items[item.id] = new B.TransformNode(item.label, scene); items[item.id].parent = root;
  }
  const gold = material('Accessory gold', '#e9bb56', .35);
  const red = material('Clown cherry red', '#ed4261', .4);
  const green = material('Alien lime', '#a4eb69', .5);
  function tube(name, parent, mat, points, radius) {
    return add(B.MeshBuilder.CreateTube(name,{path:points.map(p=>new B.Vector3(...p)),radius,tessellation:8},scene),parent,mat,0,0,0);
  }
  const mono = B.MeshBuilder.CreateTorus('Monocle gold rim',{diameter:.21,thickness:.018,tessellation:32},scene);
  mono.rotation.x = Math.PI/2; add(mono,items.monocle,gold,.127,.25,.353);
  tube('Monocle chain',items.monocle,gold,[[.23,.25,.35],[.265,.12,.33],[.24,-.02,.29],[.16,-.07,.27]],.006);
  for (const side of [-1,1]) {
    tube('Curled mustache',items.mustache,black,[[0,.125,.404],[side*.055,.15,.416],[side*.13,.09,.417],[side*.19,.105,.40],[side*.21,.145,.39]],.025);
    const tie=B.MeshBuilder.CreateCylinder('Bow tie wing',{diameterTop:.13,diameterBottom:.025,height:.13,tessellation:3},scene);
    tie.rotation.z=side*Math.PI/2;add(tie,items.bowTie,pink,side*.072,-.055,.27);
    const hoop=B.MeshBuilder.CreateTorus('Golden earring',{diameter:.115,thickness:.018,tessellation:24},scene);
    hoop.rotation.x=Math.PI/2;add(hoop,items.earrings,gold,side*.285,.30,.055);
    tube('Alien antenna',items.antennae,band,[[side*.26,.39,0],[side*.34,.64,.015],[side*.32,.87,.015]],.013);
    add(B.MeshBuilder.CreateSphere('Alien antenna tip',{diameter:.10,segments:12},scene),items.antennae,green,side*.32,.87,.015);
  }
  add(B.MeshBuilder.CreateSphere('Bow tie knot',{diameter:.065,segments:12},scene),items.bowTie,pink,0,-.055,.28);
  add(B.MeshBuilder.CreateSphere('Clown nose',{diameter:.145,segments:20},scene),items.clownNose,red,0,.17,.417);
  for (const item of Object.values(items)) item.setEnabled(false);
  return { nodes: items, set(selection) {
    for (const [id, node] of Object.entries(items)) node.setEnabled(!!selection[id]);
  } };
}

/**
 * The saved outfit as a selection object, { topHat: true, ... }, every known
 * item present. The store is one namespace shared by every game on the origin
 * and anything may have written this key, so the list is trusted for nothing:
 * unknown ids are dropped, and selectAccessory() re-applies one-per-slot.
 */
export function loadOutfit() {
  const selection = Object.fromEntries(ACCESSORIES.map(item => [item.id, false]));
  try {
    const worn = JSON.parse(localStorage.getItem(OUTFIT_KEY) || '[]');
    if (Array.isArray(worn)) for (const id of worn) selectAccessory(selection, id, true);
  } catch { /* private mode, or someone else's junk: start undressed */ }
  return selection;
}

/** Persist a selection as the list of worn ids — small, and readable in devtools. */
export function saveOutfit(selection) {
  try {
    localStorage.setItem(OUTFIT_KEY, JSON.stringify(ACCESSORIES.filter(item => selection[item.id]).map(item => item.id)));
  } catch { /* quota or private mode: the outfit lasts this visit only */ }
}
