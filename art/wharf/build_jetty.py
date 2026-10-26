"""The new world's jetty (terrain v3 R2b; David, 2026-10-26: "make the actual doc thing widider and also have a lower level
as well for boat docking naturally out", "have 3 entrance to actual doc").

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_jetty.py [-- review <dir>]

One model in the wharf kit's wood and rope (art/wharf/build_wharf_kit.py): a wide platform at the wharf's deck height,
three gangways from it over a strip of water to the deck boards, stairs down from its seaward face to a landing at the
water where the boat moors (as the old pier's tip: lib/game/wharf.ts MOORED, STEP_AT), piles under every edge, rope
fencing on posts, ladders down the platform's sides, a cleat and a stern post for the boat's lines.

Writes web/public/assets/game/wharf/jetty.glb in the wharf landmark's frame (lib/game/wharf.ts, before its yaw): x across
(+x the boat's side), z along it (+z inland, the landing's tip at -3.5), y up: the landing's top at 0, the platform's and
the gangways' at 1, the sea at -0.078. lib/game/wharf.ts JETTY mirrors the rects and the piles.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_wharf_kit as W  # noqa: E402  (the kit's wood, rope, tones and wet line)
from build_wharf_kit import K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SEA = -0.078
TOP = 1.0                                      # the platform's deck (generate.ts H.deck)
LANDING = (-2.0, 1.0, -3.5, -0.5)              # x0, x1, z0, z1 at y 0
STAIRS = (-2.0, 1.0, -0.5, 1.5)                # climbing 0 to TOP along +z in four treads
PLATFORM = (-4.5, 4.5, 1.5, 5.5)
GANGWAYS = (-3.2, 0.0, 3.2)                    # their middles (x); 1.6 wide, from the platform to the deck boards
GANG_Z = (5.5, 7.9)
PILES = [((-2.2, -3.4), 0), ((-2.2, -1.9), 0), ((1.15, -3.42), 0), ((1.15, -0.7), 0),
         ((-4.3, 1.3), TOP), ((-2.3, 1.3), TOP), ((1.3, 1.3), TOP), ((4.3, 1.3), TOP),
         ((-4.7, 3.5), TOP), ((4.7, 3.5), TOP), ((-4.7, 5.3), TOP), ((4.7, 5.3), TOP), ((-1.6, 5.7), TOP), ((1.6, 5.7), TOP)]
LADDERS = [((-4.5, 3.5), math.pi / 2), ((4.5, 3.5), -math.pi / 2)]
rng = np.random.default_rng(2610)


def boards(k, M, x0, x1, z0, z1, y):
    """Wide boards along z (inland) over the rect, each lane split once at its own place, on joists across."""
    n = max(1, round((x1 - x0) / 0.5))
    pitch = (x1 - x0) / n
    for b in range(n):
        x = x0 + (b + 0.5) * pitch
        cut = z0 + (z1 - z0) * (0.25 + 0.5 * rng.random())
        for a, c in ((z0, cut), (cut, z1)):
            k.rbox((x, y - W.THICK / 2 + rng.uniform(-0.004, 0.0), (a + c) / 2), (pitch - W.GAP, W.THICK, c - a - W.GAP), 0.02, M,
                   W.board_tone(), segs=1, uv_len=2.0, v_axis=2, uv_off=(rng.random(), rng.random()))
    for z in np.linspace(z0 + 0.2, z1 - 0.2, max(2, round((z1 - z0) / 1.8) + 1)):
        k.rbox(((x0 + x1) / 2, y - W.THICK - 0.1, z), (x1 - x0 - 0.02, 0.2, 0.17), 0.02, M, W.mix(W.DARK, "#4a3624", 0.5), segs=1, uv_len=2.0, v_axis=0)


def stairs(k, M):
    x0, x1, z0, z1 = STAIRS
    w, run, rise, cheek = x1 - x0, (z1 - z0) / 4, TOP / 4, 0.09
    xc = (x0 + x1) / 2
    for i in range(4):
        top, a = (i + 1) * rise, z0 + i * run
        k.rbox((xc, top - 0.04, a + run / 2), (w - 2 * cheek - 0.01, 0.08, run - 0.02), 0.018, M, W.board_tone(), segs=1, uv_len=2.0, v_axis=0,
               uv_off=(rng.random(), rng.random()))
        lo = i * rise - 0.2
        k.rbox((xc, (lo + top - 0.08) / 2, a + 0.03), (w - 2 * cheek - 0.01, top - 0.08 - lo, 0.05), 0.012, M, W.mix(W.board_tone(), W.DARK, 0.4),
               segs=1, uv_len=2.0, v_axis=0)
        for x in (x0 + cheek / 2, x1 - cheek / 2):
            k.rbox((x, (top - 0.3) / 2 - 0.03, a + run / 2), (cheek, top + 0.3, run - 0.01), 0.02, M, W.mix(W.DARK, "#4a3624", 0.3), segs=1, uv_len=2.0, v_axis=2)


def pile(k, M, x, z, top):
    """The kit's piling: its cap 0.35 over the deck at `top`, down into the bed."""
    r, y0 = 0.15, top - 3.4
    prof = [(0.0, y0), (r * 0.9, y0), (r, y0 + 0.6), (r, SEA - 0.3), (r * 1.01, SEA), (r * 0.99, top - 0.4), (r * 0.98, top + 0.25),
            (r * 0.94, top + 0.31), (r * 0.72, top + 0.345), (0.0, top + 0.352)]
    wob = [1 + 0.04 * math.sin(j * 2.1 + x * 3 + z) for j in range(10)]
    k.lathe((x, 0, z), prof, M, W.mix(W.DARK, W.LIGHT, 0.45), n=10, u_tiles=1, v_len=1.6, wobble=lambda j, i: wob[j])


def post(k, Mw, Mr, x, z, y):
    """The kit's rope post (0.87 tall, the rope's collar at 0.66) standing on a deck at y."""
    r, h, ry = 0.085, 0.85, y + W.ROPE_Y
    prof = [(r * 1.12, -0.03), (r * 1.08, 0.04), (r, 0.16), (r, W.ROPE_Y - 0.06), (r * 0.9, W.ROPE_Y - 0.03), (r * 0.9, W.ROPE_Y + 0.03),
            (r, W.ROPE_Y + 0.06), (r * 0.99, h - 0.03), (r * 0.9, h), (r * 0.55, h + 0.018), (0.0, h + 0.022)]
    k.lathe((x, y, z), prof, Mw, W.mix(W.DARK, W.LIGHT, 0.6), n=10, u_tiles=1, v_len=0.9)
    ring = [(x + math.cos(a) * r * 0.98, ry, z + math.sin(a) * r * 0.98) for a in np.linspace(0, math.tau, 10, endpoint=False)]
    k.tube(ring, W.ROPE_R, Mr, "#c7a268", n=6, v_len=0.12, closed_path=True)


def fence(k, Mw, Mr, pts, y):
    """Rope fencing along a run of posts (x, z) on a deck at y: a post at each, the rope sagging between."""
    for x, z in pts:
        post(k, Mw, Mr, x, z, y)
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, bz - az)
        sag = 0.13 * min(1.0, L / 2)
        k.tube([(ax + (bx - ax) * t, y + W.ROPE_Y - sag * 4 * t * (1 - t), az + (bz - az) * t) for t in np.linspace(0, 1, 11)], W.ROPE_R, Mr, "#c7a268",
               n=6, v_len=0.12)


def ladder(k, M, x, z, yaw):
    """The kit's ladder off a deck at TOP: its edge at (x, z), the water out along the turn `yaw`."""
    c, s = math.cos(yaw), math.sin(yaw)
    at = lambda px, py, pz: (x + px * c + pz * s, TOP + py, z - px * s + pz * c)
    col, lz = W.mix(W.DARK, W.LIGHT, 0.55), -0.12
    for lx in (-0.25, 0.25):
        pts = [(lx, -2.0, lz), (lx, -0.05, lz), (lx, 0.05, lz), (lx, 0.32, lz - 0.02), (lx, 0.5, lz + 0.06), (lx, 0.55, lz + 0.22),
               (lx, 0.47, lz + 0.38), (lx, 0.3, lz + 0.47), (lx, 0.0, lz + 0.48)]
        k.tube([at(*p) for p in pts], 0.04, M, col, n=8, v_len=0.8, caps=True)
    for y in np.arange(-0.3, -1.95, -0.3):
        k.tube([at(-0.25, y, lz), at(0.25, y, lz)], 0.03, M, W.mix(col, W.LIGHT, rng.uniform(0, 0.4)), n=6, v_len=0.8)


def build():
    K.reset()
    deck, wood, rope = W.wood_mat("M_DeckWood", 2611), W.wood_mat("M_PileWood", 2612), K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    k = K.Kit("jetty")
    boards(k, deck, *LANDING, 0.0)
    stairs(k, deck)
    boards(k, deck, *PLATFORM, TOP)
    for g in GANGWAYS:
        boards(k, deck, g - 0.8, g + 0.8, *GANG_Z, TOP)
    for (x, z), top in PILES:
        pile(k, wood, x, z, top)
    for at, yaw in LADDERS:
        ladder(k, wood, *at, yaw)
    # Rope fencing: the landing's far side and tip (its boat side open), the platform's seaward face either side of
    # the stairs, its sides either side of the ladders, both sides of each gangway and the land face between them.
    fence(k, wood, rope, [(-0.4, -3.4), (-1.9, -3.4), (-1.9, -2.0), (-1.9, -0.6)], 0.0)
    fence(k, wood, rope, [(-4.4, 2.9), (-4.4, 1.6), (-2.1, 1.6)], TOP)
    fence(k, wood, rope, [(1.1, 1.6), (4.4, 1.6), (4.4, 2.9)], TOP)
    for sx in (-1, 1):
        fence(k, wood, rope, [(sx * 4.4, 4.1), (sx * 4.4, 5.4), (sx * 3.95, 5.6)], TOP)
    for g in GANGWAYS:
        for sx in (-1, 1):
            fence(k, wood, rope, [(g + sx * 0.75, 5.6), (g + sx * 0.75, 7.3)], TOP)
    for a, b in zip(GANGWAYS, GANGWAYS[1:]):
        fence(k, wood, rope, [(a + 0.75, 5.6), (b - 0.75, 5.6)], TOP)
    # The bow line's cleat (wharf.ts PIER.bowCleat) on the landing's boat side.
    k.rbox((0.8, 0.03, -1.98), (0.07, 0.05, 0.22), 0.015, wood, W.mix(W.DARK, "#4a3624", 0.5), segs=1)
    W.wet(k, below=SEA)
    k.tint_gradient(0.82, 1.0, -0.6, TOP + 0.9)
    ob = k.finish(smooth_deg=45)
    K.export([ob], "game/wharf/jetty.glb")
    W.report(ob)
    return ob


if __name__ == "__main__":
    ob = build()
    if "review" in ARGS:
        K.review([ob], os.path.join(ARGS[ARGS.index("review") + 1], "jetty.png"), views=((35, 28), (210, 22)), size=560)
