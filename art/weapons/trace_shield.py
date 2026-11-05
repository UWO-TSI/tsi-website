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
4. Plates: in the crown, an inset of the outline (13 px) as its rim. Down each side, the blades: big plates between
   boundary lines read off the drawing's bright blade strokes, each from under a side spike down and in to the centre
   line (the first along the V panel's edge), each with its rank (0 innermost) for the builder to stack them.
5. The centre pieces read off the straightened drawing on a grid (px, x right, y down, centre x 215): the V panel
   under the crossbar, the cross and the groove it's set in, the domed arrowhead boss under it (notched for its point),
   the sunken trough at the foot with its teeth, the bar and the lens. Round the cross's top arm, one arch band.
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
# The gothic arch round the cross's top arm (centre, half-width, height, band): one broad raised band, standing on the
# groove round the crossbar (two thin ridges and two crown rings read as lines drawn on, not parts).
ARCHES = [((215, 200), 102, 138, 18)]
VPANEL = [(215, 212), (300, 222), (282, 300), (252, 400), (226, 470), (215, 486)]    # under the crossbar, to the cross's foot
CROSS_UP = dict(half=6.5, top=115, full_to=410, tip=428)                             # the upright, ending in a short point
CROSS_BAR = dict(half=6.5, y=202, reach=106)                                         # the crossbar, centred on y
CROSS_GROW = 5                                                                       # the groove it's set into
# Under the cross: the arrowhead boss, one domed plate with convex sides bowing out to its point, notched at the top
# in a V that takes the cross's point (right half: the notch's foot, up the notch, then round the outside to the point).
# Read off the drawing's lit left half (its grey gradient: a curved surface, not facets), whose extra width from the
# view stands in for WIDEN. The drawing's bright white V is the notch's lit wall: BOSS_GLINT px wide.
BOSS = [(215, 492), (248, 400), (275, 399), (271, 420), (266, 445), (260, 465), (252.5, 485), (244, 505), (234, 525),
        (222.5, 540), (215, 546)]
BOSS_GLINT = 7
BOSS_RINGS = (0.06, 0.16, 0.3, 0.5, 0.75)                                         # its dome's level lines, as fractions of its depth
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
# The notch at the top, a clean U between two horns (y, x of its right inner edge): the mask had it ragged.
TOP_NOTCH = [(18, 230), (25, 232), (32, 232), (40, 229), (46, 224), (50, 219), (53, 215)]
# Each plate's slope width (px): its edge runs down this far to the creases round it.
CHAMFER = dict(body=18, crown=5, blade=6, vpanel=5, arch=5, cross_back=2, cross=2, bottom=9, lens=2, bar=1)
CROWN_INSETS = [13]
LIP = 1.5                                                                           # a plate's polished edge (px), at the top of its slope
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
        foot = CROSS_BAR["y"] - CROSS_BAR["half"] - CROSS_GROW - 1   # on the groove round the crossbar
        t = np.linspace(0, np.pi, 41)
        outer = [(cx - w * np.cos(a), foot - h * np.sin(a)) for a in t]
        inner = [(cx - (w - band) * np.cos(a), foot - (h - band) * np.sin(a)) for a in t[::-1]]
        out.append(outer + inner)
    return out


def smoothed(region, sigma=1.2):
    """A region cut by curves on the pixel grid, its edge smoothed: traced as it is, a curved cut (round the boss)
    came out in stair-steps that its lip and wall showed. Blobs, not the outline's spikes, so blurring is safe here."""
    return (cv2.GaussianBlur(region.astype(np.float32), (0, 0), sigma) > 0.5).astype(np.uint8)


def level_lines(poly_px, depth, fractions, k=4):
    """Lines at fixed distances in from a polygon's edge, for a domed plate: triangulated along them, its curve comes out
    smooth (the grid alone cut across it in steps). Read off a k-times supersampled distance field."""
    big = np.zeros((940 * k, 430 * k), np.uint8)
    cv2.fillPoly(big, [np.round(np.array(poly_px) * k).astype(np.int32)], 1)
    dist = cv2.distanceTransform(big, cv2.DIST_L2, cv2.DIST_MASK_PRECISE) / k
    out = []
    for f in fractions:
        ring = dist >= f * depth
        if ring.sum() > 16 * k * k:
            out.append(model(contour(ring, 0.6 * k) / k))
    return out


def glint_half():
    """The boss's notch wall, right half: the notch line and its parallel BOSS_GLINT px into the boss, from the boss's
    top edge down to the centre line."""
    n, t = np.array(BOSS[0], float), np.array(BOSS[1], float)
    d = (t - n) / np.linalg.norm(t - n)
    off = np.array([-d[1], d[0]]) * BOSS_GLINT                   # the normal into the boss (right of the notch's up line)
    if off[0] < 0:
        off = -off
    a, b = n + off, t + off
    top = a + (b - a) * (t[1] - a[1]) / (b[1] - a[1])            # the parallel, run up to the notch's top
    foot = a + (b - a) * (C - a[0]) / (b[0] - a[0])              # and down to the centre line
    return [tuple(n), tuple(t), (round(top[0], 2), t[1]), (C, round(foot[1], 2))]


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


def plate(poly_px=None, mask=None, w=0, lip=None):
    """A plate as the builder needs it: its outline and the line where its slope meets its top (inset by w px), in rig
    units, plus the slope width. From a polygon (rasterised) or a mask. `lip` (px in from the outline, or None) adds the
    line bounding its bright polished edge: by default the top LIP px of its slope, under the inset."""
    k = 2                                                        # the inset lines, read at twice the drawing's pixels
    if mask is None:
        mask = np.zeros((940, 430), np.uint8)
        cv2.fillPoly(mask, [np.array(poly_px, np.int32)], 1)
        big = np.zeros((940 * k, 430 * k), np.uint8)
        cv2.fillPoly(big, [np.round(np.array(poly_px) * k).astype(np.int32)], 1)
    else:
        big = cv2.resize(mask.astype(np.uint8), None, fx=k, fy=k, interpolation=cv2.INTER_NEAREST)
    if mask.sum() < 60:
        return None                                              # a sliver: no plate
    # the exact distance: the fast 5x5 one's level lines came out terraced on slanted edges, and every plate's slope
    # showed the steps
    dist = cv2.distanceTransform(big, cv2.DIST_L2, cv2.DIST_MASK_PRECISE) / k
    w = min(w, max(1, int(dist.max()) - 1))                      # a thin plate's slope narrows to fit
    line = lambda region: contour(region, 1.4 * k) / k
    outline = contour(mask)
    inset = line(dist >= w) if w else outline
    out = {"poly": model(outline), "inset": model(inset), "w": round(w * SCALE, 5)}
    if lip is None and w >= 4:
        lip = w - LIP
    if lip:
        out["lip"] = model(line(dist >= lip))
        out["lip_side"] = "top" if lip > w / 2 else "foot"     # the band above the lip line, or below it
    return out


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
    inner = cv2.distanceTransform(sym, cv2.DIST_L2, cv2.DIST_MASK_PRECISE) >= 6
    right = sym.astype(bool) & (xx >= C) & inner
    stop = np.zeros_like(sym)
    for poly in (mirror_half(BOTTOM_PANEL), mirror_half(BOSS), mirror_half(FOOT)):     # the blades end where these begin
        cv2.fillPoly(stop, [np.array(poly, np.int32)], 1)
    right &= cv2.dilate(stop, np.ones((5, 5), np.uint8)) == 0
    out = []
    for k in range(1, len(BLADE_LINES) + 1):
        region = (right & (count == k)).astype(np.uint8)
        region = cv2.erode(region, np.ones((3, 3), np.uint8))          # a hairline gap between neighbours: the drawing's dark seam
        region = cv2.morphologyEx(region, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))   # no slivers
        if region.sum() < 1200:
            continue                                             # slivers where the trough cuts a blade: a busy ladder of lips
        out.append((k - 1, contour(smoothed(region), 1.2)))
    left = [(k, np.array([(2 * C - x, y) for x, y in poly[::-1]])) for k, poly in out]
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
    # clean the edge: the speckle and the ink leave pixel-scale jags that came out as bright crumbs on the bevel
    disc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    front = cv2.morphologyEx(cv2.morphologyEx(front, cv2.MORPH_OPEN, disc), cv2.MORPH_CLOSE, disc)
    N = np.array(TOP_NOTCH, float)
    for y in range(int(N[0, 0]), int(N[-1, 0]) + 1):
        front[y, C:int(round(np.interp(y, N[:, 0], N[:, 1])))] = 0
    front[:int(N[0, 0]), C:int(N[0, 1])] = 0
    sym = mirrored(front)
    dist = cv2.distanceTransform(sym, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    above = (np.mgrid[0:sym.shape[0], 0:sym.shape[1]][0] < CROWN_BELOW)
    crown = [contour((dist >= d) & above) for d in CROWN_INSETS]
    blade_px, curves = blades(sym)
    outline = contour(sym, 1.8)
    cross = cross_poly(0)
    ch = CHAMFER
    plates = {"body": plate(mask=sym, w=ch["body"])}
    for k, d in enumerate(CROWN_INSETS):
        plates[f"crown{k}"] = plate(mask=((dist >= d) & above).astype(np.uint8), w=ch["crown"], lip=0)   # its cut-off foot would draw a line across the arch
    for i, (rank, poly) in enumerate(blade_px):
        pl = plate(poly, w=ch["blade"])
        if pl:
            pl["rank"] = rank                                    # 0 the innermost: the builder stacks them, inner over outer
        plates[f"blade{i}"] = pl
    boss = np.zeros((940, 430), np.uint8)
    cv2.fillPoly(boss, [np.array(mirror_half(BOSS), np.int32)], 1)
    vp = np.zeros_like(boss)
    cv2.fillPoly(vp, [np.array(mirror_half(VPANEL), np.int32)], 1)
    vp &= cv2.dilate(boss, np.ones((5, 5), np.uint8)) == 0        # the V panel ends at the boss: no crease through it
    plates["vpanel"] = plate(mask=smoothed(vp), w=ch["vpanel"], lip=0)     # blade0's lip draws its V; its top would double the crossbar's
    for k, poly in enumerate(arch_polys()):
        plates[f"arch{k}"] = plate(poly, w=ch["arch"])
    # The boss's outline and its glint are exact (not traced back off a raster), so they share the notch line: two
    # near-copies of it made stair-stepped slivers along the bright V.
    plates["boss"] = plate(mask=boss, w=99, lip=0)              # its slope runs all the way in: the builder domes it
    plates["boss"]["poly"] = model(mirror_half(BOSS))
    plates["boss"]["profile"] = "dome"
    plates["boss"]["rings"] = level_lines(mirror_half(BOSS), plates["boss"]["w"] / SCALE, BOSS_RINGS)
    plates["boss"]["glint"] = model(mirror_half(glint_half()))
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
