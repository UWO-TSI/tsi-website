// Sun path captures (specs/look-development.md §8, row 239). Headless Chromium on SwiftShader, 1280x720 canvas,
// smooth mode, High tier with shadows, clear summer weather so only the sun changes, dev server on :$PORT (3103).
//   node specs/evidence/sun-path/shots.mjs before /tmp/sun-path/before   (the shipped look, ?time=day)
//   node specs/evidence/sun-path/shots.mjs after  /tmp/sun-path/after    (the real sun at the listed clock times)
//   node specs/evidence/sun-path/shots.mjs clock  /tmp/sun-path/clock    (?at=17:00 today on the world clock)
// V1 = the look evidence's plaza camera (follow camera, player at 0,-1). Frames are PNG; towebp.sh makes the WebP.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [mode, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const BASE = `http://localhost:${process.env.PORT ?? 3103}/lab/island`;
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob",
  top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} };

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
await ctx.addInitScript(look => {
  try {
    localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false");
  } catch {}
}, JSON.stringify(LOOK));
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = "html.shot main > :not(:has(canvas)), html.shot nav, html.shot nextjs-portal { visibility: hidden !important; }";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
});

async function open(query) {
  await page.goto(`${BASE}?${query}&weather=clear&season=summer`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  // Assets stream in waves: wait for the loading status to stay gone, then for compiles and the shadow bake.
  for (let quiet = 0; quiet < 3;) {
    await page.waitForTimeout(1500);
    quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0;
  }
  await page.waitForTimeout(12000);
}
async function shot(name) {
  await page.evaluate(() => document.documentElement.classList.add("shot"));
  await page.waitForTimeout(500);
  const box = await page.locator("canvas").first().boundingBox();
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: box });
  await page.evaluate(() => document.documentElement.classList.remove("shot"));
  console.log("shot", name);
}
async function minimap(name) {
  await page.locator("[data-minimap]").screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
}

if (mode === "before") {
  await open("at=0,-1&time=day");
  await shot("V1-day");
  await minimap("minimap");
  await open("at=0,-1&time=evening");
  await shot("V1-evening");
}

if (mode === "after") {
  const frames = [
    ["2026-09-27", "09:00"], ["2026-09-27", "11:45"], ["2026-09-27", "13:00"], ["2026-09-27", "15:00"],
    ["2026-09-27", "17:00"], ["2026-09-27", "18:30"], ["2026-06-21", "17:00"], ["2026-12-21", "17:00"],
  ];
  for (const [date, at] of (process.env.ONLY ? frames.filter(([d, t]) => `${d}T${t}` === process.env.ONLY) : frames)) {
    await open(`at=0,-1&at=${at}&date=${date}`);
    await shot(`V1-${date}-${at.replace(":", "")}`);
    if (date === "2026-09-27" && at === "11:45") await minimap("minimap");
  }
}

if (mode === "clock") { // ?at on the world clock: today 17:00 at V1 and on the west shore, looking over the sea toward the sun
  await open("at=0,-1&at=17:00");
  await shot("clock-V1-1700");
  await open("at=0,15&at=17:00");
  await shot("clock-west-shore-1700");
}

await browser.close();
