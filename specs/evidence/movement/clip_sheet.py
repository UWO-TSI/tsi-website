"""Movement clips on the v6 rig, five frames each, side on (specs/movement.md, build order 3).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P specs/evidence/movement/clip_sheet.py -- <out_dir>

Renders <out_dir>/<Clip>_<n>.png from art/characters/base/v6_clips.glb with the workbench engine (vertex colours);
tile them with ImageMagick (see the report).
"""
import bpy, math, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
CLIPS = ["Jump", "Fall", "Land", "Roll", "Mantle", "Dash", "Skid"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "art/characters/base/v6_clips.glb"))
sc = bpy.context.scene
rig = next(o for o in sc.objects if o.type == "ARMATURE")
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "VERTEX"
sc.render.resolution_x, sc.render.resolution_y = 300, 300
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("W")
sc.world.color = (0.55, 0.62, 0.45)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = 1.6
# Side on (the character faces -Y in Blender): looking from +X, a little above.
cam.location = (3.0, -0.35, 0.75)
cam.rotation_euler = (math.radians(84), 0, math.radians(90))
for name in CLIPS:
    act = bpy.data.actions.get(name) or next((a for a in bpy.data.actions if a.name.startswith(name)), None)
    rig.animation_data.action = act
    start, end = act.frame_range
    for i in range(5):
        sc.frame_set(round(start + (end - start) * i / 4))
        sc.render.filepath = os.path.join(OUT, f"{name}_{i}.png")
        bpy.ops.render.render(write_still=True)
    print("SHEET", name, act.name, act.frame_range[:])
