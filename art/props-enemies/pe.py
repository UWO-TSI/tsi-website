"""Shared helpers for the weapon, enemy and prop builders (static GLBs in the locked v6 character style).

Geometry, palette materials and surfacing come from art/characters/kit.py (Piece shapes, material(), finish():
smooth by angle + COLOR_0). This file only adds what static models need: a part with a pivot, one top-light
gradient across all parts, static GLB export, and review renders next to the v6 character.
Units are v6 rig units (the character is 1.045 tall); the engine scales everything by CHARACTER_SCALE (1.3).
"""
import bpy, json, math, os, random, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
import kit  # noqa: E402
from kit import Piece, TAU  # noqa: E402,F401

EXT = json.load(open(os.path.join(HERE, "palette_ext.json")))["colors"]
ASSETS = os.path.join(ROOT, "web", "public", "assets", "game")
CLIPS_GLB = os.path.join(ROOT, "art", "characters", "base", "v6_clips.glb")


def hexof(c):
    """'outfit:4' | 'hair:2' | 'skin:3' (shared palette) | extension name | '#rrggbb'."""
    if c.startswith("#"):
        return c
    if ":" in c:
        k, i = c.split(":")
        return kit.PAL[k][int(i)]
    return EXT[c]


def materials(spec):
    """spec: name -> colour ref | (colour ref, emission) for glow slots such as 'telegraph' | (colour ref, 0, alpha)."""
    out = {}
    for name, v in spec.items():
        col, glow, alpha = (v, 0, 1) if isinstance(v, str) else (*v, 1, 1)[:3]
        m = kit.material(name, hexof(col))
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        if glow:
            b.inputs["Emission Color"].default_value = (*kit.lin(hexof(col)), 1)
            b.inputs["Emission Strength"].default_value = glow
        if alpha < 1:
            b.inputs["Alpha"].default_value = alpha
            m.surface_render_method = "BLENDED"
        out[name] = m
    return out


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ================================================================ shapes kit.Piece lacks
def frame_of(d):
    """3x3 frame whose local z runs along direction d."""
    return Vector(d).normalized().to_track_quat("Z", "Y").to_matrix()


def lathe(pc, c, profile, n=8, axis=(0, 0, 1), phase=0.0, sx=1.0, sy=1.0, tilt=0.0, mat=None):
    """Surface of revolution: profile = [(radius, height)] along axis from c; r=0 ends become caps.
    sx/sy squash the section (x across, y ~ world up), tilt rotates it; mat(band, quad) -> material name."""
    c, f = Vector(c), frame_of(axis)
    pts = [(r, h) for r, h in profile]
    caps = [None, None]
    if pts[0][0] == 0:
        caps[0] = c + f @ Vector((0, 0, pts.pop(0)[1]))
    if pts[-1][0] == 0:
        caps[1] = c + f @ Vector((0, 0, pts.pop()[1]))
    ct, st_ = math.cos(tilt), math.sin(tilt)

    def pt(k, r, h):
        x, y = math.cos(TAU * k / n + phase) * r * sx, math.sin(TAU * k / n + phase) * r * sy
        return c + f @ Vector((x * ct - y * st_, x * st_ + y * ct, h))
    return pc.band([[pt(k, r, h) for k in range(n)] for r, h in pts], caps=tuple(caps), mat=mat)


def on_blob(c, r, x, z, side=-1):
    """Point on the ellipsoid (centre c, radii r) at world x, z, on the -Y (front) or +Y side, plus its normal."""
    c = Vector(c)
    u, w = (x - c.x) / r[0], (z - c.z) / r[2]
    y = c.y + side * r[1] * math.sqrt(max(0.0, 1 - u * u - w * w))
    p = Vector((x, y, z))
    return p, Vector(((p.x - c.x) / r[0] ** 2, (p.y - c.y) / r[1] ** 2, (p.z - c.z) / r[2] ** 2)).normalized()


def jitter(ob, amt, seed=1):
    """Deterministic vertex wobble for rock and bark (a few big uneven planes instead of a perfect ellipsoid)."""
    rnd = random.Random(seed)
    for v in ob.data.vertices:
        v.co += Vector([rnd.uniform(-amt, amt) for _ in range(3)])


def parent(child, par):
    """Keep the world pose; the GLB keeps the hierarchy (head -> eyes) for procedural animation."""
    bpy.context.view_layer.update()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def rbox(pc, c, size, ch=0.2, rot=None):
    """Chamfered box (8-sided rings, fan caps). ch = chamfer as a fraction of the smallest half-size; 0 = plain box."""
    c, (hx, hy, hz) = Vector(c), (s / 2 for s in size)
    k = min(hx, hy, hz) * ch
    R = rot or Matrix.Identity(3)
    if not ch:
        sq = [(1, -1), (1, 1), (-1, 1), (-1, -1)]
        return pc.band([[c + R @ Vector((hx * a, hy * b, z)) for a, b in sq] for z in (-hz, hz)],
                       caps=(c + R @ Vector((0, 0, -hz)), c + R @ Vector((0, 0, hz))))

    def ring(z, inset):
        ax, ay = hx - inset, hy - inset
        return [c + R @ Vector(p) for p in ((ax - k, -ay, z), (ax, -ay + k, z), (ax, ay - k, z), (ax - k, ay, z),
                                           (-ax + k, ay, z), (-ax, ay - k, z), (-ax, -ay + k, z), (-ax + k, -ay, z))]
    return pc.band([ring(-hz, k), ring(-hz + k, 0), ring(hz - k, 0), ring(hz, k)],
                   caps=(c + R @ Vector((0, 0, -hz)), c + R @ Vector((0, 0, hz))))


# ================================================================ parts, gradient, export
def part(name, mats, build, pivot=(0, 0, 0), sharp=45, first=None):
    """One named mesh node built by build(pc); origin moved to pivot (the joint the engine rotates about)."""
    pc = Piece(region="torso", mat=first or next(iter(mats)))
    build(pc)
    ob = pc.finish(name, None, mats, sharp=sharp)
    p = Vector(pivot)
    ob.data.transform(Matrix.Translation(-p))
    ob.location = p
    return ob


def regrade(objs, grad=(0.72, 1.0), axis=2):
    """One top-light COLOR_0 gradient across every part (kit.finish grades each part on its own)."""
    bpy.context.view_layer.update()
    zs = [(o.matrix_world @ v.co)[axis] for o in objs for v in o.data.vertices]
    lo, hi = min(zs), max(zs)
    for o in objs:
        me, mw = o.data, o.matrix_world
        col = me.color_attributes["Color"]
        for li, loop in enumerate(me.loops):
            s = grad[0] + (grad[1] - grad[0]) * ((mw @ me.vertices[loop.vertex_index].co)[axis] - lo) / max(hi - lo, 1e-6)
            col.data[li].color = (s, s, s, 1)


def tris(objs):
    return sum(kit.ntris(o) for o in objs)


def export(objs, rel):
    """Static GLB (no skin) of these objects under web/public/assets/game/<rel>."""
    path = os.path.join(ASSETS, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)
    return path


def clear(objs):
    """Remove built objects, meshes and materials so the next model gets exact names (body, telegraph...)."""
    for o in objs:
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)


def build_all(models, sub, only=None):
    """models: [(id, fn() -> objs, budget)]; export each to <sub>/<id>.glb; record tris/parts in catalog.json."""
    report = {}
    for mid, fn, budget in models:
        if only and mid not in only:
            continue
        objs = fn()
        n = tris(objs)
        export(objs, f"{sub}/{mid}.glb")
        report[mid] = {"glb": f"/assets/game/{sub}/{mid}.glb", "tris": n, "budget": budget,
                       "parts": {o.name: sorted({m.name for m in o.data.materials}) for o in objs}}
        print(f"MODEL {sub}/{mid} tris={n} parts={[o.name for o in objs]}" + ("  OVER BUDGET" if n > budget else ""))
        clear(objs)
    path = os.path.join(HERE, "catalog.json")
    cat = json.load(open(path)) if os.path.exists(path) else {}
    cat[sub] = {**cat.get(sub, {}), **report} if only else report
    json.dump(cat, open(path, "w"), indent=1)
    return report


# ================================================================ review renders
# Engine grip per weapon kind (web/components/game/character/Character.tsx GRIP), glTF-space Euler XYZ.
GRIP = {"melee": ((math.pi / 2, 0, 0), (0, 0, 0.5)), "bow": ((0, math.pi / 2, 0), (0, math.pi / 2, 0.3)),
        "staff": ((math.pi / 2, 0, 0), (0, 0, 2.6)), "summon": ((math.pi / 2, 0, 0), (0, 0, 2.6))}
HAND = {"melee": "R", "bow": "L", "staff": "R", "summon": "R"}
_C = Matrix.Rotation(math.pi / 2, 4, "X")          # glTF (y-up) -> Blender (z-up)


def grip_matrix(kind, in_hand):
    ax, ay, az = GRIP[kind][0 if in_hand else 1]
    m = Matrix.Rotation(ax, 4, "X") @ Matrix.Rotation(ay, 4, "Y") @ Matrix.Rotation(az, 4, "Z")   # three.js XYZ
    return _C @ m @ _C.inverted()


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    keep = [o for o in new if not o.name.startswith("Icosphere")]     # the importer's bone-shape mesh
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    return keep


def load_character():
    """The v6 body with every clip (art/characters/base/v6_clips.glb); returns (root empty, rig, sockets)."""
    objs = import_glb(CLIPS_GLB)
    rig = next(o for o in objs if o.type == "ARMATURE")
    root = bpy.data.objects.new("CharRoot", None)
    bpy.context.scene.collection.objects.link(root)
    rig.parent = root
    socks = {k: bpy.data.objects[f"Socket_{k}" if k == "Back" else f"Socket_{k}_Hand"] for k in ("R", "L", "Back")}
    return root, rig, socks


def use_action(rig, name, t=0.0):
    ad = rig.animation_data or rig.animation_data_create()
    act = bpy.data.actions[name]
    ad.action = act
    if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
        ad.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    bpy.context.scene.frame_set(round(f0 + (f1 - f0) * t))


def attach(objs, socket, kind, in_hand):
    """Hold imported weapon objects the way the engine does: socket space, GRIP rotation, scale 1 in rig space."""
    holder = bpy.data.objects.new("Held", None)
    bpy.context.scene.collection.objects.link(holder)
    holder.parent = socket
    holder.matrix_parent_inverse.identity()
    holder.matrix_basis = grip_matrix(kind, in_hand)
    for o in objs:
        if o.parent is None:
            o.parent = holder
    return holder


class Stage:
    """Ortho camera + sun + ground disc in the character sheets' look (kit.render_setup)."""

    def __init__(self, bg=(0.8, 0.86, 0.86, 1)):
        sc = self.sc = bpy.context.scene
        kit.render_setup(sc, bg)
        sc.render.film_transparent = False
        cd = bpy.data.cameras.new("Cam")
        cd.type = "ORTHO"
        self.cam = bpy.data.objects.new("Cam", cd)
        sc.collection.objects.link(self.cam)
        sc.camera = self.cam
        bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1, fill_type="NGON")
        self.ground = bpy.context.object
        gm = bpy.data.materials.new("Ground")
        next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.62, 0.72, 0.62, 1)
        self.ground.data.materials.append(gm)

    def shot(self, path, objs, elev=12, res=(360, 360), pad=1.12, ground=True):
        """Frame the world bounding box of objs from the front (-Y) at elev degrees and render."""
        kit.show_vertex_colors(self.sc)
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" and not o.hide_render and o is not self.ground for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        mid = (lo + hi) / 2
        e = math.radians(elev)
        w = hi.x - lo.x
        h = (hi.z - lo.z) * math.cos(e) + (hi.y - lo.y) * math.sin(e)
        a = res[0] / res[1]
        self.cam.data.ortho_scale = (max(w, h * a) if a >= 1 else max(h, w / a)) * pad
        d = Vector((0, -math.cos(e), math.sin(e)))
        self.cam.location = mid + d * 10
        self.cam.rotation_euler = (math.pi / 2 - e, 0, 0)
        self.cam.data.clip_end = 40
        self.ground.hide_render = not ground
        self.ground.location = (mid.x, mid.y, 0)
        self.ground.scale = (max(w, hi.y - lo.y) * 0.75 + 0.1,) * 3
        self.sc.render.resolution_x, self.sc.render.resolution_y = res
        self.sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
