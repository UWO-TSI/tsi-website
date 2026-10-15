"""Shared helpers for the island's nature remodels (art/nature: bushes, stones, forage mushrooms, shells, crabs).

The look (ledger rows 307 and 310): matte, cosy, the autumn palette, "simple but not completely low poly". Every model
here is ONE closed mesh with smooth normals and ONE matte material whose colour is all in the vertex colours (COLOR_0),
so an instanced batch is one draw however many stand. Colour is built per vertex from a few soft terms:

  base colour (per part, blended between neighbouring parts) x a seeded 3D noise (a little value and hue drift)
  x ambient occlusion from ray casts (crevices between clumps, under caps) x a top-light height gradient.

Nothing is downloaded or copied: every shape is built here from seeded spheres, lathes and sweeps.

Frame: Blender Z up, exported Y up (glTF), so game x = Blender x, game y = Blender z, game z = -Blender y. A model's
front (what faces the camera or the sea) points to Blender -Y, which is game +z.
"""
import bmesh, bpy, math, os
import numpy as np
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ASSETS = os.path.join(ROOT, "web", "public", "assets", "game")
TAU = math.tau


# ================================================================ colour
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h):
    """'#rrggbb' to a linear RGB numpy array (vertex colours are linear in glTF)."""
    h = h.lstrip("#")
    return np.array([srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)])


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mixc(a, b, t):
    return a + (b - a) * t


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ================================================================ geometry
def uv_sphere(bm, c, r, segs=16, rings=10, tag=None, tags=None):
    """A closed UV sphere (ellipsoid radii r) into bm; returns its faces. tags: dict face -> tag."""
    c = Vector(c)
    rx, ry, rz = r if isinstance(r, (tuple, list)) else (r, r, r)
    rows = []
    for i in range(1, rings):
        la = -math.pi / 2 + math.pi * i / rings
        rows.append([bm.verts.new(c + Vector((math.cos(la) * math.cos(TAU * k / segs) * rx, math.cos(la) * math.sin(TAU * k / segs) * ry,
                                              math.sin(la) * rz))) for k in range(segs)])
    bot, top = bm.verts.new(c - Vector((0, 0, rz))), bm.verts.new(c + Vector((0, 0, rz)))
    faces = []
    for a, b in zip(rows[:-1], rows[1:]):
        for k in range(segs):
            faces.append(bm.faces.new([a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]]))
    for k in range(segs):
        faces.append(bm.faces.new([rows[0][(k + 1) % segs], rows[0][k], bot]))
        faces.append(bm.faces.new([rows[-1][k], rows[-1][(k + 1) % segs], top]))
    if tags is not None:
        for f in faces:
            tags[f] = tag
    return faces


def lathe(bm, profile, n=16, c=(0, 0, 0), sx=1.0, sy=1.0, phase=0.0, wobble=None):
    """A closed surface of revolution about Blender Z: profile [(radius, z)], r=0 at either end closes it with a cap
    vertex. wobble(angle, z) -> radius factor (petals, ribs). Returns its faces."""
    c = Vector(c)
    pts = list(profile)
    caps = [None, None]
    if pts[0][0] == 0:
        caps[0] = bm.verts.new(c + Vector((0, 0, pts.pop(0)[1])))
    if pts[-1][0] == 0:
        caps[1] = bm.verts.new(c + Vector((0, 0, pts.pop()[1])))
    rings = []
    for r, z in pts:
        ring = []
        for k in range(n):
            a = TAU * k / n + phase
            f = wobble(a, z) if wobble else 1.0
            ring.append(bm.verts.new(c + Vector((math.cos(a) * r * sx * f, math.sin(a) * r * sy * f, z))))
        rings.append(ring)
    faces = []
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(n):
            faces.append(bm.faces.new([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]]))
    if caps[0]:
        for k in range(n):
            faces.append(bm.faces.new([rings[0][(k + 1) % n], rings[0][k], caps[0]]))
    if caps[1]:
        for k in range(n):
            faces.append(bm.faces.new([rings[-1][k], rings[-1][(k + 1) % n], caps[1]]))
    return faces


def tube(bm, path, radii, sides=8, cap0=True, cap1=True, up=None):
    """A closed tapered tube along a path (legs, stalks): elliptic sections when a radius is (a, b). Returns its faces."""
    path = [Vector(p) for p in path]
    n = len(path)
    rings = []
    prev_u = None
    for i, (p, r) in enumerate(zip(path, radii)):
        a = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        ref = Vector(up) if up else (Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0)))
        u = a.cross(ref).normalized()
        if prev_u is not None and u.dot(prev_u) < 0:
            u = -u
        prev_u = u
        w = a.cross(u).normalized()
        rx, ry = r if isinstance(r, (tuple, list)) else (r, r)
        rings.append([bm.verts.new(p + u * math.cos(TAU * k / sides) * rx + w * math.sin(TAU * k / sides) * ry) for k in range(sides)])
    faces = []
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(sides):
            faces.append(bm.faces.new([a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]]))
    if cap0:
        c0 = bm.verts.new(path[0] - (path[1] - path[0]).normalized() * (radii[0] if not isinstance(radii[0], (tuple, list)) else min(radii[0])) * 0.6)
        for k in range(sides):
            faces.append(bm.faces.new([rings[0][(k + 1) % sides], rings[0][k], c0]))
    if cap1:
        r1 = radii[-1] if not isinstance(radii[-1], (tuple, list)) else min(radii[-1])
        c1 = bm.verts.new(path[-1] + (path[-1] - path[-2]).normalized() * r1 * 0.8)
        for k in range(sides):
            faces.append(bm.faces.new([rings[-1][k], rings[-1][(k + 1) % sides], c1]))
    return faces


def to_object(bm, name):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def activate(ob):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def apply_mod(ob, kind, **props):
    activate(ob)
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in props.items():
        setattr(m, k, v)
    bpy.ops.object.modifier_apply(modifier=m.name)


def solidify_union(ob, voxel, smooth_factor=0.6, smooth_iters=4, target_tris=None):
    """Overlapping closed parts -> one closed watertight skin (voxel remesh), its creases softened, then decimated to
    about `target_tris` triangles."""
    apply_mod(ob, "REMESH", mode="VOXEL", voxel_size=voxel, adaptivity=0.0, use_smooth_shade=True)
    if smooth_iters:
        apply_mod(ob, "SMOOTH", factor=smooth_factor, iterations=smooth_iters)
    if target_tris:
        decimate_to(ob, target_tris)


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def decimate_to(ob, target):
    now = tri_count(ob)
    if now > target:
        apply_mod(ob, "DECIMATE", decimate_type="COLLAPSE", ratio=target / now, use_collapse_triangulate=True)
    apply_mod(ob, "TRIANGULATE")


def join(objs, name):
    activate(objs[0])
    for o in objs[1:]:
        o.select_set(True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def shade_smooth(ob, sharp_deg=None):
    """Smooth normals everywhere (sharp_deg: keep edges sharper than this angle hard, e.g. a shell's lip)."""
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    if sharp_deg is not None:
        activate(ob)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(sharp_deg))
        except Exception:
            pass


# ================================================================ vertex colour terms
def vertex_ao(ob, samples=48, dist=0.35, seed=0):
    """Per-vertex ambient occlusion in [0, 1] (1 open sky): cosine-weighted rays over the vertex normal's hemisphere,
    a ray blocked within `dist` by the mesh itself counts as shadow, weighted by how near the hit is."""
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(ob, dg)
    rng = np.random.default_rng(seed)
    me = ob.data
    out = np.ones(len(me.vertices))
    # Fixed directions (z-up cosine hemisphere), turned onto each normal.
    u1, u2 = rng.uniform(size=samples), rng.uniform(size=samples)
    r = np.sqrt(u1)
    th = TAU * u2
    local = np.stack([r * np.cos(th), r * np.sin(th), np.sqrt(1 - u1)], 1)
    for v in me.vertices:
        n = v.normal
        t = n.orthogonal().normalized()
        b = n.cross(t)
        occ = 0.0
        o = v.co + n * 0.004
        for lx, ly, lz in local:
            d = t * lx + b * ly + n * lz
            hit = tree.ray_cast(o, d, dist)
            if hit[0] is not None:
                occ += 1.0 - (hit[3] / dist) ** 0.7
        out[v.index] = 1.0 - occ / samples
    return out


def ground_ao(ob, ground_z=0.0, reach=0.25):
    """Darkening toward the ground the model stands on (1 high above it)."""
    return np.array([smooth(ground_z - 0.02, ground_z + reach, v.co.z) for v in ob.data.vertices])


def noise3(p, scale, seed=0.0):
    """Seeded smooth 3D noise in about [-1, 1]."""
    q = Vector((p[0] * scale + seed * 17.3, p[1] * scale - seed * 9.1, p[2] * scale + seed * 4.7))
    return noise.noise(q)


def paint(ob, colour_of, name="Col"):
    """Per-corner colour attribute from colour_of(vertex index, loop) -> linear rgb (also the active render colour)."""
    me = ob.data
    attr = me.color_attributes.get(name) or me.color_attributes.new(name, "FLOAT_COLOR", "CORNER")
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            c = np.clip(colour_of(vi, p), 0, 1)
            attr.data[li].color = (float(c[0]), float(c[1]), float(c[2]), 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    return attr


def vc_material(name, rough=1.0):
    """The one matte material: white base x COLOR_0, roughness 1, no metal, no texture."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    try:
        bsdf.inputs["Specular IOR Level"].default_value = 0.25
    except KeyError:
        pass
    if not any(n.type == "VERTEX_COLOR" for n in nt.nodes):
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def set_material(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def ground_at_zero(ob, sink=0.0):
    """Shift so the lowest point is at -sink (a model set on the ground reads planted)."""
    zs = [v.co.z for v in ob.data.vertices]
    lo = min(zs)
    for v in ob.data.vertices:
        v.co.z -= lo + sink
    ob.data.update()


# ================================================================ export
def export(ob, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    activate(ob)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_texcoords=False, export_vertex_color="ACTIVE", export_skins=False, export_animations=False,
                              export_materials="EXPORT", export_apply=True)
    vs = ob.data.vertices
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    print(f"MODEL {os.path.relpath(path, ROOT)} tris={tri_count(ob)} verts={len(vs)} mats={len(ob.data.materials)} "
          f"size=({max(xs) - min(xs):.3f}, {max(zs) - min(zs):.3f}, {max(ys) - min(ys):.3f}) "
          f"half=({max(abs(min(xs)), max(xs)):.2f}, {max(abs(min(ys)), max(ys)):.2f}) top={max(zs):.2f} bottom={min(zs):.3f} "
          f"bytes={os.path.getsize(path)}")


# ================================================================ review render (Eevee, headless)
def preview(objs, path, cols=4, spacing=1.6, res=(1600, 900), cam_el=24, cam_az=-28, lens=50, ground="#c9b98f", dist=None):
    """A grid of the given objects in a warm key / cool fill rig over a sand ground, for a quick look."""
    scene = bpy.context.scene
    for i, ob in enumerate(objs):
        ob.location.x += (i % cols) * spacing
        ob.location.y += (i // cols) * spacing * 1.15
    rows = (len(objs) + cols - 1) // cols
    cx, cy = (min(cols, len(objs)) - 1) * spacing / 2, (rows - 1) * spacing * 1.15 / 2
    bpy.ops.mesh.primitive_plane_add(size=80, location=(cx, cy, 0))
    g = bpy.data.materials.new("ground")
    g.use_nodes = True
    next(n for n in g.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*lin(ground), 1)
    bpy.context.object.data.materials.append(g)
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(48), math.radians(-18), math.radians(-38)))
    bpy.context.object.data.energy = 3.6
    bpy.context.object.data.color = (1.0, 0.92, 0.8)
    bpy.context.object.data.angle = math.radians(6)
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.55, 0.66, 0.85, 1)
    bg.inputs["Strength"].default_value = 1.0
    lo = Vector((min(o.location.x - o.dimensions.x / 2 for o in objs), min(o.location.y - o.dimensions.y / 2 for o in objs), 0))
    hi = Vector((max(o.location.x + o.dimensions.x / 2 for o in objs), max(o.location.y + o.dimensions.y / 2 for o in objs), max(o.dimensions.z for o in objs)))
    target = (lo + hi) / 2
    radius = (hi - lo).length / 2
    d = dist or radius * lens / 18 * 0.95
    el, az = math.radians(cam_el), math.radians(cam_az)
    loc = target + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    cam.data.lens = lens
    direction = target - loc
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", path)
