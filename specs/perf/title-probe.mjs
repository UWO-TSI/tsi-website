// Title probe (specs/lanes/title-perf.md). Headless, muted, 1280 x 800 (W, H). Against next dev on PORT.
//   PORT=3157 PHASES="day night" OUT=<dir> node specs/perf/title-probe.mjs perf <label>   frame times, point lights, draws, models (TPS="- a b" adds ?tp=a ... per run)
//   PORT=3157 PHASES="day night" OUT=<dir> node specs/perf/title-probe.mjs still <label>     deterministic stills at t = 0, 14, 28 s of the dolly
//   Stills: the Playwright clock paused, the R3F clock set to the dolly time, Math.random seeded; two runs of one build
//   differ by at most 1/255 in a few hundred pixels.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [MODE, LABEL = "run"] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3157, PHASES = (process.env.PHASES ?? "day night").split(" ");
let TP = "";
const TPS = (process.env.TPS ?? "-").split(" ");
const OUT = process.env.OUT ?? ".";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });

const hook = () => {
  const t = window.__THREE_DEVTOOLS__ = new EventTarget();
  const tp = window.__tp = { renderers: [], scenes: [] };
  t.addEventListener("observe", e => { const o = e.detail; if (o?.isWebGLRenderer) tp.renderers.push(o); else if (o?.isScene) tp.scenes.push(o); });
  // Seeded random: the same sequence every run.
  let s = 1234567;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
};
const mainScene = () => window.__tp.scenes.reduce((a, b) => (b.children.length > (a?.children.length ?? -1) ? b : a), null);

async function open(phase, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 800) }, deviceScaleFactor: 1, ...ctxOpts });
  await ctx.addInitScript(hook);
  const page = await ctx.newPage();
  return { ctx, page, url: `http://localhost:${PORT}/student?time=${phase}&weather=clear&season=summer${TP ? `&${TP}` : ""}` };
}

const stats = () => {
  const scene = window.__tp.scenes.reduce((a, b) => (b.children.length > (a?.children.length ?? -1) ? b : a), null);
  const gl = window.__tp.renderers[0];
  let meshes = 0, inst = 0, instN = 0, points = 0, pointsOn = 0, tris = 0;
  scene.traverse(o => {
    if (o.isPointLight) { points++; if (o.visible) pointsOn++; }
    if (o.isMesh) { meshes++; if (o.isInstancedMesh) { inst++; instN += o.count; } }
  });
  const res = performance.getEntriesByType("resource");
  const models = res.filter(r => /\.(glb|gltf|bin)(\?|$)/.test(r.name));
  const tex = res.filter(r => /\.(png|jpe?g|webp|ktx2)(\?|$)/.test(r.name) && r.initiatorType !== "link");
  return { meshes, inst, instN, points, pointsOn, programs: gl.info.programs.length, calls: gl.info.render.calls, tris: gl.info.render.triangles,
    modelsFetch: models.filter(r => r.initiatorType !== "link").length, modelsLink: models.filter(r => r.initiatorType === "link").length,
    modelMB: +(models.filter(r => r.initiatorType !== "link").reduce((a, r) => a + r.encodedBodySize, 0) / 1e6).toFixed(1), tex: tex.length,
    texMB: +(tex.reduce((a, r) => a + r.encodedBodySize, 0) / 1e6).toFixed(1) };
};

if (MODE === "perf") {
  const rows = [];
  for (const tp of TPS) for (const phase of PHASES) {
    TP = tp === "-" ? "" : `tp=${tp}`;
    const { ctx, page, url } = await open(phase);
    await page.goto(url);
    await page.waitForSelector("main[data-ready]", { timeout: 240000 });
    await page.waitForTimeout(Number(process.env.SETTLE ?? 5000));
    const frames = await page.evaluate(() => new Promise(done => {
      const f = []; let last = performance.now(); const end = last + 6000;
      const step = t => { f.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else done(f); };
      requestAnimationFrame(step);
    }));
    frames.sort((a, b) => a - b);
    const s = await page.evaluate(stats);
    Object.assign(s, await page.evaluate(() => new Promise(done => {
      const gl = window.__tp.renderers[0]; gl.info.autoReset = false;
      requestAnimationFrame(() => { gl.info.reset(); requestAnimationFrame(() => { const r = { calls: gl.info.render.calls, tris: gl.info.render.triangles }; gl.info.autoReset = true; done(r); }); });
    })));
    const row = { tp, phase, n: frames.length, median: +frames[frames.length >> 1].toFixed(1), p95: +frames[Math.floor(frames.length * 0.95)].toFixed(1), over50: frames.filter(x => x > 50).length, ...s };
    rows.push(row); console.log(JSON.stringify(row));
    await ctx.close();
  }
  writeFileSync(`${OUT}/perf-${LABEL}.json`, JSON.stringify(rows, null, 1));
} else if (MODE === "still") {
  for (const phase of PHASES) {
    const { ctx, page, url } = await open(phase);
    await page.clock.install({ time: new Date("2026-07-15T12:00:00") });
    await page.goto(url);
    await page.waitForSelector("main[data-ready]", { timeout: 240000 });
    await page.addStyleTag({ content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
    await page.clock.pauseAt(new Date("2026-07-15T12:10:00"));
    for (const t of [0, 14, 28]) {
      // The R3F clock to the dolly time, then a second of fixed frames (the eases settle the same way every run).
      await page.evaluate(t => {
        const scene = window.__tp.scenes.reduce((a, b) => (b.children.length > (a?.children.length ?? -1) ? b : a), null);
        const clock = scene.__r3f.root.getState().clock;
        clock.elapsedTime = t - 1; clock.oldTime = performance.now(); clock.startTime = clock.oldTime - (t - 1) * 1000;
      }, t);
      await page.clock.runFor(1000);
      const path = `${OUT}/${LABEL}-${phase}-t${t}.png`;
      await page.screenshot({ path });
      console.log(path);
    }
    await ctx.close();
  }
}
await browser.close();
