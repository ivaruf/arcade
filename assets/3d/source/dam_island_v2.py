"""The reservoir, rebuilt as a slice of a DAM BREAK level.

Run with Blender --background --python assets/3d/source/dam_island_v2.py.
Exported separately from cloud-world, the way lobbots_island.py is: room.js
hides the old concrete dam that dam_island.py baked into cloud-world.glb and
loads dam-island.glb in its place. The platform floor, the name-board mast
and its lights all stay in cloud-world; nothing here touches them.

WHY IT CHANGED
  The first reservoir was a civil-engineering gravity dam with spillway gates
  and a control hut — a fine model of a dam, and nothing anybody would
  recognise from the game. DAM BREAK is not about concrete monoliths. It is a
  side-on valley, a lattice the player drags out of timber, steel, concrete
  and cable between yellow anchor bolts, and a reservoir of blue particles
  leaning on it until something lets go. So the island is now that screen,
  pulled out of the glass into the round.

WHAT IT IS MEANT TO LOOK LIKE
  A level, cut. The game draws a valley profile; here that profile is
  extruded five metres east-west and both cut faces are left open like an
  ant farm, so from the walking lane you are looking at the game's own
  picture: dark terrain fill banded down into terrainDeep with the faint
  strata lines, the bright grass edge along the top, the edge turning to rock
  grey wherever the slope is steeper than the renderer's terrainSteepSlope,
  and the reservoir's cut face shading from the light body colour at the
  surface down to blobDeepColor, with the pale rim line along the waterline.

  Upstream is north, beside the cabinet, so the design note still holds:
  enter from the southwest, pass the reservoir on the right, then play. The
  game's flood arrives "down the left wall" (config.js title.flood x: 2), so
  a river comes over the north ridge and pours down the rock into the
  reservoir.

  The dam is a player's build, mid-level, about to fail — the title
  diorama's "this is what about to fail looks like" frozen at t ≈ 12 s. It is
  the game's two-column crib on a short sill, built as the game builds it:
  a sealed timber face (the members that seal are planks running the full
  width of the valley), steel bents behind it every metre, a concrete footing
  between the two anchors ("stack it, never hang it"), and yellow cable
  tie-backs to a third anchor downstream. Every joint is a white node pin,
  every anchored joint a yellow square plate, and every anchor the game's
  bolt head on its dark foundation pad. Members are coloured the way
  renderer.js colours load: the bottom strut is pulled toward the
  compression orange, the top tie toward the tension cyan, and the bottom
  face bay — the plain unsupported span the tutorial warns you about — bows
  downstream along the water force with crack ticks at midspan and the slow
  amber creep halo around it. A jet is already squirting through it.

  Downstream is the title screen's floodplain: the signpost, a rock, pines
  and round trees, and the house the dam is for, inside the PROTECT zone's
  green dashes. The BUILD ZONE's blue dashes stand at both ends of the
  sill. A stockpile of the four materials waits by the dam for the next bay.

  No text, no figures, no transparency. Water is opaque and lightly glossy;
  the only emission is thin — rim lines, dashes, the halo, one window.

Everything is joined by material before export.
"""
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent.parent
rng = random.Random(2026)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.metaballs):
    for item in list(block):
        block.remove(item)


def point(x, y, z):
    """Game (x, y up, z) to Blender. The same mapping as every island here."""
    return Vector((-x, -z, y))


# ---------------------------------------------------------------------------
# Materials, from dam_break's own palette. Every hex here is quoted from
# dam_break/src/config.js CONFIG.render or src/build/materials.js.
# ---------------------------------------------------------------------------

def linear(hex_):
    """sRGB hex to the linear floats Blender's base colour wants."""
    hex_ = hex_.lstrip('#')
    out = []
    for i in range(0, 6, 2):
        c = int(hex_[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def mix(a, b, f):
    """renderer.js mixRgb(): the stress palette is the material pulled toward
    the tension or compression colour by the load step."""
    a, b = a.lstrip('#'), b.lstrip('#')
    ca = [int(a[i:i + 2], 16) for i in range(0, 6, 2)]
    cb = [int(b[i:i + 2], 16) for i in range(0, 6, 2)]
    return '#' + ''.join(f'{round(x + (y - x) * f):02x}' for x, y in zip(ca, cb))


MATS = {}


def mat(hex_, metal=0.0, rough=0.6, emit=0.0, name=None):
    key = (hex_, metal, rough, emit)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name or f'DB {hex_}')
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


# Terrain (config.js render.terrain*, stratumColor over the fill).
GRASS = mat('#6d8f4e', 0, 0.85, name='DB terrain edge grass')
ROCK_EDGE = mat('#697585', 0, 0.8, name='DB terrain rock')
FILL = mat('#2c3729', 0, 0.9, name='DB terrain fill')
FILL_MID = mat('#232d21', 0, 0.9, name='DB terrain fill mid')
DEEP = mat('#161d16', 0, 0.92, name='DB terrain deep')
STRATUM = mat('#1a2219', 0, 0.92, name='DB terrain stratum line')

# Water (config.js render.blob*/water*). Opaque, lightly glossy.
W_BODY = mat('#3a97d2', 0, 0.12, name='DB water body')
W_MID = mat('#1b6aae', 0, 0.15, name='DB water mid')
W_LOW = mat('#0f4a85', 0, 0.18, name='DB water low')
W_DEEP = mat('#08375f', 0, 0.2, name='DB water deep')
W_RIM = mat('#cdeeff', 0, 0.2, 0.6, name='DB water rim line')
W_SHEEN = mat('#8fcdf2', 0, 0.1, name='DB water sheen')
W_JET = mat('#9ed4fb', 0, 0.1, 0.35, name='DB leak jet')
FOAM = mat('#eaf7ff', 0, 0.5, name='DB foam')
W_SHALLOW = mat('#49a8e0', 0, 0.12, name='DB water shallow')

# Building materials (materials.js color / darkColor).
TIMBER = mat('#c8954a', 0, 0.7, name='DB timber')
TIMBER_DARK = mat('#8a6023', 0, 0.75, name='DB timber grain')
STEEL = mat('#9fb2c4', 0.35, 0.4, name='DB steel')
STEEL_DARK = mat('#5c6b7a', 0.35, 0.45, name='DB steel dark')
CONCRETE = mat('#b9c4cc', 0, 0.85, name='DB concrete')
CONCRETE_DARK = mat('#77828b', 0, 0.88, name='DB concrete dark')
CABLE = mat('#e8d44d', 0.3, 0.45, name='DB cable')
CABLE_DARK = mat('#9a8c2a', 0.3, 0.5, name='DB cable dark')
HILITE = mat('#e6eef5', 0.4, 0.3, name='DB steel highlight')

# Load colours: renderer.js paletteFor() pulls the material toward these.
COMPRESSED = mat(mix('#9fb2c4', '#ff8348', 0.72), 0.25, 0.45, name='DB steel under compression')
TENSIONED = mat(mix('#9fb2c4', '#7fdcff', 0.6), 0.25, 0.4, name='DB steel under tension')
TIMBER_HOT = mat(mix('#c8954a', '#ff8348', 0.35), 0, 0.7, name='DB timber under load')
CREEP = mat('#ffb347', 0, 0.5, 0.9, name='DB creep halo')
CRACK = mat('#0f1216', 0, 0.9, name='DB crack')

# Joints and anchors (render.nodeColor, anchorColor, anchorDark).
NODE = mat('#e8f2fa', 0.1, 0.4, name='DB node')
ANCHOR = mat('#ffd35a', 0.3, 0.4, name='DB anchor bolt')
ANCHOR_DARK = mat('#8a6a12', 0.2, 0.6, name='DB anchor pad')

# Overlays drawn by the game over the world (build zone, protect zone).
ZONE = mat('#82c3ff', 0, 0.4, 0.5, name='DB build zone dash')
PROTECT = mat('#7fff9a', 0, 0.4, 0.5, name='DB protect dash')

# Decorative props (render.prop*).
TREE = mat('#315c37', 0, 0.85, name='DB tree')
TREE_DARK = mat('#254627', 0, 0.85, name='DB tree dark')
TRUNK = mat('#4a3826', 0, 0.85, name='DB trunk')
PROP_ROCK = mat('#5b6672', 0, 0.8, name='DB prop rock')
HOUSE = mat('#8a7358', 0, 0.8, name='DB house')
ROOF = mat('#6d4038', 0, 0.75, name='DB roof')
WINDOW = mat('#ffd35a', 0, 0.4, 0.8, name='DB window')
DOOR = mat('#3b2c20', 0, 0.8, name='DB door')


# ---------------------------------------------------------------------------
# Geometry helpers — raw vertices in game space, as lobbots_island.py does.
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


def prism(name, zy, xa, xb, material):
    """
    A polygon in the profile plane — world (z, y) pairs — extruded along x
    from xa to xb. This is the whole trick of the island: the game is drawn
    in its (x, y) plane, and here that plane is the world's (z, y), so every
    shape the renderer strokes becomes a prism across the valley.
    """
    n = len(zy)
    verts = [(xa, y, z) for z, y in zy] + [(xb, y, z) for z, y in zy]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_obj(name, verts, faces, material)


def box(name, centre, size, material, yaw=0.0):
    cx, cy, cz = centre
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    c, s = math.cos(yaw), math.sin(yaw)
    verts = []
    for dy in (-hy, hy):
        for dx, dz in ((-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz)):
            verts.append((cx + dx * c + dz * s, cy + dy, cz - dx * s + dz * c))
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    return mesh_obj(name, verts, faces, material)


def tube(name, a, b, r0, material, r1=None, sides=10, smooth=True):
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
            verts.append(tuple(P + (u * math.cos(t) + v * math.sin(t)) * r))
    faces = [list(range(sides))[::-1], list(range(sides, 2 * sides))]
    faces += [[i, (i + 1) % sides, sides + (i + 1) % sides, sides + i] for i in range(sides)]
    return mesh_obj(name, verts, faces, material, smooth)


def path_tube(name, pts, r, material, r_end=None, sides=8):
    """A tube along a polyline, as one mesh (cables, the jet, ripples)."""
    r_end = r if r_end is None else r_end
    verts, faces = [], []
    n = len(pts)
    for k, P in enumerate(pts):
        P = Vector(P)
        a = Vector(pts[min(k + 1, n - 1)]) - Vector(pts[max(k - 1, 0)])
        a.normalize()
        ref = Vector((0, 1, 0)) if abs(a.y) < 0.9 else Vector((1, 0, 0))
        u = a.cross(ref).normalized()
        v = a.cross(u).normalized()
        rr = r + (r_end - r) * k / (n - 1)
        for i in range(sides):
            t = i / sides * math.tau
            verts.append(tuple(P + (u * math.cos(t) + v * math.sin(t)) * rr))
    for k in range(n - 1):
        for i in range(sides):
            a0, a1 = k * sides + i, k * sides + (i + 1) % sides
            faces.append([a0, a1, a1 + sides, a0 + sides])
    faces.append(list(range(sides))[::-1])
    faces.append(list(range((n - 1) * sides, n * sides)))
    return mesh_obj(name, verts, faces, material, smooth=True)


def ball(name, centre, radius, material, squash=(1, 1, 1), subdiv=1, jitter=0.0, smooth=None):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    for v in bm.verts:
        k = 1 + (rng.uniform(-jitter, jitter) if jitter else 0)
        v.co = Vector((v.co.x * squash[0] * k, v.co.y * squash[1] * k, v.co.z * squash[2] * k))
    verts = [(centre[0] + v.co.x, centre[1] + v.co.y, centre[2] + v.co.z) for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return mesh_obj(name, verts, faces, material, smooth=(not jitter) if smooth is None else smooth)


def cone(name, base, radius, height, material, sides=7):
    """The game's pine tier is a flat triangle; turned, a low-sided cone."""
    bx, by, bz = base
    verts = [(bx + math.cos(i / sides * math.tau) * radius, by, bz + math.sin(i / sides * math.tau) * radius)
             for i in range(sides)] + [(bx, by + height, bz)]
    faces = [list(range(sides))] + [[i, (i + 1) % sides, sides] for i in range(sides)]
    return mesh_obj(name, verts, faces, material)


# ---------------------------------------------------------------------------
# The level. Profile coordinates are the GAME's own metres: u runs from the
# upstream (north) end, h is elevation. One game metre is S world metres.
# ---------------------------------------------------------------------------

S = 0.3
ZN = -23.2                    # world z of u = 0, the north (upstream) end
X0, X1 = 17.3, 22.2           # the two cut faces; the lane is west of X0
FLOOR = 1.0                   # walking surface of the 'dam' platform
BASE = 0.985                  # the slice sinks 15 mm into the floor tile


def Z(u):
    return ZN + u * S


def Y(h):
    return FLOOR + h * S


# The valley, upstream to downstream, in the shape of the title diorama
# (config.js render.title.terrain): a high left wall the river comes down, a
# bowl for the reservoir, a raised sill for the dam, a floodplain below.
PROFILE = [
    (0.0, 7.9), (1.4, 7.95), (2.6, 7.6), (3.3, 6.6), (3.9, 5.3), (4.6, 4.2),
    (5.6, 3.3), (7.0, 2.6), (9.0, 2.1), (11.5, 1.9), (13.5, 2.0), (15.0, 2.25),
    (16.0, 2.5), (20.6, 2.5),                    # the sill
    (21.4, 1.9), (22.6, 1.3), (24.5, 1.0), (27.0, 0.85), (30.0, 0.8),
]
U_END = PROFILE[-1][0]


def ground(u):
    """terrain.heightAt(): piecewise linear, clamped outside the range."""
    if u <= PROFILE[0][0]:
        return PROFILE[0][1]
    for (u0, h0), (u1, h1) in zip(PROFILE, PROFILE[1:]):
        if u <= u1:
            return h0 + (h1 - h0) * (u - u0) / (u1 - u0)
    return PROFILE[-1][1]


# ---- the dam: the title's two-column crib, grown to three bays ----------
DU0, DU1 = 16.4, 20.0          # upstream face / downstream column (3.6 m sill)
SILL = 2.5
ROWS = 3
ROW_H = 1.6                    # crest 7.3
CREST = SILL + ROWS * ROW_H
SURFACE = 6.95                 # the reservoir works just under the crest
T = 1.25                       # member thickness scale: a 1:3.3 slice wants
                               # its lattice a touch heavier than true to read
TH = {'timber': 0.36 * S * T, 'steel': 0.22 * S * T, 'concrete': 0.85 * S * T}
BOW = 0.22                     # m (game) sagitta of the bottom face bay


def face_u(h):
    """The upstream face line: straight except the bowing bottom bay, which
    renderer.js bendBow() pushes along the water force, i.e. downstream."""
    if SILL < h < SILL + ROW_H:
        t = (h - SILL) / ROW_H
        return DU0 + BOW * 4 * t * (1 - t)
    return DU0


# ---------------------------------------------------------------------------
# Terrain: banded fill under a grass (or rock) edge, cut open at both faces.
# Bands are vertical offsets below the surface, clipped at the floor — the
# game's fill gradient from terrainFill down to terrainDeep, with the faint
# stratum lines between.
# ---------------------------------------------------------------------------

BANDS = [  # (top offset, bottom offset) below the surface in world m, material
    (0.0, 0.05, None),            # the edge: grass, or rock where steep
    (0.05, 0.36, FILL),
    (0.36, 0.385, STRATUM),
    (0.385, 0.72, FILL_MID),
    (0.72, 0.745, STRATUM),
    (0.745, 9.0, DEEP),
]


def samples():
    """Profile vertices plus extra points, so bands bend where the ground does."""
    us = set(u for u, _ in PROFILE)
    for (u0, _), (u1, _) in zip(PROFILE, PROFILE[1:]):
        n = max(1, int((u1 - u0) / 1.2))
        for k in range(1, n):
            us.add(u0 + (u1 - u0) * k / n)
    return sorted(us)


US = samples()
for (ua, ub) in zip(US, US[1:]):
    ya, yb = Y(ground(ua)), Y(ground(ub))
    slope = abs(ground(ub) - ground(ua)) / (ub - ua)
    for d0, d1, m in BANDS:
        # renderer.js drawTerrainEdge(): |dy/dx| above terrainSteepSlope reads as rock
        m = m or (ROCK_EDGE if slope > 1.3 else GRASS)
        ta, tb = ya - d0, yb - d0
        ba, bb = max(ya - d1, BASE), max(yb - d1, BASE)
        if ta <= BASE + 1e-4 and tb <= BASE + 1e-4:
            continue
        ta, tb = max(ta, BASE), max(tb, BASE)
        prism('Terrain band', [(Z(ua), ba), (Z(ub), bb), (Z(ub), tb), (Z(ua), ta)], X0, X1, m)

# End caps: the slice's north and south faces, plain deep fill.
# (The band prisms already close them; nothing to add.)

# Rock outcrops on the steep wall and on the bowl's shoulder (render.terrainRock).
# (None on the east shoulder below the dam: the stockpile lives there.)
for u, h, r in [(3.5, 6.2, 0.2), (4.2, 4.9, 0.16), (2.9, 7.3, 0.14), (21.2, 2.0, 0.12)]:
    xs = (X0 + 0.3 + rng.uniform(0, 0.3), X0 + 2.2 + rng.uniform(0, 0.8), X1 - 0.4 - rng.uniform(0, 0.3))
    for x in (xs[:2] if u > 20 else xs):
        ball('Outcrop', (x, Y(h) - 0.02, Z(u) + 0.03), r * rng.uniform(0.8, 1.2), ROCK_EDGE,
             squash=(1.3, 0.75, 1.0), jitter=0.18)


# ---------------------------------------------------------------------------
# The reservoir. Depth bands on the cut face, darkest at the bottom
# (waterRenderer blobDepthBands), a pale rim line just proud of each cut face
# at the waterline, and a few wave lines on top.
# ---------------------------------------------------------------------------

def wet_start():
    """Where the surface meets the north wall."""
    for (u0, h0), (u1, h1) in zip(PROFILE, PROFILE[1:]):
        if h0 >= SURFACE >= h1:
            return u0 + (u1 - u0) * (h0 - SURFACE) / (h0 - h1)
    return 0.0


UW0 = wet_start()
FACE_BACK = TH['timber'] / 2 / S     # half a plank, in game metres
WATER_BANDS = [(0.0, 0.14, W_BODY), (0.14, 0.5, W_MID), (0.5, 1.0, W_LOW), (1.0, 9.0, W_DEEP)]
XI0, XI1 = X0 + 0.004, X1 - 0.004    # water sits 4 mm inside the terrain's cut planes

for d0, d1, m in WATER_BANDS:
    top_h = SURFACE - d0 / S
    bot_h = SURFACE - d1 / S
    # Walk the region under the surface between the north wall and the dam
    # face, clipped to [bot_h, top_h], as one polygon per band.
    us = set(u for u in US if UW0 < u < DU0 - FACE_BACK) | {DU0 - FACE_BACK}
    for (u0, h0), (u1, h1) in zip(PROFILE, PROFILE[1:]):
        for lvl in (top_h, bot_h):
            if (h0 - lvl) * (h1 - lvl) < 0:
                us.add(u0 + (u1 - u0) * (h0 - lvl) / (h0 - h1))
    us = sorted(u for u in us if UW0 - 1e-6 <= u <= DU0 - FACE_BACK + 1e-6)
    lower, upper = [], []
    for u in us:
        lo = max(ground(u), bot_h)
        if lo > top_h + 1e-6:
            continue
        lower.append((u, min(lo, top_h)))
        upper.append((u, top_h))
    if len(lower) < 2:
        continue
    # The downstream end follows the bowing face, so no sliver opens there.
    right = []
    steps = 8
    for k in range(steps + 1):
        h = max(lower[-1][1], bot_h) + (top_h - max(lower[-1][1], bot_h)) * k / steps
        right.append((face_u(h) - FACE_BACK, h))
    raw = [(Z(u), Y(h)) for u, h in lower[:-1]] + [(Z(u), Y(h)) for u, h in right] + \
          [(Z(u), Y(h)) for u, h in reversed(upper[:-1])]
    poly = []
    for q in raw:   # a band touching the wall starts at one point, not two
        if not poly or (abs(q[0] - poly[-1][0]) > 1e-6 or abs(q[1] - poly[-1][1]) > 1e-6):
            poly.append(q)
    if abs(poly[0][0] - poly[-1][0]) < 1e-6 and abs(poly[0][1] - poly[-1][1]) < 1e-6:
        poly.pop()
    prism('Reservoir v2 band', poly, XI0, XI1, m)

# The rim: render.blobRimColor, a thin bright line on each cut face.
for x in (X0 - 0.006, X1 + 0.006):
    zw0 = Z(UW0) + 0.01
    zw1 = Z(DU0 - FACE_BACK) - 0.004
    box('Reservoir v2 rim', (x, Y(SURFACE) - 0.012, (zw0 + zw1) / 2), (0.008, 0.024, zw1 - zw0), W_RIM)
    box('Reservoir v2 sheen', (x, Y(SURFACE) - 0.06, (zw0 + zw1) / 2 + 0.03), (0.008, 0.045, zw1 - zw0 - 0.08), W_SHEEN)

# Wave lines on the surface: render.waveLen ≈ 3.4 m crests running across.
for k in range(5):
    u = UW0 + 1.6 + k * 2.4
    if u > DU0 - 0.8:
        break
    pts = []
    for i in range(14):
        x = X0 + 0.25 + i * (X1 - X0 - 0.5) / 13
        pts.append((x, Y(SURFACE) + 0.007, Z(u) + 0.05 * math.sin(i * 0.9 + k)))
    path_tube('Reservoir v2 wave', pts, 0.009, W_SHEEN, sides=5)


# ---- the river down the left wall (title flood x: 2) ----------------------
RX0, RX1 = 18.0, 19.15
# A shallow run across the ridge top, 6 mm proud of the grass.
run = [(0.0, 7.9), (1.4, 7.95), (2.6, 7.6)]
prism('River run', [(Z(u), Y(h) + 0.006) for u, h in run] + [(Z(u), Y(h) + 0.03) for u, h in reversed(run)],
      RX0, RX1, W_SHALLOW)
# The fall: a sheet a few cm off the rock, from the lip to the surface.
fall = []
for k in range(9):
    t = k / 8
    u = 2.6 + 1.1 * t + 0.25 * t * t
    h = 7.6 - (7.6 - SURFACE) * t ** 1.4
    fall.append((u, h))
outer = [(Z(u) + 0.06 + 0.02 * k, Y(h) + 0.03) for k, (u, h) in enumerate(fall)]
inner = [(Z(u) + 0.0 + 0.01 * k, Y(h)) for k, (u, h) in enumerate(fall)]
prism('River fall', inner + list(reversed(outer)), RX0 + 0.04, RX1 - 0.04, W_SHALLOW)
for x in (RX0 + 0.12, RX0 + 0.33, RX0 + 0.52, RX0 + 0.78, RX1 - 0.12):
    path_tube('River streak', [(x, Y(h) + 0.036, Z(u) + 0.065 + 0.02 * k) for k, (u, h) in enumerate(fall)],
              0.007, FOAM, sides=4)
for i in range(10):
    ball('River foam', (RX0 + 0.08 + i * 0.11, Y(SURFACE) + 0.02, Z(fall[-1][0]) + 0.12 + rng.uniform(-0.05, 0.08)),
         0.06 + rng.uniform(0, 0.04), FOAM, squash=(1.2, 0.45, 1.1), jitter=0.2)


# ---------------------------------------------------------------------------
# The dam.
# ---------------------------------------------------------------------------

BENTS = [X0 + 0.07 + i * (X1 - X0 - 0.14) / 5 for i in range(6)]
BW = 0.085                      # bent member width along x


def beam(name, a, b, xc, t, material, w=BW):
    """One member between two profile points (u, h), as the game strokes it:
    a band of width `t` centred on the node line, here `w` deep in x."""
    za, ya, zb, yb = Z(a[0]), Y(a[1]), Z(b[0]), Y(b[1])
    dz, dy = zb - za, yb - ya
    L = math.hypot(dz, dy)
    nz, ny = -dy / L * t / 2, dz / L * t / 2
    return prism(name, [(za + nz, ya + ny), (zb + nz, yb + ny), (zb - nz, yb - ny), (za - nz, ya - ny)],
                 xc - w / 2, xc + w / 2, material)


def node_pin(u, h, xc, w, anchored=False):
    """renderer.js drawNodes(): free joints are white dots, anchored joints
    yellow square bolt plates. Turned, a pin through the bent."""
    y, z = Y(h), Z(u)
    if anchored:
        box('Anchored node', (xc, y, z), (w + 0.03, 0.075, 0.075), ANCHOR)
    else:
        tube('Node pin', (xc - w / 2 - 0.018, y, z), (xc + w / 2 + 0.018, y, z), 0.036, NODE, sides=12)


rows_h = [SILL + r * ROW_H for r in range(ROWS + 1)]

# The sealed face: three timber planks the full width of the valley. The
# bottom one bows and is the member the whole moment is about.
for r in range(ROWS):
    h0, h1 = rows_h[r], rows_h[r + 1]
    t = TH['timber']
    left, right = [], []
    steps = 10 if r == 0 else 1
    for k in range(steps + 1):
        h = h0 + (h1 - h0) * k / steps
        u = face_u(h)
        left.append((Z(u) - t / 2, Y(h)))
        right.append((Z(u) + t / 2, Y(h)))
    prism('Face plank', left + list(reversed(right)), X0, X1, TIMBER_HOT if r == 0 else TIMBER)
    # Grain: renderer.js strokes two darkColor lines along a timber member.
    # On the cut ends they are the same lines; on the dry face, plank seams.
    centre = [((zl + zr) / 2, y) for (zl, y), (zr, _) in zip(left, right)]
    for x in (X0 - 0.006, X1 + 0.006):
        for off, wd in ((0.0, t * 0.16), (t * 0.3, t * 0.1)):
            gl = [(z + off - wd / 2, y) for z, y in centre]
            gr = [(z + off + wd / 2, y) for z, y in centre]
            prism('Face grain', gl + list(reversed(gr)), x - 0.003, x + 0.003, TIMBER_DARK)
    nseams = 14
    for i in range(1, nseams):
        x = X0 + i * (X1 - X0) / nseams
        prism('Face seam', [(z - 0.002, y) for z, y in right] + list(reversed([(z + 0.006, y) for z, y in right])),
              x - 0.007, x + 0.007, TIMBER_DARK)

# Creep halo (render.creepPulseColor) and crack ticks at midspan on the
# bowing bay — the "being eaten right now" warning, frozen at a breath.
t = TH['timber']
halo_l, halo_r = [], []
for k in range(11):
    h = rows_h[0] + ROW_H * k / 10
    u = face_u(h)
    halo_l.append((Z(u) - t / 2 - 0.02, Y(h)))
    halo_r.append((Z(u) + t / 2 + 0.02, Y(h)))
for x, side in ((X0, -1), (X1, 1)):
    xo = x + side * 0.009
    for edge in (halo_l, halo_r):
        prism('Creep halo', [(z - 0.007, y) for z, y in edge] + list(reversed([(z + 0.007, y) for z, y in edge])),
              xo - 0.003, xo + 0.003, CREEP)
# Halo along the plank's dry face too, so it reads from above.
prism('Creep halo', [(z + 0.004, y) for z, y in halo_r[1:-1]] +
      list(reversed([(z + 0.012, y) for z, y in halo_r[1:-1]])), X0 + 0.02, X1 - 0.02, CREEP)
mid_h = rows_h[0] + ROW_H / 2
for k in range(5):
    h = mid_h + (k - 2) * 0.17
    u = face_u(h)
    for x, side in ((X0, -1), (X1, 1)):
        box('Crack tick', (x + side * 0.015, Y(h), Z(u)), (0.006, 0.014, t * 0.8), CRACK)
    for x in (X0 + 0.6 + k * 0.85, X0 + 1.0 + k * 0.85):
        box('Crack tick', (x, Y(h + 0.05), Z(u) + t / 2 + 0.004), (0.12, 0.012, 0.008), CRACK)

# The concrete footing between the two anchors, half sunk in the sill the way
# a ground member is drawn centred on its node line.
tc = TH['concrete']
prism('Concrete footing', [(Z(DU0) - TH['timber'] / 2, Y(SILL) - tc / 2), (Z(DU1) + 0.06, Y(SILL) - tc / 2),
                           (Z(DU1) + 0.06, Y(SILL) + tc / 2), (Z(DU0) - TH['timber'] / 2, Y(SILL) + tc / 2)],
      X0 + 0.01, X1 - 0.01, CONCRETE)
for x in (X0 + 0.004, X1 - 0.004):
    side = -1 if x < 20 else 1
    prism('Footing edge', [(Z(DU0) - TH['timber'] / 2, Y(SILL) + tc / 2 - 0.05), (Z(DU1) + 0.06, Y(SILL) + tc / 2 - 0.05),
                           (Z(DU1) + 0.06, Y(SILL) + tc / 2 - 0.02), (Z(DU0) - TH['timber'] / 2, Y(SILL) + tc / 2 - 0.02)],
          x + side * 0.004 - 0.003, x + side * 0.004 + 0.003, CONCRETE_DARK)

# The bents. Downstream column steel, ties steel, one diagonal per bay:
# the bottom strut carries the push and wears the compression colour, the top
# tie wears the tension colour, the middle brace is plain timber.
ts, tt = TH['steel'], TH['timber']
for bi, xc in enumerate(BENTS):
    f = [(face_u(h), h) for h in rows_h]
    d = [(DU1, h) for h in rows_h]
    for r in range(ROWS):
        beam('Downstream column', d[r], d[r + 1], xc, ts, STEEL)
        tie = TENSIONED if r == ROWS - 1 else STEEL
        beam('Tie', (f[r + 1][0] + FACE_BACK, f[r + 1][1]), d[r + 1], xc, ts, tie)
    beam('Strut', d[0], (f[1][0] + FACE_BACK, f[1][1]), xc, ts * 1.15, COMPRESSED)
    beam('Brace', (f[1][0] + FACE_BACK, f[1][1]), d[2], xc, tt, TIMBER, w=BW * 0.9)
    beam('Brace', d[2], (f[3][0] + FACE_BACK, f[3][1]), xc, ts, STEEL)
    # Steel highlight (render.highlightAlpha white offset stroke) on the
    # column's upstream edge, every bent.
    for r in range(ROWS):
        box('Steel highlight', (xc, Y(rows_h[r] + ROW_H / 2), Z(DU1) - ts / 2 + 0.006),
            (BW + 0.004, ROW_H * S - 0.08, 0.01), HILITE)
    # Joints: pins at every free node, plates on the two anchored feet.
    for r in range(1, ROWS + 1):
        node_pin(f[r][0] + FACE_BACK, rows_h[r], xc, BW)
        node_pin(DU1, rows_h[r], xc, BW)
    node_pin(DU0, SILL, xc, BW, anchored=True)
    node_pin(DU1, SILL, xc, BW, anchored=True)

# Longitudinal members tie the bents into one crib (steel, at the two upper
# downstream rows) and a timber cap runs along the crest.
for r in (2, 3):
    box('Stringer', ((X0 + X1) / 2, Y(rows_h[r]), Z(DU1)), (X1 - X0 - 0.1, ts * 0.9, ts * 0.9), STEEL)
box('Crest cap', ((X0 + X1) / 2, Y(CREST) + tt / 2 - 0.01, Z(DU0)), (X1 - X0, 0.03, tt + 0.03), TIMBER_DARK)


def anchor_bolt(u, h, x, side):
    """renderer.js drawAnchors(): a dark trapezoid foundation pad and the
    yellow bolt head with its slot, on a cut face (side -1 west, +1 east)."""
    z, y = Z(u), Y(h)
    s = 0.07
    pad = [(z - s * 1.5, y - s * 0.9), (z + s * 1.5, y - s * 0.9), (z + s * 0.9, y + s * 0.5), (z - s * 0.9, y + s * 0.5)]
    prism('Anchor pad', pad, x + side * 0.006 - 0.003, x + side * 0.006 + 0.003, ANCHOR_DARK)
    tube('Anchor bolt', (x + side * 0.009, y, z), (x + side * 0.016, y, z), s * 0.72, ANCHOR, sides=16, smooth=False)
    box('Anchor slot', (x + side * 0.019, y, z), (0.004, s * 0.22, s * 0.84), ANCHOR_DARK)


for u in (DU0, DU1):
    anchor_bolt(u, SILL, X0, -1)
    anchor_bolt(u, SILL, X1, 1)

# Cable tie-backs from the crest's downstream joint to a third anchor on the
# plain: yellow, light, hanging a little slack (render.cableSagScale).
UA = 23.4
for xc in (BENTS[1], BENTS[4]):
    a = (xc, Y(CREST), Z(DU1))
    b = (xc, Y(ground(UA)) + 0.02, Z(UA))
    pts = []
    for k in range(13):
        t = k / 12
        pts.append((xc, a[1] + (b[1] - a[1]) * t - 0.07 * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t))
    path_tube('Cable', pts, 0.016, CABLE, sides=8)
    # The ground anchor: a flat pad with the bolt head turned up.
    gy = Y(ground(UA))
    box('Ground anchor pad', (xc, gy + 0.012, Z(UA)), (0.26, 0.024, 0.2), ANCHOR_DARK)
    tube('Ground anchor bolt', (xc, gy + 0.024, Z(UA)), (xc, gy + 0.05, Z(UA)), 0.055, ANCHOR, sides=16, smooth=False)
    box('Ground anchor slot', (xc, gy + 0.052, Z(UA)), (0.08, 0.006, 0.018), ANCHOR_DARK)
    box('Cable plate', (xc, Y(CREST), Z(DU1)), (BW + 0.03, 0.075, 0.075), ANCHOR)


# ---- the leak: a jet through the dying bay, foam where it lands -----------
JX = (BENTS[2] + BENTS[3]) / 2
j0 = (face_u(SILL + ROW_H * 0.45) + FACE_BACK, SILL + ROW_H * 0.45)
# A ballistic arc (the retired jetVelCoeff sheet, but the fluid draws the
# same curve): clears the footing, then comes down on the plain.
jet = []
t = 0.0
while True:
    u = j0[0] + 5.2 * t
    h = j0[1] + 1.4 * t - 2.6 * t * t
    if h <= ground(u) + 0.03 and t > 0.3:
        jet.append((JX + 0.03 * math.sin(t * 3), Y(ground(u) + 0.03), Z(u)))
        break
    jet.append((JX + 0.03 * math.sin(t * 3), Y(h), Z(u)))
    t += 0.08
path_tube('Leak jet', jet, 0.03, W_JET, r_end=0.05, sides=10)
path_tube('Leak jet core', [(x, y + 0.012, z) for x, y, z in jet[:len(jet) * 2 // 3]], 0.012, FOAM, r_end=0.008, sides=6)
land_u = (jet[-1][2] - ZN) / S
for i in range(6):
    ball('Jet foam', (JX + rng.uniform(-0.16, 0.16), Y(ground(land_u)) + 0.03, Z(land_u) + rng.uniform(-0.12, 0.14)),
         0.05 + rng.uniform(0, 0.035), FOAM, squash=(1.2, 0.5, 1.2), jitter=0.2)
# A tongue of escaped water running down the plain toward the house.
# It stops at the PROTECT line: the moment is "about to", not "too late".
tongue = []
n_t = max(3, int((24.3 - land_u) / 0.33))
for k in range(n_t):
    u = land_u + 0.1 + k * (24.3 - land_u - 0.1) / (n_t - 1)
    tongue.append((u, JX + 0.18 * math.sin(k * 0.7)))
for (ua, xa), (ub, xb) in zip(tongue, tongue[1:]):
    w = 0.22 - 0.012 * tongue.index((ua, xa))
    ya, yb = Y(ground(ua)) + 0.007, Y(ground(ub)) + 0.007
    mesh_obj('Escaped water', [
        (xa - w, ya, Z(ua)), (xa + w, ya, Z(ua)), (xb + w * 0.95, yb, Z(ub)), (xb - w * 0.95, yb, Z(ub)),
        (xa - w, ya + 0.012, Z(ua)), (xa + w, ya + 0.012, Z(ua)), (xb + w * 0.95, yb + 0.012, Z(ub)),
        (xb - w * 0.95, yb + 0.012, Z(ub))],
        [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], W_SHALLOW)


# ---------------------------------------------------------------------------
# The game's overlays, standing in the world: BUILD ZONE's blue dashes either
# side of the sill on both cut faces, PROTECT's green dashes round the house.
# ---------------------------------------------------------------------------

for u in (15.4, 21.0):
    y = Y(ground(u)) + 0.04
    while y < 3.33:              # tops stay under 3.45, the blocker's top
        for x in (X0 - 0.02, X1 + 0.02):
            box('Build zone dash', (x, y + 0.05, Z(u)), (0.018, 0.1, 0.018), ZONE)
        y += 0.17

HU, HX = 26.6, 19.55
pz0, pz1, px0, px1 = Z(HU - 2.1), Z(HU + 2.2), HX - 0.85, HX + 0.85


def dashes(a, b, fixed, along_x):
    """One side of the dashed rectangle, each dash laid on the ground under
    it (the plain falls a little across the zone)."""
    L = b - a
    n = int(L / 0.16)
    for i in range(n):
        c = a + (i + 0.5) * L / n
        z = fixed if along_x else c
        y = Y(ground((z - ZN) / S)) + 0.012
        if along_x:
            box('Protect dash', (c, y, z), (0.09, 0.012, 0.022), PROTECT)
        else:
            box('Protect dash', (fixed, y, c), (0.022, 0.012, 0.09), PROTECT)


dashes(px0, px1, pz0, True)
dashes(px0, px1, pz1, True)
dashes(pz0, pz1, px0, False)
dashes(pz0, pz1, px1, False)


# ---------------------------------------------------------------------------
# Props, in the title diorama's order downstream of the dam: the signpost,
# a rock, pines and round trees, the house. Sizes from render.prop*H, a
# little over true so they read beside a gopher.
# ---------------------------------------------------------------------------

PS = S * 1.25


def gy(u):
    return Y(ground(u))


def pine(u, x, s=1.0):
    h = 4.2 * PS * s
    y = gy(u)
    tube('Pine trunk', (x, y - 0.02, Z(u)), (x, y + h * 0.24, Z(u)), h * 0.045, TRUNK, sides=6, smooth=False)
    for k in range(3):
        bot = y + h * (0.18 + k * 0.24)
        top = y + h * (0.45 + k * 0.24)
        cone('Pine tier', (x, bot, Z(u)), h * 0.34 * (0.5 - k * 0.12) * 1.15, top - bot, TREE)


def tree(u, x, s=1.0):
    h = 3.2 * PS * s
    y = gy(u)
    tube('Tree trunk', (x, y - 0.02, Z(u)), (x, y + h * 0.5, Z(u)), h * 0.04, TRUNK, sides=6, smooth=False)
    ball('Tree crown', (x, y + h * 0.62, Z(u)), h * 0.3, TREE, subdiv=2, smooth=False)
    ball('Tree crown dark', (x - h * 0.1, y + h * 0.52, Z(u) + h * 0.08), h * 0.19, TREE_DARK, subdiv=1, smooth=False)


def rock(u, x, r):
    ball('Prop rock', (x, gy(u) + r * 0.2, Z(u)), r, PROP_ROCK, squash=(1.2, 0.7, 1.0), jitter=0.2)


def sign(u, x):
    h = 1.8 * PS
    y = gy(u)
    box('Sign post', (x, y + h / 2 - 0.02, Z(u)), (0.05, h, 0.05), TRUNK)
    box('Sign board', (x - 0.035, y + h * 0.87, Z(u)), (0.025, h * 0.3, h * 0.68), TIMBER)
    box('Sign grain', (x - 0.05, y + h * 0.87, Z(u)), (0.006, 0.012, h * 0.6), TIMBER_DARK)


def house(u, x):
    h = 2.6 * PS
    w = h * 1.15
    y = gy(u) - 0.02
    box('House walls', (x, y + h * 0.36, Z(u)), (w * 0.9, h * 0.72, w), HOUSE)
    # Gable roof, ridge running along z so the gable end faces the lane.
    rw = w * 0.6
    ry0, ry1 = y + h * 0.7, y + h * 1.12
    zz0, zz1 = Z(u) - w * 0.56, Z(u) + w * 0.56
    mesh_obj('House roof', [
        (x - rw, ry0, zz0), (x + rw, ry0, zz0), (x, ry1, zz0),
        (x - rw, ry0, zz1), (x + rw, ry0, zz1), (x, ry1, zz1)],
        [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], ROOF)
    box('House window', (x - w * 0.45 - 0.004, y + h * 0.4, Z(u) - w * 0.18), (0.008, h * 0.22, w * 0.26), WINDOW)
    box('House window', (x + w * 0.45 + 0.004, y + h * 0.4, Z(u) + w * 0.1), (0.008, h * 0.22, w * 0.26), WINDOW)
    box('House door', (x - w * 0.45 - 0.004, y + h * 0.2, Z(u) + w * 0.22), (0.008, h * 0.4, w * 0.2), DOOR)
    box('House window', (x, y + h * 0.4, Z(u) + w / 2 + 0.004), (w * 0.24, h * 0.22, 0.008), WINDOW)
    box('House chimney', (x + w * 0.2, y + h * 1.02, Z(u) + w * 0.25), (0.07, 0.2, 0.07), ROOF)


sign(21.6, X0 + 0.32)
rock(22.0, 20.85, 0.11)
rock(28.8, 17.75, 0.1)
pine(24.4, 17.95, 1.0)
tree(26.3, 21.45, 0.9)
house(HU, HX)
pine(28.6, 21.4, 0.9)
tree(29.0, 18.55, 0.85)
pine(27.6, 17.6, 0.8)


# ---- the stockpile: one of each material, waiting for the next bay --------
SU = 22.3
sy = gy(SU + 0.5)
SX = 21.65
for k in range(3):   # timber planks
    box('Stock timber', (SX, sy + 0.025 + k * 0.05, Z(SU) + 0.02 * k), (0.12, 0.045, 0.75), TIMBER)
    box('Stock timber end', (SX, sy + 0.025 + k * 0.05, Z(SU) + 0.02 * k - 0.377), (0.122, 0.047, 0.006), TIMBER_DARK)
for k in range(2):   # steel sections
    box('Stock steel', (SX + 0.17 + k * 0.09, sy + 0.03, Z(SU) + 0.05), (0.07, 0.06, 0.8), STEEL)
    box('Stock steel web', (SX + 0.17 + k * 0.09, sy + 0.064, Z(SU) + 0.05), (0.072, 0.008, 0.8), STEEL_DARK)
for k in range(2):   # concrete blocks
    box('Stock concrete', (SX + 0.05, sy + 0.08 + k * 0.0, Z(SU + 2.0) + k * 0.24), (0.22, 0.16, 0.2), CONCRETE)
    box('Stock concrete band', (SX + 0.05, sy + 0.13, Z(SU + 2.0) + k * 0.24), (0.224, 0.02, 0.204), CONCRETE_DARK)
# A cable drum lying on its flank.
cz = Z(SU + 2.1)
tube('Cable drum', (SX + 0.3, sy + 0.1, cz), (SX + 0.42, sy + 0.1, cz), 0.075, CABLE, sides=16)
for xo in (0.29, 0.43):
    tube('Cable drum flange', (SX + xo - 0.008, sy + 0.1, cz), (SX + xo + 0.008, sy + 0.1, cz), 0.1, CABLE_DARK, sides=16)


# ---------------------------------------------------------------------------
# Join by material, then save and export.
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
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
    # 'DB diorama' and never 'Dam …' / 'Reservoir …': room.js hides the old
    # dam by name prefix, and these must not match any of those prefixes.
    joined.name = name.replace('DB ', 'DB diorama ')
    joined.data.name = joined.name

bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'dam-island.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'dam-island.glb'),
    export_format='GLB', use_selection=True, export_apply=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
print('DAM_ISLAND_V2_COMPLETE', len(groups), 'materials', tris, 'triangles')
