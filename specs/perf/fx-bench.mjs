// The character-effect bench (specs/perf/effects-cost.md): what each of the other players' effects costs at N players.
//   PORT=3158 N=24 node specs/perf/fx-bench.mjs <out.jsonl> [effects]
//   effects: comma list of lib/game/perf/fxBench.ts FX_KEYS (default: all), plus "natural" (every effect as the bots do
//   them, nothing forced) and "stacked" (every effect forced at once).
//   Env: N bots (default 12), REPS (default 3), SECONDS per sample (default 4), SETTLE seconds after a switch (1.5),
//   TIER=high|lite, UNCAPPED=0 to keep the display's pace, SHOTS=dir (a screenshot of each effect forced on, rep 1).
// One page per run (the measurement build: specs/perf/measure-build.sh; or next dev): the village with ?bots=N, the
// players stood in the bench's block in front of you (window.__fx formation), every effect switched off as the base.
// Each effect alone (forced on every player in view where it can be) is then measured between two base samples, round
// after round, so a busy machine weighs on both alike; pairs whose bases disagree are rejected and retried. Per sample: frames (requestAnimationFrame), the probe's
// draw calls, triangles and frame CPU (window.__perf), the main thread's busy time per frame from the DevTools
// Performance domain (script, style, layout: what the probe can't see, the nameplates' DOM work), GPU time where the
// browser has timer queries, the renderer's geometries, textures and programs, and the JS heap.
// Headed, off to the side, muted, never brought to the front; the real GPU (ANGLE on Metal).
import { createRequire } from "node:module";
import { appendFileSync, mkdirSync } from "node:fs";
import { loadavg } from "node:os";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "/tmp/fx-bench.jsonl", ONLY = ""] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3158, N = Number(process.env.N ?? 12), REPS = Number(process.env.REPS ?? 3), SECONDS = Number(process.env.SECONDS ?? 4);
const SETTLE = Number(process.env.SETTLE ?? 1.5), TIER_NAME = process.env.TIER ?? "high", UNCAPPED = process.env.UNCAPPED !== "0", SHOTS = process.env.SHOTS ?? "";
const KEYS = ["auraFamily", "auraSubclass", "dust", "juice", "ghost", "leaf", "held", "weapon", "rod", "fishing", "plates", "shadows", "emotes", "interp"];
/** Effects that can't be forced (they follow what the players do, or are always there): measured as merely switched on. */
const NATURAL_ONLY = new Set(["dust", "plates", "shadows", "interp"]);
const EFFECTS = ONLY ? ONLY.split(",") : [...KEYS, "natural", "stacked"];
const args = ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-precise-memory-info"];
if (UNCAPPED) args.push("--disable-gpu-vsync", "--disable-frame-rate-limit");
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const TIER = { high: { "tsi.liteMode.v1": "false", "tsi.shadows.v1": "true" }, lite: { "tsi.liteMode.v1": "true", "tsi.shadows.v1": "false" } }[TIER_NAME];

const browser = await chromium.launch({ headless: false, args });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([look, store]) => { try {
  localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.hud.full.v1", "true");
  localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
} catch {} }, [LOOK, TIER]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable", { timeDomain: "threadTicks" });

await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&bots=${N}&fxoff=all`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas", { timeout: 240000 });
for (let quiet = 0; quiet < 3;) {
  await page.waitForTimeout(1000);
  quiet = (await page.evaluate(() => !!window.__perf && !!window.__fx && !!window.__move?.sim?.current && (window.__net?.remotes().length ?? 0) > 0)) ? quiet + 1 : 0;
}
await page.waitForTimeout(4000);
// Where you stand: pinned there before every sample (a headed window can take stray keys and walk you off).
const home = await page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, z: s.z, facing: s.facing }; });
const pin = () => page.evaluate(h => {
  const s = window.__move.sim.current.state, off = Math.hypot(s.x - h.x, s.z - h.z);
  if (off > 0.05) window.__move.teleport(h.x, h.z, h.facing);
  return off;
}, home);
// The block, built from the settled camera; then everything forced once so shaders compile and models load before any sample.
const set = s => page.evaluate(s => window.__fx.set(s), s);
await set({ formation: false }); await page.waitForTimeout(300); await set({ formation: true });
await set({ off: [], force: KEYS.filter(k => !NATURAL_ONLY.has(k)) }); await page.waitForTimeout(3000);
for (const k of ["held", "weapon", "auraFamily"]) { await set({ off: [], force: [k] }); await page.waitForTimeout(1500); }
await set({ off: "all", force: [] }); await page.waitForTimeout(2000);

const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
/** One sample: SETTLE s after the switch, then SECONDS of frames. */
async function sample(state) {
  const drift = await pin();
  if (drift > 0.05) console.log(`  you had moved ${drift.toFixed(2)} u: put back`);
  await set(state);
  await page.waitForTimeout(SETTLE * 1000);
  const m0 = await metrics();
  const s = await page.evaluate(sec => new Promise(r => {
    window.__perf.begin();
    const t = []; let last = performance.now(); const t0 = last;
    const tick = now => { t.push(now - last); last = now; if (now - t0 < sec * 1000) requestAnimationFrame(tick); else r({ t: t.slice(1), perf: window.__perf.end() }); };
    requestAnimationFrame(tick);
  }), SECONDS);
  const m1 = await metrics();
  const extra = await page.evaluate(home => {
    const r = window.__net.remotes();
    return { scene: window.__perf.scene(), heapMB: (performance.memory?.usedJSHeapSize ?? 0) / 1048576,
      remotes: r.length, full: r.filter(x => x.tier === "full").length, reduced: r.filter(x => x.tier === "reduced").length,
      auras: r.filter(x => x.aura).length, plates: r.filter(x => x.plate).length,
      moved: Math.hypot(window.__move.sim.current.state.x - home.x, window.__move.sim.current.state.z - home.z) };
  }, home);
  const ft = [...s.t].sort((a, b) => a - b), frames = ft.length, per = k => ((m1[k] - m0[k]) * 1000) / frames;
  return { frames, fps: frames / (s.t.reduce((a, b) => a + b, 0) / 1000), frameMs: ft[Math.floor(frames / 2)], p95Ms: ft[Math.floor(frames * 0.95)],
    taskMs: per("TaskDuration"), scriptMs: per("ScriptDuration"), layoutMs: per("LayoutDuration"), styleMs: per("RecalcStyleDuration"),
    cpuMs: s.perf.cpu.median, renderMs: s.perf.render.median, calls: s.perf.calls.median, triangles: s.perf.triangles.median,
    mixers: s.perf.mixers.median, skeletons: s.perf.skeletons.median, gpu: s.perf.gpu, ...extra };
}
const stateOf = effect => effect === "natural" ? { off: [], force: [] }
  : effect === "stacked" ? { off: [], force: KEYS.filter(k => !NATURAL_ONLY.has(k) && k !== "held" && k !== "rod" && k !== "fishing" && k !== "auraFamily") }
  : { off: KEYS.filter(k => k !== effect), force: NATURAL_ONLY.has(effect) ? [] : [effect] };
const BASE = { off: "all", force: [] };

/** CPU (%) of the busiest app outside the bench right now (a game in the foreground slows the bench's window). */
function foreground() {
  try {
    const rows = execFileSync("ps", ["-A", "-o", "%cpu=,comm="]).toString().trim().split("\n").map(l => { const m = /^\s*([\d.]+)\s+(.*)$/.exec(l); return m ? [Number(m[1]), m[2]] : [0, ""]; });
    const other = rows.filter(([, c]) => !/Chrome for Testing|WindowServer|node|claude|kernel_task/.test(c)).sort((a, b) => b[0] - a[0])[0];
    return { cpu: other?.[0] ?? 0, app: (other?.[1] ?? "").split("/").pop() };
  } catch { return { cpu: 0, app: "" }; }
}

// Each effect sample is bracketed by base samples (the one before it and the one after, shared with the next effect),
// so drift in the machine cancels; a pair counts only when its two bases agree within 20% and sit within 1.5× of the
// quietest base so far (a foreground game or a build can triple the frame for a while). Effects short of REPS valid
// pairs are retried, up to twice as many attempts in all.
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let before = await sample(BASE), quiet = before.frameMs;
const valid = new Map(EFFECTS.map(e => [e, 0])), tries = new Map(EFFECTS.map(e => [e, 0]));
async function measure(effect, rep) {
  const on = await sample(stateOf(effect));
  if (SHOTS && rep === 1 && tries.get(effect) === 0) await page.screenshot({ path: `${SHOTS}/${TIER_NAME}-n${N}-${effect}.png` });
  const after = await sample(BASE), fg = foreground();
  quiet = Math.min(quiet, before.frameMs, after.frameMs);
  const ok = Math.abs(after.frameMs - before.frameMs) <= 0.2 * Math.min(after.frameMs, before.frameMs) && Math.max(before.frameMs, after.frameMs) <= 1.5 * quiet;
  tries.set(effect, tries.get(effect) + 1);
  if (ok) valid.set(effect, valid.get(effect) + 1);
  const row = { effect, n: N, tier: TIER_NAME, uncapped: UNCAPPED, rep, valid: ok, base: before, on, after, load: loadavg()[0], foreground: fg, at: new Date().toISOString() };
  appendFileSync(OUT, JSON.stringify(row) + "\n");
  const b = k => (before[k] + after[k]) / 2, d = k => (on[k] - b(k)).toFixed(k === "calls" || k === "triangles" ? 0 : 2);
  console.log(`${effect.padEnd(12)} n=${N} rep ${rep}${ok ? "" : " (rejected)"}: frame ${b("frameMs").toFixed(2)}→${on.frameMs.toFixed(2)} ms (${d("frameMs")}), task ${d("taskMs")} ms, cpu ${d("cpuMs")} ms, calls ${d("calls")}, tris ${d("triangles")}, `
    + `geo ${on.scene.geometries - before.scene.geometries}, gpu ${on.gpu.available ? (on.gpu.median - (before.gpu.median + after.gpu.median) / 2).toFixed(2) : "n/a"} | full ${on.full} reduced ${on.reduced} auras ${on.auras} plates ${on.plates} | load ${row.load.toFixed(1)}, ${fg.app} ${fg.cpu}%`);
  before = after;
}
for (let rep = 1; rep <= REPS; rep++) for (const effect of EFFECTS) await measure(effect, rep);
for (let round = 0; round < REPS; round++) for (const effect of EFFECTS) {
  if (valid.get(effect) >= REPS || tries.get(effect) >= 2 * REPS) continue;
  await measure(effect, REPS + 1 + round);
}
console.log(`valid pairs: ${EFFECTS.map(e => `${e} ${valid.get(e)}/${tries.get(e)}`).join(", ")}`);
await browser.close();
