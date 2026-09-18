"""Standalone mailbox, front -Y, Z up. Pass -- --preview for a studio PNG."""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent.parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.render.fps=30
def node(name,parent=None,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=pos;return o
root=node('Mailbox')
def mat(name,c,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
teal=mat('Petrol enamel',(.025,.15,.17),.3);brass=mat('Aged brass',(.56,.36,.13),.7,.36);red=mat('Signal red',(.65,.025,.035),.18)
wood=mat('Oiled walnut',(.24,.11,.047),0,.7);grain=mat('Walnut grain',(.35,.18,.075));black=mat('Dark hardware',(.035,.045,.052),.65);inside=mat('Interior',(.06,.10,.11),.2,.7)
def finish(o,name,m,parent=root,bevel=0):
 o.name=name;o.parent=parent;o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def box(name,pos,size,m,parent=root,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,parent,bevel)
def cyl(name,pos,r,depth,m,axis='Z',parent=root):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=pos);o=bpy.context.object
 if axis=='X':o.rotation_euler.y=math.pi/2
 if axis=='Y':o.rotation_euler.x=math.pi/2
 return finish(o,name,m,parent,.003)
def tube(name,pts,r,m,parent=root,closed=False):
 bpy.ops.object.select_all(action='DESELECT')
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3;sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
 for p,v in zip(sp.points,pts):p.co=(*v,1)
 sp.use_cyclic_u=closed;o=bpy.data.objects.new(name,cu);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(m)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o
# Hollow arched shell with an open mouth.
verts=[]
for radius in [.34,.315]:
 for y in [-.52,.42]:
  for i in range(33):a=math.pi*i/32;verts.append((radius*math.cos(a),y,1.48+radius*math.sin(a)))
faces=[]
for i in range(32):faces.extend([(i,i+1,34+i,33+i),(66+i,99+i,100+i,67+i),(i,66+i,67+i,i+1),(33+i,34+i,100+i,99+i)])
faces.extend([(0,33,99,66),(32,98,131,65)])
me=bpy.data.meshes.new('Arched metal');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Mailbox rounded roof',me);scene.collection.objects.link(o);finish(o,o.name,teal)
for p in me.polygons:p.use_smooth=True
for x in [-.3275,.3275]:box('Mailbox side wall',(x,-.05,1.315),(.025,.94,.33),teal,bevel=.006)
box('Mailbox floor',(0,-.05,1.1625),(.63,.94,.025),inside,bevel=.004)
def profile(r=.33,h=.33):return [(-r,0),(r,0)]+[(r*math.cos(math.pi*i/32),h+r*math.sin(math.pi*i/32)) for i in range(33)]
def plate(name,y,depth,m,parent=root,zbase=1.15,r=.33):
 shape=profile(r);n=len(shape);v=[(x,yy,z+zbase) for yy in [y-depth/2,y+depth/2] for x,z in shape]
 f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);return finish(o,name,m,parent,.006)
plate('Mailbox rear cap',.421,.028,teal)
tube('Brass opening rim',[(x,-.539,z+1.15) for x,z in profile(.345)],.012,brass,closed=True)
door=node('MailboxDoorPivot',root,(0,-.563,1.15))
plate('Mailbox hinged door',0,.034,teal,door,0,.326)
tube('Door inset reveal',[(x,-.024,z+.033) for x,z in profile(.286,.30)],.006,brass,door,True)
box('Latch escutcheon',(0,-.033,.45),(.115,.014,.10),brass,door)
for x in [-.043,.043]:cyl('Handle mount',(x,-.065,.45),.012,.065,brass,'Y',door)
tube('Door pull',[(-.043,-.094,.45),(-.043,-.107,.45),(.043,-.107,.45),(.043,-.094,.45)],.014,brass,door)
for x in [-.21,-.07,.07,.21]:cyl('Hinge knuckle',(x,-.558,1.15),.025,.12,brass,'X')
cyl('Hinge pin',(0,-.558,1.15),.012,.62,black,'X')
box('Envelope plaque',(0,-.027,.215),(.24,.014,.145),brass,door)
tube('Envelope flap',[(-.104,-.038,.273),(0,-.038,.208),(.104,-.038,.273)],.006,teal,door)
tube('Envelope lower fold',[(-.104,-.038,.154),(0,-.038,.220),(.104,-.038,.154)],.004,teal,door)
flag=node('MailFlagPivot',root,(.373,-.02,1.43))
box('Red flag lever',(0,.22,0),(.024,.46,.048),red,flag)
box('Red flag paddle',(0,.44,.074),(.024,.155,.19),red,flag,.023)
cyl('Flag bearing',(.351,-.02,1.43),.045,.042,brass,'X')
cyl('Flag axle cap',(.399,-.02,1.43),.028,.014,black,'X')
box('Axle screw slot',(.407,-.02,1.43),(.003,.031,.005),brass,bevel=.001)
for side in [-1,1]:
 for y in [-.40,.31]:cyl('Enamel rivet',(side*.344,y,1.23),.012,.008,brass,'X')
box('Walnut post',(0,.10,.56),(.17,.19,1.12),wood,root,.018)
box('Post shoe',(0,.10,.105),(.205,.225,.21),black)
box('Mounting foot',(0,.10,.025),(.40,.37,.05),black,bevel=.023)
box('Timber support arm',(0,-.06,1.095),(.22,.97,.09),wood,bevel=.017)
for x in [-.15,.15]:box('Mailbox mounting rail',(x,-.05,1.13),(.04,.80,.04),brass,bevel=.006)
for x in [-.05,.035]:tube('Timber grain',[(x,-.001,.24),(x+.008,-.002,.48),(x-.006,-.002,.75),(x+.004,-.002,1.02)],.0025,grain)
for y in [-.32,.29]:
 a=Vector((0,.10,.78));b=Vector((0,y,1.05));v=b-a;o=box('Post diagonal brace',(a+b)/2,(.075,.075,v.length),wood,bevel=.008);o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
for x in [-.14,.14]:
 for y in [-.015,.215]:cyl('Foot anchor bolt',(x,y,.056),.019,.014,brass)
# Orient the custom shell and door faces outward for backface-culling engines.
for o in root.children_recursive:
 if o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
# Separate named clips; opening a door never raises the flag as a side effect.
for pivot,name in [(flag,'MailFlagRaise'),(door,'MailboxDoorOpen')]:
 pivot.rotation_mode='XYZ';pivot.rotation_euler.x=0;pivot.keyframe_insert('rotation_euler',frame=1)
 pivot.rotation_euler.x=math.pi/2;pivot.keyframe_insert('rotation_euler',frame=25)
 action=pivot.animation_data.action;action.name=name
 track=pivot.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);pivot.animation_data.action=None
scene.frame_start=1;scene.frame_end=25;scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'mailbox.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_cameras=False,export_lights=False)
# Studio scene is only saved to .blend; never exported to the game asset.
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.12,.18,.23,1);bg.inputs[1].default_value=.5
for name,pos,power,size in [('Key',(3,-4,5),450,4),('Fill',(-3,-1,3),250,3),('Rim',(1,3,4),500,3)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-4,2.8));camera=bpy.context.object;camera.rotation_euler=(Vector((0,-.02,1.05))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.55;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mailbox.blend'))
if '--preview' in sys.argv:
 for pivot in [flag,door]:
  for track in pivot.animation_data.nla_tracks:track.mute=True
 flag.rotation_euler.x=math.pi/2;door.rotation_euler.x=0
 scene.render.image_settings.file_format='PNG';(OUT/'previews').mkdir(exist_ok=True);scene.render.filepath=str(OUT/'previews'/'mailbox.png');bpy.ops.render.render(write_still=True)
print('MAILBOX_COMPLETE')
