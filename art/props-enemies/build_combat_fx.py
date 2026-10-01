"""Combat polish 7 (specs/combat-polish.md): the arrow, the staff bolt, the spore spit and the totem.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_combat_fx.py [-- id ...]

Projectiles fly toward -Y (glTF +Z: EncounterRender yaws +Z along the velocity), centred on the origin. The totem
stands on z = 0, its face toward -Y. Rig units like the rest (the engine scales by 1.3). Matte (row 264); the parts
the engine tints per totem kind are the `glow` node (one material, M_Glow).
"""
import math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pe  # noqa: E402
from pe import TAU, lathe, rbox, parent  # noqa: E402

pe.reset()
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
FWD = (0, -1, 0)


def arrow():
    M = pe.materials({"M_Shaft": "#b98a5a", "M_Head": "#6f747a", "M_Fletch": "#e4dccb", "M_Nock": "#c25a3a"})

    def b(pc):
        pc.mat = "M_Shaft"
        pc.tube([(0, 0.2, 0), (0, -0.19, 0)], [0.012, 0.012], sides=6, tip=False)
        pc.mat = "M_Head"                                    # a leaf-shaped iron head
        lathe(pc, (0, -0.19, 0), [(0.014, 0), (0.03, 0.03), (0.022, 0.065), (0, 0.1)], n=4, axis=FWD, sy=0.45)
        pc.mat = "M_Fletch"                                  # three fins at the back
        for k in range(3):
            a = TAU * k / 3 + math.pi / 2
            out = Vector((math.cos(a), 0, math.sin(a)))
            pc.band([[Vector((0, 0.06, 0)) + out * 0.012, Vector((0, 0.19, 0)) + out * 0.012],
                     [Vector((0, 0.09, 0)) + out * 0.045, Vector((0, 0.2, 0)) + out * 0.05]], closed=False)
        pc.mat = "M_Nock"
        lathe(pc, (0, 0.2, 0), [(0.015, 0), (0.015, 0.02), (0, 0.03)], n=6, axis=(0, 1, 0))

    ob = pe.part("arrow", M, b, sharp=50)
    pe.regrade([ob], (0.85, 1.0))
    return [ob]


def bolt():
    """The staff's bolt: a six-sided rune shard with a pale core, chips trailing it."""
    M = pe.materials({"M_Shard": "#b48cff", "M_Core": "#efe6ff"})

    def b(pc):
        pc.mat = "M_Shard"
        lathe(pc, (0, 0.11, 0), [(0, 0), (0.05, 0.07), (0.055, 0.12), (0, 0.24)], n=6, axis=FWD, phase=math.pi / 6)
        pc.mat = "M_Core"
        lathe(pc, (0, 0.03, 0), [(0, 0), (0.022, 0.04), (0, 0.11)], n=5, axis=FWD, phase=0.3)
        pc.mat = "M_Shard"
        for k, (x, y, z, r) in enumerate(((0.04, 0.16, 0.02, 0.018), (-0.035, 0.2, -0.015, 0.014), (0.01, 0.24, 0.035, 0.011))):
            lathe(pc, (x, y, z), [(0, -r), (r, 0), (0, r)], n=4, axis=(0.3 * k, 1, 0.2), phase=0.4 * k)

    ob = pe.part("bolt", M, b, sharp=30)
    pe.regrade([ob], (0.85, 1.0))
    return [ob]


def spit():
    """The mushroom beast's spore glob: a lumpy ball with spores shedding behind it."""
    M = pe.materials({"M_Glob": "#8fd14f", "M_Spore": "#e6f5a8"})

    def b(pc):
        pc.mat = "M_Glob"
        pc.blob((0, 0, 0), (0.07, 0.085, 0.065), segs=8, rings=6)
        pc.blob((0.03, 0.07, 0.02), 0.035, segs=6, rings=4)
        pc.blob((-0.025, 0.1, -0.012), 0.026, segs=6, rings=4)
        pc.mat = "M_Spore"
        for x, y, z, r in ((0.045, -0.03, 0.035, 0.014), (-0.05, 0.01, 0.03, 0.012), (0.01, 0.05, -0.055, 0.013), (0.0, 0.15, 0.02, 0.012), (-0.03, 0.18, -0.02, 0.009)):
            pc.blob((x, y, z), r, segs=5, rings=3)

    ob = pe.part("spit", M, b, sharp=60)
    pe.regrade([ob], (0.8, 1.0))
    return [ob]


def totem():
    """A carved post on a few stones: a face, two notched rings and a crest; the eyes and rings take the kind's colour."""
    M = pe.materials({"M_Wood": "#9a6a44", "M_Dark": "#5e3d2a", "M_Stone": "#9b978c", "M_Crest": "#e9dfc9", "M_Glow": "#f4efe2"})
    H = 0.86

    def post(pc):
        pc.mat = "M_Stone"
        for k, (r, h) in enumerate(((0.1, 0.06), (0.085, 0.05), (0.09, 0.055))):
            a = TAU * k / 3 + 0.4
            rbox(pc, (math.cos(a) * 0.13, math.sin(a) * 0.13, h / 2), (r * 1.4, r, h), ch=0.4, rot=Matrix.Rotation(a, 3, "Z"))
        pc.mat = "M_Wood"
        lathe(pc, (0, 0, 0), [(0.11, 0), (0.1, 0.12), (0.092, 0.3), (0.1, 0.36), (0.1, 0.62), (0.092, 0.7), (0.11, 0.76), (0.085, H), (0, H + 0.01)], n=8)
        pc.mat = "M_Dark"                                    # brow and mouth carved into the front
        rbox(pc, (0, -0.092, 0.58), (0.13, 0.03, 0.025), ch=0.3)
        rbox(pc, (0, -0.09, 0.45), (0.08, 0.03, 0.03), ch=0.3)
        lathe(pc, (0, -0.1, 0.5), [(0, 0), (0.016, 0.0), (0, 0.045)], n=4, axis=(0, -1, 0))   # nose
        pc.mat = "M_Crest"                                   # three feathers fanned on top
        for a in (-0.45, 0, 0.45):
            d = Vector((math.sin(a), 0.12, math.cos(a)))
            lathe(pc, (0, 0, H - 0.02), [(0, 0), (0.03, 0.05), (0.022, 0.15), (0, 0.2)], n=4, axis=d, sy=0.35)

    def glow(pc):
        pc.mat = "M_Glow"
        for x in (-0.04, 0.04):                              # the eyes
            lathe(pc, (x, -0.098, 0.525), [(0, -0.004), (0.022, 0), (0, 0.006)], n=6, axis=(0, -1, 0), sy=0.75)
        for z in (0.33, 0.66):                               # two notched rings
            for k in range(8):
                a = TAU * (k + 0.5) / 8
                c = Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, z))
                rbox(pc, c, (0.035, 0.012, 0.03), ch=0, rot=Matrix.Rotation(a + math.pi / 2, 3, "Z"))

    p = pe.part("post", M, post, sharp=40, first="M_Wood")
    g = pe.part("glow", M, glow, sharp=40, first="M_Glow")
    parent(g, p)
    pe.regrade([p, g], (0.72, 1.0))
    return [p, g]


MODELS = [("projectile-arrow", arrow, 200), ("projectile-bolt", bolt, 200), ("projectile-spit", spit, 300), ("totem", totem, 900)]

if __name__ == "__main__":
    pe.build_all(MODELS, "props", ONLY)
