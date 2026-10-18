"""What a look never shows, cut from the exported GLBs (David, 2026-10-17: "find ways to not render part of hair or smth
or find ways to lower triangles that aren't displayed"; the character budget stays 7,800 / 5,100 / 4,000).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hidden_cut.py -- <mode> [ids ...]
  then web/scripts/sync-character-assets.mjs

Modes (each rewrites the GLBs in place: the triangles and vertex arrays it keeps, as they were; nothing re-exported):
  hidden   Hidden inner geometry. Every triangle of a whole hairstyle (Full, LOD 1, LOD 2) and of a Roblox accessory
           (Full, LOD 1) that no view from outside can reach is dropped: from each of SAMPLES points on it, no ray in any
           of DIRS directions (the whole sphere: the body draws both sides) gets out past the head, the base body and the
           asset itself. The rest are kept as they are; unused vertices go.
  hatcut   The hair a hat wins over (round 4, David: from the inside of the hat). For each head item with a `hatCut` bit
           (the covering hats: the propeller cap, the drawn top hat, the cowboy, woven and straw hats, #22's ushanka;
           the band: #04's visor), a whole hairstyle's vertex inside the hat's own cavity or poking through its surface
           (cut_by) carries the bit in a `_HATCUT` attribute (the sum of 2^i), per tier on its own mesh. A look wearing
           item i draws none of the hair's triangles whose three vertices carry bit i (rig.ts cutIndex): no hair outside
           the hat goes, and none shows through it.
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


def cut_items():
    """The head items that cut the hair, in bit order: the covering hats (Roblox accessories, then #22's ushanka split off
    its hairstyle) and the bands (#04's visor), each with its `hatCut` bit."""
    items = [p for p in CAT.get("robloxAccessories", []) + CAT["hair"] if p.get("hatCut") is not None]
    return sorted(items, key=lambda p: p["hatCut"])


# Round 4 (David, 2026-10-17: "the delete hair under hat needs to be better mapped, currently hair is being deleted
# outside of hat, map from the inside of hat"): a covering hat cuts only the hair inside its own cavity, and the hair
# that pokes through its surface; never hair outside it. Its cavity is read off its own mesh (hat_frame): round the
# head, in each direction, the hat's lowest point near the head is its rim (the crown's foot, a flap's foot, where a
# cone sits on the head) and that point's distance from the head's axis the cavity's width; a hair vertex is inside when
# it lies above the rim by RIM_CLEAR (round 5: the cut's edge stays well up inside the hat), within that width
# (CAVITY_PAD over), and every way out of it but down meets the hat (ENCLOSE: an opening, a cap's back strap or a gap
# under a crown, shows the hair behind it, which stays). Poking through: a hair vertex RIM_CLEAR above the rim with the
# hat between it and the head's centre, or over the hat with nothing of it above, came out through the hat (a strand through
# a crown, a brim, a cone or a flap), and so did the strand beyond any edge that crosses the hat's surface from a cut
# vertex, as long as it stays above the rim within the hat's reach and not under the hat. So the hair under a brim,
# below a crown's foot, out of a cap's back opening, beside the face past a flap and under a cone's wide skirt stays. A
# band (a visor) cuts the hair outside it, round the front and sides, that covers it (straight in toward the head's axis
# meets it, where it shows) or lies on its bill: the band and its bill show over the hair, and the hair inside the band
# fills its open top, and the hair in front of its logo goes (round 5). A triangle goes only when all three of its
# vertices go.
SECTORS = 24               # directions round the head's axis for a hat's rim, top and reach
RIM_DIP = 0.03             # m: a rim direction this far under its neighbours' median is a dip, not the rim
WRAP_MARGIN = 0.03         # m: a hat's reach, a little over (a poking strand is followed this far out)
BAND_FRONT = 110.0         # degrees from the face: behind that, a band (the visor's strap) lies in the hair, which stays
BAND_OVER = 0.03           # m: hair this far out over a band covers it (further out, thick hair keeps its outer layer over
                           # the band's back: cutting through it left jagged slots, round 4)
CAVITY_PAD = 0.01          # m: the cavity's width over its rim's distance from the head's axis
RIM_CLEAR = 0.035          # m: round 5 (David: "map out the hair deletion higher in the hat"): nothing within this of the
                           # rim goes but hair lying on the hat, so the hair runs on up under the rim and the cut's edge is
                           # always inside the hat
CLEAR_DOWN = 0.03          # m: a cut vertex is hidden this far straight down too (round 5: the edge well up in the hat)
VIEW_DIRS = None           # the views a cavity vertex is hidden from (fib(VIEW_N), hatcut sets it)
VIEW_N = 96
LOGO_HALF = 28.0           # degrees either side of the face: a band's logo (#04's M)
LOGO_OVER = 0.03           # m: and this far over the band's top
CAVITY_REACH = 1.0         # m: how far a way out looks for the hat
BAND_REST = 0.04           # m: and the hair lying this close over its bill (out past the head's reach)
REACH = 0.231              # m: the head's widest reach from its axis (hatcut measures it: head_reach)
HEAD_TREE = None           # the head (hatcut builds it): a band inside it shows nothing


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


AXES = [Vector(v) for v in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
# straight down and four ways 15 degrees off it (an open weave's gaps let one ray through)
DOWN = [Vector((0, -1, 0))] + [Vector((math.sin(math.radians(15)) * c, -math.cos(math.radians(15)), math.sin(math.radians(15)) * s_))
                                for c, s_ in ((1, 0), (-1, 0), (0, 1), (0, -1))]
# the ways out of a hat's cavity but down: straight up, eight round, eight half way up (an opening any of them finds, a
# cap's back or a gap under a crown, shows the hair there, which stays)
# Each way is a small cluster (WEAVE degrees round it, any of them counts): an open weave's narrow gaps do not open the
# cavity, a cap's wide back opening does.
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
UP_WIDE = [Vector((0, 1, 0))] + [Vector((math.sin(math.radians(25)) * c, math.cos(math.radians(25)), math.sin(math.radians(25)) * s_))
                                  for c, s_ in ((1, 0), (-1, 0), (0, 1), (0, -1), (0.7071, 0.7071), (-0.7071, 0.7071), (0.7071, -0.7071), (-0.7071, -0.7071))]
ENCLOSE = [_cluster((0, 1, 0))] + [_cluster((math.cos(k * math.pi / 4) * c, s_, math.sin(k * math.pi / 4) * c))
                                   for k in range(8) for c, s_ in ((1.0, 0.0), (0.7071, 0.7071))]


def cut_by(pos, frame, band, tree, tri=None, weave=False, occ=None):
    """Which hair vertices a head item cuts (see the rule above). weave: an open weave (OPEN_WEAVE), its cavity read
    without the ways out (any ray finds a gap). occ: what else hides the hair (the base and the hair itself): with it,
    the cavity is what no view reaches (round 5)."""
    lo, hi, foot, wide = frame
    a = angle(pos)
    r = np.hypot(pos[:, 0] - HC[0], pos[:, 2] - HC[2])
    if band:
        # round 2 (David: "it's forwards, it's just being covered by the hair"): the hair on the bill (straight down meets it
        # out past the head) or outside the band (straight in toward the head's axis meets it)
        # (the hair inside the band, between it and the head, stays: it fills the visor's open top; above the band, only
        # what lies on the bill goes, never the hair on the scalp over the band's top edge)
        out = np.zeros(len(pos), bool)
        deg = np.abs(np.degrees(np.arctan2(pos[:, 0] - HC[0], pos[:, 2] - HC[2])))
        front = deg <= BAND_FRONT
        # round 5 (David: "04 needs hair deletion near the logo so hair isnt blocking"): the hair in front of the band's
        # face round its logo (LOGO_HALF either side of the face, from the band's foot to over its top) goes
        out |= (deg <= LOGO_HALF) & (r >= around(wide, a) - 0.01) & (pos[:, 1] >= around(lo, a) - 0.005) \
            & (pos[:, 1] <= around(hi, a) + LOGO_OVER)
        for i in np.nonzero((r <= foot[sector(pos)] + BAND_OVER) & front & ~out)[0]:
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
        return out
    rim, width = around(lo, a), around(wide, a)
    deep = pos[:, 1] > rim + RIM_CLEAR                          # round 5: the cut starts well up inside the hat
    cut = np.zeros(len(pos), bool)
    hits = lambda o, d, far=2.0: tree.ray_cast(o, d, far)[0] is not None
    if occ is not None and not weave:
        # round 5 (David: "map out the hair deletion higher in the hat"): the cavity is the hair no view from outside reaches
        # with the hat on (it, the head and body, and the hair's own outer layers in the way of every ray), and no view
        # reaches CLEAR_DOWN under it either: the cut's edge is always inside the hat, from any angle, below too
        cand = np.nonzero((pos[:, 1] > rim) & (r <= foot[sector(pos)]))[0]
        cand = np.array([i for i in cand if any(hits(Vector(pos[i]), e, CAVITY_REACH) for e in UP_WIDE)], int)
        if len(cand):
            trees = occ + [tree]
            hid = hidden_everywhere(trees, pos[cand], VIEW_DIRS)
            k = cand[hid]
            if len(k):
                k = k[hidden_everywhere(trees, pos[k] - np.array([0.0, CLEAR_DOWN, 0.0]), VIEW_DIRS)]
            cut[k] = True
    for i in np.nonzero(pos[:, 1] > rim)[0]:
        if cut[i]:
            continue
        o = Vector(pos[i])
        if occ is None or weave:
            if deep[i] and ((r[i] <= foot[sector(pos[i:i + 1])[0]] and any(hits(o, e, CAVITY_REACH) for e in UP_WIDE)) if weave
                            else (r[i] <= width[i] + CAVITY_PAD and all(any(hits(o, e, CAVITY_REACH) for e in way) for way in ENCLOSE))):
                cut[i] = True                                   # inside the cavity: within its rim, the hat every way out
                continue                                        # but down (not where an opening shows it: a cap's back)
        cut[i] = any(hits(o, d, 1.0) for d in DOWN) and not hits(o, AXES[2])  # lying on the hat (a brim's top, a cone)
    if tri is None:
        return cut
    # a strand that crosses the hat's surface from a cut vertex: the vertex across goes, and from it the strand beyond, as
    # long as it stays above the rim within the hat's reach (hair poking out through a wall or a brim, not the hair that
    # comes out from under the rim)
    nbr = [[] for _ in range(len(pos))]
    for t in tri:
        for x, y in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            nbr[x].append(y)
            nbr[y].append(x)
    reach_ok = deep & (r <= foot[sector(pos)] + WRAP_MARGIN)
    queue, outer = list(np.nonzero(cut)[0]), np.zeros(len(pos), bool)
    while queue:
        v = queue.pop()
        o = Vector(pos[v])
        for u in nbr[v]:
            if cut[u]:
                continue
            d = Vector(pos[u]) - o
            if deep[u] and d.length > 1e-7 and tree.ray_cast(o, d.normalized(), d.length)[0] is not None:
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
    frames, trees = [], []
    for h in items:
        t = tris_of(os.path.join(HERE, h["glb"]))
        frames.append(hat_frame(surface_points(t), reach))
        trees.append(bvh(t))
        lo, hi, foot, wide = frames[-1]
        print(f"HAT {h['hatCut']} {h['id']:24s} {'band' if not h.get('coversHair') else 'covering'} rim y "
              f"{' '.join('-' if np.isnan(x) else f'{x:.2f}' for x in lo)} top y {np.nanmin(hi):.3f}..{np.nanmax(hi):.3f} "
              f"reach {foot.min():.3f}..{foot.max():.3f} cavity {np.nanmin(wide):.3f}..{np.nanmax(wide):.3f} (head {reach:.3f})")
    for p in selected([h for h in CAT["hair"] if h.get("full")]):
        for path in hair_paths(p):
            j, arrays = load_all(path)
            mine = bvh(np.concatenate([arrays[q["attributes"]["POSITION"]].astype(float)[arrays[q["indices"]].reshape(-1, 3)] for q in primitives(j)]))
            cut, n = [0] * len(items), 0
            for prim in primitives(j):
                pos = arrays[prim["attributes"]["POSITION"]].astype(float)
                tri = arrays[prim["indices"]].reshape(-1, 3)
                bits = np.zeros(len(pos), np.int64)
                for i, (h, fr, tree) in enumerate(zip(items, frames, trees)):
                    c = cut_by(pos, fr, not h.get("coversHair"), tree, tri, h["id"] in OPEN_WEAVE, [base, mine])
                    bits |= c.astype(np.int64) << h["hatCut"]
                    cut[i] += int(c[tri].all(1).sum())
                set_mask(j, arrays, prim, "_HATCUT", bits)
                n += len(tri)
            save(path, j, arrays)
            print(f"HATCUT {p['id']:24s} {os.path.relpath(path, HERE):48s} of {n}: {cut} under each item")
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
