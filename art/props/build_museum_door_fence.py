"""The museum's boarded door (components/game/DefaultIslandWorld.tsx VillageLandmarks: until the museum's goal opens it),
our own: a log rail across the door with two planks nailed over it in an X. No baked snow (the shader's snow cap does
winter, modelMaterials addSnowCap). Replaces the two acnh/props/fence-country-b.glb segments there.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_museum_door_fence.py [-- review <dir>]

Writes web/public/assets/game/props/museum-door-fence.glb. Frame: game units at scale 1, the origin on the ground at its
middle, its face toward -z (the plaza; the door is behind it at +z). 2.3 across, as the two old segments were, and 0.8
tall to the post tops.

Two stout weathered posts with domed tops, two rails between them (round, a little out of true, pegged through the
posts), and two sawn planks crossed over the front, nailed at their ends and where they cross. One material: M_FenceWood
(grain, COLOR_0 per part; the nail heads dark).
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
POST_X, POST_R, POST_H = 1.02, 0.085, 0.8
POSTS, RAILS, PLANKS, NAILS = "#8f7a63", "#a08668", "#cdb08a", "#3d3530"
rng = np.random.default_rng(2024)


def build():
    K.reset()
    M = {"wood": K.Mat("M_FenceWood", tex=K.image("fence_grain", K.grain(256, 256, 101, "#ffffff", knots=3, contrast=0.2)), rough=0.95)}
    k = K.Kit("museum-door-fence")
    # Posts: turned a little out of round, the tops domed over.
    for i, x in enumerate((-POST_X, POST_X)):
        wob = [1 + rng.uniform(-0.05, 0.05) for _ in range(12)]
        prof = [(0.0, -0.02), (POST_R * 1.03, -0.02), (POST_R, 0.3), (POST_R * 0.98, POST_H - 0.05), (POST_R * 0.82, POST_H - 0.012),
                (POST_R * 0.45, POST_H + 0.012), (0.0, POST_H + 0.018)]
        k.lathe((x, 0, 0), prof, M["wood"], POSTS, n=12, phase=rng.random(), u_tiles=0.5, v_len=0.9, wobble=lambda kk, ii, w=wob: w[kk])
    # Rails: round, sagging a hair, their ends pegged through the posts.
    for y, r in ((0.3, 0.05), (0.6, 0.046)):
        pts = []
        for t in np.linspace(0, 1, 7):
            x = -POST_X - 0.06 + (2 * POST_X + 0.12) * t
            pts.append((x, y - 0.018 * math.sin(math.pi * t) + rng.uniform(-0.004, 0.004), 0.0))
        radii = [1 + rng.uniform(-0.06, 0.06) for _ in pts]
        k.tube(pts, r, M["wood"], RAILS, n=10, v_len=0.9, caps=True, u_tiles=0.5, radii=radii)
    # Two planks over the front in an X, nailed at the ends and where they cross.
    z = -POST_R - 0.03
    for s_, (a, b) in enumerate((((-POST_X + 0.02, 0.14), (POST_X - 0.02, 0.72)), ((-POST_X + 0.02, 0.72), (POST_X - 0.02, 0.14)))):
        zz = z - 0.028 * s_
        k.beam((a[0], a[1], zz), (b[0], b[1], zz), 0.13, 0.026, 0.008, M["wood"], PLANKS, up=(0, 0, -1), uv_len=1.2, uv_off=(0.2 + 0.3 * s_, 0.1))
        for t in (0.04, 0.96):
            p = Vector((a[0], a[1], zz)).lerp(Vector((b[0], b[1], zz)), t)
            for dy in (-0.03, 0.03):
                k.blob((p.x, p.y + dy, zz - 0.015), (0.011, 0.011, 0.005), M["wood"], NAILS, segs=6, rings=3)
    k.blob((0, 0.43, z - 0.056 - 0.014), (0.012, 0.012, 0.005), M["wood"], NAILS, segs=6, rings=3)
    k.tint_gradient(0.8, 1.0, 0.0, POST_H)
    ob = k.finish(smooth_deg=50)
    path = K.export([ob], "game/props/museum-door-fence.glb")
    print("FENCE", {"across": 2 * (POST_X + POST_R), "height": POST_H + 0.018, "faces": "-z"})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "museum-door-fence.png"))
