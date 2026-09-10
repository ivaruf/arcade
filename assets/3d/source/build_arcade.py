"""Static arcade kit. Run with Blender --background --python build_arcade.py.
Outputs beside source/. Blender Z up; GLB Y up; meters; cabinets face -Y.
"""
import bpy, math, random, shutil
from pathlib import Path
from mathutils import Vector
OUT = Path(__file__).resolve().parent.parent
OUT.mkdir(parents=True, exist_ok=True)
(OUT/'previews').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(12)
def material(name, color, metal=0, glow=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.36
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=glow
    return m
navy=material('Midnight enamel',(.022,.035,.08),.25)
wall=material('Indigo wall',(.055,.065,.13))
floor=material('Blue charcoal floor',(.035,.052,.075),.15)
black=material('Rubber and screen bezel',(.007,.012,.021))
white=material('Warm ivory',(.85,.86,.75))
cyan=material('Mint neon',(.07,.85,.72),.2,2)
pink=material('Coral neon',(.95,.12,.32),.2,2)
gold=material('Honey yellow',(.98,.57,.06),.1,.6)
blue=material('Periwinkle',(.22,.3,.95),.15,1)
screen=material('Screen glass',(.012,.06,.085),.4,.3)
chrome=material('Brushed metal',(.3,.38,.42),.8)
all_roots=[]
root=None
def empty(name):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); return o
def finish(o,name,mat):
    o.name=name; o.data.materials.append(mat)
    if root: o.parent=root
    return o
def box(name,pos,size,mat,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,mat)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL'); mod.width=bevel; mod.segments=2
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o
def sphere(name,pos,r,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=r,location=pos)
    o=finish(bpy.context.object,name,mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
def cylinder(name,pos,r,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=r,depth=depth,location=pos)
    return finish(bpy.context.object,name,mat)
def text(name,body,pos,size,mat):
    c=bpy.data.curves.new(name,'FONT'); c.body=body; c.align_x='CENTER'; c.size=size; c.extrude=.002; c.bevel_depth=.001
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.location=pos; o.rotation_euler=(math.pi/2,0,0); o.parent=root; c.materials.append(mat)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    for x in bpy.context.selected_objects:
        if x!=o:x.select_set(False)
    bpy.ops.object.convert(target='MESH'); return bpy.context.object

def export(name,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
def members(r):return [r]+list(r.children_recursive)
def make_machine(kind,accent):
    global root
    root=empty('Machine_'+kind); all_roots.append(root)
    box('Foot plinth',(0,0,.10),(1.15,.96,.2),black)
    if kind=='claw':
        box('Prize pedestal',(0,0,.53),(1.05,.88,.85),navy)
        for x in [-.48,.48]:
            for y in [-.37,.37]:box('Window post',(x,y,1.55),(.055,.055,1.3),accent,.01)
        box('Prize chamber back',(0,.39,1.48),(.99,.06,1.15),screen)
        box('Prize shelf',(0,0,.97),(1,.82,.08),chrome)
        for i in range(7):
            x=random.uniform(-.32,.32);y=random.uniform(-.24,.24)
            sphere('Toy body',(x,y,1.08),.11,[pink,gold,cyan][i%3]);sphere('Toy head',(x,y,1.21),.075,white)
        box('Crane rail',(0,0,2.03),(.8,.065,.065),chrome)
        cylinder('Claw cable',(.12,0,1.79),.018,.45,chrome)
        for x in [-.065,.065]:
            o=box('Claw finger',(.12+x,0,1.55),(.025,.03,.16),chrome,.01);o.rotation_euler.y=x*5
        box('Header',(0,0,2.18),(1.13,.95,.27),accent)
        text('Prize title','CLOUD CATCH',(0,-.487,2.14),.115,white)
        box('Prize hatch',(0,-.451,.46),(.48,.035,.25),black)
        box('Control ledge',(0,-.53,1.0),(.85,.3,.1),accent)
    else:
        box('Lower cabinet',(0,.03,.56),(1.02,.84,.94),navy)
        # Side cheeks have a classic stepped arcade silhouette.
        for x in [-.52,.52]:
            box('Side lower',(x,0,.62),(.09,.97,1.1),accent)
            o=box('Side upper',(x,.13,1.49),(.09,.63,.95),accent);o.rotation_euler.x=math.radians(-8)
        box('Screen housing',(0,.12,1.48),(1,.61,.88),navy)
        o=box('CRT bezel',(0,-.205,1.49),(.88,.09,.69),black);o.rotation_euler.x=math.radians(-8)
        o=box('Display',(0,-.26,1.50),(.73,.035,.52),screen,.06);o.rotation_euler.x=math.radians(-8)
        # Static geometric screen illustration, all exported as meshes.
        for i in range(9):
            box('Screen pixel',((i%3-1)*.18,-.294,1.38+(i//3)*.10),(.075,.012,.036),accent,.008)
        box('Marquee',(0,.08,2.01),(1.13,.8,.29),accent)
        text('Marquee lettering',{'classic':'STAR HOP','racer':'CLOUD RALLY','dance':'MOON STEP'}[kind],(0,-.332,1.975),.125,white)
        box('Control deck',(0,-.42,1.02),(1.13,.51,.15),navy)
        box('Deck lip',(0,-.68,1.02),(1.12,.035,.10),accent,.012)
        box('Coin plate',(.23,-.402,.52),(.21,.035,.27),chrome,.015)
        box('Coin slot',(.23,-.426,.57),(.105,.013,.025),black,.004)
        if kind=='racer':
            bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,location=(0,-.62,1.21),major_radius=.21,minor_radius=.035,rotation=(math.radians(60),0,0))
            finish(bpy.context.object,'Steering wheel',black)
            box('Wheel hub',(0,-.62,1.21),(.09,.08,.09),chrome)
            box('Seat base',(0,-1.08,.28),(.66,.76,.4),navy)
            box('Seat cushion',(0,-1.1,.51),(.62,.62,.14),accent)
            box('Seat back',(0,-1.4,.76),(.64,.13,.62),navy)
        elif kind=='dance':
            box('Dance stage',(0,-1.1,.10),(1.55,1.45,.20),chrome)
            for x,y in [(-.45,-1.1),(.45,-1.1),(0,-.65),(0,-1.55)]:
                box('Step tile',(x,y,.22),(.4,.4,.04),accent,.025)
                o=box('Arrow',(x,y,.247),(.14,.14,.01),white,.005);o.rotation_euler.z=math.pi/4
        else:
            cylinder('Joystick stem',(-.29,-.46,1.17),.026,.2,chrome);sphere('Joystick ball',(-.29,-.46,1.28),.073,accent)
            for x,y in [(.12,-.43),(.28,-.43),(.2,-.57),(.36,-.57)]:cylinder('Button',(x,y,1.12),.047,.04,[pink,gold][y<-.5])
    if kind=='claw':sphere('Control knob',(-.2,-.56,1.11),.06,pink)
    export('machine-'+kind,members(root))
    return root
machines=[make_machine('classic',cyan),make_machine('racer',gold),make_machine('dance',pink),make_machine('claw',blue)]
# Prototypes move into the scene only after their standalone origin exports.
placements=[(-5.9,3.6,0),(-3.6,3.6,0),(3.5,3.8,0),(5.9,3.8,0)]
for r,(x,y,a) in zip(machines,placements):r.location=(x,y,0);r.rotation_euler.z=a
for i,(x,y,a) in enumerate([(-7,0,math.pi/2),(-7,-2.6,math.pi/2),(7,.2,-math.pi/2),(7,-2.7,-math.pi/2)]):
    src=machines[0 if i<2 else 3]; mapping={}
    for o in members(src):
        n=o.copy();bpy.context.collection.objects.link(n);mapping[o]=n
    for o,n in mapping.items():
        if o.parent in mapping:n.parent=mapping[o.parent]
    r=mapping[src];r.name='Machine_instance_'+str(i);r.location=(x,y,0);r.rotation_euler.z=a;all_roots.append(r)
root=empty('Arcade_room');room=root
box('Floor',(0,0,-.15),(18,14,.3),floor)
box('Back wall',(0,7,2.75),(18,.22,5.5),wall)
box('Left wall',(-9,0,2.75),(.22,14,5.5),wall)
box('Right wall',(9,0,2.75),(.22,14,5.5),wall)
# Front remains an entrance; roof is a separate removable asset.
for x in [-7,7]:box('Entrance return',(x,-7,2.75),(4,.22,5.5),wall)
box('Entrance header',(0,-7,5.05),(10,.24,.9),navy)
for z in [.28,3.0,5.1]:
    box('Back light strip',(0,6.84,z),(17.7,.045,.055),cyan,.01)
    for x in [-8.84,8.84]:box('Side light strip',(x,0,z),(.045,13.8,.055),pink if z==3 else cyan,.01)
for x in [-8,-4,0,4,8]:box('Floor seam',(x,0,.008),(.018,13.8,.008),chrome,0)
for y in [-6,-3,0,3,6]:box('Floor seam',(0,y,.008),(17.8,.018,.008),chrome,0)
# Central loop leaves broad unobstructed floor and a 3m+ flight volume.
for x in [-2.1,2.1]:box('Runway border',(x,-.6,.014),(.045,9.8,.012),cyan,.008)
for y in [-5.5,4.3]:box('Runway end',(0,y,.014),(4.2,.045,.012),cyan,.008)
box('Back sign panel',(0,6.68,3.98),(7,.18,1.32),navy,.12)
text('Room title','CLOUD NINE',(0,6.56,4.07),.64,cyan)
text('Room subtitle','A R C A D E',(0,6.55,3.67),.27,white)
for x in [-8,8]:
    box('Bench base',(x,-5,.28),(.85,1.6,.48),navy)
    box('Bench cushion',(x,-5,.55),(.92,1.7,.16),pink)
for x in [-6,-3,3,6]:
    box('Acoustic wall panel',(x,6.82,1.55),(1.1,.12,1.7),navy)
export('arcade-room',members(room))
export('arcade-environment',[o for r in [room]+all_roots for o in members(r)])
root=empty('Removable_ceiling');roof=root
box('Ceiling',(0,0,5.65),(18.2,14.2,.25),navy)
for x in [-6,0,6]:box('Ceiling light',(x,0,5.49),(.18,11,.045),cyan)
export('arcade-ceiling',members(roof));roof.hide_render=True
for o in roof.children_recursive:o.hide_render=True;o.hide_set(True)
# Gopher source copies are separate assets; shown only in the Blender composition.
root=None
for filename,pos in [('gopher-scarf.glb',(-1,-2.7,0)),('gopher-scarf-cloud.glb',(1,1.1,2.5))]:
    path=OUT/filename
    if path.exists():
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path))
        imported=set(bpy.data.objects)-before
        pivot=empty('Scale_reference_'+path.stem);pivot.location=pos
        for o in imported:
            if o.parent is None:o.parent=pivot
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.12,.12,.12)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.17,.25,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
for name,pos,power,size,color in [('Key',(0,-2,8),2600,9,(.7,.85,1)),('Warm',(-6,-3,5),1300,6,(1,.44,.27)),('Mint',(3,4,5),1800,5,(.3,1,.8))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=pos
    o.rotation_euler=(Vector((0,1,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(14,-22,17));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=26
scene.camera=camera;scene.render.resolution_x=1300;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
# Render a cutaway with the near-side wall removed; GLBs retain complete walls.
for o in room.children_recursive:
    if o.name.startswith(('Right wall','Entrance return','Entrance header')) or (o.name.startswith('Side light strip') and o.location.x > 0):o.hide_render=True
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arcade.blend'))
scene.render.filepath=str(OUT/'previews'/'arcade-overview.png');bpy.ops.render.render(write_still=True)
camera.location=(0,-6.5,3.3);camera.rotation_euler=(Vector((0,4,1.8))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='PERSP';camera.data.lens=22
scene.render.filepath=str(OUT/'previews'/'arcade-interior.png');bpy.ops.render.render(write_still=True)
print('ARCADE_BUILD_COMPLETE')
