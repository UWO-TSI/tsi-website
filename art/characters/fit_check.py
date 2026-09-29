"""Fit check for everything that sits on the head (specs/avatar-fit.md deliverable 5).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/fit_check.py [-- [--json <out.json>] [--no-fail]]

Measured on the exported GLBs in rest pose (what the engine binds), against the V6_Head of base/v6_clips.glb:
  hair      per bangs/back piece: open (boundary) edges; the air gap between the scalp and the hair's underside
            along rays from the head centre (max, median); share of rays where the hair tucks into the scalp;
            brow_cover = share of the default brows hidden behind the piece from the front (bangs only)
  seam      the crown ledge over every bangs x back pair: how far the bangs' root edge stands out of the cap, or the
            cap's front edge out of the bangs (0 when each edge is buried in the other piece)
  headwear  hats and bands: air between the piece and the hair it rests on (worn hair, or for hats the hair volume
            hair_vol they are fitted to), how far its outside rises over that hair, hair poking out through it,
            open edges
  glasses   lens centre vs the painted centre of every eye variant, front view
  face      stretch of the face texture on the head where features are painted (worst linear stretch and
            anisotropy of the UV chart), how far round the head the eyes reach (azimuth; also the angle between the
            surface normal under any eye pixel and straight ahead)
Rays: directions head_point(lat, lon) - HC on a 2 x 3 degree grid; back pieces are measured above lat -24 (the caps;
pigtails and lengths hanging below them are free by design), bangs above lat -60, only where the hair is within 12 cm
of the scalp. A gap counts where it also shows on the neighbouring rays (a ray grazing a radial edge wall is not air).
--root <dir>: measure another art/characters tree (the before numbers come from the pre-fit commit).
Exits 1 when a threshold fails, unless --no-fail. Numbers: specs/evidence/avatar-fit/fit-*.json.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "base"))
from head_shape import head_point, HC, CHIN, HRZT, hair_vol  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if "--root" in ARGS:                  # measure another checkout's art/characters (e.g. the before state)
    HERE = os.path.abspath(ARGS[ARGS.index("--root") + 1])
OUT_JSON = ARGS[ARGS.index("--json") + 1] if "--json" in ARGS else None
NO_FAIL = "--no-fail" in ARGS

LIMITS = {
    "hair_open_edges": 0,          # closed shells only
    "hair_gap_max": 0.004,         # m of air under the hair anywhere on the scalp region
    "hair_gap_median": 0.001,
    "seam_ledge_max": 0.003,       # step where bangs and back cap meet over the crown
    "brow_cover_default": 0.05,    # default brows hidden by the default bangs, front view
    "hat_open_edges": 0,
    "hat_gap_max": 0.010,          # spec: hats sit on the hair, under 1 cm of air
    "hat_rise_median": 0.014,      # outside of a hat or band over the hair it rests on, its own shell included (median:
                                   # pompoms, crystals and blossoms stand up on purpose)
    "hat_poke_max": 0.002,         # hair showing through a hat
    "glasses_offset_max": 0.012,   # lens centre vs painted eye centre
    "face_stretch_max": 1.2,       # texture stretch where features are painted
    "face_aniso_max": 1.25,
    "eye_reach_lon_max_deg": 55.0,  # how far round the head (azimuth) any eye pixel sits: ref 18's lid ends ~51 deg
                                    # round, so both eyes stay on the face in 3/4 view (v6 shipped 63)
}
FH = HRZT
DEFAULT_BANGS, DEFAULT_BACK = "bangs_straight", "back_bob"

bpy.ops.wm.read_factory_settings(use_empty=True)
CAT = json.load(open(os.path.join(HERE, "character_catalog.json")))
FACEV = json.load(open(os.path.join(HERE, "base", "face_variants.json")))


# ================================================================ loading
def load_glb(path):
    """Import a GLB and return {material base name: (verts Nx3 world, [polygon index lists])} in rest pose, plus open
    edge count of the whole mesh; everything imported is deleted again."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type == "ARMATURE":
            o.data.pose_position = "REST"
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    out, open_edges, uv_tris = {}, 0, []
    for o in new:
        if o.type != "MESH" or not any(md.type == "ARMATURE" for md in o.modifiers):
            continue                        # skips the importer's bone-shape Icosphere
        e = o.evaluated_get(dg)
        me = e.to_mesh()
        mw = e.matrix_world
        verts = [mw @ v.co for v in me.vertices]
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        open_edges += sum(1 for ed in bm.edges if len(ed.link_faces) < 2)
        bm.free()
        names = [(m.name.split(".")[0] if m else "none") for m in me.materials]
        for p in me.polygons:
            key = names[p.material_index] if names else "none"
            vs, polys = out.setdefault(key, ([], []))
            base = len(vs)
            vs.extend(verts[i] for i in p.vertices)
            polys.append(list(range(base, base + len(p.vertices))))
        if me.uv_layers:
            uvl = me.uv_layers.active.data
            me.calc_loop_triangles()
            for t in me.loop_triangles:
                if names and names[t.material_index] == "M_Face":
                    uv_tris.append(([verts[i].copy() for i in t.vertices], [tuple(uvl[li].uv) for li in t.loops]))
        e.to_mesh_clear()
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images, bpy.data.actions):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    return out, open_edges, uv_tris


def bvh_of(groups, keep=lambda name: True):
    vs, ps = [], []
    for name, (v, p) in groups.items():
        if not keep(name):
            continue
        base = len(vs)
        vs.extend(v)
        ps.extend([[base + i for i in poly] for poly in p])
    return BVHTree.FromPolygons(vs, ps) if ps else None, vs


base_groups, _, FACE_TRIS = load_glb(os.path.join(HERE, "base", "v6_clips.glb"))
HEAD, _ = bvh_of(base_groups, lambda n: n in ("M_Skin", "M_Face"))

# ray grid
LATS = list(range(-70, 90, 2))
LONS = list(range(-180, 180, 3))
RAYS = []
for la in LATS:
    for lo in LONS:
        d = (head_point(la, lo) - HC).normalized()
        RAYS.append((la, lo, d))
LAT = np.array([r[0] for r in RAYS], float)
LON = np.array([r[1] for r in RAYS], float)


def hits(bvh, d, far=0.7, signed=False):
    """Hit distances along HC + t d; signed: (t, +1 leaving a surface's front side / -1 entering) pairs."""
    out, t = [], 0.0
    while t < far:
        loc, nrm, idx, dist = bvh.ray_cast(HC + d * t, d, far - t)
        if loc is None:
            break
        t += dist
        out.append((t, 1 if nrm.dot(d) > 0 else -1) if signed else t)
        t += 2e-4
    return out


R_SCALP = np.array([(hits(HEAD, d, 0.5) or [np.nan])[-1] for _, _, d in RAYS])   # the outermost head hit


def ray_table(bvh, keep_all=False):
    """Per ray: (innermost, outermost) hit distance, NaN where the ray misses (+ every hit list with keep_all)."""
    inn = np.full(len(RAYS), np.nan)
    out = np.full(len(RAYS), np.nan)
    every = []
    for i, (_, _, d) in enumerate(RAYS):
        h = hits(bvh, d, signed=True)
        if h:
            inn[i], out[i] = h[0][0], h[-1][0]
        every.append(h)
    return (inn, out, every) if keep_all else (inn, out)


def air_above(h_list, base, closed):
    """Air between `base` (distance along the ray) and the piece: 0 when base is inside a closed piece (beyond it the
    ray leaves the piece's solids more often than it enters them; overlapping solids count once), else the distance
    to the first surface beyond it (NaN if none). Open sheets have no inside."""
    beyond = [(t, sg) for t, sg in h_list if t > base + 2e-4]
    if not beyond:
        return np.nan
    if closed and sum(sg for _, sg in beyond) > 0:
        return 0.0
    return beyond[0][0] - base


NLA, NLO = len(LATS), len(LONS)


def erode(a):
    """Per ray, the smallest value among it and its four grid neighbours (NaN neighbours ignored)."""
    g = a.reshape(NLA, NLO)
    out = g.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(g, (dy, dx), axis=(0, 1))
        if dy == 1:
            sh[0] = np.nan
        if dy == -1:
            sh[-1] = np.nan
        out = np.where(np.isnan(sh), out, np.fmin(out, sh))
    return np.where(np.isnan(g), np.nan, out).reshape(-1)


def stats(a):
    ok = ~np.isnan(a)
    if not ok.any():
        return {"max": None, "median": None, "p95": None, "n": 0}
    w = int(np.nanargmax(a))
    b = a[ok]
    return {"max": round(float(b.max()), 4), "median": round(float(np.median(b)), 4),
            "p95": round(float(np.percentile(b, 95)), 4), "n": int(len(b)), "worst_at": [int(LAT[w]), int(LON[w])]}


# ================================================================ face: chart stretch, eye reach, painted centres
atlas_img = bpy.data.images.load(os.path.join(HERE, "base", FACEV["atlas"]))
AW, AH = atlas_img.size
ATLAS = np.array(atlas_img.pixels[:], np.float32).reshape(AH, AW, 4)[::-1]      # top row first


def item_alpha(layer, fid, res):
    """The item's alpha drawn into a res x res face canvas (nearest sampling). Items are [x, y, w, h] (drawn over the
    whole layer rect) or [x, y, w, h, dx, dy] (a crop drawn 1:1 at dx, dy canvas px inside the layer rect)."""
    it = FACEV["layers"][layer]["items"][fid]
    x, y, w, h = it[:4]
    u0, w0, u1, w1 = FACEV["layers"][layer]["dest"]
    k = res / FACEV["canvas"]
    if len(it) >= 6:
        X0, Y0 = u0 * res + it[4] * k, w0 * res + it[5] * k
        W_, H_ = w * k, h * k
    else:
        X0, Y0, W_, H_ = u0 * res, w0 * res, (u1 - u0) * res, (w1 - w0) * res
    canvas = np.zeros((res, res), np.float32)
    X0, Y0, W_, H_ = int(round(X0)), int(round(Y0)), max(1, int(round(W_))), max(1, int(round(H_)))
    ys = (np.arange(H_) + 0.5) / H_ * h
    xs = (np.arange(W_) + 0.5) / W_ * w
    cell = ATLAS[(y + ys.astype(int)).clip(0, AH - 1)][:, (x + xs.astype(int)).clip(0, AW - 1), 3]
    ya, xa = slice(max(0, Y0), min(res, Y0 + H_)), slice(max(0, X0), min(res, X0 + W_))
    canvas[ya, xa] = cell[ya.start - Y0:ya.stop - Y0, xa.start - X0:xa.stop - X0]
    return canvas


def uv_canvas(uv):
    return uv[0], 1.0 - uv[1]


TRI = []   # (P0, P1, P2, (U, W) x3)
for P, uvs in FACE_TRIS:
    TRI.append((P, [uv_canvas(u) for u in uvs]))


def locate(U, W):
    """Canvas point -> 3D point on the face (None off the face chart)."""
    for P, T in TRI:
        (x0, y0), (x1, y1), (x2, y2) = T
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-12:
            continue
        a = ((y1 - y2) * (U - x2) + (x2 - x1) * (W - y2)) / den
        b = ((y2 - y0) * (U - x2) + (x0 - x2) * (W - y2)) / den
        c = 1 - a - b
        if a >= -1e-6 and b >= -1e-6 and c >= -1e-6:
            return P[0] * a + P[1] * b + P[2] * c
    return None


def lon_of(p):
    return math.degrees(math.atan2(p.x - HC.x, -(p.y - HC.y)))


def facing(p):
    """Angle (deg) between the head's surface normal at p and straight ahead: 90 minus it is the widest view yaw at
    which p still faces the camera."""
    loc, nrm, _, _ = HEAD.find_nearest(p)
    return math.degrees(math.acos(max(-1.0, min(1.0, -nrm.y))))


RES = 256
LAYER_MASK = {}
for layer in ("eyes", "brows", "mouth"):
    m = np.zeros((RES, RES), np.float32)
    for fid in FACEV["layers"][layer]["items"]:
        m = np.maximum(m, item_alpha(layer, fid, RES))
    LAYER_MASK[layer] = m


def tri_distortion(P, T):
    """(linear stretch, anisotropy) of the texture on one flat face triangle: singular values of surface -> canvas."""
    (x0, y0), (x1, y1), (x2, y2) = T
    e1 = (P[1] - P[0]).normalized()
    nrm = (P[1] - P[0]).cross(P[2] - P[0]).normalized()
    e2 = nrm.cross(e1)
    S = np.array([[(P[1] - P[0]).dot(e1), (P[2] - P[0]).dot(e1)], [(P[1] - P[0]).dot(e2), (P[2] - P[0]).dot(e2)]])
    Tm = np.array([[x1 - x0, x2 - x0], [y1 - y0, y2 - y0]]) * 2 * FH
    s = np.linalg.svd(Tm @ np.linalg.inv(S), compute_uv=False)
    return max(1 / s[1], s[0]), s[0] / s[1]


def covers(T, mask):
    us = [t[0] for t in T]
    ws = [t[1] for t in T]
    i0, i1 = max(0, int(min(us) * RES)), min(RES - 1, int(max(us) * RES) + 1)
    j0, j1 = max(0, int(min(ws) * RES)), min(RES - 1, int(max(ws) * RES) + 1)
    if i1 < i0 or j1 < j0:
        return False
    gy, gx = np.mgrid[j0:j1 + 1, i0:i1 + 1]
    U, W = (gx + 0.5) / RES, (gy + 0.5) / RES
    (x0, y0), (x1, y1), (x2, y2) = T
    den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if abs(den) < 1e-12:
        return False
    a = ((y1 - y2) * (U - x2) + (x2 - x1) * (W - y2)) / den
    b = ((y2 - y0) * (U - x2) + (x0 - x2) * (W - y2)) / den
    inside = (a >= 0) & (b >= 0) & (1 - a - b >= 0)
    return bool((mask[gy, gx][inside] > 0.1).any())


per_layer = {}
worst_stretch, worst_aniso, n_feat, worst_at = 1.0, 1.0, 0, None
for layer, mask in LAYER_MASK.items():
    ls, la = 1.0, 1.0
    for P, T in TRI:
        if not covers(T, mask):
            continue
        st, an = tri_distortion(P, T)
        n_feat += 1
        if st > worst_stretch:
            c = (P[0] + P[1] + P[2]) / 3
            worst_at = [layer, round(lon_of(c)), round(c.z, 3)]
        ls, la = max(ls, st), max(la, an)
        worst_stretch, worst_aniso = max(worst_stretch, st), max(worst_aniso, an)
    per_layer[layer] = {"stretch": round(ls, 3), "aniso": round(la, 3)}


eye_reach, eye_lon, eye_centres = 0.0, 0.0, {}
for fid in FACEV["layers"]["eyes"]["items"]:
    a = item_alpha("eyes", fid, RES)
    ys, xs = np.nonzero(a > 0.5)
    for k in range(0, len(xs), 3):
        p = locate((xs[k] + 0.5) / RES, (ys[k] + 0.5) / RES)
        if p is not None:
            eye_reach = max(eye_reach, facing(p))
            eye_lon = max(eye_lon, abs(lon_of(p)))
    cen = {}
    for side, mask in (("R", xs < RES / 2), ("L", xs >= RES / 2)):     # canvas left = the character's right (-X)
        if mask.any():
            wgt = a[ys[mask], xs[mask]]
            U = float((xs[mask] + 0.5).dot(wgt) / wgt.sum() / RES)
            W = float((ys[mask] + 0.5).dot(wgt) / wgt.sum() / RES)
            cen[side] = locate(U, W)
    eye_centres[fid] = cen

brow = item_alpha("brows", FACEV["layers"]["brows"]["default"], RES)
by, bx = np.nonzero(brow > 0.5)
BROW_PTS = [p for p in (locate((bx[k] + 0.5) / RES, (by[k] + 0.5) / RES) for k in range(0, len(bx), 2)) if p is not None]
dflt = eye_centres[FACEV["layers"]["eyes"]["default"]]
face = {"feature_tris": n_feat, "stretch_max": round(worst_stretch, 3), "aniso_max": round(worst_aniso, 3), "per_layer": per_layer,
        "stretch_worst_at": worst_at, "eye_reach_deg": round(eye_reach, 1), "eye_reach_lon_deg": round(eye_lon, 1),
        "default_eye_centre_lon_deg": round(abs(lon_of(dflt["L"])), 1) if dflt.get("L") else None,
        "default_eye_centre_z": round(dflt["L"].z, 4) if dflt.get("L") else None}

# ================================================================ hair
hair = {}
tables = {}
for part in CAT["hair"]:
    groups, open_e, _ = load_glb(os.path.join(HERE, part["glb"]))
    bvh, _ = bvh_of(groups)
    inn, out, every = ray_table(bvh, keep_all=True)
    tables[part["id"]] = (inn, out)
    region = (LAT >= (-60 if part["slot"] == "bangs" else -24))
    on = region & ~np.isnan(inn) & (inn - R_SCALP <= 0.12) & (out - R_SCALP >= -0.005)   # (not a ray grazing a hidden fan)
    air = np.array([air_above(every[i], R_SCALP[i], open_e == 0) if on[i] else np.nan for i in range(len(RAYS))])
    gap = erode(air)
    rec = {"slot": part["slot"], "tris": part["tris"], "open_edges": open_e, "gap": stats(gap),
           "on_scalp_share": round(float(np.mean(air[on] <= 5e-4)), 3) if on.any() else None,
           "outer_median": stats(np.where(on, out - R_SCALP, np.nan))["median"]}
    if part["slot"] == "bangs" and BROW_PTS:
        hidden = sum(1 for p in BROW_PTS if bvh.ray_cast(p + Vector((0, -1e-3, 0)), Vector((0, -1, 0)), 1.0)[0] is not None)
        rec["brow_cover"] = round(hidden / len(BROW_PTS), 3)
    hair[part["id"]] = rec
    print(f"HAIR {part['id']:20s} open={open_e:3d} gap max={rec['gap']['max']} at={rec['gap'].get('worst_at')} med={rec['gap']['median']} "
          f"on_scalp={rec['on_scalp_share']} outer={rec['outer_median']}" + (f" brow_cover={rec.get('brow_cover')}" if "brow_cover" in rec else ""))

def seam_step(ob, ok):
    """The crown ledge between a bangs piece and a back cap, per ray column (fixed lon, |lon| <= 70, lat >= 20): on the
    bangs' last ray, how far they stand out of the cap there; on the cap's first ray, how far its front edge stands
    out of the bangs there. Roots buried under the cap and a cap edge buried under the bangs give <= 0; where only one
    piece is present (a parting, the fringe) there is no seam. Returns (worst step, [lat, lon])."""
    b, k = ob.reshape(NLA, NLO), ok.reshape(NLA, NLO)
    hb, hk = ~np.isnan(b), ~np.isnan(k)
    best, at = 0.0, None
    for j, lon in enumerate(LONS):
        if abs(lon) > 70:
            continue
        for i in range(NLA - 1):
            if LATS[i] < 20:
                continue
            d = None
            if hb[i, j] and not hb[i + 1, j]:                           # bangs top edge: over or under the cap there?
                d = b[i, j] - k[i, j] if hk[i, j] else None
                where = LATS[i]
            if d is not None and d > best:
                best, at = float(d), [where, lon]
            d = None
            if hk[i + 1, j] and not hk[i, j]:                           # cap front edge: over or under the bangs?
                d = k[i + 1, j] - b[i + 1, j] if hb[i + 1, j] else None
                where = LATS[i + 1]
            if d is not None and d > best:
                best, at = float(d), [where, lon]
    return round(best, 4), at


ledges, ledge_at = {}, {}
for b in (p["id"] for p in CAT["hair"] if p["slot"] == "bangs"):
    for k in (p["id"] for p in CAT["hair"] if p["slot"] == "back"):
        ledges[f"{b}+{k}"], ledge_at[f"{b}+{k}"] = seam_step(tables[b][1], tables[k][1])
worst_pair = max(ledges, key=ledges.get)
seam = {"ledge_max": ledges[worst_pair], "worst_pair": worst_pair, "worst_at": ledge_at.get(worst_pair),
        "default_pair": ledges[f"{DEFAULT_BANGS}+{DEFAULT_BACK}"],
        "median_over_pairs": round(float(np.median(list(ledges.values()))), 4),
        "over": {k: [v, ledge_at.get(k)] for k, v in sorted(ledges.items(), key=lambda kv: -kv[1]) if v > LIMITS["seam_ledge_max"]}}

# ================================================================ headwear + glasses
headwear, glasses = {}, {}
for part in CAT["accessories"]:
    if part.get("group") not in ("head", "face"):
        continue
    groups, open_e, _ = load_glb(os.path.join(HERE, part["glb"]))
    if part["group"] == "face":
        vs = [v for g in groups.values() for v in g[0]]
        res = {}
        for side, sx in (("L", 1), ("R", -1)):
            rim = [v for v in vs if sx * v.x > 0.035 and v.y < -0.12]
            if not rim:
                continue
            cx, cz = sum(v.x for v in rim) / len(rim), sum(v.z for v in rim) / len(rim)
            offs = [math.hypot(c[side].x - cx, c[side].z - cz) for c in eye_centres.values() if c.get(side) is not None]
            res[side] = {"lens_centre": [round(cx, 4), round(cz, 4)], "offset_max": round(max(offs), 4),
                         "offset_default": round(math.hypot(dflt[side].x - cx, dflt[side].z - cz), 4)}
        glasses[part["id"]] = {"open_edges": open_e,
                               "offset_max": max(r["offset_max"] for r in res.values()),
                               "offset_default": max(r["offset_default"] for r in res.values()), "sides": res}
        print(f"GLASSES {part['id']:20s} offset max={glasses[part['id']]['offset_max']} default={glasses[part['id']]['offset_default']}")
        continue
    hat_bvh, _ = bvh_of(groups, lambda n: n != "M_Hair")
    tuck_bvh, _ = bvh_of(groups, lambda n: n == "M_Hair")
    hat = part["hidesBackHair"]
    under = [tables[DEFAULT_BANGS]] + ([] if hat else [tables[DEFAULT_BACK]])
    h_in, h_out, h_every = ray_table(hat_bvh, keep_all=True)
    if tuck_bvh:
        under.append(ray_table(tuck_bvh))
    if hat:                             # hats: the crown only (every hat's edge and brim lie below these latitudes)
        region = np.where(np.abs(LON) < 135, LAT >= 46, LAT >= 16)
    else:
        region = np.ones(len(RAYS), bool)
    on = region & ~np.isnan(h_in) & (h_in - R_SCALP <= 0.15)
    gap, rise, poke = (np.full(len(RAYS), np.nan) for _ in range(3))
    for i in np.nonzero(on)[0]:
        # the hair the piece rests on: worn hair where there is some, else (hats) the hair volume they are fitted to
        top = max([R_SCALP[i] + (hair_vol(LAT[i]) if hat else 0.0)] + [o[i] for _, o in under if not np.isnan(o[i])])
        gap[i] = air_above(h_every[i], top, open_e == 0)
        rise[i] = h_out[i] - top
        poke[i] = max(0.0, top - h_out[i])
    headwear[part["id"]] = {"open_edges": open_e, "hides_back_hair": hat, "gap": stats(erode(gap)),
                            "rise": stats(rise), "poke_max": stats(poke)["max"], "poke_at": stats(poke).get("worst_at")}
    print(f"HEADWEAR {part['id']:20s} open={open_e:3d} gap max={headwear[part['id']]['gap']['max']} "
          f"med={headwear[part['id']]['gap']['median']} rise max={headwear[part['id']]['rise']['max']} poke={headwear[part['id']]['poke_max']}")

# ================================================================ verdict
fails = []


def check(name, value, limit, what):
    if value is not None and value > limit + 1e-9:
        fails.append(f"{what}: {name} {value} > {limit}")


for pid, r in hair.items():
    check("open_edges", r["open_edges"], LIMITS["hair_open_edges"], pid)
    check("gap_max", r["gap"]["max"], LIMITS["hair_gap_max"], pid)
    check("gap_median", r["gap"]["median"], LIMITS["hair_gap_median"], pid)
check("ledge_max", seam["ledge_max"], LIMITS["seam_ledge_max"], seam["worst_pair"])
check("brow_cover", hair[DEFAULT_BANGS].get("brow_cover"), LIMITS["brow_cover_default"], DEFAULT_BANGS)
for pid, r in headwear.items():
    check("open_edges", r["open_edges"], LIMITS["hat_open_edges"], pid)
    check("gap_max", r["gap"]["max"], LIMITS["hat_gap_max"], pid)
    check("rise_median", r["rise"]["median"], LIMITS["hat_rise_median"], pid)
    check("poke_max", r["poke_max"], LIMITS["hat_poke_max"], pid)
for pid, r in glasses.items():
    check("offset_max", r["offset_max"], LIMITS["glasses_offset_max"], pid)
check("stretch_max", face["stretch_max"], LIMITS["face_stretch_max"], "face")
check("aniso_max", face["aniso_max"], LIMITS["face_aniso_max"], "face")
check("eye_reach_lon_deg", face["eye_reach_lon_deg"], LIMITS["eye_reach_lon_max_deg"], "face")

report = {"limits": LIMITS, "face": face, "seam": seam, "hair": hair, "headwear": headwear, "glasses": glasses,
          "fails": fails}
print("FACE", json.dumps(face))
print("SEAM", json.dumps(seam))
if OUT_JSON:
    os.makedirs(os.path.dirname(os.path.abspath(OUT_JSON)), exist_ok=True)
    json.dump(report, open(OUT_JSON, "w"), indent=1)
print(f"FIT_CHECK {'PASS' if not fails else 'FAIL'} ({len(fails)} over the limits)")
for f in fails:
    print("  FAIL", f)
if fails and not NO_FAIL:
    sys.exit(1)
