// Water sparkle from real optics (row 238, specs/look-development.md §7.4). Headless Chromium on SwiftShader,
// 1280x720 canvas, summer, /lab/look on the dev server at :$PORT (default 3102). The sun is set through the lab
// preset (window.__look; lab azimuth 0 = +x, 90 = +z, the camera looks +z); the suns are Sep 27 over London, ON.
//   node specs/evidence/water-glints/shots.mjs /tmp/water-glints
// Then cwebp -q 72 each PNG into specs/evidence/water-glints/. ONLY=suns,walk,still,golden,weather,night,light picks sets.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2] ?? "/tmp/water-glints";
mkdirSync(OUT, { recursive: true });
const BASE = `http://localhost:${process.env.PORT ?? 3102}/lab/look`;
const ONLY = process.env.ONLY?.split(",");
const SUNS = { shipped: null, "11h": [-44, 36], "15h": [35, 39], "16h": [51, 32], "17h": [64, 23], "18h": [75, 12] };
const SHORE = "0,17.2"; // north beach: the sea fills the top of the frame

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob",
  top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} };
await ctx.addInitScript(look => {
  try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {}
}, JSON.stringify(LOOK));
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("503")) console.log("console", m.text().slice(0, 600)); });
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = "html.shot [data-look-panel], html.shot main > :not(:has(canvas)), html.shot nav, html.shot nextjs-portal { visibility: hidden !important; }";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
});
const setTier = t => ctx.addInitScript(l => { try { localStorage.setItem("tsi.liteMode.v1", l); } catch {} }, String(t === "light"));

async function open(query) {
  await page.goto(`${BASE}?${query}&season=summer`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  for (let quiet = 0; quiet < 3;) {
    await page.waitForTimeout(1500);
    quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing") && !!window.__metrics?.()) ? quiet + 1 : 0;
  }
  await page.waitForTimeout(8000);
}
/** Shipped look with the sun moved (null = the game as shipped, slot A). */
async function sun(key) {
  const angles = SUNS[key];
  if (!angles) return page.evaluate(() => window.__ab("A"));
  await page.evaluate(([az, el]) => {
    const p = structuredClone(window.__presets.current), a = az * Math.PI / 180, e = el * Math.PI / 180;
    p.light.sunPosition = [30 * Math.cos(e) * Math.cos(a), 30 * Math.sin(e), 30 * Math.cos(e) * Math.sin(a)];
    window.__look(p); window.__ab("B");
  }, angles);
  await page.waitForTimeout(3000);
}
async function shot(name) {
  await page.evaluate(() => document.documentElement.classList.add("shot"));
  await page.waitForTimeout(300);
  const box = await page.locator("canvas").first().boundingBox();
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: box });
  await page.evaluate(() => document.documentElement.classList.remove("shot"));
  console.log("shot", name, new Date().toISOString().slice(11, 19));
}
const want = k => !ONLY || ONLY.includes(k);

await setTier("high");
if (want("suns")) {
  await open(`at=${SHORE}&weather=clear&time=day`);
  for (const key of Object.keys(SUNS)) { await sun(key); await shot(`H-day-${key}`); }
}
if (want("walk")) {
  // Walk screen-left (+x) along the beach under the 17:00 sun: the band slides with the camera, the sparkles change.
  await open(`at=-3,17.2&weather=clear&time=day`);
  await sun("17h");
  await page.mouse.move(640, 700);
  for (let i = 0; i < 4; i++) {
    await shot(`H-walk-17h-${i}`);
    if (i < 3) { await page.keyboard.down("a"); await page.waitForTimeout(900); await page.keyboard.up("a"); await page.waitForTimeout(900); }
  }
}
if (want("still")) {
  // Standing still: the same sun and camera a second apart, only the waves move.
  await open(`at=${SHORE}&weather=clear&time=day`);
  await sun("17h");
  for (let i = 0; i < 3; i++) { await shot(`H-still-17h-${i}`); await page.waitForTimeout(1000); }
}
if (want("golden")) {
  // Golden hour: the evening phase mirrors the preset's azimuth (64 -> 116) at 22° elevation, gold light.
  await open(`at=${SHORE}&weather=clear&time=evening`);
  await sun("17h"); await shot("H-evening-golden");
}
if (want("weather")) {
  for (const w of ["wind", "rain"]) { await open(`at=${SHORE}&weather=${w}&time=day`); await sun("17h"); await shot(`H-day-17h-${w}`); }
}
if (want("night")) {
  await open(`at=${SHORE}&weather=clear&time=night`);
  await sun("shipped"); await shot("H-night-moon-shipped");
  await sun("17h"); await shot("H-night-moon-ahead"); // the model with a moon ahead (night elevation 40°)
}
if (want("light")) {
  await setTier("light");
  await open(`at=${SHORE}&weather=clear&time=day`);
  await sun("17h"); await shot("L-day-17h");
}
await browser.close();
