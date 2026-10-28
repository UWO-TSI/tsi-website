// Round 3 evidence for the tutorial-v2 lane (David's v2 review, 2026-10-27): the first ten minutes on the new world,
// headless, muted, signed out against a dev server with the Supabase env blanked. Shots per beat and frame strips for
// the animated ones (a strip is `<name>-fNN.png`; strips.py lays them out).
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v3/shoot.mjs <out> walk-a | walk-b | kit
//
// walk-a: ashore, the dock (the box, the dash), Bram to HQ, Alice's visit (the lore, the ID, the fly cards, the
//         keyboard tour, Esc, the farewell), back out.
// walk-b: the visit already done on this device (tsi.hq.v3), from the dock straight to the sights, the wharf's pans,
//         the cast and catch, the barrel and the sale, the hand-over cutscene, the quest check, From Bram, the bag.
// kit:    the new kit pieces on /lab/gui (?only=key-board, fly-in, quest-check, printed-card).
//
// Signed out there are no coins, no sale and no friend code: the coin chip is given a balance through the dev hook
// (window.__hudCoins), and the sale is the sell sheet's own event (tsi:sold) sent by hand. Both are logged.
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
  /** Through a dialogue-box talk with E; a shot of the first line, and of each with `every` (named by `names[i]`). */
  const talkThrough = async (name, every = false, names = []) => {
    await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
    await sleep(names[0] ? 1300 : 250);
    await shot(page, `${P}-${names[0] ?? name}`);
    const said = [];
    for (let k = 1; k < 14 && await talking(); k++) {
      said.push(await T(() => document.querySelector("[data-testid=talk-box] [aria-live]")?.textContent ?? ""));
      await page.keyboard.press("e"); await sleep(200);
      // The next line typed out, or the box gone (a card may open straight after it: don't miss it).
      const ready = await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]") || !!document.querySelector("[data-testid=talk-box][data-phase=speaking][data-ready]"), null, { timeout: 6000, polling: 30 })
        .then(() => page.$("[data-testid=talk-box]").then(Boolean), () => false);
      if (!ready) break;
      if (every || names[k]) { await sleep(names[k] ? 1300 : 250); await shot(page, `${P}-${names[k] ?? `${name}-${k + 1}`}`); }
    }
    log.push({ talk: name, said });
    await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]"), null, { timeout: 15000 }).catch(() => {});
    await sleep(150);
  };

  // In: the creator's Yes, the crossing skipped, ashore.
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
  log.push({ stops: stops.map(s => ({ id: s.id, stand: s.stand, auto: s.auto, shots: s.shots })) });
  await stage("dockNew", "await"); await talkable("dock");

  // The dock: the box (jump), then the dash, each with its key held up until you do it.
  const dock = where("dockNew");
  await go(dock.stand.x + 0.9, dock.stand.z - 0.9);
  await sleep(900);
  await page.keyboard.press("e");
  await talkThrough("01-dock-talk", true);
  await stage("dockNew", "task");
  // A real hop: in front of the box, walk on toward it and jump (the camera's way round tried both ways).
  const box = dock.task.at, before = dock.task.wait[0], yaw = Math.atan2(box.x - before.x, box.z - before.z);
  let hopped = false;
  for (const [k, y] of [yaw + Math.PI, yaw].entries()) {
    await go(before.x, before.z, y);
    await sleep(1200);
    if (k === 0) await shot(page, `${P}-02-dock-jump-chip`);
    await page.keyboard.down("w"); await sleep(140); await page.keyboard.press(" ");
    await strip(page, `${P}-03-dock-hop`, 4, 110);
    await sleep(300); await page.keyboard.up("w");
    hopped = await page.waitForFunction(() => { const t = window.__tutorial?.(), s = window.__arrivalStops?.(); return t && s?.[t.stop]?.id !== "dockNew"; }, null, { timeout: 3000, polling: 50 }).then(() => true, () => false);
    if (hopped) break;
  }
  if (!hopped) { log.push({ hop: "teleported over the box" }); await go(box.x, box.z, yaw); }
  log.push({ hopped });
  await stage("dash", "task");
  await sleep(1400);
  await shot(page, `${P}-04-dock-dash-chip`);
  await page.keyboard.down("w"); await sleep(150); await page.keyboard.press("q");
  await strip(page, `${P}-05-dash`, 5, 90);
  await page.keyboard.up("w");
  await stage("hqFirst", "await");
  log.push({ dashUnlocked: await T(() => localStorage.getItem("tsi.moves.v1")) });
  await sleep(1500);
  await shot(page, `${P}-06-after-dash-to-hq`);
  const hqStand = where("hqFirst").stand;
  await go(hqStand.x - 1.5, hqStand.z - 1.6);
  await talkable("hq door"); await sleep(600);
  await page.keyboard.press("e");
  await talkThrough(part === "a" ? "07-hq-door-talk" : "07b-hq-door-talk");

  if (part === "a") {
    await stage("hqFirst", "task");
    // The arrow, smaller and nearer you: wander off and it points back to Bram.
    await go(hqStand.x + 14, hqStand.z + 2, Math.PI * 0.5);
    await sleep(1800);
    await shot(page, `${P}-08-arrow-back-to-bram`);
    await go(hqStand.x + 14, hqStand.z + 2, -Math.PI * 0.15);
    await sleep(1200);
    await shot(page, `${P}-08b-arrow-side`);
    const door = await T(() => window.__hqWorld.door);
    await go(door[0], door[1]);
    await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Enter HQ/.test(b.textContent ?? "")), null, { timeout: 30000, polling: 50 });
    await page.keyboard.press("e");
    await page.waitForFunction(() => document.querySelector("main")?.dataset.inside === "hq", null, { timeout: 30000 });
    await sleep(4500);
    await walkTo(4.6, -7.4);
    await hqWait("wren");
    await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Talk to Alice/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 });
    await page.keyboard.press("e");
    await talkThrough("10-alice-welcome", true);
    // The lore, the island first.
    await page.waitForSelector("[data-testid=hq-lore]", { timeout: 30000 });
    for (let k = 1; k <= 3; k++) { await sleep(800); await shot(page, `${P}-11-lore-${k}`); await page.click("[data-testid=hq-lore-next]"); }
    // Your island ID: the form, then print, the stamp, the card.
    await talkThrough("12-alice-id-ask", true);
    await page.waitForSelector("[data-testid=hq-id]", { timeout: 30000 }); await sleep(600);
    await page.fill("[data-testid=hq-id-name]", "Marlowe");
    await page.fill("[data-testid=hq-id-birthday]", "2004-03-14");
    await page.fill("[data-testid=hq-id-spirit]", "Sea otter");
    await sleep(300);
    await shot(page, `${P}-13-id-form`);
    await page.click("[data-testid=hq-id-print]");
    await strip(page, `${P}-14-id-print-stamp`, 8, 260);
    await page.waitForSelector("[data-testid=hq-id-done]", { timeout: 8000 }); await sleep(500);
    await shot(page, `${P}-15-id-card`);
    await page.click("[data-testid=hq-id-done]");
    // Coins and gems: Alice's lines, then each flies to its slot (the coin chip has a balance through the dev hook).
    await T(() => window.__hudCoins?.(1240));
    log.push({ coins: "the HUD's coins set to 1240 through window.__hudCoins (signed out has none)" });
    await talkThrough("16-alice-coins", true);
    await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 });
    await strip(page, `${P}-17-fly-coins`, 9, 300);
    await talkThrough("18-alice-gems", true);
    await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 });
    await strip(page, `${P}-19-fly-gems`, 9, 300);
    // The gatherings' check-in.
    await talkThrough("20-alice-events", true);
    await page.waitForSelector("[data-testid=hq-checkin]", { timeout: 30000 }); await sleep(600);
    await shot(page, `${P}-21-checkin-card`);
    await page.click("[data-testid=hq-checkin-done]");
    // The menu, mail and the minimap fly to their places.
    for (const [n, name] of [["22", "menu"], ["24", "mail"], ["26", "minimap"]]) {
      await talkThrough(`${n}-alice-${name}`);
      await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 });
      await strip(page, `${P}-${Number(n) + 1}-fly-${name}`, 9, 300);
    }
    // The keyboard: press or hold each lit key for real.
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
      } else {
        await page.keyboard.press(key);
        if (k === 5) await strip(page, `${P}-30b-keys-press`, 4, 140);
      }
      await page.waitForFunction(s => document.querySelector("[data-testid=ui-tour]")?.dataset.step !== s || !document.querySelector("[data-testid=ui-tour]"), step, { timeout: 4000, polling: 50 })
        .catch(() => log.push({ key: step, moved: false }));
      await sleep(300);
    }
    await talkThrough("31-alice-menu");
    await hqWait("esc");
    await page.keyboard.press("Escape"); await sleep(900);
    await shot(page, `${P}-32-esc-menu`);
    await talkThrough("33-alice-farewell", true);
    log.push({ hq: await T(() => window.__hq?.()) });
    await walkTo(0, -7.9);
    await page.keyboard.press("e");
    await page.waitForFunction(() => !document.querySelector("main")?.dataset.inside, null, { timeout: 30000 });
    await stage("sights", "await");
    await sleep(3500);
    await shot(page, `${P}-34-out-bram-waiting`);
    return;
  }

  // Part b: the visit's done on this device; he takes you straight on to the sights.
  await stage("sights", "await");
  await go(hqStand.x - 1.5, hqStand.z - 1.6);
  await talkable("sights"); await sleep(500);
  await page.keyboard.press("e");
  await talkThrough("40-sights", false, ["40-sights-1-two-shot", "41-sights-museum", "42-sights-cafe", "43-sights-shop", "44-sights-follow-me"]);
  // The wharf: the tackle shop and the shipwright's, panned the same way.
  await stage("wharf", "await");
  const wharf = where("wharf");
  await go(wharf.stand.x - 1.2, wharf.stand.z - 1.2);
  await talkable("wharf"); await sleep(500);
  await shot(page, `${P}-45-wharf-mark`);
  await page.keyboard.press("e");
  await talkThrough("46-wharf", false, ["46-wharf-1-two-shot", "47-wharf-tackle-shop", "48-wharf-shipwright", "49-wharf-to-the-edge"]);
  // The edge: his rod, the first reel's card, the catch.
  await stage("cast", "await");
  const cast = where("cast");
  await go(cast.stand.x - 0.4, cast.stand.z + 2.2, Math.PI);
  await talkable("cast"); await sleep(500);
  await page.keyboard.press("e");
  await talkThrough("50-cast-talk", true);
  await stage("cast", "task");
  await page.keyboard.down("Tab"); await sleep(500);
  await page.click('[aria-label="Tool wheel"] [role="menuitem"]:not([aria-label="Put away"])', { force: true });
  await page.keyboard.up("Tab"); await sleep(600);
  const yaws = [Math.PI / 2, Math.PI * 0.35, Math.PI * 0.65, 0, Math.PI];
  let caught = false;
  for (let tries = 0; tries < yaws.length && !caught; tries++) {
    await go(cast.stand.x + 0.3, cast.stand.z, yaws[tries]);
    await T(y => { window.__move.sim.current.state.yaw = y; }, yaws[tries]).catch(() => {});
    await sleep(1000);
    await page.mouse.move(720, 450); await page.mouse.down(); await sleep(600); await page.mouse.up();
    const bite = await page.waitForSelector('[data-fishing-overlay="bite"]', { timeout: 25000 }).then(() => true).catch(() => false);
    if (!bite) { log.push({ cast: "no bite", tries }); await page.keyboard.press("Escape").catch(() => {}); await sleep(800); continue; }
    await sleep(140);
    await page.mouse.down(); await sleep(60); await page.mouse.up();
    await page.waitForSelector("[data-testid=reel-teach]", { timeout: 8000 }).catch(() => log.push({ reelTeach: "not seen" }));
    await sleep(900);
    await shot(page, `${P}-51-first-reel-teach`);
    await page.evaluate(() => {
      let held = false;
      const send = type => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
      const tick = () => {
        const reel = document.querySelector('[aria-label="Fishing reel"]');
        if (!reel) { if (held) send("pointerup"); if (window.__reelSeen) return; return requestAnimationFrame(tick); }
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
    caught = await page.waitForFunction(() => { const t = window.__tutorial?.(), s = window.__arrivalStops?.(); return t && s?.[t.stop]?.id === "barrel"; }, null, { timeout: 60000, polling: 100 }).then(() => true).catch(() => false);
  }
  log.push({ caught });
  await sleep(1800);
  await shot(page, `${P}-52-fish-caught`);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(1800);
  // The barrel: his talk, then the sale.
  const barrelStop = where("barrel");
  await go(barrelStop.stand.x - 0.4, barrelStop.stand.z + 1.0, Math.PI);
  await talkable("barrel"); await sleep(400);
  await page.keyboard.press("e");
  await talkThrough("53-barrel-talk", true);
  await stage("barrel", "task");
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Sell/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 }).catch(() => log.push({ sell: "no prompt" }));
  await shot(page, `${P}-54-sell-prompt`);
  await page.keyboard.press("e"); await sleep(1200);
  await shot(page, `${P}-55-sell-open`);
  await T(() => window.dispatchEvent(new CustomEvent("tsi:sold", { detail: { key: "evidence", paid: 0 } })));
  log.push({ sale: "signed out: the sell sheet's tsi:sold sent by hand" });
  await page.keyboard.press("Escape"); await sleep(400);
  // The hand-over, straight on: his talk, the camera close on him holding out the rod.
  await talkThrough("56-keep", false, ["56-keep-1-congrats", "57-keep-2-done", "58-keep-3-rod-close"]);
  // The quest check, then From Bram and the rod into the bag.
  await strip(page, `${P}-59-quest-check-gift-bag`, 12, 260);
  await sleep(1500);
  await shot(page, `${P}-60-after-tracker`);
}

if (SCENES.includes("walk-a")) {
  const page = await open();
  try { await walk(page, "a", "a"); } catch (e) { log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400)); await shot(page, "a-zz-failed").catch(() => {}); }
  await page.context().close();
}
if (SCENES.includes("walk-b")) {
  const page = await open({ "tsi.hq.v3": JSON.stringify({ beat: 11, done: true }) });
  try { await walk(page, "b", "b"); } catch (e) { log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400)); await shot(page, "b-zz-failed").catch(() => {}); }
  await page.context().close();
}
if (SCENES.includes("kit")) {
  for (const [id, n, every] of [["key-board", 8, 400], ["fly-in", 10, 300], ["quest-check", 8, 220], ["printed-card", 8, 350]]) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
    const page = await ctx.newPage();
    await page.goto(`${HOST}/lab/gui?only=${id}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    // The stand-in world behind the overlays loads first.
    await sleep(9000);
    await strip(page, `k-${id}`, n, every);
    await ctx.close();
  }
}
writeFileSync(`${OUT}/log-${SCENES.join("-")}.json`, JSON.stringify(log, null, 1));
await browser.close();
