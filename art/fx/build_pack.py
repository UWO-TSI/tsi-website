"""Our own particle pack (specs/movement-feel.md, deliverable 1): hand-painted flipbooks in one atlas.

  python3 art/fx/build_pack.py

Writes
  web/public/assets/fx/move-pack.webp        the atlas: one row per sprite, 8 frames of 128 px, lossless
  web/lib/game/fx/pack.ts                    its layout for the engine (generated: edit the SPRITES list here)
  specs/evidence/movement-feel/pack-sheet.webp  every row tinted as the game tints it, on the grounds it is used over
  web/public/assets/fx/combat-pack.webp      the combat pack (specs/classes/design-sheet.md §1.7): heat in RGB, coverage in A
  web/lib/game/fx/combatPack.ts              its layout (generated: edit the COMBAT_SPRITES list here)
  specs/evidence/classes/K0-combat-atlas.webp   every combat row through three sample ramps, as the engine maps heat

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


# ================================================================ the combat pack (specs/classes/design-sheet.md §1.7)
# Anime-style flipbooks: hard-edged cel shapes in two or three tone bands, bold silhouettes that read through the pixel
# filter. Each frame stores HEAT in RGB (1 the white-hot core, about 0.55 the coloured mid band, about 0.15 the darker
# edge; smoke, ink and cracks sit low) and coverage in A. The engine maps heat through the effect's 3-stop ramp
# [core, mid, edge], so one atlas serves every colour.
OUT_COMBAT = os.path.join(ROOT, "web", "public", "assets", "fx", "combat-pack.webp")
OUT_COMBAT_TS = os.path.join(ROOT, "web", "lib", "game", "fx", "combatPack.ts")
OUT_COMBAT_SHEET = os.path.join(ROOT, "specs", "evidence", "classes", "K0-combat-atlas.webp")

RAD, ANG = np.hypot(U, V), np.arctan2(V, U)
LO, MID, HI = 0.15, 0.55, 1.0


def hard(d, soft=1.1):
    """Coverage of the region d < 0 with a hard edge (a pixel or so of soft, no airbrush)."""
    return ss(PX * soft, -PX * soft, d)


def cel(f, t1=0.33, t2=0.7, soft=0.02, lo=LO, mid=MID, hi=HI):
    """A field in [0, 1] (0 at the shape's edge) cut into three flat tone bands: edge, mid, core."""
    return lo + (mid - lo) * ss(t1 - soft, t1 + soft, f) + (hi - mid) * ss(t2 - soft, t2 + soft, f)


def seg(ax, ay, bx, by, x=None, y=None):
    """Distance to the segment a-b and the parameter of the closest point (0 at a, 1 at b)."""
    x = U if x is None else x
    y = V if y is None else y
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy or 1e-9
    k = np.clip(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1)
    return np.hypot(x - ax - dx * k, y - ay - dy * k), k


def lay(A, H, a, h):
    """Paint a shape over the layer: the higher coverage wins its heat."""
    upd = a > A
    return np.maximum(A, a), np.where(upd, h, H)


def periodic_noise(ang, k, seed, octaves=2):
    """Noise round a circle (no seam at ±π)."""
    return fbm(np.cos(ang) * k + 7.3, np.sin(ang) * k + 3.1, seed, octaves)


def impact_star(t):
    """A spiky anime impact star: it pops open, the hot centre cools, then it hollows out and only the long spikes are left."""
    rng = np.random.default_rng(2101)
    n = 10
    tips = rng.uniform(0.82, 1.0, n) * np.where(np.arange(n) % 2 == 0, 1.0, 0.6)
    off = rng.uniform(-0.13, 0.13, n)
    pop = 1 - (1 - min(1.0, t / 0.25)) ** 2
    R = 0.36 + 0.52 * pop + 0.05 * t
    a = np.concatenate([2 * math.pi * np.arange(n) / n + off, 2 * math.pi * (np.arange(n) + 0.5) / n])
    r = np.concatenate([tips * R, np.full(n, R * (0.34 + 0.08 * pop))])
    o = np.argsort(a)
    rb = np.interp(np.mod(ANG, 2 * math.pi), a[o] % (2 * math.pi), r[o], period=2 * math.pi)
    rb = rb * (1 - 0.22 * ss(0.5, 1.0, t) * periodic_noise(ANG, 2.5, 2102))
    hole = R * 0.86 * ss(0.38, 1.1, t)
    alpha = hard(RAD - rb) * ss(hole - PX, hole + PX, RAD)
    f = np.clip((rb - RAD) / np.maximum(rb - hole, 1e-3), 0, 1)
    heat = cel(f, t1=0.16 + 0.14 * t, t2=0.42 + 0.3 * ss(0.15, 0.7, t))
    return alpha, heat


def slash(t):
    """A crescent slash arc: it sweeps on left to right, thick behind its leading tip and thin to a point at the tail, its
    outer edge white-hot; a thinner echo arc rides inside it; then the tail eats it and it thins away."""
    A, H = np.zeros_like(U), np.zeros_like(U)
    head = 0.3 + 0.7 * ss(0.0, 0.32, t)
    tail = 0.93 * ss(0.36, 1.0, t)
    thin = 1 - 0.55 * ss(0.4, 1.0, t)
    for (cx, cy, R, W, peak, seed) in [(0.0, -0.4, 0.95, 0.21, 0.62, 2201), (0.02, -0.4, 0.7, 0.075, 0.55, 2202)]:
        r = np.hypot(U - cx, V - cy)
        ang = np.arctan2(V - cy, U - cx)
        a0, a1 = math.radians(160), math.radians(18)
        s = (a0 - ang) / (a0 - a1)
        k = np.clip((s - tail) / max(head - tail, 1e-3), 0, 1)
        prof = np.sin(math.pi * k) ** 0.65 * (0.3 + 0.7 * k)       # pointed ends, fullest toward the head
        w = W * thin * prof / 0.92
        inner, outer = R - 0.32 * w, R + 0.68 * w
        inside = (s > tail) & (s < head) & (w > PX * 0.4)
        a = hard(np.maximum(inner - r, r - outer)) * inside
        e = np.clip((r - inner) / np.maximum(outer - inner, 1e-4), 0, 1)
        h = cel(e, t1=0.3, t2=peak + 0.12 * ss(0.4, 1, t)) * (1.0 if W > 0.1 else 0.85)
        A, H = lay(A, H, a, h)
    return A, H


def spark_burst(t):
    """Spark streaks flying out from a hit: thin tails, fat hot heads, a flash at the centre for the first frames."""
    rng = np.random.default_rng(2303)
    A, H = np.zeros_like(U), np.zeros_like(U)
    n = 14
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.2, 0.2)
        sp = rng.uniform(0.55, 1.0)
        L = rng.uniform(0.2, 0.42) * (1 - 0.5 * t)
        hd = 0.16 + sp * 0.78 * (1 - (1 - t) ** 1.7)
        tl = max(0.03, hd - L)
        w0 = rng.uniform(0.026, 0.048) * (1 - 0.55 * t)
        ca, sa = math.cos(a), math.sin(a)
        d, k = seg(ca * tl, sa * tl, ca * hd, sa * hd)
        width = w0 * (0.12 + 0.88 * k)
        a_ = hard(d - width) * (1 - ss(0.78, 1.0, t + rng.uniform(-0.1, 0.1)) * 0.9)
        h = cel((1 - d / np.maximum(width, 1e-4)) * (0.35 + 0.65 * k), t1=0.22, t2=0.5)
        A, H = lay(A, H, a_, h)
    fl = 0.24 * (1 - ss(0.0, 0.45, t))
    if fl > PX:
        A, H = lay(A, H, hard(RAD - fl), cel(1 - RAD / fl, t1=0.2, t2=0.45))
    return A, H


def shock_ring(t):
    """A ring that bursts outward and thins, its leading edge hot; past the middle its trailing edge breaks into gaps."""
    R = 0.22 + 0.7 * (1 - (1 - t) ** 2)
    w = 0.05 + 0.14 * (1 - t) ** 1.4
    n = periodic_noise(ANG, 3.0, 2401)
    inner = R - 0.5 * w + w * 0.7 * ss(0.25, 1.0, t) * n
    outer = R + 0.5 * w
    a = hard(np.maximum(inner - RAD, RAD - outer))
    gaps = periodic_noise(ANG, 5.0, 2402)
    a *= ss(0.62 * ss(0.4, 1.0, t) - 0.02, 0.62 * ss(0.4, 1.0, t) + 0.02, gaps + 0.08)
    e = np.clip((RAD - inner) / np.maximum(outer - inner, 1e-4), 0, 1)
    return a, cel(e, t1=0.28, t2=0.66 + 0.2 * t)


def smoke(t):
    """Dark cel smoke: round lobes that pop out, drift apart and rise, each lit like a ball in two flat bands (a shade
    side and a lit side); past the middle it tears into holes, hard-edged."""
    rng = np.random.default_rng(2505)
    pop = 1 - (1 - min(1.0, t / 0.25)) ** 2
    H = np.full_like(U, -1.0)
    NX, NY, NZ = np.zeros_like(U), np.zeros_like(U), np.ones_like(U)
    SD = np.full_like(U, 9.0)
    for i in range(6):
        a = rng.uniform(0, math.tau) if i else 0.0
        d = rng.uniform(0.4, 1.0) if i else 0.0
        r = 0.27 * (rng.uniform(0.6, 0.95) if i else 1.1) * (0.5 + 0.5 * pop) * (1 + 0.45 * t)
        cx = math.cos(a) * 0.3 * d * (1 + 0.6 * t)
        cy = -0.1 + math.sin(a) * 0.22 * d * (1 + 0.6 * t) + 0.18 * t * rng.uniform(0.6, 1.2)
        du, dv = (U - cx) / r, (V - cy) / r
        q = du * du + dv * dv
        h = np.where(q < 1, np.sqrt(np.clip(1 - q, 0, 1)), -1.0)
        win = h > H
        H = np.where(win, h, H)
        NX, NY, NZ = np.where(win, du, NX), np.where(win, dv, NY), np.where(win, h, NZ)
        SD = np.minimum(SD, (np.sqrt(q) - 1) * r)
    wob = (fbm(U * 4 + 1, V * 4, 2506, 2) - 0.5) * (0.04 + 0.06 * t)
    alpha = hard(SD + wob)
    holes = fbm(U * 5 + 3, V * 5, 2507, 3)
    dry = ss(0.3, 1.1, t)
    alpha *= ss(dry * 0.95 - 0.02, dry * 0.95 + 0.02, holes * 0.8 + np.clip(H, 0, 1) * 0.25)
    inv = 1 / np.sqrt(NX * NX + NY * NY + NZ * NZ + 1e-9)
    shade = (NX * LIGHT[0] + NY * LIGHT[1] + NZ * LIGHT[2]) * inv
    heat = 0.05 + 0.11 * ss(0.56, 0.6, shade) + 0.1 * ss(0.86, 0.9, shade)
    return alpha, heat


def swirl(t):
    """Energy gathering: three spiral arms wind in toward a hot core that swells as they arrive."""
    Rmax = 0.95 * (1 - 0.6 * t)
    arms = 0.5 + 0.5 * np.cos(3 * (ANG + 5.5 * RAD) - t * 7.0)
    taper = ss(Rmax + 0.02, Rmax - 0.25, RAD) * ss(0.02, 0.12, RAD)
    f = arms * taper
    th = 0.52
    a = ss(th - 0.025, th + 0.025, f)
    A, H = a, cel(np.clip((f - th) / (1 - th), 0, 1) * (1 - 0.5 * RAD / max(Rmax, 1e-3)) + 0.25 * (RAD < 0.3), t1=0.22, t2=0.62)
    rc = 0.06 + 0.17 * ss(0.1, 0.9, t)
    A, H = lay(A, H, hard(RAD - rc), cel(1 - RAD / rc, t1=0.15, t2=0.45))
    return A, H


def halo(t):
    """A glow halo: a hard white-hot disc in a flat mid band, in a soft glow that breathes."""
    pulse = 1 + 0.09 * math.sin(2 * math.pi * t)
    rc, rm = 0.12 * pulse, 0.22 * pulse
    glow = np.exp(-(RAD / (0.56 * pulse)) ** 2 * 2.4)
    alpha = np.maximum(hard(RAD - rm), glow * 0.8) * ss(0.98, 0.9, RAD)
    heat = LO + (MID - LO) * hard(RAD - rm, 1.4) + (HI - MID) * hard(RAD - rc, 1.4)
    return alpha, heat


def speed_line(t):
    """One anime speed line along +u: it shoots out to its full length, a hot core in a tapered body, then the tail
    catches up and it thins away."""
    xh = 0.93 - 0.05 * t
    L = 1.78 * (0.32 + 0.68 * ss(0.0, 0.3, t)) - 1.25 * ss(0.5, 1.0, t)
    xt = xh - max(L, 0.12)
    d, k = seg(xt, 0.0, xh, 0.0)
    width = 0.058 * (1 - 0.6 * ss(0.45, 1.0, t)) * (0.05 + 0.95 * k ** 1.2)
    a = hard(d - width)
    return a, cel(1 - d / np.maximum(width, 1e-4), t1=0.3, t2=0.6)


def poly_sdf(pts, x, y):
    """Signed distance (negative inside) to a convex polygon, as the farthest edge's half-plane distance."""
    d = np.full_like(x, -9.0)
    n = len(pts)
    for i in range(n):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
        ex, ey = bx - ax, by - ay
        l = math.hypot(ex, ey) or 1e-9
        nx, ny = ey / l, -ex / l                                 # outward for counter-clockwise points
        d = np.maximum(d, (x - ax) * nx + (y - ay) * ny)
    return d


def debris(t):
    """Rock chunks thrown up and out: faceted, a lit face and a shade face, tumbling as they fall."""
    rng = np.random.default_rng(2909)
    A, H = np.zeros_like(U), np.zeros_like(U)
    for i in range(6):
        nv = int(rng.integers(5, 7))
        angs = np.sort(rng.uniform(0, 2 * math.pi, nv))
        size = rng.uniform(0.1, 0.19) * (1 - 0.2 * t)
        rad = size * rng.uniform(0.75, 1.0, nv)
        a = rng.uniform(0.18, 0.82) * math.pi
        sp = rng.uniform(0.55, 1.0)
        cx = math.cos(a) * sp * (0.15 + 0.95 * t)
        cy = -0.42 + math.sin(a) * sp * (0.22 + 1.15 * t) - 1.2 * t * t
        rot = rng.uniform(0, 2 * math.pi) + rng.uniform(2, 5) * (1 if i % 2 else -1) * t
        pts = [(math.cos(g + rot) * r, math.sin(g + rot) * r) for g, r in zip(angs, rad)]
        x, y = U - cx, V - cy
        a_ = hard(poly_sdf(pts, x, y)) * (1 - ss(0.82, 1.05, t + rng.uniform(-0.08, 0.08)))
        split = math.radians(135) + rot * 0.35                   # the facet edge turns as it tumbles
        lit = (x * math.cos(split) + y * math.sin(split)) > -0.2 * size
        h = np.where(lit, 0.42, 0.18)
        A, H = lay(A, H, a_, h)
    return A, H


def rune(t):
    """A circular rune that draws itself in clockwise from the top, flares as it completes, then dissolves."""
    draw = 0.12 + 0.88 * ss(0.0, 0.42, t)
    glow = ss(0.36, 0.55, t) * (1 - ss(0.62, 0.86, t))
    fade = ss(0.62, 1.0, t)
    frac = np.mod(math.pi / 2 - ANG, 2 * math.pi) / (2 * math.pi)
    shown = ss(draw + 0.006, draw - 0.006, frac)
    D = np.full_like(U, 9.0)
    W = np.full_like(U, 0.01)

    def add(d, w):
        nonlocal D, W
        better = d - w < D - W
        D, W = np.where(better, d, D), np.where(better, w, W)

    add(np.abs(RAD - 0.8), 0.03)
    add(np.abs(RAD - 0.57), 0.02)
    for i in range(12):                                        # ticks between the rings
        g = math.pi / 2 - 2 * math.pi * i / 12
        long_ = i % 3 == 0
        d, _ = seg(math.cos(g) * 0.6, math.sin(g) * 0.6, math.cos(g) * (0.77 if long_ else 0.7), math.sin(g) * (0.77 if long_ else 0.7))
        add(d, 0.018 if long_ else 0.012)
    for flip in (0, 1):                                        # a six-pointed star inside
        pts = [(math.cos(math.pi / 2 + flip * math.pi + 2 * math.pi * k / 3) * 0.53, math.sin(math.pi / 2 + flip * math.pi + 2 * math.pi * k / 3) * 0.53) for k in range(3)]
        for k in range(3):
            d, _ = seg(*pts[k], *pts[(k + 1) % 3])
            add(d, 0.016)
    add(np.abs(RAD - 0.16), 0.022)
    for i in range(6):                                         # beads on the outer ring
        g = math.pi / 2 - 2 * math.pi * (i + 0.5) / 6
        add(np.hypot(U - math.cos(g) * 0.8, V - math.sin(g) * 0.8), 0.05)
    line = hard(D - W) * shown
    f = np.clip(1 - D / np.maximum(W, 1e-4), 0, 1)
    heat = np.where(f > 0.5, MID + (HI - MID) * glow, 0.32 + 0.2 * glow)
    bloom = np.clip(np.exp(-np.maximum(D - W, 0) / 0.035) * glow * 0.55, 0, 1) * shown * (1 - line)
    A, H = lay(line, heat, bloom, np.full_like(U, LO))
    keep = fbm(U * 6 + 2, V * 6 + 9, 2911, 3)
    A = A * ss(fade * 0.95 - 0.03, fade * 0.95 + 0.03, keep)
    return A, H


def mote(t):
    """A small light mote for auras: a 6 px white-hot core, a flat mid ring, a soft glow and four short flickering rays."""
    tw = 0.5 + 0.5 * math.sin(2 * math.pi * t)
    rc = PX * (2.6 + 0.4 * tw)
    rm = PX * (5.5 + 1.0 * tw)
    glow = np.exp(-(RAD / (PX * (16 + 4 * tw))) ** 2 * 2)
    rays = np.zeros_like(U)
    for ax, ay in [(1, 0), (0, 1)]:
        along, across = np.abs(U * ax + V * ay), np.abs(-U * ay + V * ax)
        L = PX * (20 + 10 * tw)
        w = PX * 1.6 * np.clip(1 - along / L, 0, 1)
        rays = np.maximum(rays, hard(across - w, 0.7) * (along < L))
    A = np.maximum(np.maximum(hard(RAD - rm, 0.8), glow * 0.75), rays * 0.9)
    H = LO + (MID - LO) * np.maximum(hard(RAD - rm, 0.8), rays) + (HI - MID) * hard(RAD - rc, 0.8)
    return A, H


def crack_paths():
    """The crack's branches: (points, widths, start length) polylines, seeded once."""
    rng = np.random.default_rng(3131)
    paths = []
    for i in range(6):
        a = 2 * math.pi * i / 6 + rng.uniform(-0.3, 0.3)
        L = rng.uniform(0.55, 0.86)
        pts, ws, x, y = [(0.0, 0.0)], [0.04], 0.0, 0.0
        steps = 9
        for s in range(1, steps + 1):
            a += rng.uniform(-0.45, 0.45)
            x, y = x + math.cos(a) * L / steps, y + math.sin(a) * L / steps
            pts.append((x, y))
            ws.append(0.04 * (1 - s / steps) ** 0.9 + 0.006)
            if s in (3, 6) and rng.random() < 0.8:
                b = a + rng.choice([-1, 1]) * rng.uniform(0.5, 0.9)
                bl = rng.uniform(0.16, 0.3)
                bp, bw, bx, by = [(x, y)], [ws[-1] * 0.8], x, y
                for q in range(1, 5):
                    b += rng.uniform(-0.35, 0.35)
                    bx, by = bx + math.cos(b) * bl / 4, by + math.sin(b) * bl / 4
                    bp.append((bx, by))
                    bw.append(ws[-1] * 0.8 * (1 - q / 4) + 0.005)
                paths.append((bp, bw, L * s / steps))
        paths.append((pts, ws, 0.0))
    return paths


CRACK = None


def crack(t):
    """A ground crack decal spreading out from an impact: a dark split with a lighter broken lip, a dent at the centre."""
    global CRACK
    CRACK = CRACK or crack_paths()
    grow = 0.25 + 0.75 * ss(0.0, 0.45, t)
    reach = grow * 1.0
    D = np.full_like(U, 9.0)
    W = np.full_like(U, 0.01)
    for pts, ws, start in CRACK:
        cum = start
        for (p, q), (wa, wb) in zip(zip(pts[:-1], pts[1:]), zip(ws[:-1], ws[1:])):
            sl = math.hypot(q[0] - p[0], q[1] - p[1])
            d, k = seg(p[0], p[1], q[0], q[1])
            w = (wa + (wb - wa) * k) * (0.6 + 0.4 * grow)
            ok = (cum + k * sl) <= reach
            better = ok & (d - w < D - W)
            D, W = np.where(better, d, D), np.where(better, w, W)
            cum += sl
    lip = 1.7
    a = hard(D - W * lip)
    f = 1 - D / np.maximum(W * lip, 1e-4)
    heat = np.where(f > 1 - 1 / lip, 0.04, 0.24)
    dent = 0.1 * (0.5 + 0.5 * ss(0.0, 0.2, t))
    A, H = lay(a, heat, hard(RAD - dent * 1.4), np.where(RAD < dent, 0.04, 0.24))
    A *= 1 - 0.75 * ss(0.6, 1.0, t)
    return A, H


def beam(t):
    """A beam segment along +u: a white-hot core line in a flat mid band and a darker wavy edge; every wave is a whole
    number of periods across the cell, so it tiles along u, and each frame scrolls them."""
    ph = 2 * math.pi * t
    vc = 0.016 * np.sin(math.pi * 2 * U + ph)
    hw = 0.2 + 0.035 * np.sin(math.pi * 2 * U + ph) + 0.022 * np.sin(math.pi * 5 * U - 2 * ph) + 0.013 * np.sin(math.pi * 9 * U + 3 * ph)
    hm = 0.13 + 0.014 * np.sin(math.pi * 3 * U - ph) + 0.01 * np.sin(math.pi * 7 * U + 2 * ph)
    hc = 0.055 + 0.01 * np.sin(math.pi * 4 * U + 2 * ph)
    dv = np.abs(V - vc)
    a = hard(dv - hw)
    heat = LO + (MID - LO) * hard(dv - hm) + (HI - MID) * hard(dv - hc)
    return a, heat


def ink(t):
    """A splat of black ink: a blot with spiky tendrils that bursts open, drops and brush flicks thrown out along them, a
    glossy crescent on the blot; then it dries and breaks up. Mostly low heat (the ramp's dark edge)."""
    rng = np.random.default_rng(3337)
    pop = 1 - (1 - min(1.0, t / 0.3)) ** 2
    base = 0.12 + 0.12 * pop
    rb = base * (1 + 0.28 * (periodic_noise(ANG, 2.2, 3338) - 0.5) * 2)
    spikes = rng.uniform(0, math.tau, 9)
    for g in spikes:
        L = rng.uniform(0.08, 0.26) * pop
        rb = rb + L * np.maximum(0, np.cos(ANG - g)) ** 60
    A = hard(RAD - rb)
    gloss = (RAD < rb * 0.7) & (RAD > rb * 0.42) & ((U * LIGHT[0] + V * LIGHT[1]) / (np.maximum(RAD, 1e-3) * math.hypot(LIGHT[0], LIGHT[1])) > 0.5)
    H = np.where(gloss, 0.16, 0.03)
    for i in range(12):                                       # drops thrown out, stretched while fast
        g = spikes[i % 9] + rng.uniform(-0.25, 0.25)
        sp = rng.uniform(0.5, 1.0)
        dist_ = base + 0.15 + sp * 0.55 * (1 - (1 - t) ** 1.5)
        r = rng.uniform(0.02, 0.05) * (1 - 0.35 * t)
        ca, sa = math.cos(g), math.sin(g)
        tail = dist_ - r * (1 + 3.0 * (1 - t))
        d, _ = seg(ca * tail, sa * tail, ca * dist_, sa * dist_)
        A, H = lay(A, H, hard(d - r), np.full_like(U, 0.03))
    for i in range(3):                                        # brush flicks
        g = rng.uniform(0, math.tau)
        hd = 0.3 + 0.48 * pop
        d, k = seg(math.cos(g) * 0.15, math.sin(g) * 0.15, math.cos(g) * hd, math.sin(g) * hd)
        w = 0.045 * (1 - k) ** 0.8 + 0.004
        A, H = lay(A, H, hard(d - w), np.full_like(U, 0.03))
    dry = fbm(U * 5 + 4, V * 5 + 1, 3339, 3)
    A = A * ss(0.85 * ss(0.5, 1.0, t) - 0.03, 0.85 * ss(0.5, 1.0, t) + 0.03, dry)
    return A, H


def flare(t):
    """A four-point flare for hits and pickups: long thin rays on the axes, short ones on the diagonals, a hot core; it
    pops open, turns a little and shrinks away."""
    pop = 0.35 + 0.65 * ss(0.0, 0.2, t)
    k = pop * (1 - 0.6 * ss(0.35, 1.0, t))
    rot = 0.2 * t
    cr, sr = math.cos(rot), math.sin(rot)
    x, y = U * cr + V * sr, -U * sr + V * cr
    A, H = np.zeros_like(U), np.zeros_like(U)
    for (ax, ay, L, w0) in [(1, 0, 0.9, 0.05), (0, 1, 0.9, 0.05), (0.7071, 0.7071, 0.4, 0.03), (0.7071, -0.7071, 0.4, 0.03)]:
        along, across = np.abs(x * ax + y * ay), np.abs(-x * ay + y * ax)
        Lk, wk = L * k, w0 * (0.6 + 0.4 * k)
        w = wk * np.clip(1 - along / max(Lk, 1e-3), 0, 1) ** 1.2
        a = hard(across - w) * (along < Lk)
        f = (1 - across / np.maximum(w, 1e-4)) * (1 - along / max(Lk, 1e-3)) ** 0.5
        A, H = lay(A, H, a, cel(f, t1=0.15, t2=0.42))
    rc = 0.03 + 0.1 * k
    A, H = lay(A, H, hard(RAD - rc), cel(1 - RAD / rc, t1=0.2, t2=0.4))
    return A, H


# ---- the Arcane wave's rows (classes v2: Elementalist, Illusionist, Necromancer, Transmuter)
# Hand-placed outlines (points in cell units, cut with exact signed distances) and tapered strokes, so the silhouettes
# stay crisp at any turn or foreshortening; bands painted in painter's order.
def poly_sd(pts, x=None, y=None):
    """Signed distance (negative inside) to any simple polygon: the nearest edge, inside by the even-odd rule."""
    x = U if x is None else x
    y = V if y is None else y
    d = np.full_like(x, 9.0)
    inside = np.zeros(x.shape, bool)
    n = len(pts)
    for i in range(n):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
        d = np.minimum(d, seg(ax, ay, bx, by, x, y)[0])
        if ay != by:
            inside ^= ((ay > y) != (by > y)) & (x < ax + (y - ay) * (bx - ax) / (by - ay))
    return np.where(inside, -d, d)


def place(pts, cx=0.0, cy=0.0, rot=0.0, sx=1.0, sy=1.0):
    """Hand-placed local points into the cell: scaled (sx foreshortens a turn), turned, then moved."""
    c, s = math.cos(rot), math.sin(rot)
    return [(cx + x * sx * c - y * sy * s, cy + x * sx * s + y * sy * c) for x, y in pts]


def bez(p0, p1, p2, p3, n=10):
    """n points along a cubic Bézier from p0 (kept) toward p3 (left out: the next piece starts there)."""
    k = np.linspace(0, 1, n, endpoint=False)[:, None]
    P = [np.array(p, float) for p in (p0, p1, p2, p3)]
    out = (1 - k) ** 3 * P[0] + 3 * (1 - k) ** 2 * k * P[1] + 3 * (1 - k) * k * k * P[2] + k ** 3 * P[3]
    return [tuple(p) for p in out]


def ellipse_pts(cx, cy, rx, ry=None, n=40):
    ry = rx if ry is None else ry
    return [(cx + rx * math.cos(math.tau * i / n), cy + ry * math.sin(math.tau * i / n)) for i in range(n)]


def tube(pts, ws):
    """Signed distance to a tapered stroke through pts (a cone between each pair, the width eased along it)."""
    d = np.full_like(U, 9.0)
    for (a, b), (wa, wb) in zip(zip(pts[:-1], pts[1:]), zip(ws[:-1], ws[1:])):
        dd, k = seg(a[0], a[1], b[0], b[1])
        d = np.minimum(d, dd - (wa + (wb - wa) * k))
    return d


def paint(A, H, a, h):
    """Paint a shape on top (painter's order): its heat wins wherever it covers more than half."""
    return np.maximum(A, a), np.where(a > 0.5, h, H)


def mirror(right):
    """A left-right symmetric outline from its right half (listed top to bottom, x >= 0)."""
    return list(right) + [(-x, y) for x, y in reversed(right) if x > 1e-9]


def tongue(x0, yb, h, w, t, ph, n=28, lean=0.0, waist=0.0):
    """A flame tongue from a round base at (x0, yb) up h: it sways with t, tapers to a point, a waist can pinch it."""
    k = np.linspace(0, 1, n)
    sway = (0.1 * np.sin(math.pi * 1.25 * k + math.tau * t + ph) * k + 0.045 * np.sin(math.tau * 1.5 * k - 2 * math.tau * t + ph) * k * k) * (h / 1.2)
    xs, ys = x0 + sway + lean * k * k, yb + k * h
    ws = w * (1 - k) ** 1.15 * np.minimum(1, np.sqrt(k / 0.16 + 0.12)) * (1 - waist * np.exp(-((k - 0.7) / 0.08) ** 2))
    return tube(list(zip(xs, ys)), ws)


def arc_flame(t):
    """One licking fire tongue: a round base, a body that sways as it stretches up, cel bands nested as flames (the dark
    edge outside, the coloured band, a white-hot inner tongue); at the top of its stretch a waist pinches in, the tip
    tears off and rises away as a small lick, and the tongue drops back. Side licks flicker at its foot. Loops (fps)."""
    A, H = np.zeros_like(U), np.zeros_like(U)
    yb = -0.78
    if t < 0.5:
        h, waist = 1.0 + 0.5 * ss(0.0, 0.42, t), 0.9 * ss(0.3, 0.5, t)
    else:
        h, waist = 1.06 - 0.06 * ss(0.5, 1.0, t), 0.0
    h += 0.04 * math.sin(math.tau * t * 2)
    for x0, ph, hb, lean in ((-0.17, 0.9, 0.62, -0.16), (0.18, 2.6, 0.52, 0.14)):   # side licks, behind
        hs = hb * (0.72 + 0.32 * math.sin(math.tau * t + ph))
        A, H = paint(A, H, hard(tongue(x0, yb + 0.05, hs, 0.11, t, ph, lean=lean)), np.full_like(U, LO))
        A, H = paint(A, H, hard(tongue(x0 * 0.8, yb + 0.07, hs * 0.55, 0.06, t, ph + 0.3, lean=lean * 0.6)), np.full_like(U, MID))
    for scale, w, heat, dy in ((1.0, 0.31, LO, 0.0), (0.72, 0.205, MID, 0.04), (0.42, 0.12, HI, 0.07)):
        d = tongue(0.0, yb + dy, h * scale, w, t, 0.25 * (1 - scale), waist=waist if scale == 1.0 else 0.0)
        A, H = paint(A, H, hard(d), np.full_like(U, heat))
    if t >= 0.5:                                                          # the torn-off lick rising away
        u = (t - 0.5) / 0.5
        s = (1 - u) ** 0.9
        x0, y0 = 0.06 * math.sin(math.tau * t + 0.5), yb + 1.0 + 0.4 * u
        A, H = paint(A, H, hard(tongue(x0, y0, 0.44 * s + 0.08, 0.12 * s + 0.02, t, 1.4)), np.full_like(U, LO))
        A, H = paint(A, H, hard(tongue(x0, y0 + 0.035, 0.24 * s + 0.04, 0.065 * s + 0.01, t, 1.6)), np.full_like(U, MID))
    for k, ph in enumerate((0.15, 0.62)):                                 # two embers rising
        u = (t + ph) % 1
        ex, ey = 0.32 * math.sin(math.tau * (u * 0.6 + ph)) * (0.6 + 0.4 * k), -0.3 + 1.1 * u
        r = 0.026 * (1 - u) + 0.01
        A, H = paint(A, H, hard(np.hypot(U - ex, V - ey) - r) * (1 - ss(0.75, 0.95, u)), np.full_like(U, HI))
    return A, H


def water_drop(A, H, x, y, vx, vy, r):
    """A drop flying with velocity (vx, vy): round at its head, drawn out to a point behind it the faster it goes; a dark
    rim, the coloured body and a white-hot glint toward the light."""
    sp = math.hypot(vx, vy) or 1e-6
    dx, dy = vx / sp, vy / sp
    L = r * (0.4 + 1.5 * min(sp, 2.4) / 2.4)
    d, k = seg(x - dx * L, y - dy * L, x, y)
    sd = np.minimum(d - r * np.clip(k, 0, 1) ** 0.75, np.hypot(U - x, V - y) - r)
    f = np.clip(-sd / r, 0, 1)
    h = np.where(f < 0.3, LO, MID)
    gx, gy = x - dx * r * 0.1 - 0.32 * r, y - dy * r * 0.1 + 0.36 * r
    h = np.where(np.hypot(U - gx, V - gy) < r * 0.36, HI, h)
    return paint(A, H, hard(sd), h)


def arc_droplet(t):
    """Water spray: a splash crown at the start, then round drops flying up and out and falling, each stretched along its
    speed; they shrink as they fall, mist specks with them."""
    rng = np.random.default_rng(4201)
    A, H = np.zeros_like(U), np.zeros_like(U)
    x0, y0, g = 0.0, -0.52, 3.4
    crown = 1 - ss(0.0, 0.32, t)
    if crown > 0.02:
        for j in range(7):
            a = math.pi * (0.16 + 0.68 * j / 6)
            L = (0.26 + 0.12 * (j % 2)) * (0.55 + 0.6 * ss(0, 0.2, t)) * crown
            ca, sa = math.cos(a), math.sin(a)
            d, k = seg(x0 + ca * 0.1, y0 + sa * 0.05, x0 + ca * (0.1 + L), y0 + sa * (0.05 + L))
            A, H = paint(A, H, hard(d - (0.055 * (1 - k) + 0.01)), np.where(k > 0.55, HI, MID))
        A, H = paint(A, H, hard(np.hypot((U - x0) / 1.6, V - y0) - 0.07 * crown), np.full_like(U, MID))
    tt = 0.1 + t * 0.85
    for i in range(7):
        a = math.pi * (0.2 + 0.6 * (i + rng.uniform(-0.3, 0.3)) / 6)
        sp = rng.uniform(0.62, 1.0)
        vx, vy = math.cos(a) * sp * 0.85, math.sin(a) * sp * 2.5
        r = rng.uniform(0.075, 0.115) * (1 - 0.4 * t)
        A, H = water_drop(A, H, x0 + vx * tt, y0 + vy * tt - 0.5 * g * tt * tt, vx, vy - g * tt, r)
    for i in range(6):
        a = rng.uniform(0.25, math.pi - 0.25)
        sp = rng.uniform(0.7, 1.15)
        vx, vy = math.cos(a) * sp * 0.9, math.sin(a) * sp * 2.2
        r = rng.uniform(0.026, 0.04) * (1 - 0.45 * t)
        x, y = x0 + vx * tt, y0 + vy * tt - 0.5 * g * tt * tt
        A, H = paint(A, H, hard(np.hypot(U - x, V - y) - r) * (1 - ss(0.62, 0.92, t + rng.uniform(-0.1, 0.1))), np.full_like(U, MID))
    return A, H


def arc_wave(t):
    """A breaking wave crest seen side-on, rolling forward (+u): a swell rises, its crest throws a thick lip forward over
    a dark barrel with white-hot foam claws on its leading edge; then the lip falls, the barrel closes and the crest
    bursts into foam and spray as the wave sinks."""
    yb = -0.56
    X = -0.3 + 0.34 * t
    build = ss(0.0, 0.42, t)
    crash = ss(0.56, 0.95, t)
    Hc = 0.36 + 0.8 * build - 0.62 * crash
    rb = (0.15 + 0.17 * build) * (1 - 0.55 * crash)
    theta = math.radians(10 + 190 * ss(0.05, 0.5, t) + 50 * crash)
    top = (X, yb + Hc)
    phis = math.radians(105)
    cb = (top[0] - rb * math.cos(phis), top[1] - rb * math.sin(phis))
    # The body: the back rising to the crest, the face falling under the barrel to its foot, a foam-edged underside.
    back = bez((-0.9, yb - 0.1), (-0.62, yb + 0.02), (X - 0.52, yb + Hc * 0.98), top, 18)
    face = bez(top, (cb[0] + rb * 0.3, cb[1] + rb * 0.35), (cb[0] - rb * 0.95, cb[1] - rb * 1.35), (cb[0] + rb * 1.7, yb), 14)
    foot = bez((cb[0] + rb * 1.7, yb), (cb[0] + rb * 2.4, yb - 0.02), (0.86, yb - 0.04), (0.88, yb - 0.1), 6)
    under = [(0.88 - 1.76 * u, yb - 0.1 - 0.06 * math.sin(math.pi * u) + 0.022 * math.sin(u * 47)) for u in np.linspace(0, 1, 26)[:-1]]
    sd = poly_sd(back + face + foot + under)
    A = hard(sd)
    depth = np.clip(-sd, 0, 9)
    H = np.where(depth < 0.09 + 0.04 * build, MID, LO)
    for off, a0, a1 in ((0.13, 0.25, 0.8), (0.26, 0.15, 0.55)):          # two streaks along the back
        pts = [(x, y - off) for x, y in back[int(a0 * 18):int(a1 * 18)]]
        H = np.where((tube(pts, [PX * 1.2] * len(pts)) < 0) & (sd < 0), MID, H)
    if theta > math.radians(60):                                          # the barrel: the dark inside of the curl
        A, H = paint(A, H, hard(np.hypot(U - cb[0], V - cb[1]) - rb * 0.98) * (sd > -PX), np.full_like(U, LO))
    # The lip: a thick arm curling round the barrel from the crest, thinning to the tip, its outer edge white-hot.
    n = 32
    s = np.linspace(0, 1, n)
    phi = phis - theta * s
    rr = rb * (1.0 - 0.25 * s * s)
    ws = (0.05 + 0.11 * build) * (1 - s) ** 0.7 * (1 - 0.35 * crash) + PX * 0.8
    pts = list(zip(cb[0] + rr * np.cos(phi), cb[1] + rr * np.sin(phi)))
    da = tube(pts, ws)
    outer = np.hypot(U - cb[0], V - cb[1]) > rb * 0.8
    lip = hard(da)
    lh = np.where(da > -PX * 2.8, np.where(outer, HI, LO), MID)
    if crash > 0:                                                         # it turns to foam and breaks up
        keep = fbm(U * 7 + 3, V * 7 + 1, 4301, 3)
        lip = lip * ss(crash * 0.75 - 0.02, crash * 0.75 + 0.02, keep)
        lh = np.where(keep < crash * 0.9 + 0.2, HI, lh)
    A, H = paint(A, H, lip, lh)
    claws = 1 - ss(0.55, 0.8, t)                                          # foam claws on the lip's leading edge
    if theta > math.radians(110) and claws > 0.05:
        for j in range(5):
            m = int(n * (0.42 + 0.1 * j))
            q, w, nrm = pts[m], ws[m], phi[m]                             # nrm: outward from the barrel centre
            bx, by = q[0] + math.cos(nrm) * w * 0.8, q[1] + math.sin(nrm) * w * 0.8
            g = nrm - 0.55
            L = (0.1 + 0.035 * (j % 2)) * claws * (1 - 0.12 * j)
            k = np.linspace(0, 1, 6)
            cl = [(bx + math.cos(g - u) * L * u, by + math.sin(g - u) * L * u) for u in k]
            A, H = paint(A, H, hard(tube(cl, (0.03 * (1 - k) + 0.006) * (0.6 + 0.4 * claws))), np.full_like(U, HI))
    if crash > 0:
        rng = np.random.default_rng(4302)
        keep = fbm(U * 5 + 9, V * 5 + 4, 4303, 3)
        for j in range(7):                                                # foam puffs bursting where the lip lands
            a = rng.uniform(-0.3, math.pi * 0.9)
            d = rng.uniform(0.3, 1.0)
            px = cb[0] + rb * 0.5 + math.cos(a) * 0.3 * d * (0.4 + 0.6 * crash)
            py = yb + 0.08 + abs(math.sin(a)) * 0.28 * d * (0.4 + 0.6 * crash)
            r = rng.uniform(0.07, 0.13) * ss(0.0, 0.4, crash) * (1 + 0.3 * crash)
            lit = (U - px) * -0.6 + (V - py) * 0.8 > -0.25 * r
            a_ = hard(np.hypot(U - px, V - py) - r) * ss(crash * 0.8 - 0.25, crash * 0.8 - 0.21, keep)
            A, H = paint(A, H, a_, np.where(lit, HI, MID))
        for j in range(10):                                               # spray thrown forward and up
            a = rng.uniform(0.25, 1.4)
            sp = rng.uniform(0.5, 1.0)
            px = cb[0] + rb * 0.6 + math.cos(a) * sp * 0.75 * crash
            py = yb + 0.25 + math.sin(a) * sp * 1.0 * crash - 0.8 * crash * crash
            r = rng.uniform(0.028, 0.05) * (1 - 0.35 * crash)
            A, H = paint(A, H, hard(np.hypot(U - px, V - py) - r), np.where(np.hypot(U - px + r * 0.3, V - py - r * 0.3) < r * 0.45, HI, MID))
    return A, H


def petal_outline(L, W):
    """A blossom petal from its base at the origin up +v: narrow at the base, full near the top, a notch in its tip."""
    right = [(0.0, 0.0)] + [(W * math.sin(math.pi * 0.5 * u) ** 0.9 * (1.0 - 0.12 * u), L * (0.08 + 0.72 * u)) for u in np.linspace(0.12, 1, 7)]
    right += [(W * 0.86, L * 0.88), (W * 0.62, L * 0.99), (W * 0.32, L * 1.0), (0.0, L * 0.86)]
    return mirror(right)


def arc_petal(t):
    """A blossom: a closed bud that opens into five notched petals round a white-hot centre, holds, then lets go; the
    petals drift out and fall, turning over (foreshortened) as they tumble. Each petal: the coloured band, a dark rim, a
    hot spot at its base and a lit stripe on its sunward side."""
    rng = np.random.default_rng(4401)
    A, H = np.zeros_like(U), np.zeros_like(U)
    o = ss(0.0, 0.4, t)
    let_go = max(0.0, (t - 0.47) / 0.53)
    for k in (0, 4, 1, 3, 2):
        jit = rng.uniform(-0.12, 0.12)
        spin = rng.uniform(1.6, 3.0) * (1 if k % 2 else -1)
        fall_x = rng.uniform(-0.25, 0.25)
        turn = rng.uniform(0.6, 1.6)
        a = math.pi / 2 + o * (math.tau * (k - 2) / 5) + 0.12 * o
        L, W, base = 0.26 + 0.22 * o, 0.13 + 0.07 * o, 0.1 * o
        bx, by = math.cos(a) * base, 0.02 + math.sin(a) * base - 0.1 * (1 - o)
        rot = a - math.pi / 2 + (1 - o) * (k - 2) * 0.12
        sx = 1.0
        if let_go > 0:
            u = let_go
            bx += math.cos(a) * 0.38 * u + fall_x * u
            by += math.sin(a) * 0.22 * u - 0.72 * u * u
            rot += spin * u
            sx = max(0.3, abs(math.cos(u * math.pi * turn)))
        sd = poly_sd(place(petal_outline(L, W), bx, by, rot, sx, 1.0))
        a_ = hard(sd) * (1 - ss(0.78, 1.0, t + jit * 0.5))
        ca, sa = math.cos(rot + math.pi / 2), math.sin(rot + math.pi / 2)
        along = ((U - bx) * ca + (V - by) * sa) / L                      # 0 at the base, 1 at the tip
        across = ((U - bx) * -sa + (V - by) * ca) / (W * sx)              # -1 .. 1 across it
        sun = 1 if -sa * LIGHT[0] + ca * LIGHT[1] < 0 else -1
        h = np.where(-sd < PX * 2.4, LO, MID)
        h = np.where((across * sun > 0.38) & (across * sun < 0.62) & (along > 0.3) & (along < 0.78) & (-sd > PX * 2.4), HI, h)
        h = np.where((along < 0.16) & (-sd > PX * 1.5), HI, h)
        A, H = paint(A, H, a_, h)
    c = 1 - ss(0.45, 0.62, t)                                             # the centre, gone as the petals let go
    if c > 0.02:
        rc = (0.06 + 0.05 * o) * c
        A, H = paint(A, H, hard(np.hypot(U, V - 0.02) - rc), np.full_like(U, HI))
        for j in range(5):
            g = math.tau * j / 5 + 0.3
            A, H = paint(A, H, hard(np.hypot(U - math.cos(g) * rc * 0.6, V - 0.02 - math.sin(g) * rc * 0.6) - rc * 0.2), np.full_like(U, LO))
    return A, H


def arc_cloud(t):
    """A dark storm-cloud puff: cumulus lobes heaped on a flat underside that billow out and up, in two dark flat bands
    (low heat, so the ramp's dark edge shows), a few lobes catching a bright rim light; past the middle it tears apart."""
    rng = np.random.default_rng(4501)
    pop = 1 - (1 - min(1.0, t / 0.3)) ** 2
    Hh = np.full_like(U, -1.0)
    NX, NY, NZ = np.zeros_like(U), np.zeros_like(U), np.ones_like(U)
    SD = np.full_like(U, 9.0)
    rims = np.zeros_like(U)
    floor = -0.32 - 0.04 * t
    lobes = [(0.0, 0.02, 0.32), (-0.33, -0.08, 0.24), (0.34, -0.06, 0.25), (-0.16, 0.22, 0.22), (0.17, 0.25, 0.2),
             (-0.55, -0.16, 0.16), (0.56, -0.14, 0.17), (0.02, 0.4, 0.15)]
    for i, (lx, ly, lr) in enumerate(lobes):
        grow = ss(0.15, 0.5, t) if i >= 6 else 1.0                       # the last two billow out later
        if grow <= 0.01:
            continue
        r = lr * (0.72 + 0.28 * pop) * (1 + 0.25 * t) * grow * rng.uniform(0.92, 1.05)
        cx = lx * (0.62 + 0.38 * pop) * (1 + 0.3 * t) + 0.03 * math.sin(math.tau * t + i)
        cy = ly * (0.6 + 0.4 * pop) + 0.12 * t + 0.02 * math.cos(math.tau * t + i * 1.7)
        du, dv = (U - cx) / r, (V - cy) / r
        q = du * du + dv * dv
        h = np.where(q < 1, np.sqrt(np.clip(1 - q, 0, 1)), -1.0)
        win = h > Hh
        Hh = np.where(win, h, Hh)
        NX, NY, NZ = np.where(win, du, NX), np.where(win, dv, NY), np.where(win, h, NZ)
        SD = np.minimum(SD, (np.sqrt(q) - 1) * r)
        if i in (0, 3, 4, 7):                                             # a rim light on the lit top edge of a few lobes
            facing = (du * -0.45 + dv * 0.9) / np.maximum(np.sqrt(q), 1e-3)
            rim = (np.sqrt(q) > 1 - 0.17 / max(r / 0.25, 0.6)) & (q < 1) & (facing > 0.55) & win
            rims = np.where(rim, 1.0, np.where(win, 0.0, rims))
    SD = np.maximum(SD, floor - V)
    wob = (fbm(U * 4 + 2, V * 4, 4502, 2) - 0.5) * (0.035 + 0.05 * t)
    alpha = hard(SD + wob)
    holes = fbm(U * 4.5 + 5, V * 4.5, 4503, 3)
    dry = ss(0.42, 1.12, t)
    alpha *= ss(dry * 0.95 - 0.02, dry * 0.95 + 0.02, holes * 0.8 + np.clip(Hh, 0, 1) * 0.25)
    inv = 1 / np.sqrt(NX * NX + NY * NY + NZ * NZ + 1e-9)
    shade = (NX * LIGHT[0] + NY * LIGHT[1] + NZ * LIGHT[2]) * inv
    heat = 0.03 + 0.08 * ss(0.5, 0.54, shade) + 0.07 * ss(0.82, 0.86, shade)
    heat = np.where(V < floor + 0.05, 0.03, heat)
    heat = np.where(rims > 0.5, 0.62 + 0.38 * (1 - ss(0.4, 0.8, t)) * (1 - 0.35 * ss(0.6, 0.9, t)), heat)
    return alpha, heat


def round_rect(a, b, r, n=6):
    """A rounded rectangle's outline, half-sizes a by b, corner radius r."""
    pts = []
    for cx, cy, a0 in ((a - r, b - r, 0.0), (-a + r, b - r, math.pi / 2), (-a + r, -b + r, math.pi), (a - r, -b + r, 1.5 * math.pi)):
        pts += [(cx + r * math.cos(a0 + math.pi / 2 * j / n), cy + r * math.sin(a0 + math.pi / 2 * j / n)) for j in range(n + 1)]
    return pts


def arc_card(t):
    """A playing card spinning as it flips: the face white-hot with a coloured diamond pip and corner pips, the back in
    the coloured band with a dark inset frame and a hot centre diamond, a dark rim on both; it foreshortens as it turns
    and makes half a turn in the plane (the card looks the same upside down), so the 8 frames loop. Frame 2 (the aura's
    mote frame) is the face, nearly upright."""
    i = t * FRAMES
    th = math.tau * (i - 2) / FRAMES + 0.2
    phi = -0.54 + math.pi * i / FRAMES
    c = math.cos(th)
    sx = max(abs(c), 0.12)
    on = lambda pts: poly_sd(place(pts, 0, 0, phi, sx, 1.0))
    sd = on(round_rect(0.34, 0.5, 0.07))
    if c > 0:
        Hh = np.full_like(U, HI)
        for p in ([(0, 0.21), (0.14, 0), (0, -0.21), (-0.14, 0)], [(-0.22, 0.42), (-0.17, 0.34), (-0.22, 0.26), (-0.27, 0.34)],
                  [(0.22, -0.42), (0.27, -0.34), (0.22, -0.26), (0.17, -0.34)]):
            Hh = np.where(on(p) < 0, MID, Hh)
    else:
        Hh = np.full_like(U, MID)
        Hh = np.where(np.abs(on(round_rect(0.265, 0.425, 0.05))) < PX * 1.3, LO, Hh)
        Hh = np.where(on([(0, 0.15), (0.1, 0), (0, -0.15), (-0.1, 0)]) < 0, HI, Hh)
    return hard(sd), np.where(-sd < PX * 2.6, LO, Hh)


GLASS_SHARD = [(0.0, 0.72), (0.25, 0.06), (0.11, -0.54), (-0.02, -0.36), (-0.17, -0.52), (-0.21, -0.02)]


def arc_shard(t):
    """A sharp glass shard tumbling: two facets (a lit one in the coloured band, a shade one darker), its edges that face
    the light white-hot, a glint sliding along it as it turns and a twinkle at its tip when it faces the light."""
    pop = 0.7 + 0.3 * ss(0.0, 0.18, t)
    rot = 0.5 - 2.3 * math.pi * t
    psi = math.tau * 1.25 * t + 0.35
    cs = math.cos(psi)
    s = pop * (1 - 0.15 * t)
    pts = place(GLASS_SHARD, 0, 0, rot, (0.28 + 0.72 * abs(cs)) * s, s)
    sd = poly_sd(pts)
    A = hard(sd)
    (ax, ay), (bx, by) = pts[0], pts[3]                                   # the facet line: tip to the notch at the break
    side = (U - ax) * (by - ay) - (V - ay) * (bx - ax)
    Hh = np.where((side > 0) == (cs > 0), MID, 0.26)
    mx, my = np.mean([p[0] for p in pts]), np.mean([p[1] for p in pts])
    for j in range(len(pts)):                                             # edges facing the light: a white-hot band
        (px, py), (qx, qy) = pts[j], pts[(j + 1) % len(pts)]
        l = math.hypot(qx - px, qy - py) or 1e-9
        nx, ny = (qy - py) / l, -(qx - px) / l
        if ((px + qx) / 2 - mx) * nx + ((py + qy) / 2 - my) * ny < 0:
            nx, ny = -nx, -ny
        if nx * LIGHT[0] + ny * LIGHT[1] > 0.15:
            Hh = np.where((seg(px, py, qx, qy)[0] < PX * 2.6) & (sd < 0), HI, Hh)
    ca, sa = math.cos(rot + math.pi / 2), math.sin(rot + math.pi / 2)
    g = -0.5 * s + 1.2 * s * ((t * 1.25 + 0.1) % 1)
    Hh = np.where((np.abs(U * ca + V * sa - g) < PX * 1.8) & (sd < -PX * 1.5), HI, Hh)
    tw = max(0.0, cs) ** 6
    if tw > 0.3:
        x, y = U - pts[0][0], V - pts[0][1]
        L = 0.2 * tw
        rays = np.maximum(hard(np.abs(y) - PX * 1.6 * np.clip(1 - np.abs(x) / L, 0, 1)) * (np.abs(x) < L),
                          hard(np.abs(x) - PX * 1.6 * np.clip(1 - np.abs(y) / L, 0, 1)) * (np.abs(y) < L))
        A, Hh = paint(A, Hh, np.maximum(rays, hard(np.hypot(x, y) - PX * 2.5)), np.full_like(U, HI))
    return A, Hh


def arc_bone(t):
    """A bone fragment tumbling end over end: a knobbed joint at one end, a jagged break at the other, shaded as a cel
    cylinder (a white-hot edge toward the light, the coloured body, a dark underside), the marrow dark at the break.
    Frame 2 (the aura's mote frame) shows it full length."""
    rot = -1.13 + 2.2 * math.pi * t
    sx = 0.5 + 0.5 * abs(math.cos(1.5 * math.pi * t + 1.96))
    s = (0.85 + 0.2 * ss(0.0, 0.15, t)) * 1.12
    c, sn = math.cos(rot), math.sin(rot)
    x, y = (U * c + V * sn) / (sx * s), (-U * sn + V * c) / s
    shaft, k = seg(-0.34, 0.0, 0.36, 0.0, x, y)
    rr = 0.068 + 0.018 * (1 - k)
    d = shaft - rr
    nx, ny = np.zeros_like(U), y / np.maximum(rr, 1e-3)
    for (kx, ky, kr) in ((-0.42, 0.07, 0.085), (-0.42, -0.07, 0.085), (-0.35, 0.0, 0.08)):
        dk = np.hypot(x - kx, y - ky) - kr
        win = dk < d
        nx, ny = np.where(win, (x - kx) / kr, nx), np.where(win, (y - ky) / kr, ny)
        d = np.minimum(d, dk)
    jag = 0.3 + 0.05 * np.abs(((y / 0.045) % 2) - 1)
    d = np.maximum(d, x - jag)
    lx, ly = LIGHT[0] * c + LIGHT[1] * sn, -LIGHT[0] * sn + LIGHT[1] * c   # the light in the bone's frame
    lit = (nx * lx + ny * ly) / math.hypot(lx, ly)
    Hh = np.where(lit > 0.5, HI, np.where(lit < -0.45, LO, MID))
    return hard(d * s), np.where((x > jag - 0.07) & (np.abs(y) < 0.035), LO, Hh)


def skull_sd(cx, cy, s):
    """A front-facing skull glyph at (cx, cy), size s: (the skull's signed distance, its sockets, nose and teeth)."""
    cran = np.hypot(U - cx, V - cy - 0.1 * s) - 0.27 * s
    jaw = poly_sd(place(round_rect(0.15, 0.13, 0.05), cx, cy - 0.17 * s, 0, s, s))
    cheek = poly_sd(place([(-0.24, 0.02), (0.24, 0.02), (0.17, -0.16), (-0.17, -0.16)], cx, cy, 0, s, s))
    body = np.minimum(np.minimum(cran, jaw), cheek)
    holes = np.minimum(np.hypot(U - cx - 0.11 * s, (V - cy) / 0.92) - 0.085 * s, np.hypot(U - cx + 0.11 * s, (V - cy) / 0.92) - 0.085 * s)
    holes = np.minimum(holes, poly_sd(place([(0, -0.07), (0.04, -0.15), (-0.04, -0.15)], cx, cy, 0, s, s)))
    for x0, y0, x1, y1 in ((-0.065, -0.205, -0.065, -0.29), (0.0, -0.205, 0.0, -0.29), (0.065, -0.205, 0.065, -0.29), (-0.1, -0.205, 0.1, -0.205)):
        holes = np.minimum(holes, seg(cx + x0 * s, cy + y0 * s, cx + x1 * s, cy + y1 * s)[0] - 0.012 * s)
    return body, holes


def arc_skull(t):
    """A small skull glyph for auras: it pops in (overshooting), holds white-hot with a coloured rim and a soft glow, dark
    sockets and teeth, then cools and breaks up from the edges as it drifts up. Frame 2 is the held glyph."""
    s = 0.55 + 0.6 * t / 0.12 if t < 0.12 else 1.12 - 0.12 * ss(0.12, 0.25, t) - 0.06 * ss(0.5, 1.0, t)
    body, holes = skull_sd(0.0, 0.12 * ss(0.5, 1.0, t), s * 0.92)
    solid = hard(body)
    glow = np.exp(-(np.maximum(body, 0) / (0.09 + 0.05 * (t < 0.15))) ** 2) * (0.55 - 0.3 * ss(0.4, 0.9, t)) * (body > 0)
    core = np.full_like(U, HI) if t < 0.12 else np.where(-body > PX * (2.6 + 5 * ss(0.45, 0.85, t)), HI, MID)
    Hh = np.where(solid > 0.5, np.where(holes < 0, 0.04, core), LO)
    dry = ss(0.55, 1.05, t)
    keep = fbm(U * 7 + 3, V * 7 + 2, 4601, 3) + 0.15 * np.clip(-body / 0.2, 0, 1)
    return np.maximum(solid, glow) * ss(dry * 0.9 - 0.03, dry * 0.9 + 0.03, keep), Hh


FOX_HEAD = mirror([(0.0, 0.16), (0.1, 0.21), (0.3, 0.58), (0.43, 0.15), (0.5, 0.03), (0.64, -0.1), (0.47, -0.14), (0.53, -0.25),
                   (0.3, -0.3), (0.13, -0.42), (0.0, -0.5)])
FOX_EYE = [(0.09, -0.02), (0.2, 0.04), (0.29, -0.02), (0.19, -0.08)]
FOX_EAR = [(0.15, 0.22), (0.28, 0.46), (0.35, 0.18)]
CRAB_CLAW = [(-0.62, -0.4), (-0.5, -0.56), (-0.22, -0.36), (0.12, -0.28), (0.42, -0.14), (0.66, 0.04), (0.44, 0.06), (0.38, 0.1),
             (0.32, 0.05), (0.25, 0.1), (0.17, 0.05), (0.08, 0.12), (0.17, 0.21), (0.25, 0.19), (0.3, 0.26), (0.38, 0.25),
             (0.44, 0.33), (0.58, 0.46), (0.38, 0.58), (0.1, 0.5), (-0.16, 0.34), (-0.32, 0.12), (-0.4, -0.16), (-0.6, -0.28)]
GOLEM_FIST = [(-0.4, 0.02), (-0.4, 0.3), (-0.33, 0.37), (-0.22, 0.35), (-0.18, 0.4), (-0.06, 0.4), (-0.01, 0.36), (0.04, 0.41),
              (0.16, 0.41), (0.2, 0.35), (0.25, 0.38), (0.36, 0.37), (0.42, 0.29), (0.43, -0.2), (0.36, -0.3), (0.22, -0.32),
              (0.22, -0.6), (-0.22, -0.6), (-0.22, -0.32), (-0.36, -0.28), (-0.44, -0.16)]


def beast_form(i):
    """The Transmuter's i-th form as a glyph: (signed distance, dark detail mask). 0 fox head, 1 crab claw, 2 wisp ring,
    3 pollen wings, 4 golem fist."""
    if i == 0:
        sd = poly_sd(place(FOX_HEAD, 0, 0, 0, 0.92, 0.92))
        det = poly_sd(place([(-0.07, -0.38), (0.07, -0.38), (0.0, -0.47)], 0, 0, 0, 0.92, 0.92)) < 0
        for sgn in (1, -1):
            for part in (FOX_EYE, FOX_EAR):
                det |= poly_sd(place([(sgn * x, y) for x, y in part], 0, 0, 0, 0.92, 0.92)) < 0
        return sd, det
    if i == 1:
        sd = poly_sd(place(CRAB_CLAW, 0.02, 0, 0, 0.92, 0.92))
        return sd, (seg(-0.3, 0.02, 0.0, -0.12)[0] < PX * 1.4) & (sd < -PX * 3)
    if i == 2:
        sd = np.abs(RAD - 0.48) - 0.05
        for j in range(4):
            g = math.pi / 4 + j * math.pi / 2
            sd = np.minimum(sd, seg(math.cos(g) * 0.52, math.sin(g) * 0.52, math.cos(g) * 0.66, math.sin(g) * 0.66)[0] - 0.035)
        k = np.linspace(0, 1, 16)
        sd = np.minimum(sd, tube(list(zip(0.06 * np.sin(k * 4.5) * k, -0.2 + 0.52 * k)), 0.17 * (1 - k) ** 1.1 * np.minimum(1, np.sqrt(k / 0.2 + 0.2))))
        return sd, (np.hypot(U - 0.06, V + 0.12) < 0.035) | (np.hypot(U + 0.06, V + 0.12) < 0.035)
    if i == 3:
        sd = poly_sd(ellipse_pts(0, -0.06, 0.1, 0.15, 24))
        det = np.zeros_like(U, bool)
        for sgn in (1, -1):
            sd = np.minimum(sd, poly_sd(place(ellipse_pts(0, 0, 0.3, 0.17, 28), sgn * 0.28, 0.17, sgn * 0.5)))
            sd = np.minimum(sd, poly_sd(place(ellipse_pts(0, 0, 0.19, 0.12, 24), sgn * 0.22, -0.2, -sgn * 0.45)))
            sd = np.minimum(sd, np.minimum(seg(sgn * 0.03, 0.08, sgn * 0.14, 0.42)[0] - 0.018, np.hypot(U - sgn * 0.15, V - 0.44) - 0.04))
            det |= (seg(sgn * 0.08, 0.03, sgn * 0.5, 0.3)[0] < PX * 1.3) | (seg(sgn * 0.07, -0.08, sgn * 0.35, -0.3)[0] < PX * 1.3)
        return sd, det & (sd < -PX * 2)
    sd = poly_sd(place(GOLEM_FIST, 0, 0.02, 0, 0.95, 0.95))
    det = np.zeros_like(U, bool)
    for x0, y0, x1, y1 in ((-0.19, 0.36, -0.2, 0.06), (0.01, 0.36, 0.0, 0.06), (0.21, 0.36, 0.2, 0.06), (-0.42, 0.04, 0.14, 0.04), (0.14, 0.04, 0.2, -0.12)):
        det |= seg(x0, y0, x1, y1)[0] < PX * 1.4
    return sd, det & (sd < -PX * 2)


def glow_glyph(sd, det, glow=0.45):
    """A glowing silhouette: a white-hot rim, the coloured fill, dark details, a soft glow round it."""
    g = np.exp(-(np.maximum(sd, 0) / 0.08) ** 2) * glow * (sd > 0)
    H = np.where(sd > 0, LO, np.where(-sd < PX * 2.6, HI, MID))
    return np.maximum(hard(sd), g), np.where(det, LO, H)


def scanline_slice(A, H, i, amount, drop_p):
    """Cut a glyph into 12 px scanline bands, shift each sideways up to `amount` px and drop a few: a form flickering."""
    rng = np.random.default_rng(4700 + i)
    A, H = A.copy(), H.copy()
    for b in range(CELL // 12 + 1):
        sl = slice(b * 12, min(CELL, (b + 1) * 12))
        if rng.random() < drop_p:
            A[sl] = 0
            continue
        sh = int(round(rng.uniform(-1, 1) * amount))
        A[sl], H[sl] = np.roll(A[sl], sh, axis=1), np.roll(H[sl], sh, axis=1)
        if abs(sh) >= amount * 0.6:
            H[sl.start] = np.where(A[sl.start] > 0, HI, H[sl.start])
    return A, H


def arc_beast(t):
    """Monster silhouettes flickering through the Transmuter's forms: fox head, crab claw, wisp ring, pollen wings, golem
    fist (frames 0-4, in key order: frame k is the form on key k + 1), then the shift back to the fox: the fist slices
    apart, the two ghost through each other, the fox reassembles (5-7), so it loops."""
    i = int(round(t * FRAMES)) % FRAMES
    if i <= 4:
        return glow_glyph(*beast_form(i))
    if i == 5:
        return scanline_slice(*glow_glyph(*beast_form(4), glow=0.3), i, 7, 0.22)
    if i == 6:
        a4, h4 = glow_glyph(*beast_form(4), glow=0.0)
        a4, h4 = scanline_slice(a4 * 0.55, np.minimum(h4, MID), i, 9, 0.35)
        return paint(a4, h4, hard(np.abs(beast_form(0)[0]) - PX * 1.6), np.full_like(U, HI))
    return scanline_slice(*glow_glyph(*beast_form(0), glow=0.3), i, 3, 0.1)


# name, painter, what it is, how the sheet shows it (glow: additive; else straight alpha). Append only: rows are indices.
COMBAT_SPRITES = [
    ("impactStar", impact_star, "spiky impact star: pops open, hollows out", True),
    ("slash", slash, "crescent slash arc: sweeps on, thins away", True),
    ("sparkBurst", spark_burst, "spark streaks flying out of a hit", True),
    ("shockRing", shock_ring, "shock ring: bursts out, breaks up", True),
    ("smoke", smoke, "dark cel smoke puff (two bands)", False),
    ("swirl", swirl, "energy swirl gathering into a core", True),
    ("halo", halo, "glow halo: hard core, soft breathing glow", True),
    ("speedLine", speed_line, "tapered speed line along +u", True),
    ("debris", debris, "rock chunks tumbling", False),
    ("rune", rune, "rune circle: draws in, flares, dissolves", True),
    ("mote", mote, "aura light mote (6 px core)", True),
    ("crack", crack, "ground crack decal (lies on the ground)", False),
    ("beam", beam, "beam segment along +u (tiles along u)", True),
    ("ink", ink, "black ink splash and flicks", False),
    ("flare", flare, "four-point flare star", True),
    # The Arcane wave (classes v2): the Elementalist's elements, the Illusionist's cards and glass, the Necromancer's bones
    # and skull mote, the Transmuter's form glyphs.
    ("flame", arc_flame, "fire tongue licking up, tip tears off (loops)", True),
    ("droplet", arc_droplet, "water spray: drops fly out and fall", False),
    ("wave", arc_wave, "wave crest side-on: curls forward, crashes", False),
    ("petal", arc_petal, "blossom opens, its petals fall tumbling", False),
    ("cloud", arc_cloud, "dark storm-cloud puff, a few rim lights", False),
    ("card", arc_card, "playing card flipping as it spins (loops)", False),
    ("shard", arc_shard, "glass shard tumbling, glint edge", True),
    ("bone", arc_bone, "bone fragment tumbling", False),
    ("skull", arc_skull, "skull glyph aura mote: pops in, fades", True),
    ("beast", arc_beast, "fox, crab, wisp, pollen, golem glyphs (loops)", True),
]
SHEET_RAMPS = [("arcane", "#fff6ff", "#b48cff", "#3a2466"), ("fire", "#fff4d6", "#ff8a3d", "#5a1a08"), ("holy", "#ffffff", "#ffe08a", "#8a6a20")]
DARK, GRASS = "#1b1f27", "#8fa16c"


def build_combat():
    rows = len(COMBAT_SPRITES)
    if rows > 32:
        raise SystemExit("the combat pack holds 32 rows at most")
    atlas = np.zeros((rows * CELL, FRAMES * CELL, 4))
    for r, (name, fn, _, _) in enumerate(COMBAT_SPRITES):
        for i in range(FRAMES):
            a, heat = fn(i / FRAMES)
            a, heat = np.clip(a, 0, 1), np.clip(heat, 0, 1)
            a[:2, :] = a[-2:, :] = 0
            a[:, :2] = a[:, -2:] = 0
            if a.max() < 0.05:
                raise SystemExit(f"empty frame: {name} {i}")
            atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL, :3] = heat[..., None]
            atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL, 3] = a
        print(f"  {name:10s} row {r}")
    img = Image.fromarray((atlas * 255 + 0.5).astype(np.uint8), "RGBA")
    os.makedirs(os.path.dirname(OUT_COMBAT), exist_ok=True)
    img.save(OUT_COMBAT, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print("wrote", OUT_COMBAT, os.path.getsize(OUT_COMBAT) // 1024, "KB")
    names = ",\n".join(f'  {n}: {{ row: {r}, frames: {FRAMES} }} /* {d} */' for r, (n, _, d, _) in enumerate(COMBAT_SPRITES))
    ts = f'''// Generated by art/fx/build_pack.py: do not edit (change the COMBAT_SPRITES list there and rebuild).
/** The combat pack (specs/classes/design-sheet.md §1.7): heat in RGB, coverage in A; the shader maps heat through the effect's ramp. */
export const COMBAT_PACK_URL = "/assets/fx/combat-pack.webp";
export const COMBAT_PACK_COLS = {FRAMES};
export const COMBAT_PACK_ROWS = {rows};
export const COMBAT_PACK = {{
{names},
}} as const;
export type CombatSprite = keyof typeof COMBAT_PACK;
'''
    open(OUT_COMBAT_TS, "w").write(ts)
    print("wrote", OUT_COMBAT_TS)
    write_combat_sheet(atlas)


def ramp(heat, core, mid, edge):
    """Heat to colour as the engine maps it: edge to mid over [0, 0.5], mid to core over [0.5, 1]."""
    h = heat[..., None]
    lo = edge + (mid - edge) * np.clip(h / 0.5, 0, 1)
    hi = mid + (core - mid) * np.clip((h - 0.5) / 0.5, 0, 1)
    return np.where(h < 0.5, lo, hi)


def write_combat_sheet(atlas):
    """Every row, all 8 frames, through three sample ramps over a dark ground (smoke and crack also over grass)."""
    label_w, pad, gap = 200, 4, 18
    strips = [(r, DARK) for r in range(len(COMBAT_SPRITES))]
    for name in ("smoke", "crack"):
        r = [n for n, *_ in COMBAT_SPRITES].index(name)
        strips.insert(strips.index((r, DARK)) + 1, (r, GRASS))
    group = FRAMES * (CELL + pad)
    W = label_w + len(SHEET_RAMPS) * (group + gap)
    H = 58 + len(strips) * (CELL + pad) + pad
    sheet = Image.new("RGB", (W, H), (11, 14, 20))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 13)
        small = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 11)
    except OSError:
        font = small = ImageFont.load_default()
    draw.text((pad, 8), "Combat pack (K0): painted by art/fx/build_pack.py, heat mapped through each ramp as in game, 8 frames per row", fill=(241, 255, 255), font=font)
    for g, (rname, *stops) in enumerate(SHEET_RAMPS):
        x0 = label_w + g * (group + gap)
        draw.text((x0, 34), f"{rname} ramp  core {stops[0]}  mid {stops[1]}  edge {stops[2]}", fill=(255, 209, 102), font=small)
    for s, (r, ground) in enumerate(strips):
        name, _, desc, glow = COMBAT_SPRITES[r]
        y = 58 + s * (CELL + pad)
        draw.text((pad, y + 36), name + ("" if ground == DARK else " (grass)"), fill=(255, 209, 102), font=font)
        draw.text((pad, y + 56), desc[:27], fill=(201, 209, 214), font=small)
        if len(desc) > 27:
            draw.text((pad, y + 70), desc[27:54], fill=(201, 209, 214), font=small)
        draw.text((pad, y + 90), "additive" if glow else "alpha", fill=(140, 150, 160), font=small)
        bg = hexrgb(ground)
        for g, (_, core, mid, edge) in enumerate(SHEET_RAMPS):
            stops = [hexrgb(c) for c in (core, mid, edge)]
            x0 = label_w + g * (group + gap)
            for i in range(FRAMES):
                cell = atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL]
                a, rgb = cell[..., 3:4], ramp(cell[..., 0], *stops)
                out = np.clip(bg + rgb * a, 0, 1) if glow else bg * (1 - a) + rgb * a
                sheet.paste(Image.fromarray((out * 255 + 0.5).astype(np.uint8)), (x0 + i * (CELL + pad), y))
    os.makedirs(os.path.dirname(OUT_COMBAT_SHEET), exist_ok=True)
    sheet.save(OUT_COMBAT_SHEET, "WEBP", quality=90, method=6)
    print("wrote", OUT_COMBAT_SHEET, sheet.size)


if __name__ == "__main__":
    build()
    build_combat()
