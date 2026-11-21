"""blender -b --factory-startup -P cmp.py -- <rod.glb> <fx.glb|-> <outprefix> : side, top and 3/4 renders of a rod
(grip left, tip right), as the turnaround sheets draw it, effect included (Aura hidden)."""
import bpy, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index("--")+1:]
rod, fx, pre = a[0], a[1], a[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=rod)
rodobs = [ob for ob in sc.objects if ob.type == "MESH"]
if fx != "-": bpy.ops.import_scene.gltf(filepath=fx)
for ob in sc.objects:
    if ob.type == "MESH" and any("Aura" in (m.name if m else "") for m in ob.data.materials): ob.hide_render = True
obs = rodobs
pts = [ob.matrix_world @ Vector(c) for ob in obs for c in ob.bound_box]
mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
c = (mn+mx)/2; L = mx.z - mn.z
cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = L*1.06
co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (1,1,1,1); r_ = None; bg.inputs[1].default_value = 0.6
l = bpy.data.lights.new("s", "SUN"); l.energy = 1.2; lo = bpy.data.objects.new("s", l); sc.collection.objects.link(lo)
r = sc.render; r.resolution_x = 1400; r.resolution_y = 300; r.film_transparent = True
try: r.engine = "BLENDER_EEVEE_NEXT"
except TypeError: r.engine = "BLENDER_EEVEE"
sc.view_settings.view_transform = "Standard"
def look(fwd, up):
    f = Vector(fwd).normalized(); u = Vector(up); rt = f.cross(u).normalized(); u = rt.cross(f)
    M = Matrix((rt, u, -f)).transposed(); return M.to_euler()
views = {"side": ((1,0,0), (0,1,0)), "top": ((0,-1,0), (1,0,0)),
         "threequarter": ((math.cos(0.6), -math.sin(0.6), 0.12), (math.sin(0.6), math.cos(0.6), 0))}
for n, (f, u) in views.items():
    f = Vector(f).normalized(); co.location = c - f*3; co.rotation_euler = look(f, u)
    lo.rotation_euler = look(Vector(f) + Vector((0.3, -0.2, -0.4)), (0, 0, 1))
    r.filepath = f"{pre}-{n}.png"; bpy.ops.render.render(write_still=True)
print("CMP_OK", pre)
