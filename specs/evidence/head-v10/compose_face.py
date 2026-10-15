"""Compose face canvases (1024, skin background) from the v7 atlas: python3 faces.py <out_dir> name=eyes,mouth[,extra+extra] ..."""
import json, os, sys
from PIL import Image
ART = "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/head-v10/art/characters/v7/face"
F = json.load(open(os.path.join(ART, "face_v7.json")))
P1 = Image.open(os.path.join(ART, F["atlas"])).convert("RGBA")
P2 = Image.open(os.path.join(ART, F["atlas2"])).convert("RGBA")
A = F["anchors"]
def put(c, cell, anchor, mirror):
    x, y, w, h, ax, ay = cell[:6]
    page = P2 if len(cell) > 6 and cell[6] == 1 else P1
    im = page.crop((x, y, x + w, y + h))
    c.alpha_composite(im, (int(round(anchor[0] * 1024 - ax)), int(round(anchor[1] * 1024 - ay))))
    if mirror:
        c.alpha_composite(im.transpose(Image.FLIP_LEFT_RIGHT), (int(round((1 - anchor[0]) * 1024 - (w - ax))), int(round(anchor[1] * 1024 - ay))))
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for spec in sys.argv[2:]:
    name, parts = spec.split("=")
    eyes, mouth, *rest = parts.split(",")
    c = Image.new("RGBA", (1024, 1024), (232, 181, 138, 255))
    L = F["layers"]
    it = L["eyes"]["items"][eyes]
    if "left" in it and it["left"] is None: put(c, it["open"], A["eye_pair"], False)
    elif "left" in it: put(c, it["open"], A["eye"], False); put(c, it["left"], A["eye_left"], False)
    else: put(c, it["open"], A["eye"], True)
    put(c, L["mouth"]["items"][mouth], A["mouth"], False)
    for ex in (rest[0].split("+") if rest and rest[0] else []):
        e = L["extras"]["items"][ex]; put(c, e["cell"], A[e["anchor"]], e["mirror"])
    c.save(os.path.join(out, name + ".png"))
