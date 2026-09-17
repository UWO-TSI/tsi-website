"""Restore missing ACNH variant atlases and UVs without changing placed geometry.

Usage: python3 scripts/restore-hq-textures.py /path/to/Assets/Model
The original export dropped UVs whenever a remake texture was in another folder.
Source triangle order is checked against the existing GLB before restoring UVs.
"""
import copy
import json
import math
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

NS = {"c": "http://www.collada.org/2005/11/COLLADASchema"}
ROOT = Path(__file__).resolve().parents[1] / "web/public/assets/acnh/furniture"
ASSETS = {
    "study-desk": "FtrStudyDesk",
    "study-chair": "FtrStudyChair",
    "bookshelf": "FtrBookshelf",
    "wooden-chest": "FtrWoodenChest",
    "bulletinboard": "FtrBulletinboard",
    "antique-clock": "FtrAntiqueClock",
    "plant-monstera": "FtrPlantMonstera",
    "plant-yucca": "FtrPlantYucca",
}


def restore(source, name, original):
    path = ROOT / (name + ".glb")
    raw = path.read_bytes()
    length = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20 + length])
    if doc.get("extras", {}).get("hqTexturesRestored"):
        print(name, "already restored")
        return
    binary = bytearray(raw[28 + length:])

    def accessor(index):
        a = doc["accessors"][index]
        v = doc["bufferViews"][a["bufferView"]]
        fmt = {5126: "f", 5123: "H", 5125: "I", 5121: "B"}[a["componentType"]]
        count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
        stride = v.get("byteStride", struct.calcsize(fmt) * count)
        start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        return [struct.unpack_from("<" + fmt * count, binary, start + i * stride) for i in range(a["count"])]

    def append_view(data):
        binary.extend(b"\0" * (-len(binary) % 4))
        index = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
        binary.extend(data)
        return index

    tree = ET.parse(source / (original + ".Nin_NX_NVN") / (original + ".dae"))
    geometries = tree.findall(".//c:geometry/c:mesh", NS)
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            old_material = doc["materials"][primitive["material"]]
            # Keep already-textured leaves, clock hands, and glass intact.
            if "baseColorTexture" in old_material.get("pbrMetallicRoughness", {}):
                continue
            indices = [v[0] for v in accessor(primitive["indices"])]
            matches = [g for g in geometries if int(g.find("c:triangles", NS).get("count")) * 3 == len(indices)]
            assert len(matches) == 1, (name, "ambiguous source geometry")
            geometry = matches[0]
            triangles = geometry.find("c:triangles", NS)
            slot = triangles.get("material")
            if slot == "mGlass":
                continue
            inputs = triangles.findall("c:input", NS)
            stride = max(int(i.get("offset")) for i in inputs) + 1
            corners = list(map(int, triangles.find("c:p", NS).text.split()))
            sources = {}
            for s in geometry.findall("c:source", NS):
                values = list(map(float, s.find("c:float_array", NS).text.split()))
                width = int(s.find("c:technique_common/c:accessor", NS).get("stride"))
                sources[s.get("id")] = [tuple(values[i:i + width]) for i in range(0, len(values), width)]
            vertex_input = next(i for i in inputs if i.get("semantic") == "VERTEX")
            position_source = geometry.find("c:vertices/c:input", NS).get("source")[1:]
            uv_input = next(i for i in inputs if i.get("semantic") == "TEXCOORD" and i.get("set", "0") == "0")
            positions = [sources[position_source][corners[i + int(vertex_input.get("offset"))]] for i in range(0, len(corners), stride)]
            uvs = [sources[uv_input.get("source")[1:]][corners[i + int(uv_input.get("offset"))]] for i in range(0, len(corners), stride)]
            target = accessor(primitive["attributes"]["POSITION"])
            mapped = [None] * len(target)
            for corner, vertex in enumerate(indices):
                next_corner = corner - corner % 3 + (corner + 1) % 3
                assert math.isclose(math.dist(target[vertex], target[indices[next_corner]]), math.dist(positions[corner], positions[next_corner]), abs_tol=0.0001), (name, "triangle order changed", corner)
                uv = (uvs[corner][0], 1 - uvs[corner][1])
                assert mapped[vertex] is None or mapped[vertex] == uv, (name, "UV seam merged")
                mapped[vertex] = uv
            assert all(uv is not None for uv in mapped)
            view = append_view(b"".join(struct.pack("<ff", *uv) for uv in mapped))
            primitive["attributes"]["TEXCOORD_0"] = len(doc["accessors"])
            doc["accessors"].append({"bufferView": view, "componentType": 5126, "count": len(mapped), "type": "VEC2"})
            variant = source / (original + slot[1:] + "0.Nin_NX_NVN") / (slot + "_Alb.png")
            assert variant.exists(), variant
            image = len(doc.setdefault("images", []))
            doc["images"].append({"name": original + "_" + slot + "_Alb", "mimeType": "image/png", "bufferView": append_view(variant.read_bytes())})
            texture = len(doc.setdefault("textures", []))
            sampler = len(doc.setdefault("samplers", []))
            doc["samplers"].append({"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497})
            doc["textures"].append({"source": image, "sampler": sampler})
            material = copy.deepcopy(old_material)
            material["name"] = original + "_" + slot
            material["pbrMetallicRoughness"] = {"baseColorTexture": {"index": texture}, "baseColorFactor": [1, 1, 1, 1], "roughnessFactor": 0.85, "metallicFactor": 0}
            primitive["material"] = len(doc["materials"])
            doc["materials"].append(material)
            print(name, slot, "restored", len(mapped), "UVs from", variant.parent.name)

    doc.setdefault("extras", {})["hqTexturesRestored"] = True
    doc["buffers"][0]["byteLength"] = len(binary)
    binary.extend(b"\0" * (-len(binary) % 4))
    encoded = json.dumps(doc, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(binary)) + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + struct.pack("<II", len(binary), 0x004E4942) + binary)


if __name__ == "__main__":
    for name, original in ASSETS.items():
        restore(Path(sys.argv[1]), name, original)
