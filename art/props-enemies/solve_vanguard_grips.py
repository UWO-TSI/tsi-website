"""Solve the Vanguard weapons' grips from the rig (as render_held.py solves the tools'): the off hand's rotation and the wraps.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/solve_vanguard_grips.py

At each grip's hold idle (the ruins' arms over locomotion: v7_verbs.glb HoldIdle_<Grip>), the main weapon sits in the right
hand at the melee grip. The off hand's part is placed by a wanted world frame and expressed in the left hand socket's
space as the engine attaches it (three.js Euler XYZ, glTF axes): the Guardian's shield faces forward with its top up; the
second tanto and the left wrap mirror the right one across the body's midplane. The wraps themselves are built round
each hand: the hand bone's middle and its direction (wrist to knuckles) in the weapon's space. Writes vanguard_grips.json.
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import pe  # noqa: E402

C = Matrix.Rotation(math.pi / 2, 4, "X")
MELEE = [math.pi / 2, 0.0, 0.0]
GRIP = {"aegis": "OneHand", "warhammer": "Staff", "handwraps": "Fists", "tanto": "Fists"}


def euler_matrix(e):
    return C @ (Matrix.Rotation(e[0], 4, "X") @ Matrix.Rotation(e[1], 4, "Y") @ Matrix.Rotation(e[2], 4, "Z")) @ C.inverted()


def three_euler(m):
    m13, m23, m33, m12, m11, m32, m22 = m[0][2], m[1][2], m[2][2], m[0][1], m[0][0], m[2][1], m[1][1]
    ey = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        return [math.atan2(-m23, m33), ey, math.atan2(-m12, m11)]
    return [math.atan2(m32, m22), ey, 0.0]


def frame(z, front):
    z = z.normalized()
    y = -(front - z * front.dot(z)).normalized()
    return Matrix((y.cross(z), y, z)).transposed().to_4x4()


pe.reset()
pe.CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v7_clips.glb")
root, rig, socks = pe.load_character()
before = set(bpy.data.objects)
pe.import_glb(os.path.join(ROOT, "art", "characters", "base", "v7_verbs.glb"))
for a in bpy.data.actions:
    a.use_fake_user = True
for o in set(bpy.data.objects) - before:
    bpy.data.objects.remove(o, do_unlink=True)
MIRROR = Matrix.Diagonal((-1, 1, 1, 1))
out = {}
for t, grip in GRIP.items():
    pe.use_action(rig, f"HoldIdle_{grip}", 0.0)
    bpy.context.view_layer.update()
    sr, sl = socks["R"].matrix_world.normalized(), socks["L"].matrix_world.normalized()
    main = sr @ euler_matrix(MELEE)                                  # the weapon's frame in the world (Blender axes)
    entry = {"hand": [round(v, 3) for v in MELEE], "back": [0, 0, 0.5]}
    if t == "aegis":
        want = Matrix.Translation(sl.translation) @ frame(Vector((0, 0, 1)), Vector((0, -1, 0)))
    elif t in ("tanto", "handwraps"):
        want = MIRROR @ main @ MIRROR
    else:
        want = None
    if want is not None:
        local = C.inverted() @ (sl.inverted() @ want) @ C
        entry["off"] = [round(v, 3) for v in three_euler(local.to_3x3())]
    if t == "warhammer":
        entry["rest"] = [0.03, -0.24, -1.15]                          # upright at rest, as the staff (Character.tsx GRIP.staff.rest)
        entry["hand"] = [2.27, 0.0, 0.0]                               # swinging: the haft tilted 40 degrees head-down, so a slam meets the ground
    if t == "handwraps":
        for side, sock, wm in (("R", sr, main), ("L", sl, Matrix.Translation(sl.translation) @ want.to_3x3().to_4x4())):
            bone = rig.pose.bones[f"mixamorig:{'Right' if side == 'R' else 'Left'}Hand"]
            head, tail = rig.matrix_world @ bone.head, rig.matrix_world @ bone.tail
            inv = wm.inverted()
            mid, d = inv @ ((head + tail) / 2), (inv.to_3x3() @ (tail - head)).normalized()
            entry[f"wrap{side}"] = {"centre": [round(v, 4) for v in mid], "axis": [round(v, 4) for v in d], "length": round((tail - head).length, 4)}
    out[t] = entry
json.dump(out, open(os.path.join(HERE, "vanguard_grips.json"), "w"), indent=1)
print("GRIPS", json.dumps(out))
