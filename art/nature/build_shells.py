"""The beach forage shells (the four the roster names, lib/collections/roster.ts), in place of the dump's:

  asari     Asari Clam: a closed oval clam lying on one valve, fine growth rings, fawn with brown rays
  scallop   Scallop Shell: a ribbed fan with its two ears at the hinge, coral orange to cream in growth bands
  turban    Turban Shell: a short heavy spiral with a row of rounded knobs on the shoulder, olive brown with pale bands
  whelk     Whelk Shell: a tall spiral with a long canal, cream with brown spiral bands

The clams are one closed lens (a top and a bottom surface over the same outline). The spirals are a tube swept up a
logarithmic helix, its whorls overlapping into one closed skin. Smooth normals, one primitive each.

Texture (game/remodel-r2; David, 2026-10-16: "I like the 3d design but it lacks the texture of the old shells. better
mimic the texture"): each shell wears its own painted texture (numpy, seeded; nothing copied) in the old shells'
manner: the clam's tented zig-zags, blotches and growth lines; the scallop's orange growth bands over its ribs, paler
grooves and a speckled mantle rim; the turban's maroon and olive mottle, pale speckle, growth ridges and its pearly
mouth with the spiral door; the whelk's cream and gold with brown spiral bands, axial streaks and speckle. The clams
are mapped flat from above (the top valve in the left half of the image, the bottom in the right); the spirals along
their sweep and round the tube, with the mouth and the knobs in their own corner. COLOR_0 keeps only the shading
(ambient occlusion), so the texture carries every colour.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/nature/build_shells.py [-- preview <png>]

Writes web/public/assets/game/forage/shell-<name>.glb in game units, lying on the sand (y 0), sized to the shells
they replace.
"""
import math, os, sys
import numpy as np
import bmesh, bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "props"))
import nature_kit as K  # noqa: E402
import propkit as P  # noqa: E402  (the numpy texture painters and Mat)
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
    R, d, amax, ribs_n, per = 0.15, 0.62, math.radians(72), 13, 2
    H, Hb, A = 0.034, 0.012, 0.0085
    ncol = ribs_n * per
    nrow = 5
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
    for sx in (-1, 1):
        K.uv_sphere(bm, (sx * 0.05, -0.006, 0.004), (0.036, 0.022, 0.01), segs=10, rings=5)
    ob = K.to_object(bm, "shell-scallop")
    K.shade_smooth(ob)
    frame = uv_planar(ob)
    paint_ao(ob, 0.7, 0.3, dist=0.04, seed=2)
    tex = scallop_tex(frame, dict(R=R, d=d, amax=amax, ribs_n=ribs_n))
    # Lying with its hinge toward the back (+game z is front): the fan opens toward the camera.
    lay(ob, (0, 0, math.pi))
    return ob, tex


def asari():
    def outline(phi):
        # An oval, a little pointed at the umbo end (+y).
        return 1 / math.sqrt((math.cos(phi) / 0.115) ** 2 + (math.sin(phi) / 0.088) ** 2) * (1 + 0.08 * max(0, math.sin(phi)) ** 4)

    def rings(rho):
        return 0.0016 * math.sin(rho * 46)
    ob, info = lens("shell-asari", outline, lambda rho: 0.038 * (1 - rho ** 2.0) + 0.003, lambda rho: 0.026 * (1 - rho ** 2.2), None, rings, nr=5, nphi=28)
    return ob, info, outline


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
    ring_of, knob_uv = {}, {}
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
            ring_of[len(bm.verts) - 1] = i
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
    for k, v in enumerate(rings[-1]):
        info[v.index] = (turns, math.tau * k / sides, 1)
    apex_i, mouth_i = apex.index, mouth.index
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
                # The knob's corner of the texture: its tip at the middle, its foot round the edge.
                h = (v.co.z + spike_r * g * 0.6) / (spike_r * g * 2.3)
                ang = math.atan2(v.co.y, v.co.x)
                knob_uv[v] = (KNOB[0] + KNOB[2] * (1 - h) * math.cos(ang), KNOB[1] + KNOB[2] * (1 - h) * math.sin(ang))
                v.co = c + q @ v.co
            for vi in range(v0, len(bm.verts)):
                info[vi] = (t, 0.0, 2)
    bm.verts.index_update()
    uv_spiral(bm, info, ring_of, {v.index: uv for v, uv in knob_uv.items()}, len(centres), apex_i, mouth_i)
    ob = K.to_object(bm, name)
    K.shade_smooth(ob)
    info["end"], info["facing"] = end.copy(), (end - centres[-2][0]).normalized()
    return ob, info


# ================================================================ texture coordinates
KNOB = (0.875, 0.25, 0.1)       # the knobs' corner of a spiral's texture: centre u, v and radius
MOUTH = (0.875, 0.75, 0.11)     # the mouth's (aperture and its door)
SWEEP = 0.75                    # the shell itself: u 0..SWEEP along the sweep, v round the tube


def uv_planar(ob):
    """A clam from above: the top valve's faces (normal up) in the left half of the image, the bottom's in the right,
    each half square on the shell's own frame. Returns the frame (centre x, y and half size) for the painter."""
    me = ob.data
    xs, ys = [v.co.x for v in me.vertices], [v.co.y for v in me.vertices]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    S = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 * 1.02
    uv = me.uv_layers.new(name="UVMap")
    for p in me.polygons:
        half = 0.5 if p.normal.z < 0 else 0.0
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (half + 0.25 + (co.x - cx) / S * 0.25, 0.5 + (co.y - cy) / S * 0.5)
    return cx, cy, S


def uv_spiral(bm, info, ring_of, knob_uv, n_rings, apex_i, mouth_i):
    """A spiral: the tube along its sweep (u, by ring) and round it (v, by its angle; a face across the seam carries on
    past 1, the texture repeats there), the apex fan and the mouth in their corners, the knobs in theirs."""
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        ids = [v.index for v in f.verts]
        if all(i in knob_uv for i in ids):
            for lp in f.loops:
                lp[uvl].uv = knob_uv[lp.vert.index]
            continue
        if mouth_i in ids:
            for lp in f.loops:
                i = lp.vert.index
                if i == mouth_i:
                    lp[uvl].uv = MOUTH[:2]
                else:
                    a = info[i][1]
                    lp[uvl].uv = (MOUTH[0] + MOUTH[2] * math.cos(a), MOUTH[1] + MOUTH[2] * math.sin(a))
            continue
        us = [(SWEEP * ring_of[i] / (n_rings - 1)) if i in ring_of else 0.0 for i in ids]
        vs = [info[i][1] / math.tau if i in ring_of else None for i in ids]
        known = [v for v in vs if v is not None]
        if known and max(known) - min(known) > 0.5:
            vs = [None if v is None else (v + 1 if v < 0.5 else v) for v in vs]
            known = [v for v in vs if v is not None]
        mid = sum(known) / len(known) if known else 0.5
        for lp, u, v in zip(f.loops, us, vs):
            lp[uvl].uv = (u, mid if v is None else v)


def paint_ao(ob, lo, span, dist, seed, power=1.0):
    """COLOR_0: shading only, ambient occlusion from ray casts (grey; the texture carries the colour)."""
    ao = K.vertex_ao(ob, samples=24, dist=dist, seed=seed)
    K.paint(ob, lambda vi, _p: np.array([1.0, 1.0, 1.0]) * (lo + span * ao[vi] ** power))


# ================================================================ painted textures (numpy, sRGB, row 0 at the top)
def mix(a, b, t):
    t = np.asarray(t)[..., None]
    return a * (1 - t) + b * t


def speckle(h, w, cells, seed, thresh):
    """Small dots: a fine noise kept only at its peaks."""
    return P.smooth(thresh, thresh + 0.06, P.noise(h, w, cells, seed))


def clam_frame(h, w, frame):
    """Shell-plane x, y for every pixel of a clam's image, and which half (0 the top valve, 1 the bottom)."""
    cx, cy, S = frame
    U, V = P.grid(h, w)
    half = (U >= 0.5).astype(float)
    x = cx + ((U - 0.5 * half) - 0.25) / 0.25 * S
    y = cy + ((1 - V) - 0.5) / 0.5 * S
    return x, y, half


def asari_tex(frame):
    """The asari's: concentric bands of charcoal and umber over a cream ground, the light bands broken into tented
    zig-zags, dark blotches, fine growth lines, a pale ray or two, a violet-brown umbo and the brown seam where the valves
    meet; the bottom valve in another throw of the same."""
    h, w = 128, 256
    x, y, half = clam_frame(h, w, frame)
    phi = np.arctan2(y, x)
    o = 1 / np.sqrt((np.cos(phi) / 0.115) ** 2 + (np.sin(phi) / 0.088) ** 2) * (1 + 0.08 * np.maximum(0, np.sin(phi)) ** 4)
    rho = np.hypot(x, y) / o
    wob = 0.06 * (P.fbm(h, w, 5, 23, 2) - 0.5)
    cream = mix(P.arr("#f1e8d6"), P.arr("#d8cbb0"), P.fbm(h, w, 5, 21, 3))
    ink = mix(P.arr("#37312d"), P.arr("#5e4b3e"), P.fbm(h, w, 4, 51, 2))
    # Bands round the shell: dark ones and light ones, the light ones' edges toothed into tents.
    teeth = 0.07 * np.abs(((phi / math.tau * 34) % 1) - 0.5) * 2
    band = 0.5 + 0.5 * np.sin((rho + wob + teeth) * math.tau * 3.4 + 0.8 + 2.2 * half)
    dark = P.smooth(0.42, 0.62, band)
    # Tents inside the light bands: thin dark chevrons.
    zz = np.abs(((rho * 11 + 1.6 * np.abs(((phi / math.tau * 30) % 1) - 0.5)) % 1) - 0.5)
    tents = P.smooth(0.13, 0.07, zz) * (1 - dark)
    blot = P.smooth(0.6, 0.7, P.fbm(h, w, 8, 41 + 5 * int(half.max()), 3))
    out = mix(cream, ink, np.clip(dark * 0.88 + tents * 0.8 + blot * 0.6, 0, 1))
    a = np.arctan2(y - 0.09, x)
    out = mix(out, P.arr("#efe7da"), 0.35 * P.smooth(0.9, 0.98, np.cos(a * 3 + 0.4)) * P.smooth(0.25, 0.55, rho))
    out = mix(out, P.arr("#7e6460"), 0.6 * P.smooth(0.3, 0.0, np.hypot(x, y - 0.075) / 0.1))
    lines = P.smooth(0.82, 0.97, 0.5 + 0.5 * np.sin(rho * 46 + 0.4 * P.noise(h, w, 8, 61)))
    out = out * (1 - 0.16 * lines[..., None])
    out = mix(out, P.arr("#4e3c30"), P.smooth(0.93, 0.99, rho))
    return np.clip(out, 0, 1)


def scallop_tex(frame, g):
    """The scallop's: rust and burnt orange in soft growth bands with a cream band now and then, the ribs lit along
    their crests and shaded in the grooves, fine striations and specks; the rim a salmon mantle line with small blue
    eyes, as the old one shows; the bottom valve paler, cream and peach."""
    h, w = 128, 256
    x, y, half = clam_frame(h, w, frame)
    R, d, amax, n = g["R"], g["d"], g["amax"], g["ribs_n"]
    al = np.clip(np.arctan2(x, y), -amax, amax)
    c = d * R
    reach = c * np.cos(al) + np.sqrt(np.maximum(R * R - (c * np.sin(al)) ** 2, 1e-9))
    u = np.hypot(x, y) / reach
    rib = 0.5 + 0.5 * np.cos(math.tau * n * (al + amax) / (2 * amax))
    jitter = 0.5 * (P.noise(h, w, 6, 71) - 0.5)
    band = 0.5 + 0.5 * np.sin(u * 11 + jitter * 3)
    top = mix(P.arr("#c9612e"), P.arr("#94401f"), P.smooth(0.25, 0.85, band) * (0.6 + 0.4 * P.fbm(h, w, 6, 73, 2)))
    cream = P.smooth(0.86, 0.97, 0.5 + 0.5 * np.sin(u * 23 + 1.3 + jitter * 5)) * P.smooth(0.25, 0.4, u)
    top = mix(top, P.arr("#efc79a"), 0.7 * cream)
    top = top * (0.74 + 0.36 * rib ** 1.5)[..., None]
    stri = 0.5 + 0.5 * np.sin(al * n * 6 + 0.6)
    top = top * (0.95 + 0.06 * stri)[..., None]
    top = top * (1 - 0.22 * speckle(h, w, 70, 81, 0.82))[..., None]
    top = mix(top, P.arr("#d98c5a"), 0.4 * P.smooth(0.2, 0.0, u))
    bot = mix(P.arr("#f1d8bd"), P.arr("#e2a077"), 0.4 * band + 0.25 * rib)
    out = mix(top, bot, half)
    rim = P.smooth(0.9, 0.97, u)
    eyes = P.smooth(0.55, 0.25, np.abs(((al + amax) / (2 * amax) * 40) % 1 - 0.5) * 2) * P.smooth(0.93, 0.97, u) * P.smooth(1.02, 0.98, u)
    out = mix(out, P.arr("#e08a72"), 0.7 * rim)
    out = mix(out, P.arr("#3f7fb5"), 0.85 * eyes)
    return np.clip(out, 0, 1)


def spiral_uv_grid(h, w):
    """Along the sweep (s 0 apex .. 1 mouth) and round the tube (r 0..1) for the sweep part of a spiral's image."""
    U, V = P.grid(h, w)
    return U / SWEEP, 1 - V, U, V


def corner(U, V, spot):
    """Polar coordinates in a corner disc (radius 1 at its edge)."""
    cu, cv, rr = spot
    du, dv = (U - cu) / rr, ((1 - V) - cv) / rr
    return np.hypot(du, dv), np.arctan2(dv, du)


def turban_tex():
    """The turban's: dark maroon and brown, mottled through with olive green, pale specks, growth ridges across the
    whorls and spiral cords round them; its mouth pearly, round a peach spiral door; the knobs as dark as the shell."""
    h = w = 256
    s, r, U, V = spiral_uv_grid(h, w)
    base = mix(P.arr("#4f2526"), P.arr("#6a4630"), P.fbm(h, w, 7, 91, 3))
    olive = P.smooth(0.5, 0.66, P.fbm(h, w, 18, 93, 3))
    out = mix(base, P.arr("#6e7a43"), 0.7 * olive)
    ridges = 0.5 + 0.5 * np.sin(math.tau * U * 64 + 1.5 * P.noise(h, w, 12, 95))
    cords = 0.5 + 0.5 * np.sin(math.tau * V * 7)
    out = out * (0.82 + 0.16 * ridges + 0.1 * cords)[..., None]
    out = mix(out, P.arr("#e2d5bb"), 0.8 * speckle(h, w, 120, 97, 0.86))
    out = mix(out, P.arr("#b9a585"), P.smooth(0.1, 0.0, s))           # the worn apex
    rad, ang = corner(U, V, MOUTH)
    swirl = 0.5 + 0.5 * np.sin(ang + rad * 11)
    mouth = mix(P.arr("#f4ede2"), P.arr("#e8b58c"), P.smooth(0.9, 0.2, rad) * (0.4 + 0.6 * swirl))
    mouth = mix(mouth, P.arr("#b9714a"), 0.5 * P.smooth(0.85, 0.95, swirl) * P.smooth(0.85, 0.3, rad))
    out = np.where((rad <= 1.15)[..., None], mouth, out)
    krad, _ = corner(U, V, KNOB)
    knob = mix(P.arr("#8a6a52"), P.arr("#4a2524"), P.smooth(0.1, 0.5, krad))
    out = np.where((krad <= 1.15)[..., None], knob, out)
    return np.clip(out, 0, 1)


def whelk_tex():
    """The whelk's: gold to tawny, warm brown spiral bands round the whorls (one broad, two fine), axial growth streaks
    and a fine brown speckle, the canal end freckled darker; its mouth glossy peach going cream at the lip."""
    h = w = 256
    s, r, U, V = spiral_uv_grid(h, w)
    out = mix(P.arr("#e8c88a"), P.arr("#c48a45"), 0.55 * P.fbm(h, w, 5, 101, 3) + 0.3 * s)
    wav = 0.04 * P.noise(h, w, 10, 103)
    vv = (V + wav) % 1
    bands = (P.smooth(0.09, 0.04, np.abs(vv - 0.32)) * 0.9
             + P.smooth(0.03, 0.01, np.abs(vv - 0.6)) * 0.8
             + P.smooth(0.03, 0.01, np.abs(vv - 0.78)) * 0.75
             + P.smooth(0.05, 0.02, np.abs(vv - 0.05)) * 0.6)
    out = mix(out, P.arr("#7a4423"), np.clip(bands, 0, 1) * (0.75 + 0.25 * P.noise(h, w, 16, 105)))
    streak = 0.5 + 0.5 * np.sin(math.tau * U * 90 + 2.0 * P.noise(h, w, 14, 107))
    out = out * (0.88 + 0.14 * streak)[..., None]
    out = mix(out, P.arr("#6d4428"), 0.6 * speckle(h, w, 110, 109, 0.86))
    out = mix(out, P.arr("#2f2622"), 0.65 * speckle(h, w, 64, 111, 0.78) * P.smooth(0.86, 1.0, s))
    out = mix(out, P.arr("#f1e3c6"), P.smooth(0.1, 0.0, s))
    rad, ang = corner(U, V, MOUTH)
    mouth = mix(P.arr("#f0b98d"), P.arr("#fbefdc"), P.smooth(0.3, 1.0, rad))
    out = np.where((rad <= 1.15)[..., None], mouth, out)
    krad, _ = corner(U, V, KNOB)
    out = np.where((krad <= 1.15)[..., None], P.arr("#d9b67a"), out)
    return np.clip(out, 0, 1)


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
    ob, info = spiral("shell-turban", turns=3.4, r0=0.01, growth=math.log(2.1), rise=0.0085, tube=0.0074, spikes=7, spike_r=0.0026, per_turn=10, sides=10, seed=3)
    paint_ao(ob, 0.62, 0.38, dist=0.05, seed=3, power=1.3)
    tex = turban_tex()
    # Resting on its body whorl: the spire up and a little over, the mouth to the side.
    lay(ob, (math.radians(18), math.radians(-10), math.radians(30)), size=0.32)
    return ob, tex


def whelk():
    ob, info = spiral("shell-whelk", turns=4.4, r0=0.006, growth=math.log(1.75), rise=0.012, tube=0.0047, canal=0.045, per_turn=10, sides=10, seed=5)
    paint_ao(ob, 0.62, 0.38, dist=0.05, seed=5, power=1.3)
    tex = whelk_tex()
    # On its side: the spire across the view, a little raised off the sand.
    lay(ob, (0, math.radians(78), math.radians(8)), size=0.36)
    return ob, tex


def build_all():
    out = []
    sc, tex = scallop()
    K.ground_at_zero(sc, 0.004)
    out.append((sc, tex))
    ob, _info, _outline = asari()
    frame = uv_planar(ob)
    paint_ao(ob, 0.7, 0.3, dist=0.05, seed=2)
    K.ground_at_zero(ob, 0.004)
    out.append((ob, asari_tex(frame)))
    out.append(turban())
    out.append(whelk())
    for ob, tex in out:
        mat = P.Mat(f"M_{ob.name.replace('-', '_').title()}", tex=P.image(f"{ob.name}_tex", tex), rough=0.72).m
        K.set_material(ob, mat)
        export(ob, os.path.join(OUT, f"{ob.name}.glb"))
    return [o for o, _ in out]


def export(ob, path):
    """As nature_kit.export, with the texture coordinates and the painted texture (JPEG)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    K.activate(ob)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_texcoords=True, export_vertex_color="ACTIVE", export_skins=False, export_animations=False,
                              export_materials="EXPORT", export_apply=True, export_image_format="JPEG", export_jpeg_quality=88)
    vs = ob.data.vertices
    print(f"MODEL {os.path.relpath(path, K.ROOT)} tris={K.tri_count(ob)} verts={len(vs)} bytes={os.path.getsize(path)}")


if __name__ == "__main__":
    K.reset()
    built = build_all()
    if "preview" in ARGS:
        K.preview(built, ARGS[ARGS.index("preview") + 1], cols=4, spacing=0.5, lens=70)
