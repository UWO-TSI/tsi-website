"""The new world's palms (terrain v3, game/terrain-art; David, 2026-10-26: "palm tree leaves needs more work, needs to be
lighter with coconuts, model in blender properly").

A ringed trunk curving up from a flared foot, a husk at its head, a cluster of coconuts under it, and two whorls of
feather fronds: each frond a card along an arching rib, folded into a shallow V along its midrib so it never thins to
an edge, wearing the light painted frond (art/trees/paint_textures.py palm-fronds); the upper whorl rises and arches,
the lower one droops. Normals lean up out of the crown, so the fronds read light. Shadow casters as the cedars have
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
    "tall": dict(h=4.8, lean=0.55, fronds=(8, 7), length=2.9, nuts=5, seed=1),
    "lean": dict(h=4.0, lean=1.5, fronds=(8, 7), length=2.7, nuts=4, seed=2),
    "short": dict(h=2.6, lean=0.3, fronds=(7, 6), length=2.2, nuts=3, seed=3),
}
TRUNK, HUSK, NUT, NUT_GREEN = K.lin("#d2ad7a"), K.lin("#9a7c48"), K.lin("#a5743f"), K.lin("#a3a046")
SEG = 0.26            # the trunk's ring spacing


def trunk_path(h, lean, n):
    """Points up the trunk: a curve that leans out and comes back a little upright at the top."""
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(Vector((lean * (t ** 1.6) - 0.08 * lean * t, 0.0, h * t)))
    return out


def frond(crown, hull, rng, base, az, elev, droop, length, cell, shade):
    """One frond: a folded card along an arching rib, from `base` out along azimuth az at elevation elev, bending down."""
    steps = 6
    side = Vector((-math.sin(az), math.cos(az), 0))
    pts, p, ang = [], base.copy(), elev
    for i in range(steps + 1):
        pts.append(p.copy())
        ang = elev - droop * ((i + 1) / steps) ** 1.4
        p = p + Vector((math.cos(az) * math.cos(ang), math.sin(az) * math.cos(ang), math.sin(ang))) * (length / steps)
    u0, v0, u1, v1 = cell
    rows = []
    for i, q in enumerate(pts):
        s = i / steps
        w = length * 0.4 * (0.28 + 0.72 * math.sin(math.pi * min(1.0, 0.12 + s * 0.95)) ** 0.6)
        d = (pts[min(i + 1, steps)] - pts[max(i - 1, 0)]).normalized()
        up = d.cross(side).normalized()
        if up.z < 0:
            up = -up
        fold = math.radians(28 - 40 * s)                 # a V near the base, its leaflets drooping at the tip
        left = q - side * (w / 2) * math.cos(fold) + up * (w / 2) * math.sin(fold)
        right = q + side * (w / 2) * math.cos(fold) + up * (w / 2) * math.sin(fold)
        nrm = (up * 0.8 + Vector((math.cos(az), math.sin(az), 0)) * 0.35 + K.UP * 0.5).normalized()
        k = shade * (0.82 + 0.22 * s)
        v = v0 + K.INSET + (v1 - v0 - 2 * K.INSET) * s
        rows.append([(crown.vert(left, nrm), (u0 + K.INSET, v), k), (crown.vert(q + up * 0.02, nrm), ((u0 + u1) / 2, v), k * 0.95),
                     (crown.vert(right, nrm), (u1 - K.INSET, v), k)])
    for a, b in zip(rows, rows[1:]):
        for j in range(2):
            ids = [a[j], a[j + 1], b[j + 1], b[j]]
            crown.face([x[0] for x in ids], [x[1] for x in ids], [(x[2], x[2], x[2]) for x in ids])
    # The caster: a flat strip down the frond's middle, two thirds its width.
    hrows = []
    for i, q in enumerate(pts):
        s = i / steps
        w = length * 0.27 * (0.28 + 0.72 * math.sin(math.pi * min(1.0, 0.12 + s * 0.95)) ** 0.6)
        hrows.append((hull.vert(q - side * w / 2), hull.vert(q + side * w / 2)))
    for a, b in zip(hrows, hrows[1:]):
        hull.face([a[0], a[1], b[1], b[0]], [(0, 0)] * 4, (1, 1, 1))


def build(name, h, lean, fronds, length, nuts, seed):
    K.reset()
    rng = random.Random(f"palm-{seed}")
    n = max(6, round(h / SEG))
    path = trunk_path(h, lean, n)
    radii = []
    for i, p in enumerate(path):
        t = i / n
        r = 0.2 - 0.07 * t + (0.1 * (1 - t / 0.08) if t < 0.08 else 0.0)
        radii.append(r * (1.07 if i % 2 else 0.95))
    # Each ring a little darker at its groove, the foot darker still.
    def bark(p):
        f = (p.z / SEG) % 2
        k = (0.74 + 0.26 * abs(f - 1) ** 0.7) * (0.8 + 0.2 * min(1, p.z / 0.5))
        return tuple(c * k for c in TRUNK)
    wood = K.Build()
    K.tube(wood, path, radii, 8, bark, v_scale=0.6)
    top, up = path[-1], (path[-1] - path[-2]).normalized()
    head = top + up * 0.12
    K.icosphere_into(wood, head, 0.2, 1, HUSK, squash=0.8)
    for i in range(nuts):
        a = math.tau * i / nuts + rng.uniform(-0.3, 0.3)
        c = head + Vector((math.cos(a) * 0.25, math.sin(a) * 0.25, -0.33 + rng.uniform(-0.06, 0.04)))
        K.icosphere_into(wood, c, rng.uniform(0.16, 0.18), 1, NUT_GREEN if i == 0 else NUT, squash=1.1)

    crown, hull = K.Build(), K.Build()
    cells = [(0.0, 0.0, 0.5, 1.0), (0.5, 0.0, 1.0, 1.0)]
    upper, lower = fronds
    for ring, count in ((0, upper), (1, lower)):
        phase = rng.uniform(0, math.tau) + ring * math.pi / count
        for k in range(count):
            az = phase + math.tau * k / count + rng.uniform(-0.12, 0.12)
            elev = math.radians(rng.uniform(32, 46) if ring == 0 else rng.uniform(4, 16))
            droop = math.radians(rng.uniform(70, 95) if ring == 0 else rng.uniform(55, 75))
            base = head + Vector((math.cos(az), math.sin(az), 0)) * 0.08 + Vector((0, 0, 0.06 - 0.1 * ring))
            frond(crown, hull, rng, base, az, elev, droop, length * rng.uniform(0.9, 1.05) * (0.92 if ring else 1.0),
                  cells[rng.randrange(2)], (1.02 if ring == 0 else 0.88) * rng.uniform(0.95, 1.05))
    stem = K.Build()
    sp = path[::3] if n % 3 == 0 else path[::3] + [path[-1]]
    K.tube(stem, sp, [0.18] * len(sp), 5, lambda p: (1, 1, 1))

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
