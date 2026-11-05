"""The sushi bar's menu lying closed on the counter before your stool (tasting-book round 5, David: "make the menu on the
table actually our menu"): the menu you pick up (components/game/peaceful/SushiSheets.tsx MenuPickup), closed. Its cover
is the game's own, shot from the showroom by sushi_menu_cover.mjs (art/buildings/sushi-menu-cover.png: the washi, the
black binding down its left edge, the name, the seal, the pagoda and plum in mist); David's references for the look are
specs/references/sushi-menu/ (a folded teahouse menu).

  node art/buildings/sushi_menu_cover.mjs            (a dev server on :3476)
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/buildings/build_sushi_menu.py
  cd web && node scripts/pack-glbs.mjs public/assets/game/buildings/sushi-bar-menu.glb
  (on the shared Mac mini: under withlock.sh blender, headless only; `-- review <png>` also renders it, workbench)

Writes game/buildings/sushi-bar-menu.glb in game units, the origin on the counter under the middle of the menu, the
cover's top edge toward -z (away from the stool; lib/game/sushiBar.ts menuAt places it). One box is shaped into one
mesh: the spine rounded where the binding wraps it, the open corners rounded, and between the two boards the page block
set back a little on the three open sides, so the pages show as a lighter band. One material (P_Cloth_Menu: paper's
matte) with the cover printed on top; the binding, the boards' edges and the pages take their colour from the cover's own
paper and binding through their UVs, the pages a touch warmer and the boards' edges a touch darker in COLOR_0. One draw.
"""
import os
import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
COVER = os.path.join(ROOT, "art", "buildings", "sushi-menu-cover.png")
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "buildings", "sushi-bar-menu.glb")

D = 0.34                      # top to bottom of the cover (game z)
H, BOARD = 0.012, 0.0028      # closed thickness; each board's
SPINE_R, CORNER_R = 0.004, 0.007
PAGE_IN = 0.0022              # how far the page block sits back from the boards' edges
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
# Loop cuts round the sides at each board's inner face, a hair apart, then the page block between them set back.
for z in (BOARD - 0.0004, BOARD, H - BOARD, H - BOARD + 0.0004):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))
for v in bm.verts:
    c = v.co
    if BOARD - 1e-5 < c.z < H - BOARD + 1e-5 and c.x > -W / 2 + SPINE_R + 1e-4:
        c.x = -W / 2 + (c.x + W / 2) * (W - PAGE_IN) / W
        c.y *= (D - 2 * PAGE_IN) / D

# UVs and COLOR_0, a face at a time: the cover printed on top, the rest from the cover's own paper and binding.
uv = bm.loops.layers.uv.new("UVMap")
col = bm.loops.layers.color.new("Col")
PAGES, EDGE, WHITE = (1, 0.99, 0.96, 1), (0.84, 0.8, 0.73, 1), (1, 1, 1, 1)
for f in bm.faces:
    c = f.calc_center_median()
    top = f.normal.z > 0.99 and c.z > H - 1e-5
    spine = c.x < -W / 2 + SPINE_R + 1e-4
    pages = BOARD < c.z < H - BOARD and not spine
    for loop in f.loops:
        p = loop.vert.co
        if top:
            loop[uv].uv = ((p.x + W / 2) / W, (p.y + D / 2) / D)
        elif spine:
            loop[uv].uv = (SPINE_UV[0], (p.y + D / 2) / D)
        else:
            loop[uv].uv = PAPER_UV
        loop[col] = WHITE if top or spine else PAGES if pages else EDGE
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
print(f"EXPORT {OUT} tris={tris} size={W:.3f}x{D:.3f}x{H:.3f} spine_u={spine_u:.3f} texture={img.size[0]}x{img.size[1]} bytes={os.path.getsize(OUT)}")

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
    cam.location = (0.05, -0.42, 0.34)
    cam.rotation_euler = (math.radians(50), 0, math.radians(6))
    cam.data.lens = 50
    scene.camera = cam
    scene.render.filepath = shot
    bpy.ops.render.render(write_still=True)
    print("REVIEW", shot)
