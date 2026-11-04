"""The in-game phone as a 3D slider phone (tutorial round 10, David 2026-11-04: "phone model, make it 3d blender with a
slide up animation"; his reference specs/references/phone/, untracked). Cream-white with a mint tint, rounded and chunky:
the top half carries the screen, three heart keys, a round d-pad with teardrop soft keys, and clover, flower, heart and
star marks (our own motifs: no character stickers); the bottom half is a 4 by 3 keypad of glowing pill keys, hidden
until the top slides up; a braided strap with a jelly star charm hangs off the left side.

The game shows it as three pre-rendered layers (the body with the keypad, the sliding top, the charm), moved in CSS,
with the screen as live HTML laid over the rendered glass (design bible UI 8d). One orthographic camera, so a flat
plane in the model is an affine map in the picture and the HTML screen matches the glass with one CSS matrix.

  Blender -b --factory-startup -P art/ui/slider_phone.py -- layers <dir>      the three layers + meta.json (closed)
  Blender -b --factory-startup -P art/ui/slider_phone.py -- turnaround <dir>  front, side, back, three-quarter; closed, open
Then `python3 art/ui/phone_layers.py <dir>` crops the layers to WebP in web/public and writes phoneArt.ts.
Units: the phone is 5 wide; front faces -Y, up is +Z.
"""
import bpy, bmesh, json, math, sys
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["layers", "/tmp/phone"]
MODE, OUT = ARGS[0], ARGS[1]
SAMPLES = int(ARGS[2]) if len(ARGS) > 2 else 96   # a quick look: pass 16

W, H, R = 5.0, 9.4, 1.0          # each half: width, height, plan corner
SLIDE = 4.2                       # how far the top half slides up
BASE_Y = (0.0, 0.8)               # the body (bottom half) from its front face back
TOP_Y = (-0.74, -0.14)            # the top half's shell; its mint back plate fills -0.14..0
TURN, TILT = math.radians(-20), math.radians(8)   # the game's view: turned to show the right side, tipped a little forward
PPU = 150                         # pixels per unit in the layers (the phone 750 px wide: sharp on a phone screen)
SCREEN = (4.0, 4.4, 0.38, 1.7)    # the glass: width, height, corner, centre height on the top half
GLASS_Y = -0.76

# ---------------------------------------------------------------- scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)

def material(name, color, rough=0.4, metal=0.0, trans=0.0, emit=None, emit_k=0.0, coat=0.0, speck=False, bump=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = srgb(emit); b.inputs["Emission Strength"].default_value = emit_k
    if speck or bump:  # the subtle texture: a fine grain in the plastic, and a few soft specks (the reference's glitter)
        tc = nt.nodes.new("ShaderNodeTexCoord"); nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 55.0; nz.inputs["Detail"].default_value = 6.0
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        if bump:
            bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.02
            nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
        if speck:
            v = nt.nodes.new("ShaderNodeTexVoronoi"); v.inputs["Scale"].default_value = 26.0
            nt.links.new(tc.outputs["Object"], v.inputs["Vector"])
            ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[1].position = 0.06
            ramp.color_ramp.elements[0].color = (0.82, 0.9, 0.82, 1); ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
            nt.links.new(v.outputs["Distance"], ramp.inputs["Fac"])
            mix.inputs[6].default_value = srgb(color); nt.links.new(ramp.outputs["Color"], mix.inputs[7])
            nt.links.new(mix.outputs[2], b.inputs["Base Color"])
    return m

M = {
    "body": material("phone_body", "#f3f5e8", rough=0.38, coat=0.25, bump=0.06),
    "body_low": material("phone_body_speck", "#f0f3e4", rough=0.42, coat=0.2, speck=True, bump=0.06),
    "mint": material("phone_mint", "#b5e6c0", rough=0.3, trans=0.25, coat=0.4),
    "jelly": material("phone_jelly", "#9fe0a2", rough=0.12, trans=0.55, emit="#c9f4c2", emit_k=0.35, coat=0.6),
    "glass": material("phone_glass", "#bfe6a8", rough=0.25, emit="#b9e89f", emit_k=0.35),
    "key": material("phone_key", "#c8ecb8", rough=0.28, trans=0.3, emit="#78d860", emit_k=0.55, coat=0.5),
    "digit": material("phone_digit", "#3f9a48", rough=0.5),
    "print": material("phone_print", "#7ccb82", rough=0.35, coat=0.3),
    "clover": material("phone_clover", "#5fb868", rough=0.35, coat=0.3),
    "star": material("phone_star", "#f2d35c", rough=0.3, coat=0.4),
    "strap": material("phone_strap", "#59b84a", rough=0.55),
    "silver": material("phone_silver", "#d6dadf", rough=0.22, metal=1.0),
    "charm": material("phone_charm", "#b4f03a", rough=0.06, trans=0.85, emit="#c8f55a", emit_k=0.3, coat=1.0),
    "lens": material("phone_lens", "#2b3a33", rough=0.1, coat=1.0),
}

def coll(name):
    c = bpy.data.collections.new(name); scene.collection.children.link(c); return c
C_BASE, C_TOP, C_CHARM = coll("Base"), coll("Top"), coll("Charm")
pivot = bpy.data.objects.new("phone", None); scene.collection.objects.link(pivot)
top_root = bpy.data.objects.new("top_half", None); C_TOP.objects.link(top_root); top_root.parent = pivot

# ---------------------------------------------------------------- shapes (outlines in the XZ plane)
def rrect(w, h, r, seg=12, cx=0.0, cz=0.0):
    pts = []
    for qx, qz, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ox, oz = cx + qx * (w / 2 - r), cz + qz * (h / 2 - r)
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg); p = (ox + r * math.cos(a), oz + r * math.sin(a))
            if not pts or math.dist(p, pts[-1]) > 1e-5: pts.append(p)  # a pill or a circle: the arcs meet, no zero edge
    return pts if math.dist(pts[0], pts[-1]) > 1e-5 else pts[:-1]

def polar(f, n=96, s=1.0, cx=0.0, cz=0.0, rot=0.0):
    return [(cx + s * f(t) * math.cos(t + rot), cz + s * f(t) * math.sin(t + rot)) for t in (math.tau * i / n for i in range(n))]

def heart(s, cx, cz, n=72):
    pts = []
    for i in range(n):
        t = math.tau * i / n
        x = 16 * math.sin(t) ** 3; z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + s * x / 17, cz + s * (z + 2) / 17))
    return pts[::-1]

def clover(s, cx, cz):  # four heart-shaped leaves meeting at the middle
    def f(t):
        u = (t % (math.pi / 2)) - math.pi / 4
        return 0.12 + 0.88 * abs(math.sin(2 * t)) ** 0.28 * (1 - 0.2 * math.exp(-(u / 0.13) ** 2))
    return polar(f, 160, s, cx, cz, math.pi / 4)

def flower(s, cx, cz): return polar(lambda t: 0.5 + 0.5 * abs(math.cos(2.5 * t)) ** 0.45, 150, s, cx, cz, math.pi / 2)
def star(s, cx, cz, rot=math.pi / 2, inner=0.52):
    return [(cx + s * (1 if i % 2 == 0 else inner) * math.cos(rot + math.pi * i / 5), cz + s * (1 if i % 2 == 0 else inner) * math.sin(rot + math.pi * i / 5)) for i in range(10)]
def teardrop(s, cx, cz, rot):  # round at one end, a soft point at the other
    pts = []
    for i in range(80):
        t = math.tau * i / 80
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

def mark(name, pts, y, h, mat, col=C_TOP, bevel=0.035): return prism(name, pts, y - h, y + 0.02, mat, bevel, 3, col=col)

# ---------------------------------------------------------------- the body (bottom half) and its keypad
prism("body", rrect(W, H, R), BASE_Y[0], BASE_Y[1], M["body_low"], 0.26, 6, col=C_BASE)
KX, KZ = (-1.45, 0.0, 1.45), (-1.05, -1.85, -2.65, -3.45)
for r, z in enumerate(KZ):
    for c, x in enumerate(KX):
        prism(f"key_{r}{c}", rrect(1.2, 0.56, 0.28, 10, x, z), -0.12, 0.02, M["key"], 0.05, 3, col=C_BASE)
        cu = bpy.data.curves.new(f"digit_{r}{c}", "FONT"); cu.body = "123456789*0#"[r * 3 + c]
        cu.align_x, cu.align_y, cu.size, cu.extrude = "CENTER", "CENTER", 0.36, 0.012
        t = bpy.data.objects.new(cu.name, cu); C_BASE.objects.link(t); t.parent = pivot
        t.location = (x, -0.13, z); t.rotation_euler = (math.radians(90), 0, 0); cu.materials.append(M["digit"])
mark("body_clover", clover(0.26, 0, -4.18), 0.0, 0.03, M["clover"], C_BASE)
mark("mic", rrect(0.16, 0.16, 0.08, 6, 1.95, -4.2), 0.0, 0.01, M["lens"], C_BASE)
# the back: a camera ring and a clover
prism("lens_ring", rrect(1.0, 1.0, 0.5, 16, 0, 3.0), BASE_Y[1] - 0.02, BASE_Y[1] + 0.08, M["mint"], 0.03, 3, hole=rrect(0.64, 0.64, 0.32, 16, 0, 3.0), col=C_BASE)
prism("lens", rrect(0.64, 0.64, 0.32, 16, 0, 3.0), BASE_Y[1] - 0.01, BASE_Y[1] + 0.05, M["lens"], 0.02, 2, col=C_BASE)
prism("back_clover", clover(0.7, 0, 0.6), BASE_Y[1] - 0.02, BASE_Y[1] + 0.04, M["clover"], 0.02, 2, col=C_BASE)

# ---------------------------------------------------------------- the top half
prism("top_shell", rrect(W, H, R), TOP_Y[0], TOP_Y[1], M["body"], 0.26, 6)
prism("top_plate", rrect(W - 0.2, H - 0.2, R - 0.1), TOP_Y[1] - 0.02, 0.0, M["mint"], 0.05, 3)
sw, sh, sr, sz = SCREEN
prism("screen_frame", rrect(sw + 0.36, sh + 0.36, sr + 0.18, 12, 0, sz), TOP_Y[0] - 0.07, TOP_Y[0] + 0.02, M["mint"], 0.04, 3, hole=rrect(sw, sh, sr, 12, 0, sz))
prism("screen_glass", rrect(sw, sh, sr, 12, 0, sz), GLASS_Y, TOP_Y[0] + 0.02, M["glass"])
mark("bezel_heart", heart(0.2, 0, 4.25), TOP_Y[0], 0.06, M["print"])
mark("bezel_clover", clover(0.3, -1.65, 4.25), TOP_Y[0], 0.04, M["clover"])
mark("bezel_star", star(0.26, 1.65, 4.25), TOP_Y[0], 0.05, M["star"])
mark("side_star_l", star(0.15, -2.27, 0.3), TOP_Y[0], 0.04, M["star"])
mark("side_star_r", star(0.15, 2.27, 2.9), TOP_Y[0], 0.04, M["star"])
for i, x in enumerate((-0.95, 0.0, 0.95)):
    prism(f"heart_key_{i}", heart(0.34, x, -1.08), TOP_Y[0] - 0.15, TOP_Y[0] + 0.02, M["jelly"], 0.07, 4)
prism("dpad_ring", rrect(2.0, 2.0, 1.0, 20, 0, -2.75), TOP_Y[0] - 0.13, TOP_Y[0] + 0.02, M["jelly"], 0.06, 4, hole=rrect(1.12, 1.12, 0.56, 20, 0, -2.75))
prism("dpad_well", rrect(2.24, 2.24, 1.12, 20, 0, -2.75), TOP_Y[0] - 0.03, TOP_Y[0] + 0.02, M["mint"], 0.02, 2, hole=rrect(2.0, 2.0, 1.0, 20, 0, -2.75))
ok = prism("dpad_ok", rrect(1.0, 1.0, 0.5, 20, 0, -2.75), TOP_Y[0] - 0.14, TOP_Y[0] + 0.02, M["body"], 0.12, 5)
mark("ok_flower", flower(0.24, 0, -2.75), TOP_Y[0] - 0.14, 0.05, M["print"])
for s in (-1, 1):
    prism(f"soft_key_{s}", teardrop(0.42, s * 1.78, -2.2, s * math.radians(-28)), TOP_Y[0] - 0.13, TOP_Y[0] + 0.02, M["jelly"], 0.06, 4)
    prism(f"round_key_{s}", rrect(0.74, 0.74, 0.37, 16, s * 1.78, -3.4), TOP_Y[0] - 0.12, TOP_Y[0] + 0.02, M["body"], 0.08, 4)
mark("round_clover", clover(0.24, -1.78, -3.4), TOP_Y[0] - 0.12, 0.04, M["clover"])
mark("round_flower", flower(0.23, 1.78, -3.4), TOP_Y[0] - 0.12, 0.04, M["print"])
mark("small_heart", heart(0.14, 0.0, -1.9), TOP_Y[0], 0.03, M["print"])
mark("small_clover", clover(0.2, 1.25, -4.2), TOP_Y[0], 0.03, M["clover"])

# ---------------------------------------------------------------- the strap and the jelly star (hang off the left side)
charm_root = bpy.data.objects.new("charm", None); C_CHARM.objects.link(charm_root); charm_root.parent = top_root
LUG = Vector((-W / 2 - 0.02, -0.44, 2.6))
lug = bpy.data.objects.new("lug", bpy.data.meshes.new("lug")); C_TOP.objects.link(lug); lug.parent = top_root
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.16, radius2=0.16, depth=0.36); bm.to_mesh(lug.data); bm.free()
lug.location = LUG + Vector((0.08, 0, 0)); lug.rotation_euler = (math.radians(90), 0, 0); lug.data.materials.append(M["mint"])
for p in lug.data.polygons: p.use_smooth = True
lug.data.set_sharp_from_angle(angle=math.radians(40))
ring_at = LUG + Vector((-0.75, 0, -3.3))

def braid():  # three strands woven along the hanging line, each a curve with a round profile
    d = ring_at - LUG; n = 140
    for k in range(3):
        cu = bpy.data.curves.new(f"strand_{k}", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.055; cu.bevel_resolution = 3
        sp = cu.splines.new("POLY"); sp.points.add(n - 1)
        for i in range(n):
            t = i / (n - 1); ph = t * math.tau * 6 + k * math.tau / 3
            side = Vector((-d.z, 0, d.x)).normalized()
            p = LUG + d * t + side * (0.09 * math.sin(ph)) + Vector((0, 0.06 * math.sin(2 * ph), 0)) + Vector((-0.25 * math.sin(math.pi * t), 0, 0))
            sp.points[i].co = (*p, 1)
        cu.materials.append(M["strap"])
        o = bpy.data.objects.new(cu.name, cu); C_CHARM.objects.link(o); o.parent = charm_root
braid()
bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.045, location=ring_at + Vector((0, 0, -0.12)), rotation=(0, math.radians(90), 0))
tor = bpy.context.active_object
for c in tor.users_collection: c.objects.unlink(tor)
C_CHARM.objects.link(tor); tor.parent = charm_root; tor.name = "jump_ring"; tor.data.materials.append(M["silver"])
for p in tor.data.polygons: p.use_smooth = True
star_c = ring_at + Vector((-0.05, 0, -1.15))
charm = prism("jelly_star", star(0.95, star_c.x, star_c.z, math.radians(102), 0.55), star_c.y - 0.28, star_c.y + 0.28, M["charm"], 0.24, 6, col=C_CHARM, parent=charm_root, angle=30)
sub = charm.modifiers.new("soft", "SUBSURF"); sub.levels = sub.render_levels = 2

# ---------------------------------------------------------------- light and render
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

def set_open(open_):
    top_root.location = (0, 0, SLIDE if open_ else 0)
    bpy.context.view_layer.update()

def world_pts(cols):
    dg = bpy.context.evaluated_depsgraph_get(); pts = []
    for c in cols:
        for o in c.all_objects:
            if o.type not in ("MESH", "CURVE", "FONT"): continue
            ev = o.evaluated_get(dg); me = ev.to_mesh()
            pts += [ev.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear()
    return pts

def frame(pts, ppu, pad=0.18):
    x0 = min(p.x for p in pts) - pad; x1 = max(p.x for p in pts) + pad
    z0 = min(p.z for p in pts) - pad; z1 = max(p.z for p in pts) + pad
    w, h = x1 - x0, z1 - z0
    cam.location = ((x0 + x1) / 2, -60, (z0 + z1) / 2); cam.data.ortho_scale = max(w, h)
    scene.render.resolution_x, scene.render.resolution_y = round(w * ppu), round(h * ppu)
    scene.render.resolution_percentage = 100
    return x0, z1

def render(path, show):
    for c in (C_BASE, C_TOP, C_CHARM): c.hide_render = c not in show
    scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)

def pose(turn, tilt):
    pivot.rotation_mode = "XYZ"; pivot.rotation_euler = (0, 0, 0)
    pivot.matrix_world = Matrix.Rotation(tilt, 4, "X") @ Matrix.Rotation(turn, 4, "Z")
    bpy.context.view_layer.update()

ALL = (C_BASE, C_TOP, C_CHARM)
if MODE == "layers":
    pose(TURN, TILT)
    set_open(True); pts = world_pts(ALL); set_open(False); pts += world_pts(ALL)
    x0, ztop = frame(pts, PPU)
    def px(v): return [round((v.x - x0) * PPU, 2), round((ztop - v.z) * PPU, 2)]
    mw = top_root.matrix_world
    meta = {
        "canvas": [scene.render.resolution_x, scene.render.resolution_y], "ppu": PPU,
        "body": [W * PPU, round(W * math.cos(TURN) * PPU, 2)],
        "screen": {"size": [sw * PPU, sh * PPU], "radius": sr * PPU,
                   "tl": px(mw @ Vector((-sw / 2, GLASS_Y, sz + sh / 2))), "tr": px(mw @ Vector((sw / 2, GLASS_Y, sz + sh / 2))),
                   "bl": px(mw @ Vector((-sw / 2, GLASS_Y, sz - sh / 2)))},
        "slide": [round(a - b, 2) for a, b in zip(px(pivot.matrix_world @ Vector((0, 0, SLIDE))), px(pivot.matrix_world @ Vector((0, 0, 0))))],
        "pivot": px(mw @ LUG),
    }
    with open(f"{OUT}/meta.json", "w") as f: json.dump(meta, f, indent=1)
    render(f"{OUT}/base.png", (C_BASE,)); render(f"{OUT}/top.png", (C_TOP,)); render(f"{OUT}/charm.png", (C_CHARM,))
else:
    views = {"front": (0, 0), "side": (math.radians(-90), 0), "back": (math.radians(180), 0), "three-quarter": (math.radians(-35), math.radians(10))}
    for name, (turn, tilt) in views.items():
        for state in ("closed", "open"):
            pose(turn, tilt); set_open(state == "open"); frame(world_pts(ALL), 52, 0.5)
            render(f"{OUT}/{name}-{state}.png", ALL)
print("phone: done", MODE)
