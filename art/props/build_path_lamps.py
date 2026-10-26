"""The path's lamps and lanterns (terrain v3, game/village-art; David, 2026-10-26: "i want lamp post with warm light shining,
and hand lamks on the side as well. it should be super aesthetic at night", references lamp-wood-post.jpg,
lamp-branch-post.jpg and lantern.jpg in specs/references/terrain/r2-2026-10-26/). All three hang or hold the same iron
lantern, warm amber glass under a hipped iron roof with a big ring on top, and glow as the street lamps do: the panes are
M_Glass with an emissive map, the ironwork M_Iron (draw them with AmbientProps Lanterns, propModels NEW_LAMPS).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_path_lamps.py [-- review <dir>]

Writes, under web/public/assets/game/props/, in game units at scale 1, the origin on the ground at the post's foot:
  wood-post-lamp.glb    a square timber post on a stone footing with an iron collar, an arm out along +x on an angled
                        brace, the lantern on a hook at its end: its light at (0.8, 1.93, 0).
  branch-post-lamp.glb  a crooked branch on a round stepped stone plinth with a mossy top, a cross branch lashed on with
                        rope, the lantern hung by two rings off its +x end: its light at (0.5, 1.75, 0).
  hand-lantern.glb      the lantern alone, standing on its foot (its light at (0, 0.14, 0)), for the path's sides and the
                        dock. To hang it from a hook, set its foot HAND_RING (0.54) under the hook.
Materials: M_Iron, M_Glass, M_LampWood (the posts), P_Stone (footing, plinth and moss), P_Cloth (the rope). Seeded.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from build_streetlamp import glass_tex, iron_tex  # noqa: E402  (the street lamp's iron paint and glowing pane)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
IRON, WOOD, DARKW, STONE, MOSS, ROPE = "#3d3431", "#d0925a", "#b07744", "#a8a39b", "#7f9e4f", "#e2c27a"
HAND = 1.1
HAND_LIGHT, HAND_RING = (0.0, 0.143, 0.0), 0.542


def mats():
    """The iron and the glass, the pane warmed to amber (the reference's) from the street lamp's cream."""
    base, emit = glass_tex()
    return {"iron": K.Mat("M_Iron", tex=K.image("lamp_iron", iron_tex()), rough=0.8),
            "glass": K.Mat("M_Glass", tex=K.image("lantern_pane", base * K.arr("#ffd9a0")),
                           emit=K.image("lantern_glow", np.clip(emit * K.arr("#ffd6a0") * 1.12, 0, 1)), rough=0.7)}


def iron_lantern(k, M, foot, s=1.0):
    """The lantern standing on `foot`, s its scale: a square foot plate, amber panes widening to the top between iron
    corner bars, a hipped roof over a wide rim, and a ring on top. Returns (its light point, its ring's top y)."""
    x, y, z = foot
    q = math.pi / 4
    rb, rt = 0.105 * s, 0.13 * s                 # corner radii of the panes, foot and top
    g0, g1 = y + 0.03 * s, y + 0.25 * s
    k.lathe((x, 0, z), [(0.0, y), (rb * 1.22, y), (rb * 1.24, y + 0.022 * s), (rb * 1.06, g0 + 0.004), (0.0, g0 + 0.004)],
            M["iron"], IRON, n=4, phase=q, v_len=0.3)
    k.lathe((x, 0, z), [(rb, g0), (rt, g1)], M["glass"], "#ffffff", n=4, phase=q, u_tiles=4, v_len=0.23 * s)
    for j in range(4):
        a = math.tau * j / 4 + q
        k.tube([(x + math.cos(a) * rb * 1.03, g0 - 0.004, z + math.sin(a) * rb * 1.03), (x + math.cos(a) * rt * 1.03, g1 + 0.004, z + math.sin(a) * rt * 1.03)],
               0.011 * s, M["iron"], IRON, n=5, v_len=0.5)
    top = g1 + 0.135 * s
    k.lathe((x, 0, z), [(rt * 0.9, g1 - 0.006), (rt * 1.34, g1 + 0.012 * s), (rt * 1.36, g1 + 0.03 * s), (rt * 1.12, g1 + 0.042 * s),
                        (rt * 0.34, top - 0.016 * s), (rt * 0.2, top - 0.004 * s), (0.0, top)], M["iron"], IRON, n=4, phase=q, v_len=0.3)
    R = 0.05 * s
    ring = [(x + math.sin(a) * R, top + R * 0.9 - math.cos(a) * R, z) for a in np.linspace(0, math.tau, 10, endpoint=False)]
    k.tube(ring, 0.013 * s, M["iron"], IRON, n=6, v_len=0.3, closed_path=True)
    return (x, g0 + 0.1 * s, z), top + R * 1.9 + 0.013 * s


def wood_post_lamp():
    K.reset()
    M = mats()
    M["wood"] = K.Mat("M_LampWood", tex=K.image("post_grain", K.grain(256, 128, 2711, "#ffffff", lines=(6, 17, 41), contrast=0.2, knots=1)), rough=0.92)
    M["stone"] = K.Mat("P_Stone", rough=0.95)
    k = K.Kit("wood-post-lamp")
    k.rbox((0, 0.08, 0), (0.34, 0.2, 0.34), 0.05, M["stone"], STONE, segs=1)
    k.beam((0, 0.12, 0), (0.015, 2.43, 0), 0.19, 0.19, 0.035, M["wood"], WOOD, segs=2, uv_len=1.2)
    # The arm, rising a little to its end, and the brace under it (the reference's Y).
    k.beam((-0.13, 2.36, 0), (0.94, 2.5, 0), 0.15, 0.15, 0.03, M["wood"], WOOD, segs=2, uv_len=1.2)
    k.beam((0.03, 1.74, 0), (0.52, 2.4, 0), 0.115, 0.11, 0.025, M["wood"], DARKW, segs=1, uv_len=1.2)
    # The iron collar and its diamond studs, one on each face.
    k.rbox((0.005, 1.04, 0), (0.235, 0.17, 0.235), 0.014, M["iron"], "#8a8784", segs=1)
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        k.blob((0.005 + dx * 0.121, 1.04, dz * 0.121), (0.012 if dx else 0.024, 0.024, 0.012 if dz else 0.024), M["iron"], "#c9c4bc", segs=4, rings=2)
    k.blob((0.42, 2.52, 0.077), (0.022, 0.022, 0.01), M["iron"], "#c9c4bc", segs=4, rings=2)
    # The hook under the arm's end, and the lantern on it.
    hx = 0.8
    k.tube([(hx, 2.45, 0), (hx, 2.35, 0), (hx + 0.035, 2.31, 0), (hx + 0.01, 2.27, 0), (hx - 0.02, 2.29, 0)], 0.012, M["iron"], IRON, n=5, v_len=0.3, caps=True)
    nverts = len(k.bm.verts)
    light, ring = iron_lantern(k, M, (hx, 0, 0), 1.1)
    drop = 2.285 - ring
    for v in list(k.bm.verts)[nverts:]:     # the lantern is built standing at 0: lift it onto the hook
        v.co.z += drop
    light = (hx, round(light[1] + drop, 3), 0.0)
    k.tint_gradient(0.8, 1.0, 0.0, 2.55)
    ob = k.finish(smooth_deg=45)
    K.export([ob], "game/props/wood-post-lamp.glb")
    print("WOOD_POST_LAMP", {"light": light})
    return ob


def branch_post_lamp():
    K.reset()
    M = mats()
    M["wood"] = K.Mat("M_LampWood", tex=K.image("branch_grain", K.grain(256, 128, 2712, "#ffffff", lines=(5, 13, 29), contrast=0.16, knots=1)), rough=0.92)
    M["stone"] = K.Mat("P_Stone", rough=0.95)
    M["rope"] = K.Mat("P_Cloth", rough=1.0)
    k = K.Kit("branch-post-lamp")
    k.lathe((0, 0, 0), [(0.52, -0.03), (0.52, 0.06), (0.49, 0.085), (0.43, 0.09), (0.42, 0.15), (0.39, 0.175), (0.34, 0.18)],
            M["stone"], STONE, n=18, v_len=0.5)
    k.lathe((0, 0, 0), [(0.345, 0.17), (0.31, 0.2), (0.16, 0.215), (0.0, 0.22)], M["stone"], MOSS, n=18, v_len=0.5)
    # The crooked branch, its foot flared into the moss, its top running past the cross branch to a point.
    post = [(0.0, 0.12, 0.0), (0.02, 0.6, 0.01), (-0.01, 1.2, -0.01), (0.03, 1.75, 0.0), (0.0, 2.2, 0.0), (-0.01, 2.36, 0.0)]
    k.tube(post, 0.07, M["wood"], WOOD, n=8, v_len=0.6, u_tiles=0.5, caps=True, radii=[1.35, 1.0, 0.95, 0.88, 0.75, 0.3])
    k.tube([(0.03, 0.42, 0.0), (0.12, 0.45, 0.05), (0.16, 0.47, 0.07)], 0.045, M["wood"], DARKW, n=7, v_len=0.6, u_tiles=0.5, caps=True, radii=[1.0, 0.95, 0.9])
    # The cross branch: a knobbed end behind, tapering out along +x.
    arm = [(-0.36, 2.08, 0.0), (-0.2, 2.11, 0.0), (0.1, 2.14, 0.0), (0.4, 2.17, 0.0), (0.64, 2.21, 0.0)]
    k.tube(arm, 0.055, M["wood"], WOOD, n=7, v_len=0.6, u_tiles=0.5, caps=True, radii=[1.25, 1.1, 0.95, 0.75, 0.5])
    # The rope lashing: turns round the post above and below the arm, and a cross over the joint.
    for y, tilt in ((2.035, 0.2), (2.075, -0.15), (2.2, 0.18)):
        k.tube([(math.cos(a) * 0.072, y + tilt * 0.07 * math.cos(a), math.sin(a) * 0.072) for a in np.linspace(0, math.tau, 10, endpoint=False)],
               0.016, M["rope"], ROPE, n=5, v_len=0.12, closed_path=True)
    for sgn in (1, -1):
        k.tube([(math.cos(a) * 0.075, 2.14 + sgn * 0.085 * math.cos(a), math.sin(a) * 0.075) for a in np.linspace(0, math.tau, 10, endpoint=False)],
               0.015, M["rope"], ROPE, n=5, v_len=0.12, closed_path=True)
    # The iron ring round the arm, and the lantern hung by its own ring through it.
    hx = 0.5
    k.tube([(hx, 2.165 + math.cos(a) * 0.065, math.sin(a) * 0.065) for a in np.linspace(0, math.tau, 10, endpoint=False)], 0.012, M["iron"], IRON,
           n=6, v_len=0.3, closed_path=True)
    nverts = len(k.bm.verts)
    light, ring = iron_lantern(k, M, (hx, 0, 0), 1.05)
    drop = 2.112 - ring
    for v in list(k.bm.verts)[nverts:]:
        v.co.z += drop
    light = (hx, round(light[1] + drop, 3), 0.0)
    k.tint_gradient(0.8, 1.0, 0.0, 2.36)
    ob = k.finish(smooth_deg=50)
    K.export([ob], "game/props/branch-post-lamp.glb")
    print("BRANCH_POST_LAMP", {"light": light})
    return ob


def hand_lantern():
    K.reset()
    M = mats()
    k = K.Kit("hand-lantern")
    light, ring = iron_lantern(k, M, (0, 0, 0), HAND)
    k.tint_gradient(0.84, 1.0, 0.0, ring)
    ob = k.finish(smooth_deg=45)
    K.export([ob], "game/props/hand-lantern.glb")
    print("HAND_LANTERN", {"light": light, "ring": round(ring, 3)})
    return ob


def review(out):
    """The three side by side, read back from their GLBs."""
    import bpy
    K.reset()
    obs = []
    for nm, x in (("wood-post-lamp", -1.1), ("branch-post-lamp", 0.5), ("hand-lantern", 1.6)):
        bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"{nm}.glb"))
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location.x += x
                o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.context.view_layer.update()
    K.review(obs, out, views=((20, 14), (160, 14)), size=560)
    # And at night: the sun down to a glimmer, a dusk sky, the panes' glow doing the work.
    sc = bpy.context.scene
    bpy.data.lights["Key"].energy = 0.25
    next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (*K.lin("#1c2338"), 1)
    for o in obs:
        for m in o.data.materials:
            b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            if b.inputs["Emission Color"].links:
                b.inputs["Emission Strength"].default_value = 2.5
    sc.render.filepath = os.path.splitext(out)[0] + ".2.png"
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    wood_post_lamp()
    branch_post_lamp()
    hand_lantern()
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "path-lamps.png"))
