"""v2 base: recreation of reference #18 (hooded rain-cape toddler). specs/character-set.md "Deliverable 1, v2".

Run from the repo root:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_ref_girl.py

Writes next to this script: ref_girl.blend, ref_girl.glb, ref_face_atlas.png, ref_face_atlas_mask.png.
Axes: Blender Z up, character faces -Y (glTF/three.js +Z forward). Feet on z=0, height 1.0.
Shading: flat normals + a per-corner COLOR_0 gradient (top of each part lighter, hood lining darker)
for the vertex-lit look. three.js multiplies COLOR_0 into the base colour automatically.
"""
import bpy, bmesh, json, math, os, sys, random
import numpy as np
from mathutils import Vector, Quaternion, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else HERE
PAL = json.load(open(os.path.join(HERE, "..", "palette.json")))
FPS = 30
TAU = math.tau
RNG = random.Random(18)

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
    "M_Skin": SKIN,
    "M_Hood": PAL["outfit"][D["hood"]],
    "M_Underskirt": PAL["outfit"][D["underskirt"]],
    "M_Hair": HAIR,
    "M_Socks": PAL["outfit"][D["socks"]],
    "M_Shoes": PAL["outfit"][D["shoes"]],
    "M_Sole": PAL["derived"]["shoe_sole"],
    "M_Nose": PAL["derived"]["nose_highlight"],
}

# ============================================================================ face atlas
# 512x512, one row of six square frames across the top. neutral, happy, surprised, sad, angry, sleepy.
# Runtime expression swap: map.offset.x = i / 6.
ATLAS, SS, BAND = 512, 4, 86
EXPRESSIONS = ["neutral", "happy", "surprised", "sad", "angry", "sleepy"]
C_RIM = hex_srgb("#8A5A3A")
C_IRIS = hex_srgb("#4A2616")
C_PUPIL = hex_srgb("#120A08")
C_LASH = hex_srgb("#2A1810")
C_WHITE = (1.0, 1.0, 1.0)
C_BROW = hex_srgb(HAIR)
C_MOUTH = hex_srgb("#6E3A30")
C_TONGUE = hex_srgb("#D8707A")
C_BLUSH = hex_srgb("#EE9A8A")

# face-space mapping (metres, Blender coords) -> cell UV. Must match paint coordinates below.
FACE_X = 0.17                      # half width of the mapped square
FACE_Z0, FACE_Z1 = 0.53, 0.87      # mapped square bottom/top (0.34 = 2 * FACE_X)
EYE_Z, EYE_X = 0.688, 0.076        # eye centre height, eye centre offset
EYE_HW, EYE_HH = 0.039, 0.027      # eye half width (~1/4 face width each), half height


def cu_of(x): return (x + FACE_X) / (2 * FACE_X)
def cv_of(z): return (z - FACE_Z0) / (FACE_Z1 - FACE_Z0)


def paint_face_atlas():
    W, H = ATLAS * SS, BAND * SS
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (xs + 0.5) / W
    v = 1.0 - (H - ys - 0.5) / W
    idx = np.floor(u * 6).astype(np.int32)
    cu = u * 6 - idx
    cv = (v - 5 / 6) * 6
    px = 1.0 / (ATLAS / 6)
    S = 1 / (2 * FACE_X)            # metres -> cell units
    layers = []

    def add(mask, rgb, a=1.0):
        layers.append((mask, rgb, a))

    def local(cx, cy, rot):
        dx, dy = cu - cx, cv - cy
        c, s = math.cos(rot), math.sin(rot)
        return dx * c + dy * s, -dx * s + dy * c

    def disc(cx, cy, rx, ry=None, rot=0.0):
        ry = rx if ry is None else ry
        lx, ly = local(cx, cy, rot)
        return (lx / rx) ** 2 + (ly / ry) ** 2 <= 1.0

    def almond(cx, cy, hw, hh, rot, top=1.0):
        """Horizontal almond (pointed left/right). top>1 makes the upper lid rounder."""
        lx, ly = local(cx, cy, rot)
        hht, hhb = hh * top, hh
        out = np.ones_like(cu, dtype=bool)
        for sgn, h in ((1, hht), (-1, hhb)):
            R = (hw * hw + h * h) / (2 * h)
            d = R - h
            out &= (lx ** 2 + (ly + sgn * d) ** 2) <= R * R
        return out

    def stroke(points, t):
        m = np.zeros_like(cu, dtype=bool)
        for (x0, y0), (x1, y1) in zip(points[:-1], points[1:]):
            ax, ay = cu - x0, cv - y0
            bx, by = x1 - x0, y1 - y0
            h = np.clip((ax * bx + ay * by) / (bx * bx + by * by), 0, 1)
            m |= (ax - bx * h) ** 2 + (ay - by * h) ** 2 <= (t / 2) ** 2
        return m

    def curve(p0, p1, p2, t, n=10):
        pts = [((1 - k) ** 2 * p0[0] + 2 * (1 - k) * k * p1[0] + k * k * p2[0],
                (1 - k) ** 2 * p0[1] + 2 * (1 - k) * k * p1[1] + k * k * p2[1])
               for k in (i / n for i in range(n + 1))]
        return stroke(pts, t)

    ey = cv_of(EYE_Z)
    hw, hh = EYE_HW * S, EYE_HH * S
    BT, LT = 2.2 * px, 2.4 * px
    for i, name in enumerate(EXPRESSIONS):
        cell = idx == i
        m = lambda mask: mask & cell
        ba = 0.42 if name == "happy" else 0.26
        for sx in (-1, 1):
            add(m(disc(0.5 + sx * 0.30, cv_of(0.64), 0.075, 0.04)), C_BLUSH, ba)
        for cx in (cu_of(-EYE_X), cu_of(EYE_X)):
            out = -1 if cx < 0.5 else 1
            rot = out * math.radians(9)          # inner corner lower (tilted down toward the nose)
            if name in ("neutral", "surprised", "sad", "angry"):
                k = {"neutral": (1.0, 1.0), "surprised": (1.02, 1.35), "sad": (0.92, 0.85), "angry": (1.0, 0.9)}[name]
                e = almond(cx, ey, hw * k[0], hh * k[1], rot, top=1.25)
                if name == "angry":
                    e &= (cv - (ey + hh * 0.35)) < (cu - cx) * out * 0.55
                if name == "sad":
                    e &= (cv - (ey + hh * 0.6)) < -(cu - cx) * out * 0.45
                add(m(e), C_RIM)
                inner = almond(cx, ey, hw * k[0] - 1.3 * px, hh * k[1] - 1.3 * px, rot, top=1.25)
                iris = inner & disc(cx + out * 0.004, ey - 0.004, hh * k[1] * 1.45)
                add(m(e & iris), C_IRIS)
                add(m(e & disc(cx + out * 0.004, ey - 0.006, hh * k[1] * 0.62)), C_PUPIL)
                # upper lash line
                add(m(e & ~almond(cx, ey - 1.6 * px, hw * k[0], hh * k[1], rot, top=1.25)), C_LASH)
                add(m(e & disc(cx - 0.028, ey + hh * 0.42, 0.017)), C_WHITE)
                add(m(e & disc(cx + 0.022, ey - hh * 0.45, 0.008)), C_WHITE, 0.8)
            elif name == "happy":
                add(m(curve((cx - hw * 0.9, ey - hh * 0.4), (cx, ey + hh * 1.6), (cx + hw * 0.9, ey - hh * 0.4), LT * 1.3)), C_LASH)
            elif name == "sleepy":
                add(m(curve((cx - hw * 0.9, ey + hh * 0.2), (cx, ey - hh * 0.9), (cx + hw * 0.9, ey + hh * 0.2), LT * 1.1)), C_LASH)
            # thin arched brows close above the eye: (outer, mid, inner) height offsets in eye half-heights
            bo = {"neutral": (1.9, 2.55, 2.15), "happy": (2.2, 2.9, 2.4), "surprised": (2.7, 3.4, 3.0),
                  "sad": (1.9, 2.5, 2.9), "angry": (2.6, 2.2, 1.55), "sleepy": (1.7, 2.1, 1.8)}[name]
            add(m(curve((cx + out * hw * 1.05, ey + hh * bo[0]), (cx + out * hw * 0.1, ey + hh * bo[1]),
                        (cx - out * hw * 0.85, ey + hh * bo[2]), BT * (1.4 if name == "angry" else 1.0))), C_BROW)
        my = cv_of(0.617)
        if name == "neutral":
            add(m(stroke([(0.462, my + 0.004), (0.5, my - 0.002), (0.538, my + 0.004)], LT * 0.9)), C_MOUTH)
        elif name == "happy":
            mo = disc(0.5, my + 0.012, 0.045, 0.042) & (cv <= my + 0.012)
            add(m(mo), C_MOUTH)
            add(m(mo & disc(0.5, my - 0.022, 0.026, 0.016)), C_TONGUE)
        elif name == "surprised":
            add(m(disc(0.5, my - 0.005, 0.022, 0.03)), C_MOUTH)
        elif name == "sad":
            add(m(curve((0.468, my - 0.012), (0.5, my + 0.018), (0.532, my - 0.012), LT)), C_MOUTH)
        elif name == "angry":
            add(m(curve((0.46, my - 0.01), (0.5, my + 0.012), (0.54, my - 0.01), LT * 1.2)), C_MOUTH)
        elif name == "sleepy":
            add(m(disc(0.5, my, 0.014, 0.018)), C_MOUTH)

    skin = np.array(hex_srgb(SKIN), np.float32)
    baked = np.broadcast_to(skin, (H, W, 3)).copy()
    mrgb = np.zeros((H, W, 3), np.float32)
    ma = np.zeros((H, W), np.float32)
    for mask, rgb, a in layers:
        k = mask.astype(np.float32) * a
        col = np.array(rgb, np.float32)
        baked = baked * (1 - k[..., None]) + col * k[..., None]
        na = k + ma * (1 - k)
        mrgb = (col * k[..., None] + mrgb * (ma * (1 - k))[..., None]) / np.where(na > 0, na, 1)[..., None]
        ma = na

    def down(arr):
        h, w = arr.shape[:2]
        return arr.reshape(h // SS, SS, w // SS, SS, *arr.shape[2:]).mean(axis=(1, 3))

    bimg = np.zeros((ATLAS, ATLAS, 4), np.float32)
    bimg[..., :3] = skin
    bimg[..., 3] = 1
    bimg[ATLAS - BAND:, :, :3] = down(baked)
    pm, da = down(mrgb * ma[..., None]), down(ma)
    mimg = np.zeros((ATLAS, ATLAS, 4), np.float32)
    mimg[ATLAS - BAND:, :, :3] = pm / np.where(da > 0, da, 1)[..., None]
    mimg[ATLAS - BAND:, :, 3] = da
    return bimg, mimg


def make_image(name, arr, path):
    img = bpy.data.images.new(name, ATLAS, ATLAS, alpha=True)
    img.pixels.foreach_set(arr.reshape(-1).astype(np.float32))
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return img


b_arr, m_arr = paint_face_atlas()
face_img = make_image("RefFaceAtlas", b_arr, os.path.join(OUT, "ref_face_atlas.png"))
make_image("RefFaceAtlasMask", m_arr, os.path.join(OUT, "ref_face_atlas_mask.png"))
face_img.pack()


# ============================================================================ materials
def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def new_mat(name, hexcol=None, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs["Roughness"].default_value = 0.92
    b.inputs["Metallic"].default_value = 0.0
    if image is not None:
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = image
        m.node_tree.links.new(t.outputs["Color"], b.inputs["Base Color"])
    else:
        c = (*lin(hex_srgb(hexcol)), 1)
        b.inputs["Base Color"].default_value = c
        m.diffuse_color = c
    return m


MAT_ORDER = ["M_Skin", "M_Face", "M_Hood", "M_Underskirt", "M_Hair", "M_Nose", "M_Socks", "M_Shoes", "M_Sole"]
MI = {n: i for i, n in enumerate(MAT_ORDER)}
mats = [new_mat(n, image=face_img) if n == "M_Face" else new_mat(n, COLORS[n]) for n in MAT_ORDER]

# ============================================================================ mesh
bm = bmesh.new()
L_PART = bm.verts.layers.int.new("part")
PARTS = ["head", "bangs", "nose", "dress", "under", "sleeve_L", "sleeve_R", "hand_L", "hand_R",
         "leg_L", "leg_R", "shoe_L", "shoe_R"]
PI = {n: i for i, n in enumerate(PARTS)}
FPART = {}      # face -> (part, material, shade multiplier)


def vnew(co, part):
    v = bm.verts.new(co)
    v[L_PART] = PI[part]
    return v


def fnew(vs, part, mat, shade=1.0):
    f = bm.faces.new(vs)
    FPART[f] = (part, mat, shade)
    return f


def jit(a):
    return RNG.uniform(-a, a)


def mirrored_angles(half):
    """half: angles in degrees from the front (0) to the back (180) -> full ring, front first, CCW from above."""
    inner = [a for a in half if 0 < a < 180]
    return [0] + inner + ([180] if 180 in half else []) + [-a for a in reversed(inner)]


def ring_xy(lon_deg, rx, ry):
    # lon 0 = front (-Y); positive lon toward +X (character's left)
    r = math.radians(lon_deg)
    return math.sin(r) * rx, -math.cos(r) * ry


# ---------------------------------------------------------------- head + hood (one teardrop shell)
HEAD_LON = mirrored_angles([0, 18, 36, 56, 82, 112, 146, 180])
FACE_LON = 36
RIM_LON = 56
HEAD_RINGS = [  # z, rx, ry, cy   (widest ring just above the eye line)
    (0.555, 0.105, 0.095, 0.02),
    (0.585, 0.19, 0.17, 0.012),
    (0.635, 0.232, 0.2, 0.012),
    (0.695, 0.255, 0.212, 0.015),
    (0.758, 0.264, 0.218, 0.022),
    (0.82, 0.25, 0.21, 0.034),
    (0.878, 0.215, 0.195, 0.052),
    (0.932, 0.162, 0.162, 0.082),
    (0.972, 0.098, 0.108, 0.118),
]
APEX = Vector((0.0, 0.16, 0.99))
FACE_RINGS = (1, 2, 3, 4, 5)      # rings whose |lon|<=36 verts form the recessed face oval
FACE_XS = {1: 0.5, 2: 0.88, 3: 1.0, 4: 0.95, 5: 0.66}
RIM_X = {1: 0.155, 2: 0.2, 3: 0.215, 4: 0.217, 5: 0.2}
FACE_SET = set()


def face_y(ring, lon):
    y = -(0.118 + 0.047 * math.cos(math.radians(lon) * 1.6))
    if ring == 1:
        y += 0.018 + 0.014 * abs(lon) / 36    # soft chin sitting on the hood's neck
    if ring == 5:
        y += 0.012                             # forehead slides under the brim
    return y


head_loops = []
for ri, (z, rx, ry, cy) in enumerate(HEAD_RINGS):
    loop = []
    for lon in HEAD_LON:
        a = abs(lon)
        x, y = ring_xy(lon, rx, ry)
        y += cy
        zz = z
        if ri in FACE_RINGS and a <= FACE_LON:
            x = math.copysign(math.sin(math.radians(a)) / math.sin(math.radians(FACE_LON)) * 0.145 * FACE_XS[ri], lon) if a else 0.0
            y = face_y(ri, a)
            FACE_SET.add((ri, lon))
        elif ri in FACE_RINGS and a == RIM_LON:
            x = math.copysign(RIM_X[ri], lon)
            y = -0.2 + (0.035 if ri == 1 else 0.0) + (0.012 if ri == 5 else 0.0)
        elif ri == 6 and a <= RIM_LON:
            y = min(y, -0.185 + 0.012 * a / RIM_LON)      # top brim of the horseshoe
            zz = z - 0.006 * (1 - a / RIM_LON)
        else:
            j = 0.013 if ri not in (0,) else 0.0              # irregular hand-decimated planes
            x += jit(j) * (1 if lon >= 0 else -1)
            zz += jit(j * 0.8)
        loop.append((x, y, zz))
    # mirror jitter so left/right match
    n = len(HEAD_LON)
    for k in range(1, n // 2):
        x, y, zz = loop[k]
        loop[n - k] = (-x, y, zz)
    head_loops.append([vnew(Vector(p), "head") for p in loop])

apex = vnew(APEX, "head")
n = len(HEAD_LON)
for ri in range(len(head_loops) - 1):
    a_l, b_l = head_loops[ri], head_loops[ri + 1]
    for k in range(n):
        k2 = (k + 1) % n
        lon0, lon1 = abs(HEAD_LON[k]), abs(HEAD_LON[k2])
        is_face = all(((r, HEAD_LON[kk]) in FACE_SET) for r in (ri, ri + 1) for kk in (k, k2))
        lining = (not is_face) and (
            (ri in FACE_RINGS and ri + 1 in FACE_RINGS and max(lon0, lon1) <= RIM_LON)
            or (ri == 5 and max(lon0, lon1) <= RIM_LON))
        mat = MI["M_Face"] if is_face else MI["M_Hood"]
        fnew([a_l[k], b_l[k], b_l[k2], a_l[k2]], "head", mat, 0.72 if lining else 1.0)
for k in range(n):
    fnew([head_loops[-1][k], apex, head_loops[-1][(k + 1) % n]], "head", MI["M_Hood"])

# ---------------------------------------------------------------- bangs (angular chunks under the brim, side part)
BANGS = [  # x0, x1, tip x, tip z   (side part on the character's right = image left)
    (-0.158, -0.035, -0.118, 0.742),
    (-0.05, 0.05, 0.005, 0.768),
    (0.035, 0.11, 0.078, 0.752),
    (0.098, 0.162, 0.148, 0.775),
]
for x0, x1, tx, tz in BANGS:
    top = 0.812
    yb = face_y(5, 0) - 0.006
    p = [Vector((x0, yb - 0.004, top)), Vector((x1, yb - 0.004, top + 0.004)),
         Vector(((x0 + x1) / 2, yb + 0.03, top + 0.012)), Vector((tx, yb - 0.022, tz))]
    vs = [vnew(q, "bangs") for q in p]
    for t in [(0, 3, 1), (1, 3, 2), (2, 3, 0), (0, 1, 2)]:
        fnew([vs[i] for i in t], "bangs", MI["M_Hair"])

# ---------------------------------------------------------------- nose (small pale bump)
nz, ny = 0.655, face_y(3, 0) + 0.004
p = [Vector((-0.016, ny, nz - 0.01)), Vector((0.016, ny, nz - 0.01)), Vector((0.0, ny, nz + 0.024)),
     Vector((0.0, ny - 0.02, nz - 0.004))]
vs = [vnew(q, "nose") for q in p]
for t in [(0, 3, 1), (1, 3, 2), (2, 3, 0), (0, 1, 2)]:
    fnew([vs[i] for i in t], "nose", MI["M_Nose"])


# ---------------------------------------------------------------- generic loft
def loft(part, axis, rings, lons, mat, start=None, end=None, jitter=0.0, flip=False, wave=0.0):
    loops = []
    for ri, (c, ra, rb) in enumerate(rings):
        loop = []
        for li, lon in enumerate(lons):
            r = math.radians(lon)
            s_, c_ = math.sin(r), math.cos(r)
            if axis == "Z":
                off = Vector((s_ * ra, -c_ * rb, 0))
            elif axis == "X":    # lon 0 = up (+Z), toward front (-Y) positive
                off = Vector((0, -s_ * ra, c_ * rb))
            else:                # "Y", lon 0 = up
                off = Vector((s_ * ra, 0, c_ * rb))
            q = c + off
            if jitter:
                q += Vector((jit(jitter), jit(jitter), jit(jitter)))
            if wave and ri == len(rings) - 1:
                q.z += wave * (1 if li % 2 else -1)
            loop.append(vnew(q, part))
        loops.append(loop)
    nn = len(lons)

    def f(vs, m=mat):
        return fnew(list(reversed(vs)) if flip else vs, part, m)

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


# ---------------------------------------------------------------- cape-dress (bell) + pink underskirt
DRESS_LON = mirrored_angles([0, 32, 68, 106, 144, 180])
loft("dress", "Z", [
    (Vector((0, 0.02, 0.575)), 0.09, 0.08),
    (Vector((0, 0.01, 0.505)), 0.148, 0.125),
    (Vector((0, 0.0, 0.40)), 0.182, 0.152),
    (Vector((0, 0.0, 0.295)), 0.198, 0.17),
    (Vector((0, 0.0, 0.2)), 0.214, 0.182),
], DRESS_LON, MI["M_Hood"], jitter=0.006, wave=0.013)
loft("under", "Z", [
    (Vector((0, 0, 0.33)), 0.165, 0.135),
    (Vector((0, 0, 0.172)), 0.192, 0.165),
], DRESS_LON, MI["M_Underskirt"], end=Vector((0, 0, 0.215)))

# ---------------------------------------------------------------- sleeves, hands, legs, shoes
ARM_Z = 0.5
SLEEVE_LON = [0, 45, 90, 135, 180, 225, 270, 315]
for sx, side in ((1, "L"), (-1, "R")):
    loft(f"sleeve_{side}", "X", [
        (Vector((sx * 0.06, 0, ARM_Z)), 0.07, 0.07),
        (Vector((sx * 0.13, 0, ARM_Z)), 0.078, 0.074),
        (Vector((sx * 0.2, 0, ARM_Z - 0.004)), 0.07, 0.066),
        (Vector((sx * 0.262, 0, ARM_Z - 0.006)), 0.055, 0.05),
    ], SLEEVE_LON, MI["M_Hood"], end=Vector((sx * 0.25, 0, ARM_Z - 0.006)), flip=sx > 0, jitter=0.003)
    loft(f"hand_{side}", "X", [
        (Vector((sx * 0.245, 0, ARM_Z - 0.006)), 0.03, 0.03),
        (Vector((sx * 0.285, 0, ARM_Z - 0.008)), 0.047, 0.042),
        (Vector((sx * 0.325, 0, ARM_Z - 0.01)), 0.046, 0.04),
    ], [0, 60, 120, 180, 240, 300], MI["M_Skin"], end=Vector((sx * 0.36, 0, ARM_Z - 0.012)), flip=sx > 0)

    lx = sx * 0.066
    legs = loft(f"leg_{side}", "Z", [
        (Vector((lx, 0, 0.05)), 0.042, 0.042),
        (Vector((lx, 0, 0.098)), 0.049, 0.049),     # rolled sock top
        (Vector((lx, 0, 0.114)), 0.043, 0.043),
        (Vector((lx, 0, 0.21)), 0.045, 0.045),
        (Vector((lx, 0, 0.33)), 0.05, 0.05),
    ], [30, 90, 150, 210, 270, 330], MI["M_Skin"])

    def sh(y, ra, rb):
        return (Vector((lx, y, rb * 0.924)), ra, rb)
    loft(f"shoe_{side}", "Y", [
        sh(0.05, 0.047, 0.036),
        sh(0.0, 0.061, 0.047),
        sh(-0.065, 0.062, 0.043),
    ], [22.5 + 45 * k for k in range(8)], MI["M_Shoes"],
        start=Vector((lx, 0.075, 0.032)), end=Vector((lx, -0.122, 0.03)), flip=True)

# ============================================================================ finish mesh
# triangulate: jittered quads become the irregular hand-decimated triangles and keep true flat normals
old = dict(FPART)
res = bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="BEAUTY")
for src, new in res["face_map"].items():
    FPART[src] = old[new]
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uv = bm.loops.layers.uv.new("UVMap")
col = bm.loops.layers.float_color.new("Color")

# per-part z range for the vertical gradient
zr = {}
for v in bm.verts:
    p = PARTS[v[L_PART]]
    lo, hi = zr.get(p, (9, -9))
    zr[p] = (min(lo, v.co.z), max(hi, v.co.z))

for face in bm.faces:
    part, mat, shade = FPART[face]
    c = face.calc_center_median()
    if part.startswith("leg"):
        mat = MI["M_Socks"] if c.z < 0.112 else MI["M_Skin"]
    if part.startswith("shoe") and face.normal.z < -0.6:
        mat = MI["M_Sole"]
    face.material_index = mat
    face.smooth = False
    lo, hi = zr[part]
    for loop in face.loops:
        p = loop.vert.co
        t = (p.z - lo) / max(hi - lo, 1e-6)
        if mat == MI["M_Face"]:
            s = 0.93 + 0.07 * min(1.0, (p.z - 0.585) / 0.2)
            loop[uv].uv = (min(max(cu_of(p.x), 0.02), 0.98) / 6, 5 / 6 + min(max(cv_of(p.z), 0.02), 0.98) / 6)
        else:
            s = 0.8 + 0.2 * t
            loop[uv].uv = (0.5, 0.25)
        s *= shade
        loop[col] = (s, s, s, 1.0)

me = bpy.data.meshes.new("RefGirl")
bm.to_mesh(me)
vpart = [v[L_PART] for v in bm.verts]
bm.free()
me.color_attributes.active_color = me.color_attributes["Color"]
if "part" in me.attributes:
    me.attributes.remove(me.attributes["part"])
for m in mats:
    me.materials.append(m)
body = bpy.data.objects.new("RefGirl", me)
scene.collection.objects.link(body)

# ============================================================================ rig (Mixamo names)
P = "mixamorig:"
BONES = [
    ("Hips", (0, 0, 0.30), (0, 0, 0.36), None),
    ("Spine", (0, 0, 0.36), (0, 0, 0.42), "Hips"),
    ("Spine1", (0, 0, 0.42), (0, 0, 0.48), "Spine"),
    ("Spine2", (0, 0, 0.48), (0, 0, 0.54), "Spine1"),
    ("Neck", (0, 0, 0.54), (0, 0, 0.58), "Spine2"),
    ("Head", (0, 0, 0.58), (0, 0, 1.0), "Neck"),
]
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


def clamp01(x): return max(0.0, min(1.0, x))


groups = {}
for vi, v in enumerate(me.vertices):
    part, co = PARTS[vpart[vi]], v.co
    if part in ("head", "bangs", "nose"):
        w = {"Head": 1.0}
        if part == "head" and co.z < 0.6:
            w = {"Head": 0.7, "Neck": 0.3}
    elif part in ("dress", "under"):
        w = chain(co.z, [0.0, 0.36, 0.42, 0.48, 0.555], ["Hips", "Spine", "Spine1", "Spine2", "Neck"], 0.03)
        # hem follows the legs a little so the bell sways on the walk
        k = clamp01((0.33 - co.z) / 0.13) * (0.45 if part == "under" else 0.35)
        if k > 0:
            sl = clamp01(0.5 + co.x / 0.25)
            w = {b: x * (1 - k) for b, x in w.items()}
            w["LeftUpLeg"] = w.get("LeftUpLeg", 0) + k * sl
            w["RightUpLeg"] = w.get("RightUpLeg", 0) + k * (1 - sl)
    elif part.startswith(("sleeve", "hand")):
        S = "Left" if part.endswith("L") else "Right"
        x = abs(co.x)
        if part.startswith("hand"):
            w = {f"{S}Hand": 1.0}
        elif x < 0.09:
            w = {f"{S}Shoulder": 0.5, f"{S}Arm": 0.2, "Spine2": 0.3}
        else:
            w = chain(x, [0.0, 0.09, 0.18, 0.255], [f"{S}Shoulder", f"{S}Arm", f"{S}ForeArm", f"{S}Hand"], 0.03)
    elif part.startswith("leg"):
        S = "Left" if part.endswith("L") else "Right"
        w = {f"{S}UpLeg": 1.0} if co.z > 0.2 else ({f"{S}Leg": 1.0} if co.z > 0.075 else {f"{S}Foot": 0.6, f"{S}Leg": 0.4})
    else:  # shoes
        S = "Left" if part.endswith("L") else "Right"
        w = {f"{S}Foot": 1.0} if co.y > -0.045 else ({f"{S}ToeBase": 1.0} if co.y < -0.075 else {f"{S}Foot": 0.5, f"{S}ToeBase": 0.5})
    for b, x in w.items():
        if x > 1e-4:
            if b not in groups:
                groups[b] = body.vertex_groups.new(name=P + b)
            groups[b].add([vi], x, "REPLACE")

body.parent = rig
body.modifiers.new("Armature", "ARMATURE").object = rig


def socket(name, bone, loc):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    e.empty_display_size = 0.05
    scene.collection.objects.link(e)
    e.parent, e.parent_type, e.parent_bone = rig, "BONE", P + bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(Vector(loc))
    return e


sockets = [
    socket("Socket_R_Hand", "RightHand", (-0.305, -0.01, ARM_Z - 0.01)),
    socket("Socket_L_Hand", "LeftHand", (0.305, -0.01, ARM_Z - 0.01)),
    socket("Socket_Back", "Spine2", (0.0, 0.2, 0.42)),
]


# ============================================================================ animation
def rx(d): return Quaternion((1, 0, 0), math.radians(d))
def ry(d): return Quaternion((0, 1, 0), math.radians(d))
def rz(d): return Quaternion((0, 0, 1), math.radians(d))


ALL = [b[0] for b in BONES]
REST = {n: rig.data.bones[P + n].matrix_local.to_3x3().to_quaternion() for n in ALL}


def apply_pose(pose):
    for n in ALL:
        pb = rig.pose.bones[P + n]
        pb.rotation_mode = "QUATERNION"
        R, Lc = pose.get(n, (Quaternion(), (0, 0, 0)))
        B = REST[n]
        pb.rotation_quaternion = B.inverted() @ R @ B
        pb.location = B.inverted() @ Vector(Lc)


ZERO = (0, 0, 0)


def arms(down, fl, fr, bl, br, out=0.0):
    return {
        "LeftArm": (rx(-fl) @ ry(down + out), ZERO),
        "RightArm": (rx(-fr) @ ry(-(down + out)), ZERO),
        "LeftForeArm": (rz(-bl), ZERO),
        "RightForeArm": (rz(br), ZERO),
    }


def idle_pose(p):
    br = math.sin(TAU * p)
    roll = 1.8 * math.sin(TAU * p)
    hips = ry(roll)
    pose = {
        "Hips": (hips, (0, 0, 0.004 * br - 0.002)),
        "Spine": (rx(1.0 * br), ZERO),
        "Spine1": (rx(0.6 * br) @ ry(-roll * 0.5), ZERO),
        "Head": (ry(-3.0 * math.sin(TAU * p + 0.6)) @ rx(1.8 * math.sin(2 * TAU * p)), ZERO),
        "LeftUpLeg": (hips.inverted(), ZERO),
        "RightUpLeg": (hips.inverted(), ZERO),
    }
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
    pose = {
        "Hips": (hips, (-0.01 * c, 0, bob)),
        "Spine": (rx(4) @ ry(-roll * 0.3) @ rz(-yaw * 0.5), ZERO),
        "Spine1": (rx(1), ZERO),
        "Spine2": (ry(-roll * 0.2), ZERO),
        # hood sways: head lags the body roll and nods on each step
        "Head": (rx(-2 + 3.5 * math.cos(2 * TAU * p - 0.6)) @ ry(roll * 0.45 * math.cos(0.5)) @ rz(-yaw * 0.4), ZERO),
        "LeftUpLeg": (hips.inverted() @ rx(-th), ZERO),
        "RightUpLeg": (hips.inverted() @ rx(th), ZERO),
        "LeftLeg": (rx(bl), ZERO),
        "RightLeg": (rx(brr), ZERO),
        "LeftFoot": (rx(0.8 * (th - bl)), ZERO),
        "RightFoot": (rx(0.8 * (-th - brr)), ZERO),
    }
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
        for n in ALL:
            pb = rig.pose.bones[P + n]
            pb.keyframe_insert("rotation_quaternion", frame=f)
            if n == "Hips":
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

blend = os.path.join(OUT, "ref_girl.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)
if os.path.exists(blend + "1"):
    os.remove(blend + "1")

bpy.ops.object.select_all(action="DESELECT")
for o in [body, rig, *sockets]:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "ref_girl.glb"),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_normals=True,
    export_texcoords=True,
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_skins=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_force_sampling=True,
    export_leaf_bone=False,
    export_optimize_animation_size=True,
)
tris = sum(len(p.vertices) - 2 for p in me.polygons)
print(f"BUILD_OK tris={tris} bones={len(rig.data.bones)} actions={[a.name for a in bpy.data.actions]}")
