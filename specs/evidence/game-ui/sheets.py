"""Milestone 1 evidence sheets (specs/game-ui.md) from shoot.mjs's PNGs and the Blender review renders: labelled,
WebP, into specs/evidence/game-ui/.

  python3 specs/evidence/game-ui/sheets.py <shots_dir> <blender_dir>
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS, BLENDER = sys.argv[1], sys.argv[2]
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)
except OSError:
    FONT = ImageFont.load_default()


def sheet(name, cells, cols, size, crop=None):
    """cells: [(path, label)]; each cell `size` (w, h), cropped by `crop` (box on the source) first, labelled under."""
    w, h = size
    rows = (len(cells) + cols - 1) // cols
    out = Image.new("RGB", (cols * w, rows * (h + 24)), (243, 239, 224))
    d = ImageDraw.Draw(out)
    for k, (path, label) in enumerate(cells):
        im = Image.open(path).convert("RGB")
        box = crop(im) if callable(crop) else crop
        if box:
            im = im.crop(box)
        im.thumbnail((w, h))
        x, y = (k % cols) * w, (k // cols) * (h + 24)
        out.paste(im, (x + (w - im.width) // 2, y))
        d.text((x + 8, y + h + 3), label, fill=(60, 60, 50), font=FONT)
    out.save(os.path.join(HERE, name), quality=86)
    print(name, out.size)


S = lambda f: os.path.join(SHOTS, f)
B = lambda f: os.path.join(BLENDER, f)
sheet("01-wheel.webp", [(S("01-wheel-open.png"), "Hold Tab: the flower opens on what's in hand (the check)"),
                         (S("01-wheel-choosing.png"), "A flick right grows the bug net and names it"),
                         (S("01-wheel-centre.png"), "The centre puts things away")], 3, (600, 600), (340, 100, 940, 700))
sheet("02-held-items.webp", [(S(f"02-held-{k}-{m}.png"), f"{k}, {'idle' if m == 'idle' else 'in use'}")
                              for m in ("idle", "use") for k in ("rod", "net", "shovel", "apple")], 4, (360, 420))
sheet("03-ruins-weapon.webp", [(S("03-ruins-weapon-wheel.png"), "The ruins: the wheel is the weapons (the default checked)"),
                               (S("03-ruins-weapon-in-hand.png"), "The oak staff taken out, in hand")], 2, (640, 520))
sheet("05-shop-and-collection.webp", [(S("05-shop-tools.png"), "Shop: rendered icons, coin and gem icons"),
                                      (S("05-shop-furniture.png"), "Furniture from the homes pieces"),
                                      (S("05-collection-book.png"), "Collection: icons, silhouettes, wheel pins")], 3, (640, 400))
sheet("06-clean-hud.webp", [(S("06-hud-clean.png"), "Exploring: the clean HUD (the prompt only)"),
                            (S("06-hud-full.png"), "Hold H, or the pause view: the full HUD")], 2, (640, 400))
sheet("07-tools-and-holds.webp", [(B("tools/sheet.png"), "build_tools.py: rods, nets, shovels, tiers 1-5"),
                                  (B("held/held.png"), "HoldRod, HoldTool (net, shovel, leaf): solved grips"),
                                  (B("held/use.png"), "The use grips: cast, swing, dig"),
                                  (B("held/eat.png"), "Eat: two bites, the head dips to the hands")], 2, (900, 520))
sheet("08-item-models.webp", [(B("items/sheet.png"), "build_items.py: our models for items that had none")], 1, (1600, 800))
