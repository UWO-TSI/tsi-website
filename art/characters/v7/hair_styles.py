"""v7 milestone-1 hairstyles as lock seeds (specs/avatar-v7.md item 2): the first curves of each style, head-relative.

Three styles, each a bangs piece and a back piece (row 191), with the catalogue ids they replace:
  short   bangs_spiky + back_short_spiky   B6.2 / B1.3 / B3.4: short layered pointed locks, volume at the crown
  bob     bangs_straight + back_bob        B2.1 / B6.4, N4.2: blunt fringe with small gaps, chin-length bob
  long    bangs_curtain + back_long        B3.1 / B5.3, N3.2: centre-parted curtain bangs, long straight back

Coordinates: ("s", lat, lon, off) on the scalp pushed out by off metres, ("d", out, side, down) a move from the
previous point (locks.spine). w = half widths per control point. The curves these make were then adjusted in the
live Blender session (the .blend files hold the adjusted curves; export_hair.py reads the .blend, not this file).
"""
import math
from head_shape import hair_vol, hairline

SEAM = lambda lat: 0.8 * hair_vol(lat)          # kit.seam_off: the height every back cap's front edge runs under


RELIEF = 0.006     # over the crown, lock tops stand this far above the library's hair volume (hair_vol): with the
                   # under-cap at 0.9 of it, ~7 mm of relief between locks, and bands still rest on the ridges


def over(lat, lon, r, flat, relief=RELIEF):
    """A spine point whose section top is `relief` above the hair volume at lat (the lock's bulk goes under it)."""
    return ("s", lat, lon, hair_vol(lat) + relief - r * flat)


def sym(lons):
    return sorted({s * l for l in lons for s in (1, -1)})


# ================================================================ bob (B2.1): cap + 10 back locks, 7 blunt fringe locks
# hand-set variation so the locks do not read as even pumpkin segments: lon shift, hem shift, width scale, tip cut
BOB_VAR = {70: (3, 0, 1.0, 0.6), 96: (-4, -3, 1.08, 0.3), 122: (2, 2, 0.94, 0.6), 150: (-3, -2, 1.06, 0.35), 180: (0, 2, 1.04, 0.5),
           -70: (-2, 1, 1.02, 0.55), -96: (3, -2, 0.95, 0.35), -122: (-4, 3, 1.06, 0.6), -150: (2, -3, 0.98, 0.3)}


def bob_back():
    locks = []
    for lon0, (dl, dh, ws, cut) in sorted(BOB_VAR.items()):
        lon = lon0 + dl
        a = abs(lon0)
        side = 1 - min(1.0, (a - 70) / 60)                       # 1 at the face-framing locks, 0 from 130 back
        hem = -44 + 6 * side + dh                                 # the hem rises a little toward the face
        w = [0.03 * ws, 0.046 * ws, 0.052 * ws, 0.055 * ws, 0.05 * ws, 0.04 * ws, 0.024 * ws]
        locks.append(dict(
            pts=[("s", 76, lon * 0.95, SEAM(76) - 0.007), over(48, lon, w[1], 0.42), over(20, lon, w[2], 0.42),
                 ("s", -12, lon, 0.03 - 0.008 * side), ("s", hem + 7, lon, 0.036 - 0.01 * side), ("s", hem, lon, 0.027 - 0.008 * side),
                 ("s", hem - 4, lon * 0.99, 0.019 - 0.006 * side)],
            w=w, flat=0.42, segs=8, sides=4, blunt=cut, hug=1 if a < 80 else 0))
    return locks


def bob_cap():
    return dict(bottom=lambda lon: -30, vol=0.9)


def straight_bangs():
    locks = []
    for lon in (-48, -32, -16, 0, 16, 32, 48):
        tip = 10 - 3 * (abs(lon) / 48) ** 2          # just above the brows (lat 2-3.4 on the face chart), as v6's fringe
        locks.append(dict(
            pts=[("s", 62, lon * 0.4, SEAM(62) - 0.008), ("s", 46, lon * 0.75, SEAM(46) - 0.001), ("s", 30, lon * 0.95, 0.013),
                 ("s", tip + 6, lon, 0.009), ("s", tip, lon, 0.007)],
            w=[x * (1.22 if abs(lon) == 48 else 1.0) for x in (0.02, 0.028, 0.033, 0.034, 0.033)],   # the outer ones
            flat=0.34, segs=5, sides=5, blunt=0.85))                                                    # meet the side locks
    for s in (1, -1):        # side locks framing the face down to the cheek, pointed
        lon = 61 * s
        locks.append(dict(
            pts=[("s", 50, lon * 0.8, SEAM(50) - 0.008), ("s", 30, lon, 0.014), ("s", 8, lon * 1.02, 0.013),
                 ("s", -10, lon * 1.02, 0.011)],
            w=[0.02, 0.026, 0.022, 0.006], flat=0.4, segs=5, sides=5, blunt=0.0))
    return locks


# ================================================================ short (B6.2 / B1.3 / B3.4): layered pointed locks
SHORT_VAR = {68: (2, 0, 1.0), 92: (-3, 3, 1.06), 116: (3, -2, 0.95), 140: (-2, 2, 1.04), 164: (3, -3, 0.97),
             -68: (-3, 2, 1.03), -92: (2, -2, 0.96), -116: (-3, 3, 1.05), -140: (3, -2, 0.98), -164: (-2, 1, 1.02)}


def short_back():
    locks = []
    for lon0, (dl, dh, ws) in sorted(SHORT_VAR.items()):
        lon = lon0 + dl
        back = min(1.0, max(0.0, (abs(lon0) - 68) / 80))        # 0 at the temples, 1 at the nape
        hem = -6 - 20 * back + dh
        flick = 8 if lon > 0 else -8                                # tips sweep a little round the head
        w = [0.03 * ws, 0.05 * ws, 0.056 * ws, 0.04 * ws, 0.012]
        locks.append(dict(
            pts=[("s", 80, lon * 0.9, SEAM(80) - 0.007), over(52, lon, w[1], 0.5, RELIEF + 0.004), over(20, lon, w[2], 0.5, RELIEF + 0.006),
                 ("s", hem + 10, lon + flick * 0.5, 0.022), ("s", hem, lon + flick, 0.014)],
            w=w, flat=0.5, segs=7, sides=4, blunt=0.0, hug=1 if abs(lon0) < 80 else 0))
    for lon, lat0, dz in ((150, 70, 0.05), (-172, 66, 0.042)):     # two crown tufts standing out of the mass
        locks.append(dict(
            pts=[("s", lat0 + 8, lon - 20, SEAM(lat0) - 0.006), ("s", lat0 + 2, lon - 6, hair_vol(lat0) + 0.012),
                 ("s", lat0 - 4, lon + 6, hair_vol(lat0) + dz)],
            w=[0.024, 0.026, 0.004], flat=0.5, segs=4, sides=4))
    return locks


def short_cap():
    return dict(bottom=lambda lon: -8 if abs(lon) < 100 else -22, vol=0.95)


def spiky_bangs():
    locks = []
    for lon, tip in ((-46, 14), (-28, 4), (-10, -1), (8, 6), (25, 10), (42, 16)):
        sw = 7                                                       # swept toward the character's left (+lon)
        locks.append(dict(
            pts=[("s", 62, lon * 0.4, SEAM(62) - 0.008), ("s", 46, lon * 0.8, SEAM(46) - 0.001), ("s", 30, lon + sw * 0.3, 0.016),
                 ("s", tip + 10, lon + sw * 0.7, 0.012), ("s", tip, lon + sw, 0.008)],
            w=[0.022, 0.03, 0.034, 0.026, 0.004], flat=0.42, segs=5, sides=5, blunt=0.0))
    for s in (1, -1):
        lon = 64 * s
        locks.append(dict(
            pts=[("s", 50, lon * 0.8, SEAM(50) - 0.008), ("s", 30, lon, 0.016), ("s", 10, lon * 1.02, 0.014),
                 ("s", -2, lon * 1.03, 0.012)],
            w=[0.02, 0.028, 0.02, 0.004], flat=0.45, segs=4, sides=5))
    return locks


# ================================================================ long (B3.1 / B5.3, N3.2): long straight back, curtain bangs
LONG_VAR = {72: (2, 1.0, 0.0), 98: (-3, 1.05, 0.02), 124: (3, 0.97, -0.015), 152: (-2, 1.05, 0.01), 180: (0, 1.03, 0.015),
            -72: (-2, 1.02, 0.01), -98: (3, 0.96, -0.02), -124: (-3, 1.05, 0.015), -152: (2, 0.99, -0.01)}


def long_back():
    locks = []
    for lon0, (dl, ws, dz) in sorted(LONG_VAR.items()):
        lon = lon0 + dl
        side = 1 - min(1.0, (abs(lon0) - 72) / 50)                 # the face-framing locks hang a little shorter
        drop = 0.26 - 0.06 * side + dz
        w = [0.03 * ws, 0.046 * ws, 0.054 * ws, 0.058 * ws, 0.056 * ws, 0.048 * ws, 0.014]
        locks.append(dict(
            pts=[("s", 76, lon * 0.95, SEAM(76) - 0.007), over(46, lon, w[1], 0.36), over(10, lon, w[2], 0.36, RELIEF + 0.004),
                 ("s", -26, lon, 0.026), ("d", 0.006, 0, drop * 0.45), ("d", 0.0, 0, drop * 0.45), ("d", -0.004, 0, drop * 0.1)],
            w=w, flat=0.36, segs=9, sides=4, blunt=0.0, hug=1 if abs(lon0) < 80 else 0))
    return locks


def long_cap():
    return dict(bottom=lambda lon: -36, vol=0.9)


def curtain_bangs():
    locks = []
    for s in (1, -1):
        for k in range(4):
            locks.append(dict(
                pts=[("s", 64, s * (2 + 3 * k), SEAM(64) - 0.008), ("s", 48, s * (5 + 7 * k), SEAM(48) - 0.001),
                     ("s", 32, s * (12 + 12 * k), 0.015), ("s", 16 - 5 * k, s * (26 + 14 * k), 0.012),
                     ("s", 2 - 9 * k, s * (37 + 14 * k), 0.009)],
                w=[0.02, 0.028, 0.032, 0.028, 0.005], flat=0.4, segs=6, sides=5))
    return locks


STYLES = {
    "short": dict(bangs=("bangs_spiky", spiky_bangs), back=("back_short_spiky", short_back), cap=short_cap),
    "bob": dict(bangs=("bangs_straight", straight_bangs), back=("back_bob", bob_back), cap=bob_cap),
    "long": dict(bangs=("bangs_curtain", curtain_bangs), back=("back_long", long_back), cap=long_cap),
}
