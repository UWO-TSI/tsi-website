"""Hair accessories (avatar v8 deliverable 3, milestone 1: claw clip, bow, scrunchie), modeled in the live Blender
session step by step and kept here as the build path (build_accessories.py registers them).

Each is one closed, matte solid in one material (M_Main, the accessory's colour), authored at the origin in anchor
space: x across, y along the hair toward its root (up on a loose style), z out toward the viewer. The engine moves it
onto the worn style's anchor (v8/anchors.py); a piece that wraps the hair (the scrunchie) is scaled to the anchor's
radius, its inner ring authored at RING. Skinned 100% to the Head bone like the hair.
"""
import math
from mathutils import Vector

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
RING = 0.03          # m: the scrunchie's authored inner radius (the engine scales it to the gathered hair's radius)
BOW_SCALE = 1.3


def claw_clip(pc):
    """A claw clip clamping the hair: two curved jaws arching out from a hinge bar, each a shell that bows back at
    its ends to follow the head, rounded at the corners and scalloped into teeth that bite in from both sides."""
    pc.region = "head"
    xs = [-0.046, -0.032, -0.016, 0.0, 0.016, 0.032, 0.046]
    for s in (1, -1):                                          # the jaw toward the root (+y) and the one toward the tips
        arc = [(0.002, 0.037), (0.014, 0.035), (0.024, 0.025), (0.03, 0.011)]
        rows = []
        for i, (y, z) in enumerate(arc):
            w = 1.0 - 0.1 * i / 3                              # the jaw narrows toward the teeth
            rows.append([Vector((x * w, s * y, z - 9.0 * (x * w) ** 2 - (0.004 if i == 3 and abs(x) > 0.04 else 0.0)))
                         for x in xs])
        n0 = pc.mark()
        pc.band(rows, closed=False, refs=[Vector((0, 0, -0.05))] * 3)
        pc.thicken(pc.since(n0), lambda v: v.co - Vector((0, s * 0.0045, 0.0045)))
        for x in xs[1:-1]:                                     # teeth along the lower edge, curving in under the hair
            x0 = x * 0.9
            z0 = 0.011 - 9.0 * x0 ** 2
            pc.tube([Vector((x0, s * 0.03, z0)), Vector((x0, s * 0.024, z0 - 0.011)), Vector((x0, s * 0.014, z0 - 0.017))],
                    [0.0045, 0.0035, 0.0022], sides=4, tip=True, up=X)
    pc.tube([Vector((-0.04, 0, 0.034)), Vector((0, 0, 0.0405)), Vector((0.04, 0, 0.034))], [0.0066, 0.0074, 0.0066],
            sides=6, tip=False, up=Z)                          # the hinge bar, following the same bow


def _lobe(pc, sx, length=0.066, h=0.024, d=0.012, rise=0.012, n=6, sides=8):
    """One bow loop: a soft fabric pillow from the knot out to one side, puffed forward, its front pressed into a
    fold along the middle, closed at the far end."""
    rings = []
    for i in range(n):
        t = (i + 1) / (n + 1)
        x = sx * (0.006 + length * t)
        hh = h * (0.35 + 0.65 * math.sin(math.pi * t ** 0.75))
        dd = d * (0.45 + 0.55 * math.sin(math.pi * t))
        c = Vector((x, rise * t, 0.012 + 0.004 * math.sin(math.pi * t)))
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            fold = 0.0045 * math.sin(math.pi * t) if k == 0 else 0.0           # the front crease
            ring.append(c + Y * hh * math.sin(a) + Z * (dd * math.cos(a) - fold))
        rings.append(ring)
    end = Vector((sx * (0.006 + length * 0.98), rise, 0.012))
    pc.band(rings, caps=(Vector((sx * 0.004, 0, 0.012)), end))


def bow(pc):
    """A ribbon bow (hair-3d-set B3.3): two puffy loops pressed into soft folds, a knot, two tails falling at an
    angle with notched ends."""
    pc.region = "head"
    n0 = pc.mark()
    for sx in (1, -1):
        _lobe(pc, sx)
    pc.blob(Vector((0, 0, 0.016)), (0.012, 0.014, 0.011), segs=8, rings=4)
    for sx in (1, -1):                                         # the tails: thin tapering ribbons, the ends notched
        path = [Vector((sx * 0.006, -0.008, 0.012)), Vector((sx * 0.018, -0.03, 0.011)), Vector((sx * 0.026, -0.052, 0.008))]
        pc.tube(path, [(0.0022, 0.009), (0.002, 0.01), (0.0018, 0.011)], sides=4, tip=False, up=Z)
        nb = path[-1]                                          # the notch: the ribbon's end cut into a point
        pc.tube([nb, nb + Vector((sx * 0.004, -0.009, -0.001))], [(0.0016, 0.009), (0.0012, 0.003)], sides=4, tip=False, up=Z)
    for f in pc.since(n0):                                     # sized like hair-3d-set's bow: about a third of the head
        pc.ref[f] = Vector(pc.ref[f]) * BOW_SCALE
    for v in {v for f in pc.since(n0) for v in f.verts}:
        v.co *= BOW_SCALE


def scrunchie(pc, n=28, sides=6):
    """A scrunchie round the gathered hair: a fabric ring gathered into soft puffs (the tube swells and pinches
    fourteen times round), its inside on RING."""
    pc.region = "head"
    tube = 0.0125
    path, radii = [], []
    for k in range(n):
        a = 2 * math.pi * k / n
        r = tube * (1.0 + 0.24 * math.cos(14 * a))
        R = RING + r * 0.9
        path.append(Vector((R * math.cos(a), 0.004 * math.sin(14 * a + 1.0), R * math.sin(a))))
        radii.append(r)
    pc.tube(path, radii, sides=sides, closed_loop=True, up=Y)
