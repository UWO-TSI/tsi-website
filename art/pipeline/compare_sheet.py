"""Render a rod GLB (plus its fx GLB) the way the concept sheet's hero is drawn, next to the sheet hero, for part-by-part review.

  Blender -b --factory-startup -P art/pipeline/compare_sheet.py -- <rod.glb> <fx.glb|-> <sheet_hero.png> <out.png>

The rod lies on a diagonal from lower left (grip) to upper right (tip) at 30 degrees, the camera 25 degrees above,
on white, framed to fill 80% of the width, rendered 1280x1280 in EEVEE with soft light, then pasted beside the sheet hero.
"""
import bpy, math, sys, os, subprocess
from mathutils import Vector, Euler
a = sys.argv[sys.argv.index("--") + 1:]
rod, fx, sheet, out = a[0], a[1], a[2], a[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rod)
if fx != "-" and os.path.exists(fx): bpy.ops.import_scene.gltf(filepath=fx)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
root = bpy.data.objects.new("Root", None); bpy.context.scene.collection.objects.link(root)
for o in bpy.context.scene.objects:
    if o.parent is None and o is not root: o.parent = root
# glTF Y-up import: the rod's long axis is now +Z (Blender). Lay it on a 30-degree diagonal in the camera's image plane.
from mathutils import Matrix
# side-on, as the sheet draws it: the reel (-Y) turned to +X, then the rod laid tip-up-right at 30 degrees, so the reel
# hangs below the rod and the hook curls in the picture plane
root.matrix_world = Matrix.Rotation(math.radians(60), 4, "Y") @ Matrix.Rotation(math.radians(90), 4, "Z")
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (mn + mx) / 2; size = max((mx - mn).x, (mx - mn).z)
cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = size / 0.8
cam = bpy.data.objects.new("Cam", cam_d); bpy.context.scene.collection.objects.link(cam)
el = math.radians(25); dist = 10
cam.location = ctr + Vector((0, -math.cos(el) * dist, math.sin(el) * dist))
cam.rotation_euler = (Vector(ctr) - cam.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam
for rot, e in (((math.radians(50), 0, math.radians(-30)), 3.0), ((math.radians(60), 0, math.radians(150)), 1.2)):
    l = bpy.data.lights.new("Sun", "SUN"); l.energy = e; lo = bpy.data.objects.new("Sun", l); lo.rotation_euler = rot; bpy.context.scene.collection.objects.link(lo)
w = bpy.data.worlds.new("W"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
bpy.context.scene.world = w
s = bpy.context.scene
try: s.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError: s.render.engine = "BLENDER_EEVEE"
s.render.resolution_x = s.render.resolution_y = 1280; s.render.film_transparent = False
s.view_settings.view_transform = "Standard"
tmp = out + ".model.png"; s.render.filepath = tmp; bpy.ops.render.render(write_still=True)
subprocess.run(["magick", sheet, "-resize", "1280x1280", "-background", "white", "-gravity", "center", "-extent", "1280x1280", tmp, "+append", out], check=True)
os.remove(tmp)
print("COMPARE_OK", out)
