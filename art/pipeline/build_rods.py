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
def aura_shell(pc, top, r=0.075):
    """The aura's shell: a soft spindle round the whole rod (RodAura draws it brightest where it faces you)."""
    pc.mat = "Aura"
    lathe(pc, (0, 0.01, -0.14), [(0, 0.0), (r * 0.55, 0.06), (r, 0.22), (r, top * 0.6), (r * 0.7, top * 0.9), (0, top + 0.22)], n=10)


def tidewarden():
    """Epic, rod-5, remodelled from David's epic-tidewarden-ref.png (rods round 9 and 9b; traced by trace_refs.py): a
    golden trident. The head is the sketch's own outline smoothed into clean curves (three prongs, the middle tallest,
    the two round cut-outs, the side spurs and crescents), made solid: bevelled to a fine edge all round and raised along
    its medial axis, a ridge down each prong and the body, so it turns well and reads edge-on. Its colour runs in the
    vertices: gold, each prong's tip fading through mint into blue as sketched. Stylised to read at game size: the head
    1.2 times the sketch's (the tip where it was, the shaft a little shorter), the shaft thicker than drawn. A teal wrap
    at the butt, a four-point star cap with its diamond cut. The line leaves the middle prong's tip, so no reel. Its
    effect, on the effects library: the ribbon of water wrapping the shaft under the head with foam on its edges and
    flecks, a streamer and a wisp peeling off as drawn, foam where they crash, drops trailing away (water); the teal veins
    as continuous branching cracks lying on the relief (glow). No discs, no aura."""
    from traced_refs import TIDEWARDEN as T
    R = 0.0095                                   # the shaft (traced 0.0064): stylised over measured, for the pixel finish
    K, HALF, BEVEL = 1.2, 0.0058, 16.0           # the head's scale, its half thickness at the ridge, the bevel's width (px)
    tip, neck0, star = T["tip"][1], T["neck"][1], T["star"]
    neck = tip - (tip - neck0) * K
    at = lambda x, z: (x * K, neck + (z - neck0) * K)
    lift = lambda d, ridge=False: HALF * min(1.0, d / BEVEL) ** 0.75 + (0.0012 if ridge and d > 0 else 0.0)
    H = T["head"]
    gold, mint, blue = (kit.lin(c) for c in ("#E2C47F", "#A9D9C2", "#5FA8DA"))
    shade = {}

    def b(pc):
        # the head: the front raised toward -Y, the back the same toward +Y, meeting at the outline (one closed solid)
        pc.mat = "Gold"
        front, back = [], []
        for (x, z), d, r, bd in zip(H["points"], H["depth"], H["ridge"], H["band"]):
            X, Z = at(x, z)
            h = lift(d, r)
            front.append(pc.v((X, -h, Z)))
            back.append(pc.v((X, h, Z)))
            u, w = min(bd, 1.0), max(bd - 1.0, 0.0)
            col = [g + (m - g) * u + (bl - m) * w for g, m, bl in zip(gold, mint, blue)]
            shade[(round(X, 4), round(Z, 4))] = col
        for t in H["tris"]:
            c = sum((V(at(*H["points"][i])).to_3d() for i in t), V((0, 0, 0))) / 3
            mid = V((c.x, 0, c.y))
            pc.f([front[i] for i in t], mid + V((0, 1, 0)))
            pc.f([back[i] for i in t], mid - V((0, 1, 0)))
        pc.mat = "Shaft"
        pc.tube([(0, 0, star["centre"]), (0, 0, 0.3), (0, 0, neck + 0.02)], [R, R * 0.95, R * 0.9], sides=6, tip=False)
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
        pc.tube([V((math.cos(TAU * k / 8) * (R + 0.005), math.sin(TAU * k / 8) * (R + 0.005), -0.03 + 0.006 * math.cos(TAU * k / 8))) for k in range(8)], [0.0036] * 8, sides=3, closed_loop=True)
        pc.tube(helix((0, 0, -0.026), (0, 0, 0.028), R + 0.0015, R + 0.0015, 1.25, 11), [(0.005, 0.0016)] * 11, sides=3, tip=False, cap=False, up=V((0, 0, 1)))
    rod = model("rod-5", {"Gold": "#FFFFFF", "Shaft": "#E0C07E", "Teal": "#3DB8B6"}, b, grad=(0.85, 1.0))
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

    # ---- the effect: the veins (glow) and the water (the library's Water type)
    vv, vf = [], []
    for line in T["veins"]:                      # each crack a thin ribbon lying just over the relief, both faces
        pts = [(V(at(x, z)).to_3d(), d) for x, z, d in line]
        for side in (-1, 1):
            k0 = len(vv)
            for i, (p, d) in enumerate(pts):
                a_, b_ = pts[max(i - 1, 0)][0], pts[min(i + 1, len(pts) - 1)][0]
                t = (b_ - a_).normalized() if (b_ - a_).length > 1e-6 else V((0, 1, 0))
                n = V((-t.y, t.x, 0)) * 0.0016 * K * (0.6 if i in (0, len(pts) - 1) else 1.0)
                y = side * (lift(d) + 0.0008)
                vv += [V((p.x + n.x, y, p.y + n.y)), V((p.x - n.x, y, p.y - n.y))]
            vf += [(k0 + 2 * i, k0 + 2 * i + 1, k0 + 2 * i + 3, k0 + 2 * i + 2) for i in range(len(pts) - 1)]
    veins = sheet("Veins", "Glow", "#5FE3D8", vv, vf)
    # the ribbon: down from under the head round the shaft (as drawn, a turn and a half), then peeling off to the right
    # and down as a streamer; past that, more of it winding further down the shaft, shown only with strength
    shift = neck - neck0                          # the drawn water and drops follow the head down the shaft
    top, wrap_end = neck - 0.014, neck - 0.1
    rings, gate = [], []
    def band(a, z, r, w, da, dz):
        """Across a ribbon lying on the shaft at angle a, height z: square to its run (da rad and dz m a step)."""
        out, run = V((math.cos(a), math.sin(a), 0)), V((-math.sin(a) * r * da, math.cos(a) * r * da, dz)).normalized()
        across = out.cross(run).normalized()
        c = out * r + V((0, 0, z))
        return [c + across * (w * (j / 2 - 1)) + out * (0.0025 * math.sin(math.pi * j / 4)) for j in range(5)]
    N, TURNS = 18, 1.0
    for i in range(N):                            # the wrap as drawn: a ribbon winding down the shaft under the head
        u = i / (N - 1)
        rings.append(band(TAU * TURNS * u - 0.6, top + (wrap_end - top) * u, R + 0.007, 0.022, TAU * TURNS / (N - 1), (wrap_end - top) / (N - 1)))
        gate.append(0.0)
    a_end = TAU * TURNS - 0.6
    base = V((math.cos(a_end) * (R + 0.007), math.sin(a_end) * (R + 0.007), wrap_end))

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
    cuts = [strip(base, base + V((0.07, -0.006, -0.036)), 0.017, 9, sag=0.008, taper=(1.0, 0.4))]
    cuts.append(strip((0.058, -0.004, neck - 0.125), (0.11, -0.006, neck - 0.165), 0.01, 6, sag=0.007, taper=(1.0, 0.4)))
    cuts.append(strip((0.14, -0.002, neck - 0.095), (0.182, -0.002, neck - 0.103), 0.008, 5, taper=(0.5, 1.0)))
    M = 30
    for i in range(M):                            # more wrap, further down the shaft, shown with strength (its own strip)
        u = i / (M - 1)
        rings.append(band(a_end + 0.4 + TAU * 3.0 * u, wrap_end - 0.012 - 0.22 * u, R + 0.006, 0.013, TAU * 3.0 / (M - 1), -0.22 / (M - 1)))
        gate.append(0.02 + 0.98 * u)
    body = water("Tide", "#2E9CC8", rings, gate, cut=tuple(cuts))
    # foam: the streamer's end crashing, the wisp's end, and flecks of foam riding the wrap's edges
    blobs = [(base + V((0.072, -0.008, -0.04)), 0.011, 1.0), (V((0.112, -0.008, neck - 0.167)), 0.008, 0.7)]
    for k in range(5):                            # flecks on the wrap, on its side toward you
        a = TAU * TURNS * (0.1 + 0.18 * k) - 0.6
        if math.sin(a) < 0.2:
            blobs.append((V((math.cos(a) * (R + 0.011), math.sin(a) * (R + 0.011) - 0.002, top + (wrap_end - top) * (0.1 + 0.18 * k) - 0.012)), 0.0045, 0.3))
    fv, ft, fd, fp, fc = [], [], [], [], []
    for n, (c, r, crown) in enumerate(blobs):
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
        fp += [0.23 * n + 0.1] * 13
        fc += [crown] * 13
    froth = foam("Crash", "#F4FEFF", fv, ft, fd, fp, fc)
    D = [((0.15, 0, 0.446), 0.005, 0.5), ((0.092, 0, 0.338), 0.0055, 0.5), ((0.145, 0, 0.40), 0.004, 0.2), ((0.108, 0, 0.30), 0.004, 0.8),
         ((0.19, 0, 0.43), 0.0045, 0.65), ((0.074, 0, 0.39), 0.004, 0.35)]           # the drops as drawn (traced positions)
    drops = [((x, y, z + shift), sz, ph, 0.3 + 0.1 * i, False) for i, ((x, y, z), sz, ph) in enumerate(D)]
    drops += [((0.06 + 0.022 * (i % 4), 0.01 * ((i % 3) - 1), neck - 0.11 - 0.035 * i), 0.0045, (0.37 * i) % 1, 0.5 + 0.06 * i, True) for i in range(8)]
    spray_ = spray("Drops", "#4FC3DD", drops)
    # the head's face to the holder's side (a quarter turn about the shaft): held, the third-person camera sees its face,
    # not its edge (the sketch's own face is front-on in /lab/fx?study=tidewarden, which turns it back)
    for ob in [rod, veins, body, froth, spray_]:
        ob.data.transform(Matrix.Rotation(math.pi / 2, 4, "Z"))
    return rod, [veins, body, froth, spray_], {"rodFx": "tidewarden", "fxRoom": 0.04}, {}


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


def reserved_slate():
    """Reserved (David 2026-11-05: "the current titanium rod shuold be something else it look nice ... the current is
    reserved for smth else"): the Titanium as it was until rod-titanium round 1, out of the roster, for a rod David names
    later (its reference, epic-titanium-ref.png, goes with it). Armour more than rod: a dark slate blank of stacked hexagonal cups, a
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
    rod = model("rod-reserved-slate", {"Slate": "#5A6474", "Dark": "#2D323C", "Lilac": "#CDB6EE"}, b)

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
    return rod, fx, {"rodFx": "reserved-slate"}, {"spark": "#E2CCFF", "sparkSprite": "glow", "sparkEvery": 0.11, "sparkSize": 0.055, "sparkRise": 0.3}


# ================================================================ the Titanium (rod-titanium round 1)
# David 2026-11-05, epic-titanium-metal-ref.png: "titanium reference, clean like cnc machined rod, thick too and reflects
# this glow because its metal". Machined titanium: one P_Polished material (modelMaterials.ts MATERIAL_PRESETS: polished metal, so
# it reflects the stage's studio room and the island's sky), its colour in COLOR_0: the anodised run of the reference,
# pale steel at the point through straw gold and bronze to blue and violet at the butt. Flat ground facets, crisp edges.
ANODISED = [(0.0, "#DCE3E8"), (0.12, "#E3D592"), (0.26, "#C9A443"), (0.4, "#A6873C"), (0.5, "#74508F"), (0.6, "#5246C8"),
            (0.76, "#2C55E0"), (1.0, "#33279C")]
TI_L = 0.875                                    # the point


def ramp(stops, u):
    u = min(1.0, max(0.0, u))
    for (u0, c0), (u1, c1) in zip(stops, stops[1:]):
        if u <= u1:
            t = (u - u0) / (u1 - u0)
            return tuple(x + (y - x) * t for x, y in zip(kit.lin(c0), kit.lin(c1)))
    return kit.lin(stops[-1][1])


def oct_(z, r):
    """A station of a machined body: a regular octagon."""
    return (z, r, r, TAU / 16)


def dia(z, rx, ry, c=0.2):
    """A station ground to a diamond: four wide flats meeting at chamfered ridges (c the chamfer's half angle)."""
    return (z, rx, ry, c)


def machined(pc, stations, tip):
    """A machined body up +Z through (z, rx, ry, c) stations, eight points each on an ellipse (the faces between
    them alternating ground flats and chamfers), flat face to flat face, a flat foot, every face of the last run to
    the ground point `tip`."""
    rings = [[pc.v(V((math.cos(a) * rx, math.sin(a) * ry, z))) for k in range(4) for a in (k * TAU / 4 - c, k * TAU / 4 + c)]
             for z, rx, ry, c in stations]
    for i in range(len(rings) - 1):
        mid = V((0, 0, (stations[i][0] + stations[i + 1][0]) / 2))
        for k in range(8):
            pc.f([rings[i][k], rings[i][(k + 1) % 8], rings[i + 1][(k + 1) % 8], rings[i + 1][k]], mid)
    foot, end = pc.v(V((0, 0, stations[0][0]))), pc.v(V(tip))
    for k in range(8):
        pc.f([rings[0][(k + 1) % 8], rings[0][k], foot], V((0, 0, stations[0][0] + 0.02)))
        pc.f([rings[-1][k], rings[-1][(k + 1) % 8], end], V((0, 0, stations[-1][0] - 0.01)))


FINISHES = {"P_Polished": (0.85, 0.14), "P_Paint": (0.0, 0.45)}   # metallic, roughness (modelMaterials.ts MATERIAL_PRESETS)


def metal(ob, colour, deg=14.0, finish="P_Polished"):
    """Machined metal: each corner's COLOR_0 from `colour(position, part, normal)` (the part a build-time material name), then
    one preset material for the whole rod (one draw in a hand: `P_Polished`, or `P_Paint` for painted armour), and
    every edge sharper than `deg` a hard edge."""
    import bmesh
    me = ob.data
    col, tags = me.color_attributes["Color"], [m.name.split("_")[-1] for m in me.materials]
    for poly in me.polygons:
        for li in poly.loop_indices:
            col.data[li].color = (*colour(me.vertices[me.loops[li].vertex_index].co, tags[poly.material_index], poly.normal), 1.0)
        poly.material_index = 0
    while len(me.materials) > 1:
        me.materials.pop()
    shared = bpy.data.materials.get(finish)                # one material per finish for the rods made in this run
    if shared:
        me.materials[0] = shared
    else:
        me.materials[0].name = finish
        bs = next(n for n in me.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bs.inputs["Base Color"].default_value = (1, 1, 1, 1)
        bs.inputs["Metallic"].default_value, bs.inputs["Roughness"].default_value = FINISHES[finish]
    bm = bmesh.new()
    bm.from_mesh(me)
    for e in bm.edges:
        e.smooth = len(e.link_faces) == 2 and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0) < math.radians(deg)
    bm.to_mesh(me)
    bm.free()
    return ob


# Each wide flat of a ground body, by the quarter it faces: its shift along the anodised run and its brightness. Ground
# titanium's oxide differs flat to flat, as in the reference: one flat bright straw and steel, the next deep blue.
FLATS = ((0.0, 1.1), (0.22, 0.55), (0.08, 1.0), (0.26, 0.62))


def ground(u, n, lift=0.5):
    """A machined body's colour at `u` along the anodised run (0 the point, 1 the butt) on a face of normal `n`: each
    flat its own (FLATS), the chamfers between them polished brighter, a crisp line of light down every edge."""
    c = ramp(ANODISED, u)
    if abs(n.z) >= 0.6:
        return c
    a = math.degrees(math.atan2(n.y, n.x)) % 360.0
    if min(a % 90.0, 90.0 - a % 90.0) < 12.0:
        return tuple(x + (1.0 - x) * lift for x in c)
    shift, gain = FLATS[int(a // 90.0) % 4]
    k = min(1.0, u * 3.0)                                    # the point stays pale steel on every flat, as the reference's
    return tuple(min(1.0, x * (1.0 + (gain - 1.0) * k)) for x in ramp(ANODISED, u + shift * k))


def ti_reel_colour(c, r):
    """The reel heat-coloured from its hub out, as anodised bolts are: violet at the hub, bronze and straw at the rim."""
    return lambda p: ramp(ANODISED, 1.0 - 0.78 * min(1.0, math.hypot(p.y - c[1], p.z - c[2]) / r))


def titanium():
    """Epic (David 2026-11-05: "make a new model of the titanium thats closer related", epic-titanium-metal-ref.png).
    A thick machined bar: a chamfered octagonal pommel and grip with a machined groove, a collar for the reel seat, a
    blank ground to a diamond that tapers and flattens into a ground point, a ferrule ring where its two halves meet, a
    machined reel. Its effect is quiet (it's metal, not magic): a glint at the point and a few glints off it."""
    y, z, r = -0.105, 0.05, 0.045              # the reel: hub, height, rim
    st = [oct_(-0.126, 0.027), oct_(-0.12, 0.039), oct_(-0.1, 0.039), oct_(-0.095, 0.033),               # the pommel, chamfered
          oct_(-0.09, 0.0345), oct_(-0.052, 0.036), oct_(-0.048, 0.031), oct_(-0.040, 0.031), oct_(-0.036, 0.036),
          oct_(-0.004, 0.036), oct_(0.0, 0.031), oct_(0.008, 0.031), oct_(0.012, 0.036),                     # two machined grooves
          oct_(0.020, 0.036), oct_(0.026, 0.047), oct_(0.076, 0.047), oct_(0.084, 0.04),                     # the reel seat collar
          dia(0.09, 0.062, 0.046), dia(0.40, 0.058, 0.043),                                                  # thick bar stock, ground
          oct_(0.405, 0.068), oct_(0.423, 0.068), dia(0.428, 0.057, 0.042),                                  # the ferrule ring
          dia(0.62, 0.054, 0.039), dia(0.70, 0.05, 0.021)]                                                   # ground flat into a broad point

    def b(pc):
        pc.mat = "Body"
        machined(pc, st, (0, 0, TI_L))
        pc.mat = "Reel"
        pc.tube([(0, -0.03, z), (0, y + 0.012, z)], [0.009, 0.009], sides=4, tip=False)
        lathe(pc, (0, y, z), [(0.0, -0.017), (r * 0.82, -0.017), (r, -0.011), (r * 0.86, -0.005), (r * 0.86, 0.005), (r, 0.011), (r * 0.82, 0.017), (0.0, 0.017)],
              n=10, axis=(1, 0, 0), phase=math.pi / 10)
        pc.tube([(0.018, y, z), (0.03, y + 0.004, z - 0.02)], [(0.0045, 0.0025), (0.0045, 0.0025)], sides=4, tip=False)   # the crank, flat
        lathe(pc, (0.03, y + 0.004, z - 0.02), [(0.0, -0.0), (0.0065, 0.002), (0.0065, 0.011), (0.0, 0.013)], n=6, axis=(1, 0, 0))
        line(pc, (0, y, z + r * 0.86), lambda zz: V((0, 0, zz)), TI_L, "Line", ahead=-0.056, zs=(0.42,), tip=V((0, -0.012, 0.84)))
    rod = model("rod-titanium", {"Body": "#FFFFFF", "Reel": "#FFFFFF", "Line": "#FFFFFF"}, b)
    reel_col = ti_reel_colour((0, y, z), r)
    metal(rod, lambda p, part, n: kit.lin("#E6ECF0") if part == "Line" else reel_col(p) if part == "Reel" else ground(((TI_L - p.z) / (TI_L + 0.126)) ** 1.6, n))

    tip = V((0, 0, TI_L))

    def glint(pc):                               # a glint on the point: six thin rays, the long ones up and across
        pc.mat = "Light"
        for d, n in ((V((0, 0, 1)), 0.05), (V((0, 0, -1)), 0.03), (V((1, 0, 0)), 0.035), (V((-1, 0, 0)), 0.035), (V((0, 1, 0)), 0.022), (V((0, -1, 0)), 0.022)):
            pc.tube([tip, tip + d * n * 0.3, tip + d * n], [0.0035, 0.0022, 0.0], sides=3, tip=False)
    fx = [light("Glint", "#F4EAC8", glint, pivot=tuple(tip), pulse=0.35)]
    return rod, fx, {"rodFx": "titanium"}, particles("#FFF2D2", "sparkle", every=0.5, size=0.04, rise=0.12)


def inset(outline, d):
    """A convex outline (y, z) moved in by d (a plate's face inside its chamfer)."""
    pts = [V(p) for p in outline]
    out = []
    for i, p in enumerate(pts):
        e0, e1 = (p - pts[i - 1]).normalized(), (pts[(i + 1) % len(pts)] - p).normalized()
        n0, n1 = V((-e0.y, e0.x)), V((-e1.y, e1.x))
        bis = (n0 + n1).normalized()
        out.append(p + bis * d / max(0.25, bis.dot(n0)))
    return out


def ccw(outline):
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(outline, outline[1:] + outline[:1]))
    return list(outline) if area > 0 else list(reversed(outline))


def plate(pc, outline, t, ch, y0=0.0, tags=("Edge", "Wall", "Face")):
    """A hard-edged armour plate: a convex outline (x, z) in the rod's broad plane (the one the follow camera and the
    icon see), `t` thick front to back about y0, every edge chamfered `ch`; `tags` its chamfers, the walls between
    them (its panel lines) and its two faces."""
    outline = ccw(outline)
    inner = inset(outline, ch)
    lay = lambda pts, y: [pc.v(V((p[0], y, p[1]))) for p in pts]
    a, b_, c_, d_ = lay(inner, y0 - t / 2), lay(outline, y0 - t / 2 + ch), lay(outline, y0 + t / 2 - ch), lay(inner, y0 + t / 2)
    mid = V((sum(p[0] for p in outline) / len(outline), y0, sum(p[1] for p in outline) / len(outline)))
    n = len(outline)
    for ring0, ring1, m in ((a, b_, tags[0]), (b_, c_, tags[1]), (c_, d_, tags[0])):
        pc.mat = m
        for k in range(n):
            pc.f([ring0[k], ring0[(k + 1) % n], ring1[(k + 1) % n], ring1[k]], mid)
    pc.mat = tags[2]
    pc.f(list(reversed(a)), mid)
    pc.f(d_, mid)


# The awakened Titanium's plates, (x, z) in its broad plane, thickness, chamfer (and y, off the middle): the long blade
# down its right, two stepped plates on its left, cheeks over the seat front and back, a fin sweeping down off it
# (epic-titanium-awakened-ref.png, loosely, its profile turned to face the camera).
A1_PLATES = [([(0.008, 0.10), (0.06, 0.15), (0.072, 0.35), (0.044, 0.395), (0.008, 0.38)], 0.026, 0.005),            # the right, stepped
             ([(0.008, 0.39), (0.054, 0.42), (0.06, 0.62), (0.036, 0.76), (0.008, 0.835)], 0.02, 0.0045),
             ([(-0.008, 0.11), (-0.056, 0.17), (-0.064, 0.30), (-0.036, 0.37), (-0.008, 0.35)], 0.03, 0.005),     # the left
             ([(-0.007, 0.43), (-0.044, 0.47), (-0.048, 0.6), (-0.024, 0.67), (-0.007, 0.64)], 0.024, 0.0045),
             ([(-0.028, 0.03), (0.028, 0.03), (0.03, 0.1), (0.016, 0.3), (-0.026, 0.1)], 0.008, 0.0025, 0.026),     # its cheeks
             ([(-0.028, 0.03), (0.028, 0.03), (0.03, 0.1), (0.016, 0.3), (-0.026, 0.1)], 0.008, 0.0025, -0.026),
             ([(0.012, 0.12), (0.04, 0.11), (0.092, -0.03), (0.06, 0.03), (0.012, 0.08)], 0.009, 0.0025)]          # the fin


def titanium_a1():
    """The Titanium awakened (David 2026-11-05, epic-titanium-awakened-ref.png: "like this type of hard edge looks like
    this reference loosely as a rod and the awakenign will have the blue energy thing built in should be very meccha
    looking"): the machined rod armoured. Stepped hard-edged plates along it (pale painted armour, its chamfers and
    walls dark: the panel lines), a ring hub where the reel was, a guard bar round the hand. Its energy is all in the effect: cyan
    lines in the plates' panels (glow, flicker), a core in the hub that swells (glow, pulse), solid energy blades under
    the front plates (glow, pulse), and motes. No aura: the plates stay solid, never washed pale."""
    y, z = -0.06, 0.05                          # the ring hub, on the front of the seat's cheek, facing the camera
    st = [oct_(-0.124, 0.02), oct_(-0.103, 0.025), oct_(-0.099, 0.0205),
          oct_(-0.093, 0.0215), oct_(0.020, 0.0225), oct_(0.025, 0.0275), oct_(0.082, 0.0275), oct_(0.088, 0.0215),
          dia(0.094, 0.019, 0.017), dia(0.70, 0.0115, 0.0095), dia(0.795, 0.0095, 0.0056)]

    def b(pc):
        pc.mat = "Body"
        machined(pc, st, (0, 0, TI_L))
        for outline, t, ch, *x0 in A1_PLATES:
            plate(pc, outline, t, ch, *x0)
        pc.mat = "Hub"                           # the ring hub, hard-edged, round the energy core
        pc.tube([(0, -0.016, z), (0, y + 0.006, z)], [0.008, 0.008], sides=4, tip=False)
        lathe(pc, (0, y, z), [(0.026, -0.011), (0.042, -0.013), (0.05, -0.007), (0.05, 0.007), (0.042, 0.013), (0.026, 0.011), (0.026, -0.011)],
              n=8, axis=(0, 1, 0), phase=math.pi / 8)
        pc.mat = "Wall"                          # the knuckle guard, from the seat round the hand to the pommel
        loft(pc, [V((-0.02, -0.004, 0.024)), V((-0.058, -0.004, -0.028)), V((-0.052, -0.004, -0.1)), V((-0.018, -0.004, -0.122))],
             [(0.0085, 0.006)] * 4, sides=4, tip=False, cap=True, phase=math.pi / 4, ref=(0, 1, 0))
        line(pc, (0, y, z + 0.05), lambda zz: V((0, 0, zz)), TI_L, "Line", ahead=-0.024, zs=(0.42,), tip=V((0, -0.006, 0.81)))
    rod = model("rod-titanium-a1", {k: "#FFFFFF" for k in ("Body", "Edge", "Wall", "Face", "Hub", "Line")}, b)
    # Pale plates outlined dark (their chamfers and walls: the panel lines), so they hold on the shop's white and in the dark.
    paint = {"Edge": kit.lin("#283044"), "Face": kit.lin("#98A1B1"), "Wall": kit.lin("#3A4358"), "Hub": kit.lin("#343C50"), "Line": kit.lin("#E6ECF0")}
    # Painted armour (solid grey and white on any stage, never a mirror of the room), over the anodised core.
    metal(rod, lambda p, part, n: paint.get(part) or tuple(0.5 * c for c in ramp(ANODISED, 0.55 + 0.45 * (TI_L - p.z) / (TI_L + 0.126))), finish="P_Paint")

    def energy(pc):                              # cyan lines in each plate's panel, on both faces, and the blade's edge
        pc.mat = "Glow"
        for (_, t, *_), panel in zip(A1_PLATES, (((0.044, 0.16), (0.054, 0.33)), ((0.04, 0.43), (0.045, 0.61), (0.026, 0.73)),
                                               ((-0.04, 0.18), (-0.048, 0.29), (-0.029, 0.345)), ((-0.032, 0.48), (-0.035, 0.6), (-0.018, 0.65)))):
            for s in (-1, 1):
                pc.tube([V((px, s * (t / 2 + 0.0009), pz)) for px, pz in panel], [0.0032] * len(panel), sides=3, tip=False)
        for s in (-1, 1):                        # and down each cheek
            pc.tube([V((px, s * 0.0309, pz)) for px, pz in ((-0.016, 0.05), (0.018, 0.05), (0.02, 0.1), (0.01, 0.25))], [0.0022] * 4, sides=3, tip=False)
        pc.tube([V((px, 0, pz)) for px, pz in ((0.0555, 0.42), (0.0615, 0.62), (0.0375, 0.76), (0.0095, 0.835))], [0.0024] * 4, sides=3, tip=True)

    def core(pc):                                # the hub's core
        pc.mat = "Glow"
        lathe(pc, (0, y, z), [(0.0, -0.009), (0.02, -0.007), (0.024, 0.0), (0.02, 0.007), (0.0, 0.009)], n=8, axis=(0, 1, 0), phase=math.pi / 8)

    def blades(pc):                              # energy blades under the front plates, hard-edged, solid (an additive
        pc.mat = "Glow"                          # light vanishes on the shop's white and washes the plates)
        for outline in ([(-0.056, 0.19), (-0.095, 0.22), (-0.105, 0.34), (-0.062, 0.31)], [(-0.044, 0.48), (-0.076, 0.5), (-0.083, 0.62), (-0.048, 0.6)]):
            plate(pc, outline, 0.003, 0.0008, tags=("Glow",) * 3)
    fx = [glow("Energy", "#3ED8FF", energy, flicker=0.2),
          glow("Core", "#A6F4FF", core, pivot=(0, y, z), pulse=0.14),
          glow("Blades", "#2FC4FF", blades, pivot=(-0.06, 0, 0.4), pulse=0.05)]
    return rod, fx, {"rodFx": "titanium-a1"}, particles("#9EEBFF", "sparkle", every=0.12, size=0.05, rise=0.3)


# ================================================================ build
ROD_FILES = {"carrot": "rod-carrot", "precision": "rod-precision", "training": "rod-training", "cedar": "rod-2", "glass": "rod-3",
             "riptide": "rod-riptide", "tidewarden": "rod-5", "tempest": "rod-tempest", "titanium": "rod-titanium",
             "titanium-a1": "rod-titanium-a1", "reserved-slate": "rod-reserved-slate"}
BUILD = {"carrot": carrot, "precision": precision, "training": training, "cedar": cedar, "glass": glass,
         "riptide": riptide, "tidewarden": tidewarden, "tempest": tempest, "titanium": titanium,
         "titanium-a1": titanium_a1, "reserved-slate": reserved_slate}
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
