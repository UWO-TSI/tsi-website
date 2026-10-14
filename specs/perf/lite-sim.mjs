// The weaker laptop, simulated (specs/perf/2026-10-v1-results.md, "Lite on a slow machine"): the scene with 24 bots on
// a tier, the main thread slowed by CDP CPU throttling, the GPU's share grown by drawing more pixels (the pixel finish
// off at 1920 x 1200), adaptive quality held at the settings. Uncapped; frames, the probe's frame CPU, GPU time, draws.
//   PORT=3158 node specs/perf/lite-sim.mjs <label> <out.jsonl> [configs]
//   config: scene:tier:throttle:pixel:WxH, e.g. v2:lite:4:1:1280x800 (pixel 1 = the pixel finish on, the default)
// Run on the measurement build (measure-build.sh) under the devserver lock; headed, off to the side, muted.
import { createRequire } from "node:module";
import { appendFileSync } from "node:fs";
import { loadavg } from "node:os";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [LABEL, OUT, CONFIGS = "v2:lite:1:1:1280x800,v2:lite:4:1:1280x800,v2:lite:4:0:1920x1200,village:lite:4:1:1280x800,village:lite:4:0:1920x1200"] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3158, SECONDS = Number(process.env.SECONDS ?? 8);
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
for (const cfg of CONFIGS.split(",")) {
  const [scene, tier, throttle, pixel, size] = cfg.split(":"), [W, H] = size.split("x").map(Number);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, lite, px]) => { try {
    localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.hud.full.v1", "true");
    localStorage.setItem("tsi.liteMode.v1", String(lite)); localStorage.setItem("tsi.shadows.v1", String(!lite)); localStorage.setItem("tsi.pixelated.v1", String(px));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch {} }, [LOOK, tier === "lite", pixel === "1"]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&bots=24${scene === "v2" ? "&fixture=v2" : ""}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = (await page.evaluate(() => !!window.__perf && !!window.__move?.sim?.current && (window.__net?.remotes().length ?? 0) > 0)) ? quiet + 1 : 0; }
  await page.waitForTimeout(4000);
  // Adaptive quality off: the bench measures the settings as chosen.
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(throttle) });
  await page.waitForTimeout(2000);
  const s = await page.evaluate(sec => new Promise(r => {
    window.__perf.begin();
    const t = []; let last = performance.now(); const t0 = last;
    const tick = now => { t.push(now - last); last = now; if (now - t0 < sec * 1000) requestAnimationFrame(tick); else r({ t: t.slice(1), perf: window.__perf.end() }); };
    requestAnimationFrame(tick);
  }), SECONDS);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const a = [...s.t].sort((x, y) => x - y), q = p => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  const row = { label: LABEL, cfg, fps: +(a.length / (a.reduce((x, y) => x + y, 0) / 1000)).toFixed(1), median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), cpu: +s.perf.cpu.median.toFixed(2),
    gpu: +(s.perf.gpu?.median ?? 0).toFixed(2), draws: Math.round(s.perf.calls.median), tris: Math.round(s.perf.triangles.median), load: +loadavg()[0].toFixed(1) };
  appendFileSync(OUT, JSON.stringify(row) + "\n");
  console.log(JSON.stringify(row));
  await ctx.close();
}
await browser.close();
