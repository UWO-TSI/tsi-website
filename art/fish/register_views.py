"""Register a fish's concept views for Meshy (fish-models lane).

  python3 art/fish/register_views.py <dir> <fish>

Reads <dir>/<fish>-side.png, -top.png, -front.png (flat grey backgrounds, nose left). Cuts each background to alpha
(flood fill from the borders, so pale parts inside the fish stay), trims, and puts all views on one scale: side and top
share the nose-to-tail length (90% of a 1024 square), the front takes the side view's height. The far side is the side
view mirrored (fish are symmetric). Writes <dir>/meshy/<fish>-{side,far,front,top}.png (RGBA) and the review strip
<dir>/<fish>-views.png (the three generated views and the mirror, on grey).
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

d, fish = sys.argv[1], sys.argv[2]
N, LEN = 1024, 0.9 * 1024


def cut(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    bg = np.median(np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)]), axis=0)
    lab, _ = ndimage.label(np.abs(a - bg).sum(2) < 24)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    alpha = (~np.isin(lab, list(edge))).astype(np.uint8) * 255
    alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.7)))
    im = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), "RGBA")
    return im.crop(im.getbbox())


def place(im, scale):
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    out.paste(im, ((N - im.width) // 2, (N - im.height) // 2), im)
    return out


side, top, front = (cut(f"{d}/{fish}-{v}.png") for v in ("side", "top", "front"))
s = LEN / side.width
views = {"side": place(side, s), "top": place(top, LEN / top.width)}
views["front"] = place(front, side.height * s / front.height)
views["far"] = views["side"].transpose(Image.FLIP_LEFT_RIGHT)
os.makedirs(f"{d}/meshy", exist_ok=True)
for k, im in views.items():
    im.save(f"{d}/meshy/{fish}-{k}.png")
    print(k, im.getbbox())
strip = Image.new("RGB", (N * 4 + 48, N + 32), (200, 201, 203))
for i, k in enumerate(("side", "top", "front", "far")):
    strip.paste(views[k], (16 + i * (N + 8), 16), views[k])
strip.save(f"{d}/{fish}-views.png")
