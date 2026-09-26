"""Shared base-body surface + skin weights for outfit/accessory generators (same maths as build_v6.py).

v6 is locked, so build_v6.py keeps its own copy; this module mirrors its torso/limb rings, bones and weights so
every clothing shell is built on, and deforms like, the skin under it. Measurements: ref18_measurements.json.
"""
import math
from mathutils import Vector
from head_shape import M, CHIN

SH_Z = M["shoulder_line_from_sole"]
CROTCH = M["crotch_height_from_sole_est"]
HEM = M["hem_height_from_sole"]
SH_HALF = M["body_shoulder_width_est"] / 2
ARM_Z = SH_Z - 0.012
WAIST = CROTCH + 0.07
CL = 0.007                                   # clothing clearance over the skin (as v6)
ARM_LEN, HAND_L = 0.165, M["hand_length"]
ARM_X0 = SH_HALF * 0.72
LEG_X = 0.058
SKIRT_FRONT = [(0.068, 0.4, 0.05, 0.55), (0.14, 0.25, 0.4, 0.35), (0.19, 0.28, 0.5, 0.22), (0.27, 0.4, 0.6, 0.0),
               (0.3, 0.6, 0.4, 0.0), (WAIST, 1.0, 0.0, 0.0)]   # skirt front weights by height: (z, hips, thighs, shins)

TORSO = [
    (Vector((0, 0.0, CROTCH - 0.012)), 0.07, 0.06),
    (Vector((0, 0.0, CROTCH + 0.025)), 0.128, 0.098),
    (Vector((0, -0.006, CROTCH + 0.085)), 0.138, 0.112),
    (Vector((0, -0.002, SH_Z - 0.08)), 0.132, 0.1),
    (Vector((0, 0.004, SH_Z - 0.01)), SH_HALF * 0.92, 0.088),
    (Vector((0, 0.006, SH_Z + 0.035)), SH_HALF * 0.6, 0.066),
]
ARM = [(ARM_X0 * 0.7, 0.047, 0.0), (ARM_X0 + 0.03, 0.046, 0.0), (ARM_X0 + ARM_LEN * 0.55, 0.04, 0.002),
       (ARM_X0 + ARM_LEN, 0.034, 0.004)]                   # (|x|, radius, z drop)
LEG = [(0.035, 0.036), (0.09, 0.038), (0.17, 0.042), (CROTCH + 0.02, 0.05)]   # (z, radius)

BONES = [("Hips", (0, 0, CROTCH + 0.01), (0, 0, CROTCH + 0.06), None),
         ("Spine", (0, 0, CROTCH + 0.06), (0, 0, CROTCH + 0.11), "Hips"),
         ("Spine1", (0, 0, CROTCH + 0.11), (0, 0, CROTCH + 0.16), "Spine"),
         ("Spine2", (0, 0, CROTCH + 0.16), (0, 0, SH_Z), "Spine1"),
         ("Neck", (0, 0, SH_Z), (0, 0, CHIN + 0.03), "Spine2"),
         ("Head", (0, 0, CHIN + 0.03), (0, 0, 1.0), "Neck")]
for _sx, _S in ((1, "Left"), (-1, "Right")):
    _x0 = _sx * ARM_X0
    BONES += [
        (f"{_S}Shoulder", (_sx * 0.02, 0, ARM_Z + 0.008), (_x0, 0, ARM_Z), "Spine2"),
        (f"{_S}Arm", (_x0, 0, ARM_Z), (_x0 + _sx * ARM_LEN * 0.55, 0, ARM_Z - 0.002), f"{_S}Shoulder"),
        (f"{_S}ForeArm", (_x0 + _sx * ARM_LEN * 0.55, 0, ARM_Z - 0.002), (_x0 + _sx * ARM_LEN, 0, ARM_Z - 0.004), f"{_S}Arm"),
        (f"{_S}Hand", (_x0 + _sx * ARM_LEN, 0, ARM_Z - 0.004), (_x0 + _sx * (ARM_LEN + HAND_L), 0, ARM_Z - 0.007), f"{_S}ForeArm"),
        (f"{_S}UpLeg", (_sx * LEG_X, 0, CROTCH + 0.01), (_sx * LEG_X, 0, 0.14), "Hips"),
        (f"{_S}Leg", (_sx * LEG_X, 0, 0.14), (_sx * LEG_X, 0, 0.035), f"{_S}UpLeg"),
        (f"{_S}Foot", (_sx * LEG_X, 0, 0.035), (_sx * LEG_X, -0.04, 0.018), f"{_S}Leg"),
        (f"{_S}ToeBase", (_sx * LEG_X, -0.04, 0.018), (_sx * LEG_X, -0.075, 0.018), f"{_S}Foot"),
    ]


def _interp(table, x):
    """Piecewise-linear lookup in [(x, *vals)], clamped at the ends."""
    if x <= table[0][0]:
        return table[0][1:]
    for a, b in zip(table[:-1], table[1:]):
        if x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0])
            return tuple(p + (q - p) * t for p, q in zip(a[1:], b[1:]))
    return table[-1][1:]


def torso_at(z, off):
    """Torso ring (centre, rx, ry) at height z, grown by off (clothing shells)."""
    for (c0, a0, b0), (c1, a1, b1) in zip(TORSO[:-1], TORSO[1:]):
        if c0.z <= z <= c1.z:
            t = (z - c0.z) / (c1.z - c0.z)
            return (c0.lerp(c1, t), a0 + (a1 - a0) * t + off, b0 + (b1 - b0) * t + off)
    c, a, b = TORSO[-1] if z > TORSO[-1][0].z else TORSO[0]
    return (Vector((c.x, c.y, z)), a + off, b + off)


def torso_pt(lon, z, off):
    """Point on the torso shell; lon 0 = front (-Y), + toward the character's left (+X)."""
    c, a, b = torso_at(z, off)
    r = math.radians(lon)
    return c + Vector((math.sin(r) * a, -math.cos(r) * b, 0))


def arm_pt(sx, x, lon, off):
    """Point on the arm tube at |x| along the T-pose arm; lon 0 = top (+Z), 90 = front (-Y)."""
    r, dz = _interp(ARM, x)
    a = math.radians(lon)
    return Vector((sx * x, -math.sin(a) * (r + off), ARM_Z - dz + math.cos(a) * (r + off)))


def leg_pt(sx, z, lon, off):
    """Point on the leg tube at height z; lon 0 = front (-Y)."""
    (r,) = _interp(LEG, z)
    a = math.radians(lon)
    return Vector((sx * LEG_X + math.sin(a) * (r + off), -math.cos(a) * (r + off), z))


# ---------------------------------------------------------------- skin weights (port of build_v6 _weights)
def _chain(t, joints, bones, r):
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


def _ss(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def weights(region, co):
    """Bone -> weight for a vertex at co. region: a body part name as in build_v6 (torso, neck, head, arm_L,
    hand_R, leg_L, foot_R), 'skirt' (hips blended into both thighs toward the hem), 'hood' (head, easing into
    the neck), or a dict of fixed weights."""
    if isinstance(region, dict):
        return region
    if region == "head":
        return {"Head": 1.0}
    if region == "hood":
        k = _ss(CHIN + 0.05, CHIN - 0.02, co.z)
        return {"Head": 1 - k, "Neck": k * 0.6, "Spine2": k * 0.4} if k > 0 else {"Head": 1.0}
    if region == "neck":
        return {"Neck": 0.6, "Head": 0.4} if co.z > CHIN + 0.02 else {"Neck": 0.7, "Spine2": 0.3}
    if region == "torso":
        j = [b[1][2] for b in BONES[:5]]
        return _chain(co.z, [0.0] + j[1:5], ["Hips", "Spine", "Spine1", "Spine2", "Neck"], 0.03)
    if region == "skirt":
        # sides and back: hips blended into the thighs toward the hem; the front follows SKIRT_FRONT, so a seated
        # skirt lies on the lap and hangs over the knees instead of letting them through
        k = 0.55 * _ss(WAIST, CROTCH - 0.07, co.z)
        f = _ss(-0.02, -0.11, co.y)
        fh, fu, fl = _interp(SKIRT_FRONT, co.z)
        hip, up, leg = (1 - k) * (1 - f) + fh * f, k * (1 - f) + fu * f, fl * f
        sl = max(0.0, min(1.0, 0.5 + co.x / 0.12))
        w = {b: x * hip for b, x in weights("torso", Vector((co.x, co.y, max(co.z, CROTCH)))).items()}
        w["LeftUpLeg"], w["RightUpLeg"] = up * sl, up * (1 - sl)
        if leg > 0:
            w["LeftLeg"], w["RightLeg"] = leg * sl, leg * (1 - sl)
        return w
    S = "Left" if region.endswith("L") else "Right"
    if region.startswith("hand"):
        return {f"{S}Hand": 1.0}
    if region.startswith("arm"):
        x = abs(co.x)
        if x < ARM_X0 * 0.85:
            return {f"{S}Shoulder": 0.6, "Spine2": 0.4}
        return _chain(x, [0.0, ARM_X0, ARM_X0 + ARM_LEN * 0.55, ARM_X0 + ARM_LEN],
                      [f"{S}Shoulder", f"{S}Arm", f"{S}ForeArm", f"{S}Hand"], 0.025)
    if region.startswith("leg"):
        if co.z > CROTCH:
            return {f"{S}UpLeg": 0.75, "Hips": 0.25}
        return _chain(-co.z, [-9, -CROTCH, -0.14, -0.04], ["Hips", f"{S}UpLeg", f"{S}Leg", f"{S}Foot"], 0.03)
    return {f"{S}Foot": 1.0} if co.y > -0.035 else {f"{S}ToeBase": 0.6, f"{S}Foot": 0.4}
