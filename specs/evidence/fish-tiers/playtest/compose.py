"""The playtest round's before-and-after sheets.
python3 compose.py <runs dir (the after stills, tag -after)> <out dir>
Before is the last round's flat overlay at d8f45b67 (../ui-world/, same spot and camera): its stills, and its strips of
the same beats stacked as the whole catch (that round kept no single bite-to-card run)."""
import sys
from PIL import Image, ImageDraw, ImageFont
runs, out = sys.argv[1:3]
UI = "specs/evidence/fish-tiers/ui-world"
FONT = ImageFont.load_default(size=17)
CROP = (240, 330, 1040, 760)
ROWS = [("The wait", f"{UI}/wait.png", f"{runs}/wait-after.png"),
        ("The reel: in the window", f"{UI}/reel-in-window.png", f"{runs}/reel-after.png"),
        ("The reel: slipping", f"{UI}/reel-slipping.png", f"{runs}/reel-slipping-after.png")]
W, H = 640, 344
sheet = Image.new("RGB", (2 * W + 12, len(ROWS) * (H + 30) + 36), (255, 255, 255))
d = ImageDraw.Draw(sheet)
d.text((8, 8), "Before (d8f45b67)", fill=(0, 0, 0), font=FONT)
d.text((W + 20, 8), "After (this round)", fill=(0, 0, 0), font=FONT)
for i, (label, a, b) in enumerate(ROWS):
    y = 36 + i * (H + 30)
    d.text((8, y + 4), label, fill=(70, 70, 70), font=FONT)
    for j, p in enumerate((a, b)):
        sheet.paste(Image.open(p).crop(CROP).resize((W, H), Image.LANCZOS), (j * (W + 12), y + 28))
sheet.save(f"{out}/before-after-reel.png")
print("before-after-reel", sheet.size)
# Before, the whole catch: the last round's hook, slip, landing and card strips, one under the other.
parts = [Image.open(f"{UI}/{n}") for n in ("hook-strip.png", "slip-strip.png", "landing-strip.png", "card-strip-common.png")]
w = 1400
parts = [p.resize((w, round(p.height * w / p.width)), Image.LANCZOS) for p in parts]
stack = Image.new("RGB", (w, sum(p.height for p in parts) + 8 * (len(parts) - 1) + 30), (255, 255, 255))
ImageDraw.Draw(stack).text((8, 6), "Before (d8f45b67): the hook, the slip, the landing, the card", fill=(0, 0, 0), font=FONT)
y = 30
for p in parts:
    stack.paste(p, (0, y)); y += p.height + 8
stack.save(f"{out}/catch-before.png")
print("catch-before", stack.size)
