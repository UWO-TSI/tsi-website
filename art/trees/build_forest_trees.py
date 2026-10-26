"""Single low-poly forest trees for the closed forest (terrain v3, game/village-art2; David, R2c 2026-10-26, the forest:
"tree is still fucked up and weird, theres a bunch of clumps and wtv super stretched trees, i just need a low render for
performance that also looks like busy forest over there but also look natural, cuz theyre not walking there its closed
off"). terrain-v3 drops the masses and instances many single trees from a few variants, each at its own uniform scale,
turn, tint and ground height. The village's .lod1 trees are leaf-card crowns about 3 tall and as wide (a village tree's
proportions, near a thousand triangles each); these are forest trees: tall, natural proportions, one to three hundred
triangles, made by the forest masses' own tree makers (build_forest_masses.py: tiered cedars and firs with fingered
hems, broadleaf crowns of lumped domes) so the forest keeps the look the masses had, one tree at a time.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/trees/build_forest_trees.py [-- names...] [-- review <dir>]

Writes web/public/assets/game/plants/forest-tree-<name>.glb, glTF y up, the trunk's foot at the origin on the ground (the
trunk runs SINK under it, so a tree on a slope sinks in instead of standing on a stilt), at scale 1, then
web/scripts/finish-greenery.mjs. Two draws each: the crown on the masses' needle texture (mForestNeedles) and the bark.
  cedar      a broad tiered cedar, four tiers, about 7.5 tall and 3.7 across
  fir        a tall narrow fir, five tiers, about 10 tall and 2.4 across
  broadleaf  a round broadleaf crown of lumped domes on a short bole, about 5.4 tall and 4.5 across
  young      a young conifer, three tiers, about 3.4 tall
Seeded: a rebuild writes the same models.
"""
import os, random, subprocess, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import greenery_kit as K  # noqa: E402
from build_forest_masses import BARK, broadleaf, conifer, mass_image  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SINK = 0.8
GREY = (1.0, 1.0, 1.0)
# name: (kind, height, crown radius, tiers, segments, base share, trunk radius, tint, seed)
TREES = {
    "cedar": ("conifer", 7.5, 2.0, 4, 7, 0.17, 0.26, GREY, 11),
    "fir": ("conifer", 10.0, 1.3, 5, 5, 0.12, 0.24, (0.86, 0.86, 0.86), 12),
    "broadleaf": ("broadleaf", 5.5, 1.9, 0, 0, 0.0, 0.24, (1.0, 1.02, 0.62), 13),
    "young": ("conifer", 3.4, 1.05, 3, 5, 0.12, 0.14, (1.0, 1.0, 1.0), 14),
}


def build(name):
    K.reset()
    kind, h, r, tiers, segs, base_f, trunk, tint, seed = TREES[name]
    crown, wood = K.Build(), K.Build()
    p, lean = Vector((0, 0, 0)), Vector((0, 0, 0))
    if kind == "conifer":
        base = conifer(crown, p, h, r, tiers, segs, tint, lean, seed, base_f)
    else:
        base = broadleaf(crown, p, h, r, tint, lean, seed)
    K.tube(wood, [Vector((0, 0, -SINK)), Vector((0, 0, base + 0.3))], [trunk, trunk * 0.72], 5,
           lambda q: tuple(ch * (0.7 + 0.3 * min(1, (q.z + 0.4) / 1.5)) for ch in BARK))
    objs = [crown.object("Crown", K.material("mForestNeedles", mass_image())), wood.object("Trunk", K.plain("mTreeTrunk"))]
    out = os.path.join(K.OUT, f"forest-tree-{name}.glb")
    K.export(objs, out)
    print(f"FOREST-TREE {name}: tris {({o.name: K.tris(o) for o in objs})}")
    return out


def review(out):
    """A patch of closed forest from the four GLBs: each tree its own uniform scale and turn, packed close."""
    import bpy, math
    sys.path.insert(0, os.path.join(K.HERE, "..", "props"))
    import propkit as P
    K.reset()
    rng = random.Random(5)
    obs, spots = [], []
    while len(spots) < 34:
        q = (rng.uniform(-9, 9), rng.uniform(-6, 6))
        if all(math.hypot(q[0] - a, q[1] - b) > 1.9 for a, b in spots):
            spots.append(q)
    names = list(TREES)
    for i, (x, y) in enumerate(spots):
        nm = rng.choices(names, [0.4, 0.25, 0.22, 0.13])[0] if i >= len(names) else names[i]
        bpy.ops.import_scene.gltf(filepath=os.path.join(K.OUT, f"forest-tree-{nm}.glb"))
        s = rng.uniform(0.8, 1.2)
        for o in bpy.context.selected_objects:
            if o.type == "MESH":
                o.location = (x, y, 0)
                o.rotation_euler[2] = rng.uniform(0, math.tau)
                o.scale = (s, s, s)
                if o.data.color_attributes:
                    o.data.color_attributes[0].name = "Color"
                obs.append(o)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
    g = bpy.context.active_object
    g.scale = (22, 16, 1)
    m = bpy.data.materials.new("ground")
    m.use_nodes = True
    next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*K.lin("#8fa16c"), 1)
    g.data.materials.append(m)
    bpy.context.view_layer.update()
    P.review(obs, out, views=((0, 22), (30, 40)), size=900)


if __name__ == "__main__":
    names = [a for a in ARGS if a in TREES] or list(TREES)
    written = [build(n) for n in names]
    subprocess.run(["node", "scripts/finish-greenery.mjs", *written], cwd=os.path.join(K.ROOT, "web"), check=True)
    if "review" in ARGS:
        review(os.path.join(ARGS[ARGS.index("review") + 1], "forest-trees.png"))
