// Creator evidence (specs/evidence/creator-ui/): every category at 1440x900 and phone size, slider extremes, and the
// creator's frame rate and memory, on the member island's first-login creator (/student/dashboard, signed out, no saved look).
//   PORT=3159 node specs/evidence/creator-ui/capture.mjs <before|after> [perf|shots|extremes|world|all]
// Headless Chromium on the real GPU (ANGLE on Metal), muted, never brought to the front.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const OUT = dirname(fileURLToPath(import.meta.url));
const [STAGE = "after", WHAT = "all"] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3159, BASE = `http://localhost:${PORT}`;
const URL = `${BASE}/student/dashboard?time=day&weather=clear&season=summer`;
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--enable-gpu"] });
const VIEWPORTS = { desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }, phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const results = {};

async function open(vp, look = null) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await ctx.addInitScript(l => { try { if (l) localStorage.setItem("tsi.look.v1", l); else localStorage.removeItem("tsi.look.v1"); localStorage.setItem("tsi.hud.full.v1", "true"); } catch {} }, look);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 240000 });
  return { ctx, page };
}
async function creator(page) {
  await page.waitForSelector('[role="dialog"][aria-labelledby="creator-title"]', { timeout: 240000 });
  await page.waitForTimeout(6000); // models, atlas and shaders
}
const tabs = page => page.locator('[aria-label="Categories"] [role="tab"]');
async function slug(tab) { return (await tab.getAttribute("aria-label") ?? await tab.textContent()).toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""); }

async function shots() {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const { ctx, page } = await open(vp);
    await creator(page);
    const n = await tabs(page).count();
    for (let i = 0; i < n; i++) {
      const tab = tabs(page).nth(i);
      await tab.click();
      await page.waitForTimeout(STAGE === "after" ? 2600 : 1800); // the camera's move and any thumbnails
      const file = `${STAGE}-${name}-${String(i + 1).padStart(2, "0")}-${await slug(tab)}.png`;
      await page.screenshot({ path: join(OUT, file) });
      console.log(file);
    }
    await ctx.close();
  }
}

async function extremes() {
  const { ctx, page } = await open(VIEWPORTS.desktop);
  await creator(page);
  for (const part of ["Eyes", "Brows", "Mouth"]) {
    await page.locator(`[aria-label="Categories"] [role="tab"][aria-label="${part}"]`).click();
    await page.waitForTimeout(1500);
    const sliders = page.locator(`[aria-label="${part} placement"] input[type="range"]`);
    const n = await sliders.count();
    const set = async (i, key) => { await sliders.nth(i).focus(); await page.keyboard.press(key); };
    const reset = async () => { for (let i = 0; i < n; i++) { await sliders.nth(i).fill("0"); } };
    const labels = await page.locator(`[aria-label="${part} placement"] label`).allTextContents();
    for (let i = 0; i < n; i++) for (const [key, end] of [["End", "max"], ["Home", "min"]]) {
      await reset(); await set(i, key); await page.waitForTimeout(500);
      const file = `extreme-${part.toLowerCase()}-${labels[i].toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}-${end}.png`;
      await page.screenshot({ path: join(OUT, file), clip: { x: 0, y: 0, width: 1440, height: 900 } });
      console.log(file);
    }
    for (const [key, end] of [["End", "max"], ["Home", "min"]]) {
      for (let i = 0; i < n; i++) await set(i, key);
      await page.waitForTimeout(500);
      const file = `extreme-${part.toLowerCase()}-all-${end}.png`;
      await page.screenshot({ path: join(OUT, file) });
      console.log(file);
    }
    await reset();
  }
  await ctx.close();
}

/** Frame rate (rAF), the creator canvas's draws and GPU objects, the JS heap, and whether the island draws under it. */
async function perf() {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const { ctx, page } = await open(vp);
    await creator(page);
    const row = {};
    for (const cat of ["Eyes", "Hair", "Tops"]) {
      const tab = page.locator(`[aria-label="Categories"] [role="tab"][aria-label="${cat}"], [aria-label="Categories"] [role="tab"]:text-is("${cat}")`).first();
      if (await tab.count()) await tab.click();
      await page.waitForTimeout(4000); // past the camera's move and the hair thumbnails
      row[cat] = await page.evaluate(async () => {
        const gl = window.__creatorGl;
        const world = window.__perf; world?.begin?.();
        const times = []; let last = performance.now();
        await new Promise(done => { const t0 = last; const f = now => { times.push(now - last); last = now; now - t0 < 5000 ? requestAnimationFrame(f) : done(); }; requestAnimationFrame(f); });
        const worldFrames = world?.end ? (world.end(), world.summary().frames) : null;
        times.sort((a, b) => a - b);
        const q = p => times[Math.min(times.length - 1, Math.floor(p * times.length))];
        return {
          fps: +(1000 / q(0.5)).toFixed(1), p95ms: +q(0.95).toFixed(1), worstMs: +times.at(-1).toFixed(1),
          creatorCalls: gl?.info.render.calls ?? null, creatorTriangles: gl?.info.render.triangles ?? null, geometries: gl?.info.memory.geometries ?? null, textures: gl?.info.memory.textures ?? null,
          programs: gl?.info.programs?.length ?? null, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
          worldFramesWhileOpen: worldFrames,
        };
      });
    }
    results[`${STAGE}-${name}`] = row;
    console.log(name, JSON.stringify(row));
    await ctx.close();
  }
}

/** In the world, the player with and without placement: draws, triangles and frame time must match. */
async function world() {
  const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} };
  const out = {};
  for (const [label, look] of [["plain", LOOK], ["placed", { ...LOOK, place: { eyes: [10, 10, 10, 10], brows: [-10, 10, -10, 10], mouth: [10, 0, 10, 10] } }], ["plain-again", LOOK]]) {
    const { ctx, page } = await open(VIEWPORTS.desktop, JSON.stringify(look));
    await page.waitForFunction(() => !!window.__perf && !!window.__move?.sim?.current, null, { timeout: 240000 });
    await page.waitForTimeout(9000);
    out[label] = await page.evaluate(async () => {
      window.__perf.begin();
      await new Promise(r => setTimeout(r, 6000));
      window.__perf.end();
      const s = window.__perf.summary();
      return { frames: s.frames, calls: s.calls.median, triangles: s.triangles.median, cpuMs: +s.cpu.median.toFixed(2), renderMs: +s.render.median.toFixed(2) };
    });
    console.log(label, JSON.stringify(out[label]));
    await ctx.close();
  }
  results[`${STAGE}-world`] = out;
}

if (WHAT === "shots" || WHAT === "all") await shots();
if (STAGE === "after" && (WHAT === "extremes" || WHAT === "all")) await extremes();
if (WHAT === "perf" || WHAT === "all") await perf();
if (WHAT === "world") await world();
mkdirSync(OUT, { recursive: true });
if (Object.keys(results).length) writeFileSync(join(OUT, `perf-${STAGE}-${WHAT}.json`), JSON.stringify(results, null, 2));
await browser.close();
