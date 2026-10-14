"""Head-roblox evidence renders (specs/characters/head-roblox.md): David's hairstyles as exported (hair/full/<id>.glb), on
the v9 head (skull/head.blend: the painted default face) and the base body, in rest pose, shaded as the engine shades
them: the palette tint x the shading map x gain from the shared atlas, the accent and cap colours by their masks, the
under-cap (u < 0) the tint at its COLOR_0. EEVEE, orthographic, front, 3/4, side and back.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P specs/evidence/head-roblox/render_hair.py -- <out_dir> <id>[:hair] ...
  (hair: a palette hair index; default 0)
"""
import bpy, json, math, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ART = os.path.join(ROOT, "art", "characters")
sys.path.insert(0, os.path.join(ART, "base"))
from head_shape import HC  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT, ITEMS = ARGS[0], ARGS[1:]
SKIN = int(os.environ.get("SKIN", 3))
RES = int(os.environ.get("RES", 420))
os.makedirs(OUT, exist_ok=True)
CAT = json.load(open(os.path.join(ART, "character_catalog.json")))
PAL = json.load(open(os.path.join(ART, "palette.json")))
HAIRS = {h["id"]: h for h in CAT["hair"]}
MAPS = CAT["hairMaps"]


def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


bpy.ops.wm.open_mainfile(filepath=os.path.join(ART, "skull", "head.blend"))
sc = bpy.context.scene
keep = {"V8_Head", "V6_Body", "V6_Top", "V6_Bottom", "CharacterRig"}
for o in list(bpy.data.objects):
    if o.name not in keep:
        bpy.data.objects.remove(o, do_unlink=True)
for lc in bpy.context.view_layer.layer_collection.children:
    lc.exclude = False
for o in bpy.data.objects:
    o.hide_set(False)
    o.hide_render = o.type != "MESH"
skin = lin(PAL["skin"][SKIN])
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if b is None:
        continue
    b.inputs["Roughness"].default_value = 0.9
    if m.name == "M_Skin":
        b.inputs["Base Color"].default_value = skin
    if m.name.startswith("M_Face"):       # the face layer over the skin colour (the engine's face shader)
        tex = next(n for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
        mix = m.node_tree.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs["A"].default_value = skin
        m.node_tree.links.new(tex.outputs["Alpha"], mix.inputs["Factor"])
        m.node_tree.links.new(tex.outputs["Color"], mix.inputs["B"])
        m.node_tree.links.new(mix.outputs["Result"], b.inputs["Base Color"])
        b.inputs["Alpha"].default_value = 1.0

atlas = bpy.data.images.load(os.path.join(ART, MAPS["atlas"]))
atlas.colorspace_settings.name = "Non-Color"


def hair_material(part, hair):
    m = bpy.data.materials.new("hair_" + part["id"])
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Roughness"].default_value = 0.85
    tint = lin(PAL["hair"][hair])
    uv = nt.nodes.new("ShaderNodeUVMap")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = atlas
    tex.interpolation = "Linear"
    nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
    chan = lambda k: sep.outputs[["Red", "Green", "Blue"][k]]
    mp = part.get("map")
    col_node = nt.nodes.new("ShaderNodeRGB")
    col_node.outputs[0].default_value = tint
    cur = col_node.outputs[0]
    if mp:
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        gain = nt.nodes.new("ShaderNodeMath")
        gain.operation = "MULTIPLY"
        gain.inputs[1].default_value = MAPS["gain"]
        nt.links.new(chan(mp["shade"]), gain.inputs[0])
        comb = nt.nodes.new("ShaderNodeCombineColor")
        for k in range(3):
            nt.links.new(gain.outputs[0], comb.inputs[k])
        nt.links.new(cur, mul.inputs["A"])
        nt.links.new(comb.outputs[0], mul.inputs["B"])
        cur = mul.outputs["Result"]
        for key, hexs in (("accent", (PAL["skin"][SKIN] if (part.get("accent") or {}).get("default") == "skin"
                                      else PAL["hair"][(part.get("accent") or {}).get("default", 0)] if part.get("accent") else None)),
                          ("cap", MAPS["cap"])):
            if key in mp and hexs:
                mix = nt.nodes.new("ShaderNodeMix")
                mix.data_type = "RGBA"
                c2 = nt.nodes.new("ShaderNodeRGB")
                c2.outputs[0].default_value = lin(hexs)
                cm = nt.nodes.new("ShaderNodeMix")
                cm.data_type = "RGBA"
                cm.blend_type = "MULTIPLY"
                cm.inputs["Factor"].default_value = 1.0
                nt.links.new(c2.outputs[0], cm.inputs["A"])
                nt.links.new(comb.outputs[0], cm.inputs["B"])
                nt.links.new(chan(mp[key]), mix.inputs["Factor"])
                nt.links.new(cur, mix.inputs["A"])
                nt.links.new(cm.outputs["Result"], mix.inputs["B"])
                cur = mix.outputs["Result"]
        # the under-cap: u < 0, the tint at 0.55
        sxy = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(uv.outputs["UV"], sxy.inputs["Vector"])
        lt = nt.nodes.new("ShaderNodeMath")
        lt.operation = "LESS_THAN"
        lt.inputs[1].default_value = 0.0
        nt.links.new(sxy.outputs["X"], lt.inputs[0])
        under = nt.nodes.new("ShaderNodeRGB")
        under.outputs[0].default_value = [x * 0.55 for x in tint[:3]] + [1]
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(lt.outputs[0], mix.inputs["Factor"])
        nt.links.new(cur, mix.inputs["A"])
        nt.links.new(under.outputs[0], mix.inputs["B"])
        cur = mix.outputs["Result"]
    nt.links.new(cur, b.inputs["Base Color"])
    return m


def load_part(rel):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ART, rel))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
        for md in list(o.modifiers):
            o.modifiers.remove(md)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    return meshes


for o in bpy.data.objects:
    if o.type == "MESH":
        for md in list(o.modifiers):
            o.modifiers.remove(md)
try:
    sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = RES
sc.render.film_transparent = False
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.84, 0.81, 0.75, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 1.1
sc.world = w
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.6
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = float(os.environ.get("FRAME", 0.95))
VIEWS = (("front", 0), ("34", 35), ("side", 90), ("back", 180))
for item in ITEMS:
    pid, _, hair = item.partition(":")
    part = HAIRS[pid]
    obs = load_part(part["glb"])
    mat = hair_material(part, int(hair or 0))
    for o in obs:
        o.data.materials.clear()
        o.data.materials.append(mat)
    for name, yaw in VIEWS:
        a = math.radians(yaw)
        target = HC + Vector((0, 0, float(os.environ.get("DZ", -0.12))))
        cam.location = target + Vector((-math.sin(a) * 4, -math.cos(a) * 4, 0.25))
        d = target - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        sun.rotation_euler = (math.radians(55), 0, -a + math.radians(-35))
        sc.render.filepath = os.path.join(OUT, f"{pid}_{name}.png")
        bpy.ops.render.render(write_still=True)
    for o in obs:
        bpy.data.objects.remove(o, do_unlink=True)
    print("RENDERED", pid)
