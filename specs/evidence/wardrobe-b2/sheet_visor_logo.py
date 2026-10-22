"""#04 crew visor's logo (David, round 5: "the M symbol is messed up make it the mcdonald m but flip it so its w"): the
evidence sheet (WebP) from shoot.mjs's visorlogo scene.

  python3 specs/evidence/wardrobe-b2/sheet_visor_logo.py <shots_dir>

19-visor-logo.webp   before (round 5, from sheet 18b), the visor over #03, #10 and #27 at front, 3/4 and high, the logo
                     close up, and at LOD 1
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = sys.argv[1]
BG, INK = (239, 231, 214), (59, 47, 38)
FONT = ImageFont.load_default(size=30)
SMALL = ImageFont.load_default(size=21)


def titled(img, text, sub=None):
    pad = 48 + (32 if sub else 0)
    out = Image.new("RGB", (img.width, img.height + pad), BG)
    out.paste(img, (0, pad))
    d = ImageDraw.Draw(out)
    d.text((12, 8), text, fill=INK, font=FONT)
    if sub:
        d.text((12, 46), sub, fill=INK, font=SMALL)
    return out


def stack(imgs, gap=16):
    w = max(i.width for i in imgs)
    out = Image.new("RGB", (w, sum(i.height for i in imgs) + gap * (len(imgs) - 1)), BG)
    y = 0
    for i in imgs:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def fit(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


def shot(name, w=None):
    img = Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGB")
    return fit(img, w) if w else img


before = Image.open(os.path.join(HERE, "18b-round5-rims-visor.webp")).convert("RGB").crop((0, 8880, 1400, 9360))
parts = [
    titled(before, "Before (round 5, sheet 18b): the M, half an arch mirrored, broken where the band's mirror line was lost"),
    titled(shot("logo-visor", 1400), "#04 crew visor: the golden-arches M turned upside down, a W, in the visor's own yellow",
           "Placement and hair cut unchanged (#03's one thin strand across the logo was there in round 5). Rows: #03, #10, #27. Columns: front, 3/4, high."),
    titled(shot("logo-close", 1400), "The logo close up, from the front: over #10 messy wolf cut and #27 double buns"),
    titled(shot("logo-lod1", 1400), "At LOD 1 (characters seen small), front and 3/4"),
]
sheet = fit(stack(parts), 1400)
sheet.save(os.path.join(HERE, "19-visor-logo.webp"), "WEBP", quality=84, method=6)
print("sheet 19-visor-logo.webp", sheet.size)
