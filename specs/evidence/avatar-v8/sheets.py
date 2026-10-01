"""Tile the avatar v8 milestone-1 evidence (shots.mjs PNGs, before and after) into the review sheets (Pillow).

  python3 specs/evidence/avatar-v8/sheets.py <after_dir> <before_dir>

The before shots ran shots.mjs against the previous engine and catalogue (c0555593: v7 locks, matte), the after shots
against this branch; both under the same bench, creator camera and village camera. Writes next to this script:
  01-before-after-creator.webp   bob, long and short (the reworked styles) front, 3/4 and back, before | after, head
                                 close-ups and the creator's full-body stage distance
  02-before-after-game.webp      the game camera at village distance (pixel filter as shipped), before | after
  03-new-types.webp              the afro and box braids front, 3/4 and back (brown and black), full body, and the real
                                 character creator's stage for all five styles
  04-hair-accessories.webp       claw clip, bow and scrunchie on several styles, and at village distance
  05-remodeled.webp              the beanie and the backpack on short, long and curly hair, before | after
  06-closeups.webp               one large cell per style, before | after: the strands, the soft masses, the tips
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

A, B = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
BG, INK = (250, 246, 238), (70, 55, 40)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
except OSError:
    FONT = ImageFont.load_default()


def cells(path, n, cols=None, h=None, aspect=1.0):
    """The n cells of a bench grid sheet (padding 8, gap 8 css px at 2x; cells `aspect` tall per wide; labels under
    each row take 2 x 22 px)."""
    im = Image.open(path).convert("RGB")
    cols = cols or n
    w = (im.width - 32 - 16 * (cols - 1)) / cols
    ch = w * aspect
    out = []
    for i in range(n):
        r, c = divmod(i, cols)
        x, y = 16 + c * (w + 16), 16 + r * (ch + 16 + 44)
        out.append(im.crop((round(x), round(y), round(x + w), round(y + ch))))
    return [c.resize((round(c.width * h / c.height), h), Image.LANCZOS) for c in out] if h else out


def village(path, h=300, wide=600, tall=500):
    """The player at village distance: a crop round the character (centre of the 2x screenshot)."""
    im = Image.open(path).convert("RGB")
    cx, cy = 1440, 1120
    c = im.crop((cx - wide // 2, cy - tall + 170, cx + wide // 2, cy + 170))
    return c.resize((round(c.width * h / c.height), h), Image.LANCZOS)


def creator(path, h=420):
    im = Image.open(path).convert("RGB")
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def gap(w=24, h=10):
    return Image.new("RGB", (w, h), BG)


def grid(rows, labels, title, name, pad=12, head=34):
    w = max(sum(i.width for i in r) + pad * (len(r) - 1) for r in rows) + 2 * pad
    h = sum(max(i.height for i in r) + head for r in rows) + pad * (len(rows) + 1) + 40
    out = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(out)
    d.text((pad, 10), title, fill=INK, font=FONT)
    y = 40 + pad
    for r, lab in zip(rows, labels):
        d.text((pad, y + 4), lab, fill=INK, font=FONT)
        y += head
        x = pad
        for im in r:
            out.paste(im, (x, y))
            x += im.width + pad
        y += max(i.height for i in r) + pad
    if out.width > 2600:
        out = out.resize((2600, round(out.height * 2600 / out.width)), Image.LANCZOS)
    out.save(os.path.join(HERE, name), "WEBP", quality=80, method=6)
    print("WROTE", name, out.size, os.path.getsize(os.path.join(HERE, name)) // 1024, "KB")


# 01: before | after at creator distance
hb, ha = cells(f"{B}/turn-milestone.png", 9, h=330), cells(f"{A}/turn-milestone.png", 9, h=330)
bb, ba = cells(f"{B}/turn-body.png", 9, aspect=4 / 3, h=380), cells(f"{A}/turn-body.png", 9, aspect=4 / 3, h=380)
rows, labels = [], []
for k, s in enumerate(("bob", "long", "short")):
    rows.append(hb[3 * k:3 * k + 3] + [gap()] + ha[3 * k:3 * k + 3])
    labels.append(f"{s}: before (v7 locks, matte) front, 3/4, back  |  after (v8 organic)")
for k, s in enumerate(("bob", "long", "short")):
    rows.append(bb[3 * k:3 * k + 3] + [gap()] + ba[3 * k:3 * k + 3])
    labels.append(f"{s} at the creator's full-body distance: before | after")
grid(rows, labels, "Avatar v8 milestone 1: the reworked styles, before | after (same bench, creator camera and lights)",
     "01-before-after-creator.webp")

# 02: before | after at game distance
rows, labels = [], []
for pair in (("bob", "long", "short"), ("beanie", "backpack", "backpack-away")):
    rows.append([village(f"{d}/village-{s}.png") for s in pair for d in (B, A)])
    labels.append("  |  ".join(f"{s}: before, after" for s in pair))
grid(rows, labels, "Game camera at village distance (pixel filter as shipped): before | after", "02-before-after-game.webp")

# 03: the new types
t, tk = cells(f"{A}/turn-types.png", 6, h=330), cells(f"{A}/turn-types-black.png", 6, h=330)
tb = cells(f"{A}/turn-types-body.png", 6, aspect=4 / 3, h=380)
rows = [t[:3] + [gap()] + tk[:3], t[3:] + [gap()] + tk[3:], tb,
        [creator(f"{A}/creator-{s}-34.png") for s in ("bob", "long", "short", "afro", "braids")],
        [village(f"{A}/village-{s}.png") for s in ("afro", "braids")]]
labels = ["afro (curly fringe + afro): front, 3/4, back  |  black hair", "box braids (braided front + box braids): front, 3/4, back  |  black hair",
          "afro and box braids at the creator's full-body distance", "the real character creator: bob, long, short, afro, box braids",
          "village distance: afro, box braids"]
grid(rows, labels, "New types (milestone 1): afro and box braids, as bangs and back pieces in the same system", "03-new-types.webp")

# 04: hair accessories
hc = cells(f"{A}/hacc.png", 12, cols=6, h=330)
rows = [hc[:4], hc[4:8], hc[8:], [village(f"{A}/village-{s}.png") for s in ("bow", "scrunchie")]]
labels = ["claw clip: bob (crown), long (crown), high pony (pony base), bun (bun)",
          "bow: bob (side, above the ear), pigtails (both ties), afro (side), box braids (side)",
          "scrunchie: high pony, pigtails (both), twin buns (both), bun; a bob, long or short style has no tie, so it hides",
          "village distance: bow on the bob, scrunchie on the high pony"]
grid(rows, labels, "Hair accessories on the styles' anchors (claw clip, bow, scrunchie)", "04-hair-accessories.webp")

# 05: the remodeled beanie and backpack
bn_b, bn_a = cells(f"{B}/beanie.png", 4, cols=6, h=330), cells(f"{A}/beanie.png", 6, h=330)
bp_b, bp_a = cells(f"{B}/backpack.png", 4, cols=6, aspect=4 / 3, h=380), cells(f"{A}/backpack.png", 6, aspect=4 / 3, h=380)
rows = [bn_b[:2] + [gap()] + bn_a[:2], bn_b[2:4] + [gap()] + bn_a[2:4], bn_a[4:6],
        bp_b[:2] + [gap()] + bp_a[:2], bp_b[2:4] + [gap()] + bp_a[2:4], bp_a[4:6]]
labels = ["beanie on short hair, front and back: before | after (knit ribs, rolled ribbed cuff, slouch, fluffy pompom)",
          "beanie on long hair: before | after", "beanie on curly hair (the afro, new): front and back",
          "backpack on short hair, back 3/4 and side: before | after (padded body, soft flap, puffy pocket, padded straps)",
          "backpack on long hair: before | after", "backpack on curly hair (the afro, new)"]
grid(rows, labels, "Remodeled accessories (milestone 1): the beanie and the backpack", "05-remodeled.webp")

# 06: close-ups, before | after
one = lambda d, n: Image.open(f"{d}/closeup-{n}.png").convert("RGB").crop((16, 16, 856, 856)).resize((560, 560), Image.LANCZOS)
pairs = [("bob-34", "long-34", "short-34"), ("bob-back", "long-back")]
rows = [[one(d, n) for n in pairs[0][:2] for d in (B, A)], [one(d, pairs[0][2]) for d in (B, A)] + [one(d, n) for n in pairs[1][:1] for d in (B, A)],
        [one(d, pairs[1][1]) for d in (B, A)]]
labels = ["bob 3/4: before, after  |  long 3/4: before, after", "short 3/4: before, after  |  bob back: before, after", "long back: before, after"]
grid(rows, labels, "Close-ups (one 420 px cell, 2x): soft masses, the painted strands, tapered tips, matte", "06-closeups.webp")
