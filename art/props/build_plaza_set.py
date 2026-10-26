"""The plaza's set (terrain v3, game/village-art; David, 2026-10-26: "water fountain in the middle", "i want stuff like flag
and banner and stuff and less empty more styff everywhere to make it feel lively, like fruit barrel and crates outside
fruit shops and stuff", references plaza-fountain.jpg and plaza-vibe.jpg in specs/references/terrain/r2-2026-10-26/).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_plaza_set.py [-- review <dir>]

Writes, under web/public/assets/game/props/, in game units at scale 1, the origin on the ground at the piece's centre
(its front toward +z) unless said:
  plaza-fountain.glb  a round stone basin 9 across (rim top 0.55, the pool at 0.4) with a two-bowl centre and finial
                      (top 3.2), water falling from each bowl's lip. Scale it uniformly to fit the plaza.
  bunting-string.glb  a sagging rope of pennants hung between (-2, 0, 0) and (2, 0, 0) (its origin midway between the
                      two hang points): set it at the hang height and scale x by the span over 4.
  banner-pole.glb     a pole (3.3) with a hanging swallow-tail TSI banner on a cross arm, facing +z.
  flag-pole.glb       a tall pole (4.1) flying the TSI flag out along +x (game/village-art2; David, R2c: "make the flag
                      tsi logo flag"): the island flag's green (branding/island-flag.svg) with the white TSI mark
                      (branding/tethos-mark.svg) and gold hems, rippled as it flies. It doesn't move.
  wall-banner.glb     a shop's blade banner on an iron bracket: the origin at the bracket's wall plate (the wall is the
                      x-y plane, the bracket out along +z), the banner hanging under it to y -1.0.
  fruit-stall.glb     a market stall 2.6 wide under a striped awning (top 2.5), three crates of fruit on its counter.
  fruit-barrel.glb    a barrel heaped with apples (top 0.98).
  fruit-crate.glb     an open slatted crate of oranges (top 0.5).
  flower-planter.glb  a timber planter box 1.2 long, leafy, in flower.
  flower-pot.glb      a terracotta pot of flowers.
  round-planter.glb   a stone bowl on a foot with a white daisy bush (for the fountain's rim and the plaza's edges).
  planter-bench.glb   a bench 2.6 long between two planter boxes (seat at 0.48).
  market-sign.glb     an A-frame board with a painted apple, no words.
All plain colour on the shared presets (P_Wood, P_Stone, P_Paint, P_Cloth, P_Metal, and P_Glass for the water), the
colour in COLOR_0, so each model is a few draws and no textures; but the flag's and the TSI banner's cloth carries the
mark on a 256 px painted linen (the mark is drawn from the SVG by sharp, in web/node_modules). Seeded: a rebuild writes the same models.
"""
import math, os, subprocess, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TAU = math.tau
WOOD, DARKW, LIGHTW = "#b9875a", "#93673f", "#d2a874"
STONE, STONE2, STONE3 = "#d8ccb4", "#cbbda3", "#e2d8c4"
WATER, WATER_HI, WATER_DEEP = "#7fd0d6", "#b8ece8", "#4fb3c2"
CORAL, GOLD, TEAL, CREAM, LEAF, PLUM = "#e0675a", "#e9b84e", "#3f8f93", "#f4ead2", "#78b057", "#8a5aa8"
APPLE, ORANGE, PEAR, LEMON = "#d8453b", "#f0973a", "#b9cf55", "#f2d34a"


MARK_SVG = os.path.join(K.ROOT, "web", "public", "assets", "branding", "tethos-mark.svg")
FIELD = "#426b5b"   # the island flag's green (branding/island-flag.svg)
MARK_ASPECT = 1410 / 1352   # the mark's width over its height, trimmed


def mark(w, h):
    """The TSI mark, trimmed and drawn into w x h pixels (stretched to fit): its alpha, row 0 at the top."""
    import bpy, tempfile
    out = os.path.join(tempfile.mkdtemp(), "mark.png")
    js = f"require('sharp')('{MARK_SVG}', {{density: 300}}).trim().resize({w}, {h}, {{fit: 'fill'}}).png().toFile('{out}')"
    subprocess.run(["node", "-e", js], cwd=os.path.join(K.ROOT, "web"), check=True)
    img = bpy.data.images.load(out)
    a = np.array(img.pixels[:]).reshape(h, w, 4)[::-1, :, 3]
    bpy.data.images.remove(img)
    return a


def tsi_cloth(name, aspect, mark_h, mark_v, hem):
    """The TSI cloth, 256 px square laid over a cloth `aspect` times as wide as tall: the island flag's green on a linen
    weave, gold hems ('tb' top and bottom, 'lr' down the sides), the white mark mark_h of the cloth's height with its
    middle at mark_v down it, drawn so it keeps its true shape on the cloth."""
    n = 256
    rgb = K.linen(n, n, 3, FIELD, threads=48)
    U, V = K.grid(n, n)
    edge = np.minimum(V, 1 - V) < 0.07 if hem == "tb" else np.minimum(U, 1 - U) < 0.09
    rgb[edge] = K.linen(n, n, 4, GOLD, threads=48)[edge]
    h = int(n * mark_h)
    w = min(n - 8, int(h * MARK_ASPECT / aspect))
    a = mark(w, h)[..., None]
    y0, x0 = int(n * mark_v) - h // 2, (n - w) // 2
    rgb[y0:y0 + h, x0:x0 + w] = rgb[y0:y0 + h, x0:x0 + w] * (1 - a) + K.arr("#fbf6e8") * a
    return K.Mat("P_Cloth", rough=1.0, tex=K.image(name, rgb))


def tex_grid(k, mat, pts):
    """Quads over a grid of game points pts[i][j] (i down, j across), the texture laid once over the whole grid."""
    ny, nx = len(pts) - 1, len(pts[0]) - 1
    for i in range(ny):
        for j in range(nx):
            k.face([k.vert(pts[i][j]), k.vert(pts[i][j + 1]), k.vert(pts[i + 1][j + 1]), k.vert(pts[i + 1][j])],
                   [(j / nx, 1 - i / ny), ((j + 1) / nx, 1 - i / ny), ((j + 1) / nx, 1 - (i + 1) / ny), (j / nx, 1 - (i + 1) / ny)], mat)


def presets(*names):
    return {n: K.Mat(f"P_{n.capitalize()}", rough=0.9) for n in names}


def recolor(k, faces, fn):
    """Recolour faces by their centre (game x, y, z): fn -> a hex colour."""
    for f in faces:
        c = f.calc_center_median()
        col = (*K.lin(fn(c.x, c.z, -c.y)), 1.0)
        for lp in f.loops:
            lp[k.col] = col


def shade(h, s):
    r, g, b = K.hexrgb(h)
    return "#%02x%02x%02x" % tuple(int(max(0, min(255, round(v * 255 * s)))) for v in (r, g, b))


def fruit_heap(k, M, c, rx, rz, h, cols, n, seed, r=0.075):
    """A mound of fruit: a lumpy dome in the fruits' colour and n round fruits sat on its surface."""
    rng = np.random.default_rng(seed)
    x, y, z = c
    k.blob((x, y, z), (rx, h, rz), M["paint"], shade(cols[0], 0.85), segs=10, rings=5, seed=seed, lumpy=0.15, flat_bottom=0.0)
    for i in range(n):
        a, t = rng.uniform(0, TAU), math.sqrt(rng.uniform(0, 0.8))
        px, pz = math.cos(a) * rx * t, math.sin(a) * rz * t
        py = h * math.sqrt(max(0.0, 1 - t * t)) + r * 0.3
        k.blob((x + px, y + py, z + pz), (r, r * 0.92, r), M["paint"], cols[i % len(cols)], segs=6, rings=4, seed=seed + i)


def flower(k, M, c, r, col, seed):
    """A flat five-lobed head and its button centre."""
    x, y, z = c
    k.blob((x, y, z), (r, r * 0.5, r), M["cloth"], col, segs=5, rings=3, seed=seed, lumpy=0.3)
    k.blob((x, y + r * 0.42, z), (r * 0.4, r * 0.25, r * 0.4), M["cloth"], GOLD if col != GOLD else "#c0702e", segs=5, rings=2)


def leafy(k, M, c, rx, rz, h, flowers, cols, seed, fr=0.06):
    """A leafy mound with flower heads dotted over its top."""
    rng = np.random.default_rng(seed)
    x, y, z = c
    k.blob((x, y, z), (rx, h, rz), M["cloth"], LEAF, segs=12, rings=7, seed=seed, lumpy=0.16, flat_bottom=0.0)
    for i in range(flowers):
        a, t = rng.uniform(0, TAU), math.sqrt(rng.uniform(0.0, 0.85))
        px, pz = math.cos(a) * rx * t, math.sin(a) * rz * t
        flower(k, M, (x + px, y + h * math.sqrt(max(0.0, 1 - t * t)) * 1.16 + fr * 0.3, z + pz), fr * rng.uniform(0.85, 1.15), cols[i % len(cols)], seed * 31 + i)


# ================================================================ the fountain
def plaza_fountain():
    K.reset()
    M = {"stone": K.Mat("P_Stone", rough=0.95), "water": K.Mat("P_Glass", rough=0.1)}
    k = K.Kit("plaza-fountain")
    n = 40
    blocks = lambda x, y, z: (STONE, STONE2, STONE3)[int((math.atan2(z, x) / TAU + 1) * 24) % 3]
    # The basin: a low step, the wall, its rounded cap, and the inner face down to the pool's floor.
    wall = k.lathe((0, 0, 0), [(4.78, -0.03), (4.78, 0.1), (4.62, 0.12), (4.52, 0.14), (4.5, 0.47), (4.47, 0.53), (4.38, 0.565), (4.15, 0.565),
                               (4.07, 0.53), (4.05, 0.47), (4.05, 0.36)], M["stone"], STONE, n=n)
    recolor(k, wall, blocks)
    # The pool: rings of water, light at the rim and round the centre, deeper between.
    rings = [(4.06, WATER_HI), (3.75, WATER), (2.9, WATER_DEEP), (2.2, WATER), (1.9, WATER_HI), (0.0, WATER_HI)]
    for (r0, c0), (r1, _) in zip(rings, rings[1:]):
        k.lathe((0, 0, 0), [(r0, 0.4), (r1, 0.4)], M["water"], c0, n=n if r0 > 3 else 28)
    # The centre: a fluted pedestal, the wide lower bowl, a slimmer stem, the upper bowl and a finial.
    k.lathe((0, 0, 0), [(0.62, 0.38), (0.6, 0.5), (0.46, 0.58), (0.38, 0.75), (0.34, 1.05), (0.42, 1.18), (0.6, 1.24), (1.1, 1.32), (1.5, 1.42),
                        (1.58, 1.52), (1.56, 1.58), (1.46, 1.6), (1.36, 1.54)], M["stone"], STONE3, n=28)
    k.lathe((0, 0, 0), [(1.4, 1.5), (0.0, 1.5)], M["water"], WATER, n=28)
    k.lathe((0, 0, 0), [(0.3, 1.49), (0.28, 1.6), (0.2, 1.75), (0.17, 2.1), (0.22, 2.22), (0.36, 2.28), (0.62, 2.36), (0.76, 2.46), (0.78, 2.54),
                        (0.7, 2.56), (0.62, 2.5)], M["stone"], STONE, n=24)
    k.lathe((0, 0, 0), [(0.66, 2.48), (0.0, 2.48)], M["water"], WATER, n=24)
    k.lathe((0, 0, 0), [(0.14, 2.47), (0.16, 2.6), (0.1, 2.72), (0.13, 2.82), (0.2, 2.86), (0.12, 2.92), (0.08, 3.0), (0.11, 3.07), (0.0, 3.12)],
            M["stone"], STONE3, n=12)
    # The water: a bubble over the finial, and streams spilling from each bowl's lip, arcing out and down as ribbons.
    k.blob((0, 3.14, 0), (0.09, 0.07, 0.09), M["water"], WATER_HI, segs=10, rings=5)
    for count, r0, y0, y1, out, w in ((10, 0.79, 2.53, 1.5, 0.22, 0.09), (16, 1.59, 1.55, 0.4, 0.34, 0.12)):
        for i in range(count):
            a = TAU * (i + 0.5) / count
            ca, sa = math.cos(a), math.sin(a)
            path = [(r0 + out * math.sin(t * math.pi / 2), y0 - (y0 - y1) * t * t + 0.02 * (1 - t)) for t in np.linspace(0, 1, 6)]
            row = lambda r, y, s: (ca * r - sa * s, y, sa * r + ca * s)
            for (ra, ya), (rb, yb) in zip(path, path[1:]):
                k.quad([row(ra, ya, -w / 2), row(ra, ya, w / 2), row(rb, yb, w / 2 * 1.1), row(rb, yb, -w / 2 * 1.1)], M["water"], WATER_HI)
    # Where the streams land: a light ring of spray on the pool.
    k.lathe((0, 0, 0), [(2.06, 0.405), (1.8, 0.405)], M["water"], "#e4f7f2", n=28)
    k.lathe((0, 0, 0), [(1.12, 1.505), (0.94, 1.505)], M["water"], "#e4f7f2", n=24)
    k.tint_gradient(0.84, 1.0, 0.0, 3.2)
    ob = k.finish(smooth_deg=50)
    return ob, {"top": 3.15}


# ================================================================ flags, banners and bunting
def cloth_grid(k, M, pts, cols):
    """Quads over a grid of game points pts[i][j]; cols(i, j) the colour of the quad from (i, j)."""
    for i in range(len(pts) - 1):
        for j in range(len(pts[0]) - 1):
            k.quad([pts[i][j], pts[i][j + 1], pts[i + 1][j + 1], pts[i + 1][j]], M["cloth"], cols(i, j))


def bunting_string():
    K.reset()
    M = presets("cloth")
    k = K.Kit("bunting-string")
    sag = 0.32
    y = lambda x: -sag * (1 - (x / 2) ** 2)
    k.tube([(x, y(x), 0.0) for x in np.linspace(-2, 2, 13)], 0.012, M["cloth"], "#d9c49a", n=4, v_len=0.3)
    cols = [CORAL, GOLD, TEAL, CREAM, LEAF]
    for i, x in enumerate(np.linspace(-1.75, 1.75, 13)):
        a, b = x - 0.11, x + 0.11
        tip = (x, (y(a) + y(b)) / 2 - 0.27, 0.02 * (-1) ** i)
        k.face([k.vert((a, y(a), 0.0)), k.vert((b, y(b), 0.0)), k.vert(tip)], [(0, 0), (1, 0), (0.5, 1)], M["cloth"], cols[i % len(cols)])
    ob = k.finish(smooth_deg=30)
    return ob, {}


def banner(k, M, x0, x1, ytop, ybot, z, body, trim, wave=0.03):
    """A cloth banner hung from ytop, swallow-tailed at the foot, a trim down its sides and a diamond on it."""
    w, nx, ny = x1 - x0, 6, 8
    pts = []
    for i in range(ny + 1):
        t = i / ny
        row = []
        for j in range(nx + 1):
            s = j / nx
            notch = 0.16 * (1 - abs(2 * s - 1)) * t ** 6         # the tail's notch, cut into the middle at the foot
            row.append((x0 + w * s, ytop - (ytop - ybot) * t + notch * (ytop - ybot), z + wave * math.sin(t * 3.0 + s * 2.0) * t))
        pts.append(row)
    def col(i, j):
        if j in (0, nx - 1):
            return trim
        cx, cy = (j + 0.5) / nx - 0.5, (i + 0.5) / ny - 0.45
        return trim if abs(cx) * 1.6 + abs(cy) < 0.2 else body
    cloth_grid(k, M, pts, col)


def banner_pole():
    K.reset()
    M = presets("wood", "metal")
    k = K.Kit("banner-pole")
    k.lathe((0, 0, 0), [(0.11, -0.02), (0.11, 0.12), (0.06, 0.16), (0.05, 3.15), (0.0, 3.15)], M["wood"], DARKW, n=8)
    k.blob((0, 3.22, 0), (0.07, 0.08, 0.07), M["metal"], GOLD, segs=8, rings=5)
    k.tube([(-0.42, 2.98, 0.06), (0.42, 2.98, 0.06)], 0.025, M["wood"], DARKW, n=6, caps=True)
    for x in (-0.42, 0.42):
        k.blob((x, 2.98, 0.06), (0.035, 0.035, 0.035), M["metal"], GOLD, segs=6, rings=4)
    cloth = tsi_cloth("tsi-banner", 0.72 / 1.46, 0.36, 0.37, "lr")
    nx, ny = 6, 8
    pts = [[(-0.36 + 0.72 * j / nx, 2.96 - 1.46 * i / ny + 0.16 * (1 - abs(2 * j / nx - 1)) * (i / ny) ** 6 * 1.46,
             0.08 + 0.03 * math.sin(i / ny * 3.0 + j / nx * 2.0) * i / ny) for j in range(nx + 1)] for i in range(ny + 1)]
    tex_grid(k, cloth, pts)
    k.tint_gradient(0.85, 1.0, 0.0, 3.3)
    return k.finish(smooth_deg=40), {"top": 3.3}


def flag_pole():
    K.reset()
    M = presets("wood", "metal")
    k = K.Kit("flag-pole")
    k.lathe((0, 0, 0), [(0.12, -0.02), (0.12, 0.14), (0.06, 0.18), (0.045, 4.0), (0.0, 4.0)], M["wood"], LIGHTW, n=8)
    k.blob((0, 4.06, 0), (0.07, 0.07, 0.07), M["metal"], GOLD, segs=8, rings=5)
    W, H, nx, ny = 1.3, 0.82, 10, 5
    pts = [[(0.06 + W * s, 3.92 - H * t - 0.06 * s ** 1.5, 0.12 * math.sin(s * 4.6 - 0.4 * t) * s + 0.025 * math.sin(t * 3.0 + s * 6.0) * s)
            for s in (j / nx for j in range(nx + 1))] for t in (i / ny for i in range(ny + 1))]
    tex_grid(k, tsi_cloth("tsi-flag", W / H, 0.62, 0.5, "tb"), pts)
    for y in (3.88, 3.14):   # the rings that hold its hoist to the pole
        k.tube([(0.065 * math.cos(a), y, 0.065 * math.sin(a)) for a in np.linspace(0, TAU, 8, endpoint=False)], 0.012, M["metal"], GOLD, n=4, closed_path=True)
    k.tint_gradient(0.85, 1.0, 0.0, 4.1)
    return k.finish(smooth_deg=40), {"top": 4.13}


def wall_banner():
    K.reset()
    M = presets("cloth", "metal")
    k = K.Kit("wall-banner")
    k.rbox((0, 0, 0.015), (0.16, 0.22, 0.03), 0.01, M["metal"], "#3d3431", segs=1)
    k.tube([(0, 0, 0.02), (0, 0, 0.52)], 0.016, M["metal"], "#3d3431", n=6, caps=True)
    k.tube([(0, -0.16, 0.02), (0, -0.01, 0.2)], 0.012, M["metal"], "#3d3431", n=5)
    k.blob((0, 0, 0.53), (0.03, 0.03, 0.03), M["metal"], GOLD, segs=6, rings=4)
    # The banner hangs in the y-z plane: built along x, then turned onto z.
    first = len(k.bm.faces)
    banner(k, M, -0.24, 0.24, -0.03, -1.0, 0.0, CORAL, CREAM, wave=0.02)
    for f in list(k.bm.faces)[first:]:
        for v in f.verts:
            if not v.tag:
                v.tag = True
                v.co.x, v.co.y = -v.co.y, -(v.co.x + 0.28)       # game x -> game z out from the wall (Blender y = -game z)
    k.tint_gradient(0.88, 1.0, -1.0, 0.1)
    return k.finish(smooth_deg=40), {}


# ================================================================ the fruit stall and its crates
def crate(k, M, c, w, h, d, col=WOOD, r=0.008):
    """An open crate of slats: a base, four corner posts, two slats a side with a gap between."""
    x, y, z = c
    k.rbox((x, y + 0.015, z), (w, 0.03, d), r, M["wood"], shade(col, 0.85), segs=1)
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.rbox((x + sx * (w / 2 - 0.02), y + h / 2, z + sz * (d / 2 - 0.02)), (0.04, h, 0.04), r, M["wood"], shade(col, 0.8), segs=1)
    for yy in (h * 0.3, h * 0.78):
        for sz in (-1, 1):
            k.rbox((x, y + yy, z + sz * (d / 2 - 0.01)), (w - 0.02, h * 0.3, 0.02), r * 0.75, M["wood"], col, segs=1)
        for sx in (-1, 1):
            k.rbox((x + sx * (w / 2 - 0.01), y + yy, z), (0.02, h * 0.3, d - 0.02), r * 0.75, M["wood"], shade(col, 0.93), segs=1)


def fruit_stall():
    K.reset()
    M = presets("wood", "cloth", "paint")
    k = K.Kit("fruit-stall")
    W, D = 2.6, 1.2
    for x in (-W / 2 + 0.08, W / 2 - 0.08):
        k.beam((x, 0, D / 2 - 0.08), (x, 2.12, D / 2 - 0.08), 0.1, 0.1, 0.02, M["wood"], DARKW, segs=1)
        k.beam((x, 0, -D / 2 + 0.08), (x, 2.42, -D / 2 + 0.08), 0.1, 0.1, 0.02, M["wood"], DARKW, segs=1)
    k.beam((-W / 2, 2.08, D / 2 - 0.08), (W / 2, 2.08, D / 2 - 0.08), 0.1, 0.1, 0.02, M["wood"], DARKW, segs=1)
    # The counter: a top and a front of planks in two tones.
    k.rbox((0, 0.86, 0.12), (W - 0.1, 0.07, 0.8), 0.02, M["wood"], LIGHTW, segs=1)
    for i in range(7):
        x = -W / 2 + 0.05 + (i + 0.5) * (W - 0.1) / 7
        k.rbox((x, 0.42, 0.5), ((W - 0.1) / 7 - 0.012, 0.82, 0.05), 0.012, M["wood"], WOOD if i % 2 else shade(WOOD, 0.9), segs=1)
    k.rbox((0, 0.42, -0.15), (W - 0.2, 0.8, 0.04), 0.01, M["wood"], shade(WOOD, 0.8), segs=1)
    # Three crates of fruit on the counter, and a basket of lemons at its foot.
    for x, cols, s in ((-0.82, [APPLE, shade(APPLE, 1.12)], 1), (0.0, [ORANGE, shade(ORANGE, 1.08)], 2), (0.82, [PEAR, LEMON], 3)):
        crate(k, M, (x, 0.895, 0.15), 0.7, 0.16, 0.55, r=0.0)
        fruit_heap(k, M, (x, 0.93, 0.15), 0.3, 0.22, 0.12, cols, 8, s * 11)
    # The awning: cloth stripes running front to back, sloping down to the front, a scalloped valance.
    nx = 10
    xs = np.linspace(-W / 2 - 0.1, W / 2 + 0.1, nx + 1)
    back, front = (2.5, -D / 2 - 0.05), (2.12, D / 2 + 0.25)
    for j in range(nx):
        a, b = xs[j], xs[j + 1]
        col = CORAL if j % 2 == 0 else CREAM
        k.quad([(a, back[0], back[1]), (b, back[0], back[1]), (b, front[0] - 0.02, front[1]), (a, front[0] - 0.02, front[1])], M["cloth"], col)
        m = (a + b) / 2
        k.face([k.vert((a, front[0] - 0.02, front[1])), k.vert((b, front[0] - 0.02, front[1])), k.vert((b, front[0] - 0.14, front[1] + 0.02)),
                k.vert((m, front[0] - 0.22, front[1] + 0.025)), k.vert((a, front[0] - 0.14, front[1] + 0.02))],
               [(0, 0), (1, 0), (1, 1), (0.5, 1), (0, 1)], M["cloth"], col)
    k.tint_gradient(0.84, 1.0, 0.0, 2.5)
    return k.finish(smooth_deg=40), {"top": 2.5}


def barrel(k, M, h=0.82, r=0.33, bulge=0.05):
    prof = [(r, 0.0), (r + bulge * 0.6, h * 0.2), (r + bulge, h * 0.5), (r + bulge * 0.6, h * 0.8), (r, h)]
    staves = k.lathe((0, 0, 0), prof, M["wood"], WOOD, n=14, phase=0.1)
    recolor(k, staves, lambda x, y, z: (WOOD, shade(WOOD, 0.88), shade(WOOD, 1.06))[int((math.atan2(z, x) / TAU + 1) * 14 + 0.5) % 3])
    k.lathe((0, 0, 0), [(r - 0.04, h - 0.01), (r - 0.04, h - 0.06), (0.0, h - 0.06)], M["wood"], DARKW, n=14, phase=0.1)
    for y0 in (0.1, h - 0.16):
        rr = r + bulge * 0.5 + 0.012
        k.lathe((0, 0, 0), [(rr, y0), (rr + 0.006, y0 + 0.03), (rr, y0 + 0.06)], M["metal"], "#4a4440", n=14, phase=0.1)


def fruit_barrel():
    K.reset()
    M = presets("wood", "paint", "metal")
    k = K.Kit("fruit-barrel")
    barrel(k, M)
    fruit_heap(k, M, (0, 0.78, 0), 0.31, 0.31, 0.13, [APPLE, shade(APPLE, 1.12), "#c43a35"], 10, 41, r=0.08)
    k.tint_gradient(0.84, 1.0, 0.0, 1.0)
    return k.finish(smooth_deg=40), {"top": 0.98}


def fruit_crate():
    K.reset()
    M = presets("wood", "paint")
    k = K.Kit("fruit-crate")
    crate(k, M, (0, 0, 0), 0.62, 0.34, 0.44, col=LIGHTW)
    fruit_heap(k, M, (0, 0.3, 0), 0.27, 0.19, 0.12, [ORANGE, shade(ORANGE, 1.1)], 8, 51, r=0.07)
    k.tint_gradient(0.84, 1.0, 0.0, 0.5)
    return k.finish(smooth_deg=40), {"top": 0.5}


# ================================================================ planters and the bench
def planter_box(k, M, c, w, d, h, flowers, cols, seed):
    x, y, z = c
    for i, (dz, dw) in enumerate(((d / 2 - 0.025, w), (-d / 2 + 0.025, w))):
        for j in range(2):
            k.rbox((x, y + h * (0.25 + 0.5 * j), z + dz), (dw, h * 0.48, 0.05), 0.012, M["wood"], shade(WOOD, 0.92 + 0.08 * ((i + j) % 2)), segs=1)
    for dx in (-w / 2 + 0.025, w / 2 - 0.025):
        k.rbox((x + dx, y + h / 2, z), (0.05, h, d - 0.02), 0.012, M["wood"], DARKW, segs=1)
    k.rbox((x, y + h - 0.04, z), (w - 0.06, 0.02, d - 0.06), 0.005, M["cloth"], "#5b4330", segs=1)
    leafy(k, M, (x, y + h - 0.05, z), w * 0.48, d * 0.45, 0.2, flowers, cols, seed)


def flower_planter():
    K.reset()
    M = presets("wood", "cloth")
    k = K.Kit("flower-planter")
    planter_box(k, M, (0, 0, 0), 1.2, 0.42, 0.38, 18, [CORAL, GOLD, "#f2a1b5"], 61)
    k.tint_gradient(0.84, 1.0, 0.0, 0.62)
    return k.finish(smooth_deg=40), {}


def flower_pot():
    K.reset()
    M = presets("stone", "cloth")
    k = K.Kit("flower-pot")
    k.lathe((0, 0, 0), [(0.0, 0.0), (0.16, 0.0), (0.2, 0.3), (0.235, 0.32), (0.235, 0.38), (0.2, 0.39), (0.0, 0.37)], M["stone"], "#c8714a", n=14)
    leafy(k, M, (0, 0.36, 0), 0.22, 0.22, 0.2, 9, [PLUM, "#f2a1b5"], 71, fr=0.055)
    k.tint_gradient(0.84, 1.0, 0.0, 0.6)
    return k.finish(smooth_deg=45), {}


def round_planter():
    K.reset()
    M = presets("stone", "cloth")
    k = K.Kit("round-planter")
    bowl = k.lathe((0, 0, 0), [(0.0, 0.0), (0.26, 0.0), (0.26, 0.06), (0.17, 0.1), (0.15, 0.2), (0.3, 0.3), (0.48, 0.42), (0.52, 0.5), (0.5, 0.55),
                               (0.44, 0.54), (0.0, 0.5)], M["stone"], STONE, n=20)
    recolor(k, bowl, lambda x, y, z: STONE if y < 0.3 else STONE3)
    leafy(k, M, (0, 0.5, 0), 0.43, 0.43, 0.42, 26, ["#fffaf0", "#fffaf0", "#f6b8c8"], 81, fr=0.105)
    k.tint_gradient(0.84, 1.0, 0.0, 0.85)
    return k.finish(smooth_deg=45), {}


def planter_bench():
    K.reset()
    M = presets("wood", "cloth", "metal")
    k = K.Kit("planter-bench")
    for x in (-1.0, 1.0):
        planter_box(k, M, (x, 0, 0), 0.56, 0.56, 0.5, 6, [GOLD, CORAL], int(91 + x * 5))
    for i in range(3):
        k.rbox((0, 0.46, -0.16 + i * 0.16), (1.46, 0.045, 0.14), 0.015, M["wood"], LIGHTW if i % 2 else shade(LIGHTW, 0.93), segs=1, v_axis=0)
    for x in (-0.72, 0.72):
        k.rbox((x, 0.42, 0), (0.06, 0.04, 0.5), 0.01, M["metal"], "#3d3431", segs=1)
    k.tint_gradient(0.84, 1.0, 0.0, 0.8)
    return k.finish(smooth_deg=40), {"top": 0.48}


def market_sign():
    K.reset()
    M = presets("wood", "paint")
    k = K.Kit("market-sign")
    tilt = 0.24
    for s in (1, -1):
        R = K.game_rot(pitch=-s * tilt)
        c = K.Vector((0, 0.5, s * 0.5 * math.sin(tilt)))       # each board leans in so the tops meet over the origin
        on = lambda u, o, x=0.0: tuple(c + R @ K.Vector((x, u, o * s)))
        k.rbox(on(0, 0), (0.62, 1.0, 0.04), 0.015, M["wood"], DARKW, segs=1, rot=R)
        k.rbox(on(0.05, 0.022), (0.5, 0.7, 0.01), 0.004, M["paint"], "#3c5a48", segs=1, rot=R)
        # The apple, painted on: a round fan and a leaf, standing just proud of the board.
        rim = [k.vert(on(0.08 + math.sin(a) * 0.12 * (1 + 0.15 * math.sin(a)), 0.03, math.cos(a) * 0.13 * (1 - 0.1 * math.cos(2 * a))))
               for a in np.linspace(0, TAU, 12, endpoint=False)]
        cv = k.vert(on(0.08, 0.03))
        for i in range(12):
            k.face([cv, rim[i], rim[(i + 1) % 12]], [(0.5, 0.5), (0, 0), (1, 0)], M["paint"], APPLE)
        k.face([k.vert(on(0.19, 0.031)), k.vert(on(0.28, 0.031, 0.09)), k.vert(on(0.24, 0.031, 0.02))], [(0, 0), (1, 0), (0.5, 1)], M["paint"], LEAF)
    k.tint_gradient(0.86, 1.0, 0.0, 1.0)
    return k.finish(smooth_deg=40), {}


MODELS = {"plaza-fountain": plaza_fountain, "bunting-string": bunting_string, "banner-pole": banner_pole, "flag-pole": flag_pole,
          "wall-banner": wall_banner, "fruit-stall": fruit_stall, "fruit-barrel": fruit_barrel, "fruit-crate": fruit_crate,
          "flower-planter": flower_planter, "flower-pot": flower_pot, "round-planter": round_planter, "planter-bench": planter_bench,
          "market-sign": market_sign}


def review(out):
    """The plaza set laid out round the fountain, read back from the GLBs; and a close look at the small pieces."""
    import bpy
    spots = {"plaza-fountain": (0, 0, 0), "fruit-stall": (-3.4, 0, -6.2), "fruit-barrel": (-5.1, 0, -5.2), "fruit-crate": (-1.6, 0, -5.4),
             "banner-pole": (3.2, 0, -6.0), "flag-pole": (5.6, 0, -4.4), "flower-planter": (5.6, 0, 0.0, math.pi / 2), "flower-pot": (-5.6, 0, 1.8),
             "round-planter": (-5.6, 0, -1.0), "planter-bench": (5.0, 0, 3.6, -0.6), "market-sign": (-1.2, 0, -4.6, 0.3),
             "bunting-string": (0.6, 2.6, -6.0), "wall-banner": (-6.4, 1.8, 3.6, math.pi / 2)}
    for name, focus, views, size in (("plaza-set.png", None, ((0, 38), (150, 30)), 640), ("plaza-pieces.png", "small", ((25, 18), (205, 18)), 640)):
        K.reset()
        obs = []
        for nm, at in spots.items():
            if focus and nm == "plaza-fountain":
                continue
            bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"{nm}.glb"))
            for o in bpy.context.selected_objects:
                if o.type == "MESH":
                    o.location = K.G(at[0], at[1], at[2])
                    o.rotation_euler[2] = at[3] if len(at) > 3 else 0.0
                    o.data.color_attributes[0].name = "Color"
                    obs.append(o)
        bpy.context.view_layer.update()
        K.review(obs, os.path.join(out, name), views=views, size=size)


if __name__ == "__main__":
    only = [a for a in ARGS if a in MODELS]
    for nm, make in MODELS.items():
        if only and nm not in only:
            continue
        ob, info = make()
        K.export([ob], f"game/props/{nm}.glb")
        print("SET", nm, info)
    if "review" in ARGS:
        review(ARGS[ARGS.index("review") + 1])
