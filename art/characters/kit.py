"""Shared helpers for the character part generators (hair, outfits, accessories) and their review renders.

Blender-only (bpy). Every part is a Piece: bmesh geometry with a material name per face and a body region per
vertex; finish() smooths by angle, bakes the COLOR_0 top-light gradient, skins it to the v6 CharacterRig by
region (base/body_shape.weights) and export() writes a GLB = rig + that one mesh, bound by bone name.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, "base")
sys.path.insert(0, BASE)
from head_shape import HC, hair_point, INNER, hair_vol, hairline  # noqa: E402
import body_shape as body  # noqa: E402

PAL = json.load(open(os.path.join(HERE, "palette.json")))
TAU = math.tau
BONE = "mixamorig:"


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, hexcol=None, double=True, image=None, clip=False, rough=0.9):
    """Flat palette material (base colour in linear), or an image material; clip = alpha MASK (decals)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    m.use_backface_culling = not double
    if image is not None:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        if clip:
            rnd = nt.nodes.new("ShaderNodeMath")
            rnd.operation = "ROUND"
            nt.links.new(t.outputs["Alpha"], rnd.inputs[0])
            nt.links.new(rnd.outputs[0], b.inputs["Alpha"])
            try:
                m.surface_render_method = "DITHERED"
            except (AttributeError, TypeError):
                pass
    else:
        c = (*lin(hexcol), 1)
        b.inputs["Base Color"].default_value = c
        m.diffuse_color = c
    return m


def image(name, rgba, path=None):
    """Packed PNG image from a float array [h, w, 4] of sRGB values (top row first); also saved to path."""
    h, w = rgba.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).reshape(-1).astype(np.float32))
    img.file_format = "PNG"
    if path:
        img.filepath_raw = path
        img.save()
    img.pack()
    return img


def load_rig(scene, extra=()):
    """Append CharacterRig (+ extra v6 objects, e.g. the body for renders) from base/v6.blend, in rest pose."""
    want = ["CharacterRig", *extra]
    with bpy.data.libraries.load(os.path.join(BASE, "v6.blend"), link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in want]
    for o in dst.objects:
        scene.collection.objects.link(o)
    rig = bpy.data.objects["CharacterRig"]
    rig.data.pose_position = "REST"
    if rig.animation_data:
        rig.animation_data.action = None
    return rig


class Piece:
    def __init__(self, region="head", mat="M_Hair"):
        self.bm = bmesh.new()
        self.region, self.mat = region, mat     # current defaults for new verts / faces
        self.ref = {}          # face -> outward reference point
        self.vreg = {}         # vert -> body region (weights)
        self.fmat = {}         # face -> material name
        self.fuv = {}          # face -> {vert: uv} (decal faces)
        self.sph = {}          # vert -> (lat, lon) of head-surface verts (hair_point), for their inner copies

    def v(self, p):
        vert = self.bm.verts.new(p)
        self.vreg[vert] = self.region
        return vert

    def hv(self, lat, lon, off):
        """Vertex on the head surface pushed out by off; remembers (lat, lon) so thicken() can tuck it in."""
        vert = self.v(hair_point(lat, lon, off))
        self.sph[vert] = (lat, lon)
        return vert

    def mark(self):
        return len(self.bm.faces)

    def since(self, n0):
        self.bm.faces.ensure_lookup_table()
        return [self.bm.faces[i] for i in range(n0, len(self.bm.faces))]

    def thicken(self, faces, inner_of):
        """Close an open surface into a solid (no paper edges, and the engine's back-face culling cannot hollow it):
        an inner copy of every face, inner_of(vert) -> its position, facing the other way, and a wall along every
        edge the surface uses once. Refs sit inside the solid, so finish() turns every normal outward."""
        faces = [f for f in faces if f is not None and f.is_valid]
        inner, uses = {}, {}
        for f in faces:
            for e in f.edges:
                uses[e] = uses.get(e, 0) + 1

        def iv(v):
            if v not in inner:
                keep = self.region
                self.region = self.vreg.get(v, keep)
                inner[v] = self.v(inner_of(v))
                self.region = keep
            return inner[v]
        keep = self.mat
        for f in faces:
            vs = list(f.verts)
            ivs = [iv(v) for v in vs]
            c = f.calc_center_median()
            mid = (c + sum((x.co for x in ivs), Vector()) / len(ivs)) / 2
            self.mat = self.fmat.get(f, keep)
            self.f(list(reversed(ivs)), mid)
            for a, b_ in zip(vs, vs[1:] + vs[:1]):
                e = next((x for x in a.link_edges if b_ in x.verts), None)
                if e is not None and uses.get(e) == 1:
                    self.f([a, b_, iv(b_), iv(a)], mid)
        self.mat = keep
        return inner

    def solid_patch(self, lons, rows_fn, off_fn, tips=None, skip=None, inner=INNER, wrap=False):
        """patch() closed into a solid whose underside is tucked `inner` into the scalp (hair, hat tucks)."""
        n0 = self.mark()
        grid = self.patch(lons, rows_fn, off_fn, tips=tips, skip=skip, wrap=wrap)
        self.thicken(self.since(n0), lambda v: hair_point(*self.sph[v], inner) if v in self.sph else v.co.copy())
        return grid

    def f(self, vs, ref, uv=None):
        keep = [i for i, x in enumerate(vs) if x not in vs[:i]]
        vs = [vs[i] for i in keep]
        if len(vs) < 3:
            return None
        try:
            face = self.bm.faces.new(vs)
        except ValueError:
            return None
        self.ref[face] = ref
        self.fmat[face] = self.mat
        if uv:
            self.fuv[face] = {vs[j]: uv[i] for j, i in enumerate(keep)}   # per vertex: survives normal flips
        return face

    # -- rings of points (same count) bridged with quads; ref = each ring's centroid (tubes, cones, skirts)
    def band(self, rings, closed=True, caps=(None, None), refs=None, mat=None, skip=None):
        """mat(i, k) -> material name for quad k of band i (None = current); skip(i, k) -> leave that quad open."""
        rows = [[self.v(p) for p in ring] for ring in rings]
        cen = [sum(r, Vector()) / len(r) for r in rings]
        n = len(rings[0])
        seg = n if closed else n - 1
        keep = self.mat
        for i, (a, b_) in enumerate(zip(rows[:-1], rows[1:])):
            ref = refs[i] if refs else (cen[i] + cen[i + 1]) / 2
            for k in range(seg):
                if skip and skip(i, k):
                    continue
                self.mat = (mat and mat(i, k)) or keep
                self.f([a[k], a[(k + 1) % n], b_[(k + 1) % n], b_[k]], ref)
        self.mat = keep
        for cap, row, c in ((caps[0], rows[0], cen[0]), (caps[1], rows[-1], cen[-1])):
            if cap is not None:
                apex = self.v(cap)
                inner = c + (c - cap)            # a point inside, on the far side of the cap
                for k in range(seg):
                    self.f([row[k], row[(k + 1) % n], apex], inner)
        return rows

    # -- a grid over the head surface: cols of lon, each with its own lat list (same length)
    def patch(self, lons, rows_fn, off_fn, tips=None, skip=None, ref=None, wrap=False):
        """wrap: the columns go all the way round; the last column is joined back to the first (shared verts)."""
        ref = ref or HC
        grid = []
        for lon in lons:
            grid.append([self.hv(lat, lon, off_fn(lat, lon, ri)) for ri, lat in enumerate(rows_fn(lon))])
        if wrap:
            grid.append(grid[0])
            lons = list(lons) + [lons[0]]
        nrow = len(grid[0])
        for i in range(len(lons) - 1):
            for r in range(nrow - 1):
                if skip and skip(i, r):
                    continue
                self.f([grid[i][r], grid[i + 1][r], grid[i + 1][r + 1], grid[i][r + 1]], ref)
            if tips:
                t = tips(i, lons[i], lons[i + 1])
                if t:
                    lat, lon, off = t
                    tip = self.hv(lat, lon, off)
                    self.f([grid[i + 1][0], grid[i][0], tip], ref)
        return grid

    # -- hang a skirt straight down from a bottom row of verts to z_end (long hair), with flare and tips
    def skirt(self, row, z_end, nrows=2, flare=1.08, wave=0.0, tip_drop=0.0, tip_every=2, closed=False, ref=None, thick=0.0):
        """thick > 0: a closed slab, its inner face `thick` nearer the vertical axis through HC (long hair)."""
        ref = ref or HC
        n0 = self.mark()
        rings = [row]
        z0 = min(v.co.z for v in row)
        for k in range(1, nrows + 1):
            t = k / nrows
            ring = []
            for j, v0 in enumerate(row):
                d = Vector((v0.co.x - HC.x, v0.co.y - HC.y, 0))
                s = 1 + (flare - 1) * t + wave * math.sin(t * math.pi * 2 + j * 1.3) * (0.4 + 0.6 * t)
                ring.append(self.v(Vector((HC.x + d.x * s, HC.y + d.y * s, v0.co.z + (z_end - z0) * t))))
            rings.append(ring)
        n = len(row)
        seg = n if closed else n - 1
        for a, b_ in zip(rings[:-1], rings[1:]):
            for j in range(seg):
                self.f([a[j], a[(j + 1) % n], b_[(j + 1) % n], b_[j]], ref)
        if tip_drop:
            last = rings[-1]
            for j in range(0, seg, tip_every):
                p = (last[j].co + last[(j + 1) % n].co) / 2
                p.z -= tip_drop * (1.0 if (j // tip_every) % 2 == 0 else 0.6)
                self.f([last[(j + 1) % n], last[j], self.v(p)], ref)
        if thick:
            def pull(v):
                d = Vector((v.co.x - HC.x, v.co.y - HC.y, 0))
                return v.co - d.normalized() * min(thick, d.length * 0.5)
            self.thicken(self.since(n0), pull)
        return rings

    # -- smooth low-poly ellipsoid (buns, pompoms, bag bodies)
    def blob(self, c, r, segs=8, rings=5):
        c = Vector(c)
        rx, ry, rz = r if isinstance(r, (tuple, list)) else (r, r, r)
        rows = []
        for i in range(1, rings):
            la = -math.pi / 2 + math.pi * i / rings
            rows.append([self.v(c + Vector((math.cos(la) * math.cos(TAU * k / segs) * rx,
                                            math.cos(la) * math.sin(TAU * k / segs) * ry, math.sin(la) * rz)))
                         for k in range(segs)])
        bot, top = self.v(c - Vector((0, 0, rz))), self.v(c + Vector((0, 0, rz)))
        for a, b_ in zip(rows[:-1], rows[1:]):
            for k in range(segs):
                self.f([a[k], a[(k + 1) % segs], b_[(k + 1) % segs], b_[k]], c)
        for k in range(segs):
            self.f([rows[0][(k + 1) % segs], rows[0][k], bot], c)
            self.f([rows[-1][k], rows[-1][(k + 1) % segs], top], c)

    # -- tapered tube along a path (ponytails, straps, rims); end tip is a point unless tip=False
    def tube(self, path, radii, sides=6, closed_loop=False, tip=True, cap=True, up=None):
        path = [Vector(p) for p in path]
        rings = []
        n = len(path)
        for i, (p, r) in enumerate(zip(path, radii)):
            a = path[(i + 1) % n] - path[i - 1] if closed_loop else (path[min(i + 1, n - 1)] - path[max(i - 1, 0)])
            a.normalize()
            u = a.cross(up or (Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0)))).normalized()
            w = a.cross(u).normalized()
            if isinstance(r, (tuple, list)):          # elliptic section (straps, flat bands)
                pts = [p + u * math.cos(TAU * k / sides) * r[0] + w * math.sin(TAU * k / sides) * r[1] for k in range(sides)]
            else:
                pts = [p + (u * math.cos(TAU * k / sides) + w * math.sin(TAU * k / sides)) * r for k in range(sides)]
            rings.append([self.v(q) for q in pts])
        pairs = list(zip(rings, rings[1:] + ([rings[0]] if closed_loop else [])))
        for ia, (a, b_) in enumerate(pairs):
            mid = (path[ia] + path[(ia + 1) % n]) / 2
            for k in range(sides):
                self.f([a[k], a[(k + 1) % sides], b_[(k + 1) % sides], b_[k]], mid)
        if not closed_loop:
            if cap:
                c0 = self.v(path[0])
                for k in range(sides):
                    self.f([rings[0][(k + 1) % sides], rings[0][k], c0], path[0] - (path[1] - path[0]))
            if tip:
                end = self.v(path[-1] + (path[-1] - path[-2]).normalized() * radii[-1] * 1.6)
                for k in range(sides):
                    self.f([rings[-1][k], rings[-1][(k + 1) % sides], end], path[-1])
            elif cap:
                c1 = self.v(path[-1])
                for k in range(sides):
                    self.f([rings[-1][k], rings[-1][(k + 1) % sides], c1], path[-1] + (path[-1] - path[-2]))
        return rings

    # -- a small sharp spike rising from the scalp (short spiky styles)
    def spike(self, lat, lon, off, height, width=10, lean=(0, 0)):
        """A closed three-sided spike whose base sits `off` above the scalp (use INNER to root it in the hair)."""
        base = [self.v(hair_point(lat + dl, lon + dn, off)) for dl, dn in ((-width * .5, -width * .6), (-width * .5, width * .6), (width * .6, 0))]
        tip = self.v(hair_point(lat + lean[0], lon + lean[1], off + height))
        inside = (base[0].co + base[1].co + base[2].co) / 3 * 0.75 + tip.co * 0.25
        for a, b_ in ((0, 1), (1, 2), (2, 0)):
            self.f([base[a], base[b_], tip], inside)
        self.f(base, inside)

    def tris(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    def finish(self, name, rig, mats=None, sharp=40.0, grad=(0.62, 1.0), zrange=None):
        """Mesh object skinned to rig (rig=None: unskinned static mesh). mats: material name -> bpy material (defaults to bpy.data.materials).
        zrange=(lo, hi): the COLOR_0 gradient runs over these heights instead of the piece's own, so pieces that meet
        (bangs, back cap, hat tuck) shade the same where they meet."""
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.normal_update()
        for face in bm.faces:
            ref = self.ref.get(face, HC)
            if face.normal.dot(face.calc_center_median() - Vector(ref)) < 0:
                face.normal_flip()
        bm.normal_update()
        for e in bm.edges:
            if len(e.link_faces) == 2:
                a, b_ = e.link_faces
                e.smooth = math.degrees(a.normal.angle(b_.normal, 0.0)) < sharp
            else:
                e.smooth = False
        zs = [v.co.z for v in bm.verts]
        lo, hi = zrange or (min(zs), max(zs))
        col = bm.loops.layers.float_color.new("Color")
        uvl = bm.loops.layers.uv.new("UVMap") if self.fuv else None
        names = []
        for face in bm.faces:
            m = self.fmat.get(face, self.mat)
            if m not in names:
                names.append(m)
            face.material_index = names.index(m)
            face.smooth = True
            uvs = self.fuv.get(face)
            for loop in face.loops:
                s = grad[0] + (grad[1] - grad[0]) * min(1.0, max(0.0, (loop.vert.co.z - lo) / max(hi - lo, 1e-6)))
                loop[col] = (s, s, s, 1)
                if uvl:
                    loop[uvl].uv = uvs[loop.vert] if uvs else (0.5, 0.5)
        vreg = [self.vreg.get(v, self.region) for v in bm.verts]
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.color_attributes.active_color = me.color_attributes["Color"]
        me.color_attributes.render_color_index = me.color_attributes.active_color_index   # glTF "ACTIVE" = render colour
        for m in names:
            me.materials.append((mats or bpy.data.materials)[m])
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        if rig is None:                          # static prop (art/props-enemies): no skin
            return ob
        ob.parent = rig
        ob.modifiers.new("Armature", "ARMATURE").object = rig
        groups = {}
        for vi, v in enumerate(me.vertices):
            for bn, x in body.weights(vreg[vi], v.co).items():
                if x > 1e-4:
                    if bn not in groups:
                        groups[bn] = ob.vertex_groups.new(name=BONE + bn)
                    groups[bn].add([vi], x, "REPLACE")
        return ob


# ================================================================ hair caps (back hair, hat tucks)
CAP_LONS = [15 * k - 180 for k in range(24)]   # 15 deg: a flat quad over the scalp sags ~5 mm, less than the hair is thick
WINDOW = 61           # |lon| below this is the face opening: the cap is open below the hairline there
CAP_MIN = 0.8         # the thinnest cap's share of hair_vol


def seam_off(lat):
    """Offset of every cap's front edge at the hairline: all caps come down to the same height there, so bangs can
    run under any of them with a 2 mm step and no crown ledge."""
    return CAP_MIN * hair_vol(lat)


def hair_cap(bottom, vol=1.0, hem=0.009, tips=None, side=None, lons=None):
    """Closed crown cap on the scalp: the face window open below the hairline, sides and back down to bottom(lon) lat,
    outer surface on hair_vol x vol, tapering to seam_off at the front edge and to `hem` at the bottom edge (side =
    fixed offset for the rows above the hem, e.g. an undercut), underside tucked into the scalp. Rows: hem, two
    between, the hairline, 12 deg behind it (over the bang roots), two to the crown.
    tips(i, la, lb, mid_lon) -> (lat, lon, off) hangs a tuft under the hem. Returns (piece, grid, lons)."""
    pc = Piece()
    base = lons or CAP_LONS
    lons = base + [base[0]]
    n0 = pc.mark()

    def rows(lon):
        hl = hairline(lon)
        up = [hl, hl + 12, (hl + 96) / 2, 84]
        if abs(lon) < WINDOW - 2:
            return [hl - 3, hl - 2, hl - 1] + up                   # window columns: the lower three rows are skipped
        bt = bottom(lon)
        return [bt, bt + (hl - bt) / 3, bt + (hl - bt) * 2 / 3] + up

    def off(lat, lon, ri):
        v = hair_vol(lat) * vol
        if ri == 0:
            return hem
        if ri in (1, 2):
            return side if side is not None else max(v, (v + hem) / 2 + 0.002)
        if ri == 3 and abs(lon) <= 75:
            return seam_off(lat)
        return v

    def cmid(a, b_):
        return math.degrees(math.atan2(math.sin(math.radians(a)) + math.sin(math.radians(b_)),
                                       math.cos(math.radians(a)) + math.cos(math.radians(b_))))

    win = lambda i, r: max(abs(lons[i]), abs(lons[i + 1])) < WINDOW and r < 3
    grid = pc.patch(base, rows, off, skip=win, wrap=True,
                    tips=(lambda i, la, lb: None if max(abs(la), abs(lb)) < WINDOW else tips(i, la, lb, cmid(la, lb))) if tips else None)
    apex = pc.hv(90, 0, hair_vol(90) * vol)
    for i in range(len(lons) - 1):
        pc.f([grid[i][-1], grid[i + 1][-1], apex], HC)
    pc.thicken(pc.since(n0), lambda v: hair_point(*pc.sph[v], INNER))
    return pc, grid, lons


def torso_out(p):
    """Horizontal outward normal of the torso at p."""
    c = body.torso_at(p.z, 0)[0]
    d = Vector((p.x - c.x, p.y - c.y, 0))
    return d.normalized() if d.length > 1e-6 else Vector((0, -1, 0))


def strip(pc, pts, width, region="torso", out=torso_out):
    """Flat strap along surface points (single sheet, double-sided material)."""
    n = len(pts)
    L, R = [], []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        side = t.cross(out(p)).normalized() * width / 2
        L.append(p + side)
        R.append(p - side)
    pc.region = region
    inside = body.torso_at(sum((p.z for p in pts)) / n, 0)[0]
    pc.band([L, R], closed=False, refs=[inside])


def ntris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def export(ob, rig, path):
    """GLB = the 22-bone rig + this one skinned mesh (bind by bone name in three.js)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=True, export_animations=False,
        export_leaf_bone=False)


def registry():
    """(parts, part): part(id, slot, name, mats, sharp=, grad=, **meta) decorates a builder fn(pc).
    mats: material name -> ("outfit", palette index) | ("fixed", hex) | ("hair", None) | ("decal", image key).
    meta: decal=True, hides=[slots], hidesBackHair=True, variantOf=id, group=str, item=economy slug (copied to the
    catalogue; `item` = the crafted/economy item that unlocks the part, whose catalogue_ref is this part's id)."""
    parts = []

    def part(pid, slot, name, mats, sharp=50, grad=(0.8, 1.0), **meta):
        def deco(fn):
            parts.append(dict(id=pid, slot=slot, name=name, mats=mats, sharp=sharp, grad=grad, meta=meta, build=fn))
            return fn
        return deco
    return parts, part


def build_parts(parts, rig, section, subdir, images=None, max_tris=300):
    """Build, export (<subdir>/<slot>/<id>.glb) and catalogue every part; one part in the scene at a time so
    material names stay exact (M_Main, not M_Main.001)."""
    entries = []
    hair_default = PAL["hair"][PAL["ref_girl_defaults"]["hair"]]
    for spec in parts:
        mats = {}
        for name, (kind, val) in spec["mats"].items():
            if kind == "decal":
                mats[name] = material(name, image=images[val][0], clip=True)
            else:
                mats[name] = material(name, {"outfit": lambda: PAL["outfit"][val], "hair": lambda: hair_default,
                                             "fixed": lambda: val}[kind]())
        pc = Piece(region="torso", mat="M_Main")
        spec["build"](pc)
        ob = pc.finish(spec["id"], rig, mats, sharp=spec["sharp"], grad=spec["grad"])
        tris = ntris(ob)
        rel = f"{subdir}/{spec['slot']}/{spec['id']}.glb"
        export(ob, rig, os.path.join(HERE, rel))
        used = [m.name for m in ob.data.materials]
        m = spec["meta"]
        entries.append({
            "id": spec["id"], "slot": spec["slot"], "name": spec["name"], "glb": rel, "tris": tris,
            "materials": [{"name": n, "tint": "outfit", "default": v} if k == "outfit" else
                          {"name": n, "tint": "hair"} if k == "hair" else
                          {"name": n, "tint": None, "color": v} if k == "fixed" else
                          {"name": n, "decal": True, "default": images[v][1]}
                          for n, (k, v) in spec["mats"].items() if n in used],
            "decalSlot": {"material": "M_Decal", "uv": [0, 0, 1, 1], "alphaMode": "MASK"} if m.get("decal") else None,
            "hidesBackHair": m.get("hidesBackHair", False), "hides": list(m.get("hides", [])),
            **{key: m[key] for key in ("group", "variantOf", "item") if key in m},
        })
        unused = set(spec["mats"]) - set(used)
        print(f"PART {spec['id']} tris={tris}" + ("  OVER BUDGET" if tris > max_tris else "") + (f"  UNUSED {unused}" if unused else ""))
        me = ob.data
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
        for mm in mats.values():
            bpy.data.materials.remove(mm)
    update_catalog(section, entries)
    return entries


def update_catalog(section, value):
    """Replace one top-level section of art/characters/character_catalog.json (each build script owns its own)."""
    path = os.path.join(HERE, "character_catalog.json")
    cat = json.load(open(path)) if os.path.exists(path) else {}
    cat[section] = value
    json.dump(cat, open(path, "w"), indent=1)


# ================================================================ review renders
def show_vertex_colors(scene):
    """COLOR_0 multiplies the base colour in three.js; mirror that in Blender materials."""
    done = set()
    for o in scene.objects:
        if o.type != "MESH" or not o.data.color_attributes:
            continue
        for m in o.data.materials:
            if m is None or m.name in done:
                continue
            done.add(m.name)
            nt = m.node_tree
            if any(n.type == "VERTEX_COLOR" for n in nt.nodes):
                continue
            bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            vc = nt.nodes.new("ShaderNodeVertexColor")
            vc.layer_name = o.data.color_attributes[0].name
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            base_in = bs.inputs["Base Color"]
            if base_in.links:
                nt.links.new(base_in.links[0].from_socket, mul.inputs[6])
            else:
                mul.inputs[6].default_value = base_in.default_value
            nt.links.new(vc.outputs["Color"], mul.inputs[7])
            nt.links.new(mul.outputs[2], base_in)


def render_setup(scene, bg=(0.8, 0.86, 0.86, 1)):
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    try:
        scene.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    w = bpy.data.worlds.new("W")
    scene.world = w
    if w.node_tree is None:
        w.use_nodes = True
    node = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    node.inputs[0].default_value = bg
    bpy.ops.object.light_add(type="SUN")
    sun = bpy.context.object
    sun.data.energy = 3.0
    sun.data.color = (1.0, 0.95, 0.88)
    sun.rotation_euler = (math.radians(48), 0, math.radians(-40))
    return sun


def bind_glb(path, rig):
    """Import a part GLB and rebind its mesh to `rig` by bone name (what the engine does); drop the file's rig."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH" and any(md.type == "ARMATURE" for md in o.modifiers)]
    for o in meshes:
        o.parent = rig                       # parts are authored in rig space: identity local transform
        o.matrix_parent_inverse.identity()
        o.matrix_basis.identity()
        for md in o.modifiers:
            if md.type == "ARMATURE":
                md.object = rig
    for o in new:
        if o not in meshes:                  # the file's own rig and the importer's bone-shape Icosphere
            bpy.data.objects.remove(o, do_unlink=True)
    return meshes
