// The reflection creator's rolling wave (specs/lanes/reflection-waves.md): at rest, a wave rolling past your face as a
// frame sequence, just after, at desktop and phone sizes. Headless Chromium (Metal, or HEADLESS=swiftshader), muted,
// never brought to the front; signed out on the dev server (Supabase env blanked), the shared browser lock held.
//   node specs/evidence/reflection-waves/shoot.mjs <out_dir> [desktop] [phone] [clear]
// `clear`: a few choices in first (the world sharper), as the later changes look.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3171";
const GPU = process.env.HEADLESS === "swiftshader" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"];
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", ...GPU] });
const log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clear = SCENES.includes("clear");

async function open(viewport, touch = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 400)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) console.log("console", m.text().slice(0, 400)); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
  await page.goto(`${HOST}/lab/island?arrival=1`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  // The replay opens on the reflection now (the underwater and aboard beats are skipped in dev).
  if (clear) await page.evaluate(() => window.__arrival.choices(6));
  await page.waitForFunction(() => { const s = window.__arrival.state(); return s.phase === "creator" && s.t > 2.5; }, null, { timeout: 300000, polling: 50 });
  return page;
}
const sceneBox = page => page.evaluate(() => { const r = document.querySelector('[data-testid="reflection-yes"]').parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });

/** At rest, then a hair change and its wave as a frame sequence (scene only, ms since the click in the name), after. */
async function run(page, tag, tap) {
  await page.click('[data-cat="hair"]'); await sleep(1200);
  await page.screenshot({ path: `${OUT}/${tag}-1-rest.png` });
  const clip = await sceneBox(page);
  for (const n of [0, 1]) { await page.screenshot({ path: `${OUT}/${tag}-0-calm-${n}.png`, clip }); await sleep(450); }
  const tiles = await page.$$('[role="tabpanel"] ul button');
  const t0 = Date.now();
  await (tap ? tiles[4].tap() : tiles[4].click());
  const frames = [];
  while (Date.now() - t0 < 1700) {
    const ms = Date.now() - t0, name = `${tag}-seq-${String(ms).padStart(4, "0")}.png`;
    await page.screenshot({ path: `${OUT}/${name}`, clip });
    frames.push({ name, ms });
  }
  await sleep(600);
  await page.screenshot({ path: `${OUT}/${tag}-3-after.png` });
  // The whole screen with a crest at your face: another change, shot as the wave gets there.
  await (tap ? tiles[6].tap() : tiles[6].click());
  await sleep(+(process.env.MID_MS ?? 520));
  await page.screenshot({ path: `${OUT}/${tag}-2-mid.png` });
  // The hair colours: the swatches, no colour wheel (that stays in the wardrobe).
  if (SCENES.includes("colours")) {
    await sleep(1500);
    await page.$eval('[role="tabpanel"] [role="group"][data-kind="hair"]', el => el.scrollIntoView({ block: "center" }));
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${tag}-4-hair-colours.png` });
    console.log("wheel in the creator:", await page.$$eval('[role="tabpanel"] [class*="wheel" i], [role="tabpanel"] [aria-label*="wheel" i]', els => els.length));
  }
  log.push({ tag, frames });
  console.log(tag, frames.map(f => f.ms).join(" "));
}

if (SCENES.includes("desktop")) { const page = await open({ width: 1440, height: 900 }); await run(page, "desktop"); await page.context().close(); }
if (SCENES.includes("phone")) { const page = await open({ width: 390, height: 844 }, true); await run(page, "phone", true); await page.context().close(); }
writeFileSync(`${OUT}/frames.json`, JSON.stringify(log, null, 1));
await browser.close();
