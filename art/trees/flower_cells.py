"""The petal atlas's cells (art/trees/textures/petals.png, 512 x 512, 4 x 4 cells of 128 px from the top left), shared by
paint_textures.py (which paints them) and build_flowers.py (which maps cards onto them).

A petal cell holds one petal with its base at the bottom middle and its tip at the top; the floret cell one whole small
flower, centred; a leaf cell one leaf, base at the bottom; the centres cell four opaque discs in its quarters (CENTRES).
"""
CELLS = [
    "cosmos-pink", "cosmos-white", "mum-rust", "mum-gold",
    "rose-red", "centres", "windflower-white", "windflower-violet",
    "tulip-red", "tulip-butter", "pansy-violet", "pansy-face",
    "lily-cream", "hyacinth-floret", "leaf", "strap-leaf",
]
# The centres cell's quarters (Blender UV: left/right, bottom/top): a yellow disc, a dark eye with stamens, a green-gold
# button, a deep red bud.
CENTRES = {"yellow": (0, 1), "dark": (1, 1), "button": (0, 0), "bud": (1, 0)}


def uv(name):
    """The cell's rect in Blender UV space (v up): (u0, v0, u1, v1)."""
    i = CELLS.index(name)
    c, r = i % 4, i // 4
    return (c / 4, 1 - (r + 1) / 4, (c + 1) / 4, 1 - r / 4)


def centre_uv(name):
    u0, v0, u1, v1 = uv("centres")
    qx, qy = CENTRES[name]
    hu, hv = (u1 - u0) / 2, (v1 - v0) / 2
    return (u0 + qx * hu, v0 + qy * hv, u0 + (qx + 1) * hu, v0 + (qy + 1) * hv)
