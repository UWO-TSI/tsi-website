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
    0: dict(rings=2, spacing=0.36, segs=12, rows=4, sides=8, tex=None),
    1: dict(rings=1, spacing=0.5, segs=7, rows=2, sides=5, tex=(256, 256)),
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
                cell = K.CELLS[rng.randrange(12)]
                flip = rng.random() < 0.5
                uvs = [K.cell_uv(cell, -1, -1, flip), K.cell_uv(cell, 1, -1, flip), K.cell_uv(cell, 1, 1, flip), K.cell_uv(cell, -1, 1, flip)]
                jit = rng.uniform(0.92, 1.06) * (0.92 + 0.08 * ring)
                col = tuple(c * jit for c in shade(pb))
                ids = [crown.vert(p, normal_of(p)) for p in corners]
                # wound to face out of the tier
                crown.face(ids, uvs, [tuple(min(1.2, c * (0.86 if j > 1 else 1.0)) for c in col) for j in range(4)])
                cards += 1
    if snow:
        for i, (hem, top, r) in enumerate(TIERS):
            cone(crown, hem + 0.1, top + 0.12, r * 1.0, K.SNOW, lambda p: (1.0, 1.0, 1.0), L["segs"] + (4 if lod == 0 else 0),
                 lambda p: (normal_of(p) + K.UP).normalized(), lid=True, i=i, rows=L["rows"])

    wood = K.Build()
    path = [Vector((0, 0, -0.04)), Vector((0, 0, 0.3)), Vector((0.01, 0, 1.2)), Vector((0, 0.01, 2.4)), Vector((0, 0, top_z - 0.3))]
    radii = [0.2, 0.16, 0.13, 0.09, 0.04]

    def bark_col(p):
        k = 0.8 + 0.2 * min(1, p.z / 0.3)
        k *= 1 - 0.3 * min(1, max(0, (p.z - 0.6) / 0.6))
        return (k, k, k)

    K.tube(wood, path, radii, L["sides"], bark_col, v_scale=0.7)
    hull = K.Build()
    for hem, top, r in TIERS:
        cone(hull, hem, top, r, K.MASS, lambda p: (1, 1, 1), 8 if lod == 0 else 6, normal_of, rows=1)
    stem = K.Build()
    K.tube(stem, path[:3], radii[:3], 5, lambda p: (1, 1, 1))

    tex = "needles-snow" if snow else "needles"
    objs = [crown.object("Crown", K.material("mNeedles", K.image(tex, L["tex"]), alpha_clip=True)),
            wood.object("Trunk", K.material("mTreeTrunk", K.image("bark-cedar", (64, 128) if lod else None))),
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
