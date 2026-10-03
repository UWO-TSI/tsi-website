"""The wharf's pier, and the home island's to match (specs/polish/arrival-wharf.md deliverables 1 and 2).

A low timber jetty in the island's painted style: it rides a hand's width over the water like a floating dock, held by
tall round guide piles that stand up past the deck and carry a rope rail. Weathered boards across the deck, each its own
board (tone, grain, knots, nails, a worn path down the middle where everyone walks), stringers under them, piles down
to the bed with a wet band, weed and barnacles at the waterline, X braces under the water, a wooden end rail at the tip
to lean on while you fish, rope fenders and two iron cleats on the boat side, and a coil of spare line. The boat moors
alongside the tip on +x, where the rope rail leaves a gap to step aboard. Matte throughout: roughness 1, no metal but the
cleats.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/wharf/build_wharf.py

Writes web/public/assets/game/wharf/pier.glb. Frame: the wharf landmark's own (lib/game/defaultIsland.ts LANDMARK_INFO
.wharf), before its yaw: x across (+x the boat side), y up, z along it (the tip at z −3.5 out over the sea, the land end
at z +1.12); the deck's top is y 0 (the walk height on WHARF_DECK_LOCAL) and the water is y −0.078 (lib/game/grid.ts
WATER_DROP). The home island places the same model at its dock (lib/game/homeIsland.ts HOME_PIER). Painted here in numpy,
no downloads and no references; every random choice is seeded, so a rebuild writes the same model.
Prints the triangle count and the points the engine ties to (lib/game/wharf.ts mirrors them).
"""
import bmesh, bpy, math, os, sys
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402  (textures to images, materials, game→Blender axes, export)
from cafekit import G, Mat  # noqa: E402

TAU = math.tau
K.OUT = os.path.join(K.ROOT, "web", "public", "assets", "game", "wharf")

# ── the frame (mirrored in lib/game/wharf.ts) ───────────────────────────────────────────────────────────────────────
WATER = -0.078                  # the sea's surface (WATER_DROP below level 0)
Z_TIP, Z_LAND = -3.5, 1.12      # the deck's two ends
PLANK_T = 0.045                 # board thickness; tops at y 0 (a hair of jitter below)
HALF = 0.95                     # a board's half length across the deck (each its own ±)
POST_X = 1.06                   # the guide piles stand just outside the board ends
POST_R = 0.085
POST_TOP = 0.78
RAIL_Z = (-3.42, -1.62, -0.28, 1.0)      # the piles that stand up through the deck, both sides
GAP = (-3.42, -1.62)            # on +x the rope leaves this span open: the step aboard
ROPE_Y, ROPE_SAG, ROPE_R = 0.62, 0.13, 0.021
PILE_Y0 = -1.7                  # into the bed
CLEATS = ((0.8, -3.06), (0.8, -1.98))      # on the deck, the boat's lines tie here
POST_V = (PILE_Y0, POST_TOP + 0.05)        # the post texture's v runs over these heights (its wet band sits at WATER)

rng = np.random.default_rng(1919)


# ================================================================ textures (numpy, sRGB, row 0 at the top)
def hexrgb(h):
    return np.array(K.hexrgb(h))


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def noise(h, w, cells, seed):
    return K._smooth_noise(np.random.default_rng(seed), h, w, cells)


PLANK_TONES = ["#a67c54", "#b0865a", "#9a734e", "#b38b5f", "#a27955", "#ab8159", "#97704b", "#b0885c"]
STRIP = 128                      # each board's strip in the atlas: 128 px of 1024


def strip_v(strip, px):
    """The atlas v of a pixel row `px` down board strip `strip` (image rows run down, v up)."""
    return 1 - (strip * STRIP + px) / (8 * STRIP)


def plank_atlas():
    """Eight boards' tops, one per 128 px strip, the grain along u. Each: its own tone; long grain lines that wander
    and part round a knot or two; silvering where the weather gets at it, more toward the ends; a lighter worn path
    down the middle (u ≈ 0.5, where the deck is walked); end checks (cracks) off the ends; two nails each end with a
    rust halo; the long edges rounded over into the dark gap (rows 0-6 and 121-127), which the chamfers and the board
    sides map to."""
    H, W = 8 * STRIP, 1024
    out = np.zeros((H, W, 3))
    u = (np.arange(W) + 0.5) / W
    for s in range(8):
        r = np.random.default_rng(300 + s)
        tone = hexrgb(PLANK_TONES[s])
        v = (np.arange(STRIP) + 0.5) / STRIP
        U, Vv = np.meshgrid(u, v)
        # Knots: a dark eye the grain bends round.
        knots = [(r.uniform(0.15, 0.85), r.uniform(0.3, 0.7), r.uniform(0.018, 0.03)) for _ in range(r.integers(0, 3))]
        bend = np.zeros_like(U)
        eye = np.zeros_like(U)
        for ku, kv, kr in knots:
            d = np.hypot((U - ku) * 4.8, Vv - kv)
            bend += kr * 2.2 * np.exp(-(d / (kr * 3.2)) ** 2) * np.sign(Vv - kv + 1e-6)
            eye = np.maximum(eye, smooth(kr * 1.2, kr * 0.4, d))
        drift = sum(r.uniform(0.004, 0.012) * np.sin(TAU * (U * k + r.random())) for k in (1.3, 2.7, 5.1))
        g = Vv + drift + bend
        lines = np.zeros_like(U)
        for freq, amp in ((r.uniform(9, 13), 0.55), (r.uniform(24, 31), 0.3), (r.uniform(55, 70), 0.15)):
            lines += amp * (0.5 + 0.5 * np.sin(TAU * (g * freq + r.random())))
        streak = noise(STRIP, W, 24, 310 + s)[:, :] * 0.5 + 0.5 * noise(STRIP, W, 7, 320 + s)
        val = 0.86 + 0.16 * (lines - 0.5) + 0.1 * (streak - 0.5) + r.uniform(-0.03, 0.03)
        val -= eye * 0.42
        for ku, kv, kr in knots:                         # a ring round each knot
            d = np.hypot((U - ku) * 4.8, Vv - kv)
            val -= 0.12 * np.exp(-((d - kr * 1.7) / (kr * 0.5)) ** 2)
        rgb = tone * val[..., None]
        # Silvering: grey weathered wood in patches, heavier toward the ends.
        ends = smooth(0.32, 0.02, np.minimum(U, 1 - U))
        silver = np.clip(smooth(0.45, 0.8, noise(STRIP, W, 5, 330 + s)) * 0.55 + ends * 0.45, 0, 0.85)
        rgb = rgb * (1 - silver[..., None] * 0.45) + hexrgb("#b4aa9a") * val[..., None] * silver[..., None] * 0.45
        # The worn path down the middle of the deck: lighter, the grain softer.
        path = smooth(0.24, 0.06, np.abs(U - 0.5)) * (0.75 + 0.25 * noise(STRIP, W, 9, 340 + s))
        rgb = rgb * (1 + 0.1 * path[..., None]) + 0.03 * path[..., None]
        # End checks: thin cracks in from each end.
        for end in (0, 1):
            for _ in range(r.integers(1, 3)):
                cv, cl = r.uniform(0.25, 0.75), r.uniform(0.04, 0.12)
                du = U if end == 0 else 1 - U
                crack = smooth(0.006, 0.0, np.abs(Vv - cv - 0.02 * np.sin(du * 60))) * smooth(cl, cl * 0.4, du)
                rgb *= 1 - 0.55 * crack[..., None]
        # The ends darken (end grain soaks up the weather).
        rgb *= (1 - 0.25 * smooth(0.035, 0.0, np.minimum(U, 1 - U)))[..., None]
        # Nails: two each end, a dark head and a rust halo.
        for nu in (0.055, 0.945):
            for nv in (0.3, 0.7):
                cu, cv = nu + r.uniform(-0.006, 0.006), nv + r.uniform(-0.03, 0.03)
                d = np.hypot((U - cu) * W / STRIP, Vv - cv)
                rgb = rgb * (1 - 0.35 * smooth(0.075, 0.03, d)[..., None]) + hexrgb("#7a4a2a") * 0.35 * smooth(0.075, 0.03, d)[..., None]
                head = smooth(0.034, 0.024, d)
                lit = np.clip(0.55 + 0.45 * (-(U - cu) * W / STRIP + (Vv - cv)) / 0.03, 0.2, 1)
                rgb = rgb * (1 - head[..., None]) + np.array([0.29, 0.27, 0.25]) * (0.75 + 0.45 * lit)[..., None] * head[..., None]
        # Rounded long edges: a light lip on the rounded-over arris, then the dark of the gap.
        lip = np.exp(-((Vv - 0.08) / 0.025) ** 2) + np.exp(-((Vv - 0.92) / 0.025) ** 2)
        rgb = rgb * (1 + 0.12 * lip[..., None])
        dark = smooth(0.06, 0.0, Vv) + smooth(0.94, 1.0, Vv)
        rgb = rgb * (1 - 0.6 * np.clip(dark, 0, 1)[..., None])
        out[s * STRIP:(s + 1) * STRIP] = rgb
    return np.clip(out, 0, 1)


def post_texture():
    """A pile, round: u round it, v up it from PILE_Y0 to POST_TOP. Vertical grain and checks; above the splash zone
    dry and silvered toward the top; a dark wet band where the swell washes; below the water dark, green with weed
    streaks and pale barnacle specks."""
    H, W = 1024, 256
    v = 1 - (np.arange(H) + 0.5) / H
    u = (np.arange(W) + 0.5) / W
    Uu, Vv = np.meshgrid(u, v)
    y = POST_V[0] + Vv * (POST_V[1] - POST_V[0])
    r = np.random.default_rng(401)
    g = Uu + 0.01 * np.sin(TAU * (Vv * 3 + 0.3)) + 0.006 * np.sin(TAU * Vv * 11)
    lines = sum(a * (0.5 + 0.5 * np.sin(TAU * (g * f + r.random()))) for f, a in ((7, 0.5), (19, 0.3), (43, 0.2)))
    val = 0.8 + 0.18 * (lines - 0.5) + 0.12 * (noise(H, W, 12, 402) - 0.5)
    # Checks: long dark splits up the grain.
    for _ in range(9):
        cu, y0, y1 = r.random(), r.uniform(-0.5, 0.4), r.uniform(0.2, 0.8)
        d = np.abs(((Uu - cu + 0.5) % 1) - 0.5)
        val -= 0.3 * smooth(0.006, 0.0, d) * (y > y0) * (y < y1)
    dry = hexrgb("#8a6a4b") * val[..., None]
    silver = smooth(0.0, 0.7, y) * (0.5 + 0.5 * noise(H, W, 6, 403))
    dry = dry * (1 - 0.35 * silver[..., None]) + hexrgb("#a9a091") * val[..., None] * 0.35 * silver[..., None]
    wet = hexrgb("#4a3a2b") * val[..., None]
    under = hexrgb("#3d4a35") * (val * (0.85 + 0.3 * noise(H, W, 16, 404)))[..., None]
    weed = smooth(0.55, 0.75, noise(H, W, 18, 405) * (0.6 + 0.4 * np.sin(TAU * Uu * 9) ** 2)) * smooth(WATER + 0.02, WATER - 0.3, y)
    under = under * (1 - 0.5 * weed[..., None]) + hexrgb("#4f6b3a") * 0.5 * weed[..., None]
    t_wet = smooth(0.06, -0.05, y + 0.02 * np.sin(TAU * Uu * 5))       # the splash zone up to ~0.06
    t_under = smooth(WATER + 0.02, WATER - 0.06, y)
    rgb = dry * (1 - t_wet[..., None]) + wet * t_wet[..., None]
    rgb = rgb * (1 - t_under[..., None]) + under * t_under[..., None]
    # Barnacles: pale specks clustered just under the waterline.
    spots = np.zeros((H, W))
    for _ in range(420):
        cy = WATER - abs(r.normal(0.12, 0.22))
        cv = (cy - POST_V[0]) / (POST_V[1] - POST_V[0])
        cu, rr = r.random(), r.uniform(1.2, 2.6)
        row, col = int((1 - cv) * H), int(cu * W)
        y0, y1, x0, x1 = max(0, row - 4), min(H, row + 5), col - 4, col + 5
        yy, xx = np.mgrid[y0:y1, x0:x1]
        d = np.hypot(yy - row, xx - col)
        spots[y0:y1, xx % W] = np.maximum(spots[y0:y1, xx % W], smooth(rr, rr * 0.4, d))
    rgb = rgb * (1 - 0.7 * spots[..., None]) + hexrgb("#c9c3b2") * 0.7 * spots[..., None]
    return np.clip(rgb, 0, 1)


def rope_texture():
    """Three-strand rope: u round it, v along it, one lay (three strands passing) per texture height. Each strand a
    rounded tube in light, dark in the grooves between, fine fibres along the strand."""
    H, W = 256, 64
    v = (np.arange(H) + 0.5) / H
    u = (np.arange(W) + 0.5) / W
    Uu, Vv = np.meshgrid(u, v)
    phase = (Vv * 3 + Uu * 3) % 1                      # three strands round, three passes per repeat
    across = np.abs(phase - 0.5) * 2                   # 0 strand centre, 1 the groove
    body = np.sqrt(np.clip(1 - across ** 2, 0, 1))
    fibre = 0.5 + 0.5 * np.sin(TAU * ((Vv * 3 - Uu * 3) * 14 + 7 * noise(H, W, 8, 501)))
    light = 0.55 + 0.45 * body * (0.85 + 0.15 * np.cos(TAU * (Uu - 0.15)))
    val = light * (0.9 + 0.1 * fibre) - 0.35 * smooth(0.75, 1.0, across)
    rgb = hexrgb("#c7a268") * val[..., None]
    return np.clip(rgb, 0, 1)


# ================================================================ geometry: one bmesh, per-loop UVs, one slot per material
class Pier:
    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.mats = []

    def slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def face(self, verts, uvs, mat):
        f = self.bm.faces.new(verts)
        for lp, uv in zip(f.loops, uvs):
            lp[self.uv].uv = uv
        f.material_index = self.slot(mat)
        return f

    def vert(self, p):
        return self.bm.verts.new(G(*p))

    def ring_grid(self, rings, uvs, mat, closed=True):
        """Faces between consecutive rings of game points (each ring the same count, round when closed); `uvs[i][j]` per
        point, with one more column per ring when closed (the seam's u = 1)."""
        vs = [[self.vert(p) for p in ring] for ring in rings]
        n = len(rings[0])
        cols = n if closed else n - 1
        for i in range(len(rings) - 1):
            for j in range(cols):
                j2 = (j + 1) % n
                self.face([vs[i][j], vs[i][j2], vs[i + 1][j2], vs[i + 1][j]],
                          [uvs[i][j], uvs[i][j + 1], uvs[i + 1][j + 1], uvs[i + 1][j]], mat)
        return vs

    def board(self, x0, x1, z0, z1, y_top, thick, mat, strip, flip, uoff, chamfer=0.007, tex_len=2.0):
        """A deck board across x from x0 to x1 and z0 to z1, its top at y_top: the top maps one atlas strip (grain along
        x), the chamfered arrises the strip's lip, the sides and underside the dark gap rows, the ends the end grain."""
        c = chamfer
        sect = [(z0, y_top - thick), (z1, y_top - thick), (z1, y_top - c), (z1 - c, y_top), (z0 + c, y_top), (z0, y_top - c)]
        sv = [strip_v(strip, STRIP - 1), strip_v(strip, 1), strip_v(strip, 5), strip_v(strip, 9), strip_v(strip, STRIP - 9), strip_v(strip, STRIP - 5)]
        ua = lambda x: uoff + ((x - x0) if not flip else (x1 - x)) / tex_len
        a = [self.vert((x0, y, z)) for z, y in sect]
        b = [self.vert((x1, y, z)) for z, y in sect]
        n = len(sect)
        for k in range(n):
            k2 = (k + 1) % n
            self.face([a[k], a[k2], b[k2], b[k]], [(ua(x0), sv[k]), (ua(x0), sv[k2]), (ua(x1), sv[k2]), (ua(x1), sv[k])], mat)
        # The ends: the strip's darkened end column (end grain).
        e0, e1 = ua(x0), ua(x1)
        e0, e1 = (e0 + 0.003, e1 - 0.003) if e0 < e1 else (e0 - 0.003, e1 + 0.003)
        self.face(list(reversed(a)), [(e0, sv[k]) for k in reversed(range(n))], mat)
        self.face(b, [(e1, sv[k]) for k in range(n)], mat)

    def beam(self, p0, p1, w, h, mat, strip, up=(0, 1, 0), tex_len=2.0):
        """A rectangular timber from p0 to p1 (its centre line), w across and h deep, cut from a deck board: one atlas
        strip along its length (the grain runs with it) on every long face, end grain on the ends."""
        a, b = Vector(p0), Vector(p1)
        d = (b - a).normalized()
        upv = Vector(up)
        side = d.cross(upv).normalized()
        upv = side.cross(d).normalized()
        corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
        L = (b - a).length
        u0 = float(rng.uniform(0, 0.3))
        rings = [[tuple(p + side * cx + upv * cy) for cx, cy in corners] for p in (a, b)]
        vs = [[self.vert(p) for p in ring] for ring in rings]
        v0, v1 = strip_v(strip, 12), strip_v(strip, STRIP - 12)
        for k in range(4):
            k2 = (k + 1) % 4
            self.face([vs[0][k], vs[0][k2], vs[1][k2], vs[1][k]], [(u0, v0), (u0, v1), (u0 + L / tex_len, v1), (u0 + L / tex_len, v0)], mat)
        ends = [(u0 + 0.003, v0), (u0 + 0.003, v1), (u0 + 0.004, v1), (u0 + 0.004, v0)]
        self.face([vs[0][3], vs[0][2], vs[0][1], vs[0][0]], ends, mat)
        self.face([vs[1][0], vs[1][1], vs[1][2], vs[1][3]], ends, mat)

    def post(self, x, z, y0, y1, r, mat, seed, sides=11, cap=True):
        """A round pile from y0 to y1: a little out of round and leaning, thinner toward the top, its top a weathered dome.
        u round it, v its height on POST_V (the wet band in the texture meets the water)."""
        pr = np.random.default_rng(seed)
        lean = (pr.uniform(-0.012, 0.012), pr.uniform(-0.012, 0.012))
        wob = [pr.uniform(-0.06, 0.06) for _ in range(sides)]
        spin = pr.random()
        # Rings where the shape needs them: the bed, under the water, the waterline, and up to the top.
        hs = sorted({y0, *[y for y in (WATER - 0.45, WATER + 0.06, 0.35) if y0 + 0.05 < y < y1 - 0.05], y1})
        vof = lambda y: (y - POST_V[0]) / (POST_V[1] - POST_V[0])
        def ring(y, k=1.0):
            t = (y - y0) / max(1e-6, y1 - y0)
            rr = r * (1.04 - 0.08 * t) * k
            cx, cz = x + lean[0] * (y - y0), z + lean[1] * (y - y0)
            return [(cx + math.cos(TAU * (j / sides + spin)) * rr * (1 + wob[j]), y, cz + math.sin(TAU * (j / sides + spin)) * rr * (1 + wob[j])) for j in range(sides)]
        rings = [ring(y) for y in hs]
        uvs = [[(j / sides, vof(y)) for j in range(sides + 1)] for y in hs]
        if cap:
            for dy, k in ((0.014, 0.9), (0.026, 0.62), (0.032, 0.28)):
                rings.append(ring(y1 + dy, k))
                uvs.append([(j / sides, vof(y1 + dy * 0.5)) for j in range(sides + 1)])
        vs = self.ring_grid(rings, uvs, mat)
        if cap:
            top = self.vert((x + lean[0] * (y1 - y0), y1 + 0.035, z + lean[1] * (y1 - y0)))
            for j in range(sides):
                j2 = (j + 1) % sides
                self.face([vs[-1][j], vs[-1][j2], top], [(j / sides, vof(y1)), ((j + 1) / sides, vof(y1)), ((j + 0.5) / sides, vof(y1 + 0.03))], mat)
        return lean

    def tube(self, path, r, mat, sides=6, tile=0.13, v0=0.0, caps=False):
        """A rope through game points: u round it, v its length over `tile` (one lay of the rope texture)."""
        P = [Vector(p) for p in path]
        L = [0.0]
        for a, b in zip(P, P[1:]):
            L.append(L[-1] + (b - a).length)
        rings, uvs = [], []
        prev = None
        for i, p in enumerate(P):
            d = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
            ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
            n1 = (prev if prev is not None else d.cross(ref)).normalized()
            n1 = (n1 - d * n1.dot(d)).normalized()      # parallel transport: no twisting of the frame
            prev = n1
            n2 = d.cross(n1)
            rings.append([tuple(p + (n1 * math.cos(TAU * j / sides) + n2 * math.sin(TAU * j / sides)) * r) for j in range(sides)])
            uvs.append([(j / sides, v0 + L[i] / tile) for j in range(sides + 1)])
        vs = self.ring_grid(rings, uvs, mat)
        if caps:
            for ring, rev in ((vs[0], True), (vs[-1], False)):
                c = self.bm.verts.new(sum((v.co for v in ring), Vector()) / len(ring))
                for j in range(sides):
                    j2 = (j + 1) % sides
                    tri = [ring[j], ring[j2], c] if not rev else [ring[j2], ring[j], c]
                    self.face(tri, [(0.5, 0.5)] * 3, mat)
        return L[-1]

    def lathe(self, c, profile, mat, sides=12, v_of=None, axis_dir=(0, 1, 0)):
        """Surface of revolution about a game axis through c: profile [(radius, along)] ; ends of radius 0 close."""
        cv = Vector(c)
        d = Vector(axis_dir).normalized()
        ref = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 0, 1))
        n1 = d.cross(ref).normalized()
        n2 = d.cross(n1)
        rings, uvs = [], []
        for i, (rr, t) in enumerate(profile):
            rr = max(rr, 1e-4)
            rings.append([tuple(cv + d * t + (n1 * math.cos(TAU * j / sides) + n2 * math.sin(TAU * j / sides)) * rr) for j in range(sides)])
            uvs.append([(j / sides, v_of(i, t) if v_of else i / (len(profile) - 1)) for j in range(sides + 1)])
        return self.ring_grid(rings, uvs, mat)

    def finish(self, name, smooth_deg=58):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.normal_update()
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        sharp = [e for e in bm.edges if len(e.link_faces) != 2 or math.degrees(e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0)) > smooth_deg]
        bmesh.ops.split_edges(bm, edges=sharp)
        for f in bm.faces:
            f.smooth = True
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m.m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def catenary(a, b, sag, n=14):
    """Points of a rope hung from a to b (game points), sagging `sag` at the middle (a parabola, close enough)."""
    A, B = Vector(a), Vector(b)
    return [tuple(A.lerp(B, t) - Vector((0, sag * 4 * t * (1 - t), 0))) for t in np.linspace(0, 1, n)]


def wrap(p, cx, cz, y, turns=1.6, r_post=POST_R, n=15, start=0.0, rise=0.03):
    """A rope wound round a post at (cx, cz) about height y: a short helix starting toward angle `start`."""
    rr = r_post * 1.08 + ROPE_R
    return [(cx + math.cos(start + TAU * turns * t) * rr, y - rise / 2 + rise * t, cz + math.sin(start + TAU * turns * t) * rr) for t in np.linspace(0, 1, n)]


def build():
    K.reset()
    mats = {
        "deck": Mat("M_Deck", "#a77d55", 1.0, K.image("wharf_deck", plank_atlas()), tile=1.0),
        "post": Mat("M_Pile", "#7d5f43", 1.0, K.image("wharf_pile", post_texture()), tile=1.0),
        "rope": Mat("M_Rope", "#c7a268", 1.0, K.image("wharf_rope", rope_texture()), tile=1.0),
        "iron": Mat("M_Iron", "#3b3734", 0.7),
    }
    p = Pier()
    deck, post, rope, iron = mats["deck"], mats["post"], mats["rope"], mats["iron"]

    # ── the deck: boards across, each its own length, tone, set and a hair of rock ────────────────────────────────
    n = 19
    pitch = (Z_LAND - Z_TIP) / n
    gap = 0.024
    strips = list(rng.permutation(8)) + list(rng.permutation(8)) + list(rng.permutation(8))
    for i in range(n):
        z0 = Z_TIP + i * pitch + gap / 2 + rng.uniform(-0.004, 0.004)
        z1 = Z_TIP + (i + 1) * pitch - gap / 2 + rng.uniform(-0.004, 0.004)
        if i == 0:
            z0 = Z_TIP
        hx0, hx1 = HALF + rng.uniform(-0.02, 0.012), HALF + rng.uniform(-0.02, 0.012)
        dx = rng.uniform(-0.012, 0.012)
        y_top = -rng.uniform(0.0, 0.004)
        p.board(-hx0 + dx, hx1 + dx, z0, z1, y_top, PLANK_T, deck, int(strips[i]), bool(rng.integers(0, 2)), float(rng.uniform(0, 0.02)))

    # ── stringers under the boards, wet along their undersides ──────────────────────────────────────────────────
    for x in (-0.84, 0.0, 0.84):
        p.beam((x, -0.1, Z_TIP + 0.04), (x, -0.1, Z_LAND - 0.03), 0.07, 0.11, deck, int(rng.integers(0, 8)))

    # ── the guide piles that stand up through the deck (both sides), and the ones under it ──────────────────────
    tops = {}
    for side in (-1, 1):
        for k, z in enumerate(RAIL_Z):
            seed = 700 + (side + 1) * 10 + k
            top = POST_TOP + rng.uniform(-0.035, 0.03)
            lean = p.post(side * POST_X, z, PILE_Y0, top, POST_R * rng.uniform(0.94, 1.08), post, seed)
            tops[(side, k)] = (side * POST_X + lean[0] * (ROPE_Y - PILE_Y0), z + lean[1] * (ROPE_Y - PILE_Y0), top)
    for side in (-1, 1):
        for z in (-2.5, -0.95, 0.35):
            p.post(side * 0.84, z, PILE_Y0, -0.155, POST_R * 0.82, post, 800 + int(z * 10) + side, cap=False)
    # X braces between each pair of standing piles, under the water, and a cap across under the deck ends.
    for k, z in enumerate(RAIL_Z):
        for flip in (-1, 1):
            ya, yb = (-0.22, -1.12) if flip < 0 else (-1.12, -0.22)
            p.beam((-POST_X, ya, z + 0.11 * flip), (POST_X, yb, z + 0.11 * flip), 0.12, 0.035, deck, int(rng.integers(0, 8)), up=(0, 0, 1))
        p.beam((-POST_X - 0.02, -0.1, z), (POST_X + 0.02, -0.1, z), 0.09, 0.08, deck, int(rng.integers(0, 8)))

    # ── the end rail at the tip: lean on it and fish ──────────────────────────────────────────────────────────
    rz = RAIL_Z[0] - 0.105
    p.beam((-POST_X - 0.07, 0.56, rz), (POST_X + 0.07, 0.56, rz), 0.07, 0.085, deck, 3)
    p.beam((-POST_X - 0.03, 0.27, rz), (POST_X + 0.03, 0.27, rz), 0.05, 0.065, deck, 5)

    # ── the rope rail: hung pile to pile on both sides, wound round each; on +x the step aboard is left open ───────
    v = 0.0
    for side in (-1, 1):
        for k in range(len(RAIL_Z) - 1):
            za, zb = RAIL_Z[k], RAIL_Z[k + 1]
            if side == 1 and (za, zb) == GAP:
                continue
            (ax, az, _), (bx, bz, _) = tops[(side, k)], tops[(side, k + 1)]
            off = POST_R * 1.05 + ROPE_R
            a = (ax, ROPE_Y + rng.uniform(-0.01, 0.01), az + off)
            b = (bx, ROPE_Y + rng.uniform(-0.01, 0.01), bz - off)
            sag = ROPE_SAG * (zb - za) / 1.6 + rng.uniform(-0.01, 0.01)
            v += p.tube(catenary(a, b, sag), ROPE_R, rope, v0=v) / 0.13
        for k, z in enumerate(RAIL_Z):
            open_end = side == 1 and z in GAP
            (cx, cz, _) = tops[(side, k)]
            p.tube(wrap(None, cx, cz, ROPE_Y, turns=1.3 if open_end else 1.7, start=rng.uniform(0, TAU)), ROPE_R * 0.95, rope, caps=True)
    # The ends of the rope at the gap: a tail hanging off each post.
    for z, s in ((GAP[0], 1), (GAP[1], -1)):
        cx, cz, _ = tops[(1, RAIL_Z.index(z))]
        tail = [(cx + 0.02, ROPE_Y - 0.01, cz + s * (POST_R + ROPE_R)), (cx + 0.05, ROPE_Y - 0.12, cz + s * (POST_R + 0.03)), (cx + 0.06, ROPE_Y - 0.24, cz + s * (POST_R + 0.025))]
        p.tube(catenary(tail[0], tail[2], -0.02, n=6), ROPE_R * 0.9, rope, caps=True)

    # ── rope fenders on the boat side, hung from the piles at the gap ─────────────────────────────────────────────
    for z in GAP:
        cx, cz, _ = tops[(1, RAIL_Z.index(z))]
        fx = cx + POST_R + 0.085
        p.tube([(cx + POST_R * 0.6, 0.44, cz), (fx - 0.01, 0.34, cz), (fx, 0.17, cz)], ROPE_R * 0.7, rope, caps=True)
        prof = [(0.0, 0.0), (0.035, 0.005), (0.06, 0.03), (0.07, 0.07), (0.07, 0.25), (0.06, 0.29), (0.035, 0.315), (0.0, 0.32)]
        p.lathe((fx, 0.17, cz), [(r, -t) for r, t in prof], rope, sides=12, v_of=lambda i, t: -t / 0.13 * 2)

    # ── iron cleats on the deck where the boat's lines tie ──────────────────────────────────────────────────────
    for cxz in CLEATS:
        x, z = cxz
        p.beam((x, 0.012, z - 0.06), (x, 0.012, z + 0.06), 0.05, 0.024, iron, 0)
        for dz in (-0.03, 0.03):
            p.beam((x, 0.03, z + dz), (x, 0.055, z + dz), 0.026, 0.02, iron, 0, up=(0, 0, 1))
        p.tube([(x, 0.062, z - 0.095), (x, 0.066, z - 0.05), (x, 0.066, z + 0.05), (x, 0.062, z + 0.095)], 0.012, iron, sides=6, caps=True)

    # ── a coil of spare line on the deck by the tip ─────────────────────────────────────────────────────────────
    coil = []
    for t in np.linspace(0, 1, 48):
        a = TAU * 3.2 * t
        rr = 0.05 + 0.1 * t
        coil.append((-0.52 + math.cos(a) * rr, 0.004 + ROPE_R + 0.004 * math.sin(a * 0.5), -2.95 + math.sin(a) * rr))
    p.tube(coil, ROPE_R, rope, caps=True)
    p.tube([coil[-1], (-0.52 + 0.2, ROPE_R, -2.95 + 0.06), (-0.52 + 0.3, ROPE_R, -2.95 + 0.2)], ROPE_R, rope, caps=True)

    ob = p.finish("pier")
    path = K.export([ob], "pier")
    print("POINTS", {"water": WATER, "tip": Z_TIP, "land": Z_LAND, "posts": [list(map(lambda v: round(v, 3), tops[(s, k)])) for s in (-1, 1) for k in range(len(RAIL_Z))], "cleats": CLEATS})
    return path


if __name__ == "__main__":
    build()
