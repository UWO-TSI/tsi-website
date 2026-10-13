"""Refit the sculpted-lock hair library from the v7 head to the v8 skull (head fit, specs/characters/head-fit.md).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/skull/refit_hair.py

For v7/hair_bangs.blend and v7/hair_backs.blend: every lock curve's control points move onto the v8 skull along their
rays from the head centre by the change in skull radius there (head_shape.refit_v7_to_v8), so a lock keeps its height
over the scalp, its path and its section. Where a lock runs near the scalp and the box's fuller corners would make the
straight run between two control points cut nearer the skin than either end, a point is added between them at the
ends' mean height over the new scalp (the same rule locks.densify applies to seeds); the head in each file becomes V8_Head (from skull/head.blend), which
hair_build sweeps the locks against (roots buried, hugging locks resting on the new skin). Runs once per skull change:
the files record the skull they are fitted to (scene["skull"]) and are skipped when already on it. Then:

  Blender -b -P art/characters/v7/export_hair.py
  Blender -b -P art/characters/accessories/build_accessories.py
  Blender -b -P art/characters/fit_check.py
"""
import bpy, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ART, "base"))
from head_shape import refit_v7_to_v8, HC, skull_radius, head_point  # noqa: E402
sys.path.insert(0, HERE)
from skull import VERSION  # noqa: E402

bpy.context.preferences.filepaths.save_version = 0


# file -> {collection: (lat, lon, lift m)}: the hand pass after the move (fit_check's dive report pointed at these)
TOUCH = {"hair_backs.blend": {"back_bun": [(26, -70, 0.003)]},
         # the hime side locks run down past the v8 jaw's tighter corner: more segments, so their faces follow it
         # instead of cutting a chord through it
         "hair_bangs.blend": {"bangs_hime": [(-42, -67, 0.0, 0.06, None, 1.0, 14), (-42, 67, 0.0, 0.06, None, 1.0, 14)]}}


# collection -> segments for every lock but the named ones (bangs_hime: its fringe gives back the side locks' extra
# segments, so the heaviest bangs stays within the 4,000-triangle look)
SEGS = {"hair_bangs.blend": {"bangs_hime": (6, ("bangs_hime_07", "bangs_hime_08"))}}


def height(p):
    """Height of p over the v8 skull along its ray from HC."""
    d = p - HC
    return d.length - skull_radius(d.normalized())


for fname in ("hair_bangs.blend", "hair_backs.blend"):
    path = os.path.join(ART, "v7", fname)
    bpy.ops.wm.open_mainfile(filepath=path)
    sc = bpy.context.scene
    if sc.get("skull") == VERSION:
        print("REFIT skip", fname, "already on", VERSION)
        continue
    n_pts = n_curves = 0
    moved = 0.0
    added = lifted = 0
    for ob in bpy.data.objects:
        if ob.type != "CURVE":
            continue
        mw, inv = ob.matrix_world, ob.matrix_world.inverted()
        for sp in ob.data.splines:
            pts = []
            for pt in sp.points:
                p = mw @ Vector(pt.co[:3])
                q = refit_v7_to_v8(p)
                moved = max(moved, (q - p).length)
                pts.append((q, pt.radius, pt.tilt))
                n_pts += 1
            # no lock's top under the skin anywhere along it (the v8 jaw is fuller): a point whose section would reach
            # into the head rises until its top clears the skin by 3 mm (roots excepted: they are buried by design)
            flat = float(ob.get("flat", 0.45))
            for k in range(1, len(pts)):
                q, r_, t_ = pts[k]
                need = -r_ * flat + 0.003
                if height(q) < need:
                    d = (q - HC).normalized()
                    pts[k] = (HC + d * (skull_radius(d) + need), r_, t_)
                    lifted += 1
            out = [pts[0]]
            for (a, ra, ta), (b, rb, tb) in zip(pts[:-1], pts[1:]):
                ha, hb = height(a), height(b)
                m = (a + b) / 2
                if max(ha, hb) < 0.05 and height(m) < (ha + hb) / 2 - 0.001:
                    d = (m - HC).normalized()
                    out.append((HC + d * (skull_radius(d) + (ha + hb) / 2), (ra + rb) / 2, (ta + tb) / 2))
                    added += 1
                out.append((b, rb, tb))
            if len(out) > len(sp.points):
                sp.points.add(len(out) - len(sp.points))
            for pt, (q, r, t) in zip(sp.points, out):
                c = inv @ q
                pt.co = (c.x, c.y, c.z, 1.0)
                pt.radius, pt.tilt = r, t
        n_curves += 1
    # hand pass: locks that still graze the new skin after the move, lifted where they pass nearest the given point
    for coll, lat, lon, lift, *opt in [(c, *t) for c, ts in TOUCH.get(fname, {}).items() for t in ts]:
        radius, hug_from, width, segs = (opt + [0.07, None, 1.0, None][len(opt):])[:4]
        target = head_point(lat, lon)
        cs = [o for o in bpy.data.collections[coll].objects if o.type == "CURVE"]
        ob = min(cs, key=lambda o: min((o.matrix_world @ Vector(p.co[:3]) - target).length for p in o.data.splines[0].points))
        for k, pt in enumerate(ob.data.splines[0].points):
            q = ob.matrix_world @ Vector(pt.co[:3])
            w = max(0.0, 1.0 - (q - target).length / radius) if k else 0.0      # the root stays buried
            q = q + (q - HC).normalized() * lift * w
            c = ob.matrix_world.inverted() @ q
            pt.co = (c.x, c.y, c.z, 1.0)
            pt.radius *= 1.0 - (1.0 - width) * w
        if hug_from:
            ob["hug_from"] = hug_from
        if segs:
            ob["segs"] = segs
        print("REFIT touch", coll, ob.name, f"+{lift * 1000:.1f} mm, width x{width} near ({lat}, {lon})")
    for coll, (n, keep) in SEGS.get(fname, {}).items():
        for ob in bpy.data.collections[coll].objects:
            if ob.type == "CURVE" and ob.name not in keep:
                ob["segs"] = n
    # the head the locks are swept against: V8_Head, in the old head's collection; the v7 head kept hidden for reference
    old = bpy.data.objects.get("V7_Head")
    colls = list(old.users_collection) if old else [sc.collection]
    with bpy.data.libraries.load(os.path.join(HERE, "head.blend"), link=False) as (src, dst):
        dst.objects = ["V8_Head"]
    head = dst.objects[0]
    for c in colls:
        c.objects.link(head)
    rig = bpy.data.objects.get("CharacterRig")
    if rig:
        head.parent = rig
        for md in head.modifiers:
            if md.type == "ARMATURE":
                md.object = rig
    if old:
        old.hide_set(True)
        old.hide_render = True
    sc["skull"] = VERSION
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print(f"REFIT {fname}: {n_curves} locks, {n_pts} points, moved at most {moved * 1000:.1f} mm, {added} points added, {lifted} lifted clear of the skin")
print("REFIT_OK")
