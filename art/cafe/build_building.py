"""The café building in the village (specs/cafe-polish.md item 8), to match the premium interior: warm wood and glass,
a deep green awning, a gable front with the lightbox sign, big shopfront windows that glow amber at night. The village
style, matte; one 5 x 5 footprint on the ACNH grid (lib/game/defaultIsland.ts LANDMARK_INFO.cafe half [2.5, 2.5]).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/cafe/build_building.py

Writes web/public/assets/game/buildings/cafe.glb. Origin = footprint centre on the ground; the front faces -z (the
camera). Two states share the model; the engine (CafeBuilding.tsx) shows one:
  cafe_planks      boards over the windows and door, a hand-painted CLOSED board: until the club goal (closed)
  cafe_open        the A-frame menu board and the OPEN sign: after it (open)
Glow materials the engine drives: M_Interior (the room seen through the glass, amber at night), M_Lantern (the
porch lanterns), M_OpenSign. The sign's face (CAFÉ) is drawn by the engine on the open front of the lightbox.
"""
import math, os, random, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cafekit as K  # noqa: E402
from cafekit import Mat, Model  # noqa: E402

PI = math.pi
HW, HD = 2.5, 2.5            # footprint half extents
FZ = -2.0                    # the front wall (a 0.5 porch under the awning, inside the footprint)
EAVE, RIDGE = 2.55, 3.95     # wall top, roof ridge
DOOR_W, DOOR_H = 1.05, 2.0
SILL = 0.6                   # shopfront window sill


def interior_texture():
    """The room through the glass: a warm wood back wall, a band of glowing menu boards and a dark counter."""
    h, w = 256, 512
    img = np.zeros((h, w, 3))
    top, bottom = np.array(K.hexrgb("#6a3f22")), np.array(K.hexrgb("#3a2414"))
    t = np.linspace(0, 1, h)[:, None, None]
    img[:] = top * (1 - t) + bottom * t
    for x0 in (60, 200, 340):                       # menu boards
        img[40:80, x0:x0 + 110] = K.hexrgb("#f6e2bc")
    img[150:256, :] = K.hexrgb("#2a1a10")              # the counter
    img[146:152, :] = K.hexrgb("#b07a46")              # its oak top
    for x in (120, 290, 450):                         # pendant glows
        yy, xx = np.mgrid[0:h, 0:w]
        d = np.hypot(xx - x, (yy - 100) * 1.4)
        img += (np.clip(1 - d / 60, 0, 1) ** 2)[..., None] * np.array([0.35, 0.22, 0.08])
    return K.image("cafe_interior", np.clip(img, 0, 1))


def materials():
    tex = {
        "clad": K.image("cladding", K.wood(512, "#7a4c2c", "#a06a3e", seed=41, planks=6, joint="#4a2c18", joint_px=4, streak=0.35)),
        "oak": K.image("oak_ext", K.wood(512, "#b98450", "#d4a46c", seed=42, planks=3, joint="#9a6a3c", joint_px=1, streak=0.35)),
        "stone": K.image("plinth", K.tiles(512, 4, "#b8ad9b", "#8c8170", grout_px=5, vary=0.06, seed=43, rows=2)),
    }
    return {
        "clad": Mat("M_Cladding", "#8a5a34", 0.85, tex["clad"], tile=1.6),
        "oak": Mat("M_Oak", "#c58f58", 0.75, tex["oak"], tile=1.4),
        "trim": Mat("M_Trim", "#3a2416", 0.8),
        "cream": Mat("M_Cream", "#efe4cc", 0.8),
        "stone": Mat("M_Stone", "#b8ad9b", 0.9, tex["stone"], tile=1.2),
        "roof": Mat("M_Roof", "#3b3a3c", 0.75),
        "seam": Mat("M_RoofSeam", "#525054", 0.7),
        "awning": Mat("M_Awning", "#3f5e47", 0.9),
        "awning2": Mat("M_AwningStripe", "#e9dfc8", 0.9),
        "black": Mat("M_Iron", "#2a2826", 0.6),
        "brass": Mat("M_Brass", "#b88a4a", 0.45),
        "glass": Mat("M_Glass", "#cfe6ea", 0.1, alpha=0.3),
        "interior": Mat("M_Interior", "#8a5a34", 0.9, interior_texture(), tile=1.8, glow=1.0, glow_color="#ffc070"),
        "lantern": Mat("M_Lantern", "#ffd9a0", 0.5, glow=1.0, glow_color="#ffcf8a"),
        "opensign": Mat("M_OpenSign", "#ff9a6a", 0.5, glow=1.0, glow_color="#ff7a4a"),
        "plank": Mat("M_Plank", "#8f6a45", 0.95, tex["oak"], tile=0.9),
        "plank2": Mat("M_PlankGrey", "#7b6a58", 0.95),
        "nail": Mat("M_Nail", "#3a3632", 0.6),
        "chalk": Mat("M_Chalkboard", "#2a3330", 0.9),
        "chalkline": Mat("M_Chalk", "#e8e2d4", 0.9),
        "leaf": Mat("M_Leaf", "#5f7f4a", 0.85),
        "leaf2": Mat("M_LeafLight", "#7c9a5c", 0.85),
        "soil": Mat("M_Soil", "#3b2a1e", 1.0),
        "pot": Mat("M_Planter", "#6e4428", 0.85),
        "flower": Mat("M_Flower", "#f0d24a", 0.8),
    }


def building(M):
    walls, front, roof, deco, glass = Model("cafe_walls"), Model("cafe_front"), Model("cafe_roof"), Model("cafe_deco"), Model("cafe_glass")
    planks, opened = Model("cafe_planks"), Model("cafe_open")
    P = 0.18                                                   # plinth height
    # --- plinth (the whole footprint), a step at the door
    walls.box((0, P / 2, 0), (2 * HW, P, 2 * HD), M["stone"], bevel=0.02)
    walls.box((0, 0.05, -HD - 0.12), (1.6, 0.1, 0.26), M["stone"], bevel=0.015)
    # --- side and back walls: vertical cladding between dark corner posts
    WT = 0.2
    walls.box((0, (P + EAVE) / 2, HD - 0.3), (2 * HW - 0.3, EAVE - P, WT), M["clad"])                  # back
    for s in (-1, 1):
        walls.box((s * (HW - 0.15), (P + EAVE) / 2, (FZ + HD - 0.3) / 2), (WT, EAVE - P, HD - 0.3 - FZ), M["clad"])
        for z in (FZ, HD - 0.3):
            walls.box((s * (HW - 0.15), (P + EAVE) / 2, z), (0.28, EAVE - P, 0.28), M["trim"], bevel=0.02)
        # a small side window on each side wall
        walls.box((s * (HW - 0.04), 1.55, 0.6), (0.06, 0.9, 1.1), M["trim"], bevel=0.015)
        glass.quad([(s * (HW - 0.02), 1.15, 0.12), (s * (HW - 0.02), 1.95, 0.12), (s * (HW - 0.02), 1.95, 1.08), (s * (HW - 0.02), 1.15, 1.08)], M["interior"], (s, 0, 0))
        walls.box((s * (HW - 0.0), 1.1, 0.6), (0.12, 0.06, 1.2), M["oak"], bevel=0.01)
    walls.box((0, EAVE - 0.06, HD - 0.3), (2 * HW - 0.2, 0.12, 0.3), M["trim"])                         # back top plate
    # --- front: wood frame, two big shopfront windows, a glass door, a cladded transom band
    fx0, fx1 = -(HW - 0.3), HW - 0.3
    front.box((0, (EAVE + 2.1) / 2, FZ), (fx1 - fx0, EAVE - 2.1, WT), M["clad"])                        # transom band
    front.box((0, (P + SILL) / 2, FZ), (fx1 - fx0, SILL - P, WT), M["oak"], bevel=0.02)                # sill panel (both sides of the door)
    front.box((0, SILL + 0.03, FZ - 0.08), (fx1 - fx0 + 0.1, 0.06, 0.24), M["oak"], bevel=0.012)
    for x in (fx0, -DOOR_W / 2 - 0.06, DOOR_W / 2 + 0.06, fx1):                                       # mullion posts
        front.box((x, (P + 2.1) / 2, FZ - 0.02), (0.12, 2.1 - P, 0.16), M["trim"], bevel=0.015)
    front.box((0, 2.1, FZ - 0.03), (fx1 - fx0 + 0.12, 0.1, 0.18), M["trim"], bevel=0.015)              # header
    for s in (-1, 1):
        x0, x1 = (DOOR_W / 2 + 0.12, fx1 - 0.06) if s > 0 else (fx0 + 0.06, -DOOR_W / 2 - 0.12)
        glass.quad([(x0, SILL + 0.06, FZ - 0.04), (x1, SILL + 0.06, FZ - 0.04), (x1, 2.05, FZ - 0.04), (x0, 2.05, FZ - 0.04)], M["glass"], (0, 0, -1))
        glass.quad([(x0, SILL + 0.06, FZ + 0.12), (x1, SILL + 0.06, FZ + 0.12), (x1, 2.05, FZ + 0.12), (x0, 2.05, FZ + 0.12)], M["interior"], (0, 0, -1))
        front.box(((x0 + x1) / 2, 1.5, FZ - 0.05), (x1 - x0, 0.05, 0.06), M["trim"])                    # transom bar
        front.box(((x0 + x1) / 2, (SILL + 1.5) / 2, FZ - 0.05), (0.05, 1.5 - SILL, 0.06), M["trim"])    # centre bar
    # the door: a glass panel in an oak frame, a brass push bar
    dx0, dx1 = -DOOR_W / 2, DOOR_W / 2
    glass.quad([(dx0 + 0.12, P + 0.3, FZ - 0.01), (dx1 - 0.12, P + 0.3, FZ - 0.01), (dx1 - 0.12, DOOR_H - 0.1, FZ - 0.01), (dx0 + 0.12, DOOR_H - 0.1, FZ - 0.01)], M["glass"], (0, 0, -1))
    glass.quad([(dx0 + 0.12, P + 0.3, FZ + 0.1), (dx1 - 0.12, P + 0.3, FZ + 0.1), (dx1 - 0.12, DOOR_H - 0.1, FZ + 0.1), (dx0 + 0.12, DOOR_H - 0.1, FZ + 0.1)], M["interior"], (0, 0, -1))
    for x in (dx0 + 0.06, dx1 - 0.06):
        front.box((x, (P + DOOR_H) / 2, FZ), (0.12, DOOR_H - P, 0.08), M["oak"], bevel=0.012)
    for y in (P + 0.15, DOOR_H - 0.05):
        front.box((0, y, FZ), (DOOR_W, 0.12 if y < 1 else 0.1, 0.08), M["oak"], bevel=0.012)
    front.tube([(dx1 - 0.2, 1.05, FZ - 0.08), (dx1 - 0.2, 1.05, FZ - 0.13), (dx0 + 0.2, 1.05, FZ - 0.13), (dx0 + 0.2, 1.05, FZ - 0.08)], 0.018, M["brass"], n=6)
    # porch: corner posts carry the transom band forward, two lanterns by the door
    for s in (-1, 1):
        front.box((s * (HW - 0.15), (P + EAVE) / 2, FZ), (0.28, EAVE - P, 0.28), M["trim"], bevel=0.02)
        lx = s * (DOOR_W / 2 + 0.32)
        deco.box((lx, 1.72, FZ - 0.1), (0.06, 0.16, 0.06), M["black"])
        deco.tube([(lx, 1.8, FZ - 0.1), (lx, 1.8, FZ - 0.26)], 0.012, M["black"], n=5)
        deco.lathe((lx, 1.5, FZ - 0.3), [(0, 0), (0.07, 0), (0.09, 0.05), (0.09, 0.22), (0.05, 0.26), (0, 0.27)], M["lantern"], n=8)
        deco.lathe((lx, 1.76, FZ - 0.3), [(0.1, 0), (0.06, 0.06), (0, 0.08)], M["black"], n=8)
        deco.lathe((lx, 1.47, FZ - 0.3), [(0, 0), (0.08, 0), (0.08, 0.03), (0, 0.03)], M["black"], n=8)
    # --- the awning (ref: a deep green canvas, cream stripes), sloping out over the porch with a straight valance
    ay0, ay1, az0, az1 = 2.42, 2.2, FZ - 0.05, -HD - 0.12
    ax0, ax1 = -(HW - 0.2), HW - 0.2
    n = 9
    for k in range(n):
        x0, x1 = ax0 + (ax1 - ax0) * k / n, ax0 + (ax1 - ax0) * (k + 1) / n
        mat = M["awning"] if k % 2 == 0 else M["awning2"]
        deco.quad([(x0, ay0, az0), (x1, ay0, az0), (x1, ay1, az1), (x0, ay1, az1)], mat, (0, 1, -0.5))
        deco.quad([(x0, ay1, az1), (x1, ay1, az1), (x1, ay1 - 0.22, az1), (x0, ay1 - 0.22, az1)], mat, (0, 0, -1))
    for s in (-1, 1):                                                                                    # awning side cheeks
        deco.quad([(s * ax1, ay0, az0), (s * ax1, ay1, az1), (s * ax1, ay1 - 0.22, az1)], M["awning"], (s, 0, 0))
        deco.tube([(s * (ax1 - 0.05), ay0 + 0.02, az0), (s * (ax1 - 0.05), ay1 - 0.04, az1 + 0.04)], 0.014, M["black"], n=5)
    deco.tube([(ax0, ay1 - 0.01, az1 + 0.01), (ax1, ay1 - 0.01, az1 + 0.01)], 0.02, M["black"], n=6)
    # --- the gable front over the transom: cladding, cream barge boards, the lightbox sign's body (face drawn in engine)
    gz = FZ - 0.02
    gable = [(-(HW - 0.15), EAVE, gz), (HW - 0.15, EAVE, gz), (0, RIDGE - 0.05, gz)]
    front.quad(gable, M["clad"], (0, 0, -1))
    front.quad([(x, y, HD - 0.3 + 0.12) for x, y, _ in gable], M["clad"], (0, 0, 1))
    front.box((0, 3.05, gz - 0.09), (2.0, 0.5, 0.14), M["cream"], bevel=0.025, drop=("-z",))           # sign body (open face)
    for s in (-1, 1):
        front.box((s * 0.85, 2.72, gz - 0.06), (0.06, 0.18, 0.08), M["black"])                         # sign brackets
    # --- the roof: two charcoal slopes with standing seams, overhanging; cream fascia; a stovepipe flue
    ov = 0.32
    zf, zb = FZ - ov - 0.05, HD + 0.02
    for s in (-1, 1):
        x_e, y_e = s * (HW + ov * 0.6), EAVE - 0.18
        pts = [(0, RIDGE, zf), (x_e, y_e, zf), (x_e, y_e, zb), (0, RIDGE, zb)]
        nrm = (s * (RIDGE - y_e), HW + ov * 0.6, 0)
        roof.quad(pts, M["roof"], nrm)
        roof.quad([(px, py - 0.08, pz) for px, py, pz in pts], M["roof"], (-nrm[0], -nrm[1], 0))
        for k in range(1, 9):
            t = k / 9
            x, y = x_e * t, RIDGE + (y_e - RIDGE) * t
            roof.box((x, y + 0.03, (zf + zb) / 2), (0.05, 0.05, zb - zf), M["seam"], yaw=0)
        # fascia boards along the front gable edge and the eave
        L = math.hypot(x_e, RIDGE - y_e)
        ang = math.atan2(RIDGE - y_e, abs(x_e))
        cx, cy = x_e / 2, (RIDGE + y_e) / 2 - 0.04
        roof.rot(roof.box((cx, cy, zf - 0.03), (L + 0.1, 0.16, 0.06), M["cream"], bevel=0.01), (cx, cy, zf - 0.03), "z", -s * ang)
        roof.box((x_e * 0.98, y_e - 0.06, (zf + zb) / 2), (0.08, 0.14, zb - zf), M["cream"], bevel=0.01)
    roof.box((0, RIDGE + 0.04, (zf + zb) / 2), (0.16, 0.08, zb - zf), M["seam"], bevel=0.01)
    roof.cyl((1.35, 2.9, 1.1), 0.1, 1.5, M["black"], n=10)                                               # flue
    roof.lathe((1.35, 4.4, 1.1), [(0, 0), (0.18, 0.0), (0.18, 0.04), (0, 0.16)], M["black"], n=10)
    # --- planters with shrubs and flowers at the porch corners
    rnd = random.Random(7)
    for s in (-1, 1):
        px = s * (HW - 0.55)
        deco.box((px, 0.38, -HD + 0.28), (0.7, 0.4, 0.42), M["pot"], bevel=0.03)
        deco.box((px, 0.57, -HD + 0.28), (0.62, 0.04, 0.34), M["soil"])
        for k in range(9):
            a = rnd.uniform(0, math.tau)
            deco.blob((px + rnd.uniform(-0.25, 0.25), 0.66 + rnd.uniform(0, 0.12), -HD + 0.28 + rnd.uniform(-0.12, 0.12)),
                      (0.14, 0.1, 0.12), M["leaf"] if k % 3 else M["leaf2"], segs=7, rings=4, yaw=a)
        for k in range(5):
            deco.blob((px + rnd.uniform(-0.25, 0.25), 0.8 + rnd.uniform(0, 0.05), -HD + 0.22 + rnd.uniform(-0.08, 0.1)), (0.035, 0.03, 0.035), M["flower"], segs=6, rings=3)

    # --- OPEN state: an A-frame chalk menu by the step and a glowing OPEN sign in the right window
    ax = -1.35
    for s in (-1, 1):                         # two boards leaning together at the top
        c = (ax, 0.44, -HD + 0.05 + s * 0.12)
        opened.rot(opened.box(c, (0.5, 0.86, 0.035), M["oak"], bevel=0.01), (ax, 0.86, -HD + 0.05), "x", -s * 0.16)
        opened.rot(opened.box((ax, 0.46, c[2] + s * 0.021), (0.42, 0.7, 0.01), M["chalk"]), (ax, 0.86, -HD + 0.05), "x", -s * 0.16)
    for k, w in enumerate((0.3, 0.22, 0.26, 0.18)):
        y = 0.7 - k * 0.12
        z = -HD + 0.05 - 0.12 - 0.026 - (0.86 - y) * math.tan(0.16)
        opened.box((ax - 0.06 + (0.3 - w) / 2, y, z), (w, 0.025, 0.004), M["chalkline"])
    opened.box((1.55, 1.25, FZ + 0.06), (0.5, 0.18, 0.03), M["opensign"], bevel=0.01)

    # --- CLOSED state: rough planks across the windows and door, nails, a hand-painted board
    rnd = random.Random(11)

    def plank(cx, cy, length, ang, z):
        mat = M["plank"] if rnd.random() > 0.3 else M["plank2"]
        planks.rot(planks.box((cx, cy, z), (length, 0.17, 0.045), mat, bevel=0.01), (cx, cy, z), "z", ang)
        for e in (-1, 1):
            nx, ny = cx + e * math.cos(ang) * (length / 2 - 0.08), cy + e * math.sin(ang) * (length / 2 - 0.08)
            planks.cyl((nx, ny, z - 0.03), 0.018, 0.012, M["nail"], n=6, d=(0, 0, -1))
    for s in (-1, 1):
        cx = s * (DOOR_W / 2 + (HW - 0.3 - DOOR_W / 2) / 2 + 0.03)
        for k, (cy, ang) in enumerate(((0.95, 0.05), (1.35, -0.07), (1.75, 0.04))):
            plank(cx, cy, 1.55, ang + rnd.uniform(-0.03, 0.03), FZ - 0.12 - k * 0.01)
        plank(cx, 1.35, 1.75, s * 0.62, FZ - 0.16)
    for k, (cy, ang) in enumerate(((0.75, 0.08), (1.4, -0.1))):
        plank(0, cy, 1.25, ang, FZ - 0.12 - k * 0.012)
    planks.box((0.0, 1.08, FZ - 0.2), (0.62, 0.3, 0.03), M["cream"], bevel=0.01)                     # the CLOSED board
    for k, w in enumerate((0.42, 0.3)):
        planks.box((0.0, 1.13 - k * 0.1, FZ - 0.217), (w, 0.04, 0.004), M["trim"])

    return [walls.finish(), front.finish(), roof.finish(), deco.finish(), glass.finish(), planks.finish(), opened.finish()]


def main():
    K.reset()
    M = materials()
    K.export(building(M), "cafe", sub="../buildings")


main()
