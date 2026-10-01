"""Lobbots proving ground: a slice of the game's own hill, floating.

Run with Blender --background --python assets/3d/source/lobbots_island.py.
Exported separately from cloud-world so the established islands stay intact.

Game coordinates match room.js: deck centre (-19, .5, 18), twelve metres
square, and the walking surface is exactly y = .5 everywhere on it — every
prop that stands up off it has a blocker in room.js FURNITURE, and every
decal on it is a few millimetres thick so nothing trips the gopher.

WHAT IT IS MEANT TO LOOK LIKE
  The island is the game. Its sides are the in-game strata — deep, body and
  lit bands with the rust seam, under the pale crust the game draws along
  every hill — and the rear of the deck rises into a berm with a crater
  bitten out of it, the silhouette a Lobbots round is fought on. Things the
  game's ground could turn up stick out of the walls: a dud shell nose-first,
  a pipe, the corner of a crate. Clods that broke off hang underneath.

  The two walkers are the in-game walkers, not a family resemblance. Their
  hull plates are the polygons js/render/mech-draw.js bakeBody() paints, in
  the same field-px coordinates, extruded into slabs at different depths, so
  side-on they are the sprite outline for outline: enamel shell in the
  pilot's colour, ceramic roof bevel, hazard-striped skirt over armour
  segments, rear cooling module, exhaust stack, sensor mast, ammo drum, hip
  housings, the visor under its hazard-yellow brow, and the shoulder gun with
  its heat shroud and muzzle brake. The legs are the game's: THIGH 11, SHIN
  12, hips at ±11, feet at ±FOOT_W/2, the knee solved by the same two-bone IK
  and bent backwards like a bird's. Colours are Ember and Cobalt, the first
  two seats of the game's PALETTE.

  Around them: a nuke on a cradle, a rack of the arsenal's shells, ammo
  crates, a wreck that has just cooked off (the game's death blast), a wind
  sock, scorch craters, and the dotted trail of a shot still hanging in the
  air from Cobalt's muzzle to the crater it made — the game's shot memory.

Everything is joined by material before export, so the island is a couple of
dozen draw calls however many pieces it was built from.
"""
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent.parent
rng = random.Random(1990)  # Tank Wars' year; the island is the same every build

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.metaballs):
    for item in list(block):
        block.remove(item)


def point(x, y, z):
    """Game (x, y up, z) to Blender. The same mapping as every island here."""
    return Vector((-x, -z, y))


# ---------------------------------------------------------------------------
# Materials, from the game's own palette (ARCHITECTURE.md §12, mech-draw.js)
# ---------------------------------------------------------------------------

def linear(hex_):
    """sRGB hex to the linear floats Blender's base colour wants."""
    hex_ = hex_.lstrip('#')
    out = []
    for i in range(0, 6, 2):
        c = int(hex_[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def shade(hex_, k):
    """mech-draw.js shade(): toward white for k > 0, toward black for k < 0."""
    hex_ = hex_.lstrip('#')
    rgb = [int(hex_[i:i + 2], 16) for i in range(0, 6, 2)]
    if k >= 0:
        rgb = [round(c + (255 - c) * k) for c in rgb]
    else:
        rgb = [round(c * (1 + k)) for c in rgb]
    return '#' + ''.join(f'{c:02x}' for c in rgb)


MATS = {}


def mat(hex_, metal=0.0, rough=0.55, emit=0.0, name=None):
    key = (hex_, metal, rough, emit)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name or f'Lobbots {hex_}')
    rgb = linear(hex_)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = emit
    MATS[key] = m
    return m


OUTLINE = mat('#14171d', 0.3, 0.6, name='Lobbots outline graphite')
FRAME = mat('#33475a', 0.55, 0.45, name='Lobbots frame dark metal')
CERAMIC = mat('#b9c8d4', 0.15, 0.4, name='Lobbots ceramic')
SKIRT = mat('#34485c', 0.4, 0.5, name='Lobbots skirt')
PLATE = mat('#15181e', 0.3, 0.6, name='Lobbots plate')
HAZARD = mat('#ffd23f', 0.1, 0.5, name='Lobbots hazard yellow')
ARMOUR_A = mat('#a2b4c2', 0.35, 0.45, name='Lobbots armour light')
ARMOUR_B = mat('#7f93a5', 0.35, 0.45, name='Lobbots armour dark')
LEG = mat('#3d4552', 0.6, 0.45, name='Lobbots leg steel')
LEG_HI = mat('#8a99a8', 0.6, 0.4, name='Lobbots leg highlight')
JOINT = mat('#5b6474', 0.7, 0.35, name='Lobbots joint')
TUBE = mat('#9cafc1', 0.75, 0.3, name='Lobbots barrel steel')
SHROUD = mat('#2c3d50', 0.5, 0.5, name='Lobbots heat shroud')
BRAKE = mat('#6d849b', 0.7, 0.35, name='Lobbots muzzle brake')
BRASS = mat('#c9a85a', 0.85, 0.3, name='Lobbots shell brass')
GLASS = mat('#a3e7f5', 0.0, 0.1, 0.9, name='Lobbots visor glass')
LAMP = mat('#fff3c4', 0.0, 0.2, 1.2, name='Lobbots headlamp')
CHEEK = mat('#ff6b5a', 0.0, 0.3, 1.5, name='Lobbots cheek sensor')
BEACON = mat('#a7d9e8', 0.0, 0.2, 3.0, name='Lobbots beacon')
IVORY = mat('#d8d4c4', 0.1, 0.6, name='Lobbots deck paint')

# Terrain, as terrain-draw.js shades it.
DEEP = mat('#25242a', 0.0, 0.9, name='Lobbots strata deep')
BODY = mat('#3b3a42', 0.0, 0.9, name='Lobbots strata body')
BODY_LIT = mat('#4e4b52', 0.0, 0.85, name='Lobbots strata lit')
CRUST = mat('#8b8474', 0.0, 0.85, name='Lobbots crust')
CRUST_LINE = mat('#a79f8a', 0.0, 0.8, name='Lobbots crust line')
RUST = mat('#6e4a3a', 0.0, 0.85, name='Lobbots rust seam')
SCORCH = mat('#1a1716', 0.0, 0.95, name='Lobbots scorch')
STEEL_PAD = mat('#3a414d', 0.6, 0.5, name='Lobbots test pad')
EMBER = mat('#ff7a3a', 0.0, 0.4, 2.2, name='Lobbots ember glow')
CHAR = mat('#2a2522', 0.2, 0.8, name='Lobbots char')
OLIVE = mat('#5f6b38', 0.3, 0.55, name='Lobbots nuke olive')
RED = mat('#d8473b', 0.2, 0.45, name='Lobbots warhead red')
WHITE = mat('#e9eef2', 0.1, 0.45, name='Lobbots missile white')
CRATE = mat('#6a5a3e', 0.0, 0.8, name='Lobbots crate wood')
CLOUD = mat('#d9e6fa', 0.0, 0.9, name='Lobbots cloud')

# The game's PALETTE, first two seats.
TEAMS = {'Ember': '#e78d89', 'Cobalt': '#86b4ef'}


# ---------------------------------------------------------------------------
# Geometry helpers. Everything is built from raw vertices in game space, so
# any orientation is just arithmetic and nothing depends on operator state.
# ---------------------------------------------------------------------------

def mesh_obj(name, verts, faces, material, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([point(*v) for v in verts], [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = smooth
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    me.materials.append(material)
    return obj


def slab(name, outline, w0, w1, frame, material):
    """
    A polygon in a local (x, y) plane extruded from depth w0 to w1. `frame`
    turns local (x, y, w) into game space; that is how a 2D sprite plate
    becomes a 3D slab.
    """
    n = len(outline)
    verts = [frame(x, y, w0) for x, y in outline] + [frame(x, y, w1) for x, y in outline]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_obj(name, verts, faces, material)


def box(name, centre, size, material, yaw=0.0, bevel=0.0):
    """Axis box in game space, optionally turned about y."""
    cx, cy, cz = centre
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    c, s = math.cos(yaw), math.sin(yaw)
    verts = []
    for dy in (-hy, hy):
        for dx, dz in ((-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz)):
            verts.append((cx + dx * c + dz * s, cy + dy, cz - dx * s + dz * c))
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    obj = mesh_obj(name, verts, faces, material)
    if bevel:
        mod = obj.modifiers.new('Machined edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return obj


def tube(name, a, b, r0, material, r1=None, sides=12, smooth=True):
    """A (possibly tapered) cylinder between two game-space points."""
    r1 = r0 if r1 is None else r1
    A, B = Vector(a), Vector(b)
    axis = (B - A)
    if axis.length < 1e-6:
        axis = Vector((0, 1, 0))
    axis.normalize()
    ref = Vector((0, 1, 0)) if abs(axis.y) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(ref).normalized()
    v = axis.cross(u).normalized()
    verts = []
    for P, r in ((A, r0), (B, r1)):
        for i in range(sides):
            t = i / sides * math.tau
            q = P + (u * math.cos(t) + v * math.sin(t)) * r
            verts.append(tuple(q))
    faces = [list(range(sides))[::-1], list(range(sides, 2 * sides))]
    faces += [[i, (i + 1) % sides, sides + (i + 1) % sides, sides + i] for i in range(sides)]
    return mesh_obj(name, verts, faces, material, smooth)


def ball(name, centre, radius, material, squash=(1, 1, 1), subdiv=1, jitter=0.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        k = 1 + (rng.uniform(-jitter, jitter) if jitter else 0)
        v.co = Vector((v.co.x * squash[0] * k, v.co.y * squash[1] * k, v.co.z * squash[2] * k))
    verts = [(centre[0] + v.co.x, centre[1] + v.co.y, centre[2] + v.co.z) for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return mesh_obj(name, verts, faces, material, smooth=not jitter)


def disc(name, centre, radius, y, material, sides=20, inner=0.0):
    """A flat disc or ring lying on the deck at height y."""
    cx, cz = centre
    if inner:
        verts = []
        for i in range(sides):
            t = i / sides * math.tau
            verts.append((cx + math.cos(t) * radius, y, cz + math.sin(t) * radius))
            verts.append((cx + math.cos(t) * inner, y, cz + math.sin(t) * inner))
        faces = [[2 * i, 2 * ((i + 1) % sides), 2 * ((i + 1) % sides) + 1, 2 * i + 1] for i in range(sides)]
    else:
        verts = [(cx + math.cos(i / sides * math.tau) * radius, y, cz + math.sin(i / sides * math.tau) * radius)
                 for i in range(sides)]
        faces = [list(range(sides))]
    return mesh_obj(name, verts, faces, material)


# ---------------------------------------------------------------------------
# The walker. Local units are the game's field px (mech-draw.js), y down,
# origin at the body centre, facing +x. One field px is S metres here.
# ---------------------------------------------------------------------------

S = 0.048
BODY_LIFT = 26     # config.js: body centre above the feet
HIP_X, HIP_Y = 11, 9
THIGH, SHIN = 11, 12
FOOT_W = 44
BARREL_LEN = 34


def walker(label, hex_, feet, facing, angle_deg):
    """
    Stand one walker with its feet at `feet` (game coords), facing the game
    direction `facing` (a unit vector in x/z), barrel at `angle_deg` above
    the horizon. Returns the muzzle in game coords, for the shot trail.
    """
    fx, fz = facing
    lx, lz = -fz, fx            # the near side: where the gun, drum and panel are
    ox, oy, oz = feet

    def frame(x, y, w):
        f = x * S
        up = (BODY_LIFT - y) * S
        return (ox + fx * f + lx * w, oy + up, oz + fz * f + lz * w)

    team = mat(hex_, 0.25, 0.4, name=f'Lobbots {label} enamel')
    team_light = mat(shade(hex_, 0.3), 0.25, 0.4, name=f'Lobbots {label} panel')
    team_dark = mat(shade(hex_, -0.42), 0.25, 0.5, name=f'Lobbots {label} lower facet')
    team_deep = mat(shade(hex_, -0.55), 0.25, 0.5, name=f'Lobbots {label} decal')
    n = f'{label} walker'

    # Hull, back to front in depth: every plate is a little proud of the one
    # under it, so the edges read as folds. The sprite's fat dark outline is
    # NOT a plate here — extruded it is a slab sitting a pixel outside all the
    # others and it swallowed the whole front. In the round, the seams between
    # plates do what the outline did on a flat sprite.
    slab(f'{n} cooling module', [(-25, -14), (-21, -19), (-15, -18), (-15, 9), (-23, 7)],
         -0.56, 0.56, frame, FRAME)
    for i in range(6):
        y = -12 + i * 2.5
        for side in (-1, 1):
            slab(f'{n} cooling fin', [(-23.5, y), (-17, y), (-17, y + 1.3), (-23.5, y + 1.3)],
                 side * 0.565, side * 0.6, frame, OUTLINE)
    slab(f'{n} frame', [(-20, -11), (-13, -17), (12, -16), (22, -8), (20, 7), (12, 12), (-16, 10), (-22, 3)],
         -0.58, 0.58, frame, FRAME)
    slab(f'{n} enamel shell', [(-19, -10), (-12, -16), (11, -15), (20, -8), (17, 1), (-16, 2)],
         -0.62, 0.62, frame, team)
    slab(f'{n} roof bevel', [(-12, -16), (11, -15), (14, -12.5), (-10, -13.4)], -0.635, 0.635, frame, CERAMIC)
    slab(f'{n} lower facet', [(-16, 2), (17, 1), (18.6, -3.4), (-17.6, -2.2)], -0.63, 0.63, frame, team_dark)
    slab(f'{n} roof cap', [(-12, -17), (-9, -21), (7, -21), (12, -17)], -0.45, 0.45, frame, CERAMIC)
    slab(f'{n} roof rail', [(-8, -21.6), (6, -21.6), (6, -20), (-8, -20)], -0.3, 0.3, frame, team)

    # Hazard skirt: the dark band, the stripes leaning the way the sprite's
    # lean, and the five armour segments under them.
    slab(f'{n} skirt', [(-15, 3), (17, 2), (15, 8), (9, 11), (-13, 8)], -0.57, 0.57, frame, SKIRT)
    slab(f'{n} stripe band', [(-14, 3.6), (16, 2.7), (14.6, 6.4), (-13.4, 6.6)], -0.6, 0.6, frame, PLATE)
    for x in [-13.6 + i * 3.4 for i in range(9)]:
        slab(f'{n} hazard stripe', [(x, 6.4), (x + 1.7, 6.4), (x + 4.0, 3.2), (x + 2.3, 3.2)],
             -0.615, 0.615, frame, HAZARD)
    for i in range(5):
        x = -12.5 + i * 5.6
        slab(f'{n} armour segment', [(x, 6.8), (x + 4.8, 6.6), (x + 4.2, 9.6), (x + 0.4, 9.6)],
             -0.6, 0.6, frame, ARMOUR_A if i % 2 == 0 else ARMOUR_B)

    # The pilot's colour twice over: the side panel and its chevron decals,
    # on the near side where the sprite shows them.
    slab(f'{n} side panel', [(-17, -9), (-11, -14), (-3, -13), (1, -7), (-4, -0.5), (-16, 0)],
         0.6, 0.66, frame, team_light)
    for i in range(2):
        ox_ = -13 + i * 3.2
        slab(f'{n} chevron', [(ox_, -3), (ox_ + 1.6, -7), (ox_ + 3, -7), (ox_ + 1.4, -3)], 0.66, 0.672, frame, team_deep)

    # The face: dark optical cluster, glass, and the hazard brow that tells a
    # player across the field which way this one is looking.
    # Side visors stand proud of the enamel (the sprite paints them over it).
    slab(f'{n} optics', [(3, -13), (15, -12), (18, -9), (15, -5), (4, -6)], -0.665, 0.665, frame, PLATE)
    slab(f'{n} visor glass', [(5, -11), (14, -10.5), (15, -9), (13, -7), (5, -7.5)], -0.68, 0.68, frame, GLASS)
    slab(f'{n} brow', [(3.4, -13.6), (15.4, -12.6), (16.4, -11.6), (4, -12.4)], -0.69, 0.69, frame, HAZARD)
    # The sprite is side-on and has no front; a walker in the round needs
    # one. The visor wraps onto the front slope of the shell — (11,-15) to
    # (20,-8) in sprite px — as a glass band under a hazard brow, so it looks
    # where it fires from every side.
    sx0, sy0, sx1, sy1 = 12, -16, 22, -8   # the frame's front slope
    ln = math.hypot(sx1 - sx0, sy1 - sy0)
    tx, ty = (sx1 - sx0) / ln, (sy1 - sy0) / ln
    nx_, ny_ = ty, -tx           # outward (up and forward) in y-down space

    def on_slope(t, out):
        return (sx0 + tx * ln * t + nx_ * out, sy0 + ty * ln * t + ny_ * out)

    slab(f'{n} face plate', [on_slope(0.18, 0), on_slope(0.92, 0), on_slope(0.92, 1.0), on_slope(0.18, 1.0)],
         -0.52, 0.52, frame, PLATE)
    slab(f'{n} face glass', [on_slope(0.36, 0.6), on_slope(0.86, 0.6), on_slope(0.86, 1.25), on_slope(0.36, 1.25)],
         -0.44, 0.44, frame, GLASS)
    slab(f'{n} face brow', [on_slope(0.2, 0.6), on_slope(0.32, 0.6), on_slope(0.32, 1.45), on_slope(0.2, 1.45)],
         -0.5, 0.5, frame, HAZARD)
    slab(f'{n} headlamp housing', [(20.6, -1.2), (22.4, -1.2), (22.0, 2.2), (20.2, 2.2)], -0.2, 0.2, frame, OUTLINE)
    slab(f'{n} headlamp', [(21.4, -0.5), (22.7, -0.5), (22.4, 1.4), (21.2, 1.4)], -0.13, 0.13, frame, LAMP)
    slab(f'{n} cheek sensor', [(16.6, -4.6), (17.8, -4.6), (17.8, -3.4), (16.6, -3.4)], 0.5, 0.53, frame, CHEEK)

    # Exhaust stack behind the hull, cap, and a band in the pilot's colour.
    slab(f'{n} exhaust stack', [(-22.6, -29), (-16.4, -29), (-16.4, -10), (-22.6, -10)], -0.42, -0.06, frame, FRAME)
    slab(f'{n} stack cap', [(-23.8, -31.6), (-15.2, -31.6), (-15.2, -29.4), (-23.8, -29.4)], -0.47, -0.01, frame, BRAKE)
    slab(f'{n} stack band', [(-22.7, -25), (-16.3, -25), (-16.3, -23.2), (-22.7, -23.2)], -0.43, -0.05, frame, team)

    # Sensor mast with its cross-arm and the beacon.
    tube(f'{n} mast', frame(-7, -21, 0.2), frame(-11, -36.4, 0.2), 0.03, CERAMIC, sides=8)
    tube(f'{n} cross-arm', frame(-13.4, -30, 0.2), frame(-7.6, -31.4, 0.2), 0.02, CERAMIC, sides=6)
    ball(f'{n} beacon', frame(-11, -37, 0.2), 0.07, BEACON)

    # Ammo drum on the near side over the cooling module, six brass bases.
    drum_c = (-19, -2)
    tube(f'{n} ammo drum', frame(*drum_c, 0.56), frame(*drum_c, 0.78), 4.9 * S, ARMOUR_A, sides=20)
    tube(f'{n} drum face', frame(*drum_c, 0.78), frame(*drum_c, 0.8), 3.5 * S, FRAME, sides=20)
    for i in range(6):
        a = i / 6 * math.tau + 0.3
        sx, sy = drum_c[0] + math.cos(a) * 2.2, drum_c[1] + math.sin(a) * 2.2
        tube(f'{n} drum round', frame(sx, sy, 0.79), frame(sx, sy, 0.815), 0.75 * S, BRASS, sides=8)

    # Legs. The hip housings, then two-bone IK with the knee bent backwards
    # (mech-draw.js solveKnee, facing right). Front leg on the near side,
    # back leg on the far side, so from the front it straddles.
    for hx, side in ((-HIP_X, -1), (HIP_X, 1)):
        w = side * 0.34
        hy = HIP_Y
        for r, m_, d in ((3.7, OUTLINE, 0.0), (3.1, JOINT, 0.02), (1.4, LEG_HI, 0.04)):
            tube(f'{n} hip housing', frame(hx, hy, w - 0.2 - d), frame(hx, hy, w + 0.2 + d), r * S, m_, sides=16)
        foot_x = hx * 2  # feet at ±FOOT_W/2 = ±22, hips at ±11
        foot_y = BODY_LIFT
        dx, dy = foot_x - hx, foot_y - hy
        d = math.hypot(dx, dy)
        a_ = (THIGH ** 2 - SHIN ** 2 + d * d) / (2 * d)
        h_ = math.sqrt(max(0.0, THIGH ** 2 - a_ * a_))
        bx, by = hx + dx / d * a_, hy + dy / d * a_
        kx, ky = bx - (dy / d) * h_, by + (dx / d) * h_   # facingRight: s = -1
        tube(f'{n} thigh', frame(hx, hy, w), frame(kx, ky, w), 2.9 * S, LEG, r1=2.2 * S, sides=10)
        tube(f'{n} thigh plate', frame(hx + 0.4, hy - 0.6, w + 0.14), frame(kx + 0.4, ky - 0.6, w + 0.14),
             1.2 * S, team, sides=8)
        tube(f'{n} shin', frame(kx, ky, w), frame(foot_x, foot_y - 2.5, w), 1.9 * S, LEG, r1=1.5 * S, sides=10)
        tube(f'{n} piston', frame(kx + 1.6, ky + 0.8, w + 0.12), frame(foot_x + 1.6, foot_y - 4, w + 0.12),
             0.55 * S, LEG_HI, sides=8)
        tube(f'{n} piston sleeve', frame(kx + 1.6, ky + 0.8, w + 0.12), frame(kx + 2.4, ky + 5, w + 0.12),
             0.9 * S, JOINT, sides=8)
        ball(f'{n} knee', frame(kx, ky, w), 2.6 * S, JOINT)
        # Foot: a pad, three claws forward, a heel spur back.
        box(f'{n} foot pad', frame(foot_x, foot_y - 1.2, w), (0.5, 0.12, 0.42), LEG, bevel=0.02,
            yaw=math.atan2(-fz, fx))
        for cw in (-0.14, 0.0, 0.14):
            tip = frame(foot_x + 9, foot_y - 0.3, w + cw)
            root = frame(foot_x + 3.5, foot_y - 1.4, w + cw)
            tube(f'{n} claw', root, tip, 0.05, OUTLINE, r1=0.012, sides=6, smooth=False)
        tube(f'{n} heel spur', frame(foot_x - 3.5, foot_y - 1.4, w), frame(foot_x - 8, foot_y - 0.2, w),
             0.045, OUTLINE, r1=0.012, sides=6, smooth=False)

    # The shoulder gun: hub rings on the near side, the barrel at the angle,
    # shroud, rail with the pilot's inlay, and the slotted muzzle brake whose
    # face is the muzzle.
    hub_w = 0.74
    for r, m_, d in ((7.4, OUTLINE, 0.0), (6.4, CERAMIC, 0.03), (5.1, FRAME, 0.06), (3.7, PLATE, 0.09), (2.0, TUBE, 0.12)):
        tube(f'{n} gun hub', frame(0, 0, hub_w - 0.12), frame(0, 0, hub_w + d), r * S, m_, sides=20)
    rad = math.radians(angle_deg)
    bxu, byu = math.cos(rad), -math.sin(rad)

    def barrel_pt(t, off=0.0):
        """t px down the barrel from the hub, `off` px toward its top side.
        The axis in y-down sprite space is (cos, -sin); its upward normal is
        (-sin, -cos)."""
        return (bxu * t - math.sin(rad) * off, byu * t - math.cos(rad) * off)

    bw = hub_w - 0.04
    tube(f'{n} barrel', frame(*barrel_pt(2), bw), frame(*barrel_pt(BARREL_LEN - 6), bw), 3.1 * S, TUBE, sides=14)
    tube(f'{n} heat shroud', frame(*barrel_pt(4), bw), frame(*barrel_pt(13), bw), 3.7 * S, SHROUD, sides=14)
    tube(f'{n} rail', frame(*barrel_pt(13, 3.5), bw), frame(*barrel_pt(BARREL_LEN - 6, 3.5), bw), 0.8 * S, team, sides=6)
    tube(f'{n} muzzle brake', frame(*barrel_pt(BARREL_LEN - 6.6), bw), frame(*barrel_pt(BARREL_LEN), bw),
         4.6 * S, BRAKE, sides=8, smooth=False)
    tube(f'{n} muzzle bore', frame(*barrel_pt(BARREL_LEN - 0.4), bw), frame(*barrel_pt(BARREL_LEN + 0.05), bw),
         2.2 * S, OUTLINE, sides=12)
    for t in (BARREL_LEN - 4.8, BARREL_LEN - 2.4):
        tube(f'{n} brake slot', frame(*barrel_pt(t, -4.7), bw), frame(*barrel_pt(t, 4.7), bw), 0.55 * S, OUTLINE, sides=6)
    return frame(*barrel_pt(BARREL_LEN), bw)


# ---------------------------------------------------------------------------
# The ground
# ---------------------------------------------------------------------------

X0, X1, Z0, Z1, DECK = -25.0, -13.0, 12.0, 24.0, 0.5
CX, CZ = (X0 + X1) / 2, (Z0 + Z1) / 2


def band(name, y0, y1, inset, material):
    """A full-width strata band under the deck: the island's top edge."""
    return box(name, (CX, (y0 + y1) / 2, CZ), (X1 - X0 - 2 * inset, y1 - y0, Z1 - Z0 - 2 * inset), material)


# Crust on top (the walking surface), then the strata, flush with the deck
# edge so a player standing at the lip looks down a clean cut face.
band('Proving ground crust', DECK - 0.1, DECK, 0, CRUST)
band('Proving ground crust line', DECK - 0.16, DECK - 0.1, 0, CRUST_LINE)
band('Proving ground strata lit', DECK - 0.5, DECK - 0.16, 0.01, BODY_LIT)
band('Proving ground rust seam', DECK - 0.62, DECK - 0.5, 0.02, RUST)
band('Proving ground strata body', DECK - 1.2, DECK - 0.62, 0.03, BODY)


def layer(name, y0, y1, half, material, wobble):
    """One irregular strata layer under the cut: a rounded square, roughened."""
    pts = []
    n = 24
    for i in range(n):
        t = i / n * math.tau
        # Superellipse: square at the top layers, rounder further down.
        c, s = math.cos(t), math.sin(t)
        e = 0.35
        x = math.copysign(abs(c) ** e, c) * half
        z = math.copysign(abs(s) ** e, s) * half
        k = 1 + rng.uniform(-wobble, wobble)
        pts.append((CX + x * k, CZ + z * k))
    verts = [(x, y1, z) for x, z in pts] + [(x, y0, z) for x, z in pts]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_obj(name, verts, faces, material)


y = DECK - 1.2
half = 5.95
cycle = [DEEP, BODY, BODY_LIT, BODY, RUST, DEEP, BODY_LIT, BODY]
for i, m_ in enumerate(cycle):
    th = 0.45 if m_ is RUST else rng.uniform(0.45, 0.75)
    layer('Proving ground strata', y - th, y, half, m_, 0.025 + i * 0.01)
    y -= th
    half *= 0.86 if i < 3 else 0.8
# The bottom comes to a ragged point.
tip = (CX + 0.6, y - 2.2, CZ - 0.4)
ring = []
for i in range(10):
    t = i / 10 * math.tau
    r = half * rng.uniform(0.8, 1.1)
    ring.append((CX + math.cos(t) * r, y, CZ + math.sin(t) * r))
mesh_obj('Proving ground keel', ring + [tip], [list(range(10))] + [[i, (i + 1) % 10, 10] for i in range(10)], DEEP)

# Things the ground turned up, sticking out of the walls you see on the way
# in (north face z = Z0, east face x = X1).
tube('Dud shell casing', (-17.2, -0.55, Z0 + 0.5), (-17.0, -0.85, Z0 - 0.55), 0.17, BRASS, sides=14)
tube('Dud shell nose', (-17.0, -0.85, Z0 - 0.55), (-16.95, -0.95, Z0 - 0.85), 0.17, OLIVE, r1=0.03, sides=14)
tube('Dud shell band', (-17.05, -0.8, Z0 - 0.4), (-17.03, -0.82, Z0 - 0.48), 0.175, HAZARD, sides=14)
tube('Old pipe', (X1 + 0.4, -0.25, 15.2), (X1 - 0.5, -0.25, 15.2), 0.13, RUST, sides=12)
tube('Old pipe flange', (X1 - 0.42, -0.25, 15.2), (X1 - 0.5, -0.25, 15.2), 0.2, LEG, sides=12)
box('Buried crate corner', (X1 + 0.1, -0.85, 20.6), (0.7, 0.55, 0.7), CRATE, yaw=0.6)
box('Buried crate band', (X1 + 0.1, -0.85, 20.6), (0.72, 0.1, 0.72), HAZARD, yaw=0.6)
box('Fossil plate', (-21.0, -1.45, Z0 - 0.02), (0.9, 0.35, 0.05), CRUST_LINE)
for i in range(4):
    box('Fossil rib', (-21.35 + i * 0.22, -1.45, Z0 - 0.05), (0.05, 0.28, 0.03), BODY_LIT)

# Clods that broke off, hanging below.
for i in range(6):
    a = i / 6 * math.tau + 0.4
    r = rng.uniform(6.8, 8.5)
    ball('Floating clod', (CX + math.cos(a) * r, rng.uniform(-3.8, -1.4), CZ + math.sin(a) * r),
         rng.uniform(0.35, 0.7), rng.choice([BODY, BODY_LIT, DEEP]), squash=(1, 0.7, 1), subdiv=1, jitter=0.18)

# The deck's edge: a hazard-striped curb, four centimetres tall.
seg = 0.6
for (ax, az, bx, bz) in ((X0, Z0, X1, Z0), (X0, Z1, X1, Z1), (X0, Z0, X0, Z1), (X1, Z0, X1, Z1)):
    length = math.hypot(bx - ax, bz - az)
    count = int(length / seg)
    for k in range(count):
        t = (k + 0.5) / count
        px, pz = ax + (bx - ax) * t, az + (bz - az) * t
        # Pull the curb a hair inside the edge so the cut face stays clean.
        px += 0.07 if px == X0 else -0.07 if px == X1 else 0
        pz += 0.07 if pz == Z0 else -0.07 if pz == Z1 else 0
        horizontal = az == bz
        size = (length / count, 0.04, 0.12) if horizontal else (0.12, 0.04, length / count)
        box('Hazard curb', (px, DECK + 0.02, pz), size, HAZARD if k % 2 == 0 else PLATE)

# The steel test pad, in front of the walkers and clear of the cabinet lane.
box('Test pad', (-16.6, DECK + 0.006, 16.4), (5.4, 0.012, 6.2), STEEL_PAD)
for x in (-18.4, -16.6, -14.8):
    box('Test pad seam', (x, DECK + 0.013, 16.4), (0.025, 0.004, 6.1), PLATE)
for z in (14.33, 16.4, 18.47):
    box('Test pad seam', (-16.6, DECK + 0.013, z), (5.3, 0.004, 0.025), PLATE)
for k in range(12):
    x = -19.15 + k * 0.45
    box('Test pad hazard edge', (x, DECK + 0.014, 13.42), (0.22, 0.004, 0.14), HAZARD if k % 2 == 0 else PLATE)
# Landing chevrons on the east approach, pointing in.
for z in (15.2, 17.0, 18.8):
    for side in (-1, 1):
        box('Landing chevron', (-13.75, DECK + 0.008, z + side * 0.22), (0.5, 0.004, 0.09), IVORY,
            yaw=side * 0.6)

# Scorch craters: a dark burn and a pale lifted rim, flat enough to walk on.
CRATERS = [(-15.4, 13.9, 0.9), (-19.6, 13.4, 0.6), (-14.4, 19.4, 0.55), (-21.2, 22.3, 1.1)]
for x, z, r in CRATERS:
    disc('Scorch', (x, z), r, DECK + 0.016, SCORCH, sides=22)
    disc('Crater rim', (x, z), r * 1.22, DECK + 0.02, CRUST_LINE, sides=22, inner=r * 0.98)
    for i in range(5):
        a = rng.uniform(0, math.tau)
        d = r * rng.uniform(1.3, 1.9)
        box('Shrapnel', (x + math.cos(a) * d, DECK + 0.02, z + math.sin(a) * d), (0.12, 0.03, 0.06), CHAR,
            yaw=rng.uniform(0, math.pi))

# Footprints: the walkers walked here (a bought Move), three claws and a heel
# per step, in two lines because the fore and aft legs stand apart.
for wx in (-18.5, -15.5):
    for k in range(7):
        zc = 15.0 + k * 0.62
        side = -1 if k % 2 else 1
        px = wx + side * 0.34
        for cw in (-0.12, 0.0, 0.12):
            box('Claw print', (px + cw, DECK + 0.006, zc - 0.2), (0.05, 0.003, 0.2), CHAR, yaw=cw * 1.5)
        box('Heel print', (px, DECK + 0.006, zc + 0.12), (0.12, 0.003, 0.12), CHAR)

# Crust patches, so the ground reads as ground and not as a floor.
for i in range(16):
    x = rng.uniform(X0 + 0.6, X1 - 0.6)
    z = rng.uniform(Z0 + 0.6, Z1 - 1.6)
    if -19.3 < x < -13.9 and 13.3 < z < 19.5:
        continue  # not on the test pad
    disc('Crust patch', (x, z), rng.uniform(0.25, 0.7), DECK + 0.004, rng.choice([CRUST_LINE, mat('#7a7464', 0, 0.9)]),
         sides=9)

# The berm along the back: the in-game hill's silhouette, crust on the crest,
# a rust seam across its face, and a crater bitten out of it.
N = 60
front, crest, back = 23.05, 23.5, 23.98


def berm_h(x):
    t = (x - X0) / (X1 - X0)
    h = 1.5 + 0.5 * math.sin(t * math.tau * 1.3 + 0.7) + 0.22 * math.sin(t * math.tau * 3.1)
    bite = math.exp(-((x + 21.2) / 0.95) ** 2) * 1.2
    return max(0.3, h - bite)


verts, faces = [], []
for i in range(N + 1):
    x = X0 + 0.05 + (X1 - X0 - 0.1) * i / N
    h = berm_h(x)
    verts += [(x, DECK, front), (x, DECK + h, crest), (x, DECK + h * 0.92, back), (x, DECK, back)]
for i in range(N):
    a, b = 4 * i, 4 * (i + 1)
    for k in range(3):
        faces.append([a + k, b + k, b + k + 1, a + k + 1])
faces.append([0, 1, 2, 3])
faces.append([4 * N + 3, 4 * N + 2, 4 * N + 1, 4 * N])
mesh_obj('Berm', verts, faces, BODY)
crest_v, crest_f = [], []
seam_v, seam_f = [], []
for i in range(N + 1):
    x = X0 + 0.05 + (X1 - X0 - 0.1) * i / N
    h = berm_h(x)
    crest_v += [(x, DECK + h + 0.03, crest - 0.05), (x, DECK + h * 0.92 + 0.03, back + 0.005)]
    # The seam sits on the front slope at about half height.
    f = 0.5
    sz = front + (crest - front) * f
    seam_v += [(x, DECK + h * (f - 0.07), sz - 0.03 - (crest - front) * 0.07), (x, DECK + h * (f + 0.07), sz - 0.03 + (crest - front) * 0.07)]
for i in range(N):
    crest_f.append([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1])
    seam_f.append([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1])
mesh_obj('Berm crust', crest_v, crest_f, CRUST)
mesh_obj('Berm rust seam', seam_v, seam_f, RUST)

# ---------------------------------------------------------------------------
# On the deck
# ---------------------------------------------------------------------------

# The walkers, facing north toward the approach, so anyone flying in from
# the hub sees them side-on: the way the game shows them.
walker('Ember', TEAMS['Ember'], (-18.5, DECK, 21.6), (0, -1), 30)
cobalt_muzzle = walker('Cobalt', TEAMS['Cobalt'], (-15.5, DECK, 21.6), (0, -1), 52)

# The shot memory: Cobalt's last shot, still hanging in the air as the game's
# dotted trail, from the muzzle to the crater it made at the front of the
# deck. Small emissive dots; the glow layer does the rest.
target = (CRATERS[0][0], DECK + 0.05, CRATERS[0][1])
trail = mat(TEAMS['Cobalt'], 0.0, 0.3, 2.4, name='Lobbots Cobalt trail')
mx, my, mz = cobalt_muzzle
apex = 3.4
for k in range(1, 34):
    t = k / 34
    x = mx + (target[0] - mx) * t
    z = mz + (target[2] - mz) * t
    yy = my + (target[1] - my) * t + 4 * apex * t * (1 - t)
    ball('Shot trail dot', (x, yy, z), 0.06, trail, subdiv=1)

# A nuke on its cradle in the back corner. Olive body, hazard band, the
# trefoil on both flanks, four fins — the in-game sprite at nine metres
# closer.
NX, NZ = -23.6, 21.9
ny = DECK + 0.62
tube('Nuke body', (NX, ny, NZ - 0.85), (NX, ny, NZ + 0.65), 0.42, OLIVE, sides=24)
tube('Nuke nose', (NX, ny, NZ - 0.85), (NX, ny, NZ - 1.25), 0.42, OLIVE, r1=0.2, sides=24)
ball('Nuke tip', (NX, ny, NZ - 1.25), 0.2, OLIVE)
tube('Nuke tail', (NX, ny, NZ + 0.65), (NX, ny, NZ + 1.0), 0.42, PLATE, r1=0.22, sides=24)
tube('Nuke hazard band', (NX, ny, NZ - 0.55), (NX, ny, NZ - 0.35), 0.43, HAZARD, sides=24)
tube('Nuke dark band', (NX, ny, NZ - 0.35), (NX, ny, NZ - 0.3), 0.43, PLATE, sides=24)
for i in range(4):
    a = i / 4 * math.tau + math.pi / 4
    fx_, fy_ = math.cos(a), math.sin(a)
    verts = [(NX + fx_ * 0.3, ny + fy_ * 0.3, NZ + 0.55), (NX + fx_ * 0.3, ny + fy_ * 0.3, NZ + 1.05),
             (NX + fx_ * 0.72, ny + fy_ * 0.72, NZ + 1.12), (NX + fx_ * 0.72, ny + fy_ * 0.72, NZ + 0.85)]
    o = mesh_obj('Nuke fin', verts, [[0, 1, 2, 3]], PLATE)
    o.modifiers.new('Fin thickness', 'SOLIDIFY').thickness = 0.03
for side in (-1, 1):
    fxs = NX + side * 0.425
    for r, m_ in ((0.26, HAZARD), (0.06, PLATE)):
        verts = [(fxs + side * (0.002 if m_ is HAZARD else 0.004), ny + math.sin(i / 20 * math.tau) * r,
                  NZ + 0.05 + math.cos(i / 20 * math.tau) * r) for i in range(20)]
        mesh_obj('Nuke trefoil', verts, [list(range(20))], m_)
    for k in range(3):
        a0 = k / 3 * math.tau + math.pi / 2
        # Each blade is sixty degrees, with sixty degrees of yellow between.
        pts = [(fxs + side * 0.004, ny + math.sin(a0 + j / 6 * math.pi / 3 - math.pi / 6) * rr,
                NZ + 0.05 + math.cos(a0 + j / 6 * math.pi / 3 - math.pi / 6) * rr)
               for rr in (0.09, 0.23) for j in range(7)]
        quad = [i for i in range(7)] + [7 + i for i in range(6, -1, -1)]
        mesh_obj('Nuke trefoil blade', pts, [quad], PLATE)
for z in (NZ - 0.5, NZ + 0.4):
    box('Cradle saddle', (NX, DECK + 0.14, z), (0.9, 0.28, 0.22), LEG, bevel=0.02)
    tube('Cradle strap', (NX - 0.43, ny, z), (NX + 0.43, ny, z), 0.03, HAZARD, sides=6)

# A rack of the arsenal by the north-west corner, standing up.
RX, RZ = -24.25, 13.4
box('Shell rack base', (RX, DECK + 0.06, RZ), (0.7, 0.12, 2.0), LEG, bevel=0.02)
box('Shell rack rail', (RX, DECK + 0.85, RZ), (0.08, 0.06, 2.0), JOINT)
for z in (RZ - 0.95, RZ + 0.95):
    box('Shell rack upright', (RX, DECK + 0.48, z), (0.08, 0.86, 0.08), JOINT)
ARSENAL = [  # (name, radius, height, body, nose, band)
    ('Shell', 0.1, 0.55, BRASS, TUBE, TEAMS['Ember']),
    ('Heavy shell', 0.14, 0.75, BRASS, TUBE, TEAMS['Cobalt']),
    ('Mega shell', 0.18, 0.95, BRASS, HAZARD, '#14171d'),
    ('MIRV', 0.12, 1.05, WHITE, RED, '#14171d'),
    ('Napalm', 0.16, 0.7, RED, PLATE, '#ffd23f'),
    ('Cluster', 0.15, 0.72, ARMOUR_B, PLATE, '#ffd23f'),
]
z = RZ - 0.72
for name, r, h, body_m, nose_m, band in ARSENAL:
    base_y = DECK + 0.12
    tube(f'Rack {name} body', (RX, base_y, z), (RX, base_y + h * 0.72, z), r, body_m, sides=14)
    tube(f'Rack {name} nose', (RX, base_y + h * 0.72, z), (RX, base_y + h, z), r, nose_m, r1=r * 0.15, sides=14)
    tube(f'Rack {name} band', (RX, base_y + h * 0.5, z), (RX, base_y + h * 0.56, z), r + 0.005, mat(band, 0.2, 0.5), sides=14)
    z += 0.29

# Ammo crates by Cobalt, hazard-banded, one on top of two.
for (x, y_, z_, yaw) in ((-13.85, DECK + 0.33, 21.0, 0.05), (-13.85, DECK + 0.33, 21.75, -0.08), (-13.85, DECK + 0.99, 21.38, 0.3)):
    box('Ammo crate', (x, y_, z_), (0.66, 0.66, 0.66), CRATE, yaw=yaw, bevel=0.025)
    box('Ammo crate band', (x, y_ + 0.12, z_), (0.68, 0.1, 0.68), HAZARD, yaw=yaw)
    box('Ammo crate edge', (x, y_ - 0.3, z_), (0.68, 0.06, 0.68), PLATE, yaw=yaw)

# The wreck that just cooked off: a slumped, charred hull half in its own
# crater, the torn barrel lying beside it, embers glowing in the cracks.
WX, WZ = -21.2, 22.3


def wframe(x, y, w):
    # A tilted frame: the hull leans 25° onto its side and sits low.
    lean = math.radians(25)
    f = x * S
    up = (BODY_LIFT * 0.42 - y) * S
    return (WX + w * math.cos(lean) - up * math.sin(lean) * 0.4, DECK + up * math.cos(lean), WZ - f)


slab('Wreck hull', [(-19, -10), (-12, -16), (11, -15), (20, -8), (17, 1), (-16, 2)], -0.55, 0.55, wframe, CHAR)
slab('Wreck frame', [(-20, -11), (-13, -17), (12, -16), (22, -8), (20, 7), (12, 12), (-16, 10), (-22, 3)], -0.5, 0.5, wframe, OUTLINE)
slab('Wreck skirt', [(-14, 3.6), (16, 2.7), (14.6, 6.4), (-13.4, 6.6)], -0.56, 0.56, wframe, mat('#6d5a2a', 0.1, 0.7))
slab('Wreck hole', [(-6, -9), (0, -12), (4, -7), (1, -1), (-5, -2)], -0.565, 0.565, wframe, PLATE)
for (a, b) in (((4, -5), (9, -8)), ((-7, -1), (-12, 3)), ((-1, -11), (1, -16)), ((2, -3), (6, 0))):
    tube('Wreck ember crack', wframe(a[0], a[1], 0.57), wframe(b[0], b[1], 0.57), 0.018, EMBER, sides=5)
ball('Wreck ember core', wframe(-1, -6, 0.5), 0.12, EMBER)
tube('Torn barrel', (WX + 1.1, DECK + 0.1, WZ - 0.9), (WX + 0.2, DECK + 0.14, WZ - 1.7), 0.16, CHAR, sides=12)
tube('Torn barrel brake', (WX + 0.2, DECK + 0.14, WZ - 1.7), (WX - 0.05, DECK + 0.15, WZ - 1.93), 0.22, OUTLINE, sides=8)
tube('Wreck stack stub', wframe(-19, -10, -0.2), wframe(-19, -16, -0.2), 0.15, OUTLINE, sides=8)

# The wind sock in the north-east corner: the one thing on a Lobbots field
# that tells you which way the shot will drift.
WSX, WSZ = -13.55, 12.55
tube('Wind sock pole', (WSX, DECK, WSZ), (WSX, DECK + 3.2, WSZ), 0.04, JOINT, sides=8)
ball('Wind sock cap', (WSX, DECK + 3.22, WSZ), 0.07, HAZARD)
for k in range(5):
    t0, t1 = k / 5, (k + 1) / 5
    r0, r1 = 0.28 * (1 - t0 * 0.55), 0.28 * (1 - t1 * 0.55)
    droop = 0.12
    tube('Wind sock', (WSX - 0.1 - t0 * 1.4, DECK + 2.95 - droop * t0 * t0, WSZ + t0 * 0.35),
         (WSX - 0.1 - t1 * 1.4, DECK + 2.95 - droop * t1 * t1, WSZ + t1 * 0.35),
         r0, HAZARD if k % 2 == 0 else WHITE, r1=r1, sides=14)

# The name-board mast stays where room.js BEACONS expects it.
tube('Lobbots beacon mast', (-24.5, DECK, 18), (-24.5, 5.7, 18), 0.12, LEG, sides=12)
for y_ in (1.0, 2.6, 4.2):
    tube('Mast hazard band', (-24.5, y_, 18), (-24.5, y_ + 0.25, 18), 0.125, HAZARD, sides=12)
box('Lobbots beacon lamp', (-24.5, 5.7, 18), (0.4, 0.12, 0.4), BEACON)

# A blended cloud under the keel, like the arcade's other islands.
mb = bpy.data.metaballs.new('Proving ground cloud')
mb.resolution = mb.render_resolution = .35
cloud_obj = bpy.data.objects.new('Proving ground cloud', mb)
bpy.context.collection.objects.link(cloud_obj)
cloud_obj.location = point(CX, -4.2, CZ)
cloud_obj.scale = (1, 1, .42)
for i in range(8):
    a = i * math.tau / 8
    elem = mb.elements.new()
    elem.co = (math.cos(a) * 3.5, math.sin(a) * 3.5, 0)
    elem.radius = 3.2
mb.materials.append(CLOUD)
bpy.ops.object.select_all(action='DESELECT')
cloud_obj.select_set(True)
bpy.context.view_layer.objects.active = cloud_obj
bpy.ops.object.convert(target='MESH')

# ---------------------------------------------------------------------------
# Join by material: a few dozen draw calls rather than a thousand.
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.convert(target='MESH')  # applies bevels and solidify
groups = {}
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH' or not obj.data.materials:
        continue
    groups.setdefault(obj.data.materials[0].name, []).append(obj)
for name, objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name.replace('Lobbots ', 'Proving ground ')
    joined.data.name = joined.name

bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'lobbots-island.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'lobbots-island.glb'),
    export_format='GLB', use_selection=True, export_apply=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True)
print('LOBBOTS_ISLAND_COMPLETE', len(groups), 'materials')
