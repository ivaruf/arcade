"""Lobbots proving ground, exported separately so existing islands stay intact.

Run with Blender --background --python assets/3d/source/lobbots_island.py.
Game coordinates match room.js: centre (-19, .5, 18), twelve metres square.
The two parked walkers occupy the rear; the east and north approaches are open.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent.parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def point(x, y, z):
    return Vector((-x, -z, y))


def material(name, rgb, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = .55
    p.inputs['Emission Color'].default_value = (*rgb, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m


steel = material('Lobbots gunmetal', (.12, .15, .19), .65)
dark = material('Lobbots rubber', (.025, .032, .045))
sand = material('Lobbots ceramic ochre', (.78, .43, .12), .25)
blue = material('Lobbots ceramic teal', (.08, .43, .48), .25)
light = material('Lobbots visor amber', (1, .6, .12), .2, 1.3)
ivory = material('Lobbots deck lines', (.75, .73, .62))
rock = material('Lobbots bedrock', (.23, .19, .15))
cloud = material('Lobbots cloud', (.85, .9, .98))


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def box(name, pos, size, mat, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(*pos))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, name, mat)
    if bevel:
        mod = obj.modifiers.new('Machined edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return obj


def rod(name, a, b, radius, mat):
    a, b = point(*a), point(*b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius,
                                      depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return finish(obj, name, mat)


# A faceted earth underside carries a level steel deck: the collision surface
# is exactly y=.5, including the edges, with no decorative hills to walk through.
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=3.8, radius2=7.5,
                                depth=2.6, location=point(-19, -1.2, 18))
finish(bpy.context.object, 'Proving ground floating bedrock', rock)
box('Proving ground steel deck', (-19, .3, 18), (12, .4, 12), steel)
for x in range(-24, -13, 2):
    box('Deck panel seam', (x, .502, 18), (.025, .004, 11.6), dark, 0)
for z in range(13, 24, 2):
    box('Deck panel seam', (-19, .502, z), (11.6, .004, .025), dark, 0)
for x in (-24.85, -13.15):
    box('Amber perimeter', (x, .52, 18), (.08, .04, 11.7), sand, .01)
for z in (12.15, 23.85):
    box('Amber perimeter', (-19, .52, z), (11.7, .04, .08), sand, .01)
# Landing lane and hazard markings keep the route visually obvious.
for z in (14, 16, 18, 20):
    box('Approach dash', (-14, .508, z), (.12, .012, .8), ivory, 0)
for x in range(-21, -14):
    stripe = box('Display bay hazard stripe', (x, .51, 20.5), (.4, .02, .35), sand, 0)
    stripe.rotation_euler.z = math.pi / 4


def walker(x, mat):
    z = 22
    # Hydraulic legs, broad planted feet, ceramic torso and an elevated gun.
    for side in (-1, 1):
        sx = x + side*.58
        box('Walker foot', (sx, .66, z), (.68, .32, 1.15), dark)
        rod('Walker shin', (sx, .8, z), (sx, 1.42, z+.17), .13, steel)
        rod('Walker thigh', (sx, 1.42, z+.17), (x+side*.38, 2, z), .2, mat)
        rod('Walker piston', (sx+.16, .87, z-.22), (sx+.16, 1.7, z-.12), .055, ivory)
        box('Walker knee', (sx, 1.4, z-.13), (.4, .38, .34), mat)
    box('Walker chassis', (x, 2.18, z), (1.6, 1.04, 1.1), mat, .16)
    box('Walker visor bezel', (x, 2.4, z-.56), (1.18, .29, .08), dark)
    box('Walker lit visor', (x, 2.42, z-.61), (.96, .09, .025), light, .01)
    for i in range(4):
        box('Walker cooling vent', (x-.36+i*.24, 1.99, z-.565), (.12, .19, .03), dark, .01)
    rod('Walker gun mount', (x, 2.65, z), (x, 2.98, z), .28, steel)
    rod('Walker barrel', (x, 2.96, z), (x, 3.45, z-.95), .16, steel)
    rod('Walker muzzle', (x, 3.4, z-.86), (x, 3.5, z-1.05), .23, dark)
    rod('Walker antenna', (x+.66, 2.6, z+.3), (x+.66, 3.16, z+.3), .025, ivory)


walker(-18.5, sand)
walker(-15.5, blue)
rod('Lobbots beacon mast', (-24.5, .5, 18), (-24.5, 5.7, 18), .12, steel)
box('Lobbots beacon lamp', (-24.5, 5.7, 18), (.4, .12, .4), light)
# A single blended cloud, like the arcade's other floating islands.
mb = bpy.data.metaballs.new('Proving ground cloud')
mb.resolution = mb.render_resolution = .35
obj = bpy.data.objects.new('Proving ground cloud', mb)
bpy.context.collection.objects.link(obj)
obj.location = point(-19, -2.9, 18)
obj.scale = (1, 1, .42)
for i in range(8):
    a = i*math.tau/8
    elem = mb.elements.new()
    elem.co = (math.cos(a)*3.5, math.sin(a)*3.5, 0)
    elem.radius = 3.2
mb.materials.append(cloud)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.convert(target='MESH')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'lobbots-island.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'lobbots-island.glb'),
    export_format='GLB', use_selection=True, export_apply=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True)
print('LOBBOTS_ISLAND_COMPLETE')
