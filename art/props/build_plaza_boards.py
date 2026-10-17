"""The plaza's notice board and catch board (DefaultIslandWorld VillageLandmarks: notice, catch, and the mission board
after the combat drop; SeasonalEvents' GENESIS poster board): our own timber boards with a small shingle roof and a
cork face, no baked snow. Replace acnh/props/bulletin-board.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_plaza_boards.py [-- review <dir>]

Writes web/public/assets/game/props/notice-board.glb and catch-board.glb. Frame: the old board's, so every call site
stays as it was: game units at scale 1, the origin at the board's left end on the ground, the board running 1.68 along
+x, its cork facing +z centred 0.42 out (the plaza turns it by pi to face the plaza; GENESIS hangs its posters on the
back, PLAZA_BOARD in lib/game/propModels.ts).

Two square posts carry a backing of six upright boards, a cork face in a timber trim with a ledge under it, a header
board with a painted roundel (the notice board's a maple leaf, the catch board's a fish), and a gabled roof of wooden
shingles with a round ridge pole and barge boards. Papers pinned to the cork: the notices' scribbled lines, the
catch board's fish sketches. Three materials: M_BoardWood (grain; COLOR_0 stains each part), M_Shingle (shingles),
M_Cork (an atlas: cork, three papers and the roundel).
"""
import math, os, sys
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
X0, X1 = 0.0, 1.68              # the board's ends (the old model's)
ZC = 0.42                       # its middle, out from the origin
BACK = ZC - 0.05                # the backing's back face (GENESIS posters sit just behind it)
CORK = (0.17, 1.51, 0.57, 1.41)  # the cork face: x0, x1, y0, y1
RIDGE_Y, EAVE_Y, EAVE_OUT = 2.06, 1.82, 0.34
POST, WOOD, TRIM, HEADER, ROOF = "#8a6444", "#a27a55", "#7a5638", "#9c7350", "#a88a6c"

# The cork atlas: cork across u 0..0.75; down the last quarter, four 128 px tiles (v from the top): a blank paper, a
# scribbled notice, a fish sketch, the roundel.
TILE = {"blank": 3, "notes": 2, "fish": 1, "roundel": 0}


def tile_uv(name, u, v):
    """(u, v) in 0..1 inside a tile of the atlas' last column, kept 4 px off its edges."""
    i = TILE[name]
    m = 4 / 512
    return (0.75 + m + u * (0.25 - 2 * m), i * 0.25 + m + v * (0.25 - 2 * m))


def atlas(kind, h=512, w=512):
    out = np.zeros((h, w, 3))
    out[:, :384] = PK.cork(512, 384, 91 if kind == "notice" else 92)
    T = 128
    tiles = {}
    for name in TILE:
        tiles[name] = PK.paper(T, T, 93 + TILE[name])
    # Scribbled lines: a heading and five lines of illegible hand, in ink.
    r = np.random.default_rng(95 if kind == "notice" else 96)
    lines = [[(0.12 + 0.01 * k, 0.83 + 0.008 * math.sin(k * 1.7)) for k in range(int(r.uniform(22, 40)))]]
    lines[0] = [(x, y) for x, y in lines[0] if x < 0.62]
    for j in range(5):
        y = 0.66 - j * 0.12
        x1 = r.uniform(0.55, 0.88)
        pts = [(x, y + 0.012 * math.sin(x * 47 + j) + 0.006 * math.sin(x * 113)) for x in np.linspace(0.12, x1, 24)]
        lines.append(pts)
    a = PK.strokes_alpha(T, T, 1.0, 1.0, lines, 0.012, seed=97, taper=0.2)
    tiles["notes"] = PK.paint(tiles["notes"], a, "#4b5a6e", 0.85)
    # A fish sketch: its outline, an eye, a scale or two, a little caption line.
    fish = PK.fish_poly(0.5, 0.56, 0.7)
    a = PK.strokes_alpha(T, T, 1.0, 1.0, [fish + [fish[0]]], 0.011, seed=98, smooth_curves=False, taper=0.1)
    a = np.maximum(a, PK.strokes_alpha(T, T, 1.0, 1.0, [[(0.66, 0.6)], [(0.42, 0.5), (0.46, 0.56), (0.42, 0.62)], [(0.3, 0.5), (0.34, 0.56), (0.3, 0.62)],
                                                        [(0.2, 0.22), (0.8, 0.22)]], 0.012, seed=99))
    tiles["fish"] = PK.paint(tiles["fish"], a, "#4b5a6e", 0.85)
    # The roundel: a cream disc in a rust ring on stained wood, the board's emblem in the middle.
    U, V = K.grid(T, T)
    d = np.hypot(U - 0.5, V - 0.5) * 2
    wood = K.grain(T, T, 100, "#9c7350")
    disc = np.ones((T, T, 3)) * K.arr("#efe2c4")
    ring = K.smooth(0.86, 0.82, d) * K.smooth(0.7, 0.74, d)
    rt = PK.paint(wood, K.smooth(0.98, 0.95, d), "#efe2c4", 1.0)
    rt = PK.paint(rt, ring, "#b4502f" if kind == "notice" else "#4f6d86", 0.9)
    if kind == "notice":
        rt = PK.paint(rt, PK.fill_poly(T, T, 1, 1, PK.maple_poly(0.5, 0.48, 0.28, ang=0.3)), "#c8622f", 0.95)
        rt = PK.paint(rt, PK.strokes_alpha(T, T, 1, 1, PK.maple_veins(0.5, 0.48, 0.28, ang=0.3), 0.012, seed=101, taper=0.5), "#8a3e22", 0.7)
    else:
        rt = PK.paint(rt, PK.fill_poly(T, T, 1, 1, PK.fish_poly(0.5, 0.5, 0.62)), "#5b7d97", 0.95)
        rt = PK.paint(rt, PK.strokes_alpha(T, T, 1, 1, [[(0.64, 0.53)], [(0.44, 0.42), (0.48, 0.5), (0.44, 0.58)]], 0.014, seed=102), "#2e4252", 0.9)
    tiles["roundel"] = rt
    for name, i in TILE.items():
        r0 = h - (i + 1) * T                          # tile i sits at v i*0.25..(i+1)*0.25; row 0 is the top (v = 1)
        out[r0:r0 + T, 384:] = tiles[name]
    return out


def roof_frame(side):
    """A roof slope (side +1: the front, +z): local x along the ridge, y out of the roof, z up the slope (so the
    shingle courses lap downhill), centred on the slope's middle."""
    run, drop = EAVE_OUT, RIDGE_Y - EAVE_Y
    L = math.hypot(run, drop)
    upslope = Vector((0, drop, -side * run)) / L
    out = Vector((0, run, side * drop)) / L
    mid = Vector(((X0 + X1) / 2, (RIDGE_Y + EAVE_Y) / 2, ZC + side * run / 2))
    return Matrix((Vector((1, 0, 0)), out, upslope)).transposed(), mid, out, L


def build(kind):
    K.reset()
    M = {
        "wood": K.Mat("M_BoardWood", tex=K.image(f"{kind}_wood", K.grain(256, 128, 103, "#ffffff", knots=2)), rough=0.93),
        "shingle": K.Mat("M_Shingle", tex=K.image(f"{kind}_shingle", PK.shingles(256, 256, 104, rows=6, cols=4)), rough=0.95),
        "cork": K.Mat("M_Cork", tex=K.image(f"{kind}_cork", atlas(kind)), rough=0.96),
    }
    rng = np.random.default_rng(105 if kind == "notice" else 106)
    k = K.Kit(f"{kind}-board")
    # Posts, up under the roof.
    for x in (X0 + 0.065, X1 - 0.065):
        k.rbox((x, 0.975, ZC - 0.02), (0.11, 1.95, 0.11), 0.018, M["wood"], POST, segs=1, uv_off=(0.2 + x, 0.1))
    # The backing: six upright boards, each its own shade.
    bx0, bx1 = 0.12, 1.56
    bw = (bx1 - bx0) / 6
    for i in range(6):
        x = bx0 + bw * (i + 0.5)
        tone = ["#a27a55", "#9a7350", "#a88059", "#9f7752", "#a47c56", "#97704d"][i]
        k.rbox((x, 1.17, BACK + 0.022), (bw - 0.008, 1.38, 0.044), 0.008, M["wood"], tone, segs=1, v_axis=1, uv_off=(0.13 * i, 0.31 * i))
    # The cork, and its trim: sides, top, the ledge under it.
    cx0, cx1, cy0, cy1 = CORK
    zf = BACK + 0.05
    k.quad([(cx0, cy0, zf), (cx1, cy0, zf), (cx1, cy1, zf), (cx0, cy1, zf)], M["cork"], "#ffffff",
           uvs=((0.01, 0.02), (0.74, 0.02), (0.74, 0.02 + 0.73 * (cy1 - cy0) / (cx1 - cx0)), (0.01, 0.02 + 0.73 * (cy1 - cy0) / (cx1 - cx0))))
    for x in (cx0 - 0.026, cx1 + 0.026):
        k.rbox((x, (cy0 + cy1) / 2, zf), (0.052, cy1 - cy0 + 0.1, 0.034), 0.01, M["wood"], TRIM, segs=1, v_axis=1, uv_off=(x, 0.4))
    k.rbox(((cx0 + cx1) / 2, cy1 + 0.026, zf), (cx1 - cx0 + 0.104, 0.052, 0.034), 0.01, M["wood"], TRIM, segs=1, v_axis=0, uv_off=(0.5, 0.2))
    k.rbox(((cx0 + cx1) / 2, cy0 - 0.03, zf + 0.018), (cx1 - cx0 + 0.13, 0.04, 0.075), 0.012, M["wood"], TRIM, segs=1, v_axis=0, uv_off=(0.1, 0.7))
    # The header board and its roundel.
    hy = cy1 + 0.052 + 0.095
    k.rbox(((X0 + X1) / 2, hy, BACK + 0.03), (bx1 - bx0, 0.19, 0.05), 0.01, M["wood"], HEADER, segs=1, v_axis=0, uv_off=(0.3, 0.55))
    rc = Vector(((X0 + X1) / 2, hy, BACK + 0.055))
    rr = 0.105
    n = 18
    rim = [tuple(rc + Vector((math.cos(TAU * j / n) * rr, math.sin(TAU * j / n) * rr, 0.016))) for j in range(n)]
    back = [tuple(rc + Vector((math.cos(TAU * j / n) * rr * 1.04, math.sin(TAU * j / n) * rr * 1.04, 0.0))) for j in range(n)]
    k.ring_grid([back, rim], [[(j / n, 0.0) for j in range(n + 1)], [(j / n, 0.05) for j in range(n + 1)]], M["wood"], "#b48a5c")
    cen = k.vert(tuple(rc + Vector((0, 0, 0.017))))
    vs = [k.vert(p) for p in rim]
    cuv = tile_uv("roundel", 0.5, 0.5)
    for j in range(n):
        j2 = (j + 1) % n
        a, b = TAU * j / n, TAU * j2 / n
        k.face([cen, vs[j], vs[j2]], [cuv, tile_uv("roundel", 0.5 + 0.47 * math.cos(a), 0.5 + 0.47 * math.sin(a)),
                                      tile_uv("roundel", 0.5 + 0.47 * math.cos(b), 0.5 + 0.47 * math.sin(b))], M["cork"], "#ffffff")
    # The roof: two shingled slopes on board decks, a round ridge pole, barge boards on the gables.
    for side in (1, -1):
        R, mid, out, L = roof_frame(side)
        k.rbox(tuple(mid - out * 0.012), (X1 - X0 + 0.16, 0.026, L + 0.04), 0.008, M["wood"], "#8f6a49", rot=R, segs=1, v_axis=0)
        k.rbox(tuple(mid + out * 0.012), (X1 - X0 + 0.18, 0.022, L + 0.05), 0.006, M["shingle"], ROOF, rot=R, segs=1, v_axis=2, uv_len=L + 0.05, uv_off=(0.37, 0.5))
        for x in (X0 - 0.075, X1 + 0.075):
            k.rbox((x, mid.y - out.y * 0.03, mid.z - out.z * 0.03), (0.03, 0.075, L + 0.02), 0.008, M["wood"], TRIM, rot=R, segs=1)
    k.tube([(X0 - 0.11, RIDGE_Y + 0.02, ZC), (X1 + 0.11, RIDGE_Y + 0.02, ZC)], 0.036, M["wood"], "#7d5a3c", n=8, v_len=0.6, caps=True, u_tiles=0.5)
    # Papers on the cork, a little askew, a pin in each.
    papers = ([("notes", 0.4, 1.12, 0.26, 0.32, -0.06), ("blank", 0.78, 1.2, 0.22, 0.17, 0.05), ("notes", 1.12, 1.06, 0.3, 0.36, 0.04),
               ("notes", 0.74, 0.84, 0.24, 0.26, -0.03)] if kind == "notice" else
              [("fish", 0.44, 1.08, 0.3, 0.28, 0.05), ("notes", 0.86, 1.14, 0.24, 0.3, -0.04), ("fish", 1.24, 0.98, 0.28, 0.26, -0.06),
               ("blank", 0.8, 0.8, 0.18, 0.14, 0.08)])
    tints = ["#fbf3e2", "#f6e7b8", "#f3dfcf", "#e6eccf"]
    pins = ["#c4472f", "#d9a23a", "#4f8a83", "#c4472f"]
    flat = []
    for i, (tile, px, py, pw, ph, ang) in enumerate(papers):
        c, s = math.cos(ang), math.sin(ang)
        z = zf + 0.003 + 0.0015 * i
        corners = [(-pw / 2, -ph / 2), (pw / 2, -ph / 2), (pw / 2, ph / 2), (-pw / 2, ph / 2)]
        span = max(pw, ph)
        uvs = [tile_uv(tile, 0.5 + x / span, 0.5 + y / span) for x, y in corners]
        k.quad([(px + x * c - y * s, py + x * s + y * c, z) for x, y in corners], M["cork"], tints[i % 4], uvs=uvs)
        top = (px - (ph / 2 - 0.03) * s, py + (ph / 2 - 0.03) * c, z)
        flat += k.blob((top[0], top[1], z + 0.012), (0.017, 0.017, 0.013), M["cork"], pins[i], segs=8, rings=4)
        flat += k.tube([(top[0], top[1], z), (top[0], top[1], z + 0.012)], 0.004, M["cork"], "#b9b2a6", n=4)
    # The pins' COLOR_0 reads through the middle of the blank paper tile.
    blank = tile_uv("blank", 0.5, 0.5)
    for f in flat:
        for lp in f.loops:
            lp[k.uv].uv = blank
    k.tint_gradient(0.84, 1.0)
    ob = k.finish(smooth_deg=50)
    path = K.export([ob], f"game/props/{kind}-board.glb")
    print("PLAZA_BOARD", kind, {"back": BACK, "cork": CORK, "top": RIDGE_Y + 0.056})
    return [ob], path


TAU = math.tau

if __name__ == "__main__":
    for kind in ("notice", "catch"):
        obs, path = build(kind)
        if "review" in ARGS:
            K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], f"{kind}-board.png"), views=((180, 12), (215, 24), (330, 22)))
