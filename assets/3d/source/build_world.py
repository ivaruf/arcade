"""Cloud Nine, the building: a basement, a wing, a roof and a deck in the sky.

    /Applications/Blender.app/Contents/MacOS/Blender --background --python source/build_world.py

Writes four GLBs and touches nothing else:

    hall-patch.glb      the pieces of the main hall that had to change
    level-basement.glb  the mine under it
    wing-aquarium.glb   the water room off its west side
    deck-cloud.glb      the platform in the sky above it

`build_arcade.py` and `build_extras.py` are untouched and can be re-run in any
order. The hall still comes from the kit's `arcade-room.glb`; three of its
meshes are hidden at runtime and replaced by pieces from `hall-patch.glb`,
because a floor needs a hole in it for the lift, a wall needs an arch through
to the wing, and the roof needs a hole to fly out of. The list of what to hide
is in `cloudnine/js/room.js` next to the volumes, so the two stay together.

---------------------------------------------------------------------------
COORDINATES: this script authors in GAME space, not Blender space
---------------------------------------------------------------------------
The kit's own scripts author in Blender's Z-up metres and the game converts
when it reads them. That is fine for a fixed model kit and a bad idea here,
because every number below has to line up with a collision volume in
room.js — and the conversion is a mirror, which is exactly the kind of thing
you get backwards once and then chase for an hour.

So everything below is written the way the game sees it, and `bl()` does the
conversion in one place at the bottom of the call:

    blender.x = -game.x      game.x = -blender.x
    blender.y = -game.z      game.y =  blender.z
    blender.z =  game.y      game.z = -blender.y

    blender rotation.z = -game yaw

In game space: the CLOUD NINE sign is on the back wall at z = -7, the street
entrance is the gap at z = +7, the hall floor's top face is y = 0, and a
cabinet at yaw 0 faces +Z. The building then stacks:

    y =  9      cloud deck        open sky, reached only by flying
    y = 5.75    roof              walkable, with a skylight at the middle
    y =  0      hall  +  wing     the arcade you arrive in
    y = -3.8    basement          the mine, down the stairs
"""

import bpy
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
random.seed(90210)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------------------
# The plan, in game coordinates. room.js repeats these as collision volumes;
# if you move one, move both.
# ---------------------------------------------------------------------------
HALL = dict(x0=-9.0, x1=9.0, z0=-7.0, z1=7.0, wall=5.5, thick=0.22)
# The stairwell: a hole in the hall floor with one straight flight down it.
# BASE_Y is where it is because of the STAIRS and not the other way round —
# 5 m down over this run was a 40 degree ladder; 3.8 m is a staircase you can
# walk. The mine keeps 3.4 m of headroom, more than the 2.3 m cabinets need.
WELL = dict(x0=5.4, x1=8.6, z0=-6.7, z1=-0.3)
STAIR = dict(x0=5.9, x1=8.1, z_top=-0.6, z_bottom=-6.4, steps=16)
SKY_HOLE = dict(x0=-3.0, x1=3.0, z0=-3.0, z1=3.0)     # hole in the roof
ARCH = dict(z0=-2.5, z1=2.5, top=3.4)                 # opening in the west wall
ROOF_Y, ROOF_T = 5.5, 0.25                            # underside, thickness
BASE_Y = -3.8                                         # basement floor top
HEADROOM = -0.35 - BASE_Y                             # floor to the hall underside
WING = dict(x0=-21.0, x1=-8.89, z0=-6.0, z1=6.0, wall=5.0)
DECK = dict(x0=-8.0, x1=8.0, z0=-10.0, z1=-1.0, y=9.0)

# ---------------------------------------------------------------------------
# Materials. The kit's palette, unchanged, plus what a mine and a tank need.
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
wall = material("Indigo wall", (0.055, 0.065, 0.13))
floor_m = material("Blue charcoal floor", (0.035, 0.052, 0.075), 0.15)
black = material("Rubber and screen bezel", (0.007, 0.012, 0.021))
white = material("Warm ivory", (0.85, 0.86, 0.75))
cyan = material("Mint neon", (0.07, 0.85, 0.72), 0.2, 2)
pink = material("Coral neon", (0.95, 0.12, 0.32), 0.2, 2)
gold = material("Honey yellow", (0.98, 0.57, 0.06), 0.1, 0.6)
blue = material("Periwinkle", (0.22, 0.3, 0.95), 0.15, 1)
chrome = material("Brushed metal", (0.3, 0.38, 0.42), 0.8)

rock = material("Cut rock", (0.055, 0.048, 0.052), 0.0, 0.0, 0.85)
rock_lit = material("Cut rock lit", (0.085, 0.072, 0.066), 0.0, 0.0, 0.8)
ore = material("Ore seam", (0.98, 0.62, 0.12), 0.3, 1.4)
ore_dull = material("Ore in the cart", (0.72, 0.44, 0.10), 0.3, 0.22)
timber = material("Pit timber", (0.16, 0.10, 0.062), 0.0, 0.0, 0.75)
water = material("Tank water", (0.035, 0.30, 0.36), 0.1, 0.55, 0.2)
sand = material("Tank sand", (0.36, 0.33, 0.24), 0.0, 0.0, 0.8)
weed = material("Tank weed", (0.06, 0.30, 0.17), 0.0, 0.0, 0.6)
cloudy = material("Cloud", (0.88, 0.92, 0.98), 0.0, 0.25, 0.5)
haze = material("Sky haze", (0.16, 0.24, 0.42), 0.0, 0.35, 0.6)

# ---------------------------------------------------------------------------
# Builders. Everything takes GAME coordinates; bl() is the only conversion.
# ---------------------------------------------------------------------------

root = None


def bl(x, y, z):
    """Game position -> Blender position."""
    return (-x, -z, y)


def bl_size(sx, sy, sz):
    """Game extents -> Blender dimensions."""
    return (sx, sz, sy)


def finish(o, name, mat):
    o.name = name
    o.data.materials.append(mat)
    if root:
        o.parent = root
    return o


def box(name, pos, size, mat, bevel=0.02, yaw=0.0, tilt=0.0):
    """A box centred at game `pos` with game extents `size`."""
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


def slab(name, x0, x1, z0, z1, y, thickness, mat, bevel=0.0):
    """A horizontal plate spanning a game rectangle, `y` being its TOP face."""
    return box(
        name,
        ((x0 + x1) / 2, y - thickness / 2, (z0 + z1) / 2),
        (x1 - x0, thickness, z1 - z0),
        mat,
        bevel,
    )


def plate_with_hole(prefix, x0, x1, z0, z1, hole, y, thickness, mat):
    """A plate with a rectangular opening, as the four pieces around it."""
    hx0, hx1, hz0, hz1 = hole["x0"], hole["x1"], hole["z0"], hole["z1"]
    made = []
    if x0 < hx0:
        made.append(slab(f"{prefix} west", x0, hx0, z0, z1, y, thickness, mat))
    if hx1 < x1:
        made.append(slab(f"{prefix} east", hx1, x1, z0, z1, y, thickness, mat))
    if z0 < hz0:
        made.append(slab(f"{prefix} south", hx0, hx1, z0, hz0, y, thickness, mat))
    if hz1 < z1:
        made.append(slab(f"{prefix} north", hx0, hx1, hz1, z1, y, thickness, mat))
    return made


def cylinder(name, pos, r, depth, mat, axis="y"):
    rot = {"y": (0, 0, 0), "x": (0, math.pi / 2, 0), "z": (math.pi / 2, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=r, depth=depth, location=bl(*pos), rotation=rot)
    return finish(bpy.context.object, name, mat)


def sphere(name, pos, r, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=r, location=bl(*pos))
    o = finish(bpy.context.object, name, mat)
    o.scale = bl_size(*scale)
    for poly in o.data.polygons:
        poly.use_smooth = True
    return o


def text(name, body, pos, size, mat, yaw=0.0):
    """Wall lettering, standing up and facing +Z before yaw is applied."""
    c = bpy.data.curves.new(name, "FONT")
    c.body = body
    c.align_x = "CENTER"
    c.size = size
    c.extrude = 0.002
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


def export(name):
    members = [root] + list(root.children_recursive)
    bpy.ops.object.select_all(action="DESELECT")
    for o in members:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / f"{name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    print(f"  {name}.glb  {len(members)} objects")
    return len(members)


# ===========================================================================
# 1. HALL PATCH — the three surfaces of the kit's room that had to change
# ===========================================================================
start("Hall_patch")

# ---- floor, with the lift pit cut out of it ----
plate_with_hole("Hall floor", HALL["x0"], HALL["x1"], HALL["z0"], HALL["z1"], WELL, 0.0, 0.3, floor_m)

# The kit draws floor seams as thin chrome lines; ours stop at the pit rather
# than hanging over it, which is the whole reason the originals are hidden.
for x in (-8, -4, 0, 4, 8):
    if WELL["x0"] < x < WELL["x1"]:
        box("Floor seam", (x, 0.008, (HALL["z1"] + WELL["z1"]) / 2), (0.018, 0.008, HALL["z1"] - WELL["z1"]), chrome, 0)
        box("Floor seam", (x, 0.008, (HALL["z0"] + WELL["z0"]) / 2), (0.018, 0.008, WELL["z0"] - HALL["z0"]), chrome, 0)
    else:
        box("Floor seam", (x, 0.008, 0), (0.018, 0.008, 13.8), chrome, 0)
for z in (-6, -3, 0, 3, 6):
    if WELL["z0"] < z < WELL["z1"]:
        box("Floor seam", ((HALL["x0"] + WELL["x0"]) / 2 + 0.1, 0.008, z), (WELL["x0"] - HALL["x0"] - 0.2, 0.008, 0.018), chrome, 0)
        box("Floor seam", ((WELL["x1"] + HALL["x1"]) / 2, 0.008, z), (HALL["x1"] - WELL["x1"], 0.008, 0.018), chrome, 0)
    else:
        box("Floor seam", (0, 0.008, z), (17.8, 0.008, 0.018), chrome, 0)

# ---- west wall, rebuilt in three pieces so there is an arch through it ----
WX = HALL["x0"]  # -9
for z0, z1, tag in ((HALL["z0"], ARCH["z0"], "south"), (ARCH["z1"], HALL["z1"], "north")):
    box(f"Hall wall west {tag}", (WX, HALL["wall"] / 2, (z0 + z1) / 2), (HALL["thick"], HALL["wall"], z1 - z0), wall, 0)
box("Hall arch lintel", (WX, (ARCH["top"] + HALL["wall"]) / 2, 0), (HALL["thick"], HALL["wall"] - ARCH["top"], ARCH["z1"] - ARCH["z0"]), wall, 0)
# A lit reveal so the opening reads as a way through rather than a missing wall.
for z in (ARCH["z0"], ARCH["z1"]):
    box("Arch reveal", (WX, ARCH["top"] / 2, z), (0.26, ARCH["top"], 0.07), cyan, 0.01)
box("Arch reveal", (WX, ARCH["top"], 0), (0.26, 0.07, ARCH["z1"] - ARCH["z0"]), cyan, 0.01)
text("Arch lettering", "AQUARIUM", (WX + 0.16, ARCH["top"] + 0.42, 0), 0.30, white, yaw=math.pi / 2)

# The kit's side light strips run the length of this wall at three heights and
# would cross the opening, so those three are hidden too and replaced in halves.
for y in (0.28, 3.0, 5.1):
    tint = pink if y == 3.0 else cyan
    for z0, z1 in ((HALL["z0"] + 0.1, ARCH["z0"]), (ARCH["z1"], HALL["z1"] - 0.1)):
        box("Hall strip west", (WX + 0.16, y, (z0 + z1) / 2), (0.045, 0.055, z1 - z0), tint, 0.01)

# ---- roof, with the skylight cut out of it ----
plate_with_hole("Roof", HALL["x0"], HALL["x1"], HALL["z0"], HALL["z1"], SKY_HOLE, ROOF_Y + ROOF_T, ROOF_T, navy)
for x in (-6, 6):
    box("Ceiling light", (x, ROOF_Y - 0.02, 0), (0.18, 0.045, 11), cyan, 0.01)
for z in ((SKY_HOLE["z1"] + 5.6) / 2, (SKY_HOLE["z0"] - 5.6) / 2):
    box("Ceiling light", (0, ROOF_Y - 0.02, z), (0.18, 0.045, 5.6 - SKY_HOLE["z1"]), cyan, 0.01)

# A lit rim around the hole, from below and from above: this is the way up and
# it has to be legible from the floor of a dark room.
for side in ("x0", "x1"):
    box("Skylight rim", (SKY_HOLE[side], ROOF_Y - 0.04, 0), (0.1, 0.1, SKY_HOLE["z1"] - SKY_HOLE["z0"]), cyan, 0.01)
    box("Skylight kerb", (SKY_HOLE[side], ROOF_Y + ROOF_T + 0.09, 0), (0.16, 0.18, SKY_HOLE["z1"] - SKY_HOLE["z0"] + 0.3), navy)
for side in ("z0", "z1"):
    box("Skylight rim", (0, ROOF_Y - 0.04, SKY_HOLE[side]), (SKY_HOLE["x1"] - SKY_HOLE["x0"], 0.1, 0.1), cyan, 0.01)
    box("Skylight kerb", (0, ROOF_Y + ROOF_T + 0.09, SKY_HOLE[side]), (SKY_HOLE["x1"] - SKY_HOLE["x0"] + 0.3, 0.18, 0.16), navy)

# ---- the roof as a place, not just a lid ----
for x in (HALL["x0"] + 0.1, HALL["x1"] - 0.1):
    box("Parapet", (x, ROOF_Y + ROOF_T + 0.3, 0), (0.2, 0.6, HALL["z1"] - HALL["z0"]), navy)
for z in (HALL["z0"] + 0.1, HALL["z1"] - 0.1):
    box("Parapet", (0, ROOF_Y + ROOF_T + 0.3, z), (HALL["x1"] - HALL["x0"], 0.6, 0.2), navy)
box("Roof sign panel", (0, ROOF_Y + ROOF_T + 1.5, -6.2), (7.4, 1.5, 0.2), navy, 0.1)
text("Roof sign", "CLOUD NINE", (0, ROOF_Y + ROOF_T + 1.25, -6.08), 0.62, cyan)
for i, x in enumerate((-7.4, -6.2, 6.2, 7.4)):
    box("Roof vent", (x, ROOF_Y + ROOF_T + 0.35, 4.4 + (i % 2) * 1.4), (0.9, 0.7, 0.9), chrome, 0.04)

# ---- the stairs ----
#
# Stepped to look at, ramped to walk on: room.js gives the gopher a smooth
# incline while the eye gets treads. Per-step collision would turn climbing
# into a series of hops, because a 24 cm riser is taller than the tolerance
# that keeps a walker attached to the floor it is on.
rise = (0 - BASE_Y) / STAIR["steps"]
going = (STAIR["z_top"] - STAIR["z_bottom"]) / STAIR["steps"]
width = STAIR["x1"] - STAIR["x0"]
mid_x = (STAIR["x0"] + STAIR["x1"]) / 2

for i in range(STAIR["steps"]):
    y = -(i + 1) * rise
    z0 = STAIR["z_top"] - (i + 1) * going
    z1 = STAIR["z_top"] - i * going
    box("Stair tread", (mid_x, y - 0.12, (z0 + z1) / 2), (width, 0.24, going), floor_m, 0.015)
    # A lit nosing on every tread: the one thing that makes a dark stair read.
    box("Stair nosing", (mid_x, y + 0.008, z1 - 0.03), (width - 0.14, 0.014, 0.05), cyan, 0)
    for side in (STAIR["x0"] - 0.17, STAIR["x1"] + 0.17):
        box("Stair parapet", (side, y + 0.48, (z0 + z1) / 2), (0.26, 0.96, going), navy, 0.02)
        box("Parapet cap", (side, y + 0.99, (z0 + z1) / 2), (0.32, 0.06, going), chrome, 0.01)

# The opening's edge in the hall floor, and a newel either side of the top.
for x in (WELL["x0"], WELL["x1"]):
    box("Well kerb", (x, 0.05, (WELL["z0"] + WELL["z1"]) / 2), (0.16, 0.16, WELL["z1"] - WELL["z0"]), chrome, 0.02)
box("Well kerb", (mid_x, 0.05, WELL["z1"]), (WELL["x1"] - WELL["x0"], 0.16, 0.16), chrome, 0.02)
for side in (STAIR["x0"] - 0.17, STAIR["x1"] + 0.17):
    box("Newel", (side, 0.55, STAIR["z_top"] + 0.16), (0.32, 1.1, 0.32), navy, 0.03)
    box("Newel lamp", (side, 1.15, STAIR["z_top"] + 0.16), (0.24, 0.12, 0.24), cyan, 0.02)
text("Stair lettering", "LOWER LEVEL", (mid_x, 0.30, WELL["z1"] + 0.36), 0.19, white)

export("hall-patch")

# ===========================================================================
# 2. BASEMENT — the mine. Same footprint as the hall; its ceiling is the hall's
#    floor, which is why there is no ceiling slab here.
# ===========================================================================
start("Basement")
B = dict(x0=HALL["x0"], x1=HALL["x1"], z0=HALL["z0"], z1=HALL["z1"])

slab("Mine floor", B["x0"], B["x1"], B["z0"], B["z1"], BASE_Y, 0.4, rock)
for side, x in (("west", B["x0"]), ("east", B["x1"])):
    box(f"Mine wall {side}", (x, BASE_Y + HEADROOM / 2, 0), (0.3, HEADROOM, B["z1"] - B["z0"]), rock, 0)
for side, z in (("south", B["z0"]), ("north", B["z1"])):
    box(f"Mine wall {side}", (0, BASE_Y + HEADROOM / 2, z), (B["x1"] - B["x0"], HEADROOM, 0.3), rock, 0)

# Rough it up: boulders and cut faces along the walls so it is not a cellar.
for i in range(26):
    x = random.uniform(B["x0"] + 0.6, B["x1"] - 0.6)
    z = random.choice([random.uniform(B["z0"] + 0.4, B["z0"] + 1.6), random.uniform(B["z1"] - 1.6, B["z1"] - 0.4)])
    if random.random() < 0.5:
        x = random.choice([random.uniform(B["x0"] + 0.4, B["x0"] + 1.6), random.uniform(B["x1"] - 1.6, B["x1"] - 0.4)])
        z = random.uniform(B["z0"] + 0.6, B["z1"] - 0.6)
    s = random.uniform(0.5, 1.5)
    o = box("Rock face", (x, BASE_Y + s * 0.4, z), (s, s * 0.8, s), rock_lit if i % 3 else rock, 0.06)
    o.rotation_euler = (random.uniform(-0.2, 0.2), random.uniform(0, 3.1), random.uniform(-0.2, 0.2))

# Ore, which is the only bright thing down here and does the lighting work.
for i in range(22):
    wall_side = i % 4
    if wall_side == 0:
        p = (B["x0"] + 0.22, random.uniform(BASE_Y + 0.5, BASE_Y + HEADROOM - 0.6), random.uniform(B["z0"] + 1, B["z1"] - 1))
        s = (0.08, random.uniform(0.1, 0.3), random.uniform(0.2, 0.7))
    elif wall_side == 1:
        p = (B["x1"] - 0.22, random.uniform(BASE_Y + 0.5, BASE_Y + HEADROOM - 0.6), random.uniform(B["z0"] + 1, B["z1"] - 1))
        s = (0.08, random.uniform(0.1, 0.3), random.uniform(0.2, 0.7))
    elif wall_side == 2:
        p = (random.uniform(B["x0"] + 1, B["x1"] - 1), random.uniform(BASE_Y + 0.5, BASE_Y + HEADROOM - 0.6), B["z0"] + 0.22)
        s = (random.uniform(0.2, 0.7), random.uniform(0.1, 0.3), 0.08)
    else:
        p = (random.uniform(B["x0"] + 1, B["x1"] - 1), random.uniform(BASE_Y + 0.5, BASE_Y + HEADROOM - 0.6), B["z1"] - 0.22)
        s = (random.uniform(0.2, 0.7), random.uniform(0.1, 0.3), 0.08)
    box("Ore seam", p, s, ore, 0.02)

# Pit props holding the roof up, clear of the machines and the cage.
for x in (-5.6, -1.4, 2.8):
    for z in (-3.4, 2.4):
        box("Pit prop", (x, BASE_Y + HEADROOM / 2, z), (0.34, HEADROOM, 0.34), timber, 0.03)
        box("Prop cap", (x, BASE_Y + HEADROOM - 0.11, z), (0.9, 0.22, 0.5), timber, 0.03)

# Cart rails running the length of the room, and a cart parked on them.
for x in (-0.45, 0.45):
    box("Rail", (x, BASE_Y + 0.05, 1.0), (0.08, 0.1, 9.0), chrome, 0)
for i in range(14):
    box("Sleeper", (0, BASE_Y + 0.02, -3.2 + i * 0.66), (1.3, 0.06, 0.16), timber, 0)
CART = (0, BASE_Y + 0.52, 4.1)
box("Cart body", CART, (1.1, 0.78, 1.5), chrome, 0.04)
box("Cart lip", (CART[0], CART[1] + 0.42, CART[2]), (1.16, 0.08, 1.56), black, 0.02)
for i in range(6):
    sphere("Cart ore", (random.uniform(-0.3, 0.3), CART[1] + 0.42, CART[2] + random.uniform(-0.5, 0.5)), 0.16, ore_dull)
for dz in (-0.5, 0.5):
    cylinder("Cart wheel", (0, BASE_Y + 0.16, CART[2] + dz), 0.16, 1.16, chrome, axis="x")

# Lamps: warm, low, and few. A mine is dark and the ore should be what glows.
for x, z in ((-6.4, -5.4), (-6.4, 4.6), (6.4, 4.6), (0, -6.2)):
    box("Lamp bracket", (x, BASE_Y + HEADROOM - 0.8, z), (0.12, 0.5, 0.12), chrome, 0.02)
    sphere("Mine lamp", (x, BASE_Y + HEADROOM - 1.1, z), 0.17, gold)

text("Mine sign", "LOWER LEVEL", (0, BASE_Y + HEADROOM - 0.6, B["z0"] + 0.2), 0.46, white)
text("Mine sub", "M I N D   Y O U R   H E A D", (0, BASE_Y + HEADROOM - 1.05, B["z0"] + 0.2), 0.17, ore)
export("level-basement")

# ===========================================================================
# 3. AQUARIUM WING — fishtank and dam_break, built to be sat at together
# ===========================================================================
start("Wing_aquarium")
W = WING

slab("Wing floor", W["x0"], W["x1"], W["z0"], W["z1"], 0.0, 0.3, floor_m)
box("Wing wall west", (W["x0"], W["wall"] / 2, 0), (0.24, W["wall"], W["z1"] - W["z0"]), wall, 0)
for side, z in (("south", W["z0"]), ("north", W["z1"])):
    box(f"Wing wall {side}", ((W["x0"] + W["x1"]) / 2, W["wall"] / 2, z), (W["x1"] - W["x0"], W["wall"], 0.24), wall, 0)
slab("Wing ceiling", W["x0"], W["x1"], W["z0"], W["z1"], W["wall"] + 0.25, 0.25, navy)
for z in (-3.2, 0, 3.2):
    box("Wing ceiling light", ((W["x0"] + W["x1"]) / 2, W["wall"] - 0.02, z), (10.4, 0.05, 0.16), cyan, 0.01)

# The tank: the whole west wall is water, which is the room's light source and
# the reason to build the wing at all. Opaque on purpose — a translucent volume
# would need alpha sorting for no gain at this scale.
TANK = dict(x0=W["x0"] + 0.24, x1=W["x0"] + 1.9, z0=-4.6, z1=4.6, y0=0.5, y1=4.2)
box("Tank water", ((TANK["x0"] + TANK["x1"]) / 2, (TANK["y0"] + TANK["y1"]) / 2, 0),
    (TANK["x1"] - TANK["x0"], TANK["y1"] - TANK["y0"], TANK["z1"] - TANK["z0"]), water, 0.05)
box("Tank plinth", ((TANK["x0"] + TANK["x1"]) / 2, TANK["y0"] / 2, 0),
    (TANK["x1"] - TANK["x0"] + 0.3, TANK["y0"], TANK["z1"] - TANK["z0"] + 0.3), navy)
box("Tank sand", ((TANK["x0"] + TANK["x1"]) / 2, TANK["y0"] + 0.12, 0),
    (TANK["x1"] - TANK["x0"] - 0.06, 0.24, TANK["z1"] - TANK["z0"] - 0.06), sand, 0.02)
for y in (TANK["y0"], TANK["y1"]):
    box("Tank frame", ((TANK["x0"] + TANK["x1"]) / 2, y, 0), (TANK["x1"] - TANK["x0"] + 0.12, 0.12, TANK["z1"] - TANK["z0"] + 0.12), chrome, 0.02)
for z in (TANK["z0"], TANK["z1"]):
    box("Tank frame", ((TANK["x0"] + TANK["x1"]) / 2, (TANK["y0"] + TANK["y1"]) / 2, z), (TANK["x1"] - TANK["x0"] + 0.12, TANK["y1"] - TANK["y0"], 0.12), chrome, 0.02)
for i in range(16):
    z = random.uniform(TANK["z0"] + 0.4, TANK["z1"] - 0.4)
    h = random.uniform(0.7, 2.1)
    o = box("Tank weed", (random.uniform(TANK["x0"] + 0.3, TANK["x1"] - 0.3), TANK["y0"] + 0.2 + h / 2, z), (0.1, h, 0.16), weed, 0.03)
    o.rotation_euler = (0, random.uniform(-0.3, 0.3), random.uniform(-0.25, 0.25))
for i in range(20):
    sphere("Bubble", (random.uniform(TANK["x0"] + 0.3, TANK["x1"] - 0.3),
                      random.uniform(TANK["y0"] + 0.6, TANK["y1"] - 0.2),
                      random.uniform(TANK["z0"] + 0.5, TANK["z1"] - 0.5)), random.uniform(0.04, 0.09), cloudy)

# Stools in a row BEHIND where you stand to play, facing the machines on the
# south wall. This is the room where you take turns, so the seats are for the
# people whose turn it is not.
for i, x in enumerate((-11.9, -13.9, -16.6, -19.2)):
    z = -2.4
    cylinder("Stool post", (x, 0.3, z), 0.07, 0.6, chrome)
    cylinder("Stool foot", (x, 0.03, z), 0.26, 0.06, chrome)
    cylinder("Stool seat", (x, 0.63, z), 0.28, 0.1, [pink, cyan, gold, blue][i])
box("Player rail", (-15.5, 0.5, -1.7), (8.4, 0.09, 0.09), chrome, 0.02)

# The sign sits above the machines, where a shop sign goes.
box("Wing marquee", (-15.4, 4.0, W["z0"] + 0.22), (6.2, 1.0, 0.18), navy, 0.08)
text("Wing title", "TAKE TURNS", (-15.4, 3.8, W["z0"] + 0.12), 0.42, cyan)
text("Wing sub", "F O U R   S T O O L S ,   O N E   S C R E E N", (-15.4, 3.35, W["z0"] + 0.12), 0.15, white)
export("wing-aquarium")

# ===========================================================================
# 4. CLOUD DECK — swirls, in the sky, reachable only by flying
# ===========================================================================
start("Deck_cloud")
D = DECK

# The deck itself is a cloud with a floor on it.
slab("Deck floor", D["x0"], D["x1"], D["z0"], D["z1"], D["y"], 0.22, cloudy)
# A border rather than a fill: a slab of haze across the whole deck turns a
# cloud into a slate patio.
for dx, dz, w, d in ((0, 3.6, 13.4, 0.1), (0, -3.6, 13.4, 0.1), (6.7, 0, 0.1, 7.3), (-6.7, 0, 0.1, 7.3)):
    box("Deck inlay", ((D["x0"] + D["x1"]) / 2 + dx, D["y"] + 0.008, (D["z0"] + D["z1"]) / 2 + dz),
        (w, 0.012, d), haze, 0)
for i in range(46):
    a = (i / 46) * math.tau
    ex = (D["x1"] - D["x0"]) / 2 + 0.5
    ez = (D["z1"] - D["z0"]) / 2 + 0.5
    cx = (D["x0"] + D["x1"]) / 2 + math.cos(a) * ex * random.uniform(0.86, 1.0)
    cz = (D["z0"] + D["z1"]) / 2 + math.sin(a) * ez * random.uniform(0.86, 1.0)
    r = random.uniform(0.5, 1.15)
    sphere("Deck puff", (cx, D["y"] - random.uniform(0.15, 0.5), cz), r, cloudy, scale=(1.3, 0.6, 1.3))

# A low rail so the edge reads as an edge; you can still fly off it.
for x in (D["x0"] + 0.2, D["x1"] - 0.2):
    box("Deck rail", (x, D["y"] + 0.34, (D["z0"] + D["z1"]) / 2), (0.08, 0.06, D["z1"] - D["z0"] - 0.4), cyan, 0.01)
    for i in range(9):
        z = D["z0"] + 0.4 + i * ((D["z1"] - D["z0"] - 0.8) / 8)
        box("Deck post", (x, D["y"] + 0.17, z), (0.07, 0.34, 0.07), cloudy, 0.02)
for z in (D["z0"] + 0.2, D["z1"] - 0.2):
    box("Deck rail", ((D["x0"] + D["x1"]) / 2, D["y"] + 0.34, z), (D["x1"] - D["x0"] - 0.4, 0.06, 0.08), cyan, 0.01)
    for i in range(9):
        x = D["x0"] + 0.4 + i * ((D["x1"] - D["x0"] - 0.8) / 8)
        box("Deck post", (x, D["y"] + 0.17, z), (0.07, 0.34, 0.07), cloudy, 0.02)

# Somewhere to sit and do nothing, which is the point of the room.
for i, (bx, bz) in enumerate(((-5.4, -7.4), (5.4, -7.4), (0, -2.4))):
    box("Deck bench", (bx, D["y"] + 0.28, bz), (2.0, 0.16, 0.7), cloudy, 0.06)
    for dx in (-0.8, 0.8):
        box("Bench leg", (bx + dx, D["y"] + 0.13, bz), (0.12, 0.3, 0.6), haze, 0.03)

# A ring of light on the landing side, so the deck is findable from below.
LANDING = (0, D["y"] + 0.01, -2.0)
for i in range(30):
    a = (i / 30) * math.tau
    box("Landing ring", (LANDING[0] + math.cos(a) * 1.9, LANDING[1], LANDING[2] + math.sin(a) * 1.9), (0.2, 0.014, 0.2), cyan, 0)
text("Deck sign", "C L O U D   N I N E", (0, D["y"] + 1.5, D["z0"] + 0.4), 0.44, cyan)
text("Deck sub", "sit a while", (0, D["y"] + 1.0, D["z0"] + 0.4), 0.22, white)

# Loose clouds drifting around the deck; the runtime bobs them.
for i in range(16):
    a = random.uniform(0, math.tau)
    d = random.uniform(9, 17)
    sphere("Drifting cloud", (math.cos(a) * d, D["y"] + random.uniform(-3.5, 3.0), (D["z0"] + D["z1"]) / 2 + math.sin(a) * d),
           random.uniform(1.1, 2.4), cloudy, scale=(1.5, 0.55, 1.2))
export("deck-cloud")

print("ARCADE_WORLD_COMPLETE")
