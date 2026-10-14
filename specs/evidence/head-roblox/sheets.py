"""Tile the head-roblox evidence (render_hair.py PNGs, or the bench's PNGs) beside David's preview (Pillow, WebP).

  python3 specs/evidence/head-roblox/sheets.py hairs <frames_dir> <out.webp> <id>|all ... one row per hairstyle: David's
                                                                                          preview | front | 3/4 | side | back
  python3 specs/evidence/head-roblox/sheets.py grid <out.webp> <cols> <title> <png> ...    any PNGs in a grid
The preview is hair/source/david/_preview.png (7 x 3 cells, in the manifest's order).
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
SRC = os.path.join(ROOT, "art", "characters", "hair", "source", "david")
BG, INK = (250, 246, 238), (70, 55, 40)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
except OSError:
    FONT = ImageFont.load_default()
CELL = 360


def preview_cell(pid):
    ids = [h["id"] for h in json.load(open(os.path.join(SRC, "manifest.json")))["hairs"]]
    n = ids.index(pid)
    P = Image.open(os.path.join(SRC, "_preview.png")).convert("RGB")
    w, h = P.size
    cw, ch = w / 7, h / 3
    r, c = n // 7, n % 7
    return P.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch))).resize((CELL, CELL), Image.LANCZOS)


def hairs(frames, out, ids):
    if ids == ["all"]:
        ids = [h["id"] for h in json.load(open(os.path.join(SRC, "manifest.json")))["hairs"]]
    att = {e["id"]: e for e in json.load(open(os.path.join(ROOT, "art", "characters", "hair", "roblox_attachments.json")))["hairs"]}
    cols = ["David's preview", "front", "3/4", "side", "back"]
    W = Image.new("RGB", (CELL * 5, 40 + len(ids) * (CELL + 34)), BG)
    d = ImageDraw.Draw(W)
    for j, c in enumerate(cols):
        d.text((j * CELL + 10, 10), c, fill=INK, font=FONT)
    for i, pid in enumerate(ids):
        y = 40 + i * (CELL + 34)
        a = att[pid]
        d.text((10, y + 4), f"#{a['n']:02d} {pid}: attachment {'provisional (seat fit)' if a['provisional'] else 'from the Roblox accessory file'}",
               fill=INK, font=FONT)
        W.paste(preview_cell(pid), (0, y + 34))
        for j, v in enumerate(("front", "34", "side", "back")):
            p = os.path.join(frames, f"{pid}_{v}.png")
            if os.path.exists(p):
                W.paste(Image.open(p).convert("RGB").resize((CELL, CELL), Image.LANCZOS), ((j + 1) * CELL, y + 34))
    W.save(out, quality=88)


def grid(out, cols, title, pngs):
    ims = [Image.open(p).convert("RGB") for p in pngs]
    w = max(im.width for im in ims)
    h = max(im.height for im in ims)
    rows = (len(ims) + cols - 1) // cols
    W = Image.new("RGB", (cols * w, 40 + rows * h), BG)
    ImageDraw.Draw(W).text((10, 10), title, fill=INK, font=FONT)
    for k, im in enumerate(ims):
        W.paste(im, ((k % cols) * w, 40 + (k // cols) * h))
    W.save(out, quality=88)


if __name__ == "__main__":
    if sys.argv[1] == "hairs":
        hairs(sys.argv[2], sys.argv[3], sys.argv[4:])
    else:
        grid(sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5:])
