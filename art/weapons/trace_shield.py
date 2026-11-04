"""Trace the Guardian's shield from David's reference (2026-11-04: a manga panel of a tall dark tower shield; the image is
his and stays out of this public repo) into plate data for art/weapons/guardian_shield.py. David: "it has to be a 1:1 3d
model", so the shapes come from the drawing, not from an eyeballed sketch.

  python3 art/weapons/trace_shield.py <reference.png> art/weapons/guardian_shield_plates.py [debug_dir]

Needs OpenCV and numpy (a scratch venv: pip install opencv-python-headless). Steps:
1. The shield's mask: solid ink (dark, densely filled), plus the grey-gradient metal that touches it in the zones where
   the drawing shades metal instead of the character; the shield's left edge, beside the character, is a hand-read line.
2. The drawing is a three-quarter view, so the cross's arms meet at 72 degrees. One affine turns the upright vertical and
   the crossbar horizontal at their drawn lengths: the drawing's front view (93% symmetric once straightened).
3. The right half (traced unaided; the left half was cut by hand beside the character) mirrored about the cross's axis
   and widened by WIDEN: straightened, the drawn left half is 9 to 34% wider than the right at every height (the view's
   perspective, not the hand cut: it holds at the foot too), so the true width lies between them.
4. Plates: in the crown, two insets of the outline (13 and 28 px) as the drawing's concentric arches. Down each side,
   the blades: big plates between boundary lines read off the drawing's bright blade strokes, each from under a side
   spike down and in to the centre line (the first along the V panel's edge). Five a side, the upper ones in front.
5. The centre pieces read off the straightened drawing on a grid (px, x right, y down, centre x 215): the V panel
   under the crossbar, the cross with its long tapered foot, the V trough under it, the sunken trough at the foot with
   its teeth, the bar and the lens. Round the cross's top arm, two arch ridges.
Units: the shield is 1.0 rig units tall (the drawing's 876 px), point down at z = -0.265 (just above the ground with the
left hand at 0.285 in Idle), centred CX = 0.04 outboard of the hand.
"""
import json
import os
import sys

import cv2
import numpy as np

REF, OUT = sys.argv[1], sys.argv[2]
DEBUG = sys.argv[3] if len(sys.argv) > 3 else None

# ── 1. the mask, in the drawing's own pixels (480 x 908) ──
LEFT_EDGE = [(150, 140), (136, 155), (133, 200), (131, 260), (128, 320), (127, 400), (125, 480), (122, 560), (116, 590),
             (108, 630), (98, 680), (96, 760), (98, 820), (106, 865), (120, 900), (124, 908)]
GREY_ZONES = [(150, 0, 480, 125), (95, 140, 175, 908), (95, 780, 215, 908), (330, 380, 480, 570), (150, 60, 200, 175)]
SEED = (330, 300)
# the cross as drawn: the upright's ends and the crossbar's ends
CROSS_TOP, CROSS_BOT, CROSS_L, CROSS_R = (335, 132), (250, 452), (222, 155), (400, 272)

# ── 5. the centre pieces, in the straightened drawing's pixels (right half from the centre line; mirrored) ──
C = 215
# The drawing's centre line (y, x), straightened: the cross's axis down to y 700, then it bends left toward the point
# (the curved shield seen three-quarter), read off the short bar, the lens and the point. Each row is shifted so the
# line stands at C before mirroring: mirrored about a straight C, the point (11 px left of it) was lost and the foot
# came out blunt.
AXIS = [(0, 215), (700, 215), (792, 212), (825, 208.5), (919, 204), (940, 203.5)]
# Two gothic arch ridges framing the cross's top arm (centre, half-width, height, band), standing on the crossbar's top.
ARCHES = [((215, 200), 105, 140, 12), ((215, 200), 70, 110, 11)]
VPANEL = [(215, 212), (300, 222), (282, 300), (252, 400), (226, 470), (215, 486)]    # under the crossbar, to the cross's foot
CROSS_UP = dict(half=6.5, top=115, full_to=440, tip=552)                             # the upright, tapering to a point
CROSS_BAR = dict(half=6.5, y=202, reach=106)                                         # the crossbar, centred on y
CROSS_GROW = 5                                                                       # the backing plate's border
# Under the cross's foot: the V trough, its two halves sloping in (outer edge, then the inner edge back up).
LOWER_V = [(215, 528), (232, 470), (262, 408), (284, 412), (240, 520), (222, 566), (215, 572)]
# The foot, read off the right half (the left is wider in the view; mirrored and widened it put the teeth on the rim):
# a sunken trough open at the top under the V, its walls the side blades' inner edges with two teeth a side jutting out,
# converging to a point on the short bar; under that the lens, then the point's two plain facets.
BOTTOM_PANEL = [(215, 576), (246, 590), (272, 600), (268, 640), (264, 686), (275, 699), (262, 704), (253, 738), (263, 748),
                (249, 751), (222, 786), (215, 789)]
FOOT = [(215, 789), (249, 751), (263, 748), (305, 772), (305, 940), (215, 940)]       # the side blades end at the lower tooth
LENS = [(215, 800), (222, 811), (222, 840), (215, 851)]                              # the elongated hexagonal lens under the trough's point
BAR = [(215, 788), (226, 788), (226, 795), (215, 795)]                                # the short bar between them
# The right edge down the point (y, x): the drawing shades it in speckle that runs into the background, and the mask
# had it wide and cut off blunt above the point.
FOOT_EDGE = [(760, 275), (780, 275), (800, 273), (820, 266), (840, 257), (860, 249), (880, 238), (900, 228), (910, 222), (919, 215)]
# Each plate's slope width (px): its edge runs down this far to the creases round it.
CHAMFER = dict(body=18, crown=5, blade=6, vpanel=5, lower_v=4, arch=3, cross_back=3, cross=2, bottom=9, lens=2, bar=1)
CROWN_INSETS = [13, 28]
CROWN_BELOW = 150                                                                   # the arches stop where the blades begin
# The blade boundaries (right side, read off the straightened drawing's bright blade strokes): each starts on the outline
# (its first point is snapped there) and runs down and in to the centre line. The first follows the V panel's edge.
BLADE_LINES = [[(323, 130), (305, 222), (285, 300), (255, 400), (228, 480), (217, 560)],
               [(345, 180), (325, 260), (300, 360), (270, 470), (240, 580), (222, 680)],
               [(370, 258), (345, 340), (318, 440), (288, 550), (255, 660), (230, 770)],
               [(355, 372), (335, 450), (305, 560), (270, 680), (240, 800)],
               [(335, 453), (320, 520), (295, 620), (265, 730), (240, 840)]]
WIDEN = 1.10
HEIGHT_PX, TOP_PX = 876, 20
SCALE = 1.0 / HEIGHT_PX
Z_TOP, CX = -0.265 + 1.0, 0.04


def arch_polys():
    """Each arch ridge: the band between two half-ellipses, its feet on the crossbar's top."""
    out = []
    for (cx, cy), w, h, band in ARCHES:
        foot = CROSS_BAR["y"] - CROSS_BAR["half"] + 2          # into the crossbar: feet level with its top make coincident faces
        t = np.linspace(0, np.pi, 41)
        outer = [(cx - w * np.cos(a), foot - h * np.sin(a)) for a in t]
        inner = [(cx - (w - band) * np.cos(a), foot - (h - band) * np.sin(a)) for a in t[::-1]]
        out.append(outer + inner)
    return out


def cross_poly(g):
    """The cross, every bar widened by g px all round (g > 0: its backing plate, the drawing's dark outline)."""
    u, b = CROSS_UP, CROSS_BAR
    w, hb, top, full, tip, reach, y = u["half"] + g, b["half"] + g, u["top"] - g, u["full_to"], u["tip"] + 2.2 * g, b["reach"] + g, b["y"]
    return [(C - w, top), (C + w, top), (C + w, y - hb), (C + reach, y - hb), (C + reach, y + hb), (C + w, y + hb), (C + w, full),
            (C, tip), (C - w, full), (C - w, y + hb), (C - reach, y + hb), (C - reach, y - hb), (C - w, y - hb)]


def shield_mask(gray):
    h, w = gray.shape
    dark = (gray < 80).astype(np.float32)
    solid = (cv2.boxFilter(dark, -1, (17, 17)) > 0.6).astype(np.uint8)
    solid = cv2.dilate(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (8, 8)))
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    solid = keep(solid, SEED)
    near = cv2.dilate(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (33, 33)))
    zone = np.zeros_like(solid)
    for x0, y0, x1, y1 in GREY_ZONES:
        zone[y0:y1, x0:x1] = 1
    m = solid | ((gray < 232).astype(np.uint8) & near & zone)
    L = np.array(LEFT_EDGE)
    lx = np.interp(np.arange(h), L[:, 1], L[:, 0])
    m &= (np.arange(w)[None, :] >= lx[:, None] - 1).astype(np.uint8)
    m[:120, :140] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    return fill(keep(m, SEED))


def keep(m, seed):
    _, lab = cv2.connectedComponents(m, connectivity=8)
    return (lab == lab[seed[1], seed[0]]).astype(np.uint8)


def fill(m):
    h, w = m.shape
    ff = m * 255
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 128)
    return (ff != 128).astype(np.uint8)


def straighten():
    """The affine (and offset) that turns the drawn cross square: the drawing's front view."""
    top, bot, cl, cr = (np.array(p, float) for p in (CROSS_TOP, CROSS_BOT, CROSS_L, CROSS_R))
    u, v = cr - cl, bot - top
    A = np.diag([np.linalg.norm(u), np.linalg.norm(v)]) @ np.linalg.inv(np.column_stack([u, v]))
    t = (A @ top) - np.array([C, 115.0])                  # the upright's top lands at (C, 115)
    return np.hstack([A, -t[:, None]])


def unbend(img, nearest=True):
    """Shift each row so the drawing's centre line (AXIS) stands at C."""
    h, w = img.shape[:2]
    A = np.array(AXIS, float)
    shift = np.interp(np.arange(h), A[:, 0], A[:, 1]) - C
    mx = (np.arange(w)[None, :] + shift[:, None]).astype(np.float32)
    my = np.repeat(np.arange(h, dtype=np.float32)[:, None], w, 1)
    return cv2.remap(img, mx, my, cv2.INTER_NEAREST if nearest else cv2.INTER_LINEAR, borderValue=0 if nearest else (255, 255, 255))


def mirrored(m):
    right = m.copy()
    right[:, :C] = 0
    out = right.copy()
    xs = np.arange(C, m.shape[1])
    xm = 2 * C - xs
    ok = xm >= 0
    out[:, xm[ok]] |= right[:, xs[ok]]
    return out


def contour(m, eps=1.4, smooth=0.0):
    """The largest region's outline, simplified to `eps` px (which also flattens the pixel stair-steps). `smooth` (a
    Gaussian along the contour) stays off: it sharpens the spike tips to hair-thin points whose bevels fold over, and
    the exact boolean then leaves non-manifold edges."""
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(np.float64)
    if smooth:
        r = int(3 * smooth)
        k = np.exp(-0.5 * (np.arange(-r, r + 1) / smooth) ** 2)
        k /= k.sum()
        pad = np.concatenate([c[-r:], c, c[:r]])
        c = np.stack([np.convolve(pad[:, i], k, mode="valid") for i in range(2)], 1)
    return cv2.approxPolyDP(c.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :].astype(float)


def plate(poly_px=None, mask=None, w=0):
    """A plate as the builder needs it: its outline and the line where its slope meets its top (inset by w px), in rig
    units, plus the slope width. From a polygon (rasterised) or a mask."""
    if mask is None:
        mask = np.zeros((940, 430), np.uint8)
        cv2.fillPoly(mask, [np.array(poly_px, np.int32)], 1)
    if mask.sum() < 60:
        return None                                              # a sliver: no plate
    dist = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    w = min(w, max(1, int(dist.max()) - 1))                      # a thin plate's slope narrows to fit
    outline = contour(mask)
    inset = contour(dist >= w) if w else outline
    return {"poly": model(outline), "inset": model(inset), "w": round(w * SCALE, 5)}


def model(pts):
    """Straightened pixels -> rig units (x, z)."""
    return [(round(CX + (x - C) * SCALE * WIDEN, 5), round(Z_TOP - (y - TOP_PX) * SCALE, 5)) for x, y in pts]


def mirror_half(half):
    """A right half running from the centre line round to the centre line -> the whole closed polygon."""
    right = list(half)
    return right + [(2 * C - x, y) for x, y in reversed(right[1:-1])]


def blades(sym):
    """The side blades between the BLADE_LINES: a pixel's blade is how many of the lines it lies outside of (right of,
    below the line's start). Returns each blade's outline, right side then left, upper first."""
    H, W = sym.shape
    xs = np.array([np.max(np.nonzero(sym[y])[0]) if sym[y].any() else -1 for y in range(H)], float)
    yy, xx = np.mgrid[0:H, 0:W]
    count = np.zeros((H, W), np.int32)
    curves = []
    for line in BLADE_LINES:
        pts = [(xs[line[0][1]] - 2, line[0][1])] + line[1:]          # snap the start onto the outline
        px, py = np.array([p[0] for p in pts], float), np.array([p[1] for p in pts], float)
        fx = np.interp(np.arange(H), py, px, left=np.inf, right=px[-1])
        count += ((yy >= py[0]) & (xx > fx[:, None])).astype(np.int32)
        curves.append(pts)
    # 6 px in from the outline: a blade wall a pixel inside the base's would graze its bevel, and the exact boolean
    # leaves non-manifold edges there; the base shows as a thin rim round the edge instead.
    inner = cv2.distanceTransform(sym, cv2.DIST_L2, 5) >= 6
    right = sym.astype(bool) & (xx >= C) & inner
    stop = np.zeros_like(sym)
    for poly in (mirror_half(BOTTOM_PANEL), mirror_half(LOWER_V), mirror_half(FOOT)):     # the blades end where these begin
        cv2.fillPoly(stop, [np.array(poly, np.int32)], 1)
    right &= cv2.dilate(stop, np.ones((5, 5), np.uint8)) == 0
    out = []
    for k in range(1, len(BLADE_LINES) + 1):
        region = (right & (count == k)).astype(np.uint8)
        region = cv2.erode(region, np.ones((3, 3), np.uint8))          # a hairline gap between neighbours: the drawing's dark seam
        region = cv2.morphologyEx(region, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))   # no slivers
        if region.sum() < 50:
            continue
        poly = contour(region, 1.2)
        out.append(poly)
    left = [np.array([(2 * C - x, y) for x, y in poly[::-1]]) for poly in out]
    return out + left, curves


def main():
    gray = cv2.imread(REF, cv2.IMREAD_GRAYSCALE)
    m = shield_mask(gray)
    M = straighten()
    W, H = 430, 940
    front = unbend(cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_NEAREST))
    F = np.array(FOOT_EDGE, float)
    for y in range(int(F[0, 0]), H):
        front[y, C:] = 0
        if y <= F[-1, 0]:
            front[y, C:int(round(np.interp(y, F[:, 0], F[:, 1]))) + 1] = 1
    sym = mirrored(front)
    dist = cv2.distanceTransform(sym, cv2.DIST_L2, 5)
    above = (np.mgrid[0:sym.shape[0], 0:sym.shape[1]][0] < CROWN_BELOW)
    crown = [contour((dist >= d) & above) for d in CROWN_INSETS]
    blade_px, curves = blades(sym)
    outline = contour(sym)
    cross = cross_poly(0)
    ch = CHAMFER
    right_blades = blade_px[:len(blade_px) // 2]
    plates = {"body": plate(mask=sym, w=ch["body"])}
    for k, d in enumerate(CROWN_INSETS):
        plates[f"crown{k}"] = plate(mask=((dist >= d) & above).astype(np.uint8), w=ch["crown"])
    for k, poly in enumerate(blade_px):
        plates[f"blade{k}"] = plate(poly, w=ch["blade"])
    plates["vpanel"] = plate(mirror_half(VPANEL), w=ch["vpanel"])
    plates["lower_v"] = plate(mirror_half(LOWER_V), w=ch["lower_v"])
    for k, poly in enumerate(arch_polys()):
        plates[f"arch{k}"] = plate(poly, w=ch["arch"])
    plates["cross_back"] = plate(cross_poly(CROSS_GROW), w=ch["cross_back"])
    plates["cross"] = plate(cross, w=ch["cross"])
    bp = np.zeros((940, 430), np.uint8)
    cv2.fillPoly(bp, [np.array(mirror_half(BOTTOM_PANEL), np.int32)], 1)
    plates["bottom"] = plate(mask=bp, w=ch["bottom"])
    plates["lens"] = plate(mirror_half(LENS), w=ch["lens"])
    plates["bar"] = plate(mirror_half(BAR), w=ch["bar"])
    plates = {k: v for k, v in plates.items() if v}
    data = {"PLATES": plates, "OUTLINE": model(outline)}
    with open(OUT, "w") as f:
        f.write('"""Generated by art/weapons/trace_shield.py from David\'s reference: the Guardian\'s shield as plates, in rig units\n'
                '(x, z), the face toward -Y. Rerun the tracer to change it; don\'t edit by hand."""\n')
        for k, v in data.items():
            f.write(f"{k} = {json.dumps(v)}\n")
    print("outline", len(data["OUTLINE"]), "points; plates", {k: len(v["poly"]) for k, v in plates.items()})
    if DEBUG:
        os.makedirs(DEBUG, exist_ok=True)
        ref = unbend(cv2.warpAffine(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR), M, (W, H), borderValue=(255, 255, 255)), nearest=False)
        vis = ref.copy()
        px = lambda pts: np.array([(C + (x - CX) / (SCALE * WIDEN), TOP_PX + (Z_TOP - z) / SCALE) for x, z in pts], np.int32).reshape(-1, 1, 2)
        for name, pl in plates.items():
            col = (0, 200, 0) if name == "body" else (0, 210, 230) if name in ("cross", "lens", "bar") else (255, 120, 0)
            cv2.polylines(vis, [px(pl["poly"])], True, col, 1)
            cv2.polylines(vis, [px(pl["inset"])], True, (200, 0, 200), 1)
        cv2.imwrite(os.path.join(DEBUG, "trace-front.png"), np.hstack([ref, vis]))
        np.save(os.path.join(DEBUG, "sym.npy"), sym)
        json.dump({"M": M.tolist()}, open(os.path.join(DEBUG, "affine.json"), "w"))


main()
