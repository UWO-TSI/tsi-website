"""The HQ's floor lamp and cone pendants (components/game/HQInterior.tsx, lib/game/clubhouse.ts HQ_LAYOUT.loungeLamp and
HQ_PENDANTS): our own, a fabric-drum floor lamp and a cone pendant in matte metal, the two sharing one metal material.
Replaces acnh/furniture/floor-lamp.glb and clubhouse-pendant.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_hq_lamps.py [-- review <dir>]

Writes web/public/assets/game/props/hq-floor-lamp.glb and hq-pendant.glb. Interior pieces: each is authored at the size
the dump piece shows at scale 0.1 (lib/game/propModels.ts REMODELLED_PIECES; a Piece draws it at its dump scale x 10), so
the room's layout and its lamps' lights stay where they were:
- the floor lamp stands 1.51 on its foot (origin on the floor under the stem), the drum shade from 1.12 to 1.5 round the
  bulb, 0.6 across; HQInterior's light sits at 1.52 in the room (inside the shade at the HQ's 0.115);
- the pendant hangs from its ceiling rose at the origin down 1.53 to the cone's rim, 0.54 across.

Materials: M_LampMetal (shared: matte metal, COLOR_0 gives each part its finish: the floor lamp's dark bronze, the
pendant's sage cone, brass trims), M_LampShade (linen; the drum and the bulb's warm white).
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from propkit import arr  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
BRONZE, BRASS, SAGE, CREAM_IN, LINEN, BULB = "#5b4a3a", "#b8955a", "#8a9a7c", "#f2e8d4", "#eadcc0", "#fff3dc"


def metal_tex():
    h = w = 128
    v = 0.92 + 0.07 * (K.fbm(h, w, 6, 91, 3) - 0.5) * 2 - 0.05 * K.smooth(0.78, 0.86, K.noise(h, w, 50, 92))
    return np.clip(v[..., None] * arr("#ffffff"), 0, 1)


def mats():
    return {
        "metal": K.Mat("M_LampMetal", tex=K.image("lamp_metal", metal_tex()), rough=0.7),
        "shade": K.Mat("M_LampShade", tex=K.image("lamp_linen", K.linen(128, 128, 93, threads=40)), rough=0.95),
    }


def floor_lamp():
    K.reset()
    M = mats()
    k = K.Kit("hq-floor-lamp")
    # The foot: a weighted round base, a turned collar, the stem, a switch knuckle, the shade's fitter.
    foot = [(0.0, 0.0), (0.155, 0.0), (0.165, 0.01), (0.162, 0.03), (0.14, 0.042), (0.06, 0.05), (0.036, 0.066), (0.03, 0.09),
            (0.016, 0.1), (0.014, 0.6), (0.022, 0.615), (0.022, 0.655), (0.014, 0.67), (0.012, 1.18), (0.02, 1.19), (0.02, 1.22),
            (0.0, 1.225)]
    k.lathe((0, 0, 0), foot, M["metal"], BRONZE, n=16, v_len=0.5)
    k.lathe((0, 0, 0), [(0.143, 0.042), (0.15, 0.05), (0.143, 0.058), (0.136, 0.05), (0.143, 0.042)], M["metal"], BRASS, n=16)
    # The bulb and the drum: linen outside, warm inside, rolled rims.
    k.blob((0, 1.28, 0), (0.05, 0.065, 0.05), M["shade"], BULB, segs=10, rings=6)
    drum_out = [(0.285, 1.12), (0.292, 1.13), (0.27, 1.49), (0.262, 1.5)]
    drum_in = [(0.262, 1.5), (0.255, 1.49), (0.275, 1.13), (0.285, 1.12)]
    k.lathe((0, 0, 0), drum_out, M["shade"], LINEN, n=24, u_tiles=4, v_len=0.4)
    k.lathe((0, 0, 0), drum_in, M["shade"], CREAM_IN, n=24, u_tiles=4, v_len=0.4)
    for y, r in ((1.12, 0.288), (1.5, 0.264)):
        k.tube([(r * math.sin(a), y, r * math.cos(a)) for a in np.linspace(0, math.tau, 25)[:-1]], 0.006, M["metal"], BRASS, n=5, closed_path=True)
    # The spider: three arms from the fitter to the top rim.
    for j in range(3):
        a = math.tau * j / 3
        k.tube([(0, 1.215, 0), (0.255 * math.sin(a), 1.48, 0.255 * math.cos(a))], 0.005, M["metal"], BRASS, n=5)
    k.tint_gradient(0.84, 1.0)
    ob = k.finish(smooth_deg=48)
    path = K.export([ob], "game/props/hq-floor-lamp.glb")
    print("FLOOR_LAMP", {"height": 1.5, "shade": [1.12, 1.5]})
    return ob


def pendant():
    K.reset()
    M = mats()
    k = K.Kit("hq-pendant")
    # The ceiling rose at the origin, the cord, a brass cap, the cone (sage out, cream in), the bulb peeking under it.
    k.lathe((0, 0, 0), [(0.0, 0.0), (0.075, 0.0), (0.075, -0.012), (0.06, -0.026), (0.012, -0.03), (0.0, -0.032)], M["metal"], SAGE, n=16)
    k.tube([(0, -0.03, 0), (0, -1.16, 0)], 0.0065, M["metal"], "#3c3a36", n=6, v_len=0.5)
    k.lathe((0, 0, 0), [(0.0, -1.14), (0.02, -1.15), (0.03, -1.17), (0.032, -1.2), (0.05, -1.21)], M["metal"], BRASS, n=12)
    cone_out = [(0.05, -1.205), (0.075, -1.24), (0.17, -1.38), (0.255, -1.5), (0.27, -1.52), (0.27, -1.53)]
    cone_in = [(0.262, -1.53), (0.247, -1.505), (0.165, -1.385), (0.07, -1.25), (0.045, -1.215), (0.0, -1.212)]
    k.lathe((0, 0, 0), cone_out, M["metal"], SAGE, n=24, v_len=0.5)
    k.lathe((0, 0, 0), [(0.27, -1.53), (0.266, -1.534), (0.262, -1.53)], M["metal"], BRASS, n=24)
    k.lathe((0, 0, 0), cone_in, M["metal"], CREAM_IN, n=24, v_len=0.5)
    k.blob((0, -1.43, 0), (0.06, 0.07, 0.06), M["shade"], BULB, segs=10, rings=6)
    k.tint_gradient(0.9, 1.0)
    ob = k.finish(smooth_deg=48)
    K.export([ob], "game/props/hq-pendant.glb")
    print("PENDANT", {"drop": 1.53, "across": 0.54})
    return ob


if __name__ == "__main__":
    which = [a for a in ARGS if a in ("floor", "pendant")] or ["floor", "pendant"]
    out = ARGS[ARGS.index("review") + 1] if "review" in ARGS else None
    if "floor" in which:
        ob = floor_lamp()
        if out:
            K.review([ob], os.path.join(out, "hq-floor-lamp.png"))
    if "pendant" in which:
        ob = pendant()
        if out:
            K.review([ob], os.path.join(out, "hq-pendant.png"))
