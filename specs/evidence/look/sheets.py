"""Before/after contact sheets and a numbers table for look-development §5.8.

python3 specs/evidence/look/sheets.py specs/evidence/look/baseline specs/evidence/look/after [before.json after.json]

Per sheet: one row per frame, before (baseline) on the left, after on the right, 640x360 each.
Prints a markdown table of the measure.json numbers side by side.
"""
import json, sys, pathlib
from PIL import Image, ImageDraw

SHEETS = {
    "H-V1": ["H-V1-day", "H-V1-evening", "H-V1-dawn", "H-V1-night", "H-V1-overcast"],
    "H-V2": ["H-V2-day", "H-V2-evening", "H-V2-dawn", "H-V2-night", "H-V2-overcast"],
    "L-V1": ["L-V1-day", "L-V1-evening", "L-V1-dawn", "L-V1-night", "L-V1-overcast"],
    "H-V3-L-V2": ["H-V3-day", "L-V2-day"],
    "interiors": ["H-hq-day", "H-cafe-day", "H-ruins-day", "L-hq-day", "L-cafe-day", "L-ruins-day"],
    # §6 glints (shots.mjs glints)
    "H-V3": ["H-V3-day", "H-V3-evening"],
    "close": ["H-close-glint-day", "H-close-glint-evening", "H-close-window-day", "H-close-window-night", "H-close-lamp-day", "H-close-lamp-night"],
}
W, H = 640, 360

def main(before, after, before_json=None, after_json=None):
    before, after = pathlib.Path(before), pathlib.Path(after)
    for sheet, names in SHEETS.items():
        rows = [n for n in names if (before / f"{n}.webp").exists() and (after / f"{n}.webp").exists()]
        if not rows:
            continue
        img = Image.new("RGB", (2 * W, len(rows) * H), "white")
        draw = ImageDraw.Draw(img)
        for i, n in enumerate(rows):
            for j, d in enumerate((before, after)):
                img.paste(Image.open(d / f"{n}.webp").convert("RGB").resize((W, H), Image.LANCZOS), (j * W, i * H))
                label = f"{n} · {'before' if j == 0 else 'after'}"
                draw.rectangle((j * W + 6, i * H + 6, j * W + 12 + 7 * len(label), i * H + 24), fill=(0, 0, 0))
                draw.text((j * W + 10, i * H + 9), label, fill=(255, 255, 255))
        img.save(after / f"sheet-{sheet}.webp", quality=82)
        print("sheet", sheet, len(rows))
    b, a = (json.loads(pathlib.Path(j or d / "measure.json").read_text()) for d, j in ((before, before_json), (after, after_json)))
    keys = ["rms_contrast", "mean_saturation", "highlight_share", "mid_band_share", "L_p5_p50_p95", "top_band_sat", "shadow_share", "lit_shadow_grass"]
    print("| frame | " + " | ".join(keys) + " |")
    print("|" + "---|" * (len(keys) + 1))
    for n in sorted(set(b) & set(a)):
        print(f"| {n} | " + " | ".join(f"{b[n].get(k, '–')} → {a[n].get(k, '–')}" for k in keys) + " |")

if __name__ == "__main__":
    main(*sys.argv[1:5])
