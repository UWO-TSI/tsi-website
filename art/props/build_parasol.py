"""The beach parasol by the pier table (study/StudySeats.tsx, the pier's table; the homes' "Parasol"): our own canvas
parasol with two timber deck chairs under it, in faded autumn stripes. Replaces acnh/props/beach-parasol.glb (the dump's
parasol over two loungers).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_parasol.py [-- review <dir>]

Writes web/public/assets/game/props/beach-parasol.glb. Frame: the old set's, game units at scale 1, the pole's foot at
the origin, the set inside x +-1.0, z +-1.0, the canopy's top 2.33 up; the chairs face -z (out to sea at the pier).

A timber parasol on a crossed-board foot: a pole with a runner, eight ribs and their stretchers, a canopy of eight
gores in faded rust and cream canvas with a mustard and cream scalloped valance, a turned finial. Under it two folding
deck chairs, their frames of rounded teak, the slings in faded stripes of rust, cream, mustard and sage. Two
materials: M_Canvas (an atlas: plain weave tinted by COLOR_0 for the canopy, the striped sling canvas), M_ParasolWood.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402
from propkit import TAU  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
APEX, RIM_R, RIM_Y = 2.3, 1.0, 1.95
GORES = 8
RUNNER_Y = 1.5
TEAK = "#b5875a"
GORE_TINT = ("#c46e4a", "#efe2c6")
VALANCE_TINT = ("#d9a441", "#efe2c6")


def canvas_atlas():
    """512 x 256: u 0..0.5 plain faded weave (the canopy, its colour from COLOR_0); u 0.5..1 the sling's stripes."""
    out = np.zeros((256, 512, 3))
    out[:, :256] = PK.canvas(256, 256, 121, stripes=("#f4ede0",), n=1, fade=0.25)
    out[:, 256:] = PK.canvas(256, 256, 122, stripes=("#c46e4a", "#eadcbc", "#d9a441", "#eadcbc", "#9aa77e", "#eadcbc"), n=6, fade=0.4)
    return out


def rib(f, a, sag=0.0):
    """A point on the canopy at fraction f out from the apex, angle a; `sag` drops it between the ribs."""
    r = RIM_R * f
    y = APEX - (APEX - RIM_Y) * f ** 1.5 - sag * math.sin(math.pi * f) * 0.6 - sag * f
    return Vector((math.sin(a) * r, y, math.cos(a) * r))


def chair(k, M, at, yaw):
    """A folding deck chair facing -z in its own frame, turned by yaw and set at `at` (game x, z)."""
    c, s = math.cos(yaw), math.sin(yaw)
    P = lambda x, y, z: (at[0] + x * c + z * s, y, at[1] - x * s + z * c)
    up = (0, 1, 0)
    for side in (-1, 1):
        x = side * 0.27
        # The main rails: from the ground near the front up and back to the top of the back.
        k.beam(P(x, 0.0, -0.16), P(x, 0.94, 0.4), 0.04, 0.022, 0.008, M["wood"], TEAK, up=(0, 0, -1), segs=1)
        # The front legs and seat rails, resting back on the main rails.
        k.beam(P(x + side * 0.03, 0.0, -0.47), P(x + side * 0.03, 0.47, -0.36), 0.038, 0.022, 0.008, M["wood"], TEAK, segs=1)
        k.beam(P(x + side * 0.03, 0.47, -0.36), P(x + side * 0.03, 0.37, 0.1), 0.038, 0.022, 0.008, M["wood"], TEAK, up=up, segs=1)
        # The rear legs, pivoted on the main rails.
        k.beam(P(x - side * 0.035, 0.0, 0.55), P(x - side * 0.035, 0.5, 0.17), 0.036, 0.022, 0.008, M["wood"], TEAK, segs=1)
    for (y, z, w) in ((0.94, 0.4, 0.6), (0.47, -0.36, 0.66), (0.08, 0.5, 0.48), (0.04, -0.43, 0.66)):
        k.tube([P(-w / 2, y, z), P(w / 2, y, z)], 0.014, M["wood"], TEAK, n=6, v_len=0.6, caps=True, u_tiles=0.5)
    # The sling: from the top bar to the front bar, sagging into a seat; stripes run down it.
    top, front = Vector(P(0, 0.94, 0.4)), Vector(P(0, 0.47, -0.36))
    across = Vector((c, 0, -s))
    back = Vector((s, 0, c))
    rows, uvs = [], []
    n = 10
    for i in range(n + 1):
        t = i / n
        p = top.lerp(front, t) + Vector((0, -0.24, 0)) * math.sin(math.pi * t) ** 1.2 + back * 0.08 * math.sin(math.pi * t)
        p += Vector((0, 0.014, 0)) * (1 if i in (0, n) else 0)
        rows.append([tuple(p - across * 0.235), tuple(p + across * 0.235)])
        uvs.append([(0.52, 1 - t * 0.95), (0.98, 1 - t * 0.95)])
    k.ring_grid(rows, uvs, M["canvas"], "#ffffff", closed=False)


def build():
    K.reset()
    M = {
        "canvas": K.Mat("M_Canvas", tex=K.image("parasol_canvas", canvas_atlas()), rough=0.96),
        "wood": K.Mat("M_ParasolWood", tex=K.image("parasol_wood", K.grain(256, 128, 123, "#ffffff", knots=1)), rough=0.88),
    }
    k = K.Kit("beach-parasol")
    # The foot: two crossed boards and a block round the pole.
    for yaw in (0.35, 0.35 + math.pi / 2):
        k.rbox((0, 0.025, 0), (0.07, 0.05, 0.62), 0.012, M["wood"], "#9c7350", rot=K.game_rot(yaw=yaw), segs=1)
    k.rbox((0, 0.09, 0), (0.12, 0.09, 0.12), 0.015, M["wood"], "#9c7350", segs=1)
    # The pole, its runner, the finial.
    k.lathe((0, 0, 0), [(0.0, 0.0), (0.026, 0.0), (0.024, 1.0), (0.022, APEX), (0.0, APEX + 0.01)], M["wood"], TEAK, n=10, u_tiles=0.5, v_len=1.0)
    k.lathe((0, RUNNER_Y - 0.05, 0), [(0.0, 0.0), (0.04, 0.0), (0.042, 0.05), (0.04, 0.1), (0.0, 0.1)], M["wood"], "#9c7350", n=10, u_tiles=0.5)
    k.blob((0, APEX + 0.05, 0), (0.035, 0.05, 0.035), M["wood"], "#9c7350", segs=10, rings=6)
    # The canopy: eight gores, each a little dome between its ribs, sagging between them.
    fs = [0.0, 0.25, 0.5, 0.75, 1.0]
    for g in range(GORES):
        a0, a1 = TAU * g / GORES, TAU * (g + 1) / GORES
        am = (a0 + a1) / 2
        rows, uvs = [], []
        for f in fs:
            pts = [rib(f, a0), rib(f, am, sag=0.03), rib(f, a1)] if f > 0 else [rib(0, a0)]
            rows.append([tuple(p) for p in pts])
            uvs.append([(0.02 + 0.46 * (0.5 - 0.5 * f + j * 0.5 * f), 0.05 + 0.9 * f) for j in range(3)] if f > 0 else [(0.25, 0.05)])
        k.ring_grid(rows, uvs, M["canvas"], GORE_TINT[g % 2], closed=False)
        # The valance: a scalloped flap hanging from the rim under this gore.
        n = 6
        top, bot, buv_t, buv_b = [], [], [], []
        for j in range(n + 1):
            t = j / n
            p0 = rib(1.0, a0).lerp(rib(1.0, a1), t)
            p0 = Vector((p0.x, p0.y - 0.004, p0.z))
            depth = 0.075 + 0.035 * math.sin(math.pi * t)
            top.append(tuple(p0))
            bot.append(tuple(p0 + Vector((0, -depth, 0)) + Vector((p0.x, 0, p0.z)).normalized() * 0.012))
            buv_t.append((0.02 + 0.46 * t, 0.97))
            buv_b.append((0.02 + 0.46 * t, 0.9))
        k.ring_grid([top, bot], [buv_t, buv_b], M["canvas"], VALANCE_TINT[g % 2], closed=False)
        # The rib under its seam, and the stretcher from the runner to it.
        rp = [tuple(rib(f, a0) - Vector((0, 0.014, 0))) for f in (0.08, 0.4, 0.7, 1.0)]
        k.tube(rp, 0.008, M["wood"], "#8a6444", n=4, v_len=0.5, u_tiles=0.25)
        mid = rib(0.55, a0) - Vector((0, 0.016, 0))
        k.tube([(math.sin(a0) * 0.04, RUNNER_Y, math.cos(a0) * 0.04), tuple(mid)], 0.006, M["wood"], "#8a6444", n=4, v_len=0.5, u_tiles=0.25)
    # Two deck chairs under it, turned a little toward each other, facing out to sea (-z).
    chair(k, M, (-0.45, -0.18), 0.22)
    chair(k, M, (0.47, -0.12), -0.18)
    k.tint_gradient(0.84, 1.0, 0.0, APEX)
    ob = k.finish(smooth_deg=55)
    path = K.export([ob], "game/props/beach-parasol.glb")
    print("PARASOL", {"apex": APEX, "rim": RIM_R})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "parasol.png"), views=((0, 14), (35, 30), (160, 24)))
