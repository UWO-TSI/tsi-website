// Look development captures (specs/look-development.md §1-2). Headed Chromium (WebGL; headless has none here),
// 1280x720 canvas at DPR 1, smooth mode (pixel filter off), summer, dev server on :$PORT (default 4600; no .env, signed out).
// Uncapped frame rate (--disable-gpu-vsync --disable-frame-rate-limit) so FPS reflects cost, not the display.
//   node specs/evidence/look/shots.mjs baseline /tmp/look/baseline
//   node specs/evidence/look/shots.mjs presets  /tmp/look/presets
//   PORT=4700 node specs/evidence/look/shots.mjs baseline /tmp/look/after   (§5 after: the same cameras on the applied look)
//   node specs/evidence/look/shots.mjs quick-game /tmp/look/tune             (tuning loop: V1 per phase + rain, High)
// Writes PNGs + metrics.json into the out dir; measure.py reads them, then cwebp to specs/evidence/look/*/.
//
// Fixed cameras (the only ones used):
//   V1 plaza    follow camera, player at (0,-1): clubhouse, plaza, boards, trees, path
//   V2 overview the village overview camera (focus 0,0,0; offset 12,21,-27)
//   V3 shore    follow camera, player at (6,-16): beach, wharf, sea
//   HQ / cafe / ruins: each scene's own default camera
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [mode, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const BASE = `http://localhost:${process.env.PORT ?? 4600}/lab/look`;
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob",
  top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} };
const metrics = {};

const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
let tier = "high";
await ctx.addInitScript(look => {
  try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {}
}, JSON.stringify(LOOK));
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = "html.shot [data-look-panel], html.shot main > :not(:has(canvas)), html.shot nav, html.shot nextjs-portal { visibility: hidden !important; }";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
});

// Init scripts run in registration order, so the latest tier wins on the next load.
const setTier = async t => { tier = t; await ctx.addInitScript(l => { try { localStorage.setItem("tsi.liteMode.v1", l); } catch {} }, String(t === "light")); };
async function open(query) {
  await page.goto(`${BASE}?${query}&season=summer`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 180000 });
  // Assets stream in waves: wait for the loading status to stay gone, then for compiles, the rig's material patch and the shadow bake.
  for (let quiet = 0; quiet < 3;) {
    await page.waitForTimeout(1000);
    quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing") && !!window.__metrics?.()) ? quiet + 1 : 0;
  }
  await page.waitForTimeout(7000);
}
const time = async phase => { await page.locator("select").filter({ has: page.locator('option[value="dawn"]') }).selectOption(phase); await page.waitForTimeout(2500); };
const view = async name => { await page.getByRole("button", { name, exact: true }).click(); await page.waitForTimeout(3500); };
async function shot(name) {
  await page.evaluate(() => document.documentElement.classList.add("shot"));
  await page.waitForTimeout(400);
  const box = await page.locator("canvas").first().boundingBox();
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: box });
  await page.evaluate(() => document.documentElement.classList.remove("shot"));
  console.log("shot", name);
}
/** Median of three one-second readings for the active slot. */
async function fps(label) {
  const reads = [];
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(1300); reads.push(await page.evaluate(() => window.__metrics())); }
  const m = [...reads].sort((a, b) => a.fps - b.fps)[1];
  metrics[label] = { ...m, tier };
  console.log("fps", label, m.fps, m.calls);
}
const setLook = (preset) => page.evaluate(p => { window.__look(p); window.__ab("B"); }, preset);
const presetJson = id => page.evaluate(id => window.__presets?.[id], id);

if (mode === "baseline") {
  for (const t of ["high", "light"]) {
    await setTier(t);
    const T = t === "high" ? "H" : "L";
    await open("ab=A&at=0,-1&weather=clear&time=day");
    if (t === "high") metrics.materials = await page.evaluate(() => window.__materials());
    for (const phase of ["day", "evening", "dawn", "night"]) {
      await time(phase);
      await shot(`${T}-V1-${phase}`);
      if (phase === "day") await fps(`${T}-A-V1-day`);
      if (t === "high" || phase === "day") { await view("Overview"); await shot(`${T}-V2-${phase}`); await view("Walk"); }
    }
    if (t === "high") {
      // Lit:shadow pairs: the same frame with the key light's shadow at opacity 0 (Current otherwise).
      const noShadow = await page.evaluate(() => { const p = structuredClone(window.__presets.current); p.shadows.intensity = 0; return p; });
      await time("day");
      await shot(`H-V1-day-pairA`); await setLook(noShadow); await page.waitForTimeout(600); await shot(`H-V1-day-noshadow`); await page.evaluate(() => window.__ab("A"));
      await view("Overview");
      await shot(`H-V2-day-pairA`); await setLook(noShadow); await page.waitForTimeout(600); await shot(`H-V2-day-noshadow`); await page.evaluate(() => window.__ab("A"));
      await view("Walk");
      await open("ab=A&at=6,-16&weather=clear&time=day");
      await shot(`H-V3-day`); await setLook(noShadow); await page.waitForTimeout(600); await shot(`H-V3-day-noshadow`);
    }
    await open("ab=A&at=0,-1&weather=rain&time=day");
    await shot(`${T}-V1-overcast`);
    if (t === "high") { await view("Overview"); await shot(`${T}-V2-overcast`); }
    for (const [q, name] of [["hq=inside", "hq"], ["cafe=inside", "cafe"], ["ruins=1", "ruins"]]) {
      await open(`ab=A&${q}&weather=clear&time=day`);
      await shot(`${T}-${name}-day`);
    }
  }
}

if (mode === "quick-game") { // the game look (slot A): V1 at each phase, the day no-shadow pair, rain; High only
  await setTier("high");
  await open("ab=A&at=0,-1&weather=clear&time=day");
  for (const phase of ["day", "evening", "dawn", "night"]) { await time(phase); await shot(`H-V1-${phase}`); }
  await time("day");
  await fps("H-A-V1-day");
  const noShadow = await page.evaluate(() => { const p = structuredClone(window.__presets.current); p.shadows.intensity = 0; return p; });
  await shot("H-V1-day-pairA"); await setLook(noShadow); await page.waitForTimeout(600); await shot("H-V1-day-noshadow"); await page.evaluate(() => window.__ab("A"));
  await open("ab=A&at=0,-1&weather=rain&time=day");
  await shot("H-V1-overcast");
}

if (mode === "quick") { // tuning loop: V1 + its no-shadow pair for each direction, High only
  await open("ab=A&at=0,-1&weather=clear&time=day");
  for (const id of ["toy", "open-air", "painterly"]) {
    const preset = await presetJson(id);
    await setLook(preset); await page.waitForTimeout(5000); await shot(`H-${id}-V1`);
    const flat = structuredClone(preset); flat.shadows.intensity = 0;
    await setLook(flat); await page.waitForTimeout(600); await shot(`H-${id}-V1-noshadow`);
  }
}

if (mode === "cost") { // one expensive effect at a time on top of Current, High, V1
  await open("ab=A&at=0,-1&weather=clear&time=day");
  const current = await presetJson("current"), toy = await presetJson("toy");
  const variants = {
    "current": current,
    "ao": { ...current, ao: { ...toy.ao } },
    "bloom": { ...current, post: { ...current.post, bloom: { ...toy.post.bloom } } },
    "tilt-shift": { ...current, post: { ...current.post, tiltShift: { ...toy.post.tiltShift } } },
    "rim-light": { ...current, light: { ...current.light, rimIntensity: 0.35 } },
  };
  for (const [name, preset] of Object.entries(variants)) { await setLook(preset); await page.waitForTimeout(4000); await fps(`H-cost-${name}`); }
}

if (mode === "presets") {
  for (const t of ["high", "light"]) {
    await setTier(t);
    const T = t === "high" ? "H" : "L";
    await open("ab=A&at=0,-1&weather=clear&time=day");
    await fps(`${T}-A-V1-day`);
    for (const id of ["current", "toy", "open-air", "painterly"]) {
      const preset = await presetJson(id);
      await setLook(preset);
      await page.waitForTimeout(5000); // AO/DOF/bloom passes, rim-light recompiles
      await shot(`${T}-${id}-V1`);
      await fps(`${T}-${id}-V1`);
      if (t === "high") {
        const flat = structuredClone(preset); flat.shadows.intensity = 0;
        await setLook(flat); await page.waitForTimeout(600); await shot(`${T}-${id}-V1-noshadow`); await setLook(preset);
        await view("Overview"); await shot(`${T}-${id}-V2`); await view("Walk");
      }
    }
    if (t === "high") {
      await open("ab=A&at=6,-16&weather=clear&time=day");
      for (const id of ["current", "toy", "open-air", "painterly"]) { await setLook(await presetJson(id)); await page.waitForTimeout(5000); await shot(`H-${id}-V3`); }
    }
  }
}

writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
await browser.close();
