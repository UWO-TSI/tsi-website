// Group C (ui-stores) checks, UI audit 2026-10 items 2, 10, 12, 14. Dev server on :3155 with the Supabase env blanked, headless,
// --mute-audio, never brought to the front. node shoot.cjs <before|after> [scene...]; PNGs and log.jsonl land beside the script.
const { chromium } = require("/opt/homebrew/lib/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const BASE = "http://localhost:3155";
const MODE = process.argv[2] || "after";
const ONLY = process.argv.slice(3);
const OUT = path.join(__dirname, "shots-stores", MODE);
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "log.jsonl");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = o => { fs.appendFileSync(LOG, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o).slice(0, 600)); };
const shot = (page, name, clip) => page.screenshot({ path: path.join(OUT, name + ".png"), timeout: 60000, ...(clip ? { clip } : {}) }).catch(e => log({ name, shotErr: String(e).slice(0, 200) }));

async function islandReady(page, ms = 180000) {
  await page.waitForFunction(() => !!document.querySelector("canvas") && !document.body.innerText.includes("Preparing the island") && /\bMap\b/.test(document.body.innerText), null, { timeout: ms }).catch(() => {});
  await sleep(3000);
}
const dialogs = page => page.evaluate(() => [...document.querySelectorAll('[role="dialog"],[data-gui-dialog]')].map(d => ({
  label: d.getAttribute("aria-label") || (d.getAttribute("aria-labelledby") && document.getElementById(d.getAttribute("aria-labelledby"))?.textContent) || d.className.slice(0, 40),
  state: d.closest("[data-state]")?.getAttribute("data-state") || null, modal: d.getAttribute("aria-modal"),
})));
const focusInfo = page => page.evaluate(() => {
  const a = document.activeElement; if (!a) return null;
  const cs = getComputedStyle(a);
  return { tag: a.tagName, text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40), outline: cs.outlineStyle + " " + cs.outlineWidth + " " + cs.outlineColor, inDialog: !!a.closest('[role="dialog"]') };
});
const text = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.innerText.trim().slice(0, 160)), sel);
function errors(page, name) {
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", e => errs.push("pageerror " + String(e).slice(0, 200)));
  return () => log({ name, consoleErrors: errs.slice(0, 8), n: errs.length });
}
const fail500 = route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Internal" }) });

const SCENES = {};
// A look already made on this device, so the creator doesn't open over everything.
const newCtx = async (browser, opts) => { const c = await browser.newContext(opts); await c.addInitScript(() => { try { if (!localStorage.getItem("tsi.look.v1")) localStorage.setItem("tsi.look.v1", "{}"); } catch {} }); return c; };

// Item 2: the Bag with the bag API at 500, then Try again with the server's own answer.
SCENES.bag = async browser => {
  const ctx = await newCtx(browser, { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const flush = errors(page, "bag");
  await page.route("**/api/collections/bag", fail500);
  await page.goto(BASE + "/lab/island", { waitUntil: "load", timeout: 180000 }); await islandReady(page);
  await page.keyboard.press("i"); await sleep(4000);
  await shot(page, "bag-500");
  log({ name: "bag-500", sheet: await text(page, '[data-testid="bag-sheet"] [role="alert"], [data-testid="bag-sheet"] [role="status"]') });
  const retry = page.getByRole("button", { name: "Try again" });
  log({ name: "bag-500", retryButtons: await retry.count() });
  if (await retry.count()) {
    await page.unroute("**/api/collections/bag");
    await retry.first().click(); await sleep(2500);
    await shot(page, "bag-500-retry");
    log({ name: "bag-500-retry", alert: await text(page, '[data-testid="bag-sheet"] [role="alert"]'), grid: await page.locator('[data-testid="bag-sheet"] ul[aria-label="Your pockets"]').count() });
  }
  flush(); await ctx.close();
};

// Item 2: the storage chest with the bag API at 500.
SCENES.chest = async browser => {
  const ctx = await newCtx(browser, { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); const flush = errors(page, "chest");
  await page.route("**/api/collections/bag", fail500);
  await page.goto(BASE + "/lab/island?home=inside&sheet=chest", { waitUntil: "load", timeout: 180000 }); await islandReady(page);
  await sleep(3000);
  await shot(page, "chest-500");
  log({ name: "chest-500", dialogs: await dialogs(page), alert: await text(page, '[data-testid="chest-sheet"] [role="alert"]'), loading: await text(page, '[data-testid="chest-sheet"] [role="status"]') });
  flush(); await ctx.close();
};

// Item 2 on the phone companion (390 x 844): Me, then the Bag tile, with the bag API at 500.
SCENES.phone = async browser => {
  const ctx = await newCtx(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const flush = errors(page, "phone-bag");
  await page.route("**/api/collections/bag", fail500);
  await page.goto(BASE + "/student/companion?mobile=1", { waitUntil: "load", timeout: 180000 }); await sleep(6000);
  const me = page.getByRole("button", { name: /^Me$/ }).or(page.getByRole("tab", { name: /^Me$/ })).first();
  await me.click().catch(e => log({ name: "phone", meErr: String(e).slice(0, 120) })); await sleep(1500);
  await page.getByRole("button", { name: /^Bag$/ }).first().click().catch(e => log({ name: "phone", bagErr: String(e).slice(0, 120) })); await sleep(4000);
  await shot(page, "phone-bag-500");
  log({ name: "phone-bag-500", alert: await text(page, '[data-testid="bag-sheet"] [role="alert"]') });
  flush(); await ctx.close();
};

// Item 10: the seated start card and the timer (desktop, and the island at 390 wide).
async function study(browser, name, viewport, extra = {}) {
  const ctx = await newCtx(browser, { viewport, ...extra });
  const page = await ctx.newPage(); const flush = errors(page, name);
  await page.goto(BASE + "/lab/island?collections=demo&cafe=inside&study=setup", { waitUntil: "load", timeout: 180000 }); await islandReady(page);
  await sleep(4000);
  await shot(page, name + "-setup");
  log({ name: name + "-setup", dialogs: await dialogs(page), focus: await focusInfo(page) });
  for (let i = 0; i < 2; i++) { await page.keyboard.press("Tab"); await sleep(150); }
  log({ name: name + "-setup-tab2", focus: await focusInfo(page) });
  await shot(page, name + "-setup-tab");
  await page.keyboard.press("Escape");
  const samples = [];
  for (let t0 = Date.now(); Date.now() - t0 < 400;) samples.push([Date.now() - t0, (await dialogs(page)).map(d => d.label + ":" + d.state).join(",") || "none"]);
  log({ name: name + "-setup-esc-frames", samples: samples.filter((x, i) => i === 0 || x[1] !== samples[i - 1][1]) });
  await shot(page, name + "-setup-esc60ms");
  await sleep(1500);
  await shot(page, name + "-setup-esc");
  log({ name: name + "-setup-esc", dialogs: await dialogs(page), prompt: await text(page, "button kbd"), timer: await text(page, '[aria-label="Study timer"]') });
  // The timer.
  await page.goto(BASE + "/lab/island?collections=demo&cafe=inside&study=focus", { waitUntil: "load", timeout: 180000 }); await islandReady(page);
  await sleep(4000);
  await shot(page, name + "-focus");
  log({ name: name + "-focus", buttons: await page.evaluate(() => [...document.querySelectorAll('[aria-label="Study timer"] button')].map(b => ({ text: b.textContent.trim(), cls: b.className.slice(0, 60), font: getComputedStyle(b).fontFamily.slice(0, 40), h: Math.round(b.getBoundingClientRect().height) }))) });
  flush(); await ctx.close();
}
SCENES.study = browser => study(browser, "study", { width: 1280, height: 720 });
SCENES.studyPhone = browser => study(browser, "study-390", { width: 390, height: 844 });

// Item 12: the Gunslinger's gauges in the ruins.
SCENES.gauges = async browser => {
  const ctx = await newCtx(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const flush = errors(page, "gauges");
  await page.goto(BASE + "/lab/island?combat=demo&classes=v2&subclass=gunslinger&mastery=20&traits=all&tamed=all&ruins=1&playtest=1", { waitUntil: "load", timeout: 180000 }); await islandReady(page);
  await sleep(6000);
  await shot(page, "gauges");
  const g = page.locator('[class*="ClassGauges"][class*="gauges"]').first();
  if (await g.count()) {
    const b = await g.boundingBox();
    log({ name: "gauges", box: b, type: await g.evaluate(el => [el, ...el.querySelectorAll("b, small, kbd")].map(e => { const cs = getComputedStyle(e); return `${e.tagName} ${cs.fontSize} ${cs.fontWeight} ${cs.fontFamily.slice(0, 50)}`; })) });
    if (b) await shot(page, "gauges-crop", { x: Math.max(0, b.x - 16), y: Math.max(0, b.y - 16), width: Math.min(1280, b.width + 32), height: b.height + 32 });
  } else log({ name: "gauges", missing: true });
  flush(); await ctx.close();
};

// Item 14: the people button with four loopback bots, the HUD key (H) held for the full HUD.
SCENES.people = async browser => {
  const ctx = await newCtx(browser, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const flush = errors(page, "people");
  await page.goto(BASE + "/lab/island?bots=4", { waitUntil: "load", timeout: 180000 }); await islandReady(page);
  await sleep(4000);
  await page.mouse.move(640, 360);
  await page.keyboard.down("h"); await sleep(800);
  const btn = page.locator('button[aria-label^="People on the island"]').first();
  if (await btn.count()) {
    const b = await btn.boundingBox();
    log({ name: "people", label: await btn.getAttribute("aria-label"), badge: await btn.evaluate(el => [...el.querySelectorAll("b, span")].map(e => { const cs = getComputedStyle(e); return `${e.tagName} "${e.textContent}" ${cs.fontSize} ${cs.backgroundColor}`; })) });
    await shot(page, "people");
    if (b) await shot(page, "people-crop", { x: b.x - 60, y: b.y - 30, width: b.width + 90, height: b.height + 60 });
  } else { log({ name: "people", missing: true }); await shot(page, "people"); }
  await page.keyboard.up("h");
  flush(); await ctx.close();
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  for (const n of (ONLY.length ? ONLY : Object.keys(SCENES))) {
    try { await SCENES[n](browser); } catch (e) { log({ name: n, error: String(e).slice(0, 300) }); }
  }
  await browser.close();
})();
