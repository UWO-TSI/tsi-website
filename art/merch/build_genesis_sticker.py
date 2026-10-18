"""The GENESIS sticker (specs/merch/genesis-sticker.md): a thin card printed with David's art (art/merch/sticker_art.py).

  python3 art/merch/sticker_art.py
  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/merch/build_genesis_sticker.py

Writes web/public/assets/game/items/merch-genesis-sticker.glb. One unit is 10 cm: the card is 7.5 x 6 cm (the print's
1350:1080), 0.4 mm thick, its corners rounded 3 mm, standing upright with its middle at the origin and the print facing
+z. Node genesis_sticker; materials M_Sticker (the light print, the face; the dark print is swapped in at runtime and
the holographic foil is a shader on this material, components/game/GenesisSticker.tsx) and P_Paint (the backing paper
and the edge).
"""
import math, os, sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402

OUT = "game/items/merch-genesis-sticker.glb"
W, H, T, R = 0.75, 0.6, 0.004, 0.03
BACKING = "#ece9e2"


def outline(n_corner=6):
    """The card's rounded rectangle, counter-clockwise from the bottom right corner's start."""
    pts = []
    for cx, cy, a0 in ((W / 2 - R, -H / 2 + R, -90), (W / 2 - R, H / 2 - R, 0), (-W / 2 + R, H / 2 - R, 90), (-W / 2 + R, -H / 2 + R, 180)):
        for i in range(n_corner + 1):
            a = math.radians(a0 + 90 * i / n_corner)
            pts.append((cx + R * math.cos(a), cy + R * math.sin(a)))
    return pts


def main():
    K.reset()
    img = bpy.data.images.load(os.path.join(HERE, "genesis-sticker-light.png"))
    face = K.Mat("M_Sticker", "#ffffff", rough=0.35, tex=img, double=False)
    paper = K.Mat("P_Paint", "#ffffff", rough=0.8, double=False)
    k = K.Kit("genesis_sticker")
    pts = outline()
    uv = lambda x, y: (x / W + 0.5, y / H + 0.5)
    front = [k.vert((x, y, T / 2)) for x, y in pts]
    back = [k.vert((x, y, -T / 2)) for x, y in pts]
    cf, cb = k.vert((0, 0, T / 2)), k.vert((0, 0, -T / 2))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        k.face([cf, front[i], front[j]], [uv(0, 0), uv(*pts[i]), uv(*pts[j])], face, "#ffffff")
        k.face([cb, back[j], back[i]], [(0.5, 0.5)] * 3, paper, BACKING)
        k.face([front[i], back[i], back[j], front[j]], [(0.5, 0.5)] * 4, paper, BACKING)
    ob = k.finish(name="genesis_sticker", smooth_deg=30)
    print("tris", sum(len(p.vertices) - 2 for p in ob.data.polygons))
    K.export([ob], OUT)


main()
