// Asset census for the shadow investigation: orientation, mirroring, winding vs normals, baked shadow meshes.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = execSync("find public/assets -name '*.glb'").toString().trim().split("\n");
const refs = new Set(readFileSync(process.argv[2], "utf8").trim().split("\n").map((s) => "public" + s));
const mul = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
const det3 = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
const xf = (m, v, w = 1) => [0, 1, 2].map((i) => m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * w);
const rows = [];
for (const f of files) {
  let doc; try { doc = await io.read(f); } catch (e) { rows.push({ f, err: String(e).slice(0, 80) }); continue; }
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const r = { f, ref: refs.has(f), meshes: 0, mirrored: 0, shadowMeshes: [], inverted: 0, tris: 0, minY: Infinity, maxY: -Infinity, rootRot: null, upAxis: null, dbl: 0, mats: 0 };
  const walk = (node, parent) => {
    const m = mul(parent, node.getMatrix());
    if (parent === ID && !r.rootRot) { const q = node.getRotation(); if (Math.abs(q[3]) < 0.999) r.rootRot = q.map((x) => +x.toFixed(3)); }
    const mesh = node.getMesh();
    if (mesh) {
      r.meshes++;
      const up = xf(m, [0, 1, 0], 0); r.upAxis = r.upAxis ?? up.map((x) => +x.toFixed(2));
      const d = det3(m); if (d < 0) r.mirrored++;
      for (const p of mesh.listPrimitives()) {
        const mat = p.getMaterial(); const mname = (mat?.getName() ?? "") + "|" + mesh.getName() + "|" + node.getName();
        if (/shadow/i.test(mname)) r.shadowMeshes.push(mname.split("|").filter(Boolean)[0]);
        if (mat) { r.mats++; if (mat.getDoubleSided()) r.dbl++; }
        const pos = p.getAttribute("POSITION"), nrm = p.getAttribute("NORMAL"), idx = p.getIndices();
        if (!pos) continue;
        const n = idx ? idx.getCount() : pos.getCount();
        const P = (i) => pos.getElement(i, []), N = (i) => nrm ? nrm.getElement(i, []) : null;
        for (let i = 0; i < pos.getCount(); i++) { const w = xf(m, P(i)); r.minY = Math.min(r.minY, w[1]); r.maxY = Math.max(r.maxY, w[1]); }
        let agree = 0, total = 0;
        for (let t = 0; t + 2 < n; t += 3) {
          const [a, b, c] = idx ? [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)] : [t, t + 1, t + 2];
          const A = P(a), B = P(b), C = P(c);
          const e1 = B.map((x, k) => x - A[k]), e2 = C.map((x, k) => x - A[k]);
          const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          if (!nrm || Math.hypot(...g) < 1e-12) continue;
          const na = N(a), nb = N(b), nc = N(c); const s = [0, 1, 2].map((k) => na[k] + nb[k] + nc[k]);
          total++; if (g[0] * s[0] + g[1] * s[1] + g[2] * s[2] > 0) agree++;
        }
        r.tris += total; r.inverted += total - agree;
      }
    }
    for (const c of node.listChildren()) walk(c, m);
  };
  const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const n of scene.listChildren()) walk(n, ID);
  rows.push(r);
}
console.log(JSON.stringify(rows));
