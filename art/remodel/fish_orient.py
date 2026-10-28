"""The fish orientation check (game/remodel round 3; David: "make sure the orientation of these fish models are correct").

Every fish the catalogue lists, loaded as the game levels it (components/game/peaceful/TankFish.tsx levelFish: a raw
export gets the calibration, 0.1 and a quarter turn about x (ours need none), then a quarter turn about x lays the hanging fish level),
seen from +x: a right fish shows its nose on the left and its back up. One PNG per fish in <out-dir>.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/fish_orient.py -- x <out-dir> [acnh|remodel] [names|all] [3: also from above and below]
"""
import os, re, sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import review as R  # noqa: E402

out_dir = R.ARGS[1]
folder = R.ARGS[2] if len(R.ARGS) > 2 else "remodel"
only = R.ARGS[3].split(",") if len(R.ARGS) > 3 and R.ARGS[3] != "all" else None
views = [[90, 0]] + ([[90, 80], [90, -80]] if len(R.ARGS) > 4 and R.ARGS[4] == "3" else [])
src = "".join(open(os.path.join(R.K.ROOT, "web", "lib", "game", f)).read() for f in ("fishing.ts", "fishCatalog.ts"))
FISH = [(m.group(1), "raw: true" in m.group(0)) for m in re.finditer(r'model: "/assets/acnh/fish/([\w-]+)\.glb"[^\n]*', src)]

os.makedirs(out_dir, exist_ok=True)
for name, raw in FISH:
    if only and name not in only:
        continue
    raw = raw and folder == "acnh"   # ours are in the game's frame (build_fish.py)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    R.stage(200)
    path = f"/assets/{'acnh' if folder == 'acnh' else 'game/remodel'}/fish/{name}.glb"
    obs = R.load({"path": path, "scale": 0.1 if raw else 1, "rot": [180 if raw else 90, 0, 0]})
    R.K.show_vertex_colors([o for o in obs if o.data.color_attributes])
    frames = R.render(obs, obs, os.path.join(out_dir, name), views, 200)
    R.sheet(frames, os.path.join(out_dir, f"{name}.png"))
    print("FISH", name, "raw" if raw else "")
