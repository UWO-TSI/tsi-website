"""The small rowboats moored along the village wharf's finger pier (components/game/wharf/Wharf.tsx Dressing; v1 water item
7, references/look/2026-10-13/wharf-creatures-of-the-deep-ref.png): a clinker-built rowboat to match the pier. Rebuilds
web/public/assets/game/wharf/rowboat.glb (it was art/wharf/build_wharf.py's plain white hull).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_rowboat.py [-- review <dir>]

It keeps every point the engine ties to (lib/game/wharf.ts ROWBOAT, floatRowboat): 1.55 long, 0.62 in the beam, 0.26
deep amidships with the bow rising to 0.32; the bow along +z, the keel at y 0; it floats 0.09 deep (`draft`: the dark
bottom paint stops at that waterline) and its painter is made fast to the iron ring at (0, 0.24, 0.7) on the breasthook.

Clinker planking: four overlapping strakes a side, each plank's lower edge proud of the one below (the lands read as
lines down the hull), a rust sheer strake over cream, dark antifouling under the water; a cream-painted gunwale (the
reference's white rim from above), a varnished rubbing strake, a stem post and keel strip, a transom, bare wood inside with floorboards and two thwarts, iron oarlocks, and a
pair of oars shipped along the thwarts. Three materials: M_BoatPaint, M_BoatWood (grain), M_Iron.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
L, B, D = 1.55, 0.62, 0.26
DRAFT = 0.09
BOW_RING = (0.0, 0.24, 0.7)
STRAKES, LAP, THICK = 4, 0.012, 0.022
CREAM, RUST, BOTTOM, WOOD, VARNISH, IRON = "#efe7d6", "#b4583a", "#6a3a2c", "#c9a273", "#b07d4e", "#3b3a37"
STATIONS = 11


def smooth01(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def half_width(t):
    return max(0.012, B / 2 * (1 - (max(0.0, t - 0.5) / 0.5) ** 1.9) * (0.84 + 0.16 * math.sin(math.pi * min(1.0, t * 1.7))))


def sheer(t):
    return D + 0.058 * smooth01((t - 0.55) / 0.45) ** 1.4 + 0.022 * (1 - t) ** 3


def keel(t):
    return 0.05 * max(0.0, (t - 0.78) / 0.22) ** 1.5 + 0.015 * max(0.0, (0.1 - t) / 0.1)


def section(t, s):
    """The base hull surface at station t (0 stern, 1 bow), s from 0 (gunwale) to 1 (keel), port side (x > 0)."""
    w, sh, kl = half_width(t), sheer(t), keel(t)
    a = s * math.pi / 2
    return Vector((w * math.cos(a) ** 0.62, kl + (sh - kl) * (1 - math.sin(a) ** 1.5)))


def normal2(t, s):
    e = 1e-3
    p0, p1 = section(t, max(0.0, s - e)), section(t, min(1.0, s + e))
    d = (p1 - p0).normalized()
    n = Vector((d.y, -d.x))                     # outward for the port side going down
    return n if n.x >= -1e-6 or s > 0.99 else -n


def outer_profile(t):
    """Port side, gunwale to keel: each strake from its top (tucked under the one above) to its lower edge (proud by
    LAP), then the step in to the next. Returns [(point2, s, strake)]."""
    out = []
    for k in range(STRAKES):
        s0, s1 = k / STRAKES, (k + 1) / STRAKES
        for j, s in enumerate(np.linspace(s0, s1, 2 if k < STRAKES - 1 else 3)):
            off = LAP * j / (1 if k < STRAKES - 1 else 2)
            out.append((section(t, s) + normal2(t, s) * off, s, k))
    return out


def build():
    K.reset()
    paint_tex = K.painted_planks(256, 256, 131, boards=1, wear=0.18)
    M = {
        "paint": K.Mat("M_BoatPaint", tex=K.image("boat_paint", paint_tex), rough=0.88),
        "wood": K.Mat("M_BoatWood", tex=K.image("boat_wood", K.grain(256, 128, 132, "#ffffff", knots=0)), rough=0.95),
        "iron": K.Mat("M_Iron", IRON, rough=0.75),
    }
    k = K.Kit("rowboat")
    ts = np.linspace(0, 1, STATIONS)
    zs = [-L / 2 + L * t for t in ts]
    # ---- the outer hull: port profile, then starboard mirrored (the keel point shared)
    rings, uvs, cols, steps = [], [], [], []
    for t, z in zip(ts, zs):
        port = outer_profile(t)
        star = [(Vector((-p.x, p.y)), s, kk) for p, s, kk in reversed(port)][1:]
        pts = port + star
        rings.append([(p.x, p.y, z) for p, _, _ in pts])
        uvs.append([((s if i < len(port) else 2 - s) * 0.48, z / 0.9) for i, (_, s, _) in enumerate(pts)] + [(0.96, z / 0.9)])
        cols.append([kk for _, _, kk in pts])
        steps.append([s for _, s, _ in pts])
    vs = [[k.vert(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n - 1):
            kk = cols[i][j] if j < n // 2 else cols[i][j + 1]
            ys = [rings[i][j][1], rings[i][j + 1][1], rings[i + 1][j + 1][1], rings[i + 1][j][1]]
            col = RUST if kk == 0 else CREAM
            if abs(steps[i][j] - steps[i][j + 1]) < 1e-9:      # a land: the lower edge of a plank over the next
                col = "#8a5a44" if kk == 0 else "#a89c88"
            f = k.face([vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j]], [uvs[i][j], uvs[i][j + 1], uvs[i + 1][j + 1], uvs[i + 1][j]], M["paint"], col)
            for lp, y in zip(f.loops, ys):              # antifouling under the waterline
                if y < DRAFT + 0.004:
                    lp[k.col] = (*K.lin(BOTTOM), 1.0)
    # ---- the inside: bare wood, a plank's thickness in, from just inside the transom to the stem
    inner_rings, inner_uvs = [], []
    t_in = [t for t in ts if t <= 0.94]
    for t in t_in:
        z = -L / 2 + L * t + (0.025 if t == 0 else 0.0)
        port = []
        for s in np.linspace(0, 1, 7):
            p = section(t, s) - normal2(t, s) * THICK
            port.append(Vector((max(0.0, p.x), max(p.y, keel(t) + THICK))))
        pts = port + [Vector((-p.x, p.y)) for p in reversed(port)][1:]
        inner_rings.append([(p.x, p.y, z) for p in pts])
        inner_uvs.append([(i / (len(pts) - 1) * 0.9, z / 0.8) for i in range(len(pts))] + [(1.0, z / 0.8)])
    ivs = [[k.vert(p) for p in ring] for ring in inner_rings]
    m = len(inner_rings[0])
    for i in range(len(ivs) - 1):
        for j in range(m - 1):
            k.face([ivs[i + 1][j], ivs[i + 1][j + 1], ivs[i][j + 1], ivs[i][j]], [inner_uvs[i + 1][j], inner_uvs[i + 1][j + 1], inner_uvs[i][j + 1], inner_uvs[i][j]], M["wood"], WOOD)
    # The inside's bow end: a little bulkhead under the breasthook.
    last = inner_rings[-1]
    cen = (0.0, sum(p[1] for p in last) / len(last), last[0][2])
    for j in range(m - 1):
        k.quad([cen, last[j], last[j + 1]], M["wood"], WOOD, uvs=((0.5, 0.5), (0.2, 0.2), (0.3, 0.2)))
    # ---- the gunwale: a varnished capping from the outer sheer to the inner, and a rubbing strake outside
    for side in (1, -1):
        top_out = [(side * rings[i][0][0] if side > 0 else rings[i][-1][0], rings[i][0][1], zs[i]) for i in range(len(zs))]
        top_in = [(side * inner_rings[i][0][0] if side > 0 else inner_rings[i][-1][0], inner_rings[i][0][1], inner_rings[i][0][2]) for i in range(len(inner_rings))]
        for i in range(len(top_in) - 1):
            a, b = top_out[i], top_out[i + 1]
            c, d = top_in[i + 1], top_in[i]
            lift = 0.012
            k.quad([(a[0], a[1] + lift, a[2]), (b[0], b[1] + lift, b[2]), (c[0], c[1] + lift, c[2]), (d[0], d[1] + lift, d[2])], M["paint"], CREAM,
                   uvs=((0.1, a[2]), (0.1, b[2]), (0.2, c[2]), (0.2, d[2])))
            for p, q in ((a, b), (d, c)):
                k.quad([p, q, (q[0], q[1] + lift, q[2]), (p[0], p[1] + lift, p[2])], M["paint"], CREAM, uvs=((0.3, p[2]), (0.3, q[2]), (0.33, q[2]), (0.33, p[2])))
        rub = [(side * (half_width(t) + 0.012), sheer(t) - 0.03, -L / 2 + L * t) for t in np.linspace(0.0, 0.97, 9)]
        k.tube(rub, 0.017, M["wood"], VARNISH, n=6, v_len=0.9, caps=True, u_tiles=0.3)
    # ---- transom: the stern board, outside and in, its top capped
    port0 = outer_profile(0.0)
    tpts = [(p.x, p.y) for p, _, _ in port0] + [(-p.x, p.y) for p, _, _ in reversed(port0)][1:]
    z0 = -L / 2
    cy = (sheer(0) + keel(0)) / 2
    tv = [k.vert((x, y, z0)) for x, y in tpts]
    tc = k.vert((0.0, cy, z0))
    for j in range(len(tv) - 1):
        f = k.face([tc, tv[j + 1], tv[j]], [(0.48, cy), (0.48 + tpts[j + 1][0], tpts[j + 1][1] * 2), (0.48 + tpts[j][0], tpts[j][1] * 2)], M["paint"], CREAM)
        for lp in f.loops:
            if lp.vert.co.z < DRAFT + 0.004:
                lp[k.col] = (*K.lin(BOTTOM), 1.0)
    k.quad([(tpts[-1][0], tpts[-1][1], z0), (tpts[0][0], tpts[0][1], z0), inner_rings[0][0], inner_rings[0][-1]], M["paint"], RUST)
    k.beam((-half_width(0) + 0.01, sheer(0) - 0.01, z0 - 0.004), (half_width(0) - 0.01, sheer(0) - 0.01, z0 - 0.004), 0.024, 0.03, 0.008, M["wood"], VARNISH)
    # ---- stem post, keel strip, breasthook and its ring
    k.beam((0, keel(1.0) - 0.006, L / 2 - 0.02), (0, sheer(1.0) + 0.02, L / 2 + 0.012), 0.034, 0.03, 0.01, M["wood"], VARNISH, up=(0, 0, 1))
    k.tube([(0, keel(t) - 0.008, -L / 2 + L * t) for t in np.linspace(0.02, 0.97, 8)], 0.016, M["wood"], VARNISH, n=6, v_len=0.9, caps=True, u_tiles=0.3)
    hook_z0 = 0.56
    # The breasthook: a knee of wood across the bow between the gunwales, its sides following the hull in.
    hz = np.linspace(hook_z0, L / 2 - 0.035, 6)
    half = [max(0.01, 0.93 * half_width((z + L / 2) / L) - THICK - 0.008) for z in hz]
    ol = [(h_, -z) for h_, z in zip(half, hz)] + [(-h_, -z) for h_, z in reversed(list(zip(half, hz)))]
    ol = ol[::-1] if sum(ol[i][0] * ol[(i + 1) % len(ol)][1] - ol[(i + 1) % len(ol)][0] * ol[i][1] for i in range(len(ol))) < 0 else ol
    k.extrude(ol, 0.217, 0.235, M["wood"], VARNISH, bevel=0.004, rot=K.game_rot(pitch=-math.pi / 2), uv_len=0.6)
    k.tube([(BOW_RING[0], BOW_RING[1] + 0.024 + 0.022 * math.cos(a), BOW_RING[2] + 0.022 * math.sin(a)) for a in np.linspace(0, math.tau, 13)[:-1]],
           0.0055, M["iron"], IRON, n=6, closed_path=True)
    k.lathe((0, 0.235, BOW_RING[2]), [(0.0, 0.0), (0.014, 0.0), (0.012, 0.008), (0.0, 0.01)], M["iron"], IRON, n=8)
    # ---- inside: floorboards and two thwarts
    for x in (-0.09, 0.0, 0.09):
        k.rbox((x, keel(0.45) + THICK + 0.012, -0.12), (0.075, 0.016, 0.95), 0.005, M["wood"], WOOD)
    for z in (-0.2, 0.28):
        t = (z + L / 2) / L
        y = D * 0.62
        s_at = 0.38
        w = section(t, s_at).x - THICK - 0.004
        k.rbox((0, y, z), (2 * w, 0.026, 0.13), 0.008, M["wood"], VARNISH)
    # ---- oarlocks on the gunwale amidships, and the pair of oars shipped along the thwarts
    for side in (1, -1):
        t = (0.04 + L / 2) / L
        x, y = side * (half_width(t) - 0.005), sheer(t) + 0.012
        k.lathe((x, y, 0.04), [(0.0, 0.0), (0.016, 0.0), (0.016, 0.012), (0.0, 0.014)], M["iron"], IRON, n=8)
        k.tube([(x, y + 0.008, 0.02), (x, y + 0.03, 0.02), (x, y + 0.038, 0.04), (x, y + 0.03, 0.06), (x, y + 0.008, 0.06)], 0.0065, M["iron"], IRON, n=6)
    for side in (1, -1):
        x, y = side * 0.05, D * 0.62 + 0.03
        k.tube([(x, y, -0.56), (x, y + 0.004, 0.25)], 0.0135, M["wood"], WOOD, n=6, v_len=0.9, caps=True, u_tiles=0.3)
        k.tube([(x, y, -0.6), (x, y, -0.52)], 0.019, M["wood"], VARNISH, n=6, v_len=0.9, caps=True, u_tiles=0.3)
        k.rbox((x, y + 0.004, 0.4), (0.08, 0.012, 0.3), 0.005, M["wood"], WOOD, uv_off=(0.3, 0.1))
    k.tint_gradient(0.86, 1.0, 0.0, D + 0.06)
    ob = k.finish(smooth_deg=50)
    K.export([ob], "game/wharf/rowboat.glb")
    print("ROWBOAT", {"length": L, "beam": B, "depth": D, "draft": DRAFT, "bowRing": BOW_RING})
    return [ob]


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "rowboat.png"))
