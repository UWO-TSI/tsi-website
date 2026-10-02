"""Zone 1's attack effects (design sheet "Mobs, zone 1"): painted flipbooks in their own atlas, beside the movement pack.

  python3 art/fx/build_mob_pack.py

Writes
  web/public/assets/fx/mob-pack.webp            the atlas: one row per sprite, 8 frames of 128 px, lossless
  web/lib/game/fx/mobPack.ts                    its layout for the engine (generated: edit the SPRITES list here)
  specs/evidence/mobs-z1/mob-pack-sheet.webp    every row tinted as the game tints it, over the outskirts' grass

Same brushwork as the movement pack (build_pack.py's painters and helpers, imported, so the two read as one hand):
near-neutral value that the engine tints per mob, alpha carries the shape, every random choice seeded. Anime-style
where the attack calls for it (claw slashes drawn on in a stroke, impact stars, rune glyphs), soft and painted where it
doesn't (spores, pollen, the poison puddle, the shockwave's dust ring).
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import build_pack as bp
from build_pack import CELL, FRAMES, PX, U, V, colour, fbm, over, puff, ss, stroke, vnoise

ROOT = bp.ROOT
OUT_ATLAS = os.path.join(ROOT, "web", "public", "assets", "fx", "mob-pack.webp")
OUT_TS = os.path.join(ROOT, "web", "lib", "game", "fx", "mobPack.ts")
OUT_SHEET = os.path.join(ROOT, "specs", "evidence", "mobs-z1", "mob-pack-sheet.webp")


def spores(t):
    """The mushroom's spore burst: a lumpy cloud thick with spore specks, breaking up as it drifts."""
    return puff(t, 2101, lobes=6, spread=(0.34, 0.24), base_r=0.22, grow=0.6, lo=0.78, warmth=0.5, specks=16)


def pollen(t):
    """A pollen sprite's burst: a soft golden cloud shedding bright motes."""
    return puff(t, 2202, lobes=7, spread=(0.3, 0.26), base_r=0.24, grow=0.7, rise=0.2, lo=0.86, warmth=0.7, specks=20)


def rune_spark(t):
    """A rune glyph flashing where a bolt lands or a wisp blinks: a stroke and two ticks, drawn on, flared, then fading."""
    on = ss(0, 0.3, t)
    k = np.linspace(0, 1, 30)
    A = np.zeros((CELL, CELL))
    s = 0.9 + 0.25 * ss(0, 0.5, t)
    for (x0, y0, x1, y1) in ((0, -0.55, 0, 0.6), (0, 0.1, 0.32, 0.42), (0, -0.15, -0.32, -0.47)):
        xs, ys = (x0 + (x1 - x0) * k * on) * s, (y0 + (y1 - y0) * k * on) * s
        a, _ = stroke(list(zip(xs, ys)), 0.075 * np.sin(np.pi * np.clip(k, 0.05, 0.95)) ** 0.4, 2301, dry=0.05 + 0.5 * t, taper_soft=2.0)
        A = np.maximum(A, a)
    rays, _ = bp.sparkle(min(0.99, t * 1.3))
    A = np.maximum(A, rays * 0.8 * (1 - ss(0.4, 0.8, t)))
    A *= 1 - ss(0.7, 1.0, t)
    return A, colour(np.ones_like(U), 0.4)


def rune_circle(t):
    """The circle a wisp blinks through: a ring drawn round, six glyph ticks on it, turning, then thinning away."""
    rot = t * 1.2
    ang = np.linspace(0, math.tau, 100)
    head = ss(0, 0.35, t)
    R = 0.72
    ws = 0.05 * np.where(ang / math.tau <= head + 1e-6, 1.0, 0.0)
    A, val = stroke(list(zip(np.cos(ang + rot) * R, np.sin(ang + rot) * R)), ws, 2401, dry=0.08 + 0.5 * t, taper_soft=2.0, grain=0.05)
    for j in range(6):
        if j / 6 > head:
            continue
        a = rot + j * math.tau / 6
        pts = [(math.cos(a) * r, math.sin(a) * r) for r in (R - 0.16, R - 0.04)]
        b, _ = stroke(pts, [0.05, 0.03], 2402 + j, dry=0.1 + 0.4 * t)
        A = np.maximum(A, b)
        tick = [(math.cos(a + 0.12) * (R + 0.06), math.sin(a + 0.12) * (R + 0.06)), (math.cos(a + 0.2) * (R + 0.14), math.sin(a + 0.2) * (R + 0.14))]
        c, _ = stroke(tick, [0.035, 0.02], 2420 + j, dry=0.1 + 0.4 * t)
        A = np.maximum(A, c)
    A *= 1 - ss(0.6, 1.0, t)
    return A, colour(np.ones_like(U) * 0.98, 0.4)


def claw_slash(t):
    """A claw sweep, anime-style: three parallel crescents swept on in a stroke, then thinning and eaten from the tail."""
    A = np.zeros((CELL, CELL))
    head, tail = ss(0, 0.28, t), ss(0.3, 1.0, t)
    for j, (r, w) in enumerate(((0.78, 0.09), (0.6, 0.08), (0.43, 0.065))):
        k = np.linspace(0, 1, 50)
        ang = math.pi * (1.05 - 0.9 * k)
        xs, ys = np.cos(ang) * r, np.sin(ang) * r * 0.8 - 0.28
        ws = w * np.sin(np.pi * np.clip(k, 0.02, 0.98)) ** 0.7 * (1 - 0.45 * ss(0.3, 1.0, t))
        ws = np.where((k <= head + 1e-6) & (k >= tail * 0.98), ws, 0)
        a, _ = stroke(list(zip(xs, ys)), ws, 2501 + j, dry=0.04 + 0.35 * t, taper_soft=1.6, grain=0.04)
        A = np.maximum(A, a)
    return A * (1 - ss(0.85, 1, t)), colour(np.ones_like(U), 0.6)


def shock_ring(t):
    """The elder's shockwave seen from above: a thick ring of thrown dust, its rim breaking up as it runs out."""
    r = np.hypot(U, V)
    ang = np.arctan2(V, U)
    R, w = 0.8, 0.17 * (1 - 0.35 * t)
    wob = (fbm(np.cos(ang) * 2 + 5, np.sin(ang) * 2 + 5, 2601, 3) - 0.5) * 0.08
    d = r - R - wob
    band = np.exp(-(d / w) ** 2 * 1.8)
    holes = fbm(ang * 3 + 9, r * 6, 2602, 3)
    A = band * ss(0.1 + 0.6 * t * t, 0.3 + 0.55 * t * t, holes + 0.25) * (1 - ss(0.8, 1, t))
    lit = 0.5 + 0.5 * np.clip(-(np.cos(ang) * 0.5 - np.sin(ang) * 0.62), -1, 1)
    val = 0.8 + 0.2 * lit * (d < 0)
    return np.clip(A, 0, 1), colour(np.clip(val, 0, 1), 0.4)


def puddle(t):
    """A poison puddle from above: goo in a few lobes with a deeper rim, a gloss on the sun's side, bubbles rising and
    popping (the 8 frames loop)."""
    rng = np.random.default_rng(2701)
    field = np.full((CELL, CELL), 9.0)
    for i in range(5):
        a, d = rng.uniform(0, math.tau), rng.uniform(0.1, 0.32) if i else 0
        cx, cy, rr = math.cos(a) * d, math.sin(a) * d, rng.uniform(0.4, 0.52) if i else 0.58
        field = np.minimum(field, np.hypot(U - cx, V - cy) - rr)
    field += (fbm(U * 5 + 3, V * 5 + 1, 2702, 2) - 0.5) * 0.08
    A = ss(PX * 2, -PX * 2, field) * 0.92
    rim = ss(-0.12, 0.0, field)
    gloss = ss(0.22, 0.0, np.hypot(U + 0.22, V - 0.2)) * 0.5
    val = 0.72 - 0.16 * rim + 0.28 * gloss
    for i in range(6):                                     # bubbles: each rises and pops on its own beat round the loop
        bx, by = rng.uniform(-0.38, 0.38), rng.uniform(-0.38, 0.38)
        ph = (t + i / 6) % 1
        br = 0.035 + 0.06 * ph
        ring = np.exp(-((np.hypot(U - bx, V - by) - br) / 0.018) ** 2) * (1 - ss(0.7, 1, ph))
        val = val + ring * 0.25
    return np.clip(A, 0, 1), colour(np.clip(val, 0, 1), 0.3)


def impact(t):
    """An anime impact star: a jagged burst that slams open, then hollows out to its outline and fades."""
    ang = np.arctan2(V, U)
    r = np.hypot(U, V)
    n = 9
    spikes = 0.55 + 0.4 * (np.abs(((ang / math.tau * n) % 1) - 0.5) * 2) ** 2.2
    jag = 1 + 0.12 * np.sin(ang * 23 + 1.3)
    s = 0.35 + 0.65 * ss(0, 0.25, t)
    edge = spikes * jag * 0.9 * s
    inside = ss(edge, edge - PX * 2, r)
    hollow = ss(edge * (0.15 + 0.75 * ss(0.15, 0.8, t)) - PX * 2, edge * (0.15 + 0.75 * ss(0.15, 0.8, t)), r)
    A = inside * hollow * (1 - ss(0.7, 1.0, t))
    return A, colour(np.ones_like(U), 0.5)


def shard(t):
    """Chips thrown from a cracking shell or a slam: a few angular flakes flying out and tumbling."""
    rng = np.random.default_rng(2901)
    A, C = bp.stamp_layer()
    for i in range(6):
        a = rng.uniform(0.15, math.pi - 0.15)
        sp = rng.uniform(0.5, 1.0)
        x = math.cos(a) * sp * (0.1 + 0.75 * t)
        y = -0.2 + math.sin(a) * sp * (0.2 + 0.9 * t) - 1.1 * t * t
        rot = rng.uniform(0, math.tau) + t * rng.uniform(4, 9)
        size = rng.uniform(0.07, 0.12) * (1 - 0.3 * t)
        ca, sa = math.cos(rot), math.sin(rot)
        lx, ly = (U - x) * ca + (V - y) * sa, -(U - x) * sa + (V - y) * ca
        tri = np.maximum(np.abs(lx) * 1.4 + ly * 0.8, -ly * 1.2)          # a chipped triangle
        m = ss(size, size - PX * 1.5, tri) * (1 - ss(0.75, 1.0, t + rng.uniform(-0.1, 0.1)))
        lit = 0.8 + 0.2 * (ly > 0)
        A, C = over(A, C, m, colour(np.full_like(U, lit), 0.3))
    return A, C


# name, painter, what it is (one row each). Append only: rows are indices in the engine.
SPRITES = [
    ("spores", spores, "spore burst (the mushroom)"),
    ("pollen", pollen, "pollen burst (a sprite)"),
    ("mote", bp.sparkle, "bright mote (pollen, spores, glints)"),
    ("runeSpark", rune_spark, "rune glyph spark (bolts, blinks)"),
    ("runeCircle", rune_circle, "blink circle (lies on the ground)"),
    ("slash", claw_slash, "claw slash, three crescents"),
    ("shockRing", shock_ring, "shockwave dust ring (lies on the ground)"),
    ("puddle", puddle, "poison puddle (lies on the ground, loops)"),
    ("impact", impact, "impact star (pounce, charge)"),
    ("shard", shard, "shell chips"),
]
SHEET = {
    "spores": ("#b6e06a", "#6f8f5c"), "pollen": ("#ffe27a", "#6f8f5c"), "mote": ("#fff2b0", "#3f5a3a"),
    "runeSpark": ("#7ff0ff", "#3f5a3a"), "runeCircle": ("#a6e6f2", "#6f8f5c"), "slash": ("#ffe9c8", "#6f8f5c"),
    "shockRing": ("#e2d6c0", "#8fa16c"), "puddle": ("#7fbf3f", "#8fa16c"), "impact": ("#fff7e8", "#6f8f5c"), "shard": ("#7a5b45", "#8fa16c"),
}


def build():
    atlas = np.zeros((len(SPRITES) * CELL, FRAMES * CELL, 4))
    for r, (name, fn, _) in enumerate(SPRITES):
        for i in range(FRAMES):
            a, rgb = fn(i / FRAMES)
            a, rgb = np.clip(a, 0, 1), np.clip(rgb, 0, 1)
            a[:2, :] = a[-2:, :] = 0
            a[:, :2] = a[:, -2:] = 0
            if a.max() < 0.05:
                raise SystemExit(f"empty frame: {name} {i}")
            atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL, :3] = rgb
            atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL, 3] = a
        print(f"  {name:10s} row {r}")
    img = Image.fromarray((atlas * 255 + 0.5).astype(np.uint8), "RGBA")
    os.makedirs(os.path.dirname(OUT_ATLAS), exist_ok=True)
    img.save(OUT_ATLAS, "WEBP", lossless=True, quality=100, method=6, exact=True)
    print("wrote", OUT_ATLAS, os.path.getsize(OUT_ATLAS) // 1024, "KB")
    names = ",\n".join(f"  {n}: {{ row: {r}, frames: {FRAMES} }} /* {d} */" for r, (n, _, d) in enumerate(SPRITES))
    open(OUT_TS, "w").write(f'''// Generated by art/fx/build_mob_pack.py: do not edit (change the SPRITES list there and rebuild).
/** Zone 1's attack effects (design sheet "Mobs, zone 1"): one row of {FRAMES} frames per sprite, {CELL} px cells, beside the movement pack. */
export const MOB_PACK_URL = "/assets/fx/mob-pack.webp";
export const MOB_PACK_COLS = {FRAMES};
export const MOB_PACK_ROWS = {len(SPRITES)};
export const MOB_PACK = {{
{names},
}} as const;
export type MobSprite = keyof typeof MOB_PACK;
''')
    print("wrote", OUT_TS)
    label_w, pad = 200, 6
    sheet = Image.new("RGB", (label_w + FRAMES * (CELL + pad) + pad, len(SPRITES) * (CELL + pad) + pad + 30), (11, 14, 20))
    d = ImageDraw.Draw(sheet)
    try:
        font, small = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 13), ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 11)
    except OSError:
        font = small = ImageFont.load_default()
    d.text((pad, 8), "Zone-1 mob effects: painted by art/fx/build_mob_pack.py, 8 frames per row, tinted as in game", fill=(241, 255, 255), font=font)
    for r, (name, _, desc) in enumerate(SPRITES):
        tint, ground = (bp.hexrgb(c) for c in SHEET[name])
        y = 30 + pad + r * (CELL + pad)
        d.text((pad, y + 40), name, fill=(255, 209, 102), font=font)
        d.text((pad, y + 60), desc[:28], fill=(201, 209, 214), font=small)
        if len(desc) > 28:
            d.text((pad, y + 74), desc[28:56], fill=(201, 209, 214), font=small)
        for i in range(FRAMES):
            cell = atlas[r * CELL:(r + 1) * CELL, i * CELL:(i + 1) * CELL]
            out = np.ones_like(cell[..., :3]) * ground * (1 - cell[..., 3:4]) + cell[..., :3] * tint * cell[..., 3:4]
            sheet.paste(Image.fromarray((out * 255 + 0.5).astype(np.uint8)), (label_w + pad + i * (CELL + pad), y))
    os.makedirs(os.path.dirname(OUT_SHEET), exist_ok=True)
    sheet.save(OUT_SHEET, "WEBP", quality=88, method=6)
    print("wrote", OUT_SHEET)


if __name__ == "__main__":
    build()
