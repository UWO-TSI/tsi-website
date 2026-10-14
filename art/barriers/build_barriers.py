"""The v1 world's natural barriers (specs/v1-drop.md §2): the zones that open in later drops are cut off by things that
belong there, never an invisible wall or a sign.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/barriers/build_barriers.py [-- id ...]

  unbuilt-bridge   the north bridge, not built yet: a stack of new planks on two sleepers, survey stakes with faded
                   ribbon, string lines pegged out along the deck to come, and a rope strung across the bridge head
  forest-edge      the dense forest edge: close old trunks with mossy root flares, young firs crowded between them, a
                   bramble and fern undergrowth, a fallen log along the front (one segment; several make an edge)
  ruins-rubble     the ruins entrance, fallen: carved blocks, a toppled column drum, a cracked lintel leaning on them,
                   chunks and roots grown over the lot
  rockslide        the mountain trail, buried: a slope of faceted boulders over scree, a snapped trunk wedged across

Writes web/public/assets/game/props/<id>.glb (the budget's "effect" folder: under 3000 triangles, 6 primitives, 6
materials each). Frame: GAME coordinates (cafekit: x across, y up, z away from the camera), one unit = one map cell,
origin = the footprint's centre on the ground, the face you meet first toward -z. Matte throughout: roughness 0.95 to 1,
no metal, flat colours, no textures. Every random choice is seeded, so a rebuild writes the same models.

The solid footprints the engine walks round are lib/game/barriers.ts BARRIERS (rectangles in this frame); keep them in
step with the shapes here. Prints each model's triangles and materials.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402
from cafekit import G, Mat, Model  # noqa: E402

K.OUT = os.path.join(K.ROOT, "web", "public", "assets", "game", "props")
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
TAU = math.tau


def jitter(m, faces, amt, seed):
    """Wobble the vertices of these faces (rock and bark: a few big uneven planes instead of a perfect solid)."""
    rnd = np.random.default_rng(seed)
    for v in {v for f in faces for v in f.verts}:
        v.co += Vector(rnd.uniform(-amt, amt, 3))
    return faces


def rock(m, c, r, mat, seed, segs=7, rings=5, amt=0.12, yaw=0.0, flat=0.3):
    """A faceted boulder: a low-poly ellipsoid sat into the ground, its vertices pushed about by `amt` of its size."""
    faces = m.blob(c, r, mat, segs=segs, rings=rings, yaw=yaw)
    jitter(m, faces, amt * max(r), seed)
    floor = G(*c).z - r[1] * flat              # the underside flattened where it sits (Blender z is game y)
    for v in {v for f in faces for v in f.verts}:
        v.co.z = max(v.co.z, floor)
    return faces


# ================================================================ the north bridge, not built yet
def unbuilt_bridge():
    M = {
        "plank": Mat("M_PlankNew", "#c49a68", 0.95),
        "sleeper": Mat("M_Sleeper", "#7a5a3c", 1.0),
        "stake": Mat("M_Stake", "#a88458", 1.0),
        "rope": Mat("M_Rope", "#c8b58a", 1.0),
        "ribbon": Mat("M_Ribbon", "#d0644a", 0.95),
    }
    m = Model("unbuilt-bridge", smooth=30)
    rnd = np.random.default_rng(31)
    # The stack of new boards, along x, on two sleepers: three courses, the top one short a board (someone started).
    for sx in (-0.62, 0.62):
        m.box((sx, 0.06, 0.45), (0.14, 0.12, 0.95), M["sleeper"], bevel=0.015)
    for course in range(4):
        n = 4 if course < 3 else 2
        for k in range(n):
            z = 0.45 + (k - (n - 1) / 2) * 0.22 + rnd.uniform(-0.015, 0.015)
            y = 0.12 + 0.025 + course * 0.052
            faces = m.box((rnd.uniform(-0.04, 0.04), y, z), (1.75, 0.045, 0.2), M["plank"], bevel=0.01)
            m.rot(faces, (0, y, z), "y", rnd.uniform(-0.04, 0.04))
    # The first piles, cut and waiting on the grass beside the stack, and a mallet.
    for k, (x, z) in enumerate(((1.05, 0.35), (1.15, 0.6))):
        pile = m.cyl((x - 0.9, 0.09, z), 0.09, 1.8, M["sleeper"], n=7, axis="x")
        m.rot(pile, (x, 0.09, z), "y", 0.08 * (k - 0.5))
    m.box((-1.0, 0.06, -0.15), (0.12, 0.12, 0.2), M["sleeper"], bevel=0.02)
    m.tube([(-1.0, 0.06, -0.15), (-0.7, 0.04, -0.32)], 0.018, M["stake"], n=5)
    # A coil of rope left on top.
    m.ring((0.45, 0.12 + 3 * 0.052 + 0.02, 0.5), 0.14, 0.025, M["rope"], n=12, m=5)
    m.ring((0.45, 0.12 + 3 * 0.052 + 0.055, 0.5), 0.12, 0.025, M["rope"], n=12, m=5)

    # Survey stakes: two tall ones at the bridge head's corners carry the rope across; two pegs further back.
    def stake(x, z, h, flag):
        m.box((x, h / 2, z), (0.07, h, 0.07), M["stake"], bevel=0.008)
        m.cyl((x, -0.12, z), 0.0, 0.12, M["stake"], n=4, r2=0.045, caps=(False, True))      # the point, into the ground
        if flag:                                                                              # faded survey ribbon, knotted
            m.box((x + 0.07, h - 0.1, z), (0.12, 0.06, 0.012), M["ribbon"])
            tail = m.box((x + 0.12, h - 0.24, z - 0.01), (0.05, 0.26, 0.01), M["ribbon"])
            m.rot(tail, (x + 0.1, h - 0.1, z), "z", -0.35)
    for sx in (-1.1, 1.1):
        stake(sx, -0.7, 1.05, True)
        stake(sx, 0.95, 0.42, False)
    # The rope across the bridge head, sagging, tied off round each stake top.
    pts = [(-1.1 + 2.2 * t, 0.84 - 0.12 * math.sin(math.pi * t), -0.7) for t in np.linspace(0, 1, 9)]
    m.tube(pts, 0.02, M["rope"], n=6)
    for sx in (-1.1, 1.1):
        m.ring((sx, 0.86, -0.7), 0.055, 0.018, M["rope"], n=8, m=4)
    # String lines pegged out where the deck's edges will run: from each tall stake back to its peg, a hand over the grass.
    for sx in (-1.1, 1.1):
        m.tube([(sx, 0.32, 0.95), (sx, 0.5, -0.7)], 0.006, M["rope"], n=4, caps=False)
    return [m.finish()]


# ================================================================ the dense forest edge
def fir(m, M, x, z, h, rnd, seed, trunk_to=0.0):
    """A fir: a tapered trunk, bare up to `trunk_to` × h (an old tree's close trunk under its lowest boughs), then
    stacked boughs narrowing to the tip; dark and matte, season-proof."""
    r = 0.05 + h * 0.035
    trunk = m.lathe((x, 0, z), [(0, 0), (r * 1.5, 0), (r, 0.18), (r * 0.7, h * 0.7), (0, h * 0.72)], M["bark"] if seed % 2 else M["barkdark"],
                    n=6, yaw=rnd.uniform(0, TAU))
    jitter(m, trunk, r * 0.15, seed)
    y0 = max(trunk_to * h, 0.18 * h)
    tiers = 3 if h < 2 else 4
    for j in range(tiers):
        k = j / tiers
        y = y0 + (h - y0) * k * 0.82
        rad = (0.5 + h * 0.16) * (1 - k * 0.72)
        cone = m.cyl((x, y, z), rad, (h - y0) * 0.42, M["fir"], n=7, r2=0.0, caps=(True, False), yaw=rnd.uniform(0, TAU))
        jitter(m, cone, 0.04 * h, seed * 7 + j)


def forest_edge():
    M = {
        "bark": Mat("M_Bark", "#6a5040", 1.0),
        "barkdark": Mat("M_BarkDark", "#4c3a2e", 1.0),
        "fir": Mat("M_Fir", "#3f6448", 0.95),
        "under": Mat("M_Undergrowth", "#557a44", 0.95),
        "moss": Mat("M_Moss", "#6f8a3e", 1.0),
    }
    m = Model("forest-edge", smooth=40)
    rnd = np.random.default_rng(47)
    # Old firs at the back, their close trunks bare under the lowest boughs: the wall you can't get between.
    for k, (x, z, h) in enumerate(((-1.7, 0.45, 3.6), (-0.65, 0.65, 3.9), (0.45, 0.4, 3.5), (1.55, 0.6, 3.8))):
        fir(m, M, x, z, h, rnd, 100 + k, trunk_to=0.36)
        m.blob((x - 0.12, 0.08, z - 0.16), (0.24, 0.07, 0.15), M["moss"], segs=6, rings=3)        # moss at the root flare
    # Young firs crowded in front of and between them.
    for k, (x, z, h) in enumerate(((-1.25, -0.05, 1.7), (-0.1, 0.0, 1.5), (1.0, -0.05, 1.8), (1.9, 0.0, 1.3), (-1.95, -0.1, 1.4))):
        fir(m, M, x, z, h, rnd, 200 + k)
    # Undergrowth along the front: bramble and fern mounds, overlapping so nothing reads as a gap.
    for k in range(13):
        x = -2.0 + k * (4.0 / 12) + rnd.uniform(-0.12, 0.12)
        z = -0.55 + rnd.uniform(-0.12, 0.2)
        r = rnd.uniform(0.32, 0.46)
        mound = m.blob((x, r * 0.45, z), (r, r * rnd.uniform(0.75, 1.0), r * 0.85), M["under"] if k % 3 else M["moss"], segs=7, rings=4,
                       yaw=rnd.uniform(0, TAU))
        jitter(m, mound, r * 0.12, 300 + k)
    # A fallen log along the front edge, half in the brambles.
    log = m.lathe((-1.0, 0.16, -0.2), [(0, 0), (0.15, 0), (0.17, 0.9), (0.14, 1.9), (0, 1.9)], M["barkdark"], n=7, d=(1, 0.05, -0.12))
    jitter(m, log, 0.02, 400)
    return [m.finish()]


# ================================================================ the ruins entrance, fallen
def ruins_rubble():
    M = {
        "stone": Mat("M_RuinStone", "#a59a88", 0.95),
        "stonedark": Mat("M_RuinStoneDark", "#857a6c", 1.0),
        "moss": Mat("M_Moss", "#6f8a3e", 1.0),
        "root": Mat("M_Root", "#5a4434", 1.0),
    }
    m = Model("ruins-rubble", smooth=25)
    rnd = np.random.default_rng(53)
    # Carved blocks tumbled across the way: squared, chipped, each sitting a little askew.
    blocks = ((-1.15, 0.0, 1.0, 0.62, 0.7, 0.3), (0.05, -0.15, 1.1, 0.7, 0.75, -0.2), (1.2, 0.1, 0.9, 0.55, 0.65, 0.5),
              (-0.5, 0.65, 0.8, 0.5, 0.6, -0.4), (0.75, 0.75, 0.85, 0.55, 0.6, 0.15))
    for k, (x, z, w, h, d, yaw) in enumerate(blocks):
        f = m.box((x, h / 2 - 0.04, z), (w, h, d), M["stone"] if k % 2 == 0 else M["stonedark"], yaw=yaw, bevel=0.05)
        jitter(m, f, 0.035, 500 + k)
        m.rot(f, (x, 0, z), "z", rnd.uniform(-0.08, 0.08))
    # A second course: one block fallen on top, and the cracked lintel leaning down across them.
    top = m.box((-0.55, 0.62 + 0.25, 0.1), (0.85, 0.45, 0.6), M["stonedark"], yaw=0.5, bevel=0.05)
    jitter(m, top, 0.03, 510)
    m.rot(top, (-0.55, 0.62, 0.1), "z", 0.12)
    lintel = m.box((0.55, 0.95, 0.25), (2.0, 0.32, 0.45), M["stone"], bevel=0.04)
    jitter(m, lintel, 0.025, 511)
    m.rot(lintel, (0.55, 0.95, 0.25), "z", -0.32)
    m.rot(lintel, (0.55, 0.95, 0.25), "y", 0.18)
    # A toppled column drum on its side in front.
    drum = m.cyl((-1.6, 0.36, -0.75), 0.34, 0.95, M["stone"], n=10, axis="x")
    jitter(m, drum, 0.02, 512)
    m.rot(drum, (-1.15, 0.36, -0.75), "y", 0.4)
    # Chunks and spalls.
    for k in range(9):
        x, z = rnd.uniform(-1.7, 1.7), rnd.uniform(-1.0, -0.45)
        r = rnd.uniform(0.12, 0.24)
        rock(m, (x, r * 0.5, z), (r * 1.2, r, r), M["stonedark"] if k % 2 else M["stone"], 520 + k, segs=5, rings=4, amt=0.18)
    # Moss on the tops.
    for k, (x, z, y) in enumerate(((-1.15, 0.0, 0.63), (0.05, -0.15, 0.71), (1.2, 0.1, 0.56), (-0.55, 0.1, 1.1))):
        m.blob((x + 0.1, y, z), (0.32, 0.05, 0.22), M["moss"], segs=6, rings=3, yaw=k)
    # Roots grown over it all, from the ground behind, over the blocks and down the front.
    for k in range(4):
        x0 = -1.4 + k * 0.95
        path = [(x0 + rnd.uniform(-0.2, 0.2), 0.0, 1.05), (x0 + rnd.uniform(-0.2, 0.2), 0.7 + rnd.uniform(0, 0.2), 0.45),
                (x0 + rnd.uniform(-0.25, 0.25), 0.75, -0.1), (x0 + rnd.uniform(-0.3, 0.3), 0.3, -0.55), (x0 + rnd.uniform(-0.3, 0.3), 0.0, -0.85)]
        m.tube(path, rnd.uniform(0.05, 0.075), M["root"], n=5)
    return [m.finish()]


# ================================================================ the rockslide over the mountain trail
def rockslide():
    M = {
        "rock": Mat("M_SlideRock", "#8f8a80", 0.95),
        "rockdark": Mat("M_SlideRockDark", "#6f6a62", 1.0),
        "scree": Mat("M_Scree", "#a49c8e", 1.0),
        "log": Mat("M_SnappedLog", "#5e4636", 1.0),
    }
    m = Model("rockslide", smooth=20)
    rnd = np.random.default_rng(61)
    # The big boulders that came down first, banked against the uphill (+z) side, highest at the back.
    big = ((-1.2, 0.7, 0.95), (0.1, 0.9, 1.05), (1.25, 0.6, 0.9), (-0.55, -0.1, 0.75), (0.75, -0.05, 0.8), (-1.6, -0.6, 0.55), (1.6, -0.5, 0.6))
    for k, (x, z, r) in enumerate(big):
        rock(m, (x, r * 0.55 + (0.25 if z > 0.5 else 0), z), (r * 1.15, r * 0.85, r), M["rock"] if k % 2 == 0 else M["rockdark"], 600 + k,
             segs=7, rings=5, amt=0.14, yaw=rnd.uniform(0, TAU))
    # Medium rocks wedged between them.
    for k in range(10):
        x, z = rnd.uniform(-1.7, 1.7), rnd.uniform(-1.2, 1.1)
        r = rnd.uniform(0.25, 0.42)
        rock(m, (x, r * 0.5, z), (r * 1.1, r * 0.8, r), M["rockdark"] if k % 3 == 0 else M["rock"], 620 + k, segs=6, rings=4, amt=0.16,
             yaw=rnd.uniform(0, TAU))
    # Scree spilling down the front.
    for k in range(16):
        x, z = rnd.uniform(-1.8, 1.8), rnd.uniform(-1.45, -0.7)
        r = rnd.uniform(0.08, 0.17)
        rock(m, (x, r * 0.45, z), (r * 1.3, r * 0.7, r), M["scree"], 640 + k, segs=5, rings=3, amt=0.2)
    # A snapped trunk carried down and wedged across, its broken end splintered.
    log = m.lathe((-1.7, 0.75, -0.2), [(0, 0), (0.17, 0), (0.18, 1.6), (0.15, 3.1), (0.1, 3.25), (0, 3.3)], M["log"], n=7, d=(1, 0.18, 0.35))
    jitter(m, log, 0.025, 660)
    return [m.finish()]


MODELS = [("unbuilt-bridge", unbuilt_bridge), ("forest-edge", forest_edge), ("ruins-rubble", ruins_rubble), ("rockslide", rockslide)]


def main():
    for mid, fn in MODELS:
        if ONLY and mid not in ONLY:
            continue
        K.reset()
        obs = fn()
        K.export(obs, mid)


main()
