"""Tile the per-style renders from build_hair.py into hair_bangs_sheet.png / hair_back_sheet.png (Pillow).

  python3 art/characters/hair/make_sheets.py <frames_dir>
"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
FR = sys.argv[1]
cat = json.load(open(os.path.join(HERE, "hair_catalog.json")))
for slot, cols in (("bangs", 4), ("back", 4)):
    items = cat[slot]
    cw, ch = 600, 330
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * ch), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for k, it in enumerate(items):
        x, y = (k % cols) * cw, (k // cols) * ch
        for j, v in enumerate("ab"):
            im = Image.open(os.path.join(FR, f"{slot}_{it['id']}_{v}.png")).convert("RGB")
            sheet.paste(im, (x + j * 300, y + 30))
        d.text((x + 8, y + 8), f"{it['id']}  [{it['sheet_cell']}]  {it['tris']} tris", fill=(0, 0, 0))
    sheet.save(os.path.join(HERE, f"hair_{slot}_sheet.png"))
    print("SHEET", slot, sheet.size)
