"""The café interior (specs/cafe-polish.md item 7), hand-modeled from David's four references
(specs/references/cafe/david/cafe-ref-01..04.png): warm wood panelling and ceiling with recessed downlights, a
wood-framed backlit grid panel over the bar, white and dark grid-tile backsplashes, a long espresso bar with the
machine, grinders, cups and jugs, a white-tiled order counter with a glass-top display, a pastry case, stainless
under-counter fridges, open shelves with cups and paper bags, sconces and a big window wall.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/cafe/build_cafe.py [-- room sets props lightbox ...]

Writes web/public/assets/game/cafe/*.glb. Game coordinates throughout (cafekit.G). The numbers below mirror
web/lib/game/cafe.ts (room, bar, window counter, shelves, board) and web/lib/study/seats.ts (furniture seats):
change both together. Signs' text is drawn in the engine (CafeSigns.tsx) on the lightbox model built here.
"""
import math, os, random, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cafekit as K  # noqa: E402
from cafekit import G, Mat, Model  # noqa: E402

ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
PI = math.pi

# ---------------------------------------------------------------- room (mirrors web/lib/game/cafe.ts)
W, D, H = 8.5, 6.0, 4.0           # half width, half depth, ceiling
BAR_X0, BAR_X1 = -1.5, 8.5        # the bar zone along the far wall
FRONT_Z0, FRONT_Z1 = 3.7, 4.4     # front bar (customer side at z0)
BACK_Z0 = 5.35                    # back counter front face (to the wall at D)
ORDER_X1, CASE_X1 = 1.9, 5.0      # order counter | pastry case | wood pick-up bar
COUNTER_Y = 1.0
WIN_Z0, WIN_Z1 = -5.2, 1.4        # window wall glass on the -x wall
WCOUNTER = (-4.2, 0.5)            # window counter z extent, top at 1.0
DOOR_HALF = 0.95                  # doorway half width in the near wall (x = 0)


def materials():
    tex = {
        "walnut": K.image("walnut", K.wood(512, "#4f2f1b", "#6e4227", seed=11, planks=4, joint="#2a180c", joint_px=3, streak=0.4)),
        "oak": K.image("oak", K.wood(512, "#b98450", "#d4a46c", seed=12, planks=3, joint="#9a6a3c", joint_px=1, streak=0.35)),
        "oak_dark": K.image("oak_dark", K.wood(512, "#5c3820", "#77492b", seed=13, planks=2, joint="#3a2212", joint_px=2, streak=0.4)),
        "ceiling": K.image("ceiling", K.wood(512, "#43261a", "#5f3822", seed=14, planks=2, joint="#1c0e06", joint_px=4, streak=0.35)),
        "tile_white": K.image("tile_white", K.tiles(512, 8, "#f1ece2", "#b5ad9f", grout_px=4, vary=0.035, seed=21)),
        "tile_dark": K.image("tile_dark", K.tiles(512, 6, "#22302b", "#8e8a7c", grout_px=4, vary=0.08, seed=22, bevel=0.18)),
        "tile_sub": K.image("tile_sub", K.tiles(512, 8, "#efe7d6", "#c4b9a4", grout_px=3, vary=0.03, seed=23, rows=4)),
        "floor": K.image("floor", K.terrazzo(1024, "#c7b496", ["#a08a6c", "#e6dac4", "#86735c", "#d2ad7f", "#efe7d8"], "#9c8b70", n=3, seed=31)),
    }
    M = {
        "wall": Mat("M_Walnut", "#6a4026", 0.82, tex["walnut"], tile=2.4),
        "ceil": Mat("M_Ceiling", "#55301b", 0.9, tex["ceiling"], tile=3.2, double=False),
        "grid": Mat("M_GridWood", "#c58f58", 0.7, tex["oak"], tile=1.6, double=False),
        "ceil_trim": Mat("M_CeilingTrim", "#1e1c1b", 0.6, double=False),
        "oak": Mat("M_Oak", "#c58f58", 0.7, tex["oak"], tile=1.6),
        "oakd": Mat("M_OakDark", "#6e4428", 0.75, tex["oak_dark"], tile=1.4),
        "floor": Mat("M_Floor", "#cfc0a6", 0.8, tex["floor"], tile=2.4),
        "tw": Mat("M_TileWhite", "#f1ece2", 0.45, tex["tile_white"], tile=0.72),
        "td": Mat("M_TileDark", "#22302b", 0.4, tex["tile_dark"], tile=0.72),
        "ts": Mat("M_TileSub", "#efe7d6", 0.45, tex["tile_sub"], tile=0.8),
        "stone": Mat("M_Stone", "#2c2a28", 0.55),
        "steel": Mat("M_Steel", "#b9bcbc", 0.35),
        "black": Mat("M_Black", "#1e1c1b", 0.6),
        "brass": Mat("M_Brass", "#b88a4a", 0.4),
        "glass": Mat("M_Glass", "#d8ecef", 0.1, alpha=0.18),
        "ceramic": Mat("M_Ceramic", "#f4f1ea", 0.4),
        "cream": Mat("M_Cream", "#e9dcc4", 0.6),
        "kraft": Mat("M_Kraft", "#b98a5a", 0.9),
        "leaf": Mat("M_Leaf", "#5f7f4a", 0.8),
        "pot": Mat("M_Pot", "#c9b9a2", 0.85),
        "soil": Mat("M_Soil", "#3b2a1e", 1.0),
        "pastry": Mat("M_Pastry", "#c98a45", 0.6),
        "pastry_d": Mat("M_PastryDark", "#8d5426", 0.6),
        "icing": Mat("M_Icing", "#f5ead8", 0.5),
        "coir": Mat("M_Coir", "#9c7b4e", 1.0),
        "leather": Mat("M_Leather", "#7a4a2a", 0.6),
        "cushion": Mat("M_Cushion", "#4f5a3c", 0.85),
        "screen": Mat("M_Screen", "#1d2a30", 0.3, glow=0.35, glow_color="#4e7f86"),
        "glow": Mat("M_Glow", "#fff1d6", 0.5, glow=1.5, glow_color="#ffe2b0", double=False),
        "panel": Mat("M_PanelGlow", "#fff6e6", 0.5, glow=2.2, glow_color="#fff0d8", double=False),
        "sconce": Mat("M_SconceGlow", "#ffe6bf", 0.5, glow=4.0, glow_color="#ffd9a0"),
        "red": Mat("M_Red", "#b8342a", 0.6),
        "label": Mat("M_Label", "#f3ead8", 0.8),
        "bottle": Mat("M_Bottle", "#6b3a1e", 0.3, alpha=0.85),
        "milk": Mat("M_Milk", "#f6f3ec", 0.6),
        "cork": Mat("M_Cork", "#b98d5c", 0.95),
        "paper": Mat("M_Paper", "#f6f0e2", 0.9),
        "chalk": Mat("M_Chalkboard", "#2a3330", 0.9),
    }
    return M


# ================================================================ reusable small props
def cup(m, M, x, y, z, r=0.06, h=0.07, saucer=True):
    if saucer:
        m.lathe((x, y, z), [(0, 0), (r * 1.7, 0.0), (r * 1.8, 0.012), (r * 1.2, 0.016), (0, 0.016)], M["ceramic"], n=14)
        y += 0.016
    m.lathe((x, y, z), [(0, 0), (r * 0.7, 0), (r, h * 0.35), (r * 1.05, h), (r * 0.9, h), (r * 0.8, h * 0.4), (0, h * 0.4)], M["ceramic"], n=12)
    m.tube([(x + r * 0.95, y + h * 0.75, z), (x + r * 1.55, y + h * 0.6, z), (x + r * 0.95, y + h * 0.3, z)], 0.008, M["ceramic"], n=5, caps=False)


def cup_stack(m, M, x, y, z, n=4, r=0.05, mat=None):
    for k in range(n):
        m.lathe((x, y + k * 0.03, z), [(0, 0), (r * 0.72, 0), (r, 0.045), (0, 0.045)], mat or M["ceramic"], n=12)


def takeaway_stack(m, M, x, y, z, n=8):
    m.lathe((x, y, z), [(0, 0), (0.045, 0), (0.06, 0.05 + n * 0.022), (0, 0.05 + n * 0.022)], M["paper"], n=14)
    for k in range(n):
        m.lathe((x, y + 0.04 + k * 0.022, z), [(0.058, 0), (0.064, 0.006), (0.058, 0.012)], M["paper"], n=14)


def jug(m, M, x, y, z, s=1.0):
    m.lathe((x, y, z), [(0, 0), (0.05 * s, 0), (0.055 * s, 0.02 * s), (0.05 * s, 0.1 * s), (0.044 * s, 0.13 * s), (0.048 * s, 0.14 * s), (0, 0.14 * s)], M["steel"], n=12)
    m.tube([(x - 0.05 * s, y + 0.11 * s, z), (x - 0.09 * s, y + 0.09 * s, z), (x - 0.05 * s, y + 0.03 * s, z)], 0.008 * s, M["steel"], n=5, caps=False)


def bag(m, M, x, y, z, yaw=0.0, s=1.0, logo=True):
    """A kraft paper bag with a rolled top (ref 2's shelf of paper bags)."""
    m.box((x, y + 0.13 * s, z), (0.16 * s, 0.26 * s, 0.1 * s), M["kraft"], yaw=yaw, bevel=0.006)
    m.box((x, y + 0.27 * s, z), (0.16 * s, 0.03 * s, 0.07 * s), M["kraft"], yaw=yaw, bevel=0.01)
    if logo:
        dx, dz = -math.sin(yaw) * 0.051 * s, -math.cos(yaw) * 0.051 * s
        m.box((x + dx, y + 0.15 * s, z + dz), (0.07 * s, 0.07 * s, 0.004), M["label"], yaw=yaw)


def jar(m, M, x, y, z, h=0.16, fill=None):
    m.lathe((x, y, z), [(0, 0), (0.05, 0), (0.05, h), (0.035, h + 0.01), (0, h + 0.01)], M["glass"], n=12)
    if fill:
        m.lathe((x, y + 0.005, z), [(0, 0), (0.044, 0), (0.044, h * 0.6), (0, h * 0.6)], fill, n=10)
    m.lathe((x, y + h + 0.01, z), [(0, 0), (0.04, 0), (0.04, 0.025), (0, 0.025)], M["oakd"], n=10)


def bottle(m, M, x, y, z, mat=None):
    m.lathe((x, y, z), [(0, 0), (0.035, 0), (0.035, 0.17), (0.016, 0.22), (0.014, 0.26), (0, 0.26)], mat or M["bottle"], n=10)
    m.lathe((x, y + 0.25, z), [(0, 0), (0.017, 0), (0.017, 0.03), (0, 0.03)], M["black"], n=8)
    m.box((x, y + 0.1, z - 0.036), (0.05, 0.06, 0.002), M["label"])


def plant_small(m, M, x, y, z, s=1.0, trailing=False, seed=1):
    """A small potted plant: a ceramic pot and a handful of leaf blobs (trailing over the shelf edge if asked)."""
    rnd = random.Random(seed)
    m.lathe((x, y, z), [(0, 0), (0.07 * s, 0), (0.09 * s, 0.13 * s), (0.08 * s, 0.13 * s), (0, 0.12 * s)], M["pot"], n=12)
    for k in range(9 if trailing else 7):
        a = rnd.uniform(0, math.tau)
        rr = rnd.uniform(0.02, 0.09) * s
        if trailing and k > 3:
            ly = y + 0.1 * s - (k - 3) * 0.06 * s
            lz = z - 0.11 * s - rnd.uniform(0, 0.03)
            m.blob((x + math.cos(a) * 0.05 * s, ly, lz), (0.04 * s, 0.025 * s, 0.03 * s), M["leaf"], segs=6, rings=4, yaw=a)
        else:
            m.blob((x + math.cos(a) * rr, y + rnd.uniform(0.15, 0.27) * s, z + math.sin(a) * rr), (0.06 * s, 0.03 * s, 0.035 * s), M["leaf"], segs=6, rings=4, yaw=a)


def croissant(m, M, x, y, z, yaw=0.0, s=1.0):
    """A crescent of five tapering lobes."""
    for k in range(5):
        t = (k - 2) / 2
        a = yaw + t * 0.9
        r = (0.055 - abs(t) * 0.018) * s
        m.blob((x + math.sin(a) * 0.07 * s, y + r * 0.7, z + math.cos(a) * 0.07 * s), (r, r * 0.75, r * 1.1), M["pastry"] if k % 2 else M["pastry_d"], segs=8, rings=5, yaw=a)


def bun(m, M, x, y, z, s=1.0, glazed=False):
    m.blob((x, y + 0.035 * s, z), (0.07 * s, 0.05 * s, 0.07 * s), M["pastry"], segs=10, rings=6, squash_bottom=True)
    m.blob((x, y + 0.065 * s, z), (0.05 * s, 0.03 * s, 0.05 * s), M["icing"] if glazed else M["pastry_d"], segs=8, rings=5)


# ================================================================ the room
def room(M):
    shell, bar, deco, glow = Model("cafe_shell"), Model("cafe_bar"), Model("cafe_deco"), Model("cafe_glow")
    # Above the dollhouse cut: the ceiling, its downlights and the grid panel. The engine shows this layer only to a
    # camera below the ceiling (the evidence's eye-level shots); the game camera looks down into the open room.
    ceil = Model("cafe_ceiling")

    # --- floor, ceiling (faces down: invisible from the gameplay camera above), walls
    shell.quad([(-W, 0, -D), (W, 0, -D), (W, 0, D), (-W, 0, D)], M["floor"], (0, 1, 0))
    ceil.quad([(-W, H, -D), (W, H, -D), (W, H, D), (-W, H, D)], M["ceil"], (0, -1, 0))
    T = 0.3
    shell.box((0, H / 2, D + T / 2), (2 * W + 2 * T, H, T), M["wall"])                                  # far wall
    shell.box((W + T / 2, H / 2, 0), (T, H, 2 * D + 2 * T), M["wall"])                                  # +x wall
    # the window wall (-x): full height beside the opening, a low wall under it, a header over it
    wx = -W - T / 2
    shell.box((wx, H / 2, (-D - T + WIN_Z0) / 2), (T, H, WIN_Z0 + D + T), M["wall"])
    shell.box((wx, H / 2, (WIN_Z1 + D + T) / 2), (T, H, D + T - WIN_Z1), M["wall"])
    shell.box((wx, 0.36, (WIN_Z0 + WIN_Z1) / 2), (T, 0.72, WIN_Z1 - WIN_Z0), M["wall"])
    shell.box((wx, (3.62 + H) / 2, (WIN_Z0 + WIN_Z1) / 2), (T, H - 3.62, WIN_Z1 - WIN_Z0), M["wall"])
    for x0, x1 in ((-W - T, -DOOR_HALF), (DOOR_HALF, W + T)):                                         # near wall: a low lip (cutaway)
        shell.box(((x0 + x1) / 2, 0.45, -D - T / 2), (x1 - x0, 0.9, T), M["wall"], bevel=0.02)
        shell.box(((x0 + x1) / 2, 0.92, -D - T / 2), (x1 - x0, 0.05, T + 0.06), M["oakd"], bevel=0.01)
    for x in (-DOOR_HALF - 0.08, DOOR_HALF + 0.08):                                                    # door jambs
        shell.box((x, 0.55, -D - T / 2), (0.16, 1.1, T + 0.1), M["oakd"], bevel=0.02)
    shell.box((0, 0.012, -D - 0.05), (2 * DOOR_HALF, 0.024, T + 0.1), M["steel"])                      # threshold
    shell.box((0, 0.012, -D + 0.75), (1.6, 0.024, 0.9), M["coir"], bevel=0.01)                        # door mat
    # baseboards and a picture rail on the solid walls
    shell.box((0, 0.06, D - 0.02), (2 * W, 0.12, 0.04), M["oakd"])
    shell.box((W - 0.02, 0.06, 0), (0.04, 0.12, 2 * D), M["oakd"])
    shell.box((-W + 0.02, 0.06, (D + WIN_Z1) / 2), (0.04, 0.12, D - WIN_Z1), M["oakd"])

    # --- the window wall: glass from the counter to the transom, black steel mullions, wood sill
    gx = -W - 0.12
    for z0, z1 in ((WIN_Z0, WIN_Z1),):
        deco.quad([(gx, 0.78, z1), (gx, 3.58, z1), (gx, 3.58, z0), (gx, 0.78, z0)], M["glass"], (1, 0, 0))
        deco.box((gx, 0.75, (z0 + z1) / 2), (0.14, 0.06, z1 - z0 + 0.1), M["black"])
        deco.box((gx, 3.6, (z0 + z1) / 2), (0.14, 0.08, z1 - z0 + 0.1), M["black"])
        deco.box((gx, 2.9, (z0 + z1) / 2), (0.12, 0.05, z1 - z0), M["black"])
        n = 6
        for k in range(n + 1):
            z = z0 + (z1 - z0) * k / n
            deco.box((gx, 2.18, z), (0.12, 2.82, 0.06 if 0 < k < n else 0.1), M["black"])
    # window counter (oak top on black steel brackets) with a low wood modesty panel at the wall
    wz0, wz1 = WCOUNTER
    bar.box((-W + 0.28, COUNTER_Y - 0.03, (wz0 + wz1) / 2), (0.56, 0.06, wz1 - wz0), M["oak"], bevel=0.012)
    for z in np.linspace(wz0 + 0.2, wz1 - 0.2, 6):
        bar.box((-W + 0.25, COUNTER_Y - 0.12, z), (0.4, 0.04, 0.04), M["black"])
        bar.box((-W + 0.06, COUNTER_Y - 0.25, z), (0.04, 0.3, 0.04), M["black"])
    bar.box((-W + 0.05, 0.47, (wz0 + wz1) / 2), (0.1, 0.94, wz1 - wz0), M["wall"])

    # --- the bar: back counter along the far wall (cabinets, fridges, stone top)
    bz = (BACK_Z0 + D) / 2
    bdep = D - BACK_Z0
    bar.box(((BAR_X0 + BAR_X1) / 2, 0.06, bz), (BAR_X1 - BAR_X0, 0.12, bdep - 0.06), M["black"])            # kick
    x = BAR_X0
    for w_, kind in ((1.6, "wood"), (1.8, "wood"), (1.8, "fridge"), (1.8, "fridge"), (2.0, "wood"), (2.0, "wood")):
        cx = x + w_ / 2
        if kind == "fridge":
            bar.box((cx, 0.5, BACK_Z0 + 0.02), (w_ - 0.04, 0.78, 0.06), M["steel"], bevel=0.01)
            bar.box((cx, 0.55, BACK_Z0 - 0.02), (w_ * 0.6, 0.03, 0.03), M["steel"], bevel=0.008)          # handle
            for k in range(5):                                                                              # vent
                bar.box((cx - w_ * 0.25, 0.2 + k * 0.03, BACK_Z0 - 0.01), (w_ * 0.3, 0.012, 0.012), M["black"])
        else:
            for k in range(2):
                bar.box((x + w_ * (k + 0.5) / 2, 0.52, BACK_Z0 + 0.02), (w_ / 2 - 0.03, 0.8, 0.06), M["oakd"], bevel=0.01)
                bar.box((x + w_ * (k + 0.5) / 2, 0.84, BACK_Z0 - 0.02), (0.2, 0.02, 0.03), M["brass"])
        x += w_
    bar.box(((BAR_X0 + BAR_X1) / 2, 0.95, bz), (BAR_X1 - BAR_X0, 0.06, bdep), M["stone"], bevel=0.01)
    # backsplash: dark grid tile behind the machine, white grid tile behind the pick-up end
    SPLIT = 3.4
    shell.box(((BAR_X0 + SPLIT) / 2, 1.5, D - 0.02), (SPLIT - BAR_X0, 1.1, 0.04), M["td"], drop=("+z",))
    shell.box(((SPLIT + BAR_X1) / 2, 1.5, D - 0.02), (BAR_X1 - SPLIT, 1.1, 0.04), M["tw"], drop=("+z",))
    shell.box((SPLIT, 1.5, D - 0.03), (0.04, 1.12, 0.05), M["oakd"])
    # open shelves: cups, jars and paper bags (ref 2), plants and cup stacks on the white side
    for y in (1.48, 1.92):
        bar.box(((BAR_X0 + SPLIT) / 2, y, D - 0.15), (SPLIT - BAR_X0 - 0.3, 0.04, 0.28), M["oak"], bevel=0.008)
    bar.box((6.6, 1.7, D - 0.15), (3.0, 0.04, 0.28), M["oak"], bevel=0.008)
    rnd = random.Random(5)
    for k, xx in enumerate(np.linspace(BAR_X0 + 0.35, SPLIT - 0.4, 9)):
        bag(deco, M, xx, 1.94, D - 0.16, yaw=rnd.uniform(-0.15, 0.15), s=0.95)
    for k, xx in enumerate(np.linspace(BAR_X0 + 0.3, SPLIT - 0.35, 12)):
        if k % 4 == 3:
            jar(deco, M, xx, 1.5, D - 0.15, fill=M["pastry_d"] if k % 8 == 3 else M["kraft"])
        else:
            cup_stack(deco, M, xx, 1.5, D - 0.15, n=3)
    for k, xx in enumerate(np.linspace(5.3, 8.0, 7)):
        if k in (1, 5):
            plant_small(deco, M, xx, 1.72, D - 0.14, s=1.1, trailing=True, seed=k)
        else:
            takeaway_stack(deco, M, xx, 1.72, D - 0.15, n=7) if k % 2 == 0 else cup_stack(deco, M, xx, 1.72, D - 0.15, n=4)

    # --- on the back counter: espresso machine (two group heads), grinders, knock box, jugs, bottles
    ex = 0.9
    bar.box((ex, 1.24, D - 0.3), (1.3, 0.52, 0.5), M["steel"], bevel=0.04)
    bar.box((ex, 1.53, D - 0.3), (1.2, 0.06, 0.42), M["black"], bevel=0.01)                                # cup warmer
    for k in range(6):
        cup_stack(deco, M, ex - 0.45 + k * 0.18, 1.56, D - 0.3, n=2, r=0.045)
    bar.box((ex, 1.08, D - 0.56), (1.15, 0.05, 0.08), M["black"])                                          # drip tray grill
    for gx_ in (ex - 0.3, ex + 0.3):
        bar.cyl((gx_, 1.12, D - 0.58), 0.06, 0.08, M["steel"], n=12)                                       # group head
        bar.tube([(gx_, 1.1, D - 0.6), (gx_, 1.1, D - 0.8)], 0.014, M["black"], n=6)                      # portafilter handle
        bar.cyl((gx_, 1.0, D - 0.6), 0.045, 0.06, M["ceramic"], n=10)
    for sx in (-1, 1):                                                                                      # steam wands
        bar.tube([(ex + sx * 0.6, 1.3, D - 0.5), (ex + sx * 0.66, 1.16, D - 0.62), (ex + sx * 0.66, 1.02, D - 0.62)], 0.01, M["steel"], n=6)
    for k, dx in enumerate((-0.4, -0.2, 0.2, 0.4)):
        bar.cyl((ex + dx, 1.36, D - 0.555), 0.022, 0.012, M["red"] if k % 2 else M["black"], n=8, d=(0, 0, -1))  # buttons
    for gx_ in (2.25, 2.7):                                                                                 # grinders
        bar.box((gx_, 1.12, D - 0.3), (0.26, 0.3, 0.32), M["black"], bevel=0.03)
        bar.box((gx_, 1.38, D - 0.3), (0.22, 0.22, 0.26), M["black"], bevel=0.03)
        bar.lathe((gx_, 1.49, D - 0.3), [(0.05, 0), (0.13, 0.22), (0.12, 0.23), (0, 0.23)], M["glass"], n=14)
        bar.lathe((gx_, 1.5, D - 0.3), [(0, 0), (0.06, 0), (0.1, 0.1), (0, 0.1)], M["pastry_d"], n=10)
    bar.box((-0.6, 1.03, D - 0.3), (0.24, 0.12, 0.18), M["black"], bevel=0.02)                            # knock box
    for k, xx in enumerate((-1.15, -0.95, 3.0)):
        jug(deco, M, xx, 0.98, D - 0.35, s=1.2)
    for k, xx in enumerate(np.linspace(3.7, 4.4, 5)):
        bottle(deco, M, xx, 0.98, D - 0.18, M["bottle"] if k % 2 else M["milk"])
    takeaway_stack(deco, M, 4.8, 0.98, D - 0.3, n=10)
    takeaway_stack(deco, M, 5.0, 0.98, D - 0.3, n=6)
    deco.box((5.7, 1.08, D - 0.3), (0.5, 0.2, 0.35), M["steel"], bevel=0.02)                               # hot water tower
    deco.cyl((5.7, 1.18, D - 0.3), 0.04, 0.22, M["steel"], n=10)
    deco.lathe((6.7, 0.98, D - 0.3), [(0, 0), (0.12, 0), (0.12, 0.34), (0.09, 0.4), (0, 0.4)], M["black"], n=14)    # batch brewer urn
    deco.box((6.7, 1.0, D - 0.48), (0.08, 0.06, 0.06), M["steel"])
    for k in range(4):
        cup(deco, M, 7.3 + k * 0.28, 0.98, D - 0.35, saucer=True)

    # --- front bar: the white-tiled order counter, the pastry case, the wood pick-up bar
    fz = (FRONT_Z0 + FRONT_Z1) / 2
    fdep = FRONT_Z1 - FRONT_Z0
    ox = (BAR_X0 + ORDER_X1) / 2
    bar.box((ox, 0.48, fz), (ORDER_X1 - BAR_X0, 0.96, fdep), M["tw"], bevel=0.01)
    bar.box((ox, 0.98, fz), (ORDER_X1 - BAR_X0 + 0.04, 0.04, fdep + 0.04), M["steel"], bevel=0.008)
    # L return closing the staff aisle at x0
    bar.box((BAR_X0 + 0.25, 0.48, (FRONT_Z1 + BACK_Z0) / 2), (0.5, 0.96, BACK_Z0 - FRONT_Z1), M["tw"], bevel=0.01)
    bar.box((BAR_X0 + 0.25, 0.98, (FRONT_Z1 + BACK_Z0) / 2), (0.54, 0.04, BACK_Z0 - FRONT_Z1), M["steel"])
    # glass-top display on the order counter (ref 1): a steel-framed glass box with jars and a cake stand inside
    vx0, vx1, vz0, vz1, vy = -0.5, 1.6, FRONT_Z0 + 0.06, FRONT_Z0 + 0.42, 0.34
    deco.box(((vx0 + vx1) / 2, 1.0 + vy, (vz0 + vz1) / 2), (vx1 - vx0, 0.012, vz1 - vz0), M["glass"])
    deco.quad([(vx0, 1.0, vz0), (vx1, 1.0, vz0), (vx1, 1.0 + vy, vz0), (vx0, 1.0 + vy, vz0)], M["glass"], (0, 0, -1))
    for xx in (vx0, vx1):
        for zz in (vz0, vz1):
            deco.box((xx, 1.0 + vy / 2, zz), (0.025, vy, 0.025), M["steel"])
    deco.box(((vx0 + vx1) / 2, 1.0 + vy, vz0), (vx1 - vx0, 0.025, 0.025), M["steel"])
    deco.box(((vx0 + vx1) / 2, 1.0 + vy, vz1), (vx1 - vx0, 0.025, 0.025), M["steel"])
    for k, xx in enumerate(np.linspace(vx0 + 0.25, vx1 - 0.25, 4)):
        if k == 1:
            deco.lathe((xx, 1.0, (vz0 + vz1) / 2), [(0, 0), (0.07, 0), (0.02, 0.12), (0.16, 0.13), (0.16, 0.14), (0, 0.14)], M["ceramic"], n=14)
            for j in range(4):
                bun(deco, M, xx + math.cos(j * 1.6) * 0.08, 1.14, (vz0 + vz1) / 2 + math.sin(j * 1.6) * 0.06, s=0.75, glazed=True)
        else:
            jar(deco, M, xx, 1.0, (vz0 + vz1) / 2, h=0.2, fill=M["pastry"] if k % 2 else M["kraft"])
    # register: a tablet POS on a stand (ref 1) at the aisle end
    px_, pz_ = -1.0, FRONT_Z0 + 0.4
    deco.cyl((px_, 1.0, pz_), 0.09, 0.02, M["ceramic"], n=14)
    deco.cyl((px_, 1.02, pz_), 0.025, 0.22, M["ceramic"], n=8)
    deco.box((px_, 1.32, pz_ - 0.03), (0.42, 0.28, 0.03), M["ceramic"], bevel=0.01)
    glow.quad([(px_ - 0.18, 1.2, pz_ - 0.047), (px_ + 0.18, 1.2, pz_ - 0.047), (px_ + 0.18, 1.44, pz_ - 0.047), (px_ - 0.18, 1.44, pz_ - 0.047)], M["screen"], (0, 0, -1))
    deco.box((px_ + 0.38, 1.05, pz_), (0.18, 0.1, 0.12), M["ceramic"], bevel=0.015)                         # card reader
    # pastry case (ref 3): dark wood panelled base, stone top, a glass case with two tiers of pastries
    cx0, cx1 = ORDER_X1, CASE_X1
    ccx = (cx0 + cx1) / 2
    for k in range(4):
        w_ = (cx1 - cx0) / 4
        bar.box((cx0 + w_ * (k + 0.5), 0.46, FRONT_Z0 + 0.03), (w_ - 0.025, 0.86, 0.06), M["oakd"], bevel=0.008)
    bar.box((ccx, 0.45, fz + 0.03), (cx1 - cx0, 0.9, fdep - 0.06), M["black"])
    bar.box((ccx, 0.92, fz), (cx1 - cx0 + 0.04, 0.05, fdep + 0.04), M["stone"], bevel=0.01)
    cy0, cy1 = 0.945, 1.42
    deco.quad([(cx0, cy0, FRONT_Z0 + 0.03), (cx1, cy0, FRONT_Z0 + 0.03), (cx1, cy1, FRONT_Z0 + 0.12), (cx0, cy1, FRONT_Z0 + 0.12)], M["glass"], (0, 0, -1))
    deco.quad([(cx0, cy1, FRONT_Z0 + 0.12), (cx1, cy1, FRONT_Z0 + 0.12), (cx1, cy1, FRONT_Z1 - 0.04), (cx0, cy1, FRONT_Z1 - 0.04)], M["glass"], (0, 1, 0))
    for xx in (cx0 + 0.02, cx1 - 0.02):
        deco.box((xx, (cy0 + cy1) / 2, fz + 0.04), (0.03, cy1 - cy0, fdep - 0.1), M["steel"])
    deco.box((ccx, cy1, FRONT_Z0 + 0.12), (cx1 - cx0, 0.02, 0.025), M["steel"])
    deco.box((ccx, 1.18, fz + 0.06), (cx1 - cx0 - 0.08, 0.015, fdep - 0.24), M["glass"])                    # glass shelf
    glow.box((ccx, cy1 - 0.02, fz + 0.06), (cx1 - cx0 - 0.1, 0.012, 0.06), M["glow"])                      # case light strip
    rnd = random.Random(9)
    for k, xx in enumerate(np.linspace(cx0 + 0.25, cx1 - 0.25, 7)):                                         # lower tier: trays
        deco.box((xx, 0.955, fz + 0.04), (0.42, 0.012, 0.3), M["steel"], bevel=0.004)
        for j in range(3):
            zz = fz - 0.04 + j * 0.1
            if k % 3 == 0:
                croissant(deco, M, xx - 0.08 + j * 0.06, 0.96, zz, yaw=rnd.uniform(-0.4, 0.4), s=0.85)
            else:
                bun(deco, M, xx - 0.1 + j * 0.1, 0.96, zz, s=0.8, glazed=k % 3 == 2)
        deco.box((xx, 0.99, FRONT_Z0 + 0.07), (0.12, 0.06, 0.008), M["label"])                              # price-less name cards
    for k, xx in enumerate(np.linspace(cx0 + 0.3, cx1 - 0.3, 6)):                                           # upper tier
        if k % 2:
            croissant(deco, M, xx, 1.19, fz + 0.08, yaw=0.3, s=0.8)
        else:
            bun(deco, M, xx, 1.19, fz + 0.08, s=0.7, glazed=True)
    # wood pick-up bar (ref 1): oak top over an open-shelved front with plates
    wx0, wx1 = CASE_X1, BAR_X1
    wcx = (wx0 + wx1) / 2
    bar.box((wcx, 0.97, fz), (wx1 - wx0, 0.07, fdep + 0.06), M["oak"], bevel=0.015)
    bar.box((wcx, 0.48, fz + 0.12), (wx1 - wx0, 0.9, fdep - 0.22), M["oakd"])
    for y in (0.08, 0.5):
        bar.box((wcx, y, FRONT_Z0 + 0.13), (wx1 - wx0, 0.05, 0.26), M["oak"], bevel=0.008)
    for xx in np.linspace(wx0 + 0.03, wx1 - 0.03, 5):
        bar.box((xx, 0.48, FRONT_Z0 + 0.13), (0.06, 0.9, 0.26), M["oak"], bevel=0.008)
    for k, xx in enumerate(np.linspace(wx0 + 0.45, wx1 - 0.5, 4)):                                         # plates and bowls in the cubbies
        for j in range(4):
            deco.lathe((xx, 0.535 + j * 0.022, FRONT_Z0 + 0.13), [(0, 0), (0.1, 0), (0.12, 0.018), (0, 0.018)], M["ceramic"], n=14)
        jug(deco, M, xx + 0.2, 0.105, FRONT_Z0 + 0.13, s=1.3) if k % 2 else cup_stack(deco, M, xx + 0.15, 0.105, FRONT_Z0 + 0.13, n=3)
    # on the pick-up bar: the big grinder (ref 1), stacked plates, cups waiting, a jug of herbs
    gx_ = 8.05
    bar.box((gx_, 1.12, fz), (0.3, 0.26, 0.34), M["black"], bevel=0.03)
    bar.box((gx_, 1.42, fz), (0.22, 0.36, 0.26), M["black"], bevel=0.03)
    bar.lathe((gx_, 1.6, fz), [(0.06, 0), (0.15, 0.26), (0.14, 0.27), (0, 0.27)], M["glass"], n=14)
    bar.lathe((gx_, 1.61, fz), [(0, 0), (0.07, 0), (0.12, 0.13), (0, 0.13)], M["pastry_d"], n=10)
    for j in range(6):
        deco.lathe((7.2, 1.005 + j * 0.02, fz), [(0, 0), (0.11, 0), (0.13, 0.016), (0, 0.016)], M["ceramic"] if j % 3 else M["red"], n=14)
    for k in range(3):
        cup(deco, M, 5.9 + k * 0.32, 1.005, fz - 0.05)
    jug(deco, M, 5.4, 1.005, fz, s=1.6)
    plant_small(deco, M, 5.4, 1.18, fz, s=0.8, seed=7)

    # --- backlit grid ceiling panel over the bar (ref 2): curved wood surround, wood grid, glowing panes facing down
    gx0, gx1, gz0, gz1, gy = -0.9, 8.1, FRONT_Z0 + 0.1, D - 0.25, 3.62
    band = 0.28
    for z, sgn in ((gz0, -1), (gz1, 1)):
        ceil.box(((gx0 + gx1) / 2, gy + band / 2, z), (gx1 - gx0, band, 0.08), M["grid"], drop=("top",))
    for x in (gx0, gx1):
        ceil.box((x, gy + band / 2, (gz0 + gz1) / 2), (0.08, band, gz1 - gz0), M["grid"], drop=("top",))
    nx_, nz_ = 13, 3
    for k in range(1, nx_):
        ceil.box((gx0 + (gx1 - gx0) * k / nx_, gy + 0.03, (gz0 + gz1) / 2), (0.035, 0.06, gz1 - gz0), M["grid"], drop=("top",))
    for k in range(1, nz_):
        ceil.box(((gx0 + gx1) / 2, gy + 0.03, gz0 + (gz1 - gz0) * k / nz_), (gx1 - gx0, 0.06, 0.035), M["grid"], drop=("top",))
    ceil.quad([(gx0, gy + 0.065, gz0), (gx1, gy + 0.065, gz0), (gx1, gy + 0.065, gz1), (gx0, gy + 0.065, gz1)], M["panel"], (0, -1, 0))
    for x in (gx0 + 0.3, gx1 - 0.3):
        for z in (gz0 + 0.3, gz1 - 0.3):
            ceil.cyl((x, gy + band, z), 0.008, H - gy - band, M["black"], n=5)

    # --- recessed downlights in the wood ceiling (ref 3), seen from below only
    for x in (-6.5, -3.5, -0.5, 2.5, 5.5):
        for z in (-4.0, -1.2, 1.6):
            ceil.disc((x, H - 0.005, z), 0.1, M["glow"], d=(0, -1, 0))
            ceil.disc((x, H - 0.003, z), 0.15, M["ceil_trim"], d=(0, -1, 0))
    for x in (-7.1, -3.3):
        ceil.disc((x, H - 0.005, 5.0), 0.1, M["glow"], d=(0, -1, 0))
        ceil.disc((x, H - 0.003, 5.0), 0.15, M["ceil_trim"], d=(0, -1, 0))

    # --- wall sconces (ref 1: a glowing disc on a brass back plate)
    for (x, y, z, yaw) in ((W - 0.02, 2.5, -4.4, -PI / 2), (W - 0.02, 2.6, 2.9, -PI / 2),
                           (-W + 0.02, 2.4, 2.6, PI / 2), (-W + 0.02, 2.4, 5.0, PI / 2), (-2.4, 2.6, D - 0.02, PI), (-5.2, 2.6, D - 0.02, PI)):
        fx, fz_ = math.sin(yaw), math.cos(yaw)
        deco.lathe((x, y, z), [(0, 0), (0.17, 0), (0.17, 0.025), (0, 0.025)], M["brass"], n=18, d=(fx, 0, fz_))
        glow.lathe((x + fx * 0.025, y, z + fz_ * 0.025), [(0, 0), (0.13, 0), (0.12, 0.05), (0.06, 0.075), (0, 0.08)], M["sconce"], n=18, d=(fx, 0, fz_))

    # --- retail shelf on the +x wall: coffee bags, cups, a plant (fills the wall the reference's shelves do)
    rz0, rz1 = -0.4, 2.2
    for y in (0.08, 0.7, 1.3, 1.9):
        bar.box((W - 0.22, y, (rz0 + rz1) / 2), (0.42, 0.05, rz1 - rz0), M["oak"], bevel=0.008)
    for z in (rz0, (rz0 + rz1) / 2, rz1):
        bar.box((W - 0.22, 1.0, z), (0.42, 2.0, 0.05), M["oakd"], bevel=0.008)
    rnd = random.Random(3)
    for y in (0.1, 0.72, 1.32):
        for k, zz in enumerate(np.linspace(rz0 + 0.2, rz1 - 0.2, 8)):
            if y == 0.72 and k in (2, 5):
                plant_small(deco, M, W - 0.24, y + 0.02, zz, s=1.0, trailing=True, seed=int(zz * 10))
            elif y == 1.32 and k % 3 == 1:
                cup_stack(deco, M, W - 0.22, y + 0.02, zz, n=3, r=0.06)
            elif y == 0.1 and k % 2:
                jar(deco, M, W - 0.22, y + 0.02, zz, h=0.22, fill=M["pastry_d"])
            else:
                bag(deco, M, W - 0.24, y + 0.02, zz, yaw=-PI / 2 + rnd.uniform(-0.12, 0.12), s=1.05)
    # the study board on the +x wall by the door (opens the top-studiers sheet): an oak-framed chalkboard with notes
    by_, bz_ = 1.85, -2.8
    bar.box((W - 0.05, by_, bz_), (0.06, 1.2, 1.7), M["oak"], bevel=0.02)
    deco.box((W - 0.085, by_, bz_), (0.012, 1.06, 1.56), M["chalk"])
    rnd = random.Random(4)
    for k in range(7):
        zz, yy = bz_ - 0.55 + (k % 4) * 0.37, by_ + 0.25 - (k // 4) * 0.42
        deco.box((W - 0.095, yy, zz), (0.006, 0.2, 0.24), M["paper"], yaw=rnd.uniform(-0.12, 0.12))
        deco.cyl((W - 0.1, yy + 0.08, zz), 0.015, 0.01, M["red"], n=6, d=(-1, 0, 0))
    deco.box((W - 0.12, by_ - 0.58, bz_), (0.08, 0.04, 1.5), M["oak"], bevel=0.006)                       # chalk ledge

    # --- a café floor plant (tall leafy fig) by the booth and a coat rack by the door
    def fig(x, z, s=1.0, seed=1):
        rnd = random.Random(seed)
        deco.lathe((x, 0, z), [(0, 0), (0.22 * s, 0), (0.26 * s, 0.42 * s), (0.24 * s, 0.44 * s), (0, 0.4 * s)], M["pot"], n=16)
        deco.cyl((x, 0.36 * s, z), 0.23 * s, 0.05, M["soil"], n=14)
        deco.tube([(x, 0.4 * s, z), (x + 0.04, 1.2 * s, z - 0.03), (x - 0.02, 1.9 * s, z + 0.02)], 0.025 * s, M["oakd"], n=6)
        for k in range(26):
            t = rnd.uniform(0.25, 1.0)
            a = rnd.uniform(0, math.tau)
            r = (0.12 + 0.32 * math.sin(t * PI)) * s
            y = (0.6 + 1.45 * t) * s
            deco.blob((x + math.cos(a) * r, y, z + math.sin(a) * r), (0.13 * s, 0.035 * s, 0.09 * s), M["leaf"], segs=8, rings=4, yaw=a + 0.5)
    fig(-8.0, 2.3, 1.0, seed=1)
    fig(8.0, -5.4, 0.9, seed=2)
    fig(-8.0, -5.4, 0.85, seed=3)
    # coat rack by the door
    deco.lathe((-1.5, 0, -5.6), [(0, 0), (0.2, 0), (0.2, 0.03), (0, 0.04)], M["black"], n=14)
    deco.cyl((-1.5, 0.03, -5.6), 0.025, 1.75, M["oakd"], n=8)
    for a in range(4):
        aa = a * PI / 2 + 0.4
        deco.tube([(-1.5, 1.72, -5.6), (-1.5 + math.cos(aa) * 0.16, 1.6, -5.6 + math.sin(aa) * 0.16)], 0.015, M["oakd"], n=5)
    # The bar and the window counter were laid out at a 1.0 counter; the characters (1.36 tall, ACNH proportions) want
    # 0.8. Below 1.0 everything squashes by 0.8 (cabinets, counter fronts); above it, what stands on the counters and
    # hangs on the back wall drops by 0.2 unchanged. Walls are single quads (corners at 0 and 4): untouched.
    for mdl in (shell, bar, deco, glow):
        for v in mdl.bm.verts:
            x, y, z = v.co.x, v.co.z, -v.co.y
            barzone = BAR_X0 - 0.15 <= x <= BAR_X1 + 0.01 and FRONT_Z0 - 0.3 <= z <= D + 0.001 and y < 3.3
            window = x <= -W + 0.62 and WCOUNTER[0] - 0.1 <= z <= WCOUNTER[1] + 0.1 and y < 1.2
            if barzone or window:
                v.co.z = y * 0.8 if y < 1.0 else y - 0.2
    obs = [shell.finish(), bar.finish(), deco.finish(), glow.finish(), ceil.finish()]
    return obs


# ================================================================ seat sets (mirror web/lib/study/seats.ts FURNITURE)
def stool(m, M, x, z, seat=0.6):
    m.lathe((x, seat - 0.05, z), [(0, 0), (0.19, 0), (0.2, 0.02), (0.2, 0.04), (0.17, 0.055), (0, 0.055)], M["oak"], n=18)
    for k in range(4):
        a = k * PI / 2 + PI / 4
        m.tube([(x + math.cos(a) * 0.12, seat - 0.05, z + math.sin(a) * 0.12), (x + math.cos(a) * 0.19, 0, z + math.sin(a) * 0.19)], 0.016, M["black"], n=6)
    m.ring((x, 0.22, z), 0.15, 0.012, M["black"], n=16, m=5)


def chair(m, M, x, z, facing, seat=0.4):
    """Café chair, its sitter looking along `facing` (seats.ts convention: atan2(dx, dz))."""
    fx, fz = math.sin(facing), math.cos(facing)
    rx, rz = fz, -fx                                     # the chair's right
    m.box((x, seat - 0.03, z), (0.36, 0.045, 0.36), M["oak"], yaw=facing, bevel=0.013)
    for sx in (-1, 1):
        for sz in (-1, 1):
            px, pz = x + rx * sx * 0.145 + fx * sz * 0.145, z + rz * sx * 0.145 + fz * sz * 0.145
            m.tube([(px, seat - 0.05, pz), (px + rx * sx * 0.02 + fx * sz * 0.02, 0, pz + rz * sx * 0.02 + fz * sz * 0.02)], 0.016, M["oakd"], n=6)
    # back: two posts and a curved oak rail
    bx, bz = x - fx * 0.165, z - fz * 0.165
    for sx in (-1, 1):
        m.tube([(bx + rx * sx * 0.145, seat - 0.04, bz + rz * sx * 0.145), (bx + rx * sx * 0.155 - fx * 0.03, seat + 0.36, bz + rz * sx * 0.155 - fz * 0.03)], 0.015, M["oakd"], n=6)
    m.box((bx - fx * 0.03, seat + 0.32, bz - fz * 0.03), (0.36, 0.09, 0.03), M["oak"], yaw=facing, bevel=0.011)


def table_round(m, M, x, z, r=0.36, top=0.6):
    m.lathe((x, top - 0.035, z), [(0, 0), (r, 0), (r, 0.035), (0, 0.035)], M["oak"], n=24)
    m.cyl((x, 0.0, z), 0.045, top - 0.035, M["black"], n=10)
    m.lathe((x, 0, z), [(0, 0), (0.21, 0), (0.19, 0.03), (0.05, 0.05), (0, 0.05)], M["black"], n=16)


def table_rect(m, M, x, z, w, d, top=0.6, yaw=0.0):
    m.box((x, top - 0.02, z), (w, 0.04, d), M["oak"], yaw=yaw, bevel=0.012)
    m.box((x, top - 0.08, z), (w - 0.14, 0.08, d - 0.14), M["oakd"], yaw=yaw)
    c, s = math.cos(yaw), math.sin(yaw)
    for sx in (-1, 1):
        for sz in (-1, 1):
            lx, lz = sx * (w / 2 - 0.08), sz * (d / 2 - 0.08)
            m.box((x + lx * c + lz * s, (top - 0.08) / 2, z - lx * s + lz * c), (0.06, top - 0.08, 0.06), M["oakd"], yaw=yaw, bevel=0.01)


def set_bar(M):
    m = Model("set_bar")
    for x in (0.45, -0.45):
        stool(m, M, x, -0.55)
    return [m.finish()]


def set_two(M):
    m = Model("set_two")
    table_round(m, M, 0, 0)
    chair(m, M, 0.66, 0, -PI / 2)
    chair(m, M, -0.66, 0, PI / 2)
    return [m.finish()]


def set_four(M):
    m = Model("set_four")
    table_rect(m, M, 0, 0, 1.04, 0.68)
    for x in (0.42, -0.42):
        chair(m, M, x, -0.7, 0)
        chair(m, M, x, 0.7, PI)
    return [m.finish()]


def bench_block(m, M, x0, x1, zc, facing, seat=0.4, back=1.0, depth=0.42, cushion=None):
    """An upholstered bench along local x, its sitters looking along `facing` (0 = +z, PI = -z)."""
    s = 1 if facing == 0 else -1               # sitters look +z: the back is at -z
    cx = (x0 + x1) / 2
    m.box((cx, (seat - 0.1) / 2, zc), (x1 - x0, seat - 0.1, depth), M["oakd"], bevel=0.01)
    m.box((cx, seat - 0.05, zc + s * 0.01), (x1 - x0 - 0.04, 0.1, depth - 0.02), cushion or M["leather"], bevel=0.035)
    bz = zc - s * (depth / 2 + 0.06)
    m.box((cx, back / 2, bz), (x1 - x0, back, 0.12), M["oakd"], bevel=0.015)
    m.box((cx, (seat + back) / 2 + 0.04, bz + s * 0.09), (x1 - x0 - 0.06, back - seat - 0.18, 0.08), cushion or M["leather"], bevel=0.03)


def set_booth(M):
    m = Model("set_booth")
    table_rect(m, M, 0, 0, 1.1, 0.6)
    bench_block(m, M, -0.68, 0.68, -0.72, 0, cushion=M["leather"])
    bench_block(m, M, -0.68, 0.68, 0.72, PI, cushion=M["leather"])
    return [m.finish()]


def set_communal(M):
    m = Model("set_communal")
    table_rect(m, M, 0, 0, 2.2, 0.66)
    bench_block(m, M, -1.15, 1.15, 0.68, PI, back=0.9, cushion=M["cushion"])
    for x in (0.55, -0.55):                     # backless low stools on the room side
        m.lathe((x, 0.35, -0.68), [(0, 0), (0.16, 0), (0.17, 0.03), (0.16, 0.05), (0, 0.05)], M["oak"], n=18)
        for k in range(3):
            a = k * TAU3 + 0.3
            m.tube([(x + math.cos(a) * 0.09, 0.35, -0.68 + math.sin(a) * 0.09), (x + math.cos(a) * 0.15, 0, -0.68 + math.sin(a) * 0.15)], 0.015, M["oakd"], n=6)
    plant_small(m, M, 0, 0.6, 0, s=0.85, seed=11)
    return [m.finish()]


TAU3 = math.tau / 3


# ================================================================ lightbox (signs and menu boards; CafeSigns.tsx draws the face)
def lightbox(M):
    """A 1 x 1 x 0.12 lightbox body, face open at -z (the engine sets the glowing face and scales the box per sign),
    plus a 1-unit black hanging rod along +y from the top (scaled to the ceiling per sign)."""
    body, rod = Model("lightbox_body"), Model("lightbox_rod")
    body.box((0, 0, 0.0), (1.0, 1.0, 0.12), M["cream"], bevel=0.02, drop=("-z",))
    rod.cyl((0, 0, 0), 0.012, 1.0, M["black"], n=6, caps=(False, True))
    return [body.finish(), rod.finish()]


# ================================================================ patron props (a cup and saucer, a laptop, an open notebook)
def props(M):
    c, lap, book = Model("prop_cup"), Model("prop_laptop"), Model("prop_book")
    cup(c, M, 0, 0, 0, r=0.055, h=0.07)
    lap.box((0, 0.01, 0), (0.42, 0.02, 0.3), M["steel"], bevel=0.008)
    lap.box((0, 0.165, 0.15), (0.42, 0.3, 0.015), M["steel"], bevel=0.006, yaw=0)
    lap.quad([(0.19, 0.03, 0.135), (-0.19, 0.03, 0.135), (-0.19, 0.29, 0.14), (0.19, 0.29, 0.14)], M["screen"], (0, 0, -1))
    book.box((0.11, 0.01, 0), (0.22, 0.02, 0.3), M["paper"], bevel=0.004)
    book.box((-0.11, 0.01, 0), (0.22, 0.02, 0.3), M["paper"], bevel=0.004)
    book.box((0, 0.003, 0), (0.46, 0.006, 0.32), M["red"])
    return [c.finish(), lap.finish(), book.finish()]


def main():
    K.reset()
    M = materials()
    jobs = {
        "room": lambda: K.export(room(M), "cafe-room"),
        "sets": lambda: [K.export(f(M), n) for n, f in (("set-bar", set_bar), ("set-two", set_two), ("set-four", set_four), ("set-booth", set_booth), ("set-communal", set_communal))],
        "lightbox": lambda: K.export(lightbox(M), "lightbox"),
        "props": lambda: K.export(props(M), "patron-props"),
    }
    for name, job in jobs.items():
        if ONLY and name not in ONLY:
            continue
        job()
        K.clear()


main()
