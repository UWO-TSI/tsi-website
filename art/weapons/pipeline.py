"""The weapon pipeline (design bible, Models rules 2 to 6; design sheet §1.5): a signature weapon's high-def models in,
one per tier, the low-poly for each reduced from it, both checked against the game's rules, exported, and laid out on
one review sheet for David.

  Blender -b --factory-startup -P art/weapons/pipeline.py -- --out <dir> --lp-tris 1000 \
      --hd aegis-oak=<hd.glb> ... [--old aegis-oak=<old.glb> ...] [--require M_Brass,M_Cloth,M_Iron,M_Wood]

The high-defs come from the weapon's own Blender script: a shaped mesh, not a stack of primitives (Models rule 3).
--lp-from gives, per tier, the same script's lower-detail build (its small detail off) to reduce instead of the
high-def: one design, so the low-poly's budget goes on the shape. It's still checked against the high-def.
Nodes keep their names and transforms: the main node (held in the weapon hand) and `OffHand` (the other hand, parked
on the back; components/game/character/Character.tsx holdOffHand). Authoring frame as art/props-enemies/build_weapons.py:
the grip at the origin (the hand socket), the long axis +Z, the front -Y, rig units (the engine scales by 1.3).

Writes <out>/hd/<key>.glb (close-ups), <out>/<key>.glb (the low-poly, for the world) and <out>/review.png (a row per
tier: the high-def close up, then the low-poly and the old model at world size with the game's pixel finish). With
--out web/public/assets/game/weapons the low-poly lands where the island loads it (ISLAND_WEAPONS) and the high-def
under hd/; then run web/scripts/pack-glbs.mjs on both.

Checks (any failure exits 1 and names it):
- each file holds only a main node and, optionally, `OffHand`, one mesh each;
- both versions closed and manifold: no open or non-manifold edges (Models rule 3); extra loose pieces are reported;
- only the trim kit's materials (KIT), and across the tiers every one in --require, on the high-defs and on the
  low-polys, which are the world copies (the class's skins and mastery trim recolour by these names:
  lib/combat/*Kits.ts WEAPON_SKINS and look.trim);
- the low-poly within --lp-tris, the high-def above it;
- the low-poly's silhouette matches the high-def's from the front, the side and above (IoU >= MIN_IOU).
UVs missing on a mesh are generated (Smart UV Project) and reported.
"""
import argparse
import math
import os
import sys

import bpy  # before bmesh: outside Blender's own binary, bmesh exists only once bpy has loaded
import bmesh
import numpy as np
from mathutils import Vector

KIT = {"M_Blade", "M_Iron", "M_Brass", "M_Wood", "M_Cloth", "M_Wrap", "M_Glow", "M_Rune"}
MIN_IOU = 0.97
SHARP = 35          # degrees: the low-poly's edges sharper than this shade hard
RETRIES = 8         # collapse attempts, each 1.5% lower, before the topology check fails the low-poly
RASTER = 256        # silhouette check resolution
CLOSE, WORLD, PIXEL = 360, 96, 4   # review tiles: close-up px; world-size px, shown at x PIXEL (nearest) as the pixel finish


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--lp-tris", type=int, required=True)
    p.add_argument("--hd", action="append", required=True, help="key=path, one per tier, in tier order")
    p.add_argument("--old", action="append", default=[], help="key=path of the model this replaces")
    p.add_argument("--lp-from", action="append", default=[], help="key=path: reduce the low-poly from this lower-detail build of the same design instead of the high-def")
    p.add_argument("--require", default="")
    a = p.parse_args(argv)
    pairs = lambda xs: [tuple(x.split("=", 1)) for x in xs]
    return a, pairs(a.hd), dict(pairs(a.old)), {m for m in a.require.split(",") if m}, dict(pairs(a.lp_from))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    """The file's mesh nodes, names and transforms as authored (no baking: OffHand's place on the back matters)."""
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o not in before and o.type == "MESH"]


def own(objs):
    """A second file loaded beside the high-def brings its materials in as "M_Iron.001": point every slot back at the
    high-def's material of the same name (skins and trim find parts by these names)."""
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if m and m.name[-4:-3] == "." and m.name[-3:].isdigit() and m.name[:-4] in bpy.data.materials:
                slot.material = bpy.data.materials[m.name[:-4]]
                if m.users == 0:
                    bpy.data.materials.remove(m)


def base_name(name):
    """A node's own name, without the "~hd" this script parks the high-def under or Blender's ".001"."""
    name = name.split("~hd")[0]
    return name[:-4] if name[-4:-3] == "." and name[-3:].isdigit() else name


def ntris(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)


def materials(objs):
    return {s.material.name for o in objs for s in o.material_slots if s.material}


def check_nodes(key, objs, fail):
    names = sorted(o.name for o in objs)
    extra = [n for n in names if n not in (key, "OffHand")]
    if extra or key not in names:
        fail(f"{key}: nodes {names}, expected '{key}' and optionally 'OffHand'")
    stray = materials(objs) - KIT
    if stray:
        fail(f"{key}: materials outside the trim kit {sorted(stray)}")


def topology(o):
    """(open or non-manifold edges, separate pieces) of one node, its seam-split vertices welded first (the glTF
    import splits them where UVs or normals break)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bad = sum(1 for e in bm.edges if not e.is_manifold)
    seen, pieces = set(), 0
    for v in bm.verts:
        if v.index in seen:
            continue
        pieces += 1
        stack = [v]
        while stack:
            u = stack.pop()
            if u.index not in seen:
                seen.add(u.index)
                stack.extend(e.other_vert(u) for e in u.link_edges)
    bm.free()
    return bad, pieces


def check_topology(label, objs, fail, notes):
    for o in objs:
        bad, pieces = topology(o)
        if bad:
            fail(f"{label} {o.name}: {bad} open or non-manifold edges (Models rule 3: clean topology)")
        if pieces > 1:
            notes.append(f"{label} {o.name}: {pieces} separate pieces")


def ensure_uvs(objs, notes):
    for o in objs:
        if o.data.uv_layers:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
        notes.append(f"{o.name}: no UVs, generated")


def reduce(objs, budget):
    """The low-poly: each node reduced from its source (the high-def, or a lower-detail build of the same design),
    sharing the budget by triangle count: welded back into one surface, then edge-collapsed. (A planar-dissolve pass
    before the collapse was tried and dropped: its self-touching n-gons triangulate into non-manifold edges.)"""
    total = ntris(objs)
    out = []
    for o in objs:
        lp = o.copy()
        lp.data = o.data.copy()
        bpy.context.scene.collection.objects.link(lp)
        bpy.context.view_layer.objects.active = lp
        weld(lp)
        share = budget * ntris([o]) / total
        if ntris([lp]) > share:
            collapse(lp, share)
        bpy.ops.object.select_all(action="DESELECT")
        lp.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(SHARP))   # its own normals: the high-def's no longer fit
        out.append(lp)
    return out


def collapse(o, target):
    """Edge-collapse to `target` triangles, then clear the degenerate faces a collapse can leave. A collapse that still
    leaves an open or non-manifold edge is redone from the same mesh a little lower (the result depends on the exact
    ratio), up to RETRIES times; the low-poly's own topology check then has the last word."""
    keep = o.data.copy()
    for k in range(RETRIES + 1):
        if k:
            o.data = keep.copy()
        m = o.modifiers.new("lp", "DECIMATE")
        m.ratio = max(target * (1 - 0.015 * k) / ntris([o]), 0.01)
        m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges[:])
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(o.data)
        bm.free()
        if topology(o)[0] == 0:
            break
    bpy.data.meshes.remove(keep)


def weld(o):
    """One surface again: the glTF import splits vertices wherever UVs or normals break, and reducing those islands
    apart opens cracks between them. UVs live on the face corners, so they survive; normals are re-derived after."""
    me = o.data
    if me.has_custom_normals:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()


def world_tris(objs):
    """Every triangle in world space, as an (n, 3, 3) array."""
    bpy.context.view_layer.update()
    tris = []
    for o in objs:
        me, mw = o.data, o.matrix_world
        me.calc_loop_triangles()
        co = np.array([tuple(mw @ v.co) for v in me.vertices])
        idx = np.array([t.vertices[:] for t in me.loop_triangles], dtype=int)
        if len(idx):
            tris.append(co[idx])
    return np.concatenate(tris) if tris else np.zeros((0, 3, 3))


def silhouette(tris, axes, lo, hi):
    """A RASTER x RASTER coverage mask of the triangles projected on two world axes (numpy only: Blender's Python).
    Each axis is stretched to fill the raster: overlap ratios don't change under a stretch, and a thin view (a shield
    edge-on) then gets as many pixels across as a wide one, instead of a few pixels of edge noise."""
    span = np.maximum((hi - lo)[list(axes)], 1e-6)
    p = (tris[:, :, axes] - lo[list(axes)]) / span * (RASTER - 1)
    mask = np.zeros((RASTER, RASTER), bool)
    for t in p:
        x0, y0 = np.floor(t.min(0)).astype(int).clip(0, RASTER - 1)
        x1, y1 = np.ceil(t.max(0)).astype(int).clip(0, RASTER - 1)
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = t
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-9:
            continue
        w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
        w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
        inside = (w0 >= 0) & (w1 >= 0) & (w0 + w1 <= 1)
        mask[y0:y1 + 1, x0:x1 + 1] |= inside
    return mask


def iou(hd, lp):
    """Silhouette agreement from the front (x, z), the side (y, z) and above (x, y), framed on the high-def."""
    a, b = world_tris(hd), world_tris(lp)
    lo, hi = a.reshape(-1, 3).min(0), a.reshape(-1, 3).max(0)
    out = {}
    for view, axes in (("front", (0, 2)), ("side", (1, 2)), ("top", (0, 1))):
        ma, mb = silhouette(a, axes, lo, hi), silhouette(b, axes, lo, hi)
        out[view] = (ma & mb).sum() / max((ma | mb).sum(), 1)
    return out


def export(objs, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True, export_apply=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)


# ── the review sheet: Cycles on the CPU so it runs anywhere headless ──
def stage(res):
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 24
    s.cycles.use_denoising = True
    s.render.resolution_x = s.render.resolution_y = res
    s.view_settings.view_transform = "Standard"
    if not s.world:
        s.world = bpy.data.worlds.new("w")
    s.world.use_nodes = True
    bg = s.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value, bg.inputs[1].default_value = (0.93, 0.93, 0.95, 1), 0.9
    if "sun" not in bpy.data.objects:
        sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
        sun.data.energy = 3.2
        sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
        s.collection.objects.link(sun)
    if not s.camera:
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        cam.data.type = "ORTHO"
        s.collection.objects.link(cam)
        s.camera = cam
    return s


def shot(objs, res, path, frame=None):
    """A three-quarter front view of only these objects; `frame` (lo, hi) keeps two models at one scale."""
    s = stage(res)
    for o in s.objects:
        if o.type == "MESH":
            o.hide_render = o not in objs
    pts = world_tris(objs).reshape(-1, 3)
    lo, hi = frame or (pts.min(0), pts.max(0))
    mid, size = Vector((lo + hi) / 2), max(float(np.linalg.norm(hi - lo)), 1e-3)
    d = Vector((0.55, -1.0, 0.45)).normalized()
    s.camera.location = mid + d * size * 3
    s.camera.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    s.camera.data.ortho_scale = size * 1.08
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def pixels(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)


def sheet(rows, path):
    """Rows of [close-up, world tiles...] tiles; world tiles are upscaled nearest to show the pixel finish."""
    gap = 12
    tiles = [[pixels(p) if i == 0 else np.repeat(np.repeat(pixels(p), PIXEL, 0), PIXEL, 1) for i, p in enumerate(r)] for r in rows]
    h = max(t.shape[0] for r in tiles for t in r)
    W = gap + max(sum(t.shape[1] + gap for t in r) for r in tiles)
    H = gap + len(tiles) * (h + gap)
    out = np.ones((H, W, 4), np.float32)
    for ri, r in enumerate(tiles):
        x, y = gap, H - (gap + ri * (h + gap)) - h       # Blender images run bottom-up
        for t in r:
            out[y + (h - t.shape[0]) // 2: y + (h - t.shape[0]) // 2 + t.shape[0], x:x + t.shape[1]] = t
            x += t.shape[1] + gap
    im = bpy.data.images.new("review", W, H, alpha=True)
    im.pixels.foreach_set(out.ravel())
    im.filepath_raw, im.file_format = path, "PNG"
    im.save()


def main():
    a, tiers, old, require, lp_from = parse()
    fails, notes, seen, seen_lp, rows = [], [], set(), set(), []
    fail = fails.append
    tmp = os.path.join(a.out, "_review")
    for key, src in tiers:
        reset()
        hd = load(src)
        check_nodes(key, hd, fail)
        check_topology(f"{key} high-def", hd, fail, notes)
        ensure_uvs(hd, notes)
        seen |= materials(hd)
        n_hd = ntris(hd)
        export(hd, os.path.join(a.out, "hd", f"{key}.glb"))
        for o in hd:                     # free the names for the low-poly: the engine finds `OffHand` by its exact name
            o.name = f"{o.name}~hd"
        src = hd                         # reduce the high-def, or a lower-detail build of the same design
        if key in lp_from:
            src = load(lp_from[key])
            own(src)
            check_nodes(key, src, fail)
        lp = reduce(src, a.lp_tris)
        if src is not hd:
            for o in src:
                bpy.data.objects.remove(o, do_unlink=True)
        n_lp = ntris(lp)
        if n_lp > a.lp_tris:
            fail(f"{key}: low-poly {n_lp} triangles, over {a.lp_tris}")
        if n_hd <= a.lp_tris:
            notes.append(f"{key}: high-def is only {n_hd} triangles, not above the low-poly budget")
        sil = iou(hd, lp)
        if min(sil.values()) < MIN_IOU:
            fail(f"{key}: low-poly silhouette off the high-def ({', '.join(f'{v} {s:.3f}' for v, s in sil.items())})")
        for o in lp:
            o.name = base_name(o.name)
        if sorted(o.name for o in lp) != sorted(base_name(o.name) for o in hd):
            fail(f"{key}: low-poly node names {[o.name for o in lp]}")
        check_topology(f"{key} low-poly", lp, fail, notes)
        seen_lp |= materials(lp)
        export(lp, os.path.join(a.out, f"{key}.glb"))
        row = [shot(hd, CLOSE, os.path.join(tmp, f"{key}-hd.png"))]
        pts = world_tris(hd).reshape(-1, 3)
        frame = (pts.min(0), pts.max(0))
        row.append(shot(lp, WORLD, os.path.join(tmp, f"{key}-lp.png"), frame))
        if key in old:
            row.append(shot(load(old[key]), WORLD, os.path.join(tmp, f"{key}-old.png"), frame))
        rows.append(row)
        print(f"TIER {key}: hd {n_hd} tris, lp {n_lp} tris, silhouette " + " ".join(f"{v} {s:.3f}" for v, s in sil.items()), flush=True)
    for label, have in (("high-def", seen), ("low-poly", seen_lp)):          # the low-poly is the world copy skins recolour
        if require - have:
            fail(f"materials the class's skins or trim need, on no tier's {label}: {sorted(require - have)}")
    sheet(rows, os.path.join(a.out, "review.png"))
    for n in notes:
        print("NOTE", n)
    for f in fails:
        print("FAIL", f)
    print(f"REVIEW {os.path.join(a.out, 'review.png')}")
    sys.exit(1 if fails else 0)


main()
