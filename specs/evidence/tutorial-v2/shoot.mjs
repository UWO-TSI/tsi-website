// Evidence for the tutorial-v2 lane (specs/playtest-round1.md): the opening aboard Bram's boat, the reflection creator
// (upright face, shirt in frame, the clothes on the rail), eyebrows gone (an old saved look with brows loads cleanly), and
// Bram's walk-along v2 (the "!" stops, the talks, the quest tracker, the beach and the fishing, the B and market lines)
// end to end at desktop and phone sizes. Headless Chromium (WebGL on the GPU through Metal), muted; signed out against the
// dev server with the Supabase env blanked, the shared browser lock held. `?arrival=1` replays the arrival.
//   node specs/evidence/tutorial-v2/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: opening, creator, brows, phone-creator, tour (desktop, end to end), tour-phone (390x844, touch, end to end).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3172";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const log = [];
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** An old look as a member saved it before eyebrows were removed: flat brows, and the brows slider moved. */
const OLD_LOOK = { skin: 4, hair: 3, eyes: "E5.5", mouth: "M2.1", brows: "brow_flat", extras: ["freckles"], bangs: "bangs_straight", back: "back_bob",
  top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: { top_tee: 9 }, place: { brows: [3, -2, 4, 2], eyes: [1, 0, 0, 0] } };

async function open(viewport, { touch = false, look = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
  const page = await ctx.newPage();
  page.on("pageerror", e => { errors.push(e.message.slice(0, 400)); console.log("pageerror", e.message.slice(0, 400)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) { errors.push(m.text().slice(0, 400)); console.log("console", m.text().slice(0, 400)); } });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(look => {
    localStorage.clear();
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    if (look) localStorage.setItem("tsi.look.v1", JSON.stringify(look));
  }, look);
  await page.goto(`${HOST}/lab/island?arrival=1&weather=clear&at=14:20${touch ? "&touch=1" : ""}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  return { ctx, page };
}
const state = page => page.evaluate(() => ({ ...(window.__arrival?.state() ?? {}), tutorial: window.__tutorial?.() ?? null }));
async function shot(page, name) {
  const s = await state(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push({ name, ...s });
  console.log("shot", name, JSON.stringify(s).slice(0, 300));
}
/** Wait until the arrival is in `phase` at least `t` s in (or the trip is, with `trip`). */
async function at(page, phase, t, trip = false) {
  await page.waitForFunction(([p, tt, tr]) => {
    const s = window.__arrival?.state();
    if (!s) return false;
    if (tr) return s.trip && s.trip.phase === p && s.trip.t >= tt;
    return s.phase === p && s.t >= tt;
  }, [phase, t, trip], { timeout: 300000, polling: 16 });
}
/** Frame time over 2 s (rAF, ms) and, in the creator's canvas, draw calls a frame. */
async function perf(page, label) {
  const r = await page.evaluate(async () => {
    const gl = window.__reflectGl;
    if (gl) { gl.info.autoReset = false; gl.info.reset(); }
    const t0 = performance.now(); let n = 0;
    await new Promise(res => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const ms = (performance.now() - t0) / n;
    const draws = gl ? Math.round(gl.info.render.calls / n) : null;
    if (gl) gl.info.autoReset = true;
    return { ms: +ms.toFixed(2), creatorDraws: draws };
  });
  log.push({ perf: label, ...r });
  console.log("perf", label, JSON.stringify(r));
}
/** Into the creator: skip the aboard beat, a few choices' clarity (or `choices`), settled. */
async function toCreator(page, choices = 40) {
  await page.evaluate(n => { window.__arrival.skip(); window.__arrival.choices(n); }, choices);
  await at(page, "creator", 2.2);
}
const pick = async (page, cat, n) => {
  await page.click(`[data-cat="${cat}"]`);
  await sleep(500);
  const els = await page.$$('[role="tabpanel"] ul button');
  if (els[n]) await els[n].click();
};

if (SCENES.includes("opening")) {
  const { page } = await open({ width: 1440, height: 900 });
  for (const t of [0.15, 0.9, 1.6, 2.6, 3.4, 4.0, 4.4]) { await at(page, "aboard", t); await shot(page, `01-opening-aboard-${t.toFixed(2)}`); }
  await at(page, "creator", 1.2);
  await shot(page, "01-opening-creator");
  await page.context().close();
}

if (SCENES.includes("creator")) {
  const { page } = await open({ width: 1440, height: 900 });
  await toCreator(page);
  await shot(page, "02-creator-desktop");
  await perf(page, "creator");
  // The shirt: the Tops category on the rail, another top, the ripple rewriting it, then a colour.
  await page.click('[data-cat="tops"]'); await sleep(700);
  await shot(page, "02-creator-tops");
  const tops = await page.$$('[role="tabpanel"] ul button');
  if (tops[1]) await tops[1].click();
  await sleep(140); await shot(page, "02-creator-tops-ripple");
  await sleep(1300); await shot(page, "02-creator-tops-changed");
  const sw = await page.$$('[role="tabpanel"] [role="group"] button');
  if (sw[6]) await sw[6].click();
  await sleep(1400); await shot(page, "02-creator-tops-colour");
  await pick(page, "hair", 4); await sleep(1400); await shot(page, "02-creator-hair");
  const cats = await page.$$eval('[role="tablist"] [data-cat]', els => els.map(e => e.getAttribute("data-cat")));
  log.push({ rail: cats });
  console.log("rail", JSON.stringify(cats));
  await page.click('[data-testid="reflection-yes"]', { force: true });
  for (const t of [0.5, 1.4]) { await at(page, "clearing", t); await shot(page, `02-creator-yes-${t.toFixed(1)}`); }
  await page.context().close();
}

if (SCENES.includes("phone-creator")) {
  const { page } = await open({ width: 390, height: 844 }, { touch: true });
  await toCreator(page);
  await shot(page, "03-phone-creator");
  await page.click('[data-cat="tops"]'); await sleep(700);
  const tops = await page.$$('[role="tabpanel"] ul button');
  if (tops[2]) await tops[2].click();
  await sleep(1500); await shot(page, "03-phone-creator-tops");
  await page.context().close();
}

if (SCENES.includes("brows")) {
  // An old saved look with eyebrows (and the brows slider moved): it loads, and the water shows it without brows.
  const { page } = await open({ width: 1440, height: 900 }, { look: OLD_LOOK });
  await toCreator(page);
  const parsed = await page.evaluate(() => JSON.parse(localStorage.getItem("tsi.look.v1") ?? "null"));
  log.push({ brows: "old look in storage", stored: parsed });
  await page.click('[data-cat="eyes"]'); await sleep(800);
  await shot(page, "04-brows-old-look-eyes");
  await page.click('[data-cat="head"]'); await sleep(800);
  await shot(page, "04-brows-old-look");
  await page.context().close();
}

writeFileSync(`${OUT}/frames-${SCENES.join("-")}.json`, JSON.stringify({ log, errors }, null, 1));
console.log("errors", errors.length);
await browser.close();
