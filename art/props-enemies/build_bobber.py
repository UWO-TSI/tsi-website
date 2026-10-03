"""The fishing bobber (specs/polish/fishing.md deliverable 3): a low-poly matte float in the tools' style.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/props-enemies/build_bobber.py [-- render <dir>]

Writes web/public/assets/game/tools/bobber.glb, drawn by the rig on the angler's rod (components/game/character/
FishingRig.tsx). World units, not the hand's (it rides on the water): about 0.18 across, the size the old sphere read
at from the follow camera. Blender Z up, the origin at the ball's middle: the rig floats it a few centimetres up, so
the cream belly sits under the water and the red cap rides above, as a float does. On top, the eye the line is tied to
(`line_eye` below; the rig hangs the line from it); underneath, the short stem the hook line runs down. Matte palette
colours with the shared top-light gradient (kit.material, roughness 0.9), faceted like the rods. With `render`, a
review sheet: the bobber alone at three angles, floating at its waterline, and beside the rods for scale.
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "art", "characters"))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from pe import lathe  # noqa: E402

OUT = os.path.join(ROOT, "web", "public", "assets", "game", "tools", "bobber.glb")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)

R = 0.088                     # the ball's radius
CAP, BELLY, BAND, EYE, STEM = "#D9534A", "#F4EEDF", "#3A2E22", "#EFE8D6", "#8C7B66"
# Where the line is tied (the eye's top), in glTF axes (y up): the rig hangs the line from here.
line_eye = (0.0, R + 0.03, 0.0)


def build(pc):
    # The ball, from the stem up: the cream belly, a thin dark band at the waist, the red cap. Eight sides, faceted.
    prof = [(0.014, -R - 0.004), (0.046, -R * 0.86), (0.072, -R * 0.56), (0.086, -R * 0.2), (R, -0.006), (R, 0.006),
            (0.085, R * 0.24), (0.07, R * 0.6), (0.044, R * 0.87), (0.016, R + 0.003)]

    def mat(band, quad):
        return "Belly" if band < 4 else "Band" if band == 4 else "Cap"
    lathe(pc, (0, 0, 0), prof, n=8, mat=mat)
    pc.mat = "Belly"
    lathe(pc, (0, 0, 0), [(0, -R - 0.004), (0.014, -R - 0.004)], n=8)            # closes the belly round the stem
    pc.mat = "Cap"
    lathe(pc, (0, 0, 0), [(0.016, R + 0.003), (0, R + 0.003)], n=8)             # closes the cap round the eye
    # The eye on top: a short post with a little cream ring the line is tied to.
    pc.mat = "Eye"
    pc.tube([(0, 0, R), (0, 0, R + 0.02)], [0.008, 0.007], sides=6, tip=False)
    pc.tube([(0, -0.009, R + 0.024), (0, 0, R + 0.031), (0, 0.009, R + 0.024)], [0.0045] * 3, sides=5, tip=False)
    # The stem underneath: the hook line runs down it into the water.
    pc.mat = "Stem"
    pc.tube([(0, 0, -R), (0, 0, -R - 0.045)], [0.007, 0.004], sides=5, tip=True)


mats = {k: kit.material(f"bobber_{k}", v) for k, v in (("Cap", CAP), ("Belly", BELLY), ("Band", BAND), ("Eye", EYE), ("Stem", STEM))}
pc = kit.Piece(region="torso", mat="Cap")
build(pc)
ob = pc.finish("bobber", None, mats, sharp=40, grad=(0.78, 1.0))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_skins=False, export_animations=False)
dims = ob.dimensions
print(f"MODEL tools/bobber tris={kit.ntris(ob)} size={dims.x:.3f}x{dims.y:.3f}x{dims.z:.3f} eye={line_eye}")

if "render" in ARGS:
    out = ARGS[ARGS.index("render") + 1]
    os.makedirs(out, exist_ok=True)
    sc = bpy.context.scene
    kit.render_setup(sc, (0.94, 0.91, 0.84, 1))
    sc.render.film_transparent = False
    kit.show_vertex_colors(sc)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 320, 320

    def shot(name, elev, azim, scale, centre=Vector((0, 0, 0))):
        e, a = math.radians(elev), math.radians(azim)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = centre + d * 4
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        cam.data.ortho_scale = scale
        sc.render.filepath = os.path.join(out, name)
        bpy.ops.render.render(write_still=True)

    for i, (elev, azim) in enumerate(((8, 0), (25, -35), (60, 20))):
        shot(f"bobber_{i}.png", elev, azim, 0.3, Vector((0, 0, 0.005)))
    # Floating: a water plane at the waterline (the rig's FLOAT under the ball's middle).
    bpy.ops.mesh.primitive_plane_add(size=0.8, location=(0, 0, -0.035))
    water = bpy.context.object
    wm = bpy.data.materials.new("Water")
    wb = next(n for n in wm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    wb.inputs["Base Color"].default_value = (0.16, 0.4, 0.55, 1)
    wb.inputs["Roughness"].default_value = 0.35
    wb.inputs["Alpha"].default_value = 0.82
    try:
        wm.surface_render_method = "BLENDED"
    except (AttributeError, TypeError):
        pass
    water.data.materials.append(wm)
    shot("bobber_floating.png", 22, -30, 0.42, Vector((0, 0, 0.0)))
    print("RENDER_OK", out)
