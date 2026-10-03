"""Small crops of David's Animal Crossing UI kit for the /lab/gui comparison column and the comparison sheet.

The kit never enters the repo or the product: unzip it somewhere outside the repo, then
    python3 specs/evidence/gui-sheet/ref_crops.py <unzipped kit dir> <out dir>
and run the dev server with GUI_REF_DIR=<out dir> (default /private/tmp/claude-501/gui-sheet-ref/crops).
"""
import sys
from pathlib import Path
from PIL import Image

KIT, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

# name: (file, (left, top, right, bottom) as fractions of the image, max width)
CROPS = {
    "palette": ("Color Swatches.png", (0, 0, 1, 1), 560),
    "type": ("Style Guide.png", (0, 0, 1, 1), 360),
    "buttons": ("Buttons.png", (0.77, 0.03, 0.99, 0.66), 360),
    "keycaps": ("Buttons.png", (0.0, 0.03, 0.17, 0.95), 240),
    "dialogue": ("Dialog.png", (0.466, 0.003, 0.68, 0.142), 420),
    "dialogue-dark": ("Dialog.png", (0.466, 0.29, 0.68, 0.405), 420),
    "menu": ("Dialog.png", (0.695, 0.01, 0.995, 0.36), 420),
    "wheel": ("Weapon Wheel.png", (0.04, 0.04, 0.9, 0.48), 380),
    "shop-row": ("Nook Shopping Assets.png", (0.04, 0.04, 0.7, 0.18), 420),
    "tabs": ("Nook Shopping Assets.png", (0.04, 0.2, 0.76, 0.55), 420),
    "bells": ("Nook Shopping Assets.png", (0.56, 0.44, 0.99, 0.94), 300),
    "banner": ("Nook Shopping Background Assets.png", (0.0, 0.29, 0.7, 0.96), 420),
    "inventory": ("Inventory.png", (0.0, 0.0, 0.32, 0.215), 420),
    "recipe": ("Recipes Inventory.png", (0.43, 0.01, 0.84, 0.35), 360),
    "phone": ("Phone Assets.png", (0.42, 0.02, 0.86, 0.47), 300),
    "pointer": ("Pointer.png", (0, 0, 1, 1), 220),
    "tutorial": ("Modal_ Info & Tutorial.png", (0.18, 0.55, 0.82, 0.95), 420),
}
for name, (file, (l, t, r, b), width) in CROPS.items():
    src = Image.open(KIT / file).convert("RGBA")
    im = Image.new("RGB", src.size, (255, 255, 255))
    im.paste(src, mask=src.getchannel("A"))
    W, H = im.size
    crop = im.crop((int(l * W), int(t * H), int(r * W), int(b * H)))
    crop.thumbnail((width, width * 4))
    crop.save(OUT / f"{name}.webp", quality=82)
    print(name, crop.size)
