"""Face set 305: David's 19 faces as creator options (David, 2026-10-08).

Source: art/characters/v7/face/source/david/{eyes,mouth,face}/NN-*.glb, 19 dynamic heads David made for his own Roblox
shop and split into parts (generator "split_head"). David confirmed his authorship in-session on 2026-10-08, so the
drawings ship as they are. Only their textures and where they sit on the face are used, never the head geometry.

What one part is: a few layered primitives on the head (a textured patch in the head's own UV layout, or modelled
shapes coloured by one texel). The UV layouts differ from head to head, so a part is placed by where it sits on its
head, not by its UVs:

  1. unwrap   each head's front is measured from its face shell (rays along +z): arc length across the face from the
              centre line, horizontally and vertically, over the head's half width. So a drawing keeps its size where
              the head curves round to the sides, as our face canvas (head_shape.face_chart) does.
  2. place    one similarity for all 19, fitted on the set itself: the median eye line lands on our eye anchor, the
              median mouth on our mouth anchor, the centre line on ours. It puts the median eye pair at u 0.255 and
              0.745, beside our anchors (0.2416, 0.7584), so these features sit on our face as they sat on theirs.
  3. draw     every primitive's triangles are drawn front on in that frame, far to near (painter), sampling its texture
              with a Catmull-Rom filter (premultiplied) at 4x and box-filtered down: about 1:1 with most sources (1.0-1.16
              canvas px per texel); the modelled parts and the small textures (#12 at 512 px, #19 at 256 px) are 2-7x.

Lines: beside an opaque dark core the alpha ramp of an edge is tightened to about a pixel (finish), so the black lines
stay crisp at our resolution, whether the source was coarser (#12, #19, the modelled parts) or drawn soft (#13).

Eyes: the pair is split at the emptiest column near the centre line into the canvas-left cell (`open`, at the eye
anchor) and the canvas-right cell (`left`, at the mirrored eye anchor `eye_left`). A pair whose halves mirror each other
keeps one cell and the engine mirrors it, as for the older eyes. A pair with something across the centre line (the
dizzy hatching, the nervous hatching, a blush across the nose) is one cell. They have no blink frames (static).
Mouths: one cell at the mouth anchor. Accents: the face shells that carry something besides the plain skin (#6 a blush
on the nose, #14 a sweat drop) become extras, their colour lifted off the shell's skin (colour to alpha) and anchored
at their own centre. Everything off the face canvas is cut.

None is "recolorable" here: #4 and #15 are sold that way, but our eyes have no colour tint, so they stay as drawn.
build_face.py imports this file (`cells(...)`) and packs these cells in their own band below the earlier ones.
"""
import json, math, os, struct, tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "face", "source", "david")
SS = 4                 # supersampling of the front-on drawing

# number: (eyes id, eyes name, mouth id, mouth name). No shop item numbers or titles reach the game.
FACES = {
    1: ("bean", "Bean eyes", "little_v", "Little v"),
    2: ("daze", "Dazed", "drumstick", "Drumstick"),
    3: ("half_lid", "Half-lidded", "drool", "Drool"),
    4: ("swirl", "Dizzy swirls", "gritted", "Gritted teeth"),
    5: ("mochi", "Mochi dots", "pout", "Pout"),
    6: ("shy", "Shy glance", "tiny_smirk", "Tiny smirk"),
    7: ("relieved", "Relieved", "open_smile", "Open smile"),
    8: ("chill", "Chill", "small_frown", "Small frown"),
    9: ("tiny_dots", "Tiny dots", "pill", "Pill mouth"),
    10: ("stare", "Stare", "deadpan", "Deadpan"),
    11: ("offset", "Offset blobs", "dash", "Dash"),
    12: ("unimpressed", "Unimpressed", "side_smirk", "Side smirk"),
    13: ("close_dots", "Close dots", "long_drool", "Long drool"),
    14: ("teary", "Teary wide", "nervous_laugh", "Nervous laugh"),
    15: ("doll_lash", "Doll lashes", "tiny_mouth", "Tiny mouth"),
    16: ("nervous", "Nervous", "gasp", "Gasp"),
    17: ("focused", "Focused", "kitty", "Kitty"),
    18: ("sleepy", "Sleepy", "tired_drool", "Tired drool"),
    19: ("square_dots", "Square dots", "buck_tooth", "Buck tooth"),
}
ACCENTS = {6: ("nose_blush", "Nose blush"), 14: ("sweat_drop", "Sweat drop")}
ACCENT_MIN = 0.05      # a shell carries an accent where it departs from its skin by more than this (else residue)


# ---------------------------------------------------------------- reading the GLBs
_CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
_NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load_png(data):
    """RGBA floats (straight alpha, sRGB values as stored), top row first. Blender decodes, as the rest of the build."""
    import bpy
    fd, path = tempfile.mkstemp(suffix=".png")
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    try:
        img = bpy.data.images.load(path)
        img.colorspace_settings.name = "Non-Color"
        img.alpha_mode = "STRAIGHT"
        w, h = img.size
        px = np.empty(w * h * 4, np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
    finally:
        os.remove(path)
    return px.reshape(h, w, 4)[::-1].copy()


def load_glb(path):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bn = b[20 + jl + 8:]

    def acc(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        k = _NC[a["type"]]
        arr = np.frombuffer(bn, _CT[a["componentType"]], a["count"] * k, bv.get("byteOffset", 0) + a.get("byteOffset", 0))
        return arr.reshape(a["count"], k) if k > 1 else arr

    prims = []
    for pr in j["meshes"][0]["primitives"]:
        tex = j["materials"][pr["material"]]["pbrMetallicRoughness"]["baseColorTexture"]
        im = j["images"][j["textures"][tex["index"]]["source"]]
        bv = j["bufferViews"][im["bufferView"]]
        img = load_png(bn[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]])
        prims.append(dict(P=acc(pr["attributes"]["POSITION"]).astype(np.float64), UV=acc(pr["attributes"]["TEXCOORD_0"]).astype(np.float64),
                          I=acc(pr["indices"]).reshape(-1, 3).astype(np.int64), img=img))
    return prims


def part(kind, n):
    name = next(f for f in sorted(os.listdir(os.path.join(SOURCE, kind))) if f.startswith(f"{n:02d}-"))
    return load_glb(os.path.join(SOURCE, kind, name))


# ---------------------------------------------------------------- 1. unwrap: arc length over each head's front
def front_z(P, I, pts):
    z = np.full(len(pts), np.nan)
    for (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) in P[I]:
        d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(d) < 1e-12:
            continue
        l0 = ((y1 - y2) * (pts[:, 0] - x2) + (x2 - x1) * (pts[:, 1] - y2)) / d
        l1 = ((y2 - y0) * (pts[:, 0] - x2) + (x0 - x2) * (pts[:, 1] - y2)) / d
        l2 = 1 - l0 - l1
        zz = l0 * z0 + l1 * z1 + l2 * z2
        upd = (l0 >= -1e-9) & (l1 >= -1e-9) & (l2 >= -1e-9) & (np.isnan(z) | (zz < z))
        z[upd] = zz[upd]
    return z


class Unwrap:
    """Head-front coordinates of a head: (x, y) -> arc length from the centre line over the head's half width."""

    def __init__(self, shell):
        P, I = shell["P"], shell["I"]
        self.prof = []
        for axis in (0, 1):
            lim = np.abs(P[:, axis]).max()
            q = np.linspace(-lim, lim, 401)[1:-1]
            pts = np.zeros((len(q), 2))
            pts[:, axis] = q
            z = front_z(P, I, pts)
            ok = ~np.isnan(z) & (z < 0)
            q, z = q[ok], z[ok]
            s = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(q), np.diff(z)))])
            self.prof.append((q, s - np.interp(0.0, q, s)))
        q, s = self.prof[0]
        self.half = (s[-1] - s[0]) / 2          # the head's half width, in arc

    def arc(self, v, axis):
        q, s = self.prof[axis]
        return np.where(v < q[0], s[0] + (v - q[0]), np.where(v > q[-1], s[-1] + (v - q[-1]), np.interp(v, q, s)))

    def __call__(self, P):
        """(N, 3) -> (N, 2) head-front coordinates: +x toward the viewer's right, +y down, 1 = the half width."""
        return np.stack([-self.arc(P[:, 0], 0), -self.arc(P[:, 1], 1)], 1) / self.half


# ---------------------------------------------------------------- 3. draw: painter's front view, Catmull-Rom samples
def _cr(t):
    t2, t3 = t * t, t * t * t
    return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2]


def sample(img, uv):
    """Catmull-Rom bicubic, wrapped (GL_REPEAT), premultiplied RGBA image, uv with a top-left origin (glTF)."""
    H, W = img.shape[:2]
    x, y = uv[..., 0] * W - 0.5, uv[..., 1] * H - 0.5
    x0, y0 = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    wx, wy = _cr(x - x0), _cr(y - y0)
    out = np.zeros(uv.shape[:-1] + (4,), np.float32)
    for j in range(4):
        row = np.zeros_like(out)
        for i in range(4):
            row += img[(y0 + j - 1) % H, (x0 + i - 1) % W] * wx[i][..., None]
        out += row * wy[j][..., None]
    return np.clip(out, 0.0, 1.0)


def draw(prims, to_px, shape):
    """Every primitive's triangles at the pixel positions to_px gives, far to near, premultiplied RGBA."""
    H, W = shape
    out = np.zeros((H, W, 4), np.float32)
    tris = []
    for k in prims:
        pm = np.concatenate([k["img"][..., :3] * k["img"][..., 3:4], k["img"][..., 3:4]], -1).astype(np.float32)
        near = local_max(pm[..., 3], 2) > 0          # texels a bicubic sample can draw anything from
        XY = to_px(k["P"])
        for t in k["I"]:
            tris.append((k["P"][t, 2].mean(), XY[t], k["UV"][t], pm, near))
    tris.sort(key=lambda r: -r[0])
    for _, xy, uvs, pm, near in tris:
        xs, ys = xy[:, 0], xy[:, 1]
        x0, x1 = max(int(np.floor(xs.min())), 0), min(int(np.ceil(xs.max())), W - 1)
        y0, y1 = max(int(np.floor(ys.min())), 0), min(int(np.ceil(ys.max())), H - 1)
        if x1 < x0 or y1 < y0:
            continue
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1] + 0.5
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        l2 = 1 - l0 - l1
        m = (l0 >= 0) & (l1 >= 0) & (l2 > 0)        # half-open on one edge: shared edges are not drawn twice
        if not m.any():
            continue
        uv = l0[..., None] * uvs[0] + l1[..., None] * uvs[1] + l2[..., None] * uvs[2]
        Ht, Wt = near.shape
        m &= near[np.floor(uv[..., 1] * Ht).astype(np.int64) % Ht, np.floor(uv[..., 0] * Wt).astype(np.int64) % Wt]
        if not m.any():
            continue
        s = sample(pm, uv[m])
        sub = out[y0:y1 + 1, x0:x1 + 1]
        sub[m] = s + sub[m] * (1 - s[:, 3:4])
    return out


def texel_scale(prims, to_px):
    """Canvas px per source texel (area-weighted over the triangles that sample an area of their texture)."""
    num = den = 0.0
    for k in prims:
        XY = to_px(k["P"]) / SS
        H, W = k["img"].shape[:2]
        for t in k["I"]:
            a = XY[t]
            b = k["UV"][t] * (W, H)
            ca = abs(np.cross(a[1] - a[0], a[2] - a[0])) / 2
            cb = abs(np.cross(b[1] - b[0], b[2] - b[0])) / 2
            if cb > 0.5:
                num += ca
                den += cb
    return math.sqrt(num / den) if den else 1.0


LINE_REACH = 16        # px from an opaque dark core over which a line's soft edge is tightened


def local_max(a, r):
    """Max over a diamond of radius r in the last two axes."""
    m = a.copy()
    for _ in range(r):
        p = np.pad(m, [(0, 0)] * (m.ndim - 2) + [(1, 1), (1, 1)], mode="edge")
        m = np.maximum.reduce([p[..., 1:-1, 1:-1], p[..., :-2, 1:-1], p[..., 2:, 1:-1], p[..., 1:-1, :-2], p[..., 1:-1, 2:]])
    return m


def finish(pm, scale, ss=SS):
    """Premultiplied supersampled drawing -> straight RGBA at canvas density; coarse sources get their edges back."""
    h, w = pm.shape[0] // ss, pm.shape[1] // ss
    pm = pm[:h * ss, :w * ss].reshape(h, ss, w, ss, 4).mean(axis=(1, 3))
    a = pm[..., 3]
    rgb = pm[..., :3] / np.maximum(a, 1e-6)[..., None]
    # Black lines stay crisp: beside an opaque dark line core, the edge's alpha ramp is tightened to about one pixel
    # about its middle (an upscaled source ramps over `scale` px; a soft one over a few). Soft paint (a blush, grey
    # shading, a pink mouth) is not near a dark core and keeps its gradient.
    k = 0.5 / max(scale, 2.0)
    dark = (rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)) < 0.3
    core = local_max(np.where(dark, a, 0.0), LINE_REACH) > 0.9
    t = np.clip((a - (0.5 - k)) / (2 * k), 0, 1)
    a = np.where(core & dark, t * t * (3 - 2 * t), a)
    if scale > 2.0:
        # an upscaled source also blurs its colour edges inside the shape (a white tooth in a black outline): each
        # channel is pulled toward its local extremes across strong edges only
        r = int(math.ceil(scale))
        mn = -local_max(-rgb.transpose(2, 0, 1).reshape(-1, *rgb.shape[:2]).copy(), r)
        mx = local_max(rgb.transpose(2, 0, 1).reshape(-1, *rgb.shape[:2]).copy(), r)
        mn, mx = mn.transpose(1, 2, 0), mx.transpose(1, 2, 0)
        span = mx - mn
        u = np.clip((rgb - mn) / np.maximum(span, 1e-6), 0, 1)
        u = np.clip((u - (0.5 - k)) / (2 * k), 0, 1)
        rgb = np.where((span > 0.3) & (a[..., None] > 0.5), mn + span * u * u * (3 - 2 * u), rgb)
    a = np.where(a < 1 / 255, 0.0, a)
    return np.concatenate([np.where(a[..., None] > 0, rgb, 0.0), a[..., None]], -1).astype(np.float32)


def to_alpha(pm, base):
    """Colour to alpha: what the shell paints over its skin `base`, as a layer (GIMP's colour-to-alpha)."""
    a0 = pm[..., 3:4]
    rgb = pm[..., :3] / np.maximum(a0, 1e-6)
    b = np.asarray(base)
    d = np.where(rgb > b, (rgb - b) / np.maximum(1 - b, 1e-6), (b - rgb) / np.maximum(b, 1e-6))
    a = d.max(-1, keepdims=True)
    a = np.where(np.abs(rgb - b).max(-1, keepdims=True) < ACCENT_MIN * 0.6, 0.0, a)      # drop faint residue
    col = b + (rgb - b) / np.maximum(a, 1e-6)
    a = a * a0
    return np.concatenate([np.clip(col, 0, 1) * a, a], -1)


# ---------------------------------------------------------------- the whole set
def build(PX, anchors):
    """Cells of the set at PX px per face canvas: {key: (img, (ax, ay))} with keys as build_face.py's, plus the
    anchors the set adds and the names. key = ("eyes", id, "open" | "left"), ("mouth", id, None), ("extras", id, None)."""
    heads = {n: dict(shell=part("face", n)[0], eyes=part("eyes", n), mouth=part("mouth", n)) for n in FACES}
    unwrap = {n: Unwrap(h["shell"]) for n, h in heads.items()}

    def centroid_y(prims, uw):
        f = lambda P: (uw(P) + 2) * 100
        img = draw(prims, f, (400, 400))
        a = img[..., 3]
        ys = np.nonzero(a > 0.05)[0]
        return float((ys * a[a > 0.05]).sum() / a[a > 0.05].sum()) / 100 - 2

    # 2. place: the median eye line on our eye line, the median mouth on our mouth, the centre lines together
    ey = np.median([centroid_y(h["eyes"], unwrap[n]) for n, h in heads.items()])
    my = np.median([centroid_y(h["mouth"], unwrap[n]) for n, h in heads.items()])
    eye_u, eye_w = anchors["eye"]
    k = (anchors["mouth"][1] - eye_w) / (my - ey)          # canvas units per head half width
    w0 = eye_w - k * ey
    place = dict(scale=round(float(k), 4), eye_line=round(float(ey), 4), mouth_line=round(float(my), 4))
    new_anchors = {"eye_left": (1 - eye_u, eye_w)}

    def to_canvas(uw):
        return lambda P: np.stack([0.5 + k * uw(P)[:, 0], w0 + k * uw(P)[:, 1]], 1)

    def render_canvas(prims, uw, accent_base=None, region=None, px=PX, ss=SS):
        """The part drawn on the face canvas (cut to it, or to `region` [u0, w0, u1, w1]): straight RGBA at `px` per
        canvas and its canvas-px origin."""
        tc = to_canvas(uw)
        if region is None:
            uv = np.concatenate([tc(p["P"]) for p in prims])
            region = (uv[:, 0].min() - 0.01, uv[:, 1].min() - 0.01, uv[:, 0].max() + 0.01, uv[:, 1].max() + 0.01)
        u0, w0_, u1, w1 = max(0.0, region[0]), max(0.0, region[1]), min(1.0, region[2]), min(1.0, region[3])
        ox, oy = int(math.floor(u0 * px)), int(math.floor(w0_ * px))
        W, H = int(math.ceil(u1 * px)) - ox, int(math.ceil(w1 * px)) - oy
        to_px = lambda P: (tc(P) * px - (ox, oy)) * ss
        pm = draw(prims, to_px, (H * ss, W * ss))
        if accent_base is not None:
            pm = to_alpha(pm, accent_base)
        return finish(pm, texel_scale(prims, to_px) if px == PX else 1.0, ss), (ox, oy)

    def crop(img, origin, anchor_name, anchor_pt=None):
        ys, xs = np.nonzero(img[..., 3] > 0)
        if not len(xs):
            raise RuntimeError(f"empty cell {anchor_name}")
        y0, y1, x0, x1 = max(0, ys.min() - 1), min(img.shape[0], ys.max() + 2), max(0, xs.min() - 1), min(img.shape[1], xs.max() + 2)
        au, aw = anchor_pt if anchor_pt is not None else (anchors.get(anchor_name) or new_anchors[anchor_name])
        c = img[y0:y1, x0:x1]
        return c, (round(au * PX - origin[0] - x0, 2), round(aw * PX - origin[1] - y0, 2))

    out, names, info = {}, {}, {}
    for n, (eid, ename, mid, mname) in FACES.items():
        uw = unwrap[n]
        img, org = render_canvas(heads[n]["eyes"], uw)
        a = img[..., 3]
        centre = int(round(0.5 * PX)) - org[0]
        band = range(max(1, centre - int(0.06 * PX)), min(a.shape[1] - 1, centre + int(0.06 * PX)))
        col = min(band, key=lambda c: (a[:, c].sum(), abs(c - centre)))
        if a[:, col].max() > 0:                                     # something crosses the centre line: one cell
            out[("eyes", eid, "open")] = crop(img, org, "eye")
            info[eid] = "one cell"
        else:
            L, R = img[:, :col], img[:, col:]
            # the pair on a full-width strip, against its reflection about the canvas centre line
            full = np.zeros((img.shape[0], PX + 2 * img.shape[1]), np.float32)
            x = org[0] + img.shape[1]
            full[:, x:x + img.shape[1]] = img[..., 3]
            refl = np.zeros_like(full)
            refl[:, img.shape[1]:img.shape[1] + PX] = full[:, img.shape[1]:img.shape[1] + PX][:, ::-1]
            diff = np.abs(full - refl)[:, img.shape[1]:img.shape[1] + PX]
            on = (full[:, img.shape[1]:img.shape[1] + PX] > 0) | (refl[:, img.shape[1]:img.shape[1] + PX] > 0)
            same = bool(diff[on].mean() < 0.03)
            info_diff = float(diff[on].mean())
            out[("eyes", eid, "open")] = crop(L, org, "eye")
            if same:
                info[eid] = f"mirrored ({info_diff:.3f})"
            else:
                out[("eyes", eid, "left")] = crop(R, (org[0] + col, org[1]), "eye_left")
                info[eid] = f"two cells ({info_diff:.3f})"
        img, org = render_canvas(heads[n]["mouth"], uw)
        out[("mouth", mid, None)] = crop(img, org, "mouth")
        names[eid], names[mid] = ename, mname
    for n, (xid, xname) in ACCENTS.items():
        shell = heads[n]["shell"]
        base = np.median(shell["img"][..., :3].reshape(-1, 3), axis=0)
        lo, lorg = render_canvas([shell], unwrap[n], accent_base=base, region=(0, 0, 1, 1), px=128, ss=2)
        ys, xs = np.nonzero(lo[..., 3] > 0.02)
        region = ((lorg[0] + xs.min() - 2) / 128, (lorg[1] + ys.min() - 2) / 128, (lorg[0] + xs.max() + 3) / 128, (lorg[1] + ys.max() + 3) / 128)
        img, org = render_canvas([shell], unwrap[n], accent_base=base, region=region)
        if img[..., 3].max() < ACCENT_MIN:
            raise RuntimeError(f"accent {xid} carries nothing")
        ys, xs = np.nonzero(img[..., 3] > 0)
        pt = ((org[0] + (xs.min() + xs.max() + 1) / 2) / PX, (org[1] + (ys.min() + ys.max() + 1) / 2) / PX)
        new_anchors[xid] = (round(pt[0], 4), round(pt[1], 4))
        out[("extras", xid, None)] = crop(img, org, xid, new_anchors[xid])
        names[xid] = xname
    return out, new_anchors, names, dict(place=place, eyes=info)
