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
    else:
        o.matrix_world=wide@world
        # Widen the cheeks slightly beyond the deck's formerly coplanar edge.
        # Keep buttons clear of their inner faces and stay within the 2.4 m collider.
        if o.name.startswith(('Side lower','Side upper')):
            o.location.x += .06 if o.location.x>0 else -.06
            # The stepped upper cheek overlaps the lower cheek vertically.
            # A recessed outer face prevents those two planes fighting too.
            if o.name.startswith('Side upper'):o.scale.x *= .88
bpy.context.view_layer.update()
def bounds(o):
    points=[o.matrix_world@Vector(c) for c in o.bound_box]
    return [min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]
deck=next(o for o in meshes if o.name.startswith('Control deck'))
lo,hi=bounds(deck)
for o in meshes:
    if o.name.startswith(('Side lower','Side upper')):
        a,b=bounds(o)
        assert max(abs(a[0]),abs(b[0]))<1.2, 'Cheek exceeds collider'
        assert max(abs(a[0]),abs(b[0]))>max(abs(lo[0]),abs(hi[0]))+.025, 'Coplanar deck edge'
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'machine-double.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
print('DOUBLE_CABINET_COMPLETE')
