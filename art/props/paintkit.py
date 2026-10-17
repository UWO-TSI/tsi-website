"""More painted surfaces and our own drawn lettering for the quick-win props (game/remodel-quick), on propkit's numpy
helpers: cork, wooden shingles, striped canvas, paper, wicker, worn iron, and a brush-stroke alphabet (no font files, no
downloads, no references). Every function returns an [h, w, 3] float sRGB array (row 0 at the top), seeded: a rebuild
paints the same texture.

Lettering is drawn in the surface's own units (a face W wide and H tall, x right and y up from its bottom-left corner),
so strokes keep their shape however the face maps onto the image.
"""
import math
import numpy as np
import propkit as K
from propkit import TAU, arr, smooth, noise, fbm, grid


# ================================================================ strokes
def _catmull(pts, k=6):
    """A smooth curve through the points (Catmull-Rom, k steps a span); a single point stays a dot."""
    P = np.asarray(pts, dtype=float)
    if len(P) < 3:
        if len(P) == 2:
            t = np.linspace(0, 1, k * 2)[:, None]
            return P[0] * (1 - t) + P[1] * t
        return P
    Q = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    out = []
    for i in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
        for t in np.linspace(0, 1, k, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return np.array(out)


def arc(cx, cy, rx, ry, a0, a1, n=10):
    """Points on an ellipse arc, degrees counter-clockwise from +x (a1 < a0 runs clockwise)."""
    return [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))) for a in np.linspace(a0, a1, n)]


def face_grid(h, w, W, H):
    """Pixel centres in face units: X right, Y up (row 0 is the face's top)."""
    U, V = grid(h, w)
    return U * W, (1 - V) * H


def strokes_alpha(h, w, W, H, strokes, radius, seed=0, rough=0.18, taper=0.35, smooth_curves=True):
    """Coverage of brush strokes (polylines in face units) of `radius`, edges a little ragged (`rough` of the radius),
    thinning toward each stroke's ends by `taper`, with dry-brush streaks along the paint. A one-point stroke is a dab."""
    X, Y = face_grid(h, w, W, H)
    px = W / w
    rng = np.random.default_rng(seed)
    edge = (noise(h, w, max(4, int(w / 9)), seed + 1) - 0.5) * 2
    out = np.zeros((h, w))
    for s in strokes:
        P = _catmull(s) if smooth_curves else np.asarray(s, dtype=float)
        if len(P) == 1:
            P = np.vstack([P, P + 1e-6])
        seglen = np.hypot(*(P[1:] - P[:-1]).T)
        L = np.concatenate([[0], np.cumsum(seglen)])
        total = max(L[-1], 1e-6)
        pad = radius * 1.6
        x0, x1 = P[:, 0].min() - pad, P[:, 0].max() + pad
        y0, y1 = P[:, 1].min() - pad, P[:, 1].max() + pad
        c0, c1 = max(0, int(x0 / W * w)), min(w, int(math.ceil(x1 / W * w)) + 1)
        r0, r1 = max(0, int((1 - y1 / H) * h)), min(h, int(math.ceil((1 - y0 / H) * h)) + 1)
        if c0 >= c1 or r0 >= r1:
            continue
        x, y = X[r0:r1, c0:c1], Y[r0:r1, c0:c1]
        best = np.full(x.shape, 1e9)
        along = np.zeros(x.shape)
        for i in range(len(P) - 1):
            a, b = P[i], P[i + 1]
            d = b - a
            ll = max(d @ d, 1e-12)
            t = np.clip(((x - a[0]) * d[0] + (y - a[1]) * d[1]) / ll, 0, 1)
            dist = np.hypot(x - (a[0] + d[0] * t), y - (a[1] + d[1] * t))
            m = dist < best
            best = np.where(m, dist, best)
            along = np.where(m, (L[i] + t * seglen[i]) / total, along)
        ends = np.minimum(along, 1 - along) * total / max(radius * 2.5, 1e-6)
        rr = radius * (1 - taper * (1 - np.clip(ends, 0, 1))) * rng.uniform(0.94, 1.06)
        dd = best + edge[r0:r1, c0:c1] * radius * rough
        a = smooth(rr + px * 0.9, rr - px * 0.9, dd)
        out[r0:r1, c0:c1] = np.maximum(out[r0:r1, c0:c1], a)
    streak = 0.82 + 0.18 * noise(h, w, max(8, w // 6), seed + 7, max(4, h // 24))
    return np.clip(out * streak, 0, 1)


def fill_poly(h, w, W, H, poly):
    """Inside of a closed polygon (face units), even-odd, anti-aliased by supersampling 2x2."""
    P = np.asarray(poly, dtype=float)
    acc = np.zeros((h, w))
    for ox, oy in ((-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)):
        U, V = grid(h, w)
        X = (U + ox / w) * W
        Y = (1 - V - oy / h) * H
        inside = np.zeros((h, w), dtype=bool)
        for i in range(len(P)):
            (xa, ya), (xb, yb) = P[i], P[(i + 1) % len(P)]
            cond = (ya > Y) != (yb > Y)
            xint = xa + (Y - ya) * (xb - xa) / np.where(yb - ya == 0, 1e-12, yb - ya)
            inside ^= cond & (X < xint)
        acc += inside
    return acc / 4


def paint(base, alpha, color, wet=0.9):
    """Lay paint of `color` over `base` where alpha covers it (wet: how opaque a full stroke is)."""
    a = np.clip(alpha * wet, 0, 1)[..., None]
    c = arr(color) if isinstance(color, str) else np.asarray(color)
    return base * (1 - a) + c * a


# ================================================================ lettering: our own brush capitals (cap height 1)
def _glyphs():
    g = {}
    g["C"] = (0.92, [arc(0.5, 0.5, 0.44, 0.5, 48, 312, 14)])
    g["L"] = (0.7, [[(0.13, 1), (0.13, 0.0), (0.64, 0.0)]])
    g["U"] = (0.88, [[(0.13, 1), (0.13, 0.4)] + arc(0.43, 0.38, 0.3, 0.38, 180, 360, 9)[1:] + [(0.73, 1)]])
    g["B"] = (0.84, [[(0.13, 0), (0.13, 1)], [(0.13, 1), (0.42, 1)] + arc(0.42, 0.765, 0.24, 0.235, 90, -90, 8)[1:] + [(0.13, 0.53)],
                     [(0.13, 0.53), (0.46, 0.53)] + arc(0.46, 0.265, 0.27, 0.265, 90, -90, 8)[1:] + [(0.13, 0.0)]])
    g["M"] = (1.0, [[(0.1, 0), (0.15, 1), (0.49, 0.3), (0.83, 1), (0.88, 0)]])
    g["O"] = (1.0, [arc(0.5, 0.5, 0.42, 0.5, 90, 452, 18)])
    g["N"] = (0.86, [[(0.13, 0), (0.13, 1), (0.71, 0), (0.71, 1)]])
    g["E"] = (0.74, [[(0.64, 1), (0.13, 1), (0.13, 0), (0.64, 0)], [(0.13, 0.52), (0.54, 0.52)]])
    g["T"] = (0.82, [[(0.04, 1), (0.78, 1)], [(0.41, 1), (0.41, 0)]])
    g["I"] = (0.34, [[(0.15, 1), (0.15, 0)]])
    g["G"] = (1.0, [arc(0.5, 0.5, 0.44, 0.5, 46, 350, 14) + [(0.94, 0.46), (0.6, 0.46)]])
    g["S"] = (0.86, [[(0.75, 0.85), (0.57, 0.99), (0.31, 0.98), (0.14, 0.84), (0.18, 0.65), (0.43, 0.53), (0.67, 0.43),
                      (0.79, 0.25), (0.67, 0.05), (0.41, 0.0), (0.12, 0.13)]])
    g[":"] = (0.36, [[(0.16, 0.66)], [(0.16, 0.12)]])
    g[" "] = (0.42, [])
    return g


GLYPHS = _glyphs()


def text_strokes(text, cx, y, cap, seed=0, track=0.06, wobble=0.035, lean=0.0):
    """Strokes for `text` centred on cx with its baseline at y, capitals `cap` tall: each letter a touch off its line
    and turned a hair (hand-lettered), its strokes wandering a little."""
    rng = np.random.default_rng(seed)
    width = sum(GLYPHS[c][0] for c in text) * cap + track * cap * (len(text) - 1)
    x = cx - width / 2
    out = []
    for ch in text:
        adv, strokes = GLYPHS[ch]
        rot = rng.uniform(-0.035, 0.035)
        dy = rng.uniform(-0.03, 0.03) * cap
        sc = cap * rng.uniform(0.97, 1.03)
        c, s = math.cos(rot), math.sin(rot)
        for st in strokes:
            pts = []
            for i, (gx, gy) in enumerate(st):
                gx += lean * gy
                wx = gx * sc + rng.normal(0, wobble * 0.35) * cap
                wy = gy * sc + rng.normal(0, wobble * 0.35) * cap
                pts.append((x + wx * c - wy * s, y + dy + wx * s + wy * c))
            out.append(pts)
        x += adv * cap + track * cap
    return out


# ================================================================ surfaces
def cork(h, w, seed, tone="#c28d58"):
    """Cork board: warm granules, lighter and darker flecks, a few pores and old pin holes."""
    r = np.random.default_rng(seed)
    base = 0.92 + 0.12 * (fbm(h, w, 5, seed, 3) - 0.5)
    g1 = noise(h, w, max(8, w // 5), seed + 1)
    g2 = noise(h, w, max(8, w // 3), seed + 2)
    val = base + 0.12 * (smooth(0.55, 0.8, g1) - 0.3) - 0.14 * smooth(0.62, 0.86, g2)
    out = val[..., None] * arr(tone)
    light = smooth(0.7, 0.9, noise(h, w, max(8, w // 4), seed + 3))
    out = out * (1 - 0.25 * light[..., None]) + arr("#e2bf8e") * 0.25 * light[..., None]
    pores = smooth(0.84, 0.93, noise(h, w, max(8, w // 6), seed + 4))
    out *= (1 - 0.3 * pores)[..., None]
    U, V = grid(h, w)
    for _ in range(int(h * w / 2600)):
        u, v = r.random(), r.random()
        d = np.hypot((U - u) * w, (V - v) * h)
        out *= (1 - 0.55 * smooth(1.6, 0.4, d))[..., None]
    return np.clip(out, 0, 1)


def shingles(h, w, seed, rows=6, cols=4, tone="#ffffff"):
    """Wooden shingles in staggered courses: rows run across u, each course lapping the one below it (v runs down the
    roof), the shadow line under every lap, thin gaps between shingles, each shingle its own tone and grain, the odd
    one cut short or split. Mid grey-white: the part's COLOR_0 gives the wood's colour. Tileable."""
    r = np.random.default_rng(seed)
    U, V = grid(h, w)
    row = np.floor(V * rows).astype(int)
    t = V * rows - row                                   # 0 at the course's top (under the lap) to 1 at its butt
    shift = (row % 2) * 0.5 + (row % 3) * 0.13
    cu = U * cols + shift
    col = np.floor(cu).astype(int) % cols
    s = cu - np.floor(cu)
    ids = (row % rows) * 97 + col
    tones = r.uniform(0.82, 1.06, rows * 97 + cols)
    short = r.uniform(0.0, 0.12, rows * 97 + cols) * (r.random(rows * 97 + cols) < 0.35)
    split = (r.random(rows * 97 + cols) < 0.18) * r.uniform(0.25, 0.75, rows * 97 + cols)
    grainv = 0.5 + 0.5 * np.sin(TAU * (s * 9 + 2.3 * noise(h, w, cols * 3, seed + 1, rows * 2) + ids * 0.37))
    fine = noise(h, w, cols * 24, seed + 2, rows * 3)
    val = tones[ids] * (0.9 + 0.07 * (grainv - 0.5) + 0.06 * (fine - 0.5))
    val -= 0.38 * smooth(0.22, 0.0, t)                     # the lap's shadow at the top of each course
    butt = 1 - short[ids]
    val -= 0.45 * smooth(butt - 0.05, butt, t) * smooth(1.0, 0.98, t + 0.0)  # the short ones show the course below
    gap = smooth(0.03, 0.0, np.minimum(s, 1 - s))
    val -= 0.42 * gap
    crack = (split[ids] > 0) * smooth(0.012, 0.0, np.abs(s - split[ids])) * smooth(0.45, 0.9, t)
    val -= 0.35 * crack
    val += 0.08 * smooth(0.7, 1.0, t)                      # worn, sun-bleached butts
    out = np.clip(val, 0, 1.1)[..., None] * arr(tone)
    lichen = smooth(0.72, 0.84, fbm(h, w, 6, seed + 3, 3)) * smooth(0.3, 0.9, t)
    out = out * (1 - 0.35 * lichen[..., None]) + arr("#b9b48a") * 0.35 * lichen[..., None]
    return np.clip(out, 0, 1)


def canvas(h, w, seed, stripes=("#c8714a", "#efe0c2"), n=8, fade=0.35, along_u=True):
    """Striped canvas: `n` stripes across u (cycling `stripes`), a coarse basket weave, sun-faded in soft patches,
    the stripe edges a little uneven. Tileable."""
    U, V = grid(h, w)
    wob = 0.004 * (noise(h, w, 6, seed + 5, 12) - 0.5)
    x = (U if along_u else V) * n + wob * n
    k = np.floor(x).astype(int) % len(stripes)
    cols = np.stack([arr(c) for c in stripes])
    out = cols[k]
    # soften the stripe seams
    f = x - np.floor(x)
    nxt = cols[(k + 1) % len(stripes)]
    prv = cols[(k - 1) % len(stripes)]
    out = out * (1 - 0.5 * smooth(0.985, 1.0, f)[..., None]) + nxt * 0.5 * smooth(0.985, 1.0, f)[..., None]
    out = out * (1 - 0.5 * smooth(0.015, 0.0, f)[..., None]) + prv * 0.5 * smooth(0.015, 0.0, f)[..., None]
    threads = max(32, w // 3)
    wu = 0.5 + 0.5 * np.sin(TAU * U * threads)
    wv = 0.5 + 0.5 * np.sin(TAU * V * threads * h / w)
    check = ((np.floor(U * threads * 0.5) + np.floor(V * threads * 0.5 * h / w)) % 2)
    weave = np.where(check > 0, wu, wv)
    slub = fbm(h, w, 8, seed, 2, 40)
    val = 0.9 + 0.1 * (weave - 0.5) + 0.06 * (slub - 0.5)
    out = out * val[..., None]
    bleach = smooth(0.35, 0.8, fbm(h, w, 3, seed + 2, 2)) * fade
    out = out * (1 - bleach[..., None]) + arr("#f1e6cf") * bleach[..., None] * val[..., None]
    soil = smooth(0.62, 0.85, fbm(h, w, 5, seed + 3, 3)) * 0.12
    out *= (1 - soil)[..., None]
    return np.clip(out, 0, 1)


def paper(h, w, seed, tone="#ffffff"):
    """Paper: a soft off-white with fibres and a little foxing."""
    base = 0.95 + 0.04 * (fbm(h, w, 4, seed, 2) - 0.5)
    fib = noise(h, w, max(16, w // 2), seed + 1, max(4, h // 8))
    val = base - 0.05 * smooth(0.7, 0.95, fib)
    out = val[..., None] * arr(tone)
    fox = smooth(0.78, 0.9, fbm(h, w, 6, seed + 2, 2))
    out = out * (1 - 0.15 * fox[..., None]) + arr("#d7b98a") * 0.15 * fox[..., None]
    return np.clip(out, 0, 1)


def wicker(h, w, seed, rows=12, stakes=10, tone="#d2a868"):
    """Woven wicker: round weavers running across u over and under upright stakes, alternate rows the other way, so a
    weaver bump and a stake segment take turns like a checker; weavers shaded round across their height with fibres
    along them, stakes round across their width with fibres up them, dark in the gaps. Tileable."""
    U, V = grid(h, w)
    row = np.floor(V * rows)
    t = V * rows - row
    su = U * stakes
    col = np.floor(su)
    s = su - col
    front = ((row + col) % 2) == 0
    tones = 0.86 + 0.18 * noise(h, w, stakes, seed + 3, rows)
    # a weaver: round across the row, pinched a little where it turns behind the stakes
    pinch = 0.8 + 0.2 * np.sin(math.pi * s)
    wa = np.abs(t - 0.5) * 2 / pinch
    weaver = np.sqrt(np.clip(1 - wa ** 2, 0, 1)) * (wa < 1)
    wfib = 0.5 + 0.5 * np.sin(TAU * (t * 3 + U * stakes * 0.0 + 6 * noise(h, w, stakes * 3, seed, rows * 2)))
    wval = (0.42 + 0.58 * weaver) * (0.93 + 0.07 * wfib)
    # a stake: a rod up the middle of the cell, round across it; beside it the weaver dips behind (shadowed)
    sa = np.abs(s - 0.5) / 0.26
    stake = np.sqrt(np.clip(1 - sa ** 2, 0, 1)) * (sa < 1)
    sfib = 0.5 + 0.5 * np.sin(TAU * (s * 2 + 5 * noise(h, w, stakes * 2, seed + 1, rows * 4)))
    sval = np.where(sa < 1, (0.5 + 0.5 * stake) * (0.92 + 0.08 * sfib) * 0.94, wval * 0.62)
    val = np.where(front, wval, sval) * tones
    val -= 0.22 * smooth(0.1, 0.0, np.minimum(t, 1 - t))
    out = np.clip(val, 0, 1)[..., None] * arr(tone)
    return np.clip(out, 0, 1)


def iron(h, w, seed, tone="#5b544c"):
    """Worn iron: dark and matte, rubbed lighter in streaks, rust blooming in patches and specks."""
    base = 0.9 + 0.14 * (fbm(h, w, 6, seed, 3) - 0.5)
    rub = smooth(0.55, 0.85, noise(h, w, 10, seed + 1, 3))
    out = (base + 0.18 * rub)[..., None] * arr(tone)
    rust = smooth(0.58, 0.78, fbm(h, w, 5, seed + 2, 3))
    specks = smooth(0.8, 0.9, noise(h, w, max(8, w // 4), seed + 3))
    r = np.clip(rust * 0.7 + specks * 0.5, 0, 1)
    out = out * (1 - r[..., None]) + arr("#8f5434") * r[..., None] * (0.85 + 0.3 * fbm(h, w, 12, seed + 4))[..., None]
    return np.clip(out, 0, 1)


def maple_poly(cx, cy, size, ang=0.0):
    """A maple leaf outline (face units): five pointed lobes, the top one tallest, small teeth between; turned by `ang`."""
    pts = []
    lobes = ((90, 1.0), (28, 0.86), (152, 0.86), (-28, 0.5), (208, 0.5))
    c, s = math.cos(ang), math.sin(ang)
    for i in range(180):
        th = TAU * i / 180
        r = 0.28
        for phi, a in lobes:
            r += a * 0.72 * max(0.0, math.cos(th - math.radians(phi))) ** 28
        r += 0.07 * max(0.0, math.cos(11 * th)) ** 8 * min(1.0, (r - 0.28) * 3)
        x, y = r * math.cos(th), r * math.sin(th)
        pts.append((cx + size * (x * c - y * s), cy + size * (x * s + y * c)))
    return pts


def maple_veins(cx, cy, size, ang=0.0):
    """The leaf's stem and its main veins, as strokes."""
    c, s = math.cos(ang), math.sin(ang)
    P = lambda x, y: (cx + size * (x * c - y * s), cy + size * (x * s + y * c))
    return [[P(0, -0.7), P(0, 0.0), P(0, 0.85)], [P(0, 0.02), P(0.72, 0.4)], [P(0, 0.02), P(-0.72, 0.4)], [P(0, -0.02), P(0.42, -0.24)], [P(0, -0.02), P(-0.42, -0.24)]]


def fish_poly(cx, cy, length, facing=1):
    """A plump fish outline (face units), head toward +x when facing is 1: body, a forked tail."""
    pts = []
    L = length
    for i in range(25):
        t = math.pi * i / 24
        pts.append((cx + facing * (L * 0.32 * math.cos(t)), cy + L * 0.2 * math.sin(t)))
    tail = [(cx - facing * L * 0.36, cy + L * 0.02), (cx - facing * L * 0.52, cy + L * 0.17), (cx - facing * L * 0.47, cy),
            (cx - facing * L * 0.52, cy - L * 0.17), (cx - facing * L * 0.36, cy - L * 0.02)]
    for i in range(25):
        t = math.pi + math.pi * i / 24
        pts.append((cx + facing * (L * 0.32 * math.cos(t)), cy + L * 0.2 * math.sin(t)))
        if i == 0:
            pts.extend(tail)
    return pts
