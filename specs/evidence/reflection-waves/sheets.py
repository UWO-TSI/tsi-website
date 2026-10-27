"""The reflection-waves evidence sheets, from the PNGs shoot.mjs writes (specs/lanes/reflection-waves.md).

  python3 specs/evidence/reflection-waves/sheets.py <shots_dir> <clear_shots_dir> <colours_dir> <out_dir>
"""
import glob, os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

SHOTS, CLEAR, COLOURS, OUT = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16)
except OSError:
    FONT = ImageFont.load_default()


def tile(path, w, label, crop=None):
    im = Image.open(path).convert("RGB")
    if crop:
        im = im.crop(crop)
    if ImageStat.Stat(im.convert("L")).stddev[0] < 3:
        raise SystemExit(f"blank tile: {path}")
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    box = d.textbbox((8, 6), label, font=FONT)
    d.rectangle((box[0] - 5, box[1] - 3, box[2] + 5, box[3] + 3), fill=(28, 24, 20))
    d.text((8, 6), label, font=FONT, fill=(255, 246, 226))
    return im


def sheet(tiles, cols, out, title):
    w = tiles[0].width
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


def seq(d, tag):
    fs = sorted(glob.glob(os.path.join(d, f"{tag}-seq-*.png")))
    ms = lambda f: int(re.search(r"(\d+)\.png$", f).group(1))
    return [tile(f, 300, "+%d ms" % ms(f)) for f in fs[::2]]


three = lambda d, tag, w: [tile(os.path.join(d, f"{tag}-{n}.png"), w, l) for n, l in [("1-rest", "at rest"), ("2-mid", "crest at the face"), ("3-after", "just after")]]
sheet(three(SHOTS, "desktop", 640), 3, "01-desktop.webp", "The reflection creator, 1440x900: at rest, a wave's crest at your face, just after (the first change, the world still blurred)")
sheet(three(SHOTS, "phone", 300), 3, "02-phone.webp", "Phone, 390x844: at rest, crest at the face, just after")
sheet(seq(SHOTS, "desktop"), 6, "03-wave-sequence.webp", "A wave rolling past (scene only, ms since the change); the look is rewritten as the crest crosses your face")
sheet(seq(CLEAR, "desktop"), 6, "04-wave-sequence-clearer.webp", "The same a few choices in (the world sharper): the small waves' wobble and light, the foam cap, the foam left behind")
sheet([tile(os.path.join(CLEAR, "desktop-0-calm-0.png"), 440, "calm"), tile(os.path.join(CLEAR, "desktop-0-calm-1.png"), 440, "calm, 0.5 s later")], 2, "05-small-waves.webp", "No change: the living sea (swell, chop, light on the wavelets), half a second apart")
sheet([tile(os.path.join(COLOURS, "desktop-4-hair-colours.png"), 380, "hair colours", (900, 0, 1440, 900))], 1, "06-hair-colours-no-wheel.webp", "Hair colours in the arrival: swatches only, no wheel")
