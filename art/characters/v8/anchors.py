"""avatar v8 deliverable 3: the named anchors every hair piece declares (hair_styles.ANCHORS), measured on the built
piece and written to the catalogue for the engine (web/lib/game/character/look.ts, rig.ts).

Each placement is [px, py, pz, qx, qy, qz, qw, r, h] in glTF space (Y up, the part GLBs' space): where the anchor
sits, the rotation that takes an accessory authored in anchor space (Blender: x across, y along the hair toward its
root, z out toward the viewer; exported to glTF as x, z, -y) onto the hair, the gathered hair's radius r and how far
its surface lies toward the viewer h (both 0 on a surface anchor). The engine scales an accessory that wraps the hair
(a scrunchie) to r and lifts any other by h, so it sits on the gathered hair.
"""
import math
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from head_shape import head_point, hair_point, hair_outer, hairline, HC
import hair_styles as hs

UP = Vector((0, 0, 1))


def _out(p):
    d = p - HC
    return d.normalized()


def _frame(p, y, z, r, h=0.0):
    """(Blender-space matrix of the anchor frame, r, h)."""
    z = (z - y * z.dot(y)).normalized()
    x = y.cross(z)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = p
    return m, r, h


def to_gltf(m, r, h):
    """A Blender-space anchor frame as the catalogue's [px, py, pz, qx, qy, qz, qw, r, h] (glTF, Y up)."""
    g = lambda v: Vector((v.x, v.z, -v.y))                 # Blender -> glTF (Y up)
    x, y, z = (m.col[i].xyz for i in range(3))
    q = Matrix((g(x), g(z), -g(y))).transposed().to_quaternion()   # columns: the authored x, z, -y after export
    gp = g(m.translation)
    return [round(c, 4) for c in (gp.x, gp.y, gp.z, q.x, q.y, q.z, q.w, r, h)]


def _outer_hit(tree, d):
    t, out, o = 0.0, None, HC.copy()
    while True:
        loc, nrm, _, dist = tree.ray_cast(o, d, 0.6)
        if loc is None:
            return out
        out = (loc, nrm)
        o = loc + d * 1e-4


def _top(tree, p, z, guess):
    """How far the gathered hair's surface lies from its centre p toward the viewer (z): where an accessory that sits
    on it (a bow, a clip) goes; the seed's radius when the ray finds nothing."""
    loc, _, _, dist = tree.ray_cast(p, z, 0.08)
    return round(max(0.006, dist), 4) if loc is not None else guess


def anchors_of(pid, ob):
    """{name: [placement, ...]} for the catalogue: one built piece (mesh object in rest pose, Blender world space)."""
    return {name: [to_gltf(*pl) for pl in places] for name, places in frames_of(pid, ob).items()}


def frames_of(pid, ob):
    """{name: [(Blender-space frame matrix, r, h), ...]} for one built piece."""
    me = ob.data
    mw = ob.matrix_world
    tree = BVHTree.FromPolygons([mw @ v.co for v in me.vertices], [list(p.vertices) for p in me.polygons])
    out = {}
    for name, specs in hs.ANCHORS.get(pid, {}).items():
        places = []
        for sp in specs:
            if sp[0] == "surf":
                lat = hairline(sp[2]) - 8 if sp[1] is None else sp[1]
                d = (head_point(lat, sp[2]) - HC).normalized()
                hit = _outer_hit(tree, d)
                if hit is None or (hit[0] - HC).length - (head_point(lat, sp[2]) - HC).length > 0.12:
                    continue                                # the piece has no hair there
                p = hit[0]
                z = _out(p)
                y = UP - z * UP.dot(z)
                y = y.normalized() if y.length > 0.2 else Vector((0, 1, 0))
                places.append(_frame(p, y, z, 0.0, 0.0))
            elif sp[0] == "tie":
                _, lat, lon, off, (mo, ms, md), r = sp
                p0 = hair_point(lat, lon, off)
                hz = Vector((p0.x - HC.x, p0.y - HC.y, 0)).normalized()
                side = UP.cross(hz).normalized()
                t = (hz * mo + side * ms - UP * md).normalized()        # the way the gathered hair leaves the tie
                p = p0 + t * 0.012                                       # just past the tie, on the gathered hair
                z = _out(p)
                if abs(z.dot(t)) > 0.85:
                    z = UP
                places.append(_frame(p, -t, z, r, _top(tree, p, (z - t * z.dot(t)).normalized(), r)))
            elif sp[0] == "bun":
                _, lat, lon, r = sp
                n = _out(head_point(lat, lon))
                p = hair_point(lat, lon, hair_outer(lat) + r * 0.05)        # the knot's foot, where it meets the hair
                z = Vector((p.x - HC.x, p.y - HC.y, 0)).normalized()         # the bun's outer side, seen from around
                places.append(_frame(p, -n, z, r * 0.85, r * 0.85))
        if places:
            out[name] = places
    return out
