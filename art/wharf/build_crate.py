"""The fish crate on the pier for the arrival's walk-along (specs/v1-drop.md §1.5 step 2: "Crate on the pier: you jump it").

A long, low slatted fish box of weathered boards, lidded, that fills the deck between the rope rails so the way up the
pier is over it: corner posts, three slats a side with gaps, a planked lid with two battens, rope grab-handles at the
ends, and a wet net slung over one corner. Matte throughout (roughness 1). Built with the café's kit (cafekit) and the
wharf's rope texture so it sits with the pier.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_crate.py

Writes web/public/assets/game/wharf/crate.glb. Frame: the crate's own, centred on x and z, its foot at y 0 (the deck's
top), the long side along x: x across the pier (1.62), y up (0.5, the lid's top), z along it (0.56). Mirrored in
components/game/arrival (CRATE).
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cafekit as K  # noqa: E402
from cafekit import Mat, Model  # noqa: E402
from build_wharf import rope_texture  # noqa: E402

K.OUT = os.path.join(K.ROOT, "web", "public", "assets", "game", "wharf")
W, H, D = 1.62, 0.5, 0.56          # across, up, along
rng = np.random.default_rng(2611)


def weathered(size, seed):
    """Grey-brown boards bleached by salt: the café's wood, silvered toward the board ends, a few dark knots."""
    base = K.wood(size, "#6f5841", "#b39572", seed=seed, planks=4, joint="#3b2d22", joint_px=3, streak=0.55)
    Y = np.arange(size)[:, None] / size
    silver = (np.abs(Y - 0.5) * 2) ** 3 * 0.35
    base = base * (1 - silver[..., None]) + np.array(K.hexrgb("#b9b2a2")) * silver[..., None]
    for _ in range(5):
        cx, cy, r = rng.integers(0, size), rng.integers(0, size), rng.integers(4, 9)
        yy, xx = np.ogrid[:size, :size]
        m = np.clip(1 - np.sqrt((xx - cx) ** 2 + ((yy - cy) * 0.6) ** 2) / r, 0, 1)[..., None]
        base = base * (1 - 0.55 * m) + np.array(K.hexrgb("#3e2f22")) * 0.55 * m
    return base


def net_texture():
    """A knotted net: diamond mesh of tarred cord on nothing (the alpha is the cord), a little irregular."""
    S = 256
    u = (np.arange(S) + 0.5) / S
    U, V = np.meshgrid(u, u)
    a = np.abs(((U + V) * 6) % 1 - 0.5)
    b = np.abs(((U - V) * 6) % 1 - 0.5)
    cord = np.clip(1 - np.minimum(a, b) / 0.07, 0, 1)
    knot = np.clip(1 - np.maximum(a, b) / 0.12, 0, 1) * (np.minimum(a, b) < 0.1)
    v = np.clip(cord + knot, 0, 1)
    rgb = np.zeros((S, S, 3)) + np.array(K.hexrgb("#4a5a4c")) * (0.75 + 0.25 * v[..., None])
    return rgb, v


def build():
    K.reset()
    wood = Mat("M_CrateWood", "#93785a", 1.0, K.image("crate_wood", weathered(512, 7)), tile=0.9)
    post = Mat("M_CratePost", "#6d563f", 1.0, K.image("crate_post", weathered(256, 11) * 0.82), tile=0.6)
    rope = Mat("M_Rope", "#c7a268", 1.0, K.image("crate_rope", rope_texture()), tile=0.25)
    net = Mat("M_Net", "#4a5a4c", 1.0)
    m = Model("FishCrate", smooth=30)
    hw, hd = W / 2, D / 2
    # Corner posts.
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((sx * (hw - 0.035), H / 2 - 0.02, sz * (hd - 0.035)), (0.07, H - 0.04, 0.07), post, bevel=0.012)
    # Slats, three a side with gaps, each its own little set and tilt.
    for i, y in enumerate((0.075, 0.215, 0.355)):
        for sz in (-1, 1):
            t = 0.105 + rng.uniform(-0.006, 0.006)
            f = m.box((rng.uniform(-0.01, 0.01), y, sz * (hd - 0.012)), (W - 0.03, t, 0.024), wood, bevel=0.006)
            m.rot(f, (0, y, sz * hd), "z", rng.uniform(-0.008, 0.008))
        for sx in (-1, 1):
            m.box((sx * (hw - 0.012), y, 0), (0.024, 0.105, D - 0.09), wood, bevel=0.006)
    # The floor, inside.
    m.box((0, 0.02, 0), (W - 0.06, 0.03, D - 0.06), post)
    # The lid: five boards across, two battens under, sitting a hair proud.
    n = 5
    for i in range(n):
        x0 = -hw + 0.01 + i * (W - 0.02) / n
        f = m.box((x0 + (W - 0.02) / n / 2, H - 0.022, rng.uniform(-0.006, 0.006)), ((W - 0.02) / n - 0.012, 0.03, D + 0.02), wood, bevel=0.008)
        m.rot(f, (x0, H, 0), "z", rng.uniform(-0.01, 0.01))
    for sx in (-0.55, 0.55):
        m.box((sx * hw, H - 0.05, 0), (0.06, 0.026, D - 0.06), post)
    # Rope grab-handles through the ends.
    for sx in (-1, 1):
        x = sx * (hw + 0.012)
        pts = [(x, 0.3, -0.12), (x + sx * 0.05, 0.27, -0.09), (x + sx * 0.07, 0.24, 0.0), (x + sx * 0.05, 0.27, 0.09), (x, 0.3, 0.12)]
        m.tube(pts, 0.018, rope, n=8)
    # A wet net slung over the +x end: a few draped cords as a sheet (alpha-free, its holes as dark cord over the wood).
    for k in range(7):
        z = -hd + 0.06 + k * (D - 0.12) / 6
        pts = [(hw - 0.42 + rng.uniform(-0.03, 0.03), H + 0.012, z), (hw - 0.1, H + 0.016, z + 0.01), (hw + 0.02, H - 0.06, z + rng.uniform(-0.02, 0.02)),
               (hw + 0.04, 0.24 + rng.uniform(-0.04, 0.04), z + rng.uniform(-0.03, 0.03))]
        m.tube(pts, 0.009, net, n=5, caps=False)
    for y in (H + 0.014, H - 0.08, 0.32):
        x = hw - 0.25 if y > H else hw + 0.035
        m.tube([(x, y, -hd + 0.05), (x + 0.004, y, 0), (x, y, hd - 0.05)], 0.008, net, n=5, caps=False)
    ob = m.finish()
    K.export([ob], "crate")


build()
