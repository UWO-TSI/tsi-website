"""A small decorative fish for the shallows (specs/v1-drop.md §8c.6, v1 water item 6). Scenery: drawn instanced, many
to a draw (components/game/water/DecorativeFish.tsx), tinted per school, its tail swung in the shader.

Style target (David, references/look/2026-10-13/water-clarity-palette-ref.png): small dark-backed fish gliding over a
clear bed. Our own model, built here; nothing is copied.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/water/build_fish.py

Writes web/public/assets/game/water/fish.glb: one mesh, one white matte material (the engine tints it). Frame: game
units, the nose along +z at z +0.11, the tail fin's tip at z -0.12, its middle at the origin; flat-shaded facets.
"""
import bmesh, bpy, math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cafe"))
import cafekit as K  # noqa: E402
from cafekit import G, Mat  # noqa: E402

TAU = math.tau
K.OUT = os.path.join(K.ROOT, "web", "public", "assets", "game", "water")


def build():
    K.reset()
    mat = Mat("M_Fish", "#f2f2f2", 1.0)
    bm = bmesh.new()
    # The body: rings along z, an oval section (tall, narrow), fuller toward the head, closing to points at both ends.
    sections = [(0.11, 0.0, 0.0), (0.085, 0.018, 0.026), (0.04, 0.026, 0.038), (-0.01, 0.022, 0.033), (-0.05, 0.012, 0.02), (-0.07, 0.006, 0.01)]
    sides = 6
    rings = []
    for z, w, h in sections:
        if w == 0:
            rings.append([bm.verts.new(G(0, 0.002, z))])
            continue
        rings.append([bm.verts.new(G(math.sin(TAU * j / sides) * w, math.cos(TAU * j / sides) * h + 0.002, z)) for j in range(sides)])
    for j in range(sides):
        bm.faces.new([rings[0][0], rings[1][(j + 1) % sides], rings[1][j]])
    for i in range(1, len(rings) - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            bm.faces.new([rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]])
    tail_end = bm.verts.new(G(0, 0.002, -0.075))
    for j in range(sides):
        bm.faces.new([rings[-1][j], rings[-1][(j + 1) % sides], tail_end])
    # The tail fin: a forked fan off the tail, flat across x (it swings side to side).
    root = bm.verts.new(G(0, 0.002, -0.068))
    top, mid, bot = bm.verts.new(G(0, 0.034, -0.12)), bm.verts.new(G(0, 0.004, -0.098)), bm.verts.new(G(0, -0.028, -0.118))
    bm.faces.new([root, top, mid])
    bm.faces.new([root, mid, bot])
    # A dorsal fin along the back.
    d0, d1, d2 = bm.verts.new(G(0, 0.03, 0.03)), bm.verts.new(G(0, 0.052, -0.005)), bm.verts.new(G(0, 0.022, -0.03))
    bm.faces.new([d0, d1, d2])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    sharp = [e for e in bm.edges if len(e.link_faces) != 2 or math.degrees(e.link_faces[0].normal.angle(e.link_faces[1].normal, 0.0)) > 20]
    bmesh.ops.split_edges(bm, edges=sharp)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        f.smooth = True
        for lp in f.loops:
            lp[uv].uv = (0.5, 0.5)
    me = bpy.data.meshes.new("fish")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat.m)
    ob = bpy.data.objects.new("fish", me)
    bpy.context.scene.collection.objects.link(ob)
    K.export([ob], "fish")


if __name__ == "__main__":
    build()
