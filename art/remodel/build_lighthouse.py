"""The lighthouse on its islet off the wharf, remodelled as ours (game/remodel; David, 2026-10-27), in place of the
dump's (acnh/furniture/lighthouse.glb), which the new world draws at scale 0.2 (web/data/world "lighthouse").

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_lighthouse.py

Writes game/props/lighthouse.glb in the old model's frame (rkit.export_in_frame at 0.2: 7.6 tall, 1.8 round at the
foot as drawn, the origin on the ground at the tower's middle, its door toward +z): a stout tapering tower, cream with
two coral bands, on a stone footing with three steps up to a timber door, two small round windows, a gallery on corbels
with an iron rail, the lantern room's panes (warm glass) under a coral dome with a ball finial and a little weather vane.
Plain colour on the shared presets (P_Stone, P_Paint, P_Wood, P_Metal, P_Glass), the colour in COLOR_0: no textures.
"""
import math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K, PS, export_in_frame  # noqa: E402

TAU = math.tau
DRAWN = 0.2
CREAM, CORAL, STONE, IRON, GLASS, ROOF = "#f2e8d2", "#d9604f", "#bfb29a", "#3d4a48", "#ffe6a8", "#c8513f"


def lighthouse():
    K.reset()
    M = PS.presets("stone", "paint", "wood", "metal", "glass")
    k = K.Kit("lighthouse")
    n = 20
    # The footing: a low round of stone in two courses.
    k.lathe((0, 0, 0), [(0.0, -0.3), (1.78, -0.3), (1.8, 0.0), (1.8, 0.28), (1.74, 0.34), (1.58, 0.36), (1.56, 0.6), (1.5, 0.66), (0.0, 0.66)],
            M["stone"], STONE, n=n)
    # The tower: a taper from 1.25 to 0.78 round, cream with two coral bands; the colour by height.
    prof = [(1.26, 0.66), (1.2, 1.6), (1.12, 2.6), (1.04, 3.5), (0.96, 4.4), (0.88, 5.2), (0.84, 5.56)]
    faces = k.lathe((0, 0, 0), prof, M["paint"], CREAM, n=n)
    bands = ((1.7, 2.55), (3.55, 4.4))
    PS.recolor(k, faces, lambda x, y, z: CORAL if any(a <= y <= b for a, b in bands) else CREAM)
    # Gallery: corbel ring, a deck, posts and two rails.
    k.lathe((0, 0, 0), [(0.84, 5.4), (1.08, 5.6), (1.18, 5.66), (1.18, 5.74), (0.0, 5.74)], M["stone"], PS.shade(STONE, 1.05), n=n)
    for i in range(16):
        a = TAU * i / 16
        k.tube([(math.cos(a) * 1.12, 5.74, math.sin(a) * 1.12), (math.cos(a) * 1.12, 6.12, math.sin(a) * 1.12)], 0.022, M["metal"], IRON, n=4, v_len=1.0)
    for y in (5.94, 6.12):
        ring = [(math.cos(a) * 1.12, y, math.sin(a) * 1.12) for a in [TAU * i / 24 for i in range(24)]]
        k.tube(ring, 0.026, M["metal"], IRON, n=5, v_len=1.0, closed_path=True)
    # Lantern room: a low wall, glass panes between iron mullions, a cornice.
    k.lathe((0, 0, 0), [(0.7, 5.74), (0.7, 5.98), (0.66, 6.0)], M["paint"], CREAM, n=12)
    k.lathe((0, 0, 0), [(0.64, 6.0), (0.64, 6.68)], M["glass"], GLASS, n=12)
    for i in range(6):
        a = TAU * i / 6
        k.tube([(math.cos(a) * 0.66, 5.99, math.sin(a) * 0.66), (math.cos(a) * 0.66, 6.7, math.sin(a) * 0.66)], 0.03, M["metal"], IRON, n=4, v_len=1.0)
    k.lathe((0, 0, 0), [(0.0, 6.66), (0.76, 6.66), (0.8, 6.72), (0.76, 6.78), (0.0, 6.78)], M["metal"], IRON, n=12)
    # The dome, a ball finial and a vane.
    k.lathe((0, 0, 0), [(0.74, 6.78), (0.7, 6.95), (0.58, 7.12), (0.38, 7.26), (0.14, 7.34), (0.0, 7.35)], M["paint"], ROOF, n=14)
    k.blob((0, 7.42, 0), (0.08, 0.08, 0.08), M["metal"], IRON, segs=8, rings=5)
    k.tube([(0, 7.42, 0), (0, 7.6, 0)], 0.015, M["metal"], IRON, n=4, v_len=1.0)
    k.extrude([(0.0, -0.05), (0.32, 0.0), (0.0, 0.05)], -0.008, 0.008, M["metal"], IRON, at=(0, 7.55, 0))
    # The door toward +z up three steps, and two round windows above it on the other sides.
    for i in range(3):
        k.rbox((0, 0.66 + 0.06 + i * 0.12, 1.58 - i * 0.14), (0.9 - i * 0.08, 0.12, 0.3), 0.02, M["stone"], PS.shade(STONE, 0.96 + 0.03 * i), segs=1)
    k.rbox((0, 1.4, 1.235), (0.56, 0.98, 0.1), 0.06, M["wood"], "#8a5a3a", segs=2)
    k.rbox((0, 1.92, 1.23), (0.62, 0.1, 0.12), 0.03, M["paint"], CORAL, segs=1)
    k.blob((0.17, 1.38, 1.29), (0.03, 0.03, 0.03), M["metal"], "#c9a25a", segs=6, rings=4)
    for y, yaw, rr in ((2.95, 0.0, 1.085), (4.75, math.pi * 0.85, 0.925), (3.3, -math.pi * 0.7, 1.06)):
        cx, cz = math.sin(yaw) * rr, math.cos(yaw) * rr
        k.lathe((cx, y, cz), [(0.0, 0.02), (0.16, 0.02), (0.18, 0.0), (0.18, -0.04)], M["glass"], "#4c5a63", d=(math.sin(yaw), 0, math.cos(yaw)), n=10)
        k.lathe((cx, y, cz), [(0.16, 0.03), (0.2, 0.03), (0.2, -0.03)], M["paint"], CREAM, d=(math.sin(yaw), 0, math.cos(yaw)), n=10)
    k.tint_gradient(0.84, 1.0, -0.3, 7.6)
    ob = k.finish(smooth_deg=40)
    export_in_frame(ob, DRAWN, "game/props/lighthouse.glb")


if __name__ == "__main__":
    lighthouse()
