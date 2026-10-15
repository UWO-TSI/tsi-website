"""The island's bushes (asset audit rank 8, David: "close bush all the way, different versions for seasons").

A bush is ONE closed, rounded volume: a dome of overlapping leaf clumps fused into a single watertight skin (a voxel
remesh of the clump spheres, its creases softened, then decimated), so there are no one-sided leaf shells and nothing
reads as a flat fan from behind. Smooth normals, one matte vertex-coloured material, one draw per instanced batch.

Two shapes (a: a round dome, b: a low wide mound), each in four seasons on the same silhouette, so the season swap
(lib/game/seasonalLook.ts SEASON_BUSHES) never jumps the shape:

  spring   fresh green, pink and white azalea blossoms
  summer   deep lush green, blue and lilac hydrangea heads
  autumn   the autumn palette: orange, amber and rust clumps, a last green one or two
  winter   dark evergreen holly under a soft snow cap, red berries

Each in two levels of detail: <name>.glb (near) and <name>.lod1.glb (far), swapped per instance by the camera's
distance (components/game/InstancedNature.tsx).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/nature/build_bushes.py [-- preview <png>]

Writes web/public/assets/game/plants/bush-<shape>-<season>[.lod1].glb. Frame: game units, base on y 0 (a little sunk),
about a cell across like the dump's bushes it replaces. Every random choice is seeded: a rebuild writes the same models.
"""
import math, os, sys
import numpy as np
import bmesh, bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nature_kit as K  # noqa: E402
from nature_kit import lin, smooth  # noqa: E402

OUT = os.path.join(K.ASSETS, "plants")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SEASONS = ("spring", "summer", "autumn", "winter")
TRIS = {0: 1000, 1: 320}
SINK = 0.04

# Leaf clump colours per season (sRGB), picked per clump by seed; `accent` decorations sit in the skin.
PALETTE = {
    "spring": {"leaf": ["#79ad4c", "#6aa046", "#8cbc58", "#5e9440"], "deep": "#3f6e32", "sun": "#b8d77a"},
    "summer": {"leaf": ["#4f8c3a", "#447f35", "#5c9a42", "#3d7431"], "deep": "#284f25", "sun": "#93c063"},
    "autumn": {"leaf": ["#e2803a", "#e99540", "#d4682f", "#e58a38", "#c95a2c", "#eaa448"], "deep": "#7a3420", "sun": "#f7c766"},
    "winter": {"leaf": ["#3f6c40", "#36623a", "#4a7748", "#335c37"], "deep": "#1f3d27", "sun": "#6f9a6a"},
}
SNOW, SNOW_SHADE = "#f3f6f9", "#cfdbe8"
ACCENTS = {
    "spring": {"n": 16, "r": 0.058, "cols": ["#f29bbb", "#f7c8d8", "#fbf0ea", "#e7769f"], "centre": "#f8e3a0"},
    "summer": {"n": 6, "r": 0.1, "cols": ["#7f9fdf", "#a28ad6", "#8bb2ea", "#b49ae0"], "centre": None},
    "autumn": {"n": 0},
    "winter": {"n": 9, "r": 0.036, "cols": ["#c4303a", "#d43f3f", "#b2262f"], "centre": None},
}


def clumps(shape):
    """Leaf puffs [(centre, radii)] for a shape, seeded: a core and two rings of puffs round it plus a crown, few and
    big enough that each stays round at the triangle budget."""
    rng = np.random.default_rng({"a": 7, "b": 19}[shape])
    if shape == "a":
        core_c, core_r = Vector((0, 0, 0.34)), Vector((0.33, 0.31, 0.29))
        rings = [(2, 0.6, 0.12, 0.22), (5, 0.3, 0.42, 0.21), (7, -0.06, 0.41, 0.215)]
    else:
        core_c, core_r = Vector((0, 0, 0.27)), Vector((0.47, 0.33, 0.22))
        rings = [(3, 0.55, 0.2, 0.2), (6, 0.25, 0.48, 0.2), (8, -0.1, 0.45, 0.205)]
    out = [(core_c, core_r)]
    for k, (n, z, spread, r) in enumerate(rings):
        for i in range(n):
            a = math.tau * i / n + k * 0.7 + rng.uniform(-0.22, 0.22)
            d = Vector((math.cos(a) * spread * 2.2, math.sin(a) * spread * 2.2, z * 1.6))
            c = core_c + Vector((d.x * core_r.x, d.y * core_r.y, d.z * core_r.z)) * rng.uniform(0.92, 1.04)
            out.append((c, r * rng.uniform(0.88, 1.1)))
    return out


def own_puff(p, cl):
    """(index of the puff p sits deepest inside, the normalised distances to every puff)."""
    s = np.array([(p - c).length / (r.x if isinstance(r, Vector) else r) for c, r in cl])
    return int(np.argmin(s)), s


def skin(shape, tris, snow=False):
    """The fused puff volume, decimated to about `tris` triangles. After the voxel fuse each vertex is pulled back
    toward the sphere of the puff it belongs to (re-inflated), so every puff stays round and the creases stay clean."""
    cl = clumps(shape)
    bm = bmesh.new()
    for c, r in cl:
        rr = (r.x, r.y, r.z) if isinstance(r, Vector) else (r, r, r)
        K.uv_sphere(bm, c, rr, segs=24, rings=14)
    ob = K.to_object(bm, f"bush-{shape}")
    K.apply_mod(ob, "REMESH", mode="VOXEL", voxel_size=0.016, adaptivity=0.0, use_smooth_shade=True)
    K.apply_mod(ob, "SMOOTH", factor=0.5, iterations=3)
    for v in ob.data.vertices:
        own, s = own_puff(v.co, cl)
        if own == 0:
            continue
        c, r = cl[own]
        on = c + (v.co - c).normalized() * r
        v.co = v.co.lerp(on, 0.45)
    for v in ob.data.vertices:
        # Flatten what's under the ground (never seen) so the decimator spends nothing there.
        if v.co.z < 0.03:
            v.co.z = 0.03
    ob.data.update()
    K.apply_mod(ob, "SMOOTH", factor=0.3, iterations=1)
    if snow:
        # A soft cap on each puff's top: pushed up and out a little, so the snow has thickness at its edge.
        for v in ob.data.vertices:
            own, _ = own_puff(v.co, cl)
            c, r = cl[own]
            up = smooth(0.25, 0.8, (v.co - c).normalized().z) * smooth(0.3, 0.9, v.normal.z)
            v.co += Vector((0, 0, 0.022)) * up + v.normal * 0.008 * up
        ob.data.update()
        K.apply_mod(ob, "SMOOTH", factor=0.4, iterations=1)
    K.decimate_to(ob, tris)
    K.ground_at_zero(ob, SINK)
    K.shade_smooth(ob)
    return ob


def accent_spots(ob, n, seed, min_gap, zmin):
    """Up to n well spread points on the visible skin (above zmin, not facing down): (position, normal)."""
    rng = np.random.default_rng(seed)
    vs = [v for v in ob.data.vertices if v.co.z > zmin and v.normal.z > -0.2]
    rng.shuffle(vs)
    out = []
    for v in vs:
        if all((v.co - p).length > min_gap for p, _ in out):
            out.append((v.co.copy(), v.normal.copy()))
        if len(out) >= n:
            break
    return out


def oriented_blob(bm, c, n, r, flat, segs, rings):
    """An ellipsoid of radius r, flattened to `flat` along the normal n (a blossom lies on the leaves)."""
    q = Vector((0, 0, 1)).rotation_difference(n)
    faces = K.uv_sphere(bm, (0, 0, 0), (r, r, r * flat), segs=segs, rings=rings)
    for v in {v for f in faces for v in f.verts}:
        v.co = c + q @ v.co


def accents(ob, season, lod, seed):
    """Blossoms, hydrangea heads or berries: small closed blobs half sunk in the skin, joined into the same mesh.
    Returns [(first vertex, end vertex, colour, centre, radius)] for painting."""
    spec = ACCENTS[season]
    if not spec["n"]:
        return ob, []
    n = spec["n"] if lod == 0 else max(3, spec["n"] // 2)
    spots = accent_spots(ob, n, seed, min_gap=spec["r"] * (3.0 if season != "winter" else 4.5), zmin=0.16)
    rng = np.random.default_rng(seed + 5)
    bm = bmesh.new()
    marks = []
    for p, nrm in spots:
        r = spec["r"] * rng.uniform(0.85, 1.15)
        col = spec["cols"][int(rng.integers(len(spec["cols"])))]
        v0 = len(bm.verts)
        if season == "summer":
            # A hydrangea head: a squashed ball of florets, two thirds out of the leaves.
            c = p + nrm * r * 0.3
            oriented_blob(bm, c, nrm, r, 0.8, *((9, 6) if lod == 0 else (6, 4)))
        elif season == "spring":
            # An azalea blossom: a flat round flower lying on the leaves.
            c = p + nrm * r * 0.18
            oriented_blob(bm, c, nrm, r, 0.42, *((8, 4) if lod == 0 else (5, 3)))
        else:
            c = p + nrm * r * 0.55
            oriented_blob(bm, c, nrm, r, 1.0, *((6, 4) if lod == 0 else (5, 3)))
        marks.append((v0, len(bm.verts), col, c, r, nrm.copy()))
    acc = K.to_object(bm, "acc")
    K.shade_smooth(acc)
    base_n = len(ob.data.vertices)
    joined = K.join([ob, acc], ob.name)
    return joined, [(base_n + a, base_n + b, col, c, r, nrm) for a, b, col, c, r, nrm in marks]


def paint(ob, shape, season, marks, seed):
    """Per puff: its own leaf colour, lit from the sky on its upper side and shaded under it (each puff reads round
    whatever the mesh normals do), crevices between puffs darkened by ray-cast occlusion toward the season's deep
    colour, a little leafy noise, and the season's dressing."""
    pal = PALETTE[season]
    cl = clumps(shape)
    rng = np.random.default_rng(seed)
    cols = [lin(pal["leaf"][int(rng.integers(len(pal["leaf"])))]) * rng.uniform(0.86, 1.12) for _ in cl]
    deep, sun = lin(pal["deep"]), lin(pal["sun"])
    ao = K.vertex_ao(ob, samples=48, dist=0.3, seed=seed)
    print(f"AO {ob.name} min={ao.min():.2f} mean={ao.mean():.2f}")
    me = ob.data
    zs = np.array([v.co.z for v in me.vertices])
    top = zs.max()
    acc_of = {}
    for a, b, col, c, r, nrm in marks:
        for vi in range(a, b):
            acc_of[vi] = (lin(col), c, r, nrm)
    snow = season == "winter"
    vcols = []
    for v in me.vertices:
        p = v.co
        if v.index in acc_of:
            col, c, r, nrm = acc_of[v.index]
            face = (p - c).normalized().dot(nrm)
            k = col * (0.78 + 0.3 * smooth(-0.3, 0.9, face)) * (0.8 + 0.2 * ao[v.index])
            if season == "spring" and face > 0.75 and (p - c).length < r * 0.75:
                k = K.mixc(k, lin(ACCENTS["spring"]["centre"]), 0.85)
            if season == "summer":
                k = k * (1.0 + 0.12 * K.noise3(p, 60.0, seed + 2))
            vcols.append(k)
            continue
        # The puff this point belongs to: the one it sits deepest inside, softly blended at the creases.
        _, s = own_puff(p, cl)
        w = np.exp(-14.0 * (s - s.min()))
        w /= w.sum()
        base = sum(wi * ci for wi, ci in zip(w, cols))
        order = np.argsort(s)
        own = int(order[0])
        pc, pr = cl[own]
        # The crease between two puffs: where the two nearest are about as near.
        crease = math.exp(-((s[order[1]] - s[order[0]]) / 0.09) ** 2)
        puff_n = (p - pc).normalized()
        lit = smooth(-0.7, 0.9, puff_n.z)
        nz = K.noise3(p, 9.0, seed) * 0.5 + K.noise3(p, 26.0, seed + 3) * 0.5
        base = base * (1.0 + 0.14 * nz)
        base = K.mixc(base, sun, 0.38 * lit * lit + 0.05 * max(0.0, nz))
        base = base * (0.82 + 0.22 * lit)
        occ = ao[v.index] ** 2.0 * (1.0 - 0.55 * crease)
        c = K.mixc(deep, base, 0.1 + 0.9 * occ)
        c = c * (0.8 + 0.22 * smooth(0.0, top * 0.8, p.z))
        if snow:
            # Each puff's top under snow (the puff's own up, so caps are round), the lower puffs less.
            sn = smooth(0.3, 0.7, puff_n.z) * smooth(0.2, 0.6, v.normal.z) * smooth(0.25, 0.6, p.z / top)
            sn = max(0.0, min(1.0, sn + 0.1 * K.noise3(p, 8.0, seed + 11)))
            white = K.mixc(lin(SNOW_SHADE), lin(SNOW), smooth(0.5, 1.0, v.normal.z)) * (0.88 + 0.12 * occ)
            c = K.mixc(c, white, smooth(0.25, 0.6, sn))
        vcols.append(c)
    K.paint(ob, lambda vi, _p: vcols[vi])


def build(shape, season, lod):
    seed = {"a": 100, "b": 200}[shape] + SEASONS.index(season) * 7 + lod
    # Winter spends more on the skin: the snow's edge is drawn by the vertices.
    ob = skin(shape, int(TRIS[lod] * (1.35 if season == "winter" else 1.0)), snow=season == "winter")
    ob, marks = accents(ob, season, lod, seed)
    paint(ob, shape, season, marks, {"a": 100, "b": 200}[shape])
    K.set_material(ob, K.vc_material("bush"))
    name = f"bush-{shape}-{season}" + (".lod1" if lod else "")
    ob.name = name
    K.export(ob, os.path.join(OUT, f"{name}.glb"))
    return ob


if __name__ == "__main__":
    K.reset()
    only_shape = [a for a in ARGS if a in ("a", "b")] or ["a", "b"]
    only_season = [a for a in ARGS if a in SEASONS] or list(SEASONS)
    built = []
    for shape in only_shape:
        for season in only_season:
            for lod in (0, 1):
                ob = build(shape, season, lod)
                built.append(ob)
    if "preview" in ARGS:
        out = ARGS[ARGS.index("preview") + 1]
        near = [o for o in built if not o.name.endswith(".lod1")]
        for o in built:
            if o not in near:
                bpy.data.objects.remove(o)
        K.preview(near, out, cols=len(only_season), spacing=1.6)
