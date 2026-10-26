"""The new world's lamps (terrain v3, game/terrain-art; David, 2026-10-26: "improve lighing assets"): a street lamp for the
village and its paths, and a wooden lantern post for the wharf and the market. Both keep the glow the game eases at
dusk (components/game/AmbientProps.tsx Lanterns): the panes are M_Glass with an emissive map (the look's glass class),
the ironwork M_Iron (the look's metal class), so they work in an instanced Lanterns exactly as the old lamp does.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_new_lamps.py [-- review <dir>]

Writes, in game units at scale 1, the origin on the ground at the post's foot:
  village-lamp.glb  a painted-iron post on a stepped plinth with brass collars and a ball finial (its top at 2.67, the
                    gulls' perch, as the old lamp's), and a scrolled crook arm out along +x hanging a six-sided lantern:
                    its light at (0.52, 2.08, 0).
  lantern-post.glb  a square timber post with a rope lashing, a cross arm out along +x on a brace, and a square ship's
                    lantern hung from its end on an iron hook: its light at (0.56, 1.78, 0).
Materials: M_Iron, M_Glass, and M_Brass (the street lamp) or M_LampWood and M_Rope (the post).
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from build_streetlamp import glass_tex, iron_tex  # noqa: E402  (the old lamp's painted iron and frosted, glowing pane)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
IRON, GLASS, BRASS = "#2f4740", "#f6e8cc", "#c9a25a"
LAMP_LIGHT, POST_LIGHT = (0.52, 2.08, 0.0), (0.56, 1.78, 0.0)


def lantern(k, M, c, r, h, sides, phase, roof=1.3):
    """A hanging lantern centred on c: frosted panes from its foot up to its shoulder (r round, h tall, wider at the
    top), iron bars at the corners, a cup under it with a drop, and a hipped roof with a ring to hang it by."""
    x, y, z = c
    y0, y1 = y - h / 2, y + h / 2
    k.lathe((x, y0, z), [(r * 0.86, 0.0), (r, h)], M["glass"], GLASS, n=sides, phase=phase, u_tiles=sides, v_len=h * 1.05)
    for j in range(sides):
        a = math.tau * j / sides + phase
        k.tube([(x + math.sin(a) * r * 0.9, y0 - 0.005, z + math.cos(a) * r * 0.9), (x + math.sin(a) * r * 1.05, y1 + 0.005, z + math.cos(a) * r * 1.05)],
               0.011, M["iron"], IRON, n=5, v_len=0.5)
    k.lathe((x, 0, z), [(0.0, y0 - 0.07), (r * 0.25, y0 - 0.065), (r * 0.5, y0 - 0.035), (r * 0.95, y0 - 0.008), (r * 0.98, y0 + 0.01),
                        (r * 0.84, y0 + 0.012)], M["iron"], IRON, n=sides, phase=phase, v_len=0.3)
    k.lathe((x, 0, z), [(0.0, y1 - 0.004), (r * 1.04, y1 - 0.004), (r * roof, y1 + 0.02), (r * roof, y1 + 0.036), (r * 0.9, y1 + 0.06),
                        (r * 0.3, y1 + r * 0.75), (r * 0.18, y1 + r * 0.8), (0.0, y1 + r * 0.82)], M["iron"], IRON, n=sides, phase=phase, v_len=0.3)
    top = y1 + r * 0.82
    ring = [(x + math.cos(a) * 0.028, top + 0.028 + math.sin(a) * 0.028, z) for a in np.linspace(0, math.tau, 8, endpoint=False)]
    k.tube(ring, 0.008, M["iron"], IRON, n=5, v_len=0.3, closed_path=True)
    return top + 0.056


def glass_mats():
    base, emit = glass_tex()
    return {"iron": K.Mat("M_Iron", tex=K.image("lamp_iron", iron_tex()), rough=0.8),
            "glass": K.Mat("M_Glass", tex=K.image("lamp_pane", base), emit=K.image("lamp_glow", emit), rough=0.7)}


def village_lamp():
    K.reset()
    M = glass_mats()
    M["brass"] = K.Mat("M_Brass", rough=0.55, color=BRASS)
    k = K.Kit("village-lamp")
    prof = [(0.0, 0.0), (0.21, 0.0), (0.215, 0.016), (0.215, 0.06), (0.2, 0.074), (0.16, 0.084), (0.15, 0.11), (0.15, 0.16), (0.12, 0.19),
            (0.088, 0.24), (0.074, 0.3), (0.066, 0.36), (0.054, 0.42), (0.048, 1.2), (0.044, 2.5), (0.0, 2.5)]
    k.lathe((0, 0, 0), prof, M["iron"], IRON, n=14, v_len=0.6)
    # Brass collars up the post and the finial over the arm.
    for y, h in ((0.36, 0.05), (1.22, 0.06), (2.28, 0.05)):
        k.lathe((0, 0, 0), [(0.052, y), (0.068, y + 0.012), (0.068, y + h - 0.012), (0.052, y + h)], M["brass"], BRASS, n=12, v_len=0.3)
    k.lathe((0, 0, 0), [(0.044, 2.49), (0.06, 2.5), (0.07, 2.53), (0.04, 2.565), (0.03, 2.58)], M["iron"], IRON, n=12, v_len=0.3)
    k.blob((0, 2.62, 0), (0.05, 0.05, 0.05), M["brass"], BRASS, segs=12, rings=7)
    k.blob((0, 2.672 - 0.012, 0), (0.012, 0.012, 0.012), M["brass"], BRASS, segs=6, rings=4)
    # The crook: an arm out from under the collar, over and down to the hook, and a scroll under it.
    arm = [(0.03, 2.3, 0), (0.16, 2.37, 0), (0.32, 2.41, 0), (0.46, 2.4, 0), (0.53, 2.36, 0), (0.54, 2.3, 0), (0.52, 2.27, 0)]
    k.tube(arm, 0.02, M["iron"], IRON, n=7, v_len=0.5, caps=True)
    scroll = [(0.04, 2.02, 0)] + [(0.2 + 0.075 * math.cos(a) * (1 - 0.12 * a), 2.27 + 0.075 * math.sin(a) * (1 - 0.12 * a), 0)
                                  for a in np.linspace(-math.pi * 0.9, math.pi * 1.6, 12)]
    k.tube(scroll, 0.012, M["iron"], IRON, n=6, v_len=0.5, caps=True)
    k.blob((0.5, 2.405, 0), (0.022, 0.022, 0.022), M["brass"], BRASS, segs=8, rings=5)
    # The lantern on its hook.
    lx, ly, lz = LAMP_LIGHT
    hang = lantern(k, M, (lx, ly - 0.02, lz), 0.11, 0.2, 6, math.pi / 6)
    k.tube([(0.53, 2.28, 0), (lx, hang - 0.01, 0)], 0.007, M["iron"], IRON, n=5, v_len=0.3)
    k.tint_gradient(0.8, 1.0, 0.0, 2.67)
    ob = k.finish(smooth_deg=48)
    K.export([ob], "game/props/village-lamp.glb")
    print("VILLAGE_LAMP", {"top": 2.672, "light": LAMP_LIGHT})
    return ob


def lantern_post():
    K.reset()
    M = glass_mats()
    M["wood"] = K.Mat("M_LampWood", tex=K.image("post_grain", K.grain(256, 128, 2701, "#ffffff", lines=(6, 17, 41), contrast=0.18, knots=1)), rough=0.92)
    M["rope"] = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2702, "#ffffff")), rough=1.0)
    k = K.Kit("lantern-post")
    WOOD, DARKW = "#9a7650", "#7a5b3d"
    k.rbox((0, 1.2, 0), (0.17, 2.4, 0.17), 0.03, M["wood"], WOOD, segs=2, uv_len=1.2, v_axis=1)
    k.rbox((0, 2.42, 0), (0.21, 0.05, 0.21), 0.015, M["wood"], DARKW, segs=1, uv_len=1.0)
    k.rbox((0.01, 0.06, 0), (0.25, 0.12, 0.25), 0.03, M["wood"], DARKW, segs=1, uv_len=1.0)
    # The cross arm over the lantern and its brace.
    k.beam((-0.06, 2.2, 0), (0.68, 2.2, 0), 0.1, 0.12, 0.02, M["wood"], WOOD, segs=1, uv_len=1.2)
    k.beam((0.06, 1.86, 0), (0.36, 2.15, 0), 0.075, 0.075, 0.015, M["wood"], DARKW, segs=1, uv_len=1.2)
    # A rope lashing round the post at hand height, its tail hanging.
    for i in range(5):
        y = 1.02 + i * 0.045
        ring = [(math.cos(a) * 0.105, y + 0.012 * math.sin(a), math.sin(a) * 0.105) for a in np.linspace(0, math.tau, 10, endpoint=False)]
        k.tube(ring, 0.022, M["rope"], "#c7a268", n=6, v_len=0.12, closed_path=True)
    k.tube([(0.09, 1.04, 0.07), (0.13, 0.9, 0.09), (0.12, 0.74, 0.1), (0.1, 0.66, 0.1)], 0.02, M["rope"], "#c7a268", n=6, v_len=0.12, caps=True)
    # The hook and the lantern.
    lx, ly, lz = POST_LIGHT
    k.tube([(lx, 2.15, 0), (lx, 2.08, 0), (lx + 0.03, 2.05, 0), (lx + 0.02, 2.02, 0)], 0.01, M["iron"], IRON, n=5, v_len=0.3)
    hang = lantern(k, M, (lx, ly - 0.01, lz), 0.12, 0.24, 4, math.pi / 4, roof=1.25)
    k.tube([(lx + 0.015, 2.025, 0), (lx, hang - 0.01, 0)], 0.007, M["iron"], IRON, n=5, v_len=0.3)
    k.tint_gradient(0.8, 1.0, 0.0, 2.45)
    ob = k.finish(smooth_deg=45)
    K.export([ob], "game/props/lantern-post.glb")
    print("LANTERN_POST", {"top": 2.445, "light": POST_LIGHT})
    return ob


def review(out):
    """Both lamps side by side, read back from their GLBs."""
    import bpy
    K.reset()
    obs = []
    for nm, x in (("village-lamp", -0.9), ("lantern-post", 0.9)):
        bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"{nm}.glb"))
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location.x += x
                o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.context.view_layer.update()
    K.review(obs, out, views=((20, 16), (200, 16)), size=520)


if __name__ == "__main__":
    village_lamp()
    lantern_post()
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "lamps.png"))
