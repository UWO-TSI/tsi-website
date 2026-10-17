"""What a look never shows, cut from the exported GLBs (David, 2026-10-17: "find ways to not render part of hair or smth
or find ways to lower triangles that aren't displayed"; the character budget stays 7,800 / 5,100 / 4,000).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hidden_cut.py -- <mode> [ids ...]
  then web/scripts/sync-character-assets.mjs

Modes (each rewrites the GLBs in place: the triangles and vertex arrays it keeps, as they were; nothing re-exported):
  hidden   Hidden inner geometry. Every triangle of a whole hairstyle (Full, LOD 1, LOD 2) and of a Roblox accessory
           (Full, LOD 1) that no view from outside can reach is dropped: from each of SAMPLES points on it, no ray in any
           of DIRS directions (the whole sphere: the body draws both sides) gets out past the head, the base body and the
           asset itself. The rest are kept as they are; unused vertices go.
  hatcut   The hair under a hat. A whole hairstyle's vertex that, with any covering hat on (catalogue `coversHair`: the
           propeller cap, the drawn top hat, the cowboy, woven and straw hats), no view from outside reaches (each ray hits
           that hat, the head, the body or the hair's own outer layers) is marked in a `_HATCUT` attribute (1 or 0), per
           tier on its own mesh. A look wearing a covering hat draws none of the hair's triangles whose three vertices are
           marked (rig.ts adoptPrimitive). Only what no view reaches goes, so the look is the same.
  hoodcut  The head under the hood: the base skin's vertices (the clip base and the LOD 1 skin) the bear hood hides from
           every direction, marked `_HOODCUT`; a look wearing it draws none of the head triangles all marked.
  measure  The heaviest wearable look at Full, LOD 1 and LOD 2 (budget.test.ts's rule, with the hat cut), printed.
Run hidden first (it changes the meshes), then hatcut and hoodcut (marks on the final meshes); rerun after any hair,
hat or base rebuild (import_hair.py, import_roblox.py, build_lod.py).
"""
import bpy, json, math, os, struct, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE, ONLY = (ARGS[0] if ARGS else "measure"), set(ARGS[1:])
CAT_PATH = os.path.join(HERE, "character_catalog.json")
CAT = json.load(open(CAT_PATH))
HC = np.array([0.0, 0.7755, 0.0])          # the head centre (head_shape.HC) in glTF axes (y up, the face toward +z)
DIRS_N, SAMPLES_EPS = 256, 2e-4


# ================================================================ GLB in and out (one buffer, no compression)
COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bl = struct.unpack("<I", b[20 + jl:24 + jl])[0]
    return j, bytes(b[28 + jl:28 + jl + bl])


def accessor(j, bin_, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    dt, n = COMP[a["componentType"]], NCOMP[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0)
    if stride and stride != n * np.dtype(dt).itemsize:
        raw = np.frombuffer(bin_, np.uint8, a["count"] * stride, off).reshape(a["count"], stride)[:, :n * np.dtype(dt).itemsize]
        return np.ascontiguousarray(raw).view(dt).reshape(a["count"], n)
    return np.frombuffer(bin_, dt, a["count"] * n, off).reshape(a["count"], n).copy()


def write_glb(path, j, arrays):
    """arrays: accessor index -> np array (every accessor's data, in order). One bufferView per accessor, packed."""
    chunks, views, off = [], [], 0
    for i, a in enumerate(j["accessors"]):
        raw = np.ascontiguousarray(arrays[i]).tobytes()
        pad = (-len(raw)) % 4
        view = {"buffer": 0, "byteLength": len(raw), "byteOffset": off}
        target = {"indices": 34963, "attr": 34962}.get(a.pop("_target", None))
        if target:
            view["target"] = target
        views.append(view)
        a["bufferView"] = i
        a.pop("byteOffset", None)
        a.pop("_name", None)
        a["count"] = int(arrays[i].shape[0])
        chunks.append(raw + b"\0" * pad)
        off += len(raw) + pad
    for im in j.get("images", []):
        if "_bytes" in im:
            raw = im.pop("_bytes")
            pad = (-len(raw)) % 4
            views.append({"buffer": 0, "byteLength": len(raw), "byteOffset": off})
            im["bufferView"] = len(views) - 1
            chunks.append(raw + b"\0" * pad)
            off += len(raw) + pad
    j["bufferViews"] = views
    j["buffers"] = [{"byteLength": off}]
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    bn = b"".join(chunks)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)) + struct.pack("<II", len(js), 0x4E4F534A) + js + \
        struct.pack("<II", len(bn), 0x004E4942) + bn
    open(path, "wb").write(out)


def load_all(path):
    j, b = read_glb(path)
    arrays = [accessor(j, b, i) for i in range(len(j["accessors"]))]
    for im in j.get("images", []):                     # an embedded image (the base's face) keeps its bytes
        if "bufferView" in im:
            v = j["bufferViews"][im["bufferView"]]
            im["_bytes"] = b[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
    for m in j["meshes"]:
        for p in m["primitives"]:
            j["accessors"][p["indices"]]["_target"] = "indices"
            for name, k in p["attributes"].items():
                j["accessors"][k]["_target"] = "attr"
                j["accessors"][k]["_name"] = name
    return j, arrays


def bounds(j, arrays):
    """POSITION min and max, as glTF asks, after an edit."""
    for m in j["meshes"]:
        for p in m["primitives"]:
            k = p["attributes"]["POSITION"]
            pos = arrays[k]
            if len(pos):
                j["accessors"][k]["min"] = [float(x) for x in pos.min(0)]
                j["accessors"][k]["max"] = [float(x) for x in pos.max(0)]


def primitives(j):
    return [p for m in j["meshes"] for p in m["primitives"]]


def keep_triangles(j, arrays, prim, keep):
    """The primitive keeps the triangles where keep is True; vertices no kept triangle uses go (every attribute)."""
    tri = arrays[prim["indices"]].reshape(-1, 3)[keep]
    used = np.unique(tri)
    remap = np.full(arrays[prim["attributes"]["POSITION"]].shape[0], -1, np.int64)
    remap[used] = np.arange(len(used))
    for name, k in prim["attributes"].items():
        arrays[k] = arrays[k][used]
        if name != "POSITION":                         # stale bounds go (glTF asks them of POSITION only: bounds())
            j["accessors"][k].pop("min", None)
            j["accessors"][k].pop("max", None)
    j["accessors"][prim["indices"]].pop("min", None)
    j["accessors"][prim["indices"]].pop("max", None)
    dt = np.uint16 if len(used) < 65536 else np.uint32
    arrays[prim["indices"]] = remap[tri].reshape(-1, 1).astype(dt)
    j["accessors"][prim["indices"]]["componentType"] = 5123 if dt == np.uint16 else 5125


def set_mask(j, arrays, prim, name, mask):
    """A per-vertex float attribute `name` (1: marked) on the primitive, added or replaced."""
    data = mask.astype(np.float32).reshape(-1, 1)
    if name in prim["attributes"]:
        arrays[prim["attributes"][name]] = data
        return
    j["accessors"].append({"componentType": 5126, "count": int(len(data)), "type": "SCALAR", "_target": "attr", "_name": name})
    arrays.append(data)
    prim["attributes"][name] = len(j["accessors"]) - 1


def save(path, j, arrays):
    bounds(j, arrays)
    write_glb(path, j, arrays)


# ================================================================ geometry: occluders and rays
def fib(n):
    """n directions spread evenly over the sphere."""
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    th = math.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)


DIRS = fib(DIRS_N)


def tris_of(path, keep=lambda prim, j: True):
    j, arrays = load_all(path)
    out = []
    for p in primitives(j):
        if not keep(p, j):
            continue
        pos = arrays[p["attributes"]["POSITION"]].astype(float)
        out.append(pos[arrays[p["indices"]].reshape(-1, 3)])
    return np.concatenate(out) if out else np.zeros((0, 3, 3))


def bvh(tris):
    """A BVH of triangles (n, 3, 3)."""
    verts = [Vector(v) for v in tris.reshape(-1, 3)]
    return BVHTree.FromPolygons(verts, [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(tris))], all_triangles=True)


def base_tris():
    """The head (skin and face) and the base body: what always occludes."""
    path = os.path.join(HERE, CAT["base"]["clips_glb"])
    names = {"V8_Head", "V6_Body"}

    def keep(p, j):
        mesh = next(m for m in j["meshes"] if p in m["primitives"])
        return mesh["name"] in names
    return tris_of(path, keep)


BASE = None


def escapes(trees, points, dirs=DIRS, eps=SAMPLES_EPS, far=4.0):
    """For each point, whether any of `dirs` gets out past every tree (n,) bool."""
    out = np.zeros(len(points), bool)
    for i, p in enumerate(points):
        for d in dirs:
            o = Vector(p + d * eps)
            dv = Vector(d)
            if all(t.ray_cast(o, dv, far)[0] is None for t in trees):
                out[i] = True
                break
    return out


def hidden_everywhere(trees, points, dirs=DIRS, eps=SAMPLES_EPS):
    """For each point, whether every direction hits one of the trees (n,) bool."""
    return ~escapes(trees, points, dirs, eps)


# ================================================================ modes
def hair_paths(p):
    """A whole hairstyle's GLB per tier: Full, LOD 1, LOD 2."""
    return [os.path.join(HERE, p["glb"]), os.path.join(HERE, "lod1", p["glb"]), os.path.join(HERE, "lod2", p["glb"])]


def acc_paths(p):
    return [os.path.join(HERE, p["glb"]), os.path.join(HERE, "lod1", p["glb"])]


def selected(parts):
    return [p for p in parts if not ONLY or p["id"] in ONLY]


def hidden():
    """Drop the triangles no outside view reaches (the head, the base body and the asset occlude)."""
    base = bvh(BASE)
    w = np.array([[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]])   # the samples on a triangle
    jobs = [(p["id"], path) for p in selected([h for h in CAT["hair"] if h.get("full")]) for path in hair_paths(p)]
    jobs += [(p["id"], path) for p in selected(CAT.get("robloxAccessories", [])) for path in acc_paths(p)]
    total = [0, 0]
    for pid, path in jobs:
        j, arrays = load_all(path)
        prims = primitives(j)
        own = np.concatenate([arrays[p["attributes"]["POSITION"]].astype(float)[arrays[p["indices"]].reshape(-1, 3)] for p in prims])
        trees = [base, bvh(own)]
        before = after = 0
        for p in prims:
            t = arrays[p["attributes"]["POSITION"]].astype(float)[arrays[p["indices"]].reshape(-1, 3)]
            pts = np.einsum("sk,nkd->nsd", w, t).reshape(-1, 3)
            vis = escapes(trees, pts).reshape(len(t), len(w)).any(1)
            before, after = before + len(t), after + int(vis.sum())
            if not vis.all():
                keep_triangles(j, arrays, p, vis)
        save(path, j, arrays)
        total[0] += before
        total[1] += after
        print(f"HIDDEN {pid:24s} {os.path.relpath(path, HERE):48s} {before} -> {after} ({before - after} hidden)")
    print("HIDDEN_OK", total[0], "->", total[1])


def covering_hats():
    return [p for p in CAT.get("robloxAccessories", []) if p.get("coversHair")]


def mark(path, trees, name, prim_ok=lambda p, j: True, own=True):
    """Mark `name` on the vertices every direction hides, for each tree set in `trees` (all of them: the intersection);
    own: the asset occludes too (its outer layers hide its inner ones, so what the hat leaves of it is drawn whole)."""
    j, arrays = load_all(path)
    if own:
        mine = bvh(np.concatenate([arrays[p["attributes"]["POSITION"]].astype(float)[arrays[p["indices"]].reshape(-1, 3)] for p in primitives(j)]))
        trees = [t + [mine] for t in trees]
    cut = n = 0
    for p in primitives(j):
        if not prim_ok(p, j):
            continue
        pos = arrays[p["attributes"]["POSITION"]].astype(float)
        hid = np.ones(len(pos), bool)
        for t in trees:                                  # hidden under every hat: each alone (with the head and body)
            idx = np.nonzero(hid)[0]
            if not len(idx):
                break
            hid[idx] = hidden_everywhere(t, pos[idx])
        set_mask(j, arrays, p, name, hid)
        tri = arrays[p["indices"]].reshape(-1, 3)
        cut += int(hid[tri].all(1).sum())
        n += len(tri)
    save(path, j, arrays)
    return cut, n


def hatcut():
    base = bvh(BASE)
    hats = [[base, bvh(tris_of(os.path.join(HERE, h["glb"])))] for h in covering_hats()]
    print("HATS", [h["id"] for h in covering_hats()])
    for p in selected([h for h in CAT["hair"] if h.get("full")]):
        for path in hair_paths(p):
            cut, n = mark(path, hats, "_HATCUT")
            print(f"HATCUT {p['id']:24s} {os.path.relpath(path, HERE):48s} {cut} of {n} triangles under every covering hat")
    print("HATCUT_OK")


def hoodcut():
    base = bvh(BASE)
    hood = next(p for p in CAT.get("robloxAccessories", []) if p["id"] == "acc_bear_hood")
    trees = [[base, bvh(tris_of(os.path.join(HERE, hood["glb"])))]]           # the head occludes itself: base

    def head_skin(p, j):
        mesh = next(m for m in j["meshes"] if p in m["primitives"])
        return j["materials"][p["material"]]["name"] == "M_Skin" and "Head" in mesh["name"]
    for path in (os.path.join(HERE, CAT["base"]["clips_glb"]), os.path.join(HERE, "lod1", "base", "skin.glb")):
        cut, n = mark(path, trees, "_HOODCUT", head_skin, own=False)
        print(f"HOODCUT {os.path.relpath(path, HERE):48s} {cut} of {n} head triangles under the hood")
    print("HOODCUT_OK")


def tri_count(path, cut=None):
    j, arrays = load_all(path)
    n = 0
    for p in primitives(j):
        tri = arrays[p["indices"]].reshape(-1, 3)
        if cut and cut in p["attributes"]:
            n += int((~(arrays[p["attributes"][cut]][:, 0] > 0.5)[tri].all(1)).sum())
        else:
            n += len(tri)
    return n


def measure():
    """The heaviest wearable look per tier (budget.test.ts heaviest(), with the hat cut)."""
    parts = CAT["outfits"] + CAT["accessories"] + CAT["hair"] + CAT.get("robloxAccessories", [])
    j, arrays = load_all(os.path.join(HERE, CAT["base"]["clips_glb"]))
    face = sum(len(arrays[p["indices"]]) // 3 for m in j["meshes"] for p in m["primitives"] if j["materials"][p["material"]]["name"] == "M_Face")
    skin = sum(len(arrays[p["indices"]]) // 3 for m in j["meshes"] for p in m["primitives"] if j["materials"][p["material"]]["name"] == "M_Skin" and m["name"] in ("V8_Head", "V6_Body"))
    lodskin = tri_count(os.path.join(HERE, "lod1", "base", "skin.glb")) + face
    for tier in ("full", "lod1", "lod2"):
        def path(p):
            if tier == "full":
                return os.path.join(HERE, p["glb"])
            return os.path.join(HERE, "lod2" if tier == "lod2" and p.get("full") else "lod1", p["glb"])
        tris = {p["id"]: tri_count(path(p)) for p in parts}
        most = lambda f: max([0] + [tris[p["id"]] for p in parts if f(p)])
        outfit = max(most(lambda p: p["slot"] == "top") + most(lambda p: p["slot"] == "bottom"), most(lambda p: p["slot"] == "onepiece"))
        acc = sum(most(lambda p, g=g: p.get("group") == g) for g in ("face", "bag", "neck", "front"))
        band = most(lambda p: p.get("group") == "head" and not p.get("hidesBackHair") and not p.get("coversHair"))
        hat = most(lambda p: p.get("coversHair"))
        full = [p for p in parts if p["slot"] == "back" and p.get("full")]
        hair = max([most(lambda p: p["slot"] == "bangs") + most(lambda p: p["slot"] == "back" and not p.get("full")) + band]
                   + [tris[p["id"]] + band for p in full] + [tri_count(path(p), "_HATCUT") + hat for p in full]
                   + [most(lambda p: p["slot"] == "bangs") + most(lambda p: p.get("group") == "head" and p.get("hidesBackHair"))])
        total = (skin + face if tier == "full" else lodskin) + hair + outfit + most(lambda p: p["slot"] == "shoes") + acc
        print(f"MEASURE {tier}: {total} (base {skin + face if tier == 'full' else lodskin}, hair+head {hair}, outfit {outfit}, "
              f"shoes {most(lambda p: p['slot'] == 'shoes')}, face/bag/neck/front {[most(lambda p, g=g: p.get('group') == g) for g in ('face', 'bag', 'neck', 'front')]}, "
              f"heaviest uncut hair {max(tris[p['id']] for p in full)}, non-covering head {band}, covering hat {hat})")


def roundtrip():
    """Read and rewrite one GLB to another path, unchanged in content (a check of the reader and writer)."""
    src, dst = ARGS[1], ARGS[2]
    j, arrays = load_all(src)
    save(dst, j, arrays)
    print("ROUNDTRIP_OK", dst)


if MODE in ("hidden", "hatcut", "hoodcut"):
    BASE = base_tris()
{"hidden": hidden, "hatcut": hatcut, "hoodcut": hoodcut, "measure": measure, "roundtrip": roundtrip}[MODE]()
