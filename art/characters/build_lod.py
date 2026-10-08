"""Character LOD 1 (specs/perf/2026-10-results.md): every catalogue part, and the base body's skin, decimated for
characters seen small (far players, residents, patrons; the local player only far out), on the same 22-bone rig and
weights. The engine binds parts by bone name (lib/game/character/rig.ts), so a LOD part drops in for its full part.

    /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/build_lod.py [-- part_id ...]
    node web/scripts/sync-character-assets.mjs

Writes art/characters/lod1/<the part's own path> and lod1/base/skin.glb (the base's M_Skin only: the face, the head
and the clips stay the full base's). Per piece (one material of a part): an edge-collapse decimate to the first of
RATIOS whose shape stays within TOLERANCE of the full piece (otherwise the piece stays whole), the skin weights
interpolated with it, then the part's own shading again (kit.py finish: smooth faces, sharp edges over 40 degrees).
Pieces under KEEP triangles, the painted face (M_Face), the head it lies on and the shirt print (M_Decal) are kept as
they are. Writes lod1/lod.json: the triangles before and after per GLB. render_lod.py draws every pair side by side.
"""
import bpy, bmesh, json, math, os, sys
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
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
COVER = 0.004
KEEP = 120
SHARP = math.radians(40.0)
PROTECT = {"M_Face", "M_Decal"}
# The v7 head's skin stays whole: the painted face (M_Face) is a shell over it that a decimated head would cut through.
PROTECT_OBJECTS = ("V7_Head",)


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


def tree(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    t = BVHTree.FromBMesh(bm)
    verts = [v.co.copy() for v in bm.verts]
    bm.free()
    return t, verts


def deviation(full, lod):
    """(furthest either way, furthest outward, furthest inward) of the LOD against the full piece, by the surfaces'
    outward normals: a LOD vertex outside the full surface rose; inside it, or a full vertex outside the LOD's, sank."""
    (tf, vf), (tl, vl) = tree(full), tree(lod)
    far = out = sink = 0.0
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


def decimate(ob, under):
    """Decimate `ob` in place at the first ratio that keeps its shape (`under`: something lies on it); returns the
    ratio, or None (kept whole)."""
    for ratio in RATIOS:
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
        far, out, sink = deviation(ob, trial)
        if far <= TOLERANCE and sink <= SNUG and (out <= SNUG or not under):
            old = ob.data
            ob.data = trial.data
            bpy.data.objects.remove(trial)
            bpy.data.meshes.remove(old)
            reshade(ob)
            return ratio
        mesh = trial.data
        bpy.data.objects.remove(trial)
        bpy.data.meshes.remove(mesh)
    return None


def build(src, dst, skin_only=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
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
            decimate(ob, under[ob.name])
        after += ntris(ob)
        kept.append(ob)
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
    parts = CAT["outfits"] + CAT["accessories"] + CAT["hair"]
    report = {}
    if not only or "base" in only:
        report["base/skin.glb"] = build(os.path.join(HERE, CAT["base"]["clips_glb"]), os.path.join(OUT, "base", "skin.glb"), skin_only=True)
    for p in parts:
        if only and p["id"] not in only:
            continue
        report[p["glb"]] = build(os.path.join(HERE, p["glb"]), os.path.join(OUT, p["glb"]))
    path = os.path.join(OUT, "lod.json")
    old = json.load(open(path)) if only and os.path.exists(path) else {}
    old.update({k: {"tris": v[0], "lod1": v[1]} for k, v in report.items()})
    json.dump(dict(sorted(old.items())), open(path, "w"), indent=1)
    total = sum(v[0] for v in report.values()), sum(v[1] for v in report.values())
    print(f"LOD1: {len(report)} GLBs, {total[0]} -> {total[1]} triangles")


main()
