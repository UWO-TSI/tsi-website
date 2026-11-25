"""Step 3 prep (rod-touchup lane): the RAW Meshy rod fitted into the game frame as fit.py does, mirrored back,
plus a bake of every texel's object-space position so paint passes can pick regions by colour AND place.
blender -b --factory-startup -P touch_prep.py -- <raw.glb> <old.glb> <cur.glb> <outdir> '<json>'
  old.glb: the frame (min Y, length) fit.py used; cur.glb: the game GLB whose scene extras (rodFx, fxRoom) are kept.
  opts: length, reel_deg, mirror (default true)
Writes outdir/fit.blend, base.npy (2048x2048x4 sRGB floats, Blender row order), pos.npy (xyz, -9 = no texel)."""
import bpy, bmesh, sys, json, math, os
import numpy as np
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index("--")+1:]
src, old, cur, out, o = a[0], a[1], a[2], a[3], json.loads(a[4])
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def clear():
    for ob in list(sc.objects): bpy.data.objects.remove(ob)
bpy.ops.import_scene.gltf(filepath=old)
pts = [ob.matrix_world @ Vector(c) for ob in sc.objects if ob.type == "MESH" for c in ob.bound_box]
omin = min(p.z for p in pts); omax = max(p.z for p in pts); clear()
bpy.ops.import_scene.gltf(filepath=cur)
props = {k: sc[k] for k in sc.keys() if k in ("rodFx", "fxRoom")}; clear()
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
bpy.ops.import_scene.gltf(filepath=src)
ms = [ob for ob in sc.objects if ob.type == "MESH"]
for ob in ms: ob.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
rod = bpy.context.view_layer.objects.active
for ob in list(sc.objects):
    if ob != rod: bpy.data.objects.remove(ob)
rod.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = rod.data
v = np.zeros(len(me.vertices)*3); me.vertices.foreach_get("co", v); v = v.reshape(-1, 3)
zmin, zmax = v[:, 2].min(), v[:, 2].max(); L = zmax - zmin
band = lambda lo, hi: v[(v[:, 2] >= zmin+lo*L) & (v[:, 2] <= zmin+hi*L)]
ax = np.median(band(0.45, 0.75)[:, :2], axis=0)
turn = -math.pi/2 + math.radians(o.get("reel_deg", 0))
length = o.get("length", omax - omin); s = length / L
M = Matrix.Translation((0, 0, omin)) @ Matrix.Scale(s, 4) @ Matrix.Rotation(turn, 4, "Z") @ Matrix.Translation((-ax[0], -ax[1], -zmin))
me.transform(M)
if o.get("mirror", True):
    me.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
me.update()
print("FIT scale", round(s, 4), "length", round(length, 4), "omin", round(omin, 4), props)
for k, val in props.items(): rod[k] = val          # carried to build via the object
img = next(n.image for mat in me.materials for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
W, H = img.size
base = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4); np.save(f"{out}/base.npy", base)
# bake object-space position into a float image
pimg = bpy.data.images.new("pos", W, H, float_buffer=True, alpha=True)
pimg.pixels.foreach_set(np.full(W*H*4, -9.0, dtype=np.float32))
mat = me.materials[0]; nt = mat.node_tree
tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = pimg; nt.nodes.active = tn
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
outn = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
geo = nt.nodes.new("ShaderNodeNewGeometry"); em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(geo.outputs["Position"], em.inputs["Color"]); nt.links.new(em.outputs[0], outn.inputs["Surface"])
sc.render.engine = "CYCLES"; sc.cycles.samples = 1; sc.cycles.device = "CPU"
sc.render.bake.margin = 6; sc.view_settings.view_transform = "Standard"
rod.select_set(True); bpy.context.view_layer.objects.active = rod
bpy.ops.object.bake(type="EMIT", margin=6)
pos = np.array(pimg.pixels[:], dtype=np.float32).reshape(H, W, 4)[:, :, :3]
np.save(f"{out}/pos.npy", pos)
nt.links.new(bsdf.outputs[0], outn.inputs["Surface"]); nt.nodes.remove(tn); nt.nodes.remove(geo); nt.nodes.remove(em)
bpy.data.images.remove(pimg)
print("COVER", round(float((pos[:, :, 0] > -8).mean()), 3), "TRIS", sum(len(p.vertices)-2 for p in me.polygons))
bpy.ops.wm.save_as_mainfile(filepath=f"{out}/fit.blend")
print("PREP_OK", out)
