"""before-after-world.png: the same states from main (the cream overlay) and from the branch (the flat one), same camera.
python3 compose.py <before dir> <after dir> <out png>   (dirs hold the stills cut.py writes, tag -common / -epic)"""
import sys
from PIL import Image, ImageDraw, ImageFont
before, after, out = sys.argv[1:4]
FONT = ImageFont.load_default(size=17)
CROP = (240, 300, 1040, 760)
ROWS = [("The cast meter (held)", "meter-common"), ("The wait", "wait-common"), ("The bite: the chip and the \"!\"", "hook-common"),
        ("The reel: in the window", "reel-in-window-common"), ("The reel: slipping", "reel-slipping-common"), ("The landing", "landing-common"),
        ("Catch card, common (first catch)", "card-developed-common"), ("Catch card, epic (first catch)", "card-developed-epic")]
W, H = 600, 345
sheet = Image.new("RGB", (2 * W + 12, len(ROWS) * (H + 30) + 36), (255, 255, 255))
d = ImageDraw.Draw(sheet)
d.text((8, 8), "Before (main, the cream overlay)", fill=(0, 0, 0), font=FONT)
d.text((W + 20, 8), "After (the flat overlay)", fill=(0, 0, 0), font=FONT)
for i, (label, name) in enumerate(ROWS):
    y = 36 + i * (H + 30)
    d.text((8, y + 4), label, fill=(70, 70, 70), font=FONT)
    for j, dirpath in enumerate((before, after)):
        im = Image.open(f"{dirpath}/{name}.png").crop(CROP).resize((W, H), Image.LANCZOS)
        sheet.paste(im, (j * (W + 12), y + 28))
sheet.save(out)
print(sheet.size)
