"""Round 12's stills and sheets (t12-*) from the walk's shots, the clips and the Blender turnaround.

    python3 specs/evidence/tutorial-v2/v12/sheets.py <ui shots> <reduced+smooth shots> <keys shots> <turnaround dir> <out dir>
The review-only sheet (David's reference beside the render) goes to the turnaround dir, never into git.
"""
import subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

UI, RS, KEYS, TURN, OUT = map(Path, sys.argv[1:6])
ROOT = Path(__file__).resolve().parents[4]
V11 = ROOT / "specs/evidence/tutorial-v2/v11"
OUT.mkdir(parents=True, exist_ok=True)
BG = (246, 247, 244)

def row(ims, h, gap=12, bg=BG):
    ims = [i.convert("RGB").resize((round(i.width * h / i.height), h), Image.LANCZOS) for i in ims]
    s = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), h), bg); x = 0
    for i in ims: s.paste(i, (x, 0)); x += i.width + gap
    return s

def nearest(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def save(im, name): im.save(OUT / f"{name}.webp", quality=88); print(name, im.size)
def frame(mp4, t):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{t}", "-i", str(mp4), "-frames:v", "1", f"{d}/f.png"], check=True)
        return Image.open(f"{d}/f.png").copy()
ui = lambda n: Image.open(UI / f"{n}.png")

# The model: front, side, back and three-quarter, closed and open (Blender, the in-game look is the live shots).
order = ["front-closed", "front-open", "three-quarter-closed", "three-quarter-open", "side-open", "back-closed"]
def on(path, bg):
    im = Image.open(path).convert("RGBA")
    return Image.alpha_composite(Image.new("RGBA", im.size, bg), im)
save(row([on(TURN / f"{n}.png", (226, 232, 226, 255)) for n in order], 560), "t12-model-turnaround")
ref = ROOT / "specs/references/phone/slider-phone-ref.png"
if ref.exists():
    row([Image.open(ref), on(TURN / "front-open.png", (255, 255, 255, 255)), ui("u-phone-close")], 560).save(TURN / "t12-ref-beside-model.webp", quality=88)

# The phone in game, beside the island; close up; the lean either way.
save(ui("u-phone").convert("RGB"), "t12-desktop")
save(Image.open(UI / "p-phone.png").convert("RGB"), "t12-phone-screen")
save(row([ui("u-phone-close"), Image.open(UI / "p-phone-close.png")], 640), "t12-close")
save(row([ui("u-lean-left"), ui("u-lean-right")], 560), "t12-lean")
# The screen: round 11's pixel art, then today's UI with the pixel wash (each at 2x), a hovered app and the keyboard's pick.
before = Image.open(V11 / "t11-phone-close.webp")
save(row([before, nearest(ui("u-screen"), 2)], 520), "t12-screen-before-after")
save(row([nearest(ui("u-hover"), 2), nearest(ui("u-pick"), 2)], 480), "t12-highlight")
# The motions as strips (the stills from a second take; the clips are the motion).
save(row([ui(f"u-open-f{i:02d}").crop((140, 80, 520, 640)) for i in range(1, 10)], 300, 6), "t12-slide-strip")
save(row([ui(f"u-away-f{i:02d}").crop((140, 80, 520, 640)) for i in range(1, 8)], 300, 6), "t12-away-strip")
save(row([ui("u-corner-open"), ui("u-corner-shut")], 480), "t12-corner")
save(row([ui("u-app-mail"), ui("u-back")], 400), "t12-app")
# The tour: the HUD step plays by itself (lit, above the card, mid-flight, landed), and the phone step.
R12 = OUT
save(row([frame(R12 / "t12-hud.mp4", t).crop((300, 0, 1440, 760)) for t in (0.4, 1.4, 2.1, 3.3)], 300, 8), "t12-hud-frames")
save(row([frame(R12 / "t12-tour-phone.mp4", t) for t in (1.2, 3.4)], 420), "t12-tour-phone-frames")
# The key: X first in Settings' menu keys.
save(Image.open(KEYS / "k-settings-keys.png").convert("RGB").crop((380, 40, 1360, 900)), "t12-key-settings")
save(row([Image.open(RS / "r-80ms.png"), Image.open(RS / "m-phone.png")], 520), "t12-reduced-smooth")
