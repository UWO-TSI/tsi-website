"""Side-by-side before | after sheets from before/sN.png and after/sN.png (shoot.mjs ids:sN scenes), webp; and David's screenshot
beside the same hairstyle after (middle part, front)."""
from PIL import Image, ImageDraw
import os
for n in range(1, 9):
    a, b = Image.open(f"before/s{n}.png").convert("RGB"), Image.open(f"after/s{n}.png").convert("RGB")
    im = Image.new("RGB", (a.width * 2 + 10, a.height + 30), "#888")
    d = ImageDraw.Draw(im)
    d.text((8, 8), "before (the matte under-cap showing)", fill="white")
    d.text((a.width + 18, 8), "after (only the cap behind the hair stays)", fill="white")
    im.paste(a, (0, 30)); im.paste(b, (a.width + 10, 30))
    im.save(f"pair-{n}.webp", quality=82)
D = Image.open("../david-undercap-2026-10-27.png").convert("RGB")
A = Image.open("after/s8.png").convert("RGB")
# hair_middle_part is the third row of sheet 8: its front and 3/4 views
c = A.crop((0, 736, 700, 1104))
W = Image.new("RGB", (D.width + c.width + 10, max(D.height, c.height)), "#888")
W.paste(D, (0, 0)); W.paste(c, (D.width + 10, 0)); W.save("david-vs-after-middle-part.webp", quality=85)
