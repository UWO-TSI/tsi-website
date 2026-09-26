"""Parametric hair library: 16 bangs + 12 back styles, generated against the shared head surface.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hair/build_hair.py [-- render <frames_dir>]

Head: art/characters/base/head_shape.py (driven by ref18_measurements.json), so a head tweak regenerates the
whole library. Rig: CharacterRig appended from art/characters/base/v6.blend.

Output:
  art/characters/hair/bangs/<id>.glb, art/characters/hair/back/<id>.glb
      each = the 22-bone Mixamo rig + one mesh skinned 100% to mixamorig:Head, material M_Hair
      (palette-tinted at runtime). Bind to the character by bone name (SkinnedMesh.bind(character.skeleton)).
  art/characters/hair/hair_catalog.json   id, slot, name, sheet cell, tris
With `render`, also writes one PNG per style (on the v6 head) for the contact sheets (see make_sheets.py).

Style language (David's S/B/N sheets): each piece is a few chunky masses, smooth-shaded by angle, with a
handful of sharp tufts. Bangs lie on top of the back-hair cap (larger offset), so any bangs + back pair
connects without gaps.
"""
import bpy, json, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402  (shared Piece, rig loader, export, render helpers)
from kit import Piece, TAU, hair_point, HC  # noqa: E402
from head_shape import head_point, CHIN, HEAD_Z  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER_DIR = ARGS[ARGS.index("render") + 1] if "render" in ARGS else None
HAIR = kit.PAL["hair"][kit.PAL["ref_girl_defaults"]["hair"]]
SHARP = 40.0          # degrees; tufts and parting edges stay sharp, masses read smooth
MAX_TRIS = 250

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
mat = kit.material("M_Hair", HAIR)
rig = kit.load_rig(scene, ["V6_Head", "V6_Body", "V6_Top", "V6_Bottom"] if RENDER_DIR else [])
HEAD_BONE = "mixamorig:Head"


# ================================================================ bangs (N sheet families)
def bangs(lons, fringe, drops=None, top=74, offs=(0.044, 0.056, 0.058), shift=None, gap=None, extra=None):
    """fringe(lon)->lat of the fringe edge; drops(i)->tip drop in degrees (0 = none); shift(i)->tip lon offset."""
    pc = Piece()

    def rows(lon):
        f0 = fringe(lon)
        return [f0, f0 + (top - f0) * 0.5, top]

    def off(lat, lon, ri):
        return offs[ri]

    def tips(i, la, lb):
        d = drops(i) if drops else 0
        if not d:
            return None
        mid = (la + lb) / 2 + (shift(i) if shift else 0)
        return (min(fringe(la), fringe(lb)) - d, mid, offs[0] - 0.002)

    pc.patch(lons, rows, off, tips=tips, skip=(lambda i, r: gap(lons[i], lons[i + 1], r)) if gap else None)
    if extra:
        extra(pc)
    return pc


L8 = [-80, -58, -38, -13, 13, 38, 58, 80]
L10 = [-80, -62, -44, -26, -9, 9, 26, 44, 62, 80]
L12 = [-80, -66, -52, -38, -24, -8, 8, 24, 38, 52, 66, 80]
alt = lambda a, b_: (lambda i: a if i % 2 == 0 else b_)


def side_fringe(front, side, edge=40, far=62):
    return lambda lon: front if abs(lon) <= edge else (side if abs(lon) >= far else front + (side - front) * (abs(lon) - edge) / (far - edge))


def wispy():
    pc = Piece()
    for c in (-46, -23, 0, 23, 46):
        pc.patch([c - 7, c + 7], lambda lon: [8, 38, 64], lambda lat, lon, ri: (0.048, 0.052, 0.046)[ri],
                 tips=lambda i, la, lb, c=c: (8 - 10, c + (3 if c < 0 else -3 if c > 0 else 0), 0.046))
    return pc


def swept(direction):
    # fringe rises toward one side, tufts point the other way
    s = direction
    return bangs(L10, lambda lon: 34 - 32 * (s * lon + 80) / 160 if abs(lon) < 70 else -12,
                 drops=lambda i: 8 if i < 9 else 0, shift=lambda i: 9 * s)


def curtain(side_lat):
    return bangs(L10, lambda lon: 44 - (44 - 6) * min(1.0, abs(lon) / 44) if abs(lon) < 62 else side_lat,
                 drops=alt(6, 9), shift=lambda i: (-6 if i < 4 else 6),
                 gap=lambda la, lb, r: abs(la + lb) < 1 and r == 0)      # open parting at the centre


def single_strand():
    pc = bangs(L8, side_fringe(24, 0), drops=alt(3, 4))
    pc.patch([-26, -12], lambda lon: [-18, 24, 74], lambda lat, lon, ri: (0.05, 0.06, 0.06)[ri],
             tips=lambda i, la, lb: (-26, -21, 0.048))
    return pc


BANGS = [  # id, name, N cell (nearest), builder
    ("bangs_straight", "Straight cut", "N4.2", lambda: bangs(L10, side_fringe(12, -8), drops=alt(3, 4))),
    ("bangs_straight_long", "Straight cut, long", "N3.3", lambda: bangs(L10, side_fringe(6, -22), drops=alt(4, 5))),
    ("bangs_bowl", "Rounded bowl", "N4.1", lambda: bangs(L10, side_fringe(16, 2), drops=None, offs=(0.056, 0.066, 0.062))),
    ("bangs_wispy", "See-through wispy", "N6.1", wispy),
    ("bangs_swept_l", "Side-swept left", "N2.2", lambda: swept(1)),
    ("bangs_swept_r", "Side-swept right", "N6.4", lambda: swept(-1)),
    ("bangs_curtain", "Curtain", "N3.2", lambda: curtain(-8)),
    ("bangs_curtain_long", "Curtain, long", "N6.2", lambda: curtain(-42)),
    ("bangs_centre_split", "Centre split", "N1.4", lambda: bangs(
        [-80, -58, -36, -16, -5, 5, 16, 36, 58, 80], lambda lon: 56 if abs(lon) < 6 else side_fringe(10, -14)(lon),
        drops=lambda i: 0 if i == 4 else (7 if i % 2 else 10), gap=lambda la, lb, r: abs(la + lb) < 1)),
    ("bangs_spiky", "Spiky tufts", "N4.3", lambda: bangs(L10, side_fringe(22, 0), drops=alt(14, 6),
                                                          shift=lambda i: 7 if i % 2 else -7)),
    ("bangs_hime", "Hime side-locks", "N6.3", lambda: bangs(
        [-82, -68, -54, -38, -13, 13, 38, 54, 68, 82],
        lambda lon: 10 if abs(lon) <= 40 else (-50 if abs(lon) >= 66 else -8), drops=alt(2, 2))),
    ("bangs_choppy", "Short choppy", "N1.5", lambda: bangs(L12, side_fringe(28, 14), drops=alt(4, 7),
                                                           shift=lambda i: 4 if i % 3 else -4)),
    ("bangs_swept_back", "Swept back", "N5.4", lambda: bangs(L8, lambda lon: 42 if abs(lon) < 60 else 26, drops=None,
                                                             top=80, offs=(0.05, 0.072, 0.06))),
    ("bangs_single_strand", "Short with one long strand", "N5.3", single_strand),
    ("bangs_wavy", "Wavy swept", "N3.1", lambda: bangs(L10, lambda lon: 22 - 18 * (lon + 80) / 160 if abs(lon) < 70 else -10,
                                                       drops=alt(9, 5), shift=lambda i: 8 * math.sin(i * 1.7))),
    ("bangs_asym_block", "Asymmetric block", "N6.5", lambda: bangs(
        L10, lambda lon: (8 if lon < 0 else 28) if abs(lon) < 66 else (-30 if lon < 0 else 6), drops=alt(3, 5))),
]


# ================================================================ back (B sheet families)
BACK_L = [0, 30, 60, 90, 120, 150, 180, -150, -120, -90, -60, -30]
WINDOW = 61       # |lon| below this is the face opening (open below lat 22)


def cmid(a, b_):
    """circular mean of two longitudes (degrees)."""
    return math.degrees(math.atan2(math.sin(math.radians(a)) + math.sin(math.radians(b_)),
                                   math.cos(math.radians(a)) + math.cos(math.radians(b_))))


def cap(bottom, offs=(0.05, 0.044, 0.038, 0.042, 0.044), tips=None, top_rows=(22, 52, 74)):
    """Full crown cap + sides/back down to bottom(lon) lat. Returns (piece, grid, lons) for extensions."""
    pc = Piece()
    lons = BACK_L + [BACK_L[0]]           # wrap

    def rows(lon):
        bt = bottom(lon)
        mid = (bt + top_rows[0]) / 2
        return [bt, mid] + list(top_rows)

    def off(lat, lon, ri):
        return offs[ri]

    win = lambda i, r: max(abs(lons[i]), abs(lons[i + 1])) < WINDOW and r < 2
    grid = pc.patch(lons, rows, off, skip=win,
                    tips=(lambda i, la, lb: None if max(abs(la), abs(lb)) < WINDOW else tips(i, la, lb, cmid(la, lb))) if tips else None)
    apex = pc.v(hair_point(90, 0, offs[-1]))
    for i in range(len(lons) - 1):
        pc.f([grid[i][-1], grid[i + 1][-1], apex], HC)
    return pc, grid, lons


def back_row(grid, lons):
    """Bottom verts of the non-window columns, ordered from one face edge round the back to the other."""
    idx = [i for i, l in enumerate(lons[:-1]) if abs(l) >= WINDOW - 2]
    idx.sort(key=lambda i: (lons[i] % 360))
    return [grid[i][0] for i in idx]


def bob():
    pc, g, l = cap(lambda lon: -44 if abs(lon) >= 90 else -38,
                   tips=lambda i, la, lb, mid: (-54, mid, 0.052) if i % 2 == 0 else None)
    return pc


def wolf():
    pc, g, l = cap(lambda lon: -30, offs=(0.05, 0.05, 0.042, 0.046, 0.05))
    pc.skirt(back_row(g, l), CHIN - 0.03, nrows=1, flare=1.12, tip_drop=0.05, tip_every=1)
    return pc


def long_straight(z_end=0.38, wave=0.0, flare=1.06):
    pc, g, l = cap(lambda lon: -40)
    pc.skirt(back_row(g, l), z_end, nrows=2, flare=flare, wave=wave, tip_drop=0.03, tip_every=2)
    return pc


def high_pony():
    pc, g, l = cap(lambda lon: -22, offs=(0.03, 0.032, 0.034, 0.04, 0.042))
    base = hair_point(48, 180, 0.045)
    pc.tube([base, base + Vector((0, 0.06, 0.02)), base + Vector((0, 0.1, -0.07)), base + Vector((0, 0.11, -0.2))],
            [0.05, 0.058, 0.046, 0.026], sides=8)
    return pc


def pigtails():
    pc, g, l = cap(lambda lon: -26, offs=(0.03, 0.032, 0.034, 0.04, 0.042))
    for s in (1, -1):
        base = hair_point(-6, s * 108, 0.04)
        out = Vector((s * 0.025, 0.01, 0))
        pc.tube([base, base + out + Vector((0, 0, -0.05)), base + out * 1.3 + Vector((0, 0, -0.15)),
                 base + out * 1.2 + Vector((0, 0.005, -0.26))], [0.04, 0.048, 0.04, 0.024], sides=6)
    return pc


def twin_buns():
    pc, g, l = cap(lambda lon: -30)
    for s in (1, -1):
        pc.blob(hair_point(56, s * 62, 0.09), 0.062)
    return pc


def single_bun():
    pc, g, l = cap(lambda lon: -34)
    pc.blob(hair_point(66, 180, 0.1), (0.085, 0.08, 0.075))
    return pc


def braided_crown():
    pc, g, l = cap(lambda lon: -36, offs=(0.046, 0.04, 0.036, 0.04, 0.042))
    n = 12
    path = [hair_point(40, 360 * k / n + 15, 0.05) for k in range(n)]
    radii = [0.034 if k % 2 == 0 else 0.022 for k in range(n)]
    pc.tube(path, radii, sides=6, closed_loop=True)
    return pc


def short_spiky():
    pc, g, l = cap(lambda lon: -18, offs=(0.034, 0.036, 0.036, 0.04, 0.042))
    for lat, lon in ((50, 20), (50, -30), (62, 80), (62, -90), (58, 160), (40, 130), (40, -140), (76, 0)):
        pc.spike(lat, lon, 0.036, 0.06, width=14, lean=(-8, 10 if lon >= 0 else -10))
    return pc


def undercut():
    pc, g, l = cap(lambda lon: -8 if abs(lon) < 100 else -42, offs=(0.012, 0.014, 0.05, 0.064, 0.066))
    return pc


def bowl():
    pc, g, l = cap(lambda lon: 0 if abs(lon) < 95 else -40 * min(1.0, (abs(lon) - 95) / 50), offs=(0.056, 0.056, 0.05, 0.05, 0.05))
    return pc


BACKS = [
    ("back_bob", "Bob", "B2.1", bob),
    ("back_wolf", "Wolf cut", "B4.4", wolf),
    ("back_long", "Long straight", "B3.1", long_straight),
    ("back_wavy_long", "Wavy long", "B4.5", lambda: long_straight(0.4, wave=0.05, flare=1.12)),
    ("back_high_pony", "High ponytail", "B6.5", high_pony),
    ("back_pigtails", "Low pigtails", "B3.2", pigtails),
    ("back_twin_buns", "Twin buns", "B2.5", twin_buns),
    ("back_bun", "Single top bun", "B1.1", single_bun),
    ("back_braid_crown", "Braided crown", "B7.2", braided_crown),
    ("back_short_spiky", "Short spiky", "B3.4", short_spiky),
    ("back_undercut", "Undercut", "B3.5", undercut),
    ("back_bowl", "Bowl", "B1.5", bowl),
]

# ================================================================ build + export
os.makedirs(os.path.join(HERE, "bangs"), exist_ok=True)
os.makedirs(os.path.join(HERE, "back"), exist_ok=True)
catalog = {"note": "Hair library (rows 135, 191, 192). Each GLB = CharacterRig + one mesh skinned 100% to "
                   "mixamorig:Head; bind to the character skeleton by bone name. M_Hair is tinted from palette.json "
                   "hair colours. Sheet cells are the nearest reference cell on David's labelled sheets.",
           "head": "art/characters/base/head_shape.py (ref18_measurements.json)", "bangs": [], "back": []}
objs = {}
for slot, table in (("bangs", BANGS), ("back", BACKS)):
    for sid, name, cell, fn in table:
        ob = fn().finish(sid, rig, {"M_Hair": mat}, sharp=SHARP)
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        objs[sid] = ob
        catalog[slot].append({"id": sid, "name": name, "sheet_cell": cell, "tris": tris, "file": f"{slot}/{sid}.glb"})
        kit.export(ob, rig, os.path.join(HERE, slot, f"{sid}.glb"))
        print(f"HAIR {slot} {sid} tris={tris}" + ("  OVER BUDGET" if tris > MAX_TRIS else ""))
json.dump(catalog, open(os.path.join(HERE, "hair_catalog.json"), "w"), indent=1)
kit.update_catalog("hair", [{"id": h["id"], "slot": slot, "name": h["name"], "glb": f"hair/{h['file']}", "tris": h["tris"],
                             "materials": [{"name": "M_Hair", "tint": "hair"}], "decalSlot": None, "hidesBackHair": False,
                             "hides": [], "sheetCell": h["sheet_cell"]} for slot in ("bangs", "back") for h in catalog[slot]])

# ================================================================ review renders on the v6 head
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    kit.show_vertex_colors(scene)
    kit.render_setup(scene)
    turn = bpy.data.objects.new("Turn", None)
    scene.collection.objects.link(turn)
    rig.parent = turn
    cd = bpy.data.cameras.new("Cam")
    cd.type, cd.ortho_scale = "ORTHO", 0.72
    cam = bpy.data.objects.new("Cam", cd)
    scene.collection.objects.link(cam)
    cam.location, cam.rotation_euler = (0, -4, HEAD_Z - 0.06), (math.radians(90), 0, 0)
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = 300

    def show_only(ids):
        for sid, ob in objs.items():
            ob.hide_render = sid not in ids

    def shot(path, yaw):
        turn.rotation_euler = (0, 0, math.radians(yaw))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)

    for sid, _, _, _ in BANGS:
        show_only({sid, "back_bob"})
        shot(os.path.join(RENDER_DIR, f"bangs_{sid}_a.png"), 0)
        shot(os.path.join(RENDER_DIR, f"bangs_{sid}_b.png"), 35)
    for sid, _, _, _ in BACKS:
        show_only({sid, "bangs_straight"})
        shot(os.path.join(RENDER_DIR, f"back_{sid}_a.png"), 30)
        shot(os.path.join(RENDER_DIR, f"back_{sid}_b.png"), 150)
    print("RENDER_OK")
