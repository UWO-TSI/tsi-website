"""Fit a Meshy rod into the old rod GLB's frame (rod-meshy lane).
blender -b --factory-startup -P fit.py -- <meshy.glb> <old.glb> <out.glb> '<json opts>'
opts: name, length (target glTF Y length, default old), tex (px), preset (material name), decimate (target tris),
      reel_deg (extra turn about the axis), split_green (path: leaf faces exported there), polished (bool)
"""
import bpy, bmesh, sys, json, math
import numpy as np
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index("--")+1:]
src, old, out, o = a[0], a[1], a[2], json.loads(a[3])
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
# the old rod: its frame and scene extras
bpy.ops.import_scene.gltf(filepath=old)
oobs = [ob for ob in sc.objects if ob.type == "MESH"]
pts = [ob.matrix_world @ Vector(c) for ob in oobs for c in ob.bound_box]
omin = min(p.z for p in pts); omax = max(p.z for p in pts)
props = {k: sc[k] for k in sc.keys() if k in ("rodFx", "fxRoom")}
print("OLD", round(omin, 4), round(omax, 4), props)
for ob in list(sc.objects): bpy.data.objects.remove(ob)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
# the Meshy model, one mesh
bpy.ops.import_scene.gltf(filepath=src)
ms = [ob for ob in sc.objects if ob.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for ob in ms: ob.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
rod = bpy.context.view_layer.objects.active
for ob in list(sc.objects):
    if ob != rod: bpy.data.objects.remove(ob)
rod.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = rod.data
def V():
    v = np.zeros(len(me.vertices)*3); me.vertices.foreach_get("co", v); return v.reshape(-1, 3)
v = V(); zmin, zmax = v[:,2].min(), v[:,2].max(); L = zmax - zmin
band = lambda lo, hi: v[(v[:,2] >= zmin+lo*L) & (v[:,2] <= zmin+hi*L)]
ax = np.median(band(0.45, 0.75)[:, :2], axis=0)
low = band(0.03, 0.4)[:, :2] - ax; d = np.linalg.norm(low, axis=1)
w = d**2; dirv = (low * w[:, None]).sum(0) / w.sum()
th = math.atan2(dirv[1], dirv[0])
turn = -math.pi/2 + math.radians(o.get("reel_deg", 0))
length = o.get("length", omax - omin); s = length / L
M = Matrix.Translation((0, 0, omin)) @ Matrix.Scale(s, 4) @ Matrix.Rotation(turn, 4, "Z") @ Matrix.Translation((-ax[0], -ax[1], -zmin))
me.transform(M); me.update()
if o.get("mirror"):
    me.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
print("FIT reel_angle_deg", round(math.degrees(th), 1), "scale", round(s, 4), "length", round(length, 4))
if o.get("decimate"):
    tris = sum(len(p.vertices)-2 for p in me.polygons)
    m = rod.modifiers.new("d", "DECIMATE"); m.ratio = o["decimate"]/tris
    bpy.ops.object.modifier_apply(modifier="d")
# material: base colour only, resized
img = None
for mat in me.materials:
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and img is None:
            for l in n.outputs[0].links:
                if l.to_socket.name == "Base Color": img = n.image
tex = o.get("tex", 512)
img.scale(tex, tex); img.name = o["name"] + "-tex"; img.pack()
mat = bpy.data.materials.new(o.get("preset", "P_Paint")); mat.use_nodes = True
nt = mat.node_tree; bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
t = nt.nodes.new("ShaderNodeTexImage"); t.image = img; nt.links.new(t.outputs[0], bsdf.inputs["Base Color"])
if o.get("polished"): bsdf.inputs["Metallic"].default_value = 0.85; bsdf.inputs["Roughness"].default_value = 0.26
else: bsdf.inputs["Metallic"].default_value = 0; bsdf.inputs["Roughness"].default_value = 0.5
me.materials.clear(); me.materials.append(mat)
rod.name = me.name = "rod-" + o["name"]
for k, val in props.items(): sc[k] = val
def stats(ob):
    vv = np.array([ob.matrix_world @ x.co for x in ob.data.vertices])
    return sum(len(p.vertices)-2 for p in ob.data.polygons), vv.min(0).round(4).tolist(), vv.max(0).round(4).tolist()
# leaves out to their own file (the Cedar's swaying boughs)
if o.get("split_green"):
    px = np.array(img.pixels[:]).reshape(tex, tex, 4)
    uv = me.uv_layers.active.data
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); uvl = bm.loops.layers.uv.active
    green = []
    for f in bm.faces:
        u = sum((l[uvl].uv for l in f.loops), Vector((0, 0))) / len(f.loops)
        r, g, b, _ = px[min(tex-1, max(0, int(u.y*tex))), min(tex-1, max(0, int(u.x*tex)))]
        if g > r*1.12 and g > b*1.25: green.append(f.index)
    bm.free()
    gs = set(green); print("GREEN", len(gs), "of", len(me.polygons))
    for x in me.vertices: x.select = False
    for x in me.edges: x.select = False
    for p in me.polygons: p.select = p.index in gs
    for p in me.polygons:
        if p.select:
            for i in p.vertices: me.vertices[i].select = True
    bpy.context.view_layer.objects.active = rod; rod.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    leaf = next(ob for ob in sc.objects if ob != rod); leaf.name = leaf.data.name = "Boughs"
    print("LEAVES", stats(leaf))
    bpy.ops.object.select_all(action="DESELECT"); leaf.select_set(True)
    bpy.ops.export_scene.gltf(filepath=o["split_green"], export_format="GLB", use_selection=True, export_extras=True, export_image_format="JPEG", export_jpeg_quality=88)
    bpy.data.objects.remove(leaf)
print("ROD", stats(rod))
# radius profile near the tip, for anchors (lighthouse lamp)
vv = np.array([x.co for x in me.vertices]); zz = vv[:, 2]; r = np.linalg.norm(vv[:, :2], axis=1)
top = zz.max()
prof = []
for i in range(24):
    z0 = top - (i+1)*0.01; m = (zz >= z0) & (zz < z0+0.01)
    if m.any(): prof.append((round(z0+0.005, 3), round(float(r[m].max()), 4)))
print("PROFILE", prof)
bpy.ops.object.select_all(action="DESELECT"); rod.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_extras=True, export_image_format="JPEG", export_jpeg_quality=88)
print("WROTE", out)
