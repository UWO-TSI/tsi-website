"""compare_sheet.py's hero render, plus the side view, with the effect lit roughly as the game draws it, for the rod
rebuild lane A (build_rods_a.py).

  Blender -b --factory-startup -P art/pipeline/compare_a.py -- <rod.glb> <fx.glb|-> <hero.png> <turnaround.png> <out.png> [fxonly]

Writes <out.png>: the concept hero beside the model at the hero's angle (as compare_sheet.py frames it), and under
them the turnaround's side view (its top row) beside the model side on (grip left, reel below, orthographic). The
effect's library materials stand in for the game's shaders: Water teal with foam at its edges, Foam white, Spray pale
drops, Glow and Light emitting; the Aura shells are hidden.
"""
import bpy, math, sys, os, subprocess
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index("--") + 1:]
rod, fx, hero, turn, out = a[:5]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rod)
rod_objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if "fxonly" in a:                                # the effect alone (on the rod's grey ghost)
    for o in rod_objs:
        o.hide_render = True
if fx != "-" and os.path.exists(fx):
    bpy.ops.import_scene.gltf(filepath=fx)
sc = bpy.context.scene


def emit(m, col, strength, edge_foam=False):
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    o = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    if edge_foam:                                # the Water: teal, white foam along both edges (uv x near 0 and 1)
        uv = nt.nodes.new("ShaderNodeUVMap")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(uv.outputs[0], sep.inputs[0])
        d = nt.nodes.new("ShaderNodeMath"); d.operation = "SUBTRACT"; d.inputs[1].default_value = 0.5
        nt.links.new(sep.outputs[0], d.inputs[0])
        ab = nt.nodes.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"
        nt.links.new(d.outputs[0], ab.inputs[0])
        st = nt.nodes.new("ShaderNodeMath"); st.operation = "GREATER_THAN"; st.inputs[1].default_value = 0.36
        nt.links.new(ab.outputs[0], st.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
        mix.inputs[6].default_value = col
        mix.inputs[7].default_value = (1, 1, 1, 1)
        nt.links.new(st.outputs[0], mix.inputs[0])
        nt.links.new(mix.outputs[2], em.inputs["Color"])
    else:
        em.inputs["Color"].default_value = col
    nt.links.new(em.outputs[0], o.inputs["Surface"])


for o in list(sc.objects):
    if o.type != "MESH" or o in rod_objs:
        continue
    for m in o.data.materials:
        if m is None:
            continue
        bs = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        col = tuple(bs.inputs["Base Color"].default_value) if bs else (1, 1, 1, 1)
        if bs and bs.inputs["Base Color"].links:   # the importer multiplies the colour by COLOR_0: find the factor
            src = bs.inputs["Base Color"].links[0].from_node
            for i in src.inputs:
                if i.type == "RGBA" and not i.links and tuple(i.default_value)[:3] != (1.0, 1.0, 1.0):
                    col = tuple(i.default_value)
        if "Aura" in m.name:
            o.hide_render = True
        elif "Water" in m.name:
            emit(m, col, 1.0, edge_foam=True)
        elif "Foam" in m.name:
            emit(m, (0.95, 1, 1, 1), 1.0)
        elif "Spray" in m.name:
            emit(m, (0.55, 0.9, 1.0, 1), 1.2)
        elif "Glow" in m.name:
            emit(m, col, 2.5)
        elif "Light" in m.name:
            emit(m, col, 1.8)

objs = [o for o in sc.objects if o.type == "MESH" and not o.hide_render]
root = bpy.data.objects.new("Root", None)
sc.collection.objects.link(root)
for o in list(sc.objects):
    if o.parent is None and o is not root:
        o.parent = root
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
cam.data.type = "ORTHO"
sc.collection.objects.link(cam)
sc.camera = cam
for rot, e in (((math.radians(50), 0, math.radians(-30)), 2.0), ((math.radians(60), 0, math.radians(150)), 0.7)):
    l = bpy.data.lights.new("Sun", "SUN"); l.energy = e
    lo = bpy.data.objects.new("Sun", l); lo.rotation_euler = rot; sc.collection.objects.link(lo)
w = bpy.data.worlds.new("W"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
sc.world = w
try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    sc.render.engine = "BLENDER_EEVEE"
sc.render.film_transparent = True             # the world lights softly; the white goes in behind
sc.view_settings.view_transform = "Standard"


def shoot(mat, el, path, w_, h_, fill):
    root.matrix_world = mat
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (mn + mx) / 2
    cam.data.ortho_scale = max((mx - mn).x, (mx - mn).z * w_ / h_) / fill
    e = math.radians(el)
    cam.location = ctr + Vector((0, -math.cos(e) * 10, math.sin(e) * 10))
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x, sc.render.resolution_y = w_, h_
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# the hero: as compare_sheet.py (side on, laid tip up right at 30 degrees, the camera 25 degrees above)
shoot(Matrix.Rotation(math.radians(60), 4, "Y") @ Matrix.Rotation(math.radians(90), 4, "Z"), 25, out + ".h.png", 1280, 1280, 0.8)
# the side: rod Z to +X (tip right), its -Y (the reel) down, seen from its -X side, as the turnaround's top row
side = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
shoot(side, 0, out + ".s.png", 1280, 240, 0.9)
t = out + ".t.png"
subprocess.run(["magick", turn, "-crop", "1280x200+0+0", "-background", "white", "-gravity", "center", "-extent", "1280x240", t], check=True)
for f in (out + ".h.png", out + ".s.png"):
    subprocess.run(["magick", f, "-background", "white", "-flatten", f], check=True)
subprocess.run(["magick", "(", hero, "-resize", "1280x1280", "-background", "white", "-gravity", "center", "-extent", "1280x1280", out + ".h.png", "+append", ")",
                "(", t, out + ".s.png", "+append", ")", "-append", out], check=True)
for f in (out + ".h.png", out + ".s.png", t):
    os.remove(f)
print("COMPARE_OK", out)
