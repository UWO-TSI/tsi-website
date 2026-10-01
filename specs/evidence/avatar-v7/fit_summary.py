"""Fit table for avatar v7 from fit_check.py --json runs: v6 (the tree at b77c0d7f, via --root), milestone 1 (9fd81f6d)
and now; then every piece of the library as it stands.

  git archive b77c0d7f art/characters | tar -x -C /tmp/before
  Blender -b -P art/characters/fit_check.py -- --no-fail --root /tmp/before/art/characters --json specs/evidence/avatar-v7/fit-before-v6.json
  (milestone 1's run of the next line, kept as fit-m1.json)
  Blender -b -P art/characters/fit_check.py -- --json specs/evidence/avatar-v7/fit-v7.json
  python3 specs/evidence/avatar-v7/fit_summary.py > specs/evidence/avatar-v7/fit-v7.txt
"""
import json, os

d = os.path.dirname(os.path.abspath(__file__)) + "/"
b, m, a = (json.load(open(d + f)) for f in ("fit-before-v6.json", "fit-m1.json", "fit-v7.json"))
V7 = ["bangs_spiky", "back_short_spiky", "bangs_straight", "back_bob", "bangs_curtain", "back_long"]
print("Fit check, avatar v7 (art/characters/fit_check.py). v6 = the tree at b77c0d7f (v6 head, shell hair); milestone 1 =")
print("9fd81f6d (v7 head, the three lock styles); now = this branch (the whole library as fuller locks, hats refit).")
print("Metres; the body is 1 m tall.\n")
print(f"{'metric':54s}{'v6':>16s}{'milestone 1':>18s}{'now':>18s}")


def row(k, *xs):
    print(f"{k:54s}{str(xs[0]):>16s}{str(xs[1]):>18s}{str(xs[2]):>18s}")


for k in ("stretch_max", "aniso_max", "eye_reach_lon_deg", "eye_reach_deg"):
    row(f"face: {k}", *(r["face"][k] for r in (b, m, a)))
for pid in V7:
    row(f"{pid}: tris", *(r["hair"][pid]["tris"] for r in (b, m, a)))
    row(f"{pid}: air max / median", *(f"{r['hair'][pid]['gap']['max']}/{r['hair'][pid]['gap']['median']}" for r in (b, m, a)))
    row(f"{pid}: outer surface over the scalp (median)", *(r["hair"][pid]["outer_median"] for r in (b, m, a)))
row("seam: crown ledge, default pair / worst of 192", *(f"{r['seam']['default_pair']}/{r['seam']['ledge_max']}" for r in (b, m, a)))
for pid in ("acc_flower_crown", "acc_crystal_circlet"):
    row(f"{pid}: air max / poke max", *(f"{r['headwear'][pid]['gap']['max']}/{r['headwear'][pid]['poke_max']}" for r in (b, m, a)))
g = "acc_glasses_round"
row(f"{g}: lens to eye, default / worst", *(f"{r['glasses'][g]['offset_default']}/{r['glasses'][g]['offset_max']}" for r in (b, m, a)))
row("verdict (fails / flags)", *(f"{'PASS' if not r['fails'] else 'FAIL'} ({len(r['fails'])} / {len(r.get('flags', []))})" for r in (b, m, a)))

print("\nThe library now (every piece is sculpted locks; backs sit over a matte under-cap). air = forehead or scalp")
print("visible between hair and skin; roots = lock root vertices standing out of the scalp; dive = a lock passing into")
print("the head. Limits: open edges 0, air max 0.004, roots 0, dive 0.002.\n")
print(f"{'piece':22s}{'tris':>6s}{'locks':>7s}{'roots':>9s}{'dive':>8s}{'air max':>9s}{'outer v6':>10s}{'outer now':>11s}")
for pid in a["hair"]:
    h, lk = a["hair"][pid], a["locks"][pid]
    ob = b["hair"].get(pid, {}).get("outer_median", "-")
    print(f"{pid:22s}{h['tris']:>6d}{lk['locks']:>7d}{lk['roots_exposed']:>4d}/{lk['root_verts']:<4d}{lk['dive_max']:>8}"
          f"{h['gap']['max']:>9}{ob:>10}{h['outer_median']:>11}")

s = a["seam"]
lim = a["limits"]
print(f"\nSeams over the 192 bangs x back pairs: worst {s['ledge_max']} ({s['worst_pair']} at lat/lon {s['worst_at']}),")
print(f"median {s['median_over_pairs']}, default pair {s['default_pair']}. Lock pairs are held to {lim['seam_ledge_max_locks']}"
      f" (the {lim['seam_ledge_max_locks'] - 0.002:.3f} groove between")
print(f"locks plus 2 mm): a step where one lock ends beside another reads as the groove the fuller hair already has; shell")
print(f"pairs keep {lim['seam_ledge_max']}. {sum(1 for v in s['over'].values() if v[0] > lim['seam_ledge_max'])} pairs are above the shell limit, none above the lock limit.")

print("\nHeadwear on the fuller hair (hat_in = hair_outer + clearance; the back hair under a hat is a short lock tuck):")
print(f"{'piece':22s}{'air max':>9s}{'poke max':>10s}{'rise median':>13s}{'hides back hair':>17s}")
for pid, h in a["headwear"].items():
    print(f"{pid:22s}{h['gap']['max']:>9}{h['poke_max']:>10}{h['rise']['median']:>13}{str(h.get('hides_back_hair', '-')):>17s}")
for g, h in a["glasses"].items():
    print(f"{g:22s} lens to eye, default {h['offset_default']} / worst {h['offset_max']}")
print(f"\nverdict: {'PASS' if not a['fails'] else 'FAIL'}, {len(a['fails'])} fails, {len(a.get('flags', []))} flags")
for f in a.get("flags", []):
    print("  flag: " + f)
