"""Single low-poly forest trees for the closed forest (terrain v3). game/village-art2 made the first four from the forest
masses' makers; game/trees-art remodelled them as twelve trees that each grow their own way (David, R2d 2026-10-26: "can
you model better looking low poly trees instead of copy pasting 1 model", and earlier "i just need a low render for
performance that also looks like busy forest over there but also look natural"; the feel is
specs/references/terrain/r2-2026-10-26/nature-feel.jpg: soft lumpy crowns on tall trunks, pale birches, dark firs).

terrain-v3 instances each kind, every tree at its own uniform scale (never stretched), turn, tint and ground height.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_forest_trees.py [-- forest|river|<model>... [review <dir>]]

Writes web/public/assets/game/plants/forest-tree-<name>.glb and river-tree-<name>.glb, glTF y up, the trunk's foot at the origin on the ground (the
trunk runs SINK under it, so a tree on a slope sinks in instead of standing on a stilt), at scale 1, then
web/scripts/finish-greenery.mjs. Two draws a kind (the snag one):
  mForestCrown  the crowns, opaque, on one painted 256 px texture: needle strokes in its top half for the conifers, leaf
                dabs in its bottom half for the broadleaves. The texture is near grey; the green and the shade ride in
                COLOR_0, so the per-instance tint (multiplied on this material) shifts the hue cleanly.
  mTreeTrunk    the trunk and limbs in plain colour (COLOR_0), never tinted.

  cedar     layered cedar, flat drooping shelves with the trunk between, 8 tall, 4.6 across
  fir       tall fir, 10 tall, 3 across
  spire     slender spire, 12 tall, 2 across
  old-fir   broad old fir, skirts to the ground, 9 tall, 5.4 across
  leaning   conifer leaning one way (+x) and curving back up, 8 tall
  broken    fir with a snapped top and a side leader grown up past it, 7.6 tall
  young     young conifer, 3.4 tall
  broadleaf oak-like, a round crown of lumps on a forked bole, 6.6 tall, 5 across
  birch     pale trunk, loose small lumps up a tall stem, 7.6 tall
  wide      wide spreading crown on two big limbs, 6.2 tall, 6.6 across
  sapling   broadleaf sapling, 2.6 tall
  snag      dead snag, bare grey with a broken top, 6 tall (one draw)
The riverbank trees, few and richer (David, R2d, the river: "trees a bit small and look like bushes, still doesnt feel
natural"; redone by art-r2f after R2e: "redo these tree models", the crowns sat like lollipops on thin bent trunks):
full crowns of lumps built round the limbs that carry them, starting low on thick trunks.
  willow    weeping willow, a broad low dome on a stout forked bole, long curtains hung all round it two rings deep,
            falling nearly to the ground, 7.7 tall, 7.5 across
  alder     a group of three alders from one root, upright oval crowns merging, 9.3 tall, 4.8 across
  oak       spreading riverside oak, five heavy limbs nearly level from a short thick bole, a broad dome hanging low at
            its rim, 8.3 tall, 9.8 across
  lean      leaning out over the water to +x, a thick bowed stem, its crown full along its last third, 8.7 tall,
            reaching x 6.8
Seeded: a rebuild writes the same models.
"""
import math, os, random, subprocess, sys
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SINK = 0.8
NEEDLE, LEAF = (0, 0.53, 1, 0.98), (0, 0.02, 1, 0.47)  # kept off the halves' seam, so neither bleeds into the other
BARK, BIRCH, DEAD = K.lin("#6e5240"), K.lin("#e2dccb"), K.lin("#8a7f72")
STRAIGHT = lambda z: Vector((0, 0, 0))


def crown_image():
    """The crowns' texture, 256 square and near grey (the hue rides in COLOR_0): overlapping leaf dabs, each a touch
    darker at its rim, in the bottom half (v 0..0.5); short needle strokes hanging down in the top half."""
    rng = np.random.default_rng(7)
    S, H = 256, 128
    val = np.full((S, S), 0.86, np.float32)
    for _ in range(900):
        cx, cy, r = rng.uniform(0, S), rng.uniform(-4, H + 4), rng.uniform(4, 9)
        xs = np.arange(int(cx - r) - 1, int(cx + r) + 2)
        ys = np.arange(max(0, int(cy - r) - 1), min(H, int(cy + r) + 2))
        if not len(ys):
            continue
        dy, dx = np.meshgrid(ys - cy, xs - cx, indexing="ij")
        m = np.clip(1 - (dx ** 2 + (dy * 1.2) ** 2) / r ** 2, 0, 1) ** 0.5
        tone = rng.uniform(0.7, 1.0) * (0.82 + 0.18 * m)
        win = np.ix_(ys, xs % S)
        val[win] = val[win] * (1 - m) + tone * m
    for _ in range(1500):
        x0, y0 = rng.uniform(0, S), rng.uniform(H, S + 8)
        a, n = -math.pi / 2 + rng.uniform(-0.45, 0.45), int(rng.uniform(5, 14))
        tone = rng.uniform(0.6, 1.0)
        for s in range(n):
            x, y = int(x0 + math.cos(a) * s) % S, int(y0 + math.sin(a) * s)
            if H <= y < S:
                val[y, x] = val[y, (x + 1) % S] = tone * (1.0 - 0.25 * s / n)
    val = (val * 2 + np.roll(val, 1, 0) + np.roll(val, -1, 0) + np.roll(val, 1, 1) + np.roll(val, -1, 1)) / 6
    rgb = np.clip(val[..., None] * np.array([0.95, 1.0, 0.9]), 0, 1)
    px = np.concatenate([rgb, np.ones((S, S, 1))], axis=2).astype(np.float32)
    img = bpy.data.images.new("forest-crown", S, S, alpha=False)
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def soft(p, c, up=0.4):
    """A crown's soft normal: out of its centre and lifted, so lumps and layers shade as one mass."""
    d = p - c
    return (d.normalized() + Vector((0, 0, up))).normalized() if d.length > 1e-5 else Vector((0, 0, 1))


def at(axis, z):
    a = axis(z)
    return Vector((a.x, a.y, z))


def shaded(col, s):
    return tuple(ch * s for ch in col)


# ================================================================ conifers
def tier(b, axis, hem, top, r, segs, rng, col, droop, off=Vector((0, 0, 0)), under=False):
    """One layer of a conifer: an apex over a shoulder ring and a hem of fingers, every other one longer and hanging
    lower, each at its own reach; shaded dark at the hem, light at the apex. `off` shifts the layer off the axis."""
    n = segs * 2
    ph = rng.uniform(0, math.tau)
    c = at(axis, (hem + top) / 2) + off
    apex = b.vert(at(axis, top), Vector((0, 0, 1)))
    zm = hem + (top - hem) * 0.4
    tilt = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * 0.1
    mid, rim = [], []
    for k in range(n):
        a = ph + math.tau * (k + rng.uniform(-0.2, 0.2)) / n
        d = Vector((math.cos(a), math.sin(a), 0))
        long = k % 2 == 0
        reach = r * (1.0 if long else 0.76) * rng.uniform(0.85, 1.12)
        pm = at(axis, zm) + off * 0.6 + d * reach * 0.58
        pr = at(axis, hem) + off + d * reach - Vector((0, 0, droop * reach * (1.0 if long else 0.5) - tilt.dot(d) * reach))
        mid.append(b.vert(pm, soft(pm, c, 0.5)))
        rim.append(b.vert(pr, soft(pr, c, 0.15)))
    uv = lambda k, t: (NEEDLE[0] + K.tri_wave(k / n * 2), NEEDLE[1] + (NEEDLE[3] - NEEDLE[1]) * t)
    sh = lambda t: shaded(col, 0.62 + 0.48 * t)
    for k in range(n):
        k2 = (k + 1) % n
        b.face([apex, mid[k], mid[k2]], [uv(k + 0.5, 1), uv(k, 0.45), uv(k + 1, 0.45)], [sh(1), sh(0.62), sh(0.62)])
        b.face([mid[k], rim[k], rim[k2], mid[k2]], [uv(k, 0.45), uv(k, 0), uv(k + 1, 0), uv(k + 1, 0.45)], [sh(0.62), sh(0), sh(0), sh(0.62)])
    if under:
        hub = b.vert(at(axis, hem + (top - hem) * 0.25), Vector((0, 0, -1)))
        for k in range(n):
            k2 = (k + 1) % n
            b.face([rim[k2], rim[k], hub], [uv(k + 1, 0), uv(k, 0), uv(k + 0.5, 0.3)], [shaded(col, 0.4)] * 3)


def conifer(b, h, base, r0, tiers, segs, col, seed, axis=STRAIGHT, overlap=1.75, droop=0.25, taper=0.82, sway=0.0):
    """Layers up the axis from `base` to the tip at h, each narrower (taper) and a touch lighter than the one under it;
    sway pushes each layer a little off the axis, its own way."""
    rng = random.Random(seed)
    span = h - base
    for t in range(tiers):
        f = t / tiers
        hem = base + span * f * 0.93 + rng.uniform(-0.04, 0.04) * span / tiers
        top = h if t == tiers - 1 else min(hem + span / tiers * overlap, h)
        r = r0 * (1 - taper * f) * rng.uniform(0.9, 1.08)
        a = rng.uniform(0, math.tau)
        off = Vector((math.cos(a), math.sin(a), 0)) * r * sway * rng.uniform(0.3, 1)
        tier(b, axis, hem, top, r, max(4, segs - t // 2), rng, shaded(col, 0.82 + 0.3 * f), droop, off, under=t == 0)


# ================================================================ broadleaves
def lump(b, q, r, sq, col, tone, seed, c, lo, hi, segs=7):
    """One lump of leaves round q (r across, sq tall), a wobbled ellipsoid lit darker under it and lighter up the
    whole crown (lo to hi), its normals leaning out of the crown's middle c so the lumps shade as one mass."""
    first = len(b.faces)
    K.ellipsoid(b, q, Vector((r, r, sq)), LEAF,
                lambda v: shaded(col, tone * (0.5 + 0.3 * min(1, max(0, (v.z - q.z) / sq * 0.5 + 0.5)) + 0.32 * min(1, max(0, (v.z - lo) / (hi - lo))))),
                segs=segs, rings=4, wobble=0.16, seed=seed, normal_of=lambda v: (soft(v, c, 0.3) * 0.75 + (v - q).normalized() * 0.25).normalized())
    # The kit's UVs run the atlas twice round in steps of segs / 4, flat (one texel column) on some faces at 6 or 7
    # sides: wrap the leaves once round each lump, mirrored, and up it, from the points themselves.
    for f in range(first, len(b.faces)):
        b.uvs[f] = [(K.tri_wave(math.atan2(b.verts[k].y - q.y, b.verts[k].x - q.x) / math.pi + 1),
                     LEAF[1] + (LEAF[3] - LEAF[1]) * min(1, max(0, (b.verts[k].z - q.z) / sq * 0.5 + 0.5))) for k in b.faces[f]]


def crown(b, c, R, lumps, col, seed, flat=0.78, spread=0.55, size=(0.42, 0.58), lift=(-0.2, 0.65), segs=7):
    """A broadleaf crown round c: a big middle lump and `lumps` more round it (golden-angle turns, each its own
    height and size), wobbled low ellipsoids whose normals lean out of the whole crown. Returns the lumps' centres."""
    rng = random.Random(seed)
    ph = rng.uniform(0, math.tau)
    spots = [(c + Vector((0, 0, R * 0.12)), R * 0.62)]
    for i in range(lumps):
        az, el = ph + i * 2.4, rng.uniform(*lift)
        d = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el) * flat))
        spots.append((c + d * R * spread * rng.uniform(0.85, 1.15), R * rng.uniform(*size)))
    lo, hi = c.z - R * flat, c.z + R * flat
    for i, (q, r) in enumerate(spots):
        lump(b, q, r, r * 0.8, col, rng.uniform(0.92, 1.06), seed * 7 + i, c, lo, hi, segs)
    return [q for q, _ in spots]


def trunk(w, top, r, col, axis=STRAIGHT, sides=5, rings=3, col_of=None):
    """The bole from SINK under the ground to `top`, flared at the foot, darker toward the ground."""
    zs = [-SINK, 0.0, 0.45] + [0.45 + (top - 0.45) * (i + 1) / rings for i in range(rings)]
    radii = [r * 1.45, r * 1.32, r] + [r * (1 - 0.5 * (i + 1) / rings) for i in range(rings)]
    K.tube(w, [at(axis, z) for z in zs], radii, sides, col_of or (lambda q: shaded(col, 0.6 + 0.4 * min(1, max(0, q.z + 0.3) / 2.5))))


def limb(w, a, b_, r, col, rise=0.25):
    """A branch from a to b_, bowed up at its middle."""
    m = (a + b_) / 2 + Vector((0, 0, (b_ - a).length * rise))
    K.tube(w, [a, m, b_], [r, r * 0.7, r * 0.35], 4, lambda q: shaded(col, 0.85))


# ================================================================ the twelve
def t_cedar(b, w):
    conifer(b, 8.0, 1.7, 2.4, 5, 7, K.lin("#7da66c"), 21, overlap=0.62, droop=0.1, taper=0.62, sway=0.22)
    trunk(w, 7.0, 0.27, BARK)


def t_fir(b, w):
    conifer(b, 10.0, 1.3, 1.5, 6, 6, K.lin("#5f9268"), 22, overlap=1.8, droop=0.3, taper=0.84)
    trunk(w, 8.0, 0.24, BARK)


def t_spire(b, w):
    conifer(b, 12.0, 2.0, 1.0, 7, 5, K.lin("#689b70"), 23, overlap=1.9, droop=0.34, taper=0.72)
    trunk(w, 10.0, 0.2, BARK)


def t_old_fir(b, w):
    conifer(b, 9.0, 1.1, 2.8, 5, 7, K.lin("#5a8a62"), 24, overlap=1.7, droop=0.32, taper=0.86, sway=0.14)
    trunk(w, 6.0, 0.36, BARK)


def t_leaning(b, w):
    axis = lambda z: Vector((0.6 * z * (1 - 0.45 * z / 8.0), 0, 0))
    conifer(b, 8.0, 1.6, 1.6, 5, 6, K.lin("#6c9c6a"), 25, axis=axis, overlap=1.75, droop=0.26, taper=0.8)
    trunk(w, 7.0, 0.24, BARK, axis=axis)


def t_broken(b, w):
    """Layers to 6, the bare snapped stem to 7, and a side leader that took over, up to 7.6."""
    conifer(b, 6.0, 1.4, 1.7, 4, 6, K.lin("#62946a"), 26, overlap=1.7, droop=0.28, taper=0.55)
    trunk(w, 6.9, 0.25, BARK)
    tip = Vector((0, 0, 6.9))
    K.tube(w, [tip - Vector((0, 0, 0.3)), tip + Vector((0.05, 0, 0.25))], [0.12, 0.05], 4, lambda q: shaded(DEAD, 1.0), cap=True)
    foot, lead = Vector((0, 0, 4.9)), Vector((0.75, 0.2, 0))
    limb(w, foot, foot + lead + Vector((0, 0, 1.4)), 0.12, BARK, rise=0.05)
    side = lambda z: lead * min(1, max(0, (z - 4.9) / 1.4))
    conifer(b, 7.6, 5.6, 0.75, 2, 5, K.lin("#6f9f6e"), 27, axis=side, overlap=1.8, droop=0.2, taper=0.5)


def t_young(b, w):
    conifer(b, 3.4, 0.35, 1.05, 3, 5, K.lin("#80ae6c"), 28, overlap=1.7, droop=0.2, taper=0.75)
    trunk(w, 2.6, 0.13, BARK, rings=2)


def t_broadleaf(b, w):
    fork = Vector((0.1, 0, 2.4))
    tips = crown(b, Vector((0.15, 0.05, 4.5)), 2.5, 6, K.lin("#8fbc5a"), 31, lift=(-0.25, 0.55))
    trunk(w, fork.z, 0.3, BARK)
    for q in tips[1:5:2]:
        limb(w, fork, fork + (q - fork) * 0.72, 0.17, BARK)


def t_birch(b, w):
    """A tall pale stem with dark bands, and loose small lumps hung up its top half, sky between them."""
    birch = lambda q: shaded(BIRCH, (0.55 if math.sin(q.z * 4.1 + q.x * 6) > 0.72 else 1.0) * (0.45 + 0.55 * min(1, max(0, q.z + 0.2) / 1.2)))
    trunk(w, 7.2, 0.16, BIRCH, sides=6, rings=4, col_of=birch)
    tips = crown(b, Vector((0, 0, 5.6)), 1.9, 5, K.lin("#a9c967"), 32, flat=1.15, spread=0.85, size=(0.36, 0.5), lift=(-0.6, 0.7))
    for q in tips[1:4]:
        limb(w, Vector((0, 0, q.z - 0.9)), q, 0.06, BIRCH, rise=0.1)


def t_wide(b, w):
    """A short bole that splits into two big limbs, a broad flat crown over them."""
    fork = Vector((0, 0, 1.9))
    trunk(w, fork.z, 0.34, BARK)
    tips = crown(b, Vector((0, 0, 4.4)), 3.3, 6, K.lin("#86b45a"), 33, flat=0.55, spread=0.72, size=(0.36, 0.48), lift=(-0.2, 0.35))
    for q in (tips[1], tips[4]):
        limb(w, fork, fork + (q - fork) * 0.8, 0.2, BARK, rise=0.12)


def t_sapling(b, w):
    trunk(w, 1.9, 0.07, BARK, sides=4, rings=2)
    crown(b, Vector((0.05, 0, 2.0)), 0.75, 2, K.lin("#a2c862"), 34, flat=0.9, spread=0.7, size=(0.5, 0.62))


def t_snag(b, w):
    """A bare grey bole to a broken top, three stubs of branches."""
    rng = random.Random(35)
    bark = lambda q: shaded(DEAD, 0.6 + 0.4 * min(1, max(0, q.z + 0.3) / 2.5))
    lean = lambda z: Vector((0.04 * z, 0.02 * z, 0))
    trunk(w, 6.0, 0.28, DEAD, axis=lean, sides=6, rings=3, col_of=bark)
    for z in (2.6, 3.7, 4.9):
        a, s = rng.uniform(0, math.tau), at(lean, z)
        K.tube(w, [s, s + Vector((math.cos(a), math.sin(a), 0.55)) * rng.uniform(0.7, 1.2)], [0.08, 0.03], 4, bark)


# ================================================================ river trees (art-r2f, David's R2e note: "redo these tree models")
# Full crowns sized to their trunks, starting low on them, built round the limbs that carry them; trunks thick enough.
def canopy(b, w, fork, spots, col, seed, bark=BARK, limb_r=0.2, segs=7):
    """Lumps of leaves at `spots` [(centre, across, tall)], each fed by a limb from the fork (or from the point given
    with it) that ends inside it; lit as one crown round their middle."""
    rng = random.Random(seed)
    c = sum((q for q, *_ in spots), Vector()) / len(spots)
    lo, hi = min(q.z - h for q, r, h, *_ in spots), max(q.z + h for q, r, h, *_ in spots)
    for i, (q, r, h, *src) in enumerate(spots):
        lump(b, q, r, h, col, rng.uniform(0.9, 1.06), seed * 7 + i, c, lo, hi, segs)
        if src and src[0] is not None:
            limb(w, src[0], src[0] + (q - src[0]) * 0.8, limb_r * src[1], bark, rise=0.12)
    return c


def strand(b, top, d, length, width, col, c, tone):
    """A willow's hanging curtain: a broad ribbon folded out along its middle, arching out of the crown, then falling
    straight and narrowing a little to a blunt tip; the needle strokes run down it."""
    s = Vector((-d.y, d.x, 0))
    pts = [top, top + d * 0.35 - Vector((0, 0, length * 0.12)), top + d * 0.5 - Vector((0, 0, length * 0.55)), top + d * 0.56 - Vector((0, 0, length))]
    rows = []
    for i, p in enumerate(pts):
        t, w = i / 3, width * (1 - 0.5 * i / 3)
        n = (soft(p, c, 0.1) + d).normalized()
        rows.append([(b.vert(p + s * w / 2, n), 0.0, t), (b.vert(p + d * w * 0.3, n), 0.5, t), (b.vert(p - s * w / 2, n), 1.0, t)])
    uv = lambda e: (e[1], NEEDLE[1] + (NEEDLE[3] - NEEDLE[1]) * (1 - e[2]))
    sh = lambda e: shaded(col, tone * (0.6 + 0.42 * e[2]))
    for i in range(3):
        for k in range(2):
            q = [rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]]
            b.face([e[0] for e in q], [uv(e) for e in q], [sh(e) for e in q])


def r_willow(b, w):
    """A weeping willow: a stout leaning bole forking into three limbs under a broad low dome of leaves, and long
    curtains hung all round it, two rings deep, falling nearly to the ground."""
    rng = random.Random(41)
    axis = lambda z: Vector((0.1 * z, 0.04 * z, 0))
    fork = at(axis, 2.6)
    trunk(w, 2.9, 0.55, BARK, axis=axis, sides=7, rings=2)
    c, col = Vector((0.4, 0.15, 5.7)), K.lin("#a6c55e")
    spots = [(c + Vector((0, 0, 0.5)), 2.3, 1.5, fork, 1.2)]
    for i in range(6):
        a = i * math.tau / 6 + rng.uniform(-0.25, 0.25)
        q = c + Vector((math.cos(a) * 2.2, math.sin(a) * 2.2, rng.uniform(-0.5, 0.1)))
        spots.append((q, rng.uniform(1.5, 1.8), rng.uniform(1.0, 1.2), fork if i % 2 else None, 1.0))
    canopy(b, w, fork, spots, col, 42, limb_r=0.22, segs=8)
    for ring, n, rad, z, L, tone in ((0, 40, (2.6, 3.2), (-0.9, 0.0), (3.0, 4.6), (0.86, 1.06)), (1, 14, (1.5, 2.1), (0.4, 1.1), (3.0, 4.0), (0.74, 0.92))):
        for i in range(n):
            a = i * math.tau / n + ring * 0.2 + rng.uniform(-0.1, 0.1)
            d = Vector((math.cos(a), math.sin(a), 0))
            top = c + d * rng.uniform(*rad) + Vector((0, 0, rng.uniform(*z)))
            strand(b, top, d, rng.uniform(*L), rng.uniform(1.0, 1.35), col, c, rng.uniform(*tone))


def r_alder(b, w):
    """A group of three alders from one root, their grey-brown stems leaning a little apart, each with an upright
    oval crown from low on it to its top, the crowns merging."""
    rng = random.Random(43)
    bark = K.lin("#6f6455")
    for k, (h, r, a) in enumerate(((9.0, 0.27, 0.3), (7.8, 0.23, 2.5), (6.8, 0.21, 4.4))):
        d = Vector((math.cos(a), math.sin(a), 0))
        axis = lambda z, d=d, k=k: d * (0.3 + 0.1 * z) if k else d * 0.04 * z
        trunk(w, h - 1.2, r, bark, axis=axis, sides=6, rings=3)
        spots = []
        for j, f in enumerate((0.48, 0.6, 0.72, 0.84)):
            z = h * f
            off = Vector((math.cos(a + j * 2.1), math.sin(a + j * 2.1), 0)) * h * 0.09
            spots.append((at(axis, z) + off, h * (0.17 - 0.02 * j) * rng.uniform(0.9, 1.1), h * 0.16, at(axis, z - 1.2), 0.5))
        spots.append((at(axis, h * 0.94), h * 0.1, h * 0.09, None))
        canopy(b, w, None, spots, K.lin("#7caa54"), 43 + k, bark=bark, limb_r=0.18)


def r_oak(b, w):
    """A spreading riverside oak: a short thick flared bole splitting into five heavy limbs that reach out nearly
    level, then up; a broad irregular dome of clusters at their ends and between, its rim hanging low."""
    rng = random.Random(44)
    fork = Vector((0, 0, 2.4))
    trunk(w, 2.9, 0.58, BARK, sides=7, rings=2)
    col, ph, spots, ends = K.lin("#8ab656"), rng.uniform(0, math.tau), [], []
    for i in range(5):
        a = ph + i * math.tau / 5 + rng.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0))
        end = fork + d * rng.uniform(3.0, 3.6) + Vector((0, 0, rng.uniform(1.8, 2.6)))
        K.tube(w, [fork, fork + d * 1.5 + Vector((0, 0, 0.5)), end], [0.3, 0.2, 0.1], 5, lambda q: shaded(BARK, 0.85))
        ends.append(end)
        spots.append((end + Vector((0, 0, 0.35)), rng.uniform(1.7, 2.0), rng.uniform(1.25, 1.45), None))
        spots.append((fork + d * 3.6 + Vector((0, 0, 1.0)), rng.uniform(1.0, 1.2), 0.8, None))           # the rim hanging low
        m = Vector((math.cos(a + math.pi / 5), math.sin(a + math.pi / 5), 0))
        spots.append((fork + m * 2.9 + Vector((0, 0, 3.0)), rng.uniform(1.5, 1.7), 1.2, fork + m * 1.0 + Vector((0, 0, 0.4)), 0.8))
    for i in range(3):
        a = ph + i * math.tau / 3 + 0.5
        spots.append((fork + Vector((math.cos(a) * 1.2, math.sin(a) * 1.2, 4.4)), rng.uniform(1.9, 2.1), 1.4, fork, 1.0))
    canopy(b, w, fork, spots, col, 44, limb_r=0.18)


def r_lean(b, w):
    """A riverside tree leaning out over the water (+x): a thick stem bowed out and turning back up, its crown full
    along the last third of it and round its top, hanging lower on the water's side."""
    rng = random.Random(45)
    axis = lambda z: Vector((0.95 * z - 0.06 * z * z, 0, 0))
    trunk(w, 6.0, 0.45, BARK, axis=axis, sides=6, rings=4)
    spots = []
    for j, z in enumerate((3.4, 4.3, 5.1, 5.8)):
        p = at(axis, z)
        for sg in (-1, 1):
            spots.append((p + Vector((0.2 * j, sg * rng.uniform(1.0, 1.4), 0.6 + 0.2 * j)), rng.uniform(1.3, 1.6), 1.1, p, 0.7))
    top = at(axis, 6.0)
    spots += [(top + Vector((0.4, 0, 1.3)), 2.0, 1.4, None), (top + Vector((1.6, 0.3, 0.2)), 1.5, 1.1, top - Vector((0.3, 0, 0.3)), 0.8),
              (top + Vector((-1.0, -0.3, 1.0)), 1.5, 1.1, None)]
    canopy(b, w, None, spots, K.lin("#93bd5a"), 45, limb_r=0.18)


TREES = {"forest-tree-" + k: f for k, f in {
    "cedar": t_cedar, "fir": t_fir, "spire": t_spire, "old-fir": t_old_fir, "leaning": t_leaning, "broken": t_broken,
    "young": t_young, "broadleaf": t_broadleaf, "birch": t_birch, "wide": t_wide, "sapling": t_sapling, "snag": t_snag}.items()}
TREES.update({"river-tree-" + k: f for k, f in {"willow": r_willow, "alder": r_alder, "oak": r_oak, "lean": r_lean}.items()})
ROWS = {"forest": (("conifers", ["cedar", "fir", "spire", "old-fir", "leaning", "broken", "young"]),
                   ("broadleaves", ["broadleaf", "birch", "wide", "sapling", "snag"])),
        "river": (("river", ["willow", "alder", "oak", "lean"]),)}


def build(name):
    K.reset()
    crown_b, wood = K.Build(), K.Build()
    TREES[name](crown_b, wood)
    objs = [wood.object("Trunk", K.plain("mTreeTrunk", (1, 1, 1)))]
    if crown_b.faces:
        objs.insert(0, crown_b.object("Crown", K.material("mForestCrown", crown_image())))
    out = os.path.join(K.OUT, f"{name}.glb")
    K.export(objs, out)
    print(f"TREE {name}: tris {({o.name: K.tris(o) for o in objs})}")
    return out


def review(out, group, ground=(26, 18), seed=5):
    """A lineup of each row of kinds (the river trees among shrubs), then for the forest a grove of every kind packed
    close, each its own scale and turn."""
    sys.path.insert(0, os.path.join(K.HERE, "..", "props"))
    import propkit as P
    stem = lambda n: n if n.startswith("shrub-") else f"{group}-tree-{n}"
    rows = ROWS[group]
    names = [n for _, row in rows for n in row]
    for mode, row in (*rows, ("grove", names)) if group == "forest" else rows:
        K.reset()
        rng = random.Random(seed)
        obs, spots = [], []
        if group == "river":
            spots = [(x, y, n, 1.0) for (x, y), n in zip(((-4, 3.5), (4, 4), (-4, -4), (3, -3.5)), row)]
            spots += [(x, y, f"shrub-{k}", 1.0) for (x, y), k in zip(((-1.5, 1), (1.2, 0.5), (-1, -1.8), (6.5, 0.5), (0.5, 6)), "acebd")]
        elif mode != "grove":
            spots = [(-2.2 * (len(row) - 1) + 4.4 * i, 0, row[i], 1.0) for i in range(len(row))]
        else:
            while len(spots) < 46:
                q = (rng.uniform(-ground[0] / 2 + 2, ground[0] / 2 - 2), rng.uniform(-ground[1] / 2 + 2, ground[1] / 2 - 2))
                if all(math.hypot(q[0] - a, q[1] - c) > 2.0 for a, c, *_ in spots):
                    spots.append((*q, names[len(spots) % len(names)], rng.uniform(0.8, 1.2)))
        for x, y, nm, s in spots:
            bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"{stem(nm)}.glb"))
            turn = 0.0 if nm == "lean" else rng.uniform(0, math.tau)
            for o in bpy.context.selected_objects:
                if o.type == "MESH":
                    o.location, o.rotation_euler[2], o.scale = (x, y, 0), turn, (s, s, s)
                    if o.data.color_attributes:
                        o.data.color_attributes[0].name = "Color"
                    obs.append(o)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
        g = bpy.context.active_object
        g.scale = (4.4 * len(row) + 2, 8, 1) if mode == "conifers" or mode == "broadleaves" else (*ground, 1)
        m = bpy.data.materials.new("ground")
        m.use_nodes = True
        next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*K.lin("#8fa16c"), 1)
        g.data.materials.append(m)
        bpy.context.view_layer.update()
        views = ((0, 22), (35, 38)) if mode == "grove" else ((0, 8),) if group == "forest" else ((35, 14), (215, 14))
        P.review(obs, os.path.join(out, f"{mode}.png"), views=views, size=1000)


if __name__ == "__main__":
    groups = [g for g in ROWS if g in ARGS]
    names = [n for n in TREES if n in ARGS or n.split("-tree-")[0] in groups] or list(TREES)
    written = [build(n) for n in names]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)
    if "review" in ARGS:
        for g in groups or ROWS:
            review(os.path.join(ARGS[ARGS.index("review") + 1], g), g)
