"""v7 head, remodeled by hand in live Blender (specs/avatar-v7.md item 1, rows 252, 254).

The v6 head was an 18 x 12 lat/lon sphere with the face painted over whatever quads fell under it. v7 keeps v6's
measured shape (every vertex sits on head_shape.head_point, the analytic surface the hair, hats and fit checks are
built against) but lays the topology out for the painted face:

  - rows and columns placed on the features: a row through the eye centres (lat EYE_LAT), a row through the mouth
    (MOUTH_LAT), columns through the eye centres (lon +-EYE_LON) and the centre line, 10 deg columns across the
    face, 16-22 deg round the back
  - each eye sits in a 4 x 2 block of the grid refilled with two concentric 12-vertex loops (ellipses in
    face-canvas space, so they are round where the paint is) and a 6-quad cap on the eye centre; the mouth in a
    2 x 2 block with two 8-vertex loops and a 4-quad cap
  - all quads except the two pole fans (crown, under the chin inside the neck), no n-gons
  - the face region (M_Face, lon +-82, lat -76..49) is UV'd by head_shape.face_chart (arc lengths over the head),
    so painted layers keep their size and shape anywhere on it; the rest is M_Skin
  - 100% weighted to mixamorig:Head, COLOR_0 = 1 (smooth skin, as v6)

Run inside Blender (live, through the MCP bridge, or headless):  exec(open(<this file>).read()); build(step)
The live session ran the steps one by one with a viewport screenshot after each (README "v7 head").
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

V7 = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else \
    "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/avatar-v7/art/characters/v7"
sys.path.insert(0, os.path.join(V7, "..", "base"))
import head_shape  # noqa: E402
from head_shape import head_point, face_chart, HC, FH, EYE_LAT, EYE_LON, MOUTH_LAT  # noqa: E402

# ---------------------------------------------------------------- grid
ROWS = [-76, -63, -52, MOUTH_LAT, -28, -20, EYE_LAT, 10, 22, 35, 49, 63, 77]     # + poles at -90 / 90
_HALF = [10, 20, EYE_LON, 40, 50, 66, 82, 98, 116, 136, 158]
COLS = sorted({0.0, 180.0} | {float(s * c) for c in _HALF for s in (1, -1)})       # -160 .. 180, 20 columns
FACE_LON, FACE_LAT = 82, (-76, 49)                                                  # M_Face region (grid cells)

# feature blocks: (centre row index, centre col value, n) -> 2n x 2 cells around that grid vertex
BLOCKS = {
    "eye_R": (ROWS.index(EYE_LAT), -EYE_LON, 2),     # the character's right eye (-X, canvas left)
    "eye_L": (ROWS.index(EYE_LAT), EYE_LON, 2),
    "mouth": (ROWS.index(MOUTH_LAT), 0.0, 1),
}
# loop radii as a share of the block's half extent in face-canvas space (outer loop, inner loop)
RING = {"eye_R": (0.78, 0.46), "eye_L": (0.78, 0.46), "mouth": (0.74, 0.42)}


def chart_inv(u, w, guess):
    """(lat, lon) whose face_chart is (u, w): Newton from a nearby guess (loops are small, it converges in a few)."""
    la, lo = guess
    for _ in range(12):
        u0, w0 = face_chart(la, lo, 16)
        if abs(u0 - u) < 1e-6 and abs(w0 - w) < 1e-6:
            break
        h = 0.05
        ua, wa = face_chart(la + h, lo, 16)
        ub, wb = face_chart(la, lo + h, 16)
        j = ((ua - u0) / h, (ub - u0) / h, (wa - w0) / h, (wb - w0) / h)     # du/dla du/dlo dw/dla dw/dlo
        det = j[0] * j[3] - j[1] * j[2]
        du, dw = u - u0, w - w0
        la += (j[3] * du - j[1] * dw) / det
        lo += (-j[2] * du + j[0] * dw) / det
    return la, lo


class Head:
    def __init__(self):
        self.bm = bmesh.new()
        self.ll = {}                      # vert -> (lat, lon)
        self.grid = {}                    # (ri, col value) -> vert
        self.face_cells = set()           # faces in the face region (M_Face)

    def v(self, lat, lon):
        vert = self.bm.verts.new(head_point(lat, lon))
        self.ll[vert] = (lat, lon)
        return vert

    def f(self, vs, face=False):
        fc = self.bm.faces.new(vs)
        if face:
            self.face_cells.add(fc)
        return fc


def in_face(lat0, lat1, lo0, lo1):
    """A grid cell (or a block) belongs to the painted face region."""
    return FACE_LAT[0] <= min(lat0, lat1) and max(lat0, lat1) <= FACE_LAT[1] and max(abs(lo0), abs(lo1)) <= FACE_LON + 1e-6


def step_grid(h):
    """1. The lat/lon grid with feature rows and columns; the three feature blocks are left open."""
    for ri, lat in enumerate(ROWS):
        for c in COLS:
            h.grid[(ri, c)] = h.v(lat, c)
    bot, top = h.v(-90, 0), h.v(90, 0)
    ring = COLS + [COLS[0]]
    skip = set()
    for name, (rc, cc, n) in BLOCKS.items():
        ci = COLS.index(cc)
        for dr in (-1, 0):
            for dc in range(-n, n):
                skip.add((rc + dr, COLS[ci + dc]))
    for ri in range(len(ROWS) - 1):
        for a, b in zip(ring[:-1], ring[1:]):
            if (ri, a) in skip:
                continue
            vs = [h.grid[(ri, a)], h.grid[(ri, b)], h.grid[(ri + 1, b)], h.grid[(ri + 1, a)]]
            h.f(vs, in_face(ROWS[ri], ROWS[ri + 1], a, b))
    for a, b in zip(ring[:-1], ring[1:]):
        h.f([h.grid[(0, b)], h.grid[(0, a)], bot])
        h.f([h.grid[(len(ROWS) - 1, a)], h.grid[(len(ROWS) - 1, b)], top])
    return h


def block_boundary(h, rc, cc, n):
    """The 4n + 4 boundary verts of a 2n x 2 block, counter-clockwise from the right-middle as seen from the front;
    plus the centre vert. Canvas: U grows with lon (to the character's left), W grows downward (lower lat)."""
    ci = COLS.index(cc)
    cs = [COLS[ci + d] for d in range(-n, n + 1)]
    order = [(rc, cs[-1])] + [(rc + 1, c) for c in reversed(cs)] + [(rc, cs[0])] + [(rc - 1, c) for c in cs]
    order = order[:-1] + [(rc - 1, cs[-1])]
    return [h.grid[k] for k in order], h.grid[(rc, cc)]


def step_loops(h):
    """2. Refill each feature block with two concentric loops round the feature centre and a 4-quad cap."""
    h.rings = {}
    for name, (rc, cc, n) in BLOCKS.items():
        bnd, centre = block_boundary(h, rc, cc, n)
        m = len(bnd)
        cu, cw = face_chart(*h.ll[centre])
        bc = [face_chart(*h.ll[v]) for v in bnd]
        rings = [bnd]
        # the block's own half extents on each side (canvas space); the jaw side of an eye block is longer than the
        # forehead side, so each ring point is sized by its own side and stays inside the block (convex quads)
        right, left = bc[0][0] - cu, cu - bc[m // 2][0]
        up, down = cw - min(w for _, w in bc), max(w for _, w in bc) - cw
        for share in RING[name]:
            ring = []
            for k in range(m):
                # an ellipse point in the direction of boundary vert k, as seen in a square block (corners at 45 deg)
                du, dw = (bc[k][0] - cu) / (right if bc[k][0] >= cu else left), (cw - bc[k][1]) / (up if bc[k][1] <= cw else down)
                ang = math.atan2(dw, du)
                eu = (right if math.cos(ang) >= 0 else left) * share
                ew = (up if math.sin(ang) >= 0 else down) * share
                u, w = cu + eu * math.cos(ang), cw - ew * math.sin(ang)
                la, lo = chart_inv(u, w, h.ll[bnd[k]])
                ring.append(h.v(la, lo))
            rings.append(ring)
        ci = COLS.index(cc)
        face = in_face(ROWS[rc - 1], ROWS[rc + 1], COLS[ci - n], COLS[ci + n])
        for a, b in zip(rings[:-1], rings[1:]):
            for k in range(m):
                h.f([a[k], a[(k + 1) % m], b[(k + 1) % m], b[k]], face)
        inner = rings[-1]
        for k in range(0, m, 2):
            h.f([inner[k], inner[k + 1], inner[(k + 2) % m], centre], face)
        h.rings[name] = rings
    return h


def step_finish(h, name="V7_Head", rig=None):
    """3. Normals out, smooth shading, M_Skin / M_Face, face-chart UVs, COLOR_0 = 1, skinned 100% to Head."""
    bm = h.bm
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        if fc.normal.dot(fc.calc_center_median() - HC) < 0:
            fc.normal_flip()
    uvl = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.float_color.new("Color")
    for fc in bm.faces:
        fc.smooth = True
        fc.material_index = 1 if fc in h.face_cells else 0
        for lp in fc.loops:
            lp[col] = (1, 1, 1, 1)
            if fc in h.face_cells:
                u, w = face_chart(*h.ll[lp.vert])
                lp[uvl].uv = (u, 1 - w)
            else:
                lp[uvl].uv = (0.02, 0.02)
    me = bpy.data.meshes.get(name) or bpy.data.meshes.new(name)
    bm.to_mesh(me)
    me.color_attributes.active_color = me.color_attributes["Color"]
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    if not me.materials:
        for m in ("M_Skin", "M_Face"):
            me.materials.append(bpy.data.materials[m])
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
    if rig is not None:
        ob.parent = rig
        if not any(md.type == "ARMATURE" for md in ob.modifiers):
            ob.modifiers.new("Armature", "ARMATURE").object = rig
        g = ob.vertex_groups.get("mixamorig:Head") or ob.vertex_groups.new(name="mixamorig:Head")
        g.add(list(range(len(me.vertices))), 1.0, "REPLACE")
    return ob


_DENSE = None


def analytic_bvh(step=1.0):
    """BVH of head_point on a 1 deg grid (its own chord sag is under 0.01 mm): the reference surface."""
    global _DENSE
    if _DENSE is None:
        from mathutils.bvhtree import BVHTree
        lats = [-90 + step * i for i in range(int(180 / step) + 1)]
        lons = [-180 + step * j for j in range(int(360 / step))]
        vs = [head_point(la, lo) for la in lats for lo in lons]
        n = len(lons)
        polys = [[i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j]
                 for i in range(len(lats) - 1) for j in range(n)]
        _DENSE = BVHTree.FromPolygons(vs, polys)
    return _DENSE


def surface_gap(p):
    """Signed distance of p from the analytic surface along the ray from HC: + outside, - inside."""
    d = (p - HC)
    loc, _, _, _ = analytic_bvh().ray_cast(HC, d.normalized(), 1.0)
    return d.length - (loc - HC).length if loc is not None else 0.0


def step_straddle(ob, k=0.5, rounds=1):
    """4. Hand pass on the shell: flat quads cut inside the curved surface (up to 7 mm on the jaw sides, as v6), so
    every vertex moves out along its ray from the head centre by k x the mean sag of its faces; the shell then
    straddles the analytic surface and the worst error halves. The neck ring and the UVs are untouched."""
    me = ob.data
    for _ in range(rounds):
        fsag = {}
        for p in me.polygons:
            c = sum((me.vertices[i].co for i in p.vertices), Vector()) / len(p.vertices)
            fsag[p.index] = surface_gap(c)
        acc = [[] for _ in me.vertices]
        for p in me.polygons:
            for i in p.vertices:
                acc[i].append(fsag[p.index])
        for v in me.vertices:
            if not acc[v.index]:
                continue
            s = sum(acc[v.index]) / len(acc[v.index])
            d = (v.co - HC).normalized()
            v.co = v.co - d * k * s
    me.update()


def deviation(ob):
    """How far the mesh departs from the analytic surface: vertex error, and the sag of edge and face midpoints
    (flat quads cut inside a curved surface) along rays from the head centre. Metres."""
    me = ob.data
    sag = []
    for p in me.polygons:
        c = sum((me.vertices[i].co for i in p.vertices), Vector()) / len(p.vertices)
        sag.append(surface_gap(c))
    for e in me.edges:
        c = (me.vertices[e.vertices[0]].co + me.vertices[e.vertices[1]].co) / 2
        sag.append(surface_gap(c))
    vg = [surface_gap(v.co) for v in me.vertices]
    allg = sorted(sag + vg)
    sag.sort()
    return {"inside_max": round(-allg[0], 4), "outside_max": round(allg[-1], 4), "abs_median": round(sorted(abs(x) for x in allg)[len(allg) // 2], 4),
            "vert_max": round(max(abs(x) for x in vg), 4), "mid_sag_median": round(-sag[len(sag) // 2], 4)}
