"""The foraging and crafting clips on the v7 character (build_clips.py Pickup, Shake, Strike, Craft, with Dig beside them),
and the hammer's grips (specs/polish/forage-craft-museum.md).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_forage_clips.py -- <frames_dir>

Solves the hammer's hold and its grip while the Craft clip plays the way render_held.py solves the tools' (the item's
frame chosen in the world at the clip's phase, expressed in the right hand socket's space as Character.tsx attaches it:
three.js Euler XYZ), prints them as GRIPS, and renders each clip at its key phases, three-quarter front and side, with
the tool in hand. Tiling the frames into specs/evidence/polish-forage/ is the caller's (sheets.py).
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import pe  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
pe.CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v7_clips.glb")
pe.reset()
st = pe.Stage(bg=(0.94, 0.91, 0.84, 1))
root, rig, socks = pe.load_character()
char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
C = Matrix.Rotation(math.pi / 2, 4, "X")
HAMMER = os.path.join(ROOT, "web", "public", "assets", "game", "forage", "hammer.glb")
SHOVEL = os.path.join(ROOT, "web", "public", "assets", "game", "tools", "shovel-1.glb")
# Character.tsx's shovel grips (HELD_GRIPS.shovel and the Dig use grip), three.js Euler XYZ in socket space.
SHOVEL_GRIP, SHOVEL_USE = (-0.461, 0.175, -1.611), (-1.087, -0.652, -1.79)


def frame(z, front):
    z = z.normalized()
    y = -(front - z * front.dot(z)).normalized()
    return Matrix((y.cross(z), y, z)).transposed().to_4x4()


def three_euler(m):
    m13, m23, m33, m12, m11, m32, m22 = m[0][2], m[1][2], m[2][2], m[0][1], m[0][0], m[2][1], m[1][1]
    ey = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        return [math.atan2(-m23, m33), ey, math.atan2(-m12, m11)]
    return [math.atan2(m32, m22), ey, 0.0]


def euler_matrix(e):
    return C @ (Matrix.Rotation(e[0], 4, "X") @ Matrix.Rotation(e[1], 4, "Y") @ Matrix.Rotation(e[2], 4, "Z")) @ C.inverted()


# The hammer: held at the side like the net (the handle up, the face forward), and in use (Craft's blows) the handle out
# over the bench and the face down onto it. The shovel striking a rock (Strike's hit): the blade swung forward and down
# onto the rock in front, the handle back up to the hands (the dig's grip drove it into the ground at the feet).
SOLVE = {"hammer": ("HoldTool", 0.0, Vector((-0.2, -0.35, 0.92)), Vector((0.0, -1.0, 0.1))),
         "hammer_use": ("Craft", 0.24, Vector((0.05, -0.97, 0.22)), Vector((0.0, -0.15, -1.0))),
         "shovel_strike": ("Strike", 0.46, Vector((0.0, 0.77, 0.64)), Vector((0.0, -1.0, 0.0)))}
grips = {}
for kind, (clip, at, z, front) in SOLVE.items():
    pe.use_action(rig, clip, at)
    root.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    sw = socks["R"].matrix_world.normalized()
    local_g = C.inverted() @ (sw.inverted() @ (Matrix.Translation(sw.translation) @ frame(z, front))) @ C
    grips[kind] = {"clip": clip, "rotation": [round(a, 3) for a in three_euler(local_g.to_3x3())]}
print("GRIPS", json.dumps(grips))


def hold(url, euler):
    item = pe.import_glb(url)
    holder = bpy.data.objects.new("Held", None)
    bpy.context.scene.collection.objects.link(holder)
    holder.parent = socks["R"]
    holder.matrix_parent_inverse.identity()
    holder.matrix_basis = euler_matrix(euler)
    for o in item:
        if o.parent is None:
            o.parent = holder
    return holder, item


def drop(holder, item):
    bpy.data.objects.remove(holder, do_unlink=True)
    for o in item:
        bpy.data.objects.remove(o, do_unlink=True)


# A fixed invisible frame round the character: every frame of a strip is shot at the same scale.
bpy.ops.mesh.primitive_cube_add(size=1)
FRAME = bpy.context.object
FRAME.scale, FRAME.location = (1.0, 1.0, 1.25), (0, -0.12, 0.6)
FRAME.data.materials.append(pe.materials({"M_Frame": ("#ffffff", 0, 0)})["M_Frame"])

CLIPS = [("Pickup", (0.0, 0.3, 0.4, 0.7, 0.84), None),
         ("Shake", (0.16, 0.26, 0.36, 0.46, 0.8), None),
         ("Strike", (0.3, 0.46, 0.56, 0.66), ("shovel", grips["shovel_strike"]["rotation"])),
         ("Craft", (0.1, 0.17, 0.24, 0.32, 0.56, 0.8), ("hammer", grips["hammer_use"]["rotation"])),
         ("Dig", (0.2, 0.42, 0.62), ("shovel", SHOVEL_USE))]
for name, phases, tool in CLIPS:
    held = hold(SHOVEL if tool and tool[0] == "shovel" else HAMMER, tool[1]) if tool else None
    objs = char + (held[1] if held else []) + [FRAME]
    for i, p in enumerate(phases):
        pe.use_action(rig, name, p)
        for tag, yaw in (("a", 35), ("b", 90)):
            root.rotation_euler = (0, 0, math.radians(yaw))
            st.shot(os.path.join(OUT, f"{name}_{tag}_{i:02d}.png"), objs, elev=10, res=(220, 260), pad=1.0)
    if held:
        drop(*held)
json.dump({"grips": grips, "clips": [[n, list(p)] for n, p, _ in CLIPS]}, open(os.path.join(OUT, "clips.json"), "w"), indent=1)
print("RENDER_OK", OUT)
