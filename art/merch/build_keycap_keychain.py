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

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402

ROOT = K.ROOT
MARK_SVG = os.path.join(ROOT, "web", "public", "assets", "branding", "tethos-mark.svg")
OUT = "game/items/merch-tsi-keycap-keychain.glb"

NAVY, HOUSING, STEM, ACRYLIC = "#222a44", "#eeebe3", "#f2c61f", "#f4eef3"
# Polished silver and the pins' gold: mid tones, so the look reads them as metal (lookPreset: light paint stays dielectric).
SILVER, GOLD, SEAM = "#8f949a", "#b8913f", "#d3cfc4"
# Hanging layout (game units, y down from the keyring's top)
RING_H = 0.30            # the keyring and the upper jump ring
LINK = 0.095             # one of the chain's four links
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


# ================================================================ parts
def keyring(m):
    """The spring-gate keyring (IMG_3095, 3096): a pear-shaped wire loop, round at the top and drawn in to a collar at
    its foot, open on its lower right where a straight gate bar on the inner side closes it, hinged at the collar; a
    small eye under the collar, and the upper jump ring."""
    k = K.Kit("keychain_ring")
    r = 0.0095
    pts = []
    for i in range(27):
        # from the collar up the left, round the top and down the right to where the gate meets it
        a = -2.55 + 5.1 * i / 26                     # angle from the top (0), negative left
        pinch = max(0.0, -math.cos(a)) ** 1.4
        x = math.sin(a) * 0.1 * (1 - 0.62 * pinch)
        y = -0.112 + math.cos(a) * 0.112 - 0.045 * pinch
        pts.append((x, y, 0.0))
    k.tube(pts, r, m["metal"], SILVER, n=7, caps=True)
    # the gate: a straight bar on the inner side, from the hinge at the collar up to the loop's right side
    k.tube([(0.012, -0.236, 0.006), (0.064, -0.075, 0.006)], 0.0068, m["metal"], SILVER, n=6, caps=True)
    k.blob((0.064, -0.073, 0.006), (0.011, 0.011, 0.011), m["metal"], SILVER, segs=6, rings=4)      # its tip
    # the collar where the wire's ends and the gate's hinge meet, and the eye under it
    k.lathe((0, -0.232, 0), [(0, 0), (0.016, 0.003), (0.017, 0.03), (0.012, 0.036), (0, 0.036)], m["metal"], SILVER, d=(0, -1, 0), n=8)
    jump(k, m, (0.0, -0.278, 0.0), 0.012, axis="x", r=0.004, n=10)
    jump(k, m, (0.0, -0.296, 0.0), 0.022, axis="z", r=0.0055)
    return finish(k, 0.0)


def jump(k, m, c, R, axis="z", r=0.0065, n=12):
    pts = [(c[0] + (math.cos(math.tau * i / n) * R if axis == "z" else 0), c[1] + math.sin(math.tau * i / n) * R,
            c[2] + (math.cos(math.tau * i / n) * R if axis == "x" else 0)) for i in range(n)]
    k.tube(pts, r, m["metal"], SILVER, n=6, closed_path=True)


def end_cap(k, m, y, down):
    """A snake chain's crimped end: a short barrel, and the eye the jump ring goes through."""
    d = (0, -1, 0) if down else (0, 1, 0)
    k.lathe((0, y, 0), [(0, 0), (0.0125, 0.002), (0.0145, 0.012), (0.0145, 0.03), (0.01, 0.036), (0, 0.036)], m["metal"], SILVER, d=d, n=8)
    eye = y + (0.046 if not down else -0.046)
    jump(k, m, (0.0, eye, 0.0), 0.0085, axis="x", r=0.0035, n=8)


def chain(m, i):
    """One link of the snake chain: tight beads, a spring-like coil (the photos' beaded chain); the first and last carry
    the crimped end caps."""
    k = K.Kit(f"keychain_chain_{i}")
    pitch = 0.0058
    n = int(round(LINK / pitch))
    path, radii = [], []
    for j in range(n + 1):
        y = -LINK * j / n
        path.append((0.0, y, 0.0))
        radii.append(1.0 if j % 2 == 0 else 0.72)
    k.tube(path, 0.0098, m["metal"], SILVER, n=6, caps=True, radii=radii)
    if i == 0:
        end_cap(k, m, 0.032, down=True)
    if i == 3:
        end_cap(k, m, -LINK - 0.032, down=False)
    return finish(k, -(RING_H + LINK * i))


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


def lobster(k, m, top):
    """The lobster clasp (IMG_3095, 3098): its tail ring at the top, a teardrop body curling round to a hook at the
    bottom, the spring gate closing it on the inner side, and the trigger's nub on the gate."""
    y0 = top
    jump(k, m, (0.0, y0 - 0.011, 0.0), 0.0105, axis="z", r=0.004, n=10)                 # the tail ring
    path = [(0.006, y0 - 0.024), (-0.012, y0 - 0.034), (-0.026, y0 - 0.06), (-0.03, y0 - 0.09), (-0.024, y0 - 0.116),
            (-0.008, y0 - 0.132), (0.012, y0 - 0.131), (0.024, y0 - 0.118), (0.024, y0 - 0.104)]
    radii = [0.75, 1.0, 1.15, 1.2, 1.1, 0.95, 0.8, 0.65, 0.5]
    k.tube([(x, y, 0.0) for x, y in path], 0.0085, m["metal"], SILVER, n=7, caps=True, radii=radii)
    # the gate: from the tail down the inner side to just short of the hook's tip, a hair proud of the body
    k.tube([(0.009, y0 - 0.028, 0.0), (0.016, y0 - 0.065, 0.0), (0.02, y0 - 0.098, 0.0)], 0.0045, m["metal"], SILVER, n=6, caps=True)
    k.rbox((0.019, y0 - 0.045, 0.0), (0.012, 0.016, 0.01), 0.004, m["metal"], SILVER, segs=1)       # the trigger


def body(m):
    """The lower jump ring, the lobster clasp hooked through the block's loop, and the acrylic block with the switch
    seated in it: the bottom housing in the block, the seam, the top housing with its four corner clips standing out of
    the block's front (−z here; the whole thing is turned to face +z at the end), the gold pins through the base."""
    k = K.Kit("keychain_body")
    jump(k, m, (0.0, -0.026, 0.0), 0.024, axis="x", r=0.0055)
    lobster(k, m, -0.045)
    # the block's loop: a clear tab with a hole, in the plane the clasp's hook passes through
    top = -0.2
    k.tube([(0.0, top + 0.022 + math.sin(math.tau * i / 12) * 0.018, math.cos(math.tau * i / 12) * 0.018) for i in range(12)],
           0.0085, m["glass"], ACRYLIC, n=6, closed_path=True)
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
    return finish(k, -(RING_H + 4 * LINK)), cy


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
    ring = keyring(m)
    links = [chain(m, i) for i in range(4)]
    body_ob, cy = body(m)
    cap = keycap(m, cy)
    st = stem(m, cy)
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
