"""The new world's plaza floor (terrain v3 R2b; David, 2026-10-26: "have floor be tiles").

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_plaza_tiles.py [-- review <dir>]

Stone setts laid in rings round a round centre stone, out to the plaza's edge (lib/game/world/generate.ts PLAZA, radius
12), a darker kerb ring at the rim. Each sett its own tone; the gaps between them show the ground's stone paint as grout.
Writes web/public/assets/game/props/plaza-tiles.glb: the origin on the ground at the plaza's centre, the setts' tops at
y 0.03. Seeded: a rebuild writes the same model.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
R, CENTRE, BAND, GAP, TOP, THICK = 12.0, 1.1, 0.85, 0.06, 0.03, 0.08
LIGHT, DARK, KERB = "#dcd6cb", "#bdb5a8", "#a29b8f"  # lighter (David, R2b: "tile color could be slightly lighter")
rng = np.random.default_rng(1212)


def tone(a, b, t):
    ca, cb = np.array(K.hexrgb(a)), np.array(K.hexrgb(b))
    return "#" + "".join(f"{int(round(v * 255)):02x}" for v in np.clip(ca + (cb - ca) * t, 0, 1))


def sett(k, M, r0, r1, a0, a1, col, sides):
    """One sett: the ring sector r0..r1, a0..a1 (radians), its top at TOP; with `sides`, its sides down into the ground
    (only the kerb's: an inner sett stands 0.03 proud, too little to see, and the budget is 3000 triangles)."""
    pts = lambda r, y: [(r * math.cos(a), y, r * math.sin(a)) for a in (a0, a1)]
    top = [*pts(r0, TOP), *reversed(pts(r1, TOP))]
    bot = [*pts(r0, TOP - THICK), *reversed(pts(r1, TOP - THICK))]
    uv = lambda p: (p[0] / 1.6, p[2] / 1.6)
    vt, vb = [k.vert(p) for p in top], [k.vert(p) for p in bot]
    k.face(vt, [uv(p) for p in top], M, col)
    for i in range(4 if sides else 0):
        j = (i + 1) % 4
        k.face([vb[i], vb[j], vt[j], vt[i]], [uv(bot[i]), uv(bot[j]), (uv(top[j])[0], uv(top[j])[1] + 0.03), (uv(top[i])[0], uv(top[i])[1] + 0.03)], M, tone(col, KERB, 0.4))


def build():
    K.reset()
    M = K.Mat("M_PlazaStone", tex=K.image("plaza_stone", K.stone(256, 256, 1213, "#ffffff")), rough=0.95)
    k = K.Kit("plaza-tiles")
    k.lathe((0, 0, 0), [(0.0, TOP + 0.01), (CENTRE * 0.97, TOP + 0.01), (CENTRE, TOP - 0.01), (CENTRE, TOP - THICK)], M, KERB, n=24, v_len=1.6)
    r, ring = CENTRE + GAP, 0
    while r < R - 0.1:
        r1 = min(R, r + BAND)
        kerb = r1 >= R - 0.01
        n = max(6, round(2 * math.pi * (r + r1) / 2 / (1.3 if kerb else 0.95)))
        turn = rng.random() * 2 * math.pi / n
        for i in range(n):
            a0, a1 = turn + 2 * math.pi * i / n, turn + 2 * math.pi * (i + 1) / n
            g = GAP / 2 / ((r + r1) / 2)
            col = tone(KERB, DARK, rng.uniform(0, 0.5)) if kerb else tone(DARK, LIGHT, rng.uniform(0.3, 1.0) if ring % 4 else rng.uniform(0.0, 0.5))
            sett(k, M, r, r1 - GAP, a0 + g, a1 - g, col, kerb)
        r, ring = r1, ring + 1
    k.tint_gradient(0.95, 1.0, TOP - THICK, TOP)
    ob = k.finish(smooth_deg=30)
    K.export([ob], "game/props/plaza-tiles.glb")
    return ob


if __name__ == "__main__":
    ob = build()
    if "review" in ARGS:
        K.review([ob], os.path.join(ARGS[ARGS.index("review") + 1], "plaza.png"), views=((30, 55),), size=480)
