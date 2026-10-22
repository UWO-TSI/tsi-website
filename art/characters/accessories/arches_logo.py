"""#04 crew visor's logo (David, round 5: "the M symbol is messed up make it the mcdonald m but flip it so its w").

The source's M was half an arch mirrored across the band's UVs, and the decimation took the vertex on the mirror line at
the band's top, so the two halves no longer met. The logo is drawn here instead: the golden-arches style M (two
parabolic arches, their inner feet merged into one) turned upside down so it reads as a W, in the visor's own trim
yellow on its black band. It is our own drawing, a parody, never the real mark.

  paint(me, key)    after colour_atlas.remap: the band's front faces (BAND_YAW of the face) get new UVs, a projection
                    from the front into key's tile; the tile is the band as it was (the old logo's yellow filled with the
                    band's black row by row) with the W over it, LOGO_H of the band's height, centred on the face

The shape (inside_w) is plain numpy, so it can be previewed outside Blender.
"""
import math
import numpy as np

HO = 0.27        # an arch's outer half width (logo widths): the two arches overlap, so their inner feet merge
LEG = 0.14       # a foot's width (logo widths)
CROWN = 0.15     # the stroke's depth at an arch's crown (logo heights)
ASPECT = 1.2     # the logo's width over its height
LOGO_H = 0.7     # the logo's height over the band's, at the face
GOLD = np.array([241, 185, 17]) / 255.0     # the visor's own trim yellow (the median yellow of its tile), sRGB
BAND_YAW = 30.0  # degrees either side of the face: the band's faces that take the logo's tile
SS = 4           # supersamples a texel a side (the logo's edges antialiased)
OLD_PAD = 6      # texels round the old logo's yellow that go with it (its dark edge and shading)
SIDE = 4         # texels either side of the old logo the band's black is read from


def _arch(s, y, c):
    x = (s - c) / HO
    xi = (s - c) / (HO - LEG)
    return (y <= 1 - x * x) & ~(y < (1 - CROWN) * (1 - xi * xi)) & (y >= 0) & (np.abs(x) <= 1)


def inside_w(s, t):
    """The W: s left to right and t bottom to top over the logo's box, 0 to 1. The M's arches, turned upside down."""
    y = 1 - t
    return _arch(s, y, HO) | _arch(s, y, 1 - HO)


def band_faces(me, hc):
    """The band's outer wall round the face: outward, upright, within BAND_YAW of the face, on the head (not the bill's
    edge, further out). Blender axes: the face toward -Y."""
    out = []
    for p in me.polygons:
        c, n = p.center - hc, p.normal
        r = math.hypot(c.x, c.y)
        if r < 1e-6 or abs(n.z) > 0.6 or c.z < 0.1 or r > 0.27:
            continue
        if (n.x * c.x + n.y * c.y) / r > 0.5 and abs(math.degrees(math.atan2(c.x, -c.y))) <= BAND_YAW:
            out.append(p)
    return out


def _tris(me, faces):
    """Each face as triangles (a fan): (k, 3) vertex and loop indices."""
    v, lp = [], []
    for f in faces:
        vs, ls = list(f.vertices), list(f.loop_indices)
        for i in range(1, len(vs) - 1):
            v.append((vs[0], vs[i], vs[i + 1]))
            lp.append((ls[0], ls[i], ls[i + 1]))
    return np.array(v), np.array(lp)


def _bary(p, t):
    """Barycentrics of 2D points p (n, 2) in each triangle t (k, 3, 2): (k, n, 3)."""
    a, b, c = t[:, 0, None], t[:, 1, None], t[:, 2, None]
    v0, v1, v2 = b - a, c - a, p[None] - a
    d00, d01, d11 = (v0 * v0).sum(-1), (v0 * v1).sum(-1), (v1 * v1).sum(-1)
    d20, d21 = (v2 * v0).sum(-1), (v2 * v1).sum(-1)
    den = d00 * d11 - d01 * d01
    den = np.where(np.abs(den) < 1e-18, 1e-18, den)
    w1 = (d11 * d20 - d01 * d21) / den
    w2 = (d00 * d21 - d01 * d20) / den
    return np.stack([1 - w1 - w2, w1, w2], -1)


def _bilinear(img, x, y):
    """img (h, w, 4) sampled at pixel coordinates (texel edges at integers)."""
    h, w = img.shape[:2]
    x, y = np.clip(x - 0.5, 0, w - 1), np.clip(y - 0.5, 0, h - 1)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    return (img[y0, x0] * (1 - fx) + img[y0, x1] * fx) * (1 - fy) + (img[y1, x0] * (1 - fx) + img[y1, x1] * fx) * fy


def _shift(a, dy, dx):
    """a moved by (dy, dx) texels, zeros (False) where nothing came in (no wrap round the edge)."""
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


STEPS = ((1, 0), (-1, 0), (0, 1), (0, -1))


def paint(me, key, hc):
    import colour_atlas as CA
    faces = band_faces(me, hc)
    tv, tl = _tris(me, faces)
    co = np.array([v.co[:] for v in me.vertices], float)
    uv = np.array([d.uv[:] for d in me.uv_layers.active.data], float)
    xz = co[:, [0, 2]]
    T = xz[tv]                                          # (k, 3, 2) the faces seen from the front
    x0, z0 = T.reshape(-1, 2).min(0)
    x1, z1 = T.reshape(-1, 2).max(0)
    X, Y, S = CA.LAYOUT[key]
    inner = S - 2 * CA.PAD

    def covered(pts):
        b = _bary(pts, T)
        ok = (b >= -1e-9).all(-1)
        k = np.where(ok.any(0), ok.argmax(0), -1)
        return k, b[np.maximum(k, 0), np.arange(len(pts))]

    # the band's height at the face: where the faces cover the line x = 0
    zs = np.linspace(z0, z1, 2001)
    k, _ = covered(np.stack([np.zeros_like(zs), zs], -1))
    zb, zt = zs[k >= 0].min(), zs[k >= 0].max()
    lh = LOGO_H * (zt - zb)
    lw = ASPECT * lh
    lz0 = (zb + zt) / 2 - lh / 2

    # the band as it was: each texel's point on the faces, sampled where its old UVs put it
    g = (np.arange(inner) + 0.5) / inner
    px = x0 + g * (x1 - x0)
    pz = z1 - g * (z1 - z0)
    PX, PZ = np.meshgrid(px, pz)
    pts = np.stack([PX.ravel(), PZ.ravel()], -1)
    k, b = covered(pts)
    inside = k >= 0
    ouv = (uv[tl[np.maximum(k, 0)]] * b[..., None]).sum(1)          # the old atlas UVs (Blender: v up)
    atlas = CA._load()
    bg = _bilinear(atlas, (ouv[:, 0] - 2) * CA.W, (1 - ouv[:, 1]) * CA.H).reshape(inner, inner, 4)
    valid = inside.reshape(inner, inner)
    # the old logo (its yellow, its dark edge and its shading) gone: across its box, row by row, the band's black from
    # either side of it, blended straight across (the band's shading runs down it)
    sat = bg[..., :3].max(-1) - bg[..., :3].min(-1)
    rows, cols = np.nonzero(valid & (sat > 0.12))
    r0, r1 = max(rows.min() - OLD_PAD, 0), min(rows.max() + OLD_PAD, inner - 1)
    c0, c1 = max(cols.min() - OLD_PAD, 0), min(cols.max() + OLD_PAD, inner - 1)
    old = np.zeros_like(valid)
    old[r0:r1 + 1, c0:c1 + 1] = True
    old &= valid
    for j in range(r0, r1 + 1):
        lft = [i for i in range(c0 - 1, max(c0 - 1 - SIDE, -1), -1) if valid[j, i]]
        rgt = [i for i in range(c1 + 1, min(c1 + 1 + SIDE, inner)) if valid[j, i]]
        if not lft and not rgt:
            bg[j, old[j]] = np.median(bg[valid & ~old], 0)
            continue
        a = bg[j, lft].mean(0) if lft else bg[j, rgt].mean(0)
        b = bg[j, rgt].mean(0) if rgt else a
        f = ((np.arange(inner) - c0) / max(c1 - c0, 1)).clip(0, 1)[:, None]
        bg[j, old[j]] = (a * (1 - f) + b * f)[old[j]]
    # texels off the faces (round the edge) take their neighbours', for filtering
    done = valid.copy()
    while not done.all():
        acc, n = np.zeros_like(bg), np.zeros(done.shape)
        for dy, dx in STEPS:
            m = _shift(done, dy, dx)
            acc += _shift(bg, dy, dx) * m[..., None]
            n += m
        new = ~done & (n > 0)
        bg[new] = acc[new] / n[new, None]
        done |= new

    # the W, antialiased
    gs = (np.arange(inner * SS) + 0.5) / (inner * SS)
    SX, SZ = np.meshgrid(x0 + gs * (x1 - x0), z1 - gs * (z1 - z0))
    cov = inside_w((SX - hc.x) / lw + 0.5, (SZ - lz0) / lh).reshape(inner, SS, inner, SS).mean((1, 3))
    ls = (np.array([[-0.5, 0.0], [0.5, 0.0], [-0.5, 1.0], [0.5, 1.0]]) * [lw, lh] + [hc.x, lz0])
    kc, _ = covered(ls)
    assert (kc >= 0).all(), "the logo runs off the band's faces"
    tile = bg.copy()
    tile[..., :3] = bg[..., :3] * (1 - cov[..., None]) + GOLD * cov[..., None]
    CA.put(key, tile)

    # the faces' new UVs: the same projection from the front, into the tile (u + 2, as colour_atlas.remap)
    data = me.uv_layers.active.data
    for f in faces:
        for li, vi in zip(f.loop_indices, f.vertices):
            ax = X + CA.PAD + (co[vi, 0] - x0) / (x1 - x0) * inner
            ay = Y + CA.PAD + (z1 - co[vi, 2]) / (z1 - z0) * inner
            data[li].uv = (2.0 + ax / CA.W, 1.0 - ay / CA.H)
    print(f"LOGO {key}: {len(faces)} band faces, band {zb:.3f}..{zt:.3f}, logo {lw * 100:.1f} x {lh * 100:.1f} cm, "
          f"{math.degrees(math.atan2(lw / 2, 0.23)):.1f} deg either side, the old logo cleared over {int(old.sum())} texels")
