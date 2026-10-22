"""Shop icons for David's whole faces (wardrobe batch 2, face_set_b2.py): each priced face's eyes, mouth and accent at
their anchors on the skin, drawn as the creator's face tiles draw one part (CreatorControls FaceArt: the atlas cells
round their anchors, a tile framed on the parts' bounds, on a soft skin blob), all three together.

  python3 art/characters/v7/face_icons.py        (after build_face.py; reads web/data/characters/face_v7.json)

Writes web/public/assets/icons/face-<id>.webp (256 px, transparent): the shop row's sprite_url (lib/icons/keys.ts
iconKey). Free faces have no shop row and get none. Also the hair colour wheel's shop icon (colour-wheel.webp, David
2026-10-17: a 250-Gem unlock): the creator's wheel, hue round and saturation out from a white centre.
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
WEB = os.path.join(ROOT, "web")
FACE = json.load(open(os.path.join(WEB, "data", "characters", "face_v7.json")))
PRICES = json.load(open(os.path.join(ROOT, "specs", "wardrobe", "batch2-pricing.json")))["items"]
PALETTE = json.load(open(os.path.join(ROOT, "art", "characters", "palette.json")))
SKIN = PALETTE["skin"][PALETTE["base_body_defaults"]["skin"]]
OUT = os.path.join(WEB, "public", "assets", "icons")
SIZE, SS = 256, 4                       # icon px, supersampling
PAGES = {0: os.path.join(HERE, "face", FACE["atlas"]), 1: os.path.join(HERE, "face", FACE["atlas2"])}


def pieces(face):
    """[(cell, anchor, mirror)] for the face's eyes, mouth and accents (FaceArt's rules for each layer)."""
    L, A = FACE["layers"], FACE["anchors"]
    out = []
    eyes = L["eyes"]["items"][face["eyes"]]
    if eyes.get("left", 0) is None:
        out.append((eyes["open"], A["eye_pair"], False))
    elif eyes.get("left"):
        out += [(eyes["open"], A["eye"], False), (eyes["left"], A["eye_left"], False)]
    else:
        out.append((eyes["open"], A["eye"], True))
    if face["mouth"]:
        out.append((L["mouth"]["items"][face["mouth"]], A["mouth"], False))
    for x in face["extras"]:
        it = L["extras"]["items"][x]
        out.append((it["cell"], A[it["anchor"]], it["mirror"]))
    return out


def rects(face):
    """Each cell's box on the face canvas (u0, w0, u1, w1), flipped for a mirrored copy."""
    k = 1 / FACE["density"]
    out = []
    for cell, (au, aw), mirror in pieces(face):
        _, _, w, h, ax, ay = cell[:6]
        r = (cell, au - ax * k, aw - ay * k, au - ax * k + w * k, aw - ay * k + h * k, False)
        out.append(r)
        if mirror:
            out.append((cell, 1 - r[3], r[2], 1 - r[1], r[4], True))
    return out


def blob(px):
    """The skin tile: an organic round blob, lit from the upper left (the face tile's CSS), on transparency."""
    rgb = np.array([int(SKIN[i:i + 2], 16) for i in (1, 3, 5)], float)
    yy, xx = np.mgrid[0:px, 0:px] / px
    d = np.clip(np.hypot(xx - 0.42, yy - 0.36) / 0.75, 0, 1)
    col = (rgb + (255 - rgb) * 0.2) * (1 - d[..., None]) + rgb * d[..., None]
    img = Image.fromarray(np.dstack([col, np.full((px, px), 255.0)]).astype(np.uint8), "RGBA")
    mask = Image.new("L", (px, px), 0)
    m = px * 0.06
    ImageDraw.Draw(mask).rounded_rectangle((m, m, px - m, px - m), radius=px * 0.44, fill=255)
    img.putalpha(mask)
    return img


def icon(face, atlases):
    rs = rects(face)
    u0, u1 = min(r[1] for r in rs), max(r[3] for r in rs)
    w0, w1 = min(r[2] for r in rs), max(r[4] for r in rs)
    span = max(u1 - u0, w1 - w0, 0.5) * 1.5
    cu, cw = (u0 + u1) / 2, (w0 + w1) / 2
    px = SIZE * SS
    img = blob(px)
    for cell, a, b, c, d, flip in rs:
        x, y, w, h = cell[:4]
        part = atlases[cell[6] if len(cell) > 6 else 0].crop((x, y, x + w, y + h))
        if flip:
            part = part.transpose(Image.FLIP_LEFT_RIGHT)
        box = (round((a - (cu - span / 2)) / span * px), round((b - (cw - span / 2)) / span * px),
               round((c - (cu - span / 2)) / span * px), round((d - (cw - span / 2)) / span * px))
        part = part.resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
        layer = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        layer.paste(part, box[:2])
        layer.putalpha(Image.fromarray(np.minimum(np.array(layer.getchannel("A")), np.array(img.getchannel("A")))))
        img = Image.alpha_composite(img, layer)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def wheel():
    """The colour wheel's icon: a disc of hue (round) and saturation (out from the centre) on a cream rim."""
    px = SIZE * SS
    yy, xx = np.mgrid[0:px, 0:px] + 0.5
    dx, dy = (xx - px / 2) / (px * 0.40), (yy - px / 2) / (px * 0.40)
    r = np.hypot(dx, dy)
    h = (np.degrees(np.arctan2(dx, -dy)) % 360) / 60.0
    s = np.clip(r, 0, 1)
    c = s
    x = c * (1 - np.abs(h % 2 - 1))
    k = np.floor(h).astype(int) % 6
    rgb = np.zeros((px, px, 3))
    for i, (a, b, d) in enumerate([(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)]):
        m = k == i
        for ch, v in enumerate((a, b, d)):
            rgb[..., ch][m] = (v[m] if isinstance(v, np.ndarray) else v)
    rgb += (1 - c)[..., None]
    img = np.dstack([rgb * 255, np.zeros((px, px))])
    rim = (r <= 1.12)
    img[rim & (r > 1.0), :3] = (243, 233, 210)        # the cream rim (palette: Tethos cream #F3E9D2)
    img[..., 3] = np.where(rim, 255, 0)
    out = Image.fromarray(img.astype(np.uint8), "RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(OUT, "colour-wheel.webp")
    out.save(path, "WEBP", quality=90, method=6)
    print("WHEEL_ICON", path)


def main():
    atlases = {p: Image.open(f).convert("RGBA") for p, f in PAGES.items()}
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for key, face in FACE["faces"].items():
        if PRICES.get(key, {}).get("mode") not in ("coins", "gems"):
            continue
        path = os.path.join(OUT, f"face-{face['id'].replace('_', '-')}.webp")
        icon(face, atlases).save(path, "WEBP", quality=90, method=6)
        n += 1
        print("FACE_ICON", key, path)
    print("FACE_ICONS_OK", n)
    wheel()


if __name__ == "__main__":
    main()
