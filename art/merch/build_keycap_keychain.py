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
  keychain_body     the lower jump ring, the lobster clasp, the block, the switch and its pins
  keychain_keycap   (a child of the body) the keycap; it moves −z, into the switch, on a press
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

NAVY, HOUSING, STEM, ACRYLIC, SILVER = "#222a44", "#efece4", "#f2c61f", "#f4eef3", "#d9dce0"
# Hanging layout (game units, y down from the keyring's top)
RING_H = 0.30            # the keyring and the upper jump ring
LINK = 0.095             # one of the chain's four links
BLOCK = (0.19, 0.20, 0.17)
KEYCAP_PRESS = 0.035     # how far the keycap goes in on a press (the engine reads it from the node's extras)


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
    """The spring-gate keyring: a teardrop ring of wire, its straight gate down one side, and the upper jump ring."""
    k = K.Kit("keychain_ring")
    r = 0.011
    pts = []
    for i in range(28):
        a = math.tau * i / 28
        # a teardrop: round at the top, drawn in toward the bottom where the jump ring hangs
        x = math.sin(a) * 0.105 * (1 - 0.35 * max(0.0, -math.cos(a)))
        y = -0.115 + math.cos(a) * 0.115
        pts.append((x, y, 0.0))
    k.tube(pts, r, m["metal"], SILVER, n=7, closed_path=True)
    k.tube([(0.07, -0.05, 0.012), (0.03, -0.205, 0.012)], 0.007, m["metal"], SILVER, n=6, caps=True)   # the gate
    k.blob((0.0, -0.232, 0.0), (0.022, 0.016, 0.016), m["metal"], SILVER, segs=8, rings=5)                # the crimp at its foot
    jump(k, m, (0.0, -0.265, 0.0), 0.032, axis="z")
    return finish(k, 0.0)


def jump(k, m, c, R, axis="z", r=0.0065):
    pts = [(c[0] + (math.cos(math.tau * i / 14) * R if axis == "z" else 0), c[1] + math.sin(math.tau * i / 14) * R,
            c[2] + (math.cos(math.tau * i / 14) * R if axis == "x" else 0)) for i in range(14)]
    k.tube(pts, r, m["metal"], SILVER, n=6, closed_path=True)


def chain(m, i):
    """One link of the snake chain: a ribbed rod; the first and last carry the crimped end caps."""
    k = K.Kit(f"keychain_chain_{i}")
    n = 10
    path = [(0.0, -LINK * j / n, 0.0) for j in range(n + 1)]
    radii = [1.0 if j % 2 == 0 else 0.86 for j in range(n + 1)]
    k.tube(path, 0.011, m["metal"], SILVER, n=7, caps=True, radii=radii)
    if i == 0:
        k.lathe((0, 0.004, 0), [(0, 0), (0.016, 0.006), (0.017, 0.035), (0, 0.04)], m["metal"], SILVER, d=(0, -1, 0), n=8)
    if i == 3:
        k.lathe((0, -LINK - 0.004, 0), [(0, 0), (0.016, 0.006), (0.017, 0.035), (0, 0.04)], m["metal"], SILVER, d=(0, 1, 0), n=8)
    return finish(k, -(RING_H + LINK * i))


def rounded_square(a, p=6.0):
    """The radius of a rounded square of half-width a at angle t (a superellipse)."""
    return lambda t: a / (abs(math.cos(t)) ** p + abs(math.sin(t)) ** p) ** (1 / p)


def body(m):
    """The lower jump ring, the lobster clasp, and the acrylic block with the switch seated in it (top at 0)."""
    k = K.Kit("keychain_body")
    jump(k, m, (0.0, -0.03, 0.0), 0.028, axis="x")
    # the lobster clasp: a teardrop body, its trigger, and the eye it hangs from
    k.tube([(0.0, -0.058, 0.0), (0.0, -0.07, 0.0)], 0.009, m["metal"], SILVER, n=6, caps=True)
    k.blob((0.0, -0.105, 0.0), (0.017, 0.038, 0.011), m["metal"], SILVER, segs=10, rings=7)
    k.tube([(0.015, -0.09, 0.0), (0.024, -0.105, 0.0), (0.016, -0.125, 0.0)], 0.005, m["metal"], SILVER, n=5, caps=True)
    jump(k, m, (0.0, -0.152, 0.0), 0.02, axis="z", r=0.005)                                             # the clasp's hook
    # the block's loop: a clear tab with a hole, on the block's top
    top = -0.175
    k.tube([(math.cos(math.tau * i / 12) * 0.018, top - 0.004 + math.sin(math.tau * i / 12) * 0.018, 0.0) for i in range(12)],
           0.009, m["glass"], ACRYLIC, n=6, closed_path=True)
    bx, by, bz = BLOCK
    cy = top - 0.018 - by / 2
    k.rbox((0.0, cy, 0.0), BLOCK, 0.02, m["glass"], ACRYLIC, segs=2)
    # the switch: the bottom housing in the block, the top housing standing out of its front (−z), the stem, the pins
    k.rbox((0.0, cy, -0.0275), (0.14, 0.14, 0.115), 0.012, m["paint"], HOUSING, segs=1)
    k.rbox((0.0, cy, -bz / 2 - 0.018), (0.14, 0.14, 0.04), 0.012, m["paint"], HOUSING, segs=1)
    k.rbox((0.0, cy, -bz / 2 - 0.045), (0.05, 0.05, 0.03), 0.006, m["paint"], STEM, segs=1)
    for px in (-0.03, 0.035):
        k.lathe((px, cy + (0.025 if px > 0 else -0.01), 0.03), [(0, 0), (0.006, 0), (0.006, 0.042), (0, 0.042)], m["metal"], SILVER, d=(0, 0, 1), n=6)
    return finish(k, -(RING_H + 4 * LINK)), cy


def keycap(m, cy):
    """The keycap: navy, a rounded square that narrows to its slightly dished top; the top is the logo."""
    k = K.Kit("keychain_keycap")
    bz = BLOCK[2]
    z0, z1 = -bz / 2 - 0.045, -bz / 2 - 0.125          # its foot (by the housing) and its top, out along −z
    n = 28
    base, top = rounded_square(0.09), rounded_square(0.066)
    prof = [(base, z0), (base, z0 - 0.01), (top, z1 + 0.006)]
    rings = []
    for f, z in prof:
        rings.append([(math.cos(math.tau * i / n) * f(math.tau * i / n), cy + math.sin(math.tau * i / n) * f(math.tau * i / n), z) for i in range(n)])
    uvs = [[(i / n, j) for i in range(n + 1)] for j in range(len(rings))]
    k.ring_grid(rings, uvs, m["paint"], NAVY)
    # the top: a fan over the rounded square with planar UVs, the mark upright when it hangs (the camera looks along +z,
    # so the image's right is game −x)
    edge = rings[-1]
    S = 0.132
    cen = (0.0, cy, z1 + 0.003)                         # a slight dish
    for i in range(n):
        a, b = edge[i], edge[(i + 1) % n]
        tri = [cen, b, a]
        uv = [(0.5 - p[0] / S, 0.5 + (p[1] - cy) / S) for p in tri]
        k.face([k.vert(p) for p in tri], uv, m["logo"], "#ffffff")
    ob = finish(k, 0.0)
    return ob


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
    # the keycap: built in the body's frame, a child of the body
    cap.location = (0, 0, 0)
    cap.parent = body_ob
    cap["press"] = KEYCAP_PRESS
    obs = [ring, *links, body_ob, cap]
    # Built facing −z; turn every part half a turn about the hanging axis so the keycap faces +z (a turn, not a mirror:
    # the mark still reads true). Blender's z is the game's up.
    for o in obs:
        for v in o.data.vertices:
            v.co.x, v.co.y = -v.co.x, -v.co.y
    print("tris", sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons))
    K.export(obs, OUT)


main()
