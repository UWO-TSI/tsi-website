"""Review renders of the keycap keychain (art/merch/build_keycap_keychain.py's GLB): a turnaround, plain studio light.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/merch/render_keychain.py -- <out_dir> [views]
views: comma-separated yaw degrees (default 0,45,90,180,270,315), plus "top" (looking at the keycap's face).
"""
import math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else "/tmp/keychain"
VIEWS = (args[1] if len(args) > 1 else "0,45,90,180,270,315,top").split(",")
os.makedirs(OUT, exist_ok=True)

K.reset()
bpy.ops.import_scene.gltf(filepath=os.path.join(K.ROOT, "web", "public", "assets", "game", "items", "merch-tsi-keycap-keychain.glb"))
obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
K.show_vertex_colors(obs)
sc = bpy.context.scene
engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
sc.render.engine = next(e for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH") if e in engines)
sc.render.resolution_x = sc.render.resolution_y = 640
sc.render.film_transparent = False
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs[0].default_value = (0.86, 0.86, 0.87, 1); bg.inputs[1].default_value = 1.0
for loc, energy in (((2, -3, 3), 900), ((-3, -1, 1.5), 350), ((0, 3, 2), 300)):
    L = bpy.data.lights.new("l", "AREA"); L.energy = energy; L.size = 3
    o = bpy.data.objects.new("l", L); o.location = loc; sc.collection.objects.link(o)
    o.rotation_euler = (Vector((0, 0, -0.55)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 1.25
target = Vector((0, 0, -0.55))   # Blender z up: the keychain hangs from 0 down to about -1.08
for v in VIEWS:
    if v == "top":
        # looking at the keycap's face: the switch axis is game −z = Blender +y
        d = Vector((0, 1, 0)); tgt = Vector((0, 0, -0.97)); cam.data.ortho_scale = 0.42
    else:
        a = math.radians(float(v)); d = Vector((math.sin(a), math.cos(a), 0.15)); tgt = target; cam.data.ortho_scale = 1.25
    cam.location = tgt + d.normalized() * 6
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Z" if v != "top" else "Z").to_euler()
    sc.render.filepath = os.path.join(OUT, f"keychain-{v}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER", sc.render.filepath)
