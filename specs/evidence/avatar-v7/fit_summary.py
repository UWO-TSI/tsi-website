"""Before/after table for avatar v7 from two fit_check.py --json runs (before = the v6 tree via --root).

  git archive b77c0d7f art/characters | tar -x -C /tmp/before
  Blender -b -P art/characters/fit_check.py -- --no-fail --root /tmp/before/art/characters --json specs/evidence/avatar-v7/fit-before-v6.json
  Blender -b -P art/characters/fit_check.py -- --json specs/evidence/avatar-v7/fit-v7.json
  python3 specs/evidence/avatar-v7/fit_summary.py > specs/evidence/avatar-v7/fit-v7.txt
"""
import json, os

d = os.path.dirname(os.path.abspath(__file__)) + "/"
b, a = json.load(open(d + "fit-before-v6.json")), json.load(open(d + "fit-v7.json"))
V7 = ["bangs_spiky", "back_short_spiky", "bangs_straight", "back_bob", "bangs_curtain", "back_long"]
print("Fit check, avatar v7 milestone 1 (art/characters/fit_check.py). before = the tree at b77c0d7f (v6 head, shell hair),")
print("after = this branch (hand-modeled v7 head, sculpted-lock styles). Metres; the body is 1 m tall.\n")
print(f"{'metric':58s}{'before (v6)':>18s}{'after (v7)':>18s}")


def row(k, x, y):
    print(f"{k:58s}{str(x):>18s}{str(y):>18s}")


for k in ("stretch_max", "aniso_max", "eye_reach_lon_deg", "eye_reach_deg"):
    row(f"face: {k}", b["face"][k], a["face"][k])
row("face: per layer (eyes / brows / mouth) aniso", "/".join(str(b["face"]["per_layer"][l]["aniso"]) for l in ("eyes", "brows", "mouth")),
    "/".join(str(a["face"]["per_layer"][l]["aniso"]) for l in ("eyes", "brows", "mouth")))
for pid in V7:
    hb, ha = b["hair"][pid], a["hair"][pid]
    row(f"{pid}: tris", hb["tris"], ha["tris"])
    row(f"{pid}: open edges / air max / air median", f"{hb['open_edges']}/{hb['gap']['max']}/{hb['gap']['median']}",
        f"{ha['open_edges']}/{ha['gap']['max']}/{ha['gap']['median']}")
    row(f"{pid}: outer surface over the scalp (median)", hb["outer_median"], ha["outer_median"])
    lk = a["locks"][pid]
    row(f"{pid}: locks, root verts exposed, lock dive max", "-", f"{lk['locks']}, {lk['roots_exposed']}/{lk['root_verts']}, {lk['dive_max']}")
row("seam: crown ledge, default pair / worst of 192", f"{b['seam']['default_pair']}/{b['seam']['ledge_max']}",
    f"{a['seam']['default_pair']}/{a['seam']['ledge_max']}")
for pid in ("acc_flower_crown", "acc_crystal_circlet"):
    hb, ha = b["headwear"][pid], a["headwear"][pid]
    row(f"{pid}: air max / poke max", f"{hb['gap']['max']}/{hb['poke_max']}", f"{ha['gap']['max']}/{ha['poke_max']}")
g = "acc_glasses_round"
row(f"{g}: lens to eye, default / worst", f"{b['glasses'][g]['offset_default']}/{b['glasses'][g]['offset_max']}",
    f"{a['glasses'][g]['offset_default']}/{a['glasses'][g]['offset_max']}")
row("verdict (fails / flags)", f"{'PASS' if not b['fails'] else 'FAIL'} ({len(b['fails'])} / {len(b.get('flags', []))})",
    f"{'PASS' if not a['fails'] else 'FAIL'} ({len(a['fails'])} / {len(a.get('flags', []))})")
print("\nHead surface (v7/head_model.deviation, against head_shape's analytic surface): v6 inside max 7.4 mm, median 1.6 mm;")
print("v7 inside max 4.0 mm, outside max 3.3 mm, median 0.5 mm. Neck seam within 0.4-0.8 mm of v6's all round.")
print("\nFLAGs (reported, not gate failures): skin standing out through a shell piece where it covers the scalp. The older")
print("library's long side locks and the undercut's shaved rows are 18-36 deg flat rows that sag into the head; most had it")
print("on the v6 head too, and they are rebuilt as locks after David's review.")
for f in a.get("flags", []):
    print("  after:  " + f)
for f in b.get("flags", []):
    print("  before: " + f)
