"""The icon sheet (specs/game-ui.md §4 evidence): every icon in web/public/assets/icons on a cream ground, labelled, and a
check that none is empty, cut off at the frame or a hard square (no transparency).

  python3 specs/evidence/game-ui/icon_sheet.py <out.webp> [cols]
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(HERE, "..", "..", "..", "web", "public", "assets", "icons")
out, cols = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 18
names = sorted(f for f in os.listdir(ICONS) if f.endswith(".webp"))
T, L = 96, 14
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (cols * T, rows * (T + L)), (243, 239, 224))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 9)
except OSError:
    font = ImageFont.load_default()
bad = []
for k, name in enumerate(names):
    im = Image.open(os.path.join(ICONS, name)).convert("RGBA")
    a = im.getchannel("A")
    box = a.getbbox()
    filled = sum(1 for p in a.getdata() if p > 16) / (im.width * im.height)
    if not box or filled < 0.03:
        bad.append(f"{name}: empty ({filled:.1%})")
    elif filled > 0.97:
        bad.append(f"{name}: no transparency")
    elif box[0] == 0 or box[1] == 0 or box[2] == im.width or box[3] == im.height:
        bad.append(f"{name}: touches the frame {box}")
    x, y = (k % cols) * T, (k // cols) * (T + L)
    sheet.paste(im.resize((T - 6, T - 6), Image.LANCZOS), (x + 3, y + 3), im.resize((T - 6, T - 6), Image.LANCZOS))
    d.text((x + 3, y + T - 1), name.rsplit(".", 1)[0][:17], fill=(70, 70, 60), font=font)
sheet.save(out, quality=88)
print(f"{len(names)} icons → {out}")
print("problems:" if bad else "no empty, cut-off or opaque tiles", *bad, sep="\n  ")
