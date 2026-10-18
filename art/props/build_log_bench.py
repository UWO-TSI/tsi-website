"""The log bench (the map's `bench` objects, model "bench-wood"; the outdoor study tables' benches, study/StudySeats.tsx;
the homes' "Log bench"): our own split log on two stumps. Replaces acnh/props/bench-wood.glb in the member world (the
applicant island keeps its own).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_log_bench.py [-- review <dir>]

Writes web/public/assets/game/props/log-bench.glb. Frame: game units at scale 1, the origin on the ground under the
seat's middle, the log along x. It keeps the old bench's numbers the game ties to: the seat top at 0.51 (PROP_TOP, the
study seats' BENCH), inside the solid footprint's half extents 0.98 x 0.27 (PROP_FOOTPRINT).

A log split down its length lying flat side up, a little out of true and narrowing toward one end: bark round its
underside, the split face pale with the grain running along it and a few dried checks, the worn edges rounded, the
cut ends showing their rings inside a rim of bark; it sits on two short stumps. One material, M_BenchLog, an atlas
(bark, end grain, the split face) times COLOR_0.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402
from propkit import TAU, smooth, noise, fbm  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TOP = 0.51                    # the seat (PROP_TOP "bench-wood")
L = 1.9                       # length
R = 0.235                     # the log's radius across (z), inside the 0.27 footprint
DEPTH = 0.225                 # how far the round falls below the split
BEVEL = 0.022                 # the worn edge between split and bark
LEGS = (-0.6, 0.62)
rng = np.random.default_rng(1016)


def split_face(h, w, seed):
    """The split face: pale wood, the grain running down the image (along the log), dried checks along it."""
    g = K.grain(h, w, seed, "#ffffff", lines=(7, 17, 41), contrast=0.2, knots=2, wander=0.02)
    U, V = K.grid(h, w)
    val = g[..., 0]
    r = np.random.default_rng(seed + 1)
    for _ in range(5):
        u0, v0, v1 = r.uniform(0.15, 0.85), r.uniform(0.0, 0.6), 0
        v1 = v0 + r.uniform(0.15, 0.4)
        wob = 0.006 * np.sin(TAU * V * r.uniform(2, 5) + r.random() * 6)
        d = np.abs(U - u0 - wob)
        inside = smooth(v0, v0 + 0.04, V) * smooth(v1, v1 - 0.04, V)
        val = val - 0.35 * smooth(0.006, 0.0, d) * inside
    return np.clip(val[..., None] * np.ones(3), 0, 1)


def cut_end(h, w, seed):
    """A cut end: honey heartwood rings round the middle, a paler band of sapwood, a rough rim of bark, a few checks."""
    U, V = K.grid(h, w)
    d = np.hypot(U - 0.5, V - 0.5) * 2 * (1 + 0.035 * (fbm(h, w, 6, seed + 1) - 0.5))
    rings = K.end_grain(h, w, seed, "#ffffff", rings=9)[..., 0]
    heart = rings[..., None] * K.arr("#d1a673")
    sap = rings[..., None] * K.arr("#e6cfa4")
    out = heart * (1 - smooth(0.62, 0.72, d)[..., None]) + sap * smooth(0.62, 0.72, d)[..., None]
    edge = 0.86 + 0.04 * (noise(h, w, 24, seed + 2) - 0.5)
    bark = K.bark(h, w, seed + 3, "#7a5a40")
    b = smooth(edge - 0.015, edge + 0.015, d)[..., None]
    return np.clip(out * (1 - b) + bark * b, 0, 1)


def atlas():
    """512 square: u 0..0.5 bark (tiles down v); u 0.5..1 the end grain above (v 0.5..1), the split face below."""
    out = np.zeros((512, 512, 3))
    out[:, :256] = K.bark(512, 256, 31, "#ffffff")
    out[:256, 256:] = cut_end(256, 256, 32)
    out[256:, 256:] = split_face(256, 256, 33)
    return out


def section(scale, k):
    """The log's cross-section at a ring (z, y), from the split's right edge round under the bark to its left edge:
    [split edge right, bevel, bark arc ..., bevel, split edge left]; the bark arc's points are flagged."""
    rr, dd = R * scale, DEPTH * scale
    yc = TOP - BEVEL
    pts = [((rr - BEVEL), TOP)]
    n = 10
    for i in range(n + 1):
        a = math.pi * i / n
        wob = 1 + 0.035 * math.sin(3 * a + k * 1.3) + 0.02 * math.sin(7 * a + k)
        pts.append((rr * math.cos(a) * wob, yc - dd * math.sin(a) * wob))
    pts.append((-(rr - BEVEL), TOP))
    return pts


def build():
    K.reset()
    M = K.Mat("M_BenchLog", tex=K.image("bench_log", atlas()), rough=0.95)
    k = K.Kit("log-bench")
    xs = np.linspace(-L / 2, L / 2, 8)
    taper = lambda x: 1.0 - 0.06 * (x + L / 2) / L                 # narrower toward +x
    sections = [section(taper(x), i) for i, x in enumerate(xs)]
    BARK, SPLIT, END = "#86664b", "#c9a276", "#ffffff"
    # Bark: round the underside, u across it in 0..0.5, v along the log.
    rings = [[(x, y, z) for z, y in sec[1:-1]] for x, sec in zip(xs, sections)]
    nb = len(rings[0])
    uvs = [[(0.02 + 0.46 * j / (nb - 1), x / 0.9) for j in range(nb)] for x in xs]
    k.ring_grid(rings, uvs, M, BARK, closed=False)
    # The split face and its worn edges: right bevel, top, left bevel; u across in 0.52..0.98, v along in 0.02..0.48.
    tops = [[(x, sec[1][1], sec[1][0]), (x, sec[0][1], sec[0][0]), (x, sec[-1][1], sec[-1][0]), (x, sec[-2][1], sec[-2][0])] for x, sec in zip(xs, sections)]
    zmax = R + 0.01
    uvs = [[(0.75 + 0.23 * p[2] / zmax, 0.02 + 0.46 * (x + L / 2) / L) for p in ring] for x, ring in zip(xs, tops)]
    k.ring_grid(tops, uvs, M, SPLIT, closed=False)
    # The cut ends: rings round the split's middle (the log's heart), the bark rim at the edge of the disc.
    for x, sec, flip in ((xs[0], sections[0], True), (xs[-1], sections[-1], False)):
        yc = TOP - BEVEL
        rim = [(x, y, z) for z, y in sec]
        scale = taper(x)
        cuv = [(0.75 + 0.235 * z / (R * scale), 0.75 + 0.235 * (y - TOP) / (R * scale)) for z, y in sec]
        cen = k.vert((x, yc - DEPTH * 0.35, 0.0))
        vs = [k.vert(p) for p in rim]
        c_uv = (0.75, 0.75 + 0.235 * (yc - DEPTH * 0.35 - TOP) / (R * scale))
        for j in range(len(vs)):
            j2 = (j + 1) % len(vs)
            tri, tuv = [cen, vs[j], vs[j2]], [c_uv, cuv[j], cuv[j2]]
            if flip:
                tri, tuv = [cen, vs[j2], vs[j]], [c_uv, cuv[j2], cuv[j]]
            k.face(tri, tuv, M, END)
    # Two stumps under it, bark round them.
    for i, x in enumerate(LEGS):
        r = 0.12 + 0.008 * i
        prof = [(0.0, 0.0), (r * 1.08, 0.0), (r * 1.05, 0.05), (r, 0.16), (r * 0.98, 0.31), (0.0, 0.31)]
        k.lathe((x, 0, 0.0), prof, M, BARK, n=10, phase=0.3 * i, u_tiles=0.48, v_len=0.9,
                wobble=lambda kk, j, i=i: 1 + 0.05 * math.sin(kk * 2.1 + i * 3))
    # A darker band of earth-stain where the stumps meet the ground, the seat's middle a touch polished.
    for f in k.bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            gy = co.z
            c = lp[k.col]
            s = 0.82 + 0.18 * min(1.0, gy / 0.12)
            lp[k.col] = (c[0] * s, c[1] * s, c[2] * s, 1.0)
    k.tint_gradient(0.86, 1.0)
    ob = k.finish(smooth_deg=55)
    path = K.export([ob], "game/props/log-bench.glb")
    print("LOG_BENCH", {"top": TOP, "half": [L / 2, R]})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "log-bench.png"), views=((0, 14), (35, 28), (110, 20)))
