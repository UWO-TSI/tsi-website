"""Trace the Guardian's shield from David's reference (2026-11-04: a manga panel of a tall dark tower shield; the image is
his and stays out of this public repo) into plate data for art/weapons/guardian_shield.py. David: "it has to be a 1:1 3d
model", so the shapes come from the drawing, not from an eyeballed sketch.

  python3 art/weapons/trace_shield.py <reference.png> art/weapons/guardian_shield_plates.py [debug_dir]

Needs OpenCV, scikit-image and numpy (a scratch venv: pip install opencv-python-headless scikit-image). Steps:
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
   under the crossbar, the cross with its long tapered foot, the lower chevron and
   the lens at the foot. Round the cross's top arm, two arch ridges.
6. The line work: the drawing's bright strokes (its edge highlights and panel lines) inside the shield, off the cross,
   thinned to centre lines and traced into paths (right half, mirrored). guardian_shield.py raises a thin bright ridge
   along each, on whatever plate lies under it.
Units: the shield is 1.0 rig units tall (the drawing's 876 px), point down at z = -0.265 (just above the ground with the
left hand at 0.285 in Idle), centred CX = 0.04 outboard of the hand.
"""
import json
import os
import sys

import cv2
import numpy as np
from skimage.morphology import skeletonize

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
# Two gothic arch ridges framing the cross's top arm (centre, half-width, height, band), standing on the crossbar's top.
ARCHES = [((215, 200), 105, 140, 12), ((215, 200), 70, 110, 11)]
VPANEL = [(215, 212), (300, 222), (282, 300), (252, 400), (226, 470), (215, 486)]    # under the crossbar, to the cross's foot
CROSS_UP = dict(half=6.5, top=115, full_to=440, tip=552)                             # the upright, tapering to a point
CROSS_BAR = dict(half=6.5, y=202, reach=106)                                         # the crossbar, centred on y
CROSS_GROW = 5                                                                       # the backing plate's border
CHEVRON = [(215, 758), (247, 742), (232, 790), (215, 806)]                           # the lower chevron
LENS = [(215, 812), (222, 823), (224, 840), (215, 858)]                              # the lens at the foot, starting below the chevron's point (their points meeting on the centre line empties the exact boolean)
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


def line_work(gray, sym):
    """The drawing's bright strokes as paths (straightened px), right half then mirrored."""
    th = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    inside = cv2.erode(sym, np.ones((9, 9), np.uint8)) > 0
    cross = np.zeros_like(sym)
    cv2.fillPoly(cross, [np.array(cross_poly(7), np.int32)], 1)
    lines = ((th > 42) & inside & (cross == 0)).astype(np.uint8)
    lines[:, :C + 2] = 0
    lines = cv2.morphologyEx(lines, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    sk = skeletonize(lines > 0)
    n, lab, st, _ = cv2.connectedComponentsWithStats(sk.astype(np.uint8), connectivity=8)
    sk &= np.isin(lab, [i for i in range(1, n) if st[i, 4] >= 14])
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    pix = set(zip(*np.nonzero(sk)))
    deg = {p: sum((p[0] + dy, p[1] + dx) in pix for dy, dx in nb) for p in pix}
    seen, paths = set(), []

    def walk(p):
        path = [p]
        seen.add(p)
        while True:
            nxt = [(p[0] + dy, p[1] + dx) for dy, dx in nb if (p[0] + dy, p[1] + dx) in pix and (p[0] + dy, p[1] + dx) not in seen]
            if not nxt:
                return path
            p = nxt[0]
            seen.add(p)
            path.append(p)
            if deg[p] > 2:
                return path

    for p in sorted(pix, key=lambda q: (deg[q], q)):
        if p not in seen and deg[p] <= 2:
            paths.append(walk(p))
    for p in sorted(pix):
        if p not in seen:
            paths.append(walk(p))
    out = []
    for pth in paths:
        if len(pth) < 12:
            continue
        ap = cv2.approxPolyDP(np.array([(x, y) for y, x in pth], np.float32).reshape(-1, 1, 2), 1.5, False)[:, 0, :]
        if len(ap) >= 2:
            out.append(ap.tolist())
    return out + [[(2 * C - x, y) for x, y in p] for p in out]


def main():
    gray = cv2.imread(REF, cv2.IMREAD_GRAYSCALE)
    m = shield_mask(gray)
    M = straighten()
    W, H = 430, 940
    front = cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_NEAREST)
    sym = mirrored(front)
    dist = cv2.distanceTransform(sym, cv2.DIST_L2, 5)
    above = (np.mgrid[0:sym.shape[0], 0:sym.shape[1]][0] < CROWN_BELOW)
    crown = [contour((dist >= d) & above) for d in CROWN_INSETS]
    blade_px, curves = blades(sym)
    strokes = line_work(cv2.warpAffine(gray, M, (W, H), borderValue=255), sym)
    outline = contour(sym)
    cross = cross_poly(0)
    data = {
        "OUTLINE": model(outline),
        "CROWN": [model(c) for c in crown],
        "BLADES": [model(b) for b in blade_px],
        "CROSS": model(cross),
        "CROSS_BACK": model(cross_poly(CROSS_GROW)),
        "ARCHES": [model(a) for a in arch_polys()],
        "VPANEL": model(mirror_half(VPANEL)),
        "CHEVRON": model(mirror_half(CHEVRON)),
        "LENS": model(mirror_half(LENS)),
        "LINES": [model(p) for p in strokes],
    }
    with open(OUT, "w") as f:
        f.write('"""Generated by art/weapons/trace_shield.py from David\'s reference: the Guardian\'s shield as plates, in rig units\n'
                '(x, z), the face toward -Y. Rerun the tracer to change it; don\'t edit by hand."""\n')
        for k, v in data.items():
            f.write(f"{k} = {json.dumps(v)}\n")
    print("outline", len(data["OUTLINE"]), "points; crown arches", [len(c) for c in crown], "; blades", [len(b) for b in blade_px], "; strokes", len(strokes))
    if DEBUG:
        os.makedirs(DEBUG, exist_ok=True)
        ref = cv2.warpAffine(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR), M, (W, H), borderValue=(255, 255, 255))
        vis = ref.copy()
        cv2.polylines(vis, [outline.astype(np.int32).reshape(-1, 1, 2)], True, (0, 200, 0), 1)
        for c in crown:
            cv2.polylines(vis, [c.astype(np.int32).reshape(-1, 1, 2)], True, (0, 160, 255), 1)
        for i, b in enumerate(blade_px):
            cv2.polylines(vis, [np.array(b, np.int32).reshape(-1, 1, 2)], True, [(255, 120, 0), (200, 0, 200), (0, 0, 255), (0, 140, 0), (120, 60, 255)][i % 5], 1)
        for poly in [cross, mirror_half(VPANEL), mirror_half(CHEVRON), mirror_half(LENS)] + arch_polys():
            cv2.polylines(vis, [np.array(poly, np.int32).reshape(-1, 1, 2)], True, (0, 230, 230), 1)
        cv2.imwrite(os.path.join(DEBUG, "trace-front.png"), np.hstack([ref, vis]))
        np.save(os.path.join(DEBUG, "sym.npy"), sym)
        json.dump({"M": M.tolist()}, open(os.path.join(DEBUG, "affine.json"), "w"))


main()
