"""The TSI lanyard (specs/merch/tsi-lanyard.md), from David's photo (references/merch/tsi-lanyard/2026-10-18-lanyard-front-
and-back.png) and his print files (packed by art/merch/lanyard_atlas.py into art/merch/lanyard-atlas.png).

  python3 art/merch/lanyard_atlas.py
  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/merch/build_lanyard.py

Writes web/public/assets/game/items/merch-tsi-lanyard.glb. One unit is 10 cm, like the keychain. It hangs at rest from a
peg at the origin (its axis along z, out of the wall), folded over it: the strap's neck over the peg, its two strands
down to the sewn tab, the D-ring through the tab, the swivel snap hook on the D-ring. The outside print faces +z (the
room), the inside print the peg.

The strap: one flat ribbon 0.2 wide and 9.0 long (90 cm by 2 cm), a strip with a front and a back face (the two prints)
and thin navy edges, its thickness tiny. Along it, s runs from one end (the right strand's foot, at the tab) up over the
peg (s = 4.5, the neck) and down the left strand to the other end; the print runs with s, so the right strand reads
upward and the left downward (as in the photo). Over the peg the strap lies edge on (its width along the peg) and each
strand twists a quarter turn below it to face the room.

Nodes (the engine sways them, components/game/Lanyard.tsx):
  lanyard_strap      the strap, the sewn tab's stitching and its fold round the D-ring's bar (origin: the peg)
  lanyard_hardware   the D-ring and the swivel snap hook (origin: the middle of the D-ring's bar, where it hangs)
Materials: M_Lanyard (the print atlas), P_Cloth (the stitching), P_Metal (the hardware).
"""
import math, os, sys
import numpy as np
import bpy
import openvdb as vdb

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402

OUT = "game/items/merch-tsi-lanyard.glb"
SILVER, THREAD = "#8f949a", "#1b2236"
L, W, T = 9.0, 0.2, 0.004          # the strap: length, width, thickness
R_ARC = 0.06                        # the fold over the peg (the peg's radius plus a little)
S_STRAND = (L - math.pi * R_ARC) / 2
TWIST = 0.8                         # the quarter turn below the peg (long enough that the print turns with it, not crumples)
SPLAY = 0.125                       # each strand's centre this far out below the twist: the two hang just apart
CONVERGE, MEET = 3.15, 4.1          # where they start to come together, and where they meet at the tab
ATLAS_ROW, ATLAS = 102, 1024        # lanyard_atlas.py
SIDE_LEN = 45 * ATLAS_ROW
BAR_R = 0.011                       # the D-ring's wire
DROP = S_STRAND                     # the strands' feet, below the peg                     # the strand's foot, below the peg


# ================================================================ the strap's path and frames
def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def strand_x(u):
    """A strand's centre, out from the middle, at u down from the peg's side."""
    if u <= TWIST:
        return R_ARC + (SPLAY - R_ARC) * smooth(0, TWIST, u)
    return SPLAY * (1 - smooth(CONVERGE, MEET, u))


def strand_z(u, side):
    """At the tab the right strand lies in front of the left; at its foot each opens round the D-ring's bar."""
    z = 0.0035 * smooth(CONVERGE - 0.15, CONVERGE + 0.25, u)
    return side * (z + (BAR_R + 0.004 - z) * smooth(DROP - 0.045, DROP, u))


def centre(s):
    """The strap's middle at s (game coordinates), and which way it faces (the outside's normal) before twisting."""
    if s <= S_STRAND:                                   # the right strand, going up
        u = S_STRAND - s
        return np.array([strand_x(u), -u, strand_z(u, 1)]), "right", u
    if s >= L - S_STRAND:                               # the left strand, going down
        u = s - (L - S_STRAND)
        return np.array([-strand_x(u), -u, strand_z(u, -1)]), "left", u
    a = (s - S_STRAND) / R_ARC                          # over the peg, right to left
    return np.array([R_ARC * math.cos(a), R_ARC * math.sin(a), 0.0]), "arc", a


def frame(s, ds=1e-3):
    """Tangent (along s), the outside's normal, and the width (from the U's inner edge to its outer one)."""
    p0, _, _ = centre(max(0.0, s - ds))
    p1, _, _ = centre(min(L, s + ds))
    t = p1 - p0
    t /= np.linalg.norm(t)
    p, part, u = centre(s)
    if part == "arc":
        n = np.array([math.cos(u), math.sin(u), 0.0])  # radially out: the inside lies on the peg
    else:
        radial = np.array([1.0 if part == "right" else -1.0, 0.0, 0.0])
        f = smooth(0.0, TWIST, u)                       # a quarter turn from facing out sideways to facing the room
        n = radial * math.cos(f * math.pi / 2) + np.array([0.0, 0.0, 1.0]) * math.sin(f * math.pi / 2)
    n = n - t * np.dot(n, t)
    n /= np.linalg.norm(n)
    b = np.cross(t, n)
    return p, t, n, b


def atlas_uv(s, across, inside):
    """The print at s (0..L) and `across` (0 at the U's inner edge, 1 at its outer edge), in Blender's UVs (v up).
    The outside's file runs its top edge along the inner edge; the inside's along the outer (David's photo)."""
    x = min(SIDE_LEN - 1e-3, max(0.0, s / L * SIDE_LEN))
    row = min(4, int(x // ATLAS))
    col = x - row * ATLAS
    v_file = (1 - across) if inside else across
    y = ((5 if inside else 0) + row) * ATLAS_ROW + v_file * ATLAS_ROW
    return (col / ATLAS, 1 - y / ATLAS)


def strap(m):
    k = K.Kit("lanyard_strap")
    # samples along s: every 0.04 on the strands, finer over the peg, and every row break of the atlas exactly
    ss = set(np.round(np.linspace(0, S_STRAND, int(S_STRAND / 0.04) + 1), 6))
    ss |= set(np.round(np.linspace(S_STRAND, L - S_STRAND, 9), 6))
    ss |= set(np.round(np.linspace(L - S_STRAND, L, int(S_STRAND / 0.04) + 1), 6))
    ss |= {round(r * ATLAS / SIDE_LEN * L, 6) for r in range(1, 5)}
    ss = sorted(ss)
    edge_uv = (0.5, 1 - 1022 / ATLAS)                   # plain navy, below the rows
    rings = []
    for s in ss:
        p, t, n, b = frame(s)
        a = p - b * W / 2                               # the inner edge
        c = p + b * W / 2                               # the outer edge
        rings.append((s, a + n * T / 2, c + n * T / 2, a - n * T / 2, c - n * T / 2))
    for (s0, a0f, c0f, a0b, c0b), (s1, a1f, c1f, a1b, c1b) in zip(rings, rings[1:]):
        # the atlas row a segment uses: its middle's (a segment that starts a new row starts at that row's column 0)
        mid = (s0 + s1) / 2
        def uv(s, across, inside):
            u_, v_ = atlas_uv(mid, across, inside)
            x0 = mid / L * SIDE_LEN
            row = min(4, int(x0 // ATLAS))
            col = s / L * SIDE_LEN - row * ATLAS
            return (col / ATLAS, v_)
        V = lambda q: k.vert(tuple(q))
        k.face([V(a0f), V(a1f), V(c1f), V(c0f)], [uv(s0, 0, False), uv(s1, 0, False), uv(s1, 1, False), uv(s0, 1, False)], m["print"], "#ffffff")
        k.face([V(c0b), V(c1b), V(a1b), V(a0b)], [uv(s0, 1, True), uv(s1, 1, True), uv(s1, 0, True), uv(s0, 0, True)], m["print"], "#ffffff")
        for e0, e1, e2, e3 in ((a0b, a1b, a1f, a0f), (c0f, c1f, c1b, c0b)):
            k.face([V(e0), V(e1), V(e2), V(e3)], [edge_uv] * 4, m["print"], "#ffffff")
    # the ends: closed, then the fold round the D-ring's bar (the right strand in front, the left behind)
    for (s, af, cf, ab, cb) in (rings[0], rings[-1]):
        k.face([k.vert(tuple(q)) for q in (af, cf, cb, ab)], [edge_uv] * 4, m["print"], "#ffffff")
    yb = -DROP                                          # the bar's middle, level with the strap's feet
    fold = []
    for i in range(9):
        a = math.pi * i / 8                             # from the front, under the bar, to the back
        fold.append((0.0, yb - (BAR_R + 0.004) * math.sin(a), (BAR_R + 0.004) * math.cos(a)))
    rings_f = [[(x - W / 2, y, z) for x, y, z in [q]] + [(x + W / 2, y, z) for x, y, z in [q]] for q in fold]
    for r0, r1 in zip(rings_f, rings_f[1:]):
        k.face([k.vert(r0[0]), k.vert(r0[1]), k.vert(r1[1]), k.vert(r1[0])], [edge_uv] * 4, m["print"], "#ffffff")
    # the stitching across the tab: a row of short stitches on the front
    for i in range(9):
        x = -0.08 + 0.02 * i
        k.rbox((x, -DROP + 0.16, 0.0035 + T / 2 + 0.0008), (0.013, 0.0035, 0.0016), 0.0006, m["cloth"], THREAD, segs=1)
    return finish(k, (0.0, 0.0, 0.0)), yb


# ================================================================ the hardware
def smin(a, b, kk):
    h = np.clip(0.5 + 0.5 * (b - a) / kk, 0.0, 1.0)
    return b + (a - b) * h - kk * h * (1.0 - h)


def poly_sdf(px, py, poly):
    d2 = np.full(px.shape, 1e9, dtype=np.float32)
    sgn = np.ones(px.shape, dtype=np.float32)
    for i in range(len(poly)):
        (ax, ay), (bx, by) = poly[i], poly[i - 1]
        ex, ey, wx, wy = bx - ax, by - ay, px - ax, py - ay
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0.0, 1.0)
        d2 = np.minimum(d2, (wx - ex * t) ** 2 + (wy - ey * t) ** 2)
        c1, c2, c3 = py >= ay, py < by, ex * wy > ey * wx
        sgn = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -sgn, sgn)
    return sgn * np.sqrt(d2)


# The snap hook's cast body, drawn in mm/10 (1 = 0.0001 m = 0.001 units), x right, y down from the swivel's collar:
# a shoulder holding the rivet, then a tall teardrop loop; the gate closes its right side, the trigger tab sticks out left.
HOOK_OUT = [(-20, 0), (20, 0), (36, 14), (44, 50), (46, 92), (50, 140), (54, 178), (50, 206), (36, 226), (14, 236),
            (-12, 236), (-34, 224), (-48, 200), (-52, 160), (-48, 110), (-40, 62), (-34, 22)]
HOOK_HOLE = [(-28, 92), (-33, 150), (-30, 192), (-14, 212), (8, 214), (26, 202), (34, 176), (32, 140), (26, 104), (8, 84), (-14, 82)]
HOOK_T = 13.0                                       # the body's half-thickness
TRIGGER = [((-34, 62), 9), ((-58, 66), 8), ((-80, 70), 7)]
RIVET = (0, 44)
GATE_SEAM = [(28, 96), (34, 130), (38, 170), (36, 196)]


def hook_body(k, m, top_y):
    vox = 1.2
    xs, ys, zs = (np.arange(a, b + vox, vox, dtype=np.float32) for a, b in ((-100, 70), (-6, 246), (-22, 22)))
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij")
    d2 = poly_sdf(X[:, :, 0], Y[:, :, 0], HOOK_OUT)
    d2 = np.maximum(d2, -poly_sdf(X[:, :, 0], Y[:, :, 0], HOOK_HOLE))[:, :, None]
    R = 14.0
    body = (np.sqrt(np.maximum(d2 + R, 0.0) ** 2 + (Z * R / HOOK_T) ** 2) - R) * min(1.0, HOOK_T / R)
    # the trigger tab: a flattened bar out to the left
    tab = np.full(X.shape, 1e3, dtype=np.float32)
    for ((ax, ay), ra), ((bx, by), rb) in zip(TRIGGER, TRIGGER[1:]):
        ex, ey = bx - ax, by - ay
        wx, wy = X - ax, Y - ay
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1)
        tab = np.minimum(tab, np.sqrt((wx - ex * t) ** 2 + (wy - ey * t) ** 2 + (Z / 0.45) ** 2) - (ra + (rb - ra) * t))
    body = smin(body, tab * 0.45, 3.0)
    # the rivet's heads, front and back
    for zs_ in (1, -1):
        q = np.sqrt((X - RIVET[0]) ** 2 + (Y - RIVET[1]) ** 2) - 7.0
        body = smin(body, np.maximum(q, np.abs(Z - zs_ * HOOK_T) - 2.5), 1.5)
    # the gate's seam: a fine groove down the right of the loop
    seam = np.full(X.shape[:2], 1e9, dtype=np.float32)
    for (ax, ay), (bx, by) in zip(GATE_SEAM, GATE_SEAM[1:]):
        ex, ey = bx - ax, by - ay
        wx, wy = X[:, :, 0] - ax, Y[:, :, 0] - ay
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1)
        seam = np.minimum(seam, np.hypot(wx - ex * t, wy - ey * t))
    body = body + 2.0 * np.exp(-(seam[:, :, None] / 1.6) ** 2)
    g = vdb.FloatGrid(background=1e3)
    g.copyFromArray(body.astype(np.float32))
    pts, tri, quad = g.convertToPolygons(0.0, 0.0)
    pts = np.array([-100, -6, -22], dtype=np.float64) + np.asarray(pts, dtype=np.float64) * vox
    me = bpy.data.meshes.new("sdf")
    me.from_pydata(pts.tolist(), [], [list(map(int, f)) for f in quad] + [list(map(int, f)) for f in tri])
    ob = bpy.data.objects.new("sdf", me)
    bpy.context.scene.collection.objects.link(ob)
    dec = ob.modifiers.new("decimate", "DECIMATE")
    dec.ratio = min(1.0, 1100 / max(1, 2 * len(quad) + len(tri)))
    dec.use_collapse_triangulate = True
    dec.use_symmetry, dec.symmetry_axis = True, "Z"
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    m2 = ev.to_mesh()
    U = 0.001
    vs = [k.vert((v.co.x * U, top_y - v.co.y * U, v.co.z * U)) for v in m2.vertices]
    for f in m2.polygons:
        if len(set(f.vertices)) < len(f.vertices):
            continue
        try:
            k.face([vs[i] for i in f.vertices], [(0.0, 0.0)] * len(f.vertices), m["metal"], SILVER)
        except ValueError:
            pass
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)


def hardware(m):
    """The D-ring through the tab and the swivel snap hook hanging from it (the photo), its origin the bar's middle."""
    k = K.Kit("lanyard_hardware")
    # the D-ring: the straight bar the tab is sewn round, the curve below
    hw, depth = 0.118, 0.15
    pts = [(-hw + 2 * hw * i / 6, 0.0, 0.0) for i in range(7)]
    for i in range(1, 16):
        a = math.pi * i / 16
        pts.append((hw * math.cos(a), -depth * math.sin(a), 0.0))
    k.tube(pts, BAR_R, m["metal"], SILVER, n=7, closed_path=True)
    # the swivel's eye hangs on the D's bottom, square to it; then its domed head, the collar, the hook's body
    eye_r, eye_w = 0.02, 0.0055
    ey = -depth + BAR_R + eye_w - eye_r
    k.tube([(0.0, ey + math.sin(math.tau * i / 14) * eye_r, math.cos(math.tau * i / 14) * eye_r) for i in range(14)],
           eye_w, m["metal"], SILVER, n=6, closed_path=True)
    y = ey - eye_r
    k.lathe((0.0, y + 0.004, 0.0), [(0, 0), (0.012, 0.003), (0.022, 0.012), (0.025, 0.02)], m["metal"], SILVER, d=(0, -1, 0), n=12)
    y -= 0.016
    k.lathe((0.0, y, 0.0), [(0, 0), (0.028, 0.0), (0.03, 0.006), (0.03, 0.03), (0.026, 0.036), (0, 0.036)], m["metal"], SILVER, d=(0, -1, 0), n=12)
    y -= 0.034
    hook_body(k, m, y)
    return finish(k, (0.0, 0.0, 0.0))


# ================================================================ assembly
def finish(k, at):
    ob = k.finish(name=k.name, smooth_deg=50)
    ob.location = K.G(*at)
    return ob


def main():
    K.reset()
    atlas = bpy.data.images.load(os.path.join(HERE, "lanyard-atlas.png"))
    atlas.colorspace_settings.name = "sRGB"
    m = {
        # single-sided: the strap is a closed solid, and its two printed faces lie a hair apart (no bleed-through)
        "print": K.Mat("M_Lanyard", "#ffffff", rough=0.62, tex=atlas, double=False),
        "cloth": K.Mat("P_Cloth", "#ffffff", rough=1.0),
        "metal": K.Mat("P_Metal", "#ffffff", rough=0.35),
    }
    strap_ob, bar_y = strap(m)
    hw = hardware(m)
    hw.location = K.G(0.0, bar_y, 0.0)
    obs = [strap_ob, hw]
    print("tris", sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons), "hangs", round(-bar_y + 0.15 + 0.3, 3))
    K.export(obs, OUT)


main()
