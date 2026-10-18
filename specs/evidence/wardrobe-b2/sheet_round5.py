"""Wardrobe batch 2, round 5 hat cut: the evidence sheets (WebP) from shoot.mjs's round5 scene.

  python3 specs/evidence/wardrobe-b2/sheet_round5.py <shots_dir>

18-round5-hatcut.webp       each covering hat over #03 long, #10 short, #27 buns, #25 curly pigtails and #23's bob:
                            front, 3/4, side, back, high and low
18b-round5-rims-visor.webp  the rims of #18, #21, #22 and #24 close up; #10 with no hat; #04's visor, front, 3/4, high
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = sys.argv[1]
BG, INK = (239, 231, 214), (59, 47, 38)
FONT = ImageFont.load_default(size=30)
SMALL = ImageFont.load_default(size=21)


def titled(img, text, sub=None):
    pad = 48 + (32 if sub else 0)
    out = Image.new("RGB", (img.width, img.height + pad), BG)
    out.paste(img, (0, pad))
    d = ImageDraw.Draw(out)
    d.text((12, 8), text, fill=INK, font=FONT)
    if sub:
        d.text((12, 46), sub, fill=INK, font=SMALL)
    return out


def stack(imgs, gap=16):
    w = max(i.width for i in imgs)
    out = Image.new("RGB", (w, sum(i.height for i in imgs) + gap * (len(imgs) - 1)), BG)
    y = 0
    for i in imgs:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def fit(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


def shot(name, w=None):
    img = Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGB")
    return fit(img, w) if w else img


def save(img, name):
    assert img.height < 16383, "WebP's limit"
    img.save(os.path.join(HERE, name), "WEBP", quality=84, method=6)
    print("sheet", name, img.size)


ROWS = "rows: #03 long scruffy, #10 messy wolf cut, #27 double buns, #25 curly pigtails, #23 ribbon bob"
HATS = [("acc_propeller_cap", "#01 propeller cap: round 4's rule kept (not sent back)"), ("acc_drawn_top_hat", "#18 drawn top hat"), ("acc_cowboy_hat", "#21 cowboy hat"),
        ("acc_woven_hat", "woven tassel hat (open weave): round 4's rule kept"), ("acc_red_band_straw_hat", "#24 straw hat"),
        ("acc_ushanka_goggles", "#22 ushanka and goggles")]
head = titled(Image.new("RGB", (1800, 1), BG), "Round 5 hat cut: only hair no view reaches with the hat on (kept 3.5 cm up inside it), and hair poking out through it, goes",
              "The hair runs on up under every rim. Columns: front, 3/4, side, back, high (3/4 from above), low (3/4 from below). " + ROWS)
save(fit(stack([head] + [titled(shot(f"r5-{h}"), label, ROWS) for h, label in HATS]), 1600), "18-round5-hatcut.webp")

zoom = [("acc_drawn_top_hat", "#18 drawn top hat"), ("acc_cowboy_hat", "#21 cowboy hat"), ("acc_ushanka_goggles", "#22 ushanka and goggles"),
        ("acc_red_band_straw_hat", "#24 straw hat")]
parts = [titled(shot(f"r5-zoom-{h}"), f"{label}: the rim close up", "Columns: 3/4, side, back, low. " + ROWS) for h, label in zoom]
parts.append(titled(shot("r5-nohat", 1400), "#10 messy wolf cut with no hat", "Its stepped edge low at the back of the head is the hairstyle's own nape, not the cut."))
parts.append(titled(shot("r5-visor", 1400), "#04 crew visor: the hair in front of the logo cleared, front, 3/4 and high", ROWS))
save(fit(stack(parts), 1400), "18b-round5-rims-visor.webp")
