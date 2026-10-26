"""The new world's palms (terrain v3; game/wharf-art redid them from David's references, 2026-10-26: palm-shape.jpg
"copy this reference but in the 3d model in our style where its not super super detailed", palm-style.jpg).

A tapering trunk curving up from a flared foot, ringed softly (each ring a light crest and a darker groove, shaded
smooth), a husk at its head, a cluster of coconuts under it, and two layers of broad fronds: an upper layer that rises
and arches over, a lower one that spreads and droops. Each frond is a card along an arching rib, folded down either
side of the rib like a roof, so its wide leaflets (art/trees/paint_textures.py palm-fronds) hang; its first stretch is
bare stem. Normals lean up out of the crown, so the fronds read light. Shadow casters as the cedars have
(mShadowShake: the fronds' flat strips; mShadow: the trunk).

Writes web/public/assets/game/plants/tree-palm-{tall,lean,short}.glb in game units at scale 1, the origin on the ground
at the trunk's foot, then web/scripts/finish-greenery.mjs sets the materials and checks the files.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_palms.py [-- tall lean short]
"""
import math, os, random, subprocess, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# height, lean (top's offset along +x), fronds (upper, lower), frond length, coconuts, seed
PALMS = {
    "tall": dict(h=4.8, lean=0.55, fronds=(5, 6), length=2.5, nuts=4, seed=1),
    "lean": dict(h=4.0, lean=1.5, fronds=(5, 6), length=2.4, nuts=3, seed=2),
    "short": dict(h=2.6, lean=0.3, fronds=(4, 5), length=2.0, nuts=3, seed=3),
}
TRUNK, HUSK = K.lin("#e0b274"), K.lin("#9a7442")
NUTS = [K.lin("#a9b84c"), K.lin("#b6c257"), K.lin("#8a5b30")]   # green, a lighter green, one ripe and brown
RING = 0.42           # the trunk's ring spacing (a crest and a groove)
STEPS = 7             # rows along a frond


def trunk_path(h, lean, n):
    """Points up the trunk: a curve that leans out and comes back a little upright at the top."""
    return [Vector((lean * (t ** 1.6) - 0.08 * lean * t, 0.0, h * t)) for t in (i / n for i in range(n + 1))]


def frond(crown, hull, base, az, elev, droop, length, width, hang, cell, shade):
    """One frond: a card along an arching rib from `base` out along azimuth az at elevation elev, bending down by droop;
    across it five points, the rib in the middle and each side folded down (by hang[0] near the rib, hang[1] at the
    edge), so the leaflets hang either side. It starts as a narrow stem and widens over its first rows."""
    side = Vector((-math.sin(az), math.cos(az), 0))
    out = Vector((math.cos(az), math.sin(az), 0))
    pts, p = [], base.copy()
    for i in range(STEPS + 1):
        pts.append(p.copy())
        ang = elev - droop * ((i + 1) / STEPS) ** 1.3
        p = p + Vector((math.cos(az) * math.cos(ang), math.sin(az) * math.cos(ang), math.sin(ang))) * (length / STEPS)
    u0, v0, u1, v1 = cell
    rows = []
    for i, q in enumerate(pts):
        s = i / STEPS
        w = width * min(1.0, 0.15 + 3 * s) * (1.0 - 0.3 * max(0.0, s - 0.7) / 0.3)   # a stem, widening to the leaf
        d = (pts[min(i + 1, STEPS)] - pts[max(i - 1, 0)]).normalized()
        up = d.cross(side).normalized()
        if up.z < 0:
            up = -up
        h0, h1 = math.radians(hang[0]), math.radians(hang[1] * (0.5 + 0.5 * min(1.0, s * 2.5)))
        v = v0 + K.INSET + (v1 - v0 - 2 * K.INSET) * s
        k = shade * (0.8 + 0.24 * s)
        row = []
        for a in (-1, -0.5, 0, 0.5, 1):
            sg = 1 if a > 0 else -1
            m = q + (side * sg * math.cos(h0) - up * math.sin(h0)) * (w / 4) if a else q
            if abs(a) == 1:
                m = m + (side * sg * math.cos(h1) - up * math.sin(h1)) * (w / 4)
            nrm = (up * 0.7 + side * sg * 0.25 * abs(a) + out * 0.3 + K.UP * 0.5).normalized()
            row.append((crown.vert(m, nrm), (u0 + K.INSET + (u1 - u0 - 2 * K.INSET) * (a + 1) / 2, v), k * (1.04 if abs(a) == 1 else 1.0)))
        rows.append(row)
    for ra, rb in zip(rows, rows[1:]):
        for j in range(4):
            ids = [ra[j], ra[j + 1], rb[j + 1], rb[j]]
            crown.face([x[0] for x in ids], [x[1] for x in ids], [(x[2], x[2], x[2]) for x in ids])
    # The caster: a flat strip down the frond's middle, two thirds its width.
    hrows = [(hull.vert(q - side * width / 3), hull.vert(q + side * width / 3)) for q in pts[1:]]
    for ra, rb in zip(hrows, hrows[1:]):
        hull.face([ra[0], ra[1], rb[1], rb[0]], [(0, 0)] * 4, (1, 1, 1))


def build(name, h, lean, fronds, length, nuts, seed):
    K.reset()
    rng = random.Random(f"palm-{seed}")
    n = 2 * max(3, round(h / RING))                    # a crest and a groove per ring
    path = trunk_path(h, lean, n)
    radii, cols = [], []
    for i, p in enumerate(path):
        t = i / n
        r = 0.25 - 0.11 * t + (0.1 * (1 - t / 0.07) if t < 0.07 else 0.0)
        crest = i % 2 == 0
        radii.append(r * (1.05 if crest else 0.95))
        cols.append(tuple(c * (1.0 if crest else 0.82) * (0.8 + 0.2 * min(1, p.z / 0.5)) for c in TRUNK))
    wood = K.Build()
    # Colour per ring row: the nearest row's shade (the tube asks by point).
    K.tube(wood, path, radii, 8, lambda p: cols[min(range(len(path)), key=lambda i: (path[i] - p).length)], v_scale=0.6)
    top, up = path[-1], (path[-1] - path[-2]).normalized()
    head = top + up * 0.1
    K.icosphere_into(wood, head, 0.2, 2, HUSK, squash=0.85)

    crown, hull = K.Build(), K.Build()
    cells = [(0.0, 0.0, 0.5, 1.0), (0.5, 0.0, 1.0, 1.0)]
    upper, lower = fronds
    for ring, count in ((0, upper), (1, lower)):
        phase = rng.uniform(0, math.tau) + ring * math.pi / count
        for k in range(count):
            az = phase + math.tau * k / count + rng.uniform(-0.15, 0.15)
            if ring == 0:   # the upper layer rises and arches over
                elev, droop, hang = rng.uniform(60, 70), rng.uniform(115, 130), (22, 62)
            else:           # the lower one spreads and droops round the coconuts
                elev, droop, hang = rng.uniform(22, 30), rng.uniform(65, 80), (18, 55)
            base = head + Vector((math.cos(az), math.sin(az), 0)) * 0.1 + Vector((0, 0, 0.08 - 0.08 * ring))
            L = length * rng.uniform(0.92, 1.05) * (0.95 if ring == 0 else 1.0)
            frond(crown, hull, base, az, math.radians(elev), math.radians(droop), L, L * 0.5, hang,
                  cells[rng.randrange(2)], (1.04 if ring == 0 else 0.92) * rng.uniform(0.95, 1.05))
    # The coconuts hang in the gaps between the lower fronds (the last ring drawn), where they show.
    for i in range(nuts):
        a = phase + math.tau * (i + 0.5) / lower + rng.uniform(-0.1, 0.1)
        c = head + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, -0.42 + rng.uniform(-0.05, 0.03)))
        K.icosphere_into(wood, c, rng.uniform(0.19, 0.21), 2, NUTS[2] if i == nuts - 1 else NUTS[i % 2], squash=1.08)
    stem = K.Build()
    sp = path[::4] + ([path[-1]] if n % 4 else [])
    K.tube(stem, sp, [0.2] * len(sp), 5, lambda p: (1, 1, 1))

    objs = [crown.object("Fronds", K.material("mTreeLeaves", K.image("palm-fronds"), alpha_clip=True)),
            wood.object("Trunk", K.plain("mTreeTrunk")),
            hull.object("Hull", K.plain("mShadowShake")),
            stem.object("Stem", K.plain("mShadow"))]
    out = os.path.join(K.OUT, f"tree-palm-{name}.glb")
    K.export(objs, out)
    pts = [v.co for o in objs[:2] for v in o.data.vertices]
    print(f"PALM tree-palm-{name}: tris {({o.name: K.tris(o) for o in objs})} top {max(p.z for p in pts):.3f}")
    return out


def main():
    names = [a for a in ARGS if a in PALMS] or list(PALMS)
    written = [build(n, **PALMS[n]) for n in names]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)


main()
