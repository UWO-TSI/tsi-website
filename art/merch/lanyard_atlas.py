"""The TSI lanyard's print, packed for the GPU (specs/merch/tsi-lanyard.md). David's print files are the whole strap end to
end, 32400 x 720 each (90 cm by 2 cm), white artwork on black. Each side is resampled to 4590 x 102 (45:1) and cut into
rows of 1024, stacked into one 1024 x 1024 atlas: the outside (GENESIS / TETHOS / the mark) in rows 0-4, the inside (the
quote) in rows 5-9. The black is the strap: navy from David's photo, the artwork white over it. The last rows (1020 on)
are plain navy, for the strap's edges.

  python3 art/merch/lanyard_atlas.py        (writes art/merch/lanyard-atlas.png; build_lanyard.py packs it in the GLB)
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "..", "..", "references", "merch", "tsi-lanyard")
SIZE, ROW = 1024, 102                       # the atlas, and one row: the strap's width
LENGTH = 45 * ROW                           # one side, resampled
NAVY = np.array([0x2b, 0x37, 0x57], dtype=np.float32)       # the strap (David's photo, a little darker than in sunlight)
INK = np.array([0xf2, 0xf2, 0xef], dtype=np.float32)        # the print's white

Image.MAX_IMAGE_PIXELS = None


def side(name):
    im = Image.open(os.path.join(REF, f"lanyard-print-{name}.png")).convert("L")
    m = np.asarray(im.resize((LENGTH, ROW), Image.LANCZOS), dtype=np.float32) / 255.0
    return np.clip(m / max(m.max(), 1e-6), 0.0, 1.0)         # the inside's white is a little grey in the file: to full


def main():
    atlas = np.zeros((SIZE, SIZE), dtype=np.float32)
    for k, name in enumerate(("outside", "inside")):
        m = side(name)
        for r in range(5):
            seg = m[:, r * SIZE:(r + 1) * SIZE]
            atlas[(k * 5 + r) * ROW:(k * 5 + r) * ROW + ROW, :seg.shape[1]] = seg
    rgb = NAVY[None, None, :] * (1 - atlas[..., None]) + INK[None, None, :] * atlas[..., None]
    Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(HERE, "lanyard-atlas.png"))
    print("atlas", SIZE, "rows of", ROW, "one side", LENGTH)


main()
