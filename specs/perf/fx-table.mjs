// The effect cost table from fx-bench.mjs rows (specs/perf/effects-cost.md): per effect and player count, the median
// over the rounds of (effect on − base) for each measure, and the spread of the frame-time differences.
//   node specs/perf/fx-table.mjs runs/fx-n1.jsonl runs/fx-n12.jsonl runs/fx-n24.jsonl [--json]
// world-bench.mjs rows read the same way: each variant as "<scene>/<variant>" at 24 players.
import { readFileSync } from "node:fs";
const files = process.argv.slice(2).filter(a => !a.startsWith("--")), JSON_OUT = process.argv.includes("--json");
// Only pairs whose two base samples agreed (fx-bench.mjs `valid`); the base is the mean of the samples either side.
const avg = (a, b) => (typeof a === "number" ? (a + b) / 2 : a && typeof a === "object" ? Object.fromEntries(Object.keys(a).map(k => [k, avg(a[k], b?.[k])])) : a);
const rows = files.flatMap(f => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l)))
  .filter(r => r.valid !== false).map(r => (r.after ? { ...r, base: avg(r.base, r.after) } : r))
  .map(r => (r.variant ? { ...r, effect: `${r.scene}/${r.variant}${r.pixel === false ? ` (${r.size}, no pixel finish)` : ""}`, n: 24, where: `${r.scene}|${r.size}|${r.pixel}` } : r));
// And none from a slow spell (a base over 1.5× the quietest base of its tier and player count: the window slowed by
// something else on the machine; fx-bench.mjs only knows the quietest base so far).
const quietest = new Map();
const where = r => `${r.tier}|${r.n}|${r.where ?? ""}`;
for (const r of rows) quietest.set(where(r), Math.min(quietest.get(where(r)) ?? Infinity, r.base.frameMs));
const kept = rows.filter(r => r.base.frameMs <= 1.5 * quietest.get(where(r)));
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const groups = new Map();
for (const r of kept) { const k = `${r.tier}|${r.n}|${r.effect}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const d = (list, get) => median(list.map(r => get(r.on) - get(r.base)));
const out = [];
for (const [k, list] of groups) {
  const [tier, n, effect] = k.split("|"), on = list.at(-1).on;
  const diffs = list.map(r => r.on.frameMs - r.base.frameMs);
  out.push({
    tier, n: +n, effect, reps: list.length,
    frameMs: d(list, s => s.frameMs), frameSpread: Math.max(...diffs) - Math.min(...diffs),
    taskMs: d(list, s => s.taskMs), cpuMs: d(list, s => s.cpuMs), styleLayoutMs: d(list, s => s.styleMs + s.layoutMs),
    calls: d(list, s => s.calls), triangles: d(list, s => s.triangles),
    gpuMs: on.gpu?.available ? d(list, s => s.gpu.median) : null,
    geometries: d(list, s => s.scene?.geometries ?? NaN), textures: d(list, s => s.scene?.textures ?? NaN), programs: d(list, s => s.scene?.programs ?? NaN), heapMB: d(list, s => s.heapMB ?? NaN),
    baseFrameMs: median(list.map(r => r.base.frameMs)), baseTaskMs: median(list.map(r => r.base.taskMs)), baseCalls: median(list.map(r => r.base.calls)),
    full: on.full, reduced: on.reduced, auras: on.auras, plates: on.plates, load: median(list.map(r => r.load)),
  });
}
out.sort((a, b) => a.tier.localeCompare(b.tier) || a.effect.localeCompare(b.effect) || a.n - b.n);
if (JSON_OUT) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
const f = (v, p = 2) => (v === null || Number.isNaN(v) ? "–" : (v > 0 ? "+" : "") + v.toFixed(p));
console.log("| Effect | Players (Full) | Frame ms (± spread) | Main thread ms | Frame CPU ms | Style + layout ms | Draws | Triangles | GPU ms | Geometries / textures / programs | Heap MB | Load |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of out) console.log(`| ${r.effect} | ${r.n} (${r.full}) | ${f(r.frameMs)} (±${(r.frameSpread / 2).toFixed(2)}) | ${f(r.taskMs)} | ${f(r.cpuMs)} | ${f(r.styleLayoutMs)} | ${f(r.calls, 0)} | ${f(r.triangles, 0)} | ${f(r.gpuMs)} | ${f(r.geometries, 0)} / ${f(r.textures, 0)} / ${f(r.programs, 0)} | ${f(r.heapMB, 1)} | ${r.load.toFixed(1)} |`);
