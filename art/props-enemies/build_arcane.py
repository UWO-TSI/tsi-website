"""Classes v2, the Arcane family wave: the four signature weapons in five tiers, the Necromancer's skeleton warrior and
the family's props (the thrown card, the bone shard, the Joker's mirror).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_arcane.py [-- id ...]
  ... -- sheet <frames_dir>    review sheet specs/evidence/classes/K-arcane-weapons.webp (imports the exported GLBs)
  ... -- held <frames_dir>     grips solved in the v7 hand sockets, specs/evidence/classes/K-arcane-weapons-held.webp

Weapons follow build_weapons.py: the grip at the origin (the hand socket), the long axis +Z (glTF +Y), the front -Y,
rig units (the character is 1.045 tall; the engine scales by 1.3). The deck and the charm have no handle: their origin
is the palm centre. One base mesh per type and one trim kit for the tiers (design sheet 1.5):
  T1 wood, cloth and cord   T2 iron bands and fittings   T3 rune-etched (carved glyph grooves, matte)
  T4 gold trim and an extra glow part (a halo band)   T5 rune glyphs on that glow part
Material names the engine re-colours a skin by: M_Body (wood, bone, card stock), M_Trim (cord / iron / rune-cut / gold),
M_Accent (the secondary detail); glow slots M_Crystal (the prism, re-tinted to the last element), M_Glow, M_Form1..5 (the
charm's forms, dimmed while unlearned) and M_Rune (pulsed). Matte everywhere; metal and glass a little glossy.
"""
import bpy, json, math, os, subprocess, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pe  # noqa: E402
from pe import TAU, lathe, rbox, on_blob, parent  # noqa: E402
import kit  # noqa: E402  (pe put art/characters on the path)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = ARGS[0] if ARGS and ARGS[0] in ("sheet", "held") else "build"
ROOT = pe.ROOT
EVIDENCE = os.path.join(ROOT, "specs", "evidence", "classes")
TEL = "telegraph"

# ================================================================ materials
CORD, IRON, RUNE_CUT, GOLD = "#d8c49c", "#8d949e", "#3f3a52", "#e2b54e"
TRIM = {1: CORD, 2: IRON, 3: RUNE_CUT, 4: GOLD, 5: GOLD}
SHEEN = {2: 0.5, 4: 0.42, 5: 0.42}          # metal trim takes a little sun specular (row 237); the rest stays matte


def mats(spec):
    """name -> '#hex' | (hex, glow) | {c, glow, emit (emission colour if not the base), rough}."""
    out = {}
    for name, v in spec.items():
        d = v if isinstance(v, dict) else {"c": v} if isinstance(v, str) else {"c": v[0], "glow": v[1]}
        m = pe.materials({name: (d["c"], d.get("glow", 0), d.get("alpha", 1))})[name]
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        if d.get("emit"):
            b.inputs["Emission Color"].default_value = (*kit.lin(d["emit"]), 1)
        b.inputs["Roughness"].default_value = d.get("rough", 0.9)
        out[name] = m
    return out


def trim(tier, t3=RUNE_CUT):
    return {"c": t3 if tier == 3 else TRIM[tier], "rough": SHEEN.get(tier, 0.9)}


# ================================================================ shapes
def slab(pc, c, n, u, outline, t, top=None, bot=None, side=None):
    """A 2D outline [(a, b)] in the plane of u and w = n x u, extruded t along n about c; any polygon (n-gon caps).
    top / bot / side: material of the +n cap, the -n cap and the walls (None: the current one)."""
    c, n = Vector(c), Vector(n).normalized()
    u = (Vector(u) - n * Vector(u).dot(n)).normalized()
    w = n.cross(u)
    area = sum(a0 * b1 - a1 * b0 for (a0, b0), (a1, b1) in zip(outline, outline[1:] + outline[:1]))
    pts = outline if area > 0 else outline[::-1]
    P = lambda a, b, h: c + u * a + w * b + n * h
    lo = [pc.v(P(a, b, -t / 2)) for a, b in pts]
    hi = [pc.v(P(a, b, t / 2)) for a, b in pts]
    keep, k = pc.mat, len(pts)
    pc.mat = side or keep
    for i in range(k):
        j = (i + 1) % k
        (a0, b0), (a1, b1) = pts[i], pts[j]
        out = (u * (b1 - b0) - w * (a1 - a0)).normalized()
        pc.f([lo[i], lo[j], hi[j], hi[i]], P((a0 + a1) / 2, (b0 + b1) / 2, 0) - out * 0.01)
    pc.mat = top or keep
    pc.f(hi, c - n * t)
    pc.mat = bot or keep
    pc.f(lo[::-1], c + n * t)
    pc.mat = keep


def decal(pc, c, n, u, outline, lift=0.0006):
    """A flat shape lying on a surface (one face, lifted clear of it): a printed pip, a sigil."""
    c, n = Vector(c), Vector(n).normalized()
    u = (Vector(u) - n * Vector(u).dot(n)).normalized()
    w = n.cross(u)
    pc.f([pc.v(c + u * a + w * b + n * lift) for a, b in outline], c - n * 0.01)


def rrect(w, h, r, k=1):
    """Rounded-rectangle outline (CCW), corner radius r in k segments (k=1: a chamfer)."""
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        pts += [(cx + r * math.cos(math.radians(a0 + 90 * i / k)), cy + r * math.sin(math.radians(a0 + 90 * i / k))) for i in range(k + 1)]
    return pts


def star(ro, ri, n=4, sy=1.0, phase=math.pi / 2):
    return [((ro if i % 2 == 0 else ri) * math.cos(phase + math.pi * i / n), (ro if i % 2 == 0 else ri) * sy * math.sin(phase + math.pi * i / n))
            for i in range(2 * n)]


def ring_band(pc, c, e1, e2, r, dr, dh, n=10, arc=None):
    """A band of rectangular section round c in the plane (e1, e2): centreline radius r (or (r1, r2), an ellipse),
    dr across in the plane, dh along the axis e1 x e2. arc=(deg0, deg1): an open, capped arc. Returns the centreline."""
    c, e1, e2 = Vector(c), Vector(e1).normalized(), Vector(e2).normalized()
    ax = e1.cross(e2)
    r1, r2 = r if isinstance(r, (tuple, list)) else (r, r)
    closed = arc is None
    angs = [TAU * k / n for k in range(n)] if closed else [math.radians(arc[0] + (arc[1] - arc[0]) * k / (n - 1)) for k in range(n)]
    rows, cores = [], []
    for a in angs:
        p = c + e1 * (r1 * math.cos(a)) + e2 * (r2 * math.sin(a))
        nrm = (e1 * (math.cos(a) / r1) + e2 * (math.sin(a) / r2)).normalized()
        rows.append([pc.v(p + nrm * s0 + ax * s1) for s0, s1 in ((-dr / 2, -dh / 2), (dr / 2, -dh / 2), (dr / 2, dh / 2), (-dr / 2, dh / 2))])
        cores.append((p, nrm))
    for i in range(len(rows) if closed else len(rows) - 1):
        j = (i + 1) % len(rows)
        core = (cores[i][0] + cores[j][0]) / 2
        for k in range(4):
            pc.f([rows[i][k], rows[i][(k + 1) % 4], rows[j][(k + 1) % 4], rows[j][k]], core)
    if not closed:
        pc.f(rows[0], cores[1][0])
        pc.f(rows[-1], cores[-2][0])
    return cores, ax


def flat_ring(pc, c, e1, e2, r0, r1, n=10, lift=0.0008):
    """A flat annulus r0..r1 lying on a surface of normal e1 x e2, lifted clear of it: an inlaid ring. Returns its
    centreline points and the normal."""
    c, e1, e2 = Vector(c), Vector(e1).normalized(), Vector(e2).normalized()
    nrm = e1.cross(e2)
    dirs = [e1 * math.cos(TAU * k / n) + e2 * math.sin(TAU * k / n) for k in range(n)]
    inner = [pc.v(c + d * r0 + nrm * lift) for d in dirs]
    outer = [pc.v(c + d * r1 + nrm * lift) for d in dirs]
    for k in range(n):
        j = (k + 1) % n
        pc.f([inner[k], outer[k], outer[j], inner[j]], c - nrm * 0.01)
    return [c + d * (r0 + r1) / 2 + nrm * lift for d in dirs], nrm


def horn(pc, path, radii, n=6, front=(0, -1, 0), tip=True, cap=True):
    """A tapered tube along a curved path whose rings keep one face square to `front` (glyphs sit flat on it).
    Returns that face per segment: (centre, outward normal, along) for glyph placement."""
    path, front = [Vector(p) for p in path], Vector(front)
    rings, faces = [], []
    for i, (p, r) in enumerate(zip(path, radii)):
        a = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        e1 = (front - a * front.dot(a)).normalized()
        e2 = a.cross(e1)
        rings.append([pc.v(p + (e1 * math.cos(TAU * (j + 0.5) / n) + e2 * math.sin(TAU * (j + 0.5) / n)) * r) for j in range(n)])
    for i in range(len(path) - 1):
        mid = (path[i] + path[i + 1]) / 2
        for j in range(n):
            pc.f([rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]], mid)
        q = [rings[i][n - 1].co, rings[i][0].co, rings[i + 1][0].co, rings[i + 1][n - 1].co]
        cen = sum(q, Vector()) / 4
        nrm = (q[2] - q[0]).cross(q[3] - q[1]).normalized()
        if nrm.dot(cen - mid) < 0:
            nrm = -nrm
        faces.append((cen, nrm, (path[i + 1] - path[i]).normalized()))
    if cap:
        c0 = pc.v(path[0])
        for j in range(n):
            pc.f([rings[0][(j + 1) % n], rings[0][j], c0], (path[0] + path[1]) / 2)
    if tip:
        end = pc.v(path[-1] + (path[-1] - path[-2]).normalized() * radii[-1] * 1.8)
        for j in range(n):
            pc.f([rings[-1][j], rings[-1][(j + 1) % n], end], path[-1])
    return faces


# ================================================================ rune glyphs
# Elder-futhark-like marks as strokes in a unit box (x across, y up), each 2-3 strokes.
GLYPHS = [
    [((0, -0.5), (0, 0.5)), ((0, 0.5), (-0.34, 0.16)), ((0, 0.5), (0.34, 0.16))],          # tiwaz
    [((0, -0.5), (0, 0.5)), ((0, 0.14), (0.36, 0.46)), ((0, -0.2), (0.36, 0.14))],          # fehu
    [((0, -0.5), (0, 0.5)), ((0, 0.02), (-0.36, 0.44)), ((0, 0.02), (0.36, 0.44))],         # algiz
    [((0.3, 0.5), (-0.26, 0.0)), ((-0.26, 0.0), (0.3, -0.5))],                              # kenaz
    [((-0.3, 0.5), (0.3, 0.12)), ((0.3, 0.12), (-0.3, -0.12)), ((-0.3, -0.12), (0.3, -0.5))],    # sowilo
    [((0, -0.5), (0, 0.5)), ((0, 0.5), (0.34, 0.22)), ((0.34, 0.22), (0, -0.04))],          # wunjo
]


def stroke(pc, a, b, n, w, h=0.0, lift=0.0006, closed=False):
    """One glyph stroke from a to b on a surface of normal n: an inked/carved line (h = 0, one quad) or a raised bar."""
    a, b, n = Vector(a), Vector(b), Vector(n).normalized()
    d = b - a
    if d.length < 1e-6:
        return
    d.normalize()
    s = n.cross(d) * (w / 2)
    a, b = a - d * (w * 0.35), b + d * (w * 0.35)
    base = [a - s, b - s, b + s, a + s]
    if not h:
        pc.f([pc.v(p + n * lift) for p in base], (a + b) / 2 - n * 0.01)
        return
    lo = [pc.v(p + n * lift) for p in base]
    hi = [pc.v(p + n * (lift + h)) for p in base]
    core = (a + b) / 2 + n * (lift + h / 2)
    pc.f(hi, core - n * 0.05)
    if closed:
        pc.f(lo[::-1], core + n * 0.05)
    for i in range(4):
        pc.f([lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]], core)


def glyph(pc, k, c, n, up, size, w, h=0.0, lift=0.0006, closed=False):
    """Rune glyph k centred at c on a surface of normal n, its up along `up`, `size` tall."""
    c, n = Vector(c), Vector(n).normalized()
    up = (Vector(up) - n * Vector(up).dot(n)).normalized()
    right = up.cross(n)
    for (x0, y0), (x1, y1) in GLYPHS[k % len(GLYPHS)]:
        stroke(pc, c + (right * x0 + up * y0) * size, c + (right * x1 + up * y1) * size, n, w, h, lift, closed)


def collar(pc, c, axis, r, h, tier, n=6, ridge=False):
    """A trim band round a shaft: T1 a cord lashing (ribbed), from T2 a plain metal band; ridge: one narrow ring."""
    if ridge:
        prof = [(r, -h / 2), (r + 0.004, 0), (r, h / 2)]
    elif tier == 1:
        prof = [(r, -h / 2), (r + 0.004, -h / 4), (r + 0.0015, 0), (r + 0.004, h / 4), (r, h / 2)]
    else:
        prof = [(r, -h / 2), (r + 0.0045, -h / 2 + 0.002), (r + 0.0045, h / 2 - 0.002), (r, h / 2)]
    lathe(pc, c, prof, n=n, axis=axis)


def runes_on_band(pc, cores, ax, dr, picks, size, w=0.0021):
    """T5: rune glyphs inlaid on a halo band's outer face, at centreline indices `picks`, upright along the band axis."""
    for k, i in enumerate(picks):
        p, nrm = cores[i]
        glyph(pc, k + 1, p + nrm * (dr / 2), nrm, ax, size, w, lift=0.0005)


def weapon(wid, spec, build, sharp=50, grad=(0.8, 1.0)):
    ob = pe.part(wid, mats(spec), build, sharp=sharp)
    pe.regrade([ob], grad)
    return [ob]


# ================================================================ prism staff (Elementalist)
def prism_staff(tier):
    """An ash staff whose three-pronged head cradles a tall prism (M_Crystal, near-white lilac: the engine tints it to
    the last element); a plum leather grip. Length like staff-oak: butt -0.28, prism tip 0.69."""
    spec = {"M_Body": "#b98c5f", "M_Trim": trim(tier), "M_Accent": "#5d3f8e", "M_Crystal": ("#ddd0ff", 0.35)}
    if tier >= 4:
        spec["M_Glow"] = ("#a77bff", 0.5)
    if tier >= 5:
        spec["M_Rune"] = ("#fff4d0", 1.0)
    R = lambda z: 0.0152 + 0.0036 * (z + 0.26) / 0.73
    HEAD = Vector((0, 0, 0.6))

    def b(pc):
        pc.mat = "M_Body"
        lathe(pc, (0, 0, 0), [(0, -0.262), (R(-0.26), -0.26), (R(0.0), 0.0), (R(0.47), 0.47), (0, 0.472)], n=6)
        for k in range(3):                                  # three prongs: one in front, two behind framing the prism
            a = math.radians(270 + 120 * k)
            d = Vector((math.cos(a), math.sin(a), 0))
            P = lambda rr, z: Vector((0, 0, z)) + d * rr
            pc.tube([P(0.011, 0.468), P(0.041, 0.528), P(0.046, 0.598), P(0.028, 0.652)], [0.0105, 0.0095, 0.0078, 0.0052],
                    sides=4, tip=True, cap=False)
        pc.mat = "M_Crystal"
        lathe(pc, HEAD, [(0, -0.07), (0.029, -0.032), (0.033, 0.036), (0, 0.09)], n=6, phase=math.pi / 6)
        pc.mat = "M_Accent"                                 # the leather grip
        lathe(pc, (0, 0, 0), [(R(-0.074), -0.074), (R(-0.07) + 0.0035, -0.07), (R(0.07) + 0.0035, 0.07), (R(0.074), 0.074)], n=6)
        pc.mat = "M_Trim"
        collar(pc, (0, 0, 0.458), (0, 0, 1), R(0.458), 0.036, tier)                      # the head's collar
        for z in (-0.082, 0.082):                                                       # the grip's end rings
            collar(pc, (0, 0, z), (0, 0, 1), R(z), 0.013, tier, ridge=True)
        lathe(pc, (0, 0, 0), [(R(-0.234), -0.234), (R(-0.24) + 0.0038, -0.24), (0.0105, -0.273), (0, -0.279)], n=6)  # the butt cap
        if tier >= 3:                                       # carved glyphs on the shaft's front and back faces
            for k, (z, s) in enumerate(((0.2, -1), (0.33, -1), (0.265, 1), (0.14, 1))):
                ap = R(z) * math.cos(math.pi / 6)
                glyph(pc, k, (0, s * ap, z), (0, s, 0), (0, 0, 1), 0.024, w=0.0028)
        if tier >= 4:                                       # a halo band tilted round the prism
            t = math.radians(16)
            pc.mat = "M_Glow"
            cores, ax = ring_band(pc, HEAD + Vector((0, 0, 0.004)), (1, 0, 0), (0, math.cos(t), -math.sin(t)), 0.068, 0.003, 0.012, n=10)
            if tier >= 5:
                pc.mat = "M_Rune"
                runes_on_band(pc, cores, ax, 0.003, (1, 4, 8), 0.0108)

    return weapon(f"prism-staff-{tier}", spec, b)


# ================================================================ trick deck (Illusionist)
CARD_W, CARD_H, CARD_T = 0.07, 0.10, 0.004


def card(pc, c, n, u, t=CARD_T, w=CARD_W, h=CARD_H, pip=True):
    """A playing card: face (+n side) cream with a purple diamond pip, back purple with a faint gold four-point sigil,
    edges in the trim. Returns the back's centre and normal."""
    c, n, u = Vector(c), Vector(n).normalized(), Vector(u)
    slab(pc, c, n, u, rrect(w, h, 0.0085), t, top="M_Accent", bot="M_Body", side="M_Trim")
    if pip:
        pc.mat = "M_Body"
        decal(pc, c + n * (t / 2), n, u, [(0, 0.019 * h / CARD_H), (-0.0125 * w / CARD_W, 0), (0, -0.019 * h / CARD_H), (0.0125 * w / CARD_W, 0)])
    pc.mat = "M_Glow"
    back = c - n * (t / 2)
    decal(pc, back, -n, u, star(0.0175 * h / CARD_H, 0.0045 * w / CARD_W, 4, sy=1.0))
    return back, -n


def trick_deck(tier):
    """Five enchanted cards fanned from a floating pivot above the right palm (the origin): faces (cream, pips) toward
    -Y, the purple backs with their faint sigils toward the holder and the follow camera. A rivet pins the fan
    (the trim); total height 0.18."""
    spec = {"M_Body": "#6a3fc2", "M_Trim": trim(tier, t3="#cbbde9"), "M_Accent": "#f6eedb", "M_Glow": ("#f2b84b", 0.38)}
    if tier >= 5:
        spec["M_Rune"] = ("#fff1c4", 1.0)
    PIV = Vector((0, 0, 0.083))

    def b(pc):
        for k in range(5):
            th = math.radians((k - 2) * 16)
            Rk = Matrix.Rotation(th, 3, "Y")
            y = (k - 2) * 0.0056
            c = PIV + Vector((0, y, 0)) + Rk @ Vector((0, 0, CARD_H / 2 - 0.012))
            back, bn = card(pc, c, (0, -1, 0), Rk @ Vector((1, 0, 0)))
            if tier >= 3:                                   # etched runes above and below the sigil
                pc.mat = "M_Trim"
                up = Rk @ Vector((0, 0, 1))
                glyph(pc, k, back + up * 0.033, bn, up, 0.016, w=0.0022, lift=0.0007)
                glyph(pc, k + 3, back - up * 0.033, bn, up, 0.016, w=0.0022, lift=0.0007)
        pc.mat = "M_Trim"                                   # the rivet through the fan's pivot
        lathe(pc, PIV, [(0, -0.0172), (0.0062, -0.0158), (0.0078, -0.012), (0.0078, 0.012), (0.0062, 0.0158), (0, 0.0172)], n=8, axis=(0, 1, 0))
        if tier >= 4:                                       # a crescent halo behind the fan's crown
            pc.mat = "M_Glow"
            cores, ax = ring_band(pc, PIV + Vector((0, 0.021, 0)), (0, 0, 1), (1, 0, 0), 0.105, 0.0072, 0.003, n=9, arc=(-46, 46))
            if tier >= 5:
                pc.mat = "M_Rune"
                for k, i in enumerate((1, 4, 7)):
                    p, nrm = cores[i]
                    glyph(pc, k + 2, p + Vector((0, 0.0015, 0)), (0, 1, 0), nrm, 0.006, w=0.0015, lift=0.0005)

    return weapon(f"trick-deck-{tier}", spec, b, sharp=50, grad=(0.85, 1.0))


# ================================================================ bone tome (Necromancer)
def bone_tome(tier):
    """A grimoire bound in bone, authored like tome-spirits (held at the bottom edge; covers +-X, spine -Y): a ribcage
    over the front cover (+X) round a soul gem, vertebrae down the spine, a jawbone biting the fore-edge shut, black
    pages. The soul gem (M_Glow) is violet with a soul-green glow."""
    spec = {"M_Body": "#e8dcc0", "M_Trim": trim(tier), "M_Accent": "#3b3047",
            "M_Glow": {"c": "#3b2470", "glow": 0.65, "emit": "#5dff9a"}}
    if tier >= 5:
        spec["M_Rune"] = ("#c9ffe2", 1.0)
    H, W, T, z0 = 0.19, 0.15, 0.056, -0.01
    zc = z0 + H / 2
    GY = -0.004                                             # the gem's centre across the cover

    def b(pc):
        pc.mat = "M_Body"
        rbox(pc, (0, 0, zc), (T, W, H), ch=0.35)
        pc.mat = "M_Accent"                                 # the page block shows on the three open edges
        rbox(pc, (0, 0.006, zc), (T * 0.72, W - 0.004, H + 0.006), ch=0)
        pc.mat = "M_Body"
        xr = T / 2 + 0.0015
        for z in (zc + 0.07, zc + 0.036, zc - 0.05):        # a ribcage arching off the spine
            pc.tube([(xr, -W / 2 + 0.008, z), (xr, -0.03, z + 0.011), (xr, 0.012, z + 0.006), (xr, 0.046, z - 0.02)],
                    [(0.0036, 0.0062), (0.0036, 0.006), (0.0033, 0.0052), (0.0022, 0.0026)], sides=4, tip=False)
        for z in (zc - 0.062, zc, zc + 0.062):              # vertebrae down the spine, each with its spur
            pc.blob((0, -W / 2 - 0.002, z), (T / 2 + 0.003, 0.0085, 0.017), segs=6, rings=3)
            lathe(pc, (0, -W / 2 - 0.007, z), [(0.0075, 0), (0, 0.013)], n=4, axis=(0, -1, 0.25))
        jaw = [(T / 2 + 0.003, W / 2 - 0.03, zc + 0.003), (T / 2 + 0.003, W / 2 + 0.001, zc), (0, W / 2 + 0.011, zc - 0.003),
               (-T / 2 - 0.003, W / 2 + 0.001, zc), (-T / 2 - 0.003, W / 2 - 0.03, zc + 0.003)]
        pc.tube(jaw, [(0.0048, 0.0095)] * 5, sides=4, tip=False)                        # the jawbone clasp
        for x in (-0.013, 0.0, 0.013):                      # its teeth along the fore-edge
            lathe(pc, (x, W / 2 + 0.011, zc + 0.006), [(0.0042, 0), (0, 0.011)], n=3, axis=(0, 0, 1))
        pc.mat = "M_Trim"
        for s in (1, -1):                                   # rivets at the jaw's hinges
            lathe(pc, (s * (T / 2 + 0.006), W / 2 - 0.03, zc + 0.003), [(0, -0.002), (0.0066, 0.0005), (0, 0.0042)], n=4, axis=(s, 0, 0), phase=math.pi / 4)
        for zt, sz in ((z0 + H, 1), (z0, -1)):              # corner pieces on the fore-edge, over both covers
            e = zt + sz * 0.002
            slab(pc, (0, 0, 0), (1, 0, 0), (0, 1, 0), [(W / 2 + 0.002, e), (W / 2 + 0.002 - 0.031, e), (W / 2 + 0.002, e - sz * 0.031)], T + 0.006)
        lathe(pc, (T / 2, GY, zc), [(0.0152, 0.0), (0.0205, 0.0022), (0.0142, 0.0048)], n=6, axis=(1, 0, 0))   # the soul gem's bezel
        if tier >= 3:                                       # carved glyphs round the ribcage and on the back cover
            for k, (y, z, s) in enumerate(((0.03, zc + 0.083, 1), (0.03, zc - 0.081, 1), (GY, zc + 0.05, -1), (GY, zc - 0.05, -1),
                                           (-0.042, zc, -1), (0.036, zc, -1))):
                glyph(pc, k, (s * T / 2, y, z), (s, 0, 0), (0, 0, 1), 0.017, w=0.0024)
        pc.mat = "M_Glow"
        lathe(pc, (T / 2, GY, zc), [(0, -0.002), (0.0152, 0.0), (0.0105, 0.0072), (0, 0.0098)], n=6, axis=(1, 0, 0), phase=math.pi / 6)
        if tier >= 4:                                       # a glowing ring inlaid round the soul gem
            pts, nrm = flat_ring(pc, (T / 2, GY, zc), (0, 0, 1), (0, -1, 0), 0.0238, 0.031, n=10)
            if tier >= 5:
                pc.mat = "M_Rune"
                for k, i in enumerate((0, 3, 7)):           # runes on it, upright
                    glyph(pc, k, pts[i], nrm, (0, 0, 1), 0.0056, w=0.0014, lift=0.0005)

    return weapon(f"bone-tome-{tier}", spec, b, sharp=50)


# ================================================================ tooth charm (Transmuter)
FORMS = ["#a66bff", "#ffb347", "#7ff0ff", "#f2cf5b", "#b8b0a0"]          # fox, crab, wisp, pollen, golem
BAND_C, BAND_R = Vector((-0.010, -0.010, 0.0015)), (0.0365, 0.034)       # the cord's loop round the v7 fist (socket probe)


def tooth_charm(tier):
    """A monster-tooth charm on a cord wrapped round the right fist (origin = the palm centre). Authored as worn on a
    fist punching -Y, palm down: the cord loops the knuckles round the hand's long axis (Y), five socket gems across the
    back of the hand (+Z; M_Form1 fox on the thumb side +X to M_Form5 golem on the little-finger side), one big fang
    hanging under the knuckles. Grip [0, -pi/2, 0] in the right hand socket maps this frame onto the hand."""
    spec = {"M_Body": "#f1e6cc", "M_Trim": trim(tier), "M_Accent": "#5b3e2c"}
    spec.update({f"M_Form{i + 1}": (c, 0.55) for i, c in enumerate(FORMS)})
    if tier >= 4:
        spec["M_Glow"] = ("#b48cff", 0.6)
    if tier >= 5:
        spec["M_Rune"] = ("#efe4ff", 1.0)
    X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))
    rx, rz = BAND_R

    def on_band(phi, out):
        """Point on the cord's outer face at phi from the top (+Z; positive toward the thumb, +X) and its normal."""
        p = BAND_C + X * (rx * math.sin(phi)) + Z * (rz * math.cos(phi))
        n = (X * (math.sin(phi) / rx) + Z * (math.cos(phi) / rz)).normalized()
        return p + n * out, n

    def b(pc):
        pc.mat = "M_Accent"
        ring_band(pc, BAND_C, Z, X, (rz, rx), 0.0042, 0.0125, n=10)
        root, _ = on_band(math.pi, 0.0021)
        top = root + Vector((0, -0.002, -0.004))
        fang = [top + Vector(v) for v in ((0, 0, -0.004), (0, -0.003, -0.024), (0, -0.01, -0.045), (0, -0.022, -0.062))]
        pc.mat = "M_Body"
        faces = horn(pc, fang, [0.0112, 0.0098, 0.0068, 0.0032], n=5, front=(0, -1, 0.25), cap=False)
        pc.mat = "M_Trim"
        axis = (fang[0] - fang[1]).normalized()
        lathe(pc, fang[0], [(0.005, 0.009), (0.0128, 0.0022), (0.0114, -0.0075)], n=6, axis=axis)   # the fang's cap
        for i in range(5):                                   # five socket gems across the back of the hand
            phi = math.radians((2 - i) * 26)
            p, nrm = on_band(phi, 0.0021)
            pc.mat = "M_Trim"
            lathe(pc, p, [(0.0058, -0.001), (0.0079, 0.0024)], n=6, axis=nrm)
            pc.mat = f"M_Form{i + 1}"
            lathe(pc, p, [(0, -0.0015), (0.0059, 0.0008), (0, 0.0062)], n=6, axis=nrm, phase=math.pi / 6)
        if tier >= 3:                                       # scrimshaw: runes carved down the fang's front
            pc.mat = "M_Trim"
            for k, si in enumerate((0, 1)):
                cen, nrm, along = faces[si]
                glyph(pc, k + 2, cen, nrm, -along, 0.0115, w=0.0019)
        if tier >= 4:                                       # a halo band round the fang under its cap
            pc.mat = "M_Glow"
            e1 = (Vector((1, 0, 0)) - axis * axis.x).normalized()
            cores, ax = ring_band(pc, fang[1] + axis * 0.004, e1, axis.cross(e1), 0.0148, 0.0032, 0.0064, n=8)
            if tier >= 5:
                pc.mat = "M_Rune"
                for k, i in enumerate((0, 3, 6)):
                    p, nrm = cores[i]
                    glyph(pc, k, p + nrm * 0.0016, nrm, ax, 0.0054, w=0.0013, lift=0.0005)

    return weapon(f"tooth-charm-{tier}", spec, b, sharp=50, grad=(0.85, 1.0))


# ================================================================ skeleton warrior (Necromancer's raised dead)
def skeleton_warrior():
    """A chibi skeleton, part-rigged like the zone-1 mobs (telegraph.ts partPose): body (pelvis, spine, ribcage) with
    the skull `head` > `glow_eyes`, `arm_l`, `arm_r` (a short notched rusty blade) and `leg_l`, `leg_r`, each pivoted on
    its joint. Faces -Y, feet on z = 0, 0.8 tall. Cheap: ~30 are drawn instanced."""
    M = mats({"M_Bone": "#efe6d2", "M_Dark": "#3b3346", "M_Blade": "#a8745a", "M_Grip": "#5b4033", TEL: ("#7dffb0", 0.6)})
    S = 1.05
    P = lambda x, y, z: Vector((x * S, y * S, z * S))
    SK, SR = P(0, -0.005, 0.645), tuple(r * S for r in (0.128, 0.118, 0.115))

    def body(pc):
        pc.mat = "M_Bone"
        pc.blob(P(0, 0.006, 0.285), tuple(r * S for r in (0.08, 0.056, 0.04)), segs=6, rings=3)          # pelvis
        pc.tube([P(0, 0.03, 0.29), P(0, 0.04, 0.4), P(0, 0.024, 0.52)], [0.016 * S, 0.017 * S, 0.014 * S], sides=5, tip=False)
        for z, rx, ry in ((0.475, 0.084, 0.066), (0.433, 0.08, 0.064), (0.391, 0.068, 0.056)):           # three ribs
            pts = [P(0.012, 0.046, z + 0.01)]
            for a in (15, -90, 195):
                ar = math.radians(a)
                pts.append(P(rx * math.cos(ar), 0.012 + ry * math.sin(ar), z - 0.014 * max(0.0, -math.sin(ar))))
            pts.append(P(-0.012, 0.046, z + 0.01))
            pc.tube(pts, [0.0088 * S] * len(pts), sides=3, tip=False, cap=False)
        pc.tube([P(0, -0.062, 0.48), P(0, -0.058, 0.395)], [0.011 * S, 0.009 * S], sides=3, tip=False)          # sternum
        pc.tube([P(0.104, 0.004, 0.502), P(0, -0.008, 0.514), P(-0.104, 0.004, 0.502)], [0.0115 * S, 0.0125 * S, 0.0115 * S], sides=3, tip=False)
        pc.mat = "M_Dark"                                   # the chest's shadow behind the ribs
        pc.blob(P(0, 0.012, 0.43), tuple(r * S for r in (0.066, 0.052, 0.058)), segs=6, rings=3)

    def head(pc):
        pc.mat = "M_Bone"
        pc.blob(SK, SR, segs=8, rings=5)
        pc.blob(P(0, -0.042, 0.548), tuple(r * S for r in (0.078, 0.066, 0.04)), segs=6, rings=3)        # cheeks and jaw
        pc.mat = "M_Dark"
        for s in (1, -1):                                   # sockets, a little angry
            p, n = on_blob(SK, SR, s * 0.052 * S, 0.652 * S)
            lathe(pc, p - n * 0.006, [(0, -0.006), (1, 0), (0, 0.0035)], n=6, axis=n, sx=0.036 * S, sy=0.04 * S, tilt=-s * math.radians(18))
        p, n = on_blob(SK, SR, 0, 0.597 * S)
        lathe(pc, p - n * 0.004, [(0, -0.004), (1, 0), (0, 0.003)], n=3, axis=n, sx=0.016 * S, sy=0.014 * S, tilt=math.pi / 2)

    def glow(pc):
        pc.mat = TEL
        for s in (1, -1):
            p, n = on_blob(SK, SR, s * 0.052 * S, 0.648 * S)
            lathe(pc, p - n * 0.002, [(0, -0.003), (1, 0), (0, 0.0045)], n=6, axis=n, sx=0.0135 * S, sy=0.016 * S)

    def arm(s):
        def b(pc):
            pc.mat = "M_Bone"
            hand = P(s * 0.128, -0.03, 0.322)
            pc.tube([P(s * 0.104, 0.002, 0.5), P(s * 0.124, 0.014, 0.414), P(s * 0.128, -0.017, 0.345)], [0.0145 * S, 0.013 * S, 0.012 * S], sides=4, tip=False)
            pc.blob(hand, 0.0215 * S, segs=5, rings=3)
            if s < 0:                                       # the right hand's short sword, held forward and up
                d = Vector((0, -0.85, 0.53)).normalized()
                ac = Vector((0, 0.53, 0.85)).normalized()
                pc.mat = "M_Grip"
                pc.tube([hand - d * 0.028, hand + d * 0.03], [0.0085, 0.0085], sides=4, tip=False)
                pc.mat = "M_Blade"
                pc.tube([hand + d * 0.037 - ac * 0.03, hand + d * 0.037 + ac * 0.03], [0.008, 0.008], sides=4, tip=False)
                nb = Vector((1, 0, 0))
                out = [(0.045, -0.016), (0.105, -0.018), (0.115, -0.010), (0.126, -0.018), (0.168, -0.014), (0.2, 0.0), (0.176, 0.015),
                       (0.122, 0.017), (0.1, 0.0105), (0.088, 0.017), (0.045, 0.015)]
                slab(pc, hand, nb, d, out, 0.0085)
        return b

    def leg(s):
        def b(pc):
            pc.mat = "M_Bone"
            pc.tube([P(s * 0.05, 0.005, 0.285), P(s * 0.056, -0.008, 0.16), P(s * 0.055, 0.004, 0.05)], [0.0155 * S, 0.0135 * S, 0.012 * S], sides=4, tip=False)
            pc.blob(P(s * 0.056, -0.022, 0.022), tuple(r * S for r in (0.03, 0.045, 0.022)), segs=6, rings=3)
        return b

    SOFT = 62
    b = pe.part("body", M, body, pivot=P(0, 0.02, 0.29), sharp=SOFT)
    h = pe.part("head", M, head, pivot=P(0, 0.0, 0.525), sharp=SOFT)
    g = pe.part("glow_eyes", M, glow, pivot=P(0, -0.1, 0.65))
    al, ar = (pe.part(n, M, arm(s), pivot=P(s * 0.104, 0.002, 0.5), sharp=SOFT) for n, s in (("arm_l", 1), ("arm_r", -1)))
    ll, lr = (pe.part(n, M, leg(s), pivot=P(s * 0.05, 0.005, 0.285), sharp=SOFT) for n, s in (("leg_l", 1), ("leg_r", -1)))
    parent(g, h)
    for o in (h, al, ar, ll, lr):
        parent(o, b)
    objs = [b, h, g, al, ar, ll, lr]
    pe.regrade(objs, (0.72, 1.0))
    return objs


# ================================================================ props
FWD = (0, -1, 0)


def projectile_card():
    """The Illusionist's thrown card (combat_fx convention: flies -Y, centred on the origin): flat, back up (purple,
    gold sigil) so the follow camera reads it, long axis along the flight. 1.5x a deck card (0.07 x 0.10)."""
    M = mats({"M_Body": "#6a3fc2", "M_Accent": "#f6eedb", "M_Trim": GOLD, "M_Glow": ("#ffd98a", 0.5)})

    def b(pc):
        k = 1.5
        slab(pc, (0, 0, 0), (0, 0, -1), (1, 0, 0), rrect(CARD_W * k, CARD_H * k, 0.012), 0.006, top="M_Accent", bot="M_Body", side="M_Trim")
        pc.mat = "M_Body"
        decal(pc, (0, 0, -0.003), (0, 0, -1), (1, 0, 0), [(0, 0.028), (-0.019, 0), (0, -0.028), (0.019, 0)])
        pc.mat = "M_Glow"
        decal(pc, (0, 0, 0.003), (0, 0, 1), (1, 0, 0), star(0.027, 0.0068, 4))

    ob = pe.part("card", M, b, sharp=50)
    pe.regrade([ob], (0.9, 1.0), axis=1)
    return [ob]


def projectile_bone():
    """The Necromancer's bone shard (flies -Y, centred): a splintered spike with a broken, jagged back and two wisps of
    soul-fire trailing it."""
    M = mats({"M_Bone": "#efe6d2", "M_Marrow": "#cdbf9f", "M_Soul": ("#6bff9e", 0.8)})

    def b(pc):
        pc.mat = "M_Bone"
        lathe(pc, (0, 0.07, 0), [(0.034, 0.0), (0.038, 0.05), (0.028, 0.13), (0, 0.215)], n=5, axis=FWD, sy=0.8, phase=0.3)
        for x, z, a, ln in ((0.016, 0.01, 0.5, 0.04), (-0.018, 0.006, -0.6, 0.033), (0.0, -0.018, 3.0, 0.028)):   # the broken end's splinters
            lathe(pc, (x, 0.072, z), [(0.014, 0), (0, ln)], n=4, axis=(math.sin(a) * 0.35, 1, math.cos(a) * 0.35), phase=a)
        pc.mat = "M_Marrow"
        lathe(pc, (0, 0.0695, 0), [(0, 0.0), (0.022, 0.0), (0, 0.004)], n=5, axis=(0, 1, 0), sy=0.8)
        pc.mat = "M_Soul"
        for x, y, z, r in ((0.02, 0.14, 0.012, 0.018), (-0.018, 0.19, -0.006, 0.013), (0.004, 0.24, 0.014, 0.009)):
            lathe(pc, (x, y, z), [(0, -r * 1.2), (r, -r * 0.2), (r * 0.6, r * 0.9), (0, r * 2.4)], n=5, axis=(0, 1, 0.15))

    ob = pe.part("bone", M, b, sharp=40)
    pe.regrade([ob], (0.85, 1.0))
    return [ob]


def joker_mirror():
    """The Joker's mirror (the Illusionist's ult): a tall gilded frame with purple harlequin diamonds and filigree
    scrolls, a jester's cap with bells over a grinning mask at the crest, on two scroll feet. 1.0 wide x 1.5 tall,
    standing on the origin, the glass toward -Y. The glass is its own node `glass` (one quad, M_Glass, UVs 0..1 across
    the pane as seen from the front) so the engine can swap or capture into it."""
    M = mats({"M_Brass": {"c": GOLD, "rough": 0.42}, "M_Purple": "#6f45c9", "M_Dark": "#2e2340", "M_Mask": "#f6eedb",
              "M_Glow": ("#ffd98a", 0.7), "M_Glass": {"c": "#cfd4ee", "rough": 0.15}})
    GX, GZ0, GZ1 = 0.35, 0.18, 1.14                         # the pane: half width, bottom, top
    OX, OZ = 0.43, (0.1, 1.22)                              # the frame's outer edge
    ZC, HZ = (OZ[0] + OZ[1]) / 2, (OZ[1] - OZ[0]) / 2

    def frame_ring(pc, prof, core):
        """A mitred rectangular frame swept from a closed section [(inset from the outer edge, y)]."""
        corners = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
        rings = [[pc.v((sx * (OX - d), y, ZC + sz * (HZ - d))) for sx, sz in corners] for d, y in prof]
        cr = [Vector((sx * (OX - core[0]), core[1], ZC + sz * (HZ - core[0]))) for sx, sz in corners]
        for j in range(len(prof)):
            j2 = (j + 1) % len(prof)
            for k in range(4):
                k2 = (k + 1) % 4
                pc.f([rings[j][k], rings[j][k2], rings[j2][k2], rings[j2][k]], (cr[k] + cr[k2]) / 2)

    def frame(pc):
        pc.mat = "M_Brass"
        frame_ring(pc, [(0.0, 0.03), (0.0, -0.022), (0.016, -0.042), (0.05, -0.046), (0.072, -0.032), (0.08, -0.012), (0.08, 0.03)], (0.04, 0.0))
        pc.mat = "M_Dark"                                   # the backing board behind the glass
        rbox(pc, (0, 0.012, (GZ0 + GZ1) / 2), (2 * GX + 0.02, 0.012, GZ1 - GZ0 + 0.02), ch=0)
        pc.mat = "M_Purple"                                 # harlequin diamonds round the frame's face
        n = Vector((0, -1, 0))
        dia = lambda c, s=1.0: decal(pc, c, n, (1, 0, 0), [(0, 0.03 * s), (-0.016 * s, 0), (0, -0.03 * s), (0.016 * s, 0)], lift=0.0012)
        for sx in (1, -1):
            for z in (0.3, 0.5, 0.7, 0.9):
                dia(Vector((sx * (OX - 0.033), -0.046, z)))
        for x in (-0.18, 0.0, 0.18):
            dia(Vector((x, -0.046, OZ[0] + 0.033)), 0.9)
        for sx in (1, -1):                                  # filigree: scrolls curling off the sides
            for zc_, flip in ((0.36, 1), (0.92, -1)):
                pts = []
                for i in range(9):
                    t = i / 8
                    a = math.pi + flip * math.radians(470) * t
                    r = 0.052 * (1 - 0.62 * t)
                    pts.append((sx * (OX + 0.006 + r * math.cos(a)), -0.012, zc_ + r * math.sin(a) - flip * 0.03 * (1 - t) ** 2))
                pc.tube(pts, [0.015 - 0.007 * i / 8 for i in range(9)], sides=4, tip=True)
        pc.mat = "M_Brass"
        for sx in (1, -1):                                  # scroll feet
            pc.tube([(sx * 0.33, 0.0, 0.11), (sx * 0.41, -0.02, 0.036), (sx * 0.47, -0.045, 0.022), (sx * 0.478, -0.075, 0.052), (sx * 0.448, -0.07, 0.067)],
                    [0.03, 0.026, 0.022, 0.016, 0.01], sides=5, tip=True)
            pc.blob((sx * (OX - 0.01), -0.02, OZ[1] - 0.01), 0.032, segs=6, rings=4)     # finials on the top corners
        pc.tube([(-0.36, -0.04, 0.1), (0.0, -0.05, 0.085), (0.36, -0.04, 0.1)], [0.022, 0.026, 0.022], sides=5, tip=False)   # the apron
        # the crest: a grinning mask under a jester's cap with three belled points
        pc.mat = "M_Mask"
        mc, MR = Vector((0, -0.045, OZ[1] + 0.035)), (0.095, 0.05, 0.086)
        pc.blob(mc, MR, segs=8, rings=5)
        pc.mat = "M_Dark"
        for s in (1, -1):
            p, nn = on_blob(mc, MR, s * 0.032, mc.z + 0.016)
            decal(pc, p, nn, (1, 0, 0), [(0, 0.014), (-0.0105, 0), (0, -0.007), (0.0105, 0)], lift=0.002)
        smile = []
        for i in range(5):
            x = -0.04 + 0.02 * i
            p, nn = on_blob(mc, MR, x, mc.z - 0.028 + 0.012 * (x / 0.04) ** 2)
            smile.append(p - nn * 0.002)
        pc.tube(smile, [0.0065, 0.0075, 0.0085, 0.0075, 0.0065], sides=4, tip=False)
        pc.mat = "M_Purple"
        for s in (1, -1):                                   # harlequin tears under the eyes
            p, nn = on_blob(mc, MR, s * 0.05, mc.z - 0.012)
            decal(pc, p, nn, (1, 0, 0), [(0, 0.011), (-0.0065, 0), (0, -0.016), (0.0065, 0)], lift=0.002)
        cap = mc + Vector((0, 0.006, 0.058))
        pc.mat = "M_Purple"
        pc.tube([cap + Vector((-0.1, 0, -0.012)), cap + Vector((0, -0.006, 0.008)), cap + Vector((0.1, 0, -0.012))], [0.03, 0.036, 0.03], sides=6, tip=False)
        points = [((-0.08, 0, 0.0), (-0.17, 0, 0.06), (-0.27, 0, 0.065), (-0.33, 0, 0.0)), ((0, 0, 0.015), (0.012, 0, 0.09), (0.05, 0, 0.14), (0.1, 0, 0.15)),
                  ((0.08, 0, 0.0), (0.17, 0, 0.06), (0.27, 0, 0.065), (0.33, 0, 0.0))]
        tips = []
        for i, pts in enumerate(points):
            pc.mat = "M_Brass" if i == 1 else "M_Purple"
            path = [cap + Vector(p) for p in pts]
            pc.tube(path, [0.042, 0.032, 0.02, 0.009], sides=6, tip=False)
            tips.append(path[-1] + (path[-1] - path[-2]).normalized() * 0.02)
        pc.mat = "M_Brass"
        for t in tips:                                      # bells
            pc.blob(t, 0.026, segs=6, rings=4)
        pc.mat = "M_Glow"                                   # a gem on the cap's brow
        lathe(pc, cap + Vector((0, -0.036, 0.0)), [(0, -0.004), (0.016, 0.0), (0, 0.008)], n=4, axis=(0, -1, 0), sy=1.4)

    def glass(pc):
        pc.mat = "M_Glass"
        q = [(GX, GZ0), (GX, GZ1), (-GX, GZ1), (-GX, GZ0)]
        vs = [pc.v((x, -0.006, z)) for x, z in q]
        pc.f(vs, Vector((0, 0.05, (GZ0 + GZ1) / 2)), uv=[(1, 0), (1, 1), (0, 1), (0, 0)])

    fr = pe.part("frame", M, frame, sharp=45, first="M_Brass")
    gl = pe.part("glass", M, glass, first="M_Glass")
    parent(gl, fr)
    pe.regrade([fr, gl], (0.78, 1.0))
    return [fr, gl]


# ================================================================ build
TYPES = {"prism-staff": prism_staff, "trick-deck": trick_deck, "bone-tome": bone_tome, "tooth-charm": tooth_charm}
MODELS = [(f"weapons/{t}-{k}", (lambda f, k: lambda: f(k))(f, k)) for t, f in TYPES.items() for k in range(1, 6)]
MODELS += [("enemies/skeleton-warrior", skeleton_warrior), ("props/projectile-card", projectile_card),
           ("props/projectile-bone", projectile_bone), ("props/joker-mirror", joker_mirror)]


def build(only):
    pe.reset()
    for rel, fn in MODELS:
        if only and rel.split("/")[1] not in only:
            continue
        objs = fn()
        n = pe.tris(objs)
        path = pe.export(objs, f"{rel}.glb")
        used = {o.name: sorted({m.name for m in o.data.materials}) for o in objs}
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
        lo = [round(min(p[i] for p in pts), 3) for i in range(3)]
        hi = [round(max(p[i] for p in pts), 3) for i in range(3)]
        print(f"MODEL {rel} tris={n} bytes={os.path.getsize(path)} bounds={lo}..{hi} nodes={[o.name for o in objs]} mats={used}")
        pe.clear(objs)


# ================================================================ review renders
WARM = (0.93, 0.89, 0.8, 1)                                 # light warm background (linear)
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
C_ = Matrix.Rotation(math.pi / 2, 4, "X")                   # glTF (y-up) -> Blender (z-up), as pe.grip_matrix
V7 = os.path.join(ROOT, "art", "characters", "base")


def glb_path(rel):
    return os.path.join(pe.ASSETS, f"{rel}.glb")


def glb_stats(rel):
    """(tris, bytes) of an exported GLB, read from the file itself."""
    import struct
    b = open(glb_path(rel), "rb").read()
    j = json.loads(b[20:20 + struct.unpack_from("<I", b, 12)[0]])
    return sum(j["accessors"][p["indices"]]["count"] // 3 for m in j["meshes"] for p in m["primitives"]), len(b)


def shot(st, path, objs, elev=12, res=(300, 300), pad=1.12, ground=False, box=None):
    """pe.Stage.shot, framing an explicit world box (lo, hi) when given."""
    kit.show_vertex_colors(st.sc)
    bpy.context.view_layer.update()
    if box is None:
        pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" and not o.hide_render and o is not st.ground for c in o.bound_box]
        box = (Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)]))
    lo, hi = box
    mid, e = (lo + hi) / 2, math.radians(elev)
    w, h = hi.x - lo.x, (hi.z - lo.z) * math.cos(e) + (hi.y - lo.y) * math.sin(e)
    a = res[0] / res[1]
    st.cam.data.ortho_scale = (max(w, h * a) if a >= 1 else max(h, w / a)) * pad
    st.cam.location = mid + Vector((0, -math.cos(e), math.sin(e))) * 10
    st.cam.rotation_euler = (math.pi / 2 - e, 0, 0)
    st.cam.data.clip_end = 40
    st.ground.hide_render = not ground
    st.ground.location = (mid.x, mid.y, 0)
    st.ground.scale = (max(w, hi.y - lo.y) * 0.75 + 0.1,) * 3
    st.sc.render.resolution_x, st.sc.render.resolution_y = res
    st.sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def turntable(objs, yaw=0.0, at=(0, 0, 0)):
    t = bpy.data.objects.new("Turn", None)
    bpy.context.scene.collection.objects.link(t)
    t.location = at
    for o in objs:
        if o.parent is None:
            o.parent = t
    t.rotation_euler = (0, 0, math.radians(yaw))
    return t


def drop(objs):
    for o in objs:
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)


def compose(rows, out, fr, bg, titles=None):
    """rows: [[(label, [png, ...]), ...], ...]: each cell's frames side by side under its label, one row per list,
    each row under its title."""
    row_files = []
    for ri, row in enumerate(rows):
        args = ["magick", "montage"]
        for ci, (label, pngs) in enumerate(row):
            tile = os.path.join(fr, f"_tile_{ri}_{ci}.png")
            subprocess.run(["magick", *pngs, "-background", bg, "-gravity", "south", "+append", tile], check=True)
            args += ["-label", label, tile]
        rf = os.path.join(fr, f"_row_{ri}.png")
        args += ["-tile", f"{len(row)}x1", "-geometry", "+5+5", "-background", bg, "-fill", "#2b2433", "-pointsize", "13", "-font", FONT, rf]
        subprocess.run(args, check=True)
        if titles:
            tf = os.path.join(fr, f"_title_{ri}.png")
            subprocess.run(["magick", "-background", bg, "-fill", "#2b2433", "-font", FONT_B, "-pointsize", "15", f"label:{titles[ri]}",
                            "-bordercolor", bg, "-border", "8x5", tf], check=True)
            subprocess.run(["magick", tf, rf, "-background", bg, "-gravity", "west", "-append", rf], check=True)
        row_files.append(rf)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["magick", *row_files, "-background", bg, "-gravity", "west", "-append", "-quality", "85", out], check=True)
    print("SHEET", out)


def check_tiles(pngs):
    """Every frame must show something: the share of pixels off the background colour (its corner)."""
    code = ("import sys\nfrom PIL import Image, ImageChops\nfor p in sys.argv[1:]:\n im = Image.open(p).convert('RGB'); bg = im.getpixel((0, 0))\n"
            " d = ImageChops.difference(im, Image.new('RGB', im.size, bg)).convert('L').point(lambda v: 255 if v > 14 else 0)\n"
            " f = sum(1 for v in d.getdata() if v) / (im.size[0] * im.size[1])\n print(('EMPTY ' if f < 0.01 else 'ok ') + f'{f:.3f} ' + p)\n")
    r = subprocess.run(["python3", "-c", code, *pngs], capture_output=True, text=True)
    empty = [l for l in r.stdout.splitlines() if l.startswith("EMPTY")]
    print("TILES", len(pngs), "empty:", empty or "none")
    return empty


def bg_hex(png):
    r = subprocess.run(["magick", png, "-format", "%[hex:p{2,2}]", "info:"], capture_output=True, text=True)
    return "#" + r.stdout.strip()[:6]


# Views per weapon type: (yaw of the model, camera elevation, resolution).
VIEWS = {"prism-staff": [(28, 10, (150, 470)), (205, 22, (150, 470)), (28, 18, (170, 200))],
         "trick-deck": [(200, 18, (210, 190)), (20, 12, (210, 190))],
         "bone-tome": [(-62, 12, (170, 200)), (125, 16, (170, 200))],
         "tooth-charm": [(28, 34, (170, 200)), (105, 8, (170, 200))]}


def sheet_mode(fr):
    """K-arcane-weapons.webp: every weapon tier from two or three sides, then the skeleton next to the v7 character,
    the two projectiles and the mirror. Imports the exported GLBs."""
    os.makedirs(fr, exist_ok=True)
    pe.CLIPS_GLB = os.path.join(V7, "v7_clips.glb")
    pe.reset()
    st = pe.Stage(bg=WARM)
    root, rig, socks = pe.load_character()
    char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
    pe.use_action(rig, "Idle", 0.0)
    for o in char:
        o.hide_render = True
    rows, allp = [], []
    for t in TYPES:
        row = []
        for k in range(1, 6):
            wid = f"{t}-{k}"
            objs = pe.import_glb(glb_path(f"weapons/{wid}"))
            tt = turntable(objs)
            pngs = []
            for vi, (yaw, elev, res) in enumerate(VIEWS[t]):
                tt.rotation_euler = (0, 0, math.radians(yaw))
                box = None
                if t == "prism-staff" and vi == 2:          # a close look at the head
                    bpy.context.view_layer.update()
                    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices if v.co.z > 0.43]
                    box = (Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)]))
                pngs.append(shot(st, os.path.join(fr, f"{wid}_{vi}.png"), objs, elev=elev, res=res, pad=1.1, box=box))
            n, size = glb_stats(f"weapons/{wid}")
            row.append((f"{wid}  {n} tris  {size / 1024:.1f} KB", pngs))
            allp += pngs
            drop(objs + [tt])
        rows.append(row)
    # the skeleton beside the character (scale), then alone from three sides
    row = []
    sk = pe.import_glb(glb_path("enemies/skeleton-warrior"))
    tt = turntable(sk, 20, at=(0.32, 0, 0))
    root.location, root.rotation_euler = (-0.12, 0, 0), (0, 0, math.radians(20))
    for o in char:
        o.hide_render = False
    p0 = shot(st, os.path.join(fr, "skel_char.png"), sk + char, elev=14, res=(300, 300), pad=1.08, ground=True)
    for o in char:
        o.hide_render = True
    tt.location = (0, 0, 0)
    pngs = []
    for i, (yaw, e) in enumerate(((0, 8), (35, 16), (160, 30))):
        tt.rotation_euler = (0, 0, math.radians(yaw))
        pngs.append(shot(st, os.path.join(fr, f"skel_{i}.png"), sk, elev=e, res=(210, 300), pad=1.1, ground=True))
    n, size = glb_stats("enemies/skeleton-warrior")
    row.append(("beside the v7 character", [p0]))
    row.append((f"skeleton-warrior  {n} tris  {size / 1024:.1f} KB", pngs))
    allp += [p0, *pngs]
    drop(sk + [tt])
    for rel, views, res in (("props/projectile-card", ((0, 62), (150, 20)), (190, 160)), ("props/projectile-bone", ((90, 12), (30, 45)), (190, 160)),
                            ("props/joker-mirror", ((0, 6), (35, 14), (205, 18)), (190, 260))):
        objs = pe.import_glb(glb_path(rel))
        tt = turntable(objs)
        pngs = []
        for vi, (yaw, e) in enumerate(views):
            tt.rotation_euler = (0, 0, math.radians(yaw))
            pngs.append(shot(st, os.path.join(fr, f"{rel.split('/')[1]}_{vi}.png"), objs, elev=e, res=res, pad=1.12))
        n, size = glb_stats(rel)
        row.append((f"{rel.split('/')[1]}  {n} tris  {size / 1024:.1f} KB", pngs))
        allp += pngs
        drop(objs + [tt])
    rows.append(row)
    check_tiles(allp)
    titles = ["prism-staff (Elementalist)  T1 cord, T2 iron, T3 rune-etched, T4 gold + glow halo, T5 runes on the halo. "
              "M_Crystal is the engine-tinted prism",
              "trick-deck (Illusionist)  faces -Y, sigil backs (M_Glow) toward the holder; trim = card edges, pivot rivet, "
              "T3+ etched backs; T4 halo arc, T5 runes on it",
              "bone-tome (Necromancer)  ribcage cover, vertebra spine, jawbone clasp, soul gem (M_Glow); T4 inlaid glow ring, T5 runes on it",
              "tooth-charm (Transmuter)  a cord band round the fist, gems M_Form1..5 (fox, crab, wisp, pollen, golem), the fang; "
              "T4 glow ring, T5 runes on it",
              "skeleton-warrior (the raised dead), projectile-card, projectile-bone, joker-mirror (glass = node `glass`, M_Glass)"]
    compose(rows, os.path.join(EVIDENCE, "K-arcane-weapons.webp"), fr, bg_hex(allp[0]), titles)


# ---------------------------------------------------------------- held: grips in the v7 hand sockets
def frame(z, front):
    """A rotation whose +Z is z and whose -Y is as close to `front` as it can be (render_held.py)."""
    z, front = Vector(z).normalized(), Vector(front)
    y = -(front - z * front.dot(z)).normalized()
    return Matrix((y.cross(z), y, z)).transposed().to_4x4()


def three_euler(m):
    """three.js Euler XYZ (m = Rx Ry Rz) of a 3x3 rotation (render_held.py)."""
    m13, m23, m33, m12, m11, m32, m22 = m[0][2], m[1][2], m[2][2], m[0][1], m[0][0], m[2][1], m[1][1]
    ey = math.asin(max(-1.0, min(1.0, m13)))
    if abs(m13) < 0.9999999:
        return [math.atan2(-m23, m33), ey, math.atan2(-m12, m11)]
    return [math.atan2(m32, m22), ey, 0.0]


def grip_m(e):
    """The engine's placement in socket space (three.js Euler XYZ, glTF axes) as a Blender matrix."""
    return C_ @ (Matrix.Rotation(e[0], 4, "X") @ Matrix.Rotation(e[1], 4, "Y") @ Matrix.Rotation(e[2], 4, "Z")) @ C_.inverted()


def solve(sock, z, front):
    sw = sock.matrix_world.normalized()
    local_b = sw.inverted() @ Matrix.Translation(sw.translation) @ frame(z, front)
    return [round(a, 3) for a in three_euler((C_.inverted() @ local_b @ C_).to_3x3())]


# Per type: the hand, the hold clip (rest), the attack verb at its impact, and how each grip is found:
# ("solve", z, front) = the item's +Z and -Y in the world at that pose; ("fixed", euler) = a grip in socket space.
# hit=None: the attack grip is the rest grip (no `rest` entry needed). Back grips are in Socket_Back's space (world-aligned in
# Idle); the fixed ones equal solving there: the deck's fan hanging backs-out, the tome hanging front-cover-out, the charm
# hanging like a pendant, gems up.
HOLDS = {
    # upright at the side, the prism beside the head (not in front of the face); attacks point it at the target (the staff default)
    "prism-staff": dict(grip="Staff", hand="R", idle="HoldIdle_Staff", attack=("CastForward_Staff", 0.36),
                        rest=("solve", (-0.32, -0.08, 1), (0, -1, 0)), hit=("fixed", [math.pi / 2, 0, 0]), back=("fixed", [0, 0, -0.5]),
                        close=((30, 14),)),
    # the fan above the hand, leaned out past the body so the follow camera sees the backs; it rides the hand through the throw
    "trick-deck": dict(grip="OneHand", hand="R", idle="HoldIdle_OneHand", attack=("Throw_OneHand", 0.4),
                       rest=("solve", (-0.8, 0.22, 1), (0.25, -1, 0)), hit=None, back=("fixed", [0, 0, math.pi]), close=((30, 14),)),
    # upright at the chest by its bottom edge, the front cover (ribcage, gem) out; on the back hanging cover-out
    "bone-tome": dict(grip="Book", hand="L", idle="HoldIdle_Book", attack=("Summon_Book", 0.46),
                      rest=("solve", (0, 0, 1), (-1, 0, 0)), hit=None, back=("fixed", [math.pi, -math.pi / 2, 0]), close=((-20, 14),)),
    # worn: the authored frame is the fist's (fingers -Y, back of the hand +Z, thumb +X); on the back it hangs like a pendant
    "tooth-charm": dict(grip="Fists", hand="R", idle="HoldIdle_Fists", attack=("Thrust_Fists", 0.34),
                        rest=("fixed", [0, -math.pi / 2, 0]), hit=None, back=("fixed", [0, math.pi, 0]), close=((95, 12), (25, 55))),
}


def load_verbs():
    """The verb library's actions (v7_verbs.glb: the rig and its clips, no mesh) onto the loaded character."""
    objs, acts = set(bpy.data.objects), {a.name for a in bpy.data.actions}
    bpy.ops.import_scene.gltf(filepath=os.path.join(V7, "v7_verbs.glb"))
    for a in bpy.data.actions:
        if a.name not in acts:
            a.use_fake_user = True
    drop([o for o in bpy.data.objects if o not in objs])


def held_mode(fr):
    os.makedirs(fr, exist_ok=True)
    pe.CLIPS_GLB = os.path.join(V7, "v7_clips.glb")
    pe.reset()
    st = pe.Stage(bg=WARM)
    root, rig, socks = pe.load_character()
    char = [o for o in bpy.data.objects if o.type == "MESH" and o is not st.ground]
    load_verbs()
    grips, rows, allp = {}, [], []

    def pose(clip, t=0.0):
        pe.use_action(rig, clip, t)
        root.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()

    def find(sock, how):
        if how[0] == "fixed":
            return [round(a, 3) for a in how[1]]
        return solve(sock, how[1], how[2])

    def hold(rel, sock, e):
        item = pe.import_glb(glb_path(rel))
        holder = bpy.data.objects.new("Held", None)
        bpy.context.scene.collection.objects.link(holder)
        holder.parent = sock
        holder.matrix_parent_inverse.identity()
        holder.matrix_basis = grip_m(e)
        for o in item:
            if o.parent is None:
                o.parent = holder
        return item + [holder]

    titles = []
    for t, h in HOLDS.items():
        row, sock = [], socks[h["hand"]]
        pose(h["idle"])
        rest = find(sock, h["rest"])
        clip, at = h["attack"]
        pose(clip, at)
        hit = find(sock, h["hit"]) if h["hit"] else rest
        pose("Idle")
        back = find(socks["Back"], h["back"])
        g = {"hand": hit, "back": back}
        if hit != rest:
            g["rest"] = rest
        grips[t] = g
        fmt = lambda e: "(" + ", ".join(f"{a:g}" for a in e) + ")"
        titles.append(f"{t}  {h['grip']} grip, {'right' if h['hand'] == 'R' else 'left'} hand   hand {fmt(hit)}"
                      + (f"   rest {fmt(rest)}" if hit != rest else "") + f"   back {fmt(back)}")
        # rest (the grip's hold idle): T5 from the front three-quarter and from the follow camera, T1, a close look
        pose(h["idle"])
        for tier in (5, 1):
            objs = hold(f"weapons/{t}-{tier}", sock, rest)
            views = ((30, 12, "front"), (200, 34, "follow cam")) if tier == 5 else ((30, 12, "front"),)
            for yaw, e, tag in views:
                root.rotation_euler = (0, 0, math.radians(yaw))
                p = shot(st, os.path.join(fr, f"held_{t}_{tier}_{yaw}.png"), char + objs, elev=e, res=(250, 310), pad=1.1, ground=True)
                row.append((f"{t}-{tier}  {h['idle']}, {tag}", [p]))
                allp.append(p)
            if tier == 5:                                   # a close look at the hand
                for ci, (yaw, e) in enumerate(h["close"]):
                    root.rotation_euler = (0, 0, math.radians(yaw))
                    bpy.context.view_layer.update()
                    items = [o for o in objs if o.type == "MESH"]
                    pts = [o.matrix_world @ Vector(c) for o in items for c in o.bound_box] + [sock.matrix_world.translation]
                    lo, hi = Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])
                    m = 0.05 if t != "prism-staff" else 0.03
                    if t == "prism-staff":
                        lo = Vector((lo.x, lo.y, sock.matrix_world.translation.z - 0.12))
                        hi = Vector((hi.x, hi.y, sock.matrix_world.translation.z + 0.12))
                    p = shot(st, os.path.join(fr, f"held_{t}_close{ci}.png"), char + objs, elev=e, res=(250, 310), pad=1.0,
                             box=(lo - Vector((m, m, m)), hi + Vector((m, m, m))))
                    row.append((f"{t}-5  close" + (", from above" if e > 40 else ""), [p]))
                    allp.append(p)
            drop(objs)
        # attack: the verb at its impact with the attack grip
        pose(clip, at)
        objs = hold(f"weapons/{t}-5", sock, hit)
        root.rotation_euler = (0, 0, math.radians(35))
        p = shot(st, os.path.join(fr, f"held_{t}_attack.png"), char + objs, elev=12, res=(250, 310), pad=1.1, ground=True)
        row.append((f"{t}-5  {clip} impact", [p]))
        allp.append(p)
        drop(objs)
        # carried on the back outside the ruins (Idle)
        pose("Idle")
        objs = hold(f"weapons/{t}-5", socks["Back"], back)
        root.rotation_euler = (0, 0, math.radians(150))
        p = shot(st, os.path.join(fr, f"held_{t}_back.png"), char + objs, elev=18, res=(250, 310), pad=1.1, ground=True)
        row.append((f"{t}-5  on the back", [p]))
        allp.append(p)
        drop(objs)
        rows.append(row)
    print("GRIPS", json.dumps(grips))
    json.dump(grips, open(os.path.join(fr, "grips.json"), "w"), indent=1)
    check_tiles(allp)
    compose(rows, os.path.join(EVIDENCE, "K-arcane-weapons-held.webp"), fr, bg_hex(allp[0]), titles)


if __name__ == "__main__":
    if MODE == "build":
        build(set(ARGS))
    elif MODE == "sheet":
        sheet_mode(ARGS[1])
    elif MODE == "held":
        held_mode(ARGS[1])
