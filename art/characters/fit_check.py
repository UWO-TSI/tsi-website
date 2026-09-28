"""Fit check for everything that sits on the head (specs/avatar-fit.md deliverable 5).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/fit_check.py [-- [--json <out.json>] [--no-fail]]

Measured on the exported GLBs in rest pose (what the engine binds), against the V6_Head of base/v6_clips.glb:
  hair      per bangs/back piece: open (boundary) edges; the air gap between the scalp and the hair's underside
            along rays from the head centre (max, median); share of rays where the hair tucks into the scalp;
            brow_cover = share of the default brows hidden behind the piece from the front (bangs only)
  seam      the crown ledge: how far a bangs piece stands proud of a back piece where both cover the crown,
            over every bangs x back pair
  headwear  hats and bands: gap between the inside of the hat and the hair (or scalp) under it (max, median),
            hair poking out through it, open edges
  glasses   lens centre vs the painted centre of every eye variant, front view
  face      stretch of the face texture on the head where features are painted (worst linear stretch and
            anisotropy of the UV chart), how far round the head the eyes reach (longitude, degrees)
Rays: directions head_point(lat, lon) - HC on a 2 x 3 degree grid; back pieces are measured above lat -30 (the cap;
hanging lengths below it are free by design), bangs above lat -60, only where the hair is within 12 cm of the scalp.
Exits 1 when a threshold fails, unless --no-fail. Numbers: specs/evidence/avatar-fit/fit-*.json.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "base"))
from head_shape import head_point, HC, CHIN, HRZT  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_JSON = ARGS[ARGS.index("--json") + 1] if "--json" in ARGS else None
NO_FAIL = "--no-fail" in ARGS

LIMITS = {
    "hair_open_edges": 0,          # closed shells only
    "hair_gap_max": 0.004,         # m of air under the hair anywhere on the scalp region
    "hair_gap_median": 0.001,
    "seam_ledge_max": 0.003,       # bangs standing proud of the back cap at the crown
    "brow_cover_default": 0.05,    # default brows hidden by the default bangs, front view
    "hat_open_edges": 0,
    "hat_gap_max": 0.010,          # spec: hats sit on the hair, under 1 cm
    "hat_poke_max": 0.002,         # hair showing through a hat
    "glasses_offset_max": 0.012,   # lens centre vs painted eye centre
    "face_stretch_max": 1.2,       # texture stretch where features are painted
    "face_aniso_max": 1.25,
    "eye_reach_max_deg": 48.0,     # ref 18: the lid's outer end sits about 45 degrees round the head
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


def hits(bvh, d, far=0.7):
    out, t = [], 0.0
    while t < far:
        loc, nrm, idx, dist = bvh.ray_cast(HC + d * t, d, far - t)
        if loc is None:
            break
        t += dist
        out.append(t)
        t += 2e-4
    return out


R_SCALP = np.array([(hits(HEAD, d, 0.5) or [np.nan])[-1] for _, _, d in RAYS])   # the outermost head hit


def ray_table(bvh):
    """Per ray: (innermost, outermost) hit distance, NaN where the ray misses."""
    inn = np.full(len(RAYS), np.nan)
    out = np.full(len(RAYS), np.nan)
    for i, (_, _, d) in enumerate(RAYS):
        h = hits(bvh, d)
        if h:
            inn[i], out[i] = h[0], h[-1]
    return inn, out


def stats(a):
    a = a[~np.isnan(a)]
    if not len(a):
        return {"max": None, "median": None, "p95": None, "n": 0}
    return {"max": round(float(a.max()), 4), "median": round(float(np.median(a)), 4),
            "p95": round(float(np.percentile(a, 95)), 4), "n": int(len(a))}


# ================================================================ face: chart stretch, eye reach, painted centres
atlas_img = bpy.data.images.load(os.path.join(HERE, "base", FACEV["atlas"]))
AW, AH = atlas_img.size
ATLAS = np.array(atlas_img.pixels[:], np.float32).reshape(AH, AW, 4)[::-1]      # top row first


def item_alpha(layer, fid, res):
    """The item's alpha drawn into a res x res face canvas (nearest sampling)."""
    x, y, w, h = FACEV["layers"][layer]["items"][fid][:4]
    u0, w0, u1, w1 = FACEV["layers"][layer]["dest"]
    canvas = np.zeros((res, res), np.float32)
    X0, Y0 = int(round(u0 * res)), int(round(w0 * res))
    W_, H_ = max(1, int(round((u1 - u0) * res))), max(1, int(round((w1 - w0) * res)))
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


RES = 256
feature = np.zeros((RES, RES), np.float32)
for layer in ("eyes", "brows", "mouth"):
    for fid in FACEV["layers"][layer]["items"]:
        feature = np.maximum(feature, item_alpha(layer, fid, RES))

worst_stretch, worst_aniso, n_feat = 1.0, 1.0, 0
for P, T in TRI:
    us = [t[0] for t in T]
    ws = [t[1] for t in T]
    i0, i1 = max(0, int(min(us) * RES)), min(RES - 1, int(max(us) * RES) + 1)
    j0, j1 = max(0, int(min(ws) * RES)), min(RES - 1, int(max(ws) * RES) + 1)
    if i1 < 0 or j1 < 0 or i0 >= RES or j0 >= RES:
        continue
    gy, gx = np.mgrid[j0:j1 + 1, i0:i1 + 1]
    U, W = (gx + 0.5) / RES, (gy + 0.5) / RES
    (x0, y0), (x1, y1), (x2, y2) = T
    den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if abs(den) < 1e-12:
        continue
    a = ((y1 - y2) * (U - x2) + (x2 - x1) * (W - y2)) / den
    b = ((y2 - y0) * (U - x2) + (x0 - x2) * (W - y2)) / den
    inside = (a >= 0) & (b >= 0) & (1 - a - b >= 0)
    if not (feature[gy, gx][inside] > 0.1).any():
        continue
    n_feat += 1
    e1 = (P[1] - P[0]).normalized()
    nrm = (P[1] - P[0]).cross(P[2] - P[0]).normalized()
    e2 = nrm.cross(e1)
    S = np.array([[(P[1] - P[0]).dot(e1), (P[2] - P[0]).dot(e1)], [(P[1] - P[0]).dot(e2), (P[2] - P[0]).dot(e2)]])
    Tm = np.array([[x1 - x0, x2 - x0], [y1 - y0, y2 - y0]]) * 2 * FH
    J = Tm @ np.linalg.inv(S)                   # surface metres -> texture metres
    s = np.linalg.svd(J, compute_uv=False)
    worst_stretch = max(worst_stretch, 1 / s[1], s[0])
    worst_aniso = max(worst_aniso, s[0] / s[1])


def lon_of(p):
    return math.degrees(math.atan2(p.x - HC.x, -(p.y - HC.y)))


eye_reach, eye_centres = 0.0, {}
for fid in FACEV["layers"]["eyes"]["items"]:
    a = item_alpha("eyes", fid, RES)
    ys, xs = np.nonzero(a > 0.5)
    for k in range(0, len(xs), 3):
        p = locate((xs[k] + 0.5) / RES, (ys[k] + 0.5) / RES)
        if p is not None:
            eye_reach = max(eye_reach, abs(lon_of(p)))
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
face = {"feature_tris": n_feat, "stretch_max": round(worst_stretch, 3), "aniso_max": round(worst_aniso, 3),
        "eye_reach_deg": round(eye_reach, 1),
        "default_eye_centre_lon_deg": round(abs(lon_of(dflt["L"])), 1) if dflt.get("L") else None,
        "default_eye_centre_z": round(dflt["L"].z, 4) if dflt.get("L") else None}

# ================================================================ hair
hair = {}
tables = {}
for part in CAT["hair"]:
    groups, open_e, _ = load_glb(os.path.join(HERE, part["glb"]))
    bvh, _ = bvh_of(groups)
    inn, out = ray_table(bvh)
    tables[part["id"]] = (inn, out)
    region = (LAT >= (-60 if part["slot"] == "bangs" else -30))
    on = region & ~np.isnan(inn) & (inn - R_SCALP <= 0.12)
    gap = np.where(on, np.maximum(0.0, inn - R_SCALP), np.nan)
    rec = {"slot": part["slot"], "tris": part["tris"], "open_edges": open_e, "gap": stats(gap),
           "tuck_share": round(float(np.mean((inn - R_SCALP)[on] <= 5e-4)), 3) if on.any() else None,
           "outer_median": stats(np.where(on, out - R_SCALP, np.nan))["median"]}
    if part["slot"] == "bangs" and BROW_PTS:
        hidden = sum(1 for p in BROW_PTS if bvh.ray_cast(p + Vector((0, -1e-3, 0)), Vector((0, -1, 0)), 1.0)[0] is not None)
        rec["brow_cover"] = round(hidden / len(BROW_PTS), 3)
    hair[part["id"]] = rec
    print(f"HAIR {part['id']:20s} open={open_e:3d} gap max={rec['gap']['max']} med={rec['gap']['median']} "
          f"tuck={rec['tuck_share']} outer={rec['outer_median']}" + (f" brow_cover={rec.get('brow_cover')}" if "brow_cover" in rec else ""))

crown = (LAT >= 30) & (np.abs(LON) <= 70)
ledges = {}
for b in (p["id"] for p in CAT["hair"] if p["slot"] == "bangs"):
    for k in (p["id"] for p in CAT["hair"] if p["slot"] == "back"):
        ob, ok = tables[b][1], tables[k][1]
        m = crown & ~np.isnan(ob) & ~np.isnan(ok)
        ledges[f"{b}+{k}"] = round(float((ob - ok)[m].max()), 4) if m.any() else 0.0
worst_pair = max(ledges, key=ledges.get)
seam = {"ledge_max": ledges[worst_pair], "worst_pair": worst_pair,
        "default_pair": ledges[f"{DEFAULT_BANGS}+{DEFAULT_BACK}"],
        "median_over_pairs": round(float(np.median(list(ledges.values()))), 4)}

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
    under = [tables[DEFAULT_BANGS]] + ([] if part["hidesBackHair"] else [tables[DEFAULT_BACK]])
    h_in, h_out = ray_table(hat_bvh)
    if tuck_bvh:
        under.append(ray_table(tuck_bvh))
    hair_hits = []
    for i, (_, _, d) in enumerate(RAYS):
        hs = [R_SCALP[i]]
        for inn, out in under:
            if not np.isnan(inn[i]):
                hs += [inn[i], out[i]]
        hair_hits.append(hs)
    if part["hidesBackHair"]:           # hats: the crown only (brims hang outside the head below these latitudes)
        region = np.where(np.abs(LON) < 45, LAT >= 44, np.where(np.abs(LON) < 135, LAT >= 28, LAT >= 14))
    else:
        region = np.ones(len(RAYS), bool)
    on = region & ~np.isnan(h_in) & (h_in - R_SCALP <= 0.15)
    gap = np.full(len(RAYS), np.nan)
    poke = np.full(len(RAYS), np.nan)
    for i in np.nonzero(on)[0]:
        below = [h for h in hair_hits[i] if h <= h_in[i] + 1e-4]
        gap[i] = h_in[i] - max(below)
        poke[i] = max(0.0, max(hair_hits[i]) - h_out[i])
    headwear[part["id"]] = {"open_edges": open_e, "hides_back_hair": part["hidesBackHair"], "gap": stats(gap),
                            "poke_max": stats(poke)["max"]}
    print(f"HEADWEAR {part['id']:20s} open={open_e:3d} gap max={headwear[part['id']]['gap']['max']} "
          f"med={headwear[part['id']]['gap']['median']} poke={headwear[part['id']]['poke_max']}")

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
    check("poke_max", r["poke_max"], LIMITS["hat_poke_max"], pid)
for pid, r in glasses.items():
    check("offset_max", r["offset_max"], LIMITS["glasses_offset_max"], pid)
check("stretch_max", face["stretch_max"], LIMITS["face_stretch_max"], "face")
check("aniso_max", face["aniso_max"], LIMITS["face_aniso_max"], "face")
check("eye_reach_deg", face["eye_reach_deg"], LIMITS["eye_reach_max_deg"], "face")

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
