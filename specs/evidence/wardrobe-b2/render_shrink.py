"""Wardrobe batch 2 evidence: the four accessories David asked to shrink (#02 sprout, #17 apple stem, #19 paper horns,
#23 monkey ears), before and after, worn over the same hairstyle on the v10 head. Each accessory GLB as exported, its
own texture from the fixed-colour atlas (u - 2: the image repeats), the hair in one flat colour; Workbench, orthographic,
the same camera for both.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P specs/evidence/wardrobe-b2/render_shrink.py -- <out_dir> <label>=<glb> ...
  HAIR=<hair id> (default hair_ribbon_bob); the "before" GLBs come from git (git show eba8e59b:art/characters/...)
"""
import bpy, json, math, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ART = os.path.join(ROOT, "art", "characters")
sys.path.insert(0, os.path.join(ART, "base"))
from head_shape import HC  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT, ITEMS = ARGS[0], [a.split("=", 1) for a in ARGS[1:]]
os.makedirs(OUT, exist_ok=True)
PAL = json.load(open(os.path.join(ART, "palette.json")))
CAT = json.load(open(os.path.join(ART, "character_catalog.json")))
HAIR = os.environ.get("HAIR", "hair_ribbon_bob")


def srgb(hexs):
    return [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1.0]


bpy.ops.wm.open_mainfile(filepath=os.path.join(ART, "skull", "head.blend"))
sc = bpy.context.scene
for o in list(bpy.data.objects):
    if o.name != "V8_Head":
        bpy.data.objects.remove(o, do_unlink=True)
head = bpy.data.objects["V8_Head"]
head.hide_render = False
for lc in bpy.context.view_layer.layer_collection.children:
    lc.exclude = False


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


flat(head, PAL["skin"][3])          # the skin alone (the painted face is not what these frames check)
hair, _ = load(os.path.join(ART, next(p["glb"] for p in CAT["hair"] if p["id"] == HAIR)))
for o in hair:
    flat(o, PAL["hair"][1])
atlas = bpy.data.images.load(os.path.join(ART, "colour_atlas.png"))

sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "TEXTURE"
sc.render.resolution_x = sc.render.resolution_y = 360
sc.render.film_transparent = False
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
sc.collection.objects.link(cam)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 0.95
sc.camera = cam
centre = HC + Vector((0, 0, 0.12))
for label, path in ITEMS:
    meshes, new = load(path)
    for o in meshes:
        m = bpy.data.materials.new(label)
        m.use_nodes = True
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = atlas
        tex.extension = "REPEAT"                # u - 2: the atlas texel (Character.tsx)
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        m.node_tree.nodes.active = tex
        o.data.materials.clear()
        o.data.materials.append(m)
    for name, yaw in (("front", 0), ("34", 40)):
        a = math.radians(yaw)
        cam.location = centre + Vector((-math.sin(a) * 3, -math.cos(a) * 3, 0.0))
        cam.rotation_euler = (math.radians(90), 0, -a)
        sc.render.filepath = os.path.join(OUT, f"{label}_{name}.png")
        bpy.ops.render.render(write_still=True)
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
print("RENDER_SHRINK_OK", len(ITEMS))
