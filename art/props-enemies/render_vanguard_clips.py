"""Evidence frames of the Vanguard clips (build_clips.py, baked into base/v7_verbs.glb) with each kit's weapon in hand.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_vanguard_clips.py -- <frames_dir>

Renders, from the side (the Martial Artist's chain in slow motion: eight frames a strike) and three-quarter front, every
clip at its key phases, and each ult beat by beat. The weapons are held as the engine holds them (vanguard_grips.json).
Tiling into specs/evidence/classes/K-vanguard-*.webp is the caller's.
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import pe  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
C = Matrix.Rotation(math.pi / 2, 4, "X")
GRIPS = json.load(open(os.path.join(HERE, "vanguard_grips.json")))
CAT = {c["name"]: c for c in json.load(open(os.path.join(ROOT, "art", "characters", "character_catalog.json")))["verbs"]["clips"]}
W = os.path.join(ROOT, "web", "public", "assets", "game", "weapons")
WEAPON = {"aegis": "aegis-iron", "warhammer": "warhammer-iron", "handwraps": "handwraps-gilt", "tanto": "tanto-iron"}


def euler_matrix(e):
    return C @ (Matrix.Rotation(e[0], 4, "X") @ Matrix.Rotation(e[1], 4, "Y") @ Matrix.Rotation(e[2], 4, "Z")) @ C.inverted()


pe.reset()
st = pe.Stage(bg=(0.94, 0.91, 0.84, 1))
pe.CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v7_clips.glb")
root, rig, socks = pe.load_character()
char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground and o.parent is not None]
before = set(bpy.data.objects)
pe.import_glb(os.path.join(ROOT, "art", "characters", "base", "v7_verbs.glb"))
for a in bpy.data.actions:
    a.use_fake_user = True
for o in set(bpy.data.objects) - before:
    bpy.data.objects.remove(o, do_unlink=True)


def arm_weapon(t):
    objs = pe.import_glb(os.path.join(W, f"{WEAPON[t]}.glb"))
    g = GRIPS[t]
    holders = []
    for part, sock, e in ((([o for o in objs if o.name != "OffHand" and o.parent is None]), socks["R"], g["hand"]), ([o for o in objs if o.name == "OffHand"], socks["L"], g.get("off", g["hand"]))):
        if not part:
            continue
        h = bpy.data.objects.new("Held", None)
        bpy.context.scene.collection.objects.link(h)
        h.parent = sock
        h.matrix_parent_inverse.identity()
        h.matrix_basis = euler_matrix(e)
        for o in part:
            o.parent = h
            o.matrix_parent_inverse.identity()
        holders.append(h)
    return objs, holders


# A fixed, invisible frame round the fighter: every frame of a strip is shot at the same scale (the body never jumps).
bpy.ops.mesh.primitive_cube_add(size=1)
FRAME = bpy.context.object
FRAME.scale, FRAME.location = (1.25, 1.25, 1.32), (0, -0.1, 0.62)
FRAME.data.materials.append(pe.materials({"M_Frame": ("#ffffff", 0, 0)})["M_Frame"])


def frames(clip, phases, yaw, tag, objs):
    out = []
    for i, p in enumerate(phases):
        pe.use_action(rig, clip, p)
        root.rotation_euler = (0, 0, math.radians(yaw))
        path = os.path.join(OUT, f"{tag}_{i:02d}.png")
        st.shot(path, [FRAME], elev=8, res=(200, 220), pad=1.0)
        out.append(path)
    return out


SIDE, FRONT = -90, 30                                               # the right side (the striking side), three-quarter front
JOBS_ALL = [
    # The Martial Artist's chain in slow motion from the side: jab, cross, hook, body kick, 8 frames each.
    ("handwraps", "chain", SIDE, [("Unique_Jab", 8), ("Unique_Cross", 8), ("Unique_Hook", 8), ("Unique_BodyKick", 8)]),
    ("handwraps", "techniques", FRONT, [("Unique_Teep", 6), ("Unique_Elbow", 6), ("Unique_ClinchKnees", 10), ("Unique_Roundhouse", 6), ("Unique_FlyingKnee", 6)]),
    ("handwraps", "ult", FRONT, [("Ult_MartialArtist", 18)]),
    ("aegis", "guardian", FRONT, [("Unique_AegisCut", 5), ("Unique_AegisBackcut", 5), ("Unique_AegisThrust", 5), ("Unique_ShieldRush", 5), ("Ult_Guardian", 6), ("Unique_AegisSlam", 6)]),
    ("warhammer", "juggernaut", FRONT, [("Unique_HammerSwing", 6), ("Unique_HammerOverhead", 6), ("Unique_Charge", 5), ("Unique_WarCry", 5), ("Unique_SeismicDrop", 5), ("Ult_Juggernaut", 6)]),
    ("tanto", "assassin", FRONT, [("Unique_TantoCut", 5), ("Unique_TantoBackcut", 5), ("Unique_ShadowStep", 5), ("Unique_InkLotus", 8), ("Unique_Execute", 5), ("Unique_Vault", 8), ("Ult_Assassin", 8)]),
]
JOBS = [j for j in JOBS_ALL if not os.environ.get("ONLY") or j[1] in os.environ["ONLY"].split(",")]   # ONLY=chain,ult: some sheets
index = []
for t, sheet, yaw, clips in JOBS:
    objs, holders = arm_weapon(t)
    for clip, n in clips:
        info = CAT[clip]
        phases = [k / (n - 1) for k in range(n)]
        # Always include the impact key exactly (the frame the engine freezes on).
        j = min(range(n), key=lambda k: abs(phases[k] - info["impact"]))
        phases[j] = info["impact"]
        files = frames(clip, phases, yaw, f"{sheet}_{clip}", objs)
        index.append({"sheet": sheet, "clip": clip, "files": files, "phases": [round(p, 3) for p in phases], "length": info["length"], "impact": info["impact"]})
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for h in holders:
        bpy.data.objects.remove(h, do_unlink=True)
json.dump(index, open(os.path.join(OUT, "index.json"), "w"), indent=1)
print("RENDER_OK", OUT, len(index))
