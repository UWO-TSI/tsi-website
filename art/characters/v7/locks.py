"""v7 sculpted-lock hair (specs/avatar-v7.md item 2, row 254): curve locks in Blender -> closed low-poly lock meshes.

A hair piece (bangs or back) is a Blender collection of lock curves plus an optional under-mass (the cap the locks
lie on, so no scalp shows between them from any angle). Each lock is a POLY spline whose control points are the
lock's spine; per point, `radius` is the half width and `tilt` twists the section; per curve object, custom props:
  flat   thickness / width of the section (0.3 flat ribbon .. 0.7 round clump)
  segs   segments along the lock (the sweep resamples the spine by arc length)
  sides  4 (a diamond: sharp side edges, a soft ridge) or 5 (a flatter underside, three faces on top)
  blunt  0 = the lock tapers to a point over its last segment; up to ~0.95 = a cut end (straight bangs, bob hems)
  hug    1 = where the spine runs close to the scalp the underside rests on the skin (bangs, face-framing locks);
         0 = the lock lies on the piece's under-cap and keeps its section (crown and back locks)
The sweep interpolates the control points (Catmull-Rom) and their radius/tilt, orients the section so its flat
side faces away from the head, closes the root with a cap and ends in a point, so every lock is a closed solid
(the engine's back-face culling cannot hollow it, fit_check counts no open edges). UVs: u across the lock (0 one
edge, 0.5 the ridge, 1 the other edge), v along it (0 root, 1 tip): the engine's sheen band runs along each lock.

The curves are the editable source (move points in Blender, re-run export_hair.py). seed(...) makes the first curves
of a style from head-relative specs; the live session then adjusted them by eye against the reference sheets.
"""
import bpy, math, os, sys
from mathutils import Vector

V7 = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else \
    "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/avatar-v7/art/characters/v7"
sys.path.insert(0, os.path.join(V7, ".."))
sys.path.insert(0, os.path.join(V7, "..", "base"))
from head_shape import head_point, hair_point, hair_vol, hairline, HC, CHIN, INNER, _ss  # noqa: E402


# ================================================================ spec -> curve (seeding)
def _out(p):
    """Outward direction at p: radial from the head centre on the head, horizontal radial below the chin line."""
    d = p - HC
    r = d.normalized()
    hz = Vector((d.x, d.y, 0.0))
    hz = hz.normalized() if hz.length > 1e-6 else Vector((0, 1, 0))
    t = _ss(HC.z - 0.12, HC.z - 0.24, p.z)          # 0 above the jaw, 1 at chin height and below
    return (r * (1 - t) + hz * t).normalized()


def spine(pts):
    """Head-relative control points -> 3D. ("s", lat, lon, off): on the scalp pushed out by off (off may be < 0: a
    root tucked into the scalp). ("d", out, side, down): a move from the previous point, out = away from the head
    axis (horizontal), side = toward +lon, down = -z (hanging lengths)."""
    out, prev = [], None
    for p in pts:
        if p[0] == "s":
            q = hair_point(p[1], p[2], p[3])
        else:
            d = prev - HC
            hz = Vector((d.x, d.y, 0)).normalized()
            side = Vector((0, 0, 1)).cross(hz).normalized()      # +lon direction (counter-clockwise from above)
            q = prev + hz * p[1] + side * p[2] + Vector((0, 0, -p[3]))
        out.append(q)
        prev = q
    return out


def make_curve(coll, name, pts, radii, tilts=None, flat=0.45, segs=6, sides=4, blunt=0.0, hug=1):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, (p, r) in enumerate(zip(pts, radii)):
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
        sp.points[i].radius = r
        sp.points[i].tilt = (tilts[i] if tilts else 0.0)
    ob = bpy.data.objects.new(name, cu)
    ob["flat"], ob["segs"], ob["sides"], ob["blunt"], ob["hug"] = flat, segs, sides, blunt, hug
    coll.objects.link(ob)
    return ob


def seed(coll_name, locks, parent=None):
    """Create (or replace) a collection of lock curves from a list of dicts: pts (spine() specs), w (half widths per
    control point), optional tilt, flat, segs, sides, name."""
    coll = bpy.data.collections.get(coll_name)
    if coll is None:
        coll = bpy.data.collections.new(coll_name)
        (parent or bpy.context.scene.collection).children.link(coll)
    for o in list(coll.objects):
        cu = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if cu and cu.users == 0:
            bpy.data.curves.remove(cu)
    for i, lk in enumerate(locks):
        pts = spine(lk["pts"])
        w = lk["w"] if isinstance(lk["w"], (list, tuple)) else [lk["w"]] * len(pts)
        make_curve(coll, lk.get("name", f"{coll_name}_{i:02d}"), pts, w, lk.get("tilt"), lk.get("flat", 0.45),
                   lk.get("segs", 6), lk.get("sides", 4), lk.get("blunt", 0.0), lk.get("hug", 1))
    return coll


# ================================================================ curve -> lock mesh (the sweep)
def _catmull(ps, t):
    """Centripetal-free uniform Catmull-Rom through ps at global t in [0, len-1]."""
    n = len(ps)
    i = min(int(t), n - 2)
    u = t - i
    p0, p1, p2, p3 = ps[max(i - 1, 0)], ps[i], ps[i + 1], ps[min(i + 2, n - 1)]
    if i == 0:
        p0 = p1 * 2 - p2
    if i + 2 > n - 1:
        p3 = p2 * 2 - p1
    u2, u3 = u * u, u * u * u
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)


def _lerp_list(vals, t):
    i = min(int(t), len(vals) - 2)
    u = t - i
    return vals[i] * (1 - u) + vals[i + 1] * u


def lock_samples(ob):
    """The lock's spine resampled by arc length: [(point, half width, tilt, v)] for segs + 1 rings (the last is the tip)."""
    sp = ob.data.splines[0]
    ps = [Vector(p.co[:3]) for p in sp.points]
    rs = [p.radius for p in sp.points]
    ts = [p.tilt for p in sp.points]
    mw = ob.matrix_world
    ps = [mw @ p for p in ps]
    dense, n = [], 24 * (len(ps) - 1)
    for k in range(n + 1):
        t = k / n * (len(ps) - 1)
        dense.append((_catmull(ps, t), t))
    acc = [0.0]
    for a, b in zip(dense[:-1], dense[1:]):
        acc.append(acc[-1] + (b[0] - a[0]).length)
    L = acc[-1]
    segs = int(ob.get("segs", 6))
    blunt = float(ob.get("blunt", 0.0))       # 0: the last ring a full segment before the tip (a point); 0.9: a cut end
    stops = [s / segs for s in range(segs)]
    stops[-1] = min(1.0 - 0.004 / max(L, 1e-6), stops[-1] + (1.0 - stops[-1]) * blunt) if segs > 1 else stops[-1]
    stops.append(1.0)
    out = []
    j = 0
    for s, f in enumerate(stops):
        target = L * f
        while j < len(acc) - 2 and acc[j + 1] < target:
            j += 1
        u = (target - acc[j]) / max(acc[j + 1] - acc[j], 1e-9)
        p = dense[j][0].lerp(dense[j + 1][0], u)
        t = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * u
        out.append((p, _lerp_list(rs, t), _lerp_list(ts, t), f))
    return out


class Surface:
    """The actual head mesh (V7_Head in the file, world space) seen from the head centre: the scalp every lock root
    is buried in and every lock that lies on the head rests on."""

    def __init__(self, ob):
        from mathutils.bvhtree import BVHTree
        me = ob.data
        mw = ob.matrix_world
        self.tree = BVHTree.FromPolygons([mw @ v.co for v in me.vertices], [list(p.vertices) for p in me.polygons])

    def radius(self, d):
        loc, _, _, _ = self.tree.ray_cast(HC, d, 1.0)
        return (loc - HC).length if loc is not None else None

    def height(self, p):
        d = (p - HC)
        r = self.radius(d.normalized())
        return d.length - r if r is not None else 1.0

    def at(self, p, off):
        d = (p - HC).normalized()
        r = self.radius(d)
        return HC + d * (r + off) if r is not None else p


ROOT_DEPTH = 0.003      # every root ring sits this far under the skin: buried whatever hair covers it
HUG_DEPTH = 0.0015      # a lock resting on the head: its underside and edges this far under the skin
HUG_FROM, HUG_FULL = 0.03, 0.018   # the lock's spine height over the scalp where hugging starts / is complete


SECTIONS = {  # (across, up, u) around the section, left edge first; up +1 = away from the head
    4: [(-1.0, 0.0, 0.0), (0.0, 1.0, 0.5), (1.0, 0.0, 1.0), (0.0, -1.0, 0.5)],
    5: [(-1.0, 0.0, 0.0), (-0.45, 0.85, 0.3), (0.45, 0.85, 0.7), (1.0, 0.0, 1.0), (0.0, -0.7, 0.5)],
}


def sweep(pc, ob, surf=None):
    """Add one lock (a closed solid) to a kit.Piece. Returns the number of faces added. With the head surface: the
    root ring is buried ROOT_DEPTH under the skin, and while the spine runs within HUG_FROM of the scalp the
    underside and edges are pulled down onto it (fully within HUG_FULL), so a lock lying on the head shows no air
    under it from any angle; lengths that hang free (bob hems, long backs) are left as swept."""
    sm = lock_samples(ob)
    flat = float(ob.get("flat", 0.45))
    hug = float(ob.get("hug", 1))
    sec = SECTIONS[int(ob.get("sides", 4))]
    n0 = pc.mark()
    rings = []
    for i, (p, r, tilt, v) in enumerate(sm[:-1]):
        a = sm[max(i - 1, 0)][0]
        b = sm[i + 1][0]
        T = (b - a).normalized()
        N0 = _out(p)
        B = T.cross(N0)
        if B.length < 1e-6:
            B = T.orthogonal()
        B.normalize()
        N = B.cross(T).normalized()
        if tilt:
            c, s = math.cos(tilt), math.sin(tilt)
            B, N = B * c + N * s, N * c - B * s
        pts = [p + B * (ac * r) + N * (up * r * flat) for ac, up, _ in sec]
        if surf is not None:
            if i == 0:          # sink the whole root ring (its shape kept) until its highest point is under the skin
                top = max(surf.height(q) for q in pts)
                if top > -ROOT_DEPTH:
                    dn = (p - HC).normalized() * (top + ROOT_DEPTH)
                    pts = [q - dn for q in pts]
            else:
                w = hug * _ss(HUG_FROM, HUG_FULL, surf.height(p))
                for j, (ac, up, _) in enumerate(sec):
                    if up <= 0 and w > 0 and surf.height(pts[j]) > -HUG_DEPTH:
                        pts[j] = pts[j].lerp(surf.at(pts[j], -HUG_DEPTH), w)
        ring = [pc.v(q) for q in pts]
        rings.append((ring, p, v))
    tip_p, _, _, tip_v = sm[-1]
    if surf is not None and hug:
        w = hug * _ss(HUG_FROM, HUG_FULL, surf.height(tip_p))
        if w > 0 and surf.height(tip_p) > 0.0005:
            tip_p = tip_p.lerp(surf.at(tip_p, 0.0005), w)          # a tip lying on the head rests on the skin
    tip = pc.v(tip_p)
    k = len(sec)
    for (ra, pa, va), (rb, pb, vb) in zip(rings[:-1], rings[1:]):
        mid = sum((x.co for x in ra + rb), Vector()) / (2 * k)     # inside the segment even where the rings moved
        for j in range(k):
            j2 = (j + 1) % k
            ua, ub = sec[j][2], sec[j2][2] if j2 else (1.0 if sec[j][2] > 0.5 else 0.0)
            pc.f([ra[j], ra[j2], rb[j2], rb[j]], mid, uv=[(ua, va), (ub, va), (ub, vb), (ua, vb)])
    last, pl, vl = rings[-1]
    lc = (sum((x.co for x in last), Vector()) / k * 3 + tip.co) / 4
    for j in range(k):
        j2 = (j + 1) % k
        pc.f([last[j], last[j2], tip], lc, uv=[(sec[j][2], vl), (sec[j2][2], vl), (0.5, tip_v)])
    root, p0, _ = rings[0]
    rc = sum((x.co for x in root), Vector()) / len(root)
    inside = rc + (sm[1][0] - p0).normalized() * 0.002
    c0 = rc - (sm[1][0] - p0).normalized() * 0.001
    if surf is not None and surf.height(c0) > -ROOT_DEPTH:
        c0 = surf.at(c0, -ROOT_DEPTH)
    c0 = pc.v(c0)
    for j in range(k):
        pc.f([root[(j + 1) % k], root[j], c0], inside, uv=[(0.5, 0.0)] * 3)
    return len(pc.since(n0))


def piece_from(coll_names, pc, surf=None):
    """Sweep every lock curve in the collections into the piece."""
    n = 0
    for cn in coll_names:
        coll = bpy.data.collections.get(cn)
        if not coll:
            continue
        for ob in sorted(coll.objects, key=lambda o: o.name):
            if ob.type == "CURVE" and not ob.get("skip"):
                sweep(pc, ob, surf)
                n += 1
    return n
