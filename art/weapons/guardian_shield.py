"""The Guardian's shield, high-def, one per tier: David's reference made 1:1 (2026-11-04: "it has to be a 1:1 3d model";
then "make the edges and corners more aggressive sharp ... ours look like lego with 5 layers while the reference has the
sloped edge and layers are sloped and connected"). The shapes are traced from his drawing by art/weapons/trace_shield.py
into art/weapons/guardian_shield_plates.py; this script sculpts them.

  Blender -b --factory-startup -P art/weapons/guardian_shield.py -- <out_dir>

Writes <out_dir>/aegis-<tier key>.glb for art/weapons/pipeline.py, which reduces each to the low-poly. Frame as art/props-enemies/build_weapons.py: the grip at the origin (the hand
socket), +Z up, the face toward -Y, rig units; held as today's shield (lib/game/combat/data.ts aegis grip.off), 1.0 tall,
the point just above the ground, as tall as its bearer like the drawing.

The face is one sculpted surface, not stacked slabs: the outline and every plate's edge and slope line are constraint
edges of one triangulation (with a grid between them), and each point stands forward by the sum of its plates' heights.
A plate rises from its edge over its slope width (the tracer's inset line) to its top, so neighbouring plates slope down
into sharp creases between them and every edge stays crisp. The body tapers to a knife edge at the outline and rises to
a spine down the middle; the blades lean, outer edge forward, taper toward the point and stack like armour lames, each
lapping over the next. A plate's slope is dark iron with a thin polished lip along its top (the bright edge material,
the drawing's edge highlights), as are the foot trough's side walls and the outline's steep rim; the cross is inlaid
in a dark groove, and under its point stands a faceted arrowhead. A flat back and a thin wall round the outline close it into one solid; the
back fittings (rim, braces, handle on posts, forearm strap) are merged on, the cross's runes cut in, then the whole is
curved round the arm once.

Materials are the Vanguard trim kit's (art/props-enemies/build_vanguard_weapons.py mats): the drawing's black plates
from tier 2 (tier 1 oak), bright steel edges and cross, gold edges from tier 4, runes on the cross from tier 3 (glowing
at 5), a sun-stone lens from tier 4. The Guardian's skins and mastery trim recolour M_Blade, M_Iron, M_Wood, M_Brass and
M_Cloth, so each appears on some tier.
"""
import math
import os
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.geometry import delaunay_2d_cdt

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "props-enemies"))
import build_vanguard_weapons as vw  # noqa: E402  (the trim kit; it builds nothing on import)
import guardian_shield_plates as P  # noqa: E402
import pe  # noqa: E402

OUT = (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])[0]
KEYS = vw.KEY["aegis"]                       # 1 oak, 2 iron, 3 rune, 4 gilt, 5 dawn
PLATE = {1: "#5e3f27", 2: "#26282c", 3: "#1a1b1f", 4: "#17181b", 5: "#141517"}

CX = 0.04                                    # the centre line (trace_shield.py CX)
BEND = 0.5                                   # the curve round the arm: y += BEND * (x - CX)^2
SLICES = [CX + 0.0117 + 0.025 * i for i in range(-10, 10)]
BACK_Y, EDGE_T = -0.020, 0.005               # the flat back; the thickness at the knife edge
SPINE = 0.026                                # the body's rise from the edge to the middle
GRID = 0.0068                                # the triangulation's point spacing between the constraint lines
EDGE_ANGLE = 50                              # degrees: faces steeper than this off the face are the bright edges
RIM = 4 / 876                                # ... within this of the outline (4 px): the point's steep spine stays dark
# By plate (name prefix): its height above what lies under it, how much its outer edge leans further forward, how much
# it tapers toward the point (0: none, 1: down to nothing at its foot; the crown rings fade out so their foot leaves no
# crease across the arches).
SPEC = {"body": (0.014, 0.0, 0.0), "crown": (0.006, 0.0, 1.0), "blade": (0.006, 0.010, 0.55), "vpanel": (0.005, 0.0, 0.0),
        "lower_v": (0.008, 0.009, 0.0), "arch": (0.009, 0.0, 0.0), "arrow": (0.020, 0.0, 0.0),
        "cross_back": (-0.006, 0.0, 0.0), "cross": (0.008, 0.0, 0.0),
        "bottom": (-0.008, 0.0, 0.0), "lens": (0.010, 0.0, 0.0), "bar": (0.005, 0.0, 0.0)}
# The blades stack like armour lames, the innermost on top: each rank down stands this much lower, so every blade's
# raised outer edge laps over the next one's foot (all at one height, their seams read as lines drawn on one surface).
BLADE_STEP = 0.0045
# The cross is inlaid: a groove (cross_back) sunk round it, the cross standing just proud of the face it's set in.


def spec(name):
    return SPEC[next(k for k in SPEC if name.startswith(k))]


def mats(tier):
    extra = {"M_Iron": PLATE[tier]} if tier > 1 else {"M_Wood": PLATE[1]}
    return vw.mats(tier, "aegis", extra)


def simplified(pts, eps):
    """Ramer-Douglas-Peucker on a closed outline (the back rim, which needn't follow every pixel)."""

    def rdp(seg):
        (ax, az), (bx, bz) = seg[0], seg[-1]
        L = math.hypot(bx - ax, bz - az) or 1e-9
        far, k = max(((abs((bz - az) * (x - ax) - (bx - ax) * (z - az)) / L, i) for i, (x, z) in enumerate(seg[1:-1], 1)), default=(0, 0))
        return rdp(seg[:k + 1])[:-1] + rdp(seg[k:]) if far > eps else [seg[0], seg[-1]]
    pts = [tuple(p) for p in pts]
    i = max(range(len(pts)), key=lambda j: math.hypot(pts[j][0] - pts[0][0], pts[j][1] - pts[0][1]))
    out = rdp(pts[:i + 1])[:-1] + rdp(pts[i:] + [pts[0]])[:-1]
    return out if len(out) >= 3 else pts


# ── the height field, in numpy over all points at once ──
def inside(pts, poly):
    """Even-odd point-in-polygon for (N, 2) points."""
    x, z = pts[:, 0:1], pts[:, 1:2]
    a, b = poly, np.roll(poly, -1, 0)
    cond = (a[:, 1] > z) != (b[:, 1] > z)
    xi = a[:, 0] + (z - a[:, 1]) * (b[:, 0] - a[:, 0]) / np.where(b[:, 1] == a[:, 1], 1e-12, b[:, 1] - a[:, 1])
    return (np.sum(cond & (x < xi), 1) % 2) == 1


def edge_distance(pts, poly):
    """Distance from each point to the polygon's boundary."""
    a, b = poly, np.roll(poly, -1, 0)
    ab = b - a
    t = np.clip(np.einsum("nmk,mk->nm", pts[:, None, :] - a[None], ab) / np.maximum(np.einsum("mk,mk->m", ab, ab), 1e-12), 0, 1)
    closest = a[None] + t[..., None] * ab[None]
    return np.min(np.linalg.norm(pts[:, None, :] - closest, axis=2), 1)


def heights(pts, plates):
    """How far each point stands forward of the knife edge: the body's rise to its spine plus every plate over it."""
    body = np.array(P.PLATES["body"]["poly"])
    bw = P.PLATES["body"]["w"]
    ind = inside(pts, body)
    d = np.where(ind, edge_distance(pts, body), 0.0)
    h = spec("body")[0] * np.clip(d / bw, 0, 1)                   # the knife edge's bevel up to the body
    half = np.maximum(np.abs(pts[:, 0] - CX) + d, 1e-6)           # roughly the half-width where the point lies
    h += SPINE * np.clip(d / half, 0, 1)                          # and the body's rise to a spine down the middle
    for name, pl in plates.items():
        poly = np.array(pl["poly"])
        height, lean, taper = spec(name)
        height += BLADE_STEP * (4 - pl.get("rank", 4)) if name.startswith("blade") else 0.0
        ind = inside(pts, poly)
        if not ind.any():
            continue
        d = np.where(ind, edge_distance(pts, poly), 0.0)
        top = np.full(len(pts), height)
        if lean:
            r = np.abs(poly[:, 0] - CX)
            top = top + lean * np.clip((np.abs(pts[:, 0] - CX) - r.min()) / max(r.max() - r.min(), 1e-6), 0, 1)
        if taper:
            zt, zb = poly[:, 1].max(), poly[:, 1].min()
            top = top * (1 - taper * np.clip((zt - pts[:, 1]) / max(zt - zb, 1e-6), 0, 1))
        h += np.where(ind, top * np.clip(d / max(pl["w"], 1e-6), 0, 1), 0.0)
    return h


def ring_of(faces):
    """The triangulation's boundary as one ordered loop of vertex indices."""
    count = {}
    for f in faces:
        for i in range(len(f)):
            e = tuple(sorted((f[i], f[(i + 1) % len(f)])))
            count[e] = count.get(e, 0) + 1
    nxt = {}
    for (a, b), n in count.items():
        if n == 1:
            nxt.setdefault(a, []).append(b)
            nxt.setdefault(b, []).append(a)
    start = next(iter(nxt))
    ring, prev = [start], None
    while True:
        cur = ring[-1]
        step = next(v for v in nxt[cur] if v != prev)
        prev = cur
        if step == start:
            return ring
        ring.append(step)


def face_mesh(m, tier, plate, edge):
    """The sculpted solid: the face triangulated with every plate line as a constraint, heights applied, a flat back
    and a wall round the outline."""
    plates = {k: v for k, v in P.PLATES.items() if k != "body"}
    loops = [P.PLATES["body"]["poly"], P.PLATES["body"]["inset"]] + [pl[k] for pl in plates.values() for k in ("poly", "inset", "lip") if k in pl]
    verts, edges = [], []
    for lp in loops:
        base = len(verts)
        verts += [Vector(p) for p in lp]
        edges += [(base + i, base + (i + 1) % len(lp)) for i in range(len(lp))]
    for pl in plates.values():                                   # a pyramid's ridges, so its creases come out straight
        for a, b in pl.get("ridges", []):
            verts += [Vector(a), Vector(b)]
            edges.append((len(verts) - 2, len(verts) - 1))
    outline = np.array(loops[0])
    lo, hi = outline.min(0), outline.max(0)
    gx, gz = np.meshgrid(np.arange(lo[0], hi[0], GRID), np.arange(lo[1], hi[1], GRID))
    grid = np.stack([gx.ravel(), gz.ravel()], 1)
    grid = grid[inside(grid, outline)]
    grid = grid[edge_distance(grid, outline) > GRID * 0.4]
    verts += [Vector(p) for p in grid]
    # points closer than 5e-5 (0.04 px) merge here: where several plate lines cross in a pixel, nearer points made
    # slivers that the pipeline's 1e-5 weld folded into non-manifold edges
    co, _, faces, *_ = delaunay_2d_cdt(verts, edges, [list(range(len(loops[0])))], 1, 5e-5)
    pts = np.array([(v.x, v.y) for v in co])
    front = BACK_Y - EDGE_T - heights(pts, plates)               # each face point's y (forward is -Y)

    bm = bmesh.new()
    fv = [bm.verts.new((p[0], y, p[1])) for p, y in zip(pts, front)]
    tris = [bm.faces.new([fv[i] for i in f]) for f in faces if len(set(f)) == 3]
    ring = ring_of(faces)
    bv = [bm.verts.new((pts[i][0], BACK_Y, pts[i][1])) for i in ring]
    walls = [bm.faces.new((fv[ring[i]], fv[ring[(i + 1) % len(ring)]], bv[(i + 1) % len(ring)], bv[i])) for i in range(len(ring))]
    back = bm.faces.new(list(reversed(bv)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    cross, lens, groove = (np.array(P.PLATES[k]["poly"]) for k in ("cross", "lens", "cross_back"))
    cent = np.array([(f.calc_center_median().x, f.calc_center_median().z) for f in tris])
    in_cross, in_lens = inside(cent, cross), inside(cent, lens)
    in_groove = inside(cent, groove) & ~in_cross                 # the groove's walls stay dark: the drawing's black outline
    # A plate's slope is dark iron, its wall in shadow, but for the polished lip along its top edge: thick overlapping
    # parts, not outlines (every steep wall bright read as lines drawn on the face). Steep faces on no plate's slope,
    # the outline's spikes and rim, stay bright.
    on_slope = np.zeros(len(tris), bool)
    on_lip = np.zeros(len(tris), bool)
    for name, pl in plates.items():
        if name in ("cross", "cross_back", "bottom", "lens") or "lip" not in pl:
            continue
        ins, inset, lip = (inside(cent, np.array(pl[k])) for k in ("poly", "inset", "lip"))
        on_slope |= ins & ~inset
        on_lip |= (lip & ~inset) if pl["lip_side"] == "top" else (ins & ~lip)
    # the foot trough's side walls are the drawing's bright bands (gentler than EDGE_ANGLE, so named here); its top
    # wall, under the V, stays dark: the drawing has no edge there, the trough opens up between the blades
    tr = P.PLATES["bottom"]
    side = np.array([abs(f.normal.x) > 0.6 * abs(f.normal.z) for f in tris])
    wall = inside(cent, np.array(tr["poly"])) & ~inside(cent, np.array(tr["inset"])) & side
    # one slot per material: below tier 4 the edge, cross and lens are all M_Blade, and repeated slots came out of the
    # merge with the back fittings renumbered (the cross on M_Cloth)
    names = [plate, edge, "M_Blade", "M_Glow" if tier >= 4 else "M_Blade"]
    slots = list(dict.fromkeys(names))
    slot = [slots.index(n) for n in names]
    steep = math.cos(math.radians(EDGE_ANGLE))
    rim = edge_distance(cent, outline) < RIM                     # the bright rim: steep faces at the outline only
    for f, c, l, w, g, sl, lp, r in zip(tris, in_cross, in_lens, wall, in_groove, on_slope, on_lip, rim):
        f.material_index = slot[2 if c else 3 if l else 0 if g else 1 if (w or lp) else 0 if sl else (1 if r and -f.normal.y < steep else 0)]
    for f in walls:
        f.material_index = slot[1]
    back.material_index = slot[0]
    me = bpy.data.meshes.new("face")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("face", me)
    bpy.context.scene.collection.objects.link(ob)
    for n in slots:
        me.materials.append(m[n])
    return ob, lambda x, z: BACK_Y - EDGE_T - heights(np.array([[x, z]]), plates)[0]


def box(name, lo, hi, mat_name, m, rot_y=0.0, about=(0, 0, 0), bevel=0.0):
    """A box from lo to hi, turned about Y by rot_y round `about`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector([lo[i] + (hi[i] - lo[i]) * (v.co[i] + 0.5) for i in range(3)])
    bmesh.ops.transform(bm, matrix=Matrix.Translation(about) @ Matrix.Rotation(rot_y, 4, "Y") @ Matrix.Translation(-Vector(about)), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(m[mat_name])
    if bevel:
        b = ob.modifiers.new("bevel", "BEVEL")
        b.width, b.segments = bevel, 2
        apply(ob)
    return ob


def slab(name, pts, depth, mat_name, m, bevel=0.0):
    """A flat plate: the outline (x, z) extruded between two depths (the back's raised rim)."""
    bm = bmesh.new()
    vf = [bm.verts.new((x, depth[0], z)) for x, z in pts]
    vb = [bm.verts.new((x, depth[1], z)) for x, z in pts]
    bm.faces.new(vf)
    bm.faces.new(list(reversed(vb)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((vf[i], vf[j], vb[j], vb[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(m[mat_name])
    if bevel:
        b = ob.modifiers.new("bevel", "BEVEL")
        b.width, b.segments, b.limit_method, b.angle_limit = bevel, 1, "ANGLE", math.radians(30)
        apply(ob)
    return ob


def bar(name, a, b, r, mat_name, m, sides=12):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=(b - a).length, location=(a + b) / 2)
    ob = bpy.context.active_object
    ob.name = name
    ob.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    apply(ob, transform=True)
    ob.data.materials.append(m[mat_name])
    return ob


def apply(ob, transform=False):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    if transform:
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for mod in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean(target, others, op):
    """All the parts in one exact boolean against a collection (a chain of one-at-a-time booleans can leave the solver
    with a configuration it resolves to nothing)."""
    coll = bpy.data.collections.new(f"{op.lower()}-parts")
    for o in others:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    mod = target.modifiers.new("b", "BOOLEAN")
    mod.operation, mod.solver, mod.operand_type, mod.collection = op, "EXACT", "COLLECTION", coll
    mod.material_mode = "TRANSFER"
    apply(target)
    for o in others:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(coll)


def curve(ob):
    """The finished solid sliced across and bent round the arm, once."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for x in SLICES:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(x, 0, 0), plane_no=(1, 0, 0))
    for v in bm.verts:
        v.co.y += BEND * (v.co.x - CX) ** 2
    bm.to_mesh(ob.data)
    bm.free()


def check_cross(ob):
    """The cross's face must come out steel (the runes aside): a slot mix-up in the merges once put it on M_Cloth."""
    cross = np.array(P.PLATES["cross"]["poly"])
    me = ob.data
    polys = [p for p in me.polygons if p.normal.y < -0.5]
    cent = np.array([(p.center.x, p.center.z) for p in polys])
    area = {}
    for p, hit in zip(polys, inside(cent, cross)):
        if hit:
            n = me.materials[p.material_index].name
            area[n] = area.get(n, 0.0) + p.area
    steel = area.get("M_Blade", 0.0) / max(sum(v for k, v in area.items() if k != "M_Rune"), 1e-12)
    if steel < 0.98:
        raise SystemExit(f"{ob.name}: the cross's face is {steel:.0%} M_Blade ({area})")


def shield(tier):
    pe.reset()
    m = mats(tier)
    plate = "M_Wood" if tier == 1 else "M_Iron"
    edge = "M_Brass" if tier >= 4 else "M_Blade"
    body, surface = face_mesh(m, tier, plate, edge)
    back = [
        slab("rim_back", simplified(P.PLATES["body"]["inset"], 0.002), (BACK_Y - 0.003, BACK_Y + 0.009), plate, m, bevel=0.003),
        box("brace", (CX - 0.012, BACK_Y - 0.004, -0.20), (CX + 0.012, BACK_Y + 0.0125, 0.60), "M_Iron", m, bevel=0.002),
        box("brace2", (CX - 0.15, BACK_Y - 0.004, 0.33), (CX + 0.15, BACK_Y + 0.0125, 0.354), "M_Iron", m, bevel=0.002),
        bar("handle", (-0.046, -0.002, 0.0), (0.046, -0.002, 0.0), 0.011, "M_Wrap" if tier == 1 else "M_Iron", m),
        box("post_l", (-0.054, -0.016, -0.013), (-0.038, 0.003, 0.013), "M_Iron", m),
        box("post_r", (0.038, -0.016, -0.013), (0.054, 0.003, 0.013), "M_Iron", m),
        box("strap", (-0.058, -0.016, 0.095), (0.058, 0.013, 0.132), "M_Cloth", m, bevel=0.003),
    ]
    boolean(body, back, "UNION")
    cuts = [box("hole", (-0.048, -0.008, 0.090), (0.048, 0.009, 0.137), "M_Cloth", m)]
    if tier >= 3:                                          # rune strokes down the cross's upright, cut into its face
        cr = np.array(P.PLATES["cross"]["poly"])
        cx, top = (cr[:, 0].min() + cr[:, 0].max()) / 2, cr[:, 1].max()
        for k in range(4):                                 # between the crossbar and the foot (the upright ends at y 428)
            z = top - 0.16 - 0.045 * k
            y = surface(cx, z + 0.0035)
            cuts.append(box(f"r{k}", (cx - 0.0035, y - 0.003, z), (cx + 0.0035, y + 0.004, z + 0.007), "M_Rune", m))
    boolean(body, cuts, "DIFFERENCE")
    curve(body)

    ob = body
    ob.name = ob.data.name = f"aegis-{KEYS[tier]}"
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-6)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(20))     # crisp: every crease and slope edge shades hard
    check_cross(ob)
    ob.data.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    pe.regrade([ob], (0.8, 1.0))
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{ob.name}.glb"), export_format="GLB", use_selection=True, export_yup=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False,
                              export_animations=False)
    print(f"SHIELD {ob.name}: {pe.tris([ob])} tris, materials {sorted(s.material.name for s in ob.material_slots if s.material)}", flush=True)


for t in (int(a) for a in (os.environ.get("TIERS") or "1 2 3 4 5").split()):
    shield(t)
