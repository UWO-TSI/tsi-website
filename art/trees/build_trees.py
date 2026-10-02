"""The village trees with full, closed crowns (specs/polish/world-refinement.md §2, row 284).

ACNH authors its oak and cherry crowns for a camera that never turns: three round lobes (two low, one on top) built
as a shell of leaf cards facing the front, a flat backing plane behind them, and nothing at the back. The orbit camera
sees every side. ACNH's clover is three spheres seen from the front, so each lobe is closed here into the sphere it
implies: the lobe's authored cards are its front half, and its back half is the same cards turned about the lobe's
own upright axis (a little off the half turn, each card rolled about its own normal and resized a little, so no side
is a copy of another). From the front and back the crown keeps ACNH's silhouette; from the sides it is the lobes one
behind the other, as deep as a lobe is wide. A closed core of the backing leaves sits just inside the cards, so the
gaps between cut-out cards show leaves from any side. Normals point out of each lobe, blended with the whole crown's,
so the canopy shades as soft round masses (matte, no per-card glints).

The trunk is ACNH's. The shadow casters are rebuilt to match: a closed low-poly hull round the lobes that sways with
the leaves (mShadowShake) and a low-poly trunk (mShadow); the visible cards never cast (lib/game/shadows.ts).

The snow cedar lost its back and top tier in ACNH's own export (the fill layer exists only in the plain cedar's
source); it is closed the same way, turned about the trunk. The plain cedar is already closed and ships as it was.

Sources: art/trees/source/*.glb, the ACNH extracts as shipped before this pass (scripts/extract-acnh-kit.mjs).
Writes web/public/assets/acnh/plants/<name>.glb (world scale, no node transforms: InstancedNature reads the geometry
as is), then web/scripts/finish-trees.mjs gives the leaf cards their cut-out masks from the dump's _OP textures.
Prints each tree's triangle counts and writes its fruit hang points (glTF space, the model's own frame) to
web/lib/game/treeHang.ts.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_trees.py [-- tree-blossom ...]
"""
import bpy, bmesh, json, math, os, random, re, subprocess, sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "source")
OUT = os.path.join(ROOT, "web", "public", "assets", "acnh", "plants")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

SHELL = re.compile(r"^m(TreeOakLeaf|TreeOakSakuraBloom|TreeOakLeafSnow|TreeOakLeafSphSnow|PltTreeCedarLeafSnow)$")
BACKING = re.compile(r"^m(TreeOakLeafBack|TreeOakSakuraBack)$")
CASTER = re.compile(r"^mShadow(Shake)?$")

# ACNH's fruit joints (Plant01, Plant02, PlantTop) from PltTreeOak{3,4}Node.dae at the extract's 0.1 scale, glTF
# space (x, y up, z toward the front).
OAK3 = [(0.525, 1.405, 0.0), (-0.513, 1.405, 0.0), (0.0, 2.029, 0.0)]
OAK4 = [(0.65, 1.85, 0.2), (-0.65, 1.85, 0.2), (0.0, 2.7, -0.5)]

# lobes: the clover's three; turn: degrees off the half turn for the back halves; ring: the low lobes turned a quarter
# about the trunk at this spread; core: each lobe's backing ball as a fraction of how far its nearest cards sit;
# grow: each card's size. cap: the dump
# file whose winter snow layer is the crown's top and back.
TREES = {
    "tree-hardwood-a": dict(joints=OAK3, lobes=3, turn=9, core=1.0, ring=0.85, grow=1.18),
    "tree-hardwood-b": dict(joints=OAK4, lobes=3, turn=-8, core=1.0, ring=0.85, grow=1.18),
    "tree-blossom": dict(joints=OAK4, lobes=3, turn=10, core=0.95, ring=0.85),
    "tree-hardwood-snow": dict(joints=OAK4, lobes=3, turn=-7, core=0.95, ring=0.85, grow=1.1),
    "tree-cedar-snow": dict(cap="PltTreeCedarSnow.Nin_NX_NVN/PltTreeCedar4Snow.dae"),
}


# ── Blender plumbing ─────────────────────────────────────────────────────
def gltf_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def blender_to_gltf(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


def material_of(ob):
    return ob.data.materials[0].name if ob.data.materials and ob.data.materials[0] else ""


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def join(objs, name):
    """One object (one draw per material in the game) from several."""
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    return ob


def bake(ob):
    """Apply the object's transform and any modifiers into its mesh."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(ob.matrix_world)
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    ob.data = me
    ob.matrix_world = Matrix.Identity(4)
    return ob


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def cards(bm):
    """The leaf cards: connected groups of faces."""
    seen, out = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        stack, comp = [f], []
        seen.add(f)
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        stack.append(h)
        out.append(comp)
    return out


def card_frame(comp):
    verts = {v for f in comp for v in f.verts}
    c = sum((v.co for v in verts), Vector()) / len(verts)
    n = sum((f.normal * f.calc_area() for f in comp), Vector())
    return verts, c, (n.normalized() if n.length > 1e-9 else Vector((0, -1, 0)))


def card_centres(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    out = [card_frame(comp)[1] for comp in cards(bm)]
    bm.free()
    return out


# ── The crown ────────────────────────────────────────────────────────────
class Lobe:
    """A round mass of the crown: its centre (where the sphere its front cards sit on is centred) and radius."""

    def __init__(self, centre, radius):
        self.centre, self.radius = centre, radius

    def half_turn(self, turn_deg):
        """The back half's transform: a half turn (and `turn_deg`) about the lobe's upright axis."""
        c = self.centre
        return Matrix.Translation((c.x, c.y, 0)) @ Matrix.Rotation(math.pi + math.radians(turn_deg), 4, "Z") @ Matrix.Translation((-c.x, -c.y, 0))


def find_lobes(centres, k):
    """Cluster the front's cards into ACNH's lobes across the front view (k-means from the low left, the low right and
    the top), then sit each lobe's sphere so its front is the front-most card: centre one radius behind it."""
    seeds = [min(centres, key=lambda c: c.x + c.z * 0.3), max(centres, key=lambda c: c.x - c.z * 0.3), max(centres, key=lambda c: c.z)]
    mids = [s.copy() for s in seeds[:k]]
    for _ in range(16):
        groups = [[] for _ in mids]
        for c in centres:
            groups[min(range(k), key=lambda i: (c.x - mids[i].x) ** 2 + (c.z - mids[i].z) ** 2)].append(c)
        mids = [sum(g, Vector()) / len(g) if g else mids[i] for i, g in enumerate(groups)]
    out = []
    for m, g in zip(mids, groups):
        r = 0.85 * max(math.hypot(p.x - m.x, p.z - m.z) for p in g)
        front = min(p.y for p in g)
        out.append(Lobe(Vector((m.x, front + r * 0.9, m.z)), r))
    return out


def nearest(lobes, p):
    return min(lobes, key=lambda L: math.hypot(p.x - L.centre.x, p.z - L.centre.z) / L.radius)


def grow_cards(ob, k):
    """Each card a little larger about its own centre: cut out to leaf shapes, ACNH's cards leave more sky between
    them than its solid ones did, and the crown should read as dense as before."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for comp in cards(bm):
        verts, c, _ = card_frame(comp)
        for v in verts:
            v.co = c + (v.co - c) * k
    bm.to_mesh(ob.data)
    bm.free()


def close_lobes(ob, lobes, turn_deg, seed):
    """The back halves: every card turned about its own lobe's axis, rolled about its normal and resized a little."""
    rng = random.Random(seed)
    back = link(ob.copy())
    back.data = ob.data.copy()
    bm = bmesh.new()
    bm.from_mesh(back.data)
    for comp in cards(bm):
        verts, c, n = card_frame(comp)
        roll = Matrix.Rotation(rng.uniform(-0.45, 0.45), 4, n)
        jitter = Matrix.Translation(c) @ roll @ Matrix.Scale(rng.uniform(0.9, 1.1), 4) @ Matrix.Translation(-c)
        m = nearest(lobes, c).half_turn(turn_deg) @ jitter
        for v in verts:
            v.co = m @ v.co
    bm.normal_update()
    bm.to_mesh(back.data)
    bm.free()
    return join([ob, back], ob.name)


def ring_lobes(ob, lobes, scale, seed):
    """A round crown: the two low lobes (front and back halves) turned a quarter about the trunk and drawn in a
    little, so the low lobes ring the trunk and the top lobe crowns them; ACNH's clover from every side."""
    rng = random.Random(seed)
    low = sorted(lobes, key=lambda L: L.centre.z)[:2]
    extra = link(ob.copy())
    extra.data = ob.data.copy()
    bm = bmesh.new()
    bm.from_mesh(extra.data)
    turn = Matrix.Rotation(math.pi / 2 + rng.uniform(-0.15, 0.15), 4, "Z")
    drop = []
    for comp in cards(bm):
        verts, c, n = card_frame(comp)
        if nearest(lobes, c) not in low:
            drop += comp
            continue
        roll = Matrix.Rotation(rng.uniform(-0.45, 0.45), 4, n)
        m = turn @ Matrix.Diagonal((scale, scale, 1, 1)) @ Matrix.Translation(c) @ roll @ Matrix.Translation(-c)
        for v in verts:
            v.co = m @ v.co
    bmesh.ops.delete(bm, geom=list(set(drop)), context="FACES")
    bm.normal_update()
    bm.to_mesh(extra.data)
    bm.free()
    m = turn @ Matrix.Diagonal((scale, scale, 1, 1))
    return join([ob, extra], ob.name), [Lobe(m @ L.centre, L.radius) for L in low], m


def lobe_reach(lobes, centres):
    """How far each lobe's cards sit from its centre: the near quarter (where its core can reach without poking
    through) and the median (its hull)."""
    reach = [[] for _ in lobes]
    for c in centres:
        i = min(range(len(lobes)), key=lambda k: (c - lobes[k].centre).length / lobes[k].radius)
        reach[i].append((c - lobes[i].centre).length)
    pick = lambda d, q, L: sorted(d)[int(q * (len(d) - 1))] if d else L.radius
    return [pick(d, 0.25, L) for d, L in zip(reach, lobes)], [pick(d, 0.5, L) for d, L in zip(reach, lobes)]


def spheres(balls, subdivisions, name):
    """One mesh of low-poly balls (centre, radius)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    for c, r in balls:
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=r, matrix=Matrix.Translation(c))
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def wrap_uv(ob, centre, tiles=3.0):
    """The backing texture wrapped round the core (it's mottled leaves; any even mapping reads)."""
    me = ob.data
    uv = me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        p = me.vertices[loop.vertex_index].co - centre
        uv.data[loop.index].uv = (0.5 + math.atan2(p.y, p.x) / math.tau * tiles, p.z * tiles * 0.45)


def lobe_normals(ob, lobes, centre, radii, lobe=0.5, crown=0.15, up=0.5):
    """Each vertex's normal points out of its lobe (the nearest, in lobe radii), blended with the whole crown's and
    tipped up toward the sky: every lobe reads as a soft round mass, and the shade side stays leaves, not a hole."""
    me = ob.data
    me.shade_smooth()
    ns = []
    for v in me.vertices:
        L = min(lobes, key=lambda L: (v.co - L.centre).length / L.radius)
        p = v.co - centre
        n = (v.co - L.centre).normalized() * lobe + Vector((p.x / radii.x ** 2, p.y / radii.y ** 2, p.z / radii.z ** 2)).normalized() * crown + Vector((0, 0, up))
        ns.append(n.normalized() if n.length > 1e-9 else Vector((0, 0, 1)))
    me.normals_split_custom_set_from_vertices(ns)


def bounds(objs):
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        for v in o.data.vertices:
            lo = Vector(map(min, lo, v.co))
            hi = Vector(map(max, hi, v.co))
    return lo, hi


def hang_points(crown, joints, lobes, turn_deg, ring):
    """Where fruit hangs: ACNH's joints carried out to the crown's surface along the view from the front, nestled a
    little into the leaves and hanging a little below, then the same spot on the back half of the joint's lobe, and on
    the ringed low lobes; any two closer than 0.4 kept once."""
    bvh = BVHTree.FromObject(crown, bpy.context.evaluated_depsgraph_get())
    front = []
    for j in joints:
        p = gltf_to_blender(j)
        hit = bvh.ray_cast(Vector((p.x, -4, p.z)), Vector((0, 1, 0)))
        front.append((hit[0] if hit[0] is not None else p) + Vector((0, 0.07, -0.06)))
    lobes = lobes[:3]
    pts = front + [nearest(lobes, p).half_turn(turn_deg) @ p for p in front]
    if ring:
        low = sorted(lobes, key=lambda L: L.centre.z)[:2]
        pts += [ring @ p for p in pts if nearest(lobes, p) in low]
    out = []
    for p in pts:
        if all((p - q).length >= 0.4 for q in out):
            out.append(p)
    return [blender_to_gltf(p) for p in out]


def snow_cap(dae):
    """ACNH's winter cedar draws its top tier and the snow on its back as one layer, mWinterSnow, in its own snow
    shader; the extract drops that material everywhere (on buildings it is a permanent snow lid), so the snow cedar
    shipped without its top and back. Its mesh comes straight from the dump (assimp, as the extract reads it) and
    gets a matte snow material of its own."""
    tmp = os.path.join(bpy.app.tempdir, "cedar_cap.obj")
    subprocess.run(["assimp", "export", os.path.basename(dae), tmp], cwd=os.path.dirname(dae), check=True, capture_output=True)
    before = set(bpy.context.scene.objects)
    bpy.ops.wm.obj_import(filepath=tmp, forward_axis="NEGATIVE_Z", up_axis="Y", use_split_groups=True)
    new = [o for o in bpy.context.scene.objects if o not in before]
    cap = next(o for o in new if "WinterSnow" in o.name)
    for o in new:
        if o is not cap:
            bpy.data.objects.remove(o)
    cap.scale = (0.1, 0.1, 0.1)
    bake(cap)
    cap.data.materials.clear()
    snow = bpy.data.materials.new("mCedarSnowCap")
    bsdf = next(n for n in snow.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.8, 0.86, 0.9, 1)
    bsdf.inputs["Roughness"].default_value = 1
    cap.data.materials.append(snow)
    cap.data.shade_smooth()
    cap.name = cap.data.name = "SnowDown__mCedarSnowCap"
    return cap


def build(name, cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + ".glb"))
    if cfg.get("cap"):
        objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        for o in objs:
            bake(o)
        before = {material_of(o): tris(o) for o in objs}
        cap = snow_cap(os.path.join(os.path.expanduser("~/Downloads/Assets/Model"), cfg["cap"]))
        for o in objs + [cap]:
            for attr in list(o.data.color_attributes):
                o.data.color_attributes.remove(attr)
        lo, hi = bounds(objs + [cap])
        export(name)
        return dict(before=before, after={o.name: tris(o) for o in objs + [cap]}, hang=None, size=[round(x, 2) for x in (hi - lo)], lobes=[])
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in objs:
        bake(o)
    before = {material_of(o): tris(o) for o in objs}
    shells = [o for o in objs if SHELL.match(material_of(o))]
    backing = [o for o in objs if BACKING.match(material_of(o))]
    casters = [o for o in objs if CASTER.match(material_of(o))]
    caster_mat = {material_of(o): o.data.materials[0] for o in casters}
    trunk = [o for o in objs if "Trunk" in material_of(o)]

    lobes = find_lobes(card_centres(shells[0]), cfg["lobes"])
    for s in shells:
        grow_cards(s, cfg.get("grow", 1))
    crowns = [close_lobes(s, lobes, cfg["turn"], seed=len(name) * 31 + i) for i, s in enumerate(shells)]
    if cfg.get("ring"):
        rung = [ring_lobes(c, lobes, cfg["ring"], seed=len(name) * 17 + i) for i, c in enumerate(crowns)]
        crowns = [c for c, _, _ in rung]
        ring = rung[0][2]
        lobes = lobes + rung[0][1]
    else:
        ring = None
    for i, c in enumerate(crowns):
        c.name = c.data.name = f"Crown{i}__{material_of(c)}"
    lo, hi = bounds(crowns)
    centre = Vector((0, 0, (lo.z + hi.z) / 2))
    radii = Vector(((hi.x - lo.x) / 2, max(-lo.y, hi.y), (hi.z - lo.z) / 2))
    parts = list(crowns)

    if cfg["core"]:
        centres = [p for c in crowns for p in card_centres(c)]
        inner_r, outer_r = lobe_reach(lobes, centres)
        # The backing: a ball of the backing leaves inside each lobe, under its cards (ACNH's flat backing plane,
        # closed), so a gap between cut-out cards shows leaves in shade, never the sky.
        core = spheres([(L.centre, r * cfg["core"]) for L, r in zip(lobes, inner_r)], 2, "Core")
        # Its own material (finish-trees darkens it: the leaves inside the crown are in shade).
        inner = (backing[0] if backing else crowns[-1]).data.materials[0].copy()
        inner.name = (backing[0] if backing else crowns[-1]).data.materials[0].name + "Core"
        core.data.materials.append(inner)
        wrap_uv(core, centre)
        core.name = core.data.name = f"Core__{material_of(core)}"
        # The canopy's shadow: a closed hull round the cards that sways with them; the trunk's, low-poly and still.
        hull = spheres([(L.centre, r) for L, r in zip(lobes, outer_r)], 2, "Hull")
        hull.data.materials.append(caster_mat["mShadowShake"])
        hull.name = hull.data.name = "Hull__mShadowShake"
        stem = link(trunk[0].copy())
        stem.data = trunk[0].data.copy()
        stem.modifiers.new("dec", "DECIMATE").ratio = 0.16
        bake(stem)
        stem.data.materials.clear()
        stem.data.materials.append(caster_mat["mShadow"])
        stem.name = stem.data.name = "Stem__mShadow"
        parts += [core, hull, stem]
        for o in backing + casters:
            bpy.data.objects.remove(o)
    for o in parts:
        if cfg["lobes"] and ("Crown" in o.name or "Core" in o.name):
            lobe_normals(o, lobes, centre, radii)
    parts += trunk
    for o in parts:
        for attr in list(o.data.color_attributes):
            o.data.color_attributes.remove(attr)

    hang = hang_points(crowns[0], cfg["joints"], lobes, cfg["turn"], ring) if cfg["joints"] else None
    export(name)
    after = {o.name: tris(o) for o in bpy.context.scene.objects if o.type == "MESH"}
    return dict(before=before, after=after, hang=hang, size=[round(x, 2) for x in (hi - lo)],
                lobes=[(blender_to_gltf(L.centre), round(L.radius, 2)) for L in lobes])


def export(name):
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", export_yup=True,
                              export_apply=True, export_normals=True, export_texcoords=True, export_materials="EXPORT",
                              export_vertex_color="NONE", export_animations=False, export_skins=False,
                              export_morph=False, export_cameras=False, export_lights=False)


def main():
    names = [a for a in ARGS if a in TREES] or list(TREES)
    hang_file = os.path.join(ROOT, "web", "lib", "game", "treeHang.ts")
    hang = {}
    if os.path.exists(hang_file):
        for m in re.finditer(r'^  "([\w-]+)": (\[.*\]),$', open(hang_file).read(), re.M):
            hang[m.group(1)] = json.loads(m.group(2))
    for name in names:
        r = build(name, TREES[name])
        print(f"TREE {name}: {sum(r['before'].values())} -> {sum(r['after'].values())} tris {r['after']} crown {r['size']} lobes {r['lobes']}")
        if r["hang"]:
            hang[name] = r["hang"]
            print(f"HANG {name} {json.dumps(r['hang'])}")
    with open(hang_file, "w") as f:
        f.write("/** Written by art/trees/build_trees.py: where fruit hangs in each remodeled crown (glTF space, the model's own frame). */\n")
        f.write("export const TREE_HANG: Record<string, readonly (readonly [number, number, number])[]> = {\n")
        f.write("".join(f'  "{k}": {json.dumps(v)},\n' for k, v in sorted(hang.items())) + "};\n")
    subprocess.run(["node", "scripts/finish-trees.mjs", *[os.path.join(OUT, n + ".glb") for n in names]], cwd=os.path.join(ROOT, "web"), check=True)


main()
