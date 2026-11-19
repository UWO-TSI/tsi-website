"""Step 2 of the tool pipeline (art/pipeline/tools.md): profile.py's views and dimensions into one labelled sheet.

  python3 art/pipeline/collage.py art/pipeline/out/rods --title "Rods" [--labels rod-1="Flimsy rod",...]
      [--parts Grip,Reel] [--unit "game m"] [--out collage.webp]

One block per model (its five views side by side at the run's shared scale, dimension lines on the view that shows
its long axis, the numbers under it), blocks in a grid on white. --parts names the parts (materials) bracketed along
the long axis. Lengths print in game units (the JSON's game_scale times GLB metres).
"""
import argparse
import glob
import json
import math
import os

from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser()
p.add_argument("dir")
p.add_argument("--title", default="")
p.add_argument("--labels", default="")
p.add_argument("--parts", default="")
p.add_argument("--unit", default="game m")
p.add_argument("--out", default="collage.webp")
p.add_argument("--cols", type=int, help="blocks per row (default: the count nearest 2:1)")
a = p.parse_args()

FONT = "/System/Library/Fonts/Helvetica.ttc"
f_big, f_head, f_mid, f_small = (ImageFont.truetype(FONT, s) for s in (34, 24, 20, 18))
INK, DIM = (40, 40, 40), (200, 60, 50)
PART = [(40, 110, 170), (40, 150, 80), (150, 70, 170)]   # one colour per bracketed part, matched in its text line
ORDER = ["front", "side", "back", "three-quarter", "top"]
labels = dict(kv.split("=", 1) for kv in a.labels.split(",") if "=" in kv)
brackets = [s for s in a.parts.split(",") if s]
models = sorted((json.load(open(f)) for f in glob.glob(os.path.join(a.dir, "*.json"))), key=lambda m: m.get("index", 0))
GAP, PAD = 14, 70


def cm(v, m):
    return f"{v * m['game_scale']:.2f}"


def block(m):
    ims = [Image.open(os.path.join(a.dir, m["views"][k]["file"])).convert("RGBA") for k in ORDER]
    axis = "XYZ".index(m["axis"])
    view = "side" if axis == 1 else "front"           # the view whose plane holds the long axis
    vi = ORDER.index(view)
    vert = axis == 2
    lines = [f"{labels.get(m['name'], m['name'])}",
             f"length {cm(m['length'], m)} {a.unit}, across " + " x ".join(f"{cm(s, m)} ({s / m['length']:.0%})" for i, s in enumerate(m['size']) if i != axis),
             f"{m['tris']} tris, {m['materials']} materials, {m['primitives']} primitives"
             + (f", textures {', '.join('x'.join(map(str, t)) for t in m['textures'])}" if m["textures"] else ", flat colour")]
    for k in brackets:
        q = m["parts"].get(k)
        if q:
            thick = min(s for i, s in enumerate(q["size"]) if i != axis)
            lines.append(f"{k}: {cm(q['size'][axis], m)} long ({q['span']:.0%} of length, from {q['from']:.0%}), {cm(thick, m)} thick")
    w = sum(i.width for i in ims) + GAP * (len(ims) - 1) + PAD * 2
    h = max(i.height for i in ims)
    text_h = 26 * len(lines) + 30
    tw = max(f_mid.getlength(s) for s in lines) + PAD
    W, H = int(max(w, tw)) + 20, h + 90 + text_h + 40
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    x = PAD
    origin = {}
    for k, im in zip(ORDER, ims):
        y = 20 + (h - im.height)
        img.paste(im, (x, y), im)
        d.text((x + im.width / 2, y + im.height + 8), k, fill=INK, font=f_small, anchor="ma")
        origin[k] = (x, y)
        x += im.width + GAP
    # dimension lines on the long-axis view: world (right, up) -> pixels
    v = m["views"][view]
    ox, oy = origin[view]
    im = ims[vi]
    ppm, (cx, cy) = v["ppm"], v["centre"]
    to_px = lambda r, u: (ox + im.width / 2 + (r - cx) * ppm, oy + im.height / 2 - (u - cy) * ppm)
    r_ax = 0 if view == "front" else 1                 # the view's right is +X (front) or +Y (side); up is +Z
    lo, hi = m["min"], m["max"]
    if vert:
        x0 = to_px(lo[r_ax], 0)[0] - 30
        (_, y0), (_, y1) = to_px(0, lo[2]), to_px(0, hi[2])
        d.line([(x0, y0), (x0, y1)], fill=DIM, width=2)
        for yy in (y0, y1):
            d.line([(x0 - 6, yy), (x0 + 6, yy)], fill=DIM, width=2)
        d.text((x0 - 6, (y0 + y1) / 2), cm(m["length"], m), fill=DIM, font=f_small, anchor="rm")
        for i, k in enumerate(brackets):
            q = m["parts"].get(k)
            if not q:
                continue
            xb = x0 + 12 + 8 * i
            (_, b0), (_, b1) = to_px(0, q["min"][2]), to_px(0, q["max"][2])
            d.line([(xb, b0), (xb, b1)], fill=PART[i % 3], width=4)
    else:
        y0 = oy + im.height + 40                       # under the view captions
        (x0, _), (x1, _) = to_px(lo[axis], 0), to_px(hi[axis], 0)
        d.line([(x0, y0), (x1, y0)], fill=DIM, width=2)
        for xx in (x0, x1):
            d.line([(xx, y0 - 6), (xx, y0 + 6)], fill=DIM, width=2)
        d.text(((x0 + x1) / 2, y0 + 4), cm(m["length"], m), fill=DIM, font=f_small, anchor="ma")
    ty = h + 90
    for i, s in enumerate(lines):
        k = s.split(":")[0]
        col = PART[brackets.index(k) % 3] if k in brackets else INK
        d.text((PAD, ty + 26 * i), s, fill=col, font=f_head if i == 0 else f_mid)
    return img


blocks = [block(m) for m in models]
# the column count that keeps the sheet nearest 2:1
best = None
for cols in [a.cols] if a.cols else range(1, len(blocks) + 1):
    rows = [blocks[i:i + cols] for i in range(0, len(blocks), cols)]
    W = max(sum(b.width for b in r) for r in rows)
    H = sum(max(b.height for b in r) for r in rows) + 70
    score = abs(math.log(W / H / 2))
    if best is None or score < best[0]:
        best = (score, rows, W, H)
_, rows, W, H = best
sheet = Image.new("RGB", (W + 40, H + 30), "white")
d = ImageDraw.Draw(sheet)
d.text((20, 16), f"{a.title}   (lengths in {a.unit})", fill=INK, font=f_big)
y = 70
for r in rows:
    x = 20
    for b in r:
        sheet.paste(b, (x, y))
        x += b.width
    y += max(b.height for b in r)
out = os.path.join(a.dir, a.out)
sheet.thumbnail((4096, 4096))                          # image models take up to about 4k a side
sheet.save(out, quality=88)
print(out, sheet.size)
