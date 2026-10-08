"""The village buildings with finished backs (specs/polish/audit-2026-10-world.md item 8).

ACNH authors its buildings for a camera that never turns: the front is dressed and the back is a plain shell (the
chalet's a bare plaster gable, the town hall's a flat brown wall and a blank slab for the clock tower, the shop's a
plain yellow box). The orbit camera sees every side. As the tree pass closed the crowns from their own cards
(art/trees/build_trees.py), each back here is dressed from the model's own authored pieces, turned a half turn
about the building's upright axis (a turn, not a mirror: the clock reads right, the light falls the same way) and
set on the back wall. Nothing is drawn or downloaded; the textures, UVs and matte materials are ACNH's own.

  chalet (the café-style houses: the museum, the home, the movement lab's house): the back gets the front's
    half-timbered facade (the centre gable and the two wings, each set back onto the back wall), its windows with
    their curtains and the dark room behind, the plinth, and the porch lanterns; the door gets a back door
    (chalet-door.glb). The front steps stay at the front.
  hq (town hall): the back wall becomes the front's brick wings with their arched windows, sill, plinth and cornice,
    joined by a plain stretch of the same brickwork where the portico stands at the front; the clock tower's back
    gets the clock face.
  shop: the back wall becomes two of the side wall's plank bays with their framed window, joined by a plain bay.

Sources: art/buildings/source/*.glb, the ACNH extracts as shipped before this pass (web/scripts/extract-acnh-kit.mjs;
raw units, front toward glTF +z). Writes web/public/assets/acnh/buildings/<name>.glb with the same meshes, material
names and draw count (each back is joined into the mesh whose material it wears). Prints each model's triangles.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/build_buildings.py [-- hq shop chalet-wall-c ...]
"""
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "source")
OUT = os.environ.get("BUILDINGS_OUT") or os.path.join(ROOT, "web", "public", "assets", "acnh", "buildings")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


# ── Blender plumbing (Blender space: z up, the front toward -y) ──────────────
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load(name):
    """Import a source GLB; its meshes by name (the extractor's `<node>__<material>`)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + ".glb"))
    return {o.name: o for o in set(bpy.data.objects) - before if o.type == "MESH"}


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def bm_of(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    return bm


def keep_faces(bm, keep):
    """Delete every face `keep(centre, normal)` rejects (and what it leaves loose)."""
    dead = [f for f in bm.faces if not keep(f.calc_center_median(), f.normal)]
    bmesh.ops.delete(bm, geom=dead, context="FACES")


def clip(bm, axis, lo=None, hi=None):
    """Cut along axis = lo and axis = hi and keep what lies between."""
    no = Vector((1, 0, 0)) if axis == "x" else Vector((0, 1, 0)) if axis == "y" else Vector((0, 0, 1))
    for at, side in ((lo, -1), (hi, 1)):
        if at is None:
            continue
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        # clear_outer drops the side the normal points to.
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=no * at, plane_no=no * side, clear_outer=True)


def piece(ob, keep, clips=()):
    """A copy of `ob`'s faces that `keep` accepts, cut to `clips` [(axis, lo, hi)]: a bmesh to place and join."""
    bm = bm_of(ob)
    keep_faces(bm, keep)
    for axis, lo, hi in clips:
        clip(bm, axis, lo, hi)
    return bm


def turn(bm, c, dy=0.0, dx=0.0, about_x=0.0):
    """The half turn about the upright axis through (about_x, c): the front's y lands at 2c − y, then nudged."""
    m = Matrix.Translation((about_x + dx, c + dy, 0)) @ Matrix.Rotation(math.pi, 4, "Z") @ Matrix.Translation((-about_x, -c, 0))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
    return bm


def move(bm, m):
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
    return bm


def join(ob, pieces, drop=None):
    """Append the pieces to `ob`'s mesh (its material: one draw), after deleting the faces `drop` names."""
    bm = bm_of(ob)
    if drop:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if drop(f.calc_center_median(), f.normal)], context="FACES")
    for p in pieces:
        tmp = bpy.data.meshes.new("tmp")
        p.to_mesh(tmp)
        p.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    bm.normal_update()
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


def export(name):
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", export_yup=True,
                              export_apply=True, export_normals=True, export_texcoords=True, export_materials="EXPORT",
                              export_vertex_color="NONE", export_animations=False, export_skins=False,
                              export_morph=False, export_cameras=False, export_lights=False)


def by_prefix(meshes, prefix):
    return next(o for n, o in meshes.items() if n.startswith(prefix))


# ── The chalet ───────────────────────────────────────────────────────────────
# Measured on the source: the centre gable's plaster at y 2.2 (x ±14.2), the wings' at 6.5 (x out to ±22.3), the
# back wall's at 21.7; the steps in front of y 0.5.
CH_CENTRE, CH_WING, CH_BACK, CH_SPLIT = 2.2, 6.5, 21.7, 14.2


def chalet(name):
    m = load(name)
    brick, wood = by_prefix(m, "Brick00"), by_prefix(m, "Wood00")
    glass, curtain = by_prefix(m, "WindowGlass00"), by_prefix(m, "CL__")
    inner, lamp, room = by_prefix(m, "HouseInnerL"), by_prefix(m, "LampDownL"), by_prefix(m, "BrickBack")
    before = {o.name: tris(o) for o in m.values()}
    centre_c = (CH_CENTRE + CH_BACK) / 2   # the centre section lands on the back wall
    wing_c = (CH_WING + CH_BACK) / 2       # and so do the wings, set back at the front

    def front(depth):
        return lambda c, n: c.y < depth

    def sections(ob, centre_depth, wing_lo, wing_hi, extra=lambda c, n: True):
        """The front's centre (|x| < split) and wing (|x| > split) layers of `ob`, each turned onto the back wall."""
        out = [turn(piece(ob, lambda c, n: front(centre_depth)(c, n) and extra(c, n), [("x", -CH_SPLIT, CH_SPLIT)]), centre_c)]
        for lo, hi in ((-30, -CH_SPLIT), (CH_SPLIT, 30)):
            out.append(turn(piece(ob, lambda c, n: wing_lo < c.y < wing_hi and extra(c, n), [("x", lo, hi)]), wing_c))
        return out

    # Plaster (with the window and door openings), plinth and steps: the centre's front layer, the wings' layer. Not
    # the front roof's bargeboard (the back has its own).
    plaster = sections(brick, CH_CENTRE + 0.2, CH_WING - 0.3, CH_WING + 0.3, extra=lambda c, n: not (c.y < 1.0 and c.z > 18))
    join(brick, plaster, drop=lambda c, n: n.y > 0.9 and CH_BACK - 0.3 < c.y < CH_BACK + 0.5 and c.z < 39)
    # The timber frame in front of each.
    join(wood, sections(wood, CH_CENTRE, CH_WING - 1.0, CH_WING))
    # Windows: the panes, the curtains and the dark room behind them.
    for ob in (glass, curtain, inner):
        join(ob, [turn(piece(ob, lambda c, n: abs(c.x) < CH_SPLIT), centre_c),
                  turn(piece(ob, lambda c, n: abs(c.x) >= CH_SPLIT), wing_c)])
    join(lamp, [turn(piece(lamp, lambda c, n: True), centre_c)])
    # The dark room seen through the arch over each door: ACNH's interior panel stood just inside the back wall, where
    # the back's arch would show it; one panel of it, mid-depth, serves both arches (the game draws both faces).
    join(room, [move(piece(room, lambda c, n: True, [("x", -9, 9), ("z", None, 23)]), Matrix.Translation((0, centre_c - CH_BACK + 0.1, 0)))],
         drop=lambda c, n: True)
    export(name)
    after = {o.name: tris(o) for o in m.values()}
    return before, after


def chalet_door():
    m = load("chalet-door")
    door = next(iter(m.values()))
    before = {door.name: tris(door)}
    join(door, [turn(piece(door, lambda c, n: True), (CH_CENTRE + CH_BACK) / 2)])
    export("chalet-door")
    return before, {door.name: tris(door)}


# ── The town hall ───────────────────────────────────────────────────────────
# Measured: the front wall's brick at y 11.4, the back wall's at 29.3 (the plinth and cornice agree: the shell is the
# same front and back); the corners at x ±27.4; each wing's arched window centred on x ±19.9, the portico's columns
# inside x ±14.2. The clock tower's face at y 15.4, its back at 25.8.
HQ_FRONT, HQ_BACK = 11.4, 29.3
HQ_BAY = (-24.9, -14.9)   # a window with plain brick either side, clear of the corner and the columns
HQ_BAYS = 5
TOWER_FRONT, TOWER_BACK, TOWER_HALF = 15.4, 25.8, 7.8


def hq():
    m = load("hq-office")
    wall, roof = by_prefix(m, "EntranceParts01"), by_prefix(m, "FlagBase01")
    left, right = by_prefix(m, "Glass1"), by_prefix(m, "Glass2")
    before = {o.name: tris(o) for o in m.values()}
    c = (HQ_FRONT + HQ_BACK) / 2
    layer = lambda c_, n: HQ_FRONT - 2.2 < c_.y < HQ_FRONT + 1.2 and c_.z < 25
    # The back: the front's two corners, then its window bay five times across between them (brick, the arched window
    # and its sill, the plinth, the frieze and the cornice), each a whisker narrower so five fill the span.
    lo, hi = HQ_BAY
    span = 2 * -lo
    step, k = span / HQ_BAYS, span / HQ_BAYS / (hi - lo)
    corners = [turn(piece(wall, layer, [("x", a, b)]), c) for a, b in ((-40, lo), (-lo, 40))]

    def bays(ob, keep):
        out = []
        for i in range(HQ_BAYS):
            bm = turn(piece(ob, keep, [("x", lo, hi)]), c)   # lands on [-hi, -lo]
            centre = -(lo + hi) / 2
            fit = Matrix.Translation((-lo - step / 2 - i * step, 0, 0)) @ Matrix.Diagonal((k, 1, 1, 1)) @ Matrix.Translation((-centre, 0, 0))
            out.append(move(bm, fit))
        return out
    join(wall, corners + bays(wall, layer), drop=lambda c_, n: n.y > 0.9 and HQ_BACK - 0.5 < c_.y < HQ_BACK + 2.2 and c_.z < 24.5)
    # Each back window's pane (the left wing's own material).
    join(left, bays(left, lambda c_, n: True))
    # The clock tower's face on its back too.
    tc = (TOWER_FRONT + TOWER_BACK) / 2
    face = piece(roof, lambda c_, n: TOWER_FRONT - 1.0 < c_.y < TOWER_FRONT + 1.0 and abs(c_.x) < TOWER_HALF and 29.5 < c_.z < 38)
    join(roof, [turn(face, tc)], drop=lambda c_, n: n.y > 0.9 and abs(c_.y - TOWER_BACK) < 0.4 and abs(c_.x) < TOWER_HALF and 29 < c_.z < 38.5)
    export("hq-office")
    return before, {o.name: tris(o) for o in m.values()}


# ── The shop ────────────────────────────────────────────────────────────────
# Measured: the side walls' planks at x ±27.0 from the front corner (y 12.6) to the back (34.8), the eave at z 21.3,
# the side window centred on y 23.6; the back wall at y 34.5, x ±27.9.
SHOP_SIDE, SHOP_EAVE, SHOP_BACK = -27.0, 21.3, 34.5
SHOP_DEPTH = (12.6, 34.8)
SHOP_PLAIN = (13.4, 18.8)   # planks between the front corner post and the window frame


def shop():
    m = load("shop-market")
    wall, pane = by_prefix(m, "Door_Dark"), by_prefix(m, "polySurface1341")
    before = {o.name: tris(o) for o in m.values()}
    side = lambda c, n: c.x < SHOP_SIDE + 0.7 and c.z < SHOP_EAVE

    def on_back(bm, centre_y, at_x):
        """A piece of the west side wall turned a quarter to face back, its middle (y) at x = at_x on the back wall."""
        r = Matrix.Rotation(-math.pi / 2, 4, "Z")   # (x, y) -> (y, -x): the side's -x face turns to +y
        return move(bm, Matrix.Translation((at_x - centre_y, SHOP_BACK + 0.05 + SHOP_SIDE, 0)) @ r)
    lo, hi = SHOP_DEPTH
    bay, mid = hi - lo, (lo + hi) / 2
    plain = SHOP_PLAIN[1] - SHOP_PLAIN[0]
    half = 27.9
    # Two of the side's window bays at the ends of the back, the plain planks between them.
    ends = [on_back(piece(wall, side), mid, x) for x in (-half + bay / 2, half - bay / 2)]
    gap = 2 * half - 2 * bay
    fill = [on_back(move(piece(wall, side, [("y", *SHOP_PLAIN)]), Matrix.Diagonal((1, gap / 2 / plain, 1, 1))),
                    SHOP_PLAIN[0] * gap / 2 / plain + gap / 4, x) for x in (-gap / 4, gap / 4)]
    # Off: the plain back panel only (the corner posts and the band under the eave stay).
    join(wall, ends + fill, drop=lambda c, n: n.y > 0.9 and abs(c.y - SHOP_BACK) < 0.15 and abs(c.x) < 26 and c.z < 20.5)
    join(pane, [on_back(piece(pane, lambda c, n: c.x < 0), mid, x) for x in (-half + bay / 2, half - bay / 2)])
    export("shop-market")
    return before, {o.name: tris(o) for o in m.values()}


BUILD = {
    "shop-market": shop,
    "hq-office": hq,
    "chalet-wall-a": lambda: chalet("chalet-wall-a"),
    "chalet-wall-c": lambda: chalet("chalet-wall-c"),
    "chalet-wall-e": lambda: chalet("chalet-wall-e"),
    "chalet-door": chalet_door,
}


def main():
    names = [a for a in ARGS if a in BUILD] or list(BUILD)
    for name in names:
        reset()
        before, after = BUILD[name]()
        print(f"BUILDING {name}: {sum(before.values())} -> {sum(after.values())} tris {after}")


main()
