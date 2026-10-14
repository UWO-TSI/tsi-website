// The v1 opening's evidence (specs/v1-drop.md §1): the whole arrival as a frame strip, and the reflection creator at
// desktop and phone sizes. Headless Chromium (WebGL on the GPU through Metal, or HEADLESS=swiftshader), muted, never
// brought to the front; signed out with the island's memory stores on the dev server (Supabase env blanked), the shared
// browser lock held. `?arrival=1` replays the arrival; window.__arrival says where it is.
//   node specs/evidence/v1-opening/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: strip (desktop, the whole arrival), phone (the creator and a few beats at 390x844), tour (the walk-along).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3164";
const GPU = process.env.HEADLESS === "swiftshader" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"];
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", ...GPU] });
const log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(viewport, touch = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 400)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) console.log("console", m.text().slice(0, 400)); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
  });
  await page.goto(`${HOST}/lab/island?arrival=1`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  return { ctx, page };
}
const state = page => page.evaluate(() => window.__arrival?.state() ?? null);
async function shot(page, name) {
  const s = await state(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push({ name, ...s });
  console.log("shot", name, JSON.stringify(s));
}
/** Frame time over 2 s (rAF, ms) and, in the creator's canvas, draw calls a frame (its mirror, frame and composite). */
async function perf(page, label) {
  const r = await page.evaluate(async () => {
    const gl = window.__reflectGl;
    if (gl) { gl.info.autoReset = false; gl.info.reset(); }
    const t0 = performance.now(); let n = 0;
    await new Promise(res => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const ms = (performance.now() - t0) / n;
    const draws = gl ? Math.round(gl.info.render.calls / n) : null;
    if (gl) { gl.info.autoReset = true; }
    const island = document.querySelector("#island-options output")?.textContent ?? "";
    return { ms: +ms.toFixed(2), creatorDraws: draws, island: island.replace(/\n/g, " | ") };
  });
  log.push({ perf: label, ...r });
  console.log("perf", label, JSON.stringify(r));
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

if (SCENES.includes("strip")) {
  const { page } = await open({ width: 1440, height: 900 });
  for (const t of [0.35, 1.3, 2.4, 3.3, 3.75, 4.3, 4.85]) { await at(page, "underwater", t); await shot(page, `01-underwater-${t.toFixed(2)}`); }
  for (const t of [0.5, 2.3, 3.4, 4.1]) { await at(page, "aboard", t); await shot(page, `02-aboard-${t.toFixed(1)}`); }
  await at(page, "creator", 1.4);
  await shot(page, "03-creator-desktop");
  await perf(page, "creator");
  // A few choices: each a ripple across the water that rewrites you, each a little clearer.
  const tiles = async (cat, n) => {
    await page.click(`[data-cat="${cat}"]`);
    await sleep(500);
    const els = await page.$$('[role="tabpanel"] ul button');
    if (els[n]) await els[n].click();
  };
  await tiles("hair", 4); await sleep(120); await shot(page, "04-creator-ripple"); await sleep(1300); await shot(page, "05-creator-hair");
  await tiles("eyes", 6); await sleep(1400);
  await page.click('[data-cat="head"]'); await sleep(400);
  const skins = await page.$$('[role="tabpanel"] [role="group"] button');
  if (skins[5]) await skins[5].click();
  await sleep(1400); await shot(page, "06-creator-three-choices");
  await tiles("tops", 3); await sleep(1400); await shot(page, "07-creator-four-choices");
  await page.click('[data-testid="reflection-yes"]', { force: true });
  for (const t of [0.4, 1.2]) { await at(page, "clearing", t); await shot(page, `08-yes-${t.toFixed(1)}`); }
  // The crossing: each of the five shots.
  for (const [t, name] of [[0.8, "drone-mist"], [3.2, "drone"], [5.6, "drone-late"], [8.5, "bow"], [13.2, "closeup"], [17.4, "wake"], [21.0, "wharf"], [23.2, "wharf-near"]]) {
    await at(page, "cross", t, true); await shot(page, `09-crossing-${t.toFixed(1).padStart(4, "0")}-${name}`);
    if (name === "bow") await perf(page, "crossing");
  }
  await at(page, "dock", 0.6, true); await shot(page, "10-docking");
  await at(page, "landing", 0.4); await shot(page, "11-landing");
  await at(page, "tutorial", 1.0); await shot(page, "12-tour-dock");
  writeFileSync(`${OUT}/frames.json`, JSON.stringify(log, null, 1));
  if (SCENES.includes("tour")) await tour(page);
  await page.context().close();
}

/** The walk-along: up the pier (the dock frame is the wharf's: (8, -19.5), no turn), over the crate, a catch, the bag, each front, the plaza. */
async function tour(page) {
  const go = (x, z) => page.evaluate(([a, b]) => window.__move?.teleport(a, b, 0), [8 + x, -19.5 + z]);
  const to = id => page.evaluate(i => window.__arrivalTargets?.()?.[i] ?? null, id);
  await sleep(10200); await shot(page, "13-tour-hint-walk");
  await go(-0.5, -1.45); await sleep(1200); await shot(page, "14-tour-crate");
  await sleep(10200); await shot(page, "15-tour-hint-hop");
  await go(0.05, -0.33); await sleep(900); await shot(page, "16-tour-fish-glyph");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:fish-caught", { detail: {} })));
  await sleep(900); await shot(page, "17-tour-bag-glyph");
  await page.keyboard.press("b"); await sleep(900); await shot(page, "18-tour-bag-open"); await page.keyboard.press("Escape"); await sleep(600);
  for (const id of ["museum", "shop", "hq", "cafe", "plaza"]) {
    const p = await to(id);
    if (p) { await page.evaluate(([x, z]) => window.__move?.teleport(x, z, 0), [p.x, p.z]); await sleep(1700); await shot(page, `19-tour-${["museum", "shop", "hq", "cafe", "plaza"].indexOf(id)}-${id}`); }
  }
  await sleep(1200); await shot(page, "20-tour-reward");
  writeFileSync(`${OUT}/frames.json`, JSON.stringify(log, null, 1));
}

/** Every category in the reflection's rail: each opened (its tile count logged), a whole hairstyle and a face worn. */
if (SCENES.includes("rail")) {
  const { page } = await open({ width: 1440, height: 900 });
  await at(page, "underwater", 0.3);
  await page.evaluate(() => { window.__arrival.skip(); window.__arrival.skip(); window.__arrival.choices(40); });
  await at(page, "creator", 2.5);
  const cats = await page.$$eval('[role="tablist"] [data-cat]', els => els.map(e => e.getAttribute("data-cat")));
  for (const [i, cat] of cats.entries()) {
    await page.click(`[data-cat="${cat}"]`);
    await sleep(1500);
    const sections = await page.$$eval('[role="tabpanel"] section', els => els.map(e => [e.getAttribute("aria-label"), e.querySelectorAll("li").length]));
    const swatches = await page.$$eval('[role="tabpanel"] [role="group"] button', els => els.length);
    log.push({ rail: cat, sections, swatches });
    console.log("rail", cat, JSON.stringify(sections), swatches);
    await shot(page, `r${String(i).padStart(2, "0")}-${cat}`);
  }
  // A whole hairstyle (David's set) and a face, worn: the ripple rewrites them in the water.
  await page.click('[data-cat="hair"]'); await sleep(600);
  const styles = await page.$$('[role="tabpanel"] section[aria-label="Hairstyles"] button');
  if (styles[4]) { await styles[4].click(); await sleep(1600); await shot(page, "r90-hairstyle-worn"); }
  await page.click('[data-cat="eyes"]'); await sleep(600);
  const eyes = await page.$$('[role="tabpanel"] ul button');
  if (eyes[9]) { await eyes[9].click(); await sleep(1600); await shot(page, "r91-face-worn"); }
  writeFileSync(`${OUT}/frames-rail.json`, JSON.stringify(log, null, 1));
  await page.context().close();
}

/** Every whole hairstyle in the water (David's set): is the face still readable in each reflection? */
if (SCENES.includes("hairstyles")) {
  const { page } = await open({ width: 1440, height: 900 });
  await at(page, "underwater", 0.3);
  await page.evaluate(() => { window.__arrival.skip(); window.__arrival.skip(); window.__arrival.choices(40); });
  await at(page, "creator", 2.5);
  await page.click('[data-cat="hair"]'); await sleep(800);
  const n = await page.$$eval('[role="tabpanel"] section[aria-label="Hairstyles"] button', els => els.length);
  for (let i = 0; i < n; i++) {
    await page.$$eval('[role="tabpanel"] section[aria-label="Hairstyles"] button', (els, k) => els[k].click(), i);
    await sleep(1700);
    await page.screenshot({ path: `${OUT}/h${String(i).padStart(2, "0")}.png`, clip: { x: 0, y: 0, width: 920, height: 900 } });
    console.log("hairstyle", i);
  }
  await page.context().close();
}

if (SCENES.includes("phone")) {
  const { page } = await open({ width: 390, height: 844 }, true);
  await at(page, "underwater", 3.0); await shot(page, "p1-underwater");
  await at(page, "aboard", 2.0); await shot(page, "p2-aboard");
  await at(page, "creator", 1.4); await shot(page, "p3-creator-phone");
  await page.click('[data-cat="hair"]'); await sleep(500);
  const els = await page.$$('[role="tabpanel"] ul button'); if (els[3]) await els[3].tap();
  await sleep(130); await shot(page, "p4-creator-phone-ripple"); await sleep(1300); await shot(page, "p5-creator-phone-hair");
  await page.tap('[data-testid="reflection-yes"]', { force: true });
  await at(page, "cross", 8.5, true); await shot(page, "p6-crossing-bow");
  await at(page, "tutorial", 1.0); await shot(page, "p7-tour-dock");
  writeFileSync(`${OUT}/frames-phone.json`, JSON.stringify(log, null, 1));
  await page.context().close();
}
await browser.close();
