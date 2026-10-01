"""Quick Blender review renders of the café GLBs (not evidence: the engine shots are).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/cafe/preview.py -- <out_dir> [room|sets|building]
"""
import bpy, math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cafekit as K  # noqa: E402
from cafekit import G  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT, WHAT = args[0], (args[1:] or ["room"])
os.makedirs(OUT, exist_ok=True)
K.reset()
scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
scene.render.resolution_x, scene.render.resolution_y = 1280, 800
scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Standard"
w = bpy.data.worlds.new("W")
scene.world = w
w.use_nodes = True
next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (0.05, 0.04, 0.03, 1)


def load(name, at=(0, 0, 0), yaw=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"{name}.glb"))
    for o in set(bpy.data.objects) - before:
        if o.parent is None:
            o.location = G(*at)
            o.rotation_euler[2] += yaw


def light(at, energy, color=(1, 0.85, 0.65), kind="POINT", size=0.5):
    d = bpy.data.lights.new("L", kind)
    d.energy, d.color = energy, color
    if kind == "AREA":
        d.size = size
    o = bpy.data.objects.new("L", d)
    scene.collection.objects.link(o)
    o.location = G(*at)
    return o


def cam(at, look, lens=24):
    c = bpy.data.cameras.new("C")
    c.lens = lens
    o = bpy.data.objects.new("C", c)
    scene.collection.objects.link(o)
    o.location = G(*at)
    d = G(*look) - o.location
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.camera = o
    return o


def shot(name):
    scene.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER", name)


if "room" in WHAT:
    load("cafe-room")
    SETS = [("set-bar", (-9.22, -3.0), -math.pi / 2), ("set-bar", (-9.22, -0.6), -math.pi / 2), ("set-booth", (-8.1, 5.55), math.pi / 2),
            ("set-communal", (-4.2, 5.35), 0), ("set-four", (-4.6, -2.0), 0), ("set-two", (4.4, 0.9), 0), ("set-two", (6.6, -4.4), 0)]
    for n, (x, z), yaw in SETS:
        load(n, (x, 0, z), yaw)
    for at in ((4, 3.6, 5.0), (-5, 3.4, 2.0), (5, 3.4, -2.0), (-5, 3.4, -3.0)):
        light(at, 220)
    cam((0, 8.4, -10.8), (0, 0.7, -2.4), lens=22)
    shot("game-door")
    cam((2, 8.4, -3.0), (2, 0.7, 5.4), lens=22)
    shot("game-bar")
    cam((-4.6, 1.65, 1.2), (3.0, 1.6, 6.3), lens=20)
    shot("eye-ref1")
    cam((4.0, 1.5, 1.4), (4.0, 3.2, 6.4), lens=22)
    shot("eye-ref2")
    cam((3.6, 1.45, 1.6), (3.6, 1.45, 6.4), lens=24)
    shot("eye-ref3")
    cam((-2.0, 1.4, 0.5), (1.5, 2.4, 6.4), lens=22)
    shot("eye-ref4")
if "sets" in WHAT:
    for i, n in enumerate(("set-bar", "set-two", "set-four", "set-booth", "set-communal")):
        load(n, (i * 3.2 - 6.4, 0, 0))
    light((0, 6, -4), 2000, kind="AREA", size=8)
    cam((0, 4.5, -7.5), (0, 0.4, 0), lens=30)
    shot("sets")
