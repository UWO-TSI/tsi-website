"""Attach David's hairstyles the way Roblox does (head-roblox, specs/characters/head-roblox.md; ledger rows 305, 309).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hair/import_hair.py -- [--only id,id] [--render dir] [--no-lod] [--no-sync]

The skull's hair zone is Roblox's classic head (head_shape, v9), so a hair made for that head needs no refitting: each
one is attached rigidly by its own Roblox attachment (hair/roblox_attachments.json: the HairAttachment's Position and
Orientation in its Handle and the Handle's mesh scale), with ONE shared transform for all of them:

    vertex = HAIR_ATT + STUD x to_blender( R^T (mesh_scale * raw - position) )

HAIR_ATT is the classic head's top centre (Roblox's HairAttachment) on our skull, STUD the metres per stud (the classic
head as wide as ours), R the Orientation (Roblox's Y, X, Z order) and raw the mesh exactly as Roblox has it (the source
GLBs keep the mesh's coordinates). For every hairstyle listed in hair/source/<who>/manifest.json (GLB, glTF, FBX, OBJ or
.blend), the steps are:

  1. import    the meshes joined, transforms applied, coincident vertices welded (UVs are per corner, so they survive)
  2. clean     manifest rules: a face plate dropped (#15's own face); cap or visor faces marked (a mask channel, step 7)
  3. attach    the shared transform above: no per-hair scale, offset, warp, length change or cut
  4. detail    the original mesh as Roblox draws it, every triangle (David, 2026-10-14: "shouldnt be so low poly and
               blocky"; Roblox holds hair to 4,000), welded, its stray hard edges welded smooth (kit.weld_normals, head-v10);
               LOD 1 and LOD 2 are build_lod.py's
  5. jaw       one rule for every hair, only where the v10 head is not Roblox's (below the classic centre: the round jaw
               inside its straight sides, our chin under its underside): hair resting there follows our head, hair near
               the chin moves out over it, fading with height; above the centre (the hair zone) nothing moves. A hair
               that is itself the scalp (#20's fade) is lifted SHELL_CLEAR off the head mesh (lift_shell)
  6. under-cap the head's own faces above the scalp line that the hair covers, CAP_H out: a matte shell in the hair's
               shadow tone, so no skin shows through the gaps between strands
  7. maps      round 2: each source texture as drawn (logos painted out: #8, #19), one cell a piece of the shared atlas
               hair/hair_colour.png, alpha its recolour channel (the hair's colour, a two-tone style's second, a fixed
               cap); each channel's median in OKLCh for the engine's hue and saturation shift (natural_map); one
               material draws every hairstyle
  8. export    hair/full/<id>.glb: the 22-bone rig and one mesh, one material, on mixamorig:Head; the catalogue entry
  9. LOD, sync build_lod.py for the hairs built, then web/scripts/sync-character-assets.mjs (unless --no-lod, --no-sync)

So when David copies the real attachments from Studio into roblox_attachments.json, running this script again refits,
re-maps, rebuilds LOD 1 and syncs everything; fit_check.py then verifies.
"""
import bpy, bmesh, colorsys, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
for p in (ART, os.path.join(ART, "base"), os.path.join(ART, "skull")):
    sys.path.insert(0, p)
import kit  # noqa: E402
import colour_atlas  # noqa: E402  (wardrobe batch 2: textures kept as drawn, a hairstyle's hat)
from head_shape import HC, skull_radius, classic_radius, HAIR_ATT, STUD, _ss  # noqa: E402
import skull as SK  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# David's sets, in order (wardrobe batches 2 and 3 added david-b2 and david-b3): each manifest's hairs (and their split-off pieces) take the
# atlas cells after the sets before it, so a new set never moves an existing hair's cell.
WHO = ARGS[ARGS.index("--who") + 1].split(",") if "--who" in ARGS else ["david", "david-b2", "david-b3"]
ONLY = set(ARGS[ARGS.index("--only") + 1].split(",")) if "--only" in ARGS else None
RENDER = ARGS[ARGS.index("--render") + 1] if "--render" in ARGS else None
SETS = [(who, json.load(open(os.path.join(HERE, "source", who, "manifest.json")))) for who in WHO]
for _who, _m in SETS:
    for _h in _m["hairs"]:
        _h["_who"] = _who
MANIFEST = {"hairs": [h for _w, m in SETS for h in m["hairs"]]}
ATTACH = {e["id"]: e for e in json.load(open(os.path.join(HERE, "roblox_attachments.json")))["hairs"]}

LOD0_MAX = 1700          # the library's full looks (bangs + back) run 1,110-1,756 triangles: the full hair budget is
                         # 1,750 (specs/perf/budget.md); a rigid Roblox hair keeps its shape only with most of that
                         # (at 1,500 the collapse flung card faces across the gaps), under-cap included
DEEP = 0.03              # geometry more than this under the skin is hidden inside the head (strand roots): left alone
FACE_CLEAR = 0.003       # jaw rule: hair over our chin stands at least this far off it where it stands out of Roblox's head
FACE_FADE = 0.03         # and the move fades out over this much more height (at least twice the move: no folds)
REST_H = 0.006           # jaw rule: hair this close to Roblox's head (resting on it) follows ours where ours is inside it
REST_FADE = 0.02         # and that move fades out over this much more height (hair hanging free stays put)
TIP_KEEP = 0.12          # m: a shortened hair clump keeps its last stretch as Roblox shaped and painted it (shorten "tips")
SHELL_CLEAR = 0.005      # a scalp shell (undercap false) lies at least this far over the head mesh (lift_shell: no depth fight)
COVER_REACH = 0.25       # the under-cap goes where the hair is within this of the skin (a dome may stand 10 cm proud)
FRINGE_LAT = 16.0        # deg (geocentric): the under-cap reaches down the forehead to here, under a fringe that covers it
FRINGE_LON = 70.0        # deg either side of the face's centre line
FRINGE_REACH = 0.08      # m: a fringe hangs within this of the forehead
CAP_H = 0.0025           # the matte under-cap over the scalp (the library's rule: no skin shows between the hair from any
                         # angle): the head's own faces above the scalp line, this far out
CAP_COLOR = "#28282E"            # a cap's or visor's fixed colour (its mask channel; one material, never a second one)
PAD = 8                  # px of each cell kept clear round the map (mip bleed)
# Round 2 (David, 2026-10-17: "you really messed up the hair"; row 314): every hairstyle draws its own source texture as
# Roblox does, its colours, strands, matte and gloss; a colour the member picks is a hue and saturation shift of it that
# keeps every bit of its light and dark (Character.tsx). hair_colour.png: one NAT_CELL cell a piece (the hairs, then the
# pieces split off them), RGB the texture as drawn (logos painted out), alpha its recolour channel: 1 the hair's colour,
# 2/3 its second colour (a two-colour hair: the accent rule), 1/3 fixed (a cap or visor, never recoloured). Never 0: a
# browser may premultiply a decoded image, which loses the colour under a transparent texel.
NAT_A, NAT_B, NAT_FIXED = 1.0, 2 / 3, 1 / 3
NAT_CELL, NAT_COLS, NAT_ROWS = 512, 6, 7          # batch 3: two rows more (42 cells); the UVs are in atlas space, so every hair is rebuilt
NAT_ATLAS = os.path.join(HERE, "hair_colour.png")
ACC_FULL_MAX = 780       # a split-off hat's Full mesh (#22's ushanka; accessories/import_roblox.py full_cap: a head item)
ACCENT_SPECK = 3         # px (source texture): accent-mask blobs narrower than 2 x this + 1 are noise, not a second colour
OWN_CLAIMED = []


# ================================================================ 1. import
def import_any(path):
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path, forward_axis="NEGATIVE_Y", up_axis="Z")
    elif ext == ".blend":
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = list(src.objects)
        for o in dst.objects:
            if o is not None:
                bpy.context.scene.collection.objects.link(o)
    else:
        raise ValueError(f"unsupported hair source {path}")
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o.type != "MESH":
            for m in meshes:
                if m.parent is o:
                    mw = m.matrix_world.copy()
                    m.parent = None
                    m.matrix_world = mw
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
        for md in list(m.modifiers):
            m.modifiers.remove(md)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    img = None
    for s in ob.material_slots:
        if s.material and s.material.use_nodes:
            for n in s.material.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and n.image.size[0]:
                    img = img or n.image
    return ob, img


def weld(ob):
    """Coincident vertices merged (the converter split them at every UV seam; UVs are per corner, so they survive)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


# ================================================================ 4. attach: Roblox's attachment, one shared transform
def rot_orientation(o):
    """Roblox Orientation (degrees) as a matrix, as CFrame.fromOrientation builds it: R = Ry Rx Rz."""
    x, y, z = (math.radians(a) for a in o)
    rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]])
    return ry @ rx @ rz


def attach_matrix(att):
    """The 4x4 that takes the imported mesh (Blender's glTF import of the raw Roblox mesh: (x, -z, y)) to the head:
    HAIR_ATT + STUD x to_blender(R^T (mesh_scale * raw - position)), to_blender(x, y, z) = (-x, z, y)."""
    R = rot_orientation(att["orientation"])
    S = np.diag([float(c) for c in att["mesh_scale"]])
    from_import = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)        # imported (x, -z, y) -> raw (x, y, z)
    to_blender = np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], float)        # Roblox -> Blender: a half turn, no mirror
    L = STUD * to_blender @ R.T @ S @ from_import
    t = np.array(HAIR_ATT[:]) - STUD * to_blender @ R.T @ np.asarray(att["position"], float)
    return Matrix([list(L[0]) + [t[0]], list(L[1]) + [t[1]], list(L[2]) + [t[2]], [0, 0, 0, 1]])


def override_matrix(att):
    """David's per-hair correction after the shared transform (roblox_attachments.json `override`): `rotation` (degrees,
    Roblox's Orientation order, about Roblox's axes) turns the hair about HAIR_ATT, then `offset` (studs, Roblox's axes:
    +y up, +z back) moves it. Identity when absent."""
    o = att.get("override") or {}
    to_blender = np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], float)
    R = to_blender @ rot_orientation(o.get("rotation", [0, 0, 0])) @ to_blender.T
    t = np.array(HAIR_ATT[:]) - R @ np.array(HAIR_ATT[:]) + STUD * to_blender @ np.asarray(o.get("offset", [0, 0, 0]), float)
    return Matrix([list(R[0]) + [t[0]], list(R[1]) + [t[1]], list(R[2]) + [t[2]], [0, 0, 0, 1]])


def attach(ob, att):
    ob.data.transform(override_matrix(att) @ attach_matrix(att))   # rotations and a uniform scale: no mirror
    ob.data.update()


def gcoords(d):
    return math.degrees(math.asin(max(-1.0, min(1.0, d.z)))), math.degrees(math.atan2(d.x, -d.y))


def height(p):
    d = p - HC
    return d.length - skull_radius(d.normalized()) if d.length > 1e-6 else -1.0


# ================================================================ 5. jaw: where our head is not Roblox's
def shorten(ob, head, rule):
    """Round 2 (David, 2026-10-17, #26): Roblox's length on our chibi body reaches the floor; the hair below the chin (the
    head's lowest point) keeps `keep` of its length. Round 3 (David: "make sure the model is the same as the original,
    why does it fade off"): squashing all of it toward the chin squashed Roblox's own strand tips and the pale ends painted
    on them into a flat white band. `tips` instead shortens each strand clump (a connected piece) in its middle: its last
    TIP_KEEP (or half its new length, if less) keeps Roblox's own shape and paint, moved up; the stretch from the chin to
    there is squashed to make up the rest, so each clump ends `keep` as far below the chin as it did."""
    keep, mode = (rule, "squash") if isinstance(rule, (int, float)) else (rule["keep"], rule.get("mode", "tips"))
    chin = min((head.matrix_world @ v.co).z for v in head.data.vertices)
    me = ob.data
    if mode == "squash":
        for v in me.vertices:
            if v.co.z < chin:
                v.co.z = chin - (chin - v.co.z) * keep
        return
    bm = bmesh.new()
    bm.from_mesh(me)
    seen = set()
    for v0 in bm.verts:                          # the strand clumps (connected pieces)
        if v0 in seen:
            continue
        piece, st = [], [v0]
        seen.add(v0)
        while st:
            v = st.pop()
            piece.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w not in seen:
                    seen.add(w)
                    st.append(w)
        depth = chin - min(v.co.z for v in piece)
        if depth <= 0.0:
            continue
        target = keep * depth
        tip = min(TIP_KEEP, 0.5 * target)
        k = (target - tip) / max(depth - tip, 1e-6)
        for v in piece:
            d = chin - v.co.z
            if d <= 0.0:
                continue
            v.co.z = chin - (d * k if d <= depth - tip else (target - tip) + (d - (depth - tip)))
    bm.to_mesh(me)
    bm.free()
    me.update()


def jaw_rule(ob):
    """One rule for every hair, only where the v10 head differs from Roblox's classic head (head_shape: below the classic
    centre; everywhere above it the two are one and no hair moves). Along each ray from the head centre our skull is
    `delta` = skull - classic off Roblox's:
      - out (delta > 0: our chin, below the classic head's underside in front): hair within reach moves out by
        delta + FACE_CLEAR, fading to nothing over FACE_FADE (at least twice the move, so layers never cross) of height
        above the classic head; hair that lay in Roblox's head there comes out onto ours;
      - in (delta < 0: the round jaw inside the classic head's straight sides, at the cheeks and the nape): hair resting
        on Roblox's head (within REST_H of it, or in it) follows ours in, fading over REST_FADE, so a fade or a nape line
        keeps hugging the head; hair hanging free stays where Roblox hangs it.
    Hair hidden deeper than DEEP inside the classic head (roots) stays. Returns (vertices moved, largest move out, in, m)."""
    moved, worst_out, worst_in = 0, 0.0, 0.0
    for v in ob.data.vertices:
        d = v.co - HC
        r = d.length
        if r < 1e-6:
            continue
        u = d / r
        rc = classic_radius(u)
        delta = skull_radius(u) - rc
        if abs(delta) <= 1e-4:
            continue
        h = r - rc                                  # height over Roblox's classic head
        if h < -DEEP:
            continue
        if delta > 0:
            need = delta + FACE_CLEAR
            fade = max(FACE_FADE, 2 * need)
            m = need * (1.0 - _ss(need, need + fade, h)) if h > need else need - min(h, 0.0)
        else:
            m = delta * (1.0 - _ss(REST_H, REST_H + REST_FADE, h))
        if abs(m) > 1e-5:
            v.co = v.co + u * m
            moved += 1
            worst_out, worst_in = max(worst_out, m), min(worst_in, m)
    # a long card face over the chin's curve sags between its corners: where its middle still lies under the skin
    # (FACE_CLEAR), its corners lift by as much, a few rounds (only where our head stands out of Roblox's)
    me = ob.data
    for _ in range(4):
        lift = {}
        for poly in me.polygons:
            c = sum((me.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
            d = c - HC
            u = d.normalized()
            if skull_radius(u) - classic_radius(u) <= 1e-4:
                continue
            h = d.length - skull_radius(u)
            if -DEEP < h < FACE_CLEAR:
                for i in poly.vertices:
                    lift[i] = max(lift.get(i, 0.0), FACE_CLEAR - h)
        if not lift:
            break
        for i, m in lift.items():
            v = me.vertices[i]
            v.co = v.co + (v.co - HC).normalized() * m
            worst_out = max(worst_out, m)
    me.update()
    return moved, round(worst_out, 4), round(worst_in, 4)


def lift_shell(ob, head):
    """A hairstyle that is itself the scalp (manifest `undercap: false`: #20's fade, lowered 5 cm by David's override)
    lies on the head, so anywhere our skin comes up through it (spots of skin on the crown, a lip at the nape: "weird
    spots of scalp is showing", row 311) its surface moves out to SHELL_CLEAR over the head's mesh (whose flat faces
    straddle the skull: up to 5 mm proud of it between vertices). Returns (vertices moved, largest move m)."""
    hb = bmesh.new()
    hb.from_mesh(head.data)
    hb.transform(head.matrix_world)
    tree = BVHTree.FromBMesh(hb)
    hb.free()
    moved, worst = 0, 0.0
    for v in ob.data.vertices:
        d = v.co - HC
        r = d.length
        if r < 1e-6:
            continue
        u = d / r
        hit = tree.ray_cast(HC + u * 0.4, -u, 0.4)[0]          # the head mesh's outermost point on this ray
        if hit is None:
            continue
        h = r - (hit - HC).length
        if -DEEP < h < SHELL_CLEAR:
            v.co = v.co + u * (SHELL_CLEAR - h)
            moved += 1
            worst = max(worst, SHELL_CLEAR - h)
    ob.data.update()
    return moved, round(worst, 4)


def body_tree():
    """The base body's skin (no head) in rest pose, from the catalogue's clip base: hair through it is reported."""
    cat = json.load(open(os.path.join(ART, "character_catalog.json")))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ART, cat["base"]["clips_glb"]))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == "ARMATURE":
            o.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    vs, ps = [], []
    for o in new:
        if o.type == "MESH" and o.name.split(".")[0] not in ("V8_Head", "V7_Head") and o.modifiers:
            e = o.evaluated_get(dg)
            me = e.to_mesh()
            names = [m.name.split(".")[0] if m else "" for m in me.materials]
            base = len(vs)
            vs.extend(e.matrix_world @ v.co for v in me.vertices)
            ps.extend([base + i for i in p.vertices] for p in me.polygons if names and names[p.material_index] == "M_Skin")
            e.to_mesh_clear()
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    return BVHTree.FromPolygons(vs, ps)


def body_clip(ob, tree):
    """Hair vertices inside the body below the chin, and the deepest (m): reported, not moved."""
    z0 = HC.z - SK.SKULL["C_BOT"]
    n, deep = 0, 0.0
    for v in ob.data.vertices:
        if v.co.z > z0:
            continue
        p, nrm, _, _ = tree.find_nearest(v.co)
        if p is not None and (v.co - p).dot(nrm) < 0:
            n += 1
            deep = max(deep, (p - v.co).length)
    return n, round(deep, 4)


# ================================================================ 2. clean: face plates, caps
def texel(img_px, uv):
    h, w = img_px.shape[:2]
    x = min(w - 1, max(0, int(uv[0] * w)))
    y = min(h - 1, max(0, int((1 - uv[1]) * h)))
    return img_px[y, x]


def face_uv_centroid(bm, uvl, f):
    u = sum(l[uvl].uv.x for l in f.loops) / len(f.loops)
    v = sum(l[uvl].uv.y for l in f.loops) / len(f.loops)
    return u, v


def islands(bm):
    seen, out = set(), []
    for f0 in bm.faces:
        if f0 in seen:
            continue
        st, isl = [f0], []
        seen.add(f0)
        while st:
            f = st.pop()
            isl.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g not in seen:
                        seen.add(g)
                        st.append(g)
        out.append(isl)
    return out


def hsv(rgb):
    return colorsys.rgb_to_hsv(*[float(c) for c in rgb[:3]])


def cap_face(rule, px, uvc):
    r, g, b = px[:3]
    h, s, v = hsv(px)
    if rule == "flat_grey":            # a visor of flat grey (and its yellow trim) among noisy black strands
        yellow = 0.08 < h < 0.2 and s > 0.45 and v > 0.35
        return yellow or (0.12 < v < 0.32 and s < 0.3)
    if rule == "uv_not_dreads":        # the cap is everything left of the dreads' strip in the source texture
        return not (uvc[0] > 0.68 and uvc[1] < 0.67)
    if rule == "not_green":            # #22: the grey ushanka and silver goggles round the green hair
        return not (0.2 < h < 0.55 and s > 0.15 and v > 0.12)
    if rule == "light":                # batch 3 #34: the white ski mask over black dreads
        return v > 0.45 and s < 0.2
    if rule == "skin_tone":            # batch 3 #36, #39, #40: the scalp and edges drawn in a skin colour
        return 0.02 < h < 0.11 and s > 0.3 and v > 0.25
    return False


def clean(ob, spec, img_px):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active
    dropped = 0
    if spec.get("drop") == "face_plate" and img_px is not None:
        plate = []
        for isl in islands(bm):
            us = [l[uvl].uv.x for f in isl for l in f.loops]
            vs = [l[uvl].uv.y for f in isl for l in f.loops]
            if (max(us) - min(us)) * (max(vs) - min(vs)) > 0.25:   # an island spread over the whole painted face: a
                plate += list(isl)                                  # head shell with a face, not hair
        # deleted once all islands are read (deleting while they were walked left the rest of the UVs garbage: round 2
        # found #15's texture never sampled, its median unmeasured and its colour unpickable)
        if plate:
            bmesh.ops.delete(bm, geom=plate, context="FACES")
            dropped += len(plate)
    bm.faces.index_update()
    caps = set()
    rule = (spec.get("cap") or spec.get("split") or {}).get("rule")
    if rule and img_px is not None:
        for f in bm.faces:
            uvc = face_uv_centroid(bm, uvl, f)
            if cap_face(rule, texel(img_px, uvc), uvc):
                caps.add(f.index)
        if spec.get("split"):           # a part split off goes whole: every island mostly of its faces (a brim's dark rim)
            bm.faces.index_update()
            for isl in islands(bm):
                ids = {f.index for f in isl}
                if len(ids & caps) >= 0.4 * len(ids):
                    caps |= ids
                else:
                    caps -= ids
    own = set()
    orule = (spec.get("own_colour") or {}).get("rule")
    if orule and img_px is not None:     # faces that keep their own texture (wardrobe batch 2: #22's hat), whole islands
        bm.faces.index_update()
        marked = {f.index for f in bm.faces if cap_face(orule, texel(img_px, face_uv_centroid(bm, uvl, f)), None)}
        for isl in islands(bm):
            ids = {f.index for f in isl}
            if len(ids & marked) >= 0.5 * len(ids):
                own |= ids
    bm.to_mesh(me)
    bm.free()
    me.update()
    if caps or own:
        while len(me.materials) < (4 if own else 2):
            me.materials.append(None)
        for p in me.polygons:
            p.material_index = 3 if p.index in own else 1 if p.index in caps else 0
    return dropped, len(caps) + len(own)


# ================================================================ 3. budget
def collapse(ob, max_tris, passes=4):
    for _ in range(passes):
        n = kit.ntris(ob)
        if n <= max_tris:
            break
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        md = ob.modifiers.new("Budget", "DECIMATE")
        md.decimate_type = "COLLAPSE"
        md.ratio = max_tris / n * 0.99
        md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="Budget")


def trim_face_window(ob):
    """A shell that wraps the whole head (#20's fade) loses what lies over the face: below the hairline in front."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = []
    for f in bm.faces:
        la, lo = gcoords((f.calc_center_median() - HC).normalized())
        if abs(lo) < 70 and la < GEO_SCALP(lo) - 2:
            bad.append(f)
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(bad)


def keep_in_box(ob):
    """Faces reaching outside Roblox's own hair box (Classic body scale, from the HairAttachment; skull.CLEARANCE reach
    roblox_hair) go: a Roblox hair is inside it by Roblox's validation, so this only catches a broken source or a sliver
    flung out by the decimation. Returns the faces dropped."""
    top, box = SK.point("hair_att"), SK.CLEARANCE["reach"]["roblox_hair"]

    def out(co):
        d = co - top
        return abs(d.x) > box["side"] or d.z > box["up"] or -d.z > box["down"] or -d.y > box["front"] or d.y > box["back"]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = [f for f in bm.faces if any(out(v.co) for v in f.verts)]
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(bad)


STRAY = 0.012                # m: a decimated face further than this from the source surface was flung across a gap


def drop_strays(ob, src):
    """Collapse joins strand cards across the gaps between them: a few faces end up spanning air, long flat spikes off the
    hair (#5, #17). Any face whose centre or edge midpoints stand more than STRAY off the source mesh goes. Returns the
    faces dropped."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)

    def off(p):
        q, _, _, _ = src.find_nearest(p)
        return (p - q).length if q is not None else 0.0
    offs = [max([off(f.calc_center_median())] + [off((e.verts[0].co + e.verts[1].co) / 2) for e in f.edges]) for f in bm.faces]
    import os as _os
    if _os.environ.get("STRAY_STATS"):
        o = np.array(offs)
        print("  stray stats: faces", len(o), "over 0.02/0.03/0.05/0.08/0.12:", [int((o > t).sum()) for t in (0.02, 0.03, 0.05, 0.08, 0.12)])
    bad = [f for f, x in zip(bm.faces, offs) if x > STRAY]
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(bad)


def drop_slivers(ob, length=0.15, thin=0.004):
    """Collapse leaves a few long slivers across the hair (an edge over 15 cm, under 4 mm wide): they add nothing to the
    silhouette and cut chords through the head, so they go."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = []
    for f in bm.faces:
        L = max(e.calc_length() for e in f.edges)
        if L > length and 2 * f.calc_area() / L < thin:
            bad.append(f)
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(bad)


def decimate(ob, max_tris=LOD0_MAX, area_max=1.2e-3):
    """Collapse to the budget on the welded mesh (strand cards keep their shape; collapsing them unwelded shreds them).
    Where cards meet three or more to an edge the collapse stalls: those edges are split, collapsed again, re-welded."""
    if kit.ntris(ob) <= max_tris:
        return kit.ntris(ob)
    collapse(ob, max_tris)
    if kit.ntris(ob) > max_tris:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.split_edges(bm, edges=[e for e in bm.edges if len(e.link_faces) > 2])
        bm.to_mesh(ob.data)
        bm.free()
        collapse(ob, max_tris)
        weld(ob)
    # strand-card hair is hundreds of separate islands, and collapse cannot merge across them: past that floor the
    # smallest islands (stray wisps a few millimetres across) go first, until the piece fits
    over = kit.ntris(ob) - max_tris
    if over > 0:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        isl = sorted(islands(bm), key=lambda fs: sum(f.calc_area() for f in fs))
        drop, n_isl = [], 0
        for fs in isl:
            if over <= 0 or sum(f.calc_area() for f in fs) > area_max or n_isl >= len(isl) // 4:   # wisps and small cards
                break                                                   # only (under area_max), a quarter of them at most
            n_isl += 1
            drop.extend(fs)
            over -= sum(len(f.verts) - 2 for f in fs)
        areas = sorted(sum(f.calc_area() for f in fs) for fs in isl)
        print("  islands", len(isl), "dropped", n_isl, "area quartiles cm2", [round(areas[int(q * (len(areas) - 1))] * 1e4, 1) for q in (0, .1, .25, .5)],
              "tris of the largest", max(sum(len(f.verts) - 2 for f in fs) for fs in isl))
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()
    return kit.ntris(ob)


def cap_bottom(lon):
    """The under-cap's edge: the skull's scalp line (hairline in front, nape at the back)."""
    return SK.scalp_line(lon)


def undercap_faces(head, hair=None):
    """Which of the head's faces the matte under-cap copies: those above the skull's scalp line (less 3 deg, so the cap
    reaches the hairline fit points), and with `hair` only those under it: the face's centre meets the hair along its ray
    from the head centre within COVER_REACH (a face only half under a rim stays bare: no band of shadow below the hair's
    edge), then a closing over the faces (grow two rings, shrink two) fills the holes where rays slip between strand
    cards. Returns the head faces' indices."""
    hb = bmesh.new()
    hb.from_mesh(head.data)
    hb.transform(head.matrix_world)
    hb.faces.ensure_lookup_table()

    def above(f):
        for v in f.verts:
            la, lo = gcoords((v.co - HC).normalized())
            if la >= GEO_SCALP(lo) - 3:
                return True
        return False
    keep = {f for f in hb.faces if above(f)}

    def forehead(f):
        """Under a fringe (head-v10: "weird spots of scalp is showing" through the partings): in front, between the
        scalp line and FRINGE_LAT."""
        for v in f.verts:
            la, lo = gcoords((v.co - HC).normalized())
            if abs(lo) > FRINGE_LON or la < FRINGE_LAT:
                return False
        return True
    fringe = {f for f in hb.faces if f not in keep and forehead(f)} if hair is not None else set()
    if hair is not None:
        me = hair.data
        tree = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [list(p.vertices) for p in me.polygons])

        def hit(co, reach=COVER_REACH):
            d = (co - HC).normalized()
            return tree.ray_cast(co - d * 0.01, d, reach)[0] is not None
        # two of its five samples (centre and corners) meet the hair: strand cards leave gaps a single ray slips
        # through; a face only half under a rim's edge stays bare. On the forehead all five, within FRINGE_REACH: only
        # what a fringe hangs over (a part between its locks), never a band below its edge
        near = {f for f in keep if sum(hit(c) for c in [f.calc_center_median()] + [v.co for v in f.verts]) >= 2}
        near |= {f for f in fringe if all(hit(c, FRINGE_REACH) for c in [f.calc_center_median()] + [v.co for v in f.verts])}
        keep |= fringe
        grown = set(near)
        for _ in range(2):
            grown |= {g for f in grown for e in f.edges for g in e.link_faces}
        for _ in range(2):
            grown = {f for f in grown if all(g in grown for e in f.edges for g in e.link_faces)}
        keep &= grown | near
    out = sorted(f.index for f in keep)
    hb.free()
    return out


def cap_tris(head, idx):
    return sum(len(head.data.polygons[i].vertices) - 2 for i in idx)


def undercap(ob, head, idx):
    """The matte under-cap (material slot 2, the hair's shadow tone): the head faces `idx` (undercap_faces), CAP_H out
    along their normals, so it lies the same distance over the skin everywhere and no skin shows through a gap between
    strands from any angle (the lock library's rule). Returns its triangles."""
    me = ob.data
    hb = bmesh.new()
    hb.from_mesh(head.data)
    hb.transform(head.matrix_world)
    hb.normal_update()
    hb.faces.ensure_lookup_table()
    keep = [hb.faces[i] for i in idx]
    bm = bmesh.new()
    bm.from_mesh(me)
    vmap = {}
    for f in keep:
        for v in f.verts:
            if v not in vmap:
                vmap[v] = bm.verts.new(v.co + v.normal * CAP_H)
    n0 = len(bm.faces)
    for f in keep:
        nf = bm.faces.new([vmap[v] for v in f.verts])
        nf.material_index = 2
    bm.normal_update()
    for f in list(bm.faces)[n0:]:
        if f.normal.dot(f.calc_center_median() - HC) < 0:
            f.normal_flip()
    while len(me.materials) < 3:
        me.materials.append(None)
    bm.to_mesh(me)
    bm.free()
    hb.free()
    me.update()
    return sum(len(p.vertices) - 2 for p in me.polygons if p.material_index == 2)


def GEO_SCALP(lon):
    """The skull's scalp line as a geocentric latitude at geocentric lon (near enough: the two lons differ a little)."""
    d = (SK.hs.head_point(SK.scalp_line(lon), lon) - HC).normalized()
    return math.degrees(math.asin(max(-1.0, min(1.0, d.z))))


def split_off(ob):
    """The faces marked as a cap (material slot 1) as a new object; the hair keeps the rest (manifest `split`: a visor
    worn as its own accessory)."""
    part = ob.copy()
    part.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(part)
    for o, keep in ((part, 1), (ob, 0)):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index == 1) != (keep == 1)], context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        for f in bm.faces:
            f.material_index = 0
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()
    return part


def split_own(ob):
    """Row 314 (David, 2026-10-17: #22's hat becomes a separate accessory): the faces that keep their own texture
    (material slot 3) as a new object; the hair keeps the rest, every other slot as it was."""
    part = ob.copy()
    part.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(part)
    for o, own in ((part, True), (ob, False)):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index == 3) != own], context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        if own:
            for f in bm.faces:
                f.material_index = 0
        bm.to_mesh(o.data)
        bm.free()
        o.data.update()
    return part


def fit_own(part, fit):
    """Round 3 (David, 2026-10-17: "ushanka and goggles smaller and further back"): a split-off hat scaled by
    fit["scale"] about its own top centre (it stays on the head, its rim and flaps rise), then moved fit["back"] metres
    back (+Y: the face looks toward -Y)."""
    co = [v.co.copy() for v in part.data.vertices]
    top = max(c.z for c in co)
    cx, cy = sum(c.x for c in co) / len(co), sum(c.y for c in co) / len(co)
    k, back = float(fit.get("scale", 1.0)), float(fit.get("back", 0.0))
    for v, c in zip(part.data.vertices, co):
        v.co = Vector((cx + (c.x - cx) * k, cy + (c.y - cy) * k + back, top + (c.z - top) * k))
    part.data.update()


def logo_colour(px, me, accent):
    """The median colour (sRGB hex) of the accent texels the part samples: a split-off visor's logo keeps its colour."""
    hh, ww = px.shape[:2]
    m = coverage(me, ww, hh) & (accent >= 0.5)
    if not m.any():
        return "#FFFFFF"
    c = np.median(px[m][:, :3], axis=0)
    return "#" + "".join(f"{int(round(float(x) * 255)):02X}" for x in np.clip(c, 0, 1))


def flip_logos(px, me, vertical=True):
    """Each logo (a compact island of the yellow logo texels) mirrored in place along the texture axis that runs up the
    model there, so it reads upside down on the part (David, 2026-10-14: the visor's M turned into a W). Long trims stay.
    Returns the logos flipped."""
    h_, s_, v_ = np.vectorize(lambda r, g, b: colorsys.rgb_to_hsv(r, g, b), otypes=[float, float, float])(px[..., 0], px[..., 1], px[..., 2])
    yellow = (h_ > 0.08) & (h_ < 0.2) & (s_ > 0.45) & (v_ > 0.35)
    hh, ww = yellow.shape
    seen = np.zeros_like(yellow)
    uv = me.uv_layers.active.data
    flipped = 0
    for y0, x0 in zip(*np.nonzero(yellow)):
        if seen[y0, x0]:
            continue
        stack, pts = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy in (-2, -1, 0, 1, 2):
                for dx in (-2, -1, 0, 1, 2):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < hh and 0 <= xx < ww and yellow[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
        ys, xs = np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
        ya, yb, xa, xb = ys.min(), ys.max(), xs.min(), xs.max()
        bh, bw = yb - ya + 1, xb - xa + 1
        if len(pts) < 40 or max(bh, bw) > 3 * min(bh, bw):
            continue                                       # a trim stripe, or a speck
        # which texture axis runs up the model here: z against u and v over the faces sampling this box
        rows = []
        for poly in me.polygons:
            for li in poly.loop_indices:
                u_, v_ = uv[li].uv
                X, Y = u_ * ww, (1 - v_) * hh
                if xa - 4 <= X <= xb + 4 and ya - 4 <= Y <= yb + 4:
                    rows.append((X, Y, me.vertices[me.loops[li].vertex_index].co.z))
        if len(rows) < 3:
            continue
        A = np.array([[r[0], r[1], 1.0] for r in rows])
        gz = np.linalg.lstsq(A, np.array([r[2] for r in rows]), rcond=None)[0]
        # only the logo moves: its texels (and a 2 px rim of their anti-aliased edge) take the box's own background,
        # then the mirrored logo is painted over it
        pad = 3
        ya, yb, xa, xb = max(0, ya - pad), min(hh - 1, yb + pad), max(0, xa - pad), min(ww - 1, xb + pad)
        box = px[ya:yb + 1, xa:xb + 1].copy()
        mine = np.zeros((yb - ya + 1, xb - xa + 1), bool)
        mine[ys - ya, xs - xa] = True
        grown = mine.copy()
        for _ in range(2):
            g = grown.copy()
            g[1:] |= grown[:-1]
            g[:-1] |= grown[1:]
            g[:, 1:] |= grown[:, :-1]
            g[:, :-1] |= grown[:, 1:]
            grown = g
        bg = np.median(box[~grown][:, :3], axis=0) if (~grown).any() else box[..., :3].mean((0, 1))
        flip = (lambda a: a[:, ::-1]) if abs(gz[0]) > abs(gz[1]) else (lambda a: a[::-1, :])   # u or v runs up the model
        out = box.copy()
        out[grown, :3] = bg
        fm, fg, fb = flip(mine), flip(grown), flip(box)
        out[fg & ~fm, :3] = bg
        out[fm] = fb[fm]
        edge = fg & ~fm                                  # the mirrored rim keeps its anti-aliased blend
        out[edge] = fb[edge]
        px[ya:yb + 1, xa:xb + 1] = out
        flipped += 1
    return flipped


# ================================================================ 7. maps
def pixels(img):
    w, h = img.size
    a = np.array(img.pixels[:], np.float32).reshape(h, w, 4)[::-1]      # top row first, sRGB values
    return a


def to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def coverage(me, w, h):
    """Mask of texels any face of the mesh samples (UV triangles rasterised), [h, w], top row first."""
    mask = np.zeros((h, w), bool)
    uv = me.uv_layers.active.data
    me.calc_loop_triangles()
    for t in me.loop_triangles:
        P = [(uv[l].uv.x * w, (1 - uv[l].uv.y) * h) for l in t.loops]
        xs, ys = [p[0] for p in P], [p[1] for p in P]
        # clamped into the image (a UV on its far edge, v = 0 or u = 1, samples the last row or column: #09's one texel)
        x0, x1 = min(max(0, int(min(xs))), w - 1), min(w - 1, int(max(xs)) + 1)
        y0, y1 = min(max(0, int(min(ys))), h - 1), min(h - 1, int(max(ys)) + 1)
        if x1 < x0 or y1 < y0:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1] + 0.5
        (ax, ay), (bx, by), (cx, cy) = P
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9:
            mask[int(np.clip(ay, 0, h - 1)), int(np.clip(ax, 0, w - 1))] = True
            continue
        l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
        l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
        ins = (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
        mask[y0:y1 + 1, x0:x1 + 1] |= ins
    return mask


def paint_out(px, region, logos):
    """Logos replaced by the median of the surrounding surface (plain caps and visors)."""
    h, s, v = np.vectorize(lambda r, g, b: colorsys.rgb_to_hsv(r, g, b), otypes=[float, float, float])(px[..., 0], px[..., 1], px[..., 2])
    if logos == "yellow":
        bad = (h > 0.08) & (h < 0.2) & (s > 0.45) & (v > 0.35)
    elif logos == "dark":       # batch 3 #34: a black logo on a white mask
        bad = v < 0.25
    else:   # light_or_vivid: white or grey letters, and any vivid red or blue patch, on a dark cap
        bad = ((v > 0.3) & (s < 0.25)) | ((s > 0.4) & ((h < 0.03) | (h > 0.9) | ((h > 0.5) & (h < 0.72))))
    bad &= region
    keep = region & ~bad
    if bad.any() and keep.any():
        fill = np.median(px[keep][:, :3], axis=0)
        px[bad, :3] = fill
    return int(bad.sum())


def oklab(rgb_lin):
    """Linear sRGB [..., 3] to OKLab [..., 3]."""
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    return np.cbrt(np.maximum(rgb_lin @ m1.T, 0)) @ m2.T


def natural_map(img, me, spec, px=None):
    """(rgba [h, w, 4]: the source texture as drawn, sRGB, logos painted out, and its recolour channel in alpha: NAT_A
    the hair's colour, NAT_B its second colour, NAT_FIXED fixed; {"a": [L, C, h], "b": ...} each channel's median in OKLCh over the
    texels the faces sample; whether a fixed part exists)."""
    px = pixels(img).copy() if px is None else px.copy()
    hh, ww = px.shape[:2]
    cov = coverage(me, ww, hh)
    cap_region = np.zeros((hh, ww), bool)
    if spec.get("cap") and any(p.material_index == 1 for p in me.polygons):
        tmp = me.copy()
        cap_region = coverage_only(tmp, ww, hh, 1)
        bpy.data.meshes.remove(tmp)
        paint_out(px, cap_region, spec["cap"].get("logos"))
    hsv_s = np.max(px[..., :3], -1) - np.min(px[..., :3], -1)
    hsv_v = np.max(px[..., :3], -1)
    accent = np.zeros((hh, ww), np.float32)
    if spec.get("accent", {}).get("rule") == "light":
        accent = opening(np.clip((hsv_v - 0.45) / 0.15, 0, 1), spec["accent"].get("speck", ACCENT_SPECK))
    elif spec.get("accent") and spec["accent"].get("default") != "skin":
        accent = opening(np.clip((hsv_s / np.maximum(hsv_v, 1e-3) - 0.28) / 0.2, 0, 1) * np.clip((hsv_v - 0.12) / 0.12, 0, 1),
                         spec["accent"].get("speck", ACCENT_SPECK))
    cls = np.where(accent >= 0.5, NAT_B, NAT_A).astype(np.float32)
    cls[cap_region] = NAT_FIXED
    if spec.get("fixed"):                    # a split-off visor: drawn as it is, never recoloured
        cls[:] = NAT_FIXED
    lab = oklab(to_lin(np.clip(px[..., :3], 0, 1)))
    med = {}
    for key, sel in (("a", cov & (cls == np.float32(NAT_A))), ("b", cov & (cls == np.float32(NAT_B)))):
        if sel.sum() > 0:                     # even one texel: a hair drawn in one flat colour
            L, a, b = (float(np.median(lab[sel][:, i])) for i in range(3))
            med[key] = [round(L, 4), round(float(np.hypot(a, b)), 4), round(float(np.degrees(np.arctan2(b, a))) % 360, 2)]
    rgba = np.concatenate([np.clip(px[..., :3], 0, 1), cls[..., None]], -1).astype(np.float32)
    return rgba, med, bool((cov & cap_region).any() or spec.get("fixed"))


def write_natural(atlas, cell, rgba):
    """A piece's texture into its cell of hair_colour.png, edges extended over the padding (mipmaps never bleed)."""
    cx, cy = cell % NAT_COLS, cell // NAT_COLS
    inner = NAT_CELL - 2 * PAD
    t = colour_atlas._resample(rgba, inner)
    t[..., 3] = np.round(np.clip(t[..., 3], NAT_FIXED, 1) * 3) / 3    # the channel stays one of 1/3, 2/3, 1
    atlas[cy * NAT_CELL:(cy + 1) * NAT_CELL, cx * NAT_CELL:(cx + 1) * NAT_CELL] = np.pad(t, ((PAD, PAD), (PAD, PAD), (0, 0)), mode="edge")


def opening(a, r):
    """Grey-scale opening (a min then a max filter over a (2r+1)^2 window): blobs narrower than the window go, wider
    regions keep their shape and soft edges."""
    def filt(x, f):
        p = np.pad(x, r, mode="edge")
        out = x.copy()
        for dy in range(2 * r + 1):
            for dx in range(2 * r + 1):
                out = f(out, p[dy:dy + x.shape[0], dx:dx + x.shape[1]])
        return out
    return filt(filt(a, np.minimum), np.maximum)


def coverage_only(me, w, h, mat_index):
    """coverage() of the faces with one material index."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != mat_index], context="FACES")
    bm.to_mesh(me)
    bm.free()
    return coverage(me, w, h)


def finish(ob, rig, pid):
    """The fitted mesh as a catalogue part: one material (M_Hair, one primitive, one draw): a cap or visor is a mask
    channel in the atlas, and the under-cap (material slot 2 until now) is marked by u < 0, shaded by its COLOR_0
    (0.55, the hair's shadow) and the tint alone. Smooth: one normal per vertex and side (kit.weld_normals), 100% on
    the head bone."""
    me = ob.data
    hair = bpy.data.materials.get("M_Hair") or kit.material("M_Hair", kit.PAL["hair"][kit.PAL["ref_girl_defaults"]["hair"]])
    undercap = [p.material_index == 2 for p in me.polygons]
    me.materials.clear()
    me.materials.append(hair)
    if "Color" not in me.color_attributes:
        me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    col = me.color_attributes["Color"]
    uv = me.uv_layers.active.data if me.uv_layers else None
    for p, u in zip(me.polygons, undercap):
        p.use_smooth = True
        p.material_index = 0
        for li in p.loop_indices:
            c = 0.55 if u else 1.0
            col.data[li].color = (c, c, c, 1)
            if u and uv is not None:
                uv[li].uv = (-1.0, -1.0)
    me.color_attributes.active_color = col
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    ob["normals_welded"] = kit.weld_normals(me)      # smooth: the source's stray hard edges welded (head-v10)
    ob.name = pid
    me.name = pid
    ob.parent = rig
    ob.modifiers.new("Armature", "ARMATURE").object = rig
    g = ob.vertex_groups.new(name="mixamorig:Head")
    g.add(list(range(len(me.vertices))), 1.0, "REPLACE")
    return ob


def remap_uvs(me, cell):
    """The piece's UVs (the whole source texture) into its cell of hair_colour.png."""
    CELL, COLS, ROWS = NAT_CELL, NAT_COLS, NAT_ROWS
    cx, cy = cell % COLS, cell // COLS
    W, H = COLS * CELL, ROWS * CELL
    k = (CELL - 2 * PAD) / CELL
    own = {li for p in me.polygons if p.material_index == 3 for li in p.loop_indices}
    for li, d in enumerate(me.uv_layers.active.data):
        if li in own:
            continue
        u, v = min(max(d.uv.x, 0.0), 1.0), min(max(d.uv.y, 0.0), 1.0)
        x = cx * CELL + PAD + u * CELL * k
        y_top = cy * CELL + PAD + (1 - v) * CELL * k
        d.uv = (x / W, 1 - y_top / H)


def render_check(out, objs, head):
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.render.resolution_x, sc.render.resolution_y = 360, 360
    cam = bpy.data.objects.get("FitCam") or bpy.data.objects.new("FitCam", bpy.data.cameras.new("FitCam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 0.95
    sc.camera = cam
    for ob in objs:
        for o in sc.objects:
            o.hide_render = o not in (ob, head, cam)
        for name, yaw in (("front", 0), ("34", 40), ("side", 90), ("back", 180)):
            a = math.radians(yaw)
            cam.location = HC + Vector((-math.sin(a) * 3, -math.cos(a) * 3, 0.0)) + Vector((0, 0, 0.02))
            cam.rotation_euler = (math.radians(90), 0, -a)
            sc.render.filepath = os.path.join(out, f"{ob.name}_{name}.png")
            bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = kit.load_rig(bpy.context.scene)
    with bpy.data.libraries.load(os.path.join(ART, "skull", "head.blend"), link=False) as (_s, _d):
        _d.objects = ["V8_Head"]
    head = _d.objects[0]
    bpy.context.scene.collection.objects.link(head)
    head.parent = None
    head.matrix_world = Matrix.Identity(4)           # its vertices are the skull in world space
    for md in list(head.modifiers):
        head.modifiers.remove(md)
    global BODY, HEAD
    BODY = body_tree()
    HEAD = head
    cat_path = os.path.join(ART, "character_catalog.json")
    atlas = np.zeros((NAT_ROWS * NAT_CELL, NAT_COLS * NAT_CELL, 4), np.float32)
    if os.path.exists(NAT_ATLAS):
        im = bpy.data.images.load(NAT_ATLAS)
        im.colorspace_settings.name = "Non-Color"                   # the stored values, as written
        w, h = im.size
        if w == NAT_COLS * NAT_CELL and h <= NAT_ROWS * NAT_CELL:   # a grown atlas keeps the old cells in its top rows
            atlas[:h] = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1]
        bpy.data.images.remove(im)
    # one cell a piece, in the manifests' order: the hairstyles, then the pieces split off them (a visor)
    cells = {k: i for i, k in enumerate(k for _w, m in SETS for k in [h["id"] for h in m["hairs"] if not h.get("accessory_only")]
                                        + [h["split"]["id"] for h in m["hairs"] if h.get("split")])}
    assert len(cells) <= NAT_COLS * NAT_ROWS, "hair_colour.png is full: add a row of cells"
    entries, report = {}, []
    built = []
    for spec in MANIFEST["hairs"]:
        pid = spec["id"]
        if (ONLY and pid not in ONLY) or spec.get("removed"):   # round 3: a hair David removed (#14) keeps its cell, unbuilt
            continue
        att = ATTACH[pid]
        ob, img = import_any(os.path.join(HERE, "source", spec["_who"], spec["file"]))
        src_tris = kit.ntris(ob)
        img_px = pixels(img) if img is not None else None
        # round 2: a hair whose strands all sample one texel (#09's brown, #15's white) is still its texture's colour
        has_uv = bool(ob.data.uv_layers) and img is not None
        capped = "crown" in (spec.get("covers") or SK.COVERS["full"]) and spec.get("undercap", True)
        weld(ob)
        dropped, n_cap = clean(ob, spec, img_px if has_uv else None)
        attach(ob, att)
        trimmed = trim_face_window(ob) if spec.get("trim") == "face_window" else 0
        if spec.get("shorten"):
            shorten(ob, HEAD, spec["shorten"])
        jaw = jaw_rule(ob)
        shell = lift_shell(ob, HEAD) if not spec.get("undercap", True) else None
        boxed = keep_in_box(ob)
        body = body_clip(ob, BODY)
        visor = split_off(ob) if spec.get("split") else None
        own_part = split_own(ob) if spec.get("split_own") else None
        if own_part is not None and spec["split_own"].get("fit"):
            fit_own(own_part, spec["split_own"]["fit"])
        if capped:                  # row 314: #22 without its hat keeps a whole under-cap (its crown was the hat)
            undercap(ob, HEAD, undercap_faces(HEAD, None if spec.get("undercap") == "full" else ob))
        cell = cells.get(pid)
        mapped = has_uv and cell is not None
        painted, med, fixed = 0, {}, False
        if mapped:
            rgba, med, fixed = natural_map(img, ob.data, spec)
            write_natural(atlas, cell, rgba)
            own_loops = [li for p in ob.data.polygons if p.material_index == 3 for li in p.loop_indices]
            if own_loops:                  # the hat keeps its texture: the fixed-colour atlas (u + 2), never tinted
                tile = spec["own_colour"]["tile"]
                tmp = ob.data.copy()
                bm = bmesh.new()
                bm.from_mesh(tmp)
                bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != 3], context="FACES")
                bm.to_mesh(tmp)
                bm.free()
                hh, ww = img_px.shape[:2]
                box = colour_atlas.crop_of(tmp, ww, hh)
                bpy.data.meshes.remove(tmp)
                colour_atlas.claim(tile, img_px[box[1]:box[3], box[0]:box[2]])
                colour_atlas.remap(ob.data, tile, box, (ww, hh), own_loops)
                OWN_CLAIMED.append(tile)
            remap_uvs(ob.data, cell)
        if own_part is not None:               # row 314: #22's ushanka and goggles, worn as a hat; owning the hair grants it
            sp = spec["split_own"]
            tile = spec["own_colour"]["tile"]
            hh, ww = img_px.shape[:2]
            box = colour_atlas.crop_of(own_part.data, ww, hh)
            colour_atlas.claim(tile, img_px[box[1]:box[3], box[0]:box[2]])
            colour_atlas.remap(own_part.data, tile, box, (ww, hh))
            OWN_CLAIMED.append(tile)
            src = kit.ntris(own_part)
            if src > ACC_FULL_MAX:
                collapse(own_part, ACC_FULL_MAX)
            own_part.data.validate()
            own_part = finish(own_part, rig, sp["id"])
            orel = f"accessories/accessory/{sp['id']}.glb"
            kit.export(own_part, rig, os.path.join(ART, orel))
            entries[sp["id"]] = {"id": sp["id"], "slot": "accessory", "name": sp["name"], "glb": orel, "tris": kit.ntris(own_part),
                                 "materials": [{"name": "M_Hair", "tint": None, "color": "#FFFFFF"}], "decalSlot": None,
                                 "hidesBackHair": False, "hides": [], "group": "head", "skull": SK.VERSION,
                                 "source": f"hair/source/{spec['_who']}/{spec['file']} (split from {pid})",
                                 "colourAtlas": True, **({"key": sp["key"]} if sp.get("key") else {"grantedBy": pid}),
                                 **({"coversHair": True, "hatCut": sp["hatCut"]} if sp.get("hatCut") is not None else {})}
            print(f"SPLIT_OWN {sp['id']} from {pid}: {src} -> {kit.ntris(own_part)} tris, " + (f"sold as {sp['key']}" if sp.get("key") else f"granted by {pid}"))
            bpy.data.objects.remove(own_part, do_unlink=True)
        if visor is not None:                  # its own accessory: the hair can be worn without it (David, 2026-10-14)
            sp = spec["split"]
            vpx = pixels(img).copy()
            nflip = flip_logos(vpx, visor.data) if sp.get("flip_logo") else 0
            vrgba, vmed, _ = natural_map(img, visor.data, {"fixed": True}, px=vpx)   # drawn as it is, never recoloured
            vcell = cells[sp["id"]]
            write_natural(atlas, vcell, vrgba)
            print(f"  {sp['id']}: logos flipped {nflip}")
            remap_uvs(visor.data, vcell)
            visor.data.validate()
            visor = finish(visor, rig, sp["id"])
            vrel = f"accessories/accessory/{sp['id']}.glb"
            kit.export(visor, rig, os.path.join(ART, vrel))
            entries[sp["id"]] = {"id": sp["id"], "slot": "accessory", "name": sp["name"], "glb": vrel, "tris": kit.ntris(visor),
                                 "materials": [{"name": "M_Hair", "tint": None, "color": sp["color"]}], "decalSlot": None,
                                 "hidesBackHair": False, "hides": [], "group": "head", "skull": SK.VERSION,
                                 "source": f"hair/source/{spec['_who']}/{spec['file']} (split from {pid})",
                                 "map": {"cell": vcell, "natural": vmed, "fixed": True}}
            print(f"SPLIT {sp['id']} from {pid}: {kit.ntris(visor)} tris")
            bpy.data.objects.remove(visor, do_unlink=True)
        if spec.get("accessory_only"):         # round 2 (David: "#22: remove the hair entirely"): only what was split off
            bpy.data.objects.remove(ob, do_unlink=True)
            continue
        ob.data.validate()                       # the sources carry degenerate faces (zero area, repeats)
        ob = finish(ob, rig, pid)
        rel = f"hair/full/{pid}.glb"
        kit.export(ob, rig, os.path.join(ART, rel))
        mats = [{"name": "M_Hair", "tint": "hair"}]
        acc = spec.get("accent")
        e = {"id": pid, "slot": "back", "name": spec["name"], "glb": rel, "tris": kit.ntris(ob), "materials": mats,
             "decalSlot": None, "hidesBackHair": False, "hides": [], "full": True, "skull": SK.VERSION,
             "source": f"hair/source/{spec['_who']}/{spec['file']}",
             "roblox": {"provisional": bool(att["provisional"])},
             **({"key": spec["key"]} if spec.get("key") else {}),           # its price: specs/wardrobe/batch2-pricing.json
             **({"colourAtlas": True} if spec.get("own_colour") and mapped and not spec.get("split_own") else {}),   # its hat's own texture (colour_atlas.py)
             **({"covers": spec["covers"]} if spec.get("covers") else {}),
             **({"map": {"cell": cell, "natural": med, **({"fixed": True} if fixed else {})}} if mapped else {}),
             **({"accent": {"default": acc["default"]}} if acc and mapped and "b" in med else {})}
        entries[pid] = e
        report.append(f"IMPORT {pid:22s} src_tris={src_tris} tris={e['tris']} attach={'provisional' if att['provisional'] else 'Roblox'} "
                      f"position={att['position']} orientation={att['orientation']} scale={att['mesh_scale']} override={att.get('override')} "
                      f"jaw_rule(moved,out m,in m)={jaw}{f' lift_shell(moved,m)={shell}' if shell else ''} normals_welded={ob.get('normals_welded')} dropped={dropped} cap_faces={n_cap} trimmed={trimmed} out_of_box={boxed} "
                      f"body_clip(verts,deepest m)={body} map={'cell %d %s' % (cell, med) if mapped else 'none'}")
        print(report[-1])
        built.append(ob)
        if not RENDER:
            bpy.data.objects.remove(ob, do_unlink=True)
    if RENDER:
        render_check(RENDER, built, head)
    im = bpy.data.images.new("hair_colour", NAT_COLS * NAT_CELL, NAT_ROWS * NAT_CELL, alpha=True, float_buffer=False)
    im.colorspace_settings.name = "Non-Color"                       # the values as computed: sRGB colour, a linear channel
    im.alpha_mode = "STRAIGHT"
    im.pixels.foreach_set(np.ascontiguousarray(np.clip(atlas[::-1], 0, 1)).reshape(-1))
    im.filepath_raw = NAT_ATLAS
    im.file_format = "PNG"
    im.save()
    if OWN_CLAIMED:
        colour_atlas.save()
    cat = json.load(open(cat_path))
    # the catalogue's hair is exactly the manifest's hairstyles, in its order (head-roblox: David's 21 are all the hair)
    old = {h["id"]: h for h in cat["hair"]}
    order = [k for _w, m in SETS for k in [h["id"] for h in m["hairs"] if not h.get("accessory_only") and not h.get("removed")] + [h["split"]["id"] for h in m["hairs"] if h.get("split")]
             + [h["split_own"]["id"] for h in m["hairs"] if h.get("split_own")]]
    cat["hair"] = [entries.get(k) or old[k] for k in order if k in entries or k in old]
    cat["hairMaps"] = {"atlas": "hair/hair_colour.png", "atlas_world": "hair/hair_colour_world.png", "cells": [NAT_COLS, NAT_ROWS], "cell": NAT_CELL,
                       "note": "Round 2 (David, 2026-10-17): each hairstyle's own source texture, one cell a piece (hair/"
                               "import_hair.py natural_map): RGB as drawn in Roblox (sRGB), alpha its recolour channel (1 the "
                               "hair's colour, 2/3 its second colour, 1/3 fixed). A part's map names its cell and each channel's "
                               "median [L, C, h] (OKLCh); a picked colour turns and scales the texels' chroma so the median lands "
                               "on it, every texel keeping its lightness (look.ts hairShift, Character.tsx). u < 0 (the "
                               "under-cap) takes the colour of the hair's median, darkened by its COLOR_0."}
    json.dump(cat, open(cat_path, "w"), indent=1)
    print("IMPORT_HAIR_OK", len(entries))
    # 9. LOD 1 for the hairs built, then the web copies: nothing else to run after new attachments
    import subprocess
    if "--no-lod" not in ARGS and entries:
        subprocess.run([bpy.app.binary_path, "-b", "-P", os.path.join(ART, "build_lod.py"), "--", *entries], check=True)
    if "--no-sync" not in ARGS:
        subprocess.run(["node", os.path.join(ART, "..", "..", "web", "scripts", "sync-character-assets.mjs")], check=True)


main()
