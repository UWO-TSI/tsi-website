"""The trick-or-treat candies (web/lib/collections/treats.ts): what a resident hands over at the door on a Halloween night.
Held in front from the tool wheel (they can be eaten) and the source of their icons, like the fruit (build_items.py).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_treats.py [-- render <dir>]

Writes web/public/assets/game/items/treat_<name>.glb. build_items.py's look: matte palette colours, the shared top-light
gradient, low-poly with smooth shading inside 50 degrees; each on its base at the origin, Blender Z up, its front toward
-Y, sized against the fruit (an apple is a fist; a toffee about a thumb).
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from pe import lathe  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "assets", "game", "items")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)


def model(name, mats, build, grad=(0.8, 1.0)):
    m = {k: kit.material(f"{name}_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat=next(iter(mats)))
    build(pc)
    return pc.finish(name, None, m, sharp=50, grad=grad)


def toffee():
    """A toffee in twisted waxed paper: a plump middle, the paper's twists flaring either side."""
    def b(pc):
        pc.mat = "Wrap"
        lathe(pc, (-0.032, 0, 0.018), [(0, 0), (0.014, 0.004), (0.018, 0.016), (0.018, 0.048), (0.014, 0.06), (0, 0.064)], n=8, axis=(1, 0, 0))
        pc.mat = "Twist"
        for s in (-1, 1):
            x0 = 0.03 * s
            lathe(pc, (x0, 0, 0.018), [(0.005, 0), (0.004, 0.006), (0.013, 0.018), (0.015, 0.022), (0, 0.022)], n=6, axis=(s, 0, 0))
        pc.mat = "Stripe"
        lathe(pc, (-0.003, 0, 0.018), [(0.0185, 0), (0.0185, 0.006)], n=8, axis=(1, 0, 0))
    return model("treat_toffee", {"Wrap": "#D9772F", "Twist": "#F3E9D2", "Stripe": "#5F7A55"}, b)


def lollipop():
    """A swirl lollipop: a flat disc of three coloured rings on a white stick."""
    def b(pc):
        pc.mat = "Stick"
        pc.tube([(0, 0, 0), (0, 0, 0.07)], [0.0035, 0.0035], sides=5, tip=False)
        c = Vector((0, 0, 0.095))
        for k, (r0, r1) in enumerate(((0.0, 0.012), (0.012, 0.022), (0.022, 0.032))):
            pc.mat = ("Inner", "Middle", "Outer")[k]
            prof = [(r0, -0.006), (r1, -0.006), (r1, 0.006), (r0, 0.006)] if r0 else [(0, -0.006), (r1, -0.006), (r1, 0.006), (0, 0.006)]
            lathe(pc, c, prof, n=14, axis=(0, -1, 0))
    return model("treat_lollipop", {"Stick": "#FAF7F0", "Inner": "#E27AB0", "Middle": "#F0D24A", "Outer": "#7FBFEA"}, b)


def candy_corn():
    """Candy corn: a soft triangular kernel, yellow at the base, orange in the middle, a white tip."""
    def b(pc):
        bands = (("Base", 0.0, 0.016, 0.02, 0.017), ("Middle", 0.016, 0.034, 0.017, 0.011), ("Tip", 0.034, 0.05, 0.011, 0.0))
        for name, z0, z1, r0, r1 in bands:
            pc.mat = name
            prof = [(0, z0) if name == "Base" else (r0, z0), (r0, z0), (r1, z1)] if r1 else [(r0, z0), (0.004, z1 - 0.002), (0, z1)]
            if name == "Base":
                prof = [(0, z0), (r0 * 0.9, z0), (r0, z0 + 0.004), (r1, z1)]
            lathe(pc, (0, 0, 0), prof, n=3, sy=0.55, phase=math.pi / 2)
    return model("treat_candy_corn", {"Base": "#F0D24A", "Middle": "#D9772F", "Tip": "#FAF7F0"}, b)


built = []
os.makedirs(OUT, exist_ok=True)
for fn in (toffee, lollipop, candy_corn):
    ob = fn()
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{ob.name}.glb"), export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)
    print(f"MODEL items/{ob.name} tris={kit.ntris(ob)}")
    built.append(ob)

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
    sc.render.resolution_x = sc.render.resolution_y = 200
    kit.show_vertex_colors(sc)
    for ob in built:
        for o in built:
            o.hide_render = o is not ob
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        mid = sum(pts, Vector()) / 8
        size = max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))
        e, a = math.radians(24), math.radians(-35)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = mid + d * 4
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        cam.data.ortho_scale = size * 1.35
        cam.data.clip_end = 20
        sc.render.filepath = os.path.join(out, f"{ob.name}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out)
