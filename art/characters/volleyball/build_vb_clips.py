"""Beach volleyball clips on the game's own rig -> web/public/assets/characters/v6/base/vb_clips.glb + the contract clips.ts.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/characters/volleyball/build_vb_clips.py [-- evidence [names]]

The pose kit (Pose, body, hand, arm, legs, plant, keys, bake, check) is build_clips.py's, run with `-- head v8 lib` so the
body, rig and v8 head are exactly the ones v8_clips.glb ships. Every clip here is keyed as key poses in armature space
(Blender: up +Z, the character faces -Y, its left is +X; 1 rig m = 1.3 game units) and baked every frame at 30 fps.

Conventions (specs/lanes/vb-anim.md, the contract web/lib/game/volleyball/clips.ts):
- One-shots start and end on vb_ready's first frame, so they cross into each other and back to the stance cleanly.
  The air clips (vb_spike_hit, vb_serve_hit, vb_block, vb_jump_set) start on vb_spike_jump's apex pose instead.
- In place: the movement sim moves and lifts the root (runs, jumps, the dive's lunge); the clips pose the body. The
  celebrations' little hops are the clip's own (the sim doesn't jump for an emote).
- The meta of each clip (seconds): contact (the ball touches the hands), takeoff (feet leave the sand), apex, land (feet
  back on the sand), down/up (the dive on and off the sand). The export writes them, with the hand's place at contact
  measured from the baked frame, into web/lib/game/volleyball/clips.ts (the contract; clips.test.ts checks it against the GLB).
- Checks per clip: hands inside the head, sinking under the sand, the worst bone turn between frames (limb pops), feet
  sliding while planted, the loop seam, and one-shots' ends against vb_ready.
"""
import math
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
MY_ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
sys.argv = [sys.argv[0], "--", "head", "v8", "lib"]
globals().update(runpy.run_path(os.path.join(HERE, "..", "base", "build_clips.py")))   # the pose kit, rig and v8 body
import bpy  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

OUT_GLB = os.path.join(ROOT, "web", "public", "assets", "characters", "v6", "base", "vb_clips.glb")
OUT_TS = os.path.join(ROOT, "web", "lib", "game", "volleyball", "clips.ts")
EVIDENCE = os.path.join(ROOT, "specs", "evidence", "vb-anim")
GAME = 1.3                                              # game units per rig metre (Character.tsx CHARACTER_SCALE)
SX = dict(SIDES)
VB = []


def vb_clip(name, seconds, loop, ground=None, **meta):
    def deco(fn):
        VB.append(dict(name=name, frames=round(seconds * FPS), loop=loop, fn=fn, ground=ground, meta=meta))
        return fn
    return deco


# ================================================================ small helpers on top of the kit
def girdle(P, up=0.0, fwd=0.0, side=None):
    """The shoulder blades: up raises the shoulder (a shrug), fwd rolls it forward (both arms in for the platform)."""
    for s, sx in SIDES:
        if side in (None, s):
            P.rot(f"{s}Shoulder", rz(-sx * fwd) @ ry(-sx * up))
    return P


def wrist(P, s, off, pole=None):
    """The wrist at an offset from its own shoulder joint (x outward for either side, y forward is -y, z up)."""
    sx = SX[s]
    return hand(P, s, P.head(f"{s}Arm") + V(sx * off[0], off[1], off[2]), pole)


def both(P, off, pole=None, fn=None):
    for s, sx in SIDES:
        (fn or wrist)(P, s, off, pole and V(sx * pole[0], pole[1], pole[2]))
    return P


def arms(P, upper, fore=None):
    """Both arms along mirrored world directions (given for the left arm)."""
    for s, sx in SIDES:
        arm(P, s, V(sx * upper[0], upper[1], upper[2]), fore and V(sx * fore[0], fore[1], fore[2]))
    return P


def hands_aim(P, d, sides=("Left", "Right")):
    for s in sides:
        P.aim(f"{s}Hand", V(SX[s] * d[0], d[1], d[2]))
    return P


def planted(P, w=1.0, **kw):
    """plant() faded in by w: 1 = both feet flat on their marks, 0 = the legs as keyed (in the air)."""
    if w <= 0:
        return P
    Q = plant(P.copy(), **kw)
    return Q if w >= 1 else mix(P, Q, w)


def ramp(p, a, b):
    """0 before a, 1 after b, smooth between."""
    return ss(a, b, p) if b > a else float(p >= a)


def window(p, on0, on1, off0, off1):
    """Weight that rises over [on0, on1] and falls over [off0, off1]."""
    return ramp(p, on0, on1) * (1 - ramp(p, off0, off1))


# ================================================================ the stance
STANCE = {"Left": V(0.112, -0.012, ANKLE["Left"].z), "Right": V(-0.112, 0.02, ANKLE["Right"].z)}   # wide, right foot back a touch


def ready_pose(bob=0.0, sway=0.0, arm_bob=0.0, look=0.0):
    """Knees bent and out, hips back and low, chest over the toes, forearms out in front, eyes up the court."""
    P = body(crouch=0.085 + bob, lean=10, nod=-26 + look, shift=(sway, 0.026), hips=rx(16), side=-sway * 120)
    girdle(P, up=6, fwd=12)
    both(P, (0.03, -0.115, -0.075 + arm_bob), pole=(0.8, 0.4, -0.6))
    hands_aim(P, (-0.2, -0.85, -0.35))
    return P


def stand(P, w=1.0):
    return planted(P, w, ankles=STANCE, knees_out=0.5)


def ready_at(p):
    """Two small split-step bounces a loop, a slow weight shift, the arms riding a beat behind."""
    c2, s1 = math.cos(2 * TAU * p), math.sin(TAU * p)
    return stand(ready_pose(bob=0.01 * (1 - c2) * 0.5, sway=0.006 * s1, arm_bob=0.014 * (1 - math.cos(2 * TAU * (p - 0.06))) * 0.5,
                            look=2 * math.sin(2 * TAU * p)))


READY = ready_at(0.0)


@vb_clip("vb_ready", 1.2, True)
def vb_ready(p):
    return ready_at(p)


# ================================================================ the side shuffle (to the character's right; vb_shuffle_left mirrors it)
SHUF_STRIDE, SHUF_BETA, SHUF_LIFT = 0.2, 0.62, 0.05     # rig m per loop, stance share, foot lift


def shuffle_foot(p, centre, offset):
    """In place: a planted foot slides back (+x) at the body's speed; the swing carries it out ahead (-x)."""
    u = (p - offset) % 1.0
    if u < SHUF_BETA:
        return V(centre + SHUF_STRIDE * (u - SHUF_BETA / 2), 0, 0)
    v = EASE["io"]((u - SHUF_BETA) / (1 - SHUF_BETA))
    return V(centre + SHUF_STRIDE * (SHUF_BETA / 2 - SHUF_BETA * v), 0, SHUF_LIFT * math.sin(math.pi * v))


@vb_clip("vb_shuffle", 0.5, True, stride=SHUF_STRIDE * GAME)
def vb_shuffle(p):
    """Step out with the right foot, close with the left, push: low, hips level, chest square to the net."""
    r = shuffle_foot(p, STANCE["Right"].x - 0.02, 0.0)            # the lead: swings 0.62 to 1.0
    l = shuffle_foot(p, STANCE["Left"].x + 0.02, 0.38)           # the trail: swings 0.0 to 0.38
    mid = (r.x + l.x) / 2
    bob = 0.012 * (0.5 + 0.5 * math.cos(2 * TAU * (p - 0.2)))    # low on the two landings, up in the swings
    P = ready_pose(bob=0.012 - bob + 0.004, sway=mid * 0.35, arm_bob=0.01 * math.sin(2 * TAU * p))
    P.rot("Spine", ry(-3))
    ank = {"Left": V(l.x, STANCE["Left"].y, STANCE["Left"].z + l.z), "Right": V(r.x, STANCE["Right"].y, STANCE["Right"].z + r.z)}
    return plant(P, ankles=ank, knees_out=0.45)


# ================================================================ the bump: platform arms, the legs do the work
def platform(P, lift=0.0):
    """Straight arms angled down in front, wrists together, shoulders rolled in; lift tips the platform up a little."""
    girdle(P, up=4 + lift * 0.5, fwd=28)
    both(P, (-0.105, -0.115, -0.118 + lift * 0.0016), pole=(0.6, 0.1, -1))
    hands_aim(P, (-0.35, -0.65, -0.67 + lift * 0.012))
    return P


def bump_keys():
    form = stand(platform(body(crouch=0.11, lean=12, nod=-24, shift=(0, 0.03), hips=rx(20))))
    low = stand(platform(body(crouch=0.122, lean=13, nod=-26, shift=(0, 0.032), hips=rx(22)), lift=2))
    drive = stand(platform(body(crouch=0.04, lean=6, nod=-26, shift=(0, 0.012), hips=rx(8)), lift=10))       # contact
    rise = stand(platform(body(crouch=0.02, lean=4, nod=-28, shift=(0, 0.006), hips=rx(4)), lift=18))
    hold = stand(platform(body(crouch=0.035, lean=6, nod=-24, shift=(0, 0.01), hips=rx(8)), lift=12))
    return [(0, READY, "lin"), (0.16, form, "io"), (0.26, low, "io"), (0.36, drive, "out"), (0.5, rise, "out"), (0.66, hold, "io"),
            (1.0, READY, "io")]


BUMP = bump_keys()


@vb_clip("vb_bump", 1.0, False, contact=0.36, hand="both", at="wrists")
def vb_bump(p):
    return stand(keys(p, BUMP))


# ================================================================ the set: hands make the window in front of the brow, legs and arms extend
# The arms are short and the head is big: raised hands must sit outside the head's silhouette (out to the sides or in
# front of the face), or they vanish behind it at the game camera's distance.
def window_hands(P, ext=0.0, open_=0.0):
    """Elbows out wide, wrists up beside the face, fingers in toward each other; ext pushes them up and forward."""
    girdle(P, up=20 + 12 * ext, fwd=10)
    both(P, (0.075 + 0.015 * open_, -0.11 - 0.025 * ext, 0.07 + 0.045 * ext), pole=(1, 0.2, -0.3))
    hands_aim(P, (-0.45 + 0.25 * open_, -0.35 - 0.25 * ext, 0.82 - 0.08 * ext))
    return P


def set_keys():
    load = stand(window_hands(body(crouch=0.1, lean=-2, nod=-30, hips=rx(14), shift=(0, 0.012))))
    contact = stand(window_hands(body(crouch=0.025, lean=-6, nod=-32, hips=rx(4)), ext=0.6))
    follow = stand(window_hands(body(crouch=-0.004, lean=-6, nod=-28, hips=rx(0)), ext=1.0, open_=1.0))
    down = stand(arms(body(crouch=0.035, lean=4, nod=-24, hips=rx(8)), (0.55, -0.35, -0.76), (0.4, -0.75, -0.52)))
    return [(0, READY, "lin"), (0.22, load, "io"), (0.36, contact, "out"), (0.52, follow, "out"), (0.74, down, "io"), (1.0, READY, "io")]


SET = set_keys()


@vb_clip("vb_set", 1.1, False, contact=0.4, hand="both")
def vb_set(p):
    P = keys(p, SET)
    return stand(planted(P, 1.0, ankles=STANCE, knees_out=0.5, lift=0.012 * window(p, 0.36, 0.48, 0.55, 0.7)))


# ================================================================ the court jump: approach takeoff, arms back then up, the floaty hang
def landing():
    """Down in a deep squat on the sand, arms forward for balance, chest up so the big head stays over the feet."""
    P = body(crouch=0.12, lean=12, nod=-20, shift=(0, 0.03), hips=rx(14))
    arms(P, (0.6, -0.55, -0.58), (0.45, -0.82, -0.35))
    return stand(P)


LAND = landing()


def air_legs(P, thigh, knee, foot=34, splay=6.0):
    return legs(P, thigh, knee, splay=splay, foot=foot)


def cocked(P):
    """Bow and arrow: the right elbow up and back with the hand behind the ear; the left arm points up at the ball."""
    girdle(P, up=24, side="Right")
    girdle(P, up=18, side="Left")
    arm(P, "Right", V(-0.82, 0.45, 0.36), V(-0.7, 0.3, 0.65))
    arm(P, "Left", V(0.8, -0.45, 0.4), V(0.72, -0.55, 0.42))
    P.aim("RightHand", V(-0.45, 0.0, 0.89))
    P.aim("LeftHand", V(0.65, -0.6, 0.46))
    return P


def apex_pose(drift=0.0):
    P = body(lean=-6 - 3 * drift, twist=-32, side=5, nod=-16, turn=22, hips=rx(-4))   # chest turned right, eyes on the ball
    air_legs(P, (-10, 6), (86, 66), foot=38)
    return cocked(P)


APEX = apex_pose()


def spike_jump_keys():
    load = body(crouch=0.11, lean=14, nod=-20, shift=(0, 0.035), hips=rx(16))
    girdle(load, up=16, fwd=-12)
    arms(load, (0.35, 0.68, 0.5), (0.24, 0.76, 0.48))                                 # arms swung back high
    load = stand(load)
    drop = body(crouch=0.105, lean=12, nod=-21, shift=(0, 0.03), hips=rx(14))
    arms(drop, (0.32, 0.4, -0.86), (0.22, 0.45, -0.86))                              # arms falling past the hips
    drop = stand(drop)
    swing = body(crouch=0.095, lean=10, nod=-22, shift=(0, 0.02), hips=rx(12))
    arms(swing, (0.3, -0.15, -0.94), (0.2, -0.6, -0.77))                              # arms whipping down past the hips
    swing = stand(swing)
    push = body(crouch=0.0, lean=4, nod=-20, hips=rx(4))
    air_legs(push, (2, 8), (4, 10), foot=48)                                         # toes last off the sand
    girdle(push, up=18)
    arms(push, (0.42, -0.82, 0.38), (0.32, -0.7, 0.64))
    rise = body(lean=-2, nod=-20, hips=rx(-2))
    air_legs(rise, (14, 6), (40, 22), foot=36)
    girdle(rise, up=22)
    arms(rise, (0.66, -0.48, 0.58), (0.55, -0.45, 0.7))
    hang = apex_pose(1.0)
    fall = body(lean=4, nod=-14, hips=rx(4))
    air_legs(fall, (26, 20), (40, 34), foot=20)
    balance(fall, up=0.32, fwd=-0.28)
    reach = body(lean=8, nod=-10, hips=rx(6))
    air_legs(reach, (18, 14), (22, 18), foot=6)
    balance(reach, up=0.12, fwd=-0.38)
    return [(0, READY, "lin"), (0.12, load, "io"), (0.18, drop, "io"), (0.23, swing, "lin"), (0.28, push, "out"), (0.36, rise, "out"), (0.45, APEX, "out"),
            (0.56, hang, "io"), (0.68, fall, "io"), (0.76, reach, "io"), (0.81, LAND, "out"), (1.0, READY, "io")]


SPIKE_JUMP = spike_jump_keys()


def air_clip(p, ks, takeoff, land):
    """Feet planted until takeoff and from the landing on; free in between (the sim carries the root)."""
    P = keys(p, ks)
    return stand(P, max(1 - ramp(p, takeoff - 0.01, takeoff + 0.03), ramp(p, land - 0.025, land)))   # feet go once the sim lifts


@vb_clip("vb_spike_jump", 2.0, False, takeoff=0.56, apex=1.0, land=1.62)
def vb_spike_jump(p):
    return air_clip(p, SPIKE_JUMP, 0.28, 0.81)


# ================================================================ the spike: whip, contact at the top, wrist snap, land
def spike_keys():
    whip = body(lean=-4, twist=-10, side=6, tilt=6, nod=-18, turn=8, hips=rx(-2))
    air_legs(whip, (0, 10), (78, 56), foot=36)
    girdle(whip, up=28, side="Right")
    girdle(whip, up=8, side="Left")
    arm(whip, "Right", V(-0.84, 0.1, 0.53), V(-0.75, 0.3, 0.59))                   # elbow leads, hand still behind
    arm(whip, "Left", V(0.72, -0.45, -0.05), V(0.45, -0.6, -0.4))
    whip.aim("RightHand", V(-0.4, 0.3, 0.87))
    hit = body(lean=6, twist=18, side=12, tilt=14, nod=-16, turn=-12, hips=rx(4))
    air_legs(hit, (16, 22), (58, 46), foot=34)
    girdle(hit, up=30, side="Right")
    arm(hit, "Right", V(-0.8, -0.35, 0.49), V(-0.74, -0.45, 0.5))                    # long arm, high, out and in front: the contact
    arm(hit, "Left", V(0.65, -0.1, -0.75), V(0.35, -0.5, -0.8))
    hit.aim("RightHand", V(-0.6, -0.62, 0.5))
    snap = body(lean=12, twist=30, side=-3, nod=-14, turn=-18, hips=rx(6))
    air_legs(snap, (34, 28), (52, 46), foot=30)
    girdle(snap, up=8, side="Right")
    arm(snap, "Right", V(-0.25, -0.85, -0.46), V(0.2, -0.75, -0.63))               # through, down across the body
    arm(snap, "Left", V(0.6, 0.15, -0.78), V(0.4, -0.2, -0.9))
    snap.aim("RightHand", V(0.3, -0.4, -0.87))
    fall = body(lean=6, twist=10, nod=-16, turn=-6, hips=rx(4))
    air_legs(fall, (22, 18), (30, 26), foot=12)
    balance(fall, up=0.18, fwd=-0.32)
    return [(0, APEX, "lin"), (0.08, whip, "in"), (0.15, hit, "lin"), (0.24, snap, "out"), (0.42, fall, "io"), (0.5, LAND, "out"),
            (1.0, READY, "io")]


SPIKE = spike_keys()


@vb_clip("vb_spike_hit", 1.2, False, contact=0.18, land=0.6, hand="R", startsOn="vb_spike_jump")
def vb_spike_hit(p):
    return air_clip(p, SPIKE, -1, 0.5)


# ================================================================ the block: both hands up and over the net, held, then down
def block_keys():
    start = body(lean=-2, nod=-20, hips=rx(-2))
    air_legs(start, (8, 8), (20, 20), foot=40)
    girdle(start, up=14)
    arms(start, (0.75, -0.35, 0.2), (0.6, -0.45, 0.66))                              # hands up by the ears, ready to press
    hands_aim(start, (0.4, -0.35, 0.85))
    press = body(lean=6, nod=-12, hips=rx(4))
    air_legs(press, (10, 10), (12, 12), foot=42, splay=3)
    girdle(press, up=40, fwd=6)
    arms(press, (0.86, -0.3, 0.41), (0.82, -0.38, 0.43))                             # long arms, up and over in a wide Y
    hands_aim(press, (0.7, -0.45, 0.55))
    reach = body(lean=9, nod=-10, hips=rx(6))
    air_legs(reach, (14, 12), (16, 14), foot=40, splay=3)
    girdle(reach, up=40, fwd=10)
    arms(reach, (0.84, -0.38, 0.39), (0.8, -0.45, 0.4))                               # pressed over the tape
    hands_aim(reach, (0.65, -0.6, 0.46))
    drop = body(lean=2, nod=-14, hips=rx(2))
    air_legs(drop, (16, 14), (24, 20), foot=14)
    girdle(drop, up=10)
    arms(drop, (0.8, -0.3, 0.2), (0.55, -0.6, 0.55))
    return [(0, start, "lin"), (0.1, press, "out"), (0.38, reach, "io"), (0.55, drop, "io"), (0.64, LAND, "out"), (1.0, READY, "io")]


BLOCK = block_keys()


@vb_clip("vb_block", 1.2, False, contact=0.12, land=0.77, hand="both", startsOn="vb_spike_jump")
def vb_block(p):
    return air_clip(p, BLOCK, -1, 0.64)


# ================================================================ the jump set: the window in the air
def jump_set_keys():
    start = body(lean=-4, nod=-26, hips=rx(-2))
    air_legs(start, (10, 6), (34, 22), foot=36)
    window_hands(start, ext=-0.3)
    contact = body(lean=-8, nod=-30, hips=rx(-4))
    air_legs(contact, (6, 4), (18, 12), foot=40)
    window_hands(contact, ext=0.5)
    follow = body(lean=-6, nod=-28, hips=rx(-2))
    air_legs(follow, (12, 8), (24, 18), foot=34)
    window_hands(follow, ext=1.0, open_=1.0)
    fall = body(lean=4, nod=-12, hips=rx(4))
    air_legs(fall, (22, 18), (30, 26), foot=12)
    balance(fall, up=0.2, fwd=-0.34)
    return [(0, APEX, "lin"), (0.12, start, "io"), (0.22, contact, "out"), (0.36, follow, "out"), (0.55, fall, "io"), (0.64, LAND, "out"),
            (1.0, READY, "io")]


JUMP_SET = jump_set_keys()


@vb_clip("vb_jump_set", 1.2, False, contact=0.26, land=0.77, hand="both", startsOn="vb_spike_jump")
def vb_jump_set(p):
    return air_clip(p, JUMP_SET, -1, 0.64)


# ================================================================ the serve: toss, then the jump serve or the standing serve
SERVE_FEET = {"Left": V(0.07, -0.06, ANKLE["Left"].z), "Right": V(-0.075, 0.06, ANKLE["Right"].z)}   # left foot forward


def serve_stance(P, w=1.0):
    return planted(P, w, ankles=SERVE_FEET, knees_out=0.35)


def serve_hold():
    """Square to the net, the ball held out in the left palm at the chest, the right hand under it."""
    P = body(crouch=0.025, lean=6, nod=-8, twist=-6, hips=rx(6))
    girdle(P, up=6, fwd=8)
    wrist(P, "Left", (-0.07, -0.13, 0.0), V(0.6, 0.3, -1))
    wrist(P, "Right", (-0.08, -0.14, -0.02), V(-0.6, 0.3, -1))
    P.aim("LeftHand", V(-0.35, -0.8, 0.45))
    P.aim("RightHand", V(0.4, -0.8, 0.4))
    return P


SERVE_HOLD = serve_stance(serve_hold())


def serve_cocked(P):
    girdle(P, up=22, side="Right")
    girdle(P, up=20, side="Left")
    arm(P, "Right", V(-0.82, 0.45, 0.36), V(-0.7, 0.3, 0.65))
    arm(P, "Left", V(0.74, -0.42, 0.53), V(0.68, -0.48, 0.55))                       # still up where the ball left it
    P.aim("RightHand", V(-0.45, 0.0, 0.89))
    P.aim("LeftHand", V(0.55, -0.5, 0.67))
    return P


def toss_keys():
    dip = body(crouch=0.06, lean=12, nod=-6, twist=-8, hips=rx(12))
    girdle(dip, up=2, fwd=8)
    wrist(dip, "Left", (-0.06, -0.14, -0.05), V(0.6, 0.3, -1))
    arm(dip, "Right", V(-0.6, 0.2, -0.75), V(-0.45, 0.0, -0.9))
    dip.aim("LeftHand", V(-0.3, -0.85, 0.4))
    lift = body(crouch=0.02, lean=0, nod=-22, twist=-14, side=-10, tilt=-12, hips=rx(4))
    girdle(lift, up=24, side="Left")
    arm(lift, "Left", V(0.85, -0.3, 0.43), V(0.8, -0.36, 0.48))                     # the release: arm long, palm up
    arm(lift, "Right", V(-0.8, 0.15, 0.1), V(-0.55, 0.45, 0.65))
    lift.aim("LeftHand", V(0.45, -0.35, 0.82))
    cock = serve_cocked(body(crouch=0.01, lean=-6, nod=-24, twist=-26, side=2, turn=14, hips=rx(-2)))
    return [(0, SERVE_HOLD, "lin"), (0.22, serve_stance(dip), "io"), (0.4, serve_stance(lift), "out"), (0.68, serve_stance(cock), "io"),
            (1.0, serve_stance(cock), "io")]


TOSS = toss_keys()


@vb_clip("vb_serve_toss", 1.0, False, contact=0.4, hand="L", startsOn="vb_serve_toss", endsOn="hold")
def vb_serve_toss(p):
    P = keys(p, TOSS)
    if p > 0.68:                                                     # the cocked hold breathes so a long wait isn't frozen
        b = math.sin(math.pi * (p - 0.68) / 0.32)
        P.loc.z += 0.003 * b
    return serve_stance(P, 1.0)


def serve_hit_keys():
    air0 = serve_cocked(body(lean=-6, nod=-22, twist=-26, side=2, turn=14, hips=rx(-2)))
    air_legs(air0, (-4, 8), (70, 52), foot=38)
    whip = body(lean=-4, twist=-4, side=6, tilt=6, nod=-24, hips=rx(0))
    air_legs(whip, (6, 12), (62, 48), foot=36)
    girdle(whip, up=26, side="Right")
    arm(whip, "Right", V(-0.84, 0.1, 0.53), V(-0.75, 0.3, 0.59))
    arm(whip, "Left", V(0.6, -0.5, -0.1), V(0.3, -0.55, -0.55))
    whip.aim("RightHand", V(-0.05, 0.2, 0.97))
    hit = body(lean=6, twist=12, side=10, tilt=12, nod=-16, hips=rx(4))
    air_legs(hit, (14, 18), (50, 40), foot=34)
    girdle(hit, up=30, side="Right")
    arm(hit, "Right", V(-0.8, -0.4, 0.45), V(-0.72, -0.52, 0.46))                 # out in front: the serve meets it early
    arm(hit, "Left", V(0.6, -0.1, -0.65), V(0.3, -0.45, -0.84))
    hit.aim("RightHand", V(-0.55, -0.7, 0.45))
    snap = body(lean=12, twist=22, nod=-14, turn=-12, hips=rx(6))
    air_legs(snap, (28, 24), (46, 40), foot=28)
    arm(snap, "Right", V(-0.1, -0.9, -0.42), V(0.2, -0.8, -0.56))
    arm(snap, "Left", V(0.55, 0.15, -0.82), V(0.35, -0.2, -0.9))
    snap.aim("RightHand", V(0.2, -0.5, -0.84))
    fall = body(lean=8, twist=8, nod=-10, hips=rx(6))
    air_legs(fall, (22, 18), (28, 24), foot=12)
    balance(fall, up=0.18, fwd=-0.32)
    land = LAND
    return [(0, air0, "lin"), (0.07, whip, "in"), (0.13, hit, "lin"), (0.22, snap, "out"), (0.42, fall, "io"), (0.52, land, "out"),
            (1.0, READY, "io")]


SERVE_HIT = serve_hit_keys()


@vb_clip("vb_serve_hit", 1.2, False, contact=0.15, land=0.62, hand="R", startsOn="vb_spike_jump")
def vb_serve_hit(p):
    return air_clip(p, SERVE_HIT, -1, 0.52)


def serve_stand_keys():
    cock = serve_cocked(body(crouch=0.01, lean=-6, nod=-24, twist=-26, side=2, turn=14, hips=rx(-2)))
    step = body(crouch=0.03, lean=-2, nod=-26, twist=-10, side=6, tilt=6, shift=(0, -0.025), hips=rx(2))
    girdle(step, up=26, side="Right")
    arm(step, "Right", V(-0.84, 0.1, 0.53), V(-0.75, 0.3, 0.59))
    arm(step, "Left", V(0.6, -0.5, -0.1), V(0.3, -0.55, -0.55))
    step.aim("RightHand", V(-0.05, 0.2, 0.97))
    hit = body(crouch=0.02, lean=8, nod=-18, twist=14, side=10, tilt=12, shift=(0, -0.035), hips=rx(6))
    girdle(hit, up=30, side="Right")
    arm(hit, "Right", V(-0.8, -0.4, 0.45), V(-0.72, -0.52, 0.46))
    arm(hit, "Left", V(0.6, -0.1, -0.65), V(0.3, -0.45, -0.84))
    hit.aim("RightHand", V(-0.55, -0.7, 0.45))
    through = body(crouch=0.04, lean=12, nod=-16, twist=28, turn=-14, shift=(0, -0.04), hips=rx(8))
    arm(through, "Right", V(0.05, -0.85, -0.52), V(0.3, -0.7, -0.65))
    arm(through, "Left", V(0.55, 0.2, -0.8), V(0.35, -0.15, -0.92))
    through.aim("RightHand", V(0.3, -0.4, -0.86))
    return [(0, serve_stance(cock), "lin"), (0.12, serve_stance(step), "in"), (0.2, serve_stance(hit), "lin"),
            (0.36, serve_stance(through), "out"), (0.62, serve_stance(through), "io"), (1.0, READY, "io")]


SERVE_STAND = serve_stand_keys()


@vb_clip("vb_serve_stand", 1.3, False, contact=0.26, hand="R", startsOn="vb_serve_toss")
def vb_serve_stand(p):
    P = keys(p, SERVE_STAND)
    ank = {}
    for s, a, b in (("Right", 0.6, 0.74), ("Left", 0.74, 0.88)):          # back into the stance: a step each, not a slide
        u = ramp(p, a, b)
        ank[s] = SERVE_FEET[s].lerp(STANCE[s], u) + V(0, 0, 0.035 * math.sin(math.pi * u))
    return plant(P, ankles=ank, knees_out=0.35 + 0.15 * ramp(p, 0.6, 0.88))


# ================================================================ the dives: on the sand and back up (ground pass keeps the body on it)
def dive_air(reach_l=0.0):
    """Stretched out flying low: the right arm long at the ball, the left a little behind, legs trailing."""
    P = body(lean=8, nod=-58, hips=rx(66), side=-4)
    air_legs(P, (-22, -14), (18, 30), foot=50, splay=4)
    girdle(P, up=30, fwd=10, side="Right")
    girdle(P, up=18, side="Left")
    arm(P, "Right", V(-0.15, -0.9, 0.0), V(-0.08, -0.97, -0.05))
    arm(P, "Left", V(0.4 + 0.3 * reach_l, -0.6, -0.1), V(0.25, -0.85, -0.2))
    P.aim("RightHand", V(-0.15, -0.9, 0.3))
    return P


def prone(chin=0.0, legs_up=0.0):
    """Flat on the sand on the chest: chin up looking along it, arms out in front, feet behind."""
    P = body(lean=-22, nod=-58 - chin, hips=rx(88), side=-2)                          # belly down, back arched, head up
    air_legs(P, (-6, -2), (12 + 30 * legs_up, 18 + 40 * legs_up), foot=60, splay=6)
    girdle(P, up=26, fwd=6)
    arm(P, "Right", V(-0.2, -0.97, 0.05), V(-0.1, -0.99, 0.0))
    arm(P, "Left", V(0.45, -0.88, 0.05), V(0.3, -0.95, 0.0))
    hands_aim(P, (-0.1, -0.99, 0.0))
    return P


def push_up():
    """Hands under the shoulders, chest up off the sand, knees still down."""
    P = body(lean=-12, nod=-36, hips=rx(52))
    air_legs(P, (-2, 10), (78, 92), foot=40, splay=8)
    girdle(P, up=8, fwd=6)
    arms(P, (0.22, -0.4, -0.89), (0.12, -0.25, -0.96))
    hands_aim(P, (0.1, -0.95, -0.2))
    return P


def kneel_up():
    """One knee down, the right foot under, a hand on the knee pushing up."""
    P = body(crouch=0.11, lean=18, nod=-20, hips=rx(26))
    legs(P, (8, 72), (92, 96), foot=0)
    arm(P, "Right", V(-0.3, -0.45, -0.84), V(-0.1, -0.6, -0.8))
    arm(P, "Left", V(0.45, -0.2, -0.87), V(0.35, -0.6, -0.72))
    return P


def dive_keys():
    load = body(crouch=0.13, lean=32, nod=-16, shift=(0, 0.01), hips=rx(30))
    arms(load, (0.35, -0.6, -0.72), (0.2, -0.85, -0.5))
    launch = body(crouch=0.07, lean=18, nod=-40, hips=rx(52), side=-2)
    air_legs(launch, (-24, 30), (14, 56), foot=28)
    girdle(launch, up=20, fwd=8)
    arm(launch, "Right", V(-0.2, -0.88, -0.2), V(-0.1, -0.97, -0.15))
    arm(launch, "Left", V(0.3, -0.8, -0.4), V(0.2, -0.9, -0.3))
    fly = dive_air()
    fly.loc.z -= 0.05
    touch = prone(chin=6, legs_up=0.6)
    touch.loc.z -= 0.17
    settle = prone(chin=-4, legs_up=1.0)
    settle.loc.z -= 0.18
    lie = prone(chin=0, legs_up=0.3)
    lie.loc.z -= 0.18
    up1 = push_up()
    up1.loc.z -= 0.12
    up2 = kneel_up()
    return [(0, READY, "lin"), (0.05, stand(load), "io"), (0.15, launch, "out"), (0.22, fly, "lin"), (0.3, touch, "in"),
            (0.38, settle, "out"), (0.55, lie, "io"), (0.68, up1, "io"), (0.82, up2, "io"), (1.0, READY, "io")]


DIVE = dive_keys()


def ground_w_dive(on0, on1, off0, off1):
    return lambda p: window(p, on0, on1, off0, off1)


@vb_clip("vb_dive", 1.6, False, ground="frame", ground_w=ground_w_dive(0.27, 0.3, 0.86, 0.93),
         takeoff=0.24, contact=0.35, down=0.48, up=1.4, hand="R")
def vb_dive(p):
    P = keys(p, DIVE)
    return stand(P, float(p <= 0.05 or p >= 0.999))     # planted keys meet the free ones exactly at the load and the end: no blend to pop


def slide_dive_keys():
    run = body(crouch=0.06, lean=30, nod=-26, hips=rx(26))
    air_legs(run, (40, -20), (60, 40), foot=20)
    arms(run, (0.3, 0.45, -0.84), (0.2, 0.0, -0.98))
    launch = body(crouch=0.1, lean=20, nod=-46, hips=rx(58))
    air_legs(launch, (-28, 26), (12, 60), foot=48)
    girdle(launch, up=26, fwd=10)
    arms(launch, (0.16, -0.92, -0.25), (0.1, -0.97, -0.2))
    fly = body(lean=6, nod=-62, hips=rx(74))
    air_legs(fly, (-20, -16), (14, 20), foot=54)
    girdle(fly, up=32, fwd=14)
    arms(fly, (0.18, -0.95, 0.05), (0.06, -0.99, 0.02))                                # both arms long: the pancake reach
    hands_aim(fly, (-0.15, -0.9, 0.35))
    fly.loc.z -= 0.08
    def skid(legs_up, chin):
        P = prone(chin=chin, legs_up=legs_up)
        girdle(P, up=34, fwd=14)
        arms(P, (0.15, -0.98, 0.05), (0.05, -0.99, 0.0))                              # still both arms long along the sand
        hands_aim(P, (-0.2, -0.88, 0.4))
        P.loc.z -= 0.18
        return P
    touch, skim, stop = skid(1.3, 12), skid(0.8, 6), skid(0.2, -4)                    # heels kick up on the belly landing, then drop
    pop = push_up()
    pop.loc.z -= 0.1
    return [(0, READY, "lin"), (0.08, run, "io"), (0.15, launch, "out"), (0.21, fly, "lin"), (0.27, touch, "in"), (0.42, skim, "out"),
            (0.52, stop, "io"), (0.64, pop, "io"), (0.76, LAND, "out"), (1.0, READY, "io")]


SLIDE_DIVE = slide_dive_keys()


@vb_clip("vb_slide_dive", 1.8, False, ground="frame", ground_w=ground_w_dive(0.24, 0.27, 0.68, 0.78),
         takeoff=0.27, contact=0.42, down=0.49, up=1.4, hand="both")
def vb_slide_dive(p):
    P = keys(p, SLIDE_DIVE)
    return stand(P, float(p == 0.0 or p >= 0.76))       # planted from the squat on (LAND is planted where the keys meet it)


# ================================================================ celebrations
def celebrate_point_keys():
    coil = body(crouch=0.08, lean=14, nod=-6, twist=-14, hips=rx(14))
    arm(coil, "Right", V(-0.82, -0.2, 0.53), V(-0.62, -0.5, 0.6))                     # fist up by the cheek
    arm(coil, "Left", V(0.55, 0.0, -0.84), V(0.35, -0.45, -0.82))
    coil = stand(coil)
    pump = body(crouch=0.0, lean=-8, nod=-24, twist=10, hips=rx(-4))
    arm(pump, "Right", V(-0.4, -0.15, -0.9), V(-0.12, -0.55, 0.83))                 # elbow yanked down: "yes!"
    arm(pump, "Left", V(0.7, 0.2, -0.68), V(0.55, -0.3, -0.78))
    down = body(crouch=0.06, lean=10, nod=-10, twist=4, hips=rx(10))
    arm(down, "Right", V(-0.35, -0.3, -0.89), V(-0.1, -0.55, 0.83))
    arm(down, "Left", V(0.6, 0.1, -0.8), V(0.4, -0.4, -0.82))
    down = stand(down)
    pump2 = body(crouch=0.0, lean=-4, nod=-20, twist=6, hips=rx(0))
    arm(pump2, "Right", V(-0.45, -0.25, -0.86), V(-0.1, -0.55, 0.83))
    arm(pump2, "Left", V(0.65, 0.1, -0.75), V(0.45, -0.35, -0.82))
    pump2 = stand(pump2)
    return [(0, READY, "lin"), (0.16, coil, "io"), (0.3, pump, "out"), (0.44, down, "in"), (0.56, pump2, "out"), (0.72, pump2, "io"),
            (1.0, READY, "io")]


CELEBRATE_POINT = celebrate_point_keys()


@vb_clip("vb_celebrate_point", 1.2, False)
def vb_celebrate_point(p):
    k = window(p, 0.2, 0.3, 0.36, 0.46)                               # the right knee comes up with the pull
    ank = {"Left": STANCE["Left"], "Right": STANCE["Right"] + V(0.0, -0.03, 0.08) * k}
    return plant(keys(p, CELEBRATE_POINT), ankles=ank, knees_out=0.5)


def celebrate_win_keys():
    squat = body(crouch=0.1, lean=18, nod=-4, hips=rx(16))
    arms(squat, (0.4, 0.4, -0.82), (0.3, 0.55, -0.78))
    squat = stand(squat)
    leap = body(crouch=-0.16, lean=-10, nod=-30, hips=rx(-6))
    legs(leap, (26, 40), (70, 90), foot=30)
    girdle(leap, up=34)
    arms(leap, (0.8, -0.1, 0.6), (0.74, -0.16, 0.66))                              # the big V
    hands_aim(leap, (0.55, -0.2, 0.81))
    hang = body(crouch=-0.14, lean=-12, nod=-32, hips=rx(-6))
    legs(hang, (40, 44), (96, 100), foot=26)
    girdle(hang, up=36)
    arms(hang, (0.8, -0.08, 0.6), (0.72, -0.14, 0.68))
    hands_aim(hang, (0.55, -0.2, 0.81))
    land = body(crouch=0.08, lean=12, nod=-14, hips=rx(12))
    girdle(land, up=24)
    arms(land, (0.82, -0.15, 0.55), (0.7, -0.25, 0.67))
    land = stand(land)
    shake = body(crouch=0.02, lean=-6, nod=-26, side=4, hips=rx(0))
    girdle(shake, up=30)
    arms(shake, (0.8, -0.05, 0.6), (0.68, -0.25, 0.69))
    shake = stand(shake)
    shake2 = body(crouch=0.03, lean=-6, nod=-26, side=-4, hips=rx(0))
    girdle(shake2, up=30)
    arms(shake2, (0.78, -0.1, 0.62), (0.72, -0.15, 0.68))
    shake2 = stand(shake2)
    return [(0, READY, "lin"), (0.1, squat, "io"), (0.2, leap, "out"), (0.3, hang, "io"), (0.4, land, "in"), (0.5, shake, "out"),
            (0.6, shake2, "io"), (0.7, shake, "io"), (0.8, shake2, "io"), (1.0, READY, "io")]


CELEBRATE_WIN = celebrate_win_keys()


@vb_clip("vb_celebrate_win", 2.0, False)
def vb_celebrate_win(p):
    P = keys(p, CELEBRATE_WIN)
    return stand(P, 1 - window(p, 0.12, 0.17, 0.36, 0.4))


# ================================================================ the passer-by's view of a player: ready, bump, ready, set, a loop
SPECTATE = 3.6                                          # three of vb_ready's loops: a bump in the second, a set in the third


@vb_clip("vb_spectate", SPECTATE, True)
def vb_spectate(p):
    """Bystanders and the lite view: no ball, no match; a player bouncing in the stance, passing and setting now and then."""
    rest = ready_at((p * SPECTATE / 1.2) % 1.0)
    b0, b1 = 1 / 3, 1 / 3 + 1.0 / SPECTATE
    s0, s1 = 2 / 3, 2 / 3 + 1.1 / SPECTATE
    if b0 <= p < b1:
        return stand(mix(rest, keys((p - b0) / (b1 - b0), BUMP), window(p, b0, b0 + 0.02, b1 - 0.02, b1)))
    if s0 <= p < s1:
        return stand(mix(rest, keys((p - s0) / (s1 - s0), SET), window(p, s0, s0 + 0.02, s1 - 0.02, s1)))
    return rest


def mirror_pose(P):
    Q = Pose()
    for n in NAMES:
        q = P.q(n.replace("Left", "#").replace("Right", "Left").replace("#", "Right"))
        Q.R[n] = Quaternion((q.w, q.x, -q.y, -q.z))
    Q.loc = V(-P.loc.x, P.loc.y, P.loc.z)
    return Q


@vb_clip("vb_shuffle_left", 0.5, True, stride=SHUF_STRIDE * GAME)
def vb_shuffle_left(p):
    return mirror_pose(vb_shuffle(p))


# ================================================================ bake, measure, check
def bone_world(n, tail=False):
    pb = rig.pose.bones[P_ + n]
    return rig.matrix_world @ (pb.tail if tail else pb.head)


def to_game(v):
    """Rig (x left, -y forward, z up) -> the game's local axes (x left, y up, z forward), game units."""
    return [round(v.x * GAME, 3), round(v.z * GAME, 3), round(-v.y * GAME, 3)]


def palm(s):
    return (bone_world(f"{s}Hand") + bone_world(f"{s}Hand", True)) / 2


def touch_point(c):
    """Where the ball meets the body at the current frame: the forearms' platform for the bump, else the palm(s)."""
    m = c["meta"]
    if m.get("at") == "wrists":
        return (bone_world("LeftHand") + bone_world("RightHand")) / 2
    h = m.get("hand", "both")
    return palm("Right") if h == "R" else palm("Left") if h == "L" else (palm("Left") + palm("Right")) / 2


def contact_point(c):
    sc.frame_set(round(c["meta"]["contact"] * FPS))
    bpy.context.view_layer.update()
    return to_game(touch_point(c))


def pose_snapshot():
    bpy.context.view_layer.update()
    return {n: rig.pose.bones[P_ + n].matrix.to_quaternion() for n in NAMES}


def qangle(a, b):
    d = a.rotation_difference(b)
    return math.degrees(d.angle if d.angle <= math.pi else math.tau - d.angle)


def swing(a, b):
    """Degrees a bone's direction moved between two poses."""
    return math.degrees((a @ Vector((0, 1, 0))).angle(b @ Vector((0, 1, 0)), 0.0))


def head_intrusion():
    """How deep the forearms and hands go into the head's ellipsoid this frame (build_clips.check's measure)."""
    dg = bpy.context.evaluated_depsgraph_get()
    e = body_ob.evaluated_get(dg)
    me = e.to_mesh()
    inv = (rig.pose.bones[P_ + "Head"].matrix @ HB.matrix_local.inverted()).inverted()
    worst = 0.0
    for i in ARM_V:
        q = inv @ me.vertices[i].co - HC0
        worst = max(worst, 1 - ((q.x / 0.215) ** 2 + (q.y / 0.19) ** 2 + (q.z / 0.215) ** 2))
    e.to_mesh_clear()
    return worst


def qa(c):
    """Per frame: hands in the head, the lowest point, bone turns (pops); the loop seam; the ends against vb_ready;
    feet sliding on the sand while planted (outside the clip's air and dive window)."""
    m, n = c["meta"], c["frames"]
    snaps, feet, heads, lows = [], [], [], []
    for f in range(n + 1):
        sc.frame_set(f)
        snaps.append(pose_snapshot())
        feet.append({s: bone_world(f"{s}Foot") for s, _ in SIDES})
        heads.append(head_intrusion())
        lows.append(min_z())
    hf = max(range(len(heads)), key=heads.__getitem__)
    # a pop is a limb jumping direction between frames (twist about a round limb's own axis doesn't show)
    steps = [max((swing(snaps[f - 1][b], snaps[f][b]), b) for b in NAMES) for f in range(1, n + 1)]
    pf = max(range(len(steps)), key=lambda i: steps[i][0])
    out = {"head": round(heads[hf], 3), "head_at": hf, "min_z": round(min(lows), 3),
           "pop_deg": round(steps[pf][0], 1), "pop_at": f"{steps[pf][1]}@{pf + 1}",
           "fast": [f"{b}@{i + 1}:{a:.0f}" for i, (a, b) in enumerate(steps) if a > 35]}
    if c["loop"]:
        out["seam_deg"] = round(steps[-1][0], 2)
        out["step_median_deg"] = round(sorted(a for a, _ in steps)[len(steps) // 2], 2)
        out["first_last_deg"] = round(max(qangle(snaps[0][b], snaps[-1][b]) for b in NAMES), 3)
    else:
        rig.animation_data.action = bpy.data.actions["vb_ready"]
        sc.frame_set(0)
        ready = pose_snapshot()
        rig.animation_data.action = bpy.data.actions[c["name"]]
        if m.get("startsOn", "vb_ready") == "vb_ready":
            out["start_vs_ready_deg"] = round(max(qangle(snaps[0][b], ready[b]) for b in NAMES), 2)
        out["end_vs_ready_deg"] = round(max(qangle(snaps[-1][b], ready[b]) for b in NAMES), 2)
    t0 = -1.0 if m.get("startsOn") == "vb_spike_jump" else m.get("takeoff", 99) - 0.05
    t1 = m.get("up", m.get("land", -1))
    expect = m.get("stride", 0.0) / GAME / n
    slide = 0.0
    for s, _ in SIDES:
        for f in range(1, n + 1):
            a, b = feet[f - 1][s], feet[f][s]
            if t0 <= f / FPS <= t1 or a.z > ANKLE[s].z + 0.004 or b.z > ANKLE[s].z + 0.004:
                continue
            slide = max(slide, abs((b - a).xy.length - expect))
    out["foot_slide_mm"] = round(slide * 1000, 1)
    return out


def build():
    for c in VB:
        bake(c)
    report = []
    for c in VB:
        rig.animation_data.action = bpy.data.actions[c["name"]]
        m = {k: v for k, v in c["meta"].items() if k != "ground_w"}
        row = {"name": c["name"], "duration": round(c["frames"] / FPS, 3), "loop": c["loop"], "frames": c["frames"]}
        for k in ("contact", "takeoff", "apex", "land", "down", "up"):
            if k in m:
                row[k] = m[k]
        if "contact" in m:
            rig.animation_data.action = bpy.data.actions[c["name"]]
            row["hand"] = m.get("hand", "both")
            row["contactPoint"] = contact_point(c)
        if "stride" in m:
            row["stride"] = round(m["stride"], 3)
        row["startsOn"] = m.get("startsOn", "vb_ready")
        if not c["loop"]:
            row["endsOn"] = m.get("endsOn", "vb_ready")
        rig.animation_data.action = bpy.data.actions[c["name"]]
        report.append(row)
        print(f"VB {c['name']:20s} {row['duration']:4.2f}s loop={c['loop']!s:5s} {qa(c)}")
    keep = {c["name"] for c in VB}
    for a in list(bpy.data.actions):
        if a.name not in keep:
            bpy.data.actions.remove(a)
    rig.animation_data.action = bpy.data.actions["vb_ready"]
    sc.frame_set(0)
    return report


def export(report):
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format="GLB", use_selection=True, export_yup=True,
        export_skins=True, export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_leaf_bone=False, export_optimize_animation_size=True)
    with open(OUT_TS, "w") as f:
        f.write(contract_ts(report))
    print("VB_OK", len(report), OUT_GLB)


TS_HEAD = """/**
 * The beach volleyball clips: the contract between the animation and the gameplay. GENERATED by
 * art/characters/volleyball/build_vb_clips.py with vb_clips.glb: change the script and rebuild, never this file.
 * clips.test.ts checks every name and duration against the GLB.
 *
 * The clips live in their own file (the rig and its actions only, about {kb} KB) that only a match loads:
 * `<Character clips={{VB_CLIPS_URL}} />` on the players in a match (Character.tsx MoreClips). The island never fetches it.
 *
 * Times are seconds from the clip's start at playRate 1. In place: the movement sim moves and lifts the root (runs,
 * jumps, the dive's lunge); a clip only poses the body. To sync:
 * - contact: the ball touches the body. Start the clip `contact` seconds before the touch, or set playRate so it lands
 *   on it; the ball sits at `contactPoint` then.
 * - takeoff, apex, land: feet leave the sand, the top of the jump, feet back down. The court's jump is floatier than the
 *   clip's own timing at playRate 1 is tuned for (David: "jumping is higher and slowmo"): scale playRate in the air so
 *   `land` meets the sim's touchdown.
 * - down, up: a dive's body on the sand, and back on its feet (movement can resume at `up`).
 * - contactPoint: [x, y, z] in game units in the character's own frame (x its left, y up from the soles, z forward),
 *   at CHARACTER_SCALE, with the root on the sand (add the sim's lift in the air).
 * - startsOn / endsOn: the clip whose pose it starts or ends on (crossfades are seamless from and to those).
 *   The air clips start on vb_spike_jump's apex pose: play them from the court jump at any point in the air.
 * - stride: a shuffle loop's travel in game units; playRate = speed * duration / stride keeps the feet planted.
 *
 * Variants beyond the brief: vb_shuffle steps to the character's right and vb_shuffle_left mirrors it; vb_serve_stand
 * is the serve without a jump (vb_serve_hit is the jump serve). vb_serve_toss holds its last pose (the arm cocked)
 * until the hit; its first frame is the stance to hold while the power bar fills.
 */
export const VB_CLIPS_URL = "/assets/characters/v6/base/vb_clips.glb";

export interface VbClipInfo {{
  duration: number;
  loop: boolean;
  contact?: number;
  takeoff?: number;
  apex?: number;
  land?: number;
  down?: number;
  up?: number;
  /** Which hand meets the ball: the right, the left, or both (a platform or a window). */
  hand?: "R" | "L" | "both";
  contactPoint?: readonly [number, number, number];
  stride?: number;
  startsOn: string;
  endsOn?: string;
}}

export const VB_CLIPS = {{
{rows}
}} as const satisfies Record<string, VbClipInfo>;

export type VbClip = keyof typeof VB_CLIPS;
export const isVbClip = (name: string): name is VbClip => Object.hasOwn(VB_CLIPS, name);
"""


def contract_ts(report):
    rows = []
    for r in report:
        fields = [f"duration: {r['duration']}", f"loop: {str(r['loop']).lower()}"]
        for k in ("contact", "takeoff", "apex", "land", "down", "up"):
            if k in r:
                fields.append(f"{k}: {r[k]}")
        if "hand" in r:
            fields.append(f'hand: "{r["hand"]}"')
        if "contactPoint" in r:
            fields.append("contactPoint: [" + ", ".join(f"{v:g}" for v in r["contactPoint"]) + "]")
        if "stride" in r:
            fields.append(f"stride: {r['stride']}")
        fields.append(f'startsOn: "{r["startsOn"]}"')
        if "endsOn" in r:
            fields.append(f'endsOn: "{r["endsOn"]}"')
        rows.append(f"  {r['name']}: {{ " + ", ".join(fields) + " },")
    return TS_HEAD.format(kb=round(os.path.getsize(OUT_GLB) / 1024), rows="\n".join(rows))


# ================================================================ evidence: contact sheets from the game camera's distance
CAM_BACK, CAM_UP, CAM_RIGHT = 2.7 / GAME, 1.75 / GAME, 0.6 / GAME    # spec §2: 0.6 right, 1.75 up, 2.7 back (game units)
CELL_W, CELL_H = 300, 400
VIEWS = (("side", 90.0), ("3/4 front", 135.0), ("game cam", math.degrees(math.atan2(CAM_RIGHT, CAM_BACK))))   # yaw 0 = from behind


def evidence(names):
    import subprocess
    import tempfile
    tmp = tempfile.mkdtemp(prefix="vb_ev_")
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x, sc.render.resolution_y = CELL_W, CELL_H
    sc.render.film_transparent = False
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value, bg.inputs[1].default_value = (0.62, 0.8, 0.92, 1), 0.85
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.4
    sun.rotation_euler = (math.radians(40), 0, math.radians(35))
    sc.collection.objects.link(sun)
    meshes = [o for o in sc.objects if o.type == "MESH"]
    for o in [o for o in meshes if "Hair" in o.name]:         # v6's hair doesn't fit the v8 head; the game dresses its own
        o.hide_render = True
        meshes.remove(o)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    sand = bpy.context.active_object
    mat = bpy.data.materials.new("Sand")
    mat.use_nodes = True
    next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs[0].default_value = (0.86, 0.76, 0.56, 1)
    sand.data.materials.append(mat)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.004, location=(0, 0, 0.002))
    mark = bpy.context.active_object                                     # where the sim's root is
    mm = bpy.data.materials.new("Mark")
    mm.use_nodes = True
    next(n for n in mm.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs[0].default_value = (0.25, 0.2, 0.15, 1)
    mark.data.materials.append(mm)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1 / GAME, location=(0, 0, -5))
    ball = bpy.context.active_object
    bm = bpy.data.materials.new("Ball")
    bm.use_nodes = True
    next(n for n in bm.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs[0].default_value = (0.95, 0.85, 0.25, 1)
    ball.data.materials.append(bm)
    bpy.ops.object.shade_smooth()
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.sensor_fit = "VERTICAL"
    cam.data.angle = math.radians(38)                                   # the game camera's distance, a field wide enough for a jump
    sc.collection.objects.link(cam)
    sc.camera = cam
    kit.show_vertex_colors(sc)
    by = {c["name"]: c for c in VB}
    os.makedirs(EVIDENCE, exist_ok=True)
    for name in names:
        c = by[name]
        rig.animation_data.action = bpy.data.actions[name]
        n = c["frames"]
        frames = sorted({round(i * n / 7) for i in range(8)} | ({round(c["meta"]["contact"] * FPS)} if "contact" in c["meta"] else set()))
        if len(frames) > 8:                                             # keep 8: drop the frame nearest the contact
            ct = round(c["meta"]["contact"] * FPS)
            frames.remove(min((f for f in frames if f != ct), key=lambda f: abs(f - ct)))
        files = []
        for vname, yaw in (VIEWS[:2] if "quick" in MY_ARGS else VIEWS):
            for f in frames:
                sc.frame_set(f)
                bpy.context.view_layer.update()
                dg = bpy.context.evaluated_depsgraph_get()
                lo, hi = Vector((9, 9, 9)), Vector((-9, -9, -9))
                for o in meshes:
                    e = o.evaluated_get(dg)
                    for corner in e.bound_box:
                        wv = e.matrix_world @ Vector(corner)
                        lo, hi = Vector(map(min, lo, wv)), Vector(map(max, hi, wv))
                centre = (lo + hi) / 2
                centre.z = max(0.45, centre.z)
                a = math.radians(yaw)
                fwd = Vector((math.sin(a), -math.cos(a), 0))                 # the camera's view direction on the ground
                cam.location = centre - fwd * math.hypot(CAM_BACK, CAM_RIGHT) + Vector((0, 0, CAM_UP - 0.45))
                cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
                touching = "contact" in c["meta"] and f == round(c["meta"]["contact"] * FPS)
                if touching:
                    p = touch_point(c)
                    up = Vector((0, 0, 1)) if name not in ("vb_bump", "vb_dive", "vb_slide_dive") else Vector((0, -0.4, 0.9)).normalized()
                    ball.location = p + up * (0.1 / GAME + 0.012)
                else:
                    ball.location = (0, 0, -5)
                sc.render.filepath = os.path.join(tmp, f"{name}_{vname[:4]}_{f:03d}.png")
                bpy.ops.render.render(write_still=True)
                label = f"{f / FPS:.2f}s" + (" contact" if touching else "")
                files += ["-label", f"{vname}  {label}", sc.render.filepath]
        out = os.path.join(EVIDENCE, f"{name}.webp")
        sheet = os.path.join(tmp, f"{name}_sheet.png")
        subprocess.run(["magick", "montage", *files, "-tile", f"{len(frames)}x", "-geometry", "+2+2", "-background", "#1b1f27",
                        "-fill", "#f1ffff", "-pointsize", "13", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf",
                        "-title", f"{name}  {c['frames'] / FPS:.2f}s{'  loop' if c['loop'] else ''}", sheet], check=True)
        subprocess.run(["magick", sheet, "-quality", "84", out], check=True)
        print("wrote", out)


REPORT = build()
if "evidence" in MY_ARGS:
    i = MY_ARGS.index("evidence")
    only = MY_ARGS[i + 1].split(",") if len(MY_ARGS) > i + 1 else [c["name"] for c in VB]
    evidence(only)
if "noexport" not in MY_ARGS:
    export(REPORT)
