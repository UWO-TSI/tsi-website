"""The hat cut's before and after (wardrobe batch 2; art/characters/hidden_cut.py hatcut, rig.ts cutIndex): each covering
hat over each hairstyle given, rendered whole and with the hair's triangles that carry the hat's `_HATCUT` bit on all
three vertices left out, as the engine leaves them out. Workbench, orthographic, the same camera and still pose for
both, so the frames compare pixel for pixel; prints how many pixels differ.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P specs/evidence/wardrobe-b2/render_hatcut.py -- <out_dir> <hair id> ...
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ART = os.path.join(ROOT, "art", "characters")
sys.path.insert(0, os.path.join(ART, "base"))
from head_shape import HC  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT, HAIRS = ARGS[0], ARGS[1:]
os.makedirs(OUT, exist_ok=True)
CAT = json.load(open(os.path.join(ART, "character_catalog.json")))
PAL = json.load(open(os.path.join(ART, "palette.json")))
HATS = [p for p in CAT["robloxAccessories"] + CAT["hair"] if p.get("coversHair")]


def srgb(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1.0]


bpy.ops.wm.open_mainfile(filepath=os.path.join(ART, "skull", "head.blend"))
sc = bpy.context.scene
for o in list(bpy.data.objects):
    if o.name != "V8_Head":
        bpy.data.objects.remove(o, do_unlink=True)
head = bpy.data.objects["V8_Head"]


def flat(ob, hexs):
    m = bpy.data.materials.new(ob.name + "_flat")
    m.diffuse_color = srgb(hexs)
    ob.data.materials.clear()
    ob.data.materials.append(m)


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == "ARMATURE":
            o.data.pose_position = "REST"
    return [o for o in new if o.type == "MESH"], new


flat(head, PAL["skin"][3])
atlas = bpy.data.images.load(os.path.join(ART, "colour_atlas.png"))
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "TEXTURE"
sc.render.resolution_x = sc.render.resolution_y = 300
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
sc.collection.objects.link(cam)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 1.05
sc.camera = cam
centre = HC + Vector((0, 0, 0.16))


def shoot(name):
    out = {}
    for view, yaw in (("front", 0), ("34", 40), ("back", 180)):
        a = math.radians(yaw)
        cam.location = centre + Vector((-math.sin(a) * 3, -math.cos(a) * 3, 0.0))
        cam.rotation_euler = (math.radians(90), 0, -a)
        sc.render.filepath = os.path.join(OUT, f"{name}_{view}.png")
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(sc.render.filepath)
        out[view] = np.array(img.pixels[:], np.float32).reshape(300, 300, 4)[..., :3].copy()
        bpy.data.images.remove(img)
    return out


report = []
for hid in HAIRS:
    part = next(p for p in CAT["hair"] if p["id"] == hid)
    for hat in HATS:
        hair, hnew = load(os.path.join(ART, part["glb"]))
        for o in hair:
            flat(o, PAL["hair"][1])
        meshes, new = load(os.path.join(ART, hat["glb"]))
        for o in meshes:
            m = bpy.data.materials.new("hat")
            m.use_nodes = True
            tex = m.node_tree.nodes.new("ShaderNodeTexImage")
            tex.image, tex.extension = atlas, "REPEAT"
            bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
            m.node_tree.nodes.active = tex
            o.data.materials.clear()
            o.data.materials.append(m)
        tag = f"{hid.replace('hair_', '')}+{hat['id'].replace('acc_', '')}"
        whole = shoot(f"{tag}_whole")
        cut = 0
        for o in hair:                         # the engine's cut: the hat's bit on all three vertices
            attr = o.data.attributes.get("_HATCUT")
            if attr is None:
                continue
            marks = np.array([d.value for d in attr.data], np.float64)
            bit = ((np.rint(marks).astype(np.int64) >> hat["hatCut"]) & 1).astype(bool)
            bm = bmesh.new()
            bm.from_mesh(o.data)
            drop = [f for f in bm.faces if all(bit[v.index] for v in f.verts)]
            cut += len(drop)
            bmesh.ops.delete(bm, geom=drop, context="FACES")
            bm.to_mesh(o.data)
            bm.free()
        after = shoot(f"{tag}_cut")
        diff = {v: int((np.abs(whole[v] - after[v]).max(-1) > 2 / 255).sum()) for v in whole}
        report.append({"hair": hid, "hat": hat["id"], "cut": cut, "pixels_changed": diff})
        print("HATCUT_RENDER", tag, "cut", cut, "pixels changed", diff)
        for o in hnew + new:
            bpy.data.objects.remove(o, do_unlink=True)
json.dump(report, open(os.path.join(OUT, "hatcut.json"), "w"), indent=1)
print("RENDER_HATCUT_OK", len(report))
