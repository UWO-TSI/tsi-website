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


def model(name, mats, build, grad=(0.8, 1.0)):
    m = {k: kit.material(f"{name}_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat=next(iter(mats)))
    build(pc)
    return pc.finish(name, None, m, sharp=50, grad=grad)


def fx_part(name, mats, build, pivot=(0, 0, 0), **extras):
    """One moving or glowing node of an effect, its origin at `pivot` (what it spins about)."""
    ob = model(name, mats, build, grad=(1.0, 1.0))
    ob.data.transform(__import__("mathutils").Matrix.Translation(-V(pivot)))
    ob.location = pivot
    for k, v in extras.items():
        ob[k] = v
    return ob


def halo(at, size, color):
    e = bpy.data.objects.new("Halo", None)
    bpy.context.scene.collection.objects.link(e)
    e.location = at
    e["size"], e["color"] = size, color
    return e


def export(objs, path, extras=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc = bpy.context.scene
    for k in list(sc.keys()):
        del sc[k]
    for k, v in (extras or {}).items():
        sc[k] = v
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False,
                              export_animations=False, export_extras=True)


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
def whorl(pc, c, R, n, phase, rise=0.35, droop=0.7, arch=0.12, seed=0):
    """One layer of a cedar: `n` flat needle sprays fanned round the blank at `c` (the trunk), joined at their foot and
    split by deep notches, each a raised midrib with branchlets pointing out along both edges, rising off the trunk
    then drooping; 8 * n triangles."""
    c, k = V(c), lambda j: 1.0 + 0.12 * math.sin(5.1 * j + 2.7 * seed)       # a little uneven, spray to spray
    step = TAU / n

    def at(j, u, v, lift=0.0):              # u out along spray j (of its reach), v across it (1 = the notch)
        a, r = phase + step * (j + 0.5 * v), R * k(j) * u
        return pc.v(c + V((math.cos(a) * r, math.sin(a) * r, rise * r - droop * r * r / R + lift * R)))
    hub = pc.v(c)
    notch = [at(j - 0.5, 0.26, 0) for j in range(n)]
    below = lambda vs: sum((v.co for v in vs), V()) / len(vs) - V((0, 0, 0.05))
    for j in range(n):
        mid = at(j, 0.52, 0, arch)
        edge = [notch[j], at(j, 0.6, -0.78), at(j, 0.64, -0.26), at(j, 1.0, 0.04), at(j, 0.76, 0.28), at(j, 0.8, 0.74),
                notch[(j + 1) % n]]               # out, in, the tip, in, out: the branchlets alternate a little
        for q in [[hub, notch[j], mid], [hub, mid, notch[(j + 1) % n]]] + [[e0, e1, mid] for e0, e1 in zip(edge, edge[1:])]:
            pc.f(q, below(q))


def cedar():
    """Uncommon, rod-2 (David 11-03: "the leave should grow in a natural looking way, make it look like a cedar tree").
    The blank is the trunk of a little cedar: layers of flat needle sprays up its top half, a cone wide and drooping
    low and small near the tip, each layer turned on from the last, the blank's tip standing out as the leader."""
    L = 0.76
    bend = bender(L)
    rad = lambda z: 0.0135 - 0.0075 * (z - 0.06) / (L - 0.06)

    def b(pc):
        pc.mat = "Grip"
        grip(pc, [(0, -0.12), (0.016, -0.118), (0.019, -0.09), (0.019, 0.04), (0.015, 0.07)], n=7)
        zs = [0.06 + (L - 0.06) * k / 6 for k in range(7)]
        pc.mat = "Blank"
        loft(pc, [bend(z) for z in zs], [rad(z) for z in zs], sides=6, tip=True)
        pc.mat = "Band"
        for z in (0.075, 0.3):
            c, r = bend(z), rad(z)
            pc.tube([c - V((0, 0, 0.006)), c + V((0, 0, 0.006))], [r * 1.25, r * 1.25], sides=6, tip=False, cap=False)
        reel(pc, z=0.02, mat="Grip")
        pc.mat = "Leaf"
        layers = [  # z, reach, sprays: a cone of layers, wide and drooping low, small near the tip
            (0.35, 0.1, 6), (0.415, 0.088, 6), (0.48, 0.075, 5), (0.545, 0.061, 5), (0.605, 0.047, 4), (0.66, 0.034, 4), (0.71, 0.022, 3)]
        for w, (z, R, n) in enumerate(layers):
            whorl(pc, bend(z), R, n, 0.4 + w * 2.4, droop=0.85 - 0.06 * w, seed=w)   # each layer turned on from the last
        line(pc, (0, -0.048, 0.034), bend, L, "Line")
    return model("rod-2", {"Grip": "#C8A27A", "Blank": "#9A5A3A", "Band": "#6D3B26", "Line": "#F2ECDD", "Leaf": "#4A7A38"}, b)


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
    """Epic, rod-5 (David: "tide warden rod not even epic bruh not cool at all"). The sea guardian's trident: a column
    of wrung teal water wound with sea foam, a gold trident head before a great cream scallop, sea-foam fins sweeping
    back from the reel, a gold reel with its shell. The effect: a glowing pearl floating over the middle tine, two
    ribbons of water spiralling up the shaft, a teal aura and rising bubbles."""
    L = 0.66
    bend = bender(L, bow=0.0)

    def b(pc):
        grip(pc, [(0, -0.12), (0.016, -0.12), (0.02, -0.1), (0.02, 0.03), (0.017, 0.06)], n=7, mat=lambda band, q: "Gold" if band in (0, 2) else "Cream")
        pc.mat = "Gold"
        pc.blob((0, 0, -0.128), 0.0155, segs=6, rings=4)
        n = 9
        zs = [0.055 + (L - 0.055) * k / (n - 1) for k in range(n)]
        rs = [0.019, 0.018, 0.0165, 0.0155, 0.015, 0.0155, 0.017, 0.02, 0.023]
        loft(pc, [bend(z) for z in zs], rs, sides=6, twist=TAU * 1.6 / (n - 1), mat=lambda i, k: "Foam" if k % 3 == 0 else "Teal", tip=False, cap=True)
        pc.mat = "Gold"
        lathe(pc, (0, 0, L - 0.006), [(0.025, 0.0), (0.03, 0.01), (0.025, 0.026), (0.011, 0.034)], n=8)
        # the tines: the middle one tallest (the tip), the outer two curving out and up, barbed
        base = V((0, 0, L + 0.02))
        loft(pc, [base, base + V((0, -0.002, 0.1)), base + V((0, -0.004, 0.2)), base + V((0, -0.004, 0.27))], [0.011, 0.0095, 0.007, 0.004], sides=5, tip=True, cap=False)
        for s in (-1, 1):
            p = [base + V((s * 0.008, 0, 0)), base + V((s * 0.06, -0.003, 0.035)), base + V((s * 0.092, -0.005, 0.11)), base + V((s * 0.1, -0.006, 0.2))]
            loft(pc, p, [0.0095, 0.009, 0.0068, 0.004], sides=5, tip=True, cap=False)
            pc.tube([base + V((s * 0.09, -0.005, 0.14)), base + V((s * 0.068, -0.005, 0.125))], [0.006, 0.0], sides=4, tip=False)
        # the scallop behind the head: ribs fanned from the collar, corrugated, given a little thickness
        pc.mat = "Cream"
        apex, R, rib = V((0, 0.02, L + 0.005)), 0.15, 9
        rim = [apex + V((math.sin(a) * R, 0.012 * (1 if k % 2 else -1) * 0.6, math.cos(a) * R * 0.95))
               for k, a in enumerate(math.radians(-80 + 160 * k / (rib - 1)) for k in range(rib))]
        mid = [apex.lerp(p, 0.55) + V((0, 0.006 * (1 if k % 2 else -1), 0)) for k, p in enumerate(rim)]
        back = V((0, 0.007, 0))
        verts_f = [pc.v(p) for p in [apex] + mid + rim]
        verts_b = [pc.v(p + back) for p in [apex] + mid + rim]
        A, M, Rr = 0, list(range(1, 1 + rib)), list(range(1 + rib, 1 + 2 * rib))
        for vs, out in ((verts_f, V((0, -1, 0))), (verts_b, V((0, 1, 0)))):
            for k in range(rib - 1):
                pc.f([vs[A], vs[M[k + 1]], vs[M[k]]], apex - out)
                pc.f([vs[M[k]], vs[M[k + 1]], vs[Rr[k + 1]], vs[Rr[k]]], apex - out)
        for k in range(rib - 1):
            pc.f([verts_f[Rr[k]], verts_f[Rr[k + 1]], verts_b[Rr[k + 1]], verts_b[Rr[k]]], apex)
        # the fins, sweeping back and down from the reel seat
        pc.mat = "Foam"
        for s in (-1, 1):
            leaf(pc, (s * 0.016, 0.006, 0.075), V((s * 0.6, 0.45, -0.66)), 0.17, 0.03, side=V((0, 0, 1)), curl=0.03, lobes=(0.6, 1.0, 0.8, 0.45))
        reel(pc, z=0.02, mat="Gold", crank=False)
        pc.mat = "Cream"
        lathe(pc, (-0.017, -0.048, 0.02), [(0, 0), (0.017, 0.003), (0, 0.008)], n=7, axis=(-1, 0, 0))
        line(pc, (0, -0.048, 0.034), bend, L + 0.26, "Cream", ahead=-0.028, zs=(0.24, 0.48), tip=base + V((0, -0.008, 0.275)))
    rod = model("rod-5", {"Teal": "#2C6C73", "Foam": "#7CCABD", "Gold": "#D6AA45", "Cream": "#EFE5CF"}, b)
    top = L + 0.3

    def pearl(pc):
        pc.mat = "Glow"
        pc.blob((0, -0.004, top + 0.035), 0.017, segs=8, rings=6)

    def water(pc):
        pc.mat = "Light"
        for ph in (0.0, math.pi):
            pts = helix((0, 0, 0.08), (0, 0, L - 0.04), 0.045, 0.032, 1.6, 16, ph)
            pc.tube(pts, [(0.0075, 0.002)] * 16, sides=4, tip=False, cap=False, up=V((0, 0, 1)))

    def shell(pc):
        aura_shell(pc, top + 0.06, r=0.09)
    fx = [fx_part("Pearl", {"Glow": "#E6FFFA"}, pearl, pivot=(0, -0.004, top + 0.035), bob=0.012, rate=1.3, pulse=0.08),
          fx_part("Tide", {"Light": "#7FE3E0"}, water, pivot=(0, 0, 0.3), spin=-1.2),
          fx_part("Aura", {"Aura": "#3FD0C8"}, shell),
          halo((0, -0.004, top + 0.035), 0.42, "#9FFFF0")]
    return rod, fx, {"rodFx": "tidewarden"}, {"spark": "#BFFFF4", "sparkSprite": "glow", "sparkEvery": 0.14, "sparkSize": 0.06, "sparkRise": 0.35}


def tempest():
    """Epic (David's epic-tempest-ref.png, epic-tornado.png for the aura). A storm caught on a handle: a black grip in
    white rings, a white reel with an ice hub, and for a blank a chain of icy lightning links zigzagging up to an ice
    crystal, with jagged ice shards flaring from the reel. The effect: a crackling arc of light round the chain, a
    tornado of light spinning round the reel, an ice-blue aura, glows at the tip and the reel, sparks."""
    L = 0.86
    z0 = 0.065

    def b(pc):
        grip(pc, [(0, -0.12), (0.017, -0.12), (0.02, -0.105), (0.019, 0.03), (0.016, 0.06)], n=7, mat=lambda band, q: "White" if band in (0, 2) else "Grip")
        # the links: a zigzag chain, thick in each link's middle and pinched at the joints
        k = 8
        joints = [V((0.022 * (1 if j % 2 else -1) * (0.3 if j == 0 else 1), 0.004 * j / k, z0 + (L - z0) * j / k)) for j in range(k + 1)]
        path, rad = [], []
        for j in range(k):
            path += [joints[j], joints[j].lerp(joints[j + 1], 0.5)]
            rad += [0.0062, 0.022 - 0.008 * j / k]
        path.append(joints[-1]); rad.append(0.006)
        loft(pc, path, rad, sides=4, phase=math.pi / 4, mat=lambda i, s: "Ice" if (i // 2) % 2 else "Pale", tip=False, cap=True)
        pc.mat = "Ice"                           # the crystal at the tip
        top = joints[-1]
        loft(pc, [top, top + V((0, 0, 0.035)), top + V((0, 0, 0.085))], [0.006, 0.017, 0.004], sides=4, phase=math.pi / 4, tip=True, cap=False)
        pc.mat = "Pale"                          # ice shards flaring from the reel seat, up and back, and two down
        for s in (-1, 1):
            leaf(pc, (s * 0.014, 0.004, 0.07), V((s * 0.62, 0.3, 0.72)), 0.23, 0.03, side=V((0, 1, 0)), curl=-0.025, lobes=(0.5, 1.0, 0.55, 0.85, 0.3), thick=0.005)
            leaf(pc, (s * 0.014, 0.004, 0.02), V((s * 0.62, 0.3, -0.72)), 0.12, 0.022, side=V((0, 1, 0)), lobes=(0.6, 1.0, 0.4), thick=0.005)
        reel(pc, z=0.025, r=0.034, mat="White", knob="Ice")
        pc.mat = "Ice"
        lathe(pc, (0.0, -0.048, 0.025), [(0.0, 0.0145), (0.012, 0.0155), (0, 0.019)], n=7, axis=(-1, 0, 0))
        line(pc, (0, -0.05, 0.041), lambda z: V((0, 0, z)), L, "White", ahead=-0.034, tip=top + V((0, -0.005, 0.088)))
    rod = model("rod-tempest", {"Grip": "#2A2E39", "White": "#EEF4F8", "Ice": "#7FC6EC", "Pale": "#D3EEFA"}, b)
    top = L + 0.085

    def arc(pc):                                 # lightning arcing round the chain, with two forks
        pc.mat = "Glow"
        pts = [V((0.034 * math.sin(i * 2.3) + (0.01 if i % 2 else -0.01), 0.022 * math.cos(i * 1.7), z0 + 0.01 + (top - z0 - 0.04) * i / 13)) for i in range(14)]
        pc.tube(pts, [0.0032] * 14, sides=3, tip=True)
        for j, s in ((4, 1), (9, -1)):
            pc.tube([pts[j], pts[j] + V((s * 0.035, 0.004, 0.015)), pts[j] + V((s * 0.045, 0.0, 0.04))], [0.003, 0.0022, 0.0012], sides=3, tip=True)

    def tornado(pc):                             # the funnel of light round the reel (epic-tornado.png)
        pc.mat = "Light"
        pc.tube(helix((0, 0, -0.03), (0, 0, 0.3), 0.04, 0.1, 3.2, 34), [(0.0055, 0.0018)] * 34, sides=4, tip=False, cap=False, up=V((0, 0, 1)))

    def shell(pc):
        aura_shell(pc, top + 0.04, r=0.1)
    fx = [fx_part("Arc", {"Glow": "#8DF2FF"}, arc, flicker=1.0),
          fx_part("Tornado", {"Light": "#79D2FF"}, tornado, pivot=(0, 0, 0.1), spin=3.2, pulse=0.05),
          fx_part("Aura", {"Aura": "#5CC4FF"}, shell),
          halo((0, -0.004, top - 0.03), 0.5, "#A8F4FF"), halo((0, -0.048, 0.025), 0.22, "#8FE6FF")]
    return rod, fx, {"rodFx": "tempest"}, {"spark": "#C9F6FF", "sparkSprite": "sparkle", "sparkEvery": 0.06, "sparkSize": 0.09, "sparkRise": 0.5}


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
