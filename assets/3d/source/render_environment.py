"""Render the generated cloud-world and optionally save its editable source scene."""
import bpy, runpy, sys, math
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent.parent
preview_dir=out/'previews'/'environment'
preview_dir.mkdir(parents=True,exist_ok=True)
runpy.run_path(str(Path(__file__).with_name('build_clouds.py')),run_name='__main__')
# Presentation references only: build_clouds has already exported the world.
for filename,pos,yaw in [('machine-classic.glb',(-15,20.3,1),0),('machine-classic.glb',(0,-20,6),-math.pi),('gopher-scarf.glb',(0,-2.1,0),0),('machine-classic.glb',(2.2,19.4,1.5),0),('machine-classic.glb',(-2.2,19.4,1.5),0),('machine-classic.glb',(13,7,-2.5),math.pi/2),('machine-classic.glb',(13,3,-2.5),math.pi/2),('machine-classic.glb',(-24,2,-5.5),-math.atan2(-24,2)),('machine-classic.glb',(-22,-20.5,-5.5),-math.pi),('gopher-scarf.glb',(-17.5,8,-5.5),math.pi/2)]:
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(out/filename))
    imported=set(bpy.data.objects)-before
    pivot=bpy.data.objects.new('Preview reference '+filename,None);scene_ref=bpy.context.scene;scene_ref.collection.objects.link(pivot)
    pivot.location=pos;pivot.rotation_euler.z=yaw
    for o in imported:
        if o.parent not in imported:o.parent=pivot
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.use_nodes=True
bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.38,.52,.72,1);bg.inputs[1].default_value=.55
ld=bpy.data.lights.new('Afternoon sunlight','SUN');ld.energy=2;ld.angle=.15
sun=bpy.data.objects.new('Afternoon sunlight',ld);scene.collection.objects.link(sun);sun.rotation_euler=(.4,-.6,-.4)
ld=bpy.data.lights.new('Soft sky fill','AREA');ld.energy=1800;ld.shape='DISK';ld.size=20
light=bpy.data.objects.new('Soft sky fill',ld);scene.collection.objects.link(light);light.location=(0,5,24)
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for name,loc,target,scale in [('environment',(40,-48,38),(0,10,2),66),('welcome',(13,-17,12),(0,0,1),18),('water',(32,-8,10),(17,5,-.3),19),('mine',(0,-9,9),(-15,8,-3.3),23),('calm',(16,7,21),(5,21,11.4),16)]:
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale
 scene.render.filepath=str(preview_dir/f'{name}.png');
 if '--no-render' not in sys.argv:bpy.ops.render.render(write_still=True)
 if name=='environment':bpy.ops.wm.save_as_mainfile(filepath=str(out/'cloud-world.blend'))
