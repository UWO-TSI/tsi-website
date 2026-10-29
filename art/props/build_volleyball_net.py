"""The beach volleyball net, remodelled at real proportions (game/volleyball; David, 2026-10-29: "remodel the beach ball
net on the beach to be bigger"). From wharf-art2's net (the same wooden posts with painted rings, the dark cord mesh,
the white top band, guy ropes to stakes), now a real beach net scaled to our characters (lib/game/volleyball/court.ts:
1 m = 0.776 u): the court 8 m wide, the posts 0.7 m outside the sidelines, the top tape at 2.43 m, 1 m of mesh, white
side bands over the sidelines, red and white antennae rising 0.8 m above the net, a bottom band and tie cords.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_volleyball_net.py [-- review <dir>]

Writes, under web/public/assets/game/props/, in game units at scale 1, the net along x, the origin on the sand under
its middle (y 0):
  volleyball-net-hd.glb  the high-def net (the players' close view in a match): round cords on a 0.12 u mesh.
  volleyball-net.glb     the low-poly net (the world, passers-by): reduced from the high-def (an edge-collapse decimate
                         of its mesh cords; the posts, tapes and antennae keep their shape).
Materials as before: the wharf's wood and rope, P_Cloth for the net and tapes, P_Paint for the antennae. Seeded.
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import report, wood_mat  # noqa: E402
from build_dock_decor import ROPE  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/props/"
S = (1.045 * 1.3) / 1.75                   # court.ts COURT_SCALE
HALF_W, POST_X = 4 * S, 4.7 * S            # the sidelines, the posts
TOP, BOT = 2.43 * S, 1.43 * S              # the top tape, the mesh's lower edge
NET_X = HALF_W + 0.25 * S                  # the mesh runs a little past the sidelines
ANT = 0.8 * S                              # the antennae above the tape
CORD, WHITE, RED = "#2f3236", "#f6f2e8", "#e8553c"


def net(Mw, Mr, Mc, Mp, step):
    """The whole net; `step` is the mesh's square (the high-def's; the low-poly is decimated from it)."""
    k = K.Kit("volleyball-net")
    sag = lambda x: 0.035 * (1 - (x / NET_X) ** 2)
    for s in (-1, 1):
        x = s * POST_X
        # The post: a turned wooden pole sunk in the sand (deep, so a sloping beach never shows its foot), a cap.
        k.lathe((x, 0, 0), [(0.0, -0.7), (0.09, -0.7), (0.088, TOP + 0.12), (0.075, TOP + 0.2), (0.05, TOP + 0.24), (0.0, TOP + 0.25)],
                Mw, "#d9c3a0", n=14, v_len=1.2)
        for y in (0.45, 1.05, 1.65):                    # painted rings
            k.lathe((x, y, 0), [(0.091, 0.0), (0.091, 0.14)], Mc, RED, n=14)
        # Guy rope to a stake behind the post, and the tie cords from the tapes' ends to the post.
        stake = (s * (POST_X + 1.1), 0.0, 0.0)
        k.tube([(x, TOP + 0.18, 0), stake], 0.012, Mr, ROPE, n=5, v_len=0.12)
        k.rbox((stake[0], 0.07, 0), (0.06, 0.16, 0.06), 0.012, Mw, "#9c7550", segs=1)
        for y in (TOP - 0.03, BOT + 0.03):
            k.tube([(s * NET_X, y, 0), (x - s * 0.085, y + 0.02, 0)], 0.009, Mr, ROPE, n=5, v_len=0.12)
        # The antenna: a striped rod on the side band, from the mesh's foot to 0.8 m over the tape.
        n = 14
        ys = np.linspace(BOT, TOP + ANT, n + 1)
        for i in range(n):
            k.lathe((s * HALF_W, ys[i], 0.025), [(0.016, 0.0), (0.016, ys[i + 1] - ys[i])], Mp, RED if i % 2 else WHITE, n=6)
        k.lathe((s * HALF_W, TOP + ANT, 0.025), [(0.016, 0.0), (0.0, 0.02)], Mp, WHITE, n=6)
        # The side band over the sideline.
        k.rbox((s * HALF_W, (BOT + TOP) / 2, 0), (0.05, TOP - BOT, 0.012), 0.004, Mc, WHITE, segs=1)
    # The mesh: round cords, real holes between.
    nx = int(round(2 * NET_X / step))
    xs = np.linspace(-NET_X, NET_X, nx + 1)
    ny = max(2, int(round((TOP - BOT) / step)))
    ys = np.linspace(BOT, TOP, ny + 1)
    for x in xs[1:-1]:
        k.tube([(x, BOT + 0.03 - sag(x), 0), (x, TOP - 0.03 - sag(x), 0)], 0.007, Mc, CORD, n=4, v_len=0.2)
    for y in ys[1:-1]:
        k.tube([(x, y - sag(x), 0) for x in np.linspace(-NET_X, NET_X, 17)], 0.007, Mc, CORD, n=4, v_len=0.2)
    # The top and bottom tapes, each with its cord through it.
    for y, h in ((TOP - 0.04, 0.08), (BOT + 0.03, 0.06)):
        pts = [(x, y - sag(x), 0) for x in np.linspace(-NET_X, NET_X, 9)]
        for (x0, y0, _), (x1, y1, _) in zip(pts, pts[1:]):
            k.rbox(((x0 + x1) / 2, (y0 + y1) / 2, 0), (x1 - x0 + 0.002, h, 0.022), 0.0, Mc, WHITE, segs=1,
                   rot=K.game_rot(roll=math.atan2(y1 - y0, x1 - x0)))
        k.tube(pts, 0.011, Mr, ROPE, n=5)
    k.tint_gradient(0.86, 1.0, 0.0, TOP + 0.25)
    return k.finish(smooth_deg=50)


def low_poly(ob):
    """The world copy, reduced from the high-def: its mesh cords and its posts each decimated on their own (edge
    collapse), the tapes, rings and antennae kept as they are, then joined: the silhouette and colours stay the same."""
    import bpy, bmesh

    def part(keep, ratio):
        o = ob.copy()
        o.data = ob.data.copy()
        bpy.context.scene.collection.objects.link(o)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        col = bm.loops.layers.float_color["Color"]
        mats = o.data.materials
        gone = [f for f in bm.faces if not keep(f, col, mats)]
        bmesh.ops.delete(bm, geom=gone, context="FACES")
        bm.to_mesh(o.data)
        bm.free()
        if ratio < 1:
            mod = o.modifiers.new("lp", "DECIMATE")
            mod.decimate_type, mod.ratio, mod.use_collapse_triangulate = "COLLAPSE", ratio, True
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier="lp")
        return o

    dark = lambda f, col, mats: all(sum(lp[col][:3]) < 0.25 for lp in f.loops)
    wood = lambda f, col, mats: not dark(f, col, mats) and mats[f.material_index].name == "M_DecorWood"
    rest = lambda f, col, mats: not dark(f, col, mats) and not wood(f, col, mats)
    parts = [part(dark, 0.4), part(wood, 0.5), part(rest, 1.0)]
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[2]
    bpy.ops.object.join()
    lp = parts[2]
    lp.name = lp.data.name = "volleyball-net"
    return lp


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    cloth, paint = K.Mat("P_Cloth", rough=1.0), K.Mat("P_Paint", rough=0.45)
    hd = net(wood, rope, cloth, paint, 0.12)
    hd.name = hd.data.name = "volleyball-net-hd"
    lp = low_poly(hd)
    K.export([hd], f"{OUT}volleyball-net-hd.glb")
    report(hd)
    K.export([lp], f"{OUT}volleyball-net.glb")
    report(lp)
    return hd, lp


if __name__ == "__main__":
    hd, lp = build()
    if "review" in ARGS:
        out = ARGS[ARGS.index("review") + 1]
        os.makedirs(out, exist_ok=True)
        lp.hide_render = True
        K.review([hd], os.path.join(out, "net-hd.png"), views=((200, 12), (160, 30)), size=900)
        hd.hide_render, lp.hide_render = True, False
        K.review([lp], os.path.join(out, "net-lp.png"), views=((200, 12), (160, 30)), size=900)
