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

async function open(viewport, { touch = false, look = null, extra = {}, query = "arrival=1&weather=clear&at=14:20" } = {}) {
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
  await page.goto(`${HOST}/lab/island?${query}${touch ? "&touch=1" : ""}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  if (query.includes("arrival=1")) await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
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

/** The guide arrow (t-short): ashore, walk well away from Bram and the arrow at your feet points back to him; then a quest's guide on top of his. */
async function arrow(page, P) {
  const T = page.evaluate.bind(page);
  const go = (x, z, yaw = 0) => T(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
  await T(() => window.__arrival.skip());
  await at(page, "creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at(page, "crossing", 0.6);
  await T(() => window.__arrival.skip());
  await at(page, "tutorial", 1.2);
  await page.waitForFunction(() => window.__bram?.().talkable, null, { timeout: 90000, polling: 50 });
  const b = await T(() => window.__bram());
  const me = await T(() => { const s = window.__move.sim.current.state; return { x: s.x, z: s.z }; });
  await sleep(600);
  await shot(page, `${P}-01-near-bram-no-arrow`);
  // 14 m away from him, inland of where you stand, facing away from him.
  const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz) || 1, far = { x: b.x + dx / d * 14, z: b.z + dz / d * 14 };
  await go(far.x, far.z, Math.atan2(dx, dz) + Math.PI);
  await sleep(1500);
  log.push({ guide: await T(() => window.__guide.now()) });
  await shot(page, `${P}-02-far-arrow-to-bram`);
  await go(far.x, far.z, Math.atan2(dx, dz) + Math.PI * 0.5);
  await sleep(1200);
  await shot(page, `${P}-03-far-arrow-side`);
  // A quest's guide (another lane's call) on top of Bram's.
  await T(([x, z]) => window.__guide.show("quest", { x, z }), [far.x + 30, far.z]);
  await sleep(1200);
  log.push({ guide: await T(() => window.__guide.now()) });
  await shot(page, `${P}-04-quest-guide`);
  await T(() => window.__guide.clear("quest"));
}

/**
 * The new first ten minutes on the new world (t-short, t-hq, t-sell, t-catch), end to end: ashore and the guide arrow
 * when you lose Bram; the dock in the camera conversation; HQ first (his talk at its door, Alice's reworked visit: the
 * lore overlay, the register, the club, real merch, the UI tour, Esc); back out to him: the museum, the café and the
 * shop a line and a shot each; down the wharf, his pauses by the shipwright and the tackle shop; his rod, the first
 * reel's teaching card, the catch; the sell barrel; the end and the tracker after.
 */
async function first10(page, P, part) {
  const T = page.evaluate.bind(page);
  const go = (x, z, yaw = 0) => T(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
  const tut = () => T(() => window.__tutorial?.() ?? null);
  const stage = (stop, st, timeout = 120000) => page.waitForFunction(([i, s]) => { const t = window.__tutorial?.(); return t && (t.done || (t.stop === i && t.stage === s)); }, [stop, st], { timeout, polling: 50 });
  const talkable = (label = "") => page.waitForFunction(() => window.__bram?.().talkable, null, { timeout: 120000, polling: 50 }).catch(e => { throw new Error(`talkable ${label}: ${e}`); });
  const hqWait = (what, timeout = 30000) => page.waitForFunction(w => window.__hq?.()?.waiting === w, what, { timeout, polling: 50 });
  const talking = () => page.$("[data-testid=talk-box]").then(Boolean);
  const walkTo = async (x, z) => { await T(([a, b]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: a, z: b } })), [x, z]); await sleep(2600); };
  /** Through a dialogue-box talk with E, a shot of each line with `every` (named by `names[i]` when given). */
  const talkThrough = async (name, every = false, names = []) => {
    await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
    await sleep(250);
    await shot(page, `${P}-${names[0] ?? name}`);
    const said = [];
    for (let k = 1; k < 14 && await talking(); k++) {
      said.push(await T(() => document.querySelector("[data-testid=talk-box] [aria-live]")?.textContent ?? ""));
      await page.keyboard.press("e"); await sleep(200);
      const ready = await page.waitForSelector("[data-testid=talk-box][data-phase=speaking][data-ready]", { timeout: 6000 }).then(() => true, () => false);
      if (!ready) break;
      if (every) { await sleep(names[k] ? 1300 : 200); await shot(page, `${P}-${names[k] ?? `${name}-${k + 1}`}`); }
    }
    log.push({ talk: name, said });
    await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]"), null, { timeout: 15000 }).catch(() => {});
    await sleep(500);
  };

  // In: the creator's Yes, the crossing skipped, ashore.
  await T(() => window.__arrival.skip());
  await at(page, "creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at(page, "crossing", 0.6);
  await T(() => window.__arrival.skip());
  await at(page, "tutorial", 1.2);
  await page.waitForFunction(() => window.__arrivalStops?.()?.length, null, { timeout: 60000 });
  const stops = await T(() => window.__arrivalStops());
  const where = id => stops.find(s => s.id === id);
  log.push({ stops: stops.map(s => ({ id: s.id, stand: s.stand, via: s.via, shots: s.shots })) });
  await stage(0, "await"); await talkable();
  // Bram's whereabouts every half second (the passing pauses).
  await T(() => { window.__bramLog = []; window.setInterval(() => { const b = window.__bram(), t = window.__tutorial?.(); window.__bramLog.push([+(performance.now() / 1000).toFixed(1), +b.x.toFixed(1), +b.z.toFixed(1), t?.stop, t?.stage, b.talkable ? 1 : 0]); }, 500); });
  // The dock: one E, the camera conversation.
  const dock = where("dock");
  await go(dock.stand.x + 0.9, dock.stand.z - 0.9);
  await sleep(900);
  await shot(page, `${P}-02-dock-mark`);
  await page.keyboard.press("e");
  await talkThrough("03-dock-conversation");
  await stage(0, "task");
  await go(dock.task.at.x, dock.task.at.z);
  await stage(1, "await");
  // HQ first: he walks you to its door.
  await sleep(2500);
  await shot(page, `${P}-04-following-bram-to-hq`);
  const hqStand = where("hqFirst").stand;
  await go(hqStand.x - 1.5, hqStand.z - 1.6);
  await talkable(); await sleep(600);
  await shot(page, `${P}-05-hq-door-mark`);
  await page.keyboard.press("e");
  await talkThrough("06-hq-door-conversation");
  if (part === "a") {
  await stage(1, "task");
  await sleep(600);
  await shot(page, `${P}-07-tracker-alice-visit`);
  // The arrow: wander off 16 m (facing away) and it points back to Bram at HQ's door.
  await go(hqStand.x + 16, hqStand.z + 2, Math.PI * 0.5);
  await sleep(1800);
  log.push({ guide: await T(() => window.__guide.now()) });
  await shot(page, `${P}-01-arrow-points-back-to-bram`);
  await go(hqStand.x + 16, hqStand.z + 2, -Math.PI * 0.15);
  await sleep(1200);
  await shot(page, `${P}-01b-arrow-side-view`);
  const door = await T(() => window.__hqWorld.door);
  await go(door[0], door[1]);
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Enter HQ/.test(b.textContent ?? "")), null, { timeout: 30000, polling: 50 });
  await page.keyboard.press("e");
  await page.waitForFunction(() => document.querySelector("main")?.dataset.inside === "hq", null, { timeout: 30000 });
  await sleep(4500);
  // Alice: the desk, the lore overlay, the register, the club, merch, the UI tour, Esc, the farewell.
  await walkTo(4.6, -7.4);
  await hqWait("wren");
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Talk to Alice/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 });
  await page.keyboard.press("e");
  await talkThrough("08-alice-welcome");
  await page.waitForSelector("[data-testid=hq-lore]", { timeout: 30000 });
  for (let k = 1; k <= 3; k++) { await sleep(700); await shot(page, `${P}-09-lore-${k}`); await page.click("[data-testid=hq-lore-next]"); }
  await talkThrough("10-alice-register");
  await page.waitForSelector("[data-testid=hq-register]", { timeout: 30000 }); await sleep(500);
  await page.click("[data-testid=hq-register-sign]"); await sleep(1100);
  await shot(page, `${P}-11-register-signed`);
  await page.click("[data-testid=hq-register-done]");
  await talkThrough("12-alice-club", true);
  await page.waitForSelector("[data-testid=hq-checkin]", { timeout: 30000 }); await sleep(500);
  await shot(page, `${P}-13-checkin-card`);
  await page.click("[data-testid=hq-checkin-done]");
  await talkThrough("14-alice-merch", true);
  await page.waitForSelector("[data-testid=hq-merch]", { timeout: 30000 }); await sleep(1100);
  await shot(page, `${P}-15-merch-card`);
  await page.click("[data-testid=hq-merch-done]");
  await talkThrough("16-alice-tour");
  await page.waitForSelector("[data-testid=ui-tour]", { timeout: 30000 });
  for (let k = 1; k <= 12; k++) {
    const step = await T(() => document.querySelector("[data-testid=ui-tour]")?.dataset.step ?? null);
    if (!step) break;
    await sleep(700);
    await shot(page, `${P}-17-ui-tour-${String(k).padStart(2, "0")}-${step}`);
    await page.click("[data-testid=ui-tour-next]");
  }
  await talkThrough("18-alice-menu");
  await hqWait("esc");
  await page.keyboard.press("Escape"); await sleep(900);
  await shot(page, `${P}-19-esc-menu`);
  await talkThrough("20-alice-farewell-bram-outside", true);
  log.push({ hq: await T(() => window.__hq?.()) });
  // Out again: he's waiting at the door.
  await walkTo(0, -7.9);
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Island|Exit|Leave/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 }).catch(() => log.push({ exit: "no prompt" }));
  await page.keyboard.press("e");
  await page.waitForFunction(() => !document.querySelector("main")?.dataset.inside, null, { timeout: 30000 });
  await stage(2, "await");
  await sleep(3500);
  await talkable();
  await shot(page, `${P}-21-out-bram-waiting`);
  // The sights: one E, a line and a shot each.
  await page.keyboard.press("e");
  await talkThrough("22-sights", true, ["22-sights-1-two-shot", "23-sights-museum", "24-sights-cafe", "25-sights-shop", "26-sights-follow-me"]);
  await stage(3, "await");
  return;
  }
  // Part b: Alice's visit already done on this account (the device copy): he takes you straight on to the sights.
  await stage(2, "await");
  await go(hqStand.x - 1.5, hqStand.z - 1.6);
  await talkable("sights b"); await sleep(500);
  await page.keyboard.press("e");
  await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 }); await sleep(1500);
  log.push({ twoShot: await T(() => { const s = window.__move.sim.current.state, o = window.__orbit.orbit; return { me: { x: s.x, z: s.z, yaw: s.yaw ?? s.facing ?? null }, bram: window.__bram(), view: { yaw: o.view.yaw, pitch: o.view.pitch, zoom: o.view.zoom }, target: { yaw: o.target.yaw } }; }) });
  await talkThrough("22b-sights-two-shot-facing");
  await stage(3, "await");
  // Down the wharf: his pauses by the shipwright and the tackle shop (we wait by each to see him pass).
  const wharf = where("wharf");
  const [ship, tackle] = wharf.via.filter(w => w.pause);
  await go(ship.x - 3, ship.z - 4, Math.PI * 0.75);
  await page.waitForFunction(([x, z]) => { const b = window.__bram(); return Math.hypot(b.x - x, b.z - z) < 0.4; }, [ship.x, ship.z], { timeout: 90000, polling: 50 }).catch(() => log.push({ ship: "never reached" }));
  await sleep(500);
  await shot(page, `${P}-27-pause-shipwright`);
  await go(tackle.x - 2.5, tackle.z + 3, Math.PI * 0.25);
  await page.waitForFunction(([x, z]) => { const b = window.__bram(); return Math.hypot(b.x - x, b.z - z) < 0.4; }, [tackle.x, tackle.z], { timeout: 60000, polling: 50 }).catch(() => log.push({ tackle: "never reached" }));
  await sleep(500);
  await shot(page, `${P}-28-pause-tackle`);
  // Coming down the quay behind him (from the north), as you would.
  await go(wharf.stand.x - 0.4, wharf.stand.z + 2.2, Math.PI);
  await talkable(); await sleep(500);
  await shot(page, `${P}-29-barrel-mark`);
  await page.keyboard.press("e");
  await talkThrough("30-wharf-conversation");
  await stage(3, "task");
  // His rod out; a cast off the deck toward the water.
  await page.keyboard.down("Tab"); await sleep(500);
  await page.click('[aria-label="Tool wheel"] [role="menuitem"]:not([aria-label="Put away"])', { force: true });
  await page.keyboard.up("Tab"); await sleep(600);
  const yaws = [Math.PI / 2, Math.PI * 0.35, Math.PI * 0.65, 0, Math.PI];
  let caught = false, taught = false;
  for (let tries = 0; tries < yaws.length && !caught; tries++) {
    await go(wharf.stand.x + 0.3, wharf.stand.z, yaws[tries]);
    await T(y => { window.__move.sim.current.state.yaw = y; }, yaws[tries]).catch(() => {});
    await sleep(1000);
    const vp = page.viewportSize();
    await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.down(); await sleep(600); await page.mouse.up();
    const bite = await page.waitForSelector('[data-fishing-overlay="bite"]', { timeout: 25000 }).then(() => true).catch(() => false);
    if (!bite) { log.push({ cast: "no bite", tries }); await page.keyboard.press("Escape").catch(() => {}); await sleep(800); continue; }
    await sleep(140);
    await page.mouse.down(); await sleep(60); await page.mouse.up();
    // The first reel waits on its card: what to hold.
    taught = await page.waitForSelector("[data-testid=reel-teach]", { timeout: 8000 }).then(() => true, () => false);
    await sleep(900);
    await shot(page, `${P}-31-first-reel-teach-card`);
    await reelBot(page);
    await sleep(1500);
    await shot(page, `${P}-32-first-reel-reeling`);
    caught = await page.waitForFunction(() => { const t = window.__tutorial?.(); return t && t.stop >= 4; }, null, { timeout: 60000, polling: 100 }).then(() => true).catch(() => false);
  }
  log.push({ caught, taught });
  await sleep(1800);
  await shot(page, `${P}-33-fish-caught`);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(1800);
  // The barrel.
  await go(wharf.stand.x - 0.4, wharf.stand.z + 1.0, Math.PI);
  await talkable(); await sleep(400);
  await page.keyboard.press("e");
  await talkThrough("34-barrel-conversation", true);
  await stage(4, "task");
  const barrel = await T(() => window.__arrivalStops().find(s => s.id === "barrel").stand);
  await go(barrel.x + 1.0, barrel.z - 0.6);
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Sell/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 }).catch(() => log.push({ sell: "no prompt" }));
  await shot(page, `${P}-35-sell-prompt`);
  await page.keyboard.press("e"); await sleep(1200);
  await shot(page, `${P}-36-sell-open`);
  await page.keyboard.press("Escape"); await sleep(900);
  await shot(page, `${P}-37-end-line`);
  await page.waitForFunction(() => window.__arrival?.state()?.phase !== "tutorial", null, { timeout: 30000 }).catch(() => log.push({ end: "still touring" }));
  await sleep(2500);
  await shot(page, `${P}-38-after-reward-tracker`);
  await page.keyboard.press("Escape").catch(() => {}); await sleep(1200);
  await shot(page, `${P}-39-tracker-next-step`);
  log.push({ bram: await T(() => window.__bramLog) });
}

if (SCENES.includes("first10")) {
  const { page } = await open({ width: 1440, height: 900 }, { extra: { "tsi.camera.v1": CAMERA } });
  try { await first10(page, "20", "a"); } catch (e) { log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400)); await shot(page, "20-zz-failed").catch(() => {}); }
  await page.context().close();
}
if (SCENES.includes("first10b")) {
  const { page } = await open({ width: 1440, height: 900 }, { extra: { "tsi.camera.v1": CAMERA, "tsi.hq.v2": JSON.stringify({ beat: 7, done: true }) } });
  try { await first10(page, "21", "b"); } catch (e) { log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400)); await shot(page, "21-zz-failed").catch(() => {}); }
  log.push({ bram: await page.evaluate(() => window.__bramLog).catch(() => null) });
  await page.context().close();
}
/** Alice's visit on a phone (390 x 844, touch), started at HQ by the dev preview: the lore, the cards and the UI tour in touch words. */
async function hqPhone(page, P) {
  const T = page.evaluate.bind(page);
  const tapPrompt = re => page.locator("main button", { hasText: re }).first().click({ force: true });
  const tapThrough = async name => {
    await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 40000 });
    await sleep(300); await shot(page, `${P}-${name}`);
    for (let k = 0; k < 14 && await page.$("[data-testid=talk-box]"); k++) { await page.click("[data-testid=talk-box]", { force: true }).catch(() => {}); await sleep(450); }
    await sleep(600);
  };
  await page.waitForFunction(() => document.querySelector("main")?.dataset.inside === "hq", null, { timeout: 300000 });
  // No saved look on this browser: the plain creator first; Skip keeps the default look.
  const skip = page.getByRole("button", { name: "Skip", exact: true }).first();
  if (await skip.waitFor({ timeout: 20000 }).then(() => true, () => false)) await skip.click();
  await sleep(5000);
  await T(() => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: 4.6, z: -7.4 } }))); await sleep(2800);
  await tapPrompt(/Talk to Alice/);
  await tapThrough("01-welcome");
  await page.waitForSelector("[data-testid=hq-lore]"); await sleep(700);
  await shot(page, `${P}-02-lore`);
  for (let k = 0; k < 3; k++) { await page.click("[data-testid=hq-lore-next]"); await sleep(500); }
  await tapThrough("03-register-talk");
  await page.click("[data-testid=hq-register-sign]"); await sleep(1100); await shot(page, `${P}-04-register`); await page.click("[data-testid=hq-register-done]");
  await tapThrough("05-club");
  await page.waitForSelector("[data-testid=hq-checkin]"); await sleep(500); await page.click("[data-testid=hq-checkin-done]");
  await tapThrough("06-merch-talk");
  await page.waitForSelector("[data-testid=hq-merch]"); await sleep(1100); await shot(page, `${P}-07-merch`); await page.click("[data-testid=hq-merch-done]");
  await tapThrough("08-tour-talk");
  await page.waitForSelector("[data-testid=ui-tour]");
  for (let k = 1; k <= 12; k++) {
    const step = await T(() => document.querySelector("[data-testid=ui-tour]")?.dataset.step ?? null);
    if (!step) break;
    await sleep(600);
    if (["move", "tools", "quests", "chat"].includes(step)) await shot(page, `${P}-09-tour-${step}`);
    await page.click("[data-testid=ui-tour-next]");
  }
  await sleep(1500);
  await shot(page, `${P}-10-after-tour`);
}

if (SCENES.includes("hq-phone")) {
  const { page } = await open({ width: 390, height: 844 }, { touch: true, query: "hq=inside&hqvisit=1&weather=clear&at=14:20", extra: { "tsi.camera.v1": CAMERA } });
  try { await hqPhone(page, "22"); } catch (e) { log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400)); await shot(page, "22-zz-failed").catch(() => {}); }
  await page.context().close();
}
if (SCENES.includes("arrow")) {
  const { page } = await open({ width: 1440, height: 900 }, { extra: { "tsi.camera.v1": CAMERA } });
  await arrow(page, "10");
  await page.context().close();
}
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
