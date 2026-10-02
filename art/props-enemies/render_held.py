"""Held items on the v7 character (specs/game-ui.md §2): solve each hold's grip in the hand and review it.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_held.py -- <frames_dir>

For each hold (build_clips.py HoldRod, HoldTool, HoldFront) the item's frame is chosen in the world at the clip's
first frame (the rod back over the right shoulder, the net up and forward, the shovel's blade down in front, a
fruit between the hands) and expressed in the right hand socket's space as the engine attaches it
(Character.tsx HELD_GRIPS: three.js Euler XYZ in socket space, and an offset). Prints the grips as JSON and renders
the character holding each tool (front and three-quarter), and the Eat clip's frames.
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
C = Matrix.Rotation(math.pi / 2, 4, "X")          # glTF (y-up) -> Blender (z-up), as pe.grip_matrix

# Each hold: the clip, the item's +Z (its long axis) and -Y (its front) in the world, the item's centre relative to
# the right socket (None: the grip is the socket), and the review model.
T = lambda k, t: os.path.join(ROOT, "web", "public", "assets", "game", "tools", f"{k}-{t}.glb")
HOLDS = {
    "rod": ("HoldRod", Vector((-0.34, 0.74, 0.58)), Vector((0.0, -0.45, -0.9)), None, T("rod", 3)),
    "net": ("HoldTool", Vector((-0.32, -0.42, 0.85)), Vector((0.0, -1.0, 0.25)), None, T("net", 2)),
    "shovel": ("HoldTool", Vector((0.1, 0.8, 0.59)), Vector((0.0, -1.0, 0.45)), None, T("shovel", 5)),
    "glider": ("HoldTool", Vector((-0.62, 0.15, 0.77)), Vector((0.0, -1.0, 0.0)), None, os.path.join(ROOT, "web", "public", "assets", "game", "props", "leaf-glider.glb")),
    "front": ("HoldFront", Vector((0, 0, 1)), Vector((0, -1, 0)), "front", None),
    # In use: the grip while the tool's own clip plays (the engine eases to it): the cast, the swing, the dig.
    "rod_use": ("Fish@0.58", Vector((0.0, -0.85, 0.53)), Vector((0.0, 0.0, -1.0)), None, T("rod", 3)),
    "net_use": ("Net@0.48", Vector((0.25, -0.93, 0.26)), Vector((0.0, -0.3, -1.0)), None, T("net", 2)),
    "shovel_use": ("Dig@0.42", Vector((0.0, 0.35, 0.94)), Vector((0.0, -1.0, 0.2)), None, T("shovel", 5)),
}


def frame(z, front):
    """A rotation whose +Z is z and whose -Y is as close to `front` as it can be."""
    z = z.normalized()
    y = -(front - z * front.dot(z)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_4x4()


def three_euler(m):
    """three.js Euler XYZ (m = Rx Ry Rz) of a 3x3 rotation."""
    m13, m23, m33, m12, m11, m32, m22 = m[0][2], m[1][2], m[2][2], m[0][1], m[0][0], m[2][1], m[1][1]
    ey = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        return [math.atan2(-m23, m33), ey, math.atan2(-m12, m11)]
    return [math.atan2(m32, m22), ey, 0.0]


grips = {}
for kind, (clip, z, front, centre, url) in HOLDS.items():
    name, at = (clip.split("@") + ["0"])[:2]
    pe.use_action(rig, name, float(at))
    root.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    sw = socks["R"].matrix_world.normalized()
    pos = Matrix.Translation(sw.translation)
    if centre == "front":          # between the hands, a little forward and up
        mid = (socks["R"].matrix_world.translation + socks["L"].matrix_world.translation) / 2 + Vector((0, -0.03, 0.02))
        pos = Matrix.Translation(mid)
    world = pos @ frame(z, front)
    local_b = sw.inverted() @ world                  # in the socket's (Blender) space
    local_g = C.inverted() @ local_b @ C              # the engine's socket space (glTF axes)
    rot = [round(a, 3) for a in three_euler(local_g.to_3x3())]
    off = [round(v, 4) for v in local_g.translation]
    grips[kind] = {"clip": name, "rotation": rot, "offset": off}

    if url:
        item = pe.import_glb(url)
        holder = bpy.data.objects.new("Held", None)
        bpy.context.scene.collection.objects.link(holder)
        holder.parent = socks["R"]
        holder.matrix_parent_inverse.identity()
        holder.matrix_basis = C @ (Matrix.Translation(local_g.translation) @ Matrix.LocRotScale(None, local_g.to_quaternion(), None)) @ C.inverted()
        if kind == "glider":
            holder.scale = (0.45, 0.45, 0.45)
        for o in item:
            if o.parent is None:
                o.parent = holder
        for tag, yaw in (("a", 0), ("b", 35), ("c", 120)):
            root.rotation_euler = (0, 0, math.radians(yaw))
            st.shot(os.path.join(OUT, f"held_{kind}_{tag}.png"), char + item, elev=12, res=(320, 380))
        bpy.data.objects.remove(holder, do_unlink=True)
        for o in item:
            bpy.data.objects.remove(o, do_unlink=True)

# Eat: its frames, with a stand-in fruit between the hands (the hold's offset), front and side.
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, segments=12, ring_count=8)
fruit = bpy.context.object
mat = bpy.data.materials.new("Fruit")
next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.7, 0.08, 0.06, 1)
fruit.data.materials.append(mat)
g = grips["front"]
fruit.parent = socks["R"]
fruit.matrix_parent_inverse.identity()
fruit.matrix_basis = C @ Matrix.Translation(Vector(g["offset"])) @ C.inverted()
for i, t in enumerate((0.0, 0.22, 0.34, 0.44, 0.56, 0.82)):
    pe.use_action(rig, "Eat", t)
    for tag, yaw in (("a", 20), ("b", 90)):
        root.rotation_euler = (0, 0, math.radians(yaw))
        st.shot(os.path.join(OUT, f"eat_{i}_{tag}.png"), char + [fruit], elev=10, res=(260, 340))

print("GRIPS", json.dumps(grips))
json.dump(grips, open(os.path.join(OUT, "grips.json"), "w"), indent=1)
print("RENDER_OK", OUT)
