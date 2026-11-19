"""rod-titanium round 2: the Titanium in a studio. Runs after build_rods.py in the same Blender, on the rods it made:

  Blender -b --factory-startup -P art/pipeline/build_rods.py -P specs/evidence/rod-titanium/r2/studio.py -- \
      only titanium,titanium-a1 studio <dir> [turn <frames>] [open <frames>] [pair <old glb> <frames>]

Under three long soft boxes in a dim warm room (polished metal shows what it reflects), its material as exported
(P_Polished with its thin film) and its effect lit as the game draws it. Each rod on the diagonal as the metal
reference's bar is (`<key>-studio.png`); `turn` turns it about its own axis, the light sliding over it; `open` the
awakened rod opening from its `Closed` shape while it turns a little; `pair` the closed rod upright beside the old one
(a GLB), both turning. Frames are numbered PNGs for ffmpeg.
"""
import bpy, math, os, sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[ARGS.index("studio") + 1]
num = lambda k: int(ARGS[ARGS.index(k) + 1]) if k in ARGS else 0
TURN, OPEN = num("turn"), num("open")
NAMES = {"titanium": "rod-titanium", "titanium-a1": "rod-titanium-a1"}
FX = {"titanium": [], "titanium-a1": ["Core", "Rings"]}
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
bg.inputs[0].default_value = (0.16, 0.13, 0.12, 1)
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
for o in sc.objects:                             # the effect's light as the game draws it: unlit, in its colour
    if o.type == "MESH":
        for m in o.data.materials:
            if "Glow" in m.name:
                bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                bs.inputs["Emission Color"].default_value = bs.inputs["Base Color"].default_value
                bs.inputs["Emission Strength"].default_value = 4.0
pivot = bpy.data.objects.new("Pivot", None)
sc.collection.objects.link(pivot)


def shoot(path, w_, h):
    sc.render.resolution_x, sc.render.resolution_y = w_, h
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def show(objs):
    for o in sc.objects:
        if o.type in ("MESH", "EMPTY") and o is not pivot:
            o.hide_render = o not in objs


def closed(rod, v):
    if rod.data.shape_keys:
        rod.data.shape_keys.key_blocks["Closed"].value = v


# On the diagonal, the point to the lower left as the reference's is.
pivot.rotation_euler = (0, math.radians(-118), 0)
cam.location = (0, -2.35, 0.55)
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
for key, name in NAMES.items():
    rod = bpy.data.objects.get(name)
    if rod is None:
        continue
    keep = [rod] + [bpy.data.objects[n] for n in FX[key] if n in bpy.data.objects]
    show(keep)
    for o in keep[1:]:
        o.parent = rod
    rod.parent, rod.location = pivot, (0, 0, -0.38)
    shoot(os.path.join(OUT, f"{key}-studio.png"), 1000, 830)
    for i in range(TURN):
        rod.rotation_euler = (0, 0, math.tau * i / TURN)
        shoot(os.path.join(OUT, f"{key}-turn-{i:03d}.png"), 800, 664)
    for i in range(OPEN if rod.data.shape_keys else 0):
        t = i / max(1, OPEN - 1)
        closed(rod, 1.0 - min(1.0, max(0.0, (t - 0.2) / 0.5)) ** 0.5)   # shut a moment, then the plates part
        rod.rotation_euler = (0, 0, 0.6 * t)
        shoot(os.path.join(OUT, f"{key}-open-{i:03d}.png"), 800, 664)
    closed(rod, 0.0)
    rod.rotation_euler = (0, 0, 0)
    rod.parent = None
    print("STUDIO_OK", key)

if "pair" in ARGS:                               # the closed rod upright beside the old one, turning together
    i = ARGS.index("pair")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=ARGS[i + 1])
    old = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    for o in old:                                # its palette as it shipped (the importer leaves its parts pale)
        for m in o.data.materials:
            hexc = next((c for k, c in (("Slate", "#5A6474"), ("Dark", "#2D323C"), ("Lilac", "#CDB6EE")) if k in m.name), None)
            if hexc:
                m.node_tree.nodes.clear()
                bs, out = m.node_tree.nodes.new("ShaderNodeBsdfPrincipled"), m.node_tree.nodes.new("ShaderNodeOutputMaterial")
                bs.inputs["Base Color"].default_value = (*kit.lin(hexc), 1)
                bs.inputs["Roughness"].default_value = 0.6
                m.node_tree.links.new(bs.outputs[0], out.inputs[0])
    new = bpy.data.objects["rod-titanium"]
    holders = []
    for objs, x in ((old, -0.16), ([new], 0.16)):
        h = bpy.data.objects.new("Hold", None)
        sc.collection.objects.link(h)
        h.location = (x, 0, -0.38)
        for o in objs:
            o.parent, o.location = h, (0, 0, 0)
        holders.append(h)
    show(old + [new] + holders)
    cam.location = (0, -2.6, 0.12)
    cam.rotation_euler = (Vector((0, 0, 0.02)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    n = int(ARGS[i + 2])
    for k in range(n):
        for h in holders:
            h.rotation_euler = (0, 0, math.tau * k / n)
        shoot(os.path.join(OUT, f"pair-{k:03d}.png"), 900, 900)
    print("STUDIO_OK pair")
