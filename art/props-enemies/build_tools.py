"""The peaceful tools in five tiers each (row 279, specs/game-ui.md): rods, nets and shovels held in the hand.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_tools.py [-- render <dir>]

Writes web/public/assets/game/tools/<kind>-<tier>.glb (web/lib/game/tools.ts). The weapons' conventions
(build_weapons.py): rig units (the v6 character is 1.045 tall; the engine scales by 1.3), the grip at the origin =
the right hand's socket, Blender Z up, the character's front -Y. Rods and nets run up +Z from the grip, the net's
opening facing front (-Y) with the bag behind; the shovel's shaft runs down -Z from the grip to the blade, its scoop
facing front. Matte palette colours with the shared top-light gradient. With `render`, a review sheet of every
tool on its own at the icon angle. Stand-alone on art/characters/kit.py (pe.py's palette file is lost).
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from pe import lathe, rbox  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "assets", "game", "tools")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TAU = math.tau
bpy.ops.wm.read_factory_settings(use_empty=True)


def model(name, mats, build, grad=(0.8, 1.0)):
    m = {k: kit.material(f"{name}_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat=next(iter(mats)))
    build(pc)
    return pc.finish(name, None, m, sharp=50, grad=grad)


# ================================================================ rods: the grip at the origin, the blank up +Z
ROD = {
    1: dict(name="Flimsy rod", blank="#C9B07A", band="#9C8452", grip="#8E7350", line="#EDE6D4", reel=None, length=0.7, bamboo=True),
    2: dict(name="Cedar rod", blank="#9A5A3A", band="#6D3B26", grip="#C8A27A", line="#F2ECDD", reel="#B8925A", length=0.76),
    3: dict(name="Glass rod", blank="#8FC7C0", band="#5F9C97", grip="#E6DCC6", line="#F4F1E8", reel="#B9C3C6", length=0.8),
    4: dict(name="Lighthouse rod", blank="#E8E1D2", band="#C9463D", grip="#5A4636", line="#F4F1E8", reel="#C79A3E", length=0.84, stripes=True),
    5: dict(name="Tidewarden rod", blank="#2F6E73", band="#D2A845", grip="#E9DFC8", line="#F4F1E8", reel="#D2A845", length=0.88, shell=True),
}


def rod(tier):
    s = ROD[tier]
    L = s["length"]

    def bend(z):                    # the blank bows a touch toward its tip
        u = max(0.0, (z - 0.06) / (L - 0.06))
        return Vector((0, 0.04 * u * u, z))

    def b(pc):
        pc.mat = "Grip"
        lathe(pc, (0, 0, 0), [(0, -0.12), (0.016, -0.118), (0.019, -0.09), (0.019, 0.04), (0.015, 0.07)], n=7)
        pc.mat = "Blank"
        zs = [0.06 + (L - 0.06) * k / 6 for k in range(7)]
        pc.tube([bend(z) for z in zs], [0.0135 - 0.0075 * k / 6 for k in range(7)], sides=6, tip=True)
        pc.mat = "Band"
        # bands: the bamboo's knots, the lighthouse's red stripes, the warden's gold rings
        rings = [0.2, 0.36, 0.52] if s.get("bamboo") else [0.14, 0.26, 0.38, 0.5, 0.62, 0.74] if s.get("stripes") else [0.075, 0.3, 0.55]
        for z in rings:
            if z > L - 0.04:
                continue
            c = bend(z)
            r = 0.0135 - 0.0075 * (z - 0.06) / (L - 0.06)
            pc.tube([c - Vector((0, 0, 0.012 if s.get("stripes") else 0.006)), c + Vector((0, 0, 0.012 if s.get("stripes") else 0.006))], [r * 1.25, r * 1.25], sides=6, tip=False)
        if s["reel"]:
            pc.mat = "Reel"
            pc.tube([(0, -0.012, 0.02), (0, -0.034, 0.02)], [0.006, 0.006], sides=5, tip=False)
            lathe(pc, (0, -0.048, 0.02), [(0, -0.014), (0.03, -0.012), (0.032, 0.0), (0.03, 0.012), (0, 0.014)], n=9, axis=(1, 0, 0))
            pc.tube([(0.016, -0.048, 0.02), (0.03, -0.048, 0.006)], [0.004, 0.004], sides=4, tip=False)
            pc.blob((0.033, -0.048, 0.003), 0.008, segs=6, rings=4)
            if s.get("shell"):          # a little scallop on the reel's face
                lathe(pc, (-0.017, -0.048, 0.02), [(0, 0), (0.016, 0.003), (0, 0.007)], n=7, axis=(-1, 0, 0))
        pc.mat = "Line"
        start = Vector((0, -0.048, 0.034)) if s["reel"] else Vector((0, -0.012, 0.05))
        pts = [start] + [bend(z) + Vector((0, -0.012, 0)) for z in (0.2, 0.42, 0.64)] + [bend(L - 0.005) + Vector((0, -0.006, 0))]
        pc.tube(pts, [0.0022] * len(pts), sides=3, tip=False)
        if s.get("bamboo"):             # line wound round the stick where a reel would be
            pc.mat = "Line"
            lathe(pc, (0, 0, 0.09), [(0.0145, -0.02), (0.016, -0.01), (0.016, 0.01), (0.0145, 0.02)], n=7)
    mats = {"Grip": s["grip"], "Blank": s["blank"], "Band": s["band"], "Line": s["line"]}
    if s["reel"]:
        mats["Reel"] = s["reel"]
    return model(f"rod-{tier}", mats, b)


# ================================================================ nets: the pole up +Z, the hoop facing front, the bag behind
NET = {
    1: dict(pole="#B9925E", hoop="#7FA36A", bag="#EFE8D6", r=0.085, deep=0.15),
    2: dict(pole="#9E7448", hoop="#5E7FA0", bag="#D6E1E6", r=0.11, deep=0.17),
    3: dict(pole="#E3D2B0", hoop="#D9A0A8", bag="#FBF8F1", r=0.095, deep=0.17, ribbon="#E58F9C"),
    4: dict(pole="#4E8C8A", hoop="#3E6E6C", bag="#E4F0EC", r=0.1, deep=0.17, wings="#A9DDD3"),
    5: dict(pole="#5A3E78", hoop="#D2A845", bag="#F3EEF6", r=0.105, deep=0.18, wings="#E9A13B"),
}


def net(tier):
    s = NET[tier]
    top, r = 0.5, s["r"]
    c = Vector((0, 0, top + r))

    def ring(rr, y):
        return [c + Vector((math.sin(TAU * k / 12) * rr, y, math.cos(TAU * k / 12) * rr)) for k in range(12)]

    def b(pc):
        pc.mat = "Pole"
        pc.tube([(0, 0, -0.1), (0, 0, 0.2), (0, 0, top + 0.01)], [0.012, 0.011, 0.01], sides=6, tip=False)
        pc.blob((0, 0, -0.105), (0.015, 0.015, 0.013), segs=6, rings=4)
        pc.mat = "Hoop"
        pc.tube(ring(r, 0), [0.007] * 12, sides=5, closed_loop=True)
        pc.tube([(0, 0, top - 0.02), (0, 0, top + 0.006)], [0.013, 0.012], sides=6, tip=False)   # the ferrule
        pc.mat = "Bag"
        # the bag: a soft cone hanging back (+Y) and a little down from the hoop
        prof = [(r * 0.96, 0.0), (r * 0.9, s["deep"] * 0.35), (r * 0.66, s["deep"] * 0.7), (r * 0.3, s["deep"] * 0.94), (0, s["deep"])]
        lathe(pc, c + Vector((0, 0.002, 0)), prof, n=12, axis=(0, 0.92, -0.38), sy=1.0)
        if s.get("ribbon"):
            pc.mat = "Ribbon"
            for side in (-1, 1):
                pc.tube([(0, -0.002, top - 0.015), (side * 0.03, -0.01, top - 0.05), (side * 0.04, -0.012, top - 0.085)], [(0.009, 0.002)] * 3, sides=4, tip=False)
        if s.get("wings"):
            pc.mat = "Wings"
            for side in (-1, 1):
                base = c + Vector((side * r, 0, 0))
                pc.blob(base + Vector((side * 0.03, 0, 0.022)), (0.03, 0.005, 0.02), segs=6, rings=3)
                pc.blob(base + Vector((side * 0.025, 0, -0.016)), (0.022, 0.005, 0.015), segs=6, rings=3)
    mats = {"Pole": s["pole"], "Hoop": s["hoop"], "Bag": s["bag"]}
    if s.get("ribbon"):
        mats["Ribbon"] = s["ribbon"]
    if s.get("wings"):
        mats["Wings"] = s["wings"]
    return model(f"net-{tier}", mats, b)


# ================================================================ shovels: the grip at the origin, the shaft down -Z to the blade
SHOVEL = {
    1: dict(shaft="#B38A5A", grip="#8C6A44", blade="#A7ABA8", lip="#8A8E8C"),
    2: dict(shaft="#7A5A3E", grip="#3E3A36", blade="#6F7678", lip="#55595B"),
    3: dict(shaft="#6E8E5A", grip="#4C6B3E", blade="#9EA6A2", lip="#7B827F", rivets="#C9B27A"),
    4: dict(shaft="#E4DCCB", grip="#9FBFD4", blade="#AFD9E6", lip="#7DB8CC", facets=True),
    5: dict(shaft="#EADFC8", grip="#B98A3E", blade="#E2B547", lip="#C99A2E"),
}


def shovel(tier):
    s = SHOVEL[tier]

    def b(pc):
        pc.mat = "Shaft"
        pc.tube([(0, 0, 0.06), (0, 0, -0.1), (0, 0, -0.3)], [0.012, 0.012, 0.013], sides=6, tip=False)
        pc.mat = "Grip"
        # the D-grip above the hand
        pc.tube([(-0.032, 0, 0.13), (0.0, 0, 0.142), (0.032, 0, 0.13)], [0.009] * 3, sides=5, tip=False)
        for x in (-0.032, 0.032):
            pc.tube([(x, 0, 0.13), (x * 0.4, 0, 0.07)], [0.008, 0.009], sides=5, tip=False)
        pc.mat = "Lip"
        lathe(pc, (0, 0, -0.31), [(0.017, -0.02), (0.019, 0.0), (0.016, 0.03)], n=6)
        pc.mat = "Blade"
        # the blade: a scoop, rounded at the bottom and pointed a little, cupped toward the front (-Y)
        rows = []
        for i, z in enumerate((-0.33, -0.37, -0.42, -0.46, -0.49)):
            w = (0.045, 0.058, 0.06, 0.05, 0.022)[i]
            row = []
            for k in range(7):
                u = -1 + 2 * k / 6
                cup = 0.018 * (1 - u * u) * (1 if i < 4 else 0.5)
                row.append(Vector((u * w, -cup + 0.004 * i, z)))
            rows.append(row)
        tip = Vector((0, 0.008, -0.51))
        front = [[pc.v(p) for p in row] for row in rows]
        back = [[pc.v(p + Vector((0, 0.01, 0))) for p in row] for row in rows]
        ref_f, ref_b = Vector((0, 0.3, -0.42)), Vector((0, -0.3, -0.42))
        for a, b_ in zip(front[:-1], front[1:]):
            for k in range(6):
                pc.f([a[k], a[k + 1], b_[k + 1], b_[k]], ref_f)
        for a, b_ in zip(back[:-1], back[1:]):
            for k in range(6):
                pc.f([a[k + 1], a[k], b_[k], b_[k + 1]], ref_b)
        tf, tb = pc.v(tip), pc.v(tip + Vector((0, 0.01, 0)))
        for k in range(6):
            pc.f([front[-1][k], front[-1][k + 1], tf], ref_f)
            pc.f([back[-1][k + 1], back[-1][k], tb], ref_b)
        for i in range(len(rows) - 1):          # the rim
            for row in (0, 6):
                pc.f([front[i][row], back[i][row], back[i + 1][row], front[i + 1][row]], Vector((0, 0, -0.42)))
        for k in range(6):
            pc.f([front[0][k + 1], front[0][k], back[0][k], back[0][k + 1]], Vector((0, 0, -0.5)))
        if s.get("rivets"):
            pc.mat = "Rivets"
            for x in (-0.025, 0.025):
                pc.blob((x, -0.012, -0.345), 0.006, segs=5, rings=3)
        if s.get("facets"):
            pc.mat = "Lip"
            pc.tube([(0, -0.02, -0.34), (0, -0.022, -0.47)], [0.005, 0.003], sides=4, tip=True)
    mats = {"Shaft": s["shaft"], "Grip": s["grip"], "Lip": s["lip"], "Blade": s["blade"]}
    if s.get("rivets"):
        mats["Rivets"] = s["rivets"]
    return model(f"shovel-{tier}", mats, b)


def export(ob, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)


built = []
for kind, fn in (("rod", rod), ("net", net), ("shovel", shovel)):
    for tier in range(1, 6):
        ob = fn(tier)
        export(ob, os.path.join(OUT, f"{kind}-{tier}.glb"))
        print(f"MODEL tools/{kind}-{tier} tris={kit.ntris(ob)}")
        built.append(ob)

if "render" in ARGS:
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    kit.render_setup(sc, (0.94, 0.91, 0.84, 1))
    sc.render.film_transparent = False
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 240, 300
    kit.show_vertex_colors(sc)
    for i, ob in enumerate(built):
        for o in built:
            o.hide_render = o is not ob
        ob.location = (0, 0, 0)
        bpy.context.view_layer.update()
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        mid = sum(pts, Vector()) / 8
        e, a = math.radians(18), math.radians(-35)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = mid + d * 10
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        cam.data.ortho_scale = max((max(p.z for p in pts) - min(p.z for p in pts)), 0.3) * 1.15
        cam.data.clip_end = 40
        sc.render.filepath = os.path.join(out, f"{ob.name}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out)
