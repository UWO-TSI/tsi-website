"""The sushi bar's food and tableware, modelled for the stool's close view (game/sushi-bar round 3; David: "have everything
be considered for remodeling, especially the food ... because its close up"). Used by build_sushi_bar.py: the nigiri on
the chefs' geta (the hours model), the served geta (sushi-bar-geta.glb), the fish in the case and on the boards, the
guests' places. Game units, built into a propkit Kit `k`; materials from the builder's M (paint: fish and lacquer,
cloth: rice and nori, matte; wood; glass; metal).

Spend the triangles where the eye lands: each nigiri's fish is a draped slice with thickness (its stripes and its
sheen in the faces' colours), the rice a lumpy pillow; the maki show their rice ring and filling; the rest is low.
"""
import math
import numpy as np
from mathutils import Vector

import propkit as K
from build_wharf_kit import mix

RICE, RICE_SHADE = "#fbf7ec", "#e9e2d0"
NORI = "#1e2a22"
# Each fish: its flesh, its darker edge and underside, its stripe (fat lines; None: none) and the stripes' pitch.
FISH = {"tuna": ("#c92a3e", "#8f1a2a", None, 0.0), "salmon": ("#f5844c", "#d8653a", "#fde3d0", 0.03),
        "hamachi": ("#f3d6c4", "#d9a894", "#c95b5e", 0.0), "ebi": ("#fbeee4", "#f0c9b5", "#f2603a", 0.032),
        "tamago": ("#f6cf4a", "#c98a2c", None, 0.0)}


def _rot(yaw):
    return K.game_rot(yaw=yaw)


def _place(c, R, p):
    return tuple(Vector(c) + R @ Vector(p))


def slab(k, M, c, yaw, L, W, th, top_y, kind, arch=0.012, droop=0.016, nu=8, nv=3, lift=None):
    """A draped slice of fish: L along local z, W across x, `th` thick, its underside resting at `top_y` (relative to c)
    and arched over the rice by `arch`, its ends drooping by `droop`. The flesh with a sheen toward the middle, the edges
    and underside darker; laid over its top, salmon's white fat lines on the diagonal, the shrimp's red bands across,
    the yellowtail's dark bloodline along one side."""
    flesh, edge, stripe, pitch = FISH[kind]
    R = _rot(yaw)

    def under(u, v):
        h = top_y + arch * math.sin(math.pi * u) ** 0.7 - droop * (2 * u - 1) ** 4 - 0.006 * (2 * v - 1) ** 2
        return h + (lift(u, v) if lift else 0.0)

    def pt(u, v, top):
        y = under(u, v) + (th * (1 - 0.35 * (2 * v - 1) ** 2) * (1 - 0.3 * (2 * u - 1) ** 6) if top else 0.0)
        return _place(c, R, ((v - 0.5) * W * (1 - 0.12 * (2 * u - 1) ** 2), y, (u - 0.5) * L))

    T = [[k.vert(pt(i / nu, j / nv, True)) for j in range(nv + 1)] for i in range(nu + 1)]
    B = [[k.vert(pt(i / nu, j / nv, False)) for j in range(nv + 1)] for i in range(nu + 1)]
    uv = [(0, 0)] * 4
    for i in range(nu):
        for j in range(nv):
            u, v = (i + 0.5) / nu, (j + 0.5) / nv
            col = mix(flesh, "#ffffff", 0.18 * (1 - abs(2 * v - 1)) * math.sin(math.pi * u))
            k.face([T[i][j], T[i][j + 1], T[i + 1][j + 1], T[i + 1][j]], uv, M, col)
            k.face([B[i][j], B[i + 1][j], B[i + 1][j + 1], B[i][j + 1]], uv, M, edge)
    for i in range(nu):          # the long sides
        for j in (0, nv):
            a, b = (T[i][j], T[i + 1][j]), (B[i][j], B[i + 1][j])
            k.face([a[0], b[0], b[1], a[1]] if j == 0 else [a[0], a[1], b[1], b[0]], uv, M, edge)
    for j in range(nv):          # the ends
        for i in (0, nu):
            a, b = (T[i][j], T[i][j + 1]), (B[i][j], B[i][j + 1])
            k.face([a[0], a[1], b[1], b[0]] if i == 0 else [a[0], b[0], b[1], a[1]], uv, M, edge)
    if not stripe:
        return
    up = Vector(R @ Vector((0, 0.0012, 0)))

    def lay(path, w):
        """A strip a hair over the top along `path` [(u, v)], `w` wide (in u if it runs across, in v if along)."""
        across = abs(path[-1][1] - path[0][1]) > abs(path[-1][0] - path[0][0])
        ps = [(pt(u - w, v, True), pt(u + w, v, True)) if across else (pt(u, v - w, True), pt(u, v + w, True)) for u, v in path]
        for (a0, a1), (b0, b1) in zip(ps, ps[1:]):
            k.face([k.vert(tuple(Vector(q) + up)) for q in (a0, b0, b1, a1)], uv, M, stripe)
    if kind == "hamachi":
        lay([(i / 6, 0.28) for i in range(7)], 0.07)
    else:
        n = int(1 / (pitch / L))
        for m in range(n):
            u0 = (m + 0.5) / n
            lay([(min(0.98, max(0.02, u0 + (0.12 if kind == "salmon" else 0.0) * (v - 0.5))), v) for v in np.linspace(0.02, 0.98, nv + 1)],
                0.022 if kind == "salmon" else 0.05)


def rice(k, M, c, yaw, L=0.1, W=0.066, H=0.046, seed=0):
    """A nigiri's rice: a soft pillow, lumped a little like packed grains, sat flat on its board."""
    k.blob((c[0], c[1] + H * 0.5, c[2]), (W / 2, H / 2, L / 2), M, RICE, segs=8, rings=5, rot=_rot(yaw), seed=seed, lumpy=0.14,
           flat_bottom=-H * 0.42)


def nigiri(k, M, c, yaw, kind, seed=0):
    """A nigiri at c (its foot), its length along local z: rice under a draped slice of `kind`; the shrimp's tail fanned
    over one end; the tamago a thick sweet omelette block tied on with a band of nori. About 300 triangles."""
    Mr, Mf = M["cloth"], M["paint"]
    rice(k, Mr, c, yaw, seed=seed)
    R = _rot(yaw)
    if kind == "tamago":
        slab(k, Mf, c, yaw, 0.11, 0.07, 0.03, 0.04, "tamago", arch=0.004, droop=0.004, nu=4, nv=2)
        for p, size in (((0.0, 0.076, 0.0), (0.08, 0.005, 0.024)), ((-0.039, 0.05, 0.0), (0.005, 0.05, 0.024)), ((0.039, 0.05, 0.0), (0.005, 0.05, 0.024))):
            k.rbox(_place(c, R, p), size, 0.0, M["cloth"], NORI, rot=R, segs=1)
        return
    slab(k, Mf, c, yaw, 0.128, 0.07, 0.013 if kind != "ebi" else 0.011, 0.042, kind)
    if kind == "ebi":           # the tail fan, red over the rice's end
        for s in (-1, 1):
            tip = _place(c, R, (s * 0.03, 0.05, 0.088))
            k.face([k.vert(_place(c, R, (0.0, 0.047, 0.058))), k.vert(_place(c, R, (s * 0.012, 0.052, 0.07))), k.vert(tip),
                    k.vert(_place(c, R, (s * 0.006, 0.046, 0.09)))], [(0, 0)] * 4, Mf, "#e2462a")


def maki(k, M, c, fill):
    """A piece of hosomaki on its end: the nori round it, the rice ring on top and the filling in the middle."""
    r, h = 0.032, 0.04
    k.lathe(c, [(0.0, 0.0), (r, 0.0), (r, h), (r * 0.94, h + 0.002), (0.0, h + 0.002)], M["cloth"], NORI, n=10)
    k.lathe((c[0], c[1] + h + 0.003, c[2]), [(0.0, 0.0), (r * 0.88, 0.0), (r * 0.8, 0.006), (0.0, 0.008)], M["cloth"], RICE, n=10)
    k.lathe((c[0] + 0.002, c[1] + h + 0.01, c[2]), [(0.0, 0.0), (r * 0.36, 0.0), (r * 0.3, 0.004), (0.0, 0.005)], M["paint"], fill, n=7)


def ginger(k, M, c, seed=0):
    """A mound of pickled ginger: thin pink curls heaped in a rosette."""
    rng = np.random.default_rng(seed)
    for i in range(6):
        a = i * math.tau / 5 + rng.uniform(-0.3, 0.3)
        d = 0.0 if i == 5 else 0.016
        p = (c[0] + d * math.cos(a), c[1] + 0.01 + (0.012 if i == 5 else 0.0), c[2] + d * math.sin(a))
        k.blob(p, (0.022, 0.006, 0.014), M["paint"], mix("#f6c9bd", "#eeab9e", rng.uniform(0, 1)),
               segs=7, rings=3, rot=K.game_rot(yaw=a, pitch=0.5, roll=rng.uniform(-0.4, 0.4)), seed=seed + i, lumpy=0.2)


def wasabi(k, M, c):
    """A dab of wasabi: a little green peak, ridged by the spoon."""
    k.blob((c[0], c[1] + 0.012, c[2]), (0.016, 0.014, 0.014), M["paint"], "#9cc45a", segs=7, rings=4, seed=4, lumpy=0.35, flat_bottom=-0.011)


def geta_board(k, W, c, w=0.44, d=0.19):
    """A sushi geta: a pale board with softened edges on two low feet; its top at c.y + 0.05."""
    x, y, z = c
    k.rbox((x, y + 0.04, z), (w, 0.022, d), 0.006, W, "#e4c38d", segs=1, uv_len=0.6, v_axis=0)
    for dx in (-w * 0.36, w * 0.36):
        k.rbox((x + dx, y + 0.015, z), (0.035, 0.03, d - 0.02), 0.004, W, "#bf935e", segs=1)


def served(k, M, c):
    """The served geta (a moriawase): tuna, salmon, shrimp and tamago nigiri in a row, three maki, ginger and wasabi."""
    x, y, z = c
    geta_board(k, M["wood"], c)
    top = y + 0.051
    for i, kind in enumerate(("tuna", "salmon", "ebi", "tamago")):
        nigiri(k, M, (x - 0.165 + i * 0.075, top, z - 0.012), 0.12 * (i % 2 - 0.5), kind, seed=i)
    for i, fill in enumerate(("#c92a3e", "#6fae4a", "#f5844c")):
        maki(k, M, (x + 0.15 - (i % 2) * 0.034, top, z - 0.045 + i * 0.04), fill)
    ginger(k, M, (x + 0.165 - 0.075, top, z + 0.055), seed=7)
    wasabi(k, M, (x + 0.11, top, z + 0.06))


def saku(k, M, c, yaw, L, W, H, kind, cut=0):
    """A block of fish (a saku) as it sits in the case or on the board: a rounded block of flesh, darker on its sides,
    its fat lines across the top; `cut` slices already cut from its near end and laid overlapping beside it."""
    flesh, edge, stripe, pitch = FISH[kind]
    R = _rot(yaw)
    faces = k.rbox(c, (W, H, L), min(W, H) * 0.3, M, flesh, rot=R, segs=1)
    for f in faces:            # the sides darker than the top
        n = f.normal
        if abs(n.z) < 0.6:     # Blender z is game y
            for lp in f.loops:
                lp[k.col] = (*K.lin(edge), 1.0)
    if stripe and pitch:
        for j in range(int(L / pitch / 1.6)):
            zz = -L / 2 + (j + 0.7) * pitch * 1.6
            p = [_place(c, R, (s * W * 0.42, H / 2 + 0.0015, zz + s * W * 0.25)) for s in (-1, 1)]
            k.tube(p, 0.0035, M, stripe, n=3)
    for i in range(cut):
        slab(k, M, _place(c, R, (W * 0.85 + 0.01, -H / 2, -L / 2 + 0.03 + i * 0.03)), yaw + 0.3, 0.1, W * 0.8, 0.012, 0.004 + i * 0.006, kind,
             arch=0.0, droop=0.0, nu=4, nv=2, lift=lambda u, v, i=i: 0.012 * u)


def tai(k, M, c, yaw):
    """A whole sea bream on its side on the ice: rosy back, silver belly, a dark eye, its fins and tail fanned flat."""
    R, Ri = _rot(yaw), _rot(yaw).inverted()
    at = lambda p: _place(c, R, p)
    for f in k.blob(at((0, 0.026, 0)), (0.11, 0.026, 0.05), M["paint"], "#e86a6a", segs=10, rings=6, rot=R):
        for lp in f.loops:      # Blender co is game (x, -z, y): the belly (local -z) silver
            co = lp.vert.co
            if (Ri @ (Vector((co.x, co.z, -co.y)) - Vector(c))).z < -0.012:
                lp[k.col] = (*K.lin("#e9e6e2"), 1.0)
    for pts, col in ((((-0.1, 0.026, 0), (-0.17, 0.028, 0.05), (-0.155, 0.028, 0.0), (-0.17, 0.028, -0.05)), "#d24c50"),
                     (((-0.05, 0.03, 0.045), (0.04, 0.03, 0.048), (0.02, 0.028, 0.072), (-0.06, 0.028, 0.06)), "#c84048")):
        k.face([k.vert(at(p)) for p in pts], [(0, 0)] * 4, M["paint"], col)
    k.blob(at((0.075, 0.05, 0.008)), (0.008, 0.004, 0.008), M["paint"], "#1d1a1a", segs=6, rings=3)


def soy_dish(k, M, c):
    """A little soy dish: white porcelain with a blue rim, the soy a dark pool in it."""
    k.lathe(c, [(0.0, 0.0), (0.03, 0.0), (0.042, 0.006), (0.05, 0.014), (0.046, 0.015), (0.03, 0.007), (0.0, 0.007)], M["glass"], "#f3f1ea", n=9)
    k.lathe((c[0], c[1] + 0.0145, c[2]), [(0.046, 0.0), (0.05, 0.0005)], M["paint"], "#2f4f7a", n=9)
    k.lathe((c[0], c[1] + 0.008, c[2]), [(0.0, 0.0), (0.034, 0.0)], M["paint"], "#3a1c0e", n=8)


def chopsticks(k, M, c, yaw):
    """Chopsticks laid on a little ceramic rest, parallel, their tips toward the counter's middle."""
    R = _rot(yaw)
    k.blob(_place(c, R, (-0.06, 0.006, 0.0)), (0.012, 0.007, 0.022), M["glass"], "#cfd8c8", segs=6, rings=3, rot=R, flat_bottom=-0.005)
    for s in (-1, 1):
        p0, p1 = _place(c, R, (-0.11, 0.003, s * 0.007)), _place(c, R, (0.12, 0.016, s * 0.009))
        k.tube([p0, p1], 0.0045, M["wood"], "#7a4a2a", n=4, radii=[0.55, 1.0], caps=True)


def yunomi(k, M, c, col):
    """A tall tea cup, its glaze in a band, steaming green tea in it."""
    k.lathe(c, [(0.0, 0.0), (0.026, 0.0), (0.03, 0.005), (0.032, 0.07), (0.035, 0.082), (0.03, 0.082), (0.027, 0.012), (0.0, 0.012)], M["glass"], col, n=9)
    k.lathe((c[0], c[1] + 0.03, c[2]), [(0.0326, 0.0), (0.0336, 0.022)], M["paint"], "#f1ece2", n=9)
    k.lathe((c[0], c[1] + 0.068, c[2]), [(0.0, 0.0), (0.029, 0.0)], M["paint"], "#a8b85a", n=8)


def hangiri(k, M, c):
    """A rice tub: a wide shallow tub of pale cypress, copper hoops, heaped with sushi rice."""
    k.lathe(c, [(0.0, 0.0), (0.15, 0.0), (0.16, 0.015), (0.165, 0.07), (0.155, 0.072), (0.15, 0.02), (0.0, 0.02)], M["wood"], "#e6c792", n=14)
    for y in (0.02, 0.055):
        k.lathe((c[0], c[1] + y, c[2]), [(0.166, -0.006), (0.168, 0.0), (0.166, 0.006)], M["metal"], "#c06a3a", n=14)
    k.blob((c[0], c[1] + 0.045, c[2]), (0.14, 0.035, 0.14), M["cloth"], RICE, segs=12, rings=5, seed=3, lumpy=0.15, flat_bottom=-0.02)


def tezu(k, M, c):
    """The chef's hand-water bowl (tezu): a little lacquered bowl of water."""
    k.lathe(c, [(0.0, 0.0), (0.04, 0.0), (0.055, 0.02), (0.06, 0.045), (0.054, 0.045), (0.0, 0.035)], M["paint"], "#7a1e22", n=10)
    k.lathe((c[0], c[1] + 0.036, c[2]), [(0.0, 0.0), (0.053, 0.0)], M["glass"], "#a9d4de", n=10)


def towel(k, M, c, yaw):
    """A folded white cloth (fukin) by the board."""
    k.rbox(c, (0.12, 0.018, 0.08), 0.008, M["cloth"], "#f3f0e6", rot=_rot(yaw), segs=1)
    k.rbox((c[0], c[1] + 0.012, c[2]), (0.1, 0.008, 0.06), 0.004, M["cloth"], "#e8e2d2", rot=_rot(yaw + 0.05), segs=1)


def ice(k, M, x0, x1, z0, z1, y, seed=0):
    """A bed of crushed ice: a lumpy pale field."""
    rng = np.random.default_rng(seed)
    nu, nv = max(4, int((x1 - x0) / 0.07)), 2
    g = [[k.vert((x0 + (x1 - x0) * i / nu, y + (0.006 * rng.uniform(-1, 1) if 0 < i < nu and 0 < j < nv else -0.004), z0 + (z1 - z0) * j / nv))
          for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            k.face([g[i][j], g[i][j + 1], g[i + 1][j + 1], g[i + 1][j]], [(0, 0)] * 4, M["glass"], mix("#eef6f8", "#cfe6ee", rng.uniform(0, 1)))


def shiso(k, M, c, yaw):
    """A shiso leaf: a green serrated leaf laid flat, a pale vein."""
    R = _rot(yaw)
    pts = [(0.0, 0.0), (0.02, 0.012), (0.03, 0.03), (0.026, 0.05), (0.0, 0.07), (-0.026, 0.05), (-0.03, 0.03), (-0.02, 0.012)]
    vs = [k.vert(_place(c, R, (px, 0.002 + 0.004 * math.sin(pz * 40), pz))) for px, pz in pts]
    k.face(vs, [(0, 0)] * len(vs), M["paint"], "#4f8f3a")
    k.tube([_place(c, R, (0.0, 0.004, 0.0)), _place(c, R, (0.0, 0.006, 0.062))], 0.0015, M["paint"], "#9ccc7a", n=3)


def lemon(k, M, c, yaw):
    """A lemon wheel stood on its edge."""
    k.lathe(c, [(0.0, -0.003), (0.024, -0.003), (0.026, 0.0), (0.024, 0.003), (0.0, 0.003)], M["paint"], "#f5dc5a", d=tuple(_rot(yaw) @ Vector((0, 0, 1))), n=8)
