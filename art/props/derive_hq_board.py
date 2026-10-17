"""The member clubhouse's notice board (HQInterior `noticeBoard`, HQ_LAYOUT.board): the dump's metal-framed board kept
as it is (David, 2026-10-17, row 314: "I like the before, metal fits the interior, less on the textures"), its printed
notes and their text painted out to plain stickies until David's sticky designs come in. The applicant island's
clubhouse keeps the dump board untouched.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/derive_hq_board.py [-- review <dir>]

Writes web/public/assets/game/props/hq-notice-board.glb from acnh/furniture/bulletinboard.glb (art/props/dumpkit.py):
the same geometry scaled to the size the dump piece shows at 0.1 (lib/game/propModels.ts REMODELLED_PIECES draws it at
the call site's dump scale x 10), its face toward +z. The body texture: the felt's three printed cards become plain
stickies (pale pink, butter, cream) with a pin each, and the two pinned papers lose their writing; the beach photo stays.
"""
import os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dumpkit as D  # noqa: E402
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
# In the 768 x 384 body texture (row 0 at the top): a clean patch of felt, the printed cards on the felt, the papers.
FELT_CLEAN = (262, 380, 40, 180)                      # rows, cols
FELT_NOTES = (160, 350, 188, 400)
STICKIES = [((189, 249, 196, 278), "#f4d6cc", "#c4472f"), ((166, 250, 300, 372), "#f5e6a6", "#4f7fa6"),
            ((256, 343, 262, 390), "#f3eedb", "#d9a23a")]
PAPERS = [(150, 228, 458, 572), (8, 240, 596, 760)]   # the light blue card, the big cream paper


def retouch(px):
    out = px[..., :3].copy()
    h, w = out.shape[:2]
    r0, r1, c0, c1 = FELT_CLEAN
    clean = out[r0:r1, c0:c1].copy()
    ch, cw = clean.shape[:2]
    a0, a1, b0, b1 = FELT_NOTES
    ys, xs = np.mgrid[a0:a1, b0:b1]
    out[a0:a1, b0:b1] = clean[(ys - r0) % ch, (xs - c0) % cw]
    yy, xx = np.mgrid[0:h, 0:w]
    for (y0, y1, x0, x1), paper, pin in STICKIES:
        # A soft shadow down and right, the plain paper, a pin at the top middle.
        sh = (yy >= y0 + 3) & (yy < y1 + 3) & (xx >= x0 + 3) & (xx < x1 + 3)
        out[sh] *= 0.72
        card = (yy >= y0) & (yy < y1) & (xx >= x0) & (xx < x1)
        shade = 1 - 0.05 * (yy - y0) / max(1, y1 - y0)
        out[card] = (K.arr(paper)[None, :] * shade[card][:, None])
        cy, cx = y0 + 7, (x0 + x1) / 2
        d = np.hypot(yy - cy, xx - cx)
        out[d < 4.5] = K.arr(pin)
        out[(d < 1.6) & (yy < cy)] = np.minimum(1, K.arr(pin) + 0.35)
    for y0, y1, x0, x1 in PAPERS:
        reg = out[y0:y1, x0:x1]
        base = np.median(reg.reshape(-1, 3), 0)
        r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
        pin = ((g - r) > 0.25) | (((r - b) > 0.2) & (reg.mean(2) < 0.6))      # the green and brown pins stay
        ink = (np.abs(reg - base).sum(2) > 0.05) & ~pin
        # Grow the ink two pixels so its anti-aliased edge goes too (never over a pin).
        for _ in range(2):
            grown = ink.copy()
            grown[1:] |= ink[:-1]; grown[:-1] |= ink[1:]; grown[:, 1:] |= ink[:, :-1]; grown[:, :-1] |= ink[:, 1:]
            ink = grown & ~pin
        reg[ink] = base
    return out


def build():
    obs = D.load("furniture/bulletinboard.glb")
    D.scale_all(obs, 0.1)
    imgs = D.images_of(obs)
    body = next(v for k, v in imgs.items() if "mReBody" in k)
    D.set_pixels(body, retouch(D.pixels(body)))
    path = D.export(obs, "game/props/hq-notice-board.glb", fmt="AUTO")
    return obs, path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        for o in obs:
            if "Color" not in o.data.color_attributes:
                a = o.data.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
                for d in a.data:
                    d.color = (1, 1, 1, 1)
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "hq-board.png"), views=((180, 8), (215, 22), (150, 30)))
