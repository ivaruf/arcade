"""The mining company's claim: the SUPERMINE ADVENTURE island, rebuilt.

Run with Blender --background --python assets/3d/source/adventure_island_v2.py.
Exported as assets/3d/adventure-island.glb, a model of its own on top of the
cloud-world deck, the way lobbots_island.py is. The floor, the beacon mast, the
miners' bridge and the assay office all stay in cloud-world (they are liked,
and the office is the expensive half of the old island); what this file
replaces is the three identical hexagonal crystal beds adventure_island.py put
out, which the owner rightly said looked the same as each other and like
nothing in the game.

Game coordinates match room.js: platform 'adventure', x 14..26, z 12..24, and
the walking surface is exactly y = -5.5. Every prop that stands up has a
blocker in room.js; the only flat details are on the rig's own deck.

WHAT IS ON IT, AND WHERE IT COMES FROM
  The arrival lane runs from the bridge (x 20.8..23.2 at z = 12) south to the
  cabinet at (22, 20.5) and stays empty. Either side of it:

  WEST, in front of the assay office: the SPECIMEN ROW. Six pedestals in the
  order a company meets them on the way down, rising as the ladder rises:
  coal, copper ore, silver, gold, crystal, uranium ore. Each one is the game's
  own material, js/materials.js — its three colours (base, shadow, highlight),
  whether it glows, and its silhouette family ('chunk' or 'shard', which
  particles.js buildSilhouette() turns into the sprite outline). The break
  style decides what the lump is in the round, because it is the one thing
  materials.js says about how the rock is BUILT: coal is 'gravel', so it is a
  heap of chips; copper is 'fracture', so it is angular blocks; silver and gold
  are 'burst', so they are nuggets; crystal and uranium are shards, long and
  splintered for crystal, short and splayed for uranium. Every lump carries
  the sprite's specular facet — bakeAtlas() paints a highlight-coloured facet
  up and to the left of every deposit — and the glowing ones carry it lit, as
  the game does for 'glow' materials. Each plaque shows the drill tier that
  cuts it (materials.js THE CUTTABLE LADDER) as six pips, because "hardness is
  the drill gate" is the spine of the game.

  WEST EDGE: the ROCK FACE. A cut wall of the underground exactly as the game
  draws it — not a cliff with a texture but a packed field of deposits on a
  staggered grid (advterrain.js), each a chunk, shard or round lump in its
  material's base colour, sitting on the dark rim the sprites are stroked
  with. Its rows are the beds of a descent, topsoil to bedrock (dirt, clay,
  sandstone, limestone, stone, granite, bedrock — mines.js layer fills), and
  the ore in each bed is the ore that bed carries in mines.js: coal and copper
  near the top, silver and gold below, emerald, crystal and platinum deeper,
  uranium and voidstone in the granite. A silver lode sits in the limestone
  (Old Creek level 1's guaranteed motherlode is silver), and at the bottom,
  the one event in the table: a tight cluster of three ANCIENT DEBRIS
  deposits (advterrain.js DEB_*), the biggest, brightest shards in the game.
  Its back faces the hub, so it has deposits on both sides.

  EAST: the RIG. The adventure machine, js/vehicle.js, parked facing the
  bridge as if about to go down. Its plan is the game's top-down drawing in
  the game's own world units, scaled by S, and built at a mid-ladder build:
  drill tier 2, tracks 1, cargo 2, engine 1, lights 1, cooling 1, scanner 1
  (rig.js getPartFlags() for what each tier switches on). Front to back:
  the auger (augerSamples(): a shank then a point, four-start flutes, a
  collar, gauge cutters), the reamer drum with its travelling hazard stripes
  and teeth biggest at the shoulders, the mount legs, the hull in the
  gChassis greys with hazard stripes across the nose, the cabin with its
  glass band and the scanner dish on its roof, pistons, headlamps, amber
  warning lights, radiator fins on the flanks, bolted armour plate, four
  exhaust stacks, the intake throat with its magnet coils and belt, and the
  high-sided ore bed behind with its ribs, braces, striped tailgate and a
  load of the game's gOre ochre in it.

Everything is joined by material before export, so the island is a few dozen
draw calls however many pieces it was built from.
"""
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent.parent
rng = random.Random(1337)  # Old Creek's seed: the claim is the same every build

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
    for item in list(block):
        block.remove(item)

DECK = -5.5


def point(x, y, z):
    """Game (x, y up, z) to Blender. The same mapping as every island here."""
    return Vector((-x, -z, y))


# ---------------------------------------------------------------------------
# Materials. Every hex below is quoted from the game; the file:line is in the
# comment where it is not obvious.
# ---------------------------------------------------------------------------

def linear(hex_):
    """sRGB hex to the linear floats Blender's base colour wants."""
    hex_ = hex_.lstrip('#')
    out = []
    for i in range(0, 6, 2):
        c = int(hex_[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


MATS = {}


def mat(name, hex_, metal=0.0, rough=0.55, emit=0.0, emit_hex=None):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new('Claim ' + name)
    rgb = linear(hex_)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*linear(emit_hex or hex_), 1)
        p.inputs['Emission Strength'].default_value = emit
    MATS[name] = m
    return m


# The game's minerals (supermine_adventure/js/materials.js). Base colour is
# colors[0]; the highlight is colors[2]. Glow materials emit a little in the
# body and properly in the facet, which is how bakeAtlas() paints them.
COAL = mat('coal', '#31353c', 0.1, 0.75)                          # :516
COPPER = mat('copper ore', '#d0763c', 0.55, 0.5)                  # :528 bright and matte
COPPER_HI = mat('copper highlight', '#ffc79a', 0.4, 0.45)
SILVER = mat('silver', '#d9e2ea', 0.85, 0.32)                     # :562 glow OFF
SILVER_HI = mat('silver highlight', '#ffffff', 0.7, 0.2)
GOLD = mat('gold', '#ffcb31', 1.0, 0.28, 0.25)                    # :222 glow
GOLD_HI = mat('gold highlight', '#fff3ab', 0.6, 0.2, 1.0)
EMERALD = mat('emerald', '#33dd80', 0.0, 0.15, 0.45)              # :234 glow
CRYSTAL = mat('crystal', '#48bcff', 0.0, 0.08, 0.4)               # :243 glow, shard
CRYSTAL_HI = mat('crystal highlight', '#c2ecff', 0.0, 0.05, 1.2)
PLATINUM = mat('platinum', '#c6cde4', 0.9, 0.22, 0.35)            # :574 glow
VOIDSTONE = mat('voidstone', '#c46bff', 0.0, 0.2, 0.5)            # :253 glow
URANIUM = mat('uranium ore', '#a8e02a', 0.0, 0.3, 0.45)           # :586 glow, shard
URANIUM_HI = mat('uranium highlight', '#eaff9a', 0.0, 0.25, 1.2)
ANCIENT = mat('ancient debris', '#fff0b8', 0.2, 0.2, 0.55)        # :617 the event
ANCIENT_HI = mat('ancient highlight', '#ffffff', 0.0, 0.1, 1.3)
ANCIENT_DARK = mat('ancient matrix', '#9a6a10', 0.4, 0.5)

# Country rock: the beds (materials.js; the fills in mines.js layer tables).
DIRT = mat('dirt', '#7c5a3a', 0.0, 0.9)                           # :197
CLAY = mat('clay', '#9c7256', 0.0, 0.9)                           # :502
SANDSTONE = mat('sandstone', '#c2a479', 0.0, 0.85)                # :539
LIMESTONE = mat('limestone', '#b9bcae', 0.0, 0.8)                 # :550
STONE = mat('stone', '#6d737c', 0.0, 0.8)                         # :205
GRANITE = mat('granite', '#5a6470', 0.0, 0.7)                     # :281
BEDROCK = mat('bedrock', '#4a4750', 0.0, 0.85)                    # :631

# The rig, from vehicle.js's gradients and fills (ensureGradients() and the
# draw functions; quoted at each use below).
OUTLINE = mat('rig outline', '#14171b', 0.3, 0.7)
DARK = mat('rig dark steel', '#2b3138', 0.5, 0.55)
MID = mat('rig mid steel', '#4b535d', 0.6, 0.45)
# Painted steel, so only lightly metallic: at 0.55 the greys mirrored the sky
# and the machine came out near-black, where the game's reads mid-grey.
HULL_SIDE = mat('rig hull side', '#5b636d', 0.3, 0.5)
HULL = mat('rig hull', '#79838f', 0.3, 0.45)
ARMOUR = mat('rig armour plate', '#6f7a86', 0.35, 0.45)
BED_WALL = mat('rig bed plate', '#8b96a3', 0.3, 0.45)
STEEL2 = mat('rig drum steel', '#98a4b0', 0.7, 0.35)
LIGHT_STEEL = mat('rig bright steel', '#c6d0da', 0.8, 0.28)
HAZARD = mat('hazard amber', '#ffbe28', 0.1, 0.5)
GLASS = mat('rig cabin glass', '#96ebff', 0.0, 0.1, 0.35)
ORE = mat('rig load', '#e2a94f', 0.1, 0.75)
ORE_DARK = mat('rig load lump', '#8a5620', 0.1, 0.8)
MAGNET_GLOW = mat('rig magnet core', '#82e1ff', 0.0, 0.3, 1.2)
FLAME = mat('rig exhaust ember', '#ff8c3c', 0.0, 0.4, 1.5)
WARN = mat('rig warning light', '#ffbe28', 0.0, 0.3, 1.4)
LAMP = mat('rig headlamp', '#fff6cd', 0.0, 0.2, 1.3)
DISH_GLOW = mat('rig scanner return', '#78ffd2', 0.0, 0.3, 1.2)

# The display furniture, in the assay office's own palette (the timber is
# adventure_island.py's company_trim, the plaque its oxidised roof, darker).
TIMBER = mat('timber', '#6f573d', 0.0, 0.7)
PLAQUE = mat('enamel plaque', '#22302f', 0.2, 0.45)
BRASS = mat('brass lettering', '#d8b45c', 0.85, 0.3)


# ---------------------------------------------------------------------------
# Geometry helpers. Everything is raw vertices in game space, so any
# orientation is arithmetic and nothing depends on operator state. Every mesh
# is CLOSED, so recalc_face_normals can always find the outside.
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
        mod.segments = 1   # one chamfer reads at this size; two doubled the file
        obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return obj


def obox(name, centre, ax, ay, az, half, material):
    """A box on arbitrary axes: centre ± ax*hx ± ay*hy ± az*hz."""
    C = Vector(centre)
    ax, ay, az = Vector(ax).normalized(), Vector(ay).normalized(), Vector(az).normalized()
    hx, hy, hz = half
    verts = []
    for sy in (-1, 1):
        for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(tuple(C + ax * sx * hx + ay * sy * hy + az * sz * hz))
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    return mesh_obj(name, verts, faces, material)


def frame_for(axis):
    """Two unit vectors perpendicular to `axis` (and to each other)."""
    axis = Vector(axis).normalized()
    ref = Vector((0, 1, 0)) if abs(axis.y) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(ref).normalized()
    return u, axis.cross(u).normalized()


def tube(name, a, b, r0, material, r1=None, sides=12, smooth=True):
    """A (possibly tapered) closed cylinder between two game-space points."""
    r1 = r0 if r1 is None else r1
    A, B = Vector(a), Vector(b)
    u, v = frame_for(B - A if (B - A).length > 1e-6 else Vector((0, 1, 0)))
    verts = []
    for P, r in ((A, r0), (B, r1)):
        for i in range(sides):
            t = i / sides * math.tau
            verts.append(tuple(P + (u * math.cos(t) + v * math.sin(t)) * r))
    faces = [list(range(sides))[::-1], list(range(sides, 2 * sides))]
    faces += [[i, (i + 1) % sides, sides + (i + 1) % sides, sides + i] for i in range(sides)]
    return mesh_obj(name, verts, faces, material, smooth)


def lathe(name, axis_pts, radii, material, sides=16, smooth=True):
    """A closed surface of revolution through samples along a straight axis."""
    A = Vector(axis_pts[0])
    u, v = frame_for(Vector(axis_pts[-1]) - A)
    verts, faces = [], []
    n = len(axis_pts)
    for P, r in zip(axis_pts, radii):
        P = Vector(P)
        for i in range(sides):
            t = i / sides * math.tau
            verts.append(tuple(P + (u * math.cos(t) + v * math.sin(t)) * max(r, 1e-4)))
    for k in range(n - 1):
        for i in range(sides):
            a, b = k * sides + i, k * sides + (i + 1) % sides
            faces.append([a, b, b + sides, a + sides])
    faces.append(list(range(sides))[::-1])
    faces.append([(n - 1) * sides + i for i in range(sides)])
    return mesh_obj(name, verts, faces, material, smooth)


def ball(name, centre, radius, material, squash=(1, 1, 1), subdiv=1, jitter=0.0, r_=None):
    """Icosphere; with jitter it is a faceted lump, flat-shaded."""
    r_ = r_ or rng
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    verts = []
    for vv in bm.verts:
        k = 1 + (r_.uniform(-jitter, jitter) if jitter else 0)
        verts.append((centre[0] + vv.co.x * squash[0] * k, centre[1] + vv.co.z * squash[1] * k,
                      centre[2] + vv.co.y * squash[2] * k))
    faces = [[vv.index for vv in f.verts] for f in bm.faces]
    bm.free()
    return mesh_obj(name, verts, faces, material, smooth=not jitter)


def silhouette(shape, r, r_):
    """particles.js buildSilhouette(): the sprite outline family, as 2D points.
    shard: 5 points, stretched 1.28 x 0.72, radii 0.52..1.24 r
    chunk: 7 points, radii 0.74..1.14 r
    round: 9 points, radii 0.90..1.04 r"""
    if shape == 'shard':
        n, sx, sy, lo, span = 5, 1.28, 0.72, 0.52, 0.72
    elif shape == 'chunk':
        n, sx, sy, lo, span = 7, 1.0, 1.0, 0.74, 0.40
    else:
        n, sx, sy, lo, span = 9, 1.0, 1.0, 0.90, 0.14
    out = []
    rot = r_.uniform(0, math.tau)
    for i in range(n):
        a = i / n * math.tau + r_.uniform(0, 0.22)
        rr = r * (lo + r_.random() * span)
        x, y = math.cos(a) * rr * sx, math.sin(a) * rr * sy
        out.append((x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)))
    return out


# The game lights its sprites from the upper left (bakeAtlas() offsets the
# specular facet by -0.24r, -0.28r). In the round that is "up, and toward the
# bridge the visitors come from".
LIGHT = Vector((-0.3, 1.0, -0.5)).normalized()


def lump(name, centre, normal, r, shape, material, r_, height=None, embed=0.02, top_shift=0.25):
    """
    One deposit standing off a surface: the sprite's outline as the base ring,
    a smaller ring part-way up, and an apex — a faceted dome that is closed
    underneath. The upper ring and apex lean toward LIGHT a little, so the
    lit facets sit where the sprite paints them.
    """
    n = Vector(normal).normalized()
    u, v = frame_for(n)
    C = Vector(centre) - n * embed
    h = height if height is not None else r * {'shard': 0.8, 'chunk': 0.55, 'round': 0.45}[shape]
    pts = silhouette(shape, r, r_)
    lean = (LIGHT - n * LIGHT.dot(n)) * r * top_shift
    verts = [tuple(C + u * x + v * y) for x, y in pts]
    k = 0.62 if shape != 'shard' else 0.5
    verts += [tuple(C + n * h * 0.62 + lean * 0.5 + u * x * k + v * y * k) for x, y in pts]
    verts.append(tuple(C + n * h + lean))
    m = len(pts)
    faces = [list(range(m))[::-1]]
    faces += [[i, (i + 1) % m, m + (i + 1) % m, m + i] for i in range(m)]
    faces += [[m + i, m + (i + 1) % m, 2 * m] for i in range(m)]
    return mesh_obj(name, verts, faces, material)


def facet(name, centre, radius, material, r_, scale=0.46):
    """bakeAtlas()'s specular facet: a highlight-coloured plate at 0.46 of the
    deposit's size, on the side of the lump that faces the light."""
    P = Vector(centre) + LIGHT * radius * 0.86
    return lump(name, P, LIGHT, radius * scale, 'chunk', material, r_, height=radius * 0.12,
                embed=radius * 0.05, top_shift=0.0)


def shard(name, base, direction, length, r, body, tip, r_):
    """
    A 'shard' deposit in the round: the five-point stretched outline as its
    section, swelling a little and then running to a point, with the last
    third in the highlight colour (the lit end, the way the facet reads).
    """
    d = Vector(direction).normalized()
    u, v = frame_for(d)
    B = Vector(base)
    pts = silhouette('shard', r, r_)
    m = len(pts)
    rings = [(0.0, 0.85), (0.55, 1.0), (0.72, 0.72)]
    verts = []
    for t, k in rings:
        verts += [tuple(B + d * length * t + u * x * k + v * y * k) for x, y in pts]
    verts.append(tuple(B + d * length))
    faces = [list(range(m))[::-1]]
    for ring in range(len(rings) - 1):
        o = ring * m
        faces += [[o + i, o + (i + 1) % m, o + m + (i + 1) % m, o + m + i] for i in range(m)]
    mesh_obj(name, verts, faces, body)
    # The tip, as its own closed piece in the highlight colour.
    o = 2 * m
    tv = verts[o:o + m] + [verts[-1]]
    tf = [list(range(m))[::-1]] + [[i, (i + 1) % m, m] for i in range(m)]
    mesh_obj(name + ' tip', tv, tf, tip)


def plate(name, pts_xz, y0, y1, material):
    """A flat polygon (game x/z) extruded from y0 to y1: decals and deck plates."""
    n = len(pts_xz)
    verts = [(x, y0, z) for x, z in pts_xz] + [(x, y1, z) for x, z in pts_xz]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_obj(name, verts, faces, material)


def ring_wall(name, outer, inner, y0, y1, material):
    """The solid band between two matching polygons (same vertex count)."""
    n = len(outer)
    verts = ([(x, y0, z) for x, z in outer] + [(x, y1, z) for x, z in outer] +
             [(x, y0, z) for x, z in inner] + [(x, y1, z) for x, z in inner])
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])                     # outer face
        faces.append([2 * n + j, 2 * n + i, 3 * n + i, 3 * n + j])  # inner face
        faces.append([n + i, n + j, 3 * n + j, 3 * n + i])     # top
        faces.append([j, i, 2 * n + i, 2 * n + j])             # bottom
    return mesh_obj(name, verts, faces, material)


def label(name, text, centre, size, material, facing):
    """Low-poly lettering: a flat font curve at resolution 2, no bevel or
    extrude. The old office's text was ~40k triangles; this is a few dozen
    per letter. `facing` 'north' reads from the bridge side (-z)."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = text
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.resolution_u = 2
    cu.fill_mode = 'FRONT'
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.location = point(*centre)
    # Text lies in Blender XY reading +X. Facing game -z is facing Blender +Y,
    # and for a viewer there to read left to right the text runs along -X.
    o.rotation_euler = {'north': (math.pi / 2, 0, math.pi)}[facing]
    cu.materials.append(material)
    return o


# ---------------------------------------------------------------------------
# 1. THE SPECIMEN ROW — in front of the assay office, west of the lane
# ---------------------------------------------------------------------------
# Six pedestals in ladder order. `tier` is the drill tier that first cuts it
# (materials.js THE CUTTABLE LADDER: worn auger cap 8.5 takes coal 1.5 and
# copper 3.0; tungsten cap 11.5 takes silver 9.0, gold 9.8, crystal 11.2;
# polycrystalline cap 20 takes uranium 18.0).
ROW_Z = 14.0
SPECIMENS = [
    ('COAL', 0), ('COPPER ORE', 0), ('SILVER', 1), ('GOLD', 1), ('CRYSTAL', 1), ('URANIUM ORE', 3),
]
PLINTH_X = [15.45 + i * 0.85 for i in range(len(SPECIMENS))]
PLINTH_H = [0.70 + i * 0.06 for i in range(len(SPECIMENS))]   # the row climbs with the ladder
SPECIMEN_SCALE = 1.25


def pedestal(x, h):
    """Limestone column on a bedrock foot, a company-timber cap and a slate
    tray; returns the y of the tray top."""
    box('Pedestal foot', (x, DECK + 0.05, ROW_Z), (0.56, 0.10, 0.56), BEDROCK, bevel=0.012)
    box('Pedestal column', (x, DECK + 0.10 + (h - 0.16) / 2, ROW_Z), (0.42, h - 0.16, 0.42), LIMESTONE, bevel=0.01)
    box('Pedestal cap', (x, DECK + h - 0.035, ROW_Z), (0.54, 0.07, 0.54), TIMBER, bevel=0.01)
    box('Pedestal tray', (x, DECK + h + 0.008, ROW_Z), (0.44, 0.016, 0.44), OUTLINE)
    return DECK + h + 0.016


def plaque(x, h, name, tier):
    """Enamel plate on the north face: the name in brass, and six pips for the
    drill ladder with the ones up to this mineral's tier lit amber."""
    y = DECK + h * 0.62
    zf = ROW_Z - 0.21
    box('Plaque', (x, y, zf - 0.012), (0.38, 0.16, 0.024), PLAQUE, bevel=0.004)
    box('Plaque frame', (x, y, zf - 0.006), (0.40, 0.18, 0.012), TIMBER)
    label('Plaque name', name, (x, y + 0.025, zf - 0.0255), min(0.06, 0.31 / (len(name) * 0.62)), BRASS, 'north')
    for k in range(6):
        px = x - 0.125 + k * 0.05
        box('Drill pip', (px, y - 0.045, zf - 0.0275), (0.032, 0.018, 0.006), HAZARD if k <= tier else DARK)


def coal(cx, cy, cz):
    """'gravel' break, 'chunk' outline: a heap of friable chips."""
    r_ = random.Random(516)
    spots = [(math.cos(a) * 0.11, 0.045, math.sin(a) * 0.11) for a in [i * math.tau / 7 for i in range(7)]]
    spots += [(math.cos(a) * 0.055, 0.105, math.sin(a) * 0.055) for a in [0.4 + i * math.tau / 3 for i in range(3)]]
    spots += [(0.0, 0.16, 0.0)]
    for i, (dx, dy, dz) in enumerate(spots):
        r = r_.uniform(0.05, 0.068)
        c = (cx + dx, cy + dy, cz + dz)
        ball('Coal chip', c, r, COAL, squash=(1, 0.8, 1), subdiv=0, jitter=0.28, r_=r_)
        if i % 3 == 0:
            facet('Coal facet', c, r * 0.85, HULL_SIDE, r_)   # #646c7a, the coal highlight


def copper(cx, cy, cz):
    """'fracture' break: angular cleaved blocks, metallic orange and matte."""
    r_ = random.Random(528)
    for dx, dz, r in [(0.0, 0.02, 0.115), (-0.12, -0.05, 0.08), (0.11, -0.07, 0.07), (0.06, 0.12, 0.06)]:
        c = (cx + dx, cy + r * 0.75, cz + dz)
        ball('Copper block', c, r, COPPER, squash=(1.1, 0.85, 0.95), subdiv=0, jitter=0.22, r_=r_)
        facet('Copper facet', c, r * 0.85, COPPER_HI, r_)


def silver(cx, cy, cz):
    """'burst', no glow: a heavy rounded nugget with two small ones."""
    r_ = random.Random(562)
    for dx, dz, r in [(0.0, 0.0, 0.13), (-0.13, -0.06, 0.06), (0.12, 0.08, 0.055)]:
        c = (cx + dx, cy + r * 0.8, cz + dz)
        ball('Silver nugget', c, r, SILVER, squash=(1.1, 0.85, 1.0), subdiv=1, jitter=0.12, r_=r_)
        facet('Silver facet', c, r * 0.9, SILVER_HI, r_)


def gold(cx, cy, cz):
    """'burst' with glow: a cluster of nuggets, each with a lit facet."""
    r_ = random.Random(222)
    for dx, dz, r in [(0.0, 0.0, 0.095), (-0.1, 0.05, 0.075), (0.09, 0.07, 0.065), (0.05, -0.1, 0.06), (-0.06, -0.09, 0.05)]:
        c = (cx + dx, cy + r * 0.8, cz + dz)
        ball('Gold nugget', c, r, GOLD, squash=(1.05, 0.85, 1.0), subdiv=1, jitter=0.15, r_=r_)
        facet('Gold facet', c, r * 0.9, GOLD_HI, r_)


def crystal(cx, cy, cz):
    """'shard' with glow: long splinters out of a granite matrix (Frostpeak's
    Crystal Vaults are granite-filled, mines.js)."""
    r_ = random.Random(243)
    ball('Crystal matrix', (cx, cy + 0.04, cz), 0.15, GRANITE, squash=(1, 0.42, 0.9), subdiv=1, jitter=0.2, r_=r_)
    for i, (tilt, yaw, length, r) in enumerate([
            (0.05, 0.0, 0.40, 0.055), (0.42, 0.5, 0.30, 0.048), (0.38, 2.3, 0.28, 0.045),
            (0.5, 4.0, 0.24, 0.04), (0.62, 1.4, 0.2, 0.036), (0.58, 3.2, 0.19, 0.035), (0.7, 5.3, 0.16, 0.032)]):
        d = (math.sin(tilt) * math.cos(yaw), math.cos(tilt), math.sin(tilt) * math.sin(yaw))
        base = (cx + d[0] * 0.04, cy + 0.04, cz + d[2] * 0.04)
        shard('Crystal shard', base, d, length, r, CRYSTAL, CRYSTAL_HI, r_)


def uranium(cx, cy, cz):
    """'shard' outline, 'burst' break: where crystal is a spray of long
    splinters standing up, uranium is a burst — short spikes radiating all
    round a stone core (Deep Hollow and Cinder Fell, where it lives, are
    stone-filled). Same family, opposite silhouette, so the two shard minerals
    are told apart by outline before colour, as the game asks of its sprites."""
    r_ = random.Random(586)
    core = (cx, cy + 0.1, cz)
    ball('Uranium matrix', core, 0.085, STONE, squash=(1, 0.95, 1), subdiv=1, jitter=0.18, r_=r_)
    k = 0
    for ring, (tilt, count) in enumerate([(0.0, 1), (0.6, 5), (1.15, 7), (1.65, 6)]):
        for i in range(count):
            yaw = i * math.tau / count + ring * 0.5 + r_.uniform(-0.15, 0.15)
            t = tilt + r_.uniform(-0.1, 0.1)
            d = (math.sin(t) * math.cos(yaw), math.cos(t), math.sin(t) * math.sin(yaw))
            base = tuple(core[j] + d[j] * 0.05 for j in range(3))
            length = r_.uniform(0.09, 0.13) + (0.03 if ring < 2 else 0)
            shard('Uranium spike', base, d, length, r_.uniform(0.028, 0.038), URANIUM, URANIUM_HI, r_)
            k += 1


for (name, tier), x, h, build in zip(SPECIMENS, PLINTH_X, PLINTH_H, [coal, copper, silver, gold, crystal, uranium]):
    top = pedestal(x, h)
    plaque(x, h, name, tier)
    before = set(bpy.context.scene.objects)
    build(x, top, ROW_Z)
    # The builders are written at hand-specimen size; a quarter up again is
    # what it takes for them to read as six different things from the bridge.
    pivot = point(x, top, ROW_Z)
    for o in set(bpy.context.scene.objects) - before:
        for vtx in o.data.vertices:
            vtx.co = pivot + (vtx.co - pivot) * SPECIMEN_SCALE


# ---------------------------------------------------------------------------
# 2. THE ROCK FACE — the underground as the game draws it, on the west edge
# ---------------------------------------------------------------------------
WX_BACK, WX_FACE = 14.10, 14.60
WZ0, WZ1 = 12.40, 16.10
WALL_H = 1.34
box('Rock face body', ((WX_BACK + WX_FACE) / 2, DECK + WALL_H / 2, (WZ0 + WZ1) / 2),
    (WX_FACE - WX_BACK, WALL_H, WZ1 - WZ0), OUTLINE)   # the dark rim every sprite is stroked with

# Beds from the bottom up: a descent read upward (mines.js layer fills).
BEDS = [BEDROCK, GRANITE, STONE, LIMESTONE, SANDSTONE, CLAY, DIRT, DIRT]
SHAPE = {  # materials.js: shape, or the break style's preferred shape
    'dirt': 'round', 'clay': 'round', 'sandstone': 'chunk', 'limestone': 'chunk', 'stone': 'shard',
    'granite': 'shard', 'bedrock': 'chunk', 'coal': 'chunk', 'copper ore': 'chunk', 'silver': 'chunk',
    'gold': 'chunk', 'emerald': 'chunk', 'crystal': 'shard', 'platinum': 'chunk', 'voidstone': 'chunk',
    'uranium ore': 'shard', 'ancient debris': 'shard'}
# What each bed carries, deepest last (mines.js spawn weights and the tease
# chain: Old Creek coal/copper, Red Ridge silver, Blackstone gold and
# platinum, Frostpeak crystal and voidstone, Deep Hollow uranium).
BED_ORE = {
    7: [(COAL, 1.0)],
    6: [(COAL, 0.8), (COPPER, 0.3)],
    5: [(COAL, 0.5), (COPPER, 0.6)],
    4: [(COPPER, 0.5), (SILVER, 0.4)],
    3: [(SILVER, 0.5), (GOLD, 0.4)],
    2: [(GOLD, 0.4), (EMERALD, 0.4), (CRYSTAL, 0.3)],
    1: [(CRYSTAL, 0.4), (PLATINUM, 0.5), (VOIDSTONE, 0.3)],
    0: [(URANIUM, 0.6), (VOIDSTONE, 0.3)],
}


def pick(row, r_, chance):
    if r_.random() > chance:
        return BEDS[row]
    table = BED_ORE[row]
    t = r_.random() * sum(w for _, w in table)
    for m_, w in table:
        t -= w
        if t <= 0:
            return m_
    return table[-1][0]


def shape_of(m_):
    return SHAPE[m_.name.replace('Claim ', '')]


PITCH = 0.215
ROW_DY = PITCH * 0.86          # staggered rows pack like the generator's grid
ANCIENT_AT = [(15.05, 0), (15.28, 1), (15.42, 0)]  # the cluster: three deposits, bottom of the face
SILVER_LODE = (13.25, 3)       # Old Creek level 1's guaranteed motherlode is silver


def wall_face(x_face, normal_x, pitch, rows, chance, seed, extras=True):
    r_ = random.Random(seed)
    for row in range(rows):
        y = DECK + 0.11 + row * pitch * 0.86
        off = pitch / 2 if row % 2 else 0
        z = WZ0 + 0.1 + off
        while z < WZ1 - 0.06:
            m_ = pick(row if rows == 8 else min(7, int(row * 8 / rows)), r_, chance)
            if extras:
                if any(abs(z - az) < 0.12 and row == ar for az, ar in ANCIENT_AT):
                    m_ = None
                elif abs(z - SILVER_LODE[0]) < 0.3 and abs(row - SILVER_LODE[1]) <= 1:
                    m_ = SILVER
            if m_ is not None:
                r = pitch * r_.uniform(0.58, 0.66)
                lump('Rock face deposit', (x_face, y + r_.uniform(-0.015, 0.015), z), (normal_x, 0, 0), r,
                     shape_of(m_), m_, r_)
            z += pitch


wall_face(WX_FACE, 1, PITCH, 8, 0.2, 1337)                       # the face, toward the lane
wall_face(WX_BACK, -1, 0.3, 5, 0.12, 1338, extras=False)         # the back, toward the hub
# The ends: the north one is what the bridge sees first.
r_end = random.Random(1339)
for zf, nz in ((WZ0, -1), (WZ1, 1)):
    for row in range(7):
        y = DECK + 0.11 + row * ROW_DY
        for k, x in enumerate((WX_BACK + 0.13, WX_FACE - 0.12)):
            m_ = pick(row, r_end, 0.2)
            r = PITCH * r_end.uniform(0.58, 0.66)
            lump('Rock face deposit', (x + (0.05 if row % 2 else 0), y, zf), (0, 0, nz), r, shape_of(m_), m_, r_end)
# A ragged topsoil crest, so the cut face ends in ground rather than a ruler.
for k in range(14):
    z = WZ0 + 0.15 + k * 0.265
    x = WX_BACK + 0.12 + (k % 2) * 0.24
    lump('Rock face crest', (x, DECK + WALL_H, z), (0, 1, 0), r_end.uniform(0.11, 0.14), 'round',
         DIRT if k % 4 else COAL, r_end)

# ANCIENT DEBRIS: the one material that is an event. Three deposits in a tight
# cluster, biggest radius band and brightest colours in the table — here the
# longest shards on the island, set in their shadow colour.
r_anc = random.Random(617)
for (z, row), (length, r) in zip(ANCIENT_AT, [(0.34, 0.075), (0.42, 0.085), (0.28, 0.07)]):
    y = DECK + 0.11 + row * ROW_DY
    ball('Ancient matrix', (WX_FACE, y, z), 0.11, ANCIENT_DARK, squash=(0.6, 1, 1), subdiv=1, jitter=0.2, r_=r_anc)
    d = (1.0, r_anc.uniform(0.15, 0.45), r_anc.uniform(-0.35, 0.35))
    shard('Ancient debris', (WX_FACE - 0.04, y, z), d, length, r, ANCIENT, ANCIENT_HI, r_anc)

# Spoil at the foot of the face: what a cut leaves behind (rubble, materials.js
# :269, and a couple of chips of what came out with it).
for k in range(11):
    z = WZ0 + 0.3 + k * 0.32 + r_end.uniform(-0.08, 0.08)
    x = WX_FACE + r_end.uniform(0.08, 0.26)
    r = r_end.uniform(0.04, 0.075)
    m_ = [SANDSTONE, LIMESTONE, STONE, COAL, CLAY, COPPER][k % 6]
    ball('Spoil chip', (x, DECK + r * 0.55, z), r, m_, squash=(1, 0.7, 1), subdiv=0, jitter=0.25, r_=r_end)


# ---------------------------------------------------------------------------
# 3. THE RIG — js/vehicle.js, parked east of the lane, facing the bridge
# ---------------------------------------------------------------------------
# Local plan coordinates are the game's world units: u across (+ right), v
# along the hull with -v forward (vehicle.js: "-y is forward, the origin is
# the chassis centre"). Heights are in metres, invented: the game is top-down.
S = 0.0105
RX = 24.75
RZ = 12.4 + 219 * S        # auger tip pinned 0.4 m inside the north edge


def R(u, v, h):
    return (RX + u * S, DECK + h, RZ + v * S)


# The build (rig.js getPartFlags for drill 2, tracks 1, cargo 2, engine 1,
# lights 1, cooling 1, scanner 1) and vehicle.js's geometry for it.
BL = 158                                   # config.js VEHICLE_BODY_LENGTH
BW = 96 + 1 * 5                            # VEHICLE_BODY_WIDTH + armor * ADV_ARMOR_WIDTH
TW = 24 + 1 * 9                            # TRACK_WIDTH + treads * TRACK_PER_LEVEL
HULL_HALF = BW / 2 + TW - 2                # hullHalf()
BLADE_W = 150 + 2 * 22                     # ADV_BLADE_WIDTH + bladeTier * ADV_BLADE_PER_TIER
BLADE_T = 24 + 2 * 4                       # bladeThick()
FRONT_V = -BL / 2 - 20                     # frontY: chassis nose minus BLADE_ARM
AUG_BASE = FRONT_V - BLADE_T * 0.35        # augerBaseY()
AUG_TIP = -((BL / 2 + 20 + BLADE_T / 2) + (84 + 2 * 8) * 0.82 + 2 * 11)   # augerTipY()
AUG_R = BLADE_W / 2 * (0.26 + 2 * 0.022)   # augerRadius()
CARGO = 2
WALL = 3.4 + CARGO * 1.9                   # wallT()
BED_HALF = HULL_HALF * (0.76 + CARGO * 0.075)
BAY_LEN = 54 + CARGO * 28
BED_V0 = BL / 2 - WALL                     # bedY0()
BED_V1 = BED_V0 + BAY_LEN

H_TRACK = 0.46
DECK_LO, DECK_HI = 0.20, 0.60
AXLE = 0.40                                # drum and auger centreline

# --- tracks ---------------------------------------------------------------
# Shoe #0f1216 (our OUTLINE), grousers #5b646f, sprockets #4b535d, extra road
# wheels with treads 1 (drawTracks()).
TL = BL * 0.98
tr = H_TRACK / 2
for side in (-1, 1):
    tu = side * (BW / 2 + TW / 2 - 2)
    u0, u1 = tu - TW / 2, tu + TW / 2
    # The stadium profile in (v, h), extruded across the track's width.
    prof = []
    half_run = TL / 2 * S - tr
    for i in range(9):
        a = -math.pi / 2 + i / 8 * math.pi        # front end, bottom to top
        prof.append((-half_run - math.cos(a) * tr, tr + math.sin(a) * tr))
    for i in range(9):
        a = math.pi / 2 - i / 8 * math.pi         # rear end, top to bottom
        prof.append((half_run + math.cos(a) * tr, tr + math.sin(a) * tr))
    n = len(prof)
    verts = [(RX + u0 * S, DECK + h, RZ + vz) for vz, h in prof] + [(RX + u1 * S, DECK + h, RZ + vz) for vz, h in prof]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    mesh_obj('Rig track shoe', verts, faces, OUTLINE)
    # Grousers: pitch 11 + treads*2 world units along the top run and round
    # both ends, standing a couple of centimetres proud of the shoe.
    pitch = (11 + 2) * S
    vz = -half_run
    while vz <= half_run:
        box('Rig grouser', (RX + tu * S, DECK + H_TRACK + 0.012, RZ + vz), ((TW - 4) * S, 0.024, 0.055), HULL_SIDE)
        vz += pitch
    for end in (-1, 1):
        for i in range(1, 6):
            a = math.pi / 2 - i / 6 * math.pi
            c = Vector((RX + tu * S, DECK + tr + math.sin(a) * (tr + 0.012), RZ + end * (half_run + math.cos(a) * (tr + 0.012))))
            radial = Vector((0, math.sin(a), end * math.cos(a)))
            obox('Rig grouser', tuple(c), (1, 0, 0), radial, radial.cross(Vector((1, 0, 0))),
                 ((TW - 4) * S / 2, 0.012, 0.028), HULL_SIDE)
    # Sprockets, idlers and road wheels on both faces.
    for fu, out in ((u1, 1), (u0, -1)):
        fx = RX + fu * S + out * 0.012
        for vz in (-half_run, half_run):
            tube('Rig sprocket', (fx - out * 0.02, DECK + tr, RZ + vz), (fx, DECK + tr, RZ + vz), 0.17, MID, sides=14)
            tube('Rig sprocket hub', (fx, DECK + tr, RZ + vz), (fx + out * 0.015, DECK + tr, RZ + vz), 0.06, LIGHT_STEEL, sides=10)
        for w in range(3):
            vz = -TL / 2 * S + TL * S * (0.24 + 0.52 * w / 2)
            tube('Rig road wheel', (fx - out * 0.02, DECK + 0.15, RZ + vz), (fx, DECK + 0.15, RZ + vz), 0.11, DARK, sides=12)
            tube('Rig road wheel hub', (fx, DECK + 0.15, RZ + vz), (fx + out * 0.012, DECK + 0.15, RZ + vz), 0.04, STEEL2, sides=8)

# --- chassis ---------------------------------------------------------------
# gChassis runs #5b636d -> #79838f -> #69727d -> #464d55; the top is the light
# band, the flanks the dark one.
box('Rig hull flank', R(0, 0, (DECK_LO + DECK_HI - 0.06) / 2), (BW * S, DECK_HI - DECK_LO - 0.06, BL * S), HULL_SIDE, bevel=0.03)
box('Rig hull deck', R(0, 0, DECK_HI - 0.04), (BW * S - 0.02, 0.08, BL * S - 0.02), HULL, bevel=0.03)
# Hazard stripes across the nose: 9 wide every 18, slanting 11 over 13, from
# 6 units behind the nose (drawChassis()). Decals 6 mm proud of the deck.
for sx in range(-int(BW / 2) - 14, int(BW / 2) + 14, 18):
    quad = [(sx, -BL / 2 + 6), (sx + 9, -BL / 2 + 6), (sx + 20, -BL / 2 + 19), (sx + 11, -BL / 2 + 19)]
    lim = BW / 2 - 4
    quad = [(max(-lim, min(lim, u)), v) for u, v in quad]
    if abs(quad[1][0] - quad[0][0]) + abs(quad[2][0] - quad[3][0]) < 2:
        continue
    plate('Rig nose stripe', [(RX + u * S, RZ + v * S) for u, v in quad], DECK + DECK_HI, DECK + DECK_HI + 0.006, HAZARD)
# Panel seams every 22 units behind the quarter line.
for k in range(6):
    v = -BL * 0.25 + k * 22
    if -8 < v < 26:
        continue  # under the cabin
    box('Rig panel seam', R(0, v, DECK_HI + 0.003), (BW * S - 0.06, 0.006, 0.014), OUTLINE)
# Armour plate (tracks 1): a bolted band round the hull, rivets #98a3af.
AT = 5 * S
for side in (-1, 1):
    box('Rig armour plate', R(side * (BW / 2 + 2.5), 0, 0.40), (AT, 0.30, BL * S - 0.08), ARMOUR, bevel=0.008)
    for v in range(int(-BL / 2 + 10), int(BL / 2), 26):
        tube('Rig rivet', R(side * (BW / 2 + 5), v, 0.40), R(side * (BW / 2 + 6.2), v, 0.40), 0.014, STEEL2, sides=6)
box('Rig nose armour', R(0, -BL / 2 - 2.5, 0.40), (BW * S - 0.06, 0.30, AT), ARMOUR, bevel=0.008)

# --- cabin, glass and the scanner dish -----------------------------------------
# Cabin #3d444c, 0.52 of the hull wide and 30 long from v -6; its glass
# rgba(150,235,255,.92) (drawChassis()). Dish #8e99a6 on a mast, with the
# scanner's green return in the middle (drawDish()).
CW = BW * 0.52
CAB_V0, CAB_V1 = -6, 24
CAB_TOP = DECK_HI + 0.42
box('Rig cabin', R(0, (CAB_V0 + CAB_V1) / 2, (DECK_HI + CAB_TOP) / 2), (CW * S, CAB_TOP - DECK_HI, (CAB_V1 - CAB_V0) * S), MID, bevel=0.025)
box('Rig cabin roof', R(0, (CAB_V0 + CAB_V1) / 2, CAB_TOP + 0.015), (CW * S + 0.04, 0.03, (CAB_V1 - CAB_V0) * S + 0.04), DARK, bevel=0.008)
gy = (DECK_HI + 0.13 + CAB_TOP - 0.05) / 2
gh = CAB_TOP - 0.05 - DECK_HI - 0.13
box('Rig cabin glass', R(0, CAB_V0, gy), (CW * S - 0.08, gh, 0.012), GLASS)          # windscreen, toward the drill
box('Rig cabin glass', R(0, CAB_V1, gy), (CW * S - 0.1, gh * 0.8, 0.012), GLASS)
for side in (-1, 1):
    box('Rig cabin glass', R(side * CW / 2, (CAB_V0 + CAB_V1) / 2, gy), (0.012, gh, (CAB_V1 - CAB_V0) * S - 0.08), GLASS)
dish_c = R(0, CAB_V0 + 5, CAB_TOP + 0.14)
tube('Rig dish mast', R(0, CAB_V0 + 5, CAB_TOP + 0.03), dish_c, 0.02, DARK, sides=8)
dish_dir = Vector((0.25, 1.0, -0.8)).normalized()      # turned toward the bridge, mid-sweep
dc = Vector(dish_c)
du, dv = frame_for(dish_dir)
dr = (9 + 2.5) * S * 1.25                               # (9 + dish*2.5) units, a touch generous to read in 3D
dverts = []
for ring, (rad, depth) in enumerate([(0.02, -0.03), (dr * 0.55, 0.0), (dr, 0.035)]):
    for i in range(16):
        t = i / 16 * math.tau
        dverts.append(tuple(dc + dish_dir * depth + (du * math.cos(t) + dv * math.sin(t)) * rad))
dfaces = [[r * 16 + i, r * 16 + (i + 1) % 16, (r + 1) * 16 + (i + 1) % 16, (r + 1) * 16 + i] for r in range(2) for i in range(16)]
dfaces += [list(range(16))[::-1], [32 + i for i in range(16)]]
dish_obj = mesh_obj('Rig scanner dish', dverts, dfaces, mat('rig dish', '#8e99a6', 0.6, 0.35))
dish_obj.modifiers.new('Dish thickness', 'SOLIDIFY').thickness = 0.012
ball('Rig scanner return', tuple(dc + dish_dir * 0.035), 0.022, DISH_GLOW, subdiv=1)
tube('Rig dish feed', tuple(dc), tuple(dc + dish_dir * 0.09), 0.008, DARK, sides=6)

# --- pistons, mount legs ------------------------------------------------------
# Pistons #2c3138 with #9aa4b0 rods at ±0.31 bw, from -0.30 bl (drawChassis()).
for side in (-1, 1):
    u = side * BW * 0.31
    tube('Rig piston', R(u, -BL * 0.30, DECK_HI + 0.05), R(u, -BL * 0.30 + 26, DECK_HI + 0.05), 0.04, DARK, sides=10)
    tube('Rig piston rod', R(u, -BL * 0.30 + 20, DECK_HI + 0.05), R(u, -BL * 0.30 + 34, DECK_HI + 0.05), 0.02, STEEL2, sides=8)
    box('Rig piston clevis', R(u, -BL * 0.30 + 35, DECK_HI + 0.04), (0.07, 0.07, 0.05), MID)
# Mount legs #2b3138 at 13 wide and #4a525c at 7, hull nose to reamer
# (drawDrillRig()).
half_w = BLADE_W / 2
for side in (-1, 1):
    tube('Rig mount leg', R(side * BW * 0.30, -BL / 2 + 12, DECK_HI - 0.02),
         R(side * min(half_w - 12, BW * 0.34 + 26), FRONT_V + 3, AXLE), 6.5 * S, DARK, sides=10)
    tube('Rig mount brace', R(side * BW * 0.44, -BL * 0.28, DECK_HI - 0.04),
         R(side * (half_w - 9), FRONT_V + 4, AXLE), 3.5 * S, MID, sides=8)
    box('Rig drum bearing', R(side * (half_w - 9), FRONT_V, AXLE), (0.1, 0.16, 0.2), DARK, bevel=0.01)

# --- the reamer drum ------------------------------------------------------------
# gDrum #9aa3ad -> #5e666f -> #33383e, amber stripes rgba(255,205,70,.34)
# travelling across it, teeth #c8d2dc / #98a4b0 biggest at the shoulders.
DR = BLADE_T / 2 * S
tube('Rig reamer drum', R(-half_w + 4, FRONT_V, AXLE), R(half_w - 4, FRONT_V, AXLE), DR, STEEL2, sides=20)
for side in (-1, 1):
    tube('Rig drum cap', R(side * (half_w - 4), FRONT_V, AXLE), R(side * half_w, FRONT_V, AXLE), DR * 1.04, MID, sides=20)
# Stripes as a multi-start helix: in the game they are diagonals scrolling
# across the bar, which is what a helix looks like from any side.
LEAD = 3 * BLADE_T      # axial travel per turn, in units
for start in range(-int(half_w), int(half_w), 21):
    pts = []
    for i in range(25):
        th = i / 24 * math.tau
        u = start + LEAD * th / math.tau - LEAD / 2
        if -half_w + 6 < u < half_w - 6:
            pts.append((u, th))
    if len(pts) < 3:
        continue
    verts, faces = [], []
    for u, th in pts:
        for du_, rr in ((-2.5, DR + 0.002), (2.5, DR + 0.002), (2.5, DR + 0.008), (-2.5, DR + 0.008)):
            c = R(u + du_, FRONT_V, AXLE)
            verts.append((c[0], c[1] + math.sin(th) * rr, c[2] - math.cos(th) * rr))
    for k in range(len(pts) - 1):
        a, b = 4 * k, 4 * (k + 1)
        for q in range(4):
            faces.append([a + q, a + (q + 1) % 4, b + (q + 1) % 4, b + q])
    faces.append([0, 1, 2, 3])
    faces.append([b + 3, b + 2, b + 1, b])
    mesh_obj('Rig drum stripe', verts, faces, HAZARD, smooth=True)
n_teeth = max(3, round(BLADE_W / max(10, 16 - 2 * 1.6)))
step = BLADE_W / n_teeth
for i in range(n_teeth):
    cu = -half_w + step * (i + 0.5)
    edge = abs(cu) / half_w
    tlen = (8 + 2 * 1.8) * (0.72 + edge * 0.5) * S * 1.3
    root = Vector(R(cu, FRONT_V - BLADE_T / 2 + 2, AXLE + 0.05))
    d = Vector((0, 0.35, -1)).normalized()
    pu, pv = Vector((1, 0, 0)), d.cross(Vector((1, 0, 0))).normalized()
    w = step * 0.40 * S
    verts = [tuple(root + pu * a + pv * b) for a, b in ((-w, -w), (w, -w), (w, w), (-w, w))] + [tuple(root + d * tlen)]
    mesh_obj('Rig reamer tooth', verts, [[3, 2, 1, 0], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
             LIGHT_STEEL if i % 2 else STEEL2)

# --- the auger -----------------------------------------------------------------
# augerSamples(): a shank (t <= 0.66, radius Rb * (1 - 0.13 t/0.66)) and then
# a point (Rb * 0.92 * (1-u)^1.15). Body gAuger #98a3af..#4f5761, the flutes'
# grooves rgba(10,13,17,.62) and lit lands rgba(228,238,248,.26): here a dark
# core and three bright helical flights over it.
SHANK = 0.66


def aug_r(t):
    if t <= SHANK:
        return AUG_R * (1 - 0.13 * (t / SHANK))
    u_ = (t - SHANK) / (1 - SHANK)
    return AUG_R * 0.92 * (1 - u_) ** 1.15


def aug_v(t):
    return AUG_BASE + (AUG_TIP - AUG_BASE) * t


ts = [i / 10 * SHANK for i in range(11)] + [SHANK + 0.02]
lathe('Rig auger core', [R(0, aug_v(t), AXLE) for t in ts], [aug_r(t) * S * 0.9 for t in ts], MID, sides=18)
# The point: six ground faces, flat-shaded, in the bit's bright steel.
pts = [SHANK + 0.02, 0.78, 0.9, 1.0]
lathe('Rig auger point', [R(0, aug_v(t), AXLE) for t in pts], [aug_r(t) * S * (0.9 if i == 0 else 1) for i, t in enumerate(pts)],
      LIGHT_STEEL, sides=6, smooth=False)
# Flights: four starts, lead 3 Rb — the game's stripes rise 1.5 Rb across the
# body's 2 Rb, which is half a turn of exactly that helix — the land 14% proud.
for start in range(4):
    verts, faces = [], []
    steps = 30
    for i in range(steps + 1):
        t = 0.04 + (SHANK - 0.03 - 0.04) * i / steps   # stops short of the point
        ang = start * math.tau / 4 + (aug_v(t) - AUG_BASE) / -(3 * AUG_R) * math.tau
        r0 = aug_r(t) * S * 0.88
        r1 = aug_r(t) * S * 1.1
        for rr, dv in ((r0, -2.6), (r1, -1.8), (r1, 1.8), (r0, 2.6)):
            c = R(0, aug_v(t) + dv, AXLE)
            verts.append((c[0] + math.cos(ang) * rr, c[1] + math.sin(ang) * rr, c[2]))
    for k in range(steps):
        a, b = 4 * k, 4 * (k + 1)
        for q in range(4):
            faces.append([a + q, a + (q + 1) % 4, b + (q + 1) % 4, b + q])
    faces.append([0, 1, 2, 3])
    faces.append([4 * steps + 3, 4 * steps + 2, 4 * steps + 1, 4 * steps])
    mesh_obj('Rig auger flight', verts, faces, LIGHT_STEEL, smooth=True)
# The collar (drills flag 1, at t = 0.26) with bolt heads, and the gauge
# cutters at the root and at the shoulder (#aeb9c4, #cdd6e0).
ct = 0.26
tube('Rig auger collar', R(0, aug_v(ct) + 4.5, AXLE), R(0, aug_v(ct) - 4.5, AXLE), aug_r(ct) * 1.22 * S, MID, sides=18)
for i in range(6):
    a = i / 6 * math.tau
    c = R(0, aug_v(ct) - 4.6, AXLE)
    rr = aug_r(ct) * 0.98 * S
    ball('Rig collar bolt', (c[0] + math.cos(a) * rr, c[1] + math.sin(a) * rr, c[2]), 0.014, OUTLINE, subdiv=1)
for k, gt in enumerate((0.16, SHANK - 0.04)):
    for i in range(3):
        a = i / 3 * math.tau + k * 0.6 + 0.3
        rr = aug_r(gt) * S
        c = R(0, aug_v(gt), AXLE)
        radial = Vector((math.cos(a), math.sin(a), 0))
        centre = Vector((c[0], c[1], c[2])) + radial * (rr + 0.015)
        obox('Rig gauge cutter', tuple(centre), radial, Vector((0, 0, 1)), radial.cross(Vector((0, 0, 1))),
             (0.03, 0.045, 0.02), LIGHT_STEEL if k else STEEL2)

# --- lamps, warning lights, radiators, stacks -------------------------------------
# Headlamps (lights 1): one pair at ±0.20 bw on the nose, housing #2b3138,
# lens rgba(255,246,205) (drawLamps()).
for side in (-1, 1):
    box('Rig lamp housing', R(side * BW * 0.20, -BL / 2 - 4, 0.47), (0.15, 0.1, 0.07), DARK, bevel=0.01)
    tube('Rig headlamp', R(side * BW * 0.20, -BL / 2 - 7.1, 0.475), R(side * BW * 0.20, -BL / 2 - 7.8, 0.475), 0.035, LAMP, sides=12)
# Warning lights: one pair, always, amber, outboard at hullHalf + 2 and 16
# behind the nose (drawLights()) — on brackets over the tracks.
for side in (-1, 1):
    tube('Rig light bracket', R(side * (BW / 2 + 3), -BL / 2 + 16, DECK_HI - 0.05), R(side * (HULL_HALF + 2), -BL / 2 + 16, DECK_HI - 0.05),
         0.016, DARK, sides=6)
    tube('Rig light base', R(side * (HULL_HALF + 2), -BL / 2 + 16, DECK_HI - 0.06), R(side * (HULL_HALF + 2), -BL / 2 + 16, DECK_HI - 0.02),
         0.045, DARK, sides=10)
    ball('Rig warning light', R(side * (HULL_HALF + 2), -BL / 2 + 16, DECK_HI - 0.02), 0.04, WARN, squash=(1, 1.2, 1))
# Radiators (cooling 1): 3 + 1 fin blocks per side from -0.18 bl, every 15,
# finW 10 + 2 wide, #39414b, outboard of the hull (drawRadiators()).
for side in (-1, 1):
    rail_u = side * (HULL_HALF - 2 + 6)
    tube('Rig radiator rail', R(rail_u, -BL * 0.18 - 3, 0.52), R(rail_u, -BL * 0.18 + 3 * 15 + 13, 0.52), 0.014, DARK, sides=6)
    for i in range(4):
        v0 = -BL * 0.18 + i * 15
        for k in range(3):
            box('Rig radiator fin', R(rail_u, v0 + 1.5 + k * 3.5, 0.6), (12 * S, 0.17, 0.01), DARK)
# Exhaust stacks (engine 1): 1 + 1 per side at ±(0.30 bw - 15 i), from 0.32 bl,
# #20242a, an ember at each mouth (drawExhaust()).
for side in (-1, 1):
    for i in range(2):
        u = side * (BW * 0.30 - i * 15)
        top = DECK_HI + 0.42 + i * 0.09
        tube('Rig exhaust stack', R(u, BL * 0.32 - 12, DECK_HI), R(u, BL * 0.32 - 12, top), 4 * S, OUTLINE, sides=10)
        tube('Rig stack lip', R(u, BL * 0.32 - 12, top - 0.02), R(u, BL * 0.32 - 12, top + 0.004), 4 * S + 0.008, DARK, sides=10)
        tube('Rig stack ember', R(u, BL * 0.32 - 12, top - 0.03), R(u, BL * 0.32 - 12, top - 0.004), 4 * S - 0.01, FLAME, sides=10)

# --- the intake throat ---------------------------------------------------------
# From 0.32 bl to the chassis rear; a funnel that converges (deck 0.46 bw to a
# mouth of 0.56 of the bed, capped at 0.84 of the deck), gBedWall plates, the
# throat #191d22, a feeder belt (conveyor 1) with amber chevrons, and three
# magnet coils #333b45 with cyan cores (drawIntake()).
IV0, IV1 = BL * 0.32, BL / 2 + 1
deck_h = BW * 0.46
mouth = min(BED_HALF * 0.56, deck_h * 0.84)
outer = [(-deck_h, IV0), (deck_h, IV0), (mouth, IV1), (-mouth, IV1)]
lip = 5 + CARGO * 0.5
inner = [(-deck_h + lip, IV0 + lip), (deck_h - lip, IV0 + lip), (mouth - lip * 0.4, IV1 + 0.1), (-mouth + lip * 0.4, IV1 + 0.1)]
ring_wall('Rig intake chute', [(RX + u * S, RZ + v * S) for u, v in outer], [(RX + u * S, RZ + v * S) for u, v in inner],
          DECK + DECK_HI - 0.01, DECK + DECK_HI + 0.12, BED_WALL)
plate('Rig intake belt', [(RX + u * S, RZ + v * S) for u, v in inner], DECK + DECK_HI, DECK + DECK_HI + 0.008, DARK)
for k in range(3):
    t = (k + 0.5) / 3
    v = IV0 + lip + (IV1 - IV0 - lip) * t
    hw = (deck_h - lip) + ((mouth - lip * 0.4) - (deck_h - lip)) * t
    plate('Rig intake chevron', [(RX + a * S, RZ + b * S) for a, b in
                                 ((-hw + 3, v - 6), (0, v), (hw - 3, v - 6), (hw - 3, v - 3), (0, v + 3), (-hw + 3, v - 3))],
          DECK + DECK_HI + 0.008, DECK + DECK_HI + 0.014, HAZARD)
    vb = v + 4
    tube('Rig magnet coil', R(-hw + 1, vb, DECK_HI + 0.05), R(hw - 1, vb, DECK_HI + 0.05), 0.026, mat('rig coil iron', '#333b45', 0.6, 0.45), sides=8)
    tube('Rig magnet core', R(-hw + 3, vb, DECK_HI + 0.075), R(hw - 3, vb, DECK_HI + 0.075), 0.008, MAGNET_GLOW, sides=6)
for side in (-1, 1):
    box('Rig pole shoe', R(side * (deck_h - 3.5), IV0 + 8, DECK_HI + 0.08), (7 * S, 0.1, (12 + CARGO) * S), MID, bevel=0.005)

# --- the ore bed -----------------------------------------------------------------
# One bay at cargo 2: high-sided (bolted boards), tailgate, 2 + 2 ribs a side
# with braces every other, gBedWall plates and the #20242a floor; loaded to
# about two thirds with the gOre ochre #e2a94f..#8a5620 (drawBay()).
hwR = BED_HALF
hwF = hwR * 0.96
ch = 6 + CARGO * 0.7


def bed_path(v0, v1, h0, h1, c):
    return [(-h0 + c, v0), (h0 - c, v0), (h0, v0 + c), (h1, v1 - c), (h1 - c, v1), (-h1 + c, v1), (-h1, v1 - c), (-h0, v0 + c)]


BED_LO, BED_TOP = 0.24, 0.78
o_path = bed_path(BED_V0, BED_V1, hwF, hwR, ch)
i_path = bed_path(BED_V0 + WALL, BED_V1 - WALL, hwF - WALL, hwR - WALL, ch * 0.55)
ring_wall('Rig bed walls', [(RX + u * S, RZ + v * S) for u, v in o_path], [(RX + u * S, RZ + v * S) for u, v in i_path],
          DECK + BED_LO, DECK + BED_TOP, BED_WALL)
plate('Rig bed floor', [(RX + u * S, RZ + v * S) for u, v in o_path], DECK + BED_LO - 0.04, DECK + BED_LO + 0.02, DARK)
# High-side boards: the bolt seam inset on the rim.
b_path = bed_path(BED_V0 + WALL * 0.5, BED_V1 - WALL * 0.5, hwF - WALL * 0.42, hwR - WALL * 0.42, ch * 0.7)
bi_path = bed_path(BED_V0 + WALL * 0.62, BED_V1 - WALL * 0.62, hwF - WALL * 0.6, hwR - WALL * 0.6, ch * 0.62)
ring_wall('Rig bed board seam', [(RX + u * S, RZ + v * S) for u, v in b_path], [(RX + u * S, RZ + v * S) for u, v in bi_path],
          DECK + BED_TOP, DECK + BED_TOP + 0.006, MID)
# Floor slats show in the empty third.
for k in range(1, 8):
    v = BED_V0 + WALL + k * (15 + CARGO)
    if v > BED_V1 - WALL - 2:
        break
    box('Rig bed slat', R(0, v, BED_LO + 0.03), ((hwR - WALL) * 2 * S - 0.02, 0.02, 0.025), MID)
# Ribs and braces down both flanks.
ribs = 2 + CARGO
for k in range(ribs):
    t = (k + 0.6) / (ribs + 0.2)
    v = BED_V0 + BAY_LEN * t
    ro = hwF + (hwR - hwF) * t
    for side in (-1, 1):
        box('Rig bed rib', R(side * (ro + 1.2), v, (BED_LO + BED_TOP) / 2), (0.03, BED_TOP - BED_LO, 0.035), MID)
        if k % 2 == 0:
            fl = (3 + CARGO * 0.7) * S * 2
            verts = [R(side * ro, v - 5, BED_TOP - 0.02), R(side * ro, v + 5, BED_TOP - 0.02),
                     R(side * ro, v + 5, BED_LO + 0.05), R(side * ro, v - 5, BED_LO + 0.05)]
            verts += [(p[0] + side * fl, p[1], p[2]) for p in verts[:2]] + [(verts[3][0] + side * 0.012, verts[3][1], verts[3][2]),
                                                                              (verts[2][0] + side * 0.012, verts[2][1], verts[2][2])]
            mesh_obj('Rig bed brace', verts, [[0, 1, 2, 3], [4, 5, 7, 6], [0, 4, 5, 1], [1, 5, 7, 2], [2, 7, 6, 3], [3, 6, 4, 0]], DARK)
# The load: a body of ore up to the heap line, then a crust of lumps over it
# with a slope down at its back edge, and the darker chunks the game dots in.
LOAD_V0 = BED_V0 + WALL
LOAD_V1 = LOAD_V0 + (BED_V1 - WALL - LOAD_V0) * 0.68
iw = hwF - WALL - 0.5
plate('Rig load body', [(RX + u * S, RZ + v * S) for u, v in
                        [(-iw, LOAD_V0), (iw, LOAD_V0), (iw, LOAD_V1), (-iw, LOAD_V1)]],
      DECK + BED_LO + 0.02, DECK + 0.64, ORE)
r_ore = random.Random(2224)
cols = 7
for row in range(5):
    v = LOAD_V0 + 6 + row * (LOAD_V1 - LOAD_V0 - 6) / 4.2
    for c in range(cols):
        u = -iw + 8 + c * (2 * iw - 16) / (cols - 1) + r_ore.uniform(-4, 4)
        hgt = 0.68 - row * 0.015 if row < 4 else 0.6
        dark = r_ore.random() < 0.22
        ball('Rig load lump', R(u, v, hgt), r_ore.uniform(0.075, 0.1), ORE_DARK if dark else ORE,
             squash=(1, 0.75, 1), subdiv=1, jitter=0.22, r_=r_ore)
# Tailgate: #5c646f with amber stripes (high-sided), hinge knuckles #2f353d
# and the #9aa4b0 latch (drawTailgate()).
TG_V = BED_V1 + 1
tg_w = (hwR + 3) * S
box('Rig tailgate', R(0, TG_V, (BED_LO + BED_TOP) / 2 + 0.01), (tg_w * 2, BED_TOP - BED_LO + 0.02, 0.04), ARMOUR, bevel=0.006)
for sx in range(-int(hwR) - 10, int(hwR) + 10, 16):
    a, b = max(-hwR, sx), min(hwR, sx + 7)
    c, d = max(-hwR, sx + 18), min(hwR, sx + 25)
    if b <= a or d <= c:
        continue
    yb, yt = BED_LO + 0.06, BED_TOP - 0.06
    verts = [R(a, TG_V + 2.2, yt), R(b, TG_V + 2.2, yt), R(d, TG_V + 2.2, yb), R(c, TG_V + 2.2, yb)]
    verts += [(p[0], p[1], p[2] + 0.006) for p in verts]
    mesh_obj('Rig tailgate stripe', verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], HAZARD)
for side in (-1, 1):
    tube('Rig tailgate hinge', R(side * (hwR - 1), TG_V, BED_LO + 0.04), R(side * (hwR + 5), TG_V, BED_LO + 0.04), 0.03, DARK, sides=10)
box('Rig tailgate latch', R(0, TG_V + 2.6, BED_TOP - 0.1), (0.15, 0.04, 0.02), STEEL2)
# Running gear under the bay: the game draws none, but a tub hanging off the
# back of a tracked hull has to stand on something. One axle, two tyres.
WV = BED_V0 + BAY_LEN * 0.68
tube('Rig bed axle', R(-hwR - 4, WV, 0.19), R(hwR + 4, WV, 0.19), 0.035, DARK, sides=8)
for side in (-1, 1):
    tube('Rig bed tyre', R(side * (hwR + 1.5), WV, 0.19), R(side * (hwR + 9), WV, 0.19), 0.19, OUTLINE, sides=16)
    tube('Rig bed hub', R(side * (hwR + 9), WV, 0.19), R(side * (hwR + 10.2), WV, 0.19), 0.07, STEEL2, sides=10)
box('Rig bed subframe', R(0, (BED_V0 + WV) / 2, 0.2), (0.5, 0.08, (WV - BED_V0) * S), DARK)


# ---------------------------------------------------------------------------
# Join by material: a few dozen draw calls rather than a thousand.
# ---------------------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.convert(target='MESH')  # applies bevels and solidify, turns text to mesh
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
    joined.name = name                 # 'Claim <material>': nothing in cloud-world starts so
    joined.data.name = joined.name

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'adventure-island.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'adventure-island.glb'),
    export_format='GLB', use_selection=True, export_apply=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True)
print('ADVENTURE_ISLAND_V2_COMPLETE', len(groups), 'materials', tris, 'triangles')
