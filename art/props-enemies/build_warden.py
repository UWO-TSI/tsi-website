"""The Warden wave's models (classes v2: Summoner, Shaman, Druid, Priest), hand-built here, no downloads.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_warden.py [-- id ...]

Weapons (web/public/assets/game/weapons/<type>-<tier>.glb): one base mesh per signature type and the shared trim kit by
tier (1 wood and cloth, 2 iron bands, 3 rune-etched grooves that glow, 4 gold trim and a brighter glow part, 5 the
runes round the glow part). Grip at the origin (the hand socket), the long axis +Z, the front -Y, as build_weapons.py.
The seal gloves are worn: a mitt round the right fist with the seal on its back.

Bodies (web/public/assets/game/enemies/<id>.glb), named parts the engine poses (telegraph.ts: body, head, glow_eyes,
wing_l/_r, leg_*, tail, arm_l/_r, ring), feet on z = 0, facing -Y: the Summoner's four shadow beasts (green-eyed) and the
untamed forms the ritual calls (violet-eyed, ragged), the Shaman's three totems and its spirit post, the three spirits
Awakening raises. Props (web/public/assets/game/props/): the World Tree, a thorn-wall segment, the flood's rabbit.

Matte everywhere (roughness 0.9, no metal); emissive only where magic glows (eyes, gems, runes, the spirits).
Rig units: the v6 character is 1.045 tall and the engine scales everything by 1.3.
"""
import math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pe  # noqa: E402
from pe import TAU, lathe, rbox, on_blob, parent  # noqa: E402

pe.reset()
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
SOFT = 70
TEL = "telegraph"

# ================================================================ palette
INK, INK_HI, INK_LO = "#24222c", "#3a3747", "#121118"
GREEN_GLOW, VIOLET_GLOW = "#57f09a", "#b47cff"
WOOD, WOOD_DARK, WOOD_PALE, BARK = "#9a6a43", "#6b4a31", "#d8c09a", "#7d5c3c"
CLOTH, CLOTH_RED, CLOTH_TEAL = "#e6dcc3", "#b8574a", "#3f8f86"
IRON, GOLD, BRASS = "#7d8590", "#e2b84a", "#c79a45"
LEAF, LEAF_DARK, BLOSSOM = "#7fbf52", "#4e8a35", "#f2b6c8"
STONE, STONE_DARK = "#a3a19b", "#77756f"
SUN, SUN_HOT = "#ffcf5a", "#fff3c4"


def glowc(hexc, s=0.6):
    return (hexc, s)


def finish(objs, grad=(0.72, 1.0)):
    pe.regrade(objs, grad)
    return objs


# ================================================================ the trim kit (tiers)
TIER = {1: dict(band=None, rune=0.0, glow=0.35, gold=False, crown=False), 2: dict(band=IRON, rune=0.0, glow=0.45, gold=False, crown=False),
        3: dict(band=IRON, rune=0.5, glow=0.6, gold=False, crown=False), 4: dict(band=GOLD, rune=0.7, glow=0.9, gold=True, crown=False),
        5: dict(band=GOLD, rune=1.0, glow=1.3, gold=True, crown=True)}


def bands(pc, zs, r, mat="M_Band"):
    """Metal rings round a shaft (tier 2 iron, tier 4-5 gold)."""
    pc.mat = mat
    for z in zs:
        lathe(pc, (0, 0, z), [(r * 1.02, -0.012), (r * 1.22, -0.004), (r * 1.22, 0.004), (r * 1.02, 0.012)], n=8)


def runes(pc, zs, r, mat="M_Rune"):
    """Glowing rune grooves on a shaft (tier 3+): short notches round it, in a band."""
    pc.mat = mat
    for z in zs:
        for k in range(5):
            a = TAU * k / 5 + z * 7
            c = Vector((math.cos(a) * r * 1.01, math.sin(a) * r * 1.01, z))
            rbox(pc, c, (0.006, 0.006, 0.026), ch=0, rot=Matrix.Rotation(a, 3, "Z"))


def wrap(pc, z0, z1, r, mat="M_Cloth"):
    """Cloth wrapped round the grip: a spiral of flat turns."""
    pc.mat = mat
    n = 7
    for i in range(n):
        z = z0 + (z1 - z0) * (i + 0.5) / n
        lathe(pc, (0, 0, z), [(r * 1.06, -0.011), (r * 1.16, 0), (r * 1.06, 0.011)], n=7, tilt=0.25 * (1 if i % 2 else -1))


def weapon(wid, mats, build, sharp=50):
    ob = pe.part(wid, pe.materials(mats), build, sharp=sharp)
    pe.regrade([ob], (0.8, 1.0))
    return [ob]


def tier_mats(t, base):
    """The trim kit's materials for tier t: metal bands, rune grooves and the glow part's strength."""
    T = TIER[t]
    m = dict(base)
    m["M_Band"] = T["band"] or base.get("M_Band", IRON)
    m["M_Rune"] = glowc(base["glow"], T["rune"] or 0.3)
    m["M_Glow"] = glowc(base["glow"], T["glow"])
    m.pop("glow", None)
    return m


# ---------------------------------------------------------------- seal gloves (the Summoner)
def seal_gloves(t):
    """A worn mitt round the right fist: ink leather, a stitched cuff, the seal (a ring and a hand-sign glyph) on the
    back of the hand that glows the class green; tiers add iron studs, glowing stitch runes, a gold cuff, a crown of
    seal sigils floating round the wrist."""
    T = TIER[t]

    def b(pc):
        pc.mat = "M_Leather"
        pc.blob((0, -0.004, 0.004), (0.036, 0.04, 0.038), segs=9, rings=5)        # the fist
        for k in range(4):                                                         # four curled fingers in front
            pc.blob((-0.021 + k * 0.014, -0.037, 0.016 - 0.003 * abs(k - 1.5)), (0.0085, 0.01, 0.012), segs=6, rings=3)
        pc.tube([(0.03, -0.012, -0.012), (0.036, -0.03, 0.006)], [0.011, 0.009], sides=6, tip=False)   # the thumb
        pc.mat = "M_Cuff"
        lathe(pc, (0, 0.002, -0.044), [(0.029, -0.014), (0.034, -0.004), (0.033, 0.006), (0.028, 0.012)], n=10)
        pc.mat = "M_Glow"                                                           # the seal, on both faces of the hand
        for sx in (1, -1):
            lathe(pc, (sx * 0.034, -0.002, 0.008), [(0.012, -0.0015), (0.017, 0), (0.012, 0.0015)], n=12, axis=(sx, 0, 0))
            rbox(pc, (sx * 0.0352, -0.002, 0.008), (0.003, 0.004, 0.02), ch=0)
            rbox(pc, (sx * 0.0352, -0.002, 0.008), (0.003, 0.016, 0.004), ch=0)
        if T["band"]:
            pc.mat = "M_Band"
            for k in range(4):
                pc.blob((-0.021 + k * 0.014, -0.046, 0.02), 0.004, segs=6, rings=3)
        if T["rune"]:
            pc.mat = "M_Rune"
            for k in range(6):
                a = TAU * k / 6
                rbox(pc, (math.cos(a) * 0.0335, 0.002 + math.sin(a) * 0.0335, -0.046), (0.004, 0.004, 0.01), ch=0)
        if T["gold"]:
            pc.mat = "M_Band"
            lathe(pc, (0, 0.002, -0.058), [(0.03, -0.003), (0.034, 0), (0.03, 0.003)], n=10)
        if T["crown"]:
            pc.mat = "M_Glow"                                                       # a ring of seal sigils floating round the wrist
            lathe(pc, (0, 0.002, -0.05), [(0.05, -0.0015), (0.054, 0), (0.05, 0.0015)], n=16)
            for k in range(3):
                a = TAU * k / 3 + 0.4
                rbox(pc, (math.cos(a) * 0.052, 0.002 + math.sin(a) * 0.052, -0.05), (0.008, 0.008, 0.008), ch=0.3)
    return weapon(f"seal-gloves-{t}", tier_mats(t, {"M_Leather": INK, "M_Cuff": INK_HI, "glow": GREEN_GLOW}), b, sharp=40)


# ---------------------------------------------------------------- carved totem staff (the Shaman)
def totem_staff(t):
    """A carved staff topped by a little totem: a thunderbird with spread wings over a carved face, feathers hanging
    off cords; the bird's eyes and the face's mouth glow teal. Tiers band, etch and gild it; at 5 a ring of storm
    runes circles the bird."""
    T = TIER[t]

    def b(pc):
        pc.mat = "M_Wood"
        pc.tube([(0, 0, -0.27), (0.004, 0, -0.05), (-0.003, 0, 0.2), (0, 0, 0.42)], [0.016, 0.017, 0.018, 0.02], sides=6, tip=False)
        rbox(pc, (0, 0, 0.475), (0.068, 0.062, 0.12), ch=0.3)                 # the carved face block
        pc.mat = "M_Paint"
        rbox(pc, (0, -0.032, 0.475), (0.05, 0.004, 0.09), ch=0.2)              # its painted face
        pc.mat = "M_Dark"
        rbox(pc, (0, -0.0345, 0.49), (0.044, 0.004, 0.009), ch=0)              # brow
        pc.mat = "M_Glow"
        for s in (1, -1):
            rbox(pc, (s * 0.013, -0.035, 0.476), (0.011, 0.004, 0.008), ch=0)  # eyes
        rbox(pc, (0, -0.035, 0.448), (0.02, 0.004, 0.007), ch=0)               # mouth
        pc.mat = "M_Wood"                                                      # the thunderbird on top
        pc.blob((0, 0.004, 0.565), (0.03, 0.028, 0.034), segs=7, rings=4)
        pc.tube([(0, -0.018, 0.58), (0, -0.044, 0.586)], [0.01, 0.004], sides=5, tip=True)   # beak
        pc.mat = "M_Paint"
        for s in (1, -1):                                                     # wings, raised and spread
            pc.band([[Vector((s * 0.022, 0.004 + dy, 0.565 + dz)) for dy, dz in ((-0.014, -0.016), (0.014, -0.016), (0.014, 0.016), (-0.014, 0.016))],
                     [Vector((s * 0.07, 0.006 + dy, 0.6 + dz)) for dy, dz in ((-0.011, -0.03), (0.011, -0.03), (0.011, 0.012), (-0.011, 0.012))],
                     [Vector((s * 0.115, 0.006 + dy, 0.63 + dz)) for dy, dz in ((-0.006, -0.026), (0.006, -0.026), (0.006, 0.004), (-0.006, 0.004))]],
                    caps=(None, Vector((s * 0.13, 0.006, 0.63))))
        pc.mat = "M_Glow"
        for s in (1, -1):
            pc.blob((s * 0.014, -0.02, 0.578), 0.006, segs=6, rings=3)
        pc.mat = "M_Cloth"                                                    # feathers on cords
        for s in (1, -1):
            pc.tube([(s * 0.026, 0, 0.43), (s * 0.034, -0.004, 0.39)], [0.0025, 0.0025], sides=4, tip=False)
            pc.blob((s * 0.036, -0.005, 0.368), (0.006, 0.003, 0.024), segs=6, rings=3)
        wrap(pc, -0.07, 0.07, 0.017)
        if T["band"]:
            bands(pc, (0.13, 0.39), 0.019)
        if T["rune"]:
            runes(pc, (0.24, 0.3), 0.0185)
        if T["crown"]:
            pc.mat = "M_Glow"
            lathe(pc, (0, 0.004, 0.57), [(0.068, -0.002), (0.074, 0), (0.068, 0.002)], n=14)
    return weapon(f"totem-staff-{t}", tier_mats(t, {"M_Wood": WOOD, "M_Dark": WOOD_DARK, "M_Paint": CLOTH_TEAL, "M_Cloth": CLOTH, "glow": "#7ff0e0"}), b)


# ---------------------------------------------------------------- living staff (the Druid)
def living_staff(t):
    """A living branch: a twisting shaft with knots and sprouting leaves, a bud cradled at the top in curled twigs,
    its heart glowing green; higher tiers grow more leaves, an iron ring, glowing veins, gold leaf and a full bloom."""
    T = TIER[t]
    leaves = 3 + t

    def b(pc):
        pc.mat = "M_Wood"
        path = [(0.006 * math.sin(i * 1.3), 0.006 * math.cos(i * 1.7), -0.27 + i * 0.085) for i in range(9)]
        pc.tube(path, [0.017 + 0.002 * math.sin(i) for i in range(9)], sides=6, tip=False)
        for z in (-0.12, 0.08, 0.27):
            pc.blob((0.012, 0.004, z), (0.012, 0.011, 0.016), segs=6, rings=3)   # knots
        for s in range(3):                                                      # the twig cradle
            a = TAU * s / 3
            pc.tube([(0, 0, 0.42), (math.cos(a) * 0.045, math.sin(a) * 0.045, 0.5), (math.cos(a) * 0.04, math.sin(a) * 0.04, 0.58), (math.cos(a + 0.6) * 0.018, math.sin(a + 0.6) * 0.018, 0.61)],
                    [0.011, 0.008, 0.005, 0.003], sides=5, tip=True)
        pc.mat = "M_Leaf"
        for i in range(leaves):
            z = 0.02 + i * 0.36 / leaves
            a = i * 2.39996
            c = Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, z))
            pc.blob(c, (0.032, 0.008, 0.016), segs=6, rings=3)
        pc.mat = "M_Glow"
        pc.blob((0, 0, 0.535), (0.028, 0.028, 0.032), segs=8, rings=5)            # the seed's glowing heart
        pc.mat = "M_Petal"
        for k in range(5 if T["crown"] else 3):
            a = TAU * k / (5 if T["crown"] else 3) + 0.3
            pc.blob((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.565), (0.015, 0.015, 0.03 if T["crown"] else 0.022), segs=6, rings=3)
        if T["band"]:
            bands(pc, (0.2,), 0.019)
        if T["rune"]:
            runes(pc, (-0.02, 0.12), 0.018)
        if T["gold"]:
            pc.mat = "M_Band"
            for i in range(2):
                pc.blob((math.cos(i * 3) * 0.032, math.sin(i * 3) * 0.032, 0.36 + i * 0.04), (0.018, 0.005, 0.01), segs=6, rings=3)
    return weapon(f"living-staff-{t}", tier_mats(t, {"M_Wood": BARK, "M_Leaf": LEAF, "M_Petal": BLOSSOM, "glow": "#a8ff7a"}), b)


# ---------------------------------------------------------------- sunstone staff (the Priest)
def sunstone_staff(t):
    """A pale smooth staff with a crescent cradle holding a faceted sunstone (the glow part) and short rays round it;
    tiers band, etch and gild the cradle; at 5 a halo ring stands behind the stone."""
    T = TIER[t]

    def b(pc):
        pc.mat = "M_Wood"
        pc.tube([(0, 0, -0.27), (0, 0, 0.1), (0, 0, 0.45)], [0.016, 0.017, 0.018], sides=6, tip=False)
        lathe(pc, (0, 0, 0.47), [(0.018, -0.02), (0.026, 0), (0.02, 0.02)], n=8)
        pc.mat = "M_Cradle"
        arc = [math.radians(a) for a in range(-130, 131, 26)]
        pc.tube([(0.072 * math.sin(a), 0, 0.56 - 0.072 * math.cos(a)) for a in arc], [0.008, 0.011, 0.013, 0.014, 0.014, 0.014, 0.014, 0.014, 0.013, 0.011, 0.008],
                sides=5, tip=True)
        pc.mat = "M_Glow"
        lathe(pc, (0, 0, 0.565), [(0, -0.052), (0.034, -0.012), (0.034, 0.012), (0, 0.056)], n=6, phase=math.pi / 6)
        pc.mat = "M_Ray"
        for k in range(6):
            a = TAU * k / 6 + 0.26
            d = Vector((math.cos(a), 0, math.sin(a)))
            pc.tube([tuple(Vector((0, 0, 0.565)) + d * 0.05), tuple(Vector((0, 0, 0.565)) + d * 0.075)], [0.004, 0.002], sides=4, tip=True)
        wrap(pc, -0.07, 0.07, 0.016, "M_Cloth")
        if T["band"]:
            bands(pc, (0.18, 0.4), 0.018)
        if T["rune"]:
            runes(pc, (0.27, 0.32), 0.0175)
        if T["crown"]:
            pc.mat = "M_Glow"
            lathe(pc, (0, 0.012, 0.565), [(0.09, -0.002), (0.097, 0), (0.09, 0.002)], n=16, axis=(0, 1, 0))
    return weapon(f"sunstone-staff-{t}", tier_mats(t, {"M_Wood": WOOD_PALE, "M_Cradle": "#c9b28a" if t < 4 else GOLD, "M_Ray": SUN, "M_Cloth": "#f2e9d4", "glow": SUN}), b)


# ================================================================ bodies: helpers (enemy style, build_enemies.py)
def eye(pc, p, n, rx, ry, depth=0.012):
    lathe(pc, p - n * depth * 0.5, [(0, -depth), (1, 0), (0.72, depth * 0.55), (0, depth)], n=10, axis=n, sx=rx, sy=ry)


def eyes_on(pc, c, r, x, z, rx, ry):
    for s in (1, -1):
        p, n = on_blob(c, r, s * x, z)
        eye(pc, p, n, rx, ry)


def legs4(M, xs, ys, top, mat="M_Fur", r=0.026, foot=0.03):
    out = []
    for name, x, y in (("leg_fl", xs, ys[0]), ("leg_fr", -xs, ys[0]), ("leg_bl", xs, ys[1]), ("leg_br", -xs, ys[1])):
        def b(pc, x=x, y=y):
            pc.mat = mat
            pc.tube([(x, y, top), (x, y - 0.01, 0.05)], [r, r * 0.85], sides=6, tip=False)
            pc.blob((x, y - 0.018, foot * 0.9), (foot, foot * 1.25, foot * 0.9), segs=6, rings=3)
        out.append(pe.part(name, M, b, pivot=(x, y, top), sharp=SOFT))
    return out


def flames(pc, base, n, length, spread, seed=0):
    """Shadow-flame tufts (the beasts' manes and tails): curved tapering tubes, tips up and back."""
    for k in range(n):
        a = math.radians(-spread / 2 + spread * k / max(1, n - 1)) + seed
        p0 = Vector(base) + Vector((math.sin(a) * 0.03, 0, math.cos(a) * 0.02))
        d = Vector((math.sin(a) * 0.5, 0.6, 0.9)).normalized()
        p1, p2 = p0 + d * length * 0.55, p0 + d * length + Vector((0, 0.02, 0))
        pc.tube([tuple(p0), tuple(p1), tuple(p2)], [0.016, 0.01, 0.004], sides=5, tip=True)


# ---------------------------------------------------------------- the Summoner's beasts (and their untamed forms)
def wolf(glow, ragged=False, name="beast-wolf"):
    M = pe.materials({"M_Fur": INK, "M_Hi": INK_HI, "M_Lo": INK_LO, TEL: glowc(glow, 1.2)})
    HC, HR = (0, -0.21, 0.42), (0.11, 0.12, 0.1)

    def body(pc):
        pc.mat = "M_Fur"
        pc.blob((0, 0.03, 0.31), (0.13, 0.24, 0.13), segs=10, rings=6)
        pc.blob((0, 0.16, 0.33), (0.115, 0.1, 0.11), segs=8, rings=4)            # haunches
        pc.mat = "M_Hi"
        pc.blob((0, -0.13, 0.31), (0.1, 0.08, 0.11), segs=8, rings=4)            # chest

    def head(pc):
        pc.mat = "M_Fur"
        pc.blob(HC, HR, segs=8, rings=5)
        for s in (1, -1):
            lathe(pc, (s * 0.06, -0.19, 0.5), [(0.045, 0), (0.034, 0.05), (0, 0.11)], n=5, axis=(s * 0.3, 0.15, 1), sy=0.6)
        lathe(pc, (0, -0.29, 0.4), [(0.058, 0), (0.048, 0.05), (0.026, 0.11), (0, 0.13)], n=7, axis=(0, -1, -0.12), sy=0.78)
        pc.mat = "M_Lo"
        pc.blob((0, -0.415, 0.39), (0.022, 0.016, 0.016), segs=6, rings=3)

    def glow_eyes(pc):
        pc.mat = TEL
        eyes_on(pc, HC, HR, 0.05, 0.445, 0.034, 0.016)

    def tail(pc):
        pc.mat = "M_Fur"
        pc.tube([(0, 0.2, 0.33), (0, 0.29, 0.38), (0, 0.36, 0.45)], [0.045, 0.05, 0.03], sides=6, tip=True)
        pc.mat = TEL
        flames(pc, (0, 0.36, 0.47), 3, 0.09, 50)

    def mane(pc):
        pc.mat = "M_Lo"
        flames(pc, (0, -0.06, 0.4), 7 if ragged else 5, 0.12 if ragged else 0.09, 120)
        pc.mat = TEL
        flames(pc, (0, -0.02, 0.43), 3, 0.06, 80, seed=0.2)

    b = pe.part("body", M, body, pivot=(0, 0.02, 0.3), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.13, 0.38), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=HC)
    t = pe.part("tail", M, tail, pivot=(0, 0.2, 0.33), sharp=SOFT)
    mn = pe.part("mane", M, mane, pivot=(0, -0.08, 0.38), sharp=SOFT)
    legs = legs4(M, 0.08, (-0.11, 0.17), 0.26, r=0.042, foot=0.04)
    parent(g, h)
    for o in (h, t, mn, *legs):
        parent(o, b)
    return finish([b, h, g, t, mn, *legs])


def owl(glow, ragged=False):
    M = pe.materials({"M_Fur": INK, "M_Hi": INK_HI, "M_Beak": "#c9a35a", TEL: glowc(glow, 1.3)})
    HC, HR = (0, -0.02, 0.28), (0.12, 0.11, 0.1)

    def body(pc):
        pc.mat = "M_Fur"
        pc.blob((0, 0.01, 0.12), (0.12, 0.11, 0.15), segs=9, rings=5)
        pc.mat = "M_Hi"
        pc.blob((0, -0.07, 0.1), (0.085, 0.05, 0.11), segs=8, rings=4)            # breast
        pc.mat = "M_Beak"
        for s in (1, -1):                                                        # talons
            pc.tube([(s * 0.04, -0.04, 0.0), (s * 0.04, -0.07, -0.02)], [0.01, 0.004], sides=4, tip=True)

    def head(pc):
        pc.mat = "M_Fur"
        pc.blob(HC, HR, segs=9, rings=5)
        for s in (1, -1):                                                        # ear tufts
            lathe(pc, (s * 0.07, -0.01, 0.35), [(0.03, 0), (0, 0.07)], n=5, axis=(s * 0.5, 0.2, 1), sy=0.5)
        pc.mat = "M_Hi"
        for s in (1, -1):                                                        # facial discs
            p, n = on_blob(HC, HR, s * 0.045, 0.285)
            lathe(pc, p - n * 0.004, [(0, -0.004), (0.042, 0), (0, 0.006)], n=10, axis=n, sy=0.95)
        pc.mat = "M_Beak"
        lathe(pc, (0, -0.105, 0.26), [(0.016, 0), (0, 0.035)], n=5, axis=(0, -0.6, -1))

    def glow_eyes(pc):
        pc.mat = TEL
        eyes_on(pc, HC, HR, 0.046, 0.29, 0.024, 0.024)

    def wing(s):
        def b(pc):
            pc.mat = "M_Fur"
            rows = []
            for i, (x, z, w) in enumerate(((0.1, 0.2, 0.09), (0.2, 0.22, 0.08), (0.3, 0.2, 0.06), (0.38, 0.16, 0.035))):
                rows.append([Vector((s * x, 0.02 + dy * w, z + dz * w)) for dy, dz in ((-0.4, -1), (0.6, -1), (0.6, 0.4), (-0.4, 0.4))])
            pc.band(rows, caps=(None, Vector((s * 0.43, 0.03, 0.13))))
            pc.mat = TEL if ragged else "M_Hi"
            for k in range(3):                                                  # the long flight feathers
                pc.tube([(s * (0.22 + k * 0.06), 0.03, 0.15), (s * (0.24 + k * 0.07), 0.05, 0.06)], [0.012, 0.004], sides=4, tip=True)
        return b

    b = pe.part("body", M, body, pivot=(0, 0.01, 0.12), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, 0.0, 0.22), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=HC)
    wl = pe.part("wing_l", M, wing(1), pivot=(0.09, 0.02, 0.2), sharp=SOFT)
    wr = pe.part("wing_r", M, wing(-1), pivot=(-0.09, 0.02, 0.2), sharp=SOFT)
    parent(g, h)
    for o in (h, wl, wr):
        parent(o, b)
    return finish([b, h, g, wl, wr])


def toad(glow, ragged=False):
    M = pe.materials({"M_Skin": INK, "M_Hi": INK_HI, "M_Belly": "#3e4a3c", "M_Wart": INK_LO, TEL: glowc(glow, 1.2)})
    HC, HR = (0, -0.12, 0.22), (0.16, 0.12, 0.09)

    def body(pc):
        pc.mat = "M_Skin"
        pc.blob((0, 0.04, 0.17), (0.2, 0.2, 0.15), segs=10, rings=5)
        pc.mat = "M_Belly"
        pc.blob((0, -0.06, 0.12), (0.15, 0.1, 0.09), segs=8, rings=4)
        pc.mat = "M_Wart"
        for k in range(9 if ragged else 6):
            a = k * 2.39996
            pc.blob((math.cos(a) * 0.12, 0.08 + math.sin(a) * 0.08, 0.27 + 0.02 * math.sin(k)), 0.018, segs=6, rings=3)

    def head(pc):
        pc.mat = "M_Skin"
        pc.blob(HC, HR, segs=9, rings=5)
        pc.mat = "M_Hi"
        for s in (1, -1):                                                        # the eye bumps
            pc.blob((s * 0.08, -0.12, 0.3), (0.05, 0.05, 0.045), segs=7, rings=4)
        pc.mat = "M_Belly"
        pc.tube([(-0.12, -0.225, 0.2), (0, -0.245, 0.195), (0.12, -0.225, 0.2)], [0.008, 0.009, 0.008], sides=4, tip=False)   # the wide mouth

    def glow_eyes(pc):
        pc.mat = TEL
        for s in (1, -1):
            p, n = on_blob((s * 0.08, -0.12, 0.3), (0.05, 0.05, 0.045), s * 0.08, 0.31)
            eye(pc, p, n, 0.026, 0.02)

    b = pe.part("body", M, body, pivot=(0, 0.04, 0.17), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.06, 0.2), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=(0, -0.12, 0.3))
    legs = legs4(M, 0.16, (-0.06, 0.16), 0.12, mat="M_Skin", r=0.04, foot=0.045)
    parent(g, h)
    for o in (h, *legs):
        parent(o, b)
    return finish([b, h, g, *legs])


def serpent(glow, ragged=False):
    M = pe.materials({"M_Scale": INK, "M_Hi": INK_HI, "M_Belly": "#36403a", TEL: glowc(glow, 1.2)})

    def body(pc):
        pc.mat = "M_Scale"
        coil = [(0.16 * math.cos(a), 0.06 + 0.16 * math.sin(a), 0.05 + 0.025 * a / TAU) for a in (k * TAU / 11 for k in range(12))]
        pc.tube(coil, [0.06] * 12, sides=8, tip=False)
        pc.tube([coil[-1], (0.02, -0.06, 0.16), (0, -0.1, 0.3)], [0.06, 0.055, 0.05], sides=8, tip=False)
        pc.mat = TEL if ragged else "M_Hi"
        for k in range(7):
            a = k * TAU / 7
            pc.tube([(0.16 * math.cos(a), 0.06 + 0.16 * math.sin(a), 0.1), (0.17 * math.cos(a), 0.06 + 0.17 * math.sin(a), 0.14)], [0.012, 0.003], sides=4, tip=True)

    def head(pc):
        pc.mat = "M_Scale"
        pc.blob((0, -0.12, 0.36), (0.065, 0.085, 0.05), segs=8, rings=4)
        pc.mat = "M_Hi"                                                            # the hood: a curved fan behind the head
        fan = [[Vector((0, -0.05, 0.3)) + Vector((math.sin(a) * r, 0.03 + 0.04 * r, 0.06 + math.cos(a) * r * 0.9)) for a in (math.radians(-75 + i * 150 / 6) for i in range(7))] for r in (0.03, 0.09, 0.14)]
        pc.band(fan, closed=False)
        pc.band([[p + Vector((0, 0.012, 0)) for p in row] for row in reversed(fan)], closed=False)
        pc.mat = "M_Belly"
        pc.tube([(0, -0.2, 0.33), (0, -0.25, 0.32)], [0.004, 0.003], sides=4, tip=True)

    def glow_eyes(pc):
        pc.mat = TEL
        for s in (1, -1):
            pc.blob((s * 0.034, -0.17, 0.38), (0.012, 0.01, 0.008), segs=6, rings=3)

    def tail(pc):
        pc.mat = "M_Scale"
        pc.tube([(0.16, 0.06, 0.05), (0.24, 0.16, 0.04), (0.2, 0.26, 0.05)], [0.05, 0.035, 0.012], sides=6, tip=True)

    b = pe.part("body", M, body, pivot=(0, 0.06, 0.1), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.1, 0.3), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=(0, -0.17, 0.38))
    t = pe.part("tail", M, tail, pivot=(0.16, 0.06, 0.05), sharp=SOFT)
    parent(g, h)
    for o in (h, t):
        parent(o, b)
    return finish([b, h, g, t])


def hare(glow):
    """The rabbits' untamed form: a long-eared shadow hare."""
    M = pe.materials({"M_Fur": INK, "M_Hi": INK_HI, TEL: glowc(glow, 1.2)})
    HC, HR = (0, -0.12, 0.25), (0.06, 0.07, 0.06)

    def body(pc):
        pc.mat = "M_Fur"
        pc.blob((0, 0.02, 0.15), (0.08, 0.12, 0.09), segs=8, rings=5)
        pc.mat = "M_Hi"
        pc.blob((0, 0.13, 0.16), 0.035, segs=6, rings=3)                         # the tail puff

    def head(pc):
        pc.mat = "M_Fur"
        pc.blob(HC, HR, segs=8, rings=4)
        for s in (1, -1):
            pc.tube([(s * 0.025, -0.1, 0.3), (s * 0.04, -0.07, 0.39), (s * 0.035, -0.04, 0.46)], [(0.016, 0.008), (0.02, 0.008), (0.006, 0.004)], sides=6, tip=False)

    def glow_eyes(pc):
        pc.mat = TEL
        eyes_on(pc, HC, HR, 0.034, 0.265, 0.016, 0.013)

    b = pe.part("body", M, body, pivot=(0, 0.02, 0.15), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.08, 0.2), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=HC)
    legs = legs4(M, 0.045, (-0.05, 0.08), 0.1, r=0.018, foot=0.022)
    parent(g, h)
    for o in (h, *legs):
        parent(o, b)
    return finish([b, h, g, *legs])


def rabbit():
    """One rabbit of the flood (instanced by the dozen): a single low mesh, ink with a green eye."""
    M = pe.materials({"M_Fur": INK, "M_Eye": glowc(GREEN_GLOW, 1.0)})

    def b(pc):
        pc.mat = "M_Fur"
        pc.blob((0, 0.02, 0.07), (0.05, 0.075, 0.055), segs=7, rings=4)
        pc.blob((0, -0.06, 0.12), (0.035, 0.04, 0.035), segs=6, rings=4)
        for s in (1, -1):
            pc.tube([(s * 0.014, -0.05, 0.15), (s * 0.022, -0.03, 0.22)], [(0.011, 0.005), (0.004, 0.003)], sides=4, tip=False)
        pc.mat = "M_Eye"
        for s in (1, -1):
            pc.blob((s * 0.024, -0.085, 0.128), 0.007, segs=5, rings=3)
    return finish([pe.part("rabbit", M, b, pivot=(0, 0, 0), sharp=SOFT)])


# ---------------------------------------------------------------- the Shaman's totems
def totem_post(kind):
    """A carved post (body), its animal head on top (head), the glowing eyes and mouth (glow_eyes), and a ring that spins
    up before it fires (ring): storm (thunderbird, teal), fire (salamander, ember brazier), earth (bear, stone base)."""
    glow = {"storm": "#7ff0e0", "fire": "#ff9a4a", "earth": "#d6c25a", "spirit": "#9ff7c4"}[kind]
    M = pe.materials({"M_Wood": WOOD, "M_Dark": WOOD_DARK, "M_Paint": {"storm": CLOTH_TEAL, "fire": CLOTH_RED, "earth": "#8d7a5e", "spirit": CLOTH}[kind],
                      "M_Stone": STONE, TEL: glowc(glow, 1.0)})
    H = 0.62 if kind != "spirit" else 0.5

    def body(pc):
        pc.mat = "M_Wood"
        if kind == "spirit":
            pc.tube([(0, 0, 0), (0, 0, H)], [0.03, 0.022], sides=6, tip=True)
            return
        lathe(pc, (0, 0, 0), [(0.075, 0), (0.07, 0.04), (0.062, 0.3), (0.06, 0.45)], n=8)
        pc.mat = "M_Dark"
        for z in (0.12, 0.3):
            lathe(pc, (0, 0, z), [(0.071, -0.012), (0.078, 0), (0.071, 0.012)], n=8)
        pc.mat = "M_Paint"
        rbox(pc, (0, -0.06, 0.22), (0.07, 0.012, 0.1), ch=0.3)                    # the painted face plate
        if kind == "earth":
            pc.mat = "M_Stone"
            for k in range(5):
                a = TAU * k / 5
                pc.blob((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.03), (0.045, 0.04, 0.035), segs=6, rings=3)

    def head(pc):
        pc.mat = "M_Wood"
        if kind == "storm":
            pc.blob((0, 0, 0.52), (0.06, 0.055, 0.06), segs=8, rings=4)
            pc.tube([(0, -0.04, 0.53), (0, -0.09, 0.51)], [0.02, 0.006], sides=5, tip=True)
            pc.mat = "M_Paint"
            for s in (1, -1):
                pc.band([[Vector((s * 0.04, dy, 0.5 + dz)) for dy, dz in ((-0.02, -0.02), (0.02, -0.02), (0.02, 0.02), (-0.02, 0.02))],
                         [Vector((s * 0.15, 0.01 + dy, 0.6 + dz)) for dy, dz in ((-0.012, -0.03), (0.012, -0.03), (0.012, 0.01), (-0.012, 0.01))]],
                        caps=(None, Vector((s * 0.18, 0.012, 0.63))))
        elif kind == "fire":
            lathe(pc, (0, 0, 0.47), [(0.06, 0), (0.085, 0.05), (0.08, 0.07), (0, 0.07)], n=9)   # the brazier bowl
            pc.mat = "M_Paint"
            for s in (1, -1):
                pc.tube([(s * 0.06, -0.03, 0.5), (s * 0.1, -0.05, 0.56), (s * 0.08, -0.07, 0.6)], [0.016, 0.01, 0.004], sides=5, tip=True)   # frills
        elif kind == "earth":
            pc.blob((0, 0, 0.5), (0.075, 0.065, 0.06), segs=8, rings=4)
            for s in (1, -1):
                pc.blob((s * 0.055, 0.0, 0.56), 0.022, segs=6, rings=3)               # round ears
            pc.mat = "M_Dark"
            pc.blob((0, -0.06, 0.49), (0.028, 0.02, 0.02), segs=6, rings=3)           # snout
        else:
            pc.mat = "M_Paint"
            lathe(pc, (0, 0, H - 0.08), [(0.03, -0.01), (0.04, 0), (0.03, 0.01)], n=8)

    def glow_eyes(pc):
        pc.mat = TEL
        if kind == "spirit":
            pc.blob((0, 0, H + 0.05), 0.03, segs=7, rings=4)
            return
        for s in (1, -1):
            rbox(pc, (s * 0.02, -0.068, 0.24), (0.014, 0.006, 0.01), ch=0)
        rbox(pc, (0, -0.068, 0.2), (0.03, 0.006, 0.008), ch=0)
        if kind == "fire":
            for k in range(3):
                a = TAU * k / 3
                pc.tube([(math.cos(a) * 0.03, math.sin(a) * 0.03, 0.54), (math.cos(a) * 0.012, math.sin(a) * 0.012, 0.62)], [0.025, 0.004], sides=5, tip=True)
        elif kind == "storm":
            for s in (1, -1):
                pc.blob((s * 0.025, -0.035, 0.54), 0.01, segs=6, rings=3)
        else:
            for s in (1, -1):
                pc.blob((s * 0.025, -0.05, 0.52), 0.009, segs=6, rings=3)

    def ring(pc):
        pc.mat = TEL
        lathe(pc, (0, 0, 0.36), [(0.1, -0.004), (0.108, 0), (0.1, 0.004)], n=16)
        for k in range(4):
            a = TAU * k / 4
            pc.blob((math.cos(a) * 0.104, math.sin(a) * 0.104, 0.36), 0.01, segs=5, rings=3)

    b = pe.part("body", M, body, pivot=(0, 0, 0.1), sharp=50)
    h = pe.part("head", M, head, pivot=(0, 0, 0.45), sharp=50)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=(0, 0, 0.3))
    parts = [b, h, g]
    if kind != "spirit":
        r = pe.part("ring", M, ring, pivot=(0, 0, 0.36))
        parts.append(r)
    for o in parts[1:]:
        parent(o, b)
    return finish(parts)


# ---------------------------------------------------------------- the spirits Awakening raises
def thunderbird():
    M = pe.materials({"M_Spirit": "#2c6f73", "M_Hi": "#5fd6c4", TEL: glowc("#bff8ff", 1.6)})

    def body(pc):
        pc.mat = "M_Spirit"
        pc.blob((0, 0, 0.2), (0.1, 0.18, 0.09), segs=9, rings=5)
        pc.mat = "M_Hi"
        pc.tube([(0, 0.15, 0.2), (0, 0.3, 0.22), (0, 0.42, 0.26)], [0.06, 0.04, 0.01], sides=6, tip=True)       # tail

    def head(pc):
        pc.mat = "M_Spirit"
        pc.blob((0, -0.2, 0.28), (0.065, 0.075, 0.06), segs=8, rings=4)
        pc.mat = "M_Hi"
        pc.tube([(0, -0.26, 0.28), (0, -0.34, 0.24)], [0.025, 0.006], sides=5, tip=True)
        lathe(pc, (0, -0.18, 0.33), [(0.02, 0), (0, 0.09)], n=5, axis=(0, 0.4, 1))                              # crest

    def glow_eyes(pc):
        pc.mat = TEL
        for s in (1, -1):
            pc.blob((s * 0.04, -0.25, 0.3), 0.012, segs=6, rings=3)

    def wing(s):
        def b(pc):
            pc.mat = "M_Spirit"
            rows = [[Vector((s * x, dy * w, z + dz * w)) for dy, dz in ((-0.6, -0.4), (0.6, -0.4), (0.6, 0.4), (-0.6, 0.4))]
                    for x, z, w in ((0.08, 0.22, 0.12), (0.22, 0.27, 0.11), (0.38, 0.3, 0.08), (0.52, 0.3, 0.05))]
            pc.band(rows, caps=(None, Vector((s * 0.6, 0.0, 0.3))))
            pc.mat = TEL                                                        # lightning along the wing's edge
            pts = [(s * x, -0.07, 0.3 + 0.04 * ((i % 2) * 2 - 1)) for i, x in enumerate((0.1, 0.2, 0.3, 0.4, 0.5))]
            pc.tube(pts, [0.012] * 5, sides=4, tip=True)
        return b

    b = pe.part("body", M, body, pivot=(0, 0, 0.2), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.15, 0.25), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=(0, -0.25, 0.3))
    wl = pe.part("wing_l", M, wing(1), pivot=(0.08, 0, 0.22), sharp=SOFT)
    wr = pe.part("wing_r", M, wing(-1), pivot=(-0.08, 0, 0.22), sharp=SOFT)
    parent(g, h)
    for o in (h, wl, wr):
        parent(o, b)
    return finish([b, h, g, wl, wr])


def salamander():
    M = pe.materials({"M_Skin": "#a8402a", "M_Hi": "#e0743a", TEL: glowc("#ffd27a", 1.6)})

    def body(pc):
        pc.mat = "M_Skin"
        pc.tube([(0, 0.18, 0.08), (0, 0.04, 0.1), (0, -0.1, 0.11)], [0.05, 0.07, 0.06], sides=8, tip=False)
        pc.mat = TEL
        for k in range(5):                                                        # flame frills down the back
            pc.tube([(0, 0.12 - k * 0.055, 0.15), (0, 0.13 - k * 0.055, 0.22 + 0.02 * (k % 2))], [0.018, 0.003], sides=4, tip=True)

    def head(pc):
        pc.mat = "M_Skin"
        pc.blob((0, -0.18, 0.12), (0.06, 0.08, 0.045), segs=8, rings=4)
        pc.mat = "M_Hi"
        pc.tube([(0, -0.25, 0.11), (0, -0.27, 0.105)], [0.04, 0.03], sides=6, tip=False)

    def glow_eyes(pc):
        pc.mat = TEL
        for s in (1, -1):
            pc.blob((s * 0.035, -0.21, 0.15), 0.011, segs=6, rings=3)

    def tail(pc):
        pc.mat = "M_Skin"
        pc.tube([(0, 0.18, 0.08), (0.04, 0.3, 0.06), (0, 0.42, 0.05)], [0.045, 0.03, 0.006], sides=6, tip=True)
        pc.mat = TEL
        pc.tube([(0, 0.42, 0.05), (0, 0.48, 0.1)], [0.02, 0.003], sides=4, tip=True)

    b = pe.part("body", M, body, pivot=(0, 0.04, 0.1), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.12, 0.11), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=(0, -0.21, 0.15))
    t = pe.part("tail", M, tail, pivot=(0, 0.18, 0.08), sharp=SOFT)
    legs = legs4(M, 0.07, (-0.06, 0.12), 0.08, mat="M_Skin", r=0.022, foot=0.026)
    parent(g, h)
    for o in (h, t, *legs):
        parent(o, b)
    return finish([b, h, g, t, *legs])


def bear():
    M = pe.materials({"M_Fur": "#5b4a3a", "M_Hi": "#8a7458", "M_Stone": STONE_DARK, TEL: glowc("#e8f070", 1.4)})
    HC, HR = (0, -0.2, 0.62), (0.13, 0.12, 0.11)

    def body(pc):
        pc.mat = "M_Fur"
        pc.blob((0, 0.02, 0.4), (0.2, 0.22, 0.24), segs=10, rings=6)
        pc.mat = "M_Stone"                                                        # stone plates on its back
        for k in range(4):
            pc.blob((0.06 * (k % 2 * 2 - 1), 0.1 + k * 0.02, 0.58 - k * 0.05), (0.06, 0.05, 0.03), segs=6, rings=3)
        pc.mat = TEL
        for s in (1, -1):                                                         # spirit markings
            pc.tube([(s * 0.18, -0.06, 0.48), (s * 0.2, 0.0, 0.4), (s * 0.18, 0.08, 0.32)], [0.012, 0.012, 0.006], sides=4, tip=True)

    def head(pc):
        pc.mat = "M_Fur"
        pc.blob(HC, HR, segs=9, rings=5)
        for s in (1, -1):
            pc.blob((s * 0.09, -0.17, 0.72), 0.035, segs=6, rings=3)
        pc.mat = "M_Hi"
        pc.blob((0, -0.31, 0.6), (0.055, 0.045, 0.045), segs=7, rings=4)

    def glow_eyes(pc):
        pc.mat = TEL
        eyes_on(pc, HC, HR, 0.05, 0.645, 0.02, 0.016)

    def arm(s):
        def b(pc):
            pc.mat = "M_Fur"
            pc.tube([(s * 0.17, -0.06, 0.52), (s * 0.2, -0.12, 0.32), (s * 0.19, -0.16, 0.12)], [0.07, 0.06, 0.055], sides=7, tip=False)
            pc.mat = "M_Hi"
            pc.blob((s * 0.19, -0.18, 0.08), (0.06, 0.07, 0.04), segs=7, rings=3)
        return b

    b = pe.part("body", M, body, pivot=(0, 0.02, 0.4), sharp=SOFT)
    h = pe.part("head", M, head, pivot=(0, -0.12, 0.56), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow_eyes, pivot=HC)
    al = pe.part("arm_l", M, arm(1), pivot=(0.17, -0.06, 0.52), sharp=SOFT)
    ar = pe.part("arm_r", M, arm(-1), pivot=(-0.17, -0.06, 0.52), sharp=SOFT)
    legs = legs4(M, 0.11, (0.0, 0.16), 0.2, r=0.06, foot=0.06)[2:]
    parent(g, h)
    for o in (h, al, ar, *legs):
        parent(o, b)
    return finish([b, h, g, al, ar, *legs])


# ---------------------------------------------------------------- props: the World Tree, a thorn wall segment
def world_tree():
    """A giant tree that grows round the Druid (about 4 u tall in the world): a twisted trunk on spreading roots, a
    crown of leaf clusters with blossoms, and glowing sap veins and blossom hearts (the only lit parts)."""
    M = pe.materials({"M_Bark": BARK, "M_BarkDark": WOOD_DARK, "M_Leaf": LEAF, "M_LeafDark": LEAF_DARK, "M_Blossom": BLOSSOM, "M_Glow": glowc("#c8ff8a", 1.2)})

    def b(pc):
        pc.mat = "M_Bark"
        for k in range(5):                                                        # the trunk: five twisting strands
            a0 = TAU * k / 5
            path = [(math.cos(a0 + z * 1.6) * (0.16 - z * 0.035), math.sin(a0 + z * 1.6) * (0.16 - z * 0.035), z) for z in (0, 0.4, 0.8, 1.3, 1.8, 2.2)]
            pc.tube(path, [0.13, 0.11, 0.1, 0.09, 0.08, 0.06], sides=7, tip=False)
        pc.mat = "M_BarkDark"
        for k in range(7):                                                        # roots spreading over the ground
            a = TAU * k / 7 + 0.3
            pc.tube([(math.cos(a) * 0.15, math.sin(a) * 0.15, 0.25), (math.cos(a) * 0.55, math.sin(a) * 0.55, 0.06), (math.cos(a) * 1.0, math.sin(a) * 1.0, 0.0)],
                    [0.1, 0.07, 0.02], sides=6, tip=True)
        pc.mat = "M_Bark"
        for k in range(6):                                                        # the big boughs
            a = TAU * k / 6
            pc.tube([(0, 0, 1.7), (math.cos(a) * 0.5, math.sin(a) * 0.5, 2.25), (math.cos(a) * 0.95, math.sin(a) * 0.95, 2.5)], [0.09, 0.06, 0.03], sides=6, tip=True)
        pc.mat = "M_Glow"
        for k in range(4):                                                        # glowing sap veins up the trunk
            a0 = TAU * k / 4 + 0.6
            path = [(math.cos(a0 + z * 1.6) * (0.25 - z * 0.04), math.sin(a0 + z * 1.6) * (0.25 - z * 0.04), z) for z in (0.1, 0.6, 1.1, 1.6)]
            pc.tube(path, [0.022, 0.02, 0.018, 0.012], sides=4, tip=True)
        for k in range(14):                                                       # the crown: leaf clusters
            a, r, z = k * 2.39996, 0.45 + 0.55 * ((k * 0.618) % 1), 2.35 + 0.45 * math.sin(k * 1.7)
            pc.mat = "M_Leaf" if k % 3 else "M_LeafDark"
            pc.blob((math.cos(a) * r, math.sin(a) * r, z), (0.42, 0.42, 0.3), segs=8, rings=5)
        pc.mat = "M_Leaf"
        pc.blob((0, 0, 2.95), (0.6, 0.6, 0.38), segs=9, rings=5)
        for k in range(12):                                                       # blossoms, each with a glowing heart
            a, r, z = k * 2.1 + 0.4, 0.75 + 0.35 * ((k * 0.37) % 1), 2.45 + 0.55 * ((k * 0.53) % 1)
            c = Vector((math.cos(a) * r, math.sin(a) * r, z))
            pc.mat = "M_Blossom"
            pc.blob(c + Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.05)), (0.09, 0.09, 0.05), segs=6, rings=3)
            pc.mat = "M_Glow"
            pc.blob(c + Vector((math.cos(a) * 0.36, math.sin(a) * 0.36, 0.08)), 0.035, segs=5, rings=3)
    return finish([pe.part("tree", M, b, pivot=(0, 0, 0), sharp=SOFT)], (0.68, 1.0))


def thorn_wall():
    """One metre of the thorn wall (instanced along it): tangled vines arching over each other, hooked thorns, a few
    leaves; dark wood, the thorn tips paler."""
    M = pe.materials({"M_Vine": "#4a3a26", "M_VineHi": "#6e5636", "M_Thorn": "#d9c79a", "M_Leaf": LEAF_DARK})

    def b(pc):
        for k in range(4):
            pc.mat = "M_Vine" if k % 2 else "M_VineHi"
            ph = k * 0.9
            pts = [(-0.55 + i * 0.22, 0.08 * math.sin(i * 1.3 + ph), 0.05 + 0.62 * math.sin(math.pi * i / 5) * (0.7 + 0.3 * math.sin(k))) for i in range(6)]
            pc.tube(pts, [0.035, 0.045, 0.05, 0.045, 0.04, 0.03], sides=6, tip=False)
            pc.mat = "M_Thorn"
            for i in range(1, 5):
                x, y, z = pts[i]
                for s in (1, -1):
                    pc.tube([(x, y, z), (x + 0.03 * s, y + 0.07 * s, z + 0.05)], [0.016, 0.002], sides=4, tip=True)
            pc.mat = "M_Leaf"
            for i in (1, 3):
                x, y, z = pts[i]
                pc.blob((x + 0.03, y + 0.05 * (1 if k % 2 else -1), z + 0.03), (0.05, 0.018, 0.03), segs=6, rings=3)
    return finish([pe.part("thorns", M, b, pivot=(0, 0, 0), sharp=SOFT)])


# ================================================================ build
W = [(f"{kind}-{t}", (lambda k=kind, t=t: FN[k](t)), 1000) for kind in ("seal-gloves", "totem-staff", "living-staff", "sunstone-staff") for t in range(1, 6)]
FN = {"seal-gloves": seal_gloves, "totem-staff": totem_staff, "living-staff": living_staff, "sunstone-staff": sunstone_staff}
BODIES = [("beast-wolf", lambda: wolf(GREEN_GLOW), 1600), ("beast-owl", lambda: owl(GREEN_GLOW), 1400), ("beast-toad", lambda: toad(GREEN_GLOW), 1600),
          ("beast-serpent", lambda: serpent(GREEN_GLOW), 1600),
          ("shadow-owl", lambda: owl(VIOLET_GLOW, True), 1600), ("shadow-toad", lambda: toad(VIOLET_GLOW, True), 1700), ("shadow-serpent", lambda: serpent(VIOLET_GLOW, True), 1700),
          ("shadow-hare", lambda: hare(VIOLET_GLOW), 1000),
          ("totem-storm", lambda: totem_post("storm"), 900), ("totem-fire", lambda: totem_post("fire"), 900), ("totem-earth", lambda: totem_post("earth"), 900),
          ("totem-spirit", lambda: totem_post("spirit"), 300),
          ("spirit-thunderbird", thunderbird, 1600), ("spirit-salamander", salamander, 1400), ("spirit-bear", bear, 1800)]
PROPS = [("world-tree", world_tree, 6000), ("thorn-wall", thorn_wall, 1600), ("rabbit", rabbit, 260)]

if __name__ == "__main__":
    # Always a list of ids: build_all then merges into catalog.json's sections instead of replacing them.
    for models, sub in ((W, "weapons"), (BODIES, "enemies"), (PROPS, "props")):
        ids = [m[0] for m in models if not ONLY or m[0] in ONLY]
        if ids:
            pe.build_all(models, sub, ids)
