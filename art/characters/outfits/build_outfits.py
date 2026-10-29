"""The outfit library on universal models (clothing-v2, David 2026-10-26: "universal tee hoodie etc and just need to
change the paint over it like design"): one mesh per garment type, every design paint on it (designs.png).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/characters/outfits/build_outfits.py [-- ids ...]
  (ids: rebuild just these parts; the rest keep their GLBs and catalogue entries)

Each model is a shell on base/body_shape.py (the locked v6 torso and limb rings) over the skin, fitted to the clip base's
own skin (weights transferred from it; a skirt's hem keeps its region's, or for the skirts, drape_weights fits them to the
clips) with the skin it covers cut away in the engine (hidden_cut.py bodycut). Each GLB is the 22-bone CharacterRig + one skinned mesh (bind by
bone name, like the hair). Materials are flat palette slots (M_Main, M_Accent, M_Sole, M_Sock) tinted from palette.json
at runtime; a part's design is painted over its M_Main. Parts on one model: tee (base tee, sweater vest), tee with a
collar (collared shirt), long-sleeve (striped), hoodie (pullover; the zip hoodie less its drawstrings), sweater (TSI
crewneck, cardigan, silk sweater), coat (raincoat), shorts (and the overall shorts' bib), trousers, joggers, skirt
(pleated), long skirt, sundress, kimono, cape, slip-ons, sneakers (and loafers), boots (and rain boots), sandals.
Writes outfits/<slot>/<model>.glb, designs.png and the "outfits" and "designs" sections of ../character_catalog.json.
"""
import bpy, json, math, os, shutil, subprocess, sys, tempfile
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import kit  # noqa: E402
from kit import Piece, body as B  # noqa: E402

ONLY = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def body_source():
    """The clip base's body in rest pose as the engine skins it, for weight transfer (clothing-v2): its skin, and the
    base tee and shorts standing in for the torso under clothes. Returns positions (Blender axes), triangles and each
    vertex's {bone: weight}; the imported objects go again before the rig is loaded."""
    cat = json.load(open(os.path.join(HERE, "..", "character_catalog.json")))
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "..", cat["base"]["clips_glb"]))
    pos, tris, wts = [], [], []
    for name in ("V6_Body", "V6_Top", "V6_Bottom"):
        o = bpy.data.objects[name]
        names = [g.name.replace(kit.BONE, "") for g in o.vertex_groups]
        n0 = len(pos)
        for v in o.data.vertices:
            pos.append(o.matrix_world @ v.co)
            wts.append({names[g.group]: g.weight for g in v.groups if g.weight > 1e-4})
        o.data.calc_loop_triangles()
        tris += [tuple(n0 + i for i in t.vertices) for t in o.data.loop_triangles]
    arm = next(o for o in bpy.data.objects if o not in before and o.type == "ARMATURE")
    A, Ai = arm.matrix_world, arm.matrix_world.inverted()
    inv = {b.name.replace(kit.BONE, ""): b.matrix_local.inverted() for b in arm.data.bones}
    DRAPE["bones"] = {b.name.replace(kit.BONE, ""): (A @ b.head_local, A @ b.tail_local) for b in arm.data.bones}
    ad = arm.animation_data or arm.animation_data_create()
    for act in sorted(bpy.data.actions, key=lambda a: a.name):     # the clips' frames (DRAPE_STEP): skinning matrices
        ad.action = act
        if hasattr(ad, "action_slot") and len(getattr(act, "slots", [])):
            ad.action_slot = act.slots[0]
        f0, f1 = (int(round(x)) for x in act.frame_range)
        for f in range(f0, f1 + 1, DRAPE_STEP[act.name not in DRAPE_KEY]):
            scene.frame_set(f)
            DRAPE["poses"].append((DRAPE_KEY.get(act.name, 0.15), f"{act.name}@{f}",
                                   {n: np.array(A @ pb.matrix @ inv[n] @ Ai) for n, pb in
                                    ((pb.name.replace(kit.BONE, ""), pb) for pb in arm.pose.bones)}))
    scene.frame_set(0)
    for o in [o for o in bpy.data.objects if o not in before]:
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.actions, bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    return pos, tris, wts


DRAPE_STEP = (2, 8)     # every 2nd frame of the DRAPE_KEY clips, every 8th of the rest
DRAPE_KEY = {"Idle": 1.0, "Walk": 1.0, "Run": 1.0, "Jump": 1.0, "Air": 1.0, "Land": 1.0, "Fall": 1.0, "Sit": 1.0, "SitGround": 1.0,
             "SitWarm": 1.0, "CrouchIdle": 0.4, "CrouchWalk": 0.4}     # each clip's weight in drape_weights (the rest 0.15)
DRAPE = {"poses": []}       # the clips' poses for drape_weights: [(weight, label, {bone: 4x4 skinning matrix})], the rest bones
BODY = body_source()
rig = kit.load_rig(scene)

CL, X0 = B.CL, B.ARM_X0
Z_TEE, Z_CHEST, Z_SH, Z_NECK = B.WAIST - 0.012, B.SH_Z - 0.08, B.SH_Z - 0.01, B.SH_Z + 0.03
R8 = [45 * k for k in range(8)]
R10 = [36 * k for k in range(10)]
P8 = [22.5 + 45 * k for k in range(8)]           # flat top/bottom panel (shoes, cape)
SIDES = ((1, "L"), (-1, "R"))
T = B.torso_pt


PARTS, part = kit.registry()

# ================================================================ shell helpers
def trunk(pc, zs, offs, lons=R10, mat=None, caps=(None, None), region="torso"):
    offs = offs if isinstance(offs, (list, tuple)) else [offs] * len(zs)
    pc.region = region
    return pc.band([[T(l, z, o) for l in lons] for z, o in zip(zs, offs)], mat=mat, caps=caps)


def oval(lon, z, rx, ry, cy=0.0, back=0.0):
    """A point on an ellipse round the body; back: more depth at the back centre, easing out by the sides."""
    a = math.radians(lon)
    return Vector((math.sin(a) * rx, cy - math.cos(a) * ry + back * max(0.0, -math.cos(a)) ** 2, z))


def sleeves(pc, xs, offs, lons=R8, mat=None):
    for sx, s in SIDES:
        pc.region = f"arm_{s}"
        pc.band([[B.arm_pt(sx, x, l, o) for l in lons] for x, o in zip(xs, offs)], mat=mat)


def legs(pc, zs, offs, lons=R8, mat=None, top_cap=None):
    """Leg tubes; top_cap=z: each closed at its top by a fan to (leg centre, z) inside the seat, so a thigh raised to
    sit shows the shorts' seat at its back end, not the tube's open end."""
    for sx, s in SIDES:
        pc.region = f"leg_{s}"
        pc.band([[B.leg_pt(sx, z, l, o) for l in lons] for z, o in zip(zs, offs)], mat=mat,
                caps=(None, Vector((sx * B.LEG_X, 0, top_cap)) if top_cap else None))


def r10_ring(z, off, m=2):
    """The torso's own 10-gon at (z, off), each edge split m times: faces stay parallel to the skin and to every
    R10 top, so layered shells never poke through each other between vertices."""
    base = [T(36 * j, z, off) for j in range(10)]
    return [base[j].lerp(base[(j + 1) % 10], i / m) for j in range(10) for i in range(m)]


L20 = [18 * k for k in range(20)]


strip = kit.strip


def stud(pc, lon, z, off, size, mat):
    """Small flat square on the torso shell (buttons, toggles)."""
    keep, pc.mat, pc.region = pc.mat, mat, "torso"
    dl = math.degrees(size / 0.14)
    vs = [pc.v(T(lon + a * dl, z + b * size, off)) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    pc.f(vs, B.torso_at(z, 0)[0])
    pc.mat = keep


def hood_down(pc, off):
    """Hood lying on the upper back: a soft cowl narrowing to a rounded point."""
    rows = [(Z_NECK + 0.005, 116, 0.0), (Z_SH, 98, 0.012), (Z_SH - 0.04, 70, 0.012), (Z_SH - 0.07, 38, 0.004)]
    grid = [[T(180 - hw + 2 * hw * k / 5, z, off + bulge) for k in range(6)] for z, hw, bulge in rows]
    pc.region = "torso"
    pc.band(grid, closed=False, caps=(None, T(180, Z_SH - 0.092, off - 0.004)),
            refs=[B.torso_at(z, 0)[0] for z, _, _ in rows[:-1]])


# ================================================================ clothing-v2: universal garments
# David, 2026-10-26: one universal model per garment type, every design paint on it; nothing pokes through. Each model
# is a shell on the body's own rings (body_shape) with its rings where the skin has its own (arms 0.076/0.138/0.199/
# 0.263, legs 0.289/0.17/0.09/0.035) and none between two of them across a joint (it would sink into the skin as the
# joint bends), so it bends as the skin does. fit() then gives every
# vertex the weights of the nearest body point on its own side (a trouser leg never takes the other thigh's) and the
# shared design layout (design_uv). The skin a model covers through every clip is cut away in the engine
# (hidden_cut.py bodycut: `_BODYCUT`, bit `bodyCut`). Budgets: at or under each garment's old triangles.

SIDE_OF = {"L": "Left", "R": "Right"}


def _side(w):
    l, r = any(b.startswith("Left") for b in w), any(b.startswith("Right") for b in w)
    return "L" if l and not r else "R" if r and not l else None


ARM_BONES = ("Shoulder", "Arm", "ForeArm", "Hand")


def _trees():
    """The body's triangles a vertex may take weights from: on its own side (L, R), anywhere (None), or for the torso of a
    garment ("torso") none that mostly follows an arm: a roomy top's back over the shoulder blade lies nearer the arm's
    root than the back, and would swing with the arm and bare the back (round 2's sweater in a run)."""
    pos, tris, wts = BODY
    arm = lambda i: sum(x for b, x in wts[i].items() if b.endswith(ARM_BONES)) >= 0.5
    out = {}
    for side in ("L", "R", None, "torso"):
        other = {"L": "Right", "R": "Left"}.get(side)
        keep = [t for t in tris if (not other or not any(b.startswith(other) for i in t for b in wts[i])) and
                (side != "torso" or not any(arm(i) for i in t))]
        out[side] = (BVHTree.FromPolygons(pos, keep, all_triangles=True), keep)
    return out


TREES = _trees()


def transfer_weights(ob):
    """Every vertex takes the body's weights at the nearest body point on its own side (from its region weights:
    Left*/Right* bones), interpolated over that triangle; the four largest kept, normalised. A skirt's vertices (region
    "skirt": a skirt, a dress, the coat's flare, the cape) keep their own, the hips blended into both thighs: the nearest
    body point would tear the hem between the legs."""
    pos, _, wts = BODY
    names = [g.name.replace(kit.BONE, "") for g in ob.vertex_groups]
    region = ob["vreg"].split("|")
    new = []
    for vi, v in enumerate(ob.data.vertices):
        own = {names[g.group]: g.weight for g in v.groups if g.weight > 1e-4}
        if region[vi] == "skirt":
            new.append(own)
            continue
        side = _side(own)
        tree, keep = TREES[side if side or any(b.endswith(ARM_BONES) for b in own) else "torso"]
        loc, _, idx, _ = tree.find_nearest(v.co)
        a, b_, c = (pos[i] for i in keep[idx])
        bary = _bary(loc, a, b_, c)
        w = {}
        for k, i in enumerate(keep[idx]):
            for bn, x in wts[i].items():
                w[bn] = w.get(bn, 0.0) + x * bary[k]
        top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(x for _, x in top)
        new.append({bn: x / tot for bn, x in top if x / tot > 1e-3})
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    groups = {}
    for vi, w in enumerate(new):
        for bn, x in w.items():
            if bn not in groups:
                groups[bn] = ob.vertex_groups.new(name=kit.BONE + bn)
            groups[bn].add([vi], x, "REPLACE")


DRAPE_HUG = 3.0         # the pull toward the legs a skirt rides on (drape_weights)
DRAPE_CLEAR = 0.012     # m: the least a skirt keeps off a leg (a shoe, a boot's shaft) in any pose
DRAPE_STEPS = np.round(np.linspace(0, 1, 11), 1)
DRAPE_DIRS = (0, 0.25, 0.5, 0.75, 1)     # round the skirt (0 the front, 1 the back): where its (u, s) field takes values
DRAPE_BARY = np.array([(1, 1, 1), (1, 1, 0), (0, 1, 1), (1, 0, 1), (4, 1, 1), (1, 4, 1), (1, 1, 4)], float)
DRAPE_BARY /= DRAPE_BARY.sum(1, keepdims=True)


def _drape_body():
    """The legs as capsules on their bones, the skin's rings (body_shape.LEG), and round the foot the largest shoe's sole:
    [(bone, a, b, r0, r1)] in the rest pose."""
    (z1, r1) = B.LEG[0]
    z0 = B.CROTCH - 0.01                    # above: the pelvis (the torso's)
    r0 = float(np.interp(z0, [z for z, _ in B.LEG], [r for _, r in B.LEG]))
    knee = DRAPE["bones"]["LeftLeg"][0].z
    rk = float(np.interp(knee, [z for z, _ in B.LEG], [r for _, r in B.LEG])) + 0.008     # a bent knee bulges
    caps = []
    for sx, s in ((1, "Left"), (-1, "Right")):
        x = sx * B.LEG_X
        caps += [(f"{s}UpLeg", np.array((x, 0, z0)), np.array((x, 0, knee)), r0, rk),
                 (f"{s}Leg", np.array((x, 0, knee)), np.array((x, 0, z1)), rk, r1),
                 (f"{s}Foot", np.array((x, 0.03, 0.032)), np.array((x, -0.055, 0.032)), 0.045, 0.045)]
    return caps


def _drape_sdf(p, caps, hips):
    """Signed distance less the clearance from points p (c, n, k, 3), n poses, to the posed body: capsules [(a (n, 3),
    b (n, 3), r0, r1)], the torso (hips: the inverse of its skinning matrix per pose, back to its rest frame)."""
    d = np.full(p.shape[:-1], np.inf)
    for a, b, r0, r1 in caps:
        a, ab = a[:, None, :], (b - a)[:, None, :]
        t = np.clip(((p - a) * ab).sum(-1) / (ab * ab).sum(-1), 0, 1)
        d = np.minimum(d, np.linalg.norm(p - a - t[..., None] * ab, axis=-1) - (r0 + (r1 - r0) * t) - DRAPE_CLEAR)
    q = np.einsum("nij,cnkj->cnki", hips[:, :3, :3], p) + hips[None, :, None, :3, 3]
    zs = [c.z for c, _, _ in B.TORSO]
    z = np.clip(q[..., 2], zs[0], B.WAIST)
    rx, ry, cy = (np.interp(z, zs, [r[k] for r in ((a, b, c.y) for c, a, b in B.TORSO)]) for k in range(3))
    e = (np.hypot(q[..., 0] / rx, (q[..., 1] - cy) / ry) - 1) * np.minimum(rx, ry)
    return np.where((q[..., 2] >= zs[0]) & (q[..., 2] <= B.WAIST - 0.03), np.minimum(d, e), d)


def drape_weights(ob):
    """A skirt's weights fitted to the clips (round 3, David: "long dress clothes going though body, the 2 skirts are
    flashing when sitting down"). Below the hips each skirt vertex mixes three bases: the hips (the region's torso
    weights), both thighs and both shins (split left and right by x), as (1 - u - s, u, s). (u, s) is a smooth field:
    per ring of the skirt, a value at each of DRAPE_DIRS round it, eased between them, mirrored left and right.
    Value by value, sweep after sweep, it takes the one on DRAPE_STEPS that best keeps the skirt's surface (its vertices
    and points across its triangles, posed as the engine draws them) DRAPE_CLEAR off the legs, the feet and the torso in
    the clips' poses, with the least pull off the hips, close to the legs it rides on, and no fold or tear."""
    me = ob.data
    region = ob["vreg"].split("|")
    P = np.array([ob.matrix_world @ v.co for v in me.vertices])
    free = np.array([i for i, r in enumerate(region) if r == "skirt" and P[i, 2] < B.CROTCH + 0.03])
    poses = DRAPE["poses"]
    pw = np.array([w for w, _, _ in poses])
    caps = [(np.array([(m[bn] @ np.r_[a, 1])[:3] for _, _, m in poses]), np.array([(m[bn] @ np.r_[b, 1])[:3] for _, _, m in poses]),
             r0, r1) for bn, a, b, r0, r1 in _drape_body()]
    hips = np.array([np.linalg.inv(m["Hips"]) for _, _, m in poses])
    names = [g.name.replace(kit.BONE, "") for g in ob.vertex_groups]

    def posed(i, w):
        ph = np.r_[P[i], 1.0]
        return sum(x * np.array([m[b] @ ph for _, _, m in poses])[:, :3] for b, x in w.items())

    X = np.zeros((len(P), len(poses), 3))          # every vertex posed; the free ones as (hips, thighs, shins) bases
    bases = {}
    for i in range(len(P)):
        if i not in free:
            X[i] = posed(i, {names[g.group]: g.weight for g in me.vertices[i].groups if g.weight > 1e-4})
            continue
        x, y, z = P[i]
        sl = max(0.0, min(1.0, 0.5 + x / 0.12))
        hip = B.weights("torso", Vector((x, y, max(z, B.CROTCH))))
        bases[i] = (hip, {"LeftUpLeg": sl, "RightUpLeg": 1 - sl}, {"LeftLeg": sl, "RightLeg": 1 - sl})
    HB = np.stack([np.stack([posed(i, w) for w in bases[i]]) for i in free])                  # (f, 3, n, 3)
    # the hem may rise over its knee (the knee of the leg it leans on) no more than it stands over it at rest, + 2 cm:
    # past that a leg comes out under it (a foot kicked back in a run, the shins of a seated long skirt)
    hem = np.array([P[i, 2] == P[free, 2].min() for i in free])
    sl = np.array([bases[i][1]["LeftUpLeg"] for i in free])
    kz = {s: np.array([(m[f"{s}Leg"] @ np.r_[DRAPE["bones"][f"{s}Leg"][0], 1])[2] for _, _, m in poses]) for s in ("Left", "Right")}
    knee_z = sl[:, None] * kz["Left"] + (1 - sl[:, None]) * kz["Right"]                         # (f, n)
    lift_max = (P[free, 2] - DRAPE["bones"]["LeftLeg"][0].z)[:, None] + 0.02
    sitting_up = pw * np.array([m["Hips"][2, 2] > 0.7 for _, _, m in poses])          # the torso upright (not lying)
    upright = pw * np.array([(m["Hips"] @ np.r_[DRAPE["bones"]["Hips"][0], 1])[2] > 0.22 for _, _, m in poses])   # on its feet
    rings = sorted({round(P[i, 2], 3) for i in free}, reverse=True)
    ring = np.array([rings.index(round(P[i, 2], 3)) for i in free])
    th = np.array([math.atan2(abs(P[i, 0]), -P[i, 1]) / math.pi for i in free])             # 0 front, 0.5 side, 1 back
    ease = np.stack([np.clip(1 - abs(th - c) * 4, 0, 1) for c in DRAPE_DIRS], 1)            # (f, d): front ... back
    ease = ease * ease * (3 - 2 * ease)
    ease /= ease.sum(1, keepdims=True)
    me.calc_loop_triangles()
    tri = np.array([t.vertices for t in me.loop_triangles if set(t.vertices) & set(free.tolist())])
    edges = np.array([e.vertices for e in me.edges if set(e.vertices) & set(free.tolist())])
    rest_len = np.linalg.norm(P[edges[:, 0]] - P[edges[:, 1]], axis=1)
    sample_w = (DRAPE_BARY[None] * np.isin(tri, free)[:, None, :]).sum(-1).reshape(-1)   # a point counts by its free share

    def field(prm):                         # prm (rings, directions, 2) -> (f, 2)
        return np.einsum("fd,fdk->fk", ease, prm[ring])

    def cost(prm):
        us = field(prm)
        Xf = (1 - us.sum(1))[:, None, None] * HB[:, 0] + us[:, :1, None] * HB[:, 1] + us[:, 1:, None] * HB[:, 2]
        Y = X.copy()
        Y[free] = Xf
        pts = np.einsum("sk,fknd->nfsd", DRAPE_BARY, Y[tri]).reshape(1, len(poses), -1, 3)
        sd = _drape_sdf(pts, caps, hips)[0]                                                   # (n, points)
        pen = 1e5 * ((np.maximum(0.0, -sd) ** 2) @ sample_w) @ pw
        sdv = _drape_sdf(np.moveaxis(Xf, 0, 1)[None], caps, hips)[0]                          # (n, f)
        hug = DRAPE_HUG * np.clip(sdv, 0, 0.1).sum(1) @ pw
        pull = 2.0 * np.linalg.norm(Xf - HB[:, 0], axis=-1).sum(0) @ pw
        r = np.linalg.norm(Y[edges[:, 0]] - Y[edges[:, 1]], axis=-1) / rest_len[:, None]      # (e, n)
        fold = (np.maximum(0, 0.6 - r) ** 2 + 0.3 * np.maximum(0, r - 1.7) ** 2).sum(0) @ pw
        lift = 1e5 * (np.maximum(0, Xf[hem, :, 2] - knee_z[hem] - lift_max[hem]) ** 2).sum(0) @ sitting_up
        lift += 1e5 * (np.maximum(0, 0.01 - Xf[:, :, 2]) ** 2).sum(0) @ upright          # and nothing under the soles
        return pen + hug + pull + fold + lift, (pen, hug, pull, fold, lift, sd)

    knee = DRAPE["bones"]["LeftLeg"][0].z
    prm = np.zeros((len(rings), len(DRAPE_DIRS), 2))
    for k, z in enumerate(rings):             # start where no leg gets through (riding on the legs), then relax
        leg = B._ss(B.CROTCH + 0.03, B.CROTCH - 0.05, z)
        s = leg * B._ss(knee + 0.03, knee - 0.04, z)
        prm[k, :] = np.round((leg - s, s), 1)
    best = cost(prm)[0]
    for sweep in range(6):
        moved = 0
        for k in range(len(rings)):
            for d in range(len(DRAPE_DIRS)):
                for c in range(2):
                    for v in DRAPE_STEPS:
                        if (v + prm[k, d, 1 - c]) > 1.0001 or v == prm[k, d, c]:
                            continue
                        old, prm[k, d, c] = prm[k, d, c], v
                        e = cost(prm)[0]
                        if e < best - 1e-6:
                            best, moved = e, moved + 1
                        else:
                            prm[k, d, c] = old
        print(f"DRAPE {ob.name} sweep {sweep}: {moved} moves, cost {best:.1f}")
        if not moved:
            break
    _, (pen, hug, pull, fold, lift, sd) = cost(prm)
    us = field(prm)
    for k, z in enumerate(rings):
        print("DRAPE_RING", z, "front to back (u, s):", [tuple(float(x) for x in prm[k, d]) for d in range(len(DRAPE_DIRS))])
    groups = {}
    for (i, (hip, up, leg)), (u, s) in zip(((i, bases[i]) for i in free), us):
        w = {b: x * (1 - u - s) for b, x in hip.items()}
        for dct, f in ((up, u), (leg, s)):
            for b, x in dct.items():
                w[b] = w.get(b, 0.0) + x * f
        top = sorted(((b, x) for b, x in w.items() if x > 1e-3), key=lambda kv: -kv[1])[:4]
        tot = sum(x for _, x in top)
        for g in list(me.vertices[i].groups):
            ob.vertex_groups[g.group].remove([int(i)])
        for b, x in top:
            if b not in groups:
                groups[b] = ob.vertex_groups.get(kit.BONE + b) or ob.vertex_groups.new(name=kit.BONE + b)
            groups[b].add([int(i)], x / tot, "REPLACE")
    worst = np.maximum(0.0, -sd).max(1)
    lab = [l for _, l, _ in poses]
    print(f"DRAPE {ob.name}: pen {pen:.0f} lift {lift:.0f} hug {hug:.0f} pull {pull:.0f} fold {fold:.0f}; inside the clearance at worst: " +
          ", ".join(f"{lab[k]} {worst[k] * 1000:.0f} mm" for k in np.argsort(-worst)[:6]) + "; key poses: " +
          ", ".join(f"{l} {worst[lab.index(l)] * 1000:.0f}" for l in ("Idle@24", "Run@3", "Run@6", "Run@12", "Jump@0", "Sit@24", "SitGround@36", "Walk@12") if l in lab))


def _bary(p, a, b_, c):
    v0, v1, v2 = b_ - a, c - a, p - a
    d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01
    if abs(den) < 1e-12:
        return (1.0, 0.0, 0.0)
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return (1 - v - w, v, w)


# ---------------------------------------------------------------- the design layout (image space: u right, v down)
# Tops: the torso round the body (u 0 = back centre, 0.5 = front centre, toward the character's left), v by height from
# DZ_TOP (0) to DZ_BOT (TORSO_V); each sleeve below it (the character's right in u 0..0.5, left 0.5..1), round the arm
# (the seam underneath) and down it from DX_ARM[0] (TORSO_V) to DX_ARM[1] (1). One-pieces: as tops, the torso from DZ_TOP
# down to the sole. Bottoms: the hips as the torso; each leg (right 0..0.5, left 0.5..1) round it (the seam behind) and
# down it, v = 1 - z / DZ_HIP (above DZ_HIP, an overall's bib, all at v 0). Shoes: each foot (right, left) round it (the
# seam under the sole) and along it from the heel (v 0..FOOT_V), a boot's shaft round the leg and down it from DZ_SHAFT[0]
# (FOOT_V..1). One layout per family, so a design fits every model in it.
DZ_TOP, DZ_BOT, TORSO_V = 0.56, 0.24, 0.625
DX_ARM = (0.07, 0.29)
DZ_HIP = 0.36
DY_FOOT, FOOT_V, DZ_SHAFT = (0.075, -0.1), 0.65, (0.15, 0.02)


def _ring_u(ang):
    """An angle in degrees (0 opposite the seam, which is at 180) to 0..1 round the ring: 0.5 opposite the seam."""
    return ((ang + 180.0) % 360.0) / 360.0


def design_uv(ob, slot):
    """UVMap on every face: where its corners lie in the family's design layout (by region: the vertex's own bones)."""
    me = ob.data
    names = [g.name.replace(kit.BONE, "") for g in ob.vertex_groups]
    region = ob["vreg"].split("|")
    kind = []
    for vi, v in enumerate(me.vertices):
        bones = {names[g.group] for g in v.groups if g.weight > 1e-3}
        side = _side(bones) if region[vi] != "skirt" else None    # a skirt's side panels lean on one thigh: still the body
        limb = next((k for k, bs in (("arm", ("Shoulder", "Arm", "ForeArm", "Hand")), ("foot", ("Foot", "ToeBase")),
                                      ("leg", ("UpLeg", "Leg"))) if side and any(b == SIDE_OF[side] + x for x in bs for b in bones)), None)
        kind.append((limb or "torso", side))
    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        uv = []
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            p = me.vertices[vi].co
            limb, side = kind[vi]
            half = 0.0 if side == "R" else 0.5
            if limb == "arm":
                r_dz = B._interp(B.ARM, abs(p.x))[1]
                u = half + 0.5 * _ring_u(math.degrees(math.atan2(-p.y, p.z - (B.ARM_Z - r_dz))))
                v = TORSO_V + (1 - TORSO_V) * min(1.0, max(0.0, (abs(p.x) - DX_ARM[0]) / (DX_ARM[1] - DX_ARM[0])))
            elif limb == "leg":
                lx = B.LEG_X if side == "L" else -B.LEG_X
                u = half + 0.5 * _ring_u(math.degrees(math.atan2(p.x - lx, -p.y)))
                v = (min(1.0, max(0.0, 1 - p.z / DZ_HIP)) if slot != "shoes" else
                     FOOT_V + (1 - FOOT_V) * min(1.0, max(0.0, (DZ_SHAFT[0] - p.z) / (DZ_SHAFT[0] - DZ_SHAFT[1]))))
            elif limb == "foot":
                lx = B.LEG_X if side == "L" else -B.LEG_X
                u = half + 0.5 * _ring_u(math.degrees(math.atan2(p.x - lx, p.z - 0.03)))
                v = FOOT_V * min(1.0, max(0.0, (DY_FOOT[0] - p.y) / (DY_FOOT[0] - DY_FOOT[1])))
            else:
                c = B.torso_at(min(max(p.z, B.TORSO[0][0].z), B.TORSO[-1][0].z), 0)[0]
                u = _ring_u(math.degrees(math.atan2(p.x, -(p.y - c.y))))
                top = {"top": (DZ_TOP, DZ_BOT, TORSO_V), "onepiece": (DZ_TOP, 0.0, TORSO_V)}.get(slot, (DZ_HIP, 0.0, 1.0))
                v = top[2] * min(1.0, max(0.0, (top[0] - p.z) / (top[0] - top[1])))
            uv.append([u, v, half, limb != "torso"])
        # the seam: a corner on it (u at its island's edge) takes the side the rest of the face is on
        for c in uv:
            lo, hi = c[2] if c[3] else 0.0, (c[2] + 0.5) if c[3] else 1.0
            if min(c[0] - lo, hi - c[0]) < 1e-3:
                rest = [d[0] for d in uv if d is not c and min(d[0] - lo, hi - d[0]) >= 1e-3]
                if rest:
                    c[0] = hi if sum(rest) / len(rest) > (lo + hi) / 2 else lo
        # a face across the seam with no corner on it (the hood's middle column): its corners on the far side of the
        # seam go onto it, or the face would sweep the whole row of the design (the zip and the logo on the hood)
        isl = {(c[2], c[3]) for c in uv}
        if len(isl) == 1:
            lo, hi = (uv[0][2], uv[0][2] + 0.5) if uv[0][3] else (0.0, 1.0)
            mid = (lo + hi) / 2
            if max(c[0] for c in uv) - min(c[0] for c in uv) > (hi - lo) / 2:
                up = sum(c[0] > mid for c in uv) * 2 >= len(uv)
                for c in uv:
                    if (c[0] > mid) != up:
                        c[0] = hi if up else lo
        for li, c in zip(poly.loop_indices, uv):
            uvl.data[li].uv = (c[0], 1.0 - c[1])        # Blender's v runs up; glTF's (the design image's) down


def fit(ob, spec):
    """A universal model: the design layout from its region weights, then the body's own weights."""
    if spec["meta"].get("model"):
        design_uv(ob, spec["slot"])
        transfer_weights(ob)
        if spec["meta"].get("drape"):
            drape_weights(ob)


# ---------------------------------------------------------------- the designs: one atlas, a cell per design
# A 2048 atlas of 256 px units (round 2: room to grow): a design takes a unit, or 2 x 2 where it carries type or a logo
# (the TSI zip hoodie's needs ~570 texels a metre round the torso to read at the creator's close-up; 256 px gives ~280).
DESIGN_SIZE, DESIGN_UNIT, DESIGN_GUTTER = 2048, 256, 0.03125


def stripe_design(n, ss=4):
    """Navy stripes (palette outfit 12) round the torso and the sleeves, as the striped long-sleeve always had."""
    N = n * ss
    v = (np.mgrid[0:N, 0:N][0] + 0.5) / N
    torso = v < TORSO_V
    # torso: period 0.062 m of height, stripes from the chest up; sleeves: period 0.064 m along the arm
    zt = DZ_TOP - v / TORSO_V * (DZ_TOP - DZ_BOT)
    xa = DX_ARM[0] + (v - TORSO_V) / (1 - TORSO_V) * (DX_ARM[1] - DX_ARM[0])
    on = np.where(torso, (((zt - 0.358) / 0.062) % 1.0 < 0.5) & (zt > 0.334), ((xa - 0.152) / 0.064) % 1.0 < 0.5)
    a = on.astype(np.float32).reshape(n, ss, n, ss).mean(axis=(1, 3))
    out = np.zeros((n, n, 4), np.float32)
    out[..., :3] = [int(kit.PAL["outfit"][12][i:i + 2], 16) / 255 for i in (1, 3, 5)]
    out[..., 3] = a
    return out


# ---------------------------------------------------------------- the TSI zip hoodie (David's photo, 2026-10-27:
# specs/references/clothing/2026-10-27-tsi-zip-hoodie.png): washed navy, lighter up top, darker ribbing, a silver zip with a
# blue pull tab, slanted pocket welts, the TSI varsity patch on the wearer's left chest with "EST." and "24".
TSI_ZIP = {"wash": "#4D659E", "mid": "#33508A", "deep": "#1E3463", "rib": "#172750", "line": "#0E1836", "cream": "#EDE7D4",
           "outline": "#13213F", "zip": "#C9CED8", "tab": "#2F58D8"}
# glyphs as rects (x0, y0, x1, y1) in their own box, y down: the patch's varsity serifs, and a 3 x 5 type for "EST." and "24"
VARSITY = {"T": [(0, 0, 1, 0.2), (0.33, 0, 0.67, 1), (0.18, 0.85, 0.82, 1), (0, 0, 0.14, 0.34), (0.86, 0, 1, 0.34)],
           "S": [(0.12, 0, 0.88, 0.19), (0, 0.07, 0.3, 0.52), (0.12, 0.41, 0.88, 0.59), (0.7, 0.48, 1, 0.93),
                 (0.12, 0.81, 0.88, 1), (0.7, 0, 1, 0.3), (0, 0.7, 0.3, 1)],
           "I": [(0.3, 0, 0.7, 1), (0.06, 0, 0.94, 0.17), (0.06, 0.83, 0.94, 1)]}
SMALL = {"E": [(0, 0, 0.36, 1), (0, 0, 1, 0.2), (0, 0.4, 0.85, 0.6), (0, 0.8, 1, 1)],
         "S": [(0, 0, 1, 0.2), (0, 0, 0.36, 0.6), (0, 0.4, 1, 0.6), (0.64, 0.4, 1, 1), (0, 0.8, 1, 1)],
         "T": [(0, 0, 1, 0.2), (0.32, 0, 0.68, 1)], ".": [(0, 0.78, 1, 1)],
         "2": [(0, 0, 1, 0.2), (0.64, 0, 1, 0.6), (0, 0.4, 1, 0.6), (0, 0.4, 0.36, 1), (0, 0.8, 1, 1)],
         "4": [(0, 0, 0.36, 0.6), (0, 0.4, 1, 0.6), (0.64, 0, 1, 1)]}


def _hex(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def _ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _type(S, Z, text, font, s0, z_top, w, h, gap, grow=0.0, arch=None):
    """Mask of `text` set from (s0, z_top) on the garment (s m round from the front centre, z m up), glyphs w x h m;
    with `arch` (a radius, m) the glyphs sit on an arc over the text's centre, each turned to it (the patch's arch)."""
    m = np.zeros(S.shape, bool)
    mid = s0 + _width(text, w, gap) / 2
    x = s0
    for ch in text:
        gw = w * (0.4 if ch == "." else 1.0)
        dx = x + gw / 2 - mid
        ang = dx / arch if arch else 0.0
        px, pz = S - (x + gw / 2), Z - (z_top - h / 2 - (dx * dx / (2 * arch) if arch else 0.0))
        xl, zl = np.cos(ang) * px - np.sin(ang) * pz, np.sin(ang) * px + np.cos(ang) * pz
        for x0, y0, x1, y1 in font[ch]:
            m |= ((xl >= (x0 - 0.5) * gw - grow) & (xl <= (x1 - 0.5) * gw + grow) &
                  (zl <= (0.5 - y0) * h + grow) & (zl >= (0.5 - y1) * h - grow))
        x += gw + gap
    return m


def _width(text, w, gap):
    return sum(w * (0.4 if ch == "." else 1.0) for ch in text) + gap * (len(text) - 1)


def tsi_zip_design(n, ss=4):
    """The TSI zip hoodie on the tops layout, opaque: each torso texel placed by its arc length round the hoodie from
    the front centre (s, + toward the wearer's left) and its height, each sleeve texel by its distance along the arm and
    its angle round it, so the patch and the welts keep their shape on the curved front."""
    N = n * ss
    v, u = (np.mgrid[0:N, 0:N] + 0.5) / N
    C = {k: _hex(c) for k, c in TSI_ZIP.items()}
    out = np.zeros((N, N, 3))
    # torso: height from v; s from the angle round the hoodie's own ellipse (design_uv's, grown to the shell)
    rows = int(np.searchsorted(v[:, 0], TORSO_V))
    Z = DZ_TOP - v[:rows] / TORSO_V * (DZ_TOP - DZ_BOT)
    th = np.radians(u[:rows] * 360.0 - 180.0)
    ab = np.array([torso_at_ab(z) for z in Z[:, 0]])
    a, b = ab[:, :1], ab[:, 1:]
    r = 1.0 / np.sqrt((np.sin(th) / a) ** 2 + (np.cos(th) / b) ** 2)
    px, py = r * np.sin(th), r * np.cos(th)
    seg = np.hypot(np.diff(px, axis=1, prepend=px[:, :1]), np.diff(py, axis=1, prepend=py[:, :1]))
    S = np.cumsum(seg, axis=1)
    S -= S[:, N // 2 - 1:N // 2 + 1].mean(axis=1, keepdims=True)
    col = C["deep"] + (C["mid"] - C["deep"]) * _ss(0.31, 0.40, Z)[..., None]
    col += (C["wash"] - col) * _ss(0.40, 0.475, Z)[..., None]
    mottle = 0.05 * np.sin(3 * th + 1.3) * np.cos(40 * Z + 0.7) + 0.03 * np.sin(5 * th + 0.4) * np.sin(70 * Z + 2.1)
    col *= (1 + mottle)[..., None]
    rib = Z < 0.317                                                     # the hem band
    col[rib] = C["rib"] * (1 + 0.08 * np.sign(np.sin(2 * np.pi * S[rib] / 0.005)))[..., None]
    for side in (-1, 1):                                                # the slanted welt pockets, open toward the zip
        t = np.linspace(0, 1, 48)[:, None]
        p0, c0, p1 = np.array([side * 0.088, 0.388]), np.array([side * 0.114, 0.368]), np.array([side * 0.124, 0.330])
        curve = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c0 + t ** 2 * p1
        box = (np.abs(S - side * 0.106) < 0.03) & (np.abs(Z - 0.359) < 0.04)
        d = np.min(np.hypot(S[box][:, None] - curve[:, 0], Z[box][:, None] - curve[:, 1]), axis=1)
        lip = np.min(np.hypot(S[box][:, None] - curve[:, 0] + side * 0.0024, Z[box][:, None] - curve[:, 1]), axis=1)
        cb = col[box]
        cb[lip < 0.0011] *= 1.18
        cb[d < 0.0012] = C["line"]
        col[box] = cb
    zip_ = (np.abs(S) < 0.0034) & (Z < 0.516)                          # the zip: tape, then silver teeth, hem to neck
    col[zip_] = C["line"]
    teeth = (np.abs(S) < 0.0019) & (Z < 0.516)
    col[teeth] = C["zip"] * (0.82 + 0.18 * (np.sin(2 * np.pi * Z[teeth] / 0.0024) > 0))[..., None]
    col[(np.abs(S) < 0.0032) & (Z > 0.497) & (Z < 0.512)] = C["zip"] * 1.06    # the slider
    col[(np.abs(S) < 0.0032) & (Z > 0.299) & (Z < 0.305)] = C["zip"]           # the stop
    col[(np.abs(S) < 0.0022) & (Z > 0.481) & (Z <= 0.497)] = C["tab"]            # the blue pull tab
    # the patch: TSI, cream with a dark outline, centred 0.082 m round to the wearer's left; EST. and 24 beside it
    lw, lh, lg, sc, zt = 0.0185, 0.03, 0.0035, 0.082, 0.462
    s0 = sc - _width("TSI", lw, lg) / 2
    col[_type(S, Z, "TSI", VARSITY, s0, zt, lw, lh, lg, grow=0.0024, arch=0.12)] = C["outline"]
    col[_type(S, Z, "TSI", VARSITY, s0, zt, lw, lh, lg, arch=0.12)] = C["cream"]
    tw, th_, tg = 0.0062, 0.0105, 0.0013
    tz = zt - lh * 0.62 + th_ / 2 - 0.002
    col[_type(S, Z, "EST.", SMALL, s0 - 0.004 - _width("EST.", tw, tg), tz, tw, th_, tg)] = C["cream"]
    col[_type(S, Z, "24", SMALL, s0 + _width("TSI", lw, lg) + 0.004, tz, tw, th_, tg)] = C["cream"]
    out[:rows] = col
    # sleeves: along the arm from DX_ARM[0], the angle round it from the top; faded on top and at the shoulder
    xa = DX_ARM[0] + (v[rows:] - TORSO_V) / (1 - TORSO_V) * (DX_ARM[1] - DX_ARM[0])
    phi = np.radians(((u[rows:] * 2) % 1.0) * 360.0 - 180.0)
    col = C["wash"] + (C["deep"] - C["wash"]) * _ss(0.09, 0.24, xa)[..., None]
    col += (C["wash"] - col) * (0.35 * (0.5 + 0.5 * np.cos(phi)))[..., None]
    col *= (1 + 0.04 * np.sin(2 * phi + 0.8) * np.cos(30 * xa))[..., None]
    cuff = xa > 0.243
    col[cuff] = C["rib"] * (1 + 0.08 * np.sign(np.sin(70 * phi[cuff])))[..., None]
    out[rows:] = col
    img = out.reshape(n, ss, n, ss, 3).mean(axis=(1, 3))
    return np.concatenate([np.clip(img, 0, 1), np.ones((n, n, 1))], axis=2).astype(np.float32)


def torso_at_ab(z, off=0.018):
    """The hoodie shell's ellipse half-axes at height z (x, y)."""
    _, a, b = B.torso_at(min(max(z, B.TORSO[0][0].z), B.TORSO[-1][0].z), off)
    return a, b


# ---------------------------------------------------------------- round 2: the rest of the wardrobe as designs
# A design's colours are fixed; black or white at a low alpha shades the garment's own tint instead (the engine paints
# mix(tint, texel, alpha)), so ribbing, seams and folds follow whatever colour the player picks.
SHADE, SHINE, INK = "#000000", "#FFFFFF", "#1E1A1A"
CREAM, WHITE, GOLD, ORANGE, CHARCOAL = (kit.PAL["outfit"][i] for i in (0, 1, 6, 7, 14))
SKIRT_AB = [(0.06, 0.184, 0.16), (0.17, 0.176, 0.152), (0.28, 0.154, 0.132)]     # a skirt's ellipse below the torso
LOGO = os.path.join(HERE, "..", "..", "..", "web", "public", "logo.svg")


class Canvas:
    """A design cell drawn at ss times its size, painted layer over layer (premultiplied), averaged down."""

    def __init__(self, n, ss=4):
        N = n * ss
        self.n, self.ss = n, ss
        self.v, self.u = (np.mgrid[0:N, 0:N] + 0.5) / N
        self.p, self.a = np.zeros((N, N, 3)), np.zeros((N, N))

    def paint(self, mask, colour, alpha=1.0):
        k = np.asarray(mask, float) * alpha
        self.p = self.p * (1 - k)[..., None] + _hex(colour) * k[..., None]
        self.a = self.a * (1 - k) + k

    def image(self):
        n, ss = self.n, self.ss
        p = self.p.reshape(n, ss, n, ss, 3).mean(axis=(1, 3))
        a = self.a.reshape(n, ss, n, ss).mean(axis=(1, 3))
        return np.concatenate([np.clip(p / np.maximum(a, 1e-6)[..., None], 0, 1), a[..., None]], axis=2).astype(np.float32)


def shell_ab(z, off):
    """A garment's ellipse half-axes at height z: the torso's, grown by off; below it, a skirt's."""
    if z >= 0.30:
        return torso_at_ab(z, off)
    a1, b1 = torso_at_ab(0.30, off)
    zs = [r[0] for r in SKIRT_AB] + [0.30]
    return np.interp(z, zs, [r[1] for r in SKIRT_AB] + [a1]), np.interp(z, zs, [r[2] for r in SKIRT_AB] + [b1])


def layout(cv, slot, off=0.016):
    """Each texel's place on a garment of the slot's family (design_uv's layout): `body` (the torso, or a shoe's foot; else
    a sleeve, a leg or a shaft), z its height; round the body th (degrees from the front, + toward the wearer's left), x
    across and s (m round the shell from the front centre); on a limb phi (degrees round it from the top of an arm or a
    foot, the front of a leg), `left` the wearer's left one; xa (m out along a sleeve) and y (m along a foot, the toe -)."""
    u, v = cv.u, cv.v
    f = {"body": np.ones(u.shape, bool)}
    if slot in ("top", "onepiece"):
        z0, z1 = DZ_TOP, DZ_BOT if slot == "top" else 0.0
        f["body"] = v < TORSO_V
        f["z"] = z0 - v / TORSO_V * (z0 - z1)
        f["xa"] = DX_ARM[0] + (v - TORSO_V) / (1 - TORSO_V) * (DX_ARM[1] - DX_ARM[0])
    elif slot == "bottom":
        f["z"] = DZ_HIP * (1 - v)
    else:
        f["body"] = v < FOOT_V
        f["y"] = DY_FOOT[0] - v / FOOT_V * (DY_FOOT[0] - DY_FOOT[1])
        f["z"] = DZ_SHAFT[0] - (v - FOOT_V) / (1 - FOOT_V) * (DZ_SHAFT[0] - DZ_SHAFT[1])
    f["phi"] = ((u * 2) % 1.0) * 360.0 - 180.0
    f["left"] = u >= 0.5
    N = u.shape[1]
    ab = np.array([shell_ab(z, off) for z in f["z"][:, 0]])
    a, b = ab[:, :1], ab[:, 1:]
    th = np.radians(u * 360.0 - 180.0)
    r = 1.0 / np.sqrt((np.sin(th) / a) ** 2 + (np.cos(th) / b) ** 2)
    x, y = r * np.sin(th), r * np.cos(th)
    S = np.cumsum(np.hypot(np.diff(x, axis=1, prepend=x[:, :1]), np.diff(y, axis=1, prepend=y[:, :1])), axis=1)
    f.update(th=np.degrees(th), x=x, a=a + 0 * x, s=S - S[:, N // 2 - 1:N // 2 + 1].mean(axis=1, keepdims=True))
    return f


def ribs(cv, mask, along, period=0.006, alpha=0.26):
    """A ribbed band: the tint a shade darker, every other rib darker still (`along`: m across the ribs)."""
    cv.paint(mask, SHADE, alpha + 0.08 * (np.sin(2 * np.pi * along / period) > 0))


def line(cv, mask, d, width=0.0012, colour=SHADE, alpha=0.4):
    """A seam: where |d| (m) is under width / 2, inside mask."""
    cv.paint(mask & (np.abs(d) < width / 2), colour, alpha)


def dot(cv, mask, dx, dz, r, colour, ring=0.0):
    """A button: a disc of radius r (m), with a darker ring round it."""
    d = np.hypot(dx, dz)
    if ring:
        cv.paint(mask & (d < r + ring), SHADE, 0.4)
    cv.paint(mask & (d < r), colour)


def vee(f, z0, z1, w1, power=1.0):
    """A V-neck's half-width round from the front: 0 at its point (z0), w1 at z1; -1 below its point."""
    return np.where(f["z"] > z0, w1 * np.clip((f["z"] - z0) / (z1 - z0), 0, None) ** power, -1.0)


def logo_alpha(w=600):
    """The site's own TSI mark (web/public/logo.svg, the crewneck's mark since ruling 24), rasterised: alpha, rows down."""
    out = os.path.join(tempfile.mkdtemp(), "logo.png")
    subprocess.run([shutil.which("rsvg-convert") or "/opt/homebrew/bin/rsvg-convert", "-w", str(w), "-o", out, LOGO], check=True)
    img = bpy.data.images.load(out)
    a = np.array(img.pixels[:], np.float32).reshape(img.size[1], img.size[0], 4)[::-1, :, 3]
    bpy.data.images.remove(img)
    return a


def tsi_crew_design(n):
    """The TSI crewneck on the sweater: ribbed hem, collar and cuffs a shade darker, the site's mark in cream on the chest."""
    cv = Canvas(n)
    f = layout(cv, "top", 0.018)
    body, z, s = f["body"], f["z"], f["s"]
    ribs(cv, body & ((z < 0.317) | (z > Z_NECK - 0.002)), s)
    ribs(cv, ~body & (f["xa"] > 0.243), f["phi"] * 0.0008)
    mark = logo_alpha()
    w, h = 0.094, 0.094 * mark.shape[0] / mark.shape[1]
    i = np.floor((0.416 + h / 2 - z) / h * mark.shape[0]).astype(int)
    j = np.floor((s + w / 2) / w * mark.shape[1]).astype(int)
    on = body & (i >= 0) & (i < mark.shape[0]) & (j >= 0) & (j < mark.shape[1])
    a = np.zeros(z.shape)
    a[on] = mark[i[on], j[on]]
    cv.paint(a, CREAM)
    return cv.image()


def silk_design(n):
    """The silk sweater: a V-neck over a white tee, cream rib round the V, the neck, the hem and the cuffs, a soft sheen."""
    cv = Canvas(n)
    f = layout(cv, "top", 0.018)
    body, z, s = f["body"], f["z"], f["s"]
    cv.paint(body, SHINE, 0.07 * (0.5 + 0.5 * np.sin(2 * np.pi * (s / 0.06 + z / 0.09))) ** 4)
    w = vee(f, 0.415, Z_NECK, 0.05)
    rib = body & ((np.abs(s) < w + 0.009) | (z > Z_NECK - 0.002) | (z < 0.317)) | ~body & (f["xa"] > 0.243)
    cv.paint(rib, CREAM)
    ribs(cv, rib, np.where(body, s, f["phi"] * 0.0008), alpha=0.04)
    cv.paint(body & (np.abs(s) < w), WHITE)
    line(cv, body & (z > 0.41), np.abs(s) - w, alpha=0.25)
    return cv.image()


def cardigan_design(n):
    """The cardigan: open down the front over a cream tee, button bands with three cream buttons, patch pockets, ribbing."""
    cv = Canvas(n)
    f = layout(cv, "top", 0.018)
    body, z, s = f["body"], f["z"], f["s"]
    open_at = lambda zz: 0.008 + 0.05 * np.clip((zz - 0.317) / (Z_NECK - 0.317), 0, 1) ** 1.6
    w = open_at(z)
    shut = body & (np.abs(s) >= w)
    ribs(cv, shut & ((z < 0.322) | (z > Z_NECK - 0.002)), s, alpha=0.2)
    ribs(cv, ~body & (f["xa"] > 0.243), f["phi"] * 0.0008, alpha=0.2)
    cv.paint(shut & (np.abs(s) < w + 0.01), SHADE, 0.1)
    cv.paint(body & ~shut, CREAM)
    line(cv, body, np.abs(s) - w, alpha=0.45)
    for side in (-1, 1):
        px, pz = s - side * 0.075, z - 0.346
        box = body & (np.abs(px) < 0.024) & (np.abs(pz) < 0.021)
        cv.paint(box & ~((np.abs(px) < 0.0228) & (np.abs(pz) < 0.0198)), SHADE, 0.4)
        cv.paint(box & (pz > 0.015), SHADE, 0.1)
    for zb in (0.348, 0.388, 0.428):
        dot(cv, body, s + open_at(zb) + 0.005, z - zb, 0.0042, CREAM, ring=0.0012)
    return cv.image()


def vest_design(n):
    """The sweater vest on the tee: the tee white at the sleeves, in the V and round the armholes; the vest ribbed at its
    edges and knit all over."""
    cv = Canvas(n)
    f = layout(cv, "top", 0.014)
    body, z, s, x, a = f["body"], f["z"], f["s"], f["x"], f["a"]
    cv.paint(body, SHADE, 0.05 * (np.sin(2 * np.pi * s / 0.005) > 0))
    w = vee(f, 0.40, Z_NECK, 0.052)
    edge = np.maximum(a - 0.012 - 0.04 * np.clip((z - 0.405) / 0.07, 0, 1), 0.072)
    tee = ~body | body & ((np.abs(s) < w) | (z > 0.405) & (np.abs(x) > edge))
    ribs(cv, body & ~tee & ((np.abs(s) < w + 0.008) | (z > 0.40) & (np.abs(x) > edge - 0.008) | (z < 0.334)), s, alpha=0.24)
    cv.paint(tee, WHITE)
    return cv.image()


def shirt_design(n):
    """The collared shirt on the tee: a white placket with four buttons, a chest pocket, turned-up sleeve hems."""
    cv = Canvas(n)
    f = layout(cv, "top", 0.014)
    body, z, s = f["body"], f["z"], f["s"]
    front = body & (z < Z_NECK)
    cv.paint(front & (np.abs(s) < 0.0062), WHITE)
    line(cv, front, np.abs(s) - 0.0062, alpha=0.3)
    for zb in (0.345, 0.385, 0.425, 0.465):
        dot(cv, body, s, z - zb, 0.0024, WHITE, ring=0.001)
    px, pz = s - 0.058, z - 0.415
    box = body & (np.abs(px) < 0.02) & (np.abs(pz) < 0.023)
    cv.paint(box & ~((np.abs(px) < 0.0188) & (np.abs(pz) < 0.0218)) | box & (np.abs(pz - 0.017) < 0.0006), SHADE, 0.4)
    cv.paint(~body & (f["xa"] > 0.160), SHADE, 0.12)
    line(cv, ~body, f["xa"] - 0.160)
    return cv.image()


def raincoat_design(n):
    """The raincoat on the coat: a storm flap down the front with three dark toggles, flap pockets, cuffs and a hem facing."""
    cv = Canvas(n)
    f = layout(cv, "top", 0.022)
    body, z, s = f["body"], f["z"], f["s"]
    front = body & (np.abs(s) < 0.2)
    cv.paint(front & (np.abs(s) < 0.011), SHADE, 0.1)
    line(cv, front, np.abs(s) - 0.011)
    cv.paint(body & (z < 0.293), SHADE, 0.08)
    line(cv, body, z - 0.293, alpha=0.3)
    cv.paint(~body & (f["xa"] > 0.236), SHADE, 0.12)
    line(cv, ~body, f["xa"] - 0.236, alpha=0.3)
    for side in (-1, 1):
        flap = body & (np.abs(s - side * 0.075) < 0.026) & (z > 0.326) & (z < 0.341)
        cv.paint(flap, SHADE, 0.12)
        cv.paint(flap & (z < 0.3275), SHADE, 0.4)
    for zt in (0.318, 0.368, 0.418):
        e = (s / 0.011) ** 2 + ((z - zt) / 0.0055) ** 2
        cv.paint(body & (np.abs(z - zt) < 0.0009) & (np.abs(s) < 0.02), CHARCOAL)        # the cord loop
        cv.paint(body & (e < 1), CHARCOAL)
        cv.paint(body & ((s / 0.006) ** 2 + ((z - zt - 0.002) / 0.0018) ** 2 < 1), SHINE, 0.3)
    return cv.image()


def pleats_design(n):
    """The pleated skirt: a waistband, then twenty knife pleats opening toward the hem, each fold in shadow."""
    cv = Canvas(n)
    f = layout(cv, "bottom", 0.009)
    z, th = f["z"], f["th"]
    band = z > 0.322
    cv.paint(band, SHADE, 0.08)
    line(cv, np.ones(z.shape, bool), z - 0.322)
    k = ((th + 9.0) / 18.0) % 1.0
    open_ = np.clip((0.322 - z) / 0.11, 0, 1)
    cv.paint(~band, SHADE, 0.24 * k * open_)
    cv.paint(~band & (k > 0.965), SHADE, 0.45 * np.sqrt(open_))
    line(cv, ~band, z - 0.198, alpha=0.25)
    return cv.image()


def overalls_design(n):
    """The overall shorts (denim) on the shorts: twill, curved front pockets, stitched outer seams, rolled cuffs."""
    cv = Canvas(n)
    f = layout(cv, "bottom", 0.008)
    z, s, phi = f["z"], f["s"], f["phi"]
    cv.paint(np.ones(z.shape, bool), SHADE, 0.06 * (np.sin(2 * np.pi * (cv.u + cv.v) * 90) > 0.5))
    hips = z > 0.292
    for side in (-1, 1):
        r = np.hypot((s - side * 0.088) / 0.036, (z - 0.343) / 0.042)
        cv.paint(hips & (np.abs(s) < 0.088) & (side * s > 0) & (np.abs(r - 1) < 0.035), SHADE, 0.45)
    leg = z < 0.286
    seam = np.where(f["left"], phi - 90, phi + 90)
    cv.paint(leg & (np.abs(seam) < 2.5) & (np.sin(2 * np.pi * z / 0.006) > 0), SHINE, 0.3)
    cuff = z < 0.234
    cv.paint(cuff, SHADE, 0.14)
    cv.paint(cuff & (z > 0.229), SHINE, 0.12)
    line(cv, leg, z - 0.234, alpha=0.4)
    return cv.image()


def sundress_design(n):
    """The sundress: a white ribbon round the waist (its bow's tails are the dress's own), smocking on the bodice, a white
    line round the hem."""
    cv = Canvas(n)
    f = layout(cv, "onepiece", 0.008)
    body, z = f["body"], f["z"]
    cv.paint(body & (z > 0.36) & (z < 0.448) & (np.sin(2 * np.pi * z / 0.008) > 0.8), SHADE, 0.12)
    cv.paint(body & (np.abs(z - 0.34) < 0.012), WHITE)
    line(cv, body, np.abs(z - 0.34) - 0.012, alpha=0.25)
    cv.paint(body & (np.abs(z - 0.158) < 0.003), WHITE, 0.9)
    return cv.image()


def koi(cv, f, th0, z0, head, colour, spots):
    """A koi swimming round the skirt at (th0, z0), its head toward +s (head 1) or -s (-1), and the ripples ahead of it."""
    j = int(round((th0 + 180.0) / 360.0 * cv.u.shape[1])) % cv.u.shape[1]
    t, q = (f["s"] - f["s"][:, [j]]) * head, f["z"] - z0
    body = f["body"]
    t, q = t / 1.6, q / 1.6                      # drawn at 1.6 x these sizes: a koi as big as the old ones (10 cm nose to tail)
    fish = ((t / 0.034) ** 2 + (q / 0.012) ** 2 < 1) | ((t < -0.026) & (t > -0.058) & (np.abs(q) < 0.004 + (-0.026 - t) * 0.75))
    fins = ((t - 0.01) / 0.007) ** 2 + ((np.abs(q) - 0.012) / 0.004) ** 2 < 1
    cv.paint(body & (fish | fins) & ~((t / 0.032) ** 2 + (q / 0.0105) ** 2 < 1), SHADE, 0.35)
    cv.paint(body & (fish | fins), colour)
    for st, sq, r, c in spots:
        cv.paint(body & ((t / 0.034) ** 2 + (q / 0.012) ** 2 < 0.9) & (np.hypot(t - st, q - sq) < r), c)
    cv.paint(body & (np.hypot(t - 0.024, q - 0.004) < 0.0018), INK)
    for rr, al in ((0.016, 0.35), (0.026, 0.2)):
        line(cv, body & (t > 0.048), np.hypot(t - 0.048, q) - rr, 0.0011 / 1.6, SHINE, al)


def kimono_design(n):
    """The koi kimono: a cream collar round the neck and down a V over a white under-collar, the left panel's edge down
    the front, two golden koi and an orange one swimming round the skirt (the obi and its bow are the kimono's own)."""
    cv = Canvas(n)
    f = layout(cv, "onepiece", 0.019)
    body, z, s = f["body"], f["z"], f["s"]
    w = vee(f, 0.38, Z_NECK, 0.055, 0.8)
    collar = body & (((np.abs(s) >= w) & (np.abs(s) < w + 0.016) & (z > 0.375)) | (z > Z_NECK - 0.012))
    cv.paint(collar, CREAM)
    cv.paint(body & (np.abs(s) < w), WHITE)
    line(cv, body & (z > 0.375), np.abs(s) - w, alpha=0.3)
    line(cv, body & (z > 0.375), np.abs(s) - w - 0.016, alpha=0.3)
    line(cv, body & (z < 0.38), s - 0.004, alpha=0.4)
    koi(cv, f, 32, 0.15, 1, GOLD, [(0.006, 0.003, 0.007, ORANGE), (-0.016, -0.002, 0.005, ORANGE)])
    koi(cv, f, -44, 0.225, -1, ORANGE, [(0.004, 0.002, 0.008, WHITE)])
    koi(cv, f, 140, 0.13, -1, GOLD, [(-0.008, 0.002, 0.007, ORANGE)])
    return cv.image()


def cape_design(n):
    """The monarch cape: an orange wing, black veins from the collar, a black border (and lobes) with two rows of white
    spots, black cuffs spotted white."""
    cv = Canvas(n)
    f = layout(cv, "onepiece")
    body, z, th = f["body"], f["z"], f["th"]
    wrap = lambda d: (d + 180.0) % 360.0 - 180.0
    cv.paint(body & (z > 0.47), SHADE, 0.3 * np.clip((z - 0.47) / 0.04, 0, 1))
    for k in range(12):
        vein = wrap(th - (15 + 30 * k + 5 * np.sin((0.49 - z) * 25)))
        cv.paint(body & (z < 0.5) & (np.abs(vein) < 0.6 + 0.6 * np.clip((0.4 - z) / 0.09, 0, 1)), INK)
    cv.paint(body & (np.abs(z - (0.405 + 0.012 * np.cos(np.radians(wrap(th - 15) * 6)))) < 0.0016), INK)
    border = body & (z < 0.313)
    cv.paint(border, INK)
    for zc, step, r, off in ((0.298, 15, 0.0045, 7.5), (0.279, 30, 0.0055, 15)):
        ds = np.radians(wrap((th - off + step / 2) % step - step / 2)) * 0.19
        cv.paint(border & (np.hypot(ds, z - zc) < r), WHITE)
    cuff = ~body & (f["xa"] > 0.215)
    cv.paint(cuff, INK)
    dphi = np.radians(wrap((f["phi"] + 22.5) % 45 - 22.5)) * 0.03
    cv.paint(cuff & (np.hypot(dphi, f["xa"] - 0.236) < 0.0045), WHITE)
    return cv.image()


def boots_design(n):
    """The boots: a turned-down cuff a shade lighter, a laced front (tongue and eyelets) and a toe cap seam."""
    cv = Canvas(n)
    f = layout(cv, "shoes")
    foot, z, phi = f["body"], f["z"], f["phi"]
    shaft = ~foot
    cv.paint(shaft & (z > 0.102), SHINE, 0.22)
    line(cv, shaft, z - 0.102, 0.0014, alpha=0.45)
    cv.paint(shaft & (np.abs(phi) < 14) & (z < 0.1), SHADE, 0.18)
    for zc in (0.056, 0.072, 0.088):
        cv.paint(shaft & (np.hypot(np.radians(np.abs(phi) - 18) * 0.05, z - zc) < 0.0026), INK)
    line(cv, foot & (np.abs(phi) < 85), f["y"] + 0.062, 0.0014, alpha=0.35)
    return cv.image()


def rainboots_design(n):
    """The rain boots: a glossy rim round the top."""
    cv = Canvas(n)
    f = layout(cv, "shoes")
    shaft, z = ~f["body"], f["z"]
    cv.paint(shaft & (z > 0.118), SHINE, 0.3)
    line(cv, shaft, z - 0.118, 0.0012, alpha=0.3)
    return cv.image()


def loafers_design(n):
    """The loafers on the sneaker: the saddle (the sneaker's lace strip) stitched along its edges, a penny strap across
    each side with its slot."""
    cv = Canvas(n)
    f = layout(cv, "shoes")
    foot, y, phi = f["body"], f["y"], np.abs(f["phi"])
    cv.paint(foot & (phi > 30) & (phi < 100) & (y < -0.004) & (y > -0.022), SHADE, 0.28)
    line(cv, foot & (phi > 30) & (phi < 100), np.minimum(np.abs(y + 0.004), np.abs(y + 0.022)), 0.0016, alpha=0.5)
    cv.paint(foot & (np.abs(y + 0.013) < 0.0028) & (np.abs(phi - 52) < 9), INK, 0.8)
    cv.paint(foot & (np.abs(phi - 33) < 1.4) & (y < 0.03) & (np.sin(2 * np.pi * y / 0.005) > 0), SHADE, 0.4)
    return cv.image()


# each design and its cell's size (units of DESIGN_UNIT); a part names its design in uni()
DESIGNS = {"stripe": (stripe_design, 1), "tsi_zip": (tsi_zip_design, 2), "tsi_crew": (tsi_crew_design, 2),
           "kimono": (kimono_design, 2), "silk": (silk_design, 1), "cardigan": (cardigan_design, 1), "vest": (vest_design, 1),
           "shirt": (shirt_design, 1), "raincoat": (raincoat_design, 1), "pleats": (pleats_design, 1),
           "overalls": (overalls_design, 1), "sundress": (sundress_design, 1), "cape": (cape_design, 1),
           "boots": (boots_design, 1), "rainboots": (rainboots_design, 1), "loafers": (loafers_design, 1)}


def design_atlas():
    """designs.png: each design in a cell of 1 or 2 x 2 units at the first free place, the cell's edge pixels repeated into
    its gutter (no bleed at any mip). The catalogue gets each design's index (`cells`) and its place in the atlas
    (`rects`: u0, v0 and size, as fractions of it)."""
    g, U = DESIGN_SIZE // DESIGN_UNIT, DESIGN_UNIT
    out = np.zeros((DESIGN_SIZE, DESIGN_SIZE, 4), np.float32)
    free = np.ones((g, g), bool)
    cells, rects = {}, []
    for name, (fn, k) in DESIGNS.items():
        r, c = next((r, c) for r in range(0, g, k) for c in range(0, g, k) if free[r:r + k, c:c + k].all())
        free[r:r + k, c:c + k] = False
        size = k * U
        pad = int(round(DESIGN_GUTTER * size))
        out[r * U:r * U + size, c * U:c * U + size] = np.pad(fn(size - 2 * pad), ((pad, pad), (pad, pad), (0, 0)), mode="edge")
        cells[name] = len(rects)
        rects.append([(c * U + pad) / DESIGN_SIZE, (r * U + pad) / DESIGN_SIZE, (size - 2 * pad) / DESIGN_SIZE])
    kit.image("designs", out, os.path.join(HERE, "designs.png"))
    kit.update_catalog("designs", {"atlas": "outfits/designs.png", "materials": ["M_Main"], "cells": cells, "rects": rects})
    return cells


CELLS = design_atlas()


def uni(model, cut, budget, design=None):
    """A part on a universal model: its mesh, its bit in the skin's `_BODYCUT`, its design's cell."""
    return dict(model=model, bodyCut=cut, budget=budget, **({"design": CELLS[design]} if design else {}))


TOP_TORSO = [(0.320, 0.016), (0.362, 0.014), (0.405, 0.012), (Z_SH - 0.001, 0.011), (Z_NECK, 0.008)]


@part("top_sweater_vest", "top", "Sweater vest over tee", {"M_Main": ("outfit", 3)}, **uni("top_tee", 0, 152, "vest"))
@part("top_tee", "top", "Base tee", {"M_Main": ("outfit", 0)}, **uni("top_tee", 0, 152))
def tee(pc):
    """Boxy tee to the hips, short straight sleeves flaring a little at the end."""
    trunk(pc, *zip(*TOP_TORSO))
    sleeves(pc, [X0 * 0.8, 0.138, 0.176], [0.014, 0.012, 0.016])


@part("top_collar_shirt", "top", "Collared shirt", {"M_Main": ("outfit", 10), "M_Accent": ("outfit", 1)},
      **uni("top_tee_collar", 10, 176, "shirt"))
def collar_shirt(pc):
    """The tee and a white turned-down collar (the zip hoodie's way: the smallest change to a universal model, its fit
    kept); the placket, buttons and pocket are the shirt design."""
    tee(pc)
    pc.mat, pc.region = "M_Accent", "torso"
    lons = [12, 55, 95, 135, 180, 225, 265, 305, 348]
    drop = lambda l: 0.026 * max(0.0, math.cos(math.radians(l))) ** 6
    pc.band([[T(l, Z_NECK + 0.006, 0.011) for l in lons],
             [T(l, Z_NECK - 0.028 - drop(l), 0.037 - 0.012 * drop(l) / 0.026) for l in lons]],
            closed=False, refs=[B.torso_at(Z_NECK, 0)[0]])
    pc.mat = "M_Main"


@part("top_cardigan", "top", "Cardigan", {"M_Main": ("outfit", 7)}, **uni("top_sweater", 9, 236, "cardigan"))
@part("top_tsi_crew", "top", "TSI crewneck", {"M_Main": ("outfit", 2)}, **uni("top_sweater", 9, 236, "tsi_crew"))
@part("outfit_silk_sweater", "top", "Silk sweater", {"M_Main": ("outfit", 13)}, item="outfit-silk-sweater",
      **uni("top_sweater", 9, 236, "silk"))
def sweater(pc):
    """The universal sweater: the hoodie's body and sleeves on its rings (the same fit; the cuff's own ring left out for the
    budget) and a crew collar in place of the hood. A cardigan, a crewneck and a V-neck are designs on it."""
    trunk(pc, [0.300, 0.316, 0.362, 0.405, Z_SH - 0.001, Z_NECK, Z_NECK + 0.01], [0.013, 0.019, 0.020, 0.018, 0.016, 0.012, 0.005])
    sleeves(pc, [X0 * 0.8, 0.138, 0.199, 0.262], [0.017, 0.016, 0.017, 0.010])


@part("top_raincoat", "top", "Raincoat", {"M_Main": ("outfit", 6)}, **uni("top_coat", 11, 218, "raincoat"))
def coat(pc):
    """The universal coat: to the top of the thigh, flaring over the seat (the flare hangs from the hips into the thighs,
    as a skirt does), a stand collar, roomy sleeves widening to the wrist."""
    pc.region = "skirt"
    pc.band([[oval(l, z, rx, ry) for l in R10] for z, rx, ry in ((0.283, 0.157, 0.134), (0.31, 0.15, 0.128))] +
            [[T(l, B.WAIST, 0.023) for l in R10]])
    trunk(pc, [B.WAIST, Z_CHEST, Z_SH, Z_NECK, Z_NECK + 0.022], [0.023, 0.021, 0.019, 0.017, 0.015])
    sleeves(pc, [X0 * 0.8, 0.138, 0.199, 0.258], [0.019, 0.017, 0.019, 0.024])


def hoodie_shell(pc):
    """The universal hoodie: a ribbed hem band, full sleeves gathered into cuffs, the hood down on the back."""
    trunk(pc, [0.300, 0.316, 0.362, 0.405, Z_SH - 0.001, Z_NECK], [0.013, 0.019, 0.020, 0.018, 0.016, 0.012])
    sleeves(pc, [X0 * 0.8, 0.138, 0.199, 0.243, 0.262], [0.017, 0.016, 0.016, 0.019, 0.010])
    hood_down(pc, 0.036)


@part("top_hoodie", "top", "Hoodie", {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 1)}, **uni("top_hoodie", 2, 279))
def hoodie(pc):
    """Roomy pullover hoodie: the universal hoodie and its drawstrings."""
    hoodie_shell(pc)
    pc.mat = "M_Accent"
    for s in (-1, 1):
        strip(pc, [T(s * 13, Z_NECK - 0.004, 0.014), T(s * 14, 0.47, 0.022), T(s * 15, 0.452, 0.022)], 0.008)
    pc.mat = "M_Main"


@part("top_tsi_zip_hoodie", "top", "TSI zip hoodie", {"M_Main": ("fixed", TSI_ZIP["mid"])}, key="tsi-zip-hoodie", members=True,
      **uni("top_hoodie_zip", 8, 279, "tsi_zip"))
def tsi_zip_hoodie(pc):
    """David's TSI zip hoodie (2026-10-27): the universal hoodie without the pullover's drawstrings (same rings, so the
    same weights, and the same skin cut under its own bit, 8: one bit per model); its zip, pockets, ribbing, wash and logo are the tsi_zip design.
    David, 2026-10-27: "its free in the default character creation but only for tsi members, unobtainable for non":
    `members` (look.ts membersOnly): free to TSI members, never priced, sold or given; no non-member sees or wears it."""
    hoodie_shell(pc)


@part("top_stripe_ls", "top", "Striped long-sleeve", {"M_Main": ("outfit", 1)}, **uni("top_longsleeve", 1, 256, "stripe"))
def longsleeve(pc):
    """Fitted long-sleeve to the hips, the hem turned in, a crew neck, sleeves to the wrist."""
    trunk(pc, [0.327] + [z for z, _ in TOP_TORSO] + [Z_NECK + 0.008], [0.009] + [o for _, o in TOP_TORSO] + [0.004])
    sleeves(pc, [X0 * 0.8, 0.138, 0.199, 0.255, 0.266], [0.014, 0.011, 0.011, 0.012, 0.008])


LEG_CAP = B.CROTCH + 0.04     # where the legs' top fans meet, inside the seat


def seat_rings(pc, top, mat=None):
    """The seat: closed under the crotch, on the skin's own rings, up to `top` [(z, off)] (the waistband)."""
    trunk(pc, [B.CROTCH - 0.012, B.CROTCH + 0.025] + [z for z, _ in top], [0.007, 0.007] + [o for _, o in top], mat=mat,
          caps=(Vector((0, 0, B.CROTCH - 0.034)), None))


@part("bottom_shorts", "bottom", "Base shorts", {"M_Main": ("outfit", 4)}, **uni("bottom_shorts", 3, 114))
def shorts(pc):
    """Shorts to mid-thigh, the legs closed at the top under the seat."""
    seat_rings(pc, [(B.WAIST + 0.004, 0.005)])
    legs(pc, [0.215, B.CROTCH + 0.02], [0.013, 0.008], top_cap=LEG_CAP)


@part("bottom_overall_shorts", "bottom", "Overall shorts", {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 6)},
      **uni("bottom_overalls", 14, 162, "overalls"))
def overall_shorts(pc):
    """The shorts and a bib with its straps over the top (the zip hoodie's way: the shorts' fit kept), two gold buttons."""
    shorts(pc)
    pc.region = "torso"
    pc.band([[T(l, z, 0.020) for l in (-36, -18, 0, 18, 36)] for z in (B.WAIST, 0.395, 0.448)], closed=False)
    for s in (1, -1):
        path = [(30, 0.448), (33, 0.49), (42, 0.522), (90, 0.532), (138, 0.522), (148, 0.49), (152, 0.42), (156, B.WAIST)]
        strip(pc, [T(s * l, z, 0.021) for l, z in path], 0.024)
        stud(pc, s * 28, 0.44, 0.024, 0.008, "M_Accent")


@part("bottom_trousers", "bottom", "Long trousers", {"M_Main": ("outfit", 12)}, **uni("bottom_trousers", 4, 178))
def trousers(pc):
    """Straight trousers to the shoe. No ring at the knee: the skin has none there either, and a ring between two of
    the skin's would sink into the back of the knee as it bends."""
    seat_rings(pc, [(B.WAIST + 0.004, 0.005)])
    legs(pc, [0.052, 0.09, 0.17, B.CROTCH + 0.02], [0.015, 0.013, 0.011, 0.008], top_cap=LEG_CAP)


@part("bottom_joggers", "bottom", "Jogger pants", {"M_Main": ("outfit", 14), "M_Accent": ("outfit", 14)}, **uni("bottom_joggers", 5, 234))
def joggers(pc):
    """Soft joggers: an elastic waistband, roomy legs gathered into cuffs at the ankle."""
    seat_rings(pc, [(B.WAIST - 0.004, 0.008), (B.WAIST + 0.01, 0.005)], mat=lambda i, k: "M_Accent" if i == 2 else None)
    legs(pc, [0.046, 0.068, 0.09, 0.17, B.CROTCH + 0.02], [0.007, 0.008, 0.018, 0.011, 0.008],
         mat=lambda i, k: "M_Accent" if i == 0 else None, top_cap=LEG_CAP)


def skirt_rings(profile):
    """A skirt's waistband on the torso 10-gon (under any top's hem), then its ellipses: profile = [(z, rx, ry[, cy,
    back])] (cy, back: the fullness a long skirt carries behind, room for a stride, oval())."""
    return ([r10_ring(B.WAIST + 0.006, 0.007), r10_ring(B.WAIST - 0.016, 0.009)] +
            [[oval(l, *ring) for l in L20] for ring in profile])


@part("bottom_pleated_skirt", "bottom", "Pleated skirt", {"M_Main": ("outfit", 11)}, drape=True,
      **uni("bottom_skirt", 12, 120, "pleats"))
def skirt(pc):
    """The universal skirt: an A-line to above the knee, hanging from the hips into both thighs (the pleats are paint)."""
    pc.region = "skirt"
    pc.band(skirt_rings([(0.28, 0.148, 0.123), (0.19, 0.184, 0.162)]))


@part("bottom_long_skirt", "bottom", "Long skirt", {"M_Main": ("outfit", 15)}, drape=True,
      **uni("bottom_skirt_long", 13, 160))
def long_skirt(pc):
    """The universal long skirt: A-line to the ankle, fuller behind (room for a stride)."""
    pc.region = "skirt"
    pc.band(skirt_rings([(0.27, 0.15, 0.126), (0.16, 0.182, 0.165, 0.012, 0.035), (0.068, 0.202, 0.19, 0.03, 0.045)]))


# ================================================================ one-pieces (hide the top and the bottom)
@part("onepiece_sundress", "onepiece", "Sundress", {"M_Main": ("outfit", 9), "M_Accent": ("outfit", 1)}, hides=("top", "bottom"),
      **uni("onepiece_dress", 15, 208, "sundress"))
def sundress(pc):
    """The universal dress: a bodice on straps, a full skirt to the knee from the waist, the ribbon's bow tails at the back."""
    trunk(pc, [B.WAIST - 0.006, 0.4, 0.452], [0.008, 0.007, 0.007])
    pc.region = "skirt"
    pc.band([r10_ring(B.WAIST + 0.002, 0.009)] +
            [[oval(l, z, rx, ry) for l in L20] for z, rx, ry in ((0.28, 0.149, 0.125), (0.21, 0.172, 0.15), (0.15, 0.192, 0.168))])
    pc.mat = "M_Accent"
    for s in (1, -1):
        strip(pc, [T(s * 170, B.WAIST + 0.004, 0.013), T(s * 150, B.WAIST - 0.03, 0.016)], 0.03)
    pc.mat = "M_Main"
    for s in (1, -1):
        path = [(30, 0.448), (36, 0.49), (46, 0.522), (90, 0.532), (134, 0.522), (144, 0.49), (150, 0.448)]
        strip(pc, [T(s * l, z, 0.009) for l, z in path], 0.014)


@part("outfit_koi_kimono", "onepiece", "Koi kimono", {"M_Main": ("outfit", 11), "M_Accent": ("outfit", 0)},
      hides=("top", "bottom"), item="outfit-koi-kimono", **uni("onepiece_kimono", 16, 277, "kimono"))
def kimono(pc):
    """The universal kimono: straight to the ankles (room for seated knees), deep boxy sleeves, the obi and its bow at the
    back (M_Accent); the collar, the wrap and the koi are the kimono design."""
    pc.region = "skirt"
    pc.band([[oval(l, z, rx, ry) for l in R10] for z, rx, ry in SKIRT_AB] + [[T(l, B.WAIST, 0.019) for l in R10]])
    trunk(pc, [B.WAIST, Z_CHEST, Z_SH, Z_NECK], [0.019, 0.019, 0.018, 0.016])
    for sx, s in SIDES:                                           # deep front-to-back, so they hang square at the sides
        pc.region = f"arm_{s}"
        pc.band([[B.arm_pt(sx, x, l, o + d * abs(math.sin(math.radians(l)))) for l in R8]
                 for x, o, d in ((X0 * 0.8, 0.02, 0.0), (0.138, 0.024, 0.012), (0.199, 0.03, 0.04), (0.245, 0.032, 0.046))])
    pc.mat = "M_Accent"
    trunk(pc, [0.3, 0.362], 0.025)
    pc.blob(T(180, 0.335, 0.043), (0.056, 0.022, 0.03), segs=6, rings=3)
    pc.mat = "M_Main"


P12 = [15 + 30 * k for k in range(12)]


@part("outfit_monarch_cape", "onepiece", "Monarch cape", {"M_Main": ("outfit", 7), "M_Accent": ("outfit", 14)}, sharp=34,
      grad=(0.72, 1.0), hides=("top", "bottom"), item="outfit-monarch-cape", **uni("onepiece_cape", 17, 252, "cape"))
def cape(pc):
    """The universal cape: from the collar to the hips over a short black skirt, its hem in wing lobes, wide sleeves; the
    wing's veins, border and spots are the cape design."""
    pc.mat, pc.region = "M_Accent", "skirt"
    pc.band([[oval(l, z, rx, ry) for l in P8] for z, rx, ry in ((0.33, 0.148, 0.128), (0.19, 0.184, 0.172))])
    pc.mat = "M_Main"
    sleeves(pc, [X0 * 0.85, X0 + 0.05, 0.215, 0.256], [0.018, 0.022, 0.02, 0.014])
    pc.region = "skirt"
    prof = [(Z_NECK + 0.006, 0.105, 0.082), (Z_SH - 0.004, 0.152, 0.118), (0.4, 0.166, 0.144), (0.31, 0.192, 0.18)]
    pc.band([[oval(l, z, rx, ry) for l in P12] for z, rx, ry in prof] +
            [[oval(l, 0.262 - 0.03 * (k % 2), 0.2, 0.19) for k, l in enumerate(P12)]])
    pc.mat = "M_Accent"
    trunk(pc, [Z_NECK - 0.004, Z_NECK + 0.014], [0.037, 0.019])
    pc.mat = "M_Main"


# ================================================================ shoes (own slot; both feet in one piece)
def shoe(pc, prof, heel, toe, open_top=(), sole=(2, 3, 4), top_mat=None):
    """prof: [(y, half-width, z top, z bottom)] along the foot; P8 quads: k=7 top, k=3 bottom, k=2/4 lower sides."""
    for sx, s in SIDES:
        pc.region = f"foot_{s}"
        lx = sx * B.LEG_X
        rings = []
        for y, hw, zt, zb in prof:
            zc, rb = (zt + zb) / 2, (zt - zb) / 2
            rings.append([Vector((lx + math.sin(math.radians(l)) * hw, y, zc + math.cos(math.radians(l)) * rb)) for l in P8])
        pc.band(rings, caps=(Vector((lx, *heel)), Vector((lx, *toe))),
                skip=lambda i, k: k == 7 and i in open_top,
                mat=lambda i, k: "M_Sole" if k in sole else (top_mat if (top_mat and k == 7) else None))


CHUNKY = [(0.056, 0.03, 0.05, 0.002), (0.03, 0.045, 0.066, -0.001), (-0.01, 0.05, 0.066, -0.001), (-0.05, 0.047, 0.057, -0.001),
          (-0.078, 0.036, 0.044, 0.0)]


@part("shoes_slipon", "shoes", "Yellow slip-ons (#18)", {"M_Main": ("outfit", 6), "M_Sole": ("fixed", kit.PAL["derived"]["shoe_sole"]),
                                                        "M_Sock": ("outfit", 1)}, **uni("shoes_slipon", 6, 216))
def slipon(pc):
    """The #18 slip-ons: chunky, open over the instep, white socks to above the ankle."""
    shoe(pc, CHUNKY, (0.066, 0.026), (-0.092, 0.018), open_top=(0, 1), sole=(3,))
    pc.mat = "M_Sock"
    legs(pc, [0.03, 0.058, 0.07], [0.006, 0.007, 0.010])
    pc.mat = "M_Main"


@part("shoes_loafers", "shoes", "Loafers", {"M_Main": ("outfit", 5), "M_Sole": ("outfit", 14), "M_Accent": ("outfit", 4)},
      **uni("shoes_sneakers", 7, 156, "loafers"))
@part("shoes_sneakers", "shoes", "Sneakers", {"M_Main": ("outfit", 11), "M_Sole": ("outfit", 1), "M_Accent": ("outfit", 1)},
      **uni("shoes_sneakers", 7, 156))
def sneakers(pc):
    """Chunky sneakers: a white sole all round, the laces' strip over the instep."""
    shoe(pc, [(0.058, 0.032, 0.052, 0.0), (0.03, 0.046, 0.068, -0.001), (-0.012, 0.05, 0.066, -0.001), (-0.052, 0.048, 0.056, -0.001),
              (-0.082, 0.036, 0.04, 0.0)], (0.068, 0.028), (-0.096, 0.016), open_top=(0,), top_mat="M_Accent")


@part("shoes_rainboots", "shoes", "Rain boots", {"M_Main": ("outfit", 7), "M_Sole": ("outfit", 14)},
      **uni("shoes_boots", 18, 248, "rainboots"))
@part("shoes_boots", "shoes", "Boots", {"M_Main": ("outfit", 5), "M_Sole": ("outfit", 14)}, **uni("shoes_boots", 18, 248, "boots"))
def boots(pc):
    """The universal boot: the chunky shoe, open over the instep into a shaft to below the knee, flaring at its top."""
    shoe(pc, CHUNKY, (0.066, 0.026), (-0.094, 0.018), open_top=(0, 1))
    legs(pc, [0.04, 0.09, 0.128], [0.016, 0.016, 0.021])


@part("shoes_sandals", "shoes", "Sandals", {"M_Main": ("outfit", 4), "M_Sole": ("outfit", 5)}, **uni("shoes_sandals", 19, 152))
def sandals(pc):
    """The universal sandal: a footbed, a strap over the toes, a strap round the ankle."""
    outline = [(0, 0.058), (0.027, 0.05), (0.039, 0.02), (0.043, -0.02), (0.041, -0.056), (0.028, -0.08), (0, -0.09),
               (-0.028, -0.08), (-0.041, -0.056), (-0.043, -0.02), (-0.039, 0.02), (-0.027, 0.05)]
    for sx, s in SIDES:
        lx = sx * B.LEG_X
        pc.region, pc.mat = f"foot_{s}", "M_Sole"
        pc.band([[Vector((lx + x, y, z)) for x, y in outline] for z in (0.0, 0.01)],
                caps=(Vector((lx, -0.015, -0.002)), Vector((lx, -0.015, 0.012))))
        pc.mat = "M_Main"
        y, ra, rb, zc = -0.035, 0.0375 + 0.004, 0.0243 + 0.004, 0.0243        # the toe strap over the forefoot
        arc = [(lx + math.sin(math.radians(a)) * ra, zc + math.cos(math.radians(a)) * rb) for a in range(-105, 106, 35)]
        pc.band([[Vector((x, y - 0.009, z)) for x, z in arc], [Vector((x, y + 0.009, z)) for x, z in arc]], closed=False,
                refs=[Vector((lx, y, zc))])
    legs(pc, [0.036, 0.05], [0.004, 0.004])


# ================================================================ build + export
kit.build_parts(PARTS, rig, "outfits", "outfits", post=fit, only=ONLY)
print("OUTFITS_OK", len(PARTS))
