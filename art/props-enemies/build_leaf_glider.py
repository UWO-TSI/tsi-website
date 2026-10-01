"""The leaf glider (specs/glider.md): a big low-poly leaf on a curved stem, held overhead in the right hand.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_leaf_glider.py [-- render <dir>]

Writes web/public/assets/game/props/leaf-glider.glb. Rig units (the character is 1.045 tall; the engine scales by 1.3),
Blender Z up, the character's front is -Y. The origin is the grip: the right hand's socket (its wrist) in the Glide clip
(art/characters/base/build_clips.py GLIDE_GRIP), which sits up beside the jaw. The stem rises past the head on the
outside and curls in under the blade, which is centred over the head, tip forward. With `render`, also renders the
character in the Glide clip holding it (the engine's attachment: the socket's position, the character's axes).
Stand-alone on art/characters/kit.py (pe.py needs a palette file that is not in the repo).
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
import kit  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "assets", "game", "props", "leaf-glider.glb")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
C = Vector((0.23, 0.0, 0.72))                  # blade centre from the grip: over the head (grip x -0.23 in the rig)
LENGTH, HALF_W, CUP = 1.0, 0.4, 0.13           # tip to base, half width, how far the sides droop below the midrib

bpy.ops.wm.read_factory_settings(use_empty=True)
mats = {"M_Leaf": kit.material("M_Leaf", "#86C46A"), "M_Vein": kit.material("M_Vein", "#C8E59A"), "M_Stem": kit.material("M_Stem", "#6F9A45")}


def blade_point(u, s):
    """u 0 (base) .. 1 (tip) along the midrib, s -1 .. 1 across: a rounded base, the widest just behind the middle, a
    pointed tip; the midrib arches a little and the tip dips, the sides droop (a cupped wing)."""
    w = HALF_W * math.sin(math.pi * (0.08 + 0.92 * u)) ** 0.7
    y = C.y + LENGTH * (0.44 - u)
    z = C.z + 0.035 * math.sin(math.pi * u) - 0.05 * max(0.0, u - 0.7) / 0.3 - CUP * s * s * (w / HALF_W)
    return Vector((C.x + s * w, y, z))


pc = kit.Piece(region="torso", mat="M_Leaf")
below = C - Vector((0, 0, 1))
U = [0.0, 0.12, 0.28, 0.46, 0.64, 0.8, 0.92]
S = [-1.0, -0.5, 0.0, 0.5, 1.0]
rows = [[pc.v(blade_point(u, s)) for s in S] for u in U]
for a, b in zip(rows[:-1], rows[1:]):
    for k in range(len(S) - 1):
        pc.f([a[k], a[k + 1], b[k + 1], b[k]], below)
tip = pc.v(blade_point(1.0, 0.0))
for k in range(len(S) - 1):
    pc.f([rows[-1][k], rows[-1][k + 1], tip], below)
base = pc.v(blade_point(-0.04, 0.0))            # the notch where the stem meets the blade
for k in range(len(S) - 1):
    pc.f([rows[0][k + 1], rows[0][k], base], below)

# Veins on top: the midrib and three pairs of side veins, a shade lighter.
pc.mat = "M_Vein"
up = Vector((0, 0, 0.008))
pc.tube([blade_point(u, 0) + up for u in (0.0, 0.2, 0.45, 0.7, 0.9)], [0.011, 0.01, 0.008, 0.006, 0.004], sides=4, tip=True)
for u0 in (0.25, 0.45, 0.65):
    for s in (-1, 1):
        pc.tube([blade_point(u0, 0) + up, blade_point(u0 + 0.08, 0.4 * s) + up, blade_point(u0 + 0.13, 0.72 * s) + up], [0.006, 0.005, 0.003], sides=3, tip=True)

# The stem: through the fist, out round the head, curling in under the blade.
pc.mat = "M_Stem"
pc.tube([(0.0, 0.0, -0.05), (0.0, 0.0, 0.08), (-0.035, 0.0, 0.3), (0.0, 0.0, 0.5), (0.1, 0.02, 0.62), (0.2, 0.04, C.z - 0.03)],
        [0.014, 0.015, 0.014, 0.013, 0.012, 0.01], sides=5, tip=False)

leaf = pc.finish("leaf-glider", None, mats, sharp=50, grad=(0.82, 1.0))
print(f"MODEL leaf-glider tris={kit.ntris(leaf)}")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
leaf.select_set(True)
bpy.context.view_layer.objects.active = leaf
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)


# ================================================================ review sheet: the leaf alone, then held in the Glide clip
if "render" in ARGS:
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    kit.render_setup(sc)
    sc.render.film_transparent = False
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = sc.render.resolution_y = 420

    def shot(name, target, yaw, elev, scale):
        e, a = math.radians(elev), math.radians(yaw)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = Vector(target) + d * 10
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        cam.data.ortho_scale = scale
        cam.data.clip_end = 40
        kit.show_vertex_colors(sc)
        sc.render.filepath = os.path.join(out, name)
        bpy.ops.render.render(write_still=True)

    shot("leaf_top.png", C, 25, 62, 1.1)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "art", "characters", "base", "v7_clips.glb"))
    for o in set(bpy.data.objects) - before:
        if o.name.startswith("Icosphere"):
            bpy.data.objects.remove(o, do_unlink=True)
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    rig.animation_data.action = bpy.data.actions["Glide"]
    act = rig.animation_data.action
    if hasattr(rig.animation_data, "action_slot") and len(getattr(act, "slots", [])):
        rig.animation_data.action_slot = act.slots[0]
    for i, (yaw, elev, f) in enumerate(((-35, 8, 0), (-90, 4, 15), (180, 36, 30), (150, 36, 45))):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        leaf.location = bpy.data.objects["Socket_R_Hand"].matrix_world.translation   # the engine: socket position, character axes
        bpy.context.view_layer.update()
        shot(f"held_{i}.png", (0, 0, 0.75), yaw, elev, 1.75)
    print("RENDER_OK", out)
