"""Ruins enemies (row 228: corrupted wildlife outside, arcane constructs inside, a statue boss; cute-menacing, no gore).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_enemies.py [-- id ...]

Every enemy is a few named nodes (body, head, legs/claws, glow_*) with their origins on the joint the engine would
rotate (neck, hip, shoulder, hinge), so it can bob, lunge, slam and snap procedurally without a skeleton. Glowing
bits use one emissive material named `telegraph` for the windup glow. Faces -Y (glTF +Z), feet on z = 0 (the wisp is
centred on its origin; the engine hovers it). Rig units: the engine scales by modelScale 1.3 like the character.
"""
import math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pe  # noqa: E402
from pe import TAU, lathe, rbox, on_blob, parent  # noqa: E402

pe.reset()
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
# The enemies' named colours. palette_ext.json was never committed (the repo ignores *.json) and is lost; these were read
# back from the shipped GLBs' material colours (linear base colour to sRGB, 2026-10-02), plus zone 1's new ones.
pe.EXT.update({
    "fox_fur": "#3f3a5c", "fox_tip": "#d8cff0", "fox_dark": "#2a2640", "glow_violet": "#a66bff",
    "crab_shell": "#6f8f5c", "crab_body": "#d0764f", "thorn": "#e6d6a8", "glow_amber": "#ffb347", "moss_dark": "#6e8a5e", "moss": "#9caf88",
    "shroom_stem": "#ebddc0", "shroom_cap": "#b8466a", "shroom_spot": "#f6eedb", "sandstone": "#d8c4a0", "glow_green": "#b6f26a",
    "wisp_body": "#a6e6f2", "stone": "#9a9ca3", "glow_cyan": "#7ff0ff",
    "book_cover": "#8e3a4a", "paper": "#f6eedb", "book_corner": "#d9ae55", "glow_gold": "#ffd76a",
    "stone_dark": "#6f727c", "sandstone_dark": "#b39f7e", "glow_teal": "#5ff2d0",
    # Zone 1 (design sheet "Mobs, zone 1"): the crab's front plate and soft back, the wisp's moonstone runes, the pollen sprite.
    "shell_plate": "#7a5b45", "crab_soft": "#f0b49c", "runestone": "#c6cff0",
    "pollen": "#f2cf5b", "pollen_tip": "#fff0b3", "sprout": "#86b85a", "petal": "#fff6e6", "blush": "#f4a7a0", "glow_pollen": "#ff8fc0",
})
TEL = "telegraph"
SOFT = 70                      # organic parts read smooth; thorns, boxes and rock keep hard planes


def eye(pc, p, n, rx, ry, tilt=0.0, depth=0.012):
    """A painted-looking dome eye sitting on a surface point p with normal n (rx across, ry up)."""
    lathe(pc, p - n * depth * 0.5, [(0, -depth), (1, 0), (0.72, depth * 0.55), (0, depth)], n=10, axis=n, sx=rx, sy=ry, tilt=tilt)


def eyes_on(pc, c, r, x, z, rx, ry, tilt):
    for s in (1, -1):
        p, n = on_blob(c, r, s * x, z)
        eye(pc, p, n, rx, ry, tilt=-s * tilt)


def finish(objs, grad=(0.7, 1.0)):
    pe.regrade(objs, grad)
    return objs


# ================================================================ shadow fox (outer wild, lunges)
def shadow_fox():
    M = pe.materials({"M_Fur": "fox_fur", "M_Light": "fox_tip", "M_Dark": "fox_dark", TEL: ("glow_violet", 1.0)})
    HC_, HR = (0, -0.17, 0.34), (0.135, 0.115, 0.112)

    def body(pc):
        pc.mat = "M_Fur"
        pc.blob((0, 0.03, 0.2), (0.095, 0.155, 0.09), segs=8, rings=5)
        pc.mat = "M_Light"
        pc.blob((0, -0.075, 0.175), (0.068, 0.07, 0.075), segs=8, rings=4)             # chest ruff

    def head(pc):
        pc.mat = "M_Fur"
        pc.blob(HC_, HR, segs=8, rings=5)
        for s in (1, -1):                                     # big pointy ears, tipped outward
            lathe(pc, (s * 0.068, -0.155, 0.415), [(0.054, 0), (0.042, 0.065), (0, 0.135)], n=5, axis=(s * 0.4, 0.08, 1), sy=0.62)
        pc.mat = "M_Light"
        lathe(pc, (0, -0.25, 0.305), [(0.058, 0), (0.046, 0.04), (0.022, 0.08), (0, 0.092)], n=6, axis=(0, -1, -0.12), sy=0.75)   # snout
        for s in (1, -1):                                     # cheek tufts
            lathe(pc, (s * 0.1, -0.2, 0.3), [(0.042, 0), (0, 0.075)], n=5, axis=(s, -0.25, -0.45), sy=0.7)
        pc.mat = "M_Dark"
        pc.blob((0, -0.337, 0.297), (0.021, 0.016, 0.016), segs=6, rings=3)           # nose

    def glow(pc):
        pc.mat = TEL
        eyes_on(pc, HC_, HR, 0.06, 0.368, 0.038, 0.025, math.radians(24))

    def tail(pc):
        pc.mat = "M_Fur"
        pc.tube([(0, 0.15, 0.22), (0, 0.24, 0.25), (0, 0.31, 0.33), (0, 0.33, 0.42)], [0.035, 0.075, 0.085, 0.07], sides=7, tip=False)
        pc.mat = "M_Light"
        pc.blob((0, 0.335, 0.47), (0.068, 0.065, 0.07), segs=7, rings=4)
        pc.mat = TEL                                          # a shadow-flame wisp curling off the tip: it flares with the eyes
        pc.tube([(0, 0.34, 0.52), (0.012, 0.325, 0.565), (0, 0.3, 0.6)], [0.03, 0.02, 0.008], sides=5, tip=True)

    def mane(pc):
        """The ruff behind the head: a collar of cream tufts round the neck with violet tips that bristle and glow in the crouch."""
        for k in range(9):
            a = math.radians(-25 + k * 230 / 8)
            out = Vector((math.cos(a), 0.7, math.sin(a))).normalized()
            base = Vector((math.cos(a) * 0.075, -0.07, 0.28 + math.sin(a) * 0.065))
            pc.mat = "M_Light"
            lathe(pc, base, [(0.042, 0), (0.032, 0.05), (0, 0.085)], n=5, axis=out, sy=0.62)
            pc.mat = TEL
            lathe(pc, base + out * 0.068, [(0.016, 0), (0, 0.05)], n=4, axis=out, sy=0.62)

    def leg(x, y):
        def b(pc):
            pc.mat = "M_Dark"                                 # dark socks, like a real fox
            pc.tube([(x, y, 0.16), (x, y - 0.01, 0.05)], [0.03, 0.026], sides=6, tip=False)
            pc.blob((x, y - 0.018, 0.028), (0.034, 0.042, 0.028), segs=6, rings=3)
        return b

    b = pe.part("body", M, body, pivot=(0, 0.03, 0.2), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.1, 0.27), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow, pivot=HC_)
    t = pe.part("tail", M, tail, pivot=(0, 0.15, 0.22), sharp=SOFT)
    mn = pe.part("mane", M, mane, pivot=(0, -0.085, 0.29), sharp=SOFT)
    legs = [pe.part(n, M, leg(x, y), pivot=(x, y, 0.16), sharp=SOFT) for n, x, y in
            (("leg_fl", 0.062, -0.07), ("leg_fr", -0.062, -0.07), ("leg_bl", 0.064, 0.12), ("leg_br", -0.064, 0.12))]
    parent(g, h)
    for o in (h, t, mn, *legs):
        parent(o, b)
    return finish([b, h, g, t, mn, *legs])


# ================================================================ thorn crab + elder (outer wild, sweeps)
def crab(elder=False):
    S = 1.4 if elder else 1.0
    M = pe.materials({"M_Shell": "moss_dark" if elder else "crab_shell", "M_Body": "crab_body", "M_Thorn": "thorn",
                      "M_Plate": "shell_plate", "M_Soft": "crab_soft",
                      TEL: ("glow_amber", 1.0), **({"M_Moss": "moss", "M_Flower": "outfit:9"} if elder else {})})
    P = lambda x, y, z: (x * S, y * S, z * S)

    def body(pc):
        pc.mat = "M_Body"
        pc.blob(P(0, 0.02, 0.12), (0.2 * S, 0.17 * S, 0.075 * S), segs=8, rings=4)
        pc.mat = "M_Shell"
        lathe(pc, P(0, -0.015, 0), [(0, 0.1 * S), (0.2 * S, 0.1 * S), (0.245 * S, 0.165 * S), (0.2 * S, 0.245 * S), (0.11 * S, 0.29 * S), (0, 0.302 * S)],
              n=8, sy=0.9, phase=math.pi / 8)
        pc.mat = "M_Thorn"
        prof = [(0.2, 0.1), (0.245, 0.165), (0.2, 0.245), (0.11, 0.29), (0.0, 0.302)]
        rad = lambda h: next(r0 + (r1 - r0) * (h - h0) / (h1 - h0) for (r0, h0), (r1, h1) in zip(prof, prof[1:]) if h <= h1)
        spikes = [(90, 0.25), (30, 0.24), (150, 0.24), (-25, 0.25), (-155, 0.25), (90, 0.3)]
        if elder:
            spikes += [(0, 0.2), (180, 0.2), (60, 0.19), (120, 0.19)]
        for az, h in spikes:                               # cream thorns on the top and back of the shell
            a = math.radians(az)
            base = Vector(P(rad(h) * math.cos(a), -0.015 + rad(h) * 0.9 * math.sin(a), h))
            lathe(pc, base, [(0.035 * S, -0.01 * S), (0, 0.075 * S)], n=4, axis=(math.cos(a) * rad(h) * 3, math.sin(a) * rad(h) * 3, 1))
        # The front shell (zone 1: hits there glance off): three heavy scutes across the face, thorn studs on their rim.
        for az, w, hgt in ((-90, 0.135, 0.185), (-132, 0.1, 0.16), (-48, 0.1, 0.16)):
            a = math.radians(az)
            n = Vector((math.cos(a), math.sin(a) * 1.1, 0.35)).normalized()
            c = Vector(P(rad(hgt) * math.cos(a) * 1.04, -0.015 + rad(hgt) * 0.95 * math.sin(a), hgt))
            pc.mat = "M_Plate"
            lathe(pc, c - n * 0.01, [(0, -0.012 * S), (1, 0), (0.84, 0.028 * S), (0, 0.04 * S)], n=8, axis=n, sx=w * S, sy=0.095 * S, tilt=0)
            pc.mat = "M_Thorn"
            lathe(pc, c + Vector((0, 0, 0.07 * S)) + n * 0.012, [(0.016 * S, 0), (0, 0.04 * S)], n=4, axis=(n + Vector((0, 0, 1.2))).normalized())
        # The soft back (strike here): a pale membrane between the rear thorns, with a little moss.
        pc.mat = "M_Soft"
        nb = Vector((0, 1, 0.55)).normalized()
        lathe(pc, Vector(P(0, -0.015 + rad(0.2) * 0.96, 0.2)) - nb * 0.012, [(0, -0.01), (1, 0), (0.8, 0.016 * S), (0, 0.022 * S)], n=8, axis=nb, sx=0.1 * S, sy=0.075 * S)
        if elder:                                          # a mossy crown with one flower
            pc.mat = "M_Moss"
            pc.blob(P(0, 0.02, 0.29), (0.13 * S, 0.11 * S, 0.035 * S), segs=8, rings=3)
            pc.mat = "M_Flower"
            for k in range(5):
                a = TAU * k / 5
                pc.blob(P(0.05 + 0.022 * math.cos(a), 0.05 + 0.022 * math.sin(a), 0.325), (0.016 * S, 0.016 * S, 0.008 * S), segs=5, rings=3)

    def eyes(pc):
        pc.mat = "M_Body"
        for s in (1, -1):
            pc.tube([P(s * 0.065, -0.17, 0.18), P(s * 0.085, -0.2, 0.3)], [0.018 * S, 0.014 * S], sides=5, tip=False)

    def glow(pc):
        pc.mat = TEL
        for s in (1, -1):
            pc.blob(P(s * 0.088, -0.205, 0.33), 0.036 * S, segs=7, rings=4)

    def claw(s):
        k = 1.35 if elder and s < 0 else 1.0                # the elder has one big crusher claw

        def b(pc):
            pc.mat = "M_Body"
            pc.tube([P(s * 0.17, -0.1, 0.14), P(s * 0.25, -0.2, 0.16)], [0.032 * S, 0.03 * S], sides=6, tip=False)
            pc.blob(P(s * (0.29 + 0.03 * (k - 1)), -0.3, 0.2), (0.075 * S * k, 0.1 * S * k, 0.062 * S * k), segs=8, rings=4)      # upper jaw
            pc.blob(P(s * 0.27, -0.31, 0.135 - 0.03 * (k - 1)), (0.05 * S * k, 0.085 * S * k, 0.034 * S * k), segs=6, rings=3)  # lower jaw
            pc.mat = "M_Thorn"
            lathe(pc, P(s * 0.3, -0.28, 0.25), [(0.02 * S, 0), (0, 0.06 * S)], n=4, axis=(s * 0.3, 0.2, 1))
            if elder:
                lathe(pc, P(s * 0.34, -0.33, 0.22), [(0.018 * S, 0), (0, 0.05 * S)], n=4, axis=(s, -0.3, 0.6))
        return b

    def legs(s):
        def b(pc):
            pc.mat = "M_Body"
            for y in (-0.06, 0.04, 0.13):
                pc.tube([P(s * 0.17, y, 0.11), P(s * 0.27, y + 0.02, 0.1), P(s * 0.32, y + 0.03, 0.0)], [0.022 * S, 0.018 * S, 0.012 * S],
                        sides=4, tip=True)
        return b

    def crack(pc):
        """The elder's shell splitting at 60% (shown from phase 2): glowing seams branching over the dome from its crown."""
        pc.mat = TEL
        top = 0.302 * S
        for az0, turns in ((-60, (15, -20, 25)), (100, (-25, 20, -10)), (200, (20, -15))):
            pts, az = [], math.radians(az0)
            for i, h in enumerate([0.29, 0.26, 0.22, 0.18][:len(turns) + 1]):
                if i:
                    az += math.radians(turns[i - 1])
                r = rad(h) * S * 1.03
                pts.append(Vector((r * math.cos(az), -0.015 * S + r * 0.9 * math.sin(az), h * S + 0.006)))
            pc.tube([Vector((0, -0.015 * S, top)), *pts], [0.011 * S] * (len(pts) + 1), sides=4, tip=False)

    prof = [(0.2, 0.1), (0.245, 0.165), (0.2, 0.245), (0.11, 0.29), (0.0, 0.302)]
    rad = lambda h: next(r0 + (r1 - r0) * (h - h0) / (h1 - h0) for (r0, h0), (r1, h1) in zip(prof, prof[1:]) if h <= h1)
    b = pe.part("body", M, body, pivot=P(0, 0, 0.12), sharp=SOFT)
    e = pe.part("eyes", M, eyes, pivot=P(0, -0.17, 0.18), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow, pivot=P(0, -0.205, 0.33))
    cl, cr = (pe.part(n, M, claw(s), pivot=P(s * 0.17, -0.1, 0.14), sharp=SOFT) for n, s in (("claw_l", 1), ("claw_r", -1)))
    ll, lr = (pe.part(n, M, legs(s), pivot=P(s * 0.17, 0.04, 0.11)) for n, s in (("legs_l", 1), ("legs_r", -1)))
    parent(g, e)
    for o in (e, cl, cr, ll, lr):
        parent(o, b)
    objs = [b, e, g, cl, cr, ll, lr]
    if elder:
        k = pe.part("glow_crack", M, crack, pivot=P(0, -0.015, 0.302))
        parent(k, b)
        objs.append(k)
    return finish(objs)



# ================================================================ mushroom beast (outer wild, spits spores)
CAP = [(0.1, 0.31), (0.32, 0.33), (0.36, 0.4), (0.31, 0.5), (0.19, 0.58), (0, 0.615)]
h1_between = lambda h, a, b: min(a, b) <= h <= max(a, b)


def mushroom_beast():
    M = pe.materials({"M_Stem": "shroom_stem", "M_Cap": "shroom_cap", "M_Spot": "shroom_spot", "M_Gill": "sandstone", TEL: ("glow_green", 1.0)})
    SC, SR = (0, 0, 0.19), (0.155, 0.14, 0.19)

    def body(pc):
        pc.mat = "M_Stem"
        lathe(pc, (0, 0, 0), [(0, 0.035), (0.12, 0.04), (0.155, 0.13), (0.15, 0.25), (0.115, 0.35)], n=8, sy=0.9)
        for s in (1, -1):                                   # stubby arms
            pc.blob((s * 0.16, -0.02, 0.15), (0.045, 0.04, 0.06), segs=6, rings=3)

    def cap(pc):
        pc.mat = "M_Cap"
        gill = lambda i, k: "M_Gill" if i == 0 else None
        lathe(pc, (0, 0, 0), CAP, n=10, mat=gill)
        pc.mat = "M_Spot"
        top = CAP[2:]
        for az, h, r in ((-90, 0.47, 0.062), (-35, 0.44, 0.05), (-145, 0.45, 0.05), (35, 0.5, 0.055), (145, 0.5, 0.05), (90, 0.45, 0.055), (0, 0.6, 0.045)):
            (r0, h0), (r1, h1) = next((p, q) for p, q in zip(top, top[1:]) if h1_between(h, p[1], q[1]))
            k = (h - h0) / (h1 - h0)
            rr, a = r0 + (r1 - r0) * k, math.radians(az)
            nr, nh = (h1 - h0), -(r1 - r0)
            n = Vector((nr * math.cos(a), nr * math.sin(a), nh)).normalized()
            lathe(pc, Vector((rr * math.cos(a), rr * math.sin(a), h)) - n * 0.002, [(0, -0.006), (1, 0), (0.7, 0.006), (0, 0.009)],
                  n=7, axis=n, sx=r, sy=r)

    def glow(pc):
        pc.mat = TEL
        eyes_on(pc, SC, SR, 0.058, 0.23, 0.03, 0.022, math.radians(20))

    def foot(x):
        def b(pc):
            pc.mat = "M_Stem"
            pc.blob((x, -0.03, 0.04), (0.07, 0.09, 0.045), segs=7, rings=4)
        return b

    b = pe.part("body", M, body, pivot=(0, 0, 0.05), sharp=SOFT)
    c = pe.part("cap", M, cap, pivot=(0, 0, 0.32), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow, pivot=(0, -0.14, 0.23))
    fl, fr = (pe.part(n, M, foot(x), pivot=(x, -0.03, 0.08), sharp=SOFT) for n, x in (("foot_l", 0.085), ("foot_r", -0.085)))
    for o in (c, g, fl, fr):
        parent(o, b)
    return finish([b, c, g, fl, fr])


# ================================================================ rune wisp (outer wild, rune bolts, blinks to keep range)
def rune_wisp():
    """A flame-drop spirit with four moonstone rune shards orbiting it; the glyphs cut into the shards are its telegraph."""
    M = pe.materials({"M_Wisp": ("wisp_body", 0.35), "M_Eye": "outfit:12", "M_Rune": "runestone", TEL: ("glow_cyan", 1.0)})
    K = 1.45

    def body(pc):
        pc.mat = "M_Wisp"
        lathe(pc, (0, 0, 0), [(0, -0.13 * K), (0.08 * K, -0.105 * K), (0.115 * K, -0.03 * K), (0.105 * K, 0.05 * K), (0.07 * K, 0.12 * K),
                              (0.03 * K, 0.18 * K), (0, 0.215 * K)], n=10)
        pc.tube([(0, 0.0, 0.19 * K), (0, 0.035 * K, 0.24 * K), (0, 0.08 * K, 0.25 * K)], [0.022 * K, 0.015 * K, 0.008 * K], sides=5, tip=True, cap=False)
        for s_ in (1, -1):                                  # two little flame wisps trailing below
            pc.tube([(s_ * 0.05 * K, 0.02, -0.1 * K), (s_ * 0.07 * K, 0.05, -0.17 * K), (s_ * 0.05 * K, 0.07, -0.22 * K)], [0.022 * K, 0.014 * K, 0.006 * K], sides=5, tip=True)
        pc.mat = "M_Eye"
        eyes_on(pc, (0, 0, 0.0), (0.112 * K, 0.112 * K, 0.2 * K), 0.042 * K, 0.02 * K, 0.019 * K, 0.03 * K, 0.0)

    def ring(pc):
        for k in range(4):                                  # four moonstone shards, each with a rune cut into its outer face
            a = TAU * k / 4 + math.pi / 4
            out = Vector((math.cos(a), math.sin(a), 0))
            c = out * 0.32 + Vector((0, 0, -0.02))
            up = (Vector((0, 0, 1)) + out * 0.18).normalized()
            pc.mat = "M_Rune"
            lathe(pc, c, [(0, -0.13), (0.065, -0.02), (0.056, 0.05), (0, 0.145)], n=4, axis=up, phase=a, sx=1.0, sy=0.55)
            pc.mat = TEL
            face = c + out * 0.037
            side = Vector((-math.sin(a), math.cos(a), 0))
            for p0, p1 in (((0, -0.07), (0, 0.08)), ((0, 0.015), (0.034, 0.06)), ((0, -0.025), (-0.034, -0.065))):
                q0, q1 = face + side * p0[0] + up * p0[1], face + side * p1[0] + up * p1[1]
                pc.tube([q0, q1], [0.01, 0.01], sides=4, tip=False)

    b = pe.part("body", M, body, sharp=SOFT)
    r = pe.part("ring", M, ring, first="M_Rune")
    parent(r, b)
    return finish([b, r], (0.8, 1.0))


# ================================================================ pollen sprite (outer wild, a swarm that darts and bursts)
def pollen_sprite():
    """A dandelion-puff of pollen with a sprout on its head, two pairs of petal wings and big eyes that flash before it
    darts (its telegraph). Tiny and many: kept under 450 triangles. Centred on its origin; the engine hovers it."""
    M = pe.materials({"M_Pollen": "pollen", "M_Tip": "pollen_tip", "M_Sprout": "sprout", "M_Petal": "petal", "M_Blush": "blush",
                      TEL: ("glow_pollen", 1.0)})
    BC, BR = (0, 0, 0), (0.12, 0.112, 0.112)

    def body(pc):
        pc.mat = "M_Pollen"
        pc.blob(BC, BR, segs=9, rings=6)
        pc.mat = "M_Tip"
        for k in range(16):                                 # the fluff: soft spikes all round, fewer in front of the face
            z = 1 - 2 * (k + 0.5) / 16
            a = k * 2.39996
            d = Vector((math.sqrt(1 - z * z) * math.cos(a), math.sqrt(1 - z * z) * math.sin(a), z))
            if d.y < -0.55 and abs(d.z) < 0.6:
                continue
            lathe(pc, Vector(BC) + Vector((d.x * BR[0], d.y * BR[1], d.z * BR[2])) * 0.92, [(0.022, 0), (0, 0.045)], n=4, axis=d)
        pc.mat = "M_Sprout"                                 # a sprout with two leaves
        pc.tube([(0, 0.01, 0.085), (0.005, 0.02, 0.13), (0.0, 0.03, 0.15)], [0.011, 0.009, 0.007], sides=5, tip=False)
        for s_ in (1, -1):
            lathe(pc, (s_ * 0.025, 0.03, 0.152), [(0, -0.004), (1, 0), (0, 0.006)], n=6, axis=(s_ * 0.5, 0.1, 1), sx=0.032, sy=0.016, tilt=s_ * 0.5)
        pc.mat = "M_Blush"
        for s_ in (1, -1):
            p, n = on_blob(BC, BR, s_ * 0.055, -0.012)
            lathe(pc, p - n * 0.002, [(0, -0.002), (1, 0), (0, 0.004)], n=6, axis=n, sx=0.016, sy=0.01)

    def glow(pc):
        pc.mat = TEL                                        # rose eyes and a bud on the sprout: dim at rest, a bright flash before the dart
        eyes_on(pc, BC, BR, 0.04, 0.018, 0.03, 0.036, math.radians(10))
        pc.blob((0.0, 0.03, 0.162), (0.02, 0.02, 0.026), segs=6, rings=4)

    def wing(s_):
        def b(pc):
            pc.mat = "M_Petal"                              # an upper and a lower petal, flat and turned up-back
            for (ox, oz, sx, sy, tilt) in ((0.085, 0.05, 0.075, 0.042, 0.5), (0.07, 0.0, 0.05, 0.03, -0.2)):
                lathe(pc, (s_ * ox, 0.04, oz), [(0, -0.004), (1, 0), (0.85, 0.006), (0, 0.008)], n=8, axis=(s_ * 0.15, 0.55, 0.8),
                      sx=sx, sy=sy, tilt=s_ * tilt)
        return b

    b = pe.part("body", M, body, sharp=SOFT)
    g = pe.part("glow_eyes", M, glow, pivot=(0, -0.09, 0.018))
    wl, wr = (pe.part(n, M, wing(s_), pivot=(s_ * 0.05, 0.04, 0.03), sharp=SOFT) for n, s_ in (("wing_l", 1), ("wing_r", -1)))
    for o in (g, wl, wr):
        parent(o, b)
    return finish([b, g, wl, wr], (0.8, 1.0))


# ================================================================ animated book (inner temple, snapping charge)
def animated_book():
    M = pe.materials({"M_Cover": "book_cover", "M_Paper": "paper", "M_Corner": "book_corner", "M_Ribbon": "crab_body", TEL: ("glow_gold", 1.0)})
    W, D, T = 0.44, 0.34, 0.035                          # width (X), depth (Y), cover thickness
    HINGE = (0, D / 2 - 0.01, 0.15)

    def corners(pc, z):
        pc.mat = "M_Corner"
        for sx in (1, -1):
            rbox(pc, (sx * (W / 2 - 0.03), -D / 2 + 0.03, z), (0.07, 0.07, T + 0.008), ch=0.3)

    def body(pc):
        pc.mat = "M_Cover"
        rbox(pc, (0, 0, T / 2), (W, D, T), ch=0.4)
        rbox(pc, (0, D / 2 - 0.018, 0.09), (W, 0.036, 0.19), ch=0.4)            # spine
        pc.mat = "M_Paper"
        rbox(pc, (0, 0.006, T + 0.036), (W - 0.04, D - 0.03, 0.075), ch=0.3)
        corners(pc, T / 2)
        teeth(pc, T + 0.072, 1)
        pc.mat = "M_Ribbon"                                  # the bookmark sticks out like a tongue
        pc.tube([(0.04, -0.1, T + 0.075), (0.045, -D / 2 - 0.02, T + 0.07), (0.05, -D / 2 - 0.07, 0.03), (0.055, -D / 2 - 0.08, 0.004)],
                [(0.03, 0.005)] * 4, sides=4, tip=False)

    def lid(pc):
        z = 0.15
        pc.mat = "M_Cover"
        rbox(pc, (0, 0, z + T / 2), (W, D, T), ch=0.4)
        pc.mat = "M_Paper"
        rbox(pc, (0, 0.006, z - 0.03), (W - 0.04, D - 0.03, 0.06), ch=0.3)
        teeth(pc, z - 0.06, -1)
        corners(pc, z + T / 2)

    def teeth(pc, z, d):
        """A row of little paper points along the front edge: the book's mouth, not a gory one."""
        pc.mat = "M_Paper"
        for k in range(6):
            x = (k - 2.5) * 0.06
            lathe(pc, (x, -D / 2 + 0.03, z), [(0.022, 0), (0, 0.04)], n=3, axis=(0, 0, d), phase=math.pi / 2)

    def glow(pc):
        pc.mat = TEL
        for s in (1, -1):                                  # frog-like domes on the lid's front edge, so they read from the front
            lathe(pc, (s * 0.09, -0.1, 0.15 + T - 0.004), [(0, 0), (1, 0.004), (0.8, 0.03), (0, 0.042)], n=8, axis=(0, -0.35, 1), sx=0.045, sy=0.038,
                  tilt=s * math.radians(-15))

    b = pe.part("body", M, body, pivot=(0, 0, 0.05))
    lidp = pe.part("lid", M, lid, pivot=HINGE)
    g = pe.part("glow_eyes", M, glow, pivot=(0, -0.07, 0.15 + T))
    parent(g, lidp)
    lidp.rotation_euler.x = math.radians(-34)           # open: the hinge is the snap joint
    parent(lidp, b)
    return finish([b, lidp, g])


# ================================================================ stone golem (inner temple elite, ground slam)
def stone_golem():
    M = pe.materials({"M_Stone": "stone", "M_Dark": "stone_dark", "M_Moss": "moss", TEL: ("glow_cyan", 1.0)})
    TC, TR = (0, 0, 0.62), (0.33, 0.25, 0.3)
    HC_, HR = (0, -0.1, 0.98), (0.15, 0.13, 0.12)

    def body(pc):
        pc.mat = "M_Stone"
        pc.blob(TC, TR, segs=8, rings=5)
        pc.mat = "M_Moss"
        pc.blob((0, 0.04, 0.87), (0.27, 0.2, 0.07), segs=8, rings=3)

    def head(pc):
        pc.mat = "M_Dark"
        pc.blob(HC_, HR, segs=8, rings=4)
        pc.mat = "M_Moss"
        pc.blob((0.03, -0.08, 1.085), (0.09, 0.08, 0.03), segs=6, rings=3)

    def glow_eyes(pc):
        pc.mat = TEL
        eyes_on(pc, HC_, HR, 0.055, 0.985, 0.03, 0.024, math.radians(12))

    def glow_core(pc):
        pc.mat = TEL
        p, n = on_blob(TC, TR, 0, 0.66)
        lathe(pc, p - n * 0.006, [(0, -0.006), (1, 0), (0.6, 0.01), (0, 0.014)], n=4, axis=n, sx=0.075, sy=0.085)
        for x, z, lean in ((0.12, 0.8, 0.5), (-0.1, 0.85, -0.4), (0.0, 0.74, 0.0)):      # crystals on the back
            p, n = on_blob(TC, TR, x, z, side=1)
            lathe(pc, p - n * 0.02, [(0.035, 0), (0.03, 0.08), (0, 0.15)], n=5, axis=(n + Vector((lean, 0.3, 0.6))).normalized())

    def arm(s):
        def b(pc):
            pc.mat = "M_Stone"
            pc.blob((s * 0.38, 0.0, 0.76), (0.12, 0.12, 0.13), segs=7, rings=4)
            pc.blob((s * 0.42, -0.04, 0.5), (0.1, 0.1, 0.13), segs=7, rings=4)
            pc.mat = "M_Dark"
            pc.blob((s * 0.44, -0.08, 0.26), (0.16, 0.15, 0.15), segs=8, rings=4)
            pc.mat = "M_Moss"
            pc.blob((s * 0.4, 0.0, 0.87), (0.09, 0.08, 0.03), segs=6, rings=3)
        return b

    def leg(s):
        def b(pc):
            pc.mat = "M_Dark"
            pc.blob((s * 0.16, 0.0, 0.13), (0.13, 0.14, 0.14), segs=7, rings=4)
        return b

    b = pe.part("body", M, body, pivot=(0, 0, 0.35), sharp=38)
    h = pe.part("head", M, head, pivot=(0, -0.05, 0.88), sharp=38)
    ge = pe.part("glow_eyes", M, glow_eyes, pivot=HC_)
    gc = pe.part("glow_core", M, glow_core, pivot=TC)
    al, ar = (pe.part(n, M, arm(s), pivot=(s * 0.32, 0, 0.8), sharp=38) for n, s in (("arm_l", 1), ("arm_r", -1)))
    ll, lr = (pe.part(n, M, leg(s), pivot=(s * 0.16, 0, 0.3), sharp=38) for n, s in (("leg_l", 1), ("leg_r", -1)))
    for i, o in enumerate((b, h, al, ar, ll, lr)):
        pe.jitter(o, 0.018, seed=11 + i)
    parent(ge, h)
    for o in (h, gc, al, ar, ll, lr):
        parent(o, b)
    return finish([b, h, ge, gc, al, ar, ll, lr])


# ================================================================ guardian statue (boss chamber)
def guardian_statue():
    M = pe.materials({"M_Stone": "sandstone", "M_Dark": "sandstone_dark", "M_Moss": "moss", TEL: ("glow_teal", 1.0)})
    HC_ = (0, -0.04, 1.98)

    def body(pc):
        pc.mat = "M_Stone"
        lathe(pc, (0, 0, 0), [(0, 0.0), (0.66, 0.0), (0.66, 0.1), (0.58, 0.16), (0.52, 0.8), (0.46, 0.92)], n=10, phase=math.pi / 10)   # robe on a plinth
        rbox(pc, (0, 0, 1.28), (0.92, 0.6, 0.78), ch=0.35)                                            # chest
        pc.mat = "M_Dark"
        lathe(pc, (0, 0, 0.86), [(0.5, 0), (0.53, 0.05), (0.53, 0.13), (0.5, 0.18)], n=10, phase=math.pi / 10)          # belt
        lathe(pc, (0, 0, 1.62), [(0.2, 0), (0.22, 0.06), (0.16, 0.14)], n=8)                        # neck ring
        pc.mat = "M_Moss"
        pc.blob((0.22, -0.05, 1.66), (0.2, 0.16, 0.05), segs=8, rings=3)
        pc.blob((-0.4, 0.2, 0.16), (0.22, 0.18, 0.06), segs=8, rings=3)

    def head(pc):
        pc.mat = "M_Stone"
        pc.blob(HC_, (0.31, 0.27, 0.27), segs=10, rings=6)
        pc.mat = "M_Dark"
        lathe(pc, (0, -0.02, 2.16), [(0.31, 0), (0.34, 0.03), (0.33, 0.08), (0.28, 0.1)], n=10)       # helm band
        lathe(pc, (0, 0.02, 2.26), [(0.05, 0), (0.06, 0.12), (0, 0.24)], n=5, axis=(0, 0.25, 1), sx=0.5, sy=2.2)   # crest
        pc.mat = "M_Moss"
        pc.blob((-0.14, 0.05, 2.3), (0.13, 0.11, 0.035), segs=7, rings=3)

    def glow_eyes(pc):
        pc.mat = TEL
        for s in (1, -1):
            p, n = on_blob(HC_, (0.31, 0.27, 0.27), s * 0.12, 1.99)
            eye(pc, p, n, 0.07, 0.048, tilt=-s * math.radians(14), depth=0.018)

    def glow_sigil(pc):                                   # chest sigil: a ring of four marks around a diamond
        pc.mat = TEL
        n = Vector((0, -1, 0))
        c = Vector((0, -0.302, 1.3))
        lathe(pc, c, [(0, -0.006), (1, 0), (0, 0.012)], n=4, axis=n, sx=0.1, sy=0.16)
        for k in range(4):
            a = TAU * k / 4
            lathe(pc, c + Vector((math.cos(a) * 0.25, 0, math.sin(a) * 0.25)), [(0, -0.006), (1, 0), (0, 0.01)], n=4, axis=n, sx=0.045, sy=0.045)

    def glow_halo(pc):                                    # a rune halo behind the head, readable from the top camera
        pc.mat = TEL
        pc.tube([(0.44 * math.cos(TAU * k / 14), 0.2, 2.0 + 0.44 * math.sin(TAU * k / 14)) for k in range(14)], [0.022] * 14, sides=5, closed_loop=True)
        for k in range(4):
            a = TAU * k / 4 + math.pi / 4
            lathe(pc, (0.44 * math.cos(a), 0.2, 2.0 + 0.44 * math.sin(a)), [(0, -0.02), (1, 0), (0, 0.02)], n=4, axis=(0, -1, 0), sx=0.05, sy=0.05)

    def arm(s):
        def b(pc):
            pc.mat = "M_Dark"
            pc.blob((s * 0.58, 0.0, 1.58), (0.24, 0.24, 0.2), segs=8, rings=4)                       # pauldron
            pc.mat = "M_Stone"
            pc.tube([(s * 0.62, 0, 1.45), (s * 0.66, -0.03, 1.2)], [0.13, 0.12], sides=7, tip=False)
            rbox(pc, (s * 0.68, -0.07, 1.0), (0.3, 0.3, 0.36), ch=0.4)                                  # gauntlet
            pc.blob((s * 0.72, -0.12, 0.72), (0.26, 0.25, 0.23), segs=8, rings=5)                      # fist
        return b

    def glow_arm(s):
        def b(pc):
            pc.mat = TEL
            lathe(pc, (s * 0.68, -0.07, 1.0), [(0.155, -0.03), (0.158, 0), (0.155, 0.03)], n=8, phase=math.pi / 8)   # rune band
        return b

    b = pe.part("body", M, body, pivot=(0, 0, 0.9), sharp=40)
    h = pe.part("head", M, head, pivot=(0, 0, 1.72), sharp=40)
    ge = pe.part("glow_eyes", M, glow_eyes, pivot=HC_)
    gs = pe.part("glow_sigil", M, glow_sigil, pivot=(0, -0.3, 1.3))
    gh = pe.part("glow_halo", M, glow_halo, pivot=(0, 0.2, 2.0))
    al, ar = (pe.part(n, M, arm(s), pivot=(s * 0.55, 0, 1.55), sharp=40) for n, s in (("arm_l", 1), ("arm_r", -1)))
    gl, gr = (pe.part(n, M, glow_arm(s), pivot=(s * 0.68, -0.07, 1.0)) for n, s in (("glow_arm_l", 1), ("glow_arm_r", -1)))
    for i, o in enumerate((b, h, al, ar)):
        pe.jitter(o, 0.012, seed=31 + i)
    parent(ge, h)
    parent(gh, h)
    parent(gl, al)
    parent(gr, ar)
    for o in (h, gs, al, ar):
        parent(o, b)
    return finish([b, h, ge, gs, gh, al, ar, gl, gr])


MODELS = [("shadow-fox", shadow_fox, 900), ("thorn-crab", crab, 800), ("mushroom-beast", mushroom_beast, 800),
          ("rune-wisp", rune_wisp, 800), ("pollen-sprite", pollen_sprite, 500), ("animated-book", animated_book, 800), ("stone-golem", stone_golem, 1200),
          ("elder-thorn-crab", lambda: crab(elder=True), 1200), ("guardian-statue", guardian_statue, 2500)]

if __name__ == "__main__":
    pe.build_all(MODELS, "enemies", ONLY)
