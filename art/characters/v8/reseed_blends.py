"""avatar v8: write the organic pieces' lock curves (hair_styles seeds, hair_styles.V8) into the review files.

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/v8/reseed_blends.py

Opens art/characters/v7/hair_bangs.blend and hair_backs.blend, (re)makes the curves of every V8 piece of that slot
from its seeds in a collection named after its catalogue id (under `bangs` or `backs`, hidden like the rest), and
saves. The curves stay the editable source: move points in Blender, then run v7/export_hair.py.
"""
import bpy, os, sys

V8 = os.path.dirname(os.path.abspath(__file__))
V7 = os.path.join(V8, "..", "v7")
for p in (V8, V7, os.path.join(V8, ".."), os.path.join(V8, "..", "base")):
    sys.path.insert(0, p)
import hair_build  # noqa: E402
import hair_styles as hs  # noqa: E402

for fname, parent, table in (("hair_bangs.blend", "bangs", hs.BANGS), ("hair_backs.blend", "backs", hs.BACKS)):
    path = os.path.abspath(os.path.join(V7, fname))
    bpy.ops.wm.open_mainfile(filepath=path)
    par = bpy.data.collections[parent]
    for pid in sorted(hs.V8 & set(table)):
        coll = hair_build.seed(pid, par)
        if coll.name not in par.children:
            par.children.link(coll)
        coll.hide_viewport = True
        print("RESEED", pid, len(coll.objects))
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print("WROTE", path)
