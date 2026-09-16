/** Session-only companions. Shared geometry for the machine, preview and follower. */
export const PETS = [
  { id: 'nyan', name: 'Nyan Cat', description: 'A pastry cat with a flying rainbow.', color: '#a8aeba' },
  { id: 'pip', name: 'Pip', description: 'A leaf-eared woodland rabbit with cotton tail.', color: '#6ed9b4' },
  { id: 'noodle', name: 'Noodle', description: 'A frilly-gilled axolotl with a swishing fin tail.', color: '#b699ee' },
];
function material(scene, name, color, metal = 0) {
  const m = new BABYLON.PBRMaterial(name, scene);
  m.albedoColor = BABYLON.Color3.FromHexString(color).toLinearSpace();
  m.roughness = .65; m.metallic = metal;
  return m;
}
function creature(scene, id) {
  if (id === 'nyan') return nyanCreature(scene);
  const B=BABYLON,root=new B.TransformNode(`Pet ${id}`,scene);
  const body=new B.TransformNode(`${id} body`,scene);body.parent=root;
  const fur=material(scene,`${id} skin`,id==='pip'?'#6ed9b4':'#b699ee');
  const cream=material(scene,`${id} belly`,'#fff0d1'),dark=material(scene,`${id} eyes`,'#182c39');
  const pink=material(scene,`${id} accents`,id==='pip'?'#f3b1bd':'#ed8cc5');
  const white=material(scene,`${id} cloud`,'#f3faff'),leaf=material(scene,`${id} leaf veins`,'#379f83');
  function ball(name,parent,mat,pos,scale) {
    const m=B.MeshBuilder.CreateSphere(`${id} ${name}`,{diameter:1,segments:16},scene);
    m.parent=parent;m.material=mat;m.position.set(...pos);m.scaling.set(...scale);m.isPickable=false;return m;
  }
  const feet=[],ears=[];
  let tail;
  if(id==='pip') {
    // Upright woodland rabbit: separate head, pear body and oversized hind paws.
    ball('pear body',body,fur,[0,.29,-.035],[.44,.49,.36]);
    ball('bib',body,cream,[0,.32,.137],[.29,.33,.095]);
    ball('round head',body,fur,[0,.65,.035],[.52,.43,.40]);
    for(const side of [-1,1]) {
      const ear=new B.TransformNode('Pip leaf ear pivot',scene);ear.parent=body;ear.position.set(side*.15,.79,.01);ear.rotation.z=-side*.22;ears.push(ear);
      ball('leaf ear',ear,fur,[0,.17,0],[.15,.48,.075]);
      ball('leaf inset',ear,leaf,[0,.17,.034],[.093,.36,.018]);
      ball('leaf vein',ear,cream,[0,.17,.046],[.014,.31,.01]);
      feet.push(ball('long hind paw',body,fur,[side*.16,.075,.085],[.20,.15,.35]));
      ball('little arm',body,fur,[side*.205,.35,.105],[.10,.23,.13]).rotation.z=side*.3;
      ball('muzzle',body,cream,[side*.067,.574,.219],[.16,.12,.08]);
      ball('eye',body,dark,[side*.124,.686,.213],[.083,.12,.04]);
      ball('eye glint',body,white,[side*.124-.014,.709,.234],[.028,.032,.012]);
      ball('cheek',body,pink,[side*.204,.604,.165],[.072,.042,.032]);
      roundedPetBox(scene,'Pip tooth',body,white,[side*.025,.508,.235],[.041,.056,.025],.8);
    }
    ball('nose',body,pink,[0,.595,.267],[.057,.04,.034]);
    tail=ball('cotton tail',body,cream,[0,.24,-.245],[.23,.22,.23]);
  } else {
    // Low, long axolotl: four splayed feet, broad smile, feathery gills and fin tail.
    ball('long body',body,fur,[0,.23,-.13],[.46,.35,.72]);
    ball('belly',body,cream,[0,.17,-.06],[.35,.17,.59]);
    ball('wide head',body,fur,[0,.36,.24],[.64,.36,.43]);
    ball('muzzle',body,cream,[0,.285,.425],[.40,.11,.06]);
    for(const side of [-1,1]) {
      for(const z of [-.32,.22]) {
        const foot=new B.TransformNode('Noodle foot pivot',scene);foot.parent=body;foot.position.set(side*.24,.07,z);feet.push(foot);
        ball('splayed foot',foot,fur,[0,0,0],[.22,.13,.19]);
        for(let toe=0;toe<3;toe++)ball('toe',foot,pink,[side*(.05+toe*.015),-.015,.065-toe*.05],[.075,.063,.065]);
      }
      ball('eye',body,dark,[side*.178,.398,.432],[.092,.104,.038]);
      ball('eye glint',body,white,[side*.178-.016,.42,.453],[.027,.029,.012]);
      ball('blush',body,pink,[side*.254,.313,.366],[.073,.04,.035]);
      for(let i=0;i<3;i++) {
        const gill=new B.TransformNode('Noodle gill pivot',scene);gill.parent=body;
        gill.position.set(side*.275,.34,.18);gill.rotation.z=-side*(.40+i*.65);ears.push(gill);
        ball('gill stem',gill,pink,[0,.135,0],[.045,.27,.048]);
        for(let j=0;j<3;j++)for(const branch of [-1,1])ball('gill frond',gill,pink,[branch*.041,.09+j*.065,0],[.09,.035,.037]).rotation.z=branch*.4;
      }
    }
    ball('smile',body,dark,[0,.286,.459],[.16,.016,.01]);
    tail=new B.TransformNode('Noodle fin tail',scene);tail.parent=body;tail.position.set(0,.22,-.40);
    for(let i=0;i<5;i++)ball('tail segment',tail,fur,[Math.sin(i*.5)*.06,0,-i*.085],[.23-i*.037,.21-i*.032,.18]);
    ball('translucent-look tail fin',tail,pink,[.035,.04,-.21],[.055,.31,.42]);
    for(let i=0;i<4;i++)ball('dorsal scallop',body,pink,[0,.40,-.08-i*.1],[.055,.13-i*.015,.16]);
  }
  const cloud=new B.TransformNode(`${id} personal cloud`,scene);cloud.parent=root;
  for(const [x,y,z,s] of [[0,-.08,0,1],[-.28,-.04,0,.65],[.28,-.04,.02,.65],[0,-.02,-.18,.7],[0,-.07,.22,.65]])ball('cloud puff',cloud,white,[x,y,z],[.76*s,.26*s,.59*s]);
  cloud.setEnabled(false);
  const footRest=feet.map(foot=>({y:foot.position.y,z:foot.position.z}));
  let tuck=0,lastPoseTime=null;
  return {root,cloud,animate(t,moving,flying){
    const dt=lastPoseTime===null?1/60:Math.max(0,Math.min(.1,t-lastPoseTime));
    lastPoseTime=t;
    tuck+=((flying?1:0)-tuck)*(1-Math.exp(-12*dt));
    body.position.y=flying?Math.sin(t*3)*.025:Math.abs(Math.sin(t*(id==='pip'?9:6)))*(id==='pip'?.065:.015)*moving;
    body.rotation.z=flying?Math.sin(t*2.4)*.018:Math.sin(t*6)*.025*moving;
    feet.forEach((foot,i)=>{
      const walk=flying?0:Math.sin(t*12+i*Math.PI)*.3*moving;
      foot.rotation.x=walk*(1-tuck)-(id==='pip'?1.05:.85)*tuck;
      foot.position.y=footRest[i].y+.075*tuck;
      foot.position.z=footRest[i].z+.04*tuck;
    });
    ears.forEach((ear,i)=>ear.rotation.x=Math.sin(t*3+i*.5)*.09);
    tail.rotation.y=Math.sin(t*(id==='pip'?5:7))*(id==='pip'?.2:.4);
  }};
}

/** Soft cuboid silhouette, with rounded corners instead of hard box edges. */
function roundedPetBox(scene,name,parent,mat,pos,size,exponent=.35) {
  const B=BABYLON,m=B.MeshBuilder.CreateSphere(name,{diameter:2,segments:20},scene);
  const positions=m.getVerticesData(B.VertexBuffer.PositionKind);
  for(let i=0;i<positions.length;i++)positions[i]=Math.sign(positions[i])*Math.pow(Math.abs(positions[i]),exponent)*size[i%3]/2;
  const normals=[];B.VertexData.ComputeNormals(positions,m.getIndices(),normals);
  m.setVerticesData(B.VertexBuffer.PositionKind,positions);
  m.setVerticesData(B.VertexBuffer.NormalKind,normals);
  m.parent=parent;m.material=mat;m.position.set(...pos);m.isPickable=false;return m;
}

function station(scene) {
  const B = BABYLON, root = new B.TransformNode('Pet companion machine', scene);
  root.position.set(4.9,0,2.3); root.rotation.y = -Math.PI/2;
  const teal=material(scene,'Pet enamel','#25465b'), brass=material(scene,'Pet brass','#d6ae6d',.35);
  const dark=material(scene,'Pet recess','#132a38'), mint=material(scene,'Pet buttons','#70d9bb');
  function box(name,w,h,d,x,y,z,mat) {
    const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
    m.parent=root;m.position.set(x,y,z);m.material=mat;m.isPickable=false;return m;
  }
  box('Pet machine base',2.1,.25,1.3,0,.125,0,brass);
  box('Pet display backing',1.95,2.05,.35,0,1.22,-.43,dark);
  // Sit on the plinth with a 3 cm side reveal. The old panels extended into
  // it with identical outer X faces, causing camera-dependent depth flicker.
  for(const x of [-.94,.94]) box('Pet rounded-side housing',.16,2.20,1.25,x,1.35,0,teal);
  box('Pet console',1.85,.28,.6,0,.76,.37,teal);
  box('Pet marquee housing',2.12,.46,1.3,0,2.45,0,teal);
  for(const x of [-.6,-.2,.2,.6]) {
    const b= B.MeshBuilder.CreateCylinder('Pet selection button',{diameter:.17,height:.08,tessellation:20},scene);
    b.parent=root;b.position.set(x,.94,.48);b.material=mint;b.isPickable=false;
  }
  const texture=new B.DynamicTexture('Pet machine lettering',{width:1024,height:224},scene,false);
  const ctx=texture.getContext();ctx.fillStyle='#142d3b';ctx.fillRect(0,0,1024,224);
  ctx.fillStyle='#e8f9e8';ctx.font='bold 105px system-ui';ctx.textAlign='center';ctx.fillText('PETS',512,146);texture.update();
  const ink=new B.StandardMaterial('Pet sign ink',scene);ink.disableLighting=true;
  ink.emissiveTexture=texture;ink.emissiveColor=B.Color3.Black();ink.diffuseColor=B.Color3.Black();
  const face=B.MeshBuilder.CreatePlane('PETS sign',{width:1.84,height:.39},scene);
  face.parent=root;face.position.set(0,2.45,.66);face.rotation.y=Math.PI;face.material=ink;face.isPickable=false;
  for(const layer of scene.effectLayers || []) layer.addExcludedMesh?.(face);
  const displays=PETS.map((spec,i)=>{
    const pet=creature(scene,spec.id);pet.root.parent=root;pet.root.position.set((i-(PETS.length-1)/2)*.60,1.03,.05);pet.root.scaling.setAll(.57);return pet;
  });
  return { displays, blocker:{x:4.9,z:2.3,hx:.7,hz:1.1,base:0,top:2.7},
    inReach(p){return Math.abs(p.y)<.3 && Math.hypot(p.x-3.3,p.z-2.3)<1.2;} };
}

/** Keep the companion clear of solid props; it never becomes a player collider. */
export function avoidPetObstacles(p, blockers) {
  const radius=.28;
  for(const b of blockers) {
    if(p.y >= b.top || p.y+.65 < (b.base ?? 0)) continue;
    const left=b.x-b.hx-radius,right=b.x+b.hx+radius,back=b.z-b.hz-radius,front=b.z+b.hz+radius;
    if(p.x<=left || p.x>=right || p.z<=back || p.z>=front) continue;
    const distances=[p.x-left,right-p.x,p.z-back,front-p.z];
    const side=distances.indexOf(Math.min(...distances));
    if(side===0)p.x=left;else if(side===1)p.x=right;else if(side===2)p.z=back;else p.z=front;
  }
}

export function createPets(scene) {
  const machine=station(scene);
  const followers=Object.fromEntries(PETS.map(spec=>[spec.id,creature(scene,spec.id)]));
  Object.values(followers).forEach(p=>p.root.setEnabled(false));
  let selected=null, spawned=false, preview=null, closeHandler=null;
  const dialog=document.getElementById('pets-dialog'), status=document.getElementById('pet-status');
  const choices=[...dialog.querySelectorAll('[data-pet]')];
  function choose(id) {
    if(id && !followers[id]) return;
    selected=id;spawned=false;
    Object.entries(followers).forEach(([key,pet])=>pet.root.setEnabled(key===id));
    choices.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pet=== (id || ''))));
    status.textContent=id ? `${PETS.find(p=>p.id===id).name} is your companion.` : 'Travelling without a pet.';
    dialog.querySelector('.pet-preview > span').textContent = id ? PETS.find(p=>p.id===id).name + ' · your cloud companion' : 'Choose a pet to preview';
    preview?.show(id);
  }
  choices.forEach(button=>button.addEventListener('click',()=>choose(button.dataset.pet || null)));
  function stopPreview() {preview?.dispose();preview=null;}
  function close(){if(!dialog.open)return;dialog.close();stopPreview();closeHandler?.();closeHandler=null;}
  dialog.querySelector('[data-pet-done]').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  choose(null);
  return { ...machine, close,
    open(onClose){
      closeHandler=onClose;dialog.showModal();
      // Only allocate a second renderer while the picker is open.
      try {preview=createPreview(dialog.querySelector('canvas'));preview.show(selected);}
      catch(error){stopPreview();console.warn('[pets] Preview unavailable',error);}
      choices.find(b=>b.dataset.pet===(selected || '')).focus();
    },
    animate(dt,t,player,state,groundAt,blockers){
      machine.displays.forEach(p=>p.animate(t,.2,false));
      if(!selected || !player)return;
      const pet=followers[selected],p=pet.root.position;
      const tx=player.x-Math.sin(state.yaw)*1.25+Math.cos(state.yaw)*.65;
      const tz=player.z-Math.cos(state.yaw)*1.25-Math.sin(state.yaw)*.65;
      if(!spawned || Math.hypot(p.x-player.x,p.y-player.y,p.z-player.z)>12){p.set(tx,player.y,tz);spawned=true;}
      const ox=p.x,oz=p.z,blend=1-Math.exp(-5*dt);
      p.x+=(tx-p.x)*blend;p.z+=(tz-p.z)*blend;
      let floor=groundAt(p.x,p.z,player.y+.7);
      const airborne=state.mode==='fly' || !state.grounded || !Number.isFinite(floor);
      const targetY=airborne ? player.y+.08 : floor;
      p.y+=(targetY-p.y)*(1-Math.exp(-7*dt));
      if(Number.isFinite(floor))p.y=Math.max(p.y,floor);
      avoidPetObstacles(p,blockers);
      floor=groundAt(p.x,p.z,p.y+.1);
      const onCloud=airborne || !Number.isFinite(floor) || p.y-floor>.18;
      pet.cloud.setEnabled(onCloud);
      const dx=p.x-ox,dz=p.z-oz,speed=Math.hypot(dx,dz)/Math.max(dt,.001);
      if(speed>.08){const angle=Math.atan2(dx,dz);pet.root.rotation.y+=Math.atan2(Math.sin(angle-pet.root.rotation.y),Math.cos(angle-pet.root.rotation.y))*blend;}
      pet.animate(t,Math.min(1,speed/2),onCloud);
    },
  };
}

function createPreview(canvas) {
  const B=BABYLON,engine=new B.Engine(canvas,true,{stencil:false});
  engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.5));
  const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.055,.12,.16,1);
  const camera=new B.ArcRotateCamera('Pet preview camera',Math.PI/2,1.28,2.5,new B.Vector3(0,.38,0),scene);
  camera.lowerRadiusLimit=1.8;camera.upperRadiusLimit=3.5;
  new B.HemisphericLight('Pet preview sky',new B.Vector3(0,1,0),scene).intensity=1.3;
  const light=new B.DirectionalLight('Pet preview sun',new B.Vector3(-1,-2,-2),scene);light.intensity=2;
  const models=Object.fromEntries(PETS.map(p=>[p.id,creature(scene,p.id)]));
  let id=null,t=0;
  const resize=()=>{engine.resize();const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);camera.radius=Math.max(2.5,1.1/Math.max(.2,aspect));};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  engine.runRenderLoop(()=>{
    t+=Math.min(.05,engine.getDeltaTime()/1000);
    if(id){models[id].root.rotation.y=(id==='nyan' ? -.65 : 0)+Math.sin(t*.55)*.45;models[id].animate(t,.25,true);}
    scene.render();
  });
  return {show(next){id=next;Object.entries(models).forEach(([key,p])=>{p.root.setEnabled(key===next);p.cloud.setEnabled(true);});},
    dispose(){observer.disconnect();engine.stopRenderLoop();scene.dispose();engine.dispose();}};
}

/** Rounded pastry cat based on the reference, with no cloud geometry. */
function nyanCreature(scene) {
  const B=BABYLON,root=new B.TransformNode('Pet nyan',scene);
  const body=new B.TransformNode('Nyan cat body',scene);body.parent=root;
  const grey=material(scene,'Nyan grey','#90959f'), crust=material(scene,'Nyan pastry crust','#fff0ab');
  const icing=material(scene,'Nyan pink icing','#ffb1eb'), sprinkles=material(scene,'Nyan sprinkles','#ec30cd');
  const black=material(scene,'Nyan eyes','#172331'),white=material(scene,'Nyan glints','#ffffff');
  function box(name,pos,size,mat) {
    return roundedPetBox(scene,name,body,mat,pos,size,name.includes('pixel')?.18:.35);
  }
  box('Nyan pastry',[0,.38,-.10],[.58,.51,.78],crust);
  for(const x of [-.30,.30]) {
    box('Nyan frosted side',[x,.39,-.10],[.045,.40,.65],icing);
    for(let i=0;i<8;i++)box('Nyan candy pixel',[x*1.05,.28+(i%3)*.1,-.33+Math.floor(i/3)*.20],[.025,.035,.045],sprinkles);
  }
  box('Nyan frosting top',[0,.64,-.10],[.48,.04,.65],icing);
  box('Nyan head',[0,.39,.36],[.56,.43,.33],grey);
  for(const x of [-.17,.17]) {
    const ear=B.MeshBuilder.CreateCylinder('Nyan pointed ear',{diameterTop:0,diameterBottom:.19,height:.23,tessellation:3},scene);
    ear.parent=body;ear.position.set(x,.66,.34);ear.rotation.y=Math.PI/2;ear.material=grey;ear.isPickable=false;
    box('Nyan inner ear',[x,.662,.401],[.065,.08,.015],icing);
    box('Nyan eye',[x*.76,.435,.526],[.065,.075,.018],black);
    box('Nyan eye glint',[x*.76-.012,.455,.54],[.018,.021,.009],white);
    box('Nyan cheek',[x*1.12,.343,.514],[.095,.065,.025],icing);
  }
  box('Nyan nose',[0,.37,.537],[.035,.026,.02],black);
  box('Nyan smile bottom',[0,.286,.521],[.16,.021,.018],black);
  for(const x of [-.076,.076])box('Nyan smile corner',[x,.305,.522],[.025,.054,.018],black);
  const feet=[];
  for(const x of [-.20,.20])for(const z of [-.34,.24])feet.push(box('Nyan paw',[x,.105,z],[.15,.16,.20],grey));
  const tail=new B.TransformNode('Nyan curved tail',scene);tail.parent=body;tail.position.set(0,.37,-.54);
  // One continuous swept surface: a gentle upward curl and a rounded, tapered tip.
  const tailPath=Array.from({length:25},(_,i)=>{
    const t=i/24;
    return new B.Vector3(.11*t*t,.16*t*t,-.32*t);
  });
  const tailMesh=B.MeshBuilder.CreateTube('Nyan smooth tail',{
    path:tailPath,tessellation:16,cap:B.Mesh.CAP_ALL,
    radiusFunction:i=>.06*Math.sqrt(Math.max(.002,1-Math.pow(i/24,6))),
  },scene);
  tailMesh.parent=tail;tailMesh.material=grey;tailMesh.isPickable=false;
  // Empty interface node: callers can toggle flight support without a cloud.
  const cloud=new B.TransformNode('Nyan flight support (empty)',scene);cloud.parent=root;
  let rainbow=null;
  return {root,cloud,animate(t,moving,flying){
    body.position.y=Math.sin(t*(flying?7:12))*.025*(flying?1:moving);
    feet.forEach((p,i)=>p.rotation.x=Math.sin(t*13+i*Math.PI)*.35*(flying?1:moving));
    tail.rotation.y=Math.sin(t*9)*.4;
    if(flying && !rainbow)rainbow=createRainbow(scene,root);
    rainbow?.update(t,flying);
  }};
}

/** Six reusable ribbons retain recent world positions, so turns bend the tail. */
function createRainbow(scene,root) {
  const B=BABYLON,count=36,history=[];
  const paths=Array.from({length:6},()=>[Array.from({length:count},()=>new B.Vector3()),Array.from({length:count},()=>new B.Vector3())]);
  const bands=['#ff5252','#ffa83d','#ffe15c','#67df82','#5ca9ff','#bb7af2'].map((hex,i)=>{
    const mesh=B.MeshBuilder.CreateRibbon(`Nyan rainbow ${i}`,{pathArray:paths[i],updatable:true,sideOrientation:B.Mesh.DOUBLESIDE},scene);
    mesh.parent=root;mesh.isPickable=false;
    const mat=new B.StandardMaterial(`Rainbow ink ${i}`,scene);mat.disableLighting=true;
    mat.emissiveColor=B.Color3.FromHexString(hex).scale(.8);mat.diffuseColor=B.Color3.Black();mesh.material=mat;
    return mesh;
  });
  let last=0;
  const inverse=new B.Matrix(),worldPoint=new B.Vector3();
  return {update(t,flying){
    bands.forEach(m=>m.setEnabled(flying));
    if(!flying){history.length=0;last=0;return;}
    const world=root.computeWorldMatrix(true);world.invertToRef(inverse);
    const head=B.Vector3.TransformCoordinates(new B.Vector3(0,.40,-.57),world);
    if(!history.length || B.Vector3.Distance(head,history[0])>5){
      history.length=0;
      for(let j=0;j<count;j++)history.push(B.Vector3.TransformCoordinates(new B.Vector3(0,.4,-.57-j*.065),world));
      last=t;
    }
    // Keep the preview and hovering pet streaming a rainbow when stationary.
    const hovering=B.Vector3.Distance(head,history[0])<.006;
    if(hovering)for(let j=0;j<count;j++)history[j]=B.Vector3.TransformCoordinates(new B.Vector3(0,.4,-.57-j*.065),world);
    if(t-last>=1/30){history.pop();history.unshift(head);last=t;}
    for(let i=0;i<6;i++) {
      for(let j=0;j<count;j++) {
        const center=j===0?head:history[j],taper=1-j/(count-1);
        for(let edge=0;edge<2;edge++) {
          worldPoint.copyFrom(center);
          worldPoint.y+=(2.5-i+(edge?-.5:.5))*.068*taper + Math.sin(t*9-j*.55)*.025*(1-taper);
          B.Vector3.TransformCoordinatesToRef(worldPoint,inverse,paths[i][edge][j]);
        }
      }
      B.MeshBuilder.CreateRibbon(null,{pathArray:paths[i],instance:bands[i]},scene);
    }
  }};
}
