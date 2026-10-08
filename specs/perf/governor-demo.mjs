// Adaptive quality under load (specs/perf/2026-10-results.md): the village with 24 bots, the CPU slowed RATE x through
// the DevTools protocol for 25 s, then released for 45 s; each second the frame rate and the governor's level.
//   PORT=3149 RATE=6 node specs/perf/governor-demo.mjs
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const PORT = process.env.PORT ?? 3149, RATE = Number(process.env.RATE ?? 6);
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {} });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&bots=24`);
await page.waitForFunction(() => !!window.__governor && (window.__net?.remotes().length ?? 0) > 0, null, { timeout: 240000 });
await page.waitForTimeout(6000);
await page.evaluate(() => { window.__fps = 0; const tick = () => { window.__fps++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
const cdp = await ctx.newCDPSession(page);
const rows = [];
for (let s = 0; s < 70; s++) {
  if (s === 0) await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  if (s === 25) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => { const f = window.__fps; window.__fps = 0; return { fps: f, level: window.__governor.level, dpr: window.devicePixelRatio, knobs: window.__governor.knobs }; });
  rows.push(r);
  console.log(`${String(s + 1).padStart(2)} s  ${s < 25 ? `CPU /${RATE}` : "CPU x1"}  ${String(r.fps).padStart(3)} FPS  level ${r.level}  ${JSON.stringify(r.knobs)}`);
}
await browser.close();
