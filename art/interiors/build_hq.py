"""HQ's room (specs/interiors/hq.md, phase 2; ledger row 316): both floors, the aquarium and the ceiling, modelled on
the numbers the game walks (art/interiors/hq_layout.json, written from web/lib/game/hqLayout.ts by
web/scripts/hq-layout-json.mjs; change the layout there, never here).

The look, from David's four references (references/interiors/hq/): walnut, concrete and plaster, leather and velvet,
deep carpets and plants, lit by lamps, strips and track spots rather than ceiling panels. Simple and a little cartoony,
with rounded edges (the shop's build, build_shop.py, is the template). Textures only where they're seen up close (the
lane rules): the walnut floor planks (512), and the walnut grain, the plaster, the rug pile, the green marble and the
magazine covers (256 each), all subtle. Everything else is plain colour on the shared presets (P_Stone, P_Metal,
P_Paint, P_Glass, P_Cloth: web/lib/game/modelMaterials.ts MATERIAL_PRESETS), its colour in COLOR_0. The strips, the
lamp shades' undersides and the oval lights are M_Glow. No downloads, no references beyond David's.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/build_hq.py

Writes web/public/assets/game/interiors/hq/:
- ground.glb: hq_ground (the floor; the hall's walls, both storeys high; the ground storey of the walls under the
  mezzanine; the stair; the aquarium's walnut surround; every ground-floor fixture), hq_windows (the panes the engine
  fills with the outside) and hq_caster (shadow only: the ceiling and the cut-away front wall, so daylight comes in by
  the windows);
- upper.glb: hq_upper (the mezzanine's slab, fascia and rail, the upper storey of the walls round it, the lounge, the
  admin doors, the banners, the tracks under the slab) and hq_windows_upper. The game cuts it away while you're under it;
- ceiling.glb: hq_ceiling (the hall's plain dark ceiling, the walnut oval ceiling over the upper lounge, the track
  spots). The game shows it only to a camera under it: the walking camera looks in from above;
- tank.glb: the aquarium's inside (hq_tank_inner), its reef (hq_tank_reef), its glass (hq_tank_glass) and its water's
  surface (hq_tank_surface). The engine gives them the tank's own shaders (components/game/hq/Aquarium.tsx).
Game coordinates throughout (propkit.G): x across (+x on screen left), y up, z into the room.
"""
import json, math, os, sys
import numpy as np
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402

L = json.load(open(os.path.join(HERE, "hq_layout.json")))
F, SLAB = L["floorHeight"], L["slab"]
W, D, T, LIP = L["room"]["halfW"], L["room"]["halfD"], L["room"]["wall"], L["room"]["lip"]
TOP = 2 * F                      # the room's ceiling
S, A, UP = L["stair"], L["aquarium"], L["upper"][0]
FX = {f["id"]: f for f in L["fixtures"]}
LAMPS = {lp["id"]: lp for lp in L["lamps"]}
OUT = "game/interiors/hq"
TAU = math.tau

_rbox = K.Kit.rbox


def _lean_rbox(self, c, size, r, mat, col="#ffffff", rot=None, segs=None, uv_len=1.0, v_axis=None, uv_off=(0.37, 0.21)):
    """propkit's rounded box, one step round a small radius (it reads the same at the room's size, at half the triangles)."""
    return _rbox(self, c, size, r, mat, col, rot=rot, segs=(1 if r <= 0.03 else 2) if segs is None else segs, uv_len=uv_len, v_axis=v_axis, uv_off=uv_off)


K.Kit.rbox = _lean_rbox

# ================================================================ palette (sRGB)
PLASTER, PLASTER_UNDER, CEIL = "#ddd3c6", "#b8aea2", "#3a3430"
WALNUT, WALNUT_DARK, WALNUT_LIGHT = "#8a5d3e", "#5e3d29", "#a3714b"
BLACK, CHARCOAL = "#1e1c1b", "#2e2b29"
LEATHER_BROWN, LEATHER_BLACK = "#8c5533", "#222020"
VELVET, VELVET_DEEP, VELVET_OLIVE = "#7a5236", "#5f3f2b", "#6f6f45"
CREAM, PAPER, WHITE = "#efe7d8", "#f4eee2", "#f3f1ec"
RUG_BLUE, MAT = "#24427c", "#3c352e"
CHROME, STEEL_DARK, BRONZE = "#cfd2d6", "#2f3235", "#2d2925"
STONE, STONE_DARK, POT = "#dccfb9", "#b9ab95", "#5d5853"
BRASS = "#bf9a5a"
LEAF, LEAF_LIGHT, LEAF_DEEP, STEM, SOIL = "#4f7a45", "#6f9a5b", "#3b5e36", "#6b5a45", "#4a3a2e"
CORK = "#b98d5c"
SLATE = "#2b3034"
SHEER = "#f2eee6"
SPINES = ["#7d2e2a", "#2f4a6b", "#d9cba9", "#3d5e47", "#b5863f", "#1f2326", "#8e6d5a", "#c45c3a", "#e9e4d8", "#566270",
          "#6b3d55", "#a8a093"]


# ================================================================ textures (numpy, sRGB, subtle, tileable)
def planks(size=512, seed=3):
    """Wide walnut floor planks running down the image (v, the room's z): five across a repeat, two lengths each, every
    board its own tone, a soft grain along it, the seams only a shade darker. The floor maps 1.2 units across and 4.8
    along to one repeat, so a board is 0.24 wide and 2.4 long."""
    rng = np.random.default_rng(seed)
    u, v = K.grid(size, size)
    n = 5
    col = np.minimum(np.floor(u * n).astype(int), n - 1)
    fu = u * n - col
    off = rng.uniform(0, 1, n)
    vv = (v + off[col]) % 1.0
    board = np.floor(vv * 2).astype(int)
    fv = vv * 2 - board
    tone = rng.uniform(-0.08, 0.08, n * 2)[col * 2 + board]
    g = K.fbm(size, size, 6, seed + 5, octaves=3)
    streak = np.sin((u * n * 6 + g * 2.5) * TAU) * 0.5 + 0.5
    grain = (streak - 0.5) * 0.06 + (K.fbm(size, size, 32, seed + 9) - 0.5) * 0.04
    seam = np.maximum(1 - K.smooth(0.0, 0.03, np.minimum(fu, 1 - fu)), 1 - K.smooth(0.0, 0.006, np.minimum(fv, 1 - fv)))
    base = K.arr("#7c553b")
    rgb = base[None, None, :] * (1 + tone[..., None] + grain[..., None]) * (1 - 0.22 * seam[..., None])
    return np.clip(rgb, 0, 1)


def marble(size=256, seed=61):
    """Deep green marble (ref 1's coffee bar): soft clouding and fine pale veins."""
    u, v = K.grid(size, size)
    g = K.fbm(size, size, 4, seed, octaves=5)
    cloud = K.fbm(size, size, 6, seed + 3, octaves=3)
    vein = np.abs(np.sin(((2 * u + 3 * v) + g * 3.0) * TAU))
    vein2 = np.abs(np.sin(((3 * u - 2 * v) + K.fbm(size, size, 5, seed + 11, octaves=4) * 3.0) * TAU))
    lines = (1 - K.smooth(0.0, 0.06, vein)) * 0.75 + (1 - K.smooth(0.0, 0.03, vein2)) * 0.35
    deep, light, pale = K.arr("#1f4a3a"), K.arr("#3f7a62"), K.arr("#cfe2d6")
    rgb = deep[None, None, :] + (light - deep)[None, None, :] * cloud[..., None] ** 1.5
    rgb = rgb * (1 - np.clip(lines, 0, 1)[..., None]) + pale[None, None, :] * np.clip(lines, 0, 1)[..., None] * 0.9 + rgb * 0.1 * np.clip(lines, 0, 1)[..., None]
    return np.clip(rgb, 0, 1)


def plaster(size=256, seed=71):
    """Warm plaster, near white so the part's COLOR_0 carries the hue: soft clouding and a faint trowel texture."""
    cloud = (K.fbm(size, size, 5, seed, octaves=4) - 0.5) * 0.08
    fine = (K.fbm(size, size, 48, seed + 4, octaves=2) - 0.5) * 0.045
    return np.clip(np.full((size, size, 3), 0.93) * (1 + cloud + fine)[..., None], 0, 1)


def pile(size=256, seed=81):
    """A deep rug's pile: fine fluffy speckle over soft clumps, near white (COLOR_0 tints it blue, cream or dark)."""
    fine = (K.fbm(size, size, 64, seed, octaves=2) - 0.5) * 0.26
    clump = (K.fbm(size, size, 12, seed + 3, octaves=3) - 0.5) * 0.12
    return np.clip(np.full((size, size, 3), 0.86) * (1 + fine + clump)[..., None], 0, 1)


COVER_COLS, COVER_ROWS = 4, 2


def covers(size=256, seed=91):
    """Magazine and book covers facing out on the library's shelves (ref 1): a 4 x 2 atlas of portrait covers, each a
    flat colour with a picture block and a masthead bar, no lettering."""
    rng = np.random.default_rng(seed)
    out = np.zeros((size, size, 3))
    cw, ch = size // COVER_COLS, size // COVER_ROWS
    bgs = ["#e9e2d3", "#22272b", "#b24f36", "#d9c27a", "#2f4a6b", "#f2efe8", "#4f6b4c", "#8b3f50"]
    pics = ["#7f9bb0", "#c9a36b", "#f1e6cf", "#38423f", "#e5b88a", "#5b6f86", "#d8d0bd", "#e9c9a3"]
    for i in range(COVER_COLS * COVER_ROWS):
        c, r = i % COVER_COLS, i // COVER_COLS
        x0, y0 = c * cw, r * ch
        cell = np.ones((ch, cw, 3)) * K.arr(bgs[i])
        cell *= (0.97 + 0.06 * K.fbm(ch, cw, 4, seed + i))[..., None]
        top = int(ch * rng.uniform(0.28, 0.4))
        bottom = int(ch * rng.uniform(0.78, 0.9))
        inset = int(cw * rng.uniform(0.08, 0.16))
        if i % 3 == 0:                          # a circle
            yy, xx = np.mgrid[0:ch, 0:cw]
            m = ((xx - cw / 2) ** 2 + (yy - (top + bottom) / 2) ** 2) < (cw * 0.3) ** 2
            cell[m] = K.arr(pics[i])
        else:                                   # a picture block
            cell[top:bottom, inset:cw - inset] = K.arr(pics[i])
        bar = K.arr("#f5f2ea") if np.mean(K.arr(bgs[i])) < 0.5 else K.arr("#1d1f22")
        cell[int(ch * 0.07):int(ch * 0.16), int(cw * 0.12):int(cw * 0.88)] = bar          # the masthead
        cell[int(ch * 0.2):int(ch * 0.23), int(cw * 0.12):int(cw * 0.55)] = bar * 0.85 + 0.1
        out[y0:y0 + ch, x0:x0 + cw] = cell
    return np.clip(out, 0, 1)


# ================================================================ materials
def glow_mat(name="M_Glow", color="#ffe2b2", strength=2.2):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*K.lin(color), 1)
    b.inputs["Emission Color"].default_value = (*K.lin(color), 1)
    b.inputs["Emission Strength"].default_value = strength
    b.inputs["Roughness"].default_value = 1.0
    holder = K.Mat.__new__(K.Mat)
    holder.name, holder.m = name, m
    return holder


def tex(name, make):
    """A texture's image, made once a GLB (propkit.clear drops it with the GLB's materials)."""
    img = bpy.data.images.get(name)
    return img if img is not None else K.image(name, make())


def mats():
    return {
        "stone": K.Mat("P_Stone", "#ffffff", rough=0.95),
        "metal": K.Mat("P_Metal", "#ffffff", rough=0.4),
        "paint": K.Mat("P_Paint", "#ffffff", rough=0.45),
        "glass": K.Mat("P_Glass", "#ffffff", rough=0.08),
        "cloth": K.Mat("P_Cloth", "#ffffff", rough=1.0),
        "floor": K.Mat("M_Floor", "#ffffff", rough=0.55, tex=tex("hq_floor", planks)),
        "walnut": K.Mat("M_Walnut", "#ffffff", rough=0.6, tex=tex("hq_walnut", lambda: K.grain(256, 256, 51, contrast=0.11, knots=1, wander=0.005))),
        "plaster": K.Mat("M_Plaster", "#ffffff", rough=0.95, tex=tex("hq_plaster", plaster)),
        "rug": K.Mat("M_Rug", "#ffffff", rough=1.0, tex=tex("hq_rug", pile)),
        "marble": K.Mat("M_Marble", "#ffffff", rough=0.3, tex=tex("hq_marble", marble)),
        "covers": K.Mat("M_Covers", "#ffffff", rough=0.7, tex=tex("hq_covers", covers)),
        "glow": glow_mat(),
    }


# ================================================================ helpers
def turn(cx, cz, yaw, lx, ly, lz):
    """A point in a piece's own frame (front toward its local −z) turned by yaw about (cx, cz): game coordinates."""
    c, s = math.cos(yaw), math.sin(yaw)
    return (cx + c * lx + s * lz, ly, cz - s * lx + c * lz)


def yaw_facing(facing):
    return {"-z": 0.0, "+z": math.pi, "+x": -math.pi / 2, "-x": math.pi / 2}[facing]


def rb(k, cx, cz, yaw, lc, size, r, mat, col, segs=None, uv_len=1.0, v_axis=None, pitch=0.0, base=0.0):
    """A rounded box in a piece's frame (lc its local centre), on a floor at height `base`."""
    x, y, z = turn(cx, cz, yaw, *lc)
    return k.rbox((x, y + base, z), size, r, mat, col, rot=K.game_rot(yaw=yaw, pitch=pitch), segs=segs, uv_len=uv_len, v_axis=v_axis)


def strip(k, m, a, b, w=0.025, h=0.02):
    """A warm light strip from a to b (game points)."""
    dx, dz = abs(b[0] - a[0]), abs(b[2] - a[2])
    c = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    size = (dx + 0.03, h, w) if dx >= dz else (w, h, dz + 0.03)
    k.rbox(c, size, 0.006, m["glow"], "#ffffff", segs=1)


def floor_quad(k, mat, y, x0, x1, z0, z1, col="#ffffff", su=1.2, sv=4.8):
    corners = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    k.face([k.vert(p) for p in corners], [(x / su, z / sv) for x, _, z in corners], mat, col)


def cut(rects, hole):
    """Rects (a0, a1, b0, b1) less a hole: up to four each."""
    h0, h1, g0, g1 = hole
    out = []
    for (a0, a1, b0, b1) in rects:
        if h1 <= a0 or h0 >= a1 or g1 <= b0 or g0 >= b1:
            out.append((a0, a1, b0, b1))
            continue
        if h0 > a0:
            out.append((a0, h0, b0, b1))
        if h1 < a1:
            out.append((h1, a1, b0, b1))
        za, zb = max(a0, h0), min(a1, h1)
        if g0 > b0:
            out.append((za, zb, b0, g0))
        if g1 < b1:
            out.append((za, zb, g1, b1))
    return out


def side_wall(k, m, x, z0, z1, y0, y1, holes=(), col=PLASTER):
    """The wall in the plane x = ±W (its thickness outward) from z0 to z1 and y0 to y1, less its windows."""
    rects = [(z0, z1, y0, y1)]
    for h in holes:
        rects = cut(rects, h)
    cx = x + math.copysign(T / 2, x)
    for (a0, a1, b0, b1) in rects:
        k.rbox((cx, (b0 + b1) / 2, (a0 + a1) / 2), (T, b1 - b0, a1 - a0), 0.0, m["plaster"], col, uv_len=2.5)


def back_wall(k, m, y0, y1, col=PLASTER):
    k.rbox((0, (y0 + y1) / 2, D + T / 2), (2 * W + 2 * T, y1 - y0, T), 0.0, m["plaster"], col, uv_len=2.5)


def skirting(k, m, y, z0, z1, back=True, sides=(-1, 1)):
    """Walnut skirting along the back wall and the side walls between z0 and z1, at floor height y."""
    if back:
        k.rbox((0, y + 0.06, D - 0.015), (2 * W, 0.12, 0.03), 0.006, m["walnut"], WALNUT_DARK, uv_len=1.5)
    for s in sides:
        k.rbox((s * (W - 0.015), y + 0.06, (z0 + z1) / 2), (0.03, 0.12, z1 - z0), 0.006, m["walnut"], WALNUT_DARK, uv_len=1.5)


def windows_on(level_windows):
    return [w for w in L["windows"] if level_windows(w)]


def wall_x(w):
    return -W if w["wall"] == "right" else W


def window_frame(k, m, w):
    """A slim bronze frame set back in the wall's reveal, a mullion and two transoms (tall windows), a stone sill out
    into the room, and sheer drapes either side on a slim rod."""
    x = wall_x(w)
    out = math.copysign(1, x)
    xf = x + out * 0.06
    z0, z1, a, bb = w["z0"], w["z1"], w["y0"], w["y1"]
    zc = (z0 + z1) / 2
    fw = 0.06
    for (c, s_) in (((xf, a + fw / 2, zc), (0.07, fw, z1 - z0)), ((xf, bb - fw / 2, zc), (0.07, fw, z1 - z0)),
                    ((xf, (a + bb) / 2, z0 + fw / 2), (0.07, bb - a, fw)), ((xf, (a + bb) / 2, z1 - fw / 2), (0.07, bb - a, fw))):
        k.rbox(c, s_, 0.01, m["paint"], BRONZE)
    k.rbox((xf, (a + bb) / 2, zc), (0.05, bb - a - 2 * fw, 0.035), 0.006, m["paint"], BRONZE)
    tall = bb - a > 3
    for t in ((0.36, 0.7) if tall else (0.68,)):
        k.rbox((xf, a + (bb - a) * t, zc), (0.05, 0.035, z1 - z0 - 2 * fw), 0.006, m["paint"], BRONZE)
    k.rbox((x - out * 0.07, a - 0.025, zc), (0.28, 0.05, z1 - z0 + 0.16), 0.012, m["stone"], STONE)
    # the drapes, gathered at either side, and their rod
    xr = x - out * 0.12
    top = bb + 0.16
    k.tube([(xr, top, z0 - 0.3), (xr, top, z1 + 0.3)], 0.013, m["metal"], BRONZE, n=8, caps=True)
    span = (z1 - z0) * 0.24
    fl = 0.0 if a < F else F
    for (za, zb) in ((z0 - 0.25, z0 - 0.25 + span), (z1 + 0.25 - span, z1 + 0.25)):
        curtain(k, xr - out * 0.03, za, zb, fl + 0.05, top - 0.02, m["cloth"], SHEER, folds=3, depth=0.03, gather=0.15)


def curtain(k, x, z0, z1, y0, y1, mat, col, folds=4, depth=0.04, gather=0.0):
    """A pleated drape along game z at x, hanging from y1 to y0 (the shop's, build_shop.py)."""
    n = folds * 6
    rows = 4
    grid = []
    for j in range(rows + 1):
        v = j / rows
        pull = gather * (1 - v) ** 2
        row = []
        for t in np.linspace(0, 1, n + 1):
            off = math.sin(t * folds * TAU) * depth * (1 + 0.5 * (1 - v))
            mid = (z0 + z1) / 2
            zz = z0 + (z1 - z0) * t
            zz = zz + (mid - zz) * pull
            row.append((x + off, y0 + (y1 - y0) * v, zz))
        grid.append(row)
    for j in range(rows):
        for i in range(n):
            k.quad([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], mat, col)


def panes(windows, name):
    """The windows' glass, its own mesh: the engine draws the outside through it (RoomShell's window view)."""
    k = K.Kit(name)
    mat = K.Mat("M_View", "#ffffff", rough=0.1)
    for w in windows:
        x = wall_x(w) + math.copysign(0.075, wall_x(w))
        k.rbox((x, (w["y0"] + w["y1"]) / 2, (w["z0"] + w["z1"]) / 2), (0.01, w["y1"] - w["y0"], w["z1"] - w["z0"]), 0.0, mat, segs=1)
    return k.finish(name=name)


# ================================================================ furniture (one function a kind; every size from the layout)
def mushroom(k, m, x, base, z, h, r=0.2):
    """A white mushroom table lamp (ref 2): a round foot, a slim stem, a dome, its underside glowing."""
    k.lathe((x, base, z), [(0, 0), (r * 0.5, 0), (r * 0.55, 0.015), (r * 0.45, 0.03), (0, 0.035)], m["paint"], WHITE, n=12)
    k.tube([(x, base + 0.03, z), (x, base + h * 0.62, z)], 0.016, m["paint"], WHITE, n=8)
    y = base + h * 0.6
    k.lathe((x, y, z), [(r * 0.98, 0), (r, 0.02), (r * 0.92, h * 0.12), (r * 0.7, h * 0.26), (r * 0.38, h * 0.36), (0, h * 0.4)], m["paint"], WHITE, n=14)
    k.lathe((x, y - 0.004, z), [(0, 0), (r * 0.95, 0)], m["glow"], "#ffffff", n=14)
    k.lathe((x, y - 0.06, z), [(r * 0.62, 0), (r * 0.6, 0.06), (0, 0.06)], m["paint"], WHITE, n=12)   # the lower tier
    k.lathe((x, y - 0.065, z), [(0, 0), (r * 0.58, 0)], m["glow"], "#ffffff", n=12)


def globe_lamp(k, m, x, base, z, top, r=0.19):
    """A floor lamp: a marble foot, a chrome stem and a white globe, its lower half lit."""
    k.lathe((x, base, z), [(0, 0), (0.17, 0), (0.18, 0.03), (0.16, 0.05), (0, 0.05)], m["stone"], WHITE, n=12)
    k.tube([(x, base + 0.05, z), (x, top - r, z)], 0.014, m["metal"], CHROME, n=8)
    k.blob((x, top, z), (r, r, r), m["paint"], WHITE, segs=16, rings=6, flat_bottom=0.0)
    k.lathe((x, top - 0.002, z), [(0, -r * 0.7), (r * 0.7, -r * 0.7), (r * 0.97, -r * 0.25), (r, 0)], m["glow"], "#ffffff", n=12)


def sofa(k, m, cx, cz, yaw, w, d, h, mat, col, arms=True, seats=None, base=0.0):
    """A plush sofa (ref 2's velvet, ref 1's leather): a low base on a dark plinth, deep seat cushions, a back cushion
    and rounded arms. Its own frame: length w across its local x, its front toward local −z; on a floor at `base`."""
    arm = 0.2 if arms else 0.0
    rb(k, cx, cz, yaw, (0, 0.04, 0), (w - 0.1, 0.08, d - 0.1), 0.02, m["paint"], BLACK, segs=1, base=base)
    rb(k, cx, cz, yaw, (0, 0.18, 0), (w, 0.2, d), 0.06, mat, col, base=base)
    n = seats or max(1, round((w - 2 * arm) / 0.9))
    sw = (w - 2 * arm) / n
    for i in range(n):
        lx = -w / 2 + arm + sw * (i + 0.5)
        rb(k, cx, cz, yaw, (lx, 0.36, -d * 0.1), (sw - 0.03, 0.17, d * 0.72), 0.07, mat, col, base=base)
        rb(k, cx, cz, yaw, (lx, h - 0.24, d / 2 - d * 0.17), (sw - 0.04, 0.44, d * 0.3), 0.1, mat, col, pitch=-0.12, base=base)
    if arms:
        for s in (-1, 1):
            rb(k, cx, cz, yaw, (s * (w / 2 - arm / 2), 0.36, 0), (arm, 0.38, d), 0.08, mat, col, base=base)


def armchair(k, m, cx, cz, yaw, s, mat, col, base=0.0):
    sofa(k, m, cx, cz, yaw, s, s, 0.8, mat, col, seats=1, base=base)


def office_chair(k, m, x, z, yaw, seat=0.47):
    """An aluminium group office chair (ref 1): a five-star chrome base, a black leather seat and back."""
    for i in range(5):
        a = i * TAU / 5 + yaw
        k.tube([(x, 0.12, z), (x + math.cos(a) * 0.28, 0.06, z + math.sin(a) * 0.28)], 0.016, m["metal"], CHROME, n=6, caps=True)
        k.blob((x + math.cos(a) * 0.28, 0.035, z + math.sin(a) * 0.28), (0.03, 0.03, 0.03), m["paint"], BLACK, segs=6, rings=3)
    k.tube([(x, 0.1, z), (x, seat - 0.04, z)], 0.025, m["metal"], CHROME, n=8)
    rb(k, x, z, yaw, (0, seat, 0), (0.48, 0.07, 0.46), 0.03, m["paint"], LEATHER_BLACK)
    rb(k, x, z, yaw, (0, seat + 0.33, 0.24), (0.46, 0.52, 0.05), 0.025, m["paint"], LEATHER_BLACK, pitch=-0.14)
    for sx in (-1, 1):
        a = turn(x, z, yaw, sx * 0.25, seat - 0.02, 0.0)
        b = turn(x, z, yaw, sx * 0.25, seat + 0.6, 0.31)
        k.tube([a, b], 0.012, m["metal"], CHROME, n=6, caps=True)


def books_row(k, m, x0, x1, y, zfront, depth, rng, max_h=0.36, lean_end=True):
    """Upright books along a shelf from x0 to x1, their spines lined up at zfront (facing −z), each its own height,
    width and colour."""
    x = x0
    while x < x1 - 0.04:
        bw = float(rng.uniform(0.045, 0.085))
        if x + bw > x1:
            break
        bh = float(rng.uniform(max_h * 0.62, max_h))
        bd = depth * float(rng.uniform(0.75, 0.95))
        col = SPINES[int(rng.integers(0, len(SPINES)))]
        k.rbox((x + bw / 2, y + bh / 2, zfront + bd / 2), (bw, bh, bd), 0.0, m["paint"], col)
        x += bw + 0.004
    if lean_end and x < x1 - 0.12:
        bh = max_h * 0.8
        k.rbox((x + 0.09, y + bh / 2 * math.cos(0.35), zfront + depth * 0.43), (0.04, bh, depth * 0.85), 0.0, m["paint"], SPINES[3], rot=K.game_rot(roll=-0.35))


def cover(k, m, x, y, z, w, h, i, lean=0.12):
    """A magazine or book face out, leaning back on its shelf: the cover from the atlas, a paper edge behind it."""
    c, r = i % COVER_COLS, (i // COVER_COLS) % COVER_ROWS
    u0, u1 = c / COVER_COLS, (c + 1) / COVER_COLS
    v0, v1 = 1 - (r + 1) / COVER_ROWS, 1 - r / COVER_ROWS
    dz = math.sin(lean) * h
    k.rbox((x, y + h / 2 * math.cos(lean), z + dz / 2 + 0.008), (w, h, 0.012), 0.0, m["paint"], PAPER, rot=K.game_rot(pitch=lean))
    p = lambda lx, ly: (x + lx, y + ly * math.cos(lean), z + ly * math.sin(lean) - 0.0005)
    k.face([k.vert(p(-w / 2, 0)), k.vert(p(w / 2, 0)), k.vert(p(w / 2, h)), k.vert(p(-w / 2, h))],
           [(u1, v0), (u0, v0), (u0, v1), (u1, v1)], m["covers"], "#ffffff")


def plant_bush(k, m, x, z, h, seed, pot=0.3, base=0.0):
    """A leafy plant in a concrete pot (the shop's, fuller)."""
    rng = np.random.default_rng(seed)
    ph = min(0.5, h * 0.32)
    k.lathe((x, base, z), [(0, 0), (pot * 0.78, 0), (pot, ph * 0.95), (pot * 1.04, ph), (pot * 0.9, ph), (0, ph * 0.97)], m["stone"], POT, n=12)
    k.lathe((x, base + ph * 0.97, z), [(pot * 0.88, 0), (0, 0.005)], m["paint"], SOIL, n=12)
    k.tube([(x, base + ph, z), (x + 0.02, base + h * 0.7, z - 0.01)], 0.025, m["paint"], STEM, n=6)
    for i in range(18):
        a = i * 2.4
        t = i / 17
        yy = base + ph + (h - ph) * (0.18 + 0.78 * t)
        rad = (0.15 + 0.22 * (1 - abs(t - 0.45) * 1.6)) * h / 1.4
        px, pz = x + math.cos(a) * rad * rng.uniform(0.6, 1.0), z + math.sin(a) * rad * rng.uniform(0.6, 1.0)
        k.blob((px, yy, pz), (0.15, 0.026, 0.1), m["paint"], (LEAF, LEAF_LIGHT, LEAF_DEEP)[i % 3], segs=6, rings=3,
               rot=K.game_rot(yaw=-a, pitch=float(rng.uniform(0.3, 0.7))))


def palm(k, m, x, z, h, seed, pot=0.42, base=0.0):
    """A big kentia palm in a tall planter (ref 2): two or three slender stems, long fronds arching out and down."""
    rng = np.random.default_rng(seed)
    ph = 0.6
    k.lathe((x, base, z), [(0, 0), (pot * 0.85, 0), (pot, ph * 0.9), (pot * 1.05, ph), (pot * 0.92, ph), (0, ph * 0.97)], m["stone"], POT, n=14)
    k.lathe((x, base + ph * 0.97, z), [(pot * 0.9, 0), (0, 0.005)], m["paint"], SOIL, n=14)
    for s in range(3):
        a0 = s * TAU / 3 + float(rng.uniform(-0.4, 0.4))
        top_h = base + ph + (h - ph) * (0.55 + 0.2 * s / 2)
        tx, tz = x + math.cos(a0) * 0.18, z + math.sin(a0) * 0.18
        k.tube([(x + math.cos(a0) * 0.05, base + ph, z + math.sin(a0) * 0.05), (tx, top_h, tz)], 0.022, m["paint"], STEM, n=6)
        for f in range(5):
            a = a0 + f * TAU / 5 + float(rng.uniform(-0.25, 0.25))
            ln = float(rng.uniform(0.55, 0.85)) * h / 2.2
            droop = float(rng.uniform(0.25, 0.75))
            cxp = tx + math.cos(a) * ln * 0.5 * math.cos(droop)
            czp = tz + math.sin(a) * ln * 0.5 * math.cos(droop)
            cyp = top_h - math.sin(droop) * ln * 0.45
            k.blob((cxp, cyp, czp), (ln / 2, 0.012, 0.13), m["paint"], (LEAF, LEAF_LIGHT, LEAF_DEEP)[(f + s) % 3], segs=6, rings=3,
                   rot=K.game_rot(yaw=-a, roll=-droop))


def plant(k, m, b, seed, base=0.0):
    (x, _, z), (sx, sy, _) = b["at"], b["size"]
    if sy >= 1.6:
        palm(k, m, x, z, sy, seed, pot=sx * 0.42, base=base)
    else:
        plant_bush(k, m, x, z, sy, seed, pot=sx * 0.4, base=base)


def track(k, m, t):
    """A run of black track with its spots, each a black can aimed at its point with a warm glowing face."""
    a, b = t["from"], t["to"]
    along_x = abs(b[0] - a[0]) >= abs(b[2] - a[2])
    c = ((a[0] + b[0]) / 2, a[1] - 0.02, (a[2] + b[2]) / 2)
    size = (abs(b[0] - a[0]), 0.035, 0.04) if along_x else (0.04, 0.035, abs(b[2] - a[2]))
    k.rbox(c, (size[0] + 0.01, 0.05, size[2] + 0.01), 0.01, m["paint"], BLACK, segs=1)
    for s in t["spots"]:
        p = np.array((s["at"], a[1] - 0.06, a[2]) if along_x else (a[0], a[1] - 0.06, s["at"]))
        k.rbox((p[0], p[1] + 0.02, p[2]), (0.05, 0.04, 0.05), 0.006, m["paint"], BLACK, segs=1)
        d = np.array(s["aim"]) - p
        d = d / np.linalg.norm(d)
        cpos = p + d * 0.02
        k.lathe(tuple(cpos), [(0, 0), (0.035, 0), (0.042, 0.02), (0.042, 0.15), (0.036, 0.16), (0, 0.16)], m["paint"], BLACK, d=tuple(d), n=10)
        k.lathe(tuple(cpos + d * 0.162), [(0, 0), (0.03, 0)], m["glow"], "#ffffff", d=tuple(d), n=10)


def letters(text, at, height, name, color=CREAM, depth=0.006, yaw=math.pi):
    """Raised letters from Blender's own font facing the room (−z): their own mesh in P_Paint, joined later."""
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = text
    t.data.align_x, t.data.align_y = "CENTER", "CENTER"
    t.data.extrude = depth / 2
    t.data.size = height
    t.data.space_character = 1.12
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = (math.pi / 2, 0, yaw)
    ob.location = K.G(*at)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mat = bpy.data.materials.get("P_Paint")
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    col = ob.data.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    c = (*K.lin(color), 1.0)
    for i in range(len(col.data)):
        col.data[i].color = c
    ob.data.color_attributes.active_color = col
    ob.data.color_attributes.render_color_index = ob.data.color_attributes.active_color_index
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


TRIS = {}


def counted(k, name, fn, *args):
    """Run a part's builder and note the triangles it added (printed at the end of the build)."""
    before = sum(len(f.verts) - 2 for f in k.bm.faces)
    fn(*args)
    TRIS[name] = TRIS.get(name, 0) + sum(len(f.verts) - 2 for f in k.bm.faces) - before


def join(main, others):
    bpy.ops.object.select_all(action="DESELECT")
    for o in others:
        o.select_set(True)
    main.select_set(True)
    bpy.context.view_layer.objects.active = main
    bpy.ops.object.join()
    return main


# ================================================================ the ground floor
def ground(m):
    k = K.Kit("hq_ground")
    floor_quad(k, m["floor"], 0.0, -W, W, -D, D)
    # The walls: the hall's (in front of the mezzanine) both storeys high; under the mezzanine the ground storey only (its
    # upper storey is the mezzanine's, cut away with it).
    hall = [w for w in L["windows"] if w["z1"] <= UP["z0"]]
    for x in (-W, W):
        holes = [(w["z0"], w["z1"], w["y0"], w["y1"]) for w in hall if wall_x(w) == x]
        side_wall(k, m, x, -D - T, UP["z0"], 0.0, TOP, holes)
        side_wall(k, m, x, UP["z0"], D + T, 0.0, F)
    back_wall(k, m, 0.0, F)
    skirting(k, m, 0.0, -D, D)
    for w in hall:
        window_frame(k, m, w)
    # The cut-away near wall: a low lip either side of the door, capped in walnut; dark jambs; a step outside; a mat in.
    dx, dh = L["door"]["x"], L["door"]["half"]
    for x0, x1 in ((-W - T, dx - dh), (dx + dh, W + T)):
        k.rbox(((x0 + x1) / 2, LIP / 2, -D - T / 2), (x1 - x0, LIP, T), 0.0, m["plaster"], PLASTER, uv_len=2.5)
        k.rbox(((x0 + x1) / 2, LIP + 0.025, -D - T / 2), (x1 - x0 + 0.02, 0.05, T + 0.05), 0.015, m["walnut"], WALNUT_DARK)
    for sx in (-1, 1):
        k.rbox((dx + sx * (dh + 0.04), (LIP + 0.3) / 2, -D - T / 2), (0.08, LIP + 0.3, T + 0.06), 0.015, m["paint"], BRONZE)
    k.rbox((dx, -0.03, -D - T - 0.28), (2 * dh + 0.5, 0.06, 0.5), 0.02, m["stone"], STONE_DARK)
    k.rbox((dx, 0.012, -D + 0.62), (1.7, 0.024, 0.95), 0.012, m["rug"], MAT, uv_len=0.6)
    for name, fn in (("panelling", walnut_panelling), ("stair art", stair_art), ("stair", stair), ("aquarium surround", aquarium_surround), ("front desk", front_desk),
                     ("coffee bar", coffee_bar), ("aquarium lounge", aquarium_lounge), ("co-working", coworking), ("work lounge", work_lounge),
                     ("library", library), ("notice board", notice_board), ("founder", founder)):
        counted(k, name, fn, k, m)
    for i, fid in enumerate(("palm-front-left", "palm-front-right", "plant-aquarium", "plant-work")):
        counted(k, "plants", plant, k, m, FX[fid]["blocks"][0], 11 + i)
    return k.finish(name="hq_ground")


def walnut_panelling(k, m):
    """The back wall under the mezzanine, from the library's end to the left wall: walnut panels with dark reveals behind
    the clock, the notice board and the Founder's desk (ref 2's panelled wall)."""
    x0, x1 = -1.05, W
    h = F - SLAB
    k.rbox(((x0 + x1) / 2, h / 2, D - 0.03), (x1 - x0, h, 0.04), 0.0, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
    x = x0 + 0.62
    while x < x1 - 0.1:
        k.rbox((x, h / 2, D - 0.052), (0.014, h, 0.006), 0.0, m["paint"], WALNUT_DARK)
        x += 0.62


def stair_art(k, m):
    """A big framed canvas on the hall's right wall over the stair (ref 2's lit art piece, in the room's colours): deep
    navy, rust and cream blocks with a thin brass line, seen from the hall and from the walking camera."""
    x = -W + 0.05
    z0, z1, y0, y1 = -2.9, 0.3, 3.7, 5.7
    zc, yc = (z0 + z1) / 2, (y0 + y1) / 2
    k.rbox((x, yc, zc), (0.06, y1 - y0 + 0.1, z1 - z0 + 0.1), 0.012, m["paint"], BLACK)
    k.rbox((x + 0.035, yc, zc), (0.01, y1 - y0 - 0.06, z1 - z0 - 0.06), 0.0, m["paint"], "#e9e1d2")
    for (za, zb, ya, yb, col) in ((z0 + 0.25, zc + 0.2, y0 + 0.25, y1 - 0.5, "#24324f"), (zc + 0.45, z1 - 0.25, y0 + 0.6, yc + 0.35, "#b4583a"),
                                  (zc - 0.4, z1 - 0.6, yc + 0.55, y1 - 0.25, "#d8b878")):
        k.rbox((x + 0.042, (ya + yb) / 2, (za + zb) / 2), (0.006, yb - ya, zb - za), 0.0, m["paint"], col)
    k.rbox((x + 0.046, y0 + 0.42, zc), (0.004, 0.025, z1 - z0 - 0.5), 0.0, m["metal"], BRASS)


FRONT_WINDOWS = ((-7.6, -4.4), (4.4, 7.6))


def front_wall(k, m):
    """The near wall, whole, for a camera inside the room (the walking camera looks in over its lip, so the game shows
    this only to a camera under the ceiling): plaster over the lip, the glazed door in its bronze frame, two tall
    windows either side."""
    dx, dh = L["door"]["x"], L["door"]["half"]
    dt = 2.7
    holes = [(dx - dh, dx + dh, 0.0, dt)] + [(a, b, 0.9, 6.1) for a, b in FRONT_WINDOWS]
    rects = [(-W - T, W + T, LIP, TOP)]
    for h in holes:
        rects = cut(rects, h)
    for (a0, a1, b0, b1) in rects:
        k.rbox(((a0 + a1) / 2, (b0 + b1) / 2, -D - T / 2), (a1 - a0, b1 - b0, T), 0.0, m["plaster"], PLASTER, uv_len=2.5)
    zf = -D + 0.06
    for (c, s_) in (((dx - dh, dt / 2, zf), (0.07, dt, 0.07)), ((dx + dh, dt / 2, zf), (0.07, dt, 0.07)), ((dx, dt, zf), (2 * dh + 0.07, 0.07, 0.07)),
                    ((dx, dt * 0.55, zf), (2 * dh, 0.05, 0.05)), ((dx, dt / 2, zf), (0.05, dt, 0.05))):
        k.rbox(c, s_, 0.01, m["paint"], BRONZE)
    k.rbox((dx, dt / 2, zf + 0.01), (2 * dh, dt, 0.01), 0.0, m["glass"], "#cfe0e4")
    for a, b in FRONT_WINDOWS:
        zc = (a + b) / 2
        for (c, s_) in (((zc, 0.9, zf), (b - a, 0.06, 0.07)), ((zc, 6.1, zf), (b - a, 0.06, 0.07)), ((a, 3.5, zf), (0.06, 5.2, 0.07)), ((b, 3.5, zf), (0.06, 5.2, 0.07)),
                        ((zc, 3.5, zf), (0.04, 5.2, 0.05)), ((zc, 0.9 + 5.2 * 0.36, zf), (b - a, 0.035, 0.05)), ((zc, 0.9 + 5.2 * 0.7, zf), (b - a, 0.035, 0.05))):
            k.rbox(c, s_, 0.008, m["paint"], BRONZE)
        k.rbox((zc, 0.875, -D + 0.12), (b - a + 0.16, 0.05, 0.26), 0.012, m["stone"], STONE)


def front_panes():
    k = K.Kit("hq_windows_front")
    mat = K.Mat("M_View", "#ffffff", rough=0.1)
    for a, b in FRONT_WINDOWS:
        k.rbox(((a + b) / 2, 3.5, -D - 0.075), (b - a, 5.2, 0.01), 0.0, mat, segs=1)
    return k.finish(name="hq_windows_front")


def stair(k, m):
    """A straight flight up the right wall: walnut treads floating on two dark steel stringers, a glass balustrade with a
    walnut handrail up its open side."""
    n, x0, x1, foot, head = S["steps"], S["x0"], S["x1"], S["foot"], S["head"]
    run, rise = (head - foot) / n, F / n
    for i in range(n):
        top = rise * (i + 1)
        k.rbox(((x0 + x1) / 2 + 0.02, top - 0.03, foot + run * (i + 0.5)), (x1 - x0 - 0.06, 0.06, abs(run) + 0.02), 0.012, m["walnut"], WALNUT, uv_len=0.9)
    for sx in (x0 + 0.04, x1 - 0.03):
        p0 = (sx, rise * 0.5 - 0.16, foot - 0.05)
        p1 = (sx, F - rise * 0.5 - 0.16, head)
        k.beam(p0, p1, 0.04, 0.3, 0.008, m["paint"], STEEL_DARK)
    xg = x1 - 0.03
    lo = lambda z: rise * (1 + (z - foot) / run) + 0.04
    za, zb = foot + 0.08, head
    k.face([k.vert((xg, lo(za), za)), k.vert((xg, lo(zb), zb)), k.vert((xg, lo(zb) + 0.9, zb)), k.vert((xg, lo(za) + 0.9, za))],
           [(0, 0), (1, 0), (1, 1), (0, 1)], m["glass"], "#d6e6ea")
    k.tube([(xg, lo(za) + 0.94, za), (xg, lo(zb) + 0.94, zb)], 0.026, m["walnut"], WALNUT, n=10, caps=True)
    for t in np.linspace(0, 1, 5):
        z = za + (zb - za) * t
        k.tube([(xg, lo(z) - 0.05, z), (xg, lo(z) + 0.92, z)], 0.014, m["metal"], STEEL_DARK, n=6)


def aquarium_surround(k, m):
    """The tank built into the left wall of the hall: walnut cladding at its ends and above it, a dark plinth below with
    the warm strip along its top, a slim bronze bezel round the glass. Open above, so the walking camera sees the water."""
    x0, z0, z1, y0, y1 = A["x0"], A["z0"], A["z1"], A["y0"], A["y1"]
    for z, s in ((z0 - 0.11, -1), (z1 + 0.11, 1)):
        k.rbox(((x0 - 0.05 + W) / 2, TOP / 2, z), (W - x0 + 0.05, TOP, 0.22), 0.01, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
    k.rbox((x0 + 0.03, (y1 + TOP) / 2 + 0.02, (z0 + z1) / 2), (0.16, TOP - y1 + 0.04, z1 - z0 + 0.44), 0.01, m["walnut"], WALNUT, uv_len=1.3)
    k.rbox(((x0 - 0.04 + W) / 2, y0 / 2, (z0 + z1) / 2), (W - x0 + 0.04, y0, z1 - z0), 0.01, m["paint"], CHARCOAL)
    strip(k, m, (x0 - 0.05, y0 - 0.04, z0 + 0.05), (x0 - 0.05, y0 - 0.04, z1 - 0.05), w=0.03, h=0.03)
    bz = 0.05
    for (c, s_) in (((x0 - 0.005, y0 + bz / 2, (z0 + z1) / 2), (0.03, bz, z1 - z0)), ((x0 - 0.005, y1 - bz / 2, (z0 + z1) / 2), (0.03, bz, z1 - z0)),
                    ((x0 - 0.005, (y0 + y1) / 2, z0 + bz / 2), (0.03, y1 - y0, bz)), ((x0 - 0.005, (y0 + y1) / 2, z1 - bz / 2), (0.03, y1 - y0, bz))):
        k.rbox(c, s_, 0.008, m["paint"], BRONZE)


def front_desk(k, m):
    """Wren's front desk facing the door: a walnut counter with a fluted front on a black kick, a travertine top, a warm
    strip under its lip; the lower work surface behind it with the mushroom lamp; the register open on the ledge."""
    body, back = FX["front-desk"]["blocks"]
    (x, _, z), (sx, sy, sz) = body["at"], body["size"]
    k.rbox((x, 0.05, z), (sx - 0.08, 0.1, sz - 0.08), 0.01, m["paint"], BLACK)
    k.rbox((x, 0.1 + (sy - 0.16) / 2, z), (sx, sy - 0.16, sz), 0.02, m["walnut"], WALNUT, uv_len=1.2, v_axis=1)
    for i in range(1, 16):
        u = -sx / 2 + sx * i / 16
        k.rbox((x + u, 0.1 + (sy - 0.16) / 2, z - sz / 2 - 0.004), (0.016, sy - 0.24, 0.01), 0.0, m["paint"], WALNUT_DARK)
    k.rbox((x, sy - 0.035, z - 0.04), (sx + 0.08, 0.07, sz + 0.08), 0.018, m["stone"], STONE)
    strip(k, m, (x - sx / 2 + 0.06, sy - 0.08, z - sz / 2 - 0.05), (x + sx / 2 - 0.06, sy - 0.08, z - sz / 2 - 0.05))
    (bx, _, bz), (bsx, bsy, bsz) = back["at"], back["size"]
    k.rbox((bx, bsy - 0.025, bz + 0.05), (bsx, 0.05, bsz), 0.012, m["walnut"], WALNUT_LIGHT)
    for ex in (-bsx / 2 + 0.04, bsx / 2 - 0.04):
        k.rbox((bx + ex, (bsy - 0.05) / 2, bz + 0.05), (0.05, bsy - 0.05, bsz - 0.04), 0.01, m["walnut"], WALNUT_DARK)
    lp = LAMPS["desk-lamp"]["light"]
    mushroom(k, m, lp[0], bsy, lp[2], (lp[1] - bsy) / 0.62, r=0.17)
    # paper trays and a cup on the work surface, a small plant at its far end
    k.rbox((bx + 0.35, bsy + 0.04, bz + 0.1), (0.36, 0.08, 0.28), 0.01, m["paint"], CHARCOAL)
    k.rbox((bx + 0.35, bsy + 0.085, bz + 0.1), (0.3, 0.01, 0.22), 0.0, m["paint"], PAPER)
    k.lathe((bx - 0.3, bsy, bz + 0.15), [(0, 0), (0.045, 0), (0.05, 0.1), (0.044, 0.1), (0.04, 0.01), (0, 0.01)], m["paint"], WHITE, n=12)
    k.lathe((x + sx / 2 - 0.22, sy, z + 0.05), [(0, 0), (0.05, 0), (0.07, 0.08), (0.04, 0.18), (0.035, 0.2), (0, 0.19)], m["stone"], "#2e2b29", n=12)
    for i in range(3):
        a = i * 2.1
        k.tube([(x + sx / 2 - 0.22, sy + 0.18, z + 0.05), (x + sx / 2 - 0.22 + math.cos(a) * 0.08, sy + 0.42 + 0.04 * i, z + 0.05 + math.sin(a) * 0.06)], 0.005, m["paint"], STEM, n=4)
        k.blob((x + sx / 2 - 0.22 + math.cos(a) * 0.08, sy + 0.44 + 0.04 * i, z + 0.05 + math.sin(a) * 0.06), (0.04, 0.012, 0.025), m["paint"], LEAF_LIGHT, segs=6, rings=4, rot=K.game_rot(yaw=-a))
    # the register: an open ledger, leather bound, a pen across it
    b = FX["register"]["blocks"][0]
    (rx, ry, rz), (rsx, _, rsz) = b["at"], b["size"]
    k.rbox((rx, ry + 0.008, rz), (rsx, 0.016, rsz), 0.006, m["paint"], LEATHER_BROWN)
    for s in (-1, 1):
        k.rbox((rx + s * rsx * 0.235, ry + 0.028, rz), (rsx * 0.45, 0.024, rsz * 0.9), 0.008, m["paint"], PAPER, rot=K.game_rot(roll=-s * 0.05))
    k.tube([(rx + 0.06, ry + 0.05, rz - rsz * 0.25), (rx + 0.22, ry + 0.05, rz - rsz * 0.05)], 0.008, m["paint"], BLACK, n=6, caps=True)


def stool(k, m, b):
    """A tall bar stool (ref 1): a round walnut seat with a low back on black steel legs and a footring."""
    (x, _, z), (_, h, _) = b["at"], b["size"]
    for i in range(4):
        a = i * TAU / 4 + TAU / 8
        k.tube([(x + math.cos(a) * 0.2, 0.0, z + math.sin(a) * 0.2), (x + math.cos(a) * 0.13, h - 0.04, z + math.sin(a) * 0.13)], 0.012, m["paint"], BLACK, n=6)
    k.tube([(x + math.cos(t) * 0.18, 0.3, z + math.sin(t) * 0.18) for t in np.linspace(0, TAU, 11)[:-1]], 0.01, m["paint"], BLACK, n=5, closed_path=True)
    k.lathe((x, h - 0.05, z), [(0, 0), (0.19, 0), (0.2, 0.025), (0.185, 0.05), (0, 0.05)], m["walnut"], WALNUT_LIGHT, n=12)
    for sx in (-1, 1):
        k.tube([(x + sx * 0.12, h - 0.02, z - 0.15), (x + sx * 0.12, h + 0.2, z - 0.17)], 0.01, m["paint"], BLACK, n=6)
    k.rbox((x, h + 0.24, z - 0.175), (0.34, 0.12, 0.025), 0.01, m["walnut"], WALNUT_LIGHT, rot=K.game_rot(pitch=0.12))


def coffee_bar(k, m):
    """The green marble island (ref 1): marble all round on a black recessed kick, a thick top overhanging toward its
    stools with a warm strip under the lip, an espresso machine, cups, and the two tall stools."""
    bar, s1, s2 = FX["coffee-bar"]["blocks"]
    (x, _, z), (sx, sy, sz) = bar["at"], bar["size"]
    k.rbox((x, 0.05, z), (sx - 0.12, 0.1, sz - 0.12), 0.01, m["paint"], BLACK)
    k.rbox((x, 0.1 + (sy - 0.18) / 2, z), (sx - 0.04, sy - 0.18, sz - 0.04), 0.03, m["marble"], "#ffffff", uv_len=1.1)
    k.rbox((x, sy - 0.045, z - 0.06), (sx + 0.08, 0.09, sz + 0.2), 0.025, m["marble"], "#ffffff", uv_len=1.1)
    strip(k, m, (x - sx / 2 + 0.1, sy - 0.11, z - sz / 2 - 0.12), (x + sx / 2 - 0.1, sy - 0.11, z - sz / 2 - 0.12))
    # the espresso machine at the far side, its back to the room's right
    ex, ez = x + 0.55, z + 0.2
    k.rbox((ex, sy + 0.2, ez), (0.56, 0.4, 0.4), 0.04, m["metal"], CHROME)
    k.rbox((ex, sy + 0.41, ez), (0.52, 0.02, 0.36), 0.01, m["paint"], BLACK)
    for gx in (-0.13, 0.13):
        k.lathe((ex + gx, sy + 0.18, ez - 0.22), [(0, 0), (0.035, 0), (0.035, 0.06), (0, 0.06)], m["paint"], BLACK, d=(0, -1, 0), n=10)
    for cx in (-0.08, 0.02, 0.12):
        k.lathe((ex + cx, sy + 0.42, ez), [(0, 0), (0.035, 0), (0.04, 0.06), (0.036, 0.06), (0.032, 0.008), (0, 0.008)], m["paint"], WHITE, n=12)
    for cx, cz in ((-0.5, -0.25), (-0.32, -0.3)):
        k.lathe((x + cx, sy, z + cz), [(0, 0), (0.04, 0), (0.045, 0.07), (0.04, 0.07), (0.036, 0.008), (0, 0.008)], m["paint"], WHITE, n=12)
    k.lathe((x - 0.95, sy, z + 0.15), [(0, 0), (0.12, 0), (0.15, 0.06), (0.13, 0.065), (0, 0.02)], m["stone"], STONE, n=12)
    for i, c in enumerate(("#e6a23c", "#c9442f", "#e6a23c")):
        k.blob((x - 0.95 + (i - 1) * 0.06, sy + 0.08, z + 0.15 + (i % 2) * 0.03), (0.04, 0.04, 0.04), m["paint"], c, segs=8, rings=5)
    for s in (s1, s2):
        stool(k, m, s)


def aquarium_lounge(k, m):
    """The small lamp-lit lounge before the tank (ref 2): a cream shag rug, a brown velvet sofa facing the glass, a low
    travertine table with books and the mushroom lamp, a velvet lounge chair and the globe floor lamp."""
    f = FX["ground-lounge"]
    rug, sofa_b, table_b, chair_b, lamp_b = f["blocks"]
    (x, _, z), (sx, sy, sz) = rug["at"], rug["size"]
    k.rbox((x, 0.016, z), (sx, 0.032, sz), 0.016, m["rug"], CREAM, uv_len=0.7)
    (x, _, z), (sx, sy, sz) = sofa_b["at"], sofa_b["size"]
    sofa(k, m, x, z, yaw_facing("+x"), sz, sx, sy, m["cloth"], VELVET)
    (x, _, z), (sx, sy, sz) = table_b["at"], table_b["size"]
    k.rbox((x, 0.08, z), (sx - 0.2, 0.16, sz - 0.2), 0.02, m["stone"], STONE_DARK)
    k.rbox((x, sy - 0.05, z), (sx, 0.1, sz), 0.025, m["stone"], STONE)
    lp = LAMPS["lounge-lamp"]["light"]
    mushroom(k, m, lp[0], sy, lp[2], (lp[1] - sy) / 0.62 * 1.35, r=0.2)
    for i, c in enumerate(("#2f4a6b", "#e9e4d8", "#b5863f")):
        k.rbox((x - 0.05, sy + 0.025 + i * 0.04, z - 0.35), (0.3 - i * 0.03, 0.04, 0.24 - i * 0.02), 0.004, m["paint"], c, rot=K.game_rot(yaw=0.2 * i))
    (x, _, z), (sx, sy, sz) = chair_b["at"], chair_b["size"]
    armchair(k, m, x, z, yaw_facing("+z") - 0.4, sx, m["cloth"], VELVET_DEEP)
    lp = LAMPS["lounge-floor"]["light"]
    globe_lamp(k, m, lp[0], 0.0, lp[2], lp[1])


def coworking(k, m):
    """The long walnut co-working desk (ref 1): a thick top on dark steel sled legs, four monitors on chrome stands,
    keyboards, papers, and four black leather office chairs pulled up to it."""
    f = FX["coworking"]
    desk = f["blocks"][0]
    (x, _, z), (sx, sy, sz) = desk["at"], desk["size"]
    k.rbox((x, sy - 0.025, z), (sx, 0.05, sz), 0.015, m["walnut"], WALNUT, uv_len=1.4)
    for lx in (-sx / 2 + 0.25, 0.0, sx / 2 - 0.25):
        k.rbox((x + lx, (sy - 0.05) / 2, z), (0.05, sy - 0.05, sz - 0.12), 0.01, m["paint"], STEEL_DARK)
        k.rbox((x + lx, 0.02, z), (0.07, 0.04, sz - 0.04), 0.01, m["paint"], STEEL_DARK)
    k.rbox((x, sy - 0.25, z + sz / 2 - 0.06), (sx - 0.6, 0.36, 0.02), 0.005, m["walnut"], WALNUT_DARK)
    for b in f["blocks"]:
        if b["finish"] == "screen":
            (mx, my, mz), (msx, msy, msz) = b["at"], b["size"]
            k.rbox((mx, my + 0.005, mz - 0.03), (0.22, 0.01, 0.16), 0.004, m["metal"], CHROME)
            k.rbox((mx, my + 0.12, mz - 0.01), (0.04, 0.22, 0.02), 0.004, m["metal"], CHROME)
            k.rbox((mx, my + 0.16 + msy / 2, mz), (msx, msy, 0.025), 0.01, m["paint"], BLACK)
            k.rbox((mx, my + 0.17 + msy / 2, mz - 0.014), (msx - 0.04, msy - 0.06, 0.004), 0.0, m["paint"], "#20303b")
            k.rbox((mx, my + 0.012, mz - 0.38), (0.36, 0.018, 0.12), 0.006, m["paint"], "#d8d8d4")
            k.rbox((mx + 0.3, my + 0.006, mz - 0.25), (0.22, 0.004, 0.3), 0.0, m["paint"], PAPER, rot=K.game_rot(yaw=0.15))
        elif b["finish"] == "leather":
            (cx, _, cz), _s = b["at"], b["size"]
            office_chair(k, m, cx, cz - 0.05, math.pi + 0.1 * math.sin(cx * 3))


def work_lounge(k, m):
    """The work lounge on the deep blue rug (ref 1): a quilted black leather daybed with its bolster, a brown leather
    sofa, a glass coffee table stacked with books, and the mushroom lamp on it."""
    rug, daybed, sofa_b, table_b = FX["work-lounge"]["blocks"]
    (x, _, z), (sx, sy, sz) = rug["at"], rug["size"]
    k.rbox((x, 0.016, z), (sx, 0.032, sz), 0.016, m["rug"], RUG_BLUE, uv_len=0.7)
    # the daybed: a chrome frame on X legs, quilted cushions in squares, a bolster at one end
    (x, _, z), (sx, sy, sz) = daybed["at"], daybed["size"]
    for lx in (-sx / 2 + 0.12, sx / 2 - 0.12):
        for s in (-1, 1):
            k.tube([(x + lx - 0.08, 0.02, z + s * (sz / 2 - 0.05)), (x + lx + 0.08, sy - 0.12, z + s * (sz / 2 - 0.05))], 0.014, m["metal"], CHROME, n=6, caps=True)
            k.tube([(x + lx + 0.08, 0.02, z + s * (sz / 2 - 0.05)), (x + lx - 0.08, sy - 0.12, z + s * (sz / 2 - 0.05))], 0.014, m["metal"], CHROME, n=6, caps=True)
    k.rbox((x, sy - 0.11, z), (sx, 0.05, sz), 0.015, m["walnut"], WALNUT_DARK)
    cols, rows = 6, 2
    for i in range(cols):
        for j in range(rows):
            k.rbox((x - sx / 2 + sx * (i + 0.5) / cols, sy - 0.03, z - sz / 2 + sz * (j + 0.5) / rows), (sx / cols - 0.01, 0.1, sz / rows - 0.01), 0.04, m["paint"], LEATHER_BLACK, segs=1)
    k.tube([(x - sx / 2 + 0.12, sy + 0.08, z - sz / 2 + 0.05), (x - sx / 2 + 0.12, sy + 0.08, z + sz / 2 - 0.05)], 0.1, m["paint"], LEATHER_BLACK, n=12, caps=True)
    (x, _, z), (sx, sy, sz) = sofa_b["at"], sofa_b["size"]
    sofa(k, m, x, z, yaw_facing("-z"), sx, sz, sy, m["paint"], LEATHER_BROWN, seats=2)
    (x, _, z), (sx, sy, sz) = table_b["at"], table_b["size"]
    k.rbox((x, sy - 0.01, z), (sx, 0.02, sz), 0.006, m["glass"], "#dfe9ec")
    k.rbox((x, 0.12, z), (sx - 0.1, 0.015, sz - 0.08), 0.004, m["glass"], "#dfe9ec")
    for lx in (-sx / 2 + 0.06, sx / 2 - 0.06):
        for lz in (-sz / 2 + 0.06, sz / 2 - 0.06):
            k.tube([(x + lx, 0.0, z + lz), (x + lx, sy - 0.02, z + lz)], 0.012, m["metal"], CHROME, n=6)
    rng = np.random.default_rng(23)
    for stack, (ox, oz) in enumerate(((-0.35, -0.08), (0.36, 0.1))):
        for i in range(4 - stack):
            c = SPINES[int(rng.integers(0, len(SPINES)))]
            k.rbox((x + ox, sy + 0.022 + i * 0.044, z + oz), (0.32 - i * 0.02, 0.042, 0.24 - i * 0.015), 0.004, m["paint"], c, rot=K.game_rot(yaw=float(rng.uniform(-0.2, 0.2))))
    for i in range(3):
        k.rbox((x + 0.1, 0.14 + i * 0.045, z), (0.34, 0.043, 0.26), 0.004, m["paint"], SPINES[(i * 5) % len(SPINES)])
    lp = LAMPS["work-lamp"]["light"]
    mushroom(k, m, lp[0], sy, lp[2], (lp[1] - sy) / 0.62 * 1.6, r=0.15)


def library(k, m):
    """The library wall (ref 1): tall walnut shelving across the back under the mezzanine, closed cabinets below, open
    shelves above with books in rows and magazines face out, a warm strip under each shelf."""
    carcass = FX["library"]["blocks"][0]
    (x, _, z), (sx, sy, sz) = carcass["at"], carcass["size"]
    x0, x1, zf, zb = x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2
    k.rbox((x, 0.05, z), (sx - 0.06, 0.1, sz - 0.06), 0.01, m["paint"], BLACK)
    k.rbox((x, sy / 2, zb - 0.02), (sx, sy, 0.04), 0.0, m["walnut"], WALNUT_DARK, uv_len=1.3, v_axis=1)
    bays = 7
    bw = sx / bays
    for i in range(bays + 1):
        k.rbox((x0 + bw * i, sy / 2, z), (0.045, sy, sz), 0.008, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
    # the cabinets below, their doors
    k.rbox((x, 0.42, z - 0.01), (sx - 0.02, 0.64, sz - 0.02), 0.01, m["walnut"], WALNUT, uv_len=1.3)
    for i in range(bays):
        cx = x0 + bw * (i + 0.5)
        k.rbox((cx, 0.42, zf - 0.006), (0.012, 0.6, 0.01), 0.0, m["paint"], WALNUT_DARK)
        for s in (-1, 1):
            k.rbox((cx + s * 0.06, 0.62, zf - 0.02), (0.012, 0.12, 0.02), 0.004, m["metal"], BRASS)
    shelves = [0.74, 1.24, 1.74, 2.24, 2.74]
    for y in shelves + [sy - 0.03]:
        k.rbox((x, y, z), (sx, 0.04, sz), 0.008, m["walnut"], WALNUT, uv_len=1.3)
    for y in shelves[1:] + [sy - 0.03]:
        strip(k, m, (x0 + 0.05, y - 0.03, zf + 0.03), (x1 - 0.05, y - 0.03, zf + 0.03), w=0.02, h=0.012)
    rng = np.random.default_rng(31)
    i_cover = 0
    for r, y in enumerate(shelves):
        for i in range(bays):
            bx0, bx1 = x0 + bw * i + 0.03, x0 + bw * (i + 1) - 0.03
            kind = (i + r * 3) % 5
            yb = y + 0.02
            depth = sz - 0.08
            if kind in (0, 3):           # magazines face out, two or three
                n = 2 if kind == 0 else 3
                cw = (bx1 - bx0) / n
                for c in range(n):
                    cover(k, m, bx0 + cw * (c + 0.5), yb, zb - 0.16, cw * 0.86, min(0.42, cw * 1.3), i_cover)
                    i_cover += 1
            elif kind == 4 and (i + r) % 2 == 0:   # an object: a vase with a stem, or a stone bowl
                books_row(k, m, bx0, bx0 + (bx1 - bx0) * 0.45, yb, zf + 0.04, depth * 0.9, rng, lean_end=False)
                vx = bx0 + (bx1 - bx0) * 0.72
                k.lathe((vx, yb, z), [(0, 0), (0.06, 0), (0.09, 0.12), (0.05, 0.26), (0.04, 0.3), (0, 0.29)], m["stone"], ("#d9cfc2", "#2e2b29", "#b9764f")[(i + r) % 3], n=14)
            else:                         # a row of books
                books_row(k, m, bx0, bx1, yb, zf + 0.04, depth * 0.9, rng)


def notice_board(k, m):
    """The notice board and the club goals on the walnut wall: a cork board in a walnut frame with pinned notes, and a
    slate goals board with two progress bars (the café and museum funds)."""
    cork, goals = FX["notice-board"]["blocks"]
    rng = np.random.default_rng(41)
    for b, face in ((cork, "cork"), (goals, "slate")):
        (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
        zc = D - 0.05 - sz / 2
        k.rbox((x, y0 + sy / 2, zc), (sx + 0.1, sy + 0.1, sz), 0.015, m["walnut"], WALNUT_DARK)
        k.rbox((x, y0 + sy / 2, zc - sz / 2 - 0.004), (sx - 0.04, sy - 0.04, 0.012), 0.0, m["stone"] if face == "cork" else m["paint"], CORK if face == "cork" else SLATE)
        zf = zc - sz / 2 - 0.014
        if face == "cork":
            for i in range(9):
                nx = x - sx / 2 + 0.22 + (i % 3) * (sx - 0.44) / 2 + float(rng.uniform(-0.08, 0.08))
                ny = y0 + sy - 0.3 - (i // 3) * 0.42 + float(rng.uniform(-0.05, 0.05))
                c = ("#f4eee2", "#f3dd8c", "#bfd8c6", "#f2c3b0", "#cfdcef")[i % 5]
                w, h = float(rng.uniform(0.22, 0.32)), float(rng.uniform(0.2, 0.3))
                k.rbox((nx, ny, zf), (w, h, 0.006), 0.0, m["paint"], c, rot=K.game_rot(roll=float(rng.uniform(-0.12, 0.12))))
                k.blob((nx, ny + h / 2 - 0.03, zf - 0.008), (0.014, 0.014, 0.01), m["paint"], ("#c9442f", "#2f4a6b", "#bf9a5a")[i % 3], segs=8, rings=4)
        else:
            k.rbox((x, y0 + sy - 0.2, zf), (sx * 0.6, 0.07, 0.004), 0.0, m["paint"], CREAM)
            for j, (fill, col) in enumerate(((0.62, "#8fb39e"), (0.38, "#d9b45a"))):
                yy = y0 + sy - 0.55 - j * 0.38
                k.rbox((x, yy + 0.09, zf), (sx * 0.4, 0.035, 0.004), 0.0, m["paint"], "#9aa3aa")
                k.rbox((x, yy, zf), (sx - 0.3, 0.08, 0.004), 0.0, m["paint"], "#454c52")
                k.rbox((x + (sx - 0.3) * (1 - fill) / 2, yy, zf - 0.003), ((sx - 0.3) * fill, 0.08, 0.004), 0.0, m["paint"], col)


def founder(k, m):
    """The Founder's desk (specs/hq-onboarding.md): a walnut writing desk against the panelled wall, its leather chair
    pushed back and turned as if someone just stood up, a closed notebook and a pen; above it the plaque, its canvas
    blank (only David writes it: lib/game/arrival/hq/lines.ts FOUNDER_PLAQUE)."""
    desk, chair, plaque = FX["founder"]["blocks"]
    (x, _, z), (sx, sy, sz) = desk["at"], desk["size"]
    k.rbox((x, sy - 0.025, z), (sx, 0.05, sz), 0.012, m["walnut"], WALNUT, uv_len=1.2)
    for s in (-1, 1):
        k.rbox((x + s * (sx / 2 - 0.25), (sy - 0.05) / 2, z), (0.46, sy - 0.05, sz - 0.08), 0.012, m["walnut"], WALNUT_DARK, uv_len=1.2, v_axis=1)
        for dy in (0.18, 0.4):
            k.rbox((x + s * (sx / 2 - 0.25), dy, z - sz / 2 + 0.03), (0.12, 0.012, 0.012), 0.004, m["metal"], BRASS)
    k.rbox((x - 0.3, sy + 0.012, z - 0.05), (0.26, 0.022, 0.34), 0.006, m["paint"], LEATHER_BLACK, rot=K.game_rot(yaw=0.18))
    k.tube([(x - 0.06, sy + 0.01, z - 0.12), (x + 0.1, sy + 0.01, z - 0.02)], 0.007, m["metal"], BRASS, n=6, caps=True)
    k.lathe((x + 0.55, sy, z + 0.15), [(0, 0), (0.05, 0), (0.05, 0.12), (0, 0.12)], m["metal"], BRASS, n=12)
    (cx, _, cz) = chair["at"]
    office_chair(k, m, cx, cz, math.pi + 0.95, seat=0.47)
    (px, py, pz), (psx, psy, _) = plaque["at"], plaque["size"]
    zc = D - 0.08
    k.rbox((px, py + psy / 2, zc), (psx + 0.12, psy + 0.12, 0.05), 0.012, m["walnut"], WALNUT_DARK)
    k.rbox((px, py + psy / 2, zc - 0.03), (psx - 0.04, psy - 0.04, 0.01), 0.0, m["cloth"], "#eadfc6")
    k.rbox((px, py + psy + 0.15, zc - 0.08), (0.42, 0.04, 0.06), 0.015, m["metal"], BRASS)
    k.rbox((px, py + psy + 0.13, zc - 0.11), (0.38, 0.006, 0.02), 0.0, m["glow"], "#ffffff")


# ================================================================ the mezzanine
def upper(m):
    k = K.Kit("hq_upper")
    z0 = UP["z0"]
    # the slab: plaster underneath (the tracks hang from it), walnut planks on top, a walnut fascia facing the door
    k.rbox((0, F - SLAB / 2, (z0 + D) / 2), (2 * W, SLAB, D - z0), 0.0, m["plaster"], PLASTER_UNDER, uv_len=2.5)
    floor_quad(k, m["floor"], F + 0.002, -W, W, z0, D)
    k.rbox((0, F - SLAB / 2 + 0.01, z0 - 0.02), (2 * W, SLAB + 0.04, 0.045), 0.01, m["walnut"], WALNUT, uv_len=1.4)
    # the upper storey of the walls round it, with their windows
    ups = [w for w in L["windows"] if w["z0"] >= z0]
    for x in (-W, W):
        side_wall(k, m, x, z0, D + T, F, TOP, [(w["z0"], w["z1"], w["y0"], w["y1"]) for w in ups if wall_x(w) == x])
    back_wall(k, m, F, TOP)
    skirting(k, m, F, z0, D)
    for w in ups:
        window_frame(k, m, w)
    # walnut panelling behind the lounge's back sofa (ref 2)
    k.rbox((2.8, F + 1.35, D - 0.03), (7.2, 2.7, 0.04), 0.0, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
    x = 2.8 - 3.6 + 0.6
    while x < 2.8 + 3.6 - 0.1:
        k.rbox((x, F + 1.35, D - 0.052), (0.014, 2.7, 0.006), 0.0, m["paint"], WALNUT_DARK)
        x += 0.63
    for name, fn in (("rail", rail), ("lounge", lounge), ("admin doors", admin_doors), ("art", art)):
        counted(k, "up " + name, fn, k, m)
    for b in FX["upper-plants"]["blocks"]:
        counted(k, "up plants", plant, k, m, b, int(abs(b["at"][0] * 10 + b["at"][2] * 3)) + 5, F)
    for f in L["fixtures"]:
        if f["id"].startswith("banner-"):
            counted(k, "up banners", banner, k, m, f["blocks"][0])
    for t in L["tracks"]:
        if t["from"][1] < F:
            counted(k, "up tracks", track, k, m, t)
    return k.finish(name="hq_upper")


def rail(k, m):
    """The mezzanine's front: glass panels between slim dark posts, a walnut handrail."""
    for rl in L["rails"]:
        (ax, az), (bx, bz) = rl["from"], rl["to"]
        z = az - 0.06
        k.rbox(((ax + bx) / 2, F + 0.52, z), (abs(bx - ax), 0.96, 0.016), 0.004, m["glass"], "#d6e6ea")
        k.rbox(((ax + bx) / 2, F + 1.02, z), (abs(bx - ax) + 0.04, 0.05, 0.07), 0.018, m["walnut"], WALNUT, uv_len=1.4)
        n = max(2, int(abs(bx - ax) / 1.5) + 1)
        for i in range(n):
            px = ax + (bx - ax) * i / (n - 1)
            k.rbox((px, F + 0.5, z), (0.035, 1.0, 0.035), 0.008, m["paint"], STEEL_DARK, segs=1)


def lounge(k, m):
    """The big lounge (ref 2): the cream shag carpet, the velvet sofas, the travertine table, the round black table with
    the mushroom lamp, beanbags by the rail, and the chrome arc lamp."""
    b = FX["upper-carpet"]["blocks"][0]
    (x, _, z), (sx, sy, sz) = b["at"], b["size"]
    k.rbox((x, F + 0.018, z), (sx, 0.036, sz), 0.02, m["rug"], CREAM, uv_len=0.7)
    back, side, chair = FX["upper-sofas"]["blocks"]
    (x, _, z), (sx, sy, sz) = back["at"], back["size"]
    sofa_up(k, m, x, z, yaw_facing("-z"), sx, sz, sy, VELVET, seats=4)
    (x, _, z), (sx, sy, sz) = side["at"], side["size"]
    sofa_up(k, m, x, z, yaw_facing("-x"), sz, sx, sy, VELVET, seats=3)
    (x, _, z), (sx, sy, sz) = chair["at"], chair["size"]
    sofa_up(k, m, x, z, yaw_facing("+x"), sx, sz, sy, VELVET_OLIVE, seats=1)
    table, round_ = FX["upper-tables"]["blocks"]
    (x, _, z), (sx, sy, sz) = table["at"], table["size"]
    k.rbox((x, F + 0.08, z), (sx - 0.3, 0.16, sz - 0.3), 0.02, m["stone"], STONE_DARK)
    k.rbox((x, F + sy - 0.05, z), (sx, 0.1, sz), 0.03, m["stone"], STONE)
    for i, c in enumerate(("#e9e4d8", "#2f4a6b")):
        k.rbox((x - 0.4, F + sy + 0.022 + i * 0.04, z + 0.1), (0.34, 0.04, 0.26), 0.004, m["paint"], c, rot=K.game_rot(yaw=0.3 * i))
    k.lathe((x + 0.35, F + sy, z - 0.05), [(0, 0), (0.16, 0), (0.18, 0.03), (0, 0.03)], m["paint"], BLACK, n=12)
    (x, _, z), (sx, sy, sz) = round_["at"], round_["size"]
    r = sx / 2
    k.lathe((x, F, z), [(0, 0), (r * 0.5, 0), (r * 0.45, 0.04), (r * 0.12, 0.08), (r * 0.12, sy - 0.05), (r, sy - 0.04), (r * 1.0, sy), (0, sy)], m["paint"], BLACK, n=16)
    lp = LAMPS["upper-mushroom"]["light"]
    mushroom(k, m, lp[0], F + sy, lp[2], (lp[1] - sy) / 0.62 * 1.3, r=0.18)
    for i in range(3):
        a = 1.2 + i * 0.9
        k.lathe((x + math.cos(a) * 0.2, F + sy, z + math.sin(a) * 0.2), [(0, 0), (0.03, 0), (0.035, 0.09), (0.03, 0.09), (0.026, 0.01), (0, 0.01)], m["glass"], "#e8f0f2", n=10)
    for i, b in enumerate(FX["beanbags"]["blocks"]):
        (x, _, z), (sx, sy, sz) = b["at"], b["size"]
        col = ("#a8643f", "#7a7a4a", "#d9cdb5", "#b08a5e")[i % 4]
        k.blob((x, F + sy * 0.55, z), (sx / 2, sy * 0.6, sz / 2), m["cloth"], col, segs=12, rings=6, seed=i + 3, lumpy=0.12, flat_bottom=-sy * 0.5)
    arc_lamp(k, m)


def sofa_up(k, m, x, z, yaw, w, d, h, col, seats):
    """A velvet sofa on the mezzanine's floor."""
    sofa(k, m, x, z, yaw, w, d, h, m["cloth"], col, seats=seats, base=F)


def arc_lamp(k, m):
    """The big chrome arc lamp (ref 2): a marble block for a foot, the arc rising and reaching over the lounge, a white
    globe hanging from its end, lit from the lower half."""
    b, globe = FX["arc-lamp"]["blocks"]
    (fx_, _, fz) = b["at"]
    (gx, gy, gz), (gs, _, _) = globe["at"], globe["size"]
    gr = gs / 2
    gc = (gx, F + gy + gr, gz)
    k.rbox((fx_, F + 0.13, fz), (0.42, 0.26, 0.42), 0.04, m["stone"], "#ebe6de")
    p0, p3 = np.array((fx_, F + 0.26, fz)), np.array((gx, gc[1] + gr + 0.08, gz))
    p1, p2 = p0 + np.array((0, 3.1, 0)), p3 + np.array((0, 1.0, 0)) + (p0 - p3) * np.array((0.18, 0, 0.18))
    pts = []
    for t in np.linspace(0, 1, 22):
        q = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
        pts.append(tuple(q))
    k.tube(pts, 0.024, m["metal"], CHROME, n=8, caps=True)
    k.tube([pts[-1], (gx, gc[1] + gr - 0.02, gz)], 0.012, m["metal"], CHROME, n=6)
    k.blob(gc, (gr, gr, gr), m["paint"], WHITE, segs=18, rings=10, flat_bottom=-gr * 0.1)
    k.lathe((gx, gc[1] - gr * 0.08, gz), [(0, -gr * 0.95), (gr * 0.55, -gr * 0.85), (gr * 0.92, -gr * 0.4), (gr * 1.005, 0)], m["glow"], "#ffffff", n=12)
    k.tube([(gx + math.cos(t) * gr * 1.01, gc[1] - gr * 0.08, gz + math.sin(t) * gr * 1.01) for t in np.linspace(0, TAU, 19)[:-1]], 0.012, m["metal"], CHROME, n=6, closed_path=True)


def admin_doors(k, m):
    """Two locked doors at the back of the mezzanine: walnut leaves in black steel frames, a brass lever and a keypad,
    and an "ADMINS ONLY" plate (its letters joined in main)."""
    for b in FX["admin-doors"]["blocks"]:
        (x, y0, _), (sx, sy, _) = b["at"], b["size"]
        base = F + y0
        zf = D - 0.04
        for s in (-1, 1):
            k.rbox((x + s * (sx / 2 + 0.05), base + sy / 2 + 0.04, zf - 0.02), (0.1, sy + 0.08, 0.06), 0.01, m["paint"], BLACK)
        k.rbox((x, base + sy + 0.05, zf - 0.02), (sx + 0.2, 0.1, 0.06), 0.01, m["paint"], BLACK)
        k.rbox((x, base + sy / 2, zf - 0.01), (sx, sy, 0.05), 0.008, m["walnut"], WALNUT, uv_len=1.2, v_axis=1)
        for yy in (0.55, 1.45):
            k.rbox((x, base + yy + 0.4, zf - 0.04), (sx - 0.3, 0.012, 0.006), 0.0, m["paint"], WALNUT_DARK)
        lx = x + sx / 2 - 0.13
        k.rbox((lx, base + 1.02, zf - 0.045), (0.05, 0.16, 0.02), 0.006, m["metal"], BRASS)
        k.tube([(lx, base + 1.06, zf - 0.07), (lx - 0.14, base + 1.06, zf - 0.08)], 0.012, m["metal"], BRASS, n=6, caps=True)
        k.rbox((lx, base + 1.32, zf - 0.045), (0.09, 0.14, 0.02), 0.006, m["paint"], BLACK)
        k.rbox((lx, base + 1.36, zf - 0.057), (0.05, 0.03, 0.004), 0.0, m["glow"], "#ffffff")
        k.rbox((x, base + 1.62, zf - 0.07), (0.62, 0.14, 0.02), 0.006, m["paint"], BLACK)


def art(k, m):
    """The lit art piece on the back wall (ref 2): a black frame round a dark panel, light glowing through two slots and
    four round holes."""
    b = FX["art"]["blocks"][0]
    (x, y0, _), (sx, sy, _) = b["at"], b["size"]
    y = F + y0 + sy / 2
    zf = D - 0.04
    k.rbox((x, y, zf - 0.03), (sx, sy, 0.06), 0.01, m["paint"], BLACK)
    k.rbox((x, y, zf - 0.062), (sx - 0.12, sy - 0.12, 0.004), 0.0, m["paint"], "#3a3633")
    for sxo in (-0.33, -0.2):
        k.rbox((x + sxo, y, zf - 0.066), (0.05, sy - 0.32, 0.004), 0.0, m["glow"], "#ffffff")
    for dx in (0.05, 0.27):
        for dy in (-0.2, 0.2):
            k.lathe((x + dx, y + dy, zf - 0.066), [(0, 0), (0.05, 0)], m["glow"], "#ffffff", d=(0, 0, -1), n=14)


def banner(k, m, b):
    """A yearly banner, blank until David's designs: cream cloth with a V at its foot on a walnut dowel with brass caps,
    hung by two cords from the handrail in front of the rail, facing the door."""
    (x, y0, z), (sx, sy, _) = b["at"], b["size"]
    top = F + y0 + sy
    k.tube([(x - sx / 2 - 0.07, top + 0.02, z), (x + sx / 2 + 0.07, top + 0.02, z)], 0.018, m["walnut"], WALNUT, n=8, caps=True)
    for s in (-1, 1):
        k.blob((x + s * (sx / 2 + 0.085), top + 0.02, z), (0.026, 0.026, 0.026), m["metal"], BRASS, segs=6, rings=4)
        k.tube([(x + s * (sx / 2 - 0.05), top + 0.03, z), (x + s * (sx / 2 - 0.15), F + 1.04, z + 0.03)], 0.005, m["paint"], CHARCOAL, n=4)
    a = sx / 2
    outline = [(-a, 0.0), (-a, -sy + 0.24), (0.0, -sy), (a, -sy + 0.24), (a, 0.0)]
    k.extrude(outline, -0.012, 0.012, m["cloth"], CREAM, at=(x, top, z))
    k.rbox((x, top - 0.1, z - 0.014), (sx - 0.06, 0.02, 0.004), 0.0, m["cloth"], "#d9cbb0")


# ================================================================ the ceiling (seen only from under it)
def ceiling(m):
    k = K.Kit("hq_ceiling")
    oc = L["ovalCeiling"]
    y = TOP
    # plain and dark everywhere but the lounge's walnut ovals
    rects = cut([(-W, W, -D, D)], (oc["x0"], oc["x1"], oc["z0"], oc["z1"]))
    for (x0, x1, z0, z1) in rects:
        k.rbox(((x0 + x1) / 2, y + 0.03, (z0 + z1) / 2), (x1 - x0, 0.06, z1 - z0), 0.0, m["plaster"], CEIL, uv_len=2.5)
    oval_ceiling(k, m, oc, y)
    front_wall(k, m)
    for t in L["tracks"]:
        if t["from"][1] >= F:
            track(k, m, t)
    return k.finish(name="hq_ceiling")


def oval_ceiling(k, m, oc, y):
    """The walnut ceiling with its oval wells (ref 1), over the upper lounge only: each well a walnut collar rising to a
    glowing oval of light."""
    x0, x1, z0, z1 = oc["x0"], oc["x1"], oc["z0"], oc["z1"]
    cols, rows, n = 5, 3, 28
    cw, cd = (x1 - x0) / cols, (z1 - z0) / rows
    rx, rz = cw * 0.38, cd * 0.34
    yb = y - 0.04
    for i in range(cols):
        for j in range(rows):
            cx, cz = x0 + cw * (i + 0.5), z0 + cd * (j + 0.5)
            ang = [TAU * q / n for q in range(n)]
            ell = [(cx + rx * math.cos(a), cz + rz * math.sin(a)) for a in ang]
            box = []
            for a in ang:
                c, s = math.cos(a), math.sin(a)
                t = min(cw / 2 / max(abs(c), 1e-6), cd / 2 / max(abs(s), 1e-6))
                box.append((cx + c * t, cz + s * t))
            for q in range(n):
                q2 = (q + 1) % n
                pts = [(box[q][0], yb, box[q][1]), (box[q2][0], yb, box[q2][1]), (ell[q2][0], yb, ell[q2][1]), (ell[q][0], yb, ell[q][1])]
                k.face([k.vert(p) for p in pts], [(p[0] / 1.4, p[2] / 1.4) for p in pts], m["walnut"], WALNUT)
                hi = yb + 0.3
                wall = [(ell[q][0], yb, ell[q][1]), (ell[q2][0], yb, ell[q2][1]), (ell[q2][0], hi, ell[q2][1]), (ell[q][0], hi, ell[q][1])]
                k.face([k.vert(p) for p in wall], [(q / n * 3, 0), ((q + 1) / n * 3, 0), ((q + 1) / n * 3, 0.3), (q / n * 3, 0.3)], m["walnut"], WALNUT_LIGHT)
            # (a vertical lathe's section runs its sx along game z and its sz along x)
            k.lathe((cx, yb + 0.3, cz), [(0, 0), (1.0, 0)], m["glow"], "#ffffff", n=n, sx=rz, sz=rx)
    # its edge: a walnut fascia dropping a little below the plain ceiling
    for (c, s_) in ((((x0 + x1) / 2, yb - 0.02, z0), (x1 - x0, 0.1, 0.05)), (((x0 + x1) / 2, yb - 0.02, z1), (x1 - x0, 0.1, 0.05)),
                    ((x0, yb - 0.02, (z0 + z1) / 2), (0.05, 0.1, z1 - z0)), ((x1, yb - 0.02, (z0 + z1) / 2), (0.05, 0.1, z1 - z0))):
        k.rbox(c, s_, 0.01, m["walnut"], WALNUT_DARK)


def caster():
    """Shadow only: the room's top and the cut-away front wall above its lip, so the sun or the moon comes in by the
    windows (the engine never draws it, it only casts)."""
    k = K.Kit("hq_caster")
    mat = K.Mat("M_Caster", "#000000")
    k.rbox((0, TOP + 0.12, 0), (2 * W + 2 * T + 0.6, 0.1, 2 * D + 2 * T + 0.6), 0.0, mat, segs=1)
    k.rbox((0, (LIP + TOP) / 2 + 0.06, -D - T / 2), (2 * W + 2 * T, TOP - LIP + 0.12, T), 0.0, mat, segs=1)
    return k.finish(name="hq_caster")


# ================================================================ the aquarium (its shaders are the engine's)
def tank():
    x0, z0, z1, y0, y1 = A["x0"], A["z0"], A["z1"], A["y0"], A["y1"]
    xb = W - 0.02
    gx = x0 + 0.02
    zl = z1 - z0
    # the inside: back, floor and ends, UVs (along, up) across the tank for the water's gradient
    ki = K.Kit("hq_tank_inner")
    mi = K.Mat("M_Tank", "#ffffff", rough=1.0)
    uv = lambda p: ((p[2] - z0) / zl, (p[1] - y0) / (y1 - y0))
    for pts in ([(xb, y0, z0), (xb, y0, z1), (xb, y1, z1), (xb, y1, z0)],
                [(gx, y0, z0), (gx, y0, z1), (xb, y0, z1), (xb, y0, z0)],
                [(gx, y0, z0 + 0.02), (xb, y0, z0 + 0.02), (xb, y1, z0 + 0.02), (gx, y1, z0 + 0.02)],
                [(gx, y0, z1 - 0.02), (xb, y0, z1 - 0.02), (xb, y1, z1 - 0.02), (gx, y1, z1 - 0.02)]):
        ki.face([ki.vert(p) for p in pts], [uv(p) for p in pts], mi, "#ffffff")
    inner = ki.finish(name="hq_tank_inner")
    # the reef: sand, rock rising up both ends (ref 2's size), coral and weed low down (ref 1's colour)
    kr = K.Kit("hq_tank_reef")
    mr = K.Mat("M_Reef", "#ffffff", rough=0.9)
    rng = np.random.default_rng(97)
    for i in range(14):
        z = z0 + 0.3 + (zl - 0.6) * i / 13
        kr.blob((x0 + 0.7 + float(rng.uniform(-0.05, 0.05)), y0 + 0.02, z), (0.55, 0.12, 0.4), mr, "#d8ccad", segs=10, rings=4, seed=i, lumpy=0.12, flat_bottom=0.0)
    # Reef rock (ref 2): a ridge along the back, rising to a tall face at the mezzanine's end and a lower one by the door,
    # piled from irregular lumps of every size, smaller as they climb, in browns, olives and a purplish coralline.
    peaks = ((z1 - 0.9, 3.7, 1.6), (z0 + 0.9, 2.3, 1.3), (z0 + zl * 0.52, 1.25, 1.1))

    def ridge(z):
        return max(0.7, *(top * max(0.0, 1 - ((z - zc) / w) ** 2) for zc, top, w in peaks))
    rocks = []
    tones = ("#867a69", "#7b7262", "#7e7a5e", "#7c6b77", "#8f8270", "#6f675b")
    for i in range(46):
        z = z0 + 0.3 + float(rng.uniform(0, zl - 0.6))
        h = ridge(z)
        yy = y0 + 0.15 + float(rng.uniform(0, 1) ** 1.4) * (h - 0.3)
        t = (yy - y0) / max(h, 0.1)
        rr = (0.42 - 0.24 * t) * float(rng.uniform(0.7, 1.15))
        ext = rr * 1.05 * 1.3
        zr = min(max(z, z0 + ext + 0.05), z1 - ext - 0.05)
        xr = xb - 0.35 - float(rng.uniform(0, 0.35)) * (1 - t)
        rocks.append((xr, yy, zr, rr))
    for i, (x, yy, z, rr) in enumerate(rocks):
        kr.blob((x, yy, z), (min(rr, 0.38), rr * float(rng.uniform(0.6, 0.85)), rr * 1.05), mr, tones[i % len(tones)], segs=9, rings=5, seed=40 + i, lumpy=0.4,
                rot=K.game_rot(yaw=float(rng.uniform(-0.5, 0.5)), roll=float(rng.uniform(-0.3, 0.3))))
    corals = ["#ee8a6a", "#e86b8f", "#f2a54a", "#9b6bc4", "#e8c75a", "#f07a56"]
    for i in range(40):
        z = z0 + 0.25 + float(rng.uniform(0, zl - 0.5))
        x = float(rng.uniform(x0 + 0.35, xb - 0.25))
        yy = y0 + 0.12 + float(rng.uniform(0, 0.3))
        if i % 3:                     # on a rock: its top, toward the glass
            rk = rocks[int(rng.integers(0, len(rocks)))]
            z, yy, x = rk[2] + float(rng.uniform(-0.15, 0.15)), rk[1] + rk[3] * 0.55, rk[0] - rk[3] * 0.45
        c = corals[i % len(corals)]
        kind = i % 4
        if kind == 0:                 # a boulder coral
            kr.blob((x, yy + 0.1, z), (0.16, 0.12, 0.16), mr, c, segs=10, rings=6, seed=70 + i, lumpy=0.25, flat_bottom=-0.08)
        elif kind == 1:               # branching
            for bi in range(5):
                a = bi * TAU / 5 + i
                kr.tube([(x, yy, z), (x + math.cos(a) * 0.08, yy + 0.18, z + math.sin(a) * 0.08), (x + math.cos(a) * 0.14, yy + 0.32 + 0.05 * (bi % 2), z + math.sin(a) * 0.14)], 0.022, mr, c, n=6, caps=True)
        elif kind == 2:               # a sea fan
            kr.blob((x, yy + 0.28, z), (0.03, 0.26, 0.22), mr, "#9b6bc4" if i % 3 else "#e86b8f", segs=10, rings=6, seed=90 + i, rot=K.game_rot(yaw=float(rng.uniform(-0.6, 0.6))))
        else:                         # weed
            for bi in range(6):
                a = bi * 1.7 + i
                h = 0.3 + 0.25 * ((bi * 7) % 3) / 2
                kr.tube([(x + math.cos(a) * 0.05, yy - 0.05, z + math.sin(a) * 0.05), (x + math.cos(a) * 0.08, yy + h * 0.5, z + math.sin(a) * 0.1), (x + math.cos(a) * 0.04, yy + h, z + math.sin(a) * 0.12)], 0.012, mr, "#5f9a55" if bi % 2 else "#78ad5f", n=5)
    reef = kr.finish(name="hq_tank_reef")
    kg = K.Kit("hq_tank_glass")
    kg.rbox((x0 + 0.005, (y0 + y1) / 2, (z0 + z1) / 2), (0.01, y1 - y0, zl), 0.0, K.Mat("M_TankGlass", "#ffffff", rough=0.05), segs=1)
    glass = kg.finish(name="hq_tank_glass")
    ks = K.Kit("hq_tank_surface")
    ys = y1 - 0.14
    pts = [(gx, ys, z0), (gx, ys, z1), (xb, ys, z1), (xb, ys, z0)]
    ks.face([ks.vert(p) for p in pts], [(p[2], p[0]) for p in pts], K.Mat("M_Water", "#ffffff", rough=0.1), "#ffffff")
    surface = ks.finish(name="hq_tank_surface")
    return [inner, reef, glass, surface]


def main():
    K.reset()
    m = mats()
    g = ground(m)
    gw = panes([w for w in L["windows"] if w["z1"] <= UP["z0"]], "hq_windows")
    c = caster()
    K.export([g, gw, c], f"{OUT}/ground.glb")
    K.clear()
    m = mats()
    u = upper(m)
    texts = []
    for b in FX["admin-doors"]["blocks"]:
        (x, y0, _), _s = b["at"], b["size"]
        texts.append(letters("ADMINS ONLY", (x, F + y0 + 1.62, D - 0.04 - 0.085), 0.06, f"hq_letters_{x}"))
    u = join(u, texts)
    uw = panes([w for w in L["windows"] if w["z0"] >= UP["z0"]], "hq_windows_upper")
    K.export([u, uw], f"{OUT}/upper.glb")
    K.clear()
    m = mats()
    K.export([ceiling(m), front_panes()], f"{OUT}/ceiling.glb")
    K.clear()
    K.export(tank(), f"{OUT}/tank.glb")
    for name, n in sorted(TRIS.items(), key=lambda q: -q[1]):
        print(f"TRIS {name}: {n}")


main()
