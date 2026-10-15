"""The beach forage shells (the four the roster names, lib/collections/roster.ts), in place of the dump's:

  asari     Asari Clam: a closed oval clam lying on one valve, fine growth rings, fawn with brown rays
  scallop   Scallop Shell: a ribbed fan with its two ears at the hinge, coral orange to cream in growth bands
  turban    Turban Shell: a short heavy spiral with a row of rounded knobs on the shoulder, olive brown with pale bands
  whelk     Whelk Shell: a tall spiral with a long canal, cream with brown spiral bands

The clams are one closed lens (a top and a bottom surface over the same outline). The spirals are a tube swept up a
logarithmic helix, its whorls fused into one closed skin (a voxel remesh, softened, decimated). Smooth normals, one
matte vertex-coloured material: one primitive each. `spiral()` also gives the hermit crab its shell (build_crabs.py).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/nature/build_shells.py [-- preview <png>]

Writes web/public/assets/game/forage/shell-<name>.glb in game units, lying on the sand (y 0), sized to the shells
they replace.
"""
import math, os, sys
import numpy as np
import bmesh, bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nature_kit as K  # noqa: E402
from nature_kit import lin, smooth  # noqa: E402

OUT = os.path.join(K.ASSETS, "forage")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


# ================================================================ clams: a closed lens over an outline
def lens(name, outline, top_h, bot_h, ribs=None, rings=None, nr=9, nphi=40, hinge=(0.0, -1.0)):
    """outline(phi) -> radius; top_h/bot_h(rho) -> heights over/under the rim (rho 0 centre .. 1 rim); ribs(x, y) and
    rings(rho) add relief to the top. Returns the object and per-vertex (rho, phi, top?)."""
    bm = bmesh.new()
    info = []
    rim = []
    rows_top, rows_bot = [], []
    for k in range(1, nr + 1):
        rho = k / nr
        row_t, row_b = [], []
        for j in range(nphi):
            phi = math.tau * j / nphi
            r = outline(phi) * rho
            x, y = math.cos(phi) * r, math.sin(phi) * r
            if k == nr:
                v = bm.verts.new((x, y, 0.0))
                info.append((rho, phi, 0))
                row_t.append(v)
                row_b.append(v)
                continue
            zt = top_h(rho) + (ribs(x, y, rho) if ribs else 0.0) + (rings(rho) if rings else 0.0)
            vt = bm.verts.new((x, y, zt))
            info.append((rho, phi, 1))
            vb = bm.verts.new((x, y, -bot_h(rho)))
            info.append((rho, phi, -1))
            row_t.append(vt)
            row_b.append(vb)
        rows_top.append(row_t)
        rows_bot.append(row_b)
    ct = bm.verts.new((0, 0, top_h(0.0)))
    info.append((0.0, 0.0, 1))
    cb = bm.verts.new((0, 0, -bot_h(0.0)))
    info.append((0.0, 0.0, -1))
    for rows, c, flip in ((rows_top, ct, False), (rows_bot, cb, True)):
        for j in range(nphi):
            f = [c, rows[0][j], rows[0][(j + 1) % nphi]]
            bm.faces.new(f[::-1] if flip else f)
        for a, b in zip(rows[:-1], rows[1:]):
            for j in range(nphi):
                f = [a[j], b[j], b[(j + 1) % nphi], a[(j + 1) % nphi]]
                bm.faces.new(f[::-1] if flip else f)
    ob = K.to_object(bm, name)
    K.shade_smooth(ob)
    return ob, info


def polygon_outline(pts):
    """outline(phi) for a polygon star-shaped about the origin: the distance to its edge along phi."""
    def outline(phi):
        d = Vector((math.cos(phi), math.sin(phi)))
        best = None
        for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
            e = Vector((bx - ax, by - ay))
            den = d.x * e.y - d.y * e.x
            if abs(den) < 1e-12:
                continue
            t = (ax * e.y - ay * e.x) / den
            u = (ax * d.y - ay * d.x) / den
            if t > 0 and -1e-9 <= u <= 1 + 1e-9:
                best = t if best is None else min(best, t)
        return best
    return outline


def scallop():
    """A fan from the umbo: columns follow the ribs (three per rib, so every rib is a crisp round ridge), rows run out
    to the rim; a top and a bottom surface meet all round the edge. Two ears at the hinge, small closed lenses."""
    R, d, amax, ribs_n, per = 0.15, 0.62, math.radians(72), 13, 3
    H, Hb, A = 0.034, 0.012, 0.0085
    ncol = ribs_n * per
    nrow = 6
    bm = bmesh.new()
    info = {}

    def reach(al):
        # The rim along al from the umbo: a circle of radius R whose centre sits d*R above the umbo.
        c = d * R
        return c * math.cos(al) + math.sqrt(R * R - (c * math.sin(al)) ** 2)

    def at(u, al, side):
        x, y = math.sin(al) * reach(al) * u, math.cos(al) * reach(al) * u
        edge = (1 - (al / amax) ** 6) ** 0.5
        bulge = math.sin(math.pi * min(1.0, u) ** 0.75) * edge
        rib = 0.5 + 0.5 * math.cos(math.tau * ribs_n * (al + amax) / (2 * amax))
        if side > 0:
            return Vector((x, y, H * bulge + A * rib * smooth(0.1, 0.55, u) * bulge ** 0.3))
        return Vector((x, y, -Hb * bulge))

    umbo = bm.verts.new((0, 0, 0))
    info[0] = (0.0, 0.0, 0)
    grid = {1: [], -1: []}
    for side in (1, -1):
        for i in range(1, nrow + 1):
            u = i / nrow
            row = []
            for j in range(ncol + 1):
                al = -amax + 2 * amax * j / ncol
                edge = i == nrow or j in (0, ncol)
                if edge and side == -1:
                    row.append(grid[1][i - 1][j])
                    continue
                v = bm.verts.new(at(u, al, side) if not edge else Vector((at(u, al, 1).x, at(u, al, 1).y, 0.0)))
                info[len(bm.verts) - 1] = (u, al, side if not edge else 0)
                row.append(v)
            grid[side].append(row)
    for side in (1, -1):
        g = grid[side]
        for j in range(ncol):
            f = [umbo, g[0][j + 1], g[0][j]]
            bm.faces.new(f if side > 0 else f[::-1])
        for i in range(nrow - 1):
            for j in range(ncol):
                f = [g[i][j], g[i][j + 1], g[i + 1][j + 1], g[i + 1][j]]
                bm.faces.new(f if side > 0 else f[::-1])
    bm.verts.index_update()
    ear0 = len(bm.verts)
    for sx in (-1, 1):
        fs = K.uv_sphere(bm, (sx * 0.05, -0.006, 0.004), (0.036, 0.022, 0.01), segs=10, rings=5)
    ob = K.to_object(bm, "shell-scallop")
    K.shade_smooth(ob)
    me = ob.data
    ao = K.vertex_ao(ob, samples=24, dist=0.04, seed=2)
    vcols = []
    for v in me.vertices:
        u, al, side = info.get(v.index, (0.1, 0.0, 1))
        rib = 0.5 + 0.5 * math.cos(math.tau * ribs_n * (al + amax) / (2 * amax))
        band = 0.5 + 0.5 * math.sin(u * 15 + 0.6)
        c = K.mixc(lin("#e27a45"), lin("#f6d2a8"), 0.3 * band + 0.45 * smooth(0.55, 1.0, u))
        c = c * (0.86 + 0.2 * rib)
        if side < 0:
            c = K.mixc(lin("#f4dfc8"), lin("#e8a77c"), 0.35 * band)
        if v.index >= ear0:
            c = lin("#e9955e")
        vcols.append(c * (0.7 + 0.3 * ao[v.index]))
    K.paint(ob, lambda vi, _p: vcols[vi])
    # Lying with its hinge toward the back (+game z is front): the fan opens toward the camera.
    lay(ob, (0, 0, math.pi))
    return ob


def asari():
    def outline(phi):
        # An oval, a little pointed at the umbo end (+y).
        return 1 / math.sqrt((math.cos(phi) / 0.115) ** 2 + (math.sin(phi) / 0.088) ** 2) * (1 + 0.08 * max(0, math.sin(phi)) ** 4)

    def rings(rho):
        return 0.0016 * math.sin(rho * 46)
    ob, info = lens("shell-asari", outline, lambda rho: 0.038 * (1 - rho ** 2.0) + 0.003, lambda rho: 0.026 * (1 - rho ** 2.2), None, rings, nr=6, nphi=32)
    return ob, info, outline


def paint_clam(ob, info, kind):
    me = ob.data
    ao = K.vertex_ao(ob, samples=24, dist=0.05, seed=2)
    vcols = []
    for v in me.vertices:
        rho, phi, side = info[v.index]
        x, y = v.co.x, v.co.y
        if kind == "scallop":
            band = 0.5 + 0.5 * math.sin(rho * 16 + 0.7)
            c = K.mixc(lin("#e9864f"), lin("#f6d2a8"), 0.35 * band + 0.35 * smooth(0.6, 1.0, rho))
            a = math.atan2(y + 0.093, x)
            c = c * (0.88 + 0.16 * (0.5 + 0.5 * math.cos(a * 17)))
            if side < 0:
                c = K.mixc(lin("#f3dcc4"), lin("#e3a57d"), 0.4 * band)
        else:
            a = math.atan2(y - 0.09, x)
            ray = smooth(0.55, 0.9, 0.5 + 0.5 * math.sin(a * 9 + 1.3))
            band = smooth(0.4, 0.9, 0.5 + 0.5 * math.sin(rho * 13))
            c = K.mixc(lin("#d8c3a0"), lin("#8a6648"), 0.55 * ray + 0.25 * band)
            c = K.mixc(c, lin("#6e5a4a"), 0.5 * smooth(0.35, 0.0, rho)) if side > 0 else c
            if side < 0:
                c = c * 0.92
            if side == 0:
                # The seam where the two valves meet.
                c = lin("#5a4636")
        c = c * (0.7 + 0.3 * ao[v.index])
        vcols.append(c)
    K.paint(ob, lambda vi, _p: vcols[vi])


# ================================================================ spirals: a tube swept up a logarithmic helix
def spiral(name, turns, r0, growth, rise, tube, spikes=0, spike_r=0.0, canal=0.0, per_turn=14, sides=10, seed=0):
    """A spiral shell, apex at the origin, coiling down its -z axis as it grows: one closed tube swept up a
    logarithmic helix (its whorls overlap, so the sutures read where they cut), the apex closed in a point, the
    aperture capped. Returns (object, per-vertex (t, around, part)): part 0 the shell, 1 the aperture face, 2 a knob."""
    bm = bmesh.new()
    info = {}
    n = int(turns * per_turn)
    rings = []
    rng = np.random.default_rng(seed)
    centres = []
    for i in range(n + 1):
        t = i / n * turns
        th = t * math.tau
        g = math.exp(growth * t)
        rr = r0 * g
        centres.append((Vector((math.cos(th) * rr, math.sin(th) * rr, -rise * (g - 1))), t, tube * g, th))
    if canal:
        p0, t0, s0, th0 = centres[-1]
        for k in range(1, 5):
            centres.append((p0 + Vector((0, 0, -canal * k / 4)), turns, s0 * (1 - 0.2 * k), th0))
    for i, (p, t, sct, th) in enumerate(centres):
        # The section: in the plane of the radius and the axis, so it turns with the coil.
        radial = Vector((math.cos(th), math.sin(th), 0))
        axis = Vector((0, 0, 1))
        ring = []
        for k in range(sides):
            a = math.tau * k / sides
            q = p + (radial * math.cos(a) + axis * math.sin(a)) * sct
            ring.append(bm.verts.new(q))
            info[len(bm.verts) - 1] = (t, a, 0)
        rings.append(ring)
    apex = bm.verts.new(centres[0][0] + Vector((0, 0, tube * 1.2)))
    info[len(bm.verts) - 1] = (0.0, 0.0, 0)
    for k in range(sides):
        bm.faces.new([rings[0][(k + 1) % sides], rings[0][k], apex])
    for a_, b_ in zip(rings[:-1], rings[1:]):
        for k in range(sides):
            bm.faces.new([a_[k], a_[(k + 1) % sides], b_[(k + 1) % sides], b_[k]])
    end = centres[-1][0]
    mouth = bm.verts.new(end + (end - centres[-2][0]).normalized() * centres[-1][2] * 0.04)
    info[len(bm.verts) - 1] = (turns, 0.0, 1)
    for k in range(sides):
        bm.faces.new([rings[-1][k], rings[-1][(k + 1) % sides], mouth])
    bm.verts.index_update()
    for v in rings[-1]:
        info[v.index] = (turns, 0.0, 1)
    if spikes:
        # Rounded knobs on the last whorl's shoulder.
        for k in range(spikes):
            t = turns - 0.95 + (k + 0.5) / spikes * 0.9
            th = t * math.tau
            g = math.exp(growth * t)
            rr, sct = r0 * g, tube * g
            out = Vector((math.cos(th), math.sin(th), 0.55)).normalized()
            c = Vector((math.cos(th) * rr, math.sin(th) * rr, -rise * (g - 1))) + out * sct * 0.95
            q = Vector((0, 0, 1)).rotation_difference(out)
            v0 = len(bm.verts)
            fs = K.lathe(bm, [(0, -spike_r * g * 0.6), (spike_r * g, 0), (spike_r * g * 0.8, spike_r * g * 0.9), (spike_r * g * 0.4, spike_r * g * 1.5), (0, spike_r * g * 1.7)], n=8)
            for v in {v for f in fs for v in f.verts}:
                v.co = c + q @ v.co
            for vi in range(v0, len(bm.verts)):
                info[vi] = (t, 0.0, 2)
    ob = K.to_object(bm, name)
    K.shade_smooth(ob)
    # Where the mouth is and which way it faces (the hermit crab sits in it).
    info["end"], info["facing"] = end.copy(), (end - centres[-2][0]).normalized()
    return ob, info


def paint_spiral(ob, info, turns, base, band, band_n, apex, mouth, seed=0):
    """Spiral bands along the sweep and round it, the apex worn pale, the aperture its mouth colour."""
    me = ob.data
    ao = K.vertex_ao(ob, samples=28, dist=0.05, seed=seed)
    vcols = []
    for v in me.vertices:
        t, a, part = info.get(v.index, (0.0, 0.0, 0))
        if part == 1 and mouth:
            c = lin(mouth)
        else:
            stripe = smooth(0.35, 0.7, 0.5 + 0.5 * math.sin(a * band_n + 0.8))
            c = K.mixc(lin(base), lin(band), 0.8 * stripe)
            c = c * (0.92 + 0.12 * (0.5 + 0.5 * math.sin(t * 22)))
            c = K.mixc(c, lin(apex), smooth(1.2, 0.0, t))
            if part == 2:
                c = K.mixc(lin(base), lin(apex), 0.35)
        c = c * (1.0 + 0.06 * K.noise3(v.co, 70.0, seed))
        vcols.append(c * (0.62 + 0.38 * ao[v.index] ** 1.3))
    K.paint(ob, lambda vi, _p: vcols[vi])


def lay(ob, rot, size=None):
    """Turn a model to lie as it would on the sand, fit its longest side to `size`, and set it on y 0 centred."""
    me = ob.data
    m = Euler(rot).to_matrix()
    for v in me.vertices:
        v.co = m @ v.co
    xs, ys, zs = [v.co.x for v in me.vertices], [v.co.y for v in me.vertices], [v.co.z for v in me.vertices]
    k = size / max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)) if size else 1.0
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    for v in me.vertices:
        v.co = Vector(((v.co.x - cx) * k, (v.co.y - cy) * k, (v.co.z - min(zs)) * k))
    me.update()


def turban():
    ob, info = spiral("shell-turban", turns=3.4, r0=0.01, growth=math.log(2.1), rise=0.0085, tube=0.0074, spikes=7, spike_r=0.0026, per_turn=12, sides=12, seed=3)
    paint_spiral(ob, info, 3.4, "#776d44", "#cdbf96", 3, "#d9cfb6", "#e2d5bd", seed=3)
    # Resting on its body whorl: the spire up and a little over, the mouth to the side.
    lay(ob, (math.radians(18), math.radians(-10), math.radians(30)), size=0.32)
    return ob


def whelk():
    ob, info = spiral("shell-whelk", turns=4.4, r0=0.006, growth=math.log(1.75), rise=0.012, tube=0.0047, canal=0.045, per_turn=12, sides=12, seed=5)
    paint_spiral(ob, info, 4.4, "#ead9b6", "#9a6a3e", 4, "#f2e6cf", "#f4c9a6", seed=5)
    # On its side: the spire across the view, a little raised off the sand.
    lay(ob, (0, math.radians(78), math.radians(8)), size=0.36)
    return ob


def build_all():
    out = []
    sc = scallop()
    K.ground_at_zero(sc, 0.004)
    out.append(sc)
    ob, info, _ = asari()
    paint_clam(ob, info, "asari")
    K.ground_at_zero(ob, 0.004)
    out.append(ob)
    out.append(turban())
    out.append(whelk())
    for ob in out:
        K.set_material(ob, K.vc_material("shell"))
        K.export(ob, os.path.join(OUT, f"{ob.name}.glb"))
    return out


if __name__ == "__main__":
    K.reset()
    built = build_all()
    if "preview" in ARGS:
        K.preview(built, ARGS[ARGS.index("preview") + 1], cols=4, spacing=0.5, lens=70)
