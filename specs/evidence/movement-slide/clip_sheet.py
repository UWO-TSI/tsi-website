"""Slide and crouch clips on the v6 rig (v7 head), side on and from three-quarters, frame by frame (specs/movement-slide.md).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P specs/evidence/movement-slide/clip_sheet.py -- <out_dir> [Clip,Clip...] [frames]

Renders <out_dir>/<Clip>_<view>_<n>.png from art/characters/base/v7_clips.glb with the workbench engine (matte, the
materials' colours), `frames` evenly through each clip (every frame of a short one-shot); tile them with ImageMagick
(specs/evidence/movement-slide/shots.mjs clips).
"""
import bpy, json, math, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[0]
CLIPS = ARGS[1].split(",") if len(ARGS) > 1 else ["CrouchIdle", "CrouchWalk", "SlideIn", "SlideInDash", "Slide", "SlideUp", "SlideJump", "SlideStand", "SlideBonk"]
N = int(ARGS[2]) if len(ARGS) > 2 else 6
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "art/characters/base/v7_clips.glb"))
sc = bpy.context.scene
rig = next(o for o in sc.objects if o.type == "ARMATURE")
# Matte flat colours per material (the engine tints the shared white materials per look; these stand in for one).
TINT = {"M_Skin": (0.93, 0.74, 0.6), "M_Face": (0.93, 0.74, 0.6), "M_Top": (0.36, 0.55, 0.78), "M_Bottom": (0.32, 0.3, 0.38), "M_Hair": (0.42, 0.28, 0.2), "M_Shoes": (0.9, 0.9, 0.88)}
for m in bpy.data.materials:
    m.diffuse_color = (*TINT.get(m.name.split(".")[0], (0.85, 0.85, 0.85)), 1)
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_shadows = True
sc.render.resolution_x, sc.render.resolution_y = 300, 260
sc.world = bpy.data.worlds.new("W")
sc.world.color = (0.55, 0.62, 0.45)
# A ground line: a thin dark plane at z = 0, so contact with the ground reads.
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
ground = bpy.context.active_object
gm = bpy.data.materials.new("G"); gm.diffuse_color = (0.42, 0.5, 0.33, 1); ground.data.materials.append(gm)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = 1.5
# The character faces -Y (Blender). Side: from +X, a little above. Three-quarters: front right, a little above.
VIEWS = {"side": ((3.0, -0.25, 0.82), (math.radians(84), 0, math.radians(90))),
         "34": ((-2.3, -2.3, 1.2), (math.radians(74), 0, math.radians(-45))),   # front right: the slide's trailing hand
         "game": ((0.0, 2.4, 2.1), (math.radians(52), 0, math.radians(180)))}   # behind and above, like the follow camera
VIEW_ONLY = os.environ.get("VIEWS", "side,34").split(",")
VIEWS = {k: v for k, v in VIEWS.items() if k in VIEW_ONLY}
times = {}
for name in CLIPS:
    act = bpy.data.actions.get(name) or next((a for a in bpy.data.actions if a.name.startswith(name)), None)
    rig.animation_data.action = act
    start, end = act.frame_range
    count = min(N, int(end - start) + 1)
    frames = [start + (end - start) * i / max(1, count - 1) for i in range(count)]
    times[name] = [round(f / sc.render.fps, 3) for f in frames]
    for view, (loc, rot) in VIEWS.items():
        cam.location, cam.rotation_euler = loc, rot
        for i, f in enumerate(frames):
            sc.frame_set(int(f), subframe=f - int(f))
            sc.render.filepath = os.path.join(OUT, f"{name}_{view}_{i}.png")
            bpy.ops.render.render(write_still=True)
    print("SHEET", name, act.frame_range[:], count)
json.dump(times, open(os.path.join(OUT, "times.json"), "w"))
