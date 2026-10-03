"""The Rangers' signature weapons (classes v2; design sheet §1.5 and the LOCKED Ranger sections): the Marksman's recurve
bow, the Sniper's long rifle with its scope, the Hunter's harpoon crossbow, the Gunslinger's revolver, each in five tiers
on one trim kit.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_ranger_weapons.py [-- id ...]

Writes web/public/assets/game/weapons/<type>-<tier>.glb (recurve, rifle, harpoon, sixgun; tiers 1-5) and their catalogue
entries (catalog.json "weapons"). Hand-modelled here from primitives (build_weapons.py's conventions and pe.py's helpers):
the grip at the origin; the bow's long axis up (+Z Blender) with its belly forward (-Y) and the string behind; the guns'
barrels forward (-Y) with the grip down. Rig units (the v6 character is 1.045 tall); the engine scales by 1.3.

The trim kit (§1.5): T1 wood and cloth with dull iron fittings; T2 iron; T3 rune-etched (faint bands in the class's
colour); T4 gold trim with a glow part (a gem, the scope's lens, the harpoon's head, the cylinder's chambers); T5 pale
gold and white with brighter runes on the glow parts. Wood, cloth and leather stay matte; only glow parts emit.
"""
import math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pe  # noqa: E402
from pe import lathe, rbox  # noqa: E402

pe.reset()
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
GLOW = {"recurve": "#62d8f0", "rifle": "#a9c8ff", "harpoon": "#5fd1b0", "sixgun": "#ffd27a"}

# The trim kit by tier: wood, dark wood, wrap (cloth or leather), fittings, rune bands (colour, glow) and the glow part's glow.
TRIM = {
    1: {"wood": "#A07850", "dark": "#6E4E35", "wrap": "#F3E9D2", "fit": "#8A8F99", "rune": None, "glow": 0.0},
    2: {"wood": "#8a6040", "dark": "#5a3c28", "wrap": "#6E4E35", "fit": "#aeb6bf", "rune": None, "glow": 0.0},
    3: {"wood": "#5e4434", "dark": "#3e2c22", "wrap": "#34466B", "fit": "#7f93a8", "rune": 0.35, "glow": 0.25},
    4: {"wood": "#4a3328", "dark": "#2e211b", "wrap": "#6E4E35", "fit": "#d9a93a", "rune": 0.5, "glow": 0.9},
    5: {"wood": "#f4f1ea", "dark": "#c9c1b2", "wrap": "#34466B", "fit": "#f0d27a", "rune": 1.0, "glow": 1.4},
}


def mats(kind, tier):
    t, g = TRIM[tier], GLOW[kind]
    spec = {"M_Wood": t["wood"], "M_Dark": t["dark"], "M_Wrap": t["wrap"], "M_Fit": t["fit"], "M_Iron": "#4A4A4F",
            "M_String": "#F3E9D2", "M_Glass": ("#cfe3f3", 0.12) if tier < 4 else (g, t["glow"])}
    spec["M_Rune"] = (g, t["rune"]) if t["rune"] else t["dark"]
    spec["M_Glow"] = (g, t["glow"]) if t["glow"] else t["fit"]
    return spec


def weapon(wid, spec, build, sharp=50):
    ob = pe.part(wid, pe.materials(spec), build, sharp=sharp)
    pe.regrade([ob], (0.8, 1.0))
    return [ob]


def ring_band(pc, c, axis, r, h, n=8):
    """A thin band round a shaft (a fitting or a rune ring)."""
    lathe(pc, c, [(r, -h / 2), (r, h / 2)], n=n, axis=axis)


# ================================================================ the Marksman's recurve bow (bow kind: the willow bow's convention)
def recurve(tier):
    half, arc, rec = 0.31, 0.1, 1.45

    def y(z):
        u = abs(z) / half
        return arc * u * u - rec * max(0.0, u - 0.62) ** 2

    def b(pc):
        n = 11
        zs = [half * (2 * i / (n - 1) - 1) for i in range(n)]
        pc.mat = "M_Wood"
        pc.tube([(0, y(z), z) for z in zs], [(0.012 + 0.012 * (1 - abs(z) / half) ** 1.4, 0.006 + 0.01 * (1 - abs(z) / half) ** 1.2) for z in zs],
                sides=6, tip=False, up=Vector((1, 0, 0)))
        pc.mat = "M_Dark"                                         # the riser: thicker, with an arrow shelf
        pc.tube([(0, -0.004, -0.11), (0, -0.016, -0.04), (0, -0.02, 0.04), (0, -0.01, 0.11)], [0.021, 0.026, 0.024, 0.017], sides=6, tip=False)
        rbox(pc, (0.0, -0.03, 0.052), (0.02, 0.026, 0.012), ch=0.3)
        pc.mat = "M_String"
        pc.tube([(0, y(-half) + 0.004, -half + 0.008), (0, y(half) + 0.004, half - 0.008)], [0.0035, 0.0035], sides=4, tip=False, cap=False)
        pc.mat = "M_Wrap"
        lathe(pc, (0, -0.016, 0), [(0.029, -0.04), (0.031, 0), (0.029, 0.04)], n=6)
        pc.mat = "M_Fit"                                          # tip caps where the limbs curl
        for s in (1, -1):
            lathe(pc, (0, y(half * 0.97), s * half * 0.97), [(0.011, -0.022), (0.013, 0), (0, 0.03)], n=6, axis=(0, 0, s))
        if tier >= 3:                                             # rune bands on both limbs
            pc.mat = "M_Rune"
            for s in (1, -1):
                for z in (0.15, 0.2):
                    ring_band(pc, (0, y(z), s * z), (0, 0, 1), 0.019, 0.008, n=6)
        if tier >= 4:                                             # the glow part: a gem set in the riser's face
            pc.mat = "M_Glow"
            lathe(pc, (0, -0.045, 0.0), [(0, -0.018), (0.013, 0), (0, 0.018)], n=6, axis=(0, -1, 0), phase=math.pi / 6)
        if tier == 5:
            for s in (1, -1):
                pc.blob((0, y(half * 0.62) - 0.006, s * half * 0.62), 0.009, segs=6, rings=3)
    return weapon(f"recurve-{tier}", mats("recurve", tier), b)


# ================================================================ the Sniper's long rifle (barrel -Y, grip down at the origin)
def rifle(tier):
    def b(pc):
        pc.mat = "M_Wood"
        rbox(pc, (0, 0.012, -0.03), (0.026, 0.034, 0.075), ch=0.4, rot=Matrix.Rotation(math.radians(-14), 3, "X"))   # the pistol grip
        stock = [(0.03, 0.026, 0.02), (0.1, 0.03, 0.0), (0.18, 0.032, -0.02), (0.235, 0.034, -0.03)]       # (y, half-width, z-centre), deepening to the butt
        rings = []
        for yy, w, zc in stock:
            hz = 0.026 + (yy - 0.03) * 0.12
            rings.append([Vector((x * w, yy, zc + zz * hz)) for x, zz in ((1, 1), (1, -1), (-1, -1), (-1, 1))])
        pc.band(rings, caps=(None, Vector((0, 0.24, -0.032))))
        rbox(pc, (0, -0.16, 0.024), (0.028, 0.2, 0.028), ch=0.4)          # the forend under the barrel
        pc.mat = "M_Dark"
        rbox(pc, (0, 0.238, -0.032), (0.07, 0.012, 0.1), ch=0.3)           # the butt plate
        pc.mat = "M_Fit"
        rbox(pc, (0, -0.035, 0.034), (0.032, 0.11, 0.044), ch=0.35)        # the receiver
        lathe(pc, (0, -0.07, 0.04), [(0.0095, 0), (0.0095, 0.33), (0.0125, 0.335), (0.0125, 0.37), (0, 0.37)], n=8, axis=(0, -1, 0))   # barrel and muzzle brake
        pc.tube([(0.016, -0.02, 0.046), (0.04, -0.012, 0.046)], [0.004, 0.004], sides=4, tip=False)   # the bolt handle
        pc.blob((0.044, -0.012, 0.046), 0.008, segs=6, rings=3)
        pc.tube([(0, -0.045, 0.01), (0, -0.046, -0.014), (0, -0.016, -0.02), (0, 0.002, -0.004)], [0.0045] * 4, sides=4, tip=False, cap=False)   # trigger guard
        pc.mat = "M_Iron"                                                  # the scope: a tube on two mounts, the objective bell forward
        lathe(pc, (0, 0.045, 0.082), [(0.013, 0), (0.0125, 0.03), (0.0115, 0.13), (0.0165, 0.16), (0.0175, 0.19)], n=8, axis=(0, -1, 0))
        for yy in (0.0, -0.075):
            rbox(pc, (0, yy, 0.064), (0.014, 0.014, 0.022), ch=0.2)
        lathe(pc, (0, -0.012, 0.082), [(0.0135, -0.012), (0.0135, 0.012)], n=8, axis=(1, 0, 0))   # the turret
        pc.mat = "M_Glass"
        lathe(pc, (0, -0.144, 0.082), [(0.0145, 0), (0, 0.004)], n=8, axis=(0, -1, 0))             # the lens (glows from T4)
        if tier >= 3:
            pc.mat = "M_Rune"
            for yy in (-0.2, -0.26):
                ring_band(pc, (0, yy, 0.04), (0, 1, 0), 0.0115, 0.008)
        if tier >= 4:
            pc.mat = "M_Glow"
            rbox(pc, (0.018, 0.11, -0.004), (0.004, 0.08, 0.016), ch=0.3)     # a glowing inlay along the stock
            rbox(pc, (-0.018, 0.11, -0.004), (0.004, 0.08, 0.016), ch=0.3)
    return weapon(f"rifle-{tier}", mats("rifle", tier), b)


# ================================================================ the Hunter's harpoon crossbow (forward -Y, grip at the origin)
def harpoon(tier):
    def b(pc):
        pc.mat = "M_Wood"
        rbox(pc, (0, 0.01, -0.03), (0.026, 0.032, 0.07), ch=0.4, rot=Matrix.Rotation(math.radians(-12), 3, "X"))   # grip
        rbox(pc, (0, 0.1, 0.0), (0.03, 0.16, 0.05), ch=0.4, rot=Matrix.Rotation(math.radians(6), 3, "X"))             # shoulder stock
        rbox(pc, (0, -0.15, 0.03), (0.034, 0.32, 0.034), ch=0.4)                                                       # the tiller
        pc.mat = "M_Fit"                                                                                              # the prod, curved back at its tips
        pc.tube([(-0.2, -0.23, 0.04), (-0.12, -0.285, 0.04), (0, -0.305, 0.04), (0.12, -0.285, 0.04), (0.2, -0.23, 0.04)],
                [0.007, 0.011, 0.014, 0.011, 0.007], sides=6, tip=False)
        rbox(pc, (0, -0.3, 0.035), (0.05, 0.03, 0.045), ch=0.3)                                                       # the prod's clamp
        pc.mat = "M_String"
        for s in (1, -1):
            pc.tube([(s * 0.2, -0.23, 0.045), (s * 0.02, -0.03, 0.05)], [0.003, 0.003], sides=4, tip=False, cap=False)
        pc.mat = "M_Iron"                                                                                             # the reel and its chain
        lathe(pc, (0.03, -0.05, 0.01), [(0.026, -0.016), (0.03, -0.012), (0.03, 0.012), (0.026, 0.016)], n=8, axis=(1, 0, 0))
        for k in range(4):
            pc.blob((0.038, -0.09 - k * 0.035, 0.042 + (k % 2) * 0.004), (0.006, 0.016, 0.004 if k % 2 else 0.009), segs=6, rings=3)
        pc.mat = "M_Dark"                                                                                             # the harpoon: a shaft on the tiller
        pc.tube([(0, 0.0, 0.066), (0, -0.36, 0.066)], [0.0065, 0.0065], sides=6, tip=False)
        pc.mat = "M_Glow" if tier >= 4 else "M_Fit"                                                                   # its barbed head
        lathe(pc, (0, -0.36, 0.066), [(0.012, 0), (0.016, 0.012), (0, 0.055)], n=6, axis=(0, -1, 0))
        for s in (1, -1):
            pc.tube([(s * 0.008, -0.38, 0.066), (s * 0.02, -0.365, 0.066)], [0.004, 0.002], sides=4, tip=True)
        if tier >= 3:
            pc.mat = "M_Rune"
            for yy in (-0.08, -0.14, -0.2):
                rbox(pc, (0, yy, 0.048), (0.036, 0.008, 0.006), ch=0.2)
    return weapon(f"harpoon-{tier}", mats("harpoon", tier), b)


# ================================================================ the Gunslinger's revolver (the brass revolver's convention: barrel -Y)
def sixgun(tier):
    def b(pc):
        pc.mat = "M_Wood"
        rbox(pc, (0, 0.016, -0.036), (0.034, 0.046, 0.088), ch=0.45, rot=Matrix.Rotation(math.radians(18), 3, "X"))   # the grip
        pc.mat = "M_Fit"
        rbox(pc, (0, -0.026, 0.036), (0.034, 0.096, 0.05), ch=0.35)                                                     # the frame
        lathe(pc, (0, -0.07, 0.056), [(0.012, 0), (0.012, 0.15), (0.016, 0.152), (0.016, 0.165), (0, 0.165)], n=8, axis=(0, -1, 0))   # the long barrel
        pc.tube([(0, -0.08, 0.04), (0, -0.2, 0.04)], [0.0045, 0.0045], sides=4, tip=False)                              # the ejector rod
        pc.tube([(0, 0.02, 0.058), (0, 0.03, 0.07)], [0.0055, 0.0035], sides=4, tip=True)                              # the hammer spur
        pc.tube([(0, -0.05, 0.012), (0, -0.048, -0.012), (0, -0.022, -0.022), (0, 0.0, -0.006)], [0.005] * 4, sides=4, tip=False, cap=False)   # trigger guard
        lathe(pc, (0, -0.232, 0.071), [(0.0, 0), (0.004, 0.0), (0.0, 0.012)], n=4, axis=(0, 0, 1))                       # the front sight
        pc.mat = "M_Iron"                                                                                               # the cylinder, fluted
        lathe(pc, (0, 0.002, 0.05), [(0.028, 0), (0.033, 0.008), (0.033, 0.046), (0.028, 0.054)], n=12, axis=(0, -1, 0), phase=math.pi / 12)
        pc.mat = "M_Glow" if tier >= 4 else "M_Dark"                                                                  # the chambers' mouths
        for k in range(6):
            a = math.pi / 6 + k * math.pi / 3
            lathe(pc, (math.cos(a) * 0.019, -0.053, 0.05 + math.sin(a) * 0.019), [(0.0065, 0), (0, 0.003)], n=6, axis=(0, -1, 0))
        if tier >= 3:
            pc.mat = "M_Rune"
            for yy in (-0.12, -0.17):
                ring_band(pc, (0, yy, 0.056), (0, 1, 0), 0.0135, 0.007)
    return weapon(f"sixgun-{tier}", mats("sixgun", tier), b)


MODELS = [(f"{kind}-{t}", (lambda f, t: lambda: f(t))(fn, t), 800) for kind, fn in (("recurve", recurve), ("rifle", rifle), ("harpoon", harpoon), ("sixgun", sixgun)) for t in range(1, 6)]

if __name__ == "__main__":
    pe.build_all(MODELS, "weapons", ONLY or [m[0] for m in MODELS])
