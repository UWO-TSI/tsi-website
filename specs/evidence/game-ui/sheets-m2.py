"""Milestone 2 evidence sheets (specs/game-ui.md items 5-7, the backpack) from shoot-m2.mjs's PNGs: labelled, WebP,
into specs/evidence/game-ui/ with an M2- prefix. Refuses a blank tile (an empty or single-colour frame).

  python3 specs/evidence/game-ui/sheets-m2.py <shots_dir>
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = sys.argv[1]
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)
    TITLE = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 20)
except OSError:
    FONT = TITLE = ImageFont.load_default()


def blank(im):
    """A frame with next to no variation: nothing rendered."""
    return max(ImageStat.Stat(im.convert("L")).stddev) < 4


def sheet(name, title, cells, cols, size, crop=None):
    """cells: [(png, label)]; each cell `size` (w, h), cropped by `crop` (a box, or a function of the image) first."""
    w, h = size
    rows = (len(cells) + cols - 1) // cols
    out = Image.new("RGB", (cols * w, 36 + rows * (h + 26)), (243, 239, 224))
    d = ImageDraw.Draw(out)
    d.text((10, 8), title, fill=(50, 45, 35), font=TITLE)
    for k, (png, label) in enumerate(cells):
        im = Image.open(os.path.join(SHOTS, png)).convert("RGB")
        box = crop(im) if callable(crop) else crop
        if box:
            im = im.crop(box)
        if blank(im):
            raise SystemExit(f"blank tile: {png}")
        im.thumbnail((w - 8, h))
        x, y = (k % cols) * w, 36 + (k // cols) * (h + 26)
        out.paste(im, (x + (w - im.width) // 2, y))
        d.text((x + 8, y + h + 4), label, fill=(60, 60, 50), font=FONT)
    out.save(os.path.join(HERE, name), quality=84)
    print(name, out.size)


exists = lambda f: os.path.exists(os.path.join(SHOTS, f))
# The island shots (1280 x 800) lose the lab bench's 40 px bar at the top.
WORLD = lambda im: (0, 40, im.width, im.height) if im.size == (1280, 800) else None
flyin = sorted(f for f in os.listdir(SHOTS) if f.startswith("M2-fill-3-flyin"))

sheet("M2-01-fill-and-refuse.webp", "The backpack fills to full, then refuses a pickup (the flower stays)", [
    ("M2-fill-1-bag-19.png", "19 of 20 slots"),
    ("M2-fill-2-near-flower.png", "A flower the bag doesn't hold: it needs a slot"),
    (flyin[-1], "Picked: it flies into the Bag button"),
    ("M2-fill-4-bag-20.png", "20 of 20: full (the new one marked New)"),
    ("M2-refuse-1-0180ms.png", "Full: E again on the same flower"),
    ("M2-refuse-1-0700ms.png", "\"Your backpack is full\" over it; the Bag button shakes"),
    ("M2-refuse-2-bag.png", "Still 20 of 20; the flower is still in the world"),
    ("M2-over-bag-23.png", "Over the cap from before it: everything kept, nothing picked up"),
], 2, (760, 480), WORLD)

sheet("M2-02-pickup-flyin.webp", "Pickup feel: the icon pops out of your hands and flies into the Bag button, which bounces (clean HUD)",
      [(f, f.split("-")[-1].replace(".png", "")) for f in flyin], 4, (480, 300), lambda im: (0, 100, 760, 560))

sheet("M2-03-details-sort-lock.webp", "The Bag (I): details, lock, sell, pins, sort and drop", [
    ("M2-details-1-grid.png", "Pockets: real icons, stack counts, rarity edges"),
    ("M2-details-2-fish.png", "Details: rarity, size, coins, museum, recipes"),
    ("M2-details-3-locked.png", "Locked: selling and dropping skip it"),
    ("M2-details-4-sold.png", "Sold one from the details"),
    ("M2-details-5-pinned.png", "Dragged onto the tool wheel's pins"),
    ("M2-details-6-sorted.png", "Sort: by type, then rarity"),
    ("M2-details-7-drop-confirm.png", "Drop asks first"),
], 2, (760, 560), lambda im: (250, 40, 1030, 800))

sheet("M2-04-chest.webp", "The home storage chest: any wooden chest in the house, E", [
    ("M2-chest-1-prompt.png", "E at the wooden chest"),
    ("M2-chest-2-open.png", "Your bag and the chest, side by side"),
    ("M2-chest-3-stored-all.png", "Store all materials"),
    ("M2-chest-4-shift-click.png", "Shift-click a stack back to the bag"),
    ("M2-chest-5-dragged.png", "Drag a stack into the chest"),
], 2, (760, 480), WORLD)

phone = [c for c in [("M2-phone-1-bag.png", "The companion's Bag (390 x 844)"), ("M2-phone-2-details.png", "An item's details")] if exists(c[0])]
shop = [c for c in [("M2-shop-pocket.png", "The Roomier pocket on the shop's tools shelf")] if exists(c[0])]
sheet("M2-05-phone.webp", "On a phone: the companion's Bag is the same sheet", phone, 2, (400, 850))
sheet("M2-06-pocket-in-the-shop.webp", "The pocket upgrade on the shop's tools shelf", shop, 1, (1000, 600), WORLD)
