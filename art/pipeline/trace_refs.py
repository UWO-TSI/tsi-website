"""Traces David's round 9 reference into model data (rods round 9, David 2026-11-05: "model this as 1:! as possible
serious job use wtv u can"). The references are third-party and stay untracked (specs/references/rods/); this reads them
and writes art/pipeline/traced_refs.py, plain numbers, which build_rods.py builds from, so a build never
needs the images.

  python3 -I art/pipeline/trace_refs.py          (numpy, opencv, scipy)

- The Tidewarden (epic-tidewarden-ref.png): the picture turned upright (its shaft fitted), then the gold head's outline,
  cut at each prong where its gold turns mint and then blue (the three colours' own outlines), and the teal veins as
  filled shapes (their painted width), triangulated inside their outline. Rig units: the hand at the wrap's top.
  (The Aquatic sword's trace went with its study, VFX round 1: the Water type is drawn on any holder now.)
"""
import os, sys
import numpy as np, cv2
from scipy.spatial import Delaunay

HERE = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.join(HERE, "..", "..", "specs", "references", "rods")
OUT = os.path.join(HERE, "traced_refs.py")


def hsv(im):
    h = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    return [h[..., i].astype(int) for i in range(3)]


def smooth_outline(mask, sigma, eps):
    """The mask's outline as clean curves: its contour smoothed (a Gaussian round the loop), then simplified."""
    from scipy.ndimage import gaussian_filter1d
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float)
    c = np.stack([gaussian_filter1d(c[:, 0], sigma, mode="wrap"), gaussian_filter1d(c[:, 1], sigma, mode="wrap")], 1)
    # then as few points as keep the curve within `eps` px (the prong tips and spurs are where it turns: they stay)
    return cv2.approxPolyDP(c.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :].astype(float)


def ridge_points(mask, spacing):
    """Points along the mask's medial axis (its ridge), at least `spacing` px apart."""
    from skimage.morphology import medial_axis
    sk, dist = medial_axis(mask > 0, return_distance=True)
    ys, xs = np.where(sk & (dist > 2.5))
    order = np.argsort(-dist[ys, xs])
    picked = []
    for i in order:
        p = np.array([xs[i], ys[i]], float)
        if all(np.hypot(*(p - q)) >= spacing for q in picked):
            picked.append(p)
    return np.array(picked)


def inside_tris(pts, mask):
    """Delaunay of `pts`, kept where a triangle lies inside the mask (its centre and its edges' middles)."""
    tri = Delaunay(pts)
    grown = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8))
    at = lambda p: grown[min(max(int(round(p[1])), 0), mask.shape[0] - 1), min(max(int(round(p[0])), 0), mask.shape[1] - 1)] > 0
    return [t.tolist() for t in tri.simplices
            if all(at(q) for q in ((pts[t[0]] + pts[t[1]] + pts[t[2]]) / 3, (pts[t[0]] + pts[t[1]]) / 2, (pts[t[1]] + pts[t[2]]) / 2, (pts[t[2]] + pts[t[0]]) / 2))]


def crack_lines(mask, min_len):
    """The mask thinned to centre lines and traced into polylines between its ends and its branch points; spurs shorter
    than `min_len` px that end in nothing are dropped. Each line simplified to within a pixel."""
    from skimage.morphology import skeletonize
    sk = skeletonize(mask > 0)
    pix = set(zip(*np.where(sk)))
    nb = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (p[0] + dy, p[1] + dx) in pix]
    nodes = {p for p in pix if len(nb(p)) != 2}
    lines, seen = [], set()
    for n0 in nodes:
        for q in nb(n0):
            if (n0, q) in seen:
                continue
            path, prev, cur = [n0, q], n0, q
            while cur not in nodes:
                nxt = [r for r in nb(cur) if r != prev and r not in path[-3:]]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                path.append(cur)
            seen.add((path[-1], path[-2]))
            seen.add((n0, q))
            lines.append(path)
    keep = []
    for path in lines:
        dead = len(nb(path[0])) <= 1 or len(nb(path[-1])) <= 1
        if dead and len(path) < min_len:
            continue
        xy = np.array([(x, y) for y, x in path], np.float32).reshape(-1, 1, 2)
        keep.append(cv2.approxPolyDP(xy, 1.0, False)[:, 0, :].tolist())
    return keep


def tidewarden():
    im = cv2.imread(os.path.join(REFS, "epic-tidewarden-ref.png"))[..., :3]
    H, S, V = hsv(im)
    fill = (S > 45) & (V > 60)
    ys, xs = [], []
    for y in range(1050, 1360, 5):                       # the shaft below the water: fit its line
        s = np.where(fill[y])[0]
        s = s[(s > 500) & (s < 760)]
        if len(s):
            ys.append(y)
            xs.append(s.mean())
    k, b = np.polyfit(ys, xs, 1)
    P = 600
    pad = cv2.copyMakeBorder(im, P, P, P, P, cv2.BORDER_CONSTANT, value=(245, 245, 245))
    cx, cy = k * 700 + b + P, 700.0 + P
    turn = cv2.getRotationMatrix2D((cx, cy), -float(np.degrees(np.arctan(k))), 1.0)
    rot = cv2.warpAffine(pad, turn, (pad.shape[1], pad.shape[0]),
                         borderValue=(245, 245, 245))
    up = rot[:, int(cx) - 300:int(cx) + 300]
    H, S, V = hsv(up)
    fill = (S > 38) & (V > 70)
    rows = np.where(fill.any(1))[0]
    top, foot = rows.min(), rows.max()
    up, H, S, V, fill = up[top - 2:], H[top - 2:], S[top - 2:], V[top - 2:], fill[top - 2:]
    foot -= top - 2
    # the head: the fill and the sketch's own lines, closed, its biggest piece, above the neck
    neck = int(0.385 * foot)
    # the head: everything drawn (fill, pale fill, pencil), closed, its biggest piece, above the neck; then the slot
    # between the left and the middle prong (pencil on both sides, so the closing sealed it) opened again, up to the sky
    m = ((S > 18) | (V < 228)).astype(np.uint8)
    m[neck:] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    head = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    cs, _ = cv2.findContours(head, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(head, cs, -1, 1, -1)
    gap = cv2.morphologyEx(((S < 14) & (V > 236) & (head > 0)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(gap)
    slot = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    sy, sx = np.where(slot)
    top_y = sy.min()
    tx = int(np.median(sx[sy < top_y + 4]))
    slot[:top_y, tx - 2:tx + 3] = True
    head = (head > 0) & ~(cv2.dilate(slot.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    head = cv2.GaussianBlur(head.astype(np.float32), (0, 0), 2.0) > 0.5     # the pencil's ragged edge, smoothed
    # inside the pencil: the drawn line sits on the edge, half of it outside the shape (about 2 px)
    head = cv2.erode(head.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0
    # the two round cut-outs as drawn: the sketch's pencil rings them, so the mask keeps only a sliver of their white
    # middles; open each to its drawn size (centre and radius read off the sketch, in this crop's px)
    head = head.astype(np.uint8)
    for c, r in (((292, 454), 18), ((355, 497), 19)):
        cv2.circle(head, c, r, 0, -1)
    head = head > 0
    inner = cv2.erode(head.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0     # veins well inside the outline
    vein = (H >= 80) & (H <= 96) & (S > 70) & (V > 160) & inner
    blue = (H >= 92) & (H <= 125) & (S > 35) & ~vein & head
    mint = (H >= 35) & (H < 92) & (S > 25) & ~vein & head
    # each prong's colour bands: the rows where blue, then mint, give way, measured in the prong's own columns
    cols = np.where(head.any(0))[0]
    prongs = []
    lab_n, plab = cv2.connectedComponents(head[: int(0.2 * foot)].astype(np.uint8))   # the prongs, cut above the plate
    for i in range(1, lab_n):
        xs_ = np.where((plab == i).any(0))[0]
        if len(xs_) < 4:
            continue
        x0, x1 = xs_.min(), xs_.max()
        count = lambda mask: mask[:, x0:x1 + 1].sum(1)
        y0 = int(np.where(head[:, x0:x1 + 1].any(1))[0].min())
        gold = head & (H < 35) & (S > 40)
        label = np.argmax(np.stack([count(blue), count(mint), count(gold)]), 0)    # each row's main colour, smoothed
        label = np.array([np.bincount(label[max(0, y - 4):y + 5], minlength=3).argmax() for y in range(len(label))])
        g0 = next(y for y in range(y0 + 8, len(label)) if label[y] == 2)          # the prong turns gold here
        blues = [y for y in range(y0, g0) if label[y] == 0]
        b_end = max(blues) + 1 if blues else y0
        m_end = g0
        prongs.append((x0, x1, b_end, max(m_end, b_end + 6)))
    s = 1.12 / float(foot)                               # the whole trident 1.12 rig units long
    hand = foot - int(round(0.13 / s))                   # the hand at the wrap's top, 0.13 above the star's point
    to3 = lambda p: (round((p[0] - 300) * s, 4), round((hand - p[1]) * s, 4))
    # the head as a relief (rods round 9b): its outline smoothed into clean curves, triangulated with its medial axis, each
    # vertex's depth into the head (px, for the bevel and the ridge), whether it is on the ridge, and its colour band
    # (0 gold, 1 mint, 2 blue: each prong's tip fading into the gold, smoothly, where the sketch's colours change)
    outline_px = smooth_outline(head, sigma=3.0, eps=1.7)
    clean = np.zeros_like(head, dtype=np.uint8)
    cv2.fillPoly(clean, [np.round(outline_px).astype(np.int32)], 1)
    depth = cv2.distanceTransform(clean, cv2.DIST_L2, 5)
    ridge = ridge_points(clean, 36.0)
    for _ in range(8):                                   # conforming: split every outline edge the triangulation misses
        tri = Delaunay(np.vstack([outline_px, ridge]))
        edges = {tuple(sorted((int(t[i]), int(t[(i + 1) % 3])))) for t in tri.simplices for i in range(3)}
        n = len(outline_px)
        miss = [i for i in range(n) if tuple(sorted((i, (i + 1) % n))) not in edges]
        if not miss:
            break
        out = []
        for i in range(n):
            out.append(outline_px[i])
            if i in miss:
                out.append((outline_px[i] + outline_px[(i + 1) % n]) / 2)
        outline_px = np.array(out)
    pts = np.vstack([outline_px, ridge])
    tris = inside_tris(pts, clean)
    cover = np.zeros_like(clean)
    for t in tris:
        cv2.fillPoly(cover, [np.round(pts[t]).astype(np.int32)], 1)
    print("head relief", len(outline_px), "+", len(ridge), "points", len(tris), "tris, covers", round(float((cover & clean).sum() / clean.sum()), 3), "of the outline")

    def band(x, y):
        for x0, x1, b_end, m_end in prongs:
            if x0 - 3 <= x <= x1 + 3 and y < m_end + 30:
                ss = lambda e0, e1, v: float(np.clip((v - e0) / (e1 - e0), 0, 1)) ** 2 * (3 - 2 * float(np.clip((v - e0) / (e1 - e0), 0, 1)))
                return round(2.0 - ss(b_end - 18, b_end + 18, y) - ss(m_end - 18, m_end + 24, y), 3)
        return 0.0
    head_mesh = {"points": [to3(p) for p in pts], "tris": tris,
                 "depth": [round(float(depth[min(int(round(y)), depth.shape[0] - 1), min(int(round(x)), depth.shape[1] - 1)]), 1) if i >= len(outline_px) else 0.0 for i, (x, y) in enumerate(pts)],
                 "ridge": [1 if i >= len(outline_px) else 0 for i in range(len(pts))],
                 "band": [band(x, y) for x, y in pts]}
    # the veins as cracks: the sketch's teal lines, joined where the brush broke them, thinned to their centre lines and
    # traced into branching polylines (spurs pruned), each point with its depth into the head (they lie on the relief)
    # on the gold any teal is a crack (gold is orange: no confusion), so the paler strokes count there too; on the prongs'
    # mint and blue only the strong teal does
    goldzone = np.ones_like(head)
    for x0, x1, b_end, m_end in prongs:
        goldzone[:m_end + 6, max(0, x0 - 3):x1 + 4] = False
    vein = vein | ((H >= 78) & (H <= 100) & (S > 30) & (V > 140) & goldzone)
    vm = cv2.morphologyEx((vein & (clean > 0)).astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    nv, vl, vs, _ = cv2.connectedComponentsWithStats(vm)
    vm = np.isin(vl, [i for i in range(1, nv) if vs[i, cv2.CC_STAT_AREA] >= 30]) & (cv2.erode(clean, np.ones((3, 3), np.uint8)) > 0)
    cracks = [[(*to3(p), round(float(depth[int(p[1]), int(p[0])]), 1)) for p in line] for line in crack_lines(vm, 10)]
    print("veins", len(cracks), "cracks,", sum(len(c) - 1 for c in cracks), "segments")
    # the shaft's width and the butt: the star's arms and the wrap's ring
    shaft = [np.where(fill[y, 250:350])[0] for y in range(neck + 40, hand - 60, 20)]
    shaft_r = float(np.median([len(r) for r in shaft if len(r)])) / 2 * s
    star = fill[hand + 40:]
    sy, sx = np.where(star)
    return {
        # where the hand is in the reference as it hangs (px), its px per rig unit and its lean (degrees, tip to the left)
        "frame": {"hand": [round(float(q), 1) for q in cv2.invertAffineTransform(turn) @ np.array([int(cx), hand + top - 2, 1.0]) - P],
                  "ppu": round(1 / s, 1), "lean": round(float(np.degrees(np.arctan(k))), 2)},
        "scale": s, "shaft_r": round(shaft_r, 4), "tip": to3((300, 2)), "neck": to3((300, neck)),
        "head": head_mesh,
        "veins": cracks,
        "star": {"span": round((sx.max() - sx.min()) * s, 4), "foot": to3((300, foot))[1], "centre": to3((300, hand + 40 + np.median(sy)))[1]},
    }


# ================================================================ the Aquatic sword
if __name__ == "__main__":
    tw = tidewarden()
    with open(OUT, "w") as f:
        f.write('"""Traced from the round 9 references by trace_refs.py: do not edit (rerun it). Plain numbers, no image."""\n')
        f.write(f"TIDEWARDEN = {tw!r}\n")
    print("shaft_r", tw["shaft_r"], "tip", tw["tip"], "neck", tw["neck"], "star", tw["star"])
    sys.exit(0)
