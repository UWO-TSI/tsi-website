// `npm run perf:check` (web/package.json; specs/perf/README.md): the performance regression gate. It builds the
// measurement build (measure-build.sh: production, the dev gates lifted), serves it with Supabase blanked, runs the
// bench scenes (perf-bench.mjs) headed on the real GPU several times, takes the median of the runs, and compares them
// with the committed baseline (specs/perf/baseline.json) and the budget (web/lib/game/perf/budget.ts SCENE_BUDGET).
// It fails when a scene's median frame or its draw calls regress more than 10% on the baseline, or go over budget.
// A scene that looks regressed is run twice more before it is judged (a busy machine makes single runs noisy).
//
//   cd web && npm run perf:check                   build, bench, compare (about 10 minutes)
//   npm run perf:check -- --update                 the same, then write the medians as the new baseline
//   Env: SKIP_BUILD=1 (bench the build already in web/.next), KEEP_BUILD=1 (leave web/.next; by default it is deleted:
//   a measurement build must never be deployed), RUNS (default 3), SCENES (default village,v2,cafe,ruins-summoner),
//   TIERS (default high,lite), PORT (default 3158), TOLERANCE (default 0.10), PERF_BUDGET=off (other machines: skip
//   the reference-machine budget), LOCK_OWNER=<branch> (take the shared machine's heavy lock for the build and the
//   devserver lock for the bench, as the agents' rules ask).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { loadavg, cpus } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "../.."), web = join(root, "web");
const UPDATE = process.argv.includes("--update"), RUNS = Number(process.env.RUNS ?? 3), PORT = process.env.PORT ?? "3158";
const SCENES = (process.env.SCENES ?? "village,v2,cafe,ruins-summoner").split(","), TIERS = (process.env.TIERS ?? "high,lite").split(",");
const TOLERANCE = Number(process.env.TOLERANCE ?? 0.1), BUDGET = process.env.PERF_BUDGET !== "off", OWNER = process.env.LOCK_OWNER ?? "";
const BASELINE = join(here, "baseline.json"), LOCKS = "/private/tmp/claude-501";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** The shared machine's locks (CLAUDE agents): mkdir, the owner's first word is the branch; wait while someone else holds it. */
async function lock(name) {
  if (!OWNER) return () => {};
  const dir = join(LOCKS, `uwotsi-${name}.lock`);
  for (;;) {
    try { mkdirSync(dir); writeFileSync(join(dir, "owner"), `${OWNER} ${new Date().toISOString()}\n`); break; } catch {
      const who = existsSync(join(dir, "owner")) ? readFileSync(join(dir, "owner"), "utf8") : "";
      if (who.startsWith(`${OWNER} `)) break;
      console.log(`waiting for the ${name} lock (${who || "?"})`);
      await sleep(15000);
    }
  }
  return () => { try { if (readFileSync(join(dir, "owner"), "utf8").startsWith(`${OWNER} `)) rmSync(dir, { recursive: true }); } catch {} };
}

const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_SUPABASE_ANON_KEY: "perf-bench", SUPABASE_SERVICE_ROLE_KEY: "" };
if (process.env.SKIP_BUILD !== "1") {
  if (existsSync(join(web, ".next"))) rmSync(join(web, ".next"), { recursive: true });
  const release = await lock("heavy");
  try { execFileSync("sh", [join(here, "measure-build.sh")], { stdio: ["ignore", "ignore", "inherit"], env: { ...env, NODE_OPTIONS: "--max-old-space-size=8192" } }); } finally { release(); }
}
if (!existsSync(join(web, ".next"))) { console.error("no build in web/.next (run without SKIP_BUILD=1)"); process.exit(2); }

const releaseServer = await lock("devserver");
const server = spawn("npx", ["next", "start", "-p", PORT], { cwd: web, env, stdio: "ignore", detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch {} };
process.on("exit", () => { stopServer(); releaseServer(); });
for (let i = 0; ; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/lab/island`)).ok) break; } catch {}
  if (i > 120) { console.error("the server never came up"); process.exit(2); }
  await sleep(1000);
}

/** One bench run of the scenes on a tier: perf-bench.mjs's rows. */
function bench(tier, scenes) {
  const out = join(LOCKS, `perf-check-${process.pid}-${Date.now()}.jsonl`);
  execFileSync("node", [join(here, "perf-bench.mjs"), scenes.join(","), out], { env: { ...process.env, PORT, TIER: tier, SECONDS: process.env.SECONDS ?? "8" }, stdio: ["ignore", "ignore", "inherit"] });
  const rows = existsSync(out) ? readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
  rmSync(out, { force: true });
  return rows;
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const runs = new Map(); // `${scene}|${tier}` → rows
const add = r => { const k = `${r.scene}|${r.tier}`; if (!runs.has(k)) runs.set(k, []); runs.get(k).push(r); };
for (let i = 0; i < RUNS; i++) for (const tier of TIERS) for (const r of bench(tier, SCENES)) add(r);

const summarise = rows => ({
  frameMs: +median(rows.map(r => r.median)).toFixed(2), p95Ms: +median(rows.map(r => r.p95)).toFixed(2), cpuMs: +median(rows.map(r => r.perf.cpu.median)).toFixed(2),
  draws: Math.round(median(rows.map(r => r.perf.calls.median))), triangles: Math.round(median(rows.map(r => r.perf.triangles.median))),
  fps: +median(rows.map(r => r.fps)).toFixed(1), runs: rows.length, load: +median(rows.map(r => r.load)).toFixed(1),
  spread: +((Math.max(...rows.map(r => r.median)) - Math.min(...rows.map(r => r.median))) / median(rows.map(r => r.median))).toFixed(2),
});
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
const budget = BUDGET ? (await import(join(web, "lib/game/perf/budget.ts"))).SCENE_BUDGET : null;
const regressed = (now, was) => now.frameMs > was.frameMs * (1 + TOLERANCE) || now.draws > was.draws * (1 + TOLERANCE);
const sceneOf = s => (s.startsWith("ruins") ? "ruins" : s === "v2cells" ? "v2" : s);

// Re-run what looks regressed, twice, before judging it.
if (base && !UPDATE) for (const [k, rows] of runs) {
  const was = base.scenes[k];
  if (!was || !regressed(summarise(rows), was)) continue;
  const [scene, tier] = k.split("|");
  console.log(`${k} looks regressed; running it twice more`);
  for (let i = 0; i < 2; i++) for (const r of bench(tier, [scene])) add(r);
}

const failures = [], lines = [];
const pct = (now, was) => `${now > was ? "+" : ""}${(((now - was) / was) * 100).toFixed(1)}%`;
lines.push("| Scene | Tier | Median frame ms | p95 ms | Frame CPU ms | Draw calls | Triangles | Runs | Spread | Load |", "|---|---|---|---|---|---|---|---|---|---|");
const result = {};
for (const [k, rows] of runs) {
  const now = summarise(rows), was = base?.scenes[k], [scene, tier] = k.split("|");
  result[k] = now;
  const cell = (f, digits = 2) => (was ? `${now[f].toFixed(digits)} (${was[f].toFixed(digits)}, ${pct(now[f], was[f])})` : now[f].toFixed(digits));
  lines.push(`| ${scene} | ${tier} | ${cell("frameMs")} | ${cell("p95Ms")} | ${cell("cpuMs")} | ${cell("draws", 0)} | ${cell("triangles", 0)} | ${now.runs} | ${(now.spread * 100).toFixed(0)}% | ${now.load} |`);
  if (was && !UPDATE) {
    if (now.frameMs > was.frameMs * (1 + TOLERANCE)) failures.push(`${k}: median frame ${now.frameMs} ms, ${pct(now.frameMs, was.frameMs)} on the baseline's ${was.frameMs}`);
    if (now.draws > was.draws * (1 + TOLERANCE)) failures.push(`${k}: ${now.draws} draw calls, ${pct(now.draws, was.draws)} on the baseline's ${was.draws}`);
  }
  const b = budget?.[sceneOf(scene)]?.[tier];
  if (b) for (const f of ["frameMs", "cpuMs", "draws", "triangles"]) if (now[f] > b[f]) failures.push(`${k}: ${f} ${now[f]} over the budget's ${b[f]} (web/lib/game/perf/budget.ts)`);
}
console.log(lines.join("\n"));
console.log(`\nMedian of ${RUNS}+ runs each; in brackets the baseline (${base ? `${base.commit} ${base.date}` : "none"}) and the change. Load: the 1-minute load average.`);

if (UPDATE) {
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root }).toString().trim();
  writeFileSync(BASELINE, JSON.stringify({ commit, date: new Date().toISOString().slice(0, 10), machine: `${cpus()[0].model}, ${cpus().length} cores`, runs: RUNS,
    note: "medians of perf-check runs; refresh with npm run perf:check -- --update (specs/perf/README.md)", load: +loadavg()[0].toFixed(1), scenes: result }, null, 2) + "\n");
  console.log(`wrote ${BASELINE}`);
}
stopServer();
if (process.env.KEEP_BUILD !== "1") rmSync(join(web, ".next"), { recursive: true, force: true });
if (failures.length) { console.log(`\nperf:check FAILED\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log(base || UPDATE ? "\nperf:check passed" : "\nno baseline yet: run npm run perf:check -- --update");
