"""The new world's beach set (game/wharf-art, David's note 6 of 2026-10-26: "beach should have a sushi bar, should have
coral in the shallow waters ... some surfboard sticking in the sand, a life guard tower"). Our style: simple shapes,
plain colours, low detail. The sushi bar is its own builder now (art/buildings/build_sushi_bar.py, game/sushi-bar).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_beach_set.py [-- review <dir>]

Writes, in game units at scale 1, the origin on the ground (y 0):
  game/props/lifeguard-tower.glb  a white lifeguard tower: splayed legs braced in two tiers, a deck at 2.7 with a rail, a hut
                                  with a red and white roof, a ladder up its front (+z), a flag, a life ring.
  game/props/surfboard-{a,b,c}.glb  a surfboard stuck nose up in the sand, leaning a little, its tail under y 0.
  game/water/coral-{a,b,c,d}.glb  low coral clumps for the shallows, their foot on the seabed: a staghorn (a), a brain
                                  coral (b), sea fans (c), tube coral (d).

Wood is the wharf's (art/wharf/build_wharf_kit.py wood_mat), rope its rope; the rest are the shared plain presets
(P_Paint, P_Cloth, P_Wood, P_Glass, P_Stone: lib/game/modelMaterials MATERIAL_PRESETS) with their colour in COLOR_0.
Seeded: a rebuild writes the same models. Prints each model's triangles and bounds.
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report, wood_mat  # noqa: E402
from build_dock_decor import FLOAT_RED, ROPE, ring_into  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
rng = np.random.default_rng(2627)
WOOD, WOOD_LIGHT = "#9c7550", "#d4b088"


def prism(k, M, pts, x0, x1, col):
    """A flat shape in the y-z plane (counter-clockwise seen from +x) thickened from x0 to x1."""
    a = [k.vert((x1, y, z)) for y, z in pts]
    b = [k.vert((x0, y, z)) for y, z in pts]
    uv = [(0, 0)] * 4
    k.face(a, [(0, 0)] * len(a), M, col)
    k.face(list(reversed(b)), [(0, 0)] * len(b), M, col)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        k.face([b[i], b[j], a[j], a[i]], uv, M, col)


# ================================================================ the lifeguard tower
def lifeguard_tower(Mw, Mr, Mp, Mc):
    k = K.Kit("lifeguard-tower")
    white, deck_y = "#f1ede4", 2.7          # game/wharf-art2: 1.5 x the first tower's 1.8 (David, R2c: "light guard tower taller")
    leg = lambda s, y: s * (0.95 - 0.4 * y / deck_y)     # the legs splay from 0.95 out at the foot to 0.55 under the deck
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.beam((leg(sx, 0), 0.0, leg(sz, 0)), (leg(sx, deck_y), deck_y, leg(sz, deck_y)), 0.13, 0.13, 0.02, Mp, white, segs=1)
    for y0, y1 in ((0.25, 1.35), (1.35, 2.45)):     # cross braces in two tiers on the sides and the back, a ring beam between
        for sz in (-1, 1):
            k.beam((leg(-1, y0), y0, leg(sz, y0)), (leg(1, y1), y1, leg(sz, y1)), 0.06, 0.06, 0.01, Mp, white, segs=1, up=(0, 0, 1))
        k.beam((leg(-1, y0), y0, leg(-1, y0)), (leg(-1, y1), y1, leg(1, y1)), 0.06, 0.06, 0.01, Mp, white, segs=1, up=(1, 0, 0))
        k.beam((leg(1, y0), y0, leg(1, y0)), (leg(1, y1), y1, leg(-1, y1)), 0.06, 0.06, 0.01, Mp, white, segs=1, up=(1, 0, 0))
    y = 1.35
    for a, b in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
        k.beam((leg(a[0], y), y, leg(a[1], y)), (leg(b[0], y), y, leg(b[1], y)), 0.08, 0.08, 0.01, Mp, white, segs=1)
    k.rbox((0, deck_y + 0.05, 0), (1.5, 0.1, 1.5), 0.02, Mw, mix(WOOD, WOOD_LIGHT, 0.6), segs=1, uv_len=1.5, v_axis=0)
    for x in (-0.7, 0.7):  # the rail round the front half
        k.beam((x, deck_y + 0.1, 0.7), (x, deck_y + 0.75, 0.7), 0.05, 0.05, 0.01, Mp, white, segs=1, up=(0, 0, 1))
    k.beam((-0.72, deck_y + 0.72, 0.7), (-0.25, deck_y + 0.72, 0.7), 0.05, 0.05, 0.01, Mp, white, segs=1)
    k.beam((0.25, deck_y + 0.72, 0.7), (0.72, deck_y + 0.72, 0.7), 0.05, 0.05, 0.01, Mp, white, segs=1)
    # The hut on the back of the deck: three walls, open to the front, a striped roof.
    hy = deck_y + 0.1
    k.rbox((0, hy + 0.55, -0.62), (1.3, 1.1, 0.07), 0.015, Mp, white, segs=1)
    for x in (-0.62, 0.62):
        k.rbox((x, hy + 0.35, -0.3), (0.07, 0.7, 0.62), 0.015, Mp, white, segs=1)
        k.beam((x, hy, 0.0), (x, hy + 1.25, 0.0), 0.06, 0.06, 0.01, Mp, white, segs=1, up=(0, 0, 1))
    for i in range(6):   # the roof: six boards over the hut, red and white, falling to the back
        x = -0.75 + (i + 0.5) * 0.25
        k.beam((x, hy + 1.3, 0.25), (x, hy + 1.1, -0.8), 0.25, 0.05, 0.01, Mp, FLOAT_RED if i % 2 == 0 else white, segs=1)
    # The ladder up the front, a flag on a pole at the corner, a life ring on the rail.
    for x in (-0.25, 0.25):
        k.beam((x, 0.0, 1.85), (x, deck_y + 0.1, 0.72), 0.06, 0.05, 0.01, Mw, WOOD_LIGHT, segs=1)
    for i in range(1, 10):
        t = i / 10
        k.beam((-0.25, t * (deck_y + 0.1), 1.85 - 1.13 * t), (0.25, t * (deck_y + 0.1), 1.85 - 1.13 * t), 0.05, 0.04, 0.01, Mw, WOOD, segs=1)
    k.tube([(0.7, deck_y, -0.7), (0.7, deck_y + 2.0, -0.7)], 0.025, Mp, "#9aa0a6", n=6, v_len=1.0)
    prism(k, Mc, [(deck_y + 1.95, -0.7), (deck_y + 1.55, -0.7), (deck_y + 1.75, -0.12)], 0.69, 0.71, "#e8553c")
    ring_into(k, Mp, Mr, c=(-0.48, deck_y + 0.1, 0.76), s=0.6)
    k.tint_gradient(0.86, 1.0, 0.0, deck_y + 1.7)
    return k.finish(smooth_deg=40)


# ================================================================ surfboards
BOARDS = {"a": ("#3fb8c4", "#f6f2e6"), "b": ("#f2c94c", "#e2553e"), "c": ("#ef8a8a", "#f6f2e6")}


def board_outline(L=2.1, W=0.5, n=10):
    """Counter-clockwise in (x, y): the tail at y 0, the nose at y L."""
    right = []
    for i in range(n + 1):
        t = i / n
        y = L * t
        w = W / 2 * (math.sin(math.pi * (0.06 + 0.9 * t)) ** 0.8) * (1 - 0.15 * t)
        right.append((w, y))
    left = [(-x, y) for x, y in reversed(right[1:-1])]
    return right + [(0.0, L + 0.03)] + left + [(0.0, -0.02)]


def surfboard(name, Mp):
    k = K.Kit(f"surfboard-{name}")
    body, stripe = BOARDS[name]
    rot = K.game_rot(yaw={"a": 0.2, "b": -0.3, "c": 0.6}[name], pitch=-0.12, roll={"a": 0.1, "b": -0.08, "c": 0.05}[name])
    at = (0.0, -0.35, 0.0)
    k.extrude(board_outline(), -0.035, 0.035, Mp, body, bevel=0.025, rot=rot, at=at)
    sw = 0.05
    k.extrude([(sw, 0.25), (sw, 1.85), (-sw, 1.85), (-sw, 0.25)], 0.036, 0.042, Mp, stripe, rot=rot, at=at)
    k.extrude([(sw, 0.25), (-sw, 0.25), (-sw, 1.85), (sw, 1.85)], -0.042, -0.036, Mp, stripe, rot=rot, at=at)
    return k.finish(smooth_deg=50)


# ================================================================ coral
def coral_a(Ms):   # a staghorn: branches forking up from one foot
    k = K.Kit("coral-a")
    col = "#ef8f8f"
    def branch(p, d, length, r, depth):
        q = (p[0] + d[0] * length, p[1] + d[1] * length, p[2] + d[2] * length)
        mid = ((p[0] + q[0]) / 2 + rng.uniform(-0.04, 0.04), (p[1] + q[1]) / 2, (p[2] + q[2]) / 2 + rng.uniform(-0.04, 0.04))
        k.tube([p, mid, q], r, Ms, mix(col, "#f7c2b6", 0.2 * depth), n=6, v_len=0.3, caps=depth == 2, radii=[1.0, 0.85, 0.7])
        if depth < 2:
            for _ in range(2):
                a, e = rng.uniform(0, math.tau), rng.uniform(0.5, 0.9)
                nd = np.array((math.cos(a) * math.cos(e), math.sin(e), math.sin(a) * math.cos(e))) * 0.5 + np.array(d) * 0.5
                nd /= np.linalg.norm(nd)
                branch(q, tuple(nd), length * 0.75, r * 0.7, depth + 1)
    for a in (0.3, 2.4, 4.5):
        branch((0.0, -0.05, 0.0), (math.cos(a) * 0.45, 0.9, math.sin(a) * 0.45), 0.32, 0.06, 0)
    k.blob((0, 0.0, 0), (0.18, 0.08, 0.18), Ms, mix(col, "#b8706a", 0.4), segs=8, rings=4, flat_bottom=0.0)
    return k.finish(smooth_deg=60)


def coral_b(Ms):   # a brain coral: a lumpy dome and a smaller one
    k = K.Kit("coral-b")
    k.blob((0, 0.0, 0), (0.42, 0.3, 0.38), Ms, "#c9c35e", segs=12, rings=7, seed=4, lumpy=0.25, flat_bottom=0.0)
    k.blob((0.38, 0.0, 0.22), (0.2, 0.16, 0.2), Ms, "#b9c06a", segs=10, rings=6, seed=6, lumpy=0.3, flat_bottom=0.0)
    for v in k.bm.verts:
        v.co.z = max(v.co.z, 0.0)
    return k.finish(smooth_deg=70)


def fan_outline(R, n=13):
    pts = [(0.03, 0.0)]
    for i in range(n + 1):
        a = math.radians(15 + 150 * i / n)
        r = R * (0.9 + 0.1 * math.cos(i * 2.3)) * (0.92 if i % 2 else 1.0)
        pts.append((math.cos(a) * r, 0.15 + math.sin(a) * r))
    pts.append((-0.03, 0.0))
    return list(reversed(pts))


def coral_c(Ms):   # sea fans: two flat lobed fans on short stalks
    k = K.Kit("coral-c")
    for (x, z, yaw, R, col) in ((0.0, 0.0, 0.2, 0.42, "#9b6cc4"), (0.28, 0.18, -0.6, 0.3, "#c47ab8")):
        k.extrude(fan_outline(R), -0.02, 0.02, Ms, col, bevel=0.012, rot=K.game_rot(yaw=yaw), at=(x, 0.0, z))
    k.blob((0.1, 0.0, 0.05), (0.14, 0.06, 0.12), Ms, "#7d5a8a", segs=8, rings=4, flat_bottom=0.0)
    return k.finish(smooth_deg=50)


def coral_d(Ms):   # tube coral: a cluster of open tubes, their rims lighter
    k = K.Kit("coral-d")
    for i, (x, z, h, r) in enumerate(((0, 0, 0.42, 0.08), (0.15, 0.05, 0.3, 0.07), (-0.12, 0.1, 0.34, 0.07), (0.05, -0.14, 0.26, 0.06),
                                       (-0.08, -0.1, 0.2, 0.055))):
        k.lathe((x, 0.0, z), [(r * 1.1, 0.0), (r, h * 0.6), (r * 1.15, h), (r * 0.7, h), (r * 0.6, h * 0.7)], Ms,
                mix("#f2a04a", "#f6d07a", i * 0.15), n=8)
    return k.finish(smooth_deg=60)


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    paint, cloth = K.Mat("P_Paint", rough=0.45), K.Mat("P_Cloth", rough=1.0)
    stone = K.Mat("P_Stone", rough=0.95)
    jobs = [("game/props/lifeguard-tower", lambda: lifeguard_tower(wood, rope, paint, cloth))]
    jobs += [(f"game/props/surfboard-{n}", (lambda n=n: surfboard(n, paint))) for n in BOARDS]
    jobs += [(f"game/water/coral-{n}", (lambda f=f: f(stone))) for n, f in zip("abcd", (coral_a, coral_b, coral_c, coral_d))]
    obs = {}
    for path, fn in jobs:
        ob = fn()
        K.export([ob], f"{path}.glb")
        report(ob)
        obs[os.path.basename(path)] = ob
    return obs


def scene(obs, out):
    import bpy
    shown = []
    spots = {"lifeguard-tower": (5.0, -0.5), "surfboard-a": (3.4, 2.4), "surfboard-b": (3.9, 2.6), "surfboard-c": (4.4, 2.3),
             "coral-a": (-4.2, 2.6), "coral-b": (-3.2, 3.0), "coral-c": (-4.4, 3.6), "coral-d": (-3.4, 3.9)}
    for name, (x, z) in spots.items():
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G(x, 0, z)
        shown.append(o)
        obs[name].hide_render = True
    bpy.context.view_layer.update()
    K.review(shown, out, views=((200, 30), (150, 40)), size=1000)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "beach-set.png"))
