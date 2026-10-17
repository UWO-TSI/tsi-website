"""The village's broadleaf trees (game/remodel-trees), replacing the ACNH oaks and cherries in the member world.

One trunk (root flare, a few roots into the ground, a fork) and branches up into clumped crowns. Each clump is a
closed volume of the season's painted leaves (art/trees/paint_textures.py), darker, inside a shell of leaf cards all
round it: each card faces out of its clump, a little folded so it never thins to a line edge on, its painted light
from above (the card's up is the world's up), and none hidden inside a neighbouring clump. Normals point out of the
clump, blended with the whole crown's and tipped up, so each clump shades as one soft round mass and the crown as a
cluster of them. The same shape wears four seasons: blossom (spring: cherry pink with fresh leaves), summer, autumn
and winter (cold dark leaves, snow lids on the clumps and snow on the upper cards).

Three shapes: a round crown of five clumps, a tall oval of seven and a wide spreading one of seven. Each has a far
model (`.lod1.glb`): fewer, larger flat cards, a coarser volume, a five-sided trunk, the atlas at half size.

Writes web/public/assets/game/plants/tree-<shape>-<season>[.lod1].glb, then web/scripts/finish-greenery.mjs sets the
materials (leaves cut out at 0.5, both sides; bark opaque), turns the textures to WebP and checks the files. Prints
triangles and the crown's size, and writes the fruit hang points to web/lib/game/treeHang.ts (the shape's, every
season the same).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_broadleaf.py [-- round summer ...]
"""
import json, math, os, random, re, subprocess, sys
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# A clump: centre (Blender x, y, z) and radius. The fork: where the trunk ends and the branches start.
SHAPES = {
    "round": dict(
        fork=(0.0, 0.0, 1.25), lean=(0.03, -0.02),
        clumps=[((0.0, 0.02, 2.36), 0.74),
                ((0.6, -0.22, 1.86), 0.58), ((-0.2, -0.6, 1.8), 0.56), ((-0.62, 0.2, 1.9), 0.58), ((0.22, 0.6, 1.84), 0.56)]),
    "tall": dict(
        fork=(0.0, 0.0, 1.35), lean=(-0.03, 0.02),
        clumps=[((0.0, 0.0, 1.78), 0.58), ((0.12, -0.1, 2.36), 0.58), ((-0.08, 0.1, 2.9), 0.5),
                ((0.44, 0.18, 2.02), 0.47), ((-0.44, -0.16, 2.12), 0.48), ((0.06, 0.46, 2.3), 0.44), ((-0.08, -0.46, 2.48), 0.44)]),
    "wide": dict(
        fork=(0.0, 0.0, 1.08), lean=(0.04, 0.03),
        clumps=[((0.0, 0.0, 2.24), 0.7),
                ((0.98, 0.0, 1.8), 0.56), ((0.48, -0.86, 1.92), 0.54), ((-0.5, -0.84, 1.78), 0.56),
                ((-0.98, 0.04, 1.9), 0.54), ((-0.46, 0.86, 1.8), 0.56), ((0.52, 0.84, 1.94), 0.54)]),
}
SEASONS = ["blossom", "summer", "autumn", "winter"]
# near / far: cards per square unit of clump radius, card size (x radius), fold, volume segments, trunk sides
LODS = {
    0: dict(density=150, size=1.0, fold=0.38, segs=10, rings=6, sides=8, branch_sides=6, roots=True, tex=None),
    1: dict(density=64, size=1.3, fold=0.0, segs=7, rings=4, sides=5, branch_sides=4, roots=False, tex=(256, 256)),
}
CORE = 0.8          # the volume's radius, of its clump's
CORE_SHADE = 0.6    # the volume in shade
SNOW_SHADE = 1.0


def season_tint(season):
    """COLOR_0's tint per season (the textures carry the colour; this only warms or cools them a touch)."""
    return {"blossom": (1.0, 1.0, 1.0), "summer": (1.0, 1.0, 0.97), "autumn": (1.02, 1.0, 0.96), "winter": (0.96, 0.98, 1.02)}[season]


def build(shape, season, lod):
    K.reset()
    cfg, L = SHAPES[shape], LODS[lod]
    rng = random.Random(f"{shape}-{lod}")
    clumps = [(Vector(c), r) for c, r in cfg["clumps"]]
    lo = Vector((min(c.x - r for c, r in clumps), min(c.y - r for c, r in clumps), min(c.z - r for c, r in clumps)))
    hi = Vector((max(c.x + r for c, r in clumps), max(c.y + r for c, r in clumps), max(c.z + r for c, r in clumps)))
    crown_c = (lo + hi) / 2
    crown_r = Vector(((hi.x - lo.x) / 2, (hi.y - lo.y) / 2, (hi.z - lo.z) / 2))
    tint = season_tint(season)

    def nearest(p):
        return min(clumps, key=lambda cr: (p - cr[0]).length / cr[1])

    def normal_of(p):
        c, r = nearest(p)
        q = p - crown_c
        e = Vector((q.x / crown_r.x ** 2, q.y / crown_r.y ** 2, q.z / crown_r.z ** 2))
        n = (p - c).normalized() * 0.55 + (e.normalized() if e.length > 1e-9 else K.UP) * 0.25 + K.UP * 0.35
        return n.normalized()

    def shade(p, base=1.0):
        h = (p.z - lo.z) / max(hi.z - lo.z, 1e-3)
        q = p - crown_c
        out = math.sqrt((q.x / crown_r.x) ** 2 + (q.y / crown_r.y) ** 2 + (q.z / crown_r.z) ** 2)
        k = base * (0.74 + 0.3 * h) * (0.8 + 0.22 * min(1, max(0, (out - 0.35) / 0.6)))
        return tuple(min(1.2, t * k) for t in tint)

    # ---- the crown: volumes, cards, snow lids
    crown = K.Build()
    for i, (c, r) in enumerate(clumps):
        K.ellipsoid(crown, c, Vector((r, r, r * 0.92)) * CORE, K.MASS, lambda p: shade(p, CORE_SHADE), segs=L["segs"], rings=L["rings"],
                    wobble=0.12, seed=i, normal_of=normal_of)
    cards = 0
    for i, (c, r) in enumerate(clumps):
        n = max(8, round(L["density"] * r * r))
        # each clump a touch lighter or darker than the next, so the clumps read apart
        ck = rng.uniform(0.93, 1.06)
        for d in K.fib_dirs(n, rng):
            centre = c + d * r * rng.uniform(0.84, 1.0)
            # hidden inside a neighbour: skip
            if any(o is not c and (centre - o).length < ro * 0.86 for o, ro in clumps):
                continue
            tilt = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.2
            nrm = (d + tilt + K.UP * 0.12).normalized()
            if season == "winter" and nrm.z > 0.62:
                continue  # under the snow lid
            snowy = season == "winter" and nrm.z > 0.25
            # winter's cells 8-11 carry snow on their upper lobes, for the upper cards
            if snowy:
                cell = K.CELLS[8 + rng.randrange(4)]
            elif season == "blossom":
                # the cherry's cells 10 and 11 are fresh leaves: a few show between the flowers
                cell = K.CELLS[10 + rng.randrange(2) if rng.random() < 0.08 else rng.randrange(10)]
            else:
                cell = K.CELLS[rng.randrange(8 if season == "winter" else 12)]
            jit = rng.uniform(0.92, 1.07) * ck
            col = tuple(t * jit for t in shade(centre))
            size = r * L["size"] * rng.uniform(0.88, 1.1)
            K.add_card(crown, centre, nrm, size, cell, col, roll=rng.uniform(-0.15, 0.15) if snowy else rng.uniform(-0.38, 0.38), fold=L["fold"],
                       flip=(not snowy) and rng.random() < 0.5, normal_of=normal_of)
            cards += 1
    if season == "winter":
        for i, (c, r) in enumerate(clumps):
            lid = K.Build()
            K.ellipsoid(lid, c + Vector((0, 0, r * 0.02)), Vector((r * 1.04, r * 1.04, r * 0.98)), K.SNOW, lambda p: (SNOW_SHADE,) * 3,
                        segs=L["segs"] + 2, rings=L["rings"] + 3, wobble=0.16, seed=i + 9, normal_of=lambda p: (normal_of(p) + K.UP).normalized())
            # keep only the top: faces whose every corner sits above the lid line
            line = c.z + r * 0.42
            keep = K.Build()
            remap = {}
            for f, uv, col in zip(lid.faces, lid.uvs, lid.cols):
                # a wavy rim: the line rises and falls round the clump
                q = sum((lid.verts[k] for k in f), Vector()) / len(f) - c
                wave = r * 0.12 * math.sin(math.atan2(q.y, q.x) * 3 + i) + r * 0.06 * math.sin(math.atan2(q.y, q.x) * 7 + 2 * i)
                if min(lid.verts[k].z for k in f) < line + wave:
                    continue
                ids = []
                for k in f:
                    if k not in remap:
                        remap[k] = keep.vert(lid.verts[k], lid.normals[k])
                    ids.append(remap[k])
                keep.face(ids, uv, col)
            crown.extend(keep)

    # ---- trunk, roots and branches
    wood = K.Build()
    fork = Vector(cfg["fork"])
    lx, ly = cfg["lean"]
    trunk = [Vector((0, 0, 0)), Vector((lx * 0.2, ly * 0.2, 0.18)), Vector((lx * 0.6, ly * 0.6, 0.6)), Vector((lx, ly, fork.z * 0.82)), fork]
    trunk_r = [0.27, 0.2, 0.17, 0.15, 0.13]

    def bark_col(p):
        k = 1.0 - 0.38 * min(1, max(0, (p.z - fork.z * 0.75) / 0.8))
        k *= 0.82 + 0.18 * min(1, p.z / 0.25)
        return (k, k, k)

    K.tube(wood, [p - Vector((0, 0, 0.04)) if i == 0 else p for i, p in enumerate(trunk)], trunk_r, L["sides"], bark_col, v_scale=0.7)
    if L["roots"]:
        for k in range(4):
            a = k * math.tau / 4 + rng.uniform(-0.3, 0.3) + 0.4
            d = Vector((math.cos(a), math.sin(a), 0))
            path = [Vector((0, 0, 0.26)) + d * 0.1, Vector((0, 0, 0.08)) + d * 0.24, d * 0.38 + Vector((0, 0, -0.04))]
            K.tube(wood, path, [0.1, 0.075, 0.035], 6, bark_col, v_scale=0.7)
    for c, r in clumps:
        end = fork + (c - fork) * 0.72
        mid = fork + (end - fork) * 0.5 + Vector((0, 0, 0.12))
        q = fork + (end - fork) * 0.12
        K.tube(wood, [fork - (c - fork).normalized() * 0.04, q, mid, end], [0.1, 0.088, 0.062, 0.036], L["branch_sides"], bark_col, v_scale=0.7)

    # ---- shadow casters: the crown's hull (sways) and the trunk (still)
    hull = K.Build()
    for c, r in clumps:
        K.icosphere_into(hull, c, r * 0.9, 2 if lod == 0 else 1)
    stem = K.Build()
    K.tube(stem, trunk, [r * 0.9 for r in trunk_r], 5, lambda p: (1, 1, 1))

    leaf_img = K.image(f"leaves-{season}", L["tex"])
    bark_img = K.image("bark", (64, 128) if lod else None)
    objs = [crown.object("Crown", K.material("mTreeLeaves", leaf_img, alpha_clip=True)),
            wood.object("Trunk", K.material("mTreeTrunk", bark_img)),
            hull.object("Hull", K.plain("mShadowShake")),
            stem.object("Stem", K.plain("mShadow"))]
    name = f"tree-{shape}-{season}" + (".lod1" if lod else "")
    path = os.path.join(K.OUT, name + ".glb")
    K.export(objs, path)
    counts = {o.name: K.tris(o) for o in objs}
    size = [round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z, 2)]
    print(f"TREE {name}: cards {cards} tris {counts} visible {counts['Crown'] + counts['Trunk']} crown {size}")
    hang = hang_points(clumps) if lod == 0 else None
    canopy = dict(top=round(hi.z, 2), rx=round(max(abs(lo.x), abs(hi.x)), 2), rz=round(max(abs(lo.y), abs(hi.y)), 2))
    return path, hang, canopy


def hang_points(clumps):
    """Where fruit hangs: on the outer face of each low clump, a little below its middle, and on the front of the top
    one; glTF space (x, y up, z toward the front), any two at least 0.4 apart."""
    top = max(clumps, key=lambda cr: cr[0].z)
    pts = []
    for c, r in sorted(clumps, key=lambda cr: math.atan2(cr[0].y, cr[0].x)):
        if (c, r) == top:
            continue
        out = Vector((c.x, c.y, 0))
        out = out.normalized() if out.length > 1e-3 else Vector((0, -1, 0))
        pts.append(c + out * r * 0.92 + Vector((0, 0, -0.18 * r)))
    c, r = top
    pts.append(c + Vector((0, -1, 0)) * r * 0.9 + Vector((0, 0, -0.2 * r)))
    out = []
    for p in pts:
        if all((p - q).length >= 0.4 for q in out):
            out.append(p)
    return [[round(p.x, 3), round(p.z, 3), round(-p.y, 3)] for p in out]


def main():
    shapes = [a for a in ARGS if a in SHAPES] or list(SHAPES)
    seasons = [a for a in ARGS if a in SEASONS] or SEASONS
    lods = [int(a[3:]) for a in ARGS if a.startswith("lod")] or [0, 1]
    hang_file = os.path.join(K.ROOT, "web", "lib", "game", "treeHang.ts")
    hang = {}
    if os.path.exists(hang_file):
        for m in re.finditer(r'^  "([\w-]+)": (\[.*\]),$', open(hang_file).read(), re.M):
            hang[m.group(1)] = json.loads(m.group(2))
    written, canopies = [], {}
    for shape in shapes:
        for season in seasons:
            for lod in lods:
                path, h, canopy = build(shape, season, lod)
                written.append(path)
                if h:
                    hang[f"tree-{shape}-{season}"] = h
                    canopies[f"tree-{shape}-{season}"] = canopy
    for k, v in canopies.items():
        print(f"CANOPY {k} {json.dumps(v)}")
    with open(hang_file, "w") as f:
        f.write("/** Written by art/trees/build_trees.py and build_broadleaf.py: where fruit hangs in each crown (glTF space, the model's own frame). */\n")
        f.write("export const TREE_HANG: Record<string, readonly (readonly [number, number, number])[]> = {\n")
        f.write("".join(f'  "{k}": {json.dumps(v)},\n' for k, v in sorted(hang.items())) + "};\n")
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)


main()
