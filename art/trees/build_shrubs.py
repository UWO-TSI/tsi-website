"""Wild shrubs for the new world (game/village-art2; David, R2c 2026-10-26: "the bushes are too dense and looks like a
sphere from afar, i should feel more fluffy and density varies so some of it fees more organic").

Built like our broadleaf crowns (build_broadleaf.py: the dump's shield-shaped leaf cards over a darker leaf mass, our
painted summer atlas) but low and loose: each shrub is a few lobes of different sizes clumped on the ground, never one
ball. Each lobe has its own density: a full lobe is a deep shell of cards round a big dark mass; a loose one is fewer
cards round a small mass, so its shape breaks up and light gets in. Some cards reach well past their lobe as sprigs, so
the outline is ragged, not round. Twigs (plain bark) run from the root to the lobes, and a few bare ones poke out of the
loose shrubs with a tuft of leaves at the tip. Normals point out of the nearest lobe, blended with the whole shrub's and
tipped up, so a shrub shades as soft clumps; COLOR_0 carries the shade (darker low and inside) and the shrub's own tint.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_shrubs.py [-- a b ...] [-- review <dir>]

Writes web/public/assets/game/plants/shrub-<a..f>.glb (glTF y up, the root at the origin on the ground, at scale 1),
then web/scripts/finish-greenery.mjs. Two draws each: the leaves (one cut-out material) and the twigs.
  a  a full mound of five lumpy lobes, about 1.45 across and 0.95 tall
  b  a low spreading shrub along x, about 2 by 1.35 and 0.7 tall, full in the middle and loose at its ends
  c  a tall loose shrub, about 1.2 across and 1.4 tall, its lobes apart up bare twigs
  d  a small sparse tuft, about 0.8 across and 0.45 tall
  e  a big lush shrub, about 2.2 by 1.8 and 1.15 tall, seven lobes, the darkest green
  f  a lopsided loose shrub, two clumps with a gap between and twigs across it, about 1.8 by 1.1 and 0.9 tall
Seeded: a rebuild writes the same models.
"""
import math, os, random, subprocess, sys
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
UP = K.UP
# build_broadleaf.py's card: the dump's shield on a card one unit wide, and how far each corner leans out.
SHIELD = [(0.0, 0.344), (0.435, 0.259), (0.5, -0.19), (0.0, -0.487), (-0.5, -0.19), (-0.435, 0.259)]
BEND = [0.07, 0.04, -0.02, -0.09, -0.02, 0.04]
BARK = "#7a5a3c"
CARDS_PER_R2 = 400   # cards on a full lobe, per square unit of its radius

# Lobes: (centre (Blender x, y, z), radius, density 0..1). mass: the inner mass's share of a lobe's radius at full
# density; sprig: the share of cards reaching out past the lobe; twigs: bare twigs poking out (with a tuft at the tip).
SHRUBS = {
    "a": dict(tint="#f2f7e8", card=0.34, sprig=0.12, twigs=0, lobes=[
        ((0.0, 0.0, 0.34), 0.36, 1.0), ((0.34, -0.12, 0.24), 0.27, 0.9), ((-0.3, -0.16, 0.22), 0.25, 0.85),
        ((-0.12, 0.3, 0.26), 0.28, 0.9), ((0.18, 0.2, 0.52), 0.22, 0.7)]),
    "b": dict(tint="#eef3d2", card=0.32, sprig=0.16, twigs=2, lobes=[
        ((0.0, 0.0, 0.26), 0.3, 1.0), ((0.4, 0.06, 0.22), 0.26, 0.85), ((-0.42, -0.04, 0.2), 0.24, 0.8),
        ((0.74, -0.04, 0.16), 0.18, 0.5), ((-0.76, 0.08, 0.15), 0.17, 0.45), ((0.1, -0.24, 0.18), 0.2, 0.7)]),
    "c": dict(tint="#dbe9d6", card=0.3, sprig=0.2, twigs=4, lobes=[
        ((0.05, 0.0, 0.92), 0.26, 0.7), ((-0.22, 0.08, 0.62), 0.22, 0.55), ((0.26, -0.1, 0.55), 0.2, 0.5),
        ((0.0, 0.05, 0.28), 0.22, 0.6), ((0.14, 0.14, 1.12), 0.15, 0.45)]),
    "d": dict(tint="#f5f1d0", card=0.26, sprig=0.22, twigs=3, lobes=[
        ((0.0, 0.0, 0.18), 0.17, 0.6), ((0.17, 0.06, 0.14), 0.13, 0.45), ((-0.13, -0.08, 0.2), 0.12, 0.4)]),
    "e": dict(tint="#d2e2c4", card=0.36, sprig=0.1, twigs=0, lobes=[
        ((0.0, 0.0, 0.46), 0.44, 1.0), ((0.56, -0.1, 0.32), 0.34, 0.95), ((-0.54, -0.06, 0.3), 0.33, 0.9),
        ((0.12, 0.44, 0.34), 0.32, 0.85), ((-0.2, -0.42, 0.28), 0.28, 0.8), ((0.3, 0.12, 0.78), 0.26, 0.7),
        ((-0.32, 0.22, 0.66), 0.24, 0.65)]),
    "f": dict(tint="#eef0dc", card=0.3, sprig=0.18, twigs=3, lobes=[
        ((-0.42, 0.0, 0.3), 0.3, 0.9), ((-0.2, 0.16, 0.5), 0.22, 0.6), ((0.42, -0.06, 0.24), 0.24, 0.6),
        ((0.58, 0.1, 0.4), 0.16, 0.4)]),
}


def tint(h):
    return Vector(K.lin(h))


def build(name):
    K.reset()
    cfg = SHRUBS[name]
    rng = random.Random(f"shrub-{name}")
    balls = [(Vector(c), r, d) for c, r, d in cfg["lobes"]]
    lo = Vector((min(c.x - r * 1.5 for c, r, _ in balls), min(c.y - r * 1.5 for c, r, _ in balls), 0.0))
    hi = Vector((max(c.x + r * 1.5 for c, r, _ in balls), max(c.y + r * 1.5 for c, r, _ in balls), max(c.z + r * 1.5 for c, r, _ in balls)))
    mid, half = (lo + hi) / 2, (hi - lo) / 2
    col = tint(cfg["tint"])

    def nearest(p):
        return min(balls, key=lambda b: (p - b[0]).length / b[1])

    def normal_of(p):
        c, r, _ = nearest(p)
        q = p - mid
        e = Vector((q.x / half.x ** 2, q.y / half.y ** 2, q.z / half.z ** 2))
        return ((p - c).normalized() * 0.5 + (e.normalized() if e.length > 1e-9 else UP) * 0.25 + UP * 0.4).normalized()

    def shade(p, base=1.0):
        """Darker low and inside, lighter on top and at the lobes' outer edges, warmer in the light."""
        h = min(1, max(0, p.z / max(hi.z, 1e-3)))
        c, r, _ = nearest(p)
        out = min(1, max(0, ((p - c).length / r - 0.7) / 0.8))
        k = base * (0.7 + 0.28 * h) * (0.86 + 0.18 * out) * (1 + 0.06 * noise.noise(p * 3.0))
        w = (k - 0.85) * 0.12
        return (col.x * k * (1 + w), col.y * k, col.z * k * (1 - w))

    leaves = K.Build()
    for i, (c, r, dens) in enumerate(balls):
        m = r * (0.45 + 0.4 * dens)
        K.ellipsoid(leaves, c, Vector((m, m, m * 0.85)), K.MASS, lambda p: shade(p, 0.62), segs=7, rings=4, wobble=0.15, seed=i,
                    normal_of=normal_of, ground=0.0)

    def card(p, d, w, dark=1.0):
        """One shield card at p, pitched up off the direction d like a shingle and turned a little sideways."""
        side = UP.cross(d)
        side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
        tup = d.cross(side).normalized()
        pitch = math.radians(max(-30, min(75, rng.gauss(30, 26))))
        yaw = math.radians(max(-65, min(65, rng.gauss(0, 37))))
        nrm = (d * math.cos(pitch) * math.cos(yaw) + tup * math.sin(pitch) + side * math.cos(pitch) * math.sin(yaw)).normalized()
        right, cup = K.card_frame(nrm, UP, rng.uniform(-0.3, 0.3))
        cell = K.CELLS[rng.randrange(12)]
        jit = rng.uniform(0.93, 1.06) * (rng.uniform(0.66, 0.78) if rng.random() < 0.14 else 1.0) * dark
        flip = rng.random() < 0.5
        ids, cols = [], []
        for (x, y), bend in zip(SHIELD, BEND):
            q = p + right * (x * w) + cup * (y * w) + nrm * (bend * w)
            ids.append(leaves.vert(q, normal_of(q)))
            cols.append(tuple(t * jit for t in shade(q)))
        uv = [K.cell_uv(cell, x * 2, (y + 0.487) / 0.831 * 2 - 1, flip) for x, y in SHIELD]
        leaves.face([ids[3], ids[2], ids[1], ids[0]], [uv[3], uv[2], uv[1], uv[0]], [cols[3], cols[2], cols[1], cols[0]])
        leaves.face([ids[0], ids[5], ids[4], ids[3]], [uv[0], uv[5], uv[4], uv[3]], [cols[0], cols[5], cols[4], cols[3]])

    cards = 0
    for c, r, dens in balls:
        n = round(CARDS_PER_R2 * r * r * (0.35 + 0.65 * dens))
        for d in K.fib_dirs(n, rng, jitter=1.1):
            sprig = rng.random() < cfg["sprig"] + 0.15 * (1 - dens)
            p = c + d * r * (rng.uniform(1.35, 1.75) if sprig else rng.uniform(0.85, 1.35))
            if p.z < 0.05 or any(o is not c and (p - o).length < ro * 0.9 for o, ro, _ in balls):
                continue
            card(p, d, cfg["card"] * rng.uniform(0.9, 1.1) * (0.8 if sprig else 1.0))
            cards += 1

    wood = K.Build()
    bark = K.lin(BARK)

    def bark_col(p):
        k = (0.7 + 0.3 * min(1, p.z / 0.4)) * (1 + 0.08 * noise.noise(p * 5.0))
        return tuple(x * k for x in bark)

    for c, r, _ in balls:
        end = c - Vector((0, 0, r * 0.2))
        foot = Vector((c.x * 0.15, c.y * 0.15, -0.03))
        bend = (foot + end) / 2 + Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0.02))
        K.tube(wood, [foot, bend, end], [0.035, 0.026, 0.014], 4, bark_col, v_scale=1.0)
    for t in range(cfg["twigs"]):
        c, r, _ = balls[t % len(balls)]
        a = rng.uniform(0, math.tau)
        out = Vector((math.cos(a), math.sin(a), rng.uniform(0.3, 0.9))).normalized()
        start = c + out * r * 0.4
        tip = c + out * r * rng.uniform(1.9, 2.3)
        midp = (start + tip) / 2 + Vector((0, 0, 0.03))
        K.tube(wood, [start, midp, tip], [0.016, 0.011, 0.005], 4, bark_col, v_scale=1.0)
        for _ in range(3):
            d = (out + Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), rng.uniform(0, 0.6)))).normalized()
            card(tip + d * 0.05, d, cfg["card"] * 0.65)
            cards += 1

    objs = [leaves.object("Leaves", K.material("mTreeLeaves", K.image("leaves-summer", (256, 256)), alpha_clip=True)),
            wood.object("Twigs", K.plain("mTreeTrunk"))]
    out = os.path.join(K.OUT, f"shrub-{name}.glb")
    K.export(objs, out)
    print(f"SHRUB {name}: cards {cards} tris {sum(K.tris(o) for o in objs)}")
    return out


def review(out, files):
    """The shrubs on the ground in two rows of three (a b c in front), read back from the files."""
    import bpy
    sys.path.insert(0, os.path.join(K.HERE, "..", "props"))
    import propkit as P
    K.reset()
    obs = []
    for i, f in enumerate(files):
        bpy.ops.import_scene.gltf(filepath=f)
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location = (i % 3 * 2.2, i // 3 * 2.0, 0)
                if o.data.color_attributes:
                    o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.context.view_layer.update()
    P.review(obs, out, views=((0, 22), (30, 45)), size=900)


if __name__ == "__main__":
    names = [a for a in ARGS if a in SHRUBS] or list(SHRUBS)
    written = [build(n) for n in names]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "shrubs.png"), [os.path.join(K.OUT, f"shrub-{n}.glb") for n in SHRUBS])
