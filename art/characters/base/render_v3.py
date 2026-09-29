"""Review renders for v3/v4, from the exported GLB.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/render_v3.py -- <frames_dir> <variant_face_dir> [mp4]

Writes into <frames_dir>: face34_hood.png, face34_hair.png, front.png, var_XX.png (12, for the 4x3 grid),
sheet_XX.png (16, contact sheet) and tt_XXX.png (96, with mp4). Tile/encode with ffmpeg (see README).
"""
import bpy, math, os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[sys.argv.index("--") + 1:]
OUT, VAR = args[0], args[1]
MP4 = "mp4" in args
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "v4.glb"))
sc = bpy.context.scene
sc.render.fps = 30
rig = next(o for o in sc.objects if o.type == "ARMATURE")
turn = bpy.data.objects.new("Turn", None)
sc.collection.objects.link(turn)
for o in list(sc.objects):
    if o.parent is None and o is not turn:
        o.parent = turn

# COLOR_0 multiplies the base colour in three.js; mirror that here
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

face_mat = bpy.data.materials.get("M_Face")
face_tex = next(n for n in face_mat.node_tree.nodes if n.type == "TEX_IMAGE")
default_face = face_tex.image


def show(hood=True, back_hair=True):
    for o in sc.objects:
        if o.name.startswith("V4_Hood"):
            o.hide_render = not hood
        if o.name.startswith("V4_HairBack"):
            o.hide_render = not back_hair


def use_action(name):
    ad = rig.animation_data or rig.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    act = next(a for a in bpy.data.actions if a.name.startswith(name))
    ad.action = act
    if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
        ad.action_slot = act.slots[0]


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
bg.inputs[0].default_value = (0.78, 0.86, 0.86, 1)
bg.inputs[1].default_value = 0.95
bpy.ops.object.light_add(type="SUN", location=(0, 0, 5))
sun = bpy.context.object
sun.data.energy = 3.0
sun.data.angle = math.radians(10)
sun.rotation_euler = (math.radians(48), 0, math.radians(-40))     # warm key from upper left
sun.data.color = (1.0, 0.95, 0.88)
bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.5, fill_type="NGON")
ground = bpy.context.object
gm = bpy.data.materials.new("Ground")
next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.62, 0.72, 0.62, 1)
ground.data.materials.append(gm)

cd = bpy.data.cameras.new("Cam")
cd.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cd)
sc.collection.objects.link(cam)
sc.camera = cam


def body_cam():
    cd.ortho_scale = 1.28
    cam.location = (0, -4.0, 0.52)
    cam.rotation_euler = (math.radians(88.5), 0, 0)


def head_cam(scale=0.62):
    cd.ortho_scale = scale
    cam.location = (0, -4.0, 0.74)
    cam.rotation_euler = (math.radians(90), 0, 0)


def shot(path, frame, yaw, res=(360, 440)):
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.frame_set(frame)
    turn.rotation_euler = (0, 0, math.radians(yaw))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


REF_YAW = 32          # #18: face turned toward the viewer's right, 3/4 front

use_action("Idle")
body_cam()
show(hood=True, back_hair=False)
shot(os.path.join(OUT, "face34_hood.png"), 0, REF_YAW, (720, 880))
show(hood=False, back_hair=True)
shot(os.path.join(OUT, "face34_hair.png"), 0, REF_YAW, (720, 880))
shot(os.path.join(OUT, "front.png"), 0, 0, (720, 880))

head_cam()
for i, f in enumerate(sorted(glob.glob(os.path.join(VAR, "face_*.png")))):
    face_tex.image = bpy.data.images.load(f)
    shot(os.path.join(OUT, f"var_{i:02d}.png"), 0, 18, (320, 320))
    print("VAR", i, os.path.basename(f))
face_tex.image = default_face

body_cam()
show(hood=True, back_hair=False)
use_action("Idle")
for i in range(8):
    shot(os.path.join(OUT, f"sheet_{i:02d}.png"), 0, REF_YAW + i * 45)
use_action("Walk")
for i in range(8):
    shot(os.path.join(OUT, f"sheet_{8 + i:02d}.png"), round(i * 30 / 8), REF_YAW)
if MP4:
    for f in range(96):
        shot(os.path.join(OUT, f"tt_{f:03d}.png"), f % 30, REF_YAW + f * 360 / 96, (480, 560))
print("RENDER_OK", OUT)
