import sys, numpy as np
from PIL import Image
from scipy import ndimage
for p in sys.argv[1:]:
    a = np.asarray(Image.open(p).convert("RGB")).copy()
    m = a.min(axis=2) < 235
    o = ndimage.binary_opening(m, structure=np.ones((4,4)))
    o = ndimage.binary_dilation(o, iterations=2) & m
    # keep big blobs only
    lab, n = ndimage.label(o); sizes = ndimage.sum(o, lab, range(1, n+1))
    keep = np.isin(lab, [i+1 for i,s in enumerate(sizes) if s > 30])
    a[~keep] = 255
    Image.fromarray(a).save(p)
