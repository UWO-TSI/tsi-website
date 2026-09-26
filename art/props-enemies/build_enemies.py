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
TEL = "telegraph"
SOFT = 70                      # organic parts read smooth; thorns, boxes and rock keep hard planes


def eye(pc, p, n, rx, ry, tilt=0.0, depth=0.012):
    """A painted-looking dome eye sitting on a surface point p with normal n (rx across, ry up)."""
    lathe(pc, p - n * depth * 0.5, [(0, -depth), (1, 0), (0.72, depth * 0.55), (0, depth)], n=8, axis=n, sx=rx, sy=ry, tilt=tilt)


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
        eyes_on(pc, HC_, HR, 0.058, 0.37, 0.04, 0.03, math.radians(18))

    def tail(pc):
        pc.mat = "M_Fur"
        pc.tube([(0, 0.15, 0.22), (0, 0.24, 0.25), (0, 0.31, 0.33), (0, 0.33, 0.42)], [0.035, 0.075, 0.085, 0.07], sides=7, tip=False)
        pc.mat = "M_Light"
        pc.blob((0, 0.335, 0.47), (0.068, 0.065, 0.07), segs=7, rings=4)

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
    legs = [pe.part(n, M, leg(x, y), pivot=(x, y, 0.16), sharp=SOFT) for n, x, y in
            (("leg_fl", 0.062, -0.07), ("leg_fr", -0.062, -0.07), ("leg_bl", 0.064, 0.12), ("leg_br", -0.064, 0.12))]
    parent(g, h)
    for o in (h, t, *legs):
        parent(o, b)
    return finish([b, h, g, t, *legs])


# ================================================================ thorn crab + elder (outer wild, sweeps)
def crab(elder=False):
    S = 1.4 if elder else 1.0
    M = pe.materials({"M_Shell": "moss_dark" if elder else "crab_shell", "M_Body": "crab_body", "M_Thorn": "thorn",
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

    b = pe.part("body", M, body, pivot=P(0, 0, 0.12), sharp=SOFT)
    e = pe.part("eyes", M, eyes, pivot=P(0, -0.17, 0.18), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow, pivot=P(0, -0.205, 0.33))
    cl, cr = (pe.part(n, M, claw(s), pivot=P(s * 0.17, -0.1, 0.14), sharp=SOFT) for n, s in (("claw_l", 1), ("claw_r", -1)))
    ll, lr = (pe.part(n, M, legs(s), pivot=P(s * 0.17, 0.04, 0.11)) for n, s in (("legs_l", 1), ("legs_r", -1)))
    parent(g, e)
    for o in (e, cl, cr, ll, lr):
        parent(o, b)
    return finish([b, e, g, cl, cr, ll, lr])



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


# ================================================================ rune wisp (inner temple, floats, rune bolts)
def rune_wisp():
    M = pe.materials({"M_Wisp": ("wisp_body", 0.35), "M_Eye": "outfit:12", "M_Stone": "stone", TEL: ("glow_cyan", 1.0)})
    K = 1.45

    def body(pc):
        pc.mat = "M_Wisp"
        lathe(pc, (0, 0, 0), [(0, -0.13 * K), (0.08 * K, -0.105 * K), (0.115 * K, -0.03 * K), (0.105 * K, 0.05 * K), (0.07 * K, 0.12 * K),
                              (0.03 * K, 0.18 * K), (0, 0.215 * K)], n=10)
        pc.tube([(0, 0.0, 0.19 * K), (0, 0.035 * K, 0.24 * K), (0, 0.08 * K, 0.25 * K)], [0.022 * K, 0.015 * K, 0.008 * K], sides=5, tip=True, cap=False)
        pc.mat = "M_Eye"
        eyes_on(pc, (0, 0, 0.0), (0.112 * K, 0.112 * K, 0.2 * K), 0.042 * K, 0.02 * K, 0.019 * K, 0.03 * K, 0.0)

    def ring(pc):
        for k in range(4):                                  # four rune tablets orbiting the flame
            a = TAU * k / 4 + math.pi / 4
            out = Vector((math.cos(a), math.sin(a), 0))
            c = out * 0.3 + Vector((0, 0, -0.02))
            pc.mat = "M_Stone"
            rbox(pc, c, (0.1, 0.036, 0.13), ch=0.3, rot=Matrix.Rotation(a + math.pi / 2, 3, "Z"))
            pc.mat = TEL
            lathe(pc, c + out * 0.02, [(0, -0.004), (1, 0.0), (0, 0.007)], n=4, axis=out, sx=0.04, sy=0.06, phase=math.pi / 4)

    b = pe.part("body", M, body, sharp=SOFT)
    r = pe.part("ring", M, ring, first="M_Stone")
    parent(r, b)
    return finish([b, r], (0.8, 1.0))


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
            pc.blob((s * 0.7, -0.1, 0.74), (0.2, 0.2, 0.18), segs=8, rings=5)                          # fist
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


MODELS = [("shadow-fox", shadow_fox, 800), ("thorn-crab", crab, 800), ("mushroom-beast", mushroom_beast, 800),
          ("rune-wisp", rune_wisp, 800), ("animated-book", animated_book, 800), ("stone-golem", stone_golem, 1200),
          ("elder-thorn-crab", lambda: crab(elder=True), 1200), ("guardian-statue", guardian_statue, 2500)]

if __name__ == "__main__":
    pe.build_all(MODELS, "enemies", ONLY)
