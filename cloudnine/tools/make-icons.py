#!/usr/bin/env python3
"""Generate the CLOUD NINE icon set.

    python3 cloudnine/tools/make-icons.py

Writes cloudnine/icons/icon-192.png, icon-512.png, icon-180.png and
icon-maskable-512.png. Requires Pillow. No fonts, no network.

THE MOTIF: one arcade cabinet, head on, with the gopher's face on its screen.
The body is the room's "Midnight enamel", the side cheeks and the marquee are
"Mint neon", the coin slot is "Coral neon", and the head inside the screen is
the scarf gopher's cream fur with its two round ears breaking the top edge of
the glass. At 24 px that is a dark rounded block with a glowing eye-level
rectangle and two bumps — a cabinet with somebody in it, which is the whole
idea of the game.

Colours are the same Blender materials the room is built from
(assets/3d/source/build_arcade.py), converted from linear 0..1 to sRGB bytes
by eye rather than by formula, because the icon is art and not a render.

  icon-192 / icon-512       rounded square, transparent corners
  icon-180                  opaque square (iOS masks apple-touch-icons itself)
  icon-maskable-512         opaque, motif shrunk into the 80% safe zone

Rendered 4x and downsampled with LANCZOS.
"""

import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")

ENAMEL = (10, 14, 28)       # Midnight enamel, lifted enough to read as a body
ENAMEL_HI = (24, 31, 58)    # top of the room's vignette
MINT = (18, 217, 184)       # Mint neon
MINT_DK = (8, 120, 104)
CORAL = (242, 30, 82)       # Coral neon
GLASS = (6, 16, 24)         # Screen glass
FUR = (238, 233, 214)       # CreamFur
FUR_SHADE = (196, 188, 166)
INK = (12, 16, 22)          # eyes and nose

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
    clear around the cabinet (0.10 normally, 0.20 for the maskable variant)."""
    s = size * SS
    img = vgrad(s, ENAMEL_HI, ENAMEL)

    pad = s * inset
    span = s - 2 * pad

    # The cabinet: a tall rounded block, a touch narrower than it is high.
    cab_w = span * 0.86
    cab_h = span
    cab_x = (s - cab_w) / 2
    cab_y = pad

    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)

    # Neon side cheeks, drawn as one glowing block the body then sits on top of.
    gd.rounded_rectangle(
        [cab_x, cab_y, cab_x + cab_w, cab_y + cab_h],
        radius=cab_w * 0.16,
        fill=MINT + (150,),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.03))
    img.alpha_composite(glow)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle(
        [cab_x, cab_y, cab_x + cab_w, cab_y + cab_h],
        radius=cab_w * 0.16,
        fill=MINT + (255,),
    )
    d.rounded_rectangle(
        [cab_x, cab_y + cab_h * 0.5, cab_x + cab_w, cab_y + cab_h],
        radius=cab_w * 0.16,
        fill=MINT_DK + (255,),
    )

    # The body, inset from the cheeks so the neon shows as a rim.
    rim = cab_w * 0.11
    body = [cab_x + rim, cab_y + cab_h * 0.055, cab_x + cab_w - rim, cab_y + cab_h]
    d.rounded_rectangle(body, radius=cab_w * 0.09, fill=ENAMEL + (255,))

    # Marquee: a mint bar across the top of the body.
    d.rounded_rectangle(
        [body[0] + rim * 0.2, cab_y + cab_h * 0.085, body[2] - rim * 0.2, cab_y + cab_h * 0.175],
        radius=cab_w * 0.03,
        fill=MINT + (255,),
    )

    # The glass, and a pool of its own light behind the gopher.
    gx0 = body[0] + rim * 0.35
    gx1 = body[2] - rim * 0.35
    gy0 = cab_y + cab_h * 0.225
    gy1 = cab_y + cab_h * 0.60
    d.rounded_rectangle([gx0, gy0, gx1, gy1], radius=cab_w * 0.05, fill=GLASS + (255,))

    screen = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(screen)
    sd.ellipse(
        [(gx0 + gx1) / 2 - (gx1 - gx0) * 0.5, (gy0 + gy1) / 2 - (gy1 - gy0) * 0.55,
         (gx0 + gx1) / 2 + (gx1 - gx0) * 0.5, (gy0 + gy1) / 2 + (gy1 - gy0) * 0.55],
        fill=MINT + (90,),
    )
    screen = screen.filter(ImageFilter.GaussianBlur(s * 0.02))
    # Keep the light inside the glass; a CRT does not bleed onto its own bezel.
    clip = Image.new("L", (s, s), 0)
    ImageDraw.Draw(clip).rounded_rectangle([gx0, gy0, gx1, gy1], radius=cab_w * 0.05, fill=255)
    img.paste(Image.alpha_composite(img.crop((0, 0, s, s)), screen), (0, 0), clip)

    # The gopher, filling the glass: head, two ears, two eyes, a muzzle.
    d = ImageDraw.Draw(img)
    cx = (gx0 + gx1) / 2
    head_r = (gx1 - gx0) * 0.30
    cy = gy0 + (gy1 - gy0) * 0.62
    ear_r = head_r * 0.42
    for sign in (-1, 1):
        ex = cx + sign * head_r * 0.82
        ey = cy - head_r * 0.72
        d.ellipse([ex - ear_r, ey - ear_r, ex + ear_r, ey + ear_r], fill=FUR_SHADE + (255,))
        d.ellipse([ex - ear_r * 0.55, ey - ear_r * 0.55, ex + ear_r * 0.55, ey + ear_r * 0.55],
                  fill=FUR + (255,))
    d.ellipse([cx - head_r, cy - head_r, cx + head_r, cy + head_r], fill=FUR + (255,))

    eye_r = head_r * 0.19
    for sign in (-1, 1):
        ex = cx + sign * head_r * 0.40
        ey = cy - head_r * 0.10
        d.ellipse([ex - eye_r, ey - eye_r, ex + eye_r, ey + eye_r], fill=INK + (255,))
    muzzle_r = head_r * 0.34
    my = cy + head_r * 0.40
    d.ellipse([cx - muzzle_r, my - muzzle_r * 0.72, cx + muzzle_r, my + muzzle_r * 0.72],
              fill=FUR_SHADE + (255,))
    nose_r = head_r * 0.11
    d.ellipse([cx - nose_r, my - nose_r * 1.4, cx + nose_r, my + nose_r * 0.2], fill=INK + (255,))

    # Control deck and the coral coin slot, so the bottom half is not blank.
    deck_y = cab_y + cab_h * 0.70
    d.rounded_rectangle([body[0] + rim * 0.1, deck_y, body[2] - rim * 0.1, deck_y + cab_h * 0.075],
                        radius=cab_w * 0.025, fill=(20, 26, 46, 255))
    slot_w = cab_w * 0.16
    slot_y = cab_y + cab_h * 0.83
    d.rounded_rectangle([cx - slot_w / 2, slot_y, cx + slot_w / 2, slot_y + cab_h * 0.028],
                        radius=cab_h * 0.014, fill=CORAL + (255,))

    if rounded:
        img.putalpha(rounded_mask(s, int(s * 0.22)))

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-512.png", 512, True, 0.10),
        ("icon-192.png", 192, True, 0.10),
        ("icon-180.png", 180, False, 0.10),
        ("icon-maskable-512.png", 512, False, 0.20),
    ]
    for name, size, rounded, inset in jobs:
        path = os.path.join(OUT, name)
        render(size, rounded=rounded, inset=inset).save(path, optimize=True)
        print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
