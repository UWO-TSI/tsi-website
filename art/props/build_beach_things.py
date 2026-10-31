"""More for the new world's beach (game/wharf-art2; David's R2c note, 2026-10-26: "brainstorm for more beach stuff, maybe
beach balls you can play with"). The beach ball itself is the volleyball's (art/props/build_volleyball_ball.py, one
ball design). Our style: round, smooth, plain colours with the right light response, low detail.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_beach_things.py [-- review <dir>]

Writes, under web/public/assets/game/props/, each in game units at scale 1, the origin on the sand (y 0):
  beach-towel-{a,b}.glb   a striped towel laid on the sand along z (0.9 by 1.8), rumpled, a corner turned over.
  beach-lounger.glb       a wooden sun lounger along z, its backrest raised at -z (the sitter looks toward +z), a
                          striped cushion on it.
  sandcastle.glb          a sandcastle on its mound: a keep with crenels, two bucket-cast towers, walls, a gate, shells,
                          a little flag; a red bucket and a blue spade beside it.
  beach-cooler.glb        a blue cool box with a white lid and a carry handle.
  (The volleyball net moved to build_volleyball_net.py, remodelled at real proportions for game/volleyball.)

Wood is the wharf's grain (art/wharf/build_wharf_kit.py wood_mat); the rest the shared plain presets
(P_Paint for plastic and painted parts, P_Cloth, P_Stone for packed sand) with their colour in COLOR_0. Seeded.
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report, wood_mat  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/props/"
rng = np.random.default_rng(2740)
SAND, SAND_DARK, WHITE = "#e8cf9a", "#cfae74", "#f6f2e8"


def beach_towel(name, Mc):
    """A grid laid along z, its stripes across, rumpled by soft noise, the +z corner on +x turned back over itself."""
    k = K.Kit(f"beach-towel-{name}")
    Wd, L, nx, nz = 0.9, 1.8, 6, 14
    stripes = {"a": ("#3f86c8", WHITE, "#3fb8c4", WHITE), "b": ("#f2c94c", "#e8553c", "#f2c94c", WHITE)}[name]
    g = np.random.default_rng(7 if name == "a" else 9)
    ph = g.uniform(0, math.tau, 3)

    def at(u, v):
        y = 0.012 + 0.012 * (math.sin(5 * u + ph[0]) * math.sin(4 * v + ph[1]) + 0.6 * math.sin(9 * v + ph[2]))
        fold = u + v - 1.72                                # the corner turned back over the line u + v = 1.72
        if fold > 0:
            u, v, y = u - fold, v - fold, y + 0.022
        return ((u - 0.5) * Wd, max(y, 0.004), (v - 0.5) * L)
    for i in range(nx):
        for j in range(nz):
            q = [k.vert(at(u, v)) for u, v in ((i / nx, j / nz), ((i + 1) / nx, j / nz), ((i + 1) / nx, (j + 1) / nz), (i / nx, (j + 1) / nz))]
            band = int(j / nz * 7)
            col = stripes[band % len(stripes)] if 0 < band < 6 else stripes[0]
            k.face(q, [(i / nx * 2, j / nz * 4), ((i + 1) / nx * 2, j / nz * 4), ((i + 1) / nx * 2, (j + 1) / nz * 4), (i / nx * 2, (j + 1) / nz * 4)], Mc, col)
    return k.finish(smooth_deg=80)


def lounger(Mw, Mc):
    k = K.Kit("beach-lounger")
    wood, dark = "#c9a072", "#9c7550"
    L, Wd, y = 1.9, 0.62, 0.32
    for x in (-Wd / 2, Wd / 2):
        k.beam((x, y, -L / 2), (x, y, L / 2), 0.05, 0.08, 0.015, Mw, dark, segs=1)
        for z in (-L / 2 + 0.12, L / 2 - 0.12):
            k.beam((x, 0.0, z), (x, y, z), 0.06, 0.06, 0.01, Mw, dark, up=(0, 0, 1), segs=1)
    for i in range(9):                                   # the seat's slats, from the hinge at z -0.2 to the foot
        z = -0.2 + (i + 0.5) * (L / 2 + 0.2) / 9
        k.rbox((0, y + 0.05, z), (Wd + 0.06, 0.025, 0.1), 0.008, Mw, mix(wood, dark, rng.uniform(0, 0.3)), segs=1, uv_len=1.2, v_axis=0)
    ang = math.radians(48)                               # the backrest, raised at -z
    hz, hy, bl = -0.2, y + 0.05, 0.78
    for i in range(7):
        t = (i + 0.5) / 7
        k.rbox((0, hy + math.sin(ang) * bl * t, hz - math.cos(ang) * bl * t), (Wd + 0.02, 0.025, 0.1), 0.008, Mw, mix(wood, dark, rng.uniform(0, 0.3)),
               rot=K.game_rot(pitch=ang), segs=1, uv_len=1.2, v_axis=0)
    for x in (-Wd / 2 + 0.04, Wd / 2 - 0.04):
        k.beam((x, hy - 0.02, hz), (x, hy + math.sin(ang) * bl - 0.02, hz - math.cos(ang) * bl), 0.04, 0.04, 0.01, Mw, dark, segs=1)
        k.beam((x, y, -0.62), (x, hy + math.sin(ang) * bl * 0.55, hz - math.cos(ang) * bl * 0.55), 0.035, 0.035, 0.0, Mw, dark, segs=1)
    # The cushion: a soft pad on the seat and up the back, in stripes along its length.
    cols = ("#3fb8c4", WHITE)
    for i in range(6):
        z0 = -0.2 + i * (L / 2 + 0.15) / 6
        k.rbox((0, y + 0.1, z0 + (L / 2 + 0.15) / 12), (Wd - 0.04, 0.07, (L / 2 + 0.15) / 6 + 0.005), 0.03, Mc, cols[i % 2], segs=1)
    for i in range(4):
        t = (i + 0.5) / 4
        k.rbox((0, hy + 0.05 + math.sin(ang) * 0.7 * t, hz - 0.03 - math.cos(ang) * 0.7 * t), (Wd - 0.04, 0.07, 0.7 / 4 + 0.005), 0.03, Mc,
               cols[(i + 1) % 2], rot=K.game_rot(pitch=ang), segs=1)
    k.tint_gradient(0.84, 1.0, 0.0, 1.0)
    return k.finish(smooth_deg=45)


def sandcastle(Ms, Mp, Mc):
    k = K.Kit("sandcastle")
    k.blob((0, 0.0, 0), (0.62, 0.12, 0.55), Ms, SAND_DARK, segs=14, rings=5, seed=3, lumpy=0.25, flat_bottom=0.0)

    def tower(x, z, r, h, crown):
        prof = [(r * 1.12, 0.0), (r, h * 0.35), (r * 1.04, h * 0.37), (r * 0.94, h * 0.7), (r * 0.98, h * 0.72), (r * 0.88, h)]
        k.lathe((x, 0.04, z), prof + [(r * 0.6, h), (r * 0.6, h - 0.04), (0.0, h - 0.04)], Ms, SAND, n=12,
                wobble=lambda kk, i: 1 + 0.04 * math.sin(kk * 2.7 + x * 9))
        for j in range(crown):
            a = math.tau * j / crown
            k.rbox((x + math.cos(a) * r * 0.75, 0.04 + h + 0.035, z + math.sin(a) * r * 0.75), (r * 0.42, 0.08, r * 0.3), 0.012, Ms, SAND,
                   rot=K.game_rot(yaw=-a), segs=1)
    tower(0.0, -0.08, 0.24, 0.5, 6)
    tower(-0.36, 0.2, 0.14, 0.32, 4)
    tower(0.36, 0.2, 0.14, 0.32, 4)
    k.rbox((0, 0.15, 0.24), (0.6, 0.22, 0.1), 0.03, Ms, mix(SAND, SAND_DARK, 0.3), segs=1)
    k.blob((0, 0.12, 0.3), (0.07, 0.09, 0.02), Mp, "#7a5d3e", segs=8, rings=4)                         # the gate
    for j in range(4):
        k.rbox((-0.21 + j * 0.14, 0.29, 0.24), (0.07, 0.06, 0.1), 0.01, Ms, SAND, segs=1)
    for (x, y, z), col in (((0.12, 0.3, 0.12), "#f2b0a8"), ((-0.18, 0.18, 0.31), WHITE), ((0.3, 0.1, 0.38), "#f2b0a8"), ((-0.45, 0.08, -0.15), WHITE)):
        k.blob((x, y, z), (0.035, 0.02, 0.03), Mp, col, segs=6, rings=3)                                # shells
    k.tube([(0.0, 0.5, -0.08), (0.0, 0.78, -0.08)], 0.008, Mp, "#9c7550", n=4)
    k.extrude([(0.16, 0.7), (0.0, 0.76), (0.0, 0.62)], -0.004, 0.004, Mc, "#e8553c", at=(0.0, 0, -0.08))
    # The bucket, tipped on its side, and the spade stuck in the sand.
    bx, bz = 0.62, 0.42
    k.lathe((bx, 0.11, bz), [(0.0, -0.1), (0.08, -0.1), (0.11, 0.1), (0.1, 0.1), (0.075, -0.08), (0.0, -0.08)], Mp, "#e8553c", d=(0.85, 0.0, 0.5), n=12)
    k.tube([(bx - 0.0, 0.2, bz - 0.05), (bx + 0.1, 0.25, bz + 0.0), (bx + 0.1, 0.15, bz + 0.1)], 0.006, Mp, "#e8d9b8", n=4)
    sx, sz = -0.6, 0.38
    k.tube([(sx, -0.02, sz), (sx + 0.05, 0.36, sz + 0.03)], 0.014, Mp, "#3f86c8", n=6)
    k.rbox((sx + 0.06, 0.4, sz + 0.035), (0.09, 0.03, 0.03), 0.008, Mp, "#3f86c8", segs=1)
    k.tint_gradient(0.82, 1.0, 0.0, 0.6)
    return k.finish(smooth_deg=55)


def cooler(Mp, Mm):
    k = K.Kit("beach-cooler")
    W, D, H = 0.6, 0.4, 0.38
    k.rbox((0, H / 2, 0), (W, H, D), 0.05, Mp, "#3f86c8", segs=2)
    k.rbox((0, H + 0.035, 0), (W + 0.03, 0.07, D + 0.03), 0.035, Mp, WHITE, segs=2)
    k.rbox((0, H * 0.45, D / 2 + 0.003), (W - 0.12, 0.08, 0.01), 0.004, Mp, WHITE, segs=1)                 # the band
    for s in (-1, 1):                                   # the handle's pivots and the handle laid back on the lid
        k.lathe((s * (W / 2 + 0.01), H - 0.06, 0), [(0.0, 0.0), (0.035, 0.0), (0.035, 0.02), (0.0, 0.02)], Mp, WHITE, d=(s, 0, 0), n=8)
    k.tube([(-W / 2 - 0.02, H - 0.06, 0), (-W / 2 - 0.02, H + 0.06, -0.05), (-0.2, H + 0.09, -0.1), (0.2, H + 0.09, -0.1), (W / 2 + 0.02, H + 0.06, -0.05),
            (W / 2 + 0.02, H - 0.06, 0)], 0.016, Mp, WHITE, n=6)
    k.lathe((W / 2 - 0.08, 0.06, D / 2 + 0.005), [(0.0, 0.0), (0.025, 0.0), (0.025, 0.015), (0.0, 0.015)], Mp, WHITE, d=(0, 0, 1), n=8)     # the drain plug
    k.tint_gradient(0.84, 1.0, 0.0, H + 0.1)
    return k.finish(smooth_deg=50)


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    paint, cloth, stone, metal = K.Mat("P_Paint", rough=0.45), K.Mat("P_Cloth", rough=1.0), K.Mat("P_Stone", rough=0.95), K.Mat("P_Metal", rough=0.4)
    jobs = [(f"beach-towel-{n}", (lambda n=n: beach_towel(n, cloth))) for n in "ab"]
    jobs += [("beach-lounger", lambda: lounger(wood, cloth)), ("sandcastle", lambda: sandcastle(stone, paint, cloth)),
             ("beach-cooler", lambda: cooler(paint, metal))]
    obs = {}
    for name, fn in jobs:
        ob = fn()
        K.export([ob], f"{OUT}{name}.glb")
        report(ob)
        obs[name] = ob
    return obs


def scene(obs, out, views):
    import bpy
    shown = []
    spots = {"beach-towel-a": (-2.3, 0.6, 0.15), "beach-towel-b": (-1.2, 0.8, -0.1), "beach-lounger": (0.3, 0.9, 0.0), "beach-cooler": (1.3, 0.9, 0.3),
             "sandcastle": (0.6, 2.6, 0.0)}
    for name, (x, z, yaw) in spots.items():
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G(x, 0, z)
        o.rotation_euler = (0, 0, yaw)
        shown.append(o)
        obs[name].hide_render = True
    me = bpy.data.meshes.new("sand")
    me.from_pydata([K.G(-4, 0, -4), K.G(4, 0, -4), K.G(4, 0, 4), K.G(-4, 0, 4)], [], [(0, 1, 2, 3)])
    sand = bpy.data.objects.new("sand", me)
    bpy.context.scene.collection.objects.link(sand)
    me.materials.append(K.Mat("M_Sand", "#efdcb2", rough=1.0).m)
    bpy.context.view_layer.update()
    K.review(shown, out, views=views, size=1000)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        views = tuple(tuple(float(v) for v in a.split(":")) for a in ARGS if ":" in a) or ((200, 30), (150, 42))
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "beach-things.png"), views)
