"""Step 1 of the tool pipeline (art/pipeline/tools.md): profile our own models. Any GLBs in, for each one five
orthographic views (front, side, back, top, three-quarter) on a transparent background and a dimensions JSON out.
Every model of one run shares one scale (pixels per metre), so a family's renders compare like for like.

  Blender -b --factory-startup -P art/pipeline/profile.py -- --out art/pipeline/out/rods [--px 480] [--fit]
      [--scale 1.3] <a.glb> [<b.glb>[@x90] ...]

--px is the pixels for the run's longest model side. --fit frames each model on its own instead (fish, whose GLBs are
not to one scale). --scale turns GLB metres into game units (held tools and weapons are children of the character,
CHARACTER_SCALE 1.3). Blender Z is up and the character's front is -Y (build_tools.py), so "front" looks from -Y.
Writes <out>/<name>-<view>.webp and <out>/<name>.json; art/pipeline/collage.py lays them out.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

p = argparse.ArgumentParser()
p.add_argument("--out", required=True)
p.add_argument("--px", type=int, default=480)
p.add_argument("--fit", action="store_true")
p.add_argument("--scale", type=float, default=1.3)
p.add_argument("glbs", nargs="+")
a = p.parse_args(sys.argv[sys.argv.index("--") + 1:])
os.makedirs(a.out, exist_ok=True)

# view: (direction the camera looks from, camera up)
VIEWS = {
    "front": (Vector((0, -1, 0)), Vector((0, 0, 1))),
    "side": (Vector((1, 0, 0)), Vector((0, 0, 1))),
    "back": (Vector((0, 1, 0)), Vector((0, 0, 1))),
    "top": (Vector((0, 0, 1)), Vector((0, 1, 0))),
    "three-quarter": (Vector((-1, -1, 0.8)).normalized(), Vector((0, 0, 1))),
}


def basis(d, up):
    right = up.cross(d).normalized()
    return right, d.cross(right).normalized()


def load(path):
    path, _, turn = path.partition("@")              # a.glb@x90: turn it 90 degrees about X first (models stored on their side)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    if turn:
        r = Matrix.Rotation(math.radians(float(turn[1:])), 4, turn[0].upper())
        for o in bpy.context.scene.objects:
            if not o.parent:
                o.matrix_world = r @ o.matrix_world
        bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts, faces, parts, tris, prims = [], [], {}, 0, 0
    for o in bpy.context.scene.objects:
        if o.type != "MESH" or not o.data.materials:   # material-less helpers (the raw fish carry a stray icosphere)
            continue
        me = o.evaluated_get(dg).to_mesh()
        co = [o.matrix_world @ v.co for v in me.vertices]
        pts += co
        used = set()
        for f in me.polygons:
            n = len(f.vertices) - 2
            tris += n
            slot = o.material_slots[f.material_index].material if o.material_slots else None
            key = (slot.name if slot else "none").split("_", 1)[-1]
            used.add(key)
            faces.append([co[i] for i in f.vertices])
            parts.setdefault(key, []).append(faces[-1])
        prims += max(1, len(used))
        o.evaluated_get(dg).to_mesh_clear()
    return pts, faces, parts, tris, prims


def box(pts):
    lo = Vector((min(v.x for v in pts), min(v.y for v in pts), min(v.z for v in pts)))
    hi = Vector((max(v.x for v in pts), max(v.y for v in pts), max(v.z for v in pts)))
    return lo, hi


def r4(v):
    return [round(x, 4) for x in v]


# Pass 1: measure every model, and the run's largest extent per view (the shared frame).
models, frame = [], {k: [0.0, 0.0] for k in VIEWS}
for path in a.glbs:
    pts, faces, parts, tris, prims = load(path)
    lo, hi = box(pts)
    size = hi - lo
    axis = max(range(3), key=lambda i: size[i])
    proj = {}
    for k, (d, up) in VIEWS.items():
        right, u = basis(d, up)
        xs, ys = [v.dot(right) for v in pts], [v.dot(u) for v in pts]
        proj[k] = (min(xs), max(xs), min(ys), max(ys))
        frame[k][0] = max(frame[k][0], max(xs) - min(xs))
        frame[k][1] = max(frame[k][1], max(ys) - min(ys))
    L = size[axis]
    other = [i for i in range(3) if i != axis]
    profile = []                                      # the cross-section's extents in ten slices along the long axis
    for s in range(10):
        a0, a1 = lo[axis] + L * s / 10, lo[axis] + L * (s + 1) / 10
        sl = [v for f in faces if min(v[axis] for v in f) <= a1 and max(v[axis] for v in f) >= a0 for v in f]
        profile.append([round(max(v[i] for v in sl) - min(v[i] for v in sl), 4) if sl else 0 for i in other])
    part = {}
    for k, fs in parts.items():
        # a material can sit in several places (the lighthouse's reel gold is also its finial): split it where it
        # leaves a gap along the long axis, measure the biggest group, list the others' spans
        fs = sorted(fs, key=lambda f: min(v[axis] for v in f))
        groups = []
        for f in fs:
            if groups and min(v[axis] for v in f) <= groups[-1][1] + 0.03 * L:
                groups[-1][1] = max(groups[-1][1], max(v[axis] for v in f))
                groups[-1][2].append(f)
            else:
                groups.append([min(v[axis] for v in f), max(v[axis] for v in f), [f]])
        main = max(groups, key=lambda g: len(g[2]))
        plo, phi = box([v for f in main[2] for v in f])
        part[k] = {"tris": sum(len(f) - 2 for f in fs), "min": r4(plo), "max": r4(phi), "size": r4(phi - plo),
                   "span": round((phi[axis] - plo[axis]) / L, 3), "from": round((plo[axis] - lo[axis]) / L, 3),
                   "also": [[round((g[0] - lo[axis]) / L, 3), round((g[1] - lo[axis]) / L, 3)] for g in groups if g is not main]}
    textures = sorted({tuple(im.size) for im in bpy.data.images if im.size[0]}, reverse=True)
    name = os.path.basename(path.partition("@")[0]).removesuffix(".glb")
    models.append(dict(name=name, index=len(models), file=path, axis="XYZ"[axis], length=round(L, 4), size=r4(size), min=r4(lo),
                       max=r4(hi), game_scale=a.scale, game_length=round(L * a.scale, 4), tris=tris,
                       primitives=prims, materials=len(parts), textures=[list(t) for t in textures],
                       profile=profile, parts=part, proj=proj))

longest = max(max(f) for f in frame.values())


def engine():
    sc = bpy.context.scene
    for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
        try:
            sc.render.engine = e
            return
        except TypeError:
            pass


# Pass 2: render. Plain light: a soft white world and one sun from the upper front, colours untouched (Standard).
for m in models:
    load(m["file"])  # fresh scene per model
    sc = bpy.context.scene
    engine()
    sc.view_settings.view_transform = "Standard"
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 90
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = 0.9
    sc.world = w
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.2
    sun.rotation_euler = (math.radians(40), 0, math.radians(-25))
    sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    sc.collection.objects.link(cam)
    sc.camera = cam
    m["views"] = {}
    for k, (d, up) in VIEWS.items():
        x0, x1, y0, y1 = m["proj"][k]
        fw, fh = (x1 - x0, y1 - y0) if a.fit else frame[k]
        fw, fh = fw * 1.06 + 0.004, fh * 1.06 + 0.004  # a small margin
        ppm = a.px / (max(x1 - x0, y1 - y0) if a.fit else longest)
        right, u = basis(d, up)
        c = right * (x0 + x1) / 2 + u * (y0 + y1) / 2
        cam.location = c + d * 10
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        if up.z == 0:                                   # the top view: keep +Y up in the frame
            cam.rotation_euler = (0, 0, 0)
        cam.data.ortho_scale = max(fw, fh)
        cam.data.clip_end = 100
        sc.render.resolution_x, sc.render.resolution_y = max(8, round(fw * ppm)), max(8, round(fh * ppm))
        sc.render.filepath = os.path.join(a.out, f"{m['name']}-{k}.webp")
        bpy.ops.render.render(write_still=True)
        m["views"][k] = {"file": f"{m['name']}-{k}.webp", "ppm": round(ppm, 2),
                         "frame": [round(fw, 4), round(fh, 4)], "centre": [round((x0 + x1) / 2, 4), round((y0 + y1) / 2, 4)]}
    with open(os.path.join(a.out, f"{m['name']}.json"), "w") as fh_:
        json.dump(m, fh_, indent=1)
    print(f"{m['name']}: {m['length']} m long ({m['axis']}), {m['tris']} tris, {m['materials']} materials")
