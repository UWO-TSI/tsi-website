"""The fixed-colour atlas (wardrobe batch 2, specs/playtest-round1.md "New wardrobe batch"): David's Roblox accessories,
and a hairstyle's own hat, keep their textures as drawn. One shared sRGB atlas the body material samples (Character.tsx):
a vertex whose u is 2 or more takes the atlas texel at (u - 2, v), never tinted, so every textured accessory still
merges into the one body geometry and draw.

  colour_atlas.claim(key, rgba)          the source texture region (sRGB, top row first) resampled into key's tile
  colour_atlas.put(key, rgba)            a tile's inner square drawn here, written as it is
  colour_atlas.remap(me, key, crop)      the mesh's UVs (inside `crop` of its texture) moved into the tile, + 2 on u
  colour_atlas.save()                    writes colour_atlas.png (loads the existing one first: each importer writes
                                         only its own tiles)

Tiles are power-of-two squares packed by a buddy allocator in TILES order (largest first), so a tile's place never
depends on which importer ran. Each tile keeps PAD texels of its edge colour round it (mipmaps never bleed a neighbour).
Blender-only (bpy images resample and write the PNG).
"""
import os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "colour_atlas.png")
W, H = 2048, 1024
PAD = 8
# key: tile size (px). Detail where the drawing needs it: line art (the paper and drawn hats) and patterns (the plaid)
# at 512, textured hats and props at 256, flat-coloured glasses and sprigs at 128.
TILES = {
    "hair_goggle_ushanka": 512, "acc_plaid_scarf": 512, "acc_drawn_top_hat": 512, "acc_red_band_straw_hat": 512,
    "acc_propeller_cap": 256, "acc_paper_tie": 256, "acc_crew_visor": 256, "acc_paper_bowtie": 256, "acc_wheat_stalk": 256,
    "acc_gold_monocle": 256, "acc_bandage_blindfold": 256, "acc_paper_horns": 256, "acc_bear_hood": 256, "acc_cowboy_hat": 256,
    "acc_woven_hat": 256, "acc_monkey_ears": 256,
    "acc_green_sprout": 128, "acc_thin_glasses": 128, "acc_half_rim_glasses": 128, "acc_square_shades": 128,
    "acc_gold_rimless_shades": 128, "acc_apple_stem": 128,
    "acc_half_rim_glasses_silver": 128,          # round 2: last, so no earlier tile moves
    "acc_crew_visor_logo": 256,                  # #04's logo on its own (accessories/arches_logo.py): last, so no tile moves
}


def layout():
    """key -> (x, y, size): buddy allocation of the squares in TILES order."""
    free = [(x, 0, H) for x in range(0, W, H)]          # the atlas as H-sized squares
    out = {}
    for key, s in TILES.items():
        free.sort(key=lambda q: (q[2], q[1], q[0]))
        i = next(k for k, q in enumerate(free) if q[2] >= s)
        x, y, q = free.pop(i)
        while q > s:
            q //= 2
            free += [(x + q, y, q), (x, y + q, q), (x + q, y + q, q)]
        out[key] = (x, y, s)
    return out


LAYOUT = layout()
_atlas = None


def _load():
    global _atlas
    if _atlas is not None:
        return _atlas
    _atlas = np.zeros((H, W, 4), np.float32)
    _atlas[..., 3] = 1.0
    if os.path.exists(PATH):
        import bpy
        im = bpy.data.images.load(PATH)
        im.colorspace_settings.name = "Non-Color"
        if tuple(im.size) == (W, H):
            _atlas = np.array(im.pixels[:], np.float32).reshape(H, W, 4)[::-1].copy()
        bpy.data.images.remove(im)
    return _atlas


def _resample(rgba, size):
    """[h, w, 4] -> [size, size, 4] (Blender's image scaler: a filtered resample)."""
    import bpy
    h, w = rgba.shape[:2]
    im = bpy.data.images.new("colour_atlas_tmp", w, h, alpha=True, float_buffer=True)
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).reshape(-1))
    im.scale(size, size)
    out = np.array(im.pixels[:], np.float32).reshape(size, size, 4)[::-1].copy()
    bpy.data.images.remove(im)
    return out


def claim(key, rgba):
    """Write `rgba` (a texture region, sRGB values, top row first) into key's tile, edges extended over the padding."""
    x, y, s = LAYOUT[key]
    inner = s - 2 * PAD
    a = _load()
    t = _resample(np.clip(rgba, 0, 1).astype(np.float32), inner)
    t[..., 3] = 1.0
    block = np.pad(t, ((PAD, PAD), (PAD, PAD), (0, 0)), mode="edge")
    a[y:y + s, x:x + s] = block


def put(key, rgba):
    """Write `rgba` (sRGB values, top row first), already the tile's inner size, into key's tile as it is (no resample),
    edges extended over the padding."""
    x, y, s = LAYOUT[key]
    t = np.clip(rgba, 0, 1).astype(np.float32).copy()
    assert t.shape[:2] == (s - 2 * PAD, s - 2 * PAD), (key, t.shape)
    t[..., 3] = 1.0
    _load()[y:y + s, x:x + s] = np.pad(t, ((PAD, PAD), (PAD, PAD), (0, 0)), mode="edge")


def crop_of(me, w, h, margin=4):
    """The pixel box [x0, y0, x1, y1) (top row first) of the texture the mesh's UVs sample, with a margin."""
    uv = np.array([d.uv[:] for d in me.uv_layers.active.data], np.float64)
    u = np.clip(uv[:, 0], 0, 1) * w
    v = (1 - np.clip(uv[:, 1], 0, 1)) * h
    x0, x1 = max(0, int(np.floor(u.min())) - margin), min(w, int(np.ceil(u.max())) + margin)
    y0, y1 = max(0, int(np.floor(v.min())) - margin), min(h, int(np.ceil(v.max())) + margin)
    return x0, y0, max(x1, x0 + 1), max(y1, y0 + 1)


def remap(me, key, crop, size, loops=None):
    """UVs (of `loops`, default all) inside `crop` of a w x h texture moved into key's tile, u + 2 (the body shader's
    fixed-colour marker)."""
    x, y, s = LAYOUT[key]
    inner = s - 2 * PAD
    w, h = size
    x0, y0, x1, y1 = crop
    data = me.uv_layers.active.data
    for li in (range(len(data)) if loops is None else loops):
        d = data[li]
        px = min(max(d.uv.x, 0.0), 1.0) * w
        py = (1 - min(max(d.uv.y, 0.0), 1.0)) * h
        ax = x + PAD + (px - x0) / (x1 - x0) * inner
        ay = y + PAD + (py - y0) / (y1 - y0) * inner
        d.uv = (2.0 + ax / W, 1.0 - ay / H)


def save():
    import bpy
    a = _load()
    im = bpy.data.images.new("colour_atlas", W, H, alpha=True, float_buffer=False)
    im.colorspace_settings.name = "sRGB"
    im.pixels.foreach_set(np.ascontiguousarray(np.clip(a[::-1], 0, 1)).reshape(-1))
    im.filepath_raw = PATH
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)
