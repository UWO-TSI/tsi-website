"""applicant-unchanged.png: the applicant island's fishing overlay on main and on the branch.
Top: the island itself (real time, so the meter's power and the fish differ). Bottom: the overlay alone on a fake clock with
Math.random seeded (applicant.mjs MODE=lab): main | branch | the difference (x40), with the count of differing pixels.
python3 compare-applicant.py <dir with the shots applicant.mjs wrote> <out png>"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFont
src, out = sys.argv[1:3]
F = ImageFont.load_default(size=17)
rows = []
d_all = []
isl = [("meter", "meter"), ("reel", "reel"), ("catch card", "card")]
W = 620
sheet_rows = []
for label, n in isl:
    a = Image.open(f"{src}/{n}-main-island.png").crop((300, 380, 980, 800)); b = Image.open(f"{src}/{n}-branch-island.png").crop((300, 380, 980, 800))
    sheet_rows.append((f"island: {label}", [a, b], ["main", "branch"]))
lab = []
for label, n in [("meter", "meter"), ("hook chip", "bite"), ("reel", "reel-1"), ("catch card", "card")]:
    a = Image.open(f"{src}/{n}-main.png").convert("RGB"); b = Image.open(f"{src}/{n}-branch.png").convert("RGB")
    diff = ImageChops.difference(a, b)
    cnt = sum(1 for p in diff.getdata() if p != (0, 0, 0)); mx = max(max(p) for p in diff.getdata())
    lab.append((label, a, b, diff.point(lambda v: min(255, v * 40)), cnt, mx))
    d_all.append((label, cnt, mx))
H1 = 420 * W // 680
total_h = 36 + len(sheet_rows) * (H1 + 26) + 40 + sum(max(t[1].height, 40) + 30 for t in lab)
sheet = Image.new("RGB", (2 * W + 12 if False else 3 * 330 + 40 + 2 * W - 3 * 330 + 12, total_h + 20), (255, 255, 255))
sheet = Image.new("RGB", (2 * W + 12, total_h + 20), (255, 255, 255))
d = ImageDraw.Draw(sheet)
y = 6
d.text((8, y), "The applicant island (real time: the meter's power and the fish differ by phase)    main | branch", fill=(0, 0, 0), font=F); y += 28
for label, ims, names in sheet_rows:
    d.text((8, y), label, fill=(70, 70, 70), font=F); y += 22
    for j, im in enumerate(ims):
        sheet.paste(im.resize((W, H1), Image.LANCZOS), (j * (W + 12), y))
    y += H1 + 4
y += 10
d.text((8, y), "The overlay alone, fake clock + seeded Math.random, same file on both:  main | branch | difference (x40)", fill=(0, 0, 0), font=F); y += 28
for label, a, b, diff, cnt, mx in lab:
    d.text((8, y), f"{label}: {cnt} differing pixels (largest step {mx}/255)", fill=(70, 70, 70), font=F); y += 22
    x = 0
    scale = min(1.0, (2 * W + 12 - 24) / (3 * a.width))
    for im in (a, b, diff):
        r = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
        sheet.paste(r, (x, y)); x += r.width + 12
    y += max(40, round(a.height * scale)) + 8
sheet.crop((0, 0, sheet.width, y + 6)).save(out)
for l, c, m in d_all: print(l, c, m)
