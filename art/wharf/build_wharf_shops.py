"""The new world's wharf shops (game/wharf-art4; David's R2d note on the ship houses, 2026-10-26: "houses need better use,
maybe one for selling rods/equipment , with a big rod on the roof or smth and one for building ships"). They take the
ship houses' place on the deck's water edge and their frame (art/wharf/build_ship_houses.py): the origin on the deck's
top (y 0) at the middle of the floor, the front (the door) to +z, facing in; the back toward -z over the sea on piles.
Nobody enters them for launch. The playful look of specs/references/terrain/r2-2026-10-26/dock-fish-hut.jpg and
plan-2026-10-23/wharf-fishing-hut-1.jpg: a big object on the roof, bright colours, chunky wood.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_wharf_shops.py [-- review <dir> [model ...] [az:el ...]]

Writes, under web/public/assets/game/wharf/, in game units at scale 1:
  tackle-shop.glb  rods and fishing gear: turquoise boards under a sunny tiled gable, a giant rod on two crutches along
                   the roof with a big reel at its butt, its line hanging off the front +x corner to a red and white
                   bobber and a lure; a striped awning over a porch with a rack of rods, a lure board on the wall, a
                   serving hatch with a tackle box on its counter, a bait bucket and a landing net by the door.
  shipwright-shed.glb  the boatbuilder's shed: brown boards under a blue tiled gable, a big ship's wheel on the front
                   gable, wide doors swung open, a side bay open onto a pier along +x over the water with a lantern
                   post and a railed gangplank off it to the boat (PLANK_END); a sawhorse with a half-sawn plank and the
                   saw in the cut, planks leaned on the -x wall, a tool board, a tar barrel, a rope coil.
  shipwright-boat.glb  the boat being built, afloat beside the shed (BOAT_AT): a keel, a tall stem at the bow (-z),
                   thirteen ribs standing proud, the lower strakes the whole length and the upper ones stopping short
                   of the bow, a blue top strake and transom, floorboards, thwarts, loose planks, a bucket, a mallet,
                   a lantern on a stick at the stern. Its origin on the waterline at its middle, so it can bob.

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
from build_wharf_kit import DARK, LIGHT, WATER, mix, report, wet, wood_mat  # noqa: E402
from build_dock_decor import ROPE, coil, net_texture  # noqa: E402
from build_ship_houses import BEAM, FLOOR, Wall, boards, corners, door, gable, lantern, pile, platform, post, window  # noqa: E402

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


# ================================================================ the shipwright
BOAT_AT = (5.4, WATER, -3.6)        # where the boat's origin sits in the shed's frame (on the sea's level); see the docstring
PLANK_END = (4.3, 0.16, -2.0)       # the gangplank's far end in the shed's frame, just over the boat's gunwale


def shipwright_shed(M, Mp, Mg, Mr, Mm):
    k = K.Kit("shipwright-shed")
    W, D, H, RID = 3.8, 4.0, 2.6, 4.5
    WALL, TRIM, ROOF = ("#a8784e", "#8d6240"), "#efe6d6", ("#4f7fa6", "#5b8db5", "#456f94", "#5687ae")
    platform(k, M, W, D)
    front, back = Wall((0, 0, D / 2), 0), Wall((0, 0, -D / 2), math.pi)
    left, right = Wall((-W / 2, 0, 0), -math.pi / 2), Wall((W / 2, 0, 0), math.pi / 2)
    gtop = lambda a: H + (RID - H - 0.15) * (1 - abs(a) / (W / 2 + 0.4))
    boards(k, M, front, W / 2, FLOOR, gtop, WALL, skip=[(-1.1, 1.1, 0, 2.3)])
    boards(k, M, back, W / 2, FLOOR, gtop, WALL, skip=[(-0.45, 0.45, 1.15, 1.85)])
    boards(k, M, left, D / 2, FLOOR, lambda a: H, WALL, skip=[(-0.45, 0.45, 1.1, 1.8)])
    boards(k, M, right, D / 2, FLOOR, lambda a: H, WALL, skip=[(-1.55, 0.1, 0, 2.3)])
    corners(k, M, W, D, H, TRIM)
    for w in (front, back):
        k.rbox(w.p(0, H, 0.05), (W + 0.1, 0.12, 0.06), 0.01, M, TRIM, rot=w.rot, segs=1)
    # The wide front doors swung open, the dark inside, a header beam; the side bay open to the pier (+x).
    for w, a, half in ((front, 0.0, 1.1), (right, -0.725, 0.825)):
        k.rbox(w.p(a, 1.15, -0.25), (2 * half, 2.3, 0.03), 0.0, M, "#2b2420", rot=w.rot, segs=1)
        k.beam(w.p(a - half - 0.1, 2.38, 0.06), w.p(a + half + 0.1, 2.38, 0.06), 0.16, 0.18, 0.02, M, BEAM, segs=1)
    for s in (-1, 1):
        lw = Wall(front.p(s * 1.1, 0, 0.55), -s * math.pi / 2 + s * 0.35)
        for i in range(3):
            k.rbox(lw.p((i - 1) * 0.36 * -s, 1.15 + FLOOR, 0.0), (0.34, 2.25, 0.06), 0.01, M, mix("#c0583c", "#20303a", 0.1 * i), rot=lw.rot, segs=1,
                   uv_len=1.2, v_axis=1)
        k.beam(lw.p(-0.5 * s, 0.4, 0.04), lw.p(0.5 * s, 1.9, 0.04), 0.08, 0.05, 0.01, M, TRIM, segs=1)
    window(k, M, Mg, back, 0.0, 1.5, 0.9, 0.7, TRIM)
    window(k, M, Mg, left, 0.0, 1.45, 0.9, 0.7, TRIM, shutter="#c0583c")
    gable(k, M, (0, 0, 0), (0, 0, 1), D / 2 + 0.4, W / 2 + 0.4, H - 0.15, RID, 6, 9, ROOF, 51, barge=TRIM)
    # A big ship's wheel on the front gable: the rim, eight spokes through it to turned handles, a brass hub.
    wc, R = Vector(front.p(0, RID - 1.05, 0.22)), 0.62
    k.tube([tuple(wc + Vector((math.cos(a) * R, math.sin(a) * R, 0))) for a in np.linspace(0, math.tau, 16, endpoint=False)], 0.07, M, "#7a4a2a", n=6,
           closed_path=True)
    k.tube([tuple(wc + Vector((math.cos(a) * R * 0.55, math.sin(a) * R * 0.55, 0.02))) for a in np.linspace(0, math.tau, 12, endpoint=False)], 0.035, M,
           "#7a4a2a", n=5, closed_path=True)
    for i in range(8):
        a = i * math.tau / 8 + math.pi / 8
        dvec = Vector((math.cos(a), math.sin(a), 0))
        k.beam(tuple(wc), tuple(wc + dvec * (R + 0.08)), 0.06, 0.05, 0.01, M, "#8a5a32", up=(0, 0, 1), segs=1)
        k.lathe(tuple(wc + dvec * (R + 0.07)), [(0.0, 0.0), (0.05, 0.0), (0.06, 0.12), (0.04, 0.2), (0.055, 0.27), (0.0, 0.31)], M, "#8a5a32", d=tuple(dvec), n=6)
    k.lathe(tuple(wc), [(0.0, -0.1), (0.13, -0.1), (0.13, 0.08), (0.0, 0.12)], Mm, "#c79a3c", d=(0, 0, 1), n=10)

    # The side pier along +x over the water, on its own piles, the gangplank off its far edge to the boat.
    px0, px1, pz0, pz1 = W / 2 + 0.25, W / 2 + 1.55, -D / 2 - 0.25, 0.4
    for i in range(5):
        z = pz0 + (i + 0.5) * (pz1 - pz0) / 5
        k.rbox(((px0 + px1) / 2 + rng.uniform(-0.03, 0.03), FLOOR - 0.05, z), (px1 - px0, 0.1, (pz1 - pz0) / 5 - 0.03), 0.015, M, mix(DARK, LIGHT, rng.uniform(0.3, 0.9)),
               segs=1, uv_len=2.0, v_axis=0)
    for x, z in ((px1 - 0.12, pz0 + 0.12), (px1 - 0.12, pz1 - 0.12), (px1 - 0.12, (pz0 + pz1) / 2)):
        pile(k, M, x, z, r=0.12)
    gx0, (gx1, gy1, gz) = px1 - 0.1, PLANK_END
    for s in (-1, 1):                                             # two runners, cleats across them, rope rails on stanchions
        k.beam((gx0, FLOOR + 0.02, gz + s * 0.28), (gx1, gy1 + 0.02, gz + s * 0.28), 0.08, 0.1, 0.01, M, BEAM, segs=1)
    n = 7
    for i in range(n):
        t = (i + 0.5) / n
        k.rbox((gx0 + (gx1 - gx0) * t, FLOOR + 0.09 + (gy1 - FLOOR) * t, gz), (1.2 / n - 0.03, 0.05, 0.7), 0.01, M, mix(DARK, LIGHT, rng.uniform(0.4, 0.95)),
               rot=K.game_rot(roll=math.atan2(gy1 - FLOOR, gx1 - gx0)), segs=1, uv_len=1.5, v_axis=2)
    for s in (-1, 1):
        tops = []
        for t in (0.08, 0.92):
            x, y = gx0 + (gx1 - gx0) * t, FLOOR + (gy1 - FLOOR) * t
            k.beam((x, y + 0.08, gz + s * 0.32), (x, y + 0.85, gz + s * 0.32), 0.05, 0.05, 0.01, M, TRIM, segs=1)
            tops.append(Vector((x, y + 0.82, gz + s * 0.32)))
        k.tube([tuple(tops[0] + (tops[1] - tops[0]) * t - Vector((0, 0.08 * math.sin(math.pi * t), 0))) for t in np.linspace(0, 1, 6)], 0.018, Mr, ROPE, n=4)
    # A lantern post at the pier's corner by the gangplank.
    lp = (px1 - 0.12, pz1 - 0.12)
    k.beam((lp[0], FLOOR, lp[1]), (lp[0], 2.1, lp[1]), 0.1, 0.1, 0.01, M, BEAM, segs=1)
    lantern(k, Mm, Mg, Wall((lp[0], 0, lp[1]), math.pi / 2), 0.0, 1.75)

    # Out front: a sawhorse with a plank on it half sawn, the saw in the cut, shavings; planks leaned on the -x wall;
    # a tool board by the door; a tar barrel, a rope coil, a mallet.
    sx_, sz_ = -0.6, D / 2 + 0.75
    for x in (sx_ - 0.45, sx_ + 0.45):
        for s in (-1, 1):
            k.beam((x + 0.0, FLOOR, sz_ + s * 0.25), (x, 0.62, sz_), 0.06, 0.06, 0.01, M, "#8a6a4c", up=(1, 0, 0), segs=1)
    k.rbox((sx_, 0.66, sz_), (1.2, 0.08, 0.1), 0.01, M, "#7a5434", segs=1, uv_len=1.5, v_axis=0)
    k.rbox((sx_ + 0.15, 0.74, sz_), (1.9, 0.06, 0.3), 0.01, M, mix(DARK, LIGHT, 0.85), segs=1, uv_len=2.0, v_axis=0)
    blade = [(0.0, 0.0), (0.6, 0.0), (0.6, 0.06), (0.0, 0.16)]
    k.extrude(blade, -0.006, 0.006, Mm, "#c9ccd0", rot=K.game_rot(yaw=math.pi / 2, roll=-0.25), at=(sx_ + 0.75, 0.66, sz_ + 0.25))
    k.rbox((sx_ + 0.75, 0.86, sz_ + 0.27), (0.07, 0.16, 0.05), 0.02, M, "#c0583c", rot=K.game_rot(roll=-0.25), segs=1)
    for i in range(7):
        k.blob((sx_ + 0.6 + rng.uniform(-0.25, 0.25), FLOOR + 0.01, sz_ + rng.uniform(-0.3, 0.3)), (0.05, 0.015, 0.04), Mp, "#e8cfa0", segs=5, rings=2)
    for i in range(5):
        x = -W / 2 - 0.12 - i * 0.07
        k.beam((x - 0.5, FLOOR, D / 2 - 0.3 - i * 0.55), (x, 2.5 - i * 0.1, D / 2 - 0.35 - i * 0.55 + rng.uniform(-0.1, 0.1)), 0.32, 0.05, 0.01, M,
               mix(DARK, LIGHT, rng.uniform(0.5, 1.0)), up=(1, 0, 0), segs=1, uv_len=2.0)
    tb = Wall(front.p(1.55, 0, 0.05), 0)
    k.rbox(tb.p(0, 1.45, 0.0), (0.5, 0.9, 0.04), 0.01, M, "#e9dcc0", rot=tb.rot, segs=1)
    k.beam(tb.p(-0.05, 1.05, 0.05), tb.p(-0.05, 1.45, 0.05), 0.04, 0.03, 0.0, M, "#c0583c", segs=1)        # a hammer
    k.rbox(tb.p(-0.05, 1.48, 0.06), (0.2, 0.06, 0.06), 0.01, Mm, "#5d6168", rot=tb.rot, segs=1)
    k.extrude([(0.0, 0.0), (0.12, 0.0), (0.12, 0.22), (0.0, 0.3)], -0.01, 0.01, Mm, "#c9ccd0", rot=tb.rot, at=tb.p(0.06, 1.55, 0.05))   # a chisel and a square
    k.extrude([(0.0, 0.0), (0.05, 0.0), (0.05, 0.3), (0.0, 0.3)], -0.01, 0.01, Mm, "#c79a3c", rot=tb.rot, at=tb.p(0.1, 1.1, 0.05))
    k.extrude([(0.0, 0.0), (0.2, 0.0), (0.2, 0.04), (0.0, 0.04)], -0.01, 0.01, Mm, "#c79a3c", rot=tb.rot, at=tb.p(0.1, 1.1, 0.05))
    bx, bz = 1.35, D / 2 + 0.55
    k.lathe((bx, FLOOR, bz), [(0.0, 0.0), (0.24, 0.0), (0.28, 0.35), (0.24, 0.7), (0.0, 0.7)], M, "#4a3a2e", n=10, wobble=lambda kk, i: 1.0)
    for y in (0.12, 0.58):
        k.lathe((bx, FLOOR + y, bz), [(0.26 + (0.02 if y > 0.3 else 0.0), -0.03), (0.26 + (0.02 if y > 0.3 else 0.0), 0.03)], Mm, "#3d3936", n=10)
    k.blob((bx, FLOOR + 0.69, bz), (0.22, 0.02, 0.22), Mp, "#1d1a18", segs=10, rings=2)
    coil(k, Mr, (px0 + 0.6, FLOOR, -0.4), r1=0.24)
    k.tint_gradient(0.84, 1.0, 0.0, RID)
    wet(k)
    return k.finish(smooth_deg=40)


BB, LH = 1.25, 3.5                   # the boat's half beam and half length


def hull(u, s):
    """A point on the hull's starboard (+x) skin: u along it (-1 the bow, out at -z; 1 the transom), s from the keel (0)
    to the gunwale (1). The origin sits on the waterline at the middle."""
    bg = BB * ((1 - (-u) ** 1.6) if u < 0 else (1 - 0.4 * u * u))
    yk = -0.45 + 0.55 * max(0.0, -u) ** 3 + 0.12 * u ** 4
    yg = 1.1 + 0.25 * u * u + 0.6 * max(0.0, -u) ** 2.5
    return Vector((bg * math.sin(s * math.pi / 2) ** 0.55, yk + (yg - yk) * s ** 1.25, u * LH))


def shipwright_boat(M, Mp, Mr, Mm):
    """A boat being built, afloat: ribs on a keel, the lower strakes and the stern planked, the upper bow open."""
    k = K.Kit("shipwright-boat")
    U = list(np.linspace(-0.97, 1.0, 24))
    pt = lambda u, s, side, out=0.0: (lambda p: Vector((side * (p.x + out), p.y - out * 0.3, p.z)))(hull(u, s))
    # Strakes: nine a side; the lowest six run the whole length, the upper ones stop short of the bow, each further
    # aft than the one below (the starboard side further on than port); the top one painted.
    NS = 9
    for side in (-1, 1):
        for j in range(NS):
            s0, s1 = 0.04 + j * 0.96 / NS, 0.04 + (j + 1) * 0.96 / NS - 0.012
            cut = -2.0 if j < 6 else -0.45 + 0.3 * (j - 6) + (0.0 if side > 0 else 0.15)
            us = [u for u in U if u >= cut]
            if len(us) < 2:
                continue
            col = mix("#b98a5a", "#d7aa74", rng.uniform(0, 1)) if j < NS - 1 else "#3f7fb8"
            for u0, u1 in zip(us, us[1:]):
                q = [pt(u0, s0, side, 0.04), pt(u1, s0, side, 0.04), pt(u1, s1, side, 0.04), pt(u0, s1, side, 0.04)]
                uv = [(u0 * LH, s0 * 4), (u1 * LH, s0 * 4), (u1 * LH, s1 * 4), (u0 * LH, s1 * 4)]
                if side < 0:
                    q, uv = q[::-1], uv[::-1]
                k.face([k.vert(tuple(p)) for p in q], uv, M, col)
    # Ribs: a square-ish frame round the section at each station, standing proud of the gunwale.
    for u in np.linspace(-0.88, 0.9, 13):
        path = [pt(u, 1.12 - i / 6 * 1.12, -1) for i in range(7)] + [pt(u, i / 6 * 1.12, 1) for i in range(1, 7)]
        k.tube([tuple(p) for p in path], 0.06, M, "#8a5a32", n=4, caps=True)
    # The keel, the stem rising at the bow, the transom, a ribband along each gunwale.
    keel = [hull(u, 0.0) - Vector((0, 0.07, 0)) for u in np.linspace(-0.9, 1.0, 12)]
    k.tube([tuple(p) for p in keel], 0.1, M, "#6e4a30", n=6)
    y0, y1 = hull(-0.97, 0.0).y, hull(-1.0, 1.0).y
    stem = [hull(-0.9, 0.0)] + [Vector((0, y0 + (y1 - y0) * t, -LH - 0.2 * math.sin(t * math.pi / 2) - 0.03)) for t in np.linspace(0, 1, 7)]
    stem.append(Vector((0, y1 + 0.35, -LH - 0.26)))
    k.tube([tuple(p) for p in stem], 0.1, M, "#6e4a30", n=6, caps=True)
    rim = [hull(1.0, s) for s in np.linspace(0, 1, 7)]
    ring = [Vector((-p.x, p.y, p.z + 0.04)) for p in rim[::-1]] + [Vector((p.x, p.y, p.z + 0.04)) for p in rim[1:]]
    cen = k.vert(tuple(sum(ring, Vector()) / len(ring)))
    vs = [k.vert(tuple(p)) for p in ring]
    for i in range(len(vs) - 1):
        k.face([cen, vs[i + 1], vs[i]], [(0.5, 0.5), (i / 12, 1), ((i + 1) / 12, 1)], M, "#3f7fb8")
    for side in (-1, 1):
        k.tube([tuple(pt(u, 1.0, side, 0.06) + Vector((0, 0.04, 0))) for u in U], 0.05, M, "#6e4a30", n=5, caps=True)
    # Inside: thwarts, floorboards, loose planks, a bucket and a mallet; a lantern on a stick at the stern; a blank name
    # board on the transom; a line off the bow.
    for z, s in ((1.6, 0.8), (-0.4, 0.84)):
        p = hull(z / LH, s)
        k.rbox((0, p.y, z), (2 * p.x + 0.06, 0.07, 0.36), 0.01, M, mix(DARK, LIGHT, 0.8), segs=1, uv_len=2.0, v_axis=0)
    for x in (-0.36, -0.12, 0.12, 0.36):
        k.rbox((x, -0.2, 0.3), (0.22, 0.05, 4.4), 0.01, M, mix(DARK, LIGHT, rng.uniform(0.5, 0.9)), segs=1, uv_len=2.0, v_axis=2)
    for i in range(3):
        k.beam((-0.55 + i * 0.14, -0.14 + i * 0.06, -1.9 - i * 0.12), (0.45 + i * 0.12, 0.35 + i * 0.14, 0.9 + i * 0.25), 0.28, 0.05, 0.01, M,
               mix("#b98a5a", "#d7aa74", rng.uniform(0, 1)), up=(0, 1, 0), segs=1, uv_len=2.0)
    k.lathe((0.45, -0.17, 2.3), [(0.0, 0.0), (0.15, 0.0), (0.18, 0.3), (0.0, 0.3)], Mm, "#8fa3ad", n=10)
    k.lathe((-0.4, -0.04, 1.9), [(0.0, -0.13), (0.1, -0.13), (0.1, 0.13), (0.0, 0.13)], M, "#c0583c", d=(1, 0, 0), n=8)
    k.beam((-0.4, -0.04, 1.9), (-0.1, 0.01, 2.3), 0.04, 0.04, 0.01, M, "#c9a072", segs=1)
    top = hull(1.0, 1.0)
    k.beam((0.0, top.y - 0.4, top.z - 0.2), (0.0, top.y + 1.4, top.z - 0.2), 0.07, 0.07, 0.01, M, BEAM, segs=1)
    lantern(k, Mm, Mp, Wall((0.0, 0, top.z - 0.2), math.pi / 2), 0.0, top.y + 1.05)
    k.rbox((0.0, top.y - 0.35, top.z + 0.09), (1.1, 0.24, 0.05), 0.01, Mp, "#efe6d6", segs=1)
    bow = Vector((0, y1 + 0.2, -LH - 0.25))
    k.tube([tuple(bow), tuple(bow + Vector((0.4, -0.6, -0.5))), tuple(bow + Vector((0.6, -1.2, -0.6)))], 0.025, Mr, ROPE, n=4)
    k.tint_gradient(0.84, 1.0, -0.45, 1.8)
    wet(k, below=0.0)
    return k.finish(smooth_deg=45)


def mats():
    K.reset()
    return dict(M=wood_mat("M_DecorWood", 2614), Mr=K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0),
                Mn=K.Mat("M_Net", tex=K.image("net", net_texture()), rough=1.0), Mp=K.Mat("P_Paint", rough=0.45), Mg=K.Mat("P_Glass", rough=0.08),
                Mm=K.Mat("P_Metal", rough=0.4))


def build():
    m = mats()
    obs = {"tackle-shop": tackle_shop(m["M"], m["Mp"], m["Mg"], m["Mr"], m["Mm"], m["Mn"]),
           "shipwright-shed": shipwright_shed(m["M"], m["Mp"], m["Mg"], m["Mr"], m["Mm"]),
           "shipwright-boat": shipwright_boat(m["M"], m["Mp"], m["Mr"], m["Mm"])}
    for name, ob in obs.items():
        K.export([ob], f"{OUT}{name}.glb")
        report(ob)
    return obs


def scene(obs, out, views, only=None):
    """The models on a deck edge, the sea behind them, the boat afloat where BOAT_AT puts it beside its shed."""
    import bpy
    at = {"tackle-shop": (-8.0, 0, 0), "shipwright-shed": (1.0, 0, 0), "shipwright-boat": (1.0 + BOAT_AT[0], BOAT_AT[1], BOAT_AT[2])}
    shown = []
    for name, ob in obs.items():
        ob.hide_render = True
        if only and name not in only:
            continue
        o = ob.copy()
        bpy.context.scene.collection.objects.link(o)
        o.location, o.hide_render = K.G(*at[name]), False
        shown.append(o)
    for name, y, z0, z1, col in (("sea", WATER, -9, 0.0, "#5fa7b8"), ("deck", 0.0, -0.2, 5.0, "#8a6a4c")):
        me = bpy.data.meshes.new(name)
        me.from_pydata([K.G(-12, y, z0), K.G(10, y, z0), K.G(10, y, z1), K.G(-12, y, z1)], [], [(0, 1, 2, 3)])
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        me.materials.append(K.Mat(f"M_{name}", col, rough=0.5).m)
    bpy.context.view_layer.update()
    K.review(shown, out, views=views, size=1000)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        views = tuple(tuple(float(v) for v in a.split(":")) for a in ARGS if ":" in a) or ((200, 24), (150, 30), (330, 20))
        only = [a for a in ARGS if a in obs]
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "wharf-shops.png"), views, only)
