"""The beach's crabs, remodelled as ours (game/remodel; David, 2026-10-27): the swimming crab and the hermit crab that
scuttle on the sand and that players catch (components/game/Critters.tsx SPECIES "shore_*", lib/game/ambientFauna.ts
CRAB_MODELS), in place of the dump's (acnh/props/crab-gazami.glb, crab-hermit.glb).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/build_shore.py

Frame (the dump's, drawn at scale 1): game units, the origin on the sand under the body's middle, the claws toward +z.
  game/remodel/props/crab-gazami.glb  a wide soft carapace with a spine each side, big rounded claws, paddle back legs,
                                  eyes on stalks (0.42 across the legs, 0.08 tall).
  game/remodel/props/crab-hermit.glb   a striped spiral shell with the crab peeking out of its mouth toward +z: one big claw,
                                  a small one, walking legs, eyes on stalks (0.27 across, 0.16 tall).
Plain colour on P_Paint (its colour in COLOR_0): no textures.
"""
import math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rkit import K  # noqa: E402

TAU = math.tau


def eye_stalks(k, M, x, y, z, h, r, col, eye="#25242a"):
    for s in (-1, 1):
        top = (s * x, y + h, z + h * 0.15)
        k.tube([(s * x * 0.8, y, z), top], r * 0.45, M["paint"], col, n=5, v_len=1.0)
        k.blob(top, (r, r, r), M["paint"], eye, segs=6, rings=4)


def leg(k, M, root, out, up, r, col):
    """A walking leg: up and out from the body, then down to the sand, thinning to a point."""
    x0, y0, z0 = root
    ox, oz = out
    knee = (x0 + ox * 0.55, y0 + up, z0 + oz * 0.55)
    foot = (x0 + ox, 0.003, z0 + oz)
    k.tube([root, knee, foot], r, M["paint"], col, n=5, v_len=1.0, radii=[1.0, 0.9, 0.35], caps=True)


def claw(k, M, root, d, size, col, tip):
    """An arm out to a rounded pincer: a fat palm and two fingers, the tips in `tip`."""
    x0, y0, z0 = root
    dx, dz = d
    L = math.hypot(dx, dz)
    ux, uz = dx / L, dz / L
    elbow = (x0 + dx * 0.45, y0 + size * 0.5, z0 + dz * 0.45)
    palm = (x0 + dx, y0 + size * 0.45, z0 + dz)
    k.tube([root, elbow, palm], size * 0.28, M["paint"], col, n=6, v_len=1.0, radii=[0.8, 1.0, 1.0])
    R = K.game_rot(yaw=math.atan2(ux, uz))
    k.blob(palm, (size * 0.55, size * 0.5, size * 0.75), M["paint"], col, segs=8, rings=6, rot=R)
    for sy, w in ((1, 0.32), (-1, 0.26)):
        base = (palm[0] + ux * size * 0.55, palm[1] + sy * size * 0.14, palm[2] + uz * size * 0.55)
        end = (palm[0] + ux * size * 1.15 - uz * size * 0.12, palm[1] + sy * size * 0.05, palm[2] + uz * size * 1.15 + ux * size * 0.12)
        k.tube([base, end], size * w, M["paint"], tip, n=6, v_len=1.0, radii=[1.0, 0.25], caps=True)


def swimmer():
    K.reset()
    M = {"paint": K.Mat("P_Paint", rough=0.6)}
    k = K.Kit("crab-swimmer")
    SHELL, RIM, BELLY, CLAW, TIP, LEG = "#6f8f9c", "#9ab9c0", "#efe2c8", "#4f80b4", "#e07a4c", "#5f7f97"
    # The carapace: a wide low dome, sides drawn out to a spine each.
    k.blob((0, 0.04, 0), (0.12, 0.034, 0.085), M["paint"], SHELL, segs=14, rings=7, seed=3, flat_bottom=-0.02)
    k.blob((0, 0.026, -0.003), (0.118, 0.02, 0.083), M["paint"], BELLY, segs=12, rings=4, flat_bottom=-0.01)
    for s in (-1, 1):
        k.tube([(s * 0.1, 0.045, 0.02), (s * 0.165, 0.05, 0.03)], 0.012, M["paint"], RIM, n=5, v_len=1.0, radii=[1.0, 0.2], caps=True)
        for zz, ox, oz in ((0.035, 0.12, 0.06), (0.012, 0.135, 0.01), (-0.012, 0.13, -0.04)):
            leg(k, M, (s * 0.09, 0.03, zz), (s * ox, oz), 0.04, 0.0095, LEG)
        # The back paddle.
        k.tube([(s * 0.08, 0.03, -0.045), (s * 0.13, 0.04, -0.09)], 0.007, M["paint"], LEG, n=5, v_len=1.0)
        k.blob((s * 0.15, 0.04, -0.11), (0.026, 0.006, 0.02), M["paint"], CLAW, segs=6, rings=3, rot=K.game_rot(yaw=s * 0.6))
        claw(k, M, (s * 0.06, 0.03, 0.06), (s * 0.08, 0.06), 0.035, CLAW, TIP)
    eye_stalks(k, M, 0.025, 0.06, 0.075, 0.02, 0.009, SHELL)
    k.tint_gradient(0.85, 1.0, 0.0, 0.08)
    ob = k.finish(smooth_deg=60)
    K.export([ob], "game/remodel/props/crab-gazami.glb")


def hermit():
    K.reset()
    M = {"paint": K.Mat("P_Paint", rough=0.6)}
    k = K.Kit("crab-hermit")
    SHELL, STRIPE, LIP, BODY, CLAW, TIP = "#e8d2a8", "#c48d5e", "#f4e6cc", "#e0683f", "#e36a3e", "#f2c9a6"
    # The shell: a cone of whorls rising back toward -z, a spiral ridge wound round it, the mouth open toward +z.
    axis = (0, 0.55, -1)
    prof = [(0.0, -0.01), (0.07, 0.0), (0.075, 0.03), (0.066, 0.06), (0.05, 0.09), (0.032, 0.12), (0.014, 0.145), (0.0, 0.155)]
    k.lathe((0, 0.075, 0.03), prof, M["paint"], SHELL, d=axis, n=8)
    ax = Vector(axis).normalized()
    side = ax.cross(Vector((1, 0, 0))).normalized()
    up = ax.cross(side)
    helix = []
    for i in range(12):
        t = i / 11
        a = t * TAU * 2.4
        r = 0.074 * (1 - t) + 0.006
        c = Vector((0, 0.075, 0.03)) + ax * (t * 0.14) + (side * math.cos(a) + up * math.sin(a)) * r
        helix.append(tuple(c))
    k.tube(helix, 0.011, M["paint"], STRIPE, n=4, v_len=1.0, radii=[1.0 - 0.6 * i / 11 for i in range(12)])
    k.lathe((0, 0.075, 0.03), [(0.06, 0.0), (0.068, -0.006), (0.058, -0.012)], M["paint"], LIP, d=axis, n=8)
    # The crab in the mouth.
    k.blob((0, 0.045, 0.06), (0.04, 0.03, 0.03), M["paint"], BODY, segs=8, rings=5)
    for s in (-1, 1):
        for zz, ox, oz in ((0.07, 0.075, 0.05), (0.055, 0.09, 0.0)):
            leg(k, M, (s * 0.03, 0.04, zz), (s * ox, oz), 0.03, 0.007, BODY)
    claw(k, M, (0.025, 0.04, 0.08), (0.025, 0.05), 0.032, CLAW, TIP)
    claw(k, M, (-0.025, 0.035, 0.08), (-0.02, 0.04), 0.02, CLAW, TIP)
    eye_stalks(k, M, 0.014, 0.06, 0.085, 0.03, 0.008, BODY)
    k.tint_gradient(0.85, 1.0, 0.0, 0.16)
    ob = k.finish(smooth_deg=60)
    K.export([ob], "game/remodel/props/crab-hermit.glb")


if __name__ == "__main__":
    swimmer()
    hermit()
