"""v7 animated painted face (specs/avatar-v7.md item 3, row 254): the feature atlas the engine animates with uniforms.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/v7/build_face.py [-- compose <out_dir>]

v6 composed one face canvas per look and expression and swapped whole textures (a blink was a texture swap to E8.1,
and nothing talked). v7 keeps v6's measured drawings (David's picks, row 192: F1.1-F2.2, E1.1 E1.2 E1.4 E1.6 E5.4
E5.5 E5.6 E6.1 E8.1 E8.4, M1.1-M6.3 and the whole G grid) and its placement on reference 18 (face_on_head), but
draws every feature ONCE into its own atlas cell, around an anchor:

  eyes    one eye (the character's right, canvas left), mirrored for the other side by the shader; every lidded eye
          also gets `half` and `closed` frames for the blink (the lid slides down over the iris, then a lid line)
  brows   one brow, white, tinted with the hair colour, mirrored; expressions move and tilt it about its anchor
  mouth   one cell per mouth, on the centre line (talk and emote frames are ordinary mouth cells)
  extras  blush and freckles on one cheek (mirrored), the mole where it is

The engine (web/lib/game/character/face.ts) draws a face as the skin colour plus up to seven layer slots, each an
atlas rect placed at its anchor on the face canvas, so blinking, talking and expressions only change uniforms: no
canvas is redrawn per frame. The face canvas is head_shape.face_chart (arc lengths, 2 FH = 0.449 m per canvas), the
UV layout of the v7 head, so a cell keeps its drawn size and shape on the head.

Output (art/characters/v7/face/):
  v7_face_atlas.png       cells at 1024 px per face canvas (the creator), 16 px transparent gutters, colour bled into
                          the gutters so mipmaps never darken an edge
  v7_face_atlas_512.png   the same at half size (the world: 512 px per face canvas)
  face_v7.json            cells, anchors, frames, expressions, talk and emote mouth cycles
  v7_face_default.png     skin + brows + F1.1 + M1.1 at 1024 (the .blend's M_Face preview, Blender review renders)
With `compose <dir>`, also writes composed faces for the review sheets (expressions, blink, talk).

face_set_301.py adds the row-301 parts (sleepy and dot eyes, cat and curled-grin mouths, the blush band). They are
packed in a band below the earlier cells, which keep their exact rects and pixels.

face_set_305.py adds David's 19 faces (row 305 set: 19 eyes, 19 mouths, 2 accents) on a second atlas page,
v7_face_atlas_2.png (and its _512 world copy), which the engine loads only for a look that wears one of them. Their
cells carry a 7th value, the page (1). The first page is unchanged by them.
"""
import bpy, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "base"))
sys.path.insert(0, HERE)
from head_shape import face_chart, EYE_LAT, EYE_LON, MOUTH_LAT, FH  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
COMPOSE_DIR = ARGS[ARGS.index("compose") + 1] if "compose" in ARGS else None
OUT = os.path.join(HERE, "face")
PAL = json.load(open(os.path.join(HERE, "..", "palette.json")))
D = PAL["ref_girl_defaults"]
PX = 1024              # atlas density: px per face canvas (2 FH of arc)
GUTTER = 16            # transparent border round every cell (8 px at half size, enough for three mip levels)


def hex_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


SKIN, HAIR = PAL["skin"][D["skin"]], PAL["hair"][D["hair"]]
C_EYE = hex_srgb("#3E3438")      # soft dark grey-brown blob (F sheet)
C_DOLL = hex_srgb("#221A1C")     # near-black doll eye (E sheet)
C_LID = hex_srgb("#16100F")
C_CREASE = hex_srgb("#D49A9A")
C_WHITE = (1.0, 1.0, 1.0)
C_LINE = hex_srgb("#8E3B3E")     # mouth line
C_PINK = hex_srgb("#F29AA3")
C_INNER = hex_srgb("#D9687A")
C_DARKM = hex_srgb("#6E2230")
C_TONGUE = hex_srgb("#F07A8A")
C_BLUSH = hex_srgb("#F4A0A0")
C_MOLE = hex_srgb("#5A3A2E")

# ---------------------------------------------------------------- placement (as v6: measured on reference 18)
# Features are authored at v6's authoring centres (canvas units) and scaled onto the face canvas round the measured
# anchors: eye centres at lat EYE_LAT, lon -EYE_LON (canvas left = the character's right), K_EYE = 1.2 makes the
# irises reference 18's 0.068 m; brows 0.063 m of arc above the eye centre; the mouth on the centre line at MOUTH_LAT.
EYE_Y, EYE_L = 0.60, 0.29                 # authoring centres (v6)
BROW_Y = 0.458
MX, MY = 0.5, 0.755
ANCHOR = {}
ANCHOR["eye"] = face_chart(EYE_LAT, -EYE_LON)
ANCHOR["brow"] = (ANCHOR["eye"][0], ANCHOR["eye"][1] - 0.14)
ANCHOR["mouth"] = (0.5, face_chart(MOUTH_LAT, 0)[1])
ANCHOR["cheek"] = face_chart(-24, -36)
ANCHOR["mole"] = face_chart(-44, 16)
K = {"eye": 1.2, "brow": 1.0, "mouth": 1.3, "cheek": 1.0, "mole": 1.0}
AUTH = {"eye": (EYE_L, EYE_Y), "brow": (EYE_L, BROW_Y), "mouth": (MX, MY), "cheek": ANCHOR["cheek"], "mole": ANCHOR["mole"]}
BOX = {"eye": (0.17, 0.15), "brow": (0.09, 0.05), "mouth": (0.12, 0.09), "cheek": (0.12, 0.08), "mole": (0.02, 0.02)}


class Layer:
    """One cell: a box of half size BOX[kind] (canvas units) round the anchor, supersampled; drawing happens in v6
    authoring coordinates (warped: final = anchor + (auth - auth_centre) * K)."""

    def __init__(self, kind, ss=4):
        hu, hw = BOX[kind]
        self.W, self.H = round(2 * hu * PX), round(2 * hw * PX)
        self.ss = ss
        ys, xs = np.mgrid[0:self.H * ss, 0:self.W * ss].astype(np.float32)
        U = -hu + (xs + 0.5) / (self.W * ss) * 2 * hu          # offset from the anchor, canvas units
        V = -hw + (ys + 0.5) / (self.H * ss) * 2 * hw
        ac = AUTH[kind]
        self.U, self.V = ac[0] + U / K[kind], ac[1] + V / K[kind]
        self.rgb = np.zeros(self.U.shape + (3,), np.float32)
        self.a = np.zeros(self.U.shape, np.float32)
        self.anchor_px = (self.W / 2, self.H / 2)

    def ellipse(self, cx, cy, rx, ry=None, rot=0.0):
        ry = rx if ry is None else ry
        dx, dy = self.U - cx, self.V - cy
        c, s = math.cos(rot), math.sin(rot)
        lx, ly = dx * c + dy * s, -dx * s + dy * c
        return (lx / rx) ** 2 + (ly / ry) ** 2 <= 1

    def squircle(self, cx, cy, r, n=4.0):
        return (np.abs(self.U - cx) / r) ** n + (np.abs(self.V - cy) / r) ** n <= 1

    def poly(self, pts):
        X, Y = self.U, self.V
        inside = np.zeros(X.shape, bool)
        n = len(pts)
        for i in range(n):
            (xi, yi), (xj, yj) = pts[i], pts[(i + 1) % n]
            inside ^= ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi + 1e-12) + xi)
        return inside

    def stroke(self, pts, r):
        rs = r if isinstance(r, (list, tuple)) else [r] * len(pts)
        m = np.zeros(self.U.shape, bool)
        for (x0, y0), (x1, y1), r0, r1 in zip(pts[:-1], pts[1:], rs[:-1], rs[1:]):
            ax, ay = self.U - x0, self.V - y0
            bx, by = x1 - x0, y1 - y0
            h = np.clip((ax * bx + ay * by) / (bx * bx + by * by + 1e-12), 0, 1)
            rr = r0 + (r1 - r0) * h
            m |= (ax - bx * h) ** 2 + (ay - by * h) ** 2 <= rr * rr
        return m

    def paint(self, mask, rgb, alpha=1.0):
        k = mask.astype(np.float32) * alpha
        na = k + self.a * (1 - k)
        col = np.array(rgb, np.float32)
        self.rgb = (col * k[..., None] + self.rgb * (self.a * (1 - k))[..., None]) / np.where(na > 0, na, 1)[..., None]
        self.a = na

    def image(self):
        s = self.ss
        pm = (self.rgb * self.a[..., None]).reshape(self.H, s, self.W, s, 3).mean(axis=(1, 3))
        a = self.a.reshape(self.H, s, self.W, s).mean(axis=(1, 3))
        out = np.zeros((self.H, self.W, 4), np.float32)
        out[..., :3] = pm / np.where(a > 0, a, 1)[..., None]
        out[..., 3] = a
        return out


def bez(pts, n=16):
    if len(pts) == 3:
        p0, p1, p2 = pts
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]
    if len(pts) == 4:
        p0, p1, p2, p3 = pts
        return [(((1 - t) ** 3) * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0],
                 ((1 - t) ** 3) * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1])
                for t in (i / n for i in range(n + 1))]
    return pts


def taper(n, r0, r1, r2=None):
    if r2 is None:
        return [r0 + (r1 - r0) * i / (n - 1) for i in range(n)]
    h = (n - 1) / 2
    return [r0 + (r1 - r0) * i / h if i <= h else r1 + (r2 - r1) * (i - h) / h for i in range(n)]


# ================================================================ eyes: one eye, with blink frames
# The canvas-left eye (the character's right): outward is -U, so P(dx, dy) = (EYE_L - dx, EYE_Y + dy), as v6's
# eye_pair drew it for that side. Each eye is a spec: iris mask, its colour, the lid curve (4 Bezier points, dx/dy),
# lid stroke radii, decorations that ride on the lid (wing, lashes, crease) and a highlight. Frames: `open` is v6's
# drawing; `half` slides the lid (and what rides on it) down to just above the iris centre and hides the iris above
# it; `closed` is the lid line bowed down across the eye (a shut eye).
S = -1


def P(dx, dy):
    return (EYE_L + S * dx, EYE_Y + dy)


def shifted(pts, d):
    return [(x, y + d) for x, y in pts]


def below(L, pts):
    c = bez([P(*p) for p in pts], 24)
    return L.poly(c + [(c[-1][0], c[-1][1] + 0.4), (c[0][0], c[0][1] + 0.4)])


F11_LID = [(-0.094, -0.006), (-0.05, -0.07), (0.056, -0.074), (0.1, -0.024)]     # ref 18: lid 1.8x the iris wide


def f11_deco(L, d, frame):
    if frame == "closed":
        return
    L.paint(L.poly([P(0.092, -0.034 + d), P(0.118, -0.008 + d), P(0.104, -0.028 + d), P(0.096, -0.018 + d)]), C_LID)
    c = bez([P(-0.056, -0.082 + d * 0.6), P(0.0, -0.104 + d * 0.6), P(0.07, -0.086 + d * 0.6)], 12)
    L.paint(L.stroke(c, taper(len(c), 0.002, 0.004, 0.002)), C_CREASE, 0.8)


def lashes(ticks):
    def draw(L, d, frame):
        if frame == "closed":
            return
        for (x0, y0), (x1, y1) in ticks:
            L.paint(L.stroke([P(x0, y0 + d), P(x1, y1 + d)], 0.0038), C_LID)
    return draw


def hl(r=0.018, dx=-0.024, dy=-0.022):
    return (r, dx, dy)


EYE_SPECS = {
    "F1.1": dict(iris=lambda L: L.ellipse(*P(0.004, 0.004), 0.06, 0.07), col=C_EYE, lid=F11_LID, lr=(0.004, 0.013, 0.008),
                 cut=True, deco=f11_deco, iris_c=0.004),
    "F1.2": dict(iris=lambda L: L.squircle(*P(-0.004, 0.006), 0.056, 3.2), col=C_EYE,
                 lid=[(-0.07, -0.03), (-0.03, -0.074), (0.06, -0.07), (0.084, 0.03)], lr=(0.004, 0.012, 0.005), cut=True, iris_c=0.006),
    "F2.1": dict(iris=lambda L: L.ellipse(*P(0.0, 0.012), 0.058, 0.045), col=C_EYE,
                 lid=[(-0.075, -0.004), (-0.02, -0.03), (0.05, -0.03), (0.098, 0.0)], lr=(0.004, 0.011, 0.004), cut=True, iris_c=0.012),
    "F2.2": dict(iris=lambda L: L.ellipse(*P(0.0, 0.014), 0.056, 0.05), col=C_EYE,
                 lid=[(-0.075, 0.012), (-0.03, -0.04), (0.05, -0.04), (0.098, -0.012)], lr=(0.004, 0.012, 0.004), cut=True, iris_c=0.014),
    "E1.1": dict(iris=lambda L: L.ellipse(*P(0.0, 0.006), 0.062, 0.066), col=C_DOLL,
                 lid=[(-0.06, -0.032), (-0.02, -0.07), (0.04, -0.07), (0.07, -0.03)], lr=(0.003, 0.009, 0.004), cut=False,
                 deco=lashes([((0.058, -0.04), (0.085, -0.05)), ((0.062, -0.032), (0.089, -0.038))]), hl=hl(), iris_c=0.006),
    "E1.2": dict(iris=lambda L: L.ellipse(*P(0.0, 0.0), 0.062, 0.058) & (L.V > EYE_Y - 0.012), col=C_DOLL,
                 lid=[(-0.07, -0.014), (-0.02, -0.014), (0.03, -0.014), (0.075, -0.014)], lr=(0.006, 0.006, 0.006), cut=True,
                 hl=hl(0.014, -0.02, 0.008), iris_c=0.02),
    "E1.4": dict(iris=lambda L: L.ellipse(*P(0.0, 0.01), 0.058, 0.062), col=C_DOLL,
                 lid=[(-0.075, -0.02), (-0.03, -0.068), (0.05, -0.068), (0.085, -0.02)], lr=(0.004, 0.011, 0.004), cut=False,
                 deco=lashes([((0.07, -0.045), (0.095, -0.05)), ((0.082, -0.027), (0.107, -0.03))]), hl=hl(0.016), iris_c=0.01),
    "E1.6": dict(iris=lambda L: L.ellipse(*P(0.0, -0.01), 0.042, 0.04) & (L.V > EYE_Y - 0.01), col=C_DOLL,
                 lid=[(-0.07, -0.01), (-0.02, -0.011), (0.03, -0.013), (0.07, -0.014)], lr=(0.009, 0.009, 0.009), cut=True, iris_c=0.012),
    "E5.4": dict(iris=lambda L: L.ellipse(*P(0.0, 0.012), 0.046), col=C_DOLL,
                 lid=[(-0.07, -0.02), (-0.0233, -0.0633), (0.025, -0.065), (0.075, -0.025)], lr=(0.003, 0.007, 0.003), cut=False,
                 hl=hl(0.013, -0.015, -0.005), iris_c=0.012),
    "E5.5": dict(iris=lambda L: L.ellipse(*P(0.0, 0.012), 0.056), col=C_DOLL,
                 lid=[(-0.07, -0.012), (-0.03, -0.064), (0.0217, -0.0667), (0.085, -0.02)], lr=(0.003, 0.009, 0.004), cut=False,
                 hl=hl(0.015, -0.02, -0.01), iris_c=0.012),
    "E8.4": dict(iris=lambda L: (L.ellipse(*P(0, 0), 0.062) & ~L.ellipse(*P(0, 0), 0.05)), col=C_DOLL,
                 lid=[(-0.06, -0.008), (-0.02, -0.008), (0.02, -0.008), (0.06, -0.008)], lr=(0.006, 0.006, 0.006), cut=False,
                 inner=lambda L: L.ellipse(*P(0.0, 0.018), 0.03) & L.ellipse(*P(0, 0), 0.05), iris_c=0.0),
}


def draw_spec(L, spec, frame):
    lid = spec["lid"]
    top = min(y for _, y in lid[1:3])
    d = {"open": 0.0, "half": max(0.0, spec["iris_c"] - 0.012 - top) * 0.85}.get(frame, 0.0)
    if frame == "closed":
        x0, x3 = lid[0][0], lid[3][0]
        y = spec["iris_c"] - 0.004
        c = bez([P(x0, y - 0.004), P(x0 + (x3 - x0) * 0.3, y + 0.022), P(x0 + (x3 - x0) * 0.7, y + 0.022), P(x3, y - 0.004)], 20)
        L.paint(L.stroke(c, taper(len(c), spec["lr"][0], max(spec["lr"][1], 0.008), spec["lr"][2])), C_LID if spec["col"] == C_EYE else spec["col"])
        return
    lid_d = shifted(lid, d)
    cut = spec["cut"] or frame == "half"
    iris = spec["iris"](L)
    if cut:
        iris = iris & below(L, lid_d)
    L.paint(iris, spec["col"])
    if spec.get("inner"):
        m = spec["inner"](L) & (L.V > EYE_Y - 0.008 + d)
        L.paint(m, spec["col"])
    c = bez([P(*p) for p in lid_d], 20)
    L.paint(L.stroke(c, taper(len(c), *spec["lr"])), C_LID if spec["col"] == C_EYE else spec["col"])
    if spec.get("deco"):
        spec["deco"](L, d, frame)
    if spec.get("hl"):
        r, dx, dy = spec["hl"]
        m = L.ellipse(*P(dx, dy), r)
        if frame == "half":
            m = m & below(L, lid_d)
        L.paint(m, C_WHITE)


def e5_6(L):     # "U" shield: an outline cup with a flat top and a pupil
    c = bez([P(-0.052, -0.045), P(-0.056, 0.07), P(0.056, 0.07), P(0.052, -0.045)], 20)
    L.paint(L.stroke(c, 0.009), C_DOLL)
    L.paint(L.stroke([P(-0.058, -0.045), P(0.058, -0.045)], 0.008), C_DOLL)
    L.paint(L.ellipse(*P(0.0, 0.022), 0.022), C_DOLL)


def e6_1(L):     # ">" (the canvas-left eye; mirrored it is "<")
    L.paint(L.stroke([P(0.045, -0.042), P(-0.04, 0.0), P(0.045, 0.042)], 0.012), C_DOLL)


def e8_1(L):     # a thick bowed stroke: a shut, smiling eye
    c = bez([P(-0.06, 0.012), P(0.0, -0.012), P(0.062, 0.006)])
    L.paint(L.stroke(c, taper(len(c), 0.008, 0.014, 0.007)), C_DOLL)


EYE_PLAIN = {"E5.6": e5_6, "E6.1": e6_1, "E8.1": e8_1}
EYE_ORDER = ["F1.1", "F1.2", "F2.1", "F2.2", "E1.1", "E1.2", "E1.4", "E1.6", "E5.4", "E5.5", "E5.6", "E6.1", "E8.1", "E8.4"]


# ================================================================ mouths (centred at MX, MY) : v6's drawings
def P0(dx, dy):
    return (MX + dx, MY + dy)


def m_line(L, pts, r=0.0055, taper_ends=True):
    c = bez([P0(*p) for p in pts]) if len(pts) in (3, 4) else [P0(*p) for p in pts]
    rr = taper(len(c), r * 0.6, r, r * 0.6) if taper_ends else r
    L.paint(L.stroke(c, rr), C_LINE)


def m_open(L, hw, h, top=0.0, teeth=True, fangs=False, dark=False, tongue=True, dy=0.0):
    def P(x, y):
        return P0(x, y + dy)
    top_pts = bez([P(-hw, -h * 0.4), P(0, -h * 0.4 + top), P(hw, -h * 0.4)], 12)
    bot_pts = bez([P(hw, -h * 0.4), P(hw * 0.9, h * 0.75), P(-hw * 0.9, h * 0.75), P(-hw, -h * 0.4)], 20)
    shape = L.poly(top_pts + bot_pts[1:-1])
    L.paint(shape, C_DARKM if dark else C_PINK)
    if tongue:
        L.paint(shape & L.ellipse(*P(0, h * 0.5), hw * 0.6, h * 0.35), C_INNER if not dark else C_TONGUE)
    if teeth:
        L.paint(shape & (L.V < MY + dy - h * 0.4 + top + 0.008) & (np.abs(L.U - MX) < hw * 0.45), C_WHITE)
    if fangs:
        for sx in (-1, 1):
            L.paint(shape & L.poly([P(sx * hw * 0.62, -h * 0.4 + top * 0.5), P(sx * hw * 0.42, -h * 0.4 + top * 0.8),
                                    P(sx * hw * 0.54, -h * 0.4 + 0.013)]), C_WHITE)
    L.paint(L.stroke(top_pts + bot_pts[1:], 0.0042), C_LINE)


def m_grin(L, hw, h, top=0.0):
    top_pts = bez([P0(-hw, -h * 0.4), P0(0, -h * 0.4 + top), P0(hw, -h * 0.4)], 12)
    bot_pts = bez([P0(hw, -h * 0.4), P0(hw * 0.85, h * 0.7), P0(-hw * 0.85, h * 0.7), P0(-hw, -h * 0.4)], 20)
    shape = L.poly(top_pts + bot_pts[1:-1])
    L.paint(shape, C_WHITE)
    L.paint(L.stroke(bez([P0(-hw * 0.8, h * 0.05), P0(0, h * 0.2), P0(hw * 0.8, h * 0.05)]), 0.0028), C_LINE)
    L.paint(L.stroke(top_pts + bot_pts[1:], 0.0045), C_LINE)


def m_oval(L, rx, ry, dark=False, dy=0.0):
    e = L.ellipse(*P0(0, dy), rx, ry)
    L.paint(e, C_DARKM if dark else C_PINK)
    L.paint(e & L.ellipse(*P0(0, dy + ry * 0.5), rx * 0.7, ry * 0.5), C_INNER if not dark else C_TONGUE)
    L.paint(e & ~L.ellipse(*P0(0, dy), rx - 0.0045, ry - 0.0045), C_LINE)


def m_poly(L, pts):
    p = [P0(*q) for q in pts]
    L.paint(L.poly(p), C_PINK)
    L.paint(L.stroke(p + [p[0]], 0.004), C_LINE)


def m_lips(L, hw, hh, line=True):
    e = L.ellipse(*P0(0, 0), hw, hh)
    L.paint(e, C_PINK)
    L.paint(e & ~L.ellipse(*P0(0, 0), hw - 0.004, hh - 0.004), C_LINE)
    if line:
        L.paint(L.stroke([P0(-hw * 0.8, 0), P0(hw * 0.8, 0)], 0.0028), C_LINE)


def m_tongue(L, tx, ty, rx=0.014, ry=0.011, rot=0.5):
    e = L.ellipse(*P0(tx, ty), rx, ry, rot)
    L.paint(e, C_TONGUE)
    L.paint(e & ~L.ellipse(*P0(tx, ty), rx - 0.0035, ry - 0.0035, rot), C_LINE)


def wave(x0, x1, amp, periods, n=24, dy=0.0):
    return [(x0 + (x1 - x0) * i / n, dy + amp * math.sin(i / n * periods * math.tau)) for i in range(n + 1)]


MOUTHS = {
    "M1.1": lambda L: (m_line(L, [(-0.042, 0.002), (0, -0.007), (0.042, 0.002)], 0.0046, False),
                       m_line(L, [(-0.044, -0.012), (-0.047, 0.012)], 0.0048, False),
                       m_line(L, [(0.044, -0.012), (0.041, 0.014)], 0.0048, False)),
    "M1.2": lambda L: (m_line(L, [(0.008, -0.02), (-0.02, -0.02), (-0.002, -0.001)]),
                       m_line(L, [(-0.002, -0.001), (-0.02, 0.016), (0.008, 0.018)])),
    "M2.1": lambda L: m_open(L, 0.05, 0.042, 0.004),
    "M2.2": lambda L: m_poly(L, [(-0.028, -0.02), (0.036, 0.006), (-0.018, 0.02)]),
    "M3.1": lambda L: m_oval(L, 0.018, 0.024),
    "M3.2": lambda L: (m_line(L, [(-0.03, 0.0), (0.005, 0.009), (0.04, 0.006)]),
                       m_line(L, [(-0.03, 0.0), (-0.037, -0.014)], 0.0045, False)),
    "M3.3": lambda L: m_line(L, wave(-0.045, 0.045, 0.004, 2)),
    "M4.2": lambda L: m_line(L, [(-0.045, -0.004), (0, 0.009), (0.045, -0.004)]),
    "M4.3": lambda L: m_line(L, [(-0.04, 0.007), (0, -0.009), (0.04, 0.007)]),
    "M5.2": lambda L: (m_tongue(L, 0.03, 0.01), m_line(L, [(-0.045, -0.002), (0, 0.005), (0.035, 0.0)])),
    "M5.3": lambda L: m_line(L, wave(-0.05, 0.05, 0.0035, 1.0)),
    "M6.1": lambda L: (m_oval(L, 0.024, 0.028), L.paint(L.ellipse(*P0(0, 0), 0.0195, 0.0235) & (L.V < MY - 0.01), C_WHITE)),
    "M6.3": lambda L: m_line(L, [(-0.04, -0.007), (0.0, 0.004), (0.042, 0.009)]),
}
_G = {
    1: lambda c: lambda L: m_open(L, [.05, .05, .035, .045, .05, .04, .045][c], [.04, .035, .03, .035, .018, .034, .02][c],
                                  [.004, .006, .004, .002, 0, .003, 0][c], teeth=c != 3, dark=c in (3, 6), fangs=c == 5),
    2: lambda c: lambda L: m_open(L, [.045, .04, .035, .045, .045, .04, .045][c], [.045, .04, .02, .042, .035, .05, .045][c],
                                  0.0, teeth=c in (2, 3, 6), fangs=c in (0, 1, 4)),
    3: lambda c: lambda L: [
        lambda: m_line(L, [(-0.035, -0.003), (0, 0.005), (0.035, -0.003)]),
        lambda: m_line(L, [(-0.035, -0.004), (-0.018, 0.005), (0, -0.002), (0.018, 0.005), (0.035, -0.004)]),
        lambda: m_line(L, [(-0.05, -0.006), (0, 0.009), (0.05, -0.006)]),
        lambda: (m_line(L, [(-0.035, 0), (0.035, 0)], 0.005, False), m_line(L, [(-0.035, 0), (-0.04, -0.008)], 0.004, False),
                 m_line(L, [(0.035, 0), (0.04, -0.008)], 0.004, False)),
        lambda: m_line(L, wave(-0.03, 0.03, 0.004, 1.5)),
        lambda: m_line(L, [(-0.009, 0.004), (0, -0.004), (0.009, 0.004)], 0.004, False),
        lambda: m_line(L, wave(-0.045, 0.045, 0.005, 2.5)),
    ][c](),
    4: lambda c: lambda L: m_grin(L, [.05, .05, .04, .045, .05, .05, .045][c], [.03, .028, .022, .025, .028, .03, .028][c],
                                  [.004, .006, .002, 0, .006, .004, 0][c]),
    5: lambda c: lambda L: m_oval(L, [.016, .01, .009, .009, .016, .01, .011][c], [.02, .012, .012, .012, .02, .014, .015][c],
                                  dark=c in (2, 3)),
    6: lambda c: lambda L: [
        lambda: m_lips(L, 0.03, 0.012),
        lambda: L.paint(L.ellipse(*P0(0, 0), 0.007) & ~L.ellipse(*P0(0, 0), 0.0035), C_LINE),
        lambda: m_poly(L, [(-0.009, 0.006), (0.009, 0.006), (0, -0.008)]),
        lambda: m_poly(L, [(-0.018, 0.012), (0.018, 0.012), (0, -0.016)]),
        lambda: m_lips(L, 0.016, 0.005, False),
        lambda: (m_oval(L, 0.018, 0.018, dark=True), m_tongue(L, 0.004, 0.018, 0.012, 0.01, 0.0)),
        lambda: m_lips(L, 0.05, 0.022),
    ][c](),
    7: lambda c: lambda L: [
        lambda: m_lips(L, 0.05, 0.026),
        lambda: m_lips(L, 0.04, 0.014),
        lambda: m_lips(L, 0.03, 0.01),
        lambda: (m_line(L, [(-0.012, 0), (0.012, 0)], 0.004, False), m_tongue(L, 0, 0.01, 0.009, 0.009, 0)),
        lambda: m_tongue(L, 0, 0.004, 0.007, 0.007, 0),
        lambda: (m_line(L, [(-0.04, -0.004), (0, 0.006), (0.03, 0.0)]), m_tongue(L, 0.03, 0.01)),
        lambda: (m_line(L, [(-0.035, 0.006), (0, -0.004), (0.035, 0.006)]), m_tongue(L, 0.0, 0.006, 0.01, 0.01, 0)),
    ][c](),
    8: lambda c: lambda L: [
        lambda: m_line(L, [(-0.03, 0.0), (-0.012, 0.006), (0.005, -0.002), (0.02, 0.006), (0.03, 0.0)]),
        lambda: (L.paint(L.ellipse(*P0(0, 0), 0.022, 0.007), C_WHITE),
                 L.paint(L.ellipse(*P0(0, 0), 0.022, 0.007) & ~L.ellipse(*P0(0, 0), 0.018, 0.0035), C_LINE)),
        lambda: m_line(L, [(-0.012, -0.004), (0, 0.006), (0.012, -0.004)]),
        lambda: (m_lips(L, 0.02, 0.007, False), m_line(L, [(0.02, 0), (0.026, -0.006)], 0.004, False)),
        lambda: m_lips(L, 0.018, 0.006, True),
        lambda: m_line(L, [(-0.02, 0.0), (0.02, 0.002)]),
        lambda: m_line(L, [(-0.008, 0.0), (0.008, 0.0)], 0.004, False),
    ][c](),
    9: lambda c: lambda L: [
        lambda: m_line(L, [(-0.007, 0.003), (0, -0.003), (0.007, 0.003)], 0.0038, False),
        lambda: (m_line(L, [(-0.012, 0.002), (0.012, -0.001)], 0.004, False), m_line(L, [(0.008, -0.008), (0.006, 0.008)], 0.0035, False)),
        lambda: m_line(L, [(-0.01, -0.006), (0, 0.004), (0.004, -0.008)], 0.0038, False),
        lambda: m_line(L, [(-0.012, -0.004), (-0.004, 0.004), (0, -0.002), (0.004, 0.004), (0.012, -0.004)], 0.0035, False),
        lambda: (m_line(L, [(-0.02, 0.0), (0.006, 0.0)], 0.004, False), m_line(L, [(0.01, -0.006), (0.018, 0.004)], 0.0035, False)),
        lambda: m_line(L, [(-0.009, -0.004), (0, 0.005), (0.009, -0.004)], 0.0038, False),
        lambda: m_line(L, wave(-0.018, 0.018, 0.0025, 2)),
    ][c](),
}
for r in range(1, 10):
    for c in range(7):
        MOUTHS[f"G{r}.{c + 1}"] = _G[r](c)


# talk frames (David, 2026-09-30: "Bigger talk shapes"): larger open mouths while talking, in the picks' own style
# (M3.1's open oval, M6.1's oval with teeth, M2.1's open smile); the resting mouth stays the look's own. The mouth
# sits where the face turns under towards the chin, so the camera sees it about half as tall as drawn: the talk cells
# are drawn about 1.7x taller than those picks' proportions and grow upwards (dy < 0), keeping their lower edge above
# the jaw line.
TALK_CELLS = {
    "T1": lambda L: m_oval(L, 0.026, 0.046, dy=-0.010),                              # M3.1's open oval
    "T2": lambda L: (m_oval(L, 0.036, 0.056, dy=-0.010),
                     L.paint(L.ellipse(*P0(0, -0.010), 0.031, 0.051) & (L.V < MY - 0.010 - 0.026), C_WHITE)),   # M6.1
    "T3": lambda L: m_open(L, 0.064, 0.088, 0.008, dy=-0.022),                      # M2.1's open smile, wide open
    "T4": lambda L: m_open(L, 0.054, 0.058, 0.004, teeth=False, dy=-0.012),         # half open
}


# ================================================================ brows (white, tinted with hair) and extras
def brow_soft(L):
    c = bez([(EYE_L + 0.05, BROW_Y + 0.006), (EYE_L, BROW_Y - 0.01), (EYE_L - 0.05, BROW_Y + 0.002)])
    L.paint(L.stroke(c, taper(len(c), 0.006, 0.0085, 0.004)), C_WHITE)


def brow_flat(L):
    L.paint(L.stroke([(EYE_L + 0.045, BROW_Y), (EYE_L - 0.045, BROW_Y - 0.002)], 0.01), C_WHITE)


BROWS = {"brow_soft": brow_soft, "brow_flat": brow_flat}
CH = ANCHOR["cheek"]
EXTRAS = {   # kind, mirrored
    "blush": ("cheek", True, lambda L: L.paint(L.ellipse(CH[0], CH[1], 0.075, 0.036), C_BLUSH, 0.45)),
    "freckles": ("cheek", True, lambda L: [L.paint(L.ellipse(CH[0] + du, CH[1] + dv, 0.0055), C_MOLE, 0.55)
                                           for du, dv in ((-0.02, -0.01), (0.012, -0.018), (0.01, 0.012))]),
    "mole": ("mole", False, lambda L: L.paint(L.ellipse(*ANCHOR["mole"], 0.008), C_MOLE)),
}

# ================================================================ expressions, blink, talk (engine data)
# Expression = which eye / mouth cell it forces (null = the look's own) + the brow pose: dy (canvas units, + down)
# and tilt (degrees, + raises the inner end, toward the nose). Six per row 144, eyes and mouths from the picks.
EXPRESSIONS = {
    "neutral": {"eyes": None, "eyeFrame": "open", "mouth": None, "brow": [0.0, 0.0]},
    "happy": {"eyes": "E8.1", "eyeFrame": "open", "mouth": "M2.1", "brow": [-0.014, 0.0]},
    "surprised": {"eyes": None, "eyeFrame": "open", "mouth": "M6.1", "brow": [-0.03, 0.0]},
    "sad": {"eyes": None, "eyeFrame": "half", "mouth": "M4.3", "brow": [-0.006, 14.0]},
    "angry": {"eyes": None, "eyeFrame": "open", "mouth": "M2.2", "brow": [0.012, -18.0]},
    "sleepy": {"eyes": "E1.6", "eyeFrame": "open", "mouth": "M3.1", "brow": [0.008, 4.0]},
}
BLINK = {"interval": [2.0, 6.0], "frames": [["half", 0.04], ["closed", 0.07], ["half", 0.04]]}
TALK = {"frames": list(TALK_CELLS), "rate": 9.0,
        "note": "while talking the mouth steps through these cells (layers.talk, larger open mouths) and the look's own "
                "resting mouth about 9 times a second, picked at random so it never loops visibly; chat bubbles and "
                "resident dialogue drive it"}
EMOTE_MOUTH = {"Laugh": {"frames": ["M2.1", "G1.1"], "rate": 7.0}, "Cheer": {"frames": ["M2.1", "G2.1"], "rate": 4.0},
               "Dance": {"frames": ["M2.1", "G1.3"], "rate": 3.0}}

# ================================================================ row 301 set (face_set_301.py): appended, packed apart
import face_set_301  # noqa: E402
SET_EYES, SET_MOUTHS, SET_EXTRAS, SET_ANCHORS, SET_KINDS = face_set_301.parts(globals())
ANCHOR.update(SET_ANCHORS)
for _kind, _t in SET_KINDS.items():
    K[_kind], AUTH[_kind], BOX[_kind] = _t["K"], _t["AUTH"], _t["BOX"]
EYE_PLAIN.update(SET_EYES)
EYE_ORDER += list(SET_EYES)
MOUTHS.update(SET_MOUTHS)
EXTRAS.update(SET_EXTRAS)
SET_KEYS = {("eyes", e, "open") for e in SET_EYES} | {("mouth", m, None) for m in SET_MOUTHS} | {("extras", x, None) for x in SET_EXTRAS}


# ================================================================ render, crop, pack
def render(kind, fn, *a):
    L = Layer(kind)
    fn(L, *a)
    img = L.image()
    ys, xs = np.nonzero(img[..., 3] > 1 / 255)
    if not len(xs):
        raise RuntimeError(f"empty cell {kind} {fn}")
    y0, y1 = max(0, ys.min() - 1), min(img.shape[0], ys.max() + 2)
    x0, x1 = max(0, xs.min() - 1), min(img.shape[1], xs.max() + 2)
    return img[y0:y1, x0:x1], (L.anchor_px[0] - x0, L.anchor_px[1] - y0)


cells = {}      # key -> (img, anchor offset in the cell)
for eid in EYE_ORDER:
    if eid in EYE_SPECS:
        for frame in ("open", "half", "closed"):
            cells[("eyes", eid, frame)] = render("eye", draw_spec, EYE_SPECS[eid], frame)
    else:
        cells[("eyes", eid, "open")] = render("eye", EYE_PLAIN[eid])
for bid, fn in BROWS.items():
    cells[("brows", bid, None)] = render("brow", fn)
for mid, fn in MOUTHS.items():
    cells[("mouth", mid, None)] = render("mouth_wide" if mid in SET_MOUTHS else "mouth", fn)
for tid, fn in TALK_CELLS.items():
    cells[("talk", tid, None)] = render("mouth", fn)
for xid, (kind, _, fn) in EXTRAS.items():
    cells[("extras", xid, None)] = render(kind, fn)

ATLAS_W = 2048
placements = {}


def pack(keys, y):
    """Shelf-pack `keys` (tallest first) from row `y`; returns the 64-px-rounded bottom of the band."""
    x, row_h = GUTTER, 0
    for key in sorted(keys, key=lambda k: -cells[k][0].shape[0]):
        h, w = cells[key][0].shape[:2]
        if x + w + GUTTER > ATLAS_W:
            y += row_h
            x, row_h = GUTTER, 0
        placements[key] = (x, y, w, h)
        x += w + 2 * GUTTER
        x = (x + 1) // 2 * 2                      # even offsets: cells stay on whole pixels at half size
        row_h = max(row_h, h + 2 * GUTTER)
        row_h = (row_h + 1) // 2 * 2
    return int(math.ceil((y + row_h) / 64) * 64)


# The earlier cells pack exactly as they always have; the row-301 set gets its own band below them.
LEGACY_H = pack([k for k in cells if k not in SET_KEYS], GUTTER)
ATLAS_H = pack([k for k in cells if k in SET_KEYS], LEGACY_H + GUTTER)
atlas = np.zeros((ATLAS_H, ATLAS_W, 4), np.float32)
for key, (px_, py_, w, h) in placements.items():
    atlas[py_:py_ + h, px_:px_ + w] = cells[key][0]


def bleed(a, n):
    """Spread colour into transparent pixels (alpha untouched) so filtering never mixes in black at an edge."""
    rgb, al = a[..., :3].copy(), a[..., 3]
    have = al > 0
    for _ in range(n):
        acc, cnt = np.zeros_like(rgb), np.zeros(al.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc += np.roll(rgb * have[..., None], (dy, dx), axis=(0, 1))
            cnt += np.roll(have, (dy, dx), axis=(0, 1))
        new = (~have) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        have = have | new
    out = a.copy()
    out[..., :3] = rgb
    return out


atlas = bleed(atlas, GUTTER)
half = atlas.reshape(ATLAS_H // 2, 2, ATLAS_W // 2, 2, 4)
half_a = half[..., 3].mean(axis=(1, 3))
half_rgb = (half[..., :3] * half[..., 3:4]).sum(axis=(1, 3)) / np.maximum(half[..., 3:4].sum(axis=(1, 3)), 1e-6)
half_rgb = np.where(half_a[..., None] > 0, half_rgb, half[..., :3].mean(axis=(1, 3)))
atlas_512 = np.concatenate([half_rgb, half_a[..., None]], axis=2)


def save_png(name, arr, path):
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], axis=2)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).reshape(-1).astype(np.float32))
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def half_size(a):
    h, w = a.shape[:2]
    q = a.reshape(h // 2, 2, w // 2, 2, 4)
    qa = q[..., 3].mean(axis=(1, 3))
    qrgb = (q[..., :3] * q[..., 3:4]).sum(axis=(1, 3)) / np.maximum(q[..., 3:4].sum(axis=(1, 3)), 1e-6)
    qrgb = np.where(qa[..., None] > 0, qrgb, q[..., :3].mean(axis=(1, 3)))
    return np.concatenate([qrgb, qa[..., None]], axis=2)


os.makedirs(OUT, exist_ok=True)
save_png("V7FaceAtlas", atlas, os.path.join(OUT, "v7_face_atlas.png"))
save_png("V7FaceAtlas512", atlas_512, os.path.join(OUT, "v7_face_atlas_512.png"))

# ================================================================ page 2: David's 19 faces (face_set_305.py)
import face_set_305  # noqa: E402
P2_CELLS, P2_ANCHORS, P2_NAMES, P2_INFO = face_set_305.build(PX, dict(ANCHOR))
ANCHOR.update(P2_ANCHORS)
cells.update(P2_CELLS)
P2_KEYS = set(P2_CELLS)
P2_EYES = list(dict.fromkeys(k[1] for k in P2_CELLS if k[0] == "eyes"))
P2_MOUTHS = [k[1] for k in P2_CELLS if k[0] == "mouth"]
P2_EXTRAS = [k[1] for k in P2_CELLS if k[0] == "extras"]
ATLAS2_H = pack(sorted(P2_KEYS, key=str), GUTTER)
atlas2 = np.zeros((ATLAS2_H, ATLAS_W, 4), np.float32)
for key in P2_KEYS:
    px_, py_, w, h = placements[key]
    atlas2[py_:py_ + h, px_:px_ + w] = cells[key][0]
atlas2 = bleed(atlas2, GUTTER)
save_png("V7FaceAtlas2", atlas2, os.path.join(OUT, "v7_face_atlas_2.png"))
save_png("V7FaceAtlas2_512", half_size(atlas2), os.path.join(OUT, "v7_face_atlas_2_512.png"))


def rect(key):
    x_, y_, w, h = placements[key]
    ax, ay = cells[key][1]
    return [x_, y_, w, h, round(float(ax), 2), round(float(ay), 2)] + ([1] if key in P2_KEYS else [])


face = {
    "note": "v7 face layers (specs/avatar-v7.md): the engine draws the skin colour, then extras, brows, eyes and mouth as "
            "atlas cells placed on the face canvas (the v7 head's UVs, head_shape.face_chart, U right, W down, 1 canvas "
            "= 2 FH of arc). A cell [x, y, w, h, ax, ay] is an atlas rect (px, top-left origin, at `density` px per "
            "canvas) whose point (ax, ay) sits on its layer's anchor; `mirror` layers are drawn for the character's "
            "right side (canvas left) and mirrored for the left. Brows are white, tinted with the hair colour. Eye "
            "cells have frames open/half/closed for the blink. Ids are the cell codes on David's labelled sheets. "
            "A cell with a 7th value 1 is on the second page (atlas2, atlas2_world, atlas2_size: David's 19 faces, "
            "face_set_305.py); an eye with a `left` cell draws it at the eye_left anchor instead of mirroring `open`; `left: null` "
            "is a pair drawn as one cell at eye_pair, drawn once.",
    "density": PX, "canvas_m": round(2 * FH, 4),
    "atlas": "v7_face_atlas.png", "atlas_world": "v7_face_atlas_512.png", "atlas_size": [ATLAS_W, ATLAS_H],
    "atlas2": "v7_face_atlas_2.png", "atlas2_world": "v7_face_atlas_2_512.png", "atlas2_size": [ATLAS_W, ATLAS2_H],
    "anchors": {k: [round(v[0], 4), round(v[1], 4)] for k, v in ANCHOR.items()},
    "layers": {
        "extras": {"default": None, "multi": True, "tint": None, "items": {
            **{xid: {"anchor": kind, "mirror": mir, "cell": rect(("extras", xid, None))} for xid, (kind, mir, _) in EXTRAS.items()},
            **{xid: {"anchor": xid, "mirror": False, "cell": rect(("extras", xid, None))} for xid in P2_EXTRAS}}},
        "brows": {"default": "brow_soft", "anchor": "brow", "mirror": True, "tint": "hair",
                  # brow_none: an empty cell, no brows (David's faces draw their own in the eye cell)
                  "items": {**{bid: rect(("brows", bid, None)) for bid in BROWS}, "brow_none": [0, 0, 0, 0, 0, 0]}},
        "eyes": {"default": "F1.1", "anchor": "eye", "mirror": True, "tint": None,
                 "items": {eid: {**{f: rect(("eyes", eid, f)) for f in ("open", "half", "closed", "left") if ("eyes", eid, f) in cells},
                                 **({"left": None} if eid in P2_INFO["whole"] else {})}
                           for eid in EYE_ORDER + P2_EYES}},
        "mouth": {"default": "M1.1", "anchor": "mouth", "mirror": False, "tint": None,
                  "items": {mid: rect(("mouth", mid, None)) for mid in list(MOUTHS) + P2_MOUTHS}},
        "talk": {"default": None, "anchor": "mouth", "mirror": False, "tint": None,
                 "items": {tid: rect(("talk", tid, None)) for tid in TALK_CELLS}},
    },
    "expressions": EXPRESSIONS, "blink": BLINK, "talk": TALK, "emoteMouth": EMOTE_MOUTH,
    "names": {**face_set_301.NAMES, "brow_none": "No brows", **P2_NAMES},
}
json.dump(face, open(os.path.join(OUT, "face_v7.json"), "w"), indent=1)


# ================================================================ composed faces (the .blend preview, review sheets)
def compose(eyes="F1.1", eye_frame="open", mouth="M1.1", brows="brow_soft", brow=(0.0, 0.0), extras=(), skin=SKIN, hair=HAIR, res=PX):
    """What the engine draws, on the CPU: the reference for the shader and the Blender face texture."""
    out = np.zeros((res, res, 3), np.float32)
    out[:] = hex_srgb(skin)
    k = res / PX

    def place(img, anchor, a_px, mirror, tint=None, pose=(0.0, 0.0)):
        img = img.copy()
        if tint:
            img[..., :3] *= np.array(hex_srgb(tint), np.float32)
        dy, tilt = pose
        sides = [(False, anchor)] + ([(True, (1 - anchor[0], anchor[1]))] if mirror else [])
        for flip, (au, aw) in sides:
            h, w = img.shape[:2]
            ys, xs = np.mgrid[0:res, 0:res].astype(np.float32)
            U, W = (xs + 0.5) / res, (ys + 0.5) / res
            if flip:
                U = 1 - U
                au_ = 1 - au
            else:
                au_ = au
            # inverse pose: rotate about the anchor by -tilt (the inner end, +U on the canvas-left side, rises)
            t = math.radians(tilt)
            du, dw = U - au_, W - (aw + dy)
            ru, rw = du * math.cos(t) - dw * math.sin(t), du * math.sin(t) + dw * math.cos(t)
            cx, cy = a_px[0] + ru * PX, a_px[1] + rw * PX
            inside = (cx >= 0) & (cx < w) & (cy >= 0) & (cy < h)
            xi, yi = np.clip(cx.astype(int), 0, w - 1), np.clip(cy.astype(int), 0, h - 1)
            src = img[yi, xi]
            a = np.where(inside, src[..., 3], 0)[..., None]
            out[:] = out * (1 - a) + src[..., :3] * a

    for xid in extras:
        kind, mir, _ = EXTRAS[xid]
        img, a_px = cells[("extras", xid, None)]
        place(img, ANCHOR[kind], a_px, mir)
    img, a_px = cells[("brows", brows, None)]
    place(img, ANCHOR["brow"], a_px, True, hair, brow)
    key = ("eyes", eyes, eye_frame) if ("eyes", eyes, eye_frame) in cells else ("eyes", eyes, "open")
    img, a_px = cells[key]
    place(img, ANCHOR["eye"], a_px, True)
    img, a_px = cells[("mouth", mouth, None)] if ("mouth", mouth, None) in cells else cells[("talk", mouth, None)]
    place(img, ANCHOR["mouth"], a_px, False)
    return out


save_png("V7FaceDefault", compose(), os.path.join(OUT, "v7_face_default.png"))
if COMPOSE_DIR:
    os.makedirs(COMPOSE_DIR, exist_ok=True)
    for name, e in EXPRESSIONS.items():
        save_png(f"expr_{name}", compose(eyes=e["eyes"] or "F1.1", eye_frame=e["eyeFrame"], mouth=e["mouth"] or "M1.1",
                                          brow=tuple(e["brow"])), os.path.join(COMPOSE_DIR, f"expr_{name}.png"))
    for f in ("open", "half", "closed"):
        save_png(f"blink_{f}", compose(eye_frame=f), os.path.join(COMPOSE_DIR, f"blink_{f}.png"))
    for m in ["M1.1"] + TALK["frames"]:
        save_png(f"talk_{m}", compose(mouth=m), os.path.join(COMPOSE_DIR, f"talk_{m}.png"))
print("FACE_OK", len(cells), "cells", ATLAS_W, "x", ATLAS_H, "page 2", ATLAS_W, "x", ATLAS2_H, json.dumps(P2_INFO))
