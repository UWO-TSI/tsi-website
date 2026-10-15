"""The v8 head (head fit, specs/characters/head-fit.md; ledger row 304, David 2026-10-08: "rounder, flatter face").

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/skull/build_head.py [-- render <dir>]

Builds V8_Head on head_shape's v8 skull (a rounded box with a flat face area) with the v7 head's topology steps
(v7/head_model.py: feature rows and columns through the solved eye and mouth centres, concentric loops round each
eye and the mouth, face-chart UVs, 100% on mixamorig:Head, then the straddle pass), and saves skull/head.blend:
CharacterRig, V8_Head, and the v7 head for comparison (collection v7_reference, hidden). Then:

  Blender -b -P art/characters/base/build_clips.py -- head v8        # base/v8_clips.glb, the engine's base
"""
import bpy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
for p in (os.path.join(ART, "v7"), ART, os.path.join(ART, "base")):
    sys.path.insert(0, p)
import head_model as hm  # noqa: E402
from head_shape import SKULL, EYE_LAT, EYE_LON, MOUTH_LAT  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RIM_ROWS = ()

bpy.ops.wm.open_mainfile(filepath=os.path.join(ART, "v7", "head.blend"))
rig = bpy.data.objects["CharacterRig"]
v7 = bpy.data.objects["V7_Head"]
ref = bpy.data.collections.get("v7_reference") or bpy.data.collections.new("v7_reference")
if ref.name not in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.link(ref)
for c in list(v7.users_collection):
    c.objects.unlink(v7)
ref.objects.link(v7)
face = bpy.data.materials["M_Face_v7"]
for n in face.node_tree.nodes:                       # the default face preview, from this checkout
    if n.type == "TEX_IMAGE" and n.image:
        n.image.filepath = os.path.join(ART, "v7", "face", "v7_face_default.png")
face.name = "M_Face_v8"
old = bpy.data.objects.get("V8_Head")
if old:
    bpy.data.objects.remove(old, do_unlink=True)
if "M_Face" not in bpy.data.materials:
    bpy.data.materials.new("M_Face")

# v9 (head-roblox): the v7 rows already cross the classic head's rim (ray lat 28-64) every 14 deg (2 mm chords); room
# for more (RIM_ROWS) would cost 40 triangles a row, and the heaviest look sits 11 under its 4,000 (look.test.ts)
hm.ROWS = sorted(set(hm.ROWS) | set(RIM_ROWS))
hm.BLOCKS = {k: (hm.ROWS.index(EYE_LAT if k != "mouth" else MOUTH_LAT), c, n) for k, (_, c, n) in hm.BLOCKS.items()}
h = hm.Head()
hm.step_grid(h)
hm.step_loops(h)
me = bpy.data.meshes.new("V8_Head")
me.materials.append(bpy.data.materials["M_Skin"])
me.materials.append(face)
ob = hm.step_finish(h, "V8_Head", rig)
hm.step_straddle(ob)
dev = hm.deviation(ob)
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
print("HEAD_V8", "tris", tris, "verts", len(ob.data.vertices), "deviation", dev, "eye", round(EYE_LAT, 2), round(EYE_LON, 2),
      "mouth", round(MOUTH_LAT, 2), "skull", SKULL)
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.name in ("v6_reference", "v7_reference"):
        lc.exclude = False
        lc.hide_viewport = True
rig.hide_set(True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "head.blend"), compress=True)
print("HEAD_V8_OK")

if "render" in ARGS:
    import math
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.render.resolution_x, sc.render.resolution_y = 900, 900
    for o in sc.objects:
        o.hide_render = o.name not in ("V8_Head", "V7_Head")
    v7.hide_render = False
    v7.location.x = 0.6
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 1.2
    sc.camera = cam
    for name, yaw in (("front", 0), ("34", 35), ("side", 90)):
        a = math.radians(yaw)
        for o, x in ((ob, 0.0), (v7, 0.6)):
            o.location.x = x
            o.rotation_euler = (0, 0, a)
        cam.location = (0.3, -3.0, 0.78)
        cam.rotation_euler = (math.radians(90), 0, 0)
        sc.render.filepath = os.path.join(out, f"head-v8-vs-v7-{name}.png")
        bpy.ops.render.render(write_still=True)
