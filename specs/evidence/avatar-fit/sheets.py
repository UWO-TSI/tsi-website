"""Tile the shots.mjs PNGs of a before and an after run into the avatar-fit WebP sheets (Pillow).

  python3 specs/evidence/avatar-fit/sheets.py <before_dir> <after_dir>
Writes next to this script: bangs-over-backs-{before,after}.webp, eyes-{before,after}.webp, expressions.webp,
closeups.webp, village.webp, creator-stage.webp.
"""
import os, sys
from PIL import Image, ImageDraw

B, A = sys.argv[1:3]
HERE = os.path.dirname(os.path.abspath(__file__))
BG = (255, 255, 255)


def load(d, name, box=None, width=None):
    im = Image.open(os.path.join(d, name + ".png")).convert("RGB")
    if box:
        im = im.crop(box)
    if width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    return im


def grid(rows, labels=None, pad=8, head=26):
    """rows: [[images]] -> one image; labels: per-row text drawn above the row."""
    w = max(sum(i.width for i in r) + pad * (len(r) - 1) for r in rows)
    h = sum(max(i.height for i in r) + (head if labels else 0) for r in rows) + pad * (len(rows) - 1)
    out = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(out)
    y = 0
    for k, r in enumerate(rows):
        if labels:
            d.text((6, y + 6), labels[k], fill=(0, 0, 0))
            y += head
        x = 0
        for im in r:
            out.paste(im, (x, y))
            x += im.width + pad
        y += max(i.height for i in r) + pad
    return out


def save(im, name, q=80):
    im.save(os.path.join(HERE, name), "WEBP", quality=q, method=6)
    print("SHEET", name, im.size, os.path.getsize(os.path.join(HERE, name)) // 1024, "KB")


for tag, d in (("before", B), ("after", A)):
    # 16 bangs (two creator pages each) over three back styles, one column per back
    cols = [grid([[load(d, f"creator-bangs-{b}-p1", width=700)], [load(d, f"creator-bangs-{b}-p2", width=700)]], pad=4)
            for b in ("bob", "long", "pony")]
    save(grid([cols], [f"{tag}: every bangs style (creator thumbnails) over back_bob | back_long | back_high_pony"]),
         f"bangs-over-backs-{tag}.webp")
    save(grid([[load(d, "creator-eyes-p1", width=900)], [load(d, "creator-eyes-p2", width=900)]],
              [f"{tag}: the eye set in the creator", ""]), f"eyes-{tag}.webp")

HEAD = (240, 170, 960, 890)      # the head on the creator's main stage (1200 x 1640 capture)
EXPR = ["neutral", "happy", "surprised", "sad", "angry", "sleepy"]
save(grid([[load(B, f"creator-expr-{e}", HEAD, 330) for e in EXPR], [load(A, f"creator-expr-{e}", HEAD, 330) for e in EXPR]],
          ["before: " + " | ".join(EXPR) + " (creator stage, 3/4)", "after"]), "expressions.webp")
save(grid([[load(B, "creator-stage-default", width=520), load(A, "creator-stage-default", width=520)]],
          ["creator main stage, default look: before | after (face composed at 1024 after, 512 before)"]), "creator-stage.webp")

CLOSE = (700, 250, 2180, 1750)   # the player in the 3/4 close-up (2880 x 1800 capture)
LOOKS = ["default", "beanie", "sunhat", "cap", "straw-hat", "flower-crown", "circlet", "glasses-round", "glasses-square"]
rows, labels = [], []
for k in range(0, len(LOOKS), 3):
    rows.append([im for n in LOOKS[k:k + 3] for im in (load(B, f"closeup-{n}", CLOSE, 380), load(A, f"closeup-{n}", CLOSE, 380))])
    labels.append("   |   ".join(f"{n}: before, after" for n in LOOKS[k:k + 3]))
save(grid(rows, labels), "closeups.webp")

PLAYER = (1204, 930, 1664, 1390)  # the player at the game camera (2880 x 1800 capture), pixel filter as shipped
save(grid([[load(B, f"village-look{i}", PLAYER, 300) for i in range(1, 7)], [load(A, f"village-look{i}", PLAYER, 300) for i in range(1, 7)]],
          ["before: six looks at the game camera (village distance, pixel filter on)", "after"]), "village.webp")
