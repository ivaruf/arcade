#!/usr/bin/env python3
"""Generate the GOPHER CLOUD ARCADE icon set from the owner's artwork.

    python3 cloudnine/tools/make-icons.py

Reads icons/source/gopher-cloud.png and writes icons/icon-32.png,
icon-180.png, icon-192.png, icon-512.png and icon-maskable-512.png.
Requires Pillow. No network.

WHY THIS SCRIPT NO LONGER DRAWS ANYTHING
----------------------------------------
§4 of the hub's CLAUDE.md says to draw the motif procedurally and treat the
script as the source of truth rather than the PNGs, and the version of this
file before it did exactly that — an arcade cabinet with a gopher's face on
its screen, built out of rounded rectangles.

The motif is now a drawing the owner made, and no amount of Pillow will
reproduce a hand-drawn gopher riding a cloud. So the source of truth moved to
`icons/source/gopher-cloud.png`, which is committed beside this script, and
the script's job changed from drawing to DERIVING: crop, mask, pad and resize.
The point of the rule survives — the icon set is still reproducible from
committed inputs by one command, with no manual steps in an image editor —
and the part that cannot survive was never the point.

WHAT THE VARIANTS ARE FOR
-------------------------
The artwork is a circle inscribed in a 400 x 400 square, so its corners are
WHITE, not transparent. That matters differently for each variant:

  icon-32 / 192 / 512   purpose "any". The corners are masked to transparency,
                        so the icon reads as the circle it is instead of a
                        circle sitting on a white card.
  icon-maskable-512     purpose "maskable". Android crops this to whatever
                        shape it likes, so the amber has to reach every corner
                        and the gopher has to sit inside the middle 80%. The
                        whole artwork is scaled into that safe zone on a full
                        amber square — the circle's own amber and the square's
                        are the same colour, so the join is invisible.
  icon-180              apple-touch. iOS applies its own squircle and ignores
                        transparency, compositing anything transparent onto
                        black. So this one is opaque amber to the edges: the
                        corners iOS cuts off are amber rather than white.

The source is 400 px, so the 512 variants are upscaled 1.28x. On flat line art
with LANCZOS that is not visible; a larger original would still be better if
one ever exists.
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
SOURCE = os.path.join(OUT, "source", "gopher-cloud.png")

# Sampled from the artwork's own background, not guessed, so the maskable
# padding is the same amber as the circle it surrounds.
AMBER = (249, 198, 107)

SS = 4  # supersample factor for the circle mask


def load():
    art = Image.open(SOURCE).convert("RGBA")
    if art.width != art.height:
        raise SystemExit(f"expected a square source, got {art.size}")
    return art


def circle_mask(size, erode=0.0):
    """An antialiased disc that fills `size`, drawn big and shrunk.

    `erode` pulls the disc in by that fraction of the size. It exists for the
    padded variants: an antialiased edge composited onto amber leaves a faint
    ring where the artwork's own outermost pixels are not quite the background
    colour, and shaving a pixel off means pure amber meets pure amber.
    """
    from PIL import ImageDraw

    big = Image.new("L", (size * SS, size * SS), 0)
    pad = int(round(size * SS * erode))
    ImageDraw.Draw(big).ellipse([pad, pad, size * SS - 1 - pad, size * SS - 1 - pad], fill=255)
    return big.resize((size, size), Image.LANCZOS)


def rounded(art, size):
    """purpose "any": the circle, with the white corners taken off."""
    out = art.resize((size, size), Image.LANCZOS)
    out.putalpha(circle_mask(size))
    return out


def padded(art, size, inset):
    """Opaque amber square with the artwork scaled into the middle.

    `inset` is the fraction of the canvas left as margin on each side, so 0.10
    keeps the drawing inside the middle 80% — which is what a maskable icon has
    to guarantee, because the launcher may crop to a circle, a squircle or a
    rounded square and none of them promise the corners.
    """
    out = Image.new("RGBA", (size, size), (*AMBER, 255))
    inner = max(1, int(round(size * (1 - 2 * inset))))
    art_small = art.resize((inner, inner), Image.LANCZOS)
    # The artwork's own corners are white; mask them so only the disc lands on
    # the amber, or the padding gets a white square in the middle of it.
    art_small.putalpha(circle_mask(inner, erode=0.012))
    offset = (size - inner) // 2
    out.alpha_composite(art_small, (offset, offset))
    return out


def main():
    art = load()
    jobs = [
        ("icon-512.png", lambda: rounded(art, 512)),
        ("icon-192.png", lambda: rounded(art, 192)),
        ("icon-32.png", lambda: rounded(art, 32)),
        # iOS masks this itself and flattens transparency onto black, so it is
        # opaque and barely inset: its squircle only shaves the corners.
        ("icon-180.png", lambda: padded(art, 180, 0.0)),
        ("icon-maskable-512.png", lambda: padded(art, 512, 0.10)),
    ]
    for name, build in jobs:
        path = os.path.join(OUT, name)
        image = build()
        # apple-touch and maskable must not carry alpha at all.
        if name in ("icon-180.png", "icon-maskable-512.png"):
            flat = Image.new("RGB", image.size, AMBER)
            flat.paste(image, mask=image.split()[3])
            flat.save(path, optimize=True)
        else:
            image.save(path, optimize=True)
        print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
