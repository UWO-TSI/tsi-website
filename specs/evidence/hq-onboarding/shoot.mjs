// Evidence for the hq-onboarding lane (row 312, specs/hq-onboarding.md), end to end with `?arrival=1`: Bram's walk-along
// (fast, as tutorial-v2 plays it) ending in the hand-off to Wren, the tracker on "Report to Wren at HQ" and a wheel with
// the rod alone; into HQ; each beat of the visit (the desk, the register and what it issued, the real club and the
// check-in card, real life counts, the Founder's desk and its blank plaque, Esc and the map, the notice board and the
// club goals, the farewell) with the tracker at each step; then one tool quest from start to finish (Odile's bug net:
// her offer, the hand-over, "Catch any bug" in the tracker, the net on the wheel, a bug caught, the net yours). Plus an
// existing player's wheel (no arrival: the starters kept). Headless Chromium (WebGL on the GPU through Metal), muted;
// signed out against the dev server with the Supabase env blanked, the shared browser lock held.
//   HOST=http://localhost:3188 node specs/evidence/hq-onboarding/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: flow (desktop 1440x900, the whole thing), existing (an existing player's wheel), phone (the HQ cards at 390x844).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3188";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const log = [];
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });

async function open(viewport, query, { touch = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
  const page = await ctx.newPage();
  page.on("pageerror", e => { errors.push(e.message.slice(0, 400)); console.log("pageerror", e.message.slice(0, 400)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) { errors.push(m.text().slice(0, 400)); console.log("console", m.text().slice(0, 400)); } });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(cam => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.camera.v1", cam); }, CAMERA);
  await page.goto(`${HOST}/lab/island?${query}${touch ? "&touch=1" : ""}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  return { ctx, page };
}
const state = page => page.evaluate(() => ({
  arrival: window.__arrival?.state()?.phase ?? null,
  hq: window.__hq?.() ?? null,
  tracker: document.querySelector("[data-testid=quest-tracker]")?.textContent ?? null,
  prompt: [...document.querySelectorAll("main button, main p[role=status]")].map(b => b.textContent).find(t => /^(E|Tap|Click)/.test(t ?? "")) ?? null,
  heading: document.querySelector("main header h1")?.textContent ?? null,
}));
async function shot(page, name) {
  const s = await state(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push({ name, ...s });
  console.log("shot", name, JSON.stringify({ tracker: s.tracker, prompt: s.prompt, waiting: s.hq?.waiting, cue: s.hq?.cue, quests: s.hq?.quests }).slice(0, 300));
}
const T = (page, fn, arg) => page.evaluate(fn, arg);
/** Wait until the arrival is in `phase` at least `t` s in. */
const at = (page, phase, t) => page.waitForFunction(([p, tt]) => { const s = window.__arrival?.state(); return s && s.phase === p && s.t >= tt; }, [phase, t], { timeout: 300000, polling: 16 });
const go = (page, x, z, yaw = 0) => T(page, ([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
const promptIs = (page, re, timeout = 30000) => page.waitForFunction(src => [...document.querySelectorAll("main button")].some(b => new RegExp(src).test(b.textContent ?? "")), re.source, { timeout, polling: 50 });
const talking = page => page.$("[data-testid=talk-box]").then(Boolean);
/** Through a talk: a shot of its first line (and each with `every`), E on to the end. */
async function talkThrough(page, name, every = false) {
  await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
  await shot(page, name);
  const said = [];
  for (let k = 2; k < 12 && await talking(page); k++) {
    const box = await T(page, () => { const b = document.querySelector("[data-testid=talk-box]"); return { line: b?.querySelector("[aria-live]")?.textContent ?? "", last: /Bye/.test(b?.textContent ?? "") }; });
    said.push(box.line);
    await page.keyboard.press("e"); await sleep(160);
    if (box.last) break;
    const ready = await page.waitForSelector("[data-testid=talk-box][data-phase=speaking][data-ready]", { timeout: 15000 }).then(() => true, () => false);
    if (ready && every) await shot(page, `${name}-${k}`);
  }
  log.push({ talk: name, said });
  await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]"), null, { timeout: 15000 });
  await sleep(400);
}
/** Inside a room: walk to a point (the floor click's walk). */
async function walkTo(page, x, z) {
  await T(page, ([a, b]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: a, z: b } })), [x, z]);
  await sleep(2600);
}
/** No saved look on this browser (and no arrival): the plain creator first; Skip keeps the default look. */
async function skipCreator(page) {
  const skip = page.getByRole("button", { name: "Skip", exact: true }).first();
  if (await skip.waitFor({ timeout: 20000 }).then(() => true, () => false)) await skip.click();
}
const hqWait = (page, what, timeout = 30000) => page.waitForFunction(w => window.__hq?.()?.waiting === w, what, { timeout, polling: 50 });

/** Bram's walk-along, fast (tutorial-v2's tour with the shots it needs here), to the hand-off. */
async function tour(page) {
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  await T(page, () => window.__arrival.skip());
  await at(page, "creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at(page, "crossing", 0.6);
  await T(page, () => window.__arrival.skip());
  await at(page, "tutorial", 1.2);
  await page.waitForFunction(() => window.__arrivalStops?.()?.length, null, { timeout: 60000 });
  const stops = await T(page, () => window.__arrivalStops());
  const where = id => stops.find(s => s.id === id);
  const stage = (stop, st, timeout = 90000) => page.waitForFunction(([i, s]) => { const t = window.__tutorial?.(); return t && (t.done || (t.stop === i && t.stage === s)); }, [stop, st], { timeout, polling: 50 });
  const talkable = () => page.waitForFunction(() => window.__bram?.().talkable, null, { timeout: 90000, polling: 50 });
  const talkBram = async i => {
    await promptIs(page, /Talk to Bram|Next/);
    await page.keyboard.press("e"); await sleep(500);
    for (let k = 0; k < 6; k++) { const t = await T(page, () => window.__tutorial?.()); if (!t || t.done || t.stop !== i || t.stage !== "talk") break; await page.keyboard.press("e"); await sleep(450); }
  };
  await stage(0, "await"); await talkable();
  const dock = where("dock");
  await go(page, dock.stand.x + 0.9, dock.stand.z - 0.9);
  await talkBram(0);
  await stage(0, "task");
  const crate = where("dock").task;
  await go(page, crate.at.x, crate.at.z);
  await stage(1, "await");
  for (const [i, id] of [[1, "museum"], [2, "shop"], [3, "hq"], [4, "cafe"]]) {
    const st = where(id).stand;
    await go(page, st.x + 1.4, st.z - 1.0);
    await talkable(); await talkBram(i);
  }
  const beach = where("beach").stand;
  await go(page, beach.x + 1.6, beach.z - 0.5);
  await talkable(); await talkBram(5);
  await stage(5, "task");
  // The rod out, a real cast and reel (a bot keeps the bar on the fish).
  await page.keyboard.down("Tab"); await sleep(500);
  await page.click('[aria-label="Tool wheel"] [role="menuitem"]:not([aria-label="Put away"])', { force: true });
  await page.keyboard.up("Tab"); await sleep(600);
  await go(page, beach.x + 1.6, beach.z - 1.1, Math.PI);
  await sleep(1200);
  let caught = false;
  for (let tries = 0; tries < 5 && !caught; tries++) {
    const vp = page.viewportSize();
    await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.down(); await sleep(600); await page.mouse.up();
    const bite = await page.waitForSelector('[data-fishing-overlay="bite"]', { timeout: 25000 }).then(() => true).catch(() => false);
    if (!bite) continue;
    await sleep(140);
    await reelBot(page);
    await page.mouse.down(); await sleep(60); await page.mouse.up();
    caught = await page.waitForFunction(() => { const t = window.__tutorial?.(); return t && t.stop >= 6; }, null, { timeout: 30000, polling: 100 }).then(() => true).catch(() => false);
  }
  log.push({ caught });
  await sleep(1500);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(1800);
  await go(page, beach.x + 1.6, beach.z - 0.5);
  await talkable(); await talkBram(6);
  await stage(6, "task");
  await page.keyboard.press("b"); await sleep(1200);
  await page.keyboard.press("Escape");
  // Bram's last word: the hand-off to Wren.
  await sleep(700);
  await shot(page, "01-handoff-bram-end-line");
  await page.waitForFunction(() => window.__arrival?.state()?.phase !== "tutorial", null, { timeout: 30000 }).catch(() => log.push({ end: "still touring" }));
  await sleep(2600);
}
async function reelBot(page) {
  await page.evaluate(() => {
    let held = false, done = false;
    const send = type => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
    const tick = () => {
      if (done) return;
      const reel = document.querySelector('[aria-label="Fishing reel"]');
      if (!reel) { if (held) { send("pointerup"); held = false; } if (window.__reelSeen) { done = true; return; } return requestAnimationFrame(tick); }
      window.__reelSeen = true;
      const track = reel.querySelector('div[style*="height: 46px"]'), bar = track?.querySelector("div"), fish = track?.querySelector("img");
      const b = parseFloat(bar?.style.left ?? "0"), w = parseFloat(bar?.style.width ?? "30"), f = parseFloat(fish?.style.left ?? "50");
      const want = f > b + w * 0.5;
      if (want !== held) { send(want ? "pointerdown" : "pointerup"); held = want; }
      requestAnimationFrame(tick);
    };
    window.__reelSeen = false;
    requestAnimationFrame(tick);
  });
}
/** The tool wheel's petals (opened with Tab, read, closed). */
async function wheel(page, name) {
  await page.keyboard.down("Tab"); await sleep(500);
  const petals = await T(page, () => [...document.querySelectorAll('[aria-label="Tool wheel"] [role="menuitem"]')].map(b => b.getAttribute("aria-label")));
  if (name) await shot(page, name);
  await page.keyboard.up("Tab"); await sleep(400);
  log.push({ wheel: name, petals }); console.log("wheel", name, JSON.stringify(petals));
  return petals;
}

/** The HQ visit with Wren, a shot at each beat and of the tracker at each step. */
async function visit(page, P) {
  // In at the door (the tracker: report to Wren).
  const door = await T(page, () => window.__hqWorld.door);
  await go(page, door[0], door[1]);
  await promptIs(page, /Enter HQ/);
  await sleep(500);
  await shot(page, `${P}-01-hq-door-report-to-wren`);
  await page.keyboard.press("e");
  await page.waitForFunction(() => document.querySelector("main")?.dataset.inside === "hq", null, { timeout: 30000 });
  await sleep(4500);
  await shot(page, `${P}-02-inside-founder-desk-on-back-wall`);
  const perf = await T(page, async () => { window.__perf?.begin(); const t0 = performance.now(); let n = 0; await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return { ms: +((performance.now() - t0) / n).toFixed(2), stats: window.__perf?.end() ?? null }; });
  log.push({ perf: "hq interior with the Founder's desk", ...perf }); console.log("perf hq", JSON.stringify(perf).slice(0, 400));
  // The desk: Wren behind it.
  await walkTo(page, -5.2, -3.4);
  await promptIs(page, /Talk to Wren/);
  await shot(page, `${P}-03-desk-talk-to-wren`);
  await page.keyboard.press("e");
  await talkThrough(page, `${P}-04-wren-welcome`, true);
  // The register: sign as your world name, then the friend code and the mailbox.
  await page.waitForSelector("[data-testid=hq-register]", { timeout: 20000 });
  await sleep(700);
  await shot(page, `${P}-05-register-sign`);
  await page.click("[data-testid=hq-register-sign]");
  await sleep(1400);
  await shot(page, `${P}-06-register-signed-code-mailbox`);
  await page.click("[data-testid=hq-register-done]");
  // The real club and where the check-in code goes.
  await talkThrough(page, `${P}-07-wren-registered-club`, true);
  await page.waitForSelector("[data-testid=hq-checkin]", { timeout: 20000 });
  await sleep(700);
  await shot(page, `${P}-08-checkin-card`);
  await page.click("[data-testid=hq-checkin-done]");
  // Real life counts; then the Founder's desk.
  await talkThrough(page, `${P}-09-wren-real-life-counts`, true);
  await hqWait(page, "founder");
  await sleep(500);
  await shot(page, `${P}-10-tracker-look-at-founder-desk`);
  await walkTo(page, 2.27, 3.8);
  await promptIs(page, /Founder's desk/);
  await shot(page, `${P}-11-founder-desk-prompt`);
  await page.keyboard.press("e");
  await page.waitForSelector("[data-testid=hq-plaque]", { timeout: 20000 });
  await sleep(700);
  await shot(page, `${P}-12-plaque-blank`);
  await page.keyboard.press("Escape");
  // The Founder; then Esc and the map.
  await talkThrough(page, `${P}-13-wren-founder-menu`, true);
  await hqWait(page, "esc");
  await sleep(500);
  await shot(page, `${P}-14-tracker-open-the-menu`);
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-testid=menu-dock]", { timeout: 15000 });
  await hqWait(page, "map");
  await sleep(600);
  await shot(page, `${P}-15-esc-menu-tracker-open-the-map`);
  await page.click('[data-testid=menu-dock] button[aria-label="Map"]');
  await page.waitForSelector("[data-testid=map-sheet]", { timeout: 15000 });
  await sleep(1200);
  await shot(page, `${P}-16-map-open-at-hq`);
  await page.keyboard.press("Escape");
  await sleep(600);
  // The notice board and the club goals.
  await talkThrough(page, `${P}-17-wren-map-board`, true);
  await hqWait(page, "board");
  await sleep(400);
  await shot(page, `${P}-18-tracker-read-the-board`);
  await walkTo(page, 0, 4.2);
  await promptIs(page, /Read the notice board/);
  await page.keyboard.press("e");
  await sleep(1600);
  await shot(page, `${P}-19-notice-board-club-goals`);
  await page.keyboard.press("Escape");
  await talkThrough(page, `${P}-20-wren-goals-farewell`, true);
  await sleep(1200);
  await shot(page, `${P}-21-visit-done-tracker-chapter`);
  // Out again.
  await walkTo(page, 0, -5.2);
  await promptIs(page, /Return to the island/);
  await page.keyboard.press("e");
  await page.waitForFunction(() => !document.querySelector("main")?.dataset.inside, null, { timeout: 30000 });
  await sleep(4000);
}

/** One tool quest, start to finish: Odile's bug net. */
async function netQuest(page, P) {
  await wheel(page, `${P}-01-wheel-before-rod-only`);
  const odile = async () => (await T(page, () => window.__residents?.() ?? [])).find(r => r.slug === "curator" && !r.hidden);
  let o = null;
  for (let i = 0; i < 30 && !o; i++) { o = await odile(); if (!o) await sleep(1000); }
  if (!o) throw new Error("Odile isn't out");
  // Beside her (a nearer sign, the monument's, would take E): each side in turn until her prompt is the one showing.
  let talked = false;
  for (let tries = 0; tries < 16 && !talked; tries++) {
    o = await odile();
    const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][tries % 4];
    await go(page, o.x + dx * 0.95, o.z + dz * 0.95, Math.atan2(-dx, -dz));
    talked = await promptIs(page, /Talk to Odile/, 2500).then(() => true, () => false);
  }
  log.push({ odilePrompt: talked });
  await sleep(300);
  await shot(page, `${P}-02-odile-talk-prompt`);
  await page.keyboard.press("e");
  await talkThrough(page, `${P}-03-odile-offer`, true);
  await sleep(500);
  await shot(page, `${P}-04-net-handed-over-tracker-catch-any-bug`);
  const petals = await wheel(page, `${P}-05-wheel-rod-and-net`);
  // Take the net out and find a bug.
  await page.keyboard.down("Tab"); await sleep(500);
  await page.click('[aria-label="Tool wheel"] [role="menuitem"][aria-label*="net" i]', { force: true }).catch(() => {});
  await page.keyboard.up("Tab"); await sleep(700);
  const bugs = await T(page, () => window.__hqWorld.bugs);
  let netted = false;
  for (const b of bugs) {
    await go(page, b.x + 0.9, b.z + 0.3, -Math.PI / 2);
    const inReach = await page.waitForFunction(() => [...document.querySelectorAll("button[data-use]")].some(e => /Swing the net \(/.test(e.textContent ?? "")), null, { timeout: 2500, polling: 50 }).then(() => true, () => false);
    if (!inReach) continue;
    await shot(page, `${P}-06-bug-in-reach`);
    await page.click("button[data-use]", { force: true });
    netted = await page.waitForFunction(() => window.__hq?.()?.quests?.net === "done", null, { timeout: 8000, polling: 100 }).then(() => true, () => false);
    if (netted) break;
  }
  log.push({ netted, petals });
  await sleep(1500);
  await shot(page, `${P}-07-bug-caught-net-yours`);
  await sleep(2000);
  await shot(page, `${P}-08-after-tracker`);
  await wheel(page, `${P}-09-wheel-net-kept`);
}

process.on("exit", () => writeFileSync(`${OUT}/frames-${SCENES.join("-")}.json`, JSON.stringify({ log, errors }, null, 1)));
if (SCENES.includes("flow")) {
  const { page } = await open({ width: 1440, height: 900 }, "arrival=1&weather=clear&at=14:20");
  await tour(page);
  await sleep(600);
  await shot(page, "02-handoff-tracker-report-to-wren");
  await wheel(page, "03-handoff-wheel-rod-only");
  await visit(page, "10");
  await netQuest(page, "20");
  await page.context().close();
}
if (SCENES.includes("tool")) {
  // The tool quest alone (a new arrival's tools, `?tools=taught`), for a quick check; the flow runs it after the visit.
  const { page } = await open({ width: 1440, height: 900 }, "tools=taught&weather=clear&at=14:20");
  await page.waitForFunction(() => window.__hq, null, { timeout: 300000 });
  await skipCreator(page);
  await sleep(9000);
  await netQuest(page, "50");
  await page.context().close();
}
if (SCENES.includes("existing")) {
  // An existing player (no arrival, no row 312 flag): the starter net and shovel stay on the wheel; Odile talks as ever.
  const { page } = await open({ width: 1440, height: 900 }, "weather=clear&at=14:20");
  await page.waitForFunction(() => window.__hq, null, { timeout: 300000 });
  await skipCreator(page);
  await sleep(9000);
  await wheel(page, "30-existing-player-wheel-keeps-net-and-shovel");
  await page.context().close();
}
if (SCENES.includes("phone")) {
  const { page } = await open({ width: 390, height: 844 }, "hqvisit=1&hq=inside&weather=clear&at=14:20", { touch: true });
  await page.waitForFunction(() => window.__hq?.()?.waiting === "wren", null, { timeout: 300000 });
  await skipCreator(page);
  await sleep(8000);
  await shot(page, "40-phone-hq-tracker-report");
  await walkTo(page, -5.2, -3.4);
  await promptIs(page, /Talk to Wren/);
  await page.locator("main button", { hasText: /Talk to Wren/ }).first().click({ force: true });
  await talkThrough(page, "41-phone-wren-welcome");
  await page.waitForSelector("[data-testid=hq-register]", { timeout: 20000 });
  await sleep(700);
  await page.click("[data-testid=hq-register-sign]");
  await sleep(1400);
  await shot(page, "42-phone-register-signed");
  await page.click("[data-testid=hq-register-done]");
  await talkThrough(page, "43-phone-wren-club");
  await page.waitForSelector("[data-testid=hq-checkin]", { timeout: 20000 });
  await sleep(700);
  await shot(page, "44-phone-checkin-card");
  await page.context().close();
}

writeFileSync(`${OUT}/frames-${SCENES.join("-")}.json`, JSON.stringify({ log, errors }, null, 1));
console.log("errors", errors.length);
await browser.close();
