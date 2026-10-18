"""Hat-cut diagnostic: for each hair x hat, render whole and cut from many views (flat hues: hair blue, hat green,
skin red), and classify every changed pixel by what the cut render now shows there.
  /Applications/Blender.app/Contents/MacOS/Blender -b -P specs/evidence/wardrobe-b2/diag_hatcut.py -- art/characters <out_dir> <hairs,comma> <hats,comma> [six|full]
  python3 specs/evidence/wardrobe-b2/diag_contact.py <out_dir> <out.png> <hair+hat tags, no hair_/acc_> [views] [w,c,d]
Prints DIAG <hair> <hat> <view> hat=<n> hair=<n> skin=<n> bg=<n>
"""
import bpy, json, math, os, struct, sys
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
ART, OUT, HAIRS, HATS = ARGS[0], ARGS[1], ARGS[2].split(","), ARGS[3].split(",")
VIEWSET = ARGS[4] if len(ARGS) > 4 else "full"
os.makedirs(OUT, exist_ok=True)
CAT = json.load(open(os.path.join(ART, "character_catalog.json")))
PARTS = {p["id"]: p for p in CAT["hair"] + CAT.get("robloxAccessories", [])}
COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read(path):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bl = struct.unpack("<I", b[20 + jl:24 + jl])[0]
    return j, bytes(b[28 + jl:28 + jl + bl])


def acc(j, b, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    dt, n = COMP[a["componentType"]], NCOMP[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    st = bv.get("byteStride", 0)
    if st and st != n * np.dtype(dt).itemsize:
        raw = np.frombuffer(b, np.uint8, a["count"] * st, off).reshape(a["count"], st)[:, :n * np.dtype(dt).itemsize]
        return np.ascontiguousarray(raw).view(dt).reshape(a["count"], n)
    return np.frombuffer(b, dt, a["count"] * n, off).reshape(a["count"], n).copy()


def tris(path, mesh_names=None, cutattr=None, bit=None):
    j, b = read(path)
    out = []
    for m in j["meshes"]:
        if mesh_names and m["name"] not in mesh_names:
            continue
        for p in m["primitives"]:
            pos = acc(j, b, p["attributes"]["POSITION"]).astype(float)
            t = acc(j, b, p["indices"]).reshape(-1, 3)
            if cutattr is not None and cutattr in p["attributes"]:
                mk = (np.rint(acc(j, b, p["attributes"][cutattr])[:, 0]).astype(np.int64) >> bit) & 1
                t = t[~(mk[t] == 1).all(1)]
            out.append(pos[t])
    return np.concatenate(out) if out else np.zeros((0, 3, 3))


def obj(name, t, rgb):
    v = t.reshape(-1, 3)
    v = np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(x) for x in v], [], [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(t))])
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    m = bpy.data.materials.new(name)
    m.diffuse_color = list(rgb) + [1.0]
    me.materials.append(m)
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"
sc.render.film_transparent = True
R = 360
sc.render.resolution_x = sc.render.resolution_y = R
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
sc.collection.objects.link(cam)
cam.data.type = "ORTHO"
cam.data.ortho_scale = 0.95
sc.camera = cam
HC = Vector((0, 0, 0.7755))
centre = HC + Vector((0, 0, 0.1))

base = os.path.join(ART, CAT["base"]["clips_glb"])
obj("head", tris(base, {"V8_Head", "V6_Body"}), (0.95, 0.25, 0.2))

if VIEWSET == "full":
    VIEWS = [(f"y{y}p{p}", y, p) for p in (-25, 0, 30) for y in range(0, 360, 45)]
else:
    VIEWS = [("front", 0, 0), ("34", 40, 0), ("side", 90, 0), ("back", 180, 0), ("high", 40, 32), ("low", 40, -22)]


def shoot(tag):
    out = {}
    for name, yaw, pitch in VIEWS:
        a, p = math.radians(yaw), math.radians(pitch)
        d = Vector((-math.sin(a) * math.cos(p), -math.cos(a) * math.cos(p), math.sin(p)))
        cam.location = centre + d * 3
        cam.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"{tag}_{name}.png")
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(sc.render.filepath)
        out[name] = np.array(img.pixels[:], np.float32).reshape(R, R, 4).copy()
        bpy.data.images.remove(img)
    return out


def cls(px):
    """0 bg, 1 skin (red), 2 hair (blue), 3 hat (green)"""
    c = np.zeros(px.shape[:2], int)
    rgb = px[..., :3]
    vis = px[..., 3] > 0.5
    k = rgb.argmax(-1)
    c[vis & (k == 0)] = 1
    c[vis & (k == 2)] = 2
    c[vis & (k == 1)] = 3
    return c


report = []
for hid in HAIRS:
    for hat in HATS:
        h = PARTS[hat]
        bit = h["hatCut"]
        hatob = obj("hat", tris(os.path.join(ART, h["glb"])), (0.2, 0.85, 0.25))
        hp = os.path.join(ART, PARTS[hid]["glb"])
        tag = f"{hid.replace('hair_', '')}+{hat.replace('acc_', '')}"
        hw = obj("hair", tris(hp), (0.2, 0.35, 0.95))
        whole = shoot(tag + "_w")
        bpy.data.objects.remove(hw, do_unlink=True)
        hc = obj("hair", tris(hp, None, "_HATCUT", bit), (0.2, 0.35, 0.95))
        cut = shoot(tag + "_c")
        bpy.data.objects.remove(hc, do_unlink=True)
        bpy.data.objects.remove(hatob, do_unlink=True)
        for name, *_ in VIEWS:
            w, c = whole[name], cut[name]
            ch = np.abs(w - c).max(-1) > 3 / 255
            k = cls(c)
            n = {lab: int((ch & (k == i)).sum()) for i, lab in enumerate(("bg", "skin", "hair", "hat"))}
            report.append({"hair": hid, "hat": hat, "view": name, **n})
            print("DIAG", hid, hat, name, " ".join(f"{a}={b}" for a, b in n.items()))
            # overlay: the cut render, changed pixels tinted (magenta: shows skin / bg / other hair; cyan: shows hat)
            ov = c.copy()
            bad = ch & (k != 3)
            good = ch & (k == 3)
            ov[bad, :3] = [1, 0, 1]
            ov[good, :3] = [0, 1, 1]
            ov[bad | good, 3] = 1
            img = bpy.data.images.new("ov", R, R, alpha=True)
            img.pixels = ov.ravel()
            img.filepath_raw = os.path.join(OUT, f"{tag}_d_{name}.png")
            img.file_format = "PNG"
            img.save()
            bpy.data.images.remove(img)
json.dump(report, open(os.path.join(OUT, "diag.json"), "w"), indent=1)
print("DIAG_OK", len(report))
