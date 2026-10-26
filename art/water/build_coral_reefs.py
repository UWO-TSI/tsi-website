"""Coral reefs for the new world's shallows (game/wharf-art2; David's R2c note on the campfire, 2026-10-26: "have coral
reeffs and fish you can see in the shallow water"). Bigger clusters built from the existing coral clumps
(game/water/coral-a..d, art/props/build_beach_set.py: staghorn, brain, sea fans, tubes), each turned, sized and tinted
its own way over low seabed rocks, with a starfish or two, in one mesh and one material. The fish are the game's own
decorative schools (components/game/water/DecorativeFish.tsx), which already swim the shallows.

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/water/build_coral_reefs.py [-- review <dir>]

Writes, under web/public/assets/game/water/, the origin on the seabed (y 0) at the reef's middle, not solid:
  coral-reef-a.glb  a broad reef about 2.8 by 2: two rocks, staghorns, brain corals, a fan, tubes, two starfish.
  coral-reef-b.glb  a round, tall reef about 2 across: one big rock crowned with fans and a staghorn.
  coral-reef-c.glb  a long ribbon of reef about 3.4 by 1.2 along x: three low rocks, every kind along it.

The coral's plain P_Stone with its colour in COLOR_0, the rocks and starfish on the same material: one draw a reef.
"""
import math, os, sys
import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
sys.path.insert(0, os.path.join(HERE, "..", "wharf"))
import propkit as K  # noqa: E402
from build_wharf_kit import mix, report  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WATER_DIR = os.path.join(K.ROOT, "web", "public", "assets", "game", "water")
ROCK = ("#b3a58c", "#c2b49a", "#a6977f")
TINTS = ("#ff9a8a", "#c58ae0", "#ffc070", "#7fd6c8", "#f27aa8", "#fff0a0")

# Each reef: its rocks (x, z, rx, ry, rz), its coral (kind, x, z, yaw, scale, tint), its starfish (x, z, yaw, colour).
REEFS = {
    "a": ([(-0.6, 0.0, 0.8, 0.2, 0.65), (0.7, 0.15, 0.6, 0.16, 0.5)],
          [("a", -0.55, -0.1, 0.3, 1.7, None), ("b", 0.1, 0.35, 1.0, 1.25, None), ("b", 1.05, -0.3, 2.5, 1.0, 2), ("b", -1.25, 0.45, 0.7, 0.9, 5),
           ("c", 0.65, 0.3, 2.8, 1.35, 1), ("d", 0.2, -0.35, 1.4, 1.5, None), ("d", -1.15, -0.4, 0.5, 1.2, 3)],
          [(-0.25, 0.75, 0.4, "#e8673c"), (1.4, 0.35, 1.3, "#f2c94c")]),
    "b": ([(0.0, 0.0, 0.8, 0.3, 0.75)],
          [("c", -0.2, -0.2, 0.1, 1.8, None), ("c", 0.35, 0.0, -0.9, 1.45, 4), ("a", 0.05, 0.3, 1.1, 1.7, None), ("d", -0.55, 0.35, 0.6, 1.3, None),
           ("d", 0.6, 0.5, 3.0, 1.05, 5), ("b", 0.6, -0.45, 2.2, 1.05, 2), ("b", -0.65, -0.5, 0.9, 0.9, None)],
          [(-0.15, 0.85, 0.9, "#e8673c")]),
    "c": ([(-1.15, 0.0, 0.6, 0.16, 0.5), (0.0, 0.08, 0.7, 0.2, 0.5), (1.2, -0.05, 0.55, 0.15, 0.45)],
          [("b", -1.2, 0.05, 0.4, 1.25, None), ("d", -0.6, -0.2, 1.0, 1.4, None), ("a", 0.0, 0.05, 2.2, 1.5, 0), ("c", 0.6, -0.15, 0.3, 1.35, 1),
           ("b", 1.25, 0.1, 1.7, 1.15, 3), ("d", 1.6, -0.2, 0.2, 1.1, 5)],
          [(0.55, 0.5, 2.0, "#f2c94c"), (-0.45, -0.45, 0.6, "#e8673c")]),
}


def rock_top(rocks, x, z):
    h = 0.0
    for rx_, rz_, a, b, c in rocks:
        q = 1 - ((x - rx_) / a) ** 2 - ((z - rz_) / c) ** 2
        if q > 0:
            h = max(h, b * math.sqrt(q))
    return h


def to_float_colours(me):
    """The imported COLOR_0 as a float corner attribute named Color (the Kit's), whatever the importer made of it."""
    src = me.color_attributes[0]
    vals = [tuple(src.data[(lp.vertex_index if src.domain == "POINT" else lp.index)].color) for lp in me.loops]
    me.color_attributes.remove(src)
    dst = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    for lp, v in zip(me.loops, vals):
        dst.data[lp.index].color = v
    me.color_attributes.active_color = dst


def templates():
    out = {}
    for kind in "abcd":
        bpy.ops.import_scene.gltf(filepath=os.path.join(WATER_DIR, f"coral-{kind}.glb"))
        ob = next(o for o in bpy.context.selected_objects if o.type == "MESH")
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        to_float_colours(ob.data)
        if out:                                  # one P_Stone for every kind, so a reef is one draw
            ob.data.materials[0] = out["a"].data.materials[0]
        ob.hide_render = True
        out[kind] = ob
    return out


def place(tpl, x, y, z, yaw, s, tint):
    ob = tpl.copy()
    ob.data = tpl.data.copy()
    bpy.context.scene.collection.objects.link(ob)
    ob.matrix_world = Matrix.Translation(K.G(x, y, z)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Scale(s, 4)
    if tint is not None:
        t = np.array(K.lin(TINTS[tint]))
        for d in ob.data.color_attributes["Color"].data:
            c = np.array(d.color[:3])
            d.color = (*(c * 0.55 + t * 0.45 * (0.6 + 0.4 * c.mean())), 1.0)
    ob.hide_render = False
    return ob


def starfish(k, M, x, y, z, yaw, col, R=0.2):
    pts = []
    for i in range(10):
        a = yaw + math.pi * i / 5
        r = R if i % 2 == 0 else R * 0.42
        pts.append((x + math.cos(a) * r, z + math.sin(a) * r))
    outline = [(px, pz) for px, pz in pts]
    k.extrude(outline[::-1], 0.0, 0.035, M, col, bevel=0.015, rot=K.game_rot(pitch=math.pi / 2), at=(0, y + 0.035, 0))


def reef(name, tpls, stone):
    rocks, coral, stars = REEFS[name]
    k = K.Kit(f"coral-reef-{name}")
    M = type("M", (), {"m": stone})()
    for i, (x, z, rx, ry, rz) in enumerate(rocks):
        k.blob((x, 0.0, z), (rx, ry, rz), M, ROCK[i % 3], segs=10, rings=5, seed=40 + i, lumpy=0.35, flat_bottom=0.0)
    for x, z, yaw, col in stars:
        starfish(k, M, x, rock_top(rocks, x, z) - 0.01, z, yaw, col)
    for v in k.bm.verts:
        v.co.z = max(v.co.z, 0.0)
    k.tint_gradient(0.8, 1.0, 0.0, 0.5)
    base = k.finish(smooth_deg=60)
    parts = [place(tpls[kind], x, rock_top(rocks, x, z) - 0.04, z, yaw, s, tint) for kind, x, z, yaw, s, tint in coral]
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts + [base]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    base.data.color_attributes.active_color = base.data.color_attributes["Color"]
    return base


def build():
    K.reset()
    tpls = templates()
    stone = tpls["a"].data.materials[0]
    obs = {}
    for name in REEFS:
        ob = reef(name, tpls, stone)
        K.export([ob], f"game/water/coral-reef-{name}.glb")
        report(ob)
        obs[name] = ob
    return obs


if __name__ == "__main__":
    obs = build()
    if "review" in ARGS:
        shown = []
        for name, x in (("a", -3.4), ("b", 0.0), ("c", 3.6)):
            o = obs[name].copy()
            bpy.context.scene.collection.objects.link(o)
            o.location = K.G(x, 0, 0)
            shown.append(o)
            obs[name].hide_render = True
        bpy.context.view_layer.update()
        K.review(shown, os.path.join(ARGS[ARGS.index("review") + 1], "coral-reefs.png"), views=((200, 30), (150, 55)), size=1000)
