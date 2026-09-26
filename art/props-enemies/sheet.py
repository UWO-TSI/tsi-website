"""Tile rendered frames into a labelled contact sheet (plain python3 + Pillow; called by render_sheets.py).

  python3 art/props-enemies/sheet.py <out.png> <cols> <cells.json>
cells.json: [[label, [png, ...]], ...]; each cell shows its frames side by side under the label.
"""
import json, sys
from PIL import Image, ImageDraw

out, cols, cells = sys.argv[1], int(sys.argv[2]), json.load(open(sys.argv[3]))
ims = [[Image.open(p).convert("RGB") for p in paths] for _, paths in cells]
cw = max(sum(i.width for i in row) for row in ims)
ch = max(max(i.height for i in row) for row in ims) + 22
rows = (len(cells) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * ch), (255, 255, 255))
d = ImageDraw.Draw(sheet)
for k, ((label, _), row) in enumerate(zip(cells, ims)):
    x, y = (k % cols) * cw, (k // cols) * ch
    d.text((x + 6, y + 5), label, fill=(0, 0, 0))
    for im in row:
        sheet.paste(im, (x, y + 22))
        x += im.width
sheet.save(out)
print("SHEET", out, sheet.size)
