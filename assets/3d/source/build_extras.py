"""Cloud Nine set dressing: the things a room has that a model kit does not.

    /Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_extras.py

Writes ONE file, arcade-props.glb, beside the rest of the kit. It deliberately
does not touch arcade.blend, the previews, or any of build_arcade.py's outputs,
so the two scripts can be run in either order without clobbering each other.

WHY THIS EXISTS: build_arcade.py gives you a floor, walls, a sign and eight
machines, which is a showroom. What makes 18 x 14 metres read as a place
somebody works in is the boring furniture — a token machine by the door, a
plant nobody waters, a bin, a mat that has been walked on, posters, and bunting
left up from an opening night. All of it is scenery: the game never interacts
with any of it beyond bumping into four pieces.

Everything is placed at its final position in ROOM coordinates, so the GLB is
loaded once at the origin and never moved. The collision boxes for the four
solid pieces are written by hand in cloudnine/js/room.js; if you move something
here, move it there too. The conversion between these coordinates and the
game's is documented at the top of that file.

Blender is Z up and the room's back wall (the CLOUD NINE sign) is at +Y here.
Materials reuse build_arcade.py's names and values exactly, so nothing added
below looks like it came from a different room.
"""

import bpy
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
random.seed(31)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metal=0.0, glow=0.0, rough=0.36):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Emission Color"].default_value = (*color, 1)
    p.inputs["Emission Strength"].default_value = glow
    return m


# The kit's palette, unchanged.
navy = material("Midnight enamel", (0.022, 0.035, 0.08), 0.25)
black = material("Rubber and screen bezel", (0.007, 0.012, 0.021))
white = material("Warm ivory", (0.85, 0.86, 0.75))
cyan = material("Mint neon", (0.07, 0.85, 0.72), 0.2, 2)
pink = material("Coral neon", (0.95, 0.12, 0.32), 0.2, 2)
gold = material("Honey yellow", (0.98, 0.57, 0.06), 0.1, 0.6)
blue = material("Periwinkle", (0.22, 0.3, 0.95), 0.15, 1)
screen = material("Screen glass", (0.012, 0.06, 0.085), 0.4, 0.3)
chrome = material("Brushed metal", (0.3, 0.38, 0.42), 0.8)
# Two the kit had no use for.
leaf = material("Planter leaf", (0.075, 0.34, 0.16), 0.0, 0.0, 0.55)
clay = material("Planter clay", (0.40, 0.17, 0.12), 0.0, 0.0, 0.6)

root = bpy.data.objects.new("Arcade_props", None)
bpy.context.collection.objects.link(root)


def finish(o, name, mat):
    o.name = name
    o.data.materials.append(mat)
    o.parent = root
    return o


def box(name, pos, size, mat, bevel=0.02, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot:
        o.rotation_euler = rot
    finish(o, name, mat)
    if bevel:
        mod = o.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        o.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return o


def cylinder(name, pos, r, depth, mat, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=depth, location=pos)
    o = bpy.context.object
    if rot:
        o.rotation_euler = rot
    return finish(o, name, mat)


def sphere(name, pos, r, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=r, location=pos)
    o = finish(bpy.context.object, name, mat)
    for poly in o.data.polygons:
        poly.use_smooth = True
    return o


def text(name, body, pos, size, mat, rot=(math.pi / 2, 0, 0)):
    c = bpy.data.curves.new(name, "FONT")
    c.body = body
    c.align_x = "CENTER"
    c.size = size
    c.extrude = 0.002
    c.bevel_depth = 0.001
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = rot
    o.parent = root
    c.materials.append(mat)
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.object


# ---------------------------------------------------------------------------
# The token machine, by the door. Coin-operated arcades need somewhere to get
# coins, and it gives the entrance something to be beside.
# ---------------------------------------------------------------------------
TX, TY = 7.4, -6.1
box("Token cabinet", (TX, TY, 0.62), (1.0, 0.8, 1.24), navy)
box("Token plinth", (TX, TY, 0.06), (1.04, 0.84, 0.12), black)
box("Token header", (TX, TY, 1.35), (1.04, 0.82, 0.22), gold)
text("Token lettering", "TOKENS", (TX, TY - 0.42, 1.31), 0.1, white)
box("Token face", (TX, TY - 0.405, 0.86), (0.74, 0.03, 0.34), screen, 0.04)
box("Token tray", (TX, TY - 0.44, 0.34), (0.46, 0.1, 0.1), chrome, 0.02)
box("Token slot", (TX + 0.28, TY - 0.42, 0.62), (0.12, 0.02, 0.03), black, 0.004)
cylinder("Token knob", (TX - 0.26, TY - 0.42, 0.6), 0.06, 0.05, chrome, (math.pi / 2, 0, 0))

# ---------------------------------------------------------------------------
# Two planters. Nobody in an arcade has ever looked at these, which is exactly
# what makes a room feel real.
# ---------------------------------------------------------------------------
for i, (px, py) in enumerate([(-6.6, -6.2), (5.6, -6.2)]):
    tag = f"Planter{i}"
    cylinder(f"{tag} pot", (px, py, 0.26), 0.3, 0.52, clay)
    cylinder(f"{tag} rim", (px, py, 0.5), 0.32, 0.06, clay)
    cylinder(f"{tag} soil", (px, py, 0.52), 0.27, 0.02, black)
    cylinder(f"{tag} stem", (px, py, 0.72), 0.035, 0.4, leaf)
    for j in range(7):
        a = (j / 7) * math.tau + i
        lift = 0.86 + (j % 3) * 0.12
        reach = 0.2 + (j % 2) * 0.1
        o = sphere(f"{tag} leaf", (px + math.cos(a) * reach, py + math.sin(a) * reach, lift), 0.17, leaf)
        o.scale = (1.0, 0.55, 0.4)
        o.rotation_euler = (0, 0, a)

# ---------------------------------------------------------------------------
# A bin, and the mat everybody wipes their feet on.
# ---------------------------------------------------------------------------
cylinder("Bin body", (-4.9, -6.25, 0.33), 0.24, 0.66, navy)
cylinder("Bin rim", (-4.9, -6.25, 0.66), 0.26, 0.05, chrome)
cylinder("Bin mouth", (-4.9, -6.25, 0.665), 0.21, 0.03, black)

box("Entrance mat", (0, -6.4, 0.012), (3.4, 1.1, 0.024), black, 0.01)
# The trim is a BORDER, not a filled panel. A 3 x 0.9 m slab of the neon
# material reads as a lightbox let into the floor once a glow layer gets hold
# of it; four thin bars read as piping stitched round the edge of a mat.
for dx, dy, w, d in ((0, 0.42, 3.1, 0.03), (0, -0.42, 3.1, 0.03), (1.53, 0, 0.03, 0.87), (-1.53, 0, 0.03, 0.87)):
    box("Mat trim", (dx, -6.4 + dy, 0.026), (w, d, 0.006), cyan, 0)

# ---------------------------------------------------------------------------
# An A-frame sign pointing the way in, because the room has a direction and
# nothing in it said so.
# ---------------------------------------------------------------------------
SX, SY = -2.6, -5.4
for sign, tilt in ((1, 0.22), (-1, -0.22)):
    box(
        f"Sign board {sign}",
        (SX, SY + sign * 0.14, 0.52),
        (0.8, 0.04, 0.92),
        navy,
        0.015,
        rot=(tilt, 0, 0),
    )
box("Sign hinge", (SX, SY, 0.96), (0.82, 0.14, 0.05), chrome, 0.015)
text("Sign lettering", "THIS WAY", (SX, SY - 0.19, 0.64), 0.1, white, rot=(math.pi / 2 - 0.22, 0, 0))
o = box("Sign arrow", (SX, SY - 0.215, 0.42), (0.2, 0.02, 0.2), cyan, 0.01, rot=(-0.22, 0, math.pi / 4))

# ---------------------------------------------------------------------------
# Wall posters, and bunting nobody took down. Both are flat and neither has a
# collision box: the walls already stop you.
# ---------------------------------------------------------------------------
for i, (wx, wy, accent) in enumerate([(-8.84, 2.4, pink), (-8.84, -1.6, cyan), (8.84, 1.2, gold), (8.84, -3.2, blue)]):
    side = 1 if wx < 0 else -1
    box(f"Poster{i} back", (wx + side * 0.07, wy, 2.5), (0.05, 1.15, 1.6), navy, 0.01)
    box(f"Poster{i} art", (wx + side * 0.1, wy, 2.62), (0.02, 0.92, 1.1), accent, 0.01)
    box(f"Poster{i} caption", (wx + side * 0.1, wy, 1.86), (0.02, 0.92, 0.16), white, 0.01)

for i in range(13):
    x = -4.2 + i * 0.7
    drop = 0.12 + 0.1 * math.sin(i * 0.9)
    flag = box(
        f"Bunting{i}",
        (x, -6.86, 4.6 - drop),
        (0.26, 0.01, 0.3),
        [cyan, pink, gold][i % 3],
        0,
        rot=(0, 0, 0),
    )
    flag.rotation_euler = (0, math.radians(45), 0)
box("Bunting line", (0, -6.86, 4.78), (9.2, 0.012, 0.012), chrome, 0)

# ---------------------------------------------------------------------------
# Outside.
#
# The kit's front wall is an opening, which is right — you can see out of an
# arcade. But there is nothing out there, so standing in the doorway looks off
# the edge of the world into pure black. This is the cheapest honest fix: a
# strip of pavement, a wall across the street with somebody else's neon on it,
# and three blocks of building above the roofline. The player can never reach
# any of it (the game stops them in the doorway), so it needs no detail and no
# collision — it only has to be a somewhere rather than a nowhere.
# ---------------------------------------------------------------------------
pavement = material("Street asphalt", (0.020, 0.026, 0.038), 0.1, 0.0, 0.7)
facade = material("Across the street", (0.032, 0.038, 0.062))

box("Pavement", (0, -9.9, -0.16), (16, 5.9, 0.3), pavement, 0)
box("Kerb", (0, -7.15, -0.04), (16, 0.3, 0.09), chrome, 0)
box("Facade", (0, -12.9, 3.4), (22, 0.4, 6.8), facade, 0)
for i, (fx, fw, fh, mat) in enumerate([(-6.5, 5.0, 9.0, facade), (0.5, 6.0, 12.0, facade), (7.5, 5.5, 7.5, facade)]):
    box(f"Block{i}", (fx, -13.6, fh / 2), (fw, 1.2, fh), mat, 0)
# Somebody else's sign, out of focus across the road. Thin, so it glows like a
# tube rather than a panel.
for sy, sz, mat in ((-12.68, 2.1, pink), (-12.68, 4.3, cyan)):
    box("Street neon", (0, sy, sz), (9.0, 0.05, 0.06), mat, 0)
for i in range(9):
    box("Window light", (-7.4 + i * 1.85, -13.0, 5.2 + (i % 3) * 1.4), (0.5, 0.06, 0.34), gold, 0)

# ---------------------------------------------------------------------------
# Export. Selection only, so nothing else in a scene could leak in; no cameras,
# no lights, no animation — this is furniture.
# ---------------------------------------------------------------------------
members = [root] + list(root.children_recursive)
bpy.ops.object.select_all(action="DESELECT")
for o in members:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "arcade-props.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
print("ARCADE_PROPS_COMPLETE", len(members), "objects")
