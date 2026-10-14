// Where a scene's draw calls go (specs/perf/2026-10-v1-results.md): every renderBufferDirect over 30 frames, tallied by
// pass (render target or shadow), object, material and parents, per frame.
//   PORT=3158 TIER=high|lite node specs/perf/draw-breakdown.mjs "fixture=v2&bots=24" <out.json>
// Run on the measurement build under the devserver lock. It finds the renderer through R3F's instance tag.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [Q = "fixture=v2&bots=24", OUT = "/dev/stdout"] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3158, TIER_NAME = process.env.TIER ?? "high";
const TIER = { high: { "tsi.liteMode.v1": "false", "tsi.shadows.v1": "true" }, lite: { "tsi.liteMode.v1": "true", "tsi.shadows.v1": "false" } }[TIER_NAME];
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([look, store]) => { try {
  localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.hud.full.v1", "true");
  localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
} catch {}
  Object.defineProperty(Object.prototype, "__r3f", { configurable: true, set(v) { Object.defineProperty(this, "__r3f", { value: v, writable: true, configurable: true, enumerable: false }); if (!window.__r3fFirst && v && v.root) window.__r3fFirst = this; } });
}, [LOOK, TIER]);
const page = await ctx.newPage();
page.on("pageerror", e => console.error("pageerror", e.message.slice(0, 200)));
await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&${Q}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas", { timeout: 240000 });
for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = (await page.evaluate(() => !!window.__perf && !!window.__move?.sim?.current && (!location.search.includes("bots") || (window.__net?.remotes().length ?? 0) > 0))) ? quiet + 1 : 0; }
await page.waitForTimeout(5000);
const result = await page.evaluate(async () => {
  const st = window.__r3fFirst.__r3f.root.getState(), gl = st.gl;
  const tally = new Map(); let frames = 0, on = false;
  const orig = gl.renderBufferDirect;
  const target = () => { const t = gl.getRenderTarget(); return t ? (t.isWebGLCubeRenderTarget ? "cube" : `rt${t.width}x${t.height}`) : "screen"; };
  gl.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (on) {
      const chain = []; for (let p = object.parent, i = 0; p && i < 3; p = p.parent, i++) chain.push(p.name || p.type);
      const pass = material.isMeshDepthMaterial || material.isMeshDistanceMaterial ? "shadow" : camera.isOrthographicCamera && !material.isShaderMaterial ? "ortho" : target();
      const key = [pass, object.type, object.name || "-", material.name || material.type, chain.join("<")].join(" | ");
      const e = tally.get(key) ?? { n: 0, tris: 0, inst: 0 }; e.n++; e.inst += object.isInstancedMesh ? object.count : 1;
      tally.set(key, e);
    }
    return orig.apply(this, arguments);
  };
  await new Promise(r => requestAnimationFrame(r));
  on = true;
  const N = 30;
  await new Promise(r => { const tick = () => { frames++; if (frames < N) requestAnimationFrame(tick); else r(); }; requestAnimationFrame(tick); });
  on = false; gl.renderBufferDirect = orig;
  const rows = [...tally].map(([k, v]) => [k, +(v.n / N).toFixed(1), Math.round(v.inst / v.n)]).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, r) => s + r[1], 0);
  const byPass = {}; for (const [k, n] of rows) { const p = k.split(" | ")[0]; byPass[p] = +((byPass[p] ?? 0) + n).toFixed(1); }
  return { total: +total.toFixed(1), byPass, rows, scene: window.__perf.scene(), info: gl.info.render };
});
writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log("total", result.total, JSON.stringify(result.byPass));
await browser.close();
