"""The rod moment on the v7 character (specs/polish/fishing.md deliverable 2): review the fishing clips with the rod in
the hand, and solve the rod's grip for them.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_fishing.py -- <frames_dir> [solve]

For each fishing clip (build_clips.py CastWindup, CastSwing, FishHold, HookYank, Reel, HoldUp, Cheer, Sad) it holds the
rod the way the engine does (Character.tsx: three.js Euler XYZ in the right hand socket's space, USE_GRIPS per clip),
renders frames through the clip from the side and three-quarter front, and prints the rod's direction in the world at
each frame (+y is the character's back, +z up, -x its right). With `solve`, it solves one grip for the fishing clips
from FishHold (the rod 20 degrees up, straight out over the water, its reel hanging under it) and prints it as JSON;
the clips' arms do the rest (drawn back over the shoulder, whipped forward, snapped up, braced up against the fish).
The frames are the review sheet's (specs/evidence/polish-fishing/).
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import pe  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT = ARGS[0]
os.makedirs(OUT, exist_ok=True)
pe.CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v7_clips.glb")
pe.reset()
st = pe.Stage(bg=(0.94, 0.91, 0.84, 1))
root, rig, socks = pe.load_character()
char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
C = Matrix.Rotation(math.pi / 2, 4, "X")          # glTF (y-up) -> Blender (z-up), as pe.grip_matrix
ROD = os.path.join(ROOT, "web", "public", "assets", "game", "tools", "rod-3.glb")
CAT = {c["name"]: c for c in json.load(open(os.path.join(ROOT, "art", "characters", "character_catalog.json")))["clips"]}

# The engine's grips (Character.tsx): the carry over the shoulder, and the use grip the fishing clips share.
GRIPS = {"carry": [3.046, 1.018, -1.469], "use": [1.611, -0.292, 2.157]}
if os.path.exists(os.path.join(OUT, "grip.json")):
    GRIPS["use"] = json.load(open(os.path.join(OUT, "grip.json")))["rotation"]


def euler_matrix(r):
    """three.js Euler XYZ (glTF axes) as a Blender-axes rotation in the socket's space."""
    m = Matrix.Rotation(r[0], 4, "X") @ Matrix.Rotation(r[1], 4, "Y") @ Matrix.Rotation(r[2], 4, "Z")
    return C @ m @ C.inverted()


def three_euler(m):
    m13, m23, m33, m12, m11, m32, m22 = m[0][2], m[1][2], m[2][2], m[0][1], m[0][0], m[2][1], m[1][1]
    ey = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        return [math.atan2(-m23, m33), ey, math.atan2(-m12, m11)]
    return [math.atan2(m32, m22), ey, 0.0]


def frame(z, front):
    z = z.normalized()
    y = -(front - z * front.dot(z)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_4x4()


if "solve" in ARGS:
    # Waiting for a bite: the rod 20 degrees up, straight out over the water (-y), its reel hanging under it (front -z).
    pe.use_action(rig, "FishHold", 0)
    root.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    sw = socks["R"].matrix_world.normalized()
    up = math.radians(20)
    world = Matrix.Translation(sw.translation) @ frame(Vector((0, -math.cos(up), math.sin(up))), Vector((0, -math.sin(up), -math.cos(up))))
    local_g = C.inverted() @ (sw.inverted() @ world) @ C
    GRIPS["use"] = [round(a, 3) for a in three_euler(local_g.to_3x3())]
    json.dump({"rotation": GRIPS["use"]}, open(os.path.join(OUT, "grip.json"), "w"))
    print("GRIP", json.dumps(GRIPS["use"]))

item = pe.import_glb(ROD)
holder = bpy.data.objects.new("Held", None)
bpy.context.scene.collection.objects.link(holder)
holder.parent = socks["R"]
holder.matrix_parent_inverse.identity()
for o in item:
    if o.parent is None:
        o.parent = holder
tip = bpy.data.objects.new("Tip", None)                 # the rod's tip, up its blank (+z in the model)
bpy.context.scene.collection.objects.link(tip)
tip.parent = holder
tip.location = (0, 0.04, 0.8)

SHOTS = [("CastWindup", [0, 0.35, 0.7, 1.0]), ("CastSwing", [0, 0.15, 0.3, 0.36, 0.52, 1.0]), ("FishHold", [0, 0.5]),
         ("HookYank", [0, 0.28, 0.5, 1.0]), ("Reel", [0, 0.25, 0.5, 0.75]), ("HoldUp", [0, 0.5]), ("Cheer", [0.34, 0.64]), ("Sad", [0.5])]
rows = []
for clip, phases in SHOTS:
    for t in phases:
        pe.use_action(rig, clip, t)
        holder.matrix_basis = euler_matrix(GRIPS["use"] if clip != "HoldUp" else GRIPS["carry"])
        for o in item:
            o.hide_render = clip == "HoldUp"
        for tag, yaw in (("side", 90), ("front", 30)):
            root.rotation_euler = (0, 0, math.radians(yaw))
            bpy.context.view_layer.update()
            if tag == "side":
                d = (tip.matrix_world.translation - holder.matrix_world.translation)
                d = Matrix.Rotation(-math.radians(yaw), 4, "Z") @ d       # back into the character's own axes
                d.normalize()
                rows.append(f"{clip}@{t:.2f} rod {d.x:+.2f} {d.y:+.2f} {d.z:+.2f}  up {math.degrees(math.asin(max(-1, min(1, d.z)))):+.0f} deg")
            st.shot(os.path.join(OUT, f"{clip}_{t:.2f}_{tag}.png"), char + (item if clip != "HoldUp" else []), elev=10, res=(300, 360), pad=1.08)
print("\n".join(rows))
print("RENDER_OK", OUT)
