"""The beach campfire (specs/v1-drop.md §3; components/game/campfire/Campfire.tsx), our own, stone ringed (David,
2026-10-14: "do stone ringed"). Replaces the ACNH bonfire stack (acnh/props/campfire.glb).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_campfire.py [-- review <dir>]

Writes web/public/assets/game/props/campfire.glb (the budget's "effect" folder). Frame: game units, the origin on the
ground at the fire's centre, drawn at scale 1. The 8-seat sit ring is 2.1 out and the dance ring 2.9 (lib/game/campfire.ts),
so the fire stands about 1.4 across: a ring of rounded river stones, a few smaller ones set on top in the gaps, a bed of
ash and embers inside, a teepee of bark logs over a cross of two, a handful of kindling sticks, the logs charred toward
the heat. The flames, embers and glow are the engine's (particles and one light); the ember bed's M_Embers carries an
emissive map the engine eases with the fire (dark by day).

Three materials, each a small painted texture times COLOR_0: M_Stone, M_Log (bark, end grain), M_Embers (ash, and the
glow). Seeded: a rebuild writes the same model.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import propkit as K  # noqa: E402
from propkit import TAU, arr, smooth, fbm, noise  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RING_R = 0.6           # stone centres
APEX = (0.0, 0.64, 0.0)
rng = np.random.default_rng(1014)

STONES = ["#b7a891", "#c6b08c", "#a39886", "#cdb894", "#ad9f88", "#bba27e", "#9b9080", "#c4b59a"]


def log_atlas():
    """256 square: the left half bark (grain down v), the top-right quarter a cut end (rings), the bottom-right split wood."""
    out = np.zeros((256, 256, 3))
    out[:, :128] = K.bark(256, 128, 21, "#ffffff")
    out[:128, 128:] = K.end_grain(128, 128, 22, "#ffffff", rings=6)
    out[128:, 128:] = K.grain(128, 128, 23, "#ffffff", knots=1)
    return out


def ash():
    """The ember bed: grey ash, darker charcoal chunks; and its glow, ember cracks and specks bright where the char is."""
    H = W = 128
    U, V = K.grid(H, W)
    base = 0.62 + 0.2 * (fbm(H, W, 6, 31) - 0.5) * 2
    chunks = smooth(0.58, 0.7, fbm(H, W, 10, 32, 2))
    rgb = base[..., None] * arr("#9a9088") * (1 - 0.6 * chunks[..., None])
    cracks = smooth(0.06, 0.0, np.abs(fbm(H, W, 7, 33, 3) - 0.5)) * chunks
    specks = smooth(0.8, 0.9, noise(H, W, 40, 34)) * chunks
    glow = np.clip(cracks + specks * 0.8, 0, 1)
    d = np.hypot(U - 0.5, V - 0.5) * 2                      # brighter toward the middle
    glow *= smooth(1.0, 0.35, d)
    emit = glow[..., None] * arr("#ff8a2e") + (glow ** 2)[..., None] * arr("#ffd27a") * 0.6
    rgb = rgb * (1 - 0.6 * glow[..., None]) + arr("#a8461c") * 0.6 * glow[..., None]
    return np.clip(rgb, 0, 1), np.clip(emit, 0, 1)


def log(k, M, p0, p1, r, char_from=0.55, tone="#8a6446", n=9, seed=0):
    """A bark log from p0 to p1: round, a touch out of true, its ends rounded over onto cut faces (end grain), darkened
    toward p1 (the heat) from `char_from` of its length."""
    a, b = Vector(p0), Vector(p1)
    L = (b - a).length
    d = (b - a).normalized()
    lr = np.random.default_rng(seed)
    wob = [1 + lr.uniform(-0.07, 0.07) for _ in range(n)]
    lip = r * 0.18
    prof = [(r - lip, 0.0), (r, lip), (r * lr.uniform(0.95, 1.05), L * 0.5), (r, L - lip), (r - lip, L)]
    up = (1, 0, 0) if abs(d.y) > 0.9 else (0, 1, 0)
    ph = lr.random() * TAU
    faces = k.lathe(tuple(a), prof, M["log"], tone, d=tuple(d), n=n, phase=ph, u_tiles=0.5, v_len=0.5,
                    wobble=lambda kk, i: wob[kk], up=up)
    # The cut ends: a flat cap of end grain (the atlas' top-right quarter), its rim on the profile's first and last ring.
    F = K.frame_along(d, up)
    side, nrm = F.col[0], F.col[1]
    for t, rr in ((0.0, r - lip), (L, r - lip)):
        c = a + d * t
        ring = [tuple(c + (side * math.cos(TAU * j / n + ph) + nrm * math.sin(TAU * j / n + ph)) * rr * wob[j]) for j in range(n)]
        uv = [(0.75 + 0.23 * math.cos(TAU * j / n), 0.75 + 0.23 * math.sin(TAU * j / n)) for j in range(n)]
        vs = [k.vert(q) for q in ring]
        cen = k.vert(tuple(c))
        for j in range(n):
            j2 = (j + 1) % n
            k.face([cen, vs[j], vs[j2]], [(0.75, 0.75), uv[j], uv[j2]], M["log"], "#d9c2a0")
    # Char: COLOR_0 darkens from char_from of the way along to the hot end.
    return faces


def char_logs(k, logs):
    """Darken each log's loops by how far along toward its hot end they sit (logs: [(p0, p1, char_from)])."""
    for f in k.bm.faces:
        if k.mats[f.material_index].name != "M_Log":
            continue
        for lp in f.loops:
            co = lp.vert.co
            g = Vector((co.x, co.z, -co.y))
            best = None
            for p0, p1, cf in logs:
                a, b = Vector(p0), Vector(p1)
                ab = b - a
                t = max(0.0, min(1.0, (g - a).dot(ab) / ab.length_squared))
                dist = (a + ab * t - g).length
                if best is None or dist < best[0]:
                    best = (dist, t, cf)
            _, t, cf = best
            s = 1.0 - 0.38 * math.exp(-((t - cf) / 0.2) ** 2)
            c = lp[k.col]
            lp[k.col] = (c[0] * s, c[1] * s * 0.96, c[2] * s * 0.92, 1.0)


def build():
    K.reset()
    atlas = K.image("campfire_log", log_atlas())
    stone_tex = K.image("campfire_stone", K.stone(256, 256, 41))
    ash_rgb, ash_emit = ash()
    M = {
        "stone": K.Mat("M_Stone", tex=stone_tex, rough=0.95),
        "log": K.Mat("M_Log", tex=atlas, rough=0.95),
        "embers": K.Mat("M_Embers", tex=K.image("campfire_ash", ash_rgb), emit=K.image("campfire_glow", ash_emit), rough=1.0),
    }
    k = K.Kit("campfire")
    # The ring: eleven rounded stones round the bed, each its own size, sat flat on the sand and leaned a little in.
    n = 11
    for i in range(n):
        a = TAU * i / n + rng.uniform(-0.08, 0.08)
        rr = RING_R + rng.uniform(-0.025, 0.03)
        rx, ry, rz = rng.uniform(0.15, 0.185), rng.uniform(0.11, 0.14), rng.uniform(0.12, 0.15)
        c = (math.sin(a) * rr, ry * 0.62, math.cos(a) * rr)
        rot = K.game_rot(yaw=a + rng.uniform(-0.25, 0.25) + math.pi / 2, pitch=0, roll=rng.uniform(-0.12, 0.12))
        k.blob(c, (rx, ry, rz), M["stone"], STONES[i % len(STONES)], segs=11, rings=6, rot=rot, seed=500 + i, lumpy=0.1,
               flat_bottom=-ry * 0.62, uv_tiles=(1.5, 1))
    # Smaller stones set on top in a few of the gaps: a built ring, not a row.
    for i in (1, 5, 8):
        a = TAU * (i + 0.5) / n
        rr = RING_R + 0.01
        rx, ry, rz = rng.uniform(0.085, 0.1), rng.uniform(0.06, 0.075), rng.uniform(0.075, 0.09)
        c = (math.sin(a) * rr, 0.18 + ry * 0.4, math.cos(a) * rr)
        k.blob(c, (rx, ry, rz), M["stone"], STONES[(i + 3) % len(STONES)], segs=9, rings=5, rot=K.game_rot(yaw=a + math.pi / 2, roll=rng.uniform(-0.3, 0.3)),
               seed=600 + i, lumpy=0.1, uv_tiles=(1.2, 1))
    # The bed: a low mound of ash inside the ring, the embers glowing in it.
    prof = [(0.54, 0.004), (0.47, 0.035), (0.32, 0.058), (0.15, 0.07), (0.0, 0.072)]
    k.lathe((0, 0, 0), prof, M["embers"], "#ffffff", n=16, u_tiles=1, v_len=1)
    for f in k.bm.faces:
        if k.mats[f.material_index] is M["embers"]:
            for lp in f.loops:
                co = lp.vert.co
                lp[k.uv].uv = (0.5 + co.x / 0.95, 0.5 + co.y / 0.95)      # planar from above
    # A cross of two logs on the bed, the teepee over it: thick bark logs leaning in, their cut tops crossing just past
    # the apex (the bright end grain reads from across the beach, as the old stack's did).
    logs = []
    for a, r, ln in ((0.35, 0.075, 0.98), (0.35 + math.pi / 2 + 0.12, 0.07, 0.92)):
        d = Vector((math.sin(a), 0, math.cos(a)))
        lift = 0.075 if not logs else 0.11
        p0, p1 = tuple(-d * ln / 2 + Vector((0, lift, 0))), tuple(d * ln / 2 + Vector((0, lift + 0.015, 0)))
        log(k, M, p0, p1, r, tone="#ad9370", seed=700 + len(logs))
        logs.append((p0, p1, 0.5))
    tones = ["#b39b78", "#a88f6c", "#bba27c", "#ad9571", "#c0a882", "#a68d6b", "#b69e7a"]
    for i in range(7):
        a = TAU * i / 7 + 0.2 + rng.uniform(-0.1, 0.1)
        foot = Vector((math.sin(a) * 0.38, 0.05, math.cos(a) * 0.38))
        top = Vector(APEX) + Vector((-math.sin(a) * 0.045, rng.uniform(-0.05, 0.03), -math.cos(a) * 0.045))
        top = foot + (top - foot) * rng.uniform(1.26, 1.36)      # on past the crossing
        r = rng.uniform(0.066, 0.078)
        log(k, M, tuple(foot), tuple(top), r, tone=tones[i], seed=720 + i)
        logs.append((tuple(foot), tuple(top), 0.42))
    # Kindling: thin sticks leaning in under the teepee.
    for i in range(5):
        a = TAU * i / 5 + 0.5
        foot = (math.sin(a) * 0.22, 0.06, math.cos(a) * 0.22)
        top = (math.sin(a + 0.4) * 0.03, 0.42 + rng.uniform(-0.04, 0.05), math.cos(a + 0.4) * 0.03)
        k.tube([foot, top], 0.011, M["log"], "#6b4c34", n=5, v_len=0.5, caps=True, u_tiles=0.5)
        logs.append((foot, top, 0.3))
    char_logs(k, logs)
    k.tint_gradient(0.82, 1.0, 0.0, 0.8)
    ob = k.finish(smooth_deg=55)
    path = K.export([ob], "game/props/campfire.glb")
    print("CAMPFIRE", {"ring": RING_R, "apex": APEX})
    return [ob], path


if __name__ == "__main__":
    obs, path = build()
    if "review" in ARGS:
        K.review(obs, os.path.join(ARGS[ARGS.index("review") + 1], "campfire.png"))
