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

/**
 * Every colour the items are painted in, by the name the builders below use.
 *
 * A table rather than forty `paint()` calls up front, because a material is
 * only made the first time an item that wears it is built (see
 * makeAccessories): a gopher in a top hat costs two materials, not forty.
 * [material name, hex, roughness, glow] — glow as paint() reads it.
 */
const PAINTS = {
  black: ['Hat felt', '#192033', .75],
  pink: ['Silly pink frames', '#f653ad', .45],
  lens: ['Sunglass lenses', '#172c46', .2],
  band: ['Hat satin ribbon', '#36cdb9', .4],
  gold: ['Accessory gold', '#e9bb56', .35],
  red: ['Clown cherry red', '#ed4261', .4],
  green: ['Alien lime', '#a4eb69', .5],
  steel: ['Helmet steel', '#9aa7b4', .35],
  bronze: ['Helmet bronze', '#b9783a', .4],
  horn: ['Helmet horn', '#efe2c2', .6],
  amber: ['Accessory amber', '#f4c35c', .45],
  orange: ['Snorkel orange', '#f08a3c', .45],
  sea: ['Snorkel glass', '#3d8fb0', .12],
  shine: ['Glass highlight', '#f2fbff', .05, .45],
  gum: ['Bubble gum pink', '#ff8fc8', .3],
  gumLip: ['Bubble gum lip', '#e8559f', .4],
  pig: ['Piggy pink', '#f4a7a6', .6],
  pigRim: ['Piggy rim', '#e48a8f', .6],
  nostril: ['Piggy nostril', '#7a3a45', .8],
  tie: ['Necktie red', '#d9434f', .55],
  shirt: ['Shirt collar', '#f6f4ee', .7],
  pearl: ['Crown pearl', '#f3ead2', .3],
  velvet: ['Crown velvet', '#9b1d3a', .9],
  royal: ['Medal ribbon blue', '#3a6fd8', .5],
  leather: ['Eye patch leather', '#4a2c1e', .7],
  glow: ['Headphone light', '#61d8b4', .4, .8],
  glowLime: ['Alien glow', '#c8ff8a', .3, .7],
  gem: ['Earring gem', '#36cdb9', .15],
};

/**
 * How each item is built, one function per id, into its own node.
 *
 * `k` is the kit: the mesh helpers and `k.m`, the materials by PAINTS name.
 * Everything is head-local, facing +Z, in the gopher's head units, and the
 * landmarks are the same for every item: eyes (+-.127,.25,.307), nose tip
 * (0,.17,.417), ears (+-.285,.30,.055), the top hat's brim at y .47, the bow
 * tie's knot at (0,-.055,.28). Nothing is transparent and nothing is textured,
 * because a wearer that relights the items (fishtank repaints each mesh from
 * its albedo) must be able to carry them over as a flat colour each. Wearers
 * tuned their fit against these exact shapes (neonfox ITEM_FIT, fishtank
 * EYEWEAR, which also matches meshes BY NAME), so a builder only ever gains
 * detail; nothing already here moves or is renamed.
 *
 * The first rack (top hat to golden hoops) was brought up to the second's
 * detail on 2026-10-07; that detail now sits in each item's own builder rather
 * than in a pass at the end.
 */
const BUILD = {
  // The top hat stays exactly as it was: a feather on it read as a costume of
  // something else entirely, and the plain hat was already the right one.
  topHat(n, { m, add, cyl }) {
    add(cyl('Top hat brim',{diameter:.56,height:.035}),n,m.black,0,.47,.015);
    add(cyl('Top hat crown',{diameterTop:.40,diameterBottom:.34,height:.34}),n,m.black,0,.65,.015);
    add(cyl('Top hat band',{diameter:.365,height:.065}),n,m.band,0,.515,.015);
  },

  // Round pink frames, rhinestones along the top of each, a glint on each
  // lens, and gold studs at the hinges.
  sunglasses(n, { B, scene, m, add, cyl, ball }) {
    for (const side of [-1,1]) {
      const frame = B.MeshBuilder.CreateTorus('Round pink sunglass frame',{diameter:.215,thickness:.033,tessellation:32},scene);
      frame.rotation.x=Math.PI/2;
      add(frame,n,m.pink,side*.127,.25,.307);
      const glass = cyl('Dark sunglass lens',{diameter:.188,height:.015}); glass.rotation.x=Math.PI/2;
      add(glass,n,m.lens,side*.127,.25,.307);
      add(B.MeshBuilder.CreateBox('Sunglass arm',{width:.025,height:.028,depth:.23},scene),n,m.pink,side*.25,.25,.195);
    }
    add(B.MeshBuilder.CreateBox('Sunglass bridge',{width:.071,height:.025,depth:.026},scene),n,m.pink,0,.263,.308);
    for (const side of [-1,1]) {
      for (let i = 0; i < 5; i++) {
        const a = (.15+i*.175)*Math.PI;
        ball('Sunglass rhinestone',n,m.pearl,.024,side*.127+Math.cos(a)*.107,.25+Math.sin(a)*.107,.322);
      }
      ball('Sunglass glint',n,m.shine,.045,side*.127-.035,.285,.316).scaling.set(1.2,.5,.3);
      ball('Sunglass hinge',n,m.gold,.03,side*.235,.25,.31);
    }
  },

  // A gold rim and its chain, a glint across the glass, a loop where the
  // chain meets the rim, the chain picked out in beads, and a fob on the end.
  monocle(n, { B, scene, m, add, tube, ball, ring }) {
    const mono = B.MeshBuilder.CreateTorus('Monocle gold rim',{diameter:.21,thickness:.018,tessellation:32},scene);
    mono.rotation.x = Math.PI/2; add(mono,n,m.gold,.127,.25,.353);
    tube('Monocle chain',n,m.gold,[[.23,.25,.35],[.265,.12,.33],[.24,-.02,.29],[.16,-.07,.27]],.006);
    ball('Monocle glint',n,m.shine,.04,.10,.29,.358).scaling.set(1.2,.45,.3);
    ring('Monocle chain loop',n,m.gold,.03,.008,.233,.25,.352).rotation.z = Math.PI/2;
    for (const [x,y,z] of [[.252,.18,.34],[.262,.09,.325],[.255,.02,.305],[.215,-.045,.285]]) ball('Monocle chain bead',n,m.gold,.016,x,y,z);
    ball('Monocle fob',n,m.gold,.04,.16,-.075,.27);
  },

  // Thick at the lip and waxed to a point that curls back on itself.
  mustache(n, { B, scene, m, add }) {
    for (const side of [-1,1]) {
      const curl=[[0,.125,.404],[side*.055,.15,.416],[side*.13,.09,.417],[side*.19,.105,.40],[side*.21,.145,.39],[side*.195,.172,.388],[side*.172,.163,.392],[side*.178,.143,.396]];
      add(B.MeshBuilder.CreateTube('Curled mustache',{path:curl.map(p=>new B.Vector3(...p)),radiusFunction:(i)=>.03*(1-i/8.5)+.003,tessellation:10,cap:B.Mesh.CAP_ALL},scene),n,m.black,0,0,0);
    }
  },

  // Two wings and a knot, polka dots on each wing and a band round the knot.
  bowTie(n, { B, scene, m, add, ball, ring }) {
    for (const side of [-1,1]) {
      const tie=B.MeshBuilder.CreateCylinder('Bow tie wing',{diameterTop:.13,diameterBottom:.025,height:.13,tessellation:3},scene);
      tie.rotation.z=side*Math.PI/2;add(tie,n,m.pink,side*.072,-.055,.27);
    }
    add(B.MeshBuilder.CreateSphere('Bow tie knot',{diameter:.065,segments:12},scene),n,m.pink,0,-.055,.28);
    for (const side of [-1,1]) for (const [x, y] of [[.06,-.03],[.10,-.07],[.11,-.025],[.065,-.08]])
      ball('Bow tie polka dot',n,m.pearl,.02,side*x,y,.30).scaling.z = .4;
    ring('Bow tie knot band',n,m.pink,.06,.02,0,-.055,.28).rotation.z = Math.PI/2;
  },

  // Golden hoops: a stud at the lobe, three beads round the bottom of the
  // hoop and a teardrop gem hanging from it.
  earrings(n, { B, scene, m, add, ball }) {
    for (const side of [-1,1]) {
      const hoop=B.MeshBuilder.CreateTorus('Golden earring',{diameter:.115,thickness:.018,tessellation:24},scene);
      hoop.rotation.x=Math.PI/2;add(hoop,n,m.gold,side*.285,.30,.055);
    }
    for (const side of [-1,1]) {
      ball('Earring stud',n,m.gold,.03,side*.285,.355,.055);
      for (const a of [-.5,0,.5]) ball('Earring bead',n,m.pearl,.018,side*.285+Math.sin(a)*.057,.30-Math.cos(a)*.057,.055);
      const drop = ball('Earring gem',n,m.gem,.04,side*.285,.215,.055); drop.scaling.y = 1.4;
    }
  },

  // Alien antennae: a headband joining them, springs coiled up each stalk,
  // and glowing tips each wearing a little ring like a planet.
  antennae(n, { B, scene, m, add, tube, ball, ring, collar }) {
    for (const side of [-1,1]) {
      tube('Alien antenna',n,m.band,[[side*.26,.39,0],[side*.34,.64,.015],[side*.32,.87,.015]],.013);
      add(B.MeshBuilder.CreateSphere('Alien antenna tip',{diameter:.10,segments:12},scene),n,m.green,side*.32,.87,.015);
    }
    tube('Antenna headband',n,m.green,Array.from({length:11},(_, i) => {
      const t = i/10*Math.PI; return [Math.cos(t)*.265,.30+Math.sin(t)*.19,0];
    }),.018);
    for (const side of [-1,1]) {
      for (const t of [.25,.45,.65]) collar('Antenna coil',n,m.green,.045,.01,[side*(.26+t*.11),.39+t*.36,.01*t],side*.08,.25);
      ball('Antenna glow',n,m.glowLime,.055,side*.32,.87,.075).scaling.z = .3;
      const orbit = ring('Antenna tip ring',n,m.amber,.15,.012,side*.32,.87,.015);
      orbit.rotation.set(.35,0,side*.35);
    }
  },

  // A cherry-red ball with a glint and a second, smaller one, so it reads as
  // shiny rubber.
  clownNose(n, { B, scene, m, add, ball }) {
    add(B.MeshBuilder.CreateSphere('Clown nose',{diameter:.145,segments:20},scene),n,m.red,0,.17,.417);
    ball('Clown nose glint',n,m.shine,.035,-.025,.205,.475).scaling.z = .4;
    ball('Clown nose glint',n,m.shine,.014,.01,.215,.48);
  },

  // Royal crown: ermine trim with its black tails, a gold band between two
  // rims, a red velvet cap rising inside it, five points each tipped with a
  // pearl and set with a stone, and the orb and cross on top.
  crown(n, { B, scene, m, add, cyl, ball, ring, dome }) {
    ring('Crown ermine',n,m.pearl,.36,.06,0,.44,.015);
    for (let i = 0; i < 10; i++) {
      const a = (i+.5)/10*Math.PI*2;
      ball('Ermine tail',n,m.black,.022,Math.sin(a)*.208,.44,.015+Math.cos(a)*.208);
    }
    add(cyl('Crown band',{diameter:.34,height:.11}),n,m.gold,0,.50,.015);
    for (const y of [.452,.553]) ring('Crown band rim',n,m.amber,.345,.018,0,y,.015);
    add(dome('Crown velvet cap',.31),n,m.velvet,0,.54,.015).scaling.y = .9;
    for (let i = 0; i < 5; i++) {
      const a = i/5*Math.PI*2, x = Math.sin(a)*.155, z = .015+Math.cos(a)*.155;
      add(cyl('Crown point',{diameterTop:0,diameterBottom:.09,height:.14,tessellation:4}),n,m.gold,x,.625,z).rotation.y = -a+Math.PI/4;
      ball('Crown point pearl',n,m.pearl,.04,x,.70,z);
      ball('Crown jewel',n,[m.red,m.royal,m.green,m.royal,m.green][i],i?.045:.06,Math.sin(a)*.172,.50,.015+Math.cos(a)*.172);
    }
    ball('Crown orb',n,m.gold,.05,0,.69,.015);
    add(B.MeshBuilder.CreateBox('Crown cross',{width:.014,height:.07,depth:.014},scene),n,m.gold,0,.745,.015);
    add(B.MeshBuilder.CreateBox('Crown cross',{width:.045,height:.014,depth:.014},scene),n,m.gold,0,.755,.015);
  },

  // Viking helmet: a steel dome over the crown of the head (slice:.5 keeps the
  // upper half of the sphere), bronze straps crossing it, rivets round the rim
  // and along the straps, a spike on top, and two horns curling out of the
  // sides with a bronze collar at the root of each.
  vikingHelmet(n, { B, scene, m, add, cyl, tube, ball, ring, collar, dome }) {
    const helm = add(dome('Viking helmet dome',.60),n,m.steel,0,.36,.015); helm.scaling.y = .85;
    ring('Viking helmet rim',n,m.bronze,.60,.05,0,.36,.015);
    const arch = (fn) => Array.from({length:13},(_, i) => fn(i/12*Math.PI));
    tube('Viking helmet strap',n,m.bronze,arch(t => [Math.cos(t)*.302,.36+Math.sin(t)*.258,.015]),.017);
    tube('Viking helmet strap',n,m.bronze,arch(t => [0,.36+Math.sin(t)*.258,.015+Math.cos(t)*.302]),.017);
    for (let i = 0; i < 16; i++) {
      const a = i/16*Math.PI*2;
      ball('Viking rivet',n,m.steel,.026,Math.sin(a)*.326,.36,.015+Math.cos(a)*.326);
    }
    for (const t of [.45,.8,1.2]) for (const k of [-1,1]) {
      ball('Viking strap rivet',n,m.steel,.022,0,.36+Math.sin(t)*.272,.015+k*Math.cos(t)*.318);
      ball('Viking strap rivet',n,m.steel,.022,k*Math.cos(t)*.318,.36+Math.sin(t)*.272,.015);
    }
    add(cyl('Viking helmet spike',{diameterTop:0,diameterBottom:.06,height:.08,tessellation:16}),n,m.bronze,0,.65,.015);
    for (const side of [-1,1]) {
      add(B.MeshBuilder.CreateTube('Viking horn',{path:[[.24,.45,.02],[.36,.49,.03],[.45,.58,.04],[.48,.71,.05],[.45,.80,.06]].map(([x,y,z])=>new B.Vector3(side*x,y,z)),
        radiusFunction:(i)=>.055*(1-i/4.6),tessellation:12,cap:B.Mesh.CAP_ALL},scene),n,m.horn,0,0,0);
      collar('Viking horn collar',n,m.bronze,.105,.024,[side*.31,.47,.025],side*.12,.04);
      collar('Viking horn ridge',n,m.bronze,.075,.014,[side*.415,.535,.035],side*.09,.09);
    }
  },

  // Propeller cap: a beanie sewn from four coloured panels with a button on
  // top, a peak over the eyes, and a two-bladed propeller that turns.
  propellerCap(n, { B, scene, m, add, cyl, ball, ring, dome }) {
    const panels = [m.red, m.amber, m.royal, m.green];
    for (let i = 0; i < 4; i++) {
      const panel = add(dome('Propeller cap panel',.56,.25),n,panels[i],0,.40,.015);
      panel.scaling.y = .72; panel.rotation.y = i*Math.PI/2+Math.PI/4;
    }
    ball('Propeller cap button',n,m.red,.055,0,.60,.015);
    const peak = add(cyl('Propeller cap peak',{diameter:.30,height:.02}),n,m.red,0,.41,.24); peak.scaling.z = .6;
    ring('Propeller cap hem',n,m.pearl,.56,.025,0,.405,.015);
    add(cyl('Propeller stalk',{diameter:.025,height:.08,tessellation:12}),n,m.steel,0,.63,.015);
    const propeller = new B.TransformNode('Propeller', scene); propeller.parent = n; propeller.position.set(0,.675,.015);
    ball('Propeller hub',propeller,m.royal,.05,0,0,0);
    for (const side of [-1,1]) {
      const mat = side < 0 ? m.red : m.amber;
      const blade = add(cyl('Propeller blade',{diameterTop:.075,diameterBottom:.035,height:.17,tessellation:16}),propeller,mat,side*.1,0,0);
      blade.rotation.z = -Math.PI/2*side; blade.scaling.x = .2; blade.rotation.x = side*.3;
      ball('Propeller blade tip',propeller,mat,.04,side*.19,0,0).scaling.y = .35;
    }
    // The one moving part in the wardrobe. A wearer that freezes its world
    // matrices would stop it, which is harmless; the observer goes with the
    // node so a wearer that throws unworn items away (neonfox) leaves nothing
    // behind. It is only made at all when somebody puts the cap on.
    const spin = scene.onBeforeRenderObservable.add(() => {
      if (propeller.isEnabled()) propeller.rotation.y += Math.min(scene.getEngine().getDeltaTime(), 100) * .006;
    });
    propeller.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(spin));
  },

  // Snorkel mask: a rubber skirt, an amber frame and one oval of glass across
  // both eyes with a glint on it, buckled straps, and a striped tube up the
  // side of the head from a mouthpiece to a splash guard.
  snorkel(n, { B, scene, m, add, cyl, tube, ball, ring, front }) {
    const skirt = add(front(cyl('Snorkel mask skirt',{diameter:.45,height:.05})),n,m.black,0,.27,.305); skirt.scaling.z = .5;
    const mask = add(front(cyl('Snorkel mask frame',{diameter:.42,height:.05})),n,m.amber,0,.27,.33); mask.scaling.z = .45;
    const glass = add(front(cyl('Snorkel mask glass',{diameter:.37,height:.02})),n,m.sea,0,.27,.357); glass.scaling.z = .42;
    ball('Snorkel glint',n,m.shine,.05,-.10,.31,.367).scaling.set(1.4,.5,.3);
    ball('Snorkel glint',n,m.shine,.022,-.04,.32,.367).scaling.set(1,.6,.3);
    for (const side of [-1,1]) {
      add(B.MeshBuilder.CreateBox('Snorkel strap',{width:.03,height:.05,depth:.24},scene),n,m.orange,side*.215,.27,.20);
      add(B.MeshBuilder.CreateBox('Snorkel buckle',{width:.04,height:.07,depth:.04},scene),n,m.steel,side*.215,.27,.27);
    }
    tube('Snorkel tube',n,m.orange,[[-.12,.14,.39],[-.24,.13,.33],[-.31,.24,.24],[-.32,.55,.20],[-.31,.70,.22]],.022);
    for (const y of [.36,.45,.54]) ring('Snorkel tube stripe',n,m.sea,.05,.012,-.318,y,.205);
    add(B.MeshBuilder.CreateBox('Snorkel mouthpiece',{width:.07,height:.04,depth:.035},scene),n,m.black,-.10,.14,.395);
    add(cyl('Snorkel splash guard',{diameter:.075,height:.06,tessellation:16}),n,m.sea,-.31,.72,.22);
    ring('Snorkel splash guard rim',n,m.amber,.075,.014,-.31,.75,.22);
  },

  // Pirate eye patch over the eye the monocle leaves free: leather, stitched
  // round the edge, a skull and crossbones on the front, and its cord.
  eyePatch(n, { B, scene, m, add, cyl, tube, ball, ring, front }) {
    const patch = add(front(cyl('Eye patch',{diameter:.17,height:.025})),n,m.black,-.127,.25,.325); patch.scaling.z = .85;
    ring('Eye patch stitching',n,m.leather,.165,.014,-.127,.25,.335).rotation.x = Math.PI/2;
    ball('Eye patch skull',n,m.pearl,.05,-.127,.262,.34).scaling.z = .45;
    for (const side of [-1,1]) {
      ball('Eye patch skull eye',n,m.black,.013,-.127+side*.011,.265,.352).scaling.z = .4;
      add(B.MeshBuilder.CreateBox('Eye patch crossbone',{width:.075,height:.012,depth:.01},scene),n,m.pearl,-.127,.225,.344).rotation.z = side*.55;
    }
    tube('Eye patch cord',n,m.leather,[[-.20,.29,.30],[-.27,.33,.19],[-.30,.36,.02]],.009);
    tube('Eye patch cord',n,m.leather,[[-.06,.30,.335],[.08,.37,.31],[.21,.42,.20],[.27,.44,.02]],.009);
    for (const x of [-.21,-.05]) ball('Eye patch rivet',n,m.gold,.02,x,.295,.315);
  },

  // Bubble gum caught mid-blow: the lips of gum it is coming from, the bubble
  // with a glint on it, and a little one budding off the side.
  bubbleGum(n, { B, scene, m, add, ball, ring }) {
    ring('Bubble gum lip',n,m.gumLip,.075,.03,0,.11,.37).rotation.x = Math.PI/2;
    add(B.MeshBuilder.CreateSphere('Bubble gum',{diameter:.20,segments:24},scene),n,m.gum,0,.11,.46);
    ball('Bubble gum bud',n,m.gum,.06,.085,.06,.47);
    ball('Bubble gum glint',n,m.shine,.05,-.038,.155,.545).scaling.set(1,.6,.3);
    ball('Bubble gum glint',n,m.shine,.02,-.005,.17,.553).scaling.z = .3;
  },

  // Piggy snout over the nose: a rounded rim, two deep nostrils, a little
  // shine, and the elastic that holds it on.
  pigSnout(n, { m, add, cyl, tube, ball, ring, front }) {
    add(front(cyl('Piggy snout',{diameter:.16,height:.07})),n,m.pig,0,.175,.405);
    ring('Piggy snout rim',n,m.pigRim,.15,.025,0,.175,.44).rotation.x = Math.PI/2;
    for (const side of [-1,1]) {
      const hole = add(front(cyl('Piggy nostril',{diameter:.04,height:.012,tessellation:12})),n,m.nostril,side*.032,.172,.441);
      hole.scaling.x = .65;
      tube('Piggy elastic',n,m.black,[[side*.075,.175,.40],[side*.2,.17,.34],[side*.28,.2,.16],[side*.30,.24,.02]],.006);
    }
    ball('Piggy shine',n,m.shine,.025,-.04,.215,.442).scaling.z = .3;
  },

  // Office necktie. Not a scarf: the gopher's model already wears one, so a
  // neck item has to hang in front of it to be seen. A shirt collar for it to
  // come out of, a knot, a blade that is a four-sided cylinder flattened front
  // to back (it reads as a tie from any angle), three stripes and a tie clip.
  necktie(n, { B, scene, m, add, cyl }) {
    for (const side of [-1,1]) {
      const point = add(cyl('Shirt collar point',{diameterTop:0,diameterBottom:.07,height:.09,tessellation:3}),n,m.shirt,side*.05,-.075,.285);
      point.rotation.z = side*2.2; point.scaling.z = .35;
    }
    const knot = add(cyl('Necktie knot',{diameterTop:.085,diameterBottom:.06,height:.065,tessellation:4}),n,m.tie,0,-.07,.295);
    knot.scaling.z = .45;
    const blade = add(cyl('Necktie blade',{diameterTop:.07,diameterBottom:.12,height:.22,tessellation:4}),n,m.tie,0,-.21,.29); blade.scaling.z = .3;
    const tip = add(cyl('Necktie tip',{diameterTop:.12,diameterBottom:0,height:.06,tessellation:4}),n,m.tie,0,-.35,.29); tip.scaling.z = .3;
    for (const [y, w] of [[-.15,.075],[-.22,.09],[-.29,.105]])
      add(B.MeshBuilder.CreateBox('Necktie stripe',{width:w,height:.014,depth:.04},scene),n,m.amber,0,y,.291).rotation.z = -.5;
    add(B.MeshBuilder.CreateBox('Necktie clip',{width:.11,height:.014,depth:.012},scene),n,m.gold,0,-.255,.312);
  },

  // Gold medal on a blue ribbon with a red stripe down its front, a clasp
  // where the two sides meet, and a star struck into the face.
  medal(n, { B, scene, m, add, cyl, tube, ring, front }) {
    for (const side of [-1,1]) {
      const path = [[side*.19,-.02,.17],[side*.10,-.12,.27],[side*.012,-.20,.30]];
      tube('Medal ribbon',n,m.royal,path,.02);
      tube('Medal ribbon stripe',n,m.red,path.map(([x,y,z]) => [x,y,z+.014]),.008);
    }
    add(B.MeshBuilder.CreateBox('Medal clasp',{width:.06,height:.035,depth:.03},scene),n,m.gold,0,-.195,.305);
    add(front(cyl('Gold medal',{diameter:.15,height:.025})),n,m.gold,0,-.25,.31);
    ring('Gold medal rim',n,m.amber,.13,.014,0,-.25,.325).rotation.x = Math.PI/2;
    for (let i = 0; i < 5; i++) {
      const a = i/5*Math.PI*2;
      const arm = add(cyl('Medal star point',{diameterTop:0,diameterBottom:.032,height:.04,tessellation:4}),n,m.amber,Math.sin(a)*.022,-.25+Math.cos(a)*.022,.326);
      arm.rotation.z = -a; arm.scaling.z = .4;
    }
    add(front(cyl('Medal star heart',{diameter:.03,height:.012,tessellation:10})),n,m.amber,0,-.25,.327);
  },

  // Headphones, the gaming kind: a steel band with a padded crown, sliders
  // down to two cups with bright caps and a glowing light, and a microphone
  // on a boom swung round to the mouth.
  headphones(n, { B, scene, m, add, cyl, tube, ball }) {
    tube('Headphone band',n,m.steel,Array.from({length:13},(_, i) => {
      const t = i/12*Math.PI; return [Math.cos(t)*.31,.30+Math.sin(t)*.25,.04];
    }),.014);
    tube('Headphone padding',n,m.black,Array.from({length:7},(_, i) => {
      const t = (.3+i/6*.4)*Math.PI; return [Math.cos(t)*.30,.30+Math.sin(t)*.24,.04];
    }),.032);
    for (const side of [-1,1]) {
      add(B.MeshBuilder.CreateBox('Headphone slider',{width:.025,height:.10,depth:.04},scene),n,m.steel,side*.33,.40,.04);
      add(cyl('Headphone cup',{diameter:.19,height:.08}),n,m.pink,side*.33,.30,.04).rotation.z = Math.PI/2;
      add(cyl('Headphone cushion',{diameter:.16,height:.04}),n,m.black,side*.28,.30,.04).rotation.z = Math.PI/2;
      add(cyl('Headphone cap',{diameter:.14,height:.02}),n,m.pearl,side*.375,.30,.04).rotation.z = Math.PI/2;
      add(cyl('Headphone light',{diameter:.05,height:.012,tessellation:16}),n,m.glow,side*.387,.30,.04).rotation.z = Math.PI/2;
    }
    tube('Microphone boom',n,m.black,[[-.36,.26,.10],[-.33,.17,.25],[-.24,.11,.36],[-.14,.10,.40]],.011);
    ball('Microphone',n,m.black,.045,-.13,.10,.405);
  },
};

/**
 * Fold every still mesh under `node` into one mesh per material, level by
 * level: a child TransformNode (a propeller, a pet's ear pivot) is folded in
 * its own right and stays a node, so whatever turns it still turns its parts.
 * `keep(mesh)` names meshes that must stay loose — ones that move on their
 * own, or that something finds by name later.
 *
 * WHY NOT room.js mergeStatic. Two reasons, both about what this file is for.
 * It imports nothing (see the header), so a game can load it alone. And the
 * items are full of squashed spheres — glints scaled (1.2, .5, .3), a pet's
 * ear (.15, .48, .075) — which Babylon lights with the inverse-transpose of
 * their matrix. Babylon's MergeMeshes bakes normals with the plain matrix, so
 * a squashed glint folded that way would turn its highlight the wrong way.
 * This bakes normals the way the shader would have, so a fold changes the
 * draw-call count and nothing a player could see. It works in the node's OWN
 * space, so a parent that is moving, scaled or mid-pose does not matter.
 *
 * A group whose meshes disagree on vertex attributes is split, as in
 * mergeStatic, and a fold that throws leaves that group exactly as it was.
 * Returns the meshes it made.
 */
export function foldByMaterial(node, keep = () => false) {
  const B = BABYLON;
  const scene = node.getScene();
  const made = [];
  const groups = new Map();
  for (const child of node.getChildren(undefined, true)) {
    const isMesh = child.getClassName?.() === 'Mesh';
    if (!isMesh || child.getChildren().length) {
      // A pivot, or a mesh carrying children of its own: fold beneath it.
      if (child instanceof B.TransformNode && !keep(child)) made.push(...foldByMaterial(child, keep));
      continue;
    }
    if (keep(child) || !child.material || !child.getTotalVertices() || child.skeleton ||
      child.morphTargetManager || child.instances?.length || child.billboardMode) continue;
    if (scene.effectLayers?.some((l) => l._excludedMeshes?.includes(child.uniqueId))) continue;
    const kinds = child.getVerticesDataKinds().slice().sort().join(',');
    const key = `${child.material.uniqueId}|${kinds}|${child.receiveShadows}|${child.isEnabled(false)}|${child.isVisible}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(child);
  }
  const normal = new B.Matrix(), v = new B.Vector3();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    try {
      const parts = group.map((mesh) => {
        const local = B.Matrix.Compose(mesh.scaling,
          mesh.rotationQuaternion || B.Quaternion.RotationYawPitchRoll(mesh.rotation.y, mesh.rotation.x, mesh.rotation.z),
          mesh.position);
        local.invertToRef(normal); normal.transposeToRef(normal);
        const data = B.VertexData.ExtractFromMesh(mesh, true, true);
        const p = data.positions, nm = data.normals;
        for (let i = 0; i < p.length; i += 3) {
          B.Vector3.TransformCoordinatesFromFloatsToRef(p[i], p[i + 1], p[i + 2], local, v);
          p[i] = v.x; p[i + 1] = v.y; p[i + 2] = v.z;
        }
        if (nm) for (let i = 0; i < nm.length; i += 3) {
          B.Vector3.TransformNormalFromFloatsToRef(nm[i], nm[i + 1], nm[i + 2], normal, v);
          v.normalize(); nm[i] = v.x; nm[i + 1] = v.y; nm[i + 2] = v.z;
        }
        // A mirroring matrix turns every triangle inside out; wind them back.
        if (local.determinant() < 0) {
          const ix = data.indices;
          for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
        }
        return data;
      });
      const data = parts[0].merge(parts.slice(1), true);
      const { material, receiveShadows } = group[0];
      const one = new B.Mesh(`${node.name}: ${material.name}`, scene);
      data.applyToMesh(one, false);
      one.parent = node;
      one.material = material;
      one.receiveShadows = receiveShadows;
      one.isPickable = false;
      one.setEnabled(group[0].isEnabled(false));
      for (const mesh of group) mesh.dispose(false, false);
      made.push(one);
    } catch (error) {
      console.warn(`[arcade] could not fold ${group.length} × ${group[0].material.name}; left as they were`, error);
    }
  }
  return made;
}

/**
 * The items, on one head. Returns `{ nodes, set, cast }`:
 *
 *   nodes   one TransformNode per ACCESSORIES id, always all of them, under
 *           the head. A wearer may move one to fit (neonfox), dispose it, or
 *           read the meshes under it — once set() has asked for it.
 *   set     wear exactly the items true in a selection.
 *   cast    (arcade) whether this outfit casts shadows at all just now — the
 *           gopher's cloud form keeps a second outfit that must not.
 *
 * BUILT ON FIRST WEAR (2026-10-11). Every item used to be built up front, on
 * every head that might wear one: three heads in the arcade, about 730 hidden
 * meshes walked every frame by Babylon's active-mesh pass, and every one of
 * them in the shadow caster list. Now a node is empty until set() first asks
 * for its item, and only then are its meshes and materials made. The callers
 * that read meshes all call set() first (neonfox and fishtank dress once, the
 * dresser photographs item by item), so to them nothing has changed; a game
 * that went looking under an item it never asked for would find it empty.
 * Building the heaviest item, the viking helmet, takes a few milliseconds:
 * one frame's hitch on the first wear, never a stall.
 *
 * `options`, all optional, for the arcade's own heads:
 *   fold       fold each item into one mesh per material when it is built
 *              (foldByMaterial). Off by default, because fishtank refits the
 *              eyewear mesh by mesh, by NAME, and a folded item has no names
 *              left to find.
 *   materials  a Map to share materials through, between heads in one scene.
 *              Off by default: neonfox and fishtank dispose what their riders
 *              do not use, and a material shared with a neighbour's outfit
 *              would go with it.
 *
 * Shadows: an item's meshes are in the caster list only while it is worn and
 * the outfit is casting, and leave it when taken off — a hidden mesh in that
 * list is still walked every frame by the shadow pass.
 */
export function makeAccessories(head, scene, shadows, { fold = false, materials = new Map() } = {}) {
  const B = BABYLON;
  const root = new B.TransformNode('Gopher accessories', scene); root.parent = head;
  const nodes = {};
  for (const item of ACCESSORIES) {
    nodes[item.id] = new B.TransformNode(item.label, scene);
    nodes[item.id].parent = root;
    nodes[item.id].setEnabled(false);
  }

  // Materials by PAINTS name, made the first time a builder reaches for one.
  const m = {};
  for (const [key, [name, hex, roughness, glow]] of Object.entries(PAINTS)) {
    Object.defineProperty(m, key, { get() {
      if (!materials.has(key)) materials.set(key, paint(scene, name, hex, roughness, glow || 0));
      return materials.get(key);
    } });
  }
  function add(mesh, parent, mat, x, y, z) {
    mesh.parent = parent; mesh.material = mat; mesh.position.set(x,y,z); mesh.isPickable = false;
    return mesh;
  }
  const cyl = (name, opts) => B.MeshBuilder.CreateCylinder(name, { tessellation: 32, ...opts }, scene);
  const kit = {
    B, scene, m, add, cyl,
    tube: (name, parent, mat, points, radius) =>
      add(B.MeshBuilder.CreateTube(name,{path:points.map(p=>new B.Vector3(...p)),radius,tessellation:8},scene),parent,mat,0,0,0),
    front: (mesh) => { mesh.rotation.x = Math.PI/2; return mesh; },
    dome: (name, diameter, arc = 1) => B.MeshBuilder.CreateSphere(name,{diameter,segments:20,slice:.5,arc},scene),
    ball: (name, parent, mat, diameter, x, y, z) =>
      add(B.MeshBuilder.CreateSphere(name,{diameter,segments:10},scene),parent,mat,x,y,z),
    ring: (name, parent, mat, diameter, thickness, x, y, z) =>
      add(B.MeshBuilder.CreateTorus(name,{diameter,thickness,tessellation:28},scene),parent,mat,x,y,z),
  };
  // A torus whose axis follows the direction (dx, dy) in the face plane: a
  // collar round a horn or a tube that is heading that way.
  kit.collar = (name, parent, mat, diameter, thickness, [x, y, z], dx, dy) => {
    const mesh = kit.ring(name, parent, mat, diameter, thickness, x, y, z);
    mesh.rotation.z = Math.atan2(-dx, dy); return mesh;
  };

  const built = new Set();   // ids whose meshes exist
  const casting = new Set(); // ids whose meshes are in the caster list now
  let castOn = true;
  function build(id) {
    if (built.has(id)) return;
    built.add(id);
    BUILD[id](nodes[id], kit);
    if (fold) foldByMaterial(nodes[id]);
  }
  // The one place this file touches the shadow caster list; the arcade's
  // caster helper, when room.js has one, belongs here.
  function shade(id, on) {
    if (!shadows || casting.has(id) === on) return;
    for (const mesh of nodes[id].getChildMeshes(false)) {
      if (on) shadows.addShadowCaster(mesh, false); else shadows.removeShadowCaster(mesh, false);
    }
    if (on) casting.add(id); else casting.delete(id);
  }
  return {
    nodes,
    set(selection) {
      for (const item of ACCESSORIES) {
        const on = !!selection[item.id];
        if (on) build(item.id);
        nodes[item.id].setEnabled(on);
        if (built.has(item.id)) shade(item.id, on && castOn);
      }
    },
    cast(on) {
      castOn = !!on;
      for (const id of built) shade(id, castOn && nodes[id].isEnabled(false));
    },
  };
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
