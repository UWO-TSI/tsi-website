"""The new world's sushi bar (game/sushi-bar; David's R2c note: "a long horizontal bar, reference bancho sushi in dave the
diver ... the decore is similar to wharf, its a really big open bar where you can sit down ... it has festive lighting
inside, it back of the bar is open window to see beatiful view in the back, 1-2 sushi npc making sushi", and with the
pictures: "good decore, speaker with music, lights and fishtank"; specs/references/terrain/sushi-bar-2026-10-26/).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/build_sushi_bar.py [-- review <dir>]

Writes, in game units at scale 1, the origin on the ground at the middle of the solid core (counter and kitchen,
x +-4, z +-1.5: defaultIsland PROP_FOOTPRINT), the front (the guests' side) toward +z:
  game/buildings/sushi-bar.glb       the bar, still (merged with the world's still props): a plank deck under a gabled
                                     plank roof on rope-lashed piles, the wharf's wood and rope; a long counter with a
                                     glass fish case, six stools before it (seats SEATS, tops at SEAT_TOP), the kitchen
                                     behind it, and a wide open window in the back wall onto the sea; sake bottles along
                                     the beam over the window, speakers at its ends, a big red fan between, red drapes
                                     along the front and curtains at the window, a wooden menu of hanging plaques, a fish
                                     tank at the counter's end, a chalk menu easel and potted palms on the deck, a sign
                                     on the roof.
  game/buildings/sushi-bar-glow.glb  what glows at night, drawn on its own by the bar (components/game/SushiBar.tsx)
                                     like a lamp, so it eases on and off with the lamps: paper lanterns over the
                                     counter and the deck, string lights along the front, the neon fish on the back
                                     wall, the speakers' neon trim, the roof sign's light box and the fish tank's water.
                                     One emissive palette material (M_Glow: the colour from where its UVs sit in the
                                     palette, since COLOR_0 does not tint emission) and P_Paint for the caps and cords.

Wood is the wharf's (art/wharf/build_wharf_kit.py wood_mat), rope its rope; the rest the shared plain presets (P_Paint,
P_Cloth, P_Wood, P_Glass, P_Stone: lib/game/modelMaterials MATERIAL_PRESETS), their colour in COLOR_0; the fish case's
and the tank's panes a see-through glass (M_PaneGlass). Seeded: a rebuild writes the same models. Prints each model's
triangles and bounds.
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report, wood_mat  # noqa: E402
from build_dock_decor import ROPE  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
rng = np.random.default_rng(2610)

# ---------------------------------------------------------------- the frame (game units; front +z)
HW, HD = 4.05, 1.5                                  # the walls round the kitchen; the counter's face at z HD
DECK_Z, DECK_W, FLOOR = 4.05, 4.45, 0.06            # the guests' deck: z HD..DECK_Z, x +-DECK_W, its top
RIDGE_Z, RIDGE_Y = 0.9, 4.4
FRONT_Z, FRONT_Y, BACK_Z, BACK_Y = 4.25, 3.12, -2.05, 3.26
HEADER_Y, HEADER_Z, PLATE_Y = 3.0, 3.95, 3.1       # the front beam on the posts; the top plates and lantern beam
WIN_X, SILL_Y, BEAM_Y, SHELF_Y = 3.2, 1.0, 2.5, 2.82
CX0, CX1, TOP_Y = -2.95, 4.0, 0.84                  # the counter, its top
SEAT_TOP, SEAT_Z = 0.6, 2.05                        # the stools (lib/game/sushiBar.ts SEATS mirrors these)
SEATS = [0.5 + (i - 2.5) * 1.1 for i in range(6)]
TANK = (-3.97, -3.03, 0.5, 1.45)                    # x0, x1, z0, z1

DARK, LIGHT = "#6e5137", "#a98762"                  # the wharf's weathered deck
POST, ROOF_A, ROOF_B = "#5a4230", "#4a7880", "#6f9ea2"      # the roof painted a weathered sea green
HINOKI, KITCHEN = "#e6c58f", "#b48f66"
RED, RED_DEEP, NAVY, INK = "#c3283a", "#9e1f2e", "#22314f", "#2a2420"

# The glow palette: one block per glow, its day colour (base) and its night colour (emission).
GLOWS = {"lantern": ("#f5dcae", "#ffa040"), "red": ("#de4a3a", "#ff4a2a"), "bulb": ("#f7ecd0", "#ffd070"),
         "pink": ("#f3a9c9", "#ff3f9a"), "cyan": ("#aeeaf0", "#30e0ff"), "sign": ("#f2b878", "#ff8a30"),
         "water": ("#74c6da", "#1f9fd8"), "green": ("#b7e6a4", "#58ff7a")}
GLOW_KEYS = list(GLOWS)


def roof_y(z):
    if z >= RIDGE_Z:
        return RIDGE_Y + (FRONT_Y - RIDGE_Y) * (z - RIDGE_Z) / (FRONT_Z - RIDGE_Z)
    return RIDGE_Y + (BACK_Y - RIDGE_Y) * (RIDGE_Z - z) / (RIDGE_Z - BACK_Z)


def tone(a=DARK, b=LIGHT, lo=0.25, hi=0.95):
    return mix(a, b, rng.uniform(lo, hi))


def box(k, c, size, M, col, r=0.0, rot=None, uv_len=1.0, v_axis=None):
    """A box; r 0 is 12 triangles (the small and the unseen), else rounded in one step."""
    return k.rbox(c, size, r, M, col, rot=rot, segs=1, uv_len=uv_len, v_axis=v_axis, uv_off=(rng.random(), rng.random()))


def panel(k, M, pts, col, uv=(0, 1), uv_len=1.0):
    """A flat polygon through game points (double-sided materials), UVs planar on two game axes."""
    return k.face([k.vert(p) for p in pts], [(p[uv[0]] / uv_len, p[uv[1]] / uv_len) for p in pts], M, col)


def glow_uv(k, faces, key):
    """Every loop of these faces on its glow's palette block."""
    u = (GLOW_KEYS.index(key) + 0.5) / len(GLOW_KEYS)
    for f in faces:
        for lp in f.loops:
            lp[k.uv].uv = (u, 0.5)
    return faces


def lashing(k, Mr, c, r, axis="y", n=8):
    """A rope band round a round timber: a closed ring of rope about the game axis through c."""
    x, y, z = c
    pts = []
    for i in range(n):
        a = math.tau * i / n
        pts.append({"y": (x + r * math.cos(a), y, z + r * math.sin(a)), "x": (x, y + r * math.cos(a), z + r * math.sin(a))}[axis])
    k.tube(pts, 0.028, Mr, ROPE, n=4, v_len=0.12, closed_path=True)


# ================================================================ the still bar
def floor_and_frame(k, W, Mr, Mg):
    # The guests' deck: boards across the counter's line (as the wharf's run inland), a fascia along its front.
    n = 21
    for i in range(n):
        x = -DECK_W + (i + 0.5) * (2 * DECK_W / n)
        box(k, (x, FLOOR - 0.05, (HD + DECK_Z) / 2), (2 * DECK_W / n - 0.025, 0.1, DECK_Z - HD), W, tone(), v_axis=2, uv_len=2.0)
    box(k, (0, FLOOR - 0.09, DECK_Z + 0.04), (2 * DECK_W + 0.1, 0.18, 0.08), W, mix(DARK, POST, 0.5), uv_len=2.0)
    # The kitchen floor, the same boards along the counter.
    for i in range(4):
        box(k, (0, FLOOR - 0.05, -HD + (i + 0.5) * 0.75), (2 * HW, 0.1, 0.73), W, tone(lo=0.4), v_axis=0, uv_len=2.0)
    # The piles along the front, lashed under the header; square posts at the kitchen's corners.
    for x in (-4.3, -1.5, 1.5, 4.3):
        k.lathe((x, -0.3, HEADER_Z), [(0.16, 0.0), (0.145, 0.3), (0.128, 3.25), (0.0, 3.32)], W, POST, n=8, v_len=1.2, u_tiles=0.5,
                wobble=lambda j, i: 1.0 + 0.04 * math.sin(j * 2.1 + x))
        lashing(k, Mr, (x, HEADER_Y - 0.32, HEADER_Z), 0.15)
        lashing(k, Mr, (x, HEADER_Y - 0.4, HEADER_Z), 0.15)
        if abs(x) > 4:   # a glass float in rope netting hung on each corner pile
            c = (x + 0.06 * np.sign(x), 2.05, HEADER_Z + 0.2)
            k.blob(c, (0.17, 0.17, 0.17), Mg, "#4f9a8a" if x < 0 else "#4f78a8", segs=8, rings=6)
            k.tube([(c[0] + 0.175 * math.cos(a), c[1] + 0.175 * math.sin(a), c[2]) for a in np.linspace(0, math.tau, 9)[:-1]], 0.012, Mr, ROPE,
                   n=3, closed_path=True)
            k.tube([(x, 2.45, HEADER_Z + 0.13), c[:2] + (c[2],)], 0.012, Mr, ROPE, n=3)
    for sx in (-1, 1):
        for z, top in ((HD, PLATE_Y), (-HD, roof_y(-HD))):
            k.beam((sx * HW, 0.0, z), (sx * HW, top, z), 0.18, 0.18, 0.02, W, POST, segs=1, uv_len=1.2)
    # Beams: the front header, the lantern beam over the counter, the side plates, the rafters under the planks.
    k.beam((-4.55, HEADER_Y, HEADER_Z), (4.55, HEADER_Y, HEADER_Z), 0.2, 0.24, 0.02, W, POST, segs=1, uv_len=2.0)
    k.beam((-HW, PLATE_Y, HD), (HW, PLATE_Y, HD), 0.16, 0.18, 0.02, W, POST, segs=1, uv_len=2.0)
    for sx in (-1, 1):
        k.beam((sx * HW, PLATE_Y, BACK_Z + 0.3), (sx * HW, HEADER_Y + 0.05, FRONT_Z - 0.1), 0.16, 0.16, 0.0, W, POST, uv_len=2.0)
    for x in (-HW, -1.45, 1.45, HW):
        for z0 in (BACK_Z + 0.1, FRONT_Z - 0.1):
            k.beam((x, roof_y(z0) - 0.1, z0), (x, RIDGE_Y - 0.1, RIDGE_Z), 0.12, 0.14, 0.0, W, POST, uv_len=2.0)


def roof(k, W, Mr):
    """Wide planks down both slopes, every other one lapped over its neighbours, a ridge log roped at its ends."""
    n = 20
    for side_z in (FRONT_Z, BACK_Z):
        for i in range(n):
            x = -4.6 + (i + 0.5) * (9.2 / n)
            lift = 0.06 if i % 2 else 0.035
            z0 = side_z + (0.05 if side_z > 0 else -0.05) * (i % 3 == 0)
            k.beam((x, roof_y(side_z) + lift, z0), (x, RIDGE_Y + lift, RIDGE_Z), 9.2 / n + 0.04 * (i % 2), 0.05, 0.0, W,
                   tone(ROOF_A, ROOF_B, 0.0, 1.0), uv_len=2.0)
    k.tube([(-4.8, RIDGE_Y + 0.12, RIDGE_Z), (4.8, RIDGE_Y + 0.12, RIDGE_Z)], 0.12, W, POST, n=8, v_len=1.5, caps=True)
    for x in (-4.45, 4.45):
        lashing(k, Mr, (x, RIDGE_Y + 0.12, RIDGE_Z), 0.135, axis="x")
    # Fascia boards along both eaves.
    for z in (FRONT_Z, BACK_Z):
        k.beam((-4.65, roof_y(z) + 0.02, z), (4.65, roof_y(z) + 0.02, z), 0.06, 0.16, 0.0, W, POST, uv_len=2.0)


def walls(k, W, Mr):
    # The back wall: boards under the window, pillars either side of it, a deep beam over it with the bottle shelf on
    # top, and boards up to the roof. The window between is open onto the sea.
    zb = -HD
    for i in range(4):   # boards along the wall under the window
        box(k, (0, (i + 0.5) * SILL_Y / 4, zb), (2 * HW, SILL_Y / 4 - 0.012, 0.12), W, tone(lo=0.35), uv_len=2.0, v_axis=0)
    for sx in (-1, 1):
        for i in range(3):   # upright boards either side of the window
            w = (HW - WIN_X) / 3
            box(k, (sx * (WIN_X + (i + 0.5) * w), (SILL_Y + BEAM_Y) / 2, zb), (w - 0.012, BEAM_Y - SILL_Y, 0.12), W, tone(lo=0.35), uv_len=2.0, v_axis=1)
        k.beam((sx * WIN_X, SILL_Y, zb), (sx * WIN_X, BEAM_Y, zb), 0.16, 0.2, 0.02, W, POST, segs=1, uv_len=1.2)
    box(k, (0, SILL_Y - 0.02, zb - 0.05), (2 * WIN_X + 0.1, 0.07, 0.42), W, mix(DARK, LIGHT, 0.7), r=0.02, uv_len=2.0, v_axis=0)
    box(k, (0, (BEAM_Y + SHELF_Y) / 2 - 0.02, zb), (2 * HW + 0.3, SHELF_Y - BEAM_Y - 0.04, 0.36), W, POST, r=0.03, uv_len=2.0, v_axis=0)
    box(k, (0, SHELF_Y - 0.02, zb + 0.06), (2 * HW + 0.2, 0.05, 0.44), W, mix(DARK, LIGHT, 0.8), uv_len=2.0, v_axis=0)
    top = roof_y(zb)
    for i in range(12):   # the boards over the beam, up to the roof, each its own tone
        x0, x1 = -HW + i * (2 * HW / 12), -HW + (i + 1) * (2 * HW / 12)
        panel(k, W, [(x0, SHELF_Y, zb), (x1, SHELF_Y, zb), (x1, top, zb), (x0, top, zb)], tone(lo=0.3), uv=(0, 1), uv_len=1.5)
    # The side walls: upright boards from the floor round the kitchen, and the gables over the deck's sides.
    nb = 17
    for sx in (-1, 1):
        for i in range(nb):
            z0, z1 = -HD + i * (DECK_Z - 0.1 + HD) / nb, -HD + (i + 1) * (DECK_Z - 0.1 + HD) / nb
            y0 = 0.0 if (z0 + z1) / 2 < HD else PLATE_Y
            pts = [(sx * HW, y0, z0), (sx * HW, y0, z1), (sx * HW, roof_y(z1) - 0.03, z1)]
            if z0 < RIDGE_Z < z1:
                pts.append((sx * HW, RIDGE_Y - 0.03, RIDGE_Z))
            pts.append((sx * HW, roof_y(z0) - 0.03, z0))
            panel(k, W, pts, tone(lo=0.35), uv=(2, 1), uv_len=1.5)
        # A batten across the boards at the counter's height and a rope coil hung outside.
        k.beam((sx * (HW + 0.03), 1.0, -HD), (sx * (HW + 0.03), 1.0, HD), 0.06, 0.1, 0.0, W, POST, uv_len=2.0)
        coil = [(sx * (HW + 0.07), 1.85 + 0.2 * math.sin(a), -0.4 + 0.2 * math.cos(a)) for a in np.linspace(0, math.tau * 2.6, 22)]
        k.tube(coil, 0.03, Mr, ROPE, n=4, v_len=0.12)


def counter(k, W, Mp, Mpane, Mg):
    # The body, its face of upright boards toward the guests, a kick at its foot, a thick pale top.
    box(k, ((CX0 + CX1) / 2, (TOP_Y - 0.06) / 2, 1.05), (CX1 - CX0, TOP_Y - 0.06, 0.9), W, mix(DARK, POST, 0.4), uv_len=2.0, v_axis=0)
    n = 28
    for i in range(n):
        x0, x1 = CX0 + i * (CX1 - CX0) / n, CX0 + (i + 1) * (CX1 - CX0) / n - 0.012
        panel(k, W, [(x0, 0.1, HD + 0.006), (x1, 0.1, HD + 0.006), (x1, TOP_Y - 0.07, HD + 0.006), (x0, TOP_Y - 0.07, HD + 0.006)],
              tone(LIGHT, "#c9a57a", 0.0, 1.0), uv=(0, 1), uv_len=1.2)
    box(k, ((CX0 + CX1) / 2, 0.05, HD + 0.01), (CX1 - CX0, 0.1, 0.06), W, INK)
    box(k, ((CX0 + CX1) / 2 - 0.03, TOP_Y - 0.035, 1.17), (CX1 - CX0 + 0.06, 0.07, 1.25), W, HINOKI, r=0.025, uv_len=2.5, v_axis=0)
    # The fish case along the chef's side: a glass case, a white tray, slabs of fish and a few prawns.
    for x0, x1 in ((-2.65, 0.5), (0.6, 3.75)):
        cx = (x0 + x1) / 2
        box(k, (cx, TOP_Y + 0.015, 0.82), (x1 - x0, 0.03, 0.34), Mp, "#f3f1ea")
        box(k, (cx, TOP_Y + 0.11, 0.82), (x1 - x0 + 0.02, 0.18, 0.36), Mpane, "#dff3f6", r=0.02)
        x = x0 + 0.12
        while x < x1 - 0.15:
            col = ["#f08a5a", "#d8394a", "#f6efe4", "#f2c95c", "#e86f6f"][rng.integers(0, 5)]
            w = rng.uniform(0.18, 0.3)
            box(k, (x + w / 2, TOP_Y + 0.06, 0.82), (w, 0.06, 0.2), Mp, col, r=0.015)
            x += w + 0.06
    # The guests' places: a soy pot, a tea cup and a menu card at each, a board of nigiri at some.
    for i, sx in enumerate(SEATS):
        z = 1.62
        k.lathe((sx + 0.32, TOP_Y, z), [(0.0, 0.0), (0.05, 0.0), (0.055, 0.08), (0.02, 0.12), (0.0, 0.13)], Mg, "#d9d3c4", n=6)
        k.lathe((sx - 0.25, TOP_Y, z + 0.02), [(0.0, 0.0), (0.04, 0.0), (0.05, 0.09), (0.042, 0.09), (0.0, 0.01)], Mp, ["#6f8f73", "#c9a46a", "#8a6c9a"][i % 3], n=6)
        box(k, (sx + 0.42, TOP_Y + 0.07, z - 0.08), (0.1, 0.13, 0.02), Mp, "#3a62b4", rot=K.game_rot(pitch=-0.25))
        if i in (1, 3, 4):
            box(k, (sx, TOP_Y + 0.025, z - 0.02), (0.36, 0.04, 0.16), W, "#c8945c")
            for j in range(3):
                x = sx - 0.11 + j * 0.11
                box(k, (x, TOP_Y + 0.065, z - 0.02), (0.08, 0.04, 0.05), Mp, "#fbf8f0", r=0.015)
                box(k, (x, TOP_Y + 0.09, z - 0.02), (0.09, 0.02, 0.06), Mp, ["#f08a5a", "#d8394a", "#f2c95c"][j], r=0.008)


def stools(k, W, Mc, Mr):
    for x in SEATS:
        z = SEAT_Z
        for a in (0.4, 0.4 + math.tau / 3, 0.4 + 2 * math.tau / 3):     # three splayed legs
            k.beam((x + 0.2 * math.cos(a), FLOOR, z + 0.2 * math.sin(a)), (x + 0.1 * math.cos(a), SEAT_TOP - 0.08, z + 0.1 * math.sin(a)),
                   0.05, 0.05, 0.0, W, POST, uv_len=1.0)
        k.tube([(x + 0.15 * math.cos(a), 0.25, z + 0.15 * math.sin(a)) for a in np.linspace(0, math.tau, 7)[:-1]], 0.016, Mr, ROPE, n=4,
               v_len=0.1, closed_path=True)
        k.lathe((x, SEAT_TOP - 0.1, z), [(0.0, 0.0), (0.17, 0.0), (0.18, 0.04), (0.0, 0.04)], W, mix(POST, DARK, 0.5), n=10)
        k.lathe((x, SEAT_TOP - 0.06, z), [(0.0, 0.0), (0.18, 0.0), (0.19, 0.035), (0.15, 0.06), (0.0, 0.065)], Mc, RED, n=10)


def kitchen(k, W, Mp, Mg, Ms):
    # The back counter under the window: a board cabinet, a pale top; on it a rice tub, a cutting board with a fish,
    # stacked plates, a teapot and a knife block. Shelves on the side walls with bowls.
    zc = -HD + 0.3
    box(k, (0, 0.45, zc), (2 * HW - 0.1, 0.9, 0.48), W, mix(DARK, POST, 0.3), uv_len=2.0, v_axis=0)
    box(k, (0, 0.92, zc + 0.02), (2 * HW - 0.08, 0.05, 0.54), W, HINOKI, r=0.015, uv_len=2.0, v_axis=0)
    for i in range(5):  # cabinet doors
        x = -3.2 + i * 1.6
        panel(k, W, [(x - 0.7, 0.12, zc + 0.245), (x + 0.7, 0.12, zc + 0.245), (x + 0.7, 0.8, zc + 0.245), (x - 0.7, 0.8, zc + 0.245)],
              tone(LIGHT, KITCHEN, 0.0, 1.0), uv=(0, 1))
    k.lathe((-1.6, 0.945, zc), [(0.0, 0.0), (0.3, 0.0), (0.34, 0.14), (0.31, 0.14), (0.27, 0.03), (0.0, 0.03)], W, "#b07a46", n=12)
    k.blob((-1.6, 0.99, zc), (0.26, 0.06, 0.26), Ms, "#f7f5ee", segs=10, rings=4, flat_bottom=0.0)
    box(k, (0.3, 0.97, zc), (0.62, 0.05, 0.36), W, "#e9cf9e")
    k.blob((0.3, 1.04, zc), (0.22, 0.06, 0.08), Mp, "#7b9bb3", segs=8, rings=4)
    box(k, (0.18, 1.06, zc), (0.2, 0.04, 0.1), Mp, "#f08a5a", r=0.01)
    for j in range(4):
        k.lathe((1.5, 0.945 + j * 0.035, zc), [(0.0, 0.0), (0.13, 0.0), (0.16, 0.03), (0.0, 0.03)], Mp, "#f1ece2" if j % 2 else "#2f4f7a", n=10)
    k.lathe((2.4, 0.945, zc), [(0.0, 0.0), (0.09, 0.0), (0.11, 0.08), (0.08, 0.15), (0.03, 0.17), (0.0, 0.17)], Mp, "#3e5a4a", n=8)
    box(k, (-0.6, 1.02, zc - 0.1), (0.16, 0.16, 0.1), W, INK)
    for j in range(3):
        box(k, (-0.65 + j * 0.05, 1.15, zc - 0.1), (0.02, 0.1, 0.03), Mp, "#c9ced3")
    for sx in (-1, 1):
        x = sx * (HW - 0.17)
        for y in (1.55, 2.05):
            box(k, (x, y, -0.2), (0.3, 0.04, 1.4), W, mix(DARK, LIGHT, 0.7), uv_len=1.5, v_axis=2)
            for j in range(3):
                k.lathe((x, y + 0.02, -0.65 + j * 0.42), [(0.0, 0.0), (0.06, 0.0), (0.1, 0.08), (0.0, 0.08)], Mp,
                        ["#f1ece2", "#2f4f7a", "#b8462f"][(j + (y > 2)) % 3], n=8)
    # A sake cask on a stand by the right shelf.
    k.lathe((3.55, 0.0, 0.8), [(0.0, 0.0), (0.24, 0.0), (0.28, 0.25), (0.28, 0.4), (0.24, 0.62), (0.0, 0.62)], Mp, "#f1ece2", n=10)
    for y in (0.08, 0.54):
        k.lathe((3.55, y, 0.8), [(0.25, -0.03), (0.28, 0.0), (0.25, 0.03)], Mp, RED, n=10)


def bottles(k, Mg, Mp):
    """Sake bottles along the shelf over the window, either side of the fan, between the speakers."""
    for side in (-1, 1):
        for i in range(10):
            x = side * (0.92 + i * 0.235) + rng.uniform(-0.02, 0.02)
            h, r = rng.uniform(0.3, 0.42), rng.uniform(0.05, 0.06)
            col = ["#3f7a4f", "#6a3f22", "#284a6a", "#a7b49a", "#4f6a2f"][rng.integers(0, 5)]
            z = -HD + 0.13
            k.lathe((x, SHELF_Y, z), [(0.0, 0.0), (r, 0.0), (r, h * 0.6), (0.024, h * 0.82), (0.021, h), (0.0, h)], Mg, col, n=6)
            k.lathe((x, SHELF_Y, z), [(r * 1.05, h * 0.18), (r * 1.05, h * 0.5)], Mp, ["#f2ead8", "#e8d9a8", "#d84a3a"][rng.integers(0, 3)], n=6, phase=0.5)


def speaker_frame(sx):
    """The speaker at one end of the shelf: its centre, turned in and tipped down toward the guests."""
    c = np.array((sx * 3.62, SHELF_Y + 0.33, -HD + 0.04))
    return c, K.game_rot(yaw=-sx * 0.3, pitch=0.18)


def speakers(k, Mp):
    from mathutils import Vector
    for sx in (-1, 1):
        c, R = speaker_frame(sx)
        box(k, tuple(c), (0.56, 0.64, 0.42), Mp, "#26262c", r=0.035, rot=R)
        fwd = R @ Vector((0, 0, 1))
        for (oy, rad) in ((-0.07, 0.2), (0.21, 0.06)):
            p = Vector(tuple(c)) + R @ Vector((0, oy, 0.215))
            k.lathe(tuple(p), [(rad, 0.0), (rad * 0.92, 0.02), (rad * 0.3, -0.03), (rad * 0.28, 0.0), (0.0, 0.02)], Mp, "#3a3b42",
                    d=tuple(fwd), n=10)
            k.lathe(tuple(p), [(rad * 1.06, -0.005), (rad * 1.06, 0.012), (rad * 0.94, 0.012)], Mp, "#8d8f96", d=tuple(fwd), n=10)


def fan(k, Mp, Mc):
    """The big red festival fan over the window's middle: pleated paper on dark ribs, a gold rim, a white sun."""
    cx, cy, cz, R, r0, n = 0.0, BEAM_Y + 0.12, -HD + 0.24, 0.82, 0.14, 16
    rim = []
    for i in range(n):
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        d0, d1 = (0.035 if i % 2 else 0.0), (0.0 if i % 2 else 0.035)
        p = lambda a, rr, d: (cx + rr * math.cos(a), cy + rr * math.sin(a), cz + d)
        col = RED if i % 2 else RED_DEEP
        k.face([k.vert(p(a0, r0, d0)), k.vert(p(a1, r0, d1)), k.vert(p(a1, R, d1)), k.vert(p(a0, R, d0))], [(0, 0)] * 4, Mc, col)
        rim.append(p(a0, R, d0))
    rim.append((cx - R, cy, cz))
    k.tube(rim, 0.018, Mp, "#d6a84a", n=4, v_len=0.3)
    for i in range(0, n + 1, 2):
        a = math.pi * i / n
        k.tube([(cx + 0.05 * math.cos(a), cy + 0.05 * math.sin(a), cz - 0.01), (cx + R * math.cos(a), cy + R * math.sin(a), cz - 0.01)],
               0.01, Mp, "#3a2418", n=3, v_len=0.3)
    sun = [k.vert((cx + 0.2 * math.cos(a), cy + 0.47 + 0.2 * math.sin(a), cz + 0.04)) for a in np.linspace(0, math.tau, 13)[:-1]]
    k.face(sun, [(0, 0)] * 12, Mp, "#f6f0e2")
    dot = [k.vert((cx + 0.1 * math.cos(a), cy + 0.47 + 0.1 * math.sin(a), cz + 0.045)) for a in np.linspace(0, math.tau, 9)[:-1]]
    k.face(dot, [(0, 0)] * 8, Mp, "#e8a83a")
    box(k, (cx, cy - 0.04, cz + 0.02), (0.12, 0.14, 0.06), Mp, "#3a2418", r=0.02)


def cloth_grid(k, Mc, f, nu, nv, col_of):
    """A cloth surface: f(u, v) -> game point over a nu x nv grid, coloured per row."""
    pts = [[k.vert(f(i / nu, j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            k.face([pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]], [(i / nu, j / nv), ((i + 1) / nu, j / nv),
                   ((i + 1) / nu, (j + 1) / nv), (i / nu, (j + 1) / nv)], Mc, col_of(j / nv))


def drapes(k, Mc):
    # Swags along the front header between the piles, tails hanging at each pile.
    posts, top, z = (-4.3, -1.5, 1.5, 4.3), HEADER_Y + 0.08, HEADER_Z + 0.13
    for a, b in zip(posts, posts[1:]):
        def swag(u, v, a=a, b=b):
            drop = 0.12 + 0.34 * math.sin(math.pi * u)
            return (a + (b - a) * u, top - v * drop, z + v * (0.06 * math.sin(math.pi * u) + 0.025 * math.sin(u * math.tau * 4)))
        cloth_grid(k, Mc, swag, 12, 2, lambda t: mix(RED, RED_DEEP, t))
    for x in posts:
        cloth_grid(k, Mc, lambda u, v, x=x: (x - 0.13 + 0.26 * u, top - 0.85 * v, z + 0.03 * math.sin(u * math.tau) + 0.02 * v),
                   2, 3, lambda t: mix(RED_DEEP, RED, t))
    # Curtains tied back at the window's sides.
    for sx in (-1, 1):
        def curtain(u, v, sx=sx):
            pinch = 1.0 - 0.75 * math.exp(-((v - 0.55) / 0.18) ** 2)
            w = 0.42 * (pinch if v > 0.2 else 1.0)
            x = sx * (WIN_X - 0.1) - sx * w * u
            return (x, BEAM_Y - 0.02 - v * (BEAM_Y - SILL_Y - 0.1), -HD + 0.15 + 0.035 * math.sin(u * math.tau * 1.5))
        cloth_grid(k, Mc, curtain, 3, 6, lambda t: mix(RED, RED_DEEP, abs(t - 0.5)))
        k.tube([(sx * (WIN_X - 0.1), BEAM_Y - 0.86, -HD + 0.18), (sx * (WIN_X - 0.24), BEAM_Y - 0.86, -HD + 0.2)], 0.02, Mc, "#d6a84a", n=4)


def signs_and_menu(k, W, Mp):
    # The neon's backing board on the left pillar, the hanging plaques of the menu on the right.
    box(k, (-(HW + WIN_X) / 2, 1.78, -HD + 0.09), (0.74, 1.24, 0.04), Mp, NAVY, r=0.012)
    x0 = WIN_X + 0.13
    box(k, ((HW + WIN_X) / 2, 2.33, -HD + 0.1), (0.78, 0.16, 0.05), W, INK)
    for row, y in enumerate((2.02, 1.5)):
        for i in range(5):
            x = x0 + 0.07 + i * 0.15
            box(k, (x, y, -HD + 0.09), (0.12, 0.44, 0.025), W, "#ead7b0" if (i + row) % 3 else "#f4ead2")
            panel(k, Mp, [(x - 0.02, y - 0.16, -HD + 0.104), (x + 0.02, y - 0.16, -HD + 0.104), (x + 0.02, y + 0.17, -HD + 0.104),
                          (x - 0.02, y + 0.17, -HD + 0.104)], INK)
            panel(k, Mp, [(x - 0.03, y - 0.2, -HD + 0.105), (x + 0.03, y - 0.2, -HD + 0.105), (x + 0.03, y - 0.17, -HD + 0.105),
                          (x - 0.03, y - 0.17, -HD + 0.105)], RED)
    # The roof sign over the front: a timber frame on two legs from the roof (its light box glows: the glow model).
    sz = 3.35
    for x in (-0.95, 0.95):
        k.beam((x, roof_y(sz), sz), (x, 4.25, sz), 0.1, 0.1, 0.0, W, POST, uv_len=1.2)
    box(k, (0, 3.92, sz), (1.9, 0.62, 0.08), W, POST)
    fish = [(0.55, 0.0), (0.3, 0.13), (-0.05, 0.15), (-0.35, 0.06), (-0.55, 0.16), (-0.5, 0.0), (-0.55, -0.16), (-0.35, -0.06),
            (-0.05, -0.15), (0.3, -0.13)]
    k.extrude(fish, sz + 0.075, sz + 0.095, Mp, INK, at=(0, 3.92, 0))
    for x in (-0.82, 0.78):
        k.lathe((x, 3.92, sz + 0.075), [(0.0, 0.0), (0.06, 0.0), (0.06, 0.02), (0.0, 0.02)], Mp, INK, d=(0, 0, 1), n=8)
    # The chalk menu on an easel at the deck's left front.
    ex, ez = -3.75, 3.45
    for sx in (-1, 1):
        k.beam((ex + sx * 0.28, FLOOR, ez + 0.12), (ex + sx * 0.24, 1.25, ez - 0.05), 0.05, 0.05, 0.0, W, POST)
    k.beam((ex, FLOOR, ez - 0.35), (ex, 1.1, ez - 0.05), 0.04, 0.04, 0.0, W, POST)
    box(k, (ex, 0.85, ez + 0.03), (0.55, 0.72, 0.03), Mp, "#2b3a33", rot=K.game_rot(yaw=0.0, pitch=-0.17))
    for j in range(4):
        y = 1.05 - j * 0.13
        panel(k, Mp, [(ex - 0.2, y, ez + 0.05 + (1.05 - y) * 0.17), (ex + 0.1 - 0.05 * (j % 2), y, ez + 0.05 + (1.05 - y) * 0.17),
                      (ex + 0.1 - 0.05 * (j % 2), y + 0.025, ez + 0.05 + (1.025 - y) * 0.17), (ex - 0.2, y + 0.025, ez + 0.05 + (1.025 - y) * 0.17)],
              "#f1eee4")


def tank(k, W, Mp, Mpane, Ms):
    """The fish tank at the counter's left end: a cabinet, a tank framed in black, sand, coral and weed, still fish."""
    x0, x1, z0, z1 = TANK
    cx, cz, y0, y1 = (x0 + x1) / 2, (z0 + z1) / 2, 0.84, 1.66
    box(k, (cx, y0 / 2, cz), (x1 - x0, y0, z1 - z0), W, mix(DARK, POST, 0.5), uv_len=1.2)
    for (a, b) in (((x0, y0, z1), (x1, y0, z1)), ((x0, y1, z1), (x1, y1, z1)), ((x1, y0, z0), (x1, y0, z1)), ((x1, y1, z0), (x1, y1, z1)),
                   ((x1, y0, z1), (x1, y1, z1)), ((x0, y0, z1), (x0, y1, z1)), ((x1, y0, z0), (x1, y1, z0))):
        k.beam(a, b, 0.035, 0.035, 0.0, Mp, "#1f2124")
    box(k, (cx, y1 + 0.05, cz), (x1 - x0 + 0.04, 0.09, z1 - z0 + 0.04), Mp, "#1f2124", r=0.02)
    box(k, (cx, y0 + 0.05, cz), (x1 - x0 - 0.04, 0.1, z1 - z0 - 0.04), Ms, "#e6d3a6")
    panel(k, Mpane, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], "#e8f6f8")
    panel(k, Mpane, [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], "#e8f6f8")
    for (x, z, col) in ((-3.75, 0.75, "#ef8f8f"), (-3.3, 0.7, "#f2a04a"), (-3.55, 1.1, "#9b6cc4")):
        k.blob((x, y0 + 0.1, z), (0.1, 0.12, 0.08), Ms, col, segs=6, rings=4, seed=int(-x * 10), lumpy=0.35, flat_bottom=0.0)
    for j, (x, z) in enumerate(((-3.85, 0.62), (-3.2, 0.95), (-3.45, 0.58))):
        k.tube([(x, y0 + 0.1, z), (x + 0.04, y0 + 0.3, z), (x - 0.03, y0 + 0.5, z), (x + 0.02, y0 + 0.62, z)], 0.02, Ms, "#4f9a5a", n=4,
               radii=[1.0, 0.9, 0.7, 0.4])
    for j, (x, y, z, col, sc) in enumerate(((-3.6, 1.3, 1.15, "#f28a3a", 1.0), (-3.3, 1.12, 0.9, "#3a7ad8", 1.1), (-3.75, 1.45, 0.85, "#f2d04a", 0.9),
                                             (-3.35, 1.5, 1.25, "#f28a3a", 0.8), (-3.8, 1.05, 1.2, "#e8e4da", 0.85))):
        d = 1 if j % 2 else -1
        k.blob((x, y, z), (0.07 * sc, 0.045 * sc, 0.025 * sc), Mp, col, segs=6, rings=4)
        t = [k.vert((x - d * 0.06 * sc, y, z)), k.vert((x - d * 0.12 * sc, y + 0.04 * sc, z)), k.vert((x - d * 0.12 * sc, y - 0.04 * sc, z))]
        k.face(t, [(0, 0)] * 3, Mp, col)


def plants(k, Mp, W):
    """Potted palms at the deck's front corners: a glazed pot, broad drooping leaves."""
    for sx in (-1, 1):
        x, z = sx * 3.95, 3.7
        if sx < 0:
            x, z = -4.1, 2.35
        k.lathe((x, FLOOR, z), [(0.0, 0.0), (0.16, 0.0), (0.22, 0.32), (0.24, 0.36), (0.2, 0.37), (0.0, 0.33)], Mp, "#2f6f8a", n=10)
        for i in range(7):
            a = i * math.tau / 7 + 0.3
            base = np.array((x, FLOOR + 0.34, z))
            d = np.array((math.cos(a), 0.0, math.sin(a)))
            L = rng.uniform(0.55, 0.75)
            spine = [base + d * L * t + np.array((0, 0.9 * t - 0.75 * t * t, 0)) * L * 1.6 for t in np.linspace(0, 1, 5)]
            side = np.cross(d, (0, 1, 0))
            left = [tuple(p + side * 0.12 * math.sin(math.pi * t) + np.array((0, 0.02, 0))) for p, t in zip(spine, np.linspace(0, 1, 5))]
            right = [tuple(p - side * 0.12 * math.sin(math.pi * t) + np.array((0, 0.02, 0))) for p, t in zip(spine, np.linspace(0, 1, 5))]
            mid = [tuple(p) for p in spine]
            col = mix("#3f8a3a", "#7cc05a", rng.uniform(0.0, 0.6))
            for j in range(4):
                for strip in ((left, mid), (mid, right)):
                    k.face([k.vert(strip[0][j]), k.vert(strip[0][j + 1]), k.vert(strip[1][j + 1]), k.vert(strip[1][j])], [(0, 0)] * 4, Mp, col)


def pane_glass():
    """A see-through glass (alpha blended in the GLB) for the fish case and the tank."""
    M = K.Mat("M_PaneGlass", rough=0.08)
    b = next(n for n in M.m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Alpha"].default_value = 0.2
    for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try:
            setattr(M.m, attr, val)
        except (AttributeError, TypeError):
            pass
    return M


def bar(M):
    k = K.Kit("sushi-bar")
    floor_and_frame(k, M["wood"], M["rope"], M["glass"])
    roof(k, M["wood"], M["rope"])
    walls(k, M["wood"], M["rope"])
    counter(k, M["wood"], M["paint"], M["pane"], M["glass"])
    stools(k, M["wood"], M["cloth"], M["rope"])
    kitchen(k, M["wood"], M["paint"], M["glass"], M["stone"])
    bottles(k, M["glass"], M["paint"])
    speakers(k, M["paint"])
    fan(k, M["paint"], M["cloth"])
    drapes(k, M["cloth"])
    signs_and_menu(k, M["wood"], M["paint"])
    tank(k, M["wood"], M["paint"], M["pane"], M["stone"])
    plants(k, M["paint"], M["wood"])
    k.tint_gradient(0.86, 1.0, 0.0, RIDGE_Y)
    return k.finish(smooth_deg=40)


# ================================================================ what glows
LANTERNS = [(-3.0, 1.5, "red", 0.27), (-1.0, 1.5, "lantern", 0.3), (1.0, 1.5, "lantern", 0.3), (3.0, 1.5, "red", 0.27),
            (-2.9, HEADER_Z - 0.2, "lantern", 0.22), (0.0, HEADER_Z - 0.2, "red", 0.24), (2.9, HEADER_Z - 0.2, "lantern", 0.22)]


def glow(M):
    G, Mp = M["glow"], M["paint"]
    k = K.Kit("sushi-bar-glow")
    # Round paper lanterns, ribbed, black lacquer caps, hung by a cord from the beam over them.
    for x, z, key, r in LANTERNS:
        hang = PLATE_Y - 0.08 if z < 2 else HEADER_Y - 0.12
        cy = hang - 0.2 - r
        prof = []
        for i in range(10):
            a = -math.pi / 2 + math.pi * (0.12 + 0.76 * i / 9)
            rr = r * math.cos(a) * (0.94 if i % 2 else 1.0)
            prof.append((rr, r * 1.05 * math.sin(a)))
        glow_uv(k, k.lathe((x, cy, z), prof, G, "#ffffff", n=10), key)
        for s in (-1, 1):
            k.lathe((x, cy + s * r * 0.95, z), [(0.0, -0.03), (r * 0.42, -0.03), (r * 0.42, 0.03), (0.0, 0.03)], Mp, INK, n=10)
        k.tube([(x, hang, z), (x, cy + r * 0.98, z)], 0.008, Mp, INK, n=3)
        if z < 2:   # a red tassel under the counter's lanterns
            k.tube([(x, cy - r * 0.98, z), (x, cy - r - 0.16, z)], 0.02, Mp, RED, n=4, radii=[0.6, 1.2])
    # String lights in sagging runs along the front, bulbs in four colours.
    posts, y = (-4.3, -1.5, 1.5, 4.3), HEADER_Y - 0.14
    keys = ["bulb", "pink", "bulb", "cyan", "bulb", "green"]
    b = 0
    for a, c in zip(posts, posts[1:]):
        pts = [(a + (c - a) * t, y - 0.3 * math.sin(math.pi * t), HEADER_Z + 0.16) for t in np.linspace(0, 1, 10)]
        k.tube(pts, 0.008, Mp, INK, n=3)
        for t in np.linspace(0.08, 0.92, 8):
            p = (a + (c - a) * t, y - 0.3 * math.sin(math.pi * t) - 0.05, HEADER_Z + 0.16)
            glow_uv(k, k.blob(p, (0.035, 0.05, 0.035), G, segs=5, rings=3), keys[b % len(keys)])
            b += 1
    # The neon on the left pillar: a fish over two waves, and the speakers' neon trim.
    nx, ny, nz = -(HW + WIN_X) / 2, 1.95, -HD + 0.13
    fish = []
    for t in np.linspace(0, math.tau, 19)[:-1]:
        fish.append((nx + 0.24 * math.cos(t) + 0.04, ny + 0.12 * math.sin(t) * (1 - 0.35 * math.cos(t)), nz))
    neon = []
    neon += k.tube(fish, 0.016, G, closed_path=True, n=5)
    neon += k.tube([(nx - 0.2, ny, nz), (nx - 0.32, ny + 0.1, nz), (nx - 0.32, ny - 0.1, nz), (nx - 0.2, ny, nz)], 0.016, G, n=5)
    glow_uv(k, neon, "pink")
    eye = k.blob((nx + 0.17, ny + 0.03, nz), (0.022, 0.022, 0.022), G, segs=5, rings=3)
    glow_uv(k, eye, "pink")
    waves = []
    for j, yy in enumerate((1.6, 1.42)):
        waves += k.tube([(nx - 0.26 + 0.52 * t, yy + 0.04 * math.sin(t * math.tau * 1.5 + j), nz) for t in np.linspace(0, 1, 12)], 0.014, G, n=5)
    glow_uv(k, waves, "cyan")
    bubbles = []
    for (bx, by, br) in ((0.32, 0.17, 0.03), (0.36, 0.29, 0.022), (0.3, 0.38, 0.016)):
        bubbles += k.tube([(nx + bx + br * math.cos(t), ny + by + br * math.sin(t), nz) for t in np.linspace(0, math.tau, 9)[:-1]], 0.007, G,
                          closed_path=True, n=4)
    glow_uv(k, bubbles, "cyan")
    from mathutils import Vector
    for sx in (-1, 1):
        c, R = speaker_frame(sx)
        corners = [Vector(tuple(c)) + R @ Vector((u * 0.26, v * 0.3, 0.215)) for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        glow_uv(k, k.tube([tuple(p) for p in corners], 0.013, G, closed_path=True, n=4), "pink")
    # The roof sign's light box (the fish and the frame are the still model's).
    glow_uv(k, k.rbox((0, 3.92, 3.35 + 0.05), (1.72, 0.46, 0.04), 0.0, G, segs=1), "sign")
    # Warm light strips (the coordinator, for the night: a homey glow inside): under the bottle shelf's lip, under the
    # counter top's front edge over the stools, and along the fish case's lid.
    glow_uv(k, k.rbox((0, SHELF_Y - 0.06, -HD + 0.27), (2 * HW, 0.025, 0.03), 0.0, G, segs=1), "bulb")
    glow_uv(k, k.rbox(((CX0 + CX1) / 2, TOP_Y - 0.08, 1.74), (CX1 - CX0 - 0.1, 0.02, 0.03), 0.0, G, segs=1), "lantern")
    for x0, x1 in ((-2.65, 0.5), (0.6, 3.75)):
        glow_uv(k, k.rbox(((x0 + x1) / 2, TOP_Y + 0.185, 0.9), (x1 - x0 - 0.1, 0.012, 0.04), 0.0, G, segs=1), "bulb")
    # The tank's water: its back and its wall side, lit from within at night.
    x0, x1, z0, z1 = TANK
    water = [k.quad([(x0 + 0.01, 0.9, z0 + 0.02), (x1, 0.9, z0 + 0.02), (x1, 1.6, z0 + 0.02), (x0 + 0.01, 1.6, z0 + 0.02)], G),
             k.quad([(x0 + 0.02, 0.9, z1), (x0 + 0.02, 0.9, z0), (x0 + 0.02, 1.6, z0), (x0 + 0.02, 1.6, z1)], G),
             k.quad([(x0, 1.6, z0), (x1, 1.6, z0), (x1, 1.6, z1), (x0, 1.6, z1)], G)]
    glow_uv(k, water, "water")
    return k.finish(smooth_deg=50)


def glow_mat():
    keys = GLOW_KEYS
    w = 16
    base = np.zeros((16, w * len(keys), 3))
    emit = np.zeros_like(base)
    for i, key in enumerate(keys):
        base[:, i * w:(i + 1) * w] = K.hexrgb(GLOWS[key][0])
        emit[:, i * w:(i + 1) * w] = K.hexrgb(GLOWS[key][1])
    return K.Mat("M_Glow", tex=K.image("sushi_glow_base", base), emit=K.image("sushi_glow", emit), rough=0.6)


def build():
    K.reset()
    M = {"wood": wood_mat("M_DecorWood", 2614), "rope": K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0),
         "paint": K.Mat("P_Paint", rough=0.45), "cloth": K.Mat("P_Cloth", rough=1.0), "glass": K.Mat("P_Glass", rough=0.08),
         "stone": K.Mat("P_Stone", rough=0.95), "pane": pane_glass(), "glow": glow_mat()}
    out = {}
    for name, fn in (("sushi-bar", bar), ("sushi-bar-glow", glow)):
        ob = fn(M)
        K.export([ob], f"game/buildings/{name}.glb")
        report(ob)
        out[name] = ob
    return out


# ================================================================ review renders
def review(obs, out_dir):
    """Day from the beach (front three-quarter), from the sea (the back), a stool's view across the counter, and the
    same at night with the glow on."""
    import bpy
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE"
    sc.view_settings.view_transform = "Standard"
    shown = list(obs.values())
    K.show_vertex_colors(shown)
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    sun = bpy.data.lights.new("Key", "SUN")
    so = bpy.data.objects.new("Key", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-150))
    # A sand ground and a sea band behind, so the window frames something.
    me = bpy.data.meshes.new("ground")
    me.from_pydata([K.G(-30, -0.01, -3), K.G(30, -0.01, -3), K.G(30, -0.01, 30), K.G(-30, -0.01, 30)], [], [(0, 1, 2, 3)])
    sea = bpy.data.meshes.new("sea")
    sea.from_pydata([K.G(-60, -0.4, -3), K.G(60, -0.4, -3), K.G(60, -0.4, -80), K.G(-60, -0.4, -80)], [], [(0, 1, 2, 3)])
    for mesh, col in ((me, "#e9d7ad"), (sea, "#3aa6c4")):
        m = bpy.data.materials.new(mesh.name)
        m.diffuse_color = (*K.lin(col), 1)
        m.use_nodes = True
        next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*K.lin(col), 1)
        mesh.materials.append(m)
        o = bpy.data.objects.new(mesh.name, mesh)
        sc.collection.objects.link(o)
    glow_b = next(n for n in bpy.data.materials["M_Glow"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    cam = bpy.data.cameras.new("C")
    co = bpy.data.objects.new("C", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    shots = {"front": ((7.5, 4.2, 13.5), (0.0, 1.8, 0.8), 30, (1200, 800)),
             "back": ((-6.0, 3.6, -11.0), (0.0, 1.9, 0.0), 30, (1200, 800)),
             "seat": ((0.6, 1.3, 2.75), (0.3, 1.75, -2.0), 20, (1200, 700))}
    frames = []
    for night in (False, True):
        bg.inputs[0].default_value = (*K.lin("#12203f" if night else "#bfe3f2"), 1)
        bg.inputs[1].default_value = 0.35 if night else 1.0
        sun.energy = 0.15 if night else 3.0
        sun.color = (0.6, 0.7, 1.0) if night else (1.0, 0.95, 0.88)
        glow_b.inputs["Emission Strength"].default_value = 3.0 if night else 0.0
        for name, (at, look, lens, (w, h)) in shots.items():
            if night and name == "back":
                continue
            cam.lens = lens
            sc.render.resolution_x, sc.render.resolution_y = w, h
            co.location = K.G(*at)
            co.rotation_euler = (K.G(*look) - K.G(*at)).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = os.path.join(out_dir, f"sushi-bar-{name}{'-night' if night else ''}.png")
            bpy.ops.render.render(write_still=True)
            frames.append(sc.render.filepath)
    print("REVIEW", frames)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        review(obs, ARGS[ARGS.index("review") + 1])
