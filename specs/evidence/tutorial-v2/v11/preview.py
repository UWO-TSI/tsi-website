"""Preview the phone's pixel sprites (pixel.tsx) on a mock screen, nearest-neighbour scaled."""
import re, sys
from PIL import Image
src = open(sys.argv[1]).read(); out = sys.argv[2]; SW, SH = int(sys.argv[3]), int(sys.argv[4]); S = int(sys.argv[5])
INK = {"o": (47, 107, 74), "w": (251, 253, 242), "m": (182, 230, 192), "d": (124, 196, 140), "y": (246, 212, 76), "a": (29, 133, 119), "p": (194, 61, 134)}
def mirror(q):
    top = [r + r[:-1][::-1] for r in q]; return top + top[:-1][::-1]
sp = {}
for m in re.finditer(r"(\w+): (mirror\()?\[\s*((?:\"[^\"]*\",?\s*)+)\]", src):
    rows = re.findall(r'"([^"]*)"', m.group(3)); sp[m.group(1)] = mirror(rows) if m.group(2) else rows
for k, v in sp.items():
    bad = {len(r) for r in v}
    if len(bad) > 1: print("ragged", k, bad)
def img(rows, tone="a"):
    im = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in INK: im.putpixel((x, y), INK[tone] + (255,) if c == "a" else INK[c] + (255,))
    return im
def nine(rows, c, w, h):
    s = img(rows); W, H = s.size; im = Image.new("RGBA", (w, h))
    xs = [(0, c, 0, c), (c, W - c, c, w - c), (W - c, W, w - c, w)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in [(0, c, 0, c), (c, H - c, c, h - c), (H - c, H, h - c, h)]:
            if dx1 > dx0 and dy1 > dy0: im.alpha_composite(s.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0), Image.NEAREST), (dx0, dy0))
    return im
scr = Image.new("RGBA", (SW, SH), (217, 255, 190, 255))
scr.alpha_composite(nine(sp["frame"], 7, SW - 2, SH - 2), (1, 1))
pw = 21; scr.alpha_composite(nine(sp["pill"], 3, pw, 7), ((SW - pw) // 2, 0))
for i, n in enumerate(["clover", "heart", "star"]): scr.alpha_composite(img(sp[n]), ((SW - pw) // 2 + 2 + i * 6, 1))
t = min((SW - 8 - 4) // 3, (SH - 17 - 3 - 14) // 2); gx = 2
gw = 3 * t + 2 * gx; x0 = (SW - gw) // 2; gh = 2 * (t + 7) + 3; y0 = 8 + (SH - 17 - gh) // 2
icons = ["settings", "quest", "bag", "collection", "friend", "mail"]
for i, n in enumerate(icons):
    cx, cy = x0 + (i % 3) * (t + gx), y0 + (i // 3) * (t + 7 + 3)
    on = i == 4
    if on: scr.alpha_composite(nine(sp["tileOn"], 4, t + 2, t + 2), (cx - 1, cy - 1 - 1))
    else: scr.alpha_composite(nine(sp["tile"], 3, t, t), (cx, cy))
    ic = img(sp[n], "p" if n == "friend" else "a"); scr.alpha_composite(ic, (cx + (t - 12) // 2, cy + (t - 12) // 2 - (1 if on else 0)))
    if i in (1, 2, 3, 5): scr.alpha_composite(nine(sp["key"], 2, 6, 6), (cx + t - 4, cy + t - 4))
    if on: scr.alpha_composite(img(sp["hand"]), (cx - 10, cy + (t - 9) // 2))
bw = 24; scr.alpha_composite(nine(sp["button"], 3, bw, 7), ((SW - bw) // 2, SH - 8))
bar = Image.new("RGBA", (12, 2), INK["o"] + (255,)); scr.alpha_composite(bar, ((SW - bw) // 2 + 3, SH - 5))
scr.alpha_composite(nine(sp["key"], 2, 5, 5), ((SW - bw) // 2 + 17, SH - 7))
print("t", t, "screen", SW, SH)
scr.resize((SW * S, SH * S), Image.NEAREST).save(out)
