#!/usr/bin/env python3
"""Generate the ARCADE icon set.

    python3 tools/make-icons.py

Writes icons/icon-192.png, icon-512.png, icon-180.png and
icon-maskable-512.png. Requires Pillow. No fonts, no network: the motif is
four rounded tiles.

THE MOTIF: a 2x2 grid of glowing tiles on a near-black cabinet, one tile per
colour family of the games it launches (teal, violet, blue, amber), with a
white PLAY triangle punched into the amber tile. Reads as "a launcher of
games" at 24 px because it is four big hue blocks with hard edges.

  icon-192 / icon-512       rounded square, transparent corners
  icon-180                  opaque square (iOS masks apple-touch-icons itself)
  icon-maskable-512         opaque, motif shrunk into the 80% safe zone

Rendered 4x and downsampled with LANCZOS.
"""

import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")

BG = (11, 9, 18)              # #0b0912, matches the arcade cabinet
BG_LIGHT = (26, 21, 40)       # top of the vignette
TILES = [
    ((42, 209, 201), (16, 140, 136)),    # teal   (fishtank)
    ((160, 122, 255), (110, 70, 220)),   # violet (swirls)
    ((70, 160, 240), (28, 100, 190)),    # blue   (dam break)
    ((250, 190, 60), (215, 135, 20)),    # amber  (maxgear)
]
PLAY = (255, 255, 255)

SS = 4  # supersample factor


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def vgrad(size, top, bot):
    """A size x size RGBA image with a vertical gradient."""
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(top, bot, y / max(1, size - 1)) + (255,))
    return img


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def render(size, *, rounded, inset):
    """Draw the icon at `size` px. `inset` is the fraction of the canvas kept
    clear around the motif (0.10 for normal, 0.20 for maskable)."""
    s = size * SS
    img = vgrad(s, BG_LIGHT, BG)

    # tile geometry
    pad = s * inset
    gap = s * 0.055
    tile = (s - 2 * pad - gap) / 2
    r_tile = tile * 0.28

    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    tiles = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    for idx, (hi, lo) in enumerate(TILES):
        col, row = idx % 2, idx // 2
        x0 = pad + col * (tile + gap)
        y0 = pad + row * (tile + gap)
        box = [x0, y0, x0 + tile, y0 + tile]

        # soft glow under each tile
        g = int(s * 0.03)
        gd.rounded_rectangle([box[0] - g, box[1] - g, box[2] + g, box[3] + g],
                             radius=r_tile + g, fill=hi + (110,))

        # gradient-filled rounded tile
        t = int(round(tile))
        face = vgrad(t, hi, lo)
        face.putalpha(rounded_mask(t, int(r_tile)))
        tiles.alpha_composite(face, (int(round(x0)), int(round(y0))))

        # a highlight line along the top edge
        td = ImageDraw.Draw(tiles)
        td.rounded_rectangle([x0 + tile * 0.12, y0 + tile * 0.06, x0 + tile * 0.88, y0 + tile * 0.10],
                             radius=tile * 0.02, fill=(255, 255, 255, 70))

    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.035))
    img.alpha_composite(glow)
    img.alpha_composite(tiles)

    # PLAY triangle on the last (amber) tile
    x0 = pad + (tile + gap)
    y0 = pad + (tile + gap)
    cx, cy = x0 + tile * 0.54, y0 + tile * 0.5
    h = tile * 0.42
    w = h * 0.9
    tri = [(cx - w / 2, cy - h / 2), (cx + w / 2, cy), (cx - w / 2, cy + h / 2)]
    ImageDraw.Draw(img).polygon(tri, fill=PLAY + (255,))

    if rounded:
        img.putalpha(rounded_mask(s, int(s * 0.22)))

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-512.png", 512, True, 0.11),
        ("icon-192.png", 192, True, 0.11),
        ("icon-180.png", 180, False, 0.11),
        ("icon-maskable-512.png", 512, False, 0.20),
    ]
    for name, size, rounded, inset in jobs:
        path = os.path.join(OUT, name)
        render(size, rounded=rounded, inset=inset).save(path, optimize=True)
        print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
