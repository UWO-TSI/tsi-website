"""Round 13's stills and sheets (t13-*) from the walk's shots and the Blender turnaround.

    python3 specs/evidence/tutorial-v2/v13/sheets.py <shots dir> <turnaround dir> <out dir>
<shots dir> holds every scene's pngs (u, p, u2, c, lp, r, m). The review-only sheet (David's references beside ours)
goes to the turnaround dir, never into git.
"""
import sys
from pathlib import Path
from PIL import Image

SH, TURN, OUT = map(Path, sys.argv[1:4])
ROOT = Path(__file__).resolve().parents[4]
R12 = ROOT / "specs/evidence/tutorial-v2/r12"
OUT.mkdir(parents=True, exist_ok=True)
BG = (246, 247, 244)

def row(ims, h, gap=12, bg=BG):
    ims = [i.convert("RGB").resize((round(i.width * h / i.height), h), Image.LANCZOS) for i in ims]
    s = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), h), bg); x = 0
    for i in ims: s.paste(i, (x, 0)); x += i.width + gap
    return s
def nearest(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def save(im, name): im.save(OUT / f"{name}.webp", quality=90); print(name, im.size)
def sh(n): return Image.open(SH / f"{n}.png")
def have(*ns): return all((SH / f"{n}.png").exists() for n in ns)
def on(path, bg):
    im = Image.open(path).convert("RGBA")
    return Image.alpha_composite(Image.new("RGBA", im.size, bg), im)

# The model remodelled: the screen's raised bezel, its mask and the sunk glass; the digits and the charm their own parts.
order = ["front-closed", "front-open", "three-quarter-closed", "three-quarter-open", "side-open", "back-closed"]
save(row([on(TURN / f"{n}.png", (226, 232, 226, 255)) for n in order], 560), "t13-model-turnaround")
refs = [ROOT / "specs/references/phone" / n for n in ("phone-ui-ref.png", "slider-phone-ref.png")]
if all(r.exists() for r in refs) and have("u2-screen"):
    row([Image.open(refs[0]), Image.open(refs[1]), sh("u2-screen")], 520).save(TURN / "t13-refs-beside-screen.webp", quality=88)

# The screen: round 12 (today's UI, washed twice) beside round 13 (its own pixel design, one wash), real size on a
# retina desktop; then the hovered tile and the keyboard's pick.
if have("u2-screen"): save(row([Image.open(R12 / "t12-highlight.webp").crop((0, 0, 365, 480)), sh("u2-screen")], 520), "t13-screen-before-after")
if have("u-hover", "u-pick", "u2-hover"): save(row([nearest(sh("u-hover"), 2), nearest(sh("u-pick"), 2), sh("u2-hover")], 480), "t13-highlight")
# One wash: the phone whole on a retina desktop and at 1x, the keypad's digits close up.
if have("u2-phone", "u-phone-close", "u2-keypad"): save(row([sh("u2-phone"), nearest(sh("u-phone-close"), 2)], 640), "t13-wash")
if have("u2-keypad"): save(sh("u2-keypad").convert("RGB"), "t13-digits")
if have("u-phone"): save(sh("u-phone").convert("RGB"), "t13-desktop")
if have("p-phone"): save(sh("p-phone").convert("RGB"), "t13-phone-screen")
# The motions as strips (stills from a second take; the clips are the motion).
if have("u-open-f01"): save(row([sh(f"u-open-f{i:02d}").crop((140, 80, 520, 640)) for i in range(1, 10)], 300, 6), "t13-slide-strip")
if have("c-open-f01"): save(row([sh(f"c-open-f{i:02d}").crop((60, 60, 520, 640)) for i in range(1, 12)], 300, 6), "t13-charm-strip")
if have("u-app-mail", "u-back"): save(row([sh("u-app-mail"), sh("u-back")], 400), "t13-app")
if have("r-80ms", "m-phone"): save(row([sh("r-80ms"), sh("m-phone")], 520), "t13-reduced-smooth")
# The pitch, on the lab's phone: starting up, the profile filled in, the stamp landing, stamped, its home screen.
pitch = ["lp-boot-f02", "lp-boot-f04", "lp-form", "lp-stamp-f02", "lp-stamp-f05", "lp-home-f02"]
if have(*pitch): save(row([sh(n) for n in pitch], 520, 8), "t13-pitch-frames")
