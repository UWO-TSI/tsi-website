"""The plaza mailbox (lib/game/defaultIsland.ts LANDMARK_INFO.mailbox; DefaultIslandWorld VillageLandmarks) and the home
island's (HomeIslandScene HOME_MAILBOX): our own painted timber post box. Replaces acnh/furniture/mailbox.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_mailbox.py [-- review <dir>]

Writes web/public/assets/game/props/mailbox.glb. Frame: game units at scale 1, the origin on the ground under the post,
the box's front door toward +z (the old model's front). About the old one's size: 0.97 tall, the box 0.34 across and 0.5
deep on a 0.6 post, inside the landmark's 0.3 half footprint.

A round-topped box of tongue-and-groove boards painted brick red, cream trim bands and a cream front door with a brass
pull, a mustard flag raised on its arm, the box on a little shelf on a timber post with two braces. Three materials:
M_MailPaint (painted boards, COLOR_0 gives each part its paint), M_MailPost (raw grain), M_Brass.
"""
import math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
W, HS, RC = 0.34, 0.2, 0.03          # box width, side height (the arch sits on it), bottom corner radius
BASE = 0.6                           # the box's bottom (the shelf's top)
Z0, Z1 = -0.25, 0.25                 # back and front
RED, CREAM, MUSTARD, WOOD, RIM = "#b8553d", "#efe0c0", "#e2a33b", "#a98461", "#8e3f2e"


def outline(w=W, hs=HS, rc=RC, arch_n=12, corner_n=3):
    """The box's end: a rectangle with rounded bottom corners under a half-round arch, counter-clockwise from +z."""
    r = w / 2
    pts = []
    for k in range(corner_n + 1):                                   # bottom right corner
        a = -math.pi / 2 + (math.pi / 2) * k / corner_n
        pts.append((r - rc + rc * math.cos(a), rc + rc * math.sin(a)))
    for k in range(arch_n + 1):                                     # the arch, right to left
        a = math.pi * k / arch_n
        pts.append((r * math.cos(a), hs + r * math.sin(a)))
    for k in range(corner_n + 1):                                   # bottom left corner
        a = math.pi + (math.pi / 2) * k / corner_n
        pts.append((-r + rc + rc * math.cos(a), rc + rc * math.sin(a)))
    out = []
    for p in pts:                                                   # drop repeats where the pieces meet
        if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 1e-4:
            out.append(p)
    if math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < 1e-4:
        out.pop()
    return out


def grown(pts, d):
    """The outline pushed out by d along its vertex normals (in by a negative d)."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    out = []
    n = len(pts)
    for i in range(n):
        ax, ay = pts[i - 1]
        bx, by = pts[i]
        qx, qy = pts[(i + 1) % n]
        e1 = Vector((bx - ax, by - ay)).normalized()
        e2 = Vector((qx - bx, qy - by)).normalized()
        t = (e1 + e2).normalized()
        nn = Vector((t.y, -t.x))
        if nn.dot(Vector((bx - cx, by - cy))) < 0:
            nn = -nn
        out.append((bx + nn.x * d, by + nn.y * d))
    return out


def build():
    K.reset()
    M = {
        "paint": K.Mat("M_MailPaint", tex=K.image("mail_boards", K.painted_planks(256, 256, 61, boards=6, wear=0.22)), rough=0.88),
        "post": K.Mat("M_MailPost", tex=K.image("mail_post", K.grain(256, 128, 62, "#ffffff", knots=2)), rough=0.95),
        "brass": K.Mat("M_Brass", "#c9a25a", rough=0.6),
    }
    k = K.Kit("mailbox")
    ol = outline()
    # The box: painted boards round the arch, its ends rounded over.
    k.extrude(ol, Z0, Z1, M["paint"], RED, bevel=0.022, at=(0, BASE, 0), uv_len=1.0)
    # Cream bands round the back and the front, a hair proud of the boards.
    band = grown(ol, 0.009)
    k.extrude(band, Z0 - 0.004, Z0 + 0.04, M["paint"], CREAM, bevel=0.008, at=(0, BASE - 0.0, 0), uv_len=1.0)
    k.extrude(band, Z1 - 0.045, Z1 + 0.002, M["paint"], RIM, bevel=0.008, at=(0, BASE, 0), uv_len=1.0)
    # The front door: a raised cream panel inside the front band, a brass pull at the top of it, two hinges below.
    door = grown(ol, -0.03)
    k.extrude(door, Z1, Z1 + 0.016, M["paint"], CREAM, bevel=0.007, at=(0, BASE, 0), uv_len=1.0,
              cap_uv=lambda x, y: (0.085 + x * 0.12, y * 1.2))      # mid-board: the door's face is one clean board
    k.blob((0, BASE + HS + 0.08, Z1 + 0.03), (0.022, 0.022, 0.02), M["brass"], segs=10, rings=6)
    k.rbox((0, BASE + HS + 0.08, Z1 + 0.02), (0.03, 0.022, 0.016), 0.006, M["brass"])
    for x in (-0.09, 0.09):
        k.rbox((x, BASE + 0.035, Z1 + 0.012), (0.05, 0.018, 0.012), 0.005, M["brass"])
    # The flag, raised: a flat arm up the right side from a brass pivot, a mustard plate at its top.
    px, py, pz = W / 2 + 0.014, BASE + 0.12, 0.1
    k.beam((px, py - 0.02, pz), (px, py + 0.3, pz), 0.032, 0.012, 0.005, M["paint"], MUSTARD, up=(1, 0, 0), segs=1)
    k.rbox((px, py + 0.25, pz - 0.055), (0.012, 0.085, 0.1), 0.005, M["paint"], MUSTARD, segs=1)
    k.lathe((px - 0.002, py, pz), [(0.0, 0.0), (0.02, 0.004), (0.02, 0.014), (0.0, 0.02)], M["brass"], d=(1, 0, 0), n=10)
    # The shelf, the post and its braces.
    k.rbox((0, BASE - 0.016, 0), (W - 0.04, 0.032, Z1 - Z0 - 0.04), 0.01, M["post"], WOOD, uv_off=(0.1, 0.3))
    k.rbox((0, (BASE - 0.03) / 2, -0.03), (0.085, BASE - 0.03, 0.085), 0.016, M["post"], WOOD)
    for z in (0.15, -0.21):
        k.beam((0, BASE - 0.2, -0.03 + (0.03 if z > 0 else -0.03)), (0, BASE - 0.035, z), 0.05, 0.035, 0.01, M["post"], WOOD, up=(0, 0, 1))
    k.tint_gradient(0.82, 1.0)
    ob = k.finish(smooth_deg=48)
    path = K.export([ob], "game/props/mailbox.glb")
    print("MAILBOX", {"height": BASE + HS + W / 2, "front": "+z"})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "mailbox.png"))
