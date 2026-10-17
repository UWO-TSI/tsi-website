"""The village's broadleaf trees (game/remodel-trees), modelled after the dump's oaks and cherry.

David, 2026-10-17 (specs/art-direction-oct17.md, row 314): "the tree trunk shape needs to be wider and the mapping of
the leaves should be similar, I really like the dump version of the trees, so make it as close to it as you can";
"simpler, slightly smoother, a little cartoony". So the crowns, trunks and card layout follow measurements of the
dump's closed oaks (art/trees/build_trees.py output, measured headlessly, nothing copied):

  - the crown is ACNH's clover closed all round: four round masses ringing the trunk at one height and one on top, each
    a ball of the darker leaf mass with a thick shell of leaf cards round it (cards from 0.9 to 1.5 of the ball's
    radius out, about 710 per square unit of ball radius, so they overlap many deep);
  - a card is the dump's shape: a shield-shaped hexagon (wide top, pointed bottom, 0.45 across), a little bent (its
    top leans out), one leaf clump of the atlas laid over its whole box; it faces out of its ball turned off the
    radial by about 40 degrees (30 to 55), its painted up within 15 degrees of the world's up;
  - the trunk is short and thick with a wide low flare and buttress roots, and splits at the crown's foot into a limb
    for each ball.

Our painted atlases (art/trees/paint_textures.py) dress it: summer, autumn, cherry blossom, and winter's frosted
leaves under a lid of snow on each ball. Normals point out of each ball, blended with the crown's and tipped up (the
dump's own lobe normals), so the crown shades as soft round masses; COLOR_0 only darkens the lower cards a little.

Three shapes: round (the dump's hardwood-a), tall (hardwood-b) and wide (hardwood-b's clover spread wider and lower).
Each has a far model (`.lod1.glb`): fewer flat cards, coarser balls, a coarser trunk, the atlas at half size.

Writes web/public/assets/game/plants/tree-<shape>-<dress>[.lod1].glb, then web/scripts/finish-greenery.mjs; prints the
triangles, the crown's size and the shedding crown (worldFx CANOPIES), and writes the fruit hang points to
web/lib/game/treeHang.ts.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_broadleaf.py [-- round summer lod0 ...]
"""
import json, math, os, random, re, subprocess, sys
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
UP = K.UP

# A ball: centre (Blender x, y, z; -y is the front) and radius, as measured on the dump's closed crowns.
HARDWOOD_A = [((-0.52, -0.07, 1.4), 0.4), ((0.57, -0.17, 1.38), 0.36), ((0.04, 0.1, 2.18), 0.31), ((0.21, 0.47, 1.38), 0.33), ((0.0, -0.45, 1.4), 0.34)]
HARDWOOD_B = [((-0.65, -0.12, 1.75), 0.51), ((0.72, -0.16, 1.81), 0.48), ((0.05, 0.21, 2.75), 0.42), ((0.03, -0.56, 1.75), 0.44), ((0.22, 0.59, 1.81), 0.44)]


def spread(balls, k, top_drop):
    """The clover pushed out from the trunk by k (its ringing balls a little bigger), its top ball lowered by top_drop."""
    top = max(balls, key=lambda b: b[0][2])
    out = []
    for c, r in balls:
        if (c, r) == top:
            out.append(((c[0], c[1], c[2] - top_drop), r * 1.12))
        else:
            out.append(((c[0] * k, c[1] * k, c[2]), r * 1.06))
    return out


# trunk: (fork height, scale of the dump's trunk profile)
# trunk: (fork height, scale of the dump's trunk profile); cards: about how many (the dump's a has 436, b 520)
SHAPES = {
    "round": dict(balls=HARDWOOD_A, fork=1.0, trunk=1.0, cards=436),
    "tall": dict(balls=HARDWOOD_B, fork=1.3, trunk=1.2, cards=500),
    "wide": dict(balls=spread(HARDWOOD_B, 1.32, 0.3), fork=1.22, trunk=1.25, cards=470),
}
# The dump's trunk radius by height (hardwood-a, without its roots): a short flare into a thick, slightly tapering
# bole; the roots are feet round it.
TRUNK = [(-0.05, 0.36), (0.08, 0.31), (0.2, 0.28), (0.45, 0.26), (0.75, 0.25), (1.0, 0.25)]
BARK = "#8e6239"     # plain colour (lane rules: textures only where they show; bark texture is lost at play distance)
DRESS = ["blossom", "summer", "autumn", "winter"]
CARD = {"blossom": 0.39, "summer": 0.45, "autumn": 0.45, "winter": 0.45}   # the dump's card widths (cherry smaller)
# The dump's shield: (x, y) on a card one unit wide, from the top round; and how far each corner leans out along the
# card's normal (its top out, its point back).
SHIELD = [(0.0, 0.344), (0.435, 0.259), (0.5, -0.19), (0.0, -0.487), (-0.5, -0.19), (-0.435, 0.259)]
BEND = [0.07, 0.04, -0.02, -0.09, -0.02, 0.04]
LODS = {
    0: dict(share=0.9, reach=(0.92, 1.56), ball=(8, 5), sides=10, limb_sides=5, roots=4, hull=2, tex=(256, 256), bend=True),
    1: dict(share=0.27, reach=(1.0, 1.46), ball=(6, 4), sides=7, limb_sides=4, roots=0, hull=1, tex=(128, 128), bend=False, grow=1.45),
}
SNOW_LID = 1.34     # a winter ball's snow lid, of its radius (it sits among the cards)


def build(shape, dress, lod):
    K.reset()
    cfg, L = SHAPES[shape], LODS[lod]
    rng = random.Random(f"{shape}-{lod}")
    balls = [(Vector(c), r) for c, r in cfg["balls"]]
    reach = L["reach"][1]
    lo = Vector((min(c.x - r * reach for c, r in balls), min(c.y - r * reach for c, r in balls), min(c.z - r * reach for c, r in balls)))
    hi = Vector((max(c.x + r * reach for c, r in balls), max(c.y + r * reach for c, r in balls), max(c.z + r * reach for c, r in balls)))
    crown_c = (lo + hi) / 2
    crown_r = (hi - lo) / 2

    def nearest(p):
        return min(balls, key=lambda b: (p - b[0]).length / b[1])

    def normal_of(p):
        """The dump's lobe normals: out of the nearest ball (0.5), out of the whole crown (0.15), up (0.5)."""
        c, r = nearest(p)
        q = p - crown_c
        e = Vector((q.x / crown_r.x ** 2, q.y / crown_r.y ** 2, q.z / crown_r.z ** 2))
        return ((p - c).normalized() * 0.5 + (e.normalized() if e.length > 1e-9 else UP) * 0.15 + UP * 0.5).normalized()

    def shade(p, base=1.0):
        """A soft gradient over the whole tree (David, round 2): darker low and inside, lighter on top and at the
        outer edges, warmer where the light falls and cooler in the shade."""
        h = min(1, max(0, (p.z - lo.z) / max(hi.z - lo.z, 1e-3)))
        c, r = nearest(p)
        out = min(1, max(0, ((p - c).length / r - 0.85) / 0.7))
        k = base * (0.78 + 0.2 * h) * (0.86 + 0.18 * out)
        warmth = (k - 0.85) * 0.12
        return (k * (1 + warmth), k, k * (1 - warmth))

    crown = K.Build()
    # the balls: the leaf mass, in shade
    for i, (c, r) in enumerate(balls):
        K.ellipsoid(crown, c, Vector((r, r, r * 0.95)), K.MASS, lambda p: shade(p, 0.78), segs=L["ball"][0], rings=L["ball"][1],
                    wobble=0.08, seed=i, normal_of=normal_of)
    width = CARD[dress] * L.get("grow", 1.0)
    cards = 0
    snowy = dress == "winter"
    density = cfg["cards"] * L["share"] * 1.12 / sum(r * r for _, r in balls)   # 1.12: those hidden in a neighbour
    for i, (c, r) in enumerate(balls):
        n = round(density * r * r)
        for d in K.fib_dirs(n, rng, jitter=0.95):
            p = c + d * r * rng.uniform(*L["reach"])
            # hidden in a neighbour's ball, or under the snow lid: skip
            if any(o is not c and (p - o).length < ro * 1.0 for o, ro in balls):
                continue
            if snowy and d.z > 0.72:
                continue
            # the dump's shingles: pitched up off the radial (median 32 degrees, quartiles 14 and 50) and turned
            # sideways a little (quartiles -25 and 25), so the cards face up and out like tiles
            side = UP.cross(d)
            side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
            tup = d.cross(side).normalized()
            pitch = math.radians(max(-30, min(75, rng.gauss(32, 26))))
            yaw = math.radians(max(-65, min(65, rng.gauss(0, 37))))
            nrm = (d * math.cos(pitch) * math.cos(yaw) + tup * math.sin(pitch) + side * math.cos(pitch) * math.sin(yaw)).normalized()
            upper = snowy and d.z > 0.2
            cell = K.CELLS[8 + rng.randrange(4)] if upper else (K.CELLS[10 + rng.randrange(2)] if dress == "blossom" and rng.random() < 0.04
                                                                else K.CELLS[rng.randrange(10 if dress == "blossom" else (8 if snowy else 12))])
            right, cup = K.card_frame(nrm, UP, rng.uniform(-0.26, 0.26))
            w = width * rng.uniform(0.92, 1.08)
            # the dump's scattered darker leaves, on top as much as anywhere (more of them in autumn)
            jit = rng.uniform(0.94, 1.05) * (rng.uniform(0.66, 0.78) if rng.random() < (0.2 if dress == "autumn" else 0.14) else 1.0)
            flip = rng.random() < 0.5
            ids, cols = [], []
            for (x, y), bend in zip(SHIELD, BEND):
                q = p + right * (x * w) + cup * (y * w) + nrm * ((bend * w) if L["bend"] else 0)
                ids.append(crown.vert(q, normal_of(q)))
                cols.append(tuple(t * jit for t in shade(q)))
            uv = [K.cell_uv(cell, x * 2, (y + 0.487) / 0.831 * 2 - 1, flip) for x, y in SHIELD]
            # wound to face out (the shield runs clockwise seen from the front)
            crown.face([ids[3], ids[2], ids[1], ids[0]], [uv[3], uv[2], uv[1], uv[0]], [cols[3], cols[2], cols[1], cols[0]])
            crown.face([ids[0], ids[5], ids[4], ids[3]], [uv[0], uv[5], uv[4], uv[3]], [cols[0], cols[5], cols[4], cols[3]])
            cards += 1
    if snowy:
        for i, (c, r) in enumerate(balls):
            lid = K.Build()
            K.ellipsoid(lid, c + Vector((0, 0, r * 0.05)), Vector((r, r, r * 0.92)) * SNOW_LID, K.SNOW, lambda p: (1.0,) * 3,
                        segs=L["ball"][0] + 2, rings=L["ball"][1] + 3, wobble=0.12, seed=i + 9, normal_of=lambda p: (normal_of(p) + UP).normalized())
            line = c.z + r * 0.45
            keep, remap = K.Build(), {}
            for f, uv, col in zip(lid.faces, lid.uvs, lid.cols):
                q = sum((lid.verts[k] for k in f), Vector()) / len(f) - c
                a = math.atan2(q.y, q.x)
                if min(lid.verts[k].z for k in f) < line + r * (0.14 * math.sin(a * 3 + i) + 0.07 * math.sin(a * 7 + 2 * i)):
                    continue
                ids = []
                for k in f:
                    if k not in remap:
                        remap[k] = keep.vert(lid.verts[k], lid.normals[k])
                    ids.append(remap[k])
                keep.face(ids, uv, col)
            crown.extend(keep)

    # ---- the trunk: a thick bole with a wide low flare, buttress roots, and a limb up into each ball
    s = cfg["trunk"]
    fork = cfg["fork"]
    wood = K.Build()

    bark = K.lin(BARK)

    def bark_col(p):
        """Plain bark: lit up its bole, in shade under the crown and at its foot, a soft mottle."""
        k = 1.0 - 0.32 * min(1, max(0, (p.z - fork * 0.8) / 0.6))
        k *= 0.84 + 0.16 * min(1, max(0, p.z + 0.05) / 0.25)
        k *= 1 + 0.07 * noise.noise(p * 4.0)
        return tuple(c * k for c in bark)

    zs = [z * fork for z, _ in TRUNK]
    path = [Vector((0.02 * math.sin(z * 2.1), -0.015 * math.sin(z * 1.7), z)) for z in zs]
    radii = [r * s for _, r in TRUNK]
    K.tube(wood, path, radii, L["sides"], bark_col, v_scale=0.7, u_tiles=2.0)
    for k in range(L["roots"]):
        a = k * math.tau / L["roots"] + rng.uniform(-0.25, 0.25) + 0.3
        d = Vector((math.cos(a), math.sin(a), 0))
        rp = [Vector((0, 0, 0.32 * s)) + d * 0.12 * s, Vector((0, 0, 0.1 * s)) + d * 0.3 * s, d * 0.5 * s + Vector((0, 0, -0.04))]
        K.tube(wood, rp, [0.14 * s, 0.1 * s, 0.05 * s], 6, bark_col, v_scale=0.7)
    top = path[-1]
    crown_top = max(balls, key=lambda b: b[0].z)
    for c, r in balls:
        if (c, r) == crown_top:
            continue  # the top ball's limb is never seen inside the crown
        end = c - (c - top).normalized() * r * 0.25
        mid = top + (end - top) * 0.45 + Vector((0, 0, 0.12))
        thick = 0.17 * s
        K.tube(wood, [top - Vector((0, 0, 0.15)), top + (mid - top) * 0.5, mid, end], [thick, thick * 0.85, thick * 0.65, thick * 0.35],
               L["limb_sides"], bark_col, v_scale=0.7)

    # ---- shadow casters: the crown's hull (sways with it) and the trunk (still)
    hull = K.Build()
    for c, r in balls:
        K.icosphere_into(hull, c, r * 1.32, L["hull"])
    stem = K.Build()
    K.tube(stem, path, [r * 0.95 for r in radii], 6, lambda p: (1, 1, 1))

    objs = [crown.object("Crown", K.material("mTreeLeaves", K.image(f"leaves-{dress}", L["tex"]), alpha_clip=True)),
            wood.object("Trunk", K.plain("mTreeTrunk")),
            hull.object("Hull", K.plain("mShadowShake")),
            stem.object("Stem", K.plain("mShadow"))]
    name = f"tree-{shape}-{dress}" + (".lod1" if lod else "")
    out = os.path.join(K.OUT, name + ".glb")
    K.export(objs, out)
    counts = {o.name: K.tris(o) for o in objs}
    print(f"TREE {name}: cards {cards} tris {counts} visible {counts['Crown'] + counts['Trunk']} crown {[round(hi.x - lo.x, 2), round(hi.y - lo.y, 2), round(hi.z, 2)]}")
    canopy = dict(top=round(hi.z, 2), rx=round(max(abs(lo.x), abs(hi.x)), 2), rz=round(max(abs(lo.y), abs(hi.y)), 2))
    return out, (hang_points(balls) if lod == 0 else None), canopy


def hang_points(balls):
    """Where fruit hangs: on the outer face of each ringing ball among its cards, a little below its middle, and on the
    front of the top one; glTF space (x, y up, z toward the front), any two at least 0.4 apart."""
    top = max(balls, key=lambda b: b[0].z)
    pts = []
    for c, r in sorted(balls, key=lambda b: math.atan2(b[0].y, b[0].x)):
        if (c, r) == top:
            continue
        out = Vector((c.x, c.y, 0))
        out = out.normalized() if out.length > 1e-3 else Vector((0, -1, 0))
        pts.append(c + out * r * 1.3 + Vector((0, 0, -0.1)))
    c, r = top
    pts.append(c + Vector((0, -1, 0)) * r * 1.25 + Vector((0, 0, -0.12)))
    out = []
    for p in pts:
        if all((p - q).length >= 0.4 for q in out):
            out.append(p)
    return [[round(p.x, 3), round(p.z, 3), round(-p.y, 3)] for p in out]


def main():
    shapes = [a for a in ARGS if a in SHAPES] or list(SHAPES)
    dresses = [a for a in ARGS if a in DRESS] or DRESS
    lods = [int(a[3:]) for a in ARGS if a.startswith("lod")] or [0, 1]
    hang_file = os.path.join(K.ROOT, "web", "lib", "game", "treeHang.ts")
    hang = {}
    if os.path.exists(hang_file):
        for m in re.finditer(r'^  "([\w-]+)": (\[.*\]),$', open(hang_file).read(), re.M):
            hang[m.group(1)] = json.loads(m.group(2))
    written, canopies = [], {}
    for shape in shapes:
        for dress in dresses:
            for lod in lods:
                path, h, canopy = build(shape, dress, lod)
                written.append(path)
                if h:
                    hang[f"tree-{shape}-{dress}"] = h
                    canopies[shape] = canopy
    for k, v in canopies.items():
        print(f"CANOPY {k} {json.dumps(v)}")
    with open(hang_file, "w") as f:
        f.write("/** Written by art/trees/build_trees.py and build_broadleaf.py: where fruit hangs in each crown (glTF space, the model's own frame). */\n")
        f.write("export const TREE_HANG: Record<string, readonly (readonly [number, number, number])[]> = {\n")
        f.write("".join(f'  "{k}": {json.dumps(v)},\n' for k, v in sorted(hang.items())) + "};\n")
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)


main()
