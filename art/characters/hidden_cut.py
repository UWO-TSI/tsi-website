"""What a look never shows, cut from the exported GLBs (David, 2026-10-17: "find ways to not render part of hair or smth
or find ways to lower triangles that aren't displayed"; the character budget stays 7,800 / 5,100 / 4,000).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hidden_cut.py -- <mode> [ids ...]
  then web/scripts/sync-character-assets.mjs

Modes (each rewrites the GLBs in place: the triangles and vertex arrays it keeps, as they were; nothing re-exported):
  hidden   Hidden inner geometry. Every triangle of a whole hairstyle (Full, LOD 1, LOD 2) and of a Roblox accessory
           (Full, LOD 1) that no view from outside can reach is dropped: from each of SAMPLES points on it, no ray in any
           of DIRS directions (the whole sphere: the body draws both sides) gets out past the head, the base body and the
           asset itself. The rest are kept as they are; unused vertices go.
  undercap A whole hairstyle's matte under-cap (the triangles whose u < 0) that shows outside the hair (David, 2026-10-27: "gotta
           remove that under layer thing": flat stepped blocks at the temples and the nape, below the hair line). From each of
           four points on a cap triangle, the share of the outward directions (within 70 deg of its normal, of the DIRS
           sphere) that get out past the head, the base body and the hair's own strands (the cap itself doesn't block);
           a triangle with more than UNDERCAP_T (0.1; UNDERCAP_T_HAIR for a hair whose fit needs more cap) of them out is dropped. What stays is the cap behind the hair, filling
           the gaps between strands. Run after hidden, before hatcut; each tier on its own mesh. UNDERCAP_T=<n> in the
           environment tunes it; --dry prints the numbers and writes nothing.
  hatcut   The hair a hat wins over (round 5, David: the cut well up inside the hat). For each head item with a `hatCut`
           bit (the covering hats: the propeller cap, the drawn top hat, the cowboy, woven and straw hats, #22's ushanka;
           the band: #04's visor), a whole hairstyle's vertex that no view reaches with the hat on, well up inside it, or
           that pokes out through its surface (cover_cut; the band and the open weave: cut_by) carries the bit in a
           `_HATCUT` attribute (the sum of 2^i), per tier on its own mesh. A look wearing item i draws none of the hair's
           triangles whose three vertices carry bit i (rig.ts cutIndex): no hair that shows goes, and none shows through
           the hat.
  hoodcut  The head under the hood: the base skin's vertices (the clip base and the LOD 1 skin) the bear hood hides from
           every direction, marked `_HOODCUT`; a look wearing it draws none of the head triangles all marked.
  bodycut  (clothing-v2) The body under each universal garment: the base skin's vertices (the clip base and the LOD 1
           skin) that a garment's model (catalogue `bodyCut` bit i) hides in its rest pose and in every POSE_STEP-th frame
           of every clip, marked `_BODYCUT` (the sum of 2^i): every one of COVER_DIRS rays (its normal and three rings round
           it, the last grazing the skin) meets the garment or the body. A look wearing the garment draws none of the skin triangles all three of
           whose vertices carry its bit (rig.ts cutIndex), so no skin under it can poke through. Then the fit report, at
           Full over the same poses: skin that shows through the garment where it is not cut (`poke`: the garment lies
           just under the skin, before the ray leaves the limb), a bottom showing through a top over it (`layer`), and how
           far the garment strays from the body (`float`: the most any vertex moves off the body over its rest distance). `-- bodycut fit`
           reports without marking (`step=N`: every Nth frame, for a quick look). Rerun after build_outfits.py and
           build_lod.py.
  measure  The heaviest wearable look at Full, LOD 1 and LOD 2 (budget.test.ts's rule, with the hat cut), printed.
  tris     The catalogue's `tris` from the Full GLBs (hidden runs it).
Run hidden first (it changes the meshes), then hatcut, hoodcut and bodycut (marks on the final meshes); rerun after any
hair, hat, garment or base rebuild (import_hair.py, import_roblox.py, build_outfits.py, build_lod.py).
"""
import bpy, json, math, os, struct, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE, ONLY = (ARGS[0] if ARGS else "measure"), set(a for a in ARGS[1:] if not a.startswith("--"))
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


UNDERCAP_T = float(os.environ.get("UNDERCAP_T", "0.1"))
# a hairstyle whose cap the fit check needs more of (at 0.1, hair_dreads_cap's gap_max stood 11 mm at the nape: the smallest cap that
# passes keeps all but the clearly exposed triangles)
UNDERCAP_T_HAIR = {"hair_dreads_cap": 0.35}


def undercap():
    """Drop the under-cap triangles that show outside the hair (see the module doc)."""
    base = bvh(BASE)
    w = np.array([[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]])
    dry = "--dry" in ARGS
    total = [0, 0]
    for p in selected([h for h in CAT["hair"] if h.get("full")]):
        for path in hair_paths(p):
            j, arrays = load_all(path)
            for prim in primitives(j):
                pos = arrays[prim["attributes"]["POSITION"]].astype(float)
                uv = arrays[prim["attributes"]["TEXCOORD_0"]]
                idx = arrays[prim["indices"]].reshape(-1, 3).astype(int)
                cap = (uv[idx][:, :, 0] < 0).all(1)
                if not cap.any():
                    continue
                strands = bvh(pos[idx[~cap]])
                t = pos[idx[cap]]
                nrm = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
                nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
                nrm *= np.where(((t.mean(1) - HC) * nrm).sum(1) < 0, -1.0, 1.0)[:, None]          # outward, away from the head
                expo = np.zeros(len(t))
                for i in range(len(t)):
                    dirs = DIRS[DIRS @ nrm[i] > 0.34]
                    pts = w @ t[i]
                    n_out = sum(all(tr.ray_cast(Vector(pt + d * SAMPLES_EPS), Vector(d), 4.0)[0] is None for tr in (base, strands)) for pt in pts for d in dirs)
                    expo[i] = n_out / (len(pts) * len(dirs))
                shown = expo > UNDERCAP_T_HAIR.get(p["id"], UNDERCAP_T)
                if dry:
                    print(f"UNDERCAP {p['id']:24s} {os.path.basename(os.path.dirname(os.path.dirname(path)))} cap {len(t)} shown {int(shown.sum())} "
                          f"expo pct 10/25/50/75/90 {np.round(np.percentile(expo, [10, 25, 50, 75, 90]), 2).tolist()}")
                    continue
                keep = np.ones(len(idx), bool)
                keep[np.nonzero(cap)[0][shown]] = False
                total[0] += int(cap.sum())
                total[1] += int(shown.sum())
                keep_triangles(j, arrays, prim, keep)
                print(f"UNDERCAP {p['id']:24s} {os.path.relpath(path, HERE):48s} cap {len(t)} cut {int(shown.sum())}")
            if not dry:
                save(path, j, arrays)
    print("UNDERCAP_OK cap triangles", total[0], "cut", total[1])
    if not dry:
        tris()


def cut_items():
    """The head items that cut the hair, in bit order: the covering hats (Roblox accessories, then #22's ushanka split off
    its hairstyle) and the bands (#04's visor), each with its `hatCut` bit."""
    items = [p for p in CAT.get("robloxAccessories", []) + CAT["hair"] if p.get("hatCut") is not None]
    return sorted(items, key=lambda p: p["hatCut"])


# Round 5 (David, 2026-10-18: "18 hair deletion is showing, map out the hair deletion higher in th hat", and the same for
# #21, #24 and #22). A covering hat (cover_cut) cuts two things and nothing else:
#   inside   the hair no view reaches with the hat on: every one of VIEW_N directions from it meets the hat, the head and
#            body, or the hair itself (its outer layers, and the hair that runs on under the rim). Only hair under the
#            hat is asked (an up ray meets it). It is asked twice, the second time without the poking hair, which no
#            longer hides what was behind it. And a hidden vertex goes only when all the hair within CUT_CLEAR of it is
#            hidden too (or pokes out): so the cut's edge stays well up inside the hat, the hair runs on up under the rim,
#            and no view, front, side, back, high or low, sees a cut edge, a stub or the scalp between the hair and the hat.
#   poking   the hair that comes out through the hat's surface: over the hat (straight down meets it) with nothing of
#            it above (a brim's top, a cone) or the hat between it and the head's centre (out through a crown's wall), or at
#            the outer end of an edge of the hair that crosses the hat's surface (its inner end goes with it, so the
#            triangle across goes whole; and a root just under a brim, ROOT_CLEAR, with a strand up through it), and from
#            there the strand beyond while it stays above the rim within the hat's reach; and what the cut leaves of a
#            strand out there, a piece of FRAG_MAX points or fewer, goes with it (no floating tips). Hair hanging out
#            under the hat (straight up meets it, nothing of it below, and not outside a flap: under a brim or a crown)
#            always stays.
# Round 4's rule (David, 2026-10-17: "map from the inside of hat") read the cavity off the hat's own mesh and cut hair
# that still showed under a brim. It stays for the covering hats David did not send back (ROUND4: #01's cap, and the
# woven hat, an open weave whose gaps are the hat; he accepted the hair under its skirt showing through them).
# A band (#04's visor, cut_by) cuts the hair outside it, round the front and sides, that covers it (straight in toward
# the head's axis meets it, where it shows) or lies on its bill: the band and its bill show over the hair, and the hair
# inside the band fills its open top. Round 5 (David: "04 needs hair deletion near the logo so hair isnt blocking"): and
# every hair triangle in front of its logo, seen from the front and 3/4 (LOGO_VIEWS), goes.
# A triangle goes only when all three of its vertices go.
SECTORS = 24               # directions round the head's axis for a hat's rim, top and reach
RIM_DIP = 0.03             # m: a rim direction this far under its neighbours' median is a dip, not the rim
WRAP_MARGIN = 0.03         # m: a hat's reach, a little over (a poking strand is followed this far out)
BAND_FRONT = 110.0         # degrees from the face: behind that, a band (the visor's strap) lies in the hair, which stays
BAND_OVER = 0.03           # m: hair this far out over a band covers it (further out, thick hair keeps its outer layer over
                           # the band's back: cutting through it left jagged slots, round 4)
CAVITY_PAD = 0.01          # m: round 4's cavity: its width over its rim's distance from the head's axis
CAVITY_REACH = 1.0         # m: how far a way out looks for the hat
BAND_REST = 0.04           # m: and the hair lying this close over its bill (out past the head's reach)
REACH = 0.231              # m: the head's widest reach from its axis (hatcut measures it: head_reach)
HEAD_TREE = None           # the head (hatcut builds it): a band inside it shows nothing
CUT_CLEAR = 0.035          # m: round 5: a hidden vertex goes only when all the hair this close to it goes too
ROOT_CLEAR = 0.02          # m: a strand's root this close under a brim it pokes up through goes with it
FRAG_MAX = 16              # a piece of hair the cut leaves this small (points), above the rim and not under the hat, goes
FLAP_CLEAR = 0.05          # m: hair this far over a rim with the hat between it and the head's axis is outside a flap
VIEW_N = 128               # the views a vertex under a hat is hidden from (the whole sphere)
VIEW_DIRS = None           # fib(VIEW_N) (hatcut sets it)
LOGO_HALF = 32.0           # degrees either side of the face: the band's logo (#04's M), a little over
LOGO_VIEWS = [Vector((math.sin(math.radians(y)) * math.cos(math.radians(p)), math.sin(math.radians(p)),
                      math.cos(math.radians(y)) * math.cos(math.radians(p))))
              for y in range(-50, 51, 10) for p in (-10, 0, 12, 25, 40)]   # front and 3/4, a little low to high


def head_reach():
    """The head's widest horizontal reach from its axis (m)."""
    t = tris_of(os.path.join(HERE, CAT["base"]["clips_glb"]), lambda p, j: next(m for m in j["meshes"] if p in m["primitives"])["name"] == "V8_Head")
    v = t.reshape(-1, 3)
    return float(np.hypot(v[:, 0] - HC[0], v[:, 2] - HC[2]).max())


def angle(pos):
    """Each point's direction round the head's axis, in sectors (0 .. SECTORS, continuous)."""
    return (((np.arctan2(pos[:, 0] - HC[0], pos[:, 2] - HC[2]) + math.pi) / (2 * math.pi)) * SECTORS) % SECTORS


def sector(pos):
    return angle(pos).astype(int) % SECTORS


def around(values, a):
    """A per-sector value (NaN: none there) at continuous sector positions a, linear round the circle."""
    k = np.nonzero(~np.isnan(values))[0]
    xs = np.r_[k - SECTORS, k, k + SECTORS] + 0.5
    ys = np.r_[values[k], values[k], values[k]]
    return np.interp(a, xs, ys)


def surface_points(t, n=6):
    """Points spread over triangles (k, 3, 3): a barycentric grid of n steps a side (a low-poly hat's long faces sampled
    along their length, so its rim is found where its surface is, not only at its corners)."""
    w = np.array([(i / n, j / n, 1 - (i + j) / n) for i in range(n + 1) for j in range(n + 1 - i)])
    return np.einsum("sk,tkd->tsd", w, t).reshape(-1, 3)


def hat_frame(pos, reach):
    """A head item's rim, top, footprint and cavity width per sector round the head's axis (glTF axes): its lowest and
    highest points near the head (within 1.35 x the head's reach: a band, a crown's foot, a brim's underside at the crown,
    an ear flap's foot), its farthest reach (the widest of it and its neighbours), and the lowest point's distance from the
    head's axis. Not a plane: an ushanka's flaps come down at the sides only."""
    r = np.hypot(pos[:, 0] - HC[0], pos[:, 2] - HC[2])
    sec = sector(pos)
    near = r < 1.35 * reach
    lo, hi, foot, wide = np.full(SECTORS, np.nan), np.full(SECTORS, np.nan), np.zeros(SECTORS), np.full(SECTORS, np.nan)
    for s_ in range(SECTORS):
        m = sec == s_
        if m.any():
            foot[s_] = r[m].max()
        m &= near
        if m.any():
            k = np.nonzero(m)[0][pos[m][:, 1].argmin()]
            lo[s_], hi[s_], wide[s_] = pos[k, 1], pos[m][:, 1].max(), r[k]
    foot = np.maximum(foot, np.maximum(np.roll(foot, 1), np.roll(foot, -1)))
    # a dip one or two directions wide (a ribbon's tail, a brim's droop near the crown) is not the rim: no lower than
    # RIM_DIP under the median of its five directions (an ushanka's flaps span more and stay)
    ring = np.array([np.nanmedian(np.take(lo, range(k - 2, k + 3), mode="wrap")) if not np.isnan(lo[k]) else np.nan
                     for k in range(SECTORS)])
    lo = np.where(np.isnan(lo), lo, np.maximum(lo, ring - RIM_DIP))
    return lo, hi, foot, wide


def logo_points(t):
    """Points over a band's logo: its wall (not its bill) within LOGO_HALF of the face."""
    c = t.mean(1)
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    deg = np.degrees(np.arctan2(c[:, 0] - HC[0], c[:, 2] - HC[2]))
    wall = (np.abs(deg) <= LOGO_HALF) & (np.abs(n[:, 1]) < 0.6) & (np.hypot(c[:, 0] - HC[0], c[:, 2] - HC[2]) < 1.2 * REACH)
    return surface_points(t[wall], 4)


AXES = [Vector(v) for v in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
# straight down and four ways 15 degrees off it (an open weave's gaps let one ray through)
DOWN = [Vector((0, -1, 0))] + [Vector((math.sin(math.radians(15)) * c, -math.cos(math.radians(15)), math.sin(math.radians(15)) * s_))
                                for c, s_ in ((1, 0), (-1, 0), (0, 1), (0, -1))]
# Round 4's cavity (ROUND4): the ways out of it but down, straight up, eight round, eight half way up, each a small cluster
# (WEAVE degrees round it, any of them counts): an open weave's narrow gaps do not open the cavity, a cap's wide back
# opening does.
WEAVE = 10.0


def _cluster(d):
    d = Vector(d).normalized()
    a = Vector((0, 0, 1)) if abs(d.y) > 0.9 else Vector((0, 1, 0))
    u = d.cross(a).normalized()
    v = d.cross(u).normalized()
    t = math.tan(math.radians(WEAVE))
    return [d] + [(d + (u * x + v * y) * t).normalized() for x, y in ((1, 0), (-1, 0), (0, 1), (0, -1))]


# An open weave (the woven hat: its slats and gaps are the hat): a vertex above its rim and under it anywhere within its
# reach is inside (the weave over it found by any of a wide cluster of up rays), whatever a ray out finds.
OPEN_WEAVE = {"acc_woven_hat"}
# The covering hats David did not send back in round 5 (#01's cap, the woven hat) keep round 4's rule (cut_by), as he saw it.
ROUND4 = {"acc_propeller_cap", "acc_woven_hat"}
UP_WIDE = [Vector((0, 1, 0))] + [Vector((math.sin(math.radians(25)) * c, math.cos(math.radians(25)), math.sin(math.radians(25)) * s_))
                                  for c, s_ in ((1, 0), (-1, 0), (0, 1), (0, -1), (0.7071, 0.7071), (-0.7071, 0.7071), (0.7071, -0.7071), (-0.7071, -0.7071))]
ENCLOSE = [_cluster((0, 1, 0))] + [_cluster((math.cos(k * math.pi / 4) * c, s_, math.sin(k * math.pi / 4) * c))
                                   for k in range(8) for c, s_ in ((1.0, 0.0), (0.7071, 0.7071))]


def weld(pos):
    """One point per position (a UV seam splits a vertex; a strand runs on across it): each vertex's point, the points."""
    _, first, g = np.unique(np.round(pos / 1e-5).astype(np.int64), axis=0, return_index=True, return_inverse=True)
    return g.ravel(), pos[first]


def adjacency(tri, n):
    nbr = [set() for _ in range(n)]
    for t in tri:
        for x, y in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            if x != y:
                nbr[x].add(y)
                nbr[y].add(x)
    return nbr


def cover_cut(pos, tri, frame, tree, base):
    """Which hair vertices a covering hat cuts (round 5, see the rule above): hidden with it on, CUT_CLEAR up inside, or
    poking out through it."""
    from mathutils.kdtree import KDTree
    lo, hi, foot, wide = frame
    g, U = weld(pos)
    T = g[tri]
    V = [Vector(p) for p in U]
    r = np.hypot(U[:, 0] - HC[0], U[:, 2] - HC[2])
    rim = around(lo, angle(U))
    near = (U[:, 1] > rim) & (r <= foot[sector(U)] + WRAP_MARGIN)
    hits = lambda i, d, far=2.0: tree.ray_cast(V[i], d, far)[0] is not None
    hang = {}

    def hanging(i):
        """Under the hat with nothing of it below: hair hanging out under a brim or a crown. Not outside a flap: FLAP_CLEAR
        over the rim (a flap's foot), the hat between it and the head's axis."""
        if i not in hang:
            inward = Vector((HC[0] - U[i, 0], 0.0, HC[2] - U[i, 2]))
            hang[i] = hits(i, AXES[2]) and not any(hits(i, d, 1.0) for d in DOWN) \
                and not (U[i, 1] > rim[i] + FLAP_CLEAR and inward.length > 1e-6 and hits(i, inward.normalized(), inward.length))
        return hang[i]
    under = np.array([near[i] and any(hits(i, e, CAVITY_REACH) for e in UP_WIDE) for i in range(len(U))], bool)
    cand = np.nonzero(under)[0]

    def hidden(skip):
        """The candidates hidden from every view with the hat on, the hair's triangles all of whose points are in skip
        gone."""
        own = bvh(U[T[~skip[T].all(1)]])
        out = np.zeros(len(U), bool)
        c = cand[~skip[cand]]
        out[c[hidden_everywhere([base, own, tree], U[c], VIEW_DIRS)]] = True
        return out
    centre = Vector(HC)

    def through(i):
        """Over the hat (straight down meets it), and nothing of it above (a brim's top, a cone) or the hat between it
        and the head's centre (a strand out through a crown's wall, over the brim)."""
        back = centre - V[i]
        return any(hits(i, d, 1.0) for d in DOWN) and (not hits(i, AXES[2]) or (
            back.length > 1e-6 and tree.ray_cast(V[i], back.normalized(), back.length)[0] is not None))
    nbr = adjacency(T, len(U))
    edges = {}                                                      # the hair's edges through the hat's surface, each
    for v in range(len(U)):                                         # way: how far from its first end the hat is
        for u in nbr[v]:
            d = V[u] - V[v]
            h = tree.ray_cast(V[v], d.normalized(), d.length)[3] if d.length > 1e-7 else None
            if h is not None:
                edges[(v, u)] = h
    inside, poke = hidden(np.zeros(len(U), bool)), np.zeros(len(U), bool)
    for _ in range(4):                                              # the poking hair, then again with what it hid, till
        root = np.zeros(len(U), bool)                               # nothing more shows
        poke |= np.array([near[i] and not inside[i] and through(i) and not hanging(i) for i in range(len(U))], bool)
        for x, y in edges:                                          # an edge through the hat's surface: its end
            if inside[x]:                                           # outside goes (unless it hangs under the hat), its
                root[x] = True                                      # end inside goes with it (the triangle across the
            elif not hanging(x):                                    # surface goes whole)
                poke[x] = True
        queue = list(np.nonzero(poke)[0])
        while queue:                                                # and the strand beyond, out of the hat: above its
            v = queue.pop()                                         # rim, within its reach, not hanging under it
            for u in nbr[v]:
                if poke[u] or (v, u) in edges or not near[u] or hanging(u):
                    continue
                poke[u] = True
                queue.append(u)
        seen = hidden(poke)
        if (seen == inside).all():
            break
        inside = seen
    gone = inside | poke | root
    kd = KDTree(len(U))
    for i, p in enumerate(U):
        kd.insert(p, i)
    kd.balance()
    cut = poke | root
    for i in np.nonzero(inside & ~cut)[0]:
        cut[i] = all(gone[j] for _, j, _ in kd.find_range(U[i], CUT_CLEAR))
    over = lambda i: any(hits(i, d, 1.0) for d in DOWN)
    for (v, u), h in edges.items():                                 # and the root of a strand up through a brim, just
        if cut[u] and not cut[v] and h < ROOT_CLEAR and U[u, 1] > U[v, 1] and over(u):   # under it (ROOT_CLEAR): the
            cut[v] = True                                           # triangle across goes whole, no spike on the brim
    kept = T[~cut[T].all(1)]                                        # a small piece the cut leaves floating out there
    parent = list(range(len(U)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for t in kept:
        for x in t[1:]:
            parent[find(x)] = find(t[0])
    pieces = {}
    for i in np.unique(kept):
        pieces.setdefault(find(i), []).append(i)
    for vs in pieces.values():
        rest = [i for i in vs if not cut[i]]
        if len(rest) < len(vs) and len(rest) <= FRAG_MAX and all(U[i, 1] > rim[i] and not hanging(i) for i in rest):
            cut[rest] = True
    return cut[g]


def cut_by(pos, frame, band, tree, tri=None, weave=False, logo=None):
    """Which hair vertices a band (band: #04's visor) or a ROUND4 hat cuts: round 4's rule (an open weave, OPEN_WEAVE: its
    cavity read with up rays alone, any of which finds the weave), with the logo's views for a band."""
    lo, hi, foot, wide = frame
    a = angle(pos)
    r = np.hypot(pos[:, 0] - HC[0], pos[:, 2] - HC[2])
    if band:
        # round 2 (David: "it's forwards, it's just being covered by the hair"): the hair on the bill (straight down meets it
        # out past the head) or outside the band (straight in toward the head's axis meets it)
        # (the hair inside the band, between it and the head, stays: it fills the visor's open top; above the band, only
        # what lies on the bill goes, never the hair on the scalp over the band's top edge)
        out = np.zeros(len(pos), bool)
        front = np.abs(np.degrees(np.arctan2(pos[:, 0] - HC[0], pos[:, 2] - HC[2]))) <= BAND_FRONT
        for i in np.nonzero((r <= foot[sector(pos)] + BAND_OVER) & front)[0]:
            o = Vector(pos[i])
            inward = Vector((HC[0] - pos[i][0], 0.0, HC[2] - pos[i][2]))
            if inward.length < 1e-6 or tree.ray_cast(o, -inward.normalized(), 1.0)[0] is not None:
                continue                                        # the band is further out: this hair is inside it
            hit = tree.ray_cast(o, AXES[3], BAND_REST)[0]
            under = hit is not None and math.hypot(hit.x - HC[0], hit.z - HC[2]) > 1.1 * REACH   # lying on the bill
            hit = tree.ray_cast(o, inward.normalized(), inward.length)[0]
            # covering the band where it shows: a part of the band inside the head (straight out from it meets the head)
            # hides nothing
            out[i] = under or (hit is not None and HEAD_TREE.ray_cast(hit - inward.normalized() * 1e-4, -inward.normalized(), 1.0)[0] is None)
        if logo is not None and tri is not None and len(tri):
            # round 5: every hair triangle between the logo and a front or 3/4 view, all the way out (the layers behind
            # the first one show once it goes)
            own, front_of = bvh(pos[tri]), set()
            for s_ in logo:
                for d in LOGO_VIEWS:
                    o = Vector(s_) + d * 1e-4
                    if tree.ray_cast(o, d, 2.0)[0] is not None:
                        continue                                # the band's own back, or its bill, in the way
                    for _ in range(64):
                        loc, _n, k, _d = own.ray_cast(o, d, 2.0)
                        if loc is None:
                            break
                        front_of.add(k)
                        o = loc + d * 1e-4
            if front_of:
                out[np.unique(tri[sorted(front_of)])] = True
        return out
    rim, width = around(lo, a), around(wide, a)
    cut = np.zeros(len(pos), bool)
    hits = lambda o, d, far=2.0: tree.ray_cast(o, d, far)[0] is not None
    centre = Vector(HC)
    for i in np.nonzero(pos[:, 1] > rim)[0]:
        o = Vector(pos[i])
        if (r[i] <= foot[sector(pos[i:i + 1])[0]] and any(hits(o, e, CAVITY_REACH) for e in UP_WIDE)) if weave \
                else (r[i] <= width[i] + CAVITY_PAD and all(any(hits(o, e, CAVITY_REACH) for e in way) for way in ENCLOSE)):
            cut[i] = True                                       # inside the cavity: within its rim, the hat every way out
            continue                                            # but down (not where an opening shows it: a cap's back)
        back = centre - o                                       # through the hat: between it and the head's centre,
        cut[i] = (back.length > 1e-6 and hits(o, back.normalized(), back.length)) \
            or (any(hits(o, d, 1.0) for d in DOWN) and not hits(o, AXES[2]))  # or over it (a brim's top, a cone)
    if tri is None:
        return cut
    # a strand that crosses the hat's surface from a cut vertex: the vertex across goes, and from it the strand beyond, as
    # long as it stays above the rim within the hat's reach (hair poking out through a wall or a brim, not the hair that
    # comes out from under the rim)
    nbr = adjacency(tri, len(pos))
    reach_ok = (pos[:, 1] > rim) & (r <= foot[sector(pos)] + WRAP_MARGIN)
    queue, outer = list(np.nonzero(cut)[0]), np.zeros(len(pos), bool)
    while queue:
        v = queue.pop()
        o = Vector(pos[v])
        for u in nbr[v]:
            if cut[u]:
                continue
            d = Vector(pos[u]) - o
            if d.length > 1e-7 and tree.ray_cast(o, d.normalized(), d.length)[0] is not None:
                cut[u] = outer[u] = True                        # across the hat's surface
                queue.append(u)
            elif outer[v] and reach_ok[u] and tree.ray_cast(Vector(pos[u]), AXES[2], 2.0)[0] is None:
                cut[u] = outer[u] = True                        # the strand beyond it, still above the rim and out from
                queue.append(u)                                 # under the hat (the hair under a brim stays)
    return cut


def hatcut():
    items = cut_items()
    assert [h["hatCut"] for h in items] == list(range(len(items))), "the hatCut bits run 0, 1, 2, ... with none missing"
    global REACH, HEAD_TREE, VIEW_DIRS
    reach = REACH = head_reach()
    VIEW_DIRS = fib(VIEW_N)
    base = bvh(BASE)
    HEAD_TREE = bvh(tris_of(os.path.join(HERE, CAT["base"]["clips_glb"]), lambda p, j: next(m for m in j["meshes"] if p in m["primitives"])["name"] == "V8_Head"))
    frames, trees, logos = [], [], []
    for h in items:
        t = tris_of(os.path.join(HERE, h["glb"]))
        frames.append(hat_frame(surface_points(t), reach))
        trees.append(bvh(t))
        logos.append(None if h.get("coversHair") else logo_points(t))
        lo, hi, foot, wide = frames[-1]
        print(f"HAT {h['hatCut']} {h['id']:24s} {'band' if not h.get('coversHair') else 'covering'} rim y "
              f"{' '.join('-' if np.isnan(x) else f'{x:.2f}' for x in lo)} top y {np.nanmin(hi):.3f}..{np.nanmax(hi):.3f} "
              f"reach {foot.min():.3f}..{foot.max():.3f} cavity {np.nanmin(wide):.3f}..{np.nanmax(wide):.3f} (head {reach:.3f})"
              + (f" logo points {len(logos[-1])}" if logos[-1] is not None else ""))
    for p in selected([h for h in CAT["hair"] if h.get("full")]):
        for path in hair_paths(p):
            j, arrays = load_all(path)
            cut, n = [0] * len(items), 0
            for prim in primitives(j):
                pos = arrays[prim["attributes"]["POSITION"]].astype(float)
                tri = arrays[prim["indices"]].reshape(-1, 3)
                bits = np.zeros(len(pos), np.int64)
                for i, (h, fr, tree, logo) in enumerate(zip(items, frames, trees, logos)):
                    if h.get("coversHair") and h["id"] not in ROUND4:
                        c = cover_cut(pos, tri, fr, tree, base)
                    else:
                        c = cut_by(pos, fr, not h.get("coversHair"), tree, tri, h["id"] in OPEN_WEAVE, logo)
                    bits |= c.astype(np.int64) << h["hatCut"]
                    cut[i] += int(c[tri].all(1).sum())
                set_mask(j, arrays, prim, "_HATCUT", bits)
                n += len(tri)
            save(path, j, arrays)
            print(f"HATCUT {p['id']:24s} {os.path.relpath(path, HERE):48s} of {n}: {cut} under each item", flush=True)
    print("HATCUT_OK")


def mark(path, trees, name, prim_ok=lambda p, j: True, own=True, depth=0.0):
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
        out = (pos - HC) / np.linalg.norm(pos - HC, axis=1, keepdims=True)
        for i, t in enumerate(trees):
            hid = hidden_everywhere(t, pos)
            if depth > 0:
                idx = np.nonzero(hid)[0]
                hid[idx] = hidden_everywhere(t, pos[idx] + out[idx] * depth)
            bits |= hid.astype(np.int64) << i
            cut[i] += int(hid[tri].all(1).sum())
        set_mask(j, arrays, p, name, bits)
        n += len(tri)
    save(path, j, arrays)
    return cut, n


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


# ================================================================ bodycut (clothing-v2)
POSE_STEP = next((int(a[5:]) for a in ARGS if a.startswith("step=")), 3)   # every third frame of every clip (step=N), and rest
COVER_TILT = (40.0, 70.0, 87.0)  # degrees from the skin's normal: the rings of COVER_DIRS, the last one grazing (a view down a
                                 # sleeve or a trouser leg)
COVER_RING = 8
POKE_DEPTH = 0.02          # m: a garment this close under an uncut skin vertex (along its normal) shows the skin through it
LAYER_DEPTH = 0.012        # m: a top this close under a bottom's vertex shows the bottom through it


def to_blender(a):
    """glTF axes (y up) to Blender's (z up)."""
    return np.stack([a[:, 0], -a[:, 2], a[:, 1]], 1)


class Rig:
    """The clip base's rig in Blender: each pose's skinning matrices (Blender armature space) by bone name."""

    def __init__(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, CAT["base"]["clips_glb"]))
        self.sc = bpy.context.scene
        self.rig = next(o for o in self.sc.objects if o.type == "ARMATURE")
        self.inv = {b.name: np.array(b.matrix_local.inverted()) for b in self.rig.data.bones}

    def poses(self):
        """(label, {bone: 4x4}) for the rest pose and every POSE_STEP-th frame of every clip."""
        ad = self.rig.animation_data or self.rig.animation_data_create()
        ad.action = None
        self.rig.data.pose_position = "REST"
        self.sc.frame_set(0)
        yield "rest", self.mats()
        self.rig.data.pose_position = "POSE"
        for act in sorted(bpy.data.actions, key=lambda a: a.name):
            ad.action = act
            if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
                ad.action_slot = act.slots[0]
            f0, f1 = (int(round(x)) for x in act.frame_range)
            for f in range(f0, f1 + 1, POSE_STEP):
                self.sc.frame_set(f)
                yield f"{act.name}@{f}", self.mats()

    def mats(self):
        return {pb.name: np.array(pb.matrix) @ self.inv[pb.name] for pb in self.rig.pose.bones}


class Skinned:
    """A GLB's primitives (those keep(p, j) takes), skinned in Blender axes: positions, triangles and normals per pose."""

    def __init__(self, path, keep=lambda p, j: True):
        self.j, self.arrays = load_all(path)
        self.prims = [p for p in primitives(self.j) if keep(p, self.j)]
        names = [self.j["nodes"][n]["name"] for n in self.j["skins"][0]["joints"]]
        self.parts = []
        for p in self.prims:
            a = p["attributes"]
            pos = to_blender(self.arrays[a["POSITION"]].astype(float))
            jn = self.arrays[a["JOINTS_0"]].astype(int)
            w = self.arrays[a["WEIGHTS_0"]].astype(float)
            if self.j["accessors"][a["WEIGHTS_0"]]["componentType"] != 5126:
                w = w / w.sum(1, keepdims=True)
            self.parts.append((pos, jn, w, self.arrays[p["indices"]].reshape(-1, 3).astype(int)))
        self.names = names

    def posed(self, mats):
        """Per primitive: (positions, triangles)."""
        M = np.stack([mats[n] for n in self.names])
        out = []
        for pos, jn, w, tri in self.parts:
            ph = np.c_[pos, np.ones(len(pos))]
            p = np.zeros((len(pos), 3))
            for k in range(4):
                p += w[:, k:k + 1] * np.einsum("nij,nj->ni", M[jn[:, k]], ph)[:, :3]
            out.append((p, tri))
        return out

    def tris(self, mats):
        return np.concatenate([p[t] for p, t in self.posed(mats)])


def vertex_normals(pos, tri):
    """Area-weighted normals, shared by every vertex at one position (the GLB splits vertices at seams)."""
    key = np.unique(np.round(pos, 5), axis=0, return_inverse=True)[1].reshape(-1)
    fn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
    acc = np.zeros((key.max() + 1, 3))
    for k in range(3):
        np.add.at(acc, key[tri[:, k]], fn)
    n = acc[key]
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12), key


def cover_dirs(n):
    """The normal and COVER_RING rays at each COVER_TILT round it (alternate rings turned half a step)."""
    t1 = np.cross(n, [0.0, 0.0, 1.0] if abs(n[2]) < 0.9 else [1.0, 0.0, 0.0])
    t1 /= np.linalg.norm(t1)
    t2 = np.cross(n, t1)
    out = [n]
    for tilt in COVER_TILT:
        a = math.radians(tilt)
        for k in range(COVER_RING):
            ph = 2 * math.pi * (k + 0.5 * (COVER_TILT.index(tilt) % 2)) / COVER_RING
            out.append(math.cos(a) * n + math.sin(a) * (math.cos(ph) * t1 + math.sin(ph) * t2))
    return out


def blocked(trees, o, d, far=2.0):
    ov, dv = Vector(o), Vector(d)
    return any(t.ray_cast(ov, dv, far)[0] is not None for t in trees)


def hit_within(tree, o, d, dist):
    return tree.ray_cast(Vector(o), Vector(d), dist)[0] is not None


def bodycut():
    report_only = "fit" in ARGS[1:]
    models = {}
    for p in CAT["outfits"]:
        if p.get("bodyCut") is not None:
            models.setdefault(p["glb"], (p["bodyCut"], p["slot"], p["id"]))
    rig = Rig()
    body_skin = lambda p, j: j["materials"][p["material"]]["name"] == "M_Skin" and "Body" in next(
        m for m in j["meshes"] if p in m["primitives"])["name"]
    any_skin = lambda p, j: j["materials"][p["material"]]["name"] == "M_Skin"
    tiers = [("full", os.path.join(HERE, CAT["base"]["clips_glb"]), lambda g: os.path.join(HERE, g))]
    if not report_only:
        tiers.append(("lod1", os.path.join(HERE, "lod1", "base", "skin.glb"), lambda g: os.path.join(HERE, "lod1", g)))
    poses = list(rig.poses())
    print(f"BODYCUT {len(poses)} poses, {len(models)} garment models")
    lbs_check(rig, poses, body_skin)
    for tier, skin_path, garment_path in tiers:
        skin = Skinned(skin_path, body_skin)
        occl = Skinned(skin_path, any_skin)                  # the whole skin (head too) also blocks a view
        gar = {glb: Skinned(garment_path(glb)) for glb in models}
        (pos0, tri0), = skin.posed(poses[0][1])
        _, key = vertex_normals(pos0, tri0)
        covered = {glb: np.ones(len(pos0), bool) for glb in models}
        for label, mats in poses:
            (pos, tri), = skin.posed(mats)
            nrm, _ = vertex_normals(pos, tri)
            body = bvh(occl.tris(mats))
            for glb, live in covered.items():
                idx = np.nonzero(live)[0]
                if not len(idx):
                    continue
                trees = [bvh(gar[glb].tris(mats)), body]
                for i in idx:
                    o = pos[i] + nrm[i] * SAMPLES_EPS
                    if not all(blocked(trees, o, d) for d in cover_dirs(nrm[i])):
                        live[i] = False
        bits = np.zeros(len(pos0), np.int64)
        for glb, live in covered.items():
            # one position, one mark: a seam's split vertices are cut together or not at all
            ok = np.ones(key.max() + 1, bool)
            np.logical_and.at(ok, key, live)
            covered[glb] = ok[key]
            bits |= covered[glb].astype(np.int64) << models[glb][0]
            print(f"BODYCUT {tier} {models[glb][2]:16s} bit {models[glb][0]}: {int(covered[glb][tri0].all(1).sum())} of {len(tri0)} skin triangles cut")
        if not report_only:
            j, arrays = load_all(skin_path)
            prim = next(p for p in primitives(j) if body_skin(p, j))
            set_mask(j, arrays, prim, "_BODYCUT", bits)
            save(skin_path, j, arrays)
        if tier == "full":
            fit_report(poses, skin, gar, models, covered)
    print("BODYCUT_OK")


def lbs_check(rig, poses, keep):
    """The skinning here against Blender's own (the evaluated base body) in a running pose: they must agree."""
    from mathutils.kdtree import KDTree
    label, mats = next(p for p in poses if p[0].startswith("Run@"))
    act, f = label.split("@")
    ad = rig.rig.animation_data
    ad.action = bpy.data.actions[act]
    if hasattr(ad, "action_slot") and len(getattr(ad.action, "slots", [])):
        ad.action_slot = ad.action.slots[0]
    rig.sc.frame_set(int(f))
    ob = bpy.data.objects["V6_Body"].evaluated_get(bpy.context.evaluated_depsgraph_get())
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    kd = KDTree(len(vs))
    for i, v in enumerate(vs):
        kd.insert(v, i)
    kd.balance()
    (pos, _), = Skinned(os.path.join(HERE, CAT["base"]["clips_glb"]), keep).posed(mats)
    print(f"LBS_CHECK {label}: worst {max(kd.find(Vector(p))[2] for p in pos) * 1000:.3f} mm from Blender's skinning")


def fit_report(poses, skin, gar, models, covered):
    """Worst over every pose: skin showing through each garment where it is not cut, a bottom through a top, strays."""
    tops = [g for g in models if models[g][1] == "top"]
    bottoms = [g for g in models if models[g][1] == "bottom"]
    poke = {g: (0, "", 0.0, []) for g in models}
    (rest_pos, _), = skin.posed(poses[0][1])
    layer = {(t, b): (0, "") for t in tops for b in bottoms}
    rest_d = {}
    far = {g: (0.0, "") for g in models}
    proxy = Skinned(os.path.join(HERE, CAT["base"]["clips_glb"]),
                    lambda p, j: j["materials"][p["material"]]["name"] in ("M_Skin", "M_Top", "M_Bottom"))
    for label, mats in poses:
        (pos, tri), = skin.posed(mats)
        nrm, _ = vertex_normals(pos, tri)
        body = bvh(proxy.tris(mats))      # the skin, and the base tee and shorts standing in for the torso
        own = bvh(pos[tri])
        posed = {g: gar[g].posed(mats) for g in models}
        trees = {g: bvh(np.concatenate([p[t] for p, t in posed[g]])) for g in models}
        for g in models:
            n, deep, where = 0, 0.0, []
            for i in np.nonzero(~covered[g])[0]:
                # the garment just under the skin, before the ray leaves the limb (not a hand resting on a lap)
                o, d = Vector(pos[i] - nrm[i] * SAMPLES_EPS), Vector(-nrm[i])
                loc = trees[g].ray_cast(o, d, POKE_DEPTH)[0]
                if loc is None:
                    continue
                exit_ = own.ray_cast(o + d * 1e-4, d, POKE_DEPTH)[0]
                if exit_ is None or (loc - o).length < (exit_ - o).length:
                    n += 1
                    deep = max(deep, (loc - o).length)
                    where.append(i)
            if n > poke[g][0]:
                poke[g] = (n, label, deep, where)
            # straying: how much further from the body each vertex is than at rest (the worst vertex)
            gp = np.concatenate([p for p, _ in posed[g]])
            d = np.array([body.find_nearest(Vector(v))[3] for v in gp])
            if label == "rest":
                rest_d[g] = d
            gain = float((d - rest_d[g]).max())
            if gain > far[g][0]:
                far[g] = (gain, label)
        for t in tops:
            for b in bottoms:
                n = 0
                for p, tri_b in posed[b]:
                    nb, _ = vertex_normals(p, tri_b)
                    for v, nv in zip(p, nb):
                        o = v - nv * SAMPLES_EPS
                        if hit_within(trees[t], o, -nv, LAYER_DEPTH) and not hit_within(trees[t], v + nv * SAMPLES_EPS, nv, 0.05):
                            n += 1
                if n > layer[(t, b)][0]:
                    layer[(t, b)] = (n, label)
    for g in models:
        n, label, deep, where = poke[g]
        if where:       # where on the body (rest pose): the skin vertices' spots, rounded to 1 cm
            print(f"  {models[g][2]} poke at", sorted({tuple(np.round(rest_pos[i], 2)) for i in where})[:12])
        print(f"FIT {models[g][2]:16s} poke {n:3d} skin vertices (worst {label or '-'}, {deep * 1000:.1f} mm under the skin)   "
              f"float +{far[g][0] * 1000:.1f} mm off the body at worst ({far[g][1]}) over the rest pose")
    for (t, b), (n, label) in layer.items():
        print(f"LAYER {models[t][2]:16s} over {models[b][2]:16s} {n:3d} bottom vertices through it (worst {label})")


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


if MODE in ("hidden", "hatcut", "hoodcut", "undercap"):
    BASE = base_tris()
{"hidden": hidden, "hatcut": hatcut, "hoodcut": hoodcut, "undercap": undercap, "bodycut": bodycut, "measure": measure, "tris": tris,
 "roundtrip": roundtrip}[MODE]()
