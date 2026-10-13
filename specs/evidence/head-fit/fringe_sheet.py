"""The three fringes that hid the eyes (#2 messy boy, #10 messy wolf cut, #17 bob with a pigtail), before | after.

  python3 specs/evidence/head-fit/fringe_sheet.py <before_dir> <after_dir>

<before_dir> holds the earlier 05-david-s<skin>-h1.webp sheets (sheets.py's layout: a 70 px title, then per view a 48 px
label and a 2,560 px wide fullkit screenshot, 20 px apart); <after_dir> holds shots.mjs's fullkit PNGs. Each cell is cut
from the bench grid (7 columns, 8 px padding and gaps, square views over a 21 px caption). Writes 10-fringes.webp.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

BEFORE, AFTER = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
CELLS = {"hair_messy_boy": (0, 0), "hair_messy_wolf": (2, 1), "hair_bob_pigtail": (2, 2)}   # (col, row) in fullkit
W = 2600
CW = (W - 16 - 6 * 8) / 7
PITCH_X, PITCH_Y = CW + 8, CW + 21 + 8
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
except OSError:
    FONT = ImageFont.load_default()


def cell(im, col, row, scale=1.0, x0=0, y0=0):
    x, y = x0 + (8 + col * PITCH_X) * scale, y0 + (8 + row * PITCH_Y) * scale
    return im.crop((round(x), round(y), round(x + CW * scale), round(y + CW * scale))).resize((300, 300), Image.LANCZOS)


def before(skin, view_index):
    im = Image.open(os.path.join(BEFORE, f"05-david-s{skin}-h1.webp")).convert("RGB")
    h = (im.height - 70) / 3 - 68
    return im, 2560 / W, 20, 70 + view_index * (48 + h + 20) + 48


rows = []
for hid, (c, r) in CELLS.items():
    for skin in ("1", "5", "10"):
        tiles = []
        for vi, view in enumerate(("front", "34")):
            im, s, x0, y0 = before(skin, vi)
            tiles.append(cell(im, c, r, s, x0, y0))
            tiles.append(cell(Image.open(os.path.join(AFTER, f"fullkit-s{skin}-h1-{view}.png")).convert("RGB"), c, r))
        rows.append((f"{hid}, skin {skin}: front before | after, 3/4 before | after", tiles))
sheet = Image.new("RGB", (4 * 300 + 5 * 16, 60 + len(rows) * (300 + 50)), (250, 246, 238))
d = ImageDraw.Draw(sheet)
d.text((16, 16), "The fringes that hid the eyes, cut so the eyes read through (David tunes them after)", fill=(70, 55, 40), font=FONT)
y = 60
for label, tiles in rows:
    d.text((16, y), label, fill=(70, 55, 40), font=FONT)
    for k, t in enumerate(tiles):
        sheet.paste(t, (16 + k * 316, y + 34))
    y += 350
sheet.save(os.path.join(HERE, "10-fringes.webp"), "WEBP", quality=85, method=6)
print("sheet 10-fringes.webp", sheet.size)
