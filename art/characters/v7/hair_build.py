"""v7 hair pieces from lock curves (live preview in Blender and the headless export share this).

piece(style, slot, rig, mat) -> the mesh object for one piece: the back piece is its under-cap (kit.hair_cap, a closed
crown shell a little under the locks, so no scalp shows between them) plus every lock curve in the collection
"<style>_back"; the bangs piece is the locks in "<style>_bangs". One material (M_Hair), smooth by angle, the shared
COLOR_0 gradient, 100% on mixamorig:Head, as the rest of the hair library.
"""
import bpy, os, sys

V7 = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else \
    "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/avatar-v7/art/characters/v7"
for p in (V7, os.path.join(V7, ".."), os.path.join(V7, "..", "base")):
    if p not in sys.path:
        sys.path.insert(0, p)
import kit  # noqa: E402
import locks  # noqa: E402
import hair_styles  # noqa: E402
from head_shape import CHIN  # noqa: E402

SHARP = 40.0                 # lock side edges stay sharp (they read as separate locks), ridges and masses smooth
ZRANGE = (CHIN, 1.03)        # the library's shared COLOR_0 gradient: no shade step where bangs meet the back


def piece(style, slot, rig, mat, name=None):
    spec = hair_styles.STYLES[style]
    pid = spec[slot][0]
    if slot == "back":
        cap = spec["cap"]()
        pc, _, _ = kit.hair_cap(cap["bottom"], vol=cap["vol"], hem=cap.get("hem", 0.009))
    else:
        pc = kit.Piece()
    surf = locks.Surface(bpy.data.objects["V7_Head"])
    n = locks.piece_from([f"{style}_{slot}"], pc, surf)
    ob = pc.finish(name or pid, rig, {"M_Hair": mat}, sharp=SHARP, zrange=ZRANGE)
    ob["locks"] = n
    return ob


def seed(style, parent=None):
    spec = hair_styles.STYLES[style]
    for slot in ("bangs", "back"):
        locks.seed(f"{style}_{slot}", spec[slot][1](), parent)
