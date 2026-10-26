"""Organic stones for the new world (game/village-art2; David, R2c 2026-10-26: "remodel rocks to be more organic shape
than just spheres, use blender, treat each asset properly"; path.jpg in specs/references/terrain/r2-2026-10-26/).

Each stone is a chunk: points on a rounded box (an L^p sphere), jittered and tapered so it sits wide, chiselled by a few
planes (the points past a plane are pressed onto it, so the hull grows a broad flat facet there; a near-level one makes
a shelf for moss), the convex hull's near-coplanar triangles merged into broad facets, every edge bevelled round. Layered stones stack two or three flat chunks, each stepped back from the one
under it. Colour in COLOR_0 on the shared P_Stone preset: a tone per facet, soft mottling, the foot darker, and moss on
the facets that face up (where noise lets it, so it creeps down a side here and stops short there).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_stones.py [-- names...] [-- review <dir>]

Writes, under web/public/assets/game/props/, in game units at scale 1, the origin on the ground at the stone's centre,
each sunk a little below y 0 so it looks bedded in:
  path-rock-slab.glb     an upright leaning slab with a chipped top and a pebble at its foot (about 0.45 across).
  path-rock-low.glb      a low layered stone, a flat mossy shelf over a wider base (about 0.7 across).
  path-rock-cluster.glb  a blocky stone, a flat one and a small one in a huddle (about 0.95 across).
  moss-boulder-a.glb     a big chiselled boulder on a broken base slab, mossy on top (about 1.6 across, 1.1 tall).
  moss-boulder-b.glb     a low outcrop of three stepped slabs (about 2.5 by 1.7, 0.8 tall), moss on each shelf.
Seeded: a rebuild writes the same models.
"""
import bmesh, math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
STONE, MOSS_DARK, MOSS_LIGHT = "#b4b7a8", "#71864a", "#a0b46a"


def wave(seed, n=5, freq=(2.0, 5.0)):
    """Smooth 3D noise in about [-1, 1]: a few sines along random directions."""
    r = np.random.default_rng(seed)
    terms = [(r.normal(size=3), r.uniform(*freq), r.uniform(0, math.tau)) for _ in range(n)]
    terms = [(d / np.linalg.norm(d), f, ph) for d, f, ph in terms]
    return lambda p: sum(math.sin(f * float(np.dot(d, p)) + ph) for d, f, ph in terms) / math.sqrt(n)


def chunk(size, seed, cuts=(), taper=0.25, round_p=2.6, bevel=0.14, n=24, segs=2):
    """A chiselled stone, game half extents `size` (x, y up, z), its middle at the origin: a bmesh in game coordinates.
    cuts: [(direction (x, y, z), keep)]: points further than `keep` of the extent along the direction are pressed back
    onto that plane."""
    rng = np.random.default_rng(seed)
    S = np.array(size)
    pts = []
    for _ in range(n):
        d = rng.normal(size=3)
        d /= np.sum(np.abs(d) ** round_p) ** (1 / round_p)
        q = d * S * rng.uniform(0.9, 1.06)
        q[[0, 2]] *= 1 - taper * (q[1] / S[1] + 1) / 2            # wide at the foot
        pts.append(q)
    pts = np.array(pts)
    for dvec, keep in cuts:
        nv = np.array(dvec, float) / np.linalg.norm(dvec)
        reach = (pts @ nv).max()
        lim = reach * keep
        over = pts @ nv - lim
        pts -= np.outer(np.clip(over, 0, None), nv)
    bm = bmesh.new()
    vs = [bm.verts.new(Vector(p)) for p in pts]
    hull = bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.delete(bm, geom=list({g for g in hull["geom_interior"] + hull["geom_unused"] if isinstance(g, bmesh.types.BMVert)}), context="VERTS")
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=min(size) * 0.12)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(14), verts=bm.verts, edges=bm.edges)
    rim = bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel * min(size) * 2, segments=segs, affect="EDGES", profile=0.6, clamp_overlap=True)
    edge = bm.faces.layers.int.new("rim")
    for f in rim["faces"]:
        if f.is_valid:
            f[edge] = 1
    bm.normal_update()
    return bm


def place(k, bm, at, yaw=0.0, tilt=(0.0, 0.0), seed=0, stone=STONE, moss=0.55, sink=0.05):
    """Copy a chunk into the kit at game `at` (its foot sunk `sink` under at's y), turned, painted. moss: how far down
    from straight up the moss reaches (0 none, 1 the whole top half and more)."""
    R = K.game_rot(yaw=yaw, pitch=tilt[0], roll=tilt[1])
    ys = [(R @ v.co).y for v in bm.verts]
    lift = Vector(at) + Vector((0, -min(ys) - sink, 0))
    rng = np.random.default_rng(seed)
    mott, patch = wave(seed + 7, 6, (3.0, 7.0)), wave(seed + 13, 5, (2.0, 5.0))
    lo, hi = lift.y - sink, lift.y + max(ys)
    base, rim = np.array(K.lin(stone)), bm.faces.layers.int["rim"]
    dark, light = np.array(K.lin(MOSS_DARK)), np.array(K.lin(MOSS_LIGHT))
    for f in bm.faces:
        n = R @ f.normal
        tone = base * rng.uniform(0.9, 1.08) * (0.96 + 0.06 * n.y) * (1.1 if f[rim] else 1.0)   # the rounded edges catch the light
        cols = []
        for lp in f.loops:
            p = np.array(R @ lp.vert.co + lift)
            up = 0.5 * n.y + 0.5 * (R @ lp.vert.normal).y
            h = min(1.0, max(0.0, (p[1] - lo) / max(hi - lo, 1e-6)))
            stone_c = tone * (0.7 + 0.3 * h ** 0.6) * (1 + 0.08 * mott(p))
            m = float(K.smooth(0.6, 0.82, up * (0.55 + 0.45 * moss) + 0.3 * patch(p) + 0.2 * (moss - 0.5))) if moss else 0.0
            moss_c = (dark + (light - dark) * (0.5 + 0.5 * mott(p * 1.7))) * (0.88 + 0.16 * h)
            cols.append((*(stone_c * (1 - m) + moss_c * m), 1.0))
        face = k.face([k.vert(tuple(R @ lp.vert.co + lift)) for lp in f.loops], [(0, 0)] * len(f.loops), k._stone)
        for lp, col in zip(face.loops, cols):
            lp[k.col] = col
    bm.free()


def kit(name):
    K.reset()
    k = K.Kit(name)
    k._stone = K.Mat("P_Stone", rough=0.95)
    return k


def path_rock_slab():
    k = kit("path-rock-slab")
    place(k, chunk((0.21, 0.34, 0.1), 3, cuts=[((0.4, 1, 0.1), 0.84), ((-1, 0.5, 0.2), 0.8), ((0.15, 0, 1), 0.7), ((-0.1, 0, -1), 0.72), ((1, -0.2, 0), 0.86)],
                taper=0.15, round_p=3.2, segs=1),
          (0, 0, 0), yaw=0.2, tilt=(0.0, 0.13), seed=3, moss=0.5, sink=0.06)
    place(k, chunk((0.09, 0.05, 0.07), 4, cuts=[((0, 1, 0), 0.7)], n=14, segs=1), (0.2, 0, 0.11), yaw=1.0, seed=4, moss=0.3, sink=0.02)
    return k.finish(smooth_deg=42), {}


def path_rock_low():
    k = kit("path-rock-low")
    place(k, chunk((0.44, 0.12, 0.35), 5, cuts=[((0, 1, 0), 0.7), ((1, 0.2, 0.3), 0.85)], taper=0.15, n=20, segs=1), (0, 0, 0), yaw=0.5, seed=5, moss=0.25, sink=0.05)
    place(k, chunk((0.31, 0.1, 0.25), 6, cuts=[((0.1, 1, 0), 0.68), ((-1, 0.3, -0.4), 0.82)], taper=0.2, n=20, segs=1), (-0.06, 0.12, 0.04), yaw=0.9,
          tilt=(0.04, -0.05), seed=6, moss=0.65, sink=0.03)
    return k.finish(smooth_deg=42), {}


def path_rock_cluster():
    k = kit("path-rock-cluster")
    place(k, chunk((0.24, 0.2, 0.2), 7, cuts=[((0.2, 1, 0.1), 0.78), ((1, 0.1, -0.3), 0.8), ((-0.6, 0.4, 1), 0.82)], segs=1), (-0.13, 0, 0.02), yaw=0.3,
          tilt=(0.0, -0.08), seed=7, moss=0.6)
    place(k, chunk((0.2, 0.07, 0.15), 8, cuts=[((0, 1, 0.1), 0.65)], taper=0.1, n=18, segs=1), (0.25, 0, -0.08), yaw=1.1, tilt=(0.06, 0.05), seed=8, moss=0.4, sink=0.03)
    place(k, chunk((0.1, 0.07, 0.09), 9, cuts=[((0.3, 1, 0), 0.75)], n=14, segs=1), (0.12, 0, 0.24), yaw=2.0, seed=9, moss=0.35, sink=0.03)
    return k.finish(smooth_deg=42), {}


def moss_boulder_a():
    k = kit("moss-boulder-a")
    place(k, chunk((0.78, 0.16, 0.62), 21, cuts=[((0, 1, 0), 0.7), ((1, 0.2, 0.5), 0.84), ((-0.7, 0.1, -1), 0.86)], taper=0.12), (0, 0, 0),
          yaw=0.2, seed=21, moss=0.35, sink=0.1)
    place(k, chunk((0.64, 0.42, 0.52), 22, cuts=[((0.2, 1, -0.1), 0.84), ((1, 0.3, 0), 0.86), ((-0.3, 0.3, 1), 0.86)], taper=0.25, round_p=2.3, n=34),
          (0.06, 0.16, -0.04), yaw=0.7, tilt=(0.05, 0.06), seed=22, moss=0.7)
    place(k, chunk((0.2, 0.12, 0.16), 23, cuts=[((0, 1, 0), 0.7)]), (0.62, 0, 0.42), yaw=0.4, seed=23, moss=0.4, sink=0.04)
    return k.finish(smooth_deg=42), {}


def moss_boulder_b():
    k = kit("moss-boulder-b")
    place(k, chunk((1.25, 0.2, 0.8), 31, cuts=[((0, 1, 0), 0.72), ((1, 0.15, 0.2), 0.86), ((-1, 0.2, -0.3), 0.88)], taper=0.1, round_p=3.0, n=32), (0, 0, 0),
          yaw=0.1, seed=31, moss=0.4, sink=0.12)
    place(k, chunk((0.85, 0.2, 0.6), 32, cuts=[((0.05, 1, 0), 0.72), ((1, 0.3, -0.2), 0.82), ((-0.4, 0.2, 1), 0.84)], taper=0.12, round_p=3.0, n=30), (-0.25, 0.22, -0.12),
          yaw=0.35, tilt=(0.03, -0.04), seed=32, moss=0.5)
    place(k, chunk((0.52, 0.17, 0.42), 33, cuts=[((0.1, 1, 0.1), 0.74), ((-1, 0.2, 0.3), 0.86)], taper=0.12, round_p=3.0, n=28), (-0.45, 0.5, -0.2), yaw=0.9,
          tilt=(-0.04, 0.05), seed=33, moss=0.6)
    place(k, chunk((0.22, 0.14, 0.18), 34, cuts=[((0, 1, 0), 0.7)]), (1.05, 0, 0.55), yaw=1.3, seed=34, moss=0.4, sink=0.04)
    return k.finish(smooth_deg=42), {}


MODELS = {"path-rock-slab": path_rock_slab, "path-rock-low": path_rock_low, "path-rock-cluster": path_rock_cluster,
          "moss-boulder-a": moss_boulder_a, "moss-boulder-b": moss_boulder_b}


def review(out, spots):
    """The stones on the ground as laid out in `spots` [(name, (x, z, yaw))], from the GLBs."""
    import bpy
    K.reset()
    obs = []
    for nm, (x, z, yaw) in spots:
        bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"{nm}.glb"))
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location = K.G(x, 0, z)
                o.rotation_euler[2] = yaw
                if o.data.color_attributes:
                    o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.context.view_layer.update()
    K.review(obs, out, views=((180, 30), (225, 45)), size=720)


SPOTS = [("moss-boulder-b", (-1.5, -1.2, 0)), ("moss-boulder-a", (1.2, -1.1, 0)), ("path-rock-slab", (-1.4, 0.9, 0)),
         ("path-rock-low", (-0.3, 0.9, 0)), ("path-rock-cluster", (1.0, 0.9, 0))]


if __name__ == "__main__":
    only = [a for a in ARGS if a in MODELS]
    for nm, make in MODELS.items():
        if only and nm not in only:
            continue
        ob, _ = make()
        K.export([ob], f"game/props/{nm}.glb")
        xs = [ob.matrix_world @ Vector(b) for b in ob.bound_box]
        print("STONE", nm, "half", round(max(abs(p.x) for p in xs), 3), round(max(abs(p.y) for p in xs), 3), "top", round(max(p.z for p in xs), 3))
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "stones.png"), SPOTS)
