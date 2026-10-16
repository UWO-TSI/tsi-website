"""A quick review render of exported GLBs (reads them back, so it shows what the game loads).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/nature/preview.py -- <out.png> <cols> <glb> [<glb> ...]
"""
import os, sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nature_kit as K  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
out, cols, files = args[0], int(args[1]), args[2:]
K.reset()
obs = []
for f in files:
    bpy.ops.import_scene.gltf(filepath=os.path.join(K.ROOT, f) if not os.path.isabs(f) else f)
    ob = bpy.context.selected_objects[0]
    obs.append(ob)
span = max(max(o.dimensions.x, o.dimensions.y) for o in obs)
K.preview(obs, out, cols=cols, spacing=span * 1.5, lens=60)
