"""Render a fish GLB in three orthographic views (side, top, three-quarter) for review sheets (fish-models lane).

  Blender -b --factory-startup -P art/fish/render_views.py -- <glb> <out_prefix> [house|auto] [rotz=<deg>] [flipz]

house: the remodel frame (Blender head +Z, back +Y) turned to nose -X, back +Z.
auto (Meshy raw): Z up as imported; the long horizontal axis is turned onto X. rotz turns it further (180 puts the nose left).
Writes <out_prefix>-side.png, -top.png, -34.png (768 px, flat grey, Workbench studio light, texture colour) and prints
the triangle count and the bounding box.
"""
import math, sys
import bpy
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index("--") + 1:]
glb, out = a[0], a[1]
mode = a[2] if len(a) > 2 else "auto"
rotz = next((float(x[5:]) for x in a if x.startswith("rotz=")), 0.0)
flipz = "flipz" in a

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
for o in bpy.context.scene.objects:
    if o.type != "MESH":
        o.select_set(False)
# Bake parents into the meshes, then join so one bounding box covers the fish.
for o in meshes:
    m = o.matrix_world.copy(); o.parent = None; o.matrix_world = m
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

R = Matrix.Identity(3)
if mode == "house":
    R = Matrix(((0, 0, -1), (-1, 0, 0), (0, 1, 0)))  # columns: x->-y, y->+z, z->-x
else:
    xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]
    if max(ys) - min(ys) > max(xs) - min(xs):
        R = Matrix.Rotation(math.radians(90), 3, "Z")
R = Matrix.Rotation(math.radians(rotz), 3, "Z") @ R
if flipz:
    R = Matrix.Rotation(math.radians(180), 3, "X") @ R
ob.data.transform(R.to_4x4())
cs = [v.co for v in ob.data.vertices]
lo = Vector([min(c[i] for c in cs) for i in range(3)]); hi = Vector([max(c[i] for c in cs) for i in range(3)])
ob.data.transform(Matrix.Translation(-(lo + hi) / 2))
size = hi - lo
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
print(f"FISHVIEW tris={tris} size=({size.x:.3f},{size.y:.3f},{size.z:.3f})")

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sh = sc.display.shading
sh.light = "STUDIO"; sh.color_type = "TEXTURE"; sh.show_cavity = False; sh.show_shadows = False
sh.background_type = "VIEWPORT"; sh.background_color = (0.32, 0.33, 0.35)
sc.render.resolution_x = sc.render.resolution_y = 768
sc.render.film_transparent = False
sc.view_settings.view_transform = "Standard"
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"
L = max(size) * 1.12
views = {"side": (Vector((0, -1, 0)), 0), "top": (Vector((0, 0, 1)), 0), "34": (Vector((-0.62, -0.62, 0.48)), 0)}
for name, (d, _) in views.items():
    d = d.normalized()
    cam.location = d * 10
    up = Vector((0, 1, 0)) if name == "top" else Vector((0, 0, 1))
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler() if name != "top" else (0, 0, 0)
    cam.data.ortho_scale = L
    sc.render.filepath = f"{out}-{name}.png"
    bpy.ops.render.render(write_still=True)
