"""Wardrobe batch 3 evidence sheets: the engine shots (shoot.mjs) beside David's previews.
  python3 specs/evidence/wardrobe-b3/sheets.py <shots_dir> <before_dir>"""
import os, sys
from PIL import Image, ImageDraw

SHOTS, BEFORE = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "..", "..", "art", "characters")
W = 1400


def fit(im, w):
    return im.convert("RGB").resize((w, round(im.height * w / im.width)))


def stack(parts, name):
    """parts: [(title, image)] stacked at width W, each under its title."""
    rows = [(t, fit(im, W)) for t, im in parts]
    out = Image.new("RGB", (W, sum(40 + im.height for _, im in rows)), "#f4efe6")
    d, y = ImageDraw.Draw(out), 0
    for t, im in rows:
        d.text((12, y + 12), t, fill="#222")
        out.paste(im, (0, y + 40))
        y += 40 + im.height
    out.save(os.path.join(HERE, name), "WEBP", quality=88, method=6)
    print(name, out.size)


def side(a, b):
    out = Image.new("RGB", (a.width + b.width + 20, max(a.height, b.height)), "#f4efe6")
    out.paste(a, (0, 0))
    out.paste(b, (a.width + 20, 0))
    return out


shot = lambda n: Image.open(os.path.join(SHOTS, n + ".png"))
stack([("David's preview: hairs #28-42", Image.open(os.path.join(ART, "hair/source/david-b3/_preview-3.png")))]
      + [(f"engine, /lab/avatar?sheet=roblox, own colours: {t}", shot(f"hairs-{i + 1}")) for i, t in enumerate(
          ["#28 spiky messy, #29 fluffy crop, #30 straight layers", "#31 long windswept, #32 rolled-up mask, #33 tousled spikes",
           "#34 ski mask and dreads, #35 braided pigtails, #36 space buns with fluffy edges",
           "#37 messy buns with a braid, #38 messy with a braid, #39 freeform afro", "#40 sponge twists, #41 middle part, #42 mod cut"])],
      "01-hairs.webp")
stack([("David's preview: faces #26-32 (whole, face, eyes, mouth)", Image.open(os.path.join(ART, "v7/face/source/david-b3/_previews/batch3.png"))),
       ("engine: faces #26-29 (skin 3, front, 3/4, side, back)", shot("faces-1")), ("engine: faces #30-32", shot("faces-2"))], "02-faces.webp")
stack([("David's previews: face accessories #25-27 (front and side)", side(Image.open(os.path.join(ART, "accessories/source/david-b3/_preview-3.png")),
                                                                            Image.open(os.path.join(ART, "accessories/source/david-b3/_preview-3-side.png")))),
       ("engine: #25 droopy glasses with a bow, #26 cross bandage, #27 face bandaids, over the ribbon bob", shot("acc"))], "03-accessories.webp")
stack([(f"existing hairs, {t}: before (main 58e6f63f, left) and after the 7-row atlas rebuild (right)",
        side(Image.open(os.path.join(BEFORE, n + ".png")).convert("RGB"), shot(n).convert("RGB")))
       for n, t in (("same-own", "own colours"), ("same-dyed", "dyed (hair 4, second colour 8)"))], "04-existing-before-after.webp")
stack([("facekit: every face option, 3/4", shot("facekit")), ("hairkit: every hat, band and glasses, 3/4", shot("hairkit"))], "05-kits.webp")
