"""Render a rod GLB (plus its fx GLB) as its concept sheets draw it, beside them, for part-by-part review (rod-rebuild-b).

  Blender -b --factory-startup -P art/pipeline/compare_turn_b.py -- <rod.glb> <fx.glb|-> <concept dir> <out.png> <f0> <length>

Top row: the concept's hero.png beside the model laid as the hero lays it (grip lower left, tip upper right, the crank
side toward you). Bottom row: turnaround.png beside the model as its first three rows draw it: the side (camera on the
crank side, -X, grip left, the reel hanging below), the top (from +Y, the crank side down) and a three-quarter. `f0` is
the rig Z of the sheet's butt (station 0) and `length` the rig length of stations 0 to 1, so the turnaround rows land
on the sheet's own pixels: butt at x 48, 1190 px long (a smaller length zooms in).
The materials draw as in the game (the glTF importer multiplies COLOR_0 in), Glow parts unlit and Light parts as light.
"""
import bpy, math, os, subprocess, sys
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index("--") + 1:]
rod, fx, concept, out, f0, length = a[0], a[1], a[2], a[3], float(a[4]), float(a[5])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rod)
if fx != "-" and os.path.exists(fx):
    bpy.ops.import_scene.gltf(filepath=fx)
sc = bpy.context.scene
done = set()
for o in sc.objects:
    if o.type != "MESH":
        continue
    for m in o.data.materials:
        if m is None or m.name in done:
            continue
        done.add(m.name)
        nt = m.node_tree
        bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        outn = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        base = bs.inputs["Base Color"]
        col = tuple(base.default_value)
        if base.links:                          # the importer multiplies COLOR_0 in already: the factor is the mix's other colour
            mixn = base.links[0].from_node
            col = next((tuple(i.default_value) for i in mixn.inputs if i.type == "RGBA" and not i.is_linked), col)
        if "Light" in m.name:                   # light: its colour at full brightness, half see-through (additive light vanishes on white)
            em, tr, mix = nt.nodes.new("ShaderNodeEmission"), nt.nodes.new("ShaderNodeBsdfTransparent"), nt.nodes.new("ShaderNodeMixShader")
            top = max(col[:3]) or 1.0
            em.inputs["Color"].default_value = (col[0] / top, col[1] / top, col[2] / top, 1)
            em.inputs["Strength"].default_value = 1.0
            mix.inputs[0].default_value = 0.4
            nt.links.new(tr.outputs[0], mix.inputs[1])
            nt.links.new(em.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], outn.inputs["Surface"])
            try:
                m.surface_render_method = "BLENDED"
            except (AttributeError, TypeError):
                pass
            continue
        if "Glow" in m.name:
            em = nt.nodes.new("ShaderNodeEmission")
            em.inputs["Color"].default_value = col
            em.inputs["Strength"].default_value = 2.5
            nt.links.new(em.outputs[0], outn.inputs["Surface"])
            continue
root = bpy.data.objects.new("Root", None)
sc.collection.objects.link(root)
for o in list(sc.objects):
    if o.parent is None and o is not root:
        o.parent = root
W = 1280
cam_d = bpy.data.cameras.new("Cam")
cam_d.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cam_d)
sc.collection.objects.link(cam)
sc.camera = cam
for rot, e in (((math.radians(50), 0, math.radians(-30)), 3.0), ((math.radians(60), 0, math.radians(150)), 1.2)):
    lt = bpy.data.lights.new("Sun", "SUN")
    lt.energy = e
    lo = bpy.data.objects.new("Sun", lt)
    lo.rotation_euler = rot
    sc.collection.objects.link(lo)
w = bpy.data.worlds.new("W")
sc.world = w
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND") if w.node_tree else None
if bg is None:
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (1, 1, 1, 1)
bg.inputs[1].default_value = 1.0
try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    sc.render.engine = "BLENDER_EEVEE"
sc.view_settings.view_transform = "Standard"
sc.render.film_transparent = True


def shoot(right, up, centre, scale, h, path):
    cam.matrix_world = Matrix((right, up, right.cross(up))).transposed().to_4x4()
    cam.location = centre + right.cross(up) * 5
    cam_d.ortho_scale = scale
    sc.render.resolution_x, sc.render.resolution_y = W, h
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# the hero: the rod laid at 28 degrees, grip lower left, the crank side (-X) toward the camera (from -Y), seen a little from above
A = math.radians(28)
root.matrix_world = Matrix(((0, -math.sin(A), math.cos(A)), (1, 0, 0), (0, math.cos(A), math.sin(A)))).to_4x4()
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in sc.objects if o.type == "MESH" and not any("Light" in m.name for m in o.data.materials)
       for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
el = math.radians(12)
right, up = Vector((1, 0, 0)), Vector((0, math.sin(el), math.cos(el)))
hero = out + ".hero.png"
shoot(right, up, (lo + hi) / 2, (hi.x - lo.x) / 0.84, 720, hero)
# the turnaround rows, the rod back on its own axes
root.matrix_world = Matrix.Identity(4)
bpy.context.view_layer.update()
PX = 1190.0 / length
zc = f0 + (W / 2 - 48) / PX
r3 = Matrix.Rotation(math.radians(7), 3, "X") @ Matrix.Rotation(math.radians(-12), 3, "Z") @ Matrix.Rotation(math.radians(22), 3, "Y")
rows = []
for name, right, up, h in (("side", Vector((0, 0, 1)), Vector((0, 1, 0)), 240), ("top", Vector((0, 0, 1)), Vector((1, 0, 0)), 240),
                           ("tq", r3 @ Vector((0, 0, 1)), r3 @ Vector((0, 1, 0)), 340)):
    f = f"{out}.{name}.png"
    shoot(right, up, Vector((0, 0, zc)), W / PX, h, f)
    rows.append(f)
model = out + ".model.png"
subprocess.run(["magick", "-size", "1280x720", "xc:white", rows[0], "-geometry", "+0-30", "-composite", rows[1], "-geometry", "+0+142",
                "-composite", rows[2], "-geometry", "+0+260", "-composite", model], check=True)
heroc = out + ".heroc.png"
subprocess.run(["magick", "-size", "1280x720", "xc:white", hero, "-composite", heroc], check=True)
subprocess.run(["magick", "(", os.path.join(concept, "hero.png"), "-resize", "1280x720!", heroc, "+append", ")",
                "(", os.path.join(concept, "turnaround.png"), "-resize", "1280x720!", model, "+append", ")", "-append", out], check=True)
for f in rows + [model, hero, heroc]:
    os.remove(f)
print("COMPARE_OK", out)
