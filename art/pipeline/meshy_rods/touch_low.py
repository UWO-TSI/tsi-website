"""Cut-down game copy of a touched-up rod (rod-touchup round 2): the high GLB (2048, no triangle limit) to about
`tris` triangles with one 1024 colour texture baked from the high one; metal parts (P_Metal, the gold and silver
pieces) keep their own flat metal material, decimated on their own. Scene and node extras are kept.
blender -b --factory-startup -P touch_low.py -- <high.glb> <low.glb> <tris> [px=1024] [name]"""
import bpy, bmesh, sys, math
a = sys.argv[sys.argv.index("--")+1:]
src, out, target = a[0], a[1], int(a[2]); px = int(a[3]) if len(a) > 3 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
extras = {k: sc[k] for k in sc.keys() if k not in ("cycles",) and not k.startswith("_")}
for ob in list(sc.objects):
    if ob.type == "MESH":
        ob.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in sc.objects if o.type == "MESH")
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
meshes = [o for o in sc.objects if o.type == "MESH"]
def tris(o): return sum(len(p.vertices)-2 for p in o.data.polygons)
main = max(meshes, key=tris)                       # the Meshy body names the result and its material
node_props = {k: main[k] for k in main.keys() if not k.startswith("_")}
main_name, main_mat = main.name, main.data.materials[0].name.split(".")[0]
metal = [o for o in meshes if o.data.materials and o.data.materials[0].name.startswith("P_Metal")]
for o in meshes:                                   # the high materials step aside so the baked one takes the plain name
    if o not in metal:
        for ms in o.data.materials: ms.name = "hi-" + ms.name
rest = [o for o in meshes if o not in metal]
# the low body: copies of the non-metal parts, joined, welded, decimated
copies = []
for o in rest:
    c = o.copy(); c.data = o.data.copy(); sc.collection.objects.link(c); copies.append(c)
bpy.ops.object.select_all(action="DESELECT")
for c in copies: c.select_set(True)
bpy.context.view_layer.objects.active = copies[0]
if len(copies) > 1: bpy.ops.object.join()
lo = bpy.context.view_layer.objects.active
bm = bmesh.new(); bm.from_mesh(lo.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(lo.data); bm.free()
metal_tris = sum(tris(o) for o in metal)
keep_metal = min(metal_tris, max(300, int(target*0.08)))
body = target - keep_metal
m = lo.modifiers.new("d", "DECIMATE"); m.ratio = min(1.0, body/max(1, tris(lo)))
bpy.ops.object.modifier_apply(modifier="d")
me = lo.data
while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
me.uv_layers.new(name="UVMap")
bpy.ops.object.select_all(action="DESELECT"); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
img = bpy.data.images.new("tex", px, px, alpha=False)
mat = bpy.data.materials.new(main_mat); mat.use_nodes = True
t = mat.node_tree.nodes.new("ShaderNodeTexImage"); t.image = img
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
mat.node_tree.links.new(t.outputs[0], bsdf.inputs["Base Color"])
bm0 = next(n for n in main.data.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
for k in ("Metallic", "Roughness"): bsdf.inputs[k].default_value = bm0.inputs[k].default_value
mat.node_tree.nodes.active = t; t.select = True
me.materials.clear(); me.materials.append(mat)
for p_ in me.polygons: p_.use_smooth = True
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 1
for o in rest:                                      # bake the colour alone: metal off in the high copies
    for ms in o.data.materials:
        b = next((n for n in ms.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b: b.inputs["Metallic"].default_value = 0.0
bpy.ops.object.select_all(action="DESELECT")
for o in rest: o.select_set(True)
lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True,
                    cage_extrusion=0.003, max_ray_distance=0.008, margin=4)
img.pack()
for o in rest: bpy.data.objects.remove(o)
# metal parts: decimated on their own, their flat material kept
low_metal = []
if metal:
    bpy.ops.object.select_all(action="DESELECT")
    for o in metal: o.select_set(True)
    bpy.context.view_layer.objects.active = metal[0]
    if len(metal) > 1: bpy.ops.object.join()
    mo = bpy.context.view_layer.objects.active
    bm = bmesh.new(); bm.from_mesh(mo.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(mo.data); bm.free()
    if tris(mo) > keep_metal:
        d = mo.modifiers.new("d", "DECIMATE"); d.ratio = keep_metal/tris(mo); bpy.ops.object.modifier_apply(modifier="d")
    mo.name = mo.data.name = main_name + "-metal"; low_metal = [mo]
lo.name = lo.data.name = main_name
for k, v in node_props.items(): lo[k] = v
for k, v in extras.items(): sc[k] = v
bpy.ops.object.select_all(action="DESELECT")
for o in [lo] + low_metal: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_extras=True,
                          export_image_format="JPEG", export_jpeg_quality=70, export_image_quality=70)
print("LOW", out, "tris", tris(lo) + sum(tris(o) for o in low_metal), "metal", sum(tris(o) for o in low_metal))
