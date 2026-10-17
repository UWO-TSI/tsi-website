"""Shared pieces for the village greenery (game/remodel-trees): leaf cards over closed volumes, trunks, casters, export.

David, 2026-10-16: trees and plants are leaf cards wearing a real painted texture over a closed volume (no smooth
blobs, no flat fans seen from behind), as the approved bushes are closed (art/nature/close_bushes.py): the cards all
round, wound to face out, normals out of the mass, and a darker volume of the same leaves inside, so a gap between
cards shows leaves in shade, never the sky. The textures are ours, painted by art/trees/paint_textures.py.

Atlas layout (every leaf and needle atlas, 512 x 512): twelve cut-out card cells of 128 px, 4 across and 3 down from
the image's top left, each card one painted leaf clump, blossom or fringe; the bottom 128 px row is an opaque mass
(left half: the cards' own paint, overlapping) and packed snow (right half). In Blender's UV space (v up) cell i is
u (i % 4) / 4 .. +1/4, v 1 - (i // 4 + 1) / 4 .. +1/4; the mass u 0..0.5, v 0..0.25; the snow u 0.5..1, v 0..0.25.

Colour: the texture times COLOR_0, which carries the shade: the inner volume darker, the lower and inner cards a
little darker, each card a touch different. One material per role (leaves with their volume; the bark), so a tree
is two draws in colour however many stand, plus its shadow casters (mShadowShake, the crown's hull that sways with
it; mShadow, the trunk), which only the sun's map draws (lib/game/shadows.ts).

Frame: Blender Z up, exported Y up (glTF): game x = Blender x, game y = Blender z, game z = -Blender y.
"""
import bmesh, bpy, math, os, random
from mathutils import Matrix, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
TEX = os.path.join(HERE, "textures")
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "plants")
TAU = math.tau
UP = Vector((0, 0, 1))

INSET = 0.004
# Twelve card cells, 4 across and 3 down from the image's top left (128 px each); the bottom row is the mass and the snow.
CELLS = [(c / 4, 1 - (r + 1) / 4, (c + 1) / 4, 1 - r / 4) for r in range(3) for c in range(4)]
MASS = (0.0, 0.0, 0.5, 0.25)
SNOW = (0.5, 0.0, 1.0, 0.25)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h):
    """'#rrggbb' to linear RGB (vertex colours are linear in glTF)."""
    h = h.lstrip("#")
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


# ================================================================ a mesh under construction
class Build:
    """Faces with per-corner UVs and colours, written into one Blender mesh at the end."""

    def __init__(self):
        self.verts, self.faces, self.uvs, self.cols, self.normals = [], [], [], [], []

    def vert(self, co, normal=None):
        self.verts.append(Vector(co))
        self.normals.append(normal)
        return len(self.verts) - 1

    def face(self, idx, uvs, col):
        """col: one (r, g, b) for the face or one per corner."""
        self.faces.append(tuple(idx))
        self.uvs.append([tuple(u) for u in uvs])
        self.cols.append([tuple(col)] * len(idx) if not isinstance(col[0], (tuple, list)) else [tuple(c) for c in col])

    def extend(self, other):
        off = len(self.verts)
        self.verts += other.verts
        self.normals += other.normals
        self.faces += [tuple(i + off for i in f) for f in other.faces]
        self.uvs += other.uvs
        self.cols += other.cols

    def object(self, name, material):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        uv = me.uv_layers.new(name="UVMap")
        col = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
        li = 0
        for p in me.polygons:
            for k, loop in enumerate(p.loop_indices):
                uv.data[loop].uv = self.uvs[p.index][k]
                c = self.cols[p.index][k]
                col.data[loop].color = (c[0], c[1], c[2], 1.0)
        me.color_attributes.active_color = col
        me.materials.append(material)
        if any(n is not None for n in self.normals):
            me.shade_smooth()
            ns = [(n if n is not None else Vector((0, 0, 1))).normalized() for n in self.normals]
            me.normals_split_custom_set_from_vertices(ns)
        me.validate()
        return link(bpy.data.objects.new(name, me))


def cell_uv(cell, x, y, flip=False):
    """(x, y) in -1..1 over a card -> the cell's UV (inset)."""
    u0, v0, u1, v1 = cell
    if flip:
        x = -x
    return (u0 + INSET + (u1 - u0 - 2 * INSET) * (x + 1) / 2, v0 + INSET + (v1 - v0 - 2 * INSET) * (y + 1) / 2)


def card_frame(n, up_hint=UP, roll=0.0):
    """A card's right and up axes for its normal n: up is the world's up laid into the card (a card facing straight up
    or down takes up_hint), then rolled about n."""
    up = up_hint - n * up_hint.dot(n)
    if up.length < 0.25:
        alt = Vector((n.x, n.y, 0))
        alt = alt.normalized() if alt.length > 1e-4 else Vector((0, 1, 0))
        up = alt - n * alt.dot(n)
    up.normalize()
    right = up.cross(n).normalized()
    if roll:
        R = Matrix.Rotation(roll, 3, n)
        right, up = R @ right, R @ up
    return right, up


def add_card(b, centre, n, size, cell, col, roll=0.0, fold=0.0, flip=False, stretch=1.0, normal_of=None, up_hint=UP):
    """One leaf card: a square (or a little taller with stretch) facing n, folded along its middle by `fold` (a shallow
    roof, so it never thins to a line edge on). Its texture's up is the world's up (the painted light is from above)."""
    right, up = card_frame(n, up_hint, roll)
    h = size / 2
    pts = []
    if fold > 0:
        grid = [(-1, -1), (0, -1), (1, -1), (1, 1), (0, 1), (-1, 1)]
    else:
        grid = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for x, y in grid:
        p = centre + right * (x * h) + up * (y * h * stretch) + n * (fold * h * (1 - abs(x)))
        pts.append(p)
    idx = [b.vert(p, normal_of(p) if normal_of else n) for p in pts]
    uv = [cell_uv(cell, x, y, flip) for x, y in grid]
    if fold > 0:
        b.face([idx[0], idx[1], idx[4], idx[5]], [uv[0], uv[1], uv[4], uv[5]], col)
        b.face([idx[1], idx[2], idx[3], idx[4]], [uv[1], uv[2], uv[3], uv[4]], col)
    else:
        b.face(idx, uv, col)


def fib_dirs(n, rng, jitter=0.35):
    """n roughly even directions over the sphere (a Fibonacci lattice, jittered)."""
    out = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(max(0, 1 - z * z))
        a = i * ga
        d = Vector((math.cos(a) * r, math.sin(a) * r, z))
        d += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * (jitter / math.sqrt(n) * 2)
        out.append(d.normalized())
    return out


def tri_wave(x):
    """0..1..0 as x runs 0..1..2: a tiling that mirrors at the seams, so a wrap stays continuous."""
    return 1 - abs((x % 2) - 1)


def ellipsoid(b, centre, radii, rect, col_of, segs=10, rings=6, wobble=0.0, seed=0, normal_of=None, ground=None, flat_top=False):
    """A closed ellipsoid wearing `rect` of the atlas (mirrored round it and up it), colours by col_of(point)."""
    u0, v0, u1, v1 = rect
    rows = []
    for j in range(rings + 1):
        t = j / rings
        phi = math.pi * (t - 0.5)
        row = []
        for i in range(segs):
            th = TAU * i / segs
            d = Vector((math.cos(phi) * math.cos(th), math.cos(phi) * math.sin(th), math.sin(phi)))
            k = 1 + wobble * noise.noise(d * 1.7 + Vector((seed * 3.1, seed * 1.7, 0.3)))
            p = centre + Vector((d.x * radii.x, d.y * radii.y, d.z * radii.z)) * k
            if ground is not None:
                p.z = max(p.z, ground)
            row.append(p)
        rows.append(row)
    vid = {}
    def v(j, i):
        i %= segs
        key = (0, 0) if j == 0 else (rings, 0) if j == rings else (j, i)
        if key not in vid:
            p = rows[j][i]
            vid[key] = b.vert(p, normal_of(p) if normal_of else (p - centre).normalized())
        return vid[key]
    def uv(j, i):
        return (u0 + INSET + (u1 - u0 - 2 * INSET) * tri_wave(i / segs * 4), v0 + INSET + (v1 - v0 - 2 * INSET) * tri_wave(j / rings * 2))
    for j in range(rings):
        for i in range(segs):
            if j == 0:
                ids, uvs = [v(0, 0), v(1, i + 1), v(1, i)], [uv(0, i + 0.5), uv(1, i + 1), uv(1, i)]
            elif j == rings - 1:
                ids, uvs = [v(j, i), v(j, i + 1), v(rings, 0)], [uv(j, i), uv(j, i + 1), uv(rings, i + 0.5)]
            else:
                ids, uvs = [v(j, i), v(j, i + 1), v(j + 1, i + 1), v(j + 1, i)], [uv(j, i), uv(j, i + 1), uv(j + 1, i + 1), uv(j + 1, i)]
            b.face(ids, uvs, [col_of(b.verts[k]) for k in ids])


def tube(b, path, radii, sides, col_of, v_scale=1.0, u_tiles=1.0, cap=False, normal_twist=0.0):
    """A tube along `path` (points) with radii per point; UVs: u round (u_tiles times), v along its length (v_scale per
    unit, tiling: the bark texture repeats)."""
    n = len(path)
    frames = []
    prev_side = None
    for i, p in enumerate(path):
        t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        if prev_side is None:
            ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
            side = t.cross(ref).normalized()
        else:
            side = (prev_side - t * prev_side.dot(t)).normalized()
        prev_side = side
        frames.append((t, side, t.cross(side).normalized()))
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + (path[i] - path[i - 1]).length)
    ring = []
    for i, (p, r, (t, s1, s2)) in enumerate(zip(path, radii, frames)):
        row = []
        for k in range(sides + 1):
            a = TAU * k / sides + normal_twist
            d = s1 * math.cos(a) + s2 * math.sin(a)
            q = p + d * r
            row.append((b.vert(q, d), (k / sides * u_tiles, acc[i] * v_scale)))
        ring.append(row)
    for i in range(n - 1):
        for k in range(sides):
            a, bb, c, d = ring[i][k], ring[i][k + 1], ring[i + 1][k + 1], ring[i + 1][k]
            b.face([a[0], bb[0], c[0], d[0]], [a[1], bb[1], c[1], d[1]], [col_of(b.verts[x[0]]) for x in (a, bb, c, d)])
    if cap:
        tip = b.vert(path[-1] + frames[-1][0] * radii[-1] * 0.5, frames[-1][0])
        for k in range(sides):
            a, bb = ring[-1][k], ring[-1][k + 1]
            b.face([a[0], bb[0], tip], [a[1], bb[1], (a[1][0], a[1][1] + 0.05)], [col_of(b.verts[x]) for x in (a[0], bb[0], tip)])


def icosphere_into(b, centre, radius, subdiv, col=(1, 1, 1), squash=1.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    vids = {}
    for v in bm.verts:
        p = centre + Vector((v.co.x, v.co.y, v.co.z * squash))
        vids[v.index] = b.vert(p, (p - centre).normalized())
    for f in bm.faces:
        b.face([vids[v.index] for v in f.verts], [(0, 0)] * len(f.verts), col)
    bm.free()


# ================================================================ materials and export
def image(name, size=None):
    path = os.path.join(TEX, name + ".png")
    img = bpy.data.images.load(path, check_existing=True)
    img.name = name
    if size and tuple(img.size) != size:
        img = img.copy()
        img.name = f"{name}@{size[0]}"
        img.scale(*size)
    return img


def material(name, img, alpha_clip=False):
    """A matte textured material: base colour = image x vertex colour (the glTF exporter writes the image and, with
    the vertex colours on, COLOR_0; the game multiplies them)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha_clip:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    return m


def plain(name, rgb=(0.5, 0.5, 0.5)):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    return m


def export(objs, path):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
              export_normals=True, export_texcoords=True, export_materials="EXPORT", export_animations=False,
              export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE", export_all_vertex_colors=False)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
