"""Traces David's two round 9 references into model data (rods round 9, David 2026-11-05: "model this as 1:! as possible
serious job use wtv u can"). The references are third-party and stay untracked (specs/references/rods/); this reads them
and writes art/pipeline/traced_refs.py, plain numbers, which build_rods.py and fx_library.py build from, so a build never
needs the images.

  python3 -I art/pipeline/trace_refs.py          (numpy, opencv, scipy)

- The Tidewarden (epic-tidewarden-ref.png): the picture turned upright (its shaft fitted), then the gold head's outline,
  cut at each prong where its gold turns mint and then blue (the three colours' own outlines), and the teal veins as
  filled shapes (their painted width), triangulated inside their outline. Rig units: the hand at the wrap's top.
- The Aquatic sword (fx-aquatic-water-ref.png): the water blade as a ribbon (each row's two edges), the foam as meshes
  (each vertex's depth into the foam, 0 at its edge), the loose drops as drops (centre, size). Units: the picture's own
  framing, 1 = the sword's height, the tail's foot at 0.
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


def outlines(mask, eps, min_area):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return [cv2.approxPolyDP(c, eps, True)[:, 0, :].astype(float) for c in cs if cv2.contourArea(c) >= min_area]


def ear_clip(poly):
    """A simple polygon's triangles (ear clipping; its outline as traced, concave and narrow slots kept)."""
    pts = [tuple(map(float, p)) for p in poly]
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))
    idx = list(range(len(pts))) if area > 0 else list(range(len(pts)))[::-1]
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside(p, a, b, c):
        return cross(a, b, p) >= 0 and cross(b, c, p) >= 0 and cross(c, a, p) >= 0
    tris = []
    while len(idx) > 3:
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = pts[i0], pts[i1], pts[i2]
            if cross(a, b, c) <= 0:
                continue
            if any(inside(pts[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append([i0, i1, i2])
            idx.pop(k)
            break
        else:                                    # nothing clean left (a pinch): take the flattest corner
            k = min(range(len(idx)), key=lambda k: abs(cross(pts[idx[k - 1]], pts[idx[k]], pts[idx[(k + 1) % len(idx)]])))
            idx.pop(k)
    tris.append(idx[:])
    return tris


def fill_mesh(mask, step, eps=1.2, depth_px=10.0):
    """`mask` triangulated: its outline's points and a grid inside (every `step` px; 0 none), Delaunay, kept where a triangle lies inside the
    mask. Returns (points px, triangles, each point's depth into the mask, 0 at its edge to 1 at `depth_px`)."""
    m = mask.astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    pts = [p for c in cs for p in cv2.approxPolyDP(c, eps, True)[:, 0, :].tolist()]
    dist = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    ys, xs = np.mgrid[0:m.shape[0]:step, 0:m.shape[1]:step] if step else (np.zeros(0, int), np.zeros(0, int))
    for x, y in zip(xs.ravel(), ys.ravel()):
        if dist[y, x] > 2.5:
            pts.append([int(x), int(y)])
    pts = np.unique(np.array(pts), axis=0).astype(float)
    if len(pts) < 3:
        return pts, [], []
    tri = Delaunay(pts)
    grown = cv2.dilate(m, np.ones((3, 3), np.uint8))
    inside = lambda p: grown[min(int(round(p[1])), m.shape[0] - 1), min(int(round(p[0])), m.shape[1] - 1)] > 0
    keep = []
    for t in tri.simplices:
        a, b, c = pts[t]
        if all(inside(q) for q in ((a + b + c) / 3, (a + b) / 2, (b + c) / 2, (c + a) / 2)):
            keep.append(t.tolist())
    d = [min(1.0, float(dist[min(int(p[1]), m.shape[0] - 1), min(int(p[0]), m.shape[1] - 1)]) / depth_px) for p in pts]
    return pts, keep, d


def r3(xs):
    return [round(float(x), 4) for x in xs]


# ================================================================ the Tidewarden
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
    tip_m, mint_m = np.zeros_like(head), np.zeros_like(head)
    for x0, x1, b_end, m_end in prongs:
        tip_m[:b_end, x0:x1 + 1] = head[:b_end, x0:x1 + 1]
        mint_m[b_end:m_end, x0:x1 + 1] = head[b_end:m_end, x0:x1 + 1]
    gold_m = head & ~tip_m & ~mint_m
    s = 1.12 / float(foot)                               # the whole trident 1.12 rig units long
    hand = foot - int(round(0.13 / s))                   # the hand at the wrap's top, 0.13 above the star's point
    to3 = lambda p: (round((p[0] - 300) * s, 4), round((hand - p[1]) * s, 4))
    # each colour's part triangulated inside its own outline (the slots are too narrow for a polygon fill to keep)
    head_mesh = {}
    for name, mask in (("Gold", gold_m), ("Mint", mint_m), ("Tip", tip_m)):
        pts, tris = [], []
        for poly in outlines(mask, 1.8, 30):
            k = len(pts)
            pts += poly.tolist()
            tris += [[k + i for i in t] for t in ear_clip(poly)]
        head_mesh[name] = {"points": [to3(p) for p in pts], "tris": tris}
    vm = cv2.morphologyEx(vein.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    nv, vl, vs, _ = cv2.connectedComponentsWithStats(vm)
    vm = np.isin(vl, [i for i in range(1, nv) if vs[i, cv2.CC_STAT_AREA] >= 40])
    vm = cv2.dilate(vm.astype(np.uint8), np.ones((3, 3), np.uint8)) & head      # the painted crack and its bright edge
    vp, vt, _ = fill_mesh(vm, 6, eps=1.0)
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
        "veins": {"points": [to3(p) for p in vp], "tris": vt},
        "star": {"span": round((sx.max() - sx.min()) * s, 4), "foot": to3((300, foot))[1], "centre": to3((300, hand + 40 + np.median(sy)))[1]},
    }


# ================================================================ the Aquatic sword
def aquatic():
    im = cv2.imread(os.path.join(REFS, "fx-aquatic-water-ref.png"))[..., :3]
    H, S, V = hsv(im)
    bch, gch, rch = [im[..., i].astype(int) for i in range(3)]
    water = (S > 70) & (H > 85) & (H < 115)
    foam = (V > 215) & (bch - rch >= -2) & ~water
    water = cv2.morphologyEx(water.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(water.astype(np.uint8))
    water = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    # the foam: the big pieces above the shell's mouth as meshes, the small loose ones as drops
    foam[1000:] = False
    foam = cv2.morphologyEx(foam.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
    hull = cv2.dilate(water.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    nf, fl, fs, fc = cv2.connectedComponentsWithStats(foam.astype(np.uint8))
    sil = np.where(water | foam)
    top, foot_row = sil[0].min(), 1265
    s = 1.0 / float(foot_row - top)
    mid = 375
    to2 = lambda p: (round((p[0] - mid) * s, 4), round((foot_row - p[1]) * s, 4))
    pieces, drops = [], []
    for i in range(1, nf):
        area, (x, y) = fs[i, cv2.CC_STAT_AREA], fc[i]
        piece = fl == i
        if (piece & ~hull).sum() < 0.3 * area:            # a bubble in the water: the shader makes its own
            continue
        w_, h_ = fs[i, cv2.CC_STAT_WIDTH], fs[i, cv2.CC_STAT_HEIGHT]
        if area < 160 and max(w_, h_) < 2.2 * min(w_, h_) + 2:     # round and small: a drop; a thin tendril stays foam
            drops.append((to2((x, y)), round(np.sqrt(area / np.pi) * s, 4)))
            continue
        piece = cv2.dilate(piece.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0     # over the water's edge a little
        pts, tris, depth = fill_mesh(piece, 6, eps=1.2, depth_px=12.0)
        if tris:
            pieces.append({"points": [to2(p) for p in pts], "tris": tris, "depth": r3(depth)})
    # the blade: each row's two edges, every 14 px, from the crown down to where the shell hides it
    rows = []
    for y in range(int(np.where(water.any(1))[0].min()), int(np.where(water.any(1))[0].max()) + 1, 14):
        xs = np.where(water[y])[0]
        if len(xs) > 3:
            rows.append((to2((xs.min(), y))[0], to2((xs.max() + 1, y))[0], to2((0, y))[1]))
    return {"scale": s, "blade": rows, "foam": pieces, "drops": drops}


if __name__ == "__main__":
    tw, aq = tidewarden(), aquatic()
    with open(OUT, "w") as f:
        f.write('"""Traced from the round 9 references by trace_refs.py: do not edit (rerun it). Plain numbers, no image."""\n')
        f.write(f"TIDEWARDEN = {tw!r}\n\nAQUATIC = {aq!r}\n")
    print("head", {k: len(v["tris"]) for k, v in tw["head"].items()}, "veins", len(tw["veins"]["tris"]), "shaft_r", tw["shaft_r"],
          "tip", tw["tip"], "neck", tw["neck"], "star", tw["star"])
    print("blade rows", len(aq["blade"]), "foam pieces", [len(p["tris"]) for p in aq["foam"]], "drops", len(aq["drops"]))
    sys.exit(0)
