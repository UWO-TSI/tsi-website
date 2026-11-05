"""The in-game phone, a 3D slider phone (tutorial round 10, David 2026-11-04: "phone model, make it 3d blender with a
slide up animation"; his reference specs/references/phone/, untracked). Round 12 remodel (David on round 10: "bigger
longer screen, the dial buttons are flatter take up less of the phone, the buttons are clear and not neon green, the
number use a different font and flatter, the screen is bigger and longer, the things on the phone are stickers, model
the phone without stickers first, the color isnt right, the charm is added on and customizable"):

- pearl white with clear lime edges, no marks or stickers;
- the top half mostly screen (a long glass, 86% of its width), with small flat clear keys under it: three hearts, a
  round d-pad with its OK, teardrop soft keys and two round keys;
- the bottom half a 4 by 3 keypad of flat clear pill keys, the digits printed flat in Nunito (the game's font);
- the strap and its jelly star are their own model, hung on the top half's `charm_mount`, so a charm can be swapped.

The game draws it live (components/gui/flat/phone.tsx): the top half slides on the base, and the screen's UI is a
texture on the `screen` mesh (UVs 0..1 across the glass), so the UI sits in the phone's plane.

  Blender -b --factory-startup -P art/ui/slider_phone.py -- glb <dir>          phone.glb and charm-star.glb
  Blender -b --factory-startup -P art/ui/slider_phone.py -- turnaround <dir>   front, side, back, three-quarter; closed, open
Then copy the GLBs into web/public/assets/ui/phone/ and run `cd web && node scripts/pack-glbs.mjs <those files>`.
Units: the phone is 5 wide; front faces -Y, up is +Z (glTF: front +Z, up +Y).
"""
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["glb", "/tmp/phone"]
MODE, OUT = ARGS[0], ARGS[1]
SAMPLES = int(ARGS[2]) if len(ARGS) > 2 else 64
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FONT = os.path.join(ROOT, "web/public/fonts/nunito/Nunito-Variable.ttf")

W, H, R = 5.0, 10.2, 0.9          # each half: width, height, plan corner
SLIDE = 4.8                       # how far the top half slides up
BASE_Y = (-0.1, 0.72)             # the body (bottom half) from its front face back
TOP_Y = (-0.62, -0.12)            # the top half's shell; its clear back plate fills -0.12..-0.1
SCREEN = (4.3, 6.2, 0.32, 1.46)   # the glass: width, height, corner, centre height on the top half
F = TOP_Y[0]                      # the top half's face
BEZEL = (0.09, 0.18)              # round 13: the screen's raised clear bezel, how proud and how wide
GLASS_Y = F - 0.03                # the glass, sunk 0.06 behind the bezel's front, in front of its dark mask

# ---------------------------------------------------------------- scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)

def material(name, color, rough=0.4, metal=0.0, alpha=1.0, emit=None, emit_k=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        m.surface_render_method = "BLENDED"
    if emit:
        b.inputs["Emission Color"].default_value = srgb(emit); b.inputs["Emission Strength"].default_value = emit_k
    return m

# Plain colours with the light response of what they are (lane rules: plastic a soft gloss, clear plastic glossy and
# see-through, metal with a sheen). The clear keys are frosted, not glowing (David: "clear and not neon").
M = {
    "pearl": material("phone_pearl", "#f3f5f1", rough=0.34),
    "plate": material("phone_plate", "#e9eee6", rough=0.4),
    "clear": material("phone_clear", "#9ede84", rough=0.12, alpha=0.62),
    "key": material("phone_key", "#e4f4dc", rough=0.16, alpha=0.78),
    "digit": material("phone_digit", "#2f6b3c", rough=0.5),
    "screen": material("phone_screen", "#e8f5e2", rough=0.3, emit="#e8f5e2", emit_k=0.6),
    "lens": material("phone_lens", "#2b3a33", rough=0.1),
    "mask": material("phone_mask", "#33463a", rough=0.5),
    "silver": material("phone_silver", "#d6dadf", rough=0.22, metal=1.0),
    "strap": material("phone_strap", "#4fae45", rough=0.6),
    "charm": material("phone_charm", "#b6ef3c", rough=0.06, alpha=0.82, emit="#c8f55a", emit_k=0.25),
}

def coll(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
C_BASE, C_TOP, C_CHARM = coll("Base"), coll("Top"), coll("Charm")
pivot = bpy.data.objects.new("phone", None); scene.collection.objects.link(pivot)
top_root = bpy.data.objects.new("top", None); C_TOP.objects.link(top_root); top_root.parent = pivot

# ---------------------------------------------------------------- shapes (outlines in the XZ plane)
def rrect(w, h, r, seg=12, cx=0.0, cz=0.0):
    pts = []
    for qx, qz, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ox, oz = cx + qx * (w / 2 - r), cz + qz * (h / 2 - r)
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg); p = (ox + r * math.cos(a), oz + r * math.sin(a))
            if not pts or math.dist(p, pts[-1]) > 1e-5: pts.append(p)  # a pill or a circle: the arcs meet, no zero edge
    return pts if math.dist(pts[0], pts[-1]) > 1e-5 else pts[:-1]

def heart(s, cx, cz, n=40):
    pts = []
    for i in range(n):
        t = math.tau * i / n
        x = 16 * math.sin(t) ** 3; z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + s * x / 17, cz + s * (z + 2) / 17))
    return pts[::-1]

def star(s, cx, cz, rot=math.pi / 2, inner=0.52):
    return [(cx + s * (1 if i % 2 == 0 else inner) * math.cos(rot + math.pi * i / 5), cz + s * (1 if i % 2 == 0 else inner) * math.sin(rot + math.pi * i / 5)) for i in range(10)]

def teardrop(s, cx, cz, rot):  # round at one end, a soft point at the other
    pts = []
    for i in range(48):
        t = math.tau * i / 48
        x, z = 0.66 * math.sin(t) * math.sin(t / 2) ** 0.9, -math.cos(t)
        c, sn = math.cos(rot), math.sin(rot)
        pts.append((cx + s * (x * c - z * sn), cz + s * (x * sn + z * c)))
    return pts

def prism(name, outline, y0, y1, mat, bevel=0.0, segs=4, hole=None, col=C_TOP, parent=None, angle=40):
    """One closed mesh: the outline (and an optional hole with the same point count) from y0 (front) to y1 (back),
    rounded by a bevel on its sharp edges, smooth shaded with sharp corners kept."""
    bm = bmesh.new()
    def loop(pts, y): return [bm.verts.new((x, y, z)) for x, z in pts]
    of, ob = loop(outline, y0), loop(outline, y1); n = len(outline)
    for i in range(n): bm.faces.new((of[i], of[(i + 1) % n], ob[(i + 1) % n], ob[i]))
    if hole:
        hf, hb = loop(hole, y0), loop(hole, y1)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((hf[j], hf[i], hb[i], hb[j])); bm.faces.new((of[j], of[i], hf[i], hf[j])); bm.faces.new((ob[i], ob[j], hb[j], hb[i]))
    else:  # caps fanned from the middle: every outline here is star-shaped round it, and a concave ngon shades badly
        cx, cz = sum(x for x, _ in outline) / n, sum(z for _, z in outline) / n
        for loop_, y, flip in ((of, y0, True), (ob, y1, False)):
            c = bm.verts.new((cx, y, cz))
            for i in range(n):
                tri = (loop_[i], loop_[(i + 1) % n], c); bm.faces.new(tri[::-1] if flip else tri)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(angle))
    me.materials.append(mat)
    ob_ = bpy.data.objects.new(name, me); col.objects.link(ob_); ob_.parent = parent or (top_root if col is C_TOP else pivot)
    if bevel:
        bv = ob_.modifiers.new("round", "BEVEL"); bv.width = bevel; bv.segments = segs; bv.limit_method = "ANGLE"
        bv.angle_limit = math.radians(angle); bv.use_clamp_overlap = True; bv.harden_normals = False
        wn = ob_.modifiers.new("normals", "WEIGHTED_NORMAL"); wn.keep_sharp = True  # flat caps, no seams across the fans
    return ob_

def flat_key(name, outline, mat, proud=0.035, col=C_TOP, face=F):
    """A flat key: a thin plate a little proud of the face, its edge softly rounded (David: "flatter")."""
    return prism(name, outline, face - proud, face + 0.02, mat, 0.014, 2, col=col)

# ---------------------------------------------------------------- the body (bottom half) and its keypad
prism("body", rrect(W, H, R), BASE_Y[0], BASE_Y[1], M["pearl"], 0.24, 6, col=C_BASE)
prism("key_plate", rrect(W - 0.5, 4.4, 0.45, 12, 0, -2.75), BASE_Y[0] - 0.012, BASE_Y[0] + 0.02, M["plate"], 0.01, 2, col=C_BASE)
font = bpy.data.fonts.load(FONT)
KX, KZ = (-1.45, 0.0, 1.45), (-1.18, -2.06, -2.94, -3.82)
for r, z in enumerate(KZ):
    for c, x in enumerate(KX):
        flat_key(f"key_{r}{c}", rrect(1.24, 0.6, 0.3, 10, x, z), M["key"], 0.03, C_BASE, BASE_Y[0] - 0.012)
        cu = bpy.data.curves.new(f"digit_{r}{c}", "FONT"); cu.body = "123456789*0#"[r * 3 + c]; cu.font = font; cu.resolution_u = 4
        cu.align_x, cu.align_y, cu.size, cu.extrude, cu.offset = "CENTER", "CENTER", 0.4, 0.0, 0.022
        t = bpy.data.objects.new(cu.name, cu); C_BASE.objects.link(t); t.parent = pivot
        t.location = (x, BASE_Y[0] - 0.012 - 0.036, z - (0.02 if cu.body == "*" else 0)); t.rotation_euler = (math.radians(90), 0, 0); cu.materials.append(M["digit"])
prism("mic", rrect(0.14, 0.14, 0.07, 6, 0, -4.55), BASE_Y[0] - 0.005, BASE_Y[0] + 0.02, M["lens"], 0, col=C_BASE)
# the back: a camera ring and its lens
prism("lens_ring", rrect(1.0, 1.0, 0.5, 16, 0, 3.0), BASE_Y[1] - 0.02, BASE_Y[1] + 0.06, M["clear"], 0.02, 2, hole=rrect(0.64, 0.64, 0.32, 16, 0, 3.0), col=C_BASE)
prism("lens", rrect(0.64, 0.64, 0.32, 16, 0, 3.0), BASE_Y[1] - 0.01, BASE_Y[1] + 0.04, M["lens"], 0.015, 2, col=C_BASE)

# ---------------------------------------------------------------- the top half
prism("top_shell", rrect(W, H, R), TOP_Y[0], TOP_Y[1], M["pearl"], 0.22, 6)
# the clear lime edge all round (the reference's see-through frame), and its back plate
prism("top_rim", rrect(W + 0.06, H + 0.06, R + 0.03, 12), TOP_Y[0] + 0.1, TOP_Y[1] - 0.04, M["clear"], 0.04, 3, hole=rrect(W - 0.3, H - 0.3, R - 0.15, 12))
prism("top_plate", rrect(W - 0.2, H - 0.2, R - 0.1), TOP_Y[1] - 0.02, BASE_Y[0] - 0.004, M["clear"], 0.03, 2)
sw, sh, sr, sz = SCREEN
# Round 13, the screen remodelled (David: "the ui screen needs to be remodeled"): a raised clear bezel round a sunk
# glass, and a thin dark mask between them, like a real display's edge, so the screen reads as a screen.
bh, bw = BEZEL
prism("screen_bezel", rrect(sw + 2 * bw, sh + 2 * bw, sr + bw, 12, 0, sz), F - bh, F + 0.02, M["clear"], 0.04, 3, hole=rrect(sw + 0.1, sh + 0.1, sr + 0.05, 12, 0, sz))
prism("screen_mask", rrect(sw + 0.14, sh + 0.14, sr + 0.07, 12, 0, sz), F - 0.02, F + 0.01, M["mask"], 0)
prism("earpiece", rrect(0.9, 0.1, 0.05, 6, 0, 4.88), F - 0.006, F + 0.02, M["lens"], 0)

def screen_mesh():
    """The glass: a flat rounded rectangle facing -Y, its UVs 0..1 across its width and height (the UI's texture)."""
    pts = rrect(sw, sh, sr, 12, 0, sz)
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    c = bm.verts.new((0, GLASS_Y, sz)); ring = [bm.verts.new((x, GLASS_Y, z)) for x, z in pts]
    for i in range(len(ring)):
        f = bm.faces.new((ring[(i + 1) % len(ring)], ring[i], c))
        for lp in f.loops: lp[uv].uv = ((lp.vert.co.x + sw / 2) / sw, (lp.vert.co.z - (sz - sh / 2)) / sh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("screen"); bm.to_mesh(me); bm.free()
    me.materials.append(M["screen"])
    o = bpy.data.objects.new("screen", me); C_TOP.objects.link(o); o.parent = top_root
    if me.polygons[0].normal.y > 0:  # it must face the front
        me.flip_normals()
    return o
screen = screen_mesh()

# the keys under the glass: small, flat and clear (David: "flatter, take up less of the phone")
for i, x in enumerate((-0.62, 0.0, 0.62)):
    flat_key(f"heart_key_{i}", heart(0.21, x, -2.12), M["key"])
DZ = -3.5
flat_key("dpad", rrect(1.56, 1.56, 0.78, 12, 0, DZ), M["key"], 0.03)
prism("dpad_ok", rrect(0.76, 0.76, 0.38, 12, 0, DZ), F - 0.05, F + 0.02, M["pearl"], 0.02, 2)
for s in (-1, 1):
    flat_key(f"soft_key_{s}", teardrop(0.3, s * 1.55, -2.95, s * math.radians(-28)), M["key"])
    flat_key(f"round_key_{s}", rrect(0.56, 0.56, 0.28, 16, s * 1.55, -4.15), M["key"])

# the charm's mount: where the strap's loop hangs, on the left edge near the top
LUG = Vector((-W / 2 - 0.02, (TOP_Y[0] + TOP_Y[1]) / 2, 3.4))
lug = prism("lug", rrect(0.34, 0.34, 0.17, 10, LUG.x + 0.08, LUG.z), TOP_Y[0] + 0.12, TOP_Y[1] - 0.12, M["clear"], 0.03, 2)
mount = bpy.data.objects.new("charm_mount", None); C_TOP.objects.link(mount); mount.parent = top_root; mount.location = LUG

# ---------------------------------------------------------------- the charm: a braided strap and a jelly star
charm_root = bpy.data.objects.new("charm", None); C_CHARM.objects.link(charm_root)
DROP = Vector((-0.55, 0, -2.9))   # from the lug to the jump ring

def braid():  # three strands woven along the hanging line, each a curve with a round profile
    n = 72
    for k in range(3):
        cu = bpy.data.curves.new(f"strand_{k}", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.05; cu.bevel_resolution = 1
        sp = cu.splines.new("POLY"); sp.points.add(n - 1)
        for i in range(n):
            t = i / (n - 1); ph = t * math.tau * 6 + k * math.tau / 3
            side = Vector((-DROP.z, 0, DROP.x)).normalized()
            p = DROP * t + side * (0.08 * math.sin(ph)) + Vector((0, 0.055 * math.sin(2 * ph), 0)) + Vector((-0.22 * math.sin(math.pi * t), 0, 0))
            sp.points[i].co = (*p, 1)
        cu.materials.append(M["strap"])
        o = bpy.data.objects.new(cu.name, cu); C_CHARM.objects.link(o); o.parent = charm_root
braid()
# The pendant (the jump ring and the star) is its own node, `pendant`, its origin where it hangs from the strap's end,
# so the game swings it on the strap (round 13, David: "the charm on the phone is a accessory, and it has proper
# physics, charms will be swappable later"). Another charm is a GLB with the same two parts: `charm` (its origin at the
# lug) holding `strap`, and `pendant` at the strap's end.
pendant = bpy.data.objects.new("pendant", None); C_CHARM.objects.link(pendant); pendant.parent = charm_root; pendant.location = DROP
bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.04, location=DROP + Vector((0, 0, -0.1)), rotation=(0, math.radians(90), 0))
tor = bpy.context.active_object
for c in tor.users_collection: c.objects.unlink(tor)
C_CHARM.objects.link(tor); tor.parent = charm_root; tor.name = "jump_ring"; tor.data.materials.append(M["silver"])
for p in tor.data.polygons: p.use_smooth = True
star_c = DROP + Vector((-0.04, 0, -1.0))
jelly = prism("jelly_star", star(0.85, star_c.x, star_c.z, math.radians(102), 0.55), star_c.y - 0.24, star_c.y + 0.24, M["charm"], 0.2, 5, col=C_CHARM, parent=charm_root, angle=30)
sub = jelly.modifiers.new("soft", "SUBSURF"); sub.levels = sub.render_levels = 1

def set_open(open_):
    top_root.location = (0, 0, SLIDE if open_ else 0)
    bpy.context.view_layer.update()

# The charm hangs from the mount (the game re-parents it the same way when it loads a charm).
def hang_charm():
    charm_root.parent = mount; charm_root.matrix_parent_inverse = Matrix.Identity(4); charm_root.location = (0, 0, 0)
    bpy.context.view_layer.update()

# ---------------------------------------------------------------- export
def merge(objs, name, parent):
    """The objects as one mesh (modifiers applied, curves and text filled), in `parent`'s space: one node, a draw a
    material."""
    dg = bpy.context.evaluated_depsgraph_get(); bm = bmesh.new(); mats = []
    inv = parent.matrix_world.inverted()
    for o in objs:
        ev = o.evaluated_get(dg); me = bpy.data.meshes.new_from_object(ev)
        me.transform(inv @ o.matrix_world)
        if (inv @ o.matrix_world).determinant() < 0: me.flip_normals()
        remap = []
        for m in me.materials:
            if m not in mats: mats.append(m)
            remap.append(mats.index(m))
        for p in me.polygons: p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name); bm.to_mesh(out); bm.free()
    for m in mats: out.materials.append(m)
    while out.uv_layers: out.uv_layers.remove(out.uv_layers[0])  # only the screen has a texture
    for p in out.polygons: p.use_smooth = True
    out.set_sharp_from_angle(angle=math.radians(40))
    o = bpy.data.objects.new(name, out); scene.collection.objects.link(o); o.parent = parent
    return o

def export(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, use_selection=True,
                              export_apply=True, export_normals=True, export_texcoords=True, export_materials="EXPORT",
                              export_vertex_color="NONE", export_animations=False, export_skins=False,
                              export_morph=False, export_cameras=False, export_lights=False, export_extras=False)

if MODE == "glb":
    os.makedirs(OUT, exist_ok=True)
    set_open(False)
    mesh_types = ("MESH", "CURVE", "FONT")
    # The digits are their own node: the game draws them after the pixel pass, at their real size (round 13).
    digit_objs = [o for o in C_BASE.objects if o.type == "FONT"]
    base_objs = [o for o in C_BASE.objects if o.type in mesh_types and o not in digit_objs]
    top_objs = [o for o in C_TOP.objects if o.type in mesh_types and o is not screen]
    hang = [jelly, tor]
    strap_objs = [o for o in C_CHARM.objects if o.type in mesh_types and o not in hang]
    base = merge(base_objs, "base", pivot)
    digits = merge(digit_objs, "digits", pivot)
    top = merge(top_objs, "top_body", top_root)
    strap = merge(strap_objs, "strap", charm_root)
    hang_mesh = merge(hang, "pendant_body", pendant)
    for o in base_objs + digit_objs + top_objs + strap_objs + hang: bpy.data.objects.remove(o, do_unlink=True)
    export(os.path.join(OUT, "phone.glb"), [pivot, base, digits, top_root, top, screen, mount])
    export(os.path.join(OUT, "charm-star.glb"), [charm_root, strap, pendant, hang_mesh])
else:
    hang_charm()
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences; prefs.compute_device_type = "METAL"; prefs.get_devices()
        for d in prefs.devices: d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        print("phone: CPU render", e)
    scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"  # true colours (AgX greys the mint)
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs["Color"].default_value = srgb("#eef5ee"); bg.inputs["Strength"].default_value = 0.6

    def light(name, loc, energy, size, color="#ffffff"):
        ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size; ld.color = srgb(color)[:3]
        o = bpy.data.objects.new(name, ld); scene.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    light("key", (-9, -14, 12), 1900, 10)
    light("fill", (11, -12, 2), 600, 12, "#f2fff2")
    light("rim", (6, 10, 8), 1200, 6)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
    cam.data.type = "ORTHO"; cam.rotation_euler = (math.radians(90), 0, 0)

    def frame(ppu=52, pad=0.5):
        dg = bpy.context.evaluated_depsgraph_get(); pts = []
        for o in scene.objects:
            if o.type not in ("MESH", "CURVE", "FONT"): continue
            ev = o.evaluated_get(dg); me = ev.to_mesh(); pts += [ev.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear()
        x0 = min(p.x for p in pts) - pad; x1 = max(p.x for p in pts) + pad; z0 = min(p.z for p in pts) - pad; z1 = max(p.z for p in pts) + pad
        cam.location = ((x0 + x1) / 2, -60, (z0 + z1) / 2); cam.data.ortho_scale = max(x1 - x0, z1 - z0)
        scene.render.resolution_x, scene.render.resolution_y = round((x1 - x0) * ppu), round((z1 - z0) * ppu)
        scene.render.resolution_percentage = 100

    views = {"front": (0, 0), "side": (math.radians(-90), 0), "back": (math.radians(180), 0), "three-quarter": (math.radians(-35), math.radians(10))}
    for name, (turn, tilt) in views.items():
        for state in ("closed", "open"):
            pivot.matrix_world = Matrix.Rotation(tilt, 4, "X") @ Matrix.Rotation(turn, 4, "Z")
            set_open(state == "open"); frame()
            scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
            scene.render.filepath = f"{OUT}/{name}-{state}.png"; bpy.ops.render.render(write_still=True)
print("phone: done", MODE)
