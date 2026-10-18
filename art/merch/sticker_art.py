"""The GENESIS sticker's images (specs/merch/genesis-sticker.md), from David's print files
(references/merch/genesis-sticker/genesis-sticker-{light,dark}.png, 1350 x 1080, transparent round the art):

  art/merch/genesis-sticker-light.png              the light print on white, 1024 x 819 (build_genesis_sticker.py puts
                                                   it in the GLB)
  web/public/assets/game/items/merch-genesis-sticker-dark.webp   the dark print on black, the same size (the model
                                                   swaps it in for the dark variant)
  web/public/assets/game/items/merch-genesis-sticker-{light,dark}-sprite.webp   each variant as a 2D sprite with its
                                                   holographic sheen baked in (lite graphics, a failed canvas, the
                                                   variant swatches), 512 wide, the card's corners rounded

The baked sheen follows the shader's (components/game/GenesisSticker.tsx foil): a rainbow in diagonal bands, strongest
where the print is bare (the white of the light one, the black of the dark one), a scatter of sparkles.

  python3 art/merch/sticker_art.py
"""
import colorsys, os
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
REF = os.path.join(ROOT, "references", "merch", "genesis-sticker")
ITEMS = os.path.join(ROOT, "web", "public", "assets", "game", "items")
TEX = (1024, 819)
SPRITE = (512, 410)
GROUND = {"light": (255, 255, 255), "dark": (0, 0, 0)}


def flat(variant, size):
    im = Image.open(os.path.join(REF, f"genesis-sticker-{variant}.png")).convert("RGBA")
    bg = Image.new("RGBA", im.size, GROUND[variant] + (255,))
    bg.alpha_composite(im)
    return bg.convert("RGB").resize(size, Image.LANCZOS)


def sheen(rgb, variant, seed):
    """The foil, baked: a hue band across the card, masked to the bare print, and sparkles."""
    a = np.asarray(rgb, dtype=np.float32) / 255.0
    h, w = a.shape[:2]
    v, u = np.mgrid[0:h, 0:w].astype(np.float32)
    u /= w; v /= h
    hue = (u * 0.9 + v * 0.6 + 0.25) % 1.0
    rainbow = np.stack(np.vectorize(lambda x: colorsys.hsv_to_rgb(x, 0.55, 1.0), otypes=[float, float, float])(hue), -1).astype(np.float32)
    lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    bare = np.clip((lum - 0.55) / 0.4, 0, 1) if variant == "light" else 1 - np.clip((lum - 0.08) / 0.37, 0, 1)
    mask = 0.25 + 0.75 * bare
    out = a * (1 - 0.35 * mask[..., None]) + rainbow * (0.35 * mask[..., None]) if variant == "light" else a + rainbow * (0.15 * mask[..., None])
    rng = np.random.default_rng(seed)
    spark = (rng.random((h, w)) > 0.994) * mask
    out = np.clip(out + spark[..., None] * 0.8, 0, 1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8))


def rounded(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], r, fill=255)
    out = im.convert("RGBA")
    out.putalpha(m)
    return out


def main():
    flat("light", TEX).save(os.path.join(HERE, "genesis-sticker-light.png"))
    flat("dark", TEX).save(os.path.join(ITEMS, "merch-genesis-sticker-dark.webp"), "WEBP", quality=90)
    for i, variant in enumerate(("light", "dark")):
        s = rounded(sheen(flat(variant, SPRITE), variant, 7 + i), 20)
        s.save(os.path.join(ITEMS, f"merch-genesis-sticker-{variant}-sprite.webp"), "WEBP", quality=90)
    print("sticker art written")


main()
