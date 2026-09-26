"""Crafting props: the clubhouse DIY workbench, the beach message bottle and a tree-branch pickup.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_props.py [-- id ...]

Rig units like the rest (engine scale 1.3). The workbench's working side faces -Y (glTF +Z), long axis X, feet on z = 0.
The bottle lies on its side along X (cork toward -X) centred on its axis, so Workshop.tsx can rock it about X.
The branch lies flat on z = 0.
"""
import math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pe  # noqa: E402
from pe import lathe, rbox  # noqa: E402

pe.reset()
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
L, D, TOP = 1.3, 0.62, 0.45                             # workbench length, depth, top height


def workbench():
    M = pe.materials({"M_Top": "bench_top", "M_Leg": "bench_leg", "M_Iron": "iron", "M_Steel": "steel", "M_Handle": "oak_dark"})

    def b(pc):
        pc.mat = "M_Top"
        for k in range(3):                                   # three chunky planks
            rbox(pc, (0, (k - 1) * D / 3, TOP - 0.035), (L, D / 3 - 0.008, 0.07), ch=0.3)
        pc.mat = "M_Leg"
        for sx in (1, -1):
            for sy in (1, -1):
                rbox(pc, (sx * (L / 2 - 0.09), sy * (D / 2 - 0.08), (TOP - 0.07) / 2), (0.085, 0.085, TOP - 0.07), ch=0.25)
            rbox(pc, (sx * (L / 2 - 0.09), 0, 0.1), (0.06, D - 0.2, 0.05), ch=0)            # side rails
        rbox(pc, (0, 0, 0.14), (L - 0.2, D - 0.18, 0.035), ch=0)                               # lower shelf
        pc.mat = "M_Top"
        for x, r in ((-0.25, 0.055), (-0.12, 0.05), (0.2, 0.06)):                             # a couple of logs on the shelf
            lathe(pc, (x, -0.05, 0.157 + r), [(0, -0.12), (r, -0.12), (r, 0.12), (0, 0.12)], n=7, axis=(0.15, 1, 0))
        pc.mat = "M_Iron"                                    # vise on the front-left corner
        rbox(pc, (L / 2 - 0.12, -D / 2 - 0.02, TOP + 0.04), (0.16, 0.1, 0.09), ch=0.25)
        rbox(pc, (L / 2 - 0.12, -D / 2 - 0.085, TOP + 0.03), (0.16, 0.035, 0.1), ch=0.3)
        pc.mat = "M_Handle"
        pc.tube([(L / 2 - 0.12, -D / 2 - 0.1, TOP + 0.02), (L / 2 - 0.12, -D / 2 - 0.2, TOP + 0.02)], [0.012, 0.012], sides=5, tip=False)
        lathe(pc, (L / 2 - 0.2, -D / 2 - 0.2, TOP + 0.02), [(0, 0), (0.02, 0.01), (0.02, 0.15), (0, 0.16)], n=5, axis=(1, 0, 0))
        # hammer and saw on the top
        pc.tube([(-0.1, -0.12, TOP + 0.018), (0.12, -0.02, TOP + 0.018)], [0.016, 0.016], sides=5, tip=False)
        pc.mat = "M_Iron"
        rbox(pc, (-0.12, -0.13, TOP + 0.03), (0.05, 0.12, 0.05), ch=0.25, rot=Matrix.Rotation(math.radians(24), 3, "Z"))
        pc.mat = "M_Steel"
        rbox(pc, (-0.38, 0.1, TOP + 0.008), (0.3, 0.1, 0.012), ch=0, rot=Matrix.Rotation(math.radians(-12), 3, "Z"))
        pc.mat = "M_Handle"
        rbox(pc, (-0.2, 0.06, TOP + 0.02), (0.09, 0.07, 0.035), ch=0.3, rot=Matrix.Rotation(math.radians(-12), 3, "Z"))

    ob = pe.part("workbench", M, b, sharp=40)
    pe.regrade([ob], (0.75, 1.0))
    return [ob]


def message_bottle():
    M = pe.materials({"M_Glass": ("glass", 0, 0.55), "M_Cork": "cork", "M_Paper": "paper", "M_Tie": "crab_body"})
    base, ax = Vector((0.19, 0, 0)), (-1, 0, 0)

    def b(pc):
        pc.mat = "M_Glass"
        lathe(pc, base, [(0, 0), (0.095, 0), (0.11, 0.025), (0.11, 0.2), (0.075, 0.27), (0.04, 0.3), (0.04, 0.345), (0, 0.345)], n=12, axis=ax)
        pc.mat = "M_Cork"
        lathe(pc, base, [(0.043, 0.33), (0.047, 0.36), (0.042, 0.39), (0, 0.395)], n=8, axis=ax)
        pc.mat = "M_Paper"                                   # the rolled note inside
        lathe(pc, base, [(0, 0.05), (0.055, 0.05), (0.055, 0.22), (0, 0.22)], n=8, axis=ax, sy=0.9)
        pc.mat = "M_Tie"
        lathe(pc, base, [(0.058, 0.125), (0.058, 0.145)], n=8, axis=ax, sy=0.9)

    ob = pe.part("message-bottle", M, b, sharp=55)
    pe.regrade([ob], (0.85, 1.0))
    return [ob]


def branch():
    M = pe.materials({"M_Wood": "oak", "M_Leaf": "leaf"})

    def b(pc):
        pc.mat = "M_Wood"
        pc.tube([(-0.16, 0.0, 0.028), (-0.04, 0.012, 0.03), (0.07, -0.01, 0.027), (0.17, 0.01, 0.024)], [0.028, 0.026, 0.022, 0.016], sides=6, tip=True)
        pc.tube([(0.0, 0.008, 0.03), (0.07, 0.06, 0.027), (0.12, 0.09, 0.024)], [0.017, 0.014, 0.01], sides=5, tip=True, cap=False)
        pc.mat = "M_Leaf"
        for x, y, a in ((0.18, 0.04, 30), (0.13, 0.12, 70), (0.02, -0.05, -60)):
            c = Vector((x, y, 0.034))
            lathe(pc, c, [(0, -0.05), (0.032, -0.017), (0.026, 0.028), (0, 0.056)], n=5, axis=(math.cos(math.radians(a)), math.sin(math.radians(a)), 0.15), sy=0.35)

    ob = pe.part("branch", M, b, sharp=55)
    pe.regrade([ob], (0.85, 1.0))
    return [ob]


MODELS = [("workbench", workbench, 1000), ("message-bottle", message_bottle, 400), ("branch", branch, 300)]

if __name__ == "__main__":
    pe.build_all(MODELS, "props", ONLY)
