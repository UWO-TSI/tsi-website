"""The Halloween pumpkin lantern (the traditions calendar, web/lib/content/traditions.ts `pumpkins`): a carved pumpkin set
out by lamp posts, doors and gathering spots while Halloween runs, its face lit from inside after dark.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/traditions/build_pumpkin.py [-- render <dir>]

Writes web/public/assets/game/props/pumpkin-lantern.glb (the budget's "effect" folder). Frame: GAME coordinates
(cafekit: x across, y up, z away from the camera), one unit = one map cell; origin = its base on the ground, the carved
face toward -z. Matte: roughness 0.9 to 1, no metal, flat colours. The carving is M_PumpkinGlow, an emissive the engine
eases up at night (components/game/Halloween.tsx) behind a dark cut rim (M_Carve); no light is added. Ribbed by lathing
round a profile whose radius dips at each groove. Seeded: a rebuild writes the same model.
"""
import math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402
from cafekit import G, Mat, Model  # noqa: E402

K.OUT = os.path.join(K.ROOT, "web", "public", "assets", "game", "props")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TAU = math.tau
R, H = 0.27, 0.36            # body radius and height
RIBS = 8
FRONT = -R * 0.97             # where the face sits on the body's front


def body(m, mat):
    """The pumpkin: a squat lathe, its rings scalloped into RIBS lobes, a dimple at the top for the stem."""
    bm = m.bm
    n, rings = RIBS * 4, []
    prof = [(0.0, 0.0), (0.55, 0.01), (0.86, 0.06), (1.0, 0.2), (1.0, 0.5), (0.93, 0.75), (0.7, 0.92), (0.32, 1.0), (0.12, 0.96)]
    for r, y in prof:
        ring = []
        for k in range(n):
            a = TAU * k / n
            groove = 1 - 0.07 * (0.5 + 0.5 * math.cos(a * RIBS)) if 0 < r < 1.01 else 1
            ring.append(bm.verts.new(G(math.cos(a) * r * R * groove, y * H, math.sin(a) * r * R * groove)))
        rings.append(ring)
    faces = []
    for a, b in zip(rings, rings[1:]):
        faces += [bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])) for k in range(n)]
    faces.append(bm.faces.new(list(reversed(rings[0]))))
    faces.append(bm.faces.new(rings[-1]))
    import bmesh
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    i = m._mi(mat)
    for f in faces:
        f.material_index = i


def face_shape(m, pts, rim, glow, out=0.004):
    """A carved shape on the front: the dark cut rim a touch larger, the lit inside on it, both facing -z."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    grow = [(cx + (x - cx) * 1.22, cy + (y - cy) * 1.22) for x, y in pts]
    # On the bulge: each point pushed out to the body's front surface at its height and x.
    def on(x, y, extra):
        r = R * (1.0 if 0.2 * H <= y <= 0.5 * H else 0.97)
        z = -math.sqrt(max(r * r - x * x, 1e-6))
        return (x, y, z - extra)
    m.quad([on(x, y, out) for x, y in grow], rim, (0, 0, -1))
    m.quad([on(x, y, out * 2) for x, y in pts], glow, (0, 0, -1))


def pumpkin():
    M = {
        "skin": Mat("M_PumpkinSkin", "#d9772f", 0.9),
        "stem": Mat("M_PumpkinStem", "#5e6a34", 1.0),
        "carve": Mat("M_Carve", "#3b2114", 1.0),
        "glow": Mat("M_PumpkinGlow", "#ffb24a", 0.9, glow=1.0, glow_color="#ffa63d"),
    }
    m = Model("pumpkin-lantern", smooth=50)
    body(m, M["skin"])
    # The stem: a short twisted cylinder leaning a little.
    stem = m.cyl((0, H * 0.94, 0), 0.032, 0.09, M["stem"], n=6, r2=0.022)
    m.rot(stem, (0, H * 0.94, 0), "z", 0.18)
    # The face: two triangle eyes, a nose, a gap-toothed grin.
    for s in (-1, 1):
        face_shape(m, [(s * 0.035, 0.205), (s * 0.115, 0.205), (s * 0.075, 0.262)], M["carve"], M["glow"])
    face_shape(m, [(-0.018, 0.165), (0.018, 0.165), (0.0, 0.19)], M["carve"], M["glow"])
    grin = [(-0.13, 0.135), (-0.07, 0.105), (-0.035, 0.118), (0.0, 0.098), (0.035, 0.118), (0.07, 0.105), (0.13, 0.135),
            (0.06, 0.08), (0.0, 0.07), (-0.06, 0.08)]
    face_shape(m, grin, M["carve"], M["glow"])
    return [m.finish()]


obs = pumpkin()
K.export(obs, "pumpkin-lantern")

if "render" in ARGS:
    import bpy
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 480, 480
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (0.12, 0.13, 0.2, 1)
    sun = bpy.data.lights.new("S", "SUN")
    sun.energy = 1.2
    so = bpy.data.objects.new("S", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-30))
    c = bpy.data.cameras.new("C")
    c.lens = 50
    co = bpy.data.objects.new("C", c)
    sc.collection.objects.link(co)
    co.location = G(0.25, 0.42, -1.2)
    co.rotation_euler = (G(0, 0.18, 0) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = co
    sc.render.filepath = os.path.join(out, "pumpkin-lantern.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out)
