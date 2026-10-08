"""Shared head surface for hair/accessory generators, plus what fits to it: the hair volume and hairline (avatar-fit)
and the face chart and measured feature placement (face_on_head).

Head fit (specs/characters/head-fit.md, ledger row 304; David 2026-10-08: "rounder, flatter face"). The head is the v8
SKULL: a rounded box with a flat, even face area. Its coordinates stay the v7 head's: (lat, lon) names the ray from
the head centre HC through head_point_v7(lat, lon), and head_point(lat, lon) is where that ray meets the rounded box.
So every lat/lon in the library (hair seeds, hairline, hat edges, anchors, the fit checker's rays) means the same
direction on both heads, and a point fitted to the v7 head moves to the v8 head by the change in skull radius along
its ray (refit_v7_to_v8). The face canvas (face_v7.json anchors, the atlas) is unchanged; the eye and mouth lat/lon
are solved on the new surface from those anchors.

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
    "C_TOP": HRZT, "C_BOT": HRZB,        # crown and chin (unchanged)
    "P_FRONT": 3.4, "P_BACK": 2.5,       # horizontal roundness: 2 = ellipse, higher = squarer (the flat face)
    "Q_TOP": 2.3, "Q_BOT_BACK": 2.6, "Q_BOT_FRONT": 3.4,   # vertical: the crown dome, the jaw (fuller and flatter in front)
}


def _lerp(a, b, t):
    return a + (b - a) * t


def skull_radius(d):
    """Distance from HC to the skull along the unit direction d (the superellipsoid's radial function)."""
    S = SKULL
    wf = _ss(0.35, -0.55, d.y)                  # 0 at the back, 1 over the face
    A = S["A"]
    B = _lerp(S["B_BACK"], S["B_FRONT"], wf)
    P = _lerp(S["P_BACK"], S["P_FRONT"], wf)
    if d.z >= 0:
        C, Q = S["C_TOP"], S["Q_TOP"]
    else:
        C, Q = S["C_BOT"], _lerp(S["Q_BOT_BACK"], S["Q_BOT_FRONT"], wf)
    h = abs(d.x / A) ** P + abs(d.y / B) ** P
    F = h ** (Q / P) + abs(d.z / C) ** Q
    return F ** (-1.0 / Q)


def ray(lat, lon):
    """The skull coordinate (lat, lon) as a unit direction from HC (the v7 head's parameterisation)."""
    return (head_point_v7(lat, lon) - HC).normalized()


def head_point(lat, lon):
    """The v8 head: the skull surface on the ray (lat, lon); lon 0 = front (-Y), + toward the character's left (+X)."""
    d = ray(lat, lon)
    return HC + d * skull_radius(d)


def skull_delta(p):
    """How far the skull moved outward (v7 -> v8) on p's ray from HC: a point fitted to the v7 head moves this far."""
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


def refit_v7_to_v8(p):
    """A point fitted to the v7 head, moved onto the v8 skull: along its ray from HC by the change in skull radius."""
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
