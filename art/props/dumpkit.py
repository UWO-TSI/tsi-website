"""Light retouches of ACNH dump models that David chose to keep (specs/art-direction-oct17.md, row 314: "keep the old
where ours isn't clearly better ... tweak it lightly"): load the dump GLB as it shipped, change only what the retouch
names (a texture region repainted in numpy, vertex colours, a part removed or repeated), and export it as our file.

The source is the dump file in web/public/assets/acnh/ when it is still there, else the copy in git at DUMP_COMMIT
(the last commit that shipped it), so a rebuild writes the same model. Textures are numpy arrays [h, w, 3|4], float
sRGB, row 0 at the top (propkit's convention).
"""
import os, subprocess, tempfile
import bpy, bmesh
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
DUMP_COMMIT = "f3ce4695"


def dump_path(rel):
    """The dump GLB `rel` (under web/public/assets/acnh/): the shipped file, else extracted from git."""
    live = os.path.join(ROOT, "web", "public", "assets", "acnh", rel)
    if os.path.exists(live):
        return live
    out = os.path.join(tempfile.mkdtemp(prefix="dump-"), os.path.basename(rel))
    with open(out, "wb") as f:
        f.write(subprocess.check_output(["git", "-C", ROOT, "show", f"{DUMP_COMMIT}:web/public/assets/acnh/{rel}"]))
    return out


def load(rel):
    """A fresh scene holding the dump model's meshes (their transforms applied)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=dump_path(rel))
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obs


def pixels(img):
    """An image's pixels as [h, w, 4] float, row 0 at the top."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[::-1].copy()


def set_pixels(img, arr):
    """Write [h, w, 3|4] float (row 0 at the top) back into the image and pack it."""
    h, w = arr.shape[:2]
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :arr.shape[2]] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(px[::-1].ravel())
    img.update()
    img.pack()


def images_of(obs):
    """{material name: its base-colour image} for these objects."""
    out = {}
    for o in obs:
        for m in o.data.materials:
            if m and m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image:
                        out[m.name] = n.image
    return out


def scale_all(obs, s):
    for o in obs:
        o.scale = (s, s, s)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def islands(ob):
    """Loose parts of a mesh: lists of face indices, connected through shared vertices."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, part = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            part.append(g.index)
            for v in g.verts:
                for h in v.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        out.append(part)
    bm.free()
    return out


def export(obs, path, fmt="JPEG"):
    """A static GLB of these objects at web/public/assets/<path> (vertex colours when a mesh has them)."""
    full = os.path.join(ROOT, "web", "public", "assets", path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    has_col = any(len(o.data.color_attributes) for o in obs)
    bpy.ops.export_scene.gltf(filepath=full, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_texcoords=True, export_vertex_color="ACTIVE" if has_col else "NONE",
                              export_all_vertex_colors=False, export_skins=False, export_animations=False,
                              export_image_format=fmt, export_jpeg_quality=90, export_materials="EXPORT")
    tris = sum(len(p.vertices) - 2 for o in obs for p in o.data.polygons)
    print(f"EXPORT {path} tris={tris} mats={sorted({m.name for o in obs for m in o.data.materials if m})} bytes={os.path.getsize(full)}")
    return full
