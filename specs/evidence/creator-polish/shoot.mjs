// creator-polish evidence (specs/lanes/creator-polish.md): the reflection at rest (two stills 0.6 s apart, the same
// camera), a hairstyle change as a frame strip (the back of the head over the side and the sweep in the water), and a
// top change as a frame strip (the selection wave). Headless Chromium (Metal), muted, signed out on the dev server
// (Supabase env blanked), the browser lock held by the caller.
//   HOST=http://localhost:3172 node specs/evidence/creator-polish/shoot.mjs <out_dir>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3172";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = {};

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 400)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
await page.goto(`${HOST}/lab/island?arrival=1`, { waitUntil: "domcontentloaded" });
await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
await page.evaluate(() => window.__arrival.choices(8));
await page.waitForFunction(() => { const s = window.__arrival.state(); return s.phase === "creator" && s.t > 2.5; }, null, { timeout: 300000, polling: 50 });
const clip = await page.evaluate(() => { const r = document.querySelector('[data-testid="reflection-yes"]').parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
log.clip = clip;

// At rest: a few clear seconds in, two stills 0.6 s apart.
await page.click('[data-cat="hair"]'); await sleep(3000);
for (const n of [0, 1, 2]) { await page.screenshot({ path: `${OUT}/rest-${n}.png`, clip }); await sleep(600); }

async function strip(tag, click, ms = 1700) {
  const t0 = Date.now(), frames = [];
  await click();
  while (Date.now() - t0 < ms) {
    const at = Date.now() - t0, name = `${tag}-${String(at).padStart(4, "0")}.png`;
    await page.screenshot({ path: `${OUT}/${name}`, clip });
    frames.push(at);
  }
  log[tag] = frames;
  console.log(tag, frames.join(" "));
  await sleep(1500);
}
const tile = (section, k) => () => page.$$eval(`[role="tabpanel"] section[aria-label="${section}"] button`, (els, i) => els[i].click(), k);
// Hairstyles: to the white spiky one (13), then to a mid-brown one (12).
await strip("hair-a", tile("Hairstyles", 13));
await strip("hair-b", tile("Hairstyles", 12));
// The selection wave on a top.
await page.click('[data-cat="tops"]'); await sleep(1500);
const secs = await page.$$eval('[role="tabpanel"] section[aria-label]', els => els.map(e => e.getAttribute("aria-label")));
console.log("sections", secs.join(", "));
await strip("top", tile("Tops", 1));
// A hat (the accessories' first section).
await page.click('[data-cat="accessories"]'); await sleep(1500);
console.log("acc sections", (await page.$$eval('[role="tabpanel"] section[aria-label]', els => els.map(e => e.getAttribute("aria-label")))).join(", "));
await strip("hat", () => page.$$eval('[role="tabpanel"] section[aria-label] ul button, [role="tabpanel"] section[aria-label] button', els => els[Math.min(3, els.length - 1)].click()));
writeFileSync(`${OUT}/frames.json`, JSON.stringify(log, null, 1));
await browser.close();
