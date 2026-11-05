"""The sushi bar's menu lying closed on the counter before your stool (tasting-book round 5, David: "make the menu on the
table actually our menu"; round 6: "book is better modeled more prominent in the center of the table"): the menu you pick up (components/game/peaceful/SushiSheets.tsx MenuPickup), closed. Its cover
is the game's own, shot from the showroom by sushi_menu_cover.mjs (art/buildings/sushi-menu-cover.png: the washi, the
black binding down its left edge, the name, the seal, the pagoda and plum in mist); David's references for the look are
specs/references/sushi-menu/ (a folded teahouse menu).

  node art/buildings/sushi_menu_cover.mjs            (a dev server on :3476)
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/build_sushi_menu.py
  cd web && node scripts/pack-glbs.mjs public/assets/game/buildings/sushi-bar-menu.glb
  (on the shared Mac mini: under withlock.sh blender, headless only; `-- review <png>` also renders it, workbench)

Writes game/buildings/sushi-bar-menu.glb in game units, the origin on the counter under the middle of the menu, the
cover's top edge toward -z (away from the stool; lib/game/sushiBar.ts menuAt places it). One box is shaped into one
mesh: the spine rounded where the binding wraps it, the open corners rounded, the boards' outer edges eased, and between
the two boards the page block set back a little on the three open sides and cut into leaves, so the pages show as a
lighter band with fine lines. The binding is cloth: its dark band wraps the spine from the cover round to the back, and
the stab binding's thread (yotsume toji, as the references' menu is bound) is real cord at each stitch the cover
prints, from its hole over the spine. One material (P_Cloth_Menu: paper's matte) with the cover printed on
top; the binding, the boards' edges, the pages and the thread take their colour from the cover's own paper and binding
through their UVs, tinted in COLOR_0. One draw.
"""
import os
import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
COVER = os.path.join(ROOT, "art", "buildings", "sushi-menu-cover.png")
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "buildings", "sushi-bar-menu.glb")

D = 0.40                      # top to bottom of the cover (game z; round 6: larger, so it reads from the stool)
H, BOARD = 0.017, 0.0036      # closed thickness; each board's
SPINE_R, CORNER_R, EASE = 0.0055, 0.008, 0.0009
PAGE_IN = 0.0026              # how far the page block sits back from the boards' edges
LEAVES = 4                    # the page block's fine lines
CORD = 0.0006                 # the thread's half thickness (it lies tight: a stab binding, not rings)
TEX = 1024                    # the cover's longer side in the texture
INK_DEPTH = (1.7, 0.9)        # the print's gamma and gain (see below)

bpy.ops.wm.read_factory_settings(use_empty=True)
img = bpy.data.images.load(COVER)
cw, ch = img.size
W = D * cw / ch
# Where the binding is (the cover's left edge, its darkest column) and a plain stretch of paper (the top right).
px = list(img.pixels)
def lum(x, y):
    i = 4 * (int(y) * cw + int(x))
    return px[i] + px[i + 1] + px[i + 2]
dark = [x for x in range(int(cw * 0.12)) if max(lum(x, ch * r) for r in (0.31, 0.47, 0.63)) < 0.5]
spine_u = (dark[len(dark) // 2] + 0.5) / cw
# The band's inner edge (the first paper column past it) and the stitches it prints (lighter runs down the band's inside).
band = next(x for x in range(dark[-1], int(cw * 0.12)) if min(lum(x, ch * r) for r in (0.31, 0.47, 0.63)) > 1.5)
hole = band - 3
rows = [y for y in range(8, ch - 8) if lum(hole, y) > lum(spine_u * cw, y) + 0.3]
stitches = []
for y in rows:
    if stitches and y == stitches[-1][1] + 1: stitches[-1][1] = y
    else: stitches.append([y, y])
STITCH_V = [1 - (a + b + 1) / 2 / ch for a, b in stitches]
hole_x = -W / 2 + W * (band - 2) / cw       # where the thread comes through, at the band's inner edge
band_x = -W / 2 + W * band / cw
PAPER_UV, SPINE_UV = (0.92, 0.95), (spine_u, 0.5)
# The counter's warm evening light and bloom wash a pale page out: the world's copy prints a little deeper (the ink
# darker against the paper, the paper a touch under white), so it still reads as the cover from the stool.
import numpy as np
a = np.array(px, dtype=np.float32).reshape(-1, 4)
a[:, :3] = INK_DEPTH[1] * a[:, :3] ** INK_DEPTH[0]
img.pixels.foreach_set(a.ravel())
if max(cw, ch) > TEX:
    img.scale(round(cw * TEX / max(cw, ch)), round(ch * TEX / max(cw, ch)))
img.file_format = "PNG"

# Blender is z-up: the menu's width along x, its top edge toward +y (the glTF's -z), its thickness along z.
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co.x, v.co.y, v.co.z = v.co.x * W, v.co.y * D, (v.co.z + 0.5) * H
bm.edges.ensure_lookup_table()
def edges(test):
    return [e for e in bm.edges if all(test(v.co) for v in e.verts)]
# The spine: the binding wraps the left edge round.
bmesh.ops.bevel(bm, geom=edges(lambda c: c.x < -W / 2 + 1e-6 and (c.z < 1e-6 or c.z > H - 1e-6)), offset=SPINE_R, segments=4, affect="EDGES", profile=0.5)
# The open corners, rounded as card is.
bmesh.ops.bevel(bm, geom=edges(lambda c: c.x > W / 2 - 1e-6 and abs(abs(c.y) - D / 2) < 1e-6), offset=CORNER_R, segments=3, affect="EDGES", profile=0.5)
# The boards' outer edges eased (not the spine's, already round), so their edges catch the light.
bmesh.ops.bevel(bm, geom=edges(lambda c: (c.z < 1e-6 or c.z > H - 1e-6) and c.x > -W / 2 + SPINE_R + 1e-4 and (abs(abs(c.y) - D / 2) < 1e-6 or c.x > W / 2 - CORNER_R - 1e-6)),
                offset=EASE, segments=1, affect="EDGES")
# Loop cuts round the sides at each board's inner face, a hair apart, and between them the leaves; then the page block set back.
LINE = 0.00035
inner = [BOARD + (H - 2 * BOARD) * (i + 1) / LEAVES for i in range(LEAVES - 1)]
for z in (BOARD - 0.0004, BOARD, *[z + d for z in inner for d in (0, LINE)], H - BOARD, H - BOARD + 0.0004):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))
for v in bm.verts:
    c = v.co
    if BOARD - 1e-5 < c.z < H - BOARD + 1e-5 and c.x > -W / 2 + SPINE_R + 1e-4:
        c.x = -W / 2 + (c.x + W / 2) * (W - PAGE_IN) / W
        c.y *= (D - 2 * PAGE_IN) / D
# The binding's band on the back, where it wraps round from the cover: a cut at its edge.
geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(band_x, 0, 0), plane_no=(1, 0, 0))

# UVs and COLOR_0, a face at a time: the cover printed on top, the rest from the cover's own paper and binding.
uv = bm.loops.layers.uv.new("UVMap")
col = bm.loops.layers.color.new("Col")
PAGES, LEAF, EDGE, WHITE, THREAD = (1, 0.99, 0.96, 1), (0.9, 0.87, 0.8, 1), (0.78, 0.73, 0.65, 1), (1, 1, 1, 1), (0.93, 0.9, 0.84, 1)
for f in bm.faces:
    c = f.calc_center_median()
    top = f.normal.z > 0.99 and c.z > H - 1e-5
    back = f.normal.z < -0.99 and c.x < band_x
    spine = c.x < -W / 2 + SPINE_R + 1e-4 or back
    pages = BOARD < c.z < H - BOARD and not spine
    leaf = pages and any(z < c.z < z + LINE for z in inner)
    for loop in f.loops:
        p = loop.vert.co
        if top:
            loop[uv].uv = ((p.x + W / 2) / W, (p.y + D / 2) / D)
        elif spine:
            loop[uv].uv = (SPINE_UV[0], (p.y + D / 2) / D)
        else:
            loop[uv].uv = PAPER_UV
        loop[col] = WHITE if top or spine else (LEAF if leaf else PAGES) if pages else EDGE

# The thread: at each stitch a cord from its hole on the cover, over the round spine to the back's edge (the back lies on
# the counter, unseen), a hair proud of it; its three outer sides only (the fourth lies on the cloth).
def cord_path(e):
    r, x0 = SPINE_R + e, -W / 2 + SPINE_R
    arc = lambda a0, a1, zc: [(x0 + r * math.cos(a), zc + r * math.sin(a)) for a in [a0 + (a1 - a0) * i / 2 for i in range(3)]]
    return [(hole_x, H + e), *arc(math.pi / 2, math.pi, H - SPINE_R), *arc(math.pi, 1.5 * math.pi, SPINE_R)]
import math
shell = bm.faces[:]
bmesh.ops.recalc_face_normals(bm, faces=shell)
for v in STITCH_V:
    y = -D / 2 + v * D
    rings = []
    for (xa, za), (xb, zb) in zip(cord_path(0.0002), cord_path(CORD * 1.6)):
        rings.append([bm.verts.new((x, y + dy, z)) for (x, z) in ((xa, za), (xb, zb)) for dy in (-CORD, CORD)])
    for a, b in zip(rings, rings[1:]):
        for i, j in ((1, 3), (3, 2), (2, 0)):
            f = bm.faces.new((a[i], a[j], b[j], b[i]))
            # Outward: away from the cord's inner line (between its two inner corners), as the shell's faces are.
            mid = (a[0].co + a[1].co + b[0].co + b[1].co) / 4
            f.normal_update()
            if f.normal.dot(f.calc_center_median() - mid) < 0: f.normal_flip()
            for loop in f.loops:
                loop[uv].uv = PAPER_UV
                loop[col] = THREAD
mesh = bpy.data.meshes.new("sushi-bar-menu")
bm.to_mesh(mesh)
bm.free()
for poly in mesh.polygons:
    poly.use_smooth = False
ob = bpy.data.objects.new("sushi-bar-menu", mesh)
bpy.context.scene.collection.objects.link(ob)

mat = bpy.data.materials.new("P_Cloth_Menu")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
tex = nodes.new("ShaderNodeTexImage")
tex.image = img
tex.interpolation = "Linear"
mat.node_tree.links.new(tex.outputs[0], bsdf.inputs[0])
bsdf.inputs["Roughness"].default_value = 1.0
bsdf.inputs["Metallic"].default_value = 0.0
mesh.materials.append(mat)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_texcoords=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                          export_skins=False, export_animations=False, export_image_format="JPEG",
                          export_jpeg_quality=90, export_materials="EXPORT")
tris = sum(len(p.vertices) - 2 for p in mesh.polygons)
print(f"EXPORT {OUT} tris={tris} size={W:.3f}x{D:.3f}x{H:.3f} spine_u={spine_u:.3f} stitches={len(STITCH_V)} texture={img.size[0]}x{img.size[1]} bytes={os.path.getsize(OUT)}")

if "review" in os.sys.argv:
    import math
    shot = os.sys.argv[os.sys.argv.index("review") + 1]
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.display.shading.show_shadows = True
    scene.render.resolution_x, scene.render.resolution_y = 900, 700
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    world.color = (0.55, 0.42, 0.3)
    scene.world = world
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50
    # From the stool, then low from the open corner (the page block, the eased edges) and the spine (the binding).
    for name, loc, rot in (("", (0.0, -0.5, 0.42), (50, 0, 0)), ("-pages", (0.3, -0.34, 0.07), (80, 0, 42)), ("-spine", (-0.3, -0.2, 0.09), (76, 0, -58))):
        cam.location = loc
        cam.rotation_euler = tuple(math.radians(a) for a in rot)
        scene.render.filepath = shot.replace(".png", f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("REVIEW", scene.render.filepath)
