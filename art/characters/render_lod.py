"""Full and LOD 1 side by side (specs/perf/2026-10-results.md): every GLB build_lod.py decimates, in its rest pose
from the front, the full one on the left of each pair and lod1/'s on the right, rendered far larger than the engine
ever draws LOD 1 (Workbench, studio light, so the facets read).

    /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/render_lod.py -- out.png [glob]
"""
import bpy, fnmatch, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "/tmp/lod-compare.png"
PATTERN = ARGS[1] if len(ARGS) > 1 else "*"
LOD = json.load(open(os.path.join(HERE, "lod1", "lod.json")))
COLS = 8
CELL = (1.5, 1.2)  # a pair's width and height (rig units)


def meshes_of(path, skin_only=False):
    """Import a GLB and return its meshes in the rest pose (armatures dropped), the skin alone for the base."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    out, other = [], [o for o in new if o.type != "MESH"]
    for o in new:
        if o.type != "MESH":
            continue
        for m in list(o.modifiers):
            o.modifiers.remove(m)
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
        if skin_only and not any(s.material and s.material.name == "M_Skin" for s in o.material_slots):
            bpy.data.objects.remove(o)
            continue
        out.append(o)
    for o in other:
        bpy.data.objects.remove(o)
    return out


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    names = [k for k in LOD if fnmatch.fnmatch(k, PATTERN)]
    for i, rel in enumerate(names):
        cx, cy = (i % COLS) * CELL[0], -(i // COLS) * CELL[1]
        base = rel.startswith("base/")
        full = os.path.join(HERE, "base/v7_clips.glb") if base else os.path.join(HERE, rel)
        for k, (path, x) in enumerate(((full, cx - 0.33), (os.path.join(HERE, "lod1", rel), cx + 0.33))):
            for o in meshes_of(path, skin_only=base and k == 0):
                o.location.x += x
                o.location.z += cy
        txt = bpy.data.curves.new(f"t{i}", "FONT")
        txt.body = f"{rel.split('/')[-1][:-4]}  {LOD[rel]['tris']} -> {LOD[rel]['lod1']}"
        txt.size = 0.07
        t = bpy.data.objects.new(f"t{i}", txt)
        t.location = (cx - 0.65, -0.3, cy - 0.12)
        t.rotation_euler = (math.radians(90), 0, 0)
        bpy.context.scene.collection.objects.link(t)
    rows = math.ceil(len(names) / COLS)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 2400
    scene.render.resolution_y = int(2400 * rows * CELL[1] / (COLS * CELL[0]))
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = COLS * CELL[0]
    cam.location = ((COLS - 1) * CELL[0] / 2, -5.0, -(rows - 1) * CELL[1] / 2 + 0.5)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam
    scene.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print("wrote", OUT, len(names))


main()
