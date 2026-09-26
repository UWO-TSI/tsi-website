"""v4 (from v3): simple-cute head + layered face system on the #18 body, soft surfacing.
specs/character-set.md "Deliverable 1, v3" and "v3 verdict and v4 brief".

v4 surfacing: no triangulation and no vertex jitter; every face is smooth-shaded and only edges whose
dihedral angle exceeds a per-part threshold (SHARP_DEG) stay hard, so curves read soft and only a few
large deliberate planes (hood gores, dress panels, hair tufts, shoe soles) show.

Run from the repo root:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_v3.py [-- <variant_face_dir>]

Writes next to this script:
  v4.blend, v4.glb                 rig + separate meshes: V4_Body, V4_Head, V4_Hood, V4_Shoes, V4_HairBangs, V4_HairBack
  v4_face_default.png              512x512 baked face (skin + brows + F1.1 eyes + M1.1 mouth), embedded in the GLB
  v4_face_features.png             feature atlas: every eye / mouth / brow / extra on transparency
  face_variants.json               id -> atlas rect + destination rect on the face canvas, per layer
With <variant_face_dir>, also bakes face_<eye>_<mouth>.png for the review grid.

Face canvas: u = (x + 0.2) / 0.4, w = (HEAD_Z + 0.2 - z) / 0.4 (w points down), mapped planar from the front.
Engine compose: fill skin colour, then draw layers in `compose_order` (brows multiplied by the hair colour).
"""
import bpy, bmesh, json, math, os, sys, random
import numpy as np
from mathutils import Vector, Quaternion, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
VARIANT_DIR = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv and len(sys.argv) > sys.argv.index("--") + 1 else None
PAL = json.load(open(os.path.join(HERE, "..", "palette.json")))
FPS = 30
TAU = math.tau
RNG = random.Random(24)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS


def hex_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


D = PAL["ref_girl_defaults"]
SKIN = PAL["skin"][D["skin"]]
HAIR = PAL["hair"][D["hair"]]
COLORS = {
    "M_Skin": SKIN, "M_Hood": PAL["outfit"][D["hood"]], "M_Underskirt": PAL["outfit"][D["underskirt"]],
    "M_Hair": HAIR, "M_Socks": PAL["outfit"][D["socks"]], "M_Shoes": PAL["outfit"][D["shoes"]],
    "M_Sole": PAL["derived"]["shoe_sole"],
}

HEAD_Z = 0.76           # head centre
FACE_PX = 512

# ============================================================================ face painting
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

# Features are authored at a base size and scaled up around their new centres (see Layer.warp):
# eyes K_EYE bigger, wider apart and in the lower half of the face; mouth K_MOUTH bigger.
EYE_Y, EYE_L, EYE_R = 0.60, 0.29, 0.71          # authoring centres
NEW_EYE_Y, NEW_EYE_L, NEW_EYE_R, K_EYE = 0.615, 0.27, 0.73, 1.38
BROW_Y = 0.458                                  # authoring brow line
NEW_BROW_Y = 0.455
MX, MY = 0.5, 0.755
NEW_MY, K_MOUTH = 0.785, 1.35

DEST = {  # u0, w0, u1, w1 on the face canvas
    "extras": (0.06, 0.64, 0.94, 0.86),
    "brows": (0.1, 0.415, 0.9, 0.495),
    "eyes": (0.06, 0.47, 0.94, 0.75),
    "mouth": (0.34, 0.72, 0.66, 0.855),
}


def warp_for(layer):
    """Map final canvas coords back to authoring coords."""
    if layer == "eyes":
        def f(U, V):
            left = U < 0.5
            U2 = np.where(left, EYE_L + (U - NEW_EYE_L) / K_EYE, EYE_R + (U - NEW_EYE_R) / K_EYE)
            return U2, EYE_Y + (V - NEW_EYE_Y) / K_EYE
        return f
    if layer == "brows":
        def f(U, V):
            left = U < 0.5
            U2 = np.where(left, EYE_L + (U - NEW_EYE_L), EYE_R + (U - NEW_EYE_R))
            return U2, V - (NEW_BROW_Y - BROW_Y)
        return f
    if layer == "mouth":
        return lambda U, V: (MX + (U - MX) / K_MOUTH, MY + (V - NEW_MY) / K_MOUTH)
    return None


class Layer:
    def __init__(self, dest, ss=4, warp=None):
        u0, w0, u1, w1 = dest
        self.W, self.H = round((u1 - u0) * FACE_PX), round((w1 - w0) * FACE_PX)
        self.ss = ss
        ys, xs = np.mgrid[0:self.H * ss, 0:self.W * ss].astype(np.float32)
        self.U = u0 + (xs + 0.5) / (self.W * ss) * (u1 - u0)
        self.V = w0 + (ys + 0.5) / (self.H * ss) * (w1 - w0)
        if warp:
            self.U, self.V = warp(self.U, self.V)
        self.rgb = np.zeros(self.U.shape + (3,), np.float32)
        self.a = np.zeros(self.U.shape, np.float32)

    # ---- masks
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
            cond = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi + 1e-12) + xi)
            inside ^= cond
        return inside

    def stroke(self, pts, r):
        """Polyline with radius r (scalar or per-point list): tapered capsule chain."""
        rs = r if isinstance(r, (list, tuple)) else [r] * len(pts)
        m = np.zeros(self.U.shape, bool)
        for (x0, y0), (x1, y1), r0, r1 in zip(pts[:-1], pts[1:], rs[:-1], rs[1:]):
            ax, ay = self.U - x0, self.V - y0
            bx, by = x1 - x0, y1 - y0
            h = np.clip((ax * bx + ay * by) / (bx * bx + by * by + 1e-12), 0, 1)
            rr = r0 + (r1 - r0) * h
            m |= (ax - bx * h) ** 2 + (ay - by * h) ** 2 <= rr * rr
        return m

    # ---- paint
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
    """Quadratic (3 pts) or cubic (4 pts) Bezier, else passthrough."""
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
    """radii along n points: r0 -> r1 (-> r2)."""
    if r2 is None:
        return [r0 + (r1 - r0) * i / (n - 1) for i in range(n)]
    h = (n - 1) / 2
    return [r0 + (r1 - r0) * i / h if i <= h else r1 + (r2 - r1) * (i - h) / h for i in range(n)]


# ---------------------------------------------------------------- eyes (pairs). s = +1 outward is +u.
def eye_pair(fn):
    def draw(L):
        for cx, s in ((EYE_L, -1), (EYE_R, 1)):
            fn(L, cx, EYE_Y, s, lambda dx, dy, cx=cx, s=s: (cx + s * dx, EYE_Y + dy))
    return draw


def lid_arc(L, P, pts, r0, r1, r2):
    c = bez([P(*p) for p in pts], 20)
    L.paint(L.stroke(c, taper(len(c), r0, r1, r2)), C_LID)


@eye_pair
def F1_1(L, cx, cy, s, P):
    blob = L.ellipse(*P(0.004, 0.018), 0.064, 0.07) & (L.V > cy - 0.036)
    L.paint(blob, C_EYE)
    lid_arc(L, P, [(-0.07, -0.02), (-0.03, -0.075), (0.06, -0.06), (0.1, -0.012)], 0.004, 0.011, 0.005)
    c = bez([P(-0.055, -0.07), P(0.0, -0.095), P(0.06, -0.07)], 12)
    L.paint(L.stroke(c, taper(len(c), 0.002, 0.004, 0.002)), C_CREASE, 0.8)


@eye_pair
def F1_2(L, cx, cy, s, P):
    L.paint(L.squircle(*P(-0.004, 0.012), 0.058, 3.2), C_EYE)
    lid_arc(L, P, [(0.078, 0.045), (0.09, -0.07), (-0.02, -0.085), (-0.07, -0.05)], 0.004, 0.012, 0.004)


@eye_pair
def F2_1(L, cx, cy, s, P):
    lid_y = lambda: cy - 0.012
    blob = L.ellipse(*P(0.0, 0.012), 0.058, 0.045) & (L.V > cy - 0.014)
    L.paint(blob, C_EYE)
    lid_arc(L, P, [(-0.075, -0.004), (-0.02, -0.024), (0.05, -0.024), (0.098, 0.0)], 0.004, 0.011, 0.004)


@eye_pair
def F2_2(L, cx, cy, s, P):
    blob = L.ellipse(*P(0.0, 0.018), 0.056, 0.05) & (L.V > cy - 0.006)
    L.paint(blob, C_EYE)
    lid_arc(L, P, [(-0.075, 0.012), (-0.03, -0.045), (0.05, -0.045), (0.098, -0.012)], 0.004, 0.012, 0.004)


def highlight(L, P, r=0.018, dx=-0.024, dy=-0.022):
    L.paint(L.ellipse(*P(dx, dy), r), C_WHITE)


@eye_pair
def E1_1(L, cx, cy, s, P):
    L.paint(L.ellipse(*P(0.0, 0.006), 0.062, 0.066), C_DOLL)
    lid_arc(L, P, [(-0.06, -0.032), (-0.02, -0.07), (0.04, -0.07), (0.07, -0.03)], 0.003, 0.009, 0.004)
    for a in (0.0, 0.4):
        L.paint(L.stroke([P(0.058 + 0.01 * a, -0.04 + 0.02 * a), P(0.085 + 0.01 * a, -0.05 + 0.03 * a)], 0.004), C_LID)
    highlight(L, P)


@eye_pair
def E1_2(L, cx, cy, s, P):
    L.paint(L.ellipse(*P(0.0, 0.0), 0.062, 0.058) & (L.V > cy - 0.012), C_DOLL)
    L.paint(L.stroke([P(-0.07, -0.014), P(0.075, -0.014)], 0.006), C_LID)
    highlight(L, P, 0.014, -0.02, 0.008)


@eye_pair
def E1_4(L, cx, cy, s, P):
    L.paint(L.ellipse(*P(0.0, 0.01), 0.058, 0.062), C_DOLL)
    lid_arc(L, P, [(-0.075, -0.02), (-0.03, -0.068), (0.05, -0.068), (0.085, -0.02)], 0.004, 0.011, 0.004)
    for k in range(2):
        L.paint(L.stroke([P(0.07 + 0.012 * k, -0.045 + 0.018 * k), P(0.095 + 0.012 * k, -0.05 + 0.02 * k)], 0.0035), C_LID)
    highlight(L, P, 0.016)


@eye_pair
def E1_6(L, cx, cy, s, P):
    L.paint(L.stroke([P(-0.07, -0.01), P(0.07, -0.014)], 0.009), C_LID)
    L.paint(L.ellipse(*P(0.0, -0.01), 0.042, 0.04) & (L.V > cy - 0.01), C_DOLL)


@eye_pair
def E5_4(L, cx, cy, s, P):
    L.paint(L.ellipse(*P(0.0, 0.012), 0.046), C_DOLL)
    c = bez([P(-0.07, -0.02), P(0.0, -0.085), P(0.075, -0.025)])
    L.paint(L.stroke(c, taper(len(c), 0.003, 0.007, 0.003)), C_LID)
    highlight(L, P, 0.013, -0.015, -0.005)


@eye_pair
def E5_5(L, cx, cy, s, P):
    L.paint(L.ellipse(*P(0.0, 0.012), 0.056), C_DOLL)
    c = bez([P(-0.07, -0.012), P(-0.01, -0.09), P(0.085, -0.02)])
    L.paint(L.stroke(c, taper(len(c), 0.003, 0.009, 0.004)), C_LID)
    highlight(L, P, 0.015, -0.02, -0.01)


@eye_pair
def E5_6(L, cx, cy, s, P):
    c = bez([P(-0.052, -0.045), P(-0.056, 0.07), P(0.056, 0.07), P(0.052, -0.045)], 20)
    L.paint(L.stroke(c, 0.009), C_DOLL)
    L.paint(L.stroke([P(-0.058, -0.045), P(0.058, -0.045)], 0.008), C_DOLL)
    L.paint(L.ellipse(*P(0.0, 0.022), 0.022), C_DOLL)


@eye_pair
def E6_1(L, cx, cy, s, P):
    L.paint(L.stroke([P(0.045, -0.042), P(-0.04, 0.0), P(0.045, 0.042)], 0.012), C_DOLL)


@eye_pair
def E8_1(L, cx, cy, s, P):
    c = bez([P(-0.06, 0.012), P(0.0, -0.012), P(0.062, 0.006)])
    L.paint(L.stroke(c, taper(len(c), 0.008, 0.014, 0.007)), C_DOLL)


@eye_pair
def E8_4(L, cx, cy, s, P):
    ring = L.ellipse(*P(0, 0), 0.062) & ~L.ellipse(*P(0, 0), 0.05)
    L.paint(ring, C_DOLL)
    L.paint(L.stroke([P(-0.06, -0.008), P(0.06, -0.008)], 0.006), C_DOLL)
    L.paint(L.ellipse(*P(0.0, 0.018), 0.03) & (L.V > cy - 0.008) & L.ellipse(*P(0, 0), 0.05), C_DOLL)


EYES = {"F1.1": F1_1, "F1.2": F1_2, "F2.1": F2_1, "F2.2": F2_2, "E1.1": E1_1, "E1.2": E1_2, "E1.4": E1_4,
        "E1.6": E1_6, "E5.4": E5_4, "E5.5": E5_5, "E5.6": E5_6, "E6.1": E6_1, "E8.1": E8_1, "E8.4": E8_4}


# ---------------------------------------------------------------- mouths (centred at MX, MY)
def P0(dx, dy):
    return (MX + dx, MY + dy)


def m_line(L, pts, r=0.0055, taper_ends=True):
    c = bez([P0(*p) for p in pts]) if len(pts) in (3, 4) else [P0(*p) for p in pts]
    rr = taper(len(c), r * 0.6, r, r * 0.6) if taper_ends else r
    L.paint(L.stroke(c, rr), C_LINE)


def m_open(L, hw, h, top=0.0, teeth=True, fangs=False, dark=False, tongue=True):
    top_pts = bez([P0(-hw, -h * 0.4), P0(0, -h * 0.4 + top), P0(hw, -h * 0.4)], 12)
    bot_pts = bez([P0(hw, -h * 0.4), P0(hw * 0.9, h * 0.75), P0(-hw * 0.9, h * 0.75), P0(-hw, -h * 0.4)], 20)
    shape = L.poly(top_pts + bot_pts[1:-1])
    L.paint(shape, C_DARKM if dark else C_PINK)
    if tongue:
        L.paint(shape & L.ellipse(*P0(0, h * 0.5), hw * 0.6, h * 0.35), C_INNER if not dark else C_TONGUE)
    if teeth:
        L.paint(shape & (L.V < MY - h * 0.4 + top + 0.008) & (np.abs(L.U - MX) < hw * 0.45), C_WHITE)
    if fangs:
        for sx in (-1, 1):
            L.paint(shape & L.poly([P0(sx * hw * 0.62, -h * 0.4 + top * 0.5), P0(sx * hw * 0.42, -h * 0.4 + top * 0.8),
                                    P0(sx * hw * 0.54, -h * 0.4 + 0.013)]), C_WHITE)
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
    shape = L.poly(p)
    L.paint(shape, C_PINK)
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
    return [(x0 + (x1 - x0) * i / n, dy + amp * math.sin(i / n * periods * TAU)) for i in range(n + 1)]


MOUTHS = {
    # chibi sheet picks
    # "H" bracket: a slightly arched line between two short upright ticks
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
    "M6.1": lambda L: (m_oval(L, 0.024, 0.028),
                       L.paint(L.ellipse(*P0(0, 0), 0.0195, 0.0235) & (L.V < MY - 0.01), C_WHITE)),
    "M6.3": lambda L: m_line(L, [(-0.04, -0.007), (0.0, 0.004), (0.042, 0.009)]),
}
# G grid: parametric approximations per row family (rows 1-9, cols 1-7)
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
        lambda: (L.paint(L.ellipse(*P0(0, 0), 0.022, 0.007), C_WHITE), L.paint(L.ellipse(*P0(0, 0), 0.022, 0.007) & ~L.ellipse(*P0(0, 0), 0.018, 0.0035), C_LINE)),
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


# ---------------------------------------------------------------- brows (drawn white, tinted with hair colour) + extras
def brow_soft(L):
    for cx, s in ((EYE_L, -1), (EYE_R, 1)):
        c = bez([(cx - s * 0.05, BROW_Y + 0.006), (cx, BROW_Y - 0.01), (cx + s * 0.05, BROW_Y + 0.002)])
        L.paint(L.stroke(c, taper(len(c), 0.009, 0.012, 0.006)), C_WHITE)


def brow_flat(L):
    for cx, s in ((EYE_L, -1), (EYE_R, 1)):
        L.paint(L.stroke([(cx - s * 0.045, BROW_Y), (cx + s * 0.045, BROW_Y - 0.002)], 0.01), C_WHITE)


BROWS = {"brow_soft": brow_soft, "brow_flat": brow_flat}
EXTRAS = {
    "blush": lambda L: [L.paint(L.ellipse(u, 0.745, 0.075, 0.036), C_BLUSH, 0.45) for u in (0.17, 0.83)],
    "mole": lambda L: L.paint(L.ellipse(0.66, 0.815, 0.008), C_MOLE),
    "freckles": lambda L: [L.paint(L.ellipse(u + du, 0.74 + dv, 0.0055), C_MOLE, 0.55)
                           for u in (0.17, 0.83) for du, dv in ((-0.02, -0.01), (0.012, -0.018), (0.01, 0.012))],
}

LAYERS = [("extras", EXTRAS), ("brows", BROWS), ("eyes", EYES), ("mouth", MOUTHS)]
DEFAULTS = {"extras": None, "brows": "brow_soft", "eyes": "F1.1", "mouth": "M1.1"}

# render every feature to its own cell
cells = {}
for layer, table in LAYERS:
    for fid, fn in table.items():
        L = Layer(DEST[layer], warp=warp_for(layer))
        fn(L)
        cells[(layer, fid)] = L.image()

# pack into the atlas (rows per layer)
ATLAS_W = 2048
placements, x, y, row_h, cur_layer = {}, 0, 0, 0, None
for (layer, fid), img in cells.items():
    h, w = img.shape[:2]
    if layer != cur_layer or x + w > ATLAS_W:
        y += row_h
        x, row_h, cur_layer = 0, 0, layer
    placements[(layer, fid)] = (x, y, w, h)
    x += w + 2
    row_h = max(row_h, h + 2)
ATLAS_H = int(math.ceil((y + row_h) / 4) * 4)
atlas = np.zeros((ATLAS_H, ATLAS_W, 4), np.float32)
for key, (px_, py_, w, h) in placements.items():
    atlas[py_:py_ + h, px_:px_ + w] = cells[key]


def compose(eyes, mouth, brows="brow_soft", extras=None, skin=SKIN, hair=HAIR):
    out = np.zeros((FACE_PX, FACE_PX, 3), np.float32)
    out[:] = hex_srgb(skin)
    for layer, fid in (("extras", extras), ("brows", brows), ("eyes", eyes), ("mouth", mouth)):
        if fid is None:
            continue
        img = cells[(layer, fid)].copy()
        if layer == "brows":
            img[..., :3] *= np.array(hex_srgb(hair), np.float32)
        u0, w0 = DEST[layer][0], DEST[layer][1]
        x0, y0 = round(u0 * FACE_PX), round(w0 * FACE_PX)
        h, w = img.shape[:2]
        a = img[..., 3:4]
        out[y0:y0 + h, x0:x0 + w] = out[y0:y0 + h, x0:x0 + w] * (1 - a) + img[..., :3] * a
    return out


def save_png(name, arr, path, pack=False):
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], axis=2)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).reshape(-1).astype(np.float32))
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    if pack:
        img.pack()
    return img


face_img = save_png("V4FaceDefault", compose(DEFAULTS["eyes"], DEFAULTS["mouth"]), os.path.join(HERE, "v4_face_default.png"), True)
save_png("V4FaceFeatures", atlas, os.path.join(HERE, "v4_face_features.png"))

variants = {
    "note": "Face layers for the creator. Compose on a canvas of size `canvas`: fill skin colour, then draw each "
            "layer in compose_order from the atlas rect [x, y, w, h] (pixels, top-left origin) into the layer's "
            "dest rect [u0, w0, u1, w1] (fractions of the canvas, top-left origin). Layers with tint='hair' are "
            "drawn white; multiply by the hair colour. Eye/mouth ids are the cell codes on David's labelled sheets; "
            "G mouths are parametric approximations per row.",
    "canvas": FACE_PX,
    "atlas": "v4_face_features.png",
    "atlas_size": [ATLAS_W, ATLAS_H],
    "face_uv": {"u": "(x + 0.2) / 0.4", "w": f"({HEAD_Z} + 0.2 - z) / 0.4", "space": "Blender metres, front planar"},
    "compose_order": ["extras", "brows", "eyes", "mouth"],
    "layers": {},
}
for layer, table in LAYERS:
    variants["layers"][layer] = {
        "dest": list(DEST[layer]),
        "default": DEFAULTS[layer],
        "optional": layer == "extras",
        "multi": layer == "extras",
        "tint": "hair" if layer == "brows" else None,
        "items": {fid: list(placements[(layer, fid)]) for fid in table},
    }
json.dump(variants, open(os.path.join(HERE, "face_variants.json"), "w"), indent=1)

if VARIANT_DIR:
    os.makedirs(VARIANT_DIR, exist_ok=True)
    for e in ["F1.1", "F1.2", "F2.2", "E1.1", "E1.4", "E5.5"]:
        for m in ["M1.1", "M2.1"]:
            save_png(f"var_{e}_{m}", compose(e, m), os.path.join(VARIANT_DIR, f"face_{e}_{m}.png"))

# ============================================================================ materials
def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def new_mat(name, hexcol=None, image=None, double=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs["Roughness"].default_value = 0.92
    b.inputs["Metallic"].default_value = 0.0
    m.use_backface_culling = not double
    if image is not None:
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = image
        m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    else:
        c = (*lin(hex_srgb(hexcol)), 1)
        b.inputs["Base Color"].default_value = c
        m.diffuse_color = c
    return m


MATS = {n: new_mat(n, COLORS.get(n), double=n in ("M_Hair", "M_Hood")) for n in COLORS}
MATS["M_Face"] = new_mat("M_Face", image=face_img)

# ============================================================================ geometry
OBJECTS = ["V4_Body", "V4_Head", "V4_Hood", "V4_Shoes", "V4_HairBangs", "V4_HairBack"]
OBJ_MATS = {
    "V4_Body": ["M_Skin", "M_Hood", "M_Underskirt", "M_Socks"],
    "V4_Head": ["M_Skin", "M_Face"],
    "V4_Hood": ["M_Hood"],
    "V4_Shoes": ["M_Shoes", "M_Sole"],
    "V4_HairBangs": ["M_Hair"],
    "V4_HairBack": ["M_Hair"],
}
PARTS = ["head", "neck", "hood", "bangs", "hairback", "dress", "under", "sleeve_L", "sleeve_R", "hand_L", "hand_R",
         "leg_L", "leg_R", "shoe_L", "shoe_R"]
PART_OBJ = {"head": "V4_Head", "neck": "V4_Body", "hood": "V4_Hood", "bangs": "V4_HairBangs", "hairback": "V4_HairBack",
            "shoe_L": "V4_Shoes", "shoe_R": "V4_Shoes"}
PI = {n: i for i, n in enumerate(PARTS)}

bm = bmesh.new()
L_PART = bm.verts.layers.int.new("part")
F_MAT = bm.faces.layers.int.new("matname")
F_SHADE = bm.faces.layers.float.new("shade")
F_SMOOTH = bm.faces.layers.int.new("smooth")
MATNAMES = list(MATS)


def vnew(co, part):
    v = bm.verts.new(co)
    v[L_PART] = PI[part]
    return v


def fnew(vs, mat, shade=1.0, smooth=False):
    f = bm.faces.new(vs)
    f[F_MAT] = MATNAMES.index(mat)
    f[F_SHADE] = shade
    f[F_SMOOTH] = int(smooth)
    return f


def jit(a):
    return 0.0          # v4: no jitter; irregular noise read as a "triangle skin"


# ---------------------------------------------------------------- head: chubby squashed egg, smooth-shaded
HC = Vector((0, 0, HEAD_Z))
HRX, HRY, HRZT, HRZB = 0.2, 0.178, 0.185, 0.182


def head_point(lat, lon):
    """lat/lon in degrees; lon 0 = front (-Y), + toward the character's left (+X)."""
    la, lo = math.radians(lat), math.radians(lon)
    cl, sl = math.cos(la), math.sin(la)
    x = cl * math.sin(lo) * HRX
    y = -cl * math.cos(lo) * HRY
    if lat >= 0:
        z = HRZT * sl ** 0.92
    else:
        z = -HRZB * (-sl) ** 0.62                               # soft flat chin
    cheek = math.exp(-((lat + 28) / 26) ** 2)                   # full cheeks below the eye line
    x *= 1 + 0.11 * cheek
    y *= 1 + 0.06 * cheek * max(0.0, math.cos(lo))
    if lat > 0:
        y *= 1 - 0.05 * sl                                      # slightly flatter crown front-to-back
    return HC + Vector((x, y, z))


HEAD_SEGS, HEAD_RINGS = 18, 12
head_rows = []
for j in range(1, HEAD_RINGS):
    lat = -90 + 180 * j / HEAD_RINGS
    head_rows.append([vnew(head_point(lat, -180 + 360 * k / HEAD_SEGS + 180), "head") for k in range(HEAD_SEGS)])
h_bot = vnew(head_point(-90, 0), "head")
h_top = vnew(head_point(90, 0), "head")


def is_face_quad(vs):
    c = sum((v.co for v in vs), Vector()) / len(vs)
    n = (c - HC).normalized()
    return n.dot(Vector((0, -1, 0))) > 0.28 and c.z < HEAD_Z + 0.12


for a, b in zip(head_rows[:-1], head_rows[1:]):
    for k in range(HEAD_SEGS):
        vs = [a[k], a[(k + 1) % HEAD_SEGS], b[(k + 1) % HEAD_SEGS], b[k]]
        fnew(vs, "M_Face" if is_face_quad(vs) else "M_Skin", smooth=True)
for k in range(HEAD_SEGS):
    fnew([head_rows[0][(k + 1) % HEAD_SEGS], head_rows[0][k], h_bot], "M_Skin", smooth=True)
    fnew([head_rows[-1][k], head_rows[-1][(k + 1) % HEAD_SEGS], h_top], "M_Skin", smooth=True)


# ---------------------------------------------------------------- generic loft (as v2)
def loft(part, axis, rings, lons, mat, start=None, end=None, jitter=0.0, flip=False, wave=0.0, smooth=False):
    loops = []
    for ri, (c, ra, rb) in enumerate(rings):
        loop = []
        for li, lon in enumerate(lons):
            r = math.radians(lon)
            s_, c_ = math.sin(r), math.cos(r)
            if axis == "Z":
                off = Vector((s_ * ra, -c_ * rb, 0))
            elif axis == "X":
                off = Vector((0, -s_ * ra, c_ * rb))
            else:
                off = Vector((s_ * ra, 0, c_ * rb))
            q = c + off
            if jitter:
                q += Vector((jit(jitter), jit(jitter), jit(jitter)))
            if wave and ri == len(rings) - 1:
                q.z += wave * (1 if li % 2 else -1)
            loop.append(vnew(q, part))
        loops.append(loop)
    nn = len(lons)

    def f(vs):
        return fnew(list(reversed(vs)) if flip else vs, mat, smooth=smooth)

    for a, b in zip(loops[:-1], loops[1:]):
        for k in range(nn):
            f([a[k], b[k], b[(k + 1) % nn], a[(k + 1) % nn]])
    for apx, loop, rev in ((start, loops[0], False), (end, loops[-1], True)):
        if apx is None:
            continue
        pv = vnew(apx, part)
        for k in range(nn):
            tri = [loop[k], loop[(k + 1) % nn], pv]
            f(list(reversed(tri)) if rev else tri)
    return loops


def mirrored_angles(half):
    inner = [a for a in half if 0 < a < 180]
    return [0] + inner + ([180] if 180 in half else []) + [-a for a in reversed(inner)]


# neck (hidden under the hood; visible with the hood down)
loft("neck", "Z", [(Vector((0, 0.01, 0.54)), 0.058, 0.055), (Vector((0, 0.01, 0.62)), 0.06, 0.056)],
     [30, 90, 150, 210, 270, 330], "M_Skin", smooth=True)

# ---------------------------------------------------------------- hood (v2 shell, face opening removed, scaled to clear the head)
HOOD_LON = mirrored_angles([0, 30, 62, 104, 145, 180])
HOOD_RINGS = [(0.555, 0.105, 0.095, 0.02), (0.585, 0.19, 0.17, 0.012), (0.635, 0.232, 0.2, 0.012),
              (0.695, 0.255, 0.212, 0.015), (0.758, 0.264, 0.218, 0.022), (0.82, 0.25, 0.21, 0.034),
              (0.878, 0.215, 0.195, 0.036), (0.932, 0.168, 0.166, 0.056), (0.975, 0.1, 0.11, 0.095)]
HOOD_APEX = Vector((0.0, 0.16, 0.99))
FACE_RINGS, FACE_LON, RIM_LON = (1, 2, 3, 4, 5), 30, 62
HOOD_S = 1.01


def hood_xf(x, y, z):
    p = Vector((x, y, z)) - HC
    return HC + Vector((p.x * HOOD_S, p.y * HOOD_S, p.z * 1.06))


hood_loops, OPEN = [], set()
for ri, (z, rx, ry, cy) in enumerate(HOOD_RINGS):
    pts = []
    for lon in HOOD_LON:
        a = abs(lon)
        r = math.radians(lon)
        x, y, zz = math.sin(r) * rx, -math.cos(r) * ry + cy, z
        if ri in FACE_RINGS and a <= FACE_LON:
            OPEN.add((ri, lon))
            x = math.copysign(0.2 * math.sin(math.radians(a)) / math.sin(math.radians(FACE_LON)), lon) if a else 0.0
            y = -0.13
        elif ri in FACE_RINGS and a == RIM_LON:
            x = math.copysign({1: 0.13, 2: 0.19, 3: 0.215, 4: 0.212, 5: 0.175}[ri], lon)   # oval opening
            y = -0.2 + (0.035 if ri == 1 else 0.0) + (0.012 if ri == 5 else 0.0)
        elif ri == 6 and a <= RIM_LON:
            y = min(y, -0.185 + 0.012 * a / RIM_LON)
            zz -= 0.028 * (a / RIM_LON) ** 2                   # arch the brim so the opening reads round
        elif ri > 0:
            x += jit(0.012) * (1 if lon >= 0 else -1)
            zz += jit(0.01)
        pts.append([x, y, zz])
    n = len(HOOD_LON)
    for k in range(1, n // 2):
        pts[n - k] = [-pts[k][0], pts[k][1], pts[k][2]]
    hood_loops.append([vnew(hood_xf(*p), "hood") for p in pts])
h_apex = vnew(hood_xf(*HOOD_APEX), "hood")
n = len(HOOD_LON)
for ri in range(len(hood_loops) - 1):
    for k in range(n):
        k2 = (k + 1) % n
        opening = all((r, HOOD_LON[kk]) in OPEN for r in (ri, ri + 1) for kk in (k, k2))
        if opening:
            continue
        l0, l1 = abs(HOOD_LON[k]), abs(HOOD_LON[k2])
        lining = (ri in FACE_RINGS and ri + 1 in FACE_RINGS and max(l0, l1) <= RIM_LON) or (ri == 5 and max(l0, l1) <= RIM_LON)
        a_l, b_l = hood_loops[ri], hood_loops[ri + 1]
        fnew([a_l[k], b_l[k], b_l[k2], a_l[k2]], "M_Hood", 0.62 if lining else 1.0)
for k in range(n):
    fnew([hood_loops[-1][k], h_apex, hood_loops[-1][(k + 1) % n]], "M_Hood")


# ---------------------------------------------------------------- hair: shells offset from the head surface
def hair_point(lat, lon, off):
    p = head_point(lat, lon)
    d = p - HC
    return HC + d * (1 + off / d.length)


def grid_shell(part, cols, rows_fn, off_fn, skip=None, tips=None, jitter=0.006):
    """cols: lon list (not wrapped unless closed); rows_fn(lon) -> lat list bottom..top; returns grid."""
    grid = []
    for lon in cols:
        col = []
        for ri, lat in enumerate(rows_fn(lon)):
            q = hair_point(lat, lon, off_fn(lat, lon, ri))
            if 0 < ri:
                q += Vector((jit(jitter), jit(jitter), jit(jitter)))
            col.append(vnew(q, part))
        grid.append(col)
    return grid


# bangs: straight-cut fringe with side locks (N sheet family, cf. N4.2 / B2.1)
BANG_COLS = [-90, -68, -44, -15, 15, 44, 68, 90]


def bang_rows(lon):
    a = abs(lon)
    fringe = 12 if a <= 46 else -32                          # side locks fall to the cheeks
    return [fringe, fringe + (72 - fringe) * 0.45, 74]       # top edge tucks under the back hair


def bang_off(lat, lon, ri):
    return [0.022, 0.02, 0.006][ri]


bg = grid_shell("bangs", BANG_COLS, bang_rows, bang_off)
for i in range(len(BANG_COLS) - 1):
    a, b = bg[i], bg[i + 1]
    for r in range(2):
        fnew([a[r], b[r], b[r + 1], a[r + 1]], "M_Hair")
    # chunky tuft tip under each strand, alternating lengths
    la, lb = BANG_COLS[i], BANG_COLS[i + 1]
    mid = (la + lb) / 2
    base = min(bang_rows(la)[0], bang_rows(lb)[0])
    drop = (8 if i % 2 else 12) if abs(mid) <= 50 else 11    # a few chunky tufts
    tip = vnew(hair_point(base - drop, mid, 0.021), "bangs")
    fnew([b[0], a[0], tip], "M_Hair")

# back hair: bob, full crown cap with the face window left open (B sheet bob family)
BACK_N = 10
BACK_COLS = [-180 + 360 * k / BACK_N + 180 for k in range(BACK_N)]
BACK_COLS = [((c + 180) % 360) - 180 for c in BACK_COLS]    # 0, 22.5, ... , -22.5


def back_rows(lon):
    a = abs(lon)
    bottom = -46 if a >= 100 else (-40 if a >= 60 else -40)
    return [bottom, -12, 22, 52, 74]


def back_off(lat, lon, ri):
    return [0.05, 0.04, 0.036, 0.04, 0.042][ri]


bk = grid_shell("hairback", BACK_COLS, back_rows, back_off, jitter=0.008)
b_apex = vnew(hair_point(90, 0, 0.04), "hairback")
for i in range(BACK_N):
    j = (i + 1) % BACK_N
    la, lb = BACK_COLS[i], BACK_COLS[j]
    for r in range(4):
        window = max(abs(la), abs(lb)) <= 36.1 and r < 3       # leave the face open below the crown
        if window:
            continue
        fnew([bk[j][r], bk[i][r], bk[i][r + 1], bk[j][r + 1]], "M_Hair")
    fnew([bk[i][4], bk[j][4], b_apex], "M_Hair")
    if not (max(abs(la), abs(lb)) <= 36.1) and i % 2 == 0:
        mid = math.degrees(math.atan2(math.sin(math.radians(la)) + math.sin(math.radians(lb)),
                                      math.cos(math.radians(la)) + math.cos(math.radians(lb))))
        tip = vnew(hair_point(back_rows(mid)[0] - (7 if i % 2 else 11), mid, 0.055), "hairback")
        fnew([bk[i][0], bk[j][0], tip], "M_Hair")

# ---------------------------------------------------------------- body (v2)
DRESS_LON = mirrored_angles([0, 45, 90, 135, 180])
loft("dress", "Z", [
    (Vector((0, 0.02, 0.575)), 0.09, 0.08), (Vector((0, 0.01, 0.505)), 0.148, 0.125),
    (Vector((0, 0.0, 0.40)), 0.182, 0.152), (Vector((0, 0.0, 0.295)), 0.198, 0.17),
    (Vector((0, 0.0, 0.2)), 0.214, 0.182)], DRESS_LON, "M_Hood", jitter=0.006, wave=0.013)
loft("under", "Z", [(Vector((0, 0, 0.33)), 0.165, 0.135), (Vector((0, 0, 0.172)), 0.192, 0.165)],
     DRESS_LON, "M_Underskirt", end=Vector((0, 0, 0.215)))
ARM_Z = 0.5
SLEEVE_LON = [0, 45, 90, 135, 180, 225, 270, 315]
for sx, side in ((1, "L"), (-1, "R")):
    loft(f"sleeve_{side}", "X", [
        (Vector((sx * 0.06, 0, ARM_Z)), 0.07, 0.07), (Vector((sx * 0.13, 0, ARM_Z)), 0.078, 0.074),
        (Vector((sx * 0.2, 0, ARM_Z - 0.004)), 0.07, 0.066), (Vector((sx * 0.262, 0, ARM_Z - 0.006)), 0.055, 0.05)],
        SLEEVE_LON, "M_Hood", end=Vector((sx * 0.25, 0, ARM_Z - 0.006)), flip=sx > 0, jitter=0.003)
    loft(f"hand_{side}", "X", [
        (Vector((sx * 0.245, 0, ARM_Z - 0.006)), 0.03, 0.03), (Vector((sx * 0.285, 0, ARM_Z - 0.008)), 0.047, 0.042),
        (Vector((sx * 0.325, 0, ARM_Z - 0.01)), 0.046, 0.04)],
        [0, 60, 120, 180, 240, 300], "M_Skin", end=Vector((sx * 0.36, 0, ARM_Z - 0.012)), flip=sx > 0)
    lx = sx * 0.066
    loft(f"leg_{side}", "Z", [
        (Vector((lx, 0, 0.05)), 0.042, 0.042), (Vector((lx, 0, 0.098)), 0.049, 0.049),
        (Vector((lx, 0, 0.114)), 0.043, 0.043), (Vector((lx, 0, 0.21)), 0.045, 0.045),
        (Vector((lx, 0, 0.33)), 0.05, 0.05)], [30, 90, 150, 210, 270, 330], "M_Skin")

    def sh(y, ra, rb):
        return (Vector((lx, y, rb * 0.924)), ra, rb)
    loft(f"shoe_{side}", "Y", [sh(0.05, 0.047, 0.036), sh(0.0, 0.061, 0.047), sh(-0.065, 0.062, 0.043)],
         [22.5 + 45 * k for k in range(8)], "M_Shoes",
         start=Vector((lx, 0.075, 0.032)), end=Vector((lx, -0.122, 0.03)), flip=True)

# ============================================================================ finish: triangulate faceted parts, shade, split
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.normal_update()
# Smooth by angle, per part: curved surfaces soft, only big deliberate planes hard.
SHARP_DEG = {"head": 180, "neck": 180, "hand_L": 180, "hand_R": 180, "leg_L": 180, "leg_R": 180,
             "hood": 28, "dress": 34, "under": 34, "sleeve_L": 50, "sleeve_R": 50,
             "bangs": 32, "hairback": 50, "shoe_L": 60, "shoe_R": 60}
for e in bm.edges:
    if len(e.link_faces) != 2:
        e.smooth = False
        continue
    f1, f2 = e.link_faces
    part = PARTS[e.verts[0][L_PART]]
    ang = math.degrees(f1.normal.angle(f2.normal, 0.0))
    same_mat = f1[F_MAT] == f2[F_MAT]
    e.smooth = ang < SHARP_DEG.get(part, 45) and same_mat or (part in ("head",) and ang < 90)

uv = bm.loops.layers.uv.new("UVMap")
col = bm.loops.layers.float_color.new("Color")
zr = {}
for v in bm.verts:
    p = PARTS[v[L_PART]]
    lo, hi = zr.get(p, (9, -9))
    zr[p] = (min(lo, v.co.z), max(hi, v.co.z))
for face in bm.faces:
    part = PARTS[face.verts[0][L_PART]]
    mat = MATNAMES[face[F_MAT]]
    c = face.calc_center_median()
    if part.startswith("leg"):
        mat = "M_Socks" if c.z < 0.112 else "M_Skin"
    if part.startswith("shoe") and face.normal.z < -0.6:
        mat = "M_Sole"
    face[F_MAT] = MATNAMES.index(mat)
    face.smooth = True
    lo, hi = zr[part]
    for loop in face.loops:
        p = loop.vert.co
        if part in ("head", "neck"):
            s = 1.0                                              # smooth skin, no baked gradient on the face
        else:
            t = (p.z - lo) / max(hi - lo, 1e-6)
            s = (0.56 + 0.44 * t) * face[F_SHADE]                # strong top-light vertex-lit gradient (#18)
        loop[col] = (s, s, s, 1.0)
        if mat == "M_Face":
            u = (p.x + 0.2) / 0.4
            w = (HEAD_Z + 0.2 - p.z) / 0.4
            loop[uv].uv = (u, 1 - w)
        else:
            loop[uv].uv = (0.02, 0.02)                           # skin corner of the face texture


def split_object(name):
    b2 = bm.copy()
    Lp = b2.verts.layers.int["part"]
    Fm = b2.faces.layers.int["matname"]
    kill = [f for f in b2.faces if PART_OBJ.get(PARTS[f.verts[0][Lp]], "V4_Body") != name]
    bmesh.ops.delete(b2, geom=kill, context="FACES")
    loose = [v for v in b2.verts if not v.link_faces]
    bmesh.ops.delete(b2, geom=loose, context="VERTS")
    mats = OBJ_MATS[name]
    for f in b2.faces:
        f.material_index = mats.index(MATNAMES[f[Fm]])
    me = bpy.data.meshes.new(name)
    b2.to_mesh(me)
    parts = [v[Lp] for v in b2.verts]
    b2.free()
    for a in ("part", "matname", "shade", "smooth"):
        if a in me.attributes:
            me.attributes.remove(me.attributes[a])
    me.color_attributes.active_color = me.color_attributes["Color"]
    for m in mats:
        me.materials.append(MATS[m])
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob, parts


# ============================================================================ rig (v2)
P = "mixamorig:"
BONES = [("Hips", (0, 0, 0.30), (0, 0, 0.36), None), ("Spine", (0, 0, 0.36), (0, 0, 0.42), "Hips"),
         ("Spine1", (0, 0, 0.42), (0, 0, 0.48), "Spine"), ("Spine2", (0, 0, 0.48), (0, 0, 0.54), "Spine1"),
         ("Neck", (0, 0, 0.54), (0, 0, 0.6), "Spine2"), ("Head", (0, 0, 0.6), (0, 0, 1.0), "Neck")]
for sx, S in ((1, "Left"), (-1, "Right")):
    BONES += [
        (f"{S}Shoulder", (sx * 0.02, 0, ARM_Z + 0.01), (sx * 0.09, 0, ARM_Z), "Spine2"),
        (f"{S}Arm", (sx * 0.09, 0, ARM_Z), (sx * 0.18, 0, ARM_Z - 0.003), f"{S}Shoulder"),
        (f"{S}ForeArm", (sx * 0.18, 0, ARM_Z - 0.003), (sx * 0.255, 0, ARM_Z - 0.006), f"{S}Arm"),
        (f"{S}Hand", (sx * 0.255, 0, ARM_Z - 0.006), (sx * 0.35, 0, ARM_Z - 0.012), f"{S}ForeArm"),
        (f"{S}UpLeg", (sx * 0.066, 0, 0.30), (sx * 0.066, 0, 0.175), "Hips"),
        (f"{S}Leg", (sx * 0.066, 0, 0.175), (sx * 0.066, 0, 0.055), f"{S}UpLeg"),
        (f"{S}Foot", (sx * 0.066, 0, 0.055), (sx * 0.066, -0.055, 0.025), f"{S}Leg"),
        (f"{S}ToeBase", (sx * 0.066, -0.055, 0.025), (sx * 0.066, -0.1, 0.025), f"{S}Foot"),
    ]
arm_data = bpy.data.armatures.new("CharacterRig")
rig = bpy.data.objects.new("CharacterRig", arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for name, h, t, parent in BONES:
    eb = arm_data.edit_bones.new(P + name)
    eb.head, eb.tail, eb.roll = Vector(h), Vector(t), 0.0
    if parent:
        eb.parent = arm_data.edit_bones[P + parent]
bpy.ops.object.mode_set(mode="OBJECT")


def chain(t, joints, bones, r):
    i = 0
    while i < len(bones) - 1 and t >= joints[i + 1]:
        i += 1
    w = {bones[i]: 1.0}
    if i < len(bones) - 1 and joints[i + 1] - t < r:
        k = 0.5 * (1 - (joints[i + 1] - t) / r)
        w = {bones[i]: 1 - k, bones[i + 1]: k}
    elif i > 0 and t - joints[i] < r:
        k = 0.5 * (1 - (t - joints[i]) / r)
        w = {bones[i]: 1 - k, bones[i - 1]: k}
    return w


def clamp01(x):
    return max(0.0, min(1.0, x))


def weights(part, co):
    if part in ("head", "bangs", "hairback"):
        return {"Head": 1.0}
    if part == "hood":
        return {"Head": 0.7, "Neck": 0.3} if co.z < 0.6 else {"Head": 1.0}
    if part == "neck":
        return {"Neck": 1.0} if co.z > 0.6 else {"Neck": 0.6, "Spine2": 0.4}
    if part in ("dress", "under"):
        w = chain(co.z, [0.0, 0.36, 0.42, 0.48, 0.555], ["Hips", "Spine", "Spine1", "Spine2", "Neck"], 0.03)
        k = clamp01((0.33 - co.z) / 0.13) * (0.45 if part == "under" else 0.35)
        if k > 0:
            sl = clamp01(0.5 + co.x / 0.25)
            w = {b: x * (1 - k) for b, x in w.items()}
            w["LeftUpLeg"] = w.get("LeftUpLeg", 0) + k * sl
            w["RightUpLeg"] = w.get("RightUpLeg", 0) + k * (1 - sl)
        return w
    S = "Left" if part.endswith("L") else "Right"
    if part.startswith("hand"):
        return {f"{S}Hand": 1.0}
    if part.startswith("sleeve"):
        x = abs(co.x)
        if x < 0.09:
            return {f"{S}Shoulder": 0.5, f"{S}Arm": 0.2, "Spine2": 0.3}
        return chain(x, [0.0, 0.09, 0.18, 0.255], [f"{S}Shoulder", f"{S}Arm", f"{S}ForeArm", f"{S}Hand"], 0.03)
    if part.startswith("leg"):
        return {f"{S}UpLeg": 1.0} if co.z > 0.2 else ({f"{S}Leg": 1.0} if co.z > 0.075 else {f"{S}Foot": 0.6, f"{S}Leg": 0.4})
    return {f"{S}Foot": 1.0} if co.y > -0.045 else ({f"{S}ToeBase": 1.0} if co.y < -0.075 else {f"{S}Foot": 0.5, f"{S}ToeBase": 0.5})


objs = []
for name in OBJECTS:
    ob, parts = split_object(name)
    groups = {}
    for vi, v in enumerate(ob.data.vertices):
        for b, x in weights(PARTS[parts[vi]], v.co).items():
            if x > 1e-4:
                if b not in groups:
                    groups[b] = ob.vertex_groups.new(name=P + b)
                groups[b].add([vi], x, "REPLACE")
    ob.parent = rig
    ob.modifiers.new("Armature", "ARMATURE").object = rig
    objs.append(ob)
bm.free()


def socket(name, bone, loc):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    e.empty_display_size = 0.05
    scene.collection.objects.link(e)
    e.parent, e.parent_type, e.parent_bone = rig, "BONE", P + bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(Vector(loc))
    return e


sockets = [socket("Socket_R_Hand", "RightHand", (-0.305, -0.01, ARM_Z - 0.01)),
           socket("Socket_L_Hand", "LeftHand", (0.305, -0.01, ARM_Z - 0.01)),
           socket("Socket_Back", "Spine2", (0.0, 0.2, 0.42))]


# ============================================================================ animation (v2)
def rx(d): return Quaternion((1, 0, 0), math.radians(d))
def ry(d): return Quaternion((0, 1, 0), math.radians(d))
def rz(d): return Quaternion((0, 0, 1), math.radians(d))


ALL = [b[0] for b in BONES]
REST = {n: rig.data.bones[P + n].matrix_local.to_3x3().to_quaternion() for n in ALL}
ZERO = (0, 0, 0)


def apply_pose(pose):
    for n in ALL:
        pb = rig.pose.bones[P + n]
        pb.rotation_mode = "QUATERNION"
        R, Lc = pose.get(n, (Quaternion(), ZERO))
        B = REST[n]
        pb.rotation_quaternion = B.inverted() @ R @ B
        pb.location = B.inverted() @ Vector(Lc)


def arms(down, fl, fr, bl, br, out=0.0):
    return {"LeftArm": (rx(-fl) @ ry(down + out), ZERO), "RightArm": (rx(-fr) @ ry(-(down + out)), ZERO),
            "LeftForeArm": (rz(-bl), ZERO), "RightForeArm": (rz(br), ZERO)}


def idle_pose(p):
    br = math.sin(TAU * p)
    roll = 1.8 * math.sin(TAU * p)
    hips = ry(roll)
    pose = {"Hips": (hips, (0, 0, 0.004 * br - 0.002)), "Spine": (rx(1.0 * br), ZERO),
            "Spine1": (rx(0.6 * br) @ ry(-roll * 0.5), ZERO),
            "Head": (ry(-3.0 * math.sin(TAU * p + 0.6)) @ rx(1.8 * math.sin(2 * TAU * p)), ZERO),
            "LeftUpLeg": (hips.inverted(), ZERO), "RightUpLeg": (hips.inverted(), ZERO)}
    pose.update(arms(52, 4, 4, 10 + 2 * br, 10 + 2 * br, out=2.0 * br))
    return pose


def walk_pose(p):
    s, c = math.sin(TAU * p), math.cos(TAU * p)
    th = 24 * s
    bl = 4 + 22 * max(0.0, c) ** 1.5
    brr = 4 + 22 * max(0.0, -c) ** 1.5
    bob = 0.026 * abs(c) - 0.01
    roll = -6.5 * c
    yaw = -5 * s
    hips = rz(yaw) @ ry(roll)
    pose = {"Hips": (hips, (-0.01 * c, 0, bob)), "Spine": (rx(4) @ ry(-roll * 0.3) @ rz(-yaw * 0.5), ZERO),
            "Spine1": (rx(1), ZERO), "Spine2": (ry(-roll * 0.2), ZERO),
            "Head": (rx(-2 + 3.5 * math.cos(2 * TAU * p - 0.6)) @ ry(roll * 0.39) @ rz(-yaw * 0.4), ZERO),
            "LeftUpLeg": (hips.inverted() @ rx(-th), ZERO), "RightUpLeg": (hips.inverted() @ rx(th), ZERO),
            "LeftLeg": (rx(bl), ZERO), "RightLeg": (rx(brr), ZERO),
            "LeftFoot": (rx(0.8 * (th - bl)), ZERO), "RightFoot": (rx(0.8 * (-th - brr)), ZERO)}
    fl, fr = -26 * s, 26 * s
    pose.update(arms(50 - 4 * abs(c), fl, fr, 12 + 10 * max(0.0, fl) / 26, 12 + 10 * max(0.0, fr) / 26))
    return pose


def bake_clip(name, frames, fn):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    for f in range(frames + 1):
        apply_pose(fn((f % frames) / frames))
        for nme in ALL:
            pb = rig.pose.bones[P + nme]
            pb.keyframe_insert("rotation_quaternion", frame=f)
            if nme == "Hips":
                pb.keyframe_insert("location", frame=f)
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, frames
    act.use_cyclic = True
    return act


idle = bake_clip("Idle", 2 * FPS, idle_pose)
walk = bake_clip("Walk", FPS, walk_pose)
rig.animation_data.action = idle
scene.frame_start, scene.frame_end = 0, 2 * FPS
scene.frame_set(0)

blend = os.path.join(HERE, "v4.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)
if os.path.exists(blend + "1"):
    os.remove(blend + "1")

bpy.ops.object.select_all(action="DESELECT")
for o in [rig, *objs, *sockets]:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=os.path.join(HERE, "v4.glb"), export_format="GLB", use_selection=True, export_yup=True,
    export_normals=True, export_texcoords=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    export_skins=True, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
    export_leaf_bone=False, export_optimize_animation_size=True)
tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs}
print(f"BUILD_OK tris={sum(tris.values())} {tris} atlas={ATLAS_W}x{ATLAS_H} eyes={len(EYES)} mouths={len(MOUTHS)}")
