"""rod-titanium round 1: the Titanium rods in a studio, to set beside David's references (a photo and a painting).
Runs after build_rods.py in the same Blender, on the rods it just made:

  Blender -b --factory-startup -P art/pipeline/build_rods.py -P specs/evidence/rod-titanium/r1/studio.py -- \
      only titanium,titanium-a1 studio <dir> [turn <frames>]

Each rod lies on the diagonal as the metal reference's bar does, under three long soft boxes (so its flats and chamfers
catch sharp streaks the way polished metal does), its material as exported (P_Polished: metallic, low roughness, the
anodised colour in COLOR_0) and its effect lit as the game draws it (build_rods.lit_fx). `turn` renders it turning
about its own axis, the streaks sliding over the facets, as numbered frames for ffmpeg.
"""
import bpy, math, os, sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[ARGS.index("studio") + 1]
TURN = int(ARGS[ARGS.index("turn") + 1]) if "turn" in ARGS else 0
NAMES = {"titanium": "rod-titanium", "titanium-a1": "rod-titanium-a1"}
FACE = {"titanium": 0.0, "titanium-a1": 0.0}     # the turn that shows it best: the ridge, the plates' faces
sc = bpy.context.scene
os.makedirs(OUT, exist_ok=True)

try:
    sc.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
sc.view_settings.view_transform = "Standard"
sc.render.film_transparent = False
w = bpy.data.worlds.new("Studio")
sc.world = w
w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.16, 0.13, 0.12, 1)    # a dim warm room (the reference sits on brown leather)
bg.inputs[1].default_value = 1.0

for o in list(sc.objects):
    if o.type == "LIGHT":
        bpy.data.objects.remove(o)


def softbox(name, at, size, energy, aim=(0, 0, 0)):
    lamp = bpy.data.lights.new(name, "AREA")
    lamp.shape, lamp.size, lamp.size_y, lamp.energy = "RECTANGLE", size[0], size[1], energy
    ob = bpy.data.objects.new(name, lamp)
    sc.collection.objects.link(ob)
    ob.location = at
    ob.rotation_euler = (Vector(aim) - Vector(at)).to_track_quat("-Z", "Y").to_euler()
    return ob


softbox("Key", (0.6, -1.2, 1.6), (2.4, 0.18), 130)
softbox("Strip", (-1.4, -0.4, 0.9), (0.12, 2.6), 90)
softbox("Rim", (0.3, 1.5, 1.2), (2.0, 0.12), 110)
cam = bpy.data.objects.new("StudioCam", bpy.data.cameras.new("StudioCam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 70

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "art", "characters"))
import kit  # noqa: E402
kit.show_vertex_colors(sc)
FX = {"titanium": ["Glint"], "titanium-a1": ["Energy", "Core", "Blades"]}
for o in sc.objects:                             # the effect's light as the game draws it: unlit, in its colour
    if o.type == "MESH":
        for m in o.data.materials:
            if any(k in m.name for k in ("Glow", "Light")):
                bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                bs.inputs["Emission Color"].default_value = bs.inputs["Base Color"].default_value
                bs.inputs["Emission Strength"].default_value = 4.0
pivot = bpy.data.objects.new("Pivot", None)
sc.collection.objects.link(pivot)
pivot.rotation_euler = (0, math.radians(-118), 0)   # on the diagonal, the point to the lower left as the reference's is
cam.location = (0, -2.35, 0.55)
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()

for key, name in NAMES.items():
    rod = bpy.data.objects.get(name)
    if rod is None:
        continue
    keep = [rod] + [bpy.data.objects[n] for n in FX[key] if n in bpy.data.objects]
    for o in sc.objects:
        if o.type in ("MESH", "EMPTY") and o is not pivot:
            o.hide_render = o not in keep
    for o in keep[1:]:
        o.parent = rod
    rod.parent, rod.location = pivot, (0, 0, -0.38)
    sc.render.resolution_x, sc.render.resolution_y = 1000, 830
    rod.rotation_euler = (0, 0, FACE[key])
    sc.render.filepath = os.path.join(OUT, f"{key}-studio.png")
    bpy.ops.render.render(write_still=True)
    sc.render.resolution_x, sc.render.resolution_y = 800, 664
    for i in range(TURN):
        rod.rotation_euler = (0, 0, FACE[key] + math.tau * i / TURN)
        sc.render.filepath = os.path.join(OUT, f"{key}-turn-{i:03d}.png")
        bpy.ops.render.render(write_still=True)
    rod.rotation_euler = (0, 0, 0)
    print("STUDIO_OK", key)
