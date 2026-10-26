"""The new world's sushi bar (game/sushi-bar; David's R2c note: "a long horizontal bar, reference bancho sushi in dave the
diver ... the decore is similar to wharf, its a really big open bar where you can sit down ... it has festive lighting
inside, it back of the bar is open window to see beatiful view in the back, 1-2 sushi npc making sushi", and with the
pictures: "good decore, speaker with music, lights and fishtank"; specs/references/terrain/sushi-bar-2026-10-26/).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/build_sushi_bar.py [-- review <dir>]
  (on the shared Mac mini: under withlock.sh blender, headless only)

Writes, in game units at scale 1, the origin on the ground at the middle of the solid core (counter and kitchen,
x +-4, z +-1.5: defaultIsland PROP_FOOTPRINT), the front (the guests' side) toward +z:
  game/buildings/sushi-bar.glb       the bar, still (merged with the world's still props): a plank deck under a gabled
                                     plank roof on rope-lashed piles, the wharf's wood and rope; a long counter with a
                                     glass fish case, six stools before it (seats SEATS, tops at SEAT_TOP), the kitchen
                                     behind it, and a wide open window in the back wall onto the sea; sake bottles along
                                     the beam over the window, speakers at its ends, a big red fan between, red drapes
                                     along the front and curtains at the window, a wooden menu of hanging plaques, a fish
                                     tank at the counter's end, posters on the side walls, potted palms on the deck, a
                                     sign on the roof, today's menu on its easel out on the landing.
  game/buildings/sushi-bar-pier.glb  still too, placed with the bar (David's plan, specs/launch/sushi-bar.md: "on stilts
                                     on the water"): the piles under the floor, braced; the landing before the entrance
                                     and the boardwalk down to the sand (LAND_*, WALK_*: lib/game/sushiBar.ts BAR_DECKS),
                                     rope rails on posts, lantern posts; the entrance, a lacquered gate with the bar's
                                     board on its lintel.
  game/buildings/sushi-bar-hours.glb the bar's hours, drawn by it: `shutters`, bamboo blinds over the front and the
                                     deck's sides while it's closed (rolled up to HOURS_TOP), and `noren`, the split
                                     curtain in the entrance while it's open.
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
sys.path.insert(0, HERE)
import propkit as K  # noqa: E402
import sushi_food as F  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
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
WIN_X, SILL_Y, BEAM_Y, SHELF_Y = 3.2, 0.72, 2.5, 2.82
RAIL_Y = 1.05                                       # the side walls' cedar boards up to here, plaster over
# The back counter under the window, low so the sea shows over it from a stool (the curved world drops the far sea about
# 10 degrees under a seated eye); the raised board floor the staff stand on behind the counter (lib/game/sushiBar.ts
# STAFF_Y), high enough that their hands work the boards in the guests' view (the Craft clip's blow lands 0.585 over the
# feet, 0.63 ahead: sushiBar.ts CHEF_STATIONS stand there).
BACK_TOP, STAFF_Y = 0.7, 0.3
CX0, CX1, TOP_Y = -2.95, 4.0, 0.84                  # the counter, its top
LEDGE_Z = 0.15                                      # the chefs' work ledge behind the fish case runs back to here
# The cutting boards (x, the fish he cuts there); his geta GETA_DX to his left of each, where the nigiri are set (the
# hours model's prep-<i>, on its board prep-geta-<i>), his rice tub TUB_DX to his right.
BOARD_Z, BOARDS = 0.37, ((-1.5, "salmon"), (0.4, "tuna"))
GETA_DX, TUB_DX = 0.5, -0.45
# The fish case along the chefs' side of the counter in two runs, a serving shelf (tsuke-dai) over its back half where
# the served geta are set before each stool (lib/game/sushiBar.ts SERVED mirrors SERVE_*), the fish on ice in its front
# half under slanted glass.
CASE_Z0, CASE_Z1, CASE_TOP = 0.64, 1.0, TOP_Y + 0.11
SERVE_Z0, SERVE_Z1, SERVE_Y = 0.62, 0.82, TOP_Y + 0.14
CASE_RUNS = ((-2.65, 0.5), (0.6, 3.75))
SEAT_TOP, SEAT_Z = 0.6, 2.05                        # the stools (lib/game/sushiBar.ts SEATS mirrors these)
SEATS = [0.5 + (i - 2.5) * 1.1 for i in range(6)]
TANK = (-3.97, -3.03, 0.5, 1.45)                    # x0, x1, z0, z1
# The pier (on stilts over the water; lib/game/sushiBar.ts BAR_DECKS mirrors these): the landing before the entrance
# (walked within +-LAND_WALK), then the boardwalk to the sand (walked within +-WALK_HW), falling WALK_DROP over its
# length; the piles reach PILE_Y under the floor (the seabed is never deeper there).
LAND_Z, LAND_HW, LAND_WALK = 6.0, 2.2, 1.4
WALK_Z, WALK_HW, WALK_DROP = 12.0, 0.8, 0.4
PILE_Y = -4.0
GATE_X, GATE_Z, GATE_Y = 1.0, DECK_Z + 0.14, 2.42   # the entrance: its posts, and its lintel
HOURS_TOP = HEADER_Y - 0.13                          # the blinds' tops, what they roll up to (SushiBar.tsx HOURS_TOP)
LAMP_POSTS = [(sx * (LAND_HW - 0.08), LAND_Z - 0.08) for sx in (-1, 1)] + [(sx * (WALK_HW + 0.2), WALK_Z - 0.3) for sx in (-1, 1)]


def walk_y(z):
    """The walk's top over the floor at z along the pier (flat on the landing, then down to the sand)."""
    return -WALK_DROP * min(1.0, max(0.0, (z - LAND_Z) / (WALK_Z - LAND_Z)))

DARK, LIGHT = "#6e5137", "#a98762"                  # the wharf's weathered deck
POST = "#4a3626"                                    # dark timber
HINOKI, KITCHEN = "#e6c58f", "#b48f66"
RED, RED_DEEP, NAVY, INK = "#c3283a", "#9e1f2e", "#22314f", "#2a2420"
# Japanese (David, phase A round 2: "more japanese style ... this should be japanese"): a roof of smoked kawara tiles
# with turned-up corners, white plaster between dark timbers over charred-cedar boards.
TILE, TILE_DARK, TILE_EDGE = "#5f6976", "#3c444f", "#8a94a0"
GOLD, GOLD_DARK = "#e8b64a", "#b8862a"
PLASTER, CEDAR = "#eee5d2", "#3f322b"
# The tiles' half length along the ridge; how far the corners turn up, from where (David, round 3: "corners curl more"),
# and how far the ridge's ends sweep up under their fish (shachihoko, "the spine of the roof curl up with fish design").
ROOF_X, SORI, SORI_FROM, RIDGE_CURL = 4.8, 0.62, 2.4, 0.42

# The glow palette: one block per glow, its day colour (base) and its night colour (emission). A paper lantern's ribs
# are its own darker block, so they show lit.
GLOWS = {"lantern": ("#f5dcae", "#ffa040"), "red": ("#de4a3a", "#ff4a2a"), "bulb": ("#f7ecd0", "#ffd070"),
         "pink": ("#f3a9c9", "#ff3f9a"), "cyan": ("#aeeaf0", "#30e0ff"), "sign": ("#f2b878", "#ff8a30"),
         "water": ("#74c6da", "#1f9fd8"), "green": ("#b7e6a4", "#58ff7a"),
         "lantern-rib": ("#b8946a", "#a8541c"), "red-rib": ("#8e2a22", "#8a1a10")}
GLOW_KEYS = list(GLOWS)


def roof_y(z):
    if z >= RIDGE_Z:
        return RIDGE_Y + (FRONT_Y - RIDGE_Y) * (z - RIDGE_Z) / (FRONT_Z - RIDGE_Z)
    return RIDGE_Y + (BACK_Y - RIDGE_Y) * (RIDGE_Z - z) / (RIDGE_Z - BACK_Z)


def corner(x):
    """0 along the roof's middle, rising to 1 at its ends: how much a point at x turns up with the corners."""
    s = min(1.0, max(0.0, (abs(x) - SORI_FROM) / (ROOF_X - SORI_FROM)))
    return s * s * (3 - 2 * s) * s


def roof_pt(x, t, front, lift=0.0):
    """A point on the tiles: x along the ridge, t from the ridge (0) down to the eave (1) on the front or back slope.
    The corners turn up toward the eaves (sori), and kick out a little past the walls; the eave lifts a little all along."""
    s = corner(x)
    z = RIDGE_Z + t * ((FRONT_Z if front else BACK_Z) + (0.12 if front else -0.12) - RIDGE_Z)
    z += (1 if front else -1) * 0.16 * s * t ** 2
    return (x * (1 + 0.025 * s * t), roof_y(z) + 0.07 + lift + SORI * s * (0.2 + 0.8 * t ** 1.6) + 0.08 * t ** 3, z)


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
    # Round posts along the front (the piles carry on under the deck), dark timber; square posts at the kitchen's corners.
    for x in (-4.3, -1.5, 1.5, 4.3):
        k.lathe((x, -0.3, HEADER_Z), [(0.15, 0.0), (0.135, 0.3), (0.122, 3.25), (0.0, 3.32)], W, POST, n=8, v_len=1.2, u_tiles=0.5,
                wobble=lambda j, i: 1.0 + 0.03 * math.sin(j * 2.1 + x))
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


def roof(k, W, Mt, Mm):
    """A kawara roof: the pan tiles' bed down both slopes, rows of round cover tiles over it, each ending in a pale
    disc at the eave; the corners turned up (roof_pt); a stacked ridge sweeping up to a golden fish (shachihoko) at each end, dark
    bargeboards down the gables and a fascia along the eaves."""
    for front in (True, False):
        xs = [ROOF_X * math.copysign(abs(u) ** 0.8, u) for u in np.linspace(-1, 1, 25)]   # finer toward the turned-up ends
        nv = 5
        g = [[k.vert(roof_pt(x, j / nv, front)) for x in xs] for j in range(nv + 1)]
        for j in range(nv):
            for i in range(len(xs) - 1):
                k.face([g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]], [(i / 4, j), ((i + 1) / 4, j), ((i + 1) / 4, j + 1), (i / 4, j + 1)],
                       Mt, TILE_DARK)
        n = 21
        for i in range(n):
            x = -ROOF_X + 0.14 + i * (2 * ROOF_X - 0.28) / (n - 1)
            pts = [roof_pt(x, t, front, 0.03) for t in (0.04, 0.3, 0.55, 0.8, 1.0)]
            k.tube(pts, 0.072, Mt, mix(TILE, TILE_DARK, rng.uniform(0.0, 0.35)), n=4, v_len=0.5)
            d = np.array(pts[-1]) - np.array(pts[-2])
            k.lathe(pts[-1], [(0.078, 0.0), (0.078, 0.03), (0.0, 0.03)], Mt, TILE_EDGE, d=tuple(d / np.linalg.norm(d)), n=6)
        eave = [roof_pt(x, 1.0, front, -0.06) for x in xs[::2]]
        k.tube(eave, 0.075, W, POST, n=4, v_len=1.5)
        for sx in (-1, 1):   # the bargeboards down the gables
            edge = [roof_pt(sx * (ROOF_X + 0.02), t, front, -0.1) for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
            for a, b in zip(edge, edge[1:]):
                k.beam(a, b, 0.07, 0.24, 0.0, W, POST, uv_len=1.5)
    # The ridge: a course of flat tiles, a round crown over it, sweeping up at its ends (RIDGE_CURL), a golden fish
    # (shachihoko) riding each end, its tail flung up.
    ridge = []
    for u in np.linspace(-1, 1, 17):
        x, y, z = roof_pt(ROOF_X * u, 0.0, True)
        ridge.append((x, y + RIDGE_CURL * abs(u) ** 5, z))
    k.tube([(x, y + 0.05, z) for x, y, z in ridge], 0.17, Mt, TILE_DARK, n=4, v_len=1.0, caps=True)
    k.tube([(x, y + 0.24, z) for x, y, z in ridge], 0.11, Mt, TILE, n=8, v_len=1.0, caps=True)
    for end in (ridge[0], ridge[-1]):
        out = math.copysign(1, end[0])
        shachihoko(k, Mm, (end[0] - out * 0.32, end[1] + 0.3, end[2]), -out)


def shachihoko(k, M, at, inward):
    """A golden carp-tiger on the ridge's end (in our style): its head down on the ridge facing out, its body arched,
    its tail fanned high over its back, curling inward; a dorsal crest, pectoral fins, eyes and whiskers. Gold (P_Metal)."""
    Mg = M
    x0, y0, z0 = at
    out = -inward
    P = lambda u, v, w=0.0: (x0 + out * u * 1.35, y0 + v * 1.35, z0 + w * 1.35)
    spine = [P(0.16, 0.05), P(0.06, 0.14), P(-0.06, 0.3), P(-0.1, 0.48), P(-0.05, 0.62), P(0.04, 0.7)]
    k.tube(spine, 0.15, Mg, GOLD, n=8, radii=[0.95, 1.1, 1.0, 0.75, 0.5, 0.32], caps=True, v_len=0.3)
    # The head: a broad snout, the mouth open a little, eyes, barbels.
    k.blob(P(0.2, 0.07), (0.135, 0.115, 0.135), Mg, GOLD, segs=8, rings=5)
    k.blob(P(0.29, 0.04), (0.047, 0.04, 0.074), Mg, GOLD_DARK, segs=7, rings=4)
    for w in (-1, 1):
        k.blob(P(0.24, 0.12, w * 0.07), (0.038, 0.04, 0.03), Mg, "#f6f0dc", segs=7, rings=4)
        k.blob(P(0.255, 0.122, w * 0.085), (0.016, 0.022, 0.014), Mg, INK, segs=6, rings=3)
        k.tube([P(0.28, 0.05, w * 0.05), P(0.33, 0.08, w * 0.12), P(0.31, 0.14, w * 0.16)], 0.008, Mg, GOLD_DARK, n=3, radii=[1.0, 0.8, 0.5])
        # A pectoral fin swept back from behind the head.
        k.face([k.vert(P(0.1, 0.12, w * 0.09)), k.vert(P(-0.02, 0.2, w * 0.2)), k.vert(P(0.0, 0.1, w * 0.17)), k.vert(P(0.08, 0.07, w * 0.1))],
               [(0, 0)] * 4, Mg, GOLD_DARK)
    # The tail: two broad lobes fanned up and inward from its end.
    tip = spine[-1]
    for w, rise in ((-1, 0.0), (1, 0.05)):
        lobe = [tip, P(0.2, 0.86 + rise, w * 0.1), P(0.3, 0.78 + rise, w * 0.15), P(0.22, 0.7, w * 0.06)]
        k.face([k.vert(p) for p in lobe], [(0, 0)] * 4, Mg, GOLD)
    # The crest down its back: a row of spines.
    for i in range(5):
        t = 0.2 + i * 0.15
        a, b = spine[int(t * 5)], spine[min(5, int(t * 5) + 1)]
        p = np.array(a) + (np.array(b) - np.array(a)) * (t * 5 % 1)
        back = np.array(P(-0.11, 0.0)) - np.array(P(0, 0))
        k.face([k.vert(tuple(p + back * 0.6 + (0, 0.02, 0))), k.vert(tuple(p + back * 1.3 + (0, 0.07, 0))), k.vert(tuple(p + back * 0.6 + (0, 0.1, 0)))],
               [(0, 0)] * 3, Mg, GOLD_DARK)


def walls(k, W, Ms):
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
    # Over the beam, white plaster up to the roof between dark timbers.
    top = roof_y(zb)
    panel(k, Ms, [(-HW, SHELF_Y, zb - 0.01), (HW, SHELF_Y, zb - 0.01), (HW, top, zb - 0.01), (-HW, top, zb - 0.01)], PLASTER, uv=(0, 1))
    for x in (-HW + 0.06, -1.45, 1.45, HW - 0.06):
        box(k, (x, (SHELF_Y + top) / 2, zb - 0.03), (0.13, top - SHELF_Y, 0.08), W, POST)
    # The side walls (the machiya's): charred-cedar boards to the counter's height under a rail, white plaster over
    # them between timbers (a post at the middle, a tie beam), and the gables over the deck's sides the same.
    for sx in (-1, 1):
        x = sx * HW
        for i in range(8):
            z0, z1 = -HD + i * 2 * HD / 8, -HD + (i + 1) * 2 * HD / 8 - 0.01
            panel(k, W, [(x, 0.0, z0), (x, 0.0, z1), (x, RAIL_Y, z1), (x, RAIL_Y, z0)], mix(CEDAR, "#5a463a", rng.uniform(0, 1)), uv=(2, 1), uv_len=1.5)
        pts = [(x, RAIL_Y, -HD), (x, RAIL_Y, HD), (x, PLATE_Y, HD), (x, PLATE_Y, DECK_Z - 0.1), (x, roof_y(DECK_Z - 0.1) - 0.03, DECK_Z - 0.1),
               (x, RIDGE_Y - 0.03, RIDGE_Z), (x, roof_y(-HD) - 0.03, -HD)]
        panel(k, Ms, pts, PLASTER, uv=(2, 1))
        out = sx * (HW + 0.04)
        k.beam((out, RAIL_Y, -HD), (out, RAIL_Y, HD), 0.07, 0.1, 0.0, W, POST, uv_len=2.0)
        k.beam((out, 2.25, -HD), (out, 2.25, HD), 0.06, 0.12, 0.0, W, POST, uv_len=2.0)
        k.beam((out, RAIL_Y, 0.0), (out, roof_y(0.0) - 0.05, 0.0), 0.12, 0.06, 0.0, W, POST, uv_len=2.0)
        k.beam((out, PLATE_Y, (HD + DECK_Z) / 2), (out, roof_y((HD + DECK_Z) / 2) - 0.05, (HD + DECK_Z) / 2), 0.1, 0.06, 0.0, W, POST, uv_len=2.0)


def counter(k, M):
    W, Mp = M["wood"], M["paint"]
    # The body, its face of upright boards toward the guests, a kick at its foot, a thick pale top.
    box(k, ((CX0 + CX1) / 2, (TOP_Y - 0.06) / 2, 1.05), (CX1 - CX0, TOP_Y - 0.06, 0.9), W, mix(DARK, POST, 0.4), uv_len=2.0, v_axis=0)
    n = 28
    for i in range(n):
        x0, x1 = CX0 + i * (CX1 - CX0) / n, CX0 + (i + 1) * (CX1 - CX0) / n - 0.012
        panel(k, W, [(x0, 0.1, HD + 0.006), (x1, 0.1, HD + 0.006), (x1, TOP_Y - 0.07, HD + 0.006), (x0, TOP_Y - 0.07, HD + 0.006)],
              tone(LIGHT, "#c9a57a", 0.0, 1.0), uv=(0, 1), uv_len=1.2)
    box(k, ((CX0 + CX1) / 2, 0.05, HD + 0.01), (CX1 - CX0, 0.1, 0.06), W, INK)
    k.rbox(((CX0 + CX1) / 2 - 0.03, TOP_Y - 0.035, 1.17), (CX1 - CX0 + 0.06, 0.07, 1.25), 0.03, W, HINOKI, segs=2, uv_len=2.5, v_axis=0)
    fish_case(k, M)
    # The chefs' work ledge behind the case (the tsukeba), the counter's height: at each chef's place a board with his
    # block of fish and the slices he has cut, his rice tub to his right with the hand-water bowl, a cloth; the server's
    # end with a stack of geta.
    box(k, ((CX0 + CX1) / 2, (TOP_Y - 0.04) / 2, (LEDGE_Z + 0.6) / 2), (CX1 - CX0, TOP_Y - 0.04, 0.6 - LEDGE_Z), W, mix(DARK, POST, 0.5), uv_len=2.0, v_axis=0)
    box(k, ((CX0 + CX1) / 2 - 0.03, TOP_Y - 0.02, (LEDGE_Z + 0.62) / 2), (CX1 - CX0 + 0.06, 0.04, 0.62 - LEDGE_Z), W, HINOKI, r=0.012, uv_len=2.5, v_axis=0)
    for i, (bx, kind) in enumerate(BOARDS):
        k.rbox((bx, TOP_Y + 0.02, BOARD_Z), (0.5, 0.04, 0.28), 0.012, W, "#f2dfb8", segs=2, uv_len=0.8, v_axis=0)
        for j in range(3):     # knife marks
            x = bx - 0.15 + j * 0.13
            panel(k, Mp, [(x, TOP_Y + 0.0405, BOARD_Z - 0.08), (x + 0.004, TOP_Y + 0.0405, BOARD_Z - 0.08), (x + 0.03, TOP_Y + 0.0405, BOARD_Z + 0.07),
                          (x + 0.026, TOP_Y + 0.0405, BOARD_Z + 0.07)], "#d9c49c")
        F.saku(k, Mp, (bx + 0.1, TOP_Y + 0.04 + 0.024, BOARD_Z + 0.03), math.pi / 2, 0.2, 0.085, 0.048, kind, cut=3)
        F.hangiri(k, M, (bx + TUB_DX, TOP_Y, BOARD_Z - 0.02))
        F.tezu(k, M, (bx + TUB_DX + 0.02, TOP_Y, BOARD_Z + 0.2))
        F.towel(k, M, (bx - 0.12, TOP_Y + 0.009, 0.555), 0.08 * (i - 0.5))
    for j in range(3):
        box(k, (2.6, TOP_Y + 0.04 + j * 0.035, BOARD_Z), (0.44, 0.022, 0.19), W, "#e4c38d" if j % 2 else "#d8b47c")
    # The guests' places: a tea cup, a soy dish, chopsticks on their rest and a menu card at each.
    for i, sx in enumerate(SEATS):
        z = 1.6
        F.yunomi(k, M, (sx + 0.3, TOP_Y, z - 0.02), ["#6f8f73", "#c9a46a", "#8a6c9a"][i % 3])
        F.soy_dish(k, M, (sx - 0.24, TOP_Y, z - 0.06))
        F.chopsticks(k, M, (sx + 0.02, TOP_Y, z + 0.1), 0.0)
        menu_stand(k, M, (sx + 0.44, TOP_Y, z - 0.1))


def menu_stand(k, M, c):
    """A little menu at each place: a cream card printed with the dishes in ink and a red seal, in a dark wooden stand."""
    x, y, z = c
    box(k, (x, y + 0.012, z), (0.12, 0.024, 0.05), M["wood"], "#3a2a1e")
    tilt = K.game_rot(pitch=-0.2)
    k.rbox((x, y + 0.085, z - 0.006), (0.1, 0.13, 0.008), 0.004, M["paint"], "#f3e8cc", rot=tilt, segs=1)
    for j, w in enumerate((0.06, 0.05, 0.065, 0.04)):
        h = y + 0.125 - j * 0.024
        p = [(x - w / 2, h, z), (x + w / 2, h, z), (x + w / 2, h + 0.008, z), (x - w / 2, h + 0.008, z)]
        k.face([k.vert(tuple(np.array((px, py, pz)) + np.array(tilt @ Vector((0, 0, 0.0045))) + np.array((0, 0, (py - y - 0.085) * 0.2)))) for px, py, pz in p],
               [(0, 0)] * 4, M["paint"], INK)
    k.face([k.vert((x + 0.02 + dx, y + 0.04 + dy, z + 0.009 - dy * 0.2)) for dx, dy in ((0, 0), (0.018, 0), (0.018, 0.018), (0, 0.018))], [(0, 0)] * 4, M["paint"], RED)


def fish_case(k, M):
    """The fish case (neta case) along the chefs' side: a steel tray of crushed ice under slanted glass, hinoki ends, the
    serving shelf over its back half; on the ice, blocks of tuna, salmon and yellowtail, a whole sea bream, cooked
    shrimp, shiso leaves and lemon wheels, so the guests see the fish they'll eat."""
    W, Mp, Mpane = M["wood"], M["paint"], M["pane"]
    order = (("saku", "tuna"), ("shiso",), ("saku", "salmon"), ("lemon",), ("ebi",), ("saku", "hamachi"), ("tai",), ("shiso",), ("saku", "tuna"),
             ("ebi",), ("lemon",), ("saku", "salmon"))
    m = 0
    for x0, x1 in CASE_RUNS:
        cx = (x0 + x1) / 2
        k.rbox((cx, TOP_Y + 0.008, (CASE_Z0 + CASE_Z1) / 2), (x1 - x0, 0.016, CASE_Z1 - CASE_Z0), 0.004, M["metal"], "#d9dee2", segs=1)
        F.ice(k, M, x0 + 0.03, x1 - 0.03, SERVE_Z1 - 0.02, CASE_Z1 - 0.035, TOP_Y + 0.022, seed=int(abs(x0) * 10))
        # Slanted glass to the guests, a flat glass top back to the shelf, hinoki ends, the shelf on its back rail.
        fy, ty, gz = TOP_Y + 0.016, CASE_TOP, CASE_Z1 - 0.1
        panel(k, Mpane, [(x0, fy, CASE_Z1), (x1, fy, CASE_Z1), (x1, ty, gz), (x0, ty, gz)], "#e2f4f6")
        panel(k, Mpane, [(x0, ty, gz), (x1, ty, gz), (x1, ty, SERVE_Z1), (x0, ty, SERVE_Z1)], "#e2f4f6")
        for x in (x0, x1):
            pts = [(x, TOP_Y, CASE_Z0), (x, TOP_Y, CASE_Z1 + 0.01), (x, ty + 0.012, gz), (x, SERVE_Y - 0.03, SERVE_Z1), (x, SERVE_Y - 0.03, CASE_Z0)]
            panel(k, W, pts, HINOKI, uv=(2, 1))
        k.rbox((cx, SERVE_Y - 0.016, (SERVE_Z0 + SERVE_Z1) / 2), (x1 - x0 + 0.04, 0.032, SERVE_Z1 - SERVE_Z0), 0.008, W, HINOKI, segs=2,
               uv_len=1.5, v_axis=0)
        k.rbox((cx, (TOP_Y + SERVE_Y) / 2 - 0.01, SERVE_Z0 + 0.03), (x1 - x0, SERVE_Y - TOP_Y - 0.02, 0.04), 0.0, W, mix(DARK, POST, 0.3))
        # The fish on the ice, in the front half under the glass.
        x, y, z = x0 + 0.08, TOP_Y + 0.026, (SERVE_Z1 + CASE_Z1) / 2 - 0.01
        while x < x1 - 0.3:
            item = order[m % len(order)]
            m += 1
            if item[0] == "saku":
                F.saku(k, Mp, (x + 0.11, y + 0.022, z), math.pi / 2 + rng.uniform(-0.08, 0.08), 0.2, 0.075, 0.044, item[1])
                x += 0.26
            elif item[0] == "tai":
                F.tai(k, M, (x + 0.15, y, z + 0.005), 0.1)
                x += 0.33
            elif item[0] == "ebi":
                for j in range(3):
                    c = (x + 0.04 + j * 0.055, y + 0.012, z)
                    arc = [(c[0] + 0.022 * math.cos(a), c[1] + 0.01 * math.sin(a * 0.5), c[2] + 0.03 * math.sin(a)) for a in np.linspace(-1.7, 1.7, 6)]
                    k.tube(arc, 0.012, Mp, "#f27a4a", n=5, radii=[0.5, 0.9, 1.0, 1.0, 0.85, 0.6])
                    k.face([k.vert((arc[0][0] - 0.004, y + 0.014, arc[0][2] - 0.012)), k.vert((arc[0][0] + 0.016, y + 0.012, arc[0][2] - 0.02)),
                            k.vert((arc[0][0] + 0.008, y + 0.014, arc[0][2]))], [(0, 0)] * 3, Mp, "#e2462a")
                x += 0.2
            elif item[0] == "shiso":
                F.shiso(k, M, (x + 0.04, y + 0.004, z - 0.03), rng.uniform(-0.5, 0.5))
                x += 0.07
            else:
                F.lemon(k, M, (x + 0.03, y + 0.026, z + 0.02), 0.4)
                x += 0.06


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
    zc, B = -HD + 0.3, BACK_TOP
    box(k, (0, (BACK_TOP - 0.02) / 2, zc), (2 * HW - 0.1, BACK_TOP - 0.02, 0.48), W, mix(DARK, POST, 0.3), uv_len=2.0, v_axis=0)
    box(k, (0, BACK_TOP, zc + 0.02), (2 * HW - 0.08, 0.05, 0.54), W, HINOKI, r=0.015, uv_len=2.0, v_axis=0)
    for i in range(5):  # cabinet doors
        x = -3.2 + i * 1.6
        panel(k, W, [(x - 0.7, 0.12, zc + 0.245), (x + 0.7, 0.12, zc + 0.245), (x + 0.7, BACK_TOP - 0.12, zc + 0.245), (x - 0.7, BACK_TOP - 0.12, zc + 0.245)],
              tone(LIGHT, KITCHEN, 0.0, 1.0), uv=(0, 1))
    # The raised board floor behind the counter the staff stand on (STAFF_Y), slats along it on bearers, boards at its ends.
    z0, z1, x0, x1 = -0.93, LEDGE_Z, -2.9, 3.6
    for i in range(6):
        box(k, ((x0 + x1) / 2, STAFF_Y - 0.03, z0 + (i + 0.5) * (z1 - z0) / 6), (x1 - x0, 0.05, (z1 - z0) / 6 - 0.02), W, tone(lo=0.5), v_axis=0, uv_len=2.0)
    for x in (x0 + 0.05, (x0 + x1) / 2, x1 - 0.05):
        box(k, (x, (STAFF_Y - 0.05 + FLOOR) / 2, (z0 + z1) / 2), (0.1, STAFF_Y - 0.05 - FLOOR, z1 - z0), W, POST)
    for x in (x0, x1):
        box(k, (x, (STAFF_Y + FLOOR) / 2 - 0.02, (z0 + z1) / 2), (0.04, STAFF_Y - FLOOR, z1 - z0), W, mix(DARK, POST, 0.4))
    k.lathe((-1.6, (B + 0.025), zc), [(0.0, 0.0), (0.3, 0.0), (0.34, 0.14), (0.31, 0.14), (0.27, 0.03), (0.0, 0.03)], W, "#b07a46", n=12)
    k.blob((-1.6, (B + 0.070), zc), (0.26, 0.06, 0.26), Ms, "#f7f5ee", segs=10, rings=4, flat_bottom=0.0)
    box(k, (0.3, (B + 0.050), zc), (0.62, 0.05, 0.36), W, "#e9cf9e")
    k.blob((0.3, (B + 0.120), zc), (0.22, 0.06, 0.08), Mp, "#7b9bb3", segs=8, rings=4)
    box(k, (0.18, (B + 0.140), zc), (0.2, 0.04, 0.1), Mp, "#f08a5a", r=0.01)
    for j in range(4):
        k.lathe((1.5, (B + 0.025) + j * 0.035, zc), [(0.0, 0.0), (0.13, 0.0), (0.16, 0.03), (0.0, 0.03)], Mp, "#f1ece2" if j % 2 else "#2f4f7a", n=10)
    k.lathe((2.4, (B + 0.025), zc), [(0.0, 0.0), (0.09, 0.0), (0.11, 0.08), (0.08, 0.15), (0.03, 0.17), (0.0, 0.17)], Mp, "#3e5a4a", n=8)
    box(k, (-0.6, (B + 0.100), zc - 0.1), (0.16, 0.16, 0.1), W, INK)
    for j in range(3):
        box(k, (-0.65 + j * 0.05, (B + 0.230), zc - 0.1), (0.02, 0.1, 0.03), Mp, "#c9ced3")
    # The side walls' shelves: bowls on the left (a poster over them); on the right two shelves of sake, big bottles
    # with their labels and squat flasks, and a stack of wooden cups.
    for sx, ys in ((-1, (1.55,)), (1, (1.55, 2.05))):
        x = sx * (HW - 0.17)
        for y in ys:
            box(k, (x, y, -0.2), (0.3, 0.04, 1.4), W, mix(DARK, LIGHT, 0.7), uv_len=1.5, v_axis=2)
            if sx < 0:
                for j in range(3):
                    k.lathe((x, y + 0.02, -0.65 + j * 0.42), [(0.0, 0.0), (0.06, 0.0), (0.1, 0.08), (0.0, 0.08)], Mp, ["#f1ece2", "#2f4f7a", "#b8462f"][j], n=8)
                continue
            for j in range(6):
                z = -0.78 + j * 0.23
                if (j + (y > 2)) % 3 == 2:   # a tokkuri
                    k.lathe((x, y + 0.02, z), [(0.0, 0.0), (0.05, 0.0), (0.075, 0.08), (0.03, 0.17), (0.035, 0.2), (0.0, 0.2)], Mp, ["#f1ece2", "#3e5a7a"][j % 2], n=7)
                    continue
                h = 0.4 if y < 2 else 0.34
                sake_bottle(k, Mg, Mp, (x, y + 0.02, z), h, 0.062, GLASS[(j + int(y * 10)) % len(GLASS)], LABELS[j % 3], ["#d6a84a", RED][j % 2])
        if sx > 0:
            for j in range(3):
                box(k, (x, 1.6 + j * 0.06, 0.38), (0.12, 0.055, 0.12), W, "#dcc08e")


LABELS = ("#f2ead8", "#e8d9a8", "#d84a3a", "#f1ece2", "#2a2420")
GLASS = ("#2f6a42", "#6a3f22", "#284a6a", "#a7b49a", "#4f6a2f", "#7a2a2a")


def sake_bottle(k, Mg, Mp, c, h, r, col, label, cap):
    """A sake bottle: round shoulders into a long neck with a lip, a foil cap, a paper label round its body with an ink
    mark (the brewery's name) and a red seal."""
    x, y, z = c
    prof = [(0.0, 0.0), (r, 0.0), (r, h * 0.56), (r * 0.62, h * 0.72), (r * 0.37, h * 0.8), (r * 0.35, h * 0.92), (0.0, h * 0.92)]
    k.lathe(c, prof, Mg, col, n=8)
    k.lathe((x, y + h * 0.88, z), [(r * 0.42, 0.0), (r * 0.42, h * 0.12), (0.0, h * 0.12 + 0.004)], Mp, cap, n=6)
    k.lathe(c, [(r * 1.03, h * 0.16), (r * 1.03, h * 0.5)], Mp, label, n=8, phase=0.4)
    mark, f = INK if label != INK else "#f1ece2", r * 1.05
    for (x0, x1, y0, y1), col_ in (((-0.18, 0.18, 0.2, 0.46), mark), ((0.26, 0.42, 0.38, 0.45), RED)):
        k.face([k.vert((x + r * x0, y + h * y0, z + f)), k.vert((x + r * x1, y + h * y0, z + f)), k.vert((x + r * x1, y + h * y1, z + f)),
                k.vert((x + r * x0, y + h * y1, z + f))], [(0, 0)] * 4, Mp, col_)


def bottles(k, Mg, Mp):
    """Sake bottles along the shelf over the window, either side of the fan, between the speakers: tall isshobin and
    shorter ones, their labels to the guests."""
    for side in (-1, 1):
        for i in range(10):
            x = side * (0.92 + i * 0.235) + rng.uniform(-0.02, 0.02)
            tall = i % 3 != 1
            h, r = (rng.uniform(0.38, 0.44), 0.058) if tall else (rng.uniform(0.28, 0.32), 0.05)
            sake_bottle(k, Mg, Mp, (x, SHELF_Y, -HD + 0.13), h, r, GLASS[rng.integers(0, len(GLASS))], LABELS[rng.integers(0, len(LABELS))],
                        ["#d6a84a", RED, INK][rng.integers(0, 3)])


def speaker_frame(sx):
    """The speaker at one end of the shelf: its centre, turned in and tipped down toward the guests."""
    c = np.array((sx * 3.62, SHELF_Y + 0.33, -HD + 0.04))
    return c, K.game_rot(yaw=-sx * 0.3, pitch=0.18)


def speakers(k, Mp):
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


def drapes(k, Mc, Mp):
    # A short indigo curtain (a noren valance) along the front header either side of the entrance, split into panels,
    # a white crest at each bay's middle.
    top, z = HEADER_Y + 0.08, HEADER_Z + 0.14
    for a, b in ((-4.3, -1.5), (1.5, 4.3)):
        n = 5
        for i in range(n):
            x0, w = a + 0.1 + i * (b - a - 0.2) / n, (b - a - 0.2) / n - 0.025
            cloth_grid(k, Mc, lambda u, v, x0=x0, w=w: (x0 + w * u, top - 0.5 * v, z + 0.012 * math.sin(u * math.pi) * v), 2, 2,
                       lambda t: mix(NAVY, "#1a2540", t))
        cx = (a + b) / 2
        k.lathe((cx, top - 0.24, z + 0.01), [(0.0, 0.0), (0.13, 0.0), (0.13, 0.008), (0.0, 0.008)], Mp, "#f1ece2", d=(0, 0, 1), n=14)
        k.lathe((cx, top - 0.24, z + 0.02), [(0.0, 0.0), (0.085, 0.0), (0.085, 0.006), (0.0, 0.006)], Mp, NAVY, d=(0, 0, 1), n=12)
        k.extrude([(0.07, 0.0), (0.03, 0.03), (-0.03, 0.025), (-0.06, 0.045), (-0.055, 0.0), (-0.06, -0.045), (-0.03, -0.025), (0.03, -0.03)],
                  z + 0.027, z + 0.031, Mp, "#f1ece2", at=(cx, top - 0.24, 0))
        k.tube([(a, top + 0.01, z - 0.005), (b, top + 0.01, z - 0.005)], 0.02, Mp, POST, n=4)
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
    # Wooden menu tags (o-shinagaki) hung along the beam over the window, either side of the fan: a pale board with a
    # dark rim and a rounded head, a dish written down it in ink strokes, its price under a red seal, each on its cord.
    for side in (-1, 1):
        for i in range(8):
            x, y, z = side * (0.98 + i * 0.205), BEAM_Y - 0.19, -HD + 0.2
            tilt = K.game_rot(roll=rng.uniform(-0.04, 0.04))
            box(k, (x, y, z), (0.165, 0.32, 0.018), W, "#3a2a1e", rot=tilt)
            k.rbox((x, y - 0.005, z + 0.004), (0.145, 0.295, 0.016), 0.01, W, "#f1dfb6" if (i + side) % 3 else "#f6ead0", rot=tilt, segs=1)
            strokes = [(0.0, 0.1, 0.07, 0.014), (0.0, 0.065, 0.05, 0.03), (0.01, 0.02, 0.06, 0.012), (-0.008, -0.015, 0.04, 0.03),
                       (0.0, -0.05, 0.065, 0.012)][: 3 + (i % 3)]
            for (dx, dy, w, h) in strokes:
                panel(k, Mp, [(x + dx - w / 2, y + dy - h / 2, z + 0.0135), (x + dx + w / 2, y + dy - h / 2, z + 0.0135),
                              (x + dx + w / 2, y + dy + h / 2, z + 0.0135), (x + dx - w / 2, y + dy + h / 2, z + 0.0135)], INK)
            panel(k, Mp, [(x - 0.022, y - 0.13, z + 0.0135), (x + 0.022, y - 0.13, z + 0.0135), (x + 0.022, y - 0.09, z + 0.0135),
                          (x - 0.022, y - 0.09, z + 0.0135)], RED)
            k.tube([(x, y + 0.16, z), (x, BEAM_Y - 0.02, z)], 0.004, Mp, INK, n=3)
    # The roof sign over the front: a kanban board in a dark frame on two posts from the roof, under its own little
    # tiled cap (its light box glows: the glow model).
    sz = 3.35
    for x in (-0.95, 0.95):
        k.beam((x, roof_y(sz), sz), (x, 4.3, sz), 0.1, 0.1, 0.0, W, POST, uv_len=1.2)
    box(k, (0, 3.92, sz), (1.9, 0.62, 0.08), W, POST)
    box(k, (0, 4.27, sz), (2.15, 0.06, 0.34), Mp, TILE_DARK, r=0.02)
    k.tube([(-1.12, 4.36, sz), (1.12, 4.36, sz)], 0.055, Mp, TILE, n=6, caps=True)
    fish = [(0.55, 0.0), (0.3, 0.13), (-0.05, 0.15), (-0.35, 0.06), (-0.55, 0.16), (-0.5, 0.0), (-0.55, -0.16), (-0.35, -0.06),
            (-0.05, -0.15), (0.3, -0.13)]
    k.extrude(fish, sz + 0.075, sz + 0.095, Mp, INK, at=(0, 3.92, 0))
    for x in (-0.82, 0.78):
        k.lathe((x, 3.92, sz + 0.075), [(0.0, 0.0), (0.06, 0.0), (0.06, 0.02), (0.0, 0.02)], Mp, INK, d=(0, 0, 1), n=8)
    # Today's menu: the chalk board on its easel on the landing, beside the entrance, toward the way in.
    ex, ez = 1.75, 5.25
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
    k.blob((cx, y0 + 0.05, cz), ((x1 - x0) / 2 - 0.03, 0.06, (z1 - z0) / 2 - 0.03), Ms, "#e6d3a6", segs=10, rings=4, seed=11, lumpy=0.25, flat_bottom=-0.02)
    panel(k, Mpane, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], "#e8f6f8")
    panel(k, Mpane, [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], "#e8f6f8")
    # A rock arch, brain and branching coral, swaying weed, pebbles; an air stone's bubbles.
    k.blob((-3.7, y0 + 0.16, 0.7), (0.14, 0.12, 0.1), Ms, "#8a8478", segs=7, rings=4, seed=21, lumpy=0.4)
    k.blob((-3.5, y0 + 0.13, 0.66), (0.08, 0.1, 0.07), Ms, "#9a9488", segs=6, rings=4, seed=22, lumpy=0.4)
    for (x, z, col) in ((-3.3, 0.72, "#f2a04a"), (-3.55, 1.12, "#9b6cc4")):
        k.blob((x, y0 + 0.11, z), (0.08, 0.07, 0.07), Ms, col, segs=7, rings=4, seed=int(-x * 10), lumpy=0.45, flat_bottom=0.0)
    for x, z in ((-3.8, 1.05), (-3.2, 1.2)):                  # branching coral
        for d in range(5):
            a = d * math.tau / 5 + x
            tip = (x + 0.08 * math.cos(a), y0 + 0.24 + 0.05 * (d % 2), z + 0.06 * math.sin(a))
            k.tube([(x, y0 + 0.08, z), ((x + tip[0]) / 2, y0 + 0.17, (z + tip[2]) / 2), tip], 0.016, Ms, "#ef7f8f", n=4, radii=[1.0, 0.8, 0.45])
    for j, (x, z) in enumerate(((-3.88, 0.62), (-3.62, 0.95), (-3.42, 0.56), (-3.15, 0.9), (-3.9, 1.3))):
        sway = 0.05 * (1 if j % 2 else -1)
        k.tube([(x, y0 + 0.08, z), (x + sway, y0 + 0.28, z), (x - sway, y0 + 0.48, z), (x + sway * 0.5, y0 + 0.6 + 0.05 * j % 0.1, z)], 0.018, Ms,
               ["#4f9a5a", "#6fb85a", "#3f8a4a"][j % 3], n=4, radii=[1.0, 0.9, 0.7, 0.35])
    for i in range(7):
        k.blob((-3.25, y0 + 0.14 + i * 0.09, 1.3 + 0.012 * math.sin(i * 2.0)), (0.012 + 0.002 * i,) * 3, Mpane, "#ffffff", segs=5, rings=3)
    # The fish: a round body, a forked tail, a dorsal fin and a dark eye, swimming both ways.
    for j, (x, y, z, col, sc) in enumerate(((-3.6, 1.3, 1.15, "#f28a3a", 1.0), (-3.3, 1.12, 0.9, "#3a7ad8", 1.1), (-3.75, 1.45, 0.85, "#f2d04a", 0.9),
                                             (-3.35, 1.5, 1.25, "#f28a3a", 0.8), (-3.8, 1.05, 1.2, "#e8e4da", 0.85))):
        d = 1 if j % 2 else -1
        k.blob((x, y, z), (0.07 * sc, 0.048 * sc, 0.028 * sc), Mp, col, segs=8, rings=5)
        for s_ in (1, -1):
            t = [k.vert((x - d * 0.055 * sc, y, z)), k.vert((x - d * 0.13 * sc, y + s_ * 0.05 * sc, z)), k.vert((x - d * 0.105 * sc, y, z))]
            k.face(t, [(0, 0)] * 3, Mp, mix(col, INK, 0.15))
        k.face([k.vert((x - d * 0.03 * sc, y + 0.04 * sc, z)), k.vert((x + d * 0.02 * sc, y + 0.075 * sc, z)), k.vert((x + d * 0.03 * sc, y + 0.04 * sc, z))],
               [(0, 0)] * 3, Mp, mix(col, INK, 0.15))
        for w in (-1, 1):
            k.blob((x + d * 0.04 * sc, y + 0.012 * sc, z + w * 0.022 * sc), (0.008 * sc,) * 3, Mp, INK, segs=5, rings=3)


def plants(k, Mp, W):
    """Bamboo in square cedar planters at the deck's front corners; a bonsai pine on the back counter's end."""
    for x, z in ((-4.1, 2.35), (3.95, 3.7)):
        box(k, (x, FLOOR + 0.2, z), (0.42, 0.4, 0.42), W, CEDAR, r=0.02)
        box(k, (x, FLOOR + 0.41, z), (0.48, 0.04, 0.48), W, POST)
        k.blob((x, FLOOR + 0.4, z), (0.18, 0.03, 0.18), Mp, "#4a3a2c", segs=8, rings=3, seed=int(z * 10), lumpy=0.3)   # the soil
        for i in range(5):
            a = i * math.tau / 5 + x
            bx, bz, h = x + 0.11 * math.cos(a), z + 0.11 * math.sin(a), rng.uniform(1.5, 2.3)
            lean = np.array((math.cos(a), 0.0, math.sin(a))) * 0.12
            at = lambda t: np.array((bx, FLOOR + 0.4, bz)) + lean * t * t + np.array((0, h * t, 0))
            green = mix("#6f9a4a", "#9fbe5a", rng.uniform(0, 1))
            k.tube([tuple(at(t)) for t in (0.0, 0.5, 1.0)], 0.034, Mp, green, n=6, v_len=0.3, radii=[1.0, 0.9, 0.65])
            for t in np.arange(0.2, 0.95, 0.19):      # the nodes: a pale band round the culm
                k.lathe(tuple(at(t)), [(0.039 * (1 - 0.35 * t), -0.007), (0.039 * (1 - 0.35 * t), 0.007)], Mp, mix(green, "#e6e2b0", 0.45), n=5)
            for t in (0.55, 0.72, 0.88, 1.0):   # a spray of narrow leaves at the upper nodes, drooping
                p = at(t)
                for m in range(4):
                    d = rng.uniform(0, math.tau)
                    out = np.array((math.cos(d), 0.0, math.sin(d)))
                    tip, mid = p + out * 0.3 + np.array((0, -0.12, 0)), p + out * 0.15 + np.array((0, 0.02, 0))
                    side = np.array((-math.sin(d), 0.0, math.cos(d))) * 0.03
                    k.face([k.vert(tuple(p)), k.vert(tuple(mid + side)), k.vert(tuple(tip)), k.vert(tuple(mid - side))],
                           [(0, 0)] * 4, Mp, mix("#3f7a32", "#8cc05a", rng.uniform(0, 1)))
    # The bonsai: a shallow blue pot, a twisting trunk, three cloud pads of needles.
    x, y, z = -3.45, BACK_TOP + 0.025, -HD + 0.3
    k.lathe((x, y, z), [(0.0, 0.0), (0.17, 0.0), (0.2, 0.08), (0.18, 0.09), (0.0, 0.08)], Mp, "#3f6f8f", n=8, sx=1.3)
    trunk = [(x, y + 0.08, z), (x + 0.06, y + 0.2, z), (x - 0.05, y + 0.32, z + 0.02), (x + 0.04, y + 0.44, z)]
    k.tube(trunk, 0.035, W, "#6a4a32", n=5, radii=[1.3, 1.0, 0.8, 0.6])
    for (dx, dy, r) in ((0.14, 0.26, 0.13), (-0.13, 0.36, 0.12), (0.04, 0.5, 0.14)):
        k.blob((x + dx, y + dy, z), (r, r * 0.45, r * 0.85), Mp, mix("#3f6a3a", "#5f8a45", rng.uniform(0, 1)), segs=7, rings=4, seed=int(dy * 100), lumpy=0.4)


def lucky_cat(k, Mp, Mm, c, yaw):
    """A beckoning cat (maneki-neko) on the counter's end, facing the guests, on a red cushion: white with calico
    patches, its eyes shut in a smile, whiskers, a red collar with a gold bell, the left paw raised, the right holding a
    gold coin (koban)."""
    R = K.game_rot(yaw=yaw)
    at = lambda u, v, w: tuple(np.array(c) + np.array(R @ Vector((u, v, w))))
    WHITE, PINK = "#f8f4ec", "#f2a6b0"
    k.rbox(at(0, 0.02, 0), (0.24, 0.04, 0.22), 0.018, Mp, "#b8283a", rot=R, segs=2)
    for u, w in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        k.tube([at(0.12 * u, 0.025, 0.11 * w), at(0.135 * u, 0.0, 0.125 * w)], 0.008, Mp, "#e0b040", n=4, radii=[0.6, 1.2])
    k.blob(at(0, 0.13, 0), (0.095, 0.095, 0.08), Mp, WHITE, segs=12, rings=7, rot=R, flat_bottom=-0.08)
    k.blob(at(0, 0.27, 0.01), (0.105, 0.088, 0.088), Mp, WHITE, segs=12, rings=7, rot=R)
    k.blob(at(-0.05, 0.31, 0.02), (0.045, 0.035, 0.07), Mp, "#e8973e", segs=8, rings=4, rot=R)       # calico patches
    k.blob(at(0.06, 0.14, -0.04), (0.04, 0.04, 0.05), Mp, "#2a2420", segs=8, rings=4, rot=R)
    for s_ in (-1, 1):
        ear = R @ Vector((s_ * 0.35, 1, 0.05))
        k.lathe(at(s_ * 0.06, 0.33, 0.0), [(0.034, 0.0), (0.0, 0.06)], Mp, WHITE, d=tuple(ear), n=6)
        k.lathe(at(s_ * 0.06, 0.335, 0.012), [(0.02, 0.0), (0.0, 0.04)], Mp, PINK, d=tuple(ear), n=5)
        k.tube([at(s_ * 0.052, 0.272, 0.084), at(s_ * 0.036, 0.281, 0.088), at(s_ * 0.02, 0.272, 0.086)], 0.004, Mp, INK, n=3)
        for j in range(3):
            k.tube([at(s_ * 0.05, 0.243 + j * 0.01, 0.083), at(s_ * 0.11, 0.236 + j * 0.018, 0.07)], 0.0016, Mp, INK, n=3)
    k.blob(at(0, 0.252, 0.09), (0.011, 0.008, 0.006), Mp, PINK, segs=6, rings=3, rot=R)
    k.tube([at(0.085 * math.cos(a), 0.2, 0.072 * math.sin(a) + 0.008) for a in np.linspace(0, math.tau, 11)[:-1]], 0.011, Mp, RED, n=4, closed_path=True)
    k.blob(at(0, 0.18, 0.083), (0.022, 0.022, 0.022), Mm, "#e8b83a", segs=8, rings=5)
    k.tube([at(-0.012, 0.176, 0.104), at(0.012, 0.176, 0.104)], 0.003, Mp, INK, n=3)
    # The raised left paw (its pink pad to the guests), the right paw at its chest holding the koban.
    k.tube([at(0.075, 0.18, 0.04), at(0.11, 0.26, 0.05), at(0.105, 0.34, 0.05)], 0.028, Mp, WHITE, n=7, radii=[1.0, 0.9, 1.0])
    k.blob(at(0.105, 0.36, 0.05), (0.034, 0.034, 0.03), Mp, WHITE, segs=8, rings=5, rot=R)
    k.blob(at(0.105, 0.358, 0.078), (0.016, 0.014, 0.006), Mp, PINK, segs=6, rings=3, rot=R)
    k.blob(at(0, 0.105, 0.08), (0.06, 0.042, 0.012), Mm, "#e8b83a", segs=10, rings=4, rot=R)
    for j in range(3):
        k.tube([at(-0.03, 0.08 + j * 0.02, 0.093), at(0.03, 0.08 + j * 0.02, 0.093)], 0.002, Mp, "#b8862a", n=3)
    k.blob(at(-0.04, 0.115, 0.085), (0.025, 0.022, 0.02), Mp, WHITE, segs=7, rings=4, rot=R)
    k.tube([at(-0.07, 0.04, -0.06), at(-0.11, 0.07, -0.02), at(-0.1, 0.1, 0.03)], 0.016, Mp, WHITE, n=5, radii=[1.0, 0.9, 0.6])   # the tail


def sake_casks(k, Mp, Mr):
    """Two straw-wrapped sake casks (komodaru) on the deck by the counter's end, a red and black label on each."""
    for i, (x, z, y0) in enumerate(((4.05, 2.55, FLOOR), (4.05, 3.15, FLOOR))):
        k.lathe((x, y0, z), [(0.0, 0.0), (0.22, 0.0), (0.26, 0.08), (0.27, 0.34), (0.23, 0.46), (0.0, 0.47)], Mp, "#e5d6ae", n=10)
        for y in (0.05, 0.42):
            k.lathe((x, y0 + y, z), [(0.235, -0.025), (0.275, 0.0), (0.235, 0.025)], Mr, ROPE, n=10)
        lx = x - 0.275
        panel(k, Mp, [(lx, y0 + 0.12, z + 0.1), (lx, y0 + 0.12, z - 0.1), (lx, y0 + 0.36, z - 0.1), (lx, y0 + 0.36, z + 0.1)], RED if i else INK, uv=(2, 1))
        panel(k, Mp, [(lx - 0.004, y0 + 0.17, z + 0.025), (lx - 0.004, y0 + 0.17, z - 0.025), (lx - 0.004, y0 + 0.32, z - 0.025),
                      (lx - 0.004, y0 + 0.32, z + 0.025)], "#f1ece2", uv=(2, 1))


def posters(k, Mp):
    """Posters on the side walls: a fish on the sea over the tank, a sake cup under a rising sun on the right, and a
    great wave over the left shelf."""
    for sx, bg, z, cy in ((-1, "#2f6f9a", 1.0, 2.2), (1, "#c3283a", 1.0, 2.2), (-1, "#e9dcc0", -0.55, 2.3)):
        x = sx * (HW - 0.075)
        w, h = 0.52, 0.7
        pt = lambda u, v, d=0.0: (x - sx * d, cy + v, z + sx * u)
        panel(k, Mp, [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)], "#f1e6cc", uv=(2, 1))
        panel(k, Mp, [pt(-w / 2 + 0.04, -h / 2 + 0.16, 0.004), pt(w / 2 - 0.04, -h / 2 + 0.16, 0.004), pt(w / 2 - 0.04, h / 2 - 0.04, 0.004),
                      pt(-w / 2 + 0.04, h / 2 - 0.04, 0.004)], bg, uv=(2, 1))
        if z < 0:    # the wave: blue crests curling over, white foam at their lips, a red sun
            for j, (u0, v0, r) in enumerate(((-0.12, -0.12, 0.16), (0.1, -0.16, 0.11))):
                arc = [pt(u0 + r * math.cos(a), v0 + r * math.sin(a), 0.008) for a in np.linspace(math.pi * 0.05, math.pi * 1.05, 8)]
                inner = [pt(u0 + r * 0.55 * math.cos(a), v0 + r * 0.55 * math.sin(a), 0.008) for a in np.linspace(math.pi * 0.05, math.pi * 1.05, 8)]
                for m in range(7):
                    k.face([k.vert(inner[m]), k.vert(inner[m + 1]), k.vert(arc[m + 1]), k.vert(arc[m])], [(0, 0)] * 4, Mp, "#2a4f8a" if m < 5 else "#f6f0e2")
            k.face([k.vert(pt(0.13 + 0.06 * math.cos(a), 0.17 + 0.06 * math.sin(a), 0.008)) for a in np.linspace(0, math.tau, 11)[:-1]], [(0, 0)] * 10, Mp, RED)
        elif sx < 0:   # an orange fish leaping over two waves
            fish = [(0.17, 0.05), (0.06, 0.12), (-0.08, 0.1), (-0.15, 0.03), (-0.22, 0.1), (-0.21, -0.04), (-0.15, -0.01), (-0.06, -0.06), (0.07, -0.04)]
            k.face([k.vert(pt(u, v + 0.06, 0.008)) for u, v in fish], [(0, 0)] * len(fish), Mp, "#f28a3a")
            for j in range(2):
                yy = -0.12 - j * 0.07
                panel(k, Mp, [pt(-0.2, yy, 0.008), pt(0.2, yy, 0.008), pt(0.2, yy + 0.025, 0.008), pt(-0.2, yy + 0.025, 0.008)], "#f1e6cc", uv=(2, 1))
        else:        # a white sun, a sake cup under it
            k.face([k.vert(pt(0.13 * math.cos(a), 0.1 + 0.13 * math.sin(a), 0.008)) for a in np.linspace(0, math.tau, 13)[:-1]], [(0, 0)] * 12, Mp, "#f6f0e2")
            k.face([k.vert(pt(u, v, 0.012)) for u, v in ((-0.1, -0.1), (0.1, -0.1), (0.07, -0.2), (-0.07, -0.2))], [(0, 0)] * 4, Mp, "#f1ece2")
        for j in range(3):   # the poster's lines of text under the picture
            yy, ww = -h / 2 + 0.11 - j * 0.035, (0.36, 0.28, 0.2)[j]
            panel(k, Mp, [pt(-ww / 2, yy, 0.006), pt(ww / 2, yy, 0.006), pt(ww / 2, yy + 0.018, 0.006), pt(-ww / 2, yy + 0.018, 0.006)], INK, uv=(2, 1))


def pile(k, W, Mr, x, z, top, bottom=PILE_Y, r=0.15):
    """A round pile from `top` down to `bottom`, roped where it meets the water (the floor's 0.78 over the sea)."""
    k.lathe((x, bottom, z), [(r * 1.05, 0.0), (r, top - bottom - 0.08), (0.0, top - bottom)], W, POST, n=8, v_len=1.2, u_tiles=0.5,
            wobble=lambda j, i: 1.0 + 0.04 * math.sin(j * 2.1 + x + z))
    if top > -0.6:
        lashing(k, Mr, (x, -0.74, z), r + 0.01)


def pier(M):
    """The bar's stilts and its pier: piles under the floor, braced; the landing before the entrance and the boardwalk
    down to the sand on posts, rope rails along both; lantern posts at the landing and the boardwalk's end (their
    lanterns are the glow model's); the entrance, a lacquered gate with the bar's board on its lintel."""
    W, Mr, Mp = M["wood"], M["rope"], M["paint"]
    k = K.Kit("sushi-bar-pier")
    # Piles under the bar: the front ones carry on down from the posts (the still bar's, to -0.3).
    xs = (-4.3, -1.5, 1.5, 4.3)
    for x in xs:
        for z in (BACK_Z + 0.15, -0.2, HD + 0.1):
            pile(k, W, Mr, x, z, -0.1)
        pile(k, W, Mr, x, HEADER_Z, -0.3, r=0.155)
    # Joists under the boards, and X braces between the piles along the front and the back.
    for z in (BACK_Z + 0.15, -0.2, HD + 0.1, HEADER_Z):
        k.beam((-4.45, -0.17, z), (4.45, -0.17, z), 0.12, 0.14, 0.0, W, mix(POST, DARK, 0.3), uv_len=2.0)
    for z in (BACK_Z + 0.15, HEADER_Z):
        for a, b in zip(xs, xs[1:]):
            k.beam((a, -0.3, z + 0.17), (b, -1.6, z + 0.17), 0.07, 0.09, 0.0, W, POST, uv_len=2.0)
            k.beam((b, -0.3, z + 0.17), (a, -1.6, z + 0.17), 0.07, 0.09, 0.0, W, POST, uv_len=2.0)
    for sx in (-1, 1):   # the deck's sides and the kitchen's, a fascia over the joists' ends
        k.beam((sx * 4.47, -0.1, BACK_Z + 0.1), (sx * 4.47, -0.1, DECK_Z), 0.06, 0.16, 0.0, W, mix(DARK, POST, 0.5), uv_len=2.0)
    k.beam((-4.47, -0.1, BACK_Z + 0.05), (4.47, -0.1, BACK_Z + 0.05), 0.06, 0.16, 0.0, W, mix(DARK, POST, 0.5), uv_len=2.0)
    # The landing: boards across, its edge a fascia; then the boardwalk's boards, each a step lower toward the sand.
    top = FLOOR - 0.02
    n = 7
    for i in range(n):
        z = DECK_Z + (i + 0.5) * (LAND_Z - DECK_Z) / n
        box(k, (0, top - 0.05, z), (2 * LAND_HW, 0.1, (LAND_Z - DECK_Z) / n - 0.025), W, tone(), v_axis=0, uv_len=2.0)
    n = 22
    for i in range(n):
        z = LAND_Z + (i + 0.5) * (WALK_Z - LAND_Z) / n
        box(k, (rng.uniform(-0.03, 0.03), top + walk_y(z) - 0.05, z), (2 * WALK_HW + 0.3, 0.1, (WALK_Z - LAND_Z) / n - 0.03), W, tone(),
            v_axis=0, uv_len=2.0, rot=K.game_rot(yaw=rng.uniform(-0.02, 0.02)))
    for sx in (-1, 1):   # stringers under the boardwalk, and a fascia along the landing's sides
        k.beam((sx * 0.75, top - 0.16, LAND_Z - 0.1), (sx * 0.75, top + walk_y(WALK_Z) - 0.16, WALK_Z), 0.1, 0.12, 0.0, W, POST, uv_len=2.0)
        k.beam((sx * LAND_HW, top - 0.12, DECK_Z), (sx * LAND_HW, top - 0.12, LAND_Z), 0.06, 0.14, 0.0, W, mix(DARK, POST, 0.5), uv_len=2.0)
    k.beam((-LAND_HW, top - 0.12, LAND_Z), (LAND_HW, top - 0.12, LAND_Z), 0.06, 0.14, 0.0, W, mix(DARK, POST, 0.5), uv_len=2.0)
    # Posts with rope rails: round the landing (open toward the boardwalk and the entrance), along the boardwalk.
    rail = WALK_HW + 0.2
    land = [(-LAND_HW + 0.08, DECK_Z + 0.25), (-LAND_HW + 0.08, LAND_Z - 0.08), (-rail, LAND_Z - 0.08)]
    walk_zs = [LAND_Z + 0.4 + (WALK_Z - 0.3 - LAND_Z - 0.4) * t for t in np.linspace(0, 1, 4)]
    for sx in (-1, 1):
        runs = [[(-sx * x, z) for x, z in land], [(sx * rail, z) for z in walk_zs]]
        for run in runs:
            tops = []
            for x, z in run:
                y = top + walk_y(z)
                pile(k, W, Mr, x, z, y + 0.95, r=0.075)
                tops.append((x, y, z))
            for a, b in zip(tops, tops[1:]):
                for h in (0.86, 0.5):
                    pts = [tuple(np.array(a) + (np.array(b) - np.array(a)) * t + np.array((0, h - 0.07 * math.sin(math.pi * t), 0))) for t in np.linspace(0, 1, 6)]
                    k.tube(pts, 0.022, Mr, ROPE, n=4, v_len=0.12)
    # Lantern posts: at the landing's outer corners and at the boardwalk's end, an arm out over the walk.
    for x, z in LAMP_POSTS:
        y = top + walk_y(z)
        k.beam((x, y - 1.2, z), (x, y + 2.25, z), 0.11, 0.11, 0.015, W, POST, segs=1, uv_len=1.2)
        sx = -1 if x > 0 else 1
        k.beam((x, y + 2.15, z), (x + sx * 0.5, y + 2.15, z), 0.07, 0.08, 0.0, W, POST, uv_len=1.0)
        k.beam((x, y + 1.8, z), (x + sx * 0.3, y + 2.12, z), 0.05, 0.05, 0.0, W, POST, uv_len=1.0)
    # The entrance, under the eave (a machiya's front door): dark timber posts on stone footings, a head beam the noren
    # hangs from (the hours model's), the bar's kanban over it in a dark frame, and a sacred straw rope (shimenawa)
    # across the beam with its straw tassels and white paper zigzags (shide).
    for sx in (-1, 1):
        x = sx * GATE_X
        k.lathe((x, top, GATE_Z), [(0.15, 0.0), (0.15, 0.08), (0.11, 0.13), (0.0, 0.13)], M["stone"], "#9a958c", n=8)
        k.beam((x, top + 0.1, GATE_Z), (x, 3.05, GATE_Z), 0.15, 0.15, 0.015, W, POST, segs=1, uv_len=1.2)
    k.beam((-GATE_X - 0.22, GATE_Y, GATE_Z), (GATE_X + 0.22, GATE_Y, GATE_Z), 0.13, 0.16, 0.015, W, POST, segs=1)
    k.beam((-GATE_X - 0.12, 3.0, GATE_Z), (GATE_X + 0.12, 3.0, GATE_Z), 0.12, 0.12, 0.015, W, POST, segs=1)
    ky = (GATE_Y + 2.94) / 2
    box(k, (0, ky, GATE_Z + 0.04), (1.62, 0.42, 0.06), W, POST, r=0.015)
    box(k, (0, ky, GATE_Z + 0.07), (1.48, 0.3, 0.03), W, HINOKI, uv_len=1.0, v_axis=0)
    fish = [(0.3, 0.0), (0.16, 0.07), (-0.03, 0.08), (-0.19, 0.03), (-0.3, 0.09), (-0.27, 0.0), (-0.3, -0.09), (-0.19, -0.03), (-0.03, -0.08), (0.16, -0.07)]
    k.extrude(fish, GATE_Z + 0.085, GATE_Z + 0.095, Mp, INK, at=(-0.12, ky, 0))
    k.lathe((0.42, ky, GATE_Z + 0.085), [(0.0, 0.0), (0.075, 0.0), (0.075, 0.012), (0.0, 0.012)], Mp, RED, d=(0, 0, 1), n=10)
    zs, straw = GATE_Z + 0.13, "#d2b874"
    mid = lambda t: np.array((-GATE_X - 0.05 + (2 * GATE_X + 0.1) * t, GATE_Y - 0.1 - 0.13 * math.sin(math.pi * t), zs))
    for strand in range(2):
        pts = [mid(t) + np.array((0, 0.045 * math.cos(t * 26 + strand * math.pi), 0.045 * math.sin(t * 26 + strand * math.pi)))
               for t in np.linspace(0, 1, 22)]
        k.tube([tuple(p) for p in pts], 0.05, Mr, straw, n=5, v_len=0.15, radii=[0.75 + 0.35 * math.sin(math.pi * t) for t in np.linspace(0, 1, 22)])
    for t in (0.25, 0.5, 0.75):   # the straw tassels
        p = mid(t)
        k.lathe((p[0], p[1] - 0.04, p[2]), [(0.04, 0.0), (0.05, -0.12), (0.0, -0.22)], Mr, straw, d=(0, 1, 0), n=5)
    for t in (0.375, 0.625):      # the paper zigzags
        p = mid(t)
        zig = [(0.0, 0.0), (0.05, -0.08), (-0.01, -0.13), (0.05, -0.22), (0.0, -0.28)]
        for (u0, v0), (u1, v1) in zip(zig, zig[1:]):
            panel(k, Mp, [(p[0] + u0 - 0.03, p[1] + v0, zs + 0.06), (p[0] + u0 + 0.03, p[1] + v0, zs + 0.06),
                          (p[0] + u1 + 0.03, p[1] + v1, zs + 0.06), (p[0] + u1 - 0.03, p[1] + v1, zs + 0.06)], "#fbf8f0")
    return k.finish(smooth_deg=40)


def hours(M):
    """What opens and shuts with the bar's hours, drawn by the bar (components/game/SushiBar.tsx): `shutters`, bamboo
    blinds rolled down over the front and the deck's sides while it's closed (rolled up about their tops, HOURS_TOP);
    `noren`, the split curtain hung in the entrance while it's open."""
    W, Mr, Mc = M["wood"], M["rope"], M["cloth"]
    k = K.Kit("shutters")
    y0, y1 = FLOOR + 0.03, HOURS_TOP

    def blind(p0, p1):
        """A blind between game points p0 and p1 (its bottom edge), slats across it in two bamboo tones, cords down it."""
        a, b = np.array(p0), np.array(p1)
        n = 34
        for i in range(n):
            ya, yb = y0 + (y1 - y0) * i / n, y0 + (y1 - y0) * (i + 1) / n - 0.006
            col = mix("#c8a868", "#e2c88e", 0.15 + 0.7 * ((i * 7) % 5) / 4)
            panel(k, W, [(a[0], ya, a[2]), (b[0], ya, b[2]), (b[0], yb, b[2]), (a[0], yb, a[2])], col, uv=(0, 1), uv_len=1.5)
        for t in (0.15, 0.5, 0.85):
            c = a + (b - a) * t
            k.tube([(c[0], y0, c[2]), (c[0], y1, c[2])], 0.01, Mr, ROPE, n=3, v_len=0.12)
        k.beam((a[0], y0 + 0.02, a[2]), (b[0], y0 + 0.02, b[2]), 0.04, 0.04, 0.0, W, POST, uv_len=1.5)
        k.beam((a[0], y1, a[2]), (b[0], y1, b[2]), 0.07, 0.07, 0.0, W, POST, uv_len=1.5)

    z = HEADER_Z - 0.2
    for a, b in ((-4.3, -1.5), (-1.5, 1.5), (1.5, 4.3)):
        blind((a + 0.17, 0, z), (b - 0.17, 0, z))
    for sx in (-1, 1):
        blind((sx * (HW - 0.03), 0, HD + 0.12), (sx * (HW - 0.03), 0, HEADER_Z - 0.16))
    shutters = k.finish(smooth_deg=30)
    # The noren: three deep indigo panels from the entrance's head beam, a white wave across their feet, the bar's
    # crest (a white ring round a fish) on the middle one.
    k = K.Kit("noren")
    top, drop, zc = GATE_Y - 0.08, 0.8, GATE_Z + 0.02
    for i in range(3):
        x0 = -GATE_X + 0.1 + i * (2 * GATE_X - 0.2) / 3
        w = (2 * GATE_X - 0.2) / 3 - 0.03
        cloth_grid(k, Mc, lambda u, v, x0=x0, w=w: (x0 + w * u, top - drop * v, zc + 0.015 * math.sin(u * math.pi + i) * v),
                   2, 3, lambda t: mix(NAVY, "#1a2540", t))
        cloth_grid(k, Mc, lambda u, v, x0=x0, w=w: (x0 + w * u, top - drop * (0.72 + 0.1 * v) + 0.04 * math.sin((x0 + w * u) * 7.0), zc + 0.012),
                   4, 1, lambda t: "#f1ece2")
    cy = top - 0.3
    k.lathe((0, cy, zc + 0.016), [(0.11, 0.0), (0.15, 0.0), (0.15, 0.004), (0.11, 0.004)], Mc, "#f1ece2", d=(0, 0, 1), n=16)
    k.extrude([(0.08, 0.0), (0.035, 0.035), (-0.035, 0.03), (-0.07, 0.055), (-0.065, 0.0), (-0.07, -0.055), (-0.035, -0.03), (0.035, -0.035)],
              zc + 0.016, zc + 0.02, Mc, "#f1ece2", at=(0.0, cy, 0))
    k.tube([(-GATE_X - 0.1, top + 0.02, zc), (GATE_X + 0.1, top + 0.02, zc)], 0.025, Mc, "#c9a46a", n=5, caps=True)
    noren = k.finish(smooth_deg=40)
    # The nigiri the chef sets on the geta beside each board, one by one, of the fish he cut there (SushiBar.tsx shows
    # them through the mesh's draw range: every piece the same triangles, in order along the geta), and the geta itself
    # (prep-geta-<i>: the server takes it away to a stool, and the chef has a fresh one when he starts there again).
    prep = []
    for i, (bx, kind) in enumerate(BOARDS):
        k = K.Kit(f"prep-{i}")
        for j in range(4):
            F.nigiri(k, M, (bx + GETA_DX - 0.135 + j * 0.09, TOP_Y + 0.051, BOARD_Z), 0.08 * (j % 2 - 0.5), kind, seed=j)
        prep.append(k.finish(smooth_deg=50))
        k = K.Kit(f"prep-geta-{i}")
        F.geta_board(k, M["wood"], (bx + GETA_DX, TOP_Y, BOARD_Z))
        prep.append(k.finish(smooth_deg=40))
    return [shutters, noren, *prep]


def served(M):
    """The served geta (sushi-bar-geta.glb, F.served): drawn by the bar at each stool it's set before, on the serving
    shelf, and in the server's hands as he brings it (SushiBar.tsx); its origin the middle of its foot."""
    k = K.Kit("sushi-bar-geta")
    F.served(k, M, (0.0, 0.0, 0.0))
    return k.finish(smooth_deg=50)


def pane_glass():
    """A see-through glass (alpha blended in the GLB) for the fish case and the tank."""
    M = K.Mat("M_PaneGlass", rough=0.3)
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
    roof(k, M["wood"], M["paint"], M["metal"])
    walls(k, M["wood"], M["stone"])
    counter(k, M)
    stools(k, M["wood"], M["cloth"], M["rope"])
    kitchen(k, M["wood"], M["paint"], M["glass"], M["stone"])
    bottles(k, M["glass"], M["paint"])
    speakers(k, M["paint"])
    fan(k, M["paint"], M["cloth"])
    drapes(k, M["cloth"], M["paint"])
    signs_and_menu(k, M["wood"], M["paint"])
    tank(k, M["wood"], M["paint"], M["pane"], M["stone"])
    plants(k, M["paint"], M["wood"])
    lucky_cat(k, M["paint"], M["metal"], (3.78, TOP_Y, 1.3), -1.27)
    sake_casks(k, M["paint"], M["rope"])
    posters(k, M["paint"])
    k.tint_gradient(0.86, 1.0, 0.0, RIDGE_Y)
    return k.finish(smooth_deg=40)


# ================================================================ the view from a stool, and the chef's knife
# Islands out to sea through the window (David, phase A round 2: "the background should have the small islets or maybe
# some islands in the distance"), drawn only while you sit at the bar (SushiBar.tsx). The curved world sinks far things
# by the square of their distance in view (lib/game/curvedWorld.ts: z² WORLD_BEND + x² WORLD_BEND_SIDE), so the sea's
# horizon from a stool's eye (EYE, lib/game/sushiBar.ts seatView, the middle stools') is only about 28 out; each island
# is raised so its foot sits on that horizon line however far it is, (d sqrt(k) - sqrt(h))² over the sea for the eye h
# over it (the floor stands 0.78 over the sea).
EYE, SEA, BEND, BEND_SIDE = (0.5, SEAT_TOP + 1.1, SEAT_Z + 0.4), -0.78, 0.0032, 0.0011
ISLES = ((-34, 44, "karst", 1.0), (-21, 64, "pair", 0.85), (-12, 88, "long", 1.6), (6, 33, "islet", 1.0), (15, 46, "torii", 1.0),
         (25, 60, "pair", 1.1), (42, 40, "cliff", 1.0))
ROCK, ROCK_DARK, ROCK_WET, GREEN, GREEN_DARK, SAND = "#a9b0aa", "#7f8a86", "#56615f", "#6aa04e", "#3f7a3a", "#ecdcae"
VERT = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))     # extrude's sweep (local z) up the game y, its outline on the ground


def isle_base(theta, d):
    """Where an island d out from EYE, theta degrees right of straight out of the window, stands: x, its foot's y, z."""
    a = math.radians(theta)
    kk, h = BEND * math.cos(a) ** 2 + BEND_SIDE * math.sin(a) ** 2, EYE[1] - SEA
    return EYE[0] + d * math.sin(a), SEA + (d * math.sqrt(kk) - math.sqrt(h)) ** 2 - 0.35, EYE[2] - d * math.cos(a)


def palm(k, M, x, y, z, h, lean):
    k.tube([(x, y, z), (x + lean * 0.4, y + h * 0.55, z), (x + lean, y + h, z)], 0.09, M, "#8a6a4a", n=4, radii=[1.2, 1.0, 0.8])
    top = np.array((x + lean, y + h, z))
    for i in range(6):
        a = i * math.tau / 6 + x
        d = np.array((math.cos(a), 0.0, math.sin(a)))
        tip, mid = top + d * 1.1 + np.array((0, -0.55, 0)), top + d * 0.6 + np.array((0, 0.12, 0))
        side = np.cross(d, (0, 1, 0)) * 0.22
        k.face([k.vert(tuple(top)), k.vert(tuple(mid + side)), k.vert(tuple(tip)), k.vert(tuple(mid - side))], [(0, 0)] * 4, M,
               mix(GREEN_DARK, GREEN, (i % 3) / 2))


def tree(k, M, x, y, z, r, seed):
    """A round-crowned tree clinging to a ledge: a short trunk under two lumps of leaves."""
    k.tube([(x, y - 0.2, z), (x, y + r * 0.8, z)], 0.08 * r, M, "#6a5040", n=4)
    k.blob((x, y + r * 1.1, z), (r, r * 0.75, r), M, mix(GREEN_DARK, GREEN, 0.4), segs=7, rings=4, seed=seed, lumpy=0.35)
    k.blob((x + r * 0.5, y + r * 0.8, z + r * 0.3), (r * 0.6, r * 0.5, r * 0.6), M, GREEN_DARK, segs=6, rings=3, seed=seed + 1, lumpy=0.3)


def stack(k, M, x, y, z, w, h, seed):
    """A limestone stack (karst): tiers of fluted rock, undercut at the waterline, each tier set back from the one below
    or overhanging it, so ledges step up its sides; streaked darker down its flutes; jungle on its ledges and its top."""
    r = np.random.default_rng(seed)
    tiers = [(0.0, 0.1, 0.72), (0.1, 0.38, 1.0), (0.38, 0.6, 0.86), (0.6, 0.82, 0.92), (0.82, 1.0, 0.7)]
    cx, cz, n = 0.0, 0.0, 11
    for j, (t0, t1, ww) in enumerate(tiers):
        rad = [w * ww * (1 + 0.28 * (r.random() - 0.5)) for _ in range(n)]
        ring = [(rad[i] * math.cos(math.tau * i / n), rad[i] * 0.8 * math.sin(math.tau * i / n)) for i in range(n)]
        faces = k.extrude(ring, y + t0 * h, y + t1 * h + 0.05, M, ROCK, rot=VERT, at=(x + cx, 0, z + cz), caps=True)
        for i, f in enumerate(faces):
            col = ROCK_WET if j == 0 else (ROCK_DARK if (i + j) % 3 == 0 else mix(ROCK, ROCK_DARK, r.uniform(0, 0.4)))
            for lp in f.loops:
                lp[k.col] = (*K.lin(col), 1.0)
        if 0 < j < len(tiers) - 1 and r.random() < 0.7:        # jungle on the ledge
            a = r.uniform(0, math.tau)
            tree(k, M, x + cx + w * ww * 0.7 * math.cos(a), y + t1 * h, z + cz + w * ww * 0.55 * math.sin(a), 0.45 * w, seed + j)
        cx, cz = cx + r.uniform(-0.12, 0.12) * w, cz + r.uniform(-0.1, 0.1) * w
    top = y + h + 0.05
    k.blob((x + cx, top + 0.15, z + cz), (w * 0.8, 0.55, w * 0.65), M, GREEN, segs=8, rings=4, seed=seed + 9, lumpy=0.4)
    tree(k, M, x + cx - w * 0.3, top + 0.3, z + cz + 0.2, 0.55 * w, seed + 11)
    palm(k, M, x + cx + w * 0.25, top + 0.3, z + cz, 1.5, 0.45)


def torii(k, M, x, y, z, s):
    """A red torii on a rock in the sea: two posts, the tie beam, and the top beam swept up at its ends."""
    for sx in (-1, 1):
        k.beam((x + sx * 0.9 * s, y, z), (x + sx * 0.82 * s, y + 2.3 * s, z), 0.18 * s, 0.18 * s, 0.0, M, "#d23a2a", segs=1)
    k.beam((x - 1.15 * s, y + 1.75 * s, z), (x + 1.15 * s, y + 1.75 * s, z), 0.12 * s, 0.16 * s, 0.0, M, "#d23a2a", segs=1)
    top = [(x + u * 1.5 * s, y + (2.45 + 0.18 * u ** 4) * s, z) for u in np.linspace(-1, 1, 7)]
    k.tube(top, 0.13 * s, M, "#2a2420", n=4)
    k.tube([(p[0], p[1] - 0.16 * s, p[2]) for p in top[1:-1]], 0.11 * s, M, "#d23a2a", n=4)


def hut(k, M, x, y, z, s):
    """A fisherman's hut on stilts: a plank box under a steep thatched roof."""
    for dx, dz in ((-0.6, -0.5), (0.6, -0.5), (-0.6, 0.5), (0.6, 0.5)):
        k.beam((x + dx * s, y - 0.5, z + dz * s), (x + dx * s, y + 0.5 * s, z + dz * s), 0.1 * s, 0.1 * s, 0.0, M, "#6a5040", segs=1)
    k.rbox((x, y + 0.95 * s, z), (1.4 * s, 0.9 * s, 1.2 * s), 0.0, M, "#9a7a58", segs=1)
    k.lathe((x, y + 1.35 * s, z), [(1.15 * s, 0.0), (0.0, 1.1 * s)], M, "#c9a868", n=4, phase=math.pi / 4)


def lighthouse(k, M, x, y, z, s):
    """A far lighthouse: a white tapered tower in red bands, its lamp room dark under a red cap."""
    k.lathe((x, y, z), [(0.6 * s, 0.0), (0.4 * s, 3.6 * s), (0.0, 3.6 * s)], M, "#f1ece2", n=8)
    for y0 in (0.9, 2.3):
        k.lathe((x, y + y0 * s, z), [(0.62 * s - 0.05 * y0 * s, 0.0), (0.6 * s - 0.05 * y0 * s, 0.5 * s)], M, "#c8342a", n=8)
    k.lathe((x, y + 3.6 * s, z), [(0.0, 0.0), (0.42 * s, 0.0), (0.42 * s, 0.55 * s), (0.0, 0.55 * s)], M, "#3a3a40", n=8)
    k.lathe((x, y + 4.15 * s, z), [(0.5 * s, 0.0), (0.0, 0.45 * s)], M, "#c8342a", n=8)


def isles(M):
    """The islands out to sea (David, round 3: "the background islants need to look better than just blobs"): limestone
    stacks in tiers with ledges, fluted and streaked, jungle on their ledges and palms on their tops (a karst bay in our
    style), a long low island with a lighthouse at its end, a sandy islet with a fisherman's hut and palms, a torii on its
    rock in the sea. One plain matte material, one draw."""
    S = M["stone"]
    k = K.Kit("sushi-bar-isles")
    for n, (theta, d, kind, s) in enumerate(ISLES):
        x, y, z = isle_base(theta, d)
        if kind in ("karst", "pair", "cliff"):
            stacks = {"karst": ((0, 0, 1.5, 9.0), (2.4, 0.8, 0.9, 4.5)), "pair": ((-1.8, 0, 1.4, 8.5), (2.0, 0.8, 1.1, 6.0)),
                      "cliff": ((0, 0, 2.6, 7.0), (2.9, 0.3, 1.4, 5.0), (-2.4, -0.4, 1.2, 3.6))}[kind]
            for j, (ox, oz, w, h) in enumerate(stacks):
                stack(k, S, x + ox * s, y - 0.3, z + oz * s, w * s, h * s, 100 * n + 10 * j)
            k.blob((x, y + 0.1, z), (3.2 * s, 0.4, 2.2 * s), S, SAND, segs=10, rings=4, seed=n, lumpy=0.2)
        elif kind == "long":
            k.blob((x, y + 0.2, z), (9.0 * s, 0.6, 2.8 * s), S, SAND, segs=12, rings=4, seed=1, lumpy=0.2)
            for j, (ox, w, h) in enumerate(((-4.6, 2.2, 2.6), (-1.2, 2.8, 3.8), (2.6, 2.2, 2.8))):
                stack(k, S, x + ox * s, y, z, w * s * 0.6, h * s, 200 + j)
            for ox in (-3.0, 1.0):
                tree(k, S, x + ox * s, y + 0.6, z + 1.2, 1.1 * s, 300 + int(ox))
            lighthouse(k, S, x + 6.8 * s, y + 0.4, z, 0.9 * s)
        elif kind == "islet":
            k.blob((x, y + 0.15, z), (2.4, 0.45, 1.8), S, SAND, segs=10, rings=4, seed=2, lumpy=0.2)
            k.blob((x + 1.1, y + 0.45, z - 0.3), (0.9, 0.7, 0.8), S, ROCK_DARK, segs=7, rings=4, seed=3, lumpy=0.35)
            hut(k, S, x - 0.5, y + 0.4, z, 0.9)
            for ox, lean in ((0.9, 0.5), (-1.7, -0.4)):
                palm(k, S, x + ox, y + 0.45, z + 0.4, 2.3, lean)
        else:
            k.blob((x, y + 0.2, z), (1.4, 0.7, 1.1), S, ROCK_WET, segs=8, rings=4, seed=5, lumpy=0.35)
            torii(k, S, x, y + 0.6, z, 0.9 * s)
    return k.finish(smooth_deg=60)


def knife(M):
    """Bancha's knife (a yanagiba), held as the workbench's hammer is (Character.tsx HELD_GRIPS hammer; art/props-enemies
    build_forage.py): rig units, the grip at the origin, the handle up +y, the long blade on past it, its edge toward
    +z (the hammer's face, so the Craft clip's blows come down edge first). Its parts plain colours of one look, as
    every tool's are (merged into one mesh in the hand: lib/game/character/heldMesh.ts)."""
    k = K.Kit("sushi-knife")
    part = {p: K.Mat(f"knife_{p}", rough=0.55) for p in ("Handle", "Collar", "Blade")}
    k.lathe((0, -0.035, 0), [(0.0, 0.0), (0.011, 0.0), (0.012, 0.05), (0.011, 0.1), (0.0, 0.1)], part["Handle"], "#e2cfa0", n=6)
    k.lathe((0, 0.064, 0), [(0.0, 0.0), (0.0125, 0.0), (0.0125, 0.015), (0.0, 0.015)], part["Collar"], INK, n=6)
    blade = [(-0.005, 0.078), (0.019, 0.078), (0.019, 0.195), (0.012, 0.232), (-0.005, 0.252)]
    k.extrude(blade, -0.0018, 0.0018, part["Blade"], "#dfe4e8", rot=Matrix(((0, 0, 1), (0, 1, 0), (1, 0, 0))))
    return k.finish(smooth_deg=40)


# ================================================================ what glows
# Paper lanterns (chochin: x, z, glow, radius, the height they hang from, a tassel): over the counter, inside the front
# header, under the lamp posts' arms outside, the big red pair at the entrance; a row of small ones on a cord across
# the kitchen, in front of the bottles (David, phase A round 2: "lanters better modeled"); and one under each of the
# roof's turned-up corners (round 3: "have lanterns on the corners").
CORNERS = [roof_pt(sx * (ROOF_X - 0.3), 1.0, front, -0.13) for sx in (-1, 1) for front in (True, False)]
ROW_Y = 2.9
LANTERNS = ([(x, 1.5, key, r, PLATE_Y - 0.08, True) for x, key, r in ((-3.0, "red", 0.22), (-1.0, "lantern", 0.25), (1.0, "lantern", 0.25), (3.0, "red", 0.22))]
            + [(x, HEADER_Z - 0.2, key, 0.2, HEADER_Y - 0.12, False) for x, key in ((-2.9, "lantern"), (0.0, "red"), (2.9, "lantern"))]
            + [(x - math.copysign(0.45, x), z, "lantern", 0.17, FLOOR - 0.02 + walk_y(z) + 2.11, False) for x, z in LAMP_POSTS]
            + [(sx * 1.32, GATE_Z + 0.1, "red", 0.22, 3.1, True) for sx in (-1, 1)]
            + [(-3.5 + i * 0.7, -0.1, "red" if i % 2 else "lantern", 0.095, ROW_Y - 0.1 * math.sin(math.pi * (i + 0.5) / 11) - 0.02, False) for i in range(11)]
            + [(x, z, "red", 0.18, y, True) for x, y, z in CORNERS])


def chochin(k, G, Mp, x, z, key, r, hang, tassel):
    """A paper lantern: a tall ribbed paper body (each rib its own darker glow), black lacquer caps top and bottom, a
    cord up to where it hangs; a red tassel under the counter's and the entrance's."""
    n, bands = (10, 6) if r > 0.15 else (8, 4)
    H = 2.6 * r
    cy = hang - 0.08 - H / 2 - 0.1 * r
    ts = [0.0] + [b / bands + d for b in range(1, bands) for d in (-0.012, 0.012)] + [1.0]
    prof = [(0.0, -H / 2)]
    for j, t in enumerate(ts):
        pinch = 0.95 if 0 < j < len(ts) - 1 else 1.0
        prof.append((r * math.sqrt(1 - 0.72 * (2 * t - 1) ** 2) * pinch, -H / 2 + H * t))
    prof.append((0.0, H / 2))
    faces = k.lathe((x, cy, z), prof, G, "#ffffff", n=n)
    rib = key + "-rib" if key + "-rib" in GLOWS else key
    for band in range(len(prof) - 1):
        glow_uv(k, faces[band * n:(band + 1) * n], rib if band % 2 == 0 and 0 < band < len(prof) - 2 else key)
    for s in (-1, 1):
        k.lathe((x, cy + s * H / 2, z), [(r * 0.6, -s * 0.02), (r * 0.6, s * 0.11 * r + s * 0.01), (0.0, s * 0.11 * r + s * 0.01)], Mp, INK, n=n)
    k.tube([(x, hang, z), (x, cy + H / 2 + 0.11 * r, z)], 0.007, Mp, INK, n=3)
    if tassel:
        b = cy - H / 2 - 0.11 * r
        k.tube([(x, b, z), (x, b - 0.05, z), (x, b - 0.1 - 0.5 * r, z)], 0.012 + 0.04 * r, Mp, RED, n=5, radii=[0.4, 0.6, 1.2])


def glow(M):
    G, Mp = M["glow"], M["paint"]
    k = K.Kit("sushi-bar-glow")
    for lantern in LANTERNS:
        chochin(k, G, Mp, *lantern)
    # An iron hook under each roof corner the corner lanterns hang from.
    for x, y, z in CORNERS:
        k.tube([(x, y + 0.1, z), (x, y - 0.01, z), (x + 0.03, y - 0.04, z)], 0.012, Mp, INK, n=4)
    # The cord the kitchen's row of small lanterns hangs from.
    k.tube([(-3.95 + 7.9 * t, ROW_Y - 0.1 * math.sin(math.pi * t), -0.1) for t in np.linspace(0, 1, 12)], 0.008, Mp, INK, n=3)
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
    for x0, x1 in CASE_RUNS:
        glow_uv(k, k.rbox(((x0 + x1) / 2, CASE_TOP + 0.006, SERVE_Z1 + 0.012), (x1 - x0 - 0.1, 0.01, 0.02), 0.0, G, segs=1), "bulb")
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
         "stone": K.Mat("P_Stone", rough=0.95), "metal": K.Mat("P_Metal", rough=0.4), "pane": pane_glass(), "glow": glow_mat()}
    out = {}
    for name, fn in (("sushi-bar", bar), ("sushi-bar-glow", glow), ("sushi-bar-pier", pier), ("sushi-bar-hours", hours), ("sushi-bar-isles", isles),
                     ("sushi-bar-geta", served), ("sushi-knife", knife)):
        obs = fn(M)
        obs = obs if isinstance(obs, list) else [obs]
        K.export(obs, f"game/{'tools' if name == 'sushi-knife' else 'buildings'}/{name}.glb")
        for ob in obs:
            report(ob)
        out[name] = obs
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
    shown = [o for name, group in obs.items() for o in group if name != "sushi-knife"]
    for o in obs["sushi-knife"]:
        o.hide_render = True
    isles_ob = obs["sushi-bar-isles"][0]
    obs["sushi-bar-geta"][0].location = K.G(SEATS[2], SERVE_Y, (SERVE_Z0 + SERVE_Z1) / 2)
    shutters, noren, *_ = obs["sushi-bar-hours"]
    K.show_vertex_colors(shown)
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    sun = bpy.data.lights.new("Key", "SUN")
    so = bpy.data.objects.new("Key", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-150))
    # The sea under the stilts (the floor 0.78 over it) and the sand where the boardwalk lands.
    me = bpy.data.meshes.new("ground")
    me.from_pydata([K.G(-30, -0.4, WALK_Z - 0.5), K.G(30, -0.4, WALK_Z - 0.5), K.G(30, -0.4, 40), K.G(-30, -0.4, 40)], [], [(0, 1, 2, 3)])
    sea = bpy.data.meshes.new("sea")
    sea.from_pydata([K.G(-60, -0.78, 40), K.G(60, -0.78, 40), K.G(60, -0.78, -80), K.G(-60, -0.78, -80)], [], [(0, 1, 2, 3)])
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
    shots = {"front": ((8.5, 4.6, 19.0), (0.0, 0.9, 3.0), 26, (1200, 800)),
             "back": ((-6.0, 3.6, -11.0), (0.0, 1.0, 0.0), 30, (1200, 800)),
             "seat": (EYE, (0.45, 1.05, -2.5), 20, (1280, 800)),
             "gate": ((0.6, 1.5, 8.6), (0.0, 2.1, 4.2), 30, (1000, 800)),
             "corner": ((7.2, 2.2, 7.8), (4.4, 3.4, 3.6), 40, (1000, 800)),
             "food": ((SEATS[2] + 0.05, SERVE_Y + 0.38, 1.38), (SEATS[2], SERVE_Y + 0.02, 0.7), 50, (1000, 800)),
             "case": ((SEATS[3], TOP_Y + 0.35, 1.75), (SEATS[3] - 0.2, TOP_Y + 0.02, 0.6), 38, (1000, 800)),
             "isles": (EYE, (0.45, 2.2, -40.0), 26, (1400, 700))}
    frames = []
    for night in (False, True):
        shutters.hide_render, noren.hide_render = night, not night
        bg.inputs[0].default_value = (*K.lin("#12203f" if night else "#bfe3f2"), 1)
        bg.inputs[1].default_value = 0.35 if night else 1.0
        sun.energy = 0.15 if night else 3.0
        sun.color = (0.6, 0.7, 1.0) if night else (1.0, 0.95, 0.88)
        glow_b.inputs["Emission Strength"].default_value = 3.0 if night else 0.0
        for name, (at, look, lens, (w, h)) in shots.items():
            if night and name in ("back", "corner", "food", "case", "isles"):
                continue
            # The islands are raised for the curved world's horizon (they float over this flat sea): shown on their own.
            for o in shown:
                o.hide_render = (o is not isles_ob) if name == "isles" else o is isles_ob
            bpy.data.objects["sea"].hide_render = name == "isles"
            shutters.hide_render, noren.hide_render = night or name == "isles", not night or name == "isles"
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
