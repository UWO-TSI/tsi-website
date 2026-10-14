"""Tile the head fit evidence (shots.mjs PNGs, Blender renders) into review sheets (Pillow, WebP).

  python3 specs/evidence/head-fit/sheets.py <before_dir> <after_dir> <renders_dir>

<before_dir> and <after_dir> hold shots.mjs's PNGs from the v7 head (7a023cdf) and from this branch; <renders_dir>
holds skull/build_head.py's head renders (head-v8-vs-v7-*.png) and render_lod.py's sheets (lod-*.png). Writes, next
to this script:
  01-head-v8-vs-v7.webp            the head alone, v8 (left of each pair) and v7, front, 3/4 and side
  02-faces-s<skin>.webp            every face option (one cell per mouth, eyes, brows and extras cycling) before | after,
                                   front, 3/4 and side, faces at 1024 (the creator's atlas)
  03-faces-world-s<skin>.webp      the same at 512 (the world's atlas)
  04-library-s<skin>.webp          every bangs, back, hat, band and glasses before | after, front, 3/4 and side
  05-david-s<skin>-h<hair>.webp    David's 21 hairstyles, front, 3/4 and back (after only: new)
  06-creator-*.webp                the real creator: panels before | after, David's hairstyles per colour, turned styles
  07-world.webp                    the game camera at village distance, and the applicant island (shared character)
  08-closeups.webp                 matte close-ups before | after
  09-lod.webp                      every full and LOD 1 head piece side by side (render_lod.py)
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

BEFORE, AFTER, RENDERS = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
BG, INK = (250, 246, 238), (70, 55, 40)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 26)
except OSError:
    FONT = ImageFont.load_default()
SKINS = ("1", "5", "10")


def load(d, name, w=None):
    p = os.path.join(d, name + ".png")
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert("RGB")
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if w else im


def grid(rows, title, out, width=3600):
    """rows: [(label, [images])]; images side by side under each label, rows stacked."""
    rows = [(l, [i for i in ims if i is not None]) for l, ims in rows]
    rows = [(l, ims) for l, ims in rows if ims]
    if not rows:
        print("skip", out)
        return
    scaled = []
    for label, ims in rows:
        w_each = (width - 20 * (len(ims) + 1)) // len(ims)
        scaled.append((label, [i.resize((w_each, round(i.height * w_each / i.width)), Image.LANCZOS) for i in ims]))
    h = 70 + sum(48 + max(i.height for i in ims) + 20 for _, ims in scaled)
    sheet = Image.new("RGB", (width, h), BG)
    d = ImageDraw.Draw(sheet)
    d.text((20, 20), title, fill=INK, font=FONT)
    y = 70
    for label, ims in scaled:
        d.text((20, y), label, fill=INK, font=FONT)
        y += 48
        x = 20
        for im in ims:
            sheet.paste(im, (x, y))
            x += im.width + 20
        y += max(i.height for i in ims) + 20
    sheet.save(os.path.join(HERE, out), "WEBP", quality=82, method=6)
    print("sheet", out, sheet.size)


grid([(v, [load(RENDERS, f"head-v8-vs-v7-{v}")]) for v in ("front", "34", "side")],
     "The head: v8 (left of each pair, the rounded box with the flat face) and v7 (right)", "01-head-v8-vs-v7.webp", 2400)
VIEWS = (("front", "front"), ("34", "3/4"), ("side", "side"))
for s in SKINS:
    grid([(f"{lab}: before (v7 head) | after (v8 head)", [load(BEFORE, f"facekit-s{s}-{v}"), load(AFTER, f"facekit-s{s}-{v}")]) for v, lab in VIEWS],
         f"Every face option, skin {s}, creator atlas (1024)", f"02-faces-s{s}.webp")
    grid([(f"{lab}: before | after", [load(BEFORE, f"facekit512-s{s}-{v}"), load(AFTER, f"facekit512-s{s}-{v}")]) for v, lab in VIEWS],
         f"Every face option, skin {s}, world atlas (512)", f"03-faces-world-s{s}.webp")
    grid([(f"{lab}: before | after", [load(BEFORE, f"hairkit-s{s}-{v}"), load(AFTER, f"hairkit-s{s}-{v}")]) for v, lab in VIEWS]
         + [("back: after", [load(AFTER, f"hairkit-s{s}-back")])],
         f"Every bangs, back, hat, band and glasses, skin {s}", f"04-library-s{s}.webp")
    for hcol in ("1", "6", "11"):
        grid([(lab, [load(AFTER, f"fullkit-s{s}-h{hcol}-{v}")]) for v, lab in (("front", "front"), ("34", "3/4"), ("back", "back"))],
             f"David's 21 hairstyles (row 305), skin {s}, hair colour {int(hcol) + 1}", f"05-david-s{s}-h{hcol}.webp", 2600)
for s in SKINS:
    rows = [(f"{p}: before (the earlier creator) | after (the new creator)", [load(BEFORE, f"creator-s{s}-{p}-p1"), load(AFTER, f"creator-s{s}-{p}")]) for p in ("Eyes", "Mouth")]
    rows += [("Hair: before (Back hair) | after (Hair, then its end: Hairstyles)", [load(BEFORE, f"creator-s{s}-Backhair-p1"), load(AFTER, f"creator-s{s}-Hair"), load(AFTER, f"creator-s{s}-Hair-end")])]
    grid(rows, f"The creator, skin {s}", f"06-creator-s{s}.webp", 2880)
    grid([(f"hair colour {int(h) + 1}", [load(AFTER, f"creator-s{s}-h{h}-hairstyles")]) for h in ("1", "3", "5")]
         + [(st.replace("_", " "), [load(AFTER, f"creator-s{s}-{st}-{v}") for v in ("front", "34", "back")])
            for st in ("Messy_low_ponytail", "Windy_bob", "Dreads_with_a_cap")],
         f"The creator, skin {s}: David's hairstyles in the Hair panel, and three of them turned", f"06-creator-david-s{s}.webp", 2880)
grid([(f"{w}: before | after", [load(BEFORE, f"world-{w}"), load(AFTER, f"world-{w}")]) for w in ("bob", "long", "pony", "sunhat")]
     + [("David's hair in the world", [load(AFTER, f"world-{w}") for w in ("low-pony", "dreads-cap", "windy-bob")])]
     + [("Applicant island (shares the character): before | after", [load(BEFORE, "applicant-island"), load(AFTER, "applicant-island")])],
     "In the world", "07-world.webp", 2560)
grid([(f"{c}: before | after", [load(BEFORE, f"closeup-{c}"), load(AFTER, f"closeup-{c}")]) for c in ("default", "front", "side", "faces301")],
     "Close-ups, matte", "08-closeups.webp", 2400)
grid([(n, [load(RENDERS, f"lod-{n}")]) for n in ("base", "lib", "full", "acc")], "Full | LOD 1 (render_lod.py)", "09-lod.webp", 2400)
