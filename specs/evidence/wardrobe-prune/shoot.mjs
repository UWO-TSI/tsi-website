// Evidence for the wardrobe-prune lane (specs/playtest-round1.md, "Wardrobe cut"). Headless Chromium (WebGL through
// ANGLE/Metal), muted, signed out, against the dev server with the Supabase env blanked, the shared browser lock held.
//   node specs/evidence/wardrobe-prune/shoot.mjs <out_dir> <before|after> <scene> [<scene> ...]
// Scenes:
//   lab      /lab/avatar: every authored resident, the HQ lead and the café owner (head and body), the six expressions,
//            each emote mouth's frames, and Jayden (the applicant guide, his look as ApplicantWorld.tsx has it)
//   creator  the arrival's reflection creator (the starting creator): the Eyes, Mouth, Tops, Bottoms and Accessories tabs
//   closet   the closet (wardrobe mode, a member with the starters only): Accessories, Tops and Bottoms, everything the
//            catalogue holds, the unowned locked (the craft-only parts stay here, made at the workbench)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, WHEN, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = `http://localhost:${process.env.PORT ?? 3176}`;
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
async function page0(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => { errors.push(e.message.slice(0, 300)); console.log("pageerror", e.message.slice(0, 300)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) { errors.push(m.text().slice(0, 300)); console.log("console", m.text().slice(0, 300)); } });
  return page;
}

/** Jayden in components/recruit/ApplicantWorld.tsx, before and after the cut. */
const JAYDEN = {
  before: { skin: 6, hair: 0, eyes: "E5.4", mouth: "M4.2", bangs: "bangs_swept_r", back: "back_short_spiky", top: "top_tsi_crew", bottom: "bottom_trousers", shoes: "shoes_sneakers" },
  after: { skin: 6, hair: 0, eyes: "bean", mouth: "little_v", bangs: "bangs_swept_r", back: "back_short_spiky", top: "top_tsi_crew", bottom: "bottom_trousers", shoes: "shoes_sneakers" },
};

if (SCENES.includes("lab")) {
  const page = await page0(2000, 1700);   // every cell in view (a View off screen is not drawn)
  const bench = async (name, qs, wait = 12000) => {
    await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 300000 });
    await sleep(wait);
    await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${WHEN}-${name}.png` });
    console.log("shot", `${WHEN}-${name}`);
  };
  await bench("residents-head", "sheet=residents&framing=head", 20000);
  await bench("residents-body", "sheet=residents&framing=body", 15000);
  await bench("expressions", "sheet=expr&yaw=-0.3");
  await bench("emote-mouths", "sheet=emote&yaw=-0.3");
  await bench("jayden", `sheet=look&label=Jayden&framing=head&look=${encodeURIComponent(JSON.stringify(JAYDEN[WHEN]))}`);
  await bench("jayden-body", `sheet=look&label=Jayden&framing=body&look=${encodeURIComponent(JSON.stringify(JAYDEN[WHEN]))}`);
  await page.context().close();
}

if (SCENES.includes("creator")) {
  // The starting creator is the arrival's reflection (tutorial-v2): skip the aboard beat, wait for the creator, open
  // each category. A new account owns the starters only, so these tabs are exactly what a new member can pick.
  const page = await page0(1440, Number(process.env.H ?? 900));
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
  await page.goto(`${HOST}/lab/island?arrival=1&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  await page.evaluate(() => { window.__arrival.skip(); window.__arrival.choices(40); });
  await page.waitForFunction(() => { const s = window.__arrival?.state(); return s?.phase === "creator" && s.t >= 2.2; }, null, { timeout: 300000, polling: 50 });
  for (const [i, cat] of ["eyes", "mouth", "tops", "bottoms", "accessories"].entries()) {
    await page.click(`[data-cat="${cat}"]`);
    await sleep(2500);   // the tiles' pictures (face cells from the atlas, item icons)
    const tiles = await page.$$eval('[role="tabpanel"] ul button', els => els.map(e => e.getAttribute("aria-label")));
    console.log("tiles", cat, tiles.length, JSON.stringify(tiles));
    await page.screenshot({ path: `${OUT}/${WHEN}-creator-${i + 1}-${cat}.png` });
  }
  await page.context().close();
}

if (SCENES.includes("closet")) {
  const page = await page0(1440, Number(process.env.H ?? 900));
  const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "bangs_straight", back: "back_bob", top: "top_tee", bottom: "bottom_shorts",
    onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(look => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.look.v1", JSON.stringify(look)); }, LOOK);
  await page.goto(`${HOST}/lab/island?sheet=closet&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  await page.waitForSelector('[data-cat="accessories"]', { timeout: 300000 });
  await sleep(6000);
  for (const [i, cat] of ["accessories", "tops", "bottoms"].entries()) {
    await page.click(`[data-cat="${cat}"]`);
    await sleep(2500);
    const tiles = await page.$$eval('[role="tabpanel"] ul button', els => els.map(e => e.getAttribute("aria-label")));
    console.log("closet", cat, tiles.length, JSON.stringify(tiles));
    await page.screenshot({ path: `${OUT}/${WHEN}-closet-${i + 1}-${cat}.png` });
  }
  await page.context().close();
}

await browser.close();
console.log(errors.length ? `errors: ${errors.length}` : "no page errors");
