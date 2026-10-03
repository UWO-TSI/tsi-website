"""Review sheets for the Warden wave's models (build_warden.py), from the exported GLBs, next to the v6 character.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_warden.py -- <weapons|bodies> <frames_dir>

weapons: each signature type's five tiers side by side, and tiers 1 and 5 in the hand (idle, the attack frame) and on
the back, with the engine's grip (Character.tsx GRIP: melee for the gloves, staff for the staffs).
bodies: each beast, untamed form, totem, spirit and prop alone (two angles) and beside the character for scale.
Writes <frames_dir>/<mode>_cells.json and the sheet (sheet.py); the evidence WebPs are made from it by the caller.
"""
import bpy, json, math, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pe  # noqa: E402

MODE, FR = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(FR, exist_ok=True)
pe.reset()
st = pe.Stage(bg=(0.86, 0.88, 0.84, 1))
root, rig, socks = pe.load_character()
char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
f = lambda *a: os.path.join(FR, "_".join(a) + ".png")
cells = []


def show_char(on):
    for o in char:
        o.hide_render = not on


def turntable(objs, at=(0, 0, 0), yaw=35):
    t = bpy.data.objects.new("Turn", None)
    bpy.context.scene.collection.objects.link(t)
    t.location = at
    t.rotation_euler = (0, 0, math.radians(yaw))
    for o in objs:
        if o.parent is None:
            o.parent = t
    return t


def drop(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)


if MODE == "weapons":
    KIND = {"seal-gloves": "melee", "totem-staff": "staff", "living-staff": "staff", "sunstone-staff": "staff"}
    ATTACK = {"melee": ("AttackMelee", 0.3), "staff": ("AttackCast", 0.3)}
    for kind, wk in KIND.items():
        frames = []
        show_char(False)
        for t in range(1, 6):
            alone = pe.import_glb(os.path.join(pe.ASSETS, "weapons", f"{kind}-{t}.glb"))
            tt = turntable(alone, (6, 0, 0), 35 if wk == "staff" else 120)
            st.shot(f(kind, str(t)), alone, elev=14, res=(200, 300) if wk == "staff" else (200, 200), pad=1.25, ground=False)
            frames.append(f(kind, str(t)))
            drop(alone + [tt])
        show_char(True)
        cells.append((f"{kind}: tiers 1-5 (trim kit)", frames))
        held_frames = []
        for t in (1, 5):
            held = pe.import_glb(os.path.join(pe.ASSETS, "weapons", f"{kind}-{t}.glb"))
            holder = pe.attach(held, socks[pe.HAND[wk]], wk, True)
            for tag, (clip, at), yaw in (("idle", ("Idle", 0.0), 35), ("attack", ATTACK[wk], 35)):
                pe.use_action(rig, clip, at)
                root.rotation_euler = (0, 0, math.radians(yaw))
                st.shot(f(kind, str(t), tag), char + held, elev=15, res=(260, 340))
                held_frames.append(f(kind, str(t), tag))
            drop([holder])
            holder = pe.attach(held, socks["Back"], wk, False)
            pe.use_action(rig, "Idle", 0.0)
            root.rotation_euler = (0, 0, math.radians(150))
            st.shot(f(kind, str(t), "back"), char + held, elev=15, res=(260, 340))
            held_frames.append(f(kind, str(t), "back"))
            drop(held + [holder])
        root.rotation_euler = (0, 0, 0)
        cells.append((f"{kind}: tier 1 and 5 in hand (idle, attack) and on the back", held_frames))
else:
    LIFT = {"beast-owl": 1.5 / 1.3, "spirit-thunderbird": 2.2 / 1.3}
    SUB = {"beast-wolf": "enemies", "beast-owl": "enemies", "beast-toad": "enemies", "beast-serpent": "enemies", "shadow-owl": "enemies", "shadow-toad": "enemies",
           "shadow-serpent": "enemies", "shadow-hare": "enemies", "totem-storm": "enemies", "totem-fire": "enemies", "totem-earth": "enemies", "totem-spirit": "enemies",
           "spirit-thunderbird": "enemies", "spirit-salamander": "enemies", "spirit-bear": "enemies", "world-tree": "props", "thorn-wall": "props", "rabbit": "props"}
    for mid, sub in SUB.items():
        pe.use_action(rig, "Idle", 0.0)
        parts = pe.import_glb(os.path.join(pe.ASSETS, sub, f"{mid}.glb"))
        tt = turntable(parts, (0, 0, LIFT.get(mid, 0)))
        bpy.context.view_layer.update()
        xs = [(o.matrix_world @ v.co).x for o in parts if o.type == "MESH" for v in o.data.vertices]
        root.location = (max(xs) + 0.3, 0, 0)
        root.rotation_euler = (0, 0, math.radians(35))
        st.shot(f(mid, "a"), char + parts, elev=18, res=(380, 360))
        show_char(False)
        tt.rotation_euler = (0, 0, math.radians(-35))
        st.shot(f(mid, "b"), parts, elev=22, res=(340, 340))
        tt.rotation_euler = (0, 0, math.radians(160))
        st.shot(f(mid, "c"), parts, elev=40, res=(340, 340))
        show_char(True)
        cells.append((mid, [f(mid, x) for x in "abc"]))
        drop(parts + [tt])
        root.rotation_euler = (0, 0, 0)

cj = os.path.join(FR, f"{MODE}_cells.json")
json.dump(cells, open(cj, "w"))
subprocess.run(["python3", os.path.join(HERE, "sheet.py"), os.path.join(FR, f"warden_{MODE}.png"), "1" if MODE == "weapons" else "2", cj], check=True)
print("RENDER_OK", MODE)
