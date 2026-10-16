"""Tile the head-v10 evidence (Pillow, WebP).

  python3 specs/evidence/head-v10/sheets.py beforeafter <out.webp> <before_dir> <after_dir> <views> <id> ...
      one row per id: the before views, then the after views (render_v10.py PNGs <id>_<view>.png)
  python3 specs/evidence/head-v10/sheets.py grid <out.webp> <cols> <title> <png>[=label] ...
  python3 specs/evidence/head-v10/sheets.py matrix <out.webp> <dir> <view> <title> <colours> <id> ...
      one row per id, one column per palette hair colour (render_v10.py with TAG_COLOUR=1: <id>-<c>_<view>.png)
"""
import json
import os, sys
from PIL import Image, ImageDraw, ImageFont

BG, INK, RULE = (250, 246, 238), (70, 55, 40), (200, 188, 170)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
    BIG = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 24)
except OSError:
    FONT = BIG = ImageFont.load_default()
CELL = 300


def fit(im, cell=CELL):
    im = im.convert("RGB")
    im.thumbnail((cell, cell), Image.LANCZOS)
    c = Image.new("RGB", (cell, cell), BG)
    c.paste(im, ((cell - im.width) // 2, (cell - im.height) // 2))
    return c


def beforeafter(out, before, after, views, ids):
    views = views.split(",")
    n = len(views)
    W = Image.new("RGB", (CELL * 2 * n + 24, 70 + len(ids) * (CELL + 30)), BG)
    d = ImageDraw.Draw(W)
    d.text((10, 8), "Before: v9 (flat face plate, the face rule)", fill=INK, font=BIG)
    d.text((CELL * n + 34, 8), "After: v10 (round face and jaw, the jaw rule)", fill=INK, font=BIG)
    for j, v in enumerate(views):
        d.text((j * CELL + 10, 42), v, fill=INK, font=FONT)
        d.text((CELL * n + 24 + j * CELL + 10, 42), v, fill=INK, font=FONT)
    for i, pid in enumerate(ids):
        y = 70 + i * (CELL + 30)
        d.text((10, y + 4), pid.split(":")[0], fill=INK, font=FONT)
        for j, v in enumerate(views):
            for k, src in enumerate((before, after)):
                p = os.path.join(src, f"{pid.split(':')[0]}_{v}.png")
                if os.path.exists(p):
                    W.paste(fit(Image.open(p)), (k * (CELL * n + 24) + j * CELL, y + 28))
    d.line([(CELL * n + 12, 40), (CELL * n + 12, W.height)], fill=RULE, width=3)
    W.save(out, quality=86)


def grid(out, cols, title, items):
    pairs = [(it.split("=", 1) + [""])[:2] for it in items]
    rows = (len(pairs) + cols - 1) // cols
    W = Image.new("RGB", (cols * CELL, 44 + rows * (CELL + 26)), BG)
    d = ImageDraw.Draw(W)
    d.text((10, 8), title, fill=INK, font=BIG)
    for k, (p, label) in enumerate(pairs):
        x, y = (k % cols) * CELL, 44 + (k // cols) * (CELL + 26)
        if label:
            d.text((x + 8, y + 2), label, fill=INK, font=FONT)
        if os.path.exists(p):
            W.paste(fit(Image.open(p)), (x, y + 26))
    W.save(out, quality=86)


def matrix(out, src, view, title, colours, ids, cell=200):
    pal = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "art", "characters", "palette.json")))["hair"]
    cols = [int(c) for c in colours.split(",")]
    left = 200
    W = Image.new("RGB", (left + cell * len(cols), 80 + len(ids) * cell), BG)
    d = ImageDraw.Draw(W)
    d.text((10, 8), title, fill=INK, font=BIG)
    for j, c in enumerate(cols):
        x = left + j * cell
        d.rectangle([x + 10, 44, x + 34, 68], fill=pal[c], outline=INK)
        d.text((x + 42, 46), f"{c} {pal[c]}", fill=INK, font=FONT)
    for i, pid in enumerate(ids):
        y = 80 + i * cell
        d.text((10, y + cell // 2 - 10), pid.replace("hair_", ""), fill=INK, font=FONT)
        for j, c in enumerate(cols):
            p = os.path.join(src, f"{pid}-{c}_{view}.png")
            if os.path.exists(p):
                W.paste(fit(Image.open(p), cell), (left + j * cell, y))
    W.save(out, quality=84)


if __name__ == "__main__":
    if sys.argv[1] == "matrix":
        matrix(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6], sys.argv[7:])
    elif sys.argv[1] == "beforeafter":
        beforeafter(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6:])
    else:
        grid(sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5:])
