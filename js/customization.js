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
function paint(scene, name, hex, roughness = .55, glow = 0) {
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

export function createCustomizationStation(scene, shadows) {
  const B=BABYLON;
  // West edge, facing inward. Local +Z is the machine's front.
  const station=new B.TransformNode('Dresser gadget machine',scene);
  station.position.set(-4.9,0,2.3);station.rotation.y=Math.PI/2;
  const material=(name,color,roughness,glow)=>paint(scene,name,color,roughness,glow);
  const enamel=material('Dresser teal enamel','#254b57',.5),dark=material('Dresser dark panels','#142b35',.7);
  const brass=material('Dresser warm brass','#cfa05d',.35),steel=material('Dresser brushed metal','#9dacb4',.4);
  const mint=material('Dresser mint lamps','#61d8b4',.5,.22),red=material('Dresser coral buttons','#ed766b',.45);
  const yellow=material('Dresser amber buttons','#f4c35c',.45,.12),cream=material('Dresser mannequin','#eadab4',.8);
  function part(mesh,mat,x,y,z) {
    mesh.parent=station;mesh.position.set(x,y,z);mesh.material=mat;mesh.isPickable=false;
    shadows?.addShadowCaster(mesh,false);return mesh;
  }
  function box(name,w,h,d,x,y,z,mat) {return part(B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),mat,x,y,z);}
  function cylinder(name,r,h,x,y,z,mat,front=false) {
    const mesh=part(B.MeshBuilder.CreateCylinder(name,{diameter:r*2,height:h,tessellation:24},scene),mat,x,y,z);
    if(front)mesh.rotation.x=Math.PI/2;return mesh;
  }
  function tube(name,points,r,mat) {return part(B.MeshBuilder.CreateTube(name,{path:points.map(p=>new B.Vector3(...p)),radius:r,tessellation:8},scene),mat,0,0,0);}
  function ball(name,r,x,y,z,mat) {return part(B.MeshBuilder.CreateSphere(name,{diameter:r*2,segments:12},scene),mat,x,y,z);}
  box('Dresser heavy plinth',1.96,.16,1.18,0,.08,0,dark);
  box('Dresser engine cabinet',1.72,.81,.96,0,.53,0,enamel);
  box('Dresser display back',1.55,1.12,.14,0,1.53,-.40,dark);
  for(const side of [-1,1]) {
    cylinder('Dresser rounded pillar',.14,1.91,side*.82,1.11,-.03,enamel);
    for(const y of [.22,1.94])cylinder('Dresser pillar collar',.17,.10,side*.82,y,-.03,brass);
    box('Dresser light channel',.04,1.34,.04,side*.82,1.28,.12,mint);
    box('Dresser side service box',.26,.65,.70,side*.93,.63,.01,dark);
    for(let i=0;i<4;i++)box('Dresser cooling fin',.32,.035,.55,side*.94,.43+i*.12,.015,steel);
    for(const y of [.22,.92])ball('Dresser casing bolt',.033,side*.74,y,.49,brass);
  }
  box('Dresser display surround',1.27,1.03,.055,0,1.49,-.296,brass);
  box('Dresser display interior',1.15,.91,.045,0,1.49,-.26,enamel);
  box('Dresser control console',1.88,.16,1.16,0,1.01,.13,brass);
  box('Dresser console inset',1.67,.025,.47,0,1.10,.48,dark);
  // Eight chunky buttons, each sitting in a metal bezel.
  for(let row=0;row<2;row++)for(let col=0;col<4;col++) {
    const x=-.39+col*.26,z=.40+row*.22;
    cylinder('Dresser button bezel',.091,.032,x,1.127,z,steel);
    cylinder('Dresser chunky button',.066,.060,x,1.17,z,[mint,red,yellow,enamel][(col+row)%4]);
  }
  // Three conspicuous levers in different positions, with joint boots and grips.
  for(const [x,z,lean,mat] of [[-.70,.39,.17,red],[.70,.39,-.10,mint],[.70,.68,.13,yellow]]) {
    cylinder('Dresser lever socket',.105,.065,x,1.14,z,steel);
    ball('Dresser lever joint',.075,x,1.19,z,dark);
    tube('Dresser lever shaft',[[x,1.20,z],[x,1.50,z+lean]],.025,steel);
    ball('Dresser lever grip',.079,x,1.52,z+lean,mat);
  }
  // Twin analogue gauges with visible needles and calibration marks.
  for(const side of [-1,1]) {
    const x=side*.65,y=1.78,z=.25;
    cylinder('Dresser gauge housing',.16,.10,x,y,z,brass,true);
    cylinder('Dresser gauge face',.135,.013,x,y,z+.058,cream,true);
    for(let i=0;i<7;i++) {
      const a=(.15+i*.12)*Math.PI*2;
      tube('Dresser gauge graduation',[[x+.10*Math.cos(a),y+.10*Math.sin(a),z+.068],[x+.12*Math.cos(a),y+.12*Math.sin(a),z+.068]],.005,dark);
    }
    tube('Dresser gauge needle',[[x,y,z+.079],[x+side*.072,y+.056,z+.079]],.008,red);
    ball('Dresser gauge pivot',.015,x,y,z+.081,brass);
  }
  box('Dresser access panel',1.18,.48,.035,0,.54,.498,dark);
  for(let i=0;i<5;i++)box('Dresser vent slit',.055,.25,.018,-.43+i*.13,.54,.522,steel);
  cylinder('Dresser large adjustment dial',.12,.075,.40,.55,.55,brass,true);
  box('Dresser dial pointer',.018,.11,.024,.40,.59,.60,dark);
  // External hoses make it look like a peculiar working invention.
  for(const side of [-1,1]) {
    tube('Dresser curved service pipe',[[side*.83,.25,-.20],[side*1.10,.30,-.20],[side*1.12,.76,-.20],[side*1.05,1.38,-.18],[side*.83,1.48,-.15]],.038,brass);
    for(const y of [.35,.95])cylinder('Dresser pressure collar',.065,.07,side*1.1,y,-.20,steel);
  }
  box('Dresser marquee',1.88,.35,1.03,0,2.16,0,enamel);
  box('Dresser marquee lower trim',1.90,.055,1.05,0,1.972,0,brass);
  const texture=new B.DynamicTexture('Dresser lettering',{width:768,height:192},scene,false);
  texture.drawText('DRESSER',null,124,'bold 88px sans-serif','#fff1d2','#254b57',true);
  const signMat=new B.PBRMaterial('Dresser lettering',scene);signMat.albedoTexture=texture;signMat.metallic=0;signMat.roughness=.6;
  signMat.emissiveColor=new B.Color3(.18,.18,.18).toLinearSpace();
  const sign=part(B.MeshBuilder.CreatePlane('Dresser marquee face',{width:1.61,height:.29},scene),signMat,0,2.16,.524);sign.rotation.y=Math.PI;
  cylinder('Dresser beacon base',.12,.06,0,2.37,0,brass);
  ball('Dresser ready beacon',.095,0,2.46,0,mint);
  const head=new B.TransformNode('Display mannequin head',scene);head.parent=station;head.position.set(0,1.12,-.04);head.scaling.setAll(.78);
  const bust=B.MeshBuilder.CreateSphere('Display mannequin',{diameter:1,segments:16},scene);
  bust.parent=head;bust.position.y=.20;bust.scaling.set(.53,.56,.48);bust.material=cream;bust.isPickable=false;
  makeAccessories(head,scene,shadows).set({topHat:true,sunglasses:true});
  const stand=new B.Vector3(-3.35,0,2.3);
  return {
    stand,
    blocker:{x:-4.9,z:2.3,hx:.85,hz:1.18,base:0,top:2.57},
    inReach(pos) {return Math.abs(pos.y)<.3&&Math.hypot(pos.x-stand.x,pos.z-stand.z)<1.15;},
  };
}

let previewPromise;
/** Render actual accessory meshes once into inventory images, then release WebGL. */
export function accessoryPreviews() {
  if (previewPromise) return previewPromise;
  previewPromise = (async () => {
    const B=BABYLON;
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=192;
    let engine, scene;
    try {
      engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:false},false);
      engine.setSize(192,192);
      scene=new B.Scene(engine);scene.clearColor=new B.Color4(.10,.18,.21,1);
      const camera=new B.ArcRotateCamera('Item photo',1.34,1.30,3,B.Vector3.Zero(),scene);
      camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;
      camera.minZ=.01; camera.maxZ=10;
      scene.activeCamera=camera;
      const light=new B.HemisphericLight('Item softbox',new B.Vector3(-.4,1,1),scene);light.intensity=1.3;
      light.groundColor=new B.Color3(.36,.39,.43);
      const head=new B.TransformNode('Item photo anchor',scene);
      const outfit=makeAccessories(head,scene,null), result={};
      for (const item of ACCESSORIES) {
        head.position.set(0,0,0);
        head.computeWorldMatrix(true);
        outfit.set({[item.id]:true});
        const min=new B.Vector3(Infinity,Infinity,Infinity),max=new B.Vector3(-Infinity,-Infinity,-Infinity);
        for (const mesh of outfit.nodes[item.id].getChildMeshes()) {
          mesh.computeWorldMatrix(true);
          const bounds=mesh.getBoundingInfo().boundingBox;
          min.minimizeInPlace(bounds.minimumWorld);max.maximizeInPlace(bounds.maximumWorld);
        }
        // Center the actual geometry, including chains/arms, instead of aiming
        // a reused orbit camera at each accessory's head-local offset.
        head.position.copyFrom(min.add(max).scale(-.5));
        head.computeWorldMatrix(true);
        const halfSize=Math.max(.08,max.subtract(min).length()*.60);
        camera.orthoLeft=-halfSize; camera.orthoRight=halfSize;
        camera.orthoBottom=-halfSize; camera.orthoTop=halfSize;
        camera.getProjectionMatrix(true);
        await scene.whenReadyAsync(); scene.render();
        result[item.id]=canvas.toDataURL('image/png');
      }
      return result;
    } finally { scene?.dispose(); engine?.dispose(); }
  })();
  return previewPromise;
}
