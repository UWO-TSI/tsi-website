"""Interiors evidence sheets (specs/polish/interiors.md): before | after pairs, day and night, frame strips and crops,
from the PNGs shoot.mjs writes. Refuses a blank or missing tile (a uniform frame is an empty tile), except the door
fade's frames in a transition strip, which are labelled as the fade.

  python3 specs/evidence/polish-interiors/sheets.py <before_dir> <after_dir> <out_dir>
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

BEFORE, AFTER, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
except OSError:
    FONT = ImageFont.load_default()


def tile(path, w, crop=None, fade=False):
    """The tile, and whether it is the door fade's (uniform dark): only allowed where `fade` says so."""
    if not os.path.exists(path):
        raise SystemExit(f"missing tile: {path}")
    im = Image.open(path).convert("RGB")
    if crop:
        im = im.crop(crop)
    st = ImageStat.Stat(im.convert("L"))
    blank = st.stddev[0] < 4
    if blank and not (fade and st.mean[0] < 40):
        raise SystemExit(f"blank tile: {path} (stddev {st.stddev[0]:.1f})")
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS), blank


def label(im, text, bottom=False):
    d = ImageDraw.Draw(im)
    x, y = 12, 10
    if bottom:
        y = im.height - 10 - (d.textbbox((0, 0), text, font=FONT)[3])
    box = d.textbbox((x, y), text, font=FONT)
    d.rectangle((box[0] - 8, box[1] - 5, box[2] + 8, box[3] + 5), fill=(28, 24, 20))
    d.text((x, y), text, font=FONT, fill=(255, 246, 226))
    return im


def grid(rows, w, name, fade=False, bottom=False):
    """rows: [[(path, label, crop?), ...], ...] laid out at width w per tile; `fade`: a transition strip; `bottom`: the
    labels along the bottom (where the top of the tile is the subject's)."""
    def one(p, t, crop=None):
        im, dark = tile(p, w, crop, fade)
        return label(im, f"{t} · the fade" if dark else t, bottom)
    tiles = [[one(*cell) for cell in row] for row in rows]
    cols = max(len(r) for r in tiles)
    hs = [max(t.height for t in r) for r in tiles]
    sheet = Image.new("RGB", (cols * w + (cols - 1) * 6, sum(hs) + (len(hs) - 1) * 6), (16, 14, 12))
    y = 0
    for r, h in zip(tiles, hs):
        for i, t in enumerate(r):
            sheet.paste(t, (i * (w + 6), y))
        y += h + 6
    path = os.path.join(OUT, f"{name}.webp")
    sheet.save(path, "WEBP", quality=82, method=6)
    print("sheet", path, sheet.size)


B = lambda n: os.path.join(BEFORE, f"{n}.png")
A = lambda n: os.path.join(AFTER, f"{n}.png")
F = lambda n, k: os.path.join(AFTER, f"{n}-{k:02d}.png")


def strip(name, frames, ms, crop=None, title=""):
    """One row of a frame strip (shoot.mjs strip=<n>:<ms>), each frame timed from the first as its file was written:
    a capture can outlast the nominal <ms>, so the real spacing is longer."""
    t0 = os.path.getmtime(F(name, 0))
    return [(F(name, k), f"{title}+{os.path.getmtime(F(name, k)) - t0:.2f} s", crop) for k in frames]


if __name__ == "__main__":
    W = 720
    rooms = (("hq", "HQ"), ("oracle", "Oracle temple"), ("museum", "Museum"), ("home", "Your house"))
    # Open this first: every room after, by day and at night.
    grid([[(A(f"{r}-day"), f"{t} · day"), (A(f"{r}-night"), f"{t} · night")] for r, t in rooms], W, "00-rooms-day-night")
    for i, (room, title) in enumerate(rooms, 1):
        grid([[(B(f"{room}-day"), f"{title} · day · before"), (A(f"{room}-day"), f"{title} · day · after")],
              [(B(f"{room}-night"), f"{title} · night · before"), (A(f"{room}-night"), f"{title} · night · after")]], W, f"0{i}-{room}-before-after")
    grid([[(B("shop"), "Shop (lab bench) · before"), (A("shop"), "Shop (lab bench) · after")]], W, "05-shop-before-after")
    grid([[(A("hq-day"), "HQ · day"), (A("hq-evening"), "HQ · evening: lamps coming up"), (A("hq-night"), "HQ · night")]], 600, "06-hq-through-the-day")
    # The keepers greeting you as you come in: a wave, the line, the talking mouth, turned to you.
    KEEP = {"hq": (760, 160, 1400, 540), "oracle": (300, 40, 940, 420), "museum": (600, 160, 1240, 540), "shop": (352, 60, 992, 440)}
    grid([strip("hq-greet", (1, 2, 3, 5, 8), 450, KEEP["hq"], "Wren · HQ · "),
          strip("oracle-greet", (1, 2, 3, 5, 8), 450, KEEP["oracle"], "Sable · temple · "),
          strip("museum-greet", (1, 2, 3, 5, 8), 450, KEEP["museum"], "Odile · museum · "),
          strip("shop-greet", (3, 5, 6, 8, 10), 450, KEEP["shop"], "Toren · shop · ")], 400, "07-keepers-greeting", bottom=True)
    grid([[(A("hq-desk"), "HQ · Wren behind the new front desk, turned to you", (560, 280, 1000, 620)),
           (A("hq-night"), "HQ · night: the desk lamp", (960, 300, 1340, 560))]], 700, "08-hq-front-desk")
    TANKS = (340, 280, 820, 500)
    grid([strip("museum-tanks", (0, 1, 2, 3), 500, TANKS, "Aquarium · ")], 480, "09-museum-tanks")
    ALTAR = (480, 170, 960, 530)
    grid([strip("oracle-altar", (0, 1, 2, 3), 350, ALTAR, "Crystal and candles · night · ")], 480, "10-oracle-altar")
    CLOCK = (740, 40, 900, 330)
    grid([strip("hq-clock", (0, 1, 2), 500, CLOCK, "HQ clock · ")], 320, "11-hq-clock")
    FIT = (560, 360, 720, 560)
    grid([strip("fitting-enter", (0, 1, 2, 3), 100, FIT, "E, in · "),
          strip("fitting-exit", (0, 1, 2, 3), 120, FIT, "Escape, out · ")], 320, "12-fitting-room", bottom=True)
    grid([strip("oracle-enter", (0, 1, 2, 3, 4, 5), 200, None, "Into the temple · "),
          strip("oracle-enter", (6, 8, 10, 12, 14, 15), 200, None, "Into the temple · ")], 480, "13-transition-enter-temple", fade=True)
    grid([strip("hq-escape", (0, 1, 2, 3, 4, 5), 200, None, "Escape in the HQ · "),
          strip("hq-escape", (6, 7, 8, 10, 12, 13), 200, None, "Escape in the HQ · ")], 480, "14-transition-escape-hq", fade=True)
