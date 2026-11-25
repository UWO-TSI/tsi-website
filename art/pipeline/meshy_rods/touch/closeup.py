# blender -b -P closeup.py -- <src> <out.png> <z0> <z1> <fx,fy,fz> [res]: ortho close-up of the rod between z0 and z1
import bpy, sys
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index("--")+1:]
if a[0].endswith(".blend"): bpy.ops.wm.open_mainfile(filepath=a[0])
else: bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=a[0])
sc = bpy.context.scene; z0, z1 = float(a[2]), float(a[3]); f = Vector([float(x) for x in a[4].split(",")]).normalized()
res = int(a[5]) if len(a) > 5 else 1600
cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"; cam.ortho_scale = (z1-z0)
co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]; bg.inputs[0].default_value = (1, 1, 1, 1); bg.inputs[1].default_value = 0.55
l = bpy.data.lights.new("s", "SUN"); l.energy = 1.0; lo = bpy.data.objects.new("s", l); sc.collection.objects.link(lo)
r = sc.render; r.resolution_x = res; r.resolution_y = res*2//5; r.film_transparent = True
try: r.engine = "BLENDER_EEVEE_NEXT"
except TypeError: r.engine = "BLENDER_EEVEE"
sc.view_settings.view_transform = "Standard"
def look(fwd, up):
    fw = Vector(fwd).normalized(); u = Vector(up); rt = fw.cross(u).normalized(); u = rt.cross(fw)
    return Matrix((rt, u, -fw)).transposed().to_euler()
# rod horizontal on screen: camera up = a direction perpendicular to both f and z
up = -f.cross(Vector((0, 0, 1))).normalized()
cy = float(a[6]) if len(a) > 6 else 0.0
c = Vector((0, cy, (z0+z1)/2)); co.location = c - f*3; co.rotation_euler = look(f, up)
lo.rotation_euler = look(f + Vector((0.4, 0.3, -0.6)), (0, 0, 1))
r.filepath = a[1]; bpy.ops.render.render(write_still=True)
