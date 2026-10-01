"""Mesh, texture and export helpers for the café (specs/cafe-polish.md items 7 and 8).

Everything is authored in GAME coordinates (x across, y up, z into the room; one unit ~ 1.2 m, the character is
1.36 tall) and converted to Blender (z up) on the way in: G(x, y, z) = (x, -z, y). The glTF exporter turns Blender
back into three.js's y-up frame, so a vertex at G(x, y, z) lands at (x, y, z) in the engine and a game yaw is a
rotation about Blender's z.

A Model is one mesh object with one material slot per named material: the glTF has one primitive (one draw) per
material however many parts went in. Faces are flat-shaded unless their neighbours meet at under `smooth` degrees.
Textured materials get box-projected UVs in world units (`Mat.tile` units per texture repeat).
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Matrix, Vector

TAU = math.tau
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "cafe")


def G(x, y, z):
    return Vector((x, -z, y))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(h):
    return tuple(srgb_to_lin(c) for c in hexrgb(h))


# ================================================================ textures (numpy, sRGB, top row first)
def image(name, rgb):
    """A packed image from an [h, w, 3] float sRGB array (exported as JPEG)."""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = np.clip(rgb[::-1], 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.file_format = "PNG"
    img.pack()
    return img


def _rng(seed):
    return np.random.default_rng(seed)


def _smooth_noise(rng, h, w, cells):
    """Value noise: a coarse random grid upsampled with smoothstep, tileable."""
    g = rng.random((cells, cells))
    ys = np.linspace(0, cells, h, endpoint=False)
    xs = np.linspace(0, cells, w, endpoint=False)
    y0, x0 = np.floor(ys).astype(int), np.floor(xs).astype(int)
    fy, fx = ys - y0, xs - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    y1, x1 = (y0 + 1) % cells, (x0 + 1) % cells
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def wood(size, dark, light, seed=1, planks=4, joint="#000000", joint_px=2, streak=0.5):
    """Vertical-grain wood: `planks` boards across, each its own tone; fine straight grain with a slow drift, dark joints."""
    rng = _rng(seed)
    h = w = size
    d, l, j = np.array(hexrgb(dark)), np.array(hexrgb(light)), np.array(hexrgb(joint))
    out = np.zeros((h, w, 3))
    pw = w // planks
    Y = np.arange(h)[:, None] / h
    for p in range(planks):
        X = np.arange(pw)[None, :] / pw
        drift = sum(rng.uniform(0.002, 0.008) * np.sin(TAU * (Y * k + rng.random())) for k in (1, 2))
        lines = np.zeros((h, pw))
        for freq, amp in ((rng.uniform(22, 30), 0.6), (rng.uniform(55, 75), 0.3), (rng.uniform(120, 160), 0.15)):
            lines += amp * (0.5 + 0.5 * np.sin(TAU * ((X + drift) * freq + rng.random())))
        lines /= 1.05
        figure = _smooth_noise(rng, h, pw, 5)
        g = streak * lines ** 2 + (1 - streak) * figure
        fine = rng.random((h, pw)) * 0.035
        tone = rng.uniform(-0.08, 0.08)
        t = np.clip(g * 0.85 + fine + tone + 0.08, 0, 1)[..., None]
        out[:, p * pw:(p + 1) * pw] = d + (l - d) * t
        if joint_px:
            out[:, p * pw:p * pw + joint_px] = j
    return out


def tiles(size, n, tile, grout, grout_px=3, vary=0.04, seed=2, rows=None, bevel=0.10):
    """A grid of n x rows tiles with grout lines, a little tone variation and a soft bevel highlight per tile."""
    rng = _rng(seed)
    rows = rows or n
    h = w = size
    t, g = np.array(hexrgb(tile)), np.array(hexrgb(grout))
    out = np.zeros((h, w, 3))
    tw, th = w / n, h / rows
    yy, xx = np.mgrid[0:h, 0:w]
    ci, ri = (xx // tw).astype(int), (yy // th).astype(int)
    tone = rng.uniform(-vary, vary, (rows, n))[ri, ci]
    u, v = (xx % tw) / tw, (yy % th) / th
    edge = np.minimum(np.minimum(u, 1 - u) * tw, np.minimum(v, 1 - v) * th)
    shade = 1 + bevel * np.clip(1 - edge / 6, 0, 1) * np.where(u + v < 1, 1, -1)
    out[:] = np.clip(t * (1 + tone)[..., None] * shade[..., None], 0, 1)
    out[edge < grout_px / 2 + 0.5] = g
    return out


def terrazzo(size, base, chips, grout, n=3, seed=3):
    """Warm terrazzo floor tiles: n x n tiles of base stone with scattered chips and fine grout."""
    rng = _rng(seed)
    h = w = size
    out = np.zeros((h, w, 3)) + np.array(hexrgb(base))
    out *= (0.97 + 0.06 * _smooth_noise(rng, h, w, 6))[..., None]
    for _ in range(int(size * size / 90)):
        y, x = rng.integers(0, h), rng.integers(0, w)
        r = rng.choice([1, 1, 1, 2, 2, 3])
        c = np.array(hexrgb(chips[rng.integers(0, len(chips))]))
        out[max(0, y - r):y + r, max(0, x - r):x + r] = c
    # each big tile its own slightly different pour, and a crisp grout line between them
    step = size // n
    for i in range(n):
        for j in range(n):
            out[i * step:(i + 1) * step, j * step:(j + 1) * step] *= 1 + rng.uniform(-0.035, 0.035)
    g = np.array(hexrgb(grout))
    for k in range(n):
        out[k * step:k * step + 3, :] = g
        out[:, k * step:k * step + 3] = g
    return out


# ================================================================ materials
class Mat:
    def __init__(self, name, color="#ffffff", rough=0.85, tex=None, tile=1.0, glow=0.0, alpha=1.0, glow_color=None, double=True):
        self.name, self.tile = name, tile
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = 0.0
        if tex is not None:
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = tex
            nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        else:
            b.inputs["Base Color"].default_value = (*lin(color), 1)
        m.diffuse_color = (*lin(color), 1)
        if glow:
            b.inputs["Emission Color"].default_value = (*lin(glow_color or color), 1)
            b.inputs["Emission Strength"].default_value = glow
        if alpha < 1:
            b.inputs["Alpha"].default_value = alpha
            m.surface_render_method = "BLENDED"
        m.use_backface_culling = not double   # glTF doubleSided; three flips the normal on back faces, so winding never darkens
        self.textured = tex is not None
        self.m = m


# ================================================================ geometry
def _rot(yaw):
    return Matrix.Rotation(yaw, 4, "Z")


class Model:
    """One mesh object built from parts; one material slot per Mat used."""

    def __init__(self, name, smooth=35):
        self.name, self.smooth = name, smooth
        self.bm = bmesh.new()
        self.mats = []
        self.cur = None

    def _mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _take(self, geom, mat, xf=None, recalc=True):
        verts = [e for e in geom if isinstance(e, bmesh.types.BMVert)]
        faces = list({f for v in verts for f in v.link_faces})
        if xf is not None:
            bmesh.ops.transform(self.bm, matrix=xf, verts=verts)
        if recalc and faces:
            bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        i = self._mi(mat)
        for f in faces:
            f.material_index = i
        return faces

    def box(self, c, size, mat, yaw=0.0, bevel=0.0, drop=()):
        """Box centred at game c with game size (sx, sy, sz); `drop`: faces left out ('top', 'bottom', '+x', '-x', '+z', '-z')."""
        bm = self.bm
        before = set(bm.verts)
        geom = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        sx, sy, sz = size
        bmesh.ops.scale(bm, vec=Vector((sx, sz, sy)), verts=geom)
        faces = list({f for v in geom for f in v.link_faces})
        if bevel:
            edges = list({e for f in faces for e in f.edges})
            bmesh.ops.bevel(bm, geom=edges, offset=min(bevel, min(size) * 0.45), segments=1, affect="EDGES", profile=0.5)
            geom = [v for v in bm.verts if v not in before]
            faces = list({f for v in geom for f in v.link_faces})
        if drop:
            names = {"top": Vector((0, 0, 1)), "bottom": Vector((0, 0, -1)), "+x": Vector((1, 0, 0)), "-x": Vector((-1, 0, 0)),
                     "+z": Vector((0, -1, 0)), "-z": Vector((0, 1, 0))}
            bm.normal_update()
            kill = [f for f in faces if any(f.normal.dot(names[d]) > 0.99 for d in drop)]
            bmesh.ops.delete(bm, geom=kill, context="FACES_ONLY")
            geom = [v for v in bm.verts if v not in before and v.is_valid]
        return self._take(geom, mat, Matrix.Translation(G(*c)) @ _rot(yaw), recalc=not drop)

    def cyl(self, c, r, h, mat, n=16, yaw=0.0, r2=None, caps=(True, True), axis="y", d=None):
        """Cylinder (or cone with r2) standing on game point c, height h along +y (or along 'x'/'z')."""
        prof = []
        if caps[0]:
            prof.append((0.0, 0.0))
        prof += [(r, 0.0), (r2 if r2 is not None else r, h)]
        if caps[1]:
            prof.append((0.0, h))
        return self.lathe(c, prof, mat, n=n, yaw=yaw, axis=axis, d=d)

    def lathe(self, c, profile, mat, n=16, yaw=0.0, axis="y", sx=1.0, sz=1.0, d=None):
        """Surface of revolution: profile [(radius, height)] up the axis from game c; r = 0 ends are capped to a point.
        The axis is game +y, or 'x'/'z' (+x, +z), or any game direction `d`."""
        bm = self.bm
        rings = []
        for r, y in profile:
            if r == 0:
                rings.append([bm.verts.new((0, 0, y))])
            else:
                rings.append([bm.verts.new((math.cos(TAU * k / n) * r * sx, math.sin(TAU * k / n) * r * sz, y)) for k in range(n)])
        new = []
        for a, b in zip(rings, rings[1:]):
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                new += [bm.faces.new((a[0], b[(k + 1) % n], b[k])) for k in range(n)]
            elif len(b) == 1:
                new += [bm.faces.new((a[k], a[(k + 1) % n], b[0])) for k in range(n)]
            else:
                new += [bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])) for k in range(n)]
        verts = [v for ring in rings for v in ring]
        gd = d or {"y": (0, 1, 0), "x": (1, 0, 0), "z": (0, 0, 1)}[axis]
        orient = Vector((gd[0], -gd[2], gd[1])).normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation(G(*c)) @ _rot(yaw) @ orient, verts=verts)
        bmesh.ops.recalc_face_normals(bm, faces=new)
        i = self._mi(mat)
        for f in new:
            f.material_index = i
        return new

    def disc(self, c, r, mat, d=(0, 1, 0), n=16):
        """A flat round face at game c facing game direction d."""
        bm = self.bm
        dv = Vector((d[0], -d[2], d[1])).normalized()
        q = dv.to_track_quat("Z", "Y").to_matrix()
        vs = [bm.verts.new(G(*c) + q @ Vector((math.cos(TAU * k / n) * r, math.sin(TAU * k / n) * r, 0))) for k in range(n)]
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.dot(dv) < 0:
            f.normal_flip()
        f.material_index = self._mi(mat)
        return [f]

    def quad(self, pts, mat, d):
        """One face through game points, facing game direction d."""
        bm = self.bm
        vs = [bm.verts.new(G(*p)) for p in pts]
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.dot(Vector((d[0], -d[2], d[1]))) < 0:
            f.normal_flip()
        f.material_index = self._mi(mat)
        return [f]

    def tube(self, path, r, mat, n=8, caps=True):
        """A round rod through game points."""
        bm = self.bm
        pts = [G(*p) for p in path]
        rings = []
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            q = d.to_track_quat("Z", "Y").to_matrix()
            rings.append([bm.verts.new(p + q @ Vector((math.cos(TAU * k / n) * r, math.sin(TAU * k / n) * r, 0))) for k in range(n)])
        new = [bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])) for a, b in zip(rings, rings[1:]) for k in range(n)]
        if caps:
            new.append(bm.faces.new(list(reversed(rings[0]))))
            new.append(bm.faces.new(rings[-1]))
        bmesh.ops.recalc_face_normals(bm, faces=new)
        i = self._mi(mat)
        for f in new:
            f.material_index = i
        return new

    def blob(self, c, radii, mat, segs=10, rings=6, yaw=0.0, squash_bottom=False):
        """Ellipsoid at game c with game radii (rx, ry, rz); squash_bottom flattens the lower half onto c's y - ry * 0.3."""
        bm = self.bm
        geom = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)["verts"]
        rx, ry, rz = radii
        bmesh.ops.scale(bm, vec=Vector((rx, rz, ry)), verts=geom)
        if squash_bottom:
            for v in geom:
                if v.co.z < -ry * 0.3:
                    v.co.z = -ry * 0.3
        return self._take(geom, mat, Matrix.Translation(G(*c)) @ _rot(yaw))

    def ring(self, c, r, tube_r, mat, n=16, m=6):
        """Torus lying flat (a stool's footrest) at game c."""
        bm = self.bm
        verts = []
        rings = []
        for k in range(n):
            a = TAU * k / n
            ca, sa = math.cos(a), math.sin(a)
            ring = []
            for j in range(m):
                b = TAU * j / m
                rr = r + math.cos(b) * tube_r
                ring.append(bm.verts.new((ca * rr, sa * rr, math.sin(b) * tube_r)))
            rings.append(ring)
            verts += ring
        new = [bm.faces.new((rings[k][j], rings[(k + 1) % n][j], rings[(k + 1) % n][(j + 1) % m], rings[k][(j + 1) % m])) for k in range(n) for j in range(m)]
        bmesh.ops.transform(bm, matrix=Matrix.Translation(G(*c)), verts=verts)
        bmesh.ops.recalc_face_normals(bm, faces=new)
        i = self._mi(mat)
        for f in new:
            f.material_index = i
        return new

    def rot(self, faces, c, axis, angle):
        """Turn these faces about game point c: axis 'x' (tilt toward -z), 'y' (yaw) or 'z' (roll in the x-y plane)."""
        verts = list({v for f in faces for v in f.verts})
        bax = {"x": "X", "y": "Z", "z": "Y"}[axis]          # game axis -> Blender axis (game z is Blender -y)
        sgn = -1 if axis == "z" else 1
        bmesh.ops.rotate(self.bm, verts=verts, cent=G(*c), matrix=Matrix.Rotation(sgn * angle, 3, bax))
        return faces

    def finish(self):
        bm = self.bm
        bm.normal_update()
        sharp = [e for e in bm.edges if len(e.link_faces) != 2 or
                 math.degrees(e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0)) > self.smooth]
        bmesh.ops.split_edges(bm, edges=sharp)
        uv = bm.loops.layers.uv.new("UVMap")
        for f in bm.faces:
            f.smooth = True
            mat = self.mats[f.material_index]
            if not mat.textured:
                for lp in f.loops:
                    lp[uv].uv = (0.5, 0.5)
                continue
            nx, ny, nz = (abs(f.normal.x), abs(f.normal.y), abs(f.normal.z))   # Blender axes: y = -game z, z = game y
            for lp in f.loops:
                x, y, z = lp.vert.co.x, lp.vert.co.z, -lp.vert.co.y            # game coords
                if nz >= nx and nz >= ny:        # game up/down: (x, z)
                    u, v = x, z
                elif nx >= ny:                   # facing game x: (z, y)
                    u, v = z, y
                else:                            # facing game z: (x, y)
                    u, v = x, y
                lp[uv].uv = (u / mat.tile, v / mat.tile)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m.m)
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def tris(obs):
    n = 0
    for o in obs:
        for p in o.data.polygons:
            n += len(p.vertices) - 2
    return n


def export(obs, name, sub=""):
    path = os.path.join(OUT, sub, f"{name}.glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_texcoords=True, export_vertex_color="NONE", export_skins=False, export_animations=False,
                              export_image_format="JPEG", export_jpeg_quality=86, export_materials="EXPORT")
    print(f"EXPORT {name}.glb tris={tris(obs)} mats={sorted({m.name for o in obs for m in o.data.materials})} bytes={os.path.getsize(path)}")
    return path


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)
