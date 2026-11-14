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
from mathutils import Matrix, Vector

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
    11-05: "more leaves it loosk naked"; 11-06: "more dense and move more down to the handle area, the leaves sway a lil
    when moved like physics"). The blank is the trunk of a little cedar: eighteen close layers of flat needle sprays
    from just above the grip to the tip, each with a short inner layer filling it in, a full cone wide and drooping low
    near the grip and small near the tip, each layer turned on from the last so the gaps fill, in two greens (new growth
    lighter at the top), the blank's tip as the leader. The foliage is the rod's effect (`rodfx-cedar`, the library's
    Sway: RodAura springs it after the rod's motion), so the rod itself stays one plain mesh."""
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
        line(pc, (0, -0.048, 0.034), bend, L, "Line")
    rod = model("rod-2", {"Grip": "#C8A27A", "Blank": "#9A5A3A", "Line": "#F2ECDD"}, b)

    def foliage(pc):
        n = 18                                   # z, reach and sprays: the cone, from just above the grip to the tip
        for w in range(n):
            u = w / (n - 1)
            z, R, m = 0.11 + 0.61 * u, 0.13 - 0.108 * u, max(3, round(10 - 7 * u))
            mats = ("Leaf", "Fresh") if w < n // 2 else ("Fresh", "Leaf")
            whorl(pc, bend(z), R, m, 0.4 + w * 2.4, droop=0.9 - 0.03 * w, seed=w, mats=mats)
            # the inner layer: short sprays between the long ones, a little above them, filling the cone in
            whorl(pc, bend(z + 0.012), R * 0.55, max(3, m - 3), 0.4 + w * 2.4 + math.pi / m, rise=0.5, droop=0.6, seed=w + 40, mats=mats[::-1])
    leaves = fx_part("Leaves", {"Leaf": "#4A7A38", "Fresh": "#6A9A48"}, foliage, sway=1.0)
    return rod, [leaves], {"rodFx": "cedar"}, {}


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
def tidewarden(woke=False):
    """Epic, rod-5, remodelled from David's epic-tidewarden-ref.png (rods round 9 and 9b; traced by trace_refs.py): a
    golden trident. The head is the sketch's own outline smoothed into clean curves (three prongs, the middle tallest,
    the two round cut-outs, the side spurs and crescents), made solid: bevelled to a fine edge all round and raised along
    its medial axis, a ridge down each prong and the body, so it turns well and reads edge-on. Its colour runs in the
    vertices: gold, each prong's tip fading through mint into blue as sketched. Stylised to read at game size: the head
    1.2 times the sketch's (the tip where it was, the shaft a little shorter), the shaft thicker than drawn. A teal wrap
    at the butt, a four-point star cap with its diamond cut, and (round 11, David: "add the reel and line component to
    this that matches its style") a gold reel with a teal crank and knob, its teal line up the shaft and the middle
    prong's face to its tip. Its effect: the teal veins as continuous branching cracks lying on the relief (glow). No
    water as bought (round 11: the water comes with its awakening), no discs, no aura.

    `woke`: rod-tidewarden-a1, its awakening (round 11, David: "the awakened will have waves wrapped around and it will
    have wave movement animation with like wave articles flowing around and water dripping and make the head of the
    drident longer and glowing"). The head half as long again (its width as before) and lit, its colour reaching
    further into mint and blue, a glowing rim round its edge with the veins. Its water (the library's Water type, one
    spinning node so the waves run round the shaft): two ribbons wound the length of the shaft against each other, a
    crest curling off under the head, foam where they break, drops flung off and dripping (spray), motes dripping
    off it. The wrap is gated down the shaft (`wrap`): under strength 1 there is none, and from 1 to about 1.5 it runs
    down from the head to the grip, so the cutscene winds it on (rodMotion AWAKEN_FX); the effect is drawn at 1.5 as
    made (`fxStrength`, RodAura), so in a hand or the bag the whole wrap shows."""
    from traced_refs import TIDEWARDEN as T
    R = 0.0095                                   # the shaft (traced 0.0064): stylised over measured, for the pixel finish
    K, HALF, BEVEL = 1.2, 0.0058, 16.0           # the head's scale, its half thickness at the ridge, the bevel's width (px)
    KZ = 1.55 if woke else K                     # its length: the awakened head longer
    tip, neck0, star = T["tip"][1], T["neck"][1], T["star"]
    neck = tip - (tip - neck0) * K               # the neck stays where it was; a longer head reaches higher
    top_z = neck + (tip - neck0) * KZ
    at = lambda x, z: (x * K, neck + (z - neck0) * KZ)
    lift = lambda d, ridge=False: HALF * min(1.0, d / BEVEL) ** 0.75 + (0.0012 if ridge and d > 0 else 0.0)
    H = T["head"]
    gold, mint, blue = (kit.lin(c) for c in (("#F3D88E", "#B9F6E2", "#62D2F2") if woke else ("#E2C47F", "#A9D9C2", "#5FA8DA")))
    reach = 1.45 if woke else 1.0                # how far up the prongs the mint and blue reach
    shade = {}
    rz = 0.06                                    # the reel's height

    def b(pc):
        # the head: the front raised toward -Y, the back the same toward +Y, meeting at the outline (one closed solid)
        pc.mat = "Gold"
        front, back = [], []
        for (x, z), d, r, bd in zip(H["points"], H["depth"], H["ridge"], H["band"]):
            X, Z = at(x, z)
            h = lift(d, r)
            front.append(pc.v((X, -h, Z)))
            back.append(pc.v((X, h, Z)))
            bd = min(bd * reach, 2.0)
            u, w = min(bd, 1.0), max(bd - 1.0, 0.0)
            col = [g + (m - g) * u + (bl - m) * w for g, m, bl in zip(gold, mint, blue)]
            shade[(round(X, 4), round(Z, 4))] = col
        for t in H["tris"]:
            c = sum((V(at(*H["points"][i])).to_3d() for i in t), V((0, 0, 0))) / 3
            mid = V((c.x, 0, c.y))
            pc.f([front[i] for i in t], mid + V((0, 1, 0)))
            pc.f([back[i] for i in t], mid - V((0, 1, 0)))
        pc.mat = "Shaft"
        pc.tube([(0, 0, star["centre"]), (0, 0, 0.3), (0, 0, neck + 0.02)], [R, R * 0.95, R * 0.9], sides=5, tip=False)
        # the star: four points, the bottom one longest, concave between them, a diamond cut through its middle
        c, w = V((0, 0, star["centre"])), star["span"] / 2
        tips = [c + V((0, 0, 0.032)), c + V((w, 0, 0)), V((0, 0, star["foot"])), c + V((-w, 0, 0))]
        dirs = [(q - c).normalized() for q in tips]
        valleys = [c + (dirs[i] + dirs[(i + 1) % 4]).normalized() * 0.012 for i in range(4)]
        hole = [c + d * 0.0055 for d in dirs]
        T_, Vv, D = [pc.v(p) for p in tips], [pc.v(p) for p in valleys], [pc.v(p) for p in hole]
        bk = c + V((0, 1, 0))
        for i in range(4):
            j = (i + 1) % 4
            pc.f([D[i], Vv[i - 1], T_[i]], bk)
            pc.f([D[i], T_[i], Vv[i]], bk)
            pc.f([D[i], Vv[i], D[j]], bk)
        # the teal wrap: a ring round the shaft over the star, and a band winding up from it
        pc.mat = "Teal"
        pc.tube([V((math.cos(TAU * k / 5) * (R + 0.005), math.sin(TAU * k / 5) * (R + 0.005), -0.03 + 0.006 * math.cos(TAU * k / 5))) for k in range(5)], [0.0036] * 5, sides=3, closed_loop=True)
        pc.tube(helix((0, 0, -0.026), (0, 0, 0.028), R + 0.0015, R + 0.0015, 1.25, 7), [(0.005, 0.0016)] * 7, sides=3, tip=False, cap=False, up=V((0, 0, 1)))
        # the reel: gold, a teal crank and knob; built hanging toward -Y, then turned a quarter back, so the rod's final
        # quarter turn (below) leaves it toward the character's front like every rod's
        vs0, fs0 = set(pc.bm.verts), set(pc.ref)
        pc.mat = "Shaft"                         # the reel: a stem and a gold spool, lean (the Tool budget)
        pc.tube([(0, -0.008, rz), (0, -0.034, rz)], [0.0055, 0.0055], sides=4, tip=False, cap=False)
        lathe(pc, (0, -0.044, rz), [(0, -0.012), (0.027, -0.009), (0.027, 0.009), (0, 0.012)], n=6, axis=(1, 0, 0))
        pc.mat = "Teal"                          # the crank's arm and its teal knob
        pc.tube([(0.014, -0.044, rz), (0.026, -0.044, rz - 0.012), (0.03, -0.044, rz - 0.02)], [0.0035, 0.0035, 0.006], sides=4, tip=False)
        turn = Matrix.Rotation(-math.pi / 2, 3, "Z")
        for v_ in set(pc.bm.verts) - vs0:
            v_.co = turn @ v_.co
        for f_ in set(pc.ref) - fs0:
            pc.ref[f_] = turn @ V(pc.ref[f_])
        # the line: from the reel up the shaft in front of it, onto the middle prong's face, to just under its tip
        face = -(HALF + 0.0016)
        pts = [V((-0.044, 0, rz + 0.016)), V((-0.014, 0, rz + 0.08)), V((-0.011, 0, neck - 0.03)),
               V((0, face, neck + 0.04)), V((0, face * 0.5, top_z - 0.008))]
        pc.tube(pts, [0.0021] * len(pts), sides=3, tip=False)
    rod = model("rod-tidewarden-a1" if woke else "rod-5", {"Gold": "#FFFFFF", "Shaft": "#E0C07E", "Teal": "#3DB8B6"}, b, grad=(0.85, 1.0))
    # the head's colour into its vertices (times the shared top-light gradient); a sheen on all of it, gold as metal
    me = rod.data
    col = me.color_attributes["Color"]
    gi = [i for i, m in enumerate(me.materials) if m.name.endswith("_Gold")][0]
    for poly in me.polygons:
        if poly.material_index != gi:
            continue
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            rgb = shade.get((round(p.x, 4), round(p.z, 4)), gold)
            g = col.data[li].color[0]
            col.data[li].color = (rgb[0] * g, rgb[1] * g, rgb[2] * g, 1.0)
    for m in me.materials:                       # all of it, so in hand it still merges to one draw (heldMesh keys on these)
        bs = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bs.inputs["Roughness"].default_value = 0.45
        bs.inputs["Metallic"].default_value = 0.35

    # ---- the effect: the veins (glow), and awakened, the rim's glow and the water (the library's Water type)
    vv, vf = [], []
    for line_ in T["veins"]:                     # each crack a thin ribbon lying just over the relief, both faces
        pts = [(V(at(x, z)).to_3d(), d) for x, z, d in line_]
        for side in (-1, 1):
            k0 = len(vv)
            for i, (p, d) in enumerate(pts):
                a_, b_ = pts[max(i - 1, 0)][0], pts[min(i + 1, len(pts) - 1)][0]
                t = (b_ - a_).normalized() if (b_ - a_).length > 1e-6 else V((0, 1, 0))
                n = V((-t.y, t.x, 0)) * 0.0016 * K * (0.6 if i in (0, len(pts) - 1) else 1.0)
                y = side * (lift(d) + 0.0008)
                vv += [V((p.x + n.x, y, p.y + n.y)), V((p.x - n.x, y, p.y - n.y))]
            vf += [(k0 + 2 * i, k0 + 2 * i + 1, k0 + 2 * i + 3, k0 + 2 * i + 2) for i in range(len(pts) - 1)]
    if woke:                                     # the rim: every outline edge of the head, a band standing out of it
        used = {}
        for t in H["tris"]:
            for i, j in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
                used[frozenset((i, j))] = used.get(frozenset((i, j)), 0) + 1
        ctr = V((0, (neck + top_z) / 2))
        for e, n_ in used.items():
            if n_ != 1:
                continue
            i, j = tuple(e)
            a_, b_ = V(at(*H["points"][i])), V(at(*H["points"][j]))
            d = (b_ - a_).normalized()
            out = V((-d.y, d.x))
            if out.dot((a_ + b_) / 2 - ctr) < 0:
                out = -out
            k0 = len(vv)
            for p in (a_, b_, b_ + out * 0.0032, a_ + out * 0.0032):
                vv.append(V((p.x, 0.0, p.y)))
            vf.append((k0, k0 + 1, k0 + 2, k0 + 3))
    veins = sheet("Veins", "Glow", "#8FFFF2" if woke else "#5FE3D8", vv, vf)
    turn = Matrix.Rotation(math.pi / 2, 4, "Z")
    if not woke:
        rod.data.transform(turn)
        veins.data.transform(turn)
        return rod, [veins], {"rodFx": "tidewarden", "fxRoom": 0.04}, {}

    rings, gate, cuts = [], [], []
    low, high = 0.1, neck - 0.012               # the wrap runs from under the head down to just over the reel
    G = 0.3                                      # the gate at the bottom (shown from strength 1.45: library.ts wrap)

    def band(a, z, r, w, da, dz):
        """Across a ribbon lying on the shaft at angle a, height z: square to its run, its outer edge lifted (a crest)."""
        out, run = V((math.cos(a), math.sin(a), 0)), V((-math.sin(a) * r * da, math.cos(a) * r * da, dz)).normalized()
        across = out.cross(run).normalized()
        c = out * r + V((0, 0, z))
        return [c + across * (w * (j / 2 - 1)) + out * (0.0035 * math.sin(math.pi * j / 4) + 0.002 * j / 4) for j in range(5)]

    def wind(turns, n, a0, r, w, sign):
        da = sign * TAU * turns / (n - 1)
        for i in range(n):
            u = i / (n - 1)
            z = high + (low - high) * u
            wave = 0.0025 * math.sin(TAU * 3.0 * u + a0)        # the ribbon swelling out and in: waves along it
            rings.append(band(a0 + da * i, z, r + wave, w * (1.0 - 0.35 * u), da, (low - high) / (n - 1)))
            gate.append(G * u)
        cuts.append(len(rings) - 1)
    wind(4.0, 44, -0.6, R + 0.008, 0.02, 1)
    wind(3.0, 34, 2.4, R + 0.006, 0.012, -1)
    # the crest: a wave curling off under the head, up and over toward you (as the sketch's streamer, now a breaker)
    a0 = -0.6
    base = V((math.cos(a0) * (R + 0.008), math.sin(a0) * (R + 0.008), high))
    for i in range(8):
        u = i / 7
        ang = math.pi * 0.9 * u
        c = base + V((0.012 + 0.03 * u, -0.004, 0.0)) + V((0.0, 0.0, 0.026 * math.sin(ang)))
        c += V((0.012 * (1 - math.cos(ang)), 0, 0))
        w = 0.016 * (1.0 - 0.6 * u)
        rings.append([c + V((0, w * (j / 2 - 1), 0)) for j in range(5)])
        gate.append(0.0)
    body = water("Tide", "#2E9CC8", rings, gate, cut=tuple(cuts), spin=1.1)
    # foam: the crest breaking, and flecks on the wrap's edges near the head (where the water is from the start)
    crest = base + V((0.054, -0.004, 0.012))
    blobs = [(crest, 0.012, 1.0), (base + V((0.004, -0.006, -0.006)), 0.008, 0.6)]
    for k in range(4):
        a = -0.6 + TAU * 0.25 * k
        blobs.append((V((math.cos(a) * (R + 0.014), math.sin(a) * (R + 0.014), high - 0.03 - 0.03 * k)), 0.005, 0.3))
    fv, ft, fd, fp, fc = [], [], [], [], []
    for n, (c, r, crown) in enumerate(blobs):
        k0 = len(fv)
        fv.append(c)
        fd.append(1.0)
        for j in range(10):                       # a ragged blob, its tongues reaching out and back
            ang = TAU * j / 10
            rch = r * (1.0 + 0.55 * (j % 3 == 0) + 0.25 * math.sin(3 * ang + n))
            fv.append(c + V((math.cos(ang) * rch, -0.002, math.sin(ang) * rch * 0.8)))
            fd.append(0.0)
        for j in range(10):
            ft.append((k0, k0 + 1 + j, k0 + 1 + (j + 1) % 10))
        fp += [0.23 * n + 0.1] * 11
        fc += [crown] * 11
    froth = foam("Crash", "#F4FEFF", fv, ft, fd, fp, fc, spin=1.1)
    # drops: flung off the wrap all down the shaft, and dripping off the prongs' tips and the crest
    drops = []
    for i in range(12):
        a, z = 1.7 * i, high - (high - low) * (i + 0.5) / 12
        drops.append(((math.cos(a) * 0.03, math.sin(a) * 0.03, z), 0.0042, (0.29 * i) % 1, 0.35 + 0.03 * i, i % 3 == 2))
    for x, z in ((0.0, top_z - 0.02), (0.07, neck + 0.12), (-0.07, neck + 0.12), (0.05, high + 0.01)):
        drops.append(((x, 0.0, z), 0.0036, (0.53 * x * 10) % 1, 0.3, False))
    spray_ = spray("Drops", "#4FC3DD", drops)
    for ob in [rod, veins, body, froth, spray_]:
        ob.data.transform(turn)
    return rod, [veins, body, froth, spray_], {"rodFx": "tidewarden-a1", "fxRoom": 0.06}, {"fxStrength": 1.5, **particles("#9EE7F5", "glow", every=0.09, size=0.045, rise=-0.35)}


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


def tempest_a1():
    """The Tempest awakened, rod-tempest-a1 (round 11, David on rg10-awaken-tempest: "needs to redo the awakened model but
    animation looks good"): the storm caught in it. Fewer, bolder links zigzagging harder up the chain (the bolt's
    shape), a crown of three ice spikes forked like a bolt's end where the one spike was, the white reel swallowed by a
    storm cloud, two long jagged shards off the seat, a deep navy grip in ice rings. Its effect as the Tempest's, all
    stronger: lightning down both sides of the chain forking more often (glow, flicker), the crown's spark (glow,
    pulse), the gust winding up it (light, motion, trail), the aura hugging the chain, sparks off it (particles). The
    lightning strike and the electricity it wears after are the cutscene's (rodMotion AWAKEN_FX); the base Tempest
    waits for David's reference."""
    L, z0, k = 0.96, 0.07, 7
    zig = lambda j: 0.017 * (1 if j % 2 else -1) * min(1.0, j / 1.5)
    joints = [V((zig(j), 0.003 * j / k, z0 + (L - z0) * j / k)) for j in range(k + 1)]
    half = lambda j: 0.024 - 0.008 * j / k
    top = joints[-1]
    spikes = [(V((0, 0, 1)), 0.09, 0.013), (V((0.62, 0.0, 0.78)), 0.06, 0.009), (V((-0.55, 0.0, 0.83)), 0.05, 0.008)]

    def b(pc):
        grip(pc, [(0, -0.12), (0.017, -0.12), (0.02, -0.105), (0.019, 0.03), (0.016, 0.06)], n=6, mat=lambda band, q: "White" if band in (0, 2) else "Grip")
        for j in range(k):                       # each link a long hexagonal loop, a quarter turned from the last
            a, b_ = joints[j] - V((0, 0, 0.014)), joints[j + 1] + V((0, 0, 0.014))
            d, w = (b_ - a).normalized(), half(j)
            side = V((1, 0, 0)) if j % 2 == 0 else V((0, 1, 0))
            side = (side - d * side.dot(d)).normalized()
            pts = [a, a.lerp(b_, 0.22) + side * w, a.lerp(b_, 0.78) + side * w * 0.9, b_, a.lerp(b_, 0.78) - side * w * 0.9, a.lerp(b_, 0.22) - side * w]
            pc.mat = "Ice" if j % 2 else "Pale"
            pc.tube(pts, [0.0068 - 0.0018 * j / k] * 6, sides=3, closed_loop=True)
        for n, (d, length, r) in enumerate(spikes):   # the crown: three spikes, forked like a bolt's end
            pc.mat = "Pale" if n else "Ice"
            d = d.normalized()
            loft(pc, [top, top + d * length * 0.4, top + d * length], [r * 0.5, r, r * 0.25], sides=4, phase=math.pi / 4, tip=True, cap=False)
        pc.mat = "Pale"                           # two long jagged shards off the seat, up and back
        for s in (-1, 1):
            leaf(pc, (s * 0.016, 0.004, 0.085), V((s * 0.5, 0.3, 0.8)), 0.2, 0.026, side=V((0, 1, 0)), curl=-0.02, lobes=(0.5, 1.0, 0.55, 0.2), thick=0.004, sides=3)
        pc.mat = "White"                          # the reel's stem, into the cloud
        pc.tube([(0, -0.012, 0.03), (0, -0.04, 0.03)], [0.006, 0.006], sides=5, tip=False)
        pc.mat = "Storm"                          # the storm cloud the reel is now: three puffs
        for c, r in (((0, -0.052, 0.03), 0.026), ((0.022, -0.046, 0.042), 0.017), ((-0.02, -0.048, 0.02), 0.018)):
            pc.blob(c, r, segs=6, rings=4)
        line(pc, (0, -0.06, 0.052), lambda z: V((0, 0, z)), L, "White", ahead=-0.03, zs=(0.45,), tip=top + V((0, -0.004, 0.08)))
    rod = model("rod-tempest-a1", {"Grip": "#1B2140", "White": "#F2F8FC", "Ice": "#62B9F0", "Pale": "#DDF2FC", "Storm": "#4A5078"}, b)
    tip = top + V((0, 0, 0.1))

    def bolts(pc):                               # lightning down both sides of the chain, forking at every other link
        pc.mat = "Glow"
        for s, ph in ((-1, 0.0), (1, 1.9)):
            pts = [V((zig(j) + s * (half(j) * 1.05 + 0.004 * math.sin(3.1 * j + ph)), 0.006 * math.cos(2.3 * j + ph), z0 + (L - z0) * j / k)) for j in range(k + 1)]
            mids = []
            for j in range(k):
                mids += [pts[j], pts[j].lerp(pts[j + 1], 0.5) + V((s * 0.008 * (1 if j % 2 else -1), 0, 0))]
            mids.append(pts[-1])
            pc.tube(mids, [0.0036] * len(mids), sides=3, tip=True)
            for j in (1, 3, 5):
                f = mids[2 * j + 1]
                pc.tube([f, f + V((s * 0.026, 0.0, 0.014)), f + V((s * 0.036, 0.002, 0.036))], [0.0024, 0.0018, 0.001], sides=3, tip=True)
        lathe(pc, (0, 0, -0.124), [(0.0, -0.006), (0.016, -0.004), (0.017, 0.002), (0.0, 0.004)], n=6)

    def spark(pc):                               # the crown's spark: five jagged points
        pc.mat = "Glow"
        for d in (V((0, 0, 1)), V((0.8, 0.1, 0.35)), V((-0.75, -0.1, 0.25)), V((0.15, 0, -0.6)), V((-0.3, 0.2, 0.9))):
            d = d.normalized()
            side = d.cross(V((0, 1, 0))).normalized()
            pc.tube([tip, tip + d * 0.022 + side * 0.005, tip + d * 0.05], [0.007, 0.0045, 0.0], sides=3, tip=False)

    def gust(pc):
        pc.mat = "Light"
        pc.tube([V((0.055, -0.01, 0.42)), V((0.06, 0.014, 0.45)), V((0.05, 0.034, 0.48))], [0.005, 0.007, 0.002], sides=3, tip=True)
    axis = [V((0, 0, z0 - 0.02))] + joints + [tip]
    radii = [0.012] + [half(j if j < k else k - 1) for j in range(k + 1)] + [0.012]
    fx = [glow("Bolts", "#7FE9FF", bolts, flicker=1.0),
          glow("Spark", "#E4FBFF", spark, pivot=tuple(tip), pulse=0.2),
          light("Gust", "#A8E4FF", gust, pivot=(0, 0, 0.45), spin=3.0, bob=0.14, rate=0.4, **trail(0.02, (0.055, 0.014, 0.0))),
          aura_hug("Aura", "#3C7BFF", axis, radii, inflate=1.8)]
    return rod, fx, {"rodFx": "tempest-a1"}, particles("#D6F8FF", "sparkle", every=0.05, size=0.075, rise=0.5)


# ================================================================ the Titanium (rod-titanium round 3)
# David 2026-11-13 (Rods Titanium 2 review): "the texture for the material is not right, it should be titanium look and
# the rainbow glow should work like a texture and should still show that its the metal steel color, just when its hit
# in a angle you see the shade"; the awakening: "parts split open each section one by one ... 0 degreen 30 degreen 60
# degree so on ... you can add more sections too", "it should open from bottom to top and it should open angeled
# outwards with more smaller moving parts", "it hovers and floats ... spins aroudn the main energy beam like cw and ccw
# each layer rotating". The old model (round 2) in grey steel: one P_Polished material whose thin film shows only at
# grazing angles (modelMaterials.ts FILM_GRAZE). The blank is seven hexagonal sections, each three plates whose split
# turns 30 degrees a section; the awakened rod is the grip, the reel and the claws opened (its morph target `Closed`
# the shut ones), and its effect holds the sections (one mesh: each vertex's section and plate in its UV, moved in the
# vertex shader: components/game/character/RodSections.tsx) round a neon energy beam.
TI_L = 0.86                                     # the rim of the last section; its plates rise to a point above
TI_N = 7
TI_H = (TI_L - 0.06) / TI_N
TI_SECTIONS = [(0.06 + TI_H * i, 0.06 + TI_H * (i + 1), 0.031 - 0.0135 * i / (TI_N - 1), math.radians(30 * i)) for i in range(TI_N)]
TI_TIP = TI_L + 0.032
TI_GAP = math.radians(7)                        # each plate stops this short of its split: the panel line between plates
TI_FOOT, TI_INNER = 0.74, 0.62                  # a section narrows to its foot; a plate's inside, of its foot
TI_REEL = V((0, -0.062, 0.03))                  # the reel's hub
EPS = 2e-5                                      # the reel's halves never touch, closed (kit's weld would join them)


def hexr(r, a):
    """How far a hexagon of corner radius `r` (corners at 30 + 60k degrees) reaches at angle `a`."""
    c = round(a / (math.pi / 3)) * (math.pi / 3)
    return r * math.cos(math.pi / 6) / math.cos(a - c)


def ti_plate(pc, i, k, hollow):
    """Plate `k` of section `i`: a third of the hexagonal cup, narrow at its foot and flaring to its rim with a dark seam
    band under it, stopping TI_GAP short of the splits either side (their cut faces show as a groove). Closed (the rod)
    it is a wedge to the axis; `hollow` (the awakened rod's effect) it is a shell round the beam, a hair shorter so no
    face meets the next section's, each vertex's UV its section and the plate's middle angle (glTF, Y up)."""
    z0, z1, r, turn = TI_SECTIONS[i]
    top = i == TI_N - 1
    if hollow:
        z0, z1 = z0 + 0.0004, z1 - 0.0004
    a0, a1 = turn + k * TAU / 3 + TI_GAP, turn + (k + 1) * TAU / 3 - TI_GAP
    angs = [a0] + [c for c in (math.radians(30 + 60 * j) for j in range(-6, 12)) if a0 < c < a1] + [a1]
    ac = (a0 + a1) / 2
    uv = (i, 1.0 + ac) if hollow else None      # glTF's v = 1 - this = the plate's middle angle about glTF's Y
    at = lambda a, rr, z: pc.v(V((math.cos(a) * rr, math.sin(a) * rr, z)))
    prof = [(z0, TI_FOOT, "Body"), (z1 - 0.012, 1.0, "Seam"), (z1, 1.0, None)]
    rings = [[at(a, hexr(r, a) * s, z) for a in angs] for z, s, _ in prof]
    ref = V((math.cos(ac) * 0.6 * r, math.sin(ac) * 0.6 * r, (z0 + z1) / 2))
    f = lambda vs, m: (setattr(pc, "mat", m), pc.f(vs, ref, [uv] * len(vs) if uv else None))
    for (_, _, m), lo, hi in zip(prof, rings, rings[1:]):
        for j in range(len(angs) - 1):
            f([lo[j], lo[j + 1], hi[j + 1], hi[j]], m)
    rim, foot = rings[-1], rings[0]
    if top:                                      # the last section's plates rise to a point (apart, so none weld)
        apex = pc.v(V((math.cos(ac) * 0.0015, math.sin(ac) * 0.0015, TI_TIP)))
        for j in range(len(angs) - 1):
            f([rim[j], rim[j + 1], apex], "Body")
    if hollow:
        inner = [[at(a, hexr(r, a) * TI_FOOT * TI_INNER, z) for a in angs] for z in (z0, z1)]
        lo_in, hi_in = inner[0], ([apex] * len(angs) if top else inner[1])
        for j in range(len(angs) - 1):
            f([lo_in[j], lo_in[j + 1], hi_in[j + 1], hi_in[j]], "Inner")
            f([foot[j], foot[j + 1], lo_in[j + 1], lo_in[j]], "Body")
            if not top:
                f([rim[j], rim[j + 1], hi_in[j + 1], hi_in[j]], "Body")
        for e in (0, -1):                        # lighter than the shut rod's groove: seen whole once it floats
            f([lo_in[e]] + [rg[e] for rg in rings] + ([apex] if top else [hi_in[e]]), "Edge")
        ti_fin(f, pc, r, ac, z0, z1)
    else:
        a_lo, a_hi = pc.v(V((0, 0, z0))), (apex if top else pc.v(V((0, 0, z1))))
        for j in range(len(angs) - 1):
            if not top:                          # (the first section's foot sits on the grip: no face)
                f([rim[j], rim[j + 1], a_hi], "Body")
        for e in (0, -1):                        # past its seam ring (a hair inside the groove), for the Tool budget
            f([a_lo, foot[e], rim[e], a_hi], "Cut")


def ti_fin(f, pc, r, a, z0, z1):
    """A small fin down the middle of a floating plate (one of its smaller moving parts), standing out of its face."""
    d, t = V((math.cos(a), math.sin(a), 0)), V((-math.sin(a), math.cos(a), 0)) * 0.0011
    s = lambda z: TI_FOOT + (1 - TI_FOOT) * min(1.0, (z - z0) / (z1 - 0.012 - z0))
    lo, hi = z0 + 0.25 * (z1 - z0), z1 - 0.016
    base = [d * (hexr(r, a) * s(z) - 0.001) + V((0, 0, z)) for z in (lo, hi)]
    tip = d * (hexr(r, a) * s(hi) + 0.35 * r) + V((0, 0, hi - 0.006))
    pts = [[pc.v(p + t * side) for p in (base[0], base[1], tip)] for side in (-1, 1)]
    f(pts[0], "Fin")
    f(pts[1], "Fin")
    for j in range(3):
        f([pts[0][j], pts[0][(j + 1) % 3], pts[1][(j + 1) % 3], pts[1][j]], "Fin")


def turned(pts, root, axis, ang):
    m = Matrix.Rotation(ang, 3, axis)
    return [V(root) + m @ (V(p) - V(root)) for p in pts]


def ti_body(op, sections=True):
    """The rod at an opening `op` (0 shut, 1 open: the reel's halves apart along its axle, the claws spread), with its
    sections shut, or without them (the awakened rod's are its effect's)."""
    def b(pc):
        grip(pc, [(0, -0.112), (0.0195, -0.105), (0.0195, 0.03), (0.016, 0.06)], n=6, mat=lambda band, q: "Pommel" if band == 0 else "Grip")
        pc.mat = "Pommel"                        # the hex pommel
        lathe(pc, (0, 0, -0.112), [(0.016, 0.0), (0.021, -0.012), (0.0, -0.03)], n=6)
        if sections:
            for i in range(TI_N):
                for k in range(3):
                    ti_plate(pc, i, k, False)
        else:                                    # the stub the floating sections leave: a collar where the beam starts
            pc.mat = "Seam"
            lathe(pc, (0, 0, 0.06), [(0.0, -0.004), (0.02, -0.004), (0.02, 0.006), (0.0, 0.006)], n=6, phase=math.pi / 6)
        y, z = TI_REEL.y, TI_REEL.z
        pc.mat = "Reel"
        pc.tube([(0, -0.016, z), (0, y + 0.016, z)], [0.008, 0.008], sides=4, tip=False)
        d = op * 0.016                           # the reel's halves part along its axle
        for s in (-1, 1):
            lathe(pc, (s * (d + EPS), y, z), [(0.0, 0.0), (0.05, 0.004), (0.042, 0.022), (0.0, 0.024)], n=6, axis=(s, 0, 0), phase=math.pi / 6)
        for a in (0.4, 2.5, 4.6):                # three spikes round its rim, on its outer half
            dd = V((0, math.cos(a), math.sin(a)))
            pc.tube([V((d + 0.012, y, z)) + dd * 0.045, V((d + 0.012, y, z)) + dd * 0.088], [0.009, 0.0], sides=3, tip=False)
        pc.mat = "Claw"                          # the claws: two down and back, one up and back; open, they spread
        for s in (-1, 1):
            root = V((s * 0.02, y + 0.01, z - 0.01))
            pts = [root, V((s * 0.078, y + 0.065, z - 0.125)), V((s * 0.06, y + 0.12, z - 0.25))]
            loft(pc, turned(pts, root, (0, 1, 0), -s * 0.32 * op), [(0.021, 0.005), (0.025, 0.0045), (0.004, 0.002)], sides=4, tip=True, cap=True, ref=(0, 0, 1))
        root = V((0, y + 0.035, z + 0.015))
        pts = [root, V((0, y + 0.09, z + 0.07)), V((0, y + 0.125, z + 0.15)), V((0, y + 0.115, z + 0.22))]
        loft(pc, turned(pts, root, (1, 0, 0), -0.3 * op), [(0.005, 0.018), (0.005, 0.022), (0.004, 0.013), (0.002, 0.004)], sides=4, tip=True, cap=True, ref=(1, 0, 0))
        line(pc, (0, y, z + 0.02), lambda zz: V((0, 0, zz)), TI_L, "Line", ahead=-0.022, tip=V((0, -0.004, TI_L + 0.03)))
    return b


def metal(ob, colour, deg=14.0):
    """Polished titanium: each corner's COLOR_0 from `colour(position, part, normal)` (the part a build-time material
    name), then one `P_Polished` material for the whole rod (one draw in a hand) with a thin film over it (glTF
    KHR_materials_iridescence; the game shows it only at grazing angles, modelMaterials.ts FILM_GRAZE), and every
    edge sharper than `deg` a hard edge."""
    import bmesh
    me = ob.data
    col, tags = me.color_attributes["Color"], [m.name.split("_")[-1] for m in me.materials]
    for poly in me.polygons:
        for li in poly.loop_indices:
            col.data[li].color = (*colour(me.vertices[me.loops[li].vertex_index].co, tags[poly.material_index], poly.normal), 1.0)
        poly.material_index = 0
    while len(me.materials) > 1:
        me.materials.pop()
    shared = bpy.data.materials.get("P_Polished")          # one material for the rods made in this run
    if shared:
        me.materials[0] = shared
    else:
        mat = me.materials[0]
        mat.name = "P_Polished"
        bs = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bs.inputs["Base Color"].default_value = (1, 1, 1, 1)
        bs.inputs["Metallic"].default_value, bs.inputs["Roughness"].default_value = 0.85, 0.26    # modelMaterials.ts polished
        bs.inputs["Thin Film Thickness"].default_value, bs.inputs["Thin Film IOR"].default_value = 420.0, 1.8
        # The exporter reads the film's amount off this group; it finds it only in the material as authored, which it
        # keeps (instead of an inlined copy that drops the group) when the group has an Occlusion input (Blender 5.2).
        ng = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        for name in ("Iridescence Factor", "Iridescence Thickness Minimum", "Occlusion"):
            ng.interface.new_socket(name, in_out="INPUT", socket_type="NodeSocketFloat")
        out = mat.node_tree.nodes.new("ShaderNodeGroup")
        out.node_tree = ng
        out.inputs["Iridescence Factor"].default_value, out.inputs["Iridescence Thickness Minimum"].default_value = 1.0, 160.0
    bm = bmesh.new()
    bm.from_mesh(me)
    for e in bm.edges:
        e.smooth = len(e.link_faces) == 2 and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0) < math.radians(deg)
    bm.to_mesh(me)
    bm.free()
    return ob


TI_STEEL = {"Body": "#A7ADB4", "Seam": "#40444B", "Cut": "#1F2228", "Edge": "#5A6068", "Inner": "#7A8088", "Fin": "#C4C9CF", "Grip": "#363A41",
            "Pommel": "#80868D", "Reel": "#8F959C", "Claw": "#9CA2A9", "Line": "#E6ECF0"}


def ti_colour(p, part, n):
    """Grey titanium: each hex flat a touch lighter or darker than the next (so the facets read as ground metal), the
    blank a little brighter toward the tip, the seams, the cut faces and the plates' insides dark."""
    c = kit.lin(TI_STEEL[part])
    if part not in ("Body", "Claw", "Reel", "Fin"):
        return c
    flat = math.cos(3 * math.atan2(n.y, n.x)) if abs(n.z) < 0.6 else 0.0
    k = (1.0 + 0.09 * flat) * (0.94 + 0.1 * min(1.0, max(0.0, p.z / TI_L)))
    return tuple(min(1.0, x * k) for x in c)


TI_MATS = {k: "#FFFFFF" for k in TI_STEEL}


def titanium():
    """Epic, the Titanium (shut): seven stacked hexagonal sections of grey titanium, a hex reel with three spikes,
    three claws off the reel. Metal, not magic: no effect."""
    return metal(model("rod-titanium", TI_MATS, ti_body(0.0)), ti_colour)


def titanium_a1():
    """The Titanium awakened: the grip, the opened reel and the spread claws (its morph target `Closed` the shut ones,
    so the awakening opens them), and its effect: the sections floating round a neon energy beam. `Sections` is one lit
    mesh of the 21 plates (its `sections` extra each section's foot height and pivot radius, glTF units; RodSections.tsx
    opens, spins, floats and lags them), `Core` the beam (glow) with `Beam` its neon haze (light), `Rings` hexagons of
    its light round it, turning (glow, motion)."""
    shut = model("rod-titanium-shut", TI_MATS, ti_body(0.0, sections=False))
    rod = metal(model("rod-titanium-a1", TI_MATS, ti_body(1.0, sections=False)), ti_colour)
    assert len(shut.data.vertices) == len(rod.data.vertices), "the closed and open bodies must match vertex for vertex"
    rod.shape_key_add(name="Basis")
    key = rod.shape_key_add(name="Closed")
    key.value = 0.0                              # open as it ships (glTF weights)
    for kv, v in zip(key.data, shut.data.vertices):
        kv.co = v.co
    bpy.data.objects.remove(shut)

    def plates(pc):
        for i in range(TI_N):
            for k in range(3):
                ti_plate(pc, i, k, True)
    sections = metal(model("Sections", TI_MATS, plates), ti_colour)
    sections["sections"] = [x for z0, _, r, _ in TI_SECTIONS for x in (z0 + 0.0004, TI_FOOT * r * math.cos(math.pi / 6))]

    def core(pc):                                # the beam up the blank, and the reel's core between its halves
        pc.mat = "Glow"
        loft(pc, [V((0, 0, z)) for z in (0.05, 0.33, 0.6, TI_TIP + 0.02)], [0.0068, 0.0058, 0.0047, 0.003], sides=6, phase=math.pi / 2, tip=True, cap=True)
        lathe(pc, TI_REEL, [(0.0, -0.012), (0.04, -0.01), (0.04, 0.01), (0.0, 0.012)], n=6, axis=(1, 0, 0), phase=math.pi / 6)

    def beam(pc):                                # its neon haze
        pc.mat = "Light"
        loft(pc, [V((0, 0, z)) for z in (0.045, 0.33, 0.6, TI_TIP + 0.04)], [0.0125, 0.0108, 0.0088, 0.004], sides=6, phase=math.pi / 2, tip=True, cap=True)

    def rings(pc):                               # hexagons of light round the beam, one in each section, turning
        pc.mat = "Glow"
        for z0, z1, r, _ in TI_SECTIONS:
            rr = 0.42 * r
            pc.tube([V((math.cos(TAU * k / 6 + math.pi / 2) * rr, math.sin(TAU * k / 6 + math.pi / 2) * rr, (z0 + z1) / 2)) for k in range(6)],
                    [0.0022] * 6, sides=3, closed_loop=True)
    fx = [sections,
          glow("Core", "#C8F7FF", core),
          light("Beam", "#2F86FF", beam),
          glow("Rings", "#7FE6FF", rings, spin=1.1)]
    return rod, fx, {"rodFx": "titanium-a1", "fxRoom": 0.0}, {}   # the beam is inside it: it takes the stage as the shut rod does


# ================================================================ build
ROD_FILES = {"carrot": "rod-carrot", "precision": "rod-precision", "training": "rod-training", "cedar": "rod-2", "glass": "rod-3",
             "riptide": "rod-riptide", "tidewarden": "rod-5", "tempest": "rod-tempest", "titanium": "rod-titanium",
             "titanium-a1": "rod-titanium-a1", "tidewarden-a1": "rod-tidewarden-a1", "tempest-a1": "rod-tempest-a1"}
BUILD = {"carrot": carrot, "precision": precision, "training": training, "cedar": cedar, "glass": glass,
         "riptide": riptide, "tidewarden": tidewarden, "tempest": tempest, "titanium": titanium,
         "titanium-a1": titanium_a1, "tidewarden-a1": lambda: tidewarden(True), "tempest-a1": tempest_a1}
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
