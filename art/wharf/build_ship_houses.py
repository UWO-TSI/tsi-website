"""The new world's ship houses (game/wharf-art2; David's R2c note on the night wharf, 2026-10-26: "there should be
different ship houses, it should be build on the side of the wharf and face inwards"), after the stilt houses of
specs/references/terrain/plan-2026-10-23/wharf-3.jpg and the red board hut of r2-2026-10-26/dock-fish-hut.jpg. Four
different boathouses and fishing huts in the wharf's style, each built to straddle the deck's water edge: the front
half on the boards, the back half out over the sea on piles. Nobody enters them in v1.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_ship_houses.py [-- review <dir>]

Writes, under web/public/assets/game/wharf/, each in game units at scale 1, the origin on the deck's top (y 0) at the
middle of the house's floor, its front (the door) to +z, facing in; its back toward -z over the water:
  ship-house-a.glb  the red boathouse: red boards, a blue tiled gable to the front, a door with a porthole, a window
                    box of flowers, a stove pipe, a life ring; at the back a wide boat door open over the water.
  ship-house-b.glb  the stilt house: blue-grey boards, a red tiled roof along x, shuttered windows, a balcony on piles
                    off its +x side with a ladder down to the sea, crates by the door.
  ship-house-c.glb  the net loft: two storeys of ochre lap boards under a steep grey-green gable, barn doors below, a
                    loft door with a hoist beam and pulley above, a net with floats hung on its +x wall.
  ship-house-d.glb  the shack: sea-green boards under one long plank roof falling to the back, a sign board over a
                    yellow door, a bench on its little porch, crossed oars on the wall, fish drying on a line.

Its floor is a platform of planks at the deck's top on piles that run down to y -3.4, wet under the sea (y -1.08, as
the wharf kit's). Wood is the wharf's grain under COLOR_0 (art/wharf/build_wharf_kit.py wood_mat), roofs included;
rope its rope; the net the dock decor's; the rest the shared plain presets (P_Paint, P_Glass, P_Metal). Seeded.
"""
import math, os, sys
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, HERE)
import propkit as K  # noqa: E402
from build_wharf_kit import DARK, LIGHT, WATER, mix, report, wet, wood_mat  # noqa: E402
from build_dock_decor import FLOAT_CREAM, FLOAT_RED, ROPE, coil, crate, float_ball, lashing, net_texture, ring_into  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/wharf/"
rng = np.random.default_rng(2720)
FLOOR = 0.03                          # the platform's top: a hair over the deck's boards (0.01)
PILE_FOOT = -3.4
BEAM, TRIM_DARK = "#5a3b26", "#3e2a1c"


def frame(along, down):
    """A right-handed rbox frame: local x along the row, y the face's normal (up-ish), z down the slope."""
    a, d = Vector(along).normalized(), Vector(down).normalized()
    n = d.cross(a)
    if n.y < 0:
        a, n = -a, -n
    return Matrix((a, n, d)).transposed()


class Wall:
    """A wall's frame: its middle on the floor at c, its outward normal at turn `yaw` (0 faces +z); a runs along it."""

    def __init__(self, c, yaw):
        self.c, self.yaw = Vector(c), yaw
        self.t = Vector((math.cos(yaw), 0, -math.sin(yaw)))
        self.n = Vector((math.sin(yaw), 0, math.cos(yaw)))
        self.rot = K.game_rot(yaw=yaw)

    def p(self, a, y, o=0.0):
        return tuple(self.c + self.t * a + Vector((0, y, 0)) + self.n * o)


def boards(k, M, w, half, lo, top_of, col, skip=(), pitch=0.42, out=0.0):
    """Upright boards along wall w from -half to half, lo up to top_of(a), round the openings [(a0, a1, y0, y1)]."""
    n = max(1, int(round(2 * half / pitch)))
    for i in range(n):
        a = -half + (i + 0.5) * 2 * half / n
        spans = [(lo, top_of(a) + rng.uniform(-0.03, 0.03))]
        for a0, a1, y0, y1 in skip:
            if a0 < a < a1:
                spans = [s for l_, h_ in spans for s in ((l_, min(h_, y0)), (max(l_, y1), h_)) if s[1] - s[0] > 0.05]
        c_ = mix(col[0], col[1], rng.uniform(0, 1))
        for l_, h_ in spans:
            k.rbox(w.p(a, (l_ + h_) / 2, out + rng.uniform(-0.008, 0.008)), (2 * half / n - 0.025, h_ - l_, 0.08), 0.0, M, c_, rot=w.rot,
                   segs=1, uv_len=1.6, v_axis=1, uv_off=(rng.random(), rng.random()))


def lap(k, M, w, half, lo, hi, col, skip=(), row=0.24):
    """Lap boards along wall w: rows from lo to hi, each lower edge kicked out over the row beneath."""
    rot = w.rot @ Matrix.Rotation(-0.07, 3, "X")
    y = lo
    while y < hi - 0.05:
        h = min(row, hi - y)
        cuts = [(-half, half)]
        for a0, a1, y0, y1 in skip:
            if y < y1 and y + h > y0:
                cuts = [s for l_, h_ in cuts for s in ((l_, min(h_, a0)), (max(l_, a1), h_)) if s[1] - s[0] > 0.05]
        c_ = mix(col[0], col[1], rng.uniform(0, 1))
        for a0, a1 in cuts:
            k.rbox(w.p((a0 + a1) / 2, y + h / 2, 0.02), (a1 - a0, h + 0.03, 0.06), 0.0, M, c_, rot=rot, segs=1, uv_len=1.6, v_axis=0,
                   uv_off=(rng.random(), rng.random()))
        y += h


def post(k, M, p0, p1, w=0.18, col=BEAM, r=0.02):
    k.beam(p0, p1, w, w, r, M, mix(col, LIGHT, rng.uniform(0, 0.2)), up=(0, 0, 1), segs=1, uv_len=1.6)


def frame_box(k, M, w, a, y, width, h, col, th=0.08, out=0.03):
    """A frame round an opening (a, y its middle) on wall w."""
    for s in (-1, 1):
        k.rbox(w.p(a + s * width / 2, y, out), (th, h + th, 0.07), 0.01, M, col, rot=w.rot, segs=1)
        k.rbox(w.p(a, y + s * h / 2, out), (width + th * 2, th, 0.07), 0.01, M, col, rot=w.rot, segs=1)


def window(k, M, Mg, w, a, y, width, h, trim, shutter=None, box=None, Mp=None):
    k.rbox(w.p(a, y, -0.02), (width, h, 0.03), 0.0, Mg, "#8fb8c6", rot=w.rot, segs=1)
    frame_box(k, M, w, a, y, width, h, trim)
    k.rbox(w.p(a, y, 0.01), (0.045, h, 0.04), 0.0, M, trim, rot=w.rot, segs=1)
    k.rbox(w.p(a, y, 0.01), (width, 0.045, 0.04), 0.0, M, trim, rot=w.rot, segs=1)
    if shutter:
        for s in (-1, 1):
            k.rbox(w.p(a + s * (width / 2 + 0.06 + width / 4), y, 0.06), (width / 2, h, 0.05), 0.01, M, mix(shutter, "#20303a", rng.uniform(0, 0.2)),
                   rot=w.rot, segs=1, uv_len=1.0, v_axis=1)
    if box:                                         # a window box of flowers
        k.rbox(w.p(a, y - h / 2 - 0.13, 0.16), (width + 0.1, 0.18, 0.24), 0.015, M, trim, rot=w.rot, segs=1)
        for i in range(5):
            aa = a - width / 2 + (i + 0.5) * width / 5
            k.blob(w.p(aa, y - h / 2 - 0.02, 0.16), (0.11, 0.09, 0.1), Mp, "#5f9a4a", segs=6, rings=4, seed=i, lumpy=0.3)
            k.blob(w.p(aa + 0.03, y - h / 2 + 0.06, 0.2), (0.05, 0.05, 0.05), Mp, box[i % len(box)], segs=5, rings=3)


def door(k, M, Mp, Mg, w, a, width, h, col, trim, porthole=False, leaves=1):
    for i in range(3 * leaves):
        k.rbox(w.p(a - width / 2 + (i + 0.5) * width / (3 * leaves), h / 2 + FLOOR, 0.0), (width / (3 * leaves) - 0.02, h, 0.06), 0.01, M,
               mix(col, "#20303a", 0.12 * (i % 2)), rot=w.rot, segs=1, uv_len=1.2, v_axis=1)
    frame_box(k, M, w, a, h / 2 + FLOOR, width, h, trim, out=0.04)
    for y in (0.45, h - 0.4):
        k.rbox(w.p(a, y, 0.045), (width - 0.1, 0.06, 0.02), 0.0, Mp, "#3d3936", rot=w.rot, segs=1)
    k.blob(w.p(a + width / 2 - 0.13 if leaves == 1 else a + 0.1, 1.0, 0.07), (0.04, 0.04, 0.04), Mp, "#c9a24a", segs=5, rings=3)
    if porthole:
        k.lathe(w.p(a, h * 0.72, 0.03), [(0.0, 0.0), (0.17, 0.0), (0.17, 0.05), (0.0, 0.05)], Mp, "#c79a3c", d=tuple(w.n), n=10)
        k.lathe(w.p(a, h * 0.72, 0.081), [(0.0, 0.0), (0.12, 0.0)], Mg, "#8fb8c6", d=tuple(w.n), n=10)


def slope(k, M, T, E, along, half, rows, cols, colours, seed, thick=0.07, lift=0.04, step=0.025):
    """Shingles or tiles in staggered rows from the top line through T down to the eave line through E (both at the
    slope's middle), the rows `half` either side along `along`, each a little askew."""
    g = np.random.default_rng(seed)
    T, E, A = Vector(T), Vector(E), Vector(along).normalized()
    R0 = frame(A, E - T)
    nrm = R0.col[1]
    L = (E - T).length
    w = 2 * half / cols
    for i in range(rows):
        t = (i + 0.55) / rows
        edges = sorted({min(half, max(-half, -half + (j - 0.5 * (i % 2)) * w)) for j in range(cols + 2)})
        for a0, a1 in zip(edges, edges[1:]):
            if a1 - a0 < 0.1:
                continue
            c = T + (E - T) * t + nrm * (lift + step * (i % 2) + g.uniform(0, 0.02)) + A * ((a0 + a1) / 2)
            jit = Matrix.Rotation(g.uniform(-0.06, 0.06), 3, "Z") @ Matrix.Rotation(g.uniform(-0.05, 0.05), 3, "Y") @ Matrix.Rotation(g.uniform(-0.06, 0.02), 3, "X")
            col = mix(colours[int(g.integers(0, len(colours)))], "#ffffff", g.uniform(0, 0.12))
            k.rbox(tuple(c), (a1 - a0 - 0.03, thick, L / rows + 0.12), 0.0, M, col, rot=R0 @ jit, segs=1, uv_len=0.8, v_axis=2,
                   uv_off=(g.random(), g.random()))


def gable(k, M, c, along, half_len, half_span, eave_y, ridge_y, rows, cols, colours, seed, barge=BEAM):
    """A gabled roof: its ridge through c along `along` (half_len either side), the eaves half_span out either side; a
    ridge cap and barge boards at both ends."""
    c, A = Vector(c), Vector(along).normalized()
    N = Vector((-A.z, 0, A.x))
    T = c + Vector((0, ridge_y, 0))
    for s in (-1, 1):
        slope(k, M, T, c + N * s * half_span + Vector((0, eave_y, 0)), A, half_len, rows, cols, colours, seed + s)
    k.beam(tuple(T - A * (half_len + 0.12) + Vector((0, 0.1, 0))), tuple(T + A * (half_len + 0.12) + Vector((0, 0.1, 0))), 0.26, 0.16, 0.03, M,
           mix(colours[0], "#000000", 0.25), segs=1, uv_len=2.0)
    for e in (-1, 1):
        for s in (-1, 1):
            k.beam(tuple(T + A * e * (half_len + 0.05) + Vector((0, 0.06, 0))), tuple(c + A * e * (half_len + 0.05) + N * s * half_span + Vector((0, eave_y - 0.06, 0))),
                   0.08, 0.18, 0.015, M, barge, up=tuple(A), segs=1)


def platform(k, M, W, D, over=0.25):
    """The floor: planks along x over the house and a little round it at the deck's top, a rim joist, piles under it
    down into the sea (front ones into the deck's own ground), braced under the back."""
    n = int(round((D + 2 * over) / 0.4))
    for i in range(n):
        z = -D / 2 - over + (i + 0.5) * (D + 2 * over) / n
        k.rbox((rng.uniform(-0.03, 0.03), FLOOR - 0.05, z), (W + 2 * over - rng.uniform(0, 0.1), 0.1, (D + 2 * over) / n - 0.03), 0.015, M,
               mix(DARK, LIGHT, rng.uniform(0.25, 0.9)), segs=1, uv_len=2.0, v_axis=0, uv_off=(rng.random(), rng.random()))
    for z in (-D / 2 - over + 0.05, D / 2 + over - 0.05):
        k.rbox((0, FLOOR - 0.2, z), (W + 2 * over, 0.2, 0.12), 0.02, M, mix(DARK, "#4a3624", 0.5), segs=1, uv_len=2.0, v_axis=0)
    xs = (-W / 2 - over + 0.15, 0.0, W / 2 + over - 0.15)
    for x in xs:
        for z in (-D / 2 - over + 0.15, -0.35):
            pile(k, M, x, z)
    zb = -D / 2 - over + 0.15
    for x0, x1 in zip(xs, xs[1:]):
        k.beam((x0, -0.25, zb), (x1, -1.0, zb), 0.1, 0.08, 0.01, M, mix(DARK, "#4a3624", 0.3), up=(0, 0, 1), segs=1)
        k.beam((x0, -1.0, zb), (x1, -0.25, zb), 0.1, 0.08, 0.01, M, mix(DARK, "#4a3624", 0.3), up=(0, 0, 1), segs=1)


def pile(k, M, x, z, top=FLOOR - 0.1, r=0.15):
    k.lathe((x, 0, z), [(0.0, PILE_FOOT), (r * 1.05, PILE_FOOT), (r, -1.0), (r, top - 0.05), (r * 0.85, top), (0.0, top)], M,
            mix(DARK, LIGHT, rng.uniform(0.1, 0.4)), n=8, v_len=1.2, wobble=lambda kk, i: 1 + 0.04 * math.sin(kk * 2.1 + x * 3 + z))


def corners(k, M, W, D, H, col):
    for sx in (-1, 1):
        for sz in (-1, 1):
            post(k, M, (sx * W / 2, FLOOR, sz * D / 2), (sx * W / 2, H + 0.05, sz * D / 2), w=0.16, col=col)


def lantern(k, Mp, Mg, w, a, y):
    """A wall lantern on a bracket (its glass a warm glow at night is the lamp lane's; here it's glass)."""
    k.beam(w.p(a, y + 0.25, 0.0), w.p(a, y + 0.25, 0.32), 0.04, 0.04, 0.0, Mp, "#3d3936", segs=1)
    k.lathe(w.p(a, y, 0.32), [(0.0, -0.16), (0.09, -0.16), (0.09, -0.13), (0.0, -0.13)], Mp, "#3d3936", n=6)
    k.lathe(w.p(a, y, 0.32), [(0.08, -0.13), (0.08, 0.1)], Mg, "#f3d88a", n=6)
    k.lathe(w.p(a, y, 0.32), [(0.0, 0.1), (0.11, 0.1), (0.0, 0.24)], Mp, "#3d3936", n=6)


# ================================================================ a: the red boathouse
def house_a(M, Mp, Mg, Mr, Mm):
    k = K.Kit("ship-house-a")
    W, D, H, RID = 4.0, 4.4, 2.5, 4.3
    RED = ("#b8543e", "#8f3d2c")
    TRIM, ROOF = "#efe6d6", ("#3f7fb8", "#4f93c8", "#356da3", "#4a86bd")
    platform(k, M, W, D)
    front, back, left, right = Wall((0, 0, D / 2), 0), Wall((0, 0, -D / 2), math.pi), Wall((-W / 2, 0, 0), -math.pi / 2), Wall((W / 2, 0, 0), math.pi / 2)
    top = lambda a: H + (RID - H - 0.15) * (1 - abs(a) / (W / 2 + 0.4))
    boards(k, M, front, W / 2, FLOOR, top, RED, skip=[(-1.45, -0.45, 0, 2.05), (0.35, 1.35, 1.05, 1.95)])
    boards(k, M, back, W / 2, FLOOR, top, RED, skip=[(-1.35, 1.35, 0, 2.2)])
    for w in (left, right):
        boards(k, M, w, D / 2, FLOOR, lambda a: H, RED, skip=[(-0.5, 0.5, 1.1, 1.85)] if w is left else [])
    corners(k, M, W, D, H, TRIM)
    for w in (front, back):
        k.rbox(w.p(0, H, 0.05), (W + 0.1, 0.12, 0.06), 0.01, M, TRIM, rot=w.rot, segs=1)
    door(k, M, Mm, Mg, front, -0.95, 0.95, 1.95, "#4f8f94", TRIM, porthole=True)
    window(k, M, Mg, front, 0.85, 1.5, 0.95, 0.85, TRIM, box=("#e8553c", "#f2c94c", "#ef8aa8"), Mp=Mp)
    window(k, M, Mg, left, 0.0, 1.48, 0.95, 0.72, TRIM, shutter="#4f8f94")
    # The boat door at the back, open over the water: two leaves swung out, a beam over it, a hoist hook.
    for s in (-1, 1):
        lw = Wall(back.p(s * 1.35, 0, 0.5), math.pi / 2)
        for i in range(3):
            k.rbox(lw.p((i - 1) * 0.44, 1.12, 0.0), (0.42, 2.2, 0.06), 0.01, M, mix("#4f8f94", "#20303a", 0.1 * i),
                   rot=lw.rot, segs=1, uv_len=1.2, v_axis=1)
    k.beam(back.p(-1.6, 2.25, 0.08), back.p(1.6, 2.25, 0.08), 0.16, 0.18, 0.02, M, BEAM, segs=1)
    k.beam(back.p(0, RID - 0.6, 0.0), back.p(0, RID - 0.6, 1.1), 0.14, 0.16, 0.02, M, BEAM, segs=1)
    k.tube([back.p(0, RID - 0.68, 1.0), back.p(0, 2.6, 1.0)], 0.016, Mr, ROPE, n=4, v_len=0.12)
    k.tube([back.p(0, 2.6, 1.0), back.p(0.02, 2.45, 1.0), back.p(-0.07, 2.4, 1.0)], 0.02, Mm, "#5d6168", n=5, caps=True)
    gable(k, M, (0, 0, 0), (0, 0, 1), D / 2 + 0.35, W / 2 + 0.45, H - 0.15, RID, 6, 9, ROOF, 11, barge=TRIM)
    # A stove pipe through the +x slope, a life ring by the door, a lantern over it, a rope coil and a crate.
    px, pz = 1.1, -1.0
    py = H - 0.15 + (RID - H + 0.15) * (1 - px / (W / 2 + 0.45))
    k.lathe((px, py - 0.2, pz), [(0.0, 0.0), (0.12, 0.0), (0.12, 0.95), (0.16, 0.95), (0.16, 1.1), (0.0, 1.1)], Mm, "#6a6763", n=10)
    ring_into(k, Mp, Mr, c=front.p(-1.75, 0.75, 0.07), s=0.62)
    lantern(k, Mm, Mg, front, -0.95, 2.35)
    coil(k, Mr, (1.6, FLOOR, D / 2 + 0.05), r1=0.2)
    k.tint_gradient(0.84, 1.0, 0.0, RID)
    wet(k)
    return k.finish(smooth_deg=40)


# ================================================================ b: the stilt house
def house_b(M, Mp, Mg, Mr, Mm):
    k = K.Kit("ship-house-b")
    W, D, H, RID = 4.6, 3.8, 2.4, 3.95
    WALL, TRIM = ("#7f98a6", "#5d7482"), "#e9e2d2"
    ROOF = ("#c8483c", "#d65a44", "#b13d33", "#cf5240")
    platform(k, M, W, D)
    front, back, left, right = Wall((0, 0, D / 2), 0), Wall((0, 0, -D / 2), math.pi), Wall((-W / 2, 0, 0), -math.pi / 2), Wall((W / 2, 0, 0), math.pi / 2)
    gtop = lambda a: H + (RID - H - 0.12) * (1 - abs(a) / (D / 2 + 0.55))
    boards(k, M, front, W / 2, FLOOR, lambda a: H, WALL, skip=[(-0.45, 0.45, 0, 2.0), (-1.75, -0.85, 1.05, 1.85), (0.85, 1.75, 1.05, 1.85)])
    boards(k, M, back, W / 2, FLOOR, lambda a: H, WALL, skip=[(-0.5, 0.5, 1.05, 1.8)])
    boards(k, M, left, D / 2, FLOOR, gtop, WALL)
    boards(k, M, right, D / 2, FLOOR, gtop, WALL, skip=[(-0.2, 0.7, 0, 1.95)])
    corners(k, M, W, D, H, TRIM)
    door(k, M, Mm, Mg, front, 0.0, 0.9, 1.95, "#e8d9b8", TRIM)
    for a in (-1.3, 1.3):
        window(k, M, Mg, front, a, 1.45, 0.9, 0.8, TRIM, shutter="#c8483c")
    window(k, M, Mg, back, 0.0, 1.42, 0.95, 0.75, TRIM)
    door(k, M, Mm, Mg, right, 0.25, 0.85, 1.9, "#e8d9b8", TRIM)
    gable(k, M, (0, 0, 0), (1, 0, 0), W / 2 + 0.45, D / 2 + 0.55, H - 0.12, RID, 5, 10, ROOF, 21, barge=TRIM)
    # The balcony off the +x side, over the water: boards on its own piles, a rail, a ladder down to the sea.
    bx0, bx1, bz0, bz1 = W / 2 + 0.25, W / 2 + 1.9, -D / 2 - 0.25, 0.9
    for i in range(5):
        x = bx0 + (i + 0.5) * (bx1 - bx0) / 5
        k.rbox((x, FLOOR - 0.05, (bz0 + bz1) / 2), ((bx1 - bx0) / 5 - 0.03, 0.1, bz1 - bz0), 0.015, M, mix(DARK, LIGHT, rng.uniform(0.3, 0.9)),
               segs=1, uv_len=2.0, v_axis=2)
    for x, z in ((bx1 - 0.12, bz0 + 0.12), (bx1 - 0.12, bz1 - 0.12)):
        pile(k, M, x, z, top=1.0, r=0.12)
    for x0, z0, x1, z1 in ((bx1 - 0.12, bz0 + 0.12, bx1 - 0.12, bz1 - 0.12), (bx0, bz0 + 0.12, bx1 - 0.12, bz0 + 0.12)):
        k.beam((x0, 0.95, z0), (x1, 0.95, z1), 0.08, 0.08, 0.01, M, TRIM, segs=1)
        k.beam((x0, 0.5, z0), (x1, 0.5, z1), 0.06, 0.06, 0.01, M, TRIM, segs=1)
    post(k, M, (bx0 + 0.05, FLOOR, bz0 + 0.12), (bx0 + 0.05, 1.0, bz0 + 0.12), w=0.1, col=TRIM)
    lx, lz = bx1 - 0.6, bz0 - 0.03
    for s in (-1, 1):
        k.beam((lx + s * 0.22, 0.75, lz), (lx + s * 0.22, -1.9, lz - 0.05), 0.06, 0.06, 0.01, M, mix(DARK, LIGHT, 0.5), up=(0, 0, 1), segs=1)
    for i in range(6):
        y = 0.4 - i * 0.42
        k.beam((lx - 0.22, y, lz - 0.02), (lx + 0.22, y, lz - 0.02), 0.05, 0.05, 0.0, M, mix(DARK, LIGHT, 0.6), segs=1)
    coil(k, Mr, (bx0 + 0.9, FLOOR, 0.3), r1=0.22)
    crate(k, M, (-1.9, FLOOR, D / 2 + 0.55), 0.55, 0.5)
    crate(k, M, (-1.35, FLOOR, D / 2 + 0.6), 0.45, 0.4)
    crate(k, M, (-1.85, FLOOR + 0.5, D / 2 + 0.55), 0.42, 0.38)
    lantern(k, Mm, Mg, front, 0.75, 2.05)
    k.tint_gradient(0.84, 1.0, 0.0, RID)
    wet(k)
    return k.finish(smooth_deg=40)


# ================================================================ c: the net loft
def house_c(M, Mp, Mg, Mr, Mm, Mn):
    k = K.Kit("ship-house-c")
    W, D, H, RID = 3.6, 3.8, 3.9, 6.1
    WALL, TRIM, ROOF = ("#d2a24a", "#b9862f"), "#6f4a2e", ("#5f7f78", "#6d8f86", "#516d68", "#668a80")
    platform(k, M, W, D)
    front, back, left, right = Wall((0, 0, D / 2), 0), Wall((0, 0, -D / 2), math.pi), Wall((-W / 2, 0, 0), -math.pi / 2), Wall((W / 2, 0, 0), math.pi / 2)
    gtop = lambda a: H + (RID - H - 0.12) * (1 - abs(a) / (W / 2 + 0.3))
    lap(k, M, front, W / 2, FLOOR, H, WALL, skip=[(-1.0, 1.0, 0, 2.15), (-0.5, 0.5, 2.55, 3.85)])
    boards(k, M, front, W / 2, H, gtop, WALL, skip=[(-0.5, 0.5, 2.55, 4.3)], out=0.02)
    lap(k, M, back, W / 2, FLOOR, H, WALL, skip=[(-0.45, 0.45, 2.6, 3.4)])
    boards(k, M, back, W / 2, H, gtop, WALL, out=0.02)
    lap(k, M, left, D / 2, FLOOR, H, WALL, skip=[(-0.4, 0.4, 1.1, 1.8)])
    lap(k, M, right, D / 2, FLOOR, H, WALL)
    corners(k, M, W, D, H, TRIM)
    for w, half in ((front, W / 2), (back, W / 2), (left, D / 2), (right, D / 2)):
        k.rbox(w.p(0, 2.3, 0.07), (2 * half + 0.1, 0.12, 0.06), 0.01, M, TRIM, rot=w.rot, segs=1)      # the floor line
    door(k, M, Mm, Mg, front, 0.0, 2.0, 2.1, "#7a5434", TRIM, leaves=2)
    k.beam(front.p(-0.95, 0.15, 0.07), front.p(0.95, 2.05, 0.07), 0.08, 0.05, 0.01, M, TRIM, segs=1)
    k.beam(front.p(0.95, 0.15, 0.07), front.p(-0.95, 2.05, 0.07), 0.08, 0.05, 0.01, M, TRIM, segs=1)
    # The loft door upstairs, half open, the hoist beam out over it, a pulley and the rope down.
    k.rbox(front.p(0, 3.2, -0.03), (1.0, 1.3, 0.03), 0.0, M, "#2f2a26", rot=front.rot, segs=1)
    frame_box(k, M, front, 0, 3.2, 1.0, 1.3, TRIM)
    lw = Wall(front.p(0.5, 0, 0.45), math.pi / 2 - 0.25)
    for i in range(2):
        k.rbox(lw.p(-0.24 + i * 0.48 - 0.0, 3.2, 0.0), (0.46, 1.28, 0.06), 0.01, M, mix("#7a5434", "#5a3b26", 0.3 * i), rot=lw.rot, segs=1)
    k.beam(front.p(0, RID - 0.75, -0.4), front.p(0, RID - 0.75, 1.15), 0.18, 0.2, 0.02, M, TRIM, segs=1)
    py = RID - 0.95
    k.lathe(front.p(0, py, 1.0), [(0.0, -0.03), (0.1, -0.03), (0.08, 0.0), (0.1, 0.03), (0.0, 0.03)], Mm, "#585c62", d=(1, 0, 0), n=10)
    k.tube([front.p(0, py, 1.1), front.p(0, 1.2, 1.1)], 0.016, Mr, ROPE, n=4, v_len=0.12)
    k.tube([front.p(0, 1.2, 1.1), front.p(0.03, 1.08, 1.1), front.p(-0.07, 1.03, 1.1)], 0.02, Mm, "#5d6168", n=5, caps=True)
    window(k, M, Mg, back, 0.0, 3.0, 0.8, 0.7, TRIM)
    window(k, M, Mg, left, 0.0, 1.45, 0.8, 0.7, TRIM, shutter="#5f7f78")
    gable(k, M, (0, 0, 0), (0, 0, 1), D / 2 + 0.35, W / 2 + 0.3, H - 0.12, RID, 7, 8, ROOF, 31, barge=TRIM)
    # A net hung on the +x wall from two pegs, floats along its top; a net heap and floats at its foot.
    xw = W / 2 + 0.1
    pts = [(xw, 2.2 - 0.25 * math.sin(math.pi * (z + 1.4) / 2.8) + 0.12, z) for z in np.linspace(-1.4, 1.4, 9)]
    vs_top = [k.vert(p) for p in pts]
    vs_bot = [k.vert((xw + 0.04, 0.55 + 0.08 * math.sin(i * 1.7), p[2] * 0.9)) for i, p in enumerate(pts)]
    for i in range(len(pts) - 1):
        k.face([vs_bot[i], vs_bot[i + 1], vs_top[i + 1], vs_top[i]],
               [(i * 0.4, 0.0), ((i + 1) * 0.4, 0.0), ((i + 1) * 0.4, 1.8), (i * 0.4, 1.8)], Mn, "#ffffff")
    k.tube(pts, 0.02, Mr, ROPE, n=4, v_len=0.12)
    for i, p in enumerate(pts[1:-1:2]):
        float_ball(k, Mp, (p[0] + 0.05, p[1] - 0.02, p[2]), 0.075, FLOAT_RED if i % 2 == 0 else FLOAT_CREAM)
    for z in (-1.4, 1.4):
        k.rbox((xw, 2.3, z), (0.12, 0.06, 0.06), 0.01, M, TRIM, segs=1)
    k.blob((xw + 0.35, FLOOR, 0.3), (0.4, 0.2, 0.55), Mn, "#eeeeee", segs=10, rings=5, seed=4, lumpy=0.4, flat_bottom=0.0, uv_tiles=(4, 2))
    k.tint_gradient(0.84, 1.0, 0.0, RID)
    wet(k)
    return k.finish(smooth_deg=40)


# ================================================================ d: the shack
def house_d(M, Mp, Mg, Mr, Mm):
    k = K.Kit("ship-house-d")
    W, D, HF, HB = 4.0, 3.2, 3.0, 2.2
    WALL, TRIM = ("#5f9a8a", "#4a7d70"), "#e9e2d2"
    platform(k, M, W, D + 0.9, over=0.2)                      # a porch along the front
    zf = D / 2 - 0.45
    front, back, left, right = Wall((0, 0, zf), 0), Wall((0, 0, -D / 2 - 0.45), math.pi), Wall((-W / 2, 0, -0.45), -math.pi / 2), Wall((W / 2, 0, -0.45), math.pi / 2)
    zr0, zr1, y0, y1 = zf + 1.0, -D / 2 - 0.85, HF + 0.12, HB - 0.05          # the roof's front and back edges
    under = lambda z: y0 + (y1 - y0) * (zr0 - z) / (zr0 - zr1) - 0.06
    boards(k, M, front, W / 2, FLOOR, lambda a: under(zf), WALL, skip=[(-0.2, 0.7, 0, 1.95), (-1.6, -0.6, 1.1, 1.85)])
    boards(k, M, back, W / 2, FLOOR, lambda a: under(-D / 2 - 0.45), WALL, skip=[(-0.4, 0.4, 1.05, 1.7)])
    boards(k, M, left, D / 2, FLOOR, lambda a: under(a - 0.45), WALL)
    boards(k, M, right, D / 2, FLOOR, lambda a: under(-a - 0.45), WALL)
    for sx in (-1, 1):
        post(k, M, (sx * W / 2, FLOOR, zf), (sx * W / 2, under(zf), zf), w=0.16, col=TRIM)
        post(k, M, (sx * W / 2, FLOOR, -D / 2 - 0.45), (sx * W / 2, under(-D / 2 - 0.45), -D / 2 - 0.45), w=0.16, col=TRIM)
    door(k, M, Mm, Mg, front, 0.25, 0.9, 1.95, "#e2b445", TRIM)
    window(k, M, Mg, front, -1.1, 1.48, 0.95, 0.72, TRIM, shutter="#e2b445")
    window(k, M, Mg, back, 0.0, 1.38, 0.75, 0.62, TRIM)
    # The roof: long planks falling from over the porch to the back, battens across, on a beam on porch posts.
    n = 11
    for i in range(n):
        x = -W / 2 - 0.3 + (i + 0.5) * (W + 0.6) / n
        k.beam((x, y0 + rng.uniform(-0.02, 0.02), zr0 + rng.uniform(-0.05, 0.05)), (x, y1, zr1 + rng.uniform(-0.05, 0.05)), (W + 0.6) / n - 0.02, 0.07, 0.0, M,
               mix("#8d7a66", "#6f5f50", rng.uniform(0, 1)), segs=1, roll=rng.uniform(-0.03, 0.03), uv_len=2.0)
    for t in (0.1, 0.5, 0.9):
        z, y = zr0 + (zr1 - zr0) * t, y0 + (y1 - y0) * t + 0.06
        k.beam((-W / 2 - 0.35, y, z), (W / 2 + 0.35, y, z), 0.12, 0.06, 0.01, M, "#4a3f36", segs=1)
    for sx in (-1, 1):
        post(k, M, (sx * (W / 2 - 0.1), FLOOR, zf + 0.85), (sx * (W / 2 - 0.1), HF + 0.1, zf + 0.85), w=0.14)
    k.beam((-W / 2 - 0.2, HF + 0.05, zf + 0.85), (W / 2 + 0.2, HF + 0.07, zf + 0.85), 0.14, 0.16, 0.02, M, BEAM, segs=1)
    # The sign over the door: a board with a fish and a hook painted on it.
    sy = under(zf) - 0.36
    k.rbox(front.p(0.25, sy, 0.08), (1.5, 0.42, 0.06), 0.02, M, "#e9dcc0", rot=front.rot, segs=1, uv_len=1.5, v_axis=0)
    body = [(0.32 * math.cos(a) - 0.1, 0.12 * math.sin(a)) for a in np.linspace(0, math.tau, 12, endpoint=False)]
    k.extrude(body, 0.115, 0.14, Mp, "#c8483c", bevel=0.008, at=front.p(0.25, sy, 0.0))
    k.extrude([(-0.4, 0.0), (-0.62, -0.14), (-0.58, 0.0), (-0.62, 0.14)][::-1], 0.115, 0.14, Mp, "#c8483c", bevel=0.008, at=front.p(0.25, sy, 0.0))
    k.tube([front.p(0.82, sy + 0.14, 0.13), front.p(0.82, sy - 0.08, 0.13), front.p(0.74, sy - 0.14, 0.13), front.p(0.67, sy - 0.07, 0.13)], 0.018, Mm, "#5d6168", n=5)
    # The porch: a bench, crossed oars on the wall, a line of fish drying between the posts.
    bz = zf + 0.3
    k.rbox((-1.1, 0.45, bz), (1.3, 0.07, 0.36), 0.015, M, mix(DARK, LIGHT, 0.7), segs=1, uv_len=1.5, v_axis=0)
    for x in (-1.65, -0.55):
        k.rbox((x, 0.22, bz), (0.08, 0.44, 0.3), 0.01, M, BEAM, segs=1)
    for s in (-1, 1):
        a0, a1 = front.p(1.45 - s * 0.35, 0.35, 0.06), front.p(1.45 + s * 0.35, 2.35, 0.06)
        k.beam(a0, a1, 0.05, 0.05, 0.01, M, "#c9a072", segs=1)
        blade = Vector(a1) + (Vector(a1) - Vector(a0)).normalized() * 0.22
        k.beam(a1, tuple(blade), 0.16, 0.03, 0.01, M, "#c8483c" if s > 0 else "#e9e2d2", segs=1)
    lz = zf + 0.85
    line = [(-W / 2 + 0.1, 2.35 - 0.12 * math.sin(math.pi * t), lz) for t in np.linspace(0, 1, 7)]
    line = [(x0 + (W - 0.2) * i / 6, y, z) for i, (x0, y, z) in enumerate(line)]
    k.tube(line, 0.012, Mr, ROPE, n=4, v_len=0.12)
    for i, (x, y, z) in enumerate(line[1:-1]):
        hung(k, Mp, (x, y - 0.24, z), 0.4, ("#5f86b5", "#c56a55", "#6aa36b")[i % 3])
    float_ball(k, Mp, front.p(-1.85, 2.2, 0.1), 0.1, FLOAT_RED)
    k.tint_gradient(0.84, 1.0, 0.0, HF)
    wet(k)
    return k.finish(smooth_deg=40)


def hung(k, Mp, c, L, col):
    """A fish hung by its tail: a flat spindle, a forked tail up, eyes."""
    prof = [(0.0, -L / 2), (L * 0.12, -L * 0.38), (L * 0.17, -L * 0.1), (L * 0.11, L * 0.25), (L * 0.05, L * 0.42)]
    k.lathe(c, prof, Mp, col, d=(0, 1, 0), n=6, sz=0.55, up=(0, 0, 1))
    t = Vector(c) + Vector((0, L * 0.42, 0))
    for sx in (-1, 1):
        k.quad([tuple(t), tuple(t + Vector((sx * L * 0.17, L * 0.2, 0))), tuple(t + Vector((0, L * 0.13, 0))), tuple(t + Vector((0, 0, 0.001)))], Mp, mix(col, "#20283a", 0.25))


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    net = K.Mat("M_Net", tex=K.image("net", net_texture()), rough=1.0)
    paint, glass, metal = K.Mat("P_Paint", rough=0.45), K.Mat("P_Glass", rough=0.08), K.Mat("P_Metal", rough=0.4)
    obs = {}
    for name, fn in (("ship-house-a", lambda: house_a(wood, paint, glass, rope, metal)), ("ship-house-b", lambda: house_b(wood, paint, glass, rope, metal)),
                     ("ship-house-c", lambda: house_c(wood, paint, glass, rope, metal, net)), ("ship-house-d", lambda: house_d(wood, paint, glass, rope, metal))):
        ob = fn()
        K.export([ob], f"{OUT}{name}.glb")
        report(ob)
        obs[name] = ob
    return obs


def scene(obs, out, views):
    """The four along a deck edge, the sea behind them."""
    import bpy
    shown = []
    for name, x in (("ship-house-a", -8.5), ("ship-house-b", -2.6), ("ship-house-c", 3.4), ("ship-house-d", 8.6)):
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G(x, 0, 0)
        shown.append(o)
        obs[name].hide_render = True
    me = bpy.data.meshes.new("sea")
    me.from_pydata([K.G(-12, WATER, -6), K.G(12, WATER, -6), K.G(12, WATER, 0.0), K.G(-12, WATER, 0.0)], [], [(0, 1, 2, 3)])
    sea = bpy.data.objects.new("sea", me)
    bpy.context.scene.collection.objects.link(sea)
    me.materials.append(K.Mat("M_Sea", "#5fa7b8", rough=0.3).m)
    me = bpy.data.meshes.new("deck")
    me.from_pydata([K.G(-12, 0.0, -0.2), K.G(12, 0.0, -0.2), K.G(12, 0.0, 5.0), K.G(-12, 0.0, 5.0)], [], [(0, 1, 2, 3)])
    deck = bpy.data.objects.new("deck", me)
    bpy.context.scene.collection.objects.link(deck)
    me.materials.append(K.Mat("M_Deck", "#8a6a4c", rough=0.9).m)
    bpy.context.view_layer.update()
    K.review(shown, out, views=views, size=1000)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        views = tuple(tuple(float(v) for v in a.split(":")) for a in ARGS if ":" in a) or ((200, 26), (330, 20))
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "ship-houses.png"), views)
