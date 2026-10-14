"""The v1 opening's evidence sheets (specs/v1-drop.md §1), from the PNGs shoot.mjs writes: the whole arrival as a frame
strip (underwater, aboard, the creator and its ripples, Yes, the five crossing shots, the landing, the walk-along), the
creator at desktop and phone sizes. Each tile labelled with its file's name; a uniform frame (blank) is refused unless
it is the mist's (`mist` in its name).

  python3 specs/evidence/v1-opening/sheets.py <shots_dir> <out_dir>
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

SHOTS, OUT = sys.argv[1:3]
os.makedirs(OUT, exist_ok=True)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)
except OSError:
    FONT = ImageFont.load_default()


def tile(name, w):
    im = Image.open(os.path.join(SHOTS, name)).convert("RGB")
    if ImageStat.Stat(im.convert("L")).stddev[0] < 3 and "mist" not in name:
        raise SystemExit(f"blank tile: {name}")
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    text = re.sub(r"^\w+?-", "", name[:-4]).replace("-", " ")
    box = d.textbbox((10, 8), text, font=FONT)
    d.rectangle((box[0] - 6, box[1] - 4, box[2] + 6, box[3] + 4), fill=(28, 24, 20))
    d.text((10, 8), text, font=FONT, fill=(255, 246, 226))
    return im


def sheet(names, w, cols, out, title):
    tiles = [tile(n, w) for n in names]
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    hs = [max(t.height for t in r) for r in rows]
    img = Image.new("RGB", (cols * w + (cols - 1) * 6, 38 + sum(hs) + (len(rows) - 1) * 6), (16, 14, 12))
    ImageDraw.Draw(img).text((10, 9), title, font=FONT, fill=(255, 209, 102))
    y = 38
    for r, h in zip(rows, hs):
        x = 0
        for t in r:
            img.paste(t, (x, y))
            x += w + 6
        y += h + 6
    img.save(os.path.join(OUT, out), "WEBP", quality=74)
    print("sheet", out, img.size)


pngs = sorted(f for f in os.listdir(SHOTS) if f.endswith(".png"))
groups = [
    ("01-arrival-underwater-aboard.webp", "The arrival: underwater (heartbeat, shafts, the hull, the surface, Bram's hand), aboard blurred", ("01-", "02-"), 4),
    ("02-reflection-creator-desktop.webp", "The reflection creator, 1440x900: the scene, the options, the rail, Yes on the water; ripples rewrite you", ("03-", "04-", "05-", "06-", "07-", "08-"), 3),
    ("03-crossing.webp", "The crossing, golden hour: drone out of the mist, bow, close-up dripping, the wake, the wharf; the landing", ("09-", "10-", "11-"), 4),
    ("04-walk-along.webp", "The walk-along with Bram: the dock, hints, the crate, the Tab and B glyphs, the street, the plaza", ("12-", "13-", "14-", "15-", "16-", "17-", "18-", "19-", "20-"), 4),
    ("06-reflection-rail.webp", "Every category in the reflection's rail (hair with David's hairstyles, faces, clothes), a hairstyle and a face worn", ("r",), 4),
    ("05-phone.webp", "Phone, 390x844: underwater, aboard, the creator and its ripple, the crossing, the dock", ("p",), 4),
]
for out, title, prefixes, cols in groups:
    names = [n for n in pngs if n.startswith(prefixes)]
    if names:
        sheet(names, 360 if not out.startswith("05") else 220, cols if not out.startswith("05") else 7, out, title)
