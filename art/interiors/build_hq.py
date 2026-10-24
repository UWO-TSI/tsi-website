"""HQ's room (specs/interiors/hq.md, phase 3: the gallery, two tall storeys; ledger row 316): both floors, the aquarium
and the ceiling, modelled on the numbers the game walks (art/interiors/hq_layout.json, written from
web/lib/game/hqLayout.ts by web/scripts/hq-layout-json.mjs; change the layout there, never here).

The look, from David's four references (references/interiors/hq/): walnut, concrete and plaster, leather and velvet,
deep carpets and plants, lit by lamps, strips and track spots rather than ceiling panels. Simple and a little cartoony,
with rounded edges (the shop's build, build_shop.py, is the template). Textures only where they're seen up close (the
lane rules): the walnut floor planks (512), and the walnut grain, the plaster, the rug pile, the green marble and the
magazine covers (256 each), all subtle. Everything else is plain colour on the shared presets (P_Stone, P_Metal,
P_Paint, P_Glass, P_Cloth: web/lib/game/modelMaterials.ts MATERIAL_PRESETS), its colour in COLOR_0. The strips, the
lamp shades' undersides and the oval lights are M_Glow. No downloads, no references beyond David's.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/build_hq.py

Writes web/public/assets/game/interiors/hq/:
- ground.glb: hq_ground (the floor; the side and back walls both storeys high with their windows; the entry under the
  bridge; the hall's lounge; the floor under each arm; the stair; the aquarium's walnut surround), hq_windows (the panes
  the engine fills with the outside) and hq_caster (shadow only: the ceiling and the cut-away front wall, so daylight
  comes in by the windows);
- upper.glb: the upper floor's three parts, hq_upper_0 (the bridge and its lounge), hq_upper_1 (the left arm, its
  banners and the admin doors) and hq_upper_2 (the right arm, its banners, the stair's well): each its slab, fascia and
  rails, its fixtures and the tracks under it. The game cuts a part away while you're under it or it's in the way;
- ceiling.glb: hq_ceiling (the plain dark ceiling, the walnut oval ceiling over the bridge's lounge, the tracks up
  there, and the whole front wall, both storeys, with its door, windows, panelling and the lit art). The game shows it
  only to a camera inside the room: the walking camera looks in from the door's side or from above;
- tank.glb: the aquarium's inside (hq_tank_inner), its reef (hq_tank_reef), its glass (hq_tank_glass) and its water's
  surface (hq_tank_surface). The engine gives them the tank's own shaders (components/game/hq/Aquarium.tsx).
Game coordinates throughout (propkit.G): x across (+x on screen left), y up, z into the room. A piece standing on a side
or the front wall is made facing -z about its first block and turned onto its wall (turned), its sizes from the layout.
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
UNDER = F - SLAB                 # the upper floor's underside
RAIL = L["rail"]
S, A, UPPER = L["stair"], L["aquarium"], L["upper"]
WELL = (S["x0"], S["x1"], min(S["foot"], S["head"]), max(S["foot"], S["head"]))
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
VELVET, VELVET_DEEP, VELVET_OLIVE = "#5e4232", "#4a3426", "#5f6040"
CREAM, PAPER, WHITE = "#efe7d8", "#f4eee2", "#f3f1ec"
RUG_BLUE, MAT = "#24427c", "#3c352e"
CHROME, STEEL_DARK, BRONZE = "#a3a8ae", "#2f3235", "#2d2925"
STONE, STONE_DARK, POT = "#dccfb9", "#b9ab95", "#5d5853"
BRASS = "#bf9a5a"
LEAF, LEAF_LIGHT, LEAF_DEEP, STEM, SOIL = "#4f7a45", "#6f9a5b", "#3b5e36", "#6b5a45", "#4a3a2e"
CORK = "#b98d5c"
SLATE = "#2b3034"
SPINES = ["#7d2e2a", "#2f4a6b", "#d9cba9", "#3d5e47", "#b5863f", "#1f2326", "#8e6d5a", "#c45c3a", "#e9e4d8", "#566270",
          "#6b3d55", "#a8a093"]


# ================================================================ textures (numpy, sRGB, subtle, tileable)
def planks(size=512, seed=3, height=False):
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
    if height:                                  # the seams sunk, the grain's ridges faint (the normal map's)
        return -seam + grain * 3.0
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


def normal_map(h, strength=1.0):
    """A tangent-space normal map (glTF: +y up the texture) from a tileable height field whose rows run down the image
    (propkit.image flips them), for the light to catch close up: the floor's seams, the walnut's grain, the plaster's
    trowel, the rugs' pile."""
    du = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dv = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * strength
    n = np.stack([-du, -dv, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True) * 0.5 + 0.5


def lum(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


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


def tex(name, make, normal=False):
    """A texture's image, made once a GLB (propkit.clear drops it with the GLB's materials); a normal map is data."""
    img = bpy.data.images.get(name)
    if img is None:
        img = K.image(name, make())
        if normal:
            img.colorspace_settings.name = "Non-Color"
    return img


def dress(mat, normal=None, strength=1.0, coat=0.0, coat_rough=0.1, sheen=0.0, sheen_tint="#ffffff", sheen_rough=0.5, alpha=None):
    """How a material meets the light (David, 2026-10-22: "make the textures of things more accurate like how they
    interact with the light"): a normal map for close-up relief, a clear coat (polished stone), a sheen at grazing angles
    (velvet), see-through (glass). The exporter writes them as glTF's normalTexture, KHR_materials_clearcoat and
    KHR_materials_sheen, and alphaMode BLEND."""
    nt = mat.m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    if normal is not None:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = normal
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = strength
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = coat_rough
    if sheen:
        b.inputs["Sheen Weight"].default_value = sheen
        b.inputs["Sheen Tint"].default_value = (*K.lin(sheen_tint), 1)
        b.inputs["Sheen Roughness"].default_value = sheen_rough
    if alpha is not None:
        b.inputs["Alpha"].default_value = alpha
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try:
                setattr(mat.m, attr, val)
            except (AttributeError, TypeError):
                pass
    return mat


def mats():
    """The shared presets (their roughness and metalness are the engine's, MATERIAL_PRESETS) and the textured ones.
    Satin walnut and floor, polished marble, rough plaster and pile; leather a gentle highlight, velvet a sheen, glass
    clear, metal metallic (its colours dark enough that the look's metal class keeps them metal)."""
    return {
        "stone": K.Mat("P_Stone", "#ffffff", rough=0.95),
        "metal": K.Mat("P_Metal", "#ffffff", rough=0.4),
        "paint": K.Mat("P_Paint", "#ffffff", rough=0.45),
        "glass": dress(K.Mat("P_Glass", "#ffffff", rough=0.08), alpha=0.14),
        "cloth": K.Mat("P_Cloth", "#ffffff", rough=1.0),
        "leather": K.Mat("P_Leather", "#ffffff", rough=0.36),
        "velvet": dress(K.Mat("P_Velvet", "#ffffff", rough=0.85), sheen=1.0, sheen_tint="#e6cfb2", sheen_rough=0.3),
        "floor": dress(K.Mat("M_Floor", "#ffffff", rough=0.55, tex=tex("hq_floor", planks)),
                       normal=tex("hq_floor_n", lambda: normal_map(planks(height=True), 6.0), True), strength=0.8),
        "walnut": dress(K.Mat("M_Walnut", "#ffffff", rough=0.48, tex=tex("hq_walnut", lambda: K.grain(256, 256, 51, contrast=0.11, knots=1, wander=0.005))),
                        normal=tex("hq_walnut_n", lambda: normal_map(lum(K.grain(256, 256, 51, contrast=0.11, knots=1, wander=0.005)), 5.0), True), strength=0.6),
        "plaster": dress(K.Mat("M_Plaster", "#ffffff", rough=0.95, tex=tex("hq_plaster", plaster)),
                         normal=tex("hq_plaster_n", lambda: normal_map(lum(plaster()), 9.0), True), strength=0.7),
        "rug": dress(K.Mat("M_Rug", "#ffffff", rough=1.0, tex=tex("hq_rug", pile)),
                     normal=tex("hq_rug_n", lambda: normal_map(lum(pile()), 6.0), True), strength=1.0),
        "marble": dress(K.Mat("M_Marble", "#ffffff", rough=0.14, tex=tex("hq_marble", marble)), coat=1.0, coat_rough=0.04),
        "covers": K.Mat("M_Covers", "#ffffff", rough=0.7, tex=tex("hq_covers", covers)),
        "glow": glow_mat(),
        "screen": glow_mat("M_Screen", "#a9c8e6", 0.6),
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


def floor_quad(k, mat, y, x0, x1, z0, z1, col="#ffffff", su=1.2, sv=4.8, cell=2.0):
    """A floor in cells about `cell` square: the curved world bends a model by its vertices, so one big quad would fold
    along its diagonal away from what stands on it (and sink under the slab beneath it upstairs)."""
    nx, nz = max(1, math.ceil((x1 - x0) / cell)), max(1, math.ceil((z1 - z0) / cell))
    xs, zs = np.linspace(x0, x1, nx + 1), np.linspace(z0, z1, nz + 1)
    for i in range(nx):
        for j in range(nz):
            corners = [(xs[i], y, zs[j]), (xs[i + 1], y, zs[j]), (xs[i + 1], y, zs[j + 1]), (xs[i], y, zs[j + 1])]
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


def wall_x(w):
    return -W if w["wall"] == "right" else W


def mullions(span, widest=1.5):
    """Where the upright mullions fall across a pane `span` wide, so no light is wider than `widest`."""
    n = max(1, math.ceil(span / widest - 1e-6))
    return [span * i / n for i in range(1, n)]


def pane_frame(k, m, at, u0, u1, y0, y1, along_x):
    """A big modern pane's frame (David, 2026-10-22: "big clear windows like in modern appartments and not the curtain
    with the + kinda window"): thin black sections set in the wall's reveal at `at` (x for a side wall, z for the front),
    from u0 to u1 along the wall, upright mullions only, no transoms, no curtains."""
    def box(u, y, du, dy, dd):
        k.rbox((u, y, at) if along_x else (at, y, u), (du, dy, dd) if along_x else (dd, dy, du), 0.004, m["paint"], BLACK, segs=1)
    fw, uc, yc = 0.05, (u0 + u1) / 2, (y0 + y1) / 2
    box(uc, y0 + fw / 2, u1 - u0, fw, 0.09)
    box(uc, y1 - fw / 2, u1 - u0, fw, 0.09)
    box(u0 + fw / 2, yc, fw, y1 - y0, 0.09)
    box(u1 - fw / 2, yc, fw, y1 - y0, 0.09)
    for du in mullions(u1 - u0):
        box(u0 + du, yc, 0.04, y1 - y0 - 2 * fw, 0.07)


def window_frame(k, m, w):
    """A side wall's window: the frame in its reveal, and where it starts above the floor (over the study's shelves) a
    walnut ledge inside."""
    x = wall_x(w)
    out = math.copysign(1, x)
    pane_frame(k, m, x + out * 0.06, w["z0"], w["z1"], w["y0"], w["y1"], False)
    if w["y0"] % F > 0.3:
        k.rbox((x - out * 0.08, w["y0"] - 0.02, (w["z0"] + w["z1"]) / 2), (0.24, 0.04, w["z1"] - w["z0"] + 0.1), 0.01, m["walnut"], WALNUT_DARK, uv_len=1.4)


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
    k.blob((x, top, z), (r, r, r), m["paint"], WHITE, segs=12, rings=6, flat_bottom=0.0)
    k.lathe((x, top - 0.002, z), [(0, -r * 0.7), (r * 0.7, -r * 0.7), (r * 0.97, -r * 0.25), (r, 0)], m["glow"], "#ffffff", n=12)


def sofa(k, m, cx, cz, yaw, w, d, h, mat, col, arms=True, seats=None, base=0.0, pillows=(), seed=0):
    """A plush sofa (ref 2's velvet, ref 1's leather): a recessed black plinth, a deep base, plump seat cushions with
    rounded crowns, thick back cushions leaning back on a solid back, rounded arms, and throw pillows. Its own frame:
    length w across its local x, its front toward local -z; on a floor at `base`. `arms` is (local -x, local +x), off
    where a sectional's pieces meet; `pillows` their colours, along the back."""
    al, ar = ((arms, arms) if isinstance(arms, bool) else arms)
    arm = 0.24
    a0, a1 = (arm if al else 0.0), (arm if ar else 0.0)
    back_d = min(0.34, d * 0.3)
    rb(k, cx, cz, yaw, (0, 0.05, 0), (w - 0.16, 0.1, d - 0.16), 0.02, m["paint"], BLACK, segs=1, base=base)
    rb(k, cx, cz, yaw, (0, 0.21, 0.01), (w - 0.02, 0.24, d - 0.04), 0.08, mat, col, base=base)
    rb(k, cx, cz, yaw, ((a0 - a1) / 2, (h + 0.1) / 2, d / 2 - 0.07), (w - a0 - a1 + 0.02, h - 0.1, 0.14), 0.06, mat, col, base=base)
    inner = w - a0 - a1
    n = seats or max(1, round(inner / 0.95))
    sw = inner / n
    for i in range(n):
        lx = -w / 2 + a0 + sw * (i + 0.5)
        rb(k, cx, cz, yaw, (lx, 0.42, -back_d / 2 + 0.01), (sw - 0.025, 0.2, d - back_d - 0.06), 0.09, mat, col, segs=2, base=base)
        rb(k, cx, cz, yaw, (lx, h - 0.24, d / 2 - back_d / 2 - 0.1), (sw - 0.035, 0.5, back_d), 0.14, mat, col, segs=2, pitch=-0.16, base=base)
    for side, on in ((-1, al), (1, ar)):
        if on:
            rb(k, cx, cz, yaw, (side * (w / 2 - arm / 2), 0.45, 0), (arm, 0.52, d), 0.11, mat, col, segs=2, base=base)
    rng = np.random.default_rng(seed)
    for j, pc in enumerate(pillows):
        t = (j + 0.5) / len(pillows)
        lx = -inner / 2 + inner * t + (a0 - a1) / 2 + float(rng.uniform(-0.15, 0.15))
        x, y, z = turn(cx, cz, yaw, lx, base + 0.72, d / 2 - back_d - 0.08)
        k.blob((x, y, z), (0.23, 0.21, 0.08), m["velvet"], pc, segs=8, rings=5, seed=seed + j,
               rot=K.game_rot(yaw=yaw + float(rng.uniform(-0.25, 0.25)), pitch=-0.3, roll=float(rng.uniform(-0.15, 0.15))))


def armchair(k, m, cx, cz, yaw, s, mat, col, base=0.0):
    sofa(k, m, cx, cz, yaw, s, s, 0.82, mat, col, seats=1, base=base)


def office_chair(k, m, x, z, yaw, seat=0.47, base=0.0):
    """An aluminium group office chair (ref 1): a five-star chrome base on castors, a black leather seat and back on
    chrome side frames."""
    for i in range(5):
        a = i * TAU / 5 + yaw
        k.tube([(x, base + 0.12, z), (x + math.cos(a) * 0.28, base + 0.06, z + math.sin(a) * 0.28)], 0.016, m["metal"], CHROME, n=6, caps=True)
        k.blob((x + math.cos(a) * 0.28, base + 0.035, z + math.sin(a) * 0.28), (0.03, 0.03, 0.03), m["paint"], BLACK, segs=5, rings=3)
    k.tube([(x, base + 0.1, z), (x, base + seat - 0.04, z)], 0.025, m["metal"], CHROME, n=8)
    rb(k, x, z, yaw, (0, seat, 0), (0.48, 0.07, 0.46), 0.03, m["leather"], LEATHER_BLACK, base=base)
    rb(k, x, z, yaw, (0, seat + 0.33, 0.24), (0.46, 0.52, 0.05), 0.025, m["leather"], LEATHER_BLACK, pitch=-0.14, base=base)
    for sx in (-1, 1):
        a = turn(x, z, yaw, sx * 0.25, base + seat - 0.02, 0.0)
        b = turn(x, z, yaw, sx * 0.25, base + seat + 0.6, 0.31)
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
    """A leafy plant in a concrete pot (the shop's, fuller): broad leaves in three greens round a stem."""
    rng = np.random.default_rng(seed)
    ph = min(0.5, h * 0.32)
    k.lathe((x, base, z), [(0, 0), (pot * 0.78, 0), (pot, ph * 0.95), (pot * 1.04, ph), (pot * 0.9, ph), (0, ph * 0.97)], m["stone"], POT, n=14)
    k.lathe((x, base + ph * 0.97, z), [(pot * 0.88, 0), (0, 0.005)], m["paint"], SOIL, n=12)
    k.tube([(x, base + ph, z), (x + 0.02, base + h * 0.7, z - 0.01)], 0.025, m["paint"], STEM, n=6)
    n, segs = (10, 5) if h < 0.8 else (18, 6)
    for i in range(n):
        a = i * 2.4
        t = i / (n - 1)
        yy = base + ph + (h - ph) * (0.15 + 0.8 * t)
        rad = (0.15 + 0.24 * (1 - abs(t - 0.45) * 1.6)) * h / 1.4
        px, pz = x + math.cos(a) * rad * rng.uniform(0.6, 1.0), z + math.sin(a) * rad * rng.uniform(0.6, 1.0)
        k.blob((px, yy, pz), (0.16, 0.024, 0.1), m["paint"], (LEAF, LEAF_LIGHT, LEAF_DEEP)[i % 3], segs=segs, rings=3,
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
    """The plant a block's size asks for: a palm when tall, a snake plant when slim, a leafy bush otherwise."""
    (x, _, z), (sx, sy, _) = b["at"], b["size"]
    if sx <= 0.6:
        snake_plant(k, m, x, z, sy, seed, pot=sx * 0.42, base=base)
    elif sy >= 1.6:
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


# ================================================================ turning a piece onto its wall
YAW = {"-z": 0.0, "+z": math.pi, "+x": -math.pi / 2, "-x": math.pi / 2}


def turned(k, yaw, anchor, fn, *args):
    """Build a piece made facing -z about the origin (fn), then turn it by yaw (game, about y) and set it at anchor
    (game x, z)."""
    before = set(k.bm.verts)
    fn(*args)
    c, s = math.cos(yaw), math.sin(yaw)
    ax, az = anchor
    for v in k.bm.verts:
        if v in before:
            continue
        gx, gz = v.co.x, -v.co.y          # Blender (x, y, z) is game (x, -z, y)
        v.co.x, v.co.y = gx * c + gz * s + ax, -(-gx * s + gz * c + az)


class Local:
    """A fixture in its own frame: made facing -z about its first block (its anchor), for turned()."""

    def __init__(self, fid):
        self.f = FX[fid]
        self.yaw = YAW[self.f.get("facing", "-z")]
        a = self.f["blocks"][0]["at"]
        self.anchor = (a[0], a[2])

    def point(self, p):
        """A game point (x, y, z) in the frame."""
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        dx, dz = p[0] - self.anchor[0], p[2] - self.anchor[1]
        return (dx * c - dz * s, p[1], dx * s + dz * c)

    def blocks(self):
        """Its blocks in the frame: (centre, size), the size along the frame's x, y and z."""
        out = []
        for b in self.f["blocks"]:
            sx, sy, sz = b["size"]
            if abs(math.sin(self.yaw)) > 0.5:
                sx, sz = sz, sx
            out.append((self.point(b["at"]), (sx, sy, sz)))
        return out

    def build(self, k, fn, *args):
        turned(k, self.yaw, self.anchor, fn, *args)


def monitor(k, m, x, y, z, yaw, w=0.62, h=0.42):
    """A monitor on a chrome stand, its screen lit softly (it faces local -z), a keyboard and a sheet of paper before it;
    on a desk top at height y."""
    rb(k, x, z, yaw, (0, 0.005, 0.03), (0.22, 0.01, 0.16), 0.004, m["metal"], CHROME, base=y)
    rb(k, x, z, yaw, (0, 0.12, 0.05), (0.04, 0.22, 0.02), 0.004, m["metal"], CHROME, base=y)
    rb(k, x, z, yaw, (0, 0.16 + h / 2, 0.02), (w, h, 0.025), 0.01, m["paint"], BLACK, base=y)
    rb(k, x, z, yaw, (0, 0.17 + h / 2, 0.006), (w - 0.04, h - 0.06, 0.004), 0.0, m["screen"], "#ffffff", segs=1, base=y)
    rb(k, x, z, yaw, (0, 0.012, -0.36), (0.36, 0.018, 0.12), 0.006, m["paint"], "#d8d8d4", base=y)
    rb(k, x, z, yaw, (0.3, 0.004, -0.25), (0.22, 0.004, 0.3), 0.0, m["paint"], PAPER, segs=1, base=y)


def desk_lamp(k, m, x, base, z, top):
    """A brass task lamp (a banker's green shade) on a desk top at `base`, its shade's mouth at `top`, lit underneath."""
    k.lathe((x, base, z), [(0, 0), (0.08, 0), (0.085, 0.015), (0.07, 0.026), (0, 0.026)], m["metal"], BRASS, n=12)
    k.tube([(x, base + 0.02, z), (x, top + 0.07, z)], 0.008, m["metal"], BRASS, n=6)
    k.lathe((x, top, z), [(0.115, 0), (0.11, 0.015), (0.085, 0.06), (0.035, 0.095), (0, 0.1)], m["paint"], "#2f5a45", n=14)
    k.lathe((x, top + 0.003, z), [(0, 0), (0.108, 0)], m["glow"], "#ffffff", n=14)


def wall_normal(face):
    """The way a wall's face looks into the room (game x, z)."""
    return {"-x": (-1, 0), "+x": (1, 0), "-z": (0, -1), "+z": (0, 1)}[face]


def sconce(k, m, lamp, base):
    """A wall sconce: a black plate, a short brass arm and a white glass cylinder lit from inside, its light washing the
    wall up and down (the wash is the engine's, lib/game/hqLight.ts)."""
    x, y, z = lamp["light"]
    nx, nz = wall_normal(lamp["wall"])
    y += base
    across_x = nz != 0
    k.rbox((x + nx * 0.012, y, z + nz * 0.012), (0.1 if across_x else 0.024, 0.24, 0.024 if across_x else 0.1), 0.008, m["paint"], BLACK, segs=1)
    k.tube([(x + nx * 0.02, y, z + nz * 0.02), (x + nx * 0.13, y, z + nz * 0.13)], 0.011, m["metal"], BRASS, n=6, caps=True)
    cx, cz = x + nx * 0.15, z + nz * 0.15
    k.lathe((cx, y - 0.13, cz), [(0, 0), (0.062, 0), (0.062, 0.26), (0, 0.26)], m["glow"], "#ffffff", n=12)
    for yy in (y - 0.135, y + 0.125):
        k.lathe((cx, yy, cz), [(0, 0), (0.068, 0), (0.068, 0.012), (0, 0.012)], m["metal"], BRASS, n=12)


def beanbag(k, m, b, i, base=0.0):
    """A big slouchy beanbag in velvet, its weight settled to the floor."""
    (x, _, z), (sx, sy, sz) = b["at"], b["size"]
    col = ("#a8643f", "#7a7a4a", "#d9cdb5", "#b08a5e", "#5f6f7a")[i % 5]
    k.blob((x, base + sy * 0.5, z), (sx / 2, sy * 0.56, sz / 2), m["velvet"], col, segs=12, rings=6, seed=i + 3, lumpy=0.1, flat_bottom=-sy * 0.5,
           rot=K.game_rot(yaw=i * 1.3, pitch=0.08))


def snake_plant(k, m, x, z, h, seed, pot=0.2, base=0.0):
    """A snake plant in a tall matt black pot: stiff upright sword leaves, dark green with pale edges."""
    rng = np.random.default_rng(seed)
    ph = min(0.45, h * 0.38)
    k.lathe((x, base, z), [(0, 0), (pot * 0.9, 0), (pot, ph * 0.5), (pot, ph), (pot * 0.92, ph), (0, ph * 0.97)], m["paint"], CHARCOAL, n=14)
    k.lathe((x, base + ph * 0.97, z), [(pot * 0.9, 0), (0, 0.005)], m["paint"], SOIL, n=12)
    for i in range(9):
        a = i * 2.4 + float(rng.uniform(-0.3, 0.3))
        r0 = pot * 0.5 * float(rng.uniform(0.2, 1.0))
        lh = (h - ph) * float(rng.uniform(0.6, 1.0))
        bx, bz = x + math.cos(a) * r0, z + math.sin(a) * r0
        k.blob((bx, base + ph + lh / 2, bz), (0.05, lh / 2, 0.012), m["paint"], ("#2f5a36", "#3b6b3f", "#4c7a45")[i % 3], segs=6, rings=4,
               rot=K.game_rot(yaw=-a, roll=float(rng.uniform(-0.15, 0.15)), pitch=float(rng.uniform(-0.12, 0.12))))


def floor_lamps(k, m, level, part=None):
    """The globe floor lamps standing on a floor (upstairs, on one part)."""
    for f in L["fixtures"]:
        lp = LAMPS.get(f["id"])
        if lp and lp["kind"] == "floor" and f["level"] == level and (part is None or f.get("part", 0) == part):
            x, y, z = lp["light"]
            globe_lamp(k, m, x, level * F, z, level * F + y)


def lamps_of(level, kind, part=None):
    return [lp for lp in L["lamps"] if lp["level"] == level and lp["kind"] == kind and (part is None or lp.get("part", 0) == part)]


def window_nook(k, m):
    """The window nook (more lounging, before the right wall's big pane): a brown leather lounge chair and its ottoman
    turned to the room, a throw over the arm."""
    chair, ottoman = FX["nook"]["blocks"]
    (x, _, z), (sx, sy, sz) = chair["at"], chair["size"]
    sofa(k, m, x, z, yaw_facing("+x"), sx, sz, sy, m["leather"], LEATHER_BROWN, seats=1, pillows=("#d9cdb5",), seed=21)
    (x, _, z), (sx, sy, sz) = ottoman["at"], ottoman["size"]
    k.rbox((x, 0.06, z), (sx - 0.12, 0.12, sz - 0.12), 0.02, m["paint"], BLACK, segs=1)
    k.rbox((x, sy / 2 + 0.06, z), (sx, sy - 0.12, sz), 0.08, m["leather"], LEATHER_BROWN)


def nook(k, m, fid):
    """A reading nook on an arm by the bridge: two velvet lounge chairs turned toward the hall, a small travertine side
    table with a book and a cup."""
    c1, c2, table = FX[fid]["blocks"]
    face = FX[fid].get("facing", "-x")
    y0 = yaw_facing(face)
    for b, dyaw, col in ((c1, 0.08 * math.pi, VELVET_DEEP), (c2, -0.08 * math.pi, VELVET)):
        (x, _, z), (sx, sy, sz) = b["at"], b["size"]
        sofa(k, m, x, z, y0 + (dyaw if face == "-x" else -dyaw), sx, sz, sy, m["velvet"], col, seats=1, base=F)
    (x, _, z), (sx, sy, sz) = table["at"], table["size"]
    k.lathe((x, F, z), [(0, 0), (sx * 0.3, 0), (sx * 0.22, 0.05), (sx * 0.12, 0.08), (sx * 0.12, sy - 0.06), (sx / 2, sy - 0.05), (sx / 2, sy), (0, sy)], m["stone"], STONE, n=14)
    k.rbox((x - 0.05, F + sy + 0.02, z + 0.05), (0.28, 0.04, 0.2), 0.004, m["paint"], "#b5863f", rot=K.game_rot(yaw=0.3))
    k.lathe((x + 0.12, F + sy, z - 0.1), [(0, 0), (0.04, 0), (0.045, 0.07), (0.04, 0.07), (0.036, 0.008), (0, 0.008)], m["paint"], WHITE, n=12)


def study(k, m):
    """The study down the left arm (David, 2026-10-22: "add like long table with monitor and chairs and stuff"): the
    long walnut table on black steel legs with a cable spine, three monitors a side back to back, six black leather
    office chairs pulled up, two brass task lamps between the screens."""
    f = FX["study-table"]
    (x, _, z), (sx, sy, sz) = f["blocks"][0]["at"], f["blocks"][0]["size"]
    k.rbox((x, F + sy - 0.025, z), (sx, 0.05, sz), 0.015, m["walnut"], WALNUT, uv_len=1.4)
    for lz in (-sz / 2 + 0.3, 0.0, sz / 2 - 0.3):
        k.rbox((x, F + (sy - 0.05) / 2, z + lz), (sx - 0.14, sy - 0.05, 0.05), 0.01, m["paint"], STEEL_DARK)
        k.rbox((x, F + 0.02, z + lz), (sx - 0.06, 0.04, 0.07), 0.01, m["paint"], STEEL_DARK)
    k.rbox((x, F + sy + 0.03, z), (0.1, 0.06, sz - 0.5), 0.012, m["paint"], CHARCOAL)
    for b in f["blocks"][1:]:
        (bx, by, bz) = b["at"]
        side = 1 if bx > x else -1
        if b["finish"] == "screen":
            monitor(k, m, bx + side * 0.02, F + by, bz, yaw_facing("+x" if side > 0 else "-x"))
        else:
            office_chair(k, m, bx, bz, yaw_facing("-x" if side > 0 else "+x") + 0.08 * math.sin(bz * 3), base=F)
    for lp in lamps_of(1, "desk", 1):
        lx, ly, lz = lp["light"]
        desk_lamp(k, m, lx, F + lp["on"], lz, F + ly)


def study_shelves(k, m):
    """Low walnut shelves along the left wall under the study's window: two open shelves of books, a warm strip under
    the top, plants, a vase and a stack of books on it. Made facing -z and turned."""
    lo = Local("study-shelves")

    def make():
        (x, _, z), (sx, sy, sz) = lo.blocks()[0]
        x0, x1, zf, zb = x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2
        k.rbox((x, F + 0.04, z), (sx - 0.06, 0.08, sz - 0.06), 0.01, m["paint"], BLACK)
        k.rbox((x, F + sy / 2, zb - 0.02), (sx, sy, 0.04), 0.0, m["walnut"], WALNUT_DARK, uv_len=1.3, v_axis=1)
        bays = 5
        bw = sx / bays
        for i in range(bays + 1):
            k.rbox((x0 + bw * i, F + sy / 2, z), (0.04, sy, sz), 0.008, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
        for y in (0.1, 0.5, sy - 0.025):
            k.rbox((x, F + y, z), (sx + 0.02, 0.04 if y < sy - 0.1 else 0.05, sz), 0.01, m["walnut"], WALNUT, uv_len=1.3)
        strip(k, m, (x0 + 0.05, F + sy - 0.06, zf + 0.03), (x1 - 0.05, F + sy - 0.06, zf + 0.03), w=0.02, h=0.012)
        rng = np.random.default_rng(57)
        for r, y in enumerate((0.12, 0.52)):
            for i in range(bays):
                bx0, bx1 = x0 + bw * i + 0.03, x0 + bw * (i + 1) - 0.03
                books_row(k, m, bx0, bx1 if (i + r) % 3 != 1 else bx0 + (bx1 - bx0) * 0.6, F + y + 0.02, zf + 0.04, (sz - 0.08) * 0.9, rng, max_h=0.34)
        top = F + sy
        for i in range(3):
            k.rbox((x0 + 0.5, top + 0.022 + i * 0.044, z), (0.3 - i * 0.02, 0.042, 0.24), 0.004, m["paint"], SPINES[(i * 4) % len(SPINES)], rot=K.game_rot(yaw=0.15 * i))
        for j, px in enumerate((x0 + 1.6, x1 - 1.4)):
            plant_bush(k, m, px, z, 0.5, 70 + j, pot=0.12, base=top)
        k.lathe((x1 - 0.5, top, z), [(0, 0), (0.06, 0), (0.09, 0.12), (0.05, 0.26), (0.04, 0.3), (0, 0.29)], m["stone"], "#d9cfc2", n=14)
    lo.build(k, make)


def whiteboard(k, m):
    """The study's whiteboard on the back wall at the left arm's end: an aluminium frame, the white board with a few
    lines of marker on it, a tray of markers."""
    b = FX["whiteboard"]["blocks"][0]
    (x, y0, _), (sx, sy, _) = b["at"], b["size"]
    y = F + y0
    zf = D - 0.03
    k.rbox((x, y + sy / 2, zf), (sx + 0.06, sy + 0.06, 0.03), 0.008, m["metal"], CHROME)
    k.rbox((x, y + sy / 2, zf - 0.017), (sx - 0.02, sy - 0.02, 0.004), 0.0, m["paint"], "#f6f5f1", segs=1)
    rng = np.random.default_rng(61)
    for i in range(7):
        w = float(rng.uniform(0.4, 1.3))
        lx = x - sx / 2 + 0.25 + float(rng.uniform(0, sx - 0.5 - w)) + w / 2
        ly = y + sy - 0.22 - i * 0.15
        col = ("#2f4a6b", "#2f4a6b", "#c9442f", "#3d5e47")[i % 4]
        k.rbox((lx, ly, zf - 0.02), (w, 0.022, 0.003), 0.0, m["paint"], col, segs=1, rot=K.game_rot(roll=float(rng.uniform(-0.03, 0.03))))
    k.rbox((x, y - 0.02, zf - 0.04), (sx * 0.5, 0.03, 0.08), 0.008, m["metal"], CHROME)
    for i, c in enumerate(("#2f4a6b", "#c9442f", "#3d5e47", "#1e1c1b")):
        k.tube([(x - 0.3 + i * 0.16, y + 0.01, zf - 0.05), (x - 0.18 + i * 0.16, y + 0.01, zf - 0.05)], 0.01, m["paint"], c, n=6, caps=True)


def admin_door(k, m):
    """The one admin door (David, 2026-10-22: "why is there 2 admin doors, make it 1, and place it like under the
    stairs"): the space under the flight's high end closed along its open side by walnut panels whose tops follow the
    stringer, and in them a walnut door in a black steel frame with a brass lever, a keypad and the "ADMINS ONLY" plate
    (its letters joined in main). Locked: "Admins only. It's locked." """
    f = FX["admin-door"]
    door = f["blocks"][0]
    (dx, _, dz), (_, dh, dw) = door["at"], door["size"]
    xp = S["x1"] - 0.02
    z0, z1 = f["footprint"][0][1] - f["footprint"][0][3], D
    run = S["head"] - S["foot"]

    def top(z):     # under the flight's treads and stringer, then the right arm's slab past its head
        return min(UNDER - 0.02, F * (z - S["foot"]) / run - 0.34)
    za_door, zb_door = dz - dw / 2 - 0.06, dz + dw / 2 + 0.06
    edges = [z0]
    z = z0
    while z < z1 - 1e-6:
        z = min(z1, z + 0.62)
        edges.append(z)
    for za, zb in zip(edges, edges[1:]):
        for a, bb, y0 in ((za, min(zb, za_door), 0.0), (max(za, zb_door), zb, 0.0), (max(za, za_door), min(zb, zb_door), dh + 0.1)):
            ta, tb = top(a), top(bb)
            if bb - a < 1e-3 or min(ta, tb) <= y0 + 0.02:
                continue
            pts = [(xp, y0, a), (xp, y0, bb), (xp, tb, bb), (xp, ta, a)]
            k.face([k.vert(p) for p in pts], [(p[2] / 1.3 + 0.37, p[1] / 1.3) for p in pts], m["walnut"], WALNUT)
        if not za_door < zb < zb_door and zb < z1 - 1e-6:
            k.rbox((xp + 0.004, top(zb) / 2, zb), (0.008, top(zb), 0.014), 0.0, m["paint"], WALNUT_DARK, segs=1)
    k.rbox((xp + 0.03, 0.06, (z0 + z1) / 2), (0.03, 0.12, z1 - z0), 0.006, m["walnut"], WALNUT_DARK, uv_len=1.5)
    # the door: a black steel frame proud of the panels, the walnut leaf, the lever, the keypad, the plate
    xf = xp + 0.04
    for s in (-1, 1):
        k.rbox((xf, (dh + 0.08) / 2, dz + s * (dw / 2 + 0.04)), (0.07, dh + 0.08, 0.08), 0.01, m["paint"], BLACK)
    k.rbox((xf, dh + 0.04, dz), (0.07, 0.08, dw + 0.16), 0.01, m["paint"], BLACK)
    k.rbox((xp + 0.015, dh / 2, dz), (0.04, dh, dw), 0.008, m["walnut"], WALNUT_DARK, uv_len=1.2, v_axis=1)
    for yy in (0.55, 1.5):
        k.rbox((xp + 0.046, yy + 0.4, dz), (0.006, 0.012, dw - 0.3), 0.0, m["paint"], WALNUT_DARK, segs=1)
    lz = dz - dw / 2 + 0.13
    k.rbox((xp + 0.05, 1.02, lz), (0.02, 0.16, 0.05), 0.006, m["metal"], BRASS)
    k.tube([(xp + 0.07, 1.06, lz), (xp + 0.08, 1.06, lz + 0.14)], 0.012, m["metal"], BRASS, n=6, caps=True)
    k.rbox((xp + 0.05, 1.32, lz), (0.02, 0.14, 0.09), 0.006, m["paint"], BLACK)
    k.rbox((xp + 0.062, 1.36, lz), (0.004, 0.03, 0.05), 0.0, m["glow"], "#ffffff", segs=1)
    k.rbox((xp + 0.07, 1.62 + 0.1, dz), (0.02, 0.14, 0.62), 0.006, m["paint"], BLACK)
    k.rbox((xp + 0.03, 0.006, dz), (0.03, 0.008, dw - 0.06), 0.0, m["glow"], "#ffffff", segs=1)     # light under the door


def floor_tracks(k, m, i):
    for t in L["tracks"]:
        if t["from"][1] < F and part_of(t["from"][0], t["from"][2]) == i:
            counted(k, "up tracks", track, k, m, t)


# ================================================================ the ground floor
def ground(m):
    k = K.Kit("hq_ground")
    floor_quad(k, m["floor"], 0.0, -W, W, -D, D)
    # The side and back walls, both storeys high, with their windows; the front wall is the ceiling model's.
    for x in (-W, W):
        holes = [(w["z0"], w["z1"], w["y0"], w["y1"]) for w in L["windows"] if wall_x(w) == x]
        side_wall(k, m, x, -D - T, D + T, 0.0, TOP, holes)
    # The back wall, open behind the tank: the tank's own back is the wall there (a plaster face 2 cm behind the water
    # wins the depth test from the walking camera's distance).
    for (a0, a1, b0, b1) in cut([(-W - T, W + T, 0.0, TOP)], (A["x0"], A["x1"], 0.0, TOP)):
        k.rbox(((a0 + a1) / 2, (b0 + b1) / 2, D + T / 2), (a1 - a0, b1 - b0, T), 0.0, m["plaster"], PLASTER, uv_len=2.5)
    for w in L["windows"]:
        window_frame(k, m, w)
    skirtings(k, m)
    # The cut-away near wall: a low lip either side of the door, capped in walnut; dark jambs; a step outside; a mat in.
    dx, dh = L["door"]["x"], L["door"]["half"]
    for x0, x1 in ((-W - T, dx - dh), (dx + dh, W + T)):
        k.rbox(((x0 + x1) / 2, LIP / 2, -D - T / 2), (x1 - x0, LIP, T), 0.0, m["plaster"], PLASTER, uv_len=2.5)
        k.rbox(((x0 + x1) / 2, LIP + 0.025, -D - T / 2), (x1 - x0 + 0.02, 0.05, T + 0.05), 0.015, m["walnut"], WALNUT_DARK)
    for sx in (-1, 1):
        k.rbox((dx + sx * (dh + 0.04), (LIP + 0.3) / 2, -D - T / 2), (0.08, LIP + 0.3, T + 0.06), 0.015, m["paint"], BLACK)
    k.rbox((dx, -0.03, -D - T - 0.28), (2 * dh + 0.5, 0.06, 0.5), 0.02, m["stone"], STONE_DARK)
    k.rbox((dx, 0.012, -D + 0.62), (1.7, 0.024, 0.95), 0.012, m["rug"], MAT, uv_len=0.6)
    for name, fn in (("panelling", walnut_panelling), ("canvas", landing_canvas), ("stair", stair), ("aquarium surround", aquarium_surround),
                     ("front desk", front_desk), ("coffee bar", coffee_bar), ("work lounge", work_lounge), ("window nook", window_nook),
                     ("aquarium lounge", aquarium_lounge), ("co-working", coworking), ("library", library), ("notice board", notice_board),
                     ("founder", founder), ("admin door", admin_door)):
        counted(k, name, fn, k, m)
    counted(k, "floor lamps", floor_lamps, k, m, 0)
    for lp in lamps_of(0, "sconce"):
        if lp["wall"] != "+z":                     # the front wall's are the ceiling model's
            counted(k, "sconces", sconce, k, m, lp, 0.0)
    for lp in lamps_of(0, "desk"):
        x, y, z = lp["light"]
        counted(k, "desk lamps", desk_lamp, k, m, x, lp["on"], z, y)
    for i, f in enumerate(f for f in L["fixtures"] if f["level"] == 0 and f["blocks"][0]["finish"] == "plant"):
        counted(k, "plants", plant, k, m, f["blocks"][0], 11 + i)
    return k.finish(name="hq_ground")


def skirtings(k, m):
    """Walnut skirting along the walls at both floors' level (upstairs, round the upper floor's edge at the walls, open
    over the stair's well)."""
    def run(x0, z0, x1, z1, y):
        if abs(x1 - x0) >= abs(z1 - z0):
            k.rbox(((x0 + x1) / 2, y + 0.06, z0), (abs(x1 - x0), 0.12, 0.03), 0.006, m["walnut"], WALNUT_DARK, uv_len=1.5)
        else:
            k.rbox((x0, y + 0.06, (z0 + z1) / 2), (0.03, 0.12, abs(z1 - z0)), 0.006, m["walnut"], WALNUT_DARK, uv_len=1.5)
    e = 0.015
    run(-W, D - e, W, D - e, 0.0)
    run(W - e, -D, W - e, D, 0.0)
    run(-W + e, -D, -W + e, D, 0.0)
    for x0, x1 in ((UPPER[1]["x0"], W), (-W, UPPER[2]["x1"])):
        run(x0, D - e, x1, D - e, F)
    run(W - e, -D, W - e, D, F)
    run(-W + e, -D, -W + e, WELL[2], F)
    run(-W + e, WELL[3], -W + e, D, F)


def walnut_panelling(k, m):
    """Walnut panels with dark reveals (ref 2's panelled wall) under the arms: the back wall behind the clock and the
    Founder's desk, behind the workbench's corner, and the right wall behind the notice board."""
    h = UNDER

    def panels_back(x0, x1):
        k.rbox(((x0 + x1) / 2, h / 2, D - 0.03), (x1 - x0, h, 0.04), 0.0, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
        x = x0 + 0.62
        while x < x1 - 0.1:
            k.rbox((x, h / 2, D - 0.052), (0.014, h, 0.006), 0.0, m["paint"], WALNUT_DARK)
            x += 0.62
    panels_back(UPPER[1]["x0"], W)
    panels_back(-W, UPPER[2]["x1"])
    z0, z1 = -3.9, S["foot"] - 0.05
    k.rbox((-W + 0.03, h / 2, (z0 + z1) / 2), (0.04, h, z1 - z0), 0.0, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
    z = z0 + 0.62
    while z < z1 - 0.1:
        k.rbox((-W + 0.052, h / 2, z), (0.006, h, 0.014), 0.0, m["paint"], WALNUT_DARK)
        z += 0.62


def landing_canvas(k, m):
    """A big framed canvas on the back wall over the stair's landing (ref 2's lit art piece, in the room's colours):
    deep navy, rust and cream blocks with a thin brass line, seen across the hall from the bridge."""
    x0, x1, y0, y1 = -11.5, -8.8, F + 1.1, F + 3.2
    xc, yc = (x0 + x1) / 2, (y0 + y1) / 2
    z = D - 0.05
    k.rbox((xc, yc, z), (x1 - x0 + 0.1, y1 - y0 + 0.1, 0.06), 0.012, m["paint"], BLACK)
    k.rbox((xc, yc, z - 0.035), (x1 - x0 - 0.06, y1 - y0 - 0.06, 0.01), 0.0, m["paint"], "#e9e1d2")
    for (xa, xb, ya, yb, col) in ((xc - 0.2, x1 - 0.25, y0 + 0.25, y1 - 0.5, "#24324f"), (x0 + 0.25, xc - 0.45, y0 + 0.6, yc + 0.35, "#b4583a"),
                                  (x0 + 0.6, xc + 0.4, yc + 0.55, y1 - 0.25, "#d8b878")):
        k.rbox(((xa + xb) / 2, (ya + yb) / 2, z - 0.042), (xb - xa, yb - ya, 0.006), 0.0, m["paint"], col)
    k.rbox((xc, y0 + 0.42, z - 0.046), (x1 - x0 - 0.5, 0.025, 0.004), 0.0, m["metal"], BRASS)


def stair(k, m):
    """A straight flight up the right wall under the right arm: walnut treads floating on two dark steel stringers, a
    glass balustrade with a walnut handrail up its open side."""
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
    for t in np.linspace(0, 1, 7):
        z = za + (zb - za) * t
        k.tube([(xg, lo(z) - 0.05, z), (xg, lo(z) + 0.92, z)], 0.014, m["metal"], STEEL_DARK, n=6)


def aquarium_surround(k, m):
    """The tank filling the hall's back wall: walnut cladding at its ends, floor to ceiling, and above it, a dark plinth
    below with the warm strip along its top, a slim bronze bezel round the glass. Open above, so the walking camera
    sees the water."""
    x0, x1, z0, y0, y1 = A["x0"], A["x1"], A["z0"], A["y0"], A["y1"]
    for b in FX["tank-ends"]["blocks"]:
        (x, _, z), (sx, sy, sz) = b["at"], b["size"]
        k.rbox((x, TOP / 2, (z0 - 0.1 + D) / 2), (sx, TOP, D - z0 + 0.1), 0.01, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
    k.rbox(((x0 + x1) / 2, (y1 + TOP) / 2 + 0.02, z0 + 0.03), (x1 - x0 + 0.1, TOP - y1 + 0.04, 0.16), 0.01, m["walnut"], WALNUT, uv_len=1.3)
    k.rbox(((x0 + x1) / 2, y0 / 2, (z0 - 0.04 + D) / 2), (x1 - x0, y0, D - z0 + 0.04), 0.01, m["paint"], CHARCOAL)
    strip(k, m, (x0 + 0.05, y0 - 0.04, z0 - 0.05), (x1 - 0.05, y0 - 0.04, z0 - 0.05), w=0.03, h=0.03)
    bz = 0.05
    for (c, s_) in ((((x0 + x1) / 2, y0 + bz / 2, z0 - 0.005), (x1 - x0, bz, 0.03)), (((x0 + x1) / 2, y1 - bz / 2, z0 - 0.005), (x1 - x0, bz, 0.03)),
                    ((x0 + bz / 2, (y0 + y1) / 2, z0 - 0.005), (bz, y1 - y0, 0.03)), ((x1 - bz / 2, (y0 + y1) / 2, z0 - 0.005), (bz, y1 - y0, 0.03))):
        k.rbox(c, s_, 0.008, m["paint"], BRONZE)
    # the floor slab's edge where it meets the tank: a bronze mullion at the upper floor's level, both ends
    for x in (x0 + 0.02, x1 - 0.02):
        k.rbox((x, F, z0 - 0.02), (0.06, 0.06, 0.06), 0.01, m["paint"], BRONZE)


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
    k.rbox((bx + 0.35, bsy + 0.04, bz + 0.1), (0.36, 0.08, 0.28), 0.01, m["paint"], CHARCOAL)
    k.rbox((bx + 0.35, bsy + 0.085, bz + 0.1), (0.3, 0.01, 0.22), 0.0, m["paint"], PAPER)
    k.lathe((bx - 0.3, bsy, bz + 0.15), [(0, 0), (0.045, 0), (0.05, 0.1), (0.044, 0.1), (0.04, 0.01), (0, 0.01)], m["paint"], WHITE, n=12)
    k.lathe((x + sx / 2 - 0.22, sy, z + 0.05), [(0, 0), (0.05, 0), (0.07, 0.08), (0.04, 0.18), (0.035, 0.2), (0, 0.19)], m["stone"], "#2e2b29", n=12)
    for i in range(3):
        a = i * 2.1
        k.tube([(x + sx / 2 - 0.22, sy + 0.18, z + 0.05), (x + sx / 2 - 0.22 + math.cos(a) * 0.08, sy + 0.42 + 0.04 * i, z + 0.05 + math.sin(a) * 0.06)], 0.005, m["paint"], STEM, n=4)
        k.blob((x + sx / 2 - 0.22 + math.cos(a) * 0.08, sy + 0.44 + 0.04 * i, z + 0.05 + math.sin(a) * 0.06), (0.04, 0.012, 0.025), m["paint"], LEAF_LIGHT, segs=6, rings=4, rot=K.game_rot(yaw=-a))
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
    """The big lounge in the hall before the tank (David, 2026-10-22: "utilize the first floor space infront of the
    fishtank to use for lounging, big cozy sofa and bean bag with bigger rug"; ref 2's velvet and shag): the big cream
    shag rug, a deep U sectional in brown velvet facing the glass with throw pillows, the low travertine table with books
    and the mushroom lamp inside it, five beanbags between it and the glass."""
    rug, back, ret_l, ret_r, table_b = FX["ground-lounge"]["blocks"]
    (x, _, z), (sx, sy, sz) = rug["at"], rug["size"]
    k.rbox((x, 0.016, z), (sx, 0.032, sz), 0.016, m["rug"], CREAM, uv_len=0.7)
    (x, _, z), (sx, sy, sz) = back["at"], back["size"]
    sofa(k, m, x, z, yaw_facing("+z"), sx, sz, sy, m["velvet"], VELVET, arms=False, seats=8,
         pillows=("#d9cdb5", "#a8643f", "#6f6f45", "#2f4a6b", "#d9cdb5", "#a8643f"), seed=5)
    for b, face, arms in ((ret_l, "-x", (True, False)), (ret_r, "+x", (False, True))):
        (x, _, z), (sx, sy, sz) = b["at"], b["size"]
        sofa(k, m, x, z, yaw_facing(face), sz, sx, sy, m["velvet"], VELVET, arms=arms, seats=2, pillows=("#6f6f45",), seed=9 if face == "-x" else 13)
    (x, _, z), (sx, sy, sz) = table_b["at"], table_b["size"]
    k.rbox((x, 0.08, z), (sx - 0.24, 0.16, sz - 0.24), 0.02, m["stone"], STONE_DARK)
    k.rbox((x, sy - 0.05, z), (sx, 0.1, sz), 0.03, m["stone"], STONE)
    lp = LAMPS["lounge-lamp"]["light"]
    mushroom(k, m, lp[0], sy, lp[2], (lp[1] - sy) / 0.62 * 1.35, r=0.2)
    for i, c in enumerate(("#2f4a6b", "#e9e4d8", "#b5863f")):
        k.rbox((x - 0.5, sy + 0.025 + i * 0.04, z + 0.05), (0.3 - i * 0.03, 0.04, 0.24 - i * 0.02), 0.004, m["paint"], c, rot=K.game_rot(yaw=0.2 * i))
    k.lathe((x + 0.25, sy, z - 0.2), [(0, 0), (0.13, 0), (0.15, 0.03), (0, 0.03)], m["paint"], BLACK, n=12)
    for i, b in enumerate(FX["lounge-beanbags"]["blocks"]):
        beanbag(k, m, b, i)


def work_lounge(k, m):
    """The work lounge on the deep blue rug by the library's end (ref 1): a quilted black leather daybed with its
    bolster, a brown leather sofa against the wall, a glass coffee table stacked with books and the mushroom lamp. Made
    facing -z and turned to face into the room."""
    lo = Local("work-lounge")
    lamp = lo.point(LAMPS["work-lamp"]["light"])

    def make():
        (rug, daybed, sofa_b, table_b) = lo.blocks()
        (x, _, z), (sx, sy, sz) = rug
        k.rbox((x, 0.016, z), (sx, 0.032, sz), 0.016, m["rug"], RUG_BLUE, uv_len=0.7)
        (x, _, z), (sx, sy, sz) = daybed
        for lx in (-sx / 2 + 0.12, sx / 2 - 0.12):
            for s in (-1, 1):
                k.tube([(x + lx - 0.08, 0.02, z + s * (sz / 2 - 0.05)), (x + lx + 0.08, sy - 0.12, z + s * (sz / 2 - 0.05))], 0.014, m["metal"], CHROME, n=6, caps=True)
                k.tube([(x + lx + 0.08, 0.02, z + s * (sz / 2 - 0.05)), (x + lx - 0.08, sy - 0.12, z + s * (sz / 2 - 0.05))], 0.014, m["metal"], CHROME, n=6, caps=True)
        k.rbox((x, sy - 0.11, z), (sx, 0.05, sz), 0.015, m["walnut"], WALNUT_DARK)
        cols, rows = 6, 2
        for i in range(cols):
            for j in range(rows):
                k.rbox((x - sx / 2 + sx * (i + 0.5) / cols, sy - 0.03, z - sz / 2 + sz * (j + 0.5) / rows), (sx / cols - 0.01, 0.1, sz / rows - 0.01), 0.04, m["leather"], LEATHER_BLACK, segs=2)
        k.tube([(x - sx / 2 + 0.12, sy + 0.08, z - sz / 2 + 0.05), (x - sx / 2 + 0.12, sy + 0.08, z + sz / 2 - 0.05)], 0.1, m["leather"], LEATHER_BLACK, n=12, caps=True)
        (x, _, z), (sx, sy, sz) = sofa_b
        sofa(k, m, x, z, yaw_facing("-z"), sx, sz, sy, m["leather"], LEATHER_BROWN, seats=2, pillows=("#d9cdb5", "#2f4a6b"), seed=41)
        (x, _, z), (sx, sy, sz) = table_b
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
        mushroom(k, m, lamp[0], sy, lamp[2], (lamp[1] - sy) / 0.62 * 1.6, r=0.15)
    lo.build(k, make)


def coworking(k, m):
    """The long walnut co-working desk (ref 1): a thick top on dark steel sled legs, four monitors on chrome stands,
    keyboards, papers, and four black leather office chairs pulled up to it. Made facing -z, turned toward the hall."""
    lo = Local("coworking")

    def make():
        blocks = lo.blocks()
        (x, _, z), (sx, sy, sz) = blocks[0]
        k.rbox((x, sy - 0.025, z), (sx, 0.05, sz), 0.015, m["walnut"], WALNUT, uv_len=1.4)
        for lx in (-sx / 2 + 0.25, 0.0, sx / 2 - 0.25):
            k.rbox((x + lx, (sy - 0.05) / 2, z), (0.05, sy - 0.05, sz - 0.12), 0.01, m["paint"], STEEL_DARK)
            k.rbox((x + lx, 0.02, z), (0.07, 0.04, sz - 0.04), 0.01, m["paint"], STEEL_DARK)
        k.rbox((x, sy - 0.25, z + sz / 2 - 0.06), (sx - 0.6, 0.36, 0.02), 0.005, m["walnut"], WALNUT_DARK)
        for b, (c, size) in zip(lo.f["blocks"], blocks):
            if b["finish"] == "screen":
                monitor(k, m, c[0], c[1], c[2] - 0.03, 0.0)
            elif b["finish"] == "leather":
                office_chair(k, m, c[0], c[2] - 0.05, math.pi + 0.1 * math.sin(c[0] * 3))
    lo.build(k, make)


def library(k, m):
    """The library wall (ref 1): tall walnut shelving along the left wall under the arm, closed cabinets below, open
    shelves above with books in rows and magazines face out, a warm strip under each shelf. Made facing -z, turned."""
    lo = Local("library")

    def make():
        (x, _, z), (sx, sy, sz) = lo.blocks()[0]
        x0, x1, zf, zb = x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2
        k.rbox((x, 0.05, z), (sx - 0.06, 0.1, sz - 0.06), 0.01, m["paint"], BLACK)
        k.rbox((x, sy / 2, zb - 0.02), (sx, sy, 0.04), 0.0, m["walnut"], WALNUT_DARK, uv_len=1.3, v_axis=1)
        bays = 6
        bw = sx / bays
        for i in range(bays + 1):
            k.rbox((x0 + bw * i, sy / 2, z), (0.045, sy, sz), 0.008, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
        k.rbox((x, 0.42, z - 0.01), (sx - 0.02, 0.64, sz - 0.02), 0.01, m["walnut"], WALNUT, uv_len=1.3)
        for i in range(bays):
            cx = x0 + bw * (i + 0.5)
            k.rbox((cx, 0.42, zf - 0.006), (0.012, 0.6, 0.01), 0.0, m["paint"], WALNUT_DARK)
            for s in (-1, 1):
                k.rbox((cx + s * 0.06, 0.62, zf - 0.02), (0.012, 0.12, 0.02), 0.004, m["metal"], BRASS)
        shelves = [0.74, 1.24, 1.74, 2.24, 2.74, 3.18]
        for y in shelves + [sy - 0.03]:
            k.rbox((x, y, z), (sx, 0.04, sz), 0.008, m["walnut"], WALNUT, uv_len=1.3)
        for y in shelves[1:] + [sy - 0.03]:
            strip(k, m, (x0 + 0.05, y - 0.03, zf + 0.03), (x1 - 0.05, y - 0.03, zf + 0.03), w=0.02, h=0.012)
        rng = np.random.default_rng(31)
        i_cover = 0
        for r, y in enumerate(shelves):
            gap = (shelves[r + 1] if r + 1 < len(shelves) else sy - 0.03) - y - 0.06
            for i in range(bays):
                bx0, bx1 = x0 + bw * i + 0.03, x0 + bw * (i + 1) - 0.03
                kind = (i + r * 3) % 5
                yb = y + 0.02
                depth = sz - 0.08
                if kind in (0, 3):
                    n = 2 if kind == 0 else 3
                    cw = (bx1 - bx0) / n
                    for c in range(n):
                        cover(k, m, bx0 + cw * (c + 0.5), yb, zb - 0.16, cw * 0.86, min(0.42, cw * 1.3, gap), i_cover)
                        i_cover += 1
                elif kind == 4 and (i + r) % 2 == 0:
                    books_row(k, m, bx0, bx0 + (bx1 - bx0) * 0.45, yb, zf + 0.04, depth * 0.9, rng, max_h=min(0.36, gap), lean_end=False)
                    vx = bx0 + (bx1 - bx0) * 0.72
                    k.lathe((vx, yb, z), [(0, 0), (0.06, 0), (0.09, 0.12), (0.05, 0.26), (0.04, 0.3), (0, 0.29)], m["stone"], ("#d9cfc2", "#2e2b29", "#b9764f")[(i + r) % 3], n=14)
                else:
                    books_row(k, m, bx0, bx1, yb, zf + 0.04, depth * 0.9, rng, max_h=min(0.36, gap))
    lo.build(k, make)


def notice_board(k, m):
    """The notice board and the club goals on the walnut wall by the stair's foot: a cork board in a walnut frame with
    pinned notes, and a slate goals board with two progress bars (the cafe and museum funds). Made facing -z, turned
    onto the right wall."""
    lo = Local("notice-board")

    def make():
        rng = np.random.default_rng(41)
        for ((x, y0, z), (sx, sy, sz)), face in zip(lo.blocks(), ("cork", "slate")):
            zc = z + 0.02
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
    lo.build(k, make)


def founder(k, m):
    """The Founder's desk (specs/hq-onboarding.md): a walnut writing desk against the panelled back wall under the left
    arm, its leather chair pushed back and turned as if someone just stood up, a closed notebook and a pen; above it the
    plaque, its canvas blank (only David writes it: lib/game/arrival/hq/lines.ts FOUNDER_PLAQUE)."""
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


# ================================================================ the upper floor: the bridge and the two arms
def part_of(x, z):
    """Which part of the upper floor (x, z) is on."""
    for i, r in enumerate(UPPER):
        if r["x0"] - 1e-6 <= x <= r["x1"] + 1e-6 and r["z0"] - 1e-6 <= z <= r["z1"] + 1e-6:
            return i
    return 0


def upper(m, i):
    """One part of the upper floor: its slab (plaster under, walnut planks on top, the stair's well left open), the
    walnut fascia and glass rail along its open edges with a warm cove strip under the edge, its fixtures, its lamps and
    the tracks under it."""
    k = K.Kit(f"hq_upper_{i}")
    r = UPPER[i]
    rects = cut([(r["x0"], r["x1"], r["z0"], r["z1"])], WELL)
    for (x0, x1, z0, z1) in rects:
        # the slab's top kept 5 cm under the floor's planks, so they never fight for the pixel
        k.rbox(((x0 + x1) / 2, F - SLAB / 2 - 0.025, (z0 + z1) / 2), (x1 - x0, SLAB - 0.05, z1 - z0), 0.0, m["plaster"], PLASTER_UNDER, uv_len=2.5)
        floor_quad(k, m["floor"], F + 0.002, x0, x1, z0, z1)
    for rl in L["rails"]:
        (ax, az), (bx, bz) = rl["from"], rl["to"]
        sx_, sz_ = rl["slab"]
        if part_of((ax + bx) / 2 + sx_ * 0.3, (az + bz) / 2 + sz_ * 0.3) == i:
            counted(k, "up rails", rail, k, m, rl)
    if i == 0:
        counted(k, "up lounge", lounge, k, m)
    if i == 1:
        counted(k, "up reading nook", nook, k, m, "arm-chairs")
        counted(k, "up study", study, k, m)
        counted(k, "up study shelves", study_shelves, k, m)
        counted(k, "up whiteboard", whiteboard, k, m)
    if i == 2:
        counted(k, "up reading nook", nook, k, m, "right-nook")
    counted(k, "up floor lamps", floor_lamps, k, m, 1, i)
    for lp in lamps_of(1, "sconce", i):
        counted(k, "up sconces", sconce, k, m, lp, F)
    for f in L["fixtures"]:
        if f["level"] != 1 or f.get("part", 0) != i:
            continue
        if f["id"].startswith("banner-"):
            counted(k, "up banners", banner, k, m, f)
        elif f["blocks"][0]["finish"] == "plant":
            b = f["blocks"][0]
            counted(k, "up plants", plant, k, m, b, int(abs(b["at"][0] * 10 + b["at"][2] * 3)) + 5, F)
    floor_tracks(k, m, i)
    return k.finish(name=f"hq_upper_{i}")


def rail(k, m, rl):
    """An open edge of the upper floor: the walnut fascia on the slab's edge with a warm cove strip tucked under it,
    glass panels between slim dark posts, a walnut handrail."""
    (ax, az), (bx, bz) = rl["from"], rl["to"]
    sx_, sz_ = rl["slab"]
    along_x = abs(bx - ax) >= abs(bz - az)
    ln = abs(bx - ax) if along_x else abs(bz - az)
    c = ((ax + bx) / 2 + sx_ * 0.06, (az + bz) / 2 + sz_ * 0.06)
    edge = ((ax + bx) / 2 - sx_ * 0.02, (az + bz) / 2 - sz_ * 0.02)

    def box(cc, y, h, t, ext, mat, col, r=0.004, uv=1.0):
        size = (ln + ext, h, t) if along_x else (t, h, ln + ext)
        k.rbox((cc[0], y, cc[1]), size, r, mat, col, uv_len=uv)
    box(edge, F - SLAB / 2 + 0.01, SLAB + 0.04, 0.045, 0.0, m["walnut"], WALNUT, r=0.01, uv=1.4)
    box(c, F + RAIL / 2, RAIL - 0.08, 0.016, 0.0, m["glass"], "#d6e6ea")
    box(c, F + RAIL - 0.03, 0.05, 0.07, 0.04, m["walnut"], WALNUT, r=0.018, uv=1.4)
    if rl["from"] != [-W, S["foot"]] and rl["from"] != [S["x1"], S["foot"]]:     # not round the stair's well
        e = 0.1
        strip(k, m, (ax + sx_ * e, F - SLAB - 0.012, az + sz_ * e), (bx + sx_ * e, F - SLAB - 0.012, bz + sz_ * e), w=0.03, h=0.015)
    n = max(2, int(ln / 1.5) + 1)
    for j in range(n):
        t = j / (n - 1)
        px, pz = ax + (bx - ax) * t + sx_ * 0.06, az + (bz - az) * t + sz_ * 0.06
        k.rbox((px, F + (RAIL - 0.05) / 2, pz), (0.035, RAIL - 0.05, 0.035), 0.008, m["paint"], STEEL_DARK, segs=1)


def lounge(k, m):
    """The big lounge on the bridge (ref 2), facing the tank across the hall: the cream shag carpet, two long velvet
    sofas with their backs to the front wall and throw pillows, an olive lounge chair, the travertine table, the round
    black table with the mushroom lamp, beanbags by the rail, and the chrome arc lamp reaching over the table."""
    b = FX["upper-carpet"]["blocks"][0]
    (x, _, z), (sx, sy, sz) = b["at"], b["size"]
    k.rbox((x, F + 0.018, z), (sx, 0.036, sz), 0.02, m["rug"], CREAM, uv_len=0.7)
    s1, s2, chair = FX["upper-sofas"]["blocks"]
    for j, s in enumerate((s1, s2)):
        (x, _, z), (sx, sy, sz) = s["at"], s["size"]
        sofa(k, m, x, z, yaw_facing("+z"), sx, sz, sy, m["velvet"], VELVET, seats=4, base=F, pillows=("#d9cdb5", "#6f6f45", "#a8643f"), seed=31 + j)
    (x, _, z), (sx, sy, sz) = chair["at"], chair["size"]
    sofa(k, m, x, z, 0.6 * math.pi, sx, sz, sy, m["velvet"], VELVET_OLIVE, seats=1, base=F)
    table, round_ = FX["upper-tables"]["blocks"]
    (x, _, z), (sx, sy, sz) = table["at"], table["size"]
    k.rbox((x, F + 0.08, z), (sx - 0.3, 0.16, sz - 0.3), 0.02, m["stone"], STONE_DARK)
    k.rbox((x, F + sy - 0.05, z), (sx, 0.1, sz), 0.03, m["stone"], STONE)
    for i, c in enumerate(("#e9e4d8", "#2f4a6b")):
        k.rbox((x + 0.4, F + sy + 0.022 + i * 0.04, z + 0.1), (0.34, 0.04, 0.26), 0.004, m["paint"], c, rot=K.game_rot(yaw=0.3 * i))
    k.lathe((x - 0.35, F + sy, z - 0.05), [(0, 0), (0.16, 0), (0.18, 0.03), (0, 0.03)], m["paint"], BLACK, n=12)
    (x, _, z), (sx, sy, sz) = round_["at"], round_["size"]
    r = sx / 2
    k.lathe((x, F, z), [(0, 0), (r * 0.5, 0), (r * 0.45, 0.04), (r * 0.12, 0.08), (r * 0.12, sy - 0.05), (r, sy - 0.04), (r * 1.0, sy), (0, sy)], m["paint"], BLACK, n=16)
    lp = LAMPS["upper-mushroom"]["light"]
    mushroom(k, m, lp[0], F + sy, lp[2], (lp[1] - sy) / 0.62 * 1.3, r=0.18)
    for i in range(3):
        a = 1.2 + i * 0.9
        k.lathe((x + math.cos(a) * 0.2, F + sy, z + math.sin(a) * 0.2), [(0, 0), (0.03, 0), (0.035, 0.09), (0.03, 0.09), (0.026, 0.01), (0, 0.01)], m["glass"], "#e8f0f2", n=10)
    for i, b in enumerate(FX["beanbags"]["blocks"]):
        beanbag(k, m, b, i + 1, base=F)
    arc_lamp(k, m)


def arc_lamp(k, m):
    """The big chrome arc lamp (ref 2): a marble block for a foot, the arc rising high and reaching over the lounge's
    table, a white globe hanging from its end, lit from the lower half."""
    b, globe = FX["arc-lamp"]["blocks"]
    (fx_, _, fz), (_, fh, _) = b["at"], b["size"]
    (gx, gy, gz), (gs, _, _) = globe["at"], globe["size"]
    gr = gs / 2
    gc = (gx, F + gy + gr, gz)
    k.rbox((fx_, F + 0.13, fz), (0.42, 0.26, 0.42), 0.04, m["stone"], "#ebe6de")
    p0, p3 = np.array((fx_, F + 0.26, fz)), np.array((gx, gc[1] + gr + 0.08, gz))
    p1, p2 = p0 + np.array((0, fh - 0.2, 0)), p3 + np.array((0, 1.2, 0)) + (p0 - p3) * np.array((0.18, 0, 0.18))
    pts = []
    for t in np.linspace(0, 1, 22):
        q = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
        pts.append(tuple(q))
    k.tube(pts, 0.026, m["metal"], CHROME, n=8, caps=True)
    k.tube([pts[-1], (gx, gc[1] + gr - 0.02, gz)], 0.012, m["metal"], CHROME, n=6)
    k.blob(gc, (gr, gr, gr), m["paint"], WHITE, segs=18, rings=10, flat_bottom=-gr * 0.1)
    k.lathe((gx, gc[1] - gr * 0.08, gz), [(0, -gr * 0.95), (gr * 0.55, -gr * 0.85), (gr * 0.92, -gr * 0.4), (gr * 1.005, 0)], m["glow"], "#ffffff", n=12)
    k.tube([(gx + math.cos(t) * gr * 1.01, gc[1] - gr * 0.08, gz + math.sin(t) * gr * 1.01) for t in np.linspace(0, TAU, 19)[:-1]], 0.012, m["metal"], CHROME, n=6, closed_path=True)


def banner(k, m, f):
    """A yearly banner, blank until David's designs, on a pole off its arm's rail over the hall's edge, facing the door:
    a black steel bracket up from the rail, the pole with a brass finial, and the cream cloth with a V at its foot on a
    walnut dowel hung by two rings."""
    pole, cloth = f["blocks"]
    (px, py, pz), (psx, _, _) = pole["at"], pole["size"]
    (x, _, z), (sx, sy, _) = cloth["at"], cloth["size"]
    inward = 1 if px < 0 else -1
    rx = px - inward * psx / 2                        # the rail end
    end = px + inward * psx / 2
    k.rbox((rx + inward * 0.02, F + (RAIL + py + 0.08) / 2, pz), (0.05, py + 0.08 - RAIL, 0.05), 0.01, m["paint"], STEEL_DARK, segs=1)
    k.tube([(rx, F + py, pz), (end, F + py, pz)], 0.022, m["paint"], STEEL_DARK, n=8, caps=True)
    k.blob((end + inward * 0.03, F + py, pz), (0.04, 0.04, 0.04), m["metal"], BRASS, segs=8, rings=5)
    top, h = F + py - 0.16, sy - 0.16             # the cloth hangs a hand below the pole
    k.tube([(x - sx / 2 - 0.05, top + 0.02, z), (x + sx / 2 + 0.05, top + 0.02, z)], 0.018, m["walnut"], WALNUT, n=8, caps=True)
    for s in (-1, 1):
        k.tube([(x + s * (sx / 2 - 0.12), top + 0.02, z), (x + s * (sx / 2 - 0.12), F + py - 0.02, z)], 0.006, m["paint"], CHARCOAL, n=4)
    a = sx / 2
    outline = [(-a, 0.0), (-a, -h + 0.3), (0.0, -h), (a, -h + 0.3), (a, 0.0)]
    k.extrude(outline, -0.012, 0.012, m["cloth"], CREAM, at=(x, top, z))
    k.rbox((x, top - 0.12, z - 0.014), (sx - 0.08, 0.025, 0.004), 0.0, m["cloth"], "#d9cbb0")


# ================================================================ the ceiling (seen only from inside the room)
def ceiling(m):
    k = K.Kit("hq_ceiling")
    oc = L["ovalCeiling"]
    y = TOP
    rects = cut([(-W, W, -D, D)], (oc["x0"], oc["x1"], oc["z0"], oc["z1"]))
    for (x0, x1, z0, z1) in rects:
        k.rbox(((x0 + x1) / 2, y + 0.03, (z0 + z1) / 2), (x1 - x0, 0.06, z1 - z0), 0.0, m["plaster"], CEIL, uv_len=2.5)
    oval_ceiling(k, m, oc, y)
    front_wall(k, m)
    for t in L["tracks"]:
        if t["from"][1] >= F:
            track(k, m, t)
    for lp in lamps_of(0, "sconce"):
        if lp["wall"] == "+z":
            sconce(k, m, lp, 0.0)
    return k.finish(name="hq_ceiling")


def oval_ceiling(k, m, oc, y):
    """The walnut ceiling with its oval wells (ref 1), over the bridge's lounge only: each well a walnut collar rising to
    a glowing oval of light."""
    x0, x1, z0, z1 = oc["x0"], oc["x1"], oc["z0"], oc["z1"]
    cols, rows, n = max(1, round((x1 - x0) / 2.15)), 3, 24
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
            k.lathe((cx, yb + 0.3, cz), [(0, 0), (1.0, 0)], m["glow"], "#ffffff", n=n, sx=rz, sz=rx)
    for (c, s_) in ((((x0 + x1) / 2, yb - 0.02, z0), (x1 - x0, 0.1, 0.05)), (((x0 + x1) / 2, yb - 0.02, z1), (x1 - x0, 0.1, 0.05)),
                    ((x0, yb - 0.02, (z0 + z1) / 2), (0.05, 0.1, z1 - z0)), ((x1, yb - 0.02, (z0 + z1) / 2), (0.05, 0.1, z1 - z0))):
        k.rbox(c, s_, 0.01, m["walnut"], WALNUT_DARK)


def front_wall(k, m):
    """The near wall, whole, both storeys, for a camera inside the room (the walking camera looks in over its lip, so the
    game shows this only to a camera inside): plaster over the lip, the glazed door in its bronze frame, a window either
    side on each storey; upstairs, walnut panelling behind the bridge's sofas with the lit art in the middle (ref 2)."""
    dx, dh = L["door"]["x"], L["door"]["half"]
    dt = 2.7
    wins = L["frontWindows"]
    holes = [(dx - dh, dx + dh, 0.0, dt)] + [(w["x0"], w["x1"], w["y0"], w["y1"]) for w in wins]
    rects = [(-W - T, W + T, LIP, TOP)]
    for h in holes:
        rects = cut(rects, h)
    for (a0, a1, b0, b1) in rects:
        k.rbox(((a0 + a1) / 2, (b0 + b1) / 2, -D - T / 2), (a1 - a0, b1 - b0, T), 0.0, m["plaster"], PLASTER, uv_len=2.5)
    # the glazed double door in a black frame, split down the middle (no cross bar), and the big panes either side
    zf = -D + 0.06
    for (c, s_) in (((dx - dh, dt / 2, zf), (0.07, dt, 0.08)), ((dx + dh, dt / 2, zf), (0.07, dt, 0.08)), ((dx, dt, zf), (2 * dh + 0.07, 0.07, 0.08)),
                    ((dx, dt / 2, zf), (0.05, dt, 0.06))):
        k.rbox(c, s_, 0.006, m["paint"], BLACK, segs=1)
    k.rbox((dx, dt / 2, zf + 0.01), (2 * dh, dt, 0.01), 0.0, m["glass"], "#cfe0e4")
    for sx in (-1, 1):
        k.rbox((dx + sx * 0.12, 1.05, zf - 0.05), (0.025, 0.8, 0.025), 0.008, m["metal"], CHROME, segs=1)
    for w in wins:
        pane_frame(k, m, -D - 0.06, w["x0"], w["x1"], w["y0"], w["y1"], True)
    # upstairs: the walnut panelling behind the sofas, its reveals, and the lit art piece in the middle
    p0, p1 = -5.8, 5.8
    k.rbox(((p0 + p1) / 2, F + 1.45, -D + 0.03), (p1 - p0, 2.9, 0.04), 0.0, m["walnut"], WALNUT, uv_len=1.3, v_axis=1)
    x = p0 + 0.63
    while x < p1 - 0.1:
        k.rbox((x, F + 1.45, -D + 0.052), (0.014, 2.9, 0.006), 0.0, m["paint"], WALNUT_DARK)
        x += 0.63
    art(k, m)


def art(k, m):
    """The lit art piece over the bridge's sofas (ref 2): a black frame round a dark panel, light glowing through two
    slots and four round holes. Made facing -z and turned to face the room from the front wall."""
    lo = Local("art")

    def make():
        (x, y0, z), (sx, sy, _) = lo.blocks()[0]
        y = F + y0 + sy / 2
        zf = z + 0.03
        k.rbox((x, y, zf - 0.03), (sx, sy, 0.06), 0.01, m["paint"], BLACK)
        k.rbox((x, y, zf - 0.062), (sx - 0.12, sy - 0.12, 0.004), 0.0, m["paint"], "#3a3633")
        for sxo in (-0.36, -0.22):
            k.rbox((x + sxo, y, zf - 0.066), (0.05, sy - 0.32, 0.004), 0.0, m["glow"], "#ffffff")
        for dx in (0.05, 0.29):
            for dy in (-0.22, 0.22):
                k.lathe((x + dx, y + dy, zf - 0.066), [(0, 0), (0.05, 0)], m["glow"], "#ffffff", d=(0, 0, -1), n=14)
    lo.build(k, make)


def front_panes():
    k = K.Kit("hq_windows_front")
    mat = K.Mat("M_View", "#ffffff", rough=0.1)
    for w in L["frontWindows"]:
        k.rbox(((w["x0"] + w["x1"]) / 2, (w["y0"] + w["y1"]) / 2, -D - 0.075), (w["x1"] - w["x0"], w["y1"] - w["y0"], 0.01), 0.0, mat, segs=1)
    return k.finish(name="hq_windows_front")


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
    """The tank on the back wall: along x from x0 to x1, its glass at z0, its back against the wall."""
    x0, x1, z0, y0, y1 = A["x0"], A["x1"], A["z0"], A["y0"], A["y1"]
    zb = D - 0.04
    gz = z0 + 0.02
    ln = x1 - x0
    ki = K.Kit("hq_tank_inner")
    mi = K.Mat("M_Tank", "#ffffff", rough=1.0)
    uv = lambda p: ((p[0] - x0) / ln, (p[1] - y0) / (y1 - y0))
    for pts in ([(x0, y0, zb), (x1, y0, zb), (x1, y1, zb), (x0, y1, zb)],
                [(x0, y0, gz), (x1, y0, gz), (x1, y0, zb), (x0, y0, zb)],
                [(x0 + 0.02, y0, gz), (x0 + 0.02, y0, zb), (x0 + 0.02, y1, zb), (x0 + 0.02, y1, gz)],
                [(x1 - 0.02, y0, gz), (x1 - 0.02, y0, zb), (x1 - 0.02, y1, zb), (x1 - 0.02, y1, gz)]):
        ki.face([ki.vert(p) for p in pts], [uv(p) for p in pts], mi, "#ffffff")
    inner = ki.finish(name="hq_tank_inner")
    # the reef: sand, rock rising at both ends (ref 2's size), coral and weed low down (ref 1's colour)
    kr = K.Kit("hq_tank_reef")
    mr = K.Mat("M_Reef", "#ffffff", rough=0.9)
    rng = np.random.default_rng(97)
    for i in range(16):
        x = x0 + 0.35 + (ln - 0.7) * i / 15
        kr.blob((x, y0 + 0.02, z0 + 0.7 + float(rng.uniform(-0.05, 0.05))), (0.45, 0.12, 0.55), mr, "#d8ccad", segs=10, rings=4, seed=i, lumpy=0.12, flat_bottom=0.0)
    # Reef rock (ref 2): a ridge along the back, rising to a tall face at the left end (as high as the bridge's floor),
    # a lower one at the right, a low saddle between; irregular lumps of every size, smaller as they climb, in browns,
    # olives and a purplish coralline.
    peaks = ((x1 - 1.3, 4.7, 2.0), (x0 + 1.2, 3.1, 1.7), (x0 + ln * 0.48, 1.4, 1.3))

    def ridge(x):
        return max(0.7, *(top * max(0.0, 1 - ((x - xc) / w) ** 2) for xc, top, w in peaks))
    rocks = []
    tones = ("#867a69", "#7b7262", "#7e7a5e", "#7c6b77", "#8f8270", "#6f675b")
    for i in range(58):
        x = x0 + 0.3 + float(rng.uniform(0, ln - 0.6))
        h = ridge(x)
        yy = y0 + 0.15 + float(rng.uniform(0, 1) ** 1.4) * (h - 0.3)
        t = (yy - y0) / max(h, 0.1)
        rr = (0.44 - 0.25 * t) * float(rng.uniform(0.7, 1.15))
        ext = rr * 1.05 * 1.3
        xr = min(max(x, x0 + ext + 0.05), x1 - ext - 0.05)
        zr = zb - 0.35 - float(rng.uniform(0, 0.35)) * (1 - t)
        rocks.append((xr, yy, zr, rr))
    for i, (x, yy, z, rr) in enumerate(rocks):
        kr.blob((x, yy, z), (rr * 1.05, rr * float(rng.uniform(0.6, 0.85)), min(rr, 0.38)), mr, tones[i % len(tones)], segs=8, rings=5, seed=40 + i, lumpy=0.4,
                rot=K.game_rot(yaw=float(rng.uniform(-0.5, 0.5)), pitch=float(rng.uniform(-0.3, 0.3))))
    corals = ["#ee8a6a", "#e86b8f", "#f2a54a", "#9b6bc4", "#e8c75a", "#f07a56"]
    for i in range(46):
        x = x0 + 0.25 + float(rng.uniform(0, ln - 0.5))
        z = float(rng.uniform(z0 + 0.35, zb - 0.25))
        yy = y0 + 0.12 + float(rng.uniform(0, 0.3))
        if i % 3:
            rk = rocks[int(rng.integers(0, len(rocks)))]
            x, yy, z = rk[0] + float(rng.uniform(-0.15, 0.15)), rk[1] + rk[3] * 0.55, rk[2] - rk[3] * 0.45
        c = corals[i % len(corals)]
        kind = i % 4
        if kind == 0:
            kr.blob((x, yy + 0.1, z), (0.16, 0.12, 0.16), mr, c, segs=10, rings=6, seed=70 + i, lumpy=0.25, flat_bottom=-0.08)
        elif kind == 1:
            for bi in range(5):
                a = bi * TAU / 5 + i
                kr.tube([(x, yy, z), (x + math.cos(a) * 0.08, yy + 0.18, z + math.sin(a) * 0.08), (x + math.cos(a) * 0.14, yy + 0.32 + 0.05 * (bi % 2), z + math.sin(a) * 0.14)], 0.022, mr, c, n=6, caps=True)
        elif kind == 2:
            kr.blob((x, yy + 0.28, z), (0.22, 0.26, 0.03), mr, "#9b6bc4" if i % 3 else "#e86b8f", segs=10, rings=6, seed=90 + i, rot=K.game_rot(yaw=float(rng.uniform(-0.6, 0.6))))
        else:
            for bi in range(6):
                a = bi * 1.7 + i
                h = 0.3 + 0.25 * ((bi * 7) % 3) / 2
                kr.tube([(x + math.cos(a) * 0.05, yy - 0.05, z + math.sin(a) * 0.05), (x + math.cos(a) * 0.1, yy + h * 0.5, z + math.sin(a) * 0.08), (x + math.cos(a) * 0.12, yy + h, z + math.sin(a) * 0.04)], 0.012, mr, "#5f9a55" if bi % 2 else "#78ad5f", n=5)
    reef = kr.finish(name="hq_tank_reef")
    kg = K.Kit("hq_tank_glass")
    kg.rbox(((x0 + x1) / 2, (y0 + y1) / 2, z0 + 0.005), (ln, y1 - y0, 0.01), 0.0, K.Mat("M_TankGlass", "#ffffff", rough=0.05), segs=1)
    glass = kg.finish(name="hq_tank_glass")
    ks = K.Kit("hq_tank_surface")
    ys = y1 - 0.14
    pts = [(x0, ys, gz), (x1, ys, gz), (x1, ys, zb), (x0, ys, zb)]
    ks.face([ks.vert(p) for p in pts], [(p[0], p[2]) for p in pts], K.Mat("M_Water", "#ffffff", rough=0.1), "#ffffff")
    surface = ks.finish(name="hq_tank_surface")
    return [inner, reef, glass, surface]


def main():
    K.reset()
    m = mats()
    g = ground(m)
    fd = FX["admin-door"]["blocks"][0]
    plate = letters("ADMINS ONLY", (S["x1"] - 0.02 + 0.085, 1.72, fd["at"][2]), 0.06, "hq_letters_admin", yaw=math.pi / 2)
    g = join(g, [plate])
    g.name = "hq_ground"
    gw = panes(L["windows"], "hq_windows")
    c = caster()
    K.export([g, gw, c], f"{OUT}/ground.glb")
    K.clear()
    m = mats()
    K.export([upper(m, i) for i in range(len(UPPER))], f"{OUT}/upper.glb")
    K.clear()
    m = mats()
    K.export([ceiling(m), front_panes()], f"{OUT}/ceiling.glb")
    K.clear()
    K.export(tank(), f"{OUT}/tank.glb")
    for name, n in sorted(TRIS.items(), key=lambda q: -q[1]):
        print(f"TRIS {name}: {n}")


main()
