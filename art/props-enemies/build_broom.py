"""Rosa's porch broom (specs/v1-drop.md §2: the café built but closed, Rosa sweeping out front).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_broom.py [-- render <dir>]

Writes web/public/assets/game/tools/broom.glb. The tools' conventions (build_tools.py): rig units (the v6 character is
1.045 tall; the engine scales by 1.3), the grip at the origin = the right hand's socket, Blender Z up, the character's
front -Y. Held like the shovel (Character.tsx HELD_GRIPS.shovel): the handle runs a little up past the hand and down
-Z to a corn-straw head, its wide side across X. Matte palette colours with the shared top-light gradient.
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from pe import lathe  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "assets", "game", "tools")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)

TOP, NECK, TIP = 0.2, -0.36, -0.55          # the handle's end over the hand, the binding, the straw's tips


def broom():
    mats = {"Handle": "#8a6240", "Binding": "#7a3b2e", "Straw": "#d8b86a", "StrawTip": "#b8944c"}
    m = {k: kit.material(f"broom_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat="Handle")
    pc.tube([(0, 0, TOP), (0, 0, 0), (0, 0, NECK + 0.01)], [0.011, 0.012, 0.012], sides=6, tip=False)
    lathe(pc, (0, 0, TOP), [(0.012, 0), (0.014, 0.008), (0, 0.016)], n=6)              # a rounded end
    pc.mat = "Binding"                                                                   # two bands of red twine
    for z in (NECK, NECK - 0.035):
        lathe(pc, (0, 0, z), [(0, -0.008), (0.05, -0.008), (0.05, 0.008), (0, 0.008)], n=8, sx=1.0, sy=0.5)
    # The head: corn straw flaring from the binding to a wide, thin, slightly ragged fan, the tips a shade darker.
    pc.mat = "Straw"
    lathe(pc, (0, 0, NECK - 0.045), [(0, 0.0), (0.05, 0.0), (0.085, 0.08), (0.11, 0.14)], n=10, sx=1.0, sy=0.32, axis=(0, 0, -1))
    pc.mat = "StrawTip"
    lathe(pc, (0, 0, NECK - 0.185), [(0.11, 0.0), (0.118, 0.02), (0, 0.02)], n=10, sx=1.0, sy=0.32, axis=(0, 0, -1))
    return pc.finish("broom", None, m, sharp=50, grad=(0.8, 1.0))


ob = broom()
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
path = os.path.join(OUT, "broom.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)
print(f"MODEL tools/broom tris={kit.ntris(ob)} bytes={os.path.getsize(path)}")

if "render" in ARGS:
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    kit.render_setup(sc, (0.94, 0.91, 0.84, 1))
    sc.render.film_transparent = False
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 240, 300
    kit.show_vertex_colors(sc)
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mid = sum(pts, Vector()) / 8
    e, a = math.radians(18), math.radians(-35)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = mid + d * 10
    cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    cam.data.ortho_scale = (max(p.z for p in pts) - min(p.z for p in pts)) * 1.15
    cam.data.clip_end = 40
    sc.render.filepath = os.path.join(out, "broom.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out)
