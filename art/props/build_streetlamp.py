"""The street lamp (components/game/AmbientProps.tsx Lanterns: every lamp of a scene in one instanced draw per material),
our own: a matte painted-iron post with a warm frosted lantern. Replaces acnh/props/streetlamp.glb on both maps.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_streetlamp.py [-- review <dir>]

Writes web/public/assets/game/props/streetlamp.glb. Frame: game units at scale 1, the origin on the ground at the post's
foot. Same height and light point as the old lamp: the finial's top at 2.67 (the gulls land there, DefaultIslandWorld
perches) and the lantern's glass round 2.35, where the lamp's point light sits (2.4).

A stepped round plinth, a tapering post with a collar, a ladder bar under the lantern, a flared seat, and a six-sided
lantern: iron frame bars at its corners, frosted panes that widen toward the top, a hipped roof with a deep eave and a
ball finial. Two materials: M_Iron (painted iron; the look's metal class by its name) and M_Glass (frosted panes; an
emissive map the engine eases up at dusk, AmbientProps easeGlowOnce).
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from propkit import arr, smooth  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
IRON, GLASS = "#3a463f", "#f6e8cc"
GLASS_Y0, GLASS_Y1 = 2.15, 2.5
TOP = 2.67


def iron_tex():
    """Painted iron: a soft mottle and fine speckle so the paint isn't plastic-flat."""
    h = w = 128
    v = 0.9 + 0.08 * (K.fbm(h, w, 5, 81, 3) - 0.5) * 2 - 0.06 * smooth(0.75, 0.85, K.noise(h, w, 40, 82))
    return np.clip(v[..., None] * arr("#ffffff"), 0, 1)


def glass_tex():
    """A pane: frosted cream, lighter in the middle. And its glow: a warm, even light across the pane, brightest low in
    the middle where the flame is, only the very edge (under the frame) dimmer."""
    h = w = 64
    U, V = K.grid(h, w)                     # V: 0 at the top row (image space), the pane's top
    y = 1 - V
    d = np.hypot((U - 0.5) * 1.5, (y - 0.4) * 1.0)
    base = (0.88 + 0.1 * smooth(0.7, 0.0, d))[..., None] * arr("#ffffff") * 0.98
    frost = 0.03 * (K.fbm(h, w, 6, 83) - 0.5)
    base = np.clip(base + frost[..., None], 0, 1)
    glow = smooth(1.1, 0.1, d)
    emit = (0.78 + 0.22 * glow)[..., None] * arr("#ffd08a") + (glow ** 2)[..., None] * arr("#fff4d8") * 0.5
    edge = smooth(0.0, 0.06, np.minimum(np.minimum(U, 1 - U), np.minimum(V, 1 - V)))
    return base, np.clip(emit * (0.75 + 0.25 * edge[..., None]), 0, 1)


def build():
    K.reset()
    g_base, g_emit = glass_tex()
    M = {
        "iron": K.Mat("M_Iron", tex=K.image("lamp_iron", iron_tex()), rough=0.8),
        "glass": K.Mat("M_Glass", tex=K.image("lamp_pane", g_base), emit=K.image("lamp_glow", g_emit), rough=0.7),
    }
    k = K.Kit("streetlamp")
    # Plinth, post and lantern seat: one turned piece.
    prof = [(0.0, 0.0), (0.19, 0.0), (0.2, 0.014), (0.2, 0.05), (0.188, 0.064), (0.152, 0.074), (0.142, 0.096),
            (0.142, 0.145), (0.118, 0.168), (0.09, 0.205), (0.078, 0.262), (0.088, 0.292), (0.088, 0.322), (0.066, 0.345),
            (0.056, 0.37), (0.046, 1.0), (0.06, 1.018), (0.062, 1.058), (0.046, 1.078), (0.04, 1.88), (0.055, 1.9),
            (0.066, 1.93), (0.066, 1.975), (0.05, 2.0), (0.036, 2.04), (0.05, 2.08), (0.1, 2.095), (0.135, 2.12),
            (0.148, 2.135), (0.146, 2.146), (0.0, 2.15)]
    k.lathe((0, 0, 0), prof, M["iron"], IRON, n=16, u_tiles=1, v_len=0.6)
    # The ladder bar under the lantern, ball ends.
    k.tube([(-0.17, 1.95, 0), (0.17, 1.95, 0)], 0.013, M["iron"], IRON, n=8, v_len=0.5)
    for x in (-0.17, 0.17):
        k.blob((x, 1.95, 0), (0.024, 0.024, 0.024), M["iron"], IRON, segs=8, rings=5)
    # The lantern: six frosted panes widening upward, iron bars at the corners and bands round the bottom and the top.
    ph = math.pi / 6
    k.lathe((0, GLASS_Y0, 0), [(0.132, 0.0), (0.172, GLASS_Y1 - GLASS_Y0)], M["glass"], GLASS, n=6, phase=ph, u_tiles=6,
            v_len=math.hypot(0.04, GLASS_Y1 - GLASS_Y0))
    for j in range(6):
        a = math.tau * j / 6 + ph
        # lathe's frame round +y: a corner at angle a sits at (sin a, cos a) in game x, z
        p0 = (math.sin(a) * 0.139, GLASS_Y0 - 0.005, math.cos(a) * 0.139)
        p1 = (math.sin(a) * 0.179, GLASS_Y1 + 0.004, math.cos(a) * 0.179)
        k.tube([p0, p1], 0.011, M["iron"], IRON, n=6, v_len=0.5)
    k.lathe((0, 0, 0), [(0.0, GLASS_Y0 - 0.006), (0.156, GLASS_Y0 - 0.006), (0.16, GLASS_Y0 + 0.012), (0.138, GLASS_Y0 + 0.022), (0.131, GLASS_Y0 + 0.012)],
            M["iron"], IRON, n=6, phase=ph, u_tiles=1, v_len=0.3)
    # The roof: a deep eave over the panes, hipped up to a collar and a ball finial.
    roof = [(0.0, GLASS_Y1 - 0.004), (0.166, GLASS_Y1 - 0.004), (0.228, GLASS_Y1 + 0.018), (0.228, GLASS_Y1 + 0.034),
            (0.185, GLASS_Y1 + 0.048), (0.085, GLASS_Y1 + 0.092), (0.036, GLASS_Y1 + 0.11), (0.03, GLASS_Y1 + 0.126),
            (0.016, GLASS_Y1 + 0.136), (0.0, GLASS_Y1 + 0.138)]
    k.lathe((0, 0, 0), roof, M["iron"], IRON, n=6, phase=ph, u_tiles=1, v_len=0.3)
    k.blob((0, TOP - 0.026, 0), (0.026, 0.026, 0.026), M["iron"], IRON, segs=10, rings=6)
    k.tint_gradient(0.78, 1.0, 0.0, TOP)
    ob = k.finish(smooth_deg=48)
    path = K.export([ob], "game/props/streetlamp.glb")
    print("STREETLAMP", {"top": TOP, "glass": [GLASS_Y0, GLASS_Y1], "light": 2.4})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "streetlamp.png"))
