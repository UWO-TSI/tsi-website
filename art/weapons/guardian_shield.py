"""The Guardian's shield, high-def, one per tier (design sheet "Weapon redo"; David's reference, 2026-11-04: a manga panel
of a tall dark tower shield, kept out of this public repo). Its read: a tower shield as tall as its bearer, dark plates
layered over one another with bright edges and engraved seams, blade-like plates sweeping up off both sides, a long
point at the foot and a raised cross on its face. The cross here is a sword-cross (the Guardian gave up its sword).

  Blender -b --factory-startup -P art/weapons/guardian_shield.py -- <out_dir>

Writes <out_dir>/aegis-<tier key>.glb for art/weapons/pipeline.py, which reduces each to the low-poly and checks it.
Frame as art/props-enemies/build_weapons.py: the grip at the origin (the hand socket), +Z up, the face toward -Y, rig
units. Held as today's shield (lib/game/combat/data.ts aegis grip.off; the left hand sits 0.285 above the ground in
Idle), the point stops just above the ground and the crown reaches the eyes.

How it's made: each plate is its outline extruded, sliced across so it can curve, chamfered with bright edges, then the
whole shield is curved round the arm (BEND); every part is merged into one solid mesh with exact booleans (no hidden
overlapping shells) and the seams and runes are cut in.

Materials are the Vanguard trim kit's (art/props-enemies/build_vanguard_weapons.py mats), the plates darkened toward the
reference's black: tier 1 oak plates, 2 to 5 ever darker iron; edges bright steel, gold from tier 4; the cross bright
steel; runes in the seams from tier 3 (glowing at 5); a sun-stone in the cross from tier 4. The Guardian's skins and
mastery trim recolour M_Blade, M_Iron, M_Wood, M_Brass and M_Cloth, so each appears on some tier.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props-enemies"))
import build_vanguard_weapons as vw  # noqa: E402  (the trim kit; it builds nothing on import)
import pe  # noqa: E402

OUT = (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])[0]
KEYS = vw.KEY["aegis"]                       # 1 oak, 2 iron, 3 rune, 4 gilt, 5 dawn
PLATE = {1: "#7a5434", 2: "#5a5f68", 3: "#43464e", 4: "#34363c", 5: "#2a2b30"}

CX = 0.04                                    # the centre line, a little outboard of the hand
BEND = 0.6                                   # the curve round the arm: y += BEND * (x - CX)^2
# Cuts across the plates so the curve bends them smoothly. Offset off the round numbers the outlines use: a cut through
# an outline corner leaves a bevel sliver that the exact boolean opens into a hole.
SLICES = [CX + 0.0117 + 0.025 * i for i in range(-14, 14)]
# The right half of the body outline (offset from CX, z), crown to point; the left half mirrors it.
HALF = [(0.000, 0.620), (0.045, 0.600), (0.070, 0.614), (0.095, 0.585), (0.140, 0.560), (0.175, 0.520), (0.200, 0.460),
        (0.205, 0.330), (0.192, 0.200), (0.170, 0.080), (0.150, 0.000), (0.120, -0.080), (0.085, -0.150), (0.050, -0.210),
        (0.020, -0.250), (0.000, -0.265)]
# The flares: (z at the root, length, angle up from horizontal in degrees, root half-width), top to bottom. As in the
# reference, the long blades sweep up the outer edge (+X, away from the body in the left hand); the inner edge, beside
# the body, keeps short ones.
FLARES = {1: [(0.47, 0.190, 55, 0.042), (0.32, 0.190, 45, 0.040), (0.17, 0.160, 35, 0.036)],
          -1: [(0.45, 0.130, 38, 0.034), (0.30, 0.125, 30, 0.032), (0.15, 0.105, 22, 0.028)]}


def outline(half, s=1.0, about=(CX, 0.2)):
    right = [(CX + u, z) for u, z in half]
    pts = right + [(2 * CX - x, z) for x, z in reversed(right[1:-1])]
    return [(about[0] + (x - about[0]) * s, about[1] + (z - about[1]) * s) for x, z in pts]


def cross(grow=0.0):
    """The sword-cross outline, widened by `grow` all round for its backing plate. The arms stop on the frame's flat
    face: one reaching over its bevel leaves open edges in the boolean."""
    b, a, top, arm_lo, arm_hi, foot, tip = 0.022 + grow, 0.105 + grow, 0.540 + grow, 0.412 - grow, 0.448 + grow, 0.100, 0.030 - 1.6 * grow
    return [(CX + x, z) for x, z in [(-b, top), (b, top), (b, arm_hi), (a, arm_hi), (a, arm_lo), (b, arm_lo), (b, foot), (0, tip),
                                     (-b, foot), (-b, arm_lo), (-a, arm_lo), (-a, arm_hi), (-b, arm_hi)]]


def flare(z, length, angle, w, side):
    """A tapered blade plate rooted inside the body's edge, sweeping out and up."""
    root_x = CX + side * 0.160
    d = Vector((side * math.cos(math.radians(angle)), math.sin(math.radians(angle))))
    n = Vector((-d.y, d.x))
    pts = [(-0.01, -w), (0.45, -0.85 * w), (0.80, -0.35 * w), (1.0, 0.0), (0.70, 0.45 * w), (0.30, 0.9 * w), (-0.01, w)]
    out = [Vector((root_x, z)) + d * (s * length) + n * t for s, t in pts]
    return [(p.x, p.y) for p in (out if side > 0 else list(reversed(out)))]


def mats(tier):
    extra = {"M_Iron": PLATE[tier]} if tier > 1 else {"M_Wood": PLATE[1]}
    return vw.mats(tier, "aegis", extra)


def sliced(bm):
    """Cut every face across at SLICES so the curve bends it smoothly."""
    for x in SLICES:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(x, 0, 0), plane_no=(1, 0, 0))


def finish(bm, name, mat_names, m, bevel=0.0, segments=1, edge_index=1, bend=True):
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
        b.material = edge_index if len(mat_names) > 1 else -1
        apply(ob)
    for v in ob.data.vertices if bend else ():                 # the curve round the arm
        v.co.y += BEND * (v.co.x - CX) ** 2
    return ob


def slab(name, pts, y_front, y_back, face, edge, m, bevel=0.007, segments=1):
    """A plate: the outline extruded between two depths, sliced, its edges chamfered in the edge material."""
    bm = bmesh.new()
    vf = [bm.verts.new((x, y_front, z)) for x, z in pts]
    vb = [bm.verts.new((x, y_back, z)) for x, z in pts]
    bm.faces.new(vf)
    bm.faces.new(list(reversed(vb)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((vf[i], vf[j], vb[j], vb[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sliced(bm)
    return finish(bm, name, [face, edge], m, bevel, segments)


def box(name, lo, hi, mat_name, m, rot_y=0.0, about=(0, 0, 0), bevel=0.0, slice_it=True):
    """A box from lo to hi, turned about Y (the face's normal) by rot_y round `about`. Unsliced boxes are rigid fittings
    (posts, strap): they don't follow the curve, whose twist would leave their flat faces mismatched in the booleans."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector([lo[i] + (hi[i] - lo[i]) * (v.co[i] + 0.5) for i in range(3)])
    bmesh.ops.transform(bm, matrix=Matrix.Translation(about) @ Matrix.Rotation(rot_y, 4, "Y") @ Matrix.Translation(-Vector(about)), verts=bm.verts)
    if slice_it:
        sliced(bm)
    return finish(bm, name, [mat_name], m, bevel, 2, bend=slice_it)


def bar(name, a, b, r, mat_name, m, sides=12):
    """A round bar between two points (the handle)."""
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=r, depth=(b - a).length, location=(a + b) / 2)
    ob = bpy.context.active_object
    ob.name = name
    ob.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    apply(ob, transform=True)
    ob.data.materials.append(m[mat_name])
    return ob


def gem(m):
    """The sun-stone set where the cross's arms meet (tier 4 up)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.020)
    bmesh.ops.scale(bm, vec=(1.0, 0.5, 1.0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(CX, -0.106, 0.430), verts=bm.verts)
    return finish(bm, "gem", ["M_Glow"], m)


def apply(ob, transform=False):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    if transform:
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for mod in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean(target, others, op):
    for o in others:
        mod = target.modifiers.new("b", "BOOLEAN")
        mod.operation, mod.solver, mod.object = op, "EXACT", o
        mod.material_mode = "TRANSFER"
        apply(target)
        bpy.data.objects.remove(o, do_unlink=True)


def seams(m, mat_name):
    """Engraved seams through the plates: one down the middle under the cross, and lines fanning out to the rim, so
    the face reads as forged segments."""
    y0, y1 = -0.080, -0.040          # through the middle and outer plates only, never the frame
    cuts = [box("seam", (CX - 0.004, y0, -0.27), (CX + 0.004, y1, -0.13), mat_name, m)]
    for k, (ang, z) in enumerate([(0.62, -0.03), (-0.62, -0.03), (1.10, 0.10), (-1.10, 0.10), (1.40, 0.27), (-1.40, 0.27)]):
        start = 0.09 if abs(ang) < 1 else 0.13                 # from outside the frame, so only the outer plates split
        cuts.append(box(f"g{k}", (CX - 0.004, y0, z + start), (CX + 0.004, y1, z + 0.36), mat_name, m, rot_y=ang, about=(CX, 0, z)))
    return cuts


def runes(m):
    """Rune strokes down the cross's long bar (tier 3 up)."""
    y0, y1 = -0.107, -0.099
    return [box(f"r{k}", (CX - 0.012, y0, z), (CX + 0.012, y1, z + 0.007), "M_Rune", m, slice_it=False) for k, z in enumerate((0.15, 0.21, 0.27, 0.33))]


def shield(tier):
    pe.reset()
    m = mats(tier)
    plate = "M_Wood" if tier == 1 else "M_Iron"
    edge = "M_Brass" if tier >= 4 else "M_Blade"
    # Depths (front is -Y): each layer overlaps the next by 0.007 or more and no two faces share a depth, so the exact
    # booleans meet volumes, never coincident faces (which leave non-manifold edges).
    body = slab("outer", outline(HALF), -0.052, -0.026, plate, edge, m)
    parts = [
        slab("middle", outline(HALF, 0.90), -0.072, -0.045, plate, edge, m),
        slab("frame", outline(HALF, 0.74, (CX, 0.33)), -0.088, -0.064, plate, edge, m),
        slab("cross_back", cross(0.012), -0.097, -0.081, plate, edge, m, bevel=0.005),
        slab("cross", cross(), -0.105, -0.090, "M_Blade", edge, m, bevel=0.004),
        slab("rim_back", outline(HALF, 0.86), -0.034, -0.017, plate, edge, m, bevel=0.005),
        box("brace", (CX - 0.013, -0.024, -0.20), (CX + 0.013, -0.009, 0.55), "M_Iron", m, bevel=0.003),
        box("brace2", (CX - 0.17, -0.024, 0.25), (CX + 0.17, -0.009, 0.276), "M_Iron", m, bevel=0.003),
        bar("handle", (-0.046, -0.002, 0.0), (0.046, -0.002, 0.0), 0.011, "M_Wrap" if tier == 1 else "M_Iron", m),
        box("post_l", (-0.054, -0.027, -0.013), (-0.038, 0.003, 0.013), "M_Iron", m, slice_it=False),
        box("post_r", (0.038, -0.027, -0.013), (0.054, 0.003, 0.013), "M_Iron", m, slice_it=False),
        box("strap", (-0.058, -0.025, 0.095), (0.058, 0.013, 0.132), "M_Cloth", m, bevel=0.003, slice_it=False),
    ]
    for side in (1, -1):
        for k, (z, length, angle, w) in enumerate(FLARES[side]):
            depth = 0.001 * k                                   # thin blades inside the outer plate's depth, each lower one a touch further back
            parts.append(slab(f"flare{side}{k}", flare(z, length, angle, w, side), -0.043 + depth, -0.037 + depth, plate, edge, m, bevel=0.002))
    if tier >= 4:
        parts.append(gem(m))
    boolean(body, parts, "UNION")
    hole = box("hole", (-0.048, -0.011, 0.090), (0.048, 0.009, 0.137), "M_Cloth", m, slice_it=False)
    cuts = [hole] + seams(m, "M_Rune" if tier >= 3 else plate) + (runes(m) if tier >= 3 else [])
    boolean(body, cuts, "DIFFERENCE")

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


for t in range(1, 6):
    shield(t)
