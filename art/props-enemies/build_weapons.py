"""Combat weapons (rows 31, 140): the four starters and every crafted / higher-tier weapon id.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_weapons.py [-- id ...]

Authoring convention (matches Character.tsx GRIP): grip at the origin = the hand socket, the long axis up (+Z Blender,
+Y glTF), the weapon's front toward -Y (the way the character faces). Swords keep the blade's flat in the Y-Z plane
so it reads from the game camera; bows arc toward -Y with the string behind (+Y); the revolver's barrel points -Y.
Rig units (v6 character = 1.045 tall); the engine scales by modelScale 1.3 = CHARACTER_SCALE.
"""
import math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pe  # noqa: E402
from pe import lathe, rbox  # noqa: E402

pe.reset()
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
KIND = {"sword-driftwood": "melee", "sword-iron": "melee", "bow-willow": "bow", "bow-yew": "bow",
        "revolver-brass": "bow", "staff-oak": "staff", "staff-rune": "staff", "tome-spirits": "summon"}


def section(z, w, t, dx=0.0, dy=0.0):
    """Blade cross-section: lens with edges at +-Y (half-width w) and a flat face at +-X (half-thickness t)."""
    return [Vector((dx + t * math.cos(a), dy + w * math.sin(a), z)) for a in (math.radians(30 + 60 * k) for k in range(6))]


def weapon(wid, mats, build, sharp=50):
    ob = pe.part(wid, pe.materials(mats), build, sharp=sharp)
    pe.regrade([ob], (0.8, 1.0))
    return [ob]


# ================================================================ swords
def sword_driftwood():
    def b(pc):
        bend = lambda z: (0.007 * math.sin(z * 19), 0.006 * math.sin(z * 11 + 1))
        pc.mat = "M_Blade"
        zs, ws = [0.085, 0.17, 0.26, 0.34, 0.385], [0.037, 0.041, 0.039, 0.032, 0.02]
        pc.band([section(z, w, 0.017, *bend(z)) for z, w in zip(zs, ws)], caps=(None, Vector((*bend(0.4), 0.402))))
        pc.mat = "M_Knot"
        pc.tube([(0.0, -0.078, 0.07), (0.004, 0, 0.078), (0.0, 0.078, 0.07)], [0.016, 0.019, 0.016], sides=6, tip=False)
        pc.blob((0, 0, -0.078), (0.024, 0.024, 0.022), segs=6, rings=4)
        pc.mat = "M_Wrap"
        lathe(pc, (0, 0, 0), [(0.016, -0.066), (0.019, -0.035), (0.019, 0.02), (0.017, 0.064)], n=6)
    return weapon("sword-driftwood", {"M_Blade": "driftwood", "M_Knot": "driftwood_dark", "M_Wrap": "string"}, b)


def sword_iron():
    def b(pc):
        pc.mat = "M_Blade"
        zs, ws = [0.09, 0.2, 0.32, 0.4], [0.041, 0.043, 0.037, 0.024]
        pc.band([section(z, w, 0.013) for z, w in zip(zs, ws)], caps=(None, Vector((0, 0, 0.47))))
        pc.mat = "M_Brass"
        guard = [(0, -0.088, 0.1), (0, -0.045, 0.082), (0, 0, 0.078), (0, 0.045, 0.082), (0, 0.088, 0.1)]
        pc.tube(guard, [0.012, 0.015, 0.017, 0.015, 0.012], sides=6, tip=False)
        for y in (-0.092, 0.092):
            pc.blob((0, y, 0.104), 0.019, segs=6, rings=4)
        pc.blob((0, 0, -0.08), (0.026, 0.026, 0.024), segs=6, rings=4)
        pc.mat = "M_Grip"
        lathe(pc, (0, 0, 0), [(0.015, -0.064), (0.018, -0.03), (0.018, 0.03), (0.016, 0.07)], n=6)
    return weapon("sword-iron", {"M_Blade": "steel", "M_Brass": "brass", "M_Grip": "leather"}, b)


# ================================================================ bows (arc toward -Y = the target, string at +Y)
def bow(wid, wood, half, arc, recurve, tipmat, tips):
    def b(pc):
        n = 9
        zs = [half * (2 * i / (n - 1) - 1) for i in range(n)]
        y = lambda z: arc * (abs(z) / half) ** 2 - recurve * max(0.0, abs(z) / half - 0.7) ** 2
        pc.mat = "M_Wood"
        pc.tube([(0, y(z), z) for z in zs], [0.011 + 0.012 * (1 - abs(z) / half) ** 1.5 for z in zs], sides=6, tip=False)
        pc.mat = "M_String"
        pc.tube([(0, y(-half), -half), (0, y(half), half)], [0.0045, 0.0045], sides=4, tip=False, cap=False)
        pc.mat = "M_Grip"
        lathe(pc, (0, 0, 0), [(0.026, -0.045), (0.028, 0), (0.026, 0.045)], n=6)
        pc.mat = "M_Tip"
        tips(pc, y, half)
    return weapon(wid, {"M_Wood": wood, "M_String": "string", "M_Grip": tipmat[0], "M_Tip": tipmat[1]}, b)


def willow_tips(pc, y, half):
    for s in (1, -1):
        pc.blob((0, y(half) - 0.006, s * (half + 0.012)), (0.008, 0.016, 0.034), segs=6, rings=3)   # a willow leaf


def yew_tips(pc, y, half):
    for s in (1, -1):
        lathe(pc, (0, y(half), s * (half - 0.03)), [(0.014, 0), (0.016, 0.02), (0, 0.042)], n=6, axis=(0, 0, s))


def bow_willow():
    return bow("bow-willow", "willow", 0.28, 0.075, 0.0, ("leaf", "leaf"), willow_tips)


def bow_yew():
    return bow("bow-yew", "yew", 0.32, 0.095, 0.9, ("leather", "brass"), yew_tips)


# ================================================================ revolver (bow kind: held in the left hand)
def revolver_brass():
    def b(pc):
        pc.mat = "M_Wood"
        rbox(pc, (0, 0.014, -0.034), (0.034, 0.044, 0.086), ch=0.4, rot=Matrix.Rotation(math.radians(16), 3, "X"))
        pc.mat = "M_Brass"
        rbox(pc, (0, -0.028, 0.034), (0.036, 0.1, 0.048), ch=0.35)
        lathe(pc, (0, -0.074, 0.05), [(0.013, 0), (0.013, 0.1), (0.018, 0.104), (0.018, 0.12), (0, 0.12)], n=8, axis=(0, -1, 0))
        pc.tube([(0, 0.014, 0.052), (0, 0.026, 0.064)], [0.008, 0.006], sides=4, tip=True)
        pc.tube([(0, -0.052, 0.012), (0, -0.05, -0.01), (0, -0.026, -0.02), (0, -0.004, -0.006)], [0.0055] * 4, sides=4, tip=False, cap=False)
        pc.mat = "M_Drum"
        lathe(pc, (0, 0.004, 0.046), [(0.033, 0), (0.041, 0.012), (0.041, 0.044), (0.033, 0.056)], n=6, axis=(0, -1, 0), phase=math.pi / 6)
    return weapon("revolver-brass", {"M_Wood": "oak", "M_Brass": "brass", "M_Drum": "brass_dark"}, b)


# ================================================================ staffs and tome
def staff_oak():
    def b(pc):
        pc.mat = "M_Wood"
        pc.tube([(0, 0, -0.26), (0.006, 0, -0.06), (-0.005, 0, 0.16), (0.004, 0, 0.36), (0, 0, 0.5)],
                [0.016, 0.017, 0.018, 0.02, 0.022], sides=6, tip=False)
        pc.blob((0, 0, 0.515), (0.032, 0.03, 0.026), segs=6, rings=4)
        for s in (1, -1):
            pc.tube([(s * 0.018, 0, 0.525), (s * 0.052, 0, 0.575), (s * 0.048, 0, 0.635), (s * 0.02, 0, 0.668)],
                    [0.012, 0.011, 0.009, 0.006], sides=5, tip=True, cap=False)
        pc.mat = "M_Leaf"
        for s in (1, -1):
            pc.blob((s * 0.07, -0.004, 0.555), (0.03, 0.007, 0.014), segs=6, rings=3)
        pc.mat = "M_Orb"
        pc.blob((0, 0, 0.6), 0.036, segs=6, rings=4)
    return weapon("staff-oak", {"M_Wood": "oak", "M_Leaf": "leaf_dark", "M_Orb": ("glow_green", 0.35)}, b)


def staff_rune():
    def b(pc):
        pc.mat = "M_Shaft"
        pc.tube([(0, 0, -0.26), (0, 0, 0.1), (0, 0, 0.46)], [0.017, 0.018, 0.02], sides=6, tip=False)
        pc.mat = "M_Brass"
        for z in (-0.045, 0.045, 0.44):
            lathe(pc, (0, 0, z), [(0.022, -0.012), (0.025, 0), (0.022, 0.012)], n=6)
        arc = [math.radians(a) for a in range(-120, 121, 30)]      # crescent, open at the top
        pc.tube([(0.07 * math.sin(a), 0, 0.555 - 0.07 * math.cos(a)) for a in arc], [0.009, 0.012, 0.014, 0.015, 0.015, 0.015, 0.014, 0.012, 0.009],
                sides=5, tip=True)
        pc.mat = "M_Crystal"
        lathe(pc, (0, 0, 0.56), [(0, -0.058), (0.036, 0), (0, 0.062)], n=6, phase=math.pi / 6)
    return weapon("staff-rune", {"M_Shaft": "outfit:12", "M_Brass": "brass", "M_Crystal": ("crystal", 0.45)}, b)


def tome_spirits():
    H, W, T, z0 = 0.19, 0.15, 0.056, -0.01           # height (Z), width (Y), thickness (X); held at the bottom edge
    zc = z0 + H / 2

    def b(pc):
        pc.mat = "M_Cover"
        rbox(pc, (0, 0, zc), (T, W, H), ch=0.35)
        pc.mat = "M_Paper"                            # the page block shows as a band on the three open edges
        rbox(pc, (0, 0.006, zc), (T * 0.72, W - 0.004, H + 0.006), ch=0.3)
        pc.mat = "M_Spirit"
        for s in (1, -1):                           # a small wisp on both covers
            pc.blob((s * (T / 2 + 0.001), 0.006, zc - 0.012), (0.006, 0.033, 0.033), segs=8, rings=4)
            pc.tube([(s * (T / 2 + 0.002), -0.01, zc + 0.012), (s * (T / 2 + 0.002), 0.004, zc + 0.045), (s * (T / 2 + 0.002), 0.024, zc + 0.058)],
                    [(0.004, 0.014), (0.003, 0.009), (0.002, 0.004)], sides=4, tip=False)
        pc.mat = "M_Ribbon"
        pc.tube([(0, 0.035, z0 + H), (0, 0.042, z0 + H + 0.022), (0, 0.06, z0 + H + 0.034)], [(0.009, 0.0025)] * 3, sides=4, tip=False)
    return weapon("tome-spirits", {"M_Cover": "tome_teal", "M_Paper": "paper", "M_Spirit": ("outfit:1", 0.15), "M_Ribbon": "crab_body"}, b, sharp=40)


MODELS = [("sword-driftwood", sword_driftwood, 300), ("sword-iron", sword_iron, 300), ("bow-willow", bow_willow, 300),
          ("bow-yew", bow_yew, 300), ("revolver-brass", revolver_brass, 300), ("staff-oak", staff_oak, 300),
          ("staff-rune", staff_rune, 300), ("tome-spirits", tome_spirits, 300)]

if __name__ == "__main__":
    pe.build_all(MODELS, "weapons", ONLY)
