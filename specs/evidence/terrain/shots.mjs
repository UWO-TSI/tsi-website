// Natural terrain frames (specs/terrain-blending.md). Headed Chromium (WebGL needs it here), real GPU (metal).
//   PORT=3117 node specs/evidence/terrain/shots.mjs before <outDir>    today's island, fixed cameras
//   PORT=3117 node specs/evidence/terrain/shots.mjs after <outDir>     the same cameras plus the synthetic fixture and FPS
// Writes PNGs; convert to small WebP afterwards (cwebp -q 70).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [mode = "before", OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const ROOT = `http://localhost:${process.env.PORT ?? 3117}`;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
await ctx.addInitScript((look) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} }, LOOK);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 160)));
async function open(q) {
  await page.goto(`${ROOT}/lab/island?${q}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(6000);
}
async function shot(name) { const box = await page.locator("canvas").first().boundingBox(); await page.screenshot({ path: `${OUT}/${name}.png`, clip: box }); console.log("shot", name); }
async function overview(name) { await page.getByRole("button", { name: "Overview" }).click(); await page.waitForTimeout(4000); await shot(name); await page.getByRole("button", { name: "Walk" }).click(); }
async function fps() {
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
// Today's island: the coast from above, a beach ahead of the camera, the plaza paths, the half-step rise, the river mouth.
const CAMERAS = [["beach-north", "2,13&zoom=0.7"], ["beach-west", "-17,2&zoom=0.7"], ["plaza-paths", "0,-1&zoom=0.7"], ["half-step-rise", "-12,6&zoom=0.8"], ["river-bridge", "1,-4&zoom=0.7"]];
await open(`${DAY}&at=0,-1`);
await overview("coast-overview");
for (const [name, at] of CAMERAS) { await open(`${DAY}&at=${at}`); await shot(name); }
const readings = [];
await open(`${DAY}&at=0,-1`);
readings.push(`plaza: ${await fps()}`);
if (mode === "after") {
  // The synthetic fixture (lib/game/fixtures/terrainFixture.ts): a cliff ring, a hill, a sloping beach, paths, a bay and a point.
  for (const [name, at] of [["fixture-overview", null], ["fixture-hill", "-12,-16&zoom=0.9"], ["fixture-cliffs", "12,-17&zoom=0.9"], ["fixture-beach", "0,15&zoom=0.45"], ["fixture-paths", "-2,-9&zoom=0.8"], ["fixture-bay", "11,1&zoom=1.4"], ["fixture-point", "-22,-11&zoom=1.3"]]) {
    await open(`${DAY}&fixture=terrain${at ? `&at=${at}` : ""}`);
    if (at) await shot(name); else await overview(name);
  }
}
console.log(readings.join("\n"));
writeFileSync(`${OUT}/fps-${mode}.txt`, readings.join("\n") + "\n");
await browser.close();
