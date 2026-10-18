"""The shop's trolley (ShopInterior's "shopping-cart" piece, by name through lib/game/propModels.ts REMODELLED_PIECES;
the homes' "Shopping cart"): our own timber handcart carrying a wicker basket. Replaces acnh/furniture/shopping-cart.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_shop_cart.py [-- review <dir>]

Writes web/public/assets/game/props/shop-cart.glb. Frame: like the other remodelled interior pieces, authored at the
size the dump piece shows at scale 0.1 (0.95 long, 1.03 tall, 0.57 wide), so a Piece keeps its dump scale and draws ours
at x 10; the origin on the floor under its middle, the cart along x with its wheels toward +x.

A shallow plank tray on two spoked wheels with iron tyres and an iron axle, two legs at the back, two shafts running
back into turned grips; in the tray an oval wicker basket with a rolled rim and a bent-cane handle. Three materials:
M_CartWood (grain; COLOR_0 stains each part), M_Wicker (woven wicker), M_Iron (worn iron).
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402
from propkit import TAU  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WHEEL_X, WHEEL_Z, WHEEL_R, WHEEL_W = 0.2, 0.245, 0.205, 0.036
TRAY_Y = 0.36                 # the tray floor's top
TRAY_X0, TRAY_X1, TRAY_HZ = -0.3, 0.36, 0.2
WOOD, DARK, PALE = "#a87b52", "#8a6242", "#c49a6c"


def build():
    K.reset()
    M = {
        "wood": K.Mat("M_CartWood", tex=K.image("cart_wood", K.grain(256, 128, 131, "#ffffff", knots=2)), rough=0.9),
        "wicker": K.Mat("M_Wicker", tex=K.image("cart_wicker", PK.wicker(256, 256, 132)), rough=0.95),
        "iron": K.Mat("M_Iron", tex=K.image("cart_iron", PK.iron(64, 64, 133)), rough=0.7),
    }
    k = K.Kit("shop-cart")
    # The wheels: a wooden felloe with an iron tyre, eight spokes, a hub; an iron axle between them.
    for z in (-WHEEL_Z, WHEEL_Z):
        c = (WHEEL_X, WHEEL_R, z - WHEEL_W / 2)
        ri, ro = WHEEL_R - 0.035, WHEEL_R - 0.008
        k.lathe(c, [(ri, 0.0), (ro, 0.0), (ro, WHEEL_W), (ri, WHEEL_W), (ri, 0.0)], M["wood"], DARK, d=(0, 0, 1), n=16, u_tiles=2, v_len=0.3)
        k.lathe(c, [(ro - 0.001, -0.002), (WHEEL_R, 0.002), (WHEEL_R, WHEEL_W - 0.002), (ro - 0.001, WHEEL_W + 0.002)], M["iron"], "#ffffff", d=(0, 0, 1), n=16, u_tiles=2, v_len=0.3)
        for j in range(8):
            a = TAU * j / 8 + 0.2
            p0 = (WHEEL_X + math.cos(a) * 0.03, WHEEL_R + math.sin(a) * 0.03, z)
            p1 = (WHEEL_X + math.cos(a) * (ri + 0.01), WHEEL_R + math.sin(a) * (ri + 0.01), z)
            k.tube([p0, p1], 0.008, M["wood"], WOOD, n=4, v_len=0.3, u_tiles=0.25)
        out = 1 if z > 0 else -1
        k.lathe((WHEEL_X, WHEEL_R, z - out * 0.025), [(0.0, 0.0), (0.034, 0.0), (0.036, 0.025), (0.026, 0.05), (0.0, 0.055)], M["wood"], DARK,
                d=(0, 0, out), n=10, u_tiles=0.5, v_len=0.3)
    k.tube([(WHEEL_X, WHEEL_R, -WHEEL_Z - 0.03), (WHEEL_X, WHEEL_R, WHEEL_Z + 0.03)], 0.012, M["iron"], "#ffffff", n=6, caps=True)
    # The tray: a plank floor and four low sides; two blocks carry it on the axle.
    k.rbox(((TRAY_X0 + TRAY_X1) / 2, TRAY_Y - 0.0125, 0), (TRAY_X1 - TRAY_X0, 0.025, 2 * TRAY_HZ), 0.006, M["wood"], PALE, segs=1, v_axis=0)
    for z in (-TRAY_HZ + 0.01, TRAY_HZ - 0.01):
        k.rbox(((TRAY_X0 + TRAY_X1) / 2, TRAY_Y + 0.05, z), (TRAY_X1 - TRAY_X0, 0.1, 0.02), 0.006, M["wood"], WOOD, segs=1, v_axis=0, uv_off=(0.2, z))
    for x in (TRAY_X0 + 0.01, TRAY_X1 - 0.01):
        k.rbox((x, TRAY_Y + 0.04, 0), (0.02, 0.08, 2 * TRAY_HZ - 0.04), 0.006, M["wood"], WOOD, segs=1, v_axis=2, uv_off=(x, 0.6))
    for z in (-0.16, 0.16):
        k.rbox((WHEEL_X, (WHEEL_R + TRAY_Y - 0.025) / 2, z), (0.06, TRAY_Y - 0.025 - WHEEL_R + 0.02, 0.035), 0.006, M["wood"], DARK, segs=1)
    # The shafts: under the tray from its front, back and up into the grips; two legs at the back.
    for z in (-0.17, 0.17):
        pts = [(TRAY_X1 - 0.02, TRAY_Y - 0.04, z), (0.0, TRAY_Y - 0.04, z), (TRAY_X0, TRAY_Y - 0.025, z), (-0.4, 0.5, z * 1.1)]
        k.tube(pts, 0.017, M["wood"], WOOD, n=6, v_len=0.6, u_tiles=0.5)
        k.lathe((-0.4, 0.5, z * 1.1), [(0.0, 0.0), (0.019, 0.0), (0.021, 0.04), (0.018, 0.09), (0.0, 0.1)], M["wood"], DARK,
                d=(-0.52, 0.85, 0), n=8, u_tiles=0.5, v_len=0.3)
        k.beam((-0.22, TRAY_Y - 0.04, z), (-0.24, 0.0, z * 1.05), 0.034, 0.03, 0.008, M["wood"], DARK, up=(1, 0, 0), segs=1)
    # The basket: oval, outside and in, a rolled rim, a bent-cane handle over it.
    bc = (0.02, TRAY_Y, 0.0)
    prof_out = [(0.0, 0.004), (0.13, 0.004), (0.165, 0.05), (0.19, 0.14), (0.205, 0.24)]
    prof_in = [(0.192, 0.24), (0.178, 0.14), (0.152, 0.05), (0.12, 0.018), (0.0, 0.018)]
    sx, sz = 1.25, 0.82          # the oval: long along x (the lathe's own sx/sz scale its z and x about an upright axis)
    k.lathe(bc, prof_out, M["wicker"], "#ffffff", n=16, u_tiles=3, v_len=0.24, sx=sz, sz=sx)
    k.lathe(bc, prof_in, M["wicker"], "#d6c4a6", n=16, u_tiles=3, v_len=0.24, sx=sz, sz=sx)
    rim = [(bc[0] + math.cos(TAU * j / 16) * 0.199 * sx, TRAY_Y + 0.245, math.sin(TAU * j / 16) * 0.199 * sz) for j in range(16)]
    k.tube(rim, 0.014, M["wicker"], "#c9a873", n=5, v_len=0.03, closed_path=True, u_tiles=0.3)
    hx = bc[0]
    hz = 0.199 * sz - 0.01
    arch = [(hx, TRAY_Y + 0.24 + 0.26 * math.sin(math.pi * t), -hz * math.cos(math.pi * t)) for t in np.linspace(0, 1, 11)]
    k.tube(arch, 0.012, M["wicker"], "#c9a873", n=6, v_len=0.03, u_tiles=0.3)
    k.tint_gradient(0.86, 1.0)
    ob = k.finish(smooth_deg=55)
    path = K.export([ob], "game/props/shop-cart.glb")
    print("SHOP_CART", {"top": TRAY_Y + 0.5 + 0.012})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "shop-cart.png"), views=((0, 14), (60, 26), (200, 24)))
