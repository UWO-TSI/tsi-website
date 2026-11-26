# python3 -I patch_ir.py <glb>: the OG Titanium's thin film (KHR_materials_iridescence, as rod-titanium shipped) on every material
import json, struct, sys
p = sys.argv[1]; b = open(p, "rb").read()
n = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20+n]); rest = b[20+n:]
for m in j["materials"]:
    m.setdefault("extensions", {})["KHR_materials_iridescence"] = {"iridescenceFactor": 1, "iridescenceIor": 1.8, "iridescenceThicknessMaximum": 420}
    m["pbrMetallicRoughness"].update({"metallicFactor": 0.85, "roughnessFactor": 0.26})
j["extensionsUsed"] = sorted(set(j.get("extensionsUsed", [])) | {"KHR_materials_iridescence"})
s = json.dumps(j, separators=(",", ":")).encode(); s += b" " * ((4 - len(s) % 4) % 4)
out = b[:8] + struct.pack("<I", 12 + 8 + len(s) + len(rest)) + struct.pack("<II", len(s), 0x4E4F534A) + s + rest
open(p, "wb").write(out); print("PATCHED", p, j["materials"][0]["name"])
