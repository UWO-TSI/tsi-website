"""Paint the washi paper texture (the sushi menu's paper; David's 2026-10-28 references, not copied): a 256 px tile of
soft fibre in black at low alpha, to multiply over the paper colour token (--ui-paper). Seeded, tileable.
    python3 art/ui/washi.py  ->  web/public/assets/ui/washi.png
"""
import math, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N, SEED = 256, 7
rng = random.Random(SEED)
big = Image.new("L", (N * 3, N * 3), 0)  # drawn 3x3 so strokes wrap: the middle tile is kept
d = ImageDraw.Draw(big)

def fibre(x, y, length, width, alpha):
    a = rng.uniform(0, math.tau)
    pts = []
    for _ in range(int(length)):
        pts.append((x, y))
        a += rng.gauss(0, 0.18)
        x += math.cos(a); y += math.sin(a)
    for dx in (-N, 0, N):
        for dy in (-N, 0, N):
            d.line([(px + N + dx, py + N + dy) for px, py in pts], fill=alpha, width=width)

for _ in range(34):   # long soft fibres
    fibre(rng.uniform(0, N), rng.uniform(0, N), rng.uniform(40, 120), 1, rng.randint(12, 24))
for _ in range(110):  # short fine fibres
    fibre(rng.uniform(0, N), rng.uniform(0, N), rng.uniform(6, 24), 1, rng.randint(9, 20))
tile = big.crop((N, N, 2 * N, 2 * N)).filter(ImageFilter.GaussianBlur(0.8))
# Cloudy formation (the uneven pulp), from a 3x3-tiled noise so it wraps too.
noise = np.tile(np.random.default_rng(SEED).random((N // 8, N // 8)), (3, 3))
cloud = Image.fromarray((noise * 255).astype("uint8")).resize((N * 3, N * 3), Image.BICUBIC).filter(ImageFilter.GaussianBlur(10)).crop((N, N, 2 * N, 2 * N))
a = np.clip(np.array(tile, dtype=np.float32) + (np.array(cloud, dtype=np.float32) - 128) * 0.09 + 8, 0, 255)
# Fine grain.
a += np.random.default_rng(SEED + 1).normal(0, 3.2, (N, N))
a = np.clip(a, 0, 255).astype("uint8")
out = Image.merge("LA", (Image.new("L", (N, N), 0), Image.fromarray(a)))
dest = Path(__file__).resolve().parents[2] / "web/public/assets/ui/washi.png"
out.save(dest, optimize=True)
print(dest, dest.stat().st_size)
