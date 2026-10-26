"""The fish market's quick-sell stall (game/wharf-art3; David, 2026-10-26: the quick-sell spot in front of the fish shop,
after specs/references/terrain/fish-shop-2026-10-26/sell-stall-fisk.jpg and sell-cart-coco.jpg: "barrel front of fish
shop to sell"). It replaces wharf-art2's lone sell barrel under the same name, so the world's placement and the sell
interaction keep working. A wooden display crate on legs tipped toward the buyer, heaped with bright fish, a crab, an
octopus and a starfish, a net slung under its front; a barrel with a lantern on it and a tub of fish on the left; a
barrel with a coil of rope and a life ring on the right; behind, a frame of two posts carrying a coral SELL board (the
cart's colour), a net sagging under it, a fish hung off one end and a lantern off the other, two gulls on the top bar.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_sell_stall.py [-- review <dir> [az:el ...]]

Writes game/wharf/sell-barrel.glb in game units at scale 1: the origin on the ground at the crate's middle, the front
(the buyer's side) +z. Wood is the fish market's painted grain (M_DecorWood, so the two merge), everything else plain
P_Paint under COLOR_0, the lanterns' panes the path lamps' glowing M_Glass. Seeded: a rebuild writes the same model.
"""
import math, os, sys
import bmesh
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, HERE)
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402
from build_wharf_kit import mix, report, wood_mat  # noqa: E402
from build_dock_decor import FLOAT_RED, ROPE, coil, lashing, ring_into  # noqa: E402
from build_path_lamps import iron_lantern  # noqa: E402
from build_streetlamp import glass_tex  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
rng = np.random.default_rng(2731)
WOOD, WOOD_DARK, WOOD_LIGHT = "#a87448", "#6e4a2e", "#c99a68"
CORAL, CREAM, TEAL, IRON = "#e0604f", "#fbf0d4", "#3e9c95", "#3d3431"
TILT = 0.33                                   # the crate's tray tips this far toward the buyer (radians)
TRAY_C = Vector((0.0, 0.8, 0.02))             # the tray floor's middle
POST_X, POST_Z, POST_TOP = 0.64, -0.44, 2.3   # the sign frame's posts


def placed(k, rot, at, build):
    """Build parts round the origin, then turn them by the game-space 3x3 `rot` and move them to game point `at`."""
    before = set(k.bm.verts)
    build()
    new = [v for v in k.bm.verts if v not in before]
    bmesh.ops.transform(k.bm, matrix=Matrix.Translation(K.G(*at)) @ (K.P @ rot @ K.P.inverted()).to_4x4(), verts=new)


def tray_pt(p):
    """A point in the tray's frame (its floor at y 0, the buyer +z) in game space."""
    return tuple(TRAY_C + Matrix.Rotation(TILT, 3, "X") @ Vector(p))


# ================================================================ creatures
def fish(k, Mp, c, d, L, col, flat=(0, 1, 0), eyes=(1,)):
    """A plump cartoon fish, its tail toward d, flattened across `flat` (up for one lying on its side): a spindle body,
    a forked tail and a back fin a shade darker, a big eye (white and black) on the `eyes` sides."""
    c, d, f = Vector(c), Vector(d).normalized(), Vector(flat).normalized()
    side = d.cross(f).normalized()
    prof = [(0.0, -L / 2), (L * 0.14, -L * 0.36), (L * 0.2, -L * 0.08), (L * 0.13, L * 0.24), (L * 0.05, L * 0.42)]
    k.lathe(tuple(c), prof, Mp, col, d=tuple(d), n=6, sz=0.55, up=tuple(f))
    dark = mix(col, "#1d2440", 0.3)
    t = c + d * L * 0.4
    a, m, b = t + d * L * 0.24 + side * L * 0.2, t + d * L * 0.12, t + d * L * 0.24 - side * L * 0.2
    for tri in ((t, a, m), (t, m, b)):
        k.face([k.vert(tuple(p)) for p in tri], ((0, 0), (1, 0), (1, 1)), Mp, dark)
    fin = (c - d * L * 0.08 + side * L * 0.18, c + d * L * 0.22 + side * L * 0.11, c + d * L * 0.16 + side * L * 0.3)
    k.face([k.vert(tuple(p)) for p in fin], ((0, 0), (1, 0), (1, 1)), Mp, dark)
    for sg in eyes:
        e = c - d * L * 0.3 + side * L * 0.03 + f * sg * L * 0.075
        k.blob(tuple(e), (L * 0.05, L * 0.05, L * 0.05), Mp, "#ffffff", segs=5, rings=3)
        k.blob(tuple(e + f * sg * L * 0.035 - d * L * 0.01), (L * 0.026, L * 0.026, L * 0.026), Mp, "#1d1d22", segs=4, rings=2)


def eye(k, Mp, c, r, look=(0, 0, 1)):
    k.blob(c, (r, r, r), Mp, "#ffffff", segs=6, rings=4)
    k.blob(tuple(Vector(c) + Vector(look).normalized() * r * 0.75), (r * 0.5, r * 0.5, r * 0.5), Mp, "#1d1d22", segs=5, rings=3)


def crab(k, Mp, col="#de4535"):
    """A crab round the origin, its foot at y 0, facing +z: a lumpy shell, eyes on stalks, two big claws, six legs."""
    k.blob((0, 0.06, 0), (0.13, 0.06, 0.1), Mp, col, segs=10, rings=6, seed=5, lumpy=0.15, flat_bottom=-0.035)
    for sx in (-1, 1):
        k.tube([(sx * 0.04, 0.09, 0.06), (sx * 0.05, 0.15, 0.07)], 0.011, Mp, col, n=4)
        eye(k, Mp, (sx * 0.05, 0.165, 0.075), 0.028, (sx * 0.2, 0.1, 1))
        k.tube([(sx * 0.1, 0.05, 0.05), (sx * 0.17, 0.07, 0.12), (sx * 0.14, 0.08, 0.18)], 0.02, Mp, col, n=5)
        k.blob((sx * 0.13, 0.09, 0.22), (0.055, 0.045, 0.065), Mp, mix(col, "#ff8a5c", 0.25), segs=8, rings=5, rot=K.game_rot(yaw=-sx * 0.4))
        k.blob((sx * 0.1, 0.125, 0.27), (0.02, 0.018, 0.05), Mp, mix(col, "#ff8a5c", 0.25), segs=5, rings=3, rot=K.game_rot(yaw=-sx * 0.5, pitch=-0.3))
        for z in (-0.07, -0.02, 0.03):
            k.tube([(sx * 0.11, 0.04, z), (sx * 0.2, 0.08, z - 0.02), (sx * 0.25, 0.0, z - 0.04)], 0.013, Mp, col, n=4)


def octopus(k, Mp, col="#f07d50"):
    """An octopus sprawled round the origin, facing +z: a tall round head, two eyes, six arms curling at the tips."""
    k.blob((0, 0.17, -0.02), (0.12, 0.15, 0.115), Mp, col, segs=9, rings=6, seed=7, lumpy=0.08)
    k.blob((0, 0.05, 0), (0.13, 0.05, 0.12), Mp, col, segs=9, rings=3)
    for sx in (-1, 1):
        eye(k, Mp, (sx * 0.05, 0.17, 0.09), 0.032, (sx * 0.15, 0, 1))
    for i in range(6):
        a = math.tau * (i + 0.5) / 6 + 0.3
        ca, sa = math.cos(a), math.sin(a)
        pts = [(0.08 + 0.24 * t, 0.03 + 0.03 * math.sin(math.pi * t)) for t in np.linspace(0, 1, 4)]
        pts += [(0.36, 0.08), (0.34, 0.12), (0.3, 0.1)]
        path = [(ca * r, y, sa * r) for r, y in pts]
        k.tube(path, 0.034, Mp, col, n=5, radii=np.linspace(1.0, 0.3, len(path)).tolist(), caps=True)


def starfish(k, Mp, col="#ec503c"):
    """A five-armed star, plump and bevelled, in the x-y plane facing +z."""
    out = [((0.13 if i % 2 == 0 else 0.055) * math.cos(math.pi / 2 + math.pi * i / 5), (0.13 if i % 2 == 0 else 0.055) * math.sin(math.pi / 2 + math.pi * i / 5))
           for i in range(10)]
    k.extrude(out, 0.0, 0.035, Mp, col, bevel=0.012, steps=1)
    for i in range(5):
        a = math.pi / 2 + math.tau * i / 5
        k.blob((0.06 * math.cos(a), 0.06 * math.sin(a), 0.036), (0.012, 0.012, 0.008), Mp, mix(col, "#ffd0a0", 0.5), segs=5, rings=3)


def gull(k, Mp):
    """A seagull perched round the origin, its feet at y 0, facing +z: white body and head, grey wings with black tips,
    a yellow beak, orange legs."""
    for sx in (-1, 1):
        k.tube([(sx * 0.03, 0.0, 0.0), (sx * 0.03, 0.08, -0.01)], 0.009, Mp, "#f0a03a", n=4)
        k.blob((sx * 0.03, 0.004, 0.02), (0.022, 0.006, 0.03), Mp, "#f0a03a", segs=4, rings=2)
    k.blob((0, 0.14, -0.02), (0.075, 0.07, 0.13), Mp, "#f6f4ee", segs=8, rings=5, rot=K.game_rot(pitch=-0.25))
    k.blob((0, 0.25, 0.08), (0.055, 0.055, 0.06), Mp, "#f6f4ee", segs=7, rings=4)
    k.lathe((0, 0.24, 0.13), [(0.019, 0.0), (0.012, 0.04), (0.0, 0.075)], Mp, "#f2c23a", d=(0, -0.2, 1), n=5)
    for sx in (-1, 1):
        k.blob((sx * 0.046, 0.262, 0.1), (0.011, 0.011, 0.011), Mp, "#1d1d22", segs=5, rings=3)
        k.blob((sx * 0.066, 0.165, -0.05), (0.024, 0.05, 0.125), Mp, "#9aa6b2", segs=6, rings=4, rot=K.game_rot(pitch=-0.35))
        k.blob((sx * 0.05, 0.12, -0.18), (0.02, 0.026, 0.06), Mp, "#2a2d33", segs=5, rings=3, rot=K.game_rot(pitch=-0.35))
    k.blob((0, 0.11, -0.16), (0.035, 0.018, 0.06), Mp, "#f6f4ee", segs=6, rings=3, rot=K.game_rot(pitch=-0.3))


# ================================================================ the stall
def staved(k, Mw, prof, n, height, seed):
    """A lathe of staves round the origin, each stave its own shade of the wood."""
    faces = k.lathe((0, 0, 0), prof, Mw, WOOD, n=n, v_len=height)
    for i, f in enumerate(faces):
        s = mix(WOOD_LIGHT, WOOD_DARK, ((i % n) * 5 + seed) % 7 / 9)
        for lp in f.loops:
            lp[k.col] = (*K.lin(s), 1.0)


def hoops(k, Mp, rings, n):
    for y, r in rings:
        k.lathe((0, y, 0), [(r + 0.012, -0.03), (r + 0.012, 0.03)], Mp, "#4f4b47", n=n)


def barrel(k, Mw, Mp, seed):
    """A closed barrel round the origin, 0.72 tall."""
    n = 12
    staved(k, Mw, [(0.0, 0.0), (0.24, 0.0), (0.27, 0.15), (0.29, 0.36), (0.27, 0.6), (0.245, 0.72), (0.0, 0.72)], n, 0.72, seed)
    hoops(k, Mp, ((0.08, 0.255), (0.36, 0.293), (0.65, 0.262)), n)


def tub(k, Mw, Mp):
    """An open tub round the origin, 0.3 tall, water near its rim and fish standing heads up in it."""
    n = 12
    staved(k, Mw, [(0.0, 0.0), (0.23, 0.0), (0.27, 0.3), (0.245, 0.3), (0.215, 0.05), (0.0, 0.05)], n, 0.3, 3)
    hoops(k, Mp, ((0.07, 0.237), (0.24, 0.263)), n)
    k.lathe((0, 0.25, 0), [(0.0, 0.0), (0.24, 0.0)], Mp, "#7cc4d8", n=n)
    for i, (a, col) in enumerate(((0.3, "#4f8fd8"), (2.2, "#35b3a6"), (4.1, "#6fa8e8"), (5.4, "#9a63d1"))):
        lean = Vector((0.25 * math.cos(a), -1, 0.25 * math.sin(a)))
        fish(k, Mp, (0.09 * math.cos(a), 0.33 + 0.03 * (i % 2), 0.09 * math.sin(a)), tuple(lean), 0.36, col,
             flat=(-math.sin(a), 0, math.cos(a)))


def tray(k, Mw, Mp):
    """The display crate's tray in its own frame (floor at y 0, the buyer +z): a plank floor, a low front and a tall
    back, a bed of ice, and the catch heaped on it."""
    k.rbox((0, -0.02, 0), (1.22, 0.05, 0.8), 0.012, Mw, WOOD_DARK, segs=1, v_axis=0)
    for x0, x1, z, h in ((-0.64, 0.64, 0.41, 0.15), (-0.64, 0.64, -0.41, 0.34)):          # the front and the back
        for j, y in enumerate(np.arange(0.0, h, 0.085)[:3]):
            hh = min(0.08, h - y)
            col = CORAL if (z > 0 and j == 1) else mix(WOOD, WOOD_LIGHT if j % 2 else WOOD_DARK, rng.uniform(0.1, 0.5))
            k.rbox((0, y + hh / 2, z), (x1 - x0, hh - 0.008, 0.05), 0.012, Mw if col != CORAL else Mp, col, segs=1, v_axis=0,
                   uv_off=(rng.random(), rng.random()))
    for sx in (-1, 1):                                                                       # the sides, stepping up to the back
        for y0, y1, z0, z1 in ((0.0, 0.15, -0.43, 0.43), (0.16, 0.3, -0.43, -0.02)):
            k.rbox((sx * 0.625, (y0 + y1) / 2, (z0 + z1) / 2), (0.05, y1 - y0, z1 - z0), 0.012, Mw,
                   mix(WOOD, WOOD_DARK, rng.uniform(0.1, 0.5)), segs=1, v_axis=2)
    k.blob((0, 0.02, 0), (0.58, 0.05, 0.38), Mp, "#dff0f3", segs=12, rings=4, seed=4, lumpy=0.25, flat_bottom=-0.01)
    heap = ((-0.3, 0.09, 0.17, 0.15, 0.55, "#4f8fd8"), (0.26, 0.09, 0.19, -0.2, 0.55, "#9a63d1"), (-0.26, 0.09, -0.16, 3.0, 0.5, "#35b3a6"),
            (0.27, 0.09, -0.17, 2.9, 0.52, "#f08a3c"), (0.0, 0.1, 0.0, 1.4, 0.5, "#f2c84b"), (-0.06, 0.15, 0.13, 0.4, 0.6, "#6fa8e8"),
            (0.2, 0.15, 0.0, -2.6, 0.5, "#e8566b"), (-0.28, 0.15, -0.05, 2.4, 0.45, "#9a63d1"), (0.02, 0.21, -0.12, 0.2, 0.46, "#4f8fd8"), (0.1, 0.22, 0.12, -0.5, 0.52, "#35b3a6"), (-0.12, 0.27, -0.02, 2.9, 0.5, "#f08a3c"))
    for x, y, z, yaw, L, col in heap:
        fish(k, Mp, (x, y, z), (math.cos(yaw), 0.0, math.sin(yaw)), L * 1.1, col)
    placed(k, K.game_rot(yaw=0.35), (-0.3, 0.2, 0.2), lambda: crab(k, Mp))
    placed(k, K.game_rot(yaw=-0.25), (0.33, 0.17, -0.15), lambda: octopus(k, Mp))
    placed(k, K.game_rot(roll=0.3, pitch=-0.35), (-0.36, 0.2, -0.32), lambda: starfish(k, Mp))


def net(k, Mp, top, bottom, cols, rows, belly, col=ROPE):
    """A knotted net hung between two lines of points (functions of u in 0..1), bellied out toward +z."""
    knots = []
    for j in range(rows + 1):
        t = j / rows
        row = []
        for i in range(cols + 1 - (j % 2)):
            u = (i + 0.5 * (j % 2)) / cols
            a, b = Vector(top(u)), Vector(bottom(u))
            row.append(tuple(a + (b - a) * t + Vector((0, 0, belly * math.sin(math.pi * t) * math.sin(math.pi * u)))))
        knots.append(row)
    for j in range(rows):
        nxt = knots[j + 1]
        for i, p in enumerate(knots[j]):
            for q in ((nxt[i - 1] if i >= 1 else None, nxt[i] if i < len(nxt) else None) if j % 2 == 0 else (nxt[i], nxt[i + 1])):
                if q is not None:
                    k.tube([p, q], 0.012, Mp, mix(col, "#7d6a48", 0.25), n=3, v_len=0.2)
    k.tube([top(u) for u in np.linspace(0, 1, 7)], 0.018, Mp, col, n=4)


def letters(k, Mp, text, cx, y, cap, z, col):
    """Raised brush letters (paintkit's hand-lettered strokes) on a board at depth z, rounded rods."""
    for st in PK.text_strokes(text, cx, y, cap, seed=2732, wobble=0.02):
        pts = PK._catmull(st, 2) if len(st) > 3 else st
        k.tube([(px, py, z) for px, py in pts], cap * 0.1, Mp, col, n=4, v_len=0.3, caps=True)


def sign(k, Mw, Mp):
    """The frame over the crate: two posts, a top bar the gulls sit on, the coral SELL board under it with a fish each
    side, a net sagging under the board, a fish hung off the left end and a lantern off the right."""
    for sx in (-1, 1):
        k.beam((sx * POST_X, 0.0, POST_Z), (sx * POST_X, POST_TOP, POST_Z), 0.11, 0.11, 0.025, Mw, WOOD_DARK, segs=1, uv_len=1.6)
    bar_y = POST_TOP - 0.05
    k.beam((-0.92, bar_y, POST_Z + 0.02), (0.95, bar_y, POST_Z + 0.02), 0.14, 0.1, 0.025, Mw, mix(WOOD, WOOD_DARK, 0.3), up=(0, 0, 1), segs=1)
    by, bw, bh, bz = 1.95, 1.18, 0.4, POST_Z + 0.09
    k.rbox((0, by, bz), (bw + 0.1, bh + 0.1, 0.05), 0.02, Mw, WOOD, segs=1, v_axis=0)
    k.rbox((0, by, bz + 0.03), (bw, bh, 0.03), 0.012, Mp, CORAL, segs=1)
    letters(k, Mp, "SELL", 0.0, by - 0.12, 0.25, bz + 0.05, CREAM)
    for sx in (-1, 1):
        fish(k, Mp, (sx * 0.47, by, bz + 0.06), (sx, 0.15, 0), 0.17, CREAM, flat=(0, 0, 1), eyes=())
        k.tube([(sx * 0.3, by + bh / 2 + 0.04, bz), (sx * 0.3, bar_y - 0.04, bz - 0.02)], 0.014, Mp, ROPE, n=4)
    lashing(k, Mp, (POST_X, 0, POST_Z), 0.07, bar_y - 0.02, wraps=2)
    bottom = by - bh / 2 - 0.03
    net(k, Mp, lambda u: (-POST_X + 0.08 + 1.12 * u, bottom, bz - 0.01),
        lambda u: (-POST_X + 0.08 + 1.12 * u, bottom - 0.08 - 0.3 * math.sin(math.pi * u), bz + 0.04), 7, 3, 0.04)
    for i, x in enumerate((-0.35, 0.0, 0.35)):
        k.blob((x, bottom - 0.12 - 0.28 * math.sin(math.pi * (x + 0.56) / 1.12), bz + 0.08), (0.045, 0.04, 0.045), Mp, FLOAT_RED if i != 1 else "#f2c84b", segs=6, rings=4)
    # Off the bar's left end, a fish on a cord; off its right end, a lantern on a hook.
    k.tube([(-0.84, bar_y - 0.05, POST_Z + 0.02), (-0.84, 1.78, POST_Z + 0.02)], 0.012, Mp, ROPE, n=4)
    fish(k, Mp, (-0.84, 1.58, POST_Z + 0.02), (0.08, 1, 0), 0.42, "#4f8fd8", flat=(0, 0, 1), eyes=(-1, 1))
    hook = 0.86
    k.tube([(hook, bar_y - 0.05, POST_Z + 0.02), (hook, bar_y - 0.12, POST_Z + 0.02), (hook - 0.025, bar_y - 0.16, POST_Z + 0.02)], 0.012, Mp, IRON, n=4)
    s = 0.85
    placed(k, Matrix.Identity(3), (hook - 0.025, bar_y - 0.16 - 0.493 * s, POST_Z + 0.02), lambda: iron_lantern(k, LANTERN, (0, 0, 0), s))
    for (x, yaw, sc) in ((-0.42, 0.5, 1.0), (0.24, -0.45, 0.88)):
        placed(k, K.game_rot(yaw=yaw) @ Matrix.Diagonal((sc, sc, sc)), (x, bar_y + 0.065, POST_Z + 0.02), lambda: gull(k, Mp))


def sell_stall(Mw, Mp):
    k = K.Kit("sell-barrel")
    R = Matrix.Rotation(TILT, 3, "X")
    placed(k, R, tuple(TRAY_C), lambda: tray(k, Mw, Mp))
    # Front legs up to the tray's underside; the back stands on the sign posts. A rail low across the front and sides.
    for sx in (-1, 1):
        top = tray_pt((sx * 0.57, -0.04, 0.35))
        k.beam((sx * 0.57, 0.0, top[2]), (sx * 0.57, top[1], top[2]), 0.09, 0.09, 0.02, Mw, WOOD_DARK, segs=1, uv_len=1.2)
        k.beam((sx * 0.6, 0.24, POST_Z), (sx * 0.6, 0.24, top[2]), 0.05, 0.08, 0.012, Mw, WOOD, segs=1)
        bk = tray_pt((sx * 0.6, -0.04, -0.4))
        k.beam((sx * 0.6, top[1] - 0.06, top[2]), (sx * 0.6, bk[1] - 0.04, bk[2]), 0.05, 0.08, 0.012, Mw, WOOD_LIGHT, segs=1)
    front = tray_pt((0, -0.04, 0.35))[2]
    k.beam((-0.62, 0.24, front + 0.05), (0.62, 0.24, front + 0.05), 0.08, 0.05, 0.012, Mw, WOOD, up=(0, 0, 1), segs=1)
    lip = lambda u: tray_pt((-0.6 + 1.2 * u, 0.02, 0.45))
    net(k, Mp, lip, lambda u: (-0.56 + 1.12 * u, 0.32 + 0.1 * abs(math.sin(math.pi * 3 * u)), front + 0.06), 6, 2, 0.05)
    sign(k, Mw, Mp)
    # Left: a barrel with a lantern on it, a tub of fish before it, a float. Right: a barrel with a coil of rope, a life ring.
    placed(k, K.game_rot(yaw=0.4), (-0.98, 0.0, -0.14), lambda: barrel(k, Mw, Mp, 1))
    placed(k, Matrix.Identity(3), (-0.98, 0.72, -0.14), lambda: iron_lantern(k, LANTERN, (0, 0, 0), 0.95))
    placed(k, K.game_rot(yaw=1.1), (-0.86, 0.0, 0.36), lambda: tub(k, Mw, Mp))
    k.blob((-1.2, 0.08, 0.3), (0.09, 0.075, 0.09), Mp, "#f2c84b", segs=7, rings=5)
    placed(k, K.game_rot(yaw=-0.7), (0.98, 0.0, -0.12), lambda: barrel(k, Mw, Mp, 4))
    coil(k, Mp, (0.98, 0.72, -0.12), r0=0.05, r1=0.17, turns=2.2, n=24)
    placed(k, K.game_rot(yaw=-0.45, pitch=-0.22), (0.97, 0.0, 0.25), lambda: ring_into(k, Mp, Mp, s=0.62, nu=16, nv=6, rope_n=32))
    k.tint_gradient(0.84, 1.0, 0.0, POST_TOP)
    return k.finish(smooth_deg=45)


def build():
    global LANTERN
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    paint = K.Mat("P_Paint", rough=0.45)
    base, emit = glass_tex()
    LANTERN = {"iron": paint, "glass": K.Mat("M_Glass", tex=K.image("lantern_pane", base * K.arr("#ffd9a0")),
                                              emit=K.image("lantern_glow", np.clip(emit * K.arr("#ffd6a0") * 1.12, 0, 1)), rough=0.7)}
    ob = sell_stall(wood, paint)
    K.export([ob], "game/wharf/sell-barrel.glb")
    report(ob)
    return ob


if __name__ == "__main__":
    ob = build()
    if "review" in ARGS:
        d = ARGS[ARGS.index("review") + 1]
        views = tuple(tuple(float(v) for v in a.split(":")) for a in ARGS if ":" in a) or ((200, 16), (150, 30), (250, 40))
        K.review([ob], os.path.join(d, "sell-stall.png"), views=views, size=600)
