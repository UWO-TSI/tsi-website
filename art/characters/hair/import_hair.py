"""Import and fit hair from an outside source to the shared skull (head fit, specs/characters/head-fit.md).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hair/import_hair.py -- [--only id,id] [--render dir]

Reads hair/source/<who>/manifest.json (default: david) and, for every hairstyle listed there (GLB, glTF, FBX, OBJ or
.blend), runs the fit pipeline:

  1. import    the file's meshes joined into one, transforms applied, coincident vertices welded (UVs are per corner,
               so they survive); the face toward -Y, Z up (mesh2glb's and our convention)
  2. register  a scale per axis (within 12% of uniform) and an offset that seat the hair's inside on the skull: rays
               from the head centre over the skull's cap (lat 18-88) meet the hair's innermost surface; the fit
               minimises the median air there, with a steep cost for any of it under the skin and for an uncovered
               crown (Nelder-Mead from a bounding-box start)
  3. conform   the cage step: a radial displacement field over the skull's directions pushes out anything under the
               skin (to CLEAR over it) and pulls in hair that stands more than SNUG off the scalp where it lies on
               the head (whole columns move, so the hair keeps its thickness), blurred so nothing tears; three rounds
  4. clean     manifest rules: a face plate dropped, cap or visor faces split into M_Cap (a fixed colour)
  5. budget    decimated (collapse, UVs kept) to LOD0_MAX triangles if over; build_lod.py makes LOD 1 afterwards
  6. maps      the source texture becomes a shading map (luminance over the median of the part it shades, bright
               glossy bands compressed: matte, row 264), plus an accent mask for two-tone styles; logos painted out;
               each map is one channel of a 512 px cell in the shared atlas hair/hair_maps.png (RGB, 4 x 2 cells, 3
               channels each), so every map hair is tinted by the palette in one shared material (no per-colour copies)
  7. export    hair/full/<id>.glb: the 22-bone rig and one mesh on mixamorig:Head (M_Hair, + M_Cap), UVs in the
               atlas; the catalogue entry (slot back, full: true, map channels, accent default, skull version)

Then: fit_check.py, build_lod.py -- <ids>, web/scripts/sync-character-assets.mjs.
"""
import bpy, bmesh, colorsys, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
for p in (ART, os.path.join(ART, "base"), os.path.join(ART, "skull")):
    sys.path.insert(0, p)
import kit  # noqa: E402
from head_shape import HC, skull_radius, hairline, hair_point, _ss  # noqa: E402
import skull as SK  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WHO = ARGS[ARGS.index("--who") + 1] if "--who" in ARGS else "david"
ONLY = set(ARGS[ARGS.index("--only") + 1].split(",")) if "--only" in ARGS else None
RENDER = ARGS[ARGS.index("--render") + 1] if "--render" in ARGS else None
SRC = os.path.join(HERE, "source", WHO)
MANIFEST = json.load(open(os.path.join(SRC, "manifest.json")))

LOD0_MAX = 1500          # the library's full looks (bangs + back) run 1,110-1,756 triangles: the full hair budget is
                         # 1,750 (specs/perf/budget.md); David's styles aim at 1,500, under-cap included
DEEP = 0.03              # geometry more than this under the skin is hidden inside the head: it neither seats nor clips
CLEAR = 0.004            # conform: the hair's inside at least this far over the skin (over the under-cap)
SNUG = 0.006             # conform: and at most this far where it lies on the head
CLEAR_FREE = 0.010       # conform: below the scalp line (the face, the cheeks, the jaw) hair keeps 1 cm off the skin
SPLIT_RESERVE = 200      # triangles kept back from the budget for the cage step's edge splits
CAP_H = 0.0025           # the matte under-cap over the scalp (the library's rule: no skin shows between the hair from any
                         # angle): the head's own faces above the scalp line, this far out
CELL, COLS, ROWS = 512, 5, 2    # 10 cells x 3 channels: 21 shading maps, 3 accent masks, 2 cap masks
CAP_COLOR = "#28282E"            # a cap's or visor's fixed colour (its mask channel; one material, never a second one)
PAD = 8                  # px of each cell kept clear round the map (mip bleed)
GAIN = 1.25              # shading maps store luminance / median / GAIN (the shader multiplies by GAIN)
ATLAS = os.path.join(HERE, "hair_maps.png")


# ================================================================ 1. import
def import_any(path):
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path, forward_axis="NEGATIVE_Y", up_axis="Z")
    elif ext == ".blend":
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = list(src.objects)
        for o in dst.objects:
            if o is not None:
                bpy.context.scene.collection.objects.link(o)
    else:
        raise ValueError(f"unsupported hair source {path}")
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o.type != "MESH":
            for m in meshes:
                if m.parent is o:
                    mw = m.matrix_world.copy()
                    m.parent = None
                    m.matrix_world = mw
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
        for md in list(m.modifiers):
            m.modifiers.remove(md)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    img = None
    for s in ob.material_slots:
        if s.material and s.material.use_nodes:
            for n in s.material.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and n.image.size[0]:
                    img = img or n.image
    return ob, img


def weld(ob):
    """Coincident vertices merged (the converter split them at every UV seam; UVs are per corner, so they survive)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


# ================================================================ 2. register
def cap_rays(step_lat=5, step_lon=10, lat0=18):
    out = []
    for la in range(lat0, 89, step_lat):
        for lo in range(-180, 180, step_lon):
            d = SK.hs.ray(la, lo)
            out.append((la, lo, d, skull_radius(d)))
    return out


RAYS = cap_rays()


def inner_gaps(tree, params, rays=RAYS):
    """Air between the skull and the hair's innermost surface on each ray (NaN: the ray misses the hair), with the
    hair scaled by (sx, sy, sz) and moved by (tx, ty, tz); rays are cast in the source's own space."""
    sx, sy, sz, tx, ty, tz = params
    S = Vector((sx, sy, sz))
    o = Vector(((HC.x - tx) / sx, (HC.y - ty) / sy, (HC.z - tz) / sz))
    out = np.full(len(rays), np.nan)
    for i, (_, _, d, r) in enumerate(rays):
        # from DEEP under the skin outward: geometry deeper inside the head is hidden and does not seat the hair
        a = HC + d * (r - DEEP)
        oa = Vector(((a.x - tx) / sx, (a.y - ty) / sy, (a.z - tz) / sz))
        dd = Vector((d.x / sx, d.y / sy, d.z / sz)).normalized()
        loc, _, _, _ = tree.ray_cast(oa, dd, 10.0)
        if loc is not None:
            p = Vector((loc.x * S.x + tx, loc.y * S.y + ty, loc.z * S.z + tz))
            out[i] = (p - HC).length - r
    return out


TOPRAY = np.array([la >= 60 for la, _, _, _ in RAYS])
# How hair scales with the head: Roblox hair is made round a head 1.2 studs wide (mesh units = studs), ours is the
# skull's width, so 1 stud = SCALE0 m. The fit may stray from it by about 10% per hair (its own cavity decides).
ROBLOX_HEAD_WIDTH = 1.2
SCALE0 = 2 * SK.SKULL["A"] / ROBLOX_HEAD_WIDTH


def cost(tree, x, base_s):
    """Seat cost: the crown uncovered (dominant), the median air over the cap, capped clipping (conform pushes it out
    afterwards, so it only steers), anisotropy and the head-width scale prior."""
    ls, ay, az, tx, ty, tz = x
    s = base_s * math.exp(ls)
    params = (s, s * math.exp(ay), s * math.exp(az), tx, ty, tz)
    g = inner_gaps(tree, params)
    near = ~np.isnan(g) & (g < 0.06)
    cover = near[TOPRAY].mean()
    if not near.any():
        return 10.0
    gh = g[near]
    clip = np.minimum(np.maximum(0.0, -gh - 0.002), 0.02)
    snug = np.median(np.maximum(gh, 0.0))
    prior = 0.004 * (math.log(s / SCALE0) / 0.1) ** 2
    return 1.0 * (1.0 - cover) + snug + 4.0 * clip.mean() + 0.02 * (ay * ay + az * az) / 0.01 + prior \
        + 2.0 * max(0.0, abs(ay) - 0.12) + 2.0 * max(0.0, abs(az) - 0.12)


def nelder_mead(f, x0, step, iters=220):
    n = len(x0)
    pts = [np.array(x0, float)] + [np.array(x0, float) + np.eye(n)[i] * step[i] for i in range(n)]
    vals = [f(p) for p in pts]
    for _ in range(iters):
        order = np.argsort(vals)
        pts, vals = [pts[i] for i in order], [vals[i] for i in order]
        c = sum(pts[:-1]) / n
        xr = c + (c - pts[-1])
        fr = f(xr)
        if fr < vals[0]:
            xe = c + 2 * (c - pts[-1])
            fe = f(xe)
            pts[-1], vals[-1] = (xe, fe) if fe < fr else (xr, fr)
        elif fr < vals[-2]:
            pts[-1], vals[-1] = xr, fr
        else:
            xc = c + 0.5 * (pts[-1] - c)
            fc = f(xc)
            if fc < vals[-1]:
                pts[-1], vals[-1] = xc, fc
            else:
                for i in range(1, n + 1):
                    pts[i] = pts[0] + 0.5 * (pts[i] - pts[0])
                    vals[i] = f(pts[i])
    i = int(np.argmin(vals))
    return pts[i], vals[i]


FACE_WIN = np.array([(-30 <= la <= 15 and abs(lo) < 35) for la, lo, _, _ in cap_rays(5, 5, -30)])
BACK_WIN = np.array([(-30 <= la <= 15 and abs(lo) > 145) for la, lo, _, _ in cap_rays(5, 5, -30)])
WIN_RAYS = cap_rays(5, 5, -30)


def facing_score(tree, params):
    """How much more the hair covers the back of the head than the face (low on the face: the front is the front)."""
    g = inner_gaps(tree, params, WIN_RAYS)
    near = ~np.isnan(g) & (g < 0.04)
    return near[BACK_WIN].mean() - near[FACE_WIN].mean()


def orient(ob, yaw=None):
    """Turn the source to face -Y: mesh converters keep the author's facing, which is not always the same. Each
    hair is seated both ways and keeps the one that leaves the face open and covers the back (or the manifest's yaw)."""
    if yaw is None:
        params0, _ = register(ob)
        tree = BVHTree.FromPolygons([v.co.copy() for v in ob.data.vertices], [list(p.vertices) for p in ob.data.polygons])
        a = facing_score(tree, params0)
        flip = [Vector((-v.co.x, -v.co.y, v.co.z)) for v in ob.data.vertices]
        tree_f = BVHTree.FromPolygons(flip, [list(p.vertices) for p in ob.data.polygons])
        rot = Matrix.Rotation(math.pi, 4, "Z")
        ob.data.transform(rot)
        params1, _ = register(ob)
        b = facing_score(tree_f, params1)
        if b > a + 0.05:
            return 180, a, b
        ob.data.transform(rot)                 # back as it was
        return 0, a, b
    if yaw:
        ob.data.transform(Matrix.Rotation(math.radians(yaw), 4, "Z"))
    return yaw, None, None


def register(ob):
    """(sx, sy, sz, tx, ty, tz) seating the hair's inside on the skull."""
    me = ob.data
    vs = np.array([v.co[:] for v in me.vertices])
    tree = BVHTree.FromPolygons([Vector(v) for v in vs], [list(p.vertices) for p in me.polygons])
    lo, hi = vs.min(0), vs.max(0)
    base_s = SCALE0
    best = None
    for ty in (-0.04, -0.02, 0.0, 0.02, 0.04):           # coarse start: the top of the hair 0-8 cm over the crown
        for dz in (0.0, 0.02, 0.04, 0.06, 0.08):
            tz = HC.z + SK.SKULL["C_TOP"] + dz - hi[2] * base_s
            x0 = [0.0, 0.0, 0.0, -(hi[0] + lo[0]) / 2 * base_s, ty - (hi[1] + lo[1]) / 2 * base_s, tz]
            c = cost(tree, x0, base_s)
            if best is None or c < best[1]:
                best = (x0, c)
    x, c = nelder_mead(lambda x: cost(tree, x, base_s), best[0], [0.05, 0.03, 0.03, 0.004, 0.01, 0.01])
    x, c = nelder_mead(lambda x: cost(tree, x, base_s), x, [0.02, 0.02, 0.02, 0.002, 0.004, 0.004])
    ls, ay, az, tx, ty, tz = x
    s = base_s * math.exp(ls)
    return (s, s * math.exp(ay), s * math.exp(az), tx, ty, tz), c


def apply_params(ob, params):
    sx, sy, sz, tx, ty, tz = params
    for v in ob.data.vertices:
        v.co = Vector((v.co.x * sx + tx, v.co.y * sy + ty, v.co.z * sz + tz))
    ob.data.update()


# ================================================================ 3. conform (the radial cage)
GLAT = np.arange(-60, 91, 3)
GLON = np.arange(-180, 180, 4)


def gdir(la, lo):
    a, b = math.radians(la), math.radians(lo)
    return Vector((math.cos(a) * math.sin(b), -math.cos(a) * math.cos(b), math.sin(a)))


def gcoords(d):
    return math.degrees(math.asin(max(-1.0, min(1.0, d.z)))), math.degrees(math.atan2(d.x, -d.y))


def on_head(la, lo):
    """Where hair lies on the head (pulled snug): above the skull's scalp line."""
    return la >= SK.scalp_line(lo) - 4


def height(p):
    d = p - HC
    return d.length - skull_radius(d.normalized()) if d.length > 1e-6 else -1.0


def conform(ob, rounds=3, pulls=True, split_budget=0):
    """The cage step. Pulls: where hair lies on the head (on_head) and its inside stands more than SNUG off the scalp,
    whole columns move in (a blurred field over the skull's directions, so the hair keeps its thickness and nothing
    tears). Pushes: every vertex of a visible island under CLEAR over the skin goes up to CLEAR, the move spread to its
    neighbours. Islands wholly inside the head are hidden: deleted (free triangles). Returns per round (deepest
    vertex under the skin before the push, worst air before the pull, hidden faces deleted)."""
    me = ob.data
    stats = []
    split = 0
    for rnd in range(rounds):
        gone = 0
        # pulls
        tree = BVHTree.FromPolygons([v.co for v in me.vertices], [list(p.vertices) for p in me.polygons])
        delta = np.zeros((len(GLAT), len(GLON)))
        wt = np.zeros_like(delta)
        worst_out = 0.0
        for i, la in enumerate(GLAT):
            for j, lo in enumerate(GLON):
                d = gdir(la, lo)
                r = skull_radius(d)
                loc, _, _, _ = tree.ray_cast(HC + d * (r - 0.004), d, 1.0)
                if loc is None:
                    continue
                g = (loc - HC).length - r
                wt[i, j] = 1.0
                if pulls and g > SNUG and g < 0.06 and on_head(la, lo):
                    k = 1.0 if g < 0.025 else max(0.0, 1.0 - (g - 0.025) / 0.035)
                    delta[i, j] = -(g - SNUG) * k
                    worst_out = max(worst_out, g)
        for _ in range(3):
            num, den = delta * wt, wt.copy()
            acc_n, acc_d = num.copy(), den.copy()
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                sn, sd = np.roll(num, (di, dj), (0, 1)), np.roll(den, (di, dj), (0, 1))
                if di == 1:
                    sn[0], sd[0] = 0, 0
                if di == -1:
                    sn[-1], sd[-1] = 0, 0
                acc_n += sn * 0.5
                acc_d += sd * 0.5
            delta = np.where(acc_d > 0, acc_n / np.maximum(acc_d, 1e-9), 0.0)
            wt = np.minimum(1.0, acc_d)
        for v in me.vertices:
            d = (v.co - HC)
            if d.length < 1e-6:
                continue
            la, lo = gcoords(d.normalized())
            fi = (min(max(la, -60.0), 90.0) + 60.0) / 3.0
            fj = ((lo + 180.0) % 360.0) / 4.0
            i0, j0 = int(min(fi, len(GLAT) - 2)), int(fj) % len(GLON)
            ti, tj = fi - i0, fj - int(fj)
            j1 = (j0 + 1) % len(GLON)
            dv = (delta[i0, j0] * (1 - ti) * (1 - tj) + delta[i0 + 1, j0] * ti * (1 - tj) + delta[i0, j1] * (1 - ti) * tj
                  + delta[i0 + 1, j1] * ti * tj)
            fade = 1.0 if la >= -40 else max(0.0, 1.0 - (-40 - la) / 30.0)    # hanging lengths below the jaw keep still
            v.co = v.co + d.normalized() * dv * fade
        # a long face whose middle cuts through the skin while its corners are out (big low-poly panels, collapse's
        # long triangles) gets its long edges split, worst first, within the triangle budget; the push brings them out
        if split_budget > 0:
            bm = bmesh.new()
            bm.from_mesh(me)
            bad = sorted((f for f in bm.faces if f.material_index != 2 and max(e.calc_length() for e in f.edges) > 0.03
                          and height(f.calc_center_median()) < -0.001), key=lambda f: height(f.calc_center_median()))
            edges = []
            for f in bad:                                   # each face's longest edge, the deepest faces first
                e = max(f.edges, key=lambda e: e.calc_length())
                if e not in edges:
                    edges.append(e)
            edges = edges[:split_budget // 2]
            if edges:
                n0 = len(bm.faces)
                bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=False)
                bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
                split_budget -= (len(bm.faces) - n0)
                split += len(edges)
            bm.to_mesh(me)
            bm.free()
            me.update()
        # pushes: per vertex, spread to the neighbours
        nbr = [[] for _ in me.vertices]
        for e in me.edges:
            a_, b_ = e.vertices
            nbr[a_].append(b_)
            nbr[b_].append(a_)
        hs = np.array([height(v.co) for v in me.vertices])
        worst_in = float(max(0.0, -hs.min())) if len(hs) else 0.0
        # pushes: above the scalp line down to DEEP (deeper is hidden inside the head, under the cap); below it (the face,
        # the ears, the jaw: where it would show) anything within 6 cm
        below = np.array([gcoords((v.co - HC).normalized())[0] < SK.scalp_line(gcoords((v.co - HC).normalized())[1]) - 2
                          if (v.co - HC).length > 1e-6 else False for v in me.vertices])
        # below the line hair hangs free of the skin by CLEAR_FREE: a card's long faces over the cheek or the jaw sag
        # between its vertices, and the extra centimetre keeps their middles out of the skin
        push = np.where(below, np.maximum(0.0, CLEAR_FREE - hs),
                        np.where(hs > -DEEP, np.maximum(0.0, CLEAR - hs), 0.0))
        # a face whose middle is still under the skin (a long card face over a curve) lifts its corners by as much,
        # so the middle comes out too: a local bulge, never a cut
        for poly in me.polygons:
            if poly.material_index == 2:
                continue
            c = sum((me.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
            hc = height(c)
            if hc < CLEAR and hc > -DEEP:
                need = CLEAR - hc
                for i in poly.vertices:
                    push[i] = max(push[i], need)
        own = push.copy()
        for _ in range(2):                  # a neighbour follows a little (no crease), never more than 1 cm beyond its own need
            push = np.array([max([push[k]] + [min(push[n] * 0.6, own[k] + 0.01) for n in nbr[k]]) for k in range(len(push))])
        for v, pv in zip(me.vertices, push):
            if pv > 0:
                d = (v.co - HC).normalized()
                v.co = v.co + d * pv
        me.update()
        if rnd == rounds - 1:                      # islands wholly hidden inside the head: free triangles
            bm = bmesh.new()
            bm.from_mesh(me)
            for isl in islands(bm):
                if all(height(v.co) < -0.002 for f in isl for v in f.verts):
                    bmesh.ops.delete(bm, geom=list(isl), context="FACES")
                    gone += len(isl)
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
            bm.to_mesh(me)
            bm.free()
            me.update()
        stats.append((round(worst_in, 4), round(worst_out, 4), gone, split))
    return stats


# ================================================================ 3b. lengths below the chin (the body's proportions)
CHIN_Z = HC.z - SK.SKULL["C_BOT"]
# Roblox bodies are longer for their heads than ours: at the head's scale (SCALE0 m per stud) the neck (~0.3 studs to
# the shoulders) maps to ours at 0.63 and the torso (2 studs to the waist) at 0.30, so shoulder-length hair ends at
# our shoulders and waist-long hair at our waist. Lengths also draw in toward the body (K_W: a Roblox torso is wider),
# then nothing stays inside the body (BODY_CLEAR over its skin).
NECK_LEN, K_NECK, K_TORSO = 0.3 * 2 * SK.SKULL["A"] / 1.2, 0.63, 0.30
K_W = 0.75
BODY_CLEAR = 0.006


def body_tree():
    """The base body's skin (no head) in rest pose, from the catalogue's clip base."""
    cat = json.load(open(os.path.join(ART, "character_catalog.json")))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ART, cat["base"]["clips_glb"]))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == "ARMATURE":
            o.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    vs, ps = [], []
    for o in new:
        if o.type == "MESH" and o.name.split(".")[0] not in ("V8_Head", "V7_Head") and o.modifiers:
            e = o.evaluated_get(dg)
            me = e.to_mesh()
            names = [m.name.split(".")[0] if m else "" for m in me.materials]
            base = len(vs)
            vs.extend(e.matrix_world @ v.co for v in me.vertices)
            ps.extend([base + i for i in p.vertices] for p in me.polygons if names and names[p.material_index] == "M_Skin")
            e.to_mesh_clear()
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    return BVHTree.FromPolygons(vs, ps)


def fit_lengths(ob, tree):
    """Below the chin: lengths shrink (neck, torso) and draw in toward the body axis (K_W), then any hair inside the body
    moves out to BODY_CLEAR over its skin. Returns (longest drop before, after, vertices moved out of the body)."""
    z0 = CHIN_Z + 0.02
    lo_before = min(v.co.z for v in ob.data.vertices)
    out = 0
    for v in ob.data.vertices:
        t = z0 - v.co.z
        if t <= 0:
            continue
        k = 1 - (1 - K_W) * _ss(0.0, 0.08, t)
        t2 = t * K_NECK if t <= NECK_LEN else NECK_LEN * K_NECK + (t - NECK_LEN) * K_TORSO
        v.co = Vector((v.co.x * k, v.co.y * k, z0 - t2))
    for v in ob.data.vertices:
        if v.co.z > z0 + 0.02:
            continue
        p, n, _, _ = tree.find_nearest(v.co)
        if p is not None and (v.co - p).dot(n) < BODY_CLEAR:
            v.co = p + n * BODY_CLEAR
            out += 1
    ob.data.update()
    return round(CHIN_Z - lo_before, 3), round(CHIN_Z - min(v.co.z for v in ob.data.vertices), 3), out


# ================================================================ 4. clean: face plates, caps
def texel(img_px, uv):
    h, w = img_px.shape[:2]
    x = min(w - 1, max(0, int(uv[0] * w)))
    y = min(h - 1, max(0, int((1 - uv[1]) * h)))
    return img_px[y, x]


def face_uv_centroid(bm, uvl, f):
    u = sum(l[uvl].uv.x for l in f.loops) / len(f.loops)
    v = sum(l[uvl].uv.y for l in f.loops) / len(f.loops)
    return u, v


def islands(bm):
    seen, out = set(), []
    for f0 in bm.faces:
        if f0 in seen:
            continue
        st, isl = [f0], []
        seen.add(f0)
        while st:
            f = st.pop()
            isl.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g not in seen:
                        seen.add(g)
                        st.append(g)
        out.append(isl)
    return out


def hsv(rgb):
    return colorsys.rgb_to_hsv(*[float(c) for c in rgb[:3]])


def cap_face(rule, px, uvc):
    r, g, b = px[:3]
    h, s, v = hsv(px)
    if rule == "flat_grey":            # a visor of flat grey (and its yellow trim) among noisy black strands
        yellow = 0.08 < h < 0.2 and s > 0.45 and v > 0.35
        return yellow or (0.12 < v < 0.32 and s < 0.3)
    if rule == "uv_not_dreads":        # the cap is everything left of the dreads' strip in the source texture
        return not (uvc[0] > 0.68 and uvc[1] < 0.67)
    return False


def clean(ob, spec, img_px):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active
    dropped = 0
    if spec.get("drop") == "face_plate" and img_px is not None:
        for isl in islands(bm):
            us = [l[uvl].uv.x for f in isl for l in f.loops]
            vs = [l[uvl].uv.y for f in isl for l in f.loops]
            if (max(us) - min(us)) * (max(vs) - min(vs)) > 0.25:   # an island spread over the whole painted face: a
                bmesh.ops.delete(bm, geom=list(isl), context="FACES")   # head shell with a face, not hair
                dropped += len(isl)
    bm.faces.index_update()
    caps = set()
    if spec.get("cap") and img_px is not None:
        for f in bm.faces:
            uvc = face_uv_centroid(bm, uvl, f)
            if cap_face(spec["cap"]["rule"], texel(img_px, uvc), uvc):
                caps.add(f.index)
    bm.to_mesh(me)
    bm.free()
    me.update()
    if caps:
        if len(me.materials) < 2:
            me.materials.append(None)
        for p in me.polygons:
            p.material_index = 1 if p.index in caps else 0
    return dropped, len(caps)


# ================================================================ 5. budget
def collapse(ob, max_tris, passes=4):
    for _ in range(passes):
        n = kit.ntris(ob)
        if n <= max_tris:
            break
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        md = ob.modifiers.new("Budget", "DECIMATE")
        md.decimate_type = "COLLAPSE"
        md.ratio = max_tris / n * 0.99
        md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="Budget")


def trim_face_window(ob):
    """A shell that wraps the whole head (#20's fade) loses what lies over the face: below the hairline in front."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = []
    for f in bm.faces:
        la, lo = gcoords((f.calc_center_median() - HC).normalized())
        if abs(lo) < 70 and la < GEO_SCALP(lo) - 2:
            bad.append(f)
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(bad)


def trim_fringe(ob, opt, step="squash"):
    """A fringe that hides the eyes from the front is cut shorter (David tunes it after): in front of the face, within
    |x| < opt["half_width"], whatever hangs below the brows is drawn up to a band opt["keep"] as long, so the eyes read
    through it. The cage step then keeps it off the skin. Returns the vertices moved."""
    lat, lon = SK.hs.chart_inv(SK.hs.FACE_ANCHORS["brow"][0], SK.hs.FACE_ANCHORS["brow"][1], (8.0, -28.0))
    brow_z = SK.hs.head_point(lat, lon).z + opt.get("raise", 0.0)
    face_y = HC.y - SK.SKULL["B_FRONT"] * 0.6
    moved = 0
    for v in (ob.data.vertices if step == "squash" else []):
        if v.co.y < face_y and abs(v.co.x - HC.x) < opt.get("half_width", 0.16) and v.co.z < brow_z and v.co.z > HC.z - 0.24:
            v.co.z = brow_z - (brow_z - v.co.z) * opt.get("keep", 0.25)
            moved += 1
    ob.data.update()
    if step == "squash":
        return moved
    # then whatever still lies across either eye, seen from the front, is cut away: rays from a small grid over each
    # painted eye (its canvas anchor) straight forward, every hair face they meet goes (open_face: from a grid over the
    # whole face, brows to mouth, for a fringe that walls the face off)
    lat_e, lon_e = SK.hs.chart_inv(1 - SK.hs.FACE_ANCHORS["eye"][0], SK.hs.FACE_ANCHORS["eye"][1], (SK.hs.EYE_LAT, SK.hs.EYE_LON))
    cut = set()
    for _ in range(6):
        me = ob.data
        tree = BVHTree.FromPolygons([v.co for v in me.vertices], [list(p.vertices) for p in me.polygons])
        hits = set()
        rays = [(lat_e + dla, side * lon_e + dlo) for side in (1, -1) for dla in (-3, 0, 3, 6) for dlo in (-5, 0, 5)]
        if opt.get("open_face"):    # the whole face from the brows to the mouth, not only the eyes
            rays += [(la, lo) for la in range(int(SK.hs.MOUTH_LAT) - 4, int(lat_e) + 7, 4) for lo in range(-36, 37, 6)]
        for la, lo in rays:
            o = SK.hs.head_point(la, lo)
            loc, _, idx, _ = tree.ray_cast(o + Vector((0, -0.001, 0)), Vector((0, -1, 0)), 0.3)
            if loc is not None:
                hits.add(idx)
        if not hits:
            break
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in hits], context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(me)
        bm.free()
        me.update()
        cut |= hits
    print("  fringe: drawn up", moved, "vertices, cut", len(cut), "faces across the eyes")
    return moved + len(cut)


def keep_in_box(ob):
    """Faces reaching outside the hair type's box from the top fit point (skull.CLEARANCE reach: what a hairstyle may
    occupy; a decimated card can leave a long sliver flung sideways) go. Returns the faces dropped."""
    top, box = SK.point("top"), SK.CLEARANCE["reach"]["hair"]

    def out(co):
        d = co - top
        return abs(d.x) > box["side"] or d.z > box["up"] or -d.z > box["down"] or -d.y > box["front"] or d.y > box["back"]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = [f for f in bm.faces if any(out(v.co) for v in f.verts)]
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(bad)


def drop_slivers(ob, length=0.15, thin=0.004):
    """Collapse leaves a few long slivers across the hair (an edge over 15 cm, under 4 mm wide): they add nothing to the
    silhouette and cut chords through the head, so they go."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = []
    for f in bm.faces:
        L = max(e.calc_length() for e in f.edges)
        if L > length and 2 * f.calc_area() / L < thin:
            bad.append(f)
    bmesh.ops.delete(bm, geom=bad, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return len(bad)


def decimate(ob, max_tris=LOD0_MAX):
    """Collapse to the budget on the welded mesh (strand cards keep their shape; collapsing them unwelded shreds them).
    Where cards meet three or more to an edge the collapse stalls: those edges are split, collapsed again, re-welded."""
    if kit.ntris(ob) <= max_tris:
        return kit.ntris(ob)
    collapse(ob, max_tris)
    if kit.ntris(ob) > max_tris:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.split_edges(bm, edges=[e for e in bm.edges if len(e.link_faces) > 2])
        bm.to_mesh(ob.data)
        bm.free()
        collapse(ob, max_tris)
        weld(ob)
    # strand-card hair is hundreds of separate islands, and collapse cannot merge across them: past that floor the
    # smallest islands (stray wisps a few millimetres across) go first, until the piece fits
    over = kit.ntris(ob) - max_tris
    if over > 0:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        isl = sorted(islands(bm), key=lambda fs: sum(f.calc_area() for f in fs))
        drop, n_isl = [], 0
        for fs in isl:
            if over <= 0 or sum(f.calc_area() for f in fs) > 1.2e-3 or n_isl >= len(isl) // 4:   # wisps and small cards
                break                                                   # only (under 12 cm2), a quarter of them at most
            n_isl += 1
            drop.extend(fs)
            over -= sum(len(f.verts) - 2 for f in fs)
        areas = sorted(sum(f.calc_area() for f in fs) for fs in isl)
        print("  islands", len(isl), "dropped", n_isl, "area quartiles cm2", [round(areas[int(q * (len(areas) - 1))] * 1e4, 1) for q in (0, .1, .25, .5)],
              "tris of the largest", max(sum(len(f.verts) - 2 for f in fs) for fs in isl))
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()
    return kit.ntris(ob)


def cap_bottom(lon):
    """The under-cap's edge: the skull's scalp line (hairline in front, nape at the back)."""
    return SK.scalp_line(lon)


def undercap(ob, head):
    """The matte under-cap (material slot 2, M_HairCap): the head's own faces above the skull's scalp line, CAP_H out
    along their normals, so it lies the same distance over the skin everywhere (a shell built on the analytic skull
    sagged under the real head's tighter corners) and no skin shows through a gap in the hair from any angle (the
    lock library's rule)."""
    me = ob.data
    hb = bmesh.new()
    hb.from_mesh(head.data)
    hb.transform(head.matrix_world)
    hb.normal_update()

    def above(f):                   # any corner over the line (less 3 deg): the cap reaches the hairline fit points
        for v in f.verts:
            la, lo = gcoords((v.co - HC).normalized())
            if la >= GEO_SCALP(lo) - 3:
                return True
        return False
    keep = {f for f in hb.faces if above(f)}
    bm = bmesh.new()
    bm.from_mesh(me)
    vmap = {}
    for f in keep:
        for v in f.verts:
            if v not in vmap:
                vmap[v] = bm.verts.new(v.co + v.normal * CAP_H)
    n0 = len(bm.faces)
    for f in keep:
        nf = bm.faces.new([vmap[v] for v in f.verts])
        nf.material_index = 2
    bm.normal_update()
    for f in list(bm.faces)[n0:]:
        if f.normal.dot(f.calc_center_median() - HC) < 0:
            f.normal_flip()
    while len(me.materials) < 3:
        me.materials.append(None)
    bm.to_mesh(me)
    bm.free()
    hb.free()
    me.update()
    return sum(len(p.vertices) - 2 for p in me.polygons if p.material_index == 2)


def GEO_SCALP(lon):
    """The skull's scalp line as a geocentric latitude at geocentric lon (near enough: the two lons differ a little)."""
    d = (SK.hs.head_point(SK.scalp_line(lon), lon) - HC).normalized()
    return math.degrees(math.asin(max(-1.0, min(1.0, d.z))))


# ================================================================ 6. maps
def pixels(img):
    w, h = img.size
    a = np.array(img.pixels[:], np.float32).reshape(h, w, 4)[::-1]      # top row first, sRGB values
    return a


def to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def coverage(me, w, h):
    """Mask of texels any face of the mesh samples (UV triangles rasterised), [h, w], top row first."""
    mask = np.zeros((h, w), bool)
    uv = me.uv_layers.active.data
    me.calc_loop_triangles()
    for t in me.loop_triangles:
        P = [(uv[l].uv.x * w, (1 - uv[l].uv.y) * h) for l in t.loops]
        xs, ys = [p[0] for p in P], [p[1] for p in P]
        x0, x1 = max(0, int(min(xs))), min(w - 1, int(max(xs)) + 1)
        y0, y1 = max(0, int(min(ys))), min(h - 1, int(max(ys)) + 1)
        if x1 < x0 or y1 < y0:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1] + 0.5
        (ax, ay), (bx, by), (cx, cy) = P
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9:
            mask[int(np.clip(ay, 0, h - 1)), int(np.clip(ax, 0, w - 1))] = True
            continue
        l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
        l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
        ins = (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
        mask[y0:y1 + 1, x0:x1 + 1] |= ins
    return mask


def paint_out(px, region, logos):
    """Logos replaced by the median of the surrounding surface (plain caps and visors)."""
    h, s, v = np.vectorize(lambda r, g, b: colorsys.rgb_to_hsv(r, g, b), otypes=[float, float, float])(px[..., 0], px[..., 1], px[..., 2])
    if logos == "yellow":
        bad = (h > 0.08) & (h < 0.2) & (s > 0.45) & (v > 0.35)
    else:   # light_or_vivid: white or grey letters, and any vivid red or blue patch, on a dark cap
        bad = ((v > 0.3) & (s < 0.25)) | ((s > 0.4) & ((h < 0.03) | (h > 0.9) | ((h > 0.5) & (h < 0.72))))
    bad &= region
    keep = region & ~bad
    if bad.any() and keep.any():
        fill = np.median(px[keep][:, :3], axis=0)
        px[bad, :3] = fill
    return int(bad.sum())


def shade_map(img, me, spec):
    """(shade [h, w] in 0..1, accent mask [h, w] or None, logos painted, cap mask) from the source texture."""
    px = pixels(img).copy()
    hh, ww = px.shape[:2]
    cov = coverage(me, ww, hh)
    cap_region = np.zeros((hh, ww), bool)
    painted = 0
    if spec.get("cap") and any(p.material_index == 1 for p in me.polygons):
        tmp = me.copy()
        cap_region = coverage_only(tmp, ww, hh, 1)       # the texels the cap's faces sample
        bpy.data.meshes.remove(tmp)
        painted = paint_out(px, cap_region, spec["cap"].get("logos"))
    lin = to_lin(np.clip(px[..., :3], 0, 1))
    L = lin @ np.array([0.2126, 0.7152, 0.0722])
    hsv_s = np.max(px[..., :3], -1) - np.min(px[..., :3], -1)
    hsv_v = np.max(px[..., :3], -1)
    accent = None
    if spec.get("accent"):
        accent = np.clip((hsv_s / np.maximum(hsv_v, 1e-3) - 0.28) / 0.2, 0, 1) * np.clip((hsv_v - 0.12) / 0.12, 0, 1)
        accent[cap_region] = 0.0
    shade = np.ones((hh, ww), np.float32)
    regions = [(cov & ~cap_region, None)]
    if accent is not None:
        regions = [(cov & ~cap_region & (accent < 0.5), "base"), (cov & ~cap_region & (accent >= 0.5), "accent")]
    if cap_region.any():
        regions.append((cap_region & cov, "cap"))
    ref_all = np.median(L[cov]) if cov.any() else 1.0
    out = np.zeros((hh, ww), np.float32)
    for reg, name in regions:
        ref = np.median(L[reg]) if reg.sum() > 50 else ref_all
        r = (L / max(ref, 1e-4)) ** 0.6                           # strands kept, a near-black source's noise softened
        r = np.where(r > 1.0, 1.0 + (r - 1.0) * 0.35, r)          # glossy bands pressed down: matte
        r = np.clip(r, 0.06, GAIN)
        out = np.where(reg, r / GAIN, out)
    out = np.where(cov, out, 1.0 / GAIN)
    return out, accent, painted, (cap_region & cov) if cap_region.any() else None


def coverage_only(me, w, h, mat_index):
    """coverage() of the faces with one material index."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != mat_index], context="FACES")
    bm.to_mesh(me)
    bm.free()
    return coverage(me, w, h)


def resample(a, size):
    """Nearest-neighbour then box resample of a [h, w] map to [size, size] (maps are smooth enough)."""
    h, w = a.shape
    ys = (np.arange(size) + 0.5) * h / size
    xs = (np.arange(size) + 0.5) * w / size
    return a[ys.astype(int).clip(0, h - 1)][:, xs.astype(int).clip(0, w - 1)]


# ================================================================ 7. export
def finish(ob, rig, pid):
    """The fitted mesh as a catalogue part: one material (M_Hair, one primitive, one draw): a cap or visor is a mask
    channel in the atlas, and the under-cap (material slot 2 until now) is marked by u < 0, shaded by its COLOR_0
    (0.55, the hair's shadow) and the tint alone. Smooth by angle, 100% on the head bone."""
    me = ob.data
    hair = bpy.data.materials.get("M_Hair") or kit.material("M_Hair", kit.PAL["hair"][kit.PAL["ref_girl_defaults"]["hair"]])
    undercap = [p.material_index == 2 for p in me.polygons]
    me.materials.clear()
    me.materials.append(hair)
    if "Color" not in me.color_attributes:
        me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    col = me.color_attributes["Color"]
    uv = me.uv_layers.active.data if me.uv_layers else None
    for p, u in zip(me.polygons, undercap):
        p.use_smooth = True
        p.material_index = 0
        for li in p.loop_indices:
            c = 0.55 if u else 1.0
            col.data[li].color = (c, c, c, 1)
            if u and uv is not None:
                uv[li].uv = (-1.0, -1.0)
    me.color_attributes.active_color = col
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    ob.name = pid
    me.name = pid
    ob.parent = rig
    ob.modifiers.new("Armature", "ARMATURE").object = rig
    g = ob.vertex_groups.new(name="mixamorig:Head")
    g.add(list(range(len(me.vertices))), 1.0, "REPLACE")
    return ob


def remap_uvs(me, cell):
    cx, cy = cell % COLS, cell // COLS
    W, H = COLS * CELL, ROWS * CELL
    k = (CELL - 2 * PAD) / CELL
    for d in me.uv_layers.active.data:
        u, v = min(max(d.uv.x, 0.0), 1.0), min(max(d.uv.y, 0.0), 1.0)
        x = cx * CELL + PAD + u * CELL * k
        y_top = cy * CELL + PAD + (1 - v) * CELL * k
        d.uv = (x / W, 1 - y_top / H)


def render_check(out, objs, head):
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.render.resolution_x, sc.render.resolution_y = 360, 360
    cam = bpy.data.objects.get("FitCam") or bpy.data.objects.new("FitCam", bpy.data.cameras.new("FitCam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 0.95
    sc.camera = cam
    for ob in objs:
        for o in sc.objects:
            o.hide_render = o not in (ob, head, cam)
        for name, yaw in (("front", 0), ("34", 40), ("side", 90), ("back", 180)):
            a = math.radians(yaw)
            cam.location = HC + Vector((-math.sin(a) * 3, -math.cos(a) * 3, 0.0)) + Vector((0, 0, 0.02))
            cam.rotation_euler = (math.radians(90), 0, -a)
            sc.render.filepath = os.path.join(out, f"{ob.name}_{name}.png")
            bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = kit.load_rig(bpy.context.scene)
    with bpy.data.libraries.load(os.path.join(ART, "skull", "head.blend"), link=False) as (_s, _d):
        _d.objects = ["V8_Head"]
    head = _d.objects[0]
    bpy.context.scene.collection.objects.link(head)
    head.parent = None
    head.matrix_world = Matrix.Identity(4)           # its vertices are the skull in world space
    for md in list(head.modifiers):
        head.modifiers.remove(md)
    global BODY, HEAD, CAP_TRIS
    BODY = body_tree()
    HEAD = head
    probe = bpy.data.objects.new("cap_probe", bpy.data.meshes.new("cap_probe"))
    CAP_TRIS = undercap(probe, head)                 # the under-cap's cost, known before the budget
    bpy.data.objects.remove(probe, do_unlink=True)
    cat_path = os.path.join(ART, "character_catalog.json")
    atlas = np.ones((ROWS * CELL, COLS * CELL, 3), np.float32) / GAIN
    if os.path.exists(ATLAS):
        im = bpy.data.images.load(ATLAS)
        atlas = np.array(im.pixels[:], np.float32).reshape(ROWS * CELL, COLS * CELL, 4)[::-1][..., :3].copy()
        bpy.data.images.remove(im)
    # channel slots: 3 per cell; a two-tone hair takes two channels of one cell. Slots follow the manifest order, so
    # re-importing one hair keeps everyone's place in the atlas.
    slots, used = {}, 0
    for spec in MANIFEST["hairs"]:
        need = 1 + bool(spec.get("accent")) + bool(spec.get("cap"))
        if (used % 3) + need > 3:
            used += 3 - used % 3
        slots[spec["id"]] = (used // 3, [used % 3 + k for k in range(need)])
        used += need
    assert used <= COLS * ROWS * 3, "the hair atlas is full: add a row of cells"
    entries, report = {}, []
    built = []
    for spec in MANIFEST["hairs"]:
        pid = spec["id"]
        if ONLY and pid not in ONLY:
            continue
        ob, img = import_any(os.path.join(SRC, spec["file"]))
        src_tris = kit.ntris(ob)
        img_px = pixels(img) if img is not None else None
        has_uv = bool(ob.data.uv_layers) and img is not None and np.ptp([d.uv.x for d in ob.data.uv_layers.active.data]) > 1e-4
        capped = "crown" in (spec.get("covers") or SK.COVERS["full"])
        cap_tris = (CAP_TRIS if capped else 0) + SPLIT_RESERVE
        weld(ob)
        dropped, n_cap = clean(ob, spec, img_px if has_uv else None)
        tris = decimate(ob, LOD0_MAX - cap_tris)
        slivers = drop_slivers(ob)
        import time
        t0 = time.time()
        if spec.get("covers") == ["top"]:          # a tuft: its foot on the top fit point, sunk 3 mm, at the head scale
            yaw, fa, fb = spec.get("yaw", 0), None, None
            vs = np.array([v.co[:] for v in ob.data.vertices])
            lo, hi = vs.min(0), vs.max(0)
            foot = SK.point("top") - Vector((0, 0, 0.003))
            params = (SCALE0, SCALE0, SCALE0, foot.x - (lo[0] + hi[0]) / 2 * SCALE0, foot.y - (lo[1] + hi[1]) / 2 * SCALE0, foot.z - lo[2] * SCALE0)
            c = 0.0
            apply_params(ob, params)
        else:
            yaw, fa, fb = orient(ob, spec.get("yaw"))
            print("  time orient", round(time.time() - t0, 1))
            params, c = register(ob)
            apply_params(ob, params)
        t0 = time.time()
        trimmed = trim_face_window(ob) if spec.get("trim") == "face_window" else 0
        fringe = trim_fringe(ob, spec["fringe"], "squash") if spec.get("fringe") else 0
        stats = conform(ob) if spec.get("covers") != ["top"] else []
        lengths = fit_lengths(ob, BODY)
        if spec.get("covers") != ["top"]:
            room = LOD0_MAX - (CAP_TRIS if capped else 0) - kit.ntris(ob)
            stats += conform(ob, rounds=7, pulls=False, split_budget=room)   # what the lengths drew in goes back out
        print("  time conform", round(time.time() - t0, 1))
        # the cut comes last: the cage step pushes hair that ran through the head out in front of the face too
        fringe += trim_fringe(ob, spec["fringe"], "cut") if spec.get("fringe") else 0
        boxed = keep_in_box(ob)
        if capped:
            undercap(ob, HEAD)
        cell, chans = slots[pid]
        mapped = has_uv
        if mapped:
            shade, accent, painted, capmask = shade_map(img, ob.data, spec)
            cx, cy = cell % COLS, cell // COLS
            inner = CELL - 2 * PAD
            block = np.full((CELL, CELL), 1.0 / GAIN, np.float32)
            s_ = resample(shade, inner)
            block[PAD:PAD + inner, PAD:PAD + inner] = s_
            block[:PAD, PAD:PAD + inner] = s_[0]
            block[PAD + inner:, PAD:PAD + inner] = s_[-1]
            block[:, :PAD] = block[:, PAD:PAD + 1]
            block[:, PAD + inner:] = block[:, PAD + inner - 1:PAD + inner]
            atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL, chans[0]] = block
            if accent is not None:
                ablock = np.zeros((CELL, CELL), np.float32)
                a_ = resample(accent, inner)
                ablock[PAD:PAD + inner, PAD:PAD + inner] = a_
                atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL, chans[1]] = ablock
            if capmask is not None:                  # the cap's or visor's texels: its fixed colour (one material)
                cblock = np.zeros((CELL, CELL), np.float32)
                c_ = resample(capmask.astype(np.float32), inner)
                cblock[PAD:PAD + inner, PAD:PAD + inner] = c_
                atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL, chans[-1]] = cblock
            remap_uvs(ob.data, cell)
        else:
            painted = 0
        ob = finish(ob, rig, pid)
        rel = f"hair/full/{pid}.glb"
        kit.export(ob, rig, os.path.join(ART, rel))
        mats = [{"name": "M_Hair", "tint": "hair"}]
        acc = spec.get("accent")
        e = {"id": pid, "slot": "back", "name": spec["name"], "glb": rel, "tris": kit.ntris(ob), "materials": mats,
             "decalSlot": None, "hidesBackHair": False, "hides": [], "full": True, "skull": SK.VERSION,
             "source": f"hair/source/{WHO}/{spec['file']}",
             **({"covers": spec["covers"]} if spec.get("covers") else {}),
             **({"map": {"shade": chans[0], **({"accent": chans[1]} if acc else {}), **({"cap": chans[-1]} if spec.get("cap") else {})}} if mapped else {}),
             **({"accent": {"default": acc["default"]}} if acc and mapped else {})}
        entries[pid] = e
        report.append(f"IMPORT {pid:22s} src_tris={src_tris} tris={e['tris']} scale={tuple(round(x, 4) for x in params[:3])} "
                      f"offset={tuple(round(x, 4) for x in params[3:])} yaw={yaw} facing={fa if fa is None else round(fa, 2)}/{fb if fb is None else round(fb, 2)} cost={c:.4f} conform(in,out,hidden)={stats} dropped={dropped} "
                      f"cap_faces={n_cap} slivers={slivers} trimmed={trimmed} fringe={fringe} out_of_box={boxed} logo_texels={painted} below_chin(before,after,out_of_body)={lengths} map={'cell %d ch %s' % (cell, chans) if mapped else 'none'}")
        print(report[-1])
        built.append(ob)
        if not RENDER:
            bpy.data.objects.remove(ob, do_unlink=True)
    if RENDER:
        render_check(RENDER, built, head)
    out = (np.clip(atlas[::-1], 0, 1))
    rgba = np.concatenate([out, np.ones(out.shape[:2] + (1,), np.float32)], -1)
    im = bpy.data.images.new("hair_maps", COLS * CELL, ROWS * CELL, alpha=False, float_buffer=False)
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(rgba.reshape(-1))
    im.filepath_raw = ATLAS
    im.file_format = "PNG"
    im.save()
    cat = json.load(open(cat_path))
    cat["hair"] = [entries.get(h["id"], h) for h in cat["hair"]] + [e for k, e in entries.items() if k not in {h["id"] for h in cat["hair"]}]
    cat["hairMaps"] = {"atlas": "hair/hair_maps.png", "gain": GAIN, "cells": [COLS, ROWS], "cell": CELL, "cap": CAP_COLOR,
                       "note": "Shading maps of the full hairstyles (hair/import_hair.py): one channel per hair, its accent and "
                               "cap masks in the next channels of the same cell; luminance / median / gain. The engine "
                               "multiplies the palette tint by map x gain, mixes the accent colour and the fixed cap colour "
                               "in by their masks, and leaves u < 0 (the under-cap) to the tint (rig.ts, Character.tsx). "
                               "Every hairstyle is one primitive in one material."}
    json.dump(cat, open(cat_path, "w"), indent=1)
    print("IMPORT_HAIR_OK", len(entries))


main()
