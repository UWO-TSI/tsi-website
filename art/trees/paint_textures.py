"""The village greenery's painted textures (game/remodel-trees): leaf clusters, blossom, needles, bark and petals.

David, 2026-10-16: trees and plants are leaf cards with a real painted leaf texture over a closed volume, and every
texture is our own (never one from the web). So each one is painted here, stroke by stroke, from seeded shapes:

  - a leaf is a pointed oval with a curved midrib, lit on one half and shaded on the other, lighter toward its tip,
    with a pale midrib, faint side veins and a darker painted rim; each casts a soft shadow on the leaves under it, and
    the leaves are laid back to front, so a cluster reads as a little clump in its own light;
  - a blossom is five rounded petals round a pink eye with pale stamens; needles are thin tapered strokes on twigs;
    bark is vertical fibres and furrows; petals are soft gradients with fine veins;
  - over everything, a slow value and hue drift (a painted wash), so no two leaves are the same colour.

Painted at four times the size and filtered down; the transparent texels carry their neighbours' colour, so the
cut-out edge never shows a dark or light halo once mipmapped.

The cosy autumn palette (the closed bushes' rust and amber, the seasonal palette's leaf tints): summer is warm
greens, autumn rust, amber, gold and a little olive, spring cherry pinks over fresh green, winter cold dark greens
under snow. Writes art/trees/textures/<name>.png:

  leaves-<season>.png   512 x 512: three cluster cards (cells 0-2, cut out) and a dense opaque leaf mass (cell 3,
                        top half) over packed snow (cell 3, bottom half); season = summer, autumn, blossom, winter
                        (winter's cell 2 is a cluster with snow on its upper leaves)
  needles[-snow].png    512 x 512: three fir sprays (cells 0-2, cut out) and a dense needle mass over snow (cell 3)
  bark.png, bark-cedar.png  128 x 256, tiling
  petals.png            512 x 512, the flowers' petals, stems and leaves (art/trees/build_flowers.py)

  python3 art/trees/paint_textures.py [name ...]
"""
import colorsys, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, distance_transform_edt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "textures")
SS = 4  # supersampling


# ================================================================ colour and canvas
def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def jitter(c, rng, dh=0.02, ds=0.06, dv=0.06):
    h, s, v = colorsys.rgb_to_hsv(*c)
    h = (h + rng.uniform(-dh, dh)) % 1
    s = min(1, max(0, s * (1 + rng.uniform(-ds, ds))))
    v = min(1, max(0, v * (1 + rng.uniform(-dv, dv))))
    return np.array(colorsys.hsv_to_rgb(h, s, v))


def warm(c, k):
    """Lean a colour toward warm light (k > 0) or cool shade (k < 0)."""
    tgt = hexc("#fff1c2") if k > 0 else hexc("#24304a")
    return c + (tgt - c) * abs(k)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def wash(h, w, seed, cells=(5, 14), amps=(1.0, 0.5), wrap=False):
    """A slow random field in [-1, 1] (a painted wash): a few random cells across, smoothly blown up. wrap: tiles."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w))
    for n, a in zip(cells, amps):
        g = rng.standard_normal((n, max(1, round(n * w / h))))
        f = gaussian_filter(np.kron(g, np.ones((8, 8))), sigma=4, mode="wrap" if wrap else "reflect")
        f = np.asarray(Image.fromarray(f.astype(np.float32), "F").resize((w, h), Image.BICUBIC))
        out += a * f / (f.std() + 1e-9)
    return np.clip(out / 2.2, -1, 1)


class Canvas:
    """A premultiplied-free RGBA float canvas."""

    def __init__(self, w, h, bg=None):
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3))
        self.a = np.zeros((h, w))
        if bg is not None:
            self.rgb[:] = bg
            self.a[:] = 1

    def shade_under(self, mask, x0, y0, k):
        """Darken what is already painted under `mask` (a float array placed at x0, y0) by up to k."""
        h, w = mask.shape
        xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x0 + w, self.w), min(y0 + h, self.h)
        if xa >= xb or ya >= yb:
            return
        m = mask[ya - y0:yb - y0, xa - x0:xb - x0]
        self.rgb[ya:yb, xa:xb] *= (1 - k * m)[..., None]

    def put(self, rgb, cov, x0, y0):
        """Paint rgb (h, w, 3) with coverage cov (h, w) at x0, y0, over what is there."""
        h, w = cov.shape
        xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x0 + w, self.w), min(y0 + h, self.h)
        if xa >= xb or ya >= yb:
            return
        c = cov[ya - y0:yb - y0, xa - x0:xb - x0][..., None]
        self.rgb[ya:yb, xa:xb] = self.rgb[ya:yb, xa:xb] * (1 - c) + rgb[ya - y0:yb - y0, xa - x0:xb - x0] * c
        self.a[ya:yb, xa:xb] = self.a[ya:yb, xa:xb] * (1 - c[..., 0]) + c[..., 0]


def finish(cv, size, wash_amp=0.06, seed=0, pad=True, wrap=False):
    """Painted wash, filter down by SS, bleed colour into the transparent texels; returns uint8 RGBA (size)."""
    wsh = wash(cv.h, cv.w, seed, wrap=wrap)
    rgb = np.clip(cv.rgb * (1 + wash_amp * wsh)[..., None], 0, 1)
    a = np.clip(cv.a, 0, 1)
    pre = np.dstack([rgb * a[..., None], a])
    im = Image.fromarray((pre * 255).round().astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)
    arr = np.asarray(im).astype(np.float64) / 255
    a = arr[..., 3]
    rgb = np.where(a[..., None] > 1e-3, arr[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    rgb = np.clip(rgb, 0, 1)
    if pad:
        # Colour bleed: each transparent texel takes the colour of the nearest painted one.
        solid = a > 0.5
        if solid.any() and not solid.all():
            _, (iy, ix) = distance_transform_edt(~solid, return_indices=True)
            rgb = np.where(solid[..., None], rgb, rgb[iy, ix])
    return np.dstack([rgb, a])


def to_u8(arr):
    return (np.clip(arr, 0, 1) * 255).round().astype(np.uint8)


# ================================================================ a leaf
def leaf_outline(L, W, n=16, belly=0.72, bend=0.0, asym=0.0, tip=1.0):
    """Leaf-local outline: base at (0, 0), tip at (bend*L, L); x across, y along. Returns (points, width(t), mid(t))."""
    def width(t):
        t = np.clip(t, 0, 1)
        return W * np.sin(np.pi * t ** belly) ** (0.85 * tip)

    def mid(t):
        return bend * L * t * t

    right, left = [], []
    for i in range(n + 1):
        t = i / n
        w = float(width(t))
        y = t * L
        right.append((mid(t) + w * (1 + asym), y))
        left.append((mid(t) - w * (1 - asym), y))
    return right + left[::-1], width, mid


def paint_leaf(cv, x, y, ang, L, W, colour, rng, light=(-0.6, -0.8), bend=0.0, rim=0.8, vein=True, shadow=0.28,
               belly=0.72, lit=0.12, dark=0.16, rib=0.1, tip=1.0):
    """One leaf at canvas (x, y) (its base), pointing at angle `ang` (radians, 0 = up the canvas), length L, half width W."""
    pts, width, mid = leaf_outline(L, W, bend=bend, asym=rng.uniform(-0.08, 0.08), belly=belly, tip=tip)
    ca, sa = math.cos(ang), math.sin(ang)
    # leaf (x across, y along) -> canvas: along = (sin, -cos) so ang 0 points up (canvas y down)
    def tf(px, py):
        return x + px * ca + py * sa, y + px * sa - py * ca
    poly = [tf(px, py) for px, py in pts]
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    m = int(max(L, W) * 0.25) + 4
    x0, y0, x1, y1 = int(min(xs)) - m, int(min(ys)) - m, int(max(xs)) + m + 1, int(max(ys)) + m + 1
    bw, bh = x1 - x0, y1 - y0
    im = Image.new("L", (bw, bh), 0)
    ImageDraw.Draw(im).polygon([(px - x0, py - y0) for px, py in poly], fill=255)
    cov = np.asarray(im).astype(np.float64) / 255
    if shadow > 0:
        sh = np.asarray(im.filter(ImageFilter.GaussianBlur(max(2, W * 0.35)))).astype(np.float64) / 255
        off = int(W * 0.25)
        sh = np.roll(np.roll(sh, off, axis=0), off // 2, axis=1)
        cv.shade_under(sh, x0, y0, shadow)
    # leaf-local coordinates of every texel
    gy, gx = np.mgrid[y0:y1, x0:x1].astype(np.float64) + 0.5
    rx, ry = gx - x, gy - y
    along = rx * sa - ry * ca
    across = rx * ca + ry * sa
    t = along / L
    s = across - mid(np.clip(t, 0, 1))
    w = np.maximum(width(t), 1e-3)
    u = s / w
    # light: which half faces it (in leaf space)
    lx = light[0] * ca + light[1] * sa
    side = np.tanh(-u * 2.5) * np.sign(lx if abs(lx) > 0.05 else 1)
    val = 1 + lit * np.clip(side, 0, 1) - dark * np.clip(-side, 0, 1)
    val *= 0.86 + 0.2 * smoothstep(0.0, 0.9, t)
    if vein:
        v = np.cos(2 * np.pi * (t * 5.5 - np.abs(u) * 0.55))
        val *= 1 + 0.05 * smoothstep(0.85, 1.0, v) * (np.abs(u) < 0.85) * (t > 0.08) * (t < 0.9)
    ribm = (np.abs(s) < max(1.2, W * 0.05)) * (t > 0.02) * (t < 0.88)
    rgb = np.ones(cov.shape + (3,)) * colour
    hi = warm(colour, 0.25)
    sd = warm(colour, -0.18)
    k = np.clip(side, -1, 1)[..., None]
    rgb = np.where(k > 0, rgb + (hi - rgb) * k * 0.6, rgb + (sd - rgb) * (-k) * 0.6)
    rgb = rgb * val[..., None]
    rgb = np.where(ribm[..., None], rgb + (warm(colour, 0.35) - rgb) * rib * 4, rgb)
    # painted rim: darker toward the edge
    inner = np.asarray(im.filter(ImageFilter.MinFilter(5 if SS >= 4 else 3))).astype(np.float64) / 255
    edge = np.clip(cov - inner, 0, 1)
    rgb = rgb * (1 - (1 - rim) * edge)[..., None]
    cv.put(np.clip(rgb, 0, 1), cov, x0, y0)


# ================================================================ blossom
def paint_blossom(cv, x, y, R, petal, eye, rng, light=(-0.6, -0.8), shadow=0.25, petals=5):
    """A five-petal blossom of radius R at (x, y)."""
    rot = rng.uniform(0, math.tau)
    if shadow:
        m = int(R * 1.6)
        im = Image.new("L", (2 * m, 2 * m), 0)
        ImageDraw.Draw(im).ellipse([m - R, m - R, m + R, m + R], fill=255)
        sh = np.asarray(im.filter(ImageFilter.GaussianBlur(R * 0.25))).astype(np.float64) / 255
        cv.shade_under(np.roll(np.roll(sh, int(R * 0.22), 0), int(R * 0.12), 1), int(x) - m, int(y) - m, shadow)
    for i in range(petals):
        a = rot + i * math.tau / petals + rng.uniform(-0.12, 0.12)
        col = jitter(petal, rng, 0.01, 0.08, 0.05)
        # a petal is a short, broad leaf with a notched tip: base at the eye
        paint_leaf(cv, x + math.sin(a) * R * 0.1, y - math.cos(a) * R * 0.1, a, R * rng.uniform(0.92, 1.05), R * 0.46, col, rng,
                   light, bend=0.0, rim=0.86, vein=False, shadow=0.0, belly=0.6, lit=0.1, dark=0.12, rib=0.0, tip=0.45)
        # the notch: a little shaded nick at the tip
        tx, ty = x + math.sin(a) * R * 0.98, y - math.cos(a) * R * 0.98
        r = max(1.5, R * 0.07)
        n = int(2 * r + 4)
        im = Image.new("L", (n, n), 0)
        ImageDraw.Draw(im).ellipse([2, 2, 2 + 2 * r, 2 + 2 * r], fill=255)
        cv.shade_under(np.asarray(im).astype(np.float64) / 255 * 0.6, int(tx - r - 2), int(ty - r - 2), 0.35)
    # the eye: a pink-red blush with pale stamens
    m = int(R * 0.5)
    gy, gx = np.mgrid[-m:m + 1, -m:m + 1].astype(np.float64)
    d = np.hypot(gx, gy) / (R * 0.42)
    cov = np.clip(1 - d, 0, 1) ** 0.6
    rgb = np.ones(cov.shape + (3,)) * eye
    cv.put(rgb, cov * 0.85, int(x) - m, int(y) - m)
    for i in range(7):
        a = rot + i * math.tau / 7 + rng.uniform(-0.2, 0.2)
        rr = R * rng.uniform(0.18, 0.3)
        sx, sy = x + math.sin(a) * rr, y - math.cos(a) * rr
        r = max(1.2, R * 0.06)
        gy, gx = np.mgrid[-3:4, -3:4].astype(np.float64) * (r / 2.5)
        cov = np.clip(1.2 - np.hypot(gx, gy) / r, 0, 1)
        cv.put(np.ones(cov.shape + (3,)) * hexc("#fff3c4"), cov, int(sx) - 3, int(sy) - 3)


# ================================================================ needles
def paint_twig(cv, pts, width, colour):
    im = Image.new("L", (cv.w, cv.h), 0)
    ImageDraw.Draw(im).line(pts, fill=255, width=max(1, int(width)), joint="curve")
    cov = np.asarray(im).astype(np.float64) / 255
    rgb = np.ones((cv.h, cv.w, 3)) * colour
    cv.put(rgb, cov, 0, 0)


def paint_needles_along(cv, pts, rng, colours, nlen, spacing, angle=0.75, width=None, droop=0.0):
    """Needles on both sides of a polyline twig, angled toward its tip."""
    width = width or max(2, nlen * 0.17)
    im_layers = []
    segs = list(zip(pts[:-1], pts[1:]))
    total = sum(math.dist(a, b) for a, b in segs)
    n = int(total / spacing)
    for i in range(n):
        f = (i + rng.uniform(0, 0.6)) / max(n, 1)
        # point and direction at fraction f
        d = f * total
        for a, b in segs:
            l = math.dist(a, b)
            if d <= l:
                px, py = a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l
                dx, dy = (b[0] - a[0]) / l, (b[1] - a[1]) / l
                break
            d -= l
        taper = 0.55 + 0.45 * math.sin(math.pi * min(1, f * 1.1 + 0.05))
        for side in (-1, 1):
            ang = side * (angle + rng.uniform(-0.15, 0.15))
            ca, sa = math.cos(ang), math.sin(ang)
            nx, ny = dx * ca - dy * sa, dx * sa + dy * ca
            ny += droop
            L = nlen * taper * rng.uniform(0.8, 1.1)
            ex, ey = px + nx * L, py + ny * L
            col = jitter(colours[rng.randrange(len(colours))], rng, 0.015, 0.08, 0.1)
            # brighter toward the tip: two strokes
            im_layers.append(((px, py, ex, ey), width, col))
    for (x0, y0, x1, y1), w, col in im_layers:
        bx0, by0 = int(min(x0, x1) - w - 2), int(min(y0, y1) - w - 2)
        bx1, by1 = int(max(x0, x1) + w + 3), int(max(y0, y1) + w + 3)
        im = Image.new("L", (bx1 - bx0, by1 - by0), 0)
        dr = ImageDraw.Draw(im)
        # a tapered needle: thick at the base, thin at the tip
        steps = 4
        for k in range(steps):
            t0, t1 = k / steps, (k + 1) / steps
            dr.line([(x0 + (x1 - x0) * t0 - bx0, y0 + (y1 - y0) * t0 - by0), (x0 + (x1 - x0) * t1 - bx0, y0 + (y1 - y0) * t1 - by0)],
                    fill=255, width=max(1, int(w * (1 - 0.6 * t0))))
        cov = np.asarray(im).astype(np.float64) / 255
        gy, gx = np.mgrid[by0:by1, bx0:bx1].astype(np.float64)
        L = max(math.hypot(x1 - x0, y1 - y0), 1)
        t = ((gx - x0) * (x1 - x0) + (gy - y0) * (y1 - y0)) / (L * L)
        rgb = np.ones(cov.shape + (3,)) * col
        rgb = rgb * (0.78 + 0.34 * np.clip(t, 0, 1))[..., None]
        cv.put(np.clip(rgb, 0, 1), cov, bx0, by0)


def paint_spray(cv, cx, base_y, tip_y, half, rng, colours, twig, nlen, side_angle=0.95, snow=None, n_side=9):
    """A fir spray, lush like a feather: a main twig up the cell, side twigs in pairs, dense needles on all of them,
    the lower layer darker (it lies under the top one)."""
    L = base_y - tip_y
    main = [(cx + math.sin(k / 8 * 2.2) * half * 0.04, base_y - L * k / 8) for k in range(9)]
    sides = []
    for i in range(n_side):
        f = 0.1 + 0.82 * i / n_side
        px, py = cx, base_y - L * f
        for side in (-1, 1):
            ln = half * (1.0 - 0.62 * f) * rng.uniform(0.85, 1.05)
            a = side * side_angle * rng.uniform(0.9, 1.08)
            ex, ey = px + math.sin(a) * ln, py - math.cos(a) * ln
            mx, my = (px + ex) / 2 + side * ln * 0.05, (py + ey) / 2 - ln * 0.06
            sides.append([(px, py - side * L * 0.015), (mx, my), (ex, ey)])
    dim = [c * 0.7 for c in colours]
    for s in sides:
        paint_needles_along(cv, s, rng, dim, nlen * 0.9, nlen * 0.2, angle=0.95)
    for s in sides:
        paint_twig(cv, s, nlen * 0.09, twig)
        paint_needles_along(cv, s, rng, colours, nlen * 0.8, nlen * 0.2, angle=0.7)
    paint_needles_along(cv, main, rng, dim, nlen * 1.1, nlen * 0.2, angle=0.9)
    paint_twig(cv, main, nlen * 0.13, twig)
    paint_needles_along(cv, main, rng, colours, nlen * 0.9, nlen * 0.2, angle=0.55)
    if snow is not None:
        # snow lies in a soft ridge along the main twig and in short ridges on the inner half of some side twigs
        paint_snow_ridge(cv, [(x + rng.uniform(-0.15, 0.15) * nlen, y) for x, y in main[1:8]], nlen * 0.3, rng, snow)
        for s in sides:
            if rng.random() < 0.55:
                (ax, ay), (bx, by) = s[0], s[1]
                f = rng.uniform(0.3, 0.9)
                paint_snow_lump(cv, ax + (bx - ax) * f, ay + (by - ay) * f - nlen * 0.1, nlen * rng.uniform(0.18, 0.34), rng, snow)


def paint_snow_ridge(cv, pts, width, rng, snow):
    """A soft ridge of snow along a polyline: wavy edges, white along its crest, cool where it rounds off."""
    segs = list(zip(pts[:-1], pts[1:]))
    left, right = [], []
    n = 6 * len(segs)
    for i in range(n + 1):
        f = i / n
        k = min(int(f * len(segs)), len(segs) - 1)
        (ax, ay), (bx, by) = segs[k]
        g = f * len(segs) - k
        x, y = ax + (bx - ax) * g, ay + (by - ay) * g
        l = math.hypot(bx - ax, by - ay) or 1
        nx, ny = -(by - ay) / l, (bx - ax) / l
        w = width * (0.35 + 0.65 * math.sin(math.pi * min(1, max(0, f))) ** 0.6) * rng.uniform(0.8, 1.15)
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    poly = left + right[::-1]
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    m = int(width) + 4
    x0, y0, x1, y1 = int(min(xs)) - m, int(min(ys)) - m, int(max(xs)) + m, int(max(ys)) + m
    im = Image.new("L", (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(im).polygon([(px - x0, py - y0) for px, py in poly], fill=255)
    cov = np.asarray(im.filter(ImageFilter.GaussianBlur(max(1, width * 0.08)))).astype(np.float64) / 255
    crest = np.asarray(im.filter(ImageFilter.GaussianBlur(width * 0.45))).astype(np.float64) / 255
    rgb = np.ones(cov.shape + (3,)) * snow
    edge = np.clip(1 - crest * 1.15, 0, 1)
    rgb = rgb + (hexc("#b3c4dc") - rgb) * (0.6 * edge)[..., None]
    cv.put(np.clip(rgb, 0, 1), np.clip(cov * 1.2, 0, 1), x0, y0)


def paint_snow_lump(cv, x, y, R, rng, snow):
    """A soft lump of snow: white, cool-shaded at its lower edge."""
    m = int(R * 1.4) + 2
    gy, gx = np.mgrid[-m:m + 1, -m:m + 1].astype(np.float64)
    sx, sy = 1.25, 0.8
    d = np.hypot(gx / (R * sx), gy / (R * sy))
    cov = np.clip((1 - d) * 4, 0, 1)
    shade = np.clip(gy / (R * sy), -1, 1)
    rgb = np.ones(cov.shape + (3,)) * snow
    rgb = rgb * (1 - 0.16 * np.clip(shade, 0, 1))[..., None] + (hexc("#b9cbe2") - rgb) * (0.35 * np.clip(shade, 0, 1))[..., None]
    cv.put(np.clip(rgb, 0, 1), cov, int(x) - m, int(y) - m)


# ================================================================ cells
CELL = 256  # final cell size in an atlas


def leaf_cluster(rng, palette, n=19, size=CELL, light=(-0.6, -0.8), lsize=(0.33, 0.45), snow=None, bend=0.3):
    """A loose clump of leaves: each at a random spot in a round patch, turned outward and a little down (they hang),
    back ones first and darker, front ones lighter and nearer the middle. The tips make its lobed outline."""
    S = size * SS
    cv = Canvas(S, S)
    c = S / 2
    leaves = []
    for i in range(n):
        depth = i / n  # 0 back .. 1 front
        rr = math.sqrt(rng.random()) * S * (0.27 - 0.13 * depth)
        a = rng.uniform(0, math.tau)
        px, py = c + math.cos(a) * rr, c + math.sin(a) * rr * 0.92
        out = math.atan2(px - c, -(py - c)) if rr > S * 0.02 else rng.uniform(0, math.tau)
        # lean toward hanging down (angle pi), more for the leaves already pointing sideways
        down = math.pi if math.sin(out) >= 0 else -math.pi
        ang = out + (down - out) * 0.22 + rng.uniform(-0.85, 0.85)
        L = S * rng.uniform(*lsize) * (1.05 - 0.12 * depth)
        # its middle on the spot, its tip inside the cell
        L = min(L, max(S * 0.12, 2 * (S * 0.47 - rr)))
        W = L * rng.uniform(0.3, 0.38)
        bx, by = px - math.sin(ang) * L * 0.5, py + math.cos(ang) * L * 0.5
        col = palette(rng, depth) * (0.62 + 0.42 * depth)
        leaves.append((bx, by, ang, L, W, col))
    for bx, by, ang, L, W, col in leaves:
        paint_leaf(cv, bx, by, ang, L, W, col, rng, light=light, bend=rng.uniform(-bend, bend))
    if snow is not None:
        paint_snow_cap(cv, rng, snow, S)
    return cv


def paint_snow_cap(cv, rng, snow, S):
    """Snow settled along the clump's upper outline (the card's up is the world's up on a crown's upper side): a soft,
    wavy band under the top edge of every column, thicker in the middle, and a few small patches lower down."""
    solid = cv.a > 0.5
    has = solid.any(axis=0)
    top = np.where(has, solid.argmax(axis=0), S)
    xs = np.arange(S)
    wob = gaussian_filter(np.random.default_rng(rng.randrange(1 << 30)).standard_normal(S), S * 0.02, mode="wrap")
    wob /= np.abs(wob).max() + 1e-9
    thick = S * (0.05 + 0.035 * np.cos(np.clip((xs - S / 2) / (S * 0.45), -1, 1) * math.pi / 2) + 0.025 * wob)
    gy = np.arange(S)[:, None]
    depth_in = (gy - top[None, :]) / np.maximum(thick[None, :], 1)
    band = np.clip(1 - depth_in, 0, 1) * (depth_in >= -0.02) * solid * (top[None, :] < S * 0.62)
    band = np.clip(band * 3, 0, 1)
    shade = np.clip(depth_in, 0, 1)
    rgb = np.ones((S, S, 3)) * snow
    rgb = rgb + (hexc("#b7c8de") - rgb) * (0.55 * shade ** 2)[..., None]
    soft = gaussian_filter(band, SS * 0.6) * gaussian_filter(solid.astype(np.float64), SS * 0.8) ** 0.5
    cv.put(rgb, np.clip(soft * 1.3, 0, 1), 0, 0)


def leaf_mass(rng, palette, w=CELL, h=CELL // 2, n=46, light=(-0.6, -0.8), bg=None):
    """Dense leaves filling the whole cell (opaque): the inside of a crown, seen through the gaps."""
    S, H = w * SS, h * SS
    cv = Canvas(S, H, bg=palette(rng, 0.0) * 0.6 if bg is None else bg)
    for i in range(n):
        depth = i / n
        L = S * rng.uniform(0.16, 0.22)
        bx, by = rng.uniform(-0.05, 1.05) * S, rng.uniform(-0.05, 1.05) * H
        col = palette(rng, depth) * (0.75 + 0.3 * depth)
        paint_leaf(cv, bx, by, rng.uniform(0, math.tau), L, L * 0.34, col, rng, light=light, bend=rng.uniform(-0.25, 0.25))
    cv.a[:] = 1
    return cv


def snow_field(rng, w=CELL, h=CELL // 2, snow=hexc("#f4f7fb")):
    """Packed snow: soft lumps over a cool shade (opaque)."""
    S, H = w * SS, h * SS
    cv = Canvas(S, H, bg=hexc("#cfdbe9"))
    for i in range(140):
        paint_snow_lump(cv, rng.uniform(0, S), rng.uniform(0, H), S * rng.uniform(0.04, 0.08), rng, snow)
    cv.a[:] = 1
    return cv


def blossom_cluster(rng, size=CELL, n=24, light=(-0.6, -0.8)):
    """A clump of cherry blossom with a few fresh leaves behind."""
    S = size * SS
    cv = Canvas(S, S)
    c = S / 2
    for i in range(8):
        a = rng.uniform(0, math.tau)
        L = S * rng.uniform(0.24, 0.32)
        paint_leaf(cv, c + math.cos(a) * S * 0.1, c + math.sin(a) * S * 0.1, a + math.pi / 2 + rng.uniform(-0.5, 0.5), L, L * 0.33,
                   jitter(hexc("#7fae4c"), rng) * 0.85, rng, light=light, bend=rng.uniform(-0.2, 0.2))
    petals = [hexc("#f4b3c7"), hexc("#ec97b3"), hexc("#f7c9d7"), hexc("#fadbe4"), hexc("#e584a5")]
    for i in range(n):
        depth = i / n
        r = S * (0.33 - 0.2 * depth) * math.sqrt(rng.uniform(0.05, 1))
        a = rng.uniform(0, math.tau)
        x, y = c + math.cos(a) * r, c + math.sin(a) * r * 0.92
        R = S * rng.uniform(0.095, 0.125)
        col = petals[rng.randrange(len(petals))] * (0.82 + 0.2 * depth)
        paint_blossom(cv, x, y, R, col, hexc("#d9628a") * (0.85 + 0.15 * depth), rng, light)
    return cv


def needle_spray(rng, colours, twig, size=CELL, snow=None):
    S = size * SS
    cv = Canvas(S, S)
    paint_spray(cv, S / 2, S * 0.97, S * 0.06, S * 0.44, rng, colours, twig, S * 0.11, snow=snow)
    return cv


def needle_mass(rng, colours, twig, w=CELL, h=CELL // 2):
    """Rows of sprays filling the cell (opaque): the inside of a tier, seen through the gaps."""
    S, H = w * SS, h * SS
    cv = Canvas(S, H, bg=colours[3] * 0.6)
    for row in range(3):
        for k in range(5):
            x = (k + 0.5 * (row % 2) + rng.uniform(-0.1, 0.1)) / 4.5 * S
            base = H * (0.45 + 0.4 * row) + rng.uniform(-0.05, 0.05) * H
            shade = [c * (0.75 + 0.12 * row) for c in colours]
            paint_spray(cv, x, base, base - H * 0.75, H * 0.38, rng, shade, twig, H * 0.075, n_side=5)
    cv.a[:] = 1
    return cv


# ================================================================ the dump's look, painted afresh
# David, 2026-10-17: "recreate the leaf texture from the dump". Studied (never copied, traced or resampled) from the
# ACNH oak, cherry and cedar atlases: an oak card is ONE big three-lobed leaf clump (a centre lobe and two side lobes
# meeting at a pointed base), airbrushed: darker at the base, lighter toward the lobes, a soft light rim along the top
# edges, a faint Y of veins, a little grain, and each card its own value (the dump's nine cells run from near black to
# white under one tint). A cherry card is one big five-petal blossom with notched petals, deep pink at its eye fading
# to pale tips. A cedar card is a fringe: a strip whose lower edge hangs in rounded fingers, fine vertical grain, the
# tips catching the light. Painted here from those observations, in colour per season.

def soft_edge(mask, S):
    """Distance inside a mask (0 at the edge) as a fraction of S, and how much each edge texel faces up (+1) or down."""
    d = distance_transform_edt(mask > 0.5) / S
    g = gaussian_filter(mask, S * 0.012)
    gy = np.gradient(g, axis=0)
    up = np.clip(gy / (np.abs(gy).max() + 1e-9) * 3, -1, 1)
    return d, up


def grain(shape, rng, sigma=1.2, amp=0.05):
    g = gaussian_filter(np.random.default_rng(rng.randrange(1 << 30)).standard_normal(shape), sigma)
    return 1 + amp * g / (g.std() + 1e-9)


def poly_mask(S, poly):
    im = Image.new("L", (S, S), 0)
    ImageDraw.Draw(im).polygon(poly, fill=255)
    return np.asarray(im).astype(np.float64) / 255


def lobe(S, bx, by, ang, L, W, belly=0.5, tip=0.62):
    pts, _, _ = leaf_outline(L, W, n=28, belly=belly, tip=tip)
    ca, sa = math.cos(ang), math.sin(ang)
    return [(bx + px * ca + py * sa, by + px * sa - py * ca) for px, py in pts]


def catmull(points, n=10):
    """A closed Catmull-Rom curve through points."""
    out = []
    m = len(points)
    for i in range(m):
        p0, p1, p2, p3 = points[i - 1], points[i], points[(i + 1) % m], points[(i + 2) % m]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    return out


# The clump's outline, right half (cell units, y down), from the base up to the top of the centre lobe: the base
# point, the long lower edge, the side lobe bulging out to its tip at the upper corner, back in over its top to the
# notch, and up over the centre lobe. The left half mirrors it.
CLUMP = [(0.5, 0.97), (0.67, 0.8), (0.87, 0.62), (0.975, 0.45), (0.995, 0.27), (0.95, 0.12), (0.8, 0.085), (0.675, 0.15),
         (0.6, 0.06), (0.5, 0.04)]
TIPS = [4, 9]   # the side lobe's tip and the centre top
NOTCH = 7


def trefoil(rng, colour, size=128, frost=False, snow=None):
    """One three-lobed leaf clump filling a card (cut out), airbrushed in `colour`."""
    S = size * SS
    right = [(x + rng.uniform(-0.015, 0.015), y + rng.uniform(-0.015, 0.015)) for x, y in CLUMP[1:-1]]
    left = [(1 - x + rng.uniform(-0.015, 0.015), y + rng.uniform(-0.015, 0.015)) for x, y in CLUMP[1:-1]][::-1]
    top = (0.5 + rng.uniform(-0.02, 0.02), CLUMP[-1][1] + rng.uniform(-0.01, 0.01))
    pts = [CLUMP[0]] + right + [top] + left
    poly = [(x * S, y * S) for x, y in catmull(pts, 12)]
    union = poly_mask(S, poly)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    bx, by = CLUMP[0][0] * S, CLUMP[0][1] * S
    dB = np.hypot(xx - bx, yy - by) / S
    val = 0.66 + 0.46 * smoothstep(0.04, 0.8, dB)
    val *= 0.93 + 0.1 * (1 - yy / S)
    d, up = soft_edge(union, S)
    rim = 1 - smoothstep(0.0, 0.05, d)
    val += rim * (0.17 * np.clip(up, 0, 1) - 0.05 * np.clip(-up, 0, 1))
    # the veins: a faint Y from the base out to each lobe's tip
    vein = np.zeros_like(val)
    tips = [right[TIPS[0] - 1], top, left[len(left) - TIPS[0]]]
    for tx, ty in tips:
        vx, vy = tx * S - bx, ty * S - by
        L = math.hypot(vx, vy)
        t = ((xx - bx) * vx + (yy - by) * vy) / (L * L)
        off = np.abs((xx - bx) * vy - (yy - by) * vx) / L
        vein = np.maximum(vein, np.exp(-(off / (S * 0.008)) ** 2) * smoothstep(0.03, 0.12, t) * (1 - smoothstep(0.5, 0.85, t)))
    val *= 1 - 0.09 * vein
    # a soft fold of shade from each notch in toward the middle, so the clump reads as three leaves
    crease = np.zeros_like(val)
    for nx, ny in (right[NOTCH - 1], left[len(left) - NOTCH]):
        cx, cy = 0.5 * S, 0.5 * S
        vx, vy = cx - nx * S, cy - ny * S
        L = math.hypot(vx, vy)
        t = ((xx - nx * S) * vx + (yy - ny * S) * vy) / (L * L)
        off = np.abs((xx - nx * S) * vy - (yy - ny * S) * vx) / L
        crease = np.maximum(crease, np.exp(-(off / (S * 0.04)) ** 2) * np.clip(1 - t, 0, 1) * (t > -0.05))
    val *= 1 - 0.18 * crease
    val *= grain(val.shape, rng, sigma=SS * 0.9, amp=0.02)
    base = np.ones((S, S, 3)) * colour
    hi, lo = warm(colour, 0.22), warm(colour, -0.2)
    k = np.clip((val - 0.85) / 0.35, -1, 1)[..., None]
    rgb = np.where(k > 0, base + (hi - base) * k, base + (lo - base) * (-k)) * np.clip(val, 0.5, 1.3)[..., None]
    if frost:
        # the snow oak's frost: a pale rim and a frosted face over the leaf
        f = (rim * 0.75 + 0.25 * smoothstep(0.15, 0.6, dB))[..., None]
        rgb = rgb + (hexc("#eef3f2") - rgb) * f * 0.6
    cv = Canvas(S, S)
    cv.put(np.clip(rgb, 0, 1), union, 0, 0)
    if snow is not None:
        paint_snow_cap(cv, rng, snow, S)
    return cv


def sakura(rng, petal, eye, size=128):
    """One five-petal cherry blossom filling a card: notched rounded petals, deep at the eye, pale at the tips."""
    S = size * SS
    c = S / 2
    rot = rng.uniform(0, math.tau)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    union = np.zeros((S, S))
    rgb = np.zeros((S, S, 3))
    for i in range(5):
        a = rot + i * math.tau / 5 + rng.uniform(-0.06, 0.06)
        R = S * rng.uniform(0.44, 0.48)
        m = poly_mask(S, lobe(S, c, c, a, R, R * 0.48, belly=0.62, tip=0.35))
        # the notch: a small V bitten from the tip
        tx, ty = c + math.sin(a) * R, c - math.cos(a) * R
        nb = poly_mask(S, [(tx + math.cos(a) * R * 0.09, ty + math.sin(a) * R * 0.09), (tx - math.cos(a) * R * 0.09, ty - math.sin(a) * R * 0.09),
                           (c + math.sin(a) * R * 0.86, c - math.cos(a) * R * 0.86)])
        m = np.clip(m - nb, 0, 1)
        new = m * (1 - union)
        t = np.hypot(xx - c, yy - c) / R
        col = jitter(petal, rng, 0.008, 0.05, 0.03)
        deep = col + (eye - col) * 0.7
        k = (1 - smoothstep(0.0, 0.75, t))[..., None]
        prgb = col + (deep - col) * k
        prgb = prgb + (hexc("#fff8fa") - prgb) * (smoothstep(0.65, 1.0, t) * 0.55)[..., None]
        rgb = rgb * (1 - new[..., None]) + prgb * new[..., None]
        union = np.maximum(union, m)
    d, up = soft_edge(union, S)
    rim = 1 - smoothstep(0.0, 0.03, d)
    rgb = rgb + (hexc("#ffffff") - rgb) * (rim * 0.35 * np.clip(up + 0.4, 0, 1))[..., None]
    # petal seams: a faint line between petals, out from the eye
    ang = np.arctan2(xx - c, -(yy - c)) - rot
    seam = np.exp(-((((ang / (math.tau / 5)) + 0.5) % 1 - 0.5) * 8) ** 2) * smoothstep(0.05, 0.5, np.hypot(xx - c, yy - c) / S)
    rgb = rgb * (1 - 0.12 * seam)[..., None]
    rgb *= grain((S, S), rng, sigma=SS * 0.5, amp=0.025)[..., None]
    cv = Canvas(S, S)
    cv.put(np.clip(rgb, 0, 1), union, 0, 0)
    # the eye: stamens
    for i in range(9):
        a = rot + i * math.tau / 9 + rng.uniform(-0.15, 0.15)
        r = S * rng.uniform(0.09, 0.14)
        x, y = c + math.sin(a) * r, c - math.cos(a) * r
        line = Image.new("L", (S, S), 0)
        ImageDraw.Draw(line).line([(c, c), (x, y)], fill=255, width=max(2, int(S * 0.008)))
        cv.put(np.ones((S, S, 3)) * (eye * 0.8), np.asarray(line).astype(np.float64) / 255 * 0.8, 0, 0)
        paint_snow_lump(cv, x, y, S * 0.018, rng, hexc("#ffe08a"))
    return cv


def fringe(rng, colour, size=128, snow=None):
    """A cedar fringe: a strip hanging in rounded fingers, darker at its top (inside the tier), lighter down the
    fingers, fine vertical grain; with snow, frosted white over its top half, the green showing at the tips."""
    S = size * SS
    n = rng.choice([4, 5, 5, 6])
    x0, x1 = S * 0.04, S * 0.96
    w = (x1 - x0) / n
    top = S * 0.03
    poly = [(x0, top)]
    for i in range(n):
        L = S * rng.uniform(0.84, 0.95)
        cx = x0 + (i + 0.5) * w
        hw = w * 0.5 * rng.uniform(0.9, 1.0)
        fl = min(L * 0.32, hw * 2.2)  # the rounded finger's own length
        poly += [(cx - hw, top + L - fl)]
        for k in range(11):
            a = math.pi * k / 10
            poly.append((cx - math.cos(a) * hw, top + L - fl + math.sin(a) * fl))
        poly += [(cx + hw, top + L - fl)]
    poly.append((x1, top))
    mask = poly_mask(S, poly)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    t = (yy - top) / (S * 0.9)
    val = 0.62 + 0.5 * smoothstep(0.0, 0.95, t)
    # the creases between fingers, running up into the strip
    phase = ((xx - x0) / w) % 1
    crease = np.exp(-((phase - 0.0) * 9) ** 2) + np.exp(-((phase - 1.0) * 9) ** 2)
    val *= 1 - 0.18 * crease * smoothstep(0.5, 0.8, t)
    # needles: fine vertical streaks
    streak = gaussian_filter(np.random.default_rng(rng.randrange(1 << 30)).standard_normal((S, S)), (SS * 6, SS * 0.45))
    val *= 1 + 0.09 * streak / (streak.std() + 1e-9)
    d, up = soft_edge(mask, S)
    rim = 1 - smoothstep(0.0, 0.04, d)
    val += rim * 0.1 * (t > 0.5)
    base = np.ones((S, S, 3)) * colour
    k = np.clip((val - 0.85) / 0.35, -1, 1)[..., None]
    rgb = np.where(k > 0, base + (warm(colour, 0.25) - base) * k, base + (warm(colour, -0.25) - base) * (-k))
    if snow is not None:
        f = (1 - smoothstep(0.35, 0.75, t + 0.08 * np.sin(xx / w * math.pi * 2)))
        frost = hexc("#e9eff3") * (0.9 + 0.1 * streak[..., None] / (streak.std() + 1e-9) * 0.5)
        rgb = rgb + (frost - rgb) * (f * 0.92)[..., None]
    cv = Canvas(S, S)
    cv.put(np.clip(rgb, 0, 1), mask, 0, 0)
    return cv


def mass_of(painter, colours, rng, w=CELL, h=CELL // 2, n=30, bg=None):
    """Cards of the same paint overlapping all over (opaque): the inside of a crown or tier."""
    S, H = w * SS, h * SS
    cv = Canvas(S, H, bg=(colours[0] * 0.55) if bg is None else bg)
    for i in range(n):
        card = painter(rng, colours[rng.randrange(len(colours))] * (0.7 + 0.3 * i / n), 64)
        im = finish(card, (int(S * rng.uniform(0.28, 0.4)),) * 2, wash_amp=0, pad=False)
        sz = im.shape[0]
        x, y = int(rng.uniform(-0.1, 1.0) * S), int(rng.uniform(-0.2, 1.0) * H)
        cv.put(im[..., :3], im[..., 3], x, y)
    cv.a[:] = 1
    return cv


GRID = 128  # an atlas card cell: 4 across, 3 down; the bottom 128 px row holds the mass (left) and the snow (right)


def atlas(cards, mass, snow, seed):
    """512 x 512: twelve card cells (4 x 3, 128 px, row by row from the top left), then the mass and the snow."""
    out = np.zeros((4 * GRID, 4 * GRID, 4))
    for i, cv in enumerate(cards):
        x, y = (i % 4) * GRID, (i // 4) * GRID
        out[y:y + GRID, x:x + GRID] = finish(cv, (GRID, GRID), wash_amp=0.03, seed=seed + i)
    out[3 * GRID:, :2 * GRID] = finish(mass, (2 * GRID, GRID), seed=seed + 20, pad=False)
    out[3 * GRID:, 2 * GRID:] = finish(snow, (2 * GRID, GRID), seed=seed + 21, pad=False)
    return out


# ================================================================ palettes (a card each, light to dark like the dump's cells)
SUMMER = ["#3f7838", "#4b853b", "#59913e", "#679c42", "#76a748", "#86b350", "#4a7d45", "#5f9a4a", "#7aa83f", "#93bb55", "#558a36", "#6b9e3c"]
AUTUMN = ["#b4472a", "#c85d2a", "#d9772e", "#e39434", "#e8b03f", "#9b3a26", "#c99a3a", "#a9552b", "#e6c057", "#8d8634", "#d0662b", "#b93d30"]
WINTER = ["#7f9e92", "#8eab9e", "#9cb8ab", "#6f8f84", "#86a598", "#a7c1b5", "#7a988a", "#93b0a3"]
BLOSSOM = [("#fbe3ea", "#f08aa9"), ("#f9d3df", "#ea7a9c"), ("#f6c1d1", "#e06890"), ("#fde9ef", "#f29bb5"), ("#f4b5c8", "#d95f88")]
NEEDLE = ["#3a6b3e", "#447744", "#4f8249", "#36603b", "#5a8c4d", "#3f7042"]


def leaves(season, seed=11):
    rng = random.Random(seed)
    snow = hexc("#f6f8fc")
    if season == "blossom":
        cards = [sakura(rng, hexc(BLOSSOM[i % len(BLOSSOM)][0]), hexc(BLOSSOM[i % len(BLOSSOM)][1])) for i in range(10)]
        cards += [trefoil(rng, hexc(c)) for c in ("#7fb24e", "#93c15a")]
        mass = mass_of(lambda r, c, s: sakura(r, c, c * 0.8, s), [hexc(p) for p, _ in BLOSSOM], rng, bg=hexc("#8a6a6a"))
    elif season == "winter":
        cards = [trefoil(rng, hexc(WINTER[i % len(WINTER)]), frost=True) for i in range(8)]
        cards += [trefoil(rng, hexc(WINTER[i]), frost=True, snow=snow) for i in range(4)]
        mass = mass_of(lambda r, c, s: trefoil(r, c, s, frost=True), [hexc(c) for c in WINTER], rng)
    else:
        table = SUMMER if season == "summer" else AUTUMN
        cards = [trefoil(rng, hexc(c)) for c in table]
        mass = mass_of(lambda r, c, s: trefoil(r, c, s), [hexc(c) for c in table], rng)
    return atlas(cards, mass, snow_field(rng), seed)


def needles(snow=False, seed=23):
    rng = random.Random(seed)
    s = hexc("#f6f8fc") if snow else None
    cards = [fringe(rng, hexc(NEEDLE[i % len(NEEDLE)]), snow=s) for i in range(12)]
    mass = mass_of(lambda r, c, sz: fringe(r, c, sz, snow=s), [hexc(c) for c in NEEDLE], rng, bg=hexc(NEEDLE[3]) * 0.6)
    return atlas(cards, mass, snow_field(rng), seed)


# ================================================================ petals (art/trees/build_flowers.py)
def petal_width(shape, t):
    """Half width (of the cell) of a petal or leaf `shape` at t (0 base .. 1 tip)."""
    t = np.clip(t, 0, 1)
    if shape == "wedge":      # cosmos: a fan widening to a toothed tip
        return 0.38 * (0.18 + 0.82 * t ** 0.55) * (1 - smoothstep(0.93, 1.0, t) * 0.0)
    if shape == "spoon":      # mum: narrow, widest near the tip
        return 0.2 * np.sin(np.pi * t ** 1.25) ** 0.55
    if shape == "round":      # rose, windflower, pansy
        return 0.45 * np.sin(np.pi * t ** 0.72) ** 0.5
    if shape == "tulip":
        return 0.36 * np.sin(np.pi * t ** 0.62) ** 0.62
    if shape == "lance":      # lily
        return 0.22 * np.sin(np.pi * t ** 0.7) ** 0.75
    if shape == "leaf":
        return 0.3 * np.sin(np.pi * t ** 0.8) ** 0.85
    if shape == "strap":
        return 0.15 * (1 - t ** 4) ** 0.5 * (0.5 + 0.5 * smoothstep(0.0, 0.08, t))
    raise KeyError(shape)


def petal(rng, shape, colour, deep, tip=None, size=128, veins=0.07, spots=0, face=None, teeth=0):
    """One petal (or leaf) in its cell: base at the bottom middle, tip at the top; deep at its base, its own colour
    through the middle, pale toward the tip, fine veins out from the base, a light rim."""
    S = size * SS
    tip = warm(colour, 0.35) if tip is None else tip
    n = 60
    right, left = [], []
    for i in range(n + 1):
        t = i / n
        w = float(petal_width(shape, t)) * S
        y = S * (0.97 - 0.94 * t)
        right.append((S / 2 + w, y))
        left.append((S / 2 - w, y))
    if teeth:
        # the tip cut into teeth: replace the top edge with a zigzag between the outermost points
        top_y = S * 0.03
        xr, xl = right[-1][0], left[-1][0]
        zig = []
        for k in range(2 * teeth + 1):
            x = xr + (xl - xr) * k / (2 * teeth)
            zig.append((x, top_y + (0 if k % 2 == 0 else S * 0.07)))
        poly = right + zig + left[::-1]
    else:
        poly = right + left[::-1]
    mask = poly_mask(S, poly)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    t = (S * 0.97 - yy) / (S * 0.94)
    u = (xx - S / 2) / np.maximum(petal_width(shape, t) * S, 1)
    k1 = smoothstep(0.0, 0.45, t)[..., None]
    k2 = smoothstep(0.55, 1.0, t)[..., None]
    rgb = deep + (colour - deep) * k1
    rgb = rgb + (tip - rgb) * k2 * 0.8
    # veins: faint lines fanning from the base
    ang = np.arctan2(xx - S / 2, (S * 0.97 - yy) + 1e-6)
    v = np.cos(ang * 22) * smoothstep(0.08, 0.3, t) * (1 - smoothstep(0.75, 0.98, t))
    rgb = rgb * (1 - veins * smoothstep(0.6, 1.0, v))[..., None]
    # a soft fold down the middle and a lighter rim
    rgb = rgb * (1 - 0.06 * np.exp(-(u / 0.12) ** 2) * (t < 0.85))[..., None]
    d, up = soft_edge(mask, S)
    rim = 1 - smoothstep(0.0, 0.035, d)
    rgb = rgb + (warm(tip, 0.3) - rgb) * (rim * 0.35)[..., None]
    for k in range(spots):
        sx, sy = S / 2 + rng.uniform(-0.12, 0.12) * S, S * rng.uniform(0.45, 0.8)
        r = S * rng.uniform(0.012, 0.022)
        sm = np.clip(1.2 - np.hypot(xx - sx, yy - sy) / r, 0, 1)
        rgb = rgb + (hexc("#7a2b1c") - rgb) * (sm * 0.85)[..., None]
    if face is not None:
        # the pansy's face: a dark blotch spreading from the base, rays into it, a gold eye at the base
        blotch = (1 - smoothstep(0.25, 0.62, t + 0.25 * np.abs(u))) * (t > 0)
        rgb = rgb + (face - rgb) * (blotch * 0.92)[..., None]
        eye = np.clip(1.3 - np.hypot(xx - S / 2, yy - S * 0.9) / (S * 0.07), 0, 1)
        rgb = rgb + (hexc("#f2c33a") - rgb) * eye[..., None]
    rgb *= grain((S, S), rng, sigma=SS * 0.6, amp=0.02)[..., None]
    cv = Canvas(S, S)
    cv.put(np.clip(rgb, 0, 1), mask, 0, 0)
    return cv


def floret(rng, colour, deep, size=128, points=6):
    """The hyacinth's floret: a small star of six pointed petals, curled back, a deep throat."""
    S = size * SS
    c = S / 2
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    union = np.zeros((S, S))
    rot = rng.uniform(0, math.tau)
    for i in range(points):
        a = rot + i * math.tau / points
        union = np.maximum(union, poly_mask(S, lobe(S, c, c, a, S * 0.46, S * 0.17, belly=0.5, tip=1.0)))
    r = np.hypot(xx - c, yy - c) / (S * 0.46)
    rgb = deep + (colour - deep) * smoothstep(0.05, 0.5, r)[..., None]
    rgb = rgb + (warm(colour, 0.3) - rgb) * smoothstep(0.6, 1.0, r)[..., None] * 0.6
    cv = Canvas(S, S)
    cv.put(np.clip(rgb, 0, 1), union, 0, 0)
    return cv


def centres(rng, size=128):
    """Four opaque discs in the quarters: a yellow disc of florets, a dark eye with pale stamens, a green-gold button,
    a deep red bud (quarters as flower_cells.CENTRES)."""
    S = size * SS
    h = S // 2
    cv = Canvas(S, S, bg=hexc("#000000"))
    yy, xx = np.mgrid[0:h, 0:h].astype(np.float64)
    def dots(base, dot, n, rr=0.05):
        rgb = np.ones((h, h, 3)) * base
        for k in range(n):
            x, y = rng.uniform(0, h), rng.uniform(0, h)
            m = np.clip(1.3 - np.hypot(xx - x, yy - y) / (h * rr), 0, 1)
            rgb = rgb + (dot - rgb) * m[..., None]
        return rgb * grain((h, h), rng, SS * 0.5, 0.04)[..., None]
    cv.rgb[:h, :h] = dots(hexc("#e8b830"), hexc("#b77a18"), 70)
    cv.rgb[:h, h:] = dots(hexc("#2b2440"), hexc("#d9d2e8"), 30, 0.035)
    cv.rgb[h:, :h] = dots(hexc("#a8b04a"), hexc("#d8c25a"), 50)
    cv.rgb[h:, h:] = dots(hexc("#8e1d2a"), hexc("#c23a46"), 40, 0.08)
    cv.a[:] = 1
    return cv


def petals_atlas(seed=31):
    rng = random.Random(seed)
    H = hexc
    paint = {
        "cosmos-pink": lambda: petal(rng, "wedge", H("#ea7fb0"), H("#c2477f"), H("#f8c8de"), teeth=2),
        "cosmos-white": lambda: petal(rng, "wedge", H("#f6eef2"), H("#e6b3c8"), H("#ffffff"), teeth=2),
        "mum-rust": lambda: petal(rng, "spoon", H("#d06a2c"), H("#8f3420"), H("#f0a24a"), veins=0.03),
        "mum-gold": lambda: petal(rng, "spoon", H("#e8b03c"), H("#b8702a"), H("#f8d878"), veins=0.03),
        "rose-red": lambda: petal(rng, "round", H("#c42c3c"), H("#7e1626"), H("#e86070"), veins=0.04),
        "centres": lambda: centres(rng),
        "windflower-white": lambda: petal(rng, "round", H("#f4f0f2"), H("#c9b8d8"), H("#ffffff"), veins=0.05),
        "windflower-violet": lambda: petal(rng, "round", H("#8a5ab8"), H("#4e2c7a"), H("#c4a2e2"), veins=0.06),
        "tulip-red": lambda: petal(rng, "tulip", H("#e04a3c"), H("#a42a26"), H("#f48a6a"), veins=0.04),
        "tulip-butter": lambda: petal(rng, "tulip", H("#f2d050"), H("#d8a030"), H("#fbeaa0"), veins=0.04),
        "pansy-violet": lambda: petal(rng, "round", H("#7a4cb0"), H("#4a2a7a"), H("#a888d8"), veins=0.05),
        "pansy-face": lambda: petal(rng, "round", H("#f0c840"), H("#d8a028"), H("#f8e080"), veins=0.05, face=H("#3a2350")),
        "lily-cream": lambda: petal(rng, "lance", H("#fbf2e0"), H("#f0b860"), H("#ffffff"), veins=0.05, spots=9),
        "hyacinth-floret": lambda: floret(rng, H("#8c88e0"), H("#4e48a8")),
        "leaf": lambda: petal(rng, "leaf", H("#5f9a46"), H("#3e6e34"), H("#86b85a"), veins=0.08),
        "strap-leaf": lambda: petal(rng, "strap", H("#5a9448"), H("#3a6a34"), H("#7eb05a"), veins=0.03),
    }
    import flower_cells
    out = np.zeros((512, 512, 4))
    for i, name in enumerate(flower_cells.CELLS):
        x, y = (i % 4) * 128, (i // 4) * 128
        out[y:y + 128, x:x + 128] = finish(paint[name](), (128, 128), wash_amp=0.02, seed=seed + i, pad=name != "centres")
    return out


def bark(base="#7a5337", dark="#4e3322", light="#a07650", seed=5, w=128, h=256):
    """Tiling bark: vertical fibres, darker furrows, a lighter ridge on each plate's lit side."""
    rng = np.random.default_rng(seed)
    W, H = w * SS, h * SS
    x = np.arange(W) / W
    y = np.arange(H) / H
    X, Y = np.meshgrid(x, y)
    # furrows: wavy vertical lines (whole periods across and down, so it tiles)
    f = np.zeros_like(X)
    for k, amp in ((5, 1.0), (9, 0.5), (17, 0.25)):
        ph = rng.uniform(0, math.tau)
        wob = 0.03 * np.sin(math.tau * (2 * Y + rng.uniform(0, 1))) + 0.015 * np.sin(math.tau * (5 * Y + rng.uniform(0, 1)))
        f += amp * np.cos(math.tau * k * (X + wob) + ph)
    f /= 1.75
    fib = gaussian_filter(rng.standard_normal((H, W)), sigma=(SS * 6, SS * 0.8), mode="wrap")
    fib /= fib.std() + 1e-9
    plates = gaussian_filter(rng.standard_normal((H, W)), sigma=(SS * 10, SS * 4), mode="wrap")
    plates /= plates.std() + 1e-9
    v = 0.5 + 0.35 * f + 0.08 * fib + 0.08 * plates
    v = np.clip(v, 0, 1)
    b, d, l = hexc(base), hexc(dark), hexc(light)
    rgb = np.where(v[..., None] < 0.5, d + (b - d) * (v[..., None] / 0.5), b + (l - b) * ((v[..., None] - 0.5) / 0.5))
    # ridge light on the plates' left (lit) side
    ridge = np.clip(np.roll(f, -SS * 2, axis=1) - f, 0, 1)
    rgb = rgb + (l - rgb) * (0.35 * ridge)[..., None]
    cv = Canvas(W, H)
    cv.rgb, cv.a = rgb, np.ones((H, W))
    return finish(cv, (w, h), wash_amp=0.05, seed=seed, pad=False, wrap=True)


def save(name, arr):
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(to_u8(arr), "RGBA" if arr.shape[2] == 4 else "RGB").save(os.path.join(OUT, name + ".png"), optimize=True)
    print("painted", name, arr.shape[1], "x", arr.shape[0])


JOBS = {
    "leaves-summer": lambda: leaves("summer", 11),
    "leaves-autumn": lambda: leaves("autumn", 12),
    "leaves-blossom": lambda: leaves("blossom", 13),
    "leaves-winter": lambda: leaves("winter", 14),
    "needles": lambda: needles(False, 23),
    "needles-snow": lambda: needles(True, 24),
    "bark": lambda: bark(),
    "bark-cedar": lambda: bark("#6a4130", "#3f271c", "#8f6048", seed=9),
    "petals": lambda: petals_atlas(),
}


def main():
    names = [a for a in sys.argv[1:] if a in JOBS] or list(JOBS)
    for n in names:
        save(n, JOBS[n]())


if __name__ == "__main__":
    main()
