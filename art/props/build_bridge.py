"""The wooden footbridge (the map's `bridge` objects, DefaultIslandWorld and the world editor; GENESIS's stage deck,
SeasonalEvents), round 2 (David, 2026-10-17, row 314: "simpler like the animal crossing one with bigger wood stumps,
more simple but cartoony"; the bridge planks keep the old texture). Replaces acnh/props/bridge-wooden.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_bridge.py [-- review <dir>]

Writes web/public/assets/game/props/bridge-plank.glb (named bridge-* so lib/game/shadows.ts gives it no ground contact).
Frame: the old bridge's, so the walk keeps its numbers: game units at scale 1, spanning x +-1.9, the deck's top at
0.075 (lib/game/propModels.ts BRIDGE_DECK_TOP), its rail logs along z +-1.27 inside the solid strips (defaultIsland
BRIDGE_DECK_HALF 1.0 to BRIDGE_RAIL_OUT 1.65), the stumps down to -1.5 into the river bed.

Few, big, rounded parts: eight wide planks across the span on two stringer logs and two cross logs, a chunky log along
each side as a low rail, and four big round stumps at the corners that run down into the water as the legs, their cut
tops pale with a ring. The planks wear the old bridge's own plank texture (one board of it each, from the dump file);
the logs and stumps are plain colour (lane rules: textures only where they show) on the shared wood preset P_Wood
(lib/game/modelMaterials.ts MATERIAL_PRESETS), darker toward the water.
"""
import math, os, sys
import numpy as np
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import dumpkit as D  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
HALF_X = 1.9
DECK_TOP = 0.075
PLANKS, PLANK_T, PLANK_HALF_Z = 8, 0.08, 1.2
RAIL_Z, RAIL_R = 1.27, 0.1
STUMP_X, STUMP_R, STUMP_TOP, FOOT = 1.72, 0.16, 0.4, -1.5
STRINGER_Z, LOG_R = 0.72, 0.085
# The old texture's plank boards: their seams across the 512 px image, the planks' band of rows.
SEAMS = (64, 103, 142, 179, 218, 256, 294, 334, 370, 409, 448)
PLANK_ROWS = (224, 512)
BARK, CUT, RING = "#8c6849", "#dcbd90", "#c29a6d"
rng = np.random.default_rng(1017)


def plank_image():
    """The old bridge's plank boards (the bottom band of its texture), at 256 square."""
    obs = D.load("props/bridge-wooden.glb")
    src = D.pixels(next(iter(D.images_of(obs).values())))[..., :3]
    band = src[PLANK_ROWS[0]:PLANK_ROWS[1]]
    h, w = band.shape[:2]
    ys = (np.arange(256) + 0.5) * h / 256
    xs = (np.arange(256) + 0.5) * w / 256
    y0, x0 = np.clip(ys.astype(int), 0, h - 1), np.clip(xs.astype(int), 0, w - 1)
    out = band[np.ix_(y0, x0)]
    K.reset()
    return out


def build():
    planks = plank_image()
    M = {
        "plank": K.Mat("M_BridgePlank", tex=K.image("bridge_planks", planks), rough=0.9),
        "wood": K.Mat("P_Wood", "#ffffff", rough=0.9),
    }
    k = K.Kit("bridge-plank")
    # Planks: eight wide boards across the span, each one board of the old texture, a hair off true.
    pitch = (2 * HALF_X - 0.1) / PLANKS
    strips = [((a + b) / 2 / 512, (b - a) / 512) for a, b in zip(SEAMS, SEAMS[1:])]
    for i in range(PLANKS):
        x = -HALF_X + 0.05 + pitch * (i + 0.5)
        w = pitch - 0.024
        hz = PLANK_HALF_Z + rng.uniform(-0.03, 0.03)
        dz = rng.uniform(-0.025, 0.025)
        cu, sw = strips[(i * 3) % len(strips)]
        uv_len = w / (sw * 0.94)
        k.rbox((x, DECK_TOP - PLANK_T / 2 + rng.uniform(-0.005, 0.004), dz), (w, PLANK_T, 2 * hz), 0.03, M["plank"], "#ffffff",
               rot=K.game_rot(yaw=rng.uniform(-0.008, 0.008)), segs=2, uv_len=uv_len, v_axis=2, uv_off=(cu, rng.uniform(0.3, 0.7)))
    # Two stringers along the span and two cross logs under the ends of the deck.
    y = DECK_TOP - PLANK_T - LOG_R + 0.01
    for z in (-STRINGER_Z, STRINGER_Z):
        k.tube([(-HALF_X + 0.06, y, z), (HALF_X - 0.06, y, z)], LOG_R, M["wood"], BARK, n=10, caps=True)
    for x in (-STUMP_X + 0.1, STUMP_X - 0.1):
        k.tube([(x, y - LOG_R * 1.4, -RAIL_Z), (x, y - LOG_R * 1.4, RAIL_Z)], LOG_R * 0.9, M["wood"], BARK, n=10, caps=True)
    # The rails: a chunky log along each side, low, between the stumps.
    for z in (-RAIL_Z, RAIL_Z):
        pts = [(x, DECK_TOP + RAIL_R * 0.7 + 0.008 * math.sin(x * 2.1 + z), z) for x in np.linspace(-STUMP_X + 0.05, STUMP_X - 0.05, 5)]
        k.tube(pts, RAIL_R, M["wood"], BARK, n=10, caps=True)
    # The corner stumps: big and round, down into the water, their tops rounded over onto a pale cut.
    for x in (-STUMP_X, STUMP_X):
        for z in (-RAIL_Z, RAIL_Z):
            r = STUMP_R * rng.uniform(0.97, 1.03)
            top = STUMP_TOP + rng.uniform(-0.02, 0.02)
            prof = [(0.0, FOOT), (r * 0.94, FOOT), (r, FOOT + 0.3), (r * 1.03, 0.0), (r, top - 0.06), (r * 0.93, top - 0.012),
                    (r * 0.78, top), (r * 0.6, top + 0.002), (r * 0.52, top + 0.002), (0.0, top + 0.004)]
            k.lathe((x, 0, z), prof, M["wood"], BARK, n=12, phase=rng.random(), u_tiles=0.5)
    # Cut ends read pale: the stumps' tops (a darker ring between heart and bark) and the logs' end caps.
    k.bm.normal_update()
    for f in k.bm.faces:
        if k.mats[f.material_index] is not M["wood"]:
            continue
        for lp in f.loops:
            co = lp.vert.co
            g = (co.x, co.z, -co.y)
            nearest = min(((sx, sz) for sx in (-STUMP_X, STUMP_X) for sz in (-RAIL_Z, RAIL_Z)), key=lambda s: (g[0] - s[0]) ** 2 + (g[2] - s[1]) ** 2)
            d = math.hypot(g[0] - nearest[0], g[2] - nearest[1])
            if g[1] > STUMP_TOP - 0.025 and d < STUMP_R * 0.85:
                lp[k.col] = (*K.lin(RING if 0.45 * STUMP_R < d < 0.7 * STUMP_R else CUT), 1.0)
        n = f.normal
        if len(f.verts) == 3 and abs(n.x) > 0.9 and f.calc_center_median().z < DECK_TOP + 0.25:
            for lp in f.loops:                                  # a log's cut end (tube caps face along x or z)
                lp[k.col] = (*K.lin(CUT), 1.0)
        elif len(f.verts) == 3 and abs(n.y) > 0.9 and f.calc_center_median().z < DECK_TOP:
            for lp in f.loops:
                lp[k.col] = (*K.lin(CUT), 1.0)
    k.tint_gradient(0.68, 1.0, FOOT, STUMP_TOP)
    ob = k.finish(smooth_deg=60)
    path = K.export([ob], "game/props/bridge-plank.glb")
    print("BRIDGE", {"deck_top": DECK_TOP, "rail_z": RAIL_Z, "span": 2 * HALF_X})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "bridge.png"), views=((20, 16), (55, 32), (0, 70)))
