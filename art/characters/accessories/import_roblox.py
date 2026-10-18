"""David's Roblox accessories (wardrobe batch 2, specs/playtest-round1.md "New wardrobe batch"): every item that
specs/wardrobe/batch2-pricing.json does not skip, placed by its Roblox attachment on the v10 head and the body.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/accessories/import_roblox.py -- [--only id,id] [--render dir]
  then build_lod.py <ids>, then web/scripts/sync-character-assets.mjs

The same model as the hairs (hair/import_hair.py): an accessory's Handle carries a Roblox attachment (HatAttachment,
FaceFrontAttachment, NeckAttachment, ...) that meets the body part's attachment of the same name, so

    vertex = ATTACHMENT + scale x to_blender( R^T (mesh_scale * raw - position) )

ATTACHMENT is that attachment on our character (ATT below: the classic head's top centre, its face front and centre on
the skull, the top of the torso for the neck, the chest front), scale STUD on the head (the classic head as wide as
ours) and BODY_STUD on the body (our upper torso as wide as Roblox's: the chibi body is not Roblox's). `position`,
`orientation` and `mesh_scale` come from accessories/roblox_attachments.json; while an entry is provisional its position
is fitted here from the item's shape by its `fit` rule (FITS) and written back, so David's Studio values replace them
with no other step. For each item:

  1. import    the raw mesh as Roblox has it (mesh2glb keeps its coordinates), split at its UV seams
  2. place     the shared transform above, after the provisional fit (hats over the hair: HAIR_OVER, over_hair); flat
               paper items (the tie, the bow tie) bend onto the chest they lie on; an entry's override.scale scales the
               mesh before the fit (David, 2026-10-17: the hats bigger, covering the hair)
  3. detail    within the per-asset budget (budget.ts `accessory`, FULL_MAX): an edge collapse that keeps the UV seams,
               then welded and smooth-shaded (kit.weld_normals); LOD 1 is build_lod.py's
  4. colour    its texture, cropped to what the mesh samples, into its tile of the fixed-colour atlas (colour_atlas.py);
               the UVs move there with u + 2, which the body shader draws as the texel itself (never tinted)
  5. export    accessories/roblox/<id>.glb: the 22-bone rig and one mesh, one material (M_Acc), skinned to the head (hats,
               glasses), the neck (scarf, bow tie) or the torso (tie); the catalogue section `robloxAccessories`
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(ART))
for p in (ART, os.path.join(ART, "base"), os.path.join(ART, "skull"), os.path.join(ART, "hair")):
    sys.path.insert(0, p)
import kit  # noqa: E402
import colour_atlas  # noqa: E402
from head_shape import HC, HAIR_ATT, STUD, CLASSIC, CLASSIC_C, head_point, EYE_LAT, EYE_LON, MOUTH_LAT, CHIN  # noqa: E402
import body_shape as B  # noqa: E402
import skull as SK  # noqa: E402
import seat_fit as SF  # noqa: E402  (seat(): a hat's cavity on the classic head, as the hairs)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ONLY = set(ARGS[ARGS.index("--only") + 1].split(",")) if "--only" in ARGS else None
RENDER = ARGS[ARGS.index("--render") + 1] if "--render" in ARGS else None
DATA_PATH = os.path.join(HERE, "roblox_attachments.json")
DATA = json.load(open(DATA_PATH))
PRICING = json.load(open(os.path.join(ROOT, "specs", "wardrobe", "batch2-pricing.json")))["items"]
SRC = os.path.join(HERE, "source", "roblox-b2")
SECTION = "robloxAccessories"

FULL_MAX = 1200          # budget.ts ASSET_CATEGORIES "accessory": an accessory's Full mesh


def full_cap(e):
    """An item's Full triangles (David, 2026-10-17: the character budget stays 7,800, so no more than what shows): the
    glasses, the monocle, the wheat and the blindfold, and the neck items, 350 (their source meshes ran to 1,176 on a
    few hundred pixels); a front item 300; a hat that covers the hair 800 and anything else on the head 780 (the sprout's
    1,176 drew on a few dozen); the hood, which replaces the hair, the full 1,200."""
    if e["group"] in ("face", "neck"):
        return 350
    if e["group"] == "front":
        return 300
    if e.get("hidesBackHair"):
        return FULL_MAX
    return 800 if e.get("coversHair") else 780
# Hats over the hair (David): David's 27 hairstyles stand a median 0.246 stud over our head at the crown (lat 60-90) and
# 0.167 at the sides (lat 20-60), measured 2026-10-17 (rays from the head centre, the hair's outer surface less the head
# mesh). A hat that leaves the hair on (not the bear hood) is seated on the classic head grown by HAIR_OVER, and a piece
# standing on the head (a sprout, a stem, a horn, an ear) moves out by the hair at its foot: it rests on a typical
# hairstyle instead of inside it. Part of the provisional fit.
HAIR_TOP, HAIR_SIDE = 0.246, 0.167
HAIR_OVER = 0.2
VISOR_TOP = 0.05         # stud: a visor's band top this far under the classic head's top (over the hair, at the crown's edge)
FACE_CLEAR = 0.008       # m: glasses and a monocle stand this far in front of the face at the eye line
CHEST_CLEAR = 0.006      # m: a paper tie or bow tie lies this far over the chest (clothes stand CL = 7 mm proud)

# Our attachments (Blender axes: the character faces -Y, +X is its left, +Z up), metres, and the metres per stud there.
NECK = Vector((0.0, B.TORSO[-1][0].y, B.TORSO[-1][0].z))          # the top of the torso: Roblox's NeckAttachment
BODY_STUD = B.SH_HALF * 0.92                                       # our upper torso's half width = Roblox's (1 stud)
ATT = {
    "HatAttachment": (HAIR_ATT, STUD), "HairAttachment": (HAIR_ATT, STUD),
    "FaceFrontAttachment": (CLASSIC_C + Vector((0.0, -CLASSIC["R"] * STUD, 0.0)), STUD),
    "FaceCenterAttachment": (CLASSIC_C, STUD),
    "NeckAttachment": (NECK, BODY_STUD),
    "BodyFrontAttachment": (NECK + Vector((0.0, -0.5 * BODY_STUD, -0.8 * BODY_STUD)), BODY_STUD),
}
TO_BL = np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0]], float)        # Roblox -> Blender: a half turn, no mirror (an involution)
FROM_IMPORT = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)  # Blender's glTF import (x, -z, y) -> raw (x, y, z)


# ================================================================ 1. import
def import_raw(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=False)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    img = next((n.image for s in ob.material_slots if s.material and s.material.use_nodes for n in s.material.node_tree.nodes
                if n.type == "TEX_IMAGE" and n.image and n.image.size[0]), None)
    return ob, img


def pixels(img):
    w, h = img.size
    return np.array(img.pixels[:], np.float32).reshape(h, w, 4)[::-1].copy()       # top row first, sRGB values


SILVER = (np.array([0.68, 0.70, 0.73]), np.array([0.93, 0.94, 0.95]))     # sRGB: the dark and light ends of silver


def silver(px):
    """A texture recoloured silver by its lightness (round 2: #07's silver version): black frames become a mid silver,
    their highlights a near white; alpha kept."""
    out = px.copy()
    lum = px[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    out[..., :3] = SILVER[0] + (SILVER[1] - SILVER[0]) * lum[..., None]
    return out


# ================================================================ 2. place
def item_scale(e):
    """The mesh scale: Roblox's (mesh_scale) times the entry's override.scale (David, 2026-10-17: the hats bigger, so they
    cover the hair; #07 smaller)."""
    return np.diag([float(c) for c in e["mesh_scale"]]) * float((e.get("override") or {}).get("scale", 1.0))


def raw_studs(ob, e):
    """The item in Blender axes and studs before its position: to_blender(R^T (mesh_scale * raw)), one row a vertex."""
    R = SF.rot_orientation(e["orientation"])
    S = item_scale(e)
    co = np.array([v.co[:] for v in ob.data.vertices], float)
    return (TO_BL @ R.T @ S @ FROM_IMPORT @ co.T).T


def place_matrix(e):
    """The 4x4 from the imported mesh to our character: the shared transform with the entry's position (and override)."""
    R = SF.rot_orientation(e["orientation"])
    S = item_scale(e)
    att, k = ATT[e["attachment"]]
    L = k * TO_BL @ R.T @ S @ FROM_IMPORT
    off = np.asarray((e.get("override") or {}).get("offset", [0, 0, 0]), float)
    t = np.array(att[:]) - k * TO_BL @ R.T @ np.asarray(e["position"], float) + k * TO_BL @ off
    return Matrix([list(L[0]) + [t[0]], list(L[1]) + [t[1]], list(L[2]) + [t[2]], [0, 0, 0, 1]])


def torso_front(x, z, off):
    """The torso's front surface (y) at x and height z, grown by off (body_shape's torso rings)."""
    c, rx, ry = B.torso_at(z, off)
    return c.y - ry * math.sqrt(max(0.0, 1.0 - min(1.0, (x / rx) ** 2)))


def fit_shift(vb, e):
    """Provisional fits: the shift (Blender axes, studs) that puts the item where its rule says. vb: raw_studs."""
    att, k = ATT[e["attachment"]]
    A = np.array(att[:])
    W = A + k * vb                                   # world (m) with no position: the shift is (target - here) / k
    lo, hi = vb.min(0), vb.max(0)
    rule = e["fit"]
    if rule == "seat":                               # a hat: its cavity seated on the classic head, as the hairs' seat fit,
        from mathutils.bvhtree import BVHTree         # grown by the hair it is worn over (HAIR_OVER; the hood hides it)
        F = [list(p.vertices) for p in FIT_OB.data.polygons]
        tree = BVHTree.FromPolygons([Vector(x) for x in vb], F)
        return SF.seat(tree, vb, grow=0.0 if e["hidesBackHair"] else HAIR_OVER)
    if rule == "top":                                # a sprig or stem: its lowest point on the top centre
        return np.array([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    if rule == "ears":                               # ears with a banana: the middle piece's foot on the top centre
        mid = np.abs(vb[:, 0]) < 0.25
        return np.array([-(lo[0] + hi[0]) / 2, -(vb[mid, 1].min() + vb[mid, 1].max()) / 2, -vb[mid, 2].min()])
    if rule in ("eyes", "eye_r"):
        front = vb[:, 1] < lo[1] + 0.12               # the lenses or the ring: the frontmost slab
        if rule == "eye_r":                           # the ring: the monocle's largest piece (David, 2026-10-17: its top
            front = np.zeros(len(vb), bool)            # part took the chain's clip too, and stood 27 cm off the eye)
            front[max(pieces(FIT_OB, gap=0.0), key=len)] = True
        P = W[front]
        cx, cz = (P[:, 0].min() + P[:, 0].max()) / 2, (P[:, 2].min() + P[:, 2].max()) / 2
        eye = head_point(EYE_LAT, -EYE_LON if rule == "eye_r" else 0.0)
        ex = eye.x if rule == "eye_r" else 0.0
        # every vertex of the lenses (or the ring) FACE_CLEAR in front of the head mesh where it lies, after the move
        Q = P + np.array([ex - cx, 0.0, eye.z - cz])
        gaps = []
        for q in Q:
            hit = HEAD_TREE.ray_cast(Vector((q[0], -0.6, q[2])), Vector((0, 1, 0)), 1.2)[0]
            if hit is not None:
                gaps.append(hit.y - FACE_CLEAR - q[1])
        dy = min(gaps) if gaps else 0.0
        return np.array([ex - cx, dy, eye.z - cz]) / k
    if rule == "mouth":                              # a stalk: its thin end at the mouth's corner, the grain outward
        c = vb.mean(0)
        _, _, vt = np.linalg.svd(vb - c, full_matrices=False)
        axis = vt[0]
        s = (vb - c) @ axis
        a, b = vb[s.argmin()], vb[s.argmax()]
        near = lambda p: (np.linalg.norm(vb - p, axis=1) < 0.08).sum()
        end, tip = (a, b) if near(a) < near(b) else (b, a)
        side = 1.0 if tip[0] > end[0] else -1.0
        corner = head_point(MOUTH_LAT + 2.0, side * float(e.get("mouth_lon", 13.0)))      # #10: a little more centred
        return (np.array(corner[:]) + np.array([0, -0.004, 0]) - (A + k * end)) / k
    if rule == "visor":                              # a visor (#04): its band round the hair, its top rim at VISOR_TOP
        rim = vb[:, 2] > hi[2] - 0.25 * (hi[2] - lo[2])
        c = np.array([(vb[rim, 0].min() + vb[rim, 0].max()) / 2, (vb[rim, 1].min() + vb[rim, 1].max()) / 2, hi[2]])
        return (np.array([CLASSIC_C.x, CLASSIC_C.y, HAIR_ATT.z - VISOR_TOP * STUD]) - (A + k * c)) / k
    if rule == "band":                               # a band round the head: on its axis, its middle at the eye line
        eye = head_point(EYE_LAT, EYE_LON)
        c = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2])
        return (np.array([CLASSIC_C.x, CLASSIC_C.y, eye.z]) - (A + k * c)) / k
    if rule == "neck":                               # a scarf: round the neck axis, its top just under the chin
        top = vb[:, 2] > hi[2] - 0.3 * (hi[2] - lo[2])
        cx, cy = (vb[top, 0].min() + vb[top, 0].max()) / 2, (vb[top, 1].min() + vb[top, 1].max()) / 2
        return (np.array([0.0, NECK.y, CHIN - 0.004]) - (A + k * np.array([cx, cy, hi[2]]))) / k
    if rule in ("collar", "chest"):                  # paper on the chest: centred, its top at the collar (bent on later)
        top_z = NECK.z - (0.012 if rule == "collar" else 0.022)
        return (np.array([0.0, torso_front(0.0, top_z, CHEST_CLEAR), top_z]) - (A + k * np.array([(lo[0] + hi[0]) / 2, lo[1], hi[2]]))) / k
    raise ValueError(f"unknown fit {rule}")


def fit(ob, e):
    """The provisional position (studs, the Handle's frame) from the fit's shift: vb + t = to_blender(R^T (s raw - p))."""
    global FIT_OB
    FIT_OB = ob
    t = fit_shift(raw_studs(ob, e), e)
    R = SF.rot_orientation(e["orientation"])
    return [round(float(x), 5) for x in -(R @ (TO_BL @ t))]


def drop_outline(ob, box):
    """A cartoon item's outline shell (#18's drawn hat: an inverted hull a little outside the hat, every face on one black
    swatch of the texture, wound inward so Roblox culls it but at the silhouette) goes: our body draws both sides, so it
    would cover the hat in black. box: that swatch, [u0, v0, u1, v1] in the source's glTF UVs (top-left origin)."""
    u0, v0, u1, v1 = box
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.active
    drop = [f for f in bm.faces if all(u0 <= l[uv].uv.x <= u1 and v0 <= 1.0 - l[uv].uv.y <= v1 for l in f.loops)]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    print(f"OUTLINE {ob.name}: {len(drop)} faces dropped")


def pieces(ob, gap=0.006):
    """The item's pieces: its connected parts (welded by position), parts closer than `gap` (m) joined into one (a leaf
    on its stem). A list of vertex index arrays."""
    me = ob.data
    co = np.array([v.co[:] for v in me.vertices], float)
    parent = np.arange(len(co))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    seen = {}
    for i, k in enumerate(map(tuple, np.round(co / 1e-5).astype(np.int64))):
        if k in seen:
            union(seen[k], i)
        else:
            seen[k] = i
    for p in me.polygons:
        vs = list(p.vertices)
        for v in vs[1:]:
            union(vs[0], v)
    roots = np.array([find(i) for i in range(len(co))])
    parts = [np.nonzero(roots == r)[0] for r in np.unique(roots)]
    from mathutils.kdtree import KDTree
    trees = []
    for idx in parts:
        t = KDTree(len(idx))
        for j, i in enumerate(idx):
            t.insert(Vector(co[i]), j)
        t.balance()
        trees.append(t)
    group = list(range(len(parts)))

    def gfind(i):
        while group[i] != i:
            i = group[i]
        return i
    for a in range(len(parts)):
        for b in range(a + 1, len(parts)):
            if gap > 0 and gfind(a) != gfind(b) and any(trees[b].find(Vector(co[i]))[2] < gap for i in parts[a]):
                group[gfind(b)] = gfind(a)
    out = {}
    for k, idx in enumerate(parts):
        out.setdefault(gfind(k), []).append(idx)
    return [np.concatenate(v) for v in out.values()]


def over_hair(ob):
    """Hats over the hair: each piece standing on the head moves out from the head centre, through its foot (the middle of
    its points nearest the head's centre), by the hair a typical hairstyle has there (HAIR_SIDE at the sides to HAIR_TOP
    over the crown)."""
    co = np.array([v.co[:] for v in ob.data.vertices], float)
    centre = np.array(HC[:])
    for idx in pieces(ob):
        d = np.linalg.norm(co[idx] - centre, axis=1)
        foot = co[idx][d <= d.min() + 0.1 * (d.max() - d.min())].mean(0)
        n = (foot - centre) / np.linalg.norm(foot - centre)
        lat = math.degrees(math.asin(max(-1.0, min(1.0, n[2]))))
        t = min(1.0, max(0.0, (lat - 20.0) / 40.0))
        co[idx] += n * (HAIR_SIDE + t * (HAIR_TOP - HAIR_SIDE)) * STUD
    for v, c in zip(ob.data.vertices, co):
        v.co = c
    ob.data.update()


def bend_onto_chest(ob):
    """A flat paper item lies on the chest: each vertex moves to CHEST_CLEAR over the torso's front at its x and z."""
    back = max(v.co.y for v in ob.data.vertices)          # the side toward the chest (the paper keeps its thickness)
    for v in ob.data.vertices:
        v.co.y = torso_front(v.co.x, v.co.z, CHEST_CLEAR) + (v.co.y - back)
    ob.data.update()


# ================================================================ 3. detail
def decimate(ob, max_tris, recalc=False):
    """Edge collapse to max_tris on the welded mesh (the importer splits every corner; collapsing that shreds thin rims
    and tears the texture): the collapse keeps the UV seams, which stay per corner. recalc (an entry's
    `recalc_normals`): a source whose faces wind every which way (#18's drawn hat: half of them against its own normals)
    is wound outward consistently, its own normals dropped for the faces'."""
    if recalc:
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    for _ in range(6):
        n = kit.ntris(ob)
        if n <= max_tris:
            break
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        md = ob.modifiers.new("Budget", "DECIMATE")
        md.decimate_type = "COLLAPSE"
        md.ratio = max_tris / n * 0.98
        md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="Budget")
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-12], context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.validate()
    ob.data.update()
    return kit.ntris(ob)


# ================================================================ 5. export
def finish(ob, rig, e):
    me = ob.data
    mat = bpy.data.materials.get("M_Acc") or kit.material("M_Acc", "#FFFFFF")
    me.materials.clear()
    me.materials.append(mat)
    if "Color" not in me.color_attributes:
        me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    col = me.color_attributes["Color"]
    for p in me.polygons:
        p.use_smooth = True
        p.material_index = 0
        for li in p.loop_indices:
            col.data[li].color = (1, 1, 1, 1)
    me.color_attributes.active_color = col
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    ob["normals_welded"] = kit.weld_normals(me)
    ob.name = me.name = e["id"]
    ob.parent = rig
    ob.modifiers.new("Armature", "ARMATURE").object = rig
    region = {"head": "head", "face": "head", "neck": "neck", "front": "torso"}[e["group"]]
    groups = {}
    for v in me.vertices:
        for bn, x in B.weights(region, v.co).items():
            if x > 1e-4:
                if bn not in groups:
                    groups[bn] = ob.vertex_groups.new(name=kit.BONE + bn)
                groups[bn].add([v.index], x, "REPLACE")
    return ob


def render(out, ob, e, head, body, img):
    """Review renders before the UVs move: the item in its own texture on the head (and the body for the neck and the
    front), front and three-quarter, Workbench."""
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.render.resolution_x = sc.render.resolution_y = 360
    cam = bpy.data.objects.get("FitCam") or bpy.data.objects.new("FitCam", bpy.data.cameras.new("FitCam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    body_item = e["group"] in ("neck", "front")
    cam.data.ortho_scale = 0.75 if body_item else (0.42 if e["group"] == "face" else 0.95)
    sc.camera = cam
    shown = (ob, head, cam, *(body if body_item else []))
    for o in sc.objects:
        o.hide_render = o not in shown
    centre = (HC + NECK) / 2 if body_item else head_point(EYE_LAT, 0.0) * 0 + Vector((0, 0, head_point(EYE_LAT, 0.0).z)) if e["group"] == "face" else HC + Vector((0, 0, 0.12))
    for name, yaw in (("front", 0), ("34", 40)):
        a = math.radians(yaw)
        cam.location = centre + Vector((-math.sin(a) * 3, -math.cos(a) * 3, 0.0))
        cam.rotation_euler = (math.radians(90), 0, -a)
        sc.render.filepath = os.path.join(out, f"{e['id']}_{name}.png")
        bpy.ops.render.render(write_still=True)


def solid(ob, hexcol):
    m = kit.material(ob.name + "_review", hexcol)
    ob.data.materials.clear()
    ob.data.materials.append(m)


def main():
    global HEAD_TREE
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = kit.load_rig(bpy.context.scene)
    body = []
    with bpy.data.libraries.load(os.path.join(ART, "skull", "head.blend"), link=False) as (_s, _d):
        _d.objects = ["V8_Head"]
    head = _d.objects[0]
    bpy.context.scene.collection.objects.link(head)
    head.parent = None
    head.matrix_world = Matrix.Identity(4)                 # its vertices are the skull in world space
    for md in list(head.modifiers):
        head.modifiers.remove(md)
    from mathutils.bvhtree import BVHTree
    HEAD_TREE = BVHTree.FromPolygons([v.co.copy() for v in head.data.vertices], [list(p.vertices) for p in head.data.polygons])
    if RENDER:
        solid(head, "#E8B796")
        cat0 = json.load(open(os.path.join(ART, "character_catalog.json")))
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ART, cat0["base"]["clips_glb"]))
        new = [o for o in bpy.data.objects if o not in before]
        for o in new:
            if o.type == "ARMATURE":
                o.data.pose_position = "REST"
        body = [o for o in new if o.type == "MESH" and o.name.split(".")[0] not in ("V8_Head", "V7_Head")
                and max((o.matrix_world @ Vector(c)).z for c in o.bound_box) < HC.z]          # the body below the head
        for o in body:
            solid(o, "#E8B796")
    print(f"ATT neck {tuple(round(c, 3) for c in NECK)} body_stud {BODY_STUD:.3f} stud {STUD:.3f} chin {CHIN:.3f} face_front "
          f"{tuple(round(c, 3) for c in ATT['FaceFrontAttachment'][0])} eye {tuple(round(c, 3) for c in head_point(EYE_LAT, EYE_LON))}")
    entries, report = {}, []
    for e in DATA["items"]:
        if PRICING.get(e["key"], {}).get("mode") == "skip":
            continue
        if ONLY and e["id"] not in ONLY:
            continue
        ob, img = import_raw(os.path.join(SRC, e["file"]))
        src_tris = kit.ntris(ob)
        if e.get("drop_outline"):
            drop_outline(ob, e["drop_outline"])
        if e["provisional"]:
            e["position"] = fit(ob, e)
        ob.data.transform(place_matrix(e))
        ob.data.update()
        if e["fit"] in ("collar", "chest"):
            bend_onto_chest(ob)
        if e["provisional"] and e["fit"] in ("top", "ears"):
            over_hair(ob)
        tris = decimate(ob, full_cap(e), recalc=bool(e.get("recalc_normals")))
        co = np.array([v.co[:] for v in ob.data.vertices])
        e_box = (np.round(co.min(0), 3).tolist(), np.round(co.max(0), 3).tolist())
        if RENDER:
            render(RENDER, ob, e, head, body, img)
        px = pixels(img)
        if e.get("texture") == "silver":
            px = silver(px)
        hh, ww = px.shape[:2]
        box = colour_atlas.crop_of(ob.data, ww, hh)
        colour_atlas.claim(e["id"], px[box[1]:box[3], box[0]:box[2]])
        colour_atlas.remap(ob.data, e["id"], box, (ww, hh))
        ob = finish(ob, rig, e)
        rel = f"accessories/roblox/{e['id']}.glb"
        kit.export(ob, rig, os.path.join(ART, rel))
        entries[e["id"]] = {
            "id": e["id"], "slot": "accessory", "name": e["name"], "glb": rel, "tris": kit.ntris(ob),
            "materials": [{"name": "M_Acc", "tint": None, "color": "#FFFFFF"}], "decalSlot": None,
            "hidesBackHair": bool(e["hidesBackHair"]), "hides": [], "group": e["group"], "skull": SK.VERSION,
            "key": e["key"], "source": f"accessories/source/roblox-b2/{e['file']}",
            "roblox": {"provisional": bool(e["provisional"]), "attachment": e["attachment"]}, "colourAtlas": True,
            **({"coversHair": True, "hatCut": [x["key"] for x in DATA["items"] if x.get("coversHair")].index(e["key"])} if e.get("coversHair") else {}),
            **({"hatCut": e["hatCut"]} if e.get("hatCut") is not None and not e.get("coversHair") else {}),   # a band (#04's visor)
            **({"coversHead": True} if e.get("coversHead") else {}),
        }
        report.append(f"IMPORT {e['id']:24s} src_tris={src_tris} tris={kit.ntris(ob)} {e['attachment']} fit={e['fit']} "
                      f"position={e['position']} orientation={e['orientation']} box={e_box} tile={colour_atlas.LAYOUT[e['id']]} crop={box}")
        print(report[-1])
        me = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(me)
    colour_atlas.save()
    json.dump(DATA, open(DATA_PATH, "w"), indent=1)
    cat_path = os.path.join(ART, "character_catalog.json")
    cat = json.load(open(cat_path))
    old = {p["id"]: p for p in cat.get(SECTION, [])}
    order = [e["id"] for e in DATA["items"] if PRICING.get(e["key"], {}).get("mode") != "skip"]
    cat[SECTION] = [entries.get(k) or old[k] for k in order if k in entries or k in old]
    json.dump(cat, open(cat_path, "w"), indent=1)
    print("IMPORT_ROBLOX_OK", len(entries))


FIT_OB = HEAD_TREE = None
main()
