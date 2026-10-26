"""The new world's wharf shops (game/wharf-art4; David's R2d note on the ship houses, 2026-10-26: "houses need better use,
maybe one for selling rods/equipment , with a big rod on the roof or smth and one for building ships"). They take the
ship houses' place on the deck's water edge and their frame (art/wharf/build_ship_houses.py): the origin on the deck's
top (y 0) at the middle of the floor, the front (the door) to +z, facing in; the back toward -z over the sea on piles.
Nobody enters them for launch. The playful look of specs/references/terrain/r2-2026-10-26/dock-fish-hut.jpg and
plan-2026-10-23/wharf-fishing-hut-1.jpg: a big object on the roof, bright colours, chunky wood.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_wharf_shops.py [-- review <dir> [az:el ...]]

Writes, under web/public/assets/game/wharf/, in game units at scale 1:
  tackle-shop.glb  rods and fishing gear: turquoise boards under a sunny tiled gable, a giant rod on two crutches along
                   the roof with a big reel at its butt, its line hanging off the front +x corner to a red and white
                   bobber and a lure; a striped awning over a porch with a rack of rods, a lure board on the wall, a
                   serving hatch with a tackle box on its counter, a bait bucket and a landing net by the door.

Wood is the wharf's grain under COLOR_0, rope its rope, the net the dock decor's; the rest the shared plain presets
(P_Paint, P_Glass, P_Metal). Seeded.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, HERE)
import propkit as K  # noqa: E402
from build_wharf_kit import WATER, mix, report, wet, wood_mat  # noqa: E402
from build_dock_decor import ROPE, crate, net_texture  # noqa: E402
from build_ship_houses import FLOOR, Wall, boards, corners, door, gable, lantern, platform, post, window  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/wharf/"
rng = np.random.default_rng(2740)
LINE = "#f4efe6"


def rod(k, Mp, Mm, Mr, pts, r0, r1, col, wraps="#e2b445", n=8, reel_r=0.0, cork=0.0):
    """A fishing rod along the points pts (butt first): a tapering blank with wraps, a cork grip of length `cork` back
    from the butt, a round reel of radius reel_r hung under it just ahead of the grip, guides under the blank. Returns
    the tip."""
    P = [Vector(p) for p in pts]
    m = len(P)
    k.tube([tuple(p) for p in P], r0, Mp, col, n=n, radii=[1 + (r1 / r0 - 1) * i / (m - 1) for i in range(m)], caps=True)
    d0 = (P[1] - P[0]).normalized()
    side = d0.cross(Vector((0, 1, 0))).normalized()
    down = side.cross(d0).normalized() * -1
    if cork:
        k.lathe(tuple(P[0]), [(0.0, -cork - 0.06), (r0 * 1.7, -cork - 0.06), (r0 * 1.9, -cork), (r0 * 1.6, -cork * 0.5), (r0 * 1.8, 0.0),
                              (r0 * 1.1, 0.06), (0.0, 0.06)], Mp, "#c79a62", d=tuple(d0), n=n)
        k.blob(tuple(P[0] - d0 * (cork + 0.07)), (r0 * 2.1, r0 * 2.1, r0 * 2.1), Mp, col, segs=n, rings=4)
    for t in (0.18, 0.45, 0.7, 0.88):                   # wraps, and a guide under each
        i = min(m - 2, int(t * (m - 1)))
        c = P[i] + (P[i + 1] - P[i]) * (t * (m - 1) - i)
        rr = r0 + (r1 - r0) * t
        dd = (P[i + 1] - P[i]).normalized()
        k.lathe(tuple(c), [(rr * 1.25, -rr * 1.2), (rr * 1.25, rr * 1.2)], Mp, wraps, d=tuple(dd), n=n)
        g = c + down * (rr * 2.2 + 0.02)
        ring = [tuple(g + side * math.cos(a) * rr * 1.3 + down * math.sin(a) * rr * 1.3) for a in np.linspace(0, math.tau, 6, endpoint=False)]
        k.tube(ring, rr * 0.25 + 0.004, Mm, "#c9ccd0", n=4, closed_path=True)
    if reel_r:
        c = P[0] + d0 * reel_r * 0.9 + down * (reel_r + r0 * 1.2)
        k.beam(tuple(P[0] + d0 * reel_r * 0.9 + down * r0), tuple(c), r0 * 0.8, r0 * 0.6, 0.0, Mm, "#3d3936", segs=1)
        w = reel_r * 0.65
        k.lathe(tuple(c), [(0.0, -w / 2), (reel_r, -w / 2), (reel_r * 1.04, -w / 2 + w * 0.15), (reel_r * 0.8, -w * 0.3), (reel_r * 0.8, w * 0.3),
                           (reel_r * 1.04, w / 2 - w * 0.15), (reel_r, w / 2), (0.0, w / 2)], Mm, "#d2a33c", d=tuple(side), n=max(10, n + 4))
        k.lathe(tuple(c), [(reel_r * 0.82, -w * 0.28), (reel_r * 0.82, w * 0.28)], Mr, LINE, d=tuple(side), n=max(10, n + 4))
        hub = c + side * (w / 2 + reel_r * 0.06)
        arm = hub + d0 * reel_r * 0.85
        k.beam(tuple(hub), tuple(arm), reel_r * 0.16, reel_r * 0.1, 0.0, Mm, "#3d3936", up=tuple(side), segs=1)
        k.lathe(tuple(arm), [(0.0, 0.0), (reel_r * 0.17, 0.0), (reel_r * 0.19, reel_r * 0.3), (0.0, reel_r * 0.36)], Mp, "#c8483c", d=tuple(side), n=6)
    return P[-1]


def lure(k, Mp, Mm, top, L, col, belly="#f4efe6", yaw=0.0, hook=True, n=8):
    """A plug lure hung nose up from `top`: a plump spindle, eyes; big ones (hook) a pale belly, a clear lip at the nose
    and a hook at the tail."""
    T = Vector(top)
    d = Vector((0, -1, 0))
    f, sd = Vector((math.sin(yaw), 0, math.cos(yaw))), Vector((math.cos(yaw), 0, -math.sin(yaw)))
    k.lathe(tuple(T + d * 0.02), [(0.0, 0.0), (L * 0.12, L * 0.08), (L * 0.17, L * 0.35), (L * 0.13, L * 0.72), (L * 0.05, L * 0.95), (0.0, L)],
            Mp, col, d=tuple(d), n=n, sz=0.7, up=tuple(sd))
    for s in (-1, 1):
        k.blob(tuple(T + d * (L * 0.2) + sd * s * L * 0.13), (L * 0.05, L * 0.05, L * 0.05), Mp, "#1d1d22", segs=4, rings=2)
    if not hook:
        return
    k.blob(tuple(T + d * (L * 0.5) + f * L * 0.07), (L * 0.13, L * 0.3, L * 0.05), Mp, belly, segs=6, rings=4)
    k.quad([tuple(T + d * 0.02 + f * L * 0.04), tuple(T + d * 0.02 - f * L * 0.04), tuple(T - d * L * 0.16 - f * L * 0.07), tuple(T - d * L * 0.16 + f * L * 0.07)],
           Mp, "#d8e6ea")
    b = T + d * (L + 0.02)
    k.tube([tuple(b), tuple(b + d * L * 0.25), tuple(b + d * L * 0.36 + f * L * 0.1), tuple(b + d * L * 0.28 + f * L * 0.2), tuple(b + d * L * 0.16 + f * L * 0.18)],
           L * 0.025 + 0.004, Mm, "#c9ccd0", n=4)


# ================================================================ the tackle shop
def tackle_shop(M, Mp, Mg, Mr, Mm, Mn):
    k = K.Kit("tackle-shop")
    W, D, PORCH, H, RID = 4.4, 3.6, 1.3, 2.5, 4.05
    WALL, TRIM = ("#3fa3b4", "#2f8a9d"), "#f3ead8"
    ROOF = ("#f0b43a", "#f5c24c", "#e2a02e", "#eeb948")
    platform(k, M, W, D + PORCH)
    zb, zf = -(D + PORCH) / 2, (D + PORCH) / 2 - PORCH       # the back and front walls; the porch from zf on
    zc = (zb + zf) / 2
    front, back = Wall((0, 0, zf), 0), Wall((0, 0, zb), math.pi)
    left, right = Wall((-W / 2, 0, zc), -math.pi / 2), Wall((W / 2, 0, zc), math.pi / 2)
    half_span = D / 2 + 0.5
    boards(k, M, front, W / 2, FLOOR, lambda a: H, WALL, skip=[(-1.05, -0.15, 0, 2.0), (0.6, 1.8, 0.95, 1.85)])
    boards(k, M, back, W / 2, FLOOR, lambda a: H, WALL, skip=[(-0.5, 0.5, 1.1, 1.85)])
    gtop = lambda a: H + (RID - H - 0.12) * (1 - abs(a) / half_span)
    boards(k, M, left, D / 2, FLOOR, gtop, WALL, skip=[(-0.45, 0.45, 1.1, 1.8)])
    boards(k, M, right, D / 2, FLOOR, gtop, WALL)
    for w in (front, back):
        k.rbox(w.p(0, H, 0.05), (W + 0.1, 0.12, 0.06), 0.01, M, TRIM, rot=w.rot, segs=1)
    for sx in (-1, 1):
        for z in (zb, zf):
            post(k, M, (sx * W / 2, FLOOR, z), (sx * W / 2, H + 0.05, z), w=0.16, col=TRIM)
    door(k, M, Mm, Mg, front, -0.6, 0.9, 1.95, "#e2553c", TRIM, porthole=True)
    window(k, M, Mg, back, 0.0, 1.48, 0.95, 0.72, TRIM)
    window(k, M, Mg, left, 0.0, 1.45, 0.85, 0.7, TRIM, shutter="#e2553c")
    gable(k, M, (0, 0, zc), (1, 0, 0), W / 2 + 0.45, half_span, H - 0.12, RID, 6, 10, ROOF, 41, barge=TRIM)

    # The serving hatch: the opening dark inside, a counter ledge on brackets, the shutter propped up over it on two
    # sticks, a green tackle box and a spare reel on the counter.
    k.rbox(front.p(1.2, 1.4, -0.05), (1.2, 0.9, 0.03), 0.0, M, "#2b2420", rot=front.rot, segs=1)
    k.rbox(front.p(1.2, 0.93, 0.2), (1.4, 0.07, 0.42), 0.015, M, mix(TRIM, "#c9b89a", 0.4), rot=front.rot, segs=1, uv_len=1.5, v_axis=0)
    for a in (0.62, 1.78):
        k.beam(front.p(a, 0.55, 0.03), front.p(a, 0.88, 0.36), 0.06, 0.06, 0.01, M, TRIM, segs=1)
    sh = front.p(1.2, 1.85, 0.0)
    for i in range(3):
        k.rbox(tuple(Vector(sh) + Vector((-0.4 + i * 0.4, 0.12, 0.42))), (0.39, 0.06, 0.9), 0.01, M, mix("#e2553c", "#b13d33", 0.15 * i),
               rot=K.game_rot(pitch=-0.35), segs=1, uv_len=1.2, v_axis=2)
    for a in (0.7, 1.7):
        k.beam(front.p(a, 0.95, 0.38), front.p(a, 2.05, 0.82), 0.035, 0.035, 0.0, M, "#5a3b26", segs=1)
    tb = Vector(front.p(1.0, 0.97, 0.22))
    k.rbox(tuple(tb + Vector((0, 0.12, 0))), (0.5, 0.24, 0.28), 0.03, Mp, "#5f9a4a", segs=1)
    k.rbox(tuple(tb + Vector((0, 0.25, 0))), (0.52, 0.04, 0.3), 0.015, Mp, "#4f8a3d", segs=1)
    k.tube([tuple(tb + Vector((-0.12, 0.27, 0))), tuple(tb + Vector((-0.1, 0.36, 0))), tuple(tb + Vector((0.1, 0.36, 0))), tuple(tb + Vector((0.12, 0.27, 0)))],
           0.016, Mm, "#3d3936", n=4)
    k.blob(tuple(tb + Vector((0.52, 0.1, 0.02))), (0.1, 0.1, 0.06), Mm, "#d2a33c", segs=8, rings=4)

    # The lure board on the wall left of the door: a framed plank with two rows of bright plugs on pegs.
    lb = Wall(front.p(-1.62, 0, 0.05), 0)
    k.rbox(lb.p(0, 1.45, 0.0), (0.82, 0.8, 0.05), 0.01, M, "#e9dcc0", rot=lb.rot, segs=1, uv_len=1.2, v_axis=0)
    for s in (-1, 1):
        k.rbox(lb.p(s * 0.41, 1.45, 0.02), (0.06, 0.86, 0.06), 0.01, M, "#5a3b26", rot=lb.rot, segs=1)
        k.rbox(lb.p(0, 1.45 + s * 0.4, 0.02), (0.88, 0.06, 0.06), 0.01, M, "#5a3b26", rot=lb.rot, segs=1)
    cols = ("#e2553c", "#f2c94c", "#5f86b5", "#6aa36b", "#ef8aa8", "#f08a3a", "#9a6bc2", "#4fb3c8")
    for j, y in enumerate((1.74, 1.34)):
        for i in range(4):
            a = -0.27 + i * 0.18
            k.rbox(lb.p(a, y, 0.04), (0.025, 0.025, 0.06), 0.0, Mm, "#c9ccd0", rot=lb.rot, segs=1)
            lure(k, Mp, Mm, lb.p(a, y - 0.02, 0.07), 0.2, cols[(i + 3 * j) % len(cols)], hook=False, n=5)

    # The rod rack on the porch's -x side: two posts, a slotted rail, a footboard; five rods leaning in it.
    rx, rz = -W / 2 + 0.25, zf + 0.75
    for z in (rz - 0.4, rz + 0.4):
        k.beam((rx, FLOOR, z), (rx, 1.2, z), 0.09, 0.09, 0.01, M, "#5a3b26", segs=1)
    k.rbox((rx, 1.1, rz), (0.14, 0.08, 0.95), 0.015, M, "#7a5434", segs=1, uv_len=1.5, v_axis=2)
    k.rbox((rx + 0.05, 0.12, rz), (0.3, 0.06, 0.95), 0.015, M, "#7a5434", segs=1, uv_len=1.5, v_axis=2)
    for i, col in enumerate(("#c8483c", "#2f4f7f", "#5f9a4a", "#f2c94c", "#f4efe6")):
        z = rz - 0.32 + i * 0.16
        foot, lean = Vector((rx + 0.08, 0.16, z)), Vector((rng.uniform(-0.2, -0.12), 1.0, rng.uniform(-0.05, 0.05))).normalized()
        L = rng.uniform(2.1, 2.5)
        pts = [foot + lean * L * t + Vector((0.06 * t * t, 0, 0)) for t in np.linspace(0, 1, 5)]
        tip = rod(k, Mp, Mm, Mr, [tuple(p) for p in pts], 0.026, 0.009, col, n=5, reel_r=0.075 if i % 2 == 0 else 0.0, cork=0.0)
        k.lathe(tuple(foot), [(0.0, -0.02), (0.038, -0.02), (0.042, 0.4), (0.03, 0.44), (0.0, 0.44)], Mp, "#c79a62", d=tuple(lean), n=5)
        if i == 1:
            k.tube([tuple(tip), tuple(tip + Vector((0.02, -0.35, 0)))], 0.004, Mr, LINE, n=3)
            lure(k, Mp, Mm, tuple(tip + Vector((0.02, -0.35, 0))), 0.16, "#f08a3a", hook=False, n=5)

    # By the door: the bait bucket (a pail of earth with worms over its rim) and a landing net leaning on the wall.
    bx, bz = 0.15, zf + 0.35
    k.lathe((bx, FLOOR, bz), [(0.0, 0.0), (0.2, 0.0), (0.25, 0.42), (0.27, 0.44), (0.25, 0.46), (0.23, 0.44), (0.18, 0.04), (0.0, 0.04)], Mm,
            "#8fa3ad", n=12)
    k.blob((bx, FLOOR + 0.38, bz), (0.22, 0.06, 0.22), Mp, "#5b4030", segs=10, rings=4, seed=3, lumpy=0.3)
    k.tube([(bx - 0.26, FLOOR + 0.45, bz), (bx - 0.24, FLOOR + 0.72, bz + 0.02), (bx + 0.24, FLOOR + 0.72, bz - 0.02), (bx + 0.26, FLOOR + 0.45, bz)],
           0.012, Mm, "#5d6168", n=4)
    for i, (a, l) in enumerate(((0.3, 0.2), (2.1, 0.26), (4.0, 0.22))):
        c0 = Vector((bx + math.cos(a) * 0.08, FLOOR + 0.42, bz + math.sin(a) * 0.08))
        o = Vector((math.cos(a), 0, math.sin(a)))
        pts = [c0 + o * l * t + Vector((0, 0.08 * math.sin(t * math.pi) - (0.25 * t * t if i == 1 else 0.0), 0)) + Vector((-o.z, 0, o.x)) * 0.04 * math.sin(t * 7)
               for t in np.linspace(0, 1, 6)]
        k.tube([tuple(p) for p in pts], 0.022, Mp, "#e58a8a", n=5, caps=True)
    nx, nz = -0.05, zf + 0.12
    k.beam((nx, FLOOR, nz + 0.3), (nx + 0.05, 1.55, nz), 0.05, 0.05, 0.01, M, "#c9a072", segs=1)
    hoop = [(nx + 0.05 + math.cos(a) * 0.26, 1.82 + math.sin(a) * 0.3, nz - 0.03) for a in np.linspace(0, math.tau, 12, endpoint=False)]
    k.tube(hoop, 0.018, Mm, "#5d6168", n=4, closed_path=True)
    cv = [k.vert(p) for p in hoop]
    bag = k.vert((nx + 0.08, 1.45, nz - 0.18))
    for i in range(12):
        k.face([cv[i], cv[(i + 1) % 12], bag], [(i / 12 * 2, 1.0), ((i + 1) / 12 * 2, 1.0), (0.5, 0.0)], Mn, "#ffffff")

    # The striped awning over the porch: boards in two colours from the wall to a beam on two posts, a sign on its fascia.
    y0, y1, ze = H - 0.12, 2.2, zf + PORCH + 0.15
    for sx in (-1, 1):
        post(k, M, (sx * (W / 2 - 0.1), FLOOR, zf + PORCH - 0.1), (sx * (W / 2 - 0.1), y1 - 0.02, zf + PORCH - 0.1), w=0.14, col=TRIM)
    k.beam((-W / 2 - 0.15, y1 - 0.06, zf + PORCH - 0.1), (W / 2 + 0.15, y1 - 0.06, zf + PORCH - 0.1), 0.14, 0.14, 0.02, M, "#5a3b26", segs=1)
    n = 12
    for i in range(n):
        x = -W / 2 - 0.25 + (i + 0.5) * (W + 0.5) / n
        k.beam((x, y0, zf), (x, y1, ze), (W + 0.5) / n - 0.015, 0.06, 0.0, Mp, "#e2553c" if i % 2 == 0 else "#f4efe6", segs=1, roll=rng.uniform(-0.02, 0.02))
    for i in range(n + 1):                                       # a scalloped valance along the front
        x = -W / 2 - 0.25 + i * (W + 0.5) / n
        k.extrude([(-0.17, 0.0), (0.17, 0.0), (0.0, -0.17)][::-1], -0.02, 0.02, Mp, "#e2553c" if i % 2 else "#f4efe6", at=(x, y1 - 0.04, ze + 0.02))
    # The sign: a board on top of the awning's front, a crossed rod and fish painted on it.
    sy, sz = y1 + 0.42, ze - 0.2
    k.rbox((0, sy, sz), (1.9, 0.62, 0.08), 0.03, M, "#f3ead8", segs=1, uv_len=1.5, v_axis=0)
    k.rbox((0, sy, sz - 0.02), (2.02, 0.74, 0.06), 0.03, M, "#5a3b26", segs=1)
    for x in (-0.7, 0.7):
        k.beam((x, y1 - 0.02, sz - 0.08), (x, sy - 0.2, sz - 0.08), 0.07, 0.07, 0.01, M, "#5a3b26", segs=1)
    body = [(0.3 * math.cos(a) + 0.25, 0.12 * math.sin(a)) for a in np.linspace(0, math.tau, 12, endpoint=False)]
    k.extrude(body, 0.04, 0.07, Mp, "#3fa3b4", bevel=0.008, at=(0, sy, sz))
    k.extrude([(-0.05, 0.0), (-0.24, -0.15), (-0.2, 0.0), (-0.24, 0.15)][::-1], 0.04, 0.07, Mp, "#3fa3b4", bevel=0.008, at=(0, sy, sz))
    k.beam((-0.75, sy - 0.2, sz + 0.06), (-0.05, sy + 0.24, sz + 0.06), 0.035, 0.02, 0.0, Mp, "#c8483c", segs=1)
    k.tube([(-0.05, sy + 0.24, sz + 0.06), (0.05, sy + 0.05, sz + 0.06), (0.05, sy - 0.12, sz + 0.06)], 0.006, Mr, "#3d3936", n=3)
    k.lathe((-0.62, sy - 0.12, sz + 0.06), [(0.0, -0.02), (0.07, -0.02), (0.07, 0.02), (0.0, 0.02)], Mp, "#e2b445", d=(0, 0, 1), n=8)
    lantern(k, Mm, Mg, front, -1.25, 2.0)

    # The giant rod on the roof, as if a fish were on: its grip in a holder on the ridge's -x end, the blank rising steep
    # and bending over toward the porch's +x corner, the line down to a red and white bobber and a big lure under it.
    B, C, T = Vector((-2.0, RID + 1.0, zc)), Vector((-0.2, RID + 4.0, zc + 0.4)), Vector((W / 2 + 0.1, RID + 1.3, zf + PORCH + 0.6))
    curve = [B * (1 - t) ** 2 + C * 2 * t * (1 - t) + T * t * t for t in np.linspace(0, 1, 16)]
    tip = rod(k, Mp, Mm, Mr, [tuple(p) for p in curve], 0.15, 0.045, "#2f4f7f", n=8, reel_r=0.5, cork=1.1)
    d0 = (curve[1] - curve[0]).normalized()
    S = B - d0 * 0.75                                          # the holder: a socket round the grip on a post with braces
    k.lathe(tuple(S), [(0.27, -0.3), (0.29, -0.26), (0.29, 0.26), (0.27, 0.3), (0.0, 0.3)], Mp, "#c8483c", d=tuple(d0), n=10)
    foot = Vector((S.x, RID + 0.05, zc))
    k.beam(tuple(foot), tuple(S - d0 * 0.2), 0.22, 0.22, 0.03, M, "#5a3b26", up=(0, 0, 1), segs=1)
    for s in (-1, 1):
        k.beam((S.x, RID - 0.42, zc + s * 0.75), tuple(foot + Vector((0, 0.45, 0))), 0.11, 0.11, 0.02, M, "#5a3b26", up=(1, 0, 0), segs=1)
    for i in range(3):
        yy = RID + 0.3 + i * 0.06
        k.tube([(foot.x + math.cos(a) * 0.15, yy, foot.z + math.sin(a) * 0.15) for a in np.linspace(0, math.tau, 8, endpoint=False)], 0.025, Mr, ROPE,
               n=4, closed_path=True)
    line = [tip + Vector((0, -0.05, 0)), tip + Vector((0.01, -(tip.y - 2.95), 0))]
    k.tube([tuple(line[0] + Vector((0, 0.05, 0))), tuple(line[1])], 0.01, Mr, LINE, n=3)
    bob = line[1] - Vector((0, 0.2, 0))
    k.lathe(tuple(bob), [(0.0, -0.24), (0.15, -0.2), (0.22, -0.04), (0.225, 0.0)], Mp, "#f4efe6", n=12)
    k.lathe(tuple(bob), [(0.225, 0.0), (0.22, 0.04), (0.15, 0.2), (0.0, 0.24)], Mp, "#d9433a", n=12)
    k.lathe(tuple(bob), [(0.035, 0.2), (0.03, 0.36), (0.0, 0.38)], Mp, "#3d3936", n=6)
    k.tube([tuple(bob - Vector((0, 0.24, 0))), tuple(bob - Vector((0, 0.55, 0)))], 0.008, Mr, LINE, n=3)
    lure(k, Mp, Mm, tuple(bob - Vector((0, 0.55, 0))), 0.5, "#f2c94c", belly="#f4efe6", yaw=-0.6)
    k.tint_gradient(0.84, 1.0, 0.0, RID)
    wet(k)
    return k.finish(smooth_deg=40)


def mats():
    K.reset()
    return dict(M=wood_mat("M_DecorWood", 2614), Mr=K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0),
                Mn=K.Mat("M_Net", tex=K.image("net", net_texture()), rough=1.0), Mp=K.Mat("P_Paint", rough=0.45), Mg=K.Mat("P_Glass", rough=0.08),
                Mm=K.Mat("P_Metal", rough=0.4))


def build():
    m = mats()
    obs = {"tackle-shop": tackle_shop(m["M"], m["Mp"], m["Mg"], m["Mr"], m["Mm"], m["Mn"])}
    for name, ob in obs.items():
        K.export([ob], f"{OUT}{name}.glb")
        report(ob)
    return obs


def scene(obs, out, views):
    """The models side by side on a deck edge, the sea behind them."""
    import bpy
    shown = []
    for i, ob in enumerate(obs.values()):
        o = ob.copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G((i - (len(obs) - 1) / 2) * 7.0, 0, 0)
        shown.append(o)
        ob.hide_render = True
    for name, y, z0, z1, col in (("sea", WATER, -7, 0.0, "#5fa7b8"), ("deck", 0.0, -0.2, 5.0, "#8a6a4c")):
        me = bpy.data.meshes.new(name)
        me.from_pydata([K.G(-9, y, z0), K.G(9, y, z0), K.G(9, y, z1), K.G(-9, y, z1)], [], [(0, 1, 2, 3)])
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        me.materials.append(K.Mat(f"M_{name}", col, rough=0.5).m)
    bpy.context.view_layer.update()
    K.review(shown, out, views=views, size=1000)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        views = tuple(tuple(float(v) for v in a.split(":")) for a in ARGS if ":" in a) or ((200, 24), (150, 30), (330, 20))
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "wharf-shops.png"), views)
