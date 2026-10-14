"""A contact sheet of the rock props, as exported (reads the GLBs back, so it shows what the game loads).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/rocks/preview.py -- <out.png>
"""
import bpy, math, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIR = os.path.join(ROOT, "web", "public", "assets", "game", "rocks")
out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/rocks.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
names = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith(".glb"))
x = 0.0
for n in names:
    bpy.ops.import_scene.gltf(filepath=os.path.join(DIR, f"{n}.glb"))
    for ob in bpy.context.selected_objects:
        ob.location.x += x
    x += 2.4
# A grass-green ground and a warm sun from the camera's left, a cool sky fill.
bpy.ops.mesh.primitive_plane_add(size=60, location=(x / 2 - 1.2, 0, 0))
g = bpy.data.materials.new("ground")
g.use_nodes = True
next(n for n in g.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.25, 0.42, 0.16, 1)
bpy.context.object.data.materials.append(g)
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), math.radians(-25), math.radians(-35)))
bpy.context.object.data.energy = 4.0
bpy.context.object.data.color = (1.0, 0.9, 0.78)
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.45, 0.6, 0.85, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
bpy.ops.object.camera_add(location=(x / 2 - 1.2, -9.5, 5.2))
cam = bpy.context.object
cam.rotation_euler = (math.radians(64), 0, 0)
cam.data.lens = 24
scene.camera = cam
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 1600, 600
scene.view_settings.view_transform = "Standard"
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("PREVIEW", out, names)
