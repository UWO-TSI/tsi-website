"""Export the v7 sculpted-lock hair library from its .blend files through the kit path (avatar v7).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/v7/export_hair.py

For art/characters/v7/hair_bangs.blend and hair_backs.blend: sweep each catalogue id's lock curves (the editable
source) into its piece (hair_build.piece: back pieces add their under-cap), write art/characters/hair/<slot>/<id>.glb
(the 22-bone rig + one mesh on mixamorig:Head, as every hair GLB), and rewrite both catalogues' hair entries under the
same ids, so saved looks keep working. All 28 pieces are lock pieces now; build_hair.py is retired.
"""
import bpy, json, os, sys

V7 = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(V7)
for p in (V7, ART, os.path.join(ART, "base")):
    sys.path.insert(0, p)
import kit  # noqa: E402
import hair_build  # noqa: E402
import hair_styles as hs  # noqa: E402

entries = {}
for slot, fname, table in (("bangs", "hair_bangs.blend", hs.BANGS), ("back", "hair_backs.blend", hs.BACKS)):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(V7, fname))
    rig = bpy.data.objects["CharacterRig"]
    rig.data.pose_position = "REST"
    for lc in bpy.context.view_layer.layer_collection.children:     # the review files hide the rig and references
        lc.exclude = False
    rig.hide_set(False)
    rig.hide_viewport = False
    mat = bpy.data.materials.get("M_Hair") or kit.material("M_Hair", kit.PAL["hair"][kit.PAL["ref_girl_defaults"]["hair"]])
    for pid, spec in table.items():
        old = bpy.data.objects.get(pid)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        ob = hair_build.piece(pid, rig, mat, name=pid)
        tris = kit.ntris(ob)
        rel = f"hair/{slot}/{pid}.glb"
        kit.export(ob, rig, os.path.join(ART, rel))
        e = {"id": pid, "slot": slot, "name": spec[0], "glb": rel, "tris": tris, "materials": [{"name": "M_Hair", "tint": "hair"}],
             "decalSlot": None, "hidesBackHair": False, "hides": [], "sheetCell": spec[1], "locks": int(ob["locks"]), "v7": True}
        if slot == "back":   # fit_check measures the air gap over the under-cap only (hem locks flare free by design)
            e["capFrom"] = max(spec[3](lon) for lon in range(-180, 180, 5)) + 2
        entries[pid] = e
        print(f"HAIR_V7 {slot} {pid} locks={ob['locks']} tris={tris}")
        bpy.data.objects.remove(ob, do_unlink=True)

cat_path = os.path.join(ART, "character_catalog.json")
cat = json.load(open(cat_path))
cat["hair"] = [entries[h["id"]] for h in cat["hair"]] + [e for pid, e in entries.items() if pid not in {h["id"] for h in cat["hair"]}]
json.dump(cat, open(cat_path, "w"), indent=1)
hc_path = os.path.join(ART, "hair", "hair_catalog.json")
hc = json.load(open(hc_path))
hc["note"] = ("Hair library (rows 135, 191, 192; avatar v7). Every piece is sculpted locks: art/characters/v7/hair_bangs.blend "
              "and hair_backs.blend hold the lock curves, v7/export_hair.py writes the GLBs. Each GLB = CharacterRig + one mesh "
              "skinned 100% to mixamorig:Head; M_Hair is tinted from palette.json hair colours.")
for slot, key in (("bangs", "bangs"), ("back", "back")):
    hc[key] = [{"id": e["id"], "name": e["name"], "sheet_cell": e["sheetCell"], "tris": e["tris"], "locks": e["locks"],
                "file": f"{key}/{e['id']}.glb", "source": f"v7/hair_{'bangs' if slot == 'bangs' else 'backs'}.blend"}
               for e in entries.values() if e["slot"] == slot]
json.dump(hc, open(hc_path, "w"), indent=1)
print("EXPORT_HAIR_V7_OK", len(entries))
