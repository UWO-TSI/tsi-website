"""Tint check (game/trees-art): fir, broadleaf and birch crowns under InstancedNature crownTint's range (v 0.86 to 1.10, warm
+-0.06), on mForestCrown only, as the game multiplies it.

  Blender -b --factory-startup -P art/trees/tint_check.py -- <out.png>
"""
import os, sys, bpy
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "props"))
import propkit as P
out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
obs = []
for row, name in enumerate(["forest-tree-fir", "forest-tree-broadleaf", "forest-tree-birch"]):
    for i, (v, warm) in enumerate([(0.86, -0.06), (0.86, 0.06), (0.98, 0), (1.1, -0.06), (1.1, 0.06)]):
        bpy.ops.import_scene.gltf(filepath=f"{ROOT}/web/public/assets/game/plants/{name}.glb")
        for o in bpy.context.selected_objects:
            if o.type != "MESH":
                continue
            o.location = (i * 5.0, row * 7.0, 0)
            o.data.color_attributes[0].name = "Color"
            m = o.data.materials[0]
            if m.name.startswith("mForestCrown"):
                m = m.copy()
                o.data.materials[0] = m
                o["tint"] = (v * (1 + warm), v, v * (1 - warm))
            obs.append(o)
P.show_vertex_colors(obs)
for o in obs:
    if "tint" in o:
        nt = o.data.materials[0].node_tree
        bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        src = bs.inputs["Base Color"].links[0].from_socket
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        nt.links.new(src, mul.inputs[6])
        mul.inputs[7].default_value = (*o["tint"], 1)
        nt.links.new(mul.outputs[2], bs.inputs["Base Color"])
P.show_vertex_colors = lambda obs: None
P.review(obs, out, views=((180, 12),), size=1000)
