"""Quick Blender review renders of the interior shells with each room's furniture (not evidence: the engine shots are).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/preview.py -- <out_dir> [hq shop oracle museum kit]
"""
import bpy, math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402
from cafekit import G  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT, WHAT = args[0], (args[1:] or ["hq", "shop", "oracle", "museum", "kit"])
os.makedirs(OUT, exist_ok=True)
GAME = os.path.join(K.ROOT, "web", "public", "assets")
FURN = os.path.join(GAME, "acnh", "furniture")
INT = os.path.join(GAME, "game", "interiors")


def setup(bg=(0.08, 0.06, 0.05)):
    K.reset()
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    scene.render.resolution_x, scene.render.resolution_y = 1440, 860
    scene.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("W")
    scene.world = w
    w.use_nodes = True
    next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (*bg, 1)
    next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[1].default_value = 0.6
    return scene


def load(path, at=(0, 0, 0), yaw=0.0, scale=1.0, rot_x=0.0, hide=()):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = set(bpy.data.objects) - before
    for o in new:
        if any(o.name.startswith(h) for h in hide):
            o.hide_render = True
        if o.parent is None:
            o.scale = (scale, scale, scale)
            o.rotation_euler = (rot_x, 0, yaw)
            o.location = G(*at)
    return new


def piece(name, at, yaw=0.0, scale=0.1, rot_x=0.0):
    return load(os.path.join(FURN, f"{name}.glb"), at, yaw, scale, rot_x)


def light(at, energy, color=(1, 0.85, 0.65), kind="POINT", size=0.5, rot=None):
    d = bpy.data.lights.new("L", kind)
    d.energy, d.color = energy, color
    if kind == "AREA":
        d.size = size
    o = bpy.data.objects.new("L", d)
    bpy.context.scene.collection.objects.link(o)
    o.location = G(*at)
    if rot:
        o.rotation_euler = rot
    return o


def cam(at, look, lens=35):
    c = bpy.data.cameras.new("C")
    c.lens = lens
    o = bpy.data.objects.new("C", c)
    bpy.context.scene.collection.objects.link(o)
    o.location = G(*at)
    o.rotation_euler = (G(*look) - o.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = o


def shot(name):
    bpy.context.scene.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER", name)


def sun(elev=35, azim=-40, energy=3.0, color=(1, 0.93, 0.8)):
    d = bpy.data.lights.new("S", "SUN")
    d.energy, d.color = energy, color
    o = bpy.data.objects.new("S", d)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (math.radians(90 - elev), 0, math.radians(azim))


GAME_CAM_LENS = 24.2   # the game's 48-degree vertical field at 1440 x 860 (36 mm sensor across)

if "hq" in WHAT:
    setup()
    load(os.path.join(INT, "hq.glb"), hide=("hq_caster",))
    bpy.ops.mesh.primitive_plane_add(size=1)
    fl = bpy.context.object
    fl.scale = (16, 12, 1)
    mat = bpy.data.materials.new("floor"); mat.use_nodes = True
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(GAME, "acnh", "interior", "hq-parquet-albedo.png"))
    mapping = mat.node_tree.nodes.new("ShaderNodeMapping"); coord = mat.node_tree.nodes.new("ShaderNodeTexCoord")
    mapping.inputs["Scale"].default_value = (1, 0.75, 1)
    mat.node_tree.links.new(coord.outputs["UV"], mapping.inputs["Vector"]); mat.node_tree.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    mat.node_tree.links.new(tex.outputs["Color"], next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"])
    fl.data.materials.append(mat)
    for name, at, yaw, s in (("bulletinboard", (0, 1.28, 5.78), math.pi, 0.2), ("lounge-sofa", (4.85, 0, 4.8), math.pi, 0.16), ("lounge-table", (4.85, 0, 2.85), 0, 0.12),
                             ("study-chair", (6.55, 0, 1.15), -0.45, 0.1), ("floor-lamp", (6.8, 0, 4.8), 0, 0.115), ("study-chair", (-5.2, 0, -0.7), math.pi, 0.1),
                             ("bookshelf", (7.7, 0, -1.3), math.pi / 2, 0.1), ("antique-clock", (-7, 0, 5.55), math.pi, 0.1), ("plant-monstera", (-7.2, 0, 3.2), 0, 0.1),
                             ("plant-yucca", (7.25, 0, -4), 0, 0.1)):
        piece(name, at, yaw, s)
    load(os.path.join(INT, "kit.glb"), hide=("curator", "oracle", "pendant", "home"))
    for o in bpy.data.objects:
        if o.name.startswith("hq_front_desk"):
            o.location = G(-5.2, 0, -2.4)
    for at in ((0, 3.2, 5.0), (4.85, 2.9, 2.85), (-3, 3.4, -2), (3, 3.4, -2)):
        light(at, 260)
    sun(30, 75, 2.2)
    cam((0, 8.4, -11.4), (0, 0.7, -3.0), GAME_CAM_LENS)
    shot("hq-game")
    cam((-2.0, 1.7, -3.5), (-7.6, 2.0, -1.7), 22)
    shot("hq-window")
    cam((-5.2, 8.4, -10.8), (-5.2, 0.7, -3.6), GAME_CAM_LENS)
    shot("hq-desk-game")
    cam((-4.2, 2.6, -4.9), (-5.2, 0.85, -2.4), 30)
    shot("hq-desk")
if "shop" in WHAT:
    setup()
    load(os.path.join(INT, "shop.glb"), hide=("shop_caster",))
    for name, at, yaw, s in (("counter-register", (0, 0, 3.4), math.pi, 0.16), ("color-box-shelf", (-4.1, 0, 2.2), math.pi / 2, 0.13), ("color-box-shelf", (4.1, 0, 2.2), -math.pi / 2, 0.13),
                             ("color-box-shelf", (-4.1, 0, -0.6), math.pi / 2, 0.13), ("barrel", (4.2, 0, -3.9), 0, 0.09), ("barrel", (3.3, 0, -4.3), 0, 0.085),
                             ("cardboard-pile", (-4.0, 0, -4.0), 0.5, 0.1), ("shopping-cart", (3.9, 0, 0.9), -0.9, 0.09)):
        piece(name, at, yaw, s)
    for at in ((0, 3.0, 0), (0, 2.2, 2.6)):
        light(at, 300)
    sun(30, 75, 2.2)
    cam((0, 8.4, -10.6), (0, 0.7, -2.2), GAME_CAM_LENS)
    shot("shop-game")
    cam((0, 2.2, -1.5), (0, 2.0, 5.0), 24)
    shot("shop-counter")
if "oracle" in WHAT:
    setup((0.06, 0.05, 0.09))
    load(os.path.join(INT, "oracle.glb"), hide=("oracle_caster",))
    for name, at, yaw, s in (("magic-circle-rug", (0, 0.012, 2.6), 0, 0.14), ("altar", (0, 0, 2.6), 0, 0.11), ("remains-pillar", (-3.6, 0, 3.6), 0, 0.12),
                             ("remains-pillar", (3.6, 0, 3.6), 0.6, 0.12), ("candle", (-1.5, 0, 1.4), 0, 0.09), ("candle", (1.6, 0, 1.5), 1.2, 0.08)):
        piece(name, at, yaw, s)
    load(os.path.join(INT, "kit.glb"), hide=("curator", "pendant", "home"))
    for o in bpy.data.objects:
        if o.name.startswith("oracle_crystal"):
            o.location = G(0, 2.35, 2.6)
    for at, c in (((0, 4.2, 0), (0.85, 0.75, 1.0)), ((0, 3, 2.6), (0.85, 0.7, 1)), ((-2.2, 1, 2.2), (1, 0.8, 0.55)), ((2.2, 1, 2.2), (1, 0.8, 0.55))):
        light(at, 380, c)
    cam((0, 8.4, -11.2), (0, 0.7, -3.0), GAME_CAM_LENS)
    shot("oracle-game")
if "museum" in WHAT:
    setup()
    load(os.path.join(INT, "museum.glb"), hide=("museum_caster",))
    for cx, piece_name, s in ((6, "museum-tank", 0.27), (0, "museum-case", 0.1), (-6, "museum-stand", 0.1)):
        for i in range(6):
            x, z = cx + 1.8 - (i % 3) * 1.8, (1.6 if i < 3 else 3.8)
            piece(piece_name, (x, 0, z), 0, s)
    load(os.path.join(INT, "kit.glb"), hide=("oracle", "pendant", "home"))
    for o in bpy.data.objects:
        if o.name.startswith("curator_desk"):
            o.location = G(-2.2, 0, -1.3)
    for at in ((6, 3, 2.6), (0, 3, 2.6), (-6, 3, 2.6), (0, 3.5, -2.5)):
        light(at, 300)
    sun(40, 75, 2.0)
    cam((0, 8.4, -10.6), (0, 0.7, -2.0), GAME_CAM_LENS)
    shot("museum-game")
if "kit" in WHAT:
    setup((0.5, 0.5, 0.52))
    load(os.path.join(INT, "kit.glb"))
    xs = {"curator_desk": -2.0, "oracle_crystal": 0.0, "pendant_lamp": 1.4, "home_lip": 0.0, "home_lip_door": 0.0, "hq_front_desk": 2.6}
    for o in bpy.data.objects:
        for k, x in xs.items():
            if o.name.startswith(k) and o.parent is None:
                o.location = G(x, 1.6 if k == "oracle_crystal" else (2.4 if k == "pendant_lamp" else 0), 0 if not k.startswith("home") else (-2.5 if k == "home_lip" else -5.5))
    sun(40, -30, 3.0)
    light((0, 3, -3), 300)
    cam((0, 3.2, -6.0), (0, 0.9, -1.5), 30)
    shot("kit")
