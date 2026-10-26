"""The new world's fish market, remodelled (game/wharf-art2; David's R2c note, 2026-10-26: "the shop should look more
similar to reference, the model of the sword fish bigger and incorperated within the build, and bigger so that its
like lunched out the building. i want a big barrel that you can sell outside for quick sell"), after
specs/references/terrain/plan-2026-10-23/wharf-fishing-hut-1.jpg: a crooked timber shop on a stone footing, jettied
upper floor, chunky orange shingles in layers, a plank porch over the door with the fish sign on it, and a huge painted
wooden swordfish bursting up out of the roof, its tail fin still caught in the back slope. Our style: simple shapes,
plain colours on one painted grain, low detail. An exterior: nobody enters it in v1.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/build_fish_market.py [-- review <dir>]

Writes, in game units at scale 1, the origin on the ground (the deck's top) at the middle of the house's floor, front +z
(the quick-sell stall outside it is art/wharf/build_sell_stall.py):
  game/buildings/fish-market.glb  the house 5.2 wide (x) by 4.2 deep on a stone footing (solid 2.75 by 2.3 with it),
                                  the upper floor jettied out to z +-2.4, a gabled roof along x (ridge 6.2), skirts of
                                  shingles over the side walls, a porch out to z 3.9 over the door (left) and a table
                                  of fish on ice (right), fish hung from the porch beam, the sign on the porch roof. The
                                  swordfish comes out of the front slope by the ridge, pitched up toward +z.

Wood is one painted grain (art/wharf/build_wharf_kit.py wood_mat) under COLOR_0, the shingles and the fish included;
rope the kit's rope; the rest the shared plain presets (P_Paint, P_Glass, P_Stone, P_Metal). Seeded: a rebuild writes
the same model.
"""
import math, os, sys
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report, wood_mat  # noqa: E402
from build_dock_decor import ROPE, lashing, ring_into  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
rng = np.random.default_rng(2701)
W, D = 5.2, 4.2                      # the ground floor: across (x), deep (z)
FOOT = 0.35                          # the stone footing's top
H1 = 2.75                            # the ground floor's top (the jetty beam)
JZ = 2.4                             # the upper floor's front and back (jettied out from D / 2)
EAVE_Z, EAVE_Y, RIDGE = 2.95, 4.0, 6.2
GABLE_X = W / 2 + 0.45               # the roof's ends
PLANK, PLANK_DARK, BEAM, BEAM_LIGHT = "#9a6542", "#6f4630", "#5a3b26", "#a77a52"
SHINGLE = ("#d9822f", "#e8973f", "#c96c2a", "#dd8a3a")
STONE = "#8e8a84"
BLUE, BLUE_DARK, BELLY, FIN = "#3f6cc0", "#2c4f94", "#efe8dc", "#2f58a8"


def roof_y(z):
    return RIDGE - (RIDGE - EAVE_Y) * abs(z) / EAVE_Z


def frame(along, down):
    """A right-handed rbox frame: local x along the row, y the face's normal (up-ish), z down the slope."""
    a, d = Vector(along).normalized(), Vector(down).normalized()
    n = d.cross(a)
    if n.y < 0:
        a = -a
        n = -n
    return Matrix((a, n, d)).transposed()


def ccw(pts):
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    return pts if area > 0 else list(reversed(pts))


# ================================================================ the swordfish (placed first: the roof leaves its hole)
_p, _y = math.radians(35), math.radians(65)
FISH_D = Vector((math.sin(_y) * math.cos(_p), math.sin(_p), math.cos(_y) * math.cos(_p)))
FISH_C = Vector((-0.3, RIDGE + 0.1, 0.3)) + FISH_D * 1.5     # it breaks out of the roof by the ridge
FISH_PROF = [(0.0, -3.0), (0.3, -2.75), (0.62, -2.2), (0.9, -1.35), (1.06, -0.45), (1.1, 0.3), (1.0, 1.05), (0.78, 1.7),
             (0.5, 2.2), (0.24, 2.48), (0.0, 2.58)]
SX = 0.72                            # the body's squash across


def fish_r(t):
    for (r0, t0), (r1, t1) in zip(FISH_PROF, FISH_PROF[1:]):
        if t0 <= t <= t1:
            return r0 + (r1 - r0) * (t - t0) / (t1 - t0)
    return 0.0


def inside_fish(p, margin=0.9):
    q = Vector(p) - FISH_C
    t = q.dot(FISH_D)
    return (q - FISH_D * t).length < fish_r(t) * SX * margin


def swordfish(k, M, Mm, Mp):
    """A painted wooden swordfish: a long spindle of blue planks over a cream belly, iron straps riveted round it, a
    long bill, a tall sail of a dorsal fin, pectoral fins splayed, big eyes; its tail fin caught in the back slope."""
    F = K.frame_along(tuple(FISH_D), (0, 1, 0))
    side, up = F.col[0], F.col[1]
    n = 12
    faces = k.lathe(tuple(FISH_C), FISH_PROF, M, BLUE, d=tuple(FISH_D), n=n, sx=SX, up=(0, 1, 0), v_len=1.6, u_tiles=3)
    for i, f in enumerate(faces):
        strip = 0.88 + 0.16 * ((i % n) * 7 % 5) / 4          # each plank its own shade
        for lp in f.loops:
            g = Vector((lp.vert.co.x, lp.vert.co.z, -lp.vert.co.y)) - FISH_C
            h = g.dot(up) / max(fish_r(g.dot(FISH_D)), 0.2)
            c = K.lin(BELLY if h < -0.25 else BLUE if h > 0.15 else mix(BLUE, BELLY, (0.15 - h) / 0.4))
            lp[k.col] = (c[0] * strip, c[1] * strip, c[2] * strip, 1.0)
    P = lambda a, b, c=0.0: FISH_C + FISH_D * a + up * b + side * c
    # The bill from the upper jaw, the mouth's line under it.
    k.lathe(tuple(P(2.3, 0.1)), [(0.24, 0.0), (0.15, 0.9), (0.07, 2.4), (0.0, 3.5)], M, "#5d7fbf", d=tuple(FISH_D), n=8, sx=0.8)
    for sg in (-1, 1):
        k.tube([tuple(P(1.55, -0.32, sg * 0.5)), tuple(P(2.05, -0.12, sg * 0.32)), tuple(P(2.35, 0.0, sg * 0.18))], 0.035, Mp, "#24365e", n=5)
        eye = P(1.6, 0.25, sg * 0.62)
        k.blob(tuple(eye), (0.24, 0.24, 0.24), Mp, "#f6f1e4", segs=9, rings=5)
        k.blob(tuple(eye + side * sg * 0.12 + FISH_D * 0.03), (0.13, 0.13, 0.13), Mp, "#1d2026", segs=8, rings=5)
        k.blob(tuple(eye + side * sg * 0.2 + FISH_D * 0.06 + up * 0.05), (0.04, 0.04, 0.04), Mp, "#ffffff", segs=4, rings=3)
    # Iron straps round the body, riveted.
    for t in (-0.2, 1.15):
        r = fish_r(t)
        k.lathe(tuple(FISH_C), [(r * 1.0, t - 0.09), (r * 1.05, t - 0.07), (r * 1.05, t + 0.07), (r * 1.0, t + 0.09)], Mm, "#5a5652",
                d=tuple(FISH_D), n=n, sx=SX, up=(0, 1, 0))
        for j in range(5):
            a = math.tau * (j + 0.5) / 5 + 0.3
            p = P(t, math.sin(a) * r * 1.07, math.cos(a) * r * 1.07 * SX)
            k.blob(tuple(p), (0.045, 0.045, 0.045), Mm, "#8a837a", segs=4, rings=3)
    # Fins, flat boards in the fish's own frame.
    def fin(outline, x_axis, y_axis, at, col, th=0.05):
        x_axis, y_axis = Vector(x_axis).normalized(), Vector(y_axis)
        y_axis = (y_axis - x_axis * y_axis.dot(x_axis)).normalized()
        R = Matrix((x_axis, y_axis, x_axis.cross(y_axis))).transposed()
        k.extrude(ccw(outline), -th, th, M, col, bevel=0.025, rot=R, at=tuple(at))
    fin([(1.1, 0.0), (0.5, 1.45), (-0.1, 1.75), (-0.75, 1.5), (-1.25, 0.0)], FISH_D, up, P(0.0, 0.85), FIN)       # the sail
    fin([(0.3, 0.0), (-0.3, 0.55), (-0.75, 0.5), (-0.5, 0.0)], FISH_D, -up, P(-1.2, -0.75), FIN)                  # under it
    for sg in (-1, 1):                                                                                              # pectorals
        out = side * sg * 0.75 - up * 0.65
        fin([(0.35, 0.0), (-0.55, 1.45), (-0.95, 1.3), (-0.45, 0.0)], FISH_D, out, P(0.95, -0.35, sg * 0.62), FIN, th=0.04)
    # The tail: a forked fin at the body's end, its upper lobe out through the back slope.
    fin([(0.25, 0.0), (-1.45, 2.1), (-0.85, 0.35), (-0.9, 0.0), (-0.85, -0.35), (-1.45, -2.1)], FISH_D, up, P(-2.95, 0.0), FIN, th=0.06)
    return P


# ================================================================ the house
def footing(k, Ms):
    """A stone footing under the walls: a low course, its face of rough set stones."""
    k.rbox((0, FOOT / 2 - 0.02, 0), (W + 0.2, FOOT - 0.04, D + 0.2), 0.03, Ms, mix(STONE, "#5f5b56", 0.4), segs=1)
    for (x0, x1, z, ax) in ((-W / 2, W / 2, D / 2 + 0.1, 0), (-W / 2, W / 2, -D / 2 - 0.1, 0), (-D / 2, D / 2, W / 2 + 0.1, 2), (-D / 2, D / 2, -W / 2 - 0.1, 2)):
        x = x0
        while x < x1 - 0.1:
            w = min(rng.uniform(0.4, 0.7), x1 - x)
            c = (x + w / 2, FOOT / 2, z) if ax == 0 else (z, FOOT / 2, x + w / 2)
            size = (w - 0.04, FOOT - rng.uniform(0.02, 0.08), 0.12) if ax == 0 else (0.12, FOOT - rng.uniform(0.02, 0.08), w - 0.04)
            k.rbox(c, size, 0.0, Ms, mix(STONE, "#b4aea4", rng.uniform(0, 0.5)), rot=K.game_rot(yaw=rng.uniform(-0.06, 0.06), roll=rng.uniform(-0.05, 0.05)), segs=1)
            x += w


def boards(k, M, x0, x1, z, along_x, lo, top_of, skip=(), n=None, col=PLANK, out=0.0):
    """Upright boards in a wall from x0 to x1 at depth z (along x, or along z when not along_x), lo up to top_of(a),
    leaving the openings in `skip` [(a0, a1, y0, y1)]."""
    n = n or int(round((x1 - x0) / 0.42))
    for i in range(n):
        a = x0 + (i + 0.5) * (x1 - x0) / n
        top = top_of(a) + rng.uniform(-0.04, 0.04)
        spans = [(lo, top)]
        for a0, a1, y0, y1 in skip:
            if a0 < a < a1:
                spans = [s for lo_, hi_ in spans for s in ((lo_, min(hi_, y0)), (max(lo_, y1), hi_)) if s[1] - s[0] > 0.05]
        c_ = mix(col, PLANK_DARK, rng.uniform(0.0, 0.45))
        zz = z + (rng.uniform(-0.01, 0.01) + out) * (1 if z > 0 else -1)
        for lo_, hi_ in spans:
            h = hi_ - lo_
            c = (a, lo_ + h / 2, zz) if along_x else (zz, lo_ + h / 2, a)
            size = ((x1 - x0) / n - 0.025, h, 0.09) if along_x else (0.09, h, (x1 - x0) / n - 0.025)
            k.rbox(c, size, 0.0, M, c_, segs=1, uv_len=1.6, v_axis=1, uv_off=(rng.random(), rng.random()))


def post(k, M, p0, p1, w=0.24, col=BEAM):
    k.beam(p0, p1, w, w, 0.03, M, mix(col, BEAM_LIGHT, rng.uniform(0, 0.25)), up=(0, 0, 1), segs=1, uv_len=1.6)


def walls(k, M, Mp, Mg):
    hx, hz = W / 2, D / 2
    door, win = (-1.9, -0.9), (0.5, 1.5)
    # The ground floor: boards all round, the door and a window in front, a window on the -x side.
    boards(k, M, -hx, hx, hz, True, FOOT, lambda a: H1, skip=[(door[0], door[1], 0, 2.25), (win[0], win[1], 1.15, 2.05)])
    boards(k, M, -hx, hx, -hz, True, FOOT, lambda a: H1)
    boards(k, M, -hz, hz, -hx, False, FOOT, lambda a: H1, skip=[(-0.6, 0.4, 1.15, 2.0)])
    boards(k, M, -hz, hz, hx, False, FOOT, lambda a: H1)
    # The upper floor, jettied out front and back; its gable ends boarded up under the roof.
    top = lambda a: roof_y(a) - 0.05
    boards(k, M, -hx - 0.05, hx + 0.05, JZ, True, H1 + 0.05, lambda a: roof_y(JZ) - 0.02, skip=[(-2.18, -1.42, 3.17, 3.93)], col=mix(PLANK, "#b07a4e", 0.3))
    boards(k, M, -hx - 0.05, hx + 0.05, -JZ, True, H1 + 0.05, lambda a: roof_y(JZ) - 0.02, col=mix(PLANK, "#b07a4e", 0.3))
    for x in (-hx - 0.05, hx + 0.05):
        boards(k, M, -JZ, JZ, x, False, H1 + 0.05, top, skip=[(-0.45, 0.45, 4.15, 5.0)] if x < 0 else [(-0.4, 0.4, 3.35, 4.15)], col=mix(PLANK, "#b07a4e", 0.3))
    # Crooked corner posts, a sill and the jetty beam with its joists' ends under the upper floor.
    for sx in (-1, 1):
        for sz in (-1, 1):
            post(k, M, (sx * hx + sx * rng.uniform(0, 0.06), FOOT - 0.05, sz * hz), (sx * hx, H1 + 0.1, sz * hz + sz * rng.uniform(0, 0.05)))
            post(k, M, (sx * (hx + 0.05), H1, sz * JZ), (sx * (hx + 0.05) + sx * 0.03, roof_y(JZ) + 0.25, sz * JZ), w=0.22)
    for z in (hz + 0.06, -hz - 0.06):
        k.beam((-hx - 0.2, FOOT + 0.08, z), (hx + 0.2, FOOT + 0.08, z), 0.16, 0.14, 0.02, M, BEAM, segs=1, uv_len=2.0)
    for x in (hx + 0.06, -hx - 0.06):
        k.beam((x, FOOT + 0.08, -hz - 0.2), (x, FOOT + 0.08, hz + 0.2), 0.16, 0.14, 0.02, M, BEAM, segs=1, uv_len=2.0)
    for z in (JZ + 0.02, -JZ - 0.02):
        k.beam((-hx - 0.35, H1 + 0.02, z), (hx + 0.35, H1 + 0.04, z), 0.2, 0.22, 0.03, M, mix(BEAM, BEAM_LIGHT, 0.2), segs=1, uv_len=2.0)
        for i in range(8):
            x = -hx + 0.3 + i * (W - 0.6) / 7
            k.beam((x, H1 - 0.12, z * 0.82), (x, H1 - 0.12, z + (0.12 if z > 0 else -0.12)), 0.14, 0.14, 0.0, M, BEAM, segs=1)
    for z in (1, -1):                                   # the jettied floor's underside
        k.rbox((0, H1 - 0.04, z * (D / 2 + JZ) / 2), (W + 0.1, 0.06, JZ - D / 2), 0.0, M, PLANK_DARK, segs=1, uv_len=1.6, v_axis=0)
    for sx in (-1, 1):                                  # braces on the side walls
        k.beam((sx * (hx + 0.05), FOOT + 0.2, -hz + 0.2), (sx * (hx + 0.05), H1 - 0.15, -0.5), 0.12, 0.1, 0.015, M, BEAM, up=(1, 0, 0), segs=1)
    # The door: dark boards with iron straps and a ring; the frame.
    dz = hz + 0.07
    for i in range(3):
        k.rbox((door[0] + 0.17 + i * 0.33, 1.3, dz - 0.03), (0.31, 1.9, 0.06), 0.01, M, mix("#5a3a2a", "#43291d", i * 0.3), segs=1, uv_len=1.2, v_axis=1)
    for y in (0.75, 1.85):
        k.rbox(((door[0] + door[1]) / 2, y, dz + 0.01), (0.9, 0.06, 0.03), 0.005, Mp, "#3d3936", segs=1)
    k.lathe((door[1] - 0.2, 1.3, dz + 0.02), [(0.06, -0.012), (0.075, 0.0), (0.06, 0.012)], Mp, "#3d3936", d=(0, 0, 1), n=8)
    for x in door:
        post(k, M, (x, FOOT, dz + 0.02), (x, 2.3, dz + 0.02), w=0.12, col=BEAM_LIGHT)
    k.beam((door[0] - 0.1, 2.3, dz + 0.03), (door[1] + 0.1, 2.32, dz + 0.03), 0.14, 0.12, 0.02, M, BEAM_LIGHT, segs=1)
    # Windows: a pane in a frame with open shutters (front and side), a little one upstairs, a round one in the gable.
    def window(c, w, h, facing, shutters=True):
        x, y, z = c
        n = Vector(facing)
        t = Vector((0, 0, 1)) if abs(n.x) > 0.5 else Vector((1, 0, 0))
        P = lambda a, b, o=0.0: tuple(Vector(c) + t * a + Vector((0, b, 0)) + n * o)
        rot = None if abs(n.z) > 0.5 else K.game_rot(yaw=math.pi / 2)
        k.rbox(P(0, 0, -0.04), (w, h, 0.03), 0.0, Mg, "#8fb8c6", rot=rot, segs=1)
        for a in (-w / 2, w / 2):
            k.rbox(P(a, 0, 0.02), (0.09, h + 0.12, 0.07), 0.01, M, BEAM_LIGHT, rot=rot, segs=1)
        for b in (-h / 2, h / 2):
            k.rbox(P(0, b, 0.02), (w + 0.2, 0.09, 0.07), 0.01, M, BEAM_LIGHT, rot=rot, segs=1)
        k.rbox(P(0, 0, 0.0), (0.05, h, 0.05), 0.0, M, BEAM_LIGHT, rot=rot, segs=1)
        if shutters:
            for sg in (-1, 1):
                k.rbox(P(sg * (w / 2 + 0.27), 0, 0.05), (0.42, h, 0.05), 0.01, M, mix("#4f7f8a", "#3d6570", rng.random()), rot=rot, segs=1, uv_len=1.0, v_axis=1)
    window(((win[0] + win[1]) / 2, 1.6, hz + 0.08), 1.0, 0.9, (0, 0, 1))
    window((-hx - 0.08, 1.58, -0.1), 1.0, 0.85, (-1, 0, 0))
    window((-1.8, 3.55, JZ + 0.06), 0.75, 0.75, (0, 0, 1), shutters=False)
    window((hx + 0.1, 3.75, 0.0), 0.7, 0.75, (1, 0, 0))
    k.lathe((-hx - 0.12, 4.55, 0), [(0.0, -0.02), (0.36, -0.02), (0.36, 0.05), (0.0, 0.05)], M, BEAM_LIGHT, d=(-1, 0, 0), n=12)
    k.lathe((-hx - 0.14, 4.55, 0), [(0.0, 0.0), (0.27, 0.0), (0.27, 0.05), (0.0, 0.05)], Mg, "#8fb8c6", d=(-1, 0, 0), n=12)
    return door


def slope(k, M, top, eave, x0, x1, rows, cols, seed, lift=0.05, hole=True):
    """Chunky shingles in staggered rows down a slope from the line `top` to the line `eave` (each a game point at the
    slope's middle, the rows running along x from x0 to x1), each a little askew; none inside the fish."""
    g = np.random.default_rng(seed)
    top, eave = Vector(top), Vector(eave)
    down = eave - top
    R0 = frame((1, 0, 0), down)
    nrm = R0.col[1]
    L = down.length
    for i in range(rows):
        t = (i + 0.55) / rows
        stagger = 0.5 * (i % 2)
        w = (x1 - x0) / cols
        edges = sorted({min(x1, max(x0, x0 + (j - stagger) * w)) for j in range(cols + 2)})
        for a0, a1 in zip(edges, edges[1:]):
            if a1 - a0 < 0.12:
                continue
            c = top + down * t + nrm * (lift + 0.025 * (i % 2) + g.uniform(0, 0.025))
            c.x = (a0 + a1) / 2
            if hole and inside_fish(c, 1.02):
                continue
            jit = Matrix.Rotation(g.uniform(-0.07, 0.07), 3, "Z") @ Matrix.Rotation(g.uniform(-0.05, 0.05), 3, "Y") @ Matrix.Rotation(g.uniform(-0.06, 0.02), 3, "X")
            col = mix(SHINGLE[int(g.integers(0, 4))], "#f2b25a" if g.random() < 0.3 else "#a95320", g.uniform(0, 0.25))
            k.rbox(tuple(c), (a1 - a0 - 0.035, 0.075, L / rows + 0.13), 0.0, M, col, rot=R0 @ jit, segs=1, uv_len=0.8, v_axis=2,
                   uv_off=(g.random(), g.random()))


def roof(k, M, Ms):
    """The main roof (two slopes along x), skirts of shingles over the side walls and the back, the ridge capped, the
    gable ends' barge boards and crossed rafter ends, a stone chimney; splinters of roof round the fish."""
    for sz in (-1, 1):
        slope(k, M, (0, RIDGE, 0), (0, EAVE_Y, sz * EAVE_Z), -GABLE_X, GABLE_X, 7, 10, 40 + sz)
    for sx in (-1, 1):                                    # the skirts over the ground floor's side walls
        x0 = sx * (W / 2 + 0.05)
        top, eave = Vector((x0, H1 + 0.3, 0)), Vector((x0 + sx * 0.75, H1 - 0.15, 0))
        g = np.random.default_rng(50 + sx)
        R0 = frame((0, 0, 1), eave - top)
        for i in range(2):
            for j in range(9 + i):
                z0 = -D / 2 - 0.3 + (j - 0.5 * i) * (D + 0.6) / 9
                z1 = min(z0 + (D + 0.6) / 9, D / 2 + 0.3)
                z0 = max(z0, -D / 2 - 0.3)
                c = top + (eave - top) * ((i + 0.55) / 2) + R0.col[1] * (0.05 + 0.02 * i)
                c.z = (z0 + z1) / 2
                jit = Matrix.Rotation(g.uniform(-0.07, 0.07), 3, "Z") @ Matrix.Rotation(g.uniform(-0.05, 0.05), 3, "Y")
                k.rbox(tuple(c), (z1 - z0 - 0.035, 0.075, (eave - top).length / 2 + 0.13), 0.0, M, SHINGLE[int(g.integers(0, 4))],
                       rot=R0 @ jit, segs=1, uv_len=0.8, v_axis=2)
    slope(k, M, (0, H1 + 0.3, -JZ - 0.05), (0, H1 - 0.1, -JZ - 0.75), -W / 2 - 0.3, W / 2 + 0.3, 2, 9, 60)      # the back's skirt
    k.beam((-GABLE_X - 0.15, RIDGE + 0.13, 0), (GABLE_X + 0.15, RIDGE + 0.15, 0), 0.3, 0.2, 0.03, M, BEAM, segs=1, uv_len=2.0)
    for sx in (-1, 1):
        x = sx * (GABLE_X - 0.05)
        for sz in (-1, 1):
            k.beam((x, RIDGE + 0.1, 0), (x, EAVE_Y - 0.08, sz * EAVE_Z), 0.12, 0.2, 0.02, M, mix(BEAM, BEAM_LIGHT, 0.3), up=(1, 0, 0), segs=1)
            k.beam((x, RIDGE - 0.35, sz * 0.5), (x, RIDGE + 0.55, -sz * 0.55), 0.12, 0.14, 0.0, M, BEAM, up=(1, 0, 0), segs=1)
    cx, cz = -1.7, -1.3
    ytop = roof_y(cz) + 1.0
    k.rbox((cx, ytop - 0.75, cz), (0.55, 1.5, 0.55), 0.04, Ms, STONE, segs=1)
    k.rbox((cx, ytop + 0.03, cz), (0.68, 0.12, 0.68), 0.03, Ms, "#6f6b66", segs=1)
    # Where the fish broke out: shingles and laths sprung up round it, a few slid down the slope.
    g = np.random.default_rng(77)
    nrm = frame((1, 0, 0), (0, EAVE_Y - RIDGE, EAVE_Z)).col[1]
    hole_t = next(t / 50 for t in range(-150, 50) if FISH_C.y + FISH_D.y * t / 50 > roof_y(FISH_C.z + FISH_D.z * t / 50) + 0.1)
    E = FISH_C + FISH_D * hole_t
    for j in range(15):
        a = math.tau * j / 15 + g.uniform(-0.15, 0.15)
        out = Vector((math.cos(a), 0, math.sin(a)))
        out = (out - nrm * out.dot(nrm)).normalized()
        r = fish_r(hole_t) * (1.05 if abs(out.x) > 0.5 else 0.85) + g.uniform(0.0, 0.2)
        p = E + out * r
        p.y = roof_y(p.z) + 0.08 if abs(p.z) < EAVE_Z else p.y
        tip = out * g.uniform(0.45, 0.8) + nrm * g.uniform(0.35, 0.8)
        col = SHINGLE[j % 4] if j % 3 else mix(BEAM, BEAM_LIGHT, 0.5)
        k.beam(tuple(p), tuple(p + tip), g.uniform(0.18, 0.3), 0.06, 0.0, M, col, segs=1, roll=g.uniform(-0.4, 0.4))
    for sg in (-1, 1):                                    # two rafters snapped and sprung up beside it
        b = E + Vector((sg * 0.25, 0, -sg * 0.9))
        b.y = roof_y(b.z) - 0.1
        k.beam(tuple(b), tuple(b + Vector((-0.35 * sg, 0.95, 0.5 * sg))), 0.13, 0.15, 0.0, M, BEAM_LIGHT, segs=1)
    for j, (x, z) in enumerate(((1.8, 1.9), (-0.6, 2.35), (2.4, 0.9), (0.9, 2.6), (-1.6, -2.4))):
        c = Vector((x, roof_y(z) + 0.1, z))
        rot = frame((1, 0, 0), (0, EAVE_Y - RIDGE, EAVE_Z)) @ Matrix.Rotation(g.uniform(0.4, 1.2) * (1 if j % 2 else -1), 3, "Y")
        k.rbox(tuple(c), (0.5, 0.07, 0.55), 0.0, M, SHINGLE[j % 4], rot=rot, segs=1, uv_len=0.8)


def porch(k, M, Mp, Mr):
    """A porch of planks from the jetty beam out to z 3.9 on two crooked posts; the fish sign standing on it; fish hung
    from its beam; a table of fish on ice under it, right of the door; a life ring by the door."""
    z0, z1, y0, y1 = JZ + 0.1, 3.9, H1 - 0.02, 2.32
    for i in range(14):
        x = -W / 2 - 0.25 + (i + 0.5) * (W + 0.5) / 14
        col = mix("#c48d5c", "#8f6440", rng.uniform(0, 0.7))
        k.beam((x, y0 + rng.uniform(-0.02, 0.02), z0), (x, y1 + rng.uniform(-0.05, 0.03), z1 + rng.uniform(-0.08, 0.1)), (W + 0.5) / 14 - 0.02,
               0.06, 0.0, M, col, segs=1, roll=rng.uniform(-0.04, 0.04))
    for x, lean in ((-2.5, -0.06), (2.5, 0.05)):
        post(k, M, (x + lean, 0.0, z1 - 0.2), (x, y1 - 0.02, z1 - 0.2), w=0.18)
    k.beam((-2.8, y1 - 0.1, z1 - 0.2), (2.8, y1 - 0.06, z1 - 0.2), 0.14, 0.16, 0.02, M, BEAM, segs=1, uv_len=2.0)
    for x in (-2.5, 2.5):
        k.beam((x, 1.6, z1 - 0.2), (x * 0.8, y1 - 0.12, z1 - 0.2), 0.08, 0.08, 0.01, M, BEAM, up=(0, 0, 1), segs=1)
    # The sign: a broad board standing on the porch roof against the upper floor, a blue fish and a fish skull on it.
    sz_, sy = JZ + 0.42, 3.2
    rot = K.game_rot(pitch=-0.12, roll=0.03)
    k.rbox((0.35, sy, sz_), (2.6, 0.8, 0.1), 0.03, M, "#c9a072", rot=rot, segs=1, uv_len=1.5, v_axis=0)
    for x in (-0.75, 1.45):
        k.beam((x, 2.65, sz_ - 0.12), (x, sy + 0.1, sz_ - 0.06), 0.08, 0.08, 0.01, M, BEAM, up=(0, 0, 1), segs=1)
    body = [(0.6 * math.cos(a), 0.24 * math.sin(a)) for a in np.linspace(0, math.tau, 14, endpoint=False)]
    k.extrude(body, 0.06, 0.1, Mp, BLUE, bevel=0.01, rot=rot, at=(-0.05, sy, sz_))
    k.extrude(ccw([(-0.5, 0), (-0.85, 0.27), (-0.75, 0), (-0.85, -0.27)]), 0.06, 0.1, Mp, BLUE, bevel=0.01, rot=rot, at=(-0.05, sy, sz_))
    k.blob((0.37, sy + 0.07, sz_ + 0.11), (0.06, 0.06, 0.025), Mp, "#f7f4ea", segs=6, rings=4)
    k.blob((1.25, sy, sz_ + 0.1), (0.2, 0.17, 0.1), Mp, "#efe6d2", segs=8, rings=5)                  # the skull
    for sx in (-1, 1):
        k.blob((1.25 + sx * 0.08, sy + 0.03, sz_ + 0.18), (0.045, 0.05, 0.03), Mp, "#2b2622", segs=6, rings=4)
    k.beam((1.25, sy - 0.12, sz_ + 0.12), (1.25, sy - 0.32, sz_ + 0.14), 0.06, 0.04, 0.01, Mp, "#efe6d2", segs=1)
    # Fish hung from the porch beam on cords.
    for i, (x, col) in enumerate(((-0.1, "#5f86b5"), (0.35, "#c56a55"), (0.8, "#6aa36b"), (1.25, "#5f86b5"))):
        top, L = y1 - 0.18, 0.62 + 0.1 * (i % 2)
        k.tube([(x, top, z1 - 0.2), (x, top - 0.25, z1 - 0.2)], 0.012, Mr, ROPE, n=4, v_len=0.2)
        hung_fish(k, Mp, (x, top - 0.25 - L / 2, z1 - 0.2), L, col)
    # The table of fish on ice, right of the door.
    tx, tz = 1.25, 3.05
    k.rbox((tx, 0.76, tz), (2.3, 0.08, 1.0), 0.015, M, BEAM_LIGHT, segs=1, uv_len=1.5, v_axis=0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.rbox((tx + sx * 1.05, 0.38, tz + sz * 0.4), (0.09, 0.76, 0.09), 0.01, M, BEAM, segs=1)
    fishes = (("#5f86b5", "#6aa36b"), ("#c56a55", "#5f86b5"), ("#6aa36b", "#c56a55"))
    for i, x in enumerate((tx - 0.72, tx, tx + 0.72)):
        y = 0.8 + (0.06 if i == 1 else 0.0)
        for c, size in (((x, y + 0.02, tz), (0.64, 0.04, 0.62)), ((x, y + 0.11, tz - 0.29), (0.64, 0.2, 0.04)), ((x, y + 0.11, tz + 0.29), (0.64, 0.2, 0.04)),
                        ((x - 0.3, y + 0.11, tz), (0.04, 0.2, 0.62)), ((x + 0.3, y + 0.11, tz), (0.04, 0.2, 0.62))):
            k.rbox(c, size, 0.0, M, mix("#b08458", "#8a6440", 0.3 * i), segs=1)
        k.blob((x, y + 0.17, tz), (0.27, 0.05, 0.26), Mp, "#dceef2", segs=8, rings=4, seed=i, lumpy=0.2)
        for j, col in enumerate(fishes[i]):
            lying_fish(k, Mp, (x + (j - 0.5) * 0.06, y + 0.24 + 0.02 * j, tz + (j - 0.5) * 0.22), 0.3 + 0.35 * j, 0.46, col)
    ring_into(k, Mp, Mr, c=(-2.3, 0.85, D / 2 + 0.12), s=0.6)
    for bx, bz in ((2.95, 1.2), (3.2, 0.55)):                                    # barrels by the +x wall
        k.lathe((bx, 0, bz), [(0.0, 0.0), (0.27, 0.0), (0.31, 0.25), (0.32, 0.4), (0.31, 0.55), (0.27, 0.8), (0.0, 0.8)], M, "#a87a4c", n=10, v_len=0.8)
        for y in (0.12, 0.68):
            k.lathe((bx, y, bz), [(0.3, -0.03), (0.315, 0.0), (0.3, 0.03)], Mp, "#5b5f63", n=10)


def lying_fish(k, Mp, c, yaw, L, col):
    fish_along(k, Mp, c, (math.cos(yaw), 0.0, math.sin(yaw)), L, col, (0, 1, 0))


def hung_fish(k, Mp, c, L, col):
    fish_along(k, Mp, c, (0.0, 1.0, 0.0), L, col, (0, 0, 1))


def fish_along(k, Mp, c, d, L, col, flat):
    """A plump fish, its tail toward d, flattened across `flat`: a spindle body, a forked tail, a dark eye each side."""
    d, f = Vector(d).normalized(), Vector(flat)
    prof = [(0.0, -L / 2), (L * 0.12, -L * 0.38), (L * 0.17, -L * 0.1), (L * 0.11, L * 0.25), (L * 0.05, L * 0.42)]
    k.lathe(c, prof, Mp, col, d=tuple(d), n=6, sz=0.55, up=tuple(f))
    side = d.cross(f).normalized()
    t = Vector(c) + d * L * 0.42
    for a, b in ((t + d * L * 0.2 + side * L * 0.17, t + d * L * 0.13), (t + d * L * 0.13, t + d * L * 0.2 - side * L * 0.17)):
        k.quad([tuple(t), tuple(a), tuple(b), tuple(t + f * 0.001)], Mp, mix(col, "#20283a", 0.25))
    for sg in (-1, 1):
        k.blob(tuple(Vector(c) - d * L * 0.33 + f * sg * L * 0.07), (0.016, 0.016, 0.016), Mp, "#1d1d22", segs=4, rings=3)


def fish_market(wood, rope, paint, glass, stone, metal):
    k = K.Kit("fish-market")
    swordfish(k, wood, metal, paint)
    footing(k, stone)
    walls(k, wood, paint, glass)
    roof(k, wood, stone)
    porch(k, wood, paint, rope)
    k.tint_gradient(0.82, 1.0, 0.0, RIDGE)
    return k.finish(smooth_deg=40)


def build():
    K.reset()
    wood = wood_mat("M_DecorWood", 2614)
    rope = K.Mat("M_Rope", tex=K.image("rope", K.rope(64, 128, 2613, "#ffffff")), rough=1.0)
    paint, glass, stone, metal = K.Mat("P_Paint", rough=0.45), K.Mat("P_Glass", rough=0.08), K.Mat("P_Stone", rough=0.95), K.Mat("P_Metal", rough=0.4)
    obs = {}
    for path, fn in (("game/buildings/fish-market", lambda: fish_market(wood, rope, paint, glass, stone, metal)),):
        ob = fn()
        K.export([ob], f"{path}.glb")
        report(ob)
        obs[os.path.basename(path)] = ob
    return obs


def scene(obs, out):
    import bpy
    shown = []
    for name, (x, z) in {"fish-market": (0, 0)}.items():
        o = obs[name].copy()
        bpy.context.scene.collection.objects.link(o)
        o.location = K.G(x, 0, z)
        shown.append(o)
        obs[name].hide_render = True
    bpy.context.view_layer.update()
    views = tuple(tuple(float(v) for v in a.split(":")) for a in ARGS if ":" in a) or ((200, 24), (145, 34))
    K.review(shown, out, views=views, size=900)
    for o in shown:
        o.hide_render = True


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        d = ARGS[ARGS.index("review") + 1]
        scene(obs, os.path.join(d, "fish-market.png"))
