"""Dump the v7 head's face-region UV polygons (canvas U right, W down) for the review sheet's UV-layout panel.

  /Applications/Blender.app/Contents/MacOS/Blender -b art/characters/v7/head.blend -P specs/evidence/avatar-v7/uv_dump.py -- <out.json>
"""
import bpy, json, sys
out = sys.argv[sys.argv.index("--") + 1]
me = bpy.data.objects["V7_Head"].data
uv = me.uv_layers["UVMap"].data
polys = [[(round(uv[l].uv[0], 5), round(1 - uv[l].uv[1], 5)) for l in p.loop_indices] for p in me.polygons if p.material_index == 1]
json.dump(polys, open(out, "w"))
print("UV_POLYS", len(polys))
