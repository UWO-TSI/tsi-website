// FPS for the living-village report: the island's Performance readout (frames over each second), read 10 times a
// second apart after the island settles, median reported. Headed Chromium (WebGL), muted, smooth finish (px=0).
//   node specs/evidence/polish-village/fps.mjs name='<query>' ...
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob", top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} };
await page.goto("http://localhost:3124/lab/island", { waitUntil: "domcontentloaded" });
await page.evaluate(l => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", "false"); }, JSON.stringify(LOOK));
for (const spec of process.argv.slice(2)) {
  const [name, query] = spec.split(/=(.*)/s);
  await page.goto(`http://localhost:3124/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const fps = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1050);
    const t = await page.evaluate(() => document.querySelector("#island-options output")?.textContent ?? "");
    const m = /(\d+) FPS/.exec(t);
    if (m) fps.push(Number(m[1]));
  }
  fps.sort((a, b) => a - b);
  console.log("fps", name, "median", fps[Math.floor(fps.length / 2)], "min", fps[0], "max", fps[fps.length - 1]);
}
await browser.close();
