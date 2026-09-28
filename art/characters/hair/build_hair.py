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
handful of sharp tufts.

Fit (avatar-fit, row 242): every piece is a closed solid (outer surface, underside tucked 4 mm into the scalp, walls
on every edge), so nothing reads as paper and the engine's back-face culling cannot hollow it. The outer surface
follows head_shape.hair_vol: 0.9-1.1 cm off the scalp at the fringe and hem, fuller toward the crown. Back caps
cover the crown down to head_shape.hairline (44 deg above the brows, 22 at the temples); bangs lie on the forehead
below it and run their roots under it, so the seam is the cap's front edge and there is no crown ledge.
Checked by art/characters/fit_check.py.
"""
import bpy, json, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402  (shared Piece, rig loader, export, render helpers)
from kit import Piece, TAU, hair_point, HC  # noqa: E402
from head_shape import head_point, CHIN, HEAD_Z, INNER, hair_vol, hairline, _ss  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER_DIR = ARGS[ARGS.index("render") + 1] if "render" in ARGS else None
HAIR = kit.PAL["hair"][kit.PAL["ref_girl_defaults"]["hair"]]
SHARP = 40.0          # degrees; tufts and parting edges stay sharp, masses read smooth
MAX_TRIS = 700         # closed solids: walls and a closing fan hidden inside the head add about a third
ZRANGE = (CHIN, 1.03)  # one COLOR_0 gradient for every hair piece: no shade step where bangs meet the cap

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
mat = kit.material("M_Hair", HAIR)
rig = kit.load_rig(scene, ["V6_Head", "V6_Body", "V6_Top", "V6_Bottom"] if RENDER_DIR else [])
HEAD_BONE = "mixamorig:Head"


# ================================================================ bangs (N sheet families)
FRINGE_OFF = 0.009    # the fringe edge lies on the forehead
ROOT_DIP = 0.004      # roots run this far under the thinnest back cap (the seam hides under the cap's front edge)


def root_lat(lon):
    """Bangs roots: behind the hairline, under the back cap (or the hat's tuck)."""
    return hairline(lon) + 12


def side(lon):
    """0 over the forehead, 1 where a side lock lies over the back cap's side panel (|lon| >= 64)."""
    return _ss(48, 64, abs(lon))


def bangs(lons, fringe, drops=None, top=None, vol=1.0, shift=None, gap=None, extra=None):
    """fringe(lon)->lat of the fringe edge; drops(i)->tip drop in degrees (0 = none); shift(i)->tip lon offset.
    A closed solid in four rows: fringe edge on the forehead, a middle row that bellies out a little (chunky, not a
    sheet), the hairline row just under the cap's front edge (kit.seam_off), and the root row under the cap.
    Side locks lie over the cap's side panels and dive under it by the hairline row. Tips are wedges."""
    pc = Piece()
    top = top or root_lat

    def rows(lon):
        f0 = fringe(lon)
        h = max(hairline(lon), f0 + 6)
        return [f0, (f0 + h) / 2, h, max(top(lon), h + 8)]

    def edge_off(f0, lon):
        return FRINGE_OFF + side(lon) * (hair_vol(f0) + 0.004 - FRINGE_OFF)

    def off(lat, lon, ri):
        f0, _, h, r = rows(lon)
        if ri == 3:
            return kit.seam_off(r) - ROOT_DIP
        o0, oh = edge_off(f0, lon), kit.seam_off(h) - 0.001
        t = (0.0, 0.5, 1.0)[ri]
        o = o0 + (oh - o0) * t + 0.004 * vol * (1 - side(lon)) * math.sin(math.pi * t)
        # wherever a cap covers the scalp (above the hairline), bangs run under its front edge, never over it
        return min(o, kit.seam_off(lat) - 0.001) if lat >= hairline(lon) - 1 else o

    def tips(i, la, lb):
        d = drops(i) if drops else 0
        if not d:
            return None
        mid_lon = (la + lb) / 2 + (shift(i) if shift else 0)
        f0 = min(fringe(la), fringe(lb))
        return (f0 - d, mid_lon, edge_off(f0, mid_lon) - 0.002)

    pc.solid_patch(lons, rows, off, tips=tips, skip=(lambda i, r: gap(lons[i], lons[i + 1], r)) if gap else None)
    if extra:
        extra(pc)
    return pc


L8 = [-80, -58, -38, -13, 13, 38, 58, 80]
L10 = [-80, -62, -44, -26, -9, 9, 26, 44, 62, 80]
L12 = [-80, -66, -52, -38, -24, -8, 8, 24, 38, 52, 66, 80]
alt = lambda a, b_: (lambda i: a if i % 2 == 0 else b_)


def side_fringe(front, side_lat, edge=40, far=62):
    return lambda lon: front if abs(lon) <= edge else (side_lat if abs(lon) >= far else front + (side_lat - front) * (abs(lon) - edge) / (far - edge))


def wispy():
    """See-through: five separate strands, forehead showing between them up to the cap's hairline."""
    pc = Piece()
    for c in (-46, -23, 0, 23, 46):
        strand = bangs([c - 7, c + 7], lambda lon: 8, drops=lambda i, c=c: 10, shift=lambda i, c=c: (3 if c < 0 else -3 if c > 0 else 0),
                       vol=0.3)
        kit.merge_piece(pc, strand)
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
    kit.merge_piece(pc, bangs([-26, -12], lambda lon: -18, drops=lambda i: 8, shift=lambda i: 2))
    return pc


BANGS = [  # id, name, N cell (nearest), builder
    ("bangs_straight", "Straight cut", "N4.2", lambda: bangs(L10, side_fringe(12, -8), drops=alt(3, 4))),
    ("bangs_straight_long", "Straight cut, long", "N3.3", lambda: bangs(L10, side_fringe(6, -22), drops=alt(4, 5))),
    ("bangs_bowl", "Rounded bowl", "N4.1", lambda: bangs(L10, side_fringe(16, 2), drops=None, vol=2.0)),
    ("bangs_wispy", "See-through wispy", "N6.1", wispy),
    ("bangs_swept_l", "Side-swept left", "N2.2", lambda: swept(1)),
    ("bangs_swept_r", "Side-swept right", "N6.4", lambda: swept(-1)),
    ("bangs_curtain", "Curtain", "N3.2", lambda: curtain(-8)),
    ("bangs_curtain_long", "Curtain, long", "N6.2", lambda: curtain(-42)),
    ("bangs_centre_split", "Centre split", "N1.4", lambda: bangs(
        [-80, -58, -36, -16, -5, 5, 16, 36, 58, 80], lambda lon: 40 if abs(lon) < 6 else side_fringe(10, -14)(lon),
        drops=lambda i: 0 if i == 4 else (7 if i % 2 else 10), gap=lambda la, lb, r: abs(la + lb) < 1)),
    ("bangs_spiky", "Spiky tufts", "N4.3", lambda: bangs(L10, side_fringe(22, 0), drops=alt(14, 6),
                                                          shift=lambda i: 7 if i % 2 else -7)),
    ("bangs_hime", "Hime side-locks", "N6.3", lambda: bangs(
        [-82, -68, -54, -38, -13, 13, 38, 54, 68, 82],
        lambda lon: 10 if abs(lon) <= 40 else (-50 if abs(lon) >= 66 else -8), drops=alt(2, 2))),
    ("bangs_choppy", "Short choppy", "N1.5", lambda: bangs(L12, side_fringe(28, 14), drops=alt(4, 7),
                                                           shift=lambda i: 4 if i % 3 else -4)),
    # swept back: no fringe, a rolled lift pushed back against the cap's hairline
    ("bangs_swept_back", "Swept back", "N5.4", lambda: bangs(L8, lambda lon: 34 if abs(lon) < 60 else 16, drops=None, vol=2.5)),
    ("bangs_single_strand", "Short with one long strand", "N5.3", single_strand),
    ("bangs_wavy", "Wavy swept", "N3.1", lambda: bangs(L10, lambda lon: 22 - 18 * (lon + 80) / 160 if abs(lon) < 70 else -10,
                                                       drops=alt(9, 5), shift=lambda i: 8 * math.sin(i * 1.7))),
    ("bangs_asym_block", "Asymmetric block", "N6.5", lambda: bangs(
        L10, lambda lon: (8 if lon < 0 else 28) if abs(lon) < 66 else (-30 if lon < 0 else 6), drops=alt(3, 5))),
]


# ================================================================ back (B sheet families)
BACK_L, WINDOW = kit.CAP_LONS, kit.WINDOW
cap = kit.hair_cap


def skirt_ring(bottom, lons=None):
    """New verts just above a cap's hem (inside the cap) from one face edge round the back, for a hanging length."""
    pc_lons = sorted([l for l in (lons or BACK_L) if abs(l) >= WINDOW - 2], key=lambda l: l % 360)
    return pc_lons, [(bottom(l) + 8, l) for l in pc_lons]


def hang(pc, bottom, z_end, **kw):
    lons, pts = skirt_ring(bottom)
    ring = [pc.hv(la, lo, 0.004) for la, lo in pts]
    return pc.skirt(ring, z_end, thick=0.012, **kw)


def bob():
    pc, g, l = cap(lambda lon: -44 if abs(lon) >= 90 else -38, vol=1.1,
                   tips=lambda i, la, lb, mid: (-52, mid, 0.008) if i % 2 == 0 else None)
    return pc


def wolf():
    pc, g, l = cap(lambda lon: -30, vol=1.25)
    hang(pc, lambda lon: -30, CHIN - 0.03, nrows=1, flare=1.12, tip_drop=0.05, tip_every=1)
    return pc


def long_straight(z_end=0.38, wave=0.0, flare=1.06):
    pc, g, l = cap(lambda lon: -40)
    hang(pc, lambda lon: -40, z_end, nrows=2, flare=flare, wave=wave, tip_drop=0.03, tip_every=2)
    return pc


def high_pony():
    pc, g, l = cap(lambda lon: -22, vol=0.85)
    base = hair_point(48, 180, 0.03)
    pc.tube([base, base + Vector((0, 0.06, 0.02)), base + Vector((0, 0.1, -0.07)), base + Vector((0, 0.11, -0.2))],
            [0.045, 0.058, 0.046, 0.026], sides=8)
    return pc


def pigtails():
    pc, g, l = cap(lambda lon: -26, vol=0.85)
    for s in (1, -1):
        base = hair_point(-6, s * 108, 0.022)
        out = Vector((s * 0.025, 0.01, 0))
        pc.tube([base, base + out + Vector((0, 0, -0.05)), base + out * 1.3 + Vector((0, 0, -0.15)),
                 base + out * 1.2 + Vector((0, 0.005, -0.26))], [0.036, 0.046, 0.04, 0.024], sides=6)
    return pc


def twin_buns():
    pc, g, l = cap(lambda lon: -30)
    for s in (1, -1):
        pc.blob(hair_point(56, s * 62, hair_vol(56) + 0.036), 0.058)       # sunk about 40% into the hair
    return pc


def single_bun():
    pc, g, l = cap(lambda lon: -34)
    pc.blob(hair_point(66, 180, hair_vol(66) + 0.05), (0.082, 0.078, 0.072))
    return pc


def braided_crown():
    """A plait ringing the head behind the bangs' roots and round the back, half sunk into the hair."""
    pc, g, l = cap(lambda lon: -36, vol=0.9)
    n = 16
    lons = [((360 * k / n + 11 + 180) % 360) - 180 for k in range(n)]
    lat = lambda lon: hairline(lon) + 16 if abs(lon) < 75 else 32
    path = [hair_point(lat(lo), lo, hair_vol(lat(lo)) * 0.9 - 0.002) for lo in lons]
    radii = [0.022 if k % 2 == 0 else 0.016 for k in range(n)]
    pc.tube(path, radii, sides=6, closed_loop=True)
    return pc


def short_spiky():
    pc, g, l = cap(lambda lon: -18, vol=0.85)
    for lat, lon in ((60, 22), (60, -30), (62, 80), (62, -90), (58, 160), (40, 130), (40, -140), (76, 0)):
        pc.spike(lat, lon, hair_vol(lat) * 0.85 - 0.006, 0.058, width=14, lean=(-8, 10 if lon >= 0 else -10))
    return pc


def undercut():
    """Shaved sides and back (a 4 mm layer below the hairline row), full top."""
    pc, g, l = cap(lambda lon: -8 if abs(lon) < 100 else -42, vol=1.35, hem=0.006, side=0.0075)
    return pc


def bowl():
    pc, g, l = cap(lambda lon: 0 if abs(lon) < 95 else -40 * min(1.0, (abs(lon) - 95) / 50), vol=1.3, hem=0.012)
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
        ob = fn().finish(sid, rig, {"M_Hair": mat}, sharp=SHARP, zrange=ZRANGE)
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
