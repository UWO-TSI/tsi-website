"""The ground-floor review sheet (shop phase 2): the headless shots in a labelled grid, one WebP.
  python3 sheet.py <raw-dir> <out.webp>"""
import sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
CELLS = [
    ("02-door-view", "From the door: the branded dark round the room, the mezzanine above"),
    ("01-plan-ground", "Ground floor from above (the mezzanine cut away)"),
    ("03-items-walk", "In-game items, the changing rooms behind the stair"),
    ("06-counter-close", "Glazed tile, timber top, the shopkeeper, herringbone oak"),
    ("07-tools-shelving", "Tools table; dyes and accessories on edge-lit shelving"),
    ("08-showroom", "Furniture dais: wallpapers behind, floorings in front"),
    ("09-clothes-stair", "Clothes rail and shoe table by the stair"),
    ("10-seasonal", "Front plinths by the window: today's specials"),
    ("05-changing-rooms", "Three changing rooms behind the stair"),
    ("11-item-tag", "Near an item: its name and a mini image"),
    ("12-shopkeeper", "E at the counter: the two answers"),
    ("13-merch-ui", "Club merch: the item turning, pixel finish"),
]
W, H, PAD, CAP = 720, 450, 14, 34
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
cols, rows = 3, (len(CELLS) + 2) // 3
sheet = Image.new("RGB", (cols * (W + PAD) + PAD, rows * (H + CAP + PAD) + PAD + 50), "#1d1f22")
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), "Shop, phase 2: the furnished ground floor (headless, in-game)", font=title, fill="#f2efe8")
for i, (name, cap) in enumerate(CELLS):
    im = Image.open(f"{raw}/{name}.png").convert("RGB")
    # crop to the cell's 16:10, centred, then fit
    r = W / H
    iw, ih = im.size
    if iw / ih > r:
        nw = int(ih * r); im = im.crop(((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih))
    else:
        nh = int(iw / r); im = im.crop((0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh))
    im = im.resize((W, H), Image.LANCZOS)
    x = PAD + (i % cols) * (W + PAD)
    y = 50 + PAD + (i // cols) * (H + CAP + PAD)
    sheet.paste(im, (x, y))
    d.text((x + 2, y + H + 8), f"{i + 1}. {cap}", font=font, fill="#e9e5dc")
sheet.save(out, "WEBP", quality=86)
print(out, sheet.size)
