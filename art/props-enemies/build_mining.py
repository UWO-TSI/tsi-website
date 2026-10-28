"""The main quest's pickaxe, the rocks it breaks and the things dug up (specs/launch/v1-gameplay.md m3, m6).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props-enemies/build_mining.py [-- render <dir>]

Writes, from primitives (no references, no libraries):
  web/public/assets/game/tools/pickaxe-1.glb          Mayor Eliza's pickaxe (web/lib/game/tools.ts `pickaxe-basic`)
  web/public/assets/game/forage/rock-stone.glb  the new world's rock a pickaxe breaks for stone (VillageLife's Outcrop)
  web/public/assets/game/forage/rock-iron.glb   the same rock with an iron seam: it gives iron
  web/public/assets/game/forage/rock-spent.glb  the rock once it's given its stone for the hour
The village keeps build_forage.py's outcrops (outcrop-rock_*.glb), as before.
  web/public/assets/game/forage/find_<key>.glb        the seven buried finds (web/lib/collections/roster.ts BURIED_FINDS)

Conventions as build_tools.py and build_forage.py: rig units (the engine scales by 1.3), Blender Z up, the face toward -Y.
The pickaxe is held like the shovel (the grip at the origin, the handle down -Z to the head, one pick toward the front),
so it takes the shovel's grip (components/game/character/Character.tsx). The outcrops sit on z = 0 and are a size up
from the old ones, layered like stone breaks: banded strata, a cracked top, broken pieces at the foot. The finds are
small hand-held things, centred on the origin, lying flat. Matte palette colours with the shared top-light gradient;
the material look classes (web/lib/game/modelMaterials.ts) give stone, metal and glass their light response.
"""
import bpy, math, os, random, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from pe import jitter, lathe, rbox  # noqa: E402

ASSETS = os.path.join(ROOT, "web", "public", "assets", "game")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)
MODELS = []

# The rock: the old outcrops' grey family, with lighter strata and darker cracks.
ROCK, ROCK_DARK, STRATA, CRACK, CHIP = "#958F86", "#7D776F", "#ABA59A", "#5F5A53", "#C9C2B6"


def prop(path):
    def deco(fn):
        MODELS.append((path, fn))
        return fn
    return deco


def model(name, mats, build, grad=(0.74, 1.0), sharp=40):
    m = {k: kit.material(f"{name}_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat=next(iter(mats)))
    build(pc)
    return pc.finish(name, None, m, sharp=sharp, grad=grad)


# ================================================================ the pickaxe
@prop("tools/pickaxe-1")
def pickaxe():
    def b(pc):
        pc.mat = "Handle"
        pc.tube([(0, 0, 0.12), (0, 0, -0.1), (0, 0, -0.34)], [0.0115, 0.012, 0.0135], sides=6, tip=False)
        pc.mat = "Wrap"                                      # the leather where the hand goes
        pc.tube([(0, 0, 0.05), (0, 0, -0.05)], [0.0135, 0.0135], sides=6, tip=False)
        pc.mat = "Head"
        # the head: a curved bar across the end of the handle, a point to the front and a flat chisel to the back
        rbox(pc, (0, 0, -0.355), (0.036, 0.046, 0.042), ch=0.3)
        pc.tube([(0, -0.015, -0.355), (0, -0.085, -0.35), (0, -0.14, -0.325), (0, -0.185, -0.28)], [0.019, 0.016, 0.011, 0.003], sides=6, tip=True)
        pc.tube([(0, 0.015, -0.355), (0, 0.08, -0.352), (0, 0.125, -0.335)], [0.019, 0.016, 0.014], sides=6, tip=False)
        rbox(pc, (0, 0.133, -0.332), (0.03, 0.014, 0.026), ch=0.25)
        pc.mat = "Wedge"                                     # the wedge through the eye, and a band of wear on the point
        rbox(pc, (0, 0, -0.33), (0.016, 0.022, 0.012), ch=0.2)
    return model("pickaxe-1", {"Handle": "#A97B4F", "Wrap": "#6B4A32", "Head": "#7E8388", "Wedge": "#B98F5E"}, b, grad=(0.8, 1.0), sharp=50)


# ================================================================ the rocks
def rock(pc, seed, spent=False):
    """A stone break: a tall faceted lump leaning back, a shoulder each side, banded strata across the face and a
    cracked top, sitting on a dark foot. `spent` breaks a wedge out of the face (a pale fresh break)."""
    rnd = random.Random(seed)
    pc.mat = "Rock"
    pc.blob((0, 0.03, 0.17), (0.22, 0.18, 0.18), segs=9, rings=6)
    pc.blob((-0.16, 0.06, 0.1), (0.12, 0.11, 0.11), segs=7, rings=5)
    pc.blob((0.17, 0.05, 0.09), (0.11, 0.1, 0.095), segs=7, rings=5)
    pc.mat = "Strata"                                        # two bands across the face
    for z, w in ((0.12, 0.2), (0.21, 0.16)):
        pc.blob((0.0, -0.13 + abs(z - 0.17) * 0.4, z), (w, 0.03, 0.018), segs=8, rings=3)
    pc.mat = "Crack"                                         # a crack down from the top
    pc.tube([(0.03, -0.12, 0.3), (0.0, -0.15, 0.24), (0.04, -0.165, 0.18)], [0.009, 0.008, 0.004], sides=4, tip=True)
    pc.mat = "Dark"
    pc.blob((0.0, 0.04, 0.025), (0.27, 0.21, 0.045), segs=10, rings=4)
    pc.mat = "Loose"                                         # broken pieces at its foot
    for x, y, r in ((-0.22, -0.17, 0.04), (-0.14, -0.22, 0.028), (0.23, -0.15, 0.034)):
        pc.blob((x + rnd.uniform(-0.01, 0.01), y, r * 0.8), (r, r * 0.85, r * 0.75), segs=6, rings=4)
    if spent:
        pc.mat = "Chip"
        pc.blob((0.03, -0.155, 0.17), (0.09, 0.016, 0.07), segs=6, rings=3)
        pc.blob((-0.05, -0.16, 0.24), (0.045, 0.012, 0.03), segs=5, rings=3)


ROCK_MATS = {"Rock": ROCK, "Strata": STRATA, "Crack": CRACK, "Dark": ROCK_DARK, "Loose": "#9A968D"}


@prop("forage/rock-stone")
def stone():
    ob = model("outcrop-rock_stone", ROCK_MATS, lambda pc: rock(pc, 1))
    jitter(ob, 0.012, seed=21)
    return ob


@prop("forage/rock-iron")
def iron():
    """The same rock with a rusty seam of iron across its face: knobs of ore with a metal glint."""
    def b(pc):
        rock(pc, 3)
        pc.mat = "Rust"
        pc.blob((0.02, -0.15, 0.16), (0.15, 0.025, 0.05), segs=8, rings=3)
        for c, r in (((0.05, -0.165, 0.18), (0.075, 0.05, 0.062)), ((-0.09, -0.155, 0.13), (0.062, 0.045, 0.052)), ((0.15, -0.12, 0.12), (0.05, 0.04, 0.042)), ((-0.02, -0.17, 0.25), (0.04, 0.03, 0.034))):
            pc.mat = "Iron"
            pc.blob(c, r, segs=7, rings=4)
            pc.mat = "Shine"
            pc.blob((c[0] - r[0] * 0.25, c[1] - r[1] * 0.55, c[2] + r[2] * 0.35), (r[0] * 0.35, r[1] * 0.25, r[2] * 0.3), segs=5, rings=3)
    ob = model("outcrop-rock_iron_nugget", {**ROCK_MATS, "Rust": "#7A6152", "Iron": "#6E7175", "Shine": "#B3B9BE"}, b)
    jitter(ob, 0.009, seed=23)
    return ob


@prop("forage/rock-spent")
def spent():
    ob = model("outcrop-spent", {**ROCK_MATS, "Chip": CHIP}, lambda pc: rock(pc, 6, spent=True))
    jitter(ob, 0.011, seed=26)
    return ob


# ================================================================ buried finds (small, lying flat)
@prop("forage/find_sea_glass")
def sea_glass():
    def b(pc):
        pc.mat = "Glass"
        pc.blob((0, 0, 0.012), (0.04, 0.03, 0.013), segs=8, rings=4)
        pc.mat = "Frost"
        pc.blob((-0.012, -0.008, 0.02), (0.016, 0.011, 0.006), segs=6, rings=3)
    ob = model("find_sea_glass", {"Glass": "#7FC9B5", "Frost": "#C6EDE2"}, b)
    jitter(ob, 0.002, seed=31)
    return ob


@prop("forage/find_old_coin")
def old_coin():
    def b(pc):
        pc.mat = "Coin"
        lathe(pc, (0, 0, 0), [(0, 0), (0.034, 0), (0.036, 0.004), (0.034, 0.008), (0, 0.008)], n=12)
        pc.mat = "Rim"
        lathe(pc, (0, 0, 0.0075), [(0.03, 0), (0.033, 0.0015), (0.03, 0.002)], n=12)
        pc.mat = "Stamp"                                    # a worn crown stamped in the middle
        pc.blob((0, 0, 0.009), (0.012, 0.012, 0.002), segs=6, rings=3)
        for a in (-0.6, 0.0, 0.6):
            pc.blob((math.sin(a) * 0.012, 0.012, 0.009), (0.004, 0.004, 0.002), segs=4, rings=3)
    return model("find_old_coin", {"Coin": "#B98A3E", "Rim": "#D6AC55", "Stamp": "#8E6A2E"}, b, sharp=60)


@prop("forage/find_ammonite")
def ammonite():
    """A coiled shell standing on its edge: a tube along a growing spiral, ribbed."""
    def b(pc):
        pts, rad = [], []
        for k in range(30):
            a = k * 0.42
            r = 0.008 * math.exp(0.13 * a)
            pts.append(Vector((math.cos(a) * r, 0, 0.05 + math.sin(a) * r)))
            rad.append(0.004 + r * 0.42)
        pc.mat = "Shell"
        pc.tube(pts, rad, sides=7, tip=False)
        pc.mat = "Rib"
        for k in range(6, 30, 3):
            pc.blob(tuple(pts[k] + Vector((0, 0, 0))), (rad[k] * 0.35, rad[k] * 1.05, rad[k] * 0.35), segs=5, rings=3)
    return model("find_ammonite", {"Shell": "#C9A77E", "Rib": "#9C7B55"}, b)


@prop("forage/find_pottery_shard")
def pottery_shard():
    def b(pc):
        pc.mat = "Clay"
        rbox(pc, (0, 0, 0.008), (0.06, 0.045, 0.008), ch=0.35)
        pc.mat = "Glaze"                                    # a painted stripe on the outside
        rbox(pc, (0, -0.006, 0.0158), (0.054, 0.008, 0.0012), ch=0.4)
    ob = model("find_pottery_shard", {"Clay": "#C2703F", "Glaze": "#EFE0C4"}, b)
    jitter(ob, 0.0015, seed=34)
    return ob


@prop("forage/find_geode")
def geode():
    """A plain round stone broken open: a pale rim and purple crystals facing the front."""
    def b(pc):
        pc.mat = "Shell"
        pc.blob((0, 0.012, 0.04), (0.05, 0.035, 0.042), segs=8, rings=5)
        pc.mat = "Rim"
        lathe(pc, (0, -0.02, 0.04), [(0, 0), (0.042, 0), (0.044, 0.004), (0, 0.004)], n=10, axis=(0, -1, 0))
        pc.mat = "Crystal"
        for x, z in ((0, 0.04), (0.018, 0.05), (-0.017, 0.032), (0.012, 0.024), (-0.012, 0.055), (0.026, 0.035), (-0.026, 0.045)):
            lathe(pc, (x, -0.022, z), [(0.007, 0), (0, 0.012)], n=5, axis=(0, -1, 0))
    ob = model("find_geode", {"Shell": "#8C7660", "Rim": "#E8E2F0", "Crystal": "#9B7FD1"}, b, sharp=30)
    jitter(ob, 0.003, seed=35)
    return ob


@prop("forage/find_amber")
def amber():
    def b(pc):
        pc.mat = "Amber"
        pc.blob((0, 0, 0.02), (0.032, 0.026, 0.022), segs=8, rings=5)
        pc.mat = "Speck"                                    # something small caught inside long ago
        pc.blob((0.004, -0.012, 0.022), (0.008, 0.004, 0.005), segs=5, rings=3)
        pc.mat = "Glow"
        pc.blob((-0.012, -0.012, 0.03), (0.01, 0.006, 0.006), segs=5, rings=3)
    ob = model("find_amber", {"Amber": "#E39B2D", "Speck": "#5A3A1E", "Glow": "#F7C76A"}, b)
    jitter(ob, 0.003, seed=36)
    return ob


@prop("forage/find_trilobite")
def trilobite():
    """A fossil bug in a flat stone: a half-moon head, a ribbed body and a tail, raised out of the slab."""
    def b(pc):
        pc.mat = "Slab"
        rbox(pc, (0, 0, 0.007), (0.07, 0.055, 0.007), ch=0.4)
        pc.mat = "Fossil"
        pc.blob((0, -0.03, 0.017), (0.03, 0.014, 0.006), segs=8, rings=3)
        for k in range(6):
            y = -0.014 + k * 0.0085
            w = 0.026 - k * 0.0025
            pc.blob((0, y, 0.017), (w, 0.004, 0.005), segs=6, rings=3)
        pc.blob((0, 0.04, 0.015), (0.01, 0.008, 0.004), segs=6, rings=3)
        pc.mat = "Ridge"
        pc.blob((0, 0.004, 0.02), (0.005, 0.034, 0.003), segs=5, rings=3)
    ob = model("find_trilobite", {"Slab": "#B5AA98", "Fossil": "#7E7366", "Ridge": "#5F564B"}, b)
    jitter(ob, 0.0008, seed=37)
    return ob


def export(ob, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)


built = []
for path, fn in MODELS:
    ob = fn()
    export(ob, os.path.join(ASSETS, f"{path}.glb"))
    print(f"MODEL {path} tris={kit.ntris(ob)}")
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
        e, a = math.radians(30), math.radians(-25)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = mid + d * 4
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        cam.data.ortho_scale = size * 1.3
        cam.data.clip_end = 20
        sc.render.filepath = os.path.join(out, f"{ob.name}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out)
