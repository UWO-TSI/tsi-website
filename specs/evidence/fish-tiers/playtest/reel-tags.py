"""reel-tags.png: the reel with its name and water tags, in the window and slipping, for an unknown species ("???") and a known one.
python3 reel-tags.py <tags dir (reel-shoot.mjs output)> <out png>"""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1:3]
FONT = ImageFont.load_default(size=15)
CROP = (300, 520, 980, 740)

def cut(tag, beat, off):
    d = f"{src}/frames-{tag}"
    meta = json.load(open(f"{d}/beats.json"))
    ms = round(([b["t"] for b in meta["beats"] if b["phase"] == beat][0] - meta["t0"]) * 1000) + off
    fs = sorted(glob.glob(f"{d}/*.jpg"))
    ts = [int(os.path.basename(f).split("_")[1][:-4]) for f in fs]
    return Image.open(fs[min(range(len(ts)), key=lambda i: abs(ts[i] - ms))]).crop((0, 40, 1280, 800)).crop(CROP)

cells = []
for tag, name in (("unknown", "not caught yet"), ("known", "caught before")):
    for beat, off, what in (("reel:in", 900, "in the window"), ("reel:slip", 120, "slipping")):
        im = cut(tag, beat, off)
        ImageDraw.Draw(im).rectangle((0, 0, 20 + 8 * len(f"{name}: {what}"), 22), fill=(20, 20, 20))
        ImageDraw.Draw(im).text((4, 2), f"{name}: {what}", fill=(255, 255, 255), font=FONT)
        cells.append(im)
w, h = cells[0].size
sheet = Image.new("RGB", (w * 2 + 4, h * 2 + 4), (255, 255, 255))
for i, c in enumerate(cells):
    sheet.paste(c, ((i % 2) * (w + 4), (i // 2) * (h + 4)))
sheet.save(out)
print(out, sheet.size)
