"""Tile render_evidence.py frames into the deliverable-3 sheets (Pillow).

  python3 art/characters/make_evidence_sheets.py <frames_dir> <mode>
Writes art/characters/{outfits_sheet,accessories_sheet,clips_contact,dressed_examples}.png.
"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
FR, MODE = sys.argv[1:3]
CAT = json.load(open(os.path.join(HERE, "character_catalog.json")))


def sheet(cells, cols, name):
    """cells: [(label, [image paths])]; each cell is its images side by side under a label."""
    ims = [[Image.open(p).convert("RGB") for p in paths] for _, paths in cells]
    cw = max(sum(i.width for i in row) for row in ims)
    ch = max(max(i.height for i in row) for row in ims) + 22
    rows = (len(cells) + cols - 1) // cols
    out = Image.new("RGB", (cols * cw, rows * ch), (255, 255, 255))
    d = ImageDraw.Draw(out)
    for k, ((label, _), row) in enumerate(zip(cells, ims)):
        x, y = (k % cols) * cw, (k // cols) * ch
        d.text((x + 6, y + 5), label, fill=(0, 0, 0))
        for im in row:
            out.paste(im, (x, y + 22))
            x += im.width
    out.save(os.path.join(HERE, name))
    print("SHEET", name, out.size)


f = lambda *a: os.path.join(FR, "_".join(a) + ".png")
if MODE == "outfits":
    sheet([(f"{p['id']}  {p['tris']} tris", [f(p["id"], "a"), f(p["id"], "b")]) for p in CAT["outfits"]], 5, "outfits_sheet.png")
elif MODE == "accessories":
    sheet([(f"{p['id']}  {p['tris']} tris" + ("  hidesBackHair" if p["hidesBackHair"] else ""),
            [f(p["id"], v) for v in "abc" if os.path.exists(f(p["id"], v))]) for p in CAT["accessories"]], 4, "accessories_sheet.png")
elif MODE == "clips":
    sheet([(f"{c['name']}  {c['length']}s  {'loop' if c['loop'] else 'once'}", [f("clip", c["name"], str(i)) for i in range(3)])
           for c in CAT["clips"]], 4, "clips_contact.png")
elif MODE == "dressed":
    sheet([(f"look {i + 1}", [f(f"look{i}", v) for v in "abc"]) for i in range(6)], 2, "dressed_examples.png")
