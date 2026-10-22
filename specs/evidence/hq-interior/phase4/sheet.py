"""HQ phase 4's review sheet (David's phase 3 review, 2026-10-22): the gallery grown to 24 x 18, the big lounge before
the tank, the study upstairs, the big windows, the one admin door under the stair, more lamps, materials that meet the
light (the headless shots of shots.mjs), day and night side by side where both were shot, one WebP.
  python3 sheet.py <raw-dir> <out.webp>"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
PAIRS = [   # (day shot, night shot, caption): each a row, day left, night right
    ("01-plan-ground", "01-plan-ground", "Ground floor from above: the zones, the stations (E)"),
    ("02-plan-upper", "02-plan-upper", "Upper floor from above: the bridge, the study, the right arm"),
    ("04-door", "04-door", "From the door, the walking camera"),
    ("05-lounge", "05-lounge", "The big lounge before the tank: the sectional, beanbags, the big rug"),
    ("06-lounge-close", "06-lounge-close", "On the sectional's corner: velvet, pillows, beanbags by the glass"),
    ("07-study", "07-study", "Upstairs, the study: the long table, monitors, chairs, shelves, whiteboard"),
    ("08-study-close", "08-study-close", "At the study's table"),
    ("09-bridge", "09-bridge", "The bridge's lounge looking at the tank"),
    ("10-windows-upper", "10-windows-upper", "Big modern windows: the right wall over the stair"),
    ("11-windows-ground", "11-windows-ground", "Big modern windows: the front wall, the work lounge's pane"),
    ("12-admin-door", "12-admin-door", "The one admin door, under the stair (locked)"),
    ("13-corner-nook", "13-corner-nook", "Corner: the window nook and the workbench"),
    ("14-corner-founder", "14-corner-founder", "Corner: the Founder's desk, the clock, the trophy case"),
    ("15-corner-bridge", "15-corner-bridge", "Corner: the bridge's right end"),
    ("16-corner-landing", "16-corner-landing", "Corner: the right arm, the landing, the canvas"),
    ("17-mat-velvet", "17-mat-velvet", "Close: velvet's sheen, the shag"),
    ("18-mat-leather", "18-mat-leather", "Close: leather, the work lounge"),
    ("19-mat-marble", "19-mat-marble", "Close: polished green marble, chrome"),
    ("20-mat-walnut", "20-mat-walnut", "Close: satin walnut, the floor's planks"),
    ("21-mat-metal-glass", "21-mat-metal-glass", "Close: the chrome arc lamp, the clear glass rail"),
    ("22-walk-hall", "22-walk-hall", "The walking camera in the hall, at the lounge"),
    ("23-walk-study", "23-walk-study", "The walking camera upstairs, at the study"),
]
SINGLES = [  # day only, two to a row
    ("03-overview", "Both floors"),
    ("26-admin-locked", "E at the admin door: \"Admins only. It's locked.\""),
    ("24-coffee-line", "E at the coffee bar (its line is a draft)"),
    ("25-aquarium-line", "E at the aquarium (its line is a draft)"),
]
W, H, PAD, CAP, HEAD = 720, 450, 14, 34, 120
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
rows = len(PAIRS) + (len(SINGLES) + 1) // 2
sheet = Image.new("RGB", (2 * (W + PAD) + PAD, rows * (H + CAP + PAD) + PAD + HEAD), "#1d1f22")
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), "HQ interior, phase 4: David's phase 3 notes (24 x 18, two storeys of 4.6, the ceiling at 9.2)", font=title, fill="#f2efe8")
d.text((PAD, 52), "Bigger; a real lounge before the tank (sectional, beanbags, big rug); the study upstairs (long table, monitors, chairs, shelves); big modern windows;", font=sub, fill="#e9e5dc")
d.text((PAD, 74), "one admin door under the stair; more lamps, softer pools, no dark corners; materials that meet the light. Left: day. Right: night. Below: by day only.", font=sub, fill="#e9e5dc")


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
