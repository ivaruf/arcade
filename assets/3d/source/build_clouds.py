"""Gopher Cloud Arcade: five platforms in the sky and nothing underneath.

    /Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_clouds.py

Writes ONE file, cloud-world.glb, with every platform at its final position —
so the game loads it at the origin and never moves it, and the numbers here
are the same numbers as the platform rectangles in js/room.js.

WHY THIS REPLACED A BUILDING: flight used to be a toy bolted onto an arcade
with walls. Everything awkward came from that — a chase camera clipping
through a hall, a roof to hide when you rose past it, a ceiling height on
every room so you could not fly out of it, a lift shaft too narrow to film in.
Make the sky the level and all of it goes away. There is nothing to clip.

SCALE IS DELIBERATELY SMALL. Every platform is 17 to 22 m from the welcome
cloud, which is three or four seconds of flight: far enough that going there
is a trip, near enough that you can see all of them at once from the arrival
point and never wonder where anything is. Flying is the fun; hunting is not.

COORDINATES are the GAME's, converted once by bl() on the way out — the same
arrangement `build_world.py` used, and for the same reason: every number here
has a matching collision rectangle and the conversion is a mirror, which is
exactly the thing you get backwards once and then chase for an hour.

    blender.x = -game.x     blender.y = -game.z     blender.z = game.y
    blender rotation.z = -game yaw
"""

import bpy
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
random.seed(9)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------------------
# The sky, in game coordinates. room.js repeats these as platforms.
# ---------------------------------------------------------------------------
# The four game islands sit at the compass points AROUND the welcome cloud,
# one per side, so every one of them is in view from where you arrive and none
# is behind you. WATER is north on purpose: the spawn faces that way, so the
# aquarium — fishtank, the biggest thing here — is the island you are looking
# at before you have touched a key. They used to be bunched into the -Z half, which is exactly
# what made a signpost necessary; spread like this the sky explains itself.
#
# Heights stay deliberately uneven — the steamworks just above, the aquarium a
# little below, the outcrop well down, the quiet cloud high — so getting
# anywhere is still a flight and not a walk in a straight line.
#
# Everything on an island is placed relative to these, so moving one moves its
# structures, its flooring and its trim with it. room.js repeats the rectangles
# and keeps its FURNITURE collision boxes in step by hand; both files say so.
WELCOME = dict(x=0.0, y=0.0, z=0.0, hx=6.0, hz=5.0)
WATER = dict(x=0.0, y=-2.5, z=-19.0, hx=6.5, hz=5.0)    # north — dead ahead on arrival
RACE = dict(x=-19.0, y=1.5, z=0.0, hx=4.5, hz=4.0)      # west
MINE = dict(x=20.0, y=-5.5, z=0.0, hx=8.0, hz=6.0)      # east
CALM = dict(x=0.0, y=6.0, z=18.0, hx=4.5, hz=4.5)       # south, and highest
DAM = dict(x=18.0, y=1.0, z=-18.0, hx=5.5, hz=5.5)  # northeast
ADVENTURE = dict(x=20.0, y=-5.5, z=18.0, hx=6.0, hz=6.0)  # linked to Supermine
DECKS = [WELCOME, RACE, WATER, MINE, CALM, DAM, ADVENTURE]

# ---------------------------------------------------------------------------
# Materials: the kit's palette, plus what a sky needs.
# ---------------------------------------------------------------------------


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


navy = material("Midnight enamel", (0.022, 0.035, 0.08), 0.25)
black = material("Rubber and screen bezel", (0.007, 0.012, 0.021))
white = material("Warm ivory", (0.85, 0.86, 0.75))
cyan = material("Mint neon", (0.07, 0.85, 0.72), 0.2, 2)
pink = material("Coral neon", (0.95, 0.12, 0.32), 0.2, 2)
gold = material("Honey yellow", (0.98, 0.57, 0.06), 0.1, 0.6)
blue = material("Periwinkle", (0.22, 0.3, 0.95), 0.15, 1)
chrome = material("Brushed metal", (0.3, 0.38, 0.42), 0.8)

cloudy = material("Cloud", (0.93, 0.95, 0.99), 0.0, 0.22, 0.55)
cloud_under = material("Cloud underside", (0.72, 0.78, 0.90), 0.0, 0.05, 0.7)
deckwood = material("Deck boards", (0.82, 0.84, 0.88), 0.0, 0.0, 0.5)
rock = material("Cut rock", (0.055, 0.048, 0.052), 0.0, 0.0, 0.85)
ore = material("Ore seam", (0.98, 0.62, 0.12), 0.3, 1.2)
timber = material("Pit timber", (0.16, 0.10, 0.062), 0.0, 0.0, 0.75)
water = material("Tank water", (0.035, 0.30, 0.36), 0.1, 0.5, 0.2)
sand = material("Tank sand", (0.36, 0.33, 0.24), 0.0, 0.0, 0.8)
weed = material("Tank weed", (0.06, 0.30, 0.17), 0.0, 0.0, 0.6)
glassy = material("Pavilion glass", (0.30, 0.62, 0.70), 0.2, 0.25, 0.2)

# ---------------------------------------------------------------------------
# Builders (game coordinates in, Blender out)
# ---------------------------------------------------------------------------

root = None


def bl(x, y, z):
    return (-x, -z, y)


def bl_size(sx, sy, sz):
    return (sx, sz, sy)


def finish(o, name, mat):
    o.name = name
    o.data.materials.append(mat)
    if root:
        o.parent = root
    return o


def box(name, pos, size, mat, bevel=0.02, yaw=0.0, tilt=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=bl(*pos))
    o = bpy.context.object
    o.dimensions = bl_size(*size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if yaw or tilt:
        o.rotation_euler = (tilt, 0.0, -yaw)
    finish(o, name, mat)
    if bevel:
        mod = o.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        o.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return o


def sphere(name, pos, r, mat, scale=(1, 1, 1), segs=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(6, segs // 2), radius=r, location=bl(*pos))
    o = finish(bpy.context.object, name, mat)
    o.scale = bl_size(*scale)
    for poly in o.data.polygons:
        poly.use_smooth = True
    return o


def cylinder(name, pos, r, depth, mat, axis="y"):
    rot = {"y": (0, 0, 0), "x": (0, math.pi / 2, 0), "z": (math.pi / 2, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=r, depth=depth, location=bl(*pos), rotation=rot)
    return finish(bpy.context.object, name, mat)


def text(name, body, pos, size, mat, yaw=0.0):
    c = bpy.data.curves.new(name, "FONT")
    c.body = body
    c.align_x = "CENTER"
    c.size = size
    c.extrude = 0.003
    c.bevel_depth = 0.001
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.location = bl(*pos)
    o.rotation_euler = (math.pi / 2, 0, -yaw)
    o.parent = root
    c.materials.append(mat)
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects:
        x.select_set(False)
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.object


def start(name):
    global root
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    return root


def cloud_mass(name, pos, extent, blobs, mat, resolution=0.24, flat=0.42, seed_jitter=1.0):
    """A cloud, as a metaball surface rather than a heap of spheres.

    This is the one place in the hub where primitives were not good enough.
    Scattered UV spheres read as a heap of balls however many you use, because
    every one keeps its own silhouette — and a flat slab with spheres round the
    rim reads as a table with a doily. Metaball elements MERGE: overlapping
    fields become a single surface with the soft saddles between lobes that
    make a thing look like cloud. Blender converts it to a normal mesh on the
    way out, so nothing downstream knows the difference.

    `flat` squashes the field vertically so the mass spreads instead of
    balling up; `resolution` is polygon budget — lower is finer and there are
    five of these plus scenery, so it stays coarse on purpose.
    """
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    obj = bpy.data.objects.new(name, mb)
    bpy.context.collection.objects.link(obj)
    obj.location = bl(*pos)

    ex, ey, ez = extent
    spacing = 2.0 * max(ex, ey) / max(1.0, math.sqrt(blobs))
    for i in range(blobs):
        el = mb.elements.new()
        el.type = "BALL"
        a = (i / blobs) * math.tau * 1.618  # golden angle: even without a grid
        r = math.sqrt((i + 0.5) / blobs)
        # Local space is Blender's, and this object is not parented yet.
        lx = math.cos(a) * r * ex * random.uniform(0.85, 1.0) * seed_jitter
        ly = math.sin(a) * r * ey * random.uniform(0.85, 1.0) * seed_jitter
        lz = random.uniform(-ez, ez * 0.35) * (0.35 + 0.65 * r)
        el.co = (lx, ly, lz)
        # The radius has to EXCEED the spacing or the elements never merge and
        # you get a heap of separate lumps — the exact failure metaballs were
        # brought in to avoid. Spacing is roughly 2·extent/sqrt(blobs), so the
        # radius is set well above it.
        el.radius = spacing * random.uniform(1.15, 1.55) * (1.15 - 0.3 * r)
        el.stiffness = 2.0

    obj.scale = (1.0, 1.0, flat)
    bpy.context.view_layer.objects.active = obj
    for other in bpy.context.selected_objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    made = bpy.context.object
    made.name = name
    made.data.materials.append(mat)
    for poly in made.data.polygons:
        poly.use_smooth = True
    made.parent = root
    return made


# ---------------------------------------------------------------------------
# A cloud platform: a flat top you can stand on, and a mass of cloud under it.
#
# The top is a thin slab because the collision rectangle is flat and the two
# have to agree; everything below it is decoration and can billow.
# ---------------------------------------------------------------------------


def platform(tag, d, accent=None, blobs=26):
    """A cloud you can stand on.

    THE CLOUD IS THE FLOOR. There is no deck plate: the metaball mass peaks a
    few centimetres below the collision height, so the gopher stands with its
    feet sunk very slightly into the top of the cloud — which is what standing
    on a cloud should look like, and is one less surface to disagree with the
    collision rectangle.
    """
    x, y, z, hx, hz = d["x"], d["y"], d["z"], d["hx"], d["hz"]

    cloud_mass(f"{tag} cloud", (x, y - 1.25, z), (hx * 0.8, hz * 0.8, 0.7), max(9, blobs // 2),
               cloudy, resolution=0.2, flat=0.5)
    # A second, darker mass hanging under it. Cloud is only convincing when the
    # underside is a different colour from the top.
    cloud_mass(f"{tag} underside", (x, y - 2.7, z), (hx * 0.55, hz * 0.55, 0.6), max(5, blobs // 4),
               cloud_under, resolution=0.4, flat=0.55)

    # A lit edge so you can see where the floor stops when you come in to land.
    if accent:
        for sx, sz, w, dd in ((0, hz, hx * 2 - 0.3, 0.07), (0, -hz, hx * 2 - 0.3, 0.07),
                              (hx, 0, 0.07, hz * 2 - 0.3), (-hx, 0, 0.07, hz * 2 - 0.3)):
            box(f"{tag} edge", (x + sx, y + 0.02, z + sz), (w, 0.03, dd), accent, 0)


def beacon(tag, d, accent, height=6.0):
    """A pylon you can see from the welcome cloud. The name board that goes on
    it is drawn at runtime, because the names come from games.json.

    Place the mast on the far edge, away from the hub-facing entrance.
    The runtime board still faces the welcome cloud."""
    x, y, z, hx, hz = d["x"], d["y"], d["z"], d["hx"], d["hz"]
    if abs(x) >= abs(z):
        bx, bz = x + math.copysign(hx - 0.5, x), z
    else:
        bx, bz = x, z + math.copysign(hz - 0.5, z)
    x = bx
    cylinder(f"{tag} mast", (x, y + height / 2, bz), 0.09, height, chrome)
    box(f"{tag} mast base", (x, y + 0.18, bz), (0.7, 0.36, 0.7), navy, 0.05)
    for i in range(4):
        box(f"{tag} mast light", (x, y + height * (i + 1) / 5, bz), (0.22, 0.1, 0.22), accent, 0.02)


# ===========================================================================
# The world
# ===========================================================================
start("Cloud_world")

# ---- 1. the welcome cloud ------------------------------------------------
platform("Welcome", WELCOME, cyan, blobs=30)

# An arch you arrive under, and the two things a new player has to be told.
for sx in (-3.4, 3.4):
    box("Welcome post", (sx, 1.7, -4.2), (0.34, 3.4, 0.34), navy, 0.04)
    box("Welcome post cap", (sx, 3.48, -4.2), (0.5, 0.16, 0.5), cyan, 0.03)
box("Welcome beam", (0, 3.62, -4.2), (7.5, 0.5, 0.42), navy, 0.06)
text("Welcome title", "GOPHER CLOUD", (0, 3.94, -4.42), 0.46, cyan)
text("Welcome title2", "A R C A D E", (0, 3.46, -4.42), 0.26, white)

box("Hint board", (0, 1.5, -4.35), (5.4, 1.5, 0.14), navy, 0.08)
text("Hint line1", "JUMP, THEN JUMP AGAIN", (0, 1.78, -4.44), 0.30, gold)
text("Hint line2", "to ride the cloud and fly", (0, 1.34, -4.44), 0.22, white)
text("Hint line3", "the machines are out there", (0, 0.92, -4.44), 0.17, cloudy)

# There is deliberately no WAY OUT doorway on this cloud any more. One stood at
# (-3.6, 0, 2.2) and closed an installed arcade, and a browser only lets a page
# close a window whose history holds a single entry — which the first game
# played ends for the rest of the session. js/main.js says the rest.

# Something to sit on, because the welcome cloud is also where you come back to.
for bx in (-4.6, 4.6):
    box("Welcome bench", (bx, 0.3, -1.0), (0.7, 0.16, 2.0), cloudy, 0.06)
    for bz in (-1.8, -0.2):
        box("Bench leg", (bx, 0.14, bz), (0.5, 0.28, 0.14), cloud_under, 0.03)

# ---- 2. the racing cloud (maxgear) --------------------------------------
platform("Race", RACE, gold, blobs=20)
beacon("Race", RACE, gold, 5.0)
# A strip of track markings running up to the machine: the platform says what
# is on it before you can read the board.
for i in range(7):
    box("Race chevron", (0, RACE["y"] + 0.025, RACE["z"] + 3.0 - i * 1.05), (2.6, 0.03, 0.18), gold, 0)
for sx in (-3.4, 3.4):
    box("Race barrier", (sx, RACE["y"] + 0.4, RACE["z"]), (0.22, 0.8, 6.0), white, 0.04)
    for i in range(5):
        box("Barrier stripe", (sx, RACE["y"] + 0.4, RACE["z"] - 2.4 + i * 1.2), (0.26, 0.44, 0.4), pink, 0.02)

# ---- 3. the water pavilion (fishtank, dam_break) ------------------------
platform("Water", WATER, cyan, blobs=28)
beacon("Water", WATER, cyan, 5.4)
WX, WY, WZ = WATER["x"], WATER["y"], WATER["z"]
# A glass tank standing on the cloud instead of a wall inside a room.
box("Tank plinth", (WX - 3.6, WY + 0.22, WZ), (2.2, 0.44, 7.4), navy, 0.06)
box("Tank water", (WX - 3.6, WY + 2.0, WZ), (1.9, 3.1, 7.0), water, 0.06)
box("Tank sand", (WX - 3.6, WY + 0.58, WZ), (1.86, 0.28, 6.96), sand, 0.03)
for y_ in (WY + 0.45, WY + 3.55):
    box("Tank frame", (WX - 3.6, y_, WZ), (2.0, 0.12, 7.5), chrome, 0.02)
for z_ in (WZ - 3.5, WZ + 3.5):
    box("Tank frame", (WX - 3.6, WY + 2.0, z_), (2.0, 3.2, 0.12), chrome, 0.02)
for i in range(12):
    h = random.uniform(0.6, 1.8)
    box("Tank weed", (WX - 3.6 + random.uniform(-0.5, 0.5), WY + 0.7 + h / 2, WZ + random.uniform(-3.0, 3.0)),
        (0.1, h, 0.16), weed, 0.03)
for i in range(14):
    sphere("Bubble", (WX - 3.6 + random.uniform(-0.5, 0.5), WY + random.uniform(1.0, 3.4), WZ + random.uniform(-3.2, 3.2)),
           random.uniform(0.05, 0.1), cloudy)
# Four stools facing the machines, and a canopy over the lot.
for i, z_ in enumerate((WZ - 2.7, WZ - 0.9, WZ + 0.9, WZ + 2.7)):
    cylinder("Stool post", (WX + 1.4, WY + 0.3, z_), 0.07, 0.6, chrome)
    cylinder("Stool seat", (WX + 1.4, WY + 0.63, z_), 0.28, 0.1, [pink, cyan, gold, blue][i])
for sx in (-5.4, 5.4):
    for sz in (-4.0, 4.0):
        box("Pavilion post", (WX + sx, WY + 1.9, WZ + sz), (0.18, 3.8, 0.18), glassy, 0.03)
box("Pavilion roof", (WX, WY + 3.95, WZ), (11.4, 0.16, 8.6), glassy, 0.06)
box("Pavilion rim", (WX, WY + 4.1, WZ), (11.6, 0.1, 8.8), cyan, 0.02)

# ---- 4. the mine outcrop (supermine, supermine_adventure) ---------------
platform("Mine", MINE, gold, blobs=24)
beacon("Mine", MINE, gold, 5.2)
MX, MY, MZ = MINE["x"], MINE["y"], MINE["z"]
# Rock hanging under the cloud rather than a room dug into the ground.
for i in range(16):
    a = (i / 16) * math.tau
    r = random.uniform(0.8, 2.3)
    sphere("Outcrop", (MX + math.cos(a) * random.uniform(1.0, 4.6), MY - random.uniform(0.6, 2.6),
                       MZ + math.sin(a) * random.uniform(1.0, 3.8)), r, rock, scale=(1.2, 0.9, 1.2), segs=10)
sphere("Outcrop core", (MX, MY - 2.6, MZ), 3.6, rock, scale=(1.4, 0.9, 1.2), segs=12)
for i in range(14):
    a = random.uniform(0, math.tau)
    box("Ore seam", (MX + math.cos(a) * random.uniform(2.0, 4.8), MY - random.uniform(0.7, 2.4), MZ + math.sin(a) * random.uniform(1.6, 3.6)),
        (random.uniform(0.2, 0.6), random.uniform(0.1, 0.25), random.uniform(0.2, 0.6)), ore, 0.02)
# A pit head on top: props, a headframe and a cart, so it reads as a mine.
for sx in (-2.4, 2.4):
    for sz in (-2.0, 2.0):
        box("Head prop", (MX + sx, MY + 1.7, MZ + sz), (0.28, 3.4, 0.28), timber, 0.03)
box("Head beam", (MX, MY + 3.5, MZ), (5.4, 0.3, 0.3), timber, 0.04)
box("Head wheel housing", (MX, MY + 3.9, MZ), (1.2, 0.9, 0.4), timber, 0.04)
cylinder("Head wheel", (MX, MY + 3.9, MZ - 0.3), 0.62, 0.16, chrome, axis="z")
for x_ in (-0.45, 0.45):
    box("Rail", (MX + x_, MY + 0.06, MZ + 1.4), (0.08, 0.1, 6.0), chrome, 0)
for i in range(9):
    box("Sleeper", (MX, MY + 0.03, MZ - 1.3 + i * 0.72), (1.3, 0.06, 0.16), timber, 0)
box("Cart body", (MX, MY + 0.55, MZ + 3.3), (1.1, 0.8, 1.5), chrome, 0.04)
for i in range(5):
    sphere("Cart ore", (MX + random.uniform(-0.3, 0.3), MY + 0.95, MZ + 3.3 + random.uniform(-0.5, 0.5)), 0.16, ore)
for x_, z_ in ((-4.6, -3.4), (4.6, 3.4)):
    box("Lamp post", (MX + x_, MY + 1.3, MZ + z_), (0.1, 2.6, 0.1), chrome, 0.02)
    sphere("Mine lamp", (MX + x_, MY + 2.5, MZ + z_), 0.2, gold)

# ---- 5. the calm cloud (swirls) -----------------------------------------
platform("Calm", CALM, pink, blobs=22)
beacon("Calm", CALM, pink, 4.6)
CX, CY, CZ = CALM["x"], CALM["y"], CALM["z"]
# A pergola with nothing in it, which is the point.
for sx in (-3.0, 3.0):
    for sz in (-3.0, 3.0):
        box("Pergola post", (CX + sx, CY + 1.55, CZ + sz), (0.16, 3.1, 0.16), cloudy, 0.03)
for i in range(9):
    box("Pergola slat", (CX, CY + 3.16, CZ - 3.0 + i * 0.75), (6.3, 0.08, 0.18), cloudy, 0.02)
box("Pergola rim", (CX, CY + 3.3, CZ), (6.5, 0.06, 6.5), pink, 0.02)
for i in range(24):
    a = (i / 24) * math.tau
    box("Calm ring", (CX + math.cos(a) * 2.1, CY + 0.025, CZ + math.sin(a) * 2.1), (0.2, 0.03, 0.2), pink, 0)
for bx, bz in ((-2.2, 2.2), (2.2, 2.2)):
    box("Calm bench", (CX + bx, CY + 0.28, CZ + bz), (1.6, 0.14, 0.55), cloudy, 0.05)

# ---- 6. the rest of the sky ---------------------------------------------
# Clouds that are only scenery: they give the air depth and a sense of speed
# when you fly past them, and there is nothing to land on.
for i in range(22):
    a = random.uniform(0, math.tau)
    dist = random.uniform(26, 54)
    size = random.uniform(2.2, 5.0)
    cloud_mass(
        "Drifting cloud",
        (math.cos(a) * dist, random.uniform(-16, 20), -9 + math.sin(a) * dist),
        (size, size * 0.7, size * 0.4),
        5,
        cloudy,
        resolution=0.5,
        flat=0.4,
    )
for i in range(12):
    a = random.uniform(0, math.tau)
    dist = random.uniform(15, 26)
    size = random.uniform(1.1, 2.4)
    cloud_mass(
        "Near cloud",
        (math.cos(a) * dist, random.uniform(-12, 16), -9 + math.sin(a) * dist),
        (size, size * 0.75, size * 0.4),
        4,
        cloudy,
        resolution=0.42,
        flat=0.45,
    )

exec(compile((OUT / 'source' / 'polish_environment.py').read_text(), str(OUT / 'source' / 'polish_environment.py'), 'exec'), globals())

members = [root] + list(root.children_recursive)
bpy.ops.object.select_all(action="DESELECT")
for o in members:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(OUT / "cloud-world.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
print("CLOUD_WORLD_COMPLETE", len(members), "objects")
