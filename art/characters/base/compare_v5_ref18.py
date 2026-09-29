"""Side-by-side of the v5 3/4 render and reference #18, both scaled to the same body height
(bare head top to sole), with guide lines at eye, chin, hem and sole measured in each image.

  python3 art/characters/base/compare_v5_ref18.py <frames_dir>     (needs Pillow + numpy)

Reference lines come from ref18_measurements.json. v5 lines: chin/hem/sole from the model's
geometry through the level orthographic camera (render_v5.py), eye line detected from the render's
dark eye pixels, so a texture/UV mistake shows up. Prints the per-line error as % of body height.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
FR = sys.argv[1]
M = json.load(open(os.path.join(HERE, "ref18_measurements.json")))
px, rt = M["px"], M["ratios_of_body_height"]
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ref = Image.open(os.path.join(ROOT, "specs/references/characters/david/character-ref-18.png")).convert("RGB")
ours = Image.open(os.path.join(FR, "face34.png")).convert("RGB")

# v5 camera mapping (render_v5.py): level ortho, ORTHO=1.2 over 880 rows, camera z 0.5
PXM, CAMZ, RESY = 880 / 1.2, 0.5, 880
zpx = lambda z: RESY / 2 - (z - CAMZ) * PXM
o_top, o_sole = zpx(1.0), zpx(0.0)
o_chin = zpx(1.0 - rt["head_height"])
o_hem = zpx(rt["hem_height_from_sole"])
a = np.array(ours).astype(int)
dark = (a.sum(2) < 200)
rows = np.nonzero(dark[int(zpx(0.85)):int(zpx(0.6))].sum(1) > 3)[0] + int(zpx(0.85))
o_eye = (rows.min() + rows.max()) / 2 if len(rows) else float("nan")

r_top, r_sole = px["bare_head_top"], px["sole"]
ref_lines = {"eye": px["eye_center_y"], "chin": px["chin"], "hem": px["hem_y"], "sole": r_sole}
our_lines = {"eye": o_eye, "chin": o_chin, "hem": o_hem, "sole": o_sole}

H = 700
def norm(img, top, sole, x0, x1):
    s = H / (sole - top)
    crop = img.crop((x0, int(top - 0.08 * (sole - top)), x1, int(sole + 0.03 * (sole - top))))
    return crop.resize((int(crop.width * s), int(crop.height * s))), s, top - 0.08 * (sole - top)

rimg, rs, roff = norm(ref, r_top, r_sole, 170, 640)
oimg, os_, ooff = norm(ours, o_top, o_sole, 110, 610)
Wt = rimg.width + oimg.width + 30
Ht = max(rimg.height, oimg.height)
out = Image.new("RGB", (Wt, Ht + 40), (255, 255, 255))
out.paste(rimg, (0, 40)); out.paste(oimg, (rimg.width + 30, 40))
d = ImageDraw.Draw(out)
d.text((10, 10), "reference #18 (bare head top -> sole)", fill=(0, 0, 0))
d.text((rimg.width + 40, 10), "v5 base body", fill=(0, 0, 0))
cols = {"eye": (220, 40, 40), "chin": (40, 140, 40), "hem": (40, 80, 220), "sole": (120, 60, 160)}
report = {}
for k in ref_lines:
    ry = (ref_lines[k] - roff) * rs + 40
    oy = (our_lines[k] - ooff) * os_ + 40
    d.line([(0, ry), (rimg.width, ry)], fill=cols[k], width=2)
    d.line([(rimg.width + 30, oy), (Wt, oy)], fill=cols[k], width=2)
    d.line([(rimg.width, ry), (rimg.width + 30, oy)], fill=cols[k], width=1)
    d.text((4, ry - 14), k, fill=cols[k])
    err = ((our_lines[k] - o_top) / (o_sole - o_top) - (ref_lines[k] - r_top) / (r_sole - r_top)) * 100
    report[k] = round(err, 2)
out.save(os.path.join(FR, "compare.png"))
print("LINE_ERR_%", report)
