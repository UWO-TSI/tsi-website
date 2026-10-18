"""The review sheets (shop phase 2): the headless shots in a labelled grid, one WebP.
  python3 sheet.py <raw-dir> <out.webp> [ground|merch]"""
import sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else "ground"
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
    ("16-merch-grid", "Club merch: David's grid of white cards"),
]
MERCH = [
    ("16-merch-grid", "The grid: still renders on white, kind · Tethos club, the Gem pill, the arrow, a tag"),
    ("17-merch-filter", "The filter pills: the Tethos mark on the active one"),
    ("18-merch-detail", "Opened: the model turning with the pixel finish, the redeem button"),
    ("19-merch-phone", "On a phone: one card across"),
]
TITLE = "Shop, phase 2: the furnished ground floor (headless, in-game)"
if mode == "merch":
    CELLS, TITLE = MERCH, "Shop, phase 2: the club merch screen, after David's reference"
W, H, PAD, CAP = 720, 450, 14, 34
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
cols = 2 if mode == "merch" else 3
rows = (len(CELLS) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (W + PAD) + PAD, rows * (H + CAP + PAD) + PAD + 50), "#1d1f22")
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), TITLE, font=title, fill="#f2efe8")
for i, (name, cap) in enumerate(CELLS):
    im = Image.open(f"{raw}/{name}.png").convert("RGB")
    # crop to the cell's 16:10, centred, then fit; a portrait shot (a phone) is fitted whole on the sheet's dark
    r = W / H
    iw, ih = im.size
    if iw < ih:
        k = H / ih
        fitted = im.resize((int(iw * k), H), Image.LANCZOS)
        im = Image.new("RGB", (W, H), "#1d1f22")
        im.paste(fitted, ((W - fitted.width) // 2, 0))
    elif iw / ih > r:
        nw = int(ih * r); im = im.crop(((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih))
    else:
        nh = int(iw / r); im = im.crop((0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh))
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    x = PAD + (i % cols) * (W + PAD)
    y = 50 + PAD + (i // cols) * (H + CAP + PAD)
    sheet.paste(im, (x, y))
    d.text((x + 2, y + H + 8), f"{i + 1}. {cap}", font=font, fill="#e9e5dc")
sheet.save(out, "WEBP", quality=86)
print(out, sheet.size)
