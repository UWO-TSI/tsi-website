"""Hat tuck locks (avatar v7; head-roblox, row 309: the modular lock library is gone, David's 21 whole hairstyles are the
hair). A hat that hides the hair carries its own tuck: seven short locks round the sides and back under its edge, on an
under-cap at cap_outer. build_accessories.py sweeps them with locks.py on the head.

Coordinates: ("s", lat, lon, off) on the scalp pushed out by off metres (off 0 = a root; the sweep buries it).
Keys per lock: flat, segs, sides (4 diamond, 5 flat-bottomed), blunt (0 point .. 0.9 cut), hug (rest on the head).
"""
from head_shape import hair_outer

GROOVE = 0.012          # the tuck's under-cap sits this far under the lock tops: the separation between locks
CAP_FLOOR = 0.010       # and never nearer the scalp than this (its quads sag a few mm; a thinner cap lets skin show)


def cap_outer(lat, tight=0.0):
    return max(hair_outer(lat) - GROOVE - tight, CAP_FLOOR)


def root(lat, lon):
    return ("s", lat, lon, 0.0)


TUCK_VAR = {76: (0, 0, 1.15, 0.6), 112: (-3, -3, 1.2, 0.35), 148: (3, 2, 1.15, 0.55), 180: (0, -2, 1.2, 0.4),
            -76: (0, 1, 1.15, 0.5), -112: (3, -2, 1.2, 0.6), -148: (-2, 3, 1.15, 0.35)}


def tuck(edge):
    """The hair under a hat (avatar v7: locks, like every hair piece): bob-length locks from just under the hat's
    edge(lon) lat, round the sides and back; the hat's own crown covers the rest. Seeds for build_accessories."""
    out = []
    for lon0, (dl, dh, ws, cut) in sorted(TUCK_VAR.items()):
        lon = lon0 + dl
        e = edge(lon)
        side = 1 - min(1.0, (abs(lon0) - 72) / 60)
        hem = -44 + 6 * side + dh
        w = 0.05 * ws
        out.append(dict(pts=[root(e + 14, lon), ("s", e + 2, lon, hair_outer(e) - 0.004), ("s", -12, lon, 0.032 - 0.008 * side),
                             ("s", hem + 7, lon, 0.034 - 0.01 * side), ("s", hem, lon, 0.026 - 0.008 * side)],
                        w=[w * 0.7, w, w * 1.04, w * 0.9, w * 0.6], flat=0.45, segs=3, sides=4, blunt=cut, hug=1 if abs(lon0) < 80 else 0))
    return out
