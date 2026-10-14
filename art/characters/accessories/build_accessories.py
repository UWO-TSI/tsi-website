"""Accessory library (deliverable 3): round + square glasses, beanie, sun hat, cap, backpack, shoulder bag, scarf;
pass 2: the crafted straw hat, flower crown, crystal circlet and shell necklace (`item` = their economy slug).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/accessories/build_accessories.py

Same contract as the outfits (kit.build_parts): each GLB = CharacterRig + one skinned mesh, flat palette materials.
Glasses and hats are built on head_shape.py and skinned to the Head bone. Glasses sit on the measured eye centre
(face_on_head), which every eye variant is painted around. Hats set hidesBackHair (row 191) and carry a closed M_Hair
tuck (the shared back cap at bob length, tinted with the hair colour at runtime), so the head never reads bald under
the brim; the chosen bangs still show and tuck under it. Hats are closed solids sitting HAT_CLEAR over the hair
volume (head_shape.hair_vol), brims closed slabs; bands (crown, circlet) rest on the hair (avatar-fit, row 242). Bags are worn, never held (row 136). Catalogue section "accessories"; `group`
says which accessories can stack: face, head, bag, neck (one of each).
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402
from kit import body as B, hair_point, HC  # noqa: E402
from head_shape import head_point, HEAD_Z, HRZB, EYE_LAT, EYE_LON, hair_vol, hair_outer  # noqa: E402
sys.path.insert(0, os.path.join(HERE, "..", "v7"))
import locks  # noqa: E402  (avatar v7: hat tucks are sculpted locks, like every hair piece)
import hair_styles  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)


def _worn_hair():
    """BVH of the default hair (bangs_straight + back_bob GLBs, rest pose). avatar v7: those are sculpted locks with
    ridges ~7 mm over the library's hair volume, so bands rest on the worn hair, not on hair_vol."""
    from mathutils.bvhtree import BVHTree
    vs, ps = [], []
    for rel in ("hair/bangs/bangs_straight.glb", "hair/back/back_bob.glb"):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "..", rel))
        new = [o for o in bpy.data.objects if o not in before]
        for o in new:
            if o.type == "MESH" and o.modifiers:
                base = len(vs)
                vs.extend(o.matrix_world @ v.co for v in o.data.vertices)
                ps.extend([base + i for i in pl.vertices] for pl in o.data.polygons)
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.images, bpy.data.actions):
        for d in list(coll):          # nothing imported may stay: the parts' materials must keep their exact names
            coll.remove(d)
    return BVHTree.FromPolygons(vs, ps)


WORN = _worn_hair()


def worn_top(lat, lon, dlat=3, dlon=8):
    """Height over the scalp of the worn default hair's outer surface, the highest within +-dlat, +-dlon (a band's
    footprint), so a band laid at that height clears every lock ridge under it."""
    top = 0.0
    for la in (lat - dlat, lat, lat + dlat):
        for lo in (lon - dlon, lon - dlon / 2, lon, lon + dlon / 2, lon + dlon):
            q = head_point(la, lo)
            d = (q - HC).normalized()
            t, far, o = None, 0.3, HC.copy()
            while True:
                loc, _, _, dist = WORN.ray_cast(o, d, far)
                if loc is None:
                    break
                t = (loc - HC).length
                o = loc + d * 1e-4
            if t is not None:
                top = max(top, t - (q - HC).length)
    return top


rig = kit.load_rig(bpy.context.scene)
with bpy.data.libraries.load(os.path.join(HERE, "..", "skull", "head.blend"), link=False) as (_src, _dst):
    _dst.objects = ["V8_Head"]
HEAD_SURF = locks.Surface(_dst.objects[0])       # the head (v8 skull) the tuck locks rest on and bury their roots in
PARTS, part = kit.registry()
T, CL = B.torso_pt, B.CL
WRAP = [30 * k for k in range(12)] + [360]


# ================================================================ glasses
def eye_frame(sx):
    """The measured eye centre (face_on_head) and the rim frame there: normal halfway to straight ahead, horizontal u,
    vertical w. Every eye variant is painted around this centre, so one pair of glasses fits them all."""
    lat, lon = EYE_LAT, sx * EYE_LON
    p = head_point(lat, lon)
    n = (head_point(lat + 1, lon) - head_point(lat - 1, lon)).cross(head_point(lat, lon + 1) - head_point(lat, lon - 1)).normalized()
    if n.dot(p - HC) < 0:
        n = -n
    n = (n + Vector((0, -1, 0))).normalized()
    u = Vector((0, 0, 1)).cross(n).normalized()
    return p, n, u, n.cross(u).normalized(), lat


def glasses(pc, outline):
    """outline: [(a, b)] rim points in the rim plane (a along u, b along w), per eye; mirrored for the right eye."""
    pc.region, rims = "head", []
    for sx in (1, -1):
        p, n, u, w, lat = eye_frame(sx)
        c = p + n * 0.017
        pts = [c + u * a * sx + w * b for a, b in outline]
        pc.tube(pts, [(0.0055, 0.004)] * len(pts), sides=4, closed_loop=True, up=n)
        inner = min(pts, key=lambda q: abs(q.x))
        outer = max(pts, key=lambda q: abs(q.x))
        rims.append((inner, outer, lat, c))
        # temples run back into the hair above the ears (their ends are buried in it)
        pc.tube([outer, hair_point(lat + 3, sx * 96, 0.006), hair_point(lat - 2, sx * 124, 0.004)], [0.004] * 3,
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


# ================================================================ hats (hide the back hair, carry a hair tuck)
HAT_CLEAR = 0.004            # the inside of a hat sits this far over the hair (avatar v7: the fuller lock hair, hair_outer;
                             # the tuck and the bangs' crown locks are under it)
LONS = kit.CAP_LONS          # 15 deg columns: a flat quad sags less than the clearance


def hat_in(lat):
    return hair_outer(lat) + HAT_CLEAR


def dome(pc, edge, rows, thick, ribbon=None):
    """Closed crown from edge(lon) up: rows(lon) -> lats; outer = hat_in + thick(lat, lon, ri), inner = hat_in.
    ribbon = row index whose band is painted M_Accent (a hat ribbon as a colour band, no extra geometry)."""
    pc.region = "head"
    n0 = pc.mark()
    g = pc.patch(LONS, rows, lambda lat, lon, ri: hat_in(lat) + thick(lat, lon, ri), wrap=True)
    if ribbon is not None:
        pc.bm.faces.ensure_lookup_table()
        for f in pc.since(n0):
            if any(v in (g[i][ribbon] for i in range(len(LONS))) for v in f.verts) and \
                    any(v in (g[i][ribbon + 1] for i in range(len(LONS))) for v in f.verts):
                pc.fmat[f] = "M_Accent"
    apex = pc.hv(90, 0, hat_in(90) + thick(90, 0, len(rows(0)) - 1))
    for i in range(len(LONS)):
        pc.f([g[i][-1], g[i + 1][-1], apex], HC)
    # closed with walls down to the hair and a fan inside the head: under the edge the hat meets the hair, no gap
    pc.close_fan(pc.since(n0), lambda v: hair_point(*pc.sph[v], hat_in(pc.sph[v][0]) - HAT_CLEAR - 0.002))
    return g


def tuck(pc, edge):
    """The hair under a hat (avatar v7: sculpted locks like the library): a matte under-cap band from bob length up 16
    deg under the hat's edge, and bob-length locks (hair_styles.tuck) whose roots are buried under the edge, so the
    head never reads bald under the brim and the bangs run under the hat as usual."""
    t, _, _ = kit.hair_cap(lambda lon: -40 if abs(lon) >= 100 else -30, top=lambda lon: edge(lon) + 16,
                           outer=hair_styles.cap_outer, hem=hair_styles.CAP_FLOOR, lons=[24 * k - 180 for k in range(15)])
    for f in t.since(0):
        t.fuv[f] = {v: (0.0, 0.5) for v in f.verts}           # matte: no gloss band between the locks
    for lk in hair_styles.tuck(edge):
        locks.sweep(t, locks.lock_of_seed(lk), HEAD_SURF)
    keep = pc.mat
    for f in t.fmat:
        t.fmat[f] = "M_Hair"
    pc.mat = "M_Hair"
    kit.merge_piece(pc, t)
    pc.mat = keep


def outward(p):
    d = Vector((p.x - HC.x, p.y - HC.y, 0))
    return d.normalized()


def brim(pc, rings, closed=True, thick=0.004):
    """A brim or visor as a closed slab: the top sheet and its underside `thick` below, joined round every edge."""
    pc.region = "head"
    n0 = pc.mark()
    pc.band(rings, closed=closed, refs=[HC - Vector((0, 0, 0.3))] * (len(rings) - 1))
    pc.thicken(pc.since(n0), lambda v: v.co - Vector((0, 0, thick)))


def hat_rows(edge, *band, span=15.0, low=None):
    """Dome rows: the edge, the band rows above it (fold, ribbon) as offsets from the edge, then even steps to lat 84
    no taller than `span` degrees where the edge is lowest (`low`), since a flat quad over the head sags by
    R(1 - cos(step / 2)) and must stay above the hair."""
    top0 = band[-1] if band else 0
    k = max(1, math.ceil((84 - (low + top0)) / span))

    def rows(lon):
        e = edge(lon)
        start = e + top0
        return [e, *[e + b for b in band], *[start + (84 - start) * j / k for j in range(1, k + 1)]]
    return rows


@part("acc_beanie", "accessory", "Beanie", {"M_Main": ("outfit", 7), "M_Accent": ("outfit", 0), "M_Hair": ("hair", None)},
      sharp=45, hidesBackHair=True, group="head")
def beanie(pc):
    """Snug knit cap pulled down over the hair: a folded brim standing 1 cm proud of a crown that hugs the hair,
    small pompom."""
    edge = lambda lon: 10 + 12 * math.cos(math.radians(lon))
    fold = lambda lat, lon, ri: 0.016 if ri < 2 else 0.008
    dome(pc, edge, hat_rows(edge, 13, 15, low=-2), fold)
    pc.mat = "M_Accent"
    pc.blob(hair_point(90, 0, hat_in(90) + 0.008) + Vector((0, 0, 0.018)), 0.026, segs=6, rings=4)
    pc.mat = "M_Main"
    tuck(pc, edge)


@part("acc_sunhat", "accessory", "Sun hat", {"M_Main": ("outfit", 0), "M_Accent": ("outfit", 8), "M_Hair": ("hair", None)},
      sharp=40, hidesBackHair=True, group="head")
def sunhat(pc):
    edge = lambda lon: 24 + 14 * math.cos(math.radians(lon))
    dome(pc, edge, hat_rows(edge, 1, 9, low=10), lambda lat, lon, ri: 0.005, ribbon=1)
    rim = [hair_point(edge(l), l, hat_in(edge(l)) + 0.004) for l in LONS]
    brim(pc, [rim, [p + outward(p) * 0.06 - Vector((0, 0, 0.006)) for p in rim],
              [p + outward(p) * 0.12 - Vector((0, 0, 0.022)) for p in rim]])
    tuck(pc, edge)


@part("acc_cap", "accessory", "Cap", {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 1), "M_Hair": ("hair", None)},
      sharp=40, hidesBackHair=True, group="head")
def cap(pc):
    edge = lambda lon: 14 + 26 * math.cos(math.radians(lon))
    dome(pc, edge, hat_rows(edge, low=-12), lambda lat, lon, ri: 0.005)
    lons = [-60, -45, -30, -15, 0, 15, 30, 45, 60]
    base = [hair_point(edge(l), l, hat_in(edge(l)) + 0.004) for l in lons]
    reach = [0.135 * math.cos(math.radians(l)) ** 0.6 for l in lons]
    brim(pc, [base, [p + outward(p) * r * 0.5 - Vector((0, 0, 0.004)) for p, r in zip(base, reach)],
              [p + outward(p) * r - Vector((0, 0, 0.022)) for p, r in zip(base, reach)]], closed=False)
    pc.mat = "M_Accent"
    pc.blob(hair_point(90, 0, hat_in(90) + 0.005) + Vector((0, 0, 0.004)), (0.014, 0.014, 0.008), segs=5, rings=3)
    pc.mat = "M_Main"
    tuck(pc, edge)


@part("acc_straw_hat", "accessory", "Straw hat", {"M_Main": ("outfit", 6), "M_Accent": ("outfit", 7), "M_Hair": ("hair", None)},
      sharp=40, hidesBackHair=True, group="head", item="acc-straw-hat")
def straw_hat(pc):
    """Round crown, wide flat brim with an upturned edge, a ribbon round the crown."""
    edge = lambda lon: 20 + 10 * math.cos(math.radians(lon))
    dome(pc, edge, hat_rows(edge, 1, 9, low=10), lambda lat, lon, ri: 0.006, ribbon=1)
    rim = [hair_point(edge(l), l, hat_in(edge(l)) + 0.005) for l in LONS]
    brim(pc, [rim, [p + outward(p) * 0.075 for p in rim], [p + outward(p) * 0.145 + Vector((0, 0, 0.014)) for p in rim]],
         thick=0.005)
    tuck(pc, edge)


def blossom(pc, c, n, r=0.03, petals=5):
    """Flat five-petal flower at c facing along n: petal star (current material) with an M_Centre heart, both closed
    thin solids (no paper edges)."""
    u = n.orthogonal().normalized()
    w = n.cross(u).normalized()
    n0 = pc.mark()
    ring = [c + (u * math.cos(a) + w * math.sin(a)) * (r if k % 2 == 0 else r * 0.5) + n * (0.004 if k % 2 == 0 else 0)
            for k, a in enumerate(math.tau * k / (2 * petals) for k in range(2 * petals))]
    mid = pc.v(c + n * 0.002)
    vs = [pc.v(p) for p in ring]
    for k in range(len(vs)):
        pc.f([vs[k], vs[(k + 1) % len(vs)], mid], c - n)
    pc.thicken(pc.since(n0), lambda v: v.co - n * 0.004)
    keep, pc.mat = pc.mat, "M_Centre"
    heart = [pc.v(c + n * 0.003 + (u * math.cos(math.tau * k / 5) + w * math.sin(math.tau * k / 5)) * r * 0.36) for k in range(5)]
    top = pc.v(c + n * 0.008)
    for k in range(5):
        pc.f([heart[k], heart[(k + 1) % 5], top], c - n)
    pc.f(heart, c + n)                   # a closed little pyramid, its base inside the petals
    pc.mat = keep


@part("acc_flower_crown", "accessory", "Flower crown",
      {"M_Main": ("outfit", 9), "M_Accent": ("outfit", 1), "M_Trim": ("outfit", 2), "M_Centre": ("outfit", 6)},
      sharp=50, group="head", item="acc-flower-crown")
def flower_crown(pc):
    """A green vine ring resting on the hair behind the hairline, with eight blossoms alternating pink and white."""
    pc.region = "head"
    lat = lambda lon: 46 + 10 * math.cos(math.radians(lon))      # behind the bangs' roots, on the cap all round
    off = lambda lon: max(hair_vol(lat(lon)) + 0.004, worn_top(lat(lon), lon, 1, 2) + 0.003)    # seated on the lock ridges
    pc.mat = "M_Trim"                                                       # (v9: a finer footprint and path over the rim)
    pc.tube([hair_point(lat(l), l, off(l)) for l in range(0, 360, 6)], [(0.0065, 0.005)] * 60, sides=4, closed_loop=True)
    for k, l0 in enumerate(range(0, 360, 45)):
        pc.mat = "M_Main" if k % 2 == 0 else "M_Accent"
        l = max(range(l0 - 12, l0 + 13, 3), key=lambda x: worn_top(lat(x), x, 1, 2))   # each blossom sits on a lock
        c = hair_point(lat(l), l, off(l))
        blossom(pc, c, (c - HC).normalized(), r=0.026)
    pc.mat = "M_Main"


@part("acc_crystal_circlet", "accessory", "Crystal circlet", {"M_Main": ("outfit", 6), "M_Accent": ("outfit", 10)},
      sharp=35, group="head", item="acc-crystal-circlet")
def crystal_circlet(pc):
    """A thin gold band across the brow, over the bangs, dipping to a crystal at the front with two small side stones."""
    pc.region = "head"
    lat = lambda lon: 19 + 2 * math.cos(math.radians(lon)) - 3 * max(0.0, math.cos(math.radians(lon))) ** 8   # head fit: 3 deg higher, over the fringe's full roll
    off = lambda lon: max(max(0.006, hair_vol(lat(lon)) * 1.1) + 0.002,      # on the fringe at the front, the cap elsewhere,
                          worn_top(lat(lon), lon, 1, 0.75 if abs(lon) < 30 else 1.5) + (0.001 if abs(lon) < 30 else 0.0025))   # on the ridges (avatar v7; head fit:
    #                                                                           the fringe lies flatter on the v8 face)
    pc.tube([hair_point(lat(l), l, off(l)) for l in range(0, 360, 5)], [(0.0032, 0.0065)] * 72, sides=4, closed_loop=True)
    pc.mat = "M_Accent"
    for lon, h, wd in ((0, 0.05, 0.022), (-32, 0.022, 0.012), (32, 0.022, 0.012)):
        c = hair_point(lat(lon) + (5 if lon == 0 else 0), lon, off(lon) + (0.012 if lon == 0 else 0.004))   # v9: clear of the fringe's roll
        n = (c - HC).normalized()
        u = Vector((0, 0, 1)).cross(n).normalized()
        up = n.cross(u).normalized()
        tip, foot = pc.v(c + up * h * 0.62), pc.v(c - up * h * 0.38)
        mid = [pc.v(c + u * wd * 0.5 * math.cos(a) + n * wd * 0.42 * math.sin(a)) for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2)]
        for k in range(4):
            pc.f([mid[k], mid[(k + 1) % 4], tip], c)
            pc.f([mid[(k + 1) % 4], mid[k], foot], c)
    pc.mat = "M_Main"


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
    # slim enough to sit inside long back hair (back_long's sheet is 0.165-0.19 behind the spine), pocket below its ends
    rounded_box(pc, Vector((0, 0.142, 0.395)), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.09, 0.025, 0.09, lid="M_Accent")
    pc.mat = "M_Accent"
    rounded_box(pc, Vector((0, 0.171, 0.334)), Vector((1, 0, 0)), Vector((0, 1, 0)), 0.052, 0.008, 0.027)
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


@part("acc_shell_necklace", "accessory", "Shell necklace", {"M_Main": ("outfit", 9), "M_Accent": ("outfit", 5), "M_Trim": ("outfit", 15)},
      sharp=50, group="neck", item="acc-shell-necklace")
def shell_necklace(pc):
    """A cord round the base of the neck dipping onto the chest: three scallop shells and two beads at the front."""
    pc.region = "torso"
    z = lambda lon: 0.505 - 0.05 * max(0.0, math.cos(math.radians(lon))) ** 1.5
    off = CL + 0.022
    pc.mat = "M_Accent"
    pc.tube([T(l, z(l), off) for l in range(0, 360, 30)], [(0.0045, 0.0045)] * 12, sides=4, closed_loop=True)
    for lon in (-17, 17):
        pc.mat = "M_Trim"
        pc.blob(T(lon, z(lon) - 0.004, off + 0.005), 0.011, segs=5, rings=3)
    pc.mat = "M_Main"
    for lon, s in ((-34, 0.8), (0, 1.0), (34, 0.8)):
        hinge = T(lon, z(lon) - 0.003, off + 0.004)
        n = kit.torso_out(hinge)
        u = Vector((0, 0, 1)).cross(n).normalized()
        # scallop: a fan from the hinge; alternate rim points stand out, so the facets read as ribs
        fan = [hinge + (u * math.sin(a) - Vector((0, 0, 1)) * math.cos(a)) * 0.036 * s + n * (0.008 if k % 2 else 0.003)
               for k, a in enumerate(math.radians(d) for d in (-54, -36, -18, 0, 18, 36, 54))]
        h, vs = pc.v(hinge), [pc.v(p) for p in fan]
        for k in range(6):
            pc.f([h, vs[k], vs[k + 1]], hinge - n)


# ================================================================ Halloween costumes (the traditions calendar)
# Free to wear while a tradition with the costume closet runs (web/lib/content/traditions.ts): `event` names it, the
# wardrobe offers them only then, and they come off at its end (look.ts eventPartOpen). Matte like the rest.

@part("acc_witch_hat", "accessory", "Witch hat", {"M_Main": ("outfit", 12), "M_Accent": ("outfit", 7), "M_Hair": ("hair", None)},
      sharp=40, hidesBackHair=True, group="head", event="halloween")
def witch_hat(pc):
    """A wide drooping brim, an orange band round the cone's foot, and a tall cone that bends back over the crown."""
    edge = lambda lon: 22 + 12 * math.cos(math.radians(lon))
    dome(pc, edge, hat_rows(edge, 9, low=10), lambda lat, lon, ri: 0.005)
    rim = [hair_point(edge(l), l, hat_in(edge(l)) + 0.004) for l in LONS]
    brim(pc, [rim, [p + outward(p) * 0.07 - Vector((0, 0, 0.004)) for p in rim],
              [p + outward(p) * 0.15 - Vector((0, 0, 0.03)) for p in rim]])
    top = hair_point(90, 0, hat_in(90) + 0.005)
    pc.region = "head"
    # The band and the cone as one closed solid: the band's ring in M_Accent, six sides, bent back to a point. A hat stays
    # within the headwear share of a look's ~4000 triangles (look.test.ts) and the skull's hat box (fit_check.py).
    ring = lambda c, r: [c + Vector((math.cos(math.tau * k / 6) * r, math.sin(math.tau * k / 6) * r, 0)) for k in range(6)]
    rings = [ring(top - Vector((0, 0, 0.03)), 0.083), ring(top + Vector((0, 0.002, 0.025)), 0.079), ring(top + Vector((0, 0.022, 0.08)), 0.036)]
    pc.band(rings, caps=(top - Vector((0, 0, 0.032)), top + Vector((0, 0.056, 0.104))), mat=lambda i, k: "M_Accent" if i == 0 else None)
    tuck(pc, edge)


@part("acc_cat_ears", "accessory", "Cat ears", {"M_Main": ("outfit", 14), "M_Accent": ("outfit", 9)}, sharp=35, group="head", event="halloween")
def cat_ears(pc):
    """A thin band over the crown, resting on the hair, with two pointed ears: dark outside, pink inside."""
    pc.region = "head"
    lat = lambda lon: 52 + 6 * math.cos(math.radians(lon))
    off = lambda lon: max(hair_vol(lat(lon)) + 0.003, worn_top(lat(lon), lon, 1, 2) + 0.002)
    pc.tube([hair_point(lat(l), l, off(l)) for l in range(-100, 101, 5)], [(0.004, 0.006)] * 41, sides=4, tip=False)
    for sx in (1, -1):
        lon = sx * 42
        base = hair_point(lat(lon), lon, off(lon))
        n = (base - HC).normalized()
        side = Vector((0, 0, 1)).cross(n).normalized() if abs(n.z) < 0.98 else Vector((1, 0, 0))
        front = n.cross(side).normalized()
        tip = base + n * 0.105 + side * sx * 0.014
        for mat, depth, shrink in (("M_Main", 0.012, 1.0), ("M_Accent", -0.004, 0.62)):
            pc.mat = mat
            w = 0.05 * shrink
            a, b = base + side * w - n * 0.004, base - side * w - n * 0.004
            c0 = base + front * depth
            t = base + (tip - base) * (0.92 if shrink < 1 else 1) + front * depth * 0.5
            va, vb, vc, vt = pc.v(a), pc.v(b), pc.v(c0), pc.v(t)
            cen = (a + b + c0 + t) / 4                     # a closed little pyramid: every face looks away from its middle
            for tri in ([va, vb, vt], [vb, vc, vt], [vc, va, vt], [va, vc, vb]):
                pc.f(tri, cen)
    pc.mat = "M_Main"


@part("acc_pumpkin_head", "accessory", "Pumpkin head", {"M_Main": ("outfit", 7), "M_Accent": ("fixed", "#3B2114"), "M_Trim": ("outfit", 3)},
      sharp=40, hidesBackHair=True, hides=["bangs"], group="head", event="halloween", encloses=True)
def pumpkin_head(pc):
    """A carved pumpkin over the whole head, ribbed, a stem on top, the face cut in dark on the front; open under the chin."""
    pc.region = "head"
    reach = max((hair_point(la, lo, hair_vol(la) + 0.012) - HC).length for la in range(-60, 91, 10) for lo in range(0, 360, 30))
    rx, rz = reach * 1.1, reach * 1.03          # v9: the classic head's rim corners stand out of a rounder shell
    n = 16
    rings = []
    for k, lat in enumerate((-58, -40, -20, 0, 20, 40, 60, 78)):
        la = math.radians(lat)
        ring = []
        for j in range(n):
            lo = math.tau * j / n
            rib = 1 - 0.06 * (0.5 + 0.5 * math.cos(lo * 8))
            ring.append(HC + Vector((math.sin(lo) * math.cos(la) * rx * rib, -math.cos(lo) * math.cos(la) * rx * rib, math.sin(la) * rz - 0.01)))
        rings.append(ring)
    n0 = pc.mark()
    # Closed under the chin too (round the neck, inside the shell): no open edge.
    pc.band(rings, caps=(HC + Vector((0, 0, math.sin(math.radians(-62)) * rz)), HC + Vector((0, 0, rz * 0.97))))
    pc.thicken(pc.since(n0), lambda v: HC + (v.co - HC) * 0.97)
    pc.mat = "M_Trim"
    stem = HC + Vector((0, 0, rz * 0.95))
    pc.tube([stem, stem + Vector((0.006, 0.004, 0.04)), stem + Vector((0.016, 0.01, 0.06))], [0.016, 0.013, 0.01], sides=5, tip=False)
    pc.mat = "M_Accent"
    n_face = pc.mark()
    front = lambda x, z: HC + Vector((x, -math.sqrt(max(rx * rx * (1 - (z / rz) ** 2) - x * x, 1e-6)) - 0.003, z))
    for sx in (1, -1):
        tri = [front(sx * 0.02, 0.012), front(sx * 0.07, 0.012), front(sx * 0.045, 0.05)]
        pc.f([pc.v(p) for p in (tri if sx > 0 else tri[::-1])], HC)
    grin = [front(x, z) for x, z in ((-0.075, -0.03), (-0.04, -0.05), (-0.02, -0.04), (0.0, -0.055), (0.02, -0.04), (0.04, -0.05),
                                     (0.075, -0.03), (0.035, -0.075), (0.0, -0.082), (-0.035, -0.075))]
    mid = pc.v(front(0.0, -0.06))
    vs = [pc.v(p) for p in grin]
    for k in range(len(vs)):
        pc.f([vs[k], vs[(k + 1) % len(vs)], mid], HC)
    pc.thicken(pc.since(n_face), lambda v: HC + (v.co - HC) * 0.994)       # the carving as thin closed solids
    pc.mat = "M_Main"


@part("acc_vampire_cape", "accessory", "Vampire cape", {"M_Main": ("outfit", 14), "M_Accent": ("fixed", "#8E2F3A")}, sharp=45, group="neck",
      event="halloween")
def vampire_cape(pc):
    """A high stiff collar standing up round the back of the neck, red inside, and a short black cape down the back to
    the waist, flaring a little (short, so a running leg never swings through it)."""
    pc.region = "torso"
    lons = list(range(80, 281, 20))
    # the cape: rows from the shoulders down the back, flaring out
    rows = []
    for k, z in enumerate((0.535, 0.49, 0.44, 0.39, 0.35)):
        flare = 0.012 + 0.03 * k / 4
        rows.append([T(l, z, CL + flare) for l in lons])
    zs = (0.535, 0.49, 0.44, 0.39, 0.35)
    n0 = pc.mark()
    pc.band(rows, closed=False, refs=[Vector((0, 0, (zs[i] + zs[i + 1]) / 2)) for i in range(len(rows) - 1)])   # outward, off the body
    pc.thicken(pc.since(n0), lambda v: v.co - kit.torso_out(v.co) * 0.006)
    # the collar: two rows standing up and out behind the neck
    pc.mat = "M_Accent"
    clons = list(range(110, 251, 14))
    collar = [[T(l, 0.54, CL + 0.012) for l in clons], [T(l, 0.6, CL + 0.03) + kit.torso_out(T(l, 0.6, CL)) * 0.02 for l in clons]]
    n1 = pc.mark()
    pc.band(collar, closed=False, refs=[Vector((0, 0, 0.57))])
    pc.thicken(pc.since(n1), lambda v: v.co - kit.torso_out(v.co) * 0.005)
    pc.mat = "M_Main"


kit.build_parts(PARTS, rig, "accessories", "accessories")
print("ACCESSORIES_OK", len(PARTS))
