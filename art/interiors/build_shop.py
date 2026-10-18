"""The shop's room (specs/interiors/shop.md, phase 2; row 313): the ground floor and the mezzanine's shell, modelled on the
numbers the game walks (art/interiors/shop_layout.json, written from web/lib/game/shopLayout.ts by
web/scripts/shop-layout-json.mjs; change the layout there, never here).

The look (David's art direction, specs/art-direction-oct17.md, and the lane rules' texture rule): simple, slightly
smooth and a little cartoony, from his two references (concrete, metal, pegboard, glazed tile, herringbone oak, edge
lighting). Rounded edges everywhere. Textures only where they're seen up close: the herringbone oak floor and the
glazed tile of the counter and the wall behind it, both subtle and low in contrast. Everything else is plain colour on
the shared presets (P_Stone, P_Metal, P_Wood, P_Paint, P_Glass, P_Cloth: web/lib/game/modelMaterials.ts
MATERIAL_PRESETS), its colour in COLOR_0, so every part of one preset draws as one. The edge lights are M_Glow. No
downloads, no references beyond David's.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/build_shop.py

Writes web/public/assets/game/interiors/shop/ground.glb (shop_ground, and shop_windows: the panes the engine fills with
the outside) and mezz.glb (shop_mezz: the mezzanine's slab, edge, railings, sign and the upper storey of the walls, and
its window). Game coordinates throughout (propkit.G): x across (+x on screen left), y up, z into the room.
"""
import json, math, os, sys
import numpy as np
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402

L = json.load(open(os.path.join(HERE, "shop_layout.json")))
F, SLAB = L["floorHeight"], L["slab"]
W, D, T, LIP = L["room"]["halfW"], L["room"]["halfD"], L["room"]["wall"], L["room"]["lip"]
S, M = L["stair"], L["mezz"]
FX = {f["id"]: f for f in L["fixtures"]}
OUT = "game/interiors/shop"

# ================================================================ palette (sRGB): the references' calm greys, oak and sage
WALL, SKIRT = "#ece8e1", "#d6d0c6"
CONCRETE, CONCRETE_DARK = "#cbc7bf", "#b9b4ab"
STEEL, STEEL_DARK = "#a3a9ae", "#3b4046"
OAK_TOP, BOOTH_OAK = "#b8977a", "#d6bb98"
SHEER, LINEN = "#f4f1ea", "#adbcaa"
CRATE, CRATE_SLOT = "#efefeb", "#d4d4cf"
LEAF, LEAF_LIGHT, SOIL = "#6c8c5a", "#86a670", "#5b4636"
SAGE = "#8fb39e"
FRAME = "#f2f0ec"


# ================================================================ textures (numpy, sRGB, subtle)
def herringbone(size=512, seed=11):
    """Herringbone oak, axis-aligned in plank-width units (the floor's UVs turn it 45 degrees): planks four widths long,
    tiling every 8 widths. In plank units a point lies on a horizontal plank when (x - floor(y)) mod 8 < 4 (that plank is
    one of 8, by floor(y) mod 8), else on a vertical one (by floor(x) mod 8): 16 planks a repeat, seamless. Each plank its
    own tone, a soft grain along it, and seams only a shade darker."""
    rng = np.random.default_rng(seed)
    px = size / 8
    ys, xs = np.mgrid[0:size, 0:size] / px
    fy, fx = np.floor(ys), np.floor(xs)
    horiz = np.mod(xs - fy, 8) < 4
    vert_ok = np.mod(ys - fx - 1, 8) < 4
    gaps = int((~horiz & ~vert_ok).sum())
    print(f"herringbone: {gaps} uncovered pixels")
    pid = np.where(horiz, np.mod(fy, 8), 8 + np.mod(fx, 8)).astype(int)
    tone = rng.uniform(-0.055, 0.055, 16)[pid]
    across = np.where(horiz, ys, xs)
    g = K.fbm(size, size, 16, seed + 3, octaves=3)
    streak = np.sin((across * 7.0 + g * 2.0) * math.pi) * 0.5 + 0.5
    grain = (streak - 0.5) * 0.04 + (K.fbm(size, size, 32, seed + 9) - 0.5) * 0.03
    edge = np.zeros(pid.shape)
    for dy, dx in ((1, 0), (0, 1), (-1, 0), (0, -1)):
        edge = np.maximum(edge, (pid != np.roll(pid, (dy, dx), axis=(0, 1))).astype(float))
    base = K.arr("#cfa77c")
    rgb = base[None, None, :] * (1 + tone[..., None] + grain[..., None]) * (1 - 0.1 * edge[..., None])
    rgb = rgb * np.array([1.0, 0.985, 0.96])[None, None, :]
    return np.clip(rgb, 0, 1)


def glazed_tile(size=256, cols=4, rows=2, seed=21):
    """Glazed sage tile in a stack bond, tall rectangles (ref 2): each tile a slightly different glaze, a soft sheen
    toward its top, a faint bevel; the grout pale. cols x rows tiles across the image."""
    rng = np.random.default_rng(seed)
    u, v = K.grid(size, size)
    tu, tv = u * cols, v * rows
    iu, iv = np.floor(tu).astype(int), np.floor(tv).astype(int)
    fu, fv = tu - iu, tv - iv
    shade = rng.uniform(-0.06, 0.05, (rows, cols))
    hue = rng.uniform(-0.03, 0.03, (rows, cols))
    t = shade[iv % rows, iu % cols]
    hshift = hue[iv % rows, iu % cols]
    base = K.arr("#a9c4b6")
    rgb = base[None, None, :] * (1 + t[..., None])
    rgb[..., 0] *= 1 - hshift
    rgb[..., 2] *= 1 + hshift
    # the glaze: a soft sheen high on each tile, pooling a touch darker at its foot, and a little mottle
    sheen = np.exp(-((fv - 0.22) ** 2) / 0.02) * 0.06
    pool = K.smooth(0.7, 1.0, fv) * -0.05
    mottle = (K.fbm(size, size, 10, seed + 4) - 0.5) * 0.06
    rgb = rgb * (1 + (sheen + pool + mottle)[..., None])
    # bevel and grout
    gw = 0.05
    bev = np.minimum(np.minimum(fu, 1 - fu) * cols / rows, np.minimum(fv, 1 - fv))
    rgb = rgb * (1 - 0.08 * (1 - K.smooth(0.0, 0.07, bev)))[..., None]
    grout = (np.minimum(fu, 1 - fu) < gw / 2 * rows / cols) | (np.minimum(fv, 1 - fv) < gw / 2)
    rgb[grout] = K.arr("#dfe6e1")
    return np.clip(rgb, 0, 1)


# ================================================================ materials
def glow_mat(name="M_Glow", color="#fff1d8", strength=2.0):
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


def mats():
    return {
        "stone": K.Mat("P_Stone", "#ffffff", rough=0.95),
        "metal": K.Mat("P_Metal", "#ffffff", rough=0.4),
        "wood": K.Mat("P_Wood", "#ffffff", rough=0.9),
        "paint": K.Mat("P_Paint", "#ffffff", rough=0.45),
        "glass": K.Mat("P_Glass", "#ffffff", rough=0.08),
        "cloth": K.Mat("P_Cloth", "#ffffff", rough=1.0),
        "oak": K.Mat("M_Oak", "#ffffff", rough=0.8, tex=K.image("shop_oak", herringbone())),
        "tile": K.Mat("M_Tile", "#ffffff", rough=0.35, tex=K.image("shop_tile", glazed_tile())),
        "glow": glow_mat(),
    }


# ================================================================ helpers
def centre(b, lift=0.0):
    (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
    return (x, y0 + sy / 2 + lift, z), (sx, sy, sz)


def block(k, b, mat, col, r=0.02, lift=0.0, uv_len=1.0):
    c, s = centre(b, lift)
    return k.rbox(c, s, min(r, min(s) * 0.45), mat, col, uv_len=uv_len)


def strip(k, s, m, lift=0.0):
    a, b = s["from"], s["to"]
    dx, dz = abs(b[0] - a[0]), abs(b[2] - a[2])
    c = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + lift, (a[2] + b[2]) / 2)
    size = (dx + 0.04, 0.025, 0.04) if dx >= dz else (0.04, 0.025, dz + 0.04)
    k.rbox(c, size, 0.008, m["glow"], "#ffffff", segs=1)


def curtain(k, x, z0, z1, y0, y1, mat, col, folds=9, depth=0.05, axis="z", seed=0, gather=0.0):
    """A pleated curtain hanging from y1 to y0: soft round pleats along its width (along game z at x, or along x at z),
    finely sampled so they shade smooth. `gather` draws the hem in toward the middle (a tied-back drape), a fraction of
    the width."""
    n = folds * 12
    rows = 6 if gather else 1
    grid = []
    for j in range(rows + 1):
        v = j / rows                                   # 0 at the hem, 1 at the rail
        pull = gather * (1 - v) ** 2
        row = []
        for t in np.linspace(0, 1, n + 1):
            off = math.sin(t * folds * math.tau) * depth * (1 + 0.6 * (1 - v) * (gather > 0))
            mid = (z0 + z1) / 2
            w = z0 + (z1 - z0) * t
            w = w + (mid - w) * pull
            y = y0 + (y1 - y0) * v
            row.append((x + off, y, w) if axis == "z" else (w, y, x + off))
        grid.append(row)
    for j in range(rows):
        for i in range(n):
            k.quad([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], mat, col)


# ================================================================ the ground floor
def ground(m):
    k = K.Kit("shop_ground")
    # Floor: herringbone oak, its UVs turned 45 degrees (one repeat every 8 plank widths of 0.12).
    rep = 8 * 0.12
    corners = [(-W, 0, -D), (W, 0, -D), (W, 0, D), (-W, 0, D)]
    uv = [((x + z) / math.sqrt(2) / rep, (z - x) / math.sqrt(2) / rep) for x, _, z in corners]
    k.face([k.vert(p) for p in corners], uv, m["oak"], "#ffffff")
    walls(k, m, 0)
    # The cut-away near wall: a low lip either side of the door, capped; a slim dark frame at the door; a step outside.
    for x0, x1 in ((-W - T, L["door"]["x"] - L["door"]["half"]), (L["door"]["x"] + L["door"]["half"], W + T)):
        k.rbox(((x0 + x1) / 2, LIP / 2, -D - T / 2), (x1 - x0, LIP, T), 0.02, m["paint"], WALL)
        k.rbox(((x0 + x1) / 2, LIP + 0.02, -D - T / 2), (x1 - x0 + 0.02, 0.04, T + 0.04), 0.012, m["paint"], SKIRT)
    for sx in (-1, 1):
        jx = L["door"]["x"] + sx * (L["door"]["half"] + 0.04)
        k.rbox((jx, (LIP + 0.25) / 2, -D - T / 2), (0.08, LIP + 0.25, T + 0.06), 0.015, m["paint"], STEEL_DARK)
    k.rbox((0, -0.03, -D - T - 0.28), (2 * L["door"]["half"] + 0.5, 0.06, 0.5), 0.02, m["stone"], CONCRETE)
    # Fixtures
    counter(k, m)
    b = FX["tile-wall"]["blocks"][0]
    k.rbox(centre(b)[0], centre(b)[1], 0.015, m["tile"], "#ffffff", uv_len=0.48)
    for b in FX["crates"]["blocks"]:
        crate(k, m, b)
    plant(k, m)
    for b in FX["curtains"]["blocks"]:
        (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
        curtain(k, x - 0.02, z - sz / 2, z + sz / 2, y0 + 0.04, y0 + sy, m["cloth"], SHEER, folds=3, depth=0.035, gather=0.18)
    curtain_rod(k, m, L["windows"][0], 0, FX["curtains"]["blocks"])
    window_frame(k, m, L["windows"][0], 0)
    for b in FX["seasonal-plinths"]["blocks"]:
        block(k, b, m["stone"], CONCRETE, r=0.035)
    table(k, m, "tools-table")
    shelving(k, m)
    block(k, FX["dais"]["blocks"][0], m["stone"], CONCRETE_DARK, r=0.03)
    rail(k, m)
    table(k, m, "clothes-table")
    booths(k, m)
    sign(k, m)
    stair(k, m)
    pendant(k, m)
    for s in L["strips"]:
        if s["level"] == 0:
            strip(k, s, m)
    return k.finish(name="shop_ground")


def walls(k, m, level):
    """One storey of the walls: the back, the right (−x) and the left (+x) round its window, skirting and caps."""
    y0, h = level * F, F
    w = L["windows"][level]
    k.rbox((0, y0 + h / 2, D + T / 2), (2 * W + 2 * T, h, T), 0.01, m["paint"], WALL)
    k.rbox((-W - T / 2, y0 + h / 2, 0), (T, h, 2 * D + 2 * T), 0.01, m["paint"], WALL)
    zw0, zw1 = w["z0"], w["z1"]
    for (z0, z1, a, bb) in ((-D - T, zw0, 0, h), (zw0, zw1, 0, w["y0"]), (zw0, zw1, w["y1"], h), (zw1, D + T, 0, h)):
        k.rbox((W + T / 2, y0 + (a + bb) / 2, (z0 + z1) / 2), (T, bb - a, z1 - z0), 0.01, m["paint"], WALL)
    if level == 0:
        # skirting round the three walls
        k.rbox((0, 0.045, D - 0.012), (2 * W, 0.09, 0.024), 0.006, m["paint"], SKIRT)
        k.rbox((-W + 0.012, 0.045, 0), (0.024, 0.09, 2 * D), 0.006, m["paint"], SKIRT)
        k.rbox((W - 0.012, 0.045, 0), (0.024, 0.09, 2 * D), 0.006, m["paint"], SKIRT)


def window_frame(k, m, w, level):
    """A painted steel frame set back in the wall's thickness (its reveal), with a mullion and a transom, and a concrete
    sill that runs out into the room."""
    y0 = level * F
    x, z0, z1, a, bb = w["x"] + 0.06, w["z0"], w["z1"], w["y0"] + y0, w["y1"] + y0
    fw, depth = 0.07, 0.07
    zc = (z0 + z1) / 2
    yt = a + (bb - a) * 0.72
    for (c, s_) in (((x, a + fw / 2, zc), (depth, fw, z1 - z0)), ((x, bb - fw / 2, zc), (depth, fw, z1 - z0)),
                    ((x, (a + bb) / 2, z0 + fw / 2), (depth, bb - a, fw)), ((x, (a + bb) / 2, z1 - fw / 2), (depth, bb - a, fw))):
        k.rbox(c, s_, 0.012, m["paint"], FRAME)
    k.rbox((x, (a + bb) / 2, zc), (depth * 0.8, bb - a - 2 * fw, 0.04), 0.008, m["paint"], FRAME)      # the mullion
    k.rbox((x, yt, zc), (depth * 0.8, 0.04, z1 - z0 - 2 * fw), 0.008, m["paint"], FRAME)                # the transom
    # the sill: concrete, out past the wall into the room
    k.rbox((w["x"] - 0.06, a - 0.025, zc), (0.3, 0.05, z1 - z0 + 0.16), 0.012, m["stone"], CONCRETE)


def curtain_rod(k, m, w, level, drapes):
    """A slim steel rod over the window, past it on both sides, with round finials; the drapes hang from it."""
    y = level * F + max(b["at"][1] + b["size"][1] for b in drapes) + 0.03
    x = w["x"] - 0.07
    za = min(b["at"][2] - b["size"][2] / 2 for b in drapes) - 0.12
    zb = max(b["at"][2] + b["size"][2] / 2 for b in drapes) + 0.12
    k.tube([(x, y, za), (x, y, zb)], 0.014, m["metal"], STEEL_DARK, n=8)
    for z in (za, zb):
        k.blob((x, y, z), (0.03, 0.03, 0.03), m["metal"], STEEL_DARK, segs=8, rings=5)
    for z in (za + 0.08, zb - 0.08):
        k.tube([(w["x"] - 0.002, y, z), (x, y, z)], 0.01, m["metal"], STEEL_DARK, n=6)            # its brackets


def panes(level, name):
    """The window's glass, its own mesh: the engine draws the outside through it (RoomShell's window view)."""
    k = K.Kit(name)
    w = L["windows"][level]
    y0 = level * F
    mat = K.Mat("M_View", "#ffffff", rough=0.1)
    # a thin slab, so its face toward the room faces the room whichever way the exporter winds a lone quad
    k.rbox((w["x"] + 0.075, y0 + (w["y0"] + w["y1"]) / 2, (w["z0"] + w["z1"]) / 2), (0.01, w["y1"] - w["y0"], w["z1"] - w["z0"]), 0.0, mat, segs=1)
    return k.finish(name=name)


def counter(k, m):
    body, top, till = FX["counter"]["blocks"]
    (x, y0, z), (sx, sy, sz) = body["at"], body["size"]
    k.rbox((x, y0 + 0.05, z), (sx - 0.06, 0.1, sz - 0.08), 0.01, m["stone"], CONCRETE_DARK)          # a recessed plinth
    k.rbox((x, y0 + 0.08 + (sy - 0.08) / 2, z), (sx, sy - 0.08, sz), 0.025, m["tile"], "#ffffff", uv_len=0.48)
    c, s = centre(top)
    k.rbox(c, s, 0.02, m["wood"], OAK_TOP)
    (tx, ty, tz), (tsx, tsy, tsz) = till["at"], till["size"]
    k.rbox((tx, ty + 0.05, tz), (tsx, 0.1, tsz), 0.02, m["paint"], STEEL_DARK)
    scr = k.rbox((tx, ty + 0.16, tz + 0.05), (tsx * 0.85, 0.14, 0.03), 0.01, m["paint"], "#2a2e33")
    k.rbox((tx, ty + 0.165, tz + 0.034), (tsx * 0.7, 0.1, 0.005), 0.002, m["glass"], "#bcd6d0")


def crate(k, m, b):
    (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
    k.rbox((x, y0 + sy / 2, z), (sx, sy * 0.96, sz), 0.025, m["paint"], CRATE)
    # a row of slots on the front and the sides, a shade darker
    for i in range(5):
        u = -sx / 2 + sx * (i + 0.5) / 5
        k.rbox((x + u, y0 + sy * 0.55, z - sz / 2 - 0.002), (sx / 5 * 0.55, sy * 0.45, 0.006), 0.002, m["paint"], CRATE_SLOT)
    for sgn in (-1, 1):
        for i in range(4):
            w = -sz / 2 + sz * (i + 0.5) / 4
            k.rbox((x + sgn * (sx / 2 + 0.002), y0 + sy * 0.55, z + w), (0.006, sy * 0.45, sz / 4 * 0.55), 0.002, m["paint"], CRATE_SLOT)


def plant(k, m):
    pot, leaves = FX["plant"]["blocks"]
    (x, y0, z), (sx, sy, sz) = pot["at"], pot["size"]
    r = sx / 2
    k.lathe((x, y0, z), [(0, 0), (r * 0.8, 0), (r, sy * 0.95), (r * 1.04, sy), (r * 0.9, sy), (0, sy * 0.97)], m["stone"], CONCRETE, n=18)
    k.lathe((x, y0 + sy * 0.97, z), [(r * 0.88, 0), (0, 0.005)], m["paint"], SOIL, n=18)
    rng = np.random.default_rng(7)
    (lx, ly0, lz), (lsx, lsy, lsz) = leaves["at"], leaves["size"]
    k.tube([(x, ly0 - 0.05, z), (x + 0.02, ly0 + lsy * 0.55, z - 0.01)], 0.025, m["wood"], "#6d5440", n=6)
    for i in range(16):
        a = i * 2.4
        h = ly0 + lsy * (0.25 + 0.7 * (i / 15))
        rad = lsx * (0.42 - 0.18 * (i / 15))
        px, pz = x + math.cos(a) * rad * rng.uniform(0.6, 1.0), z + math.sin(a) * rad * rng.uniform(0.6, 1.0)
        rot = K.game_rot(yaw=-a, pitch=rng.uniform(0.3, 0.7))
        k.blob((px, h, pz), (0.13, 0.025, 0.09), m["paint"], LEAF if i % 3 else LEAF_LIGHT, segs=10, rings=5, rot=rot)


def table(k, m, fid):
    for b in FX[fid]["blocks"]:
        block(k, b, m["stone"], CONCRETE, r=0.03)


def shelving(k, m):
    for b in FX["shelving"]["blocks"]:
        c, s = centre(b)
        k.rbox(c, s, 0.012, m["metal"], STEEL)


def rail(k, m):
    base, up0, up1, bar = FX["rail"]["blocks"]
    block(k, base, m["stone"], CONCRETE, r=0.025)
    for u in (up0, up1):
        (x, y0, z), (_, sy, _) = u["at"], u["size"]
        k.tube([(x, y0, z), (x, y0 + sy, z)], 0.022, m["metal"], STEEL, n=10)
    (x, y0, z), (sx, sy, _) = bar["at"], bar["size"]
    k.tube([(x - sx / 2, y0 + sy / 2, z), (x + sx / 2, y0 + sy / 2, z)], 0.02, m["metal"], STEEL, n=10, caps=True)
    # a hanger at each garment's place
    for s in L["slots"]:
        if s["fixture"] == "rail":
            hx, hz = s["at"][0], s["at"][2]
            top = y0 + sy / 2
            k.tube([(hx, top + 0.035, hz - 0.02), (hx, top + 0.06, hz), (hx, top - 0.04, hz)], 0.006, m["metal"], STEEL, n=5)
            k.tube([(hx - 0.17, top - 0.12, hz), (hx, top - 0.04, hz), (hx + 0.17, top - 0.12, hz)], 0.008, m["wood"], OAK_TOP, n=6)


def booths(k, m):
    bs = L["booths"]
    bw = (bs["x1"] - bs["x0"]) / bs["count"]
    for b in FX["changing-rooms"]["blocks"]:
        c, s = centre(b)
        (x, y0, z), size = b["at"], b["size"]
        if b["finish"] == "timber":
            k.rbox(c, s, 0.015, m["wood"], BOOTH_OAK)
        elif b["finish"] == "metal":
            k.tube([(x - size[0] / 2, y0 + size[1] / 2, z), (x + size[0] / 2, y0 + size[1] / 2, z)], 0.015, m["metal"], STEEL, n=8)
        elif b["finish"] == "glass":
            k.rbox((x, y0 + size[1] / 2, z + 0.01), (size[0] + 0.06, size[1] + 0.06, 0.02), 0.01, m["wood"], BOOTH_OAK)  # its frame
            k.rbox(c, s, 0.005, m["glass"], "#dfe9ec")
        elif b["finish"] == "fabric":
            curtain(k, z, x - size[0] / 2, x + size[0] / 2, y0, y0 + size[1], m["cloth"], LINEN, folds=4, depth=0.035, axis="x")
        else:
            block(k, b, m["wood"], OAK_TOP, r=0.03)


def sign(k, m):
    b = FX["upstairs-sign"]["blocks"][0]
    (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
    k.rbox((x, y0 + 0.04, z), (sx + 0.06, 0.08, sz + 0.06), 0.02, m["stone"], CONCRETE_DARK)
    k.rbox((x, y0 + sy / 2 + 0.04, z), (sx, sy - 0.08, sz * 0.6), 0.03, m["paint"], STEEL_DARK)
    # the face toward the door: a light panel with an up arrow in sage
    fz = z - sz * 0.3 - 0.004
    k.rbox((x, y0 + sy * 0.7, fz), (sx * 0.8, sy * 0.42, 0.01), 0.01, m["paint"], WALL)
    arrow = [(0.0, 0.16), (-0.12, 0.02), (-0.045, 0.02), (-0.045, -0.15), (0.045, -0.15), (0.045, 0.02), (0.12, 0.02)]
    k.extrude(arrow, 0.0, 0.012, m["paint"], SAGE, rot=K.game_rot(yaw=math.pi), at=(x, y0 + sy * 0.7, fz - 0.006))


def stair(k, m):
    steps = [b for b in FX["stair"]["blocks"] if b["finish"] == "concrete"]
    for b in steps:
        block(k, b, m["stone"], CONCRETE, r=0.018)
    rise, run = F / S["steps"], (S["z1"] - S["z0"]) / S["steps"]
    hx = S["x1"] - 0.04
    for b in FX["stair"]["blocks"]:
        if b["finish"] == "metal":
            (x, y0, z), (_, sy, _) = b["at"], b["size"]
            k.tube([(x, y0, z), (x, y0 + sy, z)], 0.02, m["metal"], STEEL_DARK, n=8)
    k.tube([(hx, rise + 0.95, S["z0"] + 0.15), (hx, F + 0.95, S["z1"] - 0.15)], 0.024, m["metal"], STEEL_DARK, n=10, caps=True)


def pendant(k, m):
    p = L["pendant"]
    k.rbox(((p["x0"] + p["x1"]) / 2, p["y"] + 0.025, p["z"]), (p["x1"] - p["x0"], 0.05, 0.09), 0.02, m["paint"], STEEL_DARK)
    k.rbox(((p["x0"] + p["x1"]) / 2, p["y"] - 0.002, p["z"]), (p["x1"] - p["x0"] - 0.08, 0.01, 0.05), 0.003, m["glow"], "#ffffff", segs=1)
    for wx in p["wires"]:
        k.tube([(wx, p["y"] + 0.05, p["z"]), (wx, F - SLAB, p["z"])], 0.005, m["metal"], STEEL_DARK, n=4)


# ================================================================ the mezzanine's shell
def mezz(m):
    k = K.Kit("shop_mezz")
    top, under = F, F - SLAB
    # the slab: its top over the back of the room, open over the stair
    for (x0, x1, z0, z1) in ((S["x1"], W, M["z0"], D), (-W, S["x1"], S["z1"], D)):
        k.rbox(((x0 + x1) / 2, under + SLAB / 2, (z0 + z1) / 2), (x1 - x0, SLAB, z1 - z0), 0.015, m["stone"], CONCRETE)
    # a clean painted fascia along its front edge, facing the door
    k.rbox(((S["x1"] + W) / 2, under + SLAB / 2, M["z0"] - 0.012), (W - S["x1"], SLAB + 0.02, 0.025), 0.008, m["paint"], WALL)
    walls(k, m, 1)
    window_frame(k, m, L["windows"][1], 1)
    for f in ("stairwell-rail", "mezz-rail"):
        for b in FX[f]["blocks"]:
            (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
            y = top + y0
            k.rbox((x, y + sy / 2, z), (sx, sy, sz), 0.006, m["glass"], "#d6e6ea")
            along_x = sx > sz
            length = sx if along_x else sz
            a = (x - sx / 2, y + sy, z) if along_x else (x, y + sy, z - sz / 2)
            bb = (x + sx / 2, y + sy, z) if along_x else (x, y + sy, z + sz / 2)
            k.tube([a, bb], 0.022, m["metal"], STEEL_DARK, n=8, caps=True)
            n = max(2, int(length / 1.4) + 1)
            for i in range(n):
                t = i / (n - 1)
                px = a[0] + (bb[0] - a[0]) * t
                pz = a[2] + (bb[2] - a[2]) * t
                k.tube([(px, y, pz), (px, y + sy, pz)], 0.016, m["metal"], STEEL_DARK, n=6)
    # the "club merch" sign hung under the edge, facing the door: a dark panel; its letters are their own mesh
    b = FX["edge-sign"]["blocks"][0]
    (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
    k.rbox((x, top + y0 + sy / 2, z), (sx, sy, sz), 0.02, m["paint"], STEEL_DARK)
    return k.finish(name="shop_mezz")


def letters(text, at, height, name, color="#f4f1ea", depth=0.012):
    """Raised letters from Blender's own font, facing the door (−z): their own mesh in P_Paint."""
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = text
    t.data.align_x, t.data.align_y = "CENTER", "CENTER"
    t.data.extrude = depth / 2
    t.data.size = height
    t.data.space_character = 1.15
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    ob.name = name
    # Text lies in Blender's x-y plane facing +z: stand it up facing game −z (Blender +y), reading left to right from the door.
    ob.rotation_euler = (math.pi / 2, 0, math.pi)
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


def main():
    K.reset()
    m = mats()
    g = ground(m)
    gw = panes(0, "shop_windows")
    K.export([g, gw], f"{OUT}/ground.glb")
    K.clear()
    m = mats()
    z = mezz(m)
    zw = panes(1, "shop_windows_upper")
    b = FX["edge-sign"]["blocks"][0]
    (x, y0, zz), (sx, sy, sz) = b["at"], b["size"]
    txt = letters("CLUB MERCH", (x, F + y0 + sy / 2, zz - sz / 2 - 0.004), sy * 0.52, "shop_mezz_letters")
    K.export([z, zw, txt], f"{OUT}/mezz.glb")


main()
