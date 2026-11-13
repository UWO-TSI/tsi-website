"""Round 14's stills and sheets (t14-*) from the walk's shots, beside round 12's and 13's evidence.

    python3 specs/evidence/tutorial-v2/v14/sheets.py <shots dir> <out dir>
<shots dir> holds every scene's pngs (u, p, u2, c, ap).
"""
import sys
from pathlib import Path
from PIL import Image

SH, OUT = map(Path, sys.argv[1:3])
EV = Path(__file__).resolve().parents[1]
R12, R13 = EV / "r12", EV / "r13"
OUT.mkdir(parents=True, exist_ok=True)
BG = (246, 247, 244)

def row(ims, h, gap=12, bg=BG):
    ims = [i.convert("RGB").resize((round(i.width * h / i.height), h), Image.LANCZOS) for i in ims]
    s = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), h), bg); x = 0
    for i in ims: s.paste(i, (x, 0)); x += i.width + gap
    return s
def nearest(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def save(im, name): im.convert("RGB").save(OUT / f"{name}.webp", quality=92); print(name, im.size)
def sh(n): return Image.open(SH / f"{n}.png")
def have(*ns): return all((SH / f"{n}.png").exists() for n in ns)

# The screen: round 12's (the old UI, washed twice) beside round 14's (the same UI, one light wash), both at real size on
# a retina desktop; then one card of each blown up 3x without smoothing, so the sharpness compares pixel for pixel.
if have("u2-screen"):
    old = Image.open(R12 / "t12-highlight.webp").crop((0, 0, 365, 480)); now = sh("u2-screen")
    save(row([old, now], 520), "t14-screen-old-now")
    oc = old.resize((round(old.width * now.height / old.height), now.height), Image.NEAREST)
    k = lambda im: nearest(im.crop((im.width * 0.12, im.height * 0.12, im.width * 0.5, im.height * 0.36)), 3)
    save(row([k(oc), k(now)], 360), "t14-screen-zoom")
if have("u2-hover"): save(sh("u2-hover"), "t14-phone-hover")
# The digits, lighter, under the light wash (retina), beside round 13's.
if have("u2-keypad"): save(row([Image.open(R13 / "t13-digits.webp"), sh("u2-keypad")], 368), "t14-digits")
# The wash: the phone whole on a retina desktop and at 1x (2x without smoothing), round 13 on the left, 14 on the right.
if have("u2-phone", "u-phone-close"):
    now = row([sh("u2-phone"), nearest(sh("u-phone-close"), 2)], 640)
    save(now, "t14-wash")
    save(row([Image.open(R13 / "t13-wash.webp"), now], 640, 24), "t14-wash-before-after")
# Desktop: the whole window, and round 13's beside round 14's (the phone's corner).
if have("u-phone"):
    save(sh("u-phone"), "t14-desktop")
    corner = (1040, 380, 1440, 900)
    save(row([Image.open(R13 / "t13-desktop.webp").crop(corner), sh("u-phone").crop(corner)], 520, 24), "t14-desktop-before-after")
if have("p-phone"): save(sh("p-phone"), "t14-phone")
# The charm on its rope: out and open, swinging and settling (the clip is the motion).
if have("c-open-f01"): save(row([sh(f"c-open-f{i:02d}").crop((200, 60, 520, 640)) for i in range(1, 12)], 300, 6), "t14-charm-strip")
# The copy: Alice's line after the stamp.
if have("ap-copy"):
    im = sh("ap-copy"); save(im.crop((0, im.height - 300, im.width, im.height)), "t14-copy")
