// Markdown tables from perf-bench rows: node specs/perf/table.mjs runs/a.jsonl [runs/b.jsonl ...]
import { readFileSync } from "node:fs";
const f = v => (v === null || v === undefined ? "–" : typeof v === "number" ? +v.toFixed(1) : v);
console.log("| Scene | Tier | Build | FPS | 1% low | Median ms | p95 ms | Worst ms | First ult ms | Second ult ms | Draw calls | Triangles | Scene renders | Skinned meshes | Mixers / frame | Skeletons / frame | Frame CPU ms (p95) | JS heap MB |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const file of process.argv.slice(2)) for (const line of readFileSync(file, "utf8").trim().split("\n")) {
  const r = JSON.parse(line), p = r.perf, build = (/prod/.test(file) ? "prod" : "dev") + (r.uncapped === false ? ", vsync" : "");
  console.log(`| ${r.scene}${r.ult ? ` (${r.ult})` : ""} | ${r.tier} | ${build} | ${f(r.fps)} | ${f(r.low1)} | ${f(r.median)} | ${f(r.p95)} | ${f(r.worst)} | ${f(r.firstUlt)} | ${f(r.secondUlt)} | ${Math.round(p.calls.median)} | ${Math.round(p.triangles.median / 1000)}k | ${f(p.scenes?.median)} | ${r.sceneCounts.skinned} | ${f(p.mixers.median)} | ${f(p.skeletons.median)} | ${f(p.cpu.median)} (${f(p.cpu.p95)}) | ${r.heapMB} |`);
}
