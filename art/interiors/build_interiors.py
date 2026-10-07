"""The interior room shells (specs/polish/interiors.md deliverable 2), hand-modeled for the cut-away rooms: wall panels
with trim and skirting, windows (frames, glazing bars, stools and the outside beyond them), a framed doorway in the low
near wall with its doorstep, and each room's own pieces: the HQ's drapes, the shop's awning, the temple's rose window,
oculi and family banners, the museum's wing walls, three floors, plaque stands and wing signs. Matte, in each room's
palette. No downloads, no references beyond the rooms themselves.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/interiors/build_interiors.py [-- hq shop oracle museum kit]

Writes web/public/assets/game/interiors/<room>.glb and kit.glb (the HQ's front desk, the curator's desk, the crystal, the
home's pendant lamp and near-wall pieces, as named nodes). Game coordinates throughout (cafekit.G): x across (+x on screen left), y up, z
into the room; the camera looks up +z over the cut-away near wall at z = -D.

Named objects the engine looks for (components/game/interiors/RoomShell.tsx):
  <room>_shell    walls, trim, frames, floor, fittings (one object, a draw per material)
  <room>_windows  window panes: M_View, where the engine draws the outside for the time of day, looking through the pane
                  (box-projected, 6 units a repeat)
  <room>_caster   the ceiling and the cut-away near wall: shadow only, so the sun comes in through the windows
  museum_labels   plaque faces and wing signs (M_Labels: UVs into the engine's label atlas, a column per wing)
  oracle_banners  the four family banners (M_Banners: UVs into a 4 x 1 atlas)
  oracle_rose     the rose window's stained glass (M_RoseGlass: UVs across the disc; the engine paints and lights it)
The numbers mirror the rooms' code (HQInterior, ShopInterior, OracleInterior, MuseumInterior, HomeInterior,
lib/game/clubhouse.ts): change both together.
"""
import math, os, random, sys
import bmesh
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "cafe"))
import cafekit as K  # noqa: E402
from cafekit import G, Mat, Model  # noqa: E402

K.OUT = os.path.join(K.ROOT, "web", "public", "assets", "game", "interiors")
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None
PI = math.pi
VIEW_TILE = 6.0      # the outside texture covers y 0..6 (and repeats along the walls every 6 units)


# ================================================================ textures
def plaster(color, seed=1, size=256, depth=0.035):
    """Matte paint over plaster: soft mottling a few percent either way, never flat."""
    rng = np.random.default_rng(seed)
    base = np.array(K.hexrgb(color))
    n = 0.6 * K._smooth_noise(rng, size, size, 6) + 0.4 * K._smooth_noise(rng, size, size, 17)
    fine = rng.random((size, size)) * 0.5
    t = (n - 0.5) * 2 * depth + (fine - 0.25) * depth * 0.35
    return np.clip(base[None, None, :] * (1 + t[..., None]), 0, 1)


def flagstones(size, base, mortar, seed=5, rows=4):
    """Irregular rectangular flagstones in running courses, each its own tone, with mortar joints and a little wear."""
    rng = np.random.default_rng(seed)
    out = np.zeros((size, size, 3))
    b, m = np.array(K.hexrgb(base)), np.array(K.hexrgb(mortar))
    rh = size // rows
    noise = K._smooth_noise(rng, size, size, 9)
    for r in range(rows):
        x = int(rng.integers(0, size // 3))
        widths = []
        while sum(widths) < size:
            widths.append(int(rng.integers(size // 5, size // 2.6)))
        x0 = -x
        for w in widths + [size]:
            tone = 1 + rng.uniform(-0.09, 0.07)
            hue = np.array([rng.uniform(-0.02, 0.02), rng.uniform(-0.015, 0.015), rng.uniform(-0.02, 0.025)])
            xs = np.arange(x0, x0 + w) % size
            out[r * rh:(r + 1) * rh, xs] = np.clip((b + hue) * tone, 0, 1)
            x0 += w
            if x0 >= size:
                break
        # joints: the course line and the stones' ends
        out[r * rh:r * rh + 3, :] = m
        x0 = -x
        for w in widths:
            out[r * rh:(r + 1) * rh, (x0 + np.arange(3)) % size] = m
            x0 += w
            if x0 >= size:
                break
    out *= (0.94 + 0.12 * noise)[..., None]
    return np.clip(out, 0, 1)


def herringbone(size, dark, light, joint, seed=7, n=8):
    """Oak herringbone parquet: blocks at 45 degrees alternating, each its own tone with a fine grain."""
    rng = np.random.default_rng(seed)
    d, lgt, j = (np.array(K.hexrgb(c)) for c in (dark, light, joint))
    yy, xx = np.mgrid[0:size, 0:size] / size * n
    u, v = xx + yy, xx - yy                       # rotated 45 degrees
    blk = np.floor(u).astype(int)
    flip = blk % 2 == 0
    along = np.where(flip, v, u)                   # the board's length runs along v (or u) in alternate courses
    cross = np.where(flip, u, v)
    board = np.floor(along / 3.0 + np.floor(cross) * 0.5).astype(int)
    key = (np.floor(cross).astype(int) * 131 + board * 17) % 997
    tones = rng.uniform(-0.09, 0.09, 997)[key]
    grain = 0.5 + 0.5 * np.sin((cross * 37 + np.sin(along * 3) * 0.3) * 2.1)
    t = np.clip(0.45 + tones + 0.12 * grain, 0, 1)[..., None]
    out = d + (lgt - d) * t
    edge = (np.abs(cross - np.round(cross)) < 0.035) | (np.abs(along / 3.0 + np.floor(cross) * 0.5 - np.round(along / 3.0 + np.floor(cross) * 0.5)) < 0.012)
    out[edge] = j
    return np.clip(out, 0, 1)


def stripes(size, a, b, n=8):
    """Awning canvas: n vertical stripes."""
    out = np.zeros((size, size, 3))
    for k in range(n):
        out[:, k * size // n:(k + 1) * size // n] = K.hexrgb(a if k % 2 == 0 else b)
    rng = np.random.default_rng(3)
    out *= (0.97 + 0.05 * K._smooth_noise(rng, size, size, 12))[..., None]
    return np.clip(out, 0, 1)


def sky_placeholder():
    """The outside, as authored: the engine replaces it with the live sky for the time of day."""
    h = w = 64
    out = np.zeros((h, w, 3))
    for y in range(h):
        t = y / h
        out[y] = np.array(K.hexrgb("#bfe0ec")) * (1 - t) + np.array(K.hexrgb("#7f9f6a")) * t if t > 0.7 else K.hexrgb("#bfe0ec")
    return out


# ================================================================ a wall's inner face
class Wall:
    """The inner face of a wall: the plane `axis` = c ('x': the face is x = c and runs along z; 'z': z = c along x).
    `inward` is the sign of the room side along the normal. u runs along the wall (z or x), d into the room."""

    def __init__(self, axis, c, inward):
        self.axis, self.c, self.inward = axis, c, inward

    def p(self, u, y, d):
        n = self.c + self.inward * d
        return (n, y, u) if self.axis == "x" else (u, y, n)

    def size(self, su, sy, sd):
        return (sd, sy, su) if self.axis == "x" else (su, sy, sd)

    def n(self, sign=1):
        s = self.inward * sign
        return (s, 0, 0) if self.axis == "x" else (0, 0, s)

    def box(self, m, u, y, d, su, sy, sd, mat, bevel=0.0, drop=()):
        return m.box(self.p(u, y, d), self.size(su, sy, sd), mat, bevel=bevel, drop=drop)

    def quad(self, m, u0, u1, y0, y1, d, mat, inward=True):
        return m.quad([self.p(u0, y0, d), self.p(u1, y0, d), self.p(u1, y1, d), self.p(u0, y1, d)], mat, self.n(1 if inward else -1))


def slab(m, w, u0, u1, H, T, mat, openings=()):
    """The wall itself, inner face at d = 0 and T thick, from u0 to u1 and 0 to H, around rectangular openings
    [(a0, a1, y0, y1)] (sorted along u)."""
    u = u0
    for a0, a1, y0, y1 in sorted(openings):
        if a0 > u:
            w.box(m, (u + a0) / 2, H / 2, -T / 2, a0 - u, H, T, mat)
        if y0 > 0:
            w.box(m, (a0 + a1) / 2, y0 / 2, -T / 2, a1 - a0, y0, T, mat)
        if y1 < H:
            w.box(m, (a0 + a1) / 2, (y1 + H) / 2, -T / 2, a1 - a0, H - y1, T, mat)
        u = a1
    if u1 > u:
        w.box(m, (u + u1) / 2, H / 2, -T / 2, u1 - u, H, T, mat)


def round_hole(m, w, cu, cy, r, half, T, mat, n=32):
    """A square block of wall (2 half wide, T thick) around a round opening of radius r: the faces either side and the
    jamb inside the hole. Its square is one of `slab`'s openings. n is a multiple of 8, so the square's corners are
    vertices of its outline."""
    bm = m.bm
    faces, rings = [], []
    for d in (0.0, -T):
        vi, vo = [], []
        for k in range(n):
            a = math.tau * k / n
            ca, sa = math.cos(a), math.sin(a)
            s = half / max(abs(ca), abs(sa))
            vi.append(bm.verts.new(G(*w.p(cu + ca * r, cy + sa * r, d))))
            vo.append(bm.verts.new(G(*w.p(cu + ca * s, cy + sa * s, d))))
        faces += [bm.faces.new((vi[k], vi[(k + 1) % n], vo[(k + 1) % n], vo[k])) for k in range(n)]
        rings.append(vi)
    front, back = rings
    faces += [bm.faces.new((front[k], back[k], back[(k + 1) % n], front[(k + 1) % n])) for k in range(n)]
    i = m._mi(mat)
    for f in faces:
        f.material_index = i
    return faces


TAU = math.tau


def wainscot(m, w, u0, u1, top, M, gaps=(), panel=1.25, style="panel"):
    """The lower wall dressing from u0 to u1: a skirting board, raised panels in frames (or beadboard), a chair rail.
    `gaps` [(a0, a1)] are left bare (doorways)."""
    spans, u = [], u0
    for a0, a1 in sorted(gaps):
        if a0 > u:
            spans.append((u, a0))
        u = a1
    if u1 > u:
        spans.append((u, u1))
    for s0, s1 in spans:
        L = s1 - s0
        w.box(m, (s0 + s1) / 2, 0.08, 0.03, L, 0.16, 0.06, M["skirt"], bevel=0.008)                   # skirting
        w.box(m, (s0 + s1) / 2, 0.165, 0.035, L, 0.012, 0.07, M["skirt"])                              # its top lip
        w.box(m, (s0 + s1) / 2, (0.16 + top) / 2, 0.012, L, top - 0.16, 0.024, M["wain"])             # the board behind
        w.box(m, (s0 + s1) / 2, top + 0.01, 0.04, L, 0.07, 0.08, M["trim"], bevel=0.014)               # chair rail
        w.box(m, (s0 + s1) / 2, top - 0.045, 0.026, L, 0.03, 0.052, M["trim"])                         # its bead
        if style == "beadboard":
            continue
        k = max(1, round(L / panel))
        pw = L / k
        y0, y1 = 0.3, top - 0.12
        w.box(m, (s0 + s1) / 2, y1 + 0.035, 0.032, L, 0.07, 0.04, M["wain"])                          # top rail
        w.box(m, (s0 + s1) / 2, y0 - 0.04, 0.032, L, 0.08, 0.04, M["wain"])                           # bottom rail
        for j in range(k + 1):
            w.box(m, s0 + j * pw, (y0 + y1) / 2, 0.032, 0.08, y1 - y0, 0.04, M["wain"])               # stiles
        for j in range(k):
            w.box(m, s0 + (j + 0.5) * pw, (y0 + y1) / 2, 0.03, pw - 0.2, y1 - y0 - 0.1, 0.036, M["wain"], bevel=0.016)  # raised panel


def crown(m, w, u0, u1, H, T, M, low=0.0):
    """The cut top of the wall: a cap over its thickness, and a stepped cornice on the room side. Side walls sit their cap
    `low` under the back wall's, so the two never fight where they cross at the corners."""
    w.box(m, (u0 + u1) / 2, H + 0.025 - low, -T / 2 + 0.02, u1 - u0, 0.05, T + 0.08, M["cap"], bevel=0.01)
    w.box(m, (u0 + u1) / 2, H - 0.06, 0.03, u1 - u0, 0.12, 0.06, M["trim"])
    w.box(m, (u0 + u1) / 2, H - 0.15, 0.015, u1 - u0, 0.06, 0.03, M["trim"])


def window(m, glass, w, a0, a1, y0, y1, T, M, cols=2, rows=2, stool=True):
    """A window in a rectangular opening: liners, a sash with glazing bars, the pane, the casing and the stool."""
    L, lt, fw = a1 - a0, 0.05, 0.055
    cu, cy = (a0 + a1) / 2, (y0 + y1) / 2
    w.box(m, a0 + lt / 2, cy, -T / 2, lt, y1 - y0, T, M["sash"])
    w.box(m, a1 - lt / 2, cy, -T / 2, lt, y1 - y0, T, M["sash"])
    w.box(m, cu, y1 - lt / 2, -T / 2, L, lt, T, M["sash"])
    w.box(m, cu, y0 + lt / 2, -T / 2, L, lt, T, M["sash"])
    sd = -T * 0.55
    for u, su in ((a0 + lt + fw / 2, fw), (a1 - lt - fw / 2, fw)):
        w.box(m, u, cy, sd, su, y1 - y0 - 2 * lt, 0.06, M["sash"])
    for y in (y0 + lt + fw / 2, y1 - lt - fw / 2):
        w.box(m, cu, y, sd, L - 2 * lt, fw, 0.06, M["sash"])
    for c in range(1, cols):
        w.box(m, a0 + L * c / cols, cy, sd, 0.035, y1 - y0 - 2 * lt, 0.045, M["sash"])
    for r in range(1, rows):
        w.box(m, cu, y0 + (y1 - y0) * r / rows, sd, L - 2 * lt, 0.035, 0.045, M["sash"])
    w.quad(glass, a0 + lt, a1 - lt, y0 + lt, y1 - lt, sd - 0.012, M["view"])
    cw = 0.11
    w.box(m, a0 - cw / 2, cy + 0.03, 0.02, cw, y1 - y0 + 0.06, 0.04, M["trim"], bevel=0.01)       # casing
    w.box(m, a1 + cw / 2, cy + 0.03, 0.02, cw, y1 - y0 + 0.06, 0.04, M["trim"], bevel=0.01)
    w.box(m, cu, y1 + cw / 2, 0.022, L + 2 * cw, cw, 0.044, M["trim"], bevel=0.01)                 # head casing
    w.box(m, cu, y1 + cw + 0.02, 0.04, L + 2 * cw + 0.08, 0.04, 0.08, M["trim"], bevel=0.008)     # its cornice
    if stool:
        w.box(m, cu, y0 - 0.02, 0.05, L + 2 * cw + 0.06, 0.045, 0.2, M["trim"], bevel=0.01)       # stool
        w.box(m, cu, y0 - 0.1, 0.02, L + 2 * cw - 0.04, 0.11, 0.04, M["trim"], bevel=0.006)       # apron


def drapes(m, w, a0, a1, y_top, y_bot, M, folds=5, amp=0.03, width=0.4):
    """Pleated drapes either side of a window and their rod: a zigzag cloth hung from rings, bunched a little at the hem."""
    rod_y, rod_d = y_top + 0.06, 0.13
    w.box(m, (a0 + a1) / 2, rod_y, rod_d, a1 - a0 + 0.64, 0.03, 0.03, M["rod"], bevel=0.012)
    along = (1, 0, 0) if w.axis == "z" else (0, 0, 1)
    for u, sgn in ((a0 - 0.32, -1), (a1 + 0.32, 1)):
        m.lathe(w.p(u, rod_y, rod_d), [(0, 0), (0.03, 0), (0.045, 0.035), (0.03, 0.065), (0, 0.07)], M["rod"], n=10,
                d=tuple(sgn * c for c in along))
    for side in (-1, 1):
        u_in = a0 + 0.12 if side < 0 else a1 - 0.12
        u_out = u_in - side * width
        n = folds * 2
        bm = m.bm
        rows = []
        for j, y in enumerate((y_top, (y_top + y_bot) / 2, y_bot)):
            row = []
            for k in range(n + 1):
                t = k / n
                u = u_out + (u_in - u_out) * t
                d = rod_d - 0.01 + (amp * (1 + 0.25 * j) if k % 2 else -amp * 0.4)
                row.append(bm.verts.new(G(*w.p(u, y, d))))
            rows.append(row)
        faces = []
        for r0, r1 in zip(rows, rows[1:]):
            for k in range(n):
                faces.append(bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k])))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        i = m._mi(M["drape"])
        for f in faces:
            f.material_index = i


def near_wall(m, W, D, T, lip, door_half, M, door_x=0.0, step=True):
    """The cut-away near wall: a low lip either side of the doorway, capped; the doorway's jambs and threshold; outside,
    a stone doorstep and a few pavers, so the way out reads as the way out."""
    z = -D - T / 2
    for x0, x1 in ((-W, door_x - door_half), (door_x + door_half, W)):
        m.box(((x0 + x1) / 2, lip / 2, z), (x1 - x0, lip, T), M["outer"])
        m.box(((x0 + x1) / 2, lip + 0.03, z), (x1 - x0, 0.06, T + 0.08), M["cap"], bevel=0.01)
        m.box(((x0 + x1) / 2, 0.09, z - T / 2 - 0.02), (x1 - x0, 0.18, 0.04), M["skirt"])            # outside plinth
    for sx in (-1, 1):
        jx = door_x + sx * (door_half + 0.07)
        m.box((jx, (lip + 0.22) / 2, z), (0.16, lip + 0.22, T + 0.12), M["jamb"], bevel=0.02)
        m.box((jx, lip + 0.24, z), (0.22, 0.05, T + 0.18), M["jamb"], bevel=0.012)
        m.box((jx, lip + 0.29, z), (0.12, 0.05, T + 0.08), M["jamb"], bevel=0.015)                   # finial cap
    m.box((door_x, 0.012, z), (2 * door_half, 0.024, T + 0.08), M["threshold"], bevel=0.006)
    if step:
        m.box((door_x, -0.04, z - T / 2 - 0.3), (2 * door_half + 0.4, 0.08, 0.52), M["step"], bevel=0.025)


def caster(m, W, D, H, T, lip):
    """Shadow only: the ceiling, and the near wall above its cut. The sun comes in by the windows and the door."""
    m.box((0, H + 0.1, 0), (2 * W + 2 * T + 0.4, 0.2, 2 * D + 2 * T + 0.4), MAT["caster"])
    m.box((0, (lip + H) / 2 + 0.1, -D - T / 2), (2 * W + 2 * T, H - lip, T), MAT["caster"])


MAT = {}


def base_mats(prefix, wall, wain, trim, cap, outer, extra=None):
    M = {
        "wall": Mat("M_Paint", wall, 0.95, K.image(f"{prefix}_plaster", plaster(wall, seed=hash(prefix) % 97)), tile=2.2),
        "wain": Mat("M_Wainscot", wain, 0.85),
        "trim": Mat("M_Trim", trim, 0.8),
        "skirt": Mat("M_Skirting", wain, 0.85),
        "cap": Mat("M_Cap", cap, 0.85),
        "sash": Mat("M_Sash", trim, 0.75),
        "glass": Mat("M_Glass", "#dbe9ee", 0.1, alpha=0.16),
        "view": Mat("M_View", "#bfe0ec", 1.0, K.image(f"{prefix}_view", sky_placeholder()), tile=VIEW_TILE),
        "outer": Mat("M_Outer", outer, 0.95, K.image(f"{prefix}_outer", plaster(outer, seed=5, depth=0.05)), tile=2.0),
        "jamb": Mat("M_Jamb", cap, 0.8),
        "threshold": Mat("M_Threshold", "#9a8a72", 0.7),
        "step": Mat("M_Step", "#b3aa99", 0.95, K.image(f"{prefix}_step", flagstones(256, "#b9b0a0", "#8a8172", seed=2, rows=2)), tile=1.2),
        "rod": Mat("M_Brass", "#b08a52", 0.45),
    }
    MAT["caster"] = Mat("M_Caster", "#000000", 1.0)
    if extra:
        M.update(extra)
    return M


def finish(models, names):
    obs = []
    for m in models:
        if m.bm.faces:
            obs.append(m.finish())
    return obs


def set_uv(ob, mat_name, fn):
    """Explicit UVs for one material's faces: fn(game x, y, z) -> (u, v)."""
    me = ob.data
    idx = [i for i, m in enumerate(me.materials) if m.name == mat_name or m.name.startswith(mat_name + ".")]
    if not idx:
        return
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        if poly.material_index not in idx:
            continue
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv[li].uv = fn(co.x, co.z, -co.y)


# ================================================================ HQ (lib/game/clubhouse.ts: walls x +-8, z +-6, 4 high)
def hq():
    W, D, H, T, LIP, WAIN = 8.0, 6.0, 4.0, 0.3, 1.0, 1.1
    M = base_mats("hq", wall="#d6dccb", wain="#a1ae91", trim="#efe9da", cap="#8e7357", outer="#cfc4ae", extra={
        "drape": Mat("M_Drape", "#c99a52", 0.95),
    })
    shell, glass, cast = Model("hq_shell"), Model("hq_windows"), Model("hq_caster")
    Y0, Y1 = 1.22, 3.12
    win = {"+x": [(0.2, 1.7), (2.8, 4.3)], "-x": [(-4.7, -3.2), (-2.3, -0.8)]}
    back = Wall("z", D, -1)
    right, left = Wall("x", W, -1), Wall("x", -W, 1)
    slab(shell, back, -W - T, W + T, H, T, M["wall"])
    for wall, key in ((right, "+x"), (left, "-x")):
        ops = [(a0, a1, Y0, Y1) for a0, a1 in win[key]]
        slab(shell, wall, -D - T, D, H, T, M["wall"], ops)
        wainscot(shell, wall, -D, D - 0.09, WAIN, M)
        crown(shell, wall, -D - T, D + T, H, T, M, low=0.006)
        for a0, a1 in win[key]:
            window(shell, glass, wall, a0, a1, Y0, Y1, T, M, cols=2, rows=3)
            drapes(shell, wall, a0, a1, Y1 + 0.2, Y0 - 0.12, M)
    wainscot(shell, back, -W, W, WAIN, M)
    crown(shell, back, -W - T, W + T, H, T, M)
    near_wall(shell, W, D, T, LIP, 0.95, M)
    caster(cast, W, D, H, T, LIP)
    return finish([shell, glass, cast], "hq")


# ================================================================ shop (ShopInterior: walls +-5, 3.5 high)
def shop():
    W, D, H, T, LIP, WAIN = 5.0, 5.0, 3.5, 0.3, 0.9, 1.0
    M = base_mats("shop", wall="#dfeadc", wain="#b98a5a", trim="#f3eee2", cap="#7d5a3a", outer="#d8cbb0", extra={
        "floor": Mat("M_Floor", "#c79a68", 0.85, K.image("shop_floor", K.wood(512, "#a87a4c", "#cf9f6a", seed=41, planks=5, joint="#7a5232", joint_px=3, streak=0.45)), tile=2.0),
        "board": Mat("M_Beadboard", "#c89a68", 0.85, K.image("shop_bead", K.wood(512, "#b4875a", "#d2a874", seed=42, planks=10, joint="#8a6440", joint_px=3, streak=0.3)), tile=1.2),
        "awning": Mat("M_Awning", "#f2c75c", 0.95, K.image("shop_awning", stripes(256, "#f0c45a", "#fbf3e2", n=2)), tile=1.2),
        "awning_b": Mat("M_AwningCream", "#f6eedb", 0.95),
        "awning_y": Mat("M_AwningYellow", "#eebf55", 0.95),
    })
    shell, glass, cast = Model("shop_shell"), Model("shop_windows"), Model("shop_caster")
    Y0, Y1 = 1.12, 2.62
    win = [(-3.5, -2.0)]
    back = Wall("z", D, -1)
    right, left = Wall("x", W, -1), Wall("x", -W, 1)
    slab(shell, back, -W - T, W + T, H, T, M["wall"])
    for wall in (right, left):
        slab(shell, wall, -D - T, D, H, T, M["wall"], [(a0, a1, Y0, Y1) for a0, a1 in win])
        crown(shell, wall, -D - T, D + T, H, T, M, low=0.006)
        for a0, a1 in win:
            window(shell, glass, wall, a0, a1, Y0, Y1, T, M, cols=2, rows=2)
    crown(shell, back, -W - T, W + T, H, T, M)
    # beadboard wainscot: the general store's boards, a rail and a skirting
    for wall, (u0, u1) in ((back, (-W, W)), (right, (-D, D)), (left, (-D, D))):
        wall.box(shell, (u0 + u1) / 2, WAIN / 2, 0.012, u1 - u0, WAIN, 0.024, M["board"])
        wainscot(shell, wall, u0, u1, WAIN, M, style="beadboard")
    # the floor: warm planks across the room
    shell.quad([(-W, 0, -D), (W, 0, -D), (W, 0, D), (-W, 0, D)], M["floor"], (0, 1, 0))
    # the awning over the counter (ShopInterior's counter at 0, 3.4): a striped canvas sloping out from the back wall
    # on two brass arms, with a scalloped valance along its edge
    aw0, aw1, ytop, ybot, out = -2.4, 2.4, 2.95, 2.55, 0.85
    bm = shell.bm
    vs = [bm.verts.new(G(x, y, z)) for x, y, z in ((aw0, ytop, D - 0.02), (aw1, ytop, D - 0.02), (aw1, ybot, D - out), (aw0, ybot, D - out))]
    bm.faces.new(vs).material_index = shell._mi(M["awning"])
    for x in (aw0 + 0.08, aw1 - 0.08):
        shell.tube([(x, ytop + 0.02, D - 0.02), (x, ybot - 0.02, D - out - 0.02)], 0.014, M["rod"], n=6)
    shell.box((0, ytop + 0.03, D - 0.03), (aw1 - aw0 + 0.1, 0.06, 0.06), M["rod"], bevel=0.015)
    n = 8
    for k in range(n):
        x0 = aw0 + (aw1 - aw0) * k / n
        x1 = aw0 + (aw1 - aw0) * (k + 1) / n
        pts = [(x0, ybot, D - out)] + [(x0 + (x1 - x0) * j / 6, ybot - 0.2 - 0.08 * math.sin(j / 6 * PI), D - out - 0.004) for j in range(7)] + [(x1, ybot, D - out)]
        bm.faces.new([bm.verts.new(G(*p)) for p in pts[::-1]]).material_index = shell._mi(M["awning_y"] if k % 2 == 0 else M["awning_b"])
    near_wall(shell, W, D, T, LIP, 0.95, M)
    caster(cast, W, D, H, T, LIP)
    return finish([shell, glass, cast], "shop")


# ================================================================ Oracle temple (OracleInterior: walls +-6, 5 high)
FAMILY_BANNERS = [-4.7, -1.75, 1.75, 4.7]     # banner centres along the back wall (MuseumInterior-style atlas cells 0..3)


def oracle():
    W, D, H, T, LIP = 6.0, 6.0, 5.0, 0.36, 1.0
    M = base_mats("oracle", wall="#e9dff0", wain="#a99cb2", trim="#d8cde0", cap="#857891", outer="#c9bfd2", extra={
        "stone": Mat("M_Stone", "#a79fae", 0.95, K.image("oracle_stone", flagstones(512, "#aaa2b2", "#7d7487", seed=11, rows=5)), tile=2.6),
        "floor": Mat("M_Floor", "#9d94a0", 0.95, K.image("oracle_floor", flagstones(512, "#a39aa6", "#6f6675", seed=12, rows=4)), tile=3.0),
        "tracery": Mat("M_Tracery", "#cfc3d8", 0.9),
        "rose": Mat("M_RoseGlass", "#b9a4e0", 0.6, K.image("oracle_rose_ph", np.ones((8, 8, 3)) * 0.7), tile=1.0),
        "banners": Mat("M_Banners", "#6f5aa0", 0.95, K.image("oracle_banner_ph", np.ones((8, 8, 3)) * 0.5), tile=1.0),
        "wood": Mat("M_Wood", "#5a4436", 0.8),
    })
    shell, glass, cast, rose, banners = (Model(n) for n in ("oracle_shell", "oracle_windows", "oracle_caster", "oracle_rose", "oracle_banners"))
    back = Wall("z", D, -1)
    right, left = Wall("x", W, -1), Wall("x", -W, 1)
    RC, RR, RH = 3.6, 0.9, 1.1                # rose window centre height, radius, its square block's half side
    OC, OR, OH = 3.45, 0.42, 0.55             # the side oculi
    oculi = [-2.6, 1.0]
    slab(shell, back, -W - T, W + T, H, T, M["wall"], [(-RH, RH, RC - RH, RC + RH)])
    round_hole(shell, back, 0, RC, RR, RH, T, M["wall"])
    for wall in (right, left):
        slab(shell, wall, -D - T, D, H, T, M["wall"], [(c - OH, c + OH, OC - OH, OC + OH) for c in oculi])
        for c in oculi:
            round_hole(shell, wall, c, OC, OR, OH, T, M["wall"])
            ring_frame(shell, glass, wall, c, OC, OR, T, M, spokes=4)
    # the rose window: a stone ring, eight spokes and an inner ring, stained glass in the family colours
    ring_frame(shell, None, back, 0, RC, RR, T, M, spokes=8, inner=0.32)
    rose_glass(rose, back, 0, RC, RR, T, M)
    # stone plinth and pilasters, a stone cornice under the cut
    for wall, u0, u1 in ((back, -W, W), (right, -D, D), (left, -D, D)):
        wall.box(shell, (u0 + u1) / 2, 0.3, 0.06, u1 - u0, 0.6, 0.12, M["stone"], bevel=0.015)
        wall.box(shell, (u0 + u1) / 2, 0.63, 0.09, u1 - u0, 0.07, 0.18, M["trim"], bevel=0.02)
        wall.box(shell, (u0 + u1) / 2, H - 0.2, 0.08, u1 - u0, 0.24, 0.16, M["stone"], bevel=0.02)
        wall.box(shell, (u0 + u1) / 2, H - 0.36, 0.05, u1 - u0, 0.06, 0.1, M["trim"])
        wall.box(shell, (u0 + u1) / 2, H + 0.025, -T / 2 + 0.02, u1 - u0 + 2 * T, 0.05, T + 0.08, M["cap"], bevel=0.01)
    for u in (-3.2, 3.2):
        pilaster(shell, back, u, H, M)
    for wall in (right, left):
        for u in (-4.4, -0.8, 2.8):
            pilaster(shell, wall, u, H, M)
    # the family banners on the back wall: a rod with finials, the cloth swallow-tailed and gently rippled
    for k, bx in enumerate(FAMILY_BANNERS):
        top, bot, bw = 4.25, 1.7, 1.05
        back.box(shell, bx, top + 0.06, 0.12, bw + 0.36, 0.045, 0.045, M["wood"], bevel=0.015)
        for sx in (-1, 1):
            shell.lathe(back.p(bx + sx * (bw / 2 + 0.2), top + 0.06, 0.12), [(0, 0), (0.035, 0), (0.05, 0.04), (0, 0.09)], M["rod"], n=10, d=(sx, 0, 0))
            shell.tube([back.p(bx + sx * (bw / 2 - 0.05), top + 0.06, 0.12), back.p(bx, top + 0.42, 0.04)], 0.008, M["wood"], n=5)
        back.box(shell, bx, top + 0.43, 0.03, 0.06, 0.06, 0.06, M["rod"], bevel=0.01)
        cloth(banners, back, bx, bw, top, bot, M["banners"])
    near_wall(shell, W, D, T, LIP, 0.95, M)
    shell.quad([(-W, 0, -D), (W, 0, -D), (W, 0, D), (-W, 0, D)], M["floor"], (0, 1, 0))
    caster(cast, W, D, H, T, LIP)
    obs = finish([shell, glass, cast, rose, banners], "oracle")
    for ob in obs:
        if ob.name.startswith("oracle_banners"):
            def uv(x, y, z):
                k = min(range(4), key=lambda i: abs(x - FAMILY_BANNERS[i]))
                bx = FAMILY_BANNERS[k]
                return ((k + 0.5 + (bx - x) / 1.05 * 0.96) / 4, (y - 1.7) / (4.25 - 1.7))
            set_uv(ob, "M_Banners", uv)
        if ob.name.startswith("oracle_rose"):
            set_uv(ob, "M_RoseGlass", lambda x, y, z: (0.5 + (0 - x) / (2 * RR), 0.5 + (y - RC) / (2 * RR)))
    return obs


def pilaster(m, w, u, H, M):
    w.box(m, u, H / 2, 0.08, 0.5, H - 0.4, 0.16, M["stone"], bevel=0.02)
    w.box(m, u, 0.75, 0.13, 0.62, 0.3, 0.26, M["stone"], bevel=0.03)
    w.box(m, u, H - 0.5, 0.13, 0.62, 0.22, 0.26, M["stone"], bevel=0.03)


def ring_frame(m, glass, w, cu, cy, r, T, M, spokes=4, inner=0.0):
    """A round window's frame: a moulded ring on the room side, spokes (and an inner ring) across, a pane behind."""
    n = 28
    d = 0.03
    pts = [w.p(cu + math.cos(TAU * k / n) * (r + 0.06), cy + math.sin(TAU * k / n) * (r + 0.06), d) for k in range(n + 1)]
    m.tube(pts, 0.07, M["tracery"], n=8, caps=False)
    for k in range(spokes):
        a = TAU * k / spokes + (PI / spokes if spokes == 8 else PI / 4)
        r0 = inner if inner else 0.0
        m.tube([w.p(cu + math.cos(a) * r0, cy + math.sin(a) * r0, -T * 0.5), w.p(cu + math.cos(a) * r, cy + math.sin(a) * r, -T * 0.5)], 0.03, M["tracery"], n=6)
    if inner:
        pts = [w.p(cu + math.cos(TAU * k / n) * inner, cy + math.sin(TAU * k / n) * inner, -T * 0.5) for k in range(n + 1)]
        m.tube(pts, 0.035, M["tracery"], n=6, caps=False)
    if glass is not None:
        bm = glass.bm
        c = bm.verts.new(G(*w.p(cu, cy, -T * 0.55)))
        ring = [bm.verts.new(G(*w.p(cu + math.cos(TAU * k / n) * r, cy + math.sin(TAU * k / n) * r, -T * 0.55))) for k in range(n)]
        faces = [bm.faces.new((c, ring[k], ring[(k + 1) % n])) for k in range(n)]
        i = glass._mi(M["view"])
        for f in faces:
            f.normal_update()
            if f.normal.dot(Vector(G(*w.n())) - Vector(G(0, 0, 0))) < 0:
                f.normal_flip()
            f.material_index = i


def rose_glass(m, w, cu, cy, r, T, M):
    """The rose window's stained glass: one disc, coloured in the engine (four families round the centre)."""
    n = 32
    bm = m.bm
    c = bm.verts.new(G(*w.p(cu, cy, -T * 0.6)))
    ring = [bm.verts.new(G(*w.p(cu + math.cos(TAU * k / n) * r, cy + math.sin(TAU * k / n) * r, -T * 0.6))) for k in range(n)]
    faces = [bm.faces.new((c, ring[k], ring[(k + 1) % n])) for k in range(n)]
    i = m._mi(M["rose"])
    for f in faces:
        f.normal_update()
        if f.normal.dot(Vector(G(*w.n())) - Vector(G(0, 0, 0))) < 0:
            f.normal_flip()
        f.material_index = i


def cloth(m, w, bx, bw, top, bot, mat, cols=8, rows=10):
    """A hanging banner: a grid of quads, a soft vertical ripple, swallow-tailed at the hem."""
    bm = m.bm
    grid = []
    for j in range(rows + 1):
        t = j / rows
        y = top + (bot - top) * t
        row = []
        for i in range(cols + 1):
            s = i / cols
            u = bx - bw / 2 + bw * s
            tail = 0.0
            if t > 0.8:          # the swallow tail: the middle rises toward the hem
                tail = (t - 0.8) / 0.2 * (0.42 * (1 - abs(s - 0.5) * 2))
            yy = y + tail
            d = 0.1 + 0.025 * math.sin(s * PI * 3 + 0.4) * (0.4 + t)
            row.append(bm.verts.new(G(*w.p(u, yy, d))))
        grid.append(row)
    faces = []
    for j in range(rows):
        for i in range(cols):
            faces.append(bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])))
    for f in faces:
        f.normal_update()
        if f.normal.dot(Vector(G(*w.n())) - Vector(G(0, 0, 0))) < 0:
            f.normal_flip()
        f.material_index = m._mi(mat)


# ================================================================ museum (MuseumInterior: x +-9, z +-5; wings at x 6, 0, -6)
WINGS = [("aquarium", 6.0, "#86aab4"), ("insect_hall", 0.0, "#c8b083"), ("nature_room", -6.0, "#a3b893")]
CASES_PER_WING = 6


def case_xz(cx, i):
    return cx + 1.8 - (i % 3) * 1.8, (1.6 if i < 3 else 3.8)


def museum():
    W, D, H, T, LIP, WAIN = 9.0, 5.0, 4.7, 0.3, 1.0, 1.05
    M = base_mats("museum", wall="#efe6d3", wain="#6e4b33", trim="#efe6d3", cap="#5b4030", outer="#d9cdb4", extra={
        "aqua": Mat("M_PaintAqua", "#86aab4", 0.95, K.image("museum_aqua", plaster("#86aab4", seed=21)), tile=2.2),
        "ochre": Mat("M_PaintOchre", "#c8b083", 0.95, K.image("museum_ochre", plaster("#c8b083", seed=22)), tile=2.2),
        "sage": Mat("M_PaintSage", "#a3b893", 0.95, K.image("museum_sage", plaster("#a3b893", seed=23)), tile=2.2),
        "tile": Mat("M_FloorTile", "#a9bcc0", 0.85, K.image("museum_tile", K.tiles(512, 4, "#b2c4c6", "#7f9396", grout_px=4, vary=0.05, seed=31)), tile=2.4),
        "parquet": Mat("M_FloorParquet", "#c49a68", 0.85, K.image("museum_parquet", herringbone(512, "#9d6f44", "#d0a26c", "#6f4b2c")), tile=2.0),
        "slate": Mat("M_FloorSlate", "#98a38c", 0.9, K.image("museum_slate", flagstones(512, "#9aa58f", "#6c7563", seed=33, rows=4)), tile=2.4),
        "wood": Mat("M_Walnut", "#6e4b33", 0.8, K.image("museum_walnut", K.wood(512, "#5a3a24", "#7b5236", seed=34, planks=3, joint="#3a2414", joint_px=2, streak=0.4)), tile=1.4),
        "labels": Mat("M_Labels", "#725c4e", 0.9, K.image("museum_labels_ph", np.ones((8, 8, 3)) * 0.45), tile=1.0),
    })
    M["wain"] = M["wood"]
    shell, glass, cast, labels = (Model(n) for n in ("museum_shell", "museum_windows", "museum_caster", "museum_labels"))
    back = Wall("z", D, -1)
    right, left = Wall("x", W, -1), Wall("x", -W, 1)
    clere = [(cx + dx - 0.42, cx + dx + 0.42, 3.74, 4.24) for _, cx, _ in WINGS for dx in (-1.8, 0.0, 1.8)]
    side_win = [(-3.7, -1.9)]
    # the back wall: one slab with the clerestory, painted per wing (three faces in front of it)
    slab(shell, back, -W - T, W + T, H, T, M["wall"], clere)
    for (name, cx, _), paint in zip(WINGS, ("aqua", "ochre", "sage")):
        u0, u1 = max(-W, cx - 3), min(W, cx + 3)
        back.box(shell, (u0 + u1) / 2, (WAIN + 3.55) / 2, 0.004, u1 - u0, 3.55 - WAIN, 0.008, M[paint])
    for a0, a1, y0, y1 in clere:
        window(shell, glass, back, a0, a1, y0, y1, T, M, cols=2, rows=1, stool=False)
    for wall, paint in ((right, "aqua"), (left, "sage")):
        slab(shell, wall, -D - T, D, H, T, M[paint], [(a0, a1, 1.2, 3.1) for a0, a1 in side_win])
        for a0, a1 in side_win:
            window(shell, glass, wall, a0, a1, 1.2, 3.1, T, M, cols=2, rows=3)
        wainscot(shell, wall, -D, D - 0.09, WAIN, M)
        crown(shell, wall, -D - T, D + T, H, T, M, low=0.006)
    wainscot(shell, back, -W, W, WAIN, M)
    crown(shell, back, -W - T, W + T, H, T, M)
    # a frieze band under the clerestory, and pilasters dividing the wings
    back.box(shell, 0, 3.6, 0.03, 2 * W, 0.1, 0.06, M["trim"], bevel=0.01)
    for u in (-3.0, 3.0):
        back.box(shell, u, H / 2, 0.09, 0.42, H - 0.2, 0.18, M["trim"], bevel=0.02)
        back.box(shell, u, 0.6, 0.12, 0.52, 1.2, 0.24, M["wood"], bevel=0.02)
        back.box(shell, u, H - 0.25, 0.12, 0.54, 0.2, 0.24, M["trim"], bevel=0.02)
    # floors: tile, herringbone, slate; brass strips between the wings
    for (name, cx, _), mat in zip(WINGS, ("tile", "parquet", "slate")):
        x0, x1 = max(-W, cx - 3), min(W, cx + 3)
        shell.quad([(x0, 0, -D), (x1, 0, -D), (x1, 0, D), (x0, 0, D)], M[mat], (0, 1, 0))
    for x in (-3.0, 3.0):
        shell.box((x, 0.004, 0), (0.06, 0.008, 2 * D), M["rod"])
    # wing signs over each wing (faces in the label atlas, row 0) and plaque stands before each case (rows 1..)
    for k, (name, cx, _) in enumerate(WINGS):
        back.box(shell, cx, 3.2, 0.05, 2.3, 0.62, 0.06, M["wood"], bevel=0.02)
        back.quad(labels, cx - 1.06, cx + 1.06, 2.94, 3.46, 0.085, M["labels"])
        for sx in (-1, 1):
            back.box(shell, cx + sx * 0.9, 3.56, 0.04, 0.03, 0.12, 0.03, M["rod"])
    for k, (name, cx, _) in enumerate(WINGS):
        for i in range(CASES_PER_WING):
            x, z = case_xz(cx, i)
            plaque_stand(shell, labels, x, z - (0.82 if name == "aquarium" else 0.72), M)
    near_wall(shell, W, D, T, LIP, 0.95, M)
    caster(cast, W, D, H, T, LIP)
    obs = finish([shell, glass, cast, labels], "museum")
    for ob in obs:
        if ob.name.startswith("museum_labels"):
            set_uv(ob, "M_Labels", label_uv)
    return obs


PLAQUE = (0.62, 0.3)      # face width, height (tilted 35 degrees back)


def plaque_stand(m, labels, x, z, M):
    """A small walnut lectern before a case: a post on a foot, the label board tilted toward the visitor."""
    m.lathe((x, 0, z), [(0, 0), (0.15, 0), (0.15, 0.03), (0.06, 0.05), (0, 0.05)], M["wood"], n=12)
    m.cyl((x, 0.05, z), 0.025, 0.55, M["wood"], n=8)
    tilt = math.radians(35)
    w, h = PLAQUE
    cy, cz = 0.66, z
    ct, st = math.cos(tilt), math.sin(tilt)      # the board's up runs back into the room; its face looks up and out
    def pt(u, v, d):
        return (x + u, cy + ct * v + st * d, cz + st * v - ct * d)
    faces = m.box((x, cy, cz), (w + 0.08, h + 0.08, 0.04), M["wood"], bevel=0.012)
    m.rot(faces, (x, cy, cz), "x", -tilt)
    labels.quad([pt(-w / 2, -h / 2, 0.022), pt(w / 2, -h / 2, 0.022), pt(w / 2, h / 2, 0.022), pt(-w / 2, h / 2, 0.022)], M["labels"], (0, math.sin(tilt), -math.cos(tilt)))


LABEL_SIGN_H, LABEL_ROW_H, LABEL_H = 96, 192, 96 + 6 * 192    # mirrors MuseumInterior's label atlas (3 columns)


def label_uv(x, y, z):
    """Atlas cells (3 columns, one per wing in WINGS order): the wing's sign on top (96 px), then its six cases (192 px each)."""
    if y > 2.5:                                   # a wing sign on the back wall
        k = min(range(3), key=lambda i: abs(x - WINGS[i][1]))
        cx = WINGS[k][1]
        v_local = (y - 3.2) / 0.52                # -0.5 .. 0.5 bottom to top
        return ((k + 0.5 + (cx - x) / 2.12 * 0.98) / 3, 1 - (LABEL_SIGN_H * (0.5 - v_local * 0.96)) / LABEL_H)
    best = None
    for k, (name, cx, _) in enumerate(WINGS):
        for i in range(CASES_PER_WING):
            px, pz = case_xz(cx, i)
            pz -= 0.82 if name == "aquarium" else 0.72
            dd = abs(x - px) + abs(z - pz)
            if best is None or dd < best[0]:
                best = (dd, k, i, px, pz)
    _, k, i, px, pz = best
    tilt = math.radians(35)
    v = ((y - 0.66) * math.cos(tilt) + (z - pz) * math.sin(tilt)) / PLAQUE[1]
    u = (px - x) / PLAQUE[0]
    return ((k + 0.5 + u * 0.96) / 3, 1 - (LABEL_SIGN_H + LABEL_ROW_H * (i + 0.5 - v * 0.94)) / LABEL_H)


# ================================================================ the kit: the HQ's front desk, the curator's desk, the crystal, the home's lamp and near wall
def kit():
    M = {
        "walnut": Mat("M_Walnut", "#6e4b33", 0.8, K.image("kit_walnut", K.wood(512, "#5a3a24", "#7b5236", seed=34, planks=3, joint="#3a2414", joint_px=2, streak=0.4)), tile=1.4),
        "leather": Mat("M_Leather", "#4f6a52", 0.8),
        "brass": Mat("M_Brass", "#b08a52", 0.45),
        "paper": Mat("M_Paper", "#f3ead6", 0.95),
        "ink": Mat("M_Ink", "#3b3028", 0.8),
        "glass": Mat("M_Glass", "#dbe9ee", 0.1, alpha=0.2),
        "shade": Mat("M_LampShade", "#efe0bf", 0.95),
        "glow": Mat("M_LampGlow", "#fff1d6", 0.5, glow=3.0, glow_color="#ffe0a8", double=False),
        "crystal": Mat("M_Crystal", "#b9a0ea", 0.35, glow=0.6, glow_color="#c9b0ff"),
        "crystal_d": Mat("M_CrystalDeep", "#8e72c9", 0.35, glow=0.4, glow_color="#a98ae8"),
        "plaster": Mat("M_Outer", "#e6dcc6", 0.95, K.image("kit_plaster", plaster("#e6dcc6", seed=8, depth=0.04)), tile=2.0),
        "cap": Mat("M_Cap", "#8e7357", 0.85),
        "stone": Mat("M_Step", "#b3aa99", 0.95, K.image("kit_step", flagstones(256, "#b9b0a0", "#8a8172", seed=2, rows=2)), tile=1.2),
        "threshold": Mat("M_Threshold", "#9a8a72", 0.7),
        "cord": Mat("M_Cord", "#2e2722", 0.8),
        "oak": Mat("M_HoneyOak", "#c0904f", 0.8, K.image("kit_oak", K.wood(512, "#a87a43", "#cf9f62", seed=41, planks=2, joint_px=0, streak=0.45)), tile=1.3),
        "sage": Mat("M_DeskPanel", "#a1ae91", 0.9),
        "cream": Mat("M_DeskTrim", "#efe9da", 0.85),
        "envelope": Mat("M_Envelope", "#f6eedc", 0.95),
        "stamp": Mat("M_Stamp", "#c46a4a", 0.9),
    }
    obs = []
    # the HQ's front desk (HQInterior at lib/game/clubhouse.ts HQ_LAYOUT.desk; HQ_FRONT_DESK mirrors these numbers): a
    # reception desk in the room's honey oak and sage, its front to the visitor at -z. A counter with a ledge on the
    # visitor's side, low enough that whoever serves behind it shows from the waist up; the work surface behind at
    # desk height, with the lamp, the post tray and a pot of pens; the sign-in book and a bell on the ledge.
    f = Model("hq_front_desk")
    W2, D2, HW, HC, ZS = 0.95, 0.36, 0.76, 1.0, -0.06       # half width, half depth, work surface, ledge, counter's back
    f.box((0, HC / 2, (-D2 + ZS) / 2), (2 * W2, HC, ZS + D2), M["oak"])                                  # the counter
    f.box((0, HC + 0.02, (-D2 - 0.06 + ZS + 0.02) / 2), (2 * W2 + 0.08, 0.04, ZS + 0.02 + D2 + 0.06), M["oak"], bevel=0.012)  # its ledge
    f.box((0, HW - 0.02, (ZS + D2) / 2), (2 * W2, 0.04, D2 - ZS), M["oak"], bevel=0.008)               # the work surface
    for sx in (-1, 1):                                                                                     # its end panels
        f.box((sx * (W2 - 0.025), (HW - 0.04) / 2, (ZS + D2) / 2), (0.05, HW - 0.04, D2 - ZS), M["oak"])
    f.box((-0.1, HW + 0.003, 0.13), (0.62, 0.006, 0.26), M["leather"])                                  # writing inset
    for k in range(3):                                                                                     # raised sage panels
        x = -W2 + (k + 0.5) * (2 * W2 / 3)
        f.box((x, 0.53, -D2 - 0.012), (2 * W2 / 3 - 0.16, 0.6, 0.03), M["sage"], bevel=0.02)
        f.box((x, 0.53, -D2 - 0.006), (2 * W2 / 3 - 0.08, 0.68, 0.016), M["oak"], bevel=0.006)          # its frame
    f.box((0, HC - 0.07, -D2 - 0.012), (2 * W2, 0.05, 0.03), M["cream"], bevel=0.006)                    # a band under the ledge
    f.box((0, 0.06, -D2 - 0.02), (2 * W2 + 0.04, 0.12, 0.05), M["oak"], bevel=0.01)                      # plinth
    for sx in (-1, 1):                                                                                     # corner posts
        f.box((sx * (W2 - 0.03), HC / 2, -D2 - 0.01), (0.07, HC, 0.06), M["oak"], bevel=0.01)
    top = HC + 0.04
    # on the ledge: the sign-in book open on its cover with a pen, and the bell
    f.box((-0.12, top + 0.006, -0.2), (0.46, 0.012, 0.3), M["leather"], bevel=0.003)
    for side in (-1, 1):
        pg = f.box((-0.12 + side * 0.105, top + 0.02, -0.2), (0.2, 0.016, 0.27), M["paper"], bevel=0.003)
        f.rot(pg, (-0.12, top + 0.012, -0.2), "z", side * 0.06)
    f.tube([(0.02, top + 0.036, -0.27), (0.14, top + 0.036, -0.16)], 0.006, M["ink"], n=5)
    f.lathe((0.58, top, -0.22), [(0, 0), (0.07, 0), (0.07, 0.012), (0.012, 0.014), (0, 0.014)], M["walnut"], n=14)
    f.lathe((0.58, top + 0.014, -0.22), [(0.055, 0), (0.054, 0.02), (0.04, 0.045), (0.015, 0.058), (0, 0.06)], M["brass"], n=14)
    f.lathe((0.58, top + 0.072, -0.22), [(0, 0), (0.008, 0), (0.008, 0.012), (0.014, 0.016), (0, 0.02)], M["brass"], n=8)
    # on the work surface: the lamp at the wall end, the post tray with its letters, a pot of pens
    f.lathe((-0.7, HW, 0.2), [(0, 0), (0.08, 0), (0.08, 0.02), (0.02, 0.03), (0, 0.03)], M["brass"], n=12)
    f.tube([(-0.7, HW + 0.03, 0.2), (-0.7, HW + 0.38, 0.2), (-0.62, HW + 0.46, 0.14)], 0.012, M["brass"], n=6)
    f.lathe((-0.62, HW + 0.32, 0.14), [(0, 0.16), (0.03, 0.16), (0.11, 0.06), (0.12, 0.0), (0, 0.0)], M["sage"], n=14)
    f.disc((-0.62, HW + 0.322, 0.14), 0.1, M["glow"], d=(0, -1, 0))
    tray = (0.56, HW, 0.16)
    f.box((tray[0], HW + 0.008, tray[2]), (0.4, 0.016, 0.3), M["walnut"])
    for dx, dz, sx, sz in ((0, -0.145, 0.4, 0.012), (0, 0.145, 0.4, 0.012), (-0.195, 0, 0.012, 0.3), (0.195, 0, 0.012, 0.3)):
        f.box((tray[0] + dx, HW + 0.035, tray[2] + dz), (sx, 0.05, sz), M["walnut"])
    for k, (dx, dz, yaw) in enumerate(((0.0, 0.0, 0.05), (0.02, -0.015, -0.08), (-0.015, 0.012, 0.14))):
        f.box((tray[0] + dx, HW + 0.022 + k * 0.008, tray[2] + dz), (0.3, 0.006, 0.2), M["envelope"], yaw=yaw)
    f.box((tray[0] + 0.1, HW + 0.042, tray[2] + 0.06), (0.05, 0.002, 0.05), M["stamp"], yaw=0.14)
    f.lathe((0.3, HW, 0.26), [(0, 0), (0.045, 0), (0.045, 0.11), (0.04, 0.11), (0.04, 0.012), (0, 0.012)], M["sage"], n=12)
    for k, (dx, dz, lean) in enumerate(((-0.012, 0.0, 0.12), (0.014, 0.01, -0.1), (0.0, -0.014, 0.05))):
        pen = f.cyl((0.3 + dx, HW + 0.02, 0.26 + dz), 0.006, 0.15, M["ink"] if k != 1 else M["stamp"], n=5)
        f.rot(pen, (0.3 + dx, HW + 0.02, 0.26 + dz), "z", lean)
    obs.append(f.finish())
    # the curator's desk (MuseumInterior: centre -2.2, -1.3; 1.8 wide, 0.7 deep; its front faces the visitor at -z)
    d = Model("curator_desk")
    W2, D2, Hd = 0.9, 0.35, 0.8
    d.box((0, Hd - 0.03, 0), (2 * W2 + 0.08, 0.06, 2 * D2 + 0.08), M["walnut"], bevel=0.015)
    d.box((0, Hd - 0.005, 0.02), (2 * W2 - 0.3, 0.012, 2 * D2 - 0.18), M["leather"])             # leather inset
    d.box((0, (Hd - 0.06) / 2, 0), (2 * W2, Hd - 0.06, 2 * D2), M["walnut"], bevel=0.01)
    for k in range(3):                                                                             # raised front panels
        x = -W2 + (k + 0.5) * (2 * W2 / 3)
        d.box((x, (Hd - 0.06) / 2, -D2 - 0.012), (2 * W2 / 3 - 0.14, Hd - 0.26, 0.03), M["walnut"], bevel=0.02)
    d.box((0, 0.05, -D2 - 0.02), (2 * W2 + 0.06, 0.1, 0.05), M["walnut"], bevel=0.01)              # plinth
    # on top: a brass lamp, the guest book with a pen, a little bell, a specimen jar
    d.lathe((0.62, Hd, 0.12), [(0, 0), (0.08, 0), (0.08, 0.02), (0.02, 0.03), (0, 0.03)], M["brass"], n=12)
    d.tube([(0.62, Hd + 0.03, 0.12), (0.62, Hd + 0.36, 0.12), (0.52, Hd + 0.44, 0.06)], 0.012, M["brass"], n=6)
    d.lathe((0.52, Hd + 0.3, 0.06), [(0, 0.16), (0.03, 0.16), (0.11, 0.06), (0.12, 0.0), (0, 0.0)], M["brass"], n=14)
    d.disc((0.52, Hd + 0.302, 0.06), 0.1, M["glow"], d=(0, -1, 0))
    d.box((-0.2, Hd + 0.015, -0.05), (0.42, 0.03, 0.3), M["paper"], bevel=0.004)
    d.box((-0.2, Hd + 0.008, -0.05), (0.45, 0.012, 0.32), M["leather"])
    d.tube([(-0.05, Hd + 0.035, -0.1), (0.08, Hd + 0.035, 0.02)], 0.006, M["ink"], n=5)
    d.lathe((-0.62, Hd, -0.08), [(0, 0), (0.06, 0), (0.06, 0.012), (0.04, 0.04), (0.012, 0.06), (0, 0.065)], M["brass"], n=12)
    d.lathe((-0.66, Hd, 0.16), [(0, 0), (0.06, 0), (0.06, 0.16), (0.045, 0.17), (0, 0.17)], M["glass"], n=12)
    d.lathe((-0.66, Hd + 0.17, 0.16), [(0, 0), (0.046, 0), (0.046, 0.03), (0, 0.03)], M["walnut"], n=10)
    obs.append(d.finish())
    # the Oracle's crystal: a cluster of hexagonal points round one tall one (centred on its own middle)
    c = Model("oracle_crystal", smooth=20)
    def point(x, y, z, r, h, tx=0.0, tz=0.0, mat=None):
        f = c.lathe((x, y, z), [(0, 0), (r * 0.9, h * 0.1), (r, h * 0.62), (0, h)], mat or M["crystal"], n=6)
        if tx:
            c.rot(f, (x, y, z), "z", tx)
        if tz:
            c.rot(f, (x, y, z), "x", tz)
    point(0, -0.42, 0, 0.17, 0.95)
    for k, (a, r, h, lean) in enumerate(((0.3, 0.09, 0.5, 0.45), (2.2, 0.08, 0.42, 0.5), (4.1, 0.1, 0.55, 0.42), (5.3, 0.07, 0.36, 0.55))):
        x, z = math.cos(a) * 0.1, math.sin(a) * 0.1
        f = c.lathe((x, -0.38, z), [(0, 0), (r * 0.9, h * 0.1), (r, h * 0.62), (0, h)], M["crystal_d"] if k % 2 else M["crystal"], n=6)
        c.rot(f, (x, -0.38, z), "z", math.cos(a) * -lean)
        c.rot(f, (x, -0.38, z), "x", math.sin(a) * lean)
    f = c.lathe((0, -0.42, 0), [(0, 0), (0.15, 0.0), (0.12, -0.18), (0, -0.3)], M["crystal_d"], n=6)    # the root point below
    obs.append(c.finish())
    # the home's pendant lamp: a ceiling cup, a cord, a linen drum shade with its bulb (hangs from y 0 down)
    p = Model("pendant_lamp")
    p.lathe((0, -0.06, 0), [(0, 0), (0.09, 0), (0.07, 0.06), (0, 0.06)], M["brass"], n=12)
    p.cyl((0, -0.56, 0), 0.008, 0.5, M["cord"], n=6)
    p.lathe((0, -0.8, 0), [(0.33, 0), (0.33, 0.005), (0.28, 0.26), (0.275, 0.262), (0.27, 0.255), (0.325, 0.0)], M["shade"], n=24)
    p.lathe((0, -0.6, 0), [(0, 0), (0.035, 0), (0.035, 0.07), (0, 0.07)], M["brass"], n=10)
    p.lathe((0, -0.7, 0), [(0, 0.1), (0.045, 0.08), (0.05, 0.03), (0.02, 0.0), (0, 0.0)], M["glow"], n=12)
    p.disc((0, -0.79, 0), 0.26, M["glow"], d=(0, -1, 0))
    obs.append(p.finish())
    # the home's near wall, one 6-wide room each (HomeInterior: rooms 6 x 6, walls 3.2): a low lip, its cap and plinth;
    # the first room's has the doorway (jambs, threshold) and a stone step outside
    T, LIP = 0.24, 0.9
    for name, door in (("home_lip", False), ("home_lip_door", True)):
        m = Model(name)
        spans = ((-3.0, -0.9), (0.9, 3.0)) if door else ((-3.0, 3.0),)
        for x0, x1 in spans:
            m.box(((x0 + x1) / 2, LIP / 2, -T / 2), (x1 - x0, LIP, T), M["plaster"])
            m.box(((x0 + x1) / 2, LIP + 0.03, -T / 2), (x1 - x0, 0.06, T + 0.08), M["cap"], bevel=0.01)
            m.box(((x0 + x1) / 2, 0.09, -T - 0.02), (x1 - x0, 0.18, 0.04), M["cap"])
        if door:
            for sx in (-1, 1):
                m.box((sx * 0.97, (LIP + 0.22) / 2, -T / 2), (0.15, LIP + 0.22, T + 0.12), M["cap"], bevel=0.02)
                m.box((sx * 0.97, LIP + 0.24, -T / 2), (0.21, 0.05, T + 0.18), M["cap"], bevel=0.012)
            m.box((0, 0.012, -T / 2), (1.8, 0.024, T + 0.08), M["threshold"], bevel=0.006)
            m.box((0, -0.06, -T - 0.35), (2.3, 0.12, 0.62), M["stone"], bevel=0.03)
        obs.append(m.finish())
    obs += trophy_case(M)
    return obs


# The HQ's trophy case (specs/polish/forage-craft-museum.md 8; DefaultIslandWorld's member clubhouse at
# lib/game/clubhouse.ts HQ_LAYOUT.display): a walnut cabinet with a glass front against the back wall, its front to the
# room at -z. This week's trophies stand inside on little walnut stands (TROPHY_SLOTS, mirrored by components/game/
# TrophyCase.tsx), each with a brass plate whose face is a cell of the engine's label atlas (trophy_labels, M_TrophyLabels:
# the sign over the case on top, then a row per stand); the top shelf keeps the club's gold, silver and bronze cups.
TROPHY = dict(W2=1.15, D2=0.27, H=1.9, shelves=(0.17, 0.75), top=1.33)
TROPHY_XS = (0.72, 0.0, -0.72)
TROPHY_PLATE = (0.3, 0.075)                 # plate face width, height (tilted back 25 degrees)
TROPHY_SIGN_H, TROPHY_ROW_H = 96, 96        # atlas rows: the sign, then six plates (1 column, 512 wide)


def trophy_slots():
    return [(x, y) for y in TROPHY["shelves"] for x in TROPHY_XS]


def trophy_case(M):
    W2, D2, H = TROPHY["W2"], TROPHY["D2"], TROPHY["H"]
    felt = Mat("M_Felt", "#5f7a5c", 0.95)
    labels_mat = Mat("M_TrophyLabels", "#b08a52", 0.6, K.image("trophy_labels_ph", np.ones((8, 8, 3)) * 0.5), tile=1.0)
    c, lab = Model("trophy_case"), Model("trophy_labels")
    c.box((0, 0.06, 0), (2 * W2 + 0.06, 0.12, 2 * D2 + 0.06), M["walnut"], bevel=0.015)                 # plinth
    for sx in (-1, 1):                                                                                  # sides
        c.box((sx * (W2 - 0.03), H / 2, 0), (0.06, H, 2 * D2), M["walnut"], bevel=0.01)
    c.box((0, H / 2, D2 - 0.025), (2 * W2 - 0.06, H - 0.1, 0.05), felt)                                  # the felt back
    c.box((0, H - 0.035, 0), (2 * W2 + 0.12, 0.07, 2 * D2 + 0.12), M["walnut"], bevel=0.015)            # cornice
    c.box((0, H + 0.01, 0), (2 * W2 + 0.04, 0.03, 2 * D2 + 0.04), M["walnut"], bevel=0.008)
    c.box((0, 0.135, 0.0), (2 * W2 - 0.06, 0.03, 2 * D2 - 0.02), M["walnut"])                          # the deck
    for y in TROPHY["shelves"][1:] + (TROPHY["top"],):                                                  # shelves
        c.box((0, y - 0.015, 0.01), (2 * W2 - 0.08, 0.03, 2 * D2 - 0.06), M["walnut"], bevel=0.006)
    # the glass doors: a pane each in a walnut frame, brass knobs where they meet
    for sx in (-1, 1):
        x0, x1 = (0.01, W2 - 0.05) if sx > 0 else (-(W2 - 0.05), -0.01)
        cx, w = (x0 + x1) / 2, x1 - x0
        y0, y1 = 0.17, H - 0.08
        c.box((cx, (y0 + y1) / 2, -D2 + 0.012), (w - 0.06, y1 - y0 - 0.06, 0.008), M["glass"])
        for (bx, by, bw, bh) in ((cx, y0 + 0.02, w, 0.04), (cx, y1 - 0.02, w, 0.04), (x0 + 0.02, (y0 + y1) / 2, 0.04, y1 - y0), (x1 - 0.02, (y0 + y1) / 2, 0.04, y1 - y0)):
            c.box((bx, by, -D2 + 0.01), (bw, bh, 0.03), M["walnut"], bevel=0.006)
        c.lathe((sx * 0.06, H / 2, -D2 - 0.005), [(0, 0), (0.018, 0), (0.018, 0.012), (0.01, 0.02), (0, 0.022)], M["brass"], n=10, d=(0, 0, -1))
    # the sign board on the cornice, its face a label
    c.box((0, H + 0.17, -D2 + 0.04), (1.3, 0.28, 0.04), M["walnut"], bevel=0.012)
    lab.quad([(0.6, H + 0.06, -D2 + 0.017), (-0.6, H + 0.06, -D2 + 0.017), (-0.6, H + 0.28, -D2 + 0.017), (0.6, H + 0.28, -D2 + 0.017)], labels_mat, (0, 0, -1))
    # a stand at each slot: a walnut block with a brass plate on its tilted front
    tilt = math.radians(25)
    w, h = TROPHY_PLATE
    for (x, y) in trophy_slots():
        c.box((x, y + 0.03, -0.03), (0.4, 0.06, 0.24), M["walnut"], bevel=0.01)
        c.box((x, y + 0.075, -0.03), (0.3, 0.03, 0.16), M["walnut"], bevel=0.008)
        pz, py = -0.03 - 0.12 - 0.006, y + 0.035
        ct, st = math.cos(tilt), math.sin(tilt)
        plate = c.box((x, py, pz + 0.004), (w + 0.03, h + 0.024, 0.008), M["brass"])
        c.rot(plate, (x, py, pz), "x", -tilt)
        def pt(u, v, x=x, py=py, pz=pz):
            return (x + u, py + ct * v, pz + st * v - 0.002)
        lab.quad([pt(w / 2, -h / 2), pt(-w / 2, -h / 2), pt(-w / 2, h / 2), pt(w / 2, h / 2)], labels_mat, (0, st, -ct))
    obs = [c.finish(), lab.finish()]
    set_uv(obs[1], "M_TrophyLabels", trophy_uv)
    return obs


def trophy_uv(x, y, z):
    """The label atlas (1 column, 512 wide): the sign (96 px) on top, then a 96 px row per stand in trophy_slots() order."""
    rows = TROPHY_SIGN_H + 6 * TROPHY_ROW_H
    H = TROPHY["H"]
    if y > H:
        v_local = (y - (H + 0.17)) / 0.22
        return (0.5 + (-x) / 1.2 * 0.96, 1 - (TROPHY_SIGN_H * (0.5 - v_local * 0.92)) / rows)
    slots = trophy_slots()
    i = min(range(len(slots)), key=lambda k: abs(x - slots[k][0]) + abs(y - slots[k][1]))
    sx, sy = slots[i]
    tilt = math.radians(25)
    v = (y - (sy + 0.035)) / math.cos(tilt) / TROPHY_PLATE[1]
    u = (sx - x) / TROPHY_PLATE[0]
    return (0.5 + u * 0.96, 1 - (TROPHY_SIGN_H + TROPHY_ROW_H * (i + 0.5 - v * 0.92)) / rows)


ROOMS = {"hq": hq, "shop": shop, "oracle": oracle, "museum": museum}


def main():
    K.reset()
    for name, build in ROOMS.items():
        if ONLY and name not in ONLY:
            continue
        MAT.clear()
        K.export(build(), name)
        K.clear()
        K.reset()
    if not ONLY or "kit" in ONLY:
        K.export(kit(), "kit")
        K.clear()


main()
