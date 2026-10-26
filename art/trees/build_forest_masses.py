"""The new world's forest masses (terrain v3, game/terrain-art; David, 2026-10-26: "make it look like a dense forest
without actually rendering so many trees, like just low qual so it looks like dense forest that isnt opened that entire
section").

Each mass is a stand of tall cedars merged into one mesh on one base, to be instanced over the closed forest: every
crown a stack of closed cones of the cedars' painted needle mass (art/trees/textures/needles.png, its opaque bottom-left
mass, cut out to its own small texture), each cone's hem in rounded fingers as the cedar's fringe hangs; dark trunks
show only under the lowest tiers at the stand's edge, and a low mound of the same needles closes its floor so nothing
shows through between the trees. Heights vary for a ragged skyline. Two materials: mForestNeedles (opaque, the texture
times COLOR_0) and mTreeTrunk (plain). No casters: the meshes cast their own shadow.

Writes web/public/assets/game/plants/forest-mass-{a,b,c}.glb in game units at scale 1, the origin on the ground at the
stand's centre, then web/scripts/finish-greenery.mjs sets the materials and checks the files:
  a  round, about 12 across, 11 cedars          b  long, about 16 by 9, along x, 13 cedars     c  small, about 10 across, 8 cedars

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_forest_masses.py [-- a b c]
"""
import math, os, random, subprocess, sys
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# (half extents x and z of the stand, cedars, seed)
MASSES = {"a": ((6.0, 6.0), 11, 1), "b": ((8.0, 4.5), 13, 2), "c": ((5.0, 5.0), 8, 3)}
SEGS, TIERS = 7, 4
BARK = K.lin("#4e3626")


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


def cone(b, c, hem, top, r, shade, normal_of, seed, under=True):
    """A closed tier: apex at `top`, a hem of rounded fingers at `hem` (alternate rim points out and in), its underside
    a shallow cone back up to the trunk (the lowest tier's only: the tier below hides the rest). UVs mirror round it over the whole mass texture."""
    rng = random.Random(seed)
    ph = rng.uniform(0, math.tau)
    apex = b.vert(c + Vector((0, 0, top)), K.UP)
    mid, rim = [], []
    for k in range(SEGS * 2):
        a = ph + math.tau * k / (SEGS * 2)
        d = Vector((math.cos(a), math.sin(a), 0))
        out = 1.0 if k % 2 == 0 else 0.84
        p_mid = c + d * r * 0.55 + Vector((0, 0, top + (hem - top) * 0.55))
        p_rim = c + d * r * out + Vector((0, 0, hem - (0.0 if k % 2 == 0 else -0.12)))
        mid.append(b.vert(p_mid, normal_of(p_mid - c)))
        rim.append(b.vert(p_rim, normal_of(p_rim - c)))
    hub = b.vert(c + Vector((0, 0, hem + (top - hem) * 0.3)), Vector((0, 0, -1))) if under else None
    n = SEGS * 2
    uv = lambda k, t: (K.tri_wave(k / n * 4), 0.02 + 0.96 * t)
    col = lambda t: tuple(shade * (0.8 + 0.25 * t) for _ in range(3))
    for k in range(n):
        k2 = (k + 1) % n
        b.face([apex, mid[k], mid[k2]], [uv(k + 0.5, 1), uv(k, 0.55), uv(k + 1, 0.55)], [col(1), col(0.55), col(0.55)])
        b.face([mid[k], rim[k], rim[k2], mid[k2]], [uv(k, 0.55), uv(k, 0), uv(k + 1, 0), uv(k + 1, 0.55)], [col(0.55), col(0), col(0), col(0.55)])
        if under:
            b.face([rim[k2], rim[k], hub], [uv(k + 1, 0), uv(k, 0), uv(k + 0.5, 0.3)], [col(0)] * 3)


def build(name, half, count, seed):
    K.reset()
    rng = random.Random(f"forest-{seed}")
    hx, hz = half

    def normal_of(d):
        q = Vector((d.x, d.y, 0))
        out = q.normalized() if q.length > 1e-4 else Vector((0, 0, 0))
        return (out * 0.7 + K.UP * 0.6).normalized()

    # Cedars spread over the stand (Blender x, y = game x, -z), a little jitter on a sunflower spiral so none overlap much.
    spots = []
    for i in range(count):
        t = (i + 0.5) / count
        a = i * math.pi * (3 - math.sqrt(5)) + rng.uniform(-0.2, 0.2)
        rr = math.sqrt(t) * 0.82
        spots.append(Vector((math.cos(a) * rr * hx, math.sin(a) * rr * hz, 0)))
    needles, wood = K.Build(), K.Build()
    for i, p in enumerate(spots):
        edge = math.hypot(p.x / hx, p.y / hz)
        h = rng.uniform(6.5, 9.5) * (1.08 - 0.25 * edge)
        r0 = rng.uniform(1.9, 2.4) * (h / 8.0) ** 0.6
        base = h * rng.uniform(0.16, 0.22)
        tone = rng.uniform(0.85, 1.08)
        for t in range(TIERS):
            f = t / TIERS
            hem = base + (h - base) * f * 0.92
            top = hem + (h - base) / TIERS * 1.75
            r = r0 * (1 - 0.78 * f)
            cone(needles, p, hem, min(top, h), r, tone * (0.72 + 0.32 * f + 0.1 * edge), normal_of, seed * 1000 + i * 10 + t, under=t == 0)
        if edge > 0.45:
            K.tube(wood, [p + Vector((0, 0, -0.1)), p + Vector((0, 0, base + 0.4))], [0.32, 0.26], 6,
                   lambda q: tuple(c * (0.7 + 0.3 * min(1, q.z / 1.5)) for c in BARK))
    # The floor: a low dark mound of needles under the whole stand.
    floor = K.Build()
    K.ellipsoid(floor, Vector((0, 0, 0.0)), Vector((hx * 0.86, hz * 0.86, 0.9)), (0, 0, 1, 1), lambda q: (0.55, 0.55, 0.55), segs=12, rings=4,
                wobble=0.12, seed=seed, normal_of=lambda q: normal_of(q), ground=0.0)
    needles.extend(floor)
    tex = mass_image()
    objs = [needles.object("Needles", K.material("mForestNeedles", tex)), wood.object("Trunk", K.plain("mTreeTrunk"))]
    out = os.path.join(K.OUT, f"forest-mass-{name}.glb")
    K.export(objs, out)
    print(f"FOREST forest-mass-{name}: tris {({o.name: K.tris(o) for o in objs})}")
    return out


def main():
    names = [a for a in ARGS if a in MASSES] or list(MASSES)
    written = [build(n, *MASSES[n]) for n in names]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)


main()
