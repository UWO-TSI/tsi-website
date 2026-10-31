"""The beach volleyball net, phase 2 (game/volleyball). David, 2026-10-30: "the net needs proper remodeling to look cooler
and better modeled"; the concept (specs/evidence/volleyball/p2/p2-net-concept.png) approved through the coordinator.

Direction: a cosy, chunky sports net in the island's soft style, not a realistic rig. Two round white poles in navy
padded sleeves (rounded ends, two white piping bands), coral dome caps; metal collars where the top and bottom cables
meet the poles and a small crank tensioner on one; a cable from each pole top to a squat canvas sandbag behind it. A wide
crisp white top band with navy piping on both edges and a dashed line of navy stitching; a narrower bottom band; white
side bands over the sidelines with red and white antennae; a dark navy cord mesh of true 10 cm squares, sagging a touch
toward the middle. Sized from the grown court (lib/game/volleyball/court.ts, COURT_GROW plan 1.3, net 1.15).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/props/build_volleyball_net.py [-- review <dir>]

Writes, under web/public/assets/game/props/, in game units at scale 1, the net along x, the origin on the sand under its
middle (y 0):
  volleyball-net-hd.glb  the high-def net (the players' close view in a match): round cords, piping, stitching.
  volleyball-net.glb     the low-poly net (the world, passers-by), retopologised from the high-def: the same profiles,
                         paths and colour zones at fewer sides and segments (three-sided cords, the piping and stitching
                         as colour rows on the band), the silhouette and colours unchanged.
Materials: the shared presets P_Paint (poles, caps, antennae, the crank's handle), P_Cloth (sleeves, bands, cord, piping,
sandbags) and P_Metal (collars, cables, the crank), colours in COLOR_0.
"""
import math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = "game/props/"
S = (1.045 * 1.3) / 1.75                          # court.ts COURT_SCALE (1 m)
HALF_W = 4 * S * 1.3                              # COURT.halfWidth (COURT_GROW.plan 1.3)
POST_X = HALF_W + 0.7 * S                         # COURT.postX
TOP, BOT = 2.43 * S * 1.15, 1.43 * S * 1.15       # COURT.netTop, COURT.netBottom (COURT_GROW.net 1.15)
NET_X = HALF_W + 0.3 * S                          # the mesh runs a little past the sidelines
ANT = 0.8 * S * 1.15                              # the antennae over the tape
H = TOP + 0.3                                     # the poles' tops (under their caps)
BAG_X = POST_X + 1.25                             # the sandbags behind the poles
CELL = 0.1 * S * 1.15                             # the mesh's square
NAVY, CORAL, WHITE, CORD, POLE, BAG, STEEL, DARK = "#2c4a6e", "#e8553c", "#f6f2e8", "#27303b", "#e7e3da", "#d8c194", "#9aa3ad", "#5d6670"
SLEEVE_TOP = 2.0

HD = dict(post=20, cord=4, row_pts=25, band_seg=96, rows=True, piping=True, ant=8, bag=(16, 9), collar=16, cable=6)
LP = dict(post=10, cord=3, row_pts=9, band_seg=12, rows=False, piping=False, ant=4, bag=(8, 5), collar=8, cable=3)


def sag(x):
    return 0.03 * (1 - (x / NET_X) ** 2)


def paint(faces, col_of, k):
    """Colour each face by its centre's game height: one surface of revolution, several painted zones."""
    for f in faces:
        y = sum(v.co.z for v in f.verts) / len(f.verts)       # Blender z is game y
        c = (*K.lin(col_of(y)), 1.0)
        for lp in f.loops:
            lp[k.col] = c


def post(k, s, q, Mp, Mc, Mm):
    x = s * POST_X
    # One profile from the foot (sunk, so a sloping beach never shows it) up through the sleeve to the cap.
    prof = [(0.0, -0.5), (0.055, -0.5), (0.055, -0.02), (0.1, -0.02), (0.112, 0.02), (0.115, 0.06),
            (0.115, 0.33), (0.12, 0.345), (0.12, 0.375), (0.115, 0.39),
            (0.115, 1.58), (0.12, 1.595), (0.12, 1.625), (0.115, 1.64),
            (0.115, SLEEVE_TOP - 0.06), (0.108, SLEEVE_TOP - 0.015), (0.095, SLEEVE_TOP), (0.058, SLEEVE_TOP), (0.055, SLEEVE_TOP + 0.01),
            (0.055, H - 0.03), (0.07, H - 0.02), (0.078, H), (0.078, H + 0.05), (0.066, H + 0.09), (0.036, H + 0.112), (0.0, H + 0.118)]
    if q is LP:
        # The same profile with its bevels and the piping's bulge left out: the piping stays as its colour band.
        prof = [(0.1, -0.3), (0.115, 0.06), (0.115, 0.345), (0.115, 0.375), (0.115, 1.595), (0.115, 1.625), (0.115, SLEEVE_TOP - 0.06),
                (0.095, SLEEVE_TOP), (0.055, SLEEVE_TOP + 0.01), (0.055, H - 0.03), (0.078, H), (0.078, H + 0.05), (0.036, H + 0.112), (0.0, H + 0.118)]

    def zone(y):
        if y > H - 0.025:
            return CORAL
        if y > SLEEVE_TOP + 0.005 or y < -0.01:
            return POLE
        return WHITE if (0.34 < y < 0.38 or 1.59 < y < 1.63) else NAVY
    paint(k.lathe((x, 0, 0), prof, Mc, NAVY, n=q["post"]), zone, k)
    # The cable collars: one on the bare pole at the top cable, one round the sleeve at the bottom cable.
    for y, r in ((TOP - 0.03, 0.068), (BOT + 0.03, 0.126)):
        k.lathe((x, y - 0.04, 0), [(r - 0.01, 0.0), (r, 0.008), (r, 0.072), (r - 0.01, 0.08)], Mm, STEEL, n=q["collar"])
        a = (s * NET_X, y - sag(s * NET_X), 0)
        k.tube([a, (x - s * (r + 0.002), y, 0)], 0.008, Mm, DARK, n=q["cable"])
    # The guy cable to the sandbag, and the bag: a squat canvas pillow with a navy strap over it.
    bx = s * BAG_X
    k.tube([(x - s * 0.0, H - 0.04, 0), (bx - s * 0.05, 0.17, 0)], 0.01, Mm, DARK, n=q["cable"])
    seg, rings = q["bag"]
    k.blob((bx, 0.095, 0), (0.2, 0.105, 0.14), Mc, BAG, segs=seg, rings=rings, seed=3 if s > 0 else 4, lumpy=0.1, flat_bottom=-0.095)
    if q is HD:
        k.tube([(bx, 0.0, -0.15), (bx, 0.1, -0.142), (bx, 0.205, -0.05), (bx, 0.212, 0.05), (bx, 0.1, 0.142), (bx, 0.0, 0.15)], 0.012, Mc, NAVY, n=6)
    # The antenna: one rod, painted red and white in bands, from the mesh's foot to over the tape.
    n_bands = 12
    ys = list(np.linspace(BOT, TOP + ANT, n_bands + 1))
    rod = [(0.0, BOT - 0.005)] + [(0.016, y) for y in ys] + [(0.008, TOP + ANT + 0.012), (0.0, TOP + ANT + 0.016)]
    band_h = (TOP + ANT - BOT) / n_bands
    paint(k.lathe((s * HALF_W, 0, 0.035), rod, Mp, WHITE, n=q["ant"]),
          lambda y: CORAL if int(max(0.0, y - BOT) / band_h) % 2 else WHITE, k)
    # The side band over the sideline.
    k.rbox((s * HALF_W, (BOT + TOP) / 2, 0), (0.06, TOP - BOT, 0.014), 0.005 if q is HD else 0.0, Mc, WHITE, segs=1)


def band(k, yc, h, d, q, Mc, rows):
    """A tape along the net following its sag: a box strip, its front and back split into colour rows (fractions of
    the height, bottom up, each with a colour or 'dash' for the stitching's navy dashes)."""
    n = q["band_seg"]
    xs = np.linspace(-NET_X, NET_X, n + 1)
    edges = [0.0] + [r[0] for r in rows[:-1]] + [1.0]

    def P(x, f, z):
        return (x, yc - h / 2 + h * f - sag(x), z)
    for i in range(n):
        x0, x1 = xs[i], xs[i + 1]
        for z in (-d / 2, d / 2):
            for r, (f0, f1) in enumerate(zip(edges, edges[1:])):
                col = rows[r][1]
                if col == "dash":
                    col = NAVY if i % 2 == 0 else WHITE
                q4 = [P(x0, f0, z), P(x1, f0, z), P(x1, f1, z), P(x0, f1, z)]
                k.face([k.vert(p) for p in (q4 if z > 0 else q4[::-1])], [(x0, f0), (x1, f0), (x1, f1), (x0, f1)], Mc, col)
        for f, flip in ((0.0, True), (1.0, False)):
            q4 = [P(x0, f, -d / 2), P(x1, f, -d / 2), P(x1, f, d / 2), P(x0, f, d / 2)]
            k.face([k.vert(p) for p in (q4[::-1] if flip else q4)], [(0, 0), (1, 0), (1, 1), (0, 1)], Mc, rows[0][1] if f == 0 else rows[-1][1])
    for x in (-NET_X, NET_X):                      # the ends
        q4 = [P(x, 0, -d / 2), P(x, 0, d / 2), P(x, 1, d / 2), P(x, 1, -d / 2)]
        k.face([k.vert(p) for p in (q4 if x > 0 else q4[::-1])], [(0, 0), (1, 0), (1, 1), (0, 1)], Mc, WHITE)


def net(q, Mp, Mc, Mm):
    k = K.Kit("volleyball-net")
    for s in (-1, 1):
        post(k, s, q, Mp, Mc, Mm)
    # The crank tensioner on the +x pole, on the sleeve facing the court's +z side.
    k.rbox((POST_X, 1.05, 0.155), (0.1, 0.16, 0.08), 0.02 if q is HD else 0.0, Mm, STEEL, segs=2 if q is HD else 1)
    k.tube([(POST_X, 1.07, 0.19), (POST_X + 0.07, 1.07, 0.215), (POST_X + 0.07, 1.0, 0.235)], 0.01, Mp, DARK, n=q["cable"])
    # The mesh: true squares, the cords round (high-def) or three-sided (low-poly).
    top_in, bot_in = TOP - 0.1, BOT + 0.06
    xs = np.linspace(-NET_X, NET_X, int(round(2 * NET_X / CELL)) + 1)
    ys = np.linspace(bot_in, top_in, max(2, int(round((top_in - bot_in) / CELL))) + 1)
    for x in xs[1:-1]:
        k.tube([(x, bot_in - 0.005 - sag(x), 0), (x, top_in + 0.005 - sag(x), 0)], 0.006, Mc, CORD, n=q["cord"], v_len=0.2)
    for y in ys:
        k.tube([(x, y - sag(x), 0) for x in np.linspace(-NET_X, NET_X, q["row_pts"])], 0.006, Mc, CORD, n=q["cord"], v_len=0.2)
    # The top band: white, the navy piping (tubes on the high-def, colour rows on the low-poly), the stitching.
    th = 0.1
    if q["rows"]:
        band(k, TOP - th / 2, th, 0.026, q, Mc, [(0.2, WHITE), (0.26, "dash"), (0.74, WHITE), (0.8, "dash"), (1.0, WHITE)])
    else:
        band(k, TOP - th / 2, th, 0.026, q, Mc, [(0.14, NAVY), (0.86, WHITE), (1.0, NAVY)])
    if q["piping"]:
        for dy in (th / 2, -th / 2):
            k.tube([(x, TOP - th / 2 + dy - sag(x), 0) for x in np.linspace(-NET_X, NET_X, 25)], 0.013, Mc, NAVY, n=6)
    # The bottom band.
    band(k, BOT + 0.03, 0.06, 0.02, dict(q, band_seg=max(6, q["band_seg"] // 2)), Mc, [(1.0, WHITE)])
    return k.finish(smooth_deg=50)


def build():
    K.reset()
    mats = K.Mat("P_Paint", rough=0.45), K.Mat("P_Cloth", rough=1.0), K.Mat("P_Metal", rough=0.4)
    hd = net(HD, *mats)
    hd.name = hd.data.name = "volleyball-net-hd"
    lp = net(LP, *mats)
    lp.name = lp.data.name = "volleyball-net"
    K.export([hd], f"{OUT}volleyball-net-hd.glb")
    K.export([lp], f"{OUT}volleyball-net.glb")
    for o in (hd, lp):
        ys = [v.co.z for v in o.data.vertices]
        xs = [v.co.x for v in o.data.vertices]
        zs = [-v.co.y for v in o.data.vertices]
        print("BOUNDS", o.name, "x", round(min(xs), 3), round(max(xs), 3), "y", round(min(ys), 3), round(max(ys), 3), "z", round(min(zs), 3), round(max(zs), 3))
    return hd, lp


def shoot(obs, path, eye, at, lens, size):
    import bpy
    sc = bpy.context.scene
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name != "sand":
            o.hide_render = o not in obs
    co = sc.camera
    co.data.lens = lens
    co.location = K.G(*eye)
    co.rotation_euler = (K.G(*at) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def review(hd, lp, out):
    import bpy
    K.show_vertex_colors([hd, lp])
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (*K.lin("#cfe6ef"), 1)
    bg.inputs[1].default_value = 0.75
    me = bpy.data.meshes.new("sand")
    me.from_pydata([K.G(-80, 0, -80), K.G(80, 0, -80), K.G(80, 0, 80), K.G(-80, 0, 80)], [], [(0, 1, 2, 3)])
    sand = bpy.data.objects.new("sand", me)
    sc.collection.objects.link(sand)
    me.materials.append(K.Mat("M_Sand", "#efdcb2", rough=1.0).m)
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy = 2.2
    so = bpy.data.objects.new("Key", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cam = bpy.data.cameras.new("C")
    cam.clip_end = 600
    co = bpy.data.objects.new("C", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    mid = TOP * 0.6
    # The high-def as the player sees it: behind the baseline, over the shoulder; and its pole top close.
    shoot([hd], os.path.join(out, "net-hd-player.png"), (1.2, 1.9, -9.5), (0.0, mid + 0.3, 0), 24, (900, 600))
    shoot([hd], os.path.join(out, "net-hd-close.png"), (POST_X - 1.0, TOP + 0.25, -1.2), (POST_X - 0.15, TOP - 0.25, 0), 32, (600, 600))
    # The low-poly as a passer-by sees it: from the path, about 16 u off.
    shoot([lp], os.path.join(out, "net-lp-world.png"), (11.0, 4.5, -11.5), (0.0, mid, 0), 30, (900, 600))


if __name__ == "__main__":
    hd, lp = build()
    if "review" in ARGS:
        out = ARGS[ARGS.index("review") + 1]
        os.makedirs(out, exist_ok=True)
        review(hd, lp, out)
