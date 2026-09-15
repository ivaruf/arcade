"""A true two-control-bank cabinet based on the arcade's existing classic shell."""
import bpy
from pathlib import Path
from mathutils import Matrix,Vector
out=Path(__file__).resolve().parent.parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(out/'machine-classic.glb'))
bpy.context.view_layer.update()
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
wide=Matrix.Diagonal((2,1,1,1))
for o in meshes:
    world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
    if o.name.startswith(('Joystick','Button')):
        twin=o.copy();twin.data=o.data;bpy.context.collection.objects.link(twin)
        o.location.x-=.58;twin.location.x+=.58
        o.name='Player one '+o.name;twin.name='Player two '+twin.name
    else:o.matrix_world=wide@world
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'machine-double.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
print('DOUBLE_CABINET_COMPLETE')
