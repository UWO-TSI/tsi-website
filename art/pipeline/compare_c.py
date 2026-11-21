"""A rod GLB (and its effect GLB) beside its sheet, for build_rods_c.py's part-by-part review (compare_sheet.py's hero
camera, plus the turnaround's rows), with COLOR_0 multiplied in as three.js does.

  Blender -b --factory-startup -P art/pipeline/compare_c.py -- <rod.glb> <fx.glb|-> <hero.png> <turnaround.png|-> <out-prefix>

Writes <out-prefix>-hero.png (the model at the hero's angle, then the sheet's hero) and, with a turnaround,
<out-prefix>-turn.png (side, top and three-quarter rows of the model, then the sheet's turnaround), 2560x720 each.
"""
import bpy, math, os, sys, subprocess
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "characters"))
import kit  # noqa: E402

rod, fx, hero, turn, out = sys.argv[sys.argv.index("--") + 1:][:5]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rod)
if fx != "-" and os.path.exists(fx):
    bpy.ops.import_scene.gltf(filepath=fx)
sc = bpy.context.scene
kit.show_vertex_colors(sc)
FACTORS = {}                                             # material name -> baseColorFactor, from the GLBs' JSON
for path in (rod, fx):
    if path != "-" and os.path.exists(path):
        import json, struct
        raw = open(path, "rb").read()
        js = json.loads(raw[20:20 + struct.unpack("<I", raw[12:16])[0]])
        for mm in js.get("materials", []):
            FACTORS[mm["name"]] = tuple(mm.get("pbrMetallicRoughness", {}).get("baseColorFactor", (1, 1, 1, 1)))
for o in sc.objects:                                     # an effect's Glow parts read as lit, as in the game
    if o.type == "MESH":
        for m in o.data.materials:
            if m and "Glow" in m.name:
                bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                col = FACTORS.get(m.name.split(".")[0], (1, 1, 1, 1))     # the glTF base colour factor, read from the file
                for l in list(bs.inputs["Base Color"].links):
                    m.node_tree.links.remove(l)
                bs.inputs["Emission Color"].default_value = col
                bs.inputs["Emission Strength"].default_value = 1.0    # unlit at its own colour, as MeshBasicMaterial draws it
                bs.inputs["Base Color"].default_value = (0, 0, 0, 1)
                bs.inputs["Specular IOR Level"].default_value = 0.0
meshes = [o for o in sc.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]

try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    sc.render.engine = "BLENDER_EEVEE"
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("W")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
sc.world = w
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.type = "ORTHO"
sc.collection.objects.link(cam)
sc.camera = cam
lights = []
for e in (3.0, 1.2):
    l = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    l.data.energy = e
    sc.collection.objects.link(l)
    lights.append(l)
# compare_sheet.py's hero: the rod turned by M, the camera 25 degrees above, its suns fixed in the world
M = Matrix.Rotation(math.radians(60), 3, "Y") @ Matrix.Rotation(math.radians(90), 3, "Z")
Mi = M.inverted()


def shot(fwd, up, fill, w_, h_, path, wide=False):
    """Orthographic along `fwd` with `up`, the model filling `fill` of the width (or of the height)."""
    fwd, up = Vector(fwd).normalized(), Vector(up)
    upn = (up - fwd * up.dot(fwd)).normalized()       # roll so that `up` is the image's up
    x = fwd.cross(upn)
    rot = Matrix((x, upn, -fwd)).transposed()
    loc = [rot.transposed() @ p for p in pts]
    xs, ys = [p.x for p in loc], [p.y for p in loc]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    ctr = rot @ Vector((cx, cy, 0)) + fwd * (sum(p.dot(fwd) for p in pts) / len(pts))
    cam.location = ctr - fwd * 10
    cam.rotation_euler = rot.to_euler()
    cam.data.ortho_scale = (max(xs) - min(xs)) / fill if wide else max((max(xs) - min(xs)) / fill, (max(ys) - min(ys)) / fill * w_ / h_)
    for l, r in zip(lights, ((math.radians(50), 0, math.radians(-30)), (math.radians(60), 0, math.radians(150)))):
        l.matrix_world = (Matrix((x, fwd, upn)).transposed() @ Euler(r).to_matrix()).to_4x4()   # the sheet's suns, turned with the camera
    sc.render.resolution_x, sc.render.resolution_y = w_, h_
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


tmp = out + "-tmp"
shot(Mi @ Vector((0, math.cos(math.radians(25)), -math.sin(math.radians(25)))), Mi @ Vector((0, 0, 1)), 0.88, 1280, 720, tmp + "-h.png")
subprocess.run(["magick", tmp + "-h.png", hero, "-resize", "x720", "+append", out + "-hero.png"], check=True)
if turn != "-":
    shot((1, 0, 0), (0, 1, 0), 0.84, 1280, 240, tmp + "-1.png", True)                    # side: crank toward you, tip right
    shot((0, -1, 0), (1, 0, 0), 0.84, 1280, 240, tmp + "-2.png", True)                   # top: the crank side down
    M3 = (Matrix.Rotation(math.radians(84), 3, "Y") @ Matrix.Rotation(math.radians(90), 3, "Z")).inverted()   # the sheet's third row: 6 degrees off level
    shot(M3 @ Vector((0, math.cos(math.radians(25)), -math.sin(math.radians(25)))), M3 @ Vector((0, 0, 1)), 0.75, 1280, 240, tmp + "-3.png", True)
    subprocess.run(["magick", tmp + "-1.png", tmp + "-2.png", tmp + "-3.png", "-append", turn, "-resize", "x720", "+append", out + "-turn.png"], check=True)
    # the close-up: the grip end, the first third of the rod, as the sheet's fourth row
    zs = [p.z for p in pts]
    lo = min(zs)
    allp, pts = pts, [o.matrix_world @ v.co for o in meshes for v in o.data.vertices if (o.matrix_world @ v.co).z < lo + 0.36 * (max(zs) - lo)]
    shot(M3 @ Vector((0, math.cos(math.radians(25)), -math.sin(math.radians(25)))), M3 @ Vector((0, 0, 1)), 0.9, 1280, 480, tmp + "-4.png")
    pts = allp
    subprocess.run(["magick", turn, "-crop", "1280x240+0+480", "+repage", "-resize", "200%", "-gravity", "center", "-crop", "1280x480+0+0", "+repage", tmp + "-5.png"], check=True)
    subprocess.run(["magick", tmp + "-4.png", tmp + "-5.png", "+append", out + "-close.png"], check=True)
    os.remove(tmp + "-5.png")
    os.remove(tmp + "-4.png")
    for k in "123":
        os.remove(f"{tmp}-{k}.png")
os.remove(tmp + "-h.png")
print("COMPARE_OK", out)
