"""v1 water and wharf evidence sheets (specs/v1-drop.md §8c): each view before | after, day and dusk, beside the
reference it is held to (references/look/2026-10-13/). Reads the PNGs shoot.mjs writes; refuses a missing or blank
tile (a uniform frame is an empty render).

  python3 specs/evidence/v1-water/sheets.py <shots_dir> <out_dir>
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

SHOTS, OUT = sys.argv[1:3]
os.makedirs(OUT, exist_ok=True)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
REFS = os.path.join(ROOT, "references", "look", "2026-10-13")
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
except OSError:
    FONT = ImageFont.load_default()
W = 720
VIEWS = {
    "wharf": "wharf-creatures-of-the-deep-ref.png",
    "wharf-top": "wharf-creatures-of-the-deep-ref.png",
    "beach": "water-foam-shallows-ref.png",
    "shallows": "water-clarity-palette-ref.png",
    "sea": "water-foam-shallows-ref.png",
}


def tile(path, label, crop_top=40):
    if not os.path.exists(path):
        raise SystemExit(f"missing {path}")
    im = Image.open(path).convert("RGB")
    if crop_top:
        im = im.crop((0, crop_top, im.width, im.height))          # the dev overlay's bar
    if max(ImageStat.Stat(im).stddev) < 4:
        raise SystemExit(f"blank tile {path}")
    im = im.resize((W, round(im.height * W / im.width)))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 12 + d.textlength(label, font=FONT) + 12, 36), fill=(20, 24, 30))
    d.text((12, 6), label, fill=(255, 255, 255), font=FONT)
    return im


for view, ref in VIEWS.items():
    rows = []
    for time in ("day", "dusk"):
        before, after = os.path.join(SHOTS, f"before-{view}-{time}.png"), os.path.join(SHOTS, f"after-{view}-{time}.png")
        if not os.path.exists(after):
            continue
        cells = [tile(before, f"before · {time}")] if os.path.exists(before) else []
        cells.append(tile(after, f"after · {time}"))
        rows.append(cells)
    if not rows:
        continue
    reference = tile(os.path.join(REFS, ref), f"reference · {ref.replace('-ref.png', '')}", crop_top=0)
    cols = max(len(r) for r in rows) + 1
    h = max(sum(r[0].height for r in rows), reference.height)
    sheet = Image.new("RGB", (W * cols + 8 * (cols - 1), h + 8 * (len(rows) - 1)), (12, 14, 18))
    y = 0
    for r in rows:
        for i, im in enumerate(r):
            sheet.paste(im, (i * (W + 8), y))
        y += r[0].height + 8
    sheet.paste(reference, ((cols - 1) * (W + 8), 0))
    path = os.path.join(OUT, f"{view}.webp")
    sheet.save(path, quality=82)
    print("wrote", path)
