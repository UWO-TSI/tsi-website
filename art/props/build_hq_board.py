"""The member clubhouse's notice board (HQInterior `noticeBoard`, HQ_LAYOUT.board; the homes' "Bulletin board" wall
piece): a cork board in a timber frame with blank pinned cards for the game to fill. Replaces acnh/furniture/
bulletinboard.glb in the member world (the applicant island's clubhouse keeps the dump's).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_hq_board.py [-- review <dir>]

Writes web/public/assets/game/props/hq-notice-board.glb. Frame: like the other remodelled interior pieces
(lib/game/propModels.ts REMODELLED_PIECES), authored at the size the dump piece shows at scale 0.1, so a Piece keeps its
dump scale and draws ours at x 10: 1.554 wide, 0.92 tall, 0.066 deep, the origin at the bottom middle, the face toward +z.

An oak frame with rounded edges and a pencil ledge, a cork face, and on it seven blank cards (plain, ruled, grid, a
kraft tag) pinned at a slant in autumn paper colours, two more hung from a twine with pegs across the top, and a pencil
on the ledge. Two materials: M_HQFrame (grain; COLOR_0 stains it), M_HQCork (an atlas: cork and four blank papers).
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402
from propkit import TAU  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
W, H, D = 1.554, 0.92, 0.066
RAIL = 0.062
CORK_Z = 0.008
OAK, LEDGE = "#a9784b", "#9a6b42"
TILE = {"plain": 3, "ruled": 2, "grid": 1, "kraft": 0}


def tile_uv(name, u, v):
    i = TILE[name]
    m = 4 / 512
    return (0.75 + m + u * (0.25 - 2 * m), i * 0.25 + m + v * (0.25 - 2 * m))


def atlas(h=512, w=512):
    out = np.zeros((h, w, 3))
    out[:, :384] = PK.cork(512, 384, 111, tone="#c99662")
    T = 128
    U, V = K.grid(T, T)
    tiles = {"plain": PK.paper(T, T, 112), "ruled": PK.paper(T, T, 113), "grid": PK.paper(T, T, 114), "kraft": PK.paper(T, T, 115, tone="#c9a77c")}
    rl = np.zeros((T, T))
    for j in range(7):
        rl = np.maximum(rl, K.smooth(0.012, 0.0, np.abs(V - (0.3 + j * 0.1))))
    tiles["ruled"] = PK.paint(tiles["ruled"], rl * 0.6, "#8fb0c8", 0.8)
    tiles["ruled"] = PK.paint(tiles["ruled"], K.smooth(0.012, 0.0, np.abs(V - 0.2)) * 0.8, "#d27a6a", 0.8)
    gl = np.maximum(K.smooth(0.01, 0.0, np.abs((U * 12) % 1 - 0.5) / 12), K.smooth(0.01, 0.0, np.abs((V * 12) % 1 - 0.5) / 12))
    tiles["grid"] = PK.paint(tiles["grid"], gl * 0.5, "#9fb9a4", 0.8)
    hole = np.hypot(U - 0.5, V - 0.14)
    tiles["kraft"] = PK.paint(tiles["kraft"], K.smooth(0.06, 0.05, hole) * K.smooth(0.03, 0.04, hole), "#efe2c4", 0.9)
    for name, i in TILE.items():
        r0 = h - (i + 1) * T
        out[r0:r0 + T, 384:] = tiles[name]
    return out


def build():
    K.reset()
    M = {
        "frame": K.Mat("M_HQFrame", tex=K.image("hq_frame", K.grain(256, 128, 116, "#ffffff", knots=2)), rough=0.9),
        "cork": K.Mat("M_HQCork", tex=K.image("hq_cork", atlas()), rough=0.95),
    }
    rng = np.random.default_rng(1018)
    k = K.Kit("hq-notice-board")
    # The frame: stiles and rails, rounded; a thin back panel behind the cork.
    for x in (-W / 2 + RAIL / 2, W / 2 - RAIL / 2):
        k.rbox((x, H / 2, 0), (RAIL, H, D), 0.012, M["frame"], OAK, segs=1, v_axis=1, uv_off=(0.3 + x, 0.1))
    for y in (RAIL / 2, H - RAIL / 2):
        k.rbox((0, y, 0), (W - 2 * RAIL + 0.004, RAIL, D * 0.92), 0.012, M["frame"], OAK, segs=1, v_axis=0, uv_off=(0.1, 0.4 + y))
    k.rbox((0, H / 2, -D / 2 + 0.01), (W - 0.04, H - 0.04, 0.02), 0.004, M["frame"], "#8a6242", segs=1)
    # The pencil ledge along the bottom rail.
    k.rbox((0, RAIL + 0.006, D / 2 + 0.012), (W - 2 * RAIL - 0.08, 0.014, 0.05), 0.005, M["frame"], LEDGE, segs=1, v_axis=0)
    k.rbox((0, RAIL + 0.02, D / 2 + 0.035), (W - 2 * RAIL - 0.08, 0.02, 0.008), 0.003, M["frame"], LEDGE, segs=1, v_axis=0)
    # The cork face.
    x0, x1, y0, y1 = -W / 2 + RAIL, W / 2 - RAIL, RAIL, H - RAIL
    span_u = 0.73
    k.quad([(x0, y0, CORK_Z), (x1, y0, CORK_Z), (x1, y1, CORK_Z), (x0, y1, CORK_Z)], M["cork"], "#ffffff",
           uvs=((0.01, 0.02), (0.01 + span_u, 0.02), (0.01 + span_u, 0.02 + span_u * (y1 - y0) / (x1 - x0)), (0.01, 0.02 + span_u * (y1 - y0) / (x1 - x0))))
    flat = []
    # Seven blank cards pinned at a slant (tile, centre x, y, w, h, turn, paper colour, pin colour).
    cards = [("ruled", -0.5, 0.56, 0.22, 0.15, -0.05, "#fbf4e4", "#c4472f"), ("plain", -0.22, 0.6, 0.17, 0.2, 0.06, "#f6e2a8", "#4f8a83"),
             ("grid", 0.06, 0.54, 0.2, 0.22, -0.03, "#f8f1e6", "#d9a23a"), ("kraft", 0.32, 0.6, 0.12, 0.2, 0.08, "#ffffff", "#c4472f"),
             ("plain", 0.55, 0.52, 0.19, 0.16, -0.06, "#f1d3c2", "#4f8a83"), ("ruled", -0.38, 0.28, 0.24, 0.17, 0.04, "#e4ebd2", "#d9a23a"),
             ("plain", 0.4, 0.25, 0.22, 0.15, -0.02, "#fbf4e4", "#c4472f")]
    for i, (tile, cx, cy, cw, ch, ang, paper, pin) in enumerate(cards):
        c, s = math.cos(ang), math.sin(ang)
        z = CORK_Z + 0.002 + 0.0008 * i
        corners = [(-cw / 2, -ch / 2), (cw / 2, -ch / 2), (cw / 2, ch / 2), (-cw / 2, ch / 2)]
        span = max(cw, ch)
        k.quad([(cx + x * c - y * s, cy + x * s + y * c, z) for x, y in corners], M["cork"], paper,
               uvs=[tile_uv(tile, 0.5 + x / span, 0.5 + y / span) for x, y in corners])
        px, py = cx - (ch / 2 - 0.018) * s, cy + (ch / 2 - 0.018) * c
        flat += k.blob((px, py, z + 0.008), (0.011, 0.011, 0.008), M["cork"], pin, segs=8, rings=4)
        flat += k.tube([(px, py, z), (px, py, z + 0.006)], 0.0025, M["cork"], "#b9b2a6", n=4)
    # A twine across the top with two cards hung from pegs.
    tw = [(x, H - RAIL - 0.04 - 0.035 * (1 - (2 * x / (W - 2 * RAIL - 0.1)) ** 2), CORK_Z + 0.012) for x in np.linspace(-(W / 2 - RAIL - 0.05), W / 2 - RAIL - 0.05, 9)]
    flat += k.tube(tw, 0.0028, M["cork"], "#c9ad7a", n=4, v_len=0.05)
    for j, (x, paper) in enumerate(((-0.08, "#f6e2a8"), (0.2, "#e4ebd2"))):
        ty = H - RAIL - 0.04 - 0.035 * (1 - (2 * x / (W - 2 * RAIL - 0.1)) ** 2)
        cw, ch = 0.13, 0.1
        z = CORK_Z + 0.014
        corners = [(x - cw / 2, ty - ch - 0.004, z), (x + cw / 2, ty - ch - 0.004, z), (x + cw / 2, ty - 0.004, z), (x - cw / 2, ty - 0.004, z)]
        k.quad(corners, M["cork"], paper, uvs=[tile_uv("plain", u, v) for u, v in ((0.1, 0.15), (0.9, 0.15), (0.9, 0.85), (0.1, 0.85))])
        flat += k.rbox((x, ty - 0.008, z + 0.005), (0.012, 0.04, 0.012), 0.003, M["frame"], "#d8c39c", segs=1)
    # A pencil on the ledge.
    pz = D / 2 + 0.02
    flat += k.tube([(-0.36, RAIL + 0.019, pz), (-0.24, RAIL + 0.019, pz + 0.004)], 0.0055, M["cork"], "#e2b443", n=6, caps=True)
    flat += k.tube([(-0.24, RAIL + 0.019, pz + 0.004), (-0.225, RAIL + 0.019, pz + 0.0045)], 0.0035, M["cork"], "#e8c9a0", n=6, caps=True)
    flat += k.tube([(-0.372, RAIL + 0.019, pz - 0.0004), (-0.36, RAIL + 0.019, pz)], 0.0056, M["cork"], "#d98a8a", n=6, caps=True)
    blank = tile_uv("plain", 0.5, 0.5)
    for f in flat:
        if k.mats[f.material_index] is M["cork"]:
            for lp in f.loops:
                lp[k.uv].uv = blank
    k.tint_gradient(0.88, 1.0)
    ob = k.finish(smooth_deg=50)
    path = K.export([ob], "game/props/hq-notice-board.glb")
    print("HQ_BOARD", {"w": W, "h": H, "d": D})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "hq-board.png"), views=((180, 8), (215, 22), (150, 30)))
