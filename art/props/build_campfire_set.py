"""The new world's campfire set (terrain v3, game/terrain-art; David, 2026-10-26, the beach campfire: "a little bare brain
storm to fill it out"). Dressing for round the campfire (campfire.glb and log-bench.glb stay as they are):

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_campfire_set.py [-- review <dir>]

Writes, under web/public/assets/game/props/, in game units at scale 1, the origin on the ground:
  stump-seat.glb     a sawn stump to sit on, root flares at its foot, its top at 0.45.
  firewood-stack.glb a rick of logs between two stakes (along x, 1.2 long) and, beside it at +x, a chopping block
                     with a hatchet in it; the two centred on the origin together (x -0.94 to 0.95).
  fish-rack.glb      a drying rack: two crossed-pole ends, a ridge pole along x (1.8), six fish hung on strings.
  camp-lantern.glb   a crooked branch pole with a lantern hung off its crook (its light at (0.3, 1.18, 0)); it glows as
                     the street lamps do (M_Glass, M_Iron: draw it with AmbientProps Lanterns, propModels NEW_LAMPS.camp).
The logs wear the campfire's bark and end grain (build_campfire.py's atlas and log), the lantern the new lamps'
(build_new_lamps.py). Seeded: a rebuild writes the same models.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from build_campfire import log, log_atlas  # noqa: E402
from build_new_lamps import IRON, glass_mats, lantern  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TONES = ["#9a7656", "#8a6446", "#a07c58", "#94704f", "#86603f"]
CAMP_LIGHT = (0.3, 1.18, 0.0)
rng = np.random.default_rng(1027)


def log_mat():
    return K.Mat("M_Log", tex=K.image("campfire_log", log_atlas()), rough=0.95)


def stump_seat():
    K.reset()
    M = {"log": log_mat()}
    k = K.Kit("stump-seat")
    log(k, M, (0, -0.03, 0), (0, 0.45, 0), 0.25, tone="#8f6a4a", n=12, seed=1)
    # The root flare: a skirt of bark round its foot, swelling into five roots that run into the ground.
    lobes = lambda kk, i: 1 + (0.28, 0.18, 0.07, 0.0)[i] * (0.5 + 0.5 * math.cos(5 * math.tau * kk / 20 + 0.4))
    k.lathe((0, 0, 0), [(0.3, -0.02), (0.28, 0.035), (0.262, 0.1), (0.256, 0.19)], M["log"], "#86634a", n=20, u_tiles=0.5, v_len=0.5, wobble=lobes)
    k.tint_gradient(0.8, 1.0, 0.0, 0.45)
    return k.finish(smooth_deg=55), {"top": 0.45}


def firewood_stack():
    K.reset()
    M = {"log": log_mat(), "iron": K.Mat("M_Iron", color="#5a5f63", rough=0.6)}
    k = K.Kit("firewood-stack")
    r, L = 0.085, 1.1
    for row, count in enumerate((5, 4, 3, 2)):
        y = r + row * r * 1.72
        for i in range(count):
            z = (i - (count - 1) / 2) * r * 2.02
            x0 = -L / 2 + rng.uniform(-0.05, 0.05)
            log(k, M, (x0, y, z), (x0 + L + rng.uniform(-0.06, 0.04), y + rng.uniform(-0.01, 0.01), z + rng.uniform(-0.02, 0.02)),
                r * rng.uniform(0.88, 1.08), tone=TONES[rng.integers(len(TONES))], n=7, seed=100 + row * 10 + i)
    for x in (-0.62, 0.62):
        log(k, M, (x, -0.04, 0), (x + 0.02, 0.86, 0), 0.04, tone="#7a5a40", n=6, seed=int(50 + x * 10))
    # The chopping block, a hatchet stuck in it, and a split log at its foot.
    log(k, M, (1.02, -0.02, 0.05), (1.02, 0.36, 0.05), 0.2, tone="#8f6a4a", n=10, seed=7)
    k.beam((0.98, 0.36, 0.08), (0.82, 0.7, 0.2), 0.035, 0.025, 0.01, M["log"], "#c9a276", segs=1, uv_len=0.5)
    k.rbox((1.0, 0.38, 0.07), (0.035, 0.1, 0.16), 0.008, M["iron"], "#ffffff", segs=1, rot=K.game_rot(yaw=0.5, pitch=0.2))
    log(k, M, (0.86, 0.06, 0.34), (1.22, 0.07, 0.4), 0.06, tone="#94704f", n=7, seed=8)
    k.tint_gradient(0.82, 1.0, 0.0, 0.86)
    for v in k.bm.verts:                   # centre the stack and the block on the origin (Blender x is game x)
        v.co.x -= 0.28
    return k.finish(smooth_deg=55), {}


def fish_rack():
    K.reset()
    M = {"log": log_mat(), "rope": K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2702, "#ffffff")), rough=1.0),
         "fish": K.Mat("M_Fish", rough=0.55)}
    k = K.Kit("fish-rack")
    H, half = 1.3, 0.9
    for x in (-half, half):
        for s in (-1, 1):
            log(k, M, (x + 0.03 * s, -0.04, s * 0.34), (x - 0.03 * s, H + 0.12, -s * 0.06), 0.035, tone="#86603f", n=6, seed=int(30 + x * 10 + s))
    log(k, M, (-half - 0.12, H, 0), (half + 0.12, H + 0.01, 0), 0.035, tone="#94704f", n=6, seed=33)
    for x in (-half, half):
        k.tube([(x - 0.05, H + 0.04, 0.0), (x, H - 0.04, 0.045), (x + 0.05, H + 0.04, 0.0), (x, H + 0.06, -0.045)], 0.012, M["rope"], "#c7a268",
               n=5, v_len=0.12, closed_path=True)
    fish_cols = ["#8fa3ad", "#a4b2a0", "#b0a28e", "#93a6b5", "#a8aeb2", "#9fb0a6"]
    for i, x in enumerate(np.linspace(-0.68, 0.68, 6)):
        drop = rng.uniform(0.28, 0.4)
        k.tube([(x, H - 0.02, 0), (x, H - drop + 0.02, 0)], 0.006, M["rope"], "#c7a268", n=4, v_len=0.12)
        L = rng.uniform(0.36, 0.46)
        top = H - drop
        col = fish_cols[i]
        # The fish hangs by its tail: a tail fin at the top, the body swelling below it, the head at the bottom.
        k.blob((x, top - 0.05 - L * 0.5, 0), (0.035, L * 0.5, 0.075), M["fish"], col, segs=8, rings=7, seed=i, lumpy=0.02)
        k.quad([(x, top - 0.1, 0.0), (x, top + 0.0, -0.065), (x, top + 0.025, 0.0), (x, top + 0.0, 0.065)], M["fish"], col)
        k.blob((x + 0.03, top - 0.05 - L * 0.82, 0.03), (0.012, 0.012, 0.012), M["fish"], "#2a2a2a", segs=5, rings=3)
    k.tint_gradient(0.82, 1.0, 0.0, H)
    return k.finish(smooth_deg=55), {"top": H + 0.16}


def camp_lantern():
    K.reset()
    M = glass_mats()
    M["log"] = log_mat()
    k = K.Kit("camp-lantern")
    pole = [(0.0, -0.06, 0), (0.02, 0.5, 0.01), (-0.01, 1.0, 0.0), (0.02, 1.4, 0.0), (0.04, 1.52, 0.0)]
    k.tube(pole, 0.045, M["log"], "#86603f", n=7, v_len=0.5, u_tiles=0.5, caps=True, radii=[1.25, 1.0, 0.92, 0.8, 0.6])
    crook = [(0.0, 1.32, 0.0), (0.12, 1.42, 0.0), (0.26, 1.46, 0.0), (0.33, 1.44, 0.0)]
    k.tube(crook, 0.028, M["log"], "#86603f", n=6, v_len=0.5, u_tiles=0.5, caps=True, radii=[1.0, 0.9, 0.75, 0.6])
    lx, ly, lz = CAMP_LIGHT
    hang = lantern(k, M, (lx, ly, lz), 0.085, 0.16, 4, math.pi / 4, roof=1.3)
    k.tube([(lx, 1.44, 0), (lx, hang - 0.01, 0)], 0.006, M["iron"], IRON, n=5, v_len=0.3)
    k.tint_gradient(0.82, 1.0, 0.0, 1.5)
    return k.finish(smooth_deg=50), {"light": CAMP_LIGHT}


def review(out):
    """The set round a campfire, read back from the GLBs."""
    import bpy
    K.reset()
    spots = {"campfire": (0, 0, 0), "log-bench": (0, 0, 2.1, math.pi), "stump-seat": (-1.9, 0, -0.9), "firewood-stack": (1.8, 0, 1.5, 0.6),
             "fish-rack": (-0.4, 0, -2.6), "camp-lantern": (1.9, 0, -1.2)}
    obs = []
    for nm, at in spots.items():
        bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"{nm}.glb"))
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location = K.G(at[0], at[1], at[2])
                o.rotation_euler[2] = at[3] if len(at) > 3 else 0.0
                o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.context.view_layer.update()
    K.review(obs, out, views=((20, 30), (200, 30)), size=600)


if __name__ == "__main__":
    for nm, make in (("stump-seat", stump_seat), ("firewood-stack", firewood_stack), ("fish-rack", fish_rack), ("camp-lantern", camp_lantern)):
        ob, info = make()
        K.export([ob], f"game/props/{nm}.glb")
        print("SET", nm, info)
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "campfire-set.png"))
