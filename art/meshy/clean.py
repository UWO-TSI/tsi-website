"""The Blender step after a Meshy generation (art/meshy/meshy.mjs): the raw mesh to the game's scale, pivot and
facing, one merged mesh, textures sized down, then the high-def GLB and the low-poly reduced from it. Edits beyond
this (David's notes, shape fixes, game materials, lights, auras) are the lane's own Blender script on the output.

  Blender -b --factory-startup -P art/meshy/clean.py -- --in art/meshy/raw/<name>.glb --hd <hd.glb> [--lp <lp.glb>]
      [--height 1.0] [--yaw 0] [--lp-tris 1500] [--tex 1024]

--height is the game height in metres (Blender Z), --yaw turns it about Z in degrees. Run web/scripts/pack-glbs.mjs
on the outputs once they land in web/public.
"""
import argparse
import math
import sys

import bpy
from mathutils import Matrix, Vector

p = argparse.ArgumentParser()
p.add_argument("--in", dest="src", required=True)
p.add_argument("--hd", required=True)
p.add_argument("--lp")
p.add_argument("--height", type=float, default=1.0)
p.add_argument("--yaw", type=float, default=0.0)
p.add_argument("--lp-tris", type=int, default=1500)
p.add_argument("--tex", type=int, default=1024)
a = p.parse_args(sys.argv[sys.argv.index("--") + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in meshes:
    o.data = o.data.copy()  # instances share data: make each mesh its own before baking transforms in
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = Matrix.Identity(4)
for o in list(bpy.context.scene.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o)
bpy.context.view_layer.objects.active = meshes[0]
for o in meshes:
    o.select_set(True)
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = obj.data.name = a.hd.rsplit("/", 1)[-1].removesuffix(".glb")

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode="OBJECT")

# Facing, then height, then the pivot at the bottom centre.
obj.data.transform(Matrix.Rotation(math.radians(a.yaw), 4, "Z"))
zs = [v.co.z for v in obj.data.vertices]
obj.data.transform(Matrix.Scale(a.height / (max(zs) - min(zs)), 4))
co = [v.co for v in obj.data.vertices]
lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
obj.data.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))

for img in bpy.data.images:
    w, h = img.size
    if max(w, h) > a.tex:
        img.scale(max(1, w * a.tex // max(w, h)), max(1, h * a.tex // max(w, h)))


def tris():
    return sum(len(f.vertices) - 2 for f in obj.data.polygons)


def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True)
    print(f"{path}: {tris()} triangles")


obj.select_set(True)
export(a.hd)
if a.lp and tris() > a.lp_tris:
    m = obj.modifiers.new("lp", "DECIMATE")
    m.ratio = a.lp_tris / tris()
    bpy.ops.object.modifier_apply(modifier=m.name)
if a.lp:
    export(a.lp)
