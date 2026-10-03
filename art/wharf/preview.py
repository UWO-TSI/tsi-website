"""Quick Blender review renders of the pier (not evidence: the engine shots are), over a translucent sea plane at the
water line, with the boat moored where the engine moors it.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/preview.py -- <out_dir>
"""
import bpy, math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402
from cafekit import G  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
K.reset()
scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
scene.render.resolution_x, scene.render.resolution_y = 1280, 760
w = bpy.data.worlds.new("W")
scene.world = w
w.use_nodes = True
next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (0.55, 0.7, 0.82, 1)
bpy.ops.import_scene.gltf(filepath=os.path.join(K.ROOT, "web", "public", "assets", "game", "wharf", "pier.glb"))
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(K.ROOT, "web", "public", "assets", "acnh", "props", "boat.glb"))
for o in set(bpy.data.objects) - before:
    if o.parent is None:
        o.scale = (0.1, 0.1, 0.1)
        o.location = G(2.18, -0.078 - 0.4, -3.0)
bpy.ops.mesh.primitive_plane_add(size=40, location=G(0, -0.078, 0))
sea = bpy.context.active_object
m = bpy.data.materials.new("Sea")
m.use_nodes = True
b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
b.inputs["Base Color"].default_value = (0.1, 0.45, 0.55, 1)
b.inputs["Alpha"].default_value = 0.55
b.inputs["Roughness"].default_value = 0.4
m.surface_render_method = "BLENDED"
sea.data.materials.append(m)
bpy.ops.mesh.primitive_plane_add(size=40, location=G(0, -1.3, 0))
bed = bpy.context.active_object
mb = bpy.data.materials.new("Bed")
mb.use_nodes = True
next(n for n in mb.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.75, 0.68, 0.5, 1)
bed.data.materials.append(mb)
sun = bpy.data.lights.new("S", "SUN")
sun.energy = 3.2
so = bpy.data.objects.new("S", sun)
scene.collection.objects.link(so)
so.rotation_euler = (math.radians(48), 0, math.radians(-35))


def cam(at, look, lens=30, name="shot"):
    c = bpy.data.cameras.new("C")
    c.lens = lens
    o = bpy.data.objects.new("C", c)
    scene.collection.objects.link(o)
    o.location = G(*at)
    d = G(*look) - o.location
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.camera = o
    scene.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER", name)


cam((0, 7.4, -1.2 - 10.8), (0, 0.3, -1.2), name="game-view")
cam((-6.5, 2.4, -6.5), (0, 0.2, -1.4), lens=28, name="three-quarter")
cam((6.5, 1.6, -1.0), (0, 0.1, -1.4), lens=30, name="boat-side")
cam((0.2, 1.4, 3.6), (0, 0.4, -2.5), lens=26, name="walk-on")
cam((-1.6, 0.9, -5.4), (0.3, 0.3, -2.4), lens=30, name="tip")
