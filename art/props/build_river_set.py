"""The river's dressing (terrain v3, game/village-art2; David, R2c 2026-10-26, the river: "needs work on feeling natural, it
feels so barren and unnatural right now"; nature-feel.jpg in specs/references/terrain/r2-2026-10-26/): reeds and
cattails for the banks and the shallows, lily pads on the still water, smooth river stones and bleached driftwood.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_river_set.py [-- names...] [-- review <dir>]

Writes, in game units at scale 1, the origin at the piece's centre:
  game/plants/reeds-a.glb       a full clump of reeds with three cattails (about 1.3 across, 1.4 tall), rooted at y 0.
  game/plants/reeds-b.glb       a small loose clump, a few blades bent over, two cattails (about 0.9 across, 1.05 tall).
  game/plants/reeds-c.glb       a run of reeds along x for a bank's edge (about 2.6 by 1.3, 1.4 tall), cattails here and there.
  game/water/lily-pads-a.glb    five pads and a pink water lily in flower, floating at y 0 (set it on the water's level).
  game/water/lily-pads-b.glb    three pads and a closed bud, floating at y 0.
  game/props/river-stones-a.glb a scatter of smooth water-worn stones, the biggest 0.5 across, about 1 across in all, wet low down.
  game/props/river-stones-b.glb two big rounded stones and a pebble (about 1.3 across, 0.48 tall), for a bank or a
                                shallow (half in the water they show a wet band and a little weed).
  game/props/driftwood-a.glb    a bleached log lying along x (about 2.1 long) with a root plate and broken branch stubs.
  game/props/driftwood-b.glb    a forked branch lying along x (about 1.2 long).
Plain colour in COLOR_0 on shared materials: the reeds one leaf material (foliage), the lily pads and flowers P_Paint (a
soft waxy gloss), the stones P_Stone, the driftwood P_Wood. Seeded: a rebuild writes the same models.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from build_stones import wave  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
REED, REED_TIP, REED_DRY = "#6f8e43", "#a8c060", "#c4b46c"
CATTAIL, STALK = "#6b4529", "#7f8f4b"
PAD, PAD_LIGHT, PAD_RIM = "#5e8f3e", "#88b456", "#4a6f33"
PETAL, PETAL_TIP, HEART = "#f7e3ea", "#e98aa8", "#f2c94c"
DRIFT = "#c9bba3"


def blend(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(K.lin(a), K.lin(b)))


# ================================================================ reeds
def blade(k, mat, base, h, lean, w, rng, dry=False):
    """One reed blade from `base`: a long tapering strip with a fold down its middle, bending out along `lean` (game x, z)
    as it rises, dark at the foot and light at the tip (a dry one yellows)."""
    lx, lz = lean
    out = Vector((lx, 0, lz))
    twist = rng.uniform(-0.6, 0.6)
    side = (Vector((-lz, 0, lx)).normalized() * math.cos(twist) + out.normalized() * math.sin(twist)).normalized()
    fold = side.cross(Vector((0, 1, 0))).normalized() * w * 0.35
    tip = REED_DRY if dry else REED_TIP
    n = 4
    rows = []
    for i in range(n + 1):
        t = i / n
        c = Vector(base) + Vector((0, h * t, 0)) + out * h * t * t
        c.y -= max(0.0, out.length - 0.3) * h * t ** 3 * 0.5            # a long lean droops at the tip
        half = w * (1 - t) ** 0.8 / 2
        rows.append((c - side * half, c + fold * (1 - t), c + side * half, blend(REED, tip, t ** 1.4)))
    for (a0, m0, b0, c0), (a1, m1, b1, c1) in zip(rows, rows[1:]):
        for p, q, r, s in ((a0, m0, m1, a1), (m0, b0, b1, m1)):
            f = k.face([k.vert(tuple(x)) for x in (p, q, r, s)], [(0, 0)] * 4, mat)
            for lp, col in zip(f.loops, (c0, c0, c1, c1)):
                lp[k.col] = (*col, 1.0)


def cattail(k, M, base, h, lean):
    """A cattail: a thin stalk leaning a little, the brown velvet head near its top and a spike above."""
    lx, lz = lean
    top = Vector(base) + Vector((lx, h, lz))
    k.tube([base, Vector(base) + Vector((lx * 0.3, h * 0.5, lz * 0.3)), top], 0.012, M["reed"], STALK, n=4, radii=[1.2, 1.0, 0.8])
    d = (top - Vector(base)).normalized()
    head = top - d * 0.06
    k.lathe(tuple(head - d * 0.2), [(0.0, 0.0), (0.03, 0.02), (0.042, 0.08), (0.042, 0.16), (0.03, 0.2), (0.0, 0.22)], M["reed"], CATTAIL, d=tuple(d), n=6)
    k.tube([top - d * 0.05, top + d * 0.1], 0.006, M["reed"], STALK, n=3)


def clump(k, M, seed, centre, radius, blades, cattails, h, spread=(1.0, 1.0), droop=0.0, dry=0.15):
    rng = np.random.default_rng(seed)
    cx, cz = centre
    for _ in range(blades):
        a, d = rng.uniform(0, math.tau), radius * math.sqrt(rng.random())
        x, z = cx + math.cos(a) * d * spread[0], cz + math.sin(a) * d * spread[1]
        out = (math.cos(a) * (0.12 + 0.3 * d / radius), math.sin(a) * (0.12 + 0.3 * d / radius))
        if rng.random() < droop:
            out = (out[0] * 1.8, out[1] * 1.8)
        blade(k, M["reed"], (x, -0.05, z), h * rng.uniform(0.55, 1.0), out, rng.uniform(0.035, 0.055), rng, dry=rng.random() < dry)
    for _ in range(cattails):
        a, d = rng.uniform(0, math.tau), radius * 0.6 * math.sqrt(rng.random())
        cattail(k, M, (cx + math.cos(a) * d * spread[0], -0.05, cz + math.sin(a) * d * spread[1]), h * rng.uniform(0.95, 1.2),
                (math.cos(a) * 0.08, math.sin(a) * 0.08))


def reed_kit(name):
    K.reset()
    return K.Kit(name), {"reed": K.Mat("mReeds", rough=0.85)}


def reeds_a():
    k, M = reed_kit("reeds-a")
    clump(k, M, 41, (0, 0), 0.3, 34, 3, 1.25)
    return k.finish(smooth_deg=70)


def reeds_b():
    k, M = reed_kit("reeds-b")
    clump(k, M, 42, (0, 0), 0.2, 16, 2, 0.9, droop=0.25, dry=0.3)
    return k.finish(smooth_deg=70)


def reeds_c():
    k, M = reed_kit("reeds-c")
    for i, x in enumerate((-0.65, -0.1, 0.5, 0.85)):
        clump(k, M, 43 + i, (x, 0.04 * (-1) ** i), 0.2, 11, 1 if i % 2 == 0 else 0, 1.05 + 0.08 * (i % 3), spread=(1.4, 0.8), droop=0.15)
    return k.finish(smooth_deg=70)


# ================================================================ lily pads
def pad(k, mat, c, r, yaw, seed):
    """A floating pad: a disc with its notch cut to the middle, the rim turned up a hair, lighter round the heart."""
    rng = np.random.default_rng(seed)
    cx, cy, cz = c
    n, gap = 14, 0.5
    angs = [yaw + gap / 2 + (math.tau - gap) * i / n for i in range(n + 1)]
    heart = k.vert((cx, cy + 0.008, cz))
    wob = wave(seed, 3, (2.0, 4.0))
    for a0, a1 in zip(angs, angs[1:]):
        pts = []
        for a in (a0, a1):
            rr = r * (1 + 0.05 * wob(np.array((math.cos(a), 0, math.sin(a)))))
            pts.append(((cx + math.cos(a) * rr * 0.55, cy + 0.006, cz + math.sin(a) * rr * 0.55), (cx + math.cos(a) * rr, cy + 0.016, cz + math.sin(a) * rr)))
        (i0, o0), (i1, o1) = pts
        vi0, vi1, vo0, vo1 = (k.vert(p) for p in (i0, i1, o0, o1))
        t = rng.uniform(0.95, 1.05)
        f = k.face([heart, vi1, vi0], [(0, 0)] * 3, mat)
        for lp, col in zip(f.loops, (PAD_LIGHT, PAD, PAD)):
            lp[k.col] = (*(x * t for x in K.lin(col)), 1.0)
        f = k.face([vi0, vi1, vo1, vo0], [(0, 0)] * 4, mat)
        for lp, col in zip(f.loops, (PAD, PAD, PAD_RIM, PAD_RIM)):
            lp[k.col] = (*(x * t for x in K.lin(col)), 1.0)


def lily(k, mat, c, open_=1.0):
    """A water lily: two rings of pointed petals cupped round a golden heart (open_ 0 is a closed bud)."""
    cx, cy, cz = c
    for ring, (n, length, rise, rot) in enumerate(((8, 0.15, 0.25 + 0.9 * (1 - open_), 0.0), (7, 0.12, 0.7 + 0.6 * (1 - open_), 0.4))):
        for i in range(n):
            a = rot + math.tau * i / n
            d = Vector((math.cos(a), 0, math.sin(a)))
            s = Vector((-d.z, 0, d.x))
            up = math.atan(rise * 2.2)
            dirv = (d * math.cos(up) + Vector((0, 1, 0)) * math.sin(up)).normalized()
            b = Vector((cx, cy + 0.02 + ring * 0.01, cz)) + d * 0.02
            tip = b + dirv * length
            mid = b + dirv * length * 0.45
            pts = [b - s * 0.012, mid - s * 0.045 + Vector((0, -0.01, 0)), tip, mid + s * 0.045 + Vector((0, -0.01, 0)), b + s * 0.012]
            cols = [PETAL, PETAL, PETAL_TIP, PETAL, PETAL]
            vs = [k.vert(tuple(p)) for p in pts]
            ctr = k.vert(tuple(mid + Vector((0, 0.008, 0))))
            for j in range(4):
                f = k.face([ctr, vs[j], vs[j + 1]], [(0, 0)] * 3, mat)
                for lp, col in zip(f.loops, (blend(PETAL, PETAL_TIP, 0.25), K.lin(cols[j]), K.lin(cols[j + 1]))):
                    lp[k.col] = (*col, 1.0)
    if open_ > 0.5:
        k.blob((cx, cy + 0.045, cz), (0.035, 0.022, 0.035), mat, HEART, segs=8, rings=4)


def lily_pads_a():
    K.reset()
    k, mat = K.Kit("lily-pads-a"), K.Mat("P_Paint", rough=0.45)
    for i, (x, z, r) in enumerate(((0, 0, 0.26), (0.42, 0.18, 0.2), (-0.36, 0.22, 0.18), (0.12, -0.4, 0.22), (-0.3, -0.3, 0.14))):
        pad(k, mat, (x, 0, z), r, 1.3 * i + 0.4, 50 + i)
    lily(k, mat, (0.08, 0.01, 0.06))
    return k.finish(smooth_deg=60)


def lily_pads_b():
    K.reset()
    k, mat = K.Kit("lily-pads-b"), K.Mat("P_Paint", rough=0.45)
    for i, (x, z, r) in enumerate(((0, 0, 0.22), (0.34, -0.12, 0.16), (-0.2, 0.3, 0.13))):
        pad(k, mat, (x, 0, z), r, 2.1 * i + 1.0, 60 + i)
    lily(k, mat, (0.36, 0.01, -0.1), open_=0.0)
    return k.finish(smooth_deg=60)


# ================================================================ river stones
def stone_kit(name):
    K.reset()
    k = K.Kit(name)
    k._stone = K.Mat("P_Stone", rough=0.95)
    return k


def wet(k, y0, y1, weed=0.0):
    """Darken the stone under y1 (wet), most under y0; a little green weed in a band just under the waterline."""
    for f in k.bm.faces:
        for lp in f.loops:
            y = lp.vert.co.z                        # Blender z is game y
            t = min(1.0, max(0.0, (y1 - y) / max(y1 - y0, 1e-6)))
            c = Vector(lp[k.col][:3]) * (1 - 0.35 * t)
            if weed and y1 - 0.08 < y < y1:
                c = c * (1 - weed) + Vector(K.lin("#6f8a45")) * weed
            lp[k.col] = (*c, 1.0)


def pebble(k, c, radii, seed, tone, yaw=0.0, segs=10, rings=6):
    """A water-worn stone: a smooth flattened lump bedded at y 0 (its foot pressed flat a little under), softly mottled."""
    rng = np.random.default_rng(seed)
    mott = wave(seed + 5, 5, (4.0, 9.0))
    faces = k.blob(c, radii, k._stone, tone, segs=segs, rings=rings, seed=seed, lumpy=0.1, flat_bottom=-c[1] - 0.02,
                   rot=K.game_rot(yaw=yaw, roll=rng.uniform(-0.08, 0.08)))
    base = np.array(K.lin(tone)) * rng.uniform(0.95, 1.05)
    for f in faces:
        for lp in f.loops:
            p = np.array((lp.vert.co.x, lp.vert.co.z, -lp.vert.co.y))
            lp[k.col] = (*(base * (1 + 0.08 * mott(p))), 1.0)


def river_stones_a():
    k = stone_kit("river-stones-a")
    for i, (x, z, r, yaw) in enumerate(((0, 0, (0.25, 0.11, 0.19), 0.3), (0.38, 0.12, (0.16, 0.08, 0.12), 1.2), (-0.32, 0.18, (0.13, 0.07, 0.1), 2.0),
                                        (0.1, -0.3, (0.12, 0.06, 0.09), 0.7), (-0.18, -0.22, (0.08, 0.045, 0.06), 2.6), (0.5, -0.2, (0.06, 0.035, 0.05), 0.1))):
        pebble(k, (x, r[1] * 0.6, z), r, 70 + i, ["#a9a397", "#9aa0a0", "#b5ab98"][i % 3], yaw, segs=10 if r[0] > 0.1 else 8, rings=6 if r[0] > 0.1 else 5)
    k.tint_gradient(0.8, 1.0, 0.0, 0.18)
    wet(k, 0.0, 0.06)
    return k.finish(smooth_deg=80)


def river_stones_b():
    k = stone_kit("river-stones-b")
    pebble(k, (-0.12, 0.18, 0.0), (0.5, 0.28, 0.38), 80, "#a7a69a", 0.4, segs=14, rings=8)
    pebble(k, (0.42, 0.1, 0.18), (0.3, 0.17, 0.25), 81, "#9c9f9c", 1.4, segs=12, rings=7)
    pebble(k, (0.28, 0.03, -0.3), (0.09, 0.05, 0.07), 82, "#b2a895", 0.2, segs=8, rings=5)
    k.tint_gradient(0.8, 1.0, -0.08, 0.45)
    wet(k, -0.08, 0.12, weed=0.45)
    return k.finish(smooth_deg=80)


# ================================================================ driftwood
def driftwood(k, mat, path, r, radii, seed):
    """A bleached limb along game points: lumpy round, pale with silver-grey streaks, darker underneath."""
    rng = np.random.default_rng(seed)
    faces = k.tube(path, r, mat, DRIFT, n=7, caps=True, radii=radii)
    streak = wave(seed, 4, (6.0, 14.0))
    for f in faces:
        for lp in f.loops:
            p = np.array((lp.vert.co.x, lp.vert.co.z, -lp.vert.co.y))
            under = min(1.0, max(0.0, (0.12 - p[1]) / 0.12))
            c = np.array(K.lin(DRIFT)) * (1 + 0.1 * streak(p)) * (1 - 0.3 * under) * rng.uniform(0.98, 1.02)
            lp[k.col] = (*c, 1.0)


def driftwood_a():
    K.reset()
    k, mat = K.Kit("driftwood-a"), K.Mat("P_Wood", rough=0.9)
    driftwood(k, mat, [(-0.95, 0.13, 0.0), (-0.4, 0.12, 0.05), (0.2, 0.1, -0.02), (0.75, 0.08, 0.04), (0.98, 0.07, 0.02)], 0.12, [1.3, 1.0, 0.92, 0.8, 0.45], 90)
    # the root plate at -x, splayed roots
    for i, a in enumerate(np.linspace(0.3, math.tau - 0.3, 6)):
        d = Vector((0, math.cos(a), math.sin(a)))
        driftwood(k, mat, [(-0.9, 0.13, 0.0), tuple(Vector((-1.05, 0.13, 0.0)) + d * 0.18), tuple(Vector((-1.12, 0.13, 0.0)) + d * 0.3 + Vector((0, -0.06, 0)))],
                  0.05, [1.2, 0.8, 0.3], 91 + i)
    driftwood(k, mat, [(0.1, 0.18, -0.04), (0.18, 0.36, -0.12), (0.22, 0.46, -0.16)], 0.04, [1.0, 0.7, 0.35], 98)
    driftwood(k, mat, [(0.5, 0.12, 0.06), (0.66, 0.18, 0.26), (0.72, 0.2, 0.36)], 0.035, [1.0, 0.7, 0.3], 99)
    return k.finish(smooth_deg=55)


def driftwood_b():
    K.reset()
    k, mat = K.Kit("driftwood-b"), K.Mat("P_Wood", rough=0.9)
    driftwood(k, mat, [(-0.6, 0.06, 0.0), (-0.1, 0.06, 0.02), (0.3, 0.05, -0.04), (0.6, 0.04, -0.12)], 0.06, [1.1, 1.0, 0.85, 0.5], 100)
    driftwood(k, mat, [(-0.05, 0.06, 0.02), (0.25, 0.06, 0.16), (0.55, 0.05, 0.24)], 0.04, [1.0, 0.8, 0.45], 101)
    return k.finish(smooth_deg=55)


MODELS = {"game/plants/reeds-a": reeds_a, "game/plants/reeds-b": reeds_b, "game/plants/reeds-c": reeds_c,
          "game/water/lily-pads-a": lily_pads_a, "game/water/lily-pads-b": lily_pads_b,
          "game/props/river-stones-a": river_stones_a, "game/props/river-stones-b": river_stones_b,
          "game/props/driftwood-a": driftwood_a, "game/props/driftwood-b": driftwood_b}


def review(out):
    """A stretch of bank: water at y 0 to one side, the set along its edge, from the GLBs."""
    import bpy
    K.reset()
    spots = [("reeds-a", (-1.6, -0.3)), ("reeds-c", (0.4, -0.6)), ("reeds-b", (2.2, -0.2)), ("lily-pads-a", (-0.6, 1.0)), ("lily-pads-b", (1.6, 1.2)),
             ("river-stones-a", (-2.4, 0.6)), ("river-stones-b", (2.8, 0.7)), ("driftwood-a", (-0.2, -1.5)), ("driftwood-b", (2.4, -1.3))]
    obs = []
    for nm, (x, z) in spots:
        path = next(os.path.join(K.ROOT, "web", "public", "assets", f"{key}.glb") for key in MODELS if key.endswith("/" + nm))
        bpy.ops.import_scene.gltf(filepath=path)
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location = K.G(x, 0, z)
                if o.data.color_attributes:
                    o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.ops.mesh.primitive_plane_add(size=1, location=K.G(0.2, -0.005, 1.0))
    water = bpy.context.active_object
    water.scale = (7.5, 1.6, 1)
    m = bpy.data.materials.new("water")
    m.use_nodes = True
    next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*K.lin("#5d9fa8"), 1)
    water.data.materials.append(m)
    bpy.context.view_layer.update()
    K.review(obs, out, views=((180, 30), (215, 50)), size=900)


if __name__ == "__main__":
    only = [a for a in ARGS if any(key.endswith("/" + a) for key in MODELS)]
    for key, make in MODELS.items():
        if only and key.rsplit("/", 1)[1] not in only:
            continue
        ob = make()
        K.export([ob], f"{key}.glb")
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "river-set.png"))
