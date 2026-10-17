"""What a look never shows, cut from the exported GLBs (David, 2026-10-17: "find ways to not render part of hair or smth
or find ways to lower triangles that aren't displayed"; the character budget stays 7,800 / 5,100 / 4,000).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hidden_cut.py -- <mode> [ids ...]
  then web/scripts/sync-character-assets.mjs

Modes (each rewrites the GLBs in place: the triangles and vertex arrays it keeps, as they were; nothing re-exported):
  hidden   Hidden inner geometry. Every triangle of a whole hairstyle (Full, LOD 1, LOD 2) and of a Roblox accessory
           (Full, LOD 1) that no view from outside can reach is dropped: from each of SAMPLES points on it, no ray in any
           of DIRS directions (the whole sphere: the body draws both sides) gets out past the head, the base body and the
           asset itself. The rest are kept as they are; unused vertices go.
  hatcut   The hair under a hat. For each covering hat (catalogue `coversHair`: the propeller cap, the drawn top hat, the
           cowboy, woven and straw hats, bit i = its place in that list, `hatCut` in the catalogue), a whole hairstyle's
           vertex that no view from outside reaches with that hat on (each ray hits the hat, the head, the body or the
           hair's own outer layers) carries the bit in a `_HATCUT` attribute (the sum of 2^i), per tier on its own mesh. A
           look wearing hat i draws none of the hair's triangles whose three vertices carry bit i (rig.ts cutIndex). Only
           what no view reaches goes, so the look is the same.
  hoodcut  The head under the hood: the base skin's vertices (the clip base and the LOD 1 skin) the bear hood hides from
           every direction, marked `_HOODCUT`; a look wearing it draws none of the head triangles all marked.
  measure  The heaviest wearable look at Full, LOD 1 and LOD 2 (budget.test.ts's rule, with the hat cut), printed.
  tris     The catalogue's `tris` from the Full GLBs (hidden runs it).
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


SCALP_KEEP = 0.012       # m: a hairstyle keeps every triangle this close to the head (its under-cap or scalp shell, which
                         # fill the gaps between strands where a ray could slip through unsampled; fit_check measures them)


# a hairstyle that is itself the scalp (manifest `undercap: false`: #20's waves) keeps its whole shell: it is the layer
# the gaps would show through (fit_check measures it), and light (1,248)
SHELL_HAIRS = {h["id"] for who in ("david", "david-b2") for h in json.load(open(os.path.join(HERE, "hair", "source", who, "manifest.json")))["hairs"]
               if h.get("undercap") is False}


def hidden():
    """Drop the triangles no outside view reaches (the head, the base body and the asset occlude)."""
    base = bvh(BASE)
    head = bvh(tris_of(os.path.join(HERE, CAT["base"]["clips_glb"]), lambda p, j: next(m for m in j["meshes"] if p in m["primitives"])["name"] == "V8_Head"))
    w = np.array([[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]])   # the samples on a triangle
    jobs = [(p["id"], path) for p in selected([h for h in CAT["hair"] if h.get("full") and h["id"] not in SHELL_HAIRS]) for path in hair_paths(p)]
    jobs += [(p["id"], path) for p in selected(CAT.get("robloxAccessories", []) + [h for h in CAT["hair"] if not h.get("full")]) for path in acc_paths(p)]
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
            if "/hair/full/" in path:
                c = t.mean(1)
                vis |= np.array([head.find_nearest(Vector(x))[3] < SCALP_KEEP for x in c])
            before, after = before + len(t), after + int(vis.sum())
            if not vis.all():
                keep_triangles(j, arrays, p, vis)
        save(path, j, arrays)
        total[0] += before
        total[1] += after
        print(f"HIDDEN {pid:24s} {os.path.relpath(path, HERE):48s} {before} -> {after} ({before - after} hidden)")
    print("HIDDEN_OK", total[0], "->", total[1])
    tris()


def covering_hats():
    """The covering hats in bit order: the Roblox accessories', then the ones split off a hairstyle (#22's ushanka)."""
    return [p for p in CAT.get("robloxAccessories", []) + CAT["hair"] if p.get("coversHair")]


def mark(path, trees, name, prim_ok=lambda p, j: True, own=True):
    """`name` on each vertex: the sum of 2^i over the tree sets trees[i] that hide it from every direction. own: the asset
    occludes too (its outer layers hide its inner ones, so what is left of it is drawn whole). Returns, per set, the
    triangles all three of whose vertices it hides, and the triangles."""
    j, arrays = load_all(path)
    if own:
        mine = bvh(np.concatenate([arrays[p["attributes"]["POSITION"]].astype(float)[arrays[p["indices"]].reshape(-1, 3)] for p in primitives(j)]))
        trees = [t + [mine] for t in trees]
    cut, n = [0] * len(trees), 0
    for p in primitives(j):
        if not prim_ok(p, j):
            continue
        pos = arrays[p["attributes"]["POSITION"]].astype(float)
        bits = np.zeros(len(pos), np.int64)
        tri = arrays[p["indices"]].reshape(-1, 3)
        for i, t in enumerate(trees):
            hid = hidden_everywhere(t, pos)
            bits |= hid.astype(np.int64) << i
            cut[i] += int(hid[tri].all(1).sum())
        set_mask(j, arrays, p, name, bits)
        n += len(tri)
    save(path, j, arrays)
    return cut, n


def hatcut():
    base = bvh(BASE)
    hats = [[base, bvh(tris_of(os.path.join(HERE, h["glb"])))] for h in covering_hats()]
    print("HATS", [(h["id"], h.get("hatCut")) for h in covering_hats()])
    assert [h.get("hatCut") for h in covering_hats()] == list(range(len(hats))), "each covering hat's hatCut is its bit"
    for p in selected([h for h in CAT["hair"] if h.get("full")]):
        for path in hair_paths(p):
            cut, n = mark(path, hats, "_HATCUT")
            print(f"HATCUT {p['id']:24s} {os.path.relpath(path, HERE):48s} of {n}: {cut} under each covering hat")
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
        print(f"HOODCUT {os.path.relpath(path, HERE):48s} {cut[0]} of {n} head triangles under the hood")
    print("HOODCUT_OK")


def tri_count(path, cut=None, bit=0):
    """Triangles drawn; with cut (an attribute) and bit, those all three of whose vertices carry the bit left out."""
    j, arrays = load_all(path)
    n = 0
    for p in primitives(j):
        tri = arrays[p["indices"]].reshape(-1, 3)
        if cut and cut in p["attributes"]:
            m = (np.rint(arrays[p["attributes"][cut]][:, 0]).astype(np.int64) >> bit) & 1
            n += int((~(m[tri] == 1).all(1)).sum())
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
        hats = [p for p in parts if p.get("coversHair")]
        hatted = {(h["id"], c["id"]): tri_count(path(h), "_HATCUT", c["hatCut"]) + tris[c["id"]] for h in full for c in hats}
        hair = max([most(lambda p: p["slot"] == "bangs") + most(lambda p: p["slot"] == "back" and not p.get("full")) + band]
                   + [tris[p["id"]] + band for p in full] + list(hatted.values())
                   + [most(lambda p: p["slot"] == "bangs") + most(lambda p: p.get("group") == "head" and p.get("hidesBackHair"))])
        total = (skin + face if tier == "full" else lodskin) + hair + outfit + most(lambda p: p["slot"] == "shoes") + acc
        if "--detail" in ARGS:
            (hh, cc), top = max(hatted.items(), key=lambda kv: kv[1])
            print(f"  {tier}: uncut hair + non-covering head {max(tris[p['id']] for p in full) + band}; hatted hair + its hat at most "
                  f"{top} ({hh} under {cc}: {tris[hh]} -> {top - tris[cc]}, the hat {tris[cc]})")
            for g in ("head", "face", "neck", "front", "bag"):
                top = sorted(((tris[p["id"]], p["id"]) for p in parts if p.get("group") == g), reverse=True)[:6]
                print(f"  {tier} {g}: {top}")
        print(f"MEASURE {tier}: {total} (base {skin + face if tier == 'full' else lodskin}, hair+head {hair}, outfit {outfit}, "
              f"shoes {most(lambda p: p['slot'] == 'shoes')}, face/bag/neck/front {[most(lambda p, g=g: p.get('group') == g) for g in ('face', 'bag', 'neck', 'front')]}, "
              f"heaviest uncut hair {max(tris[p['id']] for p in full)}, non-covering head {band}, covering hat {hat})")


def tris():
    """The catalogue's `tris` of every part: its Full GLB's triangles as shipped (after the hidden cut)."""
    raw = open(CAT_PATH).read()
    cat = json.loads(raw)
    n = 0
    for sec in ("outfits", "accessories", "hair", "robloxAccessories"):
        for p in cat.get(sec, []):
            t = tri_count(os.path.join(HERE, p["glb"]))
            n += t != p["tris"]
            p["tris"] = t
    json.dump(cat, open(CAT_PATH, "w"), indent=1)
    print("TRIS_OK", n, "changed")


def roundtrip():
    """Read and rewrite one GLB to another path, unchanged in content (a check of the reader and writer)."""
    src, dst = ARGS[1], ARGS[2]
    j, arrays = load_all(src)
    save(dst, j, arrays)
    print("ROUNDTRIP_OK", dst)


if MODE in ("hidden", "hatcut", "hoodcut"):
    BASE = base_tris()
{"hidden": hidden, "hatcut": hatcut, "hoodcut": hoodcut, "measure": measure, "tris": tris, "roundtrip": roundtrip}[MODE]()
