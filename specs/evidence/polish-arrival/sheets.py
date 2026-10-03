"""Arrival, wharf and home pier evidence sheets (specs/polish/arrival-wharf.md), from the PNGs shoot.mjs writes (trip
frames labelled with their phase and time from frames.json). Refuses a missing or blank tile (a uniform frame is an
empty tile), except under the trip's veil, where the frame is the veil and is labelled so.

  python3 specs/evidence/polish-arrival/sheets.py <shots_dir> <out_dir>
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

SHOTS, OUT = sys.argv[1:3]
os.makedirs(OUT, exist_ok=True)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 20)
except OSError:
    FONT = ImageFont.load_default()
FRAMES = json.load(open(os.path.join(SHOTS, "frames.json"))) if os.path.exists(os.path.join(SHOTS, "frames.json")) else {}
VEILED = {"veil", "load"}


def tile(name, w, crop=None, veil=False):
    path = os.path.join(SHOTS, f"{name}.png")
    if not os.path.exists(path):
        raise SystemExit(f"missing tile: {path}")
    im = Image.open(path).convert("RGB")
    if crop:
        im = im.crop(crop)
    st = ImageStat.Stat(im.convert("L"))
    blank = st.stddev[0] < 4
    if blank and not veil:
        raise SystemExit(f"blank tile: {path} (stddev {st.stddev[0]:.1f})")
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS), blank


def label(im, text):
    d = ImageDraw.Draw(im)
    box = d.textbbox((12, 10), text, font=FONT)
    d.rectangle((box[0] - 8, box[1] - 5, box[2] + 8, box[3] + 5), fill=(28, 24, 20))
    d.text((12, 10), text, font=FONT, fill=(255, 246, 226))
    return im


def sheet(rows, w, name, title=None):
    """rows: [[(png name, label, crop, veil?), ...], ...] at width w per tile."""
    tiles = []
    for row in rows:
        out = []
        for cell in row:
            n, text = cell[0], cell[1]
            crop = cell[2] if len(cell) > 2 else None
            veil = cell[3] if len(cell) > 3 else False
            im, blank = tile(n, w, crop, veil)
            out.append(label(im, f"{text} · under the veil" if blank else text))
        tiles.append(out)
    cols = max(len(r) for r in tiles)
    hs = [max(t.height for t in r) for r in tiles]
    top = 40 if title else 0
    img = Image.new("RGB", (cols * w + (cols - 1) * 6, top + sum(hs) + (len(hs) - 1) * 6), (16, 14, 12))
    if title:
        ImageDraw.Draw(img).text((12, 9), title, font=FONT, fill=(255, 209, 102))
    y = top
    for r, h in zip(tiles, hs):
        for i, t in enumerate(r):
            img.paste(t, (i * (w + 6), y))
        y += h + 6
    path = os.path.join(OUT, f"{name}.webp")
    img.save(path, "WEBP", quality=82, method=6)
    print("sheet", path, img.size)


def strip(key, per_row, w, name, title):
    frames = FRAMES[key]
    cells = [(f["file"], f"{i + 1}. {f['phase']} +{f['t']:.2f} s", None, f["phase"] in VEILED) for i, f in enumerate(frames)]
    sheet([cells[i:i + per_row] for i in range(0, len(cells), per_row)], w, name, title)


if __name__ == "__main__":
    W = 640
    if os.path.exists(os.path.join(SHOTS, "wharf-day-out.png")):
        rows = []
        if os.path.exists(os.path.join(SHOTS, "before-wharf-yaw180.png")):
            rows.append([("before-wharf-yaw180", "before · the old box pier, its rail on the land end"), ("before-wharf-yaw0", "before · from the sea")])
        rows += [[("wharf-day-out", "after · day, out along it"), ("wharf-day-boat", "after · day, the boat moored"), ("wharf-day-sea", "after · day, from the sea")],
                 [("wharf-night-out", "after · night"), ("wharf-night-boat", "after · night, the lantern lit"), ("wharf-night-sea", "after · night, from the sea")]]
        sheet(rows, W, "01-wharf", "The wharf: the modelled pier, the rope rail, the end rail at the tip, the boat on its lines, the buoys")
    if os.path.exists(os.path.join(SHOTS, "home-day-out.png")):
        sheet([[("home-day-out", "home pier · day"), ("home-day-boat", "home pier · day, the boat")],
               [("home-night-out", "home pier · night"), ("home-night-boat", "home pier · night")]], W, "02-home-pier",
              "The home island's pier at HOME_DOCK: the same pier and boat, the sign and the floating label gone")
    if "trip-out" in FRAMES:
        strip("trip-out", 6, 480, "03-trip-village-to-home", "The trip, village to home: walk, step aboard, cast off, swing round, out to sea, the veil while home loads, in, alongside, ashore")
    if "trip-back" in FRAMES:
        strip("trip-back", 6, 480, "04-trip-home-to-village", "The trip back, home to the village")
    if "first" in FRAMES:
        frames = FRAMES["first"]
        cells = [(f["file"], f"{i + 1}. {f['phase']} +{f['t']:.2f} s", None, f["phase"] in VEILED) for i, f in enumerate(frames)]
        cells.append(("first-greeting", f"{len(cells) + 1}. ashore: Wren greets you"))
        sheet([cells[i:i + 5] for i in range(0, len(cells), 5)], 512, "05-first-login-arrival", "A first login arrives by boat at the village wharf, then the HQ lead's greeting")
    if "creator" in FRAMES:
        cells = [("creator-pre", "1. the creator over the loaded island: That's me")]
        cells += [(f["file"], f"{i + 2}. {f['phase']} +{f['t']:.2f} s", None, f["phase"] in VEILED) for i, f in enumerate(FRAMES["creator"])]
        cells.append(("creator-greeting", f"{len(cells) + 1}. ashore: Wren greets you"))
        sheet([cells[i:i + 5] for i in range(0, len(cells), 5)], 512, "05b-first-login-from-the-creator",
              "A first login from the character creator: the veil comes up over the island, the boat brings you in, Wren greets you")
    if "skip" in FRAMES:
        cells = [("skip-pre", "sailing out: Space")] + [(f["file"], f"{f['phase']} +{f['t']:.2f} s", None, f["phase"] in VEILED) for f in FRAMES["skip"]]
        sheet([cells], 480, "06-skip", "One press skips the rest: a quick veil, and you stand on the next island's pier")
    if os.path.exists(os.path.join(SHOTS, "target-night-200.png")):
        crop = (240, 160, 1200, 740)
        sheet([[("target-night-70", "night · landing (70 ms)", crop), ("target-night-200", "night · landed on the slope", crop), ("target-night-650", "night · walking up to it", crop)],
               [("target-day-70", "day · landing", crop), ("target-day-200", "day · landed on the slope", crop), ("target-day-650", "day · walking up to it", crop)],
               [("target-touch", "a real tap on a touch screen", crop)]], 540, "07-move-target",
              "The move target: the pack's painted marker lying on the bank's slope, lit like the ground (dim at night), landing soft")
