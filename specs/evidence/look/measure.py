"""Pixel measurements for look development (specs/look-development.md §1).

python3 specs/evidence/look/measure.py <dir-of-pngs>  ->  <dir>/measure.json, table on stdout

Per frame (sRGB PNG from the canvas):
  L* histogram (10 bins), p5/p50/p95 L*, stops between p5 and p95 luminance,
  RMS contrast = std of sRGB luma (0-1), mean HSV saturation,
  mid-band share = pixels with L* in 35-65 (the grey middle a flat image piles into),
  highlight share L* > 90, dark share L* < 25, lit-grass texture contrast (CV of luminance) and saturation,
  top-band saturation (top 10% of rows: the sky strip in V1/V2).
Per pair  <name>(-pairA) + <name>-noshadow  (same frame, key-light shadow opacity 0):
  cast-shadow mask = pixels >= 15% brighter without the shadow; its share of the frame;
  lit:shadow = median linear-luminance ratio on shadowed GRASS pixels (green-dominant),
  with per-channel ratios (R > B means the shadow is bluer than the lit ground).
"""
import json, sys, pathlib
import numpy as np
from PIL import Image

def load(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return a, lin

def frame_stats(a, lin):
    Y = lin @ [0.2126, 0.7152, 0.0722]
    L = np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)
    luma = a @ [0.2126, 0.7152, 0.0722]
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    p5, p95 = np.percentile(Y, [5, 95])
    # Lit grass: green-dominant and bright (L* > 55), the patch texture contrast is read on.
    grass = (a[..., 1] > a[..., 0] * 1.05) & (a[..., 1] > a[..., 2] * 1.05) & (L > 55)
    hist, _ = np.histogram(L, bins=10, range=(0, 100))
    return {
        "L_p5_p50_p95": [round(float(v), 1) for v in np.percentile(L, [5, 50, 95])],
        "stops_p5_p95": round(float(np.log2(max(p95, 1e-4) / max(p5, 1e-4))), 2),
        "rms_contrast": round(float(luma.std()), 3),
        "mean_saturation": round(float(sat.mean()), 3),
        "mid_band_share": round(float(((L >= 35) & (L <= 65)).mean()), 3),
        "highlight_share": round(float((L > 90).mean()), 3),
        "dark_share": round(float((L < 25).mean()), 3),
        "grass_lit_cv": round(float(Y[grass].std() / Y[grass].mean()), 3) if grass.sum() > 50 else None,
        "grass_lit_sat": round(float(sat[grass].mean()), 3) if grass.sum() > 50 else None,
        "top_band_sat": round(float(sat[: max(1, a.shape[0] // 10)].mean()), 3),
        "L_histogram_pct": [round(float(v) * 100 / L.size, 1) for v in hist],
    }

def pair_stats(shadowed, open_):
    (a1, s), (a0, o) = shadowed, open_
    Ys, Yo = s @ [0.2126, 0.7152, 0.0722], o @ [0.2126, 0.7152, 0.0722]
    mask = (Yo > 0.02) & (Yo / np.maximum(Ys, 1e-5) >= 1.15)
    grass = mask & (a0[..., 1] > a0[..., 0]) & (a0[..., 1] > a0[..., 2])
    out = {"shadow_share": round(float(mask.mean()), 3), "grass_shadow_px": int(grass.sum())}
    if grass.sum() > 50:
        out["lit_shadow_grass"] = round(float(np.median(Yo[grass] / np.maximum(Ys[grass], 1e-5))), 2)
        out["lit_shadow_rgb"] = [round(float(np.median(o[..., c][grass] / np.maximum(s[..., c][grass], 1e-5))), 2) for c in range(3)]
    if mask.sum() > 50:
        out["lit_shadow_all"] = round(float(np.median(Yo[mask] / np.maximum(Ys[mask], 1e-5))), 2)
    return out

def main(folder):
    folder = pathlib.Path(folder)
    frames = {p.stem: load(p) for p in sorted(folder.glob("*.png"))}
    result = {name: frame_stats(*f) for name, f in frames.items() if not name.endswith("-noshadow")}
    for name in frames:
        if name.endswith("-noshadow"):
            base = name[: -len("-noshadow")]
            lit = frames.get(base + "-pairA") or frames.get(base)
            if lit is not None:
                result.setdefault(base, {}).update(pair_stats(lit, frames[name]))
    (folder / "measure.json").write_text(json.dumps(result, indent=1))
    keys = ["rms_contrast", "mean_saturation", "mid_band_share", "highlight_share", "stops_p5_p95", "L_p5_p50_p95", "grass_lit_cv", "grass_lit_sat", "top_band_sat", "shadow_share", "lit_shadow_grass", "lit_shadow_rgb"]
    print("| frame | " + " | ".join(keys) + " |")
    print("|" + "---|" * (len(keys) + 1))
    for name, r in result.items():
        print(f"| {name} | " + " | ".join(str(r.get(k, "")) for k in keys) + " |")

if __name__ == "__main__":
    main(sys.argv[1])
