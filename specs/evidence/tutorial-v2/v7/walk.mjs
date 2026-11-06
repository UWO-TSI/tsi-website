// Round 7 evidence for the tutorial-v2 lane (David's round 6 review, 2026-11-02): headless, muted, signed out against a
// dev server with the Supabase env blanked, on the new world. Shots per beat and frame strips (`<name>-fNN.png`;
// v4/strips.py lays them out).
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v7/walk.mjs <out> hq | quest | ui | ui-phone | kit | kit-phone
//
// hq:       the dock cleared, Bram to HQ, Alice's visit: the ID (the show-off slot), then the keyboard card's peeks.
// quest:    free roam signed out: take out the rod, catch a fish, the tracker's step, Juno at the museum takes it.
// ui:       free roam: a toast with library words, the UI view's dock (Esc 1), the bag's rail, the journal.
// kit:      /lab/gui pieces (key-peek, keyword-library, printed-card).
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
  // The show-off slot (round 7): opened, its picks (signed out with nothing caught yet: the empty note).
  if (await page.$("[data-testid=hq-id-showcase]")) {
    await page.click("[data-testid=hq-id-showcase]"); await sleep(900);
    await shot(page, "a-id-showcase-open");
    await page.click("[data-testid=hq-id-showcase]").catch(() => {}); await sleep(500);
  }
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
  const keyOf = { wheel: "Tab", emote: "g", hud: "h", chat: "Enter", bag: "i", collection: "b", quests: "j", map: "m", mail: "l" };
  const card = await page.$eval("[data-testid=ui-tour]", el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  // The card and its peek on the right (the peek sits beside the card).
  const clip = { x: Math.max(0, card.x - 20), y: Math.max(0, card.y - 40), width: Math.min(1440 - Math.max(0, card.x - 20), card.width + 360), height: card.height + 80 };
  for (let k = 1; k <= 10; k++) {
    const step = await page.evaluate(() => document.querySelector("[data-testid=ui-tour]")?.dataset.step ?? null);
    if (!step) break;
    await sleep(300);
    const key = keyOf[step];
    await page.keyboard.down(key);
    await strip(page, `a-peek-${String(k).padStart(2, "0")}-${step}`, 5, 220, clip);
    await page.keyboard.up(key);
    await page.waitForFunction(s => document.querySelector("[data-testid=ui-tour]")?.dataset.step !== s || !document.querySelector("[data-testid=ui-tour]"), step, { timeout: 4000, polling: 50 })
      .catch(() => log.push({ key: step, moved: false }));
    await sleep(1500);
  }
}

/** Free roam, signed out: the rod out, a catch, the tracker's step ticking, Juno taking it. */
async function quest(page) {
  await page.waitForFunction(() => window.__move?.teleport && window.__residents, null, { timeout: 300000, polling: 200 });
  await sleep(4000);
  const tracker = () => page.evaluate(() => document.querySelector("[data-testid=quest-tracker]")?.getAttribute("aria-label") ?? null);
  log.push({ trackerAtStart: await tracker() });
  await shot(page, "q-01-start");
  // The fishing spot: the tutorial's cast stand on the quay (a little past the sell barrel), facing the water.
  const stand = { x: Number(process.env.CAST_X ?? 0), z: Number(process.env.CAST_Z ?? 0) };
  log.push({ stand });
  // The rod: the wheel (Tab) and its first petal that isn't "put away".
  const yaws = [Math.PI / 2, Math.PI * 0.35, Math.PI * 0.65, 0, Math.PI, -Math.PI / 2];
  let caught = false;
  for (let tries = 0; tries < yaws.length && !caught; tries++) {
    await go(page, stand.x, stand.z, yaws[tries]);
    await page.evaluate(y => { window.__move.sim.current.state.yaw = y; }, yaws[tries]).catch(() => {});
    await sleep(1200);
    if (tries === 0) {
      await page.keyboard.down("Tab"); await sleep(500);
      const items = await page.$$eval('[aria-label="Tool wheel"] [role="menuitem"]', els => els.map(e => e.getAttribute("aria-label")));
      log.push({ wheel: items });
      const rod = items.findIndex(n => /rod/i.test(n ?? ""));
      await page.click(`[aria-label="Tool wheel"] [role="menuitem"]:nth-child(${rod + 1})`, { force: true }).catch(() => log.push({ rod: "no rod on the wheel" }));
      await page.keyboard.up("Tab"); await sleep(700);
    }
    await page.mouse.move(720, 450); await page.mouse.down(); await sleep(600); await page.mouse.up();
    const bite = await page.waitForSelector('[data-member-fishing="bite"]', { timeout: 25000 }).then(() => true).catch(() => false);
    if (!bite) { log.push({ cast: "no bite", tries, phase: await page.evaluate(() => document.querySelector("[data-member-fishing]")?.dataset.memberFishing ?? null) }); await sleep(3000); continue; }
    await sleep(140);
    await page.mouse.down(); await sleep(60); await page.mouse.up();
    await page.evaluate(() => {
      let held = false;
      const send = type => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
      const tick = () => {
        const reel = document.querySelector('[aria-label="Fishing reel"]');
        if (!reel) { if (held) send("pointerup"); if (window.__reelSeen) return; return requestAnimationFrame(tick); }
        window.__reelSeen = true;
        const win = reel.querySelector('[class*="window"]')?.getBoundingClientRect(), fish = reel.querySelector('[class*="marker"] > *')?.getBoundingClientRect();
        const want = !!win && !!fish && fish.left + fish.width / 2 > win.left + win.width / 2;
        if (want !== held) { send(want ? "pointerdown" : "pointerup"); held = want; }
        requestAnimationFrame(tick);
      };
      window.__reelSeen = false;
      requestAnimationFrame(tick);
    });
    caught = await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("tsi.collections.local.v1") ?? "{}")).some(k => k.startsWith("fish_")) || !!document.querySelector("[data-testid=reward-card], [data-reward-card]"), null, { timeout: 60000, polling: 200 }).then(() => true).catch(() => false);
  }
  log.push({ caught });
  await sleep(1500);
  await shot(page, "q-02-caught");
  // The catch card's Continue (then any Show me first).
  for (let k = 0; k < 3; k++) { await page.getByRole("button", { name: /Continue|Show me/ }).first().click({ timeout: 4000 }).catch(() => {}); await sleep(900); }
  await sleep(3500);
  log.push({ trackerAfterCatch: await tracker() });
  await strip(page, "q-03-tracker-after-catch", 3, 600);
  // Juno, by the museum's door.
  const juno = await page.evaluate(() => window.__residents().find(r => r.slug === "docent"));
  log.push({ juno });
  if (!juno) return;
  await go(page, juno.x + 1.2, juno.z + 1.2, Math.PI * 0.75);
  await sleep(1500);
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Juno/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 100 }).catch(() => log.push({ juno: "no talk prompt" }));
  await shot(page, "q-04-juno-near");
  await page.keyboard.press("e");
  await talkThrough(page, "juno", ["q-05-juno-1", "q-05-juno-2", "q-05-juno-3", "q-05-juno-4"]);
  await strip(page, "q-06-quest-complete", 8, 300);
  await sleep(2000);
  log.push({ trackerAfterJuno: await tracker() });
  await shot(page, "q-07-after");
}

/** Free roam: the UI text the icons now go through. */
async function ui(page, P) {
  await page.waitForFunction(() => window.__move?.teleport, null, { timeout: 300000, polling: 200 });
  await sleep(5000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "Sold 2 fish at the market for 120 coins. Your bag has room again." } })));
  await sleep(900);
  await shot(page, `${P}-toast`);
  await sleep(5000);
  await page.keyboard.press("Escape"); await sleep(1200);
  await shot(page, `${P}-esc-dock`);
  await page.keyboard.press("Escape"); await sleep(600);
  await page.keyboard.press("Escape"); await sleep(600);
  await page.keyboard.press("i"); await sleep(1800);
  await shot(page, `${P}-bag`);
  await page.keyboard.press("Escape"); await sleep(800);
  await page.keyboard.press("j"); await sleep(1800);
  await shot(page, `${P}-journal`);
  await page.keyboard.press("Escape"); await sleep(800);
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
if (SCENES.includes("quest")) await run("q", quest, {}, FREE);
if (SCENES.includes("ui")) await run("u", ui, {}, FREE);
if (SCENES.includes("ui-phone")) await run("p", ui, {}, FREE, PHONE);
for (const phone of [false, true]) {
  if (!SCENES.includes(phone ? "kit-phone" : "kit")) continue;
  for (const [id, n, every] of [["key-peek", 6, 400], ["keyword-library", 1, 0], ["printed-card", 6, 900]]) {
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
