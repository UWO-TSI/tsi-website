"""Round 4 evidence images from the PNGs shoot.mjs writes: each frame strip (`<name>-fNN.png`) as one row, and each
single shot scaled down, all as WebP. A blank frame is refused.

  python3 specs/evidence/tutorial-v2/v4/strips.py <shots_dir> <out_dir> [width]
"""
import os, re, sys
from PIL import Image, ImageStat

SHOTS, OUT = sys.argv[1:3]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 720
os.makedirs(OUT, exist_ok=True)


def load(name, w):
    im = Image.open(os.path.join(SHOTS, name)).convert("RGB")
    if ImageStat.Stat(im.convert("L")).stddev[0] < 3:
        raise SystemExit(f"blank: {name}")
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


pngs = sorted(f for f in os.listdir(SHOTS) if f.endswith(".png"))
strips = {}
for n in pngs:
    m = re.match(r"(.+)-f\d\d\.png$", n)
    if m:
        strips.setdefault(m.group(1), []).append(n)
    else:
        load(n, W).save(os.path.join(OUT, n[:-4] + ".webp"), "WEBP", quality=80)
for base, frames in strips.items():
    w = max(240, min(420, 2400 // len(frames)))
    tiles = [load(f, w) for f in frames]
    img = Image.new("RGB", (len(tiles) * w + (len(tiles) - 1) * 4, tiles[0].height), (16, 14, 12))
    for i, t in enumerate(tiles):
        img.paste(t, (i * (w + 4), 0))
    img.save(os.path.join(OUT, base + "-strip.webp"), "WEBP", quality=78)
    print("strip", base, len(frames), img.size)
