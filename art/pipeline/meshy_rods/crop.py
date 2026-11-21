import sys, json, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
im = Image.open(src).convert("RGB"); a = np.asarray(im).copy()
for x0,y0,x1,y1 in spec.get("white", []): a[y0:y1, x0:x1] = 255
m = a.min(axis=2) < 225
dm = ndimage.binary_dilation(m, iterations=6)
lab, n = ndimage.label(dm)
comps = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    if (sl[0].stop-sl[0].start)*(sl[1].stop-sl[1].start) >= 4000: comps.append((sl[0].start, i+1, sl))
comps.sort()
for k,(y,i,sl) in enumerate(comps): print(k, sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)
for k, name in spec["keep"].items():
    y,i,sl = comps[int(k)]
    keep = ndimage.binary_dilation(lab == i, iterations=3)
    b = a.copy(); b[~keep] = 255
    c = b[sl[0], sl[1]]
    h, w = c.shape[:2]; S = int(max(h, w) * 1.06)
    sq = np.full((S, S, 3), 255, np.uint8); oy, ox = (S-h)//2, (S-w)//2; sq[oy:oy+h, ox:ox+w] = c
    Image.fromarray(sq).save(f"{outdir}/{name}.png")
