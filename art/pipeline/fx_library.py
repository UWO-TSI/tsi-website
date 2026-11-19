"""The effects library's Blender templates (David 2026-11-05: "make a mini effect library that organizes types of effects
and its a standard so future vfx or effects and r eference and take the template"). The types, their parameters and
what grows with strength are in web/lib/game/fx/library.ts; the standard is specs/fx-library.md. A new effect copies
these: each part is its own object (one material, one draw), named and given extras the way RodAura reads them.

  part        any effect part, its origin at `pivot` (what it turns about), with its extras
  glow        a part of unlit light in the thing's own shape (`Glow`): a copy of the edge, the seam, the tip it lights
  light       the same, additive (`Light`): ribbons and wisps of light
  aura_hug    the aura: the thing's main parts inflated along their path, a soft shell brightest where it faces you (`Aura`);
              never a sphere, a spindle or a disc round the thing
  trail       the extras for a moving part that leaves a ribbon: its width and the point it trails (in its own space)
  particles   the scene extras for the motes that drift off the thing
  water       the Water type's body: a ribbon through rings of points across it (`Water`), its uv across and along
  foam        its foam: a mesh with each vertex's depth into the foam, a phase and a crown weight (`Foam`)
  spray       its drops: one quad each, flying out from the thing's axis and falling (`Spray`)
  sheet       any part from its own vertices and faces (the traced shapes), with uv and per-vertex data
Motion is extras on a part: `spin` (rad/s about its own up), `bob` (m) at `rate` (Hz), `pulse` (a share of its size),
`flicker` (0 to 1). No halos: a disc of light round a thing is what the library replaced (David: "the light coming off
of it being circle isnt right").

  Blender -b --factory-startup -P art/pipeline/fx_library.py -- samples
writes the Water type's sample to web/public/assets/game/props/fxlib-water.glb for /lab/fx (every other type is drawn
by code on any holder since round 10: components/game/fx/HolderFx.tsx). The sample is a 1:1 study of David's
reference (fx-aquatic-water-ref.png, rods round 9): the Aquatic sword, its shell hilt and its water blade, from the
reference's own outlines (traced_refs.py), 1 unit its height, the tail's foot at 0, drawn flat to the camera (-Y).
"""
import bpy, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
import kit  # noqa: E402
sys.path.insert(0, os.path.join(ROOT, "art", "props-enemies"))
from pe import lathe  # noqa: E402

V = Vector
TAU = math.tau
PROPS = os.path.join(ROOT, "web", "public", "assets", "game", "props")


def model(name, mats, build, grad=(0.8, 1.0)):
    """One mesh from a kit.Piece build, its materials named `<name>_<part>`."""
    m = {k: kit.material(f"{name}_{k}", v) for k, v in mats.items()}
    pc = kit.Piece(region="torso", mat=next(iter(mats)))
    build(pc)
    return pc.finish(name, None, m, sharp=50, grad=grad)


def part(name, mats, build, pivot=(0, 0, 0), **extras):
    """One moving or glowing node of an effect, its origin at `pivot` (what it spins about)."""
    ob = model(name, mats, build, grad=(1.0, 1.0))
    ob.data.transform(Matrix.Translation(-V(pivot)))
    ob.location = pivot
    for k, v in extras.items():
        ob[k] = v
    return ob


def glow(name, colour, build, **extras):
    return part(name, {"Glow": colour}, build, **extras)


def light(name, colour, build, **extras):
    return part(name, {"Light": colour}, build, **extras)


def aura_hug(name, colour, path, radii, inflate=1.9, sides=6):
    """The aura round a thing: its main parts' path, each radius `inflate` times, closed at both ends."""
    def b(pc):
        pc.mat = "Aura"
        pc.tube([V(p) for p in path], [r * inflate for r in radii], sides=sides, tip=True, cap=True)
    return part(name, {"Aura": colour}, b)


def trail(width, at):
    """A part's trail: a ribbon `width` wide behind the point `at` (Blender, in the part's own space, from its pivot)."""
    return {"trail": width, "trailFrom": [at[0], at[2], -at[1]]}     # glTF is Y up; extras aren't converted on export


def particles(colour, sprite="glow", every=0.2, size=0.06, rise=0.3):
    return {"spark": colour, "sparkSprite": sprite, "sparkEvery": every, "sparkSize": size, "sparkRise": rise}


def sheet(name, kind, colour, verts, faces, uv=None, col=None, **extras):
    """One effect part from its own vertices and faces, its material `<name>_<kind>`; `uv` per vertex (as glTF reads it:
    v is flipped here, the exporter flips it back) and `col` per vertex (three numbers of data, exported as they are)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    if uv is not None:
        lay = me.uv_layers.new(name="UVMap")
        for li, loop in enumerate(me.loops):
            u, v = uv[loop.vertex_index]
            lay.data[li].uv = (u, 1.0 - v)
    a = me.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
    for i, c in enumerate(col or [(1.0, 1.0, 1.0)] * len(verts)):
        a.data[i].color = (*c, 1.0)
    me.color_attributes.active_color = a
    me.color_attributes.render_color_index = me.color_attributes.active_color_index
    me.materials.append(kit.material(f"{name}_{kind}", colour))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for k, v in extras.items():
        ob[k] = v
    return ob


def water(name, colour, rings, gate=None, cut=(), **extras):
    """The water's body through `rings` (each the same number of points, across it, one edge to the other), flowing
    from the first ring to the last. `gate` per ring: 0 as made, above 0 the grown water, shown only with strength
    (up to that share; library.ts `wrap`). No faces between ring i and the next for i in `cut` (strips of one part)."""
    n, verts, uv, col, faces = len(rings[0]), [], [], [], []
    mids = [V(r[len(r) // 2]) for r in rings]
    width = sum((V(r[0]) - V(r[-1])).length for r in rings) / len(rings)
    along = [0.0]
    for a, b in zip(mids, mids[1:]):
        along.append(along[-1] + (b - a).length)
    for i, r in enumerate(rings):
        for j, p in enumerate(r):
            verts.append(p)
            uv.append((j / (n - 1), along[i] / width))
            col.append((along[i] / along[-1], (gate or [0.0] * len(rings))[i], 0.0))
    for i in (i for i in range(len(rings) - 1) if i not in cut):
        for j in range(n - 1):
            faces.append((i * n + j, i * n + j + 1, (i + 1) * n + j + 1, (i + 1) * n + j))
    return sheet(name, "Water", colour, verts, faces, uv, col, **extras)


def foam(name, colour, verts, tris, depth, phase, crown, **extras):
    """Foam: `depth` per vertex (0 at its edge, 1 deep in it), and per vertex its `phase` and `crown` (how much it
    breaks and re-forms)."""
    col = [(d, phase[i] if isinstance(phase, list) else phase, crown[i] if isinstance(crown, list) else crown) for i, d in enumerate(depth)]
    return sheet(name, "Foam", colour, verts, tris, None, col, **extras)


def spray(name, colour, drops, **extras):
    """Drops: (centre, size, phase, speed, grown). Each a quad facing -Y, its corners in uv; RodAura turns it to you."""
    verts, uv, col, faces = [], [], [], []
    for c, size, phase, speed, grown in drops:
        c, k = V(c), len(verts)
        for cx, cz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(c + V((cx * size, 0, cz * size)))
            uv.append(((cx + 1) / 2, (cz + 1) / 2))
            col.append((phase, 0.5 + speed / 2 if grown else speed / 2, size / 0.05))
        faces.append((k, k + 1, k + 2, k + 3))
    return sheet(name, "Spray", colour, verts, faces, uv, col, **extras)


def export(objs, path, extras=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc = bpy.context.scene
    for k in list(sc.keys()):
        del sc[k]
    for k, v in (extras or {}).items():
        sc[k] = v
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False,
                              export_animations=False, export_extras=True)


# ================================================================ the Water type's sample: the Aquatic sword
def rnd(i, salt=0.0):
    return math.modf(abs(math.sin(i * 12.9898 + salt * 78.233)) * 43758.5453)[0]


def aquatic():
    """The 1:1 study of fx-aquatic-water-ref.png: the water blade (its rows' edges, traced), the foam (traced, a crown at
    the top), the loose drops (traced) with more that come with strength, and the murex shell hilt modelled to the
    reference's landmarks (lit, not part of the effect type)."""
    sys.path.insert(0, HERE)
    from traced_refs import AQUATIC as A
    s = A["scale"]
    px = lambda x, y: V(((x - 375) * s, 0, (1265 - y) * s))           # the reference's pixels, as traced
    # the blade, bottom up (the water runs up to its crash), bulging a little toward you
    rows = sorted(A["blade"], key=lambda r: r[2])
    rings = [[V((xl + (xr - xl) * j / 4, -0.1 * (xr - xl) * math.sin(math.pi * j / 4), z)) for j in range(5)] for xl, xr, z in rows]
    blade = water("Blade", "#1F759D", rings)
    pieces = []
    for i, pc in enumerate(A["foam"]):
        top = max(p[1] for p in pc["points"])
        pieces.append((pc, i, top))
    verts, tris, depth, phase, crown = [], [], [], [], []
    for pc, i, top in pieces:
        k = len(verts)
        verts += [V((x, -0.008 - 0.003 * d, z)) for (x, z), d in zip(pc["points"], pc["depth"])]
        tris += [tuple(k + j for j in t) for t in pc["tris"]]
        depth += pc["depth"]
        phase += [rnd(i, 1)] * len(pc["points"])
        crown += [min(1.0, max(0.3, (z - 0.8) / 0.12)) if top > 0.85 else 0.3 for x, z in pc["points"]]
    foam_ = foam("Foam", "#FBFEFD", verts, tris, depth, phase, crown)
    drops = [((x, -0.012, z), max(0.004, r * 1.3), rnd(i, 2), rnd(i, 3), False) for i, ((x, z), r) in enumerate(A["drops"])]
    for i in range(18):                         # more drops, thrown with strength: round the crown and the splash
        at = px(330 + 140 * rnd(i, 4), 70 + 120 * rnd(i, 5)) if i < 11 else px(420 + 90 * rnd(i, 4), 690 + 60 * rnd(i, 5))
        drops.append(((at.x, -0.012, at.z), 0.004 + 0.004 * rnd(i, 6), rnd(i, 7), rnd(i, 8), True))
    spray_ = spray("Drops", "#FBFEFD", drops)

    def shell(pc):
        # the spire: whorls stacked down from the apex, each flaring to a sharp shoulder, a spine off its left
        pc.mat = "Shell"
        whorls = [(772, 0), (792, 10), (812, 17), (836, 25), (862, 33), (893, 41), (930, 45), (968, 40), (995, 30)]
        a0, a1 = px(347, 772), px(331, 995)                 # the spire leans left as it comes down
        ax = (a1 - a0).normalized()
        h = lambda y: (y - 772) / (995 - 772) * (a1 - a0).length
        prof = [(0.0, 0.0)]
        for (y0, r0), (y1, r1) in zip(whorls, whorls[1:]):
            prof += [(r0 * 0.6 * s, h(y0)), (r1 * s, h(y1 - 3))]
        prof.append((0.0, h(1002)))
        lathe(pc, a0, prof, n=8, axis=tuple(ax))
        for (x, y) in ((290, 852), (269, 890), (264, 939), (304, 977), (302, 822), (318, 796)):
            tip = px(x, y)
            root = a0 + ax * ((tip.z - a0.z) / ax.z) + V((0, 0, 0.004))
            pc.tube([root, tip], [0.007, 0.0], sides=4, tip=False)
        # below the body whorl: the shell tapering down in rings
        lathe(pc, px(362, 990), [(0.0, 0.0)] + [(r * s, -(y - 990) * s) for y, r in ((990, 26), (1015, 24), (1020, 20), (1045, 18), (1050, 15), (1075, 12), (1092, 8))] + [(0.0, -0.085)], n=7)
        # the siphonal canal and its forked foot
        pc.tube([px(392, 1015), px(392, 1100), px(388, 1190)], [18 * s, 14 * s, 11 * s], sides=6, tip=False)
        for tx, ty in ((350, 1250), (366, 1258), (386, 1262), (401, 1254), (412, 1238)):
            pc.tube([px(388, 1188), px((388 + tx) / 2, (1188 + ty) / 2 - 4), px(tx, ty)], [8 * s, 4 * s, 0.0], sides=4, tip=False)
        # the lip: a cupped fan off the mouth, pink inside, its throat deep, with its spines
        c = px(388, 975) + V((0, 0.01, 0))
        rim = [(395, 870), (410, 856), (424, 880), (446, 890), (468, 883), (461, 906), (472, 928), (498, 946), (470, 957), (463, 982), (450, 1002), (428, 1016), (400, 1025)]
        outer = [px(x, y) + V((0, -0.02, 0)) for x, y in rim]
        inner = [c.lerp(p, 0.38) + V((0, 0.006, 0)) for p in outer]
        iv, ov = [pc.v(p) for p in inner], [pc.v(p) for p in outer]
        cv = pc.v(c)
        back = c + V((0, 0.05, 0))
        pc.mat = "Deep"
        for j in range(len(rim) - 1):
            pc.f([cv, iv[j], iv[j + 1]], back)
        pc.mat = "Pink"
        for j in range(len(rim) - 1):
            pc.f([iv[j], ov[j], ov[j + 1], iv[j + 1]], back)
    hilt = model("Shell", {"Shell": "#FBE3D4", "Pink": "#EDB4A0", "Deep": "#7A4A42"}, shell, grad=(0.82, 1.0))
    return [hilt, blade, foam_, spray_]


# ================================================================ the sample
def samples(only=None):
    """The Water type's sample for /lab/fx (every other type is drawn by code on any holder since round 10:
    components/game/fx/HolderFx.tsx)."""
    if only and "water" not in only:
        return
    export(aquatic(), os.path.join(PROPS, "fxlib-water.glb"), {})
    print("MODEL props/fxlib-water")


ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if __name__ == "__main__" and "samples" in ARGS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    i = ARGS.index("samples")
    samples(ARGS[i + 1].split(",") if len(ARGS) > i + 1 else None)
