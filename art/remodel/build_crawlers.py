"""The catchable crawlers and the cicada, remodelled as ours (game/remodel; David, 2026-10-27): the ladybug, grasshopper
and mantis that crawl in the grass and the cicada that perches on trunks (components/game/Critters.tsx SPECIES), in place
of the dump's (acnh/critters/). Soft round bodies on thin legs, a few bold colours, no fine detail.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_crawlers.py

Frame (the dump's, so Critters' scales hold): the head toward +z (Critters turns a bug to face where it goes), standing
on y 0, the origin under the body's middle. Authored in game units at the size Critters draws each (ladybug 0.13,
cicada 0.1, grasshopper and mantis 0.11) and written at 1 / that scale under game/remodel/critters/<name>.glb (the
dump's file name: lib/game/world/active.ts worldModel swaps the folder in the new world). P_Paint, the colour in COLOR_0;
the cicada's wings are P_Glass (clear, the look's glass class). No textures.
"""
import math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K, export_in_frame  # noqa: E402

DARK = "#2b2a2e"


def kit(name):
    K.reset()
    return K.Kit(name), {"paint": K.Mat("P_Paint", rough=0.6), "glass": K.Mat("P_Glass", rough=0.1)}


def legs(k, M, col, pairs, r, spread, lift, foot_y=0.0):
    """Three pairs of bent legs from the body's sides at z positions `pairs`, out by `spread`, knees up `lift`."""
    for z, out, back in pairs:
        for s in (-1, 1):
            root = (s * spread * 0.35, lift * 0.6, z)
            knee = (s * spread * 0.75 * out, lift * 1.2, z + back * 0.4)
            foot = (s * spread * out, foot_y + 0.002, z + back)
            k.tube([root, knee, foot], r, M["paint"], col, n=4, v_len=1.0, radii=[1.0, 0.85, 0.5])


def antennae(k, M, col, base, length, r, spread=0.5):
    x, y, z = base
    for s in (-1, 1):
        k.tube([(s * r * 2, y, z), (s * length * spread * 0.5, y + length * 0.45, z + length * 0.5), (s * length * spread, y + length * 0.6, z + length)],
               r, M["paint"], col, n=3, v_len=1.0, radii=[1.0, 0.8, 0.6])


def ladybug():
    k, M = kit("ladybug")
    L, W, H = 0.17, 0.15, 0.085
    k.blob((0, 0.022, 0), (W * 0.48, H * 0.75, L * 0.48), M["paint"], "#d8433a", segs=12, rings=6, flat_bottom=-H * 0.5)
    # The split down the back and the spots: dark blobs pressed into the shell.
    k.tube([(0, 0.022 + H * 0.74, -L * 0.47), (0, 0.022 + H * 0.79, 0.0), (0, 0.022 + H * 0.7, L * 0.38)], 0.004, M["paint"], DARK, n=3, v_len=1.0)
    for x, z, r in ((0.036, 0.02, 0.016), (-0.036, 0.02, 0.016), (0.045, -0.045, 0.013), (-0.045, -0.045, 0.013), (0.0, -0.068, 0.012), (0.03, 0.06, 0.011), (-0.03, 0.06, 0.011)):
        y = 0.022 + H * 0.75 * math.sqrt(max(0.0, 1 - (x / (W * 0.48)) ** 2 - (z / (L * 0.48)) ** 2))
        k.blob((x, y - 0.003, z), (r, r * 0.4, r), M["paint"], DARK, segs=6, rings=3)
    k.blob((0, 0.03, L * 0.48), (0.035, 0.028, 0.026), M["paint"], DARK, segs=8, rings=4)
    for s in (-1, 1):
        k.blob((s * 0.018, 0.04, L * 0.52), (0.008, 0.008, 0.006), M["paint"], "#f4efe2", segs=5, rings=3)
    legs(k, M, DARK, [(0.04, 1.05, 0.03), (0.0, 1.15, 0.0), (-0.04, 1.05, -0.03)], 0.004, 0.11, 0.03)
    antennae(k, M, DARK, (0, 0.04, L * 0.55), 0.04, 0.0025)
    ob = k.finish(smooth_deg=60)
    export_in_frame(ob, 0.13, "game/remodel/critters/ladybug.glb")


def grasshopper():
    k, M = kit("grasshopper")
    G1, G2 = "#7fae4f", "#9cc76a"
    L = 0.3
    k.lathe((0, 0.07, 0), [(0.0, -L * 0.5), (0.022, -L * 0.42), (0.034, -L * 0.15), (0.038, L * 0.12), (0.034, L * 0.26), (0.0, L * 0.3)], M["paint"], G1, d=(0, 0, 1), n=8)
    k.blob((0, 0.085, L * 0.33), (0.032, 0.04, 0.042), M["paint"], G2, segs=8, rings=5)
    for s in (-1, 1):
        k.blob((s * 0.026, 0.1, L * 0.37), (0.012, 0.014, 0.012), M["paint"], "#3d4a2a", segs=6, rings=4)
        # The big jumping legs: the thigh up and back, the shin down to the ground behind.
        k.tube([(s * 0.03, 0.07, L * 0.02), (s * 0.06, 0.14, -L * 0.22), (s * 0.055, 0.004, -L * 0.42)], 0.011, M["paint"], G2, n=5, v_len=1.0, radii=[1.3, 0.8, 0.4])
    # Folded wings along the back.
    k.blob((0, 0.1, -L * 0.1), (0.028, 0.012, L * 0.36), M["paint"], "#6b9842", segs=6, rings=4)
    legs(k, M, G1, [(L * 0.2, 1.0, 0.04), (L * 0.08, 1.0, 0.0)], 0.006, 0.1, 0.06)
    antennae(k, M, "#5d8a3a", (0, 0.11, L * 0.38), 0.13, 0.003, 0.4)
    ob = k.finish(smooth_deg=60)
    export_in_frame(ob, 0.11, "game/remodel/critters/grasshopper.glb")


def mantis():
    k, M = kit("mantis")
    G1, G2 = "#8fbf5a", "#b4d77e"
    # The long abdomen low at the back, a slender neck rising forward, a triangular head with big eyes.
    k.lathe((0, 0.09, -0.08), [(0.0, -0.17), (0.028, -0.14), (0.045, -0.05), (0.04, 0.05), (0.02, 0.1), (0.0, 0.11)], M["paint"], G1, d=(0, 0.15, 1), n=8)
    k.tube([(0, 0.1, 0.02), (0, 0.15, 0.12), (0, 0.2, 0.2)], 0.016, M["paint"], G2, n=6, v_len=1.0, radii=[1.2, 1.0, 0.9])
    k.blob((0, 0.215, 0.215), (0.04, 0.026, 0.024), M["paint"], G2, segs=8, rings=4)
    for s in (-1, 1):
        k.blob((s * 0.038, 0.222, 0.215), (0.015, 0.016, 0.015), M["paint"], "#5f8f3a", segs=6, rings=4)
        # The folded catching arms, held up in front.
        k.tube([(s * 0.014, 0.17, 0.14), (s * 0.04, 0.2, 0.22), (s * 0.03, 0.14, 0.26), (s * 0.02, 0.17, 0.3)], 0.009, M["paint"], G2, n=5, v_len=1.0, radii=[1.0, 1.2, 0.9, 0.5])
    k.blob((0, 0.12, -0.08), (0.04, 0.014, 0.15), M["paint"], "#79a84a", segs=6, rings=4)
    legs(k, M, G1, [(0.0, 1.0, 0.06), (-0.06, 1.1, -0.06)], 0.006, 0.18, 0.08)
    antennae(k, M, G1, (0, 0.235, 0.23), 0.12, 0.0025, 0.5)
    ob = k.finish(smooth_deg=60)
    export_in_frame(ob, 0.11, "game/remodel/critters/mantis.glb")


def cicada():
    k, M = kit("brown-cicada")
    B1, B2 = "#6e5440", "#8a6b4f"
    L = 0.3
    k.lathe((0, 0.06, 0), [(0.0, -L * 0.45), (0.04, -L * 0.36), (0.058, -L * 0.1), (0.06, L * 0.12), (0.05, L * 0.28), (0.0, L * 0.34)], M["paint"], B1, d=(0, 0, 1), n=10)
    k.blob((0, 0.07, L * 0.3), (0.06, 0.04, 0.04), M["paint"], B2, segs=8, rings=5)
    for s in (-1, 1):
        k.blob((s * 0.055, 0.08, L * 0.33), (0.018, 0.018, 0.018), M["paint"], "#3a3230", segs=6, rings=4)
        # A clear wing tented over the back, its veins drawn by a dark rim.
        tip = (s * 0.03, 0.08, -L * 0.62)
        root = (s * 0.025, 0.115, L * 0.16)
        outer = (s * 0.095, 0.075, -L * 0.2)
        pts = [root, outer, tip, (s * 0.01, 0.12, -L * 0.2)]
        k.face([k.vert(p) for p in (pts if s > 0 else pts[::-1])], [(0, 0), (1, 0), (1, 1), (0, 1)], M["glass"], "#d8e4e0")
        k.tube([root, outer, tip], 0.004, M["paint"], B1, n=3, v_len=1.0)
    legs(k, M, B1, [(L * 0.15, 1.0, 0.03), (0.0, 1.0, 0.0), (-L * 0.1, 1.0, -0.03)], 0.006, 0.13, 0.04)
    ob = k.finish(smooth_deg=60)
    export_in_frame(ob, 0.1, "game/remodel/critters/brown-cicada.glb")


if __name__ == "__main__":
    ladybug()
    grasshopper()
    mantis()
    cicada()
