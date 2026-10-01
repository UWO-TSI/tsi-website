"""Shared head surface for hair/accessory generators (same maths as build_v6.py `head_point`), plus what fits to it:
the hair volume and hairline (avatar-fit) and the face chart and measured feature placement (face_on_head).

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


def head_point(lat, lon):
    """lat/lon in degrees; lon 0 = front (-Y), + toward the character's left (+X)."""
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


_w = max(abs(head_point(la, 90).x - HC.x) for la in range(-89, 90))
_R["x"] = M["head_width"] / 2 / _w
_R["y"] = _R["x"] * 0.87


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
EYE_LAT, EYE_LON, MOUTH_LAT = _FACE["eye_lat_deg"], _FACE["eye_lon_deg"], _FACE["mouth_lat_deg"]


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
