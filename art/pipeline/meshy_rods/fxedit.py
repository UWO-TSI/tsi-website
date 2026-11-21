"""Edit a rod effect GLB (rod-meshy): blender -b --factory-startup -P fxedit.py -- <old_fx.glb> <out.glb> '<json>'
json: drop [node names], move {name: [x,y,z] glTF}, turn {name: [axis, deg] about the node's own origin, glTF axis},
      scale {name: [sx,sy,sz] glTF}, add [{glb, name, props}]"""
import bpy, sys, json, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index("--")+1:]
src, out, o = a[0], a[1], json.loads(a[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
keep = {k: sc[k] for k in sc.keys() if not k.startswith("_") and k not in ("cycles",)}
print("SCENEPROPS", list(keep))
B = lambda p: Vector((p[0], -p[2], p[1]))
for n in o.get("drop", []):
    ob = sc.objects.get(n)
    if ob: bpy.data.objects.remove(ob)
for n, p in o.get("move", {}).items(): sc.objects[n].location = B(p)
for n, (axis, deg) in o.get("turn", {}).items():
    ob = sc.objects[n]; ax = {"x": "X", "y": "Z", "z": "Y"}[axis]; sgn = -1 if axis == "z" else 1
    ob.data.transform(Matrix.Rotation(math.radians(deg)*sgn, 4, ax)); ob.data.update()
for n, s in o.get("scale", {}).items(): sc.objects[n].data.transform(Matrix.Diagonal((s[0], s[2], s[1], 1))); sc.objects[n].data.update()
for ad in o.get("add", []):
    before = set(sc.objects)
    bpy.ops.import_scene.gltf(filepath=ad["glb"])
    for ob in set(sc.objects) - before:
        if ob.type == "MESH":
            ob.name = ad["name"]
            for k, v in ad.get("props", {}).items(): ob[k] = v
for k in list(sc.keys()):
    if k not in keep and not k.startswith("_") and k != "cycles": del sc[k]
for ob in sc.objects:
    if ob.type == "MESH": print("NODE", ob.name, tuple(round(x, 4) for x in ob.location), sum(len(p.vertices)-2 for p in ob.data.polygons))
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_extras=True, export_image_format="JPEG", export_jpeg_quality=88)
print("WROTE", out)
