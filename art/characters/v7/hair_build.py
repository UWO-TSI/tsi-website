"""v7 hair pieces from lock curves (live sessions and the headless export share this).

piece(pid, rig, mat): the mesh object for one catalogue id. A back piece is its under-cap (kit.hair_cap at
hair_styles.cap_outer, GROOVE under the lock tops; lower still for pulled-back styles; matte, so the grooves between
locks stay dark), its bun knots, and every lock curve in the collection named pid; a bangs piece is its locks. With no
curves in the file yet, the seeds in hair_styles are swept directly. One material (M_Hair), smooth by angle, the shared
COLOR_0 gradient, 100% on mixamorig:Head, as the rest of the hair library.
"""
import bpy, os, sys

V7 = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else \
    "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/avatar-v7/art/characters/v7"
for p in (V7, os.path.join(V7, ".."), os.path.join(V7, "..", "base"), os.path.join(V7, "..", "v8")):
    if p not in sys.path:
        sys.path.insert(0, p)
import kit  # noqa: E402
import locks  # noqa: E402
import hair_styles as hs  # noqa: E402
import organic  # noqa: E402  (avatar v8)
from head_shape import CHIN, hair_point, hair_outer  # noqa: E402

SHARP = 40.0                 # lock side edges stay sharp (they read as separate locks), ridges and masses smooth
ZRANGE = (CHIN, 1.05)        # the library's shared COLOR_0 gradient: no shade step where bangs meet the back
CAP_LONS = [20 * k - 180 for k in range(18)]   # the under-cap is mostly covered by locks: 20 deg columns


def slot_of(pid):
    return "bangs" if pid in hs.BANGS else "back"


def seeds(pid):
    return (hs.BANGS[pid][2] if pid in hs.BANGS else hs.BACKS[pid][2])()


def seed(pid, parent=None):
    """(Re)make the curves of one piece from its seeds, in a collection named pid."""
    return locks.seed(pid, seeds(pid), parent)


def cap_uvs(pc):
    """avatar v8: the under-cap is the smooth crown mass the locks spring from, so it carries the strand texture too:
    per 20 deg column u runs across the column (its edges read as soft partings between clumps) and v from the crown
    (the root) down to the hem."""
    for f in list(pc.fuv):
        ll = [pc.sph.get(v) for v in f.verts]
        if any(x is None for x in ll):
            continue                          # the closing fan inside the head
        lons = [lo for _, lo in ll]
        if max(lons) - min(lons) > 180:
            lons = [lo + 360 if lo < 0 else lo for lo in lons]
        if max(ll)[0] >= 89.9:                # the apex fan: one column's top corner
            lo0, span = min(lo for (la, _), lo in zip(ll, lons) if la < 89.9), 20.0
        else:
            lo0, span = min(lons), max(max(lons) - min(lons), 1e-6)
        pc.fuv[f] = {v: (0.5 if la >= 89.9 else min(1.0, (lo - lo0) / span), min(1.0, max(0.0, (88 - la) / 110)))
                     for v, (la, _), lo in zip(f.verts, ll, lons)}


def sink_cap(pc, cap, under=0.0025):
    """avatar v8: the grooves are shallow, so a flat lock face can sag under a corner of the under-cap and show it as
    a dark fleck. Every cap vertex just under or above a lock's outer surface (along its ray from the head centre)
    is lowered to `under` beneath it; between the locks the cap keeps its height."""
    from mathutils.bvhtree import BVHTree
    lockf = [f for f in pc.bm.faces if f not in cap]
    vs = list({v for f in lockf for v in f.verts})
    ix = {v: i for i, v in enumerate(vs)}
    tree = BVHTree.FromPolygons([v.co for v in vs], [[ix[v] for v in f.verts] for f in lockf])
    for v in {v for f in cap for v in f.verts if v in pc.sph and pc.sph[v][0] < 56}:   # (the crown keeps the clumps' roots)
        d = v.co - locks.HC
        r, d = d.length, d.normalized()
        t, out, o = 0.0, None, locks.HC.copy()
        while True:
            loc, _, _, dist = tree.ray_cast(o, d, 0.4)
            if loc is None:
                break
            out = (loc - locks.HC).length
            o = loc + d * 1e-4
        if out is not None and out - 0.015 < r < out + 0.002:      # (a lock deeper under the cap is hidden by it)
            v.co = locks.HC + d * min(r, out - under)


def piece(pid, rig, mat, name=None, head=None):
    pc = kit.Piece()
    v8 = pid in hs.V8
    if pid in hs.BACKS:
        tight = 0.008 if pid in hs.TIGHT else 0.0
        groove = hs.GROOVE_V8 if v8 else hs.GROOVE
        outer = hs.OUTER.get(pid) or (lambda lat: hs.cap_outer(lat, tight, groove))
        pc, _, _ = kit.hair_cap(hs.BACKS[pid][3], outer=outer, outer_ll=hs.OUTER_LL.get(pid), hem=hs.CAP_FLOOR, lons=CAP_LONS)
        for f in pc.since(0):
            pc.fuv[f] = {v: (0.0, 0.5) for v in f.verts}        # matte: u 0 is off the lock ridges, no gloss band
        cap = set(pc.since(0))
        if v8 and pid not in hs.FLAT_CAP:
            cap_uvs(pc)
        for lat, lon, r, h in hs.KNOTS.get(pid, []):
            n0 = pc.mark()
            c = hair_point(lat, lon, hair_outer(lat) + r * 0.45)
            pc.blob(c, (r, r, r * 0.85), segs=8, rings=5)
            zs = [v.co.z for f in pc.since(n0) for v in f.verts]
            lo, hi = min(zs), max(zs)
            for f in pc.since(n0):
                pc.fuv[f] = {v: (0.5, 0.25 + 0.5 * (v.co.z - lo) / max(hi - lo, 1e-6)) for v in f.verts}
    surf = locks.Surface(head or bpy.data.objects["V7_Head"])
    coll = bpy.data.collections.get(pid)
    curves = [o for o in coll.objects if o.type == "CURVE" and not o.get("skip")] if coll else []
    if curves:
        for i, ob in enumerate(sorted(curves, key=lambda o: o.name)):
            locks.sweep(pc, ob, surf, flip=v8 and i % 2 == 1)
        n = len(curves)
    else:
        lks = seeds(pid)
        for i, lk in enumerate(lks):
            locks.sweep(pc, locks.lock_of_seed(lk), surf, flip=v8 and i % 2 == 1)
        n = len(lks)
    if v8 and pid in hs.BACKS:
        sink_cap(pc, cap)
    if v8:      # avatar v8: soft hair masses (custom normals), baked occlusion and the darker inner layer, matte
        ob = pc.finish(name or pid, rig, {"M_Hair": mat}, zrange=ZRANGE, grad=organic.GRAD,
                       normals=organic.soft_normals(own={v for f in pc.coils for v in f.verts}), shade=organic.occlusion(surf.tree))
    else:
        ob = pc.finish(name or pid, rig, {"M_Hair": mat}, sharp=SHARP, zrange=ZRANGE)
    ob["locks"] = n
    return ob


def gallery(pids, rig, mat, head, cols=8, dx=0.62, dz=-0.75, z0=0.0):
    """Live review: a copy of the head and each piece side by side (static meshes, no rig), in collection 'gallery'."""
    g = bpy.data.collections.get("gallery") or bpy.data.collections.new("gallery")
    if g.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(g)
    for o in list(g.objects):
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    out = []
    for i, cell in enumerate(pids):
        x, z = (i % cols) * dx, z0 + (i // cols) * dz
        h = bpy.data.objects.new(f"g_head_{i}", head.data)
        h.location = (x, 0, z)
        g.objects.link(h)
        for pid in (cell if isinstance(cell, (tuple, list)) else (cell,)):
            ob = piece(pid, None, mat, name=f"g_{i}_{pid}", head=head)
            for c in ob.users_collection:
                c.objects.unlink(ob)
            g.objects.link(ob)
            ob.location = (x, 0, z)
            out.append(ob)
    return out
