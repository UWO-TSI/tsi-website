"""The sushi bar's staff clips (build_clips.py `-- staff`: SushiSlice, SushiShape, SushiServe) on the v8 character, and
the knife's grip while he slices (game/sushi-bar round 3).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/render_sushi_staff.py -- <frames_dir>

Solves the knife's grip in SushiSlice the way render_forage_clips.py solves the hammer's (the blade along the stroke,
its edge down, expressed in the right hand socket's space as Character.tsx attaches it: three.js Euler XYZ) and prints
it as GRIPS; renders each clip at its key phases, three-quarter front and side, the knife in hand while slicing.
Tiling the frames into a sheet is the caller's (magick montage).
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "props-enemies"))
import pe  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
pe.CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v8_clips.glb")
pe.reset()
st = pe.Stage(bg=(0.94, 0.91, 0.84, 1))
root, rig, socks = pe.load_character()
char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
for o in pe.import_glb(os.path.join(ROOT, "art", "characters", "base", "v8_staff.glb")):     # its actions join the rig's
    bpy.data.objects.remove(o, do_unlink=True)
C = Matrix.Rotation(math.pi / 2, 4, "X")
KNIFE = os.path.join(ROOT, "web", "public", "assets", "game", "tools", "sushi-knife.glb")


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


# The knife mid-stroke: the blade forward and a little in to the left and down onto the fish, the edge down.
SOLVE = {"knife_slice": ("SushiSlice", 0.3, Vector((0.45, -0.8, -0.4)), Vector((0.0, -0.25, -1.0)))}
grips = {}
for kind, (clip, at, z, front) in SOLVE.items():
    pe.use_action(rig, clip, at)
    root.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    sw = socks["R"].matrix_world.normalized()
    local_g = C.inverted() @ (sw.inverted() @ (Matrix.Translation(sw.translation) @ frame(z, front))) @ C
    grips[kind] = {"clip": clip, "rotation": [round(a, 3) for a in three_euler(local_g.to_3x3())]}
print("GRIPS", json.dumps(grips))

item = pe.import_glb(KNIFE)
holder = bpy.data.objects.new("Held", None)
bpy.context.scene.collection.objects.link(holder)
holder.parent = socks["R"]
holder.matrix_parent_inverse.identity()
holder.matrix_basis = euler_matrix(grips["knife_slice"]["rotation"])
for o in item:
    if o.parent is None:
        o.parent = holder

bpy.ops.mesh.primitive_cube_add(size=1)
FRAME = bpy.context.object
FRAME.scale, FRAME.location = (1.0, 1.0, 1.25), (0, -0.12, 0.6)
FRAME.data.materials.append(pe.materials({"M_Frame": ("#ffffff", 0, 0)})["M_Frame"])
CLIPS = [("SushiSlice", (0.1, 0.3, 0.48, 0.68, 0.92), True), ("SushiShape", (0.12, 0.28, 0.56, 0.7, 0.88), False),
         ("SushiServe", (0.0, 0.3, 0.55, 0.85), False)]
for name, phases, knife in CLIPS:
    for o in item:
        o.hide_render = not knife
    for i, p in enumerate(phases):
        pe.use_action(rig, name, p)
        for tag, yaw in (("a", 35), ("b", 90)):
            root.rotation_euler = (0, 0, math.radians(yaw))
            st.shot(os.path.join(OUT, f"{name}_{tag}_{i:02d}.png"), char + (item if knife else []) + [FRAME], elev=10, res=(220, 260), pad=1.0)
json.dump({"grips": grips, "clips": [[n, list(p)] for n, p, _ in CLIPS]}, open(os.path.join(OUT, "clips.json"), "w"), indent=1)
print("RENDER_OK", OUT)
