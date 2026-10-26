"""The new world's dock and wharf decor (game/wharf-art, from David's references of 2026-10-26: dock-pillars-rope.jpg,
dock-decor.jpg, dock-fish-hut.jpg, dock-walkways.jpg; his note: "dock needs wood pillars on the side with rope
attached ... this kind of decor, fishnet, life ring").

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_dock_decor.py [-- review <dir>]

Writes, under web/public/assets/game/wharf/, each in game units at scale 1, the origin on the deck's top (y 0):
  dock-pile-rope.glb  a fat round pile standing 0.9 over the deck, its top a round end grain, two rope lashings (one
                      over the deck, one at the waterline), down to y -3.4 and wet under the sea (y -1.08). Stand it
                      just outside the deck's edge, like wharf-piling.
  rope-net.glb        two short posts at x -1 and +1 with a rope net hung between them, red and cream floats along its
                      top rope. Faces +z and -z alike.
  life-ring.glb       a red and white life ring upright in the x-y plane, its foot at the origin (0.9 tall), a grab
                      rope round it. Lean it on a post (tilt about x) or hang it: its top at the hook.
  net-heap.glb        a heap of fishing net with floats and a coil of rope, about 1.2 across.
  crate-net.glb       two crates side by side (along x), a net draped over the taller one and onto the deck.
  crate-cloth.glb     a crate with a cloth thrown over it.
  fish-crate.glb      an open crate of fish on ice, its back propped up so the catch shows.
  dock-hoist.glb      a small hoist: a mast on a foot block, a jib out along +x with a pulley, the rope down to a hook,
                      lashed at its base, a coil of rope by it.

Wood is the wharf kit's (build_wharf_kit.py: its grain texture and weathered tones) so the decor sits with the deck and
the piles; rope its three-strand rope; the net an opaque painted cord mesh (no cut-out, so it draws as one solid
material); paint, cloth and the hook's metal are the shared plain presets (P_Paint, P_Cloth, P_Metal: modelMaterials).
Seeded: a rebuild writes the same models. Prints each model's triangles and bounds.
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, HERE)
import propkit as K  # noqa: E402
from build_wharf_kit import DARK, LIGHT, ROPE_R, WATER, mix, report, wet, wood_mat  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/wharf/"
ROPE = "#c7a268"
FLOAT_RED, FLOAT_CREAM = "#d9573a", "#efe4c8"
rng = np.random.default_rng(2610)


WARM_DARK, WARM_LIGHT = "#8a6440", "#d2aa78"     # the references' decor wood: warmer and lighter than the deck


def tone(lo=0.3, hi=0.9):
    return mix(WARM_DARK, WARM_LIGHT, rng.uniform(lo, hi))


def net_texture(S=128, cells=4):
    """An opaque knotted net, tiling: tan cord diamonds over the dark of the folds beneath."""
    u = (np.arange(S) + 0.5) / S
    U, V = np.meshgrid(u, u)
    a = np.abs(((U + V) * cells) % 1 - 0.5)
    b = np.abs(((U - V) * cells) % 1 - 0.5)
    cord = np.clip(1 - np.minimum(a, b) / 0.11, 0, 1) ** 0.7
    knot = np.clip(1 - np.maximum(a, b) / 0.16, 0, 1)
    v = np.clip(cord + knot, 0, 1)[..., None]
    return np.array(K.hexrgb("#6b6446")) * (1 - v) + np.array(K.hexrgb("#d0b783")) * v


def lashing(k, Mr, c, r, y, wraps=3, pitch=0.055):
    """Rope wound round a post of radius r at height y: `wraps` rings stacked, each a little out of round."""
    for i in range(wraps):
        yy = y + (i - (wraps - 1) / 2) * pitch
        ring = [(c[0] + math.cos(a) * (r + ROPE_R * 0.6), yy + 0.008 * math.sin(2 * a + i), c[2] + math.sin(a) * (r + ROPE_R * 0.6))
                for a in np.linspace(0, math.tau, 12, endpoint=False)]
        k.tube(ring, ROPE_R * 1.25, Mr, ROPE, n=6, v_len=0.12, closed_path=True)


def end_grain(k, M, c, r, y, col):
    """A post's round top: a soft chamfer into a flat end in rings of a lighter tone."""
    rings = [1.0, 0.68, 0.36]
    for i, f in enumerate(rings):
        inner = rings[i + 1] if i + 1 < len(rings) else 0.0
        shade = mix(col, "#e2c79c", 0.5 + 0.15 * (i % 2))
        k.lathe(c, [(r * f, y), (r * inner, y)] if inner else [(r * f, y), (0.0, y)], M, shade, n=12, v_len=0.5)


def post(k, M, x, z, r, h, foot=-0.05, col=None):
    col = col or tone(0.45, 0.75)
    prof = [(r * 1.04, foot), (r, foot + 0.1), (r, h - 0.05), (r * 0.94, h - 0.01), (r * 0.86, h)]
    k.lathe((x, 0, z), prof, M, col, n=10, v_len=0.9, wobble=lambda kk, i: 1 + 0.03 * math.sin(kk * 2.3 + x))
    end_grain(k, M, (x, 0, z), r * 0.86, h, col)


def float_ball(k, Mp, c, r, col):
    k.blob(c, (r, r * 0.8, r), Mp, col, segs=8, rings=6)


def crate(k, M, c, s, h=None, lid=True, col=None):
    """A slatted crate centred on c's x and z, its foot at c's y: corner posts, three boards a side, a boarded lid."""
    h = h or s
    x0, y0, z0 = c
    col = col or tone(0.3, 0.8)
    k.rbox((x0, y0 + h / 2, z0), (s - 0.04, h - 0.02, s - 0.04), 0.01, M, mix(col, DARK, 0.6), segs=1)   # the dark inside
    t = 0.035
    for i in range(3):
        y = y0 + (i + 0.5) * h / 3
        bc = mix(col, LIGHT, rng.uniform(-0.1, 0.25))
        for ax in (0, 1):
            for sg in (-1, 1):
                p = (x0 + sg * (s / 2 - t / 2), y, z0) if ax == 0 else (x0, y, z0 + sg * (s / 2 - t / 2))
                size = (t, h / 3 - 0.025, s - 0.1) if ax == 0 else (s - 0.1, h / 3 - 0.025, t)
                k.rbox(p, size, 0.012, M, bc, segs=1, uv_len=1.5, uv_off=(rng.random(), rng.random()))
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.rbox((x0 + sx * (s / 2 - 0.04), y0 + h / 2, z0 + sz * (s / 2 - 0.04)), (0.08, h, 0.08), 0.015, M, mix(col, DARK, 0.25), segs=1)
    if lid:
        for i in range(3):
            k.rbox((x0 - s / 3 + i * s / 3, y0 + h + 0.015, z0), (s / 3 - 0.02, 0.035, s), 0.012, M,
                   mix(col, LIGHT, rng.uniform(0.0, 0.3)), segs=1, uv_len=1.5, v_axis=2, uv_off=(rng.random(), rng.random()))


def drape(k, M, c, top_half, top_y, span, col="#ffffff", n=9, seed=0, ground=0.0, uv_len=0.5, puff=0.03, skew=0.0):
    """A sheet thrown over a box: a square of side `span` centred on c (x, z), lying on the box's top (half size
    top_half, at top_y) and falling down its sides where it overhangs, its hem waving; it stops on the ground."""
    g = np.random.default_rng(seed)
    ph = g.uniform(0, math.tau, 4)
    pts = {}
    for i in range(n + 1):
        for j in range(n + 1):
            u, v = -1 + 2 * i / n, -1 + 2 * j / n
            x, z = u * span / 2, v * span / 2
            x, z = x + skew * z, z - skew * x
            over = max(abs(x) - top_half, abs(z) - top_half, 0.0)
            # Clamp onto the box's outline, then fall by the overhang (a soft roll over the edge).
            cx_, cz_ = np.clip(x, -top_half - 0.02, top_half + 0.02), np.clip(z, -top_half - 0.02, top_half + 0.02)
            y = top_y + puff * (1 - max(abs(u), abs(v)) ** 2) - over * 1.05
            out = 0.02 + 0.06 * min(over, 0.3) * (1 + math.sin(6 * (u + v) + ph[0]))
            if over > 0:
                d = np.array([x - cx_, z - cz_])
                d = d / (np.linalg.norm(d) + 1e-9)
                cx_, cz_ = cx_ + d[0] * out, cz_ + d[1] * out
            y += 0.03 * math.sin(5 * u + ph[1]) * math.sin(4 * v + ph[2]) * min(1.0, over * 4)
            if y < ground + 0.01:   # run out over the ground past the box
                extra = ground + 0.01 - y
                d = np.array([x, z])
                d = d / (np.linalg.norm(d) + 1e-9)
                cx_, cz_, y = cx_ + d[0] * extra * 0.8, cz_ + d[1] * extra * 0.8, ground + 0.01 + 0.01 * math.sin(7 * u + ph[3])
            pts[i, j] = (c[0] + cx_, y, c[2] + cz_)
    for i in range(n):
        for j in range(n):
            q = [pts[i, j], pts[i + 1, j], pts[i + 1, j + 1], pts[i, j + 1]]
            uv = [(i / n * span / uv_len, j / n * span / uv_len), ((i + 1) / n * span / uv_len, j / n * span / uv_len),
                  ((i + 1) / n * span / uv_len, (j + 1) / n * span / uv_len), (i / n * span / uv_len, (j + 1) / n * span / uv_len)]
            k.face([k.vert(p) for p in reversed(q)], list(reversed(uv)), M, col)


def coil(k, Mr, c, r0=0.08, r1=0.22, turns=2.5, n=30):
    pts = [(c[0] + math.cos(t * turns * math.tau) * (r0 + (r1 - r0) * t), c[1] + ROPE_R * 1.3, c[2] + math.sin(t * turns * math.tau) * (r0 + (r1 - r0) * t))
           for t in np.linspace(0, 1, n)]
    k.tube(pts, ROPE_R * 1.3, Mr, ROPE, n=6, v_len=0.12, caps=True)


# ================================================================ the models
def dock_pile_rope(M, Mr):
    k = K.Kit("dock-pile-rope")
    r, h = 0.2, 0.9
    col = mix(DARK, LIGHT, 0.5)
    prof = [(0.0, -3.4), (r * 0.9, -3.4), (r * 0.97, -3.0), (r, -2.0), (r * 1.01, WATER), (r, -0.4), (r * 0.99, h - 0.06),
            (r * 0.93, h - 0.01), (r * 0.86, h)]
    k.lathe((0, 0, 0), prof, M, col, n=12, u_tiles=1, v_len=1.6, wobble=lambda kk, i: 1 + 0.035 * math.sin(kk * 2.1 + 0.7))
    end_grain(k, M, (0, 0, 0), r * 0.86, h, col)
    lashing(k, Mr, (0, 0, 0), r, 0.42)
    lashing(k, Mr, (0, 0, 0), r * 1.01, WATER + 0.22, wraps=2)
    k.tint_gradient(0.82, 1.0, -0.6, h)
    wet(k)
    return k.finish(smooth_deg=50)


def rope_net(M, Mr, Mp):
    k = K.Kit("rope-net")
    for x in (-1.0, 1.0):
        post(k, M, x, 0, 0.085, 1.15)
        lashing(k, Mr, (x, 0, 0), 0.085, 1.0, wraps=2)
    top = lambda x: 1.0 - 0.12 * (1 - x * x)
    bottom = lambda x: 0.32 - 0.08 * (1 - x * x)
    xs = np.linspace(-0.92, 0.92, 13)
    k.tube([(-0.92, 1.0, 0)] + [(x, top(x), 0) for x in xs[1:-1]] + [(0.92, 1.0, 0)], ROPE_R * 1.2, Mr, ROPE, n=6, v_len=0.12)
    # The mesh: staggered rows of knots, each tied to the two below it (diamonds), bellied out a little at its middle.
    rows, cols = 5, 8
    knots = []
    for j in range(rows + 1):
        t = j / rows
        row = []
        for i in range(cols + 1 - (j % 2)):
            u = (i + 0.5 * (j % 2)) / cols
            x = -0.9 + 1.8 * u
            y = top(x) + (bottom(x) - top(x)) * t
            z = 0.05 * math.sin(math.pi * t) * math.sin(math.pi * u)
            row.append((x, y, z))
        knots.append(row)
    for j in range(rows):
        for i, p in enumerate(knots[j]):
            for q in ((knots[j + 1][i - 1] if i - 1 >= 0 else None, knots[j + 1][i] if i < len(knots[j + 1]) else None) if j % 2 == 0
                      else (knots[j + 1][i], knots[j + 1][i + 1])):
                if q is not None:
                    k.tube([p, q], 0.014, Mr, mix(ROPE, "#7d6a48", 0.3), n=4, v_len=0.2)
    k.tube([(x, bottom(x), 0) for x in np.linspace(-0.9, 0.9, 9)], ROPE_R, Mr, ROPE, n=5, v_len=0.12)
    for i, x in enumerate((-0.62, -0.2, 0.22, 0.64)):
        float_ball(k, Mp, (x, top(x) - 0.02, 0), 0.07, FLOAT_RED if i % 2 == 0 else FLOAT_CREAM)
    k.tint_gradient(0.85, 1.0, 0.0, 1.15)
    return k.finish(smooth_deg=50)


def ring_into(k, Mp, Mr, c=(0.0, 0.0, 0.0), s=1.0, nu=24, nv=8, rope_n=48):
    """A life ring upright in the x-y plane, its foot at c, scaled by s (0.93 tall at 1); nu and nv its sections round
    and across (nu a multiple of 8), rope_n the grab rope's points."""
    R, r = 0.36 * s, 0.085 * s
    cy = R + r + 0.005 * s
    pt = lambda a, b: (c[0] + math.cos(a) * (R + r * math.cos(b)), c[1] + cy + math.sin(a) * (R + r * math.cos(b)), c[2] + r * math.sin(b))
    for i in range(nu):
        a0, a1 = math.tau * i / nu, math.tau * (i + 1) / nu
        col = FLOAT_RED if (i // (nu // 8)) % 2 == 0 else "#f4efe6"      # four red bands, four white
        for j in range(nv):
            b0, b1 = math.tau * j / nv, math.tau * (j + 1) / nv
            k.face([k.vert(pt(a0, b0)), k.vert(pt(a1, b0)), k.vert(pt(a1, b1)), k.vert(pt(a0, b1))],
                   [(i / nu, j / nv), ((i + 1) / nu, j / nv), ((i + 1) / nu, (j + 1) / nv), (i / nu, (j + 1) / nv)], Mp, col)
    # The grab rope: scalloped round the outside, tied at the middle of each white band.
    pts = []
    for i in range(rope_n):
        a = math.tau * i / rope_n
        tie = abs(math.cos(4 * (a - math.tau * 4.5 / 24)))    # 1 at the ties (the white bands' middles)
        rr = R + r * 0.85 + 0.03 * s * (1 - tie) ** 2
        pts.append((c[0] + math.cos(a) * rr, c[1] + cy + math.sin(a) * rr, c[2]))
    k.tube(pts, 0.014 * s, Mr, ROPE, n=5, v_len=0.12, closed_path=True)


def life_ring(Mp, Mr):
    k = K.Kit("life-ring")
    ring_into(k, Mp, Mr)
    return k.finish(smooth_deg=60)


def net_heap(M, Mn, Mr, Mp):
    k = K.Kit("net-heap")
    # Folds of net slumped on each other: a low wide mound, two smaller ones on and against it, one trailing off.
    for (x, y, z), (rx, ry, rz), col, seed in (((0, 0, 0), (0.55, 0.22, 0.45), "#e8e8e8", 3), ((0.15, 0.16, -0.08), (0.34, 0.2, 0.28), "#ffffff", 5),
                                               ((-0.32, 0.06, 0.18), (0.3, 0.16, 0.26), "#f4f4f4", 7), ((0.5, 0.0, 0.25), (0.3, 0.08, 0.2), "#dddddd", 8)):
        k.blob((x, y, z), (rx, ry, rz), Mn, col, segs=12, rings=7, seed=seed, lumpy=0.45, flat_bottom=-y, uv_tiles=(round(rx * 10), round(ry * 10)))
    for (x, y, z), col in (((0.42, 0.14, 0.28), FLOAT_RED), ((-0.1, 0.33, -0.2), FLOAT_CREAM), ((-0.5, 0.1, -0.22), FLOAT_RED)):
        float_ball(k, Mp, (x, y, z), 0.075, col)
    coil(k, Mr, (0.62, 0.0, -0.35), r1=0.2)
    for v in k.bm.verts:          # the flattened undersides rest on the deck
        v.co.z = max(v.co.z, 0.0)
    k.tint_gradient(0.8, 1.0, 0.0, 0.45)
    return k.finish(smooth_deg=55)


def crate_net(M, Mn, Mp):
    k = K.Kit("crate-net")
    crate(k, M, (-0.36, 0, 0), 0.66, 0.6)
    crate(k, M, (0.36, 0, 0.04), 0.56, 0.44, col=tone(0.6, 0.95))
    drape(k, Mn, (-0.36, 0, 0), 0.34, 0.67, 1.25, n=14, seed=4, skew=0.15)
    float_ball(k, Mp, (-0.05, 0.36, 0.33), 0.07, FLOAT_RED)
    float_ball(k, Mp, (-0.7, 0.2, -0.36), 0.07, FLOAT_CREAM)
    k.tint_gradient(0.8, 1.0, 0.0, 0.7)
    return k.finish(smooth_deg=45)


def crate_cloth(M, Mc):
    k = K.Kit("crate-cloth")
    crate(k, M, (0, 0, 0), 0.66, 0.62)
    drape(k, Mc, (0.05, 0, -0.03), 0.34, 0.7, 1.0, col="#ece5d2", n=14, seed=9, skew=0.35, puff=0.04)
    k.tint_gradient(0.8, 1.0, 0.0, 0.72)
    return k.finish(smooth_deg=45)


def fish(k, Mp, c, yaw, length, col):
    """A plump fish lying on its side along `yaw`: a spindle body, a forked tail, a dark eye."""
    d = (math.cos(yaw), 0.0, math.sin(yaw))
    L = length
    prof = [(0.0, -L / 2), (L * 0.1, -L * 0.44), (L * 0.17, -L * 0.2), (L * 0.16, L * 0.08), (L * 0.09, L * 0.32), (L * 0.05, L * 0.42)]
    k.lathe(c, prof, Mp, col, d=d, n=8, sx=1.0, sz=0.55, up=(0, 1, 0))
    tail = np.array(c) + np.array(d) * L * 0.42
    side = np.array((-d[2], 0.0, d[0]))
    p0 = tail
    p1 = tail + np.array(d) * L * 0.2 + side * L * 0.16
    p2 = tail + np.array(d) * L * 0.13
    p3 = tail + np.array(d) * L * 0.2 - side * L * 0.16
    for a, b in ((p1, p2), (p2, p3)):
        k.quad([tuple(p0), tuple(a), tuple(b), tuple(p0 + np.array((0, 0.001, 0)))], Mp, mix(col, "#20283a", 0.25))
    eye = np.array(c) - np.array(d) * L * 0.33 + np.array((0, L * 0.06, 0))
    k.blob(tuple(eye), (0.014, 0.014, 0.014), Mp, "#1d1d22", segs=6, rings=4)


def fish_crate(M, Mp):
    k = K.Kit("fish-crate")
    s, h = 0.7, 0.3
    crate(k, M, (0, 0, 0), s, h, lid=False)
    k.blob((0, h - 0.04, 0), (s / 2 - 0.06, 0.06, s / 2 - 0.06), Mp, "#dceef2", segs=10, rings=5, seed=11, lumpy=0.25)   # crushed ice
    for i, (x, z, yaw, col) in enumerate(((-0.08, -0.17, 0.25, "#5f86b5"), (0.05, -0.03, -0.15, "#6aa36b"), (-0.05, 0.12, 0.2, "#5f86b5"),
                                           (0.08, 0.24, -0.1, "#c56a55"))):
        fish(k, Mp, (x, h + 0.025 + 0.012 * i, z), yaw, 0.42, col)
    # The back propped on a batten: the whole crate tips toward +z (the front), so the catch shows.
    import bmesh
    from mathutils import Matrix, Vector
    bmesh.ops.rotate(k.bm, verts=k.bm.verts, cent=K.G(0, 0, s / 2), matrix=Matrix.Rotation(math.radians(14), 3, "X"))
    lift = -min(v.co.z for v in k.bm.verts)
    bmesh.ops.translate(k.bm, verts=k.bm.verts, vec=Vector((0, 0, lift)))
    k.rbox((0, 0.07, -s / 2 + 0.12), (s - 0.16, 0.14, 0.08), 0.02, M, mix(DARK, LIGHT, 0.3), segs=1)    # the batten under its back
    k.tint_gradient(0.82, 1.0, 0.0, 0.5)
    return k.finish(smooth_deg=45)


def dock_hoist(M, Mr, Mm):
    k = K.Kit("dock-hoist")
    col = tone(0.45, 0.7)
    k.rbox((0, 0.12, 0), (0.56, 0.24, 0.56), 0.03, M, mix(col, DARK, 0.3), segs=1)
    k.beam((0, 0.2, 0), (0, 2.6, 0), 0.18, 0.18, 0.03, M, col, up=(0, 0, 1))
    k.beam((-0.1, 2.38, 0), (1.3, 2.38, 0), 0.14, 0.16, 0.025, M, mix(col, LIGHT, 0.2))
    k.beam((0.0, 1.55, 0), (0.85, 2.34, 0), 0.1, 0.1, 0.02, M, mix(col, DARK, 0.15), up=(0, 0, 1))
    k.rbox((0, 2.62, 0), (0.22, 0.05, 0.22), 0.015, M, mix(col, LIGHT, 0.3), segs=1)
    lashing(k, Mr, (0, 0, 0), 0.11, 0.55, wraps=3)
    # The pulley: an iron wheel in a strap under the jib's end, the rope over it and down to a hook.
    px, py = 1.18, 2.2
    k.lathe((px, py, 0), [(0.0, -0.03), (0.09, -0.03), (0.07, 0.0), (0.09, 0.03), (0.0, 0.03)], Mm, "#585c62", d=(0, 0, 1), n=12)
    for z in (-0.045, 0.045):
        k.rbox((px, py + 0.09, z), (0.05, 0.22, 0.015), 0.006, Mm, "#4b4f55", segs=1)
    k.tube([(px + 0.09, py, 0), (px + 0.09, 1.25, 0)], 0.016, Mr, ROPE, n=5, v_len=0.12)
    k.tube([(px - 0.09, py, 0), (px - 0.4, py - 0.06, 0), (0.12, 1.2, 0)], 0.016, Mr, ROPE, n=5, v_len=0.12)
    k.rbox((0.12, 1.2, 0), (0.05, 0.12, 0.08), 0.01, Mm, "#4b4f55", segs=1)                    # the cleat it's made fast on
    hook = [(px + 0.09, 1.25, 0), (px + 0.09, 1.12, 0), (px + 0.1, 1.02, 0), (px + 0.06, 0.95, 0), (px - 0.01, 0.97, 0), (px - 0.03, 1.03, 0)]
    k.tube(hook, 0.018, Mm, "#5d6168", n=6, v_len=0.2, caps=True)
    coil(k, Mr, (0.5, 0, 0.35), r1=0.2)
    k.tint_gradient(0.82, 1.0, 0.0, 2.6)
    return k.finish(smooth_deg=45)


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    pile = wood_mat("M_PileWood", 2612)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    net = K.Mat("M_Net", tex=K.image("net", net_texture()), rough=1.0)
    paint, cloth, metal = K.Mat("P_Paint", rough=0.45), K.Mat("P_Cloth", rough=1.0), K.Mat("P_Metal", rough=0.4)
    obs = {}
    for name, fn in (("dock-pile-rope", lambda: dock_pile_rope(pile, rope)), ("rope-net", lambda: rope_net(wood, rope, paint)),
                     ("life-ring", lambda: life_ring(paint, rope)), ("net-heap", lambda: net_heap(wood, net, rope, paint)),
                     ("crate-net", lambda: crate_net(wood, net, paint)), ("crate-cloth", lambda: crate_cloth(wood, cloth)),
                     ("fish-crate", lambda: fish_crate(wood, paint)), ("dock-hoist", lambda: dock_hoist(wood, rope, metal))):
        ob = fn()
        K.export([ob], f"{OUT}{name}.glb")
        report(ob)
        obs[name] = ob
    return obs


def scene(obs, out):
    """The decor laid out on two rows of deck for the review."""
    import bpy
    shown = []
    for name, (x, z) in {"dock-pile-rope": (-3.2, -0.6), "rope-net": (-1.4, -0.6), "life-ring": (0.6, -0.6), "dock-hoist": (1.6, -0.6),
                         "net-heap": (-3.0, 1.2), "crate-net": (-1.3, 1.2), "crate-cloth": (0.3, 1.2), "fish-crate": (1.5, 1.2)}.items():
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G(x, 0, z)
        shown.append(o)
        obs[name].hide_render = True
    bpy.context.view_layer.update()
    K.review(shown, out, views=((20, 30), (200, 30)), size=900)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "dock-decor.png"))
