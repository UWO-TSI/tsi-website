"""Character LOD 1 (specs/perf/2026-10-results.md): every catalogue part, and the base body's skin, decimated for
characters seen small (far players, residents, patrons; the local player only far out), on the same 22-bone rig and
weights. The engine binds parts by bone name (lib/game/character/rig.ts), so a LOD part drops in for its full part.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/build_lod.py [-- part_id ...]
    node web/scripts/sync-character-assets.mjs

Writes art/characters/lod1/<the part's own path> and lod1/base/skin.glb (the base's M_Skin only: the face, the head
and the clips stay the full base's). Per piece (one material of a part): an edge-collapse decimate to the first of
RATIOS whose shape stays within TOLERANCE of the full piece (otherwise the piece stays whole), the skin weights
interpolated with it, then the part's own shading again (kit.py finish: smooth faces, sharp edges over 40 degrees; a
strand-card hairstyle keeps its full mesh's smooth normals, card_normals).
Pieces under KEEP triangles, the painted face (M_Face), the head it lies on and the shirt print (M_Decal) are kept as
they are. Writes lod1/lod.json: the triangles before and after per GLB. render_lod.py draws every pair side by side.
"""
import bpy, bmesh, json, math, os, sys
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import kit  # noqa: E402  (weld_normals: the hairstyles' smooth normals)
OUT = os.path.join(HERE, "lod1")
CAT = json.load(open(os.path.join(HERE, "character_catalog.json")))
RATIOS = (0.5, 0.65, 0.8)
# The LOD may stray from the full shape by at most TOLERANCE (rig units: 1.045 tall) either way: no LOD vertex further
# from the full surface, and no full vertex further from the LOD's (a lost thin feature: a glasses bridge). Layered
# pieces keep their order: nothing sinks more than SNUG into what it lies on (a sleeve into the arm, hair into the
# head), and a piece something else lies on (the skin under clothes, a top under its stripes or print: COVER apart)
# rises at most SNUG through it. A piece that can't keep within these at any ratio stays whole.
TOLERANCE = 0.012
SNUG = 0.003
# Lock hair (M_Hair) may sink a little more into the head it lies on: 4 mm is a fifth of a pixel on a character drawn
# under 72 px (LOD 1's line); on the v8 head the default fringe and bob sank 3.3-3.8 mm at every ratio and stayed whole.
SNUG_HAIR = 0.004
# Strand-card hair (import_hair.py's full styles): collapse takes whole thin cards, so the furthest strand tip always
# strays; the LOD keeps 95% of the hair's surface (both ways) within TOLERANCE instead.
CARD_QUANTILE = 0.95
COVER = 0.004
KEEP = 120
SHARP = math.radians(40.0)
PROTECT = {"M_Face", "M_Decal"}
# The head's skin stays whole: the painted face (M_Face) is a shell over it that a decimated head would cut through.
PROTECT_OBJECTS = ("V7_Head", "V8_Head")


def ntris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def material_of(ob):
    return ob.material_slots[0].material.name if ob.material_slots and ob.material_slots[0].material else ""


def reshade(ob):
    """kit.py finish's shading: every face smooth, an edge sharp where its faces meet at more than 40 degrees."""
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    edge_faces = {}
    for p in me.polygons:
        for k in p.edge_keys:
            edge_faces.setdefault(k, []).append(p.index)
    for e in me.edges:
        fs = edge_faces.get(e.key, [])
        e.use_edge_sharp = len(fs) != 2 or me.polygons[fs[0]].normal.angle(me.polygons[fs[1]].normal, 0.0) > SHARP


def card_normals(ob, full):
    """Strand-card hair (head-v10, row 311: "check that LOD 1 isn't faceted"): each decimated corner takes the smooth
    normal of the nearest full corner on the same side of its card (a full corner whose normal turns away from the
    LOD face is the card's other side, or the under-cap below it: skipped), then any corner left split is welded
    (kit.weld_normals). Not reshade's sharp edges over 40 degrees, which faceted every card the collapse bent."""
    from mathutils.kdtree import KDTree
    fl = full.loops
    fn = [tuple(full.corner_normals[i].vector) for i in range(len(fl))]
    kd = KDTree(len(fl))
    for i, lp in enumerate(fl):
        kd.insert(full.vertices[lp.vertex_index].co, i)
    kd.balance()
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    out = []
    for p in me.polygons:
        n = p.normal
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            pick = tuple(n)
            for _, i, _ in kd.find_n(co, 16):
                if n.dot(fn[i]) > 0.2:
                    pick = fn[i]
                    break
            out.append((li, pick))
    ln = [None] * len(me.loops)
    for li, v in out:
        ln[li] = v
    me.normals_split_custom_set(ln)
    kit.weld_normals(me)


def tree(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    t = BVHTree.FromBMesh(bm)
    verts = [v.co.copy() for v in bm.verts]
    bm.free()
    return t, verts


def deviation(full, lod, quantile=None):
    """(furthest either way, furthest outward, furthest inward) of the LOD against the full piece, by the surfaces'
    outward normals: a LOD vertex outside the full surface rose; inside it, or a full vertex outside the LOD's, sank.
    quantile: "furthest either way" is that share of the full piece's vertices instead of all of them (strand cards: a
    few strand tips may go at LOD 1's size, as long as the hair's surface stays)."""
    (tf, vf), (tl, vl) = tree(full), tree(lod)
    far = out = sink = 0.0
    if quantile is not None:
        ds = []
        for v in vf:
            p, n, _, d = tl.find_nearest(v)
            if p is None:
                return math.inf, math.inf, math.inf
            ds.append(d)
        for v in vl:
            p, n, _, d = tf.find_nearest(v)
            if p is None:
                return math.inf, math.inf, math.inf
            ds.append(d)
        ds.sort()
        return ds[int(quantile * (len(ds) - 1))], 0.0, 0.0
    for v in vl:
        p, n, _, d = tf.find_nearest(v)
        if p is None:
            return math.inf, math.inf, math.inf
        s = (v - p).dot(n)
        far, out, sink = max(far, d), max(out, s), max(sink, -s)
    for v in vf:
        p, n, _, d = tl.find_nearest(v)
        if p is None:
            return math.inf, math.inf, math.inf
        far, sink = max(far, d), max(sink, (v - p).dot(n))
    return far, out, sink


def covered(ob, others):
    """Another piece lies on this one (within COVER of its surface)."""
    t, _ = tree(ob)
    for o in others:
        for v in tree(o)[1]:
            p = t.find_nearest(v, COVER)[0]
            if p is not None:
                return True
    return False


# David's hairstyles by tier (head-roblox, David 2026-10-14: "lower poly like 2400 triangles for hair when far ... but hair
# should look good close up"): Full is the original Roblox mesh; LOD 1 (mid) at most CARD_MAX["lod1"], its shape kept
# where a ratio under that keeps it; LOD 2 (far, lod2/) about CARD_MAX["lod2"]
CARD_MAX = {"lod1": 2400, "lod2": 1100}
OUT2 = os.path.join(HERE, "lod2")
# David's Roblox accessories (wardrobe batch 2, accessories/import_roblox.py): Full holds the accessory budget (1,200);
# LOD 1 at most ACC_LOD1_MAX, its shape kept where a ratio under that keeps it, else the ratio that lands there
ACC_LOD1_MAX = 600


def decimate(ob, under, cards=False, snug=SNUG, tier="lod1", cap=None):
    """Decimate `ob` in place at the first ratio that keeps its shape (`under`: something lies on it); returns the
    ratio, or None (kept whole). Card hair only tries ratios that land under its tier's CARD_MAX, and takes the
    largest of them when none keeps the shape (LOD 2 always: it is drawn far and small)."""
    n = ntris(ob)
    ratios = RATIOS
    card_max = CARD_MAX[tier]
    if cap is not None and n > cap:            # a capped piece (a Roblox accessory): ratios under the cap, else the cap
        ratios = tuple(r for r in RATIOS if n * r <= cap) or (cap / n,)
    if cards:
        ratios = (card_max / n,) if tier == "lod2" else tuple(r for r in RATIOS if n * r <= card_max) or (card_max / n,)
        if n <= card_max * 1.02 and tier == "lod1":
            return None                                      # already within the mid tier: kept whole
    for k, ratio in enumerate(ratios):
        trial = ob.copy()
        trial.data = ob.data.copy()
        bpy.context.scene.collection.objects.link(trial)
        bpy.ops.object.select_all(action="DESELECT")
        trial.select_set(True)
        bpy.context.view_layer.objects.active = trial
        mod = trial.modifiers.new("LOD", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        # Above the armature: the rest shape is decimated, not the posed one.
        bpy.ops.object.modifier_move_to_index(modifier="LOD", index=0)
        bpy.ops.object.modifier_apply(modifier="LOD")
        far, out, sink = deviation(ob, trial, CARD_QUANTILE if cards else None)
        if os.environ.get("LOD_DEBUG"):
            print("LODDBG", ob.name, ratio, round(far, 4), round(out, 4), round(sink, 4), under)
        # cards: strand-card hair (thin open sheets over its own opaque under-cap) has no inside to sink into, so only
        # the shape tolerance holds it (the sign of a sheet's normal says nothing about sinking)
        last_card = (cards and k == len(ratios) - 1 and n > card_max) or (cap is not None and n > cap and k == len(ratios) - 1)
        if (far <= TOLERANCE and (cards or (sink <= snug and (out <= SNUG or not under)))) or last_card:
            old = ob.data
            ob.data = trial.data
            bpy.data.objects.remove(trial)
            if cards:
                card_normals(ob, old)
            else:
                reshade(ob)
            bpy.data.meshes.remove(old)
            return ratio
        mesh = trial.data
        bpy.data.objects.remove(trial)
        bpy.data.meshes.remove(mesh)
    return None


def build(src, dst, skin_only=False, merge=True, cards=False, tier="lod1", cap=None):
    """cards (head fit: import_hair.py's full styles, imported unmerged): welded here with the non-manifold junctions
    split, so the collapse can reduce them without shredding the cards."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src, merge_vertices=merge)
    if cards:   # strand cards welded (collapse shreds them unwelded), with the edges where three cards meet split (the
        for ob in [o for o in bpy.data.objects if o.type == "MESH"]:      # collapse stalls on them)
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
            bmesh.ops.split_edges(bm, edges=[e for e in bm.edges if len(e.link_faces) > 2])
            bm.to_mesh(ob.data)
            bm.free()
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    for ob in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        if len(ob.material_slots) > 1:
            bpy.ops.mesh.separate(type="MATERIAL")
    before = after = 0
    kept = []
    pieces = [o for o in bpy.data.objects if o.type == "MESH"]
    # Before any is decimated: which pieces something lies on (the base's skin always: it is under every outfit).
    under = {o.name: skin_only or covered(o, [x for x in pieces if x is not o]) for o in pieces}
    for ob in pieces:
        name = material_of(ob)
        whole = name in PROTECT or ob.name.startswith(PROTECT_OBJECTS)
        if skin_only and name != "M_Skin":
            bpy.data.objects.remove(ob)
            continue
        n = ntris(ob)
        before += n
        if not whole and n >= KEEP:
            decimate(ob, under[ob.name], cards=cards and material_of(ob) == "M_Hair",
                     snug=SNUG_HAIR if material_of(ob) == "M_Hair" else SNUG, tier=tier, cap=cap)
        after += ntris(ob)
        kept.append(ob)
    if cards:                       # David's hairstyles: the collapse leaves a few degenerate faces in the card sheets
        for ob in kept:
            ob.data.validate()
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for ob in kept:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=dst, export_format="GLB", use_selection=True, export_yup=True, export_normals=True, export_texcoords=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=True, export_animations=False,
        export_leaf_bone=False)
    return before, after


def main():
    only = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else set()
    parts = CAT["outfits"] + CAT["accessories"] + CAT["hair"] + CAT.get("robloxAccessories", [])   # + David's Roblox accessories (wardrobe batch 2)
    report = {}
    if not only or "base" in only:
        report["base/skin.glb"] = build(os.path.join(HERE, CAT["base"]["clips_glb"]), os.path.join(OUT, "base", "skin.glb"), skin_only=True)
    report2 = {}
    for p in parts:
        if only and p["id"] not in only:
            continue
        report[p["glb"]] = build(os.path.join(HERE, p["glb"]), os.path.join(OUT, p["glb"]), merge=not p.get("full"), cards=bool(p.get("full")),
                                 cap=ACC_LOD1_MAX if p["glb"].startswith("accessories/roblox/") else None)
        if p.get("full"):           # the far tier: whole hairstyles only (everything else draws its LOD 1 there)
            report2[p["glb"]] = build(os.path.join(HERE, p["glb"]), os.path.join(OUT2, p["glb"]), merge=False, cards=True, tier="lod2")
    live = {"base/skin.glb"} | {p["glb"] for p in parts}
    for out, rep, key in ((OUT, report, "lod1"), (OUT2, report2, "lod2")):
        path = os.path.join(out, "lod.json")
        # A part cut from the catalogue leaves the report on any run (delete its GLB in lod1/ by hand).
        old = {k: v for k, v in json.load(open(path)).items() if k in live} if only and os.path.exists(path) else {}
        old.update({k: {"tris": v[0], key: v[1]} for k, v in rep.items()})
        json.dump(dict(sorted(old.items())), open(path, "w"), indent=1)
    total = sum(v[0] for v in report.values()), sum(v[1] for v in report.values())
    print(f"LOD1: {len(report)} GLBs, {total[0]} -> {total[1]} triangles")
    if report2:
        print(f"LOD2: {len(report2)} GLBs, {sum(v[0] for v in report2.values())} -> {sum(v[1] for v in report2.values())} triangles")


main()
