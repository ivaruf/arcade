"""NeonFox arena, v2: a race in progress on the neon island.

Run with Blender --background --python assets/3d/source/neonfox_island_v2.py.
Writes assets/3d/neonfox-island.glb and neonfox-island.blend beside it.

WHAT IT IS
  The owner's note was that the NeonFox island was "just the floor". The
  floor stays exactly as it is — js/neonfox.js paints the game's grid and six
  coloured trails into it at runtime — and this file builds what stands ON it
  and what rides over it: the game's own arena furniture, and one rider the
  runtime clones three times so a race is always under way when the gopher
  flies past.

  STATIC PROPS, in final world positions, joined by material, every node named
  "NFv2 <material>":
    * The rim. neonfox/js/render/scene.js buildRim()/buildWall() close the
      arena with four glowing cyan beams over a barely-there wall; here it is
      a low dark wall (top y = 2.22) with a thin beam of the same cyan along
      its crest and small neon ticks down both faces, inset 5 cm from the
      platform edge so nothing overhangs the drop. It has two 3 m gaps — the
      north edge (z = -12, x -20.5..-17.5) and the east edge (x = -13,
      z -19.5..-16.5) — because both face the welcome cloud and the gopher
      has to walk on and off. Every gap end gets a glowing post cap so the
      opening reads as a doorway and not a missing piece.
    * Four corner light pylons, inset 0.4 m, slim dark posts with a neon
      strip and cap: the game's floodlit-arena feel without any actual light.
    * A scoreboard tower near the north-west corner: a slim double-sided
      board with six stacked standings bars in the six PALETTE colours
      (neonfox/js/config.js:151-158), longest first, each a dim body with a
      bright head — the bright part is small on purpose, because the arcade's
      glow layer blooms broad emissive into white slabs.

  ONE RIDER TEMPLATE at the world origin, NOT in the arena: an empty "NF Rider"
  with exactly two children, "NF Rider orb" (origin at the orb centre, so the
  runtime can roll it about its local X) and "NF Rider fox" (rigid, facing
  +Z). It is a low-poly reading of the codex fox
  (neonfox/codex-concepts/build_fox_detailed.py and the fox-running preview):
  big head, bigger eyes, cream muzzle and cheek fans, crouched on top of the
  ball with fore paws on its front shoulder and hind paws on its back, the
  brush streaming out behind. Tinting follows rider.js tintFox()
  (neonfox/js/render/rider.js:692-716): fur, fur shadow, the trim, the orb and
  its energy rings take the player's colour, and muzzle, eyes and nose stay as
  authored so six foxes are six foxes rather than six blobs. The materials
  that should be recoloured are named "NF tint ..." for the runtime to find.

COORDINATES are the arcade's game space (x, y up, z; Babylon left-handed),
mapped into Blender exactly as every island script here does: point(x, y, z)
= (-x, -z, y), exported with export_yup. The walking surface of platform
'neonfox' is y = 2 everywhere, x in [-25, -13], z in [-24, -12].
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT = Path(__file__).resolve().parent.parent

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
    for item in list(block):
        block.remove(item)


def point(x, y, z):
    """Game (x, y up, z) to Blender. The same mapping as every island here."""
    return Vector((-x, -z, y))


# ---------------------------------------------------------------------------
# Platform and the keep-clear map (room.js PLATFORMS / SLOTS / BEACONS)
# ---------------------------------------------------------------------------

X0, X1, Z0, Z1 = -25.0, -13.0, -24.0, -12.0
FLOOR = 2.0
NORTH_GAP = (-20.5, -17.5)   # on z = -12
EAST_GAP = (-19.5, -16.5)    # on x = -13
WALL_IN = 0.05               # outer face this far inside the platform edge
WALL_T = 0.2                 # wall thickness
WALL_TOP = 2.18              # body top; the beam rides 5 mm above it to 2.225
BEAM_W, BEAM_H = 0.07, 0.04


# ---------------------------------------------------------------------------
# Materials. sRGB hex in, linear base colour out — the glTF exporter writes
# linear factors and Babylon reads them back the same way.
# ---------------------------------------------------------------------------

def linear(hex_):
    hex_ = hex_.lstrip('#')
    out = []
    for i in range(0, 6, 2):
        c = int(hex_[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def scale_hex(hex_, k):
    """Color3.scale(k) from rider.js, in sRGB: the same hue, darker."""
    hex_ = hex_.lstrip('#')
    return '#' + ''.join(f'{min(255, round(int(hex_[i:i + 2], 16) * k)):02x}' for i in range(0, 6, 2))


def lerp_hex(a, b, t):
    """Color3.Lerp from rider.js, in sRGB."""
    a, b = a.lstrip('#'), b.lstrip('#')
    return '#' + ''.join(
        f'{round(int(a[i:i + 2], 16) * (1 - t) + int(b[i:i + 2], 16) * t):02x}' for i in range(0, 6, 2))


def mat(name, hex_, metal=0.0, rough=0.55, emit=0.0, emit_hex=None):
    """
    One Principled material. Emission strength stays at or under 1.5 — above
    that the arcade's GlowLayer turns anything bigger than a sliver white.
    """
    m = bpy.data.materials.new(name)
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
    return m


# The rim: scene.js buildRimMaterial() emissive Color3(0.2, 0.85, 1.0) * 0.8,
# which as a hex is #33d9ff before the scale; 0.8 of it is carried by the
# emission strength rather than baked into the colour.
RIM_CYAN = '#33d9ff'
# The six riders (config.js PALETTE): Bolt, Mochi, Kiwi, Tango, Plum, Zippy.
PALETTE = ['#3aa0ff', '#ff5fb4', '#5cf07a', '#ffa03c', '#7838e8', '#ed3038']
SEATS = ['Bolt', 'Mochi', 'Kiwi', 'Tango', 'Plum', 'Zippy']

WALL = mat('NFv2 rim wall', '#121a33', 0.45, 0.45)
WALL_FACE = mat('NFv2 rim wall face', '#1d2a50', 0.4, 0.4)
BEAM = mat('NFv2 rim beam', RIM_CYAN, 0.0, 0.3, 1.2)
TICK = mat('NFv2 rim tick', RIM_CYAN, 0.0, 0.3, 1.0)
PYLON = mat('NFv2 pylon steel', '#1a2240', 0.6, 0.4)
PYLON_FOOT = mat('NFv2 pylon foot', '#0c1124', 0.5, 0.5)
CAP = mat('NFv2 neon cap', '#bff4ff', 0.0, 0.25, 1.5, RIM_CYAN)
# The game's other neon, the pink of its title and of Mochi, for the pylon
# bands so the corners are not all one colour.
PINK = mat('NFv2 neon pink', '#ff5fb4', 0.0, 0.3, 1.2)
BOARD = mat('NFv2 scoreboard body', '#0b1022', 0.4, 0.5)
BOARD_FRAME = mat('NFv2 scoreboard frame', '#26345e', 0.6, 0.35)
BAR_DIM = [mat(f'NFv2 bar {n}', scale_hex(h, 0.55), 0.0, 0.5, 0.45, h) for n, h in zip(SEATS, PALETTE)]
BAR_HEAD = [mat(f'NFv2 bar head {n}', lerp_hex(h, '#ffffff', 0.3), 0.0, 0.3, 1.4, h)
            for n, h in zip(SEATS, PALETTE)]

# Rider. The default tint is Tango (PALETTE[3]) so the template, uncloned, is
# an orange fox — the codex fox's own colour — and every derived shade below
# is the rider.js recipe applied to it, so a runtime that recolours with the
# same recipe lands where the author did.
TINT = PALETTE[3]
TINT_FUR = mat('NF tint fur', TINT, 0.0, 0.75)                              # albedo = colour
TINT_SHADOW = mat('NF tint fur shadow', scale_hex(TINT, 0.45), 0.0, 0.8)    # albedo = colour * .45
TINT_ACCENT = mat('NF tint accent', lerp_hex(TINT, '#ffffff', 0.3), 0.0, 0.35, 1.0, TINT)  # trim glow
TINT_ORB = mat('NF tint orb', scale_hex(TINT, 0.6), 0.1, 0.3, 0.6, TINT)    # colour*.6, emissive .6
TINT_RINGS = mat('NF tint rings', lerp_hex(TINT, '#ffffff', 0.4), 0.0, 0.25, 1.5,
                 lerp_hex(TINT, '#ffffff', 0.4))
IVORY = mat('NF Rider ivory', '#f2e3c4', 0.0, 0.7)     # build_fox_detailed.py 'Warm ivory muzzle'
INK = mat('NF Rider ink', '#2a1a12', 0.0, 0.4)          # 'Espresso eyelids and nose'
EYE = mat('NF Rider eye white', '#fbf6ea', 0.0, 0.2)
IRIS = mat('NF Rider iris', '#c9741c', 0.0, 0.3)        # 'Iris amber'


# ---------------------------------------------------------------------------
# Geometry helpers. Everything is built from raw vertices in game space, so
# any orientation is just arithmetic and nothing depends on operator state.
# BUCKET collects what each part of the build makes, so the static props,
# the orb and the fox can be joined separately.
# ---------------------------------------------------------------------------

BUCKET = []


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
    BUCKET.append(obj)
    return obj


def box(name, centre, size, material, yaw=0.0):
    """Box in game space, turned about y by yaw (radians, +x toward -z)."""
    cx, cy, cz = centre
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    c, s = math.cos(yaw), math.sin(yaw)
    verts = []
    for dy in (-hy, hy):
        for dx, dz in ((-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz)):
            verts.append((cx + dx * c + dz * s, cy + dy, cz - dx * s + dz * c))
    faces = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    return mesh_obj(name, verts, faces, material)


def span(name, a, b, y0, y1, thick, material):
    """A wall-like box from (x, z) a to b, between heights y0 and y1."""
    ax, az = a
    bx, bz = b
    length = math.hypot(bx - ax, bz - az)
    yaw = -math.atan2(bz - az, bx - ax)
    return box(name, ((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2), (length, y1 - y0, thick), material, yaw)


def frame_from(normal):
    """An orthonormal (u, v, n) whose third axis is `normal` (game space)."""
    n = Vector(normal).normalized()
    ref = Vector((0, 1, 0)) if abs(n.y) < 0.9 else Vector((1, 0, 0))
    u = ref.cross(n).normalized()
    v = n.cross(u).normalized()
    return u, v, n


def ellip(name, centre, radii, material, seg=12, rings=8, axes=None, smooth=True):
    """
    A UV ellipsoid, game space. `axes` (u, v, w) orients its x, y, z radii;
    default is the world axes. A UV sphere rather than an icosphere so the
    poly count can be set per part: the head gets more rings than a pupil.
    """
    u, v, w = axes or (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    C = Vector(centre)
    verts = [tuple(C - v * radii[1])]
    for i in range(1, rings):
        phi = math.pi * i / rings
        y = -math.cos(phi)
        r = math.sin(phi)
        for j in range(seg):
            t = math.tau * j / seg
            p = C + u * (math.cos(t) * r * radii[0]) + v * (y * radii[1]) + w * (math.sin(t) * r * radii[2])
            verts.append(tuple(p))
    verts.append(tuple(C + v * radii[1]))
    top = len(verts) - 1
    faces = [[0, 1 + (j + 1) % seg, 1 + j] for j in range(seg)]
    for i in range(rings - 2):
        a, b = 1 + i * seg, 1 + (i + 1) * seg
        faces += [[a + j, a + (j + 1) % seg, b + (j + 1) % seg, b + j] for j in range(seg)]
    last = 1 + (rings - 2) * seg
    faces += [[last + j, last + (j + 1) % seg, top] for j in range(seg)]
    return mesh_obj(name, verts, faces, material, smooth)


def loft(name, path, radii, material, sides=8, flat=1.0, up=(0, 1, 0), smooth=True):
    """
    A tapered tube along a polyline of game-space points, with a radius per
    point (a radius of 0 closes to a tip). `flat` squashes the cross-section
    along the axis nearest `up`, which is how an ear becomes a blade and a
    tail a brush rather than a hose.
    """
    pts = [Vector(p) for p in path]
    upv = Vector(up)
    verts, faces = [], []
    for i, P in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = d.cross(upv)
        if a.length < 1e-4:
            a = d.cross(Vector((1, 0, 0)))
        a.normalize()
        b = a.cross(d).normalized()
        for j in range(sides):
            t = math.tau * j / sides
            verts.append(tuple(P + a * math.cos(t) * radii[i] + b * math.sin(t) * radii[i] * flat))
    n = len(pts)
    for i in range(n - 1):
        faces += [[i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + (j + 1) % sides,
                   (i + 1) * sides + j] for j in range(sides)]
    faces.append(list(range(sides))[::-1])
    faces.append([(n - 1) * sides + j for j in range(sides)])
    return mesh_obj(name, verts, faces, material, smooth)


def torus(name, centre, axis, radius, tube, material, seg=32, sides=5, squash=(1, 1)):
    """A ring of `radius` around `axis` through `centre` (game space)."""
    u, v, n = frame_from(axis)
    C = Vector(centre)
    verts = []
    for i in range(seg):
        t = math.tau * i / seg
        radial = u * math.cos(t) * squash[0] + v * math.sin(t) * squash[1]
        ring_c = C + radial * radius
        rd = radial.normalized()
        for j in range(sides):
            s = math.tau * j / sides
            verts.append(tuple(ring_c + rd * math.cos(s) * tube + n * math.sin(s) * tube))
    faces = []
    for i in range(seg):
        a, b = i * sides, ((i + 1) % seg) * sides
        faces += [[a + j, a + (j + 1) % sides, b + (j + 1) % sides, b + j] for j in range(sides)]
    return mesh_obj(name, verts, faces, material, True)


# ---------------------------------------------------------------------------
# 1a. The rim. Each straight run is one wall segment; BLOCKERS records them in
# room.js's {x, z, hx, hz, top, base} shape as they are made.
# ---------------------------------------------------------------------------

BLOCKERS = []


def blocker(label, x0, x1, z0, z1, top):
    BLOCKERS.append((label, dict(x=round((x0 + x1) / 2, 3), z=round((z0 + z1) / 2, 3),
                                 hx=round(abs(x1 - x0) / 2, 3), hz=round(abs(z1 - z0) / 2, 3),
                                 top=round(top, 3), base=FLOOR)))


def wall_run(label, axis, fixed, a, b, outward):
    """
    One straight wall: `axis` 'x' runs along x at z = fixed, 'z' along z at
    x = fixed. `outward` is +1/-1, the direction off the platform. The body
    is dark, its inner face carries a lighter plate (5 mm proud), the beam
    rides 5 mm above the crest and ticks every metre glow on both faces.
    """
    mid = fixed - outward * (WALL_IN + WALL_T / 2)       # wall centre-line
    inner = fixed - outward * (WALL_IN + WALL_T)         # face toward the arena
    outer = fixed - outward * WALL_IN                     # face toward the sky
    if axis == 'x':
        P = lambda s, o: (s, o)                           # noqa: E731  (along, across) -> (x, z)
    else:
        P = lambda s, o: (o, s)                           # noqa: E731
    span(f'{label} wall', P(a, mid), P(b, mid), FLOOR, WALL_TOP, WALL_T, WALL)
    # A lighter skirt plate on the arena side, the "lit" face the riders see.
    span(f'{label} face', P(a, inner - outward * 0.005), P(b, inner - outward * 0.005),
         FLOOR + 0.03, WALL_TOP - 0.05, 0.004, WALL_FACE)
    span(f'{label} beam', P(a, mid), P(b, mid), WALL_TOP + 0.005, WALL_TOP + 0.005 + BEAM_H, BEAM_W, BEAM)
    n = max(1, int(round(abs(b - a))))
    for k in range(n):
        s = a + (b - a) * (k + 0.5) / n
        # 7 mm proud of the sky face; 12 mm off the arena face, clear of
        # its face plate.
        for face, o in ((outer, outer + outward * 0.007), (inner, inner - outward * 0.012)):
            span(f'{label} tick', P(s - 0.012, o), P(s + 0.012, o), FLOOR + 0.05, FLOOR + 0.13, 0.006, TICK)
    xs = sorted((P(a, mid)[0], P(b, mid)[0]))
    zs = sorted((P(a, mid)[1], P(b, mid)[1]))
    if axis == 'x':
        blocker(label, xs[0], xs[1], mid - WALL_T / 2, mid + WALL_T / 2, WALL_TOP + 0.005 + BEAM_H)
    else:
        blocker(label, mid - WALL_T / 2, mid + WALL_T / 2, zs[0], zs[1], WALL_TOP + 0.005 + BEAM_H)


def gate_post(x, z):
    """The glowing end of a wall at a gap: a little proud post with a cap."""
    box('Gate post', (x, FLOOR + 0.16, z), (0.24, 0.32, 0.24), PYLON)
    box('Gate post cap', (x, FLOOR + 0.335, z), (0.16, 0.03, 0.16), CAP)


# North and south walls run the whole width; west and east fit between them,
# so no two segments overlap at a corner.
in_n = Z1 - WALL_IN - WALL_T      # inner edges of the N/S walls
in_s = Z0 + WALL_IN + WALL_T
wall_run('North west', 'x', Z1, X0 + WALL_IN, NORTH_GAP[0], +1)
wall_run('North east', 'x', Z1, NORTH_GAP[1], X1 - WALL_IN, +1)
wall_run('South', 'x', Z0, X0 + WALL_IN, X1 - WALL_IN, -1)
wall_run('West', 'z', X0, in_s, in_n, -1)
wall_run('East south', 'z', X1, in_s, EAST_GAP[0], +1)
wall_run('East north', 'z', X1, EAST_GAP[1], in_n, +1)
# Gate posts sit at the gap ends, on the wall line, inside the wall's own
# footprint plus 2 cm each way — so the wall blockers already cover them
# except for their height, which gets its own small blocker.
zc = Z1 - WALL_IN - WALL_T / 2
xc = X1 - WALL_IN - WALL_T / 2
for gx in (NORTH_GAP[0] - 0.12, NORTH_GAP[1] + 0.12):
    gate_post(gx, zc)
    blocker('Gate post', gx - 0.12, gx + 0.12, zc - 0.12, zc + 0.12, FLOOR + 0.35)
for gz in (EAST_GAP[0] - 0.12, EAST_GAP[1] + 0.12):
    gate_post(xc, gz)
    blocker('Gate post', xc - 0.12, xc + 0.12, gz - 0.12, gz + 0.12, FLOOR + 0.35)


# ---------------------------------------------------------------------------
# 1b. Four corner light pylons, inset 0.4 m. A slim square post on a foot,
# a cyan neon strip up the arena side, a pink band, and a neon cap — the
# floodlit arena of the game's attract mode, without a single real light.
# ---------------------------------------------------------------------------

PYLON_H = 2.8


def pylon(x, z):
    # The strip faces the arena centre so a pylon reads lit from inside.
    yaw = math.atan2(-(-18 - z), (-19 - x))  # local +x points at the centre
    box('Pylon foot', (x, FLOOR + 0.05, z), (0.3, 0.1, 0.3), PYLON_FOOT, yaw)
    box('Pylon post', (x, FLOOR + PYLON_H / 2, z), (0.12, PYLON_H, 0.12), PYLON, yaw)
    c, s = math.cos(yaw), math.sin(yaw)
    fx, fz = x + 0.065 * c, z - 0.065 * s
    box('Pylon strip', (fx, FLOOR + 0.25 + (PYLON_H - 0.6) / 2, fz), (0.004, PYLON_H - 0.6, 0.025), TICK, yaw)
    box('Pylon band', (x, FLOOR + PYLON_H - 0.45, z), (0.135, 0.035, 0.135), PINK, yaw)
    box('Pylon collar', (x, FLOOR + PYLON_H + 0.02, z), (0.2, 0.04, 0.2), PYLON_FOOT, yaw)
    box('Pylon cap', (x, FLOOR + PYLON_H + 0.07, z), (0.14, 0.05, 0.14), CAP, yaw)
    blocker('Pylon', x - 0.15, x + 0.15, z - 0.15, z + 0.15, FLOOR + PYLON_H + 0.095)


for px, pz in ((X0 + 0.4, Z0 + 0.4), (X1 - 0.4, Z0 + 0.4), (X0 + 0.4, Z1 - 0.4), (X1 - 0.4, Z1 - 0.4)):
    pylon(px, pz)


# ---------------------------------------------------------------------------
# 1c. The scoreboard: a slim double-sided board on a plinth near the north-
# west corner, turned to face the arena and the welcome cloud (+x, a little
# toward -z). Six stacked standings bars in PALETTE order, longest first, the
# same on both faces so it reads from the arena and from the gap.
# ---------------------------------------------------------------------------

SBX, SBZ = -24.0, -13.2
SB_YAW = math.atan2(0.35, 1.0)          # normal (cos, -sin) = toward +x, -z
SB_W, SB_D = 0.62, 0.12                 # across, deep (the deep axis is the normal)
SB_Y0, SB_Y1 = FLOOR + 0.7, FLOOR + 2.75
nx, nz = math.cos(SB_YAW), -math.sin(SB_YAW)   # board normal in game x/z
ax_, az_ = math.sin(SB_YAW), math.cos(SB_YAW)  # across the board, in game x/z


def on_board(across, y, out):
    """Board-local (across, y, out along the normal) to game space."""
    return (SBX + ax_ * across + nx * out, y, SBZ + az_ * across + nz * out)


def board_box(name, across, y, w, h, out, d, material):
    """A box in board space: w across, h tall, d deep, centred `out` off the plane."""
    # box() takes yaw with local x mapped to (cos, -sin): that is the normal
    # here, so the board's depth is the box's x size and its width the z size.
    return box(name, on_board(across, y, out), (d, h, w), material, SB_YAW)


box('Scoreboard plinth', (SBX, FLOOR + 0.06, SBZ), (0.5, 0.12, 0.8), PYLON_FOOT, SB_YAW)
board_box('Scoreboard leg', 0, FLOOR + 0.41, 0.16, 0.58, 0, 0.1, PYLON)
board_box('Scoreboard body', 0, (SB_Y0 + SB_Y1) / 2, SB_W, SB_Y1 - SB_Y0, 0, SB_D, BOARD)
# Frame rails along both long edges and the head, 5 mm proud of the body.
for side in (-1, 1):
    board_box('Scoreboard rail', side * (SB_W / 2 + 0.02), (SB_Y0 + SB_Y1) / 2, 0.04, SB_Y1 - SB_Y0 + 0.04,
              0, SB_D + 0.01, BOARD_FRAME)
board_box('Scoreboard head', 0, SB_Y1 + 0.05, SB_W + 0.1, 0.1, 0, SB_D + 0.03, BOARD_FRAME)
board_box('Scoreboard crest', 0, SB_Y1 + 0.12, SB_W + 0.02, 0.03, 0, 0.05, CAP)
board_box('Scoreboard sill', 0, SB_Y0 - 0.02, SB_W + 0.1, 0.04, 0, SB_D + 0.03, BOARD_FRAME)

LENGTHS = [1.0, 0.82, 0.68, 0.55, 0.41, 0.27]     # a standing, not a measurement
BAR_H, BAR_GAP = 0.16, 0.12
bar_left = -SB_W / 2 + 0.06
bar_max = SB_W - 0.12
top_bar = SB_Y1 - 0.32
for i, (frac, dim, head) in enumerate(zip(LENGTHS, BAR_DIM, BAR_HEAD)):
    y = top_bar - i * (BAR_H + BAR_GAP)
    L = bar_max * frac
    for face in (-1, 1):
        out = face * (SB_D / 2 + 0.006)
        # The dim body, then a short bright head at the bar's leading end and
        # a seat marker at its left — the bright parts are slivers.
        board_box('Scoreboard bar', bar_left + (L - 0.045) / 2, y, L - 0.045, BAR_H, out, 0.008, dim)
        board_box('Scoreboard bar head', bar_left + L - 0.02, y, 0.04, BAR_H, out, 0.012, head)
        # A hairline under every bar, as the game's HUD rules its standings.
        board_box('Scoreboard rule', bar_left + bar_max / 2, y - BAR_H / 2 - 0.035, bar_max, 0.008,
                  out, 0.004, BOARD_FRAME)

# Blocker: the axis-aligned box around the turned plinth (the biggest part).
corners = []
for da, dn in ((-0.4, -0.25), (0.4, -0.25), (0.4, 0.25), (-0.4, 0.25)):
    p = on_board(da, 0, dn)
    corners.append((p[0], p[2]))
blocker('Scoreboard', min(c[0] for c in corners), max(c[0] for c in corners),
        min(c[1] for c in corners), max(c[1] for c in corners), SB_Y1 + 0.135)

STATIC = list(BUCKET)
BUCKET.clear()


# ---------------------------------------------------------------------------
# 2. The rider template, at the world origin. Rider-local game space: y up,
# forward +z, the orb resting on y = 0.
# ---------------------------------------------------------------------------

R = 0.275                       # orb radius: 0.55 m across
ORB_C = Vector((0, R, 0))

# The orb: a smooth ball in the rider's colour and two energy rings, an
# equator and a meridian — exactly the two the concept fox's ball wears.
# Neither ring lies in the YZ plane, so rolling about local X turns both of
# them visibly; a ring about X would spin in place and hide the roll.
ellip('Orb', ORB_C, (R, R, R), TINT_ORB, seg=24, rings=12)
torus('Orb equator ring', ORB_C, (0, 1, 0), R + 0.004, 0.011, TINT_RINGS, seg=32, sides=4)
torus('Orb meridian ring', ORB_C, (0, 0, 1), R + 0.004, 0.011, TINT_RINGS, seg=32, sides=4)
ORB_PARTS = list(BUCKET)
BUCKET.clear()


def on_orb(x, z, lift):
    """A point `lift` above the orb's surface, over game-local (x, z)."""
    y = R + math.sqrt(max(0.0, R * R - x * x - z * z))
    n = (Vector((x, y, z)) - ORB_C).normalized()
    return ORB_C + n * (R + lift)


# Body: crouched low over the top of the ball, nose-heavy like the concept.
ellip('Fox body', (0, 0.67, -0.04), (0.118, 0.105, 0.19), TINT_FUR, seg=14, rings=9,
      axes=(Vector((1, 0, 0)), Vector((0, 1, 0.12)).normalized(), Vector((0, -0.12, 1)).normalized()))
ellip('Fox back shadow', (0, 0.725, -0.07), (0.085, 0.06, 0.15), TINT_SHADOW, seg=10, rings=6)
ellip('Fox chest ruff', (0, 0.705, 0.11), (0.085, 0.095, 0.07), IVORY, seg=10, rings=7)

# Head: big, as cartoon foxes are, and pushed forward over the front paws.
HEAD = Vector((0, 0.935, 0.15))
ellip('Fox head', HEAD, (0.148, 0.132, 0.138), TINT_FUR, seg=16, rings=10)
# The snout is a taper, not a ball: a round muzzle is what turned an early
# pass into a teddy bear. Cream underneath, the fur colour over the bridge.
loft('Fox muzzle', [(0, 0.875, 0.19), (0, 0.868, 0.28), (0, 0.878, 0.352), (0, 0.886, 0.372)],
     [0.07, 0.048, 0.022, 0.0], IVORY, sides=9, flat=0.78)
loft('Fox snout bridge', [(0, 0.925, 0.2), (0, 0.9, 0.29), (0, 0.892, 0.34)],
     [0.05, 0.03, 0.0], TINT_FUR, sides=7, flat=0.55)
ellip('Fox nose', (0, 0.889, 0.367), (0.02, 0.016, 0.014), INK, seg=8, rings=5)
for side in (-1, 1):
    # Cheek fans: cream blades swept back off the jaw (the concept's
    # 'Wind swept cheek fur'), which is most of what makes the face a fox's.
    loft('Fox cheek fan', [(side * 0.09, 0.865, 0.19), (side * 0.15, 0.845, 0.13), (side * 0.175, 0.825, 0.06)],
         [0.045, 0.028, 0.0], IVORY, sides=6, flat=0.45)
    # Ears: tall blades with an ivory inner, the inner 6 mm in front.
    base = Vector((side * 0.085, 1.035, 0.13))
    tip = Vector((side * 0.125, 1.2, 0.105))
    loft('Fox ear', [base, base.lerp(tip, 0.5), tip], [0.052, 0.034, 0.0], TINT_FUR, sides=6, flat=0.4,
         up=(0, 0, 1))
    ib = base + Vector((0, 0.01, 0.014))
    it = tip + Vector((0, -0.03, 0.01))
    loft('Fox inner ear', [ib, ib.lerp(it, 0.5), it], [0.03, 0.02, 0.0], IVORY, sides=5, flat=0.3,
         up=(0, 0, 1))
    loft('Fox ear tip', [tip + Vector((0, -0.04, 0)), tip + Vector((0, 0.002, 0))], [0.02, 0.0],
         TINT_SHADOW, sides=5, flat=0.6, up=(0, 0, 1))
    # Eyes: big amber eyes on the head's surface, each layer facing out along
    # the head's normal there and stacked ≥5 mm so none of them z-fight.
    ec = Vector((side * 0.062, 0.975, 0.0))
    d = Vector((side * 0.062, 0.975 - HEAD.y, 0))
    dz = math.sqrt(max(0.0, 0.135 ** 2 - d.x ** 2 - d.y ** 2))
    surf = Vector((ec.x, ec.y, HEAD.z + dz))
    nrm = Vector((d.x / 0.148 ** 2, d.y / 0.132 ** 2, dz / 0.138 ** 2)).normalized()
    u, v, w = frame_from(nrm)
    ellip('Fox eye', surf - nrm * 0.008, (0.046, 0.052, 0.022), EYE, seg=10, rings=6, axes=(u, v, w))
    ellip('Fox iris', surf + nrm * 0.008, (0.035, 0.04, 0.012), IRIS, seg=10, rings=5, axes=(u, v, w))
    ellip('Fox pupil', surf + nrm * 0.019 - u * side * 0.004, (0.021, 0.028, 0.008), INK, seg=8, rings=4,
          axes=(u, v, w))
    ellip('Fox catchlight', surf + nrm * 0.03 + v * 0.014 - u * side * 0.012, (0.009, 0.009, 0.004),
          EYE, seg=6, rings=3, axes=(u, v, w))
    # A brow of shadow fur over each eye, which gives the face its eagerness.
    loft('Fox brow', [surf + v * 0.06 - u * side * 0.035 + nrm * 0.0, surf + v * 0.066 + u * side * 0.035],
         [0.012, 0.008], TINT_SHADOW, sides=5)

# Crown forelocks swept back by the wind (the concept's 'Swept crown forelock').
for k, x in enumerate((-0.05, 0.0, 0.05)):
    loft('Fox forelock', [(x, 1.04, 0.16), (x * 1.2, 1.075, 0.08), (x * 1.4, 1.065, -0.0)],
         [0.03, 0.022, 0.0], TINT_FUR if k != 1 else TINT_SHADOW, sides=5, flat=0.5)

# Legs. Fore paws plant on the ball's front shoulder, hind paws on its back,
# so the fox is visibly ON the orb rather than hovering over it.
for side in (-1, 1):
    fp = on_orb(side * 0.06, 0.13, 0.028)
    shoulder = Vector((side * 0.07, 0.665, 0.075))
    loft('Fox fore leg', [shoulder, shoulder.lerp(fp, 0.5) + Vector((0, 0, 0.012)), fp],
         [0.038, 0.03, 0.026], TINT_SHADOW, sides=7)
    ellip('Fox fore paw', fp + Vector((0, 0, 0.012)), (0.034, 0.024, 0.042), IVORY, seg=8, rings=5)
    hp = on_orb(side * 0.075, -0.12, 0.026)
    ellip('Fox haunch', (side * 0.085, 0.645, -0.13), (0.055, 0.078, 0.088), TINT_FUR, seg=10, rings=7)
    loft('Fox hind leg', [Vector((side * 0.09, 0.615, -0.15)), hp + Vector((0, 0.03, -0.01)), hp],
         [0.034, 0.028, 0.024], TINT_SHADOW, sides=7)
    ellip('Fox hind paw', hp + Vector((0, 0, 0.01)), (0.032, 0.022, 0.04), IVORY, seg=8, rings=5)

# The brush: a fat tapering tube streaming back and up, cream-tipped.
TAIL = [(0, 0.69, -0.19), (0, 0.72, -0.3), (0.02, 0.79, -0.43), (0.04, 0.87, -0.55), (0.05, 0.915, -0.64)]
loft('Fox tail', TAIL, [0.045, 0.08, 0.098, 0.088, 0.066], TINT_FUR, sides=10, flat=0.82)
loft('Fox tail tip', [(0.045, 0.905, -0.615), (0.055, 0.93, -0.69), (0.06, 0.945, -0.76)],
     [0.07, 0.05, 0.0], IVORY, sides=10, flat=0.82)

# The trim, in the rider's colour and glowing: a racing girth and a harness
# strap over the back — rider.js 'Cyan accents', the part a GlowLayer is for.
# (A collar was tried and cut: under the big head it read as a loose hoop.)
loft('Fox harness', [(0, 0.79, 0.05), (0, 0.783, -0.04), (0, 0.76, -0.15)], [0.014, 0.014, 0.012],
     TINT_ACCENT, sides=5, flat=0.5)
torus('Fox girth', (0, 0.67, -0.03), (0, 0.12, 1), 0.112, 0.01, TINT_ACCENT, seg=20, sides=4,
      squash=(1.06, 0.98))
FOX_PARTS = list(BUCKET)
BUCKET.clear()


# ---------------------------------------------------------------------------
# Joins. Static props by material, one node each, named "NFv2 <material>".
# The orb and the fox are each one object (a multi-material mesh), parented
# to the "NF Rider" empty — two children, never joined with each other.
# ---------------------------------------------------------------------------

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    out = bpy.context.view_layer.objects.active
    out.name = name
    out.data.name = name
    return out


static_nodes = []
groups = {}
for o in STATIC:
    groups.setdefault(o.data.materials[0].name, []).append(o)
for mname, objs in groups.items():
    static_nodes.append(join(objs, mname if mname.startswith('NFv2 ') else f'NFv2 {mname}'))

orb = join(ORB_PARTS, 'NF Rider orb')
fox = join(FOX_PARTS, 'NF Rider fox')
# One slot per material in each child.
for obj in (orb, fox):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.material_slot_remove_unused()  # join already shares slots by material

# The orb's origin is its centre, so the runtime's roll about local X is a
# roll and not an orbit.
off = point(*ORB_C)
orb.data.transform(Matrix.Translation(-off))
orb.location = off

root = bpy.data.objects.new('NF Rider', None)
bpy.context.collection.objects.link(root)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 0.3
for child in (orb, fox):
    child.parent = root
    child.matrix_parent_inverse = Matrix.Identity(4)


# ---------------------------------------------------------------------------
# Report and export.
# ---------------------------------------------------------------------------

def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


static_tris = sum(tris(o) for o in static_nodes)
rider_tris = tris(orb) + tris(fox)
fox_top = max((fox.matrix_world @ v.co).z for v in fox.data.vertices)
print('NFV2 static nodes', len(static_nodes), 'tris', static_tris)
print('NFV2 rider tris orb', tris(orb), 'fox', tris(fox), 'height', round(fox_top, 4),
      'orb R', R, 'fox materials', [m.name for m in fox.data.materials],
      'orb materials', [m.name for m in orb.data.materials])
used = {m.name for o in static_nodes + [orb, fox] for m in o.data.materials}
print('NFV2 materials', len(used))
for label, b in BLOCKERS:
    print('NFV2 BLOCKER', label, b)

bpy.ops.object.select_all(action='DESELECT')
for o in static_nodes + [root, orb, fox]:
    o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'neonfox-island.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'neonfox-island.glb'),
    export_format='GLB', use_selection=True, export_apply=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True)
print('NEONFOX_ISLAND_V2_COMPLETE')
