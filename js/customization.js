/** Session-only dress-up: both accessories are independent, shared by all forms. */
export function makeAccessories(head, scene, shadows) {
  const B = BABYLON;
  const root = new B.TransformNode('Gopher accessories', scene); root.parent = head;
  const hat = new B.TransformNode('Top hat', scene); hat.parent = root;
  const glasses = new B.TransformNode('Silly sunglasses', scene); glasses.parent = root;
  const material = (name, color) => {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(color); m.specularColor.set(.15,.15,.15); return m;
  };
  const black = material('Hat felt', '#192033');
  const pink = material('Silly pink frames', '#f653ad');
  const lens = material('Sunglass lenses', '#172c46');
  const band = material('Hat satin ribbon', '#36cdb9');
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
  hat.setEnabled(false); glasses.setEnabled(false);
  return { set({ topHat, sunglasses }) { hat.setEnabled(topHat); glasses.setEnabled(sunglasses); } };
}

export function createCustomizationStation(scene, shadows) {
  const B=BABYLON, x=-3.5, z=1.8;
  const navy=new B.StandardMaterial('Dressing stand enamel',scene);navy.diffuseColor=B.Color3.FromHexString('#203c4a');
  const gold=new B.StandardMaterial('Dressing stand trim',scene);gold.diffuseColor=B.Color3.FromHexString('#d5aa65');
  const cream=new B.StandardMaterial('Dressing stand mannequin',scene);cream.diffuseColor=B.Color3.FromHexString('#eadab4');
  function box(name,w,h,d,px,py,pz,mat) {
    const o=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
    o.position.set(px,py,pz);o.material=mat;o.isPickable=false;shadows?.addShadowCaster(o,false);return o;
  }
  box('Dressing stand cabinet',1.4,.83,.65,x,.415,z,navy);
  box('Dressing stand counter',1.55,.09,.80,x,.875,z,gold);
  for(const side of [-1,1])box('Dressing stand signpost',.055,1.25,.055,x+side*.67,1.5,z-.25,gold);
  box('Dressing stand nameboard',1.52,.38,.085,x,2.02,z-.25,navy);
  const texture=new B.DynamicTexture('Dressing stand lettering',{width:768,height:192},scene,false);
  texture.drawText('SILLY STUFF',null,124,'bold 78px sans-serif','#fff1d2','#203c4a',true);
  const signMat=new B.StandardMaterial('Dressing stand lettering',scene);signMat.diffuseTexture=texture;
  signMat.emissiveColor.set(.25,.25,.25);
  const sign=B.MeshBuilder.CreatePlane('Silly Stuff sign',{width:1.4,height:.32,sideOrientation:B.Mesh.DOUBLESIDE},scene);
  sign.position.set(x,2.02,z-.198);sign.rotation.y=Math.PI;sign.material=signMat;sign.isPickable=false;
  const head=new B.TransformNode('Display mannequin head',scene);head.position.set(x,1.06,z+.05);
  const bust=B.MeshBuilder.CreateSphere('Display mannequin',{diameter:1,segments:16},scene);
  bust.parent=head;bust.position.y=.20;bust.scaling.set(.53,.56,.48);bust.material=cream;bust.isPickable=false;
  makeAccessories(head,scene,shadows).set({topHat:true,sunglasses:true});
  return {
    stand: new B.Vector3(x,0,z+1.35),
    blocker:{x,z,hx:.8,hz:.43,base:0,top:2.25},
    inReach(pos) { return Math.abs(pos.y)<.3 && Math.hypot(pos.x-x,pos.z-(z+1.35))<1.15; },
  };
}
