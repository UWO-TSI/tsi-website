"""Items without a model of their own (specs/game-ui.md §2, §4): held in front from the tool wheel, and the source of
their icons. Fruit, rocks and ore, mushrooms, the seven bugs the island has no critter for, and the small things the
shop sells (the coin, a recipe card, a dye bottle, the lucky bobber, the merch, the hand wraps and the buckler).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_items.py [-- render <dir>]

Writes web/public/assets/game/items/<key>.glb. The weapons' look (build_weapons.py): matte palette colours, the shared
top-light gradient, low-poly with smooth shading inside 50 degrees. Each sits on its base at the origin, Blender Z up,
its front toward -Y; sizes are roughly true to each other (an apple a fist), the engine fits them where they're shown.
The dye bottle's liquid is M_Dye, tinted per dye where it is shown. With `render`, a review sheet of every item.
"""
import bpy, math, os, random, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from pe import lathe, rbox, jitter  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "assets", "game", "items")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TAU = math.tau
bpy.ops.wm.read_factory_settings(use_empty=True)
MODELS = []


def item(key):
    def deco(fn):
        MODELS.append((key, fn))
        return fn
    return deco


def model(name, mats, build, grad=(0.78, 1.0), wobble=0.0):
    m = {k: kit.material(f"{name}_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat=next(iter(mats)))
    build(pc)
    ob = pc.finish(name, None, m, sharp=50, grad=grad)
    if wobble:
        jitter(ob, wobble, seed=len(name))
    return ob


def leaf(pc, at, d, length=0.05, width=0.022):
    """A small flat leaf from `at` along `d` (a fruit's stem leaf)."""
    at, d = Vector(at), Vector(d).normalized()
    side = d.cross(Vector((0, 0, 1))).normalized() if abs(d.z) < 0.95 else Vector((1, 0, 0))
    up = side.cross(d).normalized()
    pts = [at + d * length * u + up * 0.004 * math.sin(math.pi * u) for u in (0, 0.25, 0.55, 0.85, 1.0)]
    pc.tube(pts, [(width * 0.2, 0.002), (width * 0.85, 0.002), (width, 0.002), (width * 0.6, 0.002), (0.001, 0.001)], sides=4, tip=False, up=up)


# ================================================================ fruit
def round_fruit(pc, r, squash=1.0, dimple=0.15, top_dip=0.0, segs=12):
    """A fruit body by lathe: round, a little flattened, dimpled at the top for the stem."""
    prof = []
    for k in range(9):
        a = -math.pi / 2 + math.pi * k / 8
        rr = math.cos(a) * r * (1 + 0.04 * math.sin(2 * a))
        z = (math.sin(a) + 1) * r * squash
        if k == 8:
            z -= r * dimple
        prof.append((max(rr, 0.0) if 0 < k < 8 else 0.0, z))
    lathe(pc, (0, 0, 0), prof, n=segs)


@item("apple")
def apple():
    def b(pc):
        pc.mat = "Skin"; round_fruit(pc, 0.05, 0.9)
        pc.mat = "Stem"; pc.tube([(0, 0, 0.082), (0.004, 0, 0.1), (0.01, 0, 0.112)], [0.004, 0.0035, 0.003], sides=5, tip=False)
        pc.mat = "Leaf"; leaf(pc, (0.006, 0, 0.104), (1, 0.2, 0.35))
    return model("apple", {"Skin": "#C9433A", "Stem": "#6B4A2E", "Leaf": "#7FA35A"}, b)


@item("peach")
def peach():
    def b(pc):
        pc.mat = "Skin"
        round_fruit(pc, 0.05, 0.95, dimple=0.05)
        pc.mat = "Blush"; pc.blob((0.0, -0.024, 0.058), (0.03, 0.026, 0.03), segs=8, rings=5)
        pc.mat = "Leaf"; leaf(pc, (0, 0, 0.092), (0.6, 0.4, 0.5), 0.055, 0.024)
    return model("peach", {"Skin": "#F2B38B", "Blush": "#EA8C79", "Leaf": "#86A75E"}, b)


@item("fruit_pear")
def pear():
    def b(pc):
        pc.mat = "Skin"
        lathe(pc, (0, 0, 0), [(0, 0), (0.03, 0.004), (0.047, 0.03), (0.044, 0.056), (0.029, 0.08), (0.021, 0.1), (0.016, 0.117), (0, 0.124)], n=12)
        pc.mat = "Stem"; pc.tube([(0, 0, 0.12), (0.006, 0, 0.142)], [0.004, 0.003], sides=5, tip=False)
    return model("fruit_pear", {"Skin": "#BFC85A", "Stem": "#6B4A2E"}, b)


@item("fruit_orange")
def orange():
    def b(pc):
        pc.mat = "Skin"; round_fruit(pc, 0.05, 0.95, dimple=0.06, segs=14)
        pc.mat = "Leaf"; leaf(pc, (0, 0, 0.092), (-0.7, 0.3, 0.4), 0.05, 0.022)
        pc.mat = "Stem"; pc.blob((0, 0, 0.093), (0.008, 0.008, 0.005), segs=6, rings=3)
    return model("fruit_orange", {"Skin": "#EE8A2A", "Leaf": "#5E8A4A", "Stem": "#7C9A4A"}, b)


@item("fruit_cherry")
def cherry():
    def b(pc):
        for x in (-0.028, 0.026):
            pc.mat = "Skin"; pc.blob((x, 0, 0.026), (0.026, 0.026, 0.024), segs=10, rings=6)
            pc.mat = "Stem"; pc.tube([(x, 0, 0.046), (x * 0.55, 0.003, 0.09), (0.0, 0.004, 0.118)], [0.003, 0.0028, 0.0025], sides=4, tip=False)
        pc.mat = "Leaf"; leaf(pc, (0, 0.004, 0.118), (0.7, 0.1, 0.25), 0.05, 0.02)
    return model("fruit_cherry", {"Skin": "#A61E33", "Stem": "#5E7A3A", "Leaf": "#6F9A4E"}, b)


@item("fruit_coconut")
def coconut():
    def b(pc):
        pc.mat = "Husk"
        lathe(pc, (0, 0, 0), [(0, 0), (0.045, 0.01), (0.062, 0.045), (0.06, 0.08), (0.045, 0.11), (0.02, 0.128), (0, 0.132)], n=10, sx=1.0, sy=0.92)
        pc.mat = "Eyes"
        for k in range(3):
            a = TAU * k / 3
            pc.blob((math.cos(a) * 0.011, math.sin(a) * 0.011, 0.129), 0.005, segs=5, rings=3)
    return model("fruit_coconut", {"Husk": "#7A5534", "Eyes": "#3E2A1C"}, b, wobble=0.0015)


def berry_cluster(pc, n, r, spread, seed):
    rnd = random.Random(seed)
    pts = [(0, 0, r)]
    for k in range(n - 1):
        a = TAU * k / (n - 1) + rnd.uniform(-0.2, 0.2)
        pts.append((math.cos(a) * spread, math.sin(a) * spread, r * (0.9 + rnd.uniform(0, 0.4))))
    pts.append((0, 0, r * 2.4))
    for p in pts:
        pc.blob(p, r * rnd.uniform(0.9, 1.05), segs=7, rings=5)


@item("fruit_blackberry")
def blackberry():
    def b(pc):
        pc.mat = "Berry"
        # one berry made of drupelets: a ring of little spheres round a core
        lathe(pc, (0, 0, 0.004), [(0, 0), (0.022, 0.012), (0.026, 0.03), (0.02, 0.05), (0, 0.058)], n=8)
        for ring, z, rr in ((8, 0.018, 0.024), (8, 0.036, 0.023), (6, 0.052, 0.014)):
            for k in range(ring):
                a = TAU * k / ring + z * 30
                pc.blob((math.cos(a) * rr, math.sin(a) * rr, z), 0.009, segs=6, rings=4)
        pc.mat = "Leaf"
        for k in range(5):
            a = TAU * k / 5
            leaf(pc, (0, 0, 0.06), (math.cos(a), math.sin(a), 0.35), 0.024, 0.01)
    return model("fruit_blackberry", {"Berry": "#3A2A44", "Leaf": "#6F9A4E"}, b)


@item("fruit_blueberry")
def blueberry():
    def b(pc):
        pc.mat = "Berry"
        for x, y, z in ((-0.02, 0.0, 0.02), (0.02, 0.006, 0.02), (0.0, -0.014, 0.022), (0.002, 0.012, 0.048)):
            pc.blob((x, y, z), (0.02, 0.02, 0.018), segs=9, rings=6)
        pc.mat = "Crown"
        for x, y, z in ((-0.02, 0.0, 0.038), (0.02, 0.006, 0.038), (0.0, -0.014, 0.04), (0.002, 0.012, 0.066)):
            pc.tube([(x, y, z - 0.002), (x, y, z + 0.003)], [0.006, 0.0045], sides=5, tip=False)
    return model("fruit_blueberry", {"Berry": "#4F6DB5", "Crown": "#33467A"}, b)


# ================================================================ rocks and ore
@item("rock_stone")
def stone():
    def b(pc):
        pc.mat = "Stone"; pc.blob((0, 0, 0.034), (0.06, 0.05, 0.036), segs=8, rings=5)
    return model("rock_stone", {"Stone": "#9A968D"}, b, wobble=0.006)


@item("rock_clay")
def clay():
    def b(pc):
        pc.mat = "Clay"; rbox(pc, (0, 0, 0.026), (0.09, 0.07, 0.052), ch=0.5)
        pc.mat = "Dark"; pc.blob((0.015, -0.03, 0.04), (0.012, 0.006, 0.008), segs=6, rings=3)
    return model("rock_clay", {"Clay": "#C27D5A", "Dark": "#9D5E44"}, b, wobble=0.003)


@item("rock_iron_nugget")
def iron():
    def b(pc):
        pc.mat = "Iron"; pc.blob((0, 0, 0.028), (0.042, 0.036, 0.03), segs=7, rings=4)
        pc.mat = "Shine"; pc.blob((0.012, -0.022, 0.04), (0.014, 0.008, 0.01), segs=5, rings=3)
    return model("rock_iron_nugget", {"Iron": "#6E7175", "Shine": "#A9AFB4"}, b, wobble=0.005)


@item("rock_gold_nugget")
def gold():
    def b(pc):
        pc.mat = "Gold"; pc.blob((0, 0, 0.026), (0.04, 0.034, 0.028), segs=7, rings=4)
        pc.mat = "Shine"; pc.blob((-0.01, -0.02, 0.04), (0.012, 0.007, 0.009), segs=5, rings=3)
    return model("rock_gold_nugget", {"Gold": "#D9A93A", "Shine": "#F2D57A"}, b, wobble=0.005)


@item("rock_crystal")
def crystal():
    def b(pc):
        pc.mat = "Base"; pc.blob((0, 0, 0.012), (0.05, 0.04, 0.016), segs=7, rings=4)
        pc.mat = "Crystal"
        for x, y, h, lean in ((0.0, 0.0, 0.1, (0, 0)), (-0.026, 0.008, 0.07, (-0.35, 0.1)), (0.024, -0.006, 0.075, (0.3, -0.1)), (0.006, 0.02, 0.055, (0.1, 0.35))):
            d = Vector((lean[0], lean[1], 1)).normalized()
            lathe(pc, (x, y, 0.01), [(0.013, 0), (0.013, h * 0.7), (0, h)], n=6, axis=d)
    return model("rock_crystal", {"Base": "#8E8A84", "Crystal": "#A9DCEB"}, b)


# ================================================================ mushrooms
def mushroom(pc, cap_r, cap_h, stem_h, stem_r, flat=False):
    pc.mat = "Stem"
    lathe(pc, (0, 0, 0), [(0, 0), (stem_r * 1.15, 0.002), (stem_r, stem_h * 0.5), (stem_r * 0.9, stem_h)], n=8)
    pc.mat = "Gill"
    lathe(pc, (0, 0, stem_h - 0.002), [(stem_r * 0.8, 0), (cap_r * 0.95, cap_h * 0.15), (cap_r, cap_h * 0.2)], n=10)
    pc.mat = "Cap"
    prof = [(cap_r, cap_h * 0.18), (cap_r * 0.96, cap_h * 0.45), (cap_r * 0.75, cap_h * 0.8 if not flat else cap_h * 0.6), (cap_r * 0.35, cap_h * (0.98 if not flat else 0.75)), (0, cap_h if not flat else 0.78 * cap_h)]
    lathe(pc, (0, 0, stem_h - 0.002), prof, n=10)


@item("mushroom_round")
def mush_round():
    def b(pc):
        mushroom(pc, 0.045, 0.05, 0.04, 0.016)
        pc.mat = "Spots"
        for a, z in ((0.3, 0.07), (2.2, 0.075), (4.1, 0.068)):
            pc.blob((math.cos(a) * 0.028, math.sin(a) * 0.028, z), (0.008, 0.008, 0.004), segs=6, rings=3)
    return model("mushroom_round", {"Stem": "#EFE6D2", "Gill": "#D8C7A8", "Cap": "#C7553F", "Spots": "#F7F0E1"}, b)


@item("mushroom_flat")
def mush_flat():
    def b(pc):
        mushroom(pc, 0.055, 0.028, 0.032, 0.014, flat=True)
    return model("mushroom_flat", {"Stem": "#E9DEC6", "Gill": "#CBB38C", "Cap": "#A8794C"}, b)


@item("mushroom_skinny")
def mush_skinny():
    def b(pc):
        for x, y, s in ((0.0, 0.0, 1.0), (0.02, 0.012, 0.75), (-0.018, 0.01, 0.62)):
            pc.mat = "Stem"
            lathe(pc, (x, y, 0), [(0, 0), (0.007 * s, 0.002), (0.006 * s, 0.07 * s)], n=6)
            pc.mat = "Cap"
            lathe(pc, (x, y, 0.068 * s), [(0.016 * s, 0), (0.014 * s, 0.01 * s), (0.008 * s, 0.018 * s), (0, 0.022 * s)], n=8)
    return model("mushroom_skinny", {"Stem": "#F1E9D6", "Cap": "#D9B97A"}, b)


# ================================================================ bugs (the island's critters cover the rest)
def legs(pc, pairs, z, length, spread, mat="Leg"):
    pc.mat = mat
    for i, y in enumerate(pairs):
        for s in (-1, 1):
            pc.tube([(s * spread, y, z), (s * (spread + length * 0.6), y + 0.004 * (i - 1), z + 0.008), (s * (spread + length), y + 0.008 * (i - 1), 0.002)], [0.0028, 0.0024, 0.002], sides=4, tip=False)


@item("bug_honeybee")
def bee():
    def b(pc):
        pc.mat = "Body"; pc.blob((0, 0.01, 0.03), (0.022, 0.032, 0.022), segs=10, rings=6)
        pc.mat = "Stripe"
        for y in (0.0, 0.022):
            lathe(pc, (0, y, 0.03), [(0.0222, -0.005), (0.0232, 0.0), (0.0222, 0.005)], n=10, axis=(0, 1, 0), sy=1.0)
        pc.mat = "Head"; pc.blob((0, -0.03, 0.034), (0.014, 0.013, 0.014), segs=8, rings=5)
        pc.mat = "Wing"
        for s in (-1, 1):
            pc.blob((s * 0.02, 0.008, 0.056), (0.018, 0.012, 0.003), segs=7, rings=3)
        legs(pc, (-0.012, 0.0, 0.012), 0.018, 0.02, 0.012)
    return model("bug_honeybee", {"Body": "#E8B23C", "Stripe": "#3A2E26", "Head": "#3A2E26", "Wing": "#E9F1F2", "Leg": "#3A2E26"}, b)


def beetle(pc, horn):
    pc.mat = "Shell"; pc.blob((0, 0.012, 0.026), (0.03, 0.04, 0.022), segs=10, rings=6)
    pc.mat = "Seam"; pc.tube([(0, -0.018, 0.047), (0, 0.05, 0.03)], [0.0018, 0.0015], sides=3, tip=False)
    pc.mat = "Head"; pc.blob((0, -0.034, 0.024), (0.018, 0.014, 0.014), segs=8, rings=5)
    horn(pc)
    legs(pc, (-0.016, 0.004, 0.024), 0.014, 0.026, 0.02)


@item("bug_stag_beetle")
def stag():
    def horns(pc):
        pc.mat = "Horn"
        for s in (-1, 1):
            pc.tube([(s * 0.008, -0.044, 0.026), (s * 0.018, -0.07, 0.03), (s * 0.006, -0.088, 0.032)], [0.004, 0.0034, 0.002], sides=4, tip=True)
    return model("bug_stag_beetle", {"Shell": "#4A2E22", "Seam": "#2B1A13", "Head": "#3A241B", "Horn": "#5A3A28", "Leg": "#2B1A13"}, lambda pc: beetle(pc, horns))


@item("bug_rhinoceros_beetle")
def rhino():
    def horns(pc):
        pc.mat = "Horn"
        pc.tube([(0, -0.044, 0.03), (0, -0.062, 0.05), (0, -0.064, 0.072)], [0.0055, 0.004, 0.002], sides=5, tip=True)
        pc.tube([(0, -0.02, 0.044), (0, -0.034, 0.058)], [0.004, 0.002], sides=4, tip=True)
    return model("bug_rhinoceros_beetle", {"Shell": "#2E3A2C", "Seam": "#1C251B", "Head": "#232C22", "Horn": "#3A4A38", "Leg": "#1C251B"}, lambda pc: beetle(pc, horns))


@item("bug_walking_stick")
def stick():
    def b(pc):
        pc.mat = "Body"
        pc.tube([(0, -0.07, 0.012), (0.002, -0.02, 0.014), (-0.002, 0.03, 0.013), (0, 0.07, 0.01)], [0.0045, 0.005, 0.0045, 0.003], sides=5, tip=True)
        pc.blob((0, -0.074, 0.013), (0.005, 0.007, 0.005), segs=6, rings=4)
        pc.mat = "Leg"
        for y in (-0.05, -0.01, 0.03):
            for s in (-1, 1):
                pc.tube([(s * 0.003, y, 0.012), (s * 0.03, y + 0.012, 0.024), (s * 0.045, y + 0.03, 0.002)], [0.002, 0.0018, 0.0015], sides=3, tip=False)
        pc.tube([(0, -0.077, 0.014), (-0.01, -0.105, 0.02)], [0.0015, 0.001], sides=3, tip=False)
        pc.tube([(0, -0.077, 0.014), (0.01, -0.105, 0.02)], [0.0015, 0.001], sides=3, tip=False)
    return model("bug_walking_stick", {"Body": "#8C7A4E", "Leg": "#76663F"}, b)


@item("bug_snail")
def snail():
    def b(pc):
        pc.mat = "Body"
        pc.tube([(0, 0.04, 0.006), (0, 0.0, 0.009), (0, -0.04, 0.012), (0, -0.056, 0.026)], [(0.012, 0.007), (0.014, 0.009), (0.012, 0.009), (0.009, 0.009)], sides=6, tip=False)
        for s in (-1, 1):
            pc.tube([(s * 0.004, -0.058, 0.032), (s * 0.008, -0.066, 0.05)], [0.0016, 0.0012], sides=3, tip=False)
            pc.blob((s * 0.008, -0.066, 0.051), 0.0028, segs=5, rings=3)
        pc.mat = "Shell"
        pc.blob((0.0, 0.012, 0.034), (0.02, 0.028, 0.028), segs=10, rings=6)
        pc.mat = "Spiral"   # the whorl on both faces, a shade darker
        for s in (-1, 1):
            pts = []
            for k in range(16):
                t = k / 15
                a = TAU * 1.75 * t
                r = 0.022 * (1 - 0.85 * t)
                pts.append((s * (0.0185 - 0.004 * t * t), 0.012 + math.sin(a) * r, 0.034 + math.cos(a) * r))
            pc.tube(pts, [0.0022] * len(pts), sides=4, tip=False)
    return model("bug_snail", {"Body": "#C9B79A", "Shell": "#B98048", "Spiral": "#8A5A2E"}, b)


@item("bug_cricket")
def cricket():
    def b(pc):
        pc.mat = "Body"; pc.blob((0, 0.006, 0.02), (0.016, 0.034, 0.016), segs=8, rings=5)
        pc.blob((0, -0.03, 0.024), (0.013, 0.012, 0.013), segs=7, rings=4)
        pc.mat = "Leg"
        for s in (-1, 1):
            pc.tube([(s * 0.012, 0.02, 0.02), (s * 0.03, 0.03, 0.05), (s * 0.034, 0.062, 0.004)], [0.004, 0.003, 0.002], sides=4, tip=False)
            pc.tube([(s * 0.008, -0.036, 0.03), (s * 0.03, -0.07, 0.05)], [0.0012, 0.0008], sides=3, tip=False)
        legs(pc, (-0.016, -0.002), 0.014, 0.022, 0.012)
    return model("bug_cricket", {"Body": "#5A4A30", "Leg": "#45391F"}, b)


@item("bug_bagworm")
def bagworm():
    def b(pc):
        pc.mat = "Thread"; pc.tube([(0, 0, 0.13), (0, 0, 0.088)], [0.0012, 0.0012], sides=3, tip=False)
        pc.mat = "Bag"
        lathe(pc, (0, 0, 0.0), [(0, 0), (0.012, 0.01), (0.02, 0.04), (0.018, 0.07), (0.008, 0.088), (0, 0.09)], n=8)
        pc.mat = "Twig"
        for k in range(7):
            a, z = TAU * k / 7, 0.02 + 0.009 * k
            pc.tube([(math.cos(a) * 0.016, math.sin(a) * 0.016, z), (math.cos(a + 0.4) * 0.02, math.sin(a + 0.4) * 0.02, z + 0.02)], [0.0025, 0.002], sides=3, tip=False)
    return model("bug_bagworm", {"Thread": "#E8E1D0", "Bag": "#8A6F4E", "Twig": "#6E5536"}, b, wobble=0.0008)


# ================================================================ shop odds and ends
@item("coin")
def coin():
    def b(pc):
        pc.mat = "Gold"
        lathe(pc, (0, 0, 0.0), [(0, -0.008), (0.046, -0.008), (0.05, -0.004), (0.05, 0.004), (0.046, 0.008), (0, 0.008)], n=18, axis=(0, -1, 0))
        pc.mat = "Leaf"   # an embossed leaf on the face, the club's
        leaf(pc, (-0.002, -0.0095, -0.024), (0.15, 0, 1), 0.05, 0.02)
    return model("coin", {"Gold": "#E2B547", "Leaf": "#C9962E"}, b)


@item("gem")
def gem():
    def b(pc):
        pc.mat = "Gem"
        # a cut gem: a flat crown over a pointed pavilion, eight facets round
        lathe(pc, (0, 0, 0), [(0, 0), (0.05, 0.05), (0.034, 0.072), (0, 0.074)], n=8, phase=math.pi / 8)
        pc.mat = "Table"; lathe(pc, (0, 0, 0.0735), [(0.022, 0), (0, 0.0012)], n=8, phase=math.pi / 8)
    return model("gem", {"Gem": "#5FC2C7", "Table": "#A9E4E6"}, b, grad=(0.7, 1.0))


@item("recipe_card")
def card():
    def b(pc):
        pc.mat = "Paper"; rbox(pc, (0, 0, 0.004), (0.09, 0.12, 0.006), ch=0.4)
        pc.mat = "Ink"
        rbox(pc, (0, -0.02, 0.0075), (0.06, 0.05, 0.001), ch=0)
        for y in (0.025, 0.04):
            rbox(pc, (0, y, 0.0075), (0.06, 0.006, 0.001), ch=0)
        pc.mat = "Pin"; pc.blob((0, -0.05, 0.009), (0.008, 0.008, 0.004), segs=6, rings=3)
    return model("recipe_card", {"Paper": "#F3E7C9", "Ink": "#C9A97A", "Pin": "#C9463D"}, b)


@item("dye_bottle")
def dye():
    def b(pc):
        pc.mat = "Glass"
        lathe(pc, (0, 0, 0), [(0, 0), (0.03, 0.002), (0.034, 0.02), (0.032, 0.06), (0.014, 0.075), (0.012, 0.09)], n=10)
        pc.mat = "Dye"
        lathe(pc, (0, 0, 0.004), [(0, 0), (0.031, 0.002), (0.0345, 0.02), (0.0325, 0.05), (0, 0.05)], n=10)
        pc.mat = "Cork"; lathe(pc, (0, 0, 0.088), [(0.011, 0), (0.0125, 0.012), (0.0115, 0.02), (0, 0.022)], n=8)
        pc.mat = "Label"; lathe(pc, (0, 0, 0.026), [(0.0352, 0), (0.0352, 0.018)], n=10)
    return model("dye_bottle", {"Glass": "#DCEBE8", "Dye": "#B9B9B9", "Cork": "#B08A5E", "Label": "#F3E7C9"}, b)


@item("bobber-lucky")
def bobber():
    def b(pc):
        pc.mat = "Red"; pc.blob((0, 0, 0.045), (0.032, 0.032, 0.026), segs=12, rings=4)
        pc.mat = "White"; lathe(pc, (0, 0, 0.0), [(0, 0.008), (0.024, 0.016), (0.031, 0.03), (0.032, 0.044), (0, 0.044)], n=12)
        pc.mat = "Stem"; pc.tube([(0, 0, 0.07), (0, 0, 0.095)], [0.004, 0.003], sides=5, tip=False)
        pc.tube([(0, 0, 0.0), (0, 0, 0.012)], [0.003, 0.003], sides=5, tip=False)
        pc.mat = "Clover"
        for k in range(4):
            a = TAU * k / 4 + 0.4
            pc.blob((math.cos(a) * 0.009, -0.03, 0.056 + math.sin(a) * 0.009), (0.007, 0.002, 0.007), segs=6, rings=3)
    return model("bobber-lucky", {"Red": "#D2493D", "White": "#F4EEE2", "Stem": "#3E3A36", "Clover": "#6FAF5A"}, b)


@item("merch-sticker-pack")
def stickers():
    def b(pc):
        cols = ("SheetA", "SheetB", "SheetC")
        for i, m in enumerate(cols):
            pc.mat = m
            rbox(pc, (0.006 * i - 0.006, 0.004 * i, 0.002 + 0.004 * i), (0.08, 0.1, 0.003), ch=0.3, rot=Matrix.Rotation(math.radians(8 * (i - 1)), 3, "Z"))
        pc.mat = "Mark"; pc.blob((0.008, 0.012, 0.0125), (0.022, 0.022, 0.002), segs=10, rings=3)
        pc.mat = "Dot"; pc.blob((-0.018, -0.026, 0.0125), (0.01, 0.01, 0.002), segs=8, rings=3)
    return model("merch-sticker-pack", {"SheetA": "#F7F2E4", "SheetB": "#EFE6D2", "SheetC": "#FBF8F0", "Mark": "#426B5B", "Dot": "#E8704A"}, b)


@item("merch-tote")
def tote():
    def b(pc):
        pc.mat = "Canvas"; rbox(pc, (0, 0, 0.06), (0.11, 0.022, 0.12), ch=0.25)
        pc.mat = "Strap"
        for x in (-0.03, 0.03):
            pc.tube([(x, -0.004, 0.115), (x * 0.9, -0.004, 0.16), (0, -0.004, 0.172), (-x * 0.9, -0.004, 0.16), (-x, -0.004, 0.115)][:3] + [(x * 0.2, -0.004, 0.17)], [0.004] * 4, sides=4, tip=False)
        pc.mat = "Mark"; rbox(pc, (0, -0.012, 0.06), (0.05, 0.002, 0.05), ch=0.3)
    return model("merch-tote", {"Canvas": "#EFE4CC", "Strap": "#C9B48E", "Mark": "#426B5B"}, b)


@item("wraps-cloth")
def wraps():
    def b(pc):
        pc.mat = "Cloth"
        pts = []
        for k in range(28):
            a = TAU * 2.6 * k / 27
            pts.append((math.cos(a) * 0.03, math.sin(a) * 0.03, 0.012 + 0.0018 * k))
        pc.tube(pts, [(0.004, 0.012)] * len(pts), sides=4, tip=False)
        pc.tube([pts[-1], (0.05, -0.02, 0.06), (0.07, -0.04, 0.05)], [(0.003, 0.011)] * 3, sides=4, tip=False)
    return model("wraps-cloth", {"Cloth": "#EDE3CF"}, b)


@item("shield-buckler")
def buckler():
    def b(pc):
        pc.mat = "Wood"; lathe(pc, (0, 0, 0), [(0, -0.008), (0.07, -0.006), (0.075, 0.004), (0.06, 0.012), (0, 0.016)], n=14, axis=(0, -1, 0))
        pc.mat = "Rim"; pc.tube([(math.cos(TAU * k / 16) * 0.073, 0, math.sin(TAU * k / 16) * 0.073) for k in range(16)], [0.006] * 16, sides=5, closed_loop=True)
        pc.mat = "Boss"; pc.blob((0, -0.016, 0), (0.02, 0.012, 0.02), segs=8, rings=4)
    return model("shield-buckler", {"Wood": "#9A6B44", "Rim": "#8D9396", "Boss": "#B9BEC1"}, b)


built = []
os.makedirs(OUT, exist_ok=True)
for key, fn in MODELS:
    ob = fn()
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{key}.glb"), export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)
    print(f"MODEL items/{key} tris={kit.ntris(ob)}")
    built.append(ob)

if "render" in ARGS:
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    kit.render_setup(sc, (0.94, 0.91, 0.84, 1))
    sc.render.film_transparent = False
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = sc.render.resolution_y = 200
    kit.show_vertex_colors(sc)
    for ob in built:
        for o in built:
            o.hide_render = o is not ob
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        mid = sum(pts, Vector()) / 8
        size = max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))
        e, a = math.radians(24), math.radians(-35)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = mid + d * 4
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        cam.data.ortho_scale = size * 1.35
        cam.data.clip_end = 20
        sc.render.filepath = os.path.join(out, f"{ob.name}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDER_OK", out)
