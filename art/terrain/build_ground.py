#!/usr/bin/env python3
"""Our own ground and water textures (lane game/remodel-ground): they replace the ACNH dump's terrain, road and water
files the grid terrain drew (web/public/assets/acnh/{terrain,road,textures}), a takedown risk before the public launch.

Every texture is painted here from seeded noise, Voronoi cells and stamped strokes (numpy, scipy, Pillow): nothing is
copied or traced, and no outside texture or reference is read. Every frequency is a whole number of periods across the
tile and every stamp wraps, so each one tiles without a seam. A rebuild writes the same files.

  python3 art/terrain/build_ground.py

Writes web/public/assets/game/terrain/ (sizes as the dump files they replace, or smaller):
  grass-albedo.png     256  near-white multiplier over the season's grass (linear, like the quilt it stands in for)
  grass-normal.png     256  blades and clumps
  sand-albedo.png      256  grain, wind ripples, a few shell bits (the beach)
  soil-albedo.png      1024 greyscale, tinted by the season's soil: packed earth, crumbs, pebbles, hairline cracks
  soil-normal.png      256  crumbs and pebbles
  brick-albedo.png     256  basket-weave pavers
  brick-normal.png     256
  fringe.png           1024x32  the grass drape's blade mask (alpha only)
  sea-ripple.png       128  the water's ripple normal (max |rg| 0.69, under the 0.704 GridOcean.test.ts assumes)
  sea-glint.png        128  the sparkle sprite's soft mask

The plaza and road stone, the cliff grain, the boardwalk planks and the snow grain stay the dump's (David, row 314,
specs/art-direction-oct17.md: "I like the old subtle version"; lib/game/groundTextures.ts KEPT_DUMP): the painters
that made ours for them are in this file's history (e9d167c0).

Normal maps are OpenGL convention (green up), unit length, blue from the reconstructed z. Mean brightness of every
texture whose brightness the shaders use as is is matched to the dump file it replaces, so a swap changes the surface
detail, not the island's exposure.
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "web", "public")
OUT = os.path.join(PUB, "assets", "game", "terrain")
DUMP_TERRAIN = os.path.join(PUB, "assets", "acnh", "terrain")
DUMP_ROAD = os.path.join(PUB, "assets", "acnh", "road")
TAU = np.pi * 2


# ================================================================ colour
def to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


LUMA = np.array([0.2126, 0.7152, 0.0722])


def mean_lin_luma(path):
    """The mean linear luminance of a texture as the GPU samples an sRGB map (the shaders' luma reads)."""
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255
    return float((to_lin(a) @ LUMA).mean())


def mean_lin_rgb(path):
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255
    return to_lin(a).reshape(-1, 3).mean(0)


def match_luma(srgb, target):
    """Scale an sRGB image in linear light until its mean linear luminance is `target`."""
    lin = to_lin(np.clip(srgb, 0, 1))
    for _ in range(8):
        lin = np.clip(lin * (target / max(1e-6, float((lin @ LUMA).mean()))), 0, 1)
    return to_srgb(lin)


def match_rgb(srgb, target):
    """Scale each channel in linear light until the image's mean linear colour is `target`."""
    lin = to_lin(np.clip(srgb, 0, 1))
    for _ in range(8):
        lin = np.clip(lin * (np.asarray(target) / np.maximum(1e-6, lin.reshape(-1, 3).mean(0))), 0, 1)
    return to_srgb(lin)


# ================================================================ tileable noise
def _k(n):
    k = np.fft.fftfreq(n) * n
    return np.meshgrid(k, k)  # KX along columns (x), KY along rows (y)


def band(n, rng, f, bw=0.55, stretch=1.0, angle=0.0):
    """Band noise around `f` cycles per tile (log-Gaussian band), unit variance. `stretch` > 1 elongates the features
    along `angle` (radians from +x). Filtering the DFT keeps it periodic: it tiles exactly."""
    KX, KY = _k(n)
    c, s = np.cos(angle), np.sin(angle)
    u, v = c * KX + s * KY, -s * KX + c * KY
    r = np.hypot(u * stretch, v)
    r[0, 0] = 1e-6
    filt = np.exp(-0.5 * (np.log(r / f) / bw) ** 2)
    filt[0, 0] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((n, n))) * filt))
    return (out - out.mean()) / (out.std() + 1e-12)


def fbm(n, rng, f0, octaves, gain=0.5, **kw):
    out, amp, tot = np.zeros((n, n)), 1.0, 0.0
    for i in range(octaves):
        if f0 * 2 ** i > n / 2:
            break
        out += amp * band(n, rng, f0 * 2 ** i, **kw)
        tot += amp * amp
        amp *= gain
    return out / np.sqrt(tot)


def blur(a, sigma):
    return ndimage.gaussian_filter(a, sigma, mode="wrap")


def downsample(a, k):
    """Box-filter by an integer factor (supersampled stamps to their final size)."""
    if a.ndim == 2:
        return a.reshape(a.shape[0] // k, k, a.shape[1] // k, k).mean(axis=(1, 3))
    return a.reshape(a.shape[0] // k, k, a.shape[1] // k, k, a.shape[2]).mean(axis=(1, 3))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ================================================================ periodic Voronoi
def poisson(n, rng, r, tries=30, k=None):
    """Blue-noise points on the torus, at least `r` apart (Bridson), as (x, y) pixel coordinates."""
    cell = r / np.sqrt(2)
    g = int(np.ceil(n / cell))
    cell = n / g
    grid = -np.ones((g, g), dtype=int)
    pts = []

    def ok(p):
        gx, gy = int(p[0] / cell), int(p[1] / cell)
        for j in range(-2, 3):
            for i in range(-2, 3):
                q = grid[(gy + j) % g, (gx + i) % g]
                if q >= 0:
                    d = np.abs(np.asarray(pts[q]) - p)
                    d = np.minimum(d, n - d)
                    if d @ d < r * r:
                        return False
        return True

    def add(p):
        grid[int(p[1] / cell) % g, int(p[0] / cell) % g] = len(pts)
        pts.append(p)

    add(rng.random(2) * n)
    active = [0]
    while active and (k is None or len(pts) < k):
        a = active[rng.integers(len(active))]
        for _ in range(tries):
            ang, rad = rng.random() * TAU, r * (1 + rng.random())
            p = (np.asarray(pts[a]) + rad * np.array([np.cos(ang), np.sin(ang)])) % n
            if ok(p):
                add(p)
                active.append(len(pts) - 1)
                break
        else:
            active.remove(a)
    return np.array(pts)


def voronoi(n, pts, dx=None, dy=None):
    """Per pixel: the nearest site's index, the distance to it, and the distance to the nearest cell edge (exact for
    the bisector with the second-nearest site), on the torus; optionally sampled through a warp."""
    tree = cKDTree(pts % n, boxsize=n)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64) + 0.5
    if dx is not None:
        xx, yy = xx + dx, yy + dy
    q = np.stack([(xx % n).ravel(), (yy % n).ravel()], 1)
    d, i = tree.query(q, k=2)
    c1, c2 = pts[i[:, 0]], pts[i[:, 1]]
    sep = c2 - c1
    sep -= n * np.round(sep / n)
    edge = (d[:, 1] ** 2 - d[:, 0] ** 2) / (2 * np.maximum(1e-6, np.hypot(sep[:, 0], sep[:, 1])))
    return i[:, 0].reshape(n, n), d[:, 0].reshape(n, n), edge.reshape(n, n)


# ================================================================ stamps (wrapping)
def region(n, x0, y0, x1, y1):
    xs = np.arange(int(np.floor(x0)), int(np.ceil(x1)) + 1)
    ys = np.arange(int(np.floor(y0)), int(np.ceil(y1)) + 1)
    return xs, ys, np.ix_(ys % n, xs % n)


def stamp_disc(field, x, y, r, value, mode="max", soft=1.0, profile="dome"):
    """A round bump (dome: a spherical cap; cone; flat) of radius r and height `value` at (x, y), wrapping; `mode` max
    keeps the higher of it and what is there, add adds it."""
    n = field.shape[0]
    xs, ys, ix = region(n, x - r - 2, y - r - 2, x + r + 2, y + r + 2)
    X, Y = np.meshgrid(xs + 0.5, ys + 0.5)
    d = np.hypot(X - x, Y - y) / r
    if profile == "dome":
        h = np.sqrt(np.clip(1 - d * d, 0, 1))
    elif profile == "cone":
        h = np.clip(1 - d, 0, 1)
    else:
        h = smoothstep(1 + soft / r, 1 - soft / r, d)
    h = h * value
    if mode == "max":
        field[ix] = np.maximum(field[ix], h)
    else:
        field[ix] += h


def segments_distance(X, Y, pts):
    """Distance from each (X, Y) to a polyline, and the curve parameter (0..1) of the nearest point."""
    best = np.full(X.shape, np.inf)
    tb = np.zeros(X.shape)
    m = len(pts) - 1
    for k in range(m):
        ax, ay = pts[k]
        bx, by = pts[k + 1]
        vx, vy = bx - ax, by - ay
        ll = vx * vx + vy * vy + 1e-9
        t = np.clip(((X - ax) * vx + (Y - ay) * vy) / ll, 0, 1)
        d = np.hypot(X - (ax + t * vx), Y - (ay + t * vy))
        sel = d < best
        best = np.where(sel, d, best)
        tb = np.where(sel, (k + t) / m, tb)
    return best, tb


# ================================================================ normals
def normal_map(h, strength):
    """Tangent-space normal (OpenGL, +green = up the image) from a height field in pixels: x = -dh/du, y = -dh/dv."""
    dhdx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dhdy_rows = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5  # down the image
    nx, ny = -dhdx * strength, dhdy_rows * strength  # v runs up the image
    nz = np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / ln, ny / ln, nz / ln], -1)


def downsample_normal(nrm, k):
    v = downsample(nrm, k)
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def encode_normal(nrm):
    return np.clip(np.round((nrm * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)


def save(name, arr, mode=None):
    os.makedirs(OUT, exist_ok=True)
    a = arr if arr.dtype == np.uint8 else np.clip(np.round(arr * 255), 0, 255).astype(np.uint8)
    im = Image.fromarray(a, mode) if mode else Image.fromarray(a)
    path = os.path.join(OUT, name)
    im.save(path, optimize=True)
    print(f"{name}: {im.size[0]}x{im.size[1]} {im.mode}, {os.path.getsize(path) // 1024} KB")
    return path


# ================================================================ grass
def grass(n=256, ss=2, seed=7):
    """Lawn: clumps of blades radiating from their roots, loose blades between them, a matted layer under both. The
    blades are drawn into a height buffer (later ones win where they lie higher), so the normal map and the albedo
    agree blade for blade; the albedo is a near-white multiplier the season's grass colour is drawn through."""
    rng = np.random.default_rng(seed)
    N = n * ss
    H = blur(fbm(N, rng, 24, 4), 1.0) * 1.2  # matted thatch under the blades
    A = 0.7 + 0.05 * blur(fbm(N, rng, 40, 3), 0.8)  # its brightness: the gaps between blades read darker
    under = np.ones((N, N, 3)) * np.array([1.04, 1.0, 0.86])  # the thatch leans warm
    col = under * A[..., None]
    comb = np.array([np.cos(TAU * 0.25), np.sin(TAU * 0.25)])

    def blade(x, y, ang, length, width, rise, tone):
        # A gently curving blade: root (x, y), heading `ang`, bending sideways as it goes.
        bend = rng.normal(0, 0.35)
        pts = []
        for t in np.linspace(0, 1, 7):
            a = ang + bend * t
            pts.append((x + np.cos(a) * length * t, y + np.sin(a) * length * t))
        pts = np.array(pts)
        lo, hi = pts.min(0) - width - 2, pts.max(0) + width + 2
        xs, ys, ix = region(N, lo[0], lo[1], hi[0], hi[1])
        X, Y = np.meshgrid(xs + 0.5, ys + 0.5)
        d, t = segments_distance(X, Y, pts)
        hw = width * (1 - t) ** 0.75 + 0.35 * ss
        cross = d / hw
        inside = cross < 1
        # Height: the blade arches up from its root and droops to its tip, with a midrib crease across it.
        z = rise * np.sin(np.pi * np.clip(t, 0, 1) * 0.8) + 0.18 * rise + 0.55 * hw * (1 - cross)
        cur = H[ix]
        win = inside & (z > cur)
        H[ix] = np.where(win, z, cur)
        shade = (0.78 + 0.3 * t) * (1 - 0.08 * cross)  # darker at the root, lighter to the tip
        c = col[ix]
        c = np.where(win[..., None], (tone * shade[..., None]), c)
        col[ix] = c

    def tone():
        r = rng.random()
        if r < 0.06:
            return np.array([1.12, 1.04, 0.72])  # a dry blade
        if r < 0.38:
            return np.array([1.05, 1.03, 0.86])  # warm
        if r < 0.66:
            return np.array([0.93, 1.0, 1.0])  # cool
        return np.array([1.0, 1.02, 0.93])

    # Clumps, blue-noise placed so none clusters into a mark that repeats. A clump leans one way (the combing, give or
    # take) and its blades fan out round that: a tuft seen from above, not a star.
    centres = poisson(N, rng, 13 * ss)
    rng.shuffle(centres)
    up = np.arctan2(comb[1], comb[0])
    for cx, cy in centres:
        heading = up + rng.normal(0, 0.7)
        for _ in range(rng.integers(10, 19)):
            ang = heading + rng.normal(0, 0.75)
            r0 = rng.random() * 2.0 * ss
            blade(cx + np.cos(ang) * r0, cy + np.sin(ang) * r0, ang, rng.uniform(11, 21) * ss, rng.uniform(0.9, 1.3) * ss,
                  rng.uniform(5, 10) * ss, tone())
    # Loose blades between the clumps.
    for _ in range(int(N * N / (9 * ss) ** 2)):
        x, y = rng.random(2) * N
        ang = up + rng.normal(0, 1.1)
        blade(x, y, ang, rng.uniform(7, 14) * ss, rng.uniform(0.7, 1.1) * ss, rng.uniform(2, 6) * ss, tone())
    nrm = downsample_normal(normal_map(H, 0.55), ss)
    alb = downsample(col, ss)
    return alb, nrm, downsample(H, ss)


# ================================================================ sand
def speckle(img, rng, count, colours, size=(0.6, 1.4), alpha=(0.5, 0.9)):
    """Sprinkle soft round specks of the given colours (sRGB) over an RGB image, wrapping."""
    n = img.shape[0]
    for _ in range(count):
        x, y = rng.random(2) * n
        r = rng.uniform(*size)
        c = np.asarray(colours[rng.integers(len(colours))])
        xs, ys, ix = region(n, x - r - 1, y - r - 1, x + r + 1, y + r + 1)
        X, Y = np.meshgrid(xs + 0.5, ys + 0.5)
        w = smoothstep(r + 0.6, r - 0.6, np.hypot(X - x, Y - y)) * rng.uniform(*alpha)
        img[ix] = img[ix] * (1 - w[..., None]) + c * w[..., None]


def sand(n=256, seed=11):
    """Dry beach sand: grain at every scale, low wind ripples (stoss lit, lee shaded) that wander and fade out in
    patches, mineral specks, and a scatter of shell bits and grit. Ripple crests run on a slant whose wave vector is a
    whole number of cycles each way, so they tile."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    wobble = band(n, rng, 2.5, bw=0.4) * 0.6 + band(n, rng, 5, bw=0.4) * 0.12
    phase = ((3 * xx + 22 * yy) / n + wobble) % 1.0
    crest = np.where(phase < 0.7, phase / 0.7, (1 - phase) / 0.3)  # gentle stoss up, short steep lee down
    lee = np.clip((phase - 0.7) / 0.3, 0, 1) * (phase > 0.7)
    fade = smoothstep(-0.6, 0.8, band(n, rng, 6, bw=0.4))
    grain = blur(rng.standard_normal((n, n)), 0.45)
    grain = grain / grain.std()
    clusters = band(n, rng, 48, bw=0.5)
    mottling = band(n, rng, 12, bw=0.45)
    v = 1 + 0.09 * fade * (crest - 0.5) - 0.07 * fade * lee + 0.03 * grain + 0.022 * clusters + 0.015 * mottling
    base = hexrgb("#d8b071")
    img = base * v[..., None]
    # Wetter, finer sand settles in the troughs: a touch cooler there.
    img = img * (1 + 0.02 * ((crest - 0.5) * fade)[..., None] * np.array([1.0, 0.2, -0.9]))
    speckle(img, rng, 700, [hexrgb("#9c8463"), hexrgb("#b0966f"), hexrgb("#f1e3c4"), hexrgb("#f6ead0")], (0.45, 0.85), (0.3, 0.7))
    speckle(img, rng, 60, [hexrgb("#f4e9da"), hexrgb("#efd6cc"), hexrgb("#e9dcc0")], (1.0, 1.8), (0.6, 0.9))  # shell bits
    speckle(img, rng, 45, [hexrgb("#9b8a72"), hexrgb("#857565")], (0.9, 1.5), (0.6, 0.9))  # grit
    return img


# ================================================================ soil
def pebble(rng, r):
    """A pebble's height (0 outside): a squashed dome with a lumpy outline, in a small square patch."""
    m = int(np.ceil(r * 2.6)) | 1
    yy, xx = np.mgrid[0:m, 0:m].astype(np.float64) - m // 2
    ang = rng.random() * TAU
    c, s_ = np.cos(ang), np.sin(ang)
    u, v = (c * xx + s_ * yy) / (r * rng.uniform(1.0, 1.35)), (-s_ * xx + c * yy) / r
    th = np.arctan2(v, u)
    rim = 1 + 0.12 * np.sin(th * 3 + rng.random() * TAU) + 0.07 * np.sin(th * 5 + rng.random() * TAU)
    d = np.hypot(u, v) / rim
    return np.sqrt(np.clip(1 - d * d, 0, 1)) ** 0.8


def soil(n=1024, seed=31):
    """A packed earth path seen close (greyscale; the season's soil colour tints it): fine grain, crumbs and small
    clods, pebbles bedded in it with a little shade round each, and hairline drying cracks here and there. Everything
    is spread evenly (blue-noise placed), so no one pebble marks the repeat."""
    rng = np.random.default_rng(seed)
    grain = blur(rng.standard_normal((n, n)), 0.7)
    v = 1 + 0.045 * grain / grain.std() + 0.035 * band(n, rng, 90, bw=0.5) + 0.03 * band(n, rng, 24, bw=0.5) + 0.02 * band(n, rng, 9, bw=0.4)
    # Crumbs: small irregular lumps, some darker (damp clods), some lighter (dry grit).
    crumbs = np.zeros((n, n))
    for _ in range(5200):
        x, y = rng.random(2) * n
        stamp_disc(crumbs, x, y, rng.uniform(1.2, 3.4), rng.choice([-1.0, 1.0]) * rng.uniform(0.4, 1.0), mode="add", profile="cone")
    v += 0.07 * crumbs
    # Pebbles bedded in it: irregular rounded outlines, lit from the upper left, a little shade round each.
    shade = np.zeros((n, n))
    peb = np.zeros((n, n))
    tone = np.ones((n, n))
    for x, y in poisson(n, rng, 40):
        r = rng.uniform(3.5, 9.5)
        p = pebble(rng, r)
        m = p.shape[0]
        ys_, xs_ = np.arange(m) + int(y) - m // 2, np.arange(m) + int(x) - m // 2
        ix = np.ix_(ys_ % n, xs_ % n)
        stamp_disc(shade, x + 0.8, y + 1.1, r * 1.5, 1.0, mode="max", profile="cone")
        inside = p > 0
        peb[ix] = np.where(inside, p, peb[ix])
        tone[ix] = np.where(inside, rng.choice([1.14, 1.08, 0.9, 1.2, 0.82]), tone[ix])
    lit = np.clip((np.roll(peb, 1, 0) - np.roll(peb, -1, 0) + np.roll(peb, 1, 1) - np.roll(peb, -1, 1)) * 1.2, -1, 1)
    v = np.where(peb > 0.03, tone * (0.92 + 0.1 * peb - 0.16 * lit) + 0.03 * grain / grain.std(), v * (1 - 0.18 * shade))
    # Drying cracks: short jagged runs along the edges of big cells, only in patches.
    pts = poisson(n, rng, 170)
    dx, dy = band(n, rng, 6) * 9 + band(n, rng, 70) * 1.6, band(n, rng, 6) * 9 + band(n, rng, 70) * 1.6
    _, _, edge = voronoi(n, pts, dx, dy)
    crack = smoothstep(1.6, 0.5, edge) * smoothstep(0.35, 0.9, band(n, rng, 7, bw=0.4))
    v *= 1 - 0.3 * crack * (peb < 0.03)
    return v


def soil_normal(n=256, ss=2, seed=37):
    """Relief for the path (its own repeat, not the albedo's): crumbs, small stones, grain."""
    rng = np.random.default_rng(seed)
    N = n * ss
    h = blur(rng.standard_normal((N, N)), 0.8) * 0.35 + band(N, rng, 40) * 0.6 + band(N, rng, 12) * 0.5
    for _ in range(2600):
        x, y = rng.random(2) * N
        stamp_disc(h, x, y, rng.uniform(1.5, 4.0) * ss, rng.uniform(0.8, 2.0) * ss, mode="max", profile="dome")
    for x, y in poisson(N, rng, 34 * ss):
        stamp_disc(h, x, y, rng.uniform(4, 9) * ss, rng.uniform(2.5, 4.5) * ss, mode="max", profile="dome")
    return downsample_normal(normal_map(h, 0.45), ss)


# ================================================================ brick (pavers)
def brick(n=256, seed=61, b=32):
    """Basket-weave pavers: pairs of bricks (2b x b) laid in b*2 squares, the pairs turning a quarter each square, sandy
    joints between; each brick its own terracotta (a few burnt dark, a few pale), rounded worn arrises, pores and
    chips. Returns sRGB albedo and a height field."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64) + 0.5
    s = 2 * b
    bx, by = np.floor(xx / s), np.floor(yy / s)
    lx, ly = xx - bx * s, yy - by * s
    flip = ((bx + by) % 2) == 1
    # Within a square: two bricks stacked (horizontal) or side by side (vertical).
    u = np.where(flip, ly, lx)
    v = np.where(flip, lx, ly)
    half = np.floor(v / b)
    dv = np.minimum(v - half * b, (half + 1) * b - v)
    du = np.minimum(u, s - u)
    edge = np.minimum(dv, du)
    ident = ((by * (n // s) + bx) * 2 + half).astype(int)
    k = int(ident.max()) + 1
    tone = rng.uniform(0.86, 1.12, k)
    kind = rng.random(k)
    hue = np.where(kind[ident] < 0.07, 0.8, np.where(kind[ident] > 0.93, 1.1, 1.0))
    edge_n = edge + band(n, rng, 40) * 0.35
    joint = 1.0
    body = smoothstep(joint - 0.5, joint + 0.5, edge_n)
    shoulder = smoothstep(joint, joint + 3.2, edge_n)
    pores = np.zeros((n, n))
    for _ in range(260):
        x, y = rng.random(2) * n
        stamp_disc(pores, x, y, rng.uniform(0.4, 0.9), 1.0, mode="max", profile="dome")
    grain = blur(rng.standard_normal((n, n)), 0.6)
    face = band(n, rng, 14, bw=0.5)
    vv = tone[ident] * (1 + 0.035 * face + 0.018 * grain / grain.std()) * (0.84 + 0.16 * shoulder) * (1 - 0.2 * pores)
    clay = hexrgb("#bc6e3c")
    col = clay * (vv * hue)[..., None]
    col = np.where((kind[ident] < 0.07)[..., None], col * np.array([0.94, 0.96, 1.04]), col)
    mortar = hexrgb("#b8a07c") * (0.95 + 0.04 * band(n, rng, 30))[..., None]
    col = col * body[..., None] + mortar * (1 - body)[..., None]
    h = shoulder * 2.4 + 0.25 * face + 0.1 * grain - 0.5 * pores + (body - 1) * 1.2 + rng.normal(0, 0.15, k)[ident] * body
    return col, h


# ================================================================ the grass drape's mask
def fringe(w=1024, h=32, seed=83):
    """The blades hanging over a water edge or a cliff lip, as an alpha mask (the drape draws the island's grass colour
    through it). Row 0 is the bottom of the card (v 1): the blade tips hang toward it; the root edge, near the top of
    the card, is soft and wavy. The solid band covers the rows the drape has always shown, so it hangs as far."""
    rng = np.random.default_rng(seed)
    ss = 4
    W, H = w * ss, h * ss
    a = np.zeros((H, W))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    # The root edge: wavy, between rows 21 and 26 of 32.
    root = (25.5 + 1.6 * np.sin(xx[0] / W * TAU * 7 + 1.3) + 1.1 * np.sin(xx[0] / W * TAU * 19 + 0.4)) * ss
    a = np.maximum(a, smoothstep(root[None, :] + 1.0 * ss, root[None, :] - 1.0 * ss, yy) * (yy > 6 * ss))
    # Blades: from the band down toward row 0, tapering to a point, leaning a little.
    for _ in range(int(w * 1.1)):
        x = rng.random() * W
        top = rng.uniform(8, 13) * ss
        tip = rng.uniform(0.5, 6.5) * ss
        lean = rng.normal(0, 3.0) * ss
        width = rng.uniform(2.2, 4.2) * ss
        xs = np.arange(int(x - width - abs(lean) - 4), int(x + width + abs(lean) + 4))
        ys = np.arange(int(tip) - 2, int(top) + 2)
        X, Y = np.meshgrid(xs + 0.5, ys + 0.5)
        t = np.clip((top - Y) / (top - tip), 0, 1)  # 0 at the band, 1 at the tip
        cx = x + lean * t ** 1.5
        hw = width * (1 - t) ** 0.9 * 0.5 + 0.3
        m = smoothstep(hw + 0.8, hw - 0.8, np.abs(X - cx)) * (Y > tip) * (Y < top + 1)
        a[np.ix_(np.clip(ys, 0, H - 1), xs % W)] = np.maximum(a[np.ix_(np.clip(ys, 0, H - 1), xs % W)], m)
    a = np.maximum(a, (yy >= 10 * ss) & (yy < 21 * ss))
    a = downsample(a, ss)
    out = np.zeros((h, w, 4))
    out[..., :3] = 1.0
    out[..., 3] = a
    return out


# ================================================================ the water
def sea_ripple(n=128, seed=97):
    """The water's ripple normal: a few crossing trains of short waves (whole cycles across the tile each way, so it
    tiles) broken up by capillary noise. Its |r| and |g| stay under 0.69 (the slope GridOcean.test.ts bounds the
    water's glints by)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    h = np.zeros((n, n))
    for kx, ky, amp in [(3, 5, 1.0), (-4, 3, 0.8), (6, -1, 0.55), (1, 8, 0.45), (-7, -5, 0.3)]:
        ph = rng.random() * TAU
        h += amp * np.sin(TAU * (kx * xx + ky * yy) / n + ph + band(n, rng, 2, bw=0.4) * 1.2)
    h += 0.25 * fbm(n, rng, 8, 2, gain=0.5)
    nrm = normal_map(h, 1.0)
    xy = nrm[..., :2]
    scale = 0.69 / np.abs(xy).max()
    xy = xy * scale
    z = np.sqrt(np.clip(1 - (xy ** 2).sum(-1), 0, 1))
    return np.concatenate([xy, z[..., None]], -1)


def sea_glint(n=128):
    """The sparkle sprite's soft mask (the shader draws the star itself): a rounded square, white, soft at the rim."""
    yy, xx = (np.mgrid[0:n, 0:n].astype(np.float64) + 0.5) / n * 2 - 1
    d = (np.abs(xx) ** 6 + np.abs(yy) ** 6) ** (1 / 6)
    a = smoothstep(0.95, 0.74, d)
    out = np.ones((n, n, 4))
    out[..., 3] = a
    return out


# ================================================================ main
def main():
    alb, nrm, h = grass()
    # The quilt's mean (lib/game/grassTexture.ts: tones 0.87-1.0 x (232|250|218)/255): the lawn's colour is unchanged.
    for _ in range(8):
        alb = np.clip(alb * (np.array([0.855, 0.92, 0.80]) / alb.reshape(-1, 3).mean(0)), 0, 1)
    save("grass-albedo.png", alb)
    save("grass-normal.png", encode_normal(nrm))
    # The beach shader reads the sand's luminance (GridTerrain island-sand-detail), the soil its grain: same exposure.
    save("sand-albedo.png", match_luma(sand(), mean_lin_luma(os.path.join(DUMP_TERRAIN, "mSand_Alb.png"))))
    v = soil()
    soil_lin = to_lin(np.clip(v * 0.85, 0, 1))
    soil_lin *= mean_lin_rgb(os.path.join(DUMP_ROAD, "mRoadSoil_Alb.png")).mean() / soil_lin.mean()
    save("soil-albedo.png", to_srgb(soil_lin), "L")
    save("soil-normal.png", encode_normal(soil_normal()))
    col, h = brick()
    save("brick-albedo.png", match_rgb(col, mean_lin_rgb(os.path.join(DUMP_ROAD, "mRoadBrick_Alb.png"))))
    save("brick-normal.png", encode_normal(normal_map(h, 0.6)))
    save("fringe.png", fringe(), "RGBA")
    save("sea-ripple.png", encode_normal(sea_ripple()))
    save("sea-glint.png", sea_glint(), "RGBA")


if __name__ == "__main__":
    main()
