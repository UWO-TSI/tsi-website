// GLB bbox reader: aggregates POSITION accessor min/max from the JSON chunk
// (approximate — ignores node transforms; good enough for pipeline
// calibration between same-family exports). Usage: node scripts/glb-bbox.mjs a.glb [b.glb...]
import fs from "fs";
for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const acc = json.accessors?.[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], acc.min[i]);
        max[i] = Math.max(max[i], acc.max[i]);
      }
    }
  }
  const size = max.map((v, i) => v - min[i]);
  console.log(f.split("/").pop(), "size:", size.map((v) => v.toFixed(3)).join(" × "));
}
