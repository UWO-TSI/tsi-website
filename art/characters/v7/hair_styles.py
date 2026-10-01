"""v7 hair library as lock seeds (specs/avatar-v7.md item 2; David 2026-09-30: approved, "Fuller, like the sheet").

Every catalogue id is a set of locks (and, for back pieces, an under-cap). These seeds made the first curves of each
piece in the live Blender session; the .blend files (hair_bangs.blend, hair_backs.blend) hold the curves as edited
there and export_hair.py reads those, not this file.

Volume (head_shape.hair_outer): lock tops reach ~3.2 cm over the scalp at the hairline and ~4.3 cm at the crown.
Back pieces lie on an under-cap GROOVE under that, so the grooves between locks read deep. Every bangs piece owns
the front crown: its locks root (buried) at the crown whorl and run forward at full volume, over the hairline, down to
the fringe, so bangs and back meet in buried roots with no ledge on any pair.

Coordinates: ("s", lat, lon, off) on the scalp pushed out by off metres (off 0 = a root; the sweep buries it),
("d", out, side, down) a move from the previous point (locks.spine). w = half widths per control point.
Keys per lock: flat, segs, sides (4 diamond, 5 flat-bottomed), blunt (0 point .. 0.9 cut), hug (rest on the head).
"""
import math
from head_shape import hair_vol, hair_outer, hairline, _ss

GROOVE = 0.012          # the back pieces' under-cap sits this far under the lock tops: the separation between locks
CAP_FLOOR = 0.010       # and never nearer the scalp than this: its 20 deg quads sag ~4 mm and the v7 head stands up to
                        # 3.3 mm proud of the analytic surface, so a thinner cap lets skin show through in flecks


GROOVE_V8 = 0.0065     # avatar v8: shallow grooves, the locks read as one soft mass


def cap_outer(lat, tight=0.0, groove=GROOVE):
    return max(hair_outer(lat) - groove - tight, CAP_FLOOR)


def top(lat, lon, r, flat, dz=0.0):
    """A spine point whose lock's top reaches the hair's outer surface (+ dz) at lat."""
    return ("s", lat, lon, hair_outer(lat) + dz - r * flat)


def root(lat, lon):
    return ("s", lat, lon, 0.0)


def mirror(locks):
    """The same locks on the other side (lon -> -lon, swept moves flipped)."""
    out = []
    for lk in locks:
        pts = [(p[0], p[1], -p[2], p[3]) if p[0] == "s" else (p[0], p[1], -p[2], p[3]) for p in lk["pts"]]
        out.append(dict(lk, pts=pts))
    return out


# ================================================================ bangs
def fringe(lon, tip_lat, tip_lon=None, w=0.033, w_tip=None, flat=0.42, blunt=0.0, segs=7, crown=0.25, lift=0.0,
           sides=5, hug=1, mid_off=0.014):
    """One fringe lock: buried root at the crown whorl, over the front crown at full volume, rolling over the
    hairline, down the forehead to its tip. tip_lon swings the lower part (sweeps); lift raises the roll (bowl, lift)."""
    tl = lon if tip_lon is None else tip_lon
    hl = hairline(lon)
    pts = [root(84, lon * crown), top(70, lon * 0.55, w * 0.8, flat, -0.002), top(hl + 10, lon * 0.85 + (tl - lon) * 0.05, w, flat, lift - 0.002),
           ("s", hl - 4, lon + (tl - lon) * 0.25, hair_outer(hl) - w * flat * 0.8 - 0.006 + lift),
           ("s", (hl - 4 + tip_lat) / 2, lon + (tl - lon) * 0.65, mid_off), ("s", tip_lat, tl, 0.007)]
    wt = w if w_tip is None else w_tip
    return dict(pts=pts, w=[w * 0.55, w * 0.85, w, w, w * 0.98, wt], flat=flat, segs=segs, sides=sides, blunt=blunt, hug=hug,
                hug_from=0.06)            # a fringe rests on the skin all along: its roll over the hairline is solid, no air under it


def side_lock(s, tip_lat, lon=62, w=0.026, flat=0.42, blunt=0.0, segs=6, out=0.016, sides=4):
    """A face-framing lock from the crown side down past the temple."""
    L = s * lon
    return dict(pts=[root(80, s * 30), top(62, s * (lon - 18), w * 0.9, flat), top(30, L, w, flat, -0.004),
                     ("s", (30 + tip_lat) / 2 + 2, L * 1.02, out + 0.004), ("s", tip_lat, L * 1.03, out)],
                w=[w * 0.6, w * 0.9, w, w * 0.9, w * 0.25 if not blunt else w * 0.85], flat=flat, segs=segs, sides=sides, blunt=blunt, hug=1)


def crown_only(lons, w=0.034, flat=0.42):
    """Crown locks that stop at the hairline (bangs whose fringe is see-through or absent still carry the volume)."""
    return [dict(pts=[root(84, lon * 0.25), top(70, lon * 0.55, w * 0.8, flat), top(hairline(lon) + 8, lon * 0.9, w, flat),
                      ("s", hairline(lon) - 1, lon, 0.006)], w=[w * 0.55, w * 0.85, w, w * 0.5], flat=flat, segs=5, sides=5, hug=1)
            for lon in lons]


def straight(tip=10, side=-10, extra=0.0):
    locks = [fringe(lon, tip - 3 * (abs(lon) / 48) ** 2, w=0.033 * (1.22 if abs(lon) == 48 else 1.0), blunt=0.85)
             for lon in (-48, -32, -16, 0, 16, 32, 48)]
    return locks + [side_lock(s, side, 61, blunt=0.0) for s in (1, -1)]


def bowl():
    lons = (-56, -42, -28, -14, 0, 14, 28, 42, 56)
    return [fringe(lon, 16 - 12 * (abs(lon) / 56) ** 2, w=0.03, blunt=0.7, lift=0.006, flat=0.48) for lon in lons]


def wispy():
    strands = [dict(pts=[("s", 54, c * 0.8, 0.0), ("s", 40, c, 0.012), ("s", 24, c + (2 if c < 0 else -2 if c > 0 else 0), 0.01),
                         ("s", 8, c + (4 if c < 0 else -4 if c > 0 else 1), 0.007)],
                    w=[0.008, 0.014, 0.012, 0.003], flat=0.45, segs=5, sides=4, hug=1) for c in (-44, -22, 0, 22, 44)]
    return crown_only((-56, -36, -16, 4, 24, 44, 60)) + strands + [side_lock(s, -6, 62, w=0.02) for s in (1, -1)]


def swept(s):
    """Side-swept toward the character's left (s = 1) or right (s = -1): high on the far side, low on the near."""
    locks = []
    for k in range(7):
        lon = s * (-54 + 18 * k)
        t = k / 6
        locks.append(fringe(lon, 30 - 26 * t, tip_lon=lon + s * 20, w=0.034, crown=0.15))
    return locks + [side_lock(-s, 12, 62, w=0.022), side_lock(s, -14, 64)]


def curtain(long=False):
    locks = []
    for sd in (1, -1):
        n = 3 if long else 4
        for k in range(n):
            tip_lat = (2 - 9 * k) if not long else (0 - 21 * k)
            tip_lon = sd * (37 + 14 * k) if not long else sd * (38 + 15 * k)
            locks.append(fringe(sd * (6 + 12 * k), tip_lat, tip_lon=tip_lon, w=0.03, crown=0.1))
    return locks


def centre_split():
    locks = []
    for sd in (1, -1):
        for k, (lon, tl, tlon) in enumerate(((6, 6, 22), (22, 2, 38), (38, -6, 54))):
            locks.append(fringe(sd * lon, tl, tip_lon=sd * tlon, w=0.032, crown=0.1, blunt=0.3))
    return locks + [side_lock(s, -12, 64) for s in (1, -1)]


def spiky():
    locks = [fringe(lon, tip, tip_lon=lon + 7, w=0.034, crown=0.3) for lon, tip in ((-46, 14), (-28, 4), (-10, -1), (8, 6), (25, 10), (42, 16))]
    return locks + [side_lock(s, -2, 64, w=0.026) for s in (1, -1)]


def hime():
    locks = [fringe(lon, 12 - 2 * (abs(lon) / 42) ** 2, w=0.034, blunt=0.85) for lon in (-42, -28, -14, 0, 14, 28, 42)]
    return locks + [side_lock(s, -50, 66, w=0.03, blunt=0.85, segs=9, out=0.017) for s in (1, -1)]


def choppy():
    lons = (-52, -38, -24, -10, 4, 18, 32, 46)
    tips = (30, 24, 32, 26, 34, 27, 31, 25)
    return [fringe(lon, tip, tip_lon=lon + (4 if k % 3 else -4), w=0.03, crown=0.3, segs=6) for k, (lon, tip) in enumerate(zip(lons, tips))] + \
        [side_lock(s, 14, 62, w=0.022) for s in (1, -1)]


def swept_back():
    """No fringe: locks rise from the hairline, roll up and run back over the crown (a soft pompadour lift)."""
    locks = []
    for lon in (-52, -34, -17, 0, 17, 34, 52):
        hl = hairline(lon)
        locks.append(dict(pts=[root(hl - 2, lon), ("s", hl + 2, lon, hair_outer(hl) * 0.9), top(hl + 14, lon * 0.92, 0.034, 0.45, 0.004),
                               top(66, lon * 0.6, 0.032, 0.45), ("s", 82, lon * 0.3, hair_outer(82) - 0.012)],
                          w=[0.028, 0.034, 0.034, 0.03, 0.012], flat=0.45, segs=7, sides=5, hug=1, hug_from=0.06))
    return locks


def single_strand():
    locks = [fringe(lon, tip, w=0.03, crown=0.3, segs=6) for lon, tip in ((-44, 30), (-28, 26), (-12, 28), (4, 25), (20, 29), (36, 26), (50, 30))]
    long = fringe(-18, -20, tip_lon=-10, w=0.024, w_tip=0.004, crown=0.2)
    return locks + [long] + [side_lock(s, 12, 62, w=0.022) for s in (1, -1)]


def wavy():
    locks = []
    for k, lon in enumerate((-50, -33, -16, 1, 18, 35, 52)):
        lk = fringe(lon, 22 - 18 * (lon + 50) / 102, tip_lon=lon + 10, w=0.033, crown=0.2)
        # an S along the forehead: the mid point swings back, the tip swings forward
        p = lk["pts"]
        p[4] = (p[4][0], p[4][1], p[4][2] - 7, p[4][3])
        lk["tilt"] = [0, 0, 0.15, -0.25, 0.3, 0]
        locks.append(lk)
    return locks + [side_lock(-1, 4, 62, w=0.024), side_lock(1, -12, 64)]


def asym_block():
    locks = [fringe(lon, 8 if lon < 0 else 28, w=0.034, blunt=0.8) for lon in (-50, -34, -18, -2, 14, 30, 46)]
    return locks + [side_lock(-1, -30, 66, w=0.03, blunt=0.6), side_lock(1, 6, 62, w=0.022)]




# ================================================================ backs (an under-cap + locks)
def back_lock(lon, hem, w=0.05, flat=0.45, segs=8, bulge=0.034, curl=0.01, blunt=0.5, hug=None, sides=5):
    """A back lock from the crown whorl down the back/side to a hem latitude, bulging out below the ears."""
    side = 1 - min(1.0, (abs(lon) - 70) / 60)
    return dict(pts=[root(84, lon * 0.95), top(56, lon, w * 0.9, flat), top(20, lon, w, flat, 0.002),
                     ("s", -12, lon, bulge - 0.008 * side), ("s", hem + 7, lon, bulge + 0.002 - 0.01 * side),
                     ("s", hem, lon, bulge - 0.008 - 0.008 * side), ("s", hem - 4, lon * 0.99, bulge - 0.016 - curl - 0.006 * side)],
                w=[w * 0.55, w * 0.9, w, w * 1.04, w * 0.95, w * 0.78, w * 0.45], flat=flat, segs=segs, sides=sides, blunt=blunt,
                hug=(1 if abs(lon) < 80 else 0) if hug is None else hug)


VAR = {72: (2, 0, 1.0, 0.6), 98: (-4, -3, 1.08, 0.3), 124: (3, 2, 0.95, 0.6), 152: (-3, -2, 1.06, 0.35), 180: (0, 2, 1.04, 0.5),
       -72: (-2, 1, 1.02, 0.55), -98: (3, -2, 0.96, 0.35), -124: (-4, 3, 1.05, 0.6), -152: (2, -3, 0.98, 0.3)}


def bob():
    out = []
    for lon0, (dl, dh, ws, cut) in sorted(VAR.items()):
        side = 1 - min(1.0, (abs(lon0) - 72) / 60)
        out.append(back_lock(lon0 + dl, -44 + 6 * side + dh, w=0.052 * ws, blunt=cut))
    return out


def bowl_back():
    out = []
    for lon0, (dl, dh, ws, cut) in sorted(VAR.items()):
        hem = -10 - 22 * min(1.0, max(0.0, (abs(lon0) - 80) / 70)) + dh * 0.5
        out.append(back_lock(lon0 + dl, hem, w=0.054 * ws, blunt=0.85, bulge=0.03, curl=0.004))
    return out


def short_layered():
    out = []
    for lon0, (dl, dh, ws, cut) in sorted(VAR.items()):
        lon = lon0 + dl
        back = min(1.0, max(0.0, (abs(lon0) - 68) / 80))
        hem = -6 - 20 * back + dh
        flick = 8 if lon > 0 else -8
        w = 0.052 * ws
        out.append(dict(pts=[root(84, lon * 0.9), top(52, lon, w, 0.5, 0.004), top(20, lon, w, 0.5, 0.002),
                             ("s", hem + 10, lon + flick * 0.5, 0.024), ("s", hem, lon + flick, 0.014)],
                        w=[w * 0.6, w, w * 1.05, w * 0.75, 0.012], flat=0.5, segs=7, sides=5, hug=1 if abs(lon0) < 80 else 0))
    for lon, lat0, dz in ((150, 70, 0.05), (-172, 66, 0.042)):     # two crown tufts standing out of the mass
        out.append(dict(pts=[root(lat0 + 8, lon - 20), ("s", lat0 + 2, lon - 6, hair_outer(lat0) - 0.004),
                             ("s", lat0 - 4, lon + 6, hair_outer(lat0) + dz - 0.02)], w=[0.024, 0.026, 0.004], flat=0.5, segs=4, sides=4))
    return out


def long_locks(drop=0.26, wave=0.0, flare=0.0, n_extra=0):
    out = []
    for lon0, (dl, ws, dz) in sorted({72: (2, 1.0, 0.0), 98: (-3, 1.05, 0.02), 124: (3, 0.97, -0.015), 152: (-2, 1.05, 0.01),
                                      180: (0, 1.03, 0.015), -72: (-2, 1.02, 0.01), -98: (3, 0.96, -0.02), -124: (-3, 1.05, 0.015),
                                      -152: (2, 0.99, -0.01)}.items()):
        lon = lon0 + dl
        side = 1 - min(1.0, (abs(lon0) - 72) / 50)
        d = drop - 0.06 * side + dz
        w = 0.054 * ws
        sw = (1 if (lon0 // 26) % 2 else -1) * wave
        out.append(dict(pts=[root(84, lon * 0.95), top(46, lon, w, 0.4), top(8, lon, w * 1.04, 0.4, 0.004), ("s", -26, lon, 0.03),
                             ("d", 0.008 + flare * 0.5, sw, d * 0.45), ("d", flare, -sw, d * 0.45), ("d", -0.004, sw * 0.5, d * 0.1)],
                        w=[w * 0.55, w * 0.9, w, w * 1.06, w * 1.02, w * 0.88, 0.014], flat=0.4, segs=9, sides=4, hug=1 if abs(lon0) < 80 else 0))
    return out


def wolf():
    out = []
    for lon0, (dl, dh, ws, cut) in sorted(VAR.items()):       # long shaggy layer, flicking out at the neck
        lon = lon0 + dl
        w = 0.05 * ws
        out.append(dict(pts=[root(84, lon * 0.95), top(54, lon, w, 0.45, 0.004), top(18, lon, w, 0.45), ("s", -18, lon, 0.034),
                             ("s", -40 + dh, lon * 1.02, 0.046), ("s", -50 + dh, lon * 1.05, 0.07)],
                        w=[w * 0.55, w * 0.9, w, w, w * 0.7, 0.008], flat=0.45, segs=8, sides=4, hug=1 if abs(lon0) < 80 else 0))
    for lon in (-160, -120, -84, 84, 120, 160):                  # a short upper layer of pointed tufts
        out.append(dict(pts=[root(70, lon * 0.95), top(40, lon + 6, 0.036, 0.45, 0.006), ("s", 6, lon + 10, 0.034), ("s", -4, lon + 14, 0.04)],
                        w=[0.02, 0.036, 0.03, 0.006], flat=0.45, segs=5, sides=4, hug=0))
    return out


def gather(tie, n, lons, lat_from=40, w=0.05):
    """Pulled-back hair: locks combed to a tie point (lat, lon). A tie above the ears (ponytail, buns) gathers locks
    from the hairline and the nape upward; a low tie (pigtails) gathers them from the crown downward, so no lock
    folds back on itself."""
    tlat, tlon = tie
    out = []
    for lon in lons:
        dl = ((tlon - lon + 180) % 360) - 180               # the short way round to the tie
        if tlat >= 30:
            rl = hairline(lon) - 2 if abs(lon) < 62 else 0
            r = root(rl, lon)
            m0 = max(lat_from, rl + 8)                        # always rising toward a high tie (no fold)
            mid = top(m0, lon, w, 0.35, -0.006)
            m1 = (m0 + tlat) / 2
        else:
            r = root(84, lon * 0.9)
            mid = top(56, lon, w, 0.35, -0.006)
            m1 = (56 + tlat) / 2
        out.append(dict(pts=[r, mid, top(m1, lon + dl / 2, w * 0.9, 0.35, -0.006), ("s", tlat, lon + dl, hair_outer(tlat) - 0.012)],
                        w=[w * 0.8, w, w * 0.85, w * 0.4], flat=0.35, segs=6, sides=4, hug=1))
    return out


def tail(p0, path, n=5, w=0.03, spread=0.012, seed=0):
    """A bundle of n locks from a tie point along a path of moves (a ponytail, a pigtail)."""
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n + seed
        dx, dy = math.cos(a) * spread, math.sin(a) * spread
        r0 = (p0[0], p0[1] + 3 * math.cos(a), p0[2] + 3 * math.sin(a), p0[3])     # roots fanned round the tie point
        pts = [r0] + [("d", m[0] + dx * (i + 1) * 0.3, m[1] + dy * (i + 1) * 0.3, m[2]) for i, m in enumerate(path)]
        out.append(dict(pts=pts, w=[w * 0.8, w, w * 0.95, w * 0.7, w * 0.15][:len(pts)], flat=0.6, segs=5, sides=4, hug=0))
    return out


def high_pony():
    out = gather((54, 180), 9, (-150, -120, -90, 90, 120, 150), 30, 0.05)            # the bangs own the front crown
    out += [dict(pts=[root(84, lon * 0.3), top(70, lon, 0.04, 0.35, -0.012), ("s", 56, 180 if lon > 0 else -180, hair_outer(56) - 0.014)],
                 w=[0.02, 0.04, 0.02], flat=0.35, segs=4, sides=4) for lon in (-150, -90, 90, 150)]
    out += tail(("s", 52, 180, hair_outer(52) - 0.004), [(0.05, 0, -0.02), (0.03, 0, 0.08), (0.0, 0, 0.11), (-0.01, 0, 0.06)], n=5, w=0.032)
    return out


def pigtails():
    out = gather((-6, 108), 5, (60, 80, 100, 130, 160), 30, 0.05) + gather((-6, -108), 5, (-60, -80, -100, -130, -160), 30, 0.05)
    for s in (1, -1):
        out += tail(("s", -8, s * 108, hair_outer(-8) - 0.004), [(0.03, 0, 0.05), (0.01, 0, 0.1), (0.0, 0, 0.1), (-0.005, 0, 0.05)],
                    n=4, w=0.03, seed=s)
    return out


def bun_coil(lat, lon, r, height):
    """A bun: four short locks coiled round a knot (a closed blob made in hair_build) on top of the gathered hair."""
    out = []
    for k in range(4):
        a = k * 90
        out.append(dict(pts=[("s", lat - 6, lon + a * 0.1 - 15, hair_outer(lat) - 0.01),
                             ("s", lat, lon + 12 * math.cos(math.radians(a)), hair_outer(lat) + height * 0.6),
                             ("s", lat + 4, lon - 10 * math.sin(math.radians(a)), hair_outer(lat) + height * 0.9)],
                        w=[0.02, r * 0.55, r * 0.2], flat=0.6, segs=4, sides=4, hug=0))
    return out


def twin_buns():
    out = []
    for s in (1, -1):
        out += gather((56, s * 62), 3, [s * l for l in (76, 110, 150)], 34, 0.05)
    return out


def single_bun():
    return gather((66, 180), 7, (-150, -110, -76, 76, 110, 150, 180), 34, 0.05)


def braid_crown():
    """A plait ringing the head behind the bangs' roots: a chain of short leaf-shaped locks, alternating sides."""
    out = []
    n = 14
    for k in range(n):
        lo0 = -180 + 360 * k / n
        lo1 = lo0 + 360 / n * 1.35
        lat = lambda lo: (hairline(lo) + 18) if abs(((lo + 180) % 360) - 180) < 75 else 34
        tilt = 0.6 if k % 2 else -0.6
        out.append(dict(pts=[("s", lat(lo0), lo0, hair_outer(lat(lo0)) - 0.002), ("s", lat((lo0 + lo1) / 2) + (2 if k % 2 else -2), (lo0 + lo1) / 2, hair_outer(lat(lo0)) + 0.012),
                             ("s", lat(lo1), lo1, hair_outer(lat(lo1)) - 0.002)], w=[0.008, 0.02, 0.006], tilt=[tilt] * 3,
                        flat=0.6, segs=3, sides=4, hug=0))
    return bob_short_back() + out


def bob_short_back():
    return [back_lock(lon, -34 + 4 * math.cos(math.radians(lon)), w=0.052, blunt=0.4, bulge=0.026, sides=4, segs=7)
            for lon in (-152, -124, -98, -72, 72, 98, 124, 152, 180)]


def undercut():
    """Shaved sides and nape (the under-cap itself, a smooth 1 cm layer: OUTER below), a full top swept to one side."""
    out = []
    for lon in (-150, -118, -86, 86, 118, 150, 180):   # the top round the sides and back, swept back (the bangs own the front)
        out.append(dict(pts=[root(82, lon * 0.6), top(58, lon, 0.05, 0.45, 0.004), top(38, lon + 10, 0.048, 0.45, 0.002),
                             ("s", 26, lon + 14, hair_outer(26) - 0.016)], w=[0.03, 0.05, 0.048, 0.02], flat=0.45, segs=6, sides=5, hug=0))
    return out


# ================================================================ avatar v8: the organic look (rounded clumps)
def clump(lon, hem, w=0.056, flat=0.34, root_lat=64, bulge=0.03, curl=0.012, flick=0.0, tip=0.18, blunt=0.15, segs=7,
          lift=0.0):
    """A soft back clump: its root tucked under the crown mass (the under-cap) at root_lat, over the head at full
    volume, bulging below the ears and tapering to a tip at the hem lat; flick (deg) swings the tip sideways, lift (m)
    turns it out; curl turns it under."""
    side = 1 - min(1.0, (abs(lon) - 70) / 60)            # 1 at the sides, 0 at the back
    r0 = w * 0.48
    mid = -12 if hem + 8 < -16 else (16 + hem + 8) / 2    # short styles: the bulge sits between the ears' top and the hem
    return dict(pts=[("s", root_lat, lon * 0.97, cap_outer(root_lat, 0.0, GROOVE_V8) - 0.007 - r0 * flat),   # inside the crown mass
                     top(root_lat - 20, lon, w * 0.9, flat, -0.002), top(16, lon, w, flat, 0.002),
                     ("s", mid, lon, bulge - 0.008 * side), ("s", hem + 8, lon + flick * 0.3, bulge + 0.002 - 0.01 * side),
                     ("s", hem, lon + flick * 0.7, bulge - 0.008 - 0.008 * side + lift * 0.5),
                     ("s", hem - 5, lon + flick, bulge - 0.016 - curl - 0.006 * side + lift)],
                w=[r0, w * 0.9, w, w * 1.04, w * 0.95, w * 0.7, w * tip], flat=flat, segs=segs, sides=6, blunt=blunt,
                hug=1 if abs(lon) < 80 else 0, bury=0)


def bob8():
    """The bob (A2.1): nine soft clumps over the crown mass, hems a little uneven, tips tapered and turned under,
    a flick out at each side and a small pointed tuft at the nape."""
    out = []
    for lon0, (dl, dh, ws, _) in sorted(VAR.items()):
        side = 1 - min(1.0, (abs(lon0) - 72) / 60)
        flick = {72: 9, -72: -9, 124: 4, -152: -4}.get(lon0, 0)
        out.append(clump(lon0 + dl + (4 if lon0 == 72 else -4 if lon0 == -72 else 0), -44 + 6 * side + dh,
                         w=0.06 * ws * (0.8 if abs(lon0) == 72 else 1.0), flick=flick, lift=0.01 if flick else 0.0,
                         curl=0.004 if flick else 0.012, root_lat=62 + 3 * dh))
    for lon, hem in ((166, -50), (-166, -48), (138, -47)):       # short tapered tufts breaking the hem line
        out.append(dict(pts=[root(10, lon), ("s", -10, lon, 0.032), ("s", hem + 6, lon + 2, 0.028), ("s", hem, lon + 4, 0.02)],
                        w=[0.02, 0.026, 0.02, 0.004], flat=0.4, segs=4, sides=6, hug=0))
    return out


def straight8():
    """The straight-cut fringe, softened: rounded clumps, the cut a little uneven, the outer clumps tapering."""
    tips = {-48: 8, -32: 10.5, -16: 9, 0: 10.5, 16: 9.5, 32: 11, 48: 7.5}
    locks = [fringe(lon, t, w=0.034 * (1.18 if abs(lon) == 48 else 1.0), blunt=0.75 if abs(lon) < 48 else 0.3,
                    w_tip=None if abs(lon) < 48 else 0.02, sides=6, flat=0.4) for lon, t in tips.items()]
    return locks + [side_lock(s, -10, 61, w=0.027, sides=6) for s in (1, -1)]


def curtain8():
    """Curtain bangs parted at the centre, each clump sweeping out to the temple and tapering."""
    locks = []
    for sd in (1, -1):
        for k, (dt, ws) in enumerate(((-1, 1.05), (1.5, 0.95), (-1, 1.0), (2, 1.1))):
            locks.append(fringe(sd * (6 + 12 * k), 2 - 9 * k + dt * sd, tip_lon=sd * (37 + 14 * k), w=0.031 * ws,
                                w_tip=0.012, crown=0.1, sides=6, flat=0.4))
    return locks


def spiky8():
    """Spiky tufts (A2.3, S1.1): pointed clumps of uneven length swinging both ways, a cowlick flicking up at the crown."""
    locks = [fringe(lon, tip, tip_lon=lon + sw, w=0.035, w_tip=0.004, crown=0.3, sides=6, flat=0.42)
             for lon, tip, sw in ((-46, 16, -6), (-28, 3, 7), (-10, -1, 9), (8, 8, 4), (25, 12, 8), (42, 18, 2))]
    locks.append(dict(pts=[root(80, 24), ("s", 74, 34, hair_outer(74) - 0.004), ("s", 68, 46, hair_outer(68) + 0.012),
                           ("s", 64, 58, hair_outer(64) + 0.03)], w=[0.016, 0.022, 0.016, 0.003], flat=0.45, segs=4, sides=6, hug=0))
    return locks + [side_lock(s, -2, 64, w=0.027, sides=6) for s in (1, -1)]


LONG_VAR = {72: (2, 1.0, 0.0), 98: (-3, 1.05, 0.02), 124: (3, 0.97, -0.015), 152: (-2, 1.05, 0.01), 180: (0, 1.03, 0.015),
            -72: (-2, 1.02, 0.01), -98: (3, 0.96, -0.02), -124: (-3, 1.05, 0.015), -152: (2, 0.99, -0.01)}


def long8(drop=0.26):
    """Long straight (B3.1, K1.3): soft clumps from the crown mass hanging past the shoulders, lengths uneven, tips
    tapered, the outer ones swinging a little."""
    out = []
    for lon0, (dl, ws, dz) in sorted(LONG_VAR.items()):
        lon = lon0 + dl
        side = 1 - min(1.0, (abs(lon0) - 72) / 50)
        d = drop - 0.06 * side + dz
        w, flat = 0.058 * ws, 0.34
        r0 = w * 0.48
        rl = 60 + dl
        sw = {72: 0.014, -72: -0.014, 152: 0.008, -124: -0.01}.get(lon0, 0.0)
        out.append(dict(pts=[("s", rl, lon * 0.97, cap_outer(rl, 0.0, GROOVE_V8) - 0.007 - r0 * flat), top(rl - 20, lon, w * 0.9, flat, -0.002),
                             top(6, lon, w * 1.04, flat, 0.004), ("s", -26, lon, 0.03), ("d", 0.008, sw * 0.3, d * 0.45),
                             ("d", 0.002, sw * 0.5, d * 0.42), ("d", -0.004 + abs(sw) * 0.5, sw, d * 0.13)],
                        w=[r0, w * 0.9, w, w * 1.06, w, w * 0.8, w * 0.16], flat=flat, segs=8, sides=6, blunt=0.1,
                        hug=1 if abs(lon0) < 80 else 0, bury=0))
    out.append(dict(pts=[root(6, 140), ("s", -26, 140, 0.03), ("d", 0.006, 0, 0.13), ("d", -0.002, 0.004, 0.09)],
                    w=[0.02, 0.026, 0.02, 0.004], flat=0.4, segs=4, sides=6, hug=0))
    return out


def short8():
    """Short layered (B6.2, A2.3, S2.2): short soft clumps flicking out at the nape and over the ears, two tufts
    breaking the crown's silhouette. One layer, so no lower tip pokes out under the one above (v7's rough spot)."""
    out = []
    for lon0, (dl, dh, ws, _) in sorted(VAR.items()):
        lon = lon0 + dl
        back = min(1.0, max(0.0, (abs(lon0) - 68) / 80))
        flick = (9 if lon > 0 else -9) * (1 if lon0 % 3 else -0.6)
        out.append(clump(lon, -6 - 20 * back + dh, w=0.058 * ws * (0.85 if abs(lon0) == 72 else 1.0), flat=0.36, bulge=0.03, curl=-0.002, flick=flick,
                         lift=0.014, tip=0.12, blunt=0.0, segs=6, root_lat=60 + 2 * dh))
    for lon, lat0, dz in ((150, 70, 0.045), (-172, 66, 0.038)):     # two crown tufts standing out of the mass
        out.append(dict(pts=[root(lat0 + 8, lon - 20), ("s", lat0 + 2, lon - 6, hair_outer(lat0) - 0.004),
                             ("s", lat0 - 4, lon + 6, hair_outer(lat0) + dz - 0.02)], w=[0.024, 0.026, 0.004], flat=0.5, segs=4, sides=6))
    return out


# ---------------------------------------------------------------- new types (avatar v8 deliverable 2): curls, braids
def curl(lat, lon, size=0.034, base=None, turn=1, lean=0.0, bury=0):
    """A curl clump: a fat short lock coiling out of the mass (a C seen from the side), its root buried in the mass or
    the scalp. base(lat) is the mass's outer height (the afro), else hair_outer."""
    h = (base or hair_outer)(lat)
    a = lambda k: math.radians(lon + turn * k)
    return dict(pts=[("s", lat - 4, lon - turn * 4, h - size * 0.9), ("s", lat + 2, lon + lean, h + size * 0.15),
                     ("s", lat + 6, lon + turn * 5 + lean, h + size * 0.45), ("s", lat + 3, lon + turn * 11 + lean, h + size * 0.35),
                     ("s", lat - 1, lon + turn * 12 + lean, h + size * 0.05)],
                w=[size * 0.6, size, size * 0.95, size * 0.75, size * 0.25], flat=0.78, segs=4, sides=6, hug=0, bury=bury)


AFRO = 0.062            # m the afro's mass stands out beyond the library's hair volume (hair_outer) at the crown and sides


def afro_outer(lat, lon=180.0):
    """The afro's mass (outer height over the scalp): hair_outer at the hairline and the nape, rounding out to +AFRO."""
    hl = hairline(lon)
    rise = _ss(hl + 4, hl + 36, lat) if abs(lon) < 61 else _ss(-30, 0, lat)
    return hair_outer(lat) + AFRO * rise * (1 - 0.25 * _ss(70, 90, lat))


def ball(lat, lon, r, base=None, sink=0.35, tall=0.85, dlat=0.0, dlon=0.0):
    """A curl clump as a soft ball (locks.coil): its bottom pole buried in the mass (base(lat) its outer height, else
    hair_outer), `sink` of it under that surface; dlat/dlon tip its top a little, so the clumps don't all stand straight."""
    h = (base or hair_outer)(lat)
    c = h - r * sink
    return dict(pts=[("s", lat, lon, c - r * tall), ("s", lat + dlat, lon + dlon, c + r * tall)], w=[r, r], coil=1, hug=0)


def afro(n=19):
    """The afro (avatar v8, no reference sheet: drawn in hair-acnh's language): a round mass (the under-cap, built in
    hair_build) covered in big soft curl clumps, so the silhouette is a lumpy cloud; it covers the front crown as well,
    so any fringe tucks under it."""
    out = []
    for k in range(n):                         # a golden-angle spiral over the mass, down to the nape, outside the face
        z = 1 - (k + 0.5) / n * 1.38
        lat = math.degrees(math.asin(z))
        lon = ((k * 137.508 + 20) % 360) - 180
        r = 0.072 + 0.01 * math.sin(k * 1.7)
        if abs(lon) < 66 and lat < hairline(lon) + 30:
            lat, r = hairline(lon) + 30 + (k % 3) * 3, r * 0.8    # the front: behind the hairline, so the mass rises from the fringe
        out.append(ball(lat, lon, r, base=lambda la, lo=lon: afro_outer(la, lo) - 0.012,
                        sink=0.3, dlat=4 * math.sin(k), dlon=5 * math.cos(k * 1.3)))
    return out


def curls_fringe():
    """Curly fringe (pairs with the afro and the coming curly styles): rows of curl clumps from the hairline back over
    the front crown to the whorl, at the library's volume, so it owns the front crown like every bangs piece, sits on
    any back piece and tucks under the afro's mass."""
    out = [ball(hairline(lon) - 3 + 3 * (k % 2), lon, 0.03, base=lambda la: 0.024, sink=0.25, dlat=-6, dlon=3 * (k % 3 - 1))
           for k, lon in enumerate((-36, -18, 0, 18, 36))]
    out += [ball(hairline(lon) + 6, lon, 0.034, sink=0.7, dlat=-4) for lon in (-46, -23, 0, 23, 46)]
    out += [ball(68, lon, 0.036, sink=0.7) for lon in (-32, 0, 32)]
    return out + [ball(86, 0, 0.045, sink=0.75)]


def braid(pts, w=0.017, lobes=4, length=0.24, flare=0.0):
    """A box braid: a plait whose hanging part is `lobes` lobes, wide and narrow in turn, each wide ring twisted the
    other way and the spine zig-zagging a little, so the diamond section reads as a three-strand plait."""
    step = length / (2 * lobes)
    hang = [("d", 0.002 + flare * (i == 0), (w * 0.35 if (i // 2) % 2 else -w * 0.35) if i % 2 == 0 else 0.0, step)
            for i in range(2 * lobes)]
    ps = pts + hang
    ws = [w * 0.8] + [w] * (len(pts) - 1) + [w * (1.15 if i % 2 == 0 else 0.72) for i in range(2 * lobes - 1)] + [w * 0.5]
    tl = [0.0] * len(pts) + [(0.6 if (i // 2) % 2 else -0.6) if i % 2 == 0 else 0.0 for i in range(2 * lobes)]
    return dict(pts=ps, w=ws, tilt=tl, flat=0.75, segs=len(ps) - 1, sides=4, hug=0, blunt=0.6, exact=1, densify=27)


def box_braids():
    """Box braids (avatar v8, no reference sheet): chunky plaits from the crown, the sides and the back of the head
    lying on the head, then hanging past the shoulders, over a tight under-cap."""
    out = []
    rows = ((60, (-150, -105, 105, 150)), (36, (-170, -128, -88, 88, 128, 170)), (8, (-150, 150)))
    for k, (lat, lons) in enumerate(rows):
        for lon in lons:
            L = 0.2 + 0.03 * math.sin(lon * 0.7 + k)
            n = max(1, math.ceil((lat + 16) / 26))
            top_ = [root(lat, lon)] + [("s", lat - (lat + 16) * j / n, lon * (1 + 0.03 * j / n), 0.018 + 0.006 * (j / n) + 0.006 * k) for j in range(1, n + 1)]
            out.append(braid(top_, length=L, flare=0.004 * (2 - k), lobes=3 if k == 0 else 4))
    return out


def braids_front():
    """Box-braid front: flat plaits from the hairline back over the front crown, and a face-framing braid at each temple."""
    out = []
    for lon in (-44, -26, -9, 9, 26, 44):
        hl = hairline(lon)
        out.append(dict(pts=[root(hl - 1, lon), ("s", hl + 6, lon * 0.95, hair_outer(hl) - 0.008), ("s", (hl + 84) / 2, lon * 0.6, hair_outer((hl + 84) / 2) - 0.008),
                             ("s", 84, lon * 0.2, hair_outer(84) - 0.012)], w=[0.012, 0.014, 0.014, 0.008], tilt=[0, 0.5, -0.5, 0],
                        flat=0.7, segs=6, sides=4, hug=1, hug_from=0.06))
    for s_ in (1, -1):
        b = braid([root(40, s_ * 50), ("s", 22, s_ * 62, hair_outer(22) - 0.008), ("s", -8, s_ * 70, 0.016), ("s", -34, s_ * 73, 0.019),
                   ("s", -60, s_ * 76, 0.012)], lobes=2, length=0.07)
        b.update(hug=1, hug_from=0.06)
        out.append(b)
    return out


BANGS = {  # id: (name, nearest cell, seeds)
    "bangs_straight": ("Straight cut", "N4.2", straight8),
    "bangs_straight_long": ("Straight cut, long", "N3.3", lambda: [fringe(lon, 3 - 3 * (abs(lon) / 48) ** 2, w=0.033 * (1.22 if abs(lon) == 48 else 1.0), blunt=0.85)
                                                                  for lon in (-48, -32, -16, 0, 16, 32, 48)] + [side_lock(s, -22, 62) for s in (1, -1)]),
    "bangs_bowl": ("Rounded bowl", "N4.1", bowl),
    "bangs_wispy": ("See-through wispy", "N6.1", wispy),
    "bangs_swept_l": ("Side-swept left", "N2.2", lambda: swept(1)),
    "bangs_swept_r": ("Side-swept right", "N6.4", lambda: swept(-1)),
    "bangs_curtain": ("Curtain", "N3.2", curtain8),
    "bangs_curtain_long": ("Curtain, long", "N6.2", lambda: curtain(True)),
    "bangs_centre_split": ("Centre split", "N1.4", centre_split),
    "bangs_spiky": ("Spiky tufts", "B6.2", spiky8),
    "bangs_hime": ("Hime side-locks", "N6.3", hime),
    "bangs_choppy": ("Short choppy", "N1.5", choppy),
    "bangs_swept_back": ("Swept back", "N5.4", swept_back),
    "bangs_single_strand": ("Short with one long strand", "N5.3", single_strand),
    "bangs_wavy": ("Wavy swept", "N3.1", wavy),
    "bangs_asym_block": ("Asymmetric block", "N6.5", asym_block),
    # avatar v8 new types
    "bangs_curls": ("Curly fringe", None, curls_fringe),
    "bangs_braids": ("Braided front", None, braids_front),
}


BACKS = {  # id: (name, nearest cell, seeds, under-cap bottom(lon) or None, extras)
    "back_bob": ("Bob", "B2.1", bob8, lambda lon: -30),
    "back_wolf": ("Wolf cut", "B4.4", wolf, lambda lon: -28),
    "back_long": ("Long straight", "B3.1", long8, lambda lon: -36),
    "back_wavy_long": ("Wavy long", "B4.5", lambda: long_locks(0.3, wave=0.018, flare=0.012), lambda lon: -36),
    "back_high_pony": ("High ponytail", "B6.5", high_pony, lambda lon: -22),
    "back_pigtails": ("Low pigtails", "B3.2", pigtails, lambda lon: -26),
    "back_twin_buns": ("Twin buns", "B2.5", twin_buns, lambda lon: -30),
    "back_bun": ("Single top bun", "B1.1", single_bun, lambda lon: -34),
    "back_braid_crown": ("Braided crown", "B7.2", braid_crown, lambda lon: -34),
    "back_short_spiky": ("Short layered", "B6.2", short8, lambda lon: -8 if abs(lon) < 100 else -22),
    "back_undercut": ("Undercut", "B3.5", undercut, lambda lon: -8 - 32 * _ss(90, 130, abs(lon))),
    "back_bowl": ("Bowl", "B1.5", bowl_back, lambda lon: -8 if abs(lon) < 95 else -26),
    # avatar v8 new types
    "back_afro": ("Afro", None, afro, lambda lon: -22),
    "back_box_braids": ("Box braids", None, box_braids, lambda lon: -16),
}
# knots for the bun styles (closed blobs under the coiled locks): back id -> [(lat, lon, radius, height)]
KNOTS = {"back_twin_buns": [(56, 62, 0.05, 0.05), (56, -62, 0.05, 0.05)], "back_bun": [(66, 180, 0.07, 0.06)]}
for _bid, _knots in KNOTS.items():
    _fn = BACKS[_bid][2]
    BACKS[_bid] = BACKS[_bid][:2] + ((lambda f, ks: (lambda: f() + [lk for k in ks for lk in bun_coil(*k)]))(_fn, _knots),) + BACKS[_bid][3:]
# avatar v8: pieces rebuilt with the organic look (rounded clumps, soft normals, occlusion, the strand texture)
V8 = {"bangs_straight", "back_bob", "bangs_curtain", "back_long", "bangs_spiky", "back_short_spiky",
      "back_afro", "bangs_curls", "back_box_braids", "bangs_braids"}
# pulled-back styles sit closer to the head: their under-cap is lower still
TIGHT = {"back_high_pony", "back_pigtails", "back_twin_buns", "back_bun", "back_box_braids"}
# under-caps that are not cap_outer: the undercut's shaved sides (the floor) under its full top
OUTER = {"back_undercut": lambda lat: CAP_FLOOR + (cap_outer(lat) - CAP_FLOOR) * _ss(16, 30, lat)}
# avatar v8: under-caps shaped by longitude too (the afro's mass)
OUTER_LL = {"back_afro": lambda lat, lon: afro_outer(lat, lon) - 0.012}
# under-caps that stay one flat, darker value (the inner layer between curls or plaits), not strand-textured
FLAT_CAP = {"back_afro", "back_box_braids"}


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
                        w=[w * 0.7, w, w * 1.04, w * 0.9, w * 0.35], flat=0.4, segs=4, sides=6, blunt=cut * 0.5,
                        hug=1 if abs(lon0) < 80 else 0))     # avatar v8: rounded, tapering clumps like the library
    return out


# ================================================================ anchors (avatar v8 deliverable 3: hair accessories)
# Where a hair accessory sits on a piece, by name. A piece lacking a name hides the accessories that need it.
#   ("surf", lat, lon)                      on the piece's outer surface along the ray from the head centre
#   ("tie", lat, lon, off, (out, side, down), r)   a gathered tie (pony base, braid end): its centre, the direction the
#                                           gathered hair leaves it (a spine() move) and its radius
#   ("bun", lat, lon, r)                    the base of a bun knot (KNOTS), its axis through the knot
# Frames (v8/anchors.py): z faces out (the side the viewer sees), y runs along the hair toward its root, x = y cross z.
SIDE = ("surf", 16, 96)            # above the character's left ear
CROWN = ("surf", 50, 180)          # the back of the crown, where a half-up clip or tie sits
FRINGE = ("surf", None, 36)        # on the fringe, at the character's left (lat: a little under the hairline)
ANCHORS = {pid: {"side": [SIDE], "crown": [CROWN]} for pid in BACKS}
ANCHORS["back_high_pony"] = {"pony": [("tie", 52, 180, hair_outer(52) - 0.004, (0.05, 0, -0.02), 0.034)], "side": [SIDE]}
ANCHORS["back_pigtails"] = {"pony": [("tie", -8, s * 108, hair_outer(-8) - 0.004, (0.03, 0, 0.05), 0.03) for s in (1, -1)],
                            "crown": [CROWN]}
ANCHORS["back_bun"] = {"bun": [("bun", 66, 180, 0.07)], "side": [SIDE]}
ANCHORS["back_twin_buns"] = {"bun": [("bun", 56, s * 62, 0.05) for s in (1, -1)], "crown": [CROWN]}
ANCHORS["back_undercut"] = {"crown": [CROWN]}                 # the shaved sides have nothing to clip to
for _pid in BANGS:
    ANCHORS[_pid] = {"fringe": [FRINGE]}
