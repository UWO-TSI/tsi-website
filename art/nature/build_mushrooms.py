"""The forage mushrooms (asset audit rank 14): what a woods node shows on the ground, in place of the 48-triangle
flat-shaded Kenney cones. One model per species, the same designs as the bag items (art/props-enemies/build_items.py:
mushroom_round, mushroom_flat, mushroom_skinny) grown into a small rounded cluster you can see from the follow camera.

  round    Round Mushroom (common): a red dome cap with cream spots on a stout stem, a small one beside it
  flat     Flat Mushroom (uncommon): wide flat brown caps, two of them at different heights
  skinny   Skinny Mushroom (rare): a clump of tall thin stems with small tan caps

Every part is a closed lathe (stem; cap with its gills underneath) or a closed blob (spots), smooth normals, one
matte vertex-coloured material: one primitive. The underside and the stem under the cap darken by ray-cast occlusion.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/nature/build_mushrooms.py [-- preview <png>]

Writes web/public/assets/game/forage/mushroom-<species>.glb in game units, standing on y 0.
"""
import math, os, sys
import numpy as np
import bmesh, bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nature_kit as K  # noqa: E402
from nature_kit import lin, smooth  # noqa: E402

OUT = os.path.join(K.ASSETS, "forage")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# The bag items' colours (build_items.py), so the ground and the bag agree.
SPECIES = {
    "round": {"cap": "#C7553F", "spot": "#F7F0E1", "stem": "#EFE6D2", "gill": "#D8C7A8"},
    "flat": {"cap": "#A8794C", "stem": "#E9DEC6", "gill": "#CBB38C"},
    "skinny": {"cap": "#D9B97A", "stem": "#F1E9D6", "gill": "#E3D2AE"},
}


def mushroom(bm, at, cap_r, cap_h, stem_h, stem_r, flat=False, lean=(0.0, 0.0), yaw=0.0, n=16, spots=0, seed=0, marks=None):
    """One mushroom into bm: a stem, a cap with its gill underside (one closed lathe), optional spots. `marks` collects
    (vertex range, part) for painting."""
    xf = Matrix.Translation(Vector(at)) @ Euler((lean[0], lean[1], yaw)).to_matrix().to_4x4()
    v0 = len(bm.verts)
    K.lathe(bm, [(0, -0.01), (stem_r * 1.3, -0.01), (stem_r * 1.18, stem_h * 0.12), (stem_r * 1.0, stem_h * 0.55), (stem_r * 0.9, stem_h + 0.004),
                 (0, stem_h + 0.004)], n=max(8, n - 4))
    v1 = len(bm.verts)
    top = stem_h + cap_h
    if flat:
        prof = [(0, stem_h - 0.002), (stem_r * 1.1, stem_h), (cap_r * 0.6, stem_h + cap_h * 0.1), (cap_r * 0.97, stem_h + cap_h * 0.24),
                (cap_r, stem_h + cap_h * 0.36), (cap_r * 0.9, stem_h + cap_h * 0.6), (cap_r * 0.62, stem_h + cap_h * 0.86), (cap_r * 0.3, top - 0.003), (0, top)]
    else:
        prof = [(0, stem_h - 0.004), (stem_r * 1.1, stem_h), (cap_r * 0.62, stem_h + cap_h * 0.1), (cap_r * 0.95, stem_h + cap_h * 0.2),
                (cap_r, stem_h + cap_h * 0.3), (cap_r * 0.97, stem_h + cap_h * 0.5), (cap_r * 0.84, stem_h + cap_h * 0.72), (cap_r * 0.6, stem_h + cap_h * 0.9),
                (cap_r * 0.3, top - 0.002), (0, top)]
    K.lathe(bm, prof, n=n, c=(0, 0, 0))
    v2 = len(bm.verts)
    rng = np.random.default_rng(seed)
    if spots:
        for k in range(spots):
            a = k / spots * math.tau + rng.uniform(-0.3, 0.3)
            t = rng.uniform(0.35, 0.8)
            # On the cap's dome: interpolate the profile at height fraction t.
            r_at = cap_r * math.sin(math.acos(t)) * 0.98
            z_at = stem_h + cap_h * (0.3 + 0.7 * t)
            p = Vector((math.cos(a) * r_at, math.sin(a) * r_at, z_at))
            nrm = Vector((p.x / cap_r, p.y / cap_r, (p.z - stem_h - cap_h * 0.3) / (cap_h * 0.7) * 0.9)).normalized()
            q = Vector((0, 0, 1)).rotation_difference(nrm)
            r = cap_r * rng.uniform(0.11, 0.16)
            fs = K.uv_sphere(bm, (0, 0, 0), (r, r, r * 0.35), segs=6, rings=3)
            for v in {v for f in fs for v in f.verts}:
                v.co = p + q @ v.co
    v3 = len(bm.verts)
    bm.verts.ensure_lookup_table()
    for i in range(v0, v3):
        bm.verts[i].co = xf @ bm.verts[i].co
    if marks is not None:
        marks += [(v0, v1, "stem", None), (v1, v2, "cap", (xf, stem_h, cap_r, cap_h)), (v2, v3, "spot", None)]


BUILD = {
    "round": lambda bm, marks: (
        mushroom(bm, (0.0, 0.0, 0.0), 0.11, 0.1, 0.085, 0.034, lean=(0.06, -0.04), yaw=0.3, n=12, spots=6, seed=1, marks=marks),
        mushroom(bm, (0.12, -0.07, 0.0), 0.065, 0.06, 0.05, 0.022, lean=(-0.12, 0.18), yaw=1.1, n=10, spots=3, seed=2, marks=marks),
    ),
    "flat": lambda bm, marks: (
        mushroom(bm, (0.0, 0.02, 0.0), 0.13, 0.064, 0.075, 0.03, flat=True, lean=(0.05, 0.05), yaw=0.2, n=12, marks=marks),
        mushroom(bm, (0.13, -0.07, 0.0), 0.085, 0.046, 0.045, 0.022, flat=True, lean=(-0.1, 0.2), yaw=0.9, n=10, marks=marks),
        mushroom(bm, (-0.1, -0.09, 0.0), 0.06, 0.036, 0.03, 0.017, flat=True, lean=(0.15, -0.2), yaw=2.0, n=10, marks=marks),
    ),
    "skinny": lambda bm, marks: [
        mushroom(bm, (x, y, 0.0), r, r * 0.85, h, sr, lean=lean, yaw=k * 1.7, n=8, marks=marks)
        for k, (x, y, r, h, sr, lean) in enumerate([
            (0.0, 0.0, 0.042, 0.2, 0.012, (0.05, 0.0)),
            (0.045, -0.03, 0.036, 0.16, 0.011, (-0.1, 0.16)),
            (-0.04, -0.035, 0.032, 0.13, 0.01, (0.14, -0.12)),
            (0.01, 0.045, 0.03, 0.115, 0.0095, (-0.16, -0.05)),
        ])],
}


def build(name):
    bm = bmesh.new()
    marks = []
    BUILD[name](bm, marks)
    ob = K.to_object(bm, f"mushroom-{name}")
    K.shade_smooth(ob)
    col = {k: lin(v) for k, v in SPECIES[name].items()}
    ao = K.vertex_ao(ob, samples=40, dist=0.12, seed=3)
    me = ob.data
    part_of = {}
    for a, b, part, info in marks:
        for i in range(a, b):
            part_of[i] = (part, info)
    vcols = []
    for v in me.vertices:
        part, info = part_of[v.index]
        occ = ao[v.index] ** 1.4
        if part == "stem":
            # Cream, a little earthier at the foot.
            c = col["stem"] * (0.62 + 0.38 * occ) * (0.82 + 0.18 * smooth(0.0, 0.06, v.co.z))
        elif part == "spot":
            c = col["spot"] * (0.85 + 0.15 * occ)
        else:
            xf, stem_h, cap_r, cap_h = info
            local = xf.inverted() @ v.co
            nl = (xf.inverted().to_3x3() @ v.normal).normalized()
            if nl.z < -0.2 or local.z < stem_h + cap_h * 0.22:
                # The gills: the cap's underside, darker toward the stem.
                c = col["gill"] * (0.55 + 0.45 * occ) * (0.85 + 0.15 * smooth(0.0, cap_r, math.hypot(local.x, local.y)))
            else:
                up = smooth(stem_h + cap_h * 0.3, stem_h + cap_h, local.z)
                c = col["cap"] * (0.86 + 0.24 * up) * (0.75 + 0.25 * occ)
                c = c * (1.0 + 0.06 * K.noise3(v.co, 60.0, 4))
        vcols.append(c)
    K.paint(ob, lambda vi, _p: vcols[vi])
    K.set_material(ob, K.vc_material("mushroom"))
    K.export(ob, os.path.join(OUT, f"mushroom-{name}.glb"))
    return ob


if __name__ == "__main__":
    K.reset()
    built = [build(n) for n in SPECIES]
    if "preview" in ARGS:
        K.preview(built, ARGS[ARGS.index("preview") + 1], cols=3, spacing=0.45, lens=70)
