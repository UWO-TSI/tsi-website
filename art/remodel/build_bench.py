"""The plaza bench (game/remodel; David via the coordinator, 2026-10-27: "sitable remodel"): the new world's four plaza
benches (bench-0 to bench-3, lib/game/world/generate.ts) had no model. Ours: a backless park bench in the plaza set's
colours, three soft wooden slats on two round-shouldered painted iron ends, simple and chunky so it reads at game
distance. Backless because a bench seats you facing the side you walk up from (lib/game/defaultIsland.ts benchSeat).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_bench.py

Writes web/public/assets/game/props/plaza-bench.glb. Frame: game units at scale 1, the origin on the ground under the
seat's middle, the seat along x (the two sit slots at x -0.42 and 0.42, BENCH_SLOTS). The seat top at 0.5
(BENCH_SEAT_TOP), the whole bench inside half extents 0.98 x 0.27 (PROP_FOOTPRINT "plaza-bench"). Plain colour in
COLOR_0 on the shared presets: P_Wood (the slats), P_Metal (the ends). No textures.
"""
import math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K, PS  # noqa: E402

TOP, HALF_X, HALF_Z = 0.5, 0.96, 0.26
IRON = "#3f5a4c"   # a deep painted green, a shade off the island flag's


def bench():
    K.reset()
    M = PS.presets("wood", "metal")
    k = K.Kit("plaza-bench")
    # Three slats along x, a hair apart, their tops at TOP; the middle one a touch lighter.
    t = 0.06
    for i, z in enumerate((-0.17, 0.0, 0.17)):
        k.rbox((0, TOP - t / 2, z), (2 * HALF_X - 0.04, t, 0.15), 0.025, M["wood"],
               PS.LIGHTW if i == 1 else PS.shade(PS.WOOD, 1.04), segs=2, v_axis=0)
    # Two iron ends under the slats, in from each end: a rounded cross-rail carrying the seat, two legs flaring to wide
    # feet, a low stretcher between them.
    for x in (-0.66, 0.66):
        k.rbox((x, TOP - t - 0.03, 0), (0.08, 0.06, 2 * HALF_Z - 0.02), 0.025, M["metal"], IRON, segs=2)
        for s in (-1, 1):
            k.tube([(x, TOP - t - 0.05, s * 0.17), (x, 0.22, s * 0.2), (x, 0.03, s * 0.235)], 0.032, M["metal"], IRON,
                   n=6, v_len=1.0, radii=[1.05, 0.92, 1.12])
            k.rbox((x, 0.02, s * 0.235), (0.11, 0.04, 0.05), 0.015, M["metal"], PS.shade(IRON, 0.85), segs=1)
        k.rbox((x, 0.16, 0), (0.05, 0.05, 0.36), 0.02, M["metal"], IRON, segs=1)
    k.tint_gradient(0.84, 1.0, 0.0, TOP)
    return k.finish(smooth_deg=40)


if __name__ == "__main__":
    ob = bench()
    K.export([ob], "game/props/plaza-bench.glb")
    pts = [ob.matrix_world @ K.Vector(v.co) for v in ob.data.vertices]
    print("BENCH top", round(max(p.z for p in pts), 3), "half x", round(max(abs(p.x) for p in pts), 3),
          "half z", round(max(abs(p.y) for p in pts), 3))
