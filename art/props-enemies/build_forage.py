"""Foraging and crafting props (specs/polish/forage-craft-museum.md): the rock outcrop a shovel strikes, one for each
material a rock node rolls (the material showing in the rock's face), the bare rock left once it has given its
material for the hour, and the hammer the workbench puts in your hand.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_forage.py [-- render <dir>]

Writes web/public/assets/game/forage/<key>.glb. The props' conventions (build_props.py, build_items.py): rig units
(the v6 character is 1.045 tall; the engine scales by 1.3), Blender Z up, the face toward -Y (the follow camera's
side), sitting on z = 0. Matte palette colours with the shared top-light gradient, low-poly with smooth shading inside
the sharp angle. The ore takes the material items' own colours (build_items.py), so the rock shows what it gives.
The hammer is held like the net (the grip at the origin, the handle up +Z to the head, its face toward -Y).
With `render`, a review sheet of each on its own.
"""
import bpy, math, os, random, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from pe import jitter, lathe, rbox  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "assets", "game", "forage")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)
MODELS = []

# The rock itself: a cool grey, darker in the cracks (the gradient does the rest), a shade off the map's boulders.
ROCK, ROCK_DARK, CHIP = "#958F86", "#7D776F", "#C9C2B6"


def prop(key):
    def deco(fn):
        MODELS.append((key, fn))
        return fn
    return deco


def model(name, mats, build, grad=(0.74, 1.0), sharp=40):
    m = {k: kit.material(f"{name}_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat=next(iter(mats)))
    build(pc)
    return pc.finish(name, None, m, sharp=sharp, grad=grad)


def boulder(pc, seed, spent=False):
    """A low, chunky outcrop: one main lump, two shoulders and a flat foot, faceted by a seeded wobble later. `spent`
    takes a bite out of its face where the material came out (a pale fresh break)."""
    rnd = random.Random(seed)
    pc.mat = "Rock"
    pc.blob((0, 0.02, 0.13), (0.2, 0.16, 0.14), segs=9, rings=6)
    pc.blob((-0.13, 0.05, 0.08), (0.11, 0.1, 0.09), segs=7, rings=5)
    pc.blob((0.14, 0.04, 0.07), (0.1, 0.09, 0.075), segs=7, rings=5)
    pc.mat = "Dark"
    pc.blob((0.0, 0.03, 0.025), (0.24, 0.18, 0.04), segs=10, rings=4)
    if spent:
        pc.mat = "Chip"                                     # a pale fresh break set into the face, and two flakes at the foot
        pc.blob((0.02 + rnd.uniform(-0.01, 0.01), -0.128, 0.15), (0.075, 0.012, 0.05), segs=6, rings=3)
        for x, y in ((-0.06, -0.21), (0.08, -0.2)):
            pc.blob((x, y, 0.012), (0.022, 0.016, 0.01), segs=5, rings=3)


def nugget(pc, c, r, shine_mat="Shine"):
    """A nugget pressed into the rock's face, with a bright cap where it catches the light."""
    pc.blob(c, r, segs=7, rings=4)
    pc.mat = shine_mat
    pc.blob((c[0] - r[0] * 0.25, c[1] - r[1] * 0.55, c[2] + r[2] * 0.35), (r[0] * 0.35, r[1] * 0.25, r[2] * 0.3), segs=5, rings=3)


@prop("outcrop-rock_stone")
def stone():
    def b(pc):
        boulder(pc, 1)
        pc.mat = "Loose"                                    # a few loose stones broken off at its foot
        for x, y, r in ((-0.19, -0.16, 0.035), (-0.12, -0.2, 0.026), (0.2, -0.14, 0.03)):
            pc.blob((x, y, r * 0.8), (r, r * 0.85, r * 0.75), segs=6, rings=4)
    ob = model("outcrop-rock_stone", {"Rock": ROCK, "Dark": ROCK_DARK, "Loose": "#9A968D"}, b)
    jitter(ob, 0.012, seed=11)
    return ob


@prop("outcrop-rock_clay")
def clay():
    def b(pc):
        boulder(pc, 2)
        pc.mat = "Clay"                                     # a seam of clay bulging out of the face, and a slumped lump
        pc.blob((0.03, -0.12, 0.12), (0.12, 0.05, 0.06), segs=8, rings=4)
        pc.blob((-0.08, -0.16, 0.05), (0.07, 0.045, 0.045), segs=7, rings=4)
        pc.mat = "Wet"
        pc.blob((0.06, -0.155, 0.13), (0.04, 0.018, 0.022), segs=6, rings=3)
    ob = model("outcrop-rock_clay", {"Rock": ROCK, "Dark": ROCK_DARK, "Clay": "#C27D5A", "Wet": "#9D5E44"}, b)
    jitter(ob, 0.01, seed=12)
    return ob


@prop("outcrop-rock_iron_nugget")
def iron():
    def b(pc):
        boulder(pc, 3)
        pc.mat = "Iron"
        nugget(pc, (0.04, -0.125, 0.15), (0.068, 0.048, 0.056))
        pc.mat = "Iron"
        nugget(pc, (-0.1, -0.11, 0.095), (0.05, 0.04, 0.042))
        pc.mat = "Iron"
        nugget(pc, (0.135, -0.08, 0.07), (0.04, 0.034, 0.034))
    ob = model("outcrop-rock_iron_nugget", {"Rock": ROCK, "Dark": ROCK_DARK, "Iron": "#6E7175", "Shine": "#A9AFB4"}, b)
    jitter(ob, 0.009, seed=13)
    return ob


@prop("outcrop-rock_gold_nugget")
def gold():
    def b(pc):
        boulder(pc, 4)
        pc.mat = "Gold"
        nugget(pc, (0.02, -0.13, 0.14), (0.062, 0.045, 0.05))
        pc.mat = "Gold"
        nugget(pc, (-0.11, -0.1, 0.08), (0.04, 0.034, 0.034))
        pc.mat = "Fleck"                                    # a few gold flecks in the stone round them
        for x, z in ((0.09, 0.17), (-0.04, 0.2), (0.13, 0.09), (-0.15, 0.12)):
            pc.blob((x, -0.15 + abs(x) * 0.25, z), (0.012, 0.007, 0.01), segs=5, rings=3)
    ob = model("outcrop-rock_gold_nugget", {"Rock": ROCK, "Dark": ROCK_DARK, "Gold": "#D9A93A", "Shine": "#F2D57A", "Fleck": "#E8C25A"}, b)
    jitter(ob, 0.009, seed=14)
    return ob


@prop("outcrop-rock_crystal")
def crystal():
    def b(pc):
        boulder(pc, 5)
        pc.mat = "Crystal"                                  # a cluster of hexagonal points breaking out of the top and face
        for x, y, z, h, r, lean in ((0.03, -0.04, 0.22, 0.25, 0.04, (0.1, -0.35)), (-0.07, -0.07, 0.19, 0.18, 0.033, (-0.5, -0.3)),
                                     (0.11, -0.08, 0.15, 0.17, 0.032, (0.6, -0.45)), (-0.01, -0.13, 0.12, 0.13, 0.028, (-0.1, -0.85)),
                                     (0.14, 0.03, 0.17, 0.12, 0.026, (0.6, 0.1)), (-0.14, 0.02, 0.12, 0.1, 0.024, (-0.7, 0.05))):
            d = Vector((lean[0], lean[1], 1)).normalized()
            lathe(pc, (x, y, z - 0.04), [(r, 0), (r * 1.08, h * 0.65), (0, h)], n=6, axis=d)
        pc.mat = "Deep"
        lathe(pc, (-0.11, 0.0, 0.17), [(0.016, 0), (0.017, 0.05), (0, 0.075)], n=6, axis=Vector((-0.5, 0.2, 1)).normalized())
    ob = model("outcrop-rock_crystal", {"Rock": ROCK, "Dark": ROCK_DARK, "Crystal": "#A9DCEB", "Deep": "#7FC0D6"}, b, sharp=30)
    jitter(ob, 0.006, seed=15)
    return ob


@prop("outcrop-spent")
def spent():
    def b(pc):
        boulder(pc, 6, spent=True)
    ob = model("outcrop-spent", {"Rock": ROCK, "Dark": ROCK_DARK, "Chip": CHIP}, b)
    jitter(ob, 0.011, seed=16)
    return ob


@prop("hammer")
def hammer():
    """A claw hammer, held like the net: the grip at the origin, the handle up +Z, the striking face toward -Y."""
    def b(pc):
        pc.mat = "Handle"
        pc.tube([(0, 0, -0.035), (0, 0, 0.06), (0, 0, 0.15)], [0.013, 0.012, 0.011], sides=6, tip=False)
        pc.mat = "Wrap"
        pc.tube([(0, 0, -0.04), (0, 0, 0.03)], [0.0145, 0.0145], sides=6, tip=False)
        pc.mat = "Head"
        lathe(pc, (0, 0.0, 0.165), [(0, -0.045), (0.016, -0.045), (0.018, -0.035), (0.017, 0.0), (0.0, 0.0)], n=8, axis=(0, 1, 0))
        rbox(pc, (0, 0.012, 0.165), (0.03, 0.03, 0.034), ch=0.3)
        # the claw: two tines curving back and down
        for x in (-0.007, 0.007):
            pc.tube([(x, 0.025, 0.168), (x, 0.05, 0.162), (x, 0.065, 0.145)], [0.007, 0.006, 0.003], sides=4, tip=True)
    return model("hammer", {"Handle": "#B38A5A", "Wrap": "#7A5A3E", "Head": "#8A8E8C"}, b, grad=(0.8, 1.0), sharp=50)


def export(ob, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)


built = []
for key, fn in MODELS:
    ob = fn()
    export(ob, os.path.join(OUT, f"{key}.glb"))
    print(f"MODEL forage/{key} tris={kit.ntris(ob)}")
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
    sc.render.resolution_x = sc.render.resolution_y = 240
    kit.show_vertex_colors(sc)
    for ob in built:
        for o in built:
            o.hide_render = o is not ob
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        mid = sum(pts, Vector()) / 8
        size = max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))
        e, a = math.radians(30), math.radians(-25)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = mid + d * 4
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        cam.data.ortho_scale = size * 1.3
        cam.data.clip_end = 20
        sc.render.filepath = os.path.join(out, f"{ob.name}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out)
