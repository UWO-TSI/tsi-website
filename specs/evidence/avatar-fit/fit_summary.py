"""Before/after table from two fit_check.py --json runs (before = the pre-fit art tree via --root).

  git archive d7a22995 art/characters | tar -x -C /tmp/before
  Blender -b -P art/characters/fit_check.py -- --no-fail --root /tmp/before/art/characters --json /tmp/fit_before.json
  Blender -b -P art/characters/fit_check.py -- --json /tmp/fit_after.json
  python3 specs/evidence/avatar-fit/fit_summary.py /tmp/fit_before.json /tmp/fit_after.json > specs/evidence/avatar-fit/fit-summary.txt
"""
import json, sys

b, a = (json.load(open(p)) for p in sys.argv[1:3])


def rng(r, slot, key, sub=None):
    v = [h[key][sub] if sub else h[key] for h in r["hair"].values() if h["slot"] == slot]
    v = [x for x in v if x is not None]
    return f"{min(v)}-{max(v)}"


rows = [
    ("hair: open edges per piece (bangs)", rng(b, "bangs", "open_edges"), rng(a, "bangs", "open_edges")),
    ("hair: open edges per piece (back)", rng(b, "back", "open_edges"), rng(a, "back", "open_edges")),
    ("hair: air under bangs, median", rng(b, "bangs", "gap", "median"), rng(a, "bangs", "gap", "median")),
    ("hair: air under bangs, max", rng(b, "bangs", "gap", "max"), rng(a, "bangs", "gap", "max")),
    ("hair: air under back caps, median", rng(b, "back", "gap", "median"), rng(a, "back", "gap", "median")),
    ("hair: air under back caps, max", rng(b, "back", "gap", "max"), rng(a, "back", "gap", "max")),
    ("hair: outer surface over scalp (bangs)", rng(b, "bangs", "outer_median"), rng(a, "bangs", "outer_median")),
    ("hair: outer surface over scalp (back)", rng(b, "back", "outer_median"), rng(a, "back", "outer_median")),
    ("seam: crown step, default pair", b["seam"]["default_pair"], a["seam"]["default_pair"]),
    ("seam: crown step, median of 192 pairs", b["seam"]["median_over_pairs"], a["seam"]["median_over_pairs"]),
    ("seam: crown step, worst of 192 pairs", b["seam"]["ledge_max"], a["seam"]["ledge_max"]),
    ("brows hidden by the default bangs (share)", b["hair"]["bangs_straight"].get("brow_cover"), a["hair"]["bangs_straight"].get("brow_cover")),
]
for k in b["headwear"]:
    B, A = b["headwear"][k], a["headwear"][k]
    rows.append((f"{k}: air over hair, max / open edges", f"{B['gap']['max']} / {B['open_edges']}", f"{A['gap']['max']} / {A['open_edges']}"))
    rows.append((f"{k}: rise over hair, median", B["rise"]["median"], A["rise"]["median"]))
for k in b["glasses"]:
    B, A = b["glasses"][k], a["glasses"][k]
    rows.append((f"{k}: lens to eye, F1.1 / worst eye", f"{B['offset_default']} / {B['offset_max']}", f"{A['offset_default']} / {A['offset_max']}"))
F, G = b["face"], a["face"]
rows += [
    ("face: texture stretch under eyes", F["per_layer"]["eyes"]["stretch"], G["per_layer"]["eyes"]["stretch"]),
    ("face: texture stretch under brows", F["per_layer"]["brows"]["stretch"], G["per_layer"]["brows"]["stretch"]),
    ("face: texture stretch under mouths", F["per_layer"]["mouth"]["stretch"], G["per_layer"]["mouth"]["stretch"]),
    ("face: anisotropy, worst feature", F["aniso_max"], G["aniso_max"]),
    ("face: eye reach round the head (deg azimuth)", F["eye_reach_lon_deg"], G["eye_reach_lon_deg"]),
    ("face: eye reach, surface normal (deg)", F["eye_reach_deg"], G["eye_reach_deg"]),
    ("F1.1 centre: azimuth deg / height m", f"{F['default_eye_centre_lon_deg']} / {F['default_eye_centre_z']}", f"{G['default_eye_centre_lon_deg']} / {G['default_eye_centre_z']}"),
    ("verdict", f"FAIL ({len(b['fails'])})" if b["fails"] else "PASS", f"FAIL ({len(a['fails'])})" if a["fails"] else "PASS"),
]
print("Fit check before/after (art/characters/fit_check.py; before = the pre-fit assets at d7a22995, same script).")
print("Distances in metres (the body is 1 m tall). Limits: " + ", ".join(f"{k} {v}" for k, v in a["limits"].items()))
print()
print(f"{'metric':48s} {'before':>20s} {'after':>20s}")
for k, x, y in rows:
    print(f"{k:48s} {str(x):>20s} {str(y):>20s}")
print()
print("Before, the glasses matched the old painted eyes; pinned to that spot they sat 1.0-1.5 cm off the re-measured")
print("eyes, which the refit fixed. Per-piece lines: fit-before.txt, fit-after.txt.")
