// The world bench (specs/perf/effects-cost.md "World costs"): what the cinematic pass's sky dome and the blade field
// (v1 land pass) cost a frame, in the village and the terrain v2 world, and the title screen's frame.
//   PORT=3158 node specs/perf/world-bench.mjs <out.jsonl> [scenes]
//   scenes: comma list of village, v2, title (default all). Env: TIER=high|lite (the dome is High's only), REPS (4),
//   SECONDS (4), SETTLE (1.5), PIXEL=0 (the pixel finish off: the canvas at full resolution) and W, H (the window,
//   default 1280 × 800): with both, the GPU's share of the frame grows, as on a weaker GPU.
// Each scene opens once (24 bots as in perf-bench.mjs, everything as shipped). Each variant is measured between two
// shipped samples, as fx-bench.mjs does (pairs whose shipped samples disagree are rejected and retried):
//   domeOff   the sky dome off: the flat gradient Light draws (lib/game/perf/fxBench.ts `skyDome`);
//   grassHalf the blade field at half its clumps (GrassField, tuning grass.density 0.5; shipped 1);
//   grass0    no blades at all;
//   rocksOff  the cliff-foot boulders off (lib/game/perf/fxBench.ts `cliffBoulders`; the v1 land pass).
// v1 water (VARIANTS=water): each piece of the water pass off against the water as shipped:
//   seabedOff the seabed's props; foamOff the foam rings; glassOff glass water (High's refraction wobble); fishOff the
//   decorative fish (lib/game/perf/fxBench.ts WORLD_KEYS).
// The title has no probe and no switches: its frame and main-thread time are sampled alone (`title`).
// Headed, off to the side, muted, never brought to the front; the real GPU; uncapped.
import { createRequire } from "node:module";
import { appendFileSync } from "node:fs";
import { loadavg } from "node:os";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "/tmp/world-bench.jsonl", ONLY = "village,v2,title"] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3158, REPS = Number(process.env.REPS ?? 4), SECONDS = Number(process.env.SECONDS ?? 4), SETTLE = Number(process.env.SETTLE ?? 1.5);
const TIER_NAME = process.env.TIER ?? "high", W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 800);
const TIER = { high: { "tsi.liteMode.v1": "false", "tsi.shadows.v1": "true" }, lite: { "tsi.liteMode.v1": "true", "tsi.shadows.v1": "false" } }[TIER_NAME];
if (process.env.PIXEL === "0") TIER["tsi.pixelated.v1"] = "false";
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const BASE = "time=day&weather=clear&season=summer";
const URLS = { village: `/lab/island?${BASE}&bots=24`, v2: `/lab/island?${BASE}&fixture=v2&bots=24`, title: "/student?time=day" };
const ALL_VARIANTS = {
  domeOff: { off: ["skyDome"], tune: null },
  grassHalf: { off: [], tune: ["grass", "density", 0.5] },
  grass0: { off: [], tune: ["grass", "density", 0] },
  rocksOff: { off: ["cliffBoulders"], tune: null },
  seabedOff: { off: ["seabed"], tune: null },
  foamOff: { off: ["foamRings"], tune: null },
  glassOff: { off: ["glassWater"], tune: null },
  fishOff: { off: ["fish"], tune: null },
};
const SETS = { world: ["domeOff", "grassHalf", "grass0", "rocksOff"], water: ["seabedOff", "foamOff", "glassOff", "fishOff"] };
const VARIANTS = Object.fromEntries((SETS[process.env.VARIANTS ?? "world"] ?? (process.env.VARIANTS ?? "").split(",")).map(k => [k, ALL_VARIANTS[k]]));
const SHIPPED = { off: [], tune: null };

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
for (const scene of ONLY.split(",")) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, store]) => { try {
    localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.hud.full.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  } catch {} }, [LOOK, TIER]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
  await page.goto(`http://localhost:${PORT}${URLS[scene]}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  const probe = scene !== "title";
  for (let quiet = 0; quiet < 3;) {
    await page.waitForTimeout(1000);
    quiet = (await page.evaluate(p => !p || (!!window.__perf && !!window.__fx && !!window.__move?.sim?.current && (window.__net?.remotes().length ?? 0) > 0), probe)) ? quiet + 1 : 0;
  }
  await page.waitForTimeout(5000);
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
  const apply = v => page.evaluate(v => { window.__fx.set({ off: v.off }); if (v.tune) window.__fx.tune(...v.tune); else window.__fx.tune(); }, v);
  async function sample(v) {
    if (probe) { await apply(v); await page.waitForTimeout(SETTLE * 1000); }
    const m0 = await metrics();
    const s = await page.evaluate(([sec, p]) => new Promise(r => {
      if (p) window.__perf.begin();
      const t = []; let last = performance.now(); const t0 = last;
      const tick = now => { t.push(now - last); last = now; if (now - t0 < sec * 1000) requestAnimationFrame(tick); else r({ t: t.slice(1), perf: p ? window.__perf.end() : null }); };
      requestAnimationFrame(tick);
    }), [SECONDS, probe]);
    const m1 = await metrics(), ft = [...s.t].sort((a, b) => a - b), frames = ft.length, per = k => ((m1[k] - m0[k]) * 1000) / frames;
    const extra = probe ? await page.evaluate(() => ({ scene: window.__perf.scene(), remotes: window.__net.remotes().length })) : {};
    return { frames, frameMs: ft[Math.floor(frames / 2)], p95Ms: ft[Math.floor(frames * 0.95)], taskMs: per("TaskDuration"), scriptMs: per("ScriptDuration"),
      cpuMs: s.perf?.cpu.median ?? null, calls: s.perf?.calls.median ?? null, triangles: s.perf?.triangles.median ?? null, gpu: s.perf?.gpu ?? null, ...extra };
  }
  if (!probe) {
    for (let rep = 1; rep <= REPS; rep++) {
      const s = await sample(null);
      appendFileSync(OUT, JSON.stringify({ scene, tier: TIER_NAME, size: `${W}x${H}`, pixel: process.env.PIXEL !== "0", variant: "title", rep, valid: true, base: s, on: s, after: s, load: loadavg()[0], at: new Date().toISOString() }) + "\n");
      console.log(`title rep ${rep}: frame ${s.frameMs.toFixed(2)} ms, p95 ${s.p95Ms.toFixed(2)}, main thread ${s.taskMs.toFixed(2)} ms | load ${loadavg()[0].toFixed(1)}`);
    }
    await ctx.close();
    continue;
  }
  // Warm the variants once (the gradient's shader, the grass's rebuild), then back to as shipped.
  for (const v of Object.values(VARIANTS)) { await apply(v); await page.waitForTimeout(1500); }
  await apply(SHIPPED); await page.waitForTimeout(2000);
  let before = await sample(SHIPPED), quiet = before.frameMs;
  const valid = new Map(Object.keys(VARIANTS).map(k => [k, 0])), tries = new Map(Object.keys(VARIANTS).map(k => [k, 0]));
  async function measure(name, rep) {
    const on = await sample(VARIANTS[name]), after = await sample(SHIPPED);
    quiet = Math.min(quiet, before.frameMs, after.frameMs);
    const ok = Math.abs(after.frameMs - before.frameMs) <= 0.2 * Math.min(after.frameMs, before.frameMs) && Math.max(before.frameMs, after.frameMs) <= 1.5 * quiet;
    tries.set(name, tries.get(name) + 1);
    if (ok) valid.set(name, valid.get(name) + 1);
    appendFileSync(OUT, JSON.stringify({ scene, tier: TIER_NAME, size: `${W}x${H}`, pixel: process.env.PIXEL !== "0", variant: name, rep, valid: ok, base: before, on, after, load: loadavg()[0], at: new Date().toISOString() }) + "\n");
    const b = k => (before[k] + after[k]) / 2, d = k => (on[k] - b(k)).toFixed(k === "calls" || k === "triangles" ? 0 : 2);
    console.log(`${scene} ${name.padEnd(8)} rep ${rep}${ok ? "" : " (rejected)"}: shipped ${b("frameMs").toFixed(2)} → ${on.frameMs.toFixed(2)} ms (${d("frameMs")}), main thread ${d("taskMs")}, cpu ${d("cpuMs")}, calls ${d("calls")}, tris ${d("triangles")}, `
      + `gpu ${on.gpu?.available ? (on.gpu.median - (before.gpu.median + after.gpu.median) / 2).toFixed(2) : "n/a"} | load ${loadavg()[0].toFixed(1)}`);
    before = after;
  }
  for (let rep = 1; rep <= REPS; rep++) for (const name of Object.keys(VARIANTS)) await measure(name, rep);
  for (let round = 0; round < REPS; round++) for (const name of Object.keys(VARIANTS)) if (valid.get(name) < REPS && tries.get(name) < 2 * REPS) await measure(name, REPS + 1 + round);
  console.log(`${scene}: valid pairs ${[...valid].map(([k, v]) => `${k} ${v}/${tries.get(k)}`).join(", ")}`);
  await ctx.close();
}
await browser.close();
