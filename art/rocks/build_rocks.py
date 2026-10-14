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
"""
import bmesh, bpy, math, os
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
    """A convex chunk in `bm`: corners and edge midpoints of a box (game size sx, sy, sz) pulled in and jittered."""
    rng = np.random.default_rng(seed)
    sx, sy, sz = size
    pts = []
    for cx in (-1, 1):
        for cy in (-1, 1):
            for cz in (-1, 1):
                # Corners pulled toward the middle by a random amount: the chamfered, rounded-box silhouette.
                pull = rng.uniform(0.18, 0.42)
                pts.append((cx * (1 - pull * rng.uniform(0.6, 1.2)), cy * (1 - pull * (1 - squash)), cz * (1 - pull * rng.uniform(0.6, 1.2))))
    for axis in range(3):
        for a in (-1, 1):
            for b in (-1, 1):
                p = [0.0, 0.0, 0.0]
                p[axis] = rng.uniform(-0.35, 0.35)
                p[(axis + 1) % 3] = a * rng.uniform(0.82, 1.0)
                p[(axis + 2) % 3] = b * rng.uniform(0.82, 1.0)
                pts.append(tuple(p))
    for _ in range(6):
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


def build(name, parts, dissolve=10, bevel=0.035, seed=0):
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

bpy.ops.wm.read_factory_settings(use_empty=True)
for i, (name, parts) in enumerate(ROCKS.items()):
    ob, h = build(name, parts, seed=i)
    export(ob, h)
