"""The outcrop, second cut: SUPERMINE's own rig, chewing into SUPERMINE's own ground.

Run with Blender --background --python assets/3d/source/supermine_island_v2.py.
Writes assets/3d/supermine-island.glb (+ .blend beside it for inspection).
Exported on its own, like lobbots_island.py, so cloud-world.glb need not be
rebuilt: room.js switches the old island's props off by name and loads this.

WHY A SECOND CUT
  The owner's note on the first one: "the crystals all look the same, and do
  not match ingame content, also the digging machine looks a bit too simple".
  Both were true. The old island (supermine_island.py) built a generic yellow
  excavator and three piles of one hexagonal shard in three colours, two of
  which (amethyst, an all-green "emerald" pile) were not even the game's
  palette. Nothing on it came from the game's source. Everything here does.

THE RIG IS vehicle.js, LIFTED OUT OF THE PAGE
  vehicle.js draws the machine top-down, procedurally, from `parts` levels,
  in world units. This script uses the same constants (BODY 96 -> widened,
  TRACK_WIDTH 24 + 9 per treads level, BLADE_ARM 20, BLADE_THICK 24 + 4 per
  tier, HOPPER_LEN 34 + 17, CONVEYOR_LEN 56, GRINDER_R 30, DRILL_R 26, ARM_REACH
  50 + 68) and the same layout arithmetic (hullHalf, grinderHalf, the drill
  spread across the blade half, the magnet arm elbow at 45% of its reach), so
  seen from straight above the model IS the sprite, part for part. Height is
  the one thing the page does not have, and it is invented — with the rule
  that nothing gets a part the game does not draw.

  It is a well-upgraded rig, the one a player has mid-run, so every upgrade
  the game makes visible is on it: WIDER CUTTING BLADE (one extra brace),
  ROTARY DRILL HEADS (one pair), SIDE GRINDERS, REINFORCED CUTTERS (longer
  teeth), TURBO DRIVE (a second stack each side), MAGNETIC COLLECTORS (arms
  part-unfolded so they fit the deck), ORE REFINERY (the green plumbing),
  REAR CONVEYOR, HOPPER EXPANSION (funnels + a rib) and HEAVY TREADS (wider
  shoes, three road wheels). Ten upgrades, so drawLights() gives it three
  amber lamps a side and the red roof beacon.

  Colours are vehicle.js's own: the gunmetal chassis gradient (#5b636d ..
  #79838f .. #464d55), near-black shoes #0f1216 with #5b646f cleats, the drum
  #9aa3ad with its amber diagonal bands, teeth alternating #c8d2dc / #98a4b0,
  the cyan cab glass, amber nose hazard stripes, the hot orange cutting edge,
  cyan magnet coils and the green refinery line. Note what is NOT there: the
  game's rig is not yellow. The old island's ochre cab was a stock excavator.

THE MINERALS ARE materials.js
  Six ores (the `ore: true` rows), each in its own [base, shadow, highlight]
  ramp and each in a 3D form taken from the game's silhouette family and
  break style, so they differ by outline and not only by hue:
    Iron Ore   #9fadbb  shard / fracture, no glow  -> flat angular metal plates
    Gold       #ffcb31  chunk / burst, glow        -> rounded heavy nuggets
    Emerald    #33dd80  chunk / burst, glow        -> faceted cut stones
    Crystal    #48bcff  shard / fracture, glow     -> upright prismatic spikes
    Voidstone  #c46bff  chunk / burst, glow        -> dark geodes, lit tops
    Starcore   #ff7ad9  shard / shatter, glow      -> star-bursts of shards
  Every lump's outline is one of the 24 polygons the game bakes for that
  material: buildSilhouette() and mulberry32() from particles.js are ported
  below and seeded exactly as bakeAtlas() seeds them. Each lump is lit the
  way bakeAtlas() lights a sprite: shadow-coloured rim, base body, and the
  highlight "specular facet" — the polygon again, rotated 0.4 rad, shrunk and
  set up and to one side.

THE GROUND IS terrain.js
  The rig is cutting into a bank of packed deposits, dirt and stone, with ore
  POCKETS (ellipses) and an iron VEIN (a long meandering lane) in it — the
  generator's own two structures — and the richer ores further in, because
  deeper is rarer (level.js zone tables). In front of the bank, six ore skips
  show each mineral up close, west to east in the order of their value.

LAYOUT (game coords; platform 'mine' is x 12..28, z -6..6, floor y -5.5)
  rig       along the north edge, x 13.9..20.2, facing +x into the bank
  bank      north-east corner, x 20.3..26.6, z -5.95..-1.8, 0.92 m tall
  skips     south-west, x 12.9..20.4, z 4.35..5.15
  kept clear: the cabinet (24, 0) and 1.5 m in front of it, the take-home
  dispenser (25.32, 1.63), the beacon mast (27.5, 0), the miners' bridge lane
  x 20.8..23.2 from z 6 up to the cabinet, and the central route z ~ 0 from
  the west edge. The two lantern posts cloud-world already has on this deck
  (13.2, -4.4) and (26.8, 4.4) are stepped round, not removed.
  Every decal sits 5 mm or more proud of whatever it can overlap: coplanar
  faces z-fight, and that flickered on the Lobbots island.

Geometry goes straight into one bucket per material and is written out as one
mesh each, so the island is as many draw calls as it has materials.
"""
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent.parent
rng = random.Random(2026)  # deterministic: the island is the same every build

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.materials):
    for item in list(block):
        block.remove(item)

FLOOR = -5.5


def point(x, y, z):
    """Game (x, y up, z) to Blender. The same mapping as every island here."""
    return Vector((-x, -z, y))


def vec(x, y, z):
    """A game-space direction in Blender (the linear part of point())."""
    return Vector((-x, -z, y))


# ---------------------------------------------------------------------------
# Materials. sRGB hex in, as the game writes them.
# ---------------------------------------------------------------------------

def linear(hex_):
    hex_ = hex_.lstrip('#')
    out = []
    for i in range(0, 6, 2):
        c = int(hex_[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


MATS = {}


def mat(name, hex_, metal=0.0, rough=0.55, emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new('SMv2 ' + name)
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
    MATS[name] = m
    return m


# The rig, vehicle.js. Near-identical greys the page uses for different parts
# are folded together (noted per line) — five greys within 3% of each other
# are five draw calls and one look.
TRACK = mat('track shoe', '#0f1216', 0.1, 0.8)              # drawTracks shoe
CLEAT = mat('track cleat', '#5b646f', 0.15, 0.45)            # drawTracks cleats
CHASSIS = mat('chassis', '#69727d', 0.12, 0.45)             # gChassis mid stop
CHASSIS_HI = mat('chassis highlight', '#79838f', 0.12, 0.4)  # gChassis 0.35 stop
CHASSIS_LO = mat('chassis shade', '#464d55', 0.12, 0.5)      # gChassis edge stop
OUTLINE = mat('outline', '#191d22', 0.1, 0.6)               # #191d22 / #14171b strokes
HAZARD = mat('hazard amber', '#ffbe28', 0.1, 0.5)           # nose stripes, drum bands, chevrons
CABIN = mat('cabin', '#3d444c', 0.12, 0.45)                  # cabin, arms #39414b, wheels #3a424c
GLASS = mat('cab glass', '#96ebff', 0.0, 0.1, 0.3)          # rgba(150,235,255,.92); low: the panes are broad
HOPPER = mat('hopper', '#4a5058', 0.12, 0.45)               # gHopper top, #4b535d #4d5661 #464e58 #454d57
DARK = mat('dark steel', '#292d33', 0.12, 0.55)             # gHopper foot, belt, mounts, stacks
DRUM = mat('drum steel', '#9aa3ad', 0.35, 0.32)              # gDrum top, rods #9aa4b0, hubs #8b95a1
TOOTH_A = mat('tooth bright', '#c8d2dc', 0.4, 0.28)        # teeth, grinder #c3ccd6, spokes #d3dae2
TOOTH_B = mat('tooth dull', '#98a4b0', 0.4, 0.32)            # alternate teeth
HOT = mat('hot edge', '#ff9628', 0.0, 0.4, 1.4)             # cutting edge, drill core, flame
ARM_HI = mat('arm highlight', '#5f6875', 0.15, 0.4)          # arm strip, joints #5a636e, rollers #565f6a
COIL = mat('magnet coil', '#78dcff', 0.0, 0.3, 1.3)         # rgba(120,220,255)
REFINERY = mat('refinery line', '#78f0be', 0.0, 0.35, 0.9)  # rgba(120,240,190)
LAMP = mat('warning lamp', '#ffbe28', 0.0, 0.3, 1.4)        # drawLights amber
BEACON = mat('roof beacon', '#ff503c', 0.0, 0.3, 1.4)       # rgba(255,80,60)

# The ground, materials.js + terrain.js.
WALL = mat('mine wall', '#38333d', 0.0, 0.9)                # terrain.js wallPattern fallback


def ramp(label, colours, metal, rough, glow):
    """materials.js `colors` [base, shadow, highlight] as three materials."""
    base, shadow, hi = colours
    return (mat(label + ' shadow', shadow, metal, rough + 0.1),
            mat(label, base, metal, rough, 0.3 if glow else 0.0),
            mat(label + ' highlight', hi, metal * 0.6, rough * 0.7, 1.1 if glow else 0.0))


# index = the material's row in materials.js, which seeds its silhouettes.
MINERALS = {
    'dirt':     dict(index=0, shape='round', ramp=ramp('dirt', ('#7c5a3a', '#553c26', '#a07a52'), 0, .9, False)),
    'stone':    dict(index=1, shape='shard', ramp=ramp('stone', ('#6d737c', '#484d55', '#959ba4'), 0, .8, False)),
    'iron':     dict(index=2, shape='shard', ramp=ramp('iron ore', ('#9fadbb', '#6d7b8a', '#d6e2ec'), .45, .32, False)),
    'gold':     dict(index=3, shape='chunk', ramp=ramp('gold', ('#ffcb31', '#c9911a', '#fff3ab'), .5, .28, True)),
    'gem':      dict(index=4, shape='chunk', ramp=ramp('emerald', ('#33dd80', '#12a05a', '#a5ffce'), .1, .12, True)),
    'crystal':  dict(index=5, shape='shard', ramp=ramp('crystal', ('#48bcff', '#1f76cf', '#c2ecff'), .1, .1, True)),
    'rare':     dict(index=6, shape='chunk', ramp=ramp('voidstone', ('#c46bff', '#7c22cf', '#f3d4ff'), .2, .2, True)),
    'starcore': dict(index=9, shape='shard', ramp=ramp('starcore', ('#ff7ad9', '#b81f8e', '#ffe6fb'), .15, .15, True)),
}
# Dirt and stone are the base rock: a highlight material each would be two
# more draw calls for a facet the eye never finds at this distance, so their
# facet uses the base colour of the next-lighter rock instead.


# ---------------------------------------------------------------------------
# The game's sprite outlines: particles.js mulberry32() + buildSilhouette(),
# ported bit for bit (32-bit unsigned arithmetic throughout).
# ---------------------------------------------------------------------------

M32 = 0xFFFFFFFF


def mulberry32(seed):
    a = seed & M32

    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = ((a ^ (a >> 15)) * (1 | a)) & M32
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & M32)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return nxt


def silhouette(r_fn, shape):
    """buildSilhouette(rng, shape, 1): unit-radius outline, (x, y) pairs."""
    if shape == 'shard':
        n, sx, sy = 5, 1.28, 0.72
    elif shape == 'chunk':
        n, sx, sy = 7, 1.0, 1.0
    else:
        n, sx, sy = 9, 1.0, 1.0
    pts = []
    for i in range(n):
        a = (i / n) * math.tau + r_fn() * 0.22
        if shape == 'shard':
            rr = 0.52 + r_fn() * 0.72
        elif shape == 'chunk':
            rr = 0.74 + r_fn() * 0.40
        else:
            rr = 0.90 + r_fn() * 0.14
        pts.append((math.cos(a) * rr * sx, math.sin(a) * rr * sy))
    return pts


OUTLINES = {}
for key, m in MINERALS.items():
    # bakeAtlas(): one outline per (size bucket si 0..7, shade row sh 0..2).
    OUTLINES[key] = [silhouette(mulberry32(m['index'] * 7919 + si * 131 + sh * 17 + 1), m['shape'])
                     for si in range(8) for sh in range(3)]


# ---------------------------------------------------------------------------
# Geometry. Every piece is oriented and then dropped into its material's
# bucket; one mesh per material is written at the end.
# ---------------------------------------------------------------------------

BUCKETS = {}
TRIS = [0]


def add(material, verts, faces, orient='recalc', smooth=False):
    """
    `orient` decides which way each face points, because the game->Blender
    mapping is a mirror and hand-wound faces cannot be trusted:
      'recalc'          closed solid; let bmesh make it consistent and outward
      ('out', p)        convex open shell; away from game point p
      ('dir', d)        flat piece; toward game direction d
      ('axis', p, d)    surface of revolution; away from the line p + t*d
    """
    bm = bmesh.new()
    bv = [bm.verts.new(point(*v)) for v in verts]
    for f in faces:
        try:
            bm.faces.new([bv[i] for i in f])
        except ValueError:
            pass
    bm.normal_update()
    if orient == 'recalc':
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    else:
        kind = orient[0]
        if kind == 'out':
            p0 = point(*orient[1])
        elif kind == 'dir':
            d0 = vec(*orient[1])
        else:
            p0, d0 = point(*orient[1]), vec(*orient[2]).normalized()
        for f in bm.faces:
            c = f.calc_center_median()
            if kind == 'out':
                want = c - p0
            elif kind == 'dir':
                want = d0
            else:
                rel = c - p0
                want = rel - d0 * rel.dot(d0)
            if f.normal.dot(want) < 0:
                f.normal_flip()
    bm.verts.index_update()
    b = BUCKETS.setdefault(material.name, dict(mat=material, v=[], f=[], s=[]))
    base = len(b['v'])
    b['v'].extend(v.co.copy() for v in bm.verts)
    for f in bm.faces:
        b['f'].append([base + v.index for v in f.verts])
        b['s'].append(smooth)
        TRIS[0] += len(f.verts) - 2
    bm.free()


def obox(material, c, U, V, N, size):
    """A box centred at c with axes U, V, N (game vectors) and full size."""
    c, U, V, N = Vector(c), Vector(U).normalized(), Vector(V).normalized(), Vector(N).normalized()
    hu, hv, hn = size[0] / 2, size[1] / 2, size[2] / 2
    verts = []
    for sn in (-1, 1):
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(tuple(c + U * su * hu + V * sv * hv + N * sn * hn))
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    add(material, verts, faces)


def box(material, c, size, yaw=0.0):
    """Axis box in game space (size = x, y, z), optionally turned about y."""
    cy, sy = math.cos(yaw), math.sin(yaw)
    obox(material, c, (cy, 0, -sy), (sy, 0, cy), (0, 1, 0), (size[0], size[2], size[1]))


def span(material, x0, x1, y0, y1, z0, z1):
    box(material, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)))


def ring_points(c, U, V, r, n, phase=0.0):
    return [tuple(Vector(c) + (Vector(U) * math.cos(phase + i / n * math.tau) +
                               Vector(V) * math.sin(phase + i / n * math.tau)) * r) for i in range(n)]


def basis(d):
    d = Vector(d).normalized()
    ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
    u = d.cross(ref).normalized()
    return u, d.cross(u).normalized()


def tube(material, a, b, r0, r1=None, sides=12, caps=True, smooth=True):
    """A (possibly tapered) cylinder between two game points. Caps are their
    own vertices so smooth sides do not average into flat ends."""
    r1 = r0 if r1 is None else r1
    A, B = Vector(a), Vector(b)
    d = B - A
    if d.length < 1e-6:
        return
    u, v = basis(d)
    ra, rb = ring_points(A, u, v, r0, sides), ring_points(B, u, v, r1, sides)
    faces = [[i, (i + 1) % sides, sides + (i + 1) % sides, sides + i] for i in range(sides)]
    add(material, ra + rb, faces, ('axis', tuple(A), tuple(d)), smooth)
    if caps:
        add(material, ra, [list(range(sides))], ('dir', tuple(-d)))
        if r1 > 0.002:
            add(material, rb, [list(range(sides))], ('dir', tuple(d)))


def cone(material, a, b, r, sides=16, smooth=True):
    A, B = Vector(a), Vector(b)
    d = B - A
    u, v = basis(d)
    ra = ring_points(A, u, v, r, sides)
    faces = [[i, (i + 1) % sides, sides] for i in range(sides)]
    add(material, ra + [tuple(B)], faces, ('out', tuple(A + d * 0.3)), smooth)
    add(material, ra, [list(range(sides))], ('dir', tuple(-d)))


def ball(material, c, r, squash=(1, 1, 1), subdiv=1, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1)
    verts = [(c[0] + v.co.x * r * squash[0], c[1] + v.co.z * r * squash[1], c[2] + v.co.y * r * squash[2])
             for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    add(material, verts, faces, ('out', c), smooth)


def torus(material, c, R, r, segs=18, sides=6):
    verts, faces = [], []
    for i in range(segs):
        a = i / segs * math.tau
        ca, sa = math.cos(a), math.sin(a)
        for j in range(sides):
            b = j / sides * math.tau
            rr = R + r * math.cos(b)
            verts.append((c[0] + rr * ca, c[1] + r * math.sin(b), c[2] + rr * sa))
    for i in range(segs):
        for j in range(sides):
            i2, j2 = (i + 1) % segs, (j + 1) % sides
            faces.append([i * sides + j, i2 * sides + j, i2 * sides + j2, i * sides + j2])
    add(material, verts, faces, 'recalc', True)


def prism(material, plan, y0, y1):
    """A vertical prism over a game-space (x, z) outline."""
    n = len(plan)
    verts = [(x, y0, z) for x, z in plan] + [(x, y1, z) for x, z in plan]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    add(material, verts, faces)


def flat(material, pts, normal=(0, 1, 0)):
    """A flat polygon (decal) facing `normal`."""
    add(material, pts, [list(range(len(pts)))], ('dir', normal))


# ---------------------------------------------------------------------------
# Deposits. A lump is a sprite with depth: rings of the game outline at rising
# heights, banded shadow -> base, capped, with the highlight facet on top.
# ---------------------------------------------------------------------------

def frame_of(N):
    N = Vector(N).normalized()
    U, V = basis(N)
    return U, V, N


def lump(key, O, N, r, h, rings, facet=0.36, outline=None, turn=0.0, smooth=False,
         band_mats=None, cap=None, facet_mat=None):
    """
    `rings` = [(scale, height fraction)] from the buried foot to the top.
    `band_mats` colours each band between rings (defaults: shadow, then base),
    `cap` the top, `facet_mat` the specular facet (None for no facet).
    """
    shadow, base, hi = MINERALS[key]['ramp']
    pts = outline or rng.choice(OUTLINES[key])
    U, V, N = frame_of(N)
    ct, st = math.cos(turn), math.sin(turn)
    pts = [(x * ct - y * st, x * st + y * ct) for x, y in pts]
    O = Vector(O)
    n = len(pts)

    def ring(scale, frac, off=(0, 0)):
        return [tuple(O + U * ((x * scale + off[0]) * r) + V * ((y * scale + off[1]) * r) + N * (frac * h))
                for x, y in pts]
    levels = [ring(s, f) for s, f in rings]
    band_mats = band_mats or [shadow] + [base] * (len(rings) - 2)
    centre = tuple(O + N * (h * 0.35))
    for k in range(len(levels) - 1):
        verts = levels[k] + levels[k + 1]
        faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
        # the buried foot band is smooth on every lump: it is the rim stroke,
        # it is mostly underground, and smooth it costs half the vertices
        add(band_mats[k], verts, faces, ('out', centre), smooth or k == 0)
    add(cap or base, levels[-1], [list(range(n))], ('dir', tuple(N)))
    if facet_mat is not False:
        fm = facet_mat or hi
        # bakeAtlas(): the polygon again, turned +0.4 rad, scaled 0.46 and set
        # (-0.24r, -0.28r) toward the light. Shrunk a little more here so it
        # stays on the cap, and lifted 5 mm so it never shares the cap's plane.
        c4, s4 = math.cos(0.4), math.sin(0.4)
        top_s = rings[-1][0]
        fp = [(x * c4 - y * s4, x * s4 + y * c4) for x, y in pts]
        verts = [tuple(O + U * ((x * facet * top_s - 0.10 * top_s) * r) + V * ((y * facet * top_s - 0.12 * top_s) * r)
                       + N * (h + 0.005)) for x, y in fp]
        add(fm, verts, [list(range(n))], ('dir', tuple(N)))


def spike(key, O, D, r, length, outline=None, turn=0.0):
    """
    A shard standing up: the game's shard outline as the cross-section,
    tapering to a point. Alternate faces take the shadow colour so it reads
    as facets; the tip facets take the highlight.
    """
    shadow, base, hi = MINERALS[key]['ramp']
    pts = outline or rng.choice(OUTLINES[key])
    U, V, N = frame_of(D)
    ct, st = math.cos(turn), math.sin(turn)
    pts = [(x * ct - y * st, x * st + y * ct) for x, y in pts]
    O = Vector(O)
    n = len(pts)
    foot = [tuple(O + (U * x + V * y) * r * 0.9 - N * 0.03) for x, y in pts]
    shoulder = [tuple(O + (U * x + V * y) * r + N * (length * 0.72)) for x, y in pts]
    tip = tuple(O + N * length + (U * pts[0][0] + V * pts[0][1]) * r * 0.12)
    centre = tuple(O + N * (length * 0.4))
    for i in range(n):
        j = (i + 1) % n
        add(base if i % 2 == 0 else shadow, [foot[i], foot[j], shoulder[j], shoulder[i]],
            [[0, 1, 2, 3]], ('out', centre))
        add(hi if i % 2 == 0 else base, [shoulder[i], shoulder[j], tip], [[0, 1, 2]], ('out', centre))


def ore(key, O, N, r, style=None):
    """One deposit of `key`, in that mineral's own 3D form."""
    shadow, base, hi = MINERALS[key]['ramp']
    N = Vector(N)
    turn = rng.uniform(0, math.tau)
    if key == 'iron':
        # Fracture / shard, metallic, no glow: thin angular plates.
        lump(key, O, N, r, r * 0.34, [(0.92, -0.25), (1.0, 0.4), (0.84, 1.0)], turn=turn)
    elif key == 'gold':
        # Burst / chunk, heavy, rolls less: a rounded nugget.
        lump(key, O, N, r, r * 0.74, [(0.72, -0.2), (1.0, 0.36), (0.8, 0.8), (0.44, 1.0)],
             facet=0.5, turn=turn, smooth=True, band_mats=[shadow, base, base])
    elif key == 'gem':
        # Burst / chunk, bouncy and bright: a cut stone, pavilion and crown.
        lump(key, O, N, r, r * 0.95, [(0.30, -0.15), (1.0, 0.42), (0.95, 0.55), (0.6, 1.0)],
             facet=0.62, turn=turn, band_mats=[shadow, base, base])
    elif key == 'rare':
        # Voidstone: a dark rind and a lit top, like a geode broken open.
        lump(key, O, N, r, r * 0.82, [(0.78, -0.2), (1.0, 0.3), (0.94, 0.72), (0.62, 1.0)],
             facet=0.55, turn=turn, band_mats=[shadow, shadow, shadow], cap=base, smooth=True)
    elif key == 'crystal':
        # Fracture into sharp splinters: upright prisms.
        spike(key, O, N, r * 0.38, r * rng.uniform(1.8, 2.6), turn=turn)
    elif key == 'starcore':
        # Shatter, the loudest style in the table: a full burst of shards.
        U, V, Nn = frame_of(N)
        ball(hi, tuple(Vector(O) + Nn * r * 0.3), r * 0.28, subdiv=0, smooth=False)
        k = 5
        for i in range(k):
            a = i / k * math.tau + turn
            d = (U * math.cos(a) + V * math.sin(a)) * 0.9 + Nn * rng.uniform(0.25, 0.75)
            spike(key, tuple(Vector(O) + Nn * r * 0.3), tuple(d), r * 0.22, r * rng.uniform(1.0, 1.4))
        spike(key, tuple(Vector(O) + Nn * r * 0.3), tuple(Nn), r * 0.24, r * 1.5)
    else:
        rock(key, O, N, r)


def rock(key, O, N, r, h=None):
    """Base rock: a low lump without a highlight material (see MINERALS)."""
    facet = MINERALS['iron']['ramp'][0]
    outline = rng.choice(OUTLINES[key])
    if key == 'dirt':
        # The game's 'round' is a 9-gon at 0.90..1.04 radius — near enough a
        # circle that seven of its corners draw the same lump for 20% less.
        outline = [p for i, p in enumerate(outline) if i not in (2, 6)]
    lump(key, O, N, r, h or r * (0.42 if key == 'dirt' else 0.55),
         [(0.86, -0.4), (1.0, 0.35), (0.7, 1.0)], facet=0.34, outline=outline, turn=rng.uniform(0, math.tau),
         facet_mat=facet if key == 'stone' else False, smooth=True)
    # smooth sides: bakeAtlas() lights the body with a gradient, not facets,
    # and a smooth band shares its vertices — the bank is most of the file.


# ===========================================================================
# THE RIG
# ===========================================================================

BX0, BX1, BZ0, BZ1 = 20.3, 26.6, -5.95, -1.8   # the bank (see THE BANK)
S = 0.0175            # metres per game world unit
RX, RZ = 17.05, -3.3  # chassis centre; the rig faces +x
BL = 158              # config VEHICLE_BODY_LENGTH
BW = 110              # VEHICLE_BODY_WIDTH 96, widened by the upgrades' xBody
TREADS = 1
TW = 24 + 9 * TREADS  # trackWidth()
HH = BW / 2 + TW - 2  # hullHalf()


def R(lx, ly, h):
    """vehicle.js local space (x right, -y forward, world units) + a height in
    metres, to game coordinates. Forward is +x; the rig's right is -z."""
    return (RX - ly * S, FLOOR + h, RZ - lx * S)


FWD = (1, 0, 0)
RIGHT = (0, 0, -1)
UP = (0, 1, 0)


def rbox(material, lx0, lx1, ly0, ly1, h0, h1):
    a, b = R(lx0, ly0, h0), R(lx1, ly1, h1)
    span(material, a[0], b[0], a[1], b[1], a[2], b[2])


# --- tracks: drawTracks() ---------------------------------------------------
TL = BL * 0.98 * S          # shoe length, metres
TRACK_H = 0.66              # belt height (invented)
CLEAT_T = 0.045
for side in (-1, 1):
    lx = side * (BW / 2 + TW / 2 - 2)
    wc = lx * S                       # lateral centre, metres (right +)
    half = TW * S / 2
    rr = TRACK_H / 2
    yc = CLEAT_T + rr
    ends = (TL / 2 - rr, -(TL / 2 - rr))

    def tframe(f, h, w):
        return (RX + f, FLOOR + h, RZ - w)
    outline = []
    for k in range(13):                 # front semicircle, then rear
        a = -math.pi / 2 + k / 12 * math.pi
        outline.append((ends[0] + rr * math.cos(a), yc + rr * math.sin(a)))
    for k in range(13):
        a = math.pi / 2 + k / 12 * math.pi
        outline.append((ends[1] + rr * math.cos(a), yc + rr * math.sin(a)))
    n = len(outline)
    verts = [tframe(f, h, wc - half + 0.02) for f, h in outline] + [tframe(f, h, wc + half - 0.02) for f, h in outline]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    add(TRACK, verts, faces)
    # Cleats every 11 + 2*treads world units around the loop, as the game
    # scrolls them, standing proud of the shoe so the loop reads in profile.
    perim = 2 * (ends[0] - ends[1]) + 2 * math.pi * rr
    pitch = (11 + 2 * TREADS) * S * 1.6
    count = int(perim / pitch)
    for k in range(count):
        s_ = k * perim / count
        top_len = ends[0] - ends[1]
        if s_ < top_len:                      # top run, front -> rear
            p, t = (ends[0] - s_, yc + rr), (-1, 0)
        elif s_ < top_len + math.pi * rr:     # rear wrap
            a = math.pi / 2 + (s_ - top_len) / rr
            p, t = (ends[1] + rr * math.cos(a), yc + rr * math.sin(a)), (-math.sin(a), math.cos(a))
        elif s_ < 2 * top_len + math.pi * rr:  # bottom run
            p, t = (ends[1] + (s_ - top_len - math.pi * rr), yc - rr), (1, 0)
        else:
            a = -math.pi / 2 + (s_ - 2 * top_len - math.pi * rr) / rr
            p, t = (ends[0] + rr * math.cos(a), yc + rr * math.sin(a)), (-math.sin(a), math.cos(a))
        # outward normal: away from the nearest point on the loop's spine
        out = Vector((p[0] - max(min(p[0], ends[0]), ends[1]), p[1] - yc)).normalized()
        centre = (RX + p[0] + out.x * CLEAT_T / 2, FLOOR + p[1] + out.y * CLEAT_T / 2, RZ - wc)
        obox(CLEAT, centre, (t[0], t[1], 0), (0, 0, 1), (out.x, out.y, 0), (0.1, TW * S + 0.03, CLEAT_T))
    # Drive sprockets at both ends and the road wheels HEAVY TREADS adds.
    wo = side * (abs(wc) + half)
    for f in ends:
        a, b = (RX + f, FLOOR + yc, RZ - wo), (RX + f, FLOOR + yc, RZ - wo - side * 0.03)
        tube(HOPPER, a, b, 0.24, sides=16)
        tube(DRUM, b, (b[0], b[1], b[2] - side * 0.02), 0.08, sides=10)
    nwheels = 2 + TREADS
    for k in range(nwheels):
        frac = 0.24 + 0.52 * (k / max(1, nwheels - 1))
        f = TL / 2 - TL * frac
        a, b = (RX + f, FLOOR + CLEAT_T + 0.2, RZ - wo), (RX + f, FLOOR + CLEAT_T + 0.2, RZ - wo - side * 0.03)
        tube(CABIN, a, b, 0.17, sides=14)
        tube(DRUM, b, (b[0], b[1], b[2] - side * 0.015), 0.055, sides=8)
    # A fender over each shoe: the chassis overlaps the tracks by TRACK_INSET
    # in the sprite, and this is where the warning lamps and arm mounts sit.
    rbox(CHASSIS_LO, side * (BW / 2 - 2), side * (HH - 0.5), -BL * 0.47, BL * 0.47,
         TRACK_H + CLEAT_T + 0.005, TRACK_H + CLEAT_T + 0.045)
TRACK_TOP = TRACK_H + CLEAT_T + 0.045    # fender top

# --- chassis + cabin: drawChassis() ------------------------------------------
DECK = 0.98
rbox(OUTLINE, -BW / 2 - 1, BW / 2 + 1, -BL / 2 - 1, BL / 2 + 1, 0.27, 0.36)
rbox(CHASSIS, -BW / 2, BW / 2, -BL / 2, BL / 2, 0.30, DECK)
# The gradient's bright band (0.35 across) as a raised plate, and its shaded
# edges as the side skirts.
rbox(CHASSIS_HI, -40, 8, -BL / 2 + 3, BL / 2 - 3, DECK, DECK + 0.008)
for side in (-1, 1):
    rbox(CHASSIS_LO, side * (BW / 2 - 6), side * (BW / 2 + 0.6), -BL / 2 + 2, BL / 2 - 2, 0.40, DECK - 0.04)
# Panel seams every 22 units from -bl/4.
p_ = -BL * 0.25
while p_ < BL * 0.5:
    rbox(OUTLINE, -BW / 2 + 1, BW / 2 - 1, p_ - 0.75, p_ + 0.75, DECK, DECK + 0.014)
    p_ += 22
# Hazard stripes across the nose: a dark band and the game's parallelograms.
rbox(OUTLINE, -BW / 2 + 1, BW / 2 - 1, -BL / 2 + 2, -BL / 2 + 21, DECK, DECK + 0.014)
sy = -BL / 2 + 6
sx = -BW / 2 - 14
while sx < BW / 2 + 14:
    quad = [(sx, sy), (sx + 9, sy), (sx + 20, sy + 13), (sx + 11, sy + 13)]
    quad = [(max(-BW / 2 + 1.5, min(BW / 2 - 1.5, x)), y) for x, y in quad]
    if quad[1][0] - quad[0][0] > 0.5 or quad[2][0] - quad[3][0] > 0.5:
        flat(HAZARD, [R(x, y, DECK + 0.020) for x, y in quad])
    sx += 18
# Refinery plumbing (ORE REFINERY): parts.refinery + 1 zigzag lines.
for rq in range(2):
    ry = -BL * 0.1 + rq * 14
    pts = [(-BW * 0.42, ry), (-BW * 0.1, ry + 8), (BW * 0.1, ry - 8), (BW * 0.42, ry)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        tube(REFINERY, R(x0, y0, DECK + 0.03), R(x1, y1, DECK + 0.03), 0.022, sides=8)
    for x0, y0 in (pts[0], pts[-1]):
        tube(DRUM, R(x0, y0, DECK), R(x0, y0, DECK + 0.07), 0.04, sides=8)
# Pistons that pump with the drum, on the forward deck.
for side in (-1, 1):
    lx = side * BW * 0.31
    tube(DARK, R(lx, -21, DECK + 0.075), R(lx, -47, DECK + 0.075), 0.07, sides=12)
    tube(DRUM, R(lx, -47, DECK + 0.075), R(lx, -66, DECK + 0.06), 0.038, sides=10)
    rbox(DARK, lx - 4, lx + 4, -19, -24, DECK, DECK + 0.15)
# Cabin: #3d444c with the cyan glass, here as a glazed cab on the deck.
CAB = (-BW * 0.26, BW * 0.26, -8, 28)
rbox(CABIN, CAB[0], CAB[1], CAB[2], CAB[3], DECK, 1.80)
rbox(OUTLINE, CAB[0] - 1.2, CAB[1] + 1.2, CAB[2] - 1.2, CAB[3] + 1.2, 1.80, 1.84)
rbox(OUTLINE, CAB[0] - 1.0, CAB[1] + 1.0, CAB[2] - 1.0, CAB[3] + 1.0, DECK, DECK + 0.06)
fx = R(0, CAB[2], 0)[0]
span(GLASS, fx, fx + 0.012, FLOOR + 1.26, FLOOR + 1.70, RZ - CAB[1] * S + 0.08, RZ - CAB[0] * S - 0.08)
rx_ = R(0, CAB[3], 0)[0]
span(GLASS, rx_ - 0.012, rx_, FLOOR + 1.40, FLOOR + 1.70, RZ - 0.3, RZ + 0.3)
for side in (-1, 1):
    zc = RZ - side * CAB[1] * S
    span(GLASS, R(0, CAB[2] + 4, 0)[0], R(0, CAB[3] - 4, 0)[0], FLOOR + 1.26, FLOOR + 1.70, zc, zc - side * 0.012)
    # grab rail and step up from the fender
    tube(DRUM, R(side * (CAB[1] + 2), CAB[2] + 6, 1.05), R(side * (CAB[1] + 2), CAB[2] + 6, 1.6), 0.016, sides=6)
rbox(GLASS, -BW * 0.2, BW * 0.2, 12, 25, 1.84, 1.848)
# The rotating beacon the cabin roof gets once upgradeCount >= 4.
tube(DARK, R(0, 4, 1.84), R(0, 4, 1.90), 0.065, sides=12)
ball(BEACON, R(0, 4, 1.95), 0.075, squash=(1, 1.2, 1))
tube(DARK, R(0, 4, 2.02), R(0, 4, 2.04), 0.05, sides=10)

# --- warning lights: drawLights(), three a side at ten upgrades ---------------
for side in (-1, 1):
    for i in range(3):
        ly = -BL * 0.5 + 16 + i * 40
        c = R(side * (HH + 2), ly, TRACK_TOP + 0.03)
        box(OUTLINE, c, (0.12, 0.06, 0.12))
        ball(LAMP, (c[0], c[1] + 0.05, c[2]), 0.05, squash=(1, 0.9, 1))

# --- rear hopper: drawHopper() -----------------------------------------------
HOP = 34 + 17 * 1                         # hopperLen() at hopper level 1
hy0, hy1 = BL * 0.32, BL * 0.5 + HOP
hw0, hw1 = BW * 0.86 / 2, BW * (1.02 + 0.10) / 2
HOP_B, HOP_T = 0.72, 1.46


def hop_plan(t, s):
    """A point on the hopper's trapezoid: t 0 front .. 1 rear, s -1 .. 1."""
    return (s * (hw0 + (hw1 - hw0) * t), hy0 + (hy1 - hy0) * t)


plan = [R(*hop_plan(0, -1), 0), R(*hop_plan(0, 1), 0), R(*hop_plan(1, 1), 0), R(*hop_plan(1, -1), 0)]
prism(HOPPER, [(p[0], p[2]) for p in plan], FLOOR + HOP_B, FLOOR + HOP_B + 0.06)
WALL_T = 4.0


def hop_wall(material, a, b, h0, h1):
    """A wall slab of thickness WALL_T units inside the edge a -> b (local)."""
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * WALL_T, dx / L * WALL_T
    quad = [a, b, (bx + nx, by + ny), (ax + nx, ay + ny)]
    pts = [R(x, y, 0) for x, y in quad]
    prism(material, [(p[0], p[2]) for p in pts], FLOOR + h0, FLOOR + h1)


fl, fr, rr_, rl = hop_plan(0, -1), hop_plan(0, 1), hop_plan(1, 1), hop_plan(1, -1)
hop_wall(HOPPER, fl, fr, HOP_B, HOP_T)       # this winding puts each slab inside its edge
hop_wall(HOPPER, fr, rr_, HOP_B, HOP_T)
hop_wall(HOPPER, rl, fl, HOP_B, HOP_T)
hop_wall(DARK, rr_, rl, HOP_B, HOP_T)        # gHopper runs dark toward the rear
# The rim and ribs in the lighter arm steel: the game strokes them dark, but
# a dark line on a dark wall is invisible once the page becomes a solid.
for a, b in ((fr, fl), (fl, rl), (rl, rr_), (rr_, fr)):
    ax, ay = a
    bx, by = b
    tube(ARM_HI, R(ax, ay, HOP_T), R(bx, by, HOP_T), 0.035, sides=6)
# Ribs: 3 + hopper level sections, here as stiffeners down the side walls.
ribs = 3 + 1
for i in range(1, ribs):
    t = i / ribs
    for s in (-1, 1):
        x, y = hop_plan(t, s)
        tube(ARM_HI, R(x + s * 1.5, y, HOP_B), R(x + s * 1.5, y, HOP_T), 0.03, sides=6)
# The load: what the magnet has been bringing in, mostly gold, glowing.
rbox(DARK, -hw0 + 4, hw0 - 4, hy0 + 4, hy1 - 6, HOP_B, 1.24)
for i in range(18):
    t = rng.uniform(0.08, 0.92)
    s = rng.uniform(-0.82, 0.82)
    x, y = hop_plan(t, s)
    c = R(x, y, 1.26 + (1 - abs(s)) * 0.16 + (1 - abs(2 * t - 1)) * 0.08)
    key = rng.choices(['gold', 'iron', 'gem'], [7, 2, 2])[0]
    ore(key, c, (rng.uniform(-.3, .3), 1, rng.uniform(-.3, .3)), rng.uniform(0.11, 0.17))
# Overflow funnels on the hopper shoulders (hopper level > 0).
for s in (-1, 1):
    quad = [(s * hw0, hy0 + 6), (s * (hw1 + 16), hy0 + 20), (s * (hw1 + 16), hy0 + 40), (s * hw0 * 1.04, hy0 + 30)]
    pts = [R(x, y, 0) for x, y in quad]
    prism(CABIN, [(p[0], p[2]) for p in pts], FLOOR + 1.22, FLOOR + 1.29)
    a, b = R(*quad[1], 1.29), R(*quad[2], 1.29)
    tube(OUTLINE, a, b, 0.025, sides=6)
    tube(DARK, R(s * (hw1 + 12), hy0 + 30, 1.22), R(s * (hw1 + 4), hy0 + 30, 0.80), 0.03, sides=6)

# --- rear conveyor: drawConveyor() --------------------------------------------
cy0 = BL * 0.5 + HOP - 4
CLEN = 56
cy1 = cy0 + CLEN
cw = BW * 1.06 / 2
H_FRONT, H_REAR = 0.68, 0.24


def belt_h(ly):
    t = (ly - cy0) / (cy1 - cy0)
    return H_FRONT + (H_REAR - H_FRONT) * t


slope = (H_REAR - H_FRONT) / (CLEN * S)
along = Vector((-1, slope, 0)).normalized()          # rearward, down the belt
bn = Vector((slope, 1, 0)).normalized()              # belt normal (upward)
mid = Vector(R(0, (cy0 + cy1) / 2, (H_FRONT + H_REAR) / 2))
blen = math.hypot(CLEN * S, H_FRONT - H_REAR)
obox(DARK, tuple(mid - bn * 0.03), tuple(along), (0, 0, 1), tuple(bn), (blen, cw * 2 * S, 0.06))
for s in (-1, 1):
    side_c = mid + Vector((0, 0, -s * (cw + 2.5) * S)) + bn * 0.01
    obox(CABIN, tuple(side_c), tuple(along), (0, 0, 1), tuple(bn), (blen + 0.06, 0.06, 0.13))
for ly in (cy0 + 6, cy1 - 6):
    tube(ARM_HI, R(-cw - 4, ly, belt_h(ly) - 0.06), R(cw + 4, ly, belt_h(ly) - 0.06), 0.085, sides=12)
# Chevrons scrolling toward the hopper, painted 6 mm proud of the belt.
pitch = 20
yy = cy1 - 6
while yy > cy0 + 4:
    for s in (-1, 1):
        a0, a1 = (s * (cw - 4), yy + 8), (0, yy)
        dx, dy = a1[0] - a0[0], a1[1] - a0[1]
        L = math.hypot(dx, dy)
        ox, oy = -dy / L * 2, dx / L * 2
        quad = [(a0[0] + ox, a0[1] + oy), (a1[0] + ox, a1[1] + oy), (a1[0] - ox, a1[1] - oy), (a0[0] - ox, a0[1] - oy)]
        flat(HAZARD, [tuple(Vector(R(x, y, belt_h(y))) + bn * 0.006) for x, y in quad], tuple(bn))
    yy -= pitch
# Side scoops funnelling the trail in, and the skids the tail rides on.
for s in (-1, 1):
    reach = 36
    edge = [(s * cw, cy0 + CLEN * 0.15), (s * (cw + reach), cy0 + CLEN * 0.75), (s * (cw + reach), cy1)]
    for (x0, y0), (x1, y1) in zip(edge, edge[1:]):
        a, b = R(x0, y0, 0), R(x1, y1, 0)
        d = Vector(b) - Vector(a)
        c = (Vector(a) + Vector(b)) / 2
        # a low blade on the ground, its top edge picked out so it reads
        obox(DARK, (c.x, FLOOR + 0.10, c.z), tuple(d), (0, 1, 0), tuple(d.cross(Vector((0, 1, 0)))),
             (d.length, 0.18, 0.03))
        tube(ARM_HI, (a[0], FLOOR + 0.19, a[2]), (b[0], FLOOR + 0.19, b[2]), 0.02, sides=6)
    # the arm that carries the scoop off the belt frame
    tube(CABIN, R(s * cw, cy0 + CLEN * 0.3, belt_h(cy0 + CLEN * 0.3) - 0.04),
         R(s * (cw + reach * 0.6), cy0 + CLEN * 0.6, 0.19), 0.03, sides=6)
    rbox(DARK, s * (cw - 8), s * (cw - 2), cy1 - 14, cy1 - 4, 0.0, belt_h(cy1 - 9) - 0.05)
    tube(DARK, R(s * (cw - 4), cy0 + 2, HOP_B), R(s * (cw - 4), cy0 + 10, belt_h(cy0 + 10) - 0.05), 0.04, sides=6)

# --- magnetic collector arms: drawMagnetArms(), part-unfolded -----------------
ARM_DEPLOY = 0.4     # easeOutBack(deploy) mid-swing; fully open they overhang the deck
reach = (50 + 68) * ARM_DEPLOY
for s in (-1, 1):
    base_y = BL * 0.12
    B = R(s * HH * 0.8, base_y, TRACK_TOP + 0.22)
    E = R(s * (HH + reach * 0.45), base_y + 20, 1.34)
    T = R(s * (HH + reach), base_y + 54, 1.08)
    rbox(DARK, s * (HH * 0.8 - 7), s * (HH * 0.8 + 7), base_y - 7, base_y + 7, TRACK_TOP, TRACK_TOP + 0.24)
    for a, b in ((B, E), (E, T)):
        tube(CABIN, a, b, 0.10, sides=10)
        tube(ARM_HI, (a[0], a[1] + 0.085, a[2]), (b[0], b[1] + 0.085, b[2]), 0.04, sides=8)
    ball(ARM_HI, E, 0.13)
    ball(ARM_HI, B, 0.11)
    # The coil: a puck hanging from the tip with its cyan ring, as the game
    # strokes it at the arm's end.
    tube(DARK, T, (T[0], FLOOR + 0.66, T[2]), 0.035, sides=8)
    tube(ARM_HI, (T[0], FLOOR + 0.66, T[2]), (T[0], FLOOR + 0.52, T[2]), 0.24, sides=20)
    tube(DARK, (T[0], FLOOR + 0.52, T[2]), (T[0], FLOOR + 0.47, T[2]), 0.18, sides=16)
    torus(COIL, (T[0], FLOOR + 0.59, T[2]), 0.30, 0.028)
    torus(COIL, (T[0], FLOOR + 0.49, T[2]), 0.22, 0.02, segs=14, sides=5)

# --- side grinders: drawGrinders() ---------------------------------------------
GR = 30
for s in (-1, 1):
    gx = s * (HH + GR * 1.15)
    gy = -BL * 0.16
    a, b = R(s * HH * 0.7, gy - 8, TRACK_TOP + 0.06), R(gx, gy, TRACK_TOP + 0.06)
    tube(CABIN, a, b, 0.095, sides=10)
    tube(DARK, R(gx, gy, 0.33), R(gx, gy, TRACK_TOP + 0.14), 0.12, sides=14)
    tube(HOPPER, R(gx, gy, 0.25), R(gx, gy, 0.33), GR * S, sides=22)
    tube(OUTLINE, R(gx, gy, 0.235), R(gx, gy, 0.255), GR * S * 0.96, sides=22)
    tube(DRUM, R(gx, gy, 0.33), R(gx, gy, 0.37), GR * S * 0.32, sides=16)
    for t in range(8):
        ang = t / 8 * math.tau
        r0, r1 = (GR - 7) * S, (GR + 5) * S
        cx, cz = (r0 + r1) / 2 * math.cos(ang), (r0 + r1) / 2 * math.sin(ang)
        c = R(gx, gy, 0.29)
        obox(TOOTH_A, (c[0] + cx, c[1], c[2] + cz), (math.cos(ang), 0, math.sin(ang)), (-math.sin(ang), 0, math.cos(ang)),
             (0, 1, 0), (r1 - r0, 4 * S, 0.05))
    # sparks under load, where the disc meets the rock
    for k in range(3):
        c = R(gx + rng.uniform(-6, 6), gy - GR * 0.9, 0.3 + rng.uniform(0, 0.15))
        ball(HOT, c, 0.025 + 0.01 * k, subdiv=0, smooth=False)

# --- front cutting blade: drawBlade() --------------------------------------------
TIER = 1
BLADE_W = 270                       # 140 x the blade upgrades, kept off the deck edge
halfW = BLADE_W / 2
thick = 24 + 4 * TIER
frontY = -BL / 2 - 20               # blade bar centre line
DRUM_R, DRUM_H = 0.26, 0.42
dc = Vector(R(0, frontY, DRUM_H))
axis_a, axis_b = Vector(R(-halfW, frontY, DRUM_H)), Vector(R(halfW, frontY, DRUM_H))
tube(DRUM, tuple(axis_a), tuple(axis_b), DRUM_R, sides=24)
# The amber diagonal bands that make the drum read as spinning: a three-start
# helix, one band per 20-unit pitch, 8 units wide, as the stripes are.
for k in range(3):
    verts, faces = [], []
    steps = 80
    w0, w1 = -halfW * S, halfW * S
    band = 8 * S * 1.4
    for i in range(steps + 1):
        w = w0 + (w1 - w0) * i / steps
        for dw in (0, band):
            th = w / 0.98 * math.tau + k * math.tau / 3   # one turn per 2 x thick
            ww = min(w1, w + dw)
            verts.append((dc.x + (DRUM_R + 0.006) * math.cos(th), dc.y + (DRUM_R + 0.006) * math.sin(th), RZ - ww))
    for i in range(steps):
        faces.append([2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2])
    add(HAZARD, verts, faces, ('axis', tuple(dc), (0, 0, 1)), True)
# Bearing hubs where the arms meet the drum, and the end housings.
for lx in (-halfW - 3, -127, -77.6, -63, 63, 77.6, 127, halfW + 3):
    w = 3.2 if abs(lx) < halfW else 5
    tube(HOPPER if abs(lx) < halfW else DARK, R(lx - w, frontY, DRUM_H), R(lx + w, frontY, DRUM_H),
         DRUM_R + 0.05, sides=16)
# Cutting teeth: n across the span, alternating bright and dull, longer for
# REINFORCED CUTTERS. The page shows the front row; the round needs the rest.
tooth_pitch = max(9, 15 - 2 * 1)
nt = min(90, max(3, round(BLADE_W / tooth_pitch)))
step = BLADE_W / nt
tooth_len = (11 + 3 * 1) * S
for row, (ang, scale, shift) in enumerate(((0.0, 1.0, 0.0), (1.0, 0.75, 0.5), (-1.0, 0.75, 0.5))):
    for i in range(nt):
        lx = -halfW + step * (i + 0.5 + shift)
        if lx > halfW - step * 0.3:
            continue
        if any(abs(lx - h) < 6 for h in (-127, -77.6, -63, 63, 77.6, 127)):
            continue
        radial = Vector((math.cos(ang), math.sin(ang), 0))
        tang = Vector((-math.sin(ang), math.cos(ang), 0))
        base_c = Vector((dc.x, dc.y, RZ - lx * S)) + radial * DRUM_R
        hw = step * 0.38 * S * scale
        bverts = [tuple(base_c + tang * a_ + Vector((0, 0, b_))) for a_, b_ in ((-hw, -hw), (hw, -hw), (hw, hw), (-hw, hw))]
        tip = tuple(base_c + radial * tooth_len * scale)
        add(TOOTH_A if (i + row) % 2 else TOOTH_B, bverts + [tip], [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]],
            ('out', tuple(base_c + radial * 0.02)))
# The hot cutting edge along the teeth, brighter under load.
tube(HOT, (dc.x + DRUM_R + 0.012, dc.y, RZ + (halfW - 2) * S),
     (dc.x + DRUM_R + 0.012, dc.y, RZ - (halfW - 2) * S), 0.012, sides=6)
# Support arms, splayed to the blade tips so a wide blade never floats, plus
# the one extra brace per blade tier.
for s in (-1, 1):
    tube(DARK, R(s * BW * 0.30, -BL / 2 + 10, 0.66), R(s * min(halfW - 10, BW * 0.30 + 30), frontY, DRUM_H), 0.10, sides=10)
    tube(HOPPER, R(s * BW * 0.46, -BL * 0.24, 0.86), R(s * (halfW - 8), frontY, DRUM_H), 0.07, sides=10)
    t_ = 1 / (TIER + 1)
    tube(CABIN, R(s * BW * 0.5, BL * 0.06, 0.62), R(s * halfW * (0.30 + t_ * 0.55), frontY, DRUM_H), 0.055, sides=8)

# --- rotary drill heads: drawDrills() ------------------------------------------------
baseR = 26 + 3 * TIER
dy = frontY - thick * 0.5 - baseR * 0.62 - 8
DRILL_H = 0.62
for s in (-1, 1):
    dx = s * halfW * 0.5
    hr = baseR * S
    # housing ring (#4d5661 with its #14171b stroke), then the bit itself
    h0, h1 = R(dx, dy + 2, DRILL_H), R(dx, dy - 5, DRILL_H)
    tube(DARK, h0, h1, hr * 0.8, sides=24)
    tube(OUTLINE, (h1[0] - 0.02, h1[1], h1[2]), (h1[0] + 0.005, h1[1], h1[2]), hr * 0.84, sides=24)
    tip = Vector(R(dx, dy - 5 - baseR * 1.24, DRILL_H))
    cb = Vector(h1)
    hr = hr * 0.8
    cone(HOPPER, tuple(cb), tuple(tip), hr * 0.92, sides=20)
    # Five spokes in the page, five spiral flutes in the round.
    L = (tip - cb).length
    for k in range(5):
        verts, faces = [], []
        steps = 14
        for i in range(steps + 1):
            t = i / steps
            rad = hr * 0.92 * (1 - t) + 0.01
            th = k / 5 * math.tau + t * math.tau * 0.9 * s
            ctr = cb + (tip - cb) * t
            for off, lift in ((-0.05, 0.0), (0.0, 0.035), (0.05, 0.0)):
                tt = th + off / max(rad, 0.05)
                verts.append((ctr.x, ctr.y + (rad + lift) * math.sin(tt), ctr.z + (rad + lift) * math.cos(tt)))
        for i in range(steps):
            a = 3 * i
            faces.append([a, a + 1, a + 4, a + 3])
            faces.append([a + 1, a + 2, a + 5, a + 4])
        add(TOOTH_A, verts, faces, ('axis', tuple(cb), (1, 0, 0)))
    # the hot core: the last few centimetres of the bit, white-hot orange
    core_b = cb + (tip - cb) * 0.82
    cone(HOT, tuple(core_b), tuple(tip + (tip - cb).normalized() * 0.01), hr * 0.92 * 0.2, sides=12)
    # mount: from the deck over the drum to the housing
    rbox(DARK, dx - 7, dx + 7, -BL / 2 + 6, dy, DECK, DECK + 0.13)
    rbox(DARK, dx - 4, dx + 4, dy + 3, dy - 3, DRILL_H + hr - 0.05, DECK + 0.13)

# --- exhaust stacks + smoke: drawExhaust(), 1 + stacks per side -----------------
for s in (-1, 1):
    for i in range(2):
        lx = s * (BW * 0.30 - i * 15)
        ly = BL * 0.32 - 6
        top = DECK + 0.78 + i * 0.18
        tube(DARK, R(lx, ly, DECK), R(lx, ly, top), 0.07, sides=14)
        tube(OUTLINE, R(lx, ly, top - 0.05), R(lx, ly, top + 0.005), 0.085, sides=14)
        tube(OUTLINE, R(lx, ly, DECK + 0.35), R(lx, ly, DECK + 0.40), 0.08, sides=14)
        tube(HOT, R(lx, ly, top - 0.03), R(lx, ly, top - 0.005), 0.058, sides=12)

# --- the collector field: two thin rings on the floor around the rig ------------
FIELD = Vector(R(0, BL * 0.22, 0))


def free_floor(x, z):
    if not (12.08 < x < 27.92 and -5.92 < z < 5.92):
        return False
    if x > BX0 - 0.05 and z < BZ1 + 0.05:            # under the bank
        return False
    return True


for radius in (2.55, 3.25):
    # drawCollectorField(): two thin rings, built as strips that break
    # wherever the floor is not free (under the bank, off the deck).
    n = 120
    run = []

    def flush(run):
        if len(run) < 2:
            return
        verts = []
        for a in run:
            for rr in (radius - 0.015, radius + 0.015):
                verts.append((FIELD.x + rr * math.cos(a), FLOOR + 0.007, FIELD.z + rr * math.sin(a)))
        faces = [[2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2] for i in range(len(run) - 1)]
        add(COIL, verts, faces, ('dir', (0, 1, 0)))
    for i in range(n + 1):
        a = i / n * math.tau
        if free_floor(FIELD.x + radius * math.cos(a), FIELD.z + radius * math.sin(a)):
            run.append(a)
        else:
            flush(run)
            run = []
    flush(run)

# ===========================================================================
# THE BANK: terrain.js ground, packed deposits with pockets and a vein
# ===========================================================================

BANK_H = 0.92
span(WALL, BX0, BX1, FLOOR, FLOOR + BANK_H, BZ0, BZ1)

# Pockets: ellipses (x, z, rx, rz, mineral). Deeper (further east) is rarer,
# as in level.js: gold by the cutting face, voidstone and starcore deep in.
POCKETS = [
    (21.05, -2.95, 0.75, 0.62, 'gold'),
    (22.55, -2.55, 0.62, 0.48, 'gem'),
    (23.3, -4.15, 0.78, 0.66, 'crystal'),
    (24.85, -2.7, 0.62, 0.5, 'rare'),
    (25.6, -4.45, 0.6, 0.6, 'starcore'),
]


def vein_z(x):
    """terrain.js VEINS: a long meandering lane of ore along the drive."""
    return -5.15 + 0.28 * math.sin(x * 1.3) + 0.12 * math.sin(x * 3.1)


def ground_at(x, z):
    for px, pz, rx, rz, key in POCKETS:
        if ((x - px) / rx) ** 2 + ((z - pz) / rz) ** 2 < 1:
            return key
    if abs(z - vein_z(x)) < 0.2:
        return 'iron'
    # terrain.js SIDE_HARD_BIAS: the rig's right (north, -z) is harder.
    hard = 0.35 + 0.25 * (-z - 1.8) / 4.2
    return 'stone' if rng.random() < hard else 'dirt'


SP = 0.41
TOP = FLOOR + BANK_H
DRILL_HOLES = [(R(s * halfW * 0.5, 0, 0)[2]) for s in (-1, 1)]
x = BX0 + SP * 0.5
while x < BX1:
    z = BZ0 + SP * 0.5
    while z < BZ1:
        jx = x + rng.uniform(-0.34, 0.34) * SP
        jz = z + rng.uniform(-0.34, 0.34) * SP
        key = ground_at(jx, jz)
        if key in ('dirt', 'stone'):
            # radius ~0.6 of the pitch: neighbours touch, so it reads PACKED (terrain.js)
            rock(key, (jx, TOP - 0.03, jz), (0, 1, 0), SP * rng.uniform(0.58, 0.68))
        z += SP
    x += SP
# The pockets, denser and proud of the rock.
for px, pz, rx, rz, key in POCKETS:
    n = int(math.pi * rx * rz / 0.065)
    for i in range(n):
        a = rng.uniform(0, math.tau)
        d = math.sqrt(rng.random())
        xx, zz = px + rx * d * math.cos(a), pz + rz * d * math.sin(a)
        lift = (1 - d) * 0.08
        tilt = (rng.uniform(-.25, .25), 1, rng.uniform(-.25, .25))
        size = {'gold': 0.14, 'gem': 0.13, 'crystal': 0.15, 'rare': 0.15, 'starcore': 0.2}[key]
        if key in ('crystal', 'starcore') and i % 2:
            continue
        ore(key, (xx, TOP - 0.02 + lift, zz), tilt, size * rng.uniform(0.8, 1.2))
x = BX0 + 0.15
while x < BX1 - 0.1:
    ore('iron', (x, TOP - 0.01, vein_z(x) + rng.uniform(-0.08, 0.08)), (rng.uniform(-.2, .2), 1, rng.uniform(-.2, .2)),
        rng.uniform(0.12, 0.16))
    x += 0.19

# The south face: the same ground seen in section, where the walkway sees it.
# (West is behind the rig, east faces the deck edge by the mast.)
FACE_POCKETS = {('S', 21.2): 'gold', ('S', 22.7): 'gem', ('S', 24.9): 'rare'}


def face_key(face, u, h):
    for (f, c), key in FACE_POCKETS.items():
        if f == face and ((u - c) / 0.5) ** 2 + ((h - 0.48) / 0.26) ** 2 < 1:
            return key
    return 'stone' if rng.random() < 0.45 else 'dirt'


for face, u0, u1, N, place in (
        ('S', BX0, BX1, (0, 0, 1), lambda u, h: (u, FLOOR + h, BZ1 - 0.02)),
        ('E', BZ0, BZ1, (1, 0, 0), lambda u, h: (BX1 + 0.02, FLOOR + h, u))):
    if face == 'E':
        continue   # faces the deck edge by the mast; only the south face is ever seen
    u = u0 + SP * 0.5
    while u < u1:
        h = SP * 0.5
        while h < BANK_H - 0.08:
            uu, hh = u + rng.uniform(-0.3, 0.3) * SP, h + rng.uniform(-0.25, 0.25) * SP
            if face == 'W' and any(abs(uu - zc) < 0.55 and abs(hh - DRILL_H) < 0.5 for zc in DRILL_HOLES):
                h += SP
                continue
            key = face_key(face, uu, hh)
            if key in ('dirt', 'stone'):
                rock(key, place(uu, hh), N, SP * rng.uniform(0.56, 0.64))
            else:
                ore(key, place(uu, hh), N, rng.uniform(0.12, 0.15))
            h += SP
        u += SP
# Where the drills went in: dark bores in the west face.
for zc in DRILL_HOLES:
    pts = ring_points((BX0 - 0.006, FLOOR + DRILL_H, zc), (0, 0, 1), (0, 1, 0), baseR * S * 1.02, 20)
    flat(OUTLINE, pts, (-1, 0, 0))
# Spoil at the cutting face: chips the blade threw, some still in the air.
for i in range(26):
    zz = rng.uniform(RZ - 1.55, RZ + 1.55)          # inside the rig's blocker
    xx = rng.uniform(BX0 - 0.45, BX0 - 0.03)
    key = rng.choices(['dirt', 'stone', 'gold'], [5, 3, 2])[0]
    airborne = i % 3 == 0
    y = FLOOR + (rng.uniform(0.35, 1.1) if airborne else 0.0)
    nrm = (rng.uniform(-1, 1), rng.uniform(0.2, 1), rng.uniform(-1, 1)) if airborne else (0, 1, 0)
    if key == 'gold':
        ore('gold', (xx, y, zz), nrm, rng.uniform(0.06, 0.09))
    else:
        rock(key, (xx, y, zz), nrm, rng.uniform(0.07, 0.11))

# ===========================================================================
# THE ORE SKIPS: each mineral up close, in order of value (materials.js)
# ===========================================================================

SKIPS = ['iron', 'gold', 'gem', 'crystal', 'rare', 'starcore']
SKZ = 4.75
SW, SD, SH = 0.95, 0.80, 0.46
for i, key in enumerate(SKIPS):
    sx = 13.4 + i * 1.3
    shadow, base, hi = MINERALS[key]['ramp']
    for fx_ in (-1, 1):
        for fz in (-1, 1):
            span(DARK, sx + fx_ * (SW / 2 - 0.1) - 0.05, sx + fx_ * (SW / 2 - 0.1) + 0.05, FLOOR, FLOOR + 0.06,
                 SKZ + fz * (SD / 2 - 0.1) - 0.05, SKZ + fz * (SD / 2 - 0.1) + 0.05)
    span(HOPPER, sx - SW / 2, sx + SW / 2, FLOOR + 0.06, FLOOR + 0.10, SKZ - SD / 2, SKZ + SD / 2)
    for fz in (-1, 1):
        span(HOPPER, sx - SW / 2, sx + SW / 2, FLOOR + 0.06, FLOOR + SH, SKZ + fz * SD / 2 - 0.025, SKZ + fz * SD / 2 + 0.025)
    for fx_ in (-1, 1):
        span(HOPPER, sx + fx_ * SW / 2 - 0.025, sx + fx_ * SW / 2 + 0.025, FLOOR + 0.06, FLOOR + SH,
             SKZ - SD / 2, SKZ + SD / 2)
    # rim, as the game outlines every part in near-black
    for fz in (-1, 1):
        span(OUTLINE, sx - SW / 2 - 0.035, sx + SW / 2 + 0.035, FLOOR + SH, FLOOR + SH + 0.03,
             SKZ + fz * SD / 2 - 0.035, SKZ + fz * SD / 2 + 0.035)
    for fx_ in (-1, 1):
        span(OUTLINE, sx + fx_ * SW / 2 - 0.035, sx + fx_ * SW / 2 + 0.035, FLOOR + SH, FLOOR + SH + 0.03,
             SKZ - SD / 2 + 0.035, SKZ + SD / 2 - 0.035)
    # Front face (toward the walkway, -z): hazard band, and a badge that is
    # the mineral's own sprite — rim, body and facet, as bakeAtlas paints it.
    fzf = SKZ - SD / 2 - 0.025
    span(OUTLINE, sx - SW / 2 + 0.03, sx + SW / 2 - 0.03, FLOOR + 0.09, FLOOR + 0.19, fzf - 0.006, fzf)
    st = sx - SW / 2 + 0.03
    while st < sx + SW / 2 - 0.05:
        quad = [(st, 0.09), (st + 0.05, 0.09), (st + 0.11, 0.19), (st + 0.06, 0.19)]
        quad = [(min(x_, sx + SW / 2 - 0.03), y_) for x_, y_ in quad]
        flat(HAZARD, [(x_, FLOOR + y_, fzf - 0.012) for x_, y_ in quad], (0, 0, -1))
        st += 0.1
    badge = OUTLINES[key][7]
    bc = (sx, FLOOR + 0.31)
    for layer, (m_, sc, off, dz) in enumerate(((shadow, 0.115, (0, 0), 0.006), (base, 0.095, (0, 0), 0.012),
                                                (hi, 0.042, (-0.012, 0.014), 0.018))):
        c4, s4 = (math.cos(0.4), math.sin(0.4)) if layer == 2 else (1, 0)
        pts = [(bc[0] + (x_ * c4 - y_ * s4) * sc + off[0], bc[1] - (x_ * s4 + y_ * c4) * sc + off[1], fzf - dz)
               for x_, y_ in badge]
        flat(m_, pts, (0, 0, -1))
    # The heap.
    span(DARK, sx - SW / 2 + 0.03, sx + SW / 2 - 0.03, FLOOR + 0.10, FLOOR + 0.32, SKZ - SD / 2 + 0.03, SKZ + SD / 2 - 0.03)
    if key in ('crystal', 'starcore'):
        # Shards: a stand of them, tallest in the middle.
        for k in range(14 if key == 'crystal' else 4):
            a = rng.uniform(0, math.tau)
            d = math.sqrt(rng.random()) * 0.3
            ox_, oz_ = sx + d * math.cos(a) * 1.15, SKZ + d * math.sin(a) * 0.9
            if key == 'crystal':
                lean = (math.cos(a) * d * 1.6, 1, math.sin(a) * d * 1.6)
                spike('crystal', (ox_, FLOOR + 0.31, oz_), lean, rng.uniform(0.045, 0.07),
                      (0.55 - d) * rng.uniform(0.8, 1.15))
            else:
                ore('starcore', (ox_, FLOOR + 0.30, oz_), (0, 1, 0), rng.uniform(0.15, 0.2))
        if key == 'starcore':
            ore('starcore', (sx, FLOOR + 0.36, SKZ), (0, 1, 0), 0.26)
        else:
            for k in range(10):
                rock('stone', (sx + rng.uniform(-.38, .38), FLOOR + 0.31, SKZ + rng.uniform(-.3, .3)), (0, 1, 0), 0.08)
    else:
        count = {'iron': 16, 'gold': 16, 'gem': 14, 'rare': 15}[key]
        size = {'iron': 0.12, 'gold': 0.10, 'gem': 0.095, 'rare': 0.13}[key]
        for k in range(count):
            a = rng.uniform(0, math.tau)
            d = math.sqrt(rng.random())
            ox_, oz_ = sx + d * 0.38 * math.cos(a), SKZ + d * 0.30 * math.sin(a)
            y = FLOOR + 0.31 + (1 - d * d) * 0.20
            tilt = (math.cos(a) * d * 0.7 + rng.uniform(-.3, .3), 1, math.sin(a) * d * 0.7 + rng.uniform(-.3, .3))
            ore(key, (ox_, y, oz_), tilt, size * rng.uniform(0.8, 1.25))

# ===========================================================================
# Write one mesh per material, save, export.
# ===========================================================================

for name, b in BUCKETS.items():
    me = bpy.data.meshes.new(name)
    me.from_pydata(b['v'], [], b['f'])
    me.update()
    for poly, sm in zip(me.polygons, b['s']):
        poly.use_smooth = sm
    me.materials.append(b['mat'])
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'supermine-island.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'supermine-island.glb'),
    export_format='GLB', use_selection=True, export_apply=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True)
# Blockers for room.js, in game coords (base is the deck, -5.5). Derived from
# the same numbers as the geometry so the two cannot drift.
BLOCKERS = [
    ('rig hull, hopper, conveyor, drill bits', RX + (-(cy1) * S + (139 + 5 + 36) * S) / 2,
     RZ, ((139 + 5 + 36) * S + cy1 * S) / 2, (HH + 8) * S, FLOOR + 2.05),
    ('blade drum and side grinders', RX + 1.05, RZ, 1.25, (HH + GR * 1.15 + GR + 5) * S, FLOOR + 0.95),
    ('magnet arms and coils', RX - 1.03, RZ, 0.58, (HH + reach) * S + 0.32, FLOOR + 1.45),
    ('the bank', (BX0 + BX1) / 2, (BZ0 + BZ1 + 0.06) / 2, (BX1 - BX0) / 2, (BZ1 + 0.06 - BZ0) / 2, TOP + 0.1),
    ('ore skips', 13.4 + 2.5 * 1.3, SKZ, 2.5 * 1.3 + SW / 2 + 0.04, SD / 2 + 0.04, FLOOR + 0.9),
]
for name, bx, bz, hx, hz, top in BLOCKERS:
    print(f'BLOCKER {{ x: {bx:.2f}, z: {bz:.2f}, hx: {hx:.2f}, hz: {hz:.2f}, top: {top:.2f}, base: -5.5 }},  // {name}')
print('SUPERMINE_ISLAND_V2_COMPLETE', len(BUCKETS), 'materials', TRIS[0], 'triangles')
