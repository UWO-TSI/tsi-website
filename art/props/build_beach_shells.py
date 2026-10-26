"""More shells for the new world's sand (game/wharf-art4; David's R2d note on the campfire, 2026-10-26: "more crabs shells
and little critters moving around in the sand occasionally"). Scenery, not forage: the four forage shells
(art/nature/build_shells.py: asari, scallop, turban, whelk) stay the collectible ones; these are kinds they don't cover,
to strew round them. The crabs already exist and scuttle (lib/game/ambientFauna.ts crabsFor, the dump's gazami and
hermit). Small things: plain colour in COLOR_0 on the one shared P_Paint (a shell's soft gloss), so they merge.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_beach_shells.py [-- review <dir>]

Writes, under web/public/assets/game/props/, each in game units at scale 1, lying on the sand (y 0), the forage
shells' size:
  starfish.glb    a plump orange sea star 0.34 across, five arms curling a little off the sand, pale knobs along them.
  sand-dollar.glb a flat pale disc 0.22 across, its five-petal flower raised on top.
  conch.glb       a conch 0.34 long along z (its spire to -z) lying on its side: knobbed whorls, cream and orange bands,
                  a flared pink lip on +x.
"""
import math, os, sys
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/props/"
rng = np.random.default_rng(2741)


def starfish(Mp):
    """A polar grid over a five-pointed outline, domed by distance from the rim, the arm tips lifted."""
    k = K.Kit("starfish")
    RA, RC, H, NT, NR = 0.17, 0.055, 0.045, 40, 4
    rim = lambda t: RC + (RA - RC) * abs(math.cos(2.5 * t)) ** 2.2
    col = lambda t, r: mix("#e9783a", "#f2a24c", 0.5 + 0.5 * math.sin(7 * t + 3 * r))
    pts = {}
    for i in range(NT):
        t = math.tau * i / NT
        R = rim(t)
        arm = (R - RC) / (RA - RC)
        for j in range(NR + 1):
            rho = j / NR
            r = R * rho
            y = H * (0.55 + 0.45 * (1 - arm * rho)) * (1 - rho ** 3) ** 0.5 + 0.03 * (arm * rho) ** 3
            pts[i, j] = (r * math.cos(t), y + 0.003, r * math.sin(t))
    top = k.vert((0, H + 0.004, 0))
    for i in range(NT):
        i1 = (i + 1) % NT
        t = math.tau * i / NT
        k.face([top, k.vert(pts[i1, 1]), k.vert(pts[i, 1])], [(0.5, 0.5)] * 3, Mp, col(t, 0))
        for j in range(1, NR):
            q = [pts[i, j], pts[i, j + 1], pts[i1, j + 1], pts[i1, j]]
            k.face([k.vert(p) for p in q], [(0, 0), (1, 0), (1, 1), (0, 1)], Mp, col(t, j / NR))
    # The underside: the rim drawn in to a flat centre a hair over the sand.
    bot = k.vert((0, 0.0, 0))
    for i in range(NT):
        i1 = (i + 1) % NT
        k.face([bot, k.vert(pts[i, NR]), k.vert(pts[i1, NR])], [(0.5, 0.5)] * 3, Mp, "#d9a06a")
    # Pale knobs in a row down each arm.
    for a in range(5):
        t = math.tau * a / 5
        for s in (0.22, 0.45, 0.68):
            r = RA * s
            y = H * (0.55 + 0.45 * (1 - s)) * (1 - s ** 3) ** 0.5 + 0.03 * s ** 3
            k.blob((r * math.cos(t), y + 0.004, r * math.sin(t)), (0.011, 0.008, 0.011), Mp, "#f8dcb0", segs=4, rings=2)
    k.blob((0, H + 0.006, 0), (0.016, 0.008, 0.016), Mp, "#c9542c", segs=6, rings=3)
    return k.finish(smooth_deg=60)


def sand_dollar(Mp):
    k = K.Kit("sand-dollar")
    R = 0.11
    k.lathe((0, 0, 0), [(0.0, 0.0), (R * 0.9, 0.0), (R, 0.007), (R * 0.97, 0.014), (R * 0.75, 0.02), (R * 0.3, 0.024), (0.0, 0.025)], Mp, "#ece0c8", n=24)
    for a in range(5):                                  # the petals, raised a hair, a little paler and rimmed
        t = math.tau * a / 5 + math.pi / 2
        petal = [(0.01 + 0.055 * u, 0.016 * math.sin(math.pi * u)) for u in np.linspace(0, 1, 7)]
        outline = petal + [(x, -y) for x, y in petal[-2:0:-1]]
        k.extrude(outline[::-1], 0.0, 0.004, Mp, "#f8f0e0", bevel=0.0015, rot=K.game_rot(yaw=-t, pitch=-math.pi / 2), at=(0, 0.021, 0), steps=1)
    for a in range(5):                                  # five slots through the disc, painted darker
        t = math.tau * a / 5 + math.pi / 2 + math.pi / 5
        k.blob((math.cos(t) * R * 0.62, 0.012, math.sin(t) * R * 0.62), (0.006, 0.008, 0.006), Mp, "#a89678", segs=5, rings=2)
    return k.finish(smooth_deg=55)


def conch(Mp):
    """A lathe along z (the apex at -z) whose shoulder rings carry knobs, a canal at +z, a flared lip on the +x side."""
    k = K.Kit("conch")
    L = 0.34
    prof = [(0.0, -L / 2), (0.018, -L / 2 + 0.03), (0.03, -L / 2 + 0.05), (0.028, -L / 2 + 0.06), (0.05, -L / 2 + 0.09), (0.047, -L / 2 + 0.1),
            (0.08, -L / 2 + 0.14), (0.095, -L / 2 + 0.17), (0.085, -L / 2 + 0.22), (0.06, -L / 2 + 0.27), (0.03, -L / 2 + 0.31), (0.012, L / 2), (0.0, L / 2)]
    knob = {2, 4, 7}

    def wob(kk, i):
        return 1 + (0.22 if i in knob and kk % 2 == 0 else 0.0)
    cy = 0.095
    k.lathe((0, cy, 0), prof, Mp, "#f3e2c4", d=(0, 0, 1), n=14, wobble=wob)
    # Orange bands round it, painted into the loops' colour.
    for f in k.bm.faces:
        for lp in f.loops:
            z = -lp.vert.co.y                                   # Blender -y is game z
            t = (0.5 + 0.5 * math.sin(z * 75)) ** 2
            c = K.lin(mix("#f6e8cc", "#dc7038", t * 0.85))
            lp[k.col] = (*c, 1.0)
    # The flared lip on +x: a pink wing grown out of the body and up past it, the dark mouth tucked under it.
    k.blob((0.075, cy + 0.03, 0.035), (0.03, 0.1, 0.12), Mp, "#f2a3a8", segs=10, rings=6, rot=K.game_rot(roll=-0.45, yaw=0.15))
    k.blob((0.088, cy + 0.0, 0.04), (0.012, 0.06, 0.08), Mp, "#b8606a", segs=8, rings=4, rot=K.game_rot(roll=-0.45, yaw=0.15))
    k.tint_gradient(0.85, 1.0)
    return k.finish(smooth_deg=50)


def build():
    K.reset()
    paint = K.Mat("P_Paint", rough=0.45)
    obs = {}
    for name, fn in (("starfish", starfish), ("sand-dollar", sand_dollar), ("conch", conch)):
        ob = fn(paint)
        K.export([ob], f"{OUT}{name}.glb")
        report(ob)
        obs[name] = ob
    return obs


def scene(obs, out):
    import bpy
    shown = []
    for name, (x, z, yaw) in {"starfish": (-0.3, 0.0, 0.3), "sand-dollar": (0.05, 0.15, 0.0), "conch": (0.35, -0.05, 0.6)}.items():
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location, o.rotation_euler = K.G(x, 0, z), (0, 0, yaw)
        shown.append(o)
        obs[name].hide_render = True
    me = bpy.data.meshes.new("sand")
    me.from_pydata([K.G(-1, 0, -1), K.G(1, 0, -1), K.G(1, 0, 1), K.G(-1, 0, 1)], [], [(0, 1, 2, 3)])
    o = bpy.data.objects.new("sand", me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(K.Mat("M_Sand", "#e8cf9a", rough=0.9).m)
    bpy.context.view_layer.update()
    K.review(shown, out, views=((200, 35), (120, 60)), size=800)


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        scene(obs, os.path.join(ARGS[ARGS.index("review") + 1], "beach-shells.png"))
