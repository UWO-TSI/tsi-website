"""Before/after sheets for the v1 land pass: each named frame from <before>/ and <after>/ side by side, labelled, as WebP.

  python3 specs/evidence/v1-land/sheets.py <before_dir> <after_dir> <out_dir> name [name ...]
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

before, after, out = sys.argv[1:4]
names = sys.argv[4:]
os.makedirs(out, exist_ok=True)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
except OSError:
    font = ImageFont.load_default()

for name in names:
    a, b = Image.open(os.path.join(before, f"{name}.png")).convert("RGB"), Image.open(os.path.join(after, f"{name}.png")).convert("RGB")
    w = 960
    a = a.resize((w, round(a.height * w / a.width)), Image.LANCZOS)
    b = b.resize((w, round(b.height * w / b.width)), Image.LANCZOS)
    gap = 12
    sheet = Image.new("RGB", (w * 2 + gap, max(a.height, b.height)), (24, 28, 32))
    sheet.paste(a, (0, 0))
    sheet.paste(b, (w + gap, 0))
    d = ImageDraw.Draw(sheet)
    for x, label in ((14, "before"), (w + gap + 14, "after")):
        d.rounded_rectangle((x - 6, 10, x + 6 + d.textlength(label, font=font), 46), 8, fill=(0, 0, 0))
        d.text((x, 12), label, fill=(255, 255, 255), font=font)
    path = os.path.join(out, f"{name}.webp")
    sheet.save(path, "WEBP", quality=82)
    print("wrote", path)
