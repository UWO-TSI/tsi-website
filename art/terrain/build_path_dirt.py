#!/usr/bin/env python3
"""The path's yellow dirt (terrain v3, game/village-art; David, 2026-10-26: "path should be like [path.jpg] where it has
yellow ish dirt mud", specs/references/terrain/r2-2026-10-26/path.jpg). A painted, tileable earth in colour (not the
greyscale soil the seasons tint): broad sunny and worn patches laid on like brush strokes, a few flat stones bedded in
it with a soft dark outline, faint drying cracks and a little grit. Painted from seeded noise with build_ground.py's
helpers (nothing copied or traced), every frequency whole across the tile and every stamp wrapping, so it tiles.

  python3 art/terrain/build_path_dirt.py [preview <png>]

Writes web/public/assets/game/terrain/path-albedo.png (512, sRGB colour, drawn untinted). Its relief is the soil's
(soil-normal.png); `preview` also writes a 2 x 2 tiling of it.
"""
import os, sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_ground import band, blur, fbm, pebble, poisson, save, smoothstep, voronoi  # noqa: E402

N = 512
SUN, MID, WORN, STONE = (np.array(c) / 255 for c in ((228, 199, 134), (212, 178, 110), (191, 154, 93), (198, 186, 158)))


def path_dirt(n=N, seed=211):
    rng = np.random.default_rng(seed)
    # Broad patches, stretched along the tile's x like strokes of a wide brush, then a finer mottle.
    broad = 0.65 * band(n, rng, 3, bw=0.5, stretch=2.2) + 0.35 * band(n, rng, 6, bw=0.5, stretch=2.6, angle=0.3)
    t = smoothstep(-1.8, 1.8, broad + 0.12 * fbm(n, rng, 12, 3))
    col = WORN + (MID - WORN) * smoothstep(0.0, 0.5, t)[..., None] + (SUN - MID) * smoothstep(0.5, 1.0, t)[..., None]
    col *= (1 + 0.014 * band(n, rng, 24, bw=0.5) + 0.006 * blur(rng.standard_normal((n, n)), 1.2))[..., None]
    # Faint drying cracks along the edges of big warped cells, only in the worn patches.
    pts = poisson(n, rng, 120)
    dx, dy = band(n, rng, 5) * 10 + band(n, rng, 48) * 1.5, band(n, rng, 5) * 10 + band(n, rng, 48) * 1.5
    _, _, edge = voronoi(n, pts, dx, dy)
    crack = smoothstep(1.5, 0.4, edge) * smoothstep(0.55, 0.2, t) * smoothstep(-0.2, 0.6, band(n, rng, 6, bw=0.4))
    col *= (1 - 0.14 * crack)[..., None]
    # Flat stones bedded in the dirt: a soft-edged slab with a lit upper rim and a dark painted outline.
    for x, y in poisson(n, rng, 175):
        r = rng.uniform(16, 30)
        p = pebble(rng, r)
        m = p.shape[0]
        ix = np.ix_((np.arange(m) + int(y) - m // 2) % n, (np.arange(m) + int(x) - m // 2) % n)
        body = smoothstep(0.02, 0.18, p)
        ring = smoothstep(0.0, 0.05, p) - body
        lit = np.clip(np.roll(p, 2, 0) - p, 0, 1) * 1.6
        tone = STONE * rng.uniform(0.92, 1.06) * (1 + 0.08 * lit[..., None] - 0.05 * (1 - p)[..., None])
        sub = col[ix]
        sub = sub * (1 - 0.35 * ring[..., None])
        col[ix] = sub * (1 - body[..., None]) + tone * body[..., None]
    # Grit: a sprinkle of lighter and darker specks.
    for _ in range(500):
        x, y = rng.integers(0, n, 2)
        col[y, x] *= rng.choice([0.93, 1.05])
    return np.clip(col, 0, 1)


def main():
    col = path_dirt()
    save("path-albedo.png", col)
    if "preview" in sys.argv:
        out = sys.argv[sys.argv.index("preview") + 1]
        img = np.clip(np.round(np.tile(col, (2, 2, 1)) * 255), 0, 255).astype(np.uint8)
        Image.fromarray(img).resize((512, 512), Image.LANCZOS).save(out)
        print("PREVIEW", out)


if __name__ == "__main__":
    main()
