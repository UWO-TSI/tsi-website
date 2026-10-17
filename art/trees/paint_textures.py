"""The village greenery's painted textures (game/remodel-trees): leaf clumps, blossom, needle fringes and petals.

David, 2026-10-16: trees and plants are leaf cards with a real painted leaf texture over a closed volume, and every
texture is our own (never one from the web). 2026-10-17: "recreate the leaf texture from the dump". So each texture is
painted here from seeded shapes, its look studied from the ACNH atlases (never copied, traced or resampled):

  - a leaf card is one big three-lobed clump (a centre lobe and two side lobes meeting at a pointed base), airbrushed:
    darker at the base, lighter toward the lobes, a light rim along its top edges, a faint Y of veins, soft folds from
    the notches, a little grain; every card its own shade (the dump's cells run dark to light);
  - a cherry card is one five-petal blossom with notched petals, deep pink at its eye fading to pale tips; a winter
    card the leaf frosted, a few with snow along their tops;
  - a cedar card is a fringe: a strip hanging in rounded fingers, fine vertical grain, frosted over its top for snow;
  - petals are soft gradients with fine veins. (Trunks are plain colour: lane rules, textures only where they show.)

Painted at four times the size and filtered down; the transparent texels carry their neighbours' colour, so the
cut-out edge never shows a dark or light halo once mipmapped. Writes art/trees/textures/<name>.png:

  leaves-<dress>.png    512 x 512: twelve card cells (4 x 3, 128 px) over a 128 px row of the cards' own paint as an
                        opaque mass (left half) and packed snow (right); dress = summer, autumn, blossom, winter
  needles[-snow].png    the same layout with fringes
  petals.png            512 x 512, the flowers' petals, leaves and centres (art/trees/flower_cells.py)

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


# ================================================================ blossom
# ================================================================ needles
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


def snow_field(rng, w=CELL, h=CELL // 2, snow=hexc("#f4f7fb")):
    """Packed snow: soft lumps over a cool shade (opaque)."""
    S, H = w * SS, h * SS
    cv = Canvas(S, H, bg=hexc("#cfdbe9"))
    for i in range(140):
        paint_snow_lump(cv, rng.uniform(0, S), rng.uniform(0, H), S * rng.uniform(0.04, 0.08), rng, snow)
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
    # drawn a little narrower than the cell: a card is the dump's shield-shaped hexagon over the cell's box, and the
    # side lobes' tips must sit inside its upper corners
    poly = [((0.5 + (x - 0.5) * 0.92) * S, y * S) for x, y in catmull(pts, 12)]
    union = poly_mask(S, poly)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    bx, by = CLUMP[0][0] * S, CLUMP[0][1] * S
    dB = np.hypot(xx - bx, yy - by) / S
    # soft and low in contrast (David, row 314: "subtle, not strong; low-contrast detail and soft lines")
    val = 0.76 + 0.32 * smoothstep(0.04, 0.8, dB)
    val *= 0.95 + 0.07 * (1 - yy / S)
    d, up = soft_edge(union, S)
    rim = 1 - smoothstep(0.0, 0.05, d)
    val += rim * (0.11 * np.clip(up, 0, 1) - 0.03 * np.clip(-up, 0, 1))
    # the veins: a faint Y from the base out to each lobe's tip
    vein = np.zeros_like(val)
    tips = [right[TIPS[0] - 1], top, left[len(left) - TIPS[0]]]
    for tx, ty in tips:
        vx, vy = tx * S - bx, ty * S - by
        L = math.hypot(vx, vy)
        t = ((xx - bx) * vx + (yy - by) * vy) / (L * L)
        off = np.abs((xx - bx) * vy - (yy - by) * vx) / L
        vein = np.maximum(vein, np.exp(-(off / (S * 0.008)) ** 2) * smoothstep(0.03, 0.12, t) * (1 - smoothstep(0.5, 0.85, t)))
    val *= 1 - 0.05 * vein
    # a soft fold of shade from each notch in toward the middle, so the clump reads as three leaves
    crease = np.zeros_like(val)
    for nx, ny in (right[NOTCH - 1], left[len(left) - NOTCH]):
        cx, cy = 0.5 * S, 0.5 * S
        vx, vy = cx - nx * S, cy - ny * S
        L = math.hypot(vx, vy)
        t = ((xx - nx * S) * vx + (yy - ny * S) * vy) / (L * L)
        off = np.abs((xx - nx * S) * vy - (yy - ny * S) * vx) / L
        crease = np.maximum(crease, np.exp(-(off / (S * 0.04)) ** 2) * np.clip(1 - t, 0, 1) * (t > -0.05))
    val *= 1 - 0.11 * crease
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


def fringe(rng, colour, size=128, snow=None, deep=False):
    """A cedar fringe: a strip hanging in rounded fingers, darker at its top (inside the tier), lighter down the
    fingers, fine vertical grain; with snow, frosted white over its top half, the green showing at the tips (deep: the
    snow down to the fingertips, for the tree's snowed-over top)."""
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
        f = (1 - smoothstep(0.75, 0.98, t + 0.05 * np.sin(xx / w * math.pi * 2))) if deep else (1 - smoothstep(0.35, 0.75, t + 0.08 * np.sin(xx / w * math.pi * 2)))
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
SUMMER = ["#336630", "#3d7234", "#477e38", "#528a3c", "#5c9440", "#689e44", "#78aa4c", "#427a36", "#386c32", "#4f8a3a", "#62983f", "#8cb658"]
AUTUMN = ["#a8442a", "#bd552a", "#cc672c", "#d9802f", "#e39a36", "#e8b23f", "#eec45a", "#b85f2c", "#c99a3a", "#9a8e38", "#d27030", "#efcf72"]
WINTER = ["#7f9e92", "#8eab9e", "#9cb8ab", "#6f8f84", "#86a598", "#a7c1b5", "#7a988a", "#93b0a3"]
BLOSSOM = [("#fbe3ea", "#f08aa9"), ("#f9d3df", "#ea7a9c"), ("#f6c1d1", "#e06890"), ("#fde9ef", "#f29bb5"), ("#f4b5c8", "#d95f88")]
NEEDLE = ["#3a6b3e", "#447744", "#4f8249", "#36603b", "#5a8c4d", "#3f7042"]


def leaves(season, seed=11):
    rng = random.Random(seed)
    snow = hexc("#f6f8fc")
    if season == "blossom":
        cards = [sakura(rng, hexc(BLOSSOM[i % len(BLOSSOM)][0]), hexc(BLOSSOM[i % len(BLOSSOM)][1])) for i in range(10)]
        cards += [trefoil(rng, hexc(c)) for c in ("#7fb24e", "#93c15a")]
        mass = mass_of(lambda r, c, s: sakura(r, c, c * 0.8, s), [hexc(p) for p, _ in BLOSSOM], rng, bg=hexc("#c98ea0"))
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
    # with snow, cells 8-11 are snowed to the fingertips (the upper tiers: build_conifers.py)
    cards = [fringe(rng, hexc(NEEDLE[i % len(NEEDLE)]), snow=s, deep=snow and i >= 8) for i in range(12)]
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
    "petals": lambda: petals_atlas(),
}


def main():
    names = [a for a in sys.argv[1:] if a in JOBS] or list(JOBS)
    for n in names:
        save(n, JOBS[n]())


if __name__ == "__main__":
    main()
