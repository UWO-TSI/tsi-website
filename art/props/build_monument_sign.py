"""The club monument's "coming soon" board (DefaultIslandWorld ClubMonument, stages 0-3): our own timber sandwich board
reading "Club monument: coming soon" in our own brush lettering, painted into the texture (paintkit; no font files).
Replaces acnh/furniture/monument-sign.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_monument_sign.py [-- review <dir>]

Writes web/public/assets/game/props/monument-sign.glb. Frame: game units at scale 1, the origin on the ground under the
board's middle; the two boards lean together over it, their lettered faces toward +z and -z. About the old sign's
size: 1.1 tall, 0.62 wide, its feet 0.49 apart.

Two hinged boards in a stained timber frame (stiles to the ground, top and bottom rails), each with a cream painted
plank face: "CLUB / MONUMENT:" in rust, a mustard maple leaf between two strokes, "COMING / SOON" in walnut, a mustard
border; an iron hinge rod over the top, a hemp cord holding the feet apart. Three materials: M_SignFace (the lettered
face), M_SignWood (grain; COLOR_0 gives the frame its stain and the inner faces their cream), M_Iron (worn iron).
"""
import math, os, sys
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
W = 0.62                       # board width (outside the stiles)
LP = 1.13                      # board length along its lean
TILT = math.radians(11)        # each board's lean off upright
APEX_Z = 0.028                 # the boards' tops either side of the middle
FACE_W, FACE_H = 0.52, 0.78    # the lettered face between the stiles and rails
FACE_B0 = 0.25                 # the face's bottom, along the board from its foot
STAIN, CREAM, RUST, WALNUT, MUSTARD = "#8d6646", "#ecdfc0", "#b4502f", "#4f3a2a", "#d39a3a"


def face_texture(h=512, w=512):
    """The lettered face, laid out in its own units (FACE_W x FACE_H): painted planks, a border, the words, a leaf."""
    W_, H_ = FACE_W, FACE_H
    out = K.painted_planks(h, w, 81, boards=4, tone="#efe2c4", wear=0.1)
    border = [[(0.026, 0.026), (W_ - 0.026, 0.026), (W_ - 0.026, H_ - 0.026), (0.026, H_ - 0.026), (0.026, 0.026)]]
    out = PK.paint(out, PK.strokes_alpha(h, w, W_, H_, border, 0.0055, seed=3, smooth_curves=False, taper=0.1), MUSTARD, 0.85)
    for text, y, cap, rad, col, seed in (("CLUB", 0.585, 0.092, 0.0102, RUST, 11), ("MONUMENT:", 0.462, 0.058, 0.0071, RUST, 13),
                                          ("COMING", 0.245, 0.074, 0.0088, WALNUT, 16), ("SOON", 0.112, 0.086, 0.0102, WALNUT, 18)):
        s = PK.text_strokes(text, W_ / 2, y, cap, seed=seed, track=0.05)
        out = PK.paint(out, PK.strokes_alpha(h, w, W_, H_, s, rad, seed=seed + 1), col)
    ly = 0.392
    out = PK.paint(out, PK.fill_poly(h, w, W_, H_, PK.maple_poly(W_ / 2, ly, 0.034, ang=0.25)), MUSTARD, 0.95)
    out = PK.paint(out, PK.strokes_alpha(h, w, W_, H_, PK.maple_veins(W_ / 2, ly, 0.034, ang=0.25), 0.0018, seed=21, taper=0.5), "#a8652a", 0.7)
    out = PK.paint(out, PK.strokes_alpha(h, w, W_, H_, [[(0.08, ly), (0.2, ly + 0.002)], [(W_ - 0.2, ly + 0.002), (W_ - 0.08, ly)]], 0.0035, seed=15), "#7a5a3a", 0.8)
    return out


def board_frame(side):
    """A board's frame (side +1: the +z board): origin at its foot's middle, (across, outward normal, up the board)."""
    c, s = math.cos(TILT), math.sin(TILT)
    up = Vector((0, c, -s * side))                   # along the board, from the foot to the top
    nrm = Vector((0, s, c * side))                   # outward, the lettered face's normal
    across = Vector((1, 0, 0))
    foot = Vector((0, 0, side * (APEX_Z + LP * s)))
    return foot, across, nrm, up


def build():
    K.reset()
    M = {
        "face": K.Mat("M_SignFace", tex=K.image("sign_face", face_texture()), rough=0.9),
        "wood": K.Mat("M_SignWood", tex=K.image("sign_wood", K.grain(256, 128, 82, "#ffffff", knots=2)), rough=0.93),
        "iron": K.Mat("M_Iron", tex=K.image("sign_iron", PK.iron(64, 64, 83)), rough=0.7),
    }
    k = K.Kit("monument-sign")
    for side in (1, -1):
        foot, across, nrm, up = board_frame(side)
        R = Matrix((across, nrm, up)).transposed()      # rbox local (x, y, z) = (across, normal, along)
        at = lambda a, n, b: tuple(foot + across * a + nrm * n + up * b)
        # Stiles: down to the ground, their feet rounded; rails across the top and under the face.
        for a in (-(W / 2 - 0.026), W / 2 - 0.026):
            k.rbox(at(a, 0, LP / 2), (0.052, 0.036, LP), 0.012, M["wood"], STAIN, rot=R, segs=1, uv_off=(0.1 + a, 0.2))
        k.rbox(at(0, 0, LP - 0.034), (W - 0.02, 0.036, 0.068), 0.012, M["wood"], STAIN, rot=R, segs=1, v_axis=0, uv_off=(0.3, 0.6))
        k.rbox(at(0, 0, FACE_B0 - 0.026), (W - 0.02, 0.036, 0.052), 0.012, M["wood"], STAIN, rot=R, segs=1, v_axis=0, uv_off=(0.6, 0.1))
        # The face board (cream inside), its lettered face a hair proud of it.
        k.rbox(at(0, -0.002, FACE_B0 + FACE_H / 2), (FACE_W + 0.03, 0.016, FACE_H + 0.02), 0.004, M["wood"], CREAM, rot=R, segs=1)
        n0 = 0.0062
        a0, a1, b0, b1 = -FACE_W / 2, FACE_W / 2, FACE_B0, FACE_B0 + FACE_H
        quad = [at(a0, n0, b0), at(a1, n0, b0), at(a1, n0, b1), at(a0, n0, b1)]
        uvs = ((0, 0), (1, 0), (1, 1), (0, 1))
        if side < 0:                                   # seen from -z the board's +x is on the viewer's left
            quad = [at(a1, n0, b0), at(a0, n0, b0), at(a0, n0, b1), at(a1, n0, b1)]
        k.quad(quad, M["face"], "#ffffff", uvs)
        # A screw head at each corner of the face.
        for a in (a0 + 0.012, a1 - 0.012):
            for b in (b0 + 0.012, b1 - 0.012):
                k.blob(at(a, n0 + 0.002, b), (0.006, 0.006, 0.006), M["iron"], "#ffffff", segs=6, rings=3)
    # The hinge: an iron rod over the tops with a knuckle at each end and the middle.
    top_y = LP * math.cos(TILT)
    k.tube([(-W / 2 + 0.02, top_y - 0.004, 0), (W / 2 - 0.02, top_y - 0.004, 0)], 0.011, M["iron"], "#ffffff", n=8, v_len=0.3, caps=True)
    for x in (-W / 2 + 0.07, 0, W / 2 - 0.07):
        k.tube([(x - 0.035, top_y - 0.004, 0), (x + 0.035, top_y - 0.004, 0)], 0.017, M["iron"], "#ffffff", n=8, v_len=0.3, caps=True)
    # The spreader cords: hemp, from one board's stile to the other's, sagging a little.
    for x in (-(W / 2 - 0.03), W / 2 - 0.03):
        b = 0.36
        pa = board_frame(1)
        pb = board_frame(-1)
        A = pa[0] + pa[3] * b - pa[2] * 0.02 + Vector((x, 0, 0))
        B = pb[0] + pb[3] * b - pb[2] * 0.02 + Vector((x, 0, 0))
        mid = (A + B) / 2 + Vector((0, -0.035, 0))
        k.tube([tuple(A), tuple((A + mid) / 2 + Vector((0, -0.012, 0))), tuple(mid), tuple((B + mid) / 2 + Vector((0, -0.012, 0))), tuple(B)],
               0.0055, M["wood"], "#c9ad7a", n=5, v_len=0.05, caps=True)
    k.tint_gradient(0.84, 1.0)
    ob = k.finish(smooth_deg=50)
    path = K.export([ob], "game/props/monument-sign.glb")
    print("MONUMENT_SIGN", {"height": top_y + 0.017, "feet": 2 * (APEX_Z + LP * math.sin(TILT))})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "monument-sign.png"), views=((0, 12), (35, 26), (160, 20)))
