"""The gather rocks, remodelled as ours (game/remodel; David, 2026-10-27): the five rocks a player strikes for stone and
ore (web/data/world kind "rock", models rock-a, rock-b, rock-c; drawn by the map's props at about scale 1), in place of
the dump's (acnh/props/rock-{a,b,c}.glb). Built with the new world's organic stone (art/props/build_stones.py: a
chiselled hull with bevelled edges, a tone per facet, the foot darker), bare of moss but for a touch on the top, so they
read as the island's own stone and as something to strike, a little cooler and greyer than the mossy path rocks.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_rocks.py

Writes game/remodel/props/rock-{a,b,c}.glb (the dump's names: worldModel swaps the folder) in game units at scale 1 (the dump's frame: the origin on the ground at the
middle), each inside its old footprint and under its PROP_TOP (lib/game/defaultIsland.ts: a 0.48 by 0.45, top 0.61;
b 0.46 by 0.42, top 0.59; c 0.5 by 0.5, top 0.52). P_Stone, the colour in COLOR_0: no textures.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "props"))
import build_stones as S  # noqa: E402

GREY = "#c3c8c4"
ROCKS = {
    # name: [(half size, seed, cuts, at, yaw, moss)]: one stone filling the old rock's footprint
    "a": [((0.55, 0.38, 0.5), 21, [((0.2, 1, 0.1), 0.86), ((1, 0.2, -0.3), 0.88), ((-0.5, 0.3, 1), 0.9)], (0.0, 0, 0.0), 0.4, 0.12)],
    "b": [((0.53, 0.37, 0.48), 23, [((-0.3, 1, 0.2), 0.86), ((0.8, 0.3, 0.6), 0.86), ((-1, 0, -0.2), 0.9)], (0.0, 0, 0.0), 1.1, 0.1)],
    "c": [((0.57, 0.32, 0.56), 25, [((0, 1, 0.1), 0.8), ((1, 0.1, 0.4), 0.88), ((-0.4, 0.2, -1), 0.88)], (0.0, 0, 0.0), 2.0, 0.14)],
}


def rock(name):
    k = S.kit(f"gather-rock-{name}")
    for size, seed, cuts, at, yaw, moss in ROCKS[name]:
        S.place(k, S.chunk(size, seed, cuts=cuts, taper=0.18, n=20, segs=1), at, yaw=yaw, seed=seed, stone=GREY, moss=moss, sink=0.04)
    ob = k.finish(smooth_deg=68)
    K.export([ob], f"game/remodel/props/rock-{name}.glb")


if __name__ == "__main__":
    for n in ROCKS:
        rock(n)
