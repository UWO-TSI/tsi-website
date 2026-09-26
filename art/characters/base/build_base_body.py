"""Build the neutral base character body (deliverable 1, specs/character-set.md).

Run from the repo root:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_base_body.py

Writes next to this script:
  base_body.blend, base_body.glb, face_atlas.png (skin baked), face_atlas_mask.png (features on alpha)

Everything is generated here; no hand-edited state. Colours come from ../palette.json.
Axes: Blender Z up, character faces -Y (exports as glTF/three.js +Z forward). Feet on z=0.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector, Quaternion, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else HERE
PALETTE = json.load(open(os.path.join(HERE, "..", "palette.json")))
FPS = 30
TAU = math.tau

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS


# ----------------------------------------------------------------------------- colours
def hex_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def srgb_to_lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


D = PALETTE["base_body_defaults"]
SKIN = PALETTE["skin"][D["skin"]]
COLORS = {
    "M_Skin": SKIN,
    "M_BaseTop": PALETTE["outfit"][D["top"]],
    "M_BaseBottom": PALETTE["outfit"][D["bottom"]],
    "M_Socks": PALETTE["outfit"][D["socks"]],
    "M_Shoes": PALETTE["outfit"][D["shoes"]],
}


# ----------------------------------------------------------------------------- face atlas
# 512x512, one row of six square frames across the top (cell = 1/6 x 1/6 of the texture).
# Frame order: neutral, happy, surprised, sad, angry, sleepy. Runtime swap: texture.offset.x = i / 6.
ATLAS = 512
SS = 4                      # supersampling
BAND = 86                   # final-res rows covering the top 1/6 (+ a sliver of skin)
EXPRESSIONS = ["neutral", "happy", "surprised", "sad", "angry", "sleepy"]

C_EYE = hex_srgb("#2B1D18")
C_IRIS = hex_srgb("#6B4532")
C_WHITE = (1.0, 1.0, 1.0)
C_BROW = hex_srgb("#4A3326")
C_MOUTH = hex_srgb("#7A3B34")
C_TONGUE = hex_srgb("#E07A7A")
C_BLUSH = hex_srgb("#F29A8E")


def paint_face_atlas():
    W = ATLAS * SS
    H = BAND * SS
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    u = (xs + 0.5) / W
    v = 1.0 - (H - ys - 0.5) / W            # ys=0 is the lowest band row; v in atlas UV (up)
    idx = np.floor(u * 6).astype(np.int32)
    cu = u * 6 - idx
    cv = (v - 5 / 6) * 6
    px = 1.0 / (ATLAS / 6)                  # one final pixel in cell units

    layers = []                             # (mask float 0..1, rgb, alpha)

    def add(mask, rgb, a=1.0):
        layers.append((mask.astype(np.float32), rgb, a))

    def disc(cx, cy, rx, ry=None, rot=0.0):
        ry = rx if ry is None else ry
        dx, dy = cu - cx, cv - cy
        c, s = math.cos(rot), math.sin(rot)
        lx, ly = dx * c + dy * s, -dx * s + dy * c
        return (lx / rx) ** 2 + (ly / ry) ** 2 <= 1.0

    def almond(cx, cy, a, b, rot):
        # lens: intersection of two discs offset along local x -> points at top and bottom
        R = (a * a + b * b) / (2 * a)
        d = R - a
        dx, dy = cu - cx, cv - cy
        c, s = math.cos(rot), math.sin(rot)
        lx, ly = dx * c + dy * s, -dx * s + dy * c
        return (((lx - d) ** 2 + ly ** 2) <= R * R) & (((lx + d) ** 2 + ly ** 2) <= R * R)

    def stroke(points, t):
        m = np.zeros_like(cu, dtype=bool)
        for (x0, y0), (x1, y1) in zip(points[:-1], points[1:]):
            ax, ay = cu - x0, cv - y0
            bx, by = x1 - x0, y1 - y0
            h = np.clip((ax * bx + ay * by) / (bx * bx + by * by), 0, 1)
            m |= (ax - bx * h) ** 2 + (ay - by * h) ** 2 <= (t / 2) ** 2
        return m

    def curve(p0, p1, p2, t, n=8):
        pts = []
        for i in range(n + 1):
            k = i / n
            pts.append(((1 - k) ** 2 * p0[0] + 2 * (1 - k) * k * p1[0] + k * k * p2[0],
                        (1 - k) ** 2 * p0[1] + 2 * (1 - k) * k * p1[1] + k * k * p2[1]))
        return stroke(pts, t)

    EX = (0.31, 0.69)       # eye centres (image-left, image-right)
    EY = 0.42
    BT = 2.4 * px           # brow thickness
    LT = 2.6 * px           # line thickness for closed eyes / mouths

    for i, name in enumerate(EXPRESSIONS):
        cell = idx == i
        m = lambda mask: mask & cell

        # blush + nose highlight (all frames)
        blush_a = 0.5 if name == "happy" else 0.32
        for sx in (-1, 1):
            add(m(disc(0.5 + sx * 0.29, 0.30, 0.065, 0.036)), C_BLUSH, blush_a)
        add(m(disc(0.5, 0.315, 0.022, 0.015)), C_WHITE, 0.55)

        for side, cx in enumerate(EX):
            out = -1 if cx < 0.5 else 1           # outward direction in u
            tilt = -out * math.radians(12)         # top of the eye leans outward
            if name in ("neutral", "surprised", "sad", "angry"):
                a, b = {"neutral": (0.052, 0.074), "surprised": (0.060, 0.086),
                        "sad": (0.046, 0.064), "angry": (0.050, 0.068)}[name]
                if name == "surprised":
                    eye = disc(cx, EY + 0.01, a, b)
                else:
                    eye = almond(cx, EY, a, b, tilt)
                if name == "angry":
                    # lid cut sloping down toward the nose
                    inner = -out
                    lid = (cv - (EY + 0.035)) < (cu - cx) * out * 0.9
                    eye = eye & lid
                add(m(eye), C_EYE)
                add(m(eye & disc(cx, EY - 0.03, a * 0.75, b * 0.55)), C_IRIS)
                add(m(disc(cx + 0.012 * -out, EY + 0.028, 0.017 if name != "surprised" else 0.022)), C_WHITE)
            elif name == "happy":
                add(m(curve((cx - 0.055, EY - 0.02), (cx, EY + 0.075), (cx + 0.055, EY - 0.02), LT * 1.2)), C_EYE)
            elif name == "sleepy":
                add(m(curve((cx - 0.055, EY + 0.02), (cx, EY - 0.035), (cx + 0.055, EY + 0.02), LT)), C_EYE)

            # brows: (outer point, mid, inner point) heights
            bx_out, bx_in = cx + out * 0.07, cx - out * 0.06
            by = {"neutral": (0.575, 0.60, 0.585), "happy": (0.60, 0.63, 0.61),
                  "surprised": (0.64, 0.675, 0.655), "sad": (0.575, 0.60, 0.635),
                  "angry": (0.625, 0.60, 0.555), "sleepy": (0.56, 0.575, 0.565)}[name]
            add(m(curve((bx_out, by[0]), (cx, by[1] + 0.012), (bx_in, by[2]),
                        BT * (1.35 if name == "angry" else 1.0))), C_BROW)

        # mouths
        if name == "neutral":
            add(m(curve((0.465, 0.205), (0.5, 0.18), (0.535, 0.205), LT)), C_MOUTH)
        elif name == "happy":
            mouth = disc(0.5, 0.215, 0.052, 0.05) & (cv <= 0.215)
            add(m(mouth), C_MOUTH)
            add(m(mouth & disc(0.5, 0.17, 0.03, 0.02)), C_TONGUE)
        elif name == "surprised":
            add(m(disc(0.5, 0.19, 0.028, 0.038)), C_MOUTH)
        elif name == "sad":
            add(m(curve((0.462, 0.178), (0.5, 0.215), (0.538, 0.178), LT)), C_MOUTH)
        elif name == "angry":
            add(m(curve((0.455, 0.18), (0.5, 0.205), (0.545, 0.18), LT * 1.15)), C_MOUTH)
        elif name == "sleepy":
            add(m(disc(0.5, 0.195, 0.016, 0.02)), C_MOUTH)

    skin = np.array(hex_srgb(SKIN), dtype=np.float32)
    baked = np.broadcast_to(skin, (H, W, 3)).copy()
    mask_rgb = np.zeros((H, W, 3), np.float32)
    mask_a = np.zeros((H, W), np.float32)
    for mask, rgb, a in layers:
        k = mask * a
        col = np.array(rgb, np.float32)
        baked = baked * (1 - k[..., None]) + col * k[..., None]
        # "over" onto the transparent mask layer (straight alpha)
        na = k + mask_a * (1 - k)
        safe = np.where(na > 0, na, 1)
        mask_rgb = (col * k[..., None] + mask_rgb * (mask_a * (1 - k))[..., None]) / safe[..., None]
        mask_a = na

    def down(arr):
        h, w = arr.shape[:2]
        return arr.reshape(h // SS, SS, w // SS, SS, *arr.shape[2:]).mean(axis=(1, 3))

    def full(rgb_band, a_band, bg_rgb, bg_a):
        img = np.zeros((ATLAS, ATLAS, 4), np.float32)
        img[..., :3] = bg_rgb
        img[..., 3] = bg_a
        img[ATLAS - BAND:, :, :3] = down(rgb_band)
        img[ATLAS - BAND:, :, 3] = down(a_band) if a_band is not None else 1.0
        return img

    # premultiply for correct downsampling of the mask, then un-premultiply
    pm = down(mask_rgb * mask_a[..., None])
    da = down(mask_a)
    mask_img = np.zeros((ATLAS, ATLAS, 4), np.float32)
    mask_img[ATLAS - BAND:, :, :3] = pm / np.where(da > 0, da, 1)[..., None]
    mask_img[ATLAS - BAND:, :, 3] = da
    baked_img = full(baked, None, skin, 1.0)
    return baked_img, mask_img


def make_image(name, arr, path):
    img = bpy.data.images.new(name, ATLAS, ATLAS, alpha=True)
    img.pixels.foreach_set(arr.reshape(-1).astype(np.float32))
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    return img


baked_arr, mask_arr = paint_face_atlas()
face_img = make_image("FaceAtlas", baked_arr, os.path.join(OUT, "face_atlas.png"))
make_image("FaceAtlasMask", mask_arr, os.path.join(OUT, "face_atlas_mask.png"))
face_img.pack()


# ----------------------------------------------------------------------------- materials
def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def solid_mat(name, hexcol):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs["Base Color"].default_value = (*srgb_to_lin(hex_srgb(hexcol)), 1)
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (*srgb_to_lin(hex_srgb(hexcol)), 1)
    return m


def face_mat():
    m = bpy.data.materials.new("M_Face")
    m.use_nodes = True
    nt = m.node_tree
    b = principled(m)
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = face_img
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    return m


MAT_ORDER = ["M_Skin", "M_Face", "M_BaseTop", "M_BaseBottom", "M_Socks", "M_Shoes"]
MI = {n: i for i, n in enumerate(MAT_ORDER)}
mats = [face_mat() if n == "M_Face" else solid_mat(n, COLORS[n]) for n in MAT_ORDER]


# ----------------------------------------------------------------------------- mesh
bm = bmesh.new()
part_layer = bm.verts.layers.int.new("part")
PARTS = ["head", "ear", "torso", "arm_L", "arm_R", "hand_L", "hand_R", "leg_L", "leg_R", "shoe_L", "shoe_R"]
PI = {n: i for i, n in enumerate(PARTS)}
face_part = {}


def ring_point(axis, center, ang, ra, rb):
    c, s = math.cos(ang), math.sin(ang)
    if axis == "Z":
        return center + Vector((c * ra, s * rb, 0))
    if axis == "X":
        return center + Vector((0, c * ra, s * rb))
    return center + Vector((c * ra, 0, s * rb))    # "Y"


def loft(part, axis, rings, sides, start=None, end=None, ang0=0.0, flip=False):
    """rings: [(center Vector, ra, rb)], start/end: apex Vector or None (open)."""
    loops = []
    for center, ra, rb in rings:
        loop = []
        for k in range(sides):
            v = bm.verts.new(ring_point(axis, center, ang0 + TAU * k / sides, ra, rb))
            v[part_layer] = PI[part]
            loop.append(v)
        loops.append(loop)
    faces = []

    def f(vs):
        face = bm.faces.new(list(reversed(vs)) if flip else vs)
        face_part[face] = part
        faces.append(face)

    for a, b in zip(loops[:-1], loops[1:]):
        for k in range(sides):
            f([a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]])
    for apex, loop, rev in ((start, loops[0], True), (end, loops[-1], False)):
        if apex is None:
            continue
        pv = bm.verts.new(apex)
        pv[part_layer] = PI[part]
        for k in range(sides):
            tri = [loop[k], loop[(k + 1) % sides], pv]
            f(list(reversed(tri)) if rev else tri)
    return faces


# Head: faceted UV-sphere, 14 segments x 9 bands, vertex column at the front (-Y).
HEAD_C = Vector((0, 0, 0.93))
HR = (0.215, 0.195, 0.20)


def build_head():
    segs, bands = 14, 9
    rings = []
    for j in range(1, bands):
        lat = -math.pi / 2 + math.pi * j / bands
        loop = []
        for k in range(segs):
            lon = -math.pi / 2 + TAU * k / segs
            x = math.cos(lat) * math.cos(lon) * HR[0]
            y = math.cos(lat) * math.sin(lon) * HR[1]
            z = math.sin(lat) * HR[2]
            if lat < 0:                                   # fuller cheeks, softer chin
                bulge = 1.0 + 0.07 * math.sin(-lat * 2) if lat > -1.2 else 0.96
                x *= bulge
                y *= 1.0 + 0.03 * math.sin(-lat * 2)
            v = bm.verts.new(HEAD_C + Vector((x, y, z)))
            v[part_layer] = PI["head"]
            loop.append(v)
        rings.append(loop)
    top = bm.verts.new(HEAD_C + Vector((0, 0, HR[2])))
    bot = bm.verts.new(HEAD_C + Vector((0, 0.01, -HR[2] * 0.93)))
    for v in (top, bot):
        v[part_layer] = PI["head"]
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(segs):
            face_part[bm.faces.new([a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]])] = "head"
    for k in range(segs):
        face_part[bm.faces.new([rings[0][(k + 1) % segs], rings[0][k], bot])] = "head"
        face_part[bm.faces.new([rings[-1][k], rings[-1][(k + 1) % segs], top])] = "head"


build_head()

# Ears: small wedges on the sides of the head.
for sx in (-1, 1):
    base = [Vector((sx * 0.2, 0.03, 0.95)), Vector((sx * 0.2, -0.035, 0.935)), Vector((sx * 0.195, 0.0, 0.875))]
    tip = Vector((sx * 0.245, 0.005, 0.915))
    vs = [bm.verts.new(p) for p in base] + [bm.verts.new(tip)]
    for v in vs:
        v[part_layer] = PI["ear"]
    tris = [(0, 1, 3), (1, 2, 3), (2, 0, 3), (0, 2, 1)]
    for t in tris:
        t = t if sx > 0 else (t[0], t[2], t[1])
        face_part[bm.faces.new([vs[i] for i in t])] = "ear"

# Torso: bell shape, 10 sides, vertex at the front.
loft("torso", "Z", [
    (Vector((0, 0, 0.355)), 0.11, 0.085),
    (Vector((0, 0, 0.42)), 0.15, 0.118),
    (Vector((0, -0.005, 0.52)), 0.148, 0.12),
    (Vector((0, 0, 0.62)), 0.13, 0.102),
    (Vector((0, 0, 0.70)), 0.108, 0.085),
], 10, start=Vector((0, 0, 0.33)), end=Vector((0, 0, 0.77)), ang0=-math.pi / 2)

ARM_Z = 0.675
for sx, side in ((1, "L"), (-1, "R")):
    # Arms along X in T-pose. Character left = +X (facing -Y).
    loft(f"arm_{side}", "X", [
        (Vector((sx * 0.09, 0, ARM_Z)), 0.05, 0.05),
        (Vector((sx * 0.135, 0, ARM_Z)), 0.05, 0.047),
        (Vector((sx * 0.245, 0, ARM_Z - 0.002)), 0.042, 0.04),
        (Vector((sx * 0.35, 0, ARM_Z - 0.004)), 0.036, 0.034),
    ], 8, flip=sx < 0)
    # Mitten hands with a thumb nub pointing forward (-Y).
    loft(f"hand_{side}", "X", [
        (Vector((sx * 0.34, 0, ARM_Z - 0.004)), 0.034, 0.032),
        (Vector((sx * 0.38, 0, ARM_Z - 0.006)), 0.05, 0.044),
        (Vector((sx * 0.43, 0, ARM_Z - 0.008)), 0.05, 0.042),
    ], 8, end=Vector((sx * 0.47, 0, ARM_Z - 0.01)), flip=sx < 0)
    tb = [Vector((sx * 0.37, -0.035, ARM_Z + 0.012)), Vector((sx * 0.40, -0.038, ARM_Z + 0.012)),
          Vector((sx * 0.385, -0.036, ARM_Z - 0.02))]
    tt = Vector((sx * 0.40, -0.075, ARM_Z - 0.005))
    vs = [bm.verts.new(p) for p in tb] + [bm.verts.new(tt)]
    for v in vs:
        v[part_layer] = PI[f"hand_{side}"]
    for t in [(0, 1, 3), (1, 2, 3), (2, 0, 3)]:
        t = t if sx < 0 else (t[0], t[2], t[1])
        face_part[bm.faces.new([vs[i] for i in t])] = f"hand_{side}"

    # Legs: short and chunky, 6 sides, open ends (top hidden in torso, bottom in shoe).
    lx = sx * 0.072
    loft(f"leg_{side}", "Z", [
        (Vector((lx, 0, 0.07)), 0.05, 0.05),
        (Vector((lx, 0, 0.14)), 0.053, 0.053),
        (Vector((lx, 0, 0.225)), 0.057, 0.056),
        (Vector((lx, 0, 0.31)), 0.064, 0.062),
        (Vector((lx, 0, 0.42)), 0.064, 0.064),
    ], 6, ang0=math.pi / 6)
    # Shoes: rounded boats along -Y with a flat sole on z=0.
    def sh(y, ra, rb):
        return (Vector((lx, y, rb * 0.866)), ra, rb)
    loft(f"shoe_{side}", "Y", [
        sh(0.045, 0.043, 0.036),
        sh(-0.015, 0.06, 0.052),
        sh(-0.075, 0.058, 0.044),
    ], 6, start=Vector((lx, 0.068, 0.034)), end=Vector((lx, -0.122, 0.028)), flip=True)

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

# material zones + face UVs
uv = bm.loops.layers.uv.new("UVMap")
FACE_W = 0.4
FACE_Z0 = HEAD_C.z - 0.2
for face in bm.faces:
    part = face_part[face]
    c = face.calc_center_median()
    n = face.normal
    if part == "head":
        front = n.dot(Vector((0, -1, 0))) > math.cos(math.radians(56))
        face.material_index = MI["M_Face"] if front and HEAD_C.z - 0.195 < c.z < HEAD_C.z + 0.09 else MI["M_Skin"]
    elif part == "torso":
        face.material_index = MI["M_BaseBottom"] if c.z < 0.49 else MI["M_BaseTop"]
    elif part.startswith("arm"):
        face.material_index = MI["M_BaseTop"] if abs(c.x) < 0.19 else MI["M_Skin"]
    elif part.startswith("leg"):
        face.material_index = MI["M_BaseBottom"] if c.z > 0.27 else (MI["M_Skin"] if c.z > 0.125 else MI["M_Socks"])
    elif part.startswith("shoe"):
        face.material_index = MI["M_Shoes"]
    else:
        face.material_index = MI["M_Skin"]
    face.smooth = False
    for loop in face.loops:
        if face.material_index == MI["M_Face"]:
            p = loop.vert.co
            fu = min(max((p.x + FACE_W / 2) / FACE_W, 0.02), 0.98)
            fv = min(max((p.z - FACE_Z0) / FACE_W, 0.02), 0.98)
            loop[uv].uv = (fu / 6, 5 / 6 + fv / 6)       # frame 0 = neutral
        else:
            loop[uv].uv = (0.5, 0.25)                    # unused; lands on plain skin

me = bpy.data.meshes.new("BaseBody")
bm.to_mesh(me)
part_of_vert = [v[part_layer] for v in bm.verts]
bm.free()
for m in mats:
    me.materials.append(m)
body = bpy.data.objects.new("BaseBody", me)
scene.collection.objects.link(body)


# ----------------------------------------------------------------------------- rig
P = "mixamorig:"
BONES = [  # name, head, tail, parent
    ("Hips", (0, 0, 0.40), (0, 0, 0.48), None),
    ("Spine", (0, 0, 0.48), (0, 0, 0.56), "Hips"),
    ("Spine1", (0, 0, 0.56), (0, 0, 0.64), "Spine"),
    ("Spine2", (0, 0, 0.64), (0, 0, 0.72), "Spine1"),
    ("Neck", (0, 0, 0.72), (0, 0, 0.76), "Spine2"),
    ("Head", (0, 0, 0.76), (0, 0, 1.13), "Neck"),
]
for sx, s, S in ((1, "L", "Left"), (-1, "R", "Right")):
    BONES += [
        (f"{S}Shoulder", (sx * 0.02, 0, ARM_Z + 0.01), (sx * 0.11, 0, ARM_Z), "Spine2"),
        (f"{S}Arm", (sx * 0.11, 0, ARM_Z), (sx * 0.245, 0, ARM_Z - 0.002), f"{S}Shoulder"),
        (f"{S}ForeArm", (sx * 0.245, 0, ARM_Z - 0.002), (sx * 0.36, 0, ARM_Z - 0.004), f"{S}Arm"),
        (f"{S}Hand", (sx * 0.36, 0, ARM_Z - 0.004), (sx * 0.46, 0, ARM_Z - 0.008), f"{S}ForeArm"),
        (f"{S}UpLeg", (sx * 0.072, 0, 0.40), (sx * 0.072, 0, 0.225), "Hips"),
        (f"{S}Leg", (sx * 0.072, 0, 0.225), (sx * 0.072, 0, 0.065), f"{S}UpLeg"),
        (f"{S}Foot", (sx * 0.072, 0, 0.065), (sx * 0.072, -0.07, 0.025), f"{S}Leg"),
        (f"{S}ToeBase", (sx * 0.072, -0.07, 0.025), (sx * 0.072, -0.12, 0.025), f"{S}Foot"),
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
        eb.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")


# ----------------------------------------------------------------------------- skin weights
def chain_weights(t, joints, bones, r):
    """joints: ascending coordinates where bone i spans [joints[i], joints[i+1]]."""
    n = len(bones)
    i = 0
    while i < n - 1 and t >= joints[i + 1]:
        i += 1
    w = {bones[i]: 1.0}
    if i < n - 1:                                     # blend into next bone near its joint
        d = joints[i + 1] - t
        if d < r:
            k = 0.5 * (1 - d / r)
            w = {bones[i]: 1 - k, bones[i + 1]: k}
    if i > 0:                                         # blend back into previous bone
        d = t - joints[i]
        if d < r:
            k = 0.5 * (1 - d / r)
            w = {bones[i]: w.get(bones[i], 1.0) - k, bones[i - 1]: k, **{b: x for b, x in w.items() if b != bones[i]}}
    return w


groups = {}


def vg(name):
    if name not in groups:
        groups[name] = body.vertex_groups.new(name=P + name)
    return groups[name]


for vi, v in enumerate(me.vertices):
    part = PARTS[part_of_vert[vi]]
    co = v.co
    if part in ("head", "ear"):
        w = {"Head": 1.0}
    elif part == "torso":
        w = chain_weights(co.z, [0.0, 0.48, 0.56, 0.64, 0.74], ["Hips", "Spine", "Spine1", "Spine2", "Neck"], 0.035)
        if co.z > 0.745:
            w = {"Neck": 0.5, "Spine2": 0.5}
    elif part.startswith(("arm", "hand")):
        S = "Left" if part.endswith("L") else "Right"
        x = abs(co.x)
        if part.startswith("hand"):
            w = {f"{S}Hand": 1.0}
        else:
            w = chain_weights(x, [0.0, 0.11, 0.245, 0.36],
                              ["Spine2", f"{S}Arm", f"{S}ForeArm", f"{S}Hand"], 0.035)
            if x < 0.11:
                w = {f"{S}Shoulder": 0.6, "Spine2": 0.4}
    elif part.startswith("leg"):
        S = "Left" if part.endswith("L") else "Right"
        w = chain_weights(-co.z, [-1.0, -0.40, -0.225, -0.075],
                          ["Hips", f"{S}UpLeg", f"{S}Leg", f"{S}Foot"], 0.035)
        if co.z > 0.39:
            w = {f"{S}UpLeg": 1.0}
    elif part.startswith("shoe"):
        S = "Left" if part.endswith("L") else "Right"
        w = {f"{S}Foot": 1.0} if co.y > -0.06 else ({f"{S}ToeBase": 1.0} if co.y < -0.09 else {f"{S}Foot": 0.5, f"{S}ToeBase": 0.5})
    for b, x in w.items():
        if x > 1e-4:
            vg(b).add([vi], x, "REPLACE")

body.parent = rig
mod = body.modifiers.new("Armature", "ARMATURE")
mod.object = rig


# ----------------------------------------------------------------------------- sockets
def socket(name, bone, loc):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    e.empty_display_size = 0.06
    scene.collection.objects.link(e)
    e.parent = rig
    e.parent_type = "BONE"
    e.parent_bone = P + bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(Vector(loc))
    return e


sockets = [
    socket("Socket_R_Hand", "RightHand", (-0.41, -0.01, ARM_Z - 0.01)),
    socket("Socket_L_Hand", "LeftHand", (0.41, -0.01, ARM_Z - 0.01)),
    socket("Socket_Back", "Spine2", (0.0, 0.13, 0.60)),
]


# ----------------------------------------------------------------------------- animation
def rx(d): return Quaternion((1, 0, 0), math.radians(d))
def ry(d): return Quaternion((0, 1, 0), math.radians(d))
def rz(d): return Quaternion((0, 0, 1), math.radians(d))


ALL = [b[0] for b in BONES]
REST = {n: rig.data.bones[P + n].matrix_local.to_3x3().to_quaternion() for n in ALL}


def apply_pose(pose):
    """pose: {bone: (rotation in armature axes at rest, location offset in armature axes)}"""
    for n in ALL:
        pb = rig.pose.bones[P + n]
        pb.rotation_mode = "QUATERNION"
        R, L = pose.get(n, (Quaternion(), Vector()))
        B = REST[n]
        pb.rotation_quaternion = B.inverted() @ R @ B
        pb.location = B.inverted() @ Vector(L)


def arms(down, fwd_l, fwd_r, bend_l, bend_r, out=0.0):
    return {
        "LeftArm": (rx(-fwd_l) @ ry(down + out), (0, 0, 0)),
        "RightArm": (rx(-fwd_r) @ ry(-(down + out)), (0, 0, 0)),
        "LeftForeArm": (rz(-bend_l), (0, 0, 0)),
        "RightForeArm": (rz(bend_r), (0, 0, 0)),
    }


def idle_pose(p):
    br = math.sin(TAU * p)
    roll = 1.6 * math.sin(TAU * p)
    hips = ry(roll)
    pose = {
        "Hips": (hips, (0, 0, 0.004 * br - 0.002)),
        "Spine": (rx(1.0 * br), (0, 0, 0)),
        "Spine1": (rx(0.8 * br) @ ry(-roll * 0.5), (0, 0, 0)),
        "Spine2": (rx(-0.4 * br), (0, 0, 0)),
        "Head": (ry(-2.5 * math.sin(TAU * p + 0.6)) @ rx(1.5 * math.sin(2 * TAU * p)), (0, 0, 0)),
        "LeftUpLeg": (hips.inverted(), (0, 0, 0)),
        "RightUpLeg": (hips.inverted(), (0, 0, 0)),
    }
    pose.update(arms(70, 2, 2, 12 + 2 * br, 12 + 2 * br, out=2.0 * br))
    return pose


def walk_pose(p):
    s, c = math.sin(TAU * p), math.cos(TAU * p)
    thigh = 26 * s                                       # left leg forward angle
    bend_l = 6 + 40 * max(0.0, c) ** 1.5                 # knee lifts while the leg swings forward
    bend_r = 6 + 40 * max(0.0, -c) ** 1.5
    bob = 0.03 * abs(c) - 0.012                          # high at passing, sharp dip at contact
    roll = -5.5 * c                                      # waddle: lean over the stance foot
    yaw = -6 * s
    hips = rz(yaw) @ ry(roll)
    pose = {
        "Hips": (hips, (-0.012 * c, 0, bob)),
        "Spine": (rx(4) @ ry(-roll * 0.35) @ rz(-yaw * 0.6), (0, 0, 0)),
        "Spine1": (rx(1), (0, 0, 0)),
        "Spine2": (ry(-roll * 0.25), (0, 0, 0)),
        "Head": (rx(-3 + 3.5 * math.cos(2 * TAU * p)) @ ry(-roll * 0.3), (0, 0, 0)),
        "LeftUpLeg": (hips.inverted() @ rx(-thigh), (0, 0, 0)),
        "RightUpLeg": (hips.inverted() @ rx(thigh), (0, 0, 0)),
        "LeftLeg": (rx(bend_l), (0, 0, 0)),
        "RightLeg": (rx(bend_r), (0, 0, 0)),
        "LeftFoot": (rx(0.8 * (thigh - bend_l)), (0, 0, 0)),
        "RightFoot": (rx(0.8 * (-thigh - bend_r)), (0, 0, 0)),
    }
    fl, fr = -28 * s, 28 * s
    pose.update(arms(68 - 4 * abs(c), fl, fr, 14 + 12 * max(0.0, fl) / 28, 14 + 12 * max(0.0, fr) / 28))
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
walk = bake_clip("Walk", 1 * FPS, walk_pose)
# leave Idle active; reset to rest for the saved file
rig.animation_data.action = idle
scene.frame_start, scene.frame_end = 0, 2 * FPS
scene.frame_set(0)

# ----------------------------------------------------------------------------- save + export
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "base_body.blend"))
if os.path.exists(os.path.join(OUT, "base_body.blend1")):
    os.remove(os.path.join(OUT, "base_body.blend1"))

bpy.ops.object.select_all(action="DESELECT")
for o in [body, rig, *sockets]:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "base_body.glb"),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_normals=True,
    export_texcoords=True,
    export_skins=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_force_sampling=True,
    export_def_bones=False,
    export_leaf_bone=False,
    export_optimize_animation_size=True,
    export_image_format="AUTO",
)
tris = sum(len(p.vertices) - 2 for p in me.polygons)
print(f"BUILD_OK tris={tris} bones={len(rig.data.bones)} actions={[a.name for a in bpy.data.actions]}")
