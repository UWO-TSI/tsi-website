"""The outdoor study tables (components/game/study/StudySeats.tsx TableFurniture; lib/study/seats.ts FURNITURE picnic and
pier) and their book: our own picnic-style timber tables with a cloth runner, and an open book. Replace
acnh/furniture/reading-table.glb (two side by side made the picnic table) and lounge-book.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_study_table.py [-- review <dir>]

Writes web/public/assets/game/props/study-table-long.glb (the picnic table, 2.0 x 0.84, its solid footprint), study-
table.glb (the pier's, 1.0 x 0.84) and study-book.glb. Frames: game units, the origin on the ground under the table's
middle; the top at 0.84 (the book's height, and where seat-mates' hands rest, as before). The book is an interior-style
piece (lib/game/propModels.ts REMODELLED_PIECES "lounge-book"): authored at the dump book's size at scale 0.1, 0.74 x 0.48,
lying open, the origin under its spine.

The tables: a top of five rounded boards across battens, splayed trestle legs at each end tied by a stretcher, a linen
runner in a rust and cream stripe across the middle hanging over both long edges. Two materials: M_TableWood (grain,
COLOR_0 per board), M_Cloth. The book: cloth-bound covers and two curved page blocks: M_BookCover, M_Paper.

The classic tables (game/remodel-r2; David, 2026-10-16: "looks good but make a second version similar to the original
design"): the original reading table's shape, rebuilt as ours: a thick honey-wood top with rounded edges on four
chunky tapered legs, a square cloth laid corner-on so a green point hangs over the middle of each edge and the
table's corners show, the cloth in four greens (deep, olive, olive, pale) under a fine weave with a darker hem. The
picnic's is two side by side, as the original was: study-table-classic-long.glb (2 long) and study-table-classic.glb
(the pier's, 1 long), the same footprints and top as the others. Materials: M_ClassicWood, M_ClassicCloth.

  ... build_study_table.py -- classic        (only the classic ones)
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from propkit import arr, smooth  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TOP, DEPTH, BOARD_T = 0.84, 0.84, 0.05
BOARDS = ["#c79d6c", "#bd9365", "#cba371", "#c0976a", "#c69c6e"]
LEGS = "#ad8459"


def cloth_tex():
    """Linen in a stripe: cream ground, rust bands and a thin sage line, the weave over it."""
    h, w = 128, 256
    U, V = K.grid(h, w)
    base = K.linen(h, w, 141, "#ffffff", threads=48)
    x = U
    band = smooth(0.02, 0.0, np.abs(((x * 4) % 1) - 0.5) - 0.18)          # four rust bands across u
    thin = smooth(0.012, 0.0, np.abs(((x * 4 + 0.5) % 1) - 0.5) - 0.0)
    col = arr("#efe3c8") * (1 - band[..., None]) + arr("#b35e3e") * band[..., None]
    col = col * (1 - 0.8 * thin[..., None]) + arr("#7d8c62") * 0.8 * thin[..., None]
    return np.clip(base * col / 0.92, 0, 1)


def paper_tex():
    """Two open pages: cream paper, lines of (illegible) text in blocks, a soft shadow into the gutter."""
    h, w = 128, 256
    U, V = K.grid(h, w)
    out = np.ones((h, w)) * 0.95
    for page in (0, 1):
        u0 = page * 0.5
        lu = (U - u0) / 0.5
        inside = (lu > 0.12) & (lu < 0.88) & (V > 0.12) & (V < 0.88)
        row = (V * 22) % 1
        words = K.noise(h, w, 40, 151 + page, 22) > 0.32
        ink = inside & (row > 0.35) & (row < 0.6) & words
        out = out - 0.33 * ink
    gutter = smooth(0.06, 0.0, np.abs(U - 0.5))
    out = out - 0.18 * gutter
    return np.clip(out[..., None] * arr("#fbf3e2"), 0, 1)


def table(name, length, runners):
    K.reset()
    M = {
        "wood": K.Mat("M_TableWood", tex=K.image("table_grain", K.grain(256, 256, 142, "#ffffff", knots=3)), rough=0.92),
        "cloth": K.Mat("M_Cloth", tex=K.image("table_cloth", cloth_tex()), rough=1.0),
    }
    k = K.Kit(name)
    # The top: five boards along x with hairline gaps, rounded over.
    n = len(BOARDS)
    pitch = DEPTH / n
    for i in range(n):
        z = -DEPTH / 2 + pitch * (i + 0.5)
        k.rbox((0, TOP - BOARD_T / 2, z), (length, BOARD_T, pitch - 0.012), 0.014, M["wood"], BOARDS[i], uv_len=1.4, uv_off=(0.13 * i, 0.07 * i))
    # Battens under the top, and the trestles: two splayed legs each, a foot rail, a stretcher along between them.
    ends = [-(length / 2 - 0.16), length / 2 - 0.16]
    for x in ends:
        k.rbox((x, TOP - BOARD_T - 0.025, 0), (0.09, 0.05, DEPTH - 0.06), 0.012, M["wood"], LEGS)
        for s in (-1, 1):
            k.beam((x, TOP - BOARD_T - 0.04, s * 0.2), (x, 0.0, s * 0.36), 0.08, 0.07, 0.016, M["wood"], LEGS, up=(1, 0, 0))
        k.rbox((x, 0.03, 0), (0.08, 0.06, 0.78), 0.016, M["wood"], LEGS)
    k.beam((ends[0] + 0.04, 0.32, 0), (ends[1] - 0.04, 0.32, 0), 0.06, 0.07, 0.014, M["wood"], LEGS, up=(0, 1, 0))
    if length > 1.5:
        k.beam((-0.25, TOP - BOARD_T - 0.03, -DEPTH / 2 + 0.07), (-0.25, TOP - BOARD_T - 0.03, DEPTH / 2 - 0.07), 0.07, 0.05, 0.012, M["wood"], LEGS)
        k.beam((0.25, TOP - BOARD_T - 0.03, -DEPTH / 2 + 0.07), (0.25, TOP - BOARD_T - 0.03, DEPTH / 2 - 0.07), 0.07, 0.05, 0.012, M["wood"], LEGS)
    # The runner: across the top and over both long edges, hanging down with a soft roll at the edge.
    for xc in runners:
        wdt = 0.46
        prof = []                                     # (z, y) along the runner, front hem to back hem
        for t in np.linspace(0, 1, 5):
            prof.append((-DEPTH / 2 - 0.012 - 0.008 * t, TOP - 0.15 + 0.15 * t * t))
        for a in np.linspace(math.pi, math.pi / 2, 4)[1:]:
            prof.append((-DEPTH / 2 + 0.012 + 0.024 * math.cos(a), TOP - 0.012 + 0.024 * math.sin(a) + 0.002))
        for z in np.linspace(-DEPTH / 2 + 0.06, DEPTH / 2 - 0.06, 6):
            prof.append((z, TOP + 0.006))
        prof += [(-z, y) for z, y in reversed(prof[:-6])]
        L_ = [0.0]
        for (z0, y0), (z1, y1) in zip(prof, prof[1:]):
            L_.append(L_[-1] + math.hypot(z1 - z0, y1 - y0))
        rows = []
        for xx in np.linspace(xc - wdt / 2, xc + wdt / 2, 4):
            rows.append([(xx + 0.006 * math.sin(i * 1.7), y, z) for i, (z, y) in enumerate(prof)])
        uv = [[((xx - (xc - wdt / 2)) / wdt, L_[i] / 0.9) for i in range(len(prof))] for xx in np.linspace(xc - wdt / 2, xc + wdt / 2, 4)]
        vs = [[k.vert(p) for p in row] for row in rows]
        for a in range(len(rows) - 1):
            for i in range(len(prof) - 1):
                k.face([vs[a][i], vs[a][i + 1], vs[a + 1][i + 1], vs[a + 1][i]], [uv[a][i], uv[a][i + 1], uv[a + 1][i + 1], uv[a + 1][i]], M["cloth"])
    k.tint_gradient(0.82, 1.0, 0.0, TOP)
    ob = k.finish(smooth_deg=50)
    K.export([ob], f"game/props/{name}.glb")
    print("TABLE", {"name": name, "length": length, "top": TOP, "depth": DEPTH})
    return ob


def book():
    K.reset()
    M = {
        "cover": K.Mat("M_BookCover", tex=K.image("book_cloth", K.linen(64, 64, 161, threads=24)), rough=0.95),
        "paper": K.Mat("M_Paper", tex=K.image("book_pages", paper_tex()), rough=1.0),
    }
    k = K.Kit("study-book")
    W2, Dd, CT = 0.37, 0.48, 0.012                    # half the open width, the depth, the board thickness
    # Covers: two boards open flat, a rounded spine between them.
    for s in (-1, 1):
        k.rbox((s * (W2 / 2 + 0.004), CT / 2, 0), (W2 - 0.002, CT, Dd), 0.004, M["cover"], "#4f6a55", segs=1)
    k.lathe((0, 0.0, -Dd / 2), [(0.012, 0.0), (0.012, Dd)], M["cover"], "#45604b", d=(0, 0, 1), n=8)
    # Pages: each half a block whose top curves up from its fore-edge and dips into the gutter.
    for s in (-1, 1):
        ol = []
        for t in np.linspace(0, 1, 10):
            x = s * (0.01 + (W2 - 0.03) * t)
            y = CT + 0.012 + 0.07 * (1 - t) ** 0.8 * t ** 0.35
            ol.append((x, max(y, CT + 0.012)))
        ol += [(s * (W2 - 0.02), CT + 0.001), (s * 0.01, CT + 0.001)]
        if s < 0:
            ol = ol[::-1]
        k.extrude(ol, -Dd / 2 + 0.012, Dd / 2 - 0.012, M["paper"], "#ffffff", bevel=0.0, uv_len=1.0)
    # The page tops: lay the text texture on them (u across the spread, v along the depth).
    for f in k.bm.faces:
        if k.mats[f.material_index] is M["paper"]:
            for lp in f.loops:
                co = lp.vert.co
                lp[k.uv].uv = (0.5 + co.x / (2 * W2), 0.5 - co.y / Dd)
    k.tint_gradient(0.9, 1.0)
    ob = k.finish(smooth_deg=45)
    K.export([ob], "game/props/study-book.glb")
    print("BOOK", {"open": 2 * W2, "depth": Dd})
    return ob


CLASSIC_HALF = (0.47, 0.39)          # the top's half extents (x, z) per table
CLASSIC_DROP = 0.24                  # how far a cloth point hangs below the top's edge
HONEY, HONEY_LEG = "#e3ab63", "#dba25b"


def classic_cloth_tex():
    """Four greens in the cloth's own (corner-on) frame, a fine weave, a darker hem round its edge."""
    h = w = 128
    U, V = K.grid(h, w)
    q = (U >= 0.5).astype(int) + 2 * (V >= 0.5).astype(int)
    pal = np.array([K.arr("#1e8a57"), K.arr("#9ca63b"), K.arr("#a4ab3d"), K.arr("#c8d48e")])
    col = pal[q]
    weave = K.linen(h, w, 181, "#ffffff", threads=40)
    hem = smooth(0.045, 0.02, np.minimum(np.minimum(U, 1 - U), np.minimum(V, 1 - V)))
    col = col * (1 - 0.28 * hem[..., None])
    return np.clip(col * weave / 0.9, 0, 1)


def classic_unit(k, M, ux):
    """One classic table centred at x = ux: top, four legs, the corner-on cloth."""
    hx, hz = CLASSIC_HALF
    k.rbox((ux, TOP - 0.04, 0), (2 * hx, 0.08, 2 * hz), 0.03, M["wood"], HONEY, uv_len=1.2, uv_off=(0.11 * ux, 0.3))
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = ux + sx * (hx - 0.1), sz * (hz - 0.1)
            k.beam((x, TOP - 0.07, z), (x, 0.0, z), 0.1, 0.1, 0.022, M["wood"], HONEY_LEG, up=(1, 0, 0))
    # The apron under the top, all round between the legs.
    for sz in (-1, 1):
        k.rbox((ux, TOP - 0.11, sz * (hz - 0.1)), (2 * hx - 0.26, 0.07, 0.04), 0.012, M["wood"], HONEY_LEG)
    for sx in (-1, 1):
        k.rbox((ux + sx * (hx - 0.1), TOP - 0.11, 0), (0.04, 0.07, 2 * hz - 0.26), 0.012, M["wood"], HONEY_LEG)
    # The cloth: a square laid corner-on, its four points hanging over the middles of the edges.
    a, b = hx + CLASSIC_DROP, hz + CLASSIC_DROP
    uv = lambda x, z: ((x / a + z / b + 1) / 2, (x / a - z / b + 1) / 2)
    y0 = TOP + 0.004
    zr, xt = b * (1 - hx / a), a * (1 - hz / b)
    # The part lying on the top: the square clipped by the table's edges (each edge's middle too, where a flap's
    # middle column starts).
    flat = [(hx, -zr), (hx, 0), (hx, zr), (xt, hz), (0, hz), (-xt, hz), (-hx, zr), (-hx, 0), (-hx, -zr), (-xt, -hz), (0, -hz), (xt, -hz)]
    c = k.vert((ux, y0 + 0.002, 0))
    vs = [k.vert((ux + x, y0, z)) for x, z in flat]
    for i in range(len(flat)):
        j = (i + 1) % len(flat)
        k.face([c, vs[j], vs[i]], [uv(0, 0), uv(*flat[j]), uv(*flat[i])], M["cloth"])
    # The flaps: over the rounded edge and down to the point. t: how far past the edge along the unfolded cloth.
    roll = [(0.0, 0.0, 0.0), (0.012, 0.008, -0.006), (0.03, 0.013, -0.022)]
    for axis in ("x", "z"):
        for sgn in (-1, 1):
            half_e, run, other = (hx, a, b) if axis == "x" else (hz, b, a)
            rows = []
            for t, dx, dy in roll + [(CLASSIC_DROP * f, 0.013, None) for f in (0.35, 0.7, 1.0)]:
                wdt = other * (1 - (half_e + t) / run)
                out_ = half_e + dx
                y = y0 + dy if dy is not None else y0 - 0.02 - (t - 0.03)
                cols = [0.0] if wdt < 1e-4 else [-wdt, 0.0, wdt]
                row = []
                for c_ in cols:
                    fx, fz = (sgn * (half_e + t), c_) if axis == "x" else (c_, sgn * (half_e + t))
                    gx, gz = (sgn * out_, c_) if axis == "x" else (c_, sgn * out_)
                    row.append((k.vert((ux + gx, y, gz)), uv(fx, fz)))
                rows.append(row)
            for r0, r1 in zip(rows[:-1], rows[1:]):
                if len(r1) == 1:
                    for i in range(len(r0) - 1):
                        k.face([r0[i][0], r0[i + 1][0], r1[0][0]], [r0[i][1], r0[i + 1][1], r1[0][1]], M["cloth"])
                    continue
                for i in range(len(r0) - 1):
                    k.face([r0[i][0], r0[i + 1][0], r1[i + 1][0], r1[i][0]], [r0[i][1], r0[i + 1][1], r1[i + 1][1], r1[i][1]], M["cloth"])


def classic(name, units):
    K.reset()
    M = {
        "wood": K.Mat("M_ClassicWood", tex=K.image("classic_grain", K.grain(256, 256, 183, "#ffffff", knots=2, contrast=0.14)), rough=0.85),
        "cloth": K.Mat("M_ClassicCloth", tex=K.image("classic_cloth", classic_cloth_tex()), rough=1.0),
    }
    k = K.Kit(name)
    for ux in units:
        classic_unit(k, M, ux)
    k.tint_gradient(0.8, 1.0, 0.0, TOP)
    ob = k.finish(smooth_deg=50)
    K.export([ob], f"game/props/{name}.glb")
    print("CLASSIC", {"name": name, "units": units, "top": TOP})
    return ob


if __name__ == "__main__":
    out = ARGS[ARGS.index("review") + 1] if "review" in ARGS else None
    builds = [("study-table-long", lambda: table("study-table-long", 2.0, (0.0,))), ("study-table", lambda: table("study-table", 1.0, (0.0,))), ("study-book", book),
              ("study-table-classic-long", lambda: classic("study-table-classic-long", (-0.49, 0.49))), ("study-table-classic", lambda: classic("study-table-classic", (0.0,)))]
    if "classic" in ARGS:
        builds = [b for b in builds if "classic" in b[0]]
    for nm, make in builds:
        ob = make()
        if out:
            K.review([ob], os.path.join(out, f"{nm}.png"))
