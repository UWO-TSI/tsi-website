"""The new world's jetty (terrain v3; David, 2026-10-26: "make the actual doc thing widider and also have a lower level
as well for boat docking naturally out", "have 3 entrance to actual doc"; R2b: "the boat dock is too small, needs to be
longer, and more branches ... 3 branches that kinda also connect on sea level ... for boats to park").

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_jetty.py [-- review <dir>]

One model in the wharf kit's wood and rope (art/wharf/build_wharf_kit.py): a wide platform at the wharf's deck height,
three gangways from it over a strip of water to the deck boards, and three piers out to sea from it. Each pier steps
down by stairs to a low level a hand over the water, where a walkway across joins all three; past it their ends reach on as fingers,
the water between them slips where boats moor. The boat moors on the middle finger's +x side (as the old pier's tip:
lib/game/wharf.ts MOORED, STEP_AT). Piles under every edge, rope fencing on posts, ladders, a cleat for the bow line.

Writes web/public/assets/game/wharf/jetty.glb in the wharf landmark's frame (lib/game/wharf.ts, before its yaw): x across
(+x the boat's side), z along it (+z inland, the fingers' tips at -3.5), y up: the low level's top at 0.3, the platform's
and the gangways' at 1, the sea at -0.078. lib/game/wharf.ts JETTY mirrors the rects and the piles.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_wharf_kit as W  # noqa: E402  (the kit's wood, rope, tones and wet line)
from build_wharf_kit import K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SEA = -0.078
TOP = 1.0                                      # the platform's deck (generate.ts H.deck)
LOW = 0.3                                      # the low level's deck, a hand over the waves
# The piers (x of the middle, z of the tip), 2 wide, spread out and each its own length (David, R2c: "spread out, not
# so univor"); the boat moors off the middle one's +x side.
PIERS = ((0.0, -3.5), (-10.5, -9.5), (11.0, -6.5))
HALF = 1.0                                     # a pier's half width
WALK, STAIR, PLAT = (0.6, 3.4), (3.4, 6.6), (9.0, 13.5)   # z: the low walkway, each pier's stairs, the platform
WALK_X = (-14.0, 14.5)                         # the walkway runs on past the outer piers ("the horizontal docks go wider and go for longer")
TREADS = 6
EDGE = 12.5                                    # the platform's half width
GANGWAYS = (-6.0, 0.0, 6.0)                    # their middles (x); 1.6 wide, from the platform to the deck boards
GANG_Z = (13.5, 16.0)
# Piles: (x, z), the deck's height over them (lib/game/wharf.ts JETTY.piles lists the same). Down every pier both sides
# every 2.6 from the tip and once under its high end, the walkway's corners and between the piers, the platform's
# ends and its seaward face between the piers.
def _low_z(tip):
    z, out = tip + 0.08, []
    while z < WALK[0] - 0.3:
        out.append(round(z, 2))
        z += 2.6
    return out
PILES = ([((px + sx * 1.15, z), LOW) for px, tip in PIERS for sx in (-1, 1) for z in _low_z(tip)]
         + [((px + sx * 1.15, 7.8), TOP) for px, _ in PIERS for sx in (-1, 1)]
         + [((x, z), LOW) for x in (WALK_X[0] + 0.15, -5.3, 5.5, WALK_X[1] - 0.15) for z in (WALK[0] + 0.15, WALK[1] - 0.15)]
         + [((sx * (EDGE + 0.15), z), TOP) for sx in (-1, 1) for z in (9.6, 13.3)] + [((x, 8.85), TOP) for x in (-5.3, 5.5)])
LADDERS = [((-EDGE, 11.25), math.pi / 2), ((EDGE, 11.25), -math.pi / 2)]
rng = np.random.default_rng(2610)


def boards(k, M, x0, x1, z0, z1, y):
    """Wide boards along z (inland) over the rect, a lane longer than 3 split once at its own place, on joists across.
    Plain boxes, no bevels (the budget: specs/perf/budget.md, 12k triangles for the whole jetty)."""
    n = max(1, round((x1 - x0) / 0.55))
    pitch = (x1 - x0) / n
    for b in range(n):
        x = x0 + (b + 0.5) * pitch
        cut = z0 + (z1 - z0) * (0.25 + 0.5 * rng.random())
        for a, c in (((z0, cut), (cut, z1)) if z1 - z0 > 3 else ((z0, z1),)):
            k.rbox((x, y - W.THICK / 2 + rng.uniform(-0.004, 0.0), (a + c) / 2), (pitch - W.GAP, W.THICK, c - a - W.GAP), 0, M,
                   W.board_tone(), uv_len=2.0, v_axis=2, uv_off=(rng.random(), rng.random()))
    for z in np.linspace(z0 + 0.2, z1 - 0.2, max(2, round((z1 - z0) / 2.4) + 1)):
        k.rbox(((x0 + x1) / 2, y - W.THICK - 0.1, z), (x1 - x0 - 0.02, 0.2, 0.17), 0, M, W.mix(W.DARK, "#4a3624", 0.5), uv_len=2.0, v_axis=0)


def stairs(k, M, x0, x1, z0, z1):
    """TREADS treads climbing LOW to TOP along +z over the rect, a riser under each, on a sloped stringer each side (David,
    R2c: "stairs down need to be more fitting": an open stair of the deck's own boards, not a dark box)."""
    w, run, rise, cheek = x1 - x0, (z1 - z0) / TREADS, (TOP - LOW) / TREADS, 0.1
    xc = (x0 + x1) / 2
    for i in range(TREADS):
        top, a = LOW + (i + 1) * rise, z0 + i * run
        k.rbox((xc, top - 0.04, a + run / 2), (w - 0.02, 0.08, run - 0.02), 0, M, W.board_tone(), uv_len=2.0, v_axis=0,
               uv_off=(rng.random(), rng.random()))
        k.rbox((xc, top - 0.08 - rise / 2, a + 0.04), (w - 2 * cheek - 0.02, rise, 0.05), 0, M, W.mix(W.board_tone(), W.DARK, 0.2), uv_len=2.0, v_axis=0)
    for x in (x0 + cheek / 2 + 0.02, x1 - cheek / 2 - 0.02):
        k.beam((x, LOW - 0.14, z0), (x, TOP - 0.14, z1), cheek, 0.2, 0, M, W.mix(W.DARK, "#4a3624", 0.5), uv_len=2.0)


def pile(k, M, x, z, top):
    """The kit's piling, lighter: its cap 0.35 over the deck at `top`, down into the bed, six-sided."""
    r, y0 = 0.15, top - 3.4
    prof = [(0.0, y0), (r, y0), (r, top + 0.28), (r * 0.75, top + 0.35), (0.0, top + 0.36)]
    k.lathe((x, 0, z), prof, M, W.mix(W.DARK, W.LIGHT, 0.45), n=6, u_tiles=1, v_len=1.6, phase=x + z)


def post(k, Mw, Mr, x, z, y):
    """The kit's rope post (0.87 tall), lighter: six-sided, a rounded top."""
    r, h = 0.085, 0.85
    prof = [(r * 1.1, -0.03), (r, 0.16), (r, h - 0.03), (r * 0.6, h + 0.02), (0.0, h + 0.025)]
    k.lathe((x, y, z), prof, Mw, W.mix(W.DARK, W.LIGHT, 0.6), n=6, u_tiles=1, v_len=0.9)


def fence(k, Mw, Mr, pts, y):
    """Rope fencing along a run of posts (x, z) on a deck at y (or (x, z, y) each, down a stair): a post at each, the rope sagging between."""
    pts = [p if len(p) == 3 else (*p, y) for p in pts]
    for x, z, py in pts:
        post(k, Mw, Mr, x, z, py)
    for (ax, az, ay), (bx, bz, by) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, bz - az)
        sag = 0.13 * min(1.0, L / 2)
        k.tube([(ax + (bx - ax) * t, ay + (by - ay) * t + W.ROPE_Y - sag * 4 * t * (1 - t), az + (bz - az) * t) for t in np.linspace(0, 1, 6)], W.ROPE_R, Mr,
               "#c7a268", n=4, v_len=0.12)


def ladder(k, M, x, z, yaw):
    """The kit's ladder off a deck at TOP: its edge at (x, z), the water out along the turn `yaw`."""
    c, s = math.cos(yaw), math.sin(yaw)
    at = lambda px, py, pz: (x + px * c + pz * s, TOP + py, z - px * s + pz * c)
    col, lz = W.mix(W.DARK, W.LIGHT, 0.55), -0.12
    for lx in (-0.25, 0.25):
        pts = [(lx, -2.0, lz), (lx, -0.05, lz), (lx, 0.05, lz), (lx, 0.32, lz - 0.02), (lx, 0.5, lz + 0.06), (lx, 0.55, lz + 0.22),
               (lx, 0.47, lz + 0.38), (lx, 0.3, lz + 0.47), (lx, 0.0, lz + 0.48)]
        k.tube([at(*p) for p in pts], 0.04, M, col, n=6, v_len=0.8, caps=True)
    for y in np.arange(-0.3, -1.95, -0.3):
        k.tube([at(-0.25, y, lz), at(0.25, y, lz)], 0.03, M, W.mix(col, W.LIGHT, rng.uniform(0, 0.4)), n=4, v_len=0.8)


def build():
    K.reset()
    deck, wood, rope = W.wood_mat("M_DeckWood", 2611), W.wood_mat("M_PileWood", 2612), K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    k = K.Kit("jetty")
    for px, tip in PIERS:
        x0, x1 = px - HALF, px + HALF
        boards(k, deck, x0, x1, tip, WALK[0], LOW)
        stairs(k, deck, x0, x1, *STAIR)
        boards(k, deck, x0, x1, STAIR[1], PLAT[0], TOP)
    boards(k, deck, *WALK_X, *WALK, LOW)
    boards(k, deck, -EDGE, EDGE, *PLAT, TOP)
    for g in GANGWAYS:
        boards(k, deck, g - 0.8, g + 0.8, *GANG_Z, TOP)
    for (x, z), top in PILES:
        pile(k, wood, x, z, top)
    for at, yaw in LADDERS:
        ladder(k, wood, *at, yaw)
    # Rope fencing: the outer piers' outer sides, the walkway's ends and its landward side past the outer piers, a rail
    # down both sides of every stair, the platform's seaward face between the piers and its ends round the ladders,
    # both sides of each gangway and the land face between them. The slips' sides stay open for boats.
    (lx, ltip), (rx, rtip) = PIERS[1], PIERS[2]
    fence(k, wood, rope, [(lx - HALF + 0.1, ltip + 0.1), (lx - HALF + 0.1, (ltip + WALK[0]) / 2), (lx - HALF + 0.1, WALK[0] + 0.1)], LOW)
    fence(k, wood, rope, [(rx + HALF - 0.1, rtip + 0.1), (rx + HALF - 0.1, (rtip + WALK[0]) / 2), (rx + HALF - 0.1, WALK[0] + 0.1)], LOW)
    for ex, ix in ((WALK_X[0] + 0.1, lx - HALF), (WALK_X[1] - 0.1, rx + HALF)):
        fence(k, wood, rope, [(ex, WALK[0] + 0.1), (ex, WALK[1] - 0.1), (ix, WALK[1] - 0.1)], LOW)
    for px, _ in PIERS:
        for sx in (-1, 1):
            x = px + sx * (HALF - 0.1)
            fence(k, wood, rope, [(x, STAIR[0] + 0.1, LOW), (x, STAIR[1], TOP), (x, PLAT[0] + 0.1, TOP)], TOP)
    for a, b in ((PIERS[1][0] + HALF + 0.1, -HALF - 0.1), (HALF + 0.1, PIERS[2][0] - HALF - 0.1)):
        fence(k, wood, rope, [(a, PLAT[0] + 0.1), ((a + b) / 2, PLAT[0] + 0.1), (b, PLAT[0] + 0.1)], TOP)
    for sx in (-1, 1):
        o = sx * (EDGE - 0.1)
        fence(k, wood, rope, [(o, PLAT[0] + 0.1), (o, 10.6)], TOP)
        fence(k, wood, rope, [(o, 11.9), (o, PLAT[1] - 0.1), (sx * (abs(GANGWAYS[0]) + 0.75), PLAT[1] - 0.1)], TOP)
    for g in GANGWAYS:
        for sx in (-1, 1):
            fence(k, wood, rope, [(g + sx * 0.75, PLAT[1] + 0.1), (g + sx * 0.75, GANG_Z[1] - 0.6)], TOP)
    for a, b in zip(GANGWAYS, GANGWAYS[1:]):
        fence(k, wood, rope, [(a + 0.75, PLAT[1] - 0.1), (b - 0.75, PLAT[1] - 0.1)], TOP)
    # The bow line's cleat (wharf.ts PIER.bowCleat) on the middle finger's boat side.
    k.rbox((0.8, LOW + 0.03, -1.98), (0.07, 0.05, 0.22), 0.015, wood, W.mix(W.DARK, "#4a3624", 0.5), segs=1)
    W.wet(k, below=SEA)
    k.tint_gradient(0.82, 1.0, -0.6, TOP + 0.9)
    ob = k.finish(smooth_deg=45)
    K.export([ob], "game/wharf/jetty.glb")
    W.report(ob)
    return ob


if __name__ == "__main__":
    ob = build()
    if "review" in ARGS:
        K.review([ob], os.path.join(ARGS[ARGS.index("review") + 1], "jetty.png"), views=((35, 32), (210, 26)), size=640)
