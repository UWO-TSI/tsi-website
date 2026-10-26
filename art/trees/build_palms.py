"""The new world's palms (terrain v3; game/wharf-art, from David's references of 2026-10-26, palm-shape.jpg and
palm-style.jpg, and his R2b note: "i lowk like the old low poly leafs, so like go towards that directio nmore, this one
has too much detail ... make it different sizes, and trucks bigger, make truckes have the scale kinda thing instead of
a normal cylinder"; the old leaves are the dump's tree-palm-a/-b: solid fronds, no cut-out leaflets).

A thick trunk of overlapping scales (each a short cup, narrow at its foot and flaring at its rim into pointed tips,
the next one tucked inside it, the tips staggered), a husk at its head, coconuts clustered under the crown, and two
layers of solid fronds: each a low-poly arched shell along an arching rib, its sides curving down, its hem cut into
broad fingers. The upper layer rises and arches over, the lower one spreads and droops. Plain colour in COLOR_0 (a
pale rib, the green shell, lighter fingertips), no texture: the shell's own shading reads it. Shadow casters as the
other trees have (mShadowShake: a strip down each frond; mShadow: the trunk).

Writes web/public/assets/game/plants/tree-palm-{tall,lean,short,small}.glb in game units at scale 1, the origin on the
ground at the trunk's foot, then web/scripts/finish-greenery.mjs sets the materials and checks the files.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_palms.py [-- tall lean short small]
"""
import math, os, random, subprocess, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# height, lean (top's offset along +x), trunk radius at the foot, fronds (upper, lower), frond length, coconuts, seed
PALMS = {
    "tall": dict(h=5.4, lean=0.7, r=0.44, fronds=(3, 5), length=2.7, nuts=3, seed=1),
    "lean": dict(h=4.2, lean=1.7, r=0.4, fronds=(3, 5), length=2.4, nuts=3, seed=2),
    "short": dict(h=2.8, lean=0.35, r=0.38, fronds=(3, 4), length=2.0, nuts=3, seed=3),
    "small": dict(h=1.5, lean=0.2, r=0.3, fronds=(2, 4), length=1.4, nuts=2, seed=4),
}
TRUNK, TRUNK_DEEP, HUSK = K.lin("#d9ab6c"), K.lin("#9c7448"), K.lin("#8e6a3e")
NUTS = [K.lin("#b3a447"), K.lin("#c3b453"), K.lin("#ad7a3e")]   # warm green-browns that read against the leaves
SHELL, SHELL_BASE, RIB, TIP = K.lin("#5aae45"), K.lin("#3f8c3a"), K.lin("#a9d063"), K.lin("#a3d25a")
SCALE = 0.36          # a trunk scale's height at the foot (they shorten a little up the trunk)
SIDES = 8             # round the trunk; each scale rim has a tip on every other corner
STEPS = 6             # rows along a frond


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def trunk_path(h, lean, t):
    return Vector((lean * (t ** 1.6) - 0.08 * lean * t, 0.0, h * t))


def trunk(wood, h, lean, r0):
    """Stacked scales: per scale a foot ring (narrow, deep in shade) and a rim ring (wide, light, every other corner a
    tip), the next scale's foot inside the rim. Returns the head point and the axis there."""
    t, j = 0.0, 0
    while t < 1.0:
        seg = SCALE * (1 - 0.3 * t) / h
        t1 = min(1.0, t + seg)
        phase = (j % 2) * math.pi / SIDES
        ra = r0 * (1 - 0.42 * t) * (1.18 if j == 0 else 0.86)        # the first one flares as the trunk's foot
        rb = r0 * (1 - 0.42 * t1)
        a, b = trunk_path(h, lean, t), trunk_path(h, lean, t1)
        ax = (b - a).normalized()
        side = ax.cross(Vector((0, 1, 0))).normalized()
        fwd = ax.cross(side).normalized()
        rows = []
        for p, rad, col, tip in ((a, ra, lerp(TRUNK_DEEP, TRUNK, 0.15), 0.0), (b, rb, TRUNK, 0.16)):
            row = []
            for k in range(SIDES):
                ang = math.tau * k / SIDES + phase
                d = side * math.cos(ang) + fwd * math.sin(ang)
                rr = rad * (1 + (tip if k % 2 == 0 else 0.0))
                q = p + d * rr - ax * (0.05 * rad if tip and k % 2 == 0 else 0.0)   # tips droop a touch
                row.append(wood.vert(q, d))
            rows.append((row, col))
        (lo, cl), (hi, ch) = rows
        for k in range(SIDES):
            k2 = (k + 1) % SIDES
            wood.face([lo[k], lo[k2], hi[k2], hi[k]], [(0, 0)] * 4, [cl, cl, ch, ch])
        if j == 0:   # close the foot under the ground
            c = wood.vert(a - ax * 0.02, -ax)
            for k in range(SIDES):
                wood.face([lo[(k + 1) % SIDES], lo[k], c], [(0, 0)] * 3, cl)
        if t1 >= 1.0:   # cap the last rim
            c = wood.vert(b + ax * 0.03, ax)
            for k in range(SIDES):
                wood.face([hi[k], hi[(k + 1) % SIDES], c], [(0, 0)] * 3, ch)
        t, j = t1, j + 1
    top = trunk_path(h, lean, 1.0)
    return top, (top - trunk_path(h, lean, 0.97)).normalized()


def blade(s):
    """A frond's width along it (0 at the crown, 1 at the tip), of its full width: a bare stem first (so the coconuts
    show under the crown), widening into the blade, narrowing to the tip."""
    t = min(1.0, max(0.0, (s - 0.05) / 0.35))
    return (0.1 + 0.9 * t * t * (3 - 2 * t)) * max(0.25, math.sin(math.pi * (0.25 + 0.7 * s)) ** 0.6)


def frond(crown, hull, base, az, elev, droop, length, width, shade, rng):
    """One solid frond: an arched shell along a rib from `base` out along az at elevation elev, bending down by droop.
    Across it five points, the rib in the middle and each side curving down to the hem; along each hem a broad finger
    between every two rows, pointing on down the curve."""
    side = Vector((-math.sin(az), math.cos(az), 0))
    pts, p = [], base.copy()
    for i in range(STEPS + 1):
        pts.append(p.copy())
        ang = elev - droop * ((i + 1) / STEPS) ** 1.3
        p = p + Vector((math.cos(az) * math.cos(ang), math.sin(az) * math.cos(ang), math.sin(ang))) * (length / STEPS)
    rows, hems = [], []
    for i, q in enumerate(pts):
        s = i / STEPS
        w = width * blade(s)
        d = (pts[min(i + 1, STEPS)] - pts[max(i - 1, 0)]).normalized()
        up = d.cross(side).normalized()
        if up.z < 0:
            up = -up
        R = w / 2 / math.sin(math.radians(75))
        row, hem = [], []
        for a in (-1, -0.5, 0, 0.5, 1):
            phi = math.radians(75) * a
            m = q + side * math.sin(phi) * R - up * (1 - math.cos(phi)) * R
            col = lerp(SHELL_BASE, SHELL, min(1.0, s * 2.2)) if a else lerp(RIB, SHELL, 0.25 * s)
            row.append((crown.vert(m), tuple(c * shade for c in col)))
            if abs(a) == 1:   # the hem's way on: down the curve
                hem.append((m, (side * a * math.cos(abs(phi)) - up * math.sin(abs(phi))).normalized(), w))
        rows.append(row)
        hems.append(hem)
    for ra, rb in zip(rows, rows[1:]):
        for j in range(4):
            ids = [ra[j], ra[j + 1], rb[j + 1], rb[j]]
            crown.face([x[0] for x in ids], [(0, 0)] * 4, [x[1] for x in ids])
    # The fingers: a broad point under each stretch of hem, longest mid-frond.
    for i in range(1, STEPS):
        s = (i + 0.5) / STEPS
        for hsd, col_idx in ((0, 0), (1, 4)):
            (m0, d0, w0), (m1, d1, w1) = hems[i][hsd], hems[i + 1][hsd]
            fl = (w0 + w1) / 2 * (0.28 + 0.12 * rng.random()) * math.sin(math.pi * min(1.0, s * 1.1)) ** 0.5
            tip = (m0 + m1) / 2 + ((d0 + d1) / 2).normalized() * fl + (pts[i + 1] - pts[i]) * 0.15
            ct = tuple(c * shade for c in TIP)
            t_id = crown.vert(tip)
            e0, e1 = rows[i][col_idx][0], rows[i + 1][col_idx][0]
            c0, c1 = rows[i][col_idx][1], rows[i + 1][col_idx][1]
            crown.face([e0, e1, t_id] if hsd else [e1, e0, t_id], [(0, 0)] * 3, [c0, c1, ct] if hsd else [c1, c0, ct])
    # The caster: a flat strip down the frond's middle, two thirds its width.
    hrows = []
    for i, q in enumerate(pts[1:], 1):
        w = width * blade(i / STEPS) / 3
        hrows.append((hull.vert(q - side * w), hull.vert(q + side * w)))
    for ra, rb in zip(hrows, hrows[1:]):
        hull.face([ra[0], ra[1], rb[1], rb[0]], [(0, 0)] * 4, (1, 1, 1))


def build(name, h, lean, r, fronds, length, nuts, seed):
    K.reset()
    rng = random.Random(f"palm-{seed}")
    k = length / 2.7                                  # the crown's own scale
    wood = K.Build()
    top, axis = trunk(wood, h, lean, r)
    head = top + axis * 0.1 * k
    K.icosphere_into(wood, head, 0.26 * k + 0.04, 1, HUSK, squash=0.75)

    crown, hull = K.Build(), K.Build()
    upper, lower = fronds
    phases = []
    for ring, count in ((0, upper), (1, lower)):
        phase = rng.uniform(0, math.tau) + ring * math.pi / count
        phases.append(phase)
        for f in range(count):
            az = phase + math.tau * f / count + rng.uniform(-0.15, 0.15)
            if ring == 0:   # the upper layer rises and arches over
                elev, droop = rng.uniform(58, 68), rng.uniform(110, 125)
            else:           # the lower one spreads and droops
                elev, droop = rng.uniform(20, 28), rng.uniform(62, 76)
            base = head + Vector((math.cos(az), math.sin(az), 0)) * 0.12 * k + Vector((0, 0, (0.1 - 0.1 * ring) * k))
            L = length * rng.uniform(0.92, 1.05) * (0.9 if ring == 0 else 1.0)
            frond(crown, hull, base, az, math.radians(elev), math.radians(droop), L, L * 0.52, (1.0 if ring == 0 else 0.88) * rng.uniform(0.95, 1.05), rng)
    # The coconuts: a cluster at the crown's heart, round the husk between the frond stems (bare there), under the
    # upper fronds that rise away from them, so the play camera sees them from above and the side.
    for i in range(nuts):
        a = phases[0] + math.tau * (i + 0.5) / upper + rng.uniform(-0.15, 0.15)
        rn = (0.3 + 0.03 * rng.random()) * max(k, 0.75)
        out = 0.2 * k + rn * 0.8
        c = head + Vector((math.cos(a) * out, math.sin(a) * out, -0.08 * k))
        K.icosphere_into(wood, c, rn, 2, NUTS[i % 3], squash=1.06)
    stem = K.Build()
    sp = [trunk_path(h, lean, t) for t in (0, 0.25, 0.5, 0.75, 1.0)]
    K.tube(stem, sp, [r * 0.8] * len(sp), 6, lambda p: (1, 1, 1))

    objs = [crown.object("Fronds", K.plain("mTreeLeaves")),
            wood.object("Trunk", K.plain("mTreeTrunk")),
            hull.object("Hull", K.plain("mShadowShake")),
            stem.object("Stem", K.plain("mShadow"))]
    objs[0].data.shade_smooth()
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
