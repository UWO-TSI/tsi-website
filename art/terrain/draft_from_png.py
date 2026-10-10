#!/usr/bin/env python3
"""
Terrain draft from David's drawing (specs/references/terrain/terrainv1.png).

Converts the painted map draft into a village-map document the game loads.
His drawing sets placement and overall shape (David 2026-10-09: "the picture
i sent was only an idea, of the placement, overall shape"); on top of it this
develops the terrain for the game's feel:
- Rolling ground: value-noise swells lift the inland grass, and every
  non-extreme height difference tapers off as a walkable slope (his rule).
- The mountain is terraced to level 8 (the cap, "very exaggerated"): tiers
  2/4/6/8, 2-level kit-cliff faces between them and at the foot, one carved
  trail climbing the west face so the summit is walkable without ramps.
- A river run falls from the summit's edge tier to tier into a pond recessed
  in the level-2 terrace (waterfalls derive from the drops).
- Small islands grow into the sea until each holds playable ground.
Dark green is HEIGHT only inside the mountain ("Mountain, dark determine
height"); elsewhere it is forest and stays ground (trees are an object pass).

Output: web/data/terrain-v2-draft.json (+ a top-down preview PNG).
Tune the constants, re-run, re-look. python3 art/terrain/draft_from_png.py
"""
import json
import numpy as np
from PIL import Image, ImageFilter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "specs/references/terrain/terrainv1.png"
OUT = ROOT / "web/data/terrain-v2-draft.json"
PREVIEW = ROOT / "art/terrain/draft-preview.png"

# Scale pass 3 (David: "could be more exaggerated and bigger"): 3x linear over
# the first draft, 552 cells east-west over 2360 px -> 384x552, ~36x today's land.
DEPTH = 552                       # cz rows, z axis (east -z .. west +z)
PX = 2360 / DEPTH                 # image px per cell
WIDTH = round(1640 / PX)          # cx cols, x axis (north -x .. south +x)

# Surfaces (lib/game/grid.ts, persisted values)
GRASS, SOIL, STONE, SAND, WOOD, BRICK, RIVER, VOID, RAMP = range(9)

# Drawing swatches (probed)
SWATCH = {
    "sea":     (90, 97, 175),
    "grass":   (132, 164, 88),
    "dark1":   (108, 136, 69),   # plateau shading
    "dark2":   (66, 89, 35),     # forest trees / mountain body
    "blue":    (67, 95, 116),    # ponds, falls, rivers on land
    "beach":   (214, 214, 145),
    "brown":   (146, 78, 43),    # village dots, bridges, wharf strokes -> underlying land
    "text":    (20, 20, 20),
}
CLASS_OF = list(SWATCH.keys())
# What each swatch means for terrain. brown/text melt into grass.
BASE_SURFACE = {"sea": RIVER, "grass": GRASS, "dark1": GRASS, "dark2": GRASS,
                "blue": RIVER, "beach": SAND, "brown": GRASS, "text": GRASS}

MOUNTAIN_MIN_BLOB = 7200          # cells: the mountain is the one huge dark2 blob
MOUNTAIN_TOP = 8                  # summit tier (the level cap, 6u: "very exaggerated, 8+ blocks")
TERRACE_CUTS = (2.6, 4.4, 6.2)    # continuous height below these -> tiers 2, 4, 6; above -> 8
TRAIL_R = 3                       # half-width of the carved summit trail (cells)
HILL_TOP = 2                      # rolling ground rises this high off the mountain
HILL_SCALE = (44, 15)             # noise feature sizes (cells): broad swells + small rises
FALL_R = 1                        # the peak waterfall run's half-width (cells)
POND_R = 5                        # the pond it lands in, on the level-2 terrace
MIN_ISLAND = 36                   # drop land specks smaller than this (cells)
MIN_LAKE = 18                     # fill inland sea specks smaller than this
ISLET_MIN = 150                   # a surviving island grows into the sea until it holds this
ISLET_RINGS = 6                   # how many rings of growth a small island may take

# Bridge marks in his drawing (image px) and the deck's crossing direction.
BRIDGES = [((900, 575), 0.0), ((1185, 500), 0.35)]
SPAWN_PX = (925, 980)             # just south of the village dots

# Zone notes for the painter: name, colour, centre (image px), radius (cells).
# The plains disc also clamps the rolling hills flat: combat ground stays open.
ZONES = [
    ("Village (re-plan)", "#C98F73", (925, 900), 30),
    ("Plains biome: combat later", "#B4C96B", (1000, 330), 48),
    ("Islands biome: boat later", "#7BAE8C", (390, 990), 30),
    ("Ruins in forest", "#6F6A62", (1400, 1030), 30),
    ("Mountain", "#8B8778", (1800, 780), 36),
    ("Cave mouth", "#4A4440", (1640, 760), 9),
    ("Wharf", "#B98C60", (968, 1068), 12),
    ("Beach", "#E4CD96", (700, 760), 18),
]


def zone_disc(name):
    """The zone's cells as a boolean grid."""
    _, _, (px_x, px_y), r = next(z for z in ZONES if z[0].startswith(name))
    cx0, cz0 = cell_of_px(px_x, px_y)
    m = np.zeros((WIDTH, DEPTH), dtype=bool)
    for cx in range(max(0, cx0 - r), min(WIDTH, cx0 + r + 1)):
        for cz in range(max(0, cz0 - r), min(DEPTH, cz0 + r + 1)):
            if (cx - cx0) ** 2 + (cz - cz0) ** 2 <= r * r:
                m[cx, cz] = True
    return m


def cell_of_px(px_x, px_y):
    """Image pixel -> (cx, cz). Top = north = cx 0; right = east = cz 0."""
    cx = min(WIDTH - 1, int(px_y / PX))
    cz = min(DEPTH - 1, int((2360 - px_x) / PX))
    return cx, cz


def world_of_cell(cx, cz):
    return (cx - WIDTH // 2, cz - DEPTH // 2)


WATER_WINS = 0.25  # a cell is water once this fraction of its pixels are (keeps the thin channel open)

# The drawn channel's centreline (image px): dug open as sea even where the
# downsample loses it, so the strait always reads and the bridges always cross water.
CHANNEL = [(620, 455), (760, 515), (900, 570), (1050, 545), (1185, 500), (1300, 425)]
CHANNEL_R = 3  # cells either side of the line


def classify(im):
    """Per-pixel nearest-swatch class, downsampled to cells by majority with water priority.

    Mean-colour sampling closed the drawn channel wherever it ran thinner than
    a cell; majority voting with a water override keeps it open. Returns the
    class grid and each cell's mean luminance (the mountain height signal).
    """
    im = im.filter(ImageFilter.MedianFilter(5))
    a = np.asarray(im, dtype=np.float32)
    sw = np.array([SWATCH[k] for k in CLASS_OF], dtype=np.float32)
    px_cls = ((a[:, :, None, :] - sw[None, None, :, :]) ** 2).sum(-1).argmin(-1)
    lum = a.mean(-1)
    sea_i, blue_i, text_i = (CLASS_OF.index(k) for k in ("sea", "blue", "text"))
    # Label text is not shading: left in, the letters carve glyph-shaped tiers
    # into the mountain (darkness is the height signal).
    lum[px_cls == text_i] = np.nan

    cls = np.zeros((WIDTH, DEPTH), dtype=np.int64)
    cell_lum = np.zeros((WIDTH, DEPTH), dtype=np.float32)
    n_cls = len(CLASS_OF)
    for cx in range(WIDTH):
        y0, y1 = int(cx * PX), max(int(cx * PX) + 1, int((cx + 1) * PX))
        for cz in range(DEPTH):
            x1 = 2360 - int(cz * PX)
            x0 = min(x1 - 1, 2360 - int((cz + 1) * PX))
            block = px_cls[y0:y1, x0:x1].ravel()
            counts = np.bincount(block, minlength=n_cls)
            counts[text_i] = 0                               # labels never decide a cell
            water = counts[sea_i] + counts[blue_i]
            if water >= WATER_WINS * max(1, counts.sum()):
                cls[cx, cz] = sea_i if counts[sea_i] >= counts[blue_i] else blue_i
            else:
                cls[cx, cz] = counts.argmax()
            block_lum = lum[y0:y1, x0:x1]
            cell_lum[cx, cz] = np.nanmean(block_lum) if not np.isnan(block_lum).all() else np.nan
    cell_lum[np.isnan(cell_lum)] = np.nanmean(cell_lum)                    # all-text cells: neutral height
    return cls, cell_lum


def components(mask):
    """4-connected components of a boolean grid: label array + sizes."""
    lab = np.zeros(mask.shape, dtype=np.int32)
    sizes = [0]
    n = 0
    for sx in range(mask.shape[0]):
        for sz in range(mask.shape[1]):
            if not mask[sx, sz] or lab[sx, sz]:
                continue
            n += 1
            stack = [(sx, sz)]
            lab[sx, sz] = n
            size = 0
            while stack:
                x, z = stack.pop()
                size += 1
                for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    tx, tz = x + dx, z + dz
                    if 0 <= tx < mask.shape[0] and 0 <= tz < mask.shape[1] \
                            and mask[tx, tz] and not lab[tx, tz]:
                        lab[tx, tz] = n
                        stack.append((tx, tz))
            sizes.append(size)
    return lab, np.array(sizes)


def despeckle(cls):
    # Blue is water here too: a grass sliver inside the waterfall fan renders as
    # a one-cell island once blue becomes river, so it must drown with the rest.
    sea_i, blue_i, grass_i = (CLASS_OF.index(k) for k in ("sea", "blue", "grass"))
    water = (cls == sea_i) | (cls == blue_i)
    lab, sizes = components(~water)
    cls[np.isin(lab, np.flatnonzero(sizes < MIN_ISLAND)) & ~water] = sea_i  # tiny land specks -> sea
    water = (cls == sea_i) | (cls == blue_i)
    lab, sizes = components(water)
    cls[np.isin(lab, np.flatnonzero(sizes < MIN_LAKE)) & water] = grass_i   # water pinholes -> grass
    return cls


def dilate4(mask):
    out = mask.copy()
    out[1:] |= mask[:-1]; out[:-1] |= mask[1:]
    out[:, 1:] |= mask[:, :-1]; out[:, :-1] |= mask[:, 1:]
    return out


def grow_islets(cls):
    """Every island that survives despeckle gets playable ground: a small one
    dilates into the sea (rings of grass) until it holds ISLET_MIN cells.
    Blue is water, same as despeckle: blue label specks must not seed islands."""
    sea_i, blue_i, grass_i = (CLASS_OF.index(k) for k in ("sea", "blue", "grass"))
    lab, sizes = components(~((cls == sea_i) | (cls == blue_i)))
    for comp in np.flatnonzero((sizes > 0) & (sizes < ISLET_MIN)):
        mask = lab == comp
        for _ in range(ISLET_RINGS):
            if mask.sum() >= ISLET_MIN:
                break
            ring = dilate4(mask) & (cls == sea_i)
            cls[ring] = grass_i
            mask |= ring
    return cls


def dig_channel(cls):
    """Force the drawn strait open: sea cells along the centreline."""
    sea_i = CLASS_OF.index("sea")
    for (ax, ay), (bx, by) in zip(CHANNEL, CHANNEL[1:]):
        steps = int(max(abs(bx - ax), abs(by - ay)) / 4) + 1
        for i in range(steps + 1):
            px_x, px_y = ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps
            cx0, cz0 = cell_of_px(px_x, px_y)
            for cx in range(cx0 - CHANNEL_R, cx0 + CHANNEL_R + 1):
                for cz in range(cz0 - CHANNEL_R, cz0 + CHANNEL_R + 1):
                    if 0 <= cx < WIDTH and 0 <= cz < DEPTH:
                        cls[cx, cz] = sea_i
    return cls


def mountain_mask(cls):
    """The one huge dark2 blob (dilated a little so its grassy rim joins in)."""
    d2 = cls == CLASS_OF.index("dark2")
    lab, sizes = components(d2)
    big = np.flatnonzero(sizes >= MOUNTAIN_MIN_BLOB)
    return np.isin(lab, big)


def levels_of(cls, mtn, cell_lum):
    lv = np.zeros(cls.shape, dtype=np.int32)
    lv[cls == CLASS_OF.index("dark1")] = 1                                 # plateau shading -> gentle rise
    if mtn.any():
        # Height inside the mountain: his rule is "dark determine height", so the
        # darkness rank carries most of it; a distance-to-edge cone keeps the rim
        # falling to the coast even where his brush was even.
        dist = np.zeros(cls.shape, dtype=np.float32)
        cur = mtn.copy()
        d = 0
        while cur.any():
            dist[cur] = d
            er = cur.copy()
            er[1:] &= cur[:-1]; er[:-1] &= cur[1:]
            er[:, 1:] &= cur[:, :-1]; er[:, :-1] &= cur[:, 1:]
            cur = er
            d += 1
        peak = max(dist.max(), 1)
        ml = cell_lum[mtn]
        dark = (ml.max() - ml) / max(ml.max() - ml.min(), 1)               # 0 bright rim .. 1 darkest core
        t = 0.65 * dark + 0.35 * (dist[mtn] / peak)
        t = (t - t.min()) / max(t.max() - t.min(), 1e-6)                   # full range, so the core hits the top
        # Terraced, not relaxed: tiers 2 / 4 / 6 / 8 with 2-level cliff faces
        # between them and at the foot ("very exaggerated, like 8+ blocks high").
        h = 1 + (MOUNTAIN_TOP - 1) * t
        tier = np.full(h.shape, MOUNTAIN_TOP, dtype=np.int32)
        for cut, level in zip(reversed(TERRACE_CUTS), (6, 4, 2)):
            tier[h < cut] = level
        lv[mtn] = tier
    rolling_hills(lv, cls, mtn)
    taper(lv, mtn)
    if mtn.any():
        trail = carve_trail(lv, cls, mtn)
        peak_falls(lv, cls, mtn, trail)
    sea = cls == CLASS_OF.index("sea")
    lv[sea] = 0
    # Water on land sits in the ground around it (falls derive from its drops).
    blue = cls == CLASS_OF.index("blue")
    lv[blue] = np.maximum(0, lv[blue] - 1)
    return lv


def value_noise(rng, scale):
    """Smooth 0..1 noise over the cell grid, features about `scale` cells wide."""
    g = rng.random((WIDTH // scale + 2, DEPTH // scale + 2))
    xs, zs = np.arange(WIDTH) / scale, np.arange(DEPTH) / scale
    x0, z0 = xs.astype(int), zs.astype(int)
    fx, fz = xs - x0, zs - z0
    fx, fz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)                # smoothstep: curved blends
    top = g[x0][:, z0] * (1 - fz) + g[x0][:, z0 + 1] * fz
    bot = g[x0 + 1][:, z0] * (1 - fz) + g[x0 + 1][:, z0 + 1] * fz
    return top * (1 - fx[:, None]) + bot * fx[:, None]


def rolling_hills(lv, cls, mtn):
    """The ground curves ("current problem the game is too flat"): seeded value
    noise lifts the inland grass into broad swells up to HILL_TOP, the drawn
    dark1 shading still counts, beaches and the plains combat zone stay low."""
    rng = np.random.default_rng(7)
    f = 0.72 * value_noise(rng, HILL_SCALE[0]) + 0.28 * value_noise(rng, HILL_SCALE[1])
    f = (f - f.min()) / max(f.max() - f.min(), 1e-6)
    hills = np.clip(np.round(f * (HILL_TOP + 0.98) - 0.49), 0, HILL_TOP).astype(np.int32)
    roll = ~mtn & np.isin(cls, [CLASS_OF.index(k) for k in ("grass", "dark1", "dark2", "brown", "text")])
    lv[roll] = np.maximum(lv[roll], hills[roll])
    lv[zone_disc("Plains") & roll] = np.minimum(lv[zone_disc("Plains") & roll], 1)


def taper(lv, mtn):
    """His slope rule: a height difference that is not extreme tapers off as a
    walkable slope. Off the mountain every neighbour step relaxes to one level
    (the engine's height blur then rounds those steps into curves); the
    mountain's terraces keep their cliffs."""
    for _ in range(32):
        clipped = np.minimum.reduce([
            np.pad(lv, ((1, 0), (0, 0)), mode="edge")[:-1],
            np.pad(lv, ((0, 1), (0, 0)), mode="edge")[1:],
            np.pad(lv, ((0, 0), (1, 0)), mode="edge")[:, :-1],
            np.pad(lv, ((0, 0), (0, 1)), mode="edge")[:, 1:],
        ]) + 1
        nxt = np.where(mtn, lv, np.minimum(lv, clipped))
        if (nxt == lv).all():
            break
        lv[:] = nxt


def peak_falls(lv, cls, mtn, trail):
    """The signature fall: a river run from the summit's edge down the south
    face, dropping tier to tier (the engine derives a waterfall at every
    drop), landing in a pond recessed into the level-2 terrace."""
    blue_i = CLASS_OF.index("blue")
    sea_i = CLASS_OF.index("sea")
    summit = mtn & (lv == MOUNTAIN_TOP)
    t2 = mtn & (lv == 2)
    if not summit.any() or not t2.any():
        return
    sx, sz = np.nonzero(summit)
    tx, tz = np.nonzero(t2)
    for cand in np.argsort(-tx)[::8]:                                      # southmost (+x) pond spots first
        px_c, pz_c = int(tx[cand]), int(tz[cand])
        near = int(((sx - px_c) ** 2 + (sz - pz_c) ** 2).argmin())
        ax, az = int(sx[near]), int(sz[near])
        run = []
        n = int(max(abs(px_c - ax), abs(pz_c - az)))
        ok = n > 0
        for i in range(n + 1):
            cx, cz = round(ax + (px_c - ax) * i / n), round(az + (pz_c - az) * i / n)
            for dx in range(-FALL_R, FALL_R + 1):
                for dz in range(-FALL_R, FALL_R + 1):
                    gx, gz = cx + dx, cz + dz
                    if not (0 <= gx < WIDTH and 0 <= gz < DEPTH) or cls[gx, gz] == sea_i:
                        continue
                    if (gx, gz) in trail:
                        ok = False
                    run.append((gx, gz))
        pond = [(px_c + dx, pz_c + dz) for dx in range(-POND_R, POND_R + 1) for dz in range(-POND_R, POND_R + 1)
                if dx * dx + dz * dz <= POND_R * POND_R and 0 <= px_c + dx < WIDTH and 0 <= pz_c + dz < DEPTH
                and cls[px_c + dx, pz_c + dz] != sea_i]
        if not ok or any(c in trail for c in pond):
            continue                                                       # never pour the fall over the trail
        for gx, gz in run:
            cls[gx, gz] = blue_i
        for gx, gz in pond:                                                # the pond, pooled round the landing
            cls[gx, gz] = blue_i
            lv[gx, gz] = 2
        return


def carve_trail(lv, cls, mtn):
    """One walkable pass up the mountain: a corridor from the west foot to the
    summit whose level climbs smoothly along its length, cliff walls either
    side. Per-ring notches broke whenever a tier band fragmented; a single
    carved trail cannot. Trailheads are tried west to east until the corridor
    crosses no water."""
    ground = (cls != CLASS_OF.index("sea")) & (cls != CLASS_OF.index("blue"))
    foot = mtn & dilate4(ground & ~mtn & (lv <= 1))
    summit = mtn & (lv == MOUNTAIN_TOP)
    if not foot.any() or not summit.any():
        return set()
    fx, fz = np.nonzero(foot)
    sx, sz = np.nonzero(summit)
    blue = cls == CLASS_OF.index("blue")
    for pick in np.argsort(-fz):                                           # westmost (+z) first
        ax, az = int(fx[pick]), int(fz[pick])
        near = int(((sx - ax) ** 2 + (sz - az) ** 2).argmin())
        bx, bz = int(sx[near]), int(sz[near])
        ux, uz = bx - ax, bz - az
        length = max(np.hypot(ux, uz), 1.0)
        corridor = {}                                                      # cell -> fraction along the line
        for cx in range(min(ax, bx) - TRAIL_R, max(ax, bx) + TRAIL_R + 1):
            for cz in range(min(az, bz) - TRAIL_R, max(az, bz) + TRAIL_R + 1):
                if not (0 <= cx < lv.shape[0] and 0 <= cz < lv.shape[1]):
                    continue
                s = ((cx - ax) * ux + (cz - az) * uz) / (length * length)
                s = min(1.0, max(0.0, s))
                if np.hypot(cx - (ax + ux * s), cz - (az + uz * s)) <= TRAIL_R:
                    corridor[cx, cz] = s
        if any(blue[c] for c in corridor):
            continue                                                       # a pass through the pond is no pass
        base = 1 if lv[ax, az] > 0 else 0
        for (cx, cz), s in corridor.items():
            if ground[cx, cz]:
                lv[cx, cz] = int(round(base + (MOUNTAIN_TOP - base) * s))
        return set(corridor)
    return set()


def annotate():
    """Zone notes for the painter, cells from his labels (coarse discs)."""
    out = []
    for name, color, (px_x, px_y), r in ZONES:
        cx0, cz0 = cell_of_px(px_x, px_y)
        cells = [[cx, cz] for cx in range(cx0 - r, cx0 + r + 1)
                 for cz in range(cz0 - r, cz0 + r + 1)
                 if (cx - cx0) ** 2 + (cz - cz0) ** 2 <= r * r
                 and 0 <= cx < WIDTH and 0 <= cz < DEPTH]
        out.append({"name": name, "color": color, "cells": cells})
    return out


def main():
    im = Image.open(SRC).convert("RGB")
    cls, cell_lum = classify(im)
    # Dig before despeckling: the strait cut frees label-text slivers from the
    # coast, and despeckle then drowns them before islets grow.
    cls = grow_islets(despeckle(dig_channel(cls)))
    mtn = mountain_mask(cls)
    lv = levels_of(cls, mtn, cell_lum)
    surf = np.vectorize(lambda i: BASE_SURFACE[CLASS_OF[i]])(cls)

    doc = {
        "width": WIDTH, "depth": DEPTH,
        "originX": -(WIDTH // 2), "originZ": -(DEPTH // 2),
        "tile": 1, "levelStep": 0.75,
        "levels": ["".join(str(int(lv[cx, cz])) for cx in range(WIDTH)) for cz in range(DEPTH)],
        "surfaces": ["".join(str(int(surf[cx, cz])) for cx in range(WIDTH)) for cz in range(DEPTH)],
        "annotations": annotate(),
        "objects": [],
    }
    sx, szd = cell_of_px(*SPAWN_PX)
    wx, wz = world_of_cell(sx, szd)
    doc["objects"].append({"id": "default", "kind": "spawn", "x": wx, "z": wz})
    for i, ((px_x, px_y), yaw) in enumerate(BRIDGES):
        cx, cz = cell_of_px(px_x, px_y)
        x, z = world_of_cell(cx, cz)
        doc["objects"].append({"id": f"bridge-{i}", "kind": "bridge", "x": x, "z": z, "yaw": yaw})

    rows = lambda a: "[\n" + ",\n".join("    " + json.dumps(r, separators=(",", ":")) for r in a) + "\n  ]"
    head = ",\n".join(f'  "{k}": {json.dumps(doc[k])}' for k in ("width", "depth", "originX", "originZ", "tile", "levelStep"))
    body = f'  "levels": {rows(doc["levels"])},\n  "surfaces": {rows(doc["surfaces"])},\n' \
           f'  "annotations": {rows(doc["annotations"])},\n  "objects": {rows(doc["objects"])}'
    OUT.write_text("{\n" + head + ",\n" + body + "\n}\n")

    # Top-down preview: class colours shaded by level, world-oriented like the drawing.
    pal = {GRASS: (140, 170, 100), SAND: (222, 208, 150), RIVER: (96, 130, 170)}
    img = np.zeros((WIDTH, DEPTH, 3), dtype=np.uint8)
    for cx in range(WIDTH):
        for cz in range(DEPTH):
            s = int(surf[cx, cz])
            base = pal.get(s, (120, 120, 120))
            if s == RIVER and lv[cx, cz] == 0 and cls[cx, cz] == CLASS_OF.index("sea"):
                base = (84, 90, 160)
            shade = 1 + 0.10 * lv[cx, cz]
            img[cx, cz] = np.clip(np.array(base) * shade, 0, 255)
    Image.fromarray(img[:, ::-1], "RGB").resize((DEPTH * 6, WIDTH * 6), Image.NEAREST).save(PREVIEW)

    land = (surf != RIVER).sum()
    cliff_edges = int(((np.abs(np.diff(lv, axis=0)) > 1).sum() + (np.abs(np.diff(lv, axis=1)) > 1).sum()))
    print(f"{WIDTH}x{DEPTH} cells, {land} land ({land/1434:.1f}x today), levels to {lv.max()}, {cliff_edges} cliff edges")
    print(f"wrote {OUT.relative_to(ROOT)} and {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
