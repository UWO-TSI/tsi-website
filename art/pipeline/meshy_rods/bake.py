"""Rebake the Meshy hi model's colour onto the Meshy remesh with fresh UVs (rod-meshy).
blender -b --factory-startup -P bake.py -- <hi.glb> <lo.glb> <out.glb> <px> [decimate_tris]
With decimate_tris, the low mesh is the hi mesh decimated in Blender (lo.glb ignored)."""
import bpy, sys
a = sys.argv[sys.argv.index("--")+1:]
hi_p, lo_p, out, px = a[0], a[1], a[2], int(a[3])
dec = int(a[4]) if len(a) > 4 else 0
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def load(p):
    before = set(sc.objects); bpy.ops.import_scene.gltf(filepath=p)
    ms = [o for o in set(sc.objects) - before if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    if len(ms) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for x in set(sc.objects) - before:
        if x != o: bpy.data.objects.remove(x)
    return o
hi = load(hi_p)
if dec:
    lo = hi.copy(); lo.data = hi.data.copy(); sc.collection.objects.link(lo)
    tris = sum(len(p.vertices)-2 for p in lo.data.polygons)
    m = lo.modifiers.new("d", "DECIMATE"); m.ratio = dec/tris
    bpy.ops.object.select_all(action="DESELECT"); lo.select_set(True); bpy.context.view_layer.objects.active = lo
    bpy.ops.object.modifier_apply(modifier="d")
else:
    lo = load(lo_p)
lo.name = "lo"
me = lo.data
while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
me.uv_layers.new(name="UVMap")
bpy.ops.object.select_all(action="DESELECT"); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
img = bpy.data.images.new("bake", px, px, alpha=False)
mat = bpy.data.materials.new("Baked"); mat.use_nodes = True
t = mat.node_tree.nodes.new("ShaderNodeTexImage"); t.image = img
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
mat.node_tree.links.new(t.outputs[0], bsdf.inputs["Base Color"])
mat.node_tree.nodes.active = t; t.select = True
me.materials.clear(); me.materials.append(mat)
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 4
L = max(lo.dimensions)
bpy.ops.object.select_all(action="DESELECT"); hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True,
                    cage_extrusion=L*0.01, max_ray_distance=L*0.02, margin=6)
img.pack()
bpy.data.objects.remove(hi)
bpy.ops.object.select_all(action="DESELECT"); lo.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True)
print("BAKED", out, sum(len(p.vertices)-2 for p in me.polygons))
