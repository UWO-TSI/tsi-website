"""Render review frames from the exported GLB (so the check covers the export, not the .blend).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/render_turntable.py -- <frames_dir> [mp4] [glb=ref_girl.glb] [ref]

"ref" uses the reference #18 camera (front three-quarter, slightly below eye level) for the hero shot,
the idle row starts at that angle and the walk row uses it; it also writes <frames_dir>/hero.png.

Writes <frames_dir>/sheet_XX.png (row 1: Idle frame 0 at 8 yaw angles; row 2: 8 Walk frames, 3/4 side)
and, with "mp4", <frames_dir>/tt_XXX.png (96 frames: walking in place while turning 360 degrees).
Tile / encode with ffmpeg afterwards (see README).
"""
import bpy, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(HERE, "_frames")
MP4 = "mp4" in args
REF = "ref" in args
GLB = next((a.split("=", 1)[1] for a in args if a.startswith("glb=")), "base_body.glb")
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, GLB))
sc = bpy.context.scene
sc.render.fps = 30

rig = next(o for o in sc.objects if o.type == "ARMATURE")

# show COLOR_0 like three.js does: multiply it into each material's base colour
for o in sc.objects:
    if o.type != "MESH" or not o.data.color_attributes:
        continue
    for mat in o.data.materials:
        nt = mat.node_tree
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        if any(n.type == "VERTEX_COLOR" for n in nt.nodes):
            continue
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = o.data.color_attributes[0].name
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        base_in = b.inputs["Base Color"]
        if base_in.links:
            nt.links.new(base_in.links[0].from_socket, mul.inputs[6])
        else:
            mul.inputs[6].default_value = base_in.default_value
        nt.links.new(vc.outputs["Color"], mul.inputs[7])
        nt.links.new(mul.outputs[2], base_in)
turn = bpy.data.objects.new("Turn", None)
sc.collection.objects.link(turn)
for o in list(sc.objects):
    if o.parent is None and o is not turn:
        o.parent = turn


def use_action(name):
    ad = rig.animation_data or rig.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    act = next(a for a in bpy.data.actions if a.name.startswith(name))
    ad.action = act
    if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
        ad.action_slot = act.slots[0]


# look
try:
    sc.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
try:
    sc.view_settings.view_transform = "Standard"
except TypeError:
    pass
w = bpy.data.worlds.new("W")
sc.world = w
if w.node_tree is None:
    w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.80, 0.76, 0.66, 1)
bg.inputs[1].default_value = 0.9

bpy.ops.object.light_add(type="SUN", location=(0, 0, 5))
sun = bpy.context.object
sun.data.energy = 3.2
sun.data.angle = math.radians(8)
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))

bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.5 if REF else 0.55, fill_type="NGON", location=(0, 0, 0))
ground = bpy.context.object
gm = bpy.data.materials.new("Ground")
gb = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
gb.inputs["Base Color"].default_value = (0.55, 0.62, 0.45, 1)
ground.data.materials.append(gm)

cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 1.42
cam = bpy.data.objects.new("Cam", cam_data)
sc.collection.objects.link(cam)
if REF:
    cam_data.ortho_scale = 1.28
    cam.location = (0, -4.0, 0.52)
    cam.rotation_euler = (math.radians(88.5), 0, 0)   # just below the eye line, looking a touch up
else:
    cam.location = (0, -4.0, 0.56 + 4.0 * math.tan(math.radians(10)))
    cam.rotation_euler = (math.radians(80), 0, 0)
sc.camera = cam

sc.render.resolution_x, sc.render.resolution_y = 360, 440
sc.render.film_transparent = False


def shot(path, frame, yaw):
    sc.frame_set(frame)
    turn.rotation_euler = (0, 0, math.radians(yaw))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


Y0 = -35 if REF else 0          # -35: character turned to its right, face toward camera-left (3/4 front)
WALK_YAW = -35 if REF else 60
use_action("Idle")
for i in range(8):
    shot(os.path.join(OUT, f"sheet_{i:02d}.png"), 0, Y0 + i * 45)
use_action("Walk")
for i in range(8):
    shot(os.path.join(OUT, f"sheet_{8 + i:02d}.png"), round(i * 30 / 8), WALK_YAW)
if REF:
    sc.render.resolution_x, sc.render.resolution_y = 720, 880
    shot(os.path.join(OUT, "hero.png"), 8, WALK_YAW)
    use_action("Idle")
    shot(os.path.join(OUT, "hero_front.png"), 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = 360, 440

if MP4:
    sc.render.resolution_x, sc.render.resolution_y = 480, 560
    for f in range(96):
        shot(os.path.join(OUT, f"tt_{f:03d}.png"), f % 30, f * 360 / 96)
print("RENDER_OK", OUT)
