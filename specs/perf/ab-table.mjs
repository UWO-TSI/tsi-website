// Before/after table from ab.sh's rows, each value the mean over the rounds:
//   node specs/perf/ab-table.mjs runs/ab-prod-high   (reads <prefix>-before.jsonl and <prefix>-after.jsonl)
import { readFileSync } from "node:fs";
const prefix = process.argv[2];
const read = b => readFileSync(`${prefix}-${b}.jsonl`, "utf8").trim().split("\n").map(l => JSON.parse(l));
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const group = rows => { const m = new Map(); for (const r of rows) { if (!m.has(r.scene)) m.set(r.scene, []); m.get(r.scene).push(r); } return m; };
const B = group(read("before")), A = group(read("after"));
const f = v => (v === null || Number.isNaN(v) ? "–" : +v.toFixed(1));
const fields = [["FPS", r => r.fps], ["1% low", r => r.low1], ["Median ms", r => r.median], ["p95 ms", r => r.p95], ["Worst ms", r => r.worst],
  ["First ult ms", r => r.firstUlt], ["Second ult ms", r => r.secondUlt], ["Frame CPU ms", r => r.perf.cpu.median], ["Draw calls", r => r.perf.calls.median],
  ["Skeleton uploads", r => r.perf.skeletons.median], ["Mixers", r => r.perf.mixers.median], ["JS heap MB", r => r.heapMB]];
console.log(`| Scene | ${fields.map(([n]) => n).join(" | ")} |`);
console.log(`|---|${fields.map(() => "---").join("|")}|`);
for (const [scene, before] of B) {
  const after = A.get(scene) ?? [];
  const cell = ([, get]) => { const b = mean(before.map(get).filter(v => v !== null)), a = mean(after.map(get).filter(v => v !== null)); return `${f(b)} → **${f(a)}**`; };
  console.log(`| ${scene}${before[0].ult ? ` (${before[0].ult})` : ""} | ${fields.map(cell).join(" | ")} |`);
}
console.log(`\n${new Set([...B.values()].map(v => v.length)).size === 1 ? [...B.values()][0].length : "?"} round(s) each, interleaved.`);
