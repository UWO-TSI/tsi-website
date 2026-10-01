"""The painted strand texture of the v8 hair (specs/avatar-v8.md deliverable 1; David's hair-acnh.png A1.1-A2.3).

  python3 art/characters/v8/strands.py

A grey multiplier (1.0 = the hair colour as tinted) that the engine lays along every lock by its lock UVs: u across
the lock (0 and 1 its side edges, 0.5 the ridge), v from the root (top row) to the tip (bottom row). Fine soft strand
lines, a few lighter ones, broad soft streaks, the lock's sides a little darker (they turn into the next lock) and a
slight root-to-tip value shift (darker at the root). Matte: values only, no highlight. Seeded, so it rebuilds
byte-identical.
"""
import os
import numpy as np
from PIL import Image

W, H = 256, 128                       # u across the lock, v along it (strands run along v)
rng = np.random.default_rng(264)
U, V = np.meshgrid((np.arange(W) + 0.5) / W, (np.arange(H) + 0.5) / H)


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


img = np.ones((H, W))
for _ in range(4):                    # broad soft streaks
    c, w, a = rng.uniform(0.12, 0.88), rng.uniform(0.05, 0.1), rng.uniform(-0.07, 0.05)
    img += a * np.exp(-((U - c - 0.01 * np.sin(V * 5 + c * 9)) / w) ** 2)
for k in range(34):                   # fine strands: mostly darker lines, every third a lighter one
    light = k % 3 == 2
    c = rng.uniform(0.04, 0.96)
    w = rng.uniform(0.0035, 0.009)
    a = rng.uniform(0.04, 0.07) if light else -rng.uniform(0.07, 0.17)
    v0, v1 = rng.uniform(0.0, 0.25), rng.uniform(0.6, 1.0)
    wob = rng.uniform(0.002, 0.006) * np.sin(V * rng.uniform(4, 9) + rng.uniform(0, 6.3))
    img += a * np.exp(-((U - c - wob) / w) ** 2) * ss(v0, v0 + 0.08, V) * (1 - ss(v1 - 0.12, v1, V))
img *= 0.86 + 0.14 * ss(0.0, 0.2, np.minimum(U, 1 - U))      # the sides turn into the next lock
img *= 0.88 + 0.12 * ss(0.0, 0.55, V)                       # root-to-tip value shift
img = np.clip(img, 0, 1)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hair_strands.png")
Image.fromarray((img * 255 + 0.5).astype(np.uint8), "L").save(out, optimize=True)
print("STRANDS", out, img.min().round(3), img.mean().round(3), img.max().round(3))
