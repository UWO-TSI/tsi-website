"""Remodel evidence: each model's before and after as one webp each, the game's own frame (tools/ingame.mjs) beside the
Blender views under the same camera and light (art/remodel/review.py).

  python3 specs/evidence/remodel/tools/compose.py <review-dir> <ingame-dir> <out-dir> id[,id...]

Writes <out-dir>/<id>-before.webp and <id>-after.webp, 400 px tall. A model with no in-game frame (it moves, or hides
under water) gets the Blender views alone.
"""
import os, sys
from PIL import Image

RV, IG, OUT = sys.argv[1:4]
IDS = sys.argv[4].split(",")
H = 400

for i in IDS:
    for side, ig in (("before", "before"), ("after", "after")):
        parts = []
        shot = os.path.join(IG, f"{i}.{ig}.png")
        if os.path.exists(shot):
            parts.append(Image.open(shot).convert("RGB"))
        parts.append(Image.open(os.path.join(RV, f"{i}-{side}.png")).convert("RGB"))
        parts = [p.resize((round(p.width * H / p.height), H), Image.LANCZOS) for p in parts]
        sheet = Image.new("RGB", (sum(p.width for p in parts) + 8 * (len(parts) - 1), H), (244, 239, 227))
        x = 0
        for p in parts:
            sheet.paste(p, (x, 0))
            x += p.width + 8
        sheet.save(os.path.join(OUT, f"{i}-{side}.webp"), quality=82)
        print(i, side, sheet.size)
