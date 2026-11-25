"""blender -b --factory-startup -P touch_view.py -- <rod.glb|.blend> <outprefix> [views] [fx.glb]: tip-up renders of a
fitted rod in raw.py's studio light (so they sit beside the raw renders). views: comma list of name=fx/fy/fz camera
directions (default the sheet's side, top and three-quarter for a fitted rod: reel toward -Y)."""
import bpy, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index("--")+1:]
if a[0].endswith(".blend"): bpy.ops.wm.open_mainfile(filepath=a[0])
else:
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=a[0])
sc = bpy.context.scene
if len(a) > 3 and a[3] != "-": bpy.ops.import_scene.gltf(filepath=a[3])
for ob in sc.objects:
    if ob.type == "MESH" and any("Aura" in (m.name if m else "") for m in ob.data.materials): ob.hide_render = True
obs = [o for o in sc.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
c = (mn+mx)/2; L = mx.z - mn.z
cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = L*1.04
co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = 0.55
l = bpy.data.lights.new("s", "SUN"); l.energy = 1.0; lo = bpy.data.objects.new("s", l); sc.collection.objects.link(lo)
import os; K = int(os.environ.get('RES', '1')); r = sc.render; r.resolution_y = 1600*K; r.resolution_x = 400*K; r.film_transparent = True
try: r.engine = "BLENDER_EEVEE_NEXT"
except TypeError: r.engine = "BLENDER_EEVEE"
sc.view_settings.view_transform = "Standard"
def look(fwd, up):
    f = Vector(fwd).normalized(); u = Vector(up); rt = f.cross(u).normalized(); u = rt.cross(f)
    return Matrix((rt, u, -f)).transposed().to_euler()
views = "side=1/0/0,top=0/1/0,threequarter=0.825/0.565/-0.15"
if len(a) > 2 and a[2] != "-": views = a[2]
for spec in views.split(","):
    n, f = spec.split("="); f = Vector([float(x) for x in f.split("/")]).normalized()
    co.location = c - f*3; co.rotation_euler = look(f, (0, 0, 1))
    lo.rotation_euler = look(f + Vector((0.4, 0.3, -0.6)), (0, 0, 1))
    r.filepath = f"{a[1]}-{n}.png"; bpy.ops.render.render(write_still=True)
print("VIEW_OK")
