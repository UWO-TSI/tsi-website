"""The island's flying critters, remodelled as ours (game/remodel; David, 2026-10-27): the six butterflies and two
dragonflies that fly in the ambient life (lib/game/ambientFauna.ts) and that players catch (components/game/Critters.tsx),
in place of the dump's (acnh/critters/). Our own shapes: a soft round body, big simple wings drawn as one polar shape a
side, every species told apart by its wing shape and a few bold marks (no fine scales, no copied patterns).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_critters.py

Frame (the same as the dump's, so the game's scales and its wing shader hold): the body along z with the head toward
+z, the wings flat out along +-x at y 0 (AmbientFauna beats every vertex past the hinge, |x| over 7 to 24 % of the span,
up about z), the origin at the body's middle. Authored in game units at the size the ambient life draws each species,
written at 1 / that scale (rkit.export_in_frame) under game/remodel/critters/<name>.glb (the dump's file name, so lib/game/world/active.ts worldModel swaps the folder).
Materials: P_Paint (the body, its colour in COLOR_0) and M_Wings (one 256 x 128 painted atlas shared by every species,
a 64 px tile each, mapped in the wing's own polar frame: u round from the tail side to the head side, v out from the
root), double-sided.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K, PS, export_in_frame  # noqa: E402

TAU, D2R = math.tau, math.pi / 180
TILE, COLS = 64, 4


# ---------------------------------------------------------------- species
# Each butterfly: drawn scale (ambientFauna), half-span (game units, as drawn), fore and hind wing outline R(phi) (phi
# from +x toward the head, degrees; R as a fraction of the half-span), body colour, and its paint (a function of the
# tile's (phi, rho) grid -> rgb).
PHI0, PHI1, SPLIT = -78.0, 82.0, 8.0


def lobe(phi, a, b, peak, r0, r1, rp):
    """A smooth lobe from (a, r0) through (peak, rp) to (b, r1)."""
    if phi <= peak:
        t = (phi - a) / (peak - a)
        return r0 + (rp - r0) * math.sin(t * math.pi / 2)
    t = (phi - peak) / (b - peak)
    return rp + (r1 - rp) * (1 - math.cos(t * math.pi / 2))


def outline_round(fore=1.0, hind=0.78, tail=0.0):
    def R(phi):
        if phi >= SPLIT:
            return lobe(phi, SPLIT, PHI1, 46, 0.62, 0.34, fore)
        r = lobe(phi, PHI0, SPLIT, -30, 0.3, 0.62, hind)
        if tail:
            r += tail * math.exp(-((phi + 58) / 6.0) ** 2)
        return r
    return R


def hexa(h):
    return np.array(K.hexrgb(h))


def paint_tile(fn):
    u = (np.arange(TILE) + 0.5) / TILE
    U, V = np.meshgrid(u, u)
    phi = PHI0 + U * (PHI1 - PHI0)
    return np.clip(fn(phi, V), 0, 1)


def mix(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]


def spot(phi, rho, p0, r0, size):
    d = np.hypot((phi - p0) / 60.0, rho - r0)
    return 1 - K.smooth(size * 0.7, size, d)


def veins(phi, rho, n, width=0.06, start=0.3):
    s = np.abs(np.sin((phi - PHI0) / (PHI1 - PHI0) * math.pi * n))
    return (1 - K.smooth(width * 0.5, width, s)) * K.smooth(start, start + 0.1, rho)


def split_line(phi, width=2.5):
    return 1 - K.smooth(width * 0.5, width, np.abs(phi - SPLIT))


def common(phi, rho):
    c = mix(np.broadcast_to(hexa("#f6f1dc"), phi.shape + (3,)), hexa("#e8e2c4"), K.smooth(0.0, 0.4, 1 - rho))
    tip = K.smooth(0.62, 0.7, rho) * K.smooth(50, 60, phi)
    c = mix(c, hexa("#45434a"), tip)
    c = mix(c, hexa("#45434a"), spot(phi, rho, 32, 0.55, 0.09) + spot(phi, rho, -20, 0.5, 0.07) * 0.8)
    return mix(c, hexa("#cfc7a6"), split_line(phi) * 0.7)


def tiger(phi, rho):
    c = np.broadcast_to(hexa("#f4d86a"), phi.shape + (3,)).copy()
    bands = (np.abs(np.sin((phi - 10) * D2R * 5.2)) < 0.26) * K.smooth(0.15, 0.3, rho) * (phi > SPLIT)
    c = mix(c, hexa("#2b2a2e"), bands.astype(float))
    c = mix(c, hexa("#2b2a2e"), K.smooth(0.0, 0.22, 0.22 - rho))
    edge = K.smooth(0.74, 0.8, rho)
    c = mix(c, hexa("#2b2a2e"), edge)
    dots = (np.abs(np.sin((phi - PHI0) * D2R * 7)) > 0.7) * K.smooth(0.84, 0.87, rho) * (1 - K.smooth(0.93, 0.96, rho))
    c = mix(c, hexa("#f4d86a"), dots.astype(float) * 0.9)
    c = mix(c, hexa("#4f8fd8"), spot(phi, rho, -38, 0.7, 0.07) + spot(phi, rho, -20, 0.72, 0.06))
    c = mix(c, hexa("#e2713f"), spot(phi, rho, -62, 0.72, 0.08))
    return mix(c, hexa("#2b2a2e"), split_line(phi) * 0.8)


def peacock(phi, rho):
    c = np.broadcast_to(hexa("#26282d"), phi.shape + (3,)).copy()
    sheen = K.smooth(0.25, 0.55, rho) * (1 - K.smooth(0.72, 0.82, rho))
    c = mix(c, hexa("#2f9a86"), sheen * np.where(phi < SPLIT, 1.0, 0.45))
    c = mix(c, hexa("#4fb6c9"), spot(phi, rho, -25, 0.5, 0.16) * 0.8)
    c = mix(c, hexa("#d8564a"), spot(phi, rho, -55, 0.78, 0.07) + spot(phi, rho, -35, 0.8, 0.05))
    return c


def agrias(phi, rho):
    c = np.broadcast_to(hexa("#232327"), phi.shape + (3,)).copy()
    red = (phi > SPLIT + 4) * K.smooth(0.18, 0.28, rho) * (1 - K.smooth(0.62, 0.72, rho)) * (1 - K.smooth(62, 72, phi))
    c = mix(c, hexa("#d63a33"), red.astype(float))
    blue = (phi < SPLIT - 4) * K.smooth(0.25, 0.35, rho) * (1 - K.smooth(0.66, 0.74, rho)) * K.smooth(-66, -56, phi)
    c = mix(c, hexa("#3f74d4"), blue.astype(float))
    return c


def monarch(phi, rho):
    c = mix(np.broadcast_to(hexa("#f08a2c"), phi.shape + (3,)), hexa("#f6a446"), K.smooth(0.2, 0.6, rho))
    c = mix(c, hexa("#2a2524"), veins(phi, rho, 5.5, 0.09, 0.15))
    c = mix(c, hexa("#2a2524"), K.smooth(0.76, 0.81, rho) + K.smooth(64, 72, phi) * K.smooth(0.5, 0.6, rho))
    dots = (np.abs(np.sin((phi - PHI0) * D2R * 9)) > 0.72) * K.smooth(0.86, 0.88, rho) * (1 - K.smooth(0.93, 0.95, rho))
    c = mix(c, hexa("#f4efe2"), dots.astype(float))
    c = mix(c, hexa("#f4efe2"), spot(phi, rho, 70, 0.75, 0.05) + spot(phi, rho, 60, 0.8, 0.045))
    return mix(c, hexa("#2a2524"), split_line(phi))


def emperor(phi, rho):
    c = mix(np.broadcast_to(hexa("#2f6fd0"), phi.shape + (3,)), hexa("#6cc4f2"), K.smooth(0.15, 0.6, rho) * (1 - K.smooth(0.65, 0.8, rho)))
    margin = K.smooth(0.8, 0.85, rho) + K.smooth(58, 70, phi) * K.smooth(0.55, 0.65, rho)
    c = mix(c, hexa("#22232a"), np.clip(margin, 0, 1))
    c = mix(c, hexa("#f4efe2"), spot(phi, rho, 66, 0.78, 0.045) + spot(phi, rho, 56, 0.86, 0.04))
    return mix(c, hexa("#244f9c"), split_line(phi) * 0.6)


def dragon_wing(phi, rho):
    """The dragonflies' tile: a pale clear-looking wing with a few veins and a dark mark near the tip."""
    c = mix(np.broadcast_to(hexa("#f1f6f4"), phi.shape + (3,)), hexa("#dde9e8"), K.smooth(0.2, 0.9, rho))
    c = mix(c, hexa("#9fb0ad"), (np.abs(np.sin(rho * 30)) < 0.15) * 0.5)
    return mix(c, hexa("#4b4038"), spot(phi, rho, 0, 0.88, 0.06))


BUTTERFLIES = {
    # name: (drawn scale, half-span, outline, paint, body colour, body length)
    "common-butterfly": (0.065, 0.113, outline_round(0.98, 0.8), common, "#5a5760", 0.075),
    "tiger-butterfly": (0.0375, 0.122, outline_round(1.0, 0.74, tail=0.32), tiger, "#2b2a2e", 0.08),
    "agrias-butterfly": (0.0375, 0.105, outline_round(1.0, 0.82), agrias, "#2a2a30", 0.07),
    "monarch-butterfly": (0.0375, 0.124, outline_round(1.0, 0.76), monarch, "#2a2524", 0.08),
    "peacock-butterfly": (0.0375, 0.122, outline_round(1.0, 0.72, tail=0.36), peacock, "#26282d", 0.08),
    "emperor-butterfly": (0.035, 0.127, outline_round(1.05, 0.84), emperor, "#22232a", 0.085),
}
TILES = list(BUTTERFLIES) + ["dragonfly"]
PAINT = {**{n: v[3] for n, v in BUTTERFLIES.items()}, "dragonfly": dragon_wing}


def atlas():
    rows = math.ceil(len(TILES) / COLS)
    img = np.zeros((rows * TILE, COLS * TILE, 3))
    for i, n in enumerate(TILES):
        r, c = divmod(i, COLS)
        img[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE] = paint_tile(PAINT[n])[::-1]   # row 0 at the top: rho up
    return img, rows


def tile_uv(name, u, v, rows):
    """Tile-local (u, v) in [0, 1] -> atlas uv (inset half a texel)."""
    i = TILES.index(name)
    r, c = divmod(i, COLS)
    e = 0.5 / TILE
    u = e + u * (1 - 2 * e)
    v = e + v * (1 - 2 * e)
    return ((c + u) / COLS, 1 - (r + 1 - v) / rows)


def wing_pair(k, M, name, half, R, root, rows, droop=0.0, n=16, rings=(0.0, 0.4, 0.75, 1.0)):
    """Both wings of one side drawn as one polar shape: rings out from the root (rho) across phi; mirrored to -x."""
    phis = np.linspace(PHI0, PHI1, n)
    for side in (1, -1):
        pts, uvs = [], []
        for rho in rings:
            ring, ruv = [], []
            for j, ph in enumerate(phis):
                r = R(ph) * half * rho
                x = root + math.cos(ph * D2R) * r
                z = math.sin(ph * D2R) * r
                y = -droop * (r / half) ** 2
                ring.append((side * x, y, z))
                ruv.append(tile_uv(name, j / (n - 1), rho, rows))
            pts.append(ring)
            uvs.append(ruv)
        for i in range(len(rings) - 1):
            for j in range(n - 1):
                quad = [pts[i][j], pts[i][j + 1], pts[i + 1][j + 1], pts[i + 1][j]]
                quv = [uvs[i][j], uvs[i][j + 1], uvs[i + 1][j + 1], uvs[i + 1][j]]
                if side < 0:
                    quad, quv = quad[::-1], quv[::-1]
                k.face([k.vert(p) for p in quad], quv, M["wings"])


def body(k, M, col, length, r, head=0.55, eyes=None):
    """A soft body along z: abdomen behind, a round thorax, the head toward +z; two antennae with clubs."""
    L = length
    prof = [(0.0, -L * 0.62), (r * 0.45, -L * 0.58), (r * 0.7, -L * 0.42), (r * 0.82, -L * 0.18), (r * 1.0, 0.0), (r * 1.08, L * 0.12),
            (r * 0.85, L * 0.22), (r * 0.8 * head / 0.55, L * 0.3), (r * 0.62, L * 0.38), (0.0, L * 0.42)]
    k.lathe((0, 0, 0), prof, M["paint"], col, d=(0, 0, 1), n=8)
    if eyes:
        for s in (-1, 1):
            k.blob((s * r * 0.5, r * 0.15, L * 0.33), (r * 0.42, r * 0.42, r * 0.42), M["paint"], eyes, segs=6, rings=4)


def antennae(k, M, col, L, r, club=True):
    for s in (-1, 1):
        path = [(s * r * 0.3, r * 0.4, L * 0.38), (s * r * 1.4, r * 2.2, L * 0.62), (s * r * 2.4, r * 3.4, L * 0.86)]
        k.tube(path, r * 0.09, M["paint"], col, n=4, v_len=1.0)
        if club:
            k.blob(path[-1], (r * 0.24, r * 0.24, r * 0.32), M["paint"], col, segs=5, rings=3)


def mats(img):
    return {"paint": K.Mat("P_Paint", rough=0.6), "wings": K.Mat("M_Wings", tex=K.image("critter_wings", img), rough=0.75, double=True)}


def butterfly(name, img, rows):
    drawn, half, R, _, col, L = BUTTERFLIES[name]
    K.reset()
    M = mats(img)
    k = K.Kit(name)
    r = half * 0.075
    body(k, M, col, L, r)
    antennae(k, M, col, L, r)
    wing_pair(k, M, name, half, R, root=r * 0.7, rows=rows, droop=half * 0.05)
    ob = k.finish(smooth_deg=70)
    export_in_frame(ob, drawn, f"game/remodel/critters/{name}.glb")


DRAGONFLIES = {
    # name: (drawn scale, half-span, body colours (thorax, abdomen, rings), eyes, length)
    "darner-dragonfly": (0.0375, 0.125, ("#5d9a52", "#4f8fd0", "#2c3f5c"), "#3c7ec0", 0.2),
    "red-dragonfly": (0.05, 0.105, ("#b5523c", "#d8483a", "#8a2f26"), "#a63a2e", 0.16),
}


def dragonfly(name, img, rows):
    drawn, half, (thorax, abd, ring), eye, L = DRAGONFLIES[name]
    K.reset()
    M = mats(img)
    k = K.Kit(name)
    r = half * 0.075
    # The long abdomen toward -z in segments, the thorax, the head with two big eyes.
    segs = 6
    for i in range(segs):
        z0 = -L * 0.12 - i * L * 0.11
        k.lathe((0, 0, 0), [(r * 0.62, z0 + 0.002), (r * 0.7, z0 - L * 0.055), (r * 0.62, z0 - L * 0.11 + 0.002)], M["paint"], abd if i % 2 == 0 else PS.shade(abd, 0.9), d=(0, 0, 1), n=6)
        k.lathe((0, 0, 0), [(r * 0.66, z0 - L * 0.1), (r * 0.66, z0 - L * 0.115)], M["paint"], ring, d=(0, 0, 1), n=6)
    k.lathe((0, 0, 0), [(0.0, -L * 0.8), (r * 0.5, -L * 0.79), (r * 0.55, -L * 0.77)], M["paint"], ring, d=(0, 0, 1), n=6)
    k.blob((0, 0, 0.0), (r * 1.15, r * 1.2, L * 0.13), M["paint"], thorax, segs=8, rings=5)
    for s in (-1, 1):
        k.blob((s * r * 0.75, r * 0.3, L * 0.17), (r * 0.95, r * 0.95, r * 0.9), M["paint"], eye, segs=8, rings=5)
    # Four long wings, a pair a side, straight out and a little swept, from the thorax.
    for zc, sweep, length in ((L * 0.05, 8, 1.0), (-L * 0.04, -6, 0.94)):
        for side in (1, -1):
            n = 10
            ts = np.linspace(0, 1, n)
            w = half * 0.2
            top, bot = [], []
            for t in ts:
                x = r * 0.8 + t * half * length
                z = zc + math.tan(sweep * D2R) * (x - r)
                ww = w * math.sin(math.pi * min(1.0, 0.12 + t * 0.95)) ** 0.6
                top.append((side * x, 0.0, z + ww * 0.35))
                bot.append((side * x, 0.0, z - ww * 0.65))
            for j in range(n - 1):
                quad = [top[j], top[j + 1], bot[j + 1], bot[j]]
                quv = [tile_uv("dragonfly", 0.6, ts[j], rows), tile_uv("dragonfly", 0.6, ts[j + 1], rows),
                       tile_uv("dragonfly", 0.4, ts[j + 1], rows), tile_uv("dragonfly", 0.4, ts[j], rows)]
                if side < 0:
                    quad, quv = quad[::-1], quv[::-1]
                k.face([k.vert(p) for p in quad], quv, M["wings"])
    ob = k.finish(smooth_deg=70)
    export_in_frame(ob, drawn, f"game/remodel/critters/{name}.glb")


if __name__ == "__main__":
    img, rows = atlas()
    for name in list(BUTTERFLIES) + list(DRAGONFLIES):
        (butterfly if name in BUTTERFLIES else dragonfly)(name, img, rows)
