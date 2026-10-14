// Evidence for the tutorial-v2 lane (specs/playtest-round1.md): the opening aboard Bram's boat, the reflection creator
// (upright face, shirt in frame, the clothes on the rail), eyebrows gone (an old saved look with brows loads cleanly), and
// Bram's walk-along v2 (the "!" stops, the talks, the quest tracker, the beach and the fishing, the B and market lines)
// end to end at desktop and phone sizes. Headless Chromium (WebGL on the GPU through Metal), muted; signed out against the
// dev server with the Supabase env blanked, the shared browser lock held. `?arrival=1` replays the arrival.
//   node specs/evidence/tutorial-v2/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: opening, creator, match, brows, phone-creator, tour (desktop, end to end), tour-phone (390x844, touch, end to end).
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

async function open(viewport, { touch = false, look = null, extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
  const page = await ctx.newPage();
  page.on("pageerror", e => { errors.push(e.message.slice(0, 400)); console.log("pageerror", e.message.slice(0, 400)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) { errors.push(m.text().slice(0, 400)); console.log("console", m.text().slice(0, 400)); } });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([look, extra]) => {
    localStorage.clear();
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    if (look) localStorage.setItem("tsi.look.v1", JSON.stringify(look));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, [look, extra]);
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

if (SCENES.includes("match")) {
  // The back of your head over the side and your reflection are one character from one look: a loud hair colour and a
  // distinct style make it plain (coordinator check, 2026-10-14).
  for (const [name, hair, back] of [["pink-pigtails", 10, "back_pigtails"], ["blue-high-pony", 11, "back_high_pony"]]) {
    const { page } = await open({ width: 1440, height: 900 }, { look: { ...OLD_LOOK, brows: undefined, place: undefined, hair, back, bangs: "bangs_straight" } });
    await toCreator(page);
    await sleep(600);
    await shot(page, `02m-reflection-matches-${name}`);
    await page.context().close();
  }
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

/**
 * The walk-along v2, end to end: in from the creator and the crossing, then each stop with the "!", the talk, the tracker;
 * the dock's crate hopped for real (the autopilot's jump); an empty tool bag until the beach; Bram's rod, a real cast and
 * reel (a bot keeps the bar on the fish); the B and market lines; your collection opened; the end.
 */
async function tour(page, P, touch) {
  const T = page.evaluate.bind(page);
  const tut = () => T(() => window.__tutorial?.() ?? null);
  let stops = [];
  const where = id => stops.find(s => s.id === id);
  const go = (x, z, yaw = 0) => T(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
  const stage = async (stop, st, timeout = 90000) => page.waitForFunction(([i, s]) => { const t = window.__tutorial?.(); return t && (t.done || (t.stop === i && t.stage === s)); }, [stop, st], { timeout, polling: 50 });
  const talkable = () => page.waitForFunction(() => window.__bram?.().talkable && document.querySelector("[data-testid=bram-quest-mark]:not([hidden])"), null, { timeout: 90000, polling: 50 });
  const prompt = () => page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Talk to Bram|Next/.test(b.textContent ?? "")), null, { timeout: 30000, polling: 50 });
  const press = async key => { if (touch && key === "e") { await page.locator("main button", { hasText: /Talk to Bram|Next/ }).first().click({ force: true }); } else await page.keyboard.press(key); };
  /** Talk through a stop, a shot on its first line (and each line with `every`). */
  const talkThrough = async (i, name, every = false) => {
    await prompt();
    await shot(page, `${P}-${name}-prompt`);
    await press("e"); await sleep(650);
    await shot(page, `${P}-${name}-talk`);
    for (let k = 1; k < 6; k++) {
      const t = await tut();
      if (!t || t.done || t.stop !== i || t.stage !== "talk") break;
      await press("e"); await sleep(650);
      if (every) { const u = await tut(); if (u && u.stop === i && u.stage === "talk") await shot(page, `${P}-${name}-talk-${k + 1}`); }
    }
  };

  // In: the creator's Yes, the crossing skipped, ashore.
  await T(() => window.__arrival.skip());
  await at(page, "creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at(page, "crossing", 0.6);
  await T(() => window.__arrival.skip());
  await at(page, "tutorial", 1.2);
  await page.waitForFunction(() => window.__arrivalStops?.()?.length, null, { timeout: 60000 });
  stops = await T(() => window.__arrivalStops());
  log.push({ stops: stops.map(s => ({ id: s.id, stand: s.stand })) });
  await stage(0, "await");
  // The dock: Bram beside the boat with the "!"; the tool bag empty (Tab opens nothing).
  await talkable();
  const me = await T(() => { const s = window.__move.sim.current.state; return { x: s.x, z: s.z }; });
  const dock = where("dock");
  if (Math.hypot(me.x - dock.stand.x, me.z - dock.stand.z) > 2) await go(dock.stand.x + 0.9, dock.stand.z - 0.9);
  await sleep(700);
  await shot(page, `${P}-01-dock-mark`);
  if (!touch) { await page.keyboard.down("Tab"); await sleep(400); }
  const wheel = await T(() => ({ open: !!document.querySelector('[aria-label="Tool wheel"]'), touchButton: !!document.querySelector('[aria-label="Open the tool wheel"]') }));
  if (!touch) await page.keyboard.up("Tab");
  log.push({ emptyBag: wheel }); console.log("empty bag before the beach", JSON.stringify(wheel));
  await talkThrough(0, "02-dock");
  // The crate: Bram hops it, then you do (the autopilot's jump over its lid).
  await stage(0, "task");
  await sleep(1400);
  await shot(page, `${P}-03-crate-bram-hops`);
  const crate = where("dock").task;
  const before = crate.wait[0];
  // A waypoint's `move` happens on the way to the next one: walk to the crate's near side, jump on along to its far side.
  await T(([b, a]) => window.__move.autopilot([{ to: [b.x, b.z], r: 0.2, move: "jump" }, { to: [a.x, a.z + 0.15], r: 0.3 }]), [before, crate.at]);
  await sleep(500);
  await shot(page, `${P}-04-crate-hop`);
  await stage(1, "await", 30000).catch(async () => { log.push({ crate: "autopilot missed; teleported past" }); await go(crate.at.x, crate.at.z); await stage(1, "await"); });
  await T(() => window.__move.autopilot([]));
  await shot(page, `${P}-05-crate-done`);
  // The four fronts: he walks there with the "!", you come, you talk.
  for (const [i, id] of [[1, "museum"], [2, "shop"], [3, "hq"], [4, "cafe"]]) {
    const st = where(id).stand;
    await go(st.x + 1.4, st.z - 1.0);
    await talkable();
    await sleep(500);
    await shot(page, `${P}-${String(5 + i).padStart(2, "0")}-${id}-mark`);
    await talkThrough(i, `${String(5 + i).padStart(2, "0")}-${id}`);
  }
  // The beach: the rod, the Tab glyph, then a real catch.
  const beach = where("beach").stand;
  await go(beach.x + 1.6, beach.z - 0.5);
  await talkable(); await sleep(500);
  await shot(page, `${P}-10-beach-mark`);
  await talkThrough(5, "11-beach", true);
  await stage(5, "task");
  await sleep(500);
  await shot(page, `${P}-12-beach-rod-given`);
  // Take the rod out: the wheel holds it alone.
  if (touch) { await page.click('[aria-label="Open the tool wheel"]'); await sleep(600); }
  else { await page.keyboard.down("Tab"); await sleep(500); }
  const petals = await T(() => [...document.querySelectorAll('[aria-label="Tool wheel"] [role="menuitem"]')].map(b => b.getAttribute("aria-label")));
  log.push({ wheelAfterRod: petals }); console.log("wheel after the rod", JSON.stringify(petals));
  await shot(page, `${P}-13-wheel-rod-only`);
  await page.click('[aria-label="Tool wheel"] [role="menuitem"]:not([aria-label="Put away"])', { force: true });
  if (!touch) await page.keyboard.up("Tab");
  await sleep(600);
  // The water's edge, facing the sea.
  await go(beach.x + 1.6, beach.z - 1.1, Math.PI);
  await sleep(1200);
  let caught = false;
  for (let tries = 0; tries < 4 && !caught; tries++) {
    if (touch) await page.locator("button[data-use]").first().click({ force: true }).catch(() => {});
    else { await page.mouse.move(viewport(page).width / 2, viewport(page).height / 2); await page.mouse.down(); await sleep(600); await page.mouse.up(); }
    const bite = await page.waitForSelector('[data-fishing-overlay="bite"]', { timeout: 25000 }).then(() => true).catch(() => false);
    if (!bite) { log.push({ cast: "no bite", tries }); continue; }
    await sleep(140);
    await reelBot(page);
    if (touch) await page.locator("[data-fishing-overlay]").first().click({ force: true }).catch(() => {});
    else { await page.mouse.down(); await sleep(60); await page.mouse.up(); }
    await sleep(2200);
    await shot(page, `${P}-14-fishing-reel`);
    caught = await page.waitForFunction(() => { const t = window.__tutorial?.(); return t && t.stop >= 6; }, null, { timeout: 30000, polling: 100 }).then(() => true).catch(() => false);
  }
  log.push({ caught });
  await sleep(1500);
  await shot(page, `${P}-15-fish-caught`);
  // What you've collected: the "!" again, the B line, the market line.
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(1800);
  await go(beach.x + 1.6, beach.z - 0.5);
  await talkable(); await sleep(400);
  await shot(page, `${P}-16-collection-mark`);
  await talkThrough(6, "17-collection", true);
  await stage(6, "task");
  await sleep(600);
  await shot(page, `${P}-18-bag-glyph`);
  // Open the collection (B; on a phone the menu's Collection).
  if (touch) { await page.click('[aria-label^="Menu"]').catch(() => {}); await sleep(400); await page.click('[aria-label="Open your collection"]').catch(() => {}); }
  else await page.keyboard.press("b");
  await sleep(1200);
  await shot(page, `${P}-19-collection-open`);
  // Closed again: his last word and a wave, the tracker all ticked; then the walk is over (the reward card).
  if (touch) await page.click('[role="dialog"] button[aria-label^="Close"]').catch(() => page.keyboard.press("Escape"));
  else await page.keyboard.press("Escape");
  await sleep(900);
  await shot(page, `${P}-20-end-line`);
  await page.waitForFunction(() => window.__arrival?.state()?.phase !== "tutorial", null, { timeout: 30000 }).catch(() => log.push({ end: "still touring" }));
  await sleep(1200);
  await shot(page, `${P}-21-end-reward`);
}
const viewport = page => page.viewportSize();
/** Keep the reel's bar on the fish: hold while the fish is ahead of the bar's middle (polish-fishing's bot). */
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
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });

if (SCENES.includes("tour")) {
  const { page } = await open({ width: 1440, height: 900 }, { extra: { "tsi.camera.v1": CAMERA } });
  await tour(page, "05", false);
  await perf(page, "village after the walk");
  await page.context().close();
}
if (SCENES.includes("tour-phone")) {
  const { page } = await open({ width: 390, height: 844 }, { touch: true, extra: { "tsi.camera.v1": CAMERA } });
  await tour(page, "06", true);
  await page.context().close();
}

writeFileSync(`${OUT}/frames-${SCENES.join("-")}.json`, JSON.stringify({ log, errors }, null, 1));
console.log("errors", errors.length);
await browser.close();
