"""The wooden footbridge (the map's `bridge` objects, DefaultIslandWorld and the world editor; GENESIS's stage deck,
SeasonalEvents): our own plank footbridge with log rails. Replaces acnh/props/bridge-wooden.glb.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_bridge.py [-- review <dir>]

Writes web/public/assets/game/props/bridge-plank.glb (named bridge-* so lib/game/shadows.ts gives it no ground contact).
Frame: the old bridge's, so the walk and the rails keep their numbers: game units at scale 1, spanning x +-1.9, the
deck's top at 0.075 (lib/game/propModels.ts BRIDGE_DECK_TOP), its rails along z +-1.33 inside the solid strips
(defaultIsland BRIDGE_DECK_HALF 1.0 to BRIDGE_RAIL_OUT 1.65), the piles down to -1.5 into the river bed.

Fifteen weathered planks laid across two log stringers, each plank its own length, shade and a hair off square, nailed
over the stringers; eight log piles under cross beams, standing up past the deck as rail posts; a log handrail and a
lower rail each side, lashed to the posts with rope. Three materials: M_BridgeLog (bark, end grain, split wood),
M_BridgePlank (weathered planks with their nails), M_Rope.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
import paintkit as PK  # noqa: E402
from propkit import TAU, arr, smooth, noise, fbm  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
HALF_X = 1.9                 # the span's half length
DECK_TOP = 0.075             # the planks' top (the old deck's)
PLANK_T = 0.055
PLANK_HALF_Z = 1.28          # planks across, out under the rails
STRINGER_Z, STRINGER_R = 0.86, 0.085
RAIL_Z = 1.33                # the rail line (posts' and rails' centres)
POSTS_X = (-1.7, -0.58, 0.58, 1.7)
POST_R = 0.072
RAIL_Y, LOW_Y = 0.74, 0.38
PILE_FOOT = -1.5
NAIL_V = (0.5 - STRINGER_Z / 2.6, 0.5 + STRINGER_Z / 2.6)     # where the stringers fall along a plank's texture
PLANK_UV_LEN = 2.6
rng = np.random.default_rng(1017)


def log_atlas():
    """256 square: the left half bark (down v), the top-right quarter a cut end, the bottom-right split wood."""
    out = np.zeros((256, 256, 3))
    out[:, :128] = K.bark(256, 128, 41, "#ffffff")
    out[:128, 128:] = K.end_grain(128, 128, 42, "#ffffff", rings=6)
    out[128:, 128:] = K.grain(128, 128, 43, "#ffffff", knots=1)
    return out


def planks(h=256, w=256):
    """Weathered planks: grain down v (along a plank), silvered in patches, darker toward the ends, two nail heads over
    each stringer in every plank-wide column of u (each plank's u offset is a whole column, build())."""
    g = K.grain(h, w, 44, "#ffffff", lines=(11, 29, 61), contrast=0.2, knots=3, wander=0.015)[..., 0]
    U, V = K.grid(h, w)
    silver = smooth(0.45, 0.75, fbm(h, w, 4, 45, 3, 6))
    base = g[..., None] * arr("#b58f69")
    out = base * (1 - 0.45 * silver[..., None]) + g[..., None] * arr("#b3ab9c") * 0.45 * silver[..., None]
    out *= (1 - 0.12 * smooth(0.15, 0.0, np.minimum(V, 1 - V)))[..., None]
    for k in range(11):
        for du in (-0.026, 0.026):
            for nv in NAIL_V:
                u0, v0 = 0.045 + 0.09 * k + du, 1 - nv          # image v runs down from the top
                d = np.hypot((U - u0) * w, (V - v0) * h)
                out = out * (1 - smooth(2.6, 1.6, d)[..., None]) + arr("#3e3833") * smooth(2.6, 1.6, d)[..., None]
                out = out * (1 - 0.25 * smooth(5.0, 2.6, d) * (1 - smooth(2.6, 1.6, d)))[..., None]
    return np.clip(out, 0, 1)


def build():
    K.reset()
    M = {
        "log": K.Mat("M_BridgeLog", tex=K.image("bridge_log", log_atlas()), rough=0.95),
        "plank": K.Mat("M_BridgePlank", tex=K.image("bridge_plank", planks()), rough=0.94),
        "rope": K.Mat("M_Rope", tex=K.image("bridge_rope", K.rope(128, 64, 46)), rough=0.95),
    }
    k = K.Kit("bridge-plank")
    BARK, END = "#8f7055", "#dcc6a2"
    # Planks: across the span, each its own length, shade and lie.
    n = 15
    pitch = (2 * HALF_X - 0.12) / n
    tones = ["#d9cbb6", "#cfc0a9", "#e3d6c2", "#d4c4ac", "#ddd0bb"]
    for i in range(n):
        x = -HALF_X + 0.06 + pitch * (i + 0.5)
        dz = rng.uniform(-0.04, 0.04)
        hz = PLANK_HALF_Z + rng.uniform(-0.035, 0.03)
        yaw = rng.uniform(-0.012, 0.012)
        lift = rng.uniform(-0.004, 0.003)
        rot = K.game_rot(yaw=yaw, roll=rng.uniform(-0.008, 0.008))
        col = int(rng.integers(0, 11))
        k.rbox((x, DECK_TOP - PLANK_T / 2 + lift, dz), (pitch - 0.016, PLANK_T, 2 * hz), 0.011, M["plank"], tones[i % 5],
               rot=rot, segs=1, uv_len=PLANK_UV_LEN, v_axis=2, uv_off=(0.045 + 0.09 * col, 0.5 + dz / PLANK_UV_LEN))
    # Stringers: two logs along the span under the planks.
    for z in (-STRINGER_Z, STRINGER_Z):
        y = DECK_TOP - PLANK_T - STRINGER_R + 0.012
        Ls = 2 * HALF_X + 0.04
        k.lathe((-HALF_X - 0.02, y, z), [(0.0, 0.0), (STRINGER_R * 0.8, 0.0), (STRINGER_R, 0.02), (STRINGER_R, Ls - 0.02), (STRINGER_R * 0.8, Ls), (0.0, Ls)],
                M["log"], BARK, d=(1, 0, 0), n=8, u_tiles=0.5, v_len=1.2, phase=rng.random())
    # Piles: log posts from the river bed up past the deck as the rail posts, cut tops rounded; a cross beam under the
    # deck on each pair.
    for x in POSTS_X:
        for z in (-RAIL_Z, RAIL_Z):
            top = RAIL_Y + 0.11 + rng.uniform(-0.02, 0.02)
            r = POST_R * rng.uniform(0.95, 1.06)
            prof = [(0.0, PILE_FOOT), (r * 0.95, PILE_FOOT), (r, PILE_FOOT + 0.3), (r * 1.02, 0.2), (r, top - 0.03), (r * 0.82, top), (0.0, top + 0.004)]
            k.lathe((x, 0, z), prof, M["log"], BARK, n=8, u_tiles=0.5, v_len=1.0, phase=rng.random() * TAU)
        k.rbox((x, DECK_TOP - PLANK_T - 2 * STRINGER_R - 0.03, 0), (0.13, 0.11, 2 * RAIL_Z + 0.08), 0.02, M["plank"], "#b9a78d", segs=1,
               v_axis=2, uv_len=PLANK_UV_LEN, uv_off=(0.045 + 0.09 * 10, 0.2))
    # Rails: a log handrail and a lower rail along each side, a little out of true, past the end posts.
    for z in (-RAIL_Z, RAIL_Z):
        for y, r in ((RAIL_Y, 0.052), (LOW_Y, 0.04)):
            pts = [(x, y + 0.012 * math.sin(x * 1.7 + z) + (0.008 if abs(x) < 0.3 else 0), z + 0.006 * math.sin(x * 2.3)) for x in np.linspace(-HALF_X + 0.02, HALF_X - 0.02, 7)]
            k.tube(pts, r, M["log"], BARK, n=8, v_len=1.2, caps=True, u_tiles=0.5)
    # Rope lashings round each post where the handrail meets it.
    for x in POSTS_X:
        for z in (-RAIL_Z, RAIL_Z):
            for dy in (-0.062,):
                ring = [(x + math.cos(TAU * j / 8) * (POST_R + 0.012), RAIL_Y + dy + 0.008 * math.sin(TAU * j / 8), z + math.sin(TAU * j / 8) * (POST_R + 0.012)) for j in range(8)]
                k.tube(ring, 0.011, M["rope"], "#c7a268", n=4, v_len=0.06, closed_path=True)
    # The cut ends of the logs read in end grain: retexture every cap face of the bark logs facing out along their axis.
    k.bm.normal_update()
    for f in k.bm.faces:
        if k.mats[f.material_index] is not M["log"]:
            continue
        nrm = f.normal
        gx, gy = abs(nrm.x), abs(nrm.z)          # Blender (x, y, z) = game (x, -z, y)
        if len(f.verts) == 3 and (gx > 0.9 or gy > 0.9):
            c = f.calc_center_median()
            for lp in f.loops:
                d = lp.vert.co - c
                a, b = (d.y, d.z) if gx > 0.9 else (d.x, d.y)
                lp[k.uv].uv = (0.75 + a * 2.6, 0.75 + b * 2.6)
                lp[k.col] = (*K.lin(END), 1.0)
    k.tint_gradient(0.8, 1.0, PILE_FOOT, RAIL_Y + 0.12)
    ob = k.finish(smooth_deg=55)
    path = K.export([ob], "game/props/bridge-plank.glb")
    print("BRIDGE", {"deck_top": DECK_TOP, "rail_z": RAIL_Z, "span": 2 * HALF_X})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "bridge.png"), views=((20, 16), (55, 32), (0, 70)))
