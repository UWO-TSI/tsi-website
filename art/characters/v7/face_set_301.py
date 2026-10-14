"""Face set 301 (ledger row 301, David 2026-10-07): new creator face parts remodelled from two Roblox shop heads
(references/characters/david/roblox/2026-10-07-sleepy-kitty-head.png, ...-heads-marketplace-grin.png).

"just the face, like eye and mouth and accent for the pink blush, dont take head shape and no animation"

Only the idea of each part is taken; every one is redrawn here in the v7 face's own style (its line colours, tapered
strokes and authoring frame). No Roblox texture is sampled or shipped. All are static: the eyes have no blink frames,
like E8.1 and E6.1.

  eyes    sleepy_lash   a heavy shut lid, bowed down, with three lashes fanning out at the outer corner
          dot           a small plain dot
  extras  blush_band    one soft pink band across both cheeks and the bridge of the nose, under the eyes

Its two mouths (the cat mouth cat_w and the curled grin grin_curl) were cut in David's wardrobe cut (playtest round 1,
2026-10-14).

build_face.py imports this file (`parts(globals())`) and packs these cells in a band BELOW the legacy atlas, so every
earlier cell keeps its exact rect and pixels (old saved looks render unchanged). Rebuild with build_face.py.
"""
import numpy as np

# The order here is the order in the creator (after the earlier styles).
EYES = ["sleepy_lash", "dot"]
MOUTHS = []
EXTRAS = ["blush_band"]
NAMES = {"sleepy_lash": "Sleepy lashes", "dot": "Dot eyes", "blush_band": "Blush band"}


def parts(g):
    """Drawing functions for the set, using build_face.py's helpers (`g` is its globals()). Returns
    (eyes, mouths, extras, anchors, kinds): eyes map id -> fn(L), mouths id -> fn(L) (none left); extras map id -> (kind, mirror, fn);
    anchors and kinds (K, AUTH, BOX per layer kind) are the new entries build_face.py adds to its tables."""
    P, bez, taper, hex_srgb = g["P"], g["bez"], g["taper"], g["hex_srgb"]
    C_DOLL = g["C_DOLL"]
    C_ROSE = hex_srgb("#E8798E")     # the band: a deeper rose than the cheek blush (#F4A0A0), so it never glows on dark skin

    # ------------------------------------------------------------ eyes (the canvas-left eye; +dx is outward)
    def sleepy_lash(L):
        lid = bez([P(-0.078, 0.002), P(-0.03, 0.017), P(0.035, 0.019), P(0.084, 0.004)], 24)
        L.paint(L.stroke(lid, taper(len(lid), 0.007, 0.0125, 0.0065)), C_DOLL)
        for (bx, by), (tx, ty) in (((0.056, 0.012), (0.092, 0.03)), ((0.07, 0.009), (0.108, 0.02)), ((0.08, 0.005), (0.118, 0.004))):
            c = bez([P(bx, by), P((bx + tx) / 2 + 0.004, (by + ty) / 2 - 0.004), P(tx, ty)], 10)
            L.paint(L.stroke(c, taper(len(c), 0.0052, 0.0016)), C_DOLL)

    def dot(L):
        L.paint(L.ellipse(*P(0.0, 0.006), 0.023, 0.026), C_DOLL)

    # ------------------------------------------------------------ the blush band (one cell on the centre line)
    blush_anchor = (0.5, 0.72)       # between the eye line (0.614) and the cheek blush (0.789)

    def blush_band(L):
        du, dv = (L.U - blush_anchor[0]) / 0.3, (L.V - blush_anchor[1]) / 0.042
        r = (np.abs(du) ** 2.6 + np.abs(dv) ** 2.0) ** (1 / 2.0)
        soft = np.clip((1.0 - r) / 0.45, 0.0, 1.0)
        L.paint(soft * soft * (3 - 2 * soft), C_ROSE, 0.42)          # smoothstep edge, no hard line anywhere

    eyes = {"sleepy_lash": sleepy_lash, "dot": dot}
    mouths = {}
    extras = {"blush_band": ("blush", False, blush_band)}
    anchors = {"blush": blush_anchor}
    kinds = {"blush": dict(K=1.0, AUTH=blush_anchor, BOX=(0.34, 0.07))}
    assert list(eyes) == EYES and list(mouths) == MOUTHS and list(extras) == EXTRAS
    return eyes, mouths, extras, anchors, kinds
