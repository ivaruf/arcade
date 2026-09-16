import './parents-scroll.js';
/** Only the title appears in-world; the full philosophy lives in the HTML dialog. */
export function createParentsSign(scene) {
  const B=BABYLON,root=new B.TransformNode('Parents and guardians sign',scene);
  root.position.set(-4.9,0,-3.3);root.rotation.y=Math.PI/2;
  function paint(name,hex,metal=0){const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(hex).toLinearSpace();m.metallic=metal;m.roughness=.6;return m;}
  const teal=paint('Parents sign enamel','#203f47'),brass=paint('Parents sign edging','#b9a06e',.3);
  function box(name,width,height,depth,x,y,z,mat){
    const m=B.MeshBuilder.CreateBox(name,{width,height,depth},scene);m.parent=root;m.position.set(x,y,z);m.material=mat;m.isPickable=false;return m;
  }
  box('Parents sign foot',1.45,.12,.40,0,.06,0,brass);
  for(const x of [-.52,.52])box('Parents sign post',.08,1.38,.09,x,.75,0,teal);
  box('Parents sign frame',1.78,.90,.12,0,1.65,0,brass);
  box('Parents sign board',1.70,.82,.14,0,1.65,0,teal);
  const texture=new B.DynamicTexture('Parents sign title',{width:1536,height:704},scene,true);
  const ctx=texture.getContext();ctx.fillStyle='#193740';ctx.fillRect(0,0,1536,704);
  ctx.strokeStyle='#a4ccbe';ctx.lineWidth=3;ctx.strokeRect(24,24,1488,656);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff4dc';ctx.font='600 138px system-ui, sans-serif';
  ctx.fillText('For parents',768,255);ctx.fillText('and guardians',768,445);texture.update();
  const ink=new B.StandardMaterial('Parents sign printed title',scene);ink.disableLighting=true;ink.emissiveTexture=texture;
  ink.emissiveColor=ink.diffuseColor=B.Color3.Black();
  for(const side of [-1,1]){
    const face=B.MeshBuilder.CreatePlane('Parents sign title face',{width:1.64,height:.76},scene);
    face.parent=root;face.position.set(0,1.65,side*.076);face.rotation.y=side===1?Math.PI:0;face.material=ink;face.isPickable=false;
    for(const layer of scene.effectLayers||[])layer.addExcludedMesh?.(face);
  }
  return {blocker:{x:-4.9,z:-3.3,hx:.22,hz:.92,base:0,top:2.10},
    inReach(p){return Math.abs(p.y)<.3&&Math.hypot(p.x+3.85,p.z+3.3)<1.05;}};
}
