"""Strips for the playtest round from reel-shoot.mjs's frames (python3 cut.py <frames dir> <out dir> <tag>).

A cell is (label, ms): the frame nearest that moment, labelled. Beats missing from a run are skipped.
"""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont

src, out, tag = sys.argv[1:4]
meta = json.load(open(f"{src}/beats.json"))
beats, t0 = meta["beats"], meta["t0"]
frames = sorted(glob.glob(f"{src}/*.jpg"))
times = [int(os.path.basename(f).split("_")[1][:-4]) for f in frames]
FONT = ImageFont.load_default(size=15)

def beat(name, nth=0):
    hits = [round((b["t"] - t0) * 1000) for b in beats if b["phase"] == name]
    return hits[nth] if len(hits) > nth else None

def frame_at(ms):
    i = min(range(len(times)), key=lambda i: abs(times[i] - ms))
    return Image.open(frames[i]).crop((0, 40, 1280, 800))

def strip(name, steps, crop, cols, scale=1.0):
    cells = []
    for label, ms in steps:
        if ms is None:
            continue
        im = frame_at(ms).crop(crop)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 7 + 8 * len(label), 22), fill=(20, 20, 20))
        d.text((4, 2), label, fill=(255, 255, 255), font=FONT)
        cells.append(im)
    w, h = cells[0].size
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (w * cols + 4 * (cols - 1), h * rows + 4 * (rows - 1)), (255, 255, 255))
    for i, c in enumerate(cells):
        sheet.paste(c, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
    sheet.save(f"{out}/{name}-{tag}.png")
    print(name, sheet.size, len(cells), "cells")

def at(name, off, nth=0):
    b = beat(name, nth)
    return None if b is None else b + off

bite, land, c0, c1 = beat("bite"), beat("reel:land"), beat("card:false"), beat("card:true")
# The whole catch, from the bite to the card.
strip("catch-strip", [("bite: Hook it!", at("bite", 300)), ("reel: in the window", at("reel:in", 900)), ("slipping", at("reel:slip", 150)),
  ("back in", at("reel:in", 300, 1)), ("near full", at("reel:near", 250)), ("almost!", at("reel:almost", 150)), ("landed", at("reel:land", 120)),
  ("new: suspense", at("card:false", 700)), ("reveal + confetti", at("card:true", 200)), ("card", at("card:true", 1000))],
  (200, 230, 1080, 760), 5, 0.42)
# The reel's juice, close up: the window breathing, droplets, the slip flash, the gauge's surge, the tension, the landing.
strip("reel-juice-strip", [("in +0.9s", at("reel:in", 900)), ("in +1.2s", at("reel:in", 1200)), ("slip +0", at("reel:slip", 0)), ("slip +150", at("reel:slip", 150)),
  ("slip +400", at("reel:slip", 400)), ("near", at("reel:near", 200)), ("almost +0", at("reel:almost", 60)), ("almost +200", at("reel:almost", 200)),
  ("land +60", at("reel:land", 60)), ("land +160", at("reel:land", 160))], (330, 560, 950, 730), 2, 1.0)
# A new species' card: the build (longer for the rarer), the reveal, the confetti.
if c1 is not None:
    s = c0 + 450 if c0 is not None else c1 - 900  # the card arrives about 450 ms after it mounts (the world's beat)
    strip("card-suspense-strip", [("card lands", s + 150), ("build", s + (c1 - s) // 3), ("build", s + 2 * (c1 - s) // 3), ("just before", c1 - 60),
      ("reveal", c1 + 60), ("+200", c1 + 200), ("+450", c1 + 450), ("+900", c1 + 900)], (300, 380, 980, 760), 4, 0.6)
def still(name, ms):
    if ms is not None:
        frame_at(ms).save(f"{out}/{name}-{tag}.png")
still("reel", at("reel:in", 1100))
still("reel-slipping", at("reel:slip", 200))
still("card", at("card:true", 1500))
