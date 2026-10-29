// Round 5 evidence for the tutorial-v2 lane (David's v4 review, 2026-10-29): headless, muted, signed out against a dev
// server with the Supabase env blanked, on the new world. Shots per beat and frame strips for the animated ones (a strip
// is `<name>-fNN.png`; v4/strips.py lays them out).
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v5/shoot.mjs <out> hq | sights | kit
//
// hq:     the dock already cleared, Bram to HQ, Alice's visit: the wallet sliding in at rest on a change, the ID's print
//         (clipped at the slot), coins and gems flying into the wallet's slot, the light keyboard card, Esc 1's UI view.
// sights: the visit done on this device, the sights' and the wharf's lines with their keyword icons.
// kit:    the kit pieces on /lab/gui (?only=key-board, wallet, fly-in, keyword, printed-card).
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

async function open(extra = {}, path = "/lab/island?arrival=1&weather=clear&at=14:20") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => { log.push({ pageerror: e.message.slice(0, 300) }); console.log("pageerror", e.message.slice(0, 300)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) log.push({ console: m.text().slice(0, 300) }); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(x => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, { "tsi.camera.v1": CAMERA, ...extra });
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  return page;
}
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const t = await page.evaluate(() => window.__tutorial?.() ?? null).catch(() => null);
  log.push({ shot: name, stop: t?.stop, stage: t?.stage });
  console.log("shot", name);
}
/** A frame strip: `n` frames `every` ms apart. */
async function strip(page, name, n, every) {
  for (let i = 1; i <= n; i++) { await page.screenshot({ path: `${OUT}/${name}-f${String(i).padStart(2, "0")}.png` }); if (i < n) await sleep(every); }
  log.push({ strip: name, n, every });
  console.log("strip", name);
}
const at = (page, phase, t) => page.waitForFunction(([p, tt]) => { const s = window.__arrival?.state(); return s && s.phase === p && s.t >= tt; }, [phase, t], { timeout: 300000, polling: 16 });

async function walk(page, P, part) {
  const T = page.evaluate.bind(page);
  const go = (x, z, yaw = 0) => T(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
  const stage = (id, st, timeout = 120000) => page.waitForFunction(([i, s]) => { const t = window.__tutorial?.(), stops = window.__arrivalStops?.(); return t && (t.done || (stops?.[t.stop]?.id === i && t.stage === s)); }, [id, st], { timeout, polling: 50 })
    .catch(e => { throw new Error(`stage ${id}:${st}: ${String(e).slice(0, 120)}`); });
  const talkable = (label = "") => page.waitForFunction(() => window.__bram?.().talkable, null, { timeout: 120000, polling: 50 }).catch(e => { throw new Error(`talkable ${label}: ${e}`); });
  const hqWait = (what, timeout = 30000) => page.waitForFunction(w => window.__hq?.()?.waiting === w, what, { timeout, polling: 50 });
  const talking = () => page.$("[data-testid=talk-box]").then(Boolean);
  const walkTo = async (x, z) => { await T(([a, b]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: a, z: b } })), [x, z]); await sleep(2600); };
  /** Through a dialogue-box talk with E; a shot of each line (`every`), or of the ones `names` names. */
  const talkThrough = async (name, every = false, names = []) => {
    await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
    await sleep(names[0] ? 1300 : 250);
    if (every || names[0]) await shot(page, `${P}-${names[0] ?? name}`);
    const said = [];
    for (let k = 1; k < 14 && await talking(); k++) {
      said.push(await T(() => document.querySelector("[data-testid=talk-box] [aria-live]")?.textContent ?? ""));
      await page.keyboard.press("e"); await sleep(200);
      const ready = await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]") || !!document.querySelector("[data-testid=talk-box][data-phase=speaking][data-ready]"), null, { timeout: 6000, polling: 30 })
        .then(() => page.$("[data-testid=talk-box]").then(Boolean), () => false);
      if (!ready) break;
      if (every || names[k]) { await sleep(names[k] ? 1300 : 250); await shot(page, `${P}-${names[k] ?? `${name}-${k + 1}`}`); }
    }
    log.push({ talk: name, said });
    await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]"), null, { timeout: 15000 }).catch(() => {});
    await sleep(150);
  };

  // In: the creator's Yes, the crossing skipped, ashore (the dock cleared: its lessons passed over).
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  await T(() => window.__arrival.skip());
  await at(page, "creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at(page, "crossing", 0.6);
  await T(() => window.__arrival.skip());
  await at(page, "tutorial", 1.2);
  await page.waitForFunction(() => window.__arrivalStops?.()?.length, null, { timeout: 60000 });
  const stops = await T(() => window.__arrivalStops());
  const where = id => stops.find(s => s.id === id);
  const hqStand = where("hqFirst").stand;

  if (part === "hq") {
    await stage("hqFirst", "await");
    await go(hqStand.x - 1.5, hqStand.z - 1.6);
    await talkable("hq door"); await sleep(600);
    await page.keyboard.press("e");
    await talkThrough("07-hq-door-talk");
    await stage("hqFirst", "task");
    const door = await T(() => window.__hqWorld.door);
    await go(door[0], door[1]);
    await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Enter HQ/.test(b.textContent ?? "")), null, { timeout: 30000, polling: 50 });
    await page.keyboard.press("e");
    await page.waitForFunction(() => document.querySelector("main")?.dataset.inside === "hq", null, { timeout: 30000 });
    await sleep(4500);
    // The wallet at rest: signed out there's none, so a balance through the dev hooks; the change slides it into its
    // slot under the time for about 2 s, then it slides away.
    await T(() => { window.__hudCoins?.(1240); window.__hudGems?.(35); });
    log.push({ wallet: "coins 1240 and gems 35 set through window.__hudCoins / __hudGems (signed out has none)" });
    await strip(page, `${P}-09-wallet-at-rest`, 8, 400);
    await walkTo(4.6, -7.4);
    await hqWait("wren");
    await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Talk to Alice/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 });
    await page.keyboard.press("e");
    await talkThrough("10-alice-welcome");
    await page.waitForSelector("[data-testid=hq-lore]", { timeout: 30000 });
    for (let k = 1; k <= 3; k++) { await sleep(500); await page.click("[data-testid=hq-lore-next]"); }
    // The ID: written on, then printed out of the slot (clipped at its line: nothing before it), the stamp, the card.
    await talkThrough("12-alice-id-ask");
    await page.waitForSelector("[data-testid=hq-id]", { timeout: 30000 }); await sleep(600);
    await page.fill("[data-testid=hq-id-name]", "Marlowe");
    await page.fill("[data-testid=hq-id-birthday]", "2004-03-14");
    await page.fill("[data-testid=hq-id-from]", "Halifax");
    await page.fill("[data-testid=hq-id-about]", "Here for the fishing");
    await sleep(2500);
    await page.mouse.move(40, 40);
    await shot(page, `${P}-13-id-form`);
    await page.click("[data-testid=hq-id-print]");
    await strip(page, `${P}-14-id-print`, 12, 110);
    await strip(page, `${P}-14b-id-stamp`, 6, 220);
    await page.waitForSelector("[data-testid=hq-id-done]", { timeout: 8000 }); await sleep(600);
    await shot(page, `${P}-15-id-card`);
    await page.click("[data-testid=hq-id-done]");
    // Coins and gems: Alice's lines (keyword icons), then each flies into its cell in the wallet under the time.
    await talkThrough("18-alice-coins", true);
    await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 });
    await strip(page, `${P}-19-fly-coins`, 16, 260);
    await talkThrough("20-alice-gems", true);
    await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 });
    await strip(page, `${P}-21-fly-gems`, 16, 260);
    await talkThrough("22-alice-events");
    await page.waitForSelector("[data-testid=hq-checkin]", { timeout: 30000 }); await sleep(600);
    await page.click("[data-testid=hq-checkin-done]");
    // The keyboard card: press or hold each lit key for real; each brings its part of the screen in.
    await talkThrough("28-alice-keys");
    await page.waitForSelector("[data-testid=ui-tour]", { timeout: 30000 }); await sleep(700);
    const keyOf = { wheel: "Tab", emote: "g", hud: "h", chat: "Enter", bag: "i", collection: "b", quests: "j", map: "m", mail: "l" };
    for (let k = 1; k <= 10; k++) {
      const step = await T(() => document.querySelector("[data-testid=ui-tour]")?.dataset.step ?? null);
      if (!step) break;
      await sleep(300);
      await shot(page, `${P}-29-keys-${String(k).padStart(2, "0")}-${step}`);
      const key = keyOf[step], hold = ["wheel", "emote", "hud"].includes(step);
      if (hold) {
        await page.keyboard.down(key);
        if (k === 1) await strip(page, `${P}-30-keys-hold`, 5, 160); else await sleep(850);
        await page.keyboard.up(key);
      } else await page.keyboard.press(key);
      if (step === "hud" || step === "bag") await strip(page, `${P}-31-keys-pop-${step}`, 3, 150);
      await page.waitForFunction(s => document.querySelector("[data-testid=ui-tour]")?.dataset.step !== s || !document.querySelector("[data-testid=ui-tour]"), step, { timeout: 4000, polling: 50 })
        .catch(() => log.push({ key: step, moved: false }));
      await sleep(300);
    }
    // Esc 1, the UI view: the wallet rests in its slot under the time.
    await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 }); await sleep(400);
    await page.keyboard.press("Escape"); await sleep(1200);
    await shot(page, `${P}-33-esc-ui-view-wallet`);
    log.push({ hq: await T(() => window.__hq?.()) });
    return;
  }

  // The sights: the visit's done on this device; past his word at HQ's door he takes you straight on.
  await stage("hqFirst", "await");
  await go(hqStand.x - 1.5, hqStand.z - 1.6);
  await talkable("hq door"); await sleep(600);
  await page.keyboard.press("e");
  await talkThrough("07b-hq-door-talk");
  await stage("sights", "await");
  await go(hqStand.x - 1.5, hqStand.z - 1.6);
  await talkable("sights"); await sleep(500);
  await page.keyboard.press("e");
  await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
  await page.keyboard.press("e");
  await page.waitForFunction(() => /museum/.test(document.querySelector("[data-testid=talk-box] [aria-live]")?.textContent ?? ""), null, { timeout: 10000, polling: 50 });
  await sleep(2600);
  await shot(page, `${P}-40-sights-museum`);
  await talkThrough("41-sights", false, [null, "41-sights-cafe", "42-sights-shop"]);
  await stage("wharf", "await");
  const wharf = where("wharf");
  await go(wharf.stand.x - 1.2, wharf.stand.z - 1.2);
  await talkable("wharf"); await sleep(500);
  await page.keyboard.press("e");
  await talkThrough("44-wharf", false, ["44-wharf-market", "45-wharf-tackle-shop", "46-wharf-shipwright"]);
}

if (SCENES.includes("hq")) {
  const page = await open({ "tsi.dock.cleared": "1" });
  try { await walk(page, "a", "hq"); } catch (e) { log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400)); await shot(page, "a-zz-failed").catch(() => {}); }
  await page.context().close();
}
if (SCENES.includes("sights")) {
  const page = await open({ "tsi.hq.v4": JSON.stringify({ beat: 8, done: true }), "tsi.dock.cleared": "1" });
  try { await walk(page, "b", "sights"); } catch (e) { log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400)); await shot(page, "b-zz-failed").catch(() => {}); }
  await page.context().close();
}
if (SCENES.includes("kit")) {
  for (const [id, n, every] of [["key-board", 8, 400], ["wallet", 8, 700], ["fly-in", 12, 300], ["keyword", 6, 150], ["printed-card", 9, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
    const page = await ctx.newPage();
    await page.goto(`${HOST}/lab/gui?only=${id}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(9000);
    await strip(page, `k-${id}`, n, every);
    await ctx.close();
  }
}
writeFileSync(`${OUT}/log-${SCENES.join("-")}.json`, JSON.stringify(log, null, 1));
await browser.close();
