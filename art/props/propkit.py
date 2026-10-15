"""Geometry, painted textures, export and review renders for the remodelled village props (game/remodel-props).

The style (ledger rows 307 and 310; specs/asset-audit/README.md "Style read"): our own models in the world's look, matte
and cosy in the autumn palette, "simple but not completely low poly": rounded edges and bevels, smooth normals wherever
a surface curves, clean silhouettes, nothing flat-shaded or blocky. Every surface carries a small painted texture made
here in numpy (grain, bark, stone, fibre; no downloads, no references) and a soft COLOR_0 tint: the part's colour times
a gentle top-light gradient. three.js multiplies COLOR_0 into the base colour (GLTFLoader turns vertexColors on when a
primitive has it), so one textured material can carry several painted parts in one draw.

Everything is authored in GAME coordinates (x across, y up, z away; one unit is one map cell, the character 1.36 tall)
and converted to Blender on the way in: G(x, y, z) = (x, -z, y). The glTF exporter turns it back, so a vertex at
G(x, y, z) lands at (x, y, z) in the engine. Wood and fibre textures run their grain down the image (v); every part maps
its long direction to v.

Seeded throughout: a rebuild writes the same model.
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Matrix, Vector

TAU = math.tau
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "props")


def G(x, y, z):
    return Vector((x, -z, y))


# game axes -> Blender axes (x -> x, y -> z, z -> -y)
P = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def game_rot(yaw=0.0, pitch=0.0, roll=0.0):
    """A game-space rotation: roll about z, then pitch about x, then yaw about y (three's 'YXZ')."""
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    Ry = Matrix(((cy, 0, sy), (0, 1, 0), (-sy, 0, cy)))
    Rx = Matrix(((1, 0, 0), (0, cp, -sp), (0, sp, cp)))
    Rz = Matrix(((cr, -sr, 0), (sr, cr, 0), (0, 0, 1)))
    return Ry @ Rx @ Rz


def frame_along(d, up=(0, 1, 0)):
    """A game-space 3x3 whose columns are (side, normal, along): `along` is d, `normal` as close to `up` as it can be."""
    a = Vector(d).normalized()
    u = Vector(up)
    if abs(a.dot(u.normalized())) > 0.98:
        u = Vector((1, 0, 0)) if abs(a.x) < 0.9 else Vector((0, 0, 1))
    s = u.cross(a).normalized()
    n = a.cross(s).normalized()
    return Matrix((s, n, a)).transposed()


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ================================================================ colour
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(h):
    return tuple(srgb_to_lin(c) for c in hexrgb(h))


def arr(h):
    return np.array(hexrgb(h))


# ================================================================ textures (numpy, sRGB, row 0 at the top)
def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def noise(h, w, cells, seed, cells_y=None):
    """Tileable value noise in [0, 1]: a coarse random grid upsampled with smoothstep."""
    cy, cx = cells_y or cells, cells
    g = np.random.default_rng(seed).random((cy, cx))
    ys = np.linspace(0, cy, h, endpoint=False)
    xs = np.linspace(0, cx, w, endpoint=False)
    y0, x0 = np.floor(ys).astype(int), np.floor(xs).astype(int)
    fy, fx = ys - y0, xs - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    y1, x1 = (y0 + 1) % cy, (x0 + 1) % cx
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def fbm(h, w, cells, seed, octaves=3, cells_y=None):
    out, amp, tot = np.zeros((h, w)), 1.0, 0.0
    for o in range(octaves):
        out += amp * noise(h, w, cells * 2 ** o, seed + o * 17, (cells_y or cells) * 2 ** o)
        tot += amp
        amp *= 0.5
    return out / tot


def grid(h, w):
    v = (np.arange(h) + 0.5) / h
    u = (np.arange(w) + 0.5) / w
    return np.meshgrid(u, v)


def grain(h, w, seed, tone="#ffffff", lines=(9, 23, 51), contrast=0.16, knots=2, wander=0.012):
    """Wood: long grain lines running down the image (v), wandering, parting round a knot or two; mid-grey-white so the
    part's COLOR_0 tint carries the hue. Tileable across u and down v."""
    r = np.random.default_rng(seed)
    U, V = grid(h, w)
    bend = np.zeros_like(U)
    eye = np.zeros_like(U)
    for _ in range(knots):
        ku, kv, kr = r.uniform(0.15, 0.85), r.uniform(0.1, 0.9), r.uniform(0.02, 0.035)
        d = np.hypot(U - ku, (V - kv) * 0.35)
        bend += kr * 1.6 * np.exp(-(d / (kr * 2.6)) ** 2) * np.sign(U - ku + 1e-6)
        eye = np.maximum(eye, smooth(kr * 1.1, kr * 0.35, d))
    drift = sum(r.uniform(0.3, 1.0) * wander * np.sin(TAU * (V * k + r.random())) for k in (1, 2, 3))
    g = U + drift + bend
    val = np.zeros_like(U)
    for f, a in zip(lines, (0.55, 0.3, 0.15)):
        val += a * (0.5 + 0.5 * np.sin(TAU * (g * f + r.random())))
    streak = fbm(h, w, 6, seed + 5, 3, 2)
    out = 0.86 + contrast * (val - 0.5) + 0.1 * (streak - 0.5) - eye * 0.35
    return np.clip(out[..., None] * arr(tone), 0, 1)


def bark(h, w, seed, tone="#ffffff"):
    """Bark: rough plates split by dark furrows that wander down the trunk (v), cross-cracks between the plates, a
    little moss in the shade of the furrows. Tileable across u."""
    r = np.random.default_rng(seed)
    U, V = grid(h, w)
    warp = 0.18 * (fbm(h, w, 3, seed + 1, 3, 2) - 0.5) + 0.05 * np.sin(TAU * (V * 2 + r.random()))
    x = (U * 5 + warp * 5) % 1
    furrow = smooth(0.16, 0.0, np.abs(x - 0.5) - 0.32)                 # 1 in a furrow
    plates = fbm(h, w, 5, seed + 2, 3, 9)
    cross = smooth(0.035, 0.0, np.abs(((V * 9 + plates * 1.4 + np.floor(U * 5 + warp * 5) * 0.37) % 1) - 0.5) - 0.46)
    rough = fbm(h, w, 24, seed + 3, 2, 24)
    val = 0.95 - 0.36 * furrow - 0.2 * cross * (1 - furrow) + 0.12 * (rough - 0.5) + 0.1 * (plates - 0.5)
    out = val[..., None] * arr(tone)
    moss = smooth(0.58, 0.78, fbm(h, w, 4, seed + 4)) * np.clip(furrow + cross, 0, 1)
    out = out * (1 - 0.4 * moss[..., None]) + arr("#7f8f55") * 0.4 * moss[..., None] * 0.8
    return np.clip(out, 0, 1)


def end_grain(h, w, seed, tone="#ffffff", rings=7):
    """A log's cut end: growth rings round the middle, a few radial checks, the bark rim dark."""
    r = np.random.default_rng(seed)
    U, V = grid(h, w)
    x, y = (U - 0.5) * 2, (V - 0.5) * 2
    d = np.hypot(x, y) * (1 + 0.04 * (fbm(h, w, 5, seed + 1) - 0.5))
    a = np.arctan2(y, x)
    ring = 0.5 + 0.5 * np.sin(TAU * d * rings + 0.6 * np.sin(a * 3))
    val = 0.9 + 0.1 * (ring - 0.5) - 0.18 * smooth(0.0, 0.1, 0.1 - d)
    for _ in range(4):
        ca = r.uniform(-math.pi, math.pi)
        da = np.abs((a - ca + math.pi) % TAU - math.pi)
        val -= 0.35 * smooth(0.06, 0.0, da * d) * smooth(0.25, 0.7, d) * smooth(0.98, 0.8, d)
    val -= 0.45 * smooth(0.82, 0.96, d)
    return np.clip(val[..., None] * arr(tone), 0, 1)


def stone(h, w, seed, tone="#ffffff"):
    """River stone: soft mottling, warm and cool patches, darker specks, pale lichen flecks."""
    base = 0.8 + 0.2 * (fbm(h, w, 4, seed, 4) - 0.5) * 2
    speck = smooth(0.7, 0.8, noise(h, w, 48, seed + 1)) * 0.18
    out = (base - speck)[..., None] * arr(tone)
    warm = smooth(0.4, 0.75, fbm(h, w, 3, seed + 3, 2))
    out = out * (1 - 0.18 * warm[..., None]) + arr("#c79a6a") * 0.18 * warm[..., None] * base[..., None]
    lichen = smooth(0.66, 0.8, fbm(h, w, 7, seed + 2, 3))
    out = out * (1 - 0.5 * lichen[..., None]) + arr("#c9c39a") * 0.5 * lichen[..., None]
    return np.clip(out, 0, 1)


def fibre(h, w, seed, tone="#ffffff", scale=40):
    """Coir: coarse fibres in tufts, a woven over-under in rows."""
    U, V = grid(h, w)
    tuft = fbm(h, w, scale // 4, seed, 2)
    weave = 0.5 + 0.5 * np.sin(TAU * U * scale) * np.sin(TAU * V * scale * h / w * 0.5)
    hair = noise(h, w, scale * 4, seed + 1, scale // 2)
    val = 0.78 + 0.12 * (weave - 0.5) + 0.14 * (hair - 0.5) + 0.12 * (tuft - 0.5)
    return np.clip(val[..., None] * arr(tone), 0, 1)


def linen(h, w, seed, tone="#ffffff", threads=64):
    U, V = grid(h, w)
    warp = 0.5 + 0.5 * np.sin(TAU * U * threads)
    weft = 0.5 + 0.5 * np.sin(TAU * V * threads)
    slub = fbm(h, w, 6, seed, 2, 24)
    val = 0.9 + 0.05 * (warp * weft - 0.25) + 0.06 * (slub - 0.5)
    return np.clip(val[..., None] * arr(tone), 0, 1)


def rope(h, w, seed, tone="#c7a268"):
    """Three-strand rope (art/wharf/build_wharf.py's): u round it, v along it, one lay per texture height."""
    U, V = grid(h, w)
    phase = (V * 3 + U * 3) % 1
    across = np.abs(phase - 0.5) * 2
    body = np.sqrt(np.clip(1 - across ** 2, 0, 1))
    fib = 0.5 + 0.5 * np.sin(TAU * ((V * 3 - U * 3) * 14 + 7 * noise(h, w, 8, seed)))
    light = 0.55 + 0.45 * body * (0.85 + 0.15 * np.cos(TAU * (U - 0.15)))
    val = light * (0.9 + 0.1 * fib) - 0.35 * smooth(0.75, 1.0, across)
    return np.clip(val[..., None] * arr(tone), 0, 1)


def painted_planks(h, w, seed, boards=6, tone="#ffffff", wear=0.5):
    """Painted boards: flat paint (white, the part's COLOR_0 gives the colour) with a faint grain under it, the seams
    between `boards` boards across u dark, and worn chips at the seams and edges showing warm wood."""
    U, V = grid(h, w)
    g = grain(h, w, seed, "#ffffff", contrast=0.08, knots=1)[..., 0]
    x = (U * boards) % 1
    seam = smooth(0.035, 0.0, np.minimum(x, 1 - x))
    val = 0.93 + 0.5 * (g - 0.86) - 0.4 * seam
    out = val[..., None] * arr(tone)
    chips = smooth(0.7, 0.78, fbm(h, w, 14, seed + 9, 2)) * np.clip(smooth(0.12, 0.0, np.minimum(x, 1 - x)) + 0.25, 0, 1) * wear
    wood = arr("#b08a62") / np.maximum(arr(tone), 1e-3) * 0.55          # the chip shows wood under any tint
    out = out * (1 - chips[..., None]) + np.clip(wood, 0, 1.6) * chips[..., None] * 0.6
    return np.clip(out, 0, 1)


def image(name, rgb):
    """A packed image from an [h, w, 3] float sRGB array (the exporter writes it as JPEG)."""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = np.clip(rgb[::-1], 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.file_format = "PNG"
    img.pack()
    return img


# ================================================================ materials
class Mat:
    """A matte material: a base texture (or a flat colour), roughness, an optional emissive texture (the engine eases
    its intensity: AmbientProps, Campfire), and metal (0: the look's 'metal' class comes from the name, M_Iron)."""

    def __init__(self, name, color="#ffffff", rough=0.92, tex=None, emit=None, emit_strength=1.0, double=True):
        self.name = name
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = 0.0
        if tex is not None:
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = tex
            nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        else:
            b.inputs["Base Color"].default_value = (*lin(color), 1)
        if emit is not None:
            e = nt.nodes.new("ShaderNodeTexImage")
            e.image = emit
            nt.links.new(e.outputs["Color"], b.inputs["Emission Color"])
            b.inputs["Emission Strength"].default_value = emit_strength
        m.diffuse_color = (*lin(color), 1)
        m.use_backface_culling = not double
        self.m = m


# ================================================================ geometry
class Kit:
    """One mesh: faces with per-loop UVs and COLOR_0, one material slot per Mat. Parts are built in game coordinates."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.col = self.bm.loops.layers.float_color.new("Color")
        self.mats = []

    def slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def vert(self, p):
        return self.bm.verts.new(G(*p))

    def face(self, verts, uvs, mat, col="#ffffff"):
        c = (*lin(col), 1.0) if isinstance(col, str) else col
        f = self.bm.faces.new(verts)
        for lp, uv in zip(f.loops, uvs):
            lp[self.uv].uv = uv
            lp[self.col] = c
        f.material_index = self.slot(mat)
        return f

    def ring_grid(self, rings, uvs, mat, col="#ffffff", closed=True):
        """Faces between consecutive rings of game points (same count each, round when closed); uvs[i][j] per point
        with one more column per ring when closed (the seam). A ring of one point is a pole (fan)."""
        vs = [[self.vert(p) for p in ring] for ring in rings]
        out = []
        for i in range(len(rings) - 1):
            a, b = vs[i], vs[i + 1]
            if len(a) == 1 and len(b) == 1:
                continue
            n = max(len(a), len(b))
            cols = n if closed else n - 1
            for j in range(cols):
                j2 = (j + 1) % n
                if len(a) == 1:
                    out.append(self.face([a[0], b[j2], b[j]], [uvs[i][j] if len(uvs[i]) > 1 else uvs[i][0], uvs[i + 1][j + 1], uvs[i + 1][j]], mat, col))
                    out[-1].loops[0][self.uv].uv = ((uvs[i + 1][j][0] + uvs[i + 1][j + 1][0]) / 2, uvs[i][0][1])
                elif len(b) == 1:
                    out.append(self.face([a[j], a[j2], b[0]], [uvs[i][j], uvs[i][j + 1], uvs[i + 1][0]], mat, col))
                    out[-1].loops[2][self.uv].uv = ((uvs[i][j][0] + uvs[i][j + 1][0]) / 2, uvs[i + 1][0][1])
                else:
                    out.append(self.face([a[j], a[j2], b[j2], b[j]], [uvs[i][j], uvs[i][j + 1], uvs[i + 1][j + 1], uvs[i + 1][j]], mat, col))
        return out

    def lathe(self, c, profile, mat, col="#ffffff", d=(0, 1, 0), n=12, phase=0.0, u_tiles=1.0, v_len=1.0,
              sx=1.0, sz=1.0, wobble=None, up=None):
        """Surface of revolution round the game axis d through c: profile [(radius, along)]; a radius of 0 closes to a
        pole. u runs round it (u_tiles repeats), v along the profile's length (one repeat per v_len units).
        sx/sz squash the section; wobble(k, i) -> radius factor for an out-of-round section."""
        cv, F = Vector(c), frame_along(d, up or ((1, 0, 0) if abs(Vector(d).normalized().y) > 0.9 else (0, 1, 0)))
        side, nrm, along = F.col[0], F.col[1], F.col[2]
        L = [0.0]
        for (r0, t0), (r1, t1) in zip(profile, profile[1:]):
            L.append(L[-1] + math.hypot(r1 - r0, t1 - t0))
        rings, uvs = [], []
        for i, (r, t) in enumerate(profile):
            v = L[i] / v_len
            if r <= 0:
                rings.append([tuple(cv + along * t)])
                uvs.append([(0.5 * u_tiles, v)])
                continue
            ring = []
            for k in range(n):
                a = TAU * k / n + phase
                rr = r * (wobble(k, i) if wobble else 1.0)
                ring.append(tuple(cv + along * t + side * (math.cos(a) * rr * sx) + nrm * (math.sin(a) * rr * sz)))
            rings.append(ring)
            uvs.append([(k / n * u_tiles, v) for k in range(n + 1)])
        return self.ring_grid(rings, uvs, mat, col)

    def tube(self, path, r, mat, col="#ffffff", n=8, v_len=0.15, closed_path=False, caps=False, u_tiles=1.0, radii=None):
        """A round rod or rope through game points (parallel-transported frame, no twist); closed_path joins the ends
        (a ring). u round it, v along it (one repeat per v_len). radii[i] scales the radius at point i."""
        Q = [Vector(p) for p in path]
        m = len(Q)
        idx = list(range(m)) + ([0] if closed_path else [])
        L = [0.0]
        for a, b in zip(idx, idx[1:]):
            L.append(L[-1] + (Q[b] - Q[a]).length)
        rings, uvs, prev = [], [], None
        for k_, i in enumerate(idx):
            if closed_path:
                d = (Q[(i + 1) % m] - Q[(i - 1) % m]).normalized()
            else:
                d = (Q[min(i + 1, m - 1)] - Q[max(i - 1, 0)]).normalized()
            if k_ == len(idx) - 1 and closed_path:
                rings.append(rings[0])
            else:
                ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
                n1 = (prev if prev is not None else d.cross(ref)).normalized()
                n1 = (n1 - d * n1.dot(d)).normalized()
                prev = n1
                n2 = d.cross(n1)
                rr = r * (radii[i] if radii else 1.0)
                rings.append([tuple(Q[i] + (n1 * math.cos(TAU * k / n) + n2 * math.sin(TAU * k / n)) * rr) for k in range(n)])
            uvs.append([(k / n * u_tiles, L[k_] / v_len) for k in range(n + 1)])
        faces = self.ring_grid(rings, uvs, mat, col)
        if caps and not closed_path:
            for ring, first, i in ((rings[0], True, 0), (rings[-1], False, len(rings) - 1)):
                cen = tuple(sum((Vector(q) for q in ring), Vector()) / len(ring))
                pole = [(0.5, uvs[i][0][1])]
                faces += self.ring_grid([[cen], ring] if first else [ring, [cen]], [pole, uvs[i]] if first else [uvs[i], pole], mat, col)
        return faces

    def rbox(self, c, size, r, mat, col="#ffffff", rot=None, segs=2, uv_len=1.0, v_axis=None, uv_off=(0.37, 0.21)):
        """A box with rounded edges and corners (radius r, `segs` steps round each), centred on game c, game size
        (sx, sy, sz), turned by the game-space 3x3 `rot`. UVs project per face in the box's own frame, one repeat per
        uv_len units, v along its longest side (or along `v_axis`: 0 x, 1 y, 2 z) so a plank's grain runs down it."""
        sx, sy, sz = size
        r = max(0.0, min(r, min(size) * 0.49))
        bm = self.bm
        before = set(bm.faces)
        geom = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        # Build in game-local axes inside Blender's frame: scale Blender (x, y, z) by game (sx, sz, sy).
        bmesh.ops.scale(bm, vec=Vector((sx, sz, sy)), verts=geom)
        faces = list({f for v in geom for f in v.link_faces})
        if r > 0:
            edges = list({e for f in faces for e in f.edges})
            bmesh.ops.bevel(bm, geom=edges, offset=r, segments=segs, affect="EDGES", profile=0.5, clamp_overlap=True)
        new = [f for f in bm.faces if f not in before]
        va = v_axis if v_axis is not None else int(np.argmax(size))
        bm.normal_update()
        for f in new:
            n = f.normal                     # Blender-local: x = game x, y = -game z, z = game y
            gn = (abs(n.x), abs(n.z), abs(n.y))
            ax = int(np.argmax(gn))
            others = [k for k in range(3) if k != ax]
            vk = va if va in others else others[1]
            uk = others[0] if others[0] != vk else others[1]
            for lp in f.loops:
                co = lp.vert.co
                g = (co.x, co.z, -co.y)
                lp[self.uv].uv = (g[uk] / uv_len + uv_off[0], g[vk] / uv_len + uv_off[1])
                lp[self.col] = (*lin(col), 1.0) if isinstance(col, str) else col
            f.material_index = self.slot(mat)
        R = (P @ (rot or Matrix.Identity(3)) @ P.inverted()).to_4x4()
        verts = list({v for f in new for v in f.verts})
        bmesh.ops.transform(bm, matrix=Matrix.Translation(G(*c)) @ R, verts=verts)
        return new

    def beam(self, p0, p1, w, h, r, mat, col="#ffffff", up=(0, 1, 0), segs=2, uv_len=1.0, roll=0.0, uv_off=(0.37, 0.21)):
        """A rounded timber from p0 to p1 (its centre line), w across and h deep; the grain runs along it."""
        a, b = Vector(p0), Vector(p1)
        F = frame_along(b - a, up)
        if roll:
            F = F @ Matrix.Rotation(roll, 3, "Z")
        # rbox's local axes are (x, y, z) = (side, normal, along): size (w, h, length).
        return self.rbox(tuple((a + b) / 2), (w, h, (b - a).length), r, mat, col, rot=F, segs=segs, uv_len=uv_len, v_axis=2, uv_off=uv_off)

    def blob(self, c, radii, mat, col="#ffffff", segs=12, rings=8, rot=None, seed=0, lumpy=0.0, flat_bottom=None, uv_tiles=(2, 1)):
        """A pebble / rounded lump: a UV sphere with game radii (rx, ry, rz), lumped by smooth noise, optionally sat
        flat at height flat_bottom (game y, relative). Spherical UVs."""
        r = np.random.default_rng(seed)
        bumps = [(Vector(r.normal(size=3)).normalized(), r.uniform(0.5, 1.0) * lumpy, r.uniform(0.6, 1.4)) for _ in range(6)]
        rx, ry, rz = radii
        R = rot or Matrix.Identity(3)
        cv = Vector(c)
        prof = []
        for i in range(rings + 1):
            th = math.pi * i / rings                     # 0 at the top
            row = []
            for k in range(segs):
                ph = TAU * k / segs
                dvec = Vector((math.sin(th) * math.cos(ph), math.cos(th), math.sin(th) * math.sin(ph)))
                s = 1.0 + sum(amp * max(0.0, dvec.dot(bd)) ** (2 * sh) for bd, amp, sh in bumps)
                p = Vector((dvec.x * rx * s, dvec.y * ry * s, dvec.z * rz * s))
                if flat_bottom is not None and p.y < flat_bottom:
                    p.y = flat_bottom + (p.y - flat_bottom) * 0.15
                row.append(tuple(cv + R @ p))
            prof.append(row if 0 < i < rings else [row[0]])
        uvs = [[(k / segs * uv_tiles[0], 1 - i / rings * uv_tiles[1]) for k in range(segs + 1)] for i in range(rings + 1)]
        return self.ring_grid(prof, uvs, mat, col)

    def extrude(self, outline, z0, z1, mat, col="#ffffff", bevel=0.0, rot=None, at=(0, 0, 0), uv_len=1.0, caps=True,
                cap_uv=None, steps=2):
        """A closed 2D outline [(x, y)] (game x, y; counter-clockwise) swept along game z from z0 to z1, its two rims
        rounded over by `bevel` (a quarter round in `steps`), capped flat. u runs round the outline (by length), v along
        z (grain along the sweep). cap_uv(x, y) -> uv for the caps (planar by default). Then turned by `rot` and moved
        to `at`."""
        n = len(outline)
        cx = sum(p[0] for p in outline) / n
        cy = sum(p[1] for p in outline) / n
        # 2D vertex normals (outward), for the inset rims.
        nrm = []
        for i in range(n):
            ax, ay = outline[i - 1]
            bx, by = outline[i]
            qx, qy = outline[(i + 1) % n]
            e1 = Vector((bx - ax, by - ay)).normalized()
            e2 = Vector((qx - bx, qy - by)).normalized()
            t = (e1 + e2).normalized()
            nn = Vector((t.y, -t.x))
            if nn.dot(Vector((bx - cx, by - cy))) < 0:
                nn = -nn
            nrm.append(nn)
        per = [0.0]
        for i in range(n):
            a, b = outline[i], outline[(i + 1) % n]
            per.append(per[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        R = rot or Matrix.Identity(3)
        A = Vector(at)

        def ring(z, inset):
            return [tuple(A + R @ Vector((x - nrm[i].x * inset, y - nrm[i].y * inset, z))) for i, (x, y) in enumerate(outline)]
        if bevel > 0:
            angs = [(math.pi / 2) * s_ / steps for s_ in range(steps + 1)]
            back = [(z0 + bevel * (1 - math.sin(a)), bevel * (1 - math.cos(a))) for a in angs]
            front = [(z1 - bevel * (1 - math.sin(a)), bevel * (1 - math.cos(a))) for a in angs]
            zs = sorted({(round(z, 6), round(i, 6)) for z, i in back + front}, key=lambda q: q[0])
        else:
            zs = [(z0, 0.0), (z1, 0.0)]
        rings = [ring(z, inset) for z, inset in zs]
        uvs = [[(per[i] / uv_len, z / uv_len) for i in range(n + 1)] for z, _ in zs]
        faces = self.ring_grid(rings, uvs, mat, col)
        if caps:
            for (z, inset), first in ((zs[0], True), (zs[-1], False)):
                pts = ring(z, inset)
                ctr = tuple(A + R @ Vector((cx, cy, z)))
                f_uv = cap_uv or (lambda x, y: (x / uv_len + 0.5, y / uv_len + 0.5))
                puv = [f_uv(outline[i][0] - nrm[i].x * inset, outline[i][1] - nrm[i].y * inset) for i in range(n)]
                c_uv = f_uv(cx, cy)
                vs = [self.vert(q) for q in pts]
                cv = self.vert(ctr)
                for i in range(n):
                    j = (i + 1) % n
                    tri = [cv, vs[i], vs[j]] if not first else [cv, vs[j], vs[i]]
                    tuv = [c_uv, puv[i], puv[j]] if not first else [c_uv, puv[j], puv[i]]
                    faces.append(self.face(tri, tuv, mat, col))
        return faces

    def quad(self, pts, mat, col="#ffffff", uvs=((0, 0), (1, 0), (1, 1), (0, 1))):
        return self.face([self.vert(p) for p in pts], uvs, mat, col)

    def tint_gradient(self, lo=0.78, hi=1.0, y0=None, y1=None):
        """Multiply every loop's COLOR_0 by a top-light gradient over the model's height (game y)."""
        ys = [v.co.z for v in self.bm.verts]
        a = min(ys) if y0 is None else y0
        b = max(ys) if y1 is None else y1
        for f in self.bm.faces:
            for lp in f.loops:
                t = min(1.0, max(0.0, (lp.vert.co.z - a) / max(b - a, 1e-6)))
                s = lo + (hi - lo) * t
                c = lp[self.col]
                lp[self.col] = (c[0] * s, c[1] * s, c[2] * s, 1.0)

    def finish(self, smooth_deg=50, name=None):
        """Weld nothing; split edges sharper than smooth_deg so curved surfaces shade smooth and true corners stay crisp."""
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.normal_update()
        sharp = [e for e in bm.edges if len(e.link_faces) != 2 or
                 math.degrees(e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0)) > smooth_deg]
        bmesh.ops.split_edges(bm, edges=sharp)
        for f in bm.faces:
            f.smooth = True
        me = bpy.data.meshes.new(name or self.name)
        bm.to_mesh(me)
        bm.free()
        me.color_attributes.active_color = me.color_attributes["Color"]
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
        for m in self.mats:
            me.materials.append(m.m)
        ob = bpy.data.objects.new(name or self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


# ================================================================ export
def tris(obs):
    return sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons)


def export(obs, path):
    """Static GLB of these objects (COLOR_0 on, JPEG textures) at web/public/assets/<path>."""
    full = os.path.join(ROOT, "web", "public", "assets", path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.export_scene.gltf(filepath=full, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_texcoords=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_skins=False, export_animations=False, export_image_format="JPEG",
                              export_jpeg_quality=88, export_materials="EXPORT")
    mats = sorted({m.name for o in obs for m in o.data.materials})
    texs = sorted({f"{n.image.size[0]}x{n.image.size[1]}" for o in obs for m in o.data.materials for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image})
    print(f"EXPORT {path} tris={tris(obs)} mats={mats} textures={texs} bytes={os.path.getsize(full)}")
    return full


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.cameras):
        for x in list(coll):
            if x.users == 0:
                coll.remove(x)


# ================================================================ review renders (Blender, EEVEE): quick looks while modelling
def show_vertex_colors(obs):
    """COLOR_0 multiplies the base colour in three.js; mirror that in the Blender materials (for the review render only)."""
    done = set()
    for o in obs:
        for m in o.data.materials:
            if m is None or m.name in done:
                continue
            done.add(m.name)
            nt = m.node_tree
            bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            vc = nt.nodes.new("ShaderNodeVertexColor")
            vc.layer_name = "Color"
            mul = nt.nodes.new("ShaderNodeMix")
            mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            base_in = bs.inputs["Base Color"]
            if base_in.links:
                nt.links.new(base_in.links[0].from_socket, mul.inputs[6])
            else:
                mul.inputs[6].default_value = base_in.default_value
            nt.links.new(vc.outputs["Color"], mul.inputs[7])
            nt.links.new(mul.outputs[2], base_in)


def review(obs, out_png, views=((32, 22), (212, 22)), size=420, bg="#f4efe3"):
    """Front three-quarter and back three-quarter EEVEE renders side by side, framed on the objects' bounds."""
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    try:
        sc.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    show_vertex_colors(obs)
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    node = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    node.inputs[0].default_value = (*lin(bg), 1)
    node.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy = 2.6
    sun.color = (1.0, 0.95, 0.88)
    so = bpy.data.objects.new("Key", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    pts = [o.matrix_world @ Vector(b) for o in obs for b in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, rad = (lo + hi) / 2, max((hi - lo).length / 2, 0.05)
    cam = bpy.data.cameras.new("C")
    cam.lens = 50
    co = bpy.data.objects.new("C", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = size, size
    fov = 2 * math.atan(18 / cam.lens)
    frames = []
    base = os.path.splitext(out_png)[0]
    for i, (az, el) in enumerate(views):
        a, e = math.radians(az), math.radians(el)
        gdir = Vector((math.sin(a) * math.cos(e), math.sin(e), -math.cos(a) * math.cos(e)))
        d = rad / math.sin(fov / 2) * 0.82
        co.location = centre + G(*gdir) * d
        co.rotation_euler = (centre - co.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{base}.{i}.png"
        bpy.ops.render.render(write_still=True)
        frames.append(sc.render.filepath)
    print("REVIEW", frames)
    return frames
