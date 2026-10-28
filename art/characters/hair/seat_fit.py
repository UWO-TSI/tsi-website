"""Provisional Roblox attachments: where each of David's hairs sits on Roblox's classic head, estimated from its shape
(specs/characters/head-roblox.md).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hair/seat_fit.py [-- --write] [--only id,id]

Roblox attaches a hair by its own HairAttachment (Position and Orientation in its Handle) to the head's HairAttachment,
the classic head's top centre. Three of David's accessory files were readable (#1, #6, #11: hair/roblox_attachments.json,
provisional false); the other entries are estimated here until David copies the real values from Studio. Only entries
with provisional true are ever written, and only with --write.

The estimate, in the classic head's frame (studs, the HairAttachment at the origin, Blender axes):
  1. seat: the translation that seats the hair's inside on the head (median air over the cap, rays lat >= 10 from the
     head centre, with a cost for hair under the skin and for an uncovered crown), from a grid start, coordinate descent
  2. lift: Roblox hair is placed by eye and stands proud of the classic head's flat top (#11's dome has 0.28 stud of
     air over it): seated, the head shows through the crown of most of David's hairs. #6 and #11 stand 0.192 and
     0.200 stud above their seats in Roblox, so every estimate goes up by their mean, LIFT (a fixed lift beat every
     contact rule tried: those slide the bowl down the head's straight sides or stall on strand roots)
A covers-top piece (a tuft) stands on the top: its lowest point at the attachment.
The calibration is printed: the estimate for #6 and #11 against their real attachments.
"""
import bpy, json, math, os, struct, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ART, "base"))
from head_shape import CLASSIC  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DATA = os.path.join(HERE, "roblox_attachments.json")
SETS = ("david", "david-b2", "david-b3")  # David's hair sets (wardrobe batches 2 and 3 added david-b2, david-b3)
MANIFEST = {h["id"]: dict(h, _dir=os.path.join(HERE, "source", who)) for who in SETS
            for h in json.load(open(os.path.join(HERE, "source", who, "manifest.json")))["hairs"]}
ONLY = set(ARGS[ARGS.index("--only") + 1].split(",")) if "--only" in ARGS else None
LIFT = 0.196            # stud: #6 and #11 stand 0.192 and 0.200 above their seats in Roblox
HC = np.array([0.0, 0.0, -CLASSIC["H"]])          # the classic head's centre, studs below its HairAttachment


def sdf(p):
    a, b, f = CLASSIC["R"] - CLASSIC["F"], CLASSIC["H"] - CLASSIC["F"], CLASSIC["F"]
    q = p - HC
    dx = np.hypot(q[..., 0], q[..., 1]) - a
    dz = np.abs(q[..., 2]) - b
    return np.hypot(np.maximum(dx, 0), np.maximum(dz, 0)) + np.minimum(np.maximum(dx, dz), 0) - f


def load_glb(path):
    """Positions and triangles of every primitive (the raw Roblox mesh: mesh2glb keeps its coordinates)."""
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    J = json.loads(b[20:20 + jl])
    bin_ = b[20 + jl + 8:]
    V, F = [], []
    for m in J["meshes"]:
        for p in m["primitives"]:
            a = J["accessors"][p["attributes"]["POSITION"]]
            bv = J["bufferViews"][a["bufferView"]]
            v = np.frombuffer(bin_, np.float32, a["count"] * 3, bv.get("byteOffset", 0) + a.get("byteOffset", 0)).reshape(-1, 3)
            ia = J["accessors"][p["indices"]]
            ibv = J["bufferViews"][ia["bufferView"]]
            dt = {5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[ia["componentType"]]
            idx = np.frombuffer(bin_, dt, ia["count"], ibv.get("byteOffset", 0) + ia.get("byteOffset", 0)).reshape(-1, 3).astype(np.int64)
            F.append(idx + sum(len(x) for x in V))
            V.append(v.astype(np.float64))
    return np.concatenate(V), np.concatenate(F)


def rot_orientation(o):
    """Roblox Orientation (degrees) as a matrix: CFrame.fromOrientation, applied Y then X then Z (R = Ry Rx Rz)."""
    x, y, z = (math.radians(a) for a in o)
    rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]])
    return ry @ rx @ rz


def to_blender(v):
    """Roblox axes (+X the character's right, Y up, the face toward -Z) to Blender's (+X its left, Z up, the face
    toward -Y): a half turn, no mirror."""
    return np.stack([-v[..., 0], v[..., 2], v[..., 1]], -1)


def from_blender(b):
    return np.stack([-b[..., 0], b[..., 2], b[..., 1]], -1)


RAYS = []
for la in range(10, 90, 5):
    for lo in range(-180, 180, 10):
        a, b = math.radians(la), math.radians(lo)
        RAYS.append((la, np.array([math.cos(a) * math.sin(b), -math.cos(a) * math.cos(b), math.sin(a)])))
LATS = np.array([la for la, _ in RAYS])


def surf_r(d):
    lo, hi = 0.0, 1.5
    for _ in range(40):
        m = (lo + hi) / 2
        if sdf(HC + d * m) < 0:
            lo = m
        else:
            hi = m
    return lo


SR = np.array([surf_r(d) for _, d in RAYS])


def gaps(tree, t, grow=0.0):
    """Air between the classic head (grown by `grow` studs) and the hair's inside on each ray (NaN: no hair), the hair
    moved by t."""
    out = np.full(len(RAYS), np.nan)
    for i, (_, d) in enumerate(RAYS):
        loc, _, _, _ = tree.ray_cast(Vector(HC + d * (SR[i] + grow - 0.06) - t), Vector(d), 2.0)
        if loc is not None:
            out[i] = np.dot(np.array(loc) + t - HC, d) - SR[i] - grow
    return out


def seat(tree, vb, grow=0.0):
    """1. The translation seating the hair's inside on the head; `grow` (studs): on the head grown by that much (wardrobe
    batch 2: a hat seated over the hair, accessories/import_roblox.py)."""
    top = LATS >= 55

    def cost(t):
        g = gaps(tree, t, grow)
        ok = ~np.isnan(g)
        if ok.sum() < 20:
            return 10.0
        gg = g[ok]
        return np.median(np.abs(gg)) + 3 * np.mean(np.maximum(0, -gg - 0.01)) + (1 - ok[top].mean())
    lo, hi = vb.min(0), vb.max(0)
    best = None
    for dz in np.arange(-0.2, 0.5, 0.05):
        for dy in np.arange(-0.2, 0.21, 0.1):
            t = np.array([-(lo[0] + hi[0]) / 2, dy - (lo[1] + hi[1]) / 2, dz - hi[2]])
            c = cost(t)
            if best is None or c < best[1]:
                best = (t, c)
    t, step = best[0], np.array([0.02, 0.04, 0.04])
    for _ in range(60):
        moved = False
        for k in range(3):
            for s in (1, -1):
                t2 = t.copy()
                t2[k] += s * step[k]
                c = cost(t2)
                if c < best[1]:
                    best, t, moved = (t2, c), t2, True
        if not moved:
            step = step / 2
            if step.max() < 0.002:
                break
    return t


def lift(t):
    """2. Up by LIFT: Roblox hair stands that much prouder of the classic head than its seat."""
    return t + np.array([0.0, 0.0, LIFT])


def estimate(e):
    v, F = load_glb(os.path.join(MANIFEST[e["id"]]["_dir"], e["file"]))
    R = rot_orientation(e["orientation"])
    w = (np.asarray(e["mesh_scale"], float) * v) @ R          # R^T applied to row vectors
    vb = to_blender(w)
    if MANIFEST[e["id"]].get("covers") == ["top"]:            # a tuft stands on the top
        t = np.array([-(vb[:, 0].min() + vb[:, 0].max()) / 2, -(vb[:, 1].min() + vb[:, 1].max()) / 2, -vb[:, 2].min()])
    else:
        tree = BVHTree.FromPolygons([Vector(x) for x in vb], [list(f) for f in F])
        t = lift(seat(tree, vb))
    # world = R^T (s v - p) -> to_blender: vb - to_blender(R^T p) = vb + t  =>  p = -R from_blender(t)
    return -(R @ from_blender(t))


def main():
    doc = json.load(open(DATA))
    for e in doc["hairs"]:
        if not e["provisional"]:
            p = estimate(e)
            err = np.linalg.norm(p - np.array(e["position"]))
            print(f"CALIBRATION #{e['n']:02d} {e['id']:22s} estimate {np.round(p, 3)} real {np.round(e['position'], 3)} error {err:.3f} stud")
    for e in doc["hairs"]:
        if e["provisional"] and (not ONLY or e["id"] in ONLY):
            p = estimate(e)
            print(f"PROVISIONAL #{e['n']:02d} {e['id']:22s} position {np.round(p, 4)} orientation {e['orientation']}")
            if "--write" in ARGS:
                e["position"] = [round(float(x), 5) for x in p]
    if "--write" in ARGS:
        json.dump(doc, open(DATA, "w"), indent=1)
        print("SEAT_FIT_WRITTEN", DATA)


if __name__ == "__main__":       # art/characters/accessories/import_roblox.py imports seat() from here
    main()
