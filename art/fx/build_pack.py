"""Our own particle pack (specs/movement-feel.md, deliverable 1): hand-painted flipbooks in one atlas.

  python3 art/fx/build_pack.py

Writes
  web/public/assets/fx/move-pack.webp        the atlas: one row per sprite, 8 frames of 128 px, lossless
  web/lib/game/fx/pack.ts                    its layout for the engine (generated: edit the SPRITES list here)
  specs/evidence/movement-feel/pack-sheet.webp  every row tinted as the game tints it, on the grounds it is used over

Painted procedurally, no downloads and no references: each frame is brushwork in numpy. A puff is a few lobes of
paint (a metaball field) cut at a rising threshold through two kinds of noise, so it grows, thins and breaks up the way
a dry brush does; its value is painted in two soft bands from a light at the top left, with curved bristle streaks
following the lobes. Strokes (streaks, swirls, blades, scuffs) are dabs laid along a curve with pressure. The RGB is
near-neutral value (a warm light, a cool shade) because the engine tints every particle by the surface or the water
under it; alpha carries the shape. Every random choice is seeded, so a rebuild is byte-identical.
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
CELL, FRAMES = 128, 8
OUT_ATLAS = os.path.join(ROOT, "web", "public", "assets", "fx", "move-pack.webp")
OUT_TS = os.path.join(ROOT, "web", "lib", "game", "fx", "pack.ts")
OUT_SHEET = os.path.join(ROOT, "specs", "evidence", "movement-feel", "pack-sheet.webp")

# Light from the upper left and a little toward the viewer, as the world's sun reads from the follow camera.
LIGHT = np.array([-0.5, 0.62, 0.6]) / np.linalg.norm([-0.5, 0.62, 0.6])
WARM, COOL = np.array([1.0, 0.985, 0.95]), np.array([0.8, 0.82, 0.88])

# ---------------------------------------------------------------- noise and helpers
_perm_cache = {}


def _lattice(seed, n=97):
    if seed not in _perm_cache:
        _perm_cache[seed] = np.random.default_rng(seed).random((n, n))
    return _perm_cache[seed]


def vnoise(x, y, seed):
    """Smooth value noise in [0, 1] (bilinear over a seeded lattice with smoothstep weights, wrapping every 97)."""
    L = _lattice(seed)
    n = L.shape[0]
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    tx, ty = x - x0, y - y0
    sx, sy = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    x0, y0, x1, y1 = x0 % n, y0 % n, (x0 + 1) % n, (y0 + 1) % n
    a, b, c, d = L[y0, x0], L[y0, x1], L[y1, x0], L[y1, x1]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def fbm(x, y, seed, octaves=3, lac=2.0, gain=0.5):
    out, amp, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        out = out + amp * vnoise(x * lac ** o, y * lac ** o, seed + 17 * o)
        tot += amp
        amp *= gain
    return out / tot


def ss(a, b, x):
    d = b - a
    d = np.where(np.abs(d) < 1e-9, 1e-9, d)
    t = np.clip((x - a) / d, 0.0, 1.0)
    return t * t * (3 - 2 * t)


# Cell coordinates: u right, v up, both in [-1, 1] across the cell (pixel centres).
_g = (np.arange(CELL) + 0.5) / CELL * 2 - 1
U, V = np.meshgrid(_g, -_g)
PX = 2.0 / CELL                                         # one pixel in cell units


def shade_from(field, k=3.0):
    """Lambert-ish shade in [0, 1] of a height field seen from the front, lit from LIGHT."""
    gy, gx = np.gradient(field, PX)
    nx, ny, nz = -gx * k / 8, gy * k / 8, np.ones_like(field)   # rows run down the screen: flip the v gradient
    inv = 1 / np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.clip((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) * inv, 0, 1)


def paint_value(shade, bands=(0.42, 0.66), lo=0.74, hi=1.0):
    """Two soft painted bands: the shade side, then the lit side (a soft step, not a gradient)."""
    t = ss(bands[0], bands[1], shade)
    return lo + (hi - lo) * t


def colour(value, warmth=1.0):
    """Value to RGB with a warm light and a cool shade (both near neutral: the engine tints)."""
    t = np.clip((value - 0.6) / 0.4, 0, 1)[..., None]
    tint = COOL + (WARM - COOL) * t
    tint = 1 + (tint - 1) * warmth
    return np.clip(value[..., None] * tint, 0, 1)


def bristles(cx, cy, seed, rings=26.0, along=3.0):
    """Curved bristle streaks round a centre: noise stretched along the tangent (a brush that followed the lobe)."""
    ang = np.arctan2(V - cy, U - cx)
    rad = np.hypot(U - cx, V - cy)
    return vnoise((ang + math.pi) * along * 3, rad * rings, seed)


def stamp_layer():
    return np.zeros((CELL, CELL)), np.zeros((CELL, CELL, 3))


def over(alpha, rgb, a2, rgb2):
    """Paint a layer over another (straight alpha)."""
    out_a = a2 + alpha * (1 - a2)
    w = np.where(out_a > 1e-6, a2 / np.maximum(out_a, 1e-6), 0)[..., None]
    return out_a, rgb * (1 - w) + rgb2 * w


# ---------------------------------------------------------------- puffs (dust, low dust, snow)
def puff(t, seed, lobes, spread=(0.3, 0.2), base_r=0.24, grow=0.55, drift=0.6, rise=0.14, flat=None, squash=1.0,
         lo=0.8, hi=1.0, warmth=1.0, specks=0, centre=(0.0, -0.08)):
    """A cloud of paint: round lobes, each lit like a ball from the upper left, that pop out, drift apart and grow; past
    the middle of its life the brush runs dry through it, the thin edges first, until only wisps are left."""
    rng = np.random.default_rng(seed)
    H = np.full((CELL, CELL), -1.0)                      # height of the winning lobe (0 at its rim, 1 at its crown)
    H2 = np.full((CELL, CELL), -1.0)                     # the runner-up, for the creases where lobes meet
    NX, NY, NZ = np.zeros_like(U), np.zeros_like(U), np.ones_like(U)
    SD = np.full((CELL, CELL), 9.0)                      # distance outside the union of lobes (negative inside)
    pop = 1 - (1 - min(1.0, t / 0.22)) ** 2              # the first frames pop the puff open
    centres = []
    for i in range(lobes):
        a = rng.uniform(0, math.tau) if i else 0.0
        d = rng.uniform(0.35, 1.0) if i else 0.0
        ox, oy = math.cos(a) * spread[0] * d, math.sin(a) * spread[1] * d
        r = base_r * (rng.uniform(0.7, 1.05) if i else 1.15) * (0.55 + 0.45 * pop) * (1 + grow * t)
        cx = centre[0] + ox * (1 + drift * t)
        cy = centre[1] + oy * (1 + drift * t) + rise * t * rng.uniform(0.6, 1.2)
        if flat is not None:
            cy = flat + r * 0.62 * squash + abs(oy) * 0.4
        centres.append((cx, cy, r))
        du, dv = (U - cx) / r, (V - cy) / (r * squash)
        q = du * du + dv * dv
        # Just past the rim (the soft edge) still belongs to this lobe, facing out: no bright fringe round the puff.
        h = np.where(q < 1.15, np.sqrt(np.clip(1 - q, 0, 1)) + 1e-3 * (1.15 - q), -1.0)
        win = h > H
        H2 = np.where(win, H, np.maximum(H2, h))
        H = np.where(win, h, H)
        NX, NY, NZ = np.where(win, du, NX), np.where(win, dv, NY), np.where(win, h, NZ)
        SD = np.minimum(SD, (np.sqrt(q) - 1) * r)
    if flat is not None:
        SD = np.maximum(SD, flat - V)                      # the ground cuts it flat
    # Edge: soft, broken a little by the brush; the brush runs dry from t = 0.35, edges first.
    wob = (fbm(U * 4 + seed, V * 4, seed + 3, 3) - 0.5) * (0.05 + 0.08 * t)
    alpha = ss(PX * 1.6, -PX * 1.6, SD + wob)
    dry = ss(0.3, 1.0, t)
    holes = fbm(U * 5.5 + seed * 0.1, V * 5.5, seed + 7, 3) * 0.75 + 0.25 * fbm(U * 13, V * 13, seed + 9, 2)
    keep = np.clip(H, 0, 1) * 0.55 + holes
    alpha *= ss(dry * 1.05 - 0.06, dry * 1.05 + 0.06, keep)
    # Value: two soft bands from the light, each lobe lit as a ball; creases where lobes meet sit a touch deeper.
    inv = 1 / np.sqrt(NX * NX + NY * NY + NZ * NZ + 1e-9)
    shade = np.clip((NX * LIGHT[0] + NY * LIGHT[1] + NZ * LIGHT[2]) * inv, 0, 1)
    value = paint_value(shade, bands=(0.38, 0.62), lo=lo, hi=hi)
    crease = ss(0.22, 0.0, H - H2) * (H2 > 0)
    value -= crease * 0.05
    br = np.zeros_like(U)
    for cx, cy, r in centres:
        w = np.exp(-((U - cx) ** 2 + (V - cy) ** 2) / (2 * r * r))
        br += w * (bristles(cx, cy, seed + 11, rings=30) - 0.5)
    value += br * 0.06
    rgb = colour(value, warmth)
    if specks:
        a2, rgb2 = flakes(t, seed + 99, specks, centres)
        alpha, rgb = over(alpha, rgb, a2, rgb2)
    return alpha, rgb


def flakes(t, seed, n, centres):
    """Small bright flakes thrown from the puff (snow)."""
    rng = np.random.default_rng(seed)
    A, C = stamp_layer()
    for i in range(n):
        cx, cy, r = centres[i % len(centres)]
        a = rng.uniform(0, math.tau)
        d = r * rng.uniform(0.9, 1.6) * (1 + 0.8 * t)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d - 0.15 * t * t
        s = rng.uniform(0.022, 0.04) * (1 - 0.5 * t)
        m = ss(s, s * 0.4, np.hypot(U - x, V - y)) * (1 - ss(0.6, 1.0, t)) * rng.uniform(0.7, 1)
        A = np.maximum(A, m)
        C[...] = np.where(m[..., None] > 0.01, np.array([1.0, 1.0, 1.0]), C)
    return A, C


def dust(t):
    return puff(t, 101, lobes=5, spread=(0.3, 0.2), base_r=0.29, lo=0.84)


def dust_low(t):
    return puff(t, 202, lobes=5, spread=(0.5, 0.08), base_r=0.26, grow=0.3, drift=0.7, flat=-0.6, squash=0.82, lo=0.84)


def snow(t):
    return puff(t, 303, lobes=6, base_r=0.24, lo=0.86, hi=1.0, warmth=0.35, specks=12)


# ---------------------------------------------------------------- grains (sand kick)
def grain(A, C, x, y, r, value, alpha=1.0):
    """A round grain with a lit cap."""
    d = np.hypot(U - x, V - y)
    m = ss(r, r - PX * 1.4, d) * alpha
    lit = ss(r * 0.9, 0, np.hypot(U - (x - r * 0.35), V - (y + r * 0.35)))
    v = value * (0.86 + 0.14 * lit)
    rgb = colour(np.full_like(d, 1.0) * v, 0.3)
    return over(A, C, m, rgb)


def sand_kick(t):
    rng = np.random.default_rng(404)
    A, C = puff(t, 405, lobes=4, spread=(0.22, 0.1), base_r=0.17, grow=0.6, rise=0.05, centre=(0, -0.3))
    A = A * 0.45                                          # sand barely smokes
    for i in range(30):
        a = rng.uniform(0.2, math.pi - 0.2)               # thrown up and out
        sp = rng.uniform(0.3, 1.0)
        x = math.cos(a) * sp * (0.25 + 0.7 * t)
        y = -0.3 + math.sin(a) * sp * (0.3 + 0.85 * t) - 1.0 * t * t
        r = rng.uniform(0.03, 0.062) * (1 - 0.3 * t)
        fade = 1 - ss(0.72, 1.05, t + rng.uniform(-0.12, 0.12))
        A, C = grain(A, C, x, y, r, rng.uniform(0.84, 1.0), fade)
    return A, C


# ---------------------------------------------------------------- strokes
def stroke(points, widths, seed, value=1.0, shade_side=0.0, dry=0.35, alpha=1.0, taper_soft=1.6, grain=0.1):
    """A brush stroke through `points` (cell units) with a width per point: dabs along the curve, bristle-streaked,
    the dry end (where it starts) breaking up. Returns (alpha, value) layers."""
    P = np.array(points, float)
    W = np.array(widths, float)
    # Resample densely.
    seg = np.hypot(*np.diff(P, axis=0).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    total = s[-1] if s[-1] > 0 else 1
    n = max(8, int(total / (PX * 0.7)))
    ss_ = np.linspace(0, total, n)
    xs, ys, ws = np.interp(ss_, s, P[:, 0]), np.interp(ss_, s, P[:, 1]), np.interp(ss_, s, W)
    A = np.zeros((CELL, CELL))
    along = np.zeros((CELL, CELL))
    side = np.zeros((CELL, CELL))
    for i in range(n):
        if ws[i] <= 0:
            continue
        d = np.hypot(U - xs[i], V - ys[i])
        m = ss(ws[i], ws[i] - PX * taper_soft, d)
        upd = m > A
        A = np.maximum(A, m)
        along[upd] = ss_[i] / total
        if i + 1 < n:
            tx, ty = xs[min(n - 1, i + 1)] - xs[i], ys[min(n - 1, i + 1)] - ys[i]
        tl = math.hypot(tx, ty) or 1
        nx, ny = -ty / tl, tx / tl
        side[upd] = (((U - xs[i]) * nx + (V - ys[i]) * ny) / max(ws[i], 1e-3))[upd]
    # Bristles run along the stroke: noise in (along, across).
    br = vnoise(along * 18 + seed, side * 7 + 40, seed)
    thirst = dry * (0.2 + 0.8 * (1 - along))
    A = A * ss(thirst - 0.05, thirst + 0.12, br + 0.25) * alpha
    val = value * (1 - grain + grain * (br - 0.5) * 2 + grain) - shade_side * ss(-0.2, 1.0, side) * 0.18
    return np.clip(A, 0, 1), val


def speed_streak(t):
    """A soft tapered streak: the head round and brightest, the tail thinning into dry brush; it draws on, then thins
    away. The engine stretches it along the motion."""
    head = 0.9 - 0.12 * ss(0.5, 1, t)
    tail = head - (0.5 + 1.25 * ss(0, 0.35, t)) * (1 - 0.3 * ss(0.55, 1, t))
    k = np.linspace(0, 1, 40)
    xs = tail + (head - tail) * k
    ys = 0.03 * np.sin(k * 2.5) * (1 - t)
    thick = 0.26 * (1 - 0.5 * ss(0.45, 1.0, t))
    ws = thick * np.where(k < 0.82, (k / 0.82) ** 1.15, np.sqrt(np.clip(1 - ((k - 0.82) / 0.2) ** 2 * 0.75, 0, 1)))
    A, val = stroke(list(zip(xs, ys)), ws, 505, value=1.0, dry=0.12 + 0.45 * t, taper_soft=4.0)
    A *= 1 - ss(0.75, 1.0, t) * 0.75
    return A, colour(np.clip(val, 0, 1), 0.6)


def wind_swirl(t):
    """A curl of wind: a crescent that winds into a small spiral; drawn on, then eaten from the tail."""
    k = np.linspace(0, 1, 60)
    ang = math.pi * 0.95 - k * math.pi * 2.25
    rad = 0.62 - 0.4 * k ** 1.3
    xs, ys = np.cos(ang) * rad - 0.05, np.sin(ang) * rad * 0.8 + 0.02
    head = ss(0, 0.45, t)                              # how much is drawn
    tail = ss(0.45, 1.0, t)                            # how much has blown away
    ws = 0.085 * np.sin(np.pi * np.clip(k, 0.02, 0.98)) ** 0.6 * (1 - 0.3 * k)
    ws = np.where((k <= head + 1e-6) & (k >= tail * 0.95), ws, 0)
    A, val = stroke(list(zip(xs, ys)), ws, 606, value=1.0, dry=0.25 + 0.4 * t, taper_soft=2.2)
    # A shorter second curl outside it, offset in time.
    t2 = np.clip(t * 1.15 - 0.1, 0, 1)
    k2 = np.linspace(0, 1, 40)
    ang2 = math.pi * 0.6 - k2 * math.pi * 1.1
    xs2, ys2 = np.cos(ang2) * 0.8 - 0.05, np.sin(ang2) * 0.62 + 0.02
    ws2 = 0.05 * np.sin(np.pi * np.clip(k2, 0.02, 0.98))
    ws2 = np.where((k2 <= ss(0, 0.5, t2) + 1e-6) & (k2 >= ss(0.5, 1, t2)), ws2, 0)
    A2, val2 = stroke(list(zip(xs2, ys2)), ws2, 607, value=0.95, dry=0.35 + 0.4 * t)
    A = np.maximum(A, A2 * 0.8)
    val = np.where(A2 > A * 0.99, val2, val)
    return A * (1 - ss(0.85, 1, t)), colour(np.clip(val, 0, 1), 0.4)


def blade(A, C, x, y, ang, length, width, value, flip):
    """One clipped grass blade: a tapered, slightly curved stroke with a lit edge."""
    ca, sa = math.cos(ang), math.sin(ang)
    pts, ws = [], []
    for k in np.linspace(0, 1, 9):
        bend = 0.18 * length * k * k * flip
        px, py = (k - 0.5) * length, bend
        pts.append((x + px * ca - py * sa, y + px * sa + py * ca))
        ws.append(width * (1 - k) ** 0.7 + PX * 0.6)
    a, val = stroke(pts, ws, 707 + int(abs(x) * 1000), value=value, shade_side=0.45, dry=0.05)
    rgb = colour(np.clip(val, 0, 1), 0.5)
    return over(A, C, a, rgb)


def grass_flecks(t):
    """Three clippings tumbling: each frame turns them and foreshortens them as they flip."""
    rng = np.random.default_rng(808)
    A, C = stamp_layer()
    for i in range(4):
        x0, y0 = rng.uniform(-0.45, 0.45), rng.uniform(-0.35, 0.35)
        spin = rng.uniform(1.2, 2.2) * (1 if i % 2 else -1)
        ang = rng.uniform(0, math.tau) + spin * t * math.pi
        flipc = math.cos(t * math.pi * rng.uniform(1.5, 2.5) + i)
        length = rng.uniform(0.42, 0.6) * (0.55 + 0.45 * abs(flipc))
        x0, y0 = x0 * (1 + 0.35 * t), y0 * (1 + 0.35 * t)
        A, C = blade(A, C, x0, y0, ang, length, rng.uniform(0.06, 0.085), rng.uniform(0.9, 1.0) * (0.9 + 0.1 * abs(flipc)), 1 if flipc > 0 else -1)
    return A * (1 - ss(0.8, 1, t)), C


def leaf(t):
    """One small leaf tumbling end over end: foreshortened as it turns, its paler back showing as it flips."""
    turn = math.cos(t * math.tau)                      # face-on 1, edge-on 0, back -1
    roll = t * math.tau * 0.5
    L, Wd = 0.62, 0.32 * max(0.14, abs(turn))
    ca, sa = math.cos(roll + 0.6), math.sin(roll + 0.6)
    x, y = U * ca + V * sa, -U * sa + V * ca
    xn = x / L
    half = Wd * np.clip(1 - xn * xn, 0, 1) ** 0.75 * (1 + 0.25 * xn)    # almond, fuller toward the stem end
    inside = ss(half, half - PX * 1.5, np.abs(y)) * (np.abs(xn) < 1)
    stem = ss(PX * 1.6, 0, np.abs(y)) * ((xn < -0.95) & (xn > -1.25)) * 0.9
    A = np.maximum(inside, stem)
    side = np.clip(y / np.maximum(half, 1e-3), -1, 1)
    front = turn > 0
    v = (0.9 if front else 1.0) - 0.12 * (side > 0) * (1 if front else 0.5)
    v = v + 0.06 * (vnoise(x * 14 + 3, y * 30, 909) - 0.5)
    rib = ss(PX * 1.4, 0, np.abs(y)) * (np.abs(xn) < 0.9)
    v = v - rib * 0.12 * (1 if front else 0.4)
    return A, colour(np.clip(v, 0, 1), 0.5)


def scuff(t):
    """A skid scuff on the ground: a few overlapping dragged strokes, darker than the ground they tint, fading out."""
    rng = np.random.default_rng(1111)
    A = np.zeros((CELL, CELL))
    val = np.ones((CELL, CELL))
    for i in range(4):
        y = rng.uniform(-0.28, 0.28)
        x0, x1 = rng.uniform(-0.85, -0.55), rng.uniform(0.45, 0.85)
        xs = np.linspace(x0, x1, 12)
        ys = y + 0.05 * np.sin(xs * 3 + i)
        ws = 0.11 * rng.uniform(0.6, 1.0) * np.sin(np.pi * np.linspace(0.08, 0.92, 12)) ** 0.5
        a, v = stroke(list(zip(xs, ys)), ws, 1112 + i, value=rng.uniform(0.55, 0.68), dry=0.45 + 0.4 * t)
        upd = a > A
        A = np.maximum(A, a * rng.uniform(0.7, 1.0))
        val = np.where(upd, v, val)
    A *= 1 - ss(0.25, 1.0, t) * 0.85
    return A, colour(np.clip(val, 0, 1), 0.3)


def droplets(t):
    """Water drops thrown from a splash: round with a bright cap and a deeper rim, stretched while fast."""
    rng = np.random.default_rng(1212)
    A, C = stamp_layer()
    for i in range(5):
        a = rng.uniform(0.35, math.pi - 0.35)
        sp = rng.uniform(0.5, 1.0)
        vx, vy = math.cos(a) * sp, math.sin(a) * sp
        x = vx * (0.12 + 0.6 * t)
        y = -0.25 + vy * (0.15 + 0.85 * t) - 0.95 * t * t
        r = rng.uniform(0.075, 0.12) * (1 - 0.35 * t)
        speed = math.hypot(vx, vy - 1.9 * t)
        stretch = 1 + 0.9 * speed * (1 - t)
        dirx, diry = vx / max(speed, 1e-3), (vy - 1.9 * t) / max(speed, 1e-3)
        du, dv = U - x, V - y
        pa = du * dirx + dv * diry
        pp = -du * diry + dv * dirx
        d = np.hypot(pa / stretch, pp)
        m = ss(r, r - PX * 1.3, d) * (1 - ss(0.75, 1.0, t + rng.uniform(-0.08, 0.08)))
        hi = ss(r * 0.45, 0, np.hypot(U - (x - r * 0.3), V - (y + r * 0.35)))
        rim = ss(r * 0.55, r, d)
        v = 0.78 - 0.16 * rim + 0.3 * hi
        A, C = over(A, C, m, colour(np.clip(v, 0, 1.0) + 0 * U, 0.2))
    return A, C


def ripple(t):
    """A ring on the water, drawn as water: a soft bright crest that catches the light on the sun's side, a deeper
    trough just inside it, a second ring following; it widens, thins and settles."""
    A = np.zeros((CELL, CELL))
    val = np.ones((CELL, CELL))
    r = np.hypot(U, V)
    ang = np.arctan2(V, U)
    sun = np.clip(0.5 + 0.5 * (np.cos(ang) * LIGHT[0] + np.sin(ang) * LIGHT[1]) / math.hypot(LIGHT[0], LIGHT[1]), 0, 1)
    for k, (r0, r1, w0, strength, delay) in enumerate([(0.26, 0.88, 0.075, 1.0, 0.0), (0.12, 0.58, 0.055, 0.6, 0.18)]):
        tt = np.clip((t - delay) / (1 - delay), 0, 1)
        if tt <= 0 and k:
            continue
        R = r0 + (r1 - r0) * (1 - (1 - tt) ** 1.7)
        w = w0 * (1 - 0.45 * tt)
        wob = (fbm(ang * 2 + 10 + k * 3, np.full_like(ang, 3.0 + k), 1313, 2) - 0.5) * 0.05
        d = r - R - wob
        crest = np.exp(-(d / w) ** 2 * 1.6)
        trough = np.exp(-((d + w * 1.5) / (w * 1.2)) ** 2 * 1.6)
        thin = 0.6 + 0.4 * ss(0.3, 0.62, fbm(ang * 3 + k * 7, np.full_like(ang, k * 5.0), 1314, 2))
        life = (1 - ss(0.5, 1.0, tt)) * ss(-0.15, 0.12, tt)
        a = np.maximum(crest * thin * (0.55 + 0.45 * sun), trough * 0.35) * strength * life
        v = np.where(crest > trough, 0.86 + 0.14 * sun, 0.66)
        upd = a > A
        A = np.maximum(A, a)
        val = np.where(upd, v, val)
    return A, colour(np.clip(val, 0, 1), 0.2)


def footprint(t):
    """A footprint pressed into snow (or wet sand), seen from above, toes up the cell: a rounded sole and a heel as
    shallow dents, darker in their floors, with a bright lip of packed snow on the side away from the light. Each of
    the 8 frames is a slightly different print (the engine picks one per step and mirrors it for the other foot)."""
    rng = np.random.default_rng(1515 + int(round(t * FRAMES)))
    A = np.zeros((CELL, CELL))
    val = np.ones((CELL, CELL))
    lean = rng.uniform(-0.06, 0.06)
    for cx, cy, rx, ry in [(0.04 + lean, 0.2, 0.3, 0.46), (-0.02 + lean * 0.4, -0.52, 0.22, 0.26)]:
        cx += rng.uniform(-0.02, 0.02)
        cy += rng.uniform(-0.03, 0.03)
        wob = (fbm(U * 4 + cx * 9, V * 4 + cy * 9, 1516 + int(t * 99), 2) - 0.5) * 0.18
        d = np.hypot((U - cx) / rx, (V - cy) / ry) + wob
        floor = ss(1.0, 0.82, d)
        # The dent's walls: the side facing the light is in shade, the far side catches it; a packed lip just outside.
        gx, gy = (U - cx) / rx, (V - cy) / ry
        facing = np.clip(-(gx * LIGHT[0] + gy * LIGHT[1]) / np.maximum(np.hypot(gx, gy), 1e-3), -1, 1)
        wall = ss(0.62, 0.95, d) * ss(1.05, 0.92, d)
        lip = ss(0.98, 1.06, d) * ss(1.22, 1.08, d)
        a = np.maximum(floor * 0.8, lip * 0.55)
        v = np.where(lip > floor, 0.98, 0.64 + 0.18 * wall * (0.5 + 0.5 * facing))
        upd = a > A
        A = np.maximum(A, a)
        val = np.where(upd, v, val)
    return A, colour(np.clip(val, 0, 1), 0.25)


def sparkle(t):
    """A tiny twinkle: a soft core and four tapered rays, popping open and closing with a little turn."""
    s = math.sin(math.pi * min(1.0, t * 1.15)) ** 0.8
    rot = 0.25 * t
    ca, sa = math.cos(rot), math.sin(rot)
    x, y = U * ca + V * sa, -U * sa + V * ca
    core = ss(0.16 * s + 0.02, 0.0, np.hypot(x, y))
    rays = np.zeros_like(U)
    for (ax, ay, L) in [(1, 0, 0.82), (0, 1, 0.82), (0.707, 0.707, 0.38), (0.707, -0.707, 0.38)]:
        along = np.abs(x * ax + y * ay)
        across = np.abs(-x * ay + y * ax)
        width = 0.075 * s * np.clip(1 - along / max(L * s, 1e-3), 0, 1) ** 1.4
        rays = np.maximum(rays, ss(width, width * 0.2, across) * (along < L * s))
    A = np.maximum(core, rays) * (1 - ss(0.85, 1, t))
    v = np.where(core > 0.5, 1.0, 0.97)
    return A, colour(v + 0 * U, 0.6)


def marker(t):
    """A target marker painted on the ground: a dry-brushed ring with three notches pointing in; it breathes."""
    pulse = 1 + 0.04 * math.sin(t * math.tau)
    ang = np.linspace(0, math.tau, 90)
    R = 0.74 * pulse
    pts = list(zip(np.cos(ang) * R, np.sin(ang) * R))
    wob = 1 + 0.25 * np.sin(ang * 3 + 0.4) * np.sin(ang * 5)
    A, val = stroke(pts, 0.065 * wob, 1515, value=1.0, dry=0.06, taper_soft=2.0, grain=0.04)
    for k in range(3):
        a = math.pi / 2 + k * math.tau / 3
        ca, sa = math.cos(a), math.sin(a)
        rad, tan = U * ca + V * sa, -U * sa + V * ca           # along the radius, across it
        base, tip = R + 0.17, R - 0.05
        f = np.clip((rad - tip) / (base - tip), 0, 1)
        half = 0.11 * f
        a2 = ss(half, half - PX * 1.5, np.abs(tan)) * (rad > tip) * (rad < base) * ss(base, base - PX * 2, rad)
        upd = a2 > A
        A = np.maximum(A, a2)
        val = np.where(upd, 0.97 - 0.1 * (tan > 0), val)
    return A, colour(np.clip(val, 0, 1), 0.5)


def sand_print(t):
    """A shoe pressed into sand, seen from above, the toe along +u: a toe pad and a heel joined by a narrow waist,
    its floor darker than the ground with faint tread lines across it, a crumbly lip of pushed-up ground round it. Over
    its life the edge crumbles in, the floor fills and the tread goes, until it is a soft dent."""
    toe = ((U - 0.34) / 0.36) ** 2 + (V / 0.27) ** 2
    heel = ((U + 0.44) / 0.25) ** 2 + (V / 0.205) ** 2
    waist = ((U + 0.04) / 0.52) ** 2 + (V / 0.16) ** 2
    field = np.minimum(np.minimum(toe, heel), waist)
    n = fbm(U * 7 + 3, V * 7 + 5, 1616)
    crumble = (n - 0.5) * (0.18 + 0.7 * t)
    inside = ss(1.0, 0.84, field + crumble)
    lip = np.clip(ss(1.55, 1.08, field + crumble * 1.4) - inside, 0, 1) * (0.55 + 0.45 * vnoise(U * 14, V * 14, 1617))
    tread = (0.5 + 0.5 * np.sin(U * 40)) ** 3 * ss(-0.04, 0.04, np.abs(U + 0.05) - 0.15)   # bars across the toe and heel, not the waist
    floor = 0.58 + 0.16 * tread * (1 - ss(0.1, 0.55, t)) + 0.28 * ss(0.2, 1.0, t) + 0.05 * (n - 0.5)
    A = inside * (0.9 - 0.42 * t) + lip * 0.5 * (1 - ss(0.3, 1.0, t))
    val = np.where(inside > lip, floor, 1.04)
    return np.clip(A, 0, 1), colour(np.clip(val, 0, 1.05), 0.3)


# ---------------------------------------------------------------- the pack
# name, painter, what it is (one row each, FRAMES frames). Append only: rows are indices in the engine.
SPRITES = [
    ("dust", dust, "dust puff"),
    ("dustLow", dust_low, "low dust burst (hugs the ground)"),
    ("sand", sand_kick, "sand kick"),
    ("grass", grass_flecks, "grass flecks"),
    ("droplets", droplets, "water droplets"),
    ("ripple", ripple, "water ripple (lies on the water)"),
    ("snow", snow, "snow puff"),
    ("leaf", leaf, "leaf bit (tumbling)"),
    ("streak", speed_streak, "soft tapered speed streak"),
    ("swirl", wind_swirl, "wind swirl"),
    ("scuff", scuff, "skid scuff (lies on the ground)"),
    ("sparkle", sparkle, "tiny sparkle"),
    ("marker", marker, "ground marker (target)"),
    ("footprint", footprint, "footprint in snow (lies on the ground)"),
    ("sandPrint", sand_print, "shoe print in sand (lies on the ground)"),
]

# How the sheet shows each row: the tint the engine gives it and the ground behind it.
SHEET = {
    "dust": ("#e6d7b8", "#8fa16c"), "dustLow": ("#e6d7b8", "#8fa16c"), "sand": ("#efdcaa", "#e2cb93"),
    "grass": ("#c8d98f", "#8fa16c"), "droplets": ("#d4ecf7", "#568cb2"), "ripple": ("#e4f4fb", "#568cb2"),
    "snow": ("#f4f8fc", "#b8c4d0"), "leaf": ("#c98a4b", "#8fa16c"), "streak": ("#ffffff", "#8fa16c"),
    "swirl": ("#f6fbff", "#8fa16c"), "scuff": ("#ba9664", "#ba9664"), "sparkle": ("#fff6dc", "#5f7a55"),
    "marker": ("#fff4c8", "#8c8577"),
    "footprint": ("#c9d6e6", "#eef3f8"),
    "sandPrint": ("#c9ad78", "#e2cb93"),
}


def frame(fn, i):
    t = i / FRAMES                                       # the last frame is nearly gone; the engine fades the rest
    a, rgb = fn(t)
    return np.clip(a, 0, 1), np.clip(rgb, 0, 1)


def build():
    rows = len(SPRITES)
    atlas = np.zeros((rows * CELL, FRAMES * CELL, 4))
    for r, (name, fn, _) in enumerate(SPRITES):
        for i in range(FRAMES):
            a, rgb = frame(fn, i)
            # Keep a 2 px clear border so mips never bleed a neighbour in.
            a[:2, :] = a[-2:, :] = 0
            a[:, :2] = a[:, -2:] = 0
            if a.max() < 0.05:
                raise SystemExit(f"empty frame: {name} {i}")
            atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL, :3] = rgb
            atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL, 3] = a
        print(f"  {name:9s} row {r}")
    img = Image.fromarray((atlas * 255 + 0.5).astype(np.uint8), "RGBA")
    os.makedirs(os.path.dirname(OUT_ATLAS), exist_ok=True)
    img.save(OUT_ATLAS, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print("wrote", OUT_ATLAS, os.path.getsize(OUT_ATLAS) // 1024, "KB")
    write_layout()
    write_sheet(atlas)


def write_layout():
    names = ",\n".join(f'  {n}: {{ row: {r}, frames: {FRAMES} }} /* {d} */' for r, (n, _, d) in enumerate(SPRITES))
    ts = f'''// Generated by art/fx/build_pack.py: do not edit (change the SPRITES list there and rebuild).
/** Our particle pack (specs/movement-feel.md deliverable 1): one row of {FRAMES} frames per sprite, {CELL} px cells. */
export const PACK_URL = "/assets/fx/move-pack.webp";
export const PACK_COLS = {FRAMES};
export const PACK_ROWS = {len(SPRITES)};
export const PACK = {{
{names},
}} as const;
export type SpriteName = keyof typeof PACK;
'''
    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    open(OUT_TS, "w").write(ts)
    print("wrote", OUT_TS)


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def write_sheet(atlas):
    """Each row tinted as the engine tints it, over the ground it is used on, at 1x, with its name."""
    label_w, pad = 190, 6
    W = label_w + FRAMES * (CELL + pad) + pad
    H = len(SPRITES) * (CELL + pad) + pad + 30
    sheet = Image.new("RGB", (W, H), (11, 14, 20))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 13)
        small = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 11)
    except OSError:
        font = small = ImageFont.load_default()
    draw.text((pad, 8), "Movement particle pack: painted by art/fx/build_pack.py, 8 frames per row, tinted as in game", fill=(241, 255, 255), font=font)
    for r, (name, _, desc) in enumerate(SPRITES):
        tint, ground = (hexrgb(c) for c in SHEET[name])
        y = 30 + pad + r * (CELL + pad)
        draw.text((pad, y + 40), name, fill=(255, 209, 102), font=font)
        draw.text((pad, y + 60), desc[:26], fill=(201, 209, 214), font=small)
        if len(desc) > 26:
            draw.text((pad, y + 74), desc[26:52], fill=(201, 209, 214), font=small)
        for i in range(FRAMES):
            cell = atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL]
            a = cell[..., 3:4]
            rgb = cell[..., :3] * tint
            bg = np.ones_like(rgb) * ground
            out = bg * (1 - a) + rgb * a
            sheet.paste(Image.fromarray((out * 255 + 0.5).astype(np.uint8)), (label_w + pad + i * (CELL + pad), y))
    os.makedirs(os.path.dirname(OUT_SHEET), exist_ok=True)
    sheet.save(OUT_SHEET, "WEBP", quality=88, method=6)
    print("wrote", OUT_SHEET)


if __name__ == "__main__":
    build()
