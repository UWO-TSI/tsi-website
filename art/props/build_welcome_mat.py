"""The welcome mat inside the HQ, the shop, the oracle temple and the wharf shack doors (interiorShared Piece
"yellow-message-mat"): our own coir doormat with "Welcome" in our own lettering. Replaces
acnh/furniture/yellow-message-mat.glb and its printed ACNH art.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_welcome_mat.py [-- review <dir>]

Writes web/public/assets/game/props/welcome-mat.glb. An interior piece (lib/game/propModels.ts REMODELLED_PIECES):
authored at the size the dump mat shows at scale 0.1, 1.55 x 0.95 and 0.022 thick, the origin on the floor at its middle.
It reads from the door: the doors are at -z in every room, so the word runs toward -x with its letters' tops toward +z
(a visitor coming in reads it upright; no flip at the call sites any more).

The lettering is drawn here from our own strokes (round-ended, hand-painted), no font. Coir fibres, a darker bound
border, a leaf sprig each side of the word. One material, M_Coir (512 x 320).
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from propkit import arr, smooth  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
W, D, T, R = 1.55, 0.95, 0.022, 0.12          # size, thickness, corner radius
TW, TH = 512, 320                              # texture


def arc(cx, cy, r, a0, a1, n=14, sy=1.0):
    return [(cx + r * math.cos(a), cy + r * sy * math.sin(a)) for a in np.linspace(math.radians(a0), math.radians(a1), n)]


# Our own glyphs: polylines in em units (baseline 0, x-height 0.56, cap 1.0), and each glyph's advance.
GLYPHS = {
    "W": ([[(0.0, 1.0), (0.2, 0.0), (0.42, 0.72), (0.64, 0.0), (0.84, 1.0)]], 0.92),
    "e": ([[(0.03, 0.29), (0.53, 0.29)] + arc(0.28, 0.28, 0.26, 2, 330, 18)], 0.62),
    "l": ([[(0.1, 1.05), (0.1, 0.12)] + arc(0.2, 0.12, 0.1, 180, 290, 6)], 0.34),
    "c": ([arc(0.28, 0.28, 0.26, 38, 322, 18)], 0.6),
    "o": ([arc(0.28, 0.28, 0.26, 0, 360, 24)], 0.62),
    "m": ([[(0.04, 0.0), (0.04, 0.56)], [(0.04, 0.34)] + arc(0.21, 0.34, 0.17, 180, 0, 10) + [(0.38, 0.0)],
           [(0.38, 0.34)] + arc(0.55, 0.34, 0.17, 180, 0, 10) + [(0.72, 0.0)]], 0.84),
}


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy + 1e-12
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
    return np.hypot(px - (ax + t * dx), py - (ay + t * dy))


def lettering(word, x0, y0, em, stroke, H, Wd):
    """Distance from each pixel to the word's strokes (pixels; x0, y0 the baseline start in pixels, y down the image)."""
    yy, xx = np.mgrid[0:H, 0:Wd].astype(float)
    d = np.full((H, Wd), 1e9)
    x = x0
    for ch in word:
        lines, adv = GLYPHS[ch]
        for line in lines:
            for (ax, ay), (bx, by) in zip(line, line[1:]):
                d = np.minimum(d, seg_dist(xx, yy, x + ax * em, y0 - ay * em, x + bx * em, y0 - by * em))
        x += adv * em
    return d, x - x0


def leaf(xx, yy, cx, cy, length, width, angle):
    c, s = math.cos(angle), math.sin(angle)
    u = ((xx - cx) * c + (yy - cy) * s) / length
    v = (-(xx - cx) * s + (yy - cy) * c) / width
    return (u * u + v * v * (1 + 2.5 * np.abs(u))) < 1.0


def coir():
    rgb = K.fibre(TH, TW, 111, "#ffffff", scale=96) * arr("#c79a5c")
    yy, xx = np.mgrid[0:TH, 0:TW].astype(float)
    # The bound border: a darker band round the edge, its own fibres running along it.
    edge = np.minimum(np.minimum(xx, TW - 1 - xx), np.minimum(yy, TH - 1 - yy))
    band = smooth(30, 24, edge)
    rgb = rgb * (1 - 0.45 * band[..., None]) + arr("#6b4a2e") * 0.45 * band[..., None]
    inner = smooth(38, 34, edge) * (1 - band)
    rgb = rgb * (1 - 0.25 * inner[..., None])
    # The word, centred, a little above the middle; the ink soaks into the fibres (a soft, broken edge).
    em = 80
    _, width = lettering("Welcome", 0, 0, em, 0, 4, 4)
    base = TH / 2 + em * 0.32
    d, _ = lettering("Welcome", (TW - width) / 2, base, em, 0, TH, TW)
    rough = K.noise(TH, TW, 90, 112)
    ink = smooth(8.0, 5.5, d + 2.0 * (rough - 0.5))
    rgb = rgb * (1 - 0.86 * ink[..., None]) + arr("#3b2a1c") * 0.86 * ink[..., None]
    # A swash under the word with a leaf at each end, in sage.
    y_s = base + em * 0.36
    pts = [(TW * 0.33 + TW * 0.34 * t, y_s + 5 * math.sin(math.tau * t)) for t in np.linspace(0, 1, 24)]
    sw = np.full((TH, TW), 1e9)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        sw = np.minimum(sw, seg_dist(xx, yy, ax, ay, bx, by))
    mask = smooth(3.4, 2.0, sw)
    for (cx, cy), ang in ((pts[0], math.pi - 0.35), (pts[-1], 0.35)):
        mask = np.maximum(mask, leaf(xx, yy, cx + 13 * math.cos(ang), cy - 13 * math.sin(ang), 15, 6.5, -ang).astype(float))
    rgb = rgb * (1 - 0.75 * mask[..., None]) + arr("#5f6e3c") * 0.75 * mask[..., None]
    return np.clip(rgb, 0, 1)


def outline():
    pts = []
    for cx, cy, a0 in ((W / 2 - R, -D / 2 + R, -90), (W / 2 - R, D / 2 - R, 0), (-W / 2 + R, D / 2 - R, 90), (-W / 2 + R, -D / 2 + R, 180)):
        pts += arc(cx, cy, R, a0, a0 + 90, 6)
    return pts


def build():
    K.reset()
    M = {"coir": K.Mat("M_Coir", tex=K.image("mat_coir", coir()), rough=1.0)}
    k = K.Kit("welcome-mat")
    # The outline lies in local (x, y); turned so local y runs along game -z and the sweep (local z) up game y.
    rot = K.game_rot(pitch=-math.pi / 2)
    # u from +x to -x (the word runs toward -x), v from -z (the door) to +z: local y is game -z.
    uv = lambda x, y: ((W / 2 - x) / W, (D / 2 - y) / D)
    k.extrude(outline(), 0.0, T, M["coir"], "#ffffff", bevel=0.008, rot=rot, at=(0, 0, 0), uv_len=1.0, cap_uv=uv)
    # The sides: the border's fibres (the band's colour, from the texture's edge).
    for f in k.bm.faces:
        if len(f.verts) == 4:
            for lp in f.loops:
                lp[k.uv].uv = (lp[k.uv].uv[0] * 0.3 % 1.0, 0.03)
    ob = k.finish(smooth_deg=50)
    K.export([ob], "game/props/welcome-mat.glb")
    print("WELCOME_MAT", {"size": [W, D, T], "reads_from": "-z"})
    return [ob]


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "welcome-mat.png"), views=((180, 60), (215, 30)))
