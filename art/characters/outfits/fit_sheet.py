"""Tile render_fit.py frames: one row per garment (run, jump, sit; each front, side, back), labelled; with BEFORE=<dir>
each garment's row from that run (the old models) above it.

  [BEFORE=<frames_dir>] python3 art/characters/outfits/fit_sheet.py <frames_dir> <out.png> <title> [ids ...]
"""
import os, sys
from PIL import Image, ImageDraw

FR, OUT, TITLE, IDS = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
BEFORE = os.environ.get("BEFORE")
POSES, VIEWS = ("run", "jump", "sit"), ("front", "side", "back")
rows = [r for pid in IDS for r in (((f"{pid}\nbefore", BEFORE, pid), (f"{pid}\nafter", FR, pid)) if BEFORE else ((pid, FR, pid),))]
cells = [[Image.open(os.path.join(d, f"{pid}_{p}_{v}.png")).convert("RGB") for p in POSES for v in VIEWS] for _, d, pid in rows]
w, h = cells[0][0].size
lab, head = 150, 40
out = Image.new("RGB", (lab + w * 9, head + 18 + h * len(rows)), (255, 255, 255))
d = ImageDraw.Draw(out)
d.text((8, 8), TITLE, fill=(0, 0, 0))
for k, p in enumerate(POSES):
    for j, v in enumerate(VIEWS):
        d.text((lab + (k * 3 + j) * w + 6, head), f"{p} {v}", fill=(60, 60, 60))
for i, ((label, _, _), row) in enumerate(zip(rows, cells)):
    y = head + 18 + i * h
    d.multiline_text((8, y + h // 2 - 8), label, fill=(0, 0, 0))
    for k, im in enumerate(row):
        out.paste(im, (lab + k * w, y))
out.save(OUT)
print("SHEET", OUT, out.size)
