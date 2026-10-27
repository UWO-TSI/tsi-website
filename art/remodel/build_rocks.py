"""The gather rocks, remodelled as ours (game/remodel round 2; David, 2026-10-27: "i like the old one, it actually looks
like real rocks with texture and not random smooth shape, redo to make it more like the before"): the rocks a player
strikes for stone and ore (web/data/world kind "rock", models rock-a, rock-b, rock-c; drawn by the map's props at about
scale 1), in place of the dump's (acnh/props/rock-{a,b,c}.glb).

Built like the old ones read: a lumpy boulder broken by a few flat faces (planes pressed into it, so it shows facets
with soft rounded edges between), sat flat on the ground, under a small granite texture (grey mottling with dark and pale
grains, our own: numpy noise) projected box-wise so it reads as real stone at any side, the top lighter and the foot
darker in COLOR_0. One P_Stone material each.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_rocks.py

Writes game/remodel/props/rock-{a,b,c}.glb (the dump's names: lib/game/world/active.ts worldModel swaps the folder in the
new world) in game units at scale 1, the dump's frame (the origin on the ground at the middle), each fitted to the old
rock's bounds (a 0.96 by 0.88, 0.61 tall; b 0.92 by 0.84, 0.59; c 0.98 by 0.99, 0.52) and at or under its triangles
(214, 198, 146), so PROP_FOOTPRINT and PROP_TOP in lib/game/defaultIsland.ts hold.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import ARGS, K  # noqa: E402

TEX = 128
GREY = "#d4dbd0"

# name: (old bounds half x, top, half z), sphere segs and rings, seed, pressed planes (game normal, depth as a share of
# the radius along it), lean of the top (x, z)
ROCKS = {
    "a": ((0.479, 0.609, 0.44), 12, 9, 31, [((0.5, 1, 0.2), 0.62), ((1, 0.25, -0.2), 0.7), ((-0.6, 0.5, 0.9), 0.68), ((-0.9, 0.2, -0.5), 0.74), ((0.3, 0.3, -1), 0.76)], (0.12, -0.04)),
    "b": ((0.458, 0.587, 0.418), 12, 8, 37, [((-0.4, 1, 0.1), 0.6), ((0.9, 0.5, 0.5), 0.66), ((0.1, 0.3, -1), 0.72), ((-1, 0.2, 0.3), 0.72), ((0.6, 0.6, -0.6), 0.7)], (-0.1, 0.05)),
    "c": ((0.491, 0.522, 0.497), 10, 7, 43, [((0.2, 1, -0.3), 0.58), ((0.8, 0.5, 0.6), 0.68), ((-0.7, 0.4, -0.6), 0.7), ((-0.5, 0.3, 0.9), 0.76)], (0.05, 0.08)),
}


def granite(seed):
    """A tileable small grey stone: soft mottling, darker and paler grains, a faint warm and cool drift."""
    h = w = TEX
    base = 0.86 + 0.14 * (K.fbm(h, w, 4, seed, 3) - 0.5) * 2
    dark = K.smooth(0.74, 0.82, K.noise(h, w, 40, seed + 1)) * 0.13
    pale = K.smooth(0.76, 0.84, K.noise(h, w, 34, seed + 2)) * 0.1
    fine = (K.noise(h, w, 64, seed + 3) - 0.5) * 0.06
    v = np.clip(base - dark + pale + fine, 0, 1)
    out = v[..., None] * K.arr("#ffffff")
    warm = K.smooth(0.45, 0.8, K.fbm(h, w, 3, seed + 4, 2))[..., None]
    return np.clip(out * (1 - 0.06 * warm) + K.arr("#d9c8b0") * 0.06 * warm * v[..., None], 0, 1)


def rock(name):
    (hx, top, hz), segs, rings, seed, planes, lean = ROCKS[name]
    K.reset()
    k = K.Kit(f"gather-rock-{name}")
    mat = K.Mat("P_Stone", rough=0.95, tex=K.image(f"granite_{name}", granite(seed)))
    # A lumpy ball a little over the old bounds (the planes and the fit below bring it back), its foot under the ground.
    k.blob((0, 0, 0), (1.0, 1.0, 1.0), mat, GREY, segs=segs, rings=rings, seed=seed, lumpy=0.16, flat_bottom=-0.45)
    rng = np.random.default_rng(seed)
    # Blender's frame inside the kit: game (x, y, z) -> (x, -z, y) (propkit.G).
    for v in k.bm.verts:
        g = Vector((v.co.x, v.co.z, -v.co.y))
        # Steeper shoulders than a ball (the old rocks stand like blocks with a sloped top).
        wide = 1.0 + 0.4 * max(0.0, g.y)
        g.x *= wide
        g.z *= wide
        for n, depth in planes:
            n = Vector(n).normalized()
            d = g.dot(n)
            if d > depth:
                g -= n * (d - depth) * 0.92
        g.x += lean[0] * max(0.0, g.y)
        g.z += lean[1] * max(0.0, g.y)
        g *= 1.0 + rng.uniform(-0.025, 0.025)
        v.co = Vector((g.x, -g.z, g.y))
    # Fit to the old rock's bounds: the foot at y 0 (a sliver sunk), the widest at the old half sizes.
    xs, ys, zs = ([v.co.x for v in k.bm.verts], [v.co.z for v in k.bm.verts], [-v.co.y for v in k.bm.verts])
    cx, cz, y0, y1 = (max(xs) + min(xs)) / 2, (max(zs) + min(zs)) / 2, min(ys), max(ys)
    sx, sy, sz = hx / ((max(xs) - min(xs)) / 2), top / (y1 - y0), hz / ((max(zs) - min(zs)) / 2)
    for v in k.bm.verts:
        x, y, z = (v.co.x - cx) * sx, (v.co.z - y0) * sy - 0.012, (-v.co.y - cz) * sz
        v.co = Vector((x, -z, y))
    # Box-projected UVs (a 0.55 unit repeat) and the colour: the top lighter, the foot darker, a tone per face.
    k.bm.normal_update()
    for f in k.bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        tone = 1.0 + rng.uniform(-0.05, 0.05)
        for lp in f.loops:
            x, y, z = lp.vert.co
            u, w = ((y, z), (x, z), (x, y))[ax]
            lp[k.uv].uv = (u / 0.55 + 0.37 * ax, w / 0.55 + 0.21 * ax)
            t = min(1.0, max(0.0, z / top))
            s = (0.72 + 0.34 * t ** 0.6) * tone
            c = lp[k.col]
            lp[k.col] = (min(1.0, c[0] * s), min(1.0, c[1] * s), min(1.0, c[2] * s), 1.0)
    ob = k.finish(smooth_deg=42)
    K.export([ob], f"game/remodel/props/rock-{name}.glb")


if __name__ == "__main__":
    for n in ARGS or ROCKS:
        rock(n)
