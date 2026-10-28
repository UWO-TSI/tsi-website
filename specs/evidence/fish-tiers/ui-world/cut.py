"""Frame strips from shoot.mjs's frames (python3 cut.py <frames dir> <out dir> <tag>).

Each strip is a grid of crops of the game (below the lab's 40 px bar), every cell labelled with its time from the beat.
A step is (beat name, nth occurrence, offset ms): the frame nearest that moment.
"""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont

src, out, tag = sys.argv[1:4]
beats = json.load(open(f"{src}/beats.json"))["beats"]
t0 = json.load(open(f"{src}/beats.json"))["t0"]
frames = sorted(glob.glob(f"{src}/*.jpg"))
times = [int(os.path.basename(f).split("_")[1][:-4]) for f in frames]
FONT = ImageFont.load_default(size=15)

def beat_ms(name, nth=0, last=False):
    hits = [round((b["t"] - t0) * 1000) for b in beats if b["phase"] == name]
    if not hits:
        raise SystemExit(f"no beat {name}")
    return hits[-1] if last else hits[nth]

def frame_at(ms):
    i = min(range(len(times)), key=lambda i: abs(times[i] - ms))
    return Image.open(frames[i]).crop((0, 40, 1280, 800))

def strip(name, steps, crop, cols, scale=1.0):
    cells = []
    for label, ms in steps:
        im = frame_at(ms).crop(crop)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 7 + 9 * len(label), 22), fill=(20, 20, 20))
        d.text((4, 2), label, fill=(255, 255, 255), font=FONT)
        cells.append(im)
    w, h = cells[0].size
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (w * cols + 4 * (cols - 1), h * rows + 4 * (rows - 1)), (255, 255, 255))
    for i, c in enumerate(cells):
        sheet.paste(c, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
    sheet.save(f"{out}/{name}-{tag}.png")
    print(name, sheet.size)

bite = beat_ms("bite")
# The hook: the "!" over the player and the black chip springing in (the "Hook it!" chip), then the strike.
strip("hook-strip", [(f"+{o} ms", bite + o) for o in (0, 50, 100, 170, 260, 420)], (300, 300, 980, 760), 3, 0.8)
# The reel: in the window, slipping out (the window's outline changes), back in.
slip = beat_ms("reel:slip", 0)
strip("slip-strip", [(f"{o:+d} ms", slip + o) for o in (-250, 0, 200, 450, 800, 1400)], (300, 520, 980, 750), 2, 1.0)
# The landing: the line full, the fish leaps out of the track in a burst, the panel springs away.
land = beat_ms("reel:land")
strip("landing-strip", [(f"{o:+d} ms", land + o) for o in (-100, 0, 90, 180, 300, 450)], (300, 420, 980, 760), 3, 0.8)
# The catch card: the world's beat (the fish out of the water), the card landing as a silhouette, developing (a rare one flares).
c0 = beat_ms("card:false"); c1 = beat_ms("card:true")
strip("card-strip", [("silhouette", c1 - 250), ("developed +0", c1), ("+80", c1 + 80), ("+160", c1 + 160), ("+260", c1 + 260), ("+400", c1 + 400), ("+700", c1 + 700), ("+1300", c1 + 1300)], (300, 400, 980, 760), 2, 0.8)
# Whole-frame stills: the fish in the window, the fish slipping out of it, the catch card.
def still(name, ms):
    frame_at(ms).save(f"{out}/{name}-{tag}.png")
still("reel-in-window", beat_ms("reel:in", 1) + 250 if sum(b["phase"] == "reel:in" for b in beats) > 1 else beat_ms("reel:in") + 250)
still("reel-slipping", beat_ms("reel:slip", 1) + 650 if sum(b["phase"] == "reel:slip" for b in beats) > 1 else beat_ms("reel:slip") + 650)
still("card-developed", c1 + 1300)
still("hook", bite + 300)
still("landing", land + 180)
