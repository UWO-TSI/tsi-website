"""Review contact sheets next to the v6 character: weapons_sheet.png, enemies_sheet.png, props_sheet.png.
Imports the exported GLBs, so the frames check the exports. Weapons ride the hand socket with the engine's GRIP.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/render_sheets.py -- <weapons|enemies|props> <frames_dir> [id ...]
"""
import bpy, json, math, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pe  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
MODE, FR, ONLY = args[0], args[1], set(args[2:])
os.makedirs(FR, exist_ok=True)
CAT = json.load(open(os.path.join(HERE, "catalog.json")))[MODE]
KIND = {"sword-driftwood": "melee", "sword-iron": "melee", "bow-willow": "bow", "bow-yew": "bow",
        "revolver-brass": "bow", "staff-oak": "staff", "staff-rune": "staff", "tome-spirits": "summon"}
LIFT = {"rune-wisp": 1.1 / 1.3, "message-bottle": 0.14 / 1.3}   # engine offsets (wisp hover, bottle on the sand), world units
ATTACK = {"melee": ("AttackMelee", 0.3), "bow": ("AttackBow", 0.5), "staff": ("AttackCast", 0.3), "summon": ("AttackCast", 0.3)}

pe.reset()
st = pe.Stage()
root, rig, socks = pe.load_character()
char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
glb = lambda mid: os.path.join(pe.ASSETS, MODE, f"{mid}.glb")
f = lambda *a: os.path.join(FR, "_".join(a) + ".png")
cells = []


def turntable(objs, at=(0, 0, 0)):
    t = bpy.data.objects.new("Turn", None)
    bpy.context.scene.collection.objects.link(t)
    t.location = at
    for o in objs:
        if o.parent is None:
            o.parent = t
    return t


def show_char(on):
    for o in char:
        o.hide_render = not on


for mid, entry in CAT.items():
    if ONLY and mid not in ONLY:
        continue
    label = f"{mid}  {entry['tris']} tris"
    if MODE == "weapons":
        kind = KIND[mid]
        held = pe.import_glb(glb(mid))
        holder = pe.attach(held, socks[pe.HAND[kind]], kind, True)
        for tag, (clip, t), yaw in (("a", ("Idle", 0.0), 35), ("b", ("Idle", 0.0), 0), ("c", ATTACK[kind], 35)):
            pe.use_action(rig, clip, t)
            root.rotation_euler = (0, 0, math.radians(yaw))
            st.shot(f(mid, tag), char + held, elev=15, res=(300, 380))
        bpy.data.objects.remove(holder, do_unlink=True)
        holder = pe.attach(held, socks["Back"], kind, False)             # carried on the back outside the ruins
        pe.use_action(rig, "Idle", 0.0)
        root.rotation_euler = (0, 0, math.radians(150))
        st.shot(f(mid, "e"), char + held, elev=15, res=(300, 380))
        alone = pe.import_glb(glb(mid))
        tt = turntable(alone, (6, 0, 0))
        tt.rotation_euler = (0, 0, math.radians(35))
        st.shot(f(mid, "d"), alone, elev=12, res=(300, 380), pad=1.2, ground=False)
        cells.append((f"{label}  ({kind}, {pe.HAND[kind]} hand)", [f(mid, x) for x in "abced"]))
        for o in held + alone + [holder, tt]:
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        pe.use_action(rig, "Idle", 0.0)
        parts = pe.import_glb(glb(mid))
        tt = turntable(parts, (0, 0, LIFT.get(mid, 0)))
        bpy.context.view_layer.update()
        xs = [(o.matrix_world @ v.co).x for o in parts if o.type == "MESH" for v in o.data.vertices]
        root.location = (max(xs) + 0.3, 0, 0)
        for tag, yaw in (("a", 35), ("b", 0)):
            tt.rotation_euler = root.rotation_euler = (0, 0, math.radians(yaw))
            st.shot(f(mid, tag), char + parts, elev=18, res=(420, 380))
        show_char(False)
        tt.rotation_euler = (0, 0, math.radians(-35))
        st.shot(f(mid, "c"), parts, elev=24, res=(380, 380))
        show_char(True)
        cells.append((f"{label}  parts: {', '.join(entry['parts'])}", [f(mid, x) for x in "abc"]))
        for o in parts + [tt]:
            bpy.data.objects.remove(o, do_unlink=True)
        root.rotation_euler = (0, 0, 0)

cells_json = os.path.join(FR, f"{MODE}_cells.json")
json.dump(cells, open(cells_json, "w"))
out = os.path.join(HERE, f"{MODE}_sheet.png") if not ONLY else os.path.join(FR, f"{MODE}_partial.png")
subprocess.run(["python3", os.path.join(HERE, "sheet.py"), out, "2", cells_json], check=True)
print("RENDER_OK", MODE)
