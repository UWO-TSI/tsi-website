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
import json, math, os, subprocess, sys, tempfile
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
SLOTS = {sl["id"]: sl for sl in L["slots"]}
MARK_SVG = os.path.join(K.ROOT, "web", "public", "assets", "branding", "tethos-mark.svg")
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


def pegboard_tex(size=256, holes=8, seed=31):
    """Grey perforated hardboard (ref 1): a hole every 1/8 of the repeat, each a soft dark well with a lit lower lip,
    over a faint fibre mottle."""
    rng = np.random.default_rng(seed)
    u, v = K.grid(size, size)
    fu, fv = (u * holes) % 1.0 - 0.5, (v * holes) % 1.0 - 0.5
    r = np.sqrt(fu ** 2 + fv ** 2)
    base = K.arr("#c4c6c7") * (1 + (K.fbm(size, size, 24, seed, octaves=3) - 0.5)[..., None] * 0.05)
    hole = 1 - K.smooth(0.13, 0.17, r)
    lip = np.clip((fv - 0.0) * 6, 0, 1) * K.smooth(0.15, 0.2, r) * (1 - K.smooth(0.2, 0.26, r)) * 0.06
    rgb = base * (1 - 0.55 * hole[..., None]) * (1 + lip[..., None])
    return np.clip(rgb, 0, 1)


def concrete_tex(size=256, seed=41):
    """Polished concrete, subtle: soft clouding, a few fine aggregate flecks, a faint trowel sweep."""
    rng = np.random.default_rng(seed)
    base = K.arr("#c9c8c4")
    cloud = (K.fbm(size, size, 6, seed, octaves=4) - 0.5) * 0.07
    u, v = K.grid(size, size)
    sweep = np.sin((u * 3 + K.fbm(size, size, 4, seed + 2) * 1.5) * math.pi * 2) * 0.008
    fleck = (rng.random((size, size)) > 0.993) * rng.uniform(-0.08, 0.06, (size, size))
    return np.clip(base * (1 + cloud + sweep + fleck)[..., None], 0, 1)


def prints_tex(size=512):
    """The posters' atlas: left, the white Tethos mark on navy; right, the navy mark on cream over a sage band."""
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, "mark.png")
        subprocess.run(["/opt/homebrew/bin/rsvg-convert", "-w", "220", "-h", "220", MARK_SVG, "-o", png], check=True)
        img = bpy.data.images.load(png)
        mark = np.array(img.pixels[:], dtype=np.float32).reshape(220, 220, 4)[::-1]
        bpy.data.images.remove(img)
    out = np.zeros((size, size, 3))
    half = size // 2
    out[:, :half] = K.arr("#222a44")
    out[:, half:] = K.arr("#efe9dc")
    out[int(size * 0.72):int(size * 0.82), half:] = K.arr("#8fb39e")
    a = mark[..., 3:4]
    y0 = (size - 220) // 2 - 30
    for x0, col in ((half // 2 - 110, K.arr("#f4f1ea")), (half + half // 2 - 110, K.arr("#222a44"))):
        reg = out[y0:y0 + 220, x0:x0 + 220]
        out[y0:y0 + 220, x0:x0 + 220] = reg * (1 - a) + col * a
    return np.clip(out, 0, 1)


def mezz_mats(m):
    m["peg"] = K.Mat("M_Peg", "#ffffff", rough=0.9, tex=K.image("shop_pegboard", pegboard_tex()))
    m["concrete"] = K.Mat("M_Concrete", "#ffffff", rough=0.6, tex=K.image("shop_concrete", concrete_tex()))
    m["prints"] = K.Mat("M_Prints", "#ffffff", rough=0.85, tex=K.image("shop_prints", prints_tex()))
    return m


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
    furnish(k, m)
    return k.finish(name="shop_mezz")


# ================================================================ the merch level (ref 1), its fittings and the merch's stand-ins
def up(b):
    """A layout block upstairs: its centre (game, the mezzanine's floor added) and size."""
    (x, y0, z), (sx, sy, sz) = b["at"], b["size"]
    return (x, F + y0 + sy / 2, z), (sx, sy, sz)


TEES = ["#222a44", "#f2efe8", "#8fb39e", "#3b4046", "#e8dcc4"]


def furnish(k, m):
    # The floor: polished concrete, its texture only where it's seen (the mezzanine's top).
    for (x0, x1, z0, z1) in ((S["x1"], W, M["z0"], D), (-W, S["x1"], S["z1"], D)):
        corners = [(x0, F + 0.002, z0), (x1, F + 0.002, z0), (x1, F + 0.002, z1), (x0, F + 0.002, z1)]
        k.face([k.vert(p) for p in corners], [(x / 2.0, z / 2.0) for x, _, z in corners], m["concrete"], "#ffffff")
    # The pegboard: perforated grey board round the back corner, edged in steel.
    for b in FX["pegboard"]["blocks"]:
        c, sz = up(b)
        k.rbox(c, sz, 0.008, m["peg"], "#ffffff", uv_len=0.5)
        along_x = sz[0] > sz[2]
        L_ = sz[0] if along_x else sz[2]
        for dy in (-sz[1] / 2, sz[1] / 2):
            k.rbox((c[0], c[1] + dy, c[2]), (L_ + 0.04, 0.035, 0.035) if along_x else (0.035, 0.035, L_ + 0.04), 0.008, m["metal"], STEEL)
    counter_up(k, m)
    # The shelf on the pegboard, on two brackets.
    sh = FX["merch-shelf"]["blocks"][0]
    c, sz = up(sh)
    k.rbox(c, sz, 0.01, m["metal"], STEEL)
    for dx in (-sz[0] / 2 + 0.25, sz[0] / 2 - 0.25):
        k.rbox((c[0] + dx, c[1] - 0.09, c[2] + 0.05), (0.03, 0.16, 0.2), 0.006, m["metal"], STEEL_DARK)
    # The wall sign: a dark panel (its letters joined in main)
    sg = FX["merch-sign"]["blocks"][0]
    c, sz = up(sg)
    k.rbox(c, sz, 0.02, m["paint"], STEEL_DARK)
    # The featured drop's plinths.
    for b in FX["merch-plinths"]["blocks"]:
        c, sz = up(b)
        k.rbox(c, sz, 0.035, m["stone"], CONCRETE)
    # Edge light.
    for st in L["strips"]:
        if st["level"] == 1:
            strip(k, {**st, "from": [st["from"][0], st["from"][1] + F, st["from"][2]], "to": [st["to"][0], st["to"][1] + F, st["to"][2]]}, m)
    # The merch's stand-ins (David's merch list and photos to come): tees and hoodies hung on the board, folded stacks on
    # the counter, two framed prints; trays under the sticker packs; a peg for each hung thing.
    wear = sorted([sl for sl in L["slots"] if sl["kind"] == "merch-wear"], key=lambda sl: sl["id"])
    for i, sl in enumerate(wear):
        (x, y0, z), (sx, sy, sz) = sl["at"], sl["size"]
        if sl["fixture"] == "merch-counter":
            folded(k, m, (x, F + y0, z), (sx, sy, sz), TEES[i % len(TEES)], TEES[(i + 2) % len(TEES)])
            continue
        side = x > 5
        garment(k, m, (x, F + y0 + sy, z), sx if not side else sz, sy, TEES[i % len(TEES)], hood=i % 2 == 1, side=side)
    for i, sl in enumerate(sorted([sl for sl in L["slots"] if sl["kind"] == "merch-prints"], key=lambda sl: sl["id"])):
        poster(k, m, sl, i)
    for sl in L["slots"]:
        if sl["kind"] == "merch-small" and sl["fixture"] == "merch-counter":
            (x, y0, z), (sx, sy, sz) = sl["at"], sl["size"]
            k.rbox((x, F + 0.85 + 0.015, z), (sx + 0.08, 0.03, sz + 0.06), 0.01, m["paint"], CRATE)                 # the tray's floor
            for dx, dz, w_, d_ in ((0, -(sz + 0.06) / 2, sx + 0.08, 0.02), (0, (sz + 0.06) / 2, sx + 0.08, 0.02), (-(sx + 0.08) / 2, 0, 0.02, sz + 0.06), ((sx + 0.08) / 2, 0, 0.02, sz + 0.06)):
                k.rbox((x + dx, F + 0.85 + 0.04, z + dz), (w_, 0.08, d_), 0.006, m["paint"], CRATE)                # its rim
        if sl["kind"] == "merch-bags":
            (x, y0, z), (sx, sy, sz) = sl["at"], sl["size"]
            peg(k, m, (x, F + y0 + sy + 0.02, 4.94))


def peg(k, m, at, side=False):
    x, y, z = at
    if side:
        k.tube([(5.94, y, z), (5.8, y + 0.02, z)], 0.012, m["metal"], STEEL_DARK, n=6, caps=True)
    else:
        k.tube([(x, y, z), (x, y + 0.02, z - 0.14)], 0.012, m["metal"], STEEL_DARK, n=6, caps=True)


def counter_up(k, m):
    """The long metal counter (ref 1): a steel carcass on a dark recessed kick, a slightly darker top, and two rows of
    drawers on its room side, each a proud panel with a bar handle."""
    for b in FX["merch-counter"]["blocks"]:
        c, sz = up(b)
        along_x = sz[0] > sz[2]
        k.rbox((c[0], F + 0.05, c[2]), (sz[0] - 0.06, 0.1, sz[2] - 0.06), 0.01, m["paint"], STEEL_DARK)
        # painted steel (a soft gloss, grey), the top a brushed steel slab
        k.rbox((c[0], F + 0.1 + (sz[1] - 0.14) / 2, c[2]), (sz[0], sz[1] - 0.14, sz[2]), 0.015, m["paint"], "#9aa0a5")
        k.rbox((c[0], F + sz[1] - 0.02, c[2]), (sz[0] + 0.03, 0.04, sz[2] + 0.03), 0.012, m["metal"], "#8d9499")
        L_ = sz[0] if along_x else sz[2]
        n = max(1, round(L_ / 0.72))
        w = L_ / n
        for i in range(n):
            u = -L_ / 2 + w * (i + 0.5)
            for yy in (F + 0.27, F + 0.58):
                if along_x:
                    face = c[2] - sz[2] / 2 - 0.006
                    k.rbox((c[0] + u, yy, face), (w - 0.04, 0.27, 0.012), 0.006, m["paint"], "#a9afb4")
                    k.tube([(c[0] + u - 0.1, yy + 0.06, face - 0.02), (c[0] + u + 0.1, yy + 0.06, face - 0.02)], 0.009, m["metal"], STEEL_DARK, n=6, caps=True)
                else:
                    face = c[0] - sz[0] / 2 - 0.006
                    k.rbox((face, yy, c[2] + u), (0.012, 0.27, w - 0.04), 0.006, m["paint"], "#a9afb4")
                    k.tube([(face - 0.02, yy + 0.06, c[2] + u - 0.1), (face - 0.02, yy + 0.06, c[2] + u + 0.1)], 0.009, m["metal"], STEEL_DARK, n=6, caps=True)


def tee_outline(w, h, hood=False):
    """A tee (or a hoodie's body and sleeves) laid flat: game (x, y) round from the collar, counter-clockwise, top at 0."""
    k = w / 0.7
    pts = [(0.0, -0.06), (-0.09, 0.0), (-0.2, -0.02), (-0.35, -0.12), (-0.29, -0.26), (-0.2, -0.2), (-0.21, -0.78),
           (0.21, -0.78), (0.2, -0.2), (0.29, -0.26), (0.35, -0.12), (0.2, -0.02), (0.09, 0.0)]
    if hood:
        pts = [(0.0, -0.1), (-0.11, 0.0), (-0.2, -0.03), (-0.35, -0.16), (-0.31, -0.36), (-0.2, -0.24), (-0.22, -0.8),
               (0.22, -0.8), (0.2, -0.24), (0.31, -0.36), (0.35, -0.16), (0.2, -0.03), (0.11, 0.0)]
    return [(x * k, y * (h / 0.8)) for x, y in pts[::-1]]


def garment(k, m, top, w, h, col, hood=False, side=False):
    """A tee or hoodie hung flat on the pegboard from a peg (its collar at `top`), facing the room."""
    x, y, z = top
    out = tee_outline(w, h - 0.08, hood)
    if side:
        k.extrude(out, -0.02, 0.02, m["cloth"], col, bevel=0.012, rot=K.game_rot(yaw=-math.pi / 2), at=(5.86, y - 0.08, z))
        peg(k, m, (x, y, z), side=True)
        if hood:
            k.blob((5.84, y - 0.09, z), (0.03, 0.06, 0.13), m["cloth"], col, segs=10, rings=6)
    else:
        k.extrude(out, -0.02, 0.02, m["cloth"], col, bevel=0.012, at=(x, y - 0.08, 4.86))
        peg(k, m, (x, y, 4.94))
        if hood:
            k.blob((x, y - 0.09, 4.84), (0.13, 0.06, 0.03), m["cloth"], col, segs=10, rings=6)
            k.rbox((x, y - 0.6, 4.835), (0.28, 0.12, 0.012), 0.005, m["cloth"], col)       # the pocket


def folded(k, m, base, size, a, b):
    """A stack of three folded tees on the counter."""
    x, y, z = base
    sx, sy, sz = size
    for i, col in enumerate((a, b, a)):
        k.rbox((x + (i % 2) * 0.01, y + 0.03 + i * 0.062, z), (sx, 0.055, sz * 0.9), 0.022, m["cloth"], col)


def poster(k, m, sl, i):
    """A framed print on the pegboard (the Tethos mark, in the club's colours)."""
    (x, y0, z), (sx, sy, sz) = sl["at"], sl["size"]
    y = F + y0 + sy / 2
    k.rbox((x, y, 4.925), (sx, sy, 0.03), 0.008, m["metal"], STEEL_DARK)
    u0, u1 = (0.0, 0.5) if i == 0 else (0.5, 1.0)
    px, py = sx / 2 - 0.035, sy / 2 - 0.035
    zf = 4.905
    k.face([k.vert(p) for p in ((x + px, y - py, zf), (x - px, y - py, zf), (x - px, y + py, zf), (x + px, y + py, zf))],
           [(u0, 0.05), (u1, 0.05), (u1, 0.95), (u0, 0.95)], m["prints"], "#ffffff")


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
    m = mezz_mats(mats())
    z = mezz(m)
    zw = panes(1, "shop_windows_upper")
    texts = []
    for sign in ("edge-sign", "merch-sign"):
        b = FX[sign]["blocks"][0]
        (x, y0, zz), (sx, sy, sz) = b["at"], b["size"]
        texts.append(letters("CLUB MERCH", (x, F + y0 + sy / 2, zz - sz / 2 - 0.004), sy * 0.52, f"shop_letters_{sign}"))
    # One mesh: the letters join the mezzanine (one draw per material).
    bpy.ops.object.select_all(action="DESELECT")
    for o in texts:
        o.select_set(True)
    z.select_set(True)
    bpy.context.view_layer.objects.active = z
    bpy.ops.object.join()
    K.export([z, zw], f"{OUT}/mezz.glb")


main()
