"""Evidence sheets for the tutorial-v2 lane, from the PNGs shoot.mjs writes. Each tile is labelled with its file's name;
a uniform (blank) frame is refused unless it is the opening's black (`0.15` in its name).

  python3 specs/evidence/tutorial-v2/sheets.py <shots_dir> <out_dir>
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
    if ImageStat.Stat(im.convert("L")).stddev[0] < 3 and "0.15" not in name:
        raise SystemExit(f"blank tile: {name}")
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    text = re.sub(r"^[\w]+?-", "", name[:-4]).replace("-", " ")
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
    img.save(os.path.join(OUT, out), "WEBP", quality=78)
    print("sheet", out, img.size)


pngs = sorted(f for f in os.listdir(SHOTS) if f.endswith(".png"))
groups = [
    ("01-opening-aboard.webp", "The opening: no underwater; black a moment, then the fade in aboard Bram's boat, leaning over into the creator", ("01-",), 4, 480),
    ("02-reflection-creator.webp", "The reflection creator, 1440x900: the face in the water upright, the shirt in frame; Tops on the rail, a new top and colour rewritten by the ripple", ("02-",), 3, 640),
    ("02m-reflection-matches-you.webp", "One character, one look: the back of your head over the side and your reflection, loud hair (pink pigtails, blue high pony)", ("02m-",), 2, 720),
    ("03-reflection-creator-phone.webp", "Phone 390x844: the creator, a new top", ("03-",), 2, 390),
    ("04-no-eyebrows.webp", "Eyebrows removed: an old saved look with brows and a brows placement loads cleanly; no Brows category on the rail", ("04-",), 2, 720),
    ("05-tour-desktop.webp", "Bram's walk-along v2, 1440x900: the \"!\" stops, each talk, the tracker ticking, the beach, the rod, fishing, the B and market lines", ("05-",), 3, 640),
    ("06-tour-phone.webp", "Bram's walk-along v2 on a phone (390x844, touch): the stops, the tracker, the beach and fishing, the end", ("06-",), 4, 390),
]
for out, title, prefixes, cols, w in groups:
    names = [n for n in pngs if n.startswith(prefixes)]
    if names:
        sheet(names, w, cols, out, title)
