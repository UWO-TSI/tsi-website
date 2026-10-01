"""avatar v8: the organic, matte hair look (specs/avatar-v8.md deliverable 1, rows 264-266).

The v7 lock meshes stay the geometry (locks.sweep, now with a rounded six-sided clump section); what makes them read as
soft hair masses instead of molded toy locks is shading baked into the piece (kit.Piece.finish hooks):

  soft_normals   every vertex normal is bent toward the normal of the hair mass it belongs to (radial over the head,
                 horizontal where long hair hangs), so light falls across the whole style as one rounded mass and the
                 locks show only as soft lobes, never as facets or ridges;
  occlusion      COLOR_0 times how open each vertex is (rays against the piece itself and the head): dark where a lock
                 tucks under the next one and toward the scalp, full value on the outer surface; the under-cap (the
                 inner layer) is darker still.

The fine strands are a painted texture laid along every lock by its lock UVs (v8/strands.py, drawn by the engine's body
material). No specular anywhere (row 264).
"""
import math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import locks

SOFT = 0.72          # share of the mass normal in a hair vertex's normal
REACH = 0.03         # m: occluders farther than this do not darken a vertex
FLOOR = 0.6          # the darkest a fully enclosed vertex gets (a groove, the hair against the scalp)
GRAD = (0.8, 1.0)    # the top-light COLOR_0 gradient (v7: 0.62-1.0); the occlusion now carries most of the depth


def _dirs(n=24):
    """Cosine-weighted directions over the +z hemisphere (golden-angle spiral), the same set every bake."""
    out = []
    for i in range(n):
        r = math.sqrt((i + 0.5) / n)
        a = i * 2.399963
        out.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - r * r)))))
    return out


DIRS = _dirs()


def soft_normals(k=SOFT, own=(), k_own=0.3):
    """normals(bm) for kit.Piece.finish; vertices in `own` (curl balls) keep more of their own roundness (k_own)."""
    def fn(bm):
        out = []
        for v in bm.verts:
            m = locks._out(v.co)
            kk = k_own if v in own else k
            b = v.normal * (1 - kk) + m * kk
            out.append(b.normalized() if b.length > 1e-6 else m)
        return out
    return fn


def occlusion(head_tree=None, reach=REACH, floor=FLOOR, smooth=2):
    """shade(bm) for kit.Piece.finish: per vertex floor..1 by the share of hemisphere rays that leave within reach
    (against the piece and the head), then averaged with the neighbours `smooth` times so big low-poly faces never
    show the bake as triangles. A lock tucked under the next one and the under-cap between the locks (the inner
    layer) come out darker, the outer surface full value."""
    def fn(bm):
        trees = [BVHTree.FromBMesh(bm)] + ([head_tree] if head_tree else [])
        val = []
        for v in bm.verts:
            n = v.normal if v.normal.length > 1e-6 else (v.co - locks.HC).normalized()
            t = n.orthogonal().normalized()
            b = n.cross(t)
            o = v.co + n * 2e-4
            free = 0
            for d in DIRS:
                w = t * d.x + b * d.y + n * d.z
                if not any(tr.ray_cast(o, w, reach)[0] is not None for tr in trees):
                    free += 1
            val.append(free / len(DIRS))
        for _ in range(smooth):
            val = [(val[v.index] + sum(val[e.other_vert(v).index] for e in v.link_edges)) / (1 + len(v.link_edges)) for v in bm.verts]
        return [floor + (1 - floor) * x ** 0.8 for x in val]
    return fn
