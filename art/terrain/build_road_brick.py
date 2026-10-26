#!/usr/bin/env python3
"""The brick road from the plaza to the important buildings (terrain v3, game/village-art2; David, R2c 2026-10-26: "have
brick roads to the important shops"). A painted, tileable warm brick paving in colour (drawn untinted, like the path's
dirt): bricks 2 by 1 in running bond along the tile's x, each its own warm clay (terracotta, a few sun-faded ochre, a
few burnt dark), the faces softly mottled with broad worn patches, the arrises rounded and lit on their upper side and
shaded under, a few chipped corners, sandy joints with a little moss and grass creeping in. Every brick's outline is
nudged by noise so none is ruled straight. Painted from seeded noise with build_ground.py's helpers (nothing copied or
traced), every frequency whole across the tile, so it tiles.

  python3 art/terrain/build_road_brick.py [preview <png>]

Writes web/public/assets/game/terrain/road-brick-albedo.png (512, sRGB colour, 8 bricks across and 16 courses down: at
a tile of 2 u a brick is 0.25 by 0.125) and road-brick-normal.png (256, tangent space, OpenGL, from the same heights);
`preview` also writes a 2 x 2 tiling of the albedo.
"""
import os, sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_ground import band, blur, downsample_normal, encode_normal, hexrgb, normal_map, save, smoothstep  # noqa: E402

N, BW, BH = 512, 64, 32
CLAY = [hexrgb(h) for h in ("#c27a4e", "#cc8758", "#b66d48", "#d39867")]
OCHRE, BURNT, MORTAR, MOSS = hexrgb("#d4ad74"), hexrgb("#9a5a44"), hexrgb("#d9c8a2"), hexrgb("#869c58")


def road_brick(n=N, seed=307):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64) + 0.5
    # Wobble the layout a few pixels so no joint is ruled straight.
    x = xx + 1.2 * band(n, rng, 8, bw=0.5)
    y = yy + 0.9 * band(n, rng, 8, bw=0.5)
    row = np.floor(y / BH)
    xs = x + (row % 2) * BW / 2                      # running bond: every other course half a brick along
    col = np.floor(xs / BW)
    lx, ly = xs - col * BW, y - row * BH
    ident = ((row % (n // BH)) * (n // BW) + (col % (n // BW))).astype(int)
    k = (n // BH) * (n // BW)
    # Distance to the brick's edge, and the joint (wider where a corner is worn).
    du, dv = np.minimum(lx, BW - lx), np.minimum(ly, BH - ly)
    edge = np.minimum(du, dv) + 0.35 * band(n, rng, 32, bw=0.5)
    corner = smoothstep(7.0, 0.0, np.hypot(du, dv)) * (rng.random(k)[ident] < 0.35)
    joint = 1.6 + 2.4 * corner
    body = smoothstep(joint - 0.6, joint + 0.6, edge)
    shoulder = smoothstep(joint, joint + 4.5, edge)
    # Each brick its own clay: mostly terracotta, some faded ochre, a few burnt.
    pick = rng.random(k)
    base = np.array(CLAY)[rng.integers(0, len(CLAY), k)]
    base = np.where((pick > 0.92)[:, None], OCHRE, np.where((pick < 0.05)[:, None], BURNT, base))
    tone = rng.uniform(0.9, 1.08, k)
    face = 0.035 * band(n, rng, 16, bw=0.5) + 0.02 * band(n, rng, 48, bw=0.5)
    worn = smoothstep(-0.4, 1.6, band(n, rng, 3, bw=0.5, stretch=1.6))       # broad sun-worn patches
    brick = base[ident] * (tone[ident] * (1 + face))[..., None]
    brick = brick * (1 - 0.18 * worn[..., None]) + hexrgb("#e2b47c") * 0.18 * worn[..., None]
    # Painted light: the upper arris lit, the lower in shade, the face a touch domed.
    lit = smoothstep(joint + 4.5, joint, ly) * body
    shade = smoothstep(BH - joint - 5.0, BH - joint, ly) * body
    brick = brick * (1 + 0.14 * lit - 0.16 * shade)[..., None] * (0.86 + 0.14 * shoulder)[..., None]
    # Sandy joints, a little moss and grass creeping into some of them.
    grit = blur(rng.standard_normal((n, n)), 0.8)
    mortar = MORTAR * (0.9 + 0.05 * grit / grit.std())[..., None]
    green = smoothstep(0.6, 1.4, band(n, rng, 7, bw=0.5)) * (0.6 + 0.4 * smoothstep(-0.5, 1.0, grit))
    mortar = mortar * (1 - green[..., None] * 0.8) + MOSS * (green * 0.8)[..., None]
    out = brick * body[..., None] + mortar * (1 - body[..., None])
    # A soft dark line round each brick where it meets the joint (the painted outline).
    out *= (1 - 0.12 * (smoothstep(joint + 1.6, joint, edge) * body))[..., None]
    height = shoulder * 2.0 + face + (body - 1) * 1.4
    return np.clip(out, 0, 1), height


def main():
    col, h = road_brick()
    save("road-brick-albedo.png", col)
    save("road-brick-normal.png", encode_normal(downsample_normal(normal_map(h, 0.7), 2)))
    if "preview" in sys.argv:
        out = sys.argv[sys.argv.index("preview") + 1]
        img = np.clip(np.round(np.tile(col, (2, 2, 1)) * 255), 0, 255).astype(np.uint8)
        Image.fromarray(img).resize((512, 512), Image.LANCZOS).save(out)
        print("PREVIEW", out)


if __name__ == "__main__":
    main()
