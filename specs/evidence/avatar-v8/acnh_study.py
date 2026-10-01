"""Render ACNH player hairs for the avatar v8 study (headless; study only, nothing here ships).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P specs/evidence/avatar-v8/acnh_study.py -- <out_dir> [ids...]

Blender 5 has no COLLADA importer, so this reads each PlayerHairNN.dae (one skinned mesh, one material) directly:
positions, normals, UVs and triangles. It prints the triangle count and bounds, and renders the hair (no head) with its
grey albedo (mHair_AlbGry) times the baked shading channel of mHair_Mix (red), tinted brown, matte, from the front,
3/4 and back. The models stay in ~/Downloads/Assets/Model; only the renders are kept.
"""
import bpy, math, os, sys
import xml.etree.ElementTree as ET
from mathutils import Vector

SRC = os.path.expanduser("~/Downloads/Assets/Model")
ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[0]
IDS = ARGS[1:] or [f"{i:02d}" for i in range(48)]
VIEWS = os.environ.get("VIEWS", "front,34,back").split(",")
SIZE = int(os.environ.get("SIZE", "320"))
NS = {"c": "http://www.collada.org/2005/11/COLLADASchema"}
os.makedirs(OUT, exist_ok=True)


def read_dae(path):
    root = ET.parse(path).getroot()
    geo = root.find(".//c:library_geometries/c:geometry", NS)
    mesh = geo.find("c:mesh", NS)
    src = {s.get("id"): [float(x) for x in s.find("c:float_array", NS).text.split()] for s in mesh.findall("c:source", NS)}
    vin = mesh.find("c:vertices/c:input[@semantic='POSITION']", NS).get("source")[1:]
    tri = mesh.find("c:triangles", NS)
    inputs = {i.get("semantic"): (int(i.get("offset")), i.get("source")[1:]) for i in tri.findall("c:input", NS)}
    stride = max(o for o, _ in inputs.values()) + 1
    p = [int(x) for x in tri.find("c:p", NS).text.split()]
    pos = src[vin]
    uv = src[inputs["TEXCOORD"][1]] if "TEXCOORD" in inputs else None
    verts = [Vector(pos[i:i + 3]) for i in range(0, len(pos), 3)]
    faces, uvs = [], []
    for t in range(0, len(p), 3 * stride):
        idx = [p[t + k * stride + inputs["VERTEX"][0]] for k in range(3)]
        faces.append(idx)
        if uv:
            o = inputs["TEXCOORD"][0]
            uvs.append([(uv[2 * p[t + k * stride + o]], uv[2 * p[t + k * stride + o] + 1]) for k in range(3)])
    return verts, faces, uvs


def material(folder):
    if not os.path.exists(os.path.join(folder, "mHair_AlbGry.png")):      # a few hairs share another's textures
        folder = os.path.join(SRC, "PlayerHair00.Nin_NX_NVN")
    m = bpy.data.materials.new("hair")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    nt.links.new(diff.outputs[0], out.inputs[0])
    alb = nt.nodes.new("ShaderNodeTexImage")
    alb.image = bpy.data.images.load(os.path.join(folder, "mHair_AlbGry.png"))
    mix = nt.nodes.new("ShaderNodeTexImage")
    mix.image = bpy.data.images.load(os.path.join(folder, "mHair_Mix.png"))
    for im in (alb.image, mix.image):
        im.colorspace_settings.name = "Non-Color"
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(mix.outputs[0], sep.inputs[0])
    m1 = nt.nodes.new("ShaderNodeMix"); m1.data_type = "RGBA"; m1.blend_type = "MULTIPLY"; m1.inputs["Factor"].default_value = 1
    m2 = nt.nodes.new("ShaderNodeMix"); m2.data_type = "RGBA"; m2.blend_type = "MULTIPLY"; m2.inputs["Factor"].default_value = 1
    nt.links.new(alb.outputs[0], m1.inputs[6])
    nt.links.new(sep.outputs[0], m1.inputs[7])
    nt.links.new(m1.outputs[2], m2.inputs[6])
    m2.inputs[7].default_value = (0.32, 0.12, 0.05, 1)          # a mid brown, like the bench's hair colour
    nt.links.new(m2.outputs[2], diff.inputs[0])
    return m


def build(hid):
    folder = os.path.join(SRC, f"PlayerHair{hid}.Nin_NX_NVN")
    verts, faces, uvs = read_dae(os.path.join(folder, f"PlayerHair{hid}.dae"))
    me = bpy.data.meshes.new(hid)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    if uvs:
        ul = me.uv_layers.new(name="UV")
        for poly, tuv in zip(me.polygons, uvs):
            for li, uv in zip(poly.loop_indices, tuv):
                ul.data[li].uv = (uv[0], 1 - uv[1])
    me.shade_smooth()
    ob = bpy.data.objects.new(hid, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = (math.pi / 2, 0, 0)                     # Y up -> Blender Z up
    me.materials.append(material(folder))
    bpy.context.view_layer.update()
    bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    print(f"ACNH PlayerHair{hid} tris={len(faces)} verts={len(verts)} size={tuple(round(x, 2) for x in hi - lo)}")
    return ob, (lo + hi) / 2, max((hi - lo).x, (hi - lo).y, (hi - lo).z)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
try:
    sc.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
sc.view_settings.view_transform = "Standard"
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.film_transparent = False
w = bpy.data.worlds.new("W")
sc.world = w
w.use_nodes = True
next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (0.95, 0.92, 0.86, 1)
next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[1].default_value = 0.9
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.6
sun.rotation_euler = (math.radians(40), 0, math.radians(-30))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 60
sc.collection.objects.link(cam)
sc.camera = cam
for hid in IDS:
    ob, c, size = build(hid)
    for view in VIEWS:
        yaw = {"front": 0.0, "34": -35.0, "back": 180.0, "side": -90.0}[view]
        d = size * 2.3
        a = math.radians(yaw)
        cam.location = c + Vector((math.sin(a) * d, -math.cos(a) * d, size * 0.25))
        cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"acnh-{hid}-{view}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(ob, do_unlink=True)
print("ACNH_STUDY_OK")
