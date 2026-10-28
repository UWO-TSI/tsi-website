"""Fit renders (clothing-v2): each garment on the base body, front, side and back, in a run, a jump and a sit.

  [FIT_ROOT=<art/characters tree>] /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      -P art/characters/outfits/render_fit.py -- <frames_dir> [ids ...]
  python3 art/characters/outfits/fit_sheet.py <frames_dir> <out.png> [ids ...]

Parts come from their GLBs bound to the clip base's rig by bone name, the body drawn as the engine draws it: its skin
only (the base tee and shorts left out), less the triangles the worn garments cut (`_BODYCUT`, hidden_cut.py bodycut), and a
garment's design painted over its tint (`design`, build_outfits.py). Each garment is worn with plain companions so it
reads on its own: a top over the shorts, a bottom under the tee, shoes under the tee and shorts. Framed on the body,
no hair (it would hide the back of a top).
"""
import bpy, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import kit  # noqa: E402

# FIT_ROOT: another art/characters tree (the catalogue, the clip base and the outfit GLBs), e.g. the last commit's, for "before"
ROOT = os.environ.get("FIT_ROOT", os.path.dirname(HERE))

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT, ONLY = ARGS[0], ARGS[1:]
os.makedirs(OUT, exist_ok=True)
CAT = json.load(open(os.path.join(ROOT, "character_catalog.json")))
PARTS = {p["id"]: p for p in CAT["outfits"]}
DESIGNS = CAT.get("designs")
PAL = json.load(open(os.path.join(ROOT, "palette.json")))
COMPANION = {"top": ["bottom_shorts", "shoes_slipon"], "bottom": ["top_tee", "shoes_slipon"], "shoes": ["top_tee", "bottom_shorts"],
             "onepiece": ["shoes_slipon"]}
POSES = [("run", "Run", 0.3), ("jump", "Jump", 0.5), ("sit", "Sit", 0.5)]
VIEWS = [("front", 0), ("side", -90), ("back", 180)]

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, CAT["base"]["clips_glb"]))
rig = next(o for o in sc.objects if o.type == "ARMATURE")
for o in list(sc.objects):
    if o.type == "MESH" and o.name in ("V6_Top", "V6_Bottom", "V6_HairBangs", "V6_HairBack", "Icosphere"):
        bpy.data.objects.remove(o, do_unlink=True)
BODY = bpy.data.objects["V6_Body"]
BODY_ME = BODY.data.copy()
turn = bpy.data.objects.new("Turn", None)
sc.collection.objects.link(turn)
rig.parent = turn
kit.render_setup(sc, bg=(0.86, 0.89, 0.9, 1))
cd = bpy.data.cameras.new("Cam")
cd.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cd)
sc.collection.objects.link(cam)
sc.camera = cam
try:
    sc.eevee.taa_render_samples = 16
except AttributeError:
    pass


def use_action(name, t):
    ad = rig.animation_data or rig.animation_data_create()
    act = bpy.data.actions[name]
    ad.action = act
    if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
        ad.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    sc.frame_set(round(f0 + (f1 - f0) * t))


def shot(path, yaw):
    cd.ortho_scale = 0.78
    cam.location, cam.rotation_euler = (0, -4.0, 0.33), (math.radians(90), 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = 300, 340
    sc.render.film_transparent = False
    turn.rotation_euler = (0, 0, math.radians(yaw))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def design_image():
    if not DESIGNS:
        return None
    return bpy.data.images.load(os.path.join(ROOT, DESIGNS["atlas"]), check_existing=True)


def tint(objs, part):
    """Each material in the part's own catalogue colour (parts on one model share a GLB, built in one part's colours)."""
    cols = {m["name"]: PAL["outfit"][m["default"]] if m.get("tint") == "outfit" else m.get("color") for m in part["materials"]}
    for o in objs:
        for m in o.data.materials:
            c = m and cols.get(m.name.split(".")[0])
            if not c:
                continue
            # the glTF importer feeds Base Color from its factor times COLOR_0: set the factor, wherever it sits
            for n in m.node_tree.nodes:
                for i in n.inputs:
                    if i.type == "RGBA" and not i.is_linked and (n.type == "BSDF_PRINCIPLED" and i.name == "Base Color" or n.type != "BSDF_PRINCIPLED"):
                        i.default_value = (*kit.lin(c), 1)


def paint(objs, part):
    """The engine's design path in Blender: the design cell's texel over the tint, by its alpha (Character.tsx)."""
    cell = part.get("design")
    if cell is None:
        return
    img = design_image()
    u0, v0, s = DESIGNS["rects"][cell] if "rects" in DESIGNS else (     # the round 1 atlas (FIT_ROOT): a grid
        ((cell % DESIGNS["grid"] + DESIGNS["gutter"]) / DESIGNS["grid"], (cell // DESIGNS["grid"] + DESIGNS["gutter"]) / DESIGNS["grid"],
         (1 - 2 * DESIGNS["gutter"]) / DESIGNS["grid"]))
    for o in objs:
        for m in o.data.materials:
            if not m or m.name.split(".")[0] not in DESIGNS["materials"]:
                continue
            nt = m.node_tree
            bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            uv = nt.nodes.new("ShaderNodeUVMap")
            # glTF uv (u, v) -> atlas (u0 + u s, v0 + v s), flipped to Blender's v (1 - v)
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (s, s, 1)
            mp.inputs["Location"].default_value = (u0, 1 - v0 - s, 0)
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = img
            tex.interpolation = "Closest"
            nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
            nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            base_in = bs.inputs["Base Color"]
            src = base_in.links[0].from_socket if base_in.links else None
            if src:
                nt.links.new(src, mix.inputs[6])
            else:
                mix.inputs[6].default_value = base_in.default_value
            nt.links.new(tex.outputs["Color"], mix.inputs[7])
            nt.links.new(tex.outputs["Alpha"], mix.inputs["Factor"])
            nt.links.new(mix.outputs[2], base_in)


def cut_body(mask):
    """The engine's body cut: skin triangles all three of whose vertices carry a worn garment's bit are not drawn."""
    BODY.data = BODY_ME.copy()
    me = BODY.data
    att = me.attributes.get("_BODYCUT")
    if not att or not mask:
        return
    marks = np.array([int(round(d.value)) for d in att.data])
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    gone = [f for f in bm.faces if np.bitwise_and.reduce([marks[v.index] for v in f.verts] + [mask])]
    bmesh.ops.delete(bm, geom=gone, context="FACES_ONLY")
    bm.to_mesh(me)
    bm.free()


def wear(ids):
    objs = []
    mask = 0
    for pid in ids:
        p = PARTS[pid]
        got = kit.bind_glb(os.path.join(ROOT, p["glb"]), rig)
        for o in got:
            o.parent = rig
        tint(got, p)
        paint(got, p)
        objs += got
        if p.get("bodyCut") is not None:
            mask |= 1 << p["bodyCut"]
    cut_body(mask)
    kit.show_vertex_colors(sc)
    return objs


for pid, p in PARTS.items():
    if ONLY and pid not in ONLY:
        continue
    if p["slot"] not in COMPANION:
        continue
    objs = wear([pid] + [c for c in COMPANION[p["slot"]] if PARTS[c]["slot"] != p["slot"]])
    for pose, clip, t in POSES:
        use_action(clip, t)
        for view, yaw in VIEWS:
            shot(os.path.join(OUT, f"{pid}_{pose}_{view}.png"), yaw)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
print("RENDER_FIT_OK")
