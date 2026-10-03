"""The Vanguard signature weapons (classes v2, design sheet §1.5): four base meshes, each at tiers 1–5 through one trim kit.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_vanguard_weapons.py [-- id ...]

  aegis-*      the Guardian's sword (right hand) and heater shield (the OffHand node: worn on the left arm)
  warhammer-*  the Juggernaut's huge two-handed war hammer
  handwraps-*  the Martial Artist's Muay Thai wraps (right; the left is the OffHand node)
  tanto-*      the Assassin's twin tanto (right; the second, OffHand), and kunai.glb (the thrown blade)

The trim kit (§1.5 "Look"): T1 wood and cloth, T2 iron, T3 rune-etched (dark etched lines), T4 gold trim with a glow part
(emissive, the subclass's colour), T5 the glow part brighter with glowing runes. Metal parts are M_Blade / M_Iron / M_Brass
(the engine's metal look class: sun specular), glow parts M_Glow / M_Rune (emissive); nothing on the character glows.
Authoring as build_weapons.py: the grip at the origin = the hand socket, the long axis +Z, the front -Y; an OffHand node
is authored grip-at-origin for the other hand and parked where it rides on the back (Character.tsx holdOffHand).
Rig units (the v6 character is 1.045 tall); the engine scales by modelScale 1.3 = CHARACTER_SCALE.
"""
import json, math, os, sys
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pe  # noqa: E402
from pe import lathe, rbox  # noqa: E402

pe.reset()
ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None

# ── the trim kit ──
GLOW = {"aegis": "#ffd76a", "warhammer": "#ff9a3a", "handwraps": "#ff8a3d", "tanto": "#ff3a4a"}
TRIM = {
    1: dict(metal="#8d939b", blade="#b8bcc2", trim="#6e5a44", wood="#9a6b3f", cloth="#d8cdb2", wrap="#8a6a4a"),
    2: dict(metal="#a4acb6", blade="#c9cfd6", trim="#7c838c", wood="#6f4a2c", cloth="#5e4130", wrap="#4a3424"),
    3: dict(metal="#9aa3af", blade="#c4cbd4", trim="#56606d", wood="#4a3426", cloth="#3c3a4a", wrap="#2e2c38", rune="#26303c"),
    4: dict(metal="#a9b0b9", blade="#d3d8de", trim="#d9a93a", wood="#4a2e1e", cloth="#6a1e1e", wrap="#3a1414", rune="#26303c"),
    5: dict(metal="#b3b9c2", blade="#dde2e8", trim="#e8b84a", wood="#3a2418", cloth="#7a1a1a", wrap="#2a0e0e", rune="glow"),
}


def mats(tier, kind, extra=None):
    t = TRIM[tier]
    spec = {"M_Blade": t["blade"], "M_Iron": t["metal"] if tier > 1 else t["trim"], "M_Brass": t["trim"] if tier >= 4 else t["metal"],
            "M_Wood": t["wood"], "M_Cloth": t["cloth"], "M_Wrap": t["wrap"]}
    if tier >= 4:
        spec["M_Glow"] = (GLOW[kind], 1.4 if tier == 5 else 0.8)
    if tier >= 3:
        spec["M_Rune"] = (GLOW[kind], 1.2) if t["rune"] == "glow" else t["rune"]
    spec.update(extra or {})
    return pe.materials(spec)


def section(z, w, t, dx=0.0, dy=0.0):
    """Blade cross-section: a lens with edges at +-Y (half-width w) and flats at +-X (half-thickness t)."""
    return [Vector((dx + t * math.cos(a), dy + w * math.sin(a), z)) for a in (math.radians(30 + 60 * k) for k in range(6))]


def runes(pc, pts, w=0.004, mat="M_Rune"):
    """Etched rune strokes: thin flat tubes laid along polylines just proud of a surface."""
    pc.mat = mat
    for path in pts:
        pc.tube(path, [(w, w * 0.6)] * len(path), sides=4, tip=False, cap=True)


def finish(name, m, build, sharp=50):
    ob = pe.part(name, m, build, sharp=sharp)
    return ob


# ================================================================ the Guardian: sword and heater shield
def aegis(tier):
    m = mats(tier, "aegis")

    def sword(pc):
        pc.mat = "M_Blade"
        zs, ws = [0.085, 0.2, 0.32, 0.4], [0.038, 0.04, 0.035, 0.022]
        pc.band([section(z, w, 0.012) for z, w in zip(zs, ws)], caps=(None, Vector((0, 0, 0.455))))
        pc.mat = "M_Brass" if tier >= 4 else "M_Iron"
        pc.tube([(0, -0.08, 0.078), (0, 0, 0.074), (0, 0.08, 0.078)], [0.013, 0.016, 0.013], sides=6, tip=False)
        pc.blob((0, 0, -0.078), (0.022, 0.022, 0.02), segs=6, rings=4)
        pc.mat = "M_Wrap" if tier < 2 else "M_Cloth"
        lathe(pc, (0, 0, 0), [(0.015, -0.064), (0.018, -0.03), (0.018, 0.03), (0.016, 0.066)], n=6)
        if tier >= 3:
            runes(pc, [[(0.0125, -0.004, 0.12), (0.0125, 0.006, 0.17), (0.0125, -0.004, 0.22)], [(0.0125, 0.004, 0.26), (0.0125, -0.006, 0.31)]])
        if tier >= 4:
            pc.mat = "M_Glow"
            pc.blob((0, 0, 0.078), (0.012, 0.018, 0.012), segs=6, rings=4)            # a gem set in the guard

    def shield(pc):
        # A heater shield: the face toward -Y, a little domed, the straight top up (+Z); the handle at the origin.
        top, w, bottom, t = 0.15, 0.115, -0.17, 0.016
        outline = [(-w, top), (-w * 0.55, top + 0.012), (0, top + 0.016), (w * 0.55, top + 0.012), (w, top), (w * 1.02, 0.04), (w * 0.88, -0.06),
                   (w * 0.55, -0.13), (0, bottom), (-w * 0.55, -0.13), (-w * 0.88, -0.06), (-w * 1.02, 0.04)]
        front = [Vector((x, -t, z)) for x, z in outline]
        back = [Vector((x, t, z)) for x, z in outline]
        pc.mat = "M_Wood" if tier == 1 else "M_Iron"
        pc.band([back, front], caps=(Vector((0, t + 0.004, 0.0)), Vector((0, -t - 0.03, 0.0))))
        pc.mat = "M_Brass" if tier >= 4 else ("M_Wrap" if tier == 1 else "M_Iron")      # the rim: rope, iron or gold
        pc.tube([(x * 1.0, -t - 0.004, z) for x, z in outline], [0.011] * len(outline), sides=5, closed_loop=True)
        pc.mat = "M_Brass" if tier >= 4 else "M_Iron"
        pc.blob((0, -t - 0.032, 0.0), (0.03, 0.016, 0.03), segs=8, rings=4)                 # the boss
        if tier >= 3:
            runes(pc, [[(-0.07, -t - 0.022, 0.1), (0.0, -t - 0.028, 0.06), (0.07, -t - 0.022, 0.1)],
                       [(-0.06, -t - 0.022, -0.05), (0.0, -t - 0.026, -0.11), (0.06, -t - 0.022, -0.05)]], w=0.005)
        if tier >= 4:
            pc.mat = "M_Glow"
            pc.blob((0, -t - 0.05, 0.0), (0.014, 0.01, 0.014), segs=6, rings=4)             # the glow part: a sun-stone in the boss
        pc.mat = "M_Cloth"
        pc.tube([(-0.035, t + 0.002, 0), (-0.035, t + 0.03, 0.0), (0.035, t + 0.03, 0.0), (0.035, t + 0.002, 0)], [0.008] * 4, sides=4, tip=False)  # the grip strap

    main = finish(f"aegis-{KEY['aegis'][tier]}", m, sword)
    off = finish("OffHand", m, shield)
    off.location = (0.0, 0.05, 0.14)                                    # on the back: the shield over the sword
    return [main, off]


# ================================================================ the Juggernaut: a huge war hammer
def warhammer(tier):
    m = mats(tier, "warhammer")

    def build(pc):
        pc.mat = "M_Wood"
        pc.tube([(0, 0, -0.26), (0.004, 0, 0.1), (-0.003, 0, 0.42), (0, 0, 0.64)], [0.021, 0.022, 0.023, 0.025], sides=6, tip=False)
        pc.mat = "M_Wrap"
        lathe(pc, (0, 0, 0), [(0.022, -0.07), (0.024, -0.03), (0.024, 0.04), (0.022, 0.09)], n=6)       # the grip wrap where the hands go
        pc.mat = "M_Iron" if tier > 1 else "M_Brass"
        pc.blob((0, 0, -0.25), (0.028, 0.028, 0.024), segs=6, rings=4)                                  # the butt cap
        # The head: a heavy block across the haft, a striking face front (-Y) and back, chamfered.
        pc.mat = "M_Iron" if tier > 1 else "M_Wood"
        rbox(pc, (0, 0, 0.72), (0.17, 0.36, 0.18), ch=0.35)
        pc.mat = "M_Brass" if tier >= 2 else "M_Iron"
        for y in (-0.185, 0.185):                                                                        # the faces
            rbox(pc, (0, y, 0.72), (0.19, 0.035, 0.2), ch=0.3)
        lathe(pc, (0, 0, 0.62), [(0.034, -0.02), (0.04, 0.0), (0.034, 0.02)], n=6)                       # the collar
        if tier >= 3:
            runes(pc, [[(0.086, -0.12, 0.69), (0.086, -0.07, 0.76), (0.086, -0.02, 0.69), (0.086, 0.03, 0.76), (0.086, 0.08, 0.69)],
                       [(-0.086, -0.08, 0.69), (-0.086, -0.03, 0.76), (-0.086, 0.02, 0.69), (-0.086, 0.07, 0.76)]], w=0.006)
        if tier >= 4:
            pc.mat = "M_Glow"
            for x in (0.088, -0.088):                                                                    # a molten core in each side
                pc.blob((x, 0, 0.72), (0.01, 0.045, 0.045), segs=6, rings=4)
            pc.mat = "M_Brass"
            pc.tube([(0, 0, 0.81), (0, 0, 0.88)], [0.02, 0.008], sides=6, tip=True)                     # a crown spike

    return [finish(f"warhammer-{KEY['warhammer'][tier]}", m, build)]


# ================================================================ the Martial Artist: Muay Thai wraps
GRIPS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vanguard_grips.json")))


def wrap(pc, tier, side):
    """A Muay Thai wrap round the hand (solve_vanguard_grips.py: the hand bone's middle and direction in the weapon's space):
    bands from the wrist over the knuckles, the loose tail at the wrist, studs over the knuckles from T2."""
    w = GRIPS["handwraps"][f"wrap{side}"]
    c, ax, L = Vector(w["centre"]), Vector(w["axis"]).normalized(), w["length"]
    r = 0.036
    pc.mat = "M_Cloth"
    lathe(pc, c - ax * (L * 0.62), [(r * 0.9, 0.0), (r * 1.02, L * 0.25), (r * 1.06, L * 0.6), (r * 1.08, L * 0.95), (r * 0.98, L * 1.18), (0, L * 1.24)], n=8, axis=ax,
          mat=lambda band, quad: "M_Wrap" if band % 2 else None)
    side_v = ax.orthogonal().normalized()
    knuckle = c + ax * (L * 0.5)
    pc.mat = "M_Cloth"
    tail0 = c - ax * (L * 0.62)
    pc.tube([tail0 + side_v * r, tail0 + side_v * r * 1.5 - ax * 0.02, tail0 + side_v * r * 1.3 - ax * 0.05], [(0.011, 0.003)] * 3, sides=4, tip=False)
    up = ax.cross(side_v).normalized()
    if tier >= 2:
        pc.mat = "M_Brass" if tier >= 4 else "M_Iron"
        for k in (-1.5, -0.5, 0.5, 1.5):                                                               # studs across the knuckles
            pc.blob(knuckle + side_v * (k * 0.016) + up * (r * 1.02), (0.007, 0.007, 0.007), segs=6, rings=3)
    if tier >= 3:
        runes(pc, [[c + ax * (L * d) + up * (r * 1.09) - side_v * 0.02 for d in (-0.3, 0.0)], [c + ax * (L * d) - up * (r * 1.09) + side_v * 0.02 for d in (-0.3, 0.0)]], w=0.0035)
    if tier >= 4:
        pc.mat = "M_Glow"
        ring = [c - ax * (L * 0.45) + (side_v * math.cos(a) + up * math.sin(a)) * (r * 1.1) for a in [i * math.tau / 10 for i in range(10)]]
        pc.tube(ring, [0.004] * 10, sides=4, closed_loop=True)


def handwraps(tier):
    m = mats(tier, "handwraps")
    main = finish(f"handwraps-{KEY['handwraps'][tier]}", m, lambda pc: wrap(pc, tier, "R"))
    off = finish("OffHand", m, lambda pc: wrap(pc, tier, "L"))
    off.location = (0.12, 0.0, 0.0)                                       # rolled beside it on the back
    return [main, off]


# ================================================================ the Assassin: twin tanto (and the kunai)
def tanto_blade(pc, tier, flip=1):
    pc.mat = "M_Blade"
    zs, ws, off = [0.06, 0.13, 0.2, 0.25], [0.016, 0.016, 0.014, 0.009], [0.0, 0.0, -0.002, -0.006]
    pc.band([section(z, w, 0.007, dy=o * flip) for z, w, o in zip(zs, ws, off)], caps=(None, Vector((0, -0.012 * flip, 0.285))))
    if tier == 5:                                                                                  # the crimson hamon glows
        pc.mat = "M_Glow"
        pc.tube([(0, -0.0165 * flip, 0.07), (0, -0.0165 * flip, 0.16), (0, -0.013 * flip, 0.24)], [0.0025] * 3, sides=4, tip=True)
    pc.mat = "M_Brass" if tier >= 4 else "M_Iron"
    lathe(pc, (0, 0, 0.05), [(0.011, -0.006), (0.012, 0.0), (0.011, 0.008)], n=6)                   # the habaki
    lathe(pc, (0, 0, 0.043), [(0.03, -0.004), (0.032, 0.0), (0.03, 0.004)], n=8, sy=0.7)            # the tsuba, oval
    pc.mat = "M_Wood"
    lathe(pc, (0, 0, 0), [(0.013, -0.075), (0.015, -0.04), (0.015, 0.02), (0.014, 0.04)], n=6)
    pc.mat = "M_Wrap"                                                                              # the cord wrap's diamonds
    for k, z in enumerate((-0.06, -0.035, -0.01, 0.015)):
        pc.tube([(0.0155 * math.cos(a), 0.0155 * math.sin(a), z + 0.012 * math.sin(a * 2 + k)) for a in [i * math.tau / 8 for i in range(8)]],
                [0.0035] * 8, sides=4, closed_loop=True)
    pc.mat = "M_Brass" if tier >= 4 else "M_Iron"
    pc.blob((0, 0, -0.08), (0.016, 0.016, 0.01), segs=6, rings=3)                                   # the kashira
    if tier >= 3:
        runes(pc, [[(0.0072, -0.002 * flip, 0.09), (0.0072, 0.004 * flip, 0.13), (0.0072, -0.002 * flip, 0.17)]], w=0.0025)
    if tier >= 4:
        pc.mat = "M_Glow"
        pc.blob((0, 0, -0.092), (0.007, 0.007, 0.007), segs=6, rings=3)                             # a red bead on the pommel cord


def tanto(tier):
    m = mats(tier, "tanto")
    main = finish(f"tanto-{KEY['tanto'][tier]}", m, lambda pc: tanto_blade(pc, tier, 1))
    off = finish("OffHand", m, lambda pc: tanto_blade(pc, tier, -1))
    off.location = (0.07, 0.0, 0.0)                                       # crossed on the back beside the first
    off.rotation_euler = (0, math.radians(-30), 0)
    return [main, off]


def kunai():
    m = mats(2, "tanto", {"M_Wrap": "#7a1a1a"})

    def build(pc):
        pc.mat = "M_Blade"
        pc.band([[Vector((0.0, 0.0, 0.03)) + Vector((0.006 * math.cos(a), 0.022 * math.sin(a), 0)) for a in [i * math.tau / 4 for i in range(4)]],
                 [Vector((0.0, 0.0, 0.08)) + Vector((0.005 * math.cos(a), 0.016 * math.sin(a), 0)) for a in [i * math.tau / 4 for i in range(4)]]],
                caps=(None, Vector((0, 0, 0.13))))
        pc.mat = "M_Wrap"
        lathe(pc, (0, 0, 0), [(0.007, -0.05), (0.008, 0.0), (0.007, 0.03)], n=6)
        pc.mat = "M_Iron"
        pc.tube([(0.016 * math.cos(a), 0, -0.068 + 0.016 * math.sin(a)) for a in [i * math.tau / 8 for i in range(8)]], [0.0035] * 8, sides=4, closed_loop=True)
    return [finish("kunai", m, build)]


KEY = {"aegis": {1: "oak", 2: "iron", 3: "rune", 4: "gilt", 5: "dawn"}, "warhammer": {1: "timber", 2: "iron", 3: "rune", 4: "gilt", 5: "quake"},
       "handwraps": {1: "cotton", 2: "iron", 3: "rune", 4: "gilt", 5: "sun"}, "tanto": {1: "plain", 2: "iron", 3: "rune", 4: "gilt", 5: "lotus"}}
BUILD = {"aegis": aegis, "warhammer": warhammer, "handwraps": handwraps, "tanto": tanto}
MODELS = [(f"{t}-{KEY[t][n]}", (lambda t, n: lambda: BUILD[t](n))(t, n), 1400) for t in BUILD for n in range(1, 6)] + [("kunai", kunai, 300)]


def build_all(only=None):
    """As pe.build_all, without touching another builder's catalogue: export each, report its triangles."""
    for mid, fn, budget in MODELS:
        if only and mid not in only:
            continue
        objs = fn()
        pe.regrade(objs, (0.8, 1.0))
        n = pe.tris(objs)
        pe.export(objs, f"weapons/{mid}.glb")
        print(f"MODEL weapons/{mid} tris={n} parts={[o.name for o in objs]}" + ("  OVER BUDGET" if n > budget else ""))
        pe.clear(objs)


if __name__ == "__main__":
    build_all(ONLY)
