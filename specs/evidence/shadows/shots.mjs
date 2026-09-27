// Shadow audit frames from David's demo server (:3000, feat/game-default-island). Headed Chromium (WebGL needs it here).
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const OUT = process.argv[2];
const BASE = "http://localhost:3000/lab/island";
const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} }, LOOK);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 160)));
async function open(q) {
  await page.goto(`${BASE}?${q}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 180000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(6000);
}
async function shot(name) { const box = await page.locator("canvas").first().boundingBox(); await page.screenshot({ path: `${OUT}/${name}.png`, clip: box }); console.log("shot", name); }
for (const [name, at] of [["plaza", "0,-1"], ["shore", "6,-16"], ["west-trees", "-9,-3"], ["east-trees", "10,6"], ["north", "0,10"]]) {
  await open(`time=day&weather=clear&season=summer&at=${at}`);
  await shot(name);
}
// Walk test: hold a key so the player moves, then shoot again (a cached shadow map would leave stale shadows).
await open("time=day&weather=clear&season=summer&at=0,-1");
await page.locator("canvas").first().click({ position: { x: 640, y: 380 } }).catch(() => {});
await page.keyboard.down("KeyD"); await page.waitForTimeout(1800); await page.keyboard.up("KeyD"); await page.waitForTimeout(800);
await shot("plaza-after-walk");
await browser.close();
