"""Full clip set on the locked v6 body -> base/v6_clips.glb (+ the "clips" section of ../character_catalog.json).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_clips.py

Idle and Walk are v6's own actions, unchanged. Every other clip is hand-keyed here as key poses in armature space
(rotations relative to the parent, the same convention as build_v6.apply_pose), with eased, overshooting
interpolation for the bouncy toy feel (row 139). Standing clips re-plant both feet with two-bone IK every frame, so
bobbing hips never slide or sink the feet; Run is grounded by a constant offset, rolls and falls per frame.
Loops end where they start; one-shots start and end on Idle frame 0 (except Fish, which ends on FishHold's first
frame, and Defeat, which ends lying down). A check pass reports hands entering the head and the lowest point.
"""
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402

FPS, TAU = 30, math.tau
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
with bpy.data.libraries.load(os.path.join(HERE, "v6.blend"), link=False) as (src, dst):
    dst.objects = list(src.objects)
    dst.actions = list(src.actions)
for o in dst.objects:
    sc.collection.objects.link(o)
rig = bpy.data.objects["CharacterRig"]
P_ = "mixamorig:"
BONES = {b.name[len(P_):]: b for b in rig.data.bones}
NAMES = list(BONES)
PARENT = {n: (b.parent.name[len(P_):] if b.parent else None) for n, b in BONES.items()}
REST = {n: b.matrix_local.to_quaternion() for n, b in BONES.items()}
HEAD0 = {n: b.head_local.copy() for n, b in BONES.items()}
TAIL0 = {n: b.tail_local.copy() for n, b in BONES.items()}
SIDES = (("Left", 1), ("Right", -1))


def rx(d): return Quaternion((1, 0, 0), math.radians(d))
def ry(d): return Quaternion((0, 1, 0), math.radians(d))
def rz(d): return Quaternion((0, 0, 1), math.radians(d))
def V(*a): return Vector(a)
def ss(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)


class Pose:
    """R[bone] = rotation in armature axes applied in the parent's posed frame; loc = Hips offset (armature)."""

    def __init__(self, R=None, loc=None):
        self.R, self.loc = dict(R or {}), Vector(loc or (0, 0, 0))

    def copy(self): return Pose(self.R, self.loc)
    def q(self, b): return self.R.get(b, Quaternion())
    def acc(self, b): return Quaternion() if b is None else self.acc(PARENT[b]) @ self.q(b)

    def head(self, b):
        p = PARENT[b]
        return HEAD0[b] + self.loc if p is None else self.head(p) + self.acc(p) @ (HEAD0[b] - HEAD0[p])

    def rot(self, b, Q):
        self.R[b] = Q @ self.q(b)
        return self

    def aim(self, b, d, twist=0.0):
        """Point bone b along world direction d."""
        local = self.acc(PARENT[b]).inverted() @ Vector(d).normalized()
        R = (TAIL0[b] - HEAD0[b]).normalized().rotation_difference(local)
        self.R[b] = (Quaternion(local, math.radians(twist)) @ R) if twist else R
        return self

    def world(self, b, Qw):
        self.R[b] = self.acc(PARENT[b]).inverted() @ Qw
        return self

    def ik(self, upper, lower, target, pole):
        """Two-bone IK: lower's tail reaches target (clamped to reach), bending toward pole."""
        a = self.head(upper)
        l1, l2 = (HEAD0[lower] - HEAD0[upper]).length, (TAIL0[lower] - HEAD0[lower]).length
        d = Vector(target) - a
        L = max(abs(l1 - l2) + 1e-4, min(d.length, (l1 + l2) * 0.9995))
        n = d.normalized()
        A = math.acos(max(-1.0, min(1.0, (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L))))
        perp = Vector(pole) - n * Vector(pole).dot(n)
        perp = perp.normalized() if perp.length > 1e-6 else n.orthogonal().normalized()
        knee = a + n * math.cos(A) * l1 + perp * math.sin(A) * l1
        self.aim(upper, knee - a)
        self.aim(lower, a + n * L - knee)
        return self


def qmix(qa, qb, u):
    d = qb @ qa.inverted()
    if d.w < 0:
        d.negate()
    ax, ang = d.to_axis_angle()
    return Quaternion(ax, ang * u) @ qa


def mix(a, b, u):
    return Pose({n: qmix(a.q(n), b.q(n), u) for n in NAMES}, a.loc.lerp(b.loc, u))


EASE = {"lin": lambda u: u, "io": lambda u: u * u * (3 - 2 * u), "in": lambda u: u * u, "out": lambda u: 1 - (1 - u) ** 2,
        "back": lambda u: 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2}


def keys(p, ks):
    """ks = [(t, pose, ease into this key)]."""
    for (t0, a, _), (t1, b, e) in zip(ks[:-1], ks[1:]):
        if p <= t1:
            return mix(a, b, EASE[e]((p - t0) / (t1 - t0)))
    return ks[-1][1].copy()


# ================================================================ neutral = Idle frame 0 (one-shots blend to Idle seamlessly)
rig.animation_data.action = bpy.data.actions["Idle"]
sc.frame_set(0)
N = Pose({n: REST[n] @ rig.pose.bones[P_ + n].rotation_quaternion @ REST[n].inverted() for n in NAMES},
         REST["Hips"] @ rig.pose.bones[P_ + "Hips"].location)
ANKLE = {s: HEAD0[f"{s}Foot"].copy() for s, _ in SIDES}


def body(lean=0.0, side=0.0, twist=0.0, crouch=0.0, shift=(0.0, 0.0), nod=0.0, tilt=0.0, turn=0.0, hips=None, base=None):
    """A pose from neutral: spine lean/side/twist spread over three bones, hips drop, head nod/tilt/turn."""
    P = (base or N).copy()
    if hips is not None:
        P.rot("Hips", hips)
    P.loc += V(shift[0], shift[1], -crouch)
    for b, k in (("Spine", 0.4), ("Spine1", 0.35), ("Spine2", 0.25)):
        P.rot(b, rz(twist * k) @ ry(side * k) @ rx(lean * k))
    P.rot("Neck", rz(turn * 0.3) @ ry(tilt * 0.3) @ rx(nod * 0.3))
    P.rot("Head", rz(turn * 0.7) @ ry(tilt * 0.7) @ rx(nod * 0.7))
    return P


def hand(P, s, target, pole=None):
    sx = dict(SIDES)[s]
    return P.ik(f"{s}Arm", f"{s}ForeArm", Vector(target), pole or V(sx * 0.6, 0.5, -1))


def arm(P, s, upper, fore=None):
    P.aim(f"{s}Arm", upper)
    P.aim(f"{s}ForeArm", fore or upper)
    return P


def mirror(d):
    return V(-d[0], d[1], d[2])


def plant(P, lift=0.0, ankles=None, knees_out=0.25):
    """Both feet flat on the ground at their rest (or given) ankle points; lift raises them (jumps)."""
    for s, sx in SIDES:
        t = (ankles or ANKLE)[s] + V(0, 0, lift)
        P.ik(f"{s}UpLeg", f"{s}Leg", t, V(sx * knees_out, -1, 0))
        P.world(f"{s}Foot", Quaternion())
        P.R[f"{s}ToeBase"] = Quaternion()
    return P


# ================================================================ clips
CLIPS = []


def clip(name, seconds, loop, ground=None, **meta):
    def deco(fn):
        CLIPS.append(dict(name=name, frames=round(seconds * FPS), loop=loop, fn=fn, ground=ground, meta=meta))
        return fn
    return deco


@clip("Run", 0.6, True, ground="const")
def run(p):
    """Fast scamper: forward lean, high knees, pumping bent arms, big bounce."""
    s, c = math.sin(TAU * p), math.cos(TAU * p)
    th = 36 * s
    bl, br = 16 + 78 * max(0.0, c) ** 1.2, 16 + 78 * max(0.0, -c) ** 1.2
    roll, yaw = -7 * c, -9 * s
    hips = rz(yaw) @ ry(roll)
    P = N.copy()
    P.R["Hips"], P.loc = hips, V(-0.012 * c, 0, 0.03 * abs(s) ** 0.7)
    P.R["Spine"] = rx(10) @ ry(-roll * 0.3) @ rz(-yaw * 0.6)
    P.R["Spine1"], P.R["Spine2"] = rx(4), rx(2) @ ry(-roll * 0.2)
    P.R["Neck"], P.R["Head"] = Quaternion(), rx(-9 + 3 * math.cos(2 * TAU * p)) @ ry(roll * 0.4) @ rz(-yaw * 0.4)
    P.R["LeftUpLeg"], P.R["RightUpLeg"] = hips.inverted() @ rx(-th), hips.inverted() @ rx(th)
    P.R["LeftLeg"], P.R["RightLeg"] = rx(bl), rx(br)
    P.R["LeftFoot"], P.R["RightFoot"] = rx(0.6 * (th - bl)), rx(0.6 * (-th - br))
    fl, fr = -42 * s, 42 * s
    P.R["LeftArm"], P.R["RightArm"] = rx(-fl) @ ry(72), rx(-fr) @ ry(-72)
    P.R["LeftForeArm"], P.R["RightForeArm"] = rz(-78), rz(78)
    return P


SEAT = 0.12                                   # bench seat height (m) for Sit / Study; feet dangle


def seated(lean=0.0, nod=0.0, swing=0.0):
    P = body(lean=lean - 3, nod=nod, crouch=0.279 - (SEAT + 0.05))
    for s, sx in SIDES:
        a = 8 + swing * sx
        P.aim(f"{s}UpLeg", V(sx * 0.12, -1, 0.02)).aim(f"{s}Leg", V(0, -math.sin(math.radians(a)), -math.cos(math.radians(a))))
        P.R[f"{s}Foot"] = rx(-12)
    return P


@clip("Sit", 2.0, True, seatHeight=SEAT)
def sit(p):
    s = math.sin(TAU * p)
    P = seated(lean=1.2 * s, nod=2 * math.sin(TAU * p + 1), swing=14 * s)
    P.rot("Head", ry(3 * math.sin(TAU * p + 0.5)))
    for sd, sx in SIDES:
        hand(P, sd, V(sx * 0.085, -0.078, SEAT + 0.13))
    return P


@clip("Study", 2.0, True, seatHeight=SEAT, deskHeight=0.28)
def study(p):
    nodk = math.exp(-((p - 0.55) / 0.08) ** 2)
    P = seated(lean=12 + 1.0 * math.sin(TAU * p), nod=16 + 6 * nodk, swing=4 * math.sin(TAU * p))
    hand(P, "Left", V(0.075, -0.15, 0.305))
    w = TAU * 4 * p
    hand(P, "Right", V(-0.05 + 0.02 * math.sin(w), -0.155 + 0.006 * math.cos(w), 0.305 + 0.008 * abs(math.sin(w))))
    return P


@clip("Stretch", 2.0, True, seatHeight=SEAT)
def stretch(p):
    """Study break at the seat (row 166): arms up and back past the head, leaning back, swaying side to side."""
    s, c = math.sin(TAU * p), math.cos(TAU * p)
    P = seated(lean=-5 + 2 * math.cos(2 * TAU * p), nod=-12 + 3 * math.cos(2 * TAU * p), swing=6 * s)
    P.rot("Spine1", ry(6 * s)).rot("Head", ry(-5 * s))
    for sd, sx in SIDES:
        reach = 0.06 * sx * s                                     # the arm on the leaning side reaches a little higher
        arm(P, sd, V(sx * (0.8 - reach), 0.36, 0.5 + reach), V(sx * (0.55 - reach), 0.5, 0.68 + reach))
    return P


@clip("Sleep", 3.0, True, ground="frame")
def sleep(p):
    b = math.sin(TAU * p)
    P = N.copy()
    P.R["Hips"] = rx(-88)
    P.R["Spine"], P.R["Spine1"] = rx(-2 * b), rx(-1 * b)
    P.R["Neck"], P.R["Head"] = rx(16), rz(22) @ rx(20 + 1.5 * b)
    for s, sx in SIDES:
        P.R[f"{s}UpLeg"], P.R[f"{s}Leg"] = rx(-4) @ rz(sx * 5), rx(6)
        tummy = P.head("Spine1") + P.acc("Spine1") @ V(sx * 0.06, -0.16, -0.01)
        hand(P, s, tummy, V(sx, 0, -1))
    return P


HOLD = body(lean=5, nod=6, crouch=0.012)
hand(HOLD, "Right", V(-0.025, -0.158, 0.395))
hand(HOLD, "Left", V(0.025, -0.152, 0.36))


def fish_keys():
    ready = body(crouch=0.01, nod=4)
    hand(ready, "Right", V(-0.02, -0.14, 0.35)); hand(ready, "Left", V(0.02, -0.135, 0.32))
    wind = body(twist=-28, lean=-6, crouch=0.005, nod=-8, turn=-10)
    hand(wind, "Right", V(-0.2, 0.03, 0.47)); hand(wind, "Left", V(-0.13, -0.05, 0.45))
    cast = body(twist=18, lean=12, crouch=0.016)
    hand(cast, "Right", V(0.0, -0.21, 0.47)); hand(cast, "Left", V(0.03, -0.2, 0.45))
    follow = body(lean=8, crouch=0.014, nod=4)
    hand(follow, "Right", V(0.0, -0.19, 0.4)); hand(follow, "Left", V(0.03, -0.185, 0.38))
    return [(0, N, "lin"), (0.18, ready, "io"), (0.42, wind, "io"), (0.58, cast, "out"), (0.72, follow, "back"), (1.0, HOLD, "io")]


FISH = fish_keys()


@clip("Fish", 1.4, False, endsOn="FishHold")
def fish(p):
    return plant(keys(p, FISH))


@clip("FishHold", 2.0, True)
def fish_hold(p):
    P = body(lean=5 + 1.2 * math.sin(TAU * p), nod=6, tilt=3 * math.sin(TAU * p), crouch=0.012)
    bob = 0.005 * math.sin(2 * TAU * p) * math.sin(TAU * p)
    hand(P, "Right", V(-0.025, -0.158, 0.395 + bob))
    hand(P, "Left", V(0.025, -0.152, 0.36 + bob))
    return plant(P)


def forage_keys():
    crouch = body(crouch=0.13, lean=32, nod=12)
    hand(crouch, "Right", V(-0.05, -0.21, 0.1)); hand(crouch, "Left", V(0.075, -0.13, 0.2))
    pick = body(crouch=0.125, lean=30, nod=8)
    hand(pick, "Right", V(-0.045, -0.2, 0.15)); hand(pick, "Left", V(0.075, -0.13, 0.2))
    pick.rot("RightHand", rx(-35))
    show = body(crouch=-0.012, nod=-6, tilt=8)
    hand(show, "Right", V(-0.035, -0.15, 0.43))
    return [(0, N, "lin"), (0.3, crouch, "io"), (0.45, pick, "back"), (0.72, show, "back"), (1.0, N, "io")]


FORAGE = forage_keys()


@clip("Forage", 1.3, False)
def forage(p):
    return plant(keys(p, FORAGE))


def two_hands(P, r, l):
    hand(P, "Right", V(*r))
    hand(P, "Left", V(*l))
    return P


DIG = [(0, N, "lin"),
       (0.2, two_hands(body(twist=-15, lean=-4, crouch=0.005), (-0.12, -0.07, 0.5), (-0.05, -0.12, 0.44)), "io"),
       (0.42, two_hands(body(twist=-5, lean=18, crouch=0.04, nod=8), (-0.07, -0.19, 0.27), (-0.02, -0.19, 0.22)), "in"),
       (0.62, two_hands(body(lean=-8, crouch=0.01), (-0.1, -0.1, 0.36), (-0.04, -0.15, 0.3)), "back"),
       (0.8, two_hands(body(twist=-30, crouch=0.005, turn=-8), (-0.16, 0.0, 0.44), (-0.1, -0.08, 0.42)), "out"),
       (1.0, N, "io")]


@clip("Dig", 1.3, False)
def dig(p):
    return plant(keys(p, DIG))


NET = [(0, N, "lin"),
       (0.25, two_hands(body(twist=-32, lean=-5, side=-4, shift=(-0.01, 0)), (-0.17, 0.0, 0.5), (-0.1, -0.08, 0.49)), "io"),
       (0.48, two_hands(body(twist=34, lean=14, crouch=0.03, shift=(0.01, 0)), (0.05, -0.2, 0.33), (0.1, -0.15, 0.3)), "out"),
       (0.62, two_hands(body(twist=40, lean=10, crouch=0.02, shift=(0.012, 0)), (0.12, -0.14, 0.34), (0.16, -0.08, 0.33)), "back"),
       (1.0, N, "io")]


@clip("Net", 1.1, False)
def net(p):
    return plant(keys(p, NET))


WAVE_UP = arm(body(tilt=-6, side=-3), "Right", V(-0.95, -0.1, 0.3), V(-0.62, -0.15, 1))


@clip("Wave", 1.6, False)
def wave(p):
    P = keys(p, [(0, N, "lin"), (0.18, WAVE_UP, "back"), (0.82, WAVE_UP, "lin"), (1.0, N, "io")])
    if 0.18 < p < 0.82:
        w = math.sin(TAU * 3 * (p - 0.18) / 0.64)
        P.aim("RightForeArm", V(-0.62 - 0.32 * w, -0.15, 1))
        P.loc.z += 0.006 * abs(w)
    return plant(P)


def cheer_keys():
    squat = body(crouch=0.04, lean=10, nod=6)
    for s, sx in SIDES:
        arm(squat, s, V(sx * 0.35, 0.35, -0.87))
    jump = body(crouch=-0.075, lean=-6, nod=-12)
    for s, sx in SIDES:
        arm(jump, s, V(sx * 0.72, -0.12, 0.68), V(sx * 0.5, -0.2, 0.84))
    hang = body(crouch=-0.06, lean=-4, nod=-10, base=jump)
    land = body(crouch=0.045, lean=8)
    for s, sx in SIDES:
        arm(land, s, V(sx * 0.8, -0.1, 0.55), V(sx * 0.55, -0.2, 0.8))
    settle = body(crouch=-0.006)
    for s, sx in SIDES:
        arm(settle, s, V(sx * 0.6, -0.1, -0.3), V(sx * 0.4, -0.3, -0.5))
    return [(0, N, "lin"), (0.16, squat, "io"), (0.34, jump, "out"), (0.5, hang, "io"), (0.64, land, "in"), (0.82, settle, "back"),
            (1.0, N, "io")]


CHEER = cheer_keys()


@clip("Cheer", 1.3, False)
def cheer(p):
    P = keys(p, CHEER)
    return plant(P, lift=max(0.0, P.loc.z - N.loc.z) * 0.9)


def laugh_keys():
    back = body(lean=-10, nod=-14)
    for s, sx in SIDES:
        hand(back, s, V(sx * 0.095, -0.14, 0.38))
    fwd = body(lean=6, nod=4)
    for s, sx in SIDES:
        hand(fwd, s, V(sx * 0.095, -0.145, 0.37))
    return [(0, N, "lin"), (0.14, back, "back"), (0.8, back, "lin"), (0.9, fwd, "io"), (1.0, N, "io")]


LAUGH = laugh_keys()


@clip("Laugh", 1.6, False)
def laugh(p):
    P = keys(p, LAUGH)
    env = ss(0.1, 0.2, p) * (1 - ss(0.72, 0.84, p))
    P.loc.z += 0.007 * abs(math.sin(TAU * 6 * p)) * env
    P.rot("Spine1", rx(2.5 * math.sin(TAU * 8 * p) * env))
    P.rot("Head", ry(3 * math.sin(TAU * 4 * p) * env))
    return plant(P)


def sad_keys():
    def slump(lean, nod, crouch):
        P = body(lean=lean, nod=nod, crouch=crouch)
        for s, sx in SIDES:
            P.rot(f"{s}Shoulder", ry(sx * 8))
            hand(P, s, V(sx * 0.035, -0.13, 0.27))
        return P
    a, b = slump(16, 20, 0.01), slump(20, 24, 0.022)
    return [(0, N, "lin"), (0.22, a, "io"), (0.5, b, "io"), (0.78, a, "io"), (1.0, N, "io")]


SAD = sad_keys()


@clip("Sad", 2.0, False)
def sad(p):
    P = keys(p, SAD)
    P.rot("Spine", ry(2.5 * math.sin(TAU * p) * math.sin(math.pi * p)))
    return plant(P)


def dance_keys():
    def beat(x, roll, crouch, arms, tilt=0.0, twist=0.0, nod=0.0):
        P = body(hips=ry(roll) @ rz(twist), shift=(x, 0), crouch=crouch, tilt=tilt, nod=nod)
        for s, (up, fore) in arms.items():
            arm(P, s, up, fore)
        return P
    upL = {"Left": (V(0.7, -0.1, 0.7), V(0.3, -0.2, 0.95)), "Right": (V(-0.5, -0.2, -0.85), V(-0.1, -0.9, -0.2))}
    upR = {"Right": (mirror(upL["Left"][0]), mirror(upL["Left"][1])), "Left": (mirror(upL["Right"][0]), mirror(upL["Right"][1]))}
    out = {s: (V(sx * 0.95, -0.1, 0.3), V(sx * 0.6, -0.3, 0.75)) for s, sx in SIDES}
    both = {s: (V(sx * 0.72, -0.12, 0.68), V(sx * 0.5, -0.2, 0.84)) for s, sx in SIDES}
    A = beat(0.012, 5, 0.022, upL, tilt=-8)
    B = beat(-0.012, -5, 0.022, upR, tilt=8)
    return [(0, A, "lin"), (0.125, beat(0.006, 3, -0.004, upL, tilt=-4), "back"), (0.25, B, "io"),
            (0.375, beat(-0.006, -3, -0.004, upR, tilt=4), "back"), (0.5, beat(0, 0, 0.025, out, twist=12, nod=4), "io"),
            (0.625, beat(0, 0, -0.004, out, twist=-12), "back"), (0.75, beat(0, 0, 0.022, both, nod=-8), "io"),
            (0.875, beat(0, 0, -0.004, both, nod=-4), "back"), (1.0, A, "io")]


DANCE = dance_keys()


@clip("Dance", 2.0, True)
def dance(p):
    return plant(keys(p, DANCE))


MELEE = [(0, N, "lin"),
         (0.3, arm(arm(body(twist=-28, lean=-6, crouch=0.015), "Right", V(-0.55, 0.35, 0.76), V(-0.25, 0.55, 0.8)),
                   "Left", V(0.6, -0.6, -0.5)), "io"),
         (0.48, arm(arm(body(twist=26, lean=14, crouch=0.04, shift=(0, -0.02)), "Right", V(0.15, -0.9, -0.4), V(0.45, -0.85, -0.25)),
                    "Left", V(0.5, 0.5, -0.7)), "out"),
         (0.62, arm(arm(body(twist=32, lean=16, crouch=0.035, shift=(0, -0.02)), "Right", V(0.3, -0.7, -0.65), V(0.55, -0.6, -0.55)),
                    "Left", V(0.5, 0.5, -0.7)), "back"),
         (1.0, N, "io")]


@clip("AttackMelee", 0.7, False, hand="R")
def attack_melee(p):
    return plant(keys(p, MELEE))


def bow_keys():
    def aimpose(draw, lean=0.0, recoil=0.0):
        P = body(hips=rz(35), twist=10, turn=-42, lean=lean)
        arm(P, "Left", V(0.1, -1, 0.1 + recoil))
        wrist = P.head("LeftHand")
        hand(P, "Right", wrist.lerp(V(-0.11, 0.05, 0.46), draw) + V(-0.03, 0.02, 0.02) * (1 - draw))
        return P
    rel = aimpose(1.0, lean=-4, recoil=0.1)
    hand(rel, "Right", V(-0.18, 0.09, 0.47))
    return [(0, N, "lin"), (0.22, aimpose(0.0), "back"), (0.34, aimpose(0.5, lean=-1.5), "io"), (0.45, aimpose(1.0, lean=-3), "io"), (0.62, aimpose(1.0, lean=-3), "lin"),
            (0.68, rel, "out"), (1.0, N, "io")]


BOW = bow_keys()


@clip("AttackBow", 1.0, False, hand="L")
def attack_bow(p):
    P = keys(p, BOW)
    if 0.45 < p < 0.62:
        P.rot("LeftForeArm", rx(0.8 * math.sin(TAU * 12 * p)))
    return plant(P)


def cast_keys():
    gather = body(crouch=0.02, lean=-4, nod=8)
    for s, sx in SIDES:
        hand(gather, s, V(sx * 0.02, -0.15, 0.4))
    cast = arm(arm(body(lean=10, crouch=0.01, shift=(0, -0.02), nod=-4), "Right", V(0.05, -1, 0.1), V(0.05, -1, 0.12)),
               "Left", V(0.6, 0.4, -0.7))
    return [(0, N, "lin"), (0.28, gather, "io"), (0.46, cast, "back"), (0.66, cast, "lin"), (1.0, N, "io")]


CAST = cast_keys()


@clip("AttackCast", 0.9, False, hand="R")
def attack_cast(p):
    return plant(keys(p, CAST))


def tuck_pose(amount=1.0, base=None):
    P = body(lean=40 * amount, nod=16 * amount, crouch=0.07 * amount, base=base)
    for s, sx in SIDES:
        P.R[f"{s}UpLeg"] = rx(-100 * amount) @ rz(sx * 6 * amount)
        P.R[f"{s}Leg"] = rx(125 * amount)
        arm(P, s, V(sx * 0.45, -0.55, -0.7), V(-sx * 0.2, -0.7, -0.5))
    return P


TUCK = tuck_pose()
CROUCH_IN = plant(body(lean=30, nod=20, crouch=0.08))
for _s, _sx in SIDES:
    arm(CROUCH_IN, _s, V(_sx * 0.45, -0.55, -0.7), V(-_sx * 0.2, -0.7, -0.5))


@clip("DodgeRoll", 0.7, False, ground="frame", ground_w=lambda p: ss(0.1, 0.2, p) * (1 - ss(0.76, 0.88, p)))
def dodge_roll(p):
    if p < 0.15:
        return plant(keys(p / 0.15, [(0, N, "lin"), (1, CROUCH_IN, "io")]))
    if p > 0.8:
        return plant(keys((p - 0.8) / 0.2, [(0, CROUCH_IN, "lin"), (0.6, body(crouch=-0.01), "back"), (1, N, "io")]))
    u = (p - 0.15) / 0.65
    th = 360 * EASE["io"](u)
    P = mix(CROUCH_IN, TUCK, ss(0, 0.15, u) * (1 - ss(0.85, 1, u)))
    hip = HEAD0["Hips"] + P.loc
    C = (hip + P.head("Head") + P.acc("Head") @ V(0, 0, 0.22)) / 2
    R = rx(th)
    P.R["Hips"] = R @ P.q("Hips")
    P.loc = (C + R @ (hip - C)) - HEAD0["Hips"]
    return P


def hit_keys():
    recoil = body(lean=-14, side=5, nod=-14, tilt=8, shift=(0, 0.02), crouch=0.012)
    for s, sx in SIDES:
        arm(recoil, s, V(sx * 0.8, 0.2, 0.2), V(sx * 0.6, 0.1, 0.6))
    recover = body(lean=4, nod=4)
    for s, sx in SIDES:
        arm(recover, s, V(sx * 0.5, -0.1, -0.8))
    return recoil, [(0, N, "lin"), (0.22, recoil, "out"), (0.5, recover, "back"), (1.0, N, "io")]


RECOIL, HIT = hit_keys()


@clip("Hit", 0.5, False)
def hit(p):
    return plant(keys(p, HIT))


def defeat_keys():
    wobble = body(crouch=0.06, lean=-6, side=-6, nod=10)
    for s, sx in SIDES:
        arm(wobble, s, V(sx * 0.6, 0.1, -0.7))
    plant(wobble)

    def sitting(z, lean):
        P = body(crouch=0.279 - z, lean=lean)
        for s, sx in SIDES:
            P.aim(f"{s}UpLeg", V(sx * 0.25, -1, 0.1)).aim(f"{s}Leg", V(sx * 0.2, -1, 0.08))
            arm(P, s, V(sx * 0.6, 0.5, -0.5))
        return P

    def lying(bounce=0.0):
        P = body(hips=rx(-85), nod=10, turn=20, crouch=-bounce)
        for s, sx in SIDES:
            P.R[f"{s}UpLeg"], P.R[f"{s}Leg"] = rz(sx * 8), Quaternion()
            arm(P, s, V(sx, 0.35, 0.05))
        return P
    return [(0, N, "lin"), (0.12, plant(RECOIL.copy()), "out"), (0.3, wobble, "io"), (0.5, sitting(0.075, -10), "in"),
            (0.62, sitting(0.09, -6), "out"), (0.82, lying(), "in"), (0.9, lying(0.012), "out"), (1.0, lying(), "back")]


DEFEAT = defeat_keys()


@clip("Defeat", 1.6, False, ground="frame", ground_w=lambda p: ss(0.3, 0.45, p), endsNeutral=False)
def defeat(p):
    P = keys(p, DEFEAT)
    return plant(P) if p < 0.3 else P


@clip("Trace", 2.0, True, hand="L")
def trace(p):
    """Incantation stance: feet apart, left hand forward tracing a circle, right hand braced at the chest."""
    c, s = math.cos(TAU * p), math.sin(TAU * p)
    P = body(lean=4 + 0.8 * s, twist=8, crouch=0.022 + 0.004 * math.sin(2 * TAU * p), turn=6 * c, nod=3 * s)
    hand(P, "Left", V(0.07 + 0.035 * c, -0.21, 0.46 + 0.035 * s))
    hand(P, "Right", V(-0.02, -0.14, 0.4))
    return plant(P, ankles={"Left": V(0.085, -0.03, ANKLE["Left"].z), "Right": V(-0.085, 0.03, ANKLE["Right"].z)})


# ================================================================ bake, ground, check
MESHES = [bpy.data.objects[n] for n in ("V6_Body", "V6_Head")]


def apply(P):
    for n in NAMES:
        pb = rig.pose.bones[P_ + n]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = REST[n].inverted() @ P.q(n) @ REST[n]
    rig.pose.bones[P_ + "Hips"].location = REST["Hips"].inverted() @ P.loc


def min_z():
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    lo = 9.0
    for o in MESHES:
        e = o.evaluated_get(dg)
        me = e.to_mesh()
        co = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3) @ np.array(e.matrix_world.to_3x3()).T + np.array(e.matrix_world.translation)
        lo = min(lo, float(co[:, 2].min()))
        e.to_mesh_clear()
    return lo


def samples(c):
    return [((f % c["frames"]) / c["frames"]) if c["loop"] else f / c["frames"] for f in range(c["frames"] + 1)]


def bake(c):
    rig.animation_data.action = None
    ps = samples(c)
    poses = [c["fn"](p) for p in ps]
    if c["ground"]:
        zs = []
        for P in poses:
            apply(P)
            zs.append(min_z())
        if c["ground"] == "const":
            dz = [-min(zs)] * len(zs)
        else:
            w = c["meta"].pop("ground_w", lambda p: 1.0)
            dz = [-z if z < 0 else -z * w(p) for z, p in zip(zs, ps)]
        for P, d in zip(poses, dz):
            P.loc.z += d
    act = bpy.data.actions.new(c["name"])
    act.use_fake_user = True
    rig.animation_data.action = act
    prev = {}
    for f, P in enumerate(poses):
        apply(P)
        for n in NAMES:
            pb = rig.pose.bones[P_ + n]
            q = pb.rotation_quaternion.copy()
            if n in prev and prev[n].dot(q) < 0:
                q.negate()
                pb.rotation_quaternion = q
            prev[n] = q
            pb.keyframe_insert("rotation_quaternion", frame=f)
            if n == "Hips":
                pb.keyframe_insert("location", frame=f)
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, c["frames"]
    act.use_cyclic = c["loop"]
    return act


# hands/forearms must stay out of the head (ellipsoid in the Head bone's rest frame)
body_ob = MESHES[0]
gidx = {g.index: g.name for g in body_ob.vertex_groups}
ARM_V = [v.index for v in body_ob.data.vertices
         if sum(g.weight for g in v.groups if any(k in gidx[g.group] for k in ("Hand", "ForeArm"))) > 0.5]
HB = rig.data.bones[P_ + "Head"]
HC0 = Vector((0, 0, 1.0 - 0.2245))


def check(name, frames):
    worst, lowest = 0.0, 9.0
    dg = None
    for f in range(0, frames + 1, 2):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        e = body_ob.evaluated_get(dg)
        me = e.to_mesh()
        inv = (rig.pose.bones[P_ + "Head"].matrix @ HB.matrix_local.inverted()).inverted()
        for i in ARM_V:
            q = inv @ me.vertices[i].co - HC0
            d = (q.x / 0.215) ** 2 + (q.y / 0.19) ** 2 + (q.z / 0.215) ** 2
            worst = max(worst, 1 - d)
        e.to_mesh_clear()
        lowest = min(lowest, min_z())
    return worst, lowest


catalog = [{"name": "Idle", "length": 2.0, "loop": True, "frames": 60, "source": "v6"},
           {"name": "Walk", "length": 1.0, "loop": True, "frames": 30, "source": "v6"}]
for c in CLIPS:
    act = bake(c)
    worst, lowest = check(c["name"], c["frames"])
    meta = {k: v for k, v in c["meta"].items() if k != "ground_w"}
    catalog.append({"name": c["name"], "length": round(c["frames"] / FPS, 3), "loop": c["loop"], "frames": c["frames"],
                    **({} if c["loop"] else {"endsNeutral": meta.pop("endsNeutral", "endsOn" not in meta)}), **meta})
    print(f"CLIP {c['name']:12s} {c['frames'] / FPS:4.2f}s loop={c['loop']!s:5s} head_intrusion={worst:5.3f} min_z={lowest:+.3f}")

rig.animation_data.action = bpy.data.actions["Idle"]
sc.frame_set(0)
for o in sc.objects:
    if o.type == "MESH" and o.data.color_attributes:
        o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index   # export COLOR_0
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=os.path.join(HERE, "v6_clips.glb"), export_format="GLB", use_selection=True, export_yup=True,
    export_normals=True, export_texcoords=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    export_skins=True, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
    export_leaf_bone=False, export_optimize_animation_size=True)
kit.update_catalog("base", {"glb": "base/v6.glb", "clips_glb": "base/v6_clips.glb", "fps": FPS,
                            "note": "v6_clips.glb = the v6 base body (tee + shorts + default hair) with every clip. Sit/Study "
                                    "sit on a seat at seatHeight; Sleep/Defeat lie on the back with the head toward the "
                                    "character's back (+Y Blender, -Z glTF). hand = the socket that holds the weapon."})
kit.update_catalog("clips", catalog)
print("CLIPS_OK", len(catalog))
