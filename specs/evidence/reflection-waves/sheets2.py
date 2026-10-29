"""Round 2's evidence sheets (specs/lanes/reflection-waves.md), from the PNGs shoot.mjs writes with `sweep mist` and `skins`.

  python3 specs/evidence/reflection-waves/sheets2.py <sweep_mist_dir> <skins_dir> <out_dir>
"""
import glob, json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

SHOTS, SKINS, OUT = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
PAL = json.load(open(os.path.join(HERE, "..", "..", "..", "web", "data", "characters", "palette.json")))
FREE = [0, 1, 2, 3, 4, 5, 12]
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16)
except OSError:
    FONT = ImageFont.load_default()


def label(im, text):
    d = ImageDraw.Draw(im)
    box = d.textbbox((8, 6), text, font=FONT)
    d.rectangle((box[0] - 5, box[1] - 3, box[2] + 5, box[3] + 3), fill=(28, 24, 20))
    d.text((8, 6), text, font=FONT, fill=(255, 246, 226))
    return im


def sheet(tiles, cols, out, title):
    w = max(t.width for t in tiles)
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    hs = [max(t.height for t in r) for r in rows]
    img = Image.new("RGB", (cols * w + (cols - 1) * 6, 34 + sum(hs) + (len(rows) - 1) * 6), (16, 14, 12))
    ImageDraw.Draw(img).text((10, 8), title, font=FONT, fill=(255, 209, 102))
    y = 34
    for r, h in zip(rows, hs):
        for i, t in enumerate(r):
            img.paste(t, (i * (w + 6), y))
        y += h + 6
    img.save(os.path.join(OUT, out), quality=82)
    print(out, img.size)


ms = lambda f: int(re.search(r"(\d+)\.png$", f).group(1))
fit = lambda im, w: im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def strip(tag):
    fs = sorted(glob.glob(os.path.join(SHOTS, f"{tag}-seq-*.png")))
    return fs, [label(fit(Image.open(f).convert("RGB"), 300), "+%d ms" % ms(f)) for f in fs]


fs, tiles = strip("sweep")
sheet(tiles, 6, "07-sweep.webp", "The new look sweeps in with the crest (a few choices in): mid-wave the top is new, the bottom still old, the seam under the foam")
mid = [f for f in fs if 650 <= ms(f) <= 900]
sheet([label(fit(Image.open(f).convert("RGB"), 520), "+%d ms" % ms(f)) for f in mid[:3]], 3, "08-sweep-mid.webp", "Mid-wave, closer: new hair behind the crest, the old bob still ahead of it")
fs, tiles = strip("mist")
sheet(tiles, 6, "09-first-wave-mist.webp", "The first wave, the world still in the golden mist: the crest and the sweep kept clear through it")

# The free hair swatches next to every skin tone, the old blond beside the new.
skins, hair = PAL["skin"], PAL["hair"]
NAMES = ["black", "dark brown", "brown", "mid brown", "light brown"]
cols = [(NAMES[i], hair[i]) for i in FREE[:5]] + [("old blond", "#D6A866"), ("blond", hair[5]), ("ginger", hair[12])]
cw, rh = 112, 46
img = Image.new("RGB", (110 + cw * len(cols), 30 + rh * len(skins)), (250, 246, 236))
d = ImageDraw.Draw(img)
for j, (name, hx) in enumerate(cols):
    d.text((110 + j * cw + 8, 8), name, font=FONT, fill=(60, 50, 40))
for r, sk in enumerate(skins):
    y = 30 + r * rh
    d.text((8, y + 14), f"skin {r}", font=FONT, fill=(60, 50, 40))
    for j, (_, hx) in enumerate(cols):
        x = 110 + j * cw
        d.rectangle((x + 4, y + 4, x + cw - 4, y + rh - 4), fill=sk)
        d.ellipse((x + cw // 2 - 16, y + 7, x + cw // 2 + 16, y + rh - 7), fill=hx, outline=(40, 32, 26))
panel = fit(Image.open(os.path.join(SKINS, "swatches.png")).convert("RGB").crop((900, 0, 1440, 900)), 330)
sheet([img, label(panel, "the arrival's hair colours")], 2, "10-hair-swatches-on-skin.webp",
      "The free hair colours on every skin: the blond golden now (the old one beside it), ginger added; no wheel")

# Every free colour in the reflection on a light, a middle and a dark skin, on a mid-brown and a white style.
for style in (12, 13):
    tiles = []
    for skin in ("00", "06", "11"):
        for i in range(1, 8):
            f = os.path.join(SKINS, f"skin{skin}-style{style}-hair{i}.png")
            name = ["", "black", "dark brown", "brown", "mid brown", "light brown", "blond", "ginger"][i]
            tiles.append(label(fit(Image.open(f).convert("RGB").crop((250, 60, 700, 560)), 200), f"skin {int(skin)}, {name}"))
    sheet(tiles, 7, f"11-hair-on-skins-style{style}.webp",
          f"In the reflection, hairstyle {style}: a colour turns the style's hue and keeps its lightness, so it barely shows here")
