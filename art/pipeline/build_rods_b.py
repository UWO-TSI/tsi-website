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


def profile(pc, zs, rs, sides=8, mat=None, cap=(False, False), phase=0.0):
    """A turned part up the axis through stations zs, radii rs; `mat(i)` the material of segment i."""
    keep = pc.mat
    rings = [[pc.v((math.cos(phase + TAU * k / sides) * r, math.sin(phase + TAU * k / sides) * r, z)) for k in range(sides)]
             for z, r in zip(zs, rs)]
    for i in range(len(zs) - 1):
        pc.mat = mat(i) if callable(mat) else (mat or keep)
        for k in range(sides):
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


# ================================================================ the Glass (rare)
def glass():
    """Rare, the sea-glass rod (concepts/old/glass): a hexagonal teal gem for the pommel, two gold rings, a pearl grip
    inlaid with teal waves, a gold collar and a gold crown with crystal leaves flaring from it, a milky glass float in a
    rope net hanging from it on a gold stem with a tassel and two crystal drops, a blank of two crystal strands (teal and
    pale) twisted round each other, two gold bands inlaid in teal, and at the tip a gold scroll, a spray of crystal
    leaves and a long faceted crystal point. The effect: gold glints along the blank, crystal flecks and a twist of
    light turning round it, and a teal glow at the point."""
    T, H = 1.0, 0.11
    F = lambda f: (f - H) * T                    # the sheet's stations: 0 at the gem, 1 at the crystal point's tip
    Rd = lambda d: d * T / 2                     # a diameter as a fraction of the length, to a rig radius
    DIA = [(0.232, 0.030), (0.40, 0.028), (0.60, 0.022), (0.80, 0.016), (0.90, 0.011)]

    def dia(f):
        for (fa, da), (fb, db) in zip(DIA, DIA[1:]):
            if f <= fb:
                return da + (db - da) * (f - fa) / (fb - fa)
        return DIA[-1][1]
    FLOAT = V((0, -0.066, F(0.197)))
    FR = 0.03

    def wave(u, v):                              # the grip's inlay: a teal wave edged in gold, curling, on -X and +X
        col = np.broadcast_to(hexrgb("#EEE8DD"), u.shape + (3,)).copy()
        X, Y = u * 0.094, v * 0.144              # metres round and along the grip
        gold, teal = hexrgb("#C9A35A"), hexrgb("#2FA99D")
        for c0 in (0.5, 0.0, 1.0):
            env = np.clip(np.sin(np.clip((v - 0.12) / 0.78, 0, 1) * math.pi), 0, 1) ** 0.5
            centre = (c0 + 0.07 * np.sin(v * TAU * 1.1 + 0.4)) * 0.094
            wid = 0.009 * env
            d = np.abs(X - centre)
            col[(d < wid + 0.0016) & (env > 0.05)] = gold
            col[(d < wid) & (env > 0.05)] = teal
            for cv, side in ((0.36, 1), (0.7, -1)):          # two curls off the wave, one each side
                cx = (c0 + 0.07 * math.sin(cv * TAU * 1.1 + 0.4) + side * 0.15) * 0.094
                cy = cv * 0.144
                rr = np.hypot(X - cx, Y - cy)
                ang = np.arctan2(Y - cy, X - cx)
                spiral = 0.0062 * (1 - ((ang + math.pi) / TAU) * 0.55)
                band = np.abs(rr - spiral) < 0.0019
                col[band & (rr < 0.0075)] = gold
                col[(np.abs(rr - spiral) < 0.0011) & (rr < 0.0075)] = teal
        return col
    grip_tex = teximage("glass-grip", 128, 192, wave)

    def b(pc):
        pc.mat = "Crystal"                       # the gem: a hexagonal crystal, its end a flat table
        profile(pc, [F(0.0), F(0.006), F(0.024)], [Rd(0.018), Rd(0.031), Rd(0.031)], sides=6, cap=(True, False), phase=math.pi / 6)
        pc.mat = "Gold"                          # two gold rings, a step between
        profile(pc, [F(0.024), F(0.031), F(0.034), F(0.042)], [Rd(0.036), Rd(0.036), Rd(0.031), Rd(0.036)], sides=8,
                mat=lambda i: "Gold")
        profile(pc, [F(0.042), F(0.043)], [Rd(0.036), Rd(0.030)], sides=8)
        pc.mat = "Pearl"                         # the grip, inlaid
        gf = [0.043, 0.07, 0.14, 0.17, 0.186]
        gd = [0.030, 0.031, 0.026, 0.027, 0.029]
        uvtube(pc, [F(f) for f in gf], [Rd(d) for d in gd], 8, lambda i, k: (k / 8, (gf[i] - gf[0]) / (gf[-1] - gf[0])), phase=TAU / 16)
        pc.mat = "Gold"                          # the collar, bevelled, and the crown flaring from it toward the tip
        profile(pc, [F(0.186), F(0.188), F(0.196), F(0.199), F(0.214), F(0.226), F(0.232)],
                [Rd(0.029), Rd(0.035), Rd(0.035), Rd(0.026), Rd(0.029), Rd(0.036), Rd(0.026)], sides=8)
        for a, ln, w, lean, m in ((90, 0.068, 0.016, 32, "Crystal"), (90, 0.056, 0.013, 14, "Pale"), (35, 0.048, 0.012, 44, "Pale"),
                                  (145, 0.048, 0.012, 44, "Pale")):
            pc.mat = m                           # the crown's crystal leaves, vanes flaring up and to the sides
            vane(pc, V((0, 0, F(0.214))), a, Rd(0.026), lean, ln * T, w * T, 0.004)
        pc.mat = "Gold"                          # and its gold leaves, laid along the blank on either side
        for a in (180, 0):
            rad = V((math.cos(math.radians(a)), math.sin(math.radians(a)), 0))
            leaf(pc, V((0, 0, F(0.218))) + rad * Rd(0.03), (V((0, 0, 1)) + rad * 0.15 + V((0, 0.35, 0))).normalized(), 0.034, 0.008,
                 side=rad, curl=0.004, lobes=(0.6, 1.0, 0.7, 0.3), thick=0.002, sides=3)
        pc.mat = "Gold"                          # the float's stem, a teal collar at its foot
        tube_on(pc, (0, -0.012, F(0.197)), (0, -1, 0), 0.022, 0.0034, sides=4, cap=False)
        tube_on(pc, (0, -0.031, F(0.197)), (0, -1, 0), 0.006, 0.0068, sides=8, mat="Crystal")
        pc.mat = "Float"                         # the glass float
        pc.blob(FLOAT, FR, segs=8, rings=6)
        pc.mat = "Gold"                          # its net: two sets of three cords wound opposite ways, a cord round its neck

        def on(th, ph, r=FR + 0.0012):
            return FLOAT + V((0, math.cos(th), 0)) * r + V((math.cos(ph), 0, math.sin(ph))) * math.sin(th) * r
        for s in (1, -1):
            for j in range(3):
                pts = [on(math.radians(28 + 124 * i / 3), TAU * j / 3 + 0.5 + s * 1.5 * i / 3) for i in range(4)]
                pc.tube(pts, [0.0016] * 4, sides=3, tip=False, cap=False)
        torus(pc, FLOAT + V((0, math.cos(math.radians(28)) * FR, 0)), (0, 1, 0), math.sin(math.radians(28)) * FR + 0.001, 0.0017, segs=6, sides=3)
        knot = FLOAT - V((0, FR + 0.004, 0))     # the tassel and its two crystal drops
        pc.blob(knot, 0.0048, segs=4, rings=3)
        loft(pc, [knot - V((0, 0.003, 0)), knot - V((0, 0.019, 0))], [0.0028, 0.0058], sides=5, tip=False, cap=True, ref=(0, 0, 1))
        for off in (V((0, -0.016, -0.015)), V((0, -0.03, -0.003))):
            p = knot + off
            pc.mat = "Gold"
            pc.tube([knot, p], [0.0009, 0.0009], sides=3, tip=False, cap=False)
            pc.mat = "Crystal"
            dd = off.normalized()
            loft(pc, [p, p + dd * 0.006, p + dd * 0.014], [0.0004, 0.0042, 0.0004], sides=3, tip=False, cap=True, ref=(1, 0, 0))
        # the blank: two crystal ribbons twisted round each other, four turns, each a flat diamond in section
        z0, z1, N, TURNS = 0.232, 0.895, 25, 4.0
        for strand, m in ((0, "Crystal"), (1, "Pale")):
            rings = []
            for i in range(N):
                u = i / (N - 1)
                f = z0 + (z1 - z0) * u
                rr = Rd(dia(f))
                ph = math.pi * strand + TAU * TURNS * u
                rad, tan = V((math.cos(ph), math.sin(ph), 0)), V((-math.sin(ph), math.cos(ph), 0))
                c = V((0, 0, F(f))) + rad * rr * 0.4
                s = rr * 0.7
                rings.append([c + rad * s * 0.8, c + tan * s * 1.35, c - rad * s * 0.8, c - tan * s * 1.35])
            pc.mat = m
            pc.band(rings, caps=(V((0, 0, F(z0) - 0.004)), V((0, 0, F(z1) + 0.004))))
        for fa, fb in ((0.424, 0.446), (0.66, 0.677)):          # the two gold bands, inlaid in teal
            r = Rd(dia((fa + fb) / 2)) * 1.15
            profile(pc, [F(fa), F(fa) + 0.005, F(fb) - 0.005, F(fb)], [r, r, r, r], sides=8, mat=lambda i: "Crystal" if i == 1 else "Gold")
        pc.mat = "Gold"                          # the tip: a gold collar, a scroll sweeping back under the blank into a curl
        profile(pc, [F(0.886), F(0.89), F(0.902), F(0.908)], [Rd(0.010), Rd(0.016), Rd(0.016), Rd(0.008)], sides=8)
        C = V((0, -0.022, F(0.868)))
        pts = [V((0, -0.006, F(0.9))), V((0, -0.012, F(0.887)))]
        for i in range(9):
            a = math.radians(-30 + 400 * i / 8)
            R = 0.0115 - 0.0075 * i / 8
            pts.append(C + V((0, math.cos(a) * R, -math.sin(a) * R)))
        pc.tube(pts, [0.0028 - 0.0013 * i / (len(pts) - 1) for i in range(len(pts))], sides=3, tip=True, cap=True)
        for a, lean, ln, w, m in ((90, 22, 0.06, 0.013, "Pale"), (90, 44, 0.046, 0.012, "Crystal"), (35, 48, 0.04, 0.011, "Pale"),
                                  (145, 48, 0.04, 0.011, "Crystal"), (270, 14, 0.058, 0.011, "Pale")):
            pc.mat = m                           # the tip's spray of crystal leaves
            vane(pc, V((0, 0, F(0.902))), a, Rd(0.012), lean, ln * T, w * T, 0.003)
        pc.mat = "Crystal"                       # the point: a long faceted crystal, flat a little across
        loft(pc, [(0, 0, F(0.905)), (0, 0, F(0.95)), (0, 0, F(0.994))], [(0.004, 0.003), (Rd(0.031), Rd(0.022)), (0.002, 0.0015)],
             sides=6, tip=True, cap=True, ref=(0, 1, 0))
        pc.mat = "Pale"                          # the line, from the float to the tip
        pc.tube([FLOAT + V((0, 0.006, FR * 0.96)), V((0, -0.007, F(0.93)))], [0.0011, 0.0011], sides=3, tip=False, cap=False)
    rod = model("rod-glass", {"Crystal": "#3FBCAF", "Pale": "#C4EEE7", "Pearl": "#FFFFFF", "Gold": "#D6B46E", "Float": "#CFEDE6"}, b)
    texmat("rod-glass_Pearl", grip_tex)

    def glints(pc):                              # four-point gold glints along the blank, each two crossed stars
        pc.mat = "Glow"
        for f, up, r in ((0.31, 0.024, 0.016), (0.525, 0.022, 0.019), (0.735, 0.019, 0.015), (0.955, 0.034, 0.013)):
            c = V((0, up, F(f)))
            star_flat(pc, c, r, r * 0.16, 4, 0.0)
            star_flat(pc, c, r, r * 0.16, 4, 0.0, rot=Matrix.Rotation(math.radians(90), 3, "Z"))

    def flecks(pc):                              # crystal flecks round the blank, turning with the light
        pc.mat = "Light"
        for i in range(9):
            f = 0.27 + 0.68 * i / 8
            a = 2.4 * i
            rad = V((math.cos(a), math.sin(a), 0))
            c = V((0, 0, F(f))) + rad * (Rd(dia(min(f, 0.9))) + 0.014 + 0.006 * (i % 3))
            d = V((0, 0, 1)) * 0.009 + rad.cross(V((0, 0, 1))) * 0.003
            s = rad * 0.0022
            pc.f([pc.v(c - d), pc.v(c + s), pc.v(c + d), pc.v(c - s)], c - rad)
            pc.f([pc.v(c - d), pc.v(c + rad.cross(V((0, 0, 1))) * 0.0022), pc.v(c + d), pc.v(c - rad.cross(V((0, 0, 1))) * 0.0022)], c + V((0, 0, 0.001)))

    def twist(pc):                               # a ribbon of light wound twice round the blank
        pc.mat = "Light"
        n = 25
        row = []
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
          light("Flecks", "#8FEFE2", flecks, spin=0.9),
          light("Twist", "#7FE6D6", twist, spin=-1.4),
          fx_empty("Halo", (0, 0, F(0.95)), size=0.11, color="#8FF0E0"),
          fx_empty("FX_Tip", (0, 0, F(0.95))),
          fx_empty("FX_Grip", (0, 0, 0))]
    return rod, fx, {"rodFx": "glass"}, particles("#FFF2CC", sprite="sparkle", every=0.4, size=0.035, rise=0.12)


# ================================================================ the Lighthouse (rare)
def lighthouse():
    """Rare, the lighthouse rod (concepts/old/lighthouse): a gold end cap, a dark wood grip, a stepped gold collar, a
    brass porthole reel showing its wound line, on a gold bracket, with a wood-knobbed crank; a cream tower of a blank
    banded in red edged with gold, an arched lit window in each cream stretch, a neck flaring to a gold collar, and the
    lantern room at the tip standing in line with the rod (David: "the lantern at the tip must stand straight, in line
    with the rod"): a gallery with a railing and an eye for the line, glazing between gold mullions, a red roof and a
    gold ball. The effect: the lamp alight, a beam of light sweeping round the rod's axis like a lighthouse's."""
    T, H = 1.0, 0.09
    F = lambda f: (f - H) * T
    Rd = lambda d: d * T / 2
    R = lambda f: Rd(0.0296 - 0.0016 * (f - 0.195) / 0.7)      # the blank, barely tapering
    BANDS = [(0.257, 0.294), (0.395, 0.434), (0.538, 0.578), (0.678, 0.716), (0.818, 0.858)]
    WINDOWS = [0.225, 0.345, 0.487, 0.627, 0.766, 0.885]
    G0 = F(0.952)                                # the gallery's floor; the lantern stands on it, up the rod's axis
    LAMP = V((0, 0, G0 + 0.022))
    RC = V((0, -0.052, F(0.205)))                # the reel's hub

    def b(pc):
        pc.mat = "Gold"                          # the end cap
        profile(pc, [F(0.0), F(0.004), F(0.02), F(0.024)], [Rd(0.026), Rd(0.037), Rd(0.037), Rd(0.033)], sides=10, cap=(True, False))
        pc.mat = "Wood"                          # the grip
        profile(pc, [F(0.024), F(0.06), F(0.12), F(0.163)], [Rd(0.033), Rd(0.0355), Rd(0.034), Rd(0.031)], sides=10)
        pc.mat = "Gold"                          # the collar: a wide ring and a narrow one
        profile(pc, [F(0.163), F(0.166), F(0.178), F(0.18), F(0.192), F(0.195)],
                [Rd(0.031), Rd(0.04), Rd(0.04), Rd(0.034), Rd(0.034), R(0.195)], sides=10)
        # the tower: cream, banded red, each band rimmed in gold
        zs, rs, ms = [F(0.195)], [R(0.195)], []
        for fa, fb in BANDS:
            for f, r, m in ((fa, R(fa), "Cream"), (fa + 0.005, R(fa) * 1.07, "Gold"), (fb - 0.005, R(fb) * 1.07, "Red"), (fb, R(fb), "Gold")):
                zs.append(F(f)); rs.append(r); ms.append(m)
        for f, r in ((0.895, R(0.895)), (0.905, Rd(0.027)), (0.918, Rd(0.0245)), (0.932, Rd(0.03)), (0.944, Rd(0.042))):
            zs.append(F(f)); rs.append(r); ms.append("Cream")
        profile(pc, zs, rs, sides=8, mat=lambda i: ms[i], phase=TAU / 16)
        pc.mat = "Gold"                          # the gold collar under the gallery
        profile(pc, [F(0.944), F(0.946), G0], [Rd(0.042), Rd(0.046), Rd(0.046)], sides=10)
        for f in WINDOWS:                        # the windows: an arch of lit glass in a gold frame, on the camera side and on top
            r = R(min(f, 0.895)) if f < 0.895 else Rd(0.0255)
            for side in (V((-1, 0, 0)), V((0, 1, 0))):
                up = V((0, 1, 0)) if side.x else V((1, 0, 0))

                def arch(k, lift):
                    pts = [(-1, -1), (1, -1), (1, 0.25)] + [(math.cos(math.pi * i / 4), 0.25 + 0.75 * math.sin(math.pi * i / 4)) for i in range(1, 4)] + [(-1, 0.25)]
                    out = []
                    for zx, uy in pts:
                        ang = uy * 0.0062 * k / r
                        p = side * math.cos(ang) * (r + lift) + up * math.sin(ang) * (r + lift)
                        out.append(pc.v(p + V((0, 0, F(f) + zx * 0.0048 * k))))
                    return out
                pc.mat = "Gold"
                pc.f(arch(1.4, 0.0007), V((0, 0, F(f))))
                pc.mat = "Lamp"
                pc.f(arch(1.05, 0.0012), V((0, 0, F(f))))
        pc.mat = "Gold"                          # the gallery: a floor, a railing on posts, an eye for the line
        profile(pc, [G0, G0 + 0.004], [0.031, 0.031], sides=12, cap=(True, True))
        torus(pc, (0, 0, G0 + 0.015), (0, 0, 1), 0.0295, 0.0013, segs=12, sides=3)
        for k in range(8):
            a = TAU * k / 8 + TAU / 16
            pc.tube([(math.cos(a) * 0.0295, math.sin(a) * 0.0295, G0 + 0.004), (math.cos(a) * 0.0295, math.sin(a) * 0.0295, G0 + 0.015)],
                    [0.0011, 0.0011], sides=3, tip=False, cap=False)
        torus(pc, (0, -0.036, G0 + 0.001), (1, 0, 0), 0.0045, 0.0013, segs=6, sides=3)
        pc.mat = "Cream"                         # the lantern room: pale glazing between gold rings and mullions
        profile(pc, [G0 + 0.004, G0 + 0.034], [0.0205, 0.0205], sides=8, phase=TAU / 16, mat="Cream")
        pc.mat = "Gold"
        for z0 in (G0 + 0.004, G0 + 0.031):
            profile(pc, [z0, z0 + 0.003], [0.0225, 0.0225], sides=8, phase=TAU / 16)
        for k in range(8):
            a = TAU * k / 8 + TAU / 16
            pc.tube([(math.cos(a) * 0.021, math.sin(a) * 0.021, G0 + 0.006), (math.cos(a) * 0.021, math.sin(a) * 0.021, G0 + 0.032)],
                    [0.0013, 0.0013], sides=3, tip=False, cap=False)
        pc.mat = "Gold"                          # the roof: a gold rim, a red cone, a gold ball
        profile(pc, [G0 + 0.034, G0 + 0.037], [0.0285, 0.0285], sides=8, cap=(True, False), phase=TAU / 16)
        pc.mat = "Red"
        profile(pc, [G0 + 0.037, G0 + 0.054], [0.0285, 0.004], sides=8, phase=TAU / 16)
        pc.mat = "Gold"
        tube_on(pc, (0, 0, G0 + 0.053), (0, 0, 1), 0.006, 0.0022, sides=4, cap=False)
        pc.blob((0, 0, G0 + 0.064), 0.0058, segs=6, rings=4)
        pc.mat = "Gold"                          # the reel: a brass porthole drum on a bracket, its window showing the line
        lathe(pc, RC, [(0, -0.009), (0.036, -0.009), (0.0385, 0.0), (0.0385, 0.006), (0.034, 0.011), (0.027, 0.0105), (0, 0.0095)],
              n=12, axis=(-1, 0, 0), mat=lambda band, q: "Gold")
        disc(pc, RC + V((-0.0107, 0, 0)), (-1, 0, 0), 0.0272, sides=12, mat="Cream")
        for k in range(8):                       # the bezel's rivets
            a = TAU * k / 8
            pc.mat = "Wood"
            disc(pc, RC + V((-0.0117, math.cos(a) * 0.031, math.sin(a) * 0.031)), (-1, 0, 0), 0.0016, sides=4)
        for a in (0.0, math.pi):                 # the hinge lugs at its sides
            p = RC + V((-0.003, 0, 0)) + V((0, math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) * 0 + V((0, 0, math.cos(a) * 0.04))
            pc.blob(p, (0.006, 0.006, 0.004), segs=4, rings=3)
        pc.tube([(0, -R(0.19) * 0.6, F(0.186)), (0, -0.026, F(0.193)), (0, RC.y + 0.035, RC.z - 0.006)], [0.0042, 0.004, 0.0045], sides=4, tip=False, cap=False)
        pc.tube([(0, -R(0.23) * 0.6, F(0.232)), (0, -0.026, F(0.226)), (0, RC.y + 0.035, RC.z + 0.008)], [0.0034, 0.0032, 0.0036], sides=4, tip=False, cap=False)
        hub = RC + V((-0.012, 0, 0))             # the crank: an arm down toward the tip, a wood knob
        knob = hub + V((-0.004, -0.024, 0.026))
        pc.tube([hub, knob], [0.0035, 0.0035], sides=4, tip=False, cap=True)
        pc.blob(hub, 0.0045, segs=5, rings=3)
        pc.mat = "Wood"
        d = V((-0.25, -0.35, 1)).normalized()
        loft(pc, [knob, knob + d * 0.006, knob + d * 0.016, knob + d * 0.022], [0.004, 0.0068, 0.0062, 0.003], sides=6, tip=False, cap=True)
        pc.mat = "Cream"                         # the line, from the reel to the gallery's eye
        pc.tube([RC + V((0, 0.03, 0.012)), V((0, -0.036, G0 - 0.003))], [0.001, 0.001], sides=3, tip=False, cap=False)
    rod = model("rod-lighthouse", {"Cream": "#F3EAD8", "Red": "#C9343A", "Gold": "#C99332", "Wood": "#5A3226", "Lamp": "#F6B444"}, b)

    def beam(pc):                                # the beam: a cone of light out from the lamp, wide and soft
        pc.mat = "Light"
        for length, ang in ((0.34, 14), (0.24, 9), (0.14, 5)):
            ring_ = [pc.v(LAMP + V((length, math.cos(TAU * k / 8) * length * math.tan(math.radians(ang)),
                                    math.sin(TAU * k / 8) * length * math.tan(math.radians(ang))))) for k in range(8)]
            apex = pc.v(LAMP + V((0.012, 0, 0)))
            for k in range(8):
                pc.f([apex, ring_[k], ring_[(k + 1) % 8]], LAMP + V((length, 0, 0)))

    def lamp(pc):
        pc.mat = "Glow"
        pc.blob(LAMP, (0.012, 0.012, 0.011), segs=6, rings=4)
    fx = [light("Beam", "#8C6A34", beam, pivot=tuple(LAMP), spin=1.1),
          glow("Lamp", "#FFD98A", lamp, pivot=tuple(LAMP), pulse=0.12),
          fx_empty("Halo", tuple(LAMP), size=0.15, color="#FFD58A"),
          fx_empty("FX_Lamp", tuple(LAMP)),
          fx_empty("FX_Grip", (0, 0, 0))]
    return rod, fx, {"rodFx": "lighthouse"}, particles("#FFE3A8", sprite="glow", every=0.5, size=0.028, rise=0.1)


# ================================================================ the Precision (common)
def precision():
    """Common, the sport rod (concepts/old/precision): a white end cap and a gold ring, a black knurled grip, a gold ring
    and a silver reel seat, a slate-blue blank marked like a ruler down its side, three white ferrules, a gold guide ring
    standing on top near the tip and a small eye at it, a silver reel with a gold rim, a gauge and a black-knobbed crank."""
    T, H = 0.95, 0.095
    F = lambda f: (f - H) * T
    Rd = lambda d: d * T / 2
    R = lambda f: Rd(0.0205 - 0.0102 * (f - 0.19) / 0.795)
    RC = V((0, -0.05, F(0.2)))
    PERIOD = 0.066                               # metres of blank per ten ruler marks

    def ruler(u, v):                             # blue, its marks on the -X face (u .5 to .625) and the top face (u .25 to .375)
        col = np.broadcast_to(hexrgb("#41609C"), u.shape + (3,)).copy()
        white = hexrgb("#E6EDF7")
        for u0 in (0.5, 0.25):
            col[(u > u0 + 0.004) & (u < u0 + 0.014)] = white * 0.55 + hexrgb("#41609C") * 0.45      # the base line
            k = (v * 10) % 1.0
            long_ = ((np.floor(v * 10) % 5) == 0)
            tick = (k < 0.11) & (u > u0) & (u < u0 + np.where(long_, 0.085, 0.05))
            col[tick] = white
        return col

    def knurl(u, v):                             # the grip's knurling: a dark diamond weave
        a, c = (u * 8) % 1.0, (v * 8) % 1.0
        d = np.minimum(np.abs((a + c) % 1.0 - 0.5), np.abs((a - c) % 1.0 - 0.5))
        out = np.broadcast_to(hexrgb("#2A2C31"), u.shape + (3,)).copy()
        out[d > 0.36] = hexrgb("#17181B")
        out[d < 0.08] = hexrgb("#45484F")
        return out
    blank_tex, grip_tex = teximage("precision-ruler", 64, 128, ruler), teximage("precision-knurl", 32, 32, knurl)

    def b(pc):
        pc.mat = "White"                         # the end cap and its gold ring
        profile(pc, [F(0.0), F(0.004), F(0.02)], [Rd(0.022), Rd(0.031), Rd(0.031)], sides=10, cap=(True, False))
        pc.mat = "Gold"
        profile(pc, [F(0.02), F(0.022), F(0.03), F(0.032)], [Rd(0.03), Rd(0.0345), Rd(0.0345), Rd(0.031)], sides=10)
        pc.mat = "Grip"                          # the grip, knurled
        L = F(0.162) - F(0.032)
        uvtube(pc, [F(0.032), F(0.162)], [Rd(0.0315), Rd(0.0315)], 10, lambda i, k: (k / 10 * 3, i * L / (math.pi * Rd(0.0315) * 2) * 3))
        pc.mat = "Gold"                          # a gold ring, the silver seat, a silver band
        profile(pc, [F(0.162), F(0.164), F(0.171), F(0.173)], [Rd(0.031), Rd(0.0345), Rd(0.0345), Rd(0.031)], sides=10)
        pc.mat = "Silver"
        profile(pc, [F(0.173), F(0.18), F(0.19), F(0.193)], [Rd(0.033), Rd(0.033), Rd(0.03), R(0.193)], sides=10)
        pc.mat = "Blank"                         # the blank, marked; the last stretch past the guide plain
        fs = [0.193, 0.4, 0.6, 0.84]
        uvtube(pc, [F(f) for f in fs], [R(f) for f in fs], 8, lambda i, k: (k / 8, (F(fs[i]) - F(fs[0])) / PERIOD), phase=-TAU / 16)
        ft = [0.84, 0.985]
        uvtube(pc, [F(f) for f in ft], [R(f) for f in ft], 8, lambda i, k: (k / 8 + 0.5, 0.05), phase=-TAU / 16)
        pc.mat = "White"                         # three white ferrules
        for f in (0.212, 0.473, 0.678):
            r = R(f) * 1.18
            profile(pc, [F(f) - 0.006, F(f) - 0.005, F(f) + 0.005, F(f) + 0.006], [R(f), r, r, R(f)], sides=10)
        pc.mat = "Gold"                          # the guide: a collar and a ring standing on top of the blank
        f = 0.855
        profile(pc, [F(f) - 0.006, F(f) - 0.005, F(f) + 0.005, F(f) + 0.006], [R(f), R(f) * 1.35, R(f) * 1.35, R(f)], sides=8)
        torus(pc, (0, R(f) + 0.0128, F(f)), (1, 0, 0), 0.0095, 0.0021, segs=10, sides=4)
        pc.mat = "Silver"                        # the tip's eye
        profile(pc, [F(0.978), F(0.988)], [R(0.978) * 1.25, R(0.988) * 1.1], sides=6, cap=(False, True))
        torus(pc, (0, -0.002, F(0.993)), (1, 0, 0), 0.0034, 0.0011, segs=6, sides=3)
        pc.mat = "Silver"                        # the reel: a silver drum, gold rim on its face, on a silver foot
        lathe(pc, RC, [(0, -0.011), (0.031, -0.011), (0.0335, -0.007), (0.0335, 0.005), (0.031, 0.0085), (0.025, 0.0085), (0.024, 0.0075), (0, 0.0075)],
              n=12, axis=(-1, 0, 0), mat=lambda band, q: "Gold" if band in (1, 3) else "Silver")
        pc.tube([(0, -Rd(0.03), F(0.18)), (0, -0.026, F(0.183)), (0, RC.y + 0.031, RC.z - 0.004)], [0.004, 0.004, 0.0045], sides=4, tip=False, cap=False)
        pc.mat = "White"                         # the gauge, up on the face toward the tip
        g = RC + V((-0.0085, 0.013, 0.012))
        disc(pc, g, (-1, 0, 0), 0.0068, sides=8)
        pc.mat = "Silver"
        torus(pc, g + V((0.0004, 0, 0)), (1, 0, 0), 0.0072, 0.0011, segs=8, sides=3)
        pc.mat = "Grip"
        pc.f([pc.v(g + V((-0.0003, 0.0004, 0))), pc.v(g + V((-0.0003, -0.0004, 0))), pc.v(g + V((-0.0003, 0.004, 0.0035)))], g + V((1, 0, 0)))
        pc.mat = "Gold"                          # the crank: a gold hub, a silver arm, a black knob
        hub = RC + V((-0.009, 0, 0))
        pc.blob(hub, 0.0045, segs=6, rings=3)
        knob = hub + V((-0.004, -0.02, 0.019))
        pc.mat = "Silver"
        pc.tube([hub, knob], [0.0028, 0.0028], sides=4, tip=False, cap=True)
        pc.mat = "Grip"
        d = V((-0.2, -0.45, 1)).normalized()
        loft(pc, [knob, knob + d * 0.003, knob + d * 0.016, knob + d * 0.019], [0.004, 0.0058, 0.0058, 0.004], sides=6, tip=False, cap=True)
        pc.mat = "White"                         # the line, from the reel to the eye
        pc.tube([RC + V((0, 0.026, 0.012)), V((0, -0.004, F(0.99)))], [0.0009, 0.0009], sides=3, tip=False, cap=False)
    rod = model("rod-precision", {"Blank": "#FFFFFF", "Grip": "#FFFFFF", "Silver": "#C9CED6", "Gold": "#C9A24C", "White": "#EEEEEA"}, b)
    texmat("rod-precision_Blank", blank_tex)
    texmat("rod-precision_Grip", grip_tex)
    return rod, [], {}, {}


# ================================================================ the Carrot (uncommon)
def carrot():
    """Uncommon, the carrot rod (concepts/old/carrot): a spray of feathery carrot tops for the butt, one curling under, a
    gold band, a slim peach grip with a little leaf, a cup of green sepals, a fat glossy carrot for a blank, ringed with
    shallow grooves and three pale bands, tapering to a gold eye; a reel of wound line in a green clamp, its face an
    orange disc, its crank a green stem with a leaf for a knob."""
    T, H = 0.95, 0.17
    F = lambda f: (f - H) * T
    Rd = lambda d: d * T / 2
    DIA = [(0.222, 0.030), (0.24, 0.038), (0.27, 0.0435), (0.31, 0.0425), (0.36, 0.039), (0.41, 0.036), (0.46, 0.033), (0.52, 0.030),
           (0.57, 0.0275), (0.62, 0.0245), (0.67, 0.0215), (0.72, 0.0195), (0.77, 0.0165), (0.83, 0.0138), (0.88, 0.0115),
           (0.93, 0.0092), (0.97, 0.0072), (0.982, 0.0055)]

    def R(f):
        for (fa, da), (fb, db) in zip(DIA, DIA[1:]):
            if f <= fb:
                return Rd(da + (db - da) * (f - fa) / (fb - fa))
        return Rd(DIA[-1][1])
    RC = V((0, -0.05, F(0.228)))
    BANDS = [(0.34, 0.357), (0.483, 0.495), (0.653, 0.667)]

    def frond(pc, base, d, normal, length, width, droop, n=6):
        """A feathery carrot leaf in the plane facing `normal`: a rib from `base` along `d`, bending by `droop` (metres at
        its end, toward -Y as it hangs), a narrow blade along it, a broad lobed leaflet out to either side at every
        station, smaller toward its end, and one at its end."""
        d, normal = V(d).normalized(), V(normal).normalized()
        down = V((0, -1, 0)) - normal * normal.y * -1
        down = (down - d * down.dot(d))
        down = down.normalized() if down.length > 1e-6 else d.cross(normal)
        rib = [V(base) + d * length * i / n + down * droop * (i / n) ** 2 for i in range(n + 1)]
        for i in range(n):
            t = (rib[i + 1] - rib[i]).normalized()
            ac = t.cross(normal).normalized()
            w0, w1 = width * 0.28 * (1 - 0.5 * i / n), width * 0.28 * (1 - 0.5 * (i + 1) / n)
            pc.f([pc.v(rib[i] - ac * w0), pc.v(rib[i] + ac * w0), pc.v(rib[i + 1] + ac * w1), pc.v(rib[i + 1] - ac * w1)], rib[i] + normal)
            if i >= 1:
                L = width * (1.15 - 0.55 * i / n)
                for s in (1, -1):
                    root = rib[i] - t * L * 0.15
                    tip = root + ac * s * L * 0.8 + t * L * 0.75
                    ax = tip - root
                    perp = ax.cross(normal).normalized() * L * 0.36
                    pc.f([pc.v(root), pc.v(root + ax * 0.4 + perp), pc.v(root + ax * 0.78 + perp * 0.7), pc.v(tip),
                          pc.v(root + ax * 0.6 - perp * 0.9)], root + ax * 0.5 + normal)
        t = (rib[-1] - rib[-2]).normalized()
        ac = t.cross(normal).normalized()
        L = width * 0.6
        pc.f([pc.v(rib[-1] - ac * L * 0.3), pc.v(rib[-1] + ac * L * 0.3), pc.v(rib[-1] + t * L)], rib[-1] + normal)
        return rib

    def b(pc):
        pc.mat = "Leaf"                          # the carrot tops: a spray of feathery leaves fanned back and down from the butt
        B = V((0, 0, F(0.118)))
        side = V((1, 0, 0))
        for ang, ln, wd, droop in ((14, 0.085, 0.026, 0.04), (-6, 0.1, 0.028, 0.044), (-30, 0.11, 0.029, 0.036), (-54, 0.1, 0.027, 0.022),
                                   (-78, 0.08, 0.024, 0.006)):
            a = math.radians(ang)
            frond(pc, B, V((0, math.sin(a), -math.cos(a))), side, ln * T, wd * T, droop * T)
        for sx in (1, -1):                       # two thrown out to the sides (the top view's spread)
            frond(pc, B, V((sx * 0.55, -0.35, -0.8)), V((0, 1, 0)), 0.085 * T, 0.028 * T, 0.02 * T, n=5)
        rib = [B + V((0, -0.02, -0.03))]         # the curl under, at the end of a lower stem: a small spiral
        C = B + V((0, -0.075, -0.07))
        for i in range(9):
            t = i / 8
            a = math.radians(200 - 400 * t)
            rr = 0.013 * (1 - 0.65 * t)
            rib.append(C + V((0, math.sin(a) * rr, math.cos(a) * rr)))
        pc.tube(rib, [0.0026 - 0.0014 * i / (len(rib) - 1) for i in range(len(rib))], sides=3, tip=True, cap=True)
        pc.mat = "Gold"                          # the gold band
        profile(pc, [F(0.11), F(0.113), F(0.132), F(0.135)], [Rd(0.02), Rd(0.031), Rd(0.031), Rd(0.024)], sides=8, cap=(True, False))
        pc.mat = "Grip"                          # the grip, slim in the middle
        profile(pc, [F(0.135), F(0.155), F(0.18), F(0.2), F(0.212)], [Rd(0.024), Rd(0.0215), Rd(0.022), Rd(0.026), Rd(0.029)], sides=8)
        pc.mat = "Leaf"                          # its little leaf, laid on the camera side
        leaf(pc, V((-Rd(0.022), 0, F(0.153))), V((0, 0.35, 1)), 0.03, 0.0075, side=V((-1, 0, 0)), curl=0.002, lobes=(0.5, 1.0, 0.8, 0.3),
             thick=0.0015, sides=3)
        pc.mat = "Leaf"                          # the sepals: a green cup round the carrot's top, its leaves turned out
        profile(pc, [F(0.205), F(0.212), F(0.228)], [Rd(0.03), Rd(0.034), Rd(0.033)], sides=8)
        for k in range(5):
            a = TAU * k / 5 + math.pi / 2
            rad = V((math.cos(a), math.sin(a), 0))
            d = rad * math.sin(math.radians(22)) + V((0, 0, 1)) * math.cos(math.radians(22))
            leaf(pc, V((0, 0, F(0.208))) + rad * Rd(0.03), d, 0.03, 0.012, side=rad, curl=0.004, lobes=(0.7, 1.0, 0.8, 0.35),
                 thick=0.002, sides=3)
        # the carrot: grooves between rounded segments, three pale bands
        cuts = [0.235, 0.265, 0.30, 0.34, 0.357, 0.40, 0.44, 0.483, 0.495, 0.535, 0.575, 0.615, 0.653, 0.667, 0.71, 0.75, 0.80, 0.87]
        zs, rs, ms = [F(0.222)], [R(0.222)], []
        for a, c in zip([0.222] + cuts, cuts + [0.982]):
            band = any(abs(a - fa) < 1e-6 for fa, fb in BANDS)
            mid = (a + c) / 2
            zs += [F(mid), F(c)]
            rs += [R(mid), R(c) * (1.0 if band or any(abs(c - fa) < 1e-6 for fa, fb in BANDS) else 0.9)]
            ms += ["Band" if band else "Carrot"] * 2
        rs[-1] = R(0.982)
        profile(pc, zs, rs, sides=8, mat=lambda i: ms[i], cap=(False, True))
        pc.mat = "Gold"                          # the gold eye at the tip
        torus(pc, (0, -0.0015, F(0.987)), (1, 0, 0), 0.003, 0.0011, segs=5, sides=3)
        pc.mat = "Grip"                          # the reel: a drum of wound line in a green clamp, an orange face
        tube_on(pc, RC + V((0.009, 0, 0)), (-1, 0, 0), 0.016, 0.024, sides=8, cap=True)
        pc.mat = "Carrot"
        lathe(pc, RC + V((-0.007, 0, 0)), [(0, 0.0), (0.0295, 0.0), (0.0295, 0.004), (0.026, 0.0055), (0, 0.0055)], n=10, axis=(-1, 0, 0))
        pc.mat = "Band"                          # its sunburst
        for k in range(6):
            a = TAU * k / 6
            dd, tt = V((0, math.cos(a), math.sin(a))), V((0, -math.sin(a), math.cos(a)))
            p0, p1 = RC + V((-0.0128, 0, 0)) + dd * 0.006, RC + V((-0.0128, 0, 0)) + dd * 0.022
            pc.f([pc.v(p0 - tt * 0.0008), pc.v(p1 - tt * 0.0004), pc.v(p1 + tt * 0.0004), pc.v(p0 + tt * 0.0008)], RC)
        pc.mat = "Leaf"                          # the clamp round the drum's back and up to the sepals
        torus(pc, RC + V((0.004, 0, 0)), (1, 0, 0), 0.031, 0.0035, segs=6, sides=4, a0=math.radians(40), a1=math.radians(230))
        pc.tube([(0, -Rd(0.03), F(0.212)), (0, -0.026, F(0.214)), RC + V((0.004, 0.031 * math.sin(math.radians(40)), 0.031 * math.cos(math.radians(40))))],
                [0.004, 0.004, 0.0035], sides=4, tip=False, cap=False)
        hub = RC + V((-0.013, 0, 0))             # the crank: a green stem out and down, a leaf for its knob
        knob = hub + V((-0.006, -0.012, 0.022))
        pc.tube([hub, knob], [0.0028, 0.0024], sides=4, tip=False, cap=True)
        leaf(pc, knob, V((0, 0.15, 1)), 0.03, 0.0095, side=V((-1, 0, 0)), curl=0.003, lobes=(0.55, 1.0, 0.8, 0.3), thick=0.002, sides=3)
        pc.mat = "Grip"                          # the line, from the drum to the eye
        pc.tube([RC + V((0, 0.024, 0.008)), V((0, -0.004, F(0.987)))], [0.0009, 0.0009], sides=3, tip=False, cap=False)
    rod = model("rod-carrot", {"Carrot": "#EE7A2A", "Band": "#F4D27E", "Grip": "#F3D4B2", "Leaf": "#64A23A", "Gold": "#D9A43E"}, b)
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
    if tris(rod) > 1500 or len(rod.data.materials) > 5:
        print(f"OVER BUDGET {name}")
    if fx:
        soft_lights(fx)
        export(fx, os.path.join(PROPS, f"rodfx-{name}.glb"), fx_extras)
        print(f"MODEL props/rodfx-{name} tris={sum(tris(o) for o in fx)} meshes={sum(o.type == 'MESH' for o in fx)}")
    for o in [rod] + list(fx):
        bpy.data.objects.remove(o)
