// Round 3's shots (specs/lanes/reflection-waves.md): the water with no light lines, the hair colours and the eyes on every skin.
// Headless Chromium (Metal), muted, never brought to the front; the dev server on 3171 (Supabase env blanked), the
// browser lock held.
//   node specs/evidence/reflection-waves/shoot3.mjs <out_dir> water
//   node specs/evidence/reflection-waves/shoot3.mjs <out_dir> sheet <name> "<lab/avatar query>"
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, MODE, NAME, QUERY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3171";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const quiet = page => {
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });
};

if (MODE === "water") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); quiet(page);
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
  await page.goto(`${HOST}/lab/island?arrival=1`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  await page.evaluate(() => window.__arrival.choices(8));
  await page.waitForFunction(() => { const s = window.__arrival.state(); return s.phase === "creator" && s.t > 2.5; }, null, { timeout: 300000, polling: 50 });
  await sleep(2500);
  const r = await page.evaluate(() => { const b = document.querySelector('[data-testid="reflection-yes"]').parentElement.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  for (const n of [0, 1]) { await page.screenshot({ path: `${OUT}/water-rest-${n}.png`, clip: r }); await sleep(700); }
  await page.click('[data-cat="hair"]'); await sleep(1200);
  const tiles = await page.$$('[role="tabpanel"] ul button');
  await tiles[6].click(); await sleep(+(process.env.MID_MS ?? 620));
  await page.screenshot({ path: `${OUT}/water-mid.png`, clip: r });
  await ctx.close();
} else {
  // the bench draws every cell into one fixed canvas: the viewport is made as tall as the grid, so all of it renders
  const W = +(process.env.W ?? 1500);
  const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
  const page = await ctx.newPage(); quiet(page);
  await page.goto(`${HOST}/lab/avatar?${QUERY}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForSelector("figure", { timeout: 300000 });
  await sleep(1500);
  await page.setViewportSize({ width: W, height: Math.max(900, Math.ceil(await page.evaluate(() => document.querySelector("[data-sheet]").getBoundingClientRect().bottom + 56))) });
  await sleep(+(process.env.SETTLE_MS ?? 12000));
  await page.screenshot({ path: `${OUT}/${NAME}.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
