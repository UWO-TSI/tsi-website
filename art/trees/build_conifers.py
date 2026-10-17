"""The village's cedars (game/remodel-trees), replacing the ACNH cedar and snow cedar in the member world.

A straight trunk through tiers. Each tier is a closed cone of the painted needle mass (art/trees/paint_textures.py),
darker, under a skirt of fringe cards: each card hangs from near the trunk down the cone's slope and out past its rim,
its lower edge in rounded fingers (the dump's cedar, painted afresh), two rings of them a half step apart so the skirt
is closed from every side. Normals point out of the tier and up. The snow cedar wears the frosted fringe (white over
the top half, the green at the tips) and a lid of snow over each tier's top.

Writes web/public/assets/game/plants/conifer-cedar[-snow][.lod1].glb, then web/scripts/finish-greenery.mjs sets the
materials and checks the files.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_conifers.py [-- snow lod0 ...]
"""
import math, os, random, subprocess, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# Tiers bottom to top: (hem height, top height, rim radius). The dump's cedar stands 3.95 high and 1.08 round.
TIERS = [(0.95, 1.74, 1.06), (1.38, 2.18, 0.9), (1.8, 2.6, 0.72), (2.28, 3.02, 0.54), (2.72, 3.44, 0.38), (3.12, 3.92, 0.22)]
LODS = {
    0: dict(rings=2, spacing=0.36, segs=12, rows=4, sides=8, tex=(256, 256)),
    1: dict(rings=1, spacing=0.5, segs=7, rows=2, sides=5, tex=(128, 128)),
}
CORE_SHADE = 0.62


def cone(b, hem, top, r, rect, col_of, segs, normal_of, lid=False, i=0, rows=4):
    """A closed cone (rim at `hem`, apex at `top`), the rim's underside closed by a shallow cone up to the trunk.
    lid: no underside, its rim wavy: a cap of snow over a tier, the fingers of its fringe hanging out under it."""
    u0, v0, u1, v1 = rect
    ring, under = [], []
    apex = b.vert(Vector((0, 0, top)), normal_of(Vector((0, 0, top))))
    grid = []
    for j in range(rows + 1):
        f = j / rows
        z = top + (hem - top) * f
        rr = r * f
        row = []
        for k in range(segs):
            a = math.tau * k / segs
            wob = 1 + ((0.07 * math.sin(a * 5 + i) + 0.04 * math.sin(a * 11 + 2 * i)) * f if lid else 0.0)
            p = Vector((math.cos(a) * rr * wob, math.sin(a) * rr * wob, z))
            row.append(p)
        grid.append(row)
    vid = {}
    def v(j, k):
        k %= segs
        if j == 0:
            return apex
        if (j, k) not in vid:
            vid[(j, k)] = b.vert(grid[j][k], normal_of(grid[j][k]))
        return vid[(j, k)]
    def uv(j, k):
        return (u0 + K.INSET + (u1 - u0 - 2 * K.INSET) * K.tri_wave(k / segs * 4), v0 + K.INSET + (v1 - v0 - 2 * K.INSET) * K.tri_wave(j / rows))
    last = rows
    for j in range(last):
        for k in range(segs):
            if j == 0:
                b.face([apex, v(1, k), v(1, k + 1)], [uv(0, k + 0.5), uv(1, k), uv(1, k + 1)], [col_of(b.verts[x]) for x in (apex, v(1, k), v(1, k + 1))])
            else:
                ids = [v(j, k), v(j + 1, k), v(j + 1, k + 1), v(j, k + 1)]
                b.face(ids, [uv(j, k), uv(j + 1, k), uv(j + 1, k + 1), uv(j, k + 1)], [col_of(b.verts[x]) for x in ids])
    if lid:
        return
    # the underside: from the rim in and up to the trunk
    hub = b.vert(Vector((0, 0, hem + (top - hem) * 0.25)), Vector((0, 0, -1)))
    for k in range(segs):
        b.face([v(rows, k + 1), v(rows, k), hub], [uv(rows, k + 1), uv(rows, k), uv(rows - 1, k + 0.5)], [col_of(b.verts[x]) for x in (v(rows, k + 1), v(rows, k), hub)])


SNOW_SHADE = (0.76, 0.83, 0.93)  # where the snow rounds off under its lip: a soft cool shade, never a hard white edge


def snow_mound(b, t, hem, top, r, segs, i):
    """Snow on a tier as the dump's snow cedar holds it (David, round 2: "the snow should collect and stack near the
    top"): a pillow from the trunk out over the tier's upper slope, thicker and further out the higher the tier (t: 0
    the lowest, 1 the top, where it covers the tier to its fingertips), its rim wavy and rolled under in a soft lip,
    white on top and cool where it rounds off. The fringe's green fingers hang out below the lower tiers' snow."""
    # the upper half of the tree is snowed over to its fingertips (the dump's snow cone); lower down, the snow sits
    # on the tier's upper slope and the green fringe hangs out below it
    cover = 0.82 + 0.4 * min(1, t / 0.6)                    # how far out it reaches, of the tier's radius
    rim = hem + (top - hem) * 0.36 * max(0, 1 - t / 0.6) - 0.1 * max(0, (t - 0.6) / 0.4)
    lift = 0.1 + 0.16 * t                                   # how thick it stacks at the trunk
    u0, v0, u1, v1 = K.SNOW
    apex_z = top + lift
    # rows from the trunk out: (fraction out, drop below the slope, shade 0 white .. 1 cool)
    rows = [(0.0, 0.0, 0.0), (0.3, 0.0, 0.0), (0.6, 0.0, 0.05), (0.85, 0.0, 0.15), (1.0, 0.02, 0.35), (1.04, 0.07, 0.65), (0.95, 0.13, 1.0)]
    grid = []
    for j, (f, drop, cool) in enumerate(rows):
        row = []
        for k in range(segs):
            a = math.tau * k / segs
            wav = 1 + (0.07 * math.sin(a * 5 + i * 1.7) + 0.035 * math.sin(a * 11 + i)) * min(1, f * 1.5)
            rr = r * cover * f * wav
            z = apex_z - (apex_z - rim) * min(f, 1.0) ** 1.15 - drop + (0.03 * math.sin(a * 3 + i) * min(1, f))
            p = Vector((math.cos(a) * rr, math.sin(a) * rr, z))
            out = Vector((math.cos(a), math.sin(a), 0))
            nrm = (K.UP * (1.0 - 0.6 * cool) + out * (0.5 + 0.8 * cool) - K.UP * (0.9 if j == len(rows) - 1 else 0)).normalized()
            white = 0.94 + 0.06 * t
            col = tuple(white + (s_ - white) * cool for s_ in SNOW_SHADE)
            uv = (u0 + K.INSET + (u1 - u0 - 2 * K.INSET) * K.tri_wave(k / segs * 4), v0 + K.INSET + (v1 - v0 - 2 * K.INSET) * K.tri_wave(j / (len(rows) - 1)))
            row.append((b.vert(p, nrm), uv, col))
        grid.append(row)
    for j in range(len(rows) - 1):
        for k in range(segs):
            a, bb = grid[j][k], grid[j][(k + 1) % segs]
            c, d = grid[j + 1][(k + 1) % segs], grid[j + 1][k]
            if j == 0:
                # the apex row is one point repeated: a fan
                b.face([a[0], d[0], c[0]], [a[1], d[1], c[1]], [a[2], d[2], c[2]])
            else:
                b.face([a[0], d[0], c[0], bb[0]], [a[1], d[1], c[1], bb[1]], [a[2], d[2], c[2], bb[2]])


def build(snow, lod):
    K.reset()
    L = LODS[lod]
    rng = random.Random(f"cedar-{lod}")
    top_z = TIERS[-1][1]

    def normal_of(p):
        q = Vector((p.x, p.y, 0))
        out = q.normalized() if q.length > 1e-4 else Vector((0, 0, 0))
        return (out * 0.75 + K.UP * 0.55).normalized()

    def shade(p, base=1.0):
        h = p.z / top_z
        rr = Vector((p.x, p.y, 0)).length
        tier = min(TIERS, key=lambda t: abs(t[0] - p.z))
        out = min(1, rr / max(tier[2], 0.1))
        k = base * (0.72 + 0.3 * h) * (0.78 + 0.26 * out)
        return (k, k, k)

    crown = K.Build()
    for i, (hem, top, r) in enumerate(TIERS):
        cone(crown, hem + 0.08, top - 0.06, r * 0.86, K.MASS, lambda p: shade(p, CORE_SHADE), L["segs"], normal_of, rows=L["rows"])
    cards = 0
    for i, (hem, top, r) in enumerate(TIERS):
        slope = Vector((r, 0, hem - top)).normalized()
        for ring in range(L["rings"]):
            n = max(5, round(math.tau * r / L["spacing"]))
            phase = rng.uniform(0, math.tau) + ring * math.pi / n
            for k in range(n):
                a = phase + math.tau * k / n + rng.uniform(-0.08, 0.08)
                d = Vector((math.cos(a), math.sin(a), 0))
                t = Vector((-math.sin(a), math.cos(a), 0))
                lift = 0.05 + ring * 0.06
                ra, za = r * 0.12, top - lift                      # the card's top edge, near the trunk
                rb = r * (1.08 + 0.06 * ring) * rng.uniform(0.96, 1.06)
                zb = hem - 0.06 - ring * 0.04 + rng.uniform(-0.04, 0.03)  # its fingers, past the rim and a little below
                pa, pb = d * ra + Vector((0, 0, za)), d * rb + Vector((0, 0, zb))
                wa, wb = r * 0.18, math.tau * rb / n * (0.82 + 0.25 * ring) * rng.uniform(0.95, 1.1)
                corners = [pb - t * wb, pb + t * wb, pa + t * wa, pa - t * wa]
                # with snow, the upper tiers wear the fringes snowed to their fingertips (cells 8-11)
                deep = snow and i >= len(TIERS) * 0.5
                cell = K.CELLS[8 + rng.randrange(4)] if deep else K.CELLS[rng.randrange(8 if snow else 12)]
                flip = rng.random() < 0.5
                uvs = [K.cell_uv(cell, -1, -1, flip), K.cell_uv(cell, 1, -1, flip), K.cell_uv(cell, 1, 1, flip), K.cell_uv(cell, -1, 1, flip)]
                jit = rng.uniform(0.92, 1.06) * (0.92 + 0.08 * ring)
                col = tuple(c * jit for c in shade(pb))
                ids = [crown.vert(p, normal_of(p)) for p in corners]
                # wound to face out of the tier
                crown.face(ids, uvs, [tuple(min(1.2, c * (0.86 if j > 1 else 1.0)) for c in col) for j in range(4)])
                cards += 1
    if snow:
        n = len(TIERS)
        for i, (hem, top, r) in enumerate(TIERS):
            snow_mound(crown, i / (n - 1), hem, top, r, L["segs"] + (6 if lod == 0 else 0), i)

    wood = K.Build()
    path = [Vector((0, 0, -0.04)), Vector((0, 0, 0.3)), Vector((0.01, 0, 1.2)), Vector((0, 0.01, 2.4)), Vector((0, 0, top_z - 0.3))]
    radii = [0.2, 0.16, 0.13, 0.09, 0.04]

    bark = K.lin("#6e4630")  # plain colour: the bark texture is lost at play distance (lane rules)

    def bark_col(p):
        k = 0.8 + 0.2 * min(1, p.z / 0.3)
        k *= 1 - 0.3 * min(1, max(0, (p.z - 0.6) / 0.6))
        return tuple(c * k for c in bark)

    K.tube(wood, path, radii, L["sides"], bark_col, v_scale=0.7)
    hull = K.Build()
    for hem, top, r in TIERS:
        cone(hull, hem, top, r, K.MASS, lambda p: (1, 1, 1), 8 if lod == 0 else 6, normal_of, rows=1)
    stem = K.Build()
    K.tube(stem, path[:3], radii[:3], 5, lambda p: (1, 1, 1))

    tex = "needles-snow" if snow else "needles"
    objs = [crown.object("Crown", K.material("mNeedles", K.image(tex, L["tex"]), alpha_clip=True)),
            wood.object("Trunk", K.plain("mTreeTrunk")),
            hull.object("Hull", K.plain("mShadowShake")),
            stem.object("Stem", K.plain("mShadow"))]
    name = "conifer-cedar" + ("-snow" if snow else "") + (".lod1" if lod else "")
    path_out = os.path.join(K.OUT, name + ".glb")
    K.export(objs, path_out)
    counts = {o.name: K.tris(o) for o in objs}
    print(f"CONIFER {name}: cards {cards} tris {counts} visible {counts['Crown'] + counts['Trunk']}")
    return path_out


def main():
    snows = [s for s, word in ((False, "plain"), (True, "snow")) if word in ARGS] or [False, True]
    lods = [int(a[3:]) for a in ARGS if a.startswith("lod")] or [0, 1]
    written = [build(s, l) for s in snows for l in lods]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)


main()
