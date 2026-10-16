"""The village bushes, closed all the way round (game/remodel-r2; David, 2026-10-16: "the leaf texture is gone, just edit
the old texture"): the dump's own leafy bushes with their own leaf texture, closed at the back, in season colours.

ACNH builds each bush as a hood of leaf cards facing its camera: front, top and sides, and nothing behind. The game
turns every bush to a random yaw (lib/game/natureParts.ts bushParts) and the orbit camera goes round them, so the open
back shows. Closed here as art/trees/build_trees.py closes the oak crowns: the bush is one round mass (its sphere is
fitted to the cards); the back half is the same cards turned about the mass's upright axis (a little off the half
turn, each card rolled about its own normal and resized a little, so the back is no copy of the front); a ball of the
same leaf texture sits just inside the cards, darker, so a gap between cards shows leaves in shade, never the hollow.
Normals point out of the mass (blended with the card's own and tipped up), so each bush shades as one soft round
shape. The closed bush is centred on its spot (the dump's hood sat off it, toward its front).

Colour: the dump's grey leaf texture times a tint, as ACNH draws it (the dump's tint was the material's base colour
factor). Here the tint rides in COLOR_0 (the factor is white), with the inner ball darker and the cards a little darker
low down, so one material draws a bush in one draw. Each season is a tint on the same leaves: fresh green in spring,
the dump's own deep greens in summer, rust and amber in autumn; winter is the dump's snow holly, its own coloured
texture.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/nature/close_bushes.py [-- review <dir>]

Reads web/public/assets/acnh/plants/bush-*.glb (the dump bushes, which the applicant island still draws unchanged) and
writes web/public/assets/game/plants/bush-<species>-<season>.glb, then web/scripts/finish-bushes.mjs puts the dump's
own texture image back on each (bit for bit) and sets the material: white factor, opaque, double-sided.
"""
import bpy, bmesh, math, os, random, subprocess, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "web", "public", "assets", "acnh", "plants")
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "plants")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(h):
    h = h.lstrip("#")
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


# The dump's own tints (each bush's base colour factor, linear) and the season tints (sRGB hex, on the same grey leaves).
DUMP_TINT = {
    "azalea": (0.1248, 0.4793, 0.0782),
    "hydrangea": None,          # read from the file
    "hibiscus": (0.1062, 0.4259, 0.0697),
    "holly": (0.0273, 0.2051, 0.0319),
    "holly-snow": (1.0, 1.0, 1.0),
}
# name: (dump source, tint: "dump" or a hex, turn off the half turn, seed)
BUSHES = {
    "bush-azalea-spring": ("azalea", "dump", 9),
    "bush-hydrangea-spring": ("hydrangea", "#86c25a", -8),
    "bush-hydrangea-summer": ("hydrangea", "dump", -8),
    "bush-hibiscus-summer": ("hibiscus", "dump", 10),
    "bush-holly-autumn": ("holly", "#ad5229", 7),
    "bush-hydrangea-autumn": ("hydrangea", "#d99a3a", -8),
    "bush-holly-winter": ("holly-snow", "dump", 8),
}
# The part of each leaf texture the inner ball wears (Blender UV, v up): leaves only, never a special patch (the snow
# holly's orange corner, the empty white squares). The azalea's is ACNH's own backing of twigs and shaded leaves.
CORE_UV = {
    "azalea": (0.0, 0.0, 0.74, 0.4),
    "hydrangea": (0.0, 0.0, 0.66, 0.52),
    "hibiscus": (0.0, 0.0, 0.58, 0.52),
    "holly": (0.0, 0.47, 0.48, 1.0),
    "holly-snow": (0.04, 0.2, 0.62, 0.86),
}
CORE_SHADE = 0.62       # the inner ball, in shade
LOW_SHADE = 0.8         # the cards at the ground (1.0 at the top)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def bake(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(ob.matrix_world)
    ob.data = me
    ob.parent = None
    ob.matrix_world = Matrix.Identity(4)
    return ob


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def cards(bm):
    """The leaf cards: connected groups of faces."""
    seen, out = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        stack, comp = [f], []
        seen.add(f)
        while stack:
            g = stack.pop()
            comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        stack.append(h)
        out.append(comp)
    return out


def card_frame(comp):
    verts = {v for f in comp for v in f.verts}
    c = sum((v.co for v in verts), Vector()) / len(verts)
    n = sum((f.normal * f.calc_area() for f in comp), Vector())
    return verts, c, (n.normalized() if n.length > 1e-9 else Vector((0, -1, 0)))


def fit_sphere(points):
    """Least-squares sphere through points (|p|^2 = 2 c.p + k): its centre and radius."""
    import numpy as np
    P = np.array([[p.x, p.y, p.z] for p in points])
    A = np.c_[2 * P, np.ones(len(P))]
    b = (P ** 2).sum(1)
    sol = np.linalg.lstsq(A, b, rcond=None)[0]
    c = Vector(sol[:3])
    return c, math.sqrt(max(sol[3] + c.length_squared, 1e-6))


def mass_of(ob):
    """The bush's round mass: the sphere its cards sit on (held inside the cards' own bounds)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    cs = [card_frame(comp)[1] for comp in cards(bm)]
    bm.free()
    lo = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    hi = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    c, r = fit_sphere(cs)
    # Upright axis: the fit's, kept within the cards' footprint; the height the middle of the cards.
    c = Vector((min(max(c.x, lo.x), hi.x), min(max(c.y, lo.y), hi.y), (lo.z + hi.z) / 2))
    return c, r, cs


def close(ob, centre, turn_deg, seed):
    """The back half: every card turned about the mass's upright axis, rolled about its normal and resized a little."""
    rng = random.Random(seed)
    back = link(ob.copy())
    back.data = ob.data.copy()
    bm = bmesh.new()
    bm.from_mesh(back.data)
    half = Matrix.Translation((centre.x, centre.y, 0)) @ Matrix.Rotation(math.pi + math.radians(turn_deg), 4, "Z") @ Matrix.Translation((-centre.x, -centre.y, 0))
    for comp in cards(bm):
        verts, c, n = card_frame(comp)
        roll = Matrix.Rotation(rng.uniform(-0.45, 0.45), 4, n)
        m = half @ Matrix.Translation(c) @ roll @ Matrix.Scale(rng.uniform(0.9, 1.1), 4) @ Matrix.Translation(-c)
        for v in verts:
            v.co = m @ v.co
    bm.normal_update()
    bm.to_mesh(back.data)
    bm.free()
    return back


def tri_wave(x):
    """0..1..0 as x runs 0..1..2: a tiling that mirrors at the seams, so the wrap is continuous."""
    return 1 - abs((x % 2) - 1)


def core_ball(centre, radii, name, rect, segs=12, rings=7):
    """The inner ball of leaves: a UV ellipsoid wearing `rect` of the texture, mirrored twice round it and once up it,
    its bottom at the ground."""
    u0, v0, u1, v1 = rect
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rows = []
    for j in range(rings + 1):
        t = j / rings
        phi = math.pi * (t - 0.5)
        row = []
        for i in range(segs + 1):
            th = math.tau * i / segs
            p = Vector((math.cos(phi) * math.cos(th) * radii.x, math.cos(phi) * math.sin(th) * radii.y, math.sin(phi) * radii.z)) + centre
            p.z = max(p.z, 0.02)
            row.append((bm.verts.new(p), (u0 + (u1 - u0) * tri_wave(i / segs * 4), v0 + (v1 - v0) * tri_wave(t * 2))))
        rows.append(row)
    for j in range(rings):
        for i in range(segs):
            a, b, c, d = rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]
            try:
                f = bm.faces.new([a[0], b[0], c[0], d[0]])
            except ValueError:
                continue
            for lp, (_, uv) in zip(f.loops, (a, b, c, d)):
                lp[uvl].uv = uv
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def join(objs, name):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    return ob


def face_out(ob, centre):
    """Every card wound to face out of the mass. The cards are drawn from both sides, and three lights a card's back
    face with its normal turned over: a card wound inward would read dark from outside under the outward normals."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    inward = [f for f in bm.faces if f.normal.dot(f.calc_center_median() - centre) < 0]
    bmesh.ops.reverse_faces(bm, faces=inward, flip_multires=False)
    bm.to_mesh(ob.data)
    bm.free()
    return len(inward)


def mass_normals(ob, centre, radii, mass=0.55, own=0.25, up=0.35):
    """Each vertex's normal out of the round mass (an ellipsoid's), blended with its face's and tipped up."""
    me = ob.data
    me.shade_smooth()
    own_n = [Vector() for _ in me.vertices]
    for p in me.polygons:
        for vi in p.vertices:
            own_n[vi] += p.normal
    ns = []
    for v, o in zip(me.vertices, own_n):
        q = v.co - centre
        e = Vector((q.x / radii.x ** 2, q.y / radii.y ** 2, q.z / radii.z ** 2))
        e = e.normalized() if e.length > 1e-9 else Vector((0, 0, 1))
        if o.length > 1e-9 and o.normalized().dot(e) < 0:
            o = -o
        n = e * mass + (o.normalized() if o.length > 1e-9 else e) * own + Vector((0, 0, up))
        ns.append(n.normalized())
    me.normals_split_custom_set_from_vertices(ns)


def paint(ob, tint, core_faces, top):
    """COLOR_0: the tint, the inner ball in shade, the cards a little darker low down."""
    me = ob.data
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    col = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    for p in me.polygons:
        for li in p.loop_indices:
            z = me.vertices[me.loops[li].vertex_index].co.z
            k = CORE_SHADE if p.index in core_faces else LOW_SHADE + (1 - LOW_SHADE) * min(max(z / top, 0), 1)
            col.data[li].color = (tint[0] * k, tint[1] * k, tint[2] * k, 1.0)
    me.color_attributes.active_color = col


def dump_tint(species, src):
    if DUMP_TINT[species]:
        return DUMP_TINT[species]
    import json, struct
    b = open(src, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    f = json.loads(b[20:20 + n])["materials"][0]["pbrMetallicRoughness"]["baseColorFactor"]
    return tuple(f[:3])


def build(name, species, tint_spec, turn):
    reset()
    src = os.path.join(SRC, f"bush-{species}.glb")
    bpy.ops.import_scene.gltf(filepath=src)
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in objs:
        bake(o)
    for o in [o for o in bpy.context.scene.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o)
    ob = objs[0] if len(objs) == 1 else join(objs, name)
    before = tris(ob)
    centre, r, cs = mass_of(ob)
    back = close(ob, centre, turn, seed=sum(map(ord, name)))
    shell = join([ob, back], name)
    # Recentre on the spot: the mass's upright axis at the origin.
    shell.data.transform(Matrix.Translation((-centre.x, -centre.y, 0)))
    centre = Vector((0, 0, centre.z))
    vs = [v.co for v in shell.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    radii = Vector(((hi.x - lo.x) / 2, (hi.y - lo.y) / 2, (hi.z - lo.z) / 2))
    # The inner ball: inside the near quarter of the cards' reach, so it never pokes through them.
    reach = sorted((v - centre).length for v in vs)
    k = reach[int(0.2 * (len(reach) - 1))] / max(radii)
    core = core_ball(Vector((0, 0, max(centre.z, radii.z * 0.8))), Vector((radii.x * k * 0.92, radii.y * k * 0.92, radii.z * k * 0.9)), "Core", CORE_UV[species])
    core.data.materials.append(shell.data.materials[0])
    ncore = len(core.data.polygons)
    bush = join([shell, core], name)
    core_faces = set(range(len(bush.data.polygons) - ncore, len(bush.data.polygons)))
    face_out(bush, centre)
    mass_normals(bush, centre, radii)
    tint = dump_tint(species, src) if tint_spec == "dump" else lin(tint_spec)
    paint(bush, tint, core_faces, hi.z)
    path = os.path.join(OUT, name + ".glb")
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    bush.select_set(True)
    bpy.context.view_layer.objects.active = bush
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
                              export_normals=True, export_texcoords=True, export_materials="EXPORT",
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_animations=False,
                              export_skins=False, export_morph=False, export_cameras=False, export_lights=False)
    size = hi - lo
    print(f"BUSH {name}: {species} {before} -> {tris(bush)} tris, {round(size.x, 2)} x {round(size.y, 2)} x {round(size.z, 2)}, mass r {round(r, 2)}, core k {round(k, 2)}")
    return path, src


def review(paths, out):
    """Front, side and back views of each written bush (read back from its GLB)."""
    sys.path.insert(0, os.path.join(ROOT, "art", "props"))
    os.makedirs(out, exist_ok=True)
    for p in paths:
        reset()
        bpy.ops.import_scene.gltf(filepath=p)
        obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        for o in obs:
            if o.data.color_attributes:
                o.data.color_attributes[0].name = "Color"
        import propkit as K
        # propkit's azimuth 0 looks from -z, the game camera's side: front, side, back, and from above.
        K.review(obs, os.path.join(out, os.path.basename(p).replace(".glb", ".png")), views=((0, 22), (90, 22), (180, 22), (0, 70)), size=360)


def main():
    names = [a for a in ARGS if a in BUSHES] or list(BUSHES)
    written = []
    for n in names:
        species, tint, turn = BUSHES[n]
        path, src = build(n, species, tint, turn)
        written.append((path, src))
    subprocess.run(["node", "scripts/finish-bushes.mjs", *[f"{p}={s}" for p, s in written]], cwd=os.path.join(ROOT, "web"), check=True)
    if "review" in ARGS:
        review([p for p, _ in written], ARGS[ARGS.index("review") + 1])


main()
