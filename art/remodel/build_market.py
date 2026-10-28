"""The wharf market's barrels and carts, remodelled as ours (game/remodel; David, 2026-10-27), in place of the dump's
pirate barrel (acnh/furniture/barrel.glb) and countdown stall (acnh/props/market-cart.glb) the new world sets along the
market (web/data/world: ten barrels at scale about 0.07, four carts at 0.55).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_market.py

Writes, in the old models' frames (rkit.export_in_frame), so the map's scales, PROP_FOOTPRINT and PROP_TOP still hold:
  game/props/market-barrel.glb  a round-bellied lidded barrel of warm staves in tones, four dark iron hoops riding the
                                curve, a planked lid and a bung on its side; 0.82 tall, 0.34 round at the belly and 0.27
                                at the ends as drawn (the old: 11.66 by 4.85 in its units, drawn at 0.07).
  game/props/market-cart.glb    a long timber market cart on two big spoked wheels and two legs, a planked bed, crates of
                                fish on ice and of fruit, a striped awning (4.0 by 1.1, 1.56 tall as drawn; the old:
                                7.54 by 2.06, 2.84 tall in its units, drawn at 0.55).
Plain colour on the shared presets (P_Wood, P_Metal, P_Paint, P_Cloth), the colour in COLOR_0: no textures.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import ARGS, K, PS, export_in_frame  # noqa: E402

TAU = math.tau
BARREL_DRAWN = 0.07


def market_barrel():
    """Round 2 (David: "i want shape to be more round, stay closer to reference"): a full belly that swells smoothly
    from narrow ends (the ends 0.8 of the belly, a sine curve over nine rings and twenty staves), the hoops riding it."""
    K.reset()
    M = PS.presets("wood", "metal", "paint")
    k = K.Kit("market-barrel")
    h, R, end, n = 0.816, 0.335, 0.268, 20
    rad = lambda y: end + (R - end) * math.sin(math.pi * min(1.0, max(0.0, y / h)))
    prof = [(rad(h * i / 8), h * i / 8) for i in range(9)]
    staves = k.lathe((0, 0, 0), prof, M["wood"], PS.WOOD, n=n, phase=0.0)
    tones = (PS.WOOD, PS.shade(PS.WOOD, 0.92), PS.shade(PS.WOOD, 1.04), PS.shade(PS.WOOD, 0.96))
    PS.recolor(k, staves, lambda x, y, z: tones[int((math.atan2(z, x) / TAU + 1) * n) % 4])
    # The lid: sunk a little inside the chime (the staves' rim), its three planks told apart by tone.
    lid_y = h - 0.03
    k.lathe((0, 0, 0), [(end - 0.004, h), (end - 0.024, h - 0.004), (end - 0.026, lid_y)], M["wood"], PS.DARKW, n=n)
    lid = k.lathe((0, 0, 0), [(end - 0.026, lid_y), (0.0, lid_y)], M["wood"], PS.LIGHTW, n=n)
    PS.recolor(k, lid, lambda x, y, z: (PS.shade(PS.LIGHTW, 0.9), PS.LIGHTW, PS.shade(PS.LIGHTW, 0.95))[min(2, int((x + end) / (2 * end) * 3))])
    # Four dark iron hoops riding the curve: one at each chime and one each side of the belly.
    for y0, w in ((0.03, 0.05), (h * 0.27, 0.042), (h * 0.73 - 0.042, 0.042), (h - 0.08, 0.05)):
        r0, r1 = rad(y0), rad(y0 + w)
        k.lathe((0, 0, 0), [(r0 - 0.004, y0), (r0 + 0.009, y0 + 0.008), (r1 + 0.009, y0 + w - 0.008), (r1 - 0.004, y0 + w)], M["metal"], "#5a5650", n=n)
    # A bung on the belly, toward +z.
    k.lathe((0, h * 0.5, R - 0.004), [(0.034, 0.0), (0.03, 0.02), (0.0, 0.022)], M["wood"], PS.DARKW, d=(0, 0, 1), n=8)
    k.tint_gradient(0.8, 1.0, 0.0, h)
    ob = k.finish(smooth_deg=40)
    export_in_frame(ob, BARREL_DRAWN, "game/props/market-barrel.glb")


CART_DRAWN = 0.55
FISH = ("#7fa7b8", "#c9705a", "#e2b84e", "#8fae7a")


def fish_pile(k, M, c, w, d, n, seed):
    """Fish laid on a bed of ice: plump bodies with a tail, a few colours, crossing each other."""
    rng = np.random.default_rng(seed)
    x, y, z = c
    k.rbox((x, y + 0.02, z), (w, 0.04, d), 0.0, M["paint"], "#e8f2f2", segs=1)
    for i in range(n):
        fx, fz = x + (i - (n - 1) / 2) * w * 0.3, z + rng.uniform(-d * 0.12, d * 0.12)
        yaw = rng.uniform(-0.35, 0.35)
        L = rng.uniform(0.24, 0.3)
        col = FISH[(i + seed) % len(FISH)]
        R = K.game_rot(yaw=yaw)
        k.blob((fx, y + 0.07, fz), (L * 0.2, L * 0.15, L * 0.5), M["paint"], col, segs=6, rings=3, rot=R)
        b, t1, t2 = (R @ K.Vector(v) for v in ((0, 0, -L * 0.45), (0, L * 0.14, -L * 0.72), (0, -L * 0.14, -L * 0.72)))
        k.face([k.vert((fx + b.x, y + 0.07 + b.y, fz + b.z)), k.vert((fx + t1.x, y + 0.07 + t1.y, fz + t1.z)), k.vert((fx + t2.x, y + 0.07 + t2.y, fz + t2.z))],
               [(0, 0), (1, 0), (1, 1)], M["paint"], PS.shade(col, 0.85))


def open_crate(k, M, c, w, h, d):
    """A plain open crate: a floor and four boards."""
    x, y, z = c
    k.rbox((x, y + 0.015, z), (w, 0.03, d), 0.0, M["wood"], PS.shade(PS.WOOD, 0.85), segs=1)
    for sz in (-1, 1):
        k.rbox((x, y + h / 2, z + sz * (d / 2 - 0.012)), (w, h, 0.024), 0.0, M["wood"], PS.WOOD, segs=1)
    for sx in (-1, 1):
        k.rbox((x + sx * (w / 2 - 0.012), y + h / 2, z), (0.024, h, d - 0.048), 0.0, M["wood"], PS.shade(PS.WOOD, 0.93), segs=1)


def wheel(k, M, c, r, w):
    """A spoked cart wheel in the x-y plane (its axle along z)."""
    x, y, z = c
    rim = [(x + math.cos(a) * r, y + math.sin(a) * r, z) for a in [TAU * i / 14 for i in range(14)]]
    k.tube(rim, w * 0.5, M["wood"], PS.DARKW, n=4, v_len=1.0, closed_path=True)
    for i in range(3):
        a = TAU * i / 6
        k.tube([(x - math.cos(a) * r, y - math.sin(a) * r, z), (x + math.cos(a) * r, y + math.sin(a) * r, z)], w * 0.2, M["wood"], PS.WOOD, n=3, v_len=1.0)
    k.lathe((x, y, z), [(0.0, -w * 0.7), (w * 0.6, -w * 0.6), (w * 0.6, w * 0.6), (0.0, w * 0.7)], M["metal"], "#3f3a36", d=(0, 0, 1), n=6)


def market_cart():
    """A long timber market cart on two big spoked wheels and two legs: a planked bed with a rail, crates of fish on ice
    and of fruit, a striped awning on four posts. As drawn: 4.0 long (x), 1.1 deep (z), 1.56 tall, inside the old
    footprint (3.77 by 1.03 in its units: 2.07 by 0.57 as drawn) and under its PROP_TOP (2.84: 1.56)."""
    K.reset()
    M = PS.presets("wood", "metal", "paint", "cloth")
    k = K.Kit("market-cart")
    X, Z, BED = 1.96, 0.42, 0.62
    for sz in (-1, 1):
        wheel(k, M, (0.95, 0.42, sz * (Z + 0.08)), 0.4, 0.07)
        k.beam((-1.7, 0.0, sz * (Z - 0.06)), (-1.7, BED - 0.08, sz * (Z - 0.06)), 0.07, 0.07, 0.0, M["wood"], PS.DARKW, segs=1)
    k.beam((0.95, 0.42, -Z - 0.1), (0.95, 0.42, Z + 0.1), 0.06, 0.06, 0.0, M["metal"], "#3f3a36", segs=1)
    # The bed: a deck on a frame, boards in three tones along x, a low rail round it.
    k.rbox((0, BED - 0.06, 0), (2 * X, 0.08, 2 * Z + 0.06), 0.0, M["wood"], PS.DARKW, segs=1)
    for i in range(3):
        z = -Z + (i + 0.5) * (2 * Z) / 3
        k.rbox((0, BED, z), (2 * X - 0.02, 0.04, 2 * Z / 3 - 0.012), 0.0, M["wood"], (PS.WOOD, PS.shade(PS.WOOD, 0.9), PS.LIGHTW)[i], segs=1)
    for sz in (-1, 1):
        k.beam((-X, BED + 0.1, sz * Z), (X, BED + 0.1, sz * Z), 0.05, 0.06, 0.0, M["wood"], PS.WOOD, segs=1)
    for sx in (-1, 1):
        k.beam((sx * X, BED + 0.1, -Z), (sx * X, BED + 0.1, Z), 0.05, 0.06, 0.0, M["wood"], PS.WOOD, segs=1)
    # Four posts up to the awning, sloping it toward +z.
    for sx in (-1, 1):
        for sz, top in ((-1, 1.5), (1, 1.36)):
            k.beam((sx * (X - 0.04), BED - 0.04, sz * (Z - 0.02)), (sx * (X - 0.04), top, sz * (Z - 0.02)), 0.06, 0.06, 0.0, M["wood"], PS.DARKW, segs=1)
    # On the bed: two crates of fish on ice, one of oranges, one of apples.
    for x, kind, seed in ((-1.38, "fish", 3), (-0.46, "fish", 5), (0.46, "orange", 7), (1.38, "apple", 9)):
        open_crate(k, M, (x, BED + 0.02, 0.0), 0.8, 0.15, 0.68)
        if kind == "fish":
            fish_pile(k, M, (x, BED + 0.05, 0.0), 0.72, 0.6, 3, seed)
        else:
            cols = [PS.ORANGE, PS.shade(PS.ORANGE, 1.08)] if kind == "orange" else [PS.APPLE, PS.shade(PS.APPLE, 1.12)]
            fruit_heap(k, M, (x, BED + 0.05, 0.0), 0.32, 0.26, 0.1, cols, 6, seed)
    # The awning: stripes front to back, a scalloped valance at the front.
    nx = 10
    xs = [-X - 0.04 + (2 * X + 0.08) * j / nx for j in range(nx + 1)]
    back, front = (1.54, -Z - 0.08), (1.38, Z + 0.14)
    for j in range(nx):
        a, b = xs[j], xs[j + 1]
        col = PS.TEAL if j % 2 == 0 else PS.CREAM
        k.quad([(a, back[0], back[1]), (b, back[0], back[1]), (b, front[0], front[1]), (a, front[0], front[1])], M["cloth"], col)
        m = (a + b) / 2
        k.face([k.vert((a, front[0], front[1])), k.vert((b, front[0], front[1])), k.vert((b, front[0] - 0.1, front[1] + 0.01)),
                k.vert((m, front[0] - 0.17, front[1] + 0.012)), k.vert((a, front[0] - 0.1, front[1] + 0.01))],
               [(0, 0), (1, 0), (1, 1), (0.5, 1), (0, 1)], M["cloth"], col)
    k.tint_gradient(0.84, 1.0, 0.0, 1.56)
    ob = k.finish(smooth_deg=40)
    export_in_frame(ob, CART_DRAWN, "game/props/market-cart.glb")


def fruit_heap(k, M, c, rx, rz, h, cols, n, seed, r=0.075):
    """The plaza set's heap of fruit (build_plaza_set.fruit_heap) at a lighter count: a low mound and n fruits on it."""
    rng = np.random.default_rng(seed)
    x, y, z = c
    k.blob((x, y, z), (rx, h, rz), M["paint"], PS.shade(cols[0], 0.85), segs=8, rings=3, seed=seed, lumpy=0.15, flat_bottom=0.0)
    for i in range(n):
        a, t = rng.uniform(0, TAU), math.sqrt(rng.uniform(0, 0.75))
        k.blob((x + math.cos(a) * rx * t, y + h * math.sqrt(max(0.0, 1 - t * t)) + r * 0.3, z + math.sin(a) * rz * t), (r, r * 0.92, r),
               M["paint"], cols[i % len(cols)], segs=6, rings=4, seed=seed + i)


if __name__ == "__main__":
    # `-- barrel` or `-- cart` builds one (the cart is approved: rebuild it only on purpose).
    for part in ARGS or ("barrel", "cart"):
        {"barrel": market_barrel, "cart": market_cart}[part]()
