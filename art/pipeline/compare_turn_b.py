"""Render a rod GLB (plus its fx GLB) as its concept turnaround sheet draws it, beside the sheet, for part-by-part review
(rod-rebuild-b; compare_sheet.py does the hero).

  Blender -b --factory-startup -P art/pipeline/compare_turn_b.py -- <rod.glb> <fx.glb|-> <turnaround.png> <out.png> <f0> <length>

The sheet's first three rows: the side (camera on the crank side, -X, grip left, the reel hanging below), the top (from
+Y, the crank side down) and a three-quarter. `f0` is the rig Z of the sheet's butt (station 0) and `length` the rig
length of the sheet's station 0 to 1, so the model lands on the sheet's own pixels: butt at x 48, 1190 px long.
"""
import bpy, math, os, subprocess, sys
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index("--") + 1:]
rod, fx, sheet, out, f0, length = a[0], a[1], a[2], a[3], float(a[4]), float(a[5])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rod)
if fx != "-" and os.path.exists(fx):
    bpy.ops.import_scene.gltf(filepath=fx)
sc = bpy.context.scene
for o in sc.objects:                              # the effect's glow and light parts drawn lit up, as in the game
    if o.type != "MESH":
        continue
    for m in o.data.materials:
        if m and any(k in m.name for k in ("Glow", "Light")):
            bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bs.inputs["Emission Color"].default_value = bs.inputs["Base Color"].default_value
            bs.inputs["Emission Strength"].default_value = 2.0
# glTF import is Y up -> Blender Z up again; the rod's axis is Blender Z, its reel toward -Y, as built.
W, ROWH = 1280, 240
PX = 1190.0 / length                              # pixels per rig metre
cam_d = bpy.data.cameras.new("Cam")
cam_d.type = "ORTHO"
cam_d.ortho_scale = W / PX
cam = bpy.data.objects.new("Cam", cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
for rot, e in (((math.radians(50), 0, math.radians(-30)), 3.0), ((math.radians(60), 0, math.radians(150)), 1.2)):
    lt = bpy.data.lights.new("Sun", "SUN")
    lt.energy = e
    lo = bpy.data.objects.new("Sun", lt)
    lo.rotation_euler = rot
    sc.collection.objects.link(lo)
w = bpy.data.worlds.new("W")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
sc.world = w
try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    sc.render.engine = "BLENDER_EEVEE"
sc.view_settings.view_transform = "Standard"
sc.render.resolution_x, sc.render.resolution_y = W, ROWH
sc.render.film_transparent = True
zc = f0 + (W / 2 - 48) / PX                       # the camera's centre along the rod: the butt lands at x 48
# camera axes (right, up): side from -X: right +Z, up +Y; top from +Y: right +Z, up +X; three-quarter: the side turned
# 22 degrees about the up axis (butt toward you) and tipped 12 degrees down
views = [("side", Vector((0, 0, 1)), Vector((0, 1, 0))), ("top", Vector((0, 0, 1)), Vector((1, 0, 0)))]
r3 = Matrix.Rotation(math.radians(7), 3, "X") @ Matrix.Rotation(math.radians(-12), 3, "Z") @ Matrix.Rotation(math.radians(22), 3, "Y")
views.append(("tq", r3 @ Vector((0, 0, 1)), r3 @ Vector((0, 1, 0))))
rows = []
for name, right, up in views:
    sc.render.resolution_y = 360 if name == "tq" else ROWH
    fwd = up.cross(right)                         # the camera looks along -(right x up)
    cam.matrix_world = Matrix((right, up, -fwd)).transposed().to_4x4()
    cam.location = Vector((0, 0, zc)) + right.cross(up) * 5
    f = f"{out}.{name}.png"
    sc.render.filepath = f
    bpy.ops.render.render(write_still=True)
    rows.append(f)
model = out + ".model.png"
subprocess.run(["magick", "-size", "1280x720", "xc:white", rows[0], "-geometry", "+0-30", "-composite", rows[1], "-geometry", "+0+142",
                "-composite", rows[2], "-geometry", "+0+225", "-composite", model], check=True)
subprocess.run(["magick", sheet, "-resize", "1280x720", model, "+append", out], check=True)
for f in rows + [model]:
    os.remove(f)
print("COMPARE_OK", out)
