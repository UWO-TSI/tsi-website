"""The VFX library's Blender templates (David 2026-11-05: "make a mini effect library that organizes types of effects
and its a standard so future vfx or effects and r eference and take the template"). The types, their parameters and
what grows with strength are in web/lib/game/fx/library.ts; the standard is specs/vfx-library.md. A new effect copies
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
`flicker` (0 to 1, RodAura only: the library's Flicker type was deleted, VFX round 1). No halos: a disc of light round a
thing is what the library replaced (David: "the light coming off of it being circle isnt right").

These are imported by the builders (art/pipeline/build_rods.py); every library type is also drawn by code on any holder
(components/game/fx/HolderFx.tsx), and the Water type's study of the Aquatic sword is gone (VFX round 1, David: "take
the water texture and effect not the actual blade").
"""
import bpy, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
import kit  # noqa: E402

V = Vector


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
