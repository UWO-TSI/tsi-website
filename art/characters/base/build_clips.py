"""Full clip set on the locked v6 body -> base/v6_clips.glb (+ the "clips" section of ../character_catalog.json).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_clips.py [-- head v7]

With `head v7` the head is the hand-modeled V7_Head (art/characters/v7/head.blend) and the file is base/v7_clips.glb,
which the engine loads (avatar v7); body, rig and clips are the same.

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
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
HEAD = ARGS[ARGS.index("head") + 1] if "head" in ARGS else "v6"      # v7: the hand-modeled head (art/characters/v7)
with bpy.data.libraries.load(os.path.join(HERE, "v6.blend"), link=False) as (src, dst):
    dst.objects = list(src.objects)
    dst.actions = list(src.actions)
for o in dst.objects:
    sc.collection.objects.link(o)
rig = bpy.data.objects["CharacterRig"]
HEAD_OB = "V6_Head"
if HEAD == "v7":
    # avatar v7 (specs/avatar-v7.md item 1): same body, rig and clips; the head is V7_Head from v7/head.blend,
    # re-bound to this rig, with the material names the engine looks for (M_Skin, M_Face)
    old = bpy.data.objects["V6_Head"]
    old_face = bpy.data.materials["M_Face"]
    bpy.data.objects.remove(old, do_unlink=True)
    bpy.data.materials.remove(old_face)
    before = set(bpy.data.objects)
    with bpy.data.libraries.load(os.path.join(HERE, "..", "v7", "head.blend"), link=False) as (src, dst):
        dst.objects = ["V7_Head"]
    head = bpy.data.objects["V7_Head"]
    for o in set(bpy.data.objects) - before - {head}:
        bpy.data.objects.remove(o, do_unlink=True)          # the head file's own rig copy
    sc.collection.objects.link(head)
    head.parent = rig
    head.matrix_parent_inverse.identity()
    head.matrix_basis.identity()
    for md in head.modifiers:
        if md.type == "ARMATURE":
            md.object = rig
    face = head.data.materials[1]
    face.name = "M_Face"
    for n in face.node_tree.nodes:                   # head.blend points at the avatar-v7 worktree's copy, gone since
        if n.type == "TEX_IMAGE" and n.image:
            n.image.filepath = os.path.join(HERE, "..", "v7", "face", "v7_face_default.png")
    head.data.materials[0] = bpy.data.materials["M_Skin"]
    HEAD_OB = "V7_Head"
OUT_GLB = "v7_clips.glb" if HEAD == "v7" else "v6_clips.glb"
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


def roll_pose(p, a, b, spin="io"):
    """Crouch in until a, a full forward roll until b, stand up after."""
    if p < a:
        return plant(keys(p / a, [(0, N, "lin"), (1, CROUCH_IN, "io")]))
    if p > b:
        return plant(keys((p - b) / (1 - b), [(0, CROUCH_IN, "lin"), (0.6, body(crouch=-0.01), "back"), (1, N, "io")]))
    u = (p - a) / (b - a)
    th = 360 * EASE[spin](u)
    P = mix(CROUCH_IN, TUCK, ss(0, 0.15, u) * (1 - ss(0.85, 1, u)))
    hip = HEAD0["Hips"] + P.loc
    C = (hip + P.head("Head") + P.acc("Head") @ V(0, 0, 0.22)) / 2
    R = rx(th)
    P.R["Hips"] = R @ P.q("Hips")
    P.loc = (C + R @ (hip - C)) - HEAD0["Hips"]
    return P


@clip("DodgeRoll", 0.7, False, ground="frame", ground_w=lambda p: ss(0.1, 0.2, p) * (1 - ss(0.76, 0.88, p)))
def dodge_roll(p):
    return roll_pose(p, 0.15, 0.8)


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


# ================================================================ movement (specs/movement.md): the sim lifts the root, clips pose the body
def legs(P, thigh, knee, splay=4.0, foot=20.0):
    """Both legs from the hip: thigh forward by `thigh` (deg), knee bent by `knee`; (left, right) pairs allowed."""
    th = thigh if isinstance(thigh, tuple) else (thigh, thigh)
    kn = knee if isinstance(knee, tuple) else (knee, knee)
    for (s, sx), t, k in zip(SIDES, th, kn):
        P.R[f"{s}UpLeg"] = rx(-t) @ rz(sx * splay)
        P.R[f"{s}Leg"] = rx(k)
        P.R[f"{s}Foot"] = rx(foot)
        P.R[f"{s}ToeBase"] = Quaternion()
    return P


def balance(P, up=0.55, fwd=-0.1, bend=0.25):
    """Arms out for balance: up = how raised (0 level), fwd = forward (-) / back (+)."""
    for s, sx in SIDES:
        arm(P, s, V(sx * 0.8, fwd, up), V(sx * 0.7, fwd - bend, up + 0.2))
    return P


def fall_pose(p):
    """In the air: knees bent under, a slow bicycle, arms out and up."""
    c, s2 = math.sin(TAU * p), math.sin(2 * TAU * p)
    P = body(lean=-3 + 2 * s2, nod=-6)
    legs(P, (32 + 12 * c, 32 - 12 * c), (55 - 12 * c, 55 + 12 * c))
    return balance(P, up=0.62 + 0.08 * s2, fwd=-0.05)


@clip("Fall", 0.6, True)
def fall(p):
    return fall_pose(p)


# The jump (specs/movement-feel.md): a quick crouch-and-spring one-shot at take-off, then the Air clip, which the engine
# scrubs by vertical speed (rise, apex tuck, fall, reaching for the ground) so the arc never pops whatever its length.
def takeoff_pose():
    P = body(lean=4, nod=-8)
    legs(P, 6, 6, foot=42)                                                      # legs long, toes pointed
    return balance(P, up=0.42, fwd=-0.62, bend=0.1)                             # arms swung up in front


def air_keys():
    rise = balance(legs(body(lean=4, nod=-6), (42, 14), (62, 24), foot=30), up=0.62, fwd=-0.38)
    apex = balance(legs(body(lean=8, nod=-2), 66, 96), up=0.74, fwd=-0.16)     # the tuck
    drop = balance(legs(body(lean=2, nod=-4), (30, 40), (48, 44), foot=22), up=0.7, fwd=-0.06)
    reach = balance(legs(body(lean=6, nod=5), (16, 22), (20, 28), foot=8), up=0.56, fwd=-0.22)  # feet down for the ground
    return [(0, takeoff_pose(), "lin"), (0.25, rise, "io"), (0.5, apex, "io"), (0.75, drop, "io"), (1.0, reach, "io")]


AIR = air_keys()


@clip("Air", 1.0, False, scrub=True, endsNeutral=False)
def air(p):
    return keys(p, AIR)


def jump_keys():
    crouch = body(crouch=0.05, lean=14, nod=6)
    for s, sx in SIDES:
        arm(crouch, s, V(sx * 0.35, 0.6, -0.72), V(sx * 0.25, 0.7, -0.66))    # arms back, ready to swing
    return [(0, N, "lin"), (0.35, plant(crouch), "out"), (1.0, takeoff_pose(), "out")]


JUMP = jump_keys()


@clip("Jump", 0.14, False, endsOn="Air")
def jump(p):
    P = keys(p, JUMP)
    return plant(P) if p < 0.35 else P


def land_keys():
    def squat(crouch, lean, nod):
        P = body(crouch=crouch, lean=lean, nod=nod)
        for s, sx in SIDES:
            arm(P, s, V(sx * 0.55, -0.55, -0.55), V(sx * 0.3, -0.8, -0.4))
        return P
    return [(0, squat(0.06, 16, 8), "lin"), (0.35, squat(0.07, 18, 10), "out"), (1.0, N, "back")]


LAND = land_keys()


@clip("Land", 0.28, False)
def land(p):
    return plant(keys(p, LAND))


def land_heavy_keys():
    """A big drop: down into a deep crouch, one hand to the ground, the other arm out behind; a breath; up."""
    low = body(crouch=0.11, lean=26, nod=7, side=-4)
    hand(low, "Right", V(-0.075, -0.17, 0.05), V(-0.6, 0.2, -1))
    arm(low, "Left", V(0.7, 0.45, -0.25), V(0.55, 0.6, -0.1))
    hold = body(crouch=0.1, lean=22, nod=5, side=-3)
    hand(hold, "Right", V(-0.075, -0.165, 0.06), V(-0.6, 0.2, -1))
    arm(hold, "Left", V(0.72, 0.4, -0.3), V(0.58, 0.55, -0.15))
    up = body(crouch=0.02, lean=6, nod=2)
    for s, sx in SIDES:
        arm(up, s, V(sx * 0.6, 0.0, -0.8))
    return [(0, plant(low), "lin"), (0.45, plant(hold), "io"), (0.78, plant(up), "out"), (1.0, N, "io")]


LAND_HEAVY = land_heavy_keys()


@clip("LandHeavy", 0.55, False)
def land_heavy(p):
    return plant(keys(p, LAND_HEAVY))


@clip("Roll", 0.36, False, ground="frame", ground_w=lambda p: ss(0.05, 0.12, p) * (1 - ss(0.82, 0.92, p)))
def roll(p):
    """The landing roll: straight into the tuck (the sim is already moving), quicker than the dodge."""
    return roll_pose(p, 0.08, 0.86, spin="lin")


def mantle_keys():
    reach = body(lean=-6, nod=-16)
    legs(reach, 12, 25, foot=35)
    for s, sx in SIDES:
        arm(reach, s, V(sx * 0.3, -0.45, 0.84), V(sx * 0.2, -0.55, 0.8))  # hands up on the lip
    pull = body(lean=18, nod=4, crouch=0.01)
    legs(pull, (95, 20), (120, 35))  # left knee up onto the ledge
    for s, sx in SIDES:
        arm(pull, s, V(sx * 0.5, -0.5, 0.1), V(sx * 0.1, -0.7, -0.55))  # pushing down on the lip
    step = body(lean=10, nod=2)
    legs(step, (40, -10), (60, 15), foot=10)
    balance(step, up=0.1, fwd=0.2)
    return [(0, reach, "lin"), (0.35, reach, "lin"), (0.62, pull, "io"), (0.85, step, "out"), (1.0, N, "io")]


MANTLE = mantle_keys()


@clip("Mantle", 0.32, False)
def mantle(p):
    return keys(p, MANTLE)


def dash_pose():
    P = body(lean=28, nod=-10, crouch=0.02)
    legs(P, (55, -35), (70, 30), foot=30)  # front knee driving, back leg trailing
    for s, sx in SIDES:
        arm(P, s, V(sx * 0.45, 0.75, -0.35), V(sx * 0.3, 0.9, -0.2))  # swept back
    return P


def dash_keys():
    """A beat of gathering (a dip, arms in front), the lunge (lean in, arms swept back), then a settle: upright, a touch
    back past it with the arms coming forward, and home."""
    gather = body(lean=-5, nod=5, crouch=0.03)
    legs(gather, 22, 34, foot=18)
    for s, sx in SIDES:
        arm(gather, s, V(sx * 0.35, -0.62, -0.7), V(sx * 0.2, -0.85, -0.4))
    settle = body(lean=-7, nod=7, crouch=0.022)
    legs(settle, (18, 4), (26, 10), foot=12)
    for s, sx in SIDES:
        arm(settle, s, V(sx * 0.55, -0.42, -0.72), V(sx * 0.35, -0.6, -0.6))
    return [(0, N, "lin"), (0.1, gather, "out"), (0.3, DASH, "out"), (0.6, DASH, "lin"), (0.8, settle, "io"), (1.0, N, "io")]


DASH = dash_pose()
DASH_KEYS = dash_keys()


@clip("Dash", 0.36, False, ground="frame")
def dash(p):
    return keys(p, DASH_KEYS)


@clip("Skid", 0.4, True, ground="frame")
def skid(p):
    """Digging in to turn round: leaning into the new way, the back foot braced out behind, arms out; a slide judder."""
    j = math.sin(TAU * 2 * p)
    P = body(lean=16 + 2 * j, side=3 * j, crouch=0.04, nod=-4)
    legs(P, (40, -45), (70, 10), foot=10)
    balance(P, up=0.25 + 0.05 * j, fwd=-0.35)
    return P


GLIDE_GRIP = V(-0.23, -0.01, 0.58)            # the right hand on the leaf's stem, up beside the jaw (the arms can't reach over the head)


@clip("Glide", 2.0, True)
def glide(p):
    """Hanging under the leaf glider (specs/glider.md): the right hand up on the stem, the left arm out for balance,
    legs dangling with a slow kick, the body swaying like a pendulum under the grip."""
    s, c = math.sin(TAU * p), math.cos(TAU * p)
    P = body(lean=-4 + 1.5 * c, nod=-8 + 2 * c, tilt=2 * s, hips=ry(3 * s))
    legs(P, (14 + 9 * s, 14 - 9 * s), (30 - 10 * s, 30 + 10 * s), splay=5, foot=28)
    hand(P, "Right", GLIDE_GRIP, V(-1, 0.4, -0.4))
    arm(P, "Left", V(0.85, 0.12, 0.42 + 0.05 * s), V(0.75, 0.05, 0.62 + 0.06 * s))
    return P


# ================================================================ crouch and the slide (specs/movement-slide.md, row 274)
CROUCH = 0.15                                 # the crouch's hip drop (rig m): low, knees out, sneaking


def crouch_body(breath=0.0, bob=0.0, lean=32.0, side=0.0, twist=0.0):
    """Hips down, leaning in, the head kept level (looking ahead, not at the feet); `breath` lifts the chest."""
    P = body(crouch=CROUCH - bob - 0.003 * breath, lean=lean + 1.2 * breath, side=side, twist=twist)
    for sd, sx in SIDES:
        P.rot(f"{sd}Shoulder", ry(-sx * 2.5 * breath))
    P.world("Head", rx(6 - 1.5 * breath) @ rz(-twist * 0.4))
    return P


def crouch_hands(P, swing=0.0, breath=0.0):
    """Hands loose and low in front of the knees, swinging a little against the step."""
    for sd, sx in SIDES:
        k = swing * sx
        hand(P, sd, P.head("Hips") + V(sx * 0.11, -0.14 - 0.035 * k, 0.04 + 0.012 * abs(k) + 0.004 * breath), V(sx * 0.7, 0.4, -1))
    return P


@clip("CrouchIdle", 2.0, True, ground="frame", ground_w=lambda p: 0.0)   # lifted only where a toe would dip under
def crouch_idle(p):
    """Crouched still: a slow breath (the chest and shoulders rise), a little weight shift side to side."""
    b, w = math.sin(TAU * p), math.sin(TAU * p + 1.1)
    P = crouch_body(breath=b, side=1.2 * w)
    P.loc.x += 0.004 * w
    crouch_hands(P, breath=b)
    return plant(P, knees_out=0.5)


STRIDE, LIFT = 0.075, 0.05                    # crouch-walk step reach either side of the hip (rig m) and foot lift


@clip("CrouchWalk", 0.8, True, ground="frame", ground_w=lambda p: 0.0)
def crouch_walk(p):
    """Tiptoeing low: short careful steps, the foot lifted high and set down, hips bobbing at each footfall, hands low
    and swinging against the legs. The left foot comes down at p = 0, the right at 0.5 (measured contacts)."""
    ankles = {}
    for (sd, sx), ph in zip(SIDES, (0.0, 0.5)):
        q = (p + ph) % 1
        if q < 0.55:                                            # stance: planted, sliding back under the hips
            y, z = -STRIDE + 2 * STRIDE * q / 0.55, 0.0
        else:                                                   # swing: lift high and carry forward, set down softly
            u = (q - 0.55) / 0.45
            y, z = STRIDE - 2 * STRIDE * EASE["io"](u), LIFT * math.sin(math.pi * u) ** 0.8
        ankles[sd] = ANKLE[sd] + V(sx * 0.012, y, z)
    c2 = math.cos(2 * TAU * p)
    P = crouch_body(bob=0.008 * (1 + c2) / 2, lean=34, side=2.5 * math.sin(TAU * p), twist=7 * math.sin(TAU * p))
    crouch_hands(P, swing=math.sin(TAU * p))
    plant(P, ankles=ankles, knees_out=0.45)
    for (sd, sx), ph in zip(SIDES, (0.0, 0.5)):                  # the lifted foot's toes hang a little
        q = (p + ph) % 1
        if q >= 0.55:
            P.world(f"{sd}Foot", rx(26 * math.sin(math.pi * (q - 0.55) / 0.45) ** 2))
    return P


def slide_pose(settle=0.0, skim=0.0, deep=0.0):
    """The slide: leaning back, the lead (left) leg out in front with the heel down and toes up, the back leg folded
    under, the right hand trailing on the ground, the left arm out ahead for balance, the head level and looking where
    it goes. `settle` breathes the torso, `skim` drags the trailing hand, `deep` lies it back further."""
    P = body(hips=rx(-28 - 6 * deep), lean=-20 - 2.5 * settle - 6 * deep, side=-14, twist=10, crouch=0.22)
    P.aim("LeftUpLeg", V(0.05, -0.97, -0.2 + 0.06 * deep)).aim("LeftLeg", V(0.03, -0.99, -0.08 + 0.05 * deep))
    P.world("LeftFoot", rx(-55)); P.R["LeftToeBase"] = Quaternion()
    P.aim("RightUpLeg", V(-0.55, -0.8, -0.18)).aim("RightLeg", V(-0.1, 0.95, -0.28))
    P.world("RightFoot", rx(80) @ rz(-25)); P.R["RightToeBase"] = Quaternion()
    hip = P.head("Hips")
    hand(P, "Right", hip + V(-0.21 - 0.006 * skim, 0.08 + 0.012 * skim, -0.01 + 0.005 * abs(skim)), V(-1, 0.4, 0.4))
    arm(P, "Left", V(0.85, -0.12, 0.52 + 0.03 * settle), V(0.55, -0.35, 0.76 + 0.03 * settle))
    P.world("Head", rx(10) @ rz(-6) @ ry(3))
    return P


SLIDE0 = slide_pose()


@clip("Slide", 1.2, True, ground="frame")
def slide(p):
    """The slide held (a loop, not a frozen pose): the torso settles and lifts a touch, the trailing hand skims and
    drags, the lead arm rides the bumps, the head stays level. Steering lean and depth with speed are the engine's."""
    s, c = math.sin(TAU * p), math.cos(TAU * p)
    P = slide_pose(settle=s, skim=math.sin(2 * TAU * p))
    P.rot("LeftForeArm", rx(3 * math.sin(2 * TAU * p + 0.6)))
    P.rot("Spine1", ry(1.5 * c))
    return P


RUN0 = run(0.0)


def slide_in_keys(dash):
    """Run (or the dash's lunge) to the slide: the hips drop, the lead leg kicks out, the back leg folds under, the torso
    leans back. From a dash the drop is sharper: deeper, past the slide, then settling into it."""
    drop = body(hips=rx(-6), lean=-2 if not dash else -10, crouch=0.13 if not dash else 0.19, nod=-4)
    drop.aim("LeftUpLeg", V(0.05, -0.85, -0.52)).aim("LeftLeg", V(0.03, -0.9, -0.42))
    drop.world("LeftFoot", rx(-30))
    drop.aim("RightUpLeg", V(-0.25, -0.3, -0.92)).aim("RightLeg", V(-0.1, 0.62, -0.78))
    drop.world("RightFoot", rx(55))
    for sd, sx in SIDES:
        arm(drop, sd, V(sx * 0.7, -0.25, 0.25), V(sx * 0.55, -0.45, 0.35))
    if dash:
        return [(0, DASH, "lin"), (0.4, drop, "out"), (0.72, slide_pose(deep=1.0), "out"), (1.0, SLIDE0, "io")]
    return [(0, RUN0, "lin"), (0.45, drop, "out"), (1.0, SLIDE0, "back")]


SLIDE_IN, SLIDE_IN_DASH = slide_in_keys(False), slide_in_keys(True)


@clip("SlideIn", 0.2, False, ground="frame", endsOn="Slide")
def slide_in(p):
    return keys(p, SLIDE_IN)


@clip("SlideInDash", 0.16, False, ground="frame", endsOn="Slide")
def slide_in_dash(p):
    return keys(p, SLIDE_IN_DASH)


def slide_up_keys():
    """Pop up into the run: the back foot plants under the hips, the torso comes forward over it, the lead leg pulls
    through into a stride."""
    push = body(lean=18, crouch=0.09, nod=6)
    push.aim("RightUpLeg", V(-0.1, -0.45, -0.89)).aim("RightLeg", V(-0.05, 0.42, -0.9))
    push.world("RightFoot", Quaternion())
    push.aim("LeftUpLeg", V(0.06, -0.8, -0.6)).aim("LeftLeg", V(0.03, -0.3, -0.95))
    push.world("LeftFoot", rx(-10))
    for sd, sx in SIDES:
        arm(push, sd, V(sx * 0.45, -0.45 * sx, -0.6), V(sx * 0.2, -0.75 * sx, -0.3))
    return [(0, SLIDE0, "lin"), (0.42, push, "out"), (1.0, RUN0, "io")]


SLIDE_UP = slide_up_keys()


@clip("SlideUp", 0.26, False, ground="frame", endsOn="Run")
def slide_up(p):
    return keys(p, SLIDE_UP)


def slide_jump_keys():
    """Out of the slide into the slide-jump: a quick gather (legs under, arms back) and the spring, arms swinging up,
    legs pushing long, into the Air clip's take-off."""
    gather = body(lean=6, crouch=0.13, nod=4)
    gather.aim("LeftUpLeg", V(0.06, -0.62, -0.78)).aim("LeftLeg", V(0.03, 0.2, -0.98))
    gather.aim("RightUpLeg", V(-0.08, -0.5, -0.86)).aim("RightLeg", V(-0.04, 0.35, -0.94))
    for sd, sx in SIDES:
        gather.world(f"{sd}Foot", rx(10))
        arm(gather, sd, V(sx * 0.4, 0.62, -0.68), V(sx * 0.25, 0.78, -0.58))
    return [(0, SLIDE0, "lin"), (0.4, gather, "out"), (1.0, takeoff_pose(), "out")]


SLIDE_JUMP = slide_jump_keys()


@clip("SlideJump", 0.16, False, ground="frame", ground_w=lambda p: 1 - ss(0.45, 0.9, p), endsOn="Air")
def slide_jump(p):
    return keys(p, SLIDE_JUMP)


def slide_stand_keys():
    """Slowed to a stop with the key held: sit up, draw the legs in and rise into the crouch."""
    sit = body(lean=4, crouch=0.17, nod=2)
    sit.aim("LeftUpLeg", V(0.15, -0.8, -0.58)).aim("LeftLeg", V(0.06, 0.15, -0.99))
    sit.aim("RightUpLeg", V(-0.2, -0.55, -0.81)).aim("RightLeg", V(-0.08, 0.5, -0.86))
    for sd, sx in SIDES:
        sit.world(f"{sd}Foot", Quaternion())
    crouch_hands(sit)
    end = crouch_body()
    crouch_hands(end)
    plant(end, knees_out=0.5)
    return [(0, SLIDE0, "lin"), (0.5, sit, "io"), (1.0, end, "io")]


SLIDE_STAND = slide_stand_keys()


@clip("SlideStand", 0.34, False, ground="frame", endsOn="CrouchIdle")
def slide_stand(p):
    return keys(p, SLIDE_STAND)


def slide_bonk_keys():
    """A slide into something: the feet hit, the body jolts forward over them, rocks back, scrambles up with the arms
    out and stands."""
    hit = slide_pose(settle=-1)
    hit.R["Hips"] = rx(-4)
    hit.rot("Spine", rx(14)).rot("Spine1", rx(8))
    hit.aim("LeftUpLeg", V(0.08, -0.8, -0.6)).aim("LeftLeg", V(0.04, -0.2, -0.98))   # the lead knee buckles
    for sd, sx in SIDES:
        arm(hit, sd, V(sx * 0.55, -0.75, -0.1), V(sx * 0.35, -0.9, 0.0))
    back = body(lean=-14, crouch=0.14, nod=-8, tilt=6)
    back.aim("LeftUpLeg", V(0.15, -0.75, -0.65)).aim("LeftLeg", V(0.06, 0.1, -0.99))
    back.aim("RightUpLeg", V(-0.15, -0.6, -0.78)).aim("RightLeg", V(-0.06, 0.3, -0.95))
    balance(back, up=0.45, fwd=0.05)
    up = body(lean=8, crouch=0.04, side=4, nod=4)
    balance(up, up=0.3, fwd=-0.1)
    plant(up, knees_out=0.35)
    return [(0, SLIDE0, "lin"), (0.16, hit, "out"), (0.42, back, "io"), (0.72, up, "io"), (1.0, N, "io")]


SLIDE_BONK = slide_bonk_keys()


@clip("SlideBonk", 0.5, False, ground="frame", ground_w=lambda p: 1 - ss(0.75, 0.95, p))
def slide_bonk(p):
    return keys(p, SLIDE_BONK)


# ---------------------------------------------------------------- residents' idles (specs/polish/living-village.md)
def look_keys():
    """Turn the head and shoulders to one side, then the other, curious: weight onto the near foot, a little tilt."""
    left = body(turn=52, twist=16, tilt=7, nod=-5, side=2)
    right = body(turn=-52, twist=-16, tilt=-7, nod=-5, side=-2)
    for P, sx in ((left, 1), (right, -1)):
        for s, sd in SIDES:
            hand(P, s, V(sd * 0.165 + sx * 0.012, -0.03, 0.326))     # arms hang loose, drifting with the twist
    return [(0, N, "lin"), (0.17, left, "io"), (0.4, left, "lin"), (0.6, right, "io"), (0.83, right, "lin"), (1.0, N, "io")]


LOOK = look_keys()


@clip("LookAround", 3.2, False)
def look_around(p):
    return plant(keys(p, LOOK))


def stretch_up_keys():
    """Standing stretch (the seated Stretch's reach, on the feet): arms up and back past the head in a V, up on the toes
    a touch and leaning back, then over to one side, and let go with a little slump."""
    reach = body(lean=-9, nod=-16, crouch=-0.012)
    for s, sx in SIDES:
        arm(reach, s, V(sx * 0.86, 0.36, 0.44), V(sx * 0.64, 0.5, 0.6))
    lean = body(lean=-5, side=13, nod=-10, crouch=-0.008, tilt=-6)
    arm(lean, "Left", V(0.8, 0.32, 0.55), V(0.55, 0.46, 0.72))
    arm(lean, "Right", V(-0.9, 0.3, 0.32), V(-0.7, 0.45, 0.5))
    drop = body(lean=4, nod=6, crouch=0.01)
    return [(0, N, "lin"), (0.24, reach, "back"), (0.46, reach, "lin"), (0.64, lean, "io"), (0.78, lean, "lin"), (0.9, drop, "io"), (1.0, N, "io")]


STRETCH_UP = stretch_up_keys()


@clip("StretchUp", 2.6, False)
def stretch_up(p):
    P = keys(p, STRETCH_UP)
    return plant(P, lift=max(0.0, P.loc.z - N.loc.z) * 0.8)


@clip("Chat", 3.0, True)
def chat(p):
    """Talking with someone: weight shifting foot to foot, nods on the beats, the right hand making a point, the left
    hand resting at the hip; ends where it starts."""
    s, c = math.sin(TAU * p), math.cos(TAU * p)
    beat = 0.5 + 0.5 * math.sin(2 * TAU * p - 0.6)
    P = body(side=2.5 * s, twist=5 * s, tilt=4 * math.sin(TAU * p + 0.8), nod=-2 + 4 * math.sin(2 * TAU * p))
    hand(P, "Right", V(-0.115 - 0.03 * beat, -0.12 - 0.025 * c, 0.35 + 0.045 * beat))
    P.rot("RightHand", rx(-20 * beat))
    hand(P, "Left", V(0.13, -0.005, 0.3 + 0.006 * c), V(1, 0.6, -0.2))
    return plant(P)


# ================================================================ holding things (specs/game-ui.md §2: the tool wheel)
# The engine lays a hold over walking, running and idling: the arms only (Character.tsx HOLD_BONES), so the legs and
# body keep their own clip. The tool's grip in the hand comes from these poses (art/props-enemies/render_held.py).
def hold_rod(b=0.0):
    """The rod over the right shoulder: the fist in front of the shoulder, the elbow down and out."""
    P = body()
    hand(P, "Right", V(-0.11, -0.085, 0.43 + b), V(-1, 0.1, -0.8))
    P.rot("RightHand", rx(-20))
    return P


def hold_tool(b=0.0):
    """A net or shovel in the right hand at the side: the forearm forward, the elbow back and out."""
    P = body()
    hand(P, "Right", V(-0.15, -0.085, 0.34 + b), V(-1, 0.7, -0.3))
    return P


def hold_front(b=0.0):
    """Something held out in front in both hands (a fruit, a snack, a catch)."""
    P = body(lean=2)
    two_hands(P, (-0.042, -0.165, 0.41 + b), (0.042, -0.165, 0.41 + b))
    return P


@clip("HoldRod", 2.0, True)
def hold_rod_clip(p):
    return plant(hold_rod(0.004 * math.sin(TAU * p)))


@clip("HoldTool", 2.0, True)
def hold_tool_clip(p):
    return plant(hold_tool(0.004 * math.sin(TAU * p)))


@clip("HoldFront", 2.0, True)
def hold_front_clip(p):
    return plant(hold_front(0.004 * math.sin(TAU * p)))


def eat_keys():
    """Up under the chin, two bites with the head dipping down to meet them (the arms can't reach the big head's
    mouth), a happy chew looking up, and the hands back down."""
    up = body(nod=16, lean=8)
    two_hands(up, (-0.034, -0.17, 0.5), (0.034, -0.17, 0.5))
    bite = body(nod=28, lean=13, crouch=0.006)
    two_hands(bite, (-0.034, -0.172, 0.505), (0.034, -0.172, 0.505))
    chew = body(nod=-8, tilt=7)
    two_hands(chew, (-0.04, -0.16, 0.44), (0.04, -0.16, 0.44))
    return [(0, hold_front(), "lin"), (0.22, up, "io"), (0.34, bite, "in"), (0.44, up, "out"), (0.56, bite, "in"), (0.68, up, "out"),
            (0.82, chew, "back"), (1.0, N, "io")]


EAT = eat_keys()


@clip("Eat", 1.6, False)
def eat(p):
    return plant(keys(p, EAT))


# ================================================================ verb library (classes v2, design sheet §1.8)
# Sixteen shared verbs, each authored once right-handed (the lead hand is the right) as key poses, and six grip
# adapters: where the off hand sits, and a mirror for the grips held in the left hand (the bow, the pistol), so the
# 96 clips `${Verb}_${Grip}` come from the programs below. A clip runs anticipation, the impact key (its phase is the
# catalogue's `impact`, where the engine lands hitstop and an ult's freeze), follow-through and back to Idle frame 0.
# `-- verbs` bakes only these, plus a hold idle per grip, into base/v7_verbs.glb: the rig and its actions, no mesh,
# which the ruins load beside the village set. `upper`: it can play on the upper body over locomotion and slides.
VERBS_MODE = "verbs" in ARGS
VERB_DEFS = []


def verb(name, seconds, impact, upper, post=None, hold=None):
    def deco(fn):
        VERB_DEFS.append(dict(verb=name, seconds=seconds, impact=impact, upper=upper, fn=fn, post=post, hold=hold))
        return fn
    return deco


class Grip:
    def __init__(self, name, mirror, remap, hand_):
        self.name, self.mirror, self.remap, self.hand = name, mirror, remap, hand_

    def mode(self, want):
        return self.remap if isinstance(self.remap, str) else self.remap.get(want, want)


# Off-hand wants a verb can ask for: free (a counterbalance arm along `d`), two (on the shaft beside the lead hand),
# support (cupped under the lead wrist), gather (mirroring the lead hand), spread (an arm along `d` the grip may keep
# busy), draw (a bowstring hand at `at`); the grip remaps what it can't do.
GRIPS_V = [Grip("OneHand", False, {"two": "free"}, "R"), Grip("Staff", False, {}, "R"), Grip("Bow", True, {"two": "free"}, "L"),
           Grip("Pistol", True, {"two": "support"}, "L"), Grip("Fists", False, {"free": "guard", "two": "guard", "support": "guard", "gather": "guard"}, "both"),
           Grip("Book", False, "book", "L")]
FREE = V(0.6, -0.6, -0.5)
# Chest-relative spots (offsets in the chest's rest frame from Spine2's head): they lean and turn with the body, so a
# lean or a nod never brings the big head down onto them. Fists up in front of the chin; the book held open at the chest.
GUARD_R, GUARD_L, BOOK = V(-0.07, -0.16, 0.06), V(0.065, -0.15, 0.05), V(0.075, -0.17, -0.03)


def chest(P, v):
    return P.head("Spine2") + P.acc("Spine2") @ v


def off(P, g, want, d=FREE, fore=None, at=None):
    mode, w = g.mode(want), P.head("RightHand")
    high = w.z > 0.55                                    # overhead: the off hand slides down the shaft, clear of the face
    if mode in ("free", "spread"):
        arm(P, "Left", d, fore)
    elif mode == "two":
        hand(P, "Left", w + (V(0.02, 0.0, -0.11) if high else V(0.05, 0.02, -0.05)))
    elif mode == "support":
        hand(P, "Left", w + (V(0.02, 0.0, -0.1) if high else V(0.035, 0.025, -0.03)))
    elif mode == "gather":
        hand(P, "Left", V(-w.x, w.y, w.z))
    elif mode == "guard":
        hand(P, "Left", chest(P, GUARD_L), V(0.6, 0.5, -1))
    elif mode == "book":
        hand(P, "Left", chest(P, BOOK))
    elif mode == "draw":
        hand(P, "Left", at)
    return P


def mirror_name(n):
    return n.replace("Left", "#").replace("Right", "Left").replace("#", "Right")


def mirror_pose(P):
    """The pose reflected through the body's midplane (armature x -> -x): a reflected rotation is (w, x, -y, -z)."""
    return Pose({mirror_name(n): Quaternion((q.w, q.x, -q.y, -q.z)) for n, q in P.R.items()}, V(-P.loc.x, P.loc.y, P.loc.z))


def lift_of(P, k):
    return max(0.0, P.loc.z - N.loc.z) * k


def plant_one(P, s, knees_out=0.25):
    sx = dict(SIDES)[s]
    P.ik(f"{s}UpLeg", f"{s}Leg", ANKLE[s], V(sx * knees_out, -1, 0))
    P.world(f"{s}Foot", Quaternion())
    P.R[f"{s}ToeBase"] = Quaternion()
    return P


@verb("CastForward", 0.7, 0.36, True)
def v_cast_forward(g):
    gather = body(crouch=0.02, lean=-4, twist=-18, nod=6)
    off(hand(gather, "Right", V(-0.12, 0.03, 0.36)), g, "free", V(0.55, -0.55, -0.6))
    cast = body(lean=10, twist=16, crouch=0.012, shift=(0, -0.02), nod=-3)
    off(arm(cast, "Right", V(-0.06, -1, 0.1)), g, "support", V(0.6, 0.45, -0.65))
    follow = body(lean=6, twist=12, crouch=0.01, shift=(0, -0.015))
    off(arm(follow, "Right", V(-0.06, -1, 0.02)), g, "support", V(0.6, 0.45, -0.65))
    return [(0, N, "lin"), (0.22, gather, "io"), (0.36, cast, "back"), (0.62, follow, "lin"), (1.0, N, "io")]


@verb("CastUp", 0.8, 0.42, True)
def v_cast_up(g):
    gather = body(crouch=0.035, lean=12, nod=10)
    off(hand(gather, "Right", V(-0.06, -0.12, 0.32)), g, "gather")
    up = body(lean=-10, nod=-16, crouch=-0.01)
    off(arm(up, "Right", V(-0.45, -0.45, 0.77), V(-0.3, -0.4, 0.86)), g, "free", V(0.7, 0.2, -0.68))
    follow = body(lean=-6, nod=-10)
    off(arm(follow, "Right", V(-0.5, -0.4, 0.75), V(-0.38, -0.36, 0.85)), g, "free", V(0.7, 0.2, -0.68))
    return [(0, N, "lin"), (0.26, gather, "io"), (0.42, up, "back"), (0.7, follow, "lin"), (1.0, N, "io")]


OVERHEAD = (V(-0.6, 0.15, 0.78), V(-0.55, 0.1, 0.83))               # the lead arm raised up and out, clear of the head
LOW = (V(-0.12, -0.75, -0.65), V(-0.05, -0.85, -0.5))                # down and forward: where a slam lands


@verb("Slam", 0.9, 0.44, False)
def v_slam(g):
    wind = body(crouch=-0.01, lean=-12, nod=-10, twist=-8)
    off(arm(wind, "Right", *OVERHEAD), g, "two", V(0.6, 0.3, -0.75))
    slam = body(crouch=0.06, lean=26, nod=12, twist=6, shift=(0, -0.02))
    off(arm(slam, "Right", *LOW), g, "two", V(0.55, 0.4, -0.73))
    hold_ = body(crouch=0.055, lean=24, nod=10, twist=5, shift=(0, -0.02))
    off(arm(hold_, "Right", *LOW), g, "two", V(0.55, 0.4, -0.73))
    return [(0, N, "lin"), (0.3, wind, "back"), (0.44, slam, "in"), (0.64, hold_, "lin"), (1.0, N, "io")]


@verb("Thrust", 0.6, 0.34, True)
def v_thrust(g):
    cock = body(twist=-26, lean=-4, crouch=0.02)
    off(hand(cock, "Right", V(-0.14, 0.07, 0.40)), g, "two", V(0.55, -0.6, -0.55))
    lunge = body(twist=22, lean=14, crouch=0.035, shift=(0, -0.035))
    off(arm(lunge, "Right", V(-0.04, -1, 0.04)), g, "two", V(0.6, 0.5, -0.6))
    lunge2 = body(twist=18, lean=12, crouch=0.03, shift=(0, -0.03))
    off(arm(lunge2, "Right", V(-0.04, -1, 0.0)), g, "two", V(0.6, 0.5, -0.6))
    return [(0, N, "lin"), (0.2, cock, "io"), (0.34, lunge, "back"), (0.55, lunge2, "lin"), (1.0, N, "io")]


def spin_pose(g, yaw, crouch, arm_in=0.0):
    P = body(hips=rz(yaw), crouch=crouch)
    out = rz(yaw) @ V(-0.95, -0.25 - arm_in, 0.05 - 0.6 * arm_in)
    arm(P, "Right", out)
    return off(P, g, "two", rz(yaw) @ V(0.45, -0.5, -0.75))


def yaw_of(P):
    f = P.q("Hips") @ V(0, -1, 0)
    return math.degrees(math.atan2(f.x, -f.y))


def spin_post(P, p, flip):
    """The feet turn with the body (planted at the ankles' rest points turned by the hips' yaw)."""
    Q = rz(yaw_of(P))
    for s, sx in SIDES:
        P.ik(f"{s}UpLeg", f"{s}Leg", Q @ ANKLE[s], Q @ V(sx * 0.25, -1, 0))
        P.world(f"{s}Foot", Q.copy())
        P.R[f"{s}ToeBase"] = Quaternion()
    return P


@verb("Spin", 0.8, 0.3, False, post=spin_post)
def v_spin(g):
    """One full turn, the lead arm out: it crosses the front at a quarter turn (the impact) and sweeps all round."""
    wind = body(twist=-30, crouch=0.03, lean=6)
    off(arm(wind, "Right", V(-0.7, 0.55, -0.45)), g, "two", V(0.5, -0.7, -0.5))
    turn = [(t, spin_pose(g, 90 * k, 0.045), "in" if k == 1 else "lin") for k, t in zip(range(1, 5), (0.3, 0.4, 0.5, 0.6))]
    settle = spin_pose(g, 360, 0.04, arm_in=0.5)
    return [(0, N, "lin"), (0.16, wind, "io"), *turn, (0.76, settle, "out"), (1.0, N, "io")]


def leap_post(P, p, flip):
    return plant(P, lift=lift_of(P, 1.4))


@verb("LeapStrike", 1.0, 0.56, False, post=leap_post)
def v_leap_strike(g):
    crouch = body(crouch=0.07, lean=22, nod=10)
    off(arm(crouch, "Right", V(-0.5, 0.55, -0.67)), g, "free", V(0.5, 0.55, -0.67))
    rise = body(crouch=-0.12, lean=-8, nod=-10)
    off(arm(rise, "Right", *OVERHEAD), g, "two", V(0.85, -0.1, 0.2))
    apex = body(crouch=-0.14, lean=-4, nod=-6)
    off(arm(apex, "Right", *OVERHEAD), g, "two", V(0.85, -0.1, 0.2))
    strike = body(crouch=0.075, lean=28, nod=14, shift=(0, -0.02))
    off(arm(strike, "Right", *LOW), g, "two", V(0.55, 0.4, -0.73))
    hold_ = body(crouch=0.065, lean=26, nod=12, shift=(0, -0.02))
    off(arm(hold_, "Right", *LOW), g, "two", V(0.55, 0.4, -0.73))
    return [(0, N, "lin"), (0.2, crouch, "io"), (0.36, rise, "out"), (0.46, apex, "io"), (0.56, strike, "in"), (0.72, hold_, "lin"), (1.0, N, "io")]


@verb("Throw", 0.7, 0.4, True)
def v_throw(g):
    cock = body(twist=-30, lean=-8, side=4, nod=-4)
    off(arm(cock, "Right", V(-0.55, 0.6, 0.55), V(-0.3, 0.2, 0.93)), g, "free", V(0.3, -0.9, 0.3))
    release = body(twist=26, lean=16, crouch=0.025, shift=(0, -0.025))
    off(arm(release, "Right", V(-0.1, -0.95, -0.15)), g, "free", V(0.55, 0.5, -0.65))
    follow = body(twist=30, lean=18, crouch=0.03, shift=(0, -0.025))
    off(arm(follow, "Right", V(0.25, -0.85, -0.45)), g, "free", V(0.55, 0.5, -0.65))
    return [(0, N, "lin"), (0.24, cock, "io"), (0.4, release, "back"), (0.6, follow, "lin"), (1.0, N, "io")]


@verb("Summon", 0.9, 0.46, True)
def v_summon(g):
    gather = body(crouch=0.03, lean=10, nod=10)
    off(hand(gather, "Right", V(-0.04, -0.13, 0.34)), g, "gather")
    spread = body(lean=-8, nod=-14, crouch=-0.01)
    off(arm(spread, "Right", V(-0.75, -0.35, 0.55), V(-0.6, -0.45, 0.65)), g, "spread", V(0.75, -0.35, 0.55), V(0.6, -0.45, 0.65))
    hold_ = body(lean=-6, nod=-10)
    off(arm(hold_, "Right", V(-0.75, -0.35, 0.5), V(-0.62, -0.45, 0.6)), g, "spread", V(0.75, -0.35, 0.5), V(0.62, -0.45, 0.6))
    return [(0, N, "lin"), (0.26, gather, "io"), (0.46, spread, "back"), (0.72, hold_, "lin"), (1.0, N, "io")]


HOLD_SPAN = (0.2, 0.8)                                               # a hold verb loops seamlessly between these phases


def tremble(P, p, k=3, amount=1.5):
    if HOLD_SPAN[0] < p < HOLD_SPAN[1]:
        s = math.sin(TAU * k * (p - HOLD_SPAN[0]) / (HOLD_SPAN[1] - HOLD_SPAN[0]))
        P.rot("Spine2", rz(amount * s))
        P.loc.z += 0.003 * abs(s)
    return P


@verb("Channel", 1.2, 0.2, True, post=lambda P, p, flip: plant(tremble(P, p)), hold=HOLD_SPAN)
def v_channel(g):
    ch = body(crouch=0.02, lean=8, nod=4)
    off(arm(ch, "Right", V(-0.08, -1, 0.14), V(-0.04, -1, 0.18)), g, "support", V(0.55, -0.5, -0.65))
    return [(0, N, "lin"), (0.2, ch, "back"), (0.8, ch, "lin"), (1.0, N, "io")]


@verb("Guard", 1.0, 0.2, True, post=lambda P, p, flip: plant(tremble(P, p, k=2, amount=0.8)), hold=HOLD_SPAN)
def v_guard(g):
    P = body(crouch=0.03, lean=6, nod=6, twist=-6)
    if g.name == "Fists":
        hand(P, "Right", chest(P, GUARD_R), V(-0.6, 0.5, -1))
        off(P, g, "guard")
    elif g.name == "OneHand":                                      # sword and board: the shield arm up in front, the blade back
        arm(P, "Right", V(-0.5, 0.3, -0.8), V(-0.3, -0.7, -0.2))
        arm(P, "Left", V(0.4, -0.7, -0.35), V(-0.55, -0.55, 0.55))
    else:
        arm(P, "Right", V(-0.4, -0.7, -0.35), V(0.55, -0.55, 0.55))   # the weapon held across the chest
        off(P, g, "two", V(0.55, -0.5, -0.67))
    return [(0, N, "lin"), (0.2, P, "back"), (0.8, P, "lin"), (1.0, N, "io")]


def kick_post(P, p, flip):
    return plant_one(P, "Left" if flip > 0 else "Right")


@verb("Kick", 0.7, 0.36, False, post=kick_post)
def v_kick(g):
    chamber = body(lean=-6, crouch=0.01, shift=(0.02, 0), side=-4)
    chamber.ik("RightUpLeg", "RightLeg", V(-0.06, -0.06, 0.15), V(0, -1, 0.3)).aim("RightFoot", V(0, -0.5, -0.85))
    off(arm(chamber, "Right", V(-0.6, 0.3, -0.75)), g, "free", V(0.6, -0.5, -0.6))
    kick = body(lean=-14, crouch=0.012, shift=(0.025, 0.02), side=-5)
    kick.ik("RightUpLeg", "RightLeg", V(-0.06, -0.225, 0.21), V(0, -0.3, 1)).aim("RightFoot", V(0, -0.35, 0.94))
    off(arm(kick, "Right", V(-0.65, 0.45, -0.6)), g, "free", V(0.65, -0.3, -0.7))
    retract = chamber.copy()
    return [(0, N, "lin"), (0.18, chamber, "io"), (0.36, kick, "back"), (0.55, retract, "io"), (1.0, N, "io")]


@verb("Sweep", 0.75, 0.42, False)
def v_sweep(g):
    wind = body(twist=-36, crouch=0.04, lean=10, side=-4)
    off(arm(wind, "Right", V(-0.75, 0.5, -0.45)), g, "two", V(0.5, -0.7, -0.5))
    sweep = body(twist=10, crouch=0.07, lean=24, shift=(0, -0.02))
    off(arm(sweep, "Right", V(-0.2, -0.95, -0.25)), g, "two", V(0.6, 0.45, -0.65))
    follow = body(twist=36, crouch=0.06, lean=20, shift=(0, -0.015))
    off(arm(follow, "Right", V(0.55, -0.75, -0.35)), g, "two", V(0.6, 0.5, -0.6))
    return [(0, N, "lin"), (0.24, wind, "io"), (0.42, sweep, "in"), (0.56, follow, "out"), (1.0, N, "io")]


@verb("Plant", 0.8, 0.42, False)
def v_plant(g):
    raise_ = body(crouch=-0.005, lean=-6, nod=-6)
    off(arm(raise_, "Right", V(-0.3, -0.55, 0.78), V(-0.25, -0.6, 0.76)), g, "two", V(0.6, -0.3, -0.75))
    plant_ = body(crouch=0.075, lean=30, nod=14)
    off(arm(plant_, "Right", V(-0.15, -0.45, -0.88), V(-0.1, -0.35, -0.93)), g, "two", V(0.45, -0.6, -0.66))
    hold_ = body(crouch=0.07, lean=28, nod=12)
    off(arm(hold_, "Right", V(-0.15, -0.45, -0.88), V(-0.1, -0.35, -0.93)), g, "two", V(0.45, -0.6, -0.66))
    return [(0, N, "lin"), (0.26, raise_, "io"), (0.42, plant_, "in"), (0.66, hold_, "lin"), (1.0, N, "io")]


def aim_draw(g, draw, lean=0.0, recoil=0.0):
    """The bow stance (AttackBow's, right-handed): the lead arm out to the target, the off hand drawing to the chin."""
    P = body(hips=rz(-35), twist=-10, turn=42, lean=lean)
    arm(P, "Right", V(-0.1, -1, 0.1 + recoil))
    w = P.head("RightHand")
    return off(P, g, "draw", at=w.lerp(V(0.11, 0.05, 0.46), draw) + V(0.03, 0.02, 0.02) * (1 - draw))


@verb("DrawShot", 1.0, 0.66, True)
def v_draw_shot(g):
    rel = aim_draw(g, 1.0, lean=-4, recoil=0.1)
    if g.mode("draw") == "draw":
        hand(rel, "Left", V(0.18, 0.09, 0.47))
    return [(0, N, "lin"), (0.22, aim_draw(g, 0.0), "back"), (0.34, aim_draw(g, 0.5, lean=-1.5), "io"), (0.45, aim_draw(g, 1.0, lean=-3), "io"),
            (0.62, aim_draw(g, 1.0, lean=-3), "lin"), (0.68, rel, "out"), (1.0, N, "io")]


@verb("QuickShot", 0.45, 0.16, True)
def v_quick_shot(g):
    aim_ = body(twist=12, lean=4)
    off(arm(aim_, "Right", V(-0.05, -1, 0.12)), g, "support", V(0.55, -0.5, -0.65))
    recoil = body(twist=12, lean=-2, nod=-3)
    off(arm(recoil, "Right", V(-0.05, -0.88, 0.45)), g, "support", V(0.55, -0.5, -0.65))
    return [(0, N, "lin"), (0.16, aim_, "out"), (0.26, recoil, "out"), (0.42, aim_, "io"), (1.0, N, "io")]


@verb("Backstep", 0.55, 0.3, False, post=lambda P, p, flip: plant(P, lift=lift_of(P, 1.5)))
def v_backstep(g):
    crouch = body(crouch=0.05, lean=14, nod=8)
    off(arm(crouch, "Right", V(-0.25, -0.85, -0.45)), g, "free", V(0.6, 0.3, -0.75))
    air = body(crouch=-0.06, lean=10, nod=4, shift=(0, 0.03))
    off(arm(air, "Right", V(-0.4, -0.7, 0.1)), g, "free", V(0.8, 0.2, 0.1))
    land = body(crouch=0.06, lean=16, nod=10)
    off(arm(land, "Right", V(-0.25, -0.85, -0.45)), g, "free", V(0.6, 0.3, -0.75))
    land2 = body(crouch=0.045, lean=12, nod=8)
    off(arm(land2, "Right", V(-0.25, -0.85, -0.45)), g, "free", V(0.6, 0.3, -0.75))
    return [(0, N, "lin"), (0.16, crouch, "io"), (0.3, air, "out"), (0.5, land, "in"), (0.68, land2, "io"), (1.0, N, "io")]


def hold_idle(g, b):
    """The weapon held over locomotion (the engine lays the arms only, like HoldTool), authored right-handed."""
    P = body()
    if g.name == "Fists":
        hand(P, "Right", chest(P, GUARD_R) + V(0, 0, b), V(-0.6, 0.5, -1))
        hand(P, "Left", chest(P, GUARD_L) + V(0, 0, b), V(0.6, 0.5, -1))
    elif g.name == "Book":
        hand(P, "Left", chest(P, BOOK) + V(0, 0, b))
    else:
        target, pole = {"OneHand": (V(-0.15, -0.085, 0.34), V(-1, 0.7, -0.3)), "Staff": (V(-0.135, -0.075, 0.37), V(-1, 0.6, -0.3)),
                        "Bow": (V(-0.15, -0.06, 0.33), V(-1, 0.6, -0.3)), "Pistol": (V(-0.12, -0.12, 0.36), V(-1, 0.5, -0.4))}[g.name]
        hand(P, "Right", target + V(0, 0, b), pole)
    return mirror_pose(P) if g.mirror else P


# Per-subclass unique clips (the family waves): the ult clip `Ult_<Subclass>` and up to 3 `Unique_<Name>` ability
# clips, each authored once for its subclass's grip with the same key programs (and `impact` at the ult's impact key,
# where the engine holds the freeze), baked into the same GLB and catalogue.
UNIQUE_DEFS = []


def unique(name, grip, seconds, impact, upper=False, post=None):
    def deco(fn):
        UNIQUE_DEFS.append(dict(verb=name, grip=grip, seconds=seconds, impact=impact, upper=upper, fn=fn, post=post, hold=None))
        return fn
    return deco


def verb_clips():
    """Every verb for every grip, the hold idles, then the subclasses' unique clips, as bake() dicts."""
    out = []
    grip_by = {g.name: g for g in GRIPS_V}
    for v in UNIQUE_DEFS:
        g = grip_by[v["grip"]]
        out.append(one_clip(v["verb"], v, g))
    return [*grip_clips(), *out]


def one_clip(name, v, g):
    K = v["fn"](g)
    if g.mirror:
        K = [(t, P if P is N else mirror_pose(P), e) for t, P, e in K]
    post = v["post"] or (lambda P, p, flip: plant(P))
    return dict(name=name, frames=round(v["seconds"] * FPS), loop=False, ground=None,
                fn=(lambda K, post, flip: lambda p: post(keys(p, K), p, flip))(K, post, -1 if g.mirror else 1),
                meta=dict(verb=v["verb"], grip=g.name, hand=g.hand, upper=v["upper"], impact=v["impact"], **({"hold": list(v["hold"])} if v["hold"] else {})))


def grip_clips():
    out = []
    for g in GRIPS_V:
        for v in VERB_DEFS:
            out.append(one_clip(f"{v['verb']}_{g.name}", v, g))
        out.append(dict(name=f"HoldIdle_{g.name}", frames=60, loop=True, ground=None,
                        fn=(lambda g: lambda p: plant(hold_idle(g, 0.004 * math.sin(TAU * p))))(g),
                        meta=dict(verb="HoldIdle", grip=g.name, hand=g.hand, upper=True, impact=0)))
    return out


# ================================================================ bake, ground, check
MESHES = [bpy.data.objects[n] for n in ("V6_Body", HEAD_OB)]


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


def contacts(action, frames):
    """Foot contacts of a locomotion loop as phases [left, right]: where each foot comes down to the ground (its lowest
    tenth of travel, interpolated between frames). The engine kicks the footstep there (specs/movement-feel.md)."""
    rig.animation_data.action = action
    zs = {s: [] for s, _ in SIDES}
    for f in range(frames):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        for s, _ in SIDES:
            zs[s].append((rig.matrix_world @ rig.pose.bones[f"{P_}{s}Foot"].head).z)
    out = []
    for s, _ in SIDES:
        z = zs[s]
        lo, hi = min(z), max(z)
        line = lo + 0.1 * (hi - lo)
        for f in range(frames):
            a, b = z[f - 1], z[f]
            if a > line >= b:
                out.append(round(((f - 1) % frames + (a - line) / (a - b)) / frames, 4))
                break
    return out


EVIDENCE = os.path.join(HERE, "..", "..", "..", "specs", "evidence", "classes", "K0-verbs.webp")
CAM = (-1.35, -2.1, 0.62)                                # the lead (right) side, three-quarter front
if "side" in ARGS:                                       # a review angle: from the right, straight on (not the evidence)
    CAM, EVIDENCE = (-2.5, 0.0, 0.5), "/tmp/K0-verbs-side.webp"


def render_verb_evidence(cat):
    """K0-verbs.webp: the 16 verbs for OneHand and Staff at their impact frame, and Slam_OneHand's anticipation,
    impact and follow-through. Rendered here from the baked actions on the body this build loaded."""
    import subprocess, tempfile
    tmp = tempfile.mkdtemp(prefix="verbs_ev_")
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = sc.render.resolution_y = 256
    sc.render.film_transparent = False
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value, bg.inputs[1].default_value = (0.78, 0.86, 0.86, 1), 0.9
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.2
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type, cam.data.ortho_scale = "ORTHO", 1.55
    cam.location = Vector(CAM)
    cam.rotation_euler = (Vector((0, 0, 0.47)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(cam)
    sc.camera = cam
    kit.show_vertex_colors(sc)
    by = {c["name"]: c for c in cat}
    shots = [(f"{v['verb']}_{g}", by[f"{v['verb']}_{g}"]["impact"], v["verb"]) for g in ("OneHand", "Staff") for v in VERB_DEFS]
    shots += [("Slam_OneHand", t, f"Slam {k}") for t, k in ((0.3, "anticipation"), (0.44, "impact"), (0.64, "follow"))]
    files = []
    for i, (name, phase, label) in enumerate(shots):
        rig.animation_data.action = bpy.data.actions[name]
        sc.frame_set(round(phase * by[name]["frames"]))
        sc.render.filepath = os.path.join(tmp, f"{i:03d}.png")
        bpy.ops.render.render(write_still=True)
        files += ["-label", f"{name.split('_')[1]} {label}" if i < 32 else label, sc.render.filepath]
    os.makedirs(os.path.dirname(EVIDENCE), exist_ok=True)
    sheet = os.path.join(tmp, "sheet.png")
    subprocess.run(["magick", "montage", *files, "-tile", "8x", "-geometry", "+4+4", "-background", "#1b1f27", "-fill", "#f1ffff",
                    "-pointsize", "13", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf", sheet], check=True)
    subprocess.run(["magick", sheet, "-quality", "88", EVIDENCE], check=True)
    print("wrote", EVIDENCE)


if VERBS_MODE:
    verbs = verb_clips()
    cat = []
    for c in verbs:
        bake(c)
        worst, lowest = check(c["name"], c["frames"])
        m = c["meta"]
        cat.append({"name": c["name"], "verb": m["verb"], "grip": m["grip"], "length": round(c["frames"] / FPS, 3), "loop": c["loop"],
                    "frames": c["frames"], "hand": m["hand"], "upper": m["upper"], "impact": m["impact"], **({"hold": m["hold"]} if "hold" in m else {})})
        print(f"VERB {c['name']:20s} {c['frames'] / FPS:4.2f}s head_intrusion={worst:5.3f} min_z={lowest:+.3f}")
    keep = {c["name"] for c in verbs}
    for a in list(bpy.data.actions):                     # Idle and Walk ship in the village set, not here
        if a.name not in keep:
            bpy.data.actions.remove(a)
    rig.animation_data.action = bpy.data.actions[verbs[0]["name"]]
    sc.frame_set(0)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "v7_verbs.glb"), export_format="GLB", use_selection=True, export_yup=True,
        export_skins=True, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_leaf_bone=False, export_optimize_animation_size=True)
    kit.update_catalog("verbs", {"glb": "base/v7_verbs.glb", "fps": FPS,
                                 "note": "The verb library (classes v2, design sheet 1.8): the rig and its actions only, loaded in the ruins. "
                                         "impact = phase of the hit key; upper = can play on the upper body; hold = the phase span a held verb loops.",
                                 "clips": cat})
    print("VERBS_OK", len(cat))
    if "evidence" in ARGS:
        render_verb_evidence(cat)
else:
    catalog = [{"name": "Idle", "length": 2.0, "loop": True, "frames": 60, "source": "v6"},
               {"name": "Walk", "length": 1.0, "loop": True, "frames": 30, "source": "v6", "contacts": contacts(bpy.data.actions["Walk"], 30)}]
    for c in CLIPS:
        act = bake(c)
        worst, lowest = check(c["name"], c["frames"])
        meta = {k: v for k, v in c["meta"].items() if k != "ground_w"}
        catalog.append({"name": c["name"], "length": round(c["frames"] / FPS, 3), "loop": c["loop"], "frames": c["frames"],
                        **({} if c["loop"] else {"endsNeutral": meta.pop("endsNeutral", "endsOn" not in meta)}), **meta,
                        **({"contacts": contacts(act, c["frames"])} if c["name"] in ("Run", "CrouchWalk") else {})})
        print(f"CLIP {c['name']:12s} {c['frames'] / FPS:4.2f}s loop={c['loop']!s:5s} head_intrusion={worst:5.3f} min_z={lowest:+.3f}")

    rig.animation_data.action = bpy.data.actions["Idle"]
    sc.frame_set(0)
    for o in sc.objects:
        if o.type == "MESH" and o.data.color_attributes:
            o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index   # export COLOR_0
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, OUT_GLB), export_format="GLB", use_selection=True, export_yup=True,
        export_normals=True, export_texcoords=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_skins=True, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_leaf_bone=False, export_optimize_animation_size=True)
    kit.update_catalog("base", {"glb": "base/v6.glb", "clips_glb": f"base/{OUT_GLB}", "fps": FPS,
                                **({"head": "v7/head.blend"} if HEAD == "v7" else {}),
                                "note": f"{OUT_GLB} = the v6 base body (tee + shorts + default hair) with every clip"
                                        + (", and the hand-modeled v7 head (avatar v7)" if HEAD == "v7" else "") + ". Sit/Study "
                                        "sit on a seat at seatHeight; Sleep/Defeat lie on the back with the head toward the "
                                        "character's back (+Y Blender, -Z glTF). hand = the socket that holds the weapon."})
    kit.update_catalog("clips", catalog)
    print("CLIPS_OK", len(catalog))
