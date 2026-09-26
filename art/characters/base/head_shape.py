"""Shared head surface for hair/accessory generators (same maths as build_v6.py `head_point`).

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
