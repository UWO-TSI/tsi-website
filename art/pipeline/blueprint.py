"""Step 4 of the tool pipeline (art/pipeline/tools.md): a concept turnaround sheet as modelling blueprints, and the
match check of the Blender model against them.

  Blender -b --factory-startup -P art/pipeline/blueprint.py -- --sheet <turnaround.png> --length 0.9 --out <dir>
      [--views front,side,back,three-quarter,top] [--mirror side] [--turn top=90] [--model <hd.glb>]

The sheet is one row of views on white, in --views order (the prompts in art/pipeline/prompts/ ask for exactly that).
It is split at the white gaps between views, each view is cropped to its ink, and the first view's longest side is set
to --length metres (GLB units), which fixes metres per pixel for every view (the prompts ask for one scale).
--mirror flips views drawn from the other side; --turn turns a view counterclockwise by quarter turns, so it matches
the model's camera: front from -Y, side from +X (front -Y on the left), back from +Y, top from +Z with +Y up. A fish
sheet (side, top, three-quarter, nose left) needs --turn top=90. Writes to <out>:
  <view>.png          the cropped view
  blueprint.json      metres per pixel, each view's size in metres, and its silhouette: for 64 slices bottom to top
                      (front, side, back) or back to front (top), the ink's left and right edge in metres from the
                      view's centre line. A modelling script reads these as lathe and tube profiles.
With --model (the Blender model, Z up, front -Y): renders it orthographically in front, side, back and top at the
blueprint's scale, aligned on the bounding boxes, and writes <view>-match.png (the model at 50% over the view) and
each view's silhouette overlap (intersection over union) into blueprint.json. Below about 0.8, keep modelling.
"""
import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument("--sheet", required=True)
p.add_argument("--length", type=float, required=True)
p.add_argument("--out", required=True)
p.add_argument("--views", default="front,side,back,three-quarter,top")
p.add_argument("--mirror", default="")
p.add_argument("--turn", default="")
p.add_argument("--model")
a = p.parse_args(sys.argv[sys.argv.index("--") + 1:])
os.makedirs(a.out, exist_ok=True)
views = a.views.split(",")
bpy.ops.wm.read_factory_settings(use_empty=True)


def pixels(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)                       # row 0 is the bottom


def ink(px):
    return (px[..., 3] > 0.1) & (px[..., :3].min(axis=2) < 0.9)


def save(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr, dtype=np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()


sheet = pixels(bpy.data.images.load(os.path.abspath(a.sheet)))
mask = ink(sheet)
cols = mask.any(axis=0)
runs, start, gap = [], None, max(4, sheet.shape[1] // 100)
for x, on in enumerate(np.append(cols, False)):
    if on and start is None:
        start = x
    if not on and start is not None and (x == len(cols) or not cols[x:x + gap].any()):
        runs.append((start, x))
        start = None
if len(runs) != len(views):
    sys.exit(f"blueprint: found {len(runs)} views in the sheet, expected {len(views)} ({a.views})")

crops = {}
for v, (x0, x1) in zip(views, runs):
    rows = np.where(mask[:, x0:x1].any(axis=1))[0]
    c = sheet[rows[0]:rows[-1] + 1, x0:x1].copy()
    if v in a.mirror.split(","):
        c = c[:, ::-1]
    turn = dict(t.split("=") for t in a.turn.split(",") if t).get(v)
    if turn:                                           # rows run bottom up here, so numpy's k is the other way round
        c = np.ascontiguousarray(np.rot90(c, -int(turn) // 90))
    crops[v] = c
mpp = a.length / max(crops[views[0]].shape[:2])

info = {"sheet": a.sheet, "length": a.length, "metres_per_pixel": mpp, "views": {}}
for v, c in crops.items():
    save(c, os.path.join(a.out, f"{v}.png"))
    m = ink(c)
    h, w = m.shape
    sil = []
    for s in range(64):
        band = m[int(h * s / 64):max(int(h * (s + 1) / 64), int(h * s / 64) + 1)]
        xs = np.where(band.any(axis=0))[0]
        sil.append([round((xs[0] - w / 2) * mpp, 4), round((xs[-1] + 1 - w / 2) * mpp, 4)] if len(xs) else None)
    info["views"][v] = {"file": f"{v}.png", "px": [w, h], "size": [round(w * mpp, 4), round(h * mpp, 4)], "silhouette": sil}

if a.model:
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(a.model))
    sc = bpy.context.scene
    for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
        try:
            sc.render.engine = e
            break
        except TypeError:
            pass
    sc.view_settings.view_transform = "Standard"
    sc.render.film_transparent = True
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    next(n for n in w.node_tree.nodes if n.type == "BACKGROUND").inputs[1].default_value = 1.0
    sc.world = w
    pts = [o.matrix_world @ vx.co for o in sc.objects if o.type == "MESH" for vx in o.data.vertices]
    lo = Vector((min(q.x for q in pts), min(q.y for q in pts), min(q.z for q in pts)))
    hi = Vector((max(q.x for q in pts), max(q.y for q in pts), max(q.z for q in pts)))
    mid = (lo + hi) / 2
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.clip_end = 100
    sc.collection.objects.link(cam)
    sc.camera = cam
    # view: (where the camera sits, its rotation), aligned on the model's bounding box: the bottom for upright views
    lay = {
        "front": (Vector((mid.x, lo.y - 5, lo.z)), (math.pi / 2, 0, 0)),
        "side": (Vector((hi.x + 5, mid.y, lo.z)), (math.pi / 2, 0, math.pi / 2)),
        "back": (Vector((mid.x, hi.y + 5, lo.z)), (math.pi / 2, 0, math.pi)),
        "top": (Vector((mid.x, mid.y, hi.z + 5)), (0, 0, 0)),
    }
    for v, (at, rot) in lay.items():
        if v not in crops:
            continue
        c = crops[v]
        h, wd = c.shape[:2]
        cam.rotation_euler = rot
        cam.data.ortho_scale = max(wd, h) * mpp
        cam.location = at + (Vector((0, 0, h * mpp / 2)) if v != "top" else Vector())
        sc.render.resolution_x, sc.render.resolution_y = wd, h
        path = os.path.join(a.out, f"_{v}-model.png")
        sc.render.filepath = path
        sc.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)
        r = pixels(bpy.data.images.load(path))
        os.remove(path)
        al = r[..., 3:4] * 0.5
        save(np.concatenate([c[..., :3] * (1 - al) + r[..., :3] * al, np.ones_like(al)], axis=2), os.path.join(a.out, f"{v}-match.png"))
        mi, mm = ink(c), r[..., 3] > 0.5
        iou = float((mi & mm).sum() / max(1, (mi | mm).sum()))
        info["views"][v]["iou"] = round(iou, 3)
        print(f"{v}: overlap {iou:.2f}")

with open(os.path.join(a.out, "blueprint.json"), "w") as f:
    json.dump(info, f, indent=1)
print(f"{a.out}: {len(crops)} views, {mpp * 1000:.3f} mm per pixel")
