"""Review renders of the Vanguard signature weapons: every tier alone, and in hand and on the back as the engine holds them.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_vanguard_weapons.py -- <frames_dir> [off_rx off_ry off_rz ...]

In hand: Character.tsx GRIP (melee: three.js Euler [pi/2, 0, 0] in the hand socket), the OffHand node in the other hand at
the weapon's `grip.off` (web/lib/game/combat/data.ts), on the back at GRIP's back rotation. The frames are tiled into
specs/evidence/classes/K-vanguard-weapons.webp by the caller.
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
W = os.path.join(ROOT, "web", "public", "assets", "game", "weapons")
C = Matrix.Rotation(math.pi / 2, 4, "X")
TYPES = {"aegis": ["oak", "iron", "rune", "gilt", "dawn"], "warhammer": ["timber", "iron", "rune", "gilt", "quake"],
         "handwraps": ["cotton", "iron", "rune", "gilt", "sun"], "tanto": ["plain", "iron", "rune", "gilt", "lotus"]}
# The engine's grips (three.js Euler XYZ in socket space): the weapon's, its off hand's, its back's. Kept in step with data.ts.
GRIPS = json.load(open(os.path.join(HERE, "vanguard_grips.json")))


def euler_matrix(e):
    m = Matrix.Rotation(e[0], 4, "X") @ Matrix.Rotation(e[1], 4, "Y") @ Matrix.Rotation(e[2], 4, "Z")
    return C @ m @ C.inverted()


def hold(objs, socket, euler):
    h = bpy.data.objects.new("Held", None)
    bpy.context.scene.collection.objects.link(h)
    h.parent = socket
    h.matrix_parent_inverse.identity()
    h.matrix_basis = euler_matrix(euler)
    for o in objs:
        o.parent = h
        o.matrix_parent_inverse.identity()
    return h


pe.reset()
st = pe.Stage(bg=(0.94, 0.91, 0.84, 1))
# 1. Every tier alone, three-quarter front.
for t, names in TYPES.items():
    for n in names:
        objs = pe.import_glb(os.path.join(W, f"{t}-{n}.glb"))
        for o in objs:
            if o.parent is None:                                 # the importer leaves quaternions: turn the root about the vertical
                o.rotation_mode = "XYZ"
                o.rotation_euler = (0, 0, math.radians(80 if t == "warhammer" else 30))   # the hammer's head side on
        st.shot(os.path.join(OUT, f"alone_{t}_{n}.png"), objs, elev=14, res=(220, 300), ground=False)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
objs = pe.import_glb(os.path.join(W, "kunai.glb"))
st.shot(os.path.join(OUT, "alone_kunai.png"), objs, elev=14, res=(220, 300), ground=False)
for o in objs:
    bpy.data.objects.remove(o, do_unlink=True)

# 2. In hand (the clip's frame) and on the back, front and three-quarter.
pe.CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v7_clips.glb")
root, rig, socks = pe.load_character()
char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground and o.parent is not None]
for t, names in TYPES.items():
    g = GRIPS[t]
    for n, pose in ((names[3], "hand"), (names[0], "back")):
        objs = pe.import_glb(os.path.join(W, f"{t}-{n}.glb"))
        main = [o for o in objs if o.name != "OffHand" and o.parent is None]
        off = [o for o in objs if o.name == "OffHand"]
        if pose == "hand":
            pe.use_action(rig, g.get("clip", "Idle"), g.get("at", 0.0))
            hm = hold(main, socks[g.get("main", "R")], g["hand"])
            ho = hold(off, socks["L" if g.get("main", "R") == "R" else "R"], g.get("off", g["hand"])) if off else None
        else:
            pe.use_action(rig, "Idle", 0.0)
            hm = hold(objs, socks["Back"], g["back"])          # the off part rides along at its parked spot
            ho = None
        for tag, yaw in (("a", 0), ("b", 40), ("c", 110)):
            root.rotation_euler = (0, 0, math.radians(yaw if pose == "hand" else yaw + 180))
            st.shot(os.path.join(OUT, f"{pose}_{t}_{tag}.png"), char + objs, elev=10, res=(260, 340))
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
        for h in (hm, ho):
            if h:
                bpy.data.objects.remove(h, do_unlink=True)
print("RENDER_OK", OUT)
