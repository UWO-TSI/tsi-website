"""The v1 barrier placements as a PROPOSAL for the v2 world (specs/v1-drop.md §2), for David to accept in /lab/map.

  python3 art/barriers/propose_v1.py

Reads web/data/world-map.json (never writes it) and writes web/data/proposals/v1-barriers.json: barrier objects
(lib/game/barriers.ts) with a note each. The painter shows them as a ghosted overlay with Accept buttons; accepting
copies them into the painter's document, and David's Save writes the map. Placement:

  rockslide        across the carved trail where it leaves level 2 for level 3 (the trail's narrowest climb)
  unbuilt-bridge   on the village bank at each of the generator's two bridge sites (draft_from_png.py BRIDGES),
                   facing across the strait
  ruins-rubble     where the path from the village meets the "Ruins in forest" zone (its north edge, x 48)
  forest-edge      a ring of segments round the rest of that zone, on land, each facing out

Then a flood fill over the cells (steps of at most one level, as the walker; water and the barriers' solids blocked)
from the spawn checks that the mountain above level 3 and the ruins zone's inside are out of reach. The walker test
(web/lib/game/barriers.test.ts) checks the same with the game's own movement.
"""
import json, math, os
from collections import deque

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
MAP = os.path.join(ROOT, "web", "data", "world-map.json")
OUT = os.path.join(ROOT, "web", "data", "proposals", "v1-barriers.json")
d = json.load(open(MAP))
W, D, OX, OZ = d["width"], d["depth"], d["originX"], d["originZ"]
LV, SF = d["levels"], d["surfaces"]
ANN = {a["name"]: {tuple(c) for c in a["cells"]} for a in d.get("annotations", [])}
WATER, RAMP = (6, 7), 8
# Solids in each model's frame (lib/game/barriers.ts BARRIERS): cx, cz, hw, hd.
SOLID = {"forest-edge": (-0.08, 0.14, 2.62, 1.12), "ruins-rubble": (0.09, -0.05, 1.8, 1.19), "rockslide": (-0.03, 0.18, 2.2, 1.75),
         "unbuilt-bridge": (0.38, 0.12, 1.62, 0.93)}


def cell(x, z): return int(round(x - OX)), int(round(z - OZ))
def world(cx, cz): return cx + OX, cz + OZ
def lv(cx, cz): return int(LV[cz][cx], 36)
def sf(cx, cz): return int(SF[cz][cx], 36)
def land(cx, cz): return 0 <= cx < W and 0 <= cz < D and sf(cx, cz) not in WATER
def on_land(x, z): return land(*cell(x, z))
def r2(v): return round(v * 20) / 20


def facing_out(theta):
    """A yaw whose front (the model's -z) points along the angle `theta` (world x = cos, z = sin)."""
    return math.atan2(-math.cos(theta), -math.sin(theta))


objects = []


def add(oid, model, x, z, yaw, note, scale=1.0):
    o = {"id": oid, "kind": "barrier", "model": model, "x": r2(x), "z": r2(z), "yaw": round(yaw, 4)}
    objects.append({**o, **({"scale": scale} if scale != 1 else {}), "note": note})


# 1.3 times the model: the climb is wider than one slide, and the walker's own flood (barriers.test.ts) seals at every
# turn from -0.9 to 0.3 here, not just the one.
add("barrier-trail-rockslide", "rockslide", -25, -93, -0.3,
    "Over the carved trail where it climbs from level 2 to 3: the mountain and the Oracle temple wait for v2 (the cleanup).", scale=1.3)
add("barrier-north-bridge-0", "unbuilt-bridge", -53.4, 65, math.pi / 2,
    "Village bank of bridge site 0 (draft_from_png.py BRIDGES): planks stacked, stakes and a rope across the bridge head.")
add("barrier-north-bridge-1", "unbuilt-bridge", -69.8, -4.25, math.pi / 2 + 0.35,
    "Village bank of bridge site 1, facing across the strait along the bridge's line.")
C, R = (48.0, -52.0), 30.0
n = int(2 * math.pi * R / 4.15)
ring = [(2 * math.pi * k / n, C[0] + R * math.cos(2 * math.pi * k / n), C[1] + R * math.sin(2 * math.pi * k / n)) for k in range(n)]
gate = min(ring, key=lambda p: math.hypot(p[1] - 48, p[2] + 22))
add("barrier-ruins-entrance", "ruins-rubble", gate[1], gate[2], facing_out(gate[0]),
    "Where the path from the village meets the ruins: fallen stones and roots. The ruins open with combat (v3).")
k = 0
for th, x, z in ring:
    if (th, x, z) == gate or not on_land(x, z):
        continue
    add(f"barrier-forest-{k}", "forest-edge", x, z, facing_out(th), "The dense forest edge round the ruins (one of a ring).")
    k += 1


def boxes():
    out = []
    for o in objects:
        k = o.get("scale", 1)
        cx, cz, hw, hd = (v * k for v in SOLID[o["model"]])
        c, s = math.cos(o["yaw"]), math.sin(o["yaw"])
        out.append((o["x"] + cx * c + cz * s, o["z"] - cx * s + cz * c, o["yaw"], hw, hd))
    return out


def blocked(bs, cx, cz):
    x, z = world(cx, cz)
    for bx, bz, yaw, hw, hd in bs:
        dx, dz = x - bx, z - bz
        if abs(dx * math.cos(yaw) - dz * math.sin(yaw)) < hw and abs(dx * math.sin(yaw) + dz * math.cos(yaw)) < hd:
            return True
    return False


def reach(start, bs):
    s = cell(*start)
    seen, q = {s}, deque([s])
    while q:
        cx, cz = q.popleft()
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb = (cx + dx, cz + dz)
            if nb in seen or not land(*nb) or blocked(bs, *nb):
                continue
            if abs(lv(*nb) - lv(cx, cz)) > 1 and RAMP not in (sf(*nb), sf(cx, cz)):
                continue
            seen.add(nb)
            q.append(nb)
    return seen


spawn = next(o for o in d["objects"] if o["kind"] == "spawn")
r = reach((spawn["x"], spawn["z"]), boxes())
inner = [c for c in ANN["Ruins in forest"] if math.hypot(world(*c)[0] - C[0], world(*c)[1] - C[1]) < R - 2.5]
high = sum(1 for c in r if lv(*c) >= 4)
inside = sum(1 for c in inner if c in r)
print(f"{len(objects)} barriers; reachable: mountain above level 3 {high} cells, ruins inside {inside} of {len(inner)} cells")
assert high == 0 and inside == 0, "a barrier leaves a way through"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc = {
    "title": "v1 natural barriers",
    "target": "world-map",
    "spec": "specs/v1-drop.md §2",
    "about": "Proposed by game/v1-world for David to accept in /lab/map (?fixture=v2). Accepting adds them to the "
             "painter's document; Save writes web/data/world-map.json. Each stands until its drop opens the way "
             "(lib/game/barriers.ts).",
    "objects": objects,
}
with open(OUT, "w") as f:
    f.write("{\n" + ",\n".join(f'  "{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in doc.items() if k != "objects"))
    f.write(',\n  "objects": [\n' + ",\n".join(f"    {json.dumps(o)}" for o in objects) + "\n  ]\n}\n")
print("wrote", OUT)
