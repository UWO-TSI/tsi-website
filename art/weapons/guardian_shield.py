"""The Guardian's shield, high-def, one per tier: David's reference made 1:1 (2026-11-04: "it has to be a 1:1 3d model").
The shapes are traced from his drawing by art/weapons/trace_shield.py into art/weapons/guardian_shield_plates.py; this
script only gives them depth, edges, the curve and the trim.

  Blender -b --factory-startup -P art/weapons/guardian_shield.py -- <out_dir>
  LOD=1 Blender ... -- <out_dir>      the same design with its small detail off: the low-poly's source

Writes <out_dir>/aegis-<tier key>.glb for art/weapons/pipeline.py. With LOD=1 (no ridges, runes or bevels, outlines
simplified) it writes the source the pipeline reduces to the low-poly (--lp-from): one design and one set of traced
data, so the world copy keeps the silhouette and colours, and the 1,000-triangle budget goes on shape, not detail.
Frame as art/props-enemies/build_weapons.py: the grip at the origin (the hand socket), +Z up, the face toward -Y, rig
units. Held as today's shield (lib/game/combat/data.ts aegis grip.off; the left hand at 0.285 above the ground in Idle):
1.0 tall, the point just above the ground, the crown at the top of the head, as tall as its bearer like the drawing.

The build, front to back:
- the outline; in the crown two insets of it as the concentric arches; down each side five blades from under the side
  spikes to the centre line, stepping forward from the lowest to the uppermost;
- two gothic arch ridges round the cross's top arm and the V panel under the crossbar; the blades lean, outer edge
  forward, like overlapping feathers;
- the cross on a backing plate, its upright tapering to a long point; the lower chevron and the lens at the foot;
- the drawing's line work as thin bright ridges on the plates (trace_shield.py step 6), and rune strokes along the
  cross from tier 3;
- on the back: a raised inner rim, a brace, the handle on two posts and the forearm strap.
Every plate's edges are chamfered in the bright edge material (the drawing's white edge highlights). The parts are
merged flat with exact booleans into one closed solid (depths staggered so no two faces coincide: coincident faces leave
non-manifold edges), then the solid is sliced and curved round the arm (BEND) once.

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
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "props-enemies"))
import build_vanguard_weapons as vw  # noqa: E402  (the trim kit; it builds nothing on import)
import guardian_shield_plates as P  # noqa: E402
import pe  # noqa: E402

OUT = (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])[0]
LOD = os.environ.get("LOD") == "1"
KEYS = vw.KEY["aegis"]                       # 1 oak, 2 iron, 3 rune, 4 gilt, 5 dawn
PLATE = {1: "#5e3f27", 2: "#26282c", 3: "#1a1b1f", 4: "#17181b", 5: "#141517"}

CX = 0.04                                    # the centre line (trace_shield.py CX)
BEND = 0.8                                   # the curve round the arm: y += BEND * (x - CX)^2
# Cuts across the plates so the curve bends them smoothly, off any round number (a cut through an outline corner
# leaves a bevel sliver the exact boolean opens into a hole).
SLICES = [CX + 0.0117 + 0.025 * i for i in range(-10, 10)]
# Plate depths (y, front first; the face is -Y): each front a step further forward, each back staggered inside the
# base so every plate overlaps the one beneath it and no two faces share a depth.
BASE = (-0.050, -0.020)
CROWN = [(-0.060, -0.0461), (-0.070, -0.0466)]
BLADE_FRONT = [-0.094, -0.088, -0.082, -0.076, -0.070]          # upper blades in front
BLADE_TILT = 0.010                                              # each blade's outer edge stands this much further forward
ARCH = [(-0.092, -0.0476), (-0.098, -0.0478)]
VPANEL = (-0.080, -0.0481)
CROSS_BACK, CROSS = (-0.106, -0.0486), (-0.115, -0.1005)
CHEVRON, LENS = (-0.078, -0.0491), (-0.087, -0.0496)
RIDGE_W, RIDGE_H = 0.0024, 0.0025                               # the drawing's line work: a thin bright ridge, this wide and proud


def mats(tier):
    extra = {"M_Iron": PLATE[tier]} if tier > 1 else {"M_Wood": PLATE[1]}
    return vw.mats(tier, "aegis", extra)


def curve(ob):
    """The finished solid sliced across and bent round the arm, once: slicing and bending each part before the booleans
    put their cuts on the same planes, and the exact solver chokes on the coincident edges."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for x in SLICES:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(x, 0, 0), plane_no=(1, 0, 0))
    for v in bm.verts:
        v.co.y += BEND * (v.co.x - CX) ** 2
    bm.to_mesh(ob.data)
    bm.free()


def finish(bm, name, mat_names, m, bevel=0.0, segments=1):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for n in mat_names:
        me.materials.append(m[n])
    if bevel:
        b = ob.modifiers.new("bevel", "BEVEL")
        b.width, b.segments, b.limit_method, b.angle_limit = bevel, segments, "ANGLE", math.radians(30)
        b.material = 1 if len(mat_names) > 1 else -1
        apply(ob)
    return ob


def slab(name, pts, depth, face, edge, m, bevel=0.005, tilt=0.0):
    """A plate: the outline (x, z) extruded between two depths, its edges chamfered in the edge material. `tilt` leans
    its face: the part furthest from the centre line stands that much further forward (the blades' angled facets)."""
    y_front, y_back = depth
    if LOD:                              # no bevels (the walls carry the edge material instead, below), but the lens keeps its
        pts, bevel = simplified(pts, 0.0025), (bevel if bevel <= 0.0025 else 0.0)   # 0.002: without it its corners meet a blade edge exactly
    bm = bmesh.new()
    d = [abs(x - CX) for x, _ in pts]
    lo, hi = min(d), max(d)
    vf = [bm.verts.new((x, y_front - tilt * (abs(x - CX) - lo) / max(hi - lo, 1e-6), z)) for x, z in pts]
    vb = [bm.verts.new((x, y_back, z)) for x, z in pts]
    bm.faces.new(vf)
    bm.faces.new(list(reversed(vb)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        wall = bm.faces.new((vf[i], vf[j], vb[j], vb[i]))
        if LOD and not bevel:            # the low-detail build's plate edges: its walls in the edge material (the tiers' trim,
            wall.material_index = 1      # which skins recolour) since it has no bevels to carry it
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, [face, edge], m, bevel)


def simplified(pts, eps):
    """Ramer-Douglas-Peucker on a closed outline (the low-detail build)."""
    def rdp(seg):
        (ax, az), (bx, bz) = seg[0], seg[-1]
        L = math.hypot(bx - ax, bz - az) or 1e-9
        far, k = max(((abs((bz - az) * (x - ax) - (bx - ax) * (z - az)) / L, i) for i, (x, z) in enumerate(seg[1:-1], 1)), default=(0, 0))
        return rdp(seg[:k + 1])[:-1] + rdp(seg[k:]) if far > eps else [seg[0], seg[-1]]
    i = max(range(len(pts)), key=lambda j: math.hypot(pts[j][0] - pts[0][0], pts[j][1] - pts[0][1]))
    out = rdp(list(pts[:i + 1]))[:-1] + rdp(list(pts[i:]) + [pts[0]])[:-1]
    return out if len(out) >= 3 else list(pts)


def box(name, lo, hi, mat_name, m, rot_y=0.0, about=(0, 0, 0), bevel=0.0):
    """A box from lo to hi, turned about Y by rot_y round `about`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector([lo[i] + (hi[i] - lo[i]) * (v.co[i] + 0.5) for i in range(3)])
    bmesh.ops.transform(bm, matrix=Matrix.Translation(about) @ Matrix.Rotation(rot_y, 4, "Y") @ Matrix.Translation(-Vector(about)), verts=bm.verts)
    return finish(bm, name, [mat_name], m, bevel, 2)


def bar(name, a, b, r, mat_name, m, sides=12):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=(b - a).length, location=(a + b) / 2)
    ob = bpy.context.active_object
    ob.name = name
    ob.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    apply(ob, transform=True)
    ob.data.materials.append(m[mat_name])
    return ob


def ridges(body, edge, m):
    """A ridge along each of the drawing's strokes (P.LINES), seated on whatever plate lies under it: each segment's
    depth comes from a ray cast at its ends and middle, the ridge standing RIDGE_H proud of the nearest and sunk into the
    furthest, so it never floats over a step."""
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    out = []

    def depth(x, z):
        hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))[0]
        return hit.y if hit else None

    for i, line in enumerate(P.LINES):
        for j, ((ax, az), (bx, bz)) in enumerate(zip(line, line[1:])):
            ys = [depth(ax + (bx - ax) * t, az + (bz - az) * t) for t in (0.0, 0.5, 1.0)]
            if None in ys:
                continue
            length = math.hypot(bx - ax, bz - az)
            if length < 0.004:
                continue
            ang = math.atan2(bx - ax, bz - az)
            out.append(box(f"ridge{i}_{j}", (ax - RIDGE_W / 2, min(ys) - RIDGE_H, az), (ax + RIDGE_W / 2, max(ys) + 0.002, az + length),
                           edge, m, rot_y=ang, about=(ax, 0, az)))
    return out


def apply(ob, transform=False):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    if transform:
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for mod in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean(target, others, op):
    """All the parts in one exact boolean against a collection: a chain of one-at-a-time unions can leave the solver
    with a configuration it resolves to nothing (seen here: the whole face vanished at the lens)."""
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


def shield(tier):
    pe.reset()
    m = mats(tier)
    plate = "M_Wood" if tier == 1 else "M_Iron"
    edge = "M_Brass" if tier >= 4 else "M_Blade"
    body = slab("base", P.OUTLINE, BASE, plate, edge, m)
    parts = [slab(f"crown{k}", poly, CROWN[k], plate, edge, m) for k, poly in enumerate(P.CROWN)]
    n = len(P.BLADES) // 2
    parts += [slab(f"blade{k}", poly, (BLADE_FRONT[k % n], -0.0420 - 0.0004 * k), plate, edge, m, bevel=0.004, tilt=BLADE_TILT)
              for k, poly in enumerate(P.BLADES)]
    parts += [slab(f"arch{k}", poly, ARCH[k], plate, edge, m, bevel=0.003) for k, poly in enumerate(P.ARCHES)]
    parts += [
        slab("vpanel", P.VPANEL, VPANEL, plate, edge, m),
        slab("cross_back", P.CROSS_BACK, CROSS_BACK, plate, edge, m, bevel=0.004),
        slab("cross", P.CROSS, CROSS, "M_Blade", edge, m, bevel=0.003),
        slab("chevron", P.CHEVRON, CHEVRON, plate, edge, m, bevel=0.003),
        slab("lens", P.LENS, LENS, "M_Glow" if tier >= 4 else "M_Blade", edge, m, bevel=0.002),
    ]
    boolean(body, parts, "UNION")
    if not LOD:
        boolean(body, ridges(body, edge, m), "UNION")
    back = [                                               # a second pass: in one pass with the face the solver drops them
        slab("rim_back", P.CROWN[0], (-0.0245, -0.011), plate, edge, m, bevel=0.004),
        box("brace", (CX - 0.012, -0.026, -0.20), (CX + 0.012, -0.0075, 0.60), "M_Iron", m, bevel=0.002),
        box("brace2", (CX - 0.15, -0.026, 0.33), (CX + 0.15, -0.0075, 0.354), "M_Iron", m, bevel=0.002),
        bar("handle", (-0.046, -0.002, 0.0), (0.046, -0.002, 0.0), 0.011, "M_Wrap" if tier == 1 else "M_Iron", m),
        box("post_l", (-0.054, -0.016, -0.013), (-0.038, 0.003, 0.013), "M_Iron", m),
        box("post_r", (0.038, -0.016, -0.013), (0.054, 0.003, 0.013), "M_Iron", m),
        box("strap", (-0.058, -0.016, 0.095), (0.058, 0.013, 0.132), "M_Cloth", m, bevel=0.003),
    ]
    boolean(body, back, "UNION")
    cuts = [box("hole", (-0.048, -0.008, 0.090), (0.048, 0.009, 0.137), "M_Cloth", m)]
    if tier >= 3 and not LOD:                              # rune strokes down the cross's upright
        xs = [p[0] for p in P.CROSS]
        cxs = (min(xs) + max(xs)) / 2
        zs = sorted({round(p[1], 4) for p in P.CROSS})
        top = max(zs)
        cuts += [box(f"r{k}", (cxs - 0.0035, -0.118, top - 0.30 - 0.05 * k), (cxs + 0.0035, -0.111, top - 0.293 - 0.05 * k), "M_Rune", m)
                 for k in range(4)]
    boolean(body, cuts, "DIFFERENCE")
    curve(body)

    ob = body
    ob.name = ob.data.name = f"aegis-{KEYS[tier]}"
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    ob.data.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    pe.regrade([ob], (0.8, 1.0))
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{ob.name}.glb"), export_format="GLB", use_selection=True, export_yup=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False,
                              export_animations=False)
    print(f"SHIELD {ob.name}: {pe.tris([ob])} tris, materials {sorted(s.material.name for s in ob.material_slots if s.material)}", flush=True)


for t in (int(a) for a in (os.environ.get("TIERS") or "1 2 3 4 5").split()):
    shield(t)
