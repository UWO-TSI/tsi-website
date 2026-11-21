"""Rod rebuild lane c (specs/lanes/rod-rebuild-c.md): the Cedar, the Flimsy and the Training rod (its first look and
its second, the stage it awakens to at 50 fish) rebuilt part by part against their approved sheets in
art/pipeline/concepts/old/<rod>/ (hero.png and turnaround.png; the Training's second look from training2-a.png).

  Blender -b --factory-startup -P art/pipeline/build_rods_c.py -- [only cedar,flimsy] [nopack]

Writes web/public/assets/game/tools/rod-<name>.glb and, where a rod has an effect, props/rodfx-<name>.glb, with
build_rods.py's conventions (its helpers are loaded from it, its own builds are not run): rig units, the grip's middle
at the origin (the right hand's socket), Blender Z up along the rod, the reel hanging toward -Y, its crank on -X.

How these are coloured: every face's colour is its vertex colour (COLOR_0, which three.js multiplies into the base
colour), so a rod needs no more materials than its kinds of surface. Each material is a preset by name (P_Wood,
P_Metal, P_Paint, P_Cloth, P_Leather: lib/game/modelMaterials.ts) and they share one painted atlas: plain faces read its
white corner, and the painted parts (a carved grip, a reel's face, stitching, a tag's fish) read their own patch of it
by a projection. A sway part of an effect keeps its material, so the same holds for the Cedar's boughs.

Then art/pipeline/compare_c.py renders each GLB beside its sheet.
"""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "build_rods.py")).read()
exec(compile(_src[:_src.index("# ================================================================ build")], os.path.join(HERE, "build_rods.py"), "exec"))
# now in scope: kit, lathe, loft, bender, star_flat, fx_part, glow, export, particles, TOOLS, PROPS, V, TAU, ...

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SCRATCH = os.environ.get("RC_TMP", "/tmp")


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def srgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


# ================================================================ the atlas
class Atlas:
    """One painted texture per rod, W x W, sRGB rows top first. Its top-left 8 px are white (plain faces); `region`
    hands out a patch (a shelf allocator) and its uv rectangle; painting is numpy on the patch."""
    def __init__(self, w=512):
        self.w, self.px = w, np.ones((w, w, 4), np.float32)
        self.x, self.y, self.row = 16, 0, 16

    def region(self, w, h):
        """A patch w x h, and past its right edge a copy of its left eighth (filled in by image()), so a face that
        crosses a cylinder's seam reads on past the edge into the start again."""
        m = max(2, w // 8)
        if self.x + w + m > self.w:
            self.x, self.y, self.row = 0, self.y + self.row, 0
        x, y = self.x, self.y
        self.x += w + m + 2
        self.row = max(self.row, h + 2)
        assert y + h <= self.w, "atlas full"
        p = Patch(self, x, y, w, h)
        self.patches = getattr(self, "patches", []) + [(p, m)]
        return p

    def image(self, name):
        for p, m in getattr(self, "patches", []):
            self.px[p.y0:p.y0 + p.h, p.x0 + p.w:p.x0 + p.w + m] = self.px[p.y0:p.y0 + p.h, p.x0:p.x0 + m]
        return kit.image(name, self.px.copy(), path=os.path.join(SCRATCH, f"{name}.png"))


class Patch:
    """A painted patch. Coordinates: (s, t) in 0..1, s across, t down (0 = top row). uv(s, t) -> Blender uv."""
    def __init__(self, at, x, y, w, h):
        self.at, self.x0, self.y0, self.w, self.h = at, x, y, w, h
        ys, xs = np.mgrid[0:h, 0:w]
        self.s, self.t = (xs + 0.5) / w, (ys + 0.5) / h

    def uv(self, s, t):
        s, t = min(max(s, 0.0), 1.0), min(max(t, 0.0), 1.0)
        W = self.at.w
        return ((self.x0 + 0.5 + s * (self.w - 1)) / W, 1 - (self.y0 + 0.5 + t * (self.h - 1)) / W)

    def put(self, mask, col, a=1.0):
        """Blend `col` where `mask` (0..1 float or bool) is set."""
        m = np.clip(np.asarray(mask, np.float32), 0, 1)[..., None] * a
        sub = self.at.px[self.y0:self.y0 + self.h, self.x0:self.x0 + self.w, :3]
        sub[:] = sub * (1 - m) + srgb(col) * m

    def fill(self, col):
        self.put(np.ones_like(self.s), col)

    def disc(self, cs, ct, r, aspect=1.0):
        """Mask of a disc (r in units of the patch's width), aa'd by a pixel."""
        d = np.hypot((self.s - cs), (self.t - ct) * self.h / self.w * aspect)
        return np.clip((r - d) * self.w + 0.5, 0, 1)

    def seg(self, a, b, r):
        """Mask of a thick segment from a to b ((s, t) pairs), r in units of the width."""
        k = self.h / self.w
        p = np.stack([self.s, self.t * k], -1)
        a, b = np.array([a[0], a[1] * k]), np.array([b[0], b[1] * k])
        ab = b - a
        u = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
        d = np.linalg.norm(p - (a + u[..., None] * ab), axis=-1)
        return np.clip((r - d) * self.w + 0.5, 0, 1)

    def leafm(self, a, b, wd):
        """Mask of a pointed leaf from a (stem) to b (tip), half width wd at its middle (units of the width)."""
        k = self.h / self.w
        p = np.stack([self.s, self.t * k], -1)
        a, b = np.array([a[0], a[1] * k]), np.array([b[0], b[1] * k])
        ab = b - a
        L = np.linalg.norm(ab)
        u = ((p - a) @ ab) / (L * L)
        d = np.abs(((p - a) @ np.array([-ab[1], ab[0]])) / L)
        half = wd * np.sin(np.clip(u, 0, 1) * math.pi) ** 0.8
        return np.clip((half - d) * self.w + 0.5, 0, 1) * ((u > 0) & (u < 1))


# ================================================================ pieces with colours and projected uv
class CPiece(kit.Piece):
    """A kit.Piece whose faces each carry a colour (`col`, a hex, or per vertex `cols`) and, while `uvfn` is set, a uv
    projected from each vertex's position (uvfn(co) -> (u, v), unwrapped across a seam)."""
    def __init__(self, mat):
        super().__init__(region="torso", mat=mat)
        self.col, self.uvfn, self.fcol, self.vcols = "#FFFFFF", None, {}, {}

    def f(self, vs, ref, uv=None, cols=None):
        face = super().f(vs, ref, uv)
        if face is not None:
            self.fcol[face] = self.col
            if cols:
                self.vcols[face] = {v: c for v, c in zip(vs, cols)}
            if uv is None and self.uvfn is not None:
                uvs = [self.uvfn(v.co) for v in face.verts]
                u0 = uvs[0][0]
                fix = getattr(self.uvfn, "wrap", None)
                if fix:                                   # a cylinder's seam: keep the face on one side of it
                    uvs = [(u + fix if u0 - u > fix / 2 else u - fix if u - u0 > fix / 2 else u, v) for u, v in uvs]
                self.fuv[face] = {v: x for v, x in zip(face.verts, uvs)}
        return face

    def paint(self, col=None, uvfn=None, mat=None):
        self.col = col or self.col
        self.uvfn = uvfn
        if mat:
            self.mat = mat
        return self


def cyl_uv(patch, c, z0, z1, axis=(0, 0, 1), turn=math.pi, reps=1.0):
    """Wrap `patch` round a part along `axis` from `c`: s round (along Z: 0.5 facing -X, 0.25 facing +Y),
    t from z1 (top of the patch) down to z0."""
    c, R = V(c), frame_of(axis).inverted()
    x0, x1 = patch.uv(0, 0)[0], patch.uv(1, 0)[0]

    def fn(co):
        q = R @ (V(co) - c)
        s = ((math.atan2(q.y, q.x) + turn) / TAU) % 1.0 * reps % 1.0
        return patch.uv(s, (z1 - q.z) / (z1 - z0))
    fn.wrap = (x1 - x0) * 1.0
    return fn


def disc_uv(patch, c, r, axis, up=(0, 0, 1)):
    """A disc facing along `axis`: the patch's middle at `c`, its width 2r, `up` its top."""
    c, a = V(c), V(axis).normalized()
    up = (V(up) - a * V(up).dot(a)).normalized()
    side = up.cross(a)

    def fn(co):
        q = V(co) - c
        return patch.uv(0.5 + q.dot(side) / (2 * r), 0.5 - q.dot(up) / (2 * r))
    return fn


def frame_of(d):
    return V(d).normalized().to_track_quat("Z", "Y").to_matrix()


def finish_c(pc, name, mats, grad=(0.82, 1.0), sharp=50.0):
    """kit.Piece.finish for these rods: normals from each face's reference point, smooth below `sharp` degrees, and each
    loop's COLOR_0 its face's colour (linear) times the top-light gradient, its uv its projection or the white corner."""
    bm = pc.bm
    # welding replaces vertices: keep each face's uv and colours by position, read back from the nearest
    keep = lambda dct: {f: [(v.co.copy(), x) for v, x in m.items()] for f, m in dct.items()}
    fuv, vcols = keep(pc.fuv), keep(pc.vcols)
    near = lambda lst, co: min(lst, key=lambda e: (e[0] - co).length_squared)[1]
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.normal_update()
    for face in bm.faces:
        if face.normal.dot(face.calc_center_median() - V(pc.ref.get(face, (0, 0, 0)))) < 0:
            face.normal_flip()
    bm.normal_update()
    for e in bm.edges:
        e.smooth = len(e.link_faces) == 2 and math.degrees(e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0)) < sharp
    zs = [v.co.z for v in bm.verts]
    lo, hi = min(zs), max(zs)
    col = bm.loops.layers.float_color.new("Color")
    uvl = bm.loops.layers.uv.new("UVMap")
    names, cache = [], {}
    for face in bm.faces:
        m = pc.fmat.get(face, pc.mat)
        if m not in names:
            names.append(m)
        face.material_index = names.index(m)
        face.smooth = True
        uvs, vc = fuv.get(face), vcols.get(face)
        for loop in face.loops:
            h = near(vc, loop.vert.co) if vc else pc.fcol.get(face, "#FFFFFF")
            c = cache.get(h) or cache.setdefault(h, lin(h))
            s = grad[0] + (grad[1] - grad[0]) * (loop.vert.co.z - lo) / max(hi - lo, 1e-6)
            loop[col] = (c[0] * s, c[1] * s, c[2] * s, 1)
            loop[uvl].uv = near(uvs, loop.vert.co) if uvs else (2 / 512, 1 - 2 / 512)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.color_attributes.active_color = me.color_attributes["Color"]
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    for m in names:
        me.materials.append(mats[m])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


PRESET = {"P_Wood": (0.9, 0.0), "P_Metal": (0.4, 0.75), "P_Paint": (0.45, 0.0), "P_Cloth": (1.0, 0.0), "P_Leather": (0.36, 0.0)}


def materials(img, names):
    out = {}
    for n in names:
        m = kit.material(n, image=img, rough=PRESET[n][0])     # Blender suffixes a second rod's: P_Wood.001 (allowed)
        next(x for x in m.node_tree.nodes if x.type == "BSDF_PRINCIPLED").inputs["Metallic"].default_value = PRESET[n][1]
        out[n] = m
    return out


def build_c(name, atlas, mats, b, grad=(0.82, 1.0)):
    pc = CPiece(mats[0])
    b(pc)
    img = atlas.image(f"{name}-atlas")
    return finish_c(pc, name, materials(img, mats), grad=grad)


def ring(pc, c, axis, r, w, sides=6):
    """A short open band (a collar, a wrap) round `axis` at `c`, `w` long."""
    a = V(axis).normalized()
    lathe(pc, V(c) - a * (w / 2), [(r, 0.0), (r, w)], n=sides, axis=a)


def capsule(pc, c, axis, r, L, n=8, rings=3):
    """A capsule (a crank knob): a tube of radius r, L long overall, rounded ends."""
    a = V(axis).normalized()
    prof = [(0.0, 0.0)]
    for i in range(1, rings + 1):
        t = math.pi / 2 * i / rings
        prof.append((r * math.sin(t), r * (1 - math.cos(t))))
    prof += [(rr, L - h) for rr, h in reversed(prof[1:])]
    prof.append((0.0, L))
    lathe(pc, V(c) - a * (L / 2), prof, n=n, axis=a)


def flat_leaf(pc, base, d, L, W, face, n=2, blunt=False):
    """A flat pointed leaf (or a ribbon, `blunt`) from `base` along `d`, its face toward `face`: 2n+1 triangles."""
    d = V(d).normalized()
    side = d.cross(V(face)).normalized()
    pts = [V(base)]
    vs = [pc.v(base)]
    rows = []
    for i in range(1, n + 1):
        u = i / (n + 1)
        w = W * (math.sin(math.pi * u) ** 0.7 if not blunt else 1.0)
        c = V(base) + d * L * u
        rows.append((pc.v(c - side * w), pc.v(c + side * w)))
    end = V(base) + d * L
    prev = (vs[0], vs[0])
    for a, b_ in rows:
        pc.f([prev[0], a, b_, prev[1]], V(base) - V(face))
        prev = (a, b_)
    if blunt:
        pc.f([prev[0], pc.v(end - side * W * 0.5), pc.v(end + side * W * 0.9), prev[1]], V(base) - V(face))
    else:
        pc.f([prev[0], pc.v(end), prev[1]], V(base) - V(face))


def torn(pc, top, tip, w0, feather=False):
    """A torn strip of cloth (or a feather, pointed) hanging from `top` to `tip`, w0 wide, its end ragged; its face
    toward -X. 6 triangles."""
    top, tip = V(top), V(tip)
    dn = (tip - top).normalized()
    sd = dn.cross(V((-1, 0, 0))).normalized()
    m = top.lerp(tip, 0.55) + V((-w0 * 0.2, 0, 0))
    if feather:
        ring_ = [top - sd * w0 * 0.15, m - sd * w0 * 0.5, tip - sd * w0 * 0.15 - dn * w0 * 0.3, tip, tip + sd * w0 * 0.2 - dn * w0 * 0.5,
                 m + sd * w0 * 0.45, top + sd * w0 * 0.15]
    else:
        ring_ = [top - sd * w0 * 0.5, m - sd * w0 * 0.6, tip - sd * w0 * 0.4, tip + dn * (-w0 * 0.3), tip + sd * w0 * 0.3 - dn * w0 * 0.7,
                 m + sd * w0 * 0.55, top + sd * w0 * 0.5]
    vs = [pc.v(p) for p in ring_]
    for i in range(1, 6):
        pc.f([vs[0], vs[i], vs[i + 1]], m + V((0.05, 0, 0)))


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# ================================================================ the Cedar
def cedar():
    """Uncommon (shop). Sheet old/cedar: a carved cedar-wood grip (pale vines and leaves cut into red-brown wood) between
    a gold butt cap (a four-petal flower on its end) and a gold collar, a red-brown blank tapering to a gold tip-top with
    a ring under it, tied with twine crosses, cedar boughs along it from the collar nearly to the tip (flat fronds fanned
    out and forward, two greens, a few red twigs), a log-slice reel (a ringed end-grain face with a leaf in a dark
    centre) held in a gold vine bracket that ends in a leaf, a gold crank to a wooden knob, and a pinecone charm on a gold
    ring with a green bead and two grass ribbons. The boughs are the effect (rodfx-cedar-boughs, swaying)."""
    S, LEN, F0 = 1080.0, 0.95, 70.0                     # the sheet's side view: 1080 px butt to tip; the hand at 70 px
    Z = lambda px: (px - F0) / S * LEN                  # a station (px from the butt) to rig z
    P = lambda px: px / S * LEN                          # a size in px to rig units
    rad = lambda px: 1.25 * P(12.0 - 3.2 * min(1, max(0, (px - 310) / 300)) - 5.0 * max(0, (px - 230) / 850))   # blank radius
    bend = lambda px: V((0, 0.012 * max(0, (px - 150) / 930) ** 2, Z(px)))
    at = Atlas(512)

    # -- the painted patches
    gp = at.region(256, 240)                            # the grip: red-brown wood, pale carved vines and leaves round it
    gp.fill("#B4683D")
    rng = np.random.default_rng(3)
    gp.put(np.clip(np.sin(gp.t * 70 + np.sin(gp.s * 9) * 2) * 0.5 + 0.5, 0, 1) ** 6, "#8C4628", 0.5)     # grain
    gp.put(np.clip(np.sin(gp.t * 40 + np.sin(gp.s * 9) * 2) * 0.5 + 0.5, 0, 1) ** 8, "#C77E4B", 0.35)    # lighter grain
    for k in range(3):                                   # three vines winding up it, carved: a dark cut round a pale face
        s0 = k / 3 + 0.08
        pts = [(s0 + 0.07 * math.sin(i / 9 * math.pi * 2.0 + k * 2), 0.03 + 0.94 * i / 9) for i in range(10)]
        leaves = [(pts[i], (1 if (i + k) % 2 else -1)) for i in range(1, 9)]
        for col, grow in (("#7A3A1F", 1.35), ("#EDC88A", 1.0)):
            for a, b in zip(pts, pts[1:]):
                gp.put(gp.seg(a, b, 0.013 * grow), col)
            for a, sx in leaves:
                tip = (a[0] + sx * 0.16, a[1] - 0.085)
                gp.put(gp.leafm(a, tip, 0.05 * grow), col)
        for a, sx in leaves:
            gp.put(gp.seg(a, (a[0] + sx * 0.11, a[1] - 0.06), 0.003), "#C08446")              # each leaf's midrib
    ep = at.region(96, 96)                               # the butt cap's end: gold, a four-petal flower
    ep.fill("#D6A35A")
    ep.put(1 - ep.disc(0.5, 0.5, 0.46), "#B9853F")
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        ep.put(ep.leafm((0.5, 0.5), (0.5 + 0.34 * math.cos(a), 0.5 + 0.34 * math.sin(a)), 0.1), "#F0CB86")
        ep.put(ep.seg((0.5, 0.5), (0.5 + 0.3 * math.cos(a), 0.5 + 0.3 * math.sin(a)), 0.008), "#B9853F")
    rp = at.region(128, 128)                             # the reel's face: end grain, rings, a dark centre with a leaf
    rp.fill("#E2B27A")
    d = np.hypot(rp.s - 0.5, rp.t - 0.5)
    rp.put((np.sin(d * 110) * 0.5 + 0.5) ** 6, "#BF8550", 0.4)
    rp.put(np.clip((d - 0.44) * 60, 0, 1), "#A05A33")
    rp.put(rp.disc(0.5, 0.5, 0.2), "#8A4024")
    rp.put(rp.seg((0.5, 0.66), (0.5, 0.36), 0.01), "#F0C98A")
    for i in range(3):
        t = 0.6 - 0.07 * i
        for sx in (-1, 1):
            rp.put(rp.leafm((0.5, t), (0.5 + sx * 0.1, t - 0.06), 0.022), "#F0C98A")
    kp = at.region(64, 64)                               # the crank knob's end: a little leaf
    kp.fill("#94492A")
    kp.put(kp.seg((0.5, 0.75), (0.5, 0.25), 0.02), "#E6BE7E")
    for i in range(3):
        for sx in (-1, 1):
            kp.put(kp.leafm((0.5, 0.65 - 0.12 * i), (0.5 + sx * 0.2, 0.52 - 0.12 * i), 0.04), "#E6BE7E")
    tp = at.region(64, 32)                               # a twine tie: a crossed wrap
    tp.fill("#D8B479")
    for k in range(4):
        tp.put(tp.seg((k / 4 - 0.1, 0.05), (k / 4 + 0.35, 0.95), 0.025), "#A77B44")
        tp.put(tp.seg((k / 4 + 0.35, 0.05), (k / 4 - 0.1, 0.95), 0.025), "#EBCB93")
    tp.put(np.clip((np.abs(tp.t - 0.5) - 0.42) * 30, 0, 1), "#9A6E3A")
    pp = at.region(64, 96)                               # the pinecone's scales
    pp.fill("#7A4426")
    for row in range(7):
        for k in range(5):
            cs, ct = (k + 0.5 * (row % 2)) / 4.5, 0.08 + row * 0.14
            pp.put(pp.disc(cs, ct, 0.11, aspect=1.0) * (pp.t > ct - 0.02), "#A8653A")
            pp.put(pp.disc(cs, ct + 0.02, 0.05), "#C98A55", 0.5)

    GOLD, GOLDD, WOOD, BLANK, TWINE, LINE = "#D9A75C", "#B8843F", "#9C5130", "#A3482A", "#D8B479", "#EDE4CF"
    Q = lambda px: P(px) * 1.45                          # the grip, the reel's parts and the charm at the hero's girth
    RC = V((-P(6), -P(84), Z(312)))                       # the reel's hub; its axis along X, its face toward -X
    RR, RW = P(54), P(46)                                # its radius and its width

    def b(pc):
        # the butt cap and its flower end
        pc.paint(GOLD, mat="P_Metal")
        lathe(pc, (0, 0, Z(0)), [(Q(19), Q(1)), (Q(21), Q(3)), (Q(21), Q(17)), (Q(19.5), Q(19))], n=8)
        pc.paint("#FFFFFF", disc_uv(ep, (0, 0, Z(0)), Q(21), (0, 0, -1), up=(0, 1, 0)))
        lathe(pc, (0, 0, Z(0)), [(0.0, 0.0), (Q(19), Q(1))], n=8)
        # the carved grip, a touch fuller at the butt
        pc.paint("#FFFFFF", cyl_uv(gp, (0, 0, 0), Z(18), Z(195)), "P_Wood")
        lathe(pc, (0, 0, 0), [(Q(20.5), Z(18)), (Q(21), Z(55)), (Q(19.8), Z(110)), (Q(18.4), Z(165)), (Q(17.6), Z(195))], n=10)
        # the collar
        pc.paint(GOLD, mat="P_Metal")
        lathe(pc, (0, 0, 0), [(Q(17), Z(193)), (Q(19), Z(195)), (Q(19), Z(209)), (Q(16), Z(211))], n=10)
        # the blank: the reel seat's thick dark wood, then the taper to the tip
        pc.paint(BLANK, mat="P_Wood")
        zs = [211, 230, 285, 360, 480, 640, 800, 940, 1064]
        loft(pc, [bend(z) for z in zs], [rad(z) for z in zs], sides=6, tip=False, cap=False)
        # the gold tip-top and its ring
        pc.paint(GOLD, mat="P_Metal")
        tz = bend(1064)
        lathe(pc, tz, [(rad(1064) * 1.05, 0.0), (P(5), P(4)), (P(5), P(13)), (0.0, P(17))], n=6)
        rc = tz + V((0, -P(10), P(9)))
        pc.tube([rc + V((0, math.cos(TAU * k / 5) * P(5), math.sin(TAU * k / 5) * P(5))) for k in range(5)], [P(1.5)] * 5, sides=3, closed_loop=True)
        # the twine ties
        pc.paint("#FFFFFF", None, "P_Cloth")
        for z in (400, 510, 580, 635, 712, 782, 832, 942, 1000):
            c = bend(z)
            pc.paint(uvfn=cyl_uv(tp, c, c.z - P(7), c.z + P(7)))
            ring(pc, c, (0, 0, 1), rad(z) * 1.35, P(14), sides=6)
        # the reel, built round its hub with its axis along X, then turned 25 degrees so its face looks a little toward
        # the tip (the sheet's hero and close-up show the spool past its face): a dark wood back, the wound line, the
        # log-slice face, a gold hood over its top from the seat, the crank
        n0 = pc.mark()
        pc.paint(WOOD, None, "P_Wood")
        x = V((1, 0, 0))
        lathe(pc, RC + x * (RW / 2), [(0.0, 0.0), (RR * 0.92, 0.0), (RR * 0.95, -Q(6))], n=10, axis=(-1, 0, 0))
        pc.paint(LINE, mat="P_Cloth")
        lathe(pc, RC + x * (RW / 2 - Q(6)), [(RR * 0.92, 0.0), (RR * 0.92, Q(13))], n=10, axis=(-1, 0, 0))
        pc.paint("#A05A33", mat="P_Wood")
        lathe(pc, RC - x * (RW / 2 - Q(5)), [(RR, 0.0), (RR, Q(5))], n=10, axis=(-1, 0, 0))
        pc.paint("#FFFFFF", disc_uv(rp, RC - x * (RW / 2), RR, (-1, 0, 0), up=(0, 1, 0)))
        lathe(pc, RC - x * (RW / 2), [(RR, 0.0), (0.0, 0.0)], n=10, axis=(-1, 0, 0))
        pc.paint(GOLD, None, "P_Metal")                   # the hood: a curved gold band over the spool, 30 to -125 degrees
        arc = lambda a, r=RR + Q(4), xx=0.0: RC + V((xx, math.cos(a) * r, math.sin(a) * r))      # a: 0 = up (+Y)
        hood = [[arc(math.radians(a), RR + Q(3) + Q(2.5) * math.sin(math.pi * k / 2), -RW * 0.62 + RW * 0.42 * k) for k in range(3)]
                for a in (35, 5, -25, -55, -85, -115)]
        pc.band(hood, closed=False)
        pc.paint("#E3B56A")
        pc.tube([arc(math.radians(a), RR + Q(5), -RW * 0.62) for a in (40, 14, -14, -42, -70, -98, -118)],    # its raised gold branch on the face side
                [Q(7), Q(6.6), Q(6), Q(5.4), Q(4.8), Q(4.2), Q(3.6)], sides=6, tip=False)
        pc.paint(GOLD)
        lf = arc(math.radians(-115), RR + Q(3), -RW * 0.4)  # its end: a leaf hanging toward the butt, the charm's ring
        flat_leaf(pc, lf, V((-0.2, -0.75, -1.0)), Q(36), Q(10), V((-1, 0, 0)))
        ringc = arc(math.radians(-140), RR + Q(3), -RW * 0.45)
        pc.tube([ringc + V((0, math.cos(TAU * k / 5) * Q(5), math.sin(TAU * k / 5) * Q(5))) for k in range(5)], [Q(1.6)] * 5, sides=3, closed_loop=True)
        # the crank: a gold arm out of the face's middle, down and forward, to a wooden knob with a leaf on its end
        hub = RC - x * (RW / 2 + Q(1))
        kn = hub + V((-Q(16), -Q(22), Q(30)))
        pc.tube([hub + x * Q(3), hub - x * Q(7), hub + V((-Q(9), -Q(12), Q(14))), kn + V((Q(4), Q(2), -Q(5)))], [Q(4.8)] * 4, sides=5, tip=False)
        lathe(pc, hub - x * Q(2), [(Q(6), 0.0), (Q(5), Q(6)), (0.0, Q(8))], n=6, axis=(-1, 0, 0))
        kd = V((-0.35, -0.25, 1.0)).normalized()
        pc.paint("#94492A", mat="P_Wood")
        capsule(pc, kn, kd, Q(10), Q(32), n=8, rings=2)
        pc.paint("#FFFFFF", disc_uv(kp, kn + kd * Q(16.2), Q(10), kd, up=(0, 1, 0)))
        lathe(pc, kn + kd * Q(16.2), [(0.0, 0.0), (Q(7), 0.0)], n=8, axis=kd)
        yaw = Matrix.Rotation(math.radians(35), 3, "Y")    # -X (the face) toward +Z (the tip)
        for v in {v for f in pc.since(n0) for v in f.verts}:
            v.co = RC + yaw @ (v.co - RC)
        for f in pc.since(n0):
            pc.ref[f] = tuple(RC + yaw @ (V(pc.ref[f]) - RC))
        ringc = RC + yaw @ (ringc - RC)
        pc.paint("#E3B56A", None, "P_Metal")              # the gold branch bracket: two arms off the seat, forking down to the reel
        for zb, ang, side_ in ((285, -40, -0.45), (350, 30, -0.35), (318, 0, 0.3)):
            foot = RC + yaw @ (arc(math.radians(ang), RR + Q(4), RW * side_) - RC)
            seat = bend(zb) + V((-rad(zb) * 0.5, -rad(zb) * 0.8, 0))
            mid = seat.lerp(foot, 0.5) + V((-Q(4), Q(3), 0))
            pc.tube([seat, mid, foot], [Q(5.5), Q(5), Q(4.2)], sides=6, tip=False)
        lf2 = bend(300) + V((-Q(6), -rad(300) - Q(10), 0))   # a gold leaf on the fork
        flat_leaf(pc, lf2, V((0, 0.3, -1)), Q(26), Q(8), V((-1, 0, 0)))
        # the pinecone charm: a short cord, a green bead, the cone; two grass ribbons off the bead
        pc.paint(TWINE, None, "P_Cloth")
        bead = ringc + V((0, -Q(11), Q(1)))
        pc.tube([ringc + V((0, -Q(4), 0)), bead + V((0, Q(4), 0))], [Q(1.6)] * 2, sides=3, tip=False)
        pc.paint("#B3B04A", mat="P_Paint")
        pc.blob(bead, Q(5.5), segs=6, rings=3)
        pc.paint("#FFFFFF", cyl_uv(pp, bead, -Q(48), -Q(6), axis=(0, 1, 0)), "P_Wood")
        cone = bead + V((0, -Q(21), 0))
        lathe(pc, cone + V((0, Q(14), 0)), [(0.0, 0.0), (Q(8), -Q(4)), (Q(12), -Q(9)), (Q(9), -Q(12)), (Q(12.5), -Q(17)), (Q(8.5), -Q(21)), (Q(9.5), -Q(25)), (0.0, -Q(32))],
              n=7, axis=(0, 1, 0))
        pc.paint("#7DAF45", None, "P_Cloth")
        for dz, ln in ((-1, Q(40)), (-0.4, Q(30))):
            flat_leaf(pc, bead + V((0, -Q(2), -Q(3))), V((0, -1.0, dz)), ln, Q(4.5), V((-1, 0, 0)), n=3, blunt=True)
        # the line: the spool's foot to the tip's ring
        pc.paint(LINE, None, "P_Cloth")
        start = RC + V((0, -RR * 0.8, P(4)))
        mid = [start.lerp(rc, u) + V((0, -0.006 * math.sin(math.pi * u), 0)) for u in (0.35, 0.7)]
        pc.tube([start] + mid + [rc + V((0, -P(4), 0))], [P(1.4)] * 4, sides=3, tip=False, cap=False)

    rod = build_c("rod-cedar", at, ["P_Wood", "P_Metal", "P_Cloth", "P_Paint"], b)

    # -- the boughs: flat fronds fanned round the blank and swept toward the tip, long by the grip and short by the tip
    at2 = Atlas(256)                                     # the frond: pinnate leaflets, light at their tips, on a dark spray
    fp = at2.region(128, 224)
    fp.fill("#3F7A2E")
    for k in range(7):
        a = 0.05 + 0.85 * k / 7                         # along the frond from its base (t = 1) to its tip (t = 0)
        t, w = 1 - a, 0.47 * (1 - 0.72 * a)
        for sx in (-1, 1):
            fp.put(fp.leafm((0.5, t), (0.5 + sx * w, t - 0.085), 0.075 * (1 - 0.4 * a)), "#6FAA42")
            fp.put(fp.leafm((0.5 + sx * w * 0.35, t - 0.03), (0.5 + sx * w * 1.0, t - 0.085), 0.05 * (1 - 0.4 * a)), "#A6D468")
    fp.put(fp.leafm((0.5, 0.12), (0.5, 0.0), 0.06), "#8FC453")
    fp.put(fp.seg((0.5, 1.0), (0.5, 0.04), 0.012), "#4A6E2A")

    def frond(pc, base, d, n, L, W, lobes, tint):
        """A cedar frond: a rib from `base` along `d` in the plane whose normal is `n`, `lobes` broad leaflets a side
        (rib, notch, tip: a serrated outline, filled, a slight V-fold along `n`), the painted frond laid over it."""
        d = d.normalized()
        n = (n - d * n.dot(d)).normalized()
        side = d.cross(n)
        Lm = L * 1.1

        def F(pts):                                    # faces with the frond's uv
            vs = [pc.v(p) for p in pts]
            uv = [fp.uv(0.5 + (p - base).dot(side) / (2 * W), 1 - (p - base).dot(d) / Lm) for p in pts]
            pc.f(vs, base - n * 0.05, uv=uv, cols=[tint] * len(vs))
        rib = [base + d * (L * i / lobes) for i in range(lobes + 1)]
        for sgn in (-1, 1):
            notch = [rib[0]]
            for i in range(1, lobes + 1):
                u = i / lobes
                w = W * 0.8 * (1 - 0.72 * u)
                notch.append(rib[i] + side * (sgn * w) + n * (w * 0.2) - d * (L / lobes * 0.1))
            for i in range(lobes):
                u = (i + 0.7) / lobes
                w = W * (1.0 - 0.75 * u)
                tip = rib[i] + d * (L / lobes * 0.8) + side * (sgn * w) + n * (w * 0.25)
                F([rib[i], notch[i], tip])
                F([rib[i], tip, notch[i + 1]])
                if i < lobes - 1:
                    F([rib[i], notch[i + 1], rib[i + 1]])
            F([rib[-1], notch[-1], base + d * Lm])

    def boughs(pc):
        pc.paint("#A8502E", None, "P_Wood")             # the branch wound round the blank, the boughs leaving it
        hel = lambda px, ph=0.0: bend(px) + V((math.cos(ph + TAU * 3.5 * (px - 220) / 740), math.sin(ph + TAU * 3.5 * (px - 220) / 740), 0)) * (rad(px) + P(2.5))
        pts = [hel(220 + 740 * k / 39) for k in range(40)]
        pc.tube(pts, [P(3.4 - 2.0 * k / 39) for k in range(40)], sides=3, tip=True, cap=True)
        pc.paint("#FFFFFF", None, "P_Cloth")
        rng = np.random.default_rng(11)
        n = 32
        for i in range(n):
            u = i / (n - 1)
            px = 215 + 815 * u ** 1.05
            up = i % 2 == 0                             # alternately over and under the blank; by the reel, under it only behind
            a = (math.pi / 2 if up else -math.pi / 2) + (0.15 + 0.6 * rng.random()) * (1 if (i // 2) % 2 else -1) * (1 if up else -1)
            if not up and px < 430:
                a = -math.pi / 2 + 0.9
            r = V((math.cos(a), math.sin(a), 0))
            c = bend(px) + r * rad(px) * 0.7
            beta = math.radians(32 - 10 * u + 8 * (rng.random() - 0.5))   # its angle off the blank
            d = r * math.sin(beta) + V((0, 0, math.cos(beta)))
            L = P(40 + 130 * (1 - u) ** 1.1) * (0.85 + 0.3 * rng.random())
            L *= 0.85 if r.y < -0.2 else 1.0            # the fronds under the blank a little shorter
            tint = ("#FFFFFF", "#E6EEDD", "#F6FFE6")[i % 3]
            frond(pc, c, d, r.cross(V((0, 0, 1))), L, L * 0.4, 5 if L > P(100) else 4, tint)

    fx = build_c("Boughs", at2, ["P_Cloth", "P_Wood"], boughs, grad=(1.0, 1.0))
    fx["sway"] = 1.0
    return rod, [fx], {"rodFx": "cedar-boughs"}, particles("#CFF3A6", every=0.5, size=0.035, rise=0.18)


# ================================================================ the Flimsy
def flimsy():
    """Common, everyone's first rod (tools.ts rod_flimsy). Sheet old/flimsy: a worn dark-brown stick of a grip (pale
    scuffs where the stain has worn), a torn cream rag tied round its top with twine, its ends hanging, a cork bobber
    with a red band on a twine cord as its charm, a pale bamboo-like blank with three-turn twine wraps, a soft pointed
    tip curving up a touch, and a little wooden reel (a flower cut in its face) on a leather strap, a dowel crank."""
    S, LEN, F0 = 1171.0, 0.95, 85.0
    Z = lambda px: (px - F0) / S * LEN
    P = lambda px: px / S * LEN * 1.1                    # sizes a touch chunkier than the sheet's thin side view
    rad = lambda px: P(13 - 7.2 * max(0.0, (px - 270) / 900) ** 1.2)
    bend = lambda px: V((0, 0.018 * max(0.0, (px - 300) / 870) ** 2.5, Z(px)))
    at = Atlas(512)

    gp = at.region(192, 160)                             # the grip: dark stain worn pale in streaks
    gp.fill("#553019")
    rng = np.random.default_rng(5)
    gp.put(np.clip(np.sin(gp.t * 55 + np.sin(gp.s * 13) * 1.5) * 0.5 + 0.5, 0, 1) ** 6, "#5A321D", 0.6)
    for k in range(22):                                  # worn patches: ragged streaks along the grain, more toward the rag
        s0, t0 = rng.random(), rng.random() ** 1.6
        ln, w = 0.1 + 0.25 * rng.random(), 0.01 + 0.025 * rng.random()
        for j in range(3):
            a0 = (s0 + 0.015 * j, t0 + ln * j / 3)
            gp.put(gp.leafm(a0, (a0[0] + 0.01 * (rng.random() - 0.5), a0[1] + ln / 2), w * (1 - 0.25 * j)), "#A9784A", 0.75)
    gp.put(np.clip((gp.t - 0.93) * 20, 0, 1), "#A9784A", 0.6)                    # the butt end's worn rim
    bp = at.region(64, 256)                              # the blank: pale cane, faint grain
    bp.fill("#DCA35F")
    bp.put(np.clip(np.sin(bp.s * 40 + np.sin(bp.t * 30) * 0.6) * 0.5 + 0.5, 0, 1) ** 5, "#C98E4E", 0.35)
    bp.put(np.clip(np.sin(bp.s * 17 + 1) * 0.5 + 0.5, 0, 1) ** 10, "#F3CD8E", 0.6)
    wp = at.region(64, 32)                               # a twine wrap: three turns
    wp.fill("#A87440")
    for k in range(3):                                   # each turn a round cord: dark in the grooves, lit on top
        u = np.clip(1 - np.abs(wp.t - (k + 0.5) / 3) * 6.5, 0, 1)
        wp.put(u ** 0.5, "#D4A164")
        wp.put(u ** 2, "#F2CB90")
        wp.put(np.clip(np.sin(wp.s * 40 + k) * 0.5 + 0.5, 0, 1) ** 8 * u, "#9A6A36", 0.5)
    rp = at.region(128, 128)                             # the reel's face: plain wood, a six-petal flower cut in it
    rp.fill("#C99158")
    d = np.hypot(rp.s - 0.5, rp.t - 0.5)
    rp.put(np.clip((d - 0.44) * 50, 0, 1), "#A9703F")
    rp.put((np.sin(rp.s * 30 + rp.t * 6) * 0.5 + 0.5) ** 6, "#B47C47", 0.4)
    for k in range(6):
        a = TAU * k / 6 + math.pi / 2
        rp.put(rp.leafm((0.5, 0.5), (0.5 + 0.27 * math.cos(a), 0.5 - 0.27 * math.sin(a)), 0.06), "#93582C")
    rp.put(rp.disc(0.5, 0.5, 0.045), "#B47C47")
    cp = at.region(64, 96)                               # the bobber: cork, a red band round its middle
    cp.fill("#DDB677")
    cp.put((np.sin(cp.s * 50) * np.sin(cp.t * 37) * 0.5 + 0.5) ** 8, "#B88C52", 0.5)
    cp.put(np.abs(cp.t - 0.5) < 0.1, "#C8473A")
    cp.put(np.abs(cp.t - 0.5) < 0.04, "#DA6248", 0.6)

    TWINE, RAG, STRAP, REEL, LINE = "#C39253", "#DCCFB4", "#A9703A", "#C99158", "#EFEADF"
    G = 1.45                                            # the grip, rag and charm at the hero's girth
    RC = V((-P(4), -P(56), Z(330)))
    RR, RW = P(41), P(44)

    def b(pc):
        # the grip: a rounded butt, tapering to the rag
        pc.paint("#FFFFFF", cyl_uv(gp, (0, 0, 0), Z(55), Z(230)), "P_Wood")
        lathe(pc, (0, 0, 0), [(0.0, Z(55)), (P(16) * G, Z(55)), (P(18.5) * G, Z(60)), (P(18.5) * G, Z(72)), (P(17.5) * G, Z(130)), (P(15.5) * G, Z(200)), (P(15) * G, Z(230))], n=10)
        # the blank
        pc.paint("#FFFFFF", cyl_uv(bp, (0, 0, 0), Z(220), Z(1226)), "P_Wood")
        zs = [225, 300, 420, 560, 700, 840, 980, 1100, 1190]
        loft(pc, [bend(z) for z in zs], [rad(z) for z in zs], sides=7, tip=False, cap=False)
        tz, d = bend(1190), (bend(1226) - bend(1190)).normalized()
        lathe(pc, tz, [(rad(1190), 0.0), (P(5), P(14)), (P(3.5), P(30)), (0.0, P(38))], n=6, axis=d)
        # the rag round the grip's top, its two torn ends hanging toward the butt, twine round it and a knot
        pc.paint(RAG, None, "P_Cloth")
        lathe(pc, (0, 0, 0), [(P(15.5) * G, Z(222)), (P(17.5) * G, Z(228)), (P(18) * G, Z(250)), (P(16) * G, Z(268)), (rad(276) * 1.15, Z(278))], n=9)
        for tip, w0 in (((-P(16), -P(98), Z(185)), P(13)), ((-P(20), -P(66), Z(200)), P(10))):
            top = V((-P(11), -P(21), Z(240)))
            tip = V(tip)
            dn = (tip - top).normalized()
            sd = dn.cross(V((-1, 0, 0))).normalized()
            m = top.lerp(tip, 0.55) + V((-P(3), 0, 0))
            vs = [pc.v(top - sd * w0 * 0.8), pc.v(m - sd * w0), pc.v(tip - sd * w0 * 0.6), pc.v(tip + dn * P(-6)), pc.v(tip + sd * w0 * 0.5 + dn * P(-12)),
                  pc.v(m + sd * w0 * 0.9), pc.v(top + sd * w0 * 0.8)]
            for i in range(1, 6):
                pc.f([vs[0], vs[i], vs[i + 1]], m + V((0.05, 0, 0)))
        pc.paint("#FFFFFF", None, "P_Cloth")
        for z in (250, 292, 372, 440, 640, 860, 1125):
            c = bend(z)
            r = (P(18.5) * G if z == 250 else rad(z) * 1.38)
            w = P(22 if z > 270 else 16)
            pc.paint("#C08A52", None)                    # three raised turns of twine, lit on their crowns
            prof = [(r * 0.9, 0.0)] + [(r * (1.07 if k % 2 else 0.94), w * k / 6) for k in range(1, 6)] + [(r * 0.9, w)]
            n0 = pc.mark()
            lathe(pc, c - V((0, 0, w / 2)), prof, n=8)
            for f in pc.since(n0):                      # the crowns lighter than the grooves
                pc.vcols[f] = {v: ("#E2B47A" if (v.co - c).xy.length > r * 1.0 else "#9A6A38") for v in f.verts}
        # the bobber charm: a cord from a knot under the wrap, the cork, a tassel
        pc.paint(TWINE, None, "P_Cloth")
        knot = V((-P(6), -P(27), Z(252)))
        pc.blob(knot, P(5.5), segs=6, rings=3)
        bob = V((-P(6), -P(96), Z(256)))
        pc.tube([knot, bob + V((0, P(30), 0))], [P(2)] * 2, sides=3, tip=False, cap=False)
        pc.paint("#FFFFFF", cyl_uv(cp, bob, -P(30), P(22), axis=(0, -1, 0)), "P_Wood")
        lathe(pc, bob + V((0, P(30), 0)), [(0.0, 0.0), (P(7), -P(1.5)), (P(15), -P(5.5)), (P(18), -P(12.5)), (P(18), -P(40)), (P(15), -P(47)), (P(7), -P(51)), (0.0, -P(52))], n=10, axis=(0, 1, 0))
        pc.paint(TWINE, None, "P_Cloth")
        tas = bob + V((0, -P(22), 0))
        pc.blob(tas, P(4), segs=5, rings=3)
        for k in (-1, 0, 1):
            pc.tube([tas, tas + V((P(3) * k, -P(28), P(4) * k))], [P(2.4), P(1.6)], sides=3, tip=False)
        # the reel on its leather strap: the back plate, the line, the face with its flower, turned toward the tip
        n0 = pc.mark()
        x = V((1, 0, 0))
        pc.paint(REEL, None, "P_Wood")
        lathe(pc, RC + x * (RW / 2), [(0.0, 0.0), (RR * 0.95, 0.0), (RR * 0.97, -P(4))], n=12, axis=(-1, 0, 0))
        pc.paint(LINE, mat="P_Cloth")
        lathe(pc, RC + x * (RW / 2 - P(4)), [(RR * 0.9, 0.0), (RR * 0.9, RW - P(8))], n=12, axis=(-1, 0, 0))
        pc.paint("#B47C47", mat="P_Wood")
        lathe(pc, RC - x * (RW / 2 - P(4)), [(RR, 0.0), (RR, P(4))], n=12, axis=(-1, 0, 0))
        pc.paint("#FFFFFF", disc_uv(rp, RC - x * (RW / 2), RR, (-1, 0, 0), up=(0, 1, 0)))
        lathe(pc, RC - x * (RW / 2), [(RR, 0.0), (0.0, 0.0)], n=12, axis=(-1, 0, 0))
        hub = RC - x * (RW / 2)
        kn = hub + V((-P(18), -P(36), P(34)))
        pc.paint("#8E5A30", None, "P_Wood")                 # the crank: a dowel arm, a knob
        pc.tube([hub + x * P(2), hub - x * P(6), kn + V((P(6), P(6), -P(6)))], [P(5)] * 3, sides=5, tip=False)
        kd = V((-0.4, -0.35, 1.0)).normalized()
        capsule(pc, kn, kd, P(8.5), P(30), n=8, rings=2)
        yaw = Matrix.Rotation(math.radians(40), 3, "Y")
        for v in {v for f in pc.since(n0) for v in f.verts}:
            v.co = RC + yaw @ (v.co - RC)
        for f in pc.since(n0):
            pc.ref[f] = tuple(RC + yaw @ (V(pc.ref[f]) - RC))
        pc.paint(STRAP, None, "P_Leather")                # the strap: round the blank and down to the reel's back, a rivet
        c = bend(332)
        ring(pc, c, (0, 0, 1), rad(332) * 1.35, P(28), sides=8)
        top, foot = c + V((0, -rad(332), 0)), V((RC.x, RC.y + RR * 0.7, c.z))
        pc.tube([top, foot], [(P(5), P(14)), (P(5), P(14))], sides=6, tip=False)
        pc.paint("#8A5A2E", mat="P_Metal")
        pc.blob(top.lerp(foot, 0.45) + V((-P(5.5), 0, 0)), P(4), segs=5, rings=3)
        # the line
        pc.paint(LINE, None, "P_Cloth")
        start = RC + V((0, -RR * 0.85, P(6)))
        end = bend(1205) + V((0, -P(4), 0))
        pc.tube([start, start.lerp(end, 0.5) + V((0, -0.004, 0)), end], [P(1.3)] * 3, sides=3, tip=False, cap=False)

    return build_c("rod-flimsy", at, ["P_Wood", "P_Cloth", "P_Leather", "P_Metal"], b), [], {}, {}


# ================================================================ the Training rod, its first look and its second
def dashes(patch, pts, r, col, on=0.03, off=0.022):
    """A dashed stitch along the polyline `pts` ((s, t) pairs): dashes `on` long with `off` gaps (units of the width)."""
    k = patch.h / patch.w
    P_ = [np.array([a[0], a[1] * k]) for a in pts]
    seglen = [float(np.linalg.norm(b - a)) for a, b in zip(P_, P_[1:])]
    total, step = sum(seglen), on + off

    def at(x):                                         # the point x along the line
        for a, b, L in zip(P_, P_[1:], seglen):
            if x <= L or L == seglen[-1]:
                p = a + (b - a) * min(x / max(L, 1e-9), 1.0)
                return (p[0], p[1] / k)
            x -= L
    for n in range(int(total / step) + 1):
        x0 = n * step
        patch.put(patch.seg(at(x0), at(min(total, x0 + on)), r), col)


def training(stage=1):
    """The Training rod (Gary's trade for the Flimsy, rods.ts rod_training), drawn as a toy. Stage 1, sheet
    old/training1: a fat sky-blue fabric grip with finger waves under it, white stitching round its ends and along it,
    a brass tag with a fish on it hung from a loop, a cream collar, a glossy yellow blank with two blue bands and
    little "III" marks, a white ferrule and a red safety ball, and a bobber reel (a ball, red over white) on a cream
    foot, a gold crank to a red knob. Stage 2 (rare looks, at 50 fish; sheet training2-a): the same rod well used: the
    paint worn and faded, scales cut into the yellow, black grip tape round the grip, a red cord knot with the tag, a
    bead and a torn wave-print tassel, a bandage bound round the blank's middle with twine, a steel plate riveted over
    the reel's lower half, and amber light leaking from the cracks (its effect, rodfx-training-2)."""
    S, LEN, F0 = 1137.0, 0.95, 118.0
    Z = lambda px: (px - F0) / S * LEN
    P = lambda px: px / S * LEN
    rad = lambda px: P(15 - 4.5 * max(0.0, (px - 300) / 778))
    bend = lambda px: V((0, 0.008 * max(0.0, (px - 270) / 808) ** 2, Z(px)))
    worn = stage == 2
    at = Atlas(512)

    # -- the grip: the sheet's side view, its top nearly straight, finger waves under it, rounded at the butt
    GL, G = 285.0, 1.35                                 # the grip's length and its girth over the side view (the hero's)
    BS = GL + 22                                        # the blank's start, past the collar

    def gsurf(th, px, lift=0.0):
        u = px / GL
        win = math.sin(math.pi * min(1.0, max(0.0, (u - 0.06) / 0.86))) ** 0.6     # the finger bumps, eased in and out
        top = G * (13 + 14 * u) + 4.5 * math.cos(TAU * 4 * u + 0.6) * win
        bot = -G * (54 - 23 * u) + 7.5 * math.cos(TAU * 4 * u) * win
        rx = G * (31 - 6 * u) + 3.5 * math.cos(TAU * 4 * u + 0.3) * win
        k = 1.0 if px >= 12 else (0.72 + 0.28 * (px / 12) ** 0.5)
        cy, ry = (top + bot) / 2, (top - bot) / 2
        return V((P(rx * k + lift) * math.cos(th), P(cy + (ry * k + lift) * math.sin(th)), Z(px)))

    gp = at.region(224, 160)                             # the fabric: blue, stitched in cream round both ends and along it
    gp.fill("#3E7FD2" if not worn else "#263F6E")
    gp.put(np.clip(np.sin(gp.s * TAU - 1.2) * 0.5 + 0.5, 0, 1) ** 2, "#5D9BE6" if not worn else "#4A66A0", 0.45)            # its lit top
    gp.put((np.sin(gp.s * 220) * np.sin(gp.t * 160) * 0.5 + 0.5) ** 6, "#2F67B3", 0.25)         # the weave
    if worn:
        rng = np.random.default_rng(8)
        gp.put(np.ones_like(gp.s), "#3A4F78", 0.3)    # faded
        for _ in range(70):                             # scuffs worn through to the pale under-fabric, ragged
            c = (rng.random(), rng.random() ** 0.7)
            a = rng.random() * TAU
            ln = 0.03 + 0.06 * rng.random()
            gp.put(gp.leafm(c, (c[0] + ln * math.cos(a), c[1] + ln * math.sin(a) * 1.5), 0.008 + 0.016 * rng.random()), "#C9B58A", 0.9)
    st = "#F1E6CC"
    for t in (0.04, 0.92):
        dashes(gp, [(0.0, t), (1.0, t)], 0.006, st)
    for s0 in (0.25, 0.5):
        dashes(gp, [(s0 + 0.012 * math.sin(i * 1.3), 0.06 + 0.84 * i / 12) for i in range(13)], 0.006, st)

    bp = at.region(40, 400)                              # the blank: yellow, two blue bands, the "III" marks
    bp.fill("#F3C537" if not worn else "#C9A546")
    bp.put(np.clip(np.sin(bp.s * TAU - 1.2) * 0.5 + 0.5, 0, 1) ** 4, "#FFE27A", 0.7)
    T = lambda px: (1078 - px) / (1078 - BS)                     # a station to the patch's t (0 at the tip)
    if worn:                                             # fish scales cut in, the paint worn off in patches
        for row in range(44):                            # engraved scale arcs, faint
            for k in range(4):
                cs, ct = (k + 0.5 * (row % 2)) / 4, row / 44
                ring = np.abs(np.hypot(bp.s - cs, (bp.t - ct) * bp.h / bp.w * 0.3) - 0.14)
                bp.put((ring < 0.011) & (bp.t > ct), "#9A7A2C", 0.6)
        rng = np.random.default_rng(4)
        bp.put(np.ones_like(bp.s), "#BFA65E", 0.25)
        for _ in range(40):                              # scratches across the scales
            a0 = (rng.random(), rng.random())
            bp.put(bp.seg(a0, (a0[0] + 0.3 * (rng.random() - 0.5), a0[1] + 0.03 * (rng.random() - 0.5)), 0.006), "#EFE4C4", 0.8)
        for _ in range(26):
            c = (rng.random(), rng.random())
            bp.put(bp.leafm(c, (c[0] + 0.15 * (rng.random() - 0.5), c[1] + 0.02 + 0.02 * rng.random()), 0.03 + 0.04 * rng.random()), "#EDE3C8", 0.8)
    for px in ((546, 758) if not worn else (546, 830)):
        bp.put(np.abs(bp.t - T(px)) < 12.5 / 808, "#2F8FE0" if not worn else "#4F7FC0")
    for px in (398, 638, 878):
        for j in (-1, 0, 1):
            bp.put(bp.seg((0.41, T(px) + j * 10 / 808), (0.59, T(px) + j * 10 / 808), 0.045), "#C2741E")
    tg = at.region(64, 80)                               # the tag: brass, a hole, a swirl, a fish
    tg.fill("#D8AE4E")
    tg.put(np.clip((np.abs(tg.s - 0.5) - 0.40) * 30, 0, 1) + np.clip((tg.t - 0.92) * 30, 0, 1), "#B48834")
    tg.put(tg.disc(0.5, 0.17, 0.08), "#6E4E1A")
    for i in range(8):
        a0, a1 = i * 0.8, (i + 1) * 0.8
        r0, r1 = 0.02 + 0.012 * i, 0.02 + 0.012 * (i + 1)
        tg.put(tg.seg((0.5 + r0 * math.cos(a0), 0.36 + r0 * math.sin(a0) * 0.8), (0.5 + r1 * math.cos(a1), 0.36 + r1 * math.sin(a1) * 0.8), 0.01), "#8A6424")
    tg.put(tg.leafm((0.28, 0.66), (0.66, 0.66), 0.12), "#8A6424")
    tg.put(tg.leafm((0.62, 0.66), (0.78, 0.58), 0.06) + tg.leafm((0.62, 0.66), (0.78, 0.74), 0.06), "#8A6424")
    tg.put(tg.disc(0.36, 0.64, 0.02), "#D8AE4E")
    if worn:
        bd = at.region(96, 64)                           # the bandage: cream cloth, stained, a blue mark
        bd.fill("#CDBF9E")
        bd.put((np.sin(bd.s * 70) * 0.5 + 0.5) ** 8, "#CFC2A5", 0.6)
        bd.put(np.clip(1 - np.abs(bd.t - 0.5) * 2.2, 0, 1) < 0.15, "#BFAF8E", 0.5)
        for a, b_ in (((0.42, 0.4), (0.5, 0.4)), ((0.43, 0.52), (0.52, 0.5)), ((0.47, 0.36), (0.45, 0.58))):
            bd.put(bd.seg(a, b_, 0.014), "#5578B8", 0.8)
        bd.put(np.clip((np.abs(bd.t - 0.5) - 0.4) * 12, 0, 1), "#A8987A", 0.7)        # frayed, darker edges
        wv = at.region(64, 96)                           # the torn tassel: indigo, a wave print
        wv.fill("#3C4F9A")
        for row in range(5):
            for k in range(4):
                cs, ct = (k + 0.5 * (row % 2)) / 3, 0.15 + row * 0.2
                for rr in (0.2, 0.13):
                    ring = np.abs(np.hypot(wv.s - cs, (wv.t - ct) * 1.5) - rr)
                    wv.put((ring < 0.025) & (wv.t < ct), "#D9C690")
        tw = at.region(64, 32)                           # a twine wrap
        tw.fill("#7A4F27")
        for k in range(4):
            u = np.clip(1 - np.abs(tw.t - (k + 0.5) / 4) * 8, 0, 1)
            tw.put(u ** 0.6, "#A8743F")
            tw.put(u ** 3, "#C99558")

    RED, WHITE, CREAM, GOLD, BLUE = ("#DE4537", "#F4EFE6", "#EFE6D6", "#E0B24A", "#3E7FD2") if not worn else ("#9C3A2C", "#E4DDCF", "#C9C1B2", "#B8913E", "#4A72AE")
    RC, RR = V((-P(4), -P(93), Z(GL + 62))), P(65)
    K = RR / P(45)                                      # the crank and hub grow with the reel
    glow_bits = []

    def strip(pc, surf, z0, tilt, w, n=12, patch=None, lift=1.5, sweep=1.0, amp=30):
        """A band of tape or cloth round a surface (surf(theta, px, lift) -> point) at station z0, tilted, w wide."""
        rows = []
        for i in range(n + 1):
            th = TAU * sweep * i / n
            zc = z0 + math.tan(tilt) * amp * math.cos(th)
            rows.append((surf(th, zc - w / 2, lift), surf(th, zc + w / 2, lift)))
        for i in range(n):
            (a, b_), (c, d) = rows[i], rows[i + 1]
            vs = [pc.v(a), pc.v(c), pc.v(d), pc.v(b_)]
            mid = (a + c) / 2
            axis_pt = V((0, mid.y * 0.4, mid.z))
            uv = [patch.uv(i / n, 1), patch.uv((i + 1) / n, 1), patch.uv((i + 1) / n, 0), patch.uv(i / n, 0)] if patch else None
            pc.f(vs, axis_pt, uv=uv)

    bsurf = lambda th, px, lift=0.0: bend(px) + V((math.cos(th), math.sin(th), 0)) * (rad(px) + P(lift))

    def b(pc):
        # the grip: rings round its odd section, its fabric laid on by angle and station
        pc.paint("#FFFFFF", None, "P_Cloth")
        stations = [0, 4, 12, 24] + [24 + (GL - 24) * i / 22 for i in range(1, 23)]
        N = 12
        rings = [[gsurf(TAU * k / N, z) for k in range(N)] for z in stations]
        for i in range(len(stations) - 1):
            for k in range(N):
                k1 = (k + 1) % N
                ta, tb = 1 - stations[i] / GL, 1 - stations[i + 1] / GL
                pc.f([pc.v(rings[i][k]), pc.v(rings[i][k1]), pc.v(rings[i + 1][k1]), pc.v(rings[i + 1][k])], V((0, (rings[i][3].y + rings[i][9].y) / 2, rings[i][0].z)),
                     uv=[gp.uv(k / N, ta), gp.uv((k + 1) / N, ta), gp.uv((k + 1) / N, tb), gp.uv(k / N, tb)])
        cb = sum(rings[0], V()) / N                    # the butt's end
        cv = pc.v(cb - V((0, 0, P(2))))
        for k in range(N):
            pc.f([pc.v(rings[0][(k + 1) % N]), pc.v(rings[0][k]), cv], cb + V((0, 0, 0.05)), uv=[gp.uv(0.5, 0.98)] * 3)
        # the collar
        pc.paint(CREAM, None, "P_Paint")
        lathe(pc, V((0, -P(3), 0)), [(P(27), Z(GL - 4)), (P(31), Z(GL + 1)), (P(31), Z(BS - 6)), (P(26), Z(BS - 1)), (rad(BS) + P(1), Z(BS))], n=12)
        # the blank
        pc.paint("#FFFFFF", cyl_uv(bp, (0, 0, 0), Z(BS), Z(1078)), "P_Paint")
        zs = [BS, 440, 600, 780, 940, 1078]
        loft(pc, [bend(z) for z in zs], [rad(z) for z in zs], sides=8, tip=False, cap=False)
        # the ferrule and the safety ball
        pc.paint(WHITE, None, "P_Paint")
        tz = bend(1076)
        lathe(pc, tz, [(rad(1078) * 1.1, 0.0), (P(11.5), P(3)), (P(11.5), P(16)), (P(9), P(19))], n=8)
        pc.paint(RED)
        bc = bend(1076) + V((0, 0, P(42)))
        lathe(pc, bc, [(0.0, -P(27))] + [(P(27) * math.sin(math.pi * i / 5), -P(27) * math.cos(math.pi * i / 5)) for i in range(1, 5)] + [(0.0, P(27))], n=8)
        # the tag's loop round the grip, and the tag on the camera side
        pc.paint(GOLD, None, "P_Metal")
        tz_ = 228 if not worn else 255
        lp = [gsurf(TAU * k / 8, tz_, 1.2) for k in range(8)]
        pc.tube(lp, [P(1.4)] * 8, sides=3, closed_loop=True)
        side = gsurf(math.pi, tz_, 2.0)
        top = side + V((-P(1), -P(2), 0)) if not worn else side + V((-P(3), -P(34), P(4)))
        if worn:                                         # the red cord: a loop knot under the grip's side, down to the tag
            pc.paint("#B43A2A", None, "P_Cloth")
            for a, r_ in ((0.0, 7), (2.1, 7), (4.2, 7)):  # three loops
                c = side + V((-P(4), -P(18), 0)) + V((0, math.cos(a) * P(15), math.sin(a) * P(15)))
                pc.tube([c + V((-P(1), math.cos(TAU * j / 6) * P(r_ * 1.1), math.sin(TAU * j / 6) * P(r_ * 1.1))) for j in range(6)], [P(2.6)] * 6, sides=3, closed_loop=True)
            pc.blob(side + V((-P(4), -P(18), 0)), P(6), segs=6, rings=3)
            pc.tube([side + V((-P(2), 0, 0)), side + V((-P(3), -P(18), 0)), top], [P(2.2)] * 3, sides=3, tip=False)
            pc.paint("#4C7FD8", None, "P_Paint")
            pc.blob(top + V((-P(2), -P(8), P(16))), P(4.5), segs=6, rings=3)
            pc.paint(GOLD, None, "P_Metal")
        tw_, th_ = P(42), P(52)
        if not worn:
            top = top + V((0, P(12), 0))
        tc = top + V((-P(1.5), -th_ / 2 - P(2), 0))
        pc.paint("#FFFFFF", None, "P_Metal")
        outline = [(0.0, 0.5), (0.28, 0.32), (0.5, 0.25), (0.5, -0.5), (-0.5, -0.5), (-0.5, 0.25), (-0.28, 0.32)]
        q = lambda a, b_: tc + V((0, b_ * th_, a * tw_))
        vs = [pc.v(q(a, b_)) for a, b_ in outline]
        uvs = [tg.uv(0.5 + a, 0.5 - b_) for a, b_ in outline]
        for i in range(1, len(vs) - 1):
            pc.f([vs[0], vs[i], vs[i + 1]], tc + V((0.05, 0, 0)), uv=[uvs[0], uvs[i], uvs[i + 1]])
        back = [pc.v(q(a, b_) + V((P(2.5), 0, 0))) for a, b_ in outline]
        for i in range(1, len(vs) - 1):
            pc.f([back[0], back[i + 1], back[i]], tc - V((0.05, 0, 0)), uv=[uvs[0]] * 3)
        for i in range(len(vs)):
            j = (i + 1) % len(vs)
            pc.f([vs[i], vs[j], back[j], back[i]], tc, uv=[tg.uv(0.02, 0.5)] * 4)
        pc.tube([top + V((-P(1), P(2), 0)), top + V((-P(1.5), -P(6), 0))], [P(1.3)] * 2, sides=3, tip=False)
        # the reel: a ball, red over white (poles up and down, so its equator is a ring of edges), a gold hub, the crank
        segs, lat = 12, 6
        sx = 0.78                                        # a little flat across X
        pole_t, pole_b = pc.v(RC + V((0, RR, 0))), pc.v(RC - V((0, RR, 0)))
        rows = []
        for i in range(1, lat):
            la = math.pi / 2 - math.pi * i / lat
            rows.append([pc.v(RC + V((math.cos(TAU * k / segs) * math.cos(la) * RR * sx, math.sin(la) * RR, math.sin(TAU * k / segs) * math.cos(la) * RR))) for k in range(segs)])
        for i in range(lat):
            pc.paint(RED if i < lat // 2 else WHITE, None, "P_Paint")
            if worn and i >= lat // 2:
                pc.paint("#6E747B", None, "P_Metal")     # the battered steel plate over its lower half
            for k in range(segs):
                k1 = (k + 1) % segs
                if i == 0:
                    pc.f([pole_t, rows[0][k1], rows[0][k]], RC)
                elif i == lat - 1:
                    pc.f([pole_b, rows[-1][k], rows[-1][k1]], RC)
                else:
                    pc.f([rows[i - 1][k], rows[i - 1][k1], rows[i][k1], rows[i][k]], RC)
        if not worn:                                     # the dark seam between the halves
            pc.paint("#8E2A22", None, "P_Paint")
            pc.tube([RC + V((math.cos(TAU * k / 14) * RR * sx * 1.01, 0, math.sin(TAU * k / 14) * RR * 1.01)) for k in range(14)], [P(2.2)] * 14, sides=3, closed_loop=True)
        if worn:                                         # the plate's rivets, and its lip at the equator
            pc.paint("#7E858C", None, "P_Metal")
            for a in (-60, -20, 20, 60):
                th = math.radians(180 + a)
                p_ = RC + V((math.cos(th) * RR * sx * 0.93, -RR * 0.36, math.sin(th) * RR * 0.93))
                pc.blob(p_, P(3.4) * K, segs=4, rings=2)
            glow_bits.append(("ring", RC, RR, sx))
            sp = lambda az, la, k=1.04: RC + V((math.cos(az) * math.cos(la) * RR * sx * k, math.sin(la) * RR * k, math.sin(az) * math.cos(la) * RR * k))
            pc.paint("#8E959C", None, "P_Metal")         # a patch plate riveted over a split in the red half
            g = [[pc.v(sp(math.pi - 0.55 + 0.35 * i, 0.28 + 0.3 * j)) for j in range(3)] for i in range(3)]
            for i in range(2):
                for j in range(2):
                    pc.f([g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]], RC)
            pc.paint("#5E646B")
            for i, j in ((0, 0), (2, 0), (0, 2), (2, 2)):
                pc.blob(sp(math.pi - 0.5 + 0.3 * i, 0.32 + 0.26 * j, 1.06), P(3) * K, segs=4, rings=2)
            pc.paint("#5A1E18", None, "P_Paint")          # a dent in the paint
            dc = sp(math.pi + 0.55, 0.75, 1.005)
            n_ = (dc - RC).normalized()
            t1 = n_.cross(V((0, 0, 1))).normalized()
            t2 = n_.cross(t1)
            ring_ = [pc.v(dc + (t1 * math.cos(TAU * q / 6) + t2 * math.sin(TAU * q / 6)) * P(7) * K) for q in range(6)]
            for q in range(1, 5):
                pc.f([ring_[0], ring_[q], ring_[q + 1]], RC)
        pc.paint(GOLD, None, "P_Metal")
        hub = RC + V((-RR * sx, 0, 0))
        lathe(pc, hub + V((P(4), 0, 0)), [(P(16) * K, 0.0), (P(16) * K, -P(5) * K), (P(10) * K, -P(8) * K), (0.0, -P(9) * K)], n=10, axis=(1, 0, 0))
        kn = hub + V((-P(16), -P(32), P(46))) * K
        pc.tube([hub - V((P(8), 0, 0)) * K, hub + V((-P(11), -P(14), P(22))) * K, kn + V((P(3), P(2), -P(12))) * K], [(P(4) * K, P(8) * K)] * 3, sides=6, tip=False)
        pc.paint(RED, None, "P_Paint")
        capsule(pc, kn, V((0, -0.2, 1)), P(12) * K, P(38) * K, n=8, rings=2)
        # its foot: a cream post off the blank with a gold rivet
        pc.paint(CREAM, None, "P_Paint")
        ft, fb = bend(RC.z * 0 + GL + 58) + V((0, -rad(GL + 58) * 0.8, 0)), RC + V((0, RR * 0.92, 0))
        pc.tube([ft, fb], [(P(7), P(17)), (P(7), P(17))], sides=6, tip=False)
        lathe(pc, ft + V((0, -P(1), 0)), [(P(19), 0.0), (P(19), -P(5))], n=6, axis=(0, -1, 0), sx=0.6)
        pc.paint(GOLD, None, "P_Metal")
        pc.blob(ft.lerp(fb, 0.55) + V((-P(6), 0, 0)), P(3), segs=5, rings=3)
        if worn:
            # black grip tape: four turns, crossing
            pc.paint("#3A3A40", None, "P_Cloth")
            for z0, tl in ((70, 0.5), (112, 0.5), (154, 0.5), (132, -0.6)):
                strip(pc, gsurf, z0, tl, 26, n=12, lift=2.2 + 0.8 * (tl < 0), amp=44)
            # the bandage round the blank's middle, twine at both ends, its torn end hanging
            pc.paint("#FFFFFF", None, "P_Cloth")
            for z0, tl, l_ in ((596, 0.7, 4.0), (624, -0.6, 6.5), (652, 0.65, 9.0), (680, -0.65, 10.5), (708, 0.6, 8.5), (734, -0.6, 5.5)):
                strip(pc, bsurf, z0, tl, 50, n=10, patch=bd, lift=l_, amp=30)
            pc.paint("#FFFFFF", None, "P_Cloth")
            for z in (570, 754):
                c = bend(z)
                pc.paint(uvfn=cyl_uv(tw, c, c.z - P(5), c.z + P(5)))
                lathe(pc, c - V((0, 0, P(5))), [(rad(z) + P(3), 0.0), (rad(z) + P(5), P(5)), (rad(z) + P(3), P(10))], n=7)
            pc.paint("#E3D8BF", None, "P_Cloth")
            for z_, dd, ln in ((712, V((0, -1, 0.7)), P(62)), (690, V((0, -1, 0.35)), P(46))):    # its frayed ends hanging
                e0 = bsurf(-math.pi * 0.6, z_, 7.0)
                torn(pc, e0, e0 + dd.normalized() * ln, P(12))
            pc.paint("#8A5A2E", None, "P_Cloth")       # the twine's cord, a blue bead and two gold ones, the tassel
            cd = bsurf(-math.pi / 2, 570, 6.0)
            bead = cd + V((-P(3), -P(52), -P(6)))
            pc.tube([cd, cd + V((0, -P(20), -P(4))), bead + V((0, P(5), 0))], [P(1.5)] * 3, sides=3, tip=False)
            pc.paint("#4C7FD8", None, "P_Paint")
            pc.blob(bead, P(6), segs=6, rings=4)
            pc.paint(GOLD, None, "P_Metal")
            for dz in (-P(5), P(5)):
                pc.blob(bead + V((0, -P(9), dz)), P(3.5), segs=5, rings=3)
            pc.paint("#FFFFFF", None, "P_Cloth")
            for base, ln, wd in ((bead + V((0, -P(12), 0)), P(52), P(10)), (top + V((-P(1), -th_ - P(4), -P(8))), P(80), P(13)), (top + V((-P(1.5), -th_ - P(4), P(6))), P(66), P(12)), (top + V((-P(2), -th_ - P(4), -P(1))), P(72), P(11))):
                n0 = pc.mark()
                torn(pc, base, base + V((0, -1, -0.25)).normalized() * ln, wd * 1.4, feather=True)
                for f in pc.since(n0):              # the wave print laid along it
                    pc.fuv[f] = {v: wv.uv(0.5 + (v.co - base).z / (3 * wd), min(1, max(0, (base.y - v.co.y) / ln))) for v in f.verts}
            glow_bits.append(("cracks",))
        # the line: off the reel's top, to the ferrule
        pc.paint(WHITE if not worn else "#EDE7DA", None, "P_Cloth")
        start, end = RC + V((0, RR * 0.6, RR * 0.7)), bend(1090) + V((0, -P(10), 0))
        pc.tube([start, start.lerp(end, 0.5) + V((0, -0.004, 0)), end], [P(1.3)] * 3, sides=3, tip=False, cap=False)

    name = "rod-training" if stage == 1 else "rod-training-2"
    rod = build_c(name, at, ["P_Cloth", "P_Paint", "P_Metal"], b)
    if not worn:
        return rod, [], {}, {}

    def amber(pc):
        pc.mat = "Glow"
        for k in range(segs_ := 14):                     # the reel's seam, a thin bright ring at its equator
            a0, a1 = TAU * k / segs_, TAU * (k + 1) / segs_
            ring_ = [RC + V((math.cos(a) * RR * 0.78 * 1.07, dy, math.sin(a) * RR * 1.07)) for a in (a0, a1) for dy in (-P(4), P(4))]
            pc.f([pc.v(ring_[0]), pc.v(ring_[2]), pc.v(ring_[3]), pc.v(ring_[1])], RC)
        for z0, tl, l_ in ((596, 0.7, 4.0), (624, -0.6, 6.5), (652, 0.65, 9.0), (680, -0.65, 10.5), (708, 0.6, 8.5), (734, -0.6, 5.5)):
            strip(pc, bsurf, z0 - 24, tl, 4, n=10, lift=l_ + 0.8, amp=30)          # light leaking at each turn's edge
        rng = np.random.default_rng(2)                   # cracks peeking out of the bandage, zigzags on the blank
        for z0, th0 in ((606, 2.6), (628, 3.6), (660, 2.2), (690, 4.0), (722, 3.0), (640, 1.2), (700, 1.6), (668, 5.0)):
            pts = [bsurf(th0 + 0.22 * j * (1 if j % 2 else 0.5), z0 + 9 * j, 6.5) for j in range(4)]
            for a, b_ in zip(pts, pts[1:]):
                d = (b_ - a)
                n_ = d.cross(V((0, 0, 1)) if abs(d.z) < 0.9 * d.length else V((1, 0, 0))).normalized() * P(2.4)
                pc.f([pc.v(a - n_), pc.v(b_ - n_), pc.v(b_ + n_), pc.v(a + n_)], bend(z0))
    fx = glow("Cracks", "#FFA33A", amber, pivot=tuple(bend(610)), pulse=0.25)
    halos = [fx_empty("Halo_Bandage", tuple(bend(662)), size=0.11, color="#FFB347"),
             fx_empty("Halo_Reel", tuple(RC + V((-RR * 0.8, 0, 0))), size=0.07, color="#FFB347")]
    return rod, [fx] + halos, {"rodFx": "training-2"}, particles("#FFC36B", every=0.35, size=0.03, rise=0.12)


# ================================================================ build
FILES = {"cedar": ("rod-cedar", "rodfx-cedar-boughs"), "flimsy": ("rod-flimsy", None), "training": ("rod-training", None),
         "training-2": ("rod-training-2", "rodfx-training-2")}
BUILDS = {"cedar": cedar, "flimsy": flimsy, "training": training, "training-2": lambda: training(2)}
only = ARGS[ARGS.index("only") + 1].split(",") if "only" in ARGS else list(BUILDS)
for name in only:
    rod, fx, rx, fxx = BUILDS[name]()
    rf, ff = FILES[name]
    export([rod], os.path.join(TOOLS, f"{rf}.glb"), rx)
    print(f"MODEL tools/{rf} tris={tri_count(rod)} materials={len(rod.data.materials)}")
    if fx:
        export(fx, os.path.join(PROPS, f"{ff}.glb"), fxx)
        print(f"MODEL props/{ff} tris={sum(tri_count(o) for o in fx if o.type == 'MESH')}")
