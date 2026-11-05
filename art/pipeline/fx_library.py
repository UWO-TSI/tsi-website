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
Motion is extras on a part: `spin` (rad/s about its own up), `bob` (m) at `rate` (Hz), `pulse` (a share of its size),
`flicker` (0 to 1). No halos: a disc of light round a thing is what the library replaced (David: "the light coming off
of it being circle isnt right").

  Blender -b --factory-startup -P art/pipeline/fx_library.py -- samples
writes one sample effect per type, round a stand-in rod (z 0.06 to 0.76, rig units), to
web/public/assets/game/props/fxlib-<type>.glb for /lab/fx's previews.
"""
import bpy, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
import kit  # noqa: E402

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


# ================================================================ the samples, round a stand-in rod
def samples():
    """One effect per type round the stand-in rod, in one neutral sample colour, for the previews."""
    Z0, Z1, C, PALE = 0.06, 0.76, "#7FD8FF", "#CFF4FF"
    axis = [V((0, 0, Z0 + (Z1 - Z0) * k / 6)) for k in range(7)]
    rad = [0.012 - 0.006 * k / 6 for k in range(7)]

    def edge(pc):                                # glow: light along the blank's two edges and at its tip
        pc.mat = "Glow"
        for s in (-1, 1):
            pc.tube([p + V((s * r * 1.05, 0, 0)) for p, r in zip(axis, rad)], [0.0022] * 7, sides=3, tip=True)
        pc.blob((0, 0, Z1 + 0.02), 0.012, segs=6, rings=4)

    def orb(pc):                                 # pulse: an orb over the tip
        pc.mat = "Glow"
        pc.blob((0, 0, Z1 + 0.05), 0.02, segs=8, rings=6)

    def plates(pc):                              # motion: three plates orbiting the blank
        pc.mat = "Glow"
        for a, z in ((0.0, 0.6), (TAU / 3, 0.45), (2 * TAU / 3, 0.3)):
            c = V((math.cos(a) * 0.07, math.sin(a) * 0.07, z))
            pc.tube([c - V((0, 0, 0.004)), c + V((0, 0, 0.004))], [0.018, 0.018], sides=6, tip=False, cap=True)

    def bolt(pc):                                # flicker: a lightning bolt down the blank
        pc.mat = "Glow"
        pts = [V((0.03 * math.sin(i * 2.3), 0.02 * math.cos(i * 1.7), Z0 + 0.02 + (Z1 - Z0) * i / 11)) for i in range(12)]
        pc.tube(pts, [0.0028] * 12, sides=3, tip=True)

    def wisp(pc):                                # trail: a wisp of light orbiting the blank
        pc.mat = "Light"
        pc.blob((0.07, 0, 0.42), 0.008, segs=6, rings=4)

    # particles: no part of its own, only the motes; a hair-thin anchor spans the blank so they rise from all of it
    anchor = lambda: part("Anchor", {"Glow": C}, lambda pc: pc.tube([V((0, 0, Z0)), V((0, 0, Z1))], [0.0001, 0.0001], sides=3, tip=False))
    made = {
        "glow": ([glow("Edge", C, edge)], {}),
        "aura": ([aura_hug("Aura", C, axis, rad, inflate=2.4)], {}),
        "particles": ([anchor()], particles(PALE, "glow", 0.12, 0.06, 0.35)),
        "trail": ([light("Wisp", C, wisp, pivot=(0, 0, 0.42), spin=3.0, bob=0.03, rate=0.7, **trail(0.012, (0.07, 0, 0)))], {}),
        "pulse": ([glow("Orb", C, orb, pivot=(0, 0, Z1 + 0.05), pulse=0.12)], {}),
        "motion": ([glow("Plates", C, plates, pivot=(0, 0, 0.45), spin=1.2, bob=0.02, rate=0.8)], {}),
        "flicker": ([glow("Bolt", C, bolt, flicker=1.0)], {}),
    }
    for kind, (objs, extras) in made.items():
        export(objs, os.path.join(PROPS, f"fxlib-{kind}.glb"), extras)
        print(f"MODEL props/fxlib-{kind} tris={sum(kit.ntris(o) for o in objs if o.type == 'MESH')}")


if __name__ == "__main__" and "samples" in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    samples()
