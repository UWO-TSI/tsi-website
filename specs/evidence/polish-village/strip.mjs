// Living-village evidence: a timed frame sequence of one load (headed Chromium, muted, signed out, dev server on :3124
// with the Supabase env blanked). Frames every <ms> from the moment the island is ready; optional key presses between.
//   node specs/evidence/polish-village/strip.mjs <out_dir> <name> '<query>' <frames>:<ms> [<at_frame>:<keys>:<hold_ms> ...]
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, NAME, QUERY, RUN, ...PRESSES] = process.argv.slice(2);
const [frames, every] = RUN.split(":").map(Number);
const presses = new Map(PRESSES.map(p => { const [at, keys, hold] = p.split(":"); return [Number(at), { keys: keys.split(","), hold: Number(hold) }]; }));
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
await page.goto("http://localhost:3124/lab/island", { waitUntil: "domcontentloaded" });
await page.evaluate(l => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", "false"); }, JSON.stringify(LOOK));
await page.goto(`http://localhost:3124/lab/island?${QUERY}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas", { timeout: 240000 });
await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => {});
await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'] { display: none !important; }" });
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const p = presses.get(i);
  if (p) {
    await page.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    for (const k of p.keys) await page.keyboard.down(k);
    await page.waitForTimeout(p.hold);
    for (const k of p.keys) await page.keyboard.up(k);
  }
  await page.screenshot({ path: `${OUT}/${NAME}-${String(i).padStart(2, "0")}.png`, clip: { x: 0, y: 40, width: 1440, height: 860 } });
  const next = t0 + (i + 1) * every;
  await page.waitForTimeout(Math.max(0, next - Date.now()));
}
console.log("perf", await page.evaluate(() => document.querySelector("#island-options output")?.textContent?.replace(/\n/g, " | ") ?? ""));
await browser.close();
