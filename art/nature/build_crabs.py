"""The beach crabs (components/game/Critters.tsx and lib/game/ambientFauna.ts), in place of the dump's:

  gazami   Gazami Crab: a wide swimming crab, an olive-brown carapace with a point at each side, dusty-blue claws and
           legs, the last pair flattened into paddles
  hermit   Hermit Crab: an orange crab in a borrowed spiral shell (build_shells.spiral), one big claw and one small,
           eyes up on stalks

Same frame and size as the models they replace, so the behaviour code keeps working unchanged: game units, standing on
y 0, facing game +z (Blender -Y; a crab faces the sea and scuttles along its x). Each is one mesh of closed parts
(the carapace a squashed sphere, legs and fingers tapered tubes, the shell a swept spiral), smooth normals, one matte
vertex-coloured material: one primitive. No skeleton: the game moves them whole (the sidle, the scuttle's judder,
digging in), as it moved the old ones.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/nature/build_crabs.py [-- preview <png>]

Writes web/public/assets/game/shore/crab-<name>.glb.
"""
import math, os, sys
import numpy as np
import bmesh, bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nature_kit as K  # noqa: E402
from nature_kit import lin, smooth  # noqa: E402
import build_shells as S  # noqa: E402

OUT = os.path.join(K.ASSETS, "shore")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


class Parts:
    """A bmesh with a colour tag per vertex range."""
    def __init__(self):
        self.bm = bmesh.new()
        self.tags = []

    def add(self, tag, fn, *a, **kw):
        v0 = len(self.bm.verts)
        out = fn(self.bm, *a, **kw)
        self.tags.append((v0, len(self.bm.verts), tag))
        return out

    def tag_of(self, vi):
        for a, b, t in self.tags:
            if a <= vi < b:
                return t
        return None


def leg(P, tag, pts, r0, r1, sides=5):
    radii = [r0 + (r1 - r0) * i / (len(pts) - 1) for i in range(len(pts))]
    P.add(tag, K.tube, pts, radii, sides=sides)


def claw(P, tag, tip_tag, base, palm, d, size, open_=0.25, side=1):
    """A cheliped: the arm from the body to the palm, a round palm, a fixed finger and a moving one."""
    leg(P, tag, [base, (base + palm) / 2 + Vector((0, 0, size * 0.25)), palm], size * 0.32, size * 0.42)
    q = Vector((0, -1, 0)).rotation_difference(d)
    fs = P.add(tag, K.uv_sphere, (0, 0, 0), (size * 0.62, size, size * 0.55), segs=10, rings=6)
    for v in {v for f in fs for v in f.verts}:
        v.co = palm + q @ v.co
    tip = palm + d * size * 0.9
    side_v = Vector((d.y, -d.x, 0)).normalized() * side
    for k, (lift, spread) in enumerate(((0.0, -0.18), (size * 0.18, open_))):
        p0 = tip + Vector((0, 0, lift * 0.5)) + side_v * size * 0.1 * (1 if k else -1)
        p1 = p0 + d * size * 0.65 + side_v * size * spread * (1 if k else -1) * 0.6 + Vector((0, 0, lift * 0.3))
        p2 = p1 + d * size * 0.35 - side_v * size * 0.12 * (1 if k else -1)
        P.add(tip_tag, K.tube, [p0, p1, p2], [size * 0.26, size * 0.17, size * 0.07], sides=5)


def gazami():
    P = Parts()
    bm = P.bm
    # The carapace: a squashed sphere, its widest point drawn out into a lateral point each side.
    rx, ry, rz = 0.135, 0.085, 0.035
    fs = P.add("shell", K.uv_sphere, (0, 0, 0.07), (rx, ry, rz), segs=18, rings=8)
    for v in {v for f in fs for v in f.verts}:
        x, y, z = v.co.x, v.co.y, v.co.z - 0.07
        f = smooth(0.55, 1.0, abs(x) / rx) * math.exp(-((y + 0.012) / 0.04) ** 2)
        v.co.x = x * (1 + 0.42 * f)
        v.co.z = 0.07 + z * (1 - 0.6 * f) + (0.008 if z > 0 else -0.004) * f
        # The front edge a little straighter, the back rounder.
        if y < -0.03:
            v.co.y = y * (1 - 0.18 * smooth(0.03, 0.085, -y))
    for s in (-1, 1):
        # Eyes on short stalks at the front edge.
        P.add("leg", K.tube, [Vector((s * 0.03, -0.072, 0.085)), Vector((s * 0.036, -0.088, 0.097))], [0.006, 0.005], sides=6)
        P.add("eye", K.uv_sphere, (s * 0.037, -0.091, 0.1), 0.0085, segs=8, rings=5)
        # Claws reaching forward and out.
        claw(P, "claw", "tip", Vector((s * 0.08, -0.06, 0.06)), Vector((s * 0.15, -0.13, 0.07)), Vector((-s * 0.25, -1, 0.05)).normalized(), 0.036, side=s)
        # Three walking legs, out and down to the sand.
        for k, (y, spread) in enumerate(((-0.035, -0.35), (0.0, 0.0), (0.035, 0.3))):
            hip = Vector((s * 0.11, y, 0.06))
            knee = Vector((s * 0.17, y + spread * 0.06, 0.095))
            ankle = Vector((s * 0.215, y + spread * 0.1, 0.05))
            toe = Vector((s * 0.235, y + spread * 0.11, 0.005))
            leg(P, "leg", [hip, knee, ankle, toe], 0.0135, 0.0045)
        # The swimming pair: back and out, a flat paddle at the end.
        hip, knee, end = Vector((s * 0.09, 0.06, 0.06)), Vector((s * 0.15, 0.095, 0.08)), Vector((s * 0.18, 0.12, 0.055))
        leg(P, "leg", [hip, knee, end], 0.012, 0.008)
        d = (end - knee).normalized()
        fs = P.add("leg", K.uv_sphere, (0, 0, 0), (0.026, 0.016, 0.0045), segs=10, rings=5)
        q = Vector((1, 0, 0)).rotation_difference(Vector((d.x, d.y, 0)).normalized())
        for v in {v for f in fs for v in f.verts}:
            v.co = end + d * 0.018 + q @ v.co
    ob = K.to_object(bm, "crab-gazami")
    K.shade_smooth(ob)
    col = {"shell": lin("#7a6a48"), "spot": lin("#c7b78c"), "under": lin("#e6dac2"), "claw": lin("#6d84a6"), "leg": lin("#7189aa"),
           "tip": lin("#4a3a30"), "eye": lin("#24201d")}
    paint_crab(ob, P, col, seed=7)
    return ob


def hermit():
    P = Parts()
    bm = P.bm
    # The borrowed shell: a swept spiral, turned so its mouth faces forward and down and its spire points back and up.
    v0 = len(bm.verts)
    sh, info = S.spiral("tmp-shell", turns=3.6, r0=0.01, growth=math.log(1.9), rise=0.014, tube=0.0074, per_turn=9, sides=8, seed=9)
    S.paint_spiral(sh, info, 3.6, "#dcd0c2", "#b49fb1", 3, "#ece4da", None, seed=9)
    end, facing = info["end"], info["facing"]
    target = Vector((0, -1, -0.35)).normalized()
    r1 = facing.rotation_difference(target)
    ax = r1 @ Vector((0, 0, 1))
    want = Vector((0, 0.7, 0.7))
    a_p = (ax - target * ax.dot(target)).normalized()
    w_p = (want - target * want.dot(target)).normalized()
    ang = math.atan2(target.dot(a_p.cross(w_p)), a_p.dot(w_p))
    rot = Matrix.Rotation(ang, 3, target) @ r1.to_matrix()
    me = sh.data
    pts = [rot @ (v.co - end) for v in me.vertices]
    span = max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))
    k = 0.2 / span
    mouth = Vector((0, -0.025, 0.07))
    shell_cols = [tuple(c.color[:3]) for c in me.color_attributes["Col"].data]
    loops_v = [l.vertex_index for l in me.loops]
    vcol = {}
    for li, vi in enumerate(loops_v):
        vcol[vi] = shell_cols[li]
    # Copy the shell into this crab's mesh (and its painted colours, kept per vertex).
    bmesh_sh = bmesh.new()
    bmesh_sh.from_mesh(me)
    for v in bmesh_sh.verts:
        v.co = mouth + (rot @ (v.co - end)) * k
    tmp = bpy.data.meshes.new("tmp")
    bmesh_sh.to_mesh(tmp)
    bmesh_sh.free()
    base = len(bm.verts)
    bm.from_mesh(tmp)
    P.tags.append((base, len(bm.verts), "shellcol"))
    shell_colour = {base + vi: np.array(c) for vi, c in vcol.items()}
    bpy.data.objects.remove(sh)
    # The crab, out of the mouth: a big right claw, a small left one, two walking legs a side, eyes on stalks.
    body = mouth + Vector((0, -0.02, -0.025))
    P.add("body", K.uv_sphere, body, (0.045, 0.04, 0.03), segs=10, rings=6)
    claw(P, "body", "tip", body + Vector((-0.03, -0.02, 0.0)), body + Vector((-0.05, -0.065, -0.005)), Vector((0.1, -1, -0.1)).normalized(), 0.032, open_=0.15, side=-1)
    claw(P, "body", "tip", body + Vector((0.03, -0.02, 0.0)), body + Vector((0.042, -0.06, -0.012)), Vector((-0.1, -1, -0.15)).normalized(), 0.021, open_=0.2, side=1)
    for s in (-1, 1):
        P.add("body", K.tube, [body + Vector((s * 0.012, -0.03, 0.015)), body + Vector((s * 0.016, -0.05, 0.05))], [0.0045, 0.0038], sides=6)
        P.add("eye", K.uv_sphere, body + Vector((s * 0.017, -0.052, 0.056)), 0.0075, segs=8, rings=5)
        for j, (dy, spread) in enumerate(((-0.01, -0.3), (0.015, 0.25))):
            hip = body + Vector((s * 0.035, dy, -0.005))
            knee = hip + Vector((s * 0.06, spread * 0.06 - 0.02, 0.035))
            toe = knee + Vector((s * 0.045, spread * 0.05 - 0.035, -0.07))
            leg(P, "leg", [hip, knee, (knee + toe) / 2 + Vector((s * 0.01, 0, 0.005)), toe], 0.0085, 0.0035)
    ob = K.to_object(bm, "crab-hermit")
    K.shade_smooth(ob)
    K.ground_at_zero(ob, 0.0)
    col = {"body": lin("#d0643c"), "leg": lin("#d97a4a"), "tip": lin("#f1dcb4"), "eye": lin("#24201d")}
    paint_crab(ob, P, col, seed=9, shell=shell_colour)
    return ob


def paint_crab(ob, P, col, seed, shell=None):
    me = ob.data
    ao = K.vertex_ao(ob, samples=28, dist=0.05, seed=seed)
    zs = [v.co.z for v in me.vertices]
    lo, hi = min(zs), max(zs)
    vcols = []
    for v in me.vertices:
        tag = P.tag_of(v.index)
        occ = ao[v.index] ** 1.3
        if tag == "shellcol" and shell is not None:
            c = shell.get(v.index, lin("#dcd0c2"))
            vcols.append(np.array(c))
            continue
        if tag == "shell":
            if v.normal.z < -0.2:
                c = col["under"]
            else:
                spots = smooth(0.35, 0.55, K.noise3(v.co, 55.0, seed))
                c = K.mixc(col["shell"], col["spot"], 0.55 * spots) * (0.9 + 0.2 * smooth(-0.2, 1.0, v.normal.z))
        else:
            c = col.get(tag, col.get("body"))
        c = c * (0.85 + 0.15 * smooth(lo, hi, v.co.z)) * (0.62 + 0.38 * occ)
        vcols.append(c)
    K.paint(ob, lambda vi, _p: vcols[vi])


if __name__ == "__main__":
    K.reset()
    built = []
    for fn in (gazami, hermit):
        ob = fn()
        K.set_material(ob, K.vc_material("crab"))
        K.export(ob, os.path.join(OUT, f"{ob.name}.glb"))
        built.append(ob)
    if "preview" in ARGS:
        K.preview(built, ARGS[ARGS.index("preview") + 1], cols=2, spacing=0.6, lens=70, cam_az=-20, cam_el=30)
