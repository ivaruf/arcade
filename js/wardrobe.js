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
  { id:'crown', label:'Royal crown', slot:'head', slotLabel:'Head' },
  { id:'vikingHelmet', label:'Viking helmet', slot:'head', slotLabel:'Head' },
  { id:'propellerCap', label:'Propeller cap', slot:'head', slotLabel:'Head' },
  { id:'sunglasses', label:'Silly sunglasses', slot:'eyes', slotLabel:'Eyes' },
  { id:'monocle', label:'Monocle', slot:'eyes', slotLabel:'Eyes' },
  { id:'snorkel', label:'Snorkel mask', slot:'eyes', slotLabel:'Eyes' },
  { id:'eyePatch', label:'Pirate eye patch', slot:'eyes', slotLabel:'Eyes' },
  { id:'mustache', label:'Curly mustache', slot:'mouth', slotLabel:'Mouth' },
  { id:'bubbleGum', label:'Bubble gum', slot:'mouth', slotLabel:'Mouth' },
  { id:'clownNose', label:'Clown nose', slot:'nose', slotLabel:'Nose' },
  { id:'pigSnout', label:'Piggy snout', slot:'nose', slotLabel:'Nose' },
  { id:'bowTie', label:'Bow tie', slot:'neck', slotLabel:'Neck' },
  { id:'necktie', label:'Office necktie', slot:'neck', slotLabel:'Neck' },
  { id:'medal', label:'Gold medal', slot:'neck', slotLabel:'Neck' },
  { id:'earrings', label:'Golden hoops', slot:'ears', slotLabel:'Ears' },
  { id:'headphones', label:'Headphones', slot:'ears', slotLabel:'Ears' },
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

  // The second rack, 2026-10-07. Same head-local space and the same landmarks
  // as everything above: eyes (+-.127,.25,.307), nose tip (0,.17,.417), ears
  // (+-.285,.30,.055), the top hat's brim at y .47, the bow tie's knot at
  // (0,-.055,.28). Nothing here is transparent and nothing is textured, because
  // a wearer that relights the items (fishtank repaints each mesh from its
  // albedo) must be able to carry them over as a flat colour each.
  const steel = material('Helmet steel', '#9aa7b4', .35);
  const horn = material('Helmet horn', '#efe2c2', .6);
  const amber = material('Accessory amber', '#f4c35c', .45);
  const orange = material('Snorkel orange', '#f08a3c', .45);
  const sea = material('Snorkel glass', '#3d8fb0', .12);
  const gum = material('Bubble gum pink', '#ff8fc8', .3);
  const pig = material('Piggy pink', '#f4a7a6', .6);
  const nostril = material('Piggy nostril', '#7a3a45', .8);
  const tie = material('Necktie red', '#d9434f', .55);
  const pearl = material('Crown pearl', '#f3ead2', .3);
  const royal = material('Medal ribbon blue', '#3a6fd8', .5);
  const front = mesh => { mesh.rotation.x = Math.PI/2; return mesh; };
  const dome = (name, diameter) => B.MeshBuilder.CreateSphere(name,{diameter,segments:20,slice:.5},scene);
  // Crown: a gold band where the top hat's band sits, five points, a jewel
  // over each eye and one in the middle.
  add(cyl('Crown band',{diameter:.34,height:.11}),items.crown,gold,0,.50,.015);
  for (let i = 0; i < 5; i++) {
    const a = i/5*Math.PI*2, x = Math.sin(a)*.155, z = .015+Math.cos(a)*.155;
    add(cyl('Crown point',{diameterTop:0,diameterBottom:.09,height:.14,tessellation:4}),items.crown,gold,x,.625,z);
    add(B.MeshBuilder.CreateSphere('Crown point pearl',{diameter:.04,segments:8},scene),items.crown,pearl,x,.70,z);
  }
  for (const [a, mat] of [[0,red],[-.7,band],[.7,band]])
    add(B.MeshBuilder.CreateSphere('Crown jewel',{diameter:.06,segments:12},scene),items.crown,mat,Math.sin(a)*.172,.50,.015+Math.cos(a)*.172);
  // Viking helmet: a steel dome over the crown of the head and two horns
  // curling up out of the sides. slice:.5 keeps the upper half of the sphere.
  const helm = add(dome('Viking helmet dome',.60),items.vikingHelmet,steel,0,.36,.015); helm.scaling.y = .85;
  add(B.MeshBuilder.CreateTorus('Viking helmet rim',{diameter:.60,thickness:.05,tessellation:32},scene),items.vikingHelmet,amber,0,.36,.015);
  for (const side of [-1,1]) {
    add(B.MeshBuilder.CreateTube('Viking horn',{path:[[.24,.45,.02],[.36,.49,.03],[.45,.58,.04],[.48,.71,.05],[.45,.80,.06]].map(([x,y,z])=>new B.Vector3(side*x,y,z)),
      radiusFunction:(i)=>.055*(1-i/4.6),tessellation:12,cap:B.Mesh.CAP_ALL},scene),items.vikingHelmet,horn,0,0,0);
  }
  // Propeller cap: a beanie, a peak over the eyes, and a propeller that turns.
  add(dome('Propeller cap crown',.56),items.propellerCap,red,0,.40,.015).scaling.y = .72;
  const peak = add(cyl('Propeller cap peak',{diameter:.30,height:.02}),items.propellerCap,royal,0,.41,.24); peak.scaling.z = .6;
  add(B.MeshBuilder.CreateTorus('Propeller cap band',{diameter:.56,thickness:.03,tessellation:32},scene),items.propellerCap,amber,0,.41,.015);
  add(cyl('Propeller stalk',{diameter:.025,height:.08,tessellation:12}),items.propellerCap,steel,0,.63,.015);
  const propeller = new B.TransformNode('Propeller', scene); propeller.parent = items.propellerCap; propeller.position.set(0,.675,.015);
  add(B.MeshBuilder.CreateSphere('Propeller hub',{diameter:.045,segments:10},scene),propeller,royal,0,0,0);
  for (const side of [-1,1]) {
    const blade = add(B.MeshBuilder.CreateBox('Propeller blade',{width:.17,height:.012,depth:.065},scene),propeller,side<0?amber:band,side*.1,0,0);
    blade.rotation.x = side*.25;
  }
  // The one moving part in the wardrobe. A wearer that freezes its world
  // matrices would stop it, which is harmless; the observer goes with the node
  // so a wearer that throws unworn items away (neonfox) leaves nothing behind.
  const spin = scene.onBeforeRenderObservable.add(() => {
    if (propeller.isEnabled()) propeller.rotation.y += Math.min(scene.getEngine().getDeltaTime(), 100) * .006;
  });
  propeller.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(spin));
  // Snorkel mask: one oval of glass across both eyes, a strap, and the tube
  // up the left side of the head.
  const mask = add(front(cyl('Snorkel mask frame',{diameter:.42,height:.05})),items.snorkel,amber,0,.27,.33); mask.scaling.z = .45;
  const glass = add(front(cyl('Snorkel mask glass',{diameter:.37,height:.02})),items.snorkel,sea,0,.27,.357); glass.scaling.z = .42;
  for (const side of [-1,1]) add(B.MeshBuilder.CreateBox('Snorkel strap',{width:.03,height:.05,depth:.24},scene),items.snorkel,orange,side*.215,.27,.20);
  tube('Snorkel tube',items.snorkel,orange,[[-.12,.14,.39],[-.24,.13,.33],[-.31,.24,.24],[-.32,.55,.20],[-.31,.70,.22]],.022);
  add(cyl('Snorkel tip',{diameter:.065,height:.05,tessellation:16}),items.snorkel,sea,-.31,.72,.22);
  // Pirate eye patch over the eye the monocle leaves free, and its cord.
  const patch = add(front(cyl('Eye patch',{diameter:.17,height:.025})),items.eyePatch,black,-.127,.25,.325); patch.scaling.z = .85;
  tube('Eye patch cord',items.eyePatch,black,[[-.20,.29,.30],[-.27,.33,.19],[-.30,.36,.02]],.009);
  tube('Eye patch cord',items.eyePatch,black,[[-.06,.30,.335],[.08,.37,.31],[.21,.42,.20],[.27,.44,.02]],.009);
  // Bubble gum, caught mid-blow.
  add(B.MeshBuilder.CreateSphere('Bubble gum',{diameter:.20,segments:20},scene),items.bubbleGum,gum,0,.11,.45);
  // Piggy snout, over the nose, with two nostrils.
  add(front(cyl('Piggy snout',{diameter:.16,height:.07})),items.pigSnout,pig,0,.175,.405);
  for (const side of [-1,1]) {
    const hole = add(front(cyl('Piggy nostril',{diameter:.036,height:.01,tessellation:12})),items.pigSnout,nostril,side*.032,.175,.441);
    hole.scaling.x = .7;
  }
  // Office necktie. Not a scarf: the gopher's model already wears one, so a
  // neck item has to hang in front of it to be seen. The blade is a four-sided
  // cylinder flattened front to back, which reads as a tie from any angle.
  add(B.MeshBuilder.CreateBox('Necktie knot',{width:.07,height:.06,depth:.05},scene),items.necktie,tie,0,-.07,.29);
  const blade = add(cyl('Necktie blade',{diameterTop:.07,diameterBottom:.12,height:.22,tessellation:4}),items.necktie,tie,0,-.21,.29); blade.scaling.z = .3;
  const tip = add(cyl('Necktie tip',{diameterTop:.12,diameterBottom:0,height:.06,tessellation:4}),items.necktie,tie,0,-.35,.29); tip.scaling.z = .3;
  add(B.MeshBuilder.CreateBox('Necktie stripe',{width:.10,height:.018,depth:.04},scene),items.necktie,amber,0,-.19,.293).rotation.z = -.5;
  // Gold medal on a blue ribbon.
  for (const side of [-1,1]) tube('Medal ribbon',items.medal,royal,[[side*.19,-.02,.17],[side*.10,-.12,.27],[side*.012,-.20,.30]],.017);
  add(front(cyl('Gold medal',{diameter:.15,height:.025})),items.medal,gold,0,-.25,.31);
  add(B.MeshBuilder.CreateTorus('Gold medal rim',{diameter:.13,thickness:.014,tessellation:24},scene),items.medal,amber,0,-.25,.325).rotation.x = Math.PI/2;
  // Headphones: a band arching over the head from ear to ear, and two cups.
  tube('Headphone band',items.headphones,black,Array.from({length:13},(_, i) => {
    const t = i/12*Math.PI; return [Math.cos(t)*.31,.30+Math.sin(t)*.25,.04];
  }),.022);
  for (const side of [-1,1]) {
    add(cyl('Headphone cup',{diameter:.19,height:.08}),items.headphones,pink,side*.33,.30,.04).rotation.z = Math.PI/2;
    add(cyl('Headphone cushion',{diameter:.16,height:.04}),items.headphones,black,side*.28,.30,.04).rotation.z = Math.PI/2;
  }
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
