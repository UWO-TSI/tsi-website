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
  7. maps      each texture becomes a shading map (its lightness against the median of the part it shades, normalised by
               the spread, so dark and light sources recolour alike: matte, row 264), plus an accent mask for two-tone styles and a cap mask; logos painted out (#8, #19);
               one channel each in the shared atlas hair/hair_maps.png, so one material tints every hairstyle
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
from head_shape import HC, skull_radius, classic_radius, HAIR_ATT, STUD, _ss  # noqa: E402
import skull as SK  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WHO = ARGS[ARGS.index("--who") + 1] if "--who" in ARGS else "david"
ONLY = set(ARGS[ARGS.index("--only") + 1].split(",")) if "--only" in ARGS else None
RENDER = ARGS[ARGS.index("--render") + 1] if "--render" in ARGS else None
SRC = os.path.join(HERE, "source", WHO)
MANIFEST = json.load(open(os.path.join(SRC, "manifest.json")))
ATTACH = {e["id"]: e for e in json.load(open(os.path.join(HERE, "roblox_attachments.json")))["hairs"]}

LOD0_MAX = 1700          # the library's full looks (bangs + back) run 1,110-1,756 triangles: the full hair budget is
                         # 1,750 (specs/perf/budget.md); a rigid Roblox hair keeps its shape only with most of that
                         # (at 1,500 the collapse flung card faces across the gaps), under-cap included
DEEP = 0.03              # geometry more than this under the skin is hidden inside the head (strand roots): left alone
FACE_CLEAR = 0.003       # jaw rule: hair over our chin stands at least this far off it where it stands out of Roblox's head
FACE_FADE = 0.03         # and the move fades out over this much more height (at least twice the move: no folds)
REST_H = 0.006           # jaw rule: hair this close to Roblox's head (resting on it) follows ours where ours is inside it
REST_FADE = 0.02         # and that move fades out over this much more height (hair hanging free stays put)
SHELL_CLEAR = 0.005      # a scalp shell (undercap false) lies at least this far over the head mesh (lift_shell: no depth fight)
COVER_REACH = 0.25       # the under-cap goes where the hair is within this of the skin (a dome may stand 10 cm proud)
FRINGE_LAT = 16.0        # deg (geocentric): the under-cap reaches down the forehead to here, under a fringe that covers it
FRINGE_LON = 70.0        # deg either side of the face's centre line
FRINGE_REACH = 0.08      # m: a fringe hangs within this of the forehead
CAP_H = 0.0025           # the matte under-cap over the scalp (the library's rule: no skin shows between the hair from any
                         # angle): the head's own faces above the scalp line, this far out
CELL, COLS, ROWS = 512, 5, 2    # 10 cells x 3 channels: 21 shading maps, 3 accent masks, 2 cap masks
CAP_COLOR = "#28282E"            # a cap's or visor's fixed colour (its mask channel; one material, never a second one)
PAD = 8                  # px of each cell kept clear round the map (mip bleed)
GAIN = 1.25              # shading maps store the shade gain / GAIN (the shader multiplies by GAIN)
SHADE_DARK = 0.5         # shade normalisation (shade_map): the deepest gap between strands x exp(-0.5) = 0.61
SHADE_LIGHT = 0.1        # and the brightest highlight x exp(0.1) = 1.11 (matte, row 264: no glossy bands)
SHADE_IQR_MIN = 6.0      # L* units: a near-flat texture's noise is never stretched past this spread
ACCENT_SPECK = 3         # px (source texture): accent-mask blobs narrower than 2 x this + 1 are noise, not a second colour
ATLAS = os.path.join(HERE, "hair_maps.png")


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
    return False


def clean(ob, spec, img_px):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active
    dropped = 0
    if spec.get("drop") == "face_plate" and img_px is not None:
        for isl in islands(bm):
            us = [l[uvl].uv.x for f in isl for l in f.loops]
            vs = [l[uvl].uv.y for f in isl for l in f.loops]
            if (max(us) - min(us)) * (max(vs) - min(vs)) > 0.25:   # an island spread over the whole painted face: a
                bmesh.ops.delete(bm, geom=list(isl), context="FACES")   # head shell with a face, not hair
                dropped += len(isl)
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
    bm.to_mesh(me)
    bm.free()
    me.update()
    if caps:
        if len(me.materials) < 2:
            me.materials.append(None)
        for p in me.polygons:
            p.material_index = 1 if p.index in caps else 0
    return dropped, len(caps)


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


def write_cell(atlas, cell, chans, shade, accent, capmask):
    cx, cy = cell % COLS, cell // COLS
    inner = CELL - 2 * PAD
    block = np.full((CELL, CELL), 1.0 / GAIN, np.float32)
    s_ = resample(shade, inner)
    block[PAD:PAD + inner, PAD:PAD + inner] = s_
    block[:PAD, PAD:PAD + inner] = s_[0]
    block[PAD + inner:, PAD:PAD + inner] = s_[-1]
    block[:, :PAD] = block[:, PAD:PAD + 1]
    block[:, PAD + inner:] = block[:, PAD + inner - 1:PAD + inner]
    atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL, chans[0]] = block
    if accent is not None:
        ablock = np.zeros((CELL, CELL), np.float32)
        ablock[PAD:PAD + inner, PAD:PAD + inner] = resample(accent, inner)
        atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL, chans[1]] = ablock
    if capmask is not None:                  # the cap's texels: its fixed colour (one material)
        cblock = np.zeros((CELL, CELL), np.float32)
        cblock[PAD:PAD + inner, PAD:PAD + inner] = resample(capmask.astype(np.float32), inner)
        atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL, chans[-1]] = cblock


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
        x0, x1 = max(0, int(min(xs))), min(w - 1, int(max(xs)) + 1)
        y0, y1 = max(0, int(min(ys))), min(h - 1, int(max(ys)) + 1)
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
    else:   # light_or_vivid: white or grey letters, and any vivid red or blue patch, on a dark cap
        bad = ((v > 0.3) & (s < 0.25)) | ((s > 0.4) & ((h < 0.03) | (h > 0.9) | ((h > 0.5) & (h < 0.72))))
    bad &= region
    keep = region & ~bad
    if bad.any() and keep.any():
        fill = np.median(px[keep][:, :3], axis=0)
        px[bad, :3] = fill
    return int(bad.sum())


def shade_map(img, me, spec, px=None):
    """(shade [h, w] in 0..1, accent mask [h, w] or None, logos painted, cap mask) from the source texture (or `px`)."""
    px = pixels(img).copy() if px is None else px.copy()
    hh, ww = px.shape[:2]
    cov = coverage(me, ww, hh)
    cap_region = np.zeros((hh, ww), bool)
    painted = 0
    if spec.get("cap") and any(p.material_index == 1 for p in me.polygons):
        tmp = me.copy()
        cap_region = coverage_only(tmp, ww, hh, 1)       # the texels the cap's faces sample
        bpy.data.meshes.remove(tmp)
        painted = paint_out(px, cap_region, spec["cap"].get("logos"))
    lin = to_lin(np.clip(px[..., :3], 0, 1))
    L = lin @ np.array([0.2126, 0.7152, 0.0722])
    hsv_s = np.max(px[..., :3], -1) - np.min(px[..., :3], -1)
    hsv_v = np.max(px[..., :3], -1)
    accent = None
    if spec.get("accent"):
        accent = np.clip((hsv_s / np.maximum(hsv_v, 1e-3) - 0.28) / 0.2, 0, 1) * np.clip((hsv_v - 0.12) / 0.12, 0, 1)
        accent = opening(accent, spec["accent"].get("speck", ACCENT_SPECK))   # head-v10: a dark source's noise specks go
        accent[cap_region] = 0.0
    shade = np.ones((hh, ww), np.float32)
    regions = [(cov & ~cap_region, None)]
    if accent is not None:
        regions = [(cov & ~cap_region & (accent < 0.5), "base"), (cov & ~cap_region & (accent >= 0.5), "accent")]
    if cap_region.any():
        regions.append((cap_region & cov, "cap"))
    # head-v10 (row 311, David: "some hair color is glitching"): the shade is normalised per hair in perceptual lightness
    # (CIE L*), not as a luminance ratio. A ratio over a near-black source's tiny median turned its noise and painted
    # highlights into 2-10x streaks that clipped bright in a light colour. Now each texel's lightness against the part's
    # median, over its spread (the interquartile range, at least SHADE_IQR_MIN), is squashed (tanh) into a gain from
    # exp(-SHADE_DARK) in the gaps between strands to exp(SHADE_LIGHT) on a highlight: every source, dark or light,
    # recolours to the same clean range, the median texel exactly the chosen colour.
    Ls = np.where(L > 0.008856, 116.0 * np.cbrt(L) - 16.0, 903.3 * L)
    out = np.zeros((hh, ww), np.float32)
    for reg, name in regions:
        vals = Ls[reg] if reg.sum() > 50 else Ls[cov]
        m, q1, q3 = (np.percentile(vals, q) for q in (50, 25, 75)) if vals.size else (50.0, 45.0, 55.0)
        t = np.tanh((Ls - m) / max(q3 - q1, SHADE_IQR_MIN))
        r = np.exp(np.where(t < 0, SHADE_DARK, SHADE_LIGHT) * t)
        out = np.where(reg, r / GAIN, out)
    out = np.where(cov, out, 1.0 / GAIN)
    return out, accent, painted, (cap_region & cov) if cap_region.any() else None


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


def resample(a, size):
    """Nearest-neighbour then box resample of a [h, w] map to [size, size] (maps are smooth enough)."""
    h, w = a.shape
    ys = (np.arange(size) + 0.5) * h / size
    xs = (np.arange(size) + 0.5) * w / size
    return a[ys.astype(int).clip(0, h - 1)][:, xs.astype(int).clip(0, w - 1)]


# ================================================================ 8. export
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
    cx, cy = cell % COLS, cell // COLS
    W, H = COLS * CELL, ROWS * CELL
    k = (CELL - 2 * PAD) / CELL
    for d in me.uv_layers.active.data:
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
    atlas = np.ones((ROWS * CELL, COLS * CELL, 3), np.float32) / GAIN
    if os.path.exists(ATLAS):
        im = bpy.data.images.load(ATLAS)
        atlas = np.array(im.pixels[:], np.float32).reshape(ROWS * CELL, COLS * CELL, 4)[::-1][..., :3].copy()
        bpy.data.images.remove(im)
    # channel slots: 3 per cell; a two-tone hair takes two channels of one cell. Slots follow the manifest order, so
    # re-importing one hair keeps everyone's place in the atlas.
    slots, used = {}, 0
    for key, need in [(h["id"], 1 + bool(h.get("accent")) + bool(h.get("cap"))) for h in MANIFEST["hairs"]] + \
            [(h["split"]["id"], 2) for h in MANIFEST["hairs"] if h.get("split")]:
        if (used % 3) + need > 3:
            used += 3 - used % 3
        slots[key] = (used // 3, [used % 3 + k for k in range(need)])
        used += need
    assert used <= COLS * ROWS * 3, "the hair atlas is full: add a row of cells"
    entries, report = {}, []
    built = []
    for spec in MANIFEST["hairs"]:
        pid = spec["id"]
        if ONLY and pid not in ONLY:
            continue
        att = ATTACH[pid]
        ob, img = import_any(os.path.join(SRC, spec["file"]))
        src_tris = kit.ntris(ob)
        img_px = pixels(img) if img is not None else None
        has_uv = bool(ob.data.uv_layers) and img is not None and np.ptp([d.uv.x for d in ob.data.uv_layers.active.data]) > 1e-4
        capped = "crown" in (spec.get("covers") or SK.COVERS["full"]) and spec.get("undercap", True)
        weld(ob)
        dropped, n_cap = clean(ob, spec, img_px if has_uv else None)
        attach(ob, att)
        trimmed = trim_face_window(ob) if spec.get("trim") == "face_window" else 0
        jaw = jaw_rule(ob)
        shell = lift_shell(ob, HEAD) if not spec.get("undercap", True) else None
        boxed = keep_in_box(ob)
        body = body_clip(ob, BODY)
        visor = split_off(ob) if spec.get("split") else None
        if capped:
            undercap(ob, HEAD, undercap_faces(HEAD, ob))
        cell, chans = slots[pid]
        mapped = has_uv
        painted = 0
        if mapped:
            shade, accent, painted, capmask = shade_map(img, ob.data, spec)
            write_cell(atlas, cell, chans, shade, accent, capmask)
            remap_uvs(ob.data, cell)
        if visor is not None:                  # its own accessory: the hair can be worn without it (David, 2026-10-14)
            sp = spec["split"]
            vpx = pixels(img).copy()
            nflip = flip_logos(vpx, visor.data) if sp.get("flip_logo") else 0
            vshade, vaccent, _, _ = shade_map(img, visor.data, {"accent": {"default": 0, "speck": 0}}, px=vpx)   # the logo whole
            vcell, vchans = slots[sp["id"]]
            write_cell(atlas, vcell, vchans, vshade, vaccent, None)
            logo = logo_colour(vpx, visor.data, vaccent)
            print(f"  {sp['id']}: logos flipped {nflip}")
            remap_uvs(visor.data, vcell)
            visor.data.validate()
            visor = finish(visor, rig, sp["id"])
            vrel = f"accessories/accessory/{sp['id']}.glb"
            kit.export(visor, rig, os.path.join(ART, vrel))
            entries[sp["id"]] = {"id": sp["id"], "slot": "accessory", "name": sp["name"], "glb": vrel, "tris": kit.ntris(visor),
                                 "materials": [{"name": "M_Hair", "tint": None, "color": sp["color"]}], "decalSlot": None,
                                 "hidesBackHair": False, "hides": [], "group": "head", "skull": SK.VERSION,
                                 "source": f"hair/source/{WHO}/{spec['file']} (split from {pid})",
                                 "map": {"shade": vchans[0], "accent": vchans[1]}, "accent": {"default": logo}}
            print(f"SPLIT {sp['id']} from {pid}: {kit.ntris(visor)} tris, logo {logo}")
            bpy.data.objects.remove(visor, do_unlink=True)
        ob.data.validate()                       # the sources carry degenerate faces (zero area, repeats)
        ob = finish(ob, rig, pid)
        rel = f"hair/full/{pid}.glb"
        kit.export(ob, rig, os.path.join(ART, rel))
        mats = [{"name": "M_Hair", "tint": "hair"}]
        acc = spec.get("accent")
        e = {"id": pid, "slot": "back", "name": spec["name"], "glb": rel, "tris": kit.ntris(ob), "materials": mats,
             "decalSlot": None, "hidesBackHair": False, "hides": [], "full": True, "skull": SK.VERSION,
             "source": f"hair/source/{WHO}/{spec['file']}",
             "roblox": {"provisional": bool(att["provisional"])},
             **({"covers": spec["covers"]} if spec.get("covers") else {}),
             **({"map": {"shade": chans[0], **({"accent": chans[1]} if acc else {}), **({"cap": chans[-1]} if spec.get("cap") else {})}} if mapped else {}),
             **({"accent": {"default": acc["default"]}} if acc and mapped else {})}
        entries[pid] = e
        report.append(f"IMPORT {pid:22s} src_tris={src_tris} tris={e['tris']} attach={'provisional' if att['provisional'] else 'Roblox'} "
                      f"position={att['position']} orientation={att['orientation']} scale={att['mesh_scale']} override={att.get('override')} "
                      f"jaw_rule(moved,out m,in m)={jaw}{f' lift_shell(moved,m)={shell}' if shell else ''} normals_welded={ob.get('normals_welded')} dropped={dropped} cap_faces={n_cap} trimmed={trimmed} out_of_box={boxed} "
                      f"body_clip(verts,deepest m)={body} logo_texels={painted} map={'cell %d ch %s' % (cell, chans) if mapped else 'none'}")
        print(report[-1])
        built.append(ob)
        if not RENDER:
            bpy.data.objects.remove(ob, do_unlink=True)
    if RENDER:
        render_check(RENDER, built, head)
    out = (np.clip(atlas[::-1], 0, 1))
    rgba = np.concatenate([out, np.ones(out.shape[:2] + (1,), np.float32)], -1)
    im = bpy.data.images.new("hair_maps", COLS * CELL, ROWS * CELL, alpha=False, float_buffer=False)
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(rgba.reshape(-1))
    im.filepath_raw = ATLAS
    im.file_format = "PNG"
    im.save()
    cat = json.load(open(cat_path))
    # the catalogue's hair is exactly the manifest's hairstyles, in its order (head-roblox: David's 21 are all the hair)
    old = {h["id"]: h for h in cat["hair"]}
    order = [h["id"] for h in MANIFEST["hairs"]] + [h["split"]["id"] for h in MANIFEST["hairs"] if h.get("split")]
    cat["hair"] = [entries.get(k) or old[k] for k in order if k in entries or k in old]
    cat["hairMaps"] = {"atlas": "hair/hair_maps.png", "gain": GAIN, "cells": [COLS, ROWS], "cell": CELL, "cap": CAP_COLOR,
                       "note": "Shading maps of the full hairstyles (hair/import_hair.py): one channel per hair, its accent and "
                               "cap masks in the next channels of the same cell; luminance / median / gain. The engine "
                               "multiplies the palette tint by map x gain, mixes the accent colour and the fixed cap colour "
                               "in by their masks, and leaves u < 0 (the under-cap) to the tint (rig.ts, Character.tsx). "
                               "Every hairstyle is one primitive in one material."}
    json.dump(cat, open(cat_path, "w"), indent=1)
    print("IMPORT_HAIR_OK", len(entries))
    # 9. LOD 1 for the hairs built, then the web copies: nothing else to run after new attachments
    import subprocess
    if "--no-lod" not in ARGS and entries:
        subprocess.run([bpy.app.binary_path, "-b", "-P", os.path.join(ART, "build_lod.py"), "--", *entries], check=True)
    if "--no-sync" not in ARGS:
        subprocess.run(["node", os.path.join(ART, "..", "..", "web", "scripts", "sync-character-assets.mjs")], check=True)


main()
