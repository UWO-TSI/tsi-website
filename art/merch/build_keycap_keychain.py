"""The TSI keycap keychain (specs/merch/tsi-keycap-keychain.md), from David's six photos in
references/merch/tsi-keycap-keychain/. A clear acrylic block with a loop on top; a Gateron Milky Yellow Pro switch
seated in it (milky white housing, yellow stem, the pins seen through the acrylic); a dark navy keycap on the switch
with the white Tethos mark on top; silver hardware: a lobster clasp on the block's loop, a jump ring, a short snake
chain, another jump ring and a spring-gate keyring.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/merch/build_keycap_keychain.py

Writes web/public/assets/game/items/merch-tsi-keycap-keychain.glb. Units: one unit is 10 cm (the block is 0.19 across),
so the shop scales it up to a readable display size. It hangs straight down from the keyring's top at the origin, the
switch's axis along +z (the keycap faces +z, the front every item's icon is drawn from; the shop turns it to face the
room), so a static load shows it hanging at rest.

Nodes, each with its origin at the point it hangs from (the engine swings them, components/game/KeycapKeychain.tsx):
  keychain_ring     the spring-gate keyring and the upper jump ring
  keychain_chain_0..3  the snake chain in four links, top to bottom (the first and last carry the crimped ends)
  keychain_body     the lower jump ring, the lobster clasp, the block, the switch's housings and its pins
  keychain_stem     (a child of the body) the yellow stem and its cross; it moves −z, into the switch, on a press
  keychain_keycap   (a child of the body) the keycap; it rides the stem, or comes off to show the switch
Materials: P_Metal (the hardware and the pins), P_Glass (the acrylic, see-through), P_Paint (the keycap, the housing
and the stem, their colours in COLOR_0), M_Logo (the keycap's top: the one texture, the Tethos mark on navy).
"""
import math, os, subprocess, sys, tempfile
import numpy as np
import bpy
import openvdb as vdb

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402

ROOT = K.ROOT
MARK_SVG = os.path.join(ROOT, "web", "public", "assets", "branding", "tethos-mark.svg")
OUT = "game/items/merch-tsi-keycap-keychain.glb"

NAVY, HOUSING, STEM, ACRYLIC = "#222a44", "#eeebe3", "#f2c61f", "#f4eef3"
# Polished silver and the pins' gold: mid tones, so the look reads them as metal (lookPreset: light paint stays dielectric).
SILVER, GOLD, SEAM, LED = "#8f949a", "#b8913f", "#d3cfc4", "#b9bbb7"
# Hanging layout (game units, y down from where the keyring hangs on its hook)
LINK = 0.0738            # one of the chain's four swinging parts (the end caps and the snake chain's halves; 3.07 cm cap to cap)
BODY_S = 1.1             # the block, switch and keycap (IMG_3117-measured: the keycap 1.97 cm at its foot)
BLOCK = (0.19, 0.20, 0.17)
KEYCAP_PRESS = 0.035     # how far the stem (and the keycap on it) goes in on a press


def mats():
    m = {
        "metal": K.Mat("P_Metal", "#ffffff", rough=0.35),
        "glass": K.Mat("P_Glass", "#ffffff", rough=0.08),
        "paint": K.Mat("P_Paint", "#ffffff", rough=0.45),
    }
    g = m["glass"].m
    b = next(n for n in g.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Alpha"].default_value = 0.32
    g.surface_render_method = "BLENDED"
    m["logo"] = K.Mat("M_Logo", "#ffffff", rough=0.5, tex=K.image("keycap_logo", logo()))
    return m


def logo(size=256):
    """The keycap's top: navy with the white Tethos mark, rasterised from the brand SVG."""
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, "mark.png")
        subprocess.run(["/opt/homebrew/bin/rsvg-convert", "-w", str(size), "-h", str(size), "-b", NAVY, MARK_SVG, "-o", png], check=True)
        img = bpy.data.images.load(png)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)[::-1, :, :3]
        bpy.data.images.remove(img)
    # linear -> sRGB (Blender loads PNGs as sRGB but hands back the stored values; keep them as they are)
    return px


# ================================================================ cast parts: signed distance fields
# The keyring's clasp and the lobster are die-cast and polished: one smooth piece each, so they're modelled as signed
# distance fields (round bars, a flat-faced base, smooth fillets, a cast-through eye), meshed with OpenVDB and
# decimated to their share of the budget. Each is drawn in its photo's frame, in pixels of David's full-resolution
# crops (references/merch/tsi-keycap-keychain/crop-*.jpg, x right, y down, z toward the camera), then placed.
PX = 0.000302            # one pixel of the crops, in model units (the clasp is 480 px tall; the block is 0.20)


def smin(a, b, k):
    """Smooth union (a fillet of about k)."""
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


class Field:
    """A signed distance field (negative inside) on a voxel grid in a part's photo frame."""

    def __init__(self, x0, x1, y0, y1, z0, z1, vox=1.3):
        self.o, self.vox = np.array([x0, y0, z0], dtype=np.float64), vox
        xs, ys, zs = (np.arange(a, b + vox, vox, dtype=np.float32) for a, b in ((x0, x1), (y0, y1), (z0, z1)))
        self.X, self.Y, self.Z = np.meshgrid(xs, ys, zs, indexing="ij")
        self.x2, self.y2 = self.X[:, :, 0], self.Y[:, :, 0]
        self.d = np.full(self.X.shape, 1e3, dtype=np.float32)

    def sweep(self, pts, sz=1.0):
        """Round bars through [((x, y[, z]), r)]: round cones joined end to end; sz flattens the section front to back."""
        d = np.full(self.X.shape, 1e3, dtype=np.float32)
        Z = self.Z / sz
        P = [(p[0], p[1], p[2] if len(p) > 2 else 0.0, r) for p, r in pts]
        for (ax, ay, az, ra), (bx, by, bz, rb) in zip(P, P[1:]):
            ex, ey, ez = bx - ax, by - ay, (bz - az) / sz
            wx, wy, wz = self.X - ax, self.Y - ay, Z - az / sz
            t = np.clip((wx * ex + wy * ey + wz * ez) / (ex * ex + ey * ey + ez * ez), 0.0, 1.0)
            d = np.minimum(d, np.sqrt((wx - ex * t) ** 2 + (wy - ey * t) ** 2 + (wz - ez * t) ** 2) - (ra + (rb - ra) * t))
        return d * min(1.0, sz)

    def strap(self, pts, t):
        """A flat strap along a centreline [((x, y), half-width)]: flat faces t either side of the photo's plane, its
        edges fully rounded (a stadium section)."""
        e = np.full(self.x2.shape, 1e3, dtype=np.float32)
        for ((ax, ay), wa), ((bx, by), wb) in zip(pts, pts[1:]):
            ex, ey, wx, wy = bx - ax, by - ay, self.x2 - ax, self.y2 - ay
            h = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0.0, 1.0)
            e = np.minimum(e, np.hypot(wx - ex * h, wy - ey * h) - (wa + (wb - wa) * h))
        e = e[:, :, None]
        return np.sqrt(np.maximum(e + t, 0.0) ** 2 + self.Z ** 2) - t

    def ellipsoid(self, c, r):
        q = np.sqrt(((self.X - c[0]) / r[0]) ** 2 + ((self.Y - c[1]) / r[1]) ** 2 + ((self.Z - (c[2] if len(c) > 2 else 0)) / r[2]) ** 2)
        return (q - 1.0) * min(r)

    def torus(self, c, R, r):
        """A ring in the photo's plane."""
        q = np.sqrt((self.X - c[0]) ** 2 + (self.Y - c[1]) ** 2) - R
        return np.sqrt(q * q + self.Z ** 2) - r

    def polygon(self, poly):
        """The 2D signed distance to a closed outline, on the grid's plane."""
        px, py = self.x2, self.y2
        d2 = np.full(px.shape, 1e9, dtype=np.float32)
        sgn = np.ones(px.shape, dtype=np.float32)
        for i in range(len(poly)):
            (ax, ay), (bx, by) = poly[i], poly[i - 1]
            ex, ey, wx, wy = bx - ax, by - ay, px - ax, py - ay
            t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0.0, 1.0)
            d2 = np.minimum(d2, (wx - ex * t) ** 2 + (wy - ey * t) ** 2)
            c1, c2, c3 = py >= ay, py < by, ex * wy > ey * wx
            sgn = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -sgn, sgn)
        return sgn * np.sqrt(d2)

    def slab(self, poly, half, holes=(), round_in=None):
        """A plate on an outline (less any holes), half(x, y) its half-thickness. Its edges are rounded: a quarter circle,
        or with round_in a quarter ellipse reaching that far in from the outline (a domed face rather than a flat one)."""
        d2 = self.polygon(poly)
        for h in holes:
            d2 = np.maximum(d2, -self.polygon(h))
        d2, T = d2[:, :, None], half(self.x2, self.y2)[:, :, None]
        if round_in is None:
            return np.sqrt(np.maximum(d2 + T, 0.0) ** 2 + self.Z ** 2) - T
        Rr = round_in
        return (np.sqrt(np.maximum(d2 + Rr, 0.0) ** 2 + (self.Z * Rr / T) ** 2) - Rr) * np.minimum(1.0, T / Rr)

    def mesh(self, k, mat, col, tris, place):
        """Mesh the surface (OpenVDB), decimate it to about `tris` triangles, and add it to kit k through place(x, y, z)
        -> game point."""
        g = vdb.FloatGrid(background=1e3)
        g.copyFromArray(self.d)
        pts, tri, quad = g.convertToPolygons(0.0, 0.0)
        pts = self.o + np.asarray(pts, dtype=np.float64) * self.vox
        me = bpy.data.meshes.new("sdf")
        me.from_pydata(pts.tolist(), [], [list(map(int, f)) for f in quad] + [list(map(int, f)) for f in tri])
        ob = bpy.data.objects.new("sdf", me)
        bpy.context.scene.collection.objects.link(ob)
        dec = ob.modifiers.new("decimate", "DECIMATE")
        dec.ratio = min(1.0, tris / max(1, 2 * len(quad) + len(tri)))
        dec.use_collapse_triangulate = True
        dec.use_symmetry, dec.symmetry_axis = True, "Z"      # the same front and back
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        m2 = ev.to_mesh()
        placed = [place(*v.co) for v in m2.vertices]
        self.size = tuple(max(q[i] for q in placed) - min(q[i] for q in placed) for i in range(3))   # the part's extent (game x, y, z)
        vs = [k.vert(q) for q in placed]
        for f in m2.polygons:
            if len(set(f.vertices)) < len(f.vertices):
                continue
            try:
                k.face([vs[i] for i in f.vertices], [(0.0, 0.0)] * len(f.vertices), mat, col)
            except ValueError:        # a face the decimation left doubled
                pass
        ev.to_mesh_clear()
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)


def placer(contact, below, at, px=PX):
    """Hang a part drawn in its photo: turn it in its plane until `below` (where what it carries pulls) is straight
    under `contact` (where it hangs from), and put `contact` at game point `at`. Built facing −z like the rest (the
    whole model turns half round at the end), so the photo's right is game −x and its camera side game −z."""
    a = math.atan2(below[0] - contact[0], below[1] - contact[1])
    ca, sa = math.cos(a), math.sin(a)

    def place(x, y, z=0.0):
        dx, dy = x - contact[0], y - contact[1]
        rx, ry = dx * ca - dy * sa, dx * sa + dy * ca
        return (at[0] - rx * px, at[1] - ry * px, at[2] - z * px)
    return place


def ring(k, m, c, R, r, plane, n=16, sides=6, gap=None):
    """A ring of round wire, centre c, in the plane of the two game directions `plane` (angle 0 along the first);
    `gap`: a split ring, cut open at that angle."""
    (ux, uy, uz), (vx, vy, vz) = plane
    if gap is None:
        ts = [math.tau * i / n for i in range(n)]
    else:
        ts = [gap + GAP / 2 + (math.tau - GAP) * i / n for i in range(n + 1)]
    pts = [(c[0] + R * (math.cos(t) * ux + math.sin(t) * vx), c[1] + R * (math.cos(t) * uy + math.sin(t) * vy),
            c[2] + R * (math.cos(t) * uz + math.sin(t) * vz)) for t in ts]
    k.tube(pts, r, m["metal"], SILVER, n=sides, closed_path=gap is None, caps=gap is not None)


XY, YZ = ((1, 0, 0), (0, 1, 0)), ((0, 0, 1), (0, 1, 0))

# ---- the keyring's clasp: a die-cast spring-gate snap clasp, drawn face on from IMG_3111 (mirrored, so the gate is on
# the right as in IMG_3096), its thicknesses from IMG_3112 (edge on). A flat strap (wide on the face, thin on the edge)
# runs from the base up the left, over the top and down the right, curling into a short nose that ends in a rounded,
# slightly bulbous tip. At the bottom left the strap widens into the base: a heavy wedge, thickest at its knuckle end
# and tapering to a rounded point, with a round eye cast through its face that the split ring threads. The knuckle, at
# the base's right end, takes the gate: a long narrow loop of thin round wire lying across the clasp's plane (face on it
# reads as one rod), widest at the nose and narrowing to the knuckle, its legs going in front and back. Pixels of
# IMG_3111's crop (references: 0.8 of the photo's own), mirrored.
CPX = 0.000311               # one pixel of that crop, in model units (IMG_3117-measured: the clasp 2.25 cm long, 1.76 wide)
CLASP_BAR = [((74, 470), 30), ((72, 380), 29), ((80, 280), 28), ((105, 190), 28), ((160, 125), 27), ((235, 85), 26),
             ((330, 70), 25), ((425, 82), 25), ((505, 118), 25), ((560, 175), 25), ((588, 245), 23), ((594, 300), 22),
             ((592, 330), 22)]
STRAP_T = 12.0                               # the strap's half-thickness (IMG_3112)
CLASP_NOSE = ((588, 356), 26.0)              # the bulbous tip
CLASP_BASE = [(48, 470), (55, 560), (65, 630), (80, 690), (105, 715), (160, 727), (230, 718), (300, 695), (360, 665),
              (385, 625), (375, 585), (350, 565), (300, 566), (230, 576), (170, 570), (130, 548), (108, 505), (100, 460)]
# the base's half-thickness over it (IMG_3112): the strap's where they join, fullest at the knuckle, easing to the
# rounded point round the eye
BASE_T = [((74, 470), 12.0), ((85, 540), 13.0), ((325, 615), 46.0), ((280, 620), 42.0), ((230, 650), 32.0),
          ((200, 590), 30.0), ((150, 580), 22.0), ((170, 655), 24.0), ((138, 640), 19.0), ((120, 700), 16.0), ((80, 650), 15.0)]
CLASP_KNUCKLE = ((325, 615), (42, 42, 49))
CLASP_HOLE = ((140, 638), (45, 45))          # the eye, cast front to back
GATE_K, GATE_N = (330, 612), (565, 325)      # the gate's line: from inside the knuckle to just inside the nose
GATE_HALF = (58.0, 85.0)                     # its loop's half-width across the plane, at the knuckle and at the nose
GATE_R = 8.0
CLASP_TOP = (330, 95)                        # where it hangs on the hook: the inside of the strap's top
RING_THROUGH = 40                            # the split ring's turn through the eye from straight front-to-back (degrees)
RING_R, RING_W = 0.0339, 0.0036             # the split rings (IMG_3117-measured: 0.75 cm across): to the wire's middle, the wire
GAP = 0.32                                   # a split ring's cut (radians of the circle left open)
TAB_HOLE = 0.0048                            # the end caps' pierced tabs: the hole's radius


def base_half(x, y):
    """The base's half-thickness, blended between the BASE_T points."""
    num, den = np.zeros(x.shape, dtype=np.float32), np.zeros(x.shape, dtype=np.float32)
    for (px, py), t in BASE_T:
        w = np.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * 45.0 ** 2)) + 1e-6
        num, den = num + w * t, den + w
    return num / den


def gate_loop(place):
    """The gate: a closed loop of round wire in the plane through its line and the clasp's normal, a tapered rectangle
    with rounded corners (narrow at the knuckle, wide at the nose)."""
    (kx, ky), (nx, ny) = GATE_K, GATE_N
    L = math.hypot(nx - kx, ny - ky)
    ux, uy = (nx - kx) / L, (ny - ky) / L
    hk, hn = GATE_HALF
    rc = 16.0                                  # corner radius
    corners = [(0.0, -hk), (L, -hn), (L, hn), (0.0, hk)]
    pts = []
    for i, (s0, z0) in enumerate(corners):
        (sp, zp), (sn, zn) = corners[i - 1], corners[(i + 1) % 4]
        def toward(sa, za, sb, zb, d):
            l = math.hypot(sb - sa, zb - za)
            return sa + (sb - sa) * d / l, za + (zb - za) * d / l
        a = toward(s0, z0, sp, zp, rc)
        b = toward(s0, z0, sn, zn, rc)
        for t in (0.0, 0.5, 1.0):                # a quadratic round over the corner
            s_ = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * s0 + t * t * b[0]
            z_ = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * z0 + t * t * b[1]
            pts.append((s_, z_))
        if i in (0, 2):                          # the long legs: a few points along each
            for f in (0.33, 0.66):
                (s1, z1) = corners[(i + 1) % 4]
                pts.append((b[0] + (toward(s1, z1, s0, z0, rc)[0] - b[0]) * f, b[1] + (toward(s1, z1, s0, z0, rc)[1] - b[1]) * f))
    return [place(kx + ux * s_, ky + uy * s_, z_) for s_, z_ in pts]


def keyring(m):
    """The spring-gate snap clasp, its gate, and the split ring through its eye (the keyring's node)."""
    k = K.Kit("keychain_ring")
    hole_low = (CLASP_HOLE[0][0], CLASP_HOLE[0][1] + CLASP_HOLE[1][1])
    place = placer(CLASP_TOP, hole_low, (0.0, 0.0, 0.0), CPX)
    f = Field(20, 640, 30, 750, -58, 58, vox=1.9)
    body = f.strap(CLASP_BAR, STRAP_T)
    body = smin(body, f.ellipsoid(CLASP_NOSE[0], (CLASP_NOSE[1],) * 3), 5.0)
    body = smin(body, f.slab(CLASP_BASE, base_half), 8.0)
    body = smin(body, f.ellipsoid(CLASP_KNUCKLE[0], CLASP_KNUCKLE[1]), 8.0)
    (hx, hy), (ha, hb) = CLASP_HOLE
    hole = (np.sqrt(((f.X - hx) / ha) ** 2 + ((f.Y - hy) / hb) ** 2) - 1.0) * hb
    f.d = -smin(-body, hole, 12.0)         # cut the eye through, its edge bevelled round
    f.mesh(k, m["metal"], SILVER, 1900, place)
    print(f"SIZE clasp {f.size[1] * 10:.2f} cm long, {f.size[0] * 10:.2f} wide, {f.size[2] * 10:.2f} thick")
    k.tube(gate_loop(place), GATE_R * CPX, m["metal"], SILVER, n=6, closed_path=True)
    # the split ring, threaded through the eye and hanging from its bottom, turned through it; its cut up the side
    low = place(*hole_low)
    cy = low[1] + RING_W - RING_R
    t = math.radians(RING_THROUGH)
    ring(k, m, (low[0], cy, 0.0), RING_R, RING_W, ((math.sin(t), 0, math.cos(t)), (0, 1, 0)), n=18, gap=0.9)
    return finish(k, 0.0), -(cy - RING_R)      # the chain's top cap hangs from the ring's bottom


def end_cap(k, m, hole_y, down, normal):
    """A snake chain's end cap (IMG_3113-3115): a long smooth bullet, a crimped collar where the chain goes in, and at
    its tip a flat pierced tab the split ring goes through. hole_y: the tab's hole; down: the bullet runs down from it;
    normal: the tab's face (the ring's wire runs through it)."""
    s = -1 if down else 1
    nx, ny, nz = normal
    k.lathe((0.0, hole_y, 0.0), [(TAB_HOLE, -0.0018), (0.0084, -0.0018), (0.0093, 0.0), (0.0084, 0.0018), (TAB_HOLE, 0.0018),
                                 (TAB_HOLE, -0.0018)], m["metal"], SILVER, d=(nx, ny, nz), n=10)
    # IMG_3117-measured: 0.70 cm from the tab's tip to the collar, 0.37 across
    k.lathe((0.0, hole_y + s * 0.0042, 0.0), [(0, 0), (0.0051, 0.001), (0.0087, 0.0072), (0.0128, 0.0204), (0.016, 0.0372),
                                            (0.0176, 0.051), (0.0185, 0.0526), (0.0185, 0.0564), (0.0156, 0.0576), (0, 0.0576)],
            m["metal"], SILVER, d=(0, s, 0), n=8)


def snake(k, m, y0, y1):
    """The snake chain: a tight spiral of beaded scales; each turn tilted like a spring's coil."""
    pitch, r, n = 0.0077, 0.0167, 6               # IMG_3117-measured: 0.33 cm across
    turns = int(round(abs(y1 - y0) / pitch))
    rings, uvs = [], []
    for j in range(2 * turns + 1):
        yc = y0 + (y1 - y0) * j / (2 * turns)
        rr = r * (1.0 if j % 2 == 0 else 0.86)
        rings.append([(math.cos(math.tau * i / n) * rr, yc + 0.3 * pitch * math.sin(math.tau * i / n), math.sin(math.tau * i / n) * rr)
                      for i in range(n)])
        uvs.append([(i / n, j / 2) for i in range(n + 1)])
    for end in (0, -1):                           # closed ends
        rings.insert(0 if end == 0 else len(rings), [(0.0, y0 if end == 0 else y1, 0.0)])
        uvs.insert(0 if end == 0 else len(uvs), [(0.5, 0.0)])
    k.ring_grid(rings, uvs, m["metal"], SILVER)


def chain(m, i, ring_h):
    """The chain between the split rings, as four swinging parts: the top end cap, the snake chain in two, the bottom
    end cap. Each part's origin is where it hangs."""
    k = K.Kit(f"keychain_chain_{i}")
    t = math.radians(RING_THROUGH)
    if i == 0:      # hangs from the top split ring's bottom wire: its tab's hole top on the wire
        end_cap(k, m, RING_W - TAB_HOLE, True, (math.sin(t), 0, math.cos(t)))
    elif i == 3:    # the body's split ring hangs from its tab
        end_cap(k, m, -LINK + TAB_HOLE - RING_W, False, (0, 0, 1))
    else:
        snake(k, m, 0.02 if i == 1 else 0.0, -LINK - (0.02 if i == 2 else 0.0))
    return finish(k, -(ring_h + LINK * i))


def rounded_square(a, p=6.0):
    """The radius of a rounded square of half-width a at angle t (a superellipse)."""
    return lambda t: a / (abs(math.cos(t)) ** p + abs(math.sin(t)) ** p) ** (1 / p)


def loft(k, mat, col, rings_, n=24, cap=None):
    """Rounded-square sections along the switch's axis (game −z): [(half-width, z, centre y)], joined; `cap` closes the
    last ring flat."""
    rings = []
    for a, z, cy in rings_:
        f = rounded_square(a, 5.0)
        rings.append([(math.cos(math.tau * i / n) * f(math.tau * i / n), cy + math.sin(math.tau * i / n) * f(math.tau * i / n), z) for i in range(n)])
    uvs = [[(i / n, j) for i in range(n + 1)] for j in range(len(rings))]
    k.ring_grid(rings, uvs, mat, col)
    if cap:
        last = rings[-1]
        cen = (0.0, rings_[-1][2], rings_[-1][1])
        for i in range(n):
            k.face([k.vert(p) for p in (cen, last[(i + 1) % n], last[i])], [(0.5, 0.5)] * 3, mat, col)
    return rings


# ---- the lobster clasp (crop-lobster-clasp-3099.jpg): its tail eye on top; a curved teardrop body, its back convex
# down the left and round the bottom into the hook; the gate down the right to the hook's tip, a seam groove along
# where it meets the body; the trigger, a pointed thumb-tab, sticking out to the right near the top.
LOB_PX = PX * 0.886                                     # IMG_3117-measured: 0.70 cm long
LOB_EYE = ((115, 110), 16.0, 5.0)
LOB_OUT = [(108, 132), (100, 150), (97, 175), (96, 205), (97, 240), (100, 270), (108, 300), (120, 322), (138, 338), (155, 345),
           (175, 343), (193, 333), (207, 318), (216, 300), (220, 280), (221, 255), (218, 232), (210, 215), (200, 203),
           (186, 188), (168, 170), (148, 152), (131, 138), (122, 130)]
LOB_HOLE = [(121, 243), (124, 272), (133, 297), (149, 313), (165, 317), (181, 312), (194, 297), (200, 278), (201, 257),
            (197, 243), (188, 236), (170, 234), (146, 235), (128, 237)]
LOB_TRIGGER = [((168, 176), 9.5), ((186, 180), 9), ((203, 186), 8), ((217, 194), 7)]   # out and down, near the tail
LOB_KNOB = ((222, 198), 7.5)
LOB_SEAM = [(126, 150), (158, 175), (188, 200), (204, 226), (211, 256), (211, 290), (209, 306), (222, 314)]
LOB_HANG = (115, 94)                                    # the eye's top wire, on the split ring
LOB_PULL = (160, 317)                                   # inside the hook's bottom, under the lug's bar
LUG = (0.019, 0.011, 0.054, 0.021, 0.029)               # the block's clear lug (IMG_3113, 3117): thickness, bar, width, hole high, hole wide


def seg_dist2(x, y, path):
    d = np.full(x.shape, 1e9, dtype=np.float32)
    for (ax, ay), (bx, by) in zip(path, path[1:]):
        ex, ey, wx, wy = bx - ax, by - ay, x - ax, y - ay
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0.0, 1.0)
        d = np.minimum(d, (wx - ex * t) ** 2 + (wy - ey * t) ** 2)
    return np.sqrt(d)


def lob_half(x, y):
    """The lobster's half-thickness: fullest in the teardrop, slimmer down the gate's side."""
    return 19.0 + 4.0 * np.exp(-((x - 142.0) ** 2 + (y - 188.0) ** 2) / 2500.0) - 3.0 * np.clip((x - 175.0) / 40.0, 0.0, 1.0)


def lobster(k, m, hang_y):
    """The lobster clasp hanging from the jump ring (its eye's top wire at game y hang_y); returns where its hook holds
    the block's loop (game y)."""
    place = placer(LOB_HANG, LOB_PULL, (0.0, hang_y, 0.0), LOB_PX)
    f = Field(76, 245, 84, 352, -26, 26, vox=1.0)
    (ex, ey), R, r = LOB_EYE
    body = f.slab(LOB_OUT, lob_half, holes=[LOB_HOLE], round_in=34.0)
    body = smin(body, f.torus((ex, ey), R, r), 4.0)
    body = smin(body, f.sweep(LOB_TRIGGER, sz=0.5), 5.0)
    body = smin(body, f.ellipsoid(LOB_KNOB[0], (LOB_KNOB[1], LOB_KNOB[1], LOB_KNOB[1] * 0.8)), 2.0)
    # the seam: a groove where the gate meets the body, pressed into both faces
    seam = seg_dist2(f.x2, f.y2, LOB_SEAM)[:, :, None]
    f.d = body + 2.4 * np.exp(-(seam / 2.0) ** 2)
    f.mesh(k, m["metal"], SILVER, 1100, place)
    print(f"SIZE lobster {f.size[1] * 10:.2f} cm long, {f.size[0] * 10:.2f} wide")
    return place(*LOB_PULL)[1]


def body(m):
    """The split ring, the lobster clasp hooked through the block's lug, and the acrylic block with the switch seated
    in it: the bottom housing in the block, the seam, the top housing with its four corner clips and its LED window
    (IMG_3116) standing out of the block's front (−z here; the whole thing is turned to face +z at the end), the gold
    pins through the base. Its origin is where the split ring hangs from the chain's bottom end cap."""
    k = K.Kit("keychain_body")
    ring(k, m, (0.0, -RING_R, 0.0), RING_R, RING_W, YZ, n=18, gap=-0.9)      # the split ring, through the end cap's tab
    pull = lobster(k, m, -2 * RING_R + RING_W + LOB_EYE[2] * LOB_PX)
    # the block's lug: a clear tab standing off the block's top with a rectangular hole the lobster's hook goes through
    # (its top bar resting on the hook), the hole across the lobster's plane
    lt, lb, lw, lh, lhw = LUG
    k.rbox((0.0, pull + lb / 2, 0.0), (lt, lb, lw), 0.002, m["glass"], ACRYLIC, segs=1)
    for zs in (-1, 1):
        k.rbox((0.0, pull - lh / 2 + 0.001, zs * (lhw + (lw - lhw) / 2) / 2), (lt, lh + 0.004, (lw - lhw) / 2), 0.002, m["glass"], ACRYLIC, segs=1)
    top = pull - lh
    bx, by, bz = BLOCK
    cy = top - by / 2
    k.rbox((0.0, cy, 0.0), BLOCK, 0.02, m["glass"], ACRYLIC, segs=2)
    zp = -bz / 2                                       # the plate: the block's front face
    k.rbox((0.0, cy, zp + 0.045), (0.14, 0.14, 0.09), 0.01, m["paint"], HOUSING, segs=1)              # the bottom housing
    k.lathe((0.0, cy, zp + 0.09), [(0, 0), (0.02, 0), (0.02, 0.028), (0.014, 0.034), (0, 0.034)], m["paint"], HOUSING, d=(0, 0, 1), n=8)   # its centre post
    for px, py in ((-0.03, 0.025), (0.035, -0.01)):
        k.lathe((px, cy + py, zp + 0.09), [(0, 0), (0.0072, 0), (0.0072, 0.036), (0, 0.04)], m["metal"], GOLD, d=(0, 0, 1), n=6)  # the pins
    k.rbox((0.0, cy, zp - 0.002), (0.15, 0.15, 0.006), 0.003, m["paint"], SEAM, segs=1)                 # the seam
    # the top housing: a rounded square narrowing to its top, open where the stem stands
    loft(k, m["paint"], HOUSING, [(0.078, zp - 0.004, cy), (0.076, zp - 0.02, cy), (0.062, zp - 0.06, cy)], cap=True)
    for sx_ in (-1, 1):
        for sy_ in (-1, 1):
            k.rbox((sx_ * 0.07, cy + sy_ * 0.07, zp - 0.014), (0.022, 0.022, 0.02), 0.004, m["paint"], HOUSING, segs=1)  # the corner clips
    k.rbox((0.043, cy, zp - 0.0602), (0.013, 0.036, 0.002), 0.0008, m["paint"], LED, segs=1)                    # the LED window, clearer
    return k, cy


def stem(m, cy):
    """The yellow stem: its column standing out of the top housing, the cross (+) the keycap fits on."""
    k = K.Kit("keychain_stem")
    zp = -BLOCK[2] / 2
    k.rbox((0.0, cy, zp - 0.07), (0.05, 0.05, 0.03), 0.005, m["paint"], STEM, segs=1)
    for w, h in ((0.044, 0.013), (0.013, 0.044)):
        k.rbox((0.0, cy, zp - 0.097), (w, h, 0.026), 0.003, m["paint"], STEM, segs=1)
    return finish(k, 0.0)


def keycap(m, cy):
    """The keycap: navy, a rounded square that narrows to its slightly dished top; the top is the logo."""
    k = K.Kit("keychain_keycap")
    bz = BLOCK[2]
    z0, z1 = -bz / 2 - 0.075, -bz / 2 - 0.155          # its foot (over the top housing) and its top, out along −z
    n = 28
    base, top = rounded_square(0.09), rounded_square(0.066)
    prof = [(base, z0), (base, z0 - 0.01), (top, z1 + 0.006)]
    rings = []
    for f, z in prof:
        rings.append([(math.cos(math.tau * i / n) * f(math.tau * i / n), cy + math.sin(math.tau * i / n) * f(math.tau * i / n), z) for i in range(n)])
    uvs = [[(i / n, j) for i in range(n + 1)] for j in range(len(rings))]
    k.ring_grid(rings, uvs, m["paint"], NAVY)
    # its underside: a navy rim and the socket the stem's cross goes into, so it reads as a keycap when it's off
    inner = rounded_square(0.078)
    rim = [(math.cos(math.tau * i / n) * inner(math.tau * i / n), cy + math.sin(math.tau * i / n) * inner(math.tau * i / n), z0 - 0.004) for i in range(n)]
    k.ring_grid([rings[0], rim], [[(i / n, 0) for i in range(n + 1)], [(i / n, 1) for i in range(n + 1)]], m["paint"], NAVY)
    k.rbox((0.0, cy, z0 - 0.03), (0.03, 0.03, 0.05), 0.004, m["paint"], "#1a2036", segs=1)            # the socket
    # the top: a fan over the rounded square with planar UVs, the mark upright when it hangs (the camera looks along
    # +z, so the image's right is game −x)
    edge = rings[-1]
    S = 0.132
    cen = (0.0, cy, z1 + 0.003)                         # a slight dish
    for i in range(n):
        a, b = edge[i], edge[(i + 1) % n]
        tri = [cen, b, a]
        uv = [(0.5 - p[0] / S, 0.5 + (p[1] - cy) / S) for p in tri]
        k.face([k.vert(p) for p in tri], uv, m["logo"], "#ffffff")
    return finish(k, 0.0)


def finish(k, top_y):
    """Close the kit (built in its own frame: the point it hangs from at 0) as an object placed at game (0, top_y, 0)."""
    ob = k.finish(name=k.name, smooth_deg=55)
    ob.location = K.G(0, top_y, 0)
    return ob


def main():
    K.reset()
    m = mats()
    ring, ring_h = keyring(m)
    links = [chain(m, i, ring_h) for i in range(4)]
    kb, cy = body(m)
    top = cy + BLOCK[1] / 2
    cap = keycap(m, cy)
    st = stem(m, cy)
    # the block, the switch and the keycap at their measured size: scaled about the middle of the block's top
    for v in kb.bm.verts:
        if v.co.z < top + 1e-4:
            v.co.x, v.co.y, v.co.z = v.co.x * BODY_S, v.co.y * BODY_S, top + (v.co.z - top) * BODY_S
    for o in (cap, st):
        for v in o.data.vertices:
            v.co.x, v.co.y, v.co.z = v.co.x * BODY_S, v.co.y * BODY_S, top + (v.co.z - top) * BODY_S
    cy = top - (top - cy) * BODY_S
    body_ob = finish(kb, -(ring_h + 4 * LINK))
    # the swing's links (lib/game/keychainSwing.ts KEYCHAIN_LINKS): the keyring, the chain's four, the body to the block's middle
    print(f"LINKS [{ring_h:.4f}, {LINK}, {LINK}, {LINK}, {LINK}, {-cy:.4f}]  hangs {ring_h + 4 * LINK - cy + BLOCK[1] * BODY_S / 2:.4f}")
    # the keycap and the stem: built in the body's frame, children of the body
    for o in (cap, st):
        o.location = (0, 0, 0)
        o.parent = body_ob
    obs = [ring, *links, body_ob, st, cap]
    # Built facing −z; turn every part half a turn about the hanging axis so the keycap faces +z (a turn, not a mirror:
    # the mark still reads true). Blender's z is the game's up.
    for o in obs:
        for v in o.data.vertices:
            v.co.x, v.co.y = -v.co.x, -v.co.y
    print("tris", sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons))
    K.export(obs, OUT)


main()
