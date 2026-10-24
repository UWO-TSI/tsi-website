"""HQ phase 1's review sheet: option A beside option B, view by view (the headless shots of shots.mjs), one WebP.
  python3 sheet.py <raw-dir> <out.webp>"""
import sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
ROWS = [
    ("01-plan-ground", "Ground floor from above: the zones, the stations (E), the walking path"),
    ("02-plan-upper", "Upper floor from above (the ground floor shows through where it's open)"),
    ("03-overview", "Both floors"),
    ("04-door", "From the door (walking camera; the floor overhead is cut away while you're under it)"),
    ("05-entrance-eye", "Walking in, at eye height: the banners and the aquarium"),
    ("06-aquarium-ground", "The aquarium from the ground lounge"),
    ("07-top-of-stairs", "From the top of the stairs"),
    ("08-lounge-aquarium", "The upper lounge looking at the aquarium's top half"),
]
W, H, PAD, CAP, HEAD = 720, 450, 14, 34, 96
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
sheet = Image.new("RGB", (2 * (W + PAD) + PAD, len(ROWS) * (H + CAP + PAD) + PAD + HEAD), "#1d1f22")
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), "HQ interior, phase 1: two layouts for David's pick (greybox, 20 x 16, two storeys)", font=title, fill="#f2efe8")
d.text((PAD, 52), "A · The back mezzanine: over the back, facing the door, banners on its rail; the aquarium on the left wall of the hall.", font=sub, fill="#e9e5dc")
d.text((PAD, 74), "B · The gallery: the aquarium straight ahead on the back wall; a U of upper floor round the hall, the lounge on the bridge over the door.", font=sub, fill="#e9e5dc")
for r, (name, cap) in enumerate(ROWS):
    for c, opt in enumerate("ab"):
        im = Image.open(f"{raw}/{opt}-{name}.png").convert("RGB")
        iw, ih = im.size
        k = max(W / iw, H / ih)
        im = im.resize((int(iw * k), int(ih * k)), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
        x, y = PAD + c * (W + PAD), HEAD + PAD + r * (H + CAP + PAD)
        sheet.paste(im, (x, y))
        text = f"{opt.upper()}{r + 1}. {cap}"
        while d.textlength(text, font=font) > W - 4 and len(text) > 8:
            text = text[:-2].rstrip() + "…" if not text.endswith("…") else text[:-2].rstrip() + "…"
        d.text((x + 2, y + H + 8), text, font=font, fill="#e9e5dc")
sheet.save(out, "WEBP", quality=86)
print(out, sheet.size)
