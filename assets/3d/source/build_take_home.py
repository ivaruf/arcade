"""Standalone cartridge dispenser. No game integration. --preview renders studio art."""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent.parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
def node(name,parent=None,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=pos;return o
root=node('TakeHomeDispenser')
def mat(name,color,metal=0,rough=.5,glow=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=glow;return m
teal=mat('Dispenser enamel',(.025,.15,.17),.25)
accent=mat('Dispenser accent - recolor per game',(.06,.62,.48),.15,.4,.15)
brass=mat('Satin brass',(.57,.38,.16),.65,.38)
dark=mat('Recess shadow',(.012,.023,.035),.15,.7)
cream=mat('Warm ivory',(.94,.85,.63),0,.6)
coral=mat('Cartridge coral',(.70,.095,.13),.12)
violet=mat('Cartridge violet',(.25,.105,.49),.12)
rubber=mat('Rubber feet',(.014,.018,.021),0,.9)
glass=mat('Display glazing',(.35,.66,.69),0,.22)
p=glass.node_tree.nodes['Principled BSDF'];p.inputs['Alpha'].default_value=.10;glass.diffuse_color=(.35,.66,.69,.10);glass.surface_render_method='DITHERED';glass.use_transparency_overlap=False
font=None
for path in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf','/System/Library/Fonts/Supplemental/Verdana Bold.ttf']:
 if Path(path).exists():font=bpy.data.fonts.load(path);break
def finish(o,name,m,parent=root,bevel=0):
 o.name=name;o.parent=parent;o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Soft enclosure edges','BEVEL');mod.width=bevel;mod.segments=4;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def box(name,pos,size,m,parent=root,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,parent,bevel)
def cyl(name,pos,r,h,m,parent=root,front=False):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=h,location=pos);o=bpy.context.object
 if front:o.rotation_euler.x=math.pi/2
 return finish(o,name,m,parent,.004)
def tube(name,pts,r,m,parent=root):
 bpy.ops.object.select_all(action='DESELECT');cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3;cu.use_fill_caps=True;s=cu.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,cu);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o
def text(name,label,pos,size,m,parent=root):
 cu=bpy.data.curves.new(name,'FONT');cu.body=label;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.0007;cu.bevel_depth=.0003
 if font:cu.font=font
 o=bpy.data.objects.new(name,cu);scene.collection.objects.link(o);o.parent=parent;o.location=pos;o.rotation_euler.x=math.pi/2;cu.materials.append(m)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False);return o
# Hollow upper display; stepped plinth avoids coplanar side/base seams.
for x in [-.245,.245]:
 for y in [-.18,.18]:cyl('Isolating rubber foot',(x,y,.025),.045,.05,rubber)
box('Brass plinth',(0,0,.085),(.72,.60,.12),brass,bevel=.035)
box('Lower service cabinet',(0,.01,.35),(.64,.51,.41),teal,bevel=.045)
box('Display rear',(0,.22,.805),(.64,.07,.56),dark,bevel=.025)
for x in [-.285,.285]:
 box('Rounded display pillar',(x,0,.82),(.10,.52,.57),teal,bevel=.033)
 box('Pillar accent inlay',(x,-.265,.81),(.023,.009,.43),accent,bevel=.008)
box('Display sill',(0,-.005,.566),(.60,.50,.07),brass,bevel=.018)
box('Display velvet shelf',(0,-.015,.61),(.48,.37,.025),dark,bevel=.006)
box('Marquee crown',(0,0,1.13),(.70,.57,.22),teal,bevel=.055)
box('Marquee gold bezel',(0,-.291,1.13),(.61,.025,.15),brass,bevel=.023)
box('Marquee inset',(0,-.308,1.13),(.578,.012,.122),dark,bevel=.015)
text('Take it home title','TAKE IT HOME',(0,-.318,1.132),.067,cream)
box('Crown highlight',(0,-.035,1.235),(.45,.31,.013),accent,bevel=.006)
# Glazing remains below the front trim, never coincident with its faces.
box('Display window',(0,-.261,.812),(.47,.009,.40),glass,bevel=.004)
for z in [.614,1.007]:box('Window brass rail',(0,-.272,z),(.48,.018,.015),brass,bevel=.005)
def cartridge(name,parent,pos,color):
 pivot=node(name,parent,pos)
 box('Cartridge rounded shell',(0,0,0),(.143,.045,.205),color,pivot,.014)
 box('Cartridge label',(0,-.026,.018),(.112,.009,.124),cream,pivot,.007)
 box('Cartridge label stripe',(0,-.032,-.023),(.088,.004,.014),color,pivot,.002)
 for x in [-.048,.048]:cyl('Cartridge screw',(x,-.027,-.081),.005,.004,brass,pivot,True)
 for i in range(5):box('Cartridge contact',(i*.014-.028,-.002,-.103),(.008,.025,.009),brass,pivot,.001)
 # Little home graphic: suggests taking the game home, not paying for it.
 tube('Cartridge home roof',[(-.032,-.033,.035),(0,-.033,.063),(.032,-.033,.035)],.0035,color,pivot)
 tube('Cartridge home walls',[(-.024,-.033,.037),(-.024,-.033,.005),(.024,-.033,.005),(.024,-.033,.037)],.003,color,pivot)
 return pivot
for i,color in enumerate([accent,coral,violet]):
 p=cartridge('DisplayCartridge'+str(i+1),root,((i-1)*.158,-.10,.788),color);p.rotation_euler.y=(i-1)*-.12
box('Display lamp',(0,.12,1.016),(.36,.07,.018),accent,bevel=.005)
# Lower controls: inset home medallion and one inviting push button.
cyl('Home badge bezel',(-.19,-.255,.465),.063,.016,brass,front=True)
cyl('Home badge face',(-.19,-.268,.465),.053,.014,dark,front=True)
tube('Home badge roof',[(-.224,-.278,.468),(-.19,-.278,.50),(-.156,-.278,.468)],.005,cream)
tube('Home badge walls',[(-.216,-.278,.470),(-.216,-.278,.435),(-.164,-.278,.435),(-.164,-.278,.470)],.004,cream)
box('Home badge door',(-.19,-.279,.444),(.012,.007,.018),accent,bevel=.001)
cyl('Button collar',(.18,-.267,.465),.075,.026,brass,front=True)
button=node('InstallButtonPivot',root,(.18,-.291,.465))
cyl('Chunky install button',(0,-.012,0),.059,.039,accent,button,True)
# Raised downward arrow on the button, as a modelled icon.
tube('Button arrow',[(0,-.035,.025),(0,-.035,-.018)],.005,cream,button)
tube('Button arrowhead',[(-.017,-.035,-.005),(0,-.035,-.024),(.017,-.035,-.005)],.005,cream,button)
# Delivery recess and separately hinged flap; the tray catches a souvenir cartridge.
box('Delivery brass surround',(0,-.262,.275),(.47,.033,.19),brass,bevel=.026)
box('Delivery dark pocket',(0,-.283,.275),(.425,.015,.145),dark,bevel=.014)
flap=node('DeliveryFlapPivot',root,(0,-.299,.342))
box('Delivery flap',(0,0,-.045),(.395,.014,.09),teal,flap,.01)
cyl('Flap hinge',(0,-.302,.343),.009,.40,brass).rotation_euler.y=math.pi/2
box('Catch tray',(0,-.32,.173),(.49,.24,.028),teal,bevel=.012)
box('Tray front lip',(0,-.433,.190),(.49,.025,.06),brass,bevel=.01)
for x in [-.233,.233]:box('Tray cheek',(x,-.32,.20),(.022,.23,.055),brass,bevel=.008)
output=cartridge('DispenseCartridgePivot',root,(0,-.315,.212),accent);output.rotation_euler.x=math.pi/2
# Service seams, ventilation slots and a few visible fasteners.
for x in [-.322,.322]:
 for z in [.25,.29,.33]:box('Side ventilation recess',(x,.05,z),(.007,.21,.012),dark,bevel=.004)
 for y in [-.17,.19]:
  rivet=cyl('Service rivet',(x,y,.42),.009,.006,brass);rivet.rotation_euler.y=math.pi/2
box('Back service plate',(0,.271,.35),(.43,.018,.25),dark,bevel=.015)
for o in root.children_recursive:
 if o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'take-home-dispenser.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
# Studio rig only exists in the editable Blender file.
scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.12,.18,.23,1);bg.inputs[1].default_value=.5
for name,pos,power,size in [('Key',(2,-3,4),350,3),('Fill',(-3,-1,2),200,3),('Rim',(1,3,3),400,2)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.65))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2,-3,1.85));camera=bpy.context.object;camera.rotation_euler=(Vector((0,-.04,.63))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=1.65;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.render.resolution_x=960;scene.render.resolution_y=1050;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'take-home-dispenser.blend'))
if '--preview' in sys.argv:
 (OUT/'previews').mkdir(exist_ok=True);scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'previews'/'take-home-dispenser.png');bpy.ops.render.render(write_still=True)
print('TAKE_HOME_DISPENSER_COMPLETE')
