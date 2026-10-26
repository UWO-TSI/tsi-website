"""The new world's fish market (game/wharf-art; David, 2026-10-26: "did you see the fishmarket reference i sent you
previously, i need you to start modeling that"), after specs/references/terrain/plan-2026-10-23/wharf-fishing-hut-1.jpg
(the timber shop with a big marlin on its roof and a fish sign) and specs/references/terrain/r2-2026-10-26/
dock-fish-hut.jpg (red board walls, crates of fish on display under an awning, a life ring). Our style: simple shapes,
plain colours, low detail. An exterior: nobody enters it in v1.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/build_fish_market.py [-- review <dir>]

Writes web/public/assets/game/buildings/fish-market.glb in game units at scale 1, the origin on the ground (the deck's
top) at the middle of the house's floor, its front to +z: a house 5 wide and 3.6 deep of red-painted upright boards on
corner posts, a door and a shuttered window, a gabled roof of orange shingles running along x with a stone chimney, a
big blue marlin mounted nose up on the ridge, a fish sign over the front, a plank awning on two posts out to z 2.75 over
a table of fish crates on ice, a life ring by the door, a barrel at the corner. Stands on a 2 by 2 patch of deck tiles.

Wood is the wharf's (art/wharf/build_wharf_kit.py wood_mat), crates and fish the dock decor's
(art/wharf/build_dock_decor.py); the rest are the shared plain presets (P_Paint, P_Glass, P_Stone).
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report, wood_mat  # noqa: E402
from build_dock_decor import fish, lashing, ring_into  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
rng = np.random.default_rng(2631)
W, D, H = 5.0, 3.6, 2.6                    # the house: across (x), deep (z), to the eaves
RIDGE = H + 1.5
RED, TRIM, TRIM_LIGHT = "#b8543e", "#7a5434", "#b08458"
SHINGLE = ("#cf7440", "#dc8650", "#c2663a")
MARLIN, BELLY = "#3f6fb8", "#eef0ec"


def walls(k, M):
    """Upright boards round the house (the front's broken by the door and the window), corner posts, a sill and a
    plate beam round the top; the gable ends filled with boards up to the roof's line."""
    hx, hz = W / 2, D / 2
    door, win = (-1.85, -0.95), (0.7, 1.7)
    for side, (x0, x1, z, along_x) in {"front": (-hx, hx, hz, True), "back": (-hx, hx, -hz, True),
                                       "left": (-hz, hz, -hx, False), "right": (-hz, hz, hx, False)}.items():
        n = int(round((x1 - x0) / 0.36))
        for i in range(n):
            a = x0 + (i + 0.5) * (x1 - x0) / n
            top = H
            if not along_x:                                  # a gable end: boards up under the roof's slope
                top = RIDGE - (RIDGE - H) * abs(a) / hz
            spans = [(0.0, top)]
            if side == "front" and door[0] < a < door[1]:
                spans = [(2.1, top)]                         # the door's way: boards only over it
            elif side == "front" and win[0] < a < win[1]:
                spans = [(0.0, 1.03), (1.87, top)]           # the window's: under and over it
            col = mix(RED, "#8f3d2c", rng.uniform(0.0, 0.35))
            for lo, hi in spans:
                hgt = hi - lo
                c = (a, lo + hgt / 2, z) if along_x else (z, lo + hgt / 2, a)
                size = ((x1 - x0) / n - 0.02, hgt, 0.08) if along_x else (0.08, hgt, (x1 - x0) / n - 0.02)
                k.rbox(c, size, 0.0, M, col, segs=1, uv_len=1.5, v_axis=1, uv_off=(rng.random(), rng.random()))
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.rbox((sx * hx, H / 2, sz * hz), (0.2, H + 0.05, 0.2), 0.02, M, TRIM, segs=1, uv_len=1.5, v_axis=1)
    for y, hgt in ((0.1, 0.2), (H - 0.08, 0.16)):
        for z in (-hz, hz):
            k.rbox((0, y, z + (0.06 if z > 0 else -0.06)), (W + 0.1, hgt, 0.08), 0.015, M, TRIM, segs=1, uv_len=2.0, v_axis=0)
        for x in (-hx, hx):
            k.rbox((x + (0.06 if x > 0 else -0.06), y, 0), (0.08, hgt, D + 0.1), 0.015, M, TRIM, segs=1, uv_len=2.0, v_axis=2)
    return door, win


def front(k, M, Mp, Mg, door, win):
    hz = D / 2 + 0.05
    # The door: boards in a frame, a little round window, a handle.
    dx = (door[0] + door[1]) / 2
    for i in range(3):
        k.rbox((door[0] + 0.15 + i * 0.3, 1.0, hz - 0.02), (0.28, 2.0, 0.06), 0.01, M, mix("#4f7f8a", "#3d6570", i * 0.3), segs=1, uv_len=1.2, v_axis=1)
    for x in door:
        k.rbox((x, 1.05, hz + 0.02), (0.1, 2.1, 0.08), 0.01, M, TRIM_LIGHT, segs=1)
    k.rbox((dx, 2.07, hz + 0.02), (1.0, 0.1, 0.08), 0.01, M, TRIM_LIGHT, segs=1)
    k.lathe((dx, 1.45, hz + 0.02), [(0.0, 0.0), (0.13, 0.0), (0.13, 0.04), (0.0, 0.04)], Mg, "#9fc6d0", d=(0, 0, 1), n=10)
    k.blob((door[1] - 0.12, 1.0, hz + 0.05), (0.035, 0.035, 0.035), Mp, "#c9a24a", segs=6, rings=4)
    # The window: a pane in a frame, two open shutters, a sill box.
    wx, wy, ww, wh = (win[0] + win[1]) / 2, 1.45, win[1] - win[0], 0.8
    k.rbox((wx, wy, hz - 0.01), (ww, wh, 0.03), 0.0, Mg, "#8fb8c6", segs=1)
    for x in win:
        k.rbox((x, wy, hz + 0.02), (0.08, wh + 0.1, 0.06), 0.01, M, TRIM_LIGHT, segs=1)
    for y in (wy - wh / 2, wy + wh / 2):
        k.rbox((wx, y, hz + 0.02), (ww + 0.16, 0.08, 0.06), 0.01, M, TRIM_LIGHT, segs=1)
    k.rbox((wx, wy, hz + 0.02), (0.05, wh, 0.05), 0.0, M, TRIM_LIGHT, segs=1)
    for x, sg in ((win[0] - 0.27, -1), (win[1] + 0.27, 1)):
        k.rbox((x, wy, hz + 0.04), (0.44, wh, 0.05), 0.01, M, "#4f7f8a", segs=1, uv_len=1.0, v_axis=1)


def roof(k, M, Ms):
    """Shingles in rows down both slopes (each row a strip, a touch proud of the one above), the ridge capped, the gable
    edges trimmed; a stone chimney through the back slope."""
    over, rows = 0.35, 6
    run = D / 2 + over
    slope = math.atan2(RIDGE - H, D / 2)
    L = run / math.cos(slope)
    for sz in (-1, 1):
        for i in range(rows):
            t = (i + 0.5) / rows
            z = sz * run * t
            y = RIDGE - (RIDGE - H) * (run * t) / (D / 2) + 0.08 + 0.03 * (i % 2)
            rot = K.game_rot(pitch=sz * slope)
            # A row: shingles side by side, each its own shade, the rows staggered.
            n = 8
            for j in range(n + (i % 2)):
                x0 = -W / 2 - over + (j - 0.5 * (i % 2)) * (W + 2 * over) / n
                x1 = min(x0 + (W + 2 * over) / n, W / 2 + over)
                x0 = max(x0, -W / 2 - over)
                k.rbox(((x0 + x1) / 2, y, z), (x1 - x0 - 0.03, 0.07, L / rows + 0.08), 0.0, Ms, SHINGLE[int(rng.integers(0, 3))], rot=rot, segs=1)
    k.rbox((0, RIDGE + 0.12, 0), (W + 2 * over + 0.1, 0.14, 0.26), 0.02, M, TRIM, segs=1, uv_len=2.0, v_axis=0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            a, b = (sx * (W / 2 + over), RIDGE + 0.1, 0.0), (sx * (W / 2 + over), H - 0.15, sz * run)
            k.beam(a, b, 0.1, 0.12, 0.015, M, TRIM_LIGHT, segs=1)
    cx, cz = -1.5, -0.7
    ytop = RIDGE - (RIDGE - H) * abs(cz) / (D / 2) + 0.9
    k.rbox((cx, ytop - 0.6, cz), (0.5, 1.2, 0.5), 0.03, Ms, "#8e8a84", segs=1)
    k.rbox((cx, ytop + 0.03, cz), (0.62, 0.1, 0.62), 0.02, Ms, "#6f6b66", segs=1)


def marlin(k, M, Mp, Mr):
    """The big marlin on the ridge, nose up: a spindle body, blue over a white belly, a long bill, a sail of a dorsal
    fin, a forked tail, little side fins, an eye; on a post lashed to the ridge."""
    pitch = math.radians(24)
    d = np.array((math.cos(pitch), math.sin(pitch), 0.0))
    up = np.array((-math.sin(pitch), math.cos(pitch), 0.0))
    c = np.array((0.2, RIDGE + 0.95, 0.0))
    k.rbox((c[0] - 0.1, RIDGE + 0.4, 0), (0.18, 0.7, 0.18), 0.02, M, TRIM, segs=1)
    lashing(k, Mr, (c[0] - 0.1, 0, 0), 0.1, RIDGE + 0.3, wraps=2)
    prof = [(0.0, -1.35), (0.12, -1.15), (0.34, -0.7), (0.47, -0.15), (0.45, 0.35), (0.32, 0.8), (0.12, 1.05), (0.0, 1.1)]
    faces = k.lathe(tuple(c), prof, Mp, MARLIN, d=tuple(d), n=10, sx=0.6, up=(0, 1, 0))
    for f in faces:      # a white belly: every corner under the body's axis
        for lp in f.loops:
            g = np.array((lp.vert.co.x, lp.vert.co.z, -lp.vert.co.y))
            h = np.dot(g - c, up)
            lp[k.col] = (*K.lin(BELLY if h < -0.08 else MARLIN if h > 0.08 else mix(MARLIN, BELLY, 0.5)), 1.0)
    k.lathe(tuple(c + d * 1.02), [(0.09, 0.0), (0.05, 0.6), (0.0, 1.5)], Mp, "#2f5a9c", d=tuple(d), n=6)
    to_xy = lambda a, b: tuple(c + d * a + up * b)[:2]
    sail = [to_xy(-0.5, 0.3), to_xy(0.55, 0.38), to_xy(0.35, 1.05), to_xy(0.0, 1.0), to_xy(-0.45, 0.65)]
    k.extrude(sail, -0.03, 0.03, Mp, "#2a4f8f", bevel=0.015)
    tail = [to_xy(-1.25, 0.0), to_xy(-1.95, 0.85), to_xy(-1.75, 0.05), to_xy(-1.95, -0.8)]
    k.extrude(list(reversed(tail)), -0.03, 0.03, Mp, "#2a4f8f", bevel=0.015)
    for sz in (-1, 1):
        base = c + d * 0.25 - up * 0.2
        p0, p1, p2 = base + np.array((0, 0, sz * 0.25)), base - d * 0.35 + np.array((0, -0.25, sz * 0.75)), base - d * 0.3 + np.array((0, 0, sz * 0.25))
        k.face([k.vert(tuple(p)) for p in ((p0, p1, p2) if sz > 0 else (p2, p1, p0))], [(0, 0)] * 3, Mp, "#2a4f8f")
        eye = c + d * 0.6 + up * 0.08 + np.array((0, 0, sz * 0.22))
        k.blob(tuple(eye), (0.08, 0.08, 0.05), Mp, "#f7f4ea", segs=8, rings=5)
        k.blob(tuple(eye + np.array((0, 0, sz * 0.04))), (0.045, 0.045, 0.03), Mp, "#1f2328", segs=6, rings=4)


def sign(k, M, Mp):
    """The fish sign over the front: a board on the eaves with a painted fish on it."""
    z = D / 2 + 0.42
    y = H + 0.42
    k.rbox((0, y, z), (2.2, 0.75, 0.08), 0.03, M, TRIM_LIGHT, segs=1, uv_len=1.5, v_axis=0)
    for x in (-0.9, 0.9):
        k.rbox((x, y - 0.42, z - 0.05), (0.08, 0.5, 0.08), 0.01, M, TRIM, segs=1)
    body = [(0.55 * math.cos(a), y + 0.22 * math.sin(a)) for a in np.linspace(0, math.tau, 14, endpoint=False)]
    k.extrude(body, z + 0.04, z + 0.08, Mp, "#3f6fb8", bevel=0.01, at=(0.1, 0, 0))
    k.extrude([(-0.4, y), (-0.8, y + 0.25), (-0.72, y), (-0.8, y - 0.25)][::-1], z + 0.04, z + 0.08, Mp, "#3f6fb8", bevel=0.01, at=(0.1, 0, 0))
    k.blob((0.45, y + 0.06, z + 0.1), (0.05, 0.05, 0.02), Mp, "#f7f4ea", segs=6, rings=4)


def awning_and_display(k, M, Mp, Mg, Mr):
    """A plank awning from the eaves out to z 2.75 on two posts; under it a table of fish crates on ice, a life ring by
    the door, a barrel at the corner."""
    z0, z1, y0, y1 = D / 2 + 0.1, 2.75, 2.45, 2.15
    for i in range(12):
        x = -2.55 + (i + 0.5) * 5.1 / 12
        col = mix("#c9a072", "#9c7550", rng.uniform(0, 0.6))
        k.beam((x, y0 + rng.uniform(-0.02, 0.02), z0), (x, y1 + rng.uniform(-0.03, 0.03), z1 + rng.uniform(-0.05, 0.08)), 0.41, 0.05, 0.0, M, col, segs=1)
    for x in (-2.4, 2.4):
        k.rbox((x, (y1 - 0.02) / 2, z1 - 0.15), (0.14, y1 - 0.02, 0.14), 0.02, M, TRIM, segs=1, uv_len=1.5, v_axis=1)
    k.beam((-2.5, y1 - 0.08, z1 - 0.15), (2.5, y1 - 0.08, z1 - 0.15), 0.1, 0.12, 0.015, M, TRIM, segs=1)
    # The display: a table, three crates of fish on ice stepped up toward the wall.
    tx, tz = 1.2, 2.75
    k.rbox((tx, 0.72, tz), (2.0, 0.07, 0.95), 0.015, M, TRIM_LIGHT, segs=1, uv_len=1.5, v_axis=0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.rbox((tx + sx * 0.9, 0.36, tz + sz * 0.38), (0.08, 0.72, 0.08), 0.01, M, TRIM, segs=1)
    fishes = (("#5f86b5", "#6aa36b"), ("#c56a55", "#5f86b5"), ("#6aa36b", "#c56a55"))
    for i, x in enumerate((tx - 0.62, tx, tx + 0.62)):
        y = 0.755 + (0.08 if i == 1 else 0.0)
        for c, size in (((x, y + 0.02, tz), (0.56, 0.04, 0.56)), ((x, y + 0.1, tz - 0.26), (0.56, 0.2, 0.04)), ((x, y + 0.1, tz + 0.26), (0.56, 0.2, 0.04)),
                        ((x - 0.26, y + 0.1, tz), (0.04, 0.2, 0.56)), ((x + 0.26, y + 0.1, tz), (0.04, 0.2, 0.56))):
            k.rbox(c, size, 0.0, M, mix("#b08458", "#8a6440", 0.3 * i), segs=1)     # an open crate
        k.blob((x, y + 0.17, tz), (0.23, 0.045, 0.23), Mp, "#dceef2", segs=8, rings=4, seed=i)
        for j, col in enumerate(fishes[i]):
            fish(k, Mp, (x + (j - 0.5) * 0.06, y + 0.23 + 0.02 * j, tz + (j - 0.5) * 0.2), 0.4 + 0.3 * j, 0.36, col)
    ring_into(k, Mp, Mr, c=(-2.2, 0.75, D / 2 + 0.1), s=0.6)
    bx, bz = -2.15, 2.6
    k.lathe((bx, 0, bz), [(0.0, 0.0), (0.27, 0.0), (0.31, 0.25), (0.32, 0.4), (0.31, 0.55), (0.27, 0.8), (0.0, 0.8)], M, "#a87a4c", n=10, v_len=0.8)
    for y in (0.12, 0.68):
        k.lathe((bx, y, bz), [(0.3, -0.03), (0.315, 0.0), (0.3, 0.03)], Mp, "#5b5f63", n=10)


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    paint, glass, stone = K.Mat("P_Paint", rough=0.45), K.Mat("P_Glass", rough=0.08), K.Mat("P_Stone", rough=0.95)
    k = K.Kit("fish-market")
    door, win = walls(k, wood)
    front(k, wood, paint, glass, door, win)
    roof(k, wood, stone)
    marlin(k, wood, paint, rope)
    sign(k, wood, paint)
    awning_and_display(k, wood, paint, glass, rope)
    k.tint_gradient(0.84, 1.0, 0.0, RIDGE)
    ob = k.finish(smooth_deg=40)
    K.export([ob], "game/buildings/fish-market.glb")
    report(ob)
    return ob


if __name__ == "__main__":
    ob = build()
    if "review" in ARGS:
        K.review([ob], os.path.join(ARGS[ARGS.index("review") + 1], "fish-market.png"), views=((200, 28), (145, 38)), size=900)
