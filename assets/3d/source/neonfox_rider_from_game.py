"""The NeonFox rider for the arcade, made FROM THE GAME'S OWN MODEL.

Run: Blender -b --python assets/3d/source/neonfox_rider_from_game.py
Reads ../neonfox/models/fox-celebration.glb (the hub keeps the games as
siblings of the arcade) and writes assets/3d/neonfox-rider.glb + .blend.

WHY NOT JUST LOAD THE GAME'S FILE. It is 8.9 MB, 180 meshes and 413,000
triangles with two skeletons; three of them riding the neon floor would undo
the work that took the arcade from 2,500 draw calls to 800. And why not the
low-poly lookalike neonfox_island_v2.py builds: the owner looked at it and
said, fairly, "the models are not the same as in the game". So this takes the
real fox and makes it light, keeping what a player recognises — every shape,
material and proportion — and dropping only triangles nobody can see at the
size it rides at:

  1. POSE. The skeleton is evaluated once, part-way through the game's own
     Run_On_Orb clip, and every mesh is baked at that pose: the fox is caught
     mid-stride on its ball, exactly as the game draws it, and the result is
     rigid (the arcade moves it as a whole; it does not need bones).
  2. DECIMATE THE FOX, NOT THE ORB. One collapse ratio for the whole fox,
     with a floor per part so the eyes, claws and whisker pores stay shapes
     instead of vanishing; the three subdivided sculpts (torso, head, muzzle)
     are half its triangles and lose most. The orb is a sphere and three thin
     energy rings, ~4,900 triangles, and stays whole: decimated with the rest
     on the first try it came out faceted and its rings collapsed into a white
     lump under the ball.
  3. JOIN. Two objects, per the runtime contract in js/neonfox.js: the orb
     (everything under the game's OrbRoot) with its origin at the orb centre so
     it can roll about local X, and the fox. Each is one mesh, multi-material.
  4. TINT. The six materials the game's rider.js tintFox recolours are renamed
     "NF tint …" so the arcade recolours the same ones the same way.
  5. SIZE. Scaled so the orb is 0.55 m across like the lookalike, sitting on
     local y = 0, facing +Z as the game's model does.

The root is "NF Game Rider", not "NF Rider": the lookalike stays inside
neonfox-island.glb as the fallback, and neonfox.js prefers this one.
"""
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
SOURCE = HERE.parent.parent.parent.parent / 'neonfox' / 'models' / 'fox-celebration.glb'
FOX_TRIS = 6000           # the fox; the orb is kept whole (see 2. below)
MIN_PART_TRIS = 16        # a part never decimates below this
ORB_DIAMETER = 0.55       # metres, matching the lookalike and the blockers
POSE_AT = 0.3             # fraction of the run clip to freeze at

# The game's tintFox, by material-name prefix (rider.js), and the names the
# arcade's tintPart knows them by.
TINTS = {
    'Slate blue short fur': 'NF tint fur',
    'Russet fur shadows': 'NF tint fur shadow',
    'Golden fur tips': 'NF tint tips',
    'Cyan accents': 'NF tint accent',
    'Azure orb': 'NF tint orb',
    'Energy rings': 'NF tint rings',
}

bpy.ops.wm.read_factory_settings(use_empty=True)
if not SOURCE.exists():
    raise SystemExit(f'neonfox_rider_from_game: {SOURCE} not found (the hub keeps neonfox beside arcade)')
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene = bpy.context.scene

# ---- 1. pose ---------------------------------------------------------------
run = next((a for a in bpy.data.actions if a.name.startswith('Run_On_Orb')), None)
if run:
    for arm in [o for o in scene.objects if o.type == 'ARMATURE'] + [o for o in scene.objects if o.animation_data]:
        if arm.animation_data is None:
            arm.animation_data_create()
    f0, f1 = run.frame_range
    frame = round(f0 + (f1 - f0) * POSE_AT)
    # Every animated object plays the clip's own channels for itself: assign
    # the action where the importer left one, and set the frame.
    for o in scene.objects:
        ad = o.animation_data
        if ad and ad.action and ad.action.name.startswith('Stream_Tag_Backflip'):
            ad.action = run
    scene.frame_set(frame)
else:
    print('neonfox_rider_from_game: no Run_On_Orb clip; baking the rest pose')

bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()


def under(obj, name):
    p = obj.parent
    while p:
        if p.name.startswith(name):
            return True
        p = p.parent
    return False


baked = {'orb': [], 'fox': []}
originals = list(scene.objects)
for obj in originals:
    # Two stray "Icosphere" meshes ride along in the game's file with no
    # material and no parent — build-script leftovers the game never shows.
    # Baked with the rest they became a white block under the ball.
    if obj.type != 'MESH' or not obj.data.materials:
        continue
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    copy = bpy.data.objects.new(obj.name + ' baked', me)
    scene.collection.objects.link(copy)
    copy.matrix_world = ev.matrix_world.copy()
    baked['orb' if (obj.name.startswith('OrbRoot') or under(obj, 'OrbRoot')) else 'fox'].append(copy)
for obj in originals:
    bpy.data.objects.remove(obj, do_unlink=True)


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ---- 2. decimate -----------------------------------------------------------
everything = baked['orb'] + baked['fox']
total = sum(tris(o) for o in everything)
ratio = FOX_TRIS / max(1, sum(tris(o) for o in baked['fox']))
for o in baked['fox']:
    t = tris(o)
    r = min(1.0, max(ratio, MIN_PART_TRIS / max(1, t)))
    if r >= 0.999:
        continue
    mod = o.modifiers.new('Lighter', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = r
    mod.use_collapse_triangulate = True
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
        bpy.ops.object.modifier_apply(modifier=mod.name)

# ---- 5. size and place (before joining, on world matrices) -----------------
lo = Vector((math.inf,) * 3)
hi = Vector((-math.inf,) * 3)
for o in baked['orb']:
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
orb_centre = (lo + hi) / 2
orb_span = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
scale = ORB_DIAMETER / orb_span
# Blender is Z-up here: put the orb's bottom on z = 0 under the origin.
place = Matrix.Scale(scale, 4) @ Matrix.Translation(Vector((-orb_centre.x, -orb_centre.y, -lo.z)))
for o in everything:
    o.matrix_world = place @ o.matrix_world

# ---- 3. join ---------------------------------------------------------------
def join(objs, name):
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    o = objs[0]
    o.name = o.data.name = name
    with bpy.context.temp_override(object=o, active_object=o, selected_editable_objects=[o]):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


orb = join(baked['orb'], 'NF Game Rider orb')
fox = join(baked['fox'], 'NF Game Rider fox')
# The orb's origin at its centre, so a rotation about local X is a roll.
centre = sum((orb.matrix_world @ Vector(c) for c in orb.bound_box), Vector()) / 8
orb.data.transform(Matrix.Translation(-centre))
orb.location = centre

# ---- 4. tint names ---------------------------------------------------------
for m in bpy.data.materials:
    for prefix, name in TINTS.items():
        if m.name.startswith(prefix):
            m.name = name
            break

root = bpy.data.objects.new('NF Game Rider', None)
scene.collection.objects.link(root)
for o in (orb, fox):
    o.parent = root
    o.matrix_parent_inverse = Matrix.Identity(4)

for o in scene.objects:
    o.select_set(o in (root, orb, fox))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'neonfox-rider.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'neonfox-rider.glb'), export_format='GLB',
    use_selection=True, export_apply=True, export_animations=False,
    export_cameras=False, export_lights=False, export_yup=True)
print('NEONFOX_RIDER_COMPLETE', 'tris', tris(orb) + tris(fox), 'from', total,
      'scale', round(scale, 4), 'materials', len(orb.data.materials) + len(fox.data.materials))
