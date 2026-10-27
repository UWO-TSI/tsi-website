"""Before and after renders for David's review (game/remodel): the old model and ours, each alone, under the SAME camera
and light (framed on both together, so their sizes compare truly), in EEVEE on the asset audit's cream ground.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/remodel/review.py -- <spec.json> <out-dir> [ids]

spec.json: [{ "id", "old": [part], "new": [part], "views": [[az, el], ...], "size": 520 }], part = { "path" (under
web/public/assets), "scale", "rot": [x, y, z] degrees in game axes (applied x, then y, then z), "at": [x, y, z] game }.
Writes <out-dir>/<id>-before.png and <id>-after.png (the views side by side) and prints each side's triangles.
"""
import json, math, os, sys
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "props"))
import propkit as K  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
spec_file, out_dir = ARGS[0], ARGS[1]
only = ARGS[2].split(",") if len(ARGS) > 2 else None
ASSETS = os.path.join(K.ROOT, "web", "public", "assets")


def load(part):
    """Import one GLB, rig baked at rest, placed by its part's scale, turn and offset (game axes)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, part["path"].lstrip("/").removeprefix("assets/")))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=m.name)
        o.parent = None
        o.matrix_world = mw
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    rx, ry, rz = (math.radians(a) for a in part.get("rot", (0, 0, 0)))
    # game axes -> Blender: x -> x, y -> z, z -> -y
    R = (Matrix.Rotation(rz, 4, "Y") @ Matrix.Rotation(ry, 4, "Z") @ Matrix.Rotation(rx, 4, "X"))
    s = part.get("scale", 1.0)
    at = K.G(*part.get("at", (0, 0, 0)))
    M = Matrix.Translation(at) @ R @ Matrix.Scale(s, 4)
    for o in meshes:
        o.matrix_world = M @ o.matrix_world
        if not o.data.color_attributes:
            continue
        o.data.color_attributes.active_color = o.data.color_attributes[0]
        o.data.color_attributes[0].name = "Color"
    return meshes


def render(obs, frame_obs, base, views, size):
    sc = bpy.context.scene
    sc.render.film_transparent = False
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.hide_render = o not in obs
    pts = [o.matrix_world @ Vector(b) for o in frame_obs for b in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, rad = (lo + hi) / 2, max((hi - lo).length / 2, 0.05)
    co = sc.camera
    fov = 2 * math.atan(18 / co.data.lens)
    frames = []
    for i, (az, el) in enumerate(views):
        a, e = math.radians(az), math.radians(el)
        gdir = Vector((math.sin(a) * math.cos(e), math.sin(e), -math.cos(a) * math.cos(e)))
        co.location = centre + K.G(*gdir) * (rad / math.sin(fov / 2) * 0.86)
        co.rotation_euler = (centre - co.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{base}.{i}.png"
        bpy.ops.render.render(write_still=True)
        frames.append(sc.render.filepath)
    return frames


def stage(size):
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    try:
        sc.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (*K.lin("#f4efe3"), 1)
    bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy, sun.color = 2.6, (1.0, 0.95, 0.88)
    so = bpy.data.objects.new("Key", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cam = bpy.data.cameras.new("C")
    cam.lens = 50
    co = bpy.data.objects.new("C", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    sc.render.resolution_x = sc.render.resolution_y = size


def sheet(frames, out):
    """The views side by side in one PNG."""
    imgs = [bpy.data.images.load(f) for f in frames]
    w, h = imgs[0].size
    import numpy as np
    canvas = np.zeros((h, w * len(imgs), 4), dtype=np.float32)
    for i, im in enumerate(imgs):
        px = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        canvas[:, i * w:(i + 1) * w] = px.reshape(h, w, 4)
    o = bpy.data.images.new("sheet", w * len(imgs), h)
    o.pixels.foreach_set(canvas.ravel())
    o.filepath_raw, o.file_format = out, "PNG"
    o.save()
    for f in frames:
        os.remove(f)


def tris(obs):
    return sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons)


if __name__ == "__main__":
    os.makedirs(out_dir, exist_ok=True)
    for item in json.load(open(spec_file)):
        if only and item["id"] not in only:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        size = item.get("size", 520)
        stage(size)
        old = [o for p in item["old"] for o in load(p)]
        new = [o for p in item["new"] for o in load(p)]
        K.show_vertex_colors([o for o in old + new if o.data.color_attributes])
        views = item.get("views", [[30, 20], [210, 20]])
        for side, obs in (("before", old), ("after", new)):
            frames = render(obs, old + new, os.path.join(out_dir, f"{item['id']}-{side}"), views, size)
            sheet(frames, os.path.join(out_dir, f"{item['id']}-{side}.png"))
        print("REVIEW", item["id"], "tris", tris(old), "->", tris(new))
