"""Quick EEVEE review renders of greenery GLBs, read back from the files (what the game loads), shadow casters hidden.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/preview.py -- <out-dir> <size> <glb> [<glb> ...]

Writes <out-dir>/<name>.<view>.png for the views front (azimuth 0, elevation 14) and three-quarter (35, 26), as the
turntable frames them.
"""
import os, sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as P  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
out, size, files = args[0], int(args[1]), args[2:]
os.makedirs(out, exist_ok=True)
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(f))
    obs = []
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            continue
        if any(m and m.name.startswith("mShadow") for m in o.data.materials):
            bpy.data.objects.remove(o)
            continue
        if o.data.color_attributes:
            o.data.color_attributes[0].name = "Color"
        obs.append(o)
    name = os.path.basename(f).replace(".glb", "")
    P.review(obs, os.path.join(out, name + ".png"), views=((0, 14), (35, 26)), size=size)
