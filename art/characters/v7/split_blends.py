"""Split the live working file into the review .blend files (avatar v7 item 5).

  /Applications/Blender.app/Contents/MacOS/Blender -b <work.blend> -P art/characters/v7/split_blends.py

The live session models everything in one file (head, rig, body for context, one collection per hairstyle:
hair_<style> with the lock curves in <style>_bangs / <style>_back and the generated meshes). This writes
  art/characters/v7/head.blend          the head (V7_Head), the rig and the v6 body for context
  art/characters/v7/hair_<style>.blend  the same plus that style's lock curves (the editable source) and meshes
"""
import bpy, os

V7 = os.path.dirname(os.path.abspath(__file__))
WORK = bpy.data.filepath
STYLES = ("short", "bob", "long")


def drop(coll):
    for ch in list(coll.children):
        drop(ch)
    for o in list(coll.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(coll)


for keep in STYLES + (None,):
    bpy.ops.wm.open_mainfile(filepath=WORK)
    for st in STYLES:
        if st != keep and f"hair_{st}" in bpy.data.collections:
            drop(bpy.data.collections[f"hair_{st}"])
    for c in list(bpy.data.collections):
        if c.users == 0 or (not c.objects and not c.children and c.name == "Collection"):
            bpy.data.collections.remove(c)
    if keep:
        top = bpy.data.collections[f"hair_{keep}"]
        top.hide_viewport = False
        for sub in top.children:
            sub.hide_viewport = True            # curves hidden, meshes shown; unhide the sub-collections to edit
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    path = os.path.join(V7, f"hair_{keep}.blend" if keep else "head.blend")
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True, relative_remap=True, compress=True)
    print("WROTE", path, len(bpy.data.objects), len(bpy.data.curves), [c.name for c in bpy.data.collections])
