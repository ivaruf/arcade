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
    // Thick at the lip and waxed to a point that curls back on itself.
    const curl=[[0,.125,.404],[side*.055,.15,.416],[side*.13,.09,.417],[side*.19,.105,.40],[side*.21,.145,.39],[side*.195,.172,.388],[side*.172,.163,.392],[side*.178,.143,.396]];
    add(B.MeshBuilder.CreateTube('Curled mustache',{path:curl.map(p=>new B.Vector3(...p)),radiusFunction:(i)=>.03*(1-i/8.5)+.003,tessellation:10,cap:B.Mesh.CAP_ALL},scene),items.mustache,black,0,0,0);
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
  const bronze = material('Helmet bronze', '#b9783a', .4);
  const horn = material('Helmet horn', '#efe2c2', .6);
  const amber = material('Accessory amber', '#f4c35c', .45);
  const orange = material('Snorkel orange', '#f08a3c', .45);
  const sea = material('Snorkel glass', '#3d8fb0', .12);
  const shine = paint(scene, 'Glass highlight', '#f2fbff', .05, .45);
  const gum = material('Bubble gum pink', '#ff8fc8', .3);
  const gumLip = material('Bubble gum lip', '#e8559f', .4);
  const pig = material('Piggy pink', '#f4a7a6', .6);
  const pigRim = material('Piggy rim', '#e48a8f', .6);
  const nostril = material('Piggy nostril', '#7a3a45', .8);
  const tie = material('Necktie red', '#d9434f', .55);
  const shirt = material('Shirt collar', '#f6f4ee', .7);
  const pearl = material('Crown pearl', '#f3ead2', .3);
  const velvet = material('Crown velvet', '#9b1d3a', .9);
  const royal = material('Medal ribbon blue', '#3a6fd8', .5);
  const leather = material('Eye patch leather', '#4a2c1e', .7);
  const front = mesh => { mesh.rotation.x = Math.PI/2; return mesh; };
  const dome = (name, diameter, arc = 1) => B.MeshBuilder.CreateSphere(name,{diameter,segments:20,slice:.5,arc},scene);
  const ball = (name, parent, mat, diameter, x, y, z) =>
    add(B.MeshBuilder.CreateSphere(name,{diameter,segments:10},scene),parent,mat,x,y,z);
  const ring = (name, parent, mat, diameter, thickness, x, y, z) =>
    add(B.MeshBuilder.CreateTorus(name,{diameter,thickness,tessellation:28},scene),parent,mat,x,y,z);
  // A torus whose axis follows the direction (dx, dy) in the face plane: a
  // collar round a horn or a tube that is heading that way.
  const collar = (name, parent, mat, diameter, thickness, [x, y, z], dx, dy) => {
    const mesh = ring(name, parent, mat, diameter, thickness, x, y, z);
    mesh.rotation.z = Math.atan2(-dx, dy); return mesh;
  };

  // Royal crown: ermine trim with its black tails, a gold band between two
  // rims, a red velvet cap rising inside it, five points each tipped with a
  // pearl and set with a stone, and the orb and cross on top.
  ring('Crown ermine',items.crown,pearl,.36,.06,0,.44,.015);
  for (let i = 0; i < 10; i++) {
    const a = (i+.5)/10*Math.PI*2;
    ball('Ermine tail',items.crown,black,.022,Math.sin(a)*.208,.44,.015+Math.cos(a)*.208);
  }
  add(cyl('Crown band',{diameter:.34,height:.11}),items.crown,gold,0,.50,.015);
  for (const y of [.452,.553]) ring('Crown band rim',items.crown,amber,.345,.018,0,y,.015);
  add(dome('Crown velvet cap',.31),items.crown,velvet,0,.54,.015).scaling.y = .9;
  for (let i = 0; i < 5; i++) {
    const a = i/5*Math.PI*2, x = Math.sin(a)*.155, z = .015+Math.cos(a)*.155;
    add(cyl('Crown point',{diameterTop:0,diameterBottom:.09,height:.14,tessellation:4}),items.crown,gold,x,.625,z).rotation.y = -a+Math.PI/4;
    ball('Crown point pearl',items.crown,pearl,.04,x,.70,z);
    ball('Crown jewel',items.crown,[red,royal,green,royal,green][i],i?.045:.06,Math.sin(a)*.172,.50,.015+Math.cos(a)*.172);
  }
  ball('Crown orb',items.crown,gold,.05,0,.69,.015);
  add(B.MeshBuilder.CreateBox('Crown cross',{width:.014,height:.07,depth:.014},scene),items.crown,gold,0,.745,.015);
  add(B.MeshBuilder.CreateBox('Crown cross',{width:.045,height:.014,depth:.014},scene),items.crown,gold,0,.755,.015);

  // Viking helmet: a steel dome over the crown of the head (slice:.5 keeps the
  // upper half of the sphere), bronze straps crossing it, rivets round the rim
  // and along the straps, a spike on top, and two horns curling out of the
  // sides with a bronze collar at the root of each.
  const helm = add(dome('Viking helmet dome',.60),items.vikingHelmet,steel,0,.36,.015); helm.scaling.y = .85;
  ring('Viking helmet rim',items.vikingHelmet,bronze,.60,.05,0,.36,.015);
  const arch = (fn) => Array.from({length:13},(_, i) => fn(i/12*Math.PI));
  tube('Viking helmet strap',items.vikingHelmet,bronze,arch(t => [Math.cos(t)*.302,.36+Math.sin(t)*.258,.015]),.017);
  tube('Viking helmet strap',items.vikingHelmet,bronze,arch(t => [0,.36+Math.sin(t)*.258,.015+Math.cos(t)*.302]),.017);
  for (let i = 0; i < 16; i++) {
    const a = i/16*Math.PI*2;
    ball('Viking rivet',items.vikingHelmet,steel,.026,Math.sin(a)*.326,.36,.015+Math.cos(a)*.326);
  }
  for (const t of [.45,.8,1.2]) for (const k of [-1,1]) {
    ball('Viking strap rivet',items.vikingHelmet,steel,.022,0,.36+Math.sin(t)*.272,.015+k*Math.cos(t)*.318);
    ball('Viking strap rivet',items.vikingHelmet,steel,.022,k*Math.cos(t)*.318,.36+Math.sin(t)*.272,.015);
  }
  add(cyl('Viking helmet spike',{diameterTop:0,diameterBottom:.06,height:.08,tessellation:16}),items.vikingHelmet,bronze,0,.65,.015);
  for (const side of [-1,1]) {
    add(B.MeshBuilder.CreateTube('Viking horn',{path:[[.24,.45,.02],[.36,.49,.03],[.45,.58,.04],[.48,.71,.05],[.45,.80,.06]].map(([x,y,z])=>new B.Vector3(side*x,y,z)),
      radiusFunction:(i)=>.055*(1-i/4.6),tessellation:12,cap:B.Mesh.CAP_ALL},scene),items.vikingHelmet,horn,0,0,0);
    collar('Viking horn collar',items.vikingHelmet,bronze,.105,.024,[side*.31,.47,.025],side*.12,.04);
    collar('Viking horn ridge',items.vikingHelmet,bronze,.075,.014,[side*.415,.535,.035],side*.09,.09);
  }

  // Propeller cap: a beanie sewn from four coloured panels with a button on
  // top, a peak over the eyes, and a two-bladed propeller that turns.
  const panels = [red, amber, royal, green];
  for (let i = 0; i < 4; i++) {
    const panel = add(dome('Propeller cap panel',.56,.25),items.propellerCap,panels[i],0,.40,.015);
    panel.scaling.y = .72; panel.rotation.y = i*Math.PI/2+Math.PI/4;
  }
  ball('Propeller cap button',items.propellerCap,red,.055,0,.60,.015);
  const peak = add(cyl('Propeller cap peak',{diameter:.30,height:.02}),items.propellerCap,red,0,.41,.24); peak.scaling.z = .6;
  ring('Propeller cap hem',items.propellerCap,pearl,.56,.025,0,.405,.015);
  add(cyl('Propeller stalk',{diameter:.025,height:.08,tessellation:12}),items.propellerCap,steel,0,.63,.015);
  const propeller = new B.TransformNode('Propeller', scene); propeller.parent = items.propellerCap; propeller.position.set(0,.675,.015);
  ball('Propeller hub',propeller,royal,.05,0,0,0);
  for (const side of [-1,1]) {
    const mat = side < 0 ? red : amber;
    const blade = add(cyl('Propeller blade',{diameterTop:.075,diameterBottom:.035,height:.17,tessellation:16}),propeller,mat,side*.1,0,0);
    blade.rotation.z = -Math.PI/2*side; blade.scaling.x = .2; blade.rotation.x = side*.3;
    ball('Propeller blade tip',propeller,mat,.04,side*.19,0,0).scaling.y = .35;
  }
  // The one moving part in the wardrobe. A wearer that freezes its world
  // matrices would stop it, which is harmless; the observer goes with the node
  // so a wearer that throws unworn items away (neonfox) leaves nothing behind.
  const spin = scene.onBeforeRenderObservable.add(() => {
    if (propeller.isEnabled()) propeller.rotation.y += Math.min(scene.getEngine().getDeltaTime(), 100) * .006;
  });
  propeller.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(spin));

  // Snorkel mask: a rubber skirt, an amber frame and one oval of glass across
  // both eyes with a glint on it, buckled straps, and a striped tube up the
  // side of the head from a mouthpiece to a splash guard.
  const skirt = add(front(cyl('Snorkel mask skirt',{diameter:.45,height:.05})),items.snorkel,black,0,.27,.305); skirt.scaling.z = .5;
  const mask = add(front(cyl('Snorkel mask frame',{diameter:.42,height:.05})),items.snorkel,amber,0,.27,.33); mask.scaling.z = .45;
  const glass = add(front(cyl('Snorkel mask glass',{diameter:.37,height:.02})),items.snorkel,sea,0,.27,.357); glass.scaling.z = .42;
  ball('Snorkel glint',items.snorkel,shine,.05,-.10,.31,.367).scaling.set(1.4,.5,.3);
  ball('Snorkel glint',items.snorkel,shine,.022,-.04,.32,.367).scaling.set(1,.6,.3);
  for (const side of [-1,1]) {
    add(B.MeshBuilder.CreateBox('Snorkel strap',{width:.03,height:.05,depth:.24},scene),items.snorkel,orange,side*.215,.27,.20);
    add(B.MeshBuilder.CreateBox('Snorkel buckle',{width:.04,height:.07,depth:.04},scene),items.snorkel,steel,side*.215,.27,.27);
  }
  tube('Snorkel tube',items.snorkel,orange,[[-.12,.14,.39],[-.24,.13,.33],[-.31,.24,.24],[-.32,.55,.20],[-.31,.70,.22]],.022);
  for (const y of [.36,.45,.54]) ring('Snorkel tube stripe',items.snorkel,sea,.05,.012,-.318,y,.205);
  add(B.MeshBuilder.CreateBox('Snorkel mouthpiece',{width:.07,height:.04,depth:.035},scene),items.snorkel,black,-.10,.14,.395);
  add(cyl('Snorkel splash guard',{diameter:.075,height:.06,tessellation:16}),items.snorkel,sea,-.31,.72,.22);
  ring('Snorkel splash guard rim',items.snorkel,amber,.075,.014,-.31,.75,.22);

  // Pirate eye patch over the eye the monocle leaves free: leather, stitched
  // round the edge, a skull and crossbones on the front, and its cord.
  const patch = add(front(cyl('Eye patch',{diameter:.17,height:.025})),items.eyePatch,black,-.127,.25,.325); patch.scaling.z = .85;
  ring('Eye patch stitching',items.eyePatch,leather,.165,.014,-.127,.25,.335).rotation.x = Math.PI/2;
  ball('Eye patch skull',items.eyePatch,pearl,.05,-.127,.262,.34).scaling.z = .45;
  for (const side of [-1,1]) {
    ball('Eye patch skull eye',items.eyePatch,black,.013,-.127+side*.011,.265,.352).scaling.z = .4;
    add(B.MeshBuilder.CreateBox('Eye patch crossbone',{width:.075,height:.012,depth:.01},scene),items.eyePatch,pearl,-.127,.225,.344).rotation.z = side*.55;
  }
  tube('Eye patch cord',items.eyePatch,leather,[[-.20,.29,.30],[-.27,.33,.19],[-.30,.36,.02]],.009);
  tube('Eye patch cord',items.eyePatch,leather,[[-.06,.30,.335],[.08,.37,.31],[.21,.42,.20],[.27,.44,.02]],.009);
  for (const x of [-.21,-.05]) ball('Eye patch rivet',items.eyePatch,gold,.02,x,.295,.315);

  // Bubble gum caught mid-blow: the lips of gum it is coming from, the bubble
  // with a glint on it, and a little one budding off the side.
  ring('Bubble gum lip',items.bubbleGum,gumLip,.075,.03,0,.11,.37).rotation.x = Math.PI/2;
  add(B.MeshBuilder.CreateSphere('Bubble gum',{diameter:.20,segments:24},scene),items.bubbleGum,gum,0,.11,.46);
  ball('Bubble gum bud',items.bubbleGum,gum,.06,.085,.06,.47);
  ball('Bubble gum glint',items.bubbleGum,shine,.05,-.038,.155,.545).scaling.set(1,.6,.3);
  ball('Bubble gum glint',items.bubbleGum,shine,.02,-.005,.17,.553).scaling.z = .3;

  // Piggy snout over the nose: a rounded rim, two deep nostrils, a little shine,
  // and the elastic that holds it on.
  add(front(cyl('Piggy snout',{diameter:.16,height:.07})),items.pigSnout,pig,0,.175,.405);
  ring('Piggy snout rim',items.pigSnout,pigRim,.15,.025,0,.175,.44).rotation.x = Math.PI/2;
  for (const side of [-1,1]) {
    const hole = add(front(cyl('Piggy nostril',{diameter:.04,height:.012,tessellation:12})),items.pigSnout,nostril,side*.032,.172,.441);
    hole.scaling.x = .65;
    tube('Piggy elastic',items.pigSnout,black,[[side*.075,.175,.40],[side*.2,.17,.34],[side*.28,.2,.16],[side*.30,.24,.02]],.006);
  }
  ball('Piggy shine',items.pigSnout,shine,.025,-.04,.215,.442).scaling.z = .3;

  // Office necktie. Not a scarf: the gopher's model already wears one, so a
  // neck item has to hang in front of it to be seen. A shirt collar for it to
  // come out of, a knot, a blade that is a four-sided cylinder flattened front
  // to back (it reads as a tie from any angle), three stripes and a tie clip.
  for (const side of [-1,1]) {
    const point = add(cyl('Shirt collar point',{diameterTop:0,diameterBottom:.07,height:.09,tessellation:3}),items.necktie,shirt,side*.05,-.075,.285);
    point.rotation.z = side*2.2; point.scaling.z = .35;
  }
  const knot = add(cyl('Necktie knot',{diameterTop:.085,diameterBottom:.06,height:.065,tessellation:4}),items.necktie,tie,0,-.07,.295);
  knot.scaling.z = .45;
  const blade = add(cyl('Necktie blade',{diameterTop:.07,diameterBottom:.12,height:.22,tessellation:4}),items.necktie,tie,0,-.21,.29); blade.scaling.z = .3;
  const tip = add(cyl('Necktie tip',{diameterTop:.12,diameterBottom:0,height:.06,tessellation:4}),items.necktie,tie,0,-.35,.29); tip.scaling.z = .3;
  for (const [y, w] of [[-.15,.075],[-.22,.09],[-.29,.105]])
    add(B.MeshBuilder.CreateBox('Necktie stripe',{width:w,height:.014,depth:.04},scene),items.necktie,amber,0,y,.291).rotation.z = -.5;
  add(B.MeshBuilder.CreateBox('Necktie clip',{width:.11,height:.014,depth:.012},scene),items.necktie,gold,0,-.255,.312);

  // Gold medal on a blue ribbon with a red stripe down its front, a clasp
  // where the two sides meet, and a star struck into the face.
  for (const side of [-1,1]) {
    const path = [[side*.19,-.02,.17],[side*.10,-.12,.27],[side*.012,-.20,.30]];
    tube('Medal ribbon',items.medal,royal,path,.02);
    tube('Medal ribbon stripe',items.medal,red,path.map(([x,y,z]) => [x,y,z+.014]),.008);
  }
  add(B.MeshBuilder.CreateBox('Medal clasp',{width:.06,height:.035,depth:.03},scene),items.medal,gold,0,-.195,.305);
  add(front(cyl('Gold medal',{diameter:.15,height:.025})),items.medal,gold,0,-.25,.31);
  ring('Gold medal rim',items.medal,amber,.13,.014,0,-.25,.325).rotation.x = Math.PI/2;
  for (let i = 0; i < 5; i++) {
    const a = i/5*Math.PI*2;
    const arm = add(cyl('Medal star point',{diameterTop:0,diameterBottom:.032,height:.04,tessellation:4}),items.medal,amber,Math.sin(a)*.022,-.25+Math.cos(a)*.022,.326);
    arm.rotation.z = -a; arm.scaling.z = .4;
  }
  add(front(cyl('Medal star heart',{diameter:.03,height:.012,tessellation:10})),items.medal,amber,0,-.25,.327);

  // Headphones, the gaming kind: a steel band with a padded crown, sliders
  // down to two cups with bright caps and a glowing light, and a microphone
  // on a boom swung round to the mouth.
  const glow = paint(scene, 'Headphone light', '#61d8b4', .4, .8);
  tube('Headphone band',items.headphones,steel,Array.from({length:13},(_, i) => {
    const t = i/12*Math.PI; return [Math.cos(t)*.31,.30+Math.sin(t)*.25,.04];
  }),.014);
  tube('Headphone padding',items.headphones,black,Array.from({length:7},(_, i) => {
    const t = (.3+i/6*.4)*Math.PI; return [Math.cos(t)*.30,.30+Math.sin(t)*.24,.04];
  }),.032);
  for (const side of [-1,1]) {
    add(B.MeshBuilder.CreateBox('Headphone slider',{width:.025,height:.10,depth:.04},scene),items.headphones,steel,side*.33,.40,.04);
    add(cyl('Headphone cup',{diameter:.19,height:.08}),items.headphones,pink,side*.33,.30,.04).rotation.z = Math.PI/2;
    add(cyl('Headphone cushion',{diameter:.16,height:.04}),items.headphones,black,side*.28,.30,.04).rotation.z = Math.PI/2;
    add(cyl('Headphone cap',{diameter:.14,height:.02}),items.headphones,pearl,side*.375,.30,.04).rotation.z = Math.PI/2;
    add(cyl('Headphone light',{diameter:.05,height:.012,tessellation:16}),items.headphones,glow,side*.387,.30,.04).rotation.z = Math.PI/2;
  }
  tube('Microphone boom',items.headphones,black,[[-.36,.26,.10],[-.33,.17,.25],[-.24,.11,.36],[-.14,.10,.40]],.011);
  ball('Microphone',items.headphones,black,.045,-.13,.10,.405);

  // The first rack, brought up to the second (2026-10-07). Only detail is
  // added here: every base shape above stays where it was, because wearers
  // tuned their fit against it (neonfox ITEM_FIT).
  const glowLime = paint(scene, 'Alien glow', '#c8ff8a', .3, .7);
  const gem = material('Earring gem', '#36cdb9', .15);
  // The top hat stays exactly as it was: a feather on it read as a costume of
  // something else entirely, and the plain hat was already the right one.
  // Alien antennae: a headband joining them, springs coiled up each stalk,
  // and glowing tips each wearing a little ring like a planet.
  tube('Antenna headband',items.antennae,green,Array.from({length:11},(_, i) => {
    const t = i/10*Math.PI; return [Math.cos(t)*.265,.30+Math.sin(t)*.19,0];
  }),.018);
  for (const side of [-1,1]) {
    for (const t of [.25,.45,.65]) collar('Antenna coil',items.antennae,green,.045,.01,[side*(.26+t*.11),.39+t*.36,.01*t],side*.08,.25);
    ball('Antenna glow',items.antennae,glowLime,.055,side*.32,.87,.075).scaling.z = .3;
    const orbit = ring('Antenna tip ring',items.antennae,amber,.15,.012,side*.32,.87,.015);
    orbit.rotation.set(.35,0,side*.35);
  }
  // Silly sunglasses: rhinestones along the top of each frame, a glint on each
  // lens, and gold studs at the hinges.
  for (const side of [-1,1]) {
    for (let i = 0; i < 5; i++) {
      const a = (.15+i*.175)*Math.PI;
      ball('Sunglass rhinestone',glasses,pearl,.024,side*.127+Math.cos(a)*.107,.25+Math.sin(a)*.107,.322);
    }
    ball('Sunglass glint',glasses,shine,.045,side*.127-.035,.285,.316).scaling.set(1.2,.5,.3);
    ball('Sunglass hinge',glasses,gold,.03,side*.235,.25,.31);
  }
  // Monocle: a glint across the glass, a loop where the chain meets the rim,
  // the chain itself picked out in beads, and a fob on the end.
  ball('Monocle glint',items.monocle,shine,.04,.10,.29,.358).scaling.set(1.2,.45,.3);
  ring('Monocle chain loop',items.monocle,gold,.03,.008,.233,.25,.352).rotation.z = Math.PI/2;
  for (const [x,y,z] of [[.252,.18,.34],[.262,.09,.325],[.255,.02,.305],[.215,-.045,.285]]) ball('Monocle chain bead',items.monocle,gold,.016,x,y,z);
  ball('Monocle fob',items.monocle,gold,.04,.16,-.075,.27);
  // Clown nose: a glint and a second, smaller one, so it reads as shiny rubber.
  ball('Clown nose glint',items.clownNose,shine,.035,-.025,.205,.475).scaling.z = .4;
  ball('Clown nose glint',items.clownNose,shine,.014,.01,.215,.48);
  // Bow tie: polka dots on each wing and a band wrapped round the knot.
  for (const side of [-1,1]) for (const [x, y] of [[.06,-.03],[.10,-.07],[.11,-.025],[.065,-.08]])
    ball('Bow tie polka dot',items.bowTie,pearl,.02,side*x,y,.30).scaling.z = .4;
  ring('Bow tie knot band',items.bowTie,pink,.06,.02,0,-.055,.28).rotation.z = Math.PI/2;
  // Golden hoops: a stud at the lobe, three beads round the bottom of the hoop
  // and a teardrop gem hanging from it.
  for (const side of [-1,1]) {
    ball('Earring stud',items.earrings,gold,.03,side*.285,.355,.055);
    for (const a of [-.5,0,.5]) ball('Earring bead',items.earrings,pearl,.018,side*.285+Math.sin(a)*.057,.30-Math.cos(a)*.057,.055);
    const drop = ball('Earring gem',items.earrings,gem,.04,side*.285,.215,.055); drop.scaling.y = 1.4;
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
