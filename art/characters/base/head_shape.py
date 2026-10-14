"""Shared head surface for hair/accessory generators, plus what fits to it: the hair volume and hairline (avatar-fit)
and the face chart and measured feature placement (face_on_head).

Head fit (specs/characters/head-fit.md, ledger row 304; David 2026-10-08: "rounder, flatter face"). The head is the v8
SKULL: a rounded box with a flat, even face area. Its coordinates stay the v7 head's: (lat, lon) names the ray from
the head centre HC through head_point_v7(lat, lon), and head_point(lat, lon) is where that ray meets the rounded box.
So every lat/lon in the library (hair seeds, hairline, hat edges, anchors, the fit checker's rays) means the same
direction on both heads, and a point fitted to the v7 head moves to the v8 head by the change in skull radius along
its ray (refit_v7). The face canvas (face_v7.json anchors, the atlas) is unchanged; the eye and mouth lat/lon
are solved on the new surface from those anchors.

Roblox hair zone (v9, specs/characters/head-roblox.md, ledger row 309; David 2026-10-14): where hair sits (the top,
the crown, the back, the sides and the forehead above the brows) the skull is Roblox's classic head (Roblox's official
R15 reference rig: a 1.2-stud rounded cylinder) at STUD metres per stud; the face area (the brows to the chin, the face
plate and its corners) stays the v8 skull, so the painted face keeps its placement. skull_radius blends the two by
face_weight. Hair made for the classic head then attaches rigidly at HAIR_ATT, the classic head's HairAttachment.

Measurements come from ref18_measurements.json, so re-measuring or tweaking the head here regenerates every
piece that is built against it. Keep in sync with build_v6.py (v6 has its own copy so its build stays frozen
while David reviews it).
"""
import json, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, "ref18_measurements.json")))["ratios_of_body_height"]
HRZT = HRZB = M["head_height"] / 2
HEAD_Z = 1.0 - HRZT
HC = Vector((0, 0, HEAD_Z))
CHIN = 1.0 - M["head_height"]
_R = {"x": 1.0, "y": 0.89}


def _ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def head_point_v7(lat, lon):
    """The v7 head (avatar v7 to 2026-10-08): lat/lon in degrees; lon 0 = front (-Y), + toward the character's left
    (+X). Kept as the skull's coordinate system and to refit pieces built on the v7 head."""
    la, lo = math.radians(lat), math.radians(lon)
    cl, sl = math.cos(la), math.sin(la)
    x = cl * math.sin(lo) * _R["x"]
    y = -cl * math.cos(lo) * _R["y"]
    z = HRZT * sl ** 0.92 if lat >= 0 else -HRZB * (-sl) ** 0.62
    jaw = _ss(12, -22, lat) * (1 - 0.55 * _ss(-58, -88, lat))
    x *= (1 + 0.13 * jaw) * (1 - 0.05 * _ss(15, 70, lat))
    front = max(0.0, math.cos(lo)) ** 2
    muzzle = math.exp(-((lat + 36) / 24) ** 2)
    y *= 1 + 0.16 * muzzle * front + 0.05 * jaw
    if lat > 0:
        y *= 1 - 0.05 * sl
    return HC + Vector((x, y, z))


_w = max(abs(head_point_v7(la, 90).x - HC.x) for la in range(-89, 90))
_R["x"] = M["head_width"] / 2 / _w
_R["y"] = _R["x"] * 0.87


# ---------------------------------------------------------------- the v8 skull: a rounded box with a flat face
# A superellipsoid whose shape varies smoothly from back to front: |x/A|^P + |y/B|^P gives the horizontal section (a
# rounded square, flatter in front: P_FRONT), raised to Q/P and added to |z/C|^Q for the vertical profile (a round
# crown, a fuller, flatter jaw in front: Q_BOT_FRONT). Width, crown and chin stay the measured ref-18 head.
SKULL = {
    "A": 0.215,                   # half width (v7 0.218-0.223 at its widest; the box's corners carry the volume)
    "B_FRONT": 0.192, "B_BACK": 0.186,   # face plane and back of the skull from HC (v7 0.189-0.198 / 0.186)
    "C_TOP": HRZT, "C_BOT": HRZB,        # crown and chin (ref 18's)
    "C_BOT_FRONT": HRZB + 0.03,          # the chin under the face 3 cm lower: flat room for mouths and drool down to the
                                         # canvas's bottom edge (David's faces, row 305: W 0.999)
    "P_FRONT": 4.0, "P_BACK": 2.5,       # horizontal roundness: 2 = ellipse, higher = squarer (the flat face, wide enough for
                                         # David's widest eyes, row 305)
    "Q_TOP": 2.3, "Q_BOT_BACK": 2.6, "Q_BOT_FRONT": 4.5,   # vertical: the crown dome, the jaw (fuller and flatter in front)
}


def _lerp(a, b, t):
    return a + (b - a) * t


def v8_radius(d):
    """Distance from HC to the v8 skull along the unit direction d (the superellipsoid's radial function): the face
    area of the v9 skull, and the head the v8 hair was fitted to."""
    S = SKULL
    wf = _ss(0.35, -0.55, d.y)                  # 0 at the back, 1 over the face
    A = S["A"]
    B = _lerp(S["B_BACK"], S["B_FRONT"], wf)
    P = _lerp(S["P_BACK"], S["P_FRONT"], wf)
    if d.z >= 0:
        C, Q = S["C_TOP"], S["Q_TOP"]
    else:
        C, Q = _lerp(S["C_BOT"], S["C_BOT_FRONT"], wf), _lerp(S["Q_BOT_BACK"], S["Q_BOT_FRONT"], wf)
    h = abs(d.x / A) ** P + abs(d.y / B) ** P
    F = h ** (Q / P) + abs(d.z / C) ** Q
    return F ** (-1.0 / Q)


# ---------------------------------------------------------------- v9: Roblox's classic head where hair sits
# Roblox's classic head (Roblox/avatar, Legacy/rigs/R15_Block.fbx, Head_Geo; the same head in LC_ClassicMale/Female):
# a cylinder of radius R studs and half height H whose rims are rounded with radius F, its HairAttachment (and
# HatAttachment) at the top centre. Measured from the reference mesh: R 0.599, H 0.600, fillet 0.30 (the mesh's chords
# sit inside by at most 0.01 stud).
CLASSIC = {"R": 0.6, "H": 0.6, "F": 0.3}
STUD = SKULL["A"] / CLASSIC["R"]          # metres per stud: the classic head as wide as ours (0.358 m)
CLASSIC_DY = 0.012                        # its axis this far behind HC: the forehead stands about 1 cm proud of the
                                          # face plane on the centre line, the face corners stand out of the round
                                          # sides as little as that allows
CLASSIC_C = HC + Vector((0.0, CLASSIC_DY, SKULL["C_TOP"] - CLASSIC["H"] * STUD))    # its top is our crown
HAIR_ATT = CLASSIC_C + Vector((0.0, 0.0, CLASSIC["H"] * STUD))                       # Roblox's HairAttachment
# Where the skull keeps the v8 face (weight 1) and where it is the classic head (0). David, 2026-10-14: "round the
# cheeks": sideways and downward the v8 face is kept exactly where a painted part can sit, measured on the face canvas
# of the v8 skull: the creator's placement area (web/lib/game/character/face.ts FACE_AREA: U 0.07-0.93, down to W
# 0.985) widened to the widest default parts (David's eyes reach U 0.04, his drool W 1.0), FACE_MARGIN of canvas beyond
# it (so the mesh triangles under paint keep v8 corners); over the next FACE_RAMP the cheeks and the jaw corners round
# into the classic head. Upward the forehead turns into the classic head between FACE_LAT[0] and FACE_LAT[1] (lat, deg:
# above the brows, below the hairline, so the bangs' roll and the hairline seam lie on the classic head). Below the nape line (hair hangs free there) the head tapers into the v8 jaw, nape and chin, which the
# neck joins: from NECK_LAT[0] (lat -26 is the nape line at the back) to fully v8 at NECK_LAT[1], all round.
FACE_KEEP = (0.04, 0.30, 0.96, 1.0)       # U0, W0 (above it the forehead rule), U1, W1
FACE_LAT = (14.0, 34.0)
FACE_MARGIN = 0.08
FACE_RAMP = 0.12
NECK_LAT = (-20.0, -65.0)
ZONE_STEP = 2.0          # deg: the face weight's grid (geocentric lat, |lon|), cached in skull/face_zone.json


def _classic_sdf(x, y, z):
    """Signed distance (m) from the classic head at STUD scale, relative to its centre."""
    a, b, f = (CLASSIC["R"] - CLASSIC["F"]) * STUD, (CLASSIC["H"] - CLASSIC["F"]) * STUD, CLASSIC["F"] * STUD
    dx = math.hypot(x, y) - a
    dz = abs(z) - b
    return math.hypot(max(dx, 0.0), max(dz, 0.0)) + min(max(dx, dz), 0.0) - f


def classic_radius(d):
    """Distance from HC to the classic head along the unit direction d: Newton from the exit of its bounding cylinder
    (beyond the surface; the head is convex, so the iteration closes in from outside)."""
    o = HC - CLASSIC_C
    R, H = CLASSIC["R"] * STUD, CLASSIC["H"] * STUD
    t = 1.0
    a_ = d.x * d.x + d.y * d.y
    if a_ > 1e-12:
        b_ = o.x * d.x + o.y * d.y
        c_ = o.x * o.x + o.y * o.y - R * R
        t = min(t, (-b_ + math.sqrt(max(0.0, b_ * b_ - a_ * c_))) / a_)
    if abs(d.z) > 1e-12:
        t = min(t, ((H if d.z > 0 else -H) - o.z) / d.z)
    for _ in range(12):
        f = _classic_sdf(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t)
        if abs(f) < 1e-7:
            break
        h = 1e-5
        g = (_classic_sdf(o.x + d.x * (t + h), o.y + d.y * (t + h), o.z + d.z * (t + h)) - f) / h
        t -= f / max(g, 0.05)
    return t


def _v8_point(lat, lon):
    d = ray(lat, lon)
    return HC + d * v8_radius(d)


def _v8_chart(lat, lon, n=12):
    """face_chart on the v8 skull (the canvas the paint was placed on)."""
    su = _arc(lambda t: _v8_point(lat, t), 0.0, lon, n) if lon else 0.0
    sw = _arc(lambda t: _v8_point(t, lon), 0.0, lat, n) if lat else 0.0
    return 0.5 + su / (2 * FH), 0.5 - sw / (2 * FH)


def _ray_coords(d):
    """The ray coordinates (lat, lon) whose ray is the unit direction d (Newton from the geocentric angles)."""
    la = math.degrees(math.asin(max(-1.0, min(1.0, d.z))))
    lo = math.degrees(math.atan2(d.x, -d.y))
    for _ in range(8):
        r = ray(la, lo)
        e = r - d
        if e.length < 1e-7:
            break
        h = 0.01
        ja, jo = (ray(la + h, lo) - r) / h, (ray(la, lo + h) - r) / h
        # least squares on the 3-vector residual: [ja jo] [dla dlo] = -e
        a11, a12, a22 = ja.dot(ja), ja.dot(jo), jo.dot(jo)
        b1, b2 = -ja.dot(e), -jo.dot(e)
        det = a11 * a22 - a12 * a12
        if abs(det) < 1e-12:
            break
        la = max(-89.9, min(89.9, la + (a22 * b1 - a12 * b2) / det))
        lo += (a11 * b2 - a12 * b1) / det
    return la, lo


_ZONE = None
_ZONE_PATH = os.path.join(HERE, "..", "skull", "face_zone.json")


def _zone_params():
    return {"keep": list(FACE_KEEP), "margin": FACE_MARGIN, "ramp": FACE_RAMP, "step": ZONE_STEP, "rule": "sideways and down",
            "v8": {k: round(v, 6) for k, v in SKULL.items()}}


def _zone():
    """The face weight on the (geocentric lat, |lon|) grid: from the v8 canvas distance to FACE_KEEP. Cached on disk
    (it takes a few seconds), rebuilt whenever its parameters change."""
    global _ZONE
    if _ZONE is not None:
        return _ZONE
    try:
        doc = json.load(open(_ZONE_PATH))
        if doc.get("params") == json.loads(json.dumps(_zone_params())):
            _ZONE = doc["w"]
            return _ZONE
    except (OSError, ValueError):
        pass
    u0, w0, u1, w1 = FACE_KEEP
    lats = [-90 + ZONE_STEP * i for i in range(int(180 / ZONE_STEP) + 1)]
    lons = [ZONE_STEP * j for j in range(int(180 / ZONE_STEP) + 1)]
    grid = []
    for la in lats:
        row = []
        for lo in lons:
            a, b = math.radians(la), math.radians(lo)
            d = Vector((math.cos(a) * math.sin(b), -math.cos(a) * math.cos(b), math.sin(a)))
            if abs(la) > 89.5 or lo > 135:          # the poles and the back: far off the canvas
                row.append(0.0)
                continue
            rl, ro = _ray_coords(d)
            u, w = _v8_chart(rl, ro)
            dist = math.hypot(max(u0 - u, 0.0, u - u1), max(0.0, w - w1))         # sideways and down only
            row.append(round(1.0 - _ss(FACE_MARGIN, FACE_MARGIN + FACE_RAMP, dist), 5))
        grid.append(row)
    _ZONE = grid
    try:
        json.dump({"note": "head_shape._zone(): the v8 face kept (1) round the painted face, the classic head (0) elsewhere; "
                           "rows geocentric lat -90..90, columns |lon| 0..180, ZONE_STEP deg. Generated: delete to rebuild.",
                   "params": _zone_params(), "w": grid}, open(_ZONE_PATH, "w"))
    except OSError:
        pass
    return _ZONE


def face_weight(d):
    """1 where the skull is the v8 face, 0 where it is the classic head (the hair zone): bilinear on the cached grid."""
    g = _zone()
    la = math.degrees(math.asin(max(-1.0, min(1.0, d.z))))
    lo = abs(math.degrees(math.atan2(d.x, -d.y)))
    fi, fj = (la + 90.0) / ZONE_STEP, lo / ZONE_STEP
    i0, j0 = min(int(fi), len(g) - 2), min(int(fj), len(g[0]) - 2)
    ti, tj = fi - i0, fj - j0
    w = (g[i0][j0] * (1 - ti) * (1 - tj) + g[i0 + 1][j0] * ti * (1 - tj) + g[i0][j0 + 1] * (1 - ti) * tj
         + g[i0 + 1][j0 + 1] * ti * tj)
    return max(min(w, _ss(FACE_LAT[1], FACE_LAT[0], la)), _ss(NECK_LAT[0], NECK_LAT[1], la))


def skull_radius(d):
    """Distance from HC to the skull (v9) along the unit direction d: the classic head blended into the v8 face."""
    rc = classic_radius(d)
    return rc + face_weight(d) * (v8_radius(d) - rc)


def ray(lat, lon):
    """The skull coordinate (lat, lon) as a unit direction from HC (the v7 head's parameterisation)."""
    return (head_point_v7(lat, lon) - HC).normalized()


def head_point(lat, lon):
    """The v8 head: the skull surface on the ray (lat, lon); lon 0 = front (-Y), + toward the character's left (+X)."""
    d = ray(lat, lon)
    return HC + d * skull_radius(d)


def skull_delta(p):
    """How far the skull moved outward (v7 -> now) on p's ray from HC: a point fitted to the v7 head moves this far."""
    d = (p - HC)
    if d.length < 1e-9:
        return 0.0
    d = d.normalized()
    return skull_radius(d) - _v7_radius(d)


_V7_TREE = None


def _v7_radius(d):
    """Radius of the v7 analytic head along d (ray cast against a 2-degree mesh of head_point_v7)."""
    global _V7_TREE
    if _V7_TREE is None:
        from mathutils.bvhtree import BVHTree
        lats = [-90 + 2 * i for i in range(91)]
        lons = [-180 + 2 * j for j in range(180)]
        vs = [head_point_v7(la, lo) for la in lats for lo in lons]
        n = len(lons)
        polys = [[i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j]
                 for i in range(len(lats) - 1) for j in range(n)]
        _V7_TREE = BVHTree.FromPolygons(vs, polys)
    loc, _, _, _ = _V7_TREE.ray_cast(HC, d, 1.0)
    return (loc - HC).length if loc is not None else skull_radius(d)


def refit_v7(p):
    """A point fitted to the v7 head, moved onto the skull: along its ray from HC by the change in skull radius."""
    d = p - HC
    if d.length < 1e-9:
        return p.copy()
    return p + d.normalized() * skull_delta(p)


def hair_point(lat, lon, off):
    """Point on the head surface pushed out radially from the head centre by `off` metres."""
    p = head_point(lat, lon)
    d = p - HC
    return HC + d * (1 + off / d.length)


# ---------------------------------------------------------------- the hair volume everything on the head fits to
INNER = -0.004        # hair undersides sit 4 mm inside the scalp: no gap shows between hair and head from any angle


def hair_vol(lat):
    """Outer surface of the hair mass, metres above the scalp: 1.1 cm at the hairline and below, fuller toward the
    crown (2.4 cm), the chunky ref-18 mass. Back caps follow it, bangs tuck their roots just under it, hats and
    bands sit on it (avatar-fit, row 242)."""
    return 0.011 + 0.013 * _ss(0, 80, lat)


def hair_outer(lat):
    """The outer surface of the v7 sculpted-lock hair, metres above the scalp (avatar v7, David 2026-09-30: "Fuller,
    like the sheet"): lock tops stand this high, the hats sit on it and the hat tucks and bands follow it. About
    3.2 cm at the hairline and 4.3 cm at the crown, 2 cm down the sides (hair_vol was 1.1-2.4 cm)."""
    return hair_vol(lat) + 0.008 + 0.011 * _ss(-10, 70, lat)


def hairline(lon):
    """Front edge of the back caps (lat, degrees): 44 above the brow centre, down to 22 at the temples (|lon| 60),
    where the side panels start. Bangs lie on the forehead below it and tuck their roots under it."""
    a = min(abs(lon), 60.0) / 60.0
    return 22 + 22 * (1 - a * a) ** 0.7


# ---------------------------------------------------------------- the face chart (UVs of the painted face)
FH = HRZT             # the face canvas spans 2 FH metres of arc each way (unchanged canvas size)
_FACE = json.load(open(os.path.join(HERE, "ref18_measurements.json")))["face_on_head"]
_V7_FACE = os.path.join(HERE, "..", "v7", "face", "face_v7.json")
FACE_ANCHORS = json.load(open(_V7_FACE))["anchors"]     # canvas points of the painted face (frozen with the atlas)


def _arc(fn, a, b, n):
    s, prev = 0.0, fn(a)
    for i in range(1, n + 1):
        cur = fn(a + (b - a) * i / n)
        s += (cur - prev).length
        prev = cur
    return s if b >= a else -s


def face_chart(lat, lon, n=32):
    """Face canvas coordinates (U right, W down, 0..1) of head_point(lat, lon): U = 0.5 + arc length along the parallel
    from the centre line, W = 0.5 - arc length along the meridian from the equator, both over 2 FH. Arc lengths follow
    the head's curvature, so a painted feature keeps its size and shape wherever it sits (a front planar projection
    stretched the eyes 1.7x toward the sides and slid the far eye round the head in 3/4 view)."""
    su = _arc(lambda t: head_point(lat, t), 0.0, lon, n) if lon else 0.0
    sw = _arc(lambda t: head_point(t, lon), 0.0, lat, n) if lat else 0.0
    return 0.5 + su / (2 * FH), 0.5 - sw / (2 * FH)


def chart_inv(u, w, guess):
    """(lat, lon) whose face_chart is (u, w): Newton from a nearby guess."""
    la, lo = guess
    for _ in range(16):
        u0, w0 = face_chart(la, lo, 16)
        if abs(u0 - u) < 1e-6 and abs(w0 - w) < 1e-6:
            break
        h = 0.05
        ua, wa = face_chart(la + h, lo, 16)
        ub, wb = face_chart(la, lo + h, 16)
        j = ((ua - u0) / h, (ub - u0) / h, (wa - w0) / h, (wb - w0) / h)
        det = j[0] * j[3] - j[1] * j[2]
        du, dw = u - u0, w - w0
        la += (j[3] * du - j[1] * dw) / det
        lo += (-j[2] * du + j[0] * dw) / det
    return la, lo


# The painted features' centres on this head, solved from the canvas anchors (the atlas is unchanged): the eye anchor
# is the canvas-left eye (the character's right, -lon); EYE_LON is its mirror.
EYE_LAT, _eye_lon = chart_inv(1 - FACE_ANCHORS["eye"][0], FACE_ANCHORS["eye"][1], (_FACE["eye_lat_deg"], _FACE["eye_lon_deg"]))
EYE_LON = abs(_eye_lon)
MOUTH_LAT = chart_inv(0.5, FACE_ANCHORS["mouth"][1], (_FACE["mouth_lat_deg"], 0.0))[0]
