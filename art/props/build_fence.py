"""The connectable fence (game/remodel-r2; David, 2026-10-16: "i like the old fence design, i think make something that can
have connection location when placed side by side like minecraft fences but also look cute like the first one").

Two pieces in the old country fence's manner (chunky round log posts with a sawn top, round log rails, warm orange-brown
wood with tan end grain; no snow): a post that stands on its cell, and a pair of rails that spans from one post's centre
to the next. lib/game/fences.ts stands a post on every fence cell and a pair of rails between each two side by side, so
a run joins up into straight lengths, corners, tees and ends by itself, Minecraft-style.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_fence.py [-- review <dir>]

Writes web/public/assets/game/props/fence-post.glb (the origin on the ground at the post's centre; FENCE_TOP high) and
fence-rail.glb (one cell's span along x, -0.5 to 0.5, the rails' ends inside the posts). Materials: M_FenceWood (grain,
COLOR_0 per part) and M_FenceEnd (the sawn top's rings).
"""
import math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
POST_R, POST_H, SINK = 0.118, 0.6, 0.03
RAILS = ((0.41, 0.054), (0.19, 0.05))       # (height, radius) of the upper and lower rail
WOOD, RAIL_WOOD, END = "#c0743a", "#b86c34", "#e6bb84"


def mats():
    return {
        "wood": K.Mat("M_FenceWood", tex=K.image("fence_grain", K.grain(256, 128, 171, "#ffffff", lines=(7, 19, 43), contrast=0.22, knots=2)), rough=0.9),
        "end": K.Mat("M_FenceEnd", tex=K.image("fence_end", K.end_grain(128, 128, 173, "#ffffff", rings=6)), rough=0.9),
    }


def post():
    K.reset()
    M = mats()
    k = K.Kit("fence-post")
    # The log: a little flared at the foot, a soft bevel round the sawn top.
    body = [(POST_R * 1.06, -SINK), (POST_R * 1.04, 0.05), (POST_R, 0.2), (POST_R * 0.98, POST_H - 0.05), (POST_R * 0.96, POST_H - 0.018),
            (POST_R * 0.86, POST_H - 0.002)]
    k.lathe((0, 0, 0), body, M["wood"], WOOD, n=12, v_len=0.7, u_tiles=1.0)
    # The sawn top: a shallow dome of end grain, mapped flat from above.
    top = [(POST_R * 0.86, POST_H - 0.002), (POST_R * 0.55, POST_H + 0.008), (0, POST_H + 0.012)]
    faces = k.lathe((0, 0, 0), top, M["end"], END, n=12)
    for f in faces:
        for lp in f.loops:
            co = lp.vert.co                              # Blender frame: x = game x, y = -game z
            lp[k.uv].uv = (0.5 + co.x / (2 * POST_R), 0.5 + co.y / (2 * POST_R))
    k.tint_gradient(0.82, 1.0, 0.0, POST_H)
    ob = k.finish(smooth_deg=55)
    K.export([ob], "game/props/fence-post.glb")
    print("FENCE_POST", {"r": POST_R, "top": POST_H + 0.012})
    return ob


def rail():
    K.reset()
    M = mats()
    k = K.Kit("fence-rail")
    for i, (y, r) in enumerate(RAILS):
        # A touch of sag and a slightly uneven log, so a run doesn't read machined.
        pts = [(-0.5, y, 0.0), (-0.25, y - 0.006, 0.004 * (1 - 2 * i)), (0.0, y - 0.009, 0.0), (0.25, y - 0.006, -0.004 * (1 - 2 * i)), (0.5, y, 0.0)]
        k.tube(pts, r, M["wood"], RAIL_WOOD, n=10, v_len=0.7, radii=[1.0, 1.04, 0.98, 1.03, 1.0])
    k.tint_gradient(0.85, 1.0, 0.0, POST_H)
    ob = k.finish(smooth_deg=55)
    K.export([ob], "game/props/fence-rail.glb")
    print("FENCE_RAIL", {"span": 1.0, "rails": RAILS})
    return ob


if __name__ == "__main__":
    out = ARGS[ARGS.index("review") + 1] if "review" in ARGS else None
    for nm, make in (("fence-post", post), ("fence-rail", rail)):
        ob = make()
        if out:
            K.review([ob], os.path.join(out, f"{nm}.png"))
