"""Per hairstyle GLB: vertex positions whose corner normals differ by 1-60 degrees (a hard edge: faceting), and the worst.
  python3 specs/evidence/head-v10/hard_edges.py <glb> ...    (head-v10: Full 1,520 -> 34, LOD 1 4,600 -> 86, LOD 2 4,299 -> 12)"""
import json, struct, sys
import numpy as np
COMP = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
def read(path):
    b = open(path, "rb").read()
    jl = struct.unpack_from("<I", b, 12)[0]
    js = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack_from("<I", b, off)[0]
    bin_ = b[off + 8: off + 8 + bl]
    def acc(i):
        a = js["accessors"][i]; bv = js["bufferViews"][a["bufferView"]]
        dt = COMP[a["componentType"]]; n = NC[a["type"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = bv.get("byteStride")
        if stride and stride != n * np.dtype(dt).itemsize:
            raw = np.frombuffer(bin_, np.uint8, count=stride * a["count"], offset=start).reshape(a["count"], stride)
            return raw[:, :n * np.dtype(dt).itemsize].copy().view(dt).reshape(a["count"], n)
        return np.frombuffer(bin_, dt, count=a["count"] * n, offset=start).reshape(a["count"], n)
    out = []
    for m in js["meshes"]:
        for p in m["primitives"]:
            P = acc(p["attributes"]["POSITION"]); N = acc(p["attributes"]["NORMAL"]).astype(np.float64)
            out.append((P, N))
    return out
for path in sys.argv[1:]:
    tot_split, worst, nv = 0, 0.0, 0
    hist = []
    for P, N in read(path):
        nv += len(P)
        key = np.round(P / 1e-5).astype(np.int64)
        _, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.ravel()
        order = np.argsort(inv)
        g = inv[order]
        starts = np.flatnonzero(np.r_[True, g[1:] != g[:-1]])
        ends = np.r_[starts[1:], len(g)]
        for s, e in zip(starts, ends):
            if e - s < 2: continue
            nn = N[order[s:e]]
            G = np.clip(nn @ nn.T, -1, 1)
            A = np.degrees(np.arccos(G))
            A = A[(A > 1.0) & (A < 60.0)]
            if len(A):
                tot_split += 1; worst = max(worst, A.max()); hist.append(A.max())
    print(f"{path.split('/')[-1]:32s} verts={nv:6d} split_positions={tot_split:5d} worst={worst:6.1f} over20={sum(1 for h in hist if h>20)} over45={sum(1 for h in hist if h>45)}")
