"""The island's flying critters as ours, the cheap world versions (game/remodel; David, 2026-10-27, round 2: "i think they
should be small less triangles in game cuz theyre small but the close up model of the butter flies need to be the
before"; round 3: "shape should still replicate the before like general overall shape of wings"): the six butterflies
and two dragonflies that fly in the ambient life (lib/game/ambientFauna.ts) and the catchable ones in the grass
(components/game/peaceful/VillageLife.tsx), in the new world only. Every close-up (the trophy case, the item icons)
keeps the dump's (acnh/critters/).

Each wing outline is traced from the old model: its wing triangles seen flat (unfolded about the body's axis), drawn
into a mask, the antennae and legs opened away, the outline followed round and simplified to a few points, and the
polygon cut into triangles (N points, N - 2 triangles). So the forewing and hindwing lobes, the proportions and the tails
stay the old one's; only the triangles go. The wings keep the old one's lift. A soft round body, our paint per species.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_critters.py

Frame (the dump's, so the game's scales and its wing shader hold): the body along z with the head toward +z, where
the game flies them (the dump's butterflies face -z, so their traced wings are turned end for end), the wings out along +-x (AmbientFauna beats every vertex past the hinge, |x| over 7 to 24 % of the span, up about
z), the origin at the body's middle. Authored in game units at the size the ambient life draws each species, written at
1 / that scale (rkit.export_in_frame) under game/remodel/critters/<name>.glb (the dump's file name, so
lib/game/world/active.ts worldModel swaps the folder).
Materials: P_Paint (the body, its colour in COLOR_0) and M_Wings (one 256 x 128 painted atlas shared by every species,
a 64 px tile each, mapped flat over the wing from above), double-sided.
"""
import math, os, sys
import numpy as np
import bpy
from mathutils import Vector, geometry

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K, PS, export_in_frame  # noqa: E402
import dumpkit as D  # noqa: E402  (rkit put art/props on the path)

TAU, D2R = math.tau, math.pi / 180
TILE, COLS = 64, 4
# The paint's polar frame (the paint functions below): phi from the tail side (PHI0) to the head side (PHI1) round the
# wing root, the forewing and hindwing parting at SPLIT; rho out from the root to the outline (1).
PHI0, PHI1, SPLIT = -78.0, 82.0, 8.0
RES = 160          # the trace's mask, pixels across the wing's longer side
OPEN = 2           # opening radius (pixels): the antennae and legs go, the wing stays


# ---------------------------------------------------------------- tracing the old wings
def old_triangles(name, drawn, wing_mesh_tris=None):
    """The old model's triangles in game axes at its drawn size, and which belong to the wings (the dragonflies keep
    theirs in a mesh of their own: the one with `wing_mesh_tris` triangles)."""
    obs = D.load(f"critters/{name}.glb")
    tris, wing = [], []
    for o in obs:
        me = o.data
        own = wing_mesh_tris is None or sum(len(p.vertices) - 2 for p in me.polygons) == wing_mesh_tris
        for p in me.polygons:
            vs = [me.vertices[i].co for i in p.vertices]
            for j in range(1, len(vs) - 1):
                tris.append([(v.x * drawn, v.z * drawn, -v.y * drawn) for v in (vs[0], vs[j], vs[j + 1])])
                wing.append(own)
    return np.array(tris), np.array(wing)


def fill(mask, a, b, c):
    """Raster the triangle (a, b, c), pixel coords, into mask."""
    lo = np.floor(np.minimum(np.minimum(a, b), c)).astype(int).clip(0)
    hi = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
    hi = np.minimum(hi, np.array(mask.shape[::-1]) - 1)
    if (hi < lo).any():
        return
    X, Y = np.meshgrid(np.arange(lo[0], hi[0] + 1) + 0.5, np.arange(lo[1], hi[1] + 1) + 0.5)
    def side(p, q):
        return (q[0] - p[0]) * (Y - p[1]) - (q[1] - p[1]) * (X - p[0])
    s1, s2, s3 = side(a, b), side(b, c), side(c, a)
    inside = ((s1 >= 0) & (s2 >= 0) & (s3 >= 0)) | ((s1 <= 0) & (s2 <= 0) & (s3 <= 0))
    mask[lo[1]:hi[1] + 1, lo[0]:hi[0] + 1] |= inside


def morph(mask, r, grow):
    """Dilate (grow) or erode a mask by a square of radius r."""
    out = mask.copy()
    pad = np.pad(mask, r, constant_values=False)
    h, w = mask.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            sh = pad[r + dy:r + dy + h, r + dx:r + dx + w]
            out = (out | sh) if grow else (out & sh)
    return out


def components(mask):
    """The mask's 8-connected parts, largest first."""
    lab = np.zeros(mask.shape, int)
    parts = []
    for y, x in zip(*np.nonzero(mask)):
        if lab[y, x]:
            continue
        n = len(parts) + 1
        stack, px = [(y, x)], []
        lab[y, x] = n
        while stack:
            cy, cx = stack.pop()
            px.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        stack.append((ny, nx))
        parts.append(lab == n)
    return sorted(parts, key=lambda m: -m.sum())


DIRS = [(0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1)]   # (row, col), clockwise from east


def outline(mask):
    """The outer boundary of one part (Moore neighbour tracing), pixel centres in order."""
    m = np.pad(mask, 1)
    ys, xs = np.nonzero(m)
    i = np.lexsort((xs, ys))[0]
    start = p = (ys[i], xs[i])
    back = 4                                    # west of the first pixel is outside
    pts = [p]
    for _ in range(4 * m.size):
        for k in range(1, 9):
            d = (back + k) % 8
            q = (p[0] + DIRS[d][0], p[1] + DIRS[d][1])
            if m[q]:
                b = (back + k - 1) % 8
                pb = (p[0] + DIRS[b][0], p[1] + DIRS[b][1])
                back = DIRS.index((pb[0] - q[0], pb[1] - q[1]))
                p = q
                break
        else:
            break
        if p == start:
            break
        pts.append(p)
    return np.array([(x - 1 + 0.5, y - 1 + 0.5) for y, x in pts])


def simplify(pts, eps):
    """Douglas-Peucker on a closed polygon: split at the two points farthest apart, simplify each run."""
    def run(a):
        if len(a) < 3:
            return list(a)
        d = np.abs(np.cross(a[-1] - a[0], a[1:-1] - a[0])) / max(np.linalg.norm(a[-1] - a[0]), 1e-9)
        i = int(np.argmax(d)) + 1
        if d[i - 1] <= eps:
            return [a[0], a[-1]]
        return run(a[:i + 1])[:-1] + run(a[i:])
    j = int(np.argmax(np.linalg.norm(pts - pts[0], axis=1)))
    loop = np.vstack([pts, pts[:1]])
    return np.array(run(loop[:j + 1])[:-1] + run(loop[j:])[:-1])


def trace(name, drawn, kind, budget):
    """The old wing on the +x side, flat: polygons (game units: x out from the body's axis, z along it), the wing's
    lift (radians, the old V), the body's axis height, and the mask (for the paint)."""
    tris, wing = old_triangles(name, drawn, 8 if kind == "dragonfly" else None)
    if kind == "butterfly":
        tris[..., 2] *= -1      # the dump's butterflies face -z (they flew tail first); ours face +z, where the game flies
    span = np.abs(tris[..., 0]).max()
    cut = 0.06 * span
    core = tris[np.abs(tris[..., 0]).max(axis=1) < cut]
    yb = float(np.median(core[..., 1])) if len(core) else 0.0
    side = tris[wing & (tris[..., 0].mean(axis=1) > (0 if kind == "dragonfly" else cut))]
    # Unfolded: how far out from the body's axis, so a raised wing lies flat at its true size.
    u = np.hypot(side[..., 0], side[..., 1] - yb)
    pts = side.reshape(-1, 3)
    far = pts[np.hypot(pts[:, 0], pts[:, 1] - yb) > 0.4 * span]
    lift = float(np.median(np.arctan2(far[:, 1] - yb, far[:, 0])))
    z = side[..., 2]
    x0, x1, z0, z1 = cut, u.max(), z.min(), z.max()
    px = max(x1 - x0, z1 - z0) / RES
    W, H = int(math.ceil((x1 - x0) / px)) + 2 * OPEN + 2, int(math.ceil((z1 - z0) / px)) + 2 * OPEN + 2
    to_px = lambda x, zz: np.stack([(x - x0) / px + OPEN + 1, (zz - z0) / px + OPEN + 1], -1)
    mask = np.zeros((H, W), bool)
    for t_u, t_z in zip(u, z):
        a, b, c = to_px(t_u, t_z)
        fill(mask, a, b, c)
    mask[:, :OPEN + 1] = False                       # inside the cut: the body's
    mask = morph(morph(mask, OPEN, False), OPEN, True)
    parts = [m for m in components(mask) if m.sum() > 0.03 * mask.sum()]
    loops = [outline(m) for m in parts]
    per = [budget * len(l) / sum(len(m) for m in loops) for l in loops]
    polys = []
    for l, n in zip(loops, per):
        eps = 0.4
        while True:
            s = simplify(l, eps)
            ok = len(s) <= max(4, int(n))
            if ok:
                tri = geometry.tessellate_polygon([[Vector((x, y, 0)) for x, y in s]])
                if len(tri) == len(s) - 2:
                    break
            eps *= 1.15
        polys.append((s, tri))
    back = lambda q: (x0 + (q[0] - OPEN - 1) * px, z0 + (q[1] - OPEN - 1) * px)
    world = [([back(q) for q in s], tri) for s, tri in polys]
    frame = {"x0": x0, "x1": x1, "z0": z0, "z1": z1, "px": px, "pad": OPEN + 1}
    print("TRACE", name, "span", round(span, 4), "lift", round(math.degrees(lift), 1), "parts", len(polys),
          "points", [len(s) for s, _ in polys], "old tris", len(tris))
    zc = float(np.median(core[..., 2])) if len(core) else 0.0
    return {"polys": world, "lift": lift, "yb": yb, "body": (yb, zc), "mask": mask, "frame": frame, "span": span}


# ---------------------------------------------------------------- paint (the species' marks, in the polar frame)
def hexa(h):
    return np.array(K.hexrgb(h))


def mix(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]


def spot(phi, rho, p0, r0, size):
    d = np.hypot((phi - p0) / 60.0, rho - r0)
    return 1 - K.smooth(size * 0.7, size, d)


def veins(phi, rho, n, width=0.06, start=0.3):
    s = np.abs(np.sin((phi - PHI0) / (PHI1 - PHI0) * math.pi * n))
    return (1 - K.smooth(width * 0.5, width, s)) * K.smooth(start, start + 0.1, rho)


def split_line(phi, width=2.5):
    return 1 - K.smooth(width * 0.5, width, np.abs(phi - SPLIT))


def common(phi, rho):
    c = mix(np.broadcast_to(hexa("#f6f1dc"), phi.shape + (3,)), hexa("#e8e2c4"), K.smooth(0.0, 0.4, 1 - rho))
    tip = K.smooth(0.62, 0.7, rho) * K.smooth(50, 60, phi)
    c = mix(c, hexa("#45434a"), tip)
    c = mix(c, hexa("#45434a"), spot(phi, rho, 32, 0.55, 0.09) + spot(phi, rho, -20, 0.5, 0.07) * 0.8)
    return mix(c, hexa("#cfc7a6"), split_line(phi) * 0.7)


def tiger(phi, rho):
    c = np.broadcast_to(hexa("#f4d86a"), phi.shape + (3,)).copy()
    bands = (np.abs(np.sin((phi - 10) * D2R * 5.2)) < 0.26) * K.smooth(0.15, 0.3, rho) * (phi > SPLIT)
    c = mix(c, hexa("#2b2a2e"), bands.astype(float))
    c = mix(c, hexa("#2b2a2e"), K.smooth(0.0, 0.22, 0.22 - rho))
    edge = K.smooth(0.74, 0.8, rho)
    c = mix(c, hexa("#2b2a2e"), edge)
    dots = (np.abs(np.sin((phi - PHI0) * D2R * 7)) > 0.7) * K.smooth(0.84, 0.87, rho) * (1 - K.smooth(0.93, 0.96, rho))
    c = mix(c, hexa("#f4d86a"), dots.astype(float) * 0.9)
    c = mix(c, hexa("#4f8fd8"), spot(phi, rho, -38, 0.7, 0.07) + spot(phi, rho, -20, 0.72, 0.06))
    c = mix(c, hexa("#e2713f"), spot(phi, rho, -62, 0.72, 0.08))
    return mix(c, hexa("#2b2a2e"), split_line(phi) * 0.8)


def peacock(phi, rho):
    c = np.broadcast_to(hexa("#26282d"), phi.shape + (3,)).copy()
    sheen = K.smooth(0.25, 0.55, rho) * (1 - K.smooth(0.72, 0.82, rho))
    c = mix(c, hexa("#2f9a86"), sheen * np.where(phi < SPLIT, 1.0, 0.45))
    c = mix(c, hexa("#4fb6c9"), spot(phi, rho, -25, 0.5, 0.16) * 0.8)
    c = mix(c, hexa("#d8564a"), spot(phi, rho, -55, 0.78, 0.07) + spot(phi, rho, -35, 0.8, 0.05))
    return c


def agrias(phi, rho):
    c = np.broadcast_to(hexa("#232327"), phi.shape + (3,)).copy()
    red = (phi > SPLIT + 4) * K.smooth(0.18, 0.28, rho) * (1 - K.smooth(0.62, 0.72, rho)) * (1 - K.smooth(62, 72, phi))
    c = mix(c, hexa("#d63a33"), red.astype(float))
    blue = (phi < SPLIT - 4) * K.smooth(0.25, 0.35, rho) * (1 - K.smooth(0.66, 0.74, rho)) * K.smooth(-66, -56, phi)
    c = mix(c, hexa("#3f74d4"), blue.astype(float))
    return c


def monarch(phi, rho):
    c = mix(np.broadcast_to(hexa("#f08a2c"), phi.shape + (3,)), hexa("#f6a446"), K.smooth(0.2, 0.6, rho))
    c = mix(c, hexa("#2a2524"), veins(phi, rho, 5.5, 0.09, 0.15))
    c = mix(c, hexa("#2a2524"), K.smooth(0.76, 0.81, rho) + K.smooth(64, 72, phi) * K.smooth(0.5, 0.6, rho))
    dots = (np.abs(np.sin((phi - PHI0) * D2R * 9)) > 0.72) * K.smooth(0.86, 0.88, rho) * (1 - K.smooth(0.93, 0.95, rho))
    c = mix(c, hexa("#f4efe2"), dots.astype(float))
    c = mix(c, hexa("#f4efe2"), spot(phi, rho, 70, 0.75, 0.05) + spot(phi, rho, 60, 0.8, 0.045))
    return mix(c, hexa("#2a2524"), split_line(phi))


def emperor(phi, rho):
    c = mix(np.broadcast_to(hexa("#2f6fd0"), phi.shape + (3,)), hexa("#6cc4f2"), K.smooth(0.15, 0.6, rho) * (1 - K.smooth(0.65, 0.8, rho)))
    margin = K.smooth(0.8, 0.85, rho) + K.smooth(58, 70, phi) * K.smooth(0.55, 0.65, rho)
    c = mix(c, hexa("#22232a"), np.clip(margin, 0, 1))
    c = mix(c, hexa("#f4efe2"), spot(phi, rho, 66, 0.78, 0.045) + spot(phi, rho, 56, 0.86, 0.04))
    return mix(c, hexa("#244f9c"), split_line(phi) * 0.6)


# ---------------------------------------------------------------- building
def body(k, M, col, length, r, head=0.55, at=(0.0, 0.0)):
    """A soft body along z: abdomen behind, a round thorax, the head toward +z; two antennae with clubs."""
    L = length
    prof = [(0.0, -L * 0.62), (r * 0.7, -L * 0.42), (r * 1.0, 0.0), (r * 0.85, L * 0.22), (r * 0.7 * head / 0.55, L * 0.34), (0.0, L * 0.42)]
    k.lathe((0, at[0], at[1]), prof, M["paint"], col, d=(0, 0, 1), n=5)


def antennae(k, M, col, L, r, club=True, at=(0.0, 0.0)):
    for s in (-1, 1):
        path = [(s * r * 0.3, at[0] + r * 0.4, at[1] + L * 0.38), (s * r * 2.4, at[0] + r * 3.4, at[1] + L * 0.86)]
        k.tube(path, r * 0.12, M["paint"], col, n=3, v_len=1.0)
        if club:
            k.blob(path[-1], (r * 0.26, r * 0.26, r * 0.34), M["paint"], col, segs=4, rings=2)


def polar(t):
    """The paint's frame over a traced wing: the root (where the wing meets the body), the outline's radius R(phi) round
    it, and phi mapped so the old wing's own range and notch land on PHI0, SPLIT and PHI1."""
    m, f = t["mask"], t["frame"]
    rows, cols = np.nonzero(m)
    inner = cols <= cols.min() + 3
    root = (f["x0"], f["z0"] + (rows[inner].mean() - f["pad"] + 0.5) * f["px"])
    phis = np.arange(-90, 90.5, 0.5)
    rs = np.arange(0, 1.5 * max(f["x1"] - f["x0"], f["z1"] - f["z0"]), f["px"] / 2)
    X = root[0] + np.cos(phis[:, None] * D2R) * rs[None]
    Z = root[1] + np.sin(phis[:, None] * D2R) * rs[None]
    c = ((X - f["x0"]) / f["px"] + f["pad"] - 0.5).round().astype(int)
    r = ((Z - f["z0"]) / f["px"] + f["pad"] - 0.5).round().astype(int)
    ok = (c >= 0) & (c < m.shape[1]) & (r >= 0) & (r < m.shape[0])
    hit = np.zeros_like(ok)
    hit[ok] = m[r[ok], c[ok]]
    R = np.where(hit.any(1), rs[None].repeat(len(phis), 0).max(1, where=hit, initial=0), 0)
    on = np.nonzero(R > 0)[0]
    lo, hi = phis[on[0]], phis[on[-1]]
    fore = phis[np.argmax(np.where(phis > (lo + hi) / 2, R, 0))]
    hind = phis[np.argmax(np.where(phis <= (lo + hi) / 2, R, 0))]
    between = (phis >= hind) & (phis <= fore)
    notch = phis[between][np.argmin(R[between])] if between.sum() > 2 else (lo + hi) / 2
    def mapped(phi):
        return np.where(phi < notch, PHI0 + (phi - lo) / max(notch - lo, 1) * (SPLIT - PHI0),
                        SPLIT + (phi - notch) / max(hi - notch, 1) * (PHI1 - SPLIT))
    return root, phis, R, mapped


def paint_tile(t, fn):
    """The species' tile, flat over the wing from above: each texel painted at its place in the paint's frame."""
    f = t["frame"]
    root, phis, R, mapped = polar(t)
    g = (np.arange(TILE) + 0.5) / TILE
    U, V = np.meshgrid(g, g)
    X, Z = f["x0"] + U * (f["x1"] - f["x0"]), f["z0"] + V * (f["z1"] - f["z0"])
    phi = np.degrees(np.arctan2(Z - root[1], X - root[0]))
    out = np.interp(phi, phis, R)
    rho = np.clip(np.hypot(X - root[0], Z - root[1]) / np.maximum(out, 1e-6), 0, 1)
    return np.clip(fn(mapped(phi), rho), 0, 1)


def atlas(traces):
    rows = math.ceil(len(TILES) / COLS)
    img = np.zeros((rows * TILE, COLS * TILE, 3))
    for i, n in enumerate(TILES):
        r, c = divmod(i, COLS)
        img[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE] = paint_tile(traces[n], PAINT[n])[::-1]   # row 0 at the top
    return img, rows


def tile_uv(name, u, v, rows):
    """Tile-local (u, v) in [0, 1] -> atlas uv (inset half a texel)."""
    i = TILES.index(name)
    r, c = divmod(i, COLS)
    e = 0.5 / TILE
    u = e + u * (1 - 2 * e)
    v = e + v * (1 - 2 * e)
    return ((c + u) / COLS, 1 - (r + 1 - v) / rows)


def wings(k, M, name, t, rows):
    """The traced wings, both sides: each outline polygon cut into triangles, lifted to the old wing's V."""
    f, cl, sl = t["frame"], math.cos(t["lift"]), math.sin(t["lift"])
    for pts, tri in t["polys"]:
        uv = [tile_uv(name, (x - f["x0"]) / (f["x1"] - f["x0"]), (z - f["z0"]) / (f["z1"] - f["z0"]), rows) for x, z in pts]
        for side in (1, -1):
            vs = [k.vert((side * x * cl, t["yb"] + x * sl, z)) for x, z in pts]
            for a, b, c in tri:
                ids = (a, b, c) if side > 0 else (c, b, a)
                k.face([vs[i] for i in ids], [uv[i] for i in ids], M["wings"])


def dragon_paint(phi, rho):
    """The dragonflies' tile: a pale clear-looking wing, a few cross veins, a dark mark at each wing's tip."""
    c = mix(np.broadcast_to(hexa("#f1f6f4"), phi.shape + (3,)), hexa("#dde9e8"), K.smooth(0.2, 0.9, rho))
    c = mix(c, hexa("#9fb0ad"), (np.abs(np.sin(rho * 30)) < 0.15) * 0.5)
    tips = spot(phi, rho, (SPLIT + PHI1) / 2 + 12, 0.9, 0.06) + spot(phi, rho, (PHI0 + SPLIT) / 2 - 12, 0.9, 0.06)
    return mix(c, hexa("#4b4038"), np.clip(tips, 0, 1))


BUTTERFLIES = {
    # name: (drawn scale, paint, body colour, body length)
    "common-butterfly": (0.065, common, "#5a5760", 0.075),
    "tiger-butterfly": (0.0375, tiger, "#2b2a2e", 0.08),
    "agrias-butterfly": (0.0375, agrias, "#2a2a30", 0.07),
    "monarch-butterfly": (0.0375, monarch, "#2a2524", 0.08),
    "peacock-butterfly": (0.0375, peacock, "#26282d", 0.08),
    "emperor-butterfly": (0.035, emperor, "#22232a", 0.085),
}
DRAGONFLIES = {
    # name: (drawn scale, body colours (thorax, abdomen, rings), eyes, length)
    "darner-dragonfly": (0.0375, ("#5d9a52", "#4f8fd0", "#2c3f5c"), "#3c7ec0", 0.2),
    "red-dragonfly": (0.05, ("#b5523c", "#d8483a", "#8a2f26"), "#a63a2e", 0.16),
}
TILES = list(BUTTERFLIES) + list(DRAGONFLIES)
PAINT = {**{n: v[1] for n, v in BUTTERFLIES.items()}, **{n: dragon_paint for n in DRAGONFLIES}}
# Outline points a side: the butterflies' two lobes (and tails) in about 20, the dragonflies' straight wings in 4 each.
BUDGET = {"butterfly": 20, "dragonfly": 8}


def mats(img):
    return {"paint": K.Mat("P_Paint", rough=0.6), "wings": K.Mat("M_Wings", tex=K.image("critter_wings", img), rough=0.75, double=True)}


def butterfly(name, t, img, rows):
    drawn, _, col, L = BUTTERFLIES[name]
    K.reset()
    M = mats(img)
    k = K.Kit(name)
    r = t["span"] * 0.075
    body(k, M, col, L, r, at=t["body"])
    antennae(k, M, col, L, r, at=t["body"])
    wings(k, M, name, t, rows)
    ob = k.finish(smooth_deg=70)
    export_in_frame(ob, drawn, f"game/remodel/critters/{name}.glb")


def dragonfly(name, t, img, rows):
    drawn, (thorax, abd, ring), eye, L = DRAGONFLIES[name]
    K.reset()
    M = mats(img)
    k = K.Kit(name)
    r = t["span"] * 0.075
    y0, z0 = t["body"]
    # The long abdomen toward -z, banded, the thorax, the head with two big eyes.
    tail = [(0.0, -L * 0.8), (r * 0.5, -L * 0.78)] + [(r * (0.62 if i % 2 else 0.7), -L * 0.12 - i * L * 0.11) for i in range(5, -1, -1)]
    bands = k.lathe((0, y0, z0), tail, M["paint"], abd, d=(0, 0, 1), n=4, phase=math.pi / 4)
    PS.recolor(k, bands, lambda x, y, z: (abd, ring)[int((z0 - z - L * 0.12) / (L * 0.11)) % 2] if z - z0 > -L * 0.78 else ring)
    k.blob((0, y0, z0), (r * 1.15, r * 1.2, L * 0.13), M["paint"], thorax, segs=5, rings=3)
    for s in (-1, 1):
        k.blob((s * r * 0.75, y0 + r * 0.3, z0 + L * 0.17), (r * 0.95, r * 0.95, r * 0.9), M["paint"], eye, segs=4, rings=3)
    wings(k, M, name, t, rows)
    ob = k.finish(smooth_deg=70)
    export_in_frame(ob, drawn, f"game/remodel/critters/{name}.glb")


if __name__ == "__main__":
    traces = {}
    for name in TILES:
        kind = "butterfly" if name in BUTTERFLIES else "dragonfly"
        drawn = (BUTTERFLIES.get(name) or DRAGONFLIES[name])[0]
        traces[name] = trace(name, drawn, kind, BUDGET[kind])
    if "debug" in sys.argv:
        import json
        out = sys.argv[sys.argv.index("debug") + 1]
        json.dump({n: {"polys": [[list(map(float, p)) for p in s] for s, _ in t["polys"]], "tris": [[list(map(int, q)) for q in tri] for _, tri in t["polys"]],
                       "frame": t["frame"], "mask": t["mask"].astype(int).tolist(), "lift": t["lift"], "yb": t["yb"], "body": t["body"]}
                   for n, t in traces.items()}, open(out, "w"))
        sys.exit(0)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    img, rows = atlas(traces)
    for name in TILES:
        (butterfly if name in BUTTERFLIES else dragonfly)(name, traces[name], img, rows)
