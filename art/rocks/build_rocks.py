"""Chunky faceted rock props (specs/v1-drop.md §8c item 4, ref references/look/2026-10-13/water-clarity-palette-ref.png):
the island's own boulders for coasts, cliff edges and accents. Built here from seeded points, nothing downloaded or
copied: each rock is the convex hull of a jittered rounded box, its near-coplanar facets merged into broad flat planes,
every edge chamfered so the edges catch the sun, and a flat colour per facet in vertex colours (a light top, cool grey
sides, a darker underside and foot, a lighter chamfer). Matte: roughness 1, no texture, one material, so each model is
one primitive and one draw per instanced batch.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/rocks/build_rocks.py

Writes web/public/assets/game/rocks/<name>.glb. Frame: game units (x across, y up, z depth; the character is 1.36
tall), base at y 0 with a buried foot below it (`SINK` of the height), so a rock set on the ground looks embedded.
Every random choice is seeded: a rebuild writes the same models. Prints each model's triangles and its footprint
(half extents at the ground and its top), which lib/game/rocks.ts mirrors.

The worn stones (`-- stones`, game/remodel-nature: the village's own accent stones in place of the dump's rock-a..e):
the same seeded chunks, but worn smooth. The hull's broad planes are kept and every edge rounded off (a creased
subdivision, then decimated), with smooth normals and a soft per-vertex colour (the same blue-grey, lit top to shaded
foot, a fine speckle and a little moss on top), so they sit with the faceted boulders but meet row 310: rounded, no
flat-shaded blockiness. Sized to the dump rocks they replace (their footprints in lib/game/defaultIsland.ts).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/rocks/build_rocks.py -- stones
"""
import bmesh, bpy, math, os, sys
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "rocks")
SINK = 0.14  # share of a rock's height buried below y 0

# Facet colours (sRGB): the reference's cool blue-grey stone, light where the sky reaches.
TOP, SIDE, UNDER = "#a7b1b5", "#79868f", "#525d67"
CHAMFER_LIFT = 1.2


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h):
    h = h.lstrip("#")
    return np.array([srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)])


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def chunk(bm, size, seed, centre=(0.0, 0.0, 0.0), squash=0.0):
    """A convex chunk in `bm`: corners and some edge midpoints of a box (game size sx, sy, sz) pulled in and jittered."""
    rng = np.random.default_rng(seed)
    sx, sy, sz = size
    pts = []
    for cx in (-1, 1):
        for cy in (-1, 1):
            for cz in (-1, 1):
                # Corners pulled toward the middle by a random amount: the chamfered, rounded-box silhouette.
                pull = rng.uniform(0.18, 0.42)
                pts.append((cx * (1 - pull * rng.uniform(0.6, 1.2)), cy * (1 - pull * (1 - squash)), cz * (1 - pull * rng.uniform(0.6, 1.2))))
    # Two of each axis's four edges get a midpoint: enough to break the box, few enough to keep the facets broad (and
    # the triangle count low: the ruins and the v2 world draw hundreds of these).
    for axis in range(3):
        for a, b in [(-1, -1), (1, 1)] if rng.uniform() < 0.5 else [(-1, 1), (1, -1)]:
            p = [0.0, 0.0, 0.0]
            p[axis] = rng.uniform(-0.35, 0.35)
            p[(axis + 1) % 3] = a * rng.uniform(0.82, 1.0)
            p[(axis + 2) % 3] = b * rng.uniform(0.82, 1.0)
            pts.append(tuple(p))
    for _ in range(2):
        v = rng.normal(size=3)
        v /= np.linalg.norm(v)
        pts.append(tuple(v * rng.uniform(0.9, 1.05)))
    verts = []
    for x, y, z in pts:
        # Game (x, y, z) to Blender (x, -z, y), around the chunk's centre.
        verts.append(bm.verts.new(Vector((centre[0] + x * sx / 2, -(centre[2] + z * sz / 2), centre[1] + y * sy / 2))))
    hull = bmesh.ops.convex_hull(bm, input=verts)
    unused = list({v for v in hull["geom_unused"] + hull["geom_interior"] if isinstance(v, bmesh.types.BMVert)})
    if unused:
        bmesh.ops.delete(bm, geom=unused, context="VERTS")


def build(name, parts, dissolve=14, bevel=0.035, seed=0):
    """`parts`: [(size, seed, centre)] chunks merged into one rock; returns the object."""
    bm = bmesh.new()
    for size, s, centre in parts:
        chunk(bm, size, s, centre)
    bm.normal_update()
    # Broad flat facets: merge the hull's near-coplanar triangles.
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(dissolve), verts=bm.verts[:], edges=bm.edges[:])
    bm.normal_update()
    before = set(bm.faces)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES", profile=0.5, clamp_overlap=True)
    chamfers = {f for f in bm.faces if f not in before}
    bm.normal_update()
    # Sit it on y 0 with SINK of its height below.
    zs = [v.co.z for v in bm.verts]
    lo, hi = min(zs), max(zs)
    h = hi - lo
    for v in bm.verts:
        v.co.z -= lo + SINK * h
    bm.normal_update()

    mesh = bpy.data.meshes.new(name)
    rng = np.random.default_rng(seed + 991)
    colours = []
    top, side, under = lin(TOP), lin(SIDE), lin(UNDER)
    foot = -SINK * h
    for f in bm.faces:
        up = f.normal.z
        c = side + (top - side) * smooth(0.3, 0.85, up)
        if up < -0.15:
            c = side + (under - side) * smooth(-0.15, -0.6, up)
        # The foot darkens toward the ground (the soil and the grass shade it).
        cz = f.calc_center_median().z
        c = c * (0.72 + 0.28 * smooth(foot, foot + 0.45 * h, cz))
        c = c * rng.uniform(0.94, 1.06)
        if f in chamfers:
            c = c * CHAMFER_LIFT
        colours.append(np.clip(c, 0, 1))
    # Facets stay n-gons (flat, one colour each); the glTF exporter triangulates them.
    bm.to_mesh(mesh)
    bm.free()
    attr = mesh.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for p in mesh.polygons:
        p.use_smooth = False
        for li in p.loop_indices:
            attr.data[li].color = (*colours[p.index], 1.0)
    mesh.color_attributes.active_color = attr

    mat = bpy.data.materials.get("rock") or bpy.data.materials.new("rock")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    if not any(n.type == "VERTEX_COLOR" for n in nt.nodes):
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    mesh.materials.append(mat)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(ob)
    return ob, h


def export(ob, h):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{ob.name}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_texcoords=False, export_vertex_color="ACTIVE", export_skins=False, export_animations=False,
                              export_materials="EXPORT")
    xs = [v.co.x for v in ob.data.vertices]
    ys = [v.co.y for v in ob.data.vertices]
    # Footprint at the ground (Blender x, -y = game x, z) and the top above y 0.
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"ROCK {ob.name} tris={tris} half=({max(abs(min(xs)), max(xs)):.2f}, {max(abs(min(ys)), max(ys)):.2f}) "
          f"top={(1 - SINK) * h:.2f} bytes={os.path.getsize(path)}")


# name: [(game size (x, y, z), seed, centre)]
ROCKS = {
    "boulder-round": [((1.15, 0.85, 1.0), 11, (0, 0, 0))],
    "boulder-tall": [((0.85, 1.3, 0.8), 23, (0, 0, 0))],
    "boulder-slab": [((1.45, 0.5, 1.05), 37, (0, 0, 0))],
    "boulder-small": [((0.58, 0.44, 0.52), 41, (0, 0, 0))],
    "boulder-pillar": [((0.82, 2.4, 0.76), 53, (0, 0, 0))],
    # A coast cluster: one big chunk leaning on two small ones, one mesh.
    "boulder-cluster": [((1.1, 0.95, 1.0), 61, (0, 0, 0)), ((0.6, 0.48, 0.55), 67, (0.72, -0.22, 0.28)), ((0.48, 0.36, 0.5), 71, (-0.55, -0.3, -0.42))],
}

# ================================================================ worn stones (game/remodel-nature)
MOSS, SPECK = "#8a8f4e", "#5d676f"


def noise3(p, scale, seed):
    from mathutils import noise
    return noise.noise(Vector((p.x * scale + seed * 3.1, p.y * scale - seed * 1.7, p.z * scale + seed * 2.3)))


def pebble(bm, size, seed, centre=(0.0, 0.0, 0.0), n=18):
    """A rounder convex chunk than `chunk`: jittered points spread over an ellipsoid (a flattened underside), hulled."""
    rng = np.random.default_rng(seed)
    sx, sy, sz = size
    golden = math.pi * (3 - math.sqrt(5))
    verts = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        a = i * golden + rng.uniform(-0.3, 0.3)
        p = np.array([math.cos(a) * r, z, math.sin(a) * r]) * rng.uniform(0.86, 1.04)
        p[1] = max(p[1], -0.72)
        x, y, zz = p
        verts.append(bm.verts.new(Vector((centre[0] + x * sx / 2, -(centre[2] + zz * sz / 2), centre[1] + y * sy / 2))))
    hull = bmesh.ops.convex_hull(bm, input=verts)
    unused = list({v for v in hull["geom_unused"] + hull["geom_interior"] if isinstance(v, bmesh.types.BMVert)})
    if unused:
        bmesh.ops.delete(bm, geom=unused, context="VERTS")


def stone(name, parts, size, seed, moss=0.0, tris=None):
    """A worn stone: the chunk hull's broad planes kept, every edge rounded off in three bevel steps, and weighted
    normals (each plane shades flat, the rounded edges carry the turn), so it reads chunky and soft at once."""
    bm = bmesh.new()
    for sz, s_, centre in parts:
        pebble(bm, sz, s_, centre)
    bm.normal_update()
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(12), verts=bm.verts[:], edges=bm.edges[:])
    bm.normal_update()
    span = max(sz[i] for sz, _, _ in parts for i in range(3))
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.1 * span, segments=2, affect="EDGES", profile=0.5, clamp_overlap=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    me = ob.data
    # Scale to the dump rock it stands in for: footprint (x, z) and height, then sink the foot.
    xs, ys, zs = [v.co.x for v in me.vertices], [v.co.y for v in me.vertices], [v.co.z for v in me.vertices]
    sx, sy, sz = size[0] / (max(xs) - min(xs)), size[2] / (max(ys) - min(ys)), size[1] / ((max(zs) - min(zs)) * (1 - SINK))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    for v in me.vertices:
        v.co.x, v.co.y, v.co.z = (v.co.x - cx) * sx, (v.co.y - cy) * sy, (v.co.z - min(zs)) * sz
    h = max(v.co.z for v in me.vertices)
    for v in me.vertices:
        v.co.z -= SINK * h
    me.update()
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    m = ob.modifiers.new("wn", "WEIGHTED_NORMAL")
    m.mode = "FACE_AREA"
    m.weight = 50
    bpy.ops.object.modifier_apply(modifier=m.name)
    ob.select_set(False)
    top, side, under = lin(TOP), lin(SIDE), lin(UNDER)
    foot = -SINK * h
    # Coloured per corner from the shading normal, so a broad plane is one even colour and the rounded edges carry
    # the change (a vertex's own normal would streak the plane's long triangles).
    corner_n = [cn.vector.copy() for cn in me.corner_normals]
    cols = {}
    for li, loop in enumerate(me.loops):
        v = me.vertices[loop.vertex_index]
        up = corner_n[li].z
        c = side + (top - side) * smooth(0.1, 0.9, up)
        if up < -0.1:
            c = side + (under - side) * smooth(-0.1, -0.7, up)
        c = c * (0.7 + 0.3 * smooth(foot, foot + 0.4 * h, v.co.z))
        n = noise3(v.co, 6.0, seed) * 0.6 + noise3(v.co, 19.0, seed + 5) * 0.4
        c = c * (1.0 + 0.09 * n)
        # Fine dark speckle (lichen and grain) where the high noise peaks.
        c = c + (lin(SPECK) - c) * 0.45 * smooth(0.35, 0.6, noise3(v.co, 31.0, seed + 9))
        if moss:
            mz = smooth(0.45, 0.85, up) * smooth(0.0, 0.35, noise3(v.co, 4.5, seed + 13) + moss - 0.5)
            c = c + (lin(MOSS) * (0.9 + 0.2 * n) - c) * mz
        cols[li] = np.clip(c, 0, 1)
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for li in range(len(me.loops)):
        attr.data[li].color = (*cols[li], 1.0)
    me.color_attributes.active_color = attr
    mat = bpy.data.materials.get("stone") or bpy.data.materials.new("stone")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    if not any(n.type == "VERTEX_COLOR" for n in nt.nodes):
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    me.materials.append(mat)
    return ob, h


# name: (parts as ROCKS, size to fit (x, y, z) from the dump rock it replaces, moss)
STONES = {
    "stone-a": ([((1.1, 0.8, 1.0), 111, (0, 0, 0))], (0.96, 0.61, 0.88), 0.35),
    "stone-b": ([((1.0, 0.75, 0.95), 123, (0, 0, 0))], (0.92, 0.59, 0.84), 0.0),
    "stone-c": ([((1.2, 0.6, 1.15), 137, (0, 0, 0))], (0.98, 0.52, 1.0), 0.5),
    "stone-d": ([((1.0, 0.85, 1.05), 149, (0, 0, 0))], (0.94, 0.63, 0.98), 0.2),
    # The dump's rock-e is a pair: a tall stone leaning by a low one.
    "stone-e": ([((0.62, 0.9, 0.6), 157, (-0.22, 0.0, -0.1)), ((0.62, 0.5, 0.62), 163, (0.3, -0.18, 0.12))], (1.0, 0.52, 0.98), 0.3),
}

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)
if "stones" in ARGS:
    for i, (name, (parts, size, moss)) in enumerate(STONES.items()):
        ob, h = stone(name, parts, size, seed=200 + i, moss=moss)
        export(ob, h)
else:
    for i, (name, parts) in enumerate(ROCKS.items()):
        ob, h = build(name, parts, seed=i)
        export(ob, h)
