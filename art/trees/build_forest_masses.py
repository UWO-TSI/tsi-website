"""The new world's forest masses (terrain v3; game/terrain-art first, remodelled by game/village-art). David, 2026-10-26:
"make it look like a dense forest without actually rendering so many trees, like just low qual so it looks like dense
forest", then on the first ones (R2b): "the trees are all the same exact copy paste model so it looks so unnatural, this
tree needs multiple versions and remodeled because it should grow differengly", and "trees are hovering near the cliff".

Each mass is a stand of trees merged into one mesh, to instance over the closed forest, and every tree in it grows its
own way: tiered cedars (three to five tiers, broad or slim), tall narrow firs, round broadleaf crowns of lumped domes, a
few young trees, and in the bigger stands a dead snag; each with its own height, spread, lean and shade, set close in a
loose cluster inside an irregular outline (no rows, no spiral). Crowns wear the cedars' painted needle mass
(art/trees/textures/needles.png, its opaque bottom-left mass cut to its own small texture) times COLOR_0, the
broadleaf crowns lighter and warmer; trunks and the snag are plain bark. A deep plug of the same needles closes the
stand's floor and runs SINK below the origin, and every trunk starts there too, so a stand set on a slope or at a cliff's
lip sinks in instead of floating. Two materials: mForestNeedles (opaque) and mTreeTrunk (plain). Seeded.

Writes web/public/assets/game/plants/forest-mass-{a..e}.glb in game units at scale 1, the origin on the ground at the
stand's centre, then web/scripts/finish-greenery.mjs sets the materials and checks the files:
  a  round, about 12 across        b  long, about 16 by 9 along x     c  small, about 10 across
  d  a kidney, about 14 by 8       e  a big ragged stand, about 18 by 13

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_forest_masses.py [-- a b ...]
"""
import math, os, random, subprocess, sys
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# (half extents x and z, trees, outline wobble (amplitude, lobes, dent), seed)
MASSES = {"a": ((6.0, 6.0), 13, (0.12, 3, 0.0), 1), "b": ((8.0, 4.5), 15, (0.1, 4, 0.0), 2), "c": ((5.0, 5.0), 10, (0.14, 2, 0.0), 3),
          "d": ((7.0, 4.2), 13, (0.08, 3, 0.35), 4), "e": ((9.0, 6.5), 18, (0.16, 5, 0.0), 5)}
SINK = 2.2
BARK, DEAD = K.lin("#4e3626"), K.lin("#6d6052")
KINDS = [("cedar", 0.42), ("fir", 0.2), ("broadleaf", 0.22), ("young", 0.11), ("dead", 0.05)]


def mass_image():
    """The needle atlas' opaque mass (u 0..0.5, v 0..0.25) as its own 256 x 128 image."""
    src = K.image("needles")
    w, h = src.size
    px = np.array(src.pixels[:]).reshape(h, w, 4)
    cut = px[: h // 4, : w // 2].copy()
    cut[..., 3] = 1
    img = bpy.data.images.new("forest-needles", w // 2, h // 4, alpha=False)
    img.pixels.foreach_set(cut.astype(np.float32).ravel())
    img.pack()
    img.scale(256, 128)
    return img


def normal_of(d):
    q = Vector((d.x, d.y, 0))
    out = q.normalized() if q.length > 1e-4 else Vector((0, 0, 0))
    return (out * 0.7 + K.UP * 0.6).normalized()


def cone(b, c, hem, top, r, tint, seed, segs, apex_off, under=True):
    """A closed tier round c: its apex at `top` (moved by apex_off, the lean), a hem of rounded fingers at `hem`
    (alternate rim points out and in), the lowest tier closed under by a shallow cone back up to the trunk."""
    rng = random.Random(seed)
    ph = rng.uniform(0, math.tau)
    apex = b.vert(c + apex_off + Vector((0, 0, top)), K.UP)
    mid, rim = [], []
    n = segs * 2
    for k in range(n):
        a = ph + math.tau * k / n
        d = Vector((math.cos(a), math.sin(a), 0))
        out = (1.0 if k % 2 == 0 else 0.84) * rng.uniform(0.92, 1.06)
        p_mid = c + apex_off * 0.45 + d * r * 0.55 + Vector((0, 0, top + (hem - top) * 0.55))
        p_rim = c + d * r * out + Vector((0, 0, hem + (0.0 if k % 2 == 0 else 0.12)))
        mid.append(b.vert(p_mid, normal_of(p_mid - c)))
        rim.append(b.vert(p_rim, normal_of(p_rim - c)))
    hub = b.vert(c + Vector((0, 0, hem + (top - hem) * 0.3)), Vector((0, 0, -1))) if under else None
    uv = lambda k, t: (K.tri_wave(k / n * 4), 0.02 + 0.96 * t)
    col = lambda t: tuple(ch * (0.8 + 0.25 * t) for ch in tint)
    for k in range(n):
        k2 = (k + 1) % n
        b.face([apex, mid[k], mid[k2]], [uv(k + 0.5, 1), uv(k, 0.55), uv(k + 1, 0.55)], [col(1), col(0.55), col(0.55)])
        b.face([mid[k], rim[k], rim[k2], mid[k2]], [uv(k, 0.55), uv(k, 0), uv(k + 1, 0), uv(k + 1, 0.55)], [col(0.55), col(0), col(0), col(0.55)])
        if under:
            b.face([rim[k2], rim[k], hub], [uv(k + 1, 0), uv(k, 0), uv(k + 0.5, 0.3)], [col(0)] * 3)


def conifer(b, p, h, r0, tiers, segs, tint, lean, seed, base_f):
    """Tiers stacked up a leaning axis, each narrower than the one under it."""
    base = h * base_f
    for t in range(tiers):
        f = t / tiers
        hem = base + (h - base) * f * 0.92
        top = min(hem + (h - base) / tiers * 1.75, h)
        r = r0 * (1 - 0.8 * f)
        cone(b, p + lean * hem, hem, top, r, tuple(ch * (0.74 + 0.32 * f) for ch in tint), seed * 10 + t, segs, lean * (top - hem), under=t == 0)
    return base


def broadleaf(b, p, h, r, tint, lean, seed):
    """A round crown of three or four lumped domes over a short bole."""
    rng = random.Random(seed)
    c = p + lean * h * 0.6 + Vector((0, 0, h * 0.62))
    lumps = [(Vector((0, 0, 0)), 1.0)] + [(Vector((math.cos(a), math.sin(a), rng.uniform(-0.25, 0.1))) * r * 0.55, rng.uniform(0.62, 0.78))
                                         for a in np.linspace(0, math.tau, rng.choice([2, 3]), endpoint=False) + rng.uniform(0, math.tau)]
    lumps.append((Vector((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0.55)) * r, 0.6))
    for i, (off, s) in enumerate(lumps):
        q = c + off
        K.ellipsoid(b, q, Vector((r * s, r * s, r * s * 0.82)), (0, 0, 1, 1),
                    lambda v, q=q, s=s: tuple(ch * (0.78 + 0.3 * max(0, min(1, (v.z - q.z) / (r * s) * 0.5 + 0.5))) for ch in tint),
                    segs=7, rings=4, wobble=0.12, seed=seed + i, normal_of=lambda v, q=q: normal_of(v - q) * 0.4 + (v - q).normalized() * 0.6)
    return h * 0.45


def snag(w, p, h, lean, seed):
    """A dead tree: a bare grey bole to a broken top, two stubs of branches."""
    rng = random.Random(seed)
    bark = lambda q: tuple(ch * (0.75 + 0.25 * min(1, (q.z + SINK) / 3)) for ch in DEAD)
    K.tube(w, [p + Vector((0, 0, -SINK)), p + lean * h * 0.5 + Vector((0, 0, h * 0.5)), p + lean * h + Vector((0, 0, h))], [0.26, 0.18, 0.08], 5, bark)
    for k in range(2):
        z = h * rng.uniform(0.45, 0.8)
        a = rng.uniform(0, math.tau)
        s = p + lean * z + Vector((0, 0, z))
        K.tube(w, [s, s + Vector((math.cos(a) * 1.1, math.sin(a) * 1.1, 0.6))], [0.09, 0.03], 4, bark)


def outline(hx, hz, wob, rng):
    """Whether a point (x, y) lies inside the stand: an ellipse with a wobbly rim (and a dent on one side for a kidney)."""
    amp, lobes, dent = wob
    ph = [rng.uniform(0, math.tau) for _ in range(2)]

    def inside(x, y, shrink=1.0):
        a = math.atan2(y / hz, x / hx)
        rim = 1 + amp * math.sin(lobes * a + ph[0]) + amp * 0.5 * math.sin((lobes + 2) * a + ph[1]) - dent * max(0.0, math.sin(a)) ** 3
        return math.hypot(x / hx, y / hz) < rim * shrink
    return inside


def build(name, half, count, wob, seed):
    K.reset()
    rng = random.Random(f"forest-{seed}")
    hx, hz = half
    inside = outline(hx, hz, wob, rng)
    # Trees set close in a loose cluster: random spots inside the rim, each kept clear of the others by its own spacing.
    trees, tries = [], 0
    while len(trees) < count and tries < 4000:
        tries += 1
        p = Vector((rng.uniform(-hx, hx), rng.uniform(-hz, hz), 0))
        if not inside(p.x, p.y, 0.86):
            continue
        gap = rng.uniform(1.5, 2.4)
        if all((p - q).length > max(gap, g) for q, g in trees):
            trees.append((p, gap))
    kinds = [k for k, _ in KINDS]
    needles, wood = K.Build(), K.Build()
    for i, (p, gap) in enumerate(trees):
        edge = math.hypot(p.x / hx, p.y / hz)
        kind = rng.choices(kinds, [w for _, w in KINDS])[0]
        if kind == "dead" and count < 12:
            kind = "cedar"
        lean = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * rng.uniform(0.0, 0.06)
        tone = rng.uniform(0.84, 1.1) * (1 + 0.08 * edge)
        tint = (tone, tone, tone)
        tseed = seed * 1000 + i * 17
        if kind == "cedar":
            h = rng.uniform(6.0, 9.5) * (1.08 - 0.22 * edge)
            base = conifer(needles, p, h, rng.uniform(1.8, 2.5) * (h / 8.0) ** 0.6, rng.choice([3, 4, 4, 5]), rng.choice([6, 7]), tint, lean, tseed, rng.uniform(0.14, 0.22))
        elif kind == "fir":
            h = rng.uniform(8.0, 11.0) * (1.06 - 0.18 * edge)
            base = conifer(needles, p, h, rng.uniform(1.2, 1.55), rng.choice([4, 5]), 5, tuple(c * 0.86 for c in tint), lean * 0.5, tseed, rng.uniform(0.1, 0.16))
        elif kind == "broadleaf":
            h = rng.uniform(4.5, 6.5)
            warm = (tone * 1.0, tone * 1.02, tone * 0.62)
            base = broadleaf(needles, p, h, rng.uniform(1.6, 2.2), tuple(min(1.0, c) for c in warm), lean, tseed)
        elif kind == "young":
            h = rng.uniform(2.6, 4.0)
            base = conifer(needles, p, h, rng.uniform(0.9, 1.2), 3, 5, tuple(min(1.0, c * 1.08) for c in tint), lean, tseed, 0.12)
        else:
            snag(wood, p, rng.uniform(5.0, 7.5), lean, tseed)
            continue
        # Every trunk starts SINK under the ground, so the stand sinks into a slope instead of standing on stilts.
        top = p + lean * base + Vector((0, 0, base + 0.3))
        K.tube(wood, [p + Vector((0, 0, -SINK)), top], [0.3 if kind != "young" else 0.16, 0.22 if kind != "young" else 0.12], 5,
               lambda q: tuple(ch * (0.7 + 0.3 * min(1, (q.z + 0.4) / 1.5)) for ch in BARK))
    # The floor: a deep dark plug of needles under the whole stand, its top a low mound, its foot SINK down.
    floor = K.Build()
    rim = 1 + wob[0] * 0.5
    K.ellipsoid(floor, Vector((0, 0, (1.0 - SINK) / 2)), Vector((hx * 0.88 * rim, hz * 0.88 * rim, (1.0 + SINK) / 2)), (0, 0, 1, 1),
                lambda q: (0.5, 0.5, 0.5), segs=14, rings=4, wobble=0.12, seed=seed, normal_of=normal_of)
    floor_ids = range(len(needles.verts), len(needles.verts) + len(floor.verts))
    needles.extend(floor)
    for v in floor_ids:                       # tuck the plug in at the dent and the wobble so it stays inside the trees
        q = needles.verts[v]
        if not inside(q.x, q.y, 1.0):
            q.x, q.y = q.x * 0.9, q.y * 0.9
    tex = mass_image()
    objs = [needles.object("Needles", K.material("mForestNeedles", tex)), wood.object("Trunk", K.plain("mTreeTrunk"))]
    out = os.path.join(K.OUT, f"forest-mass-{name}.glb")
    K.export(objs, out)
    print(f"FOREST forest-mass-{name}: trees {len(trees)} tris {({o.name: K.tris(o) for o in objs})}")
    return out


def main():
    names = [a for a in ARGS if a in MASSES] or list(MASSES)
    written = [build(n, *MASSES[n]) for n in names]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)


if __name__ == "__main__":
    main()
