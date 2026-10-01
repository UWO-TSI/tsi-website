"""Hand-remodeled accessories (avatar v8 deliverable 4, milestone 1: the beanie and the backpack), modeled step by
step in the live Blender session and kept here as their build path (build_accessories.py keeps the ids, the stacking
groups and the hat-tuck and band-rest rules). Matte, soft, fabric-like: knit ribs, a rolled cuff and a fluffy pompom
on the beanie; a padded body that puffs out, a soft flap, a puffy pocket and thick padded straps on the backpack.
"""
import math
from mathutils import Vector
import kit
from kit import body as B, hair_point, HC
from head_shape import hair_outer

HAT_CLEAR = 0.004                       # as build_accessories: the inside of a hat sits this far over the hair
BEANIE_LONS = [7.5 * k - 180 for k in range(48)]   # 48 columns: 24 knit ribs round the head


def hat_in(lat):
    return hair_outer(lat) + HAT_CLEAR


def organic_hooks(pc, head):
    """kit.Piece.finish hooks for a remodeled accessory: the hair tuck under a hat gets the v8 hair's soft normals;
    everything is smooth-shaded fabric with baked occlusion (darker under a cuff or brim, in a knit's purl columns)."""
    import organic, locks
    hair = {v for f, m in pc.fmat.items() if m == "M_Hair" and f.is_valid for v in f.verts}
    soft = organic.soft_normals()
    ao = organic.occlusion(locks.Surface(head).tree if head is not None else None)

    def normals(bm):
        s_ = soft(bm)
        return [s_[v.index] if v in hair else None for v in bm.verts]     # the rest: smooth by the part's angle

    def shade(bm):
        a = ao(bm)
        return [a[v.index] * pc.knit.get(v, 1.0) for v in bm.verts]
    return {"normals": normals, "shade": shade}


def _rib(i, high=0.0026, low=-0.0006):
    """The knit rib profile across the columns: a raised rib, a sunken purl column, in turn."""
    return high if i % 2 == 0 else low


def beanie(pc, tuck, edge=lambda lon: 10 + 12 * math.cos(math.radians(lon))):
    """A knit beanie pulled down over the hair: a rolled cuff of chunky ribs standing proud of a ribbed crown that
    hugs the hair and gathers at the top with a little slouch toward the back, and a fluffy pompom."""
    pc.region = "head"
    n0 = pc.mark()
    cuff_rows = (0.0, 6.0, 12.0, 14.0)             # the cuff: lip, middle, top fold, the step back to the crown
    lons = BEANIE_LONS

    def rows(lon):
        e = edge(lon)
        top = e + 14.0
        crown = [top + (86 - top) * j / 5 for j in range(1, 6)]
        return [e + r for r in cuff_rows] + crown

    def off(lat, lon, ri):
        i = lons.index(lon)
        if ri <= 2:                                  # the cuff: thick, rolled at the lip, ribbed deeper
            lip = (0.013, 0.018, 0.017)[ri]
            return hat_in(lat) + lip + _rib(i, 0.0045, -0.0012)
        slouch = 0.004 * max(0.0, -math.cos(math.radians(lon))) * (ri - 3) / 5    # the top leans back a little
        return hat_in(lat) + 0.0072 + slouch + _rib(i, 0.0036, -0.001) * (1.0 - 0.7 * max(0, ri - 5) / 3)
    g = pc.patch(lons, rows, off, wrap=True)
    for i, col in enumerate(g[:len(lons)]):          # the purl columns sit in shadow between the ribs
        for r, v in enumerate(col):
            pc.knit[v] = 0.8 if i % 2 else 1.0
    apex = pc.hv(90, 0, hat_in(90) + 0.0075)
    for i in range(len(lons)):
        pc.f([g[i][-1], g[i + 1][-1], apex], HC)
    # closed with walls down to the hair and a fan inside the head: under the edge the hat meets the hair, no gap
    pc.close_fan(pc.since(n0), lambda v: hair_point(*pc.sph[v], hat_in(pc.sph[v][0]) - HAT_CLEAR - 0.002))
    # the pompom: a lumpy ball of yarn, a little back of the top
    pc.mat = "M_Accent"
    c = hair_point(87, 180, hat_in(87) + 0.042)
    m0 = pc.mark()
    pc.blob(c, 0.042, segs=10, rings=6)
    for v in {v for f in pc.since(m0) for v in f.verts}:
        d = v.co - c
        k = 1.0 + 0.16 * math.sin(d.x * 310) * math.cos(d.y * 270 + d.z * 190)
        v.co = c + d * k
    pc.mat = "M_Main"
    tuck(edge)


# ================================================================ backpack
def _pillow(pc, c, hw, hd, hh, bulge, n=16, zs=(-1.0, -0.86, -0.45, 0.0, 0.45, 0.86, 1.0), out=Vector((0, 1, 0)),
            mat=None, sag=0.0):
    """A padded fabric body: superellipse rings stacked up, the outer face (toward `out`) puffing out most at mid
    height, the corners rounded, a soft sag fold low on the front (sag)."""
    t = Vector((0, 0, 1)).cross(out).normalized()
    rings = []
    for z in zs:
        s = 1.0 - 0.13 * abs(z) ** 6
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n
            ca, sa = math.cos(a), math.sin(a)
            x = math.copysign(abs(ca) ** 0.45, ca) * hw * s
            y = math.copysign(abs(sa) ** 0.45, sa) * hd * s
            if y > 0:
                y += bulge * (1 - z * z) * math.cos(min(1.0, abs(x) / hw) * math.pi / 2)
                y -= sag * math.exp(-((z + 0.45) / 0.18) ** 2) * (1 - abs(x) / hw)
            ring.append(c + t * x + out * y + Vector((0, 0, z * hh)))
        rings.append(ring)
    keep = pc.mat
    pc.mat = mat or keep
    pc.band(rings, caps=(c - Vector((0, 0, hh * 1.01)), c + Vector((0, 0, hh * 1.01))))
    pc.mat = keep


def _strap(pc, pts, width=0.022, thick=0.0055, out=kit.torso_out):
    """A padded strap: a closed flat slab along points on the body, its broad side on the body."""
    rings = []
    n = len(pts)
    for i, p in enumerate(pts):
        tg = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        nn = out(p)
        sd = tg.cross(nn).normalized()
        nn = sd.cross(tg).normalized()
        if nn.dot(out(p)) < 0:
            nn = -nn
        sec = [(-1, 0), (-0.75, 1), (0.75, 1), (1, 0), (0.75, -1), (-0.75, -1)]
        rings.append([p + sd * a * width / 2 + nn * b * thick / 2 for a, b in sec])
    pc.band(rings, caps=(pts[0] - (pts[1] - pts[0]).normalized() * 0.003, pts[-1] + (pts[-1] - pts[-2]).normalized() * 0.003),
            refs=[(pts[i] + pts[i + 1]) / 2 for i in range(n - 1)])


def backpack(pc):
    """A soft daypack: a padded body puffing out at the back, a rounded flap with a soft roll over the top, a puffy
    front pocket, a grab loop and thick padded straps over the shoulders."""
    T, CL = B.torso_pt, B.CL
    pc.region = {"Spine2": 0.7, "Spine1": 0.3}
    c = Vector((0, 0.14, 0.395))
    _pillow(pc, c, 0.088, 0.022, 0.09, 0.012, sag=0.004, n=14)
    # the flap: from the back of the top over the top and down the outer face, rounded at its lower edge
    pc.mat = "M_Accent"
    rows = []
    xs = [-0.08, -0.06, -0.03, 0.0, 0.03, 0.06, 0.08]
    path = [(-0.022, 0.09), (0.0, 0.1), (0.026, 0.092), (0.039, 0.058), (0.037, 0.03)]
    for y, z in path:
        rows.append([c + Vector((x * (1 - 0.25 * (abs(x) / 0.08) ** 4), y + 0.003 * math.cos(x * 30), z)) for x in xs])
    n0 = pc.mark()
    pc.band([list(r) for r in zip(*rows)], closed=False, refs=[c] * (len(xs) - 1))
    pc.thicken(pc.since(n0), lambda v: v.co + (c - v.co).normalized() * 0.004)
    # the pocket: a smaller puffy pillow low on the outer face
    _pillow(pc, c + Vector((0, 0.028, -0.048)), 0.056, 0.01, 0.032, 0.007, n=10, zs=(-1.0, -0.6, 0.0, 0.6, 1.0), mat="M_Accent")
    # a grab loop at the top
    pc.mat = "M_Trim"
    pc.tube([c + Vector((-0.02, -0.012, 0.098)), c + Vector((0, -0.014, 0.118)), c + Vector((0.02, -0.012, 0.098))],
            [(0.0035, 0.006)] * 3, sides=6, tip=False, up=Vector((0, 1, 0)))
    for s in (1, -1):                           # padded straps over the shoulders
        path = [(155, 0.488), (125, 0.527), (62, 0.532), (34, 0.49), (30, 0.395)]
        _strap(pc, [T(s * l, z, CL + 0.012) for l, z in path])
    pc.mat = "M_Main"
