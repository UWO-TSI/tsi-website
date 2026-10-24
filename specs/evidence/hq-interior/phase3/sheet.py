"""HQ phase 3's review sheet: the gallery (layout B) furnished, two tall storeys (the headless shots of shots.mjs), day
and night side by side where both were shot, one WebP.
  python3 sheet.py <raw-dir> <out.webp>"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
PAIRS = [   # (day shot, night shot, caption): each a row, day left, night right
    ("01-plan-ground", "01-plan-ground", "Ground floor from above: the zones, the stations (E)"),
    ("02-plan-upper", "02-plan-upper", "Upper floor from above: the bridge, the two arms"),
    ("04-door", "04-door", "From the door, the walking camera: by day, and at night on its lamps"),
    ("05-aquarium-entrance", "05-aquarium-entrance", "The aquarium straight ahead from the entrance"),
    ("06-bridge-lounge", "06-bridge-lounge", "The bridge's lounge looking at the tank, under the walnut oval ceiling"),
    ("07-arm-left", "07-arm-left", "The left arm and its banners, one after another toward the tank"),
    ("09-work", "09-work", "Under the left arm: co-working, the library wall"),
    ("11-height-walk", "11-height-walk", "The ceiling's height from the walking camera, in the hall"),
]
SINGLES = [  # day only, two to a row
    ("03-overview", "Both floors"),
    ("03b-section", "The two storeys from the front, the near wall cut away: 4.6 each, the ceiling at 9.2"),
    ("08-arm-right", "Along the right arm's rail from the bridge: the banners toward the tank"),
    ("10-stair", "The stair under the right arm, the notice board at its foot"),
    ("13-top-of-stairs", "From the top of the stairs"),
    ("12-height-upper", "The drop to the hall from the bridge, the walking camera"),
    ("14-coffee-desk", "The entry under the bridge: the door, Wren at her desk, the work lounge"),
    ("15-founder", "The Founder's desk and blank plaque, the clock, the trophy case"),
    ("16-admin-doors", "The two admin doors (locked) at the end of the left arm"),
    ("17-walk-upper", "Upstairs on the left arm, the walking camera"),
    ("18-walk-under", "Under the left arm, walking: the arm above cut away"),
    ("19-walk-stair", "Under the right arm by the stair, walking"),
    ("20-coffee-line", "E at the coffee bar (its line is a draft)"),
    ("21-aquarium-line", "E at the aquarium (its line is a draft)"),
    ("22-admin-locked", "E at an admin door: \"Admins only. It's locked.\""),
]
W, H, PAD, CAP, HEAD = 720, 450, 14, 34, 120
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
rows = len(PAIRS) + (len(SINGLES) + 1) // 2
sheet = Image.new("RGB", (2 * (W + PAD) + PAD, rows * (H + CAP + PAD) + PAD + HEAD), "#1d1f22")
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), "HQ interior, phase 3: layout B, the gallery, furnished (20 x 16, two storeys of 4.6, the ceiling at 9.2)", font=title, fill="#f2efe8")
d.text((PAD, 52), "David, 2026-10-19: \"i said to do plan b, also make roofs taller for both floors\". The aquarium fills the back wall, the full height; the upper floor", font=sub, fill="#e9e5dc")
d.text((PAD, 74), "wraps the hall in a U, the big lounge on the bridge facing the tank, the banners off the arms. Left: day. Right: night. Below: by day only.", font=sub, fill="#e9e5dc")


def cell(name, x, y, cap):
    path = f"{raw}/{name}.png"
    if not os.path.exists(path):
        d.text((x + 10, y + H // 2), f"missing: {name}", font=font, fill="#ff8a7a")
    else:
        im = Image.open(path).convert("RGB")
        iw, ih = im.size
        k = max(W / iw, H / ih)
        im = im.resize((int(iw * k), int(ih * k)), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
        sheet.paste(im, (x, y))
    text = cap
    while d.textlength(text, font=font) > W - 4 and len(text) > 8:
        text = text[:-2].rstrip() + "…"
    d.text((x + 2, y + H + 8), text, font=font, fill="#e9e5dc")


n = 0
for r, (day, night, cap) in enumerate(PAIRS):
    y = HEAD + PAD + r * (H + CAP + PAD)
    cell(f"day-{day}", PAD, y, f"{r + 1}. Day: {cap}")
    cell(f"night-{night}", PAD + W + PAD, y, f"{r + 1}. Night")
for i, (name, cap) in enumerate(SINGLES):
    r = len(PAIRS) + i // 2
    y = HEAD + PAD + r * (H + CAP + PAD)
    cell(f"day-{name}", PAD + (i % 2) * (W + PAD), y, f"{len(PAIRS) + i + 1}. {cap}")
sheet.save(out, "WEBP", quality=84)
print(out, sheet.size)
