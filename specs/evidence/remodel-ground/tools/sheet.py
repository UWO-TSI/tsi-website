"""Remodel-ground evidence sheets: the game's own frame before (the dump's ground) and after (ours) from the same camera
(shots.mjs), and the textures themselves, the dump's beside ours, tiled 2 x 2 so a seam or a repeat would show.

  python3 specs/evidence/remodel-ground/tools/sheet.py <shots-dir> <out-dir> <sheet>=<shot.scene>[,<shot.scene>...] ...
  python3 specs/evidence/remodel-ground/tools/sheet.py --textures <out-dir> <sheet>=<key>[,<key>...] ...

<key>: a lib/game/groundTextures.ts texture name (grassNormal, sand, ...). Writes <out-dir>/<sheet>.webp.
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
PUB = os.path.join(ROOT, "web", "public")
FONT = os.path.join(PUB, "fonts", "nunito", "Nunito-Variable.ttf")
INK, SUB, BG = (52, 44, 36), (110, 98, 84), (244, 239, 227)
PAD = 12


def font(size, bold=False):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([800 if bold else 500])
    except Exception:
        pass
    return f


def files():
    """The two sets' files, read from lib/game/groundTextures.ts so the sheet shows what the game loads."""
    src = open(os.path.join(ROOT, "web", "lib", "game", "groundTextures.ts")).read()
    out = {}
    for set_ in ("dump", "own"):
        body = re.search(rf"\n  {set_}: \{{(.*?)\n  \}},", src, re.S).group(1)
        table = {}
        for key, val in re.findall(r"(\w+): (null|`[^`]*`|\"[^\"]*\")", body):
            if val == "null":
                table[key] = None
                continue
            v = val.strip("`\"").replace("${ACNH}", "/assets/acnh/").replace("${OWN}", "/assets/game/terrain/")
            table[key] = v
        out[set_] = table
    return out


def label(im, text, sub=None):
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8, 8, 8 + 18 + d.textlength(text, font=font(22, True)), 44), 8, fill=(255, 255, 255))
    d.text((17, 12), text, fill=INK, font=font(22, True))
    if sub:
        d.text((10, im.height - 26), sub, fill=(255, 255, 255), font=font(15), stroke_width=2, stroke_fill=(0, 0, 0))
    return im


def shots_sheet(shots, out, name, items):
    rows = []
    for item in items:
        pair = []
        for phase in ("before", "after"):
            p = os.path.join(shots, f"{item}.{phase}.png")
            im = Image.open(p).convert("RGB") if os.path.exists(p) else Image.new("RGB", (1200, 760), (220, 214, 200))
            im = im.resize((720, round(im.height * 720 / im.width)), Image.LANCZOS)
            pair.append(label(im, f"{item.split('.')[0]} · {'the dump' if phase == 'before' else 'ours'}", item.split(".")[1]))
        rows.append(pair)
    w = PAD + 2 * (720 + PAD)
    h = PAD + sum(r[0].height + PAD for r in rows)
    sheet = Image.new("RGB", (w, h), BG)
    y = PAD
    for a, b in rows:
        sheet.paste(a, (PAD, y))
        sheet.paste(b, (PAD * 2 + 720, y))
        y += a.height + PAD
    path = os.path.join(out, f"{name}.webp")
    sheet.save(path, quality=88)
    print("wrote", path, sheet.size)


def quilt():
    """The dump set's lawn albedo, lib/game/grassTexture.ts's triangle quilt, redrawn here (its per-pixel jitter left
    out): 16 px cells split on a flipping diagonal, three tones, a warm or cool lean per triangle."""
    n, tri = 256, 16
    y, x = np.mgrid[0:n, 0:n]
    cx, cy, lx, ly = x // tri, y // tri, x % tri, y % tri
    flip = (cx + cy) % 2 == 0
    half = np.where(flip, lx + ly < tri, lx >= ly)
    half = np.where(half, 0, 1).astype(np.int64)
    h = (cx.astype(np.int64) * 374761393 + cy.astype(np.int64) * 668265263 + half * 97) & 0xFFFFFFFF
    h = (((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF)
    h = (h ^ (h >> 16)) & 0xFFFFFFFF
    tone = np.array([0.87, 0.94, 1.0])[h % 3]
    lean = (h >> 4) % 3
    r = np.where(lean == 1, 244, np.where(lean == 2, 222, 232)) * tone
    b = np.where(lean == 1, 206, np.where(lean == 2, 232, 218)) * tone
    return np.stack([r, tone * 250, b], -1) / 255


def swatch(url, size=300):
    """A texture tiled 2 x 2 at `size`; an alpha mask on grey, a normal map as it is."""
    if url is None:
        src = Image.fromarray((quilt() * 255).astype(np.uint8)).convert("RGBA")
    else:
        src = Image.open(os.path.join(PUB, url.lstrip("/"))).convert("RGBA")
    a = np.asarray(src, dtype=np.float64) / 255
    if a[..., :3].max() - a[..., :3].min() < 0.01 or (a[..., 3].min() < 0.99 and a[..., :3].std() < 0.01):
        rgb = np.repeat(a[..., 3:4], 3, -1)  # an alpha mask
    else:
        rgb = a[..., :3] * a[..., 3:4] + (1 - a[..., 3:4]) * 0.45
    im = Image.fromarray((rgb * 255).astype(np.uint8))
    w, h = im.size
    tiled = Image.new("RGB", (w * 2, h * 2))
    for i in range(2):
        for j in range(2):
            tiled.paste(im, (i * w, j * h))
    if w / h > 4:  # a strip (the grass drape): show a slice of it, tall enough to read
        tiled = im.crop((0, 0, h * 4, h)).resize((size, size // 4), Image.NEAREST)
        return tiled
    return tiled.resize((size, size), Image.LANCZOS)


def texture_sheet(out, name, keys):
    t = files()
    S = 300
    rows = []
    for key in keys:
        a, b = swatch(t["dump"][key], S), swatch(t["own"][key], S)
        rows.append((key, a, b))
    w = PAD + 200 + 2 * (S + PAD)
    h = PAD + 40 + sum(max(a.height, b.height) + PAD for _, a, b in rows)
    sheet = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(sheet)
    d.text((PAD + 200, PAD), "the dump", fill=INK, font=font(20, True))
    d.text((PAD * 2 + 200 + S, PAD), "ours", fill=INK, font=font(20, True))
    y = PAD + 40
    for key, a, b in rows:
        d.text((PAD, y + 4), key, fill=INK, font=font(18, True))
        own = t["own"][key]
        if own:
            im = Image.open(os.path.join(PUB, own.lstrip("/")))
            d.text((PAD, y + 30), f"{im.size[0]}x{im.size[1]} {im.mode}", fill=SUB, font=font(14))
            d.text((PAD, y + 50), os.path.basename(own), fill=SUB, font=font(14))
        sheet.paste(a, (PAD + 200, y))
        sheet.paste(b, (PAD * 2 + 200 + S, y))
        y += max(a.height, b.height) + PAD
    path = os.path.join(out, f"{name}.webp")
    sheet.save(path, quality=90)
    print("wrote", path, sheet.size)


if __name__ == "__main__":
    if sys.argv[1] == "--textures":
        out = sys.argv[2]
        os.makedirs(out, exist_ok=True)
        for spec in sys.argv[3:]:
            name, keys = spec.split("=")
            texture_sheet(out, name, keys.split(","))
    else:
        shots, out = sys.argv[1:3]
        os.makedirs(out, exist_ok=True)
        for spec in sys.argv[3:]:
            name, items = spec.split("=")
            shots_sheet(shots, out, name, items.split(","))
