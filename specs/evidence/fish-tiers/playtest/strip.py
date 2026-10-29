"""A labelled strip from aim-shoot.mjs's shots: python3 strip.py <shots.json> <out png> <cols> <x0,y0,x1,y1> <scale>"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
shots, out, cols = json.load(open(sys.argv[1])), sys.argv[2], int(sys.argv[3])
crop, scale = tuple(int(v) for v in sys.argv[4].split(",")), float(sys.argv[5])
FONT = ImageFont.load_default(size=15)
cells = []
for s in shots:
    im = Image.open(s["path"]).crop(crop)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 8 + 8 * len(s["label"]), 22), fill=(20, 20, 20))
    d.text((4, 2), s["label"], fill=(255, 255, 255), font=FONT)
    cells.append(im)
w, h = cells[0].size
rows = (len(cells) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols + 4 * (cols - 1), h * rows + 4 * (rows - 1)), (255, 255, 255))
for i, c in enumerate(cells):
    sheet.paste(c, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
sheet.save(out)
print(out, sheet.size)
