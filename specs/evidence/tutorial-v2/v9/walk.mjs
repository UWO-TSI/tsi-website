// Round 9 evidence for the tutorial-v2 lane (David's round 8 review, 2026-11-04): headless, muted, signed out against a
// dev server with the Supabase env blanked, on the new world. Shots per beat and frame strips (`<name>-fNN.png`;
// v4/strips.py lays them out).
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v9/walk.mjs <out> hq | ui | ui-phone | kit | kit-phone
//
// hq:       the dock cleared, Bram to HQ, Alice's visit, then the keyboard card: H and M as frames (before the key,
//           above the card, mid-flight, settled), the phone filling app by app, the phone's own key.
// ui:       free roam: Y brings the phone up over play, an app, back, away; Esc's UI view (no title) and its apps.
// ui-phone: the same on a phone screen from the phone button.
// kit:      /lab/gui pieces (phone, key-board).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3172";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(extra = {}, path = "/lab/island?arrival=1&weather=clear&at=14:20", view = DESKTOP) {
  const ctx = await browser.newContext(view);
  const page = await ctx.newPage();
  page.on("pageerror", e => { log.push({ pageerror: e.message.slice(0, 300) }); console.log("pageerror", e.message.slice(0, 300)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION|hydrat/i.test(m.text())) log.push({ console: m.text().slice(0, 300) }); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(x => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, { "tsi.camera.v1": CAMERA, ...extra });
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  return page;
}
async function shot(page, name, clip) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  log.push({ shot: name });
  console.log("shot", name);
}
/** A frame strip: `n` frames `every` ms apart. */
async function strip(page, name, n, every, clip) {
  for (let i = 1; i <= n; i++) { await page.screenshot({ path: `${OUT}/${name}-f${String(i).padStart(2, "0")}.png`, ...(clip ? { clip } : {}) }); if (i < n) await sleep(every); }
  log.push({ strip: name, n, every });
  console.log("strip", name);
}
const at = (page, phase, t) => page.waitForFunction(([p, tt]) => { const s = window.__arrival?.state(); return s && s.phase === p && s.t >= tt; }, [phase, t], { timeout: 300000, polling: 16 });
const T = page => page.evaluate.bind(page);
const go = (page, x, z, yaw = 0) => page.evaluate(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
const talking = page => page.$("[data-testid=talk-box]").then(Boolean);
/** Through a dialogue-box talk with E; a shot of the lines `names` names (index: the line's place). */
async function talkThrough(page, name, names = []) {
  await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
  await sleep(names[0] ? 1300 : 250);
  if (names[0]) await shot(page, names[0]);
  const said = [];
  for (let k = 1; k < 14 && await talking(page); k++) {
    said.push(await page.evaluate(() => document.querySelector("[data-testid=talk-box] [aria-live]")?.textContent ?? ""));
    await page.keyboard.press("e"); await sleep(200);
    const ready = await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]") || !!document.querySelector("[data-testid=talk-box][data-phase=speaking][data-ready]"), null, { timeout: 6000, polling: 30 })
      .then(() => page.$("[data-testid=talk-box]").then(Boolean), () => false);
    if (!ready) break;
    if (names[k]) { await sleep(1300); await shot(page, names[k]); }
  }
  log.push({ talk: name, said });
  await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]"), null, { timeout: 15000 }).catch(() => {});
  await sleep(150);
}

async function hq(page) {
  const stage = (id, st, timeout = 120000) => page.waitForFunction(([i, s]) => { const t = window.__tutorial?.(), stops = window.__arrivalStops?.(); return t && (t.done || (stops?.[t.stop]?.id === i && t.stage === s)); }, [id, st], { timeout, polling: 50 });
  const talkable = () => page.waitForFunction(() => window.__bram?.().talkable, null, { timeout: 120000, polling: 50 });
  const hqWait = (what, timeout = 30000) => page.waitForFunction(w => window.__hq?.()?.waiting === w, what, { timeout, polling: 50 });
  const walkTo = async (x, z) => { await page.evaluate(([a, b]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: a, z: b } })), [x, z]); await sleep(2600); };
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  await page.evaluate(() => window.__arrival.skip());
  await at(page, "creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at(page, "crossing", 0.6);
  await page.evaluate(() => window.__arrival.skip());
  await at(page, "tutorial", 1.2);
  await page.waitForFunction(() => window.__arrivalStops?.()?.length, null, { timeout: 60000 });
  const stops = await page.evaluate(() => window.__arrivalStops());
  const hqStand = stops.find(s => s.id === "hqFirst").stand;
  log.push({ castStand: stops.find(s => s.id === "cast")?.stand, barrelStand: stops.find(s => s.id === "barrel")?.stand });
  await stage("hqFirst", "await");
  await go(page, hqStand.x - 1.5, hqStand.z - 1.6);
  await talkable(); await sleep(600);
  await page.keyboard.press("e");
  await talkThrough(page, "hq-door");
  await stage("hqFirst", "task");
  const door = await page.evaluate(() => window.__hqWorld.door);
  await go(page, door[0], door[1]);
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Enter HQ/.test(b.textContent ?? "")), null, { timeout: 30000, polling: 50 });
  await page.keyboard.press("e");
  await page.waitForFunction(() => document.querySelector("main")?.dataset.inside === "hq", null, { timeout: 30000 });
  await sleep(4500);
  await walkTo(4.6, -7.4);
  await hqWait("wren");
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Talk to Alice/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 });
  await page.keyboard.press("e");
  await talkThrough(page, "alice-welcome");
  await page.waitForSelector("[data-testid=hq-lore]", { timeout: 30000 });
  for (let k = 1; k <= 3; k++) { await sleep(500); await page.click("[data-testid=hq-lore-next]"); }
  await talkThrough(page, "alice-id-ask");
  await page.waitForSelector("[data-testid=hq-id]", { timeout: 30000 }); await sleep(600);
  await page.fill("[data-testid=hq-id-name]", "Marlowe");
  await page.fill("[data-testid=hq-id-birthday]", "2004-03-14");
  await page.fill("[data-testid=hq-id-pronouns]", "they/them");
  await page.fill("[data-testid=hq-id-about]", "Here for the fishing");
  await sleep(2000);
  await page.mouse.move(40, 40);
  await shot(page, "a-id-form");
  await page.click("[data-testid=hq-id-print]");
  await page.waitForSelector("[data-testid=hq-id-done]", { timeout: 8000 }); await sleep(600);
  await page.mouse.move(40, 40);
  await shot(page, "a-id-card");
  await page.click("[data-testid=hq-id-done]");
  await talkThrough(page, "alice-coins");
  await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 }); await sleep(4500);
  await talkThrough(page, "alice-gems");
  await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 }); await sleep(4500);
  await talkThrough(page, "alice-events");
  await page.waitForSelector("[data-testid=hq-checkin]", { timeout: 30000 }); await sleep(600);
  await page.click("[data-testid=hq-checkin-done]");
  await talkThrough(page, "alice-keys");
  await page.waitForSelector("[data-testid=ui-tour]", { timeout: 30000 }); await sleep(700);
  // Signed out there is no wallet; give it some, so the HUD's fly-in carries the real one too.
  await page.evaluate(() => { window.__hudCoins?.(1240); window.__hudGems?.(35); });
  const keyOf = { wheel: "Tab", emote: "g", hud: "h", chat: "Enter", bag: "i", collection: "b", quests: "j", map: "m", mail: "l", phone: "y" };
  const hold = { wheel: 900, emote: 900, hud: 900 };
  for (let k = 1; k <= 11; k++) {
    const step = await page.evaluate(() => document.querySelector("[data-testid=ui-tour]")?.dataset.step ?? null);
    if (!step) break;
    await sleep(300);
    const key = keyOf[step];
    if (step === "hud" || step === "map") {
      // The fly-in as frames: before the key, above the card, mid-flight, settled (FLY_HOME_MS: pop 380, show 1000, fly 760).
      await page.screenshot({ path: `${OUT}/a-${step}-f01.png` });
      const t0 = Date.now(), times = [];
      await page.keyboard.down(key);
      for (const [i, ms] of [[2, 700], [3, 1700], [4, 2900]]) {
        if (step === "hud" && ms > 900 && times.length === 1) await page.keyboard.up(key);
        await sleep(Math.max(0, ms - (Date.now() - t0)));
        times.push(Date.now() - t0);
        await page.screenshot({ path: `${OUT}/a-${step}-f${String(i).padStart(2, "0")}.png` });
      }
      await page.keyboard.up(key);
      log.push({ fly: step, frameMs: times });
    } else {
      await page.keyboard.down(key);
      await sleep(hold[step] ?? 120);
      await page.keyboard.up(key);
      if (step === "collection" || step === "mail" || step === "phone") { await sleep(900); await shot(page, `a-tour-${step}`); }
    }
    await page.waitForFunction(s => document.querySelector("[data-testid=ui-tour]")?.dataset.step !== s || !document.querySelector("[data-testid=ui-tour]"), step, { timeout: 5000, polling: 50 })
      .catch(() => log.push({ key: step, moved: false }));
    await sleep(1500);
  }
  await sleep(1500);
  await shot(page, "a-tour-done");
}

const box = (page, sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x - 24), y: Math.max(0, r.y - 24), width: r.width + 48, height: r.height + 48 }; }).catch(() => null);
const fit = (b, W, H) => b && { x: b.x, y: b.y, width: Math.min(b.width, W - b.x), height: Math.min(b.height, H - b.y) };
async function ui(page, P) {
  await page.waitForFunction(() => window.__move?.teleport, null, { timeout: 300000, polling: 200 });
  await sleep(9000);
  const phone = P === "p", W = phone ? 390 : 1440, H = phone ? 844 : 900;
  const app = async (name, label) => {
    await page.click(`[data-testid=phone] [aria-label^="${label}"]`); await sleep(1500);
    await shot(page, name);
    await page.keyboard.press("Escape"); await sleep(1100);
  };
  if (phone) {
    await page.click('button[aria-label="Phone"]').catch(() => log.push({ phone: "no phone button" }));
    await sleep(1400);
    await shot(page, "p-phone");
    await shot(page, "p-phone-close", fit(await box(page, "[data-testid=phone]"), W, H));
    log.push({ apps: await page.$$eval("[data-testid=phone] .gui button, [data-testid=phone] button", bs => bs.map(b => b.getAttribute("aria-label"))).catch(() => null) });
    await app("p-phone-app-mail", "Mail");
    await shot(page, "p-phone-back");
    await app("p-phone-app-friends", "Friends");
    return;
  }
  // Y over play: the phone alone.
  await page.keyboard.press("y"); await sleep(400);
  await strip(page, "u-phone-in", 3, 140, { x: W - 420, y: H - 480, width: 420, height: 480 });
  await sleep(800);
  await shot(page, "u-phone");
  await shot(page, "u-phone-close", fit(await box(page, "[data-testid=phone]"), W, H));
  log.push({ apps: await page.$$eval("[data-testid=phone] button", bs => bs.map(b => b.getAttribute("aria-label"))).catch(() => null) });
  await app("u-phone-app-quests", "Quests");
  await shot(page, "u-phone-back");
  await page.keyboard.press("y"); await sleep(900);
  await shot(page, "u-phone-away");
  // Esc: the UI view, no title, the phone in the bar's place.
  await page.keyboard.press("Escape"); await sleep(1400);
  await shot(page, "u-esc");
  await shot(page, "u-esc-top-left", { x: 0, y: 0, width: 520, height: 260 });
  await app("u-esc-settings", "Settings");
  await app("u-esc-friends", "Friends");
}

/** Free roam with no saved look: the plain creator comes first (Skip it). */
async function skipCreator(page) {
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.waitFor({ timeout: 90000 }).then(() => skip.click()).catch(() => log.push({ creator: "no skip" }));
  await sleep(1500);
}
const run = async (name, fn, ...args) => {
  const [extra, path, view] = args;
  const page = await open(extra, path, view);
  try { if (path) await skipCreator(page); await fn(page, name); } catch (e) { log.push({ failed: name, error: String(e).slice(0, 400) }); console.log("FAILED", name, String(e).slice(0, 400)); await shot(page, `${name}-zz-failed`).catch(() => {}); }
  await page.context().close();
};
const FREE = "/lab/island?weather=clear&at=14:20";
if (SCENES.includes("hq")) await run("a", hq, { "tsi.dock.cleared": "1" });
if (SCENES.includes("ui")) await run("u", ui, {}, FREE);
if (SCENES.includes("ui-phone")) await run("p", ui, {}, FREE, PHONE);
for (const phone of [false, true]) {
  if (!SCENES.includes(phone ? "kit-phone" : "kit")) continue;
  for (const [id, n, every] of [["phone", 8, 700], ["key-board", 8, 500]]) {
    const ctx = await browser.newContext(phone ? PHONE : { viewport: { width: 1200, height: 760 } });
    const page = await ctx.newPage();
    page.on("pageerror", e => log.push({ kit: id, pageerror: e.message.slice(0, 300) }));
    await page.goto(`${HOST}/lab/gui?only=${id}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(9000);
    if (n === 1) await page.screenshot({ path: `${OUT}/k${phone ? "p" : ""}-${id}.png`, fullPage: true });
    else await strip(page, `k${phone ? "p" : ""}-${id}`, n, every);
    await ctx.close();
  }
}
writeFileSync(`${OUT}/log-${SCENES.join("-")}.json`, JSON.stringify(log, null, 1));
await browser.close();
