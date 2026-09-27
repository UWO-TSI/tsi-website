// Per referenced asset: share of vertex normals pointing away from the mesh centroid (outward), per mesh/material.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { readFileSync } from "node:fs";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const refs = readFileSync(process.argv[2], "utf8").trim().split("\n").filter((s) => /acnh\/(props|plants|buildings|furniture)|nature\//.test(s));
for (const ref of refs) {
  const doc = await io.read("public" + ref);
  const parts = [];
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute("POSITION"), nrm = p.getAttribute("NORMAL"); if (!pos || !nrm) continue;
    const n = pos.getCount(), c = [0, 0, 0];
    for (let i = 0; i < n; i++) { const v = pos.getElement(i, []); c[0] += v[0] / n; c[1] += v[1] / n; c[2] += v[2] / n; }
    let out = 0, up = 0;
    for (let i = 0; i < n; i++) { const v = pos.getElement(i, []), m = nrm.getElement(i, []); if ((v[0] - c[0]) * m[0] + (v[1] - c[1]) * m[1] + (v[2] - c[2]) * m[2] > 0) out++; up += m[1] / n; }
    parts.push(`${(p.getMaterial()?.getName() ?? "?").slice(0, 18)} out ${(100 * out / n).toFixed(0)}% upN ${up.toFixed(2)}`);
  }
  console.log(ref.replace("/assets/", "").padEnd(34), parts.join(" | "));
}
