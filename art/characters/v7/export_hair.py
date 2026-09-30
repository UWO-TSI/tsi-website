"""Export the v7 sculpted-lock hairstyles from their .blend files through the kit path (avatar v7 item 4).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/v7/export_hair.py

For each art/characters/v7/hair_<style>.blend: sweep its lock curves (the editable source) into the bangs and back
pieces (hair_build.piece), write art/characters/hair/<slot>/<id>.glb (the 22-bone rig + one mesh on
mixamorig:Head, as every hair GLB), and replace those ids' entries in hair/hair_catalog.json and the "hair" section
of character_catalog.json (same ids, so saved looks keep working). The other 22 pieces stay build_hair.py's.
"""
import bpy, json, os, sys

V7 = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(V7)
for p in (V7, ART, os.path.join(ART, "base")):
    sys.path.insert(0, p)
import kit  # noqa: E402
import hair_build  # noqa: E402
import hair_styles  # noqa: E402

CELLS = {  # nearest cells on David's sheets (B = hair-3d-set, N = bangs sheet)
    "bangs_spiky": "B6.2", "back_short_spiky": "B6.2", "bangs_straight": "N4.2", "back_bob": "B2.1",
    "bangs_curtain": "N3.2", "back_long": "B3.1",
}
NAMES = {"bangs_spiky": "Spiky tufts", "back_short_spiky": "Short layered", "bangs_straight": "Straight cut",
         "back_bob": "Bob", "bangs_curtain": "Curtain", "back_long": "Long straight"}

entries = []
for style in ("short", "bob", "long"):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(V7, f"hair_{style}.blend"))
    rig = bpy.data.objects["CharacterRig"]
    rig.data.pose_position = "REST"
    for lc in bpy.context.view_layer.layer_collection.children:     # the review files hide the rig and references
        lc.exclude = False
    rig.hide_set(False)
    rig.hide_viewport = False
    mat = bpy.data.materials.get("M_Hair") or kit.material("M_Hair", kit.PAL["hair"][kit.PAL["ref_girl_defaults"]["hair"]])
    for slot in ("bangs", "back"):
        pid = hair_styles.STYLES[style][slot][0]
        old = bpy.data.objects.get(pid)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        ob = hair_build.piece(style, slot, rig, mat, name=pid)
        tris = kit.ntris(ob)
        rel = f"hair/{slot}/{pid}.glb"
        kit.export(ob, rig, os.path.join(ART, rel))
        entries.append({"id": pid, "slot": slot, "name": NAMES[pid], "glb": rel, "tris": tris,
                        "materials": [{"name": "M_Hair", "tint": "hair"}], "decalSlot": None, "hidesBackHair": False,
                        "hides": [], "sheetCell": CELLS[pid], "locks": int(ob["locks"]), "v7": True, "style": style,
                        # fit_check measures the air gap over the under-cap only (hem locks flare free by design)
                        **({"capFrom": max(hair_styles.STYLES[style]["cap"]()["bottom"](lon) for lon in range(-180, 180, 5)) + 2}
                           if slot == "back" else {})})
        print(f"HAIR_V7 {style} {slot} {pid} locks={ob['locks']} tris={tris}")

# merge into both catalogues by id (order kept)
by_id = {e["id"]: e for e in entries}
cat_path = os.path.join(ART, "character_catalog.json")
cat = json.load(open(cat_path))
cat["hair"] = [by_id.get(h["id"], h) for h in cat["hair"]]
json.dump(cat, open(cat_path, "w"), indent=1)
hc_path = os.path.join(ART, "hair", "hair_catalog.json")
hc = json.load(open(hc_path))
for slot in ("bangs", "back"):
    hc[slot] = [dict(h, name=by_id[h["id"]]["name"], sheet_cell=by_id[h["id"]]["sheetCell"], tris=by_id[h["id"]]["tris"],
                     locks=by_id[h["id"]]["locks"], source=f"v7/hair_{[s for s, v in hair_styles.STYLES.items() if v[slot][0] == h['id']][0]}.blend")
                if h["id"] in by_id else h for h in hc[slot]]
json.dump(hc, open(hc_path, "w"), indent=1)
print("EXPORT_HAIR_V7_OK", len(entries))
