"""The fish market's board (fishing-depth round 5, remodelled; round 6, David 2026-11-02).

  cd web && node ../art/props/fish_board_face.mjs <faces dir>      (the header plank's face, from fish_board_face.html)
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_fish_board.py -- <faces dir> [review <dir>]
  cd web && node scripts/pack-glbs.mjs public/assets/game/props/fish-board.glb public/assets/game/props/fish-board-hd.glb

The board (David: "remodel this board so its better more eye catching"; round 6: "make it no text just simple icons"):
the catch board out front of the fish market, and the task board at 0.625 of its size (components/game/peaceful/CatchBoard.tsx
Chalkboard). A slate in a painted teal frame between two posts, a cream header plank painted with icons only (two fish
either side of a clock), a red pitched roof with a golden fish on its ridge, a chalk ledge with two sticks, an orange
float hung off the header on a rope. The slate itself is the game's: a canvas of chalk (what bites now) laid over the
opening at z 0.042, so the opening is BOARD.catch in lib/game/wharf.ts (1.6 x 1.05, its foot 0.85 up).

The ridge fish is its own object, "ridge-fish", its origin on the ridge under it, so the game can sway it (round 6, David:
"i want the fish on top to like kidna move a bit"). Writes game/props/fish-board-hd.glb and game/props/fish-board.glb.

Frame: game units, the origin on the ground under the middle, the face toward +z. P_Wood and P_Paint take their colour
from COLOR_0; the painted header is its own textured material. The high-def is the shaped mesh; the low-poly is it
decimated, its face texture at most 512 across (the props' budget).
"""
import math, os, sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FACES = ARGS[0]
REVIEW = ARGS[ARGS.index("review") + 1] if "review" in ARGS else None

WOOD, WOOD_DARK, TEAL, ROOF, ROOF_DARK, GOLD, ORANGE, WHITE, CHALK = (
    "#8a5a36", "#6e4a2c", "#2f8a92", "#c9533a", "#a8432f", "#f2b636", "#e8743a", "#f5f1e8", "#f2efe4")


def mats():
    return K.Mat("P_Wood", rough=0.9), K.Mat("P_Paint", rough=0.45)


def face_mat(name, png, fit=None):
    """The painted face; `fit`: shrunk to at most that many pixels across (the low-poly's, the props' 512 budget)."""
    img = bpy.data.images.load(os.path.join(FACES, png))
    if fit and img.size[0] > fit:
        img.scale(fit, round(img.size[1] * fit / img.size[0]))
    img.pack()
    return K.Mat(name, rough=0.7, tex=img)


def fish_outline(length, height):
    """A fish side on, nose to +x, counter-clockwise from the nose: the back, a forked tail, the belly a touch flatter."""
    L, H = length, height
    back = [(L / 2 * math.cos(math.radians(a)), H / 2 * math.sin(math.radians(a))) for a in range(0, 151, 15)]
    tail = [(-0.6 * L, 0.5 * H), (-0.5 * L, 0.0), (-0.6 * L, -0.46 * H)]
    belly = [(L / 2 * math.cos(math.radians(a)), 0.85 * H / 2 * math.sin(math.radians(a))) for a in range(210, 360, 15)]
    return back + tail + belly


def board(header, wood, paint):
    """The catch board, BOARD.catch's slate opening (1.6 x 1.05, its foot 0.85 up) in the frame's face."""
    W, H, F = 1.6, 1.05, 0.85
    top, t = F + H, 0.1
    k = K.Kit("fish-board")
    # The back the chalk lies on, and the teal frame round it (rounded timbers, their front 0.09 out).
    k.rbox((0, F + H / 2, 0.0), (W + 0.14, H + 0.14, 0.06), 0.015, wood, WOOD_DARK)
    for y in (F - t / 2, top + t / 2):
        k.beam((-W / 2 - t, y, 0.035), (W / 2 + t, y, 0.035), t, 0.11, 0.03, paint, TEAL, up=(0, 0, 1), segs=3)
    for x in (-W / 2 - t / 2, W / 2 + t / 2):
        k.beam((x, F, 0.035), (x, top, 0.035), t, 0.11, 0.03, paint, TEAL, up=(0, 0, 1), segs=3)
    # Two posts and a brace low down, square timbers, their feet on two blocks.
    px = W / 2 + t + 0.075
    for x in (-px, px):
        k.beam((x, 0.0, -0.03), (x, 2.5, -0.03), 0.13, 0.13, 0.025, wood, WOOD, segs=2)
        k.rbox((x, 0.04, -0.03), (0.22, 0.08, 0.22), 0.02, wood, WOOD_DARK)
    k.beam((-px, 0.34, -0.03), (px, 0.34, -0.03), 0.08, 0.06, 0.015, wood, WOOD, segs=2)
    # The chalk ledge under the slate and its two sticks.
    k.beam((-W * 0.46, F - t - 0.01, 0.12), (W * 0.46, F - t - 0.01, 0.12), 0.07, 0.035, 0.012, wood, WOOD, up=(0, 0, 1), segs=2)
    for x, col in ((W * 0.22, CHALK), (W * 0.3, "#f3d27a")):
        k.tube([(x - 0.05, F - t + 0.022, 0.13), (x + 0.05, F - t + 0.022, 0.135)], 0.012, paint, col, n=8, caps=True)
    # The header plank over the frame, its painted face ("Catch board" between two fish).
    hy0, hy1, hw = top + t + 0.02, top + t + 0.36, 2.05
    k.rbox((0, (hy0 + hy1) / 2, 0.01), (hw, hy1 - hy0, 0.07), 0.02, wood, WOOD)
    m = 0.03
    k.quad([(-hw / 2 + m, hy0 + m, 0.0455), (hw / 2 - m, hy0 + m, 0.0455), (hw / 2 - m, hy1 - m, 0.0455), (-hw / 2 + m, hy1 - m, 0.0455)], header)
    # The roof: two pitches of red boards with a ridge cap, past the posts and out over the face.
    eave, ridge, half = hy1 + 0.06, hy1 + 0.34, 1.3
    pitch = math.atan2(ridge - eave, half)
    for s in (-1, 1):
        rot = K.game_rot(roll=-s * pitch)
        k.rbox((s * half / 2, (eave + ridge) / 2, 0.02), (half / math.cos(pitch) + 0.04, 0.05, 0.78), 0.012, paint, ROOF, rot=rot, segs=2)
    k.beam((0, ridge + 0.02, -0.39), (0, ridge + 0.02, 0.43), 0.07, 0.06, 0.02, paint, ROOF_DARK, up=(0, 1, 0), segs=2)
    # The golden fish's stand on the ridge (the fish itself is ridge_fish, its own object).
    k.rbox((0, ridge + 0.05, 0.02), (0.05, 0.1, 0.05), 0.01, paint, ROOF_DARK)
    # An orange float hung off the header's right end on a rope.
    rx = hw / 2 - 0.12
    k.tube([(rx, hy0 + 0.02, 0.07), (rx + 0.01, hy0 - 0.12, 0.08), (rx, hy0 - 0.24, 0.08)], 0.009, wood, "#c7a268", n=6)
    cy = hy0 - 0.36
    k.lathe((rx, cy, 0.08), [(0.0, -0.12), (0.055, -0.1), (0.08, -0.05), (0.085, 0.0), (0.08, 0.05), (0.055, 0.1), (0.0, 0.12)], paint, ORANGE, n=14)
    k.lathe((rx, cy, 0.08), [(0.087, -0.022), (0.087, 0.022)], paint, WHITE, n=14)
    return k.finish(name="fish-board")


RIDGE = 1.9 + 0.1 + 0.36 + 0.34 + 0.05   # the ridge fish's foot: the header's top + the roof's rise + its stand


def ridge_fish(paint):
    """The golden fish on the ridge, side on to the wharf, an eye each side, built round its foot (where it sways from)."""
    fl, fh = 0.72, 0.3
    k = K.Kit("ridge-fish")
    k.extrude(fish_outline(fl, fh), -0.025, 0.025, paint, GOLD, bevel=0.012, at=(0, fh / 2, 0), steps=2)
    for z in (0.027, -0.027):
        k.blob((fl * 0.3, fh * 0.58, z), (0.03, 0.03, 0.006), paint, "#2b2b2b", segs=10, rings=6)
    ob = k.finish(name="ridge-fish")
    ob.location = K.G(0, RIDGE, 0.02)
    return ob


def low_poly(ob, ratio):
    lp = ob.copy()
    lp.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(lp)
    mod = lp.modifiers.new("lp", "DECIMATE")
    mod.ratio = ratio
    bpy.context.view_layer.objects.active = lp
    bpy.ops.object.modifier_apply(modifier="lp")
    return lp


def build():
    K.clear()
    wood, paint = mats()
    hd = [board(face_mat("M_BoardHeader", "header.png"), wood, paint), ridge_fish(paint)]
    K.export(hd, "game/props/fish-board-hd.glb")
    if REVIEW:
        K.show_vertex_colors(hd)
        K.review(hd, os.path.join(REVIEW, "fish-board-hd.png"), views=((18, 12), (200, 18)))
    K.clear()
    wood, paint = mats()
    obs = [board(face_mat("M_BoardHeader", "header.png", fit=512), wood, paint), ridge_fish(paint)]
    lp = [low_poly(ob, ratio) for ob, ratio in zip(obs, (0.4, 0.6))]
    for ob, low in zip(obs, lp):
        name = ob.name
        bpy.data.objects.remove(ob, do_unlink=True)
        low.name = name
    K.export(lp, "game/props/fish-board.glb")
    if REVIEW:
        K.show_vertex_colors(lp)
        K.review(lp, os.path.join(REVIEW, "fish-board-lp.png"), views=((18, 12), (200, 18)))


build()
