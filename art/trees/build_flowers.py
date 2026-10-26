"""The village's flowers (game/remodel-trees), replacing the ACNH flowers in the member world: small clustered stems with
soft painted petals (art/trees/textures/petals.png, painted by art/trees/paint_textures.py).

Every bloom is built from petal cards round its head (each card one painted petal, its base at the head's middle),
in rings that open from cupped to flat, over a little domed centre where the flower shows one; thin stems with leaf
cards, or strap leaves from the ground. A model is a clump of three to five stems, about as big as the dump's flower
(a tile across at scale 1, drawn at half size three to a tile: lib/game/natureParts.ts flowerParts), one material, one
draw for every flower of its kind.

Writes web/public/assets/game/plants/flower-<name>.glb, then web/scripts/finish-greenery.mjs sets the material (cut out
at 0.5, both sides, matte) and checks the files.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_flowers.py [-- mum cosmos ...]
"""
import math, os, random, subprocess, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402
import flower_cells as FC  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
UP = Vector((0, 0, 1))
# Blooms are big for their plant, as the dump's are (a clump of three or four fills its tile): every head x this.
HEAD = 1.45


def petal_card(b, base, axis, around, tilt, length, cell, col, fold=0.0, curl=0.0, normal_bias=0.5):
    """A petal: a square card from `base` out along `axis` tilted by `tilt` (radians from the axis) toward `around`
    (a unit vector across the head), its painted base at the head, its tip outward. fold > 0 cups it (edges up toward
    the axis), curl bends its outer half back."""
    side = axis.cross(around).normalized()
    d = (axis * math.cos(tilt) + around * math.sin(tilt)).normalized()
    n = side.cross(d).normalized()  # faces up out of the head
    if n.dot(axis) < 0:
        n = -n
    h = length / 2
    tipd = d if not curl else (d * math.cos(curl) - n * math.sin(curl)).normalized()
    mid = base + d * length * 0.5
    tip = mid + tipd * length * 0.5
    def at(x, frac_tip):
        p = (base + (mid - base) * (frac_tip / 0.5)) if frac_tip <= 0.5 else (mid + (tip - mid) * ((frac_tip - 0.5) / 0.5))
        return p + side * (x * h) + n * (fold * h * abs(x))
    nrm = lambda p: (n * (1 - normal_bias) + axis * normal_bias).normalized()
    if curl:
        rows = [0.0, 0.5, 1.0]
    else:
        rows = [0.0, 1.0]
    cols = [-1, 0, 1] if fold else [-1, 1]
    grid = [[b.vert(at(x, f), nrm(at(x, f))) for x in cols] for f in rows]
    for r in range(len(rows) - 1):
        for c in range(len(cols) - 1):
            ids = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]]
            uvs = [K.cell_uv(cell, cols[c], rows[r] * 2 - 1), K.cell_uv(cell, cols[c + 1], rows[r] * 2 - 1),
                   K.cell_uv(cell, cols[c + 1], rows[r + 1] * 2 - 1), K.cell_uv(cell, cols[c], rows[r + 1] * 2 - 1)]
            b.face(ids, uvs, col)


def dome(b, centre, axis, radius, height, rect, col, segs=8):
    """A low domed disc (the flower's centre)."""
    radius, height = radius * HEAD, height * HEAD
    ref = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0))
    s1 = axis.cross(ref).normalized()
    s2 = axis.cross(s1).normalized()
    top = b.vert(centre + axis * height, axis)
    u0, v0, u1, v1 = rect
    cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
    ring = []
    for k in range(segs):
        a = math.tau * k / segs
        p = centre + (s1 * math.cos(a) + s2 * math.sin(a)) * radius
        ring.append((b.vert(p, (axis + (p - centre).normalized() * 0.6).normalized()), (cu + math.cos(a) * (u1 - u0) * 0.45, cv + math.sin(a) * (v1 - v0) * 0.45)))
    for k in range(segs):
        (a, ua), (c, uc) = ring[k], ring[(k + 1) % segs]
        b.face([a, c, top], [ua, uc, (cu, cv)], col)


def stem(b, base, top, radius, col, bend=0.0, rng=None):
    mid = (base + top) / 2 + Vector((bend, bend * 0.5, 0))
    path = [base, base + (mid - base) * 0.5, mid, top]
    rect = FC.uv("strap-leaf")
    # a stem wears the middle of the strap leaf's green (no wrap: three sides, mapped across the leaf's centre)
    K.tube(b, path, [radius, radius * 0.95, radius * 0.9, radius * 0.8], 3, lambda p: col,
           v_scale=0.0, u_tiles=0.0)
    # tube() gives u 0, v 0 everywhere at u_tiles = v_scale = 0: point every one of these new corners into the leaf
    for f in range(len(b.uvs) - (len(path) - 1) * 3, len(b.uvs)):
        b.uvs[f] = [((rect[0] + rect[2]) / 2, rect[1] + (rect[3] - rect[1]) * 0.5)] * len(b.uvs[f])
    return path


def leaf_card(b, at, out, length, cell, col, rise=0.5, width=1.0):
    """A leaf on a stem or at the ground: from `at`, out along the horizontal `out` and up by `rise`, its flat face up."""
    d = (out + UP * rise).normalized()
    side = UP.cross(out).normalized()
    n = side.cross(d).normalized()
    h = length / 2 * width
    tip = at + d * length
    mid = at + d * length * 0.5 + n * length * 0.06
    pts = [at - side * h * 0.25, at + side * h * 0.25, mid + side * h, tip + side * h * 0.2, tip - side * h * 0.2, mid - side * h]
    ids = [b.vert(p, (n + UP).normalized()) for p in pts]
    uvs = [K.cell_uv(cell, -0.25, -1), K.cell_uv(cell, 0.25, -1), K.cell_uv(cell, 1, 0), K.cell_uv(cell, 0.2, 1), K.cell_uv(cell, -0.2, 1), K.cell_uv(cell, -1, 0)]
    b.face([ids[0], ids[1], ids[2], ids[5]], [uvs[0], uvs[1], uvs[2], uvs[5]], col)
    b.face([ids[5], ids[2], ids[3], ids[4]], [uvs[5], uvs[2], uvs[3], uvs[4]], col)


def head_frame(rng, tilt_out, spot):
    """A head's axis: up, leaning out from the clump's middle by tilt_out, and a reference across it."""
    out = Vector((spot.x, spot.y, 0))
    out = out.normalized() if out.length > 1e-4 else Vector((1, 0, 0))
    axis = (UP * math.cos(tilt_out) + out * math.sin(tilt_out)).normalized()
    ref = (Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0)))
    across = (ref - axis * ref.dot(axis)).normalized()
    return axis, across


def ring(b, centre, axis, across, count, cell, length, tilt, col, phase=0.0, fold=0.0, curl=0.0, jit=0.1, rng=None, lift=0.0):
    length, lift = length * HEAD, lift * HEAD
    for k in range(count):
        a = phase + math.tau * k / count + (rng.uniform(-jit, jit) if rng else 0)
        aro = (Matrix.Rotation(a, 3, axis) @ across).normalized()
        petal_card(b, centre + axis * lift + aro * length * 0.04, axis, aro, tilt, length * (rng.uniform(0.92, 1.06) if rng else 1), K_cell(cell), col, fold=fold, curl=curl)


def K_cell(name):
    return FC.uv(name)


LEAF = (0.86, 0.9, 0.82)


def spots(rng, n, spread, hmin, hmax):
    """Stem feet and head heights for a clump: one near the middle, the rest round it."""
    out = []
    for i in range(n):
        if i == 0:
            p = Vector((rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), 0))
        else:
            a = math.tau * (i - 1) / (n - 1) + rng.uniform(-0.35, 0.35)
            r = spread * rng.uniform(0.65, 1.0)
            p = Vector((math.cos(a) * r, math.sin(a) * r, 0))
        out.append((p, rng.uniform(hmin, hmax) * (1.08 if i == 0 else 1.0)))
    return out


def build(name):
    K.reset()
    rng = random.Random(name)
    b = K.Build()
    F = FLOWERS[name]
    for i, (foot, height) in enumerate(spots(rng, F["stems"], F["spread"], *F["height"])):
        lean = Vector((foot.x, foot.y, 0)) * F.get("lean", 0.35)
        top = foot + lean + Vector((0, 0, height))
        stem(b, foot - Vector((0, 0, 0.02)), top, F.get("stem", 0.009), LEAF, bend=rng.uniform(-0.02, 0.02))
        axis, across = head_frame(rng, F.get("face", 0.25) + rng.uniform(-0.1, 0.1), top)
        across = (Matrix.Rotation(rng.uniform(0, math.tau), 3, axis) @ across).normalized()
        F["head"](b, top, axis, across, rng, i)
        for k in range(F.get("leaves", 2)):
            a = rng.uniform(0, math.tau)
            out = Vector((math.cos(a), math.sin(a), 0))
            at = foot + (top - foot) * rng.uniform(0.15, 0.5)
            leaf_card(b, at, out, F.get("leaf_len", 0.15) * rng.uniform(0.85, 1.1), FC.uv("leaf"), LEAF, rise=0.45, width=1.2)
    for k in range(F.get("straps", 0)):
        a = math.tau * k / F["straps"] + rng.uniform(-0.3, 0.3)
        out = Vector((math.cos(a), math.sin(a), 0))
        foot = F.get("strap_foot", 0.03) * (rng.uniform(0.2, 1.0) if "strap_foot" in F else 1)
        leaf_card(b, out * foot, out, F.get("strap_len", 0.3) * rng.uniform(0.85, 1.1), FC.uv("strap-leaf"), LEAF,
                  rise=F.get("strap_rise", 2.2) * rng.uniform(0.8, 1.2) if "strap_rise" in F else 2.2, width=0.6)
    for k in range(F.get("rosette", 0)):
        a = math.tau * k / F["rosette"] + rng.uniform(-0.3, 0.3)
        out = Vector((math.cos(a), math.sin(a), 0))
        leaf_card(b, out * 0.02 + Vector((0, 0, 0.01)), out, 0.2 * rng.uniform(0.85, 1.1), FC.uv("leaf"), LEAF, rise=0.3, width=1.3)
    # The atlas at 256 px: a flower is small at play distance (lane rules: textures only where they show).
    ob = b.object("Flower", K.material("mPetals", K.image("petals", (256, 256)), alpha_clip=True))
    path = os.path.join(K.OUT, f"flower-{name}.glb")
    K.export([ob], path)
    print(f"FLOWER {name}: tris {K.tris(ob)}")
    return path


W = (1.0, 1.0, 1.0)


def mum(b, top, axis, across, rng, i):
    cell = "mum-gold" if i % 2 else "mum-rust"
    ring(b, top, axis, across, 12, cell, 0.12, math.radians(84), W, rng=rng)
    ring(b, top, axis, across, 10, cell, 0.11, math.radians(60), W, phase=0.3, rng=rng, lift=0.01)
    ring(b, top, axis, across, 8, cell, 0.095, math.radians(36), W, phase=0.1, rng=rng, lift=0.02)
    ring(b, top, axis, across, 5, cell, 0.07, math.radians(14), W, phase=0.5, rng=rng, lift=0.025)


def cosmos(b, top, axis, across, rng, i):
    cell = "cosmos-white" if i % 3 == 2 else "cosmos-pink"
    ring(b, top, axis, across, 8, cell, 0.15, math.radians(78), W, rng=rng, jit=0.05)
    dome(b, top + axis * 0.008 * HEAD, axis, 0.032, 0.022, FC.centre_uv("yellow"), W)


def rose(b, top, axis, across, rng, i):
    ring(b, top, axis, across, 5, "rose-red", 0.12, math.radians(72), W, fold=0.35, rng=rng)
    ring(b, top, axis, across, 5, "rose-red", 0.1, math.radians(42), W, phase=0.6, fold=0.45, rng=rng, lift=0.01)
    ring(b, top, axis, across, 4, "rose-red", 0.075, math.radians(18), (0.85, 0.85, 0.85), phase=0.2, fold=0.5, rng=rng, lift=0.02)
    dome(b, top + axis * 0.03 * HEAD, axis, 0.022, 0.025, FC.centre_uv("bud"), W, segs=6)


def windflower(b, top, axis, across, rng, i):
    cell = "windflower-violet" if i % 2 else "windflower-white"
    ring(b, top, axis, across, 6, cell, 0.13, math.radians(70), W, fold=0.15, rng=rng, jit=0.06)
    dome(b, top + axis * 0.01 * HEAD, axis, 0.03, 0.024, FC.centre_uv("dark"), W)


def tulip(b, top, axis, across, rng, i):
    cell = "tulip-butter" if i % 2 else "tulip-red"
    ring(b, top, axis, across, 3, cell, 0.17, math.radians(16), W, fold=0.4, rng=rng, jit=0.04)
    ring(b, top - axis * 0.005, axis, across, 3, cell, 0.165, math.radians(24), (0.92, 0.92, 0.92), phase=math.pi / 3, fold=0.4, rng=rng, jit=0.04)


def pansy(b, top, axis, across, rng, i):
    # four violet petals behind, the face petal in front, the whole head facing out and up
    for k, (cell, ang, ln) in enumerate((("pansy-violet", 2.4, 0.12), ("pansy-violet", -2.4, 0.12), ("pansy-violet", 1.2, 0.11), ("pansy-violet", -1.2, 0.11), ("pansy-face", 0.0, 0.12))):
        aro = (Matrix.Rotation(ang, 3, axis) @ across).normalized()
        petal_card(b, top + axis * (0.004 * k), axis, aro, math.radians(84), ln * HEAD, FC.uv(cell), W, fold=0.1)


def hyacinth(b, top, axis, across, rng, i):
    # florets round the spike, from its foot up to its tip, each facing out
    n = 18
    for k in range(n):
        f = k / (n - 1)
        a = k * 2.4
        aro = (Matrix.Rotation(a, 3, axis) @ across).normalized()
        c = top + axis * (f * 0.2 - 0.02) * HEAD + aro * 0.035 * HEAD * (1 - 0.4 * f)
        s = 0.075 * HEAD * (1 - 0.35 * f)
        side = axis.cross(aro).normalized()
        n_ = aro
        up = axis
        pts = [c + side * s / 2 - up * s / 2, c - side * s / 2 - up * s / 2, c - side * s / 2 + up * s / 2, c + side * s / 2 + up * s / 2]
        cell = FC.uv("hyacinth-floret")
        ids = [b.vert(p, (n_ + axis * 0.4).normalized()) for p in pts]
        b.face(ids, [K.cell_uv(cell, -1, -1), K.cell_uv(cell, 1, -1), K.cell_uv(cell, 1, 1), K.cell_uv(cell, -1, 1)], W)


def lily(b, top, axis, across, rng, i):
    ring(b, top, axis, across, 6, "lily-cream", 0.2, math.radians(48), W, fold=0.25, curl=0.7, rng=rng, jit=0.05)
    dome(b, top + axis * 0.01 * HEAD, axis, 0.018, 0.05, FC.centre_uv("button"), W, segs=6)


def meadow(b, top, axis, across, rng, i):
    # game/village-art (David, 2026-10-26: nature-feel.jpg, "not just empty"): wild daisies, every third a buttercup
    if i % 3 == 2:
        ring(b, top, axis, across, 5, "mum-gold", 0.06, math.radians(62), W, fold=0.3, rng=rng, jit=0.08)
    else:
        ring(b, top, axis, across, 7, "windflower-white", 0.075, math.radians(80), W, rng=rng, jit=0.08)
        dome(b, top + axis * 0.006 * HEAD, axis, 0.02, 0.016, FC.centre_uv("yellow"), W, segs=5)


FLOWERS = {
    "mum": dict(head=mum, stems=4, spread=0.22, height=(0.22, 0.32), leaves=2, rosette=7, face=0.3),
    "cosmos": dict(head=cosmos, stems=5, spread=0.24, height=(0.28, 0.4), leaves=2, leaf_len=0.12, rosette=6, face=0.35),
    "rose": dict(head=rose, stems=3, spread=0.2, height=(0.22, 0.3), leaves=3, rosette=7, face=0.3),
    "windflower": dict(head=windflower, stems=4, spread=0.22, height=(0.2, 0.28), leaves=2, rosette=7, face=0.35),
    "tulip": dict(head=tulip, stems=4, spread=0.2, height=(0.24, 0.32), leaves=0, straps=7, strap_len=0.26, face=0.12),
    "pansy": dict(head=pansy, stems=5, spread=0.22, height=(0.1, 0.18), leaves=0, rosette=8, face=0.8, lean=0.2),
    "hyacinth": dict(head=hyacinth, stems=3, spread=0.18, height=(0.14, 0.2), leaves=0, straps=7, strap_len=0.24, face=0.08, stem=0.012),
    "lily": dict(head=lily, stems=3, spread=0.2, height=(0.34, 0.42), leaves=3, leaf_len=0.14, rosette=6, face=0.6),
    # game/village-art: a patch of wild meadow flowers in grass blades (a tile across), and a clump of tall grass blades
    # for the path's edges and the meadows; they carry no season of their own.
    "meadow": dict(head=meadow, stems=12, spread=0.48, height=(0.12, 0.24), leaves=1, leaf_len=0.1, straps=12, strap_len=0.2, strap_foot=0.4,
                   strap_rise=2.6, face=0.3, stem=0.007),
    "tallgrass": dict(head=None, stems=0, spread=0.2, height=(0, 0), straps=30, strap_len=0.42, strap_foot=0.16, strap_rise=3.4),
}


def main():
    names = [a for a in ARGS if a in FLOWERS] or list(FLOWERS)
    written = [build(n) for n in names]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)


main()
