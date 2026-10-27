"""The fish, tweaked to sit in our look (game/remodel; David, 2026-10-27: "maybe tweak the fish models we have so it fits
our game"). Every species keeps its shape, pattern, size and id, so players still know it; what changes is how it is
finished, the same way for all 81 so they read as one family with the rest of our art:

  - softer: every face smooth-shaded (the dump mixes faceted fins and heads in), the scale-pattern normal map dropped
    (our props are smooth and matte, no baked micro detail), and the painted texture eased (a light blur that keeps
    stripes and spots but loses the fine scale noise);
  - our palette: the texture graded a little softer and warmer (less saturation, a lifted shadow, a hint of warm),
    so the reef colours sit beside the wharf's painted timber instead of glowing over it;
  - one light: a counter-shade in COLOR_0 (the back a touch darker, the belly full), the same on every fish, so they
    share the props' top-light gradient (propkit tint_gradient);
  - one material response: a soft wet sheen (roughness 0.5, no metal) on every species.

Not changed: the geometry's shape and frame (the game's "raw" calibration and catchLength sizing still apply), the
triangles (never more), the UVs. The rig is baked to its rest pose (the game never animates the bones).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_fish.py [-- only a,b] [-- review <dir>]

Reads web/public/assets/acnh/fish/<name>.glb (or the git copy, art/props/dumpkit.py), writes
web/public/assets/game/remodel/fish/<name>.glb (the dump's name: lib/game/world/active.ts worldModel swaps the folder in the new world).
"""
import math, os, sys
import bpy, bmesh
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "props"))
import dumpkit as D  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC = os.path.join(D.ROOT, "web", "public", "assets", "acnh", "fish")
OUT = "game/remodel/fish"
ROUGH, BACK, BELLY = 0.5, 0.76, 1.0


def blur(a, passes):
    """A [1 2 1] blur along both axes, `passes` times, wrapping (the UV islands sit away from the edges)."""
    for _ in range(passes):
        a = (np.roll(a, 1, 0) + 2 * a + np.roll(a, -1, 0)) / 4
        a = (np.roll(a, 1, 1) + 2 * a + np.roll(a, -1, 1)) / 4
    return a


def grade(rgb):
    """Soften and warm a painted fish texture (float sRGB [h, w, 3])."""
    luma = rgb @ np.array([0.299, 0.587, 0.114])
    rgb = luma[..., None] + (rgb - luma[..., None]) * 0.8           # less saturated, softer
    rgb = 0.06 + rgb * 0.92                                         # shadows lifted, no pure black
    rgb = rgb * np.array([1.04, 1.0, 0.94])                         # warm light, as the island's
    return np.clip(rgb, 0, 1)


def tweak_texture(img, done):
    if img.name in done:
        return
    done.add(img.name)
    px = D.pixels(img)
    w = img.size[0]
    rgb = blur(px[..., :3], 2 if w <= 128 else 3)
    px[..., :3] = grade(rgb)
    D.set_pixels(img, px)


def bake_rig():
    """Mesh objects with the armature applied at rest and no parent: world-space geometry, the same as the game sees."""
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in obs:
        mw = o.matrix_world.copy()
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=m.name)
        o.parent = None
        o.matrix_world = mw
        for g in list(o.vertex_groups):
            o.vertex_groups.remove(g)
    for o in [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obs


def counter_shade(obs):
    """COLOR_0: the back BACK, the belly BELLY, over the fish's height (Blender z: the glTF's y, the dump's up)."""
    zs = [v.co.z for o in obs for v in o.data.vertices]
    lo, hi = min(zs), max(zs)
    for o in obs:
        me = o.data
        while me.color_attributes:
            me.color_attributes.remove(me.color_attributes[0])
        col = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
        for lp in me.loops:
            t = (me.vertices[lp.vertex_index].co.z - lo) / max(hi - lo, 1e-6)
            s = BELLY + (BACK - BELLY) * (t * t * (3 - 2 * t))
            col.data[lp.index].color = (s, s, s, 1.0)
        me.color_attributes.active_color = col
        me.color_attributes.render_color_index = me.color_attributes.active_color_index


def soften(obs):
    for o in obs:
        me = o.data
        if me.has_custom_normals:
            me.free_normals_split() if hasattr(me, "free_normals_split") else None
            bpy.context.view_layer.objects.active = o
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        for p in me.polygons:
            p.use_smooth = True


def restyle_materials(obs):
    done = set()
    for o in obs:
        for m in o.data.materials:
            if not m or not m.use_nodes:
                continue
            nt = m.node_tree
            b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            for n in [n for n in nt.nodes if n.type == "NORMAL_MAP"]:
                for l in list(n.outputs[0].links):
                    nt.links.remove(l)
                img = next((l.from_node for l in n.inputs["Color"].links), None)
                nt.nodes.remove(n)
                if img is not None:
                    nt.nodes.remove(img)
            for name in ("Metallic", "Roughness"):
                for l in list(b.inputs[name].links):
                    nt.links.remove(l)
            b.inputs["Roughness"].default_value = ROUGH
            b.inputs["Metallic"].default_value = 0.0
            base = next((l.from_node for l in b.inputs["Base Color"].links if l.from_node.type == "TEX_IMAGE"), None)
            if base is not None and base.image:
                tweak_texture(base.image, done)
            for n in [n for n in nt.nodes if n.type == "TEX_IMAGE" and not n.outputs[0].links and not n.outputs[1].links]:
                nt.nodes.remove(n)


def build(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, f"{name}.glb"))
    obs = bake_rig()
    before = sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons)
    soften(obs)
    restyle_materials(obs)
    counter_shade(obs)
    D.export(obs, f"{OUT}/{name}.glb", fmt="AUTO")
    print("FISH", name, "tris", before)


if __name__ == "__main__":
    names = sorted(f[:-4] for f in os.listdir(SRC) if f.endswith(".glb"))
    if "only" in ARGS:
        keep = ARGS[ARGS.index("only") + 1].split(",")
        names = [n for n in names if n in keep]
    for n in names:
        build(n)
