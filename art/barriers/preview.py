"""Quick Blender review renders of the barrier props (not evidence: the engine shots are), each on a grass plane with a
character-height post beside it for scale, from the game camera's angle and a low three-quarter.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/barriers/preview.py -- <out_dir> [id ...]
"""
import bpy, math, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402
from cafekit import G  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT, ONLY = ARGS[0], ARGS[1:]
os.makedirs(OUT, exist_ok=True)
IDS = ONLY or ["unbuilt-bridge", "forest-edge", "ruins-rubble", "rockslide"]


def stage():
    K.reset()
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    scene.render.resolution_x, scene.render.resolution_y = 960, 640
    w = bpy.data.worlds.new("W")
    scene.world = w
    w.use_nodes = True
    next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (0.62, 0.74, 0.84, 1)
    bpy.ops.mesh.primitive_plane_add(size=30, location=G(0, 0, 0))
    m = bpy.data.materials.new("Grass")
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.22, 0.36, 0.12, 1)
    b.inputs["Roughness"].default_value = 1
    bpy.context.active_object.data.materials.append(m)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=1.36, location=G(-3.0, 0.68, -0.5))     # a character's height
    sun = bpy.data.lights.new("S", "SUN")
    sun.energy = 3.0
    so = bpy.data.objects.new("S", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-30))
    return scene


def cam(scene, at, look, name, lens=32):
    c = bpy.data.cameras.new("C")
    c.lens = lens
    o = bpy.data.objects.new("C", c)
    scene.collection.objects.link(o)
    o.location = G(*at)
    o.rotation_euler = (G(*look) - o.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = o
    scene.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER", name)


for mid in IDS:
    scene = stage()
    bpy.ops.import_scene.gltf(filepath=os.path.join(K.ROOT, "web", "public", "assets", "game", "props", f"{mid}.glb"))
    cam(scene, (0, 6.5, -10.5), (0, 0.6, 0), f"{mid}-game")
    cam(scene, (-5.5, 2.0, -5.5), (0, 0.7, 0), f"{mid}-low", lens=30)
