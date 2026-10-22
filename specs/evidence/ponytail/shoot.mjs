// Ponytail Phase B evidence: the GPU changes (F7, S9, F8, F9) look the same, and the scenes whose preloads moved
// (S7, S8) still open. Headless Chromium (WebGL through ANGLE/Metal), muted, signed out, against a dev server with the
// Supabase env blanked, the shared browser lock held. Run once on the old files and once on the new:
//   HOST=http://localhost:3427 node specs/evidence/ponytail/shoot.mjs <out_dir> <tag> [campfire] [creator] [scenes] [net]
// Writes <tag>-*.png and prints the asset requests and page errors per scene.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, TAG, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3427";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WATCH = /combat-pack|fire-pack|cafe-room|cafe-kit|game\/oracle\/|oracle\.glb|tree-hardwood|bush-|flower-|interior\/(wall|floor)-|hair_colour/;
/** DEFAULT_LOOK as a saved look (skips the creator): its bob with a pigtail is a mapped hairstyle. */
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts",
  onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };

async function open(name, w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const seen = new Set(), errors = [];
  page.on("request", r => { const u = r.url(); if (WATCH.test(u)) seen.add(u.replace(HOST, "").split("?")[0]); });
  page.on("pageerror", e => errors.push(e.message.slice(0, 200)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|403|404|500|503|ERR_CONNECTION/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const report = () => console.log(JSON.stringify({ tag: TAG, scene: name, assets: [...seen].sort(), errors }));
  return { page, report, close: () => ctx.close() };
}
async function ready(page) {
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => {});
}
async function village(page, query, wait) {
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.look.v1", l); }, JSON.stringify(LOOK));
  await page.goto(`${HOST}/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
  await ready(page);
  await sleep(wait);
}

for (const scene of SCENES) {
  if (scene === "campfire") {
    // The beach campfire (campfireSite: -5.71, -16.15), lit at night; you stand a few steps south of it.
    const { page, report, close } = await open("campfire");
    await village(page, "time=night&weather=clear&at=-5.7,-20", 15000);
    await page.screenshot({ path: `${OUT}/${TAG}-campfire.png` });
    await page.screenshot({ path: `${OUT}/${TAG}-campfire-crop.png`, clip: { x: 520, y: 220, width: 400, height: 400 } });
    report(); await close();
  }
  if (scene === "creator") {
    // The arrival's reflection creator (a creator-sized face, the full hair atlas), then the village once it's skipped.
    const { page, report, close } = await open("creator");
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
    await page.goto(`${HOST}/lab/island?arrival=1&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
    await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
    await page.evaluate(() => { window.__arrival.skip(); window.__arrival.choices(40); });
    await page.waitForFunction(() => { const s = window.__arrival?.state(); return s?.phase === "creator" && s.t >= 2.2; }, null, { timeout: 300000, polling: 50 });
    await sleep(12000);
    await page.screenshot({ path: `${OUT}/${TAG}-creator.png` });
    await page.click('[data-testid="reflection-yes"]', { force: true });   // the creator closes on "Yes" (it bobs: never "stable")
    const phases = [];
    for (let i = 0; i < 10; i++) {
      await sleep(2500);
      const phase = await page.evaluate(() => window.__arrival?.state()?.phase ?? "done");
      phases.push(phase);
      if (phase === "done" || phase === "tutorial") break;
      await page.evaluate(() => window.__arrival.skip());
    }
    console.log(JSON.stringify({ tag: TAG, scene: "creator", phases }));
    await sleep(8000);
    await page.screenshot({ path: `${OUT}/${TAG}-after-creator.png` });
    report(); await close();
  }
  if (scene === "scenes") {
    // S7 and S8: the scenes whose preloads moved still open (the dev scene overrides open them whatever the drop).
    for (const q of ["cafe=inside", "temple=inside", "home=inside"]) {
      const { page, report, close } = await open(q);
      await village(page, `${q}&weather=clear&at=14:20`, 12000);
      await page.screenshot({ path: `${OUT}/${TAG}-${q.split("=")[0]}.png` });
      report(); await close();
    }
  }
  if (scene === "applicant") {
    // S8: the applicant island (the only one drawing the default ACNH nature) still opens and still asks for it.
    const { page, report, close } = await open("applicant");
    await page.goto(`${HOST}/student/apply/portal?preview=1`, { waitUntil: "domcontentloaded" });
    const drew = await page.waitForSelector("canvas", { timeout: 180000 }).then(() => true, () => false);
    await sleep(drew ? 15000 : 0);
    await page.screenshot({ path: `${OUT}/${TAG}-applicant.png` });
    console.log(JSON.stringify({ tag: TAG, scene: "applicant", canvas: drew, url: page.url().replace(HOST, "") }));
    report(); await close();
  }
  if (scene === "net") {
    // What the village asks for on load, by day: no combat pack, cafe room, Oracle shell or default (ACNH) nature.
    const { page, report, close } = await open("village-day");
    await village(page, "weather=clear&at=14:20", 15000);
    await page.screenshot({ path: `${OUT}/${TAG}-village.png` });
    report(); await close();
  }
}
await browser.close();
