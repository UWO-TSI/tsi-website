"""The beach parasol by the pier table (study/StudySeats.tsx; the homes' "Parasol"): the dump's own parasol and loungers,
kept as they are (the tilted umbrella, its gloss, the slatted loungers; David, 2026-10-17, row 314: "keep the old lounge
chair and the slightly tilted umbrella with the gloss texture, just tweak the old acnh dump slightly so there are colours
instead of just orange"), recoloured in vertex colour: the umbrella's eight gores in rust, cream and mustard, a cream
pole and ribs, one lounger's slats a muted teal and the other's mustard on cream frames. No texture (lane rules: plain
colour where texture adds nothing); one glossy material as before.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/derive_parasol.py [-- review <dir>]

Writes web/public/assets/game/props/beach-parasol.glb from acnh/props/beach-parasol.glb (art/props/dumpkit.py), same
geometry and frame (game units at scale 1, the pole's foot at the origin).
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dumpkit as D  # noqa: E402
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GORES = ("#d0643c", "#f2e4c4", "#dda443", "#f2e4c4")      # rust, cream, mustard, cream, round the umbrella
POLE, FRAME = "#efe5cf", "#efe5cf"
SLATS = {+1: "#6f9f9a", -1: "#dcab4c"}                     # the lounger at +z teal, at -z mustard
CANOPY_Y = 1.55


def build():
    obs = D.load("props/beach-parasol.glb")
    G = lambda co: np.array((co[0], co[2], -co[1]))          # Blender -> game
    verts = np.concatenate([[G(v.co) for v in o.data.vertices] for o in obs])
    # The umbrella's own axis: square to the canopy's best-fit plane (it leans a little), through its middle.
    canopy = verts[verts[:, 1] > CANOPY_Y]
    centre = canopy.mean(0)
    _, _, vt = np.linalg.svd(canopy - centre)
    axis = vt[2] if vt[2][1] > 0 else -vt[2]
    ref = np.cross(axis, [0, 0, 1.0]); ref /= np.linalg.norm(ref)
    ref2 = np.cross(axis, ref)
    ang = lambda p: math.atan2((p - centre) @ ref2, (p - centre) @ ref) % math.tau
    off_axis = lambda p: np.linalg.norm((p - centre) - axis * ((p - centre) @ axis))
    parts = [(o, part, np.array([G(o.data.vertices[i].co) for f in part for i in o.data.polygons[f].vertices]))
             for o in obs for part in D.islands(o)]
    # The ribs (thin spokes under the canopy) mark the gores' seams.
    seams = sorted(ang(pv.mean(0)) for _, part, pv in parts if pv[:, 1].min() > 1.8 and len(part) <= 12 and np.ptp(pv[:, 1]) > 0.15)
    print("PARASOL seams", [round(math.degrees(s)) for s in seams], "axis", axis.round(3), "objects", len(obs))
    cols = {}
    for o in obs:
        c = o.data.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
        for d in c.data:
            d.color = (*K.lin(POLE), 1.0)
        cols[o.name] = c

    def paint(o, face_ids, hexcol):
        c = (*K.lin(hexcol), 1.0)
        col = cols[o.name]
        for f in face_ids:
            for li in o.data.polygons[f].loop_indices:
                col.data[li].color = c
    for o, part, pv in parts:
        lo, hi = pv.min(0), pv.max(0)
        if hi[1] > CANOPY_Y:
            if len(part) <= 12 or hi[1] - lo[1] > 1.0 or off_axis(pv.mean(0)) < 0.06:
                paint(o, part, POLE)                          # ribs, the finial, the pole
                continue
            for f in part:                                    # the canopy: each face by the gore it lies in
                a = ang(G(o.data.polygons[f].center))
                k = sum(1 for s in seams if s <= a) % len(seams) if seams else int(a / (math.tau / 8))
                paint(o, [f], GORES[k % len(GORES)])
        elif hi[0] - lo[0] > 0.09 and hi[2] - lo[2] > 0.5:
            paint(o, part, SLATS[1 if pv[:, 2].mean() > 0 else -1])   # a lounger's slat
        else:
            paint(o, part, FRAME)
    for o in obs:
        me = o.data
        me.color_attributes.active_color = cols[o.name]
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
        for m in me.materials:
            b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            b.inputs["Base Color"].default_value = (1, 1, 1, 1)
            m.name = "P_Paint"                                # the shared painted-gloss preset (modelMaterials MATERIAL_PRESETS)
    path = D.export(obs, "game/props/beach-parasol.glb")
    return obs, path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "parasol.png"), views=((0, 14), (35, 30), (160, 24)))
