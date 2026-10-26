"""The new world's beach set (game/wharf-art, David's note 6 of 2026-10-26: "beach should have a sushi bar, should have
coral in the shallow waters ... some surfboard sticking in the sand, a life guard tower"; the sushi bar after his night
bar reference, specs/references/terrain/plan-2026-10-23/wharf-sharkbar.jpg: a big fish-head shell over a bar counter
with stools and hanging lanterns). Our style: simple shapes, plain colours, low detail.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_beach_set.py [-- review <dir>]

Writes, in game units at scale 1, the origin on the ground (y 0):
  game/buildings/sushi-bar.glb    a shark's head lying open-mouthed over a boarded platform, the mouth facing +z: a
                                  thatched crown roped down, eyes, teeth along the jaw, a fin; inside, a bar counter
                                  with sushi on a board, three stools before it, shelves of bottles at the back, a
                                  barrel, paper lanterns hung round the jaw and a noren across it. Nobody enters it in
                                  v1 (the counter blocks the way). About 5.6 by 4.4.
  game/props/lifeguard-tower.glb  a white lifeguard tower: four splayed legs braced, a deck at 1.8 with a rail, a hut
                                  with a red and white roof, a ladder up its front (+z), a flag, a life ring.
  game/props/surfboard-{a,b,c}.glb  a surfboard stuck nose up in the sand, leaning a little, its tail under y 0.
  game/water/coral-{a,b,c,d}.glb  low coral clumps for the shallows, their foot on the seabed: a staghorn (a), a brain
                                  coral (b), sea fans (c), tube coral (d).

Wood is the wharf's (art/wharf/build_wharf_kit.py wood_mat), rope its rope; the rest are the shared plain presets
(P_Paint, P_Cloth, P_Wood, P_Glass, P_Stone: lib/game/modelMaterials MATERIAL_PRESETS) with their colour in COLOR_0.
Seeded: a rebuild writes the same models. Prints each model's triangles and bounds.
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report, wood_mat  # noqa: E402
from build_dock_decor import FLOAT_RED, ROPE, ring_into  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
rng = np.random.default_rng(2627)
WOOD, WOOD_LIGHT = "#9c7550", "#d4b088"
SHARK, SHARK_BELLY, GUM, STRAW = "#6f8ea3", "#c9d6dc", "#d98a8c", "#d8b468"


def box(k, c, size, M, col):
    """A plain box (12 triangles) for the small things."""
    return k.rbox(c, size, 0.0, M, col, segs=1)


def prism(k, M, pts, x0, x1, col):
    """A flat shape in the y-z plane (counter-clockwise seen from +x) thickened from x0 to x1."""
    a = [k.vert((x1, y, z)) for y, z in pts]
    b = [k.vert((x0, y, z)) for y, z in pts]
    uv = [(0, 0)] * 4
    k.face(a, [(0, 0)] * len(a), M, col)
    k.face(list(reversed(b)), [(0, 0)] * len(b), M, col)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        k.face([b[i], b[j], a[j], a[i]], uv, M, col)


# ================================================================ the sushi bar
Y0, ZF, RX, RY, RZ = 0.18, 1.2, 2.6, 3.0, 3.0      # the platform's top; the jaw's front; the head's radii


def head_pt(th, ph, s=1.0):
    """A point on the head's shell: th round the jaw (0 at +x on the ground, pi at -x), ph back from the jaw (pi/2 is
    the back of the head on the ground); s scales it about the jaw's foot line."""
    return (RX * s * math.cos(th) * math.cos(ph), Y0 + RY * s * math.sin(th) * math.cos(ph), ZF - RZ * s * math.sin(ph))


def shell(k, M, s, col_of, th0=0.0, th1=math.pi, ph1=math.pi / 2, nt=12, nph=6, flip=False):
    rows = [[k.vert(head_pt(th0 + (th1 - th0) * i / nt, ph1 * j / nph, s)) for i in range(nt + 1)] for j in range(nph + 1)]
    for j in range(nph):
        for i in range(nt):
            q = [rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]]
            k.face(list(reversed(q)) if flip else q, [(0, 0)] * 4, M, col_of(th0 + (th1 - th0) * (i + 0.5) / nt, ph1 * (j + 0.5) / nph))
    return rows


def lantern(k, Mc, Mp, Mr, c, top):
    x, y, z = c
    k.tube([(x, top, z), (x, y + 0.17, z)], 0.008, Mr, ROPE, n=4, v_len=0.2)
    k.lathe((x, y, z), [(0.0, -0.16), (0.09, -0.15), (0.13, -0.06), (0.13, 0.06), (0.09, 0.15), (0.0, 0.16)], Mc, "#f6e9cc", n=8)
    for dy in (-0.16, 0.16):
        k.lathe((x, y + dy, z), [(0.0, -0.025), (0.07, -0.025), (0.07, 0.025), (0.0, 0.025)], Mp, "#c8483c", n=8)


def sushi_bar(Mw, Mr, Mp, Mc, Mwood, Mg):
    k = K.Kit("sushi-bar")
    # The platform: boards across, a step along the front.
    for i in range(10):
        z = -2.1 + (i + 0.5) * 0.4
        k.rbox((0, Y0 / 2, z), (5.6, Y0, 0.38), 0.015, Mw, mix(WOOD, WOOD_LIGHT, rng.uniform(0.3, 0.8)), segs=1, uv_len=2.0, v_axis=0,
               uv_off=(rng.random(), rng.random()))
    k.rbox((0, 0.045, 2.05), (3.2, 0.09, 0.3), 0.015, Mw, mix(WOOD, WOOD_LIGHT, 0.4), segs=1, uv_len=2.0, v_axis=0)
    # The head: an outer skin, grey-blue fading to a pale belly at the ground, a wooden lining, a gum along the jaw.
    outer = shell(k, Mp, 1.0, lambda th, ph: mix(SHARK_BELLY, SHARK, min(1.0, math.sin(th) * 1.6)))
    inner = shell(k, Mwood, 0.94, lambda th, ph: mix(WOOD, WOOD_LIGHT, 0.5 + 0.3 * math.sin(th)), flip=True)
    for i in range(12):
        q = [outer[0][i], inner[0][i], inner[0][i + 1], outer[0][i + 1]]
        k.face(q, [(0, 0)] * 4, Mp, GUM)
    # Teeth along the jaw, pointing in and down.
    for i in range(1, 12):
        th = math.pi * i / 12
        a, b = np.array(head_pt(th, 0.0, 0.97)), np.array(head_pt(th, 0.0, 1.0))
        foot = (a + b) / 2
        inward = np.array((0.0, Y0 + 1.2, ZF)) - foot
        inward /= np.linalg.norm(inward)
        along = np.array((-math.sin(th), math.cos(th), 0.0))
        tip = foot + inward * 0.3
        b0, b1, b2 = foot + along * 0.1, foot - along * 0.1, foot + np.array((0, 0, 0.07))
        for tri in ((b0, b1, tip), (b1, b2, tip), (b2, b0, tip), (b0, b2, b1)):
            k.face([k.vert(tuple(p)) for p in tri], [(0, 0)] * 3, Mp, "#f7f4ea")
    # The thatched crown, roped down, its hem in a fringe.
    th0, th1, nt = 0.3 * math.pi, 0.7 * math.pi, 6
    rows = shell(k, Mc, 1.05, lambda th, ph: mix(STRAW, "#b88f48", rng.uniform(0, 0.5)), th0, th1, 0.95, nt, 4)
    for i in range(nt):          # the fringe along the jaw
        a, b = np.array(rows[0][i].co), np.array(rows[0][i + 1].co)
        mid = (a + b) / 2 + np.array((0.0, -0.18, -0.25))             # Blender frame: z is game y
        k.face([rows[0][i], rows[0][i + 1], k.bm.verts.new(tuple(mid))], [(0, 0)] * 3, Mc, "#c7a057")
    for ph in (0.2, 0.5, 0.8):
        k.tube([head_pt(th0 + (th1 - th0) * t, ph, 1.07) for t in np.linspace(0, 1, 9)], 0.022, Mr, ROPE, n=5, v_len=0.12)
    for th in (0.4 * math.pi, 0.5 * math.pi, 0.6 * math.pi):
        k.tube([head_pt(th, ph, 1.07) for ph in np.linspace(0.0, 0.95, 6)], 0.022, Mr, ROPE, n=5, v_len=0.12)
    # Eyes high on its sides by the jaw, a fin on its back, three gills each side.
    for th in (0.2 * math.pi, 0.8 * math.pi):
        c = np.array(head_pt(th, 0.32, 1.0))
        out = np.array((math.cos(th), 0.25, 0.25))
        out /= np.linalg.norm(out)
        k.blob(tuple(c), (0.24, 0.24, 0.24), Mp, "#f7f4ea", segs=8, rings=6)
        k.blob(tuple(c + out * 0.16), (0.12, 0.12, 0.12), Mp, "#1f2328", segs=8, rings=5)
    fy, fz = head_pt(0.5 * math.pi, 0.95, 1.0)[1:]
    prism(k, Mp, [(fy - 0.15, fz + 0.5), (fy - 0.15, fz - 0.5), (fy + 1.0, fz - 0.75)], -0.07, 0.07, SHARK)
    for side in (0.08, 0.92):
        for ph in (0.85, 1.0, 1.15):
            k.tube([head_pt(math.pi * (side + d), ph, 1.01) for d in (-0.07, 0.0, 0.07)], 0.025, Mp, mix(SHARK, "#2c3a44", 0.5), n=4, v_len=0.3)
    # The bar: a planked counter with a dark top, sushi on a board, stools before it.
    for i in range(12):
        x = -1.5 + (i + 0.5) * 0.25
        k.rbox((x, Y0 + 0.48, 0.68), (0.23, 0.96, 0.06), 0.012, Mw, mix(WOOD_LIGHT, WOOD, rng.uniform(0.0, 0.35)), segs=1, uv_len=1.2, v_axis=1,
               uv_off=(rng.random(), rng.random()))
    k.rbox((0, Y0 + 0.5, 0.42), (3.0, 1.0, 0.5), 0.02, Mw, mix(WOOD, "#5a3e26", 0.4), segs=1)
    k.rbox((0, Y0 + 1.03, 0.45), (3.2, 0.07, 0.66), 0.02, Mw, "#6b4a2c", segs=1, uv_len=2.0, v_axis=0)
    gx, gy, gz = 0.4, Y0 + 1.08, 0.5
    box(k, (gx, gy, gz), (0.7, 0.04, 0.24), Mw, "#c69a64")
    for i, fish in enumerate(("#f08c5a", "#d9434b", "#f08c5a", "#f2c96b")):
        x = gx - 0.24 + i * 0.16
        box(k, (x, gy + 0.05, gz), (0.11, 0.06, 0.07), Mp, "#f8f6ef")
        box(k, (x, gy + 0.09, gz), (0.13, 0.025, 0.09), Mp, fish)
    for x in (-1.0, 0.0, 1.0):
        k.lathe((x, Y0, 1.15), [(0.13, 0.0), (0.05, 0.05), (0.04, 0.62), (0.0, 0.62)], Mw, WOOD, n=8, v_len=0.8)
        k.lathe((x, Y0 + 0.62, 1.15), [(0.0, 0.0), (0.2, 0.0), (0.21, 0.06), (0.16, 0.11), (0.0, 0.12)], Mc, "#c8483c", n=10)
    # Shelves at the back: a board wall, two shelves, bottles and jars.
    k.rbox((0, Y0 + 0.9, -1.0), (1.8, 1.8, 0.08), 0.015, Mw, mix(WOOD, "#5a3e26", 0.3), segs=1, uv_len=1.5, v_axis=1)
    for y in (0.75, 1.3):
        k.rbox((0, Y0 + y, -0.86), (1.8, 0.05, 0.3), 0.01, Mw, WOOD_LIGHT, segs=1, uv_len=1.5, v_axis=0)
        for i in range(6):
            x = -0.7 + i * 0.28 + rng.uniform(-0.04, 0.04)
            h = rng.uniform(0.2, 0.32)
            col = ["#4f8a5c", "#7a4a2a", "#3d6f8a", "#b8c070"][rng.integers(0, 4)]
            k.lathe((x, Y0 + y + 0.025, -0.86), [(0.0, 0.0), (0.06, 0.0), (0.06, h * 0.65), (0.025, h * 0.8), (0.022, h), (0.0, h)], Mg, col, n=6)
    # A barrel by the counter's end.
    bx, bz = -2.0, 0.6
    k.lathe((bx, Y0, bz), [(0.0, 0.0), (0.27, 0.0), (0.31, 0.25), (0.32, 0.4), (0.31, 0.55), (0.27, 0.8), (0.0, 0.8)], Mw, "#a87a4c", n=10, v_len=0.8)
    for y in (0.12, 0.68):
        k.lathe((bx, Y0 + y, bz), [(0.3, -0.03), (0.315, 0.0), (0.3, 0.03)], Mp, "#5b5f63", n=10)
    # Paper lanterns hung round the jaw, a noren across it.
    for th in (0.12, 0.27, 0.42, 0.58, 0.73, 0.88):
        hang = np.array(head_pt(math.pi * th, 0.08, 0.92))
        lantern(k, Mc, Mp, Mr, (hang[0], hang[1] - 0.45, hang[2]), hang[1])
    ny, nz = Y0 + 2.45, ZF - 0.2
    k.tube([(-1.45, ny, nz), (1.45, ny, nz)], 0.03, Mw, "#6b4a2c", n=6, v_len=0.8)
    for i in range(4):
        x0, x1 = -1.32 + i * 0.67, -1.32 + i * 0.67 + 0.63
        wave = lambda t: 0.03 * math.sin(t * 5 + i)
        rows_ = [[(x0, ny - d, nz + wave(d)), (x1, ny - d, nz + wave(d + 0.5))] for d in (0.0, 0.18, 0.36)]
        for a, b in zip(rows_, rows_[1:]):
            k.quad([a[0], a[1], b[1], b[0]], Mc, "#2c4a78" if a[0][1] > ny - 0.1 else "#40639a")
    k.tint_gradient(0.85, 1.0, 0.0, 3.0)
    return k.finish(smooth_deg=40)


# ================================================================ the lifeguard tower
def lifeguard_tower(Mw, Mr, Mp, Mc):
    k = K.Kit("lifeguard-tower")
    white, deck_y = "#f1ede4", 1.8
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.beam((sx * 0.8, 0.0, sz * 0.8), (sx * 0.55, deck_y, sz * 0.55), 0.12, 0.12, 0.02, Mp, white, segs=1)
    for sz in (-1, 1):   # cross braces on the sides and the back
        k.beam((-0.76, 0.3, sz * 0.76), (0.6, 1.5, sz * 0.6), 0.06, 0.06, 0.01, Mp, white, segs=1, up=(0, 0, 1))
    k.beam((-0.76, 0.3, -0.76), (-0.6, 1.5, 0.6), 0.06, 0.06, 0.01, Mp, white, segs=1, up=(1, 0, 0))
    k.rbox((0, deck_y + 0.05, 0), (1.5, 0.1, 1.5), 0.02, Mw, mix(WOOD, WOOD_LIGHT, 0.6), segs=1, uv_len=1.5, v_axis=0)
    for x in (-0.7, 0.7):  # the rail round the front half
        k.beam((x, deck_y + 0.1, 0.7), (x, deck_y + 0.75, 0.7), 0.05, 0.05, 0.01, Mp, white, segs=1, up=(0, 0, 1))
    k.beam((-0.72, deck_y + 0.72, 0.7), (-0.25, deck_y + 0.72, 0.7), 0.05, 0.05, 0.01, Mp, white, segs=1)
    k.beam((0.25, deck_y + 0.72, 0.7), (0.72, deck_y + 0.72, 0.7), 0.05, 0.05, 0.01, Mp, white, segs=1)
    # The hut on the back of the deck: three walls, open to the front, a striped roof.
    hy = deck_y + 0.1
    k.rbox((0, hy + 0.55, -0.62), (1.3, 1.1, 0.07), 0.015, Mp, white, segs=1)
    for x in (-0.62, 0.62):
        k.rbox((x, hy + 0.35, -0.3), (0.07, 0.7, 0.62), 0.015, Mp, white, segs=1)
        k.beam((x, hy, 0.0), (x, hy + 1.25, 0.0), 0.06, 0.06, 0.01, Mp, white, segs=1, up=(0, 0, 1))
    for i in range(6):   # the roof: six boards over the hut, red and white, falling to the back
        x = -0.75 + (i + 0.5) * 0.25
        k.beam((x, hy + 1.3, 0.25), (x, hy + 1.1, -0.8), 0.25, 0.05, 0.01, Mp, FLOAT_RED if i % 2 == 0 else white, segs=1)
    # The ladder up the front, a flag on a pole at the corner, a life ring on the rail.
    for x in (-0.25, 0.25):
        k.beam((x, 0.0, 1.45), (x, deck_y + 0.1, 0.72), 0.06, 0.05, 0.01, Mw, WOOD_LIGHT, segs=1)
    for i in range(1, 7):
        t = i / 7
        k.beam((-0.25, t * (deck_y + 0.1), 1.45 - 0.73 * t), (0.25, t * (deck_y + 0.1), 1.45 - 0.73 * t), 0.05, 0.04, 0.01, Mw, WOOD, segs=1)
    k.tube([(0.7, deck_y, -0.7), (0.7, deck_y + 2.0, -0.7)], 0.025, Mp, "#9aa0a6", n=6, v_len=1.0)
    prism(k, Mc, [(deck_y + 1.95, -0.7), (deck_y + 1.55, -0.7), (deck_y + 1.75, -0.12)], 0.69, 0.71, "#e8553c")
    ring_into(k, Mp, Mr, c=(-0.48, deck_y + 0.1, 0.76), s=0.6)
    k.tint_gradient(0.86, 1.0, 0.0, 3.5)
    return k.finish(smooth_deg=40)


# ================================================================ surfboards
BOARDS = {"a": ("#3fb8c4", "#f6f2e6"), "b": ("#f2c94c", "#e2553e"), "c": ("#ef8a8a", "#f6f2e6")}


def board_outline(L=2.1, W=0.5, n=10):
    """Counter-clockwise in (x, y): the tail at y 0, the nose at y L."""
    right = []
    for i in range(n + 1):
        t = i / n
        y = L * t
        w = W / 2 * (math.sin(math.pi * (0.06 + 0.9 * t)) ** 0.8) * (1 - 0.15 * t)
        right.append((w, y))
    left = [(-x, y) for x, y in reversed(right[1:-1])]
    return right + [(0.0, L + 0.03)] + left + [(0.0, -0.02)]


def surfboard(name, Mp):
    k = K.Kit(f"surfboard-{name}")
    body, stripe = BOARDS[name]
    rot = K.game_rot(yaw={"a": 0.2, "b": -0.3, "c": 0.6}[name], pitch=-0.12, roll={"a": 0.1, "b": -0.08, "c": 0.05}[name])
    at = (0.0, -0.35, 0.0)
    k.extrude(board_outline(), -0.035, 0.035, Mp, body, bevel=0.025, rot=rot, at=at)
    sw = 0.05
    k.extrude([(sw, 0.25), (sw, 1.85), (-sw, 1.85), (-sw, 0.25)], 0.036, 0.042, Mp, stripe, rot=rot, at=at)
    k.extrude([(sw, 0.25), (-sw, 0.25), (-sw, 1.85), (sw, 1.85)], -0.042, -0.036, Mp, stripe, rot=rot, at=at)
    return k.finish(smooth_deg=50)


# ================================================================ coral
def coral_a(Ms):   # a staghorn: branches forking up from one foot
    k = K.Kit("coral-a")
    col = "#ef8f8f"
    def branch(p, d, length, r, depth):
        q = (p[0] + d[0] * length, p[1] + d[1] * length, p[2] + d[2] * length)
        mid = ((p[0] + q[0]) / 2 + rng.uniform(-0.04, 0.04), (p[1] + q[1]) / 2, (p[2] + q[2]) / 2 + rng.uniform(-0.04, 0.04))
        k.tube([p, mid, q], r, Ms, mix(col, "#f7c2b6", 0.2 * depth), n=6, v_len=0.3, caps=depth == 2, radii=[1.0, 0.85, 0.7])
        if depth < 2:
            for _ in range(2):
                a, e = rng.uniform(0, math.tau), rng.uniform(0.5, 0.9)
                nd = np.array((math.cos(a) * math.cos(e), math.sin(e), math.sin(a) * math.cos(e))) * 0.5 + np.array(d) * 0.5
                nd /= np.linalg.norm(nd)
                branch(q, tuple(nd), length * 0.75, r * 0.7, depth + 1)
    for a in (0.3, 2.4, 4.5):
        branch((0.0, -0.05, 0.0), (math.cos(a) * 0.45, 0.9, math.sin(a) * 0.45), 0.32, 0.06, 0)
    k.blob((0, 0.0, 0), (0.18, 0.08, 0.18), Ms, mix(col, "#b8706a", 0.4), segs=8, rings=4, flat_bottom=0.0)
    return k.finish(smooth_deg=60)


def coral_b(Ms):   # a brain coral: a lumpy dome and a smaller one
    k = K.Kit("coral-b")
    k.blob((0, 0.0, 0), (0.42, 0.3, 0.38), Ms, "#c9c35e", segs=12, rings=7, seed=4, lumpy=0.25, flat_bottom=0.0)
    k.blob((0.38, 0.0, 0.22), (0.2, 0.16, 0.2), Ms, "#b9c06a", segs=10, rings=6, seed=6, lumpy=0.3, flat_bottom=0.0)
    for v in k.bm.verts:
        v.co.z = max(v.co.z, 0.0)
    return k.finish(smooth_deg=70)


def fan_outline(R, n=13):
    pts = [(0.03, 0.0)]
    for i in range(n + 1):
        a = math.radians(15 + 150 * i / n)
        r = R * (0.9 + 0.1 * math.cos(i * 2.3)) * (0.92 if i % 2 else 1.0)
        pts.append((math.cos(a) * r, 0.15 + math.sin(a) * r))
    pts.append((-0.03, 0.0))
    return list(reversed(pts))


def coral_c(Ms):   # sea fans: two flat lobed fans on short stalks
    k = K.Kit("coral-c")
    for (x, z, yaw, R, col) in ((0.0, 0.0, 0.2, 0.42, "#9b6cc4"), (0.28, 0.18, -0.6, 0.3, "#c47ab8")):
        k.extrude(fan_outline(R), -0.02, 0.02, Ms, col, bevel=0.012, rot=K.game_rot(yaw=yaw), at=(x, 0.0, z))
    k.blob((0.1, 0.0, 0.05), (0.14, 0.06, 0.12), Ms, "#7d5a8a", segs=8, rings=4, flat_bottom=0.0)
    return k.finish(smooth_deg=50)


def coral_d(Ms):   # tube coral: a cluster of open tubes, their rims lighter
    k = K.Kit("coral-d")
    for i, (x, z, h, r) in enumerate(((0, 0, 0.42, 0.08), (0.15, 0.05, 0.3, 0.07), (-0.12, 0.1, 0.34, 0.07), (0.05, -0.14, 0.26, 0.06),
                                       (-0.08, -0.1, 0.2, 0.055))):
        k.lathe((x, 0.0, z), [(r * 1.1, 0.0), (r, h * 0.6), (r * 1.15, h), (r * 0.7, h), (r * 0.6, h * 0.7)], Ms,
                mix("#f2a04a", "#f6d07a", i * 0.15), n=8)
    return k.finish(smooth_deg=60)


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    paint, cloth = K.Mat("P_Paint", rough=0.45), K.Mat("P_Cloth", rough=1.0)
    plain_wood, glass, stone = K.Mat("P_Wood", rough=0.9), K.Mat("P_Glass", rough=0.08), K.Mat("P_Stone", rough=0.95)
    jobs = [("game/buildings/sushi-bar", lambda: sushi_bar(wood, rope, paint, cloth, plain_wood, glass)),
            ("game/props/lifeguard-tower", lambda: lifeguard_tower(wood, rope, paint, cloth))]
    jobs += [(f"game/props/surfboard-{n}", (lambda n=n: surfboard(n, paint))) for n in BOARDS]
    jobs += [(f"game/water/coral-{n}", (lambda f=f: f(stone))) for n, f in zip("abcd", (coral_a, coral_b, coral_c, coral_d))]
    obs = {}
    for path, fn in jobs:
        ob = fn()
        K.export([ob], f"{path}.glb")
        report(ob)
        obs[os.path.basename(path)] = ob
    return obs


def scene(obs, out):
    import bpy
    shown = []
    spots = {"sushi-bar": (0, 0), "lifeguard-tower": (5.0, -0.5), "surfboard-a": (3.4, 2.4), "surfboard-b": (3.9, 2.6), "surfboard-c": (4.4, 2.3),
             "coral-a": (-4.2, 2.6), "coral-b": (-3.2, 3.0), "coral-c": (-4.4, 3.6), "coral-d": (-3.4, 3.9)}
    for name, (x, z) in spots.items():
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G(x, 0, z)
        shown.append(o)
        obs[name].hide_render = True
    bpy.context.view_layer.update()
    K.review(shown, out, views=((200, 30), (150, 40)), size=1000)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "beach-set.png"))
