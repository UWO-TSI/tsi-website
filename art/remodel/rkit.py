"""Shared bits for the remodel builds (game/remodel): propkit's geometry, the plaza set's presets and colours, and an
export that writes a model in the frame of the dump piece it replaces (so the map's scale, footprint and PROP_TOP stay).

Every remodel is authored in game units as it shows in the world, then scaled by 1 / (the scale the game draws the old
model at) on export, so the new file drops into the old one's place with nothing else changed.
"""
import os, sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "props"))
import propkit as K  # noqa: E402,F401
import build_plaza_set as PS  # noqa: E402,F401  (presets, shade, recolor, barrel, crate, fruit_heap, the palette)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def export_in_frame(ob, drawn_at, path):
    """Export `ob` (built in game units) scaled by 1 / drawn_at: the dump piece's own units."""
    s = 1.0 / drawn_at
    ob.scale = (s, s, s)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return K.export([ob], path)
