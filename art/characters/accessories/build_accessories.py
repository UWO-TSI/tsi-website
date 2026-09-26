"""Accessory library (deliverable 3): round + square glasses, beanie, sun hat, cap, backpack, shoulder bag, scarf.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/accessories/build_accessories.py

Same contract as the outfits (kit.build_parts): each GLB = CharacterRig + one skinned mesh, flat palette materials.
Glasses and hats are built on head_shape.py and skinned to the Head bone. Hats set hidesBackHair (row 191) and carry a
short M_Hair tuck at the sides and nape (tinted with the hair colour at runtime), so the head never reads bald under
the brim; the chosen bangs still show. Bags are worn, never held (row 136). Catalogue section "accessories"; `group`
says which accessories can stack: face, head, bag, neck (one of each).
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402
from kit import body as B, hair_point, HC  # noqa: E402
from head_shape import head_point, HEAD_Z, HRZB  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
rig = kit.load_rig(bpy.context.scene)
PARTS, part = kit.registry()
T, CL = B.torso_pt, B.CL
WRAP = [30 * k for k in range(12)] + [360]


# ================================================================ glasses
def face_frame(x, z):
    """Point on the face at (x, z) plus the rim frame (normal halfway to straight ahead, horizontal u, vertical w)."""
    lat = -math.degrees(math.asin(((HEAD_Z - z) / HRZB) ** (1 / 0.62)))
    lo, hi = 0.0, 89.0 * (1 if x > 0 else -1)
    for _ in range(40):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if abs(head_point(lat, mid).x) < abs(x) else (lo, mid)
    lon = (lo + hi) / 2
    p = head_point(lat, lon)
    n = (head_point(lat + 1, lon) - head_point(lat - 1, lon)).cross(head_point(lat, lon + 1) - head_point(lat, lon - 1)).normalized()
    if n.dot(p - HC) < 0:
        n = -n
    n = (n + Vector((0, -1, 0))).normalized()
    u = Vector((0, 0, 1)).cross(n).normalized()
    return p, n, u, n.cross(u).normalized(), lat


EYE_X, EYE_Z = 0.118, 0.724              # centre of the painted F1.1 eye + lid (v6 face canvas)


def glasses(pc, outline):
    """outline: [(a, b)] rim points in the rim plane (a along u, b along w), per eye; mirrored for the right eye."""
    pc.region, rims = "head", []
    for sx in (1, -1):
        p, n, u, w, lat = face_frame(sx * EYE_X, EYE_Z)
        c = p + n * 0.017
        pts = [c + u * a * sx + w * b for a, b in outline]
        pc.tube(pts, [(0.0055, 0.004)] * len(pts), sides=4, closed_loop=True, up=n)
        inner = min(pts, key=lambda q: abs(q.x))
        outer = max(pts, key=lambda q: abs(q.x))
        rims.append((inner, outer, lat, c))
        pc.tube([outer, hair_point(lat + 3, sx * 96, 0.012), hair_point(lat - 2, sx * 124, 0.01)], [0.004] * 3,
                sides=4, tip=False, cap=False)
    (il, _, _, cl), (ir, _, _, cr) = rims
    mid = (il + ir) / 2 + Vector((0, -0.006, 0.012))
    pc.tube([il, mid, ir], [0.004] * 3, sides=4, tip=False, cap=False)


ROUND = [(0.064 * math.cos(math.tau * k / 10), 0.061 * math.sin(math.tau * k / 10)) for k in range(10)]
SQUARE = [(0.068, 0.034), (0.052, 0.054), (-0.052, 0.054), (-0.068, 0.034), (-0.068, -0.034), (-0.052, -0.054),
          (0.052, -0.054), (0.068, -0.034)]


@part("acc_glasses_round", "accessory", "Round glasses", {"M_Main": ("outfit", 14)}, sharp=60, group="face")
def glasses_round(pc):
    glasses(pc, ROUND)


@part("acc_glasses_square", "accessory", "Square glasses", {"M_Main": ("outfit", 5)}, sharp=60, group="face")
def glasses_square(pc):
    glasses(pc, SQUARE)


# ================================================================ hats (hide the back hair, keep a short tuck)
def dome(pc, edge, rows, offs, apex_off):
    """Crown over the head from edge(lon) up; rows(lon) -> lats, offs[ri]."""
    pc.region = "head"
    g = pc.patch(WRAP, rows, lambda lat, lon, ri: offs[ri])
    ring = [hair_point(rows(l)[-1], l, offs[-1]) for l in WRAP[:-1]]
    apex = pc.v(hair_point(90, 0, apex_off))
    vs = [pc.v(p) for p in ring]
    for k in range(len(vs)):
        pc.f([vs[k], vs[(k + 1) % len(vs)], apex], HC)
    return g


def tuck(pc, edge):
    """Short hair at the sides and nape under a hat brim (bob length, the face window left open)."""
    keep, pc.mat, pc.region = pc.mat, "M_Hair", "head"
    lons = [60, 90, 120, 150, 180, 210, 240, 270, 300]
    rows = lambda lon: [-42 + (edge(lon) + 47) * k / 3 for k in range(4)]     # 3 rows: long chords would sag into the head
    pc.patch(lons, rows, lambda lat, lon, ri: (0.05, 0.048, 0.056, 0.064)[ri],
             tips=lambda i, la, lb: (-52, (la + lb) / 2, 0.052) if i % 2 == 0 else None)
    pc.mat = keep


def outward(p):
    d = Vector((p.x - HC.x, p.y - HC.y, 0))
    return d.normalized()


@part("acc_beanie", "accessory", "Beanie", {"M_Main": ("outfit", 7), "M_Accent": ("outfit", 0), "M_Hair": ("hair", None)},
      sharp=45, hidesBackHair=True, group="head")
def beanie(pc):
    edge = lambda lon: 12 + 24 * math.cos(math.radians(lon))
    dome(pc, edge, lambda lon: [edge(lon) - 4, edge(lon) + 8, edge(lon) + 10, 52, 74], (0.084, 0.094, 0.08, 0.086, 0.084), 0.08)
    pc.mat = "M_Accent"
    pc.blob(hair_point(90, 0, 0.08) + Vector((0, 0, 0.03)), 0.042, segs=6, rings=4)
    pc.mat = "M_Main"
    tuck(pc, edge)


@part("acc_sunhat", "accessory", "Sun hat", {"M_Main": ("outfit", 0), "M_Accent": ("outfit", 8), "M_Hair": ("hair", None)},
      sharp=40, hidesBackHair=True, group="head")
def sunhat(pc):
    edge = lambda lon: 24 + 14 * math.cos(math.radians(lon))
    dome(pc, edge, lambda lon: [edge(lon), edge(lon) + 14, 60, 78], (0.082, 0.09, 0.09, 0.086), 0.086)
    rim = [hair_point(edge(l), l, 0.082) for l in WRAP[:-1]]
    pc.region = "head"
    pc.band([rim, [p + outward(p) * 0.06 - Vector((0, 0, 0.006)) for p in rim],
             [p + outward(p) * 0.12 - Vector((0, 0, 0.022)) for p in rim]], refs=[HC - Vector((0, 0, 0.3))] * 2)
    pc.mat = "M_Accent"
    pc.patch(WRAP, lambda lon: [edge(lon) + 1, edge(lon) + 9], lambda lat, lon, ri: 0.095)
    pc.mat = "M_Main"
    tuck(pc, edge)


@part("acc_cap", "accessory", "Cap", {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 1), "M_Hair": ("hair", None)},
      sharp=40, hidesBackHair=True, group="head")
def cap(pc):
    edge = lambda lon: 14 + 26 * math.cos(math.radians(lon))
    dome(pc, edge, lambda lon: [edge(lon), edge(lon) + 16, 58, 78], (0.078, 0.086, 0.086, 0.082), 0.08)
    lons = [-60, -30, 0, 30, 60]
    base = [hair_point(edge(l), l, 0.078) for l in lons]
    reach = [0.135 * math.cos(math.radians(l)) ** 0.6 for l in lons]
    pc.region = "head"
    pc.band([base, [p + outward(p) * r * 0.5 - Vector((0, 0, 0.004)) for p, r in zip(base, reach)],
             [p + outward(p) * r - Vector((0, 0, 0.022)) for p, r in zip(base, reach)]], closed=False,
            refs=[HC - Vector((0, 0, 0.3))] * 2)
    pc.mat = "M_Accent"
    pc.blob(hair_point(90, 0, 0.08) + Vector((0, 0, 0.004)), (0.014, 0.014, 0.008), segs=5, rings=3)
    pc.mat = "M_Main"
    tuck(pc, edge)


# ================================================================ bags (worn)
def rounded_box(pc, c, t, n, hw, hd, hh, lid=None):
    """Rounded box centred at c: t = width axis, n = depth axis (outward), up = +Z. lid: material of the top band."""
    sec = [(1, -0.55), (0.7, -1), (-0.7, -1), (-1, -0.55), (-1, 0.55), (-0.7, 1), (0.7, 1), (1, 0.55)]
    levels = [(-hh, 0.86), (-hh * 0.8, 1.0), (hh * 0.8, 1.0), (hh, 0.84)]
    rings = [[c + t * a * hw * s + n * b * hd * s + Vector((0, 0, z)) for a, b in sec] for z, s in levels]
    pc.band(rings, caps=(c - Vector((0, 0, hh + 0.002)), c + Vector((0, 0, hh + 0.004))),
            mat=(lambda i, k: lid if i == 2 else None) if lid else None)


@part("acc_backpack", "accessory", "Backpack", {"M_Main": ("outfit", 15), "M_Accent": ("outfit", 5), "M_Trim": ("outfit", 5)},
      sharp=45, group="bag")
def backpack(pc):
    pc.region = {"Spine2": 0.7, "Spine1": 0.3}
    rounded_box(pc, Vector((0, 0.157, 0.4)), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.094, 0.04, 0.094, lid="M_Accent")
    pc.mat = "M_Accent"
    rounded_box(pc, Vector((0, 0.2, 0.36)), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.056, 0.012, 0.032)
    pc.mat = "M_Trim"
    for s in (1, -1):
        path = [(155, 0.488), (125, 0.527), (62, 0.532), (36, 0.498), (28, 0.448), (30, 0.395)]
        kit.strip(pc, [T(s * l, z, CL + 0.019) for l, z in path], 0.022)
    pc.mat = "M_Main"


@part("acc_shoulder_bag", "accessory", "Shoulder bag", {"M_Main": ("outfit", 4), "M_Accent": ("outfit", 5)}, sharp=45, group="bag")
def shoulder_bag(pc):
    p = T(32, 0.3, CL + 0.05)
    n = kit.torso_out(p)
    t = Vector((0, 0, 1)).cross(n).normalized()
    pc.region = "torso"
    rounded_box(pc, p, t, n, 0.05, 0.02, 0.04, lid="M_Accent")
    pc.mat = "M_Accent"
    path = [(24, 0.34), (8, 0.375), (-18, 0.43), (-45, 0.49), (-75, 0.528), (-105, 0.528), (-140, 0.482),
            (-175, 0.42), (150, 0.37), (115, 0.338), (75, 0.334), (44, 0.34)]
    kit.strip(pc, [T(l, z, CL + 0.021) for l, z in path], 0.017)
    pc.mat = "M_Main"


@part("acc_scarf", "accessory", "Scarf", {"M_Main": ("outfit", 9)}, sharp=50, group="neck")
def scarf(pc):
    pc.region = "torso"
    loop = [Vector((math.sin(a) * 0.118, 0.004 - math.cos(a) * 0.098, 0.526 - 0.008 * math.cos(a)))
            for a in (math.tau * k / 10 for k in range(10))]
    pc.tube(loop, [(0.024, 0.018)] * 10, sides=6, closed_loop=True, up=Vector((0, 0, 1)))
    pc.blob(T(22, 0.512, CL + 0.035), (0.03, 0.022, 0.026), segs=6, rings=4)
    pc.tube([T(24, 0.5, CL + 0.03), T(27, 0.455, CL + 0.024), T(29, 0.405, CL + 0.02)], [(0.007, 0.024)] * 3, sides=4, tip=False)


kit.build_parts(PARTS, rig, "accessories", "accessories")
print("ACCESSORIES_OK", len(PARTS))
