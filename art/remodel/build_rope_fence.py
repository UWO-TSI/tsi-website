"""The club monument's rope fence, remodelled as ours (game/remodel; David, 2026-10-27): the four lengths of rope that
close off the monument while it is being built (components/game/DefaultIslandWorld.tsx ClubMonument), in place of the
dump's (acnh/props/fence-rope-a.glb).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_rope_fence.py

Writes game/remodel/props/fence-rope-a.glb (the dump's name: worldModel swaps the folder) in game units at scale 1 (the dump's frame: about 1 along x, the origin on the ground
at the middle): two short timber posts with rounded caps at x -0.45 and +0.45, a thick rope lashed round each post's
head and sagging between them, a loose tail hanging off one post. P_Wood and P_Cloth (the rope's fibre), the colour in
COLOR_0: no textures.
"""
import math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K, PS  # noqa: E402

ROPE = "#c7a268"


def rope_fence():
    K.reset()
    M = PS.presets("wood", "cloth")
    k = K.Kit("rope-fence")
    top = 0.78
    for x in (-0.45, 0.45):
        k.lathe((x, 0, 0), [(0.0, -0.05), (0.062, -0.05), (0.06, top - 0.04), (0.05, top), (0.024, top + 0.03), (0.0, top + 0.035)],
                M["wood"], PS.WOOD, n=8)
        ring = [(x + math.cos(a) * 0.072, top - 0.12, math.sin(a) * 0.072) for a in [math.tau * i / 8 for i in range(8)]]
        k.tube(ring, 0.022, M["cloth"], ROPE, n=5, v_len=1.0, closed_path=True)
    sag = [(-0.42 + 0.84 * t, top - 0.12 - 0.2 * math.sin(math.pi * t), 0.0) for t in [i / 8 for i in range(9)]]
    k.tube(sag, 0.022, M["cloth"], ROPE, n=6, v_len=1.0)
    k.tube([(0.5, top - 0.12, 0.04), (0.53, top - 0.3, 0.06), (0.52, top - 0.42, 0.05)], 0.018, M["cloth"], ROPE, n=5, v_len=1.0, radii=[1, 1, 0.7], caps=True)
    k.tint_gradient(0.84, 1.0, 0.0, top)
    ob = k.finish(smooth_deg=50)
    K.export([ob], "game/remodel/props/fence-rope-a.glb")


if __name__ == "__main__":
    rope_fence()
