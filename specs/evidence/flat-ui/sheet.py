"""The flat UI rollout's before and after sheets (specs/polish/flat-ui.md): one row per surface, before on the left and
after on the right, each panel labelled. Portrait (phone) shots are fitted whole on the sheet's dark.
  python3 sheet.py <out.webp> "<title>" "<surface>|<before.png>|<after.png>" ...
"""
import sys
from PIL import Image, ImageDraw, ImageFont

out, title, rows = sys.argv[1], sys.argv[2], [r.split("|") for r in sys.argv[3:]]
W, H, PAD, CAP, TOP = 900, 562, 16, 40, 64
DARK = "#1d1f22"
bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 20)
plain = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
big = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28)


def fit(path):
    im = Image.open(path).convert("RGB")
    iw, ih = im.size
    k = min(W / iw, H / ih)
    fitted = im.resize((max(1, int(iw * k)), max(1, int(ih * k))), Image.LANCZOS)
    cell = Image.new("RGB", (W, H), DARK)
    cell.paste(fitted, ((W - fitted.width) // 2, (H - fitted.height) // 2))
    return cell


sheet = Image.new("RGB", (2 * W + 3 * PAD, TOP + len(rows) * (H + CAP + PAD) + PAD), DARK)
d = ImageDraw.Draw(sheet)
d.text((PAD, 18), title, font=big, fill="#f2efe8")
for i, (surface, before, after) in enumerate(rows):
    y = TOP + i * (H + CAP + PAD)
    for j, (label, path, colour) in enumerate((("before", before, "#e8b4a0"), ("after", after, "#a8d8b0"))):
        x = PAD + j * (W + PAD)
        d.text((x + 2, y + 8), label, font=bold, fill=colour)
        lw = d.textlength(label + "  ", font=bold)
        text = surface
        while d.textlength(text, font=plain) > W - lw - 8 and len(text) > 8:
            text = text[:-2].rstrip() + "…" if not text.endswith("…") else text[:-2].rstrip() + "…"
        d.text((x + 2 + lw, y + 8), text, font=plain, fill="#e9e5dc")
        sheet.paste(fit(path), (x, y + CAP))
sheet.save(out, "WEBP", quality=84)
print(out, sheet.size)
