"""The wharf's channel buoys (components/game/wharf/Wharf.tsx; lib/game/wharf.ts BUOYS, floatBuoy): our own painted float
buoy with a rope ring, riding at the same waterline. Replaces acnh/props/buoy.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_buoy.py [-- review <dir>]

Writes web/public/assets/game/props/buoy.glb. Frame: game units at scale 1, the origin at the foot of its weighted stem;
the float meets the water 0.66 up (lib/game/propModels.ts BUOY_WATERLINE, as the old one did at its 0.085), its widest
just above it, 0.68 across, the top ring at 1.18.

A round float painted rust red with a cream band round its shoulder, worn at the edges, a darker weed line where the water
laps, a rope ring round its waist, a short mast with an iron ring on top (a lantern would hang there), and a weighted iron
stem under the water. Three materials: M_BuoyPaint (paint, COLOR_0 per band), M_Rope, M_Iron.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from propkit import arr, smooth  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WATERLINE = 0.66
RUST, CREAM, IRON, WEED = "#bf5a37", "#efe3c6", "#3b3a37", "#6f6a45"


def paint_tex():
    """Painted, weathered: a soft mottle, runs of rust streaking down (v), small chips."""
    h = w = 128
    U, V = K.grid(h, w)
    v = 0.92 + 0.06 * (K.fbm(h, w, 5, 121, 3) - 0.5) * 2
    streak = smooth(0.62, 0.8, K.noise(h, w, 18, 122, 3)) * 0.12
    chips = smooth(0.74, 0.8, K.fbm(h, w, 12, 123, 2)) * 0.25
    out = (v - streak)[..., None] * arr("#ffffff")
    out = out * (1 - chips[..., None]) + arr("#8d7d68") * chips[..., None]
    return np.clip(out, 0, 1)


def build():
    K.reset()
    M = {
        "paint": K.Mat("M_BuoyPaint", tex=K.image("buoy_paint", paint_tex()), rough=0.85),
        "rope": K.Mat("M_Rope", tex=K.image("buoy_rope", K.rope(128, 32, 124)), rough=1.0),
        "iron": K.Mat("M_Iron", "#3b3a37", rough=0.75),
    }
    k = K.Kit("buoy")
    # The float, bottom to top: the lower band rust, the upper cream; one turned shape in two pieces sharing a ring.
    # Rust below and up past the waterline, a cream band round the shoulder, a rust cap: red and white read from the pier.
    low = [(0.0, 0.42), (0.07, 0.425), (0.16, 0.46), (0.25, 0.53), (0.315, 0.62), (0.338, 0.68), (0.342, 0.74)]
    band = [(0.342, 0.74), (0.336, 0.79), (0.318, 0.84)]
    cap = [(0.318, 0.84), (0.27, 0.9), (0.19, 0.945), (0.1, 0.966), (0.0, 0.97)]
    k.lathe((0, 0, 0), low, M["paint"], RUST, n=22, u_tiles=2, v_len=0.5)
    k.lathe((0, 0, 0), band, M["paint"], CREAM, n=22, u_tiles=2, v_len=0.5)
    k.lathe((0, 0, 0), cap, M["paint"], RUST, n=22, u_tiles=2, v_len=0.5)
    # A weed line where the water laps: the paint darkens and greens just about the waterline.
    for f in k.bm.faces:
        for lp in f.loops:
            y = lp.vert.co.z
            t = math.exp(-((y - (WATERLINE - 0.015)) / 0.05) ** 2) * 0.55 + (0.35 if y < WATERLINE - 0.05 else 0.0)
            c = lp[k.col]
            wv = K.lin(WEED)
            lp[k.col] = tuple(c[i] * (1 - t) + wv[i] * t for i in range(3)) + (1.0,)
    # The rope ring round its waist, and four short lashings up to the top.
    ring = [(0.352 * math.sin(a), 0.74, 0.352 * math.cos(a)) for a in np.linspace(0, math.tau, 33)[:-1]]
    k.tube(ring, 0.024, M["rope"], "#ffffff", n=8, v_len=0.12, closed_path=True)
    for j in range(4):
        a = math.tau * j / 4 + 0.4
        pts = [(0.35 * math.sin(a), 0.74, 0.35 * math.cos(a)), (0.335 * math.sin(a), 0.82, 0.335 * math.cos(a)),
               (0.25 * math.sin(a), 0.93, 0.25 * math.cos(a)), (0.07 * math.sin(a), 0.985, 0.07 * math.cos(a))]
        k.tube(pts, 0.011, M["rope"], "#e6dccb", n=6, v_len=0.12)
    # The mast and its ring, and the weighted stem under the water.
    k.lathe((0, 0, 0), [(0.055, 0.962), (0.048, 0.98), (0.03, 1.0), (0.024, 1.07), (0.032, 1.08), (0.0, 1.085)], M["iron"], IRON, n=10)
    k.tube([(0.042 * math.sin(a), 1.125 + 0.042 * math.cos(a), 0.0) for a in np.linspace(0, math.tau, 17)[:-1]], 0.009, M["iron"], IRON, n=6, closed_path=True)
    k.lathe((0, 0, 0), [(0.0, 0.02), (0.07, 0.03), (0.08, 0.07), (0.05, 0.11), (0.025, 0.14), (0.02, 0.43), (0.0, 0.44)], M["iron"], "#4a463f", n=10)
    k.tint_gradient(0.85, 1.0, 0.4, 1.13)
    ob = k.finish(smooth_deg=50)
    K.export([ob], "game/props/buoy.glb")
    print("BUOY", {"waterline": WATERLINE, "top": 1.176, "across": 0.68})
    return [ob]


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "buoy.png"))
