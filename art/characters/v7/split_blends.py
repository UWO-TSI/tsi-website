"""Split the live working file into the review .blend files (avatar v7).

  /Applications/Blender.app/Contents/MacOS/Blender -b <work.blend> -P art/characters/v7/split_blends.py

The live session models everything in one file: the head, the rig and the v6 body for context, and the hair library
as one curve collection per catalogue id under the collections `bangs` and `backs` (plus a review `gallery`). This
writes
  art/characters/v7/head.blend         the head (V7_Head), the rig and the v6 references
  art/characters/v7/hair_bangs.blend   the same plus every bangs piece's lock curves (the editable source)
  art/characters/v7/hair_backs.blend   the same plus every back piece's lock curves
"""
import bpy, os

V7 = os.path.dirname(os.path.abspath(__file__))
WORK = bpy.data.filepath
DROP_ALWAYS = ("gallery",)


def drop(coll):
    for ch in list(coll.children):
        drop(ch)
    for o in list(coll.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(coll)


for name, keep in (("head.blend", ()), ("hair_bangs.blend", ("bangs",)), ("hair_backs.blend", ("backs",))):
    bpy.ops.wm.open_mainfile(filepath=WORK)
    for cn in ("bangs", "backs") + DROP_ALWAYS:
        if cn not in keep and cn in bpy.data.collections:
            drop(bpy.data.collections[cn])
    for o in list(bpy.data.objects):          # any loose preview meshes
        if o.name.startswith("g_"):
            bpy.data.objects.remove(o, do_unlink=True)
    for cn in keep:
        for ch in bpy.data.collections[cn].children:
            ch.hide_viewport = True           # curves hidden; unhide a piece's collection to edit its locks
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    path = os.path.join(V7, name)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True, relative_remap=True, compress=True)
    print("WROTE", path, len(bpy.data.objects), len(bpy.data.curves))
