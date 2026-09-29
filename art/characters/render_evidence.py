"""Evidence renders for deliverable 3. Parts are imported from their GLBs and bound to the base rig by bone name,
so the frames check the exports, not the build scene.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/render_evidence.py -- <frames_dir> <mode>
  python3 art/characters/make_evidence_sheets.py <frames_dir> <mode>
mode: outfits | accessories | clips | dressed
"""
import bpy, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import kit  # noqa: E402

OUT, MODE = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(OUT, exist_ok=True)
CAT = json.load(open(os.path.join(HERE, "character_catalog.json")))
PARTS = {p["id"]: p for sec in ("outfits", "accessories") for p in CAT.get(sec, [])}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
clips_glb = os.path.join(HERE, "base", "v6_clips.glb")
bpy.ops.import_scene.gltf(filepath=clips_glb if os.path.exists(clips_glb) else os.path.join(HERE, "base", "v6.glb"))
rig = next(o for o in sc.objects if o.type == "ARMATURE")
BASE = {n: bpy.data.objects[n] for n in ("V6_Body", "V6_Top", "V6_Bottom", "V6_Head", "V6_HairBangs", "V6_HairBack")}
turn = bpy.data.objects.new("Turn", None)
sc.collection.objects.link(turn)
for o in list(sc.objects):
    if o.parent is None and o is not turn:
        o.parent = turn

kit.render_setup(sc)
bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.45, fill_type="NGON")
ground = bpy.context.object
gm = bpy.data.materials.new("Ground")
next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.62, 0.72, 0.62, 1)
ground.data.materials.append(gm)
cd = bpy.data.cameras.new("Cam")
cd.type = "ORTHO"
cam = bpy.data.objects.new("Cam", cd)
sc.collection.objects.link(cam)
sc.camera = cam
CAMS = {"body": (1.2, 0.5), "lower": (0.34, 0.13), "bust": (0.8, 0.76), "wide": (1.5, 0.45)}
YAW34 = 32


def use_action(name, t=0.0):
    """Pose the rig at normalised time t of an action."""
    ad = rig.animation_data or rig.animation_data_create()
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    act = next(a for a in bpy.data.actions if a.name == name or a.name.startswith(name + "_") or a.name.startswith(name + "."))
    ad.action = act
    if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
        ad.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    sc.frame_set(round(f0 + (f1 - f0) * t))


def shot(path, yaw, view="body", res=(300, 366)):
    cd.ortho_scale, z = CAMS[view]
    cam.location, cam.rotation_euler = (0, -4.0, z), (math.radians(90), 0, 0)
    sc.render.resolution_x, sc.render.resolution_y = res
    turn.rotation_euler = (0, 0, math.radians(yaw))
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


DEFAULT_HAIR = ("bangs_straight", "back_bob")      # the engine's DEFAULT_LOOK hair (v6's own hair is never shown)


def wear(ids, hair=DEFAULT_HAIR):
    """Import parts by catalogue id and the hair GLBs (bangs, back); hide what they replace. Returns new objects.
    Always the library hair the engine wears, so the sheets show what the game shows (avatar-fit)."""
    objs = []
    hidden = set()
    for pid in ids:
        p = PARTS[pid]
        objs += kit.bind_glb(os.path.join(HERE, p["glb"]), rig)
        hidden |= set(p.get("hides", []))
        if p["slot"] in ("top", "bottom"):
            hidden.add(p["slot"])
        if p.get("hidesBackHair"):
            hidden.add("back")
    if hair:
        for slot, hid in zip(("bangs", "back"), hair):
            objs += kit.bind_glb(os.path.join(HERE, "hair", slot, f"{hid}.glb"), rig)
        hidden |= {"base_bangs", "base_back"}
    BASE["V6_Top"].hide_render = "top" in hidden
    BASE["V6_Bottom"].hide_render = "bottom" in hidden
    BASE["V6_HairBangs"].hide_render = BASE["V6_HairBack"].hide_render = True
    if hair and "back" in hidden:
        for o in objs:
            if o.name.startswith(hair[1]):
                o.hide_render = True
    kit.show_vertex_colors(sc)
    return objs


def strip_off(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in BASE.values():
        o.hide_render = o.name.startswith("V6_Hair")


def tint(objs, mat_prefix, hexcol):
    for o in objs:
        for m in o.data.materials:
            if m and m.name.split(".")[0] == mat_prefix:
                nt = m.node_tree
                mix = next((n for n in nt.nodes if n.type == "MIX"), None)
                bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
                (mix.inputs[6] if mix else bs.inputs["Base Color"]).default_value = (*kit.lin(hexcol), 1)


FACE_TEX = next(n for n in BASE["V6_Head"].data.materials[1].node_tree.nodes if n.type == "TEX_IMAGE") \
    if len(BASE["V6_Head"].data.materials) > 1 else None
FACE0 = FACE_TEX.image if FACE_TEX else None
SKIN0 = kit.PAL["skin"][kit.PAL["ref_girl_defaults"]["skin"]]


def skin(hexcol):
    """Recolour the base skin + baked face (multiplicative, evidence only; the creator composes the face properly)."""
    for n in ("V6_Body", "V6_Head"):
        for m in BASE[n].data.materials:
            if m.name.startswith("M_Skin"):
                next(x for x in m.node_tree.nodes if x.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*kit.lin(hexcol), 1)
    if not FACE_TEX:
        return
    srgb = lambda h: np.array([int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
    px = np.array(FACE0.pixels[:], np.float32).reshape(-1, 4)          # sRGB values of the baked face
    px[:, :3] = np.clip(px[:, :3] * srgb(hexcol) / srgb(SKIN0), 0, 1)
    img = bpy.data.images.new(f"face_{hexcol}", FACE0.size[0], FACE0.size[1], alpha=True)
    img.pixels.foreach_set(px.reshape(-1))
    FACE_TEX.image = img


# ================================================================ modes
if MODE == "outfits":
    use_action("Idle")
    for p in CAT["outfits"]:
        objs = wear([p["id"]])
        view = "lower" if p["slot"] == "shoes" else "body"
        shot(os.path.join(OUT, f"{p['id']}_a.png"), 0, view)
        shot(os.path.join(OUT, f"{p['id']}_b.png"), YAW34, view)
        strip_off(objs)

elif MODE == "accessories":
    use_action("Idle")
    for p in CAT["accessories"]:
        objs = wear([p["id"]])
        if p["group"] == "bag":
            shot(os.path.join(OUT, f"{p['id']}_a.png"), YAW34, "body")
            shot(os.path.join(OUT, f"{p['id']}_b.png"), 150, "body")
        else:
            shot(os.path.join(OUT, f"{p['id']}_a.png"), 0, "bust")
            shot(os.path.join(OUT, f"{p['id']}_b.png"), YAW34, "bust")
            shot(os.path.join(OUT, f"{p['id']}_c.png"), 145, "bust")
        strip_off(objs)

elif MODE == "clips":
    wear([])
    SHOWCASE = {"Fish": [0.42, 0.58, 1.0], "Forage": [0.3, 0.45, 0.72], "Dig": [0.2, 0.42, 0.8], "Net": [0.25, 0.48, 0.62],
                "Wave": [0.18, 0.3, 0.42], "Cheer": [0.16, 0.4, 0.64], "Laugh": [0.14, 0.4, 0.9], "Sad": [0.22, 0.5, 0.9],
                "AttackMelee": [0.3, 0.48, 0.62], "AttackBow": [0.22, 0.5, 0.7], "AttackCast": [0.28, 0.46, 0.8],
                "DodgeRoll": [0.3, 0.5, 0.7], "Hit": [0.22, 0.5, 0.8], "Defeat": [0.3, 0.55, 1.0]}
    for c in CAT["clips"]:
        for i, t in enumerate(SHOWCASE.get(c["name"], [0.0, 0.33, 0.66])):
            use_action(c["name"], t)
            shot(os.path.join(OUT, f"clip_{c['name']}_{i}.png"), YAW34, "wide", (240, 300))

elif MODE == "dressed":
    P = kit.PAL
    LOOKS = [  # parts, (bangs, back), skin index, hair colour index
        (["onepiece_raincape_hood", "shoes_slipon"], ("bangs_straight", "back_bob"), 3, 2),
        (["top_tsi_crew", "bottom_trousers", "shoes_sneakers", "acc_glasses_round", "acc_backpack"],
         ("bangs_swept_l", "back_short_spiky"), 7, 0),
        (["onepiece_sundress", "shoes_sandals", "acc_sunhat"], ("bangs_curtain", "back_long"), 1, 6),
        (["top_cardigan", "bottom_long_skirt", "shoes_boots", "acc_scarf"], ("bangs_hime", "back_twin_buns"), 9, 7),
        (["top_sweater_vest", "bottom_pleated_skirt", "shoes_loafers", "acc_beanie", "acc_glasses_square"],
         ("bangs_choppy", "back_bob"), 5, 4),
        (["top_stripe_ls", "bottom_overall_shorts", "shoes_rainboots", "acc_shoulder_bag", "acc_cap"],
         ("bangs_wispy", "back_pigtails"), 10, 3),
    ]
    for li, (ids, hair, sk, hc) in enumerate(LOOKS):
        objs = wear(ids, hair)
        tint(objs, "M_Hair", P["hair"][hc])
        skin(P["skin"][sk])
        use_action("Idle")
        shot(os.path.join(OUT, f"look{li}_a.png"), YAW34, "body", (320, 390))
        use_action("Walk", 0.25)
        shot(os.path.join(OUT, f"look{li}_b.png"), -40, "body", (320, 390))
        use_action("Idle")
        shot(os.path.join(OUT, f"look{li}_c.png"), 155, "body", (320, 390))
        strip_off(objs)
        skin(SKIN0)
print("RENDER_OK", MODE)
