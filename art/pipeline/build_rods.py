"""Rods round 2 (David's rod pitch review, 2026-11-02; specs/lanes/tool-pipeline.md): the approved Carrot, Precision and
Training modelled from their concept sheets, Cedar grown into a little cedar tree (round 3), a cooler Glass, and the redesigned Tidewarden,
Tempest, Titanium and Riptide, the rarer the more abstract (David's rule, specs/references/rods/README.md on rod-gear).

  Blender -b --factory-startup -P art/pipeline/build_rods.py -- [only carrot,tempest] [render <dir>] [old <dir> <name>=<glb> ...]

Writes web/public/assets/game/tools/rod-<name>.glb (Cedar, Glass and Tidewarden replace rod-2, rod-3 and rod-5 in
place) and, for a rod with an effect, its moving and glowing parts web/public/assets/game/props/rodfx-<name>.glb, read
by components/game/character/RodAura.tsx. build_tools.py's conventions: rig units (the engine scales by 1.3), the grip
at the origin is the right hand's socket, Blender Z up, the character's front -Y, the reel hanging toward -Y and the
blank bowing toward +Y; matte palette colours with the shared top-light gradient (art/characters/kit.py).

The rod is one plain mesh (heldMesh.ts merges a tool to one draw): at most 600 triangles and 5 materials (the Tool
budget), nothing emissive. Its effect is a second GLB: nodes whose extras say how they move (`spin` rad/s about their
own Z, `bob` metres at `rate`, `pulse`, `flicker`), materials whose names say how they draw (`Glow` unlit, `Light`
unlit and additive, `Aura` a soft additive shell, anything else lit like the rod), `Halo` empties (a glow sprite of
`size` and `color`), and the scene's extras for the sparks. The rod's own scene extras name its effect (`rodFx`).

With `render`, each rod's five views in one row (front, side, back, top, three-quarter) on white and a three-quarter
hero with the effect lit, into <dir>; `old` renders other GLBs the same way (the rods they replace); `scale <m>` frames
every view at one orthographic scale, for an old and new comparison.
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, os.path.join(ROOT, "art", "props-enemies"))
import kit  # noqa: E402
from pe import lathe  # noqa: E402
sys.path.insert(0, HERE)
from fx_library import aura_hug, export, foam, glow, light, model, particles, sheet, spray, trail, water, part as fx_part  # noqa: E402

TOOLS = os.path.join(ROOT, "web", "public", "assets", "game", "tools")
PROPS = os.path.join(ROOT, "web", "public", "assets", "game", "props")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
TAU = math.tau
V = Vector
bpy.ops.wm.read_factory_settings(use_empty=True)


# ================================================================ shapes
def loft(pc, path, radii, sides=6, mat=None, tip=True, cap=True, twist=0.0, phase=0.0, ref=(0, 1, 0)):
    """A tube through `path` (rings of `sides`, radius or (across, deep) per point) turned `twist` radians per ring;
    `mat(segment, side)` names each face's material (a stripe, a band), else the piece's current one."""
    path = [V(p) for p in path]
    n, rings, keep = len(path), [], pc.mat
    for i, (p, r) in enumerate(zip(path, radii)):
        a = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        up = V(ref) if abs(a.dot(V(ref))) < 0.95 else V((1, 0, 0))
        u = (up - a * up.dot(a)).normalized()
        w = a.cross(u)
        rx, ry = r if isinstance(r, (tuple, list)) else (r, r)
        rings.append([pc.v(p + u * math.cos(phase + twist * i + TAU * k / sides) * rx + w * math.sin(phase + twist * i + TAU * k / sides) * ry)
                      for k in range(sides)])
    for i in range(n - 1):
        mid = (path[i] + path[i + 1]) / 2
        for k in range(sides):
            pc.mat = mat(i, k) if mat else keep
            pc.f([rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]], mid)
    pc.mat = mat(0, 0) if mat else keep
    if cap:
        c0 = pc.v(path[0])
        for k in range(sides):
            pc.f([rings[0][(k + 1) % sides], rings[0][k], c0], path[0] - (path[1] - path[0]))
    pc.mat = mat(n - 2, 0) if mat else keep
    r_end = radii[-1] if not isinstance(radii[-1], (tuple, list)) else max(radii[-1])
    if tip:
        end = pc.v(path[-1] + (path[-1] - path[-2]).normalized() * max(r_end, 1e-4) * 1.6)
        for k in range(sides):
            pc.f([rings[-1][k], rings[-1][(k + 1) % sides], end], path[-1])
    elif cap:
        c1 = pc.v(path[-1])
        for k in range(sides):
            pc.f([rings[-1][k], rings[-1][(k + 1) % sides], c1], path[-1] + (path[-1] - path[-2]))
    pc.mat = keep
    return rings


def leaf(pc, base, d, length, width, side=V((0, 1, 0)), curl=0.0, lobes=(0.3, 0.9, 1.0, 0.75, 0.25), thick=0.0025, sides=4):
    """A flat leaf (or frond, or blade) from `base` along `d`, its face toward `side`, bending by `curl` toward it."""
    d, side, base = V(d).normalized(), V(side).normalized(), V(base)
    k = len(lobes)
    pts = [base + d * (length * i / k) + side * (curl * (i / k) ** 2) for i in range(k)]
    across = d.cross(side).normalized()
    return loft(pc, pts, [(width * x, thick) for x in lobes], sides=sides, tip=True, cap=False, ref=across)


def grip(pc, prof, n=7, mat=None):
    """The grip, a lathe up +Z from below the hand (the origin)."""
    lathe(pc, (0, 0, 0), prof, n=n, mat=mat)


def bender(L, bow=0.04, z0=0.06):
    def bend(z):                        # the blank bows a touch toward its tip, away from the reel
        u = max(0.0, (z - z0) / (L - z0))
        return V((0, bow * u * u, z))
    return bend


def reel(pc, z=0.02, r=0.032, y=-0.048, mat="Reel", knob=None, crank=True, n=9, stem=0.006):
    pc.mat = mat
    pc.tube([(0, -0.012, z), (0, y + 0.012, z)], [stem, stem], sides=5, tip=False)
    k = r / 0.032
    lathe(pc, (0, y, z), [(0, -0.014 * k), (r * 0.94, -0.012 * k), (r, 0.0), (r * 0.94, 0.012 * k), (0, 0.014 * k)], n=n, axis=(1, 0, 0))
    if crank:
        pc.tube([(0.016 * k, y, z), (0.03 * k, y, z - 0.014 * k)], [0.004, 0.004], sides=4, tip=False)
        pc.mat = knob or mat
        pc.blob((0.033 * k, y, z - 0.017 * k), 0.008 * k, segs=6, rings=4)
    pc.mat = mat


def line(pc, start, bend, L, mat, ahead=-0.012, zs=(0.2, 0.42, 0.64), tip=None):
    pc.mat = mat
    pts = [V(start)] + [bend(z) + V((0, ahead, 0)) for z in zs if z < L - 0.08] + [V(tip) if tip else bend(L - 0.005) + V((0, -0.006, 0))]
    pc.tube(pts, [0.0022] * len(pts), sides=3, tip=False)


def flange(pc, bend, rad, z0, z1, turns, width, thick, n):
    """A ribbon standing off a blank and wound round it (`width` at its foot and its top), a quad section per station."""
    rings = []
    for i in range(n):
        u = i / (n - 1)
        z, a = z0 + (z1 - z0) * u, TAU * turns * u
        c, d = bend(z), V((math.cos(a), math.sin(a), 0))
        r0, w = rad(z) * 0.8, width[0] + (width[1] - width[0]) * u
        rings.append([pc.v(c + d * r0 + V((0, 0, -thick / 2))), pc.v(c + d * (r0 + w) + V((0, 0, -thick / 2))),
                      pc.v(c + d * (r0 + w) + V((0, 0, thick / 2))), pc.v(c + d * r0 + V((0, 0, thick / 2)))])
    for i in range(n - 1):
        mid = (rings[i][0].co + rings[i][2].co + rings[i + 1][0].co + rings[i + 1][2].co) / 4
        for k in range(4):
            pc.f([rings[i][k], rings[i][(k + 1) % 4], rings[i + 1][(k + 1) % 4], rings[i + 1][k]], mid)
    for r, other in ((rings[0], rings[1]), (rings[-1], rings[-2])):
        c = sum((v.co for v in r), V()) / 4
        pc.f(r, c + (sum((v.co for v in other), V()) / 4 - c))


def helix(c0, c1, r0, r1, turns, n, phase=0.0):
    c0, c1 = V(c0), V(c1)
    return [c0.lerp(c1, i / (n - 1)) + V((math.cos(phase + TAU * turns * i / (n - 1)), math.sin(phase + TAU * turns * i / (n - 1)), 0)) * (r0 + (r1 - r0) * i / (n - 1))
            for i in range(n)]


# ================================================================ models and export
MADE = {}       # name -> (rod object, [fx objects])


def halo(at, size, color):
    """A disc of light (the rods before the effects library: Tidewarden, Titanium). New effects don't use it (fx_library.py)."""
    e = bpy.data.objects.new("Halo", None)
    bpy.context.scene.collection.objects.link(e)
    e.location = at
    e["size"], e["color"] = size, color
    return e


def tris(ob):
    return kit.ntris(ob) if ob.type == "MESH" else 0


# ================================================================ the approved three
def carrot():
    """Uncommon (David: "make the carrot thicket, this is uncommon rod"). Sheet carrot-1: a fat orange carrot for a
    blank with pale growth rings, a tan grip, a fan of carrot leaves at the butt, a leaf-green reel with an orange knob."""
    L = 0.79
    bend = bender(L, bow=0.03)

    def b(pc):
        pc.mat = "Grip"
        grip(pc, [(0, -0.118), (0.017, -0.116), (0.021, -0.095), (0.022, -0.02), (0.021, 0.04), (0.016, 0.058)], n=7)
        zs = [0.045, 0.075, 0.12, 0.2, 0.245, 0.26, 0.34, 0.405, 0.42, 0.5, 0.565, 0.58, 0.66, 0.73, L]
        rs = [0.022, 0.03, 0.0315, 0.0295, 0.0272, 0.0262, 0.0238, 0.0212, 0.0196, 0.0172, 0.0146, 0.0132, 0.0102, 0.0068, 0.0032]
        ring = {4, 7, 10}                      # the growth rings: narrow pale segments
        loft(pc, [bend(z) for z in zs], rs, sides=7, mat=lambda i, k: "Rings" if i in ring else "Carrot", tip=True)
        pc.mat = "Leaf"                        # the tops, fanned down from the butt (the sheet's front view)
        for a, ln in ((-0.95, 0.07), (-0.45, 0.085), (0.05, 0.09), (0.55, 0.08)):
            d = V((math.sin(a), 0.1, -math.cos(a)))
            leaf(pc, (0.006 * math.sin(a), 0, -0.112), d, ln, 0.016, side=V((0, -1, 0)), curl=0.012, lobes=(0.35, 1.0, 0.8, 0.3))
        reel(pc, z=0.035, r=0.03, mat="Leaf", knob="Carrot")
        line(pc, (0, -0.048, 0.05), bend, L, "Line", ahead=-0.04, zs=(0.2, 0.4, 0.6))
    return model("rod-carrot", {"Carrot": "#E9772B", "Rings": "#F4A65C", "Grip": "#D8BF8F", "Leaf": "#6DAA3F", "Line": "#EFE8D6"}, b)


def precision():
    """Common. Sheet precision-1: a plain straight sport rod, slate blue, two thin white bands, a charcoal grip, a
    compact grey reel."""
    L = 0.71
    bend = bender(L, bow=0.004)

    def b(pc):
        grip(pc, [(0, -0.12), (0.015, -0.119), (0.0175, -0.105), (0.019, -0.04), (0.0185, 0.03), (0.0145, 0.062)], n=7,
             mat=lambda band, q: "Band" if band == 0 else "Grip")
        zs = [0.06, 0.08, 0.2, 0.36, 0.372, 0.53, 0.542, L]
        rs = [0.0118, 0.0112, 0.0102, 0.0088, 0.0087, 0.0072, 0.0071, 0.0045]
        loft(pc, [bend(z) for z in zs], rs, sides=6, mat=lambda i, k: "Band" if i in (0, 3, 5) else "Blank", tip=True)
        reel(pc, z=0.03, r=0.026, mat="Reel")
        line(pc, (0, -0.048, 0.042), bend, L, "Band", ahead=-0.022)
    return model("rod-precision", {"Blank": "#4F78A3", "Band": "#EEEBE2", "Grip": "#37393E", "Reel": "#B8BDC3"}, b)


def training():
    """Common (an easter egg to unlock, David). Sheet training-1: a toy practice rod, a sunny yellow blank with blue
    bands ending in a red safety ball, a fat sky-blue grip with finger ridges, an oversized red reel, a cream collar."""
    L = 0.66
    bend = bender(L, bow=0.03, z0=0.13)

    def b(pc):
        pc.mat = "Blue"
        grip(pc, [(0, -0.12), (0.03, -0.117), (0.036, -0.1), (0.031, -0.078), (0.037, -0.056), (0.031, -0.034), (0.037, -0.012),
                  (0.034, 0.03), (0.033, 0.09), (0.026, 0.115)], n=7)
        pc.mat = "Cream"
        lathe(pc, (0, 0, 0.11), [(0.024, 0.0), (0.024, 0.028)], n=7)
        zs = [0.13, 0.16, 0.31, 0.324, 0.45, 0.464, 0.56, L]
        rs = [0.018, 0.0172, 0.015, 0.0149, 0.013, 0.0129, 0.0114, 0.0098]
        loft(pc, [bend(z) for z in zs], rs, sides=6, mat=lambda i, k: "Blue" if i in (2, 4) else "Yellow", tip=False, cap=True)
        pc.mat = "Red"
        pc.blob(bend(L + 0.016), 0.02, segs=7, rings=5)
        reel(pc, z=0.13, r=0.048, y=-0.064, mat="Red")
        line(pc, (0, -0.064, 0.15), bend, L, "Cream", ahead=-0.026, zs=(0.3, 0.5), tip=bend(L + 0.006) + V((0, -0.016, 0)))
    return model("rod-training", {"Yellow": "#F5C537", "Blue": "#4AAEE6", "Red": "#DE4537", "Cream": "#F3EAD3"}, b)


# ================================================================ the reworked two
def whorl(pc, c, R, n, phase, rise=0.35, droop=0.7, seed=0, mats=("Leaf", "Leaf")):
    """One layer of a cedar: `n` flat needle sprays fanned round the blank at `c` (the trunk), meeting at shallow
    notches so the layer reads full, each a pointed spray with a branchlet out on either side, rising off the trunk
    then drooping, each a little higher or lower and longer or shorter than the next; the sprays alternate between
    the two greens of `mats` (new growth lighter). 4 * n triangles."""
    c = V(c)
    k = lambda j: 1.0 + 0.16 * math.sin(5.1 * j + 2.7 * seed)                 # uneven, spray to spray
    lift = lambda j: 0.06 * R * math.sin(3.3 * j + 1.9 * seed)
    step = TAU / n

    def at(j, u, v):                        # u out along spray j (of its reach), v across it (1 = the notch)
        a, r = phase + step * (j + 0.5 * v), R * k(j) * u
        return pc.v(c + V((math.cos(a) * r, math.sin(a) * r, rise * r - droop * r * r / R + lift(j))))
    hub = pc.v(c)
    notch = [at(j - 0.5, 0.38, 0) for j in range(n)]
    below = lambda vs: sum((v.co for v in vs), V()) / len(vs) - V((0, 0, 0.05))
    for j in range(n):
        pc.mat = mats[j % 2]
        tip, left, right = at(j, 1.0, 0), at(j, 0.72, -0.9), at(j, 0.68, 0.9)
        for q in ([hub, notch[j], tip], [hub, tip, notch[(j + 1) % n]], [notch[j], left, tip], [tip, right, notch[(j + 1) % n]]):
            pc.f(q, below(q))


def cedar():
    """Uncommon, rod-2 (David 11-03: "the leave should grow in a natural looking way, make it look like a cedar tree";
    11-05: "more leaves it loosk naked"). The blank is the trunk of a little cedar: twelve close layers of flat needle
    sprays up its top part, a full cone wide and drooping low and small near the tip, each layer turned on from the
    last so the gaps fill, the sprays in two greens (new growth lighter at the top), the blank's tip as the leader."""
    L = 0.76
    bend = bender(L)
    rad = lambda z: 0.0135 - 0.0075 * (z - 0.06) / (L - 0.06)

    def b(pc):
        pc.mat = "Grip"
        grip(pc, [(0, -0.12), (0.016, -0.118), (0.019, -0.09), (0.019, 0.04), (0.015, 0.07)], n=7)
        zs = [0.06 + (L - 0.06) * k / 6 for k in range(7)]
        pc.mat = "Blank"
        loft(pc, [bend(z) for z in zs], [rad(z) for z in zs], sides=6, tip=True)
        pc.mat = "Grip"                          # the band at the grip's top (the foliage covers the rest)
        c, r = bend(0.075), rad(0.075)
        pc.tube([c - V((0, 0, 0.006)), c + V((0, 0, 0.006))], [r * 1.25, r * 1.25], sides=6, tip=False, cap=False)
        reel(pc, z=0.02, mat="Grip")
        n = 12                                   # z, reach and sprays: the cone, from the bottom layer to the top
        layers = [(0.27 + 0.44 * w / (n - 1), 0.118 - 0.096 * w / (n - 1), (8, 8, 8, 7, 7, 7, 6, 6, 5, 5, 4, 3)[w]) for w in range(n)]
        for w, (z, R, m) in enumerate(layers):
            whorl(pc, bend(z), R, m, 0.4 + w * 2.4, droop=0.9 - 0.04 * w, seed=w,
                  mats=("Leaf", "Fresh") if w < n // 2 else ("Fresh", "Leaf"))
        line(pc, (0, -0.048, 0.034), bend, L, "Line")
    return model("rod-2", {"Grip": "#C8A27A", "Blank": "#9A5A3A", "Fresh": "#6A9A48", "Line": "#F2ECDD", "Leaf": "#4A7A38"}, b)


def glass():
    """Rare, rod-3 (David: "glass rod can be cooler or just make it uncomon"). Sea glass: a twisted, faceted teal
    crystal blank, a glass fishing float in a rope net for a reel, a sea-glass crystal at the tip."""
    L = 0.8
    bend = bender(L)

    def b(pc):
        grip(pc, [(0, -0.12), (0.016, -0.118), (0.0185, -0.09), (0.0185, 0.035), (0.015, 0.068)], n=7,
             mat=lambda band, q: "Deep" if band in (0, 3) else "Grip")
        zs = [0.06, 0.08, 0.17, 0.28, 0.295, 0.4, 0.52, 0.535, 0.64, L]
        rs = [0.0155, 0.0152, 0.014, 0.0126, 0.0124, 0.011, 0.0094, 0.0092, 0.0079, 0.0058]
        loft(pc, [bend(z) for z in zs], rs, sides=6, twist=0.2, mat=lambda i, k: "Deep" if i in (0, 3, 6) else ("Pale" if k % 2 else "Glass"), tip=False, cap=True)
        pc.mat = "Pale"                         # the tip's crystal
        top = bend(L)
        loft(pc, [top, top + V((0, 0.002, 0.016)), top + V((0, 0.004, 0.03))], [0.0068, 0.0105, 0.004], sides=6, phase=0.5, tip=True, cap=False)
        c = V((0, -0.052, 0.03))                 # the float in its net
        pc.blob(c, 0.029, segs=8, rings=6)
        pc.mat = "Rope"
        pc.tube([(0, -0.012, 0.03), (0, -0.024, 0.03)], [0.0045, 0.0045], sides=4, tip=False)
        pc.tube([c + V((math.cos(TAU * k / 9) * 0.0305, math.sin(TAU * k / 9) * 0.0305, 0.0)) for k in range(9)], [0.0028] * 9, sides=3, closed_loop=True)
        pc.tube([c + V((math.cos(TAU * k / 9) * 0.0305, 0.0, math.sin(TAU * k / 9) * 0.0305)) for k in range(9)], [0.0028] * 9, sides=3, closed_loop=True)
        line(pc, c + V((0, 0, 0.03)), bend, L, "Grip", tip=bend(L + 0.03) + V((0, -0.004, 0)))
    return model("rod-3", {"Glass": "#7FC4BC", "Deep": "#4E8F8A", "Pale": "#CDEDE6", "Grip": "#E9E0CB", "Rope": "#C9AE7E"}, b)


# ================================================================ rare: Riptide, still chill
def riptide():
    """Rare (David: "not cool enough"; rare is "still chill"). A rushing current: a navy blank wrung by a white foam
    spiral, its tip breaking into a cresting wave, a sea-foam grip, a whirlpool reel. The effect: a slow ring of water
    turning round the reel seat and a few bubbles."""
    L = 0.84
    bend = bender(L, bow=0.03)

    def b(pc):
        pc.mat = "Grip"
        grip(pc, [(0, -0.12), (0.016, -0.118), (0.0195, -0.09), (0.0195, 0.035), (0.015, 0.066)], n=7)
        n = 8
        zs = [0.06 + (L - 0.06) * k / (n - 1) for k in range(n)]
        rad = lambda z: 0.0155 - 0.0075 * (z - 0.06) / (L - 0.06)
        pc.mat = "Navy"
        loft(pc, [bend(z) for z in zs], [rad(z) for z in zs], sides=6, tip=False, cap=True)
        pc.mat = "Foam"                          # the foam: a ribbon of surf wound twice up the blank, standing off it
        flange(pc, bend, rad, 0.1, L - 0.03, turns=2.1, width=(0.02, 0.009), thick=0.008, n=18)
        top = bend(L)                            # the crest: up, over toward the front, and down into the lip
        crest = [top, top + V((0, -0.012, 0.045)), top + V((0, -0.045, 0.078)), top + V((0, -0.087, 0.075)), top + V((0, -0.105, 0.045)), top + V((0, -0.09, 0.024))]
        loft(pc, crest, [(0.009, 0.008), (0.016, 0.009), (0.017, 0.0085), (0.014, 0.007), (0.009, 0.005), (0.004, 0.002)], sides=6,
             mat=lambda i, k: "Foam" if i >= 2 else "Teal", tip=True, cap=False, ref=(1, 0, 0))
        reel(pc, z=0.02, mat="Navy", crank=True, knob="Foam")
        pc.mat = "Foam"                          # the whirlpool on the reel's face
        pc.tube([V((-0.0145, -0.048, 0.02)) + V((0, math.cos(a) * rr, math.sin(a) * rr)) for a, rr in ((TAU * 1.6 * i / 9, 0.004 + 0.026 * i / 9) for i in range(10))],
                [0.0028] * 10, sides=3, tip=False)
        line(pc, (0, -0.048, 0.034), bend, L, "Foam", ahead=-0.03, tip=top + V((0, -0.096, 0.03)))
    rod = model("rod-riptide", {"Navy": "#1F3D6B", "Foam": "#F1F5F1", "Grip": "#8DD4BA", "Teal": "#3C86A8"}, b)

    def ring(pc):                                # a ribbon of water round the reel seat, tilted
        pc.mat = "Light"
        pts = [V((math.cos(TAU * k / 14) * 0.052, math.sin(TAU * k / 14) * 0.052, 0.012 * math.sin(TAU * k / 14 * 2))) for k in range(14)]
        pc.tube([p + V((0, 0, 0.11)) for p in pts], [(0.011, 0.003)] * 14, sides=4, closed_loop=True, up=V((0, 0, 1)))
    fx = [fx_part("Swirl", {"Light": "#4FC6E6"}, ring, pivot=(0, 0.004, 0.11), spin=0.9, bob=0.008, rate=1.1)]
    return rod, fx, {"rodFx": "riptide"}, {"spark": "#CFF6FF", "sparkSprite": "glow", "sparkEvery": 0.4, "sparkSize": 0.05, "sparkRise": 0.25}


# ================================================================ epic: barely rods, with an aura
def aura_shell(pc, top, r=0.075):
    """The aura's shell: a soft spindle round the whole rod (RodAura draws it brightest where it faces you)."""
    pc.mat = "Aura"
    lathe(pc, (0, 0.01, -0.14), [(0, 0.0), (r * 0.55, 0.06), (r, 0.22), (r, top * 0.6), (r * 0.7, top * 0.9), (0, top + 0.22)], n=10)


def tidewarden():
    """Epic, rod-5, remodelled 1:1 from David's epic-tidewarden-ref.png (rods round 9; traced by trace_refs.py): a golden
    trident, the head's own outline (three prongs, the middle tallest, gold turning mint then blue at their tips, the two
    round cut-outs, the spurs), a long thin gold shaft, a teal wrap at the butt and a four-point star butt cap. The head
    and the star are single sheets drawn from both sides. The line leaves the middle prong's tip (its highest point),
    so no reel. Its effect, on the effects library: the ribbon of water wrapping the shaft under the head, foam where it
    crashes off, drops trailing away (water); the teal veins cracking through the gold (glow). No discs, no aura."""
    from traced_refs import TIDEWARDEN as T
    R = 0.0072                                   # the shaft (traced 0.0064: a touch thicker, to hold up in the pixel finish)
    neck, star = T["neck"][1], T["star"]

    def b(pc):
        for mat, mesh in T["head"].items():     # the head: each colour's part, flat, facing -Y (drawn from both sides)
            pc.mat = mat
            vs = [pc.v((x, 0, z)) for x, z in mesh["points"]]
            for t in mesh["tris"]:
                pc.f([vs[i] for i in t], V((sum(mesh["points"][i][0] for i in t) / 3, 1, 0)))
        pc.mat = "Gold"
        pc.tube([(0, 0, star["centre"]), (0, 0, 0.3), (0, 0, neck + 0.02)], [R, R * 0.95, R * 0.9], sides=6, tip=False)
        # the star: four points, the bottom one longest, concave between them, a diamond cut through its middle
        c, w = V((0, 0, star["centre"])), star["span"] / 2
        tips = [c + V((0, 0, 0.032)), c + V((w, 0, 0)), V((0, 0, star["foot"])), c + V((-w, 0, 0))]
        dirs = [(t - c).normalized() for t in tips]
        valleys = [c + (dirs[i] + dirs[(i + 1) % 4]).normalized() * 0.011 for i in range(4)]
        hole = [c + d * 0.0055 for d in dirs]
        T_, Vv, D = [pc.v(p) for p in tips], [pc.v(p) for p in valleys], [pc.v(p) for p in hole]
        back = c + V((0, 1, 0))
        for i in range(4):
            j = (i + 1) % 4
            pc.f([D[i], Vv[i - 1], T_[i]], back)
            pc.f([D[i], T_[i], Vv[i]], back)
            pc.f([D[i], Vv[i], D[j]], back)
        # the teal wrap: a ring round the shaft over the star, and a band winding up from it
        pc.mat = "Teal"
        pc.tube([V((math.cos(TAU * k / 8) * 0.012, math.sin(TAU * k / 8) * 0.012, -0.03 + 0.006 * math.cos(TAU * k / 8))) for k in range(8)], [0.0034] * 8, sides=4, closed_loop=True)
        pc.tube(helix((0, 0, -0.026), (0, 0, 0.028), R + 0.002, R + 0.002, 1.25, 11), [(0.0045, 0.0016)] * 11, sides=4, tip=False, cap=False, up=V((0, 0, 1)))
    rod = model("rod-5", {"Gold": "#E0C07E", "Mint": "#A9D6BF", "Tip": "#6FB0DA", "Teal": "#3DB8B6"}, b, grad=(0.85, 1.0))

    # ---- the effect: the veins (glow) and the water (the library's Water type)
    vp, vt = T["veins"]["points"], T["veins"]["tris"]
    verts = [V((x, sy * 0.0014, z)) for sy in (-1, 1) for x, z in vp]
    veins = sheet("Veins", "Glow", "#5FE3D8", verts, [tuple(i + k * len(vp) for i in t) for k in (0, 1) for t in vt])
    # the ribbon: down from under the head round the shaft (as drawn, a turn and a half), then peeling off to the right
    # and down as a streamer; past that, more of it winding further down the shaft, shown only with strength
    top, wrap_end = neck - 0.012, neck - 0.08
    rings, gate = [], []
    band = lambda a, z, r, w: [V((math.cos(a) * r, math.sin(a) * r, z + w * (j / 2 - 1))) + V((math.cos(a), math.sin(a), 0)) * 0.0015 * math.sin(math.pi * j / 4) for j in range(5)]
    N = 22
    for i in range(N):                            # the wrap as drawn: a band lying on the shaft, its width along it
        u = i / (N - 1)
        rings.append(band(TAU * 1.5 * u - 0.6, top + (wrap_end - top) * u, R + 0.006, 0.016))
        gate.append(0.0)
    a_end = TAU * 1.5 - 0.6
    base = V((math.cos(a_end) * (R + 0.006), math.sin(a_end) * (R + 0.006), wrap_end))
    def strip(a, b, half, n, sag=0.0, taper=(1.0, 0.45)):
        """A loose run of water from a to b, sagging, its width tapering from taper[0] to taper[1] of `half`."""
        a, b = V(a), V(b)
        d = (b - a).normalized()
        nrm = d.cross(V((0, 1, 0))).normalized()
        for i in range(n):
            u = i / (n - 1)
            c = a.lerp(b, u) + V((0, 0, -sag * 4 * u * (1 - u)))
            w = half * (taper[0] + (taper[1] - taper[0]) * u)
            rings.append([c + nrm * w * (j / 2 - 1) for j in range(5)])
            gate.append(0.0)
        return len(rings) - 1
    # the streamer peeling off to the right and drooping (as drawn), a loose wisp below it, a long drop flung out
    rings.pop(), gate.pop()
    cuts = [strip(base, base + V((0.042, -0.006, -0.02)), 0.012, 8, sag=0.004, taper=(1.0, 0.5))]
    cuts.append(strip((0.05, -0.004, neck - 0.105), (0.096, -0.006, neck - 0.14), 0.007, 6, sag=0.006, taper=(1.0, 0.45)))
    cuts.append(strip((0.132, -0.002, neck - 0.082), (0.168, -0.002, neck - 0.088), 0.0055, 5, taper=(0.5, 1.0)))
    cut = cuts[-1]
    M = 30
    for i in range(M):                            # more wrap, further down the shaft, shown with strength (its own strip)
        u = i / (M - 1)
        rings.append(band(a_end + 0.4 + TAU * 3.0 * u, wrap_end - 0.01 - 0.22 * u, R + 0.005, 0.009))
        gate.append(0.02 + 0.98 * u)
    body = water("Tide", "#2E9CC8", rings, gate, cut=tuple(cuts))
    # foam: the streamer's end crashing, a curl where it peels off; drops trailing away to the right and falling
    tips = [(base + V((0.044, -0.008, -0.022)), 0.008, 1.0), (V((0.098, -0.008, neck - 0.142)), 0.006, 0.7)]
    fv, ft, fd, fp, fc = [], [], [], [], []
    for n, (c, r, crown) in enumerate(tips):
        k0 = len(fv)
        fv.append(c)
        fd.append(1.0)
        for j in range(12):                       # a ragged blob, its tongues reaching out and back
            ang = TAU * j / 12
            reach = r * (1.0 + 0.55 * (j % 3 == 0) + 0.25 * math.sin(3 * ang + n))
            fv.append(c + V((math.cos(ang) * reach, -0.002, math.sin(ang) * reach * 0.8)))
            fd.append(0.0)
        for j in range(12):
            ft.append((k0, k0 + 1 + j, k0 + 1 + (j + 1) % 12))
        fp += [0.3 * n + 0.1] * 13
        fc += [crown] * 13
    froth = foam("Crash", "#F4FEFF", fv, ft, fd, fp, fc)
    D = [((0.145, 0, 0.446), 0.004, 0.5), ((0.088, 0, 0.338), 0.0045, 0.5), ((0.14, 0, 0.40), 0.003, 0.2), ((0.105, 0, 0.30), 0.003, 0.8),
         ((0.18, 0, 0.43), 0.0035, 0.65), ((0.07, 0, 0.39), 0.003, 0.35)]          # the drops as drawn (traced positions)
    drops = [(p, sz, ph, 0.3 + 0.1 * i, False) for i, (p, sz, ph) in enumerate(D)]
    drops += [((0.06 + 0.02 * (i % 4), 0.01 * ((i % 3) - 1), neck - 0.09 - 0.035 * i), 0.0035, (0.37 * i) % 1, 0.5 + 0.06 * i, True) for i in range(8)]
    spray_ = spray("Drops", "#4FC3DD", drops)
    return rod, [veins, body, froth, spray_], {"rodFx": "tidewarden"}, {}


def tempest():
    """Epic (David's epic-tempest-ref.png; 11-05: "no epic enough, shape isnt right and the effects on the rod also isnt
    right ... the aura doesnt look right and the light coming off of it being circle isnt right"). Rebuilt with the
    effects library (fx_library.py): a long chain of icy links for a blank, each link turned a quarter from the last
    and leaning with the zigzag of a bolt, a crystal spike at the tip, ice shards off the reel, a white reel, a black
    grip in white rings. The effect, all in the rod's own shape and no discs of light: lightning running down both
    sides of the chain and crackling (glow, flicker), a spark at the tip that swells (glow, pulse), a gust of wind
    winding up the chain with a ribbon behind it (light, motion, trail), an aura hugging the chain (aura), and
    sparks drifting off it (particles)."""
    L, z0, k = 0.92, 0.07, 9
    zig = lambda j: 0.012 * (1 if j % 2 else -1) * min(1.0, j / 2)       # the bolt's zigzag, calm at the reel
    joints = [V((zig(j), 0.003 * j / k, z0 + (L - z0) * j / k)) for j in range(k + 1)]
    half = lambda j: 0.021 - 0.008 * j / k                                  # a link's half width, thinning up the chain

    def link(pc, j):
        """Link j: a long hexagonal loop from joint j to j + 1 (overlapping both), in a plane turned a quarter each link."""
        a, b = joints[j] - V((0, 0, 0.012)), joints[j + 1] + V((0, 0, 0.012))
        d, w = (b - a).normalized(), half(j)
        side = V((1, 0, 0)) if j % 2 == 0 else V((0, 1, 0))
        side = (side - d * side.dot(d)).normalized()
        pts = [a, a.lerp(b, 0.22) + side * w, a.lerp(b, 0.78) + side * w * 0.9, b, a.lerp(b, 0.78) - side * w * 0.9, a.lerp(b, 0.22) - side * w]
        pc.mat = "Ice" if j % 2 else "Pale"
        pc.tube(pts, [0.0058 - 0.0016 * j / k] * 6, sides=3, closed_loop=True)

    def b(pc):
        grip(pc, [(0, -0.12), (0.017, -0.12), (0.02, -0.105), (0.019, 0.03), (0.016, 0.06)], n=7, mat=lambda band, q: "White" if band in (0, 2) else "Grip")
        for j in range(k):
            link(pc, j)
        pc.mat = "Ice"                            # the crystal spike at the tip
        top = joints[-1]
        loft(pc, [top, top + V((0, 0, 0.03)), top + V((0, 0, 0.075))], [0.005, 0.012, 0.003], sides=4, phase=math.pi / 4, tip=True, cap=False)
        pc.mat = "Pale"                           # ice shards off the reel seat, jagged, up and back, and one down
        for s in (-1, 1):
            leaf(pc, (s * 0.014, 0.004, 0.08), V((s * 0.55, 0.35, 0.76)), 0.15, 0.022, side=V((0, 1, 0)), curl=-0.02, lobes=(0.45, 1.0, 0.6, 0.2), thick=0.004, sides=3)
        leaf(pc, (0.0, 0.01, 0.02), V((0.2, 0.5, -0.84)), 0.08, 0.018, side=V((1, 0, 0)), lobes=(0.6, 1.0, 0.3), thick=0.004, sides=3)
        reel(pc, z=0.025, r=0.034, mat="White", knob="Ice", n=8)
        pc.mat = "Grip"                           # the reel's dark hub
        lathe(pc, (0.0, -0.048, 0.025), [(0.0, 0.0145), (0.013, 0.0155), (0, 0.019)], n=6, axis=(-1, 0, 0))
        line(pc, (0, -0.05, 0.041), lambda z: V((0, 0, z)), L, "White", ahead=-0.03, zs=(0.45,), tip=top + V((0, -0.004, 0.07)))
    rod = model("rod-tempest", {"Grip": "#23262F", "White": "#EEF4F8", "Ice": "#8FD0F2", "Pale": "#DDF2FC"}, b)
    tip = joints[-1] + V((0, 0, 0.09))

    def bolts(pc):                               # lightning down both sides of the chain, forked, and the reel's charge
        pc.mat = "Glow"
        for s, ph in ((-1, 0.0), (1, 1.9)):
            pts = [V((zig(j) + s * (half(j) * 1.05 + 0.004 * math.sin(3.1 * j + ph)), 0.006 * math.cos(2.3 * j + ph), z0 + (L - z0) * j / k)) for j in range(k + 1)]
            mids = []
            for j in range(k):                   # a kink between each pair of joints: the bolt's jag
                m = pts[j].lerp(pts[j + 1], 0.5) + V((s * 0.006 * (1 if j % 2 else -1), 0, 0))
                mids += [pts[j], m]
            mids.append(pts[-1])
            pc.tube(mids, [0.0032] * len(mids), sides=3, tip=True)
            for j in (3, 6):                     # forks flicking off
                f = mids[2 * j + 1]
                pc.tube([f, f + V((s * 0.022, 0.0, 0.012)), f + V((s * 0.03, 0.002, 0.03))], [0.002, 0.0016, 0.001], sides=3, tip=True)
        for s in (-1, 1):                        # the charge along the reel's shards and the butt's cap
            leaf(pc, (s * 0.016, 0.0, 0.085), V((s * 0.55, 0.35, 0.76)), 0.11, 0.006, side=V((0, 1, 0)), curl=-0.02, lobes=(0.5, 1.0, 0.4), thick=0.002, sides=3)
        lathe(pc, (0, 0, -0.124), [(0.0, -0.006), (0.016, -0.004), (0.017, 0.002), (0.0, 0.004)], n=7)

    def spark(pc):                               # the spark at the tip: four jagged points
        pc.mat = "Glow"
        for d in (V((0, 0, 1)), V((0.8, 0.1, 0.35)), V((-0.75, -0.1, 0.25)), V((0.15, 0, -0.6))):
            d = d.normalized()
            side = d.cross(V((0, 1, 0))).normalized()
            pc.tube([tip, tip + d * 0.018 + side * 0.004, tip + d * 0.04], [0.006, 0.004, 0.0], sides=3, tip=False)

    def gust(pc):                                # a wisp of wind, winding up the chain
        pc.mat = "Light"
        pc.tube([V((0.05, -0.01, 0.4)), V((0.055, 0.012, 0.43)), V((0.045, 0.03, 0.46))], [0.004, 0.006, 0.002], sides=3, tip=True)
    axis = [V((0, 0, z0 - 0.02))] + joints + [tip]
    radii = [0.012] + [half(j if j < k else k - 1) for j in range(k + 1)] + [0.01]
    fx = [glow("Bolts", "#55DCFF", bolts, flicker=1.0),
          glow("Spark", "#C8F7FF", spark, pivot=tuple(tip), pulse=0.14),
          light("Gust", "#9EDCFF", gust, pivot=(0, 0, 0.43), spin=2.4, bob=0.12, rate=0.35, **trail(0.016, (0.05, 0.012, 0.0))),
          aura_hug("Aura", "#2A86E0", axis, radii, inflate=1.7)]
    return rod, fx, {"rodFx": "tempest"}, particles("#C9F6FF", "sparkle", every=0.07, size=0.07, rise=0.45)


def titanium():
    """Epic (David's epic-titanium-ref.png). Armour more than rod: a dark slate blank of stacked hexagonal cups, a
    chunky hex reel spiked round its rim, and pale lilac claws sweeping off the reel, two down and back, one up. The
    effect: lilac light in every seam and in the reel's core, hex plates orbiting the blank, a lilac aura, motes."""
    L = 0.86
    segs = [(0.06, 0.18, 0.029), (0.18, 0.3, 0.027), (0.3, 0.42, 0.025), (0.42, 0.54, 0.0225), (0.54, 0.65, 0.02), (0.65, 0.76, 0.0175), (0.76, L, 0.015)]

    def b(pc):
        grip(pc, [(0, -0.112), (0.018, -0.11), (0.0195, -0.09), (0.0195, 0.03), (0.016, 0.06)], n=6, mat=lambda band, q: "Slate" if band == 0 else "Dark")
        pc.mat = "Slate"                         # the hex pommel
        lathe(pc, (0, 0, -0.112), [(0.016, 0.0), (0.021, -0.012), (0.0, -0.03)], n=6)
        path, rad, mats = [], [], []
        for z0_, z1, r in segs:                  # each segment a cup: narrow at its foot, flaring to a flat rim
            path += [V((0, 0, z0_)), V((0, 0, z1 - 0.012)), V((0, 0, z1))]
            rad += [r * 0.74, r, r]
        loft(pc, path, rad, sides=6, mat=lambda i, k: "Dark" if i % 3 == 2 else "Slate", tip=True, cap=True)
        # the reel: a chunky hex drum with three spikes and a lilac core
        pc.mat = "Slate"
        y, z = -0.062, 0.03
        pc.tube([(0, -0.016, z), (0, y + 0.016, z)], [0.008, 0.008], sides=4, tip=False)
        lathe(pc, (0, y, z), [(0.0, -0.024), (0.042, -0.022), (0.05, -0.007), (0.05, 0.007), (0.042, 0.022), (0.0, 0.024)], n=6, axis=(1, 0, 0), phase=math.pi / 6)
        for a in (0.4, 2.5, 4.6):
            d = V((0, math.cos(a), math.sin(a)))
            pc.tube([V((0, y, z)) + d * 0.045, V((0, y, z)) + d * 0.088], [0.009, 0.0], sides=4, tip=False)
        pc.mat = "Lilac"
        pc.blob((0.025, y, z), (0.005, 0.018, 0.018), segs=6, rings=4)
        # the claws: two sweeping down and back, one up and back (the reference's wings)
        for s in (-1, 1):
            pts = [V((s * 0.02, y + 0.01, z - 0.01)), V((s * 0.06, y + 0.035, z - 0.07)), V((s * 0.085, y + 0.075, z - 0.14)), V((s * 0.08, y + 0.11, z - 0.21)),
                   V((s * 0.055, y + 0.12, z - 0.25))]
            loft(pc, pts, [(0.02, 0.005), (0.028, 0.005), (0.021, 0.0045), (0.012, 0.0035), (0.004, 0.002)], sides=4, tip=True, cap=True, ref=(0, 0, 1))
        pts = [V((0, y + 0.035, z + 0.015)), V((0, y + 0.09, z + 0.07)), V((0, y + 0.125, z + 0.15)), V((0, y + 0.115, z + 0.22))]
        loft(pc, pts, [(0.005, 0.018), (0.005, 0.022), (0.004, 0.013), (0.002, 0.004)], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        line(pc, (0, y, z + 0.02), lambda zz: V((0, 0, zz)), L, "Lilac", ahead=-0.022, tip=V((0, -0.004, L + 0.012)))
    rod = model("rod-titanium", {"Slate": "#5A6474", "Dark": "#2D323C", "Lilac": "#CDB6EE"}, b)

    def seams(pc):                               # lilac light in every seam, and the reel's core
        pc.mat = "Glow"
        for _, z1, r in segs[:-1]:
            pc.tube([V((math.cos(TAU * k / 6 + math.pi / 6 * 0) * r * 0.96, math.sin(TAU * k / 6) * r * 0.96, z1 + 0.003)) for k in range(6)], [0.0026] * 6, sides=3, closed_loop=True)
        lathe(pc, (0.029, -0.062, 0.03), [(0.0, 0.0), (0.013, 0.001), (0.0, 0.004)], n=6, axis=(1, 0, 0))

    def plates(pc):                              # hex plates of lilac light orbiting the blank
        pc.mat = "Glow"
        for k, (a, z) in enumerate(((0.0, 0.62), (TAU / 3, 0.48), (2 * TAU / 3, 0.34))):
            c = V((math.cos(a) * 0.085, math.sin(a) * 0.085, z))
            d = V((math.cos(a), math.sin(a), 0.35)).normalized()
            loft(pc, [c - d * 0.005, c + d * 0.005], [0.028, 0.028], sides=6, tip=False, cap=True, ref=(0, 0, 1))

    def shell(pc):
        aura_shell(pc, L + 0.05, r=0.1)
    fx = [fx_part("Seams", {"Glow": "#B583FF"}, seams, pulse=0.0, flicker=0.35),
          fx_part("Plates", {"Glow": "#B98CFF"}, plates, pivot=(0, 0, 0.48), spin=0.7, bob=0.015, rate=0.9),
          fx_part("Aura", {"Aura": "#A884FF"}, shell),
          halo((0.03, -0.062, 0.03), 0.24, "#D9B8FF"), halo((0, -0.004, L + 0.01), 0.36, "#D9B8FF")]
    return rod, fx, {"rodFx": "titanium"}, {"spark": "#E2CCFF", "sparkSprite": "glow", "sparkEvery": 0.11, "sparkSize": 0.055, "sparkRise": 0.3}


# ================================================================ build
ROD_FILES = {"carrot": "rod-carrot", "precision": "rod-precision", "training": "rod-training", "cedar": "rod-2", "glass": "rod-3",
             "riptide": "rod-riptide", "tidewarden": "rod-5", "tempest": "rod-tempest", "titanium": "rod-titanium"}
BUILD = {"carrot": carrot, "precision": precision, "training": training, "cedar": cedar, "glass": glass,
         "riptide": riptide, "tidewarden": tidewarden, "tempest": tempest, "titanium": titanium}
only = ARGS[ARGS.index("only") + 1].split(",") if "only" in ARGS else list(BUILD)
for name in only:
    out = BUILD[name]()
    rod, fx, rod_extras, fx_extras = out if isinstance(out, tuple) else (out, [], {}, {})
    export([rod], os.path.join(TOOLS, f"{ROD_FILES[name]}.glb"), rod_extras)
    mats = len(rod.data.materials)
    print(f"MODEL tools/{ROD_FILES[name]} tris={tris(rod)} materials={mats}")
    assert tris(rod) <= 600 and mats <= 5, f"{name} over the Tool budget"
    if fx:
        export(fx, os.path.join(PROPS, f"rodfx-{name}.glb"), fx_extras)
        print(f"MODEL props/rodfx-{name} tris={sum(tris(o) for o in fx)} meshes={sum(o.type == 'MESH' for o in fx)}")
    MADE[name] = (rod, fx)


# ================================================================ renders
def lit_fx(objs):
    """The effect's materials as they read in the game: Glow and Light emit, the Aura a faint shell brightest facing you."""
    for o in objs:
        if o.type != "MESH":
            continue
        for m in o.data.materials:
            nt = m.node_tree
            bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            col = bs.inputs["Base Color"].default_value
            if any(k in m.name for k in ("Glow", "Light")):
                bs.inputs["Emission Color"].default_value = col
                bs.inputs["Emission Strength"].default_value = 3.0 if "Glow" in m.name else 2.0
            elif "Aura" in m.name:
                out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
                em, tr, mix, lw = nt.nodes.new("ShaderNodeEmission"), nt.nodes.new("ShaderNodeBsdfTransparent"), nt.nodes.new("ShaderNodeMixShader"), nt.nodes.new("ShaderNodeLayerWeight")
                em.inputs["Color"].default_value = col
                em.inputs["Strength"].default_value = 1.5
                pw = nt.nodes.new("ShaderNodeMath")
                pw.operation = "POWER"
                inv = nt.nodes.new("ShaderNodeMath")
                inv.operation = "SUBTRACT"
                inv.inputs[0].default_value = 1.0
                nt.links.new(lw.outputs["Facing"], inv.inputs[1])
                nt.links.new(inv.outputs[0], pw.inputs[0])
                pw.inputs[1].default_value = 2.0
                k = nt.nodes.new("ShaderNodeMath")
                k.operation = "MULTIPLY"
                k.inputs[1].default_value = 0.22
                nt.links.new(pw.outputs[0], k.inputs[0])
                nt.links.new(k.outputs[0], mix.inputs[0])
                nt.links.new(tr.outputs[0], mix.inputs[1])
                nt.links.new(em.outputs[0], mix.inputs[2])
                nt.links.new(mix.outputs[0], out.inputs["Surface"])
                try:
                    m.surface_render_method = "BLENDED"
                except (AttributeError, TypeError):
                    pass


def render_set(objs, out, name, fx=()):
    """Five orthographic views in one row on white, and a three-quarter hero with the effect lit."""
    sc = bpy.context.scene
    every = [o for o in sc.objects if o.type in ("MESH", "EMPTY") and o.name not in ("Cam",)]
    for o in every:
        o.hide_render = o not in objs and o not in fx
    meshes = [o for o in list(objs) + list(fx) if o.type == "MESH" and not any("Aura" in m.name for m in o.data.materials)]
    pts = [o.matrix_world @ V(c) for o in meshes for c in o.bound_box]
    lo = V((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = V((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    mid, H = (lo + hi) / 2, max(hi.z - lo.z, 0.3)
    if FIXED:                                   # one scale for a comparison: every model's foot on the same line
        mid.z, H = lo.z + FIXED / 1.08 / 2 - 0.02, FIXED / 1.08
    cam = sc.camera
    views = [("front", 0, 0), ("side", 90, 0), ("back", 180, 0), ("top", 0, 89.9), ("three-quarter", -35, 18)]
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = H * 1.08
    sc.render.resolution_x, sc.render.resolution_y = 300, 760
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
    files = []
    for v, az, el in views:
        a, e = math.radians(az), math.radians(el)
        d = V((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = mid + d * 6
        cam.rotation_euler = d.to_track_quat("Z", "Y" if el < 80 else "Y").to_euler()
        if el > 80:
            cam.rotation_euler = (0, 0, 0)
            cam.location = mid + V((0, 0, 6))
        f = os.path.join(out, f"{name}-{v}.png")
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        files.append(f)
    # the hero: perspective, three-quarter, a soft sea-grey ground
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.7, 0.74, 1)
    cam.data.type = "PERSP"
    cam.data.lens = 85
    a, e = math.radians(-38), math.radians(14)
    d = V((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = mid + d * (H * 2.75)
    cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 640, 900
    sc.render.filepath = os.path.join(out, f"{name}-hero.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER_OK", name)


def setup_render():
    sc = bpy.context.scene
    kit.render_setup(sc, (1, 1, 1, 1))
    sc.render.film_transparent = False
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.clip_end = 40
    sc.collection.objects.link(cam)
    sc.camera = cam
    kit.show_vertex_colors(sc)


FIXED = float(ARGS[ARGS.index("scale") + 1]) if "scale" in ARGS else None
if "render" in ARGS or "old" in ARGS:
    setup_render()
if "render" in ARGS:
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    for name, (rod, fx) in MADE.items():
        lit_fx(fx)
        render_set([rod], out, name, fx)
if "old" in ARGS:
    i = ARGS.index("old")
    out = ARGS[i + 1]
    os.makedirs(out, exist_ok=True)
    for spec in ARGS[i + 2:]:
        if "=" not in spec:
            break
        name, path = spec.split("=", 1)
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        kit.show_vertex_colors(bpy.context.scene)
        render_set(new, out, name)
