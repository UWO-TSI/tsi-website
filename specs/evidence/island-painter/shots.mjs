// Island painter evidence: deterministic frames of /lab/island (headed Chromium; WebGL needs it here).
// node shots.mjs <outDir> [base=http://localhost:3105] [query-extra]
// The page clock is Playwright's fake clock at a fixed instant, and every run renders the same
// number of frames, so two builds of the same island give the same pixels (the frame diff).
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, BASE = "http://localhost:3105", EXTRA = ""] = process.argv.slice(2);
const T0 = new Date("2026-09-28T16:00:00Z");
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} }, LOOK);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
async function open(q) {
  await page.clock.install({ time: T0 });
  await page.goto(`${BASE}/lab/island?${q}${EXTRA}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.addStyleTag({ content: "[data-minimap], nextjs-portal { display: none !important; }" });
  // Frames only advance when we say: the same count on every run, with real time between for loads.
  for (let i = 0; i < 12; i++) { await page.clock.runFor(250); await page.waitForTimeout(1500); }
  for (let quiet = 0, n = 0; quiet < 3 && n < 60; n++) {
    await page.waitForTimeout(1000);
    quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0;
  }
  await page.waitForTimeout(3000);
  await page.clock.setSystemTime(new Date(T0.getTime() + 60000));
  await page.clock.runFor(2000);
}
async function shot(name) { const box = await page.locator("canvas").first().boundingBox(); await page.screenshot({ path: `${OUT}/${name}.png`, clip: box }); console.log("shot", name); }
const views = (process.env.VIEWS ?? "spawn:0,-10 plaza:0,-1 shore:6,-16 west:-9,-3 east:10,6 north:0,10").split(" ").map(v => v.split(":"));
for (const [name, at] of views) { await open(`time=day&weather=clear&season=summer&at=${at}`); await shot(name); }
if (!process.env.NO_OVERVIEW) {
  await open("time=day&weather=clear&season=summer");
  await page.getByRole("button", { name: "Overview" }).click({ force: true });
  await page.clock.runFor(3000);
  await shot("overview");
}
await browser.close();
