"""Rods rebuilt part by part to their approved concepts (rod-rebuild-b, 2026-11-20): the Glass, the Lighthouse, the
Precision and the Carrot, each from art/pipeline/concepts/old/<rod>/ (hero.png, turnaround.png, effects.png), the way
the Christmas rods were (build_rods.py north_star, candy_cane): stations measured off the turnaround's side view (0 at
the butt, 1 at the tip), every part placed and sized from them.

  Blender -b --factory-startup -P art/pipeline/build_rods_b.py -- [only glass,lighthouse]

Writes web/public/assets/game/tools/rod-<name>.glb and, for the Glass and the Lighthouse, their effects
web/public/assets/game/props/rodfx-<name>.glb. build_rods.py's conventions (rig units, the grip's hand at the origin,
Blender Z up the rod, the reel hanging toward -Y, the camera side of the sheet's side view -X); its helpers are loaded
from its source up to its build section (importing it would rebuild every rod).
"""
import bpy, math, os, sys, types
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
_path = os.path.join(HERE, "build_rods.py")
_src = open(_path).read()
br = types.ModuleType("build_rods")
br.__file__ = _path
exec(compile(_src[:_src.index("# ================================================================ build\n")], _path, "exec"), br.__dict__)
kit, lathe, loft, leaf, star_flat, fx_empty = br.kit, br.lathe, br.loft, br.leaf, br.star_flat, br.fx_empty
model, glow, light, fx_part, particles, export, tris = br.model, br.glow, br.light, br.fx_part, br.particles, br.export, br.tris
TOOLS, PROPS, TAU, V = br.TOOLS, br.PROPS, br.TAU, br.V
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TEX = os.path.join(os.environ.get("ROD_TEX", "/private/tmp/claude-501/rod-rebuild-b-tex"))
os.makedirs(TEX, exist_ok=True)


# ================================================================ shared pieces
def ring(pc, z0, z1, r0, r1=None, sides=8, mat=None, cap=False, at=(0, 0)):
    """A short band round the axis (at x, y) from z0 to z1."""
    if mat:
        pc.mat = mat
    loft(pc, [(at[0], at[1], z0), (at[0], at[1], z1)], [r0, r0 if r1 is None else r1], sides=sides, tip=False, cap=cap)


def profile(pc, zs, rs, sides=8, mat=None, cap=(False, False), phase=0.0, face=None):
    """A turned part up the axis through stations zs, radii rs; `mat(i)` the material of segment i, or `face(i, k)` of
    each face (a facet's tint, a stripe)."""
    keep = pc.mat
    rings = [[pc.v((math.cos(phase + TAU * k / sides) * r, math.sin(phase + TAU * k / sides) * r, z)) for k in range(sides)]
             for z, r in zip(zs, rs)]
    for i in range(len(zs) - 1):
        pc.mat = mat(i) if callable(mat) else (mat or keep)
        for k in range(sides):
            if face:
                pc.mat = face(i, k)
            pc.f([rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]], (0, 0, (zs[i] + zs[i + 1]) / 2))
    for end, row, z, inward in ((cap[0], rings[0], zs[0], 1), (cap[1], rings[-1], zs[-1], -1)):
        if end:
            pc.mat = mat(0 if inward > 0 else len(zs) - 2) if callable(mat) else (mat or keep)
            c = pc.v((0, 0, z))
            for k in range(sides):
                pc.f([row[k], row[(k + 1) % sides], c], (0, 0, z + inward * 0.01))
    pc.mat = keep
    return rings


def uvtube(pc, zs, rs, sides, uv, phase=0.0):
    """A tube up the axis through zs (radii rs) whose corners take uv(station, side) (side runs 0..sides, so the seam's
    far edge is u 1). Side k sits at angle phase + TAU k / sides from +X toward +Y: 0.5 is -X, 0.75 is -Y."""
    rings = [[pc.v((math.cos(phase + TAU * k / sides) * r, math.sin(phase + TAU * k / sides) * r, z)) for k in range(sides)]
             for z, r in zip(zs, rs)]
    for i in range(len(zs) - 1):
        for k in range(sides):
            j = k + 1
            pc.f([rings[i][k], rings[i][j % sides], rings[i + 1][j % sides], rings[i + 1][k]], (0, 0, (zs[i] + zs[i + 1]) / 2),
                 uv=[uv(i, k), uv(i, j), uv(i + 1, j), uv(i + 1, k)])
    return rings


def tube_on(pc, c, d, length, r, sides=8, mat=None, cap=True):
    """A short cylinder from c along d (a reel's drum, a stem)."""
    if mat:
        pc.mat = mat
    c, d = V(c), V(d).normalized()
    loft(pc, [c, c + d * length], [r, r], sides=sides, tip=False, cap=cap, ref=(0, 0, 1) if abs(d.z) < 0.9 else (1, 0, 0))


def disc(pc, c, n, r, sides=10, mat=None):
    """A flat round face at c facing n."""
    if mat:
        pc.mat = mat
    c, n = V(c), V(n).normalized()
    u = n.cross(V((0, 0, 1)) if abs(n.z) < 0.9 else V((1, 0, 0))).normalized()
    w = n.cross(u)
    rim = [pc.v(c + (u * math.cos(TAU * k / sides) + w * math.sin(TAU * k / sides)) * r) for k in range(sides)]
    mid = pc.v(c)
    for k in range(sides):
        pc.f([rim[k], rim[(k + 1) % sides], mid], c - n)


def torus(pc, c, n, R, r, segs=12, sides=4, mat=None, a0=0.0, a1=TAU):
    """A ring (or an arc of one, a0 to a1) of radius R round c in the plane facing n, its section r."""
    if mat:
        pc.mat = mat
    c, n = V(c), V(n).normalized()
    u = n.cross(V((0, 0, 1)) if abs(n.z) < 0.9 else V((1, 0, 0))).normalized()
    w = n.cross(u)
    closed = abs(a1 - a0 - TAU) < 1e-6
    k = segs if closed else segs + 1
    pts = [c + (u * math.cos(a0 + (a1 - a0) * i / segs) + w * math.sin(a0 + (a1 - a0) * i / segs)) * R for i in range(k)]
    pc.tube(pts, [r] * k, sides=sides, closed_loop=closed, tip=False, cap=not closed)


def vane(pc, base, a, r0, lean, length, width, thick, lobes=(0.5, 1.0, 0.8, 0.3)):
    """A crystal leaf standing out of the axis at angle `a` (degrees from +X toward +Y), from radius r0 at `base`, leaning
    `lean` degrees out from the axis toward the tip: a vane, broad in the plane of the axis and its own direction."""
    rad = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
    d = rad * math.sin(math.radians(lean)) + V((0, 0, 1)) * math.cos(math.radians(lean))
    leaf(pc, V(base) + rad * r0, d, length, width, side=rad.cross(V((0, 0, 1))), curl=0.0, lobes=lobes, thick=thick, sides=3)


def texmat(mat_name, img):
    m = bpy.data.materials[mat_name]
    node = m.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = img
    m.node_tree.links.new(node.outputs["Color"], next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"])


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def teximage(name, w, h, paint):
    """A small packed texture: paint(u, v) -> an [h, w, 3] array of sRGB colours (u across, v up, both 0..1)."""
    u, v = np.meshgrid((np.arange(w) + 0.5) / w, 1.0 - (np.arange(h) + 0.5) / h)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = paint(u, v)
    return kit.image(name, rgba, path=os.path.join(TEX, f"{name}.png"))




def recolor(ob, palette, virtual):
    """More colours than materials (the Tool budget's 5): each face of a virtual part (`virtual` {name: real part}) moves
    to its real part's material and its corners' COLOR_0 (which multiplies the base colour in the game) is scaled so it
    draws in the virtual part's own colour from `palette`. The real part's colour must be the lighter."""
    me = ob.data
    names = [m.name for m in me.materials]
    col = me.color_attributes["Color"]
    for vname, real in virtual.items():
        vn, rn = f"{ob.name}_{vname}", f"{ob.name}_{real}"
        if vn not in names:
            continue
        if rn not in names:
            me.materials.append(bpy.data.materials[rn])
            names.append(rn)
        vi, ri = names.index(vn), names.index(rn)
        k = [min(1.0, t / max(b, 1e-6)) for t, b in zip(kit.lin(palette[vname]), kit.lin(palette[real]))]
        for p in me.polygons:
            if p.material_index == vi:
                p.material_index = ri
                for li in p.loop_indices:
                    c = col.data[li].color
                    col.data[li].color = (c[0] * k[0], c[1] * k[1], c[2] * k[2], 1.0)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.material_slot_remove_unused()


def gradient(ob, palette, vname, real, light, dark, t_of):
    """The faces of virtual part `vname` onto `real`'s material, each corner's COLOR_0 shaded from `light` (t 0) to
    `dark` (t 1) by t_of(its position), relative to the real part's colour (the lighter)."""
    me = ob.data
    names = [m.name for m in me.materials]
    vn, rn = f"{ob.name}_{vname}", f"{ob.name}_{real}"
    if vn not in names:
        return
    if rn not in names:
        me.materials.append(bpy.data.materials[rn])
        names.append(rn)
    vi, ri = names.index(vn), names.index(rn)
    base = kit.lin(palette[real])
    lo, hi = kit.lin(light), kit.lin(dark)
    col = me.color_attributes["Color"]
    for p in me.polygons:
        if p.material_index != vi:
            continue
        p.material_index = ri
        for li in p.loop_indices:
            t = min(1.0, max(0.0, t_of(me.vertices[me.loops[li].vertex_index].co)))
            c = col.data[li].color
            k = [min(1.0, (a + (b - a) * t) / max(bb, 1e-6)) for a, b, bb in zip(lo, hi, base)]
            col.data[li].color = (c[0] * k[0], c[1] * k[1], c[2] * k[2], 1.0)


def shard(pc, base, d, length, r, flat=0.55, sides=4, out=None, face=None):
    """A crystal shard from `base` along `d`: widest a third of the way, to a point; flattened across `out` (broad in the
    plane of `d` and `out`)."""
    d = V(d).normalized()
    ref = V(out) if out is not None else (V((1, 0, 0)) if abs(d.x) < 0.9 else V((0, 1, 0)))
    loft(pc, [V(base), V(base) + d * length * 0.33, V(base) + d * length * 0.92], [(r * 0.45, r * 0.45 * flat), (r, r * flat), (r * 0.08, r * 0.08 * flat)],
         sides=sides, tip=True, cap=True, ref=tuple(ref), mat=face)


def strokes_field(X, Y, lines):
    """For texture painting: the signed distance (metres) from each pixel to the nearest of `lines`, each a list of
    points (x, y) and a width per point: negative inside a stroke."""
    best = np.full(X.shape, 1.0)
    P = np.stack([X.ravel(), Y.ravel()], 1)
    for pts, ws in lines:
        A, B = np.array(pts[:-1]), np.array(pts[1:])
        wa, wb = np.array(ws[:-1]), np.array(ws[1:])
        AB = B - A
        t = np.clip(((P[:, None, :] - A[None]) * AB[None]).sum(2) / np.maximum((AB * AB).sum(1), 1e-12)[None], 0, 1)
        Q = A[None] + t[..., None] * AB[None]
        dist = np.sqrt(((P[:, None, :] - Q) ** 2).sum(2)) - (wa[None] + (wb - wa)[None] * t)
        best = np.minimum(best, dist.min(1).reshape(X.shape))
    return best


# ================================================================ the Glass (rare)
def glass():
    """Rare, the sea-glass rod (concepts/old/glass): a faceted hexagonal teal gem for the end cap, two gold rings, a
    cream pearl grip inlaid with a teal swirl edged in gold, a gold collar and a gold crown with crystal shards flaring
    from it, a milky glass float in a knotted rope net hanging from it on a gold stem with a teal collar, its tassel and
    two crystal drops; a blank of two smooth crystal strands (teal and pale) twisted round each other, two gold bands
    inlaid in teal, and at the tip a gold scroll curling back under, a cluster of crystal shards and a long faceted
    crystal point. The effect: gold glints along the blank, crystal flecks and a twist of light turning round it, and a
    teal glow at the point."""
    T, H = 1.0, 0.11
    F = lambda f: (f - H) * T
    Rd = lambda d: d * T / 2
    DIA = [(0.232, 0.058), (0.40, 0.053), (0.60, 0.045), (0.80, 0.034), (0.90, 0.026)]    # round 3: twice as thick (coordinator)

    def dia(f):
        for (fa, da), (fb, db) in zip(DIA, DIA[1:]):
            if f <= fb:
                return da + (db - da) * (max(f, fa) - fa) / (fb - fa)
        return DIA[-1][1]
    FR = 0.047
    FLOAT = V((0, -0.04 - FR, F(0.197)))
    PAL = {"Crystal": "#D2F5F0", "Pale": "#F0FBF9", "Pearl": "#FFFFFF", "Gold": "#D8B46A", "Float": "#D4EFE9",
           "Teal": "#45C0B3", "Deep": "#2A9C90", "Aqua": "#C6EEE8", "Rope": "#C9AC72"}
    VIRT = {"Teal": "Crystal", "Deep": "Crystal", "Aqua": "Pale", "Rope": "Gold"}
    PAL.update({"StrandA": "#3DB8AB", "StrandB": "#C8EEE8"})
    GC, GL = 0.094 * 1.05, 0.135              # the grip's round and length, metres

    def swirl(u, v):                             # the grip's inlay: a teal wave with curls off it, edged in gold
        X, Y = u * GC, v * GL
        lines = []
        for cx in (0.5 * GC, 0.0, GC):
            ys = [0.012 + 0.112 * i / 24 for i in range(25)]
            pts = [(cx + 0.006 * math.sin(y / GL * TAU * 1.2 + 0.5), y) for y in ys]
            ws = [0.0008 + 0.0042 * math.sin(math.pi * (y - 0.012) / 0.112) ** 0.7 for y in ys]
            lines.append((pts, ws))
            for y0, side, R0, turns in ((0.038, 1, 0.0078, 1.5), (0.074, -1, 0.0082, 1.5), (0.108, 1, 0.006, 1.3)):
                x0 = cx + 0.006 * math.sin(y0 / GL * TAU * 1.2 + 0.5)
                c = (x0 + side * 0.0105, y0 + 0.004)
                sp, sw = [(x0, y0)], [0.0022]
                for i in range(1, 22):
                    t = i / 21
                    a = math.atan2(y0 - c[1], x0 - c[0]) + side * TAU * turns * t
                    rr = R0 * (1 - 0.82 * t)
                    sp.append((c[0] + math.cos(a) * rr, c[1] + math.sin(a) * rr))
                    sw.append(0.0021 * (1 - 0.5 * t))
                lines.append((sp, sw))
        d = strokes_field(X, Y, lines)
        col = np.broadcast_to(hexrgb("#F1EBDF"), u.shape + (3,)).copy()
        col[d < 0.0011] = hexrgb("#C9A35A")
        col[d < 0.0] = hexrgb("#2FA99D")
        col[(d < -0.0016)] = hexrgb("#55C4B8")
        return col
    grip_tex = teximage("glass-grip", 192, 256, swirl)

    def b(pc):
        pc.mat = "Teal"                          # the end cap: a faceted hexagonal gem, its end a flat table
        profile(pc, [F(-0.034), F(-0.025), F(-0.006), F(0.0)], [0.012, Rd(0.052), Rd(0.054), Rd(0.046)], sides=6, cap=(True, False),
                phase=math.pi / 6, face=lambda i, k: ("Crystal", "Teal", "Deep")[(i + k) % 3] if i < 2 else "Deep")
        pc.mat = "Gold"                          # two gold rings, a step between
        profile(pc, [F(0.0), F(0.002), F(0.008), F(0.011), F(0.013), F(0.019), F(0.021)],
                [Rd(0.045), Rd(0.051), Rd(0.051), Rd(0.046), Rd(0.051), Rd(0.051), Rd(0.045)], sides=10)
        pc.mat = "Pearl"                         # the grip, inlaid (its texture)
        gf = [0.021, 0.05, 0.1, 0.15, 0.172, 0.186]
        gd = [0.046, 0.048, 0.046, 0.042, 0.043, 0.046]
        uvtube(pc, [F(f) for f in gf], [Rd(d) for d in gd], 8, lambda i, k: (k / 8, (gf[i] - gf[0]) / (gf[-1] - gf[0])))
        pc.mat = "Gold"                          # the collar, bevelled, and the crown flaring from it toward the tip
        profile(pc, [F(0.186), F(0.188), F(0.196), F(0.199), F(0.212), F(0.226), F(0.236)],
                [Rd(0.046), Rd(0.053), Rd(0.053), Rd(0.044), Rd(0.05), Rd(0.064), Rd(0.052)], sides=10)
        for a, lean, ln, r, m in ((90, 30, 0.09, 0.015, "Teal"), (90, 11, 0.07, 0.011, "Aqua"), (38, 44, 0.06, 0.011, "Aqua"),
                                  (142, 44, 0.06, 0.011, "Crystal"), (270, 40, 0.044, 0.009, "Teal")):
            rad = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
            d = rad * math.sin(math.radians(lean)) + V((0, 0, 1)) * math.cos(math.radians(lean))
            pc.mat = m                           # the crown's crystal shards
            shard(pc, V((0, 0, F(0.216))) + rad * Rd(0.044), d, ln * T, r * T, flat=0.45, out=rad,
                  face=lambda i, k, m=m: "Crystal" if (k == 0 and m != "Crystal") else m)
        pc.mat = "Gold"                          # its gold leaves, laid along the crown on either side
        for a in (180, 0):
            rad = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
            leaf(pc, V((0, 0, F(0.205))) + rad * Rd(0.05), (V((0, 0, 1)) + rad * 0.2 + V((0, 0.4, 0))).normalized(), 0.05, 0.011,
                 side=rad, curl=0.005, lobes=(0.6, 1.0, 0.75, 0.3), thick=0.0025, sides=3)
        pc.mat = "Gold"                          # the float's stem, a teal collar at its foot
        tube_on(pc, (0, -0.02, F(0.197)), (0, -1, 0), 0.014, 0.0055, sides=6, cap=False)
        tube_on(pc, (0, -0.031, F(0.197)), (0, -1, 0), 0.009, 0.0115, sides=8, mat="Teal")
        pc.mat = "Float"                         # the glass float
        pc.blob(FLOAT, FR, segs=9, rings=6)

        def on(th, ph, r=FR + 0.0014):
            return FLOAT + V((0, math.cos(th), 0)) * r + V((math.cos(ph), 0, math.sin(ph))) * math.sin(th) * r
        pc.mat = "Rope"                          # its net: five cords wound each way, knotted where they cross, a cord round its neck
        for s in (1, -1):
            for j in range(6):
                pts = [on(math.radians(24 + 136 * i / 4), TAU * j / 6 + s * 1.05 * i / 4) for i in range(5)]
                pc.tube(pts, [0.0024] * 5, sides=3, tip=False, cap=False)
        torus(pc, FLOAT + V((0, math.cos(math.radians(24)) * FR, 0)), (0, 1, 0), math.sin(math.radians(24)) * FR + 0.0012, 0.0026, segs=8, sides=3)
        knot = FLOAT - V((0, FR + 0.006, 0))     # the tassel and its two crystal drops
        pc.blob(knot, 0.008, segs=6, rings=3)
        loft(pc, [knot - V((0, 0.005, 0)), knot - V((0, 0.016, 0)), knot - V((0, 0.034, 0))], [0.0045, 0.0068, 0.0098], sides=6, tip=False,
             cap=True, ref=(0, 0, 1))
        for off, ln in ((V((0, -0.026, -0.022)), 0.028), (V((0, -0.044, 0.003)), 0.03)):
            p = knot + off
            pc.mat = "Rope"
            pc.tube([knot, p], [0.0011, 0.0011], sides=3, tip=False, cap=False)
            dd = off.normalized()
            pc.mat = "Teal"
            shard(pc, p, dd, ln, 0.0075, flat=1.0, sides=4, face=lambda i, k: "Crystal" if k % 2 else "Teal")
        # the blank: two smooth crystal strands twisted round each other, four turns, each a faceted oval in section
        z0, z1, TURNS, PER = 0.228, 0.895, 3.25, 6
        N = int(TURNS * 2 * PER) + 1
        for strand in (0, 1):
            rings = []
            for i in range(N):
                u = i / (N - 1)
                f = z0 + (z1 - z0) * u
                rr = Rd(dia(f))
                ph = math.pi * strand + TAU * TURNS * u
                rad, tan = V((math.cos(ph), math.sin(ph), 0)), V((-math.sin(ph), math.cos(ph), 0))
                c = V((0, 0, F(f))) + rad * rr * 0.42
                rings.append([c + rad * math.cos(TAU * k / 5) * rr * 0.58 + tan * math.sin(TAU * k / 5) * rr * 0.8 for k in range(5)])
            pc.mat = "Teal"
            pc.band(rings, caps=(V((0, 0, F(z0) - 0.004)), V((0, 0, F(z1) + 0.004))),
                    mat=lambda i, k, m=("StrandA", "StrandB")[strand]: m)
        for fa, fb in ((0.424, 0.448), (0.658, 0.68)):          # the two gold bands, inlaid in teal
            r = Rd(dia((fa + fb) / 2))
            zz = [F(fa), F(fa) + 0.0065, F(fb) - 0.0065, F(fb)]
            profile(pc, zz, [r * 1.14, r * 1.14, r * 1.14, r * 1.14], sides=12, face=lambda i, k: ("Teal" if k % 2 else "Gold") if i == 1 else "Gold")
        pc.mat = "Gold"                          # the tip: a gold collar, a scroll sweeping back under the blank into a curl
        profile(pc, [F(0.884), F(0.889), F(0.903), F(0.91)], [Rd(0.026), Rd(0.034), Rd(0.034), Rd(0.02)], sides=10)
        C = V((0, -0.04, F(0.862)))
        pts = [V((0, -0.014, F(0.9))), V((0, -0.025, F(0.887))), V((0, -0.032, F(0.876)))]
        for i in range(12):
            a = math.radians(-10 + 420 * i / 11)
            R = 0.018 - 0.013 * i / 11
            pts.append(C + V((0, math.cos(a) * R, -math.sin(a) * R)))
        pc.tube(pts, [0.005 - 0.003 * i / (len(pts) - 1) for i in range(len(pts))], sides=4, tip=True, cap=True)
        C2 = V((0, -0.025, F(0.927)))            # and a small curl forward under the point
        pts = [V((0, -0.014, F(0.906)))] + [C2 + V((0, math.cos(math.radians(160 - 300 * i / 6)) * 0.008 * (1 - 0.55 * i / 6),
                                                    math.sin(math.radians(160 - 300 * i / 6)) * 0.008 * (1 - 0.55 * i / 6))) for i in range(7)]
        pc.tube(pts, [0.003] * len(pts), sides=3, tip=True, cap=True)
        for a, lean, ln, r, m in ((90, 18, 0.08, 0.012, "Aqua"), (90, 38, 0.062, 0.011, "Teal"), (60, 56, 0.052, 0.009, "Aqua"),
                                  (120, 56, 0.052, 0.009, "Teal"), (165, 38, 0.045, 0.008, "Crystal"),
                                  (270, 16, 0.068, 0.01, "Aqua")):
            rad = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
            d = rad * math.sin(math.radians(lean)) + V((0, 0, 1)) * math.cos(math.radians(lean))
            pc.mat = m                           # the tip's cluster of crystal shards
            shard(pc, V((0, 0, F(0.903))) + rad * Rd(0.024), d, ln * T, r * T, flat=0.5, out=rad,
                  face=lambda i, k, m=m: "Crystal" if (k == 0 and m != "Crystal") else m)
        pc.mat = "Teal"                          # the point: a long faceted crystal, flat a little across
        loft(pc, [(0, 0, F(0.905)), (0, 0, F(0.952)), (0, 0, F(0.995))], [(0.008, 0.006), (Rd(0.05), Rd(0.036)), (0.003, 0.002)],
             sides=6, tip=True, cap=True, ref=(0, 1, 0), mat=lambda i, k: ("Crystal", "Teal", "Deep", "Teal", "Crystal", "Aqua")[k])
        pc.mat = "Aqua"                          # the line, from the float to the tip
        pc.tube([FLOAT + V((0, 0.008, FR * 0.96)), V((0, -0.014, F(0.93)))], [0.0011, 0.0011], sides=3, tip=False, cap=False)
    rod = model("rod-glass", PAL, b)
    # the strands: each shaded from light on its lit side (up and toward the camera side) to its own teal below
    for vname, real, light_, dark_ in (("StrandA", "Crystal", "#A6E8DF", "#1E9C8F"), ("StrandB", "Pale", "#E4F7F4", "#74CBBF")):
        gradient(rod, PAL, vname, real, light_, dark_,
                 lambda p: 0.62 - 0.6 * (p.y - p.x * 0.6) / (1.1 * Rd(dia((p.z / T) + H))))
    recolor(rod, PAL, VIRT)
    for m in rod.data.materials:                 # the crystal parts see-through a little (glTF alpha blend)
        if m.name.endswith(("_Crystal", "_Pale")):
            next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Alpha"].default_value = 0.84
            m.surface_render_method = "BLENDED"
    texmat("rod-glass_Pearl", grip_tex)

    def glints(pc):                              # four-point gold glints along the blank, each two crossed stars
        pc.mat = "Glow"
        for f, up, r in ((0.31, 0.03, 0.02), (0.525, 0.027, 0.024), (0.735, 0.023, 0.019), (0.955, 0.04, 0.016)):
            c = V((0, up, F(f)))
            star_flat(pc, c, r, r * 0.15, 4, 0.0)
            star_flat(pc, c, r, r * 0.15, 4, 0.0, rot=Matrix.Rotation(math.radians(90), 3, "Z"))

    def flecks(pc):                              # crystal flecks round the blank, turning with the light
        pc.mat = "Light"
        for i in range(10):
            f = 0.26 + 0.7 * i / 9
            a = 2.4 * i
            rad = V((math.cos(a), math.sin(a), 0))
            c = V((0, 0, F(f))) + rad * (Rd(dia(min(f, 0.9))) + 0.016 + 0.006 * (i % 3))
            d = V((0, 0, 1)) * 0.01
            t = rad.cross(V((0, 0, 1))) * 0.0026
            pc.f([pc.v(c - d), pc.v(c + rad * 0.0026), pc.v(c + d), pc.v(c - rad * 0.0026)], c - rad)
            pc.f([pc.v(c - d), pc.v(c + t), pc.v(c + d), pc.v(c - t)], c + V((0, 0, 0.001)))

    def twist(pc):                               # a ribbon of light wound twice round the blank
        pc.mat = "Light"
        n, row = 33, []
        for i in range(n):
            u = i / (n - 1)
            f = 0.25 + 0.66 * u
            a = TAU * 2.0 * u
            rad = V((math.cos(a), math.sin(a), 0))
            c = V((0, 0, F(f))) + rad * (Rd(dia(f)) + 0.003)
            row.append((pc.v(c - V((0, 0, 0.004))), pc.v(c + V((0, 0, 0.004)))))
        for (a0, a1), (b0, b1) in zip(row, row[1:]):
            pc.f([a0, b0, b1, a1], V((0, 0, a0.co.z)))
    fx = [glow("Glints", "#FFF1CF", glints, flicker=0.55),
          light("Flecks", "#6FC9BD", flecks, spin=0.9),
          light("Twist", "#4FA89C", twist, spin=-1.4),
          fx_empty("Halo", (0, 0, F(0.95)), size=0.11, color="#8FF0E0"),
          fx_empty("FX_Tip", (0, 0, F(0.95))),
          fx_empty("FX_Grip", (0, 0, 0))]
    return rod, fx, {"rodFx": "glass"}, particles("#FFF2CC", sprite="sparkle", every=0.4, size=0.035, rise=0.12)


# ================================================================ the Lighthouse (rare)
def lighthouse():
    """Rare, the lighthouse rod (concepts/old/lighthouse): a gold end cap, a dark wood grip, a stepped gold collar, a
    brass porthole reel (a riveted bezel round a glass window over the wound line, hinge lugs, a crank with a wood knob)
    on a gold bracket; a cream tower of a blank banded in red rimmed with gold, an arched lit window with its glazing
    bars in each cream stretch, a neck flaring to a gold collar, and the lantern room at the tip standing in line with
    the rod (David: "the lantern at the tip must stand straight, in line with the rod"): a gallery with a gold railing
    and an eye for the line, glazing between gold mullions, a red roof and a gold ball. The effect: the lamp alight and
    a beam of light out along the rod's line, breathing."""
    T, H = 1.0, 0.09
    F = lambda f: (f - H) * T
    Rd = lambda d: d * T / 2
    KT, KG, KL, KR = 1.6, 1.5, 1.4, 1.45         # round 3 (coordinator): the tower, the grip, the lantern and the reel scaled up
    R = lambda f: Rd((0.0345 - 0.0025 * (f - 0.195) / 0.7) * KT)      # the tower, barely tapering
    BANDS = [(0.25, 0.30), (0.389, 0.439), (0.533, 0.583), (0.672, 0.722), (0.813, 0.863)]   # the concept's wide red bands
    WINDOWS = [0.222, 0.345, 0.487, 0.627, 0.767, 0.884]
    G0 = F(0.952)                                # the gallery's floor; the lantern stands on it, up the rod's axis
    LAMP = V((0, 0, G0 + 0.026 * KL))
    RC = V((0, -0.062 * KR - 0.006, F(0.212)))   # the reel's hub
    PAL = {"Cream": "#F6EEDF", "Red": "#D0383E", "Gold": "#D6A445", "Wood": "#6A3C2C", "Lamp": "#F7B548",
           "Grain": "#4E2A1E", "RedDark": "#A82A31", "Brass": "#A47428", "Glass": "#8EA5B3", "Pane": "#DCE4E4", "LineShade": "#DCD4C3",
           "Amber": "#E48A2C"}
    VIRT = {"Grain": "Wood", "RedDark": "Red", "Brass": "Gold", "Glass": "Cream", "Pane": "Cream", "LineShade": "Cream", "Amber": "Lamp"}
    g = lambda d: Rd(d * KG)                     # grip-end radii
    L = lambda x: x * KL                         # lantern sizes
    Q = lambda x: x * KR                         # reel sizes

    def b(pc):
        pc.mat = "Gold"                          # the end cap
        profile(pc, [F(0.0), F(0.004), F(0.02), F(0.024)], [g(0.03), g(0.043), g(0.043), g(0.039)], sides=12, cap=(True, False))
        pc.mat = "Wood"                          # the grip, its grain in darker streaks
        profile(pc, [F(0.024), F(0.06), F(0.12), F(0.163)], [g(0.039), g(0.042), g(0.041), g(0.038)], sides=12,
                face=lambda i, k: "Grain" if k % 4 == 1 else "Wood")
        pc.mat = "Gold"                          # the collar: a wide ring and a narrow one
        profile(pc, [F(0.163), F(0.166), F(0.178), F(0.18), F(0.192), F(0.195)],
                [g(0.038), g(0.048), g(0.048), g(0.041), g(0.041), R(0.195)], sides=12)
        zs, rs, ms = [F(0.195)], [R(0.195)], []  # the tower: cream, banded red, each band rimmed in gold
        for fa, fb in BANDS:
            for f, r, m in ((fa, R(fa), "Cream"), (fa + 0.005, R(fa) * 1.06, "Gold"), (fb - 0.005, R(fb) * 1.06, "Red"), (fb, R(fb), "Gold")):
                zs.append(F(f)); rs.append(r); ms.append(m)
        NECK = Rd(0.031 * KT)
        for f, r in ((0.895, R(0.895)), (0.905, NECK), (0.918, Rd(0.028 * KT)), (0.932, Rd(0.035 * KT)), (0.944, Rd(0.05 * KL))):
            zs.append(F(f)); rs.append(r); ms.append("Cream")
        profile(pc, zs, rs, sides=12, face=lambda i, k: ("RedDark" if k % 3 == 2 else "Red") if ms[i] == "Red" else ms[i])
        pc.mat = "Gold"                          # the gold collar under the gallery
        profile(pc, [F(0.944), F(0.946), G0], [Rd(0.05 * KL), Rd(0.056 * KL), Rd(0.056 * KL)], sides=12)
        for f in WINDOWS:                        # the windows: an arch of lit glass in a gold frame with its bars, on the camera side and on top
            r = R(f) if f < 0.895 else NECK
            for side in (V((-1, 0, 0)), V((0, 1, 0))):
                up = V((0, 1, 0)) if side.x else V((1, 0, 0))

                def at(zx, uy, lift):            # zx along the rod, uy round it, in the window's own units
                    ang = uy * 0.0075 * 1.35 / r
                    return side * math.cos(ang) * (r + lift) + up * math.sin(ang) * (r + lift) + V((0, 0, F(f) + zx * 0.0058 * 1.35))
                arch = [(-1, -1), (1, -1), (1, 0.25)] + [(math.cos(math.pi * i / 4), 0.25 + 0.75 * math.sin(math.pi * i / 4)) for i in range(1, 4)] + [(-1, 0.25)]
                pc.mat = "Gold"
                pc.f([pc.v(at(x * 1.32, y * 1.25 + (0.0 if y > 0 else -0.08), 0.0008)) for x, y in arch], V((0, 0, F(f))))
                pc.mat = "Amber"
                pc.f([pc.v(at(x, y, 0.0014)) for x, y in arch], V((0, 0, F(f))))
                pc.mat = "Gold"                  # the glazing bars: one down the middle, one across
                pc.f([pc.v(at(-0.12, -1, 0.0019)), pc.v(at(0.12, -1, 0.0019)), pc.v(at(0.12, 1, 0.0019)), pc.v(at(-0.12, 1, 0.0019))], V((0, 0, F(f))))
                pc.f([pc.v(at(-1, 0.05, 0.0019)), pc.v(at(1, 0.05, 0.0019)), pc.v(at(1, 0.22, 0.0019)), pc.v(at(-1, 0.22, 0.0019))], V((0, 0, F(f))))
        pc.mat = "Gold"                          # the gallery: a floor, a railing on posts, an eye for the line
        profile(pc, [G0 - L(0.002), G0, G0 + L(0.005)], [L(0.03), L(0.041), L(0.041)], sides=16, cap=(False, True))
        for zr, rr in ((G0 + L(0.019), 0.0021), (G0 + L(0.012), 0.0014)):
            torus(pc, (0, 0, zr), (0, 0, 1), L(0.04), rr, segs=16, sides=3)
        for k in range(12):
            a = TAU * k / 12 + TAU / 24
            pc.tube([(math.cos(a) * L(0.04), math.sin(a) * L(0.04), G0 + L(0.005)), (math.cos(a) * L(0.04), math.sin(a) * L(0.04), G0 + L(0.019))],
                    [0.0016, 0.0016], sides=3, tip=False, cap=False)
        torus(pc, (0, -L(0.047), G0 + 0.0), (1, 0, 0), L(0.0058), 0.0022, segs=8, sides=3)
        pc.mat = "Pane"                          # the lantern room: pale glazing between gold rings and mullions
        profile(pc, [G0 + L(0.005), G0 + L(0.046)], [L(0.0285), L(0.0285)], sides=8, phase=TAU / 16)
        pc.mat = "Gold"
        for z0 in (G0 + L(0.005), G0 + L(0.042)):
            profile(pc, [z0, z0 + L(0.004)], [L(0.031), L(0.031)], sides=8, phase=TAU / 16)
        for k in range(8):
            a = TAU * k / 8 + TAU / 16
            pc.tube([(math.cos(a) * L(0.029), math.sin(a) * L(0.029), G0 + L(0.008)), (math.cos(a) * L(0.029), math.sin(a) * L(0.029), G0 + L(0.043))],
                    [0.0023, 0.0023], sides=3, tip=False, cap=False)
        pc.mat = "Gold"                          # the roof: a gold rim, a red cone, a gold ball
        profile(pc, [G0 + L(0.046), G0 + L(0.0495)], [L(0.04), L(0.04)], sides=8, cap=(True, False), phase=TAU / 16)
        profile(pc, [G0 + L(0.0495), G0 + L(0.077)], [L(0.04), L(0.005)], sides=8, phase=TAU / 16, face=lambda i, k: "RedDark" if k % 2 else "Red")
        pc.mat = "Gold"
        tube_on(pc, (0, 0, G0 + L(0.076)), (0, 0, 1), L(0.007), L(0.003), sides=6, cap=False)
        pc.blob((0, 0, G0 + L(0.09)), L(0.0085), segs=8, rings=5)
        # the reel: a brass drum, a riveted bezel, a glass window showing the wound line, hinge lugs, a crank
        lathe(pc, RC, [(0, Q(-0.012)), (Q(0.04), Q(-0.012)), (Q(0.0435), Q(-0.006)), (Q(0.0435), Q(0.006)), (Q(0.0415), Q(0.0095)), (Q(0.0425), Q(0.0135)),
                       (Q(0.038), Q(0.0165)), (Q(0.031), Q(0.015))], n=16, axis=(-1, 0, 0), mat=lambda band, q: "Brass" if band == 1 else "Gold")
        pc.mat = "Glass"
        lathe(pc, RC, [(Q(0.031), Q(0.015)), (Q(0.0175), Q(0.0175)), (Q(0.0165), Q(0.0168)), (Q(0.0115), Q(0.0172)), (Q(0.0105), Q(0.0168)),
                       (Q(0.006), Q(0.0168)), (0, Q(0.0182))], n=16, axis=(-1, 0, 0), mat=lambda band, q: ("Glass", "LineShade", "Cream", "LineShade", "Cream")[band])
        pc.mat = "Pane"                          # a glint on the glass
        pc.f([pc.v(RC + V((Q(-0.0185), Q(y), Q(z)))) for y, z in ((0.012, -0.018), (0.02, -0.008), (0.017, -0.006), (0.009, -0.016))], RC)
        for k in range(10):                      # the bezel's rivets
            a = TAU * k / 10 + 0.3
            c = RC + V((Q(-0.0162), math.cos(a) * Q(0.0365), math.sin(a) * Q(0.0365)))
            pc.mat = "Brass"
            loft(pc, [c, c + V((-0.0028, 0, 0))], [0.0025, 0.0005], sides=4, tip=False, cap=False, ref=(0, 1, 0))
        pc.mat = "Gold"
        for s in (1, -1):                        # the hinge lugs at its sides
            pc.blob(RC + V((Q(-0.004), 0, s * Q(0.045))), (Q(0.006), Q(0.0075), Q(0.0045)), segs=6, rings=3)
        pc.tube([(0, -R(0.19) * 0.6, F(0.185)), (0, RC.y * 0.45, F(0.19)), (0, RC.y + Q(0.04), RC.z - Q(0.008))], [0.0065, 0.0062, 0.007], sides=5, tip=False, cap=False)
        pc.tube([(0, -R(0.23) * 0.6, F(0.24)), (0, RC.y * 0.48, F(0.235)), (0, RC.y + Q(0.042), RC.z + Q(0.01))], [0.0052, 0.005, 0.0056], sides=5, tip=False, cap=False)
        hub = RC + V((Q(-0.021), 0, 0))          # the crank: a gold arm down toward the tip, a wood knob
        knob = hub + V((Q(-0.004), Q(-0.024), Q(0.03)))
        pc.blob(hub, Q(0.0058), segs=6, rings=4)
        pc.tube([hub, hub + V((Q(-0.002), Q(-0.012), Q(0.016))), knob], [Q(0.0042), Q(0.004), Q(0.0042)], sides=5, tip=False, cap=True)
        pc.mat = "Wood"
        d = V((-0.25, -0.35, 1)).normalized()
        loft(pc, [knob, knob + d * Q(0.007), knob + d * Q(0.019), knob + d * Q(0.027)], [Q(0.0048), Q(0.0078), Q(0.0072), Q(0.0035)], sides=8, tip=False, cap=True)
        pc.mat = "Cream"                         # the line, from the reel to the gallery's eye
        pc.tube([RC + V((0, Q(0.04), Q(0.014))), V((0, -L(0.047), G0 - 0.004))], [0.001, 0.001], sides=3, tip=False, cap=False)
    rod = model("rod-lighthouse", PAL, b)
    recolor(rod, PAL, VIRT)

    def beam(pc):                                # the beam: nested cones of light out from the lamp along the rod's line, brightest near it
        pc.mat = "Light"
        for length, ang in ((0.36, 14), (0.25, 9), (0.15, 5)):
            ring_ = [pc.v(LAMP + V((math.cos(TAU * k / 10) * length * math.tan(math.radians(ang)),
                                    math.sin(TAU * k / 10) * length * math.tan(math.radians(ang)), length))) for k in range(10)]
            apex = pc.v(LAMP + V((0, 0, L(0.02))))
            for k in range(10):
                pc.f([apex, ring_[k], ring_[(k + 1) % 10]], LAMP + V((0, 0, length)))

    def lamp(pc):
        pc.mat = "Glow"
        pc.blob(LAMP, (L(0.016), L(0.016), L(0.015)), segs=8, rings=5)
    fx = [light("Beam", "#8C6A34", beam, pivot=tuple(LAMP), pulse=0.06),
          glow("Lamp", "#FFD98A", lamp, pivot=tuple(LAMP), pulse=0.12),
          fx_empty("Halo", tuple(LAMP), size=0.17, color="#FFD58A"),
          fx_empty("FX_Lamp", tuple(LAMP)),
          fx_empty("FX_Grip", (0, 0, 0))]
    return rod, fx, {"rodFx": "lighthouse"}, particles("#FFE3A8", sprite="glow", every=0.5, size=0.028, rise=0.1)


# ================================================================ the Precision (common)
def precision():
    """Common, the sport rod (concepts/old/precision): a silver-white end cap and a thin gold ring, a black knurled grip,
    a thin gold ring and a silver reel seat, a slate-blue blank marked like a ruler down its side, three white ferrules,
    a gold guide ring standing on top near the tip and a small eye at it; a silver reel with a gold ring round its face,
    a gauge, a silver side crank and a black handle knob."""
    T, H = 0.95, 0.095
    F = lambda f: (f - H) * T
    Rd = lambda d: d * T / 2
    R = lambda f: Rd(0.0215 - 0.0105 * (f - 0.19) / 0.795)
    RC = V((0, -0.052, F(0.2)))
    PERIOD = 0.066                               # metres of blank per ten ruler marks
    BLUE = "#3F5E9A"
    PAL = {"Blank": "#FFFFFF", "Grip": "#FFFFFF", "Silver": "#ADB3BB", "Gold": "#CDA44C", "White": "#F4F4F0",
           "Steel": "#737983", "Black": "#16171A"}
    VIRT = {"Steel": "Silver", "Black": "Silver"}

    def ruler(u, v):                             # slate blue, the marks on the -X face (u .5 to .625) and the top face (u .25 to .375)
        col = np.broadcast_to(hexrgb(BLUE), u.shape + (3,)).copy()
        white = hexrgb("#EEF3FA")
        k = (v * 10) % 1.0
        long_ = (np.floor(v * 10) % 5) == 0
        for u0 in (0.5, 0.25):
            col[(u > u0 + 0.006) & (u < u0 + 0.016)] = white * 0.7 + hexrgb(BLUE) * 0.3      # the base line
            col[(k < 0.16) & (u > u0 + 0.006) & (u < u0 + np.where(long_, 0.1, 0.062))] = white
        return col

    def knurl(u, v):                             # the grip's knurling: a black diamond weave
        a, c = (u * 8) % 1.0, (v * 8) % 1.0
        d = np.minimum(np.abs((a + c) % 1.0 - 0.5), np.abs((a - c) % 1.0 - 0.5))
        out = np.broadcast_to(hexrgb("#151619"), u.shape + (3,)).copy()
        out[d > 0.34] = hexrgb("#08080A")
        out[d < 0.07] = hexrgb("#34363C")
        return out
    blank_tex, grip_tex = teximage("precision-ruler", 64, 128, ruler), teximage("precision-knurl", 32, 32, knurl)

    def b(pc):
        pc.mat = "Silver"                        # the end cap and its thin gold ring
        profile(pc, [F(0.0), F(0.004), F(0.02)], [Rd(0.022), Rd(0.032), Rd(0.032)], sides=12, cap=(True, False))
        pc.mat = "Gold"
        profile(pc, [F(0.02), F(0.0215), F(0.0285), F(0.03)], [Rd(0.031), Rd(0.0345), Rd(0.0345), Rd(0.032)], sides=12)
        pc.mat = "Grip"                          # the grip, knurled
        L = F(0.162) - F(0.03)
        uvtube(pc, [F(0.03), F(0.162)], [Rd(0.0325), Rd(0.0325)], 12, lambda i, k: (k / 12 * 3, i * L / (math.pi * Rd(0.0325) * 2) * 3))
        pc.mat = "Gold"                          # a thin gold ring, the silver seat with its hood
        profile(pc, [F(0.162), F(0.1635), F(0.17), F(0.1715)], [Rd(0.032), Rd(0.035), Rd(0.035), Rd(0.033)], sides=12)
        pc.mat = "Silver"
        profile(pc, [F(0.1715), F(0.18), F(0.188), F(0.193)], [Rd(0.034), Rd(0.034), Rd(0.031), R(0.193)], sides=12,
                face=lambda i, k: "Steel" if (i == 1 and k % 6 == 3) else "Silver")
        pc.mat = "Blank"                         # the blank, marked; the last stretch past the guide plain
        fs = [0.193, 0.3, 0.45, 0.6, 0.72, 0.84]
        uvtube(pc, [F(f) for f in fs], [R(f) for f in fs], 8, lambda i, k: (k / 8, (F(fs[i]) - F(fs[0])) / PERIOD), phase=-TAU / 16)
        ft = [0.84, 0.985]
        uvtube(pc, [F(f) for f in ft], [R(f) for f in ft], 8, lambda i, k: (k / 8 + 0.43, 0.05), phase=-TAU / 16)
        pc.mat = "White"                         # three white ferrules
        for f in (0.212, 0.473, 0.678):
            r = R(f) * 1.2
            profile(pc, [F(f) - 0.0065, F(f) - 0.0055, F(f) + 0.0055, F(f) + 0.0065], [R(f), r, r, R(f)], sides=12)
        pc.mat = "Gold"                          # the guide: a collar and a ring standing on top of the blank
        f = 0.855
        profile(pc, [F(f) - 0.006, F(f) - 0.005, F(f) + 0.005, F(f) + 0.006], [R(f), R(f) * 1.4, R(f) * 1.4, R(f)], sides=10)
        tube_on(pc, (0, R(f), F(f)), (0, 1, 0), 0.004, 0.0028, sides=6, cap=False)
        torus(pc, (0, R(f) + 0.0135, F(f)), (1, 0, 0), 0.0095, 0.0022, segs=12, sides=5)
        pc.mat = "Silver"                        # the tip's eye
        profile(pc, [F(0.976), F(0.988)], [R(0.976) * 1.3, R(0.988) * 1.1], sides=8, cap=(False, True))
        torus(pc, (0, -0.002, F(0.993)), (1, 0, 0), 0.0036, 0.0011, segs=8, sides=3)
        # the reel: a silver drum, a gold ring round its face, a gold hub, on a silver foot
        lathe(pc, RC, [(0, -0.012), (0.031, -0.012), (0.0345, -0.0075), (0.0345, 0.005), (0.0325, 0.0085), (0.03, 0.009), (0, 0.009)],
              n=16, axis=(-1, 0, 0), mat=lambda band, q: "Steel" if band == 0 else "Silver")
        pc.mat = "Gold"
        torus(pc, RC + V((-0.0094, 0, 0)), (1, 0, 0), 0.0215, 0.0019, segs=16, sides=4)
        pc.blob(RC + V((-0.01, 0, 0)), 0.0058, segs=8, rings=4)
        pc.mat = "Steel"                         # three screws on the face
        for k in range(3):
            a = TAU * k / 3 + 2.4
            disc(pc, RC + V((-0.0093, math.cos(a) * 0.0275, math.sin(a) * 0.0275)), (-1, 0, 0), 0.0014, sides=5)
        pc.mat = "Silver"
        pc.tube([(0, -Rd(0.031), F(0.178)), (0, -0.027, F(0.181)), (0, RC.y + 0.033, RC.z - 0.004)], [0.0045, 0.0045, 0.005], sides=5, tip=False, cap=False)
        pc.tube([(0, -Rd(0.031), F(0.19)), (0, RC.y + 0.034, RC.z + 0.006)], [0.0035, 0.004], sides=5, tip=False, cap=False)
        pc.mat = "White"                         # the gauge, up on the face toward the tip
        g = RC + V((-0.0098, 0.014, 0.013))
        disc(pc, g, (-1, 0, 0), 0.0072, sides=10)
        pc.mat = "Silver"
        torus(pc, g + V((0.0004, 0, 0)), (1, 0, 0), 0.0077, 0.0013, segs=10, sides=3)
        pc.mat = "Black"
        pc.f([pc.v(g + V((-0.0004, 0.0005, 0))), pc.v(g + V((-0.0004, -0.0005, 0))), pc.v(g + V((-0.0004, 0.0045, 0.0035)))], g + V((1, 0, 0)))
        hub = RC + V((-0.012, 0, 0))             # the crank: a silver arm out the side and down, a black handle knob
        knob = hub + V((-0.006, -0.024, 0.023))
        pc.mat = "Silver"
        pc.tube([hub, hub + V((-0.004, -0.008, 0.012)), knob], [0.0034, 0.003, 0.0034], sides=5, tip=False, cap=True)
        pc.blob(knob, 0.0042, segs=6, rings=3)
        pc.mat = "Black"
        d = V((-0.35, -0.4, 1)).normalized()
        loft(pc, [knob, knob + d * 0.004, knob + d * 0.02, knob + d * 0.024], [0.0045, 0.0068, 0.0068, 0.0048], sides=8, tip=False, cap=True)
        pc.mat = "White"                         # the line, from the reel to the eye
        pc.tube([RC + V((0, 0.033, 0.012)), V((0, -0.004, F(0.99)))], [0.0009, 0.0009], sides=3, tip=False, cap=False)
    rod = model("rod-precision", PAL, b)
    recolor(rod, PAL, VIRT)
    texmat("rod-precision_Blank", blank_tex)
    texmat("rod-precision_Grip", grip_tex)
    return rod, [], {}, {}


# ================================================================ the Carrot (uncommon)
def carrot():
    """Uncommon, the carrot rod (concepts/old/carrot): a lush spray of curling two-tone carrot tops for the butt, one
    curling under into a hook, a gold band, a slim cream grip bound with a green vine and its leaves, a cup of green
    sepals, a fat glossy carrot for a blank, ringed with grooves and three pale bands, tapering to a gold eye; a reel of
    wound line in a green clamp, its face a slice of carrot (a paler core, a sunburst), its crank a green stem with a
    leaf for a knob."""
    T, H = 0.95, 0.17
    F = lambda f: (f - H) * T
    Rd = lambda d: d * T / 2
    DIA = [(0.222, 0.034), (0.235, 0.048), (0.26, 0.056), (0.30, 0.0575), (0.36, 0.054), (0.41, 0.05), (0.46, 0.046), (0.52, 0.041),
           (0.57, 0.0365), (0.62, 0.032), (0.67, 0.028), (0.72, 0.0245), (0.77, 0.0205), (0.83, 0.0165), (0.88, 0.013),
           (0.93, 0.0098), (0.97, 0.0074), (0.982, 0.0058)]

    def R(f):
        for (fa, da), (fb, db) in zip(DIA, DIA[1:]):
            if f <= fb:
                return Rd(da + (db - da) * (max(f, fa) - fa) / (fb - fa))
        return Rd(DIA[-1][1])
    RC = V((0, -0.06, F(0.232)))
    BANDS = [(0.34, 0.357), (0.483, 0.495), (0.653, 0.667)]
    PAL = {"Carrot": "#FFB070", "Band": "#F8DC8E", "Grip": "#F8E6CD", "Leaf": "#A6D163", "Gold": "#DCA840",
           "Orange": "#E9681E", "Groove": "#C9551A", "Shine": "#FFA868", "Core": "#F8B26A",
           "LeafDark": "#4C8A2C", "LeafMid": "#72AD3E", "Line": "#F2EADB"}
    VIRT = {"Orange": "Carrot", "Groove": "Carrot", "Shine": "Carrot", "Core": "Band", "LeafDark": "Leaf", "LeafMid": "Leaf", "Line": "Grip"}

    def frond(pc, base, d, normal, length, width, droop, n=7, twist=0.5, curl=0.0, tone=0):
        """A lush carrot leaf: a rib from `base` along `d` in the plane facing `normal`, bending down by `droop` (and its
        end curling over by `curl`), its plane turning `twist` radians along it; a blade along the rib and a broad,
        cupped, lobed leaflet out to either side at every station, light above and dark below, one at its end."""
        d, normal = V(d).normalized(), V(normal).normalized()
        down = V((0, -1, 0)) - d * (-d.y)
        down = down.normalized() if down.length > 1e-6 else d.cross(normal)
        rib = [V(base) + d * length * i / n + down * droop * (i / n) ** 2 for i in range(n + 1)]
        if curl:
            t = (rib[-1] - rib[-2]).normalized()
            for j in range(1, 4):
                a = math.radians(55 * j)
                rib.append(rib[-1] + (t * math.cos(a) + down * math.sin(a)) * curl * (1 - 0.2 * j))
        m = len(rib) - 1
        light_, dark = ("Leaf", "LeafMid") if tone == 0 else ("LeafMid", "LeafDark")
        for i in range(m):
            t = (rib[i + 1] - rib[i]).normalized()
            nrm = Matrix.Rotation(twist * i / m, 3, t) @ normal
            ac = t.cross(nrm).normalized()
            w0, w1 = width * 0.2 * (1 - 0.6 * i / m), width * 0.2 * (1 - 0.6 * (i + 1) / m)
            pc.mat = dark
            pc.f([pc.v(rib[i] - ac * w0), pc.v(rib[i] + ac * w0), pc.v(rib[i + 1] + ac * w1), pc.v(rib[i + 1] - ac * w1)], rib[i] + nrm)
            if 1 <= i <= n:
                L = width * (1.15 - 0.6 * i / n)
                for s in (1, -1):
                    pc.mat = light_ if s > 0 else dark
                    root = rib[i] - t * L * 0.1
                    tip = root + ac * s * L * 0.8 + t * L * 0.8
                    ax = tip - root
                    perp = ax.cross(nrm).normalized() * L * 0.34
                    cup = nrm * L * 0.12
                    pc.f([pc.v(root), pc.v(root + ax * 0.35 + perp + cup), pc.v(root + ax * 0.75 + perp * 0.75 + cup), pc.v(tip),
                          pc.v(root + ax * 0.62 - perp * 0.85 + cup)], root + ax * 0.5 - nrm)
        t = (rib[-1] - rib[-2]).normalized()
        ac = t.cross(normal).normalized()
        L = width * 0.55
        pc.mat = light_
        pc.f([pc.v(rib[-1] - ac * L * 0.35), pc.v(rib[-1] + ac * L * 0.35), pc.v(rib[-1] + t * L)], rib[-1] + normal)

    def b(pc):
        B = V((0, 0, F(0.118)))                  # the carrot tops: a lush spray of leaves fanned back and down from the butt
        X = V((1, 0, 0))
        for ang, ln, wd, droop, curl, tone in ((18, 0.095, 0.03, 0.03, 0.0, 0), (3, 0.118, 0.033, 0.04, 0.012, 1), (-13, 0.125, 0.034, 0.036, 0.0, 0),
                                               (-30, 0.112, 0.032, 0.026, 0.012, 1), (-48, 0.09, 0.028, 0.012, 0.0, 0)):
            a = math.radians(ang)
            frond(pc, B, V((0, math.sin(a), -math.cos(a))), X, ln * T, wd * T, droop * T, curl=curl, tone=tone)
        for sx, ang, tone in ((1, -10, 1), (-1, -10, 0), (1, -38, 0), (-1, -38, 1)):   # and out to the sides (the top view's spread)
            a = math.radians(ang)
            frond(pc, B, V((sx * 0.5, math.sin(a) * 0.9, -0.85)), V((0, 1, 0)), 0.09 * T, 0.03 * T, 0.024 * T, n=5, twist=-0.4 * sx, tone=tone)
        rib = [B + V((0, -0.02, -0.025)), B + V((0, -0.05, -0.05)), B + V((0, -0.075, -0.06))]   # the hook curling under
        C = B + V((0, -0.1, -0.052))
        for i in range(10):
            t = i / 9
            a = math.radians(200 - 420 * t)
            rr = 0.016 * (1 - 0.65 * t)
            rib.append(C + V((0, math.sin(a) * rr, math.cos(a) * rr)))
        pc.mat = "LeafDark"
        pc.tube(rib, [0.0042 - 0.0024 * i / (len(rib) - 1) for i in range(len(rib))], sides=3, tip=True, cap=True)
        pc.mat = "Gold"                          # the gold band, a green-and-gold diamond weave round its middle
        profile(pc, [F(0.11), F(0.113), F(0.119), F(0.126), F(0.132), F(0.135)], [Rd(0.022), Rd(0.034), Rd(0.034), Rd(0.034), Rd(0.034), Rd(0.026)],
                sides=10, cap=(True, False), face=lambda i, k: ("LeafMid" if k % 2 == (i % 2) else "Gold") if i in (2, 3) else "Gold")
        pc.mat = "Grip"                          # the cream grip, slim in the middle
        gz = [0.135, 0.155, 0.18, 0.2, 0.212]
        gr = [Rd(0.027), Rd(0.0245), Rd(0.025), Rd(0.029), Rd(0.032)]
        profile(pc, [F(f) for f in gz], gr, sides=10)

        def grip_r(f):
            for (fa, ra), (fb, rb) in zip(zip(gz, gr), zip(gz[1:], gr[1:])):
                if f <= fb:
                    return ra + (rb - ra) * (f - fa) / (fb - fa)
            return gr[-1]
        vine = []                                # its binding: a green vine wound round it, three leaves off it
        for i in range(17):
            f = 0.138 + 0.068 * i / 16
            a = math.pi + TAU * 2.3 * i / 16
            vine.append(V((math.cos(a) * (grip_r(f) + 0.0012), math.sin(a) * (grip_r(f) + 0.0012), F(f))))
        pc.mat = "LeafMid"
        pc.tube(vine, [0.0019] * len(vine), sides=3, tip=True, cap=True)
        for i, lean in ((3, 0.5), (8, -0.4), (13, 0.4)):
            p = vine[i]
            rad = V((p.x, p.y, 0)).normalized()
            pc.mat = "Leaf" if i != 8 else "LeafMid"
            leaf(pc, p, (V((0, 0, 1)) + rad.cross(V((0, 0, 1))) * lean).normalized(), 0.026, 0.0075, side=rad, curl=0.003,
                 lobes=(0.55, 1.0, 0.8, 0.3), thick=0.0015, sides=3)
        pc.mat = "LeafMid"                       # the sepals: a green cup round the carrot's top, its leaves turned out
        profile(pc, [F(0.205), F(0.212), F(0.228)], [Rd(0.032), Rd(0.037), Rd(0.036)], sides=10)
        for k in range(6):
            a = TAU * k / 6 + math.pi / 2
            rad = V((math.cos(a), math.sin(a), 0))
            d = rad * math.sin(math.radians(26)) + V((0, 0, 1)) * math.cos(math.radians(26))
            pc.mat = ("Leaf", "LeafMid")[k % 2]
            leaf(pc, V((0, 0, F(0.207))) + rad * Rd(0.033), d, 0.034, 0.013, side=rad, curl=0.006, lobes=(0.7, 1.0, 0.8, 0.35),
                 thick=0.002, sides=3)
        # the carrot: rounded segments between grooves, three pale bands, a glossy streak down its lit side
        cuts = [0.235, 0.265, 0.30, 0.34, 0.357, 0.40, 0.44, 0.483, 0.495, 0.535, 0.575, 0.615, 0.653, 0.667, 0.71, 0.75, 0.79, 0.835, 0.885, 0.935]
        zs, rs, kind = [F(0.222)], [R(0.222)], []
        starts, ends = {fa for fa, fb in BANDS}, {fb for fa, fb in BANDS}
        groove = lambda x: x in cuts and x not in starts and x not in ends
        for a, c in zip([0.222] + cuts, cuts + [0.982]):
            if a in starts:                      # a band: one flush stretch
                zs.append(F(c)); rs.append(R(c)); kind.append("Band")
            elif a < 0.6:                        # the fat end: a crisp groove either side of a full segment
                zs += [F(a + (c - a) * 0.12), F(c - (c - a) * 0.12), F(c)]
                rs += [R(a + (c - a) * 0.12), R(c - (c - a) * 0.12), R(c) * (0.92 if groove(c) else 1.0)]
                kind += ["Groove" if groove(a) else "Orange", "Orange", "Groove" if groove(c) else "Orange"]
            else:                                # the slim end: soft V grooves
                zs += [F((a + c) / 2), F(c)]
                rs += [R((a + c) / 2), R(c) * (0.93 if groove(c) else 1.0)]
                kind += ["Orange", "Orange"]
        rs[-1] = R(0.982)
        profile(pc, zs, rs, sides=10, cap=(False, True), face=lambda i, k: "Shine" if (kind[i] == "Orange" and k == 3) else kind[i])
        pc.mat = "Gold"                          # the gold eye at the tip
        torus(pc, (0, -0.0018, F(0.988)), (1, 0, 0), 0.0034, 0.0012, segs=6, sides=3)
        pc.mat = "Line"                          # the reel: a drum of wound line in a green clamp, a carrot slice for its face
        tube_on(pc, RC + V((0.011, 0, 0)), (-1, 0, 0), 0.019, 0.026, sides=12, cap=True)
        pc.mat = "Orange"
        lathe(pc, RC + V((-0.008, 0, 0)), [(0, 0.0), (0.0335, 0.0), (0.0345, 0.005), (0.032, 0.0085), (0.023, 0.009), (0.022, 0.0092), (0.0085, 0.0095),
                                           (0, 0.0095)], n=12, axis=(-1, 0, 0),
              mat=lambda band, q: "Orange" if band < 3 else ("Core" if band == 4 else "Orange"))
        pc.mat = "Band"                          # its sunburst
        for k in range(10):
            a = TAU * k / 10
            dd, tt = V((0, math.cos(a), math.sin(a))), V((0, -math.sin(a), math.cos(a)))
            p0, p1 = RC + V((-0.0179, 0, 0)) + dd * 0.004, RC + V((-0.0179, 0, 0)) + dd * 0.021
            pc.f([pc.v(p0 - tt * 0.0007), pc.v(p1 - tt * 0.0005), pc.v(p1 + tt * 0.0005), pc.v(p0 + tt * 0.0007)], RC)
        pc.mat = "LeafMid"                       # the clamp round the drum's back and up to the sepals, two leaves on it
        torus(pc, RC + V((0.005, 0, 0)), (1, 0, 0), 0.034, 0.0045, segs=8, sides=4, a0=math.radians(35), a1=math.radians(235))
        top = RC + V((0.005, 0.034 * math.sin(math.radians(35)), 0.034 * math.cos(math.radians(35))))
        pc.tube([(0, -Rd(0.033), F(0.214)), (0, -0.03, F(0.222)), top], [0.0048, 0.0048, 0.0042], sides=5, tip=False, cap=False)
        for dz in (-1, 1):
            pc.mat = ("Leaf", "LeafMid")[dz > 0]
            leaf(pc, top + V((-0.004, 0.002, 0)), V((-0.2, 0.5, dz)), 0.022, 0.008, side=V((-1, 0, 0)), curl=0.003, lobes=(0.6, 1.0, 0.7, 0.3),
                 thick=0.0015, sides=3)
        hub = RC + V((-0.0185, 0, 0))            # the crank: a green stem out and down, a leaf for its knob
        knob = hub + V((-0.008, -0.014, 0.024))
        pc.mat = "LeafMid"
        pc.blob(hub, 0.0045, segs=6, rings=3)
        pc.tube([hub, hub + V((-0.005, -0.004, 0.012)), knob], [0.0032, 0.003, 0.0028], sides=4, tip=False, cap=True)
        pc.mat = "Leaf"
        leaf(pc, knob, V((0, 0.2, 1)), 0.038, 0.012, side=V((-1, 0, 0)), curl=0.004, lobes=(0.55, 1.0, 0.8, 0.3), thick=0.0025, sides=3)
        pc.mat = "Line"                          # the line, from the drum to the eye
        pc.tube([RC + V((0, 0.026, 0.008)), V((0, -0.0045, F(0.988)))], [0.0009, 0.0009], sides=3, tip=False, cap=False)
    rod = model("rod-carrot", PAL, b)
    recolor(rod, PAL, VIRT)
    return rod, [], {}, {}


# ================================================================ build
def soft_lights(objs):
    """Light parts drawn see-through in Blender's renders (the compares); RodAura draws them additive from their colour."""
    for o in objs:
        for m in (o.data.materials if o.type == "MESH" else []):
            if "Light" in m.name:
                bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                bs.inputs["Alpha"].default_value = 0.35
                try:
                    m.surface_render_method = "BLENDED"
                except (AttributeError, TypeError):
                    pass


BUILD = {"glass": glass, "lighthouse": lighthouse, "precision": precision, "carrot": carrot}
SHEET = {"glass": (0.11, 1.0), "lighthouse": (0.09, 1.0), "precision": (0.095, 0.95), "carrot": (0.17, 0.95)}                   # the hand's station and the length: the compare's butt and scale
only = ARGS[ARGS.index("only") + 1].split(",") if "only" in ARGS else list(BUILD)
for name in only:
    rod, fx, rod_extras, fx_extras = BUILD[name]()
    export([rod], os.path.join(TOOLS, f"rod-{name}.glb"), rod_extras)
    print(f"MODEL tools/rod-{name} tris={tris(rod)} materials={len(rod.data.materials)}")
    if tris(rod) > 2500 or len(rod.data.materials) > 5:
        print(f"OVER BUDGET {name}")
    if fx:
        soft_lights(fx)
        export(fx, os.path.join(PROPS, f"rodfx-{name}.glb"), fx_extras)
        print(f"MODEL props/rodfx-{name} tris={sum(tris(o) for o in fx)} meshes={sum(o.type == 'MESH' for o in fx)}")
    for o in [rod] + list(fx):
        bpy.data.objects.remove(o)
