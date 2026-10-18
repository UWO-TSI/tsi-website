"""HQ phase 2's review sheet: the furnished room (the headless shots of shots.mjs), day and night side by side where
both were shot, one WebP.
  python3 sheet.py <raw-dir> <out.webp>"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
PAIRS = [   # (day shot, night shot, caption): each a row, day left, night right
    ("01-plan-ground", "01-plan-ground", "Ground floor from above: the zones, the stations (E)"),
    ("02-plan-upper", "02-plan-upper", "Upper floor from above"),
    ("04-door", "04-door", "From the door, the walking camera: by day, and at night on its lamps"),
    ("05-entrance-eye", "05-entrance-eye", "Walking in at eye height: the banners on the rail, the oval ceiling, the library"),
    ("06-aquarium-ground", "06-aquarium-ground", "The aquarium from the ground lounge"),
    ("07-aquarium-close", "07-aquarium-close", "The aquarium close up: schools of silver, orange fish, the reef, caustics"),
    ("08-work-floor", "08-work-floor", "The work floor under the mezzanine"),
    ("12-lounge-aquarium", "12-lounge-aquarium", "The upper lounge looking at the aquarium's top half"),
    ("13-upper-lounge", "13-upper-lounge", "The upper lounge: shag carpet, velvet, the arc lamp, the walnut oval ceiling"),
    ("15-walk-upper", "15-walk-upper", "Upstairs, the walking camera"),
]
SINGLES = [  # day only, two to a row
    ("03-overview", "Both floors"),
    ("11-top-of-stairs", "From the top of the stairs"),
    ("09-board-founder", "The notice board and goals, the Founder's desk and blank plaque, the trophy case"),
    ("10-coffee-desk", "The green marble coffee bar, Wren's desk, the stair and its art"),
    ("14-admin-doors", "The two admin doors (locked)"),
    ("16-walk-under", "Under the mezzanine, walking: the floor above cut away"),
    ("17-coffee-line", "E at the coffee bar (its line is a draft)"),
    ("18-aquarium-line", "E at the aquarium (its line is a draft)"),
    ("19-admin-locked", "E at an admin door: \"Admins only. It's locked.\""),
]
W, H, PAD, CAP, HEAD = 720, 450, 14, 34, 120
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
rows = len(PAIRS) + (len(SINGLES) + 1) // 2
sheet = Image.new("RGB", (2 * (W + PAD) + PAD, rows * (H + CAP + PAD) + PAD + HEAD), "#1d1f22")
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), "HQ interior, phase 2: layout A furnished (20 x 16, two storeys)", font=title, fill="#f2efe8")
d.text((PAD, 52), "After David's references: walnut, green marble, velvet and leather, deep rugs, plants; light from lamps, strips and track spots;", font=sub, fill="#e9e5dc")
d.text((PAD, 74), "the aquarium two storeys tall with its own light. Left: day. Right: night (the lamps carry the room). Below: by day only.", font=sub, fill="#e9e5dc")


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
