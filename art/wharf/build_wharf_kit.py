"""The new world's wharf kit (terrain v3, game/terrain-art; David, 2026-10-26: "bigger wood boards, develop proper flooring
for wharf, have wood pillars to make it structurally make sense that connecs down to the water, have ladders, small wood
pillar with rope fencing for some spots").

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_wharf_kit.py [-- review <dir>]

Writes, under web/public/assets/game/wharf/, each in game units at scale 1:
  deck-tile.glb    one `deck` square: 4 x 4, eight wide boards along local z (+z inland), each lane split once at its own
                   place so the joints stagger, on three joists across; the boards' top at y 0.01 (the origin on the
                   ground at the square's centre, as lib/game/wharf.ts deckBoards lays them).
  deck-steps.glb   the "steps" square: 4 wide, climbing 1 over its 4 along +z in four treads of 0.25 (tops 0.25 to 1.0),
                   risers in front, stepped cheeks at the sides. The origin on the ground at the foot's level, centred.
  wharf-piling.glb a round timber pile: its cap 0.35 over the deck's top (y 0), down to y -3.4; dark and weedy from the
                   waterline (y -1.08: the sea a deck's 1 under the boards) down. Stand it just outside the deck's edge.
  wharf-ladder.glb a ladder off the deck's edge: the edge at z 0, the water toward -z; two rails with hooped grab
                   handles that land on the deck at z +0.36, rungs down to y -1.9, wet below the waterline.
  rope-post.glb    a short round post (0.87 tall) with a rope collar at the rope's height, 0.66.
  rope-span.glb    a sagging rope between two posts' centres: x -1 to +1 at y 0.66 (scale x for other spans).

Wood in the deck's own weathered warm brown (components/game/wharf/WoodBoxes.tsx's tones) on a painted grain; rope is
art/props/propkit's three-strand rope. One material per model but the post's (wood and rope). Seeded: a rebuild writes
the same models. Prints each model's triangles and bounds.
"""
import math, os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "props"))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/wharf/"
SIZE, BOARDS, GAP, THICK = 4.0, 8, 0.035, 0.1      # a square, its boards across it, the gap between, their thickness
TOP = 0.01                                         # the boards' top over the ground (deckBoards': feet stand on them)
WATER = -1.078                                     # the sea under a deck at 1 (generate.ts H.deck; SEA_LEVEL -0.078)
DARK, LIGHT = "#6e5137", "#a98762"                 # WoodBoxes' weathered deck
ROPE_Y, ROPE_R = 0.66, 0.024
rng = np.random.default_rng(1026)


def mix(a, b, t):
    ca, cb = np.array(K.hexrgb(a)), np.array(K.hexrgb(b))
    return "#" + "".join(f"{int(round(v * 255)):02x}" for v in np.clip(ca + (cb - ca) * t, 0, 1))


def board_tone():
    return mix(DARK, LIGHT, rng.uniform(0.25, 0.95))


def wet(k, below=WATER, band=0.18):
    """Darken and green every loop under the waterline (soaked wood, a weed line just under it)."""
    for f in k.bm.faces:
        for lp in f.loops:
            y = lp.vert.co.z                                  # Blender z is game y
            t = K.smooth(below + 0.04, below - 0.04, y)
            if t <= 0:
                continue
            weed = K.smooth(below - band - 0.1, below - band * 0.4, y) * t
            c = lp[k.col]
            s = 1 - 0.45 * t
            lp[k.col] = (c[0] * s * (1 - 0.35 * weed), c[1] * s * (1 + 0.15 * weed), c[2] * s * (1 - 0.45 * weed), 1.0)


def wood_mat(name, seed):
    return K.Mat(name, tex=K.image(name.lower(), K.grain(256, 128, seed, "#ffffff", lines=(6, 17, 41), contrast=0.17, knots=1)), rough=0.92)


def deck_tile(M):
    k = K.Kit("deck-tile")
    half, pitch = SIZE / 2, SIZE / BOARDS
    for b in range(BOARDS):
        x = -half + (b + 0.5) * pitch
        cut = -half + SIZE * (0.25 + 0.5 * rng.random())
        for z0, z1 in ((-half, cut), (cut, half)):
            dy = rng.uniform(-0.004, 0.0)
            k.rbox((x, TOP - THICK / 2 + dy, (z0 + z1) / 2), (pitch - GAP, THICK, z1 - z0 - GAP), 0.02, M, board_tone(),
                   segs=1, uv_len=2.0, v_axis=2, uv_off=(rng.random(), rng.random()))
    # Joists across under the boards: one at each end (the water edge's beam) and one in the middle.
    for z in (-1.78, 0.0, 1.78):
        k.rbox((0, TOP - THICK - 0.1, z), (SIZE - 0.02, 0.2, 0.17), 0.02, M, mix(DARK, "#4a3624", 0.5), segs=1, uv_len=2.0, v_axis=0)
    k.tint_gradient(0.8, 1.0, TOP - THICK - 0.2, TOP)
    return k.finish(smooth_deg=40)


def deck_steps(M):
    k = K.Kit("deck-steps")
    half, run, rise, cheek = SIZE / 2, 1.0, 0.25, 0.09
    for i in range(4):
        top, z0 = (i + 1) * rise, -half + i * run
        # Two boards make the tread, the front one a hair proud of the riser.
        for j, zc in enumerate((z0 + 0.24, z0 + 0.74)):
            k.rbox((0, top - 0.04, zc - 0.02 * (j == 0)), (SIZE - 2 * cheek - 0.01, 0.08, 0.47), 0.018, M, board_tone(), segs=1,
                   uv_len=2.0, v_axis=0, uv_off=(rng.random(), rng.random()))
        lo = i * rise - (0.12 if i == 0 else 0.0)
        k.rbox((0, (lo + top - 0.08) / 2, z0 + 0.03), (SIZE - 2 * cheek - 0.01, top - 0.08 - lo, 0.05), 0.012, M, mix(board_tone(), DARK, 0.4),
               segs=1, uv_len=2.0, v_axis=0)
        for sx in (-1, 1):
            k.rbox((sx * (half - cheek / 2), (top - 0.12) / 2 - 0.03, z0 + run / 2), (cheek, top + 0.06, run - 0.01), 0.02, M,
                   mix(DARK, "#4a3624", 0.3), segs=1, uv_len=2.0, v_axis=2)
    k.tint_gradient(0.8, 1.0, -0.1, 1.0)
    return k.finish(smooth_deg=40)


def piling(M):
    k = K.Kit("wharf-piling")
    r = 0.15
    prof = [(0.0, -3.4), (r * 0.9, -3.4), (r * 0.97, -3.0), (r, -2.0), (r, WATER - 0.3), (r * 1.01, WATER - 0.1), (r * 1.01, WATER),
            (r * 1.0, WATER + 0.1), (r * 0.99, -0.4), (r * 0.98, 0.25), (r * 0.94, 0.31), (r * 0.72, 0.345), (0.0, 0.352)]
    wob = {kk: 1 + 0.04 * math.sin(kk * 2.1 + 0.7) for kk in range(10)}
    k.lathe((0, 0, 0), prof, M, mix(DARK, LIGHT, 0.45), n=10, u_tiles=1, v_len=1.6, wobble=lambda kk, i: wob[kk])
    k.tint_gradient(0.85, 1.0, -0.6, 0.35)
    wet(k)
    return k.finish(smooth_deg=50)


def ladder(M):
    k = K.Kit("wharf-ladder")
    col, z = mix(DARK, LIGHT, 0.55), -0.12
    for x in (-0.25, 0.25):
        pts = [(x, -2.0, z), (x, WATER - 0.1, z), (x, WATER + 0.1, z), (x, 0.05, z), (x, 0.32, z - 0.02), (x, 0.5, z + 0.06),
               (x, 0.55, z + 0.22), (x, 0.47, z + 0.38), (x, 0.3, z + 0.47), (x, 0.0, z + 0.48)]
        k.tube(pts, 0.04, M, col, n=8, v_len=0.8, caps=True)
        # A cleat block ties the rail to the deck's edge.
        k.rbox((x, -0.16, z / 2), (0.1, 0.12, abs(z)), 0.015, M, mix(col, DARK, 0.4), segs=1)
    for y in np.arange(-0.3, -1.95, -0.3):
        k.tube([(-0.25, y, z), (0.25, y, z)], 0.03, M, mix(col, LIGHT, rng.uniform(0, 0.4)), n=6, v_len=0.8)
    k.tint_gradient(0.85, 1.0, -0.6, 0.55)
    wet(k)
    return k.finish(smooth_deg=50)


def rope_post(Mw, Mr):
    k = K.Kit("rope-post")
    r, h = 0.085, 0.85
    prof = [(r * 1.12, -0.03), (r * 1.08, 0.04), (r, 0.16), (r, ROPE_Y - 0.06), (r * 0.9, ROPE_Y - 0.03), (r * 0.9, ROPE_Y + 0.03),
            (r, ROPE_Y + 0.06), (r * 0.99, h - 0.03), (r * 0.9, h), (r * 0.55, h + 0.018), (0.0, h + 0.022)]
    k.lathe((0, 0, 0), prof, Mw, mix(DARK, LIGHT, 0.6), n=10, u_tiles=1, v_len=0.9)
    ring = [(math.cos(a) * r * 0.98, ROPE_Y + 0.006 * math.sin(3 * a), math.sin(a) * r * 0.98) for a in np.linspace(0, math.tau, 10, endpoint=False)]
    k.tube(ring, ROPE_R, Mr, "#c7a268", n=6, v_len=0.12, closed_path=True)
    k.tint_gradient(0.82, 1.0, 0.0, h)
    return k.finish(smooth_deg=50)


def rope_span(Mr):
    k = K.Kit("rope-span")
    xs = np.linspace(-1.0, 1.0, 11)
    pts = [(x, ROPE_Y - 0.13 * (1 - x * x), 0.0) for x in xs]
    k.tube(pts, ROPE_R, Mr, "#c7a268", n=6, v_len=0.12)
    return k.finish(smooth_deg=60)


def report(ob):
    from mathutils import Vector
    pts = [ob.matrix_world @ Vector(b) for b in ob.bound_box]
    lo = [min(p.x for p in pts), min(p.z for p in pts), min(-p.y for p in pts)]
    hi = [max(p.x for p in pts), max(p.z for p in pts), max(-p.y for p in pts)]
    print("BOUNDS", ob.name, [round(v, 3) for v in lo], [round(v, 3) for v in hi])


def build():
    K.reset()
    deck = wood_mat("M_DeckWood", 2611)
    pile = wood_mat("M_PileWood", 2612)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    obs = {}
    for name, ob in (("deck-tile", deck_tile(deck)), ("deck-steps", deck_steps(deck)), ("wharf-piling", piling(pile)),
                     ("wharf-ladder", ladder(pile)), ("rope-post", rope_post(pile, rope)), ("rope-span", rope_span(rope))):
        K.export([ob], f"{OUT}{name}.glb")
        report(ob)
        obs[name] = ob
    return obs


def scene(obs, out):
    """A stretch of the wharf for the review: two squares at the water's edge, the steps behind, piles along the edge, a
    ladder, rope fencing, the sea."""
    import bpy
    from mathutils import Euler

    def put(name, x, y, z, yaw=0.0, sx=1.0):
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G(x, y, z)
        o.rotation_euler = Euler((0, 0, yaw))
        o.scale = (sx, 1, 1)
        return o

    shown = [put("deck-tile", -2, 0, 0), put("deck-tile", 2, 0, 0), put("deck-tile", -2, 0, 4), put("deck-steps", 2, 0, 4)]
    shown += [put("wharf-piling", x, 0, -2.2) for x in (-3.6, -1.2, 1.2, 3.6)]
    shown += [put("wharf-ladder", 0, 0, -2.0)]
    shown += [put("rope-post", x, 0, -1.8) for x in (1.0, 3.0)] + [put("rope-span", 2.0, 0, -1.8)]
    me = bpy.data.meshes.new("sea")
    me.from_pydata([K.G(-6, WATER, -7), K.G(6, WATER, -7), K.G(6, WATER, -2.0), K.G(-6, WATER, -2.0)], [], [(0, 1, 2, 3)])
    sea = bpy.data.objects.new("sea", me)
    bpy.context.scene.collection.objects.link(sea)
    me.materials.append(K.Mat("M_Sea", "#5fa7b8", rough=0.3).m)
    for o in obs.values():
        o.hide_render = True
    bpy.context.view_layer.update()
    K.review(shown, out, views=((25, 22), (330, 12), (200, 38)), size=560)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "wharf-kit.png"))
