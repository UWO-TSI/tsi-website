"""The path's edges (terrain v3, game/village-art; David, 2026-10-26: "sides have natual rocks and stuff ... i want fencing
around the path, but like the fencing is loosely there not a straight fencing but one with gaps", path.jpg in
specs/references/terrain/r2-2026-10-26/): mossy side rocks and a loose rustic fence in short runs.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_path_edge.py [-- review <dir>]

Writes, under web/public/assets/game/props/, in game units at scale 1, the origin on the ground at the piece's centre:
  path-rock-slab.glb     an upright slab, leaning a little, moss on its top (0.4 across).
  path-rock-low.glb      a low rounded stone, mossy on top (0.65 across).
  path-rock-cluster.glb  three stones in a huddle (0.9 across).
  rustic-fence-a.glb     a run of three leaning branch posts along x (2.3 long), a rail along the top, a short one under.
  rustic-fence-b.glb     two posts (1.6 apart) with one rail across and one slipped down to the ground at +x.
  rustic-post.glb        a lone leaning post with a broken rail stub, for the gaps between runs.
Plain colour on the shared presets (P_Stone, P_Wood), the colour in COLOR_0. Seeded: a rebuild writes the same models.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from build_plaza_set import recolor, shade  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROCK, ROCK2, MOSS, MOSS2 = "#a7a89c", "#9a9c92", "#7da14c", "#90b158"
BRANCH, BRANCH2 = "#9d8263", "#8a7055"


def mossy(k, faces, seed, base=ROCK):
    """Moss over the faces that look up (a little noise in where it stops), stone down the sides."""
    rng = np.random.default_rng(seed)
    tones = [base, shade(base, 0.94), shade(base, 1.05)]
    for f in faces:
        up = f.normal.z + rng.uniform(-0.15, 0.15)       # Blender z is game up
        col = MOSS if up > 0.62 else MOSS2 if up > 0.45 else tones[rng.integers(3)]
        c = (*K.lin(col), 1.0)
        for lp in f.loops:
            lp[k.col] = c


def stone(k, M, c, radii, seed, rot=None, lumpy=0.12, segs=9, rings=6):
    k.bm.normal_update()
    faces = k.blob(c, radii, M["stone"], ROCK, segs=segs, rings=rings, seed=seed, lumpy=lumpy, flat_bottom=-c[1] - 0.04, rot=rot)
    k.bm.normal_update()
    mossy(k, faces, seed)


def path_rock_slab():
    K.reset()
    M = {"stone": K.Mat("P_Stone", rough=0.95)}
    k = K.Kit("path-rock-slab")
    stone(k, M, (0, 0.26, 0), (0.2, 0.32, 0.12), 3, rot=K.game_rot(yaw=0.2, roll=0.12), lumpy=0.1)
    k.tint_gradient(0.85, 1.0, 0.0, 0.6)
    return k.finish(smooth_deg=60), {}


def path_rock_low():
    K.reset()
    M = {"stone": K.Mat("P_Stone", rough=0.95)}
    k = K.Kit("path-rock-low")
    stone(k, M, (0, 0.08, 0), (0.33, 0.2, 0.25), 5, rot=K.game_rot(yaw=0.5), lumpy=0.16, segs=10)
    k.tint_gradient(0.85, 1.0, 0.0, 0.3)
    return k.finish(smooth_deg=60), {}


def path_rock_cluster():
    K.reset()
    M = {"stone": K.Mat("P_Stone", rough=0.95)}
    k = K.Kit("path-rock-cluster")
    stone(k, M, (-0.12, 0.12, 0.02), (0.26, 0.24, 0.2), 7, rot=K.game_rot(yaw=0.3, roll=-0.1))
    stone(k, M, (0.26, 0.05, -0.08), (0.17, 0.13, 0.15), 8, rot=K.game_rot(yaw=1.1), segs=8, rings=5)
    stone(k, M, (0.12, 0.03, 0.22), (0.12, 0.08, 0.1), 9, segs=7, rings=4)
    k.tint_gradient(0.85, 1.0, 0.0, 0.4)
    return k.finish(smooth_deg=60), {}


def post(k, M, x, z, h, lean, seed):
    """A branch post: its foot sunk a little, leaning by `lean` (x, z) at its top, a whittled point."""
    rng = np.random.default_rng(seed)
    lx, lz = lean
    pts = [(x, -0.05, z), (x + lx * 0.3 + rng.uniform(-0.01, 0.01), h * 0.35, z + lz * 0.3), (x + lx * 0.75, h * 0.8, z + lz * 0.75), (x + lx, h, z + lz),
           (x + lx * 1.04, h + 0.07, z + lz * 1.04)]
    k.tube(pts, 0.055, M["wood"], BRANCH2 if seed % 2 else BRANCH, n=7, caps=True, radii=[1.15, 1.0, 0.92, 0.85, 0.2])
    return lambda y: (x + lx * y / h, y, z + lz * y / h)   # a point up the post at height y


def rail(k, M, a, b, sag, seed, r=0.035):
    rng = np.random.default_rng(seed)
    a, b = np.array(a), np.array(b)
    pts = [tuple(a + (b - a) * t + np.array((0, -sag * 4 * t * (1 - t) + rng.uniform(-0.008, 0.008), 0))) for t in np.linspace(0, 1, 5)]
    k.tube(pts, r, M["wood"], shade(BRANCH, 1.06), n=6, caps=True, radii=[0.9, 1.0, 1.0, 0.95, 0.85])


def rustic_fence_a():
    K.reset()
    M = {"wood": K.Mat("P_Wood", rough=0.9)}
    k = K.Kit("rustic-fence-a")
    p0 = post(k, M, -1.12, 0.02, 0.88, (-0.05, 0.03), 1)
    p1 = post(k, M, 0.0, -0.02, 0.8, (0.04, -0.04), 2)
    p2 = post(k, M, 1.14, 0.03, 0.92, (0.07, 0.02), 3)
    a, b = p0(0.74), p2(0.78)
    rail(k, M, (a[0] - 0.12, a[1] + 0.01, a[2] + 0.06), (b[0] + 0.1, b[1] - 0.02, b[2] + 0.06), 0.05, 4)
    a, b = p0(0.36), p1(0.4)
    rail(k, M, (a[0] - 0.08, a[1], a[2] + 0.06), (b[0] + 0.12, b[1] - 0.05, b[2] + 0.06), 0.02, 5, r=0.03)
    k.tint_gradient(0.84, 1.0, 0.0, 1.0)
    return k.finish(smooth_deg=50), {}


def rustic_fence_b():
    K.reset()
    M = {"wood": K.Mat("P_Wood", rough=0.9)}
    k = K.Kit("rustic-fence-b")
    p0 = post(k, M, -0.8, 0.0, 0.84, (0.04, 0.03), 6)
    p1 = post(k, M, 0.8, 0.0, 0.78, (0.08, -0.03), 7)
    a, b = p0(0.68), p1(0.66)
    rail(k, M, (a[0] - 0.1, a[1], a[2] + 0.06), (b[0] + 0.12, b[1] + 0.02, b[2] + 0.06), 0.04, 8)
    # The lower rail has slipped off its far post: one end still on the near post, the other in the grass.
    a = p0(0.34)
    rail(k, M, (a[0] - 0.06, a[1], a[2] + 0.06), (0.92, 0.03, 0.2), 0.0, 9, r=0.03)
    k.tint_gradient(0.84, 1.0, 0.0, 0.95)
    return k.finish(smooth_deg=50), {}


def rustic_post():
    K.reset()
    M = {"wood": K.Mat("P_Wood", rough=0.9)}
    k = K.Kit("rustic-post")
    p = post(k, M, 0.0, 0.0, 0.86, (-0.07, 0.05), 10)
    a = p(0.7)
    rail(k, M, (a[0] - 0.05, a[1], a[2] + 0.06), (a[0] + 0.38, a[1] - 0.06, a[2] + 0.08), 0.0, 11)
    k.tint_gradient(0.84, 1.0, 0.0, 0.95)
    return k.finish(smooth_deg=50), {}


MODELS = {"path-rock-slab": path_rock_slab, "path-rock-low": path_rock_low, "path-rock-cluster": path_rock_cluster,
          "rustic-fence-a": rustic_fence_a, "rustic-fence-b": rustic_fence_b, "rustic-post": rustic_post}


def review(out):
    """A stretch of path edge: the fence runs with gaps, the rocks, the path's lamps and some flowers, from the GLBs."""
    import bpy
    K.reset()
    spots = [("rustic-fence-a", (-2.6, 0, -0.3, 0.05)), ("rustic-post", (-0.7, 0, -0.1, 0.0)), ("rustic-fence-b", (1.2, 0, -0.2, -0.08)),
             ("path-rock-slab", (-1.6, 0, 0.6, 0.4)), ("path-rock-low", (0.2, 0, 0.7, 0.0)), ("path-rock-cluster", (2.6, 0, 0.7, 1.0)),
             ("wood-post-lamp", (3.4, 0, -0.6, math.pi)), ("hand-lantern", (-0.3, 0, 0.9, 0.3)), ("hand-lantern", (2.0, 0, 1.0, 0.0))]
    plants = os.path.join(os.path.dirname(K.OUT), "plants")
    spots += [(os.path.join(plants, f"{nm}.glb"), at) for nm, at in (("flower-meadow", (-1.2, 0, -0.9, 0.0)), ("flower-tallgrass", (0.5, 0, -0.8, 0.0)),
                                                                     ("flower-tallgrass", (-3.3, 0, 0.5, 1.0)), ("flower-meadow", (1.5, 0, 0.9, 2.0)))]
    obs = []
    for nm, at in spots:
        path = nm if nm.endswith(".glb") else os.path.join(K.OUT, f"{nm}.glb")
        if not os.path.exists(path):
            continue
        bpy.ops.import_scene.gltf(filepath=path)
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location = K.G(at[0], at[1], at[2])
                o.rotation_euler[2] = at[3]
                if o.data.color_attributes:
                    o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.context.view_layer.update()
    K.review(obs, out, views=((0, 26), (180, 26)), size=640)


if __name__ == "__main__":
    only = [a for a in ARGS if a in MODELS]
    for nm, make in MODELS.items():
        if only and nm not in only:
            continue
        ob, info = make()
        K.export([ob], f"game/props/{nm}.glb")
        print("EDGE", nm, info)
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "path-edge.png"))
