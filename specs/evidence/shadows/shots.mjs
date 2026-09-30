// Shadow audit frames (look spec §9.3). Headed Chromium (WebGL needs it here), real GPU (metal).
//   node specs/evidence/shadows/shots.mjs before <outDir>   the before/ cameras
//   node specs/evidence/shadows/shots.mjs after <outDir>    the same cameras plus the §9.3 extras and FPS
//   node specs/evidence/shadows/shots.mjs fps <outDir>      FPS only (High and Light, plaza), for A/B runs
// PORT picks the dev server (default 3000, David's demo; the build agent used 3104). BIG=1 renders a 1600x1000
// canvas at 2x device pixels (1.5x after the game's dpr cap), so High is GPU-bound below the display's refresh
// rate and the Performance panel shows cost differences instead of vsync.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [mode = "before", OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const BASE = `http://localhost:${process.env.PORT ?? 3000}/lab/island`;
const args = ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"];
const view = process.env.BIG ? { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 };
const browser = await chromium.launch({ headless: false, args });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
async function session(lite) {
  const ctx = await browser.newContext(view);
  await ctx.addInitScript(([look, lite]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", lite ? "true" : "false"); } catch {} }, [LOOK, lite]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 160)));
  return page;
}
async function open(page, q) {
  await page.goto(`${BASE}?${q}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 180000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(6000);
}
async function shot(page, name) { const box = await page.locator("canvas").first().boundingBox(); await page.screenshot({ path: `${OUT}/${name}.png`, clip: box }); console.log("shot", name); }
/** The in-game Performance panel after it has settled: the median of eight one-second readings, with its draws and triangles. */
async function fps(page) {
  await page.locator("summary", { hasText: "Performance" }).click();
  await page.waitForTimeout(6000);
  const samples = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(1100); samples.push(await page.locator("details output").first().innerText()); }
  await page.locator("summary", { hasText: "Performance" }).click();
  const fpsOf = t => Number(/(\d+) FPS/.exec(t)?.[1] ?? 0);
  samples.sort((a, b) => fpsOf(a) - fpsOf(b));
  return `median ${samples[4].replace(/\n/g, " | ")} (range ${fpsOf(samples[0])}-${fpsOf(samples[7])} FPS)`;
}
const DAY = "time=day&weather=clear&season=summer";
const readings = [];

if (mode !== "fps") {
  const page = await session(false);
  for (const [name, at] of [["plaza", "0,-1"], ["shore", "6,-16"], ["west-trees", "-9,-3"], ["east-trees", "10,6"], ["north", "0,10"]]) {
    await open(page, `${DAY}&at=${at}`);
    await shot(page, name);
  }
  // Walk test: hold a key so the player moves, then shoot again (a cached shadow map would leave stale shadows).
  await open(page, `${DAY}&at=0,-1`);
  await page.locator("canvas").first().click({ position: { x: 640, y: 380 } }).catch(() => {});
  await page.keyboard.down("KeyD"); await page.waitForTimeout(1800); await page.keyboard.up("KeyD"); await page.waitForTimeout(800);
  await shot(page, "plaza-after-walk");
  if (mode === "after") {
    await open(page, `${DAY}&at=-6,-13.6&zoom=0.55`); await shot(page, "oak-closeup");
    await open(page, `time=day&weather=clear&season=spring&at=-6,-13.6&zoom=0.55`); await shot(page, "cherry-closeup");
    await open(page, `${DAY}&at=15.2,-4.6&zoom=0.7`); await shot(page, "fence-run");
    await open(page, `weather=clear&season=summer&at=5.7,2&at=11:45&zoom=0.7`); await shot(page, "lamp-player-1145");
    await open(page, `weather=clear&season=summer&at=5.7,2&at=17:00&zoom=0.7`); await shot(page, "lamp-player-1700");
    await open(page, `${DAY}&ruins=1`); await shot(page, "ruins");
    await open(page, `${DAY}&home=1`); await shot(page, "home");
  }
  await page.context().close();
}
for (const lite of [false, true]) {
  const page = await session(lite);
  await open(page, `${DAY}&at=0,-1`);
  if (lite && mode !== "fps") await shot(page, "light-plaza");
  readings.push(`${lite ? "Light" : "High"} plaza: ${await fps(page)}`);
  if (lite && mode === "after") { await open(page, `weather=clear&season=summer&at=5.7,2&at=17:00&zoom=0.7`); await shot(page, "light-lamp-player-1700"); }
  await page.context().close();
}
console.log(readings.join("\n"));
writeFileSync(`${OUT}/fps-${mode}${process.env.BIG ? "-big" : ""}.txt`, readings.join("\n") + "\n");
await browser.close();
