"""The plaza's notice board and catch board (DefaultIslandWorld VillageLandmarks: notice, catch, the mission board after
the combat drop; SeasonalEvents' GENESIS poster board): the dump's board kept, build and texture (David, 2026-10-17,
row 314: "I like the old bulletin board, no cork, just plain, more notes on it, the subtle lighter texture and build of
the old board"), lightly retouched: the cork painted plain (a deep sage, darker than the frame, so the notes pop out), four more of
its own notes pinned on (copies of the six it has, smaller, turned a little, each with its pin), and no baked snow.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/derive_plaza_boards.py [-- review <dir>]

Writes web/public/assets/game/props/notice-board.glb and catch-board.glb from acnh/props/bulletin-board.glb
(art/props/dumpkit.py): the dump's frame, so every call site stays as it was (game units at scale 1, the origin at the
board's left end on the ground, 1.68 along +x, the notes facing +z; the back face 0.266 out, PLAZA_BOARD in
lib/game/propModels.ts). The two boards differ only in where the extra notes go.
"""
import math, os, sys
import numpy as np
import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dumpkit as D  # noqa: E402
import propkit as K  # noqa: E402
from propkit import fbm  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
CORK_PX = (0, 181, 0, 226)            # the cork's block in the 512 px texture (rows, cols; row 0 at the top)
PLAIN = "#4a5a40"                     # a deep sage, darker than the frame, so the notes stand out
FACE = (0.142, 1.508, 0.299, 1.302)   # the board's face, game x0, x1, y0, y1 (z 0.45)
# The extra notes: (which of the board's own notes to copy, by its centre; its new centre; turn; scale).
EXTRA = {
    "notice": [((0.45, 1.04), (0.84, 1.12), 0.06, 0.8), ((1.24, 0.56), (0.80, 0.45), -0.05, 0.7),
               ((0.62, 0.85), (1.38, 1.12), -0.08, 0.7), ((0.42, 0.56), (0.26, 0.80), 0.07, 0.65)],
    "catch": [((1.18, 1.04), (0.82, 1.15), -0.05, 0.75), ((0.42, 0.56), (0.83, 0.43), 0.06, 0.7),
              ((1.24, 0.56), (1.40, 0.98), 0.07, 0.7), ((0.62, 0.85), (0.24, 1.17), -0.06, 0.65)],
}

G = lambda co: Vector((co.x, co.z, -co.y))           # Blender -> game
B = lambda g: Vector((g.x, -g.z, g.y))               # game -> Blender


def plain(px):
    out = px[..., :3].copy()
    r0, r1, c0, c1 = CORK_PX
    h, w = r1 - r0, c1 - c0
    tone = 1 + 0.035 * (fbm(h, w, 3, 151, 2) - 0.5) * 2
    out[r0:r1, c0:c1] = K.arr(PLAIN)[None, None, :] * tone[..., None]
    return out


def parts_of(ob):
    """Each loose part: (face indices, game min, game max, mean uv)."""
    me = ob.data
    uvl = me.uv_layers.active.data
    out = []
    for part in D.islands(ob):
        pv = np.array([G(me.vertices[v].co) for f in part for v in me.polygons[f].vertices])
        uv = np.array([uvl[li].uv[:] for f in part for li in me.polygons[f].loop_indices])
        out.append((part, pv.min(0), pv.max(0), uv.mean(0)))
    return out


def build(kind):
    obs = D.load("props/bulletin-board.glb")
    # The snow cap is its own untextured mesh over the top: it goes.
    for o in list(obs):
        if not D.images_of([o]) and min((o.matrix_world @ v.co).z for v in o.data.vertices) > 1.49:
            obs.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
    ob = obs[0]
    imgs = D.images_of(obs)
    tex = next(iter(imgs.values()))
    D.set_pixels(tex, plain(D.pixels(tex)))
    parts = parts_of(ob)
    notes = [p for p in parts if p[3][0] > 0.7 and p[1][2] > 0.44 and (p[2][0] - p[1][0]) > 0.15 and (p[2][1] - p[1][1]) > 0.2]
    pins = [p for p in parts if p[1][2] > 0.38 and max(p[2][0] - p[1][0], p[2][1] - p[1][1]) < 0.09
            and FACE[0] < (p[1][0] + p[2][0]) / 2 < FACE[1] and FACE[2] < (p[1][1] + p[2][1]) / 2 < FACE[3] - 0.03]
    print("PLAZA parts", len(parts), "objects", len(obs), "note parts", len(notes), "pin parts", len(pins))
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    copies = []
    for k, (src, dst, turn, s) in enumerate(EXTRA[kind]):
        near = lambda p: abs((p[1][0] + p[2][0]) / 2 - src[0]) < 0.06 and abs((p[1][1] + p[2][1]) / 2 - src[1]) < 0.06
        group = [p for p in notes if near(p)]
        lo = np.min([p[1] for p in group], 0); hi = np.max([p[2] for p in group], 0)
        group += [p for p in pins if lo[0] - 0.02 < (p[1][0] + p[2][0]) / 2 < hi[0] + 0.02 and lo[1] - 0.02 < (p[1][1] + p[2][1]) / 2 < hi[1] + 0.02]
        bm.faces.ensure_lookup_table()
        faces = [bm.faces[i] for p in group for i in p[0]]
        dup = bmesh.ops.duplicate(bm, geom=faces)
        verts = [v for v in dup["geom"] if isinstance(v, bmesh.types.BMVert)]
        c = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, 0))
        cs, sn = math.cos(turn), math.sin(turn)
        for v in verts:
            g = G(v.co)
            x, y = (g.x - c.x) * s, (g.y - c.y) * s
            g2 = Vector((dst[0] + x * cs - y * sn, dst[1] + x * sn + y * cs, g.z + 0.012 + 0.006 * k))
            v.co = B(g2)
        copies.append(len(group))
    bm.to_mesh(ob.data)
    bm.free()
    print("PLAZA copies", copies)
    path = D.export(obs, f"game/props/{kind}-board.glb", fmt="WEBP")
    return obs, path


if __name__ == "__main__":
    for kind in ("notice", "catch"):
        obs, path = build(kind)
        if "review" in ARGS:
            for o in obs:
                if "Color" not in o.data.color_attributes:
                    a = o.data.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
                    for d in a.data:
                        d.color = (1, 1, 1, 1)
            K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], f"{kind}-board.png"), views=((180, 12), (215, 24), (330, 22)))
