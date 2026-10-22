import sys, os
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
tags = sys.argv[3].split(",")
views = sys.argv[4].split(",") if len(sys.argv) > 4 else ["front","34","side","back","high","low"]
kinds = sys.argv[5].split(",") if len(sys.argv) > 5 else ["w","c","d"]
S = 240
rows = []
for t in tags:
    for k in kinds:
        row = Image.new("RGB", (S*len(views), S), (250,245,235))
        for i, v in enumerate(views):
            p = os.path.join(d, f"{t}_{k}_{v}.png")
            if not os.path.exists(p): continue
            im = Image.open(p).convert("RGBA").resize((S,S))
            bg = Image.new("RGBA", (S,S), (250,245,235,255)); bg.alpha_composite(im)
            row.paste(bg.convert("RGB"), (i*S, 0))
        rows.append(row)
img = Image.new("RGB", (S*len(views), S*len(rows)), (250,245,235))
for i, r in enumerate(rows): img.paste(r, (0, i*S))
img.save(out)
