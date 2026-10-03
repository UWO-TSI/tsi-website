"""The Rangers' weapons sheet and their grips (classes v2): review renders of the exported GLBs, and the hold, rest and back
grips solved from the clips' frames (as render_held.py solves the tools').

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_ranger.py -- sheet <frames_dir>
  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_ranger.py -- grips <frames_dir>
  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_ranger.py -- clips <frames_dir>

`sheet`: every tier of the four signature weapons on its own, three-quarter view, into <frames_dir>/<id>.png.
`grips`: for the rifle and the harpoon crossbow (the Rifle grip, right hand), the weapon's frame chosen in the world at
the shooting verb's impact (barrel along the aim), the hold idle (barrel forward and down) and on the back (barrel up
over the left shoulder), each expressed in the socket's space as three.js Euler XYZ (Character.tsx WeaponGrip): printed
as JSON for lib/game/combat/data.ts, and the character rendered holding each signature weapon three ways.
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import pe  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
MODE, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)
TYPES = ["recurve", "rifle", "harpoon", "sixgun"]
glb = lambda wid: os.path.join(pe.ASSETS, "weapons", f"{wid}.glb")
C = Matrix.Rotation(math.pi / 2, 4, "X")          # glTF (y-up) -> Blender (z-up), as pe.grip_matrix


def three_euler(m):
    """three.js Euler XYZ (m = Rx Ry Rz) of a 3x3 rotation."""
    m13, m23, m33, m12, m11, m32, m22 = m[0][2], m[1][2], m[2][2], m[0][1], m[0][0], m[2][1], m[1][1]
    ey = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        return [math.atan2(-m23, m33), ey, math.atan2(-m12, m11)]
    return [math.atan2(m32, m22), ey, 0.0]


def frame(fwd, up):
    """A world rotation for a gun authored barrel -Y, up +Z: its -Y along `fwd`, its +Z as close to `up` as it goes."""
    y = -fwd.normalized()
    z = (up - y * up.dot(y)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed().to_4x4()


def socket_euler(socket, world_rot):
    """The rotation, in glTF socket space as three.js reads it, that puts the model at `world_rot` (Blender world)."""
    bpy.context.view_layer.update()
    sw = socket.matrix_world.to_3x3().normalized().to_4x4()
    local = sw.inverted() @ world_rot                     # Blender socket space
    gl = C.inverted() @ local @ C                         # glTF socket space (y-up)
    return [round(v, 3) for v in three_euler(gl.to_3x3())]


if MODE == "sheet":
    pe.reset()
    st = pe.Stage(bg=(0.94, 0.91, 0.84, 1))
    for kind in TYPES:
        for t in range(1, 6):
            wid = f"{kind}-{t}"
            objs = pe.import_glb(glb(wid))
            holder = bpy.data.objects.new("H", None)
            bpy.context.scene.collection.objects.link(holder)
            for o in objs:
                if o.parent is None:
                    o.parent = holder
            # Guns lie along Y: turn them to show their side; the bow stands.
            holder.rotation_euler = (0, 0, math.radians(-60 if kind != "recurve" else -30))
            holder.location = (0, 0, 0.35)
            st.shot(os.path.join(OUT, f"{wid}.png"), objs, elev=18, res=(320, 260), ground=False)
            for o in objs:
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.objects.remove(holder, do_unlink=True)
    print("SHEET_OK")

def labelled_montage(groups, out, width):
    """A contact sheet of one or more groups [(files [(path, label)], tile)], stacked: each image with its label
    underneath, on the evidence's dark ground, as WebP."""
    import subprocess, tempfile
    tmp = tempfile.mkdtemp(prefix="ranger_sheet_")
    parts = []
    for i, (files, tile) in enumerate(groups):
        args = []
        for path, label in files:
            args += ["-label", label, path]
        part = os.path.join(tmp, f"part{i}.png")
        subprocess.run(["magick", "montage", *args, "-tile", tile, "-geometry", f"{width}x+4+4", "-background", "#1b1f27", "-fill", "#f1ffff",
                        "-pointsize", "13", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf", part], check=True)
        parts.append(part)
    subprocess.run(["magick", *parts, "-background", "#1b1f27", "-gravity", "center", "-append", "-quality", "88", out], check=True)
    print("wrote", out)


EVIDENCE = os.path.join(ROOT, "specs", "evidence", "classes")

if MODE == "grips" or MODE == "clips":
    pe.CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v7_clips.glb")
    pe.reset()
    st = pe.Stage(bg=(0.94, 0.91, 0.84, 1))
    root, rig, socks = pe.load_character()
    char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
    verbs = pe.import_glb(os.path.join(ROOT, "art", "characters", "base", "v7_verbs.glb"))   # the verb library's actions
    for o in verbs:
        bpy.data.objects.remove(o, do_unlink=True)
    grips = {}
    # The Rifle grip (right hand): the barrel along the aim at the shot's impact; at rest in the hand (the arms of Idle,
    # Walk and Run: no hold idle is laid in the ruins yet) muzzle up by the shoulder, its top forward, the stock down by
    # the leg; on the back, up over the left shoulder with its top away from the back.
    want = {"hand": ("QuickShot_Rifle", 0.16, "R", Vector((0, -1, 0)), Vector((0, 0, 1))),
            "rest": ("Idle", 0.0, "R", Vector((0.0, -0.22, 0.97)), Vector((0, -1, 0))),
            "back": ("Idle", 0.0, "Back", Vector((0.55, 0.0, 0.83)), Vector((0, 1, 0)))}
    for key, (clip, t, sock, fwd, up) in want.items():
        pe.use_action(rig, clip, t)
        root.rotation_euler = (0, 0, 0)
        grips[key] = socket_euler(socks[sock], frame(fwd, up))
    print("RIFLE_GRIP", json.dumps(grips))
    json.dump(grips, open(os.path.join(OUT, "rifle_grip.json"), "w"), indent=1)
    BOW, REVOLVER = pe.GRIP["bow"], {"hand": [0.81, 1.41, -0.92], "rest": [0.53, 0.92, 0.85], "back": [math.pi / 2, 0, 0]}
    looks = {"recurve": ("L", "QuickShot_Bow", "HoldIdle_Bow", {"hand": list(BOW[0]), "rest": [0.03, 0.24, 1.15], "back": list(BOW[1])}),
             "rifle": ("R", "QuickShot_Rifle", "HoldIdle_Rifle", grips), "harpoon": ("R", "QuickShot_Rifle", "HoldIdle_Rifle", grips),
             "sixgun": ("L", "QuickShot_Pistol", "HoldIdle_Pistol", REVOLVER)}

    def hold(objs, sock, euler):
        h = bpy.data.objects.new("Held", None)
        bpy.context.scene.collection.objects.link(h)
        h.parent = socks[sock]
        h.matrix_parent_inverse.identity()
        m = Matrix.Rotation(euler[0], 4, "X") @ Matrix.Rotation(euler[1], 4, "Y") @ Matrix.Rotation(euler[2], 4, "Z")   # three.js XYZ
        h.matrix_basis = C @ m @ C.inverted()
        for o in objs:
            if o.parent is None:
                o.parent = h
        return h

    # Every signature weapon three ways: shooting (its grip's shot at the impact), at rest in hand, carried on the back.
    for kind, (sock, shot, idle, g) in (looks.items() if MODE == "grips" else []):
        for t in (1, 5):
            objs = pe.import_glb(glb(f"{kind}-{t}"))
            for tag, clip, at, s_, key, yaw in (("shoot", shot, 0.16, sock, "hand", 40), ("rest", "Idle", 0.0, sock, "rest", 35), ("back", "Idle", 0.0, "Back", "back", 160)):
                h = hold(objs, s_, g[key])
                pe.use_action(rig, clip, at)
                root.rotation_euler = (0, 0, math.radians(yaw))
                st.shot(os.path.join(OUT, f"held_{kind}-{t}_{tag}.png"), char + objs, elev=12, res=(300, 380))
                for o in objs:
                    o.parent = None
                bpy.data.objects.remove(h, do_unlink=True)
            for o in objs:
                bpy.data.objects.remove(o, do_unlink=True)
    if MODE == "grips":
        # The weapons sheet (run `sheet` into the same folder first): every tier alone, then T1 and T5 held three ways.
        alone = [(os.path.join(OUT, f"{k}-{t}.png"), f"{k}-{t}  T{t}") for k in TYPES for t in range(1, 6)]
        held = [(os.path.join(OUT, f"held_{k}-{t}_{tag}.png"), f"{k}-{t} {tag}") for k in TYPES for t in (1, 5) for tag in ("shoot", "rest", "back")]
        if all(os.path.exists(f) for f, _ in alone):
            labelled_montage([(alone, "5x"), (held, "6x")], os.path.join(EVIDENCE, "K-ranger-weapons.webp"), 260)
        print("GRIPS_OK")

    # The Rangers' clips, frame by frame with the weapon in hand: each ult (wind-up, the impact key the freeze holds,
    # follow-through), the reload and Fan the Hammer, and the Rifle grip's shots and hold idle.
    if MODE == "clips":
        cat = {c["name"]: c for c in json.load(open(os.path.join(ROOT, "art", "characters", "character_catalog.json")))["verbs"]["clips"]}
        strips = [("Ult_Marksman", "recurve-4"), ("Ult_Sniper", "rifle-4"), ("Ult_Hunter", "harpoon-4"), ("Ult_Gunslinger", "sixgun-4"),
                  ("Unique_Reload", "sixgun-1"), ("Unique_FanHammer", "sixgun-1"), ("QuickShot_Rifle", "rifle-1"), ("DrawShot_Rifle", "harpoon-1")]
        kind_of = {"recurve": "recurve", "rifle": "rifle", "harpoon": "harpoon", "sixgun": "sixgun"}
        files = []
        for clip, wid in strips:
            sock, _, _, g = looks[kind_of[wid.split("-")[0]]]
            objs = pe.import_glb(glb(wid))
            h = hold(objs, sock, g["hand"])
            imp = cat[clip]["impact"]
            for k, ph in enumerate((0.12, max(0.02, imp - 0.12), imp, min(0.97, imp + 0.12), min(0.97, imp + 0.32))):
                pe.use_action(rig, clip, ph)
                root.rotation_euler = (0, 0, math.radians(35))
                path = os.path.join(OUT, f"clip_{clip}_{k}.png")
                st.shot(path, char + objs, elev=10, res=(240, 300))
                files.append((path, f"{clip} {'impact' if ph == imp else f'{ph:.2f}'}"))
            for o in objs:
                o.parent = None
            bpy.data.objects.remove(h, do_unlink=True)
            for o in objs:
                bpy.data.objects.remove(o, do_unlink=True)
        labelled_montage([(files, "5x")], os.path.join(EVIDENCE, "K-ranger-clips.webp"), 240)
