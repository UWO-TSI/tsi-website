// Round 12 evidence for the tutorial-v2 lane (David's rounds 9 to 11 reviews, 2026-11-04): headless, muted, signed out
// against a dev server with the Supabase env blanked, on the new world. Each scene records a video (clips.json says
// where each beat starts and ends in it; clips.py cuts them to mp4 with a poster), plus stills.
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v12/walk.mjs <out> ui | ui-phone | hq | reduced | smooth
//
// ui:       a desktop (1440x900): X pulls the phone out and flips it open; the cursor moves round and it leans; the
//           screen close up, a hovered app, the keyboard's pick; an app opens and back; X puts it away; the corner
//           opens it and closes it; Settings' key list.
// ui-phone: a phone screen (390x844 at 2x) from the phone button: the motion, the screen, an app and back.
// hq:       the dock cleared, Bram to HQ, Alice's visit, then her keyboard card: the HUD step playing by itself (frames),
//           and the phone step (the phone put away, then X).
// reduced:  reduced motion: it appears open, no motion.  smooth: the pixel finish off.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3172";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const log = [], clips = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const FREE = "/lab/island?weather=clear&at=14:20";

let t0 = 0, video = "";
const now = () => (Date.now() - t0) / 1000;
/** A clip of the scene's video: from now until `end()`. */
const clip = (id, crop) => { const c = { id, video, from: now(), crop }; clips.push(c); return () => { c.to = now(); }; };

async function open(name, view, extra = {}, path = FREE) {
  const ctx = await browser.newContext({ ...view, recordVideo: { dir: `${OUT}/video-${name}`, size: view.viewport } });
  const page = await ctx.newPage();
  t0 = Date.now(); video = name;
  page.on("pageerror", e => { log.push({ pageerror: e.message.slice(0, 300) }); console.log("pageerror", e.message.slice(0, 300)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION|hydrat/i.test(m.text())) log.push({ console: m.text().slice(0, 300) }); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([c, x]) => {
    localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.camera.v1", c);
    for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
  }, [CAMERA, extra]);
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  return page;
}
async function free(page) {
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.waitFor({ timeout: 90000 }).then(() => skip.click()).catch(() => log.push({ creator: "no skip" }));
  await page.waitForFunction(() => window.__move?.teleport, null, { timeout: 300000, polling: 200 });
  await sleep(9000);
  await page.evaluate(() => { window.__hudCoins?.(1240); window.__hudGems?.(35); });
}
async function shot(page, name, area) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(area ? { clip: area } : {}) });
  log.push({ shot: name }); console.log("shot", name);
}
/** Frames at these times (ms) from now, as fast as the page gives them. */
async function frames(page, name, times, area) {
  const s = Date.now(), got = [];
  for (const [i, t] of times.entries()) {
    await sleep(Math.max(0, t - (Date.now() - s)));
    got.push(Date.now() - s);
    await page.screenshot({ path: `${OUT}/${name}-f${String(i + 1).padStart(2, "0")}.png`, ...(area ? { clip: area } : {}) });
  }
  log.push({ frames: name, ms: got }); console.log("frames", name);
}
const box = (page, sel, pad = 20) => page.$eval(sel, (el, p) => { const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.width + 2 * p, height: r.height + 2 * p }; }, pad).catch(() => null);
const fit = (b, W, H) => b && { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(Math.min(b.width, W - b.x)), height: Math.round(Math.min(b.height, H - b.y)) };
const centre = (page, sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
/** The phone's box, its canvas's pixels against its CSS size, the world's, and the wallet's slot. */
const rects = async (page, tag) => log.push({ tag, rects: await page.evaluate(() => {
  const r = s => { const b = document.querySelector(s)?.getBoundingClientRect(); return b && [b.left, b.top, b.right, b.bottom].map(v => Math.round(v)); };
  const c = document.querySelector("[data-testid=phone] canvas"), w = document.querySelector("[role=application] canvas, canvas[role=application]");
  return {
    window: [innerWidth, innerHeight, devicePixelRatio], phone: r("[data-testid=phone]"), wallet: r("[data-hud-wallet]"), settings: r('[data-testid=phone] [aria-label="Settings"]'),
    phoneCanvas: c && [c.width, c.height, c.clientWidth, c.clientHeight, getComputedStyle(c).imageRendering], world: w && [w.width, w.height, w.clientWidth, w.clientHeight],
  };
}) });

async function ui(page, P) {
  await free(page);
  const phone = P === "p", W = phone ? 390 : 1440, H = phone ? 844 : 900;
  const corner = phone ? { x: 0, y: 0, width: W, height: H } : { x: W - 520, y: H - 640, width: 520, height: 640 };
  const up = () => (phone ? page.click('button[aria-label="Phone"]') : page.keyboard.press("x"));
  await page.mouse.move(W * 0.4, H * 0.45);
  // Clips first, with no screenshots inside them (a screenshot stalls the video); the stills come from second takes.
  let end = clip(`${P}-open`, corner);
  await up(); await sleep(2200); end();
  if (!phone) {
    end = clip(`${P}-away`, corner);
    await page.keyboard.press("x"); await sleep(1600); end();
    await page.keyboard.press("x");
    await frames(page, `${P}-open`, [0, 150, 300, 450, 600, 750, 900, 1100, 1400], corner);
    await sleep(800);
  }
  await rects(page, `${P}-open`);
  await shot(page, `${P}-phone`);
  await shot(page, `${P}-phone-close`, fit(await box(page, "[data-testid=phone]", 0), W, H));
  const screen = () => box(page, "[data-testid=phone] nav", 8).then(b => fit(b, W, H));
  if (!phone) {
    // The lean: the cursor goes round the window; the phone and its screen tilt with it.
    end = clip(`${P}-tilt`, corner);
    for (const [x, y] of [[200, 120], [1300, 100], [1380, 820], [300, 860], [720, 450]]) { await page.mouse.move(x, y, { steps: 18 }); await sleep(500); }
    end();
    await page.mouse.move(200, 120, { steps: 10 }); await sleep(900);
    await shot(page, `${P}-lean-left`, corner);
    await page.mouse.move(1300, 120, { steps: 10 }); await sleep(900);
    await shot(page, `${P}-lean-right`, corner);
    const [bx, by] = await centre(page, '[data-testid=phone] [aria-label^="Bag"]');
    await page.mouse.move(bx, by, { steps: 6 }); await sleep(700);
    await shot(page, `${P}-hover`, await screen());
    await page.mouse.move(W / 2, 80); await sleep(400);
    await page.keyboard.press("Shift");
    await page.evaluate(() => document.querySelector('[data-testid=phone] [aria-label^="Friends"]')?.focus());
    await sleep(700);
    log.push({ focusVisible: await page.evaluate(() => document.activeElement?.matches(":focus-visible")) });
    await shot(page, `${P}-pick`, await screen());
    await page.evaluate(() => document.activeElement?.blur());
  }
  await shot(page, `${P}-screen`, await screen());
  end = clip(`${P}-app`, phone ? undefined : { x: 0, y: 0, width: W, height: H });
  await page.click('[data-testid=phone] [aria-label^="Mail"]'); await sleep(1500);
  await page.keyboard.press("Escape"); await sleep(1600);
  end();
  await page.click('[data-testid=phone] [aria-label^="Mail"]'); await sleep(1500);
  await shot(page, `${P}-app-mail`);
  await page.keyboard.press("Escape"); await sleep(1600);
  await shot(page, `${P}-back`);
  if (phone) return;
  await page.keyboard.press("x");
  await frames(page, `${P}-away`, [0, 100, 200, 300, 400, 550, 800], corner);
  await sleep(600);
  // The corner: touch it (no click) and it comes up; away and back to it, and it goes.
  await page.mouse.move(W - 300, H - 300); await sleep(400);
  end = clip(`${P}-corner`, corner);
  await page.mouse.move(W - 4, H - 4, { steps: 8 }); await sleep(1700);
  await page.mouse.move(W - 360, H - 200, { steps: 8 }); await sleep(500);
  await page.mouse.move(W - 4, H - 4, { steps: 8 }); await sleep(1500);
  end();
  await page.mouse.move(W - 360, H - 200, { steps: 8 }); await sleep(400);
  await page.mouse.move(W - 4, H - 4, { steps: 8 }); await sleep(1700);
  await shot(page, `${P}-corner-open`, corner);
  await page.mouse.move(W - 360, H - 200, { steps: 8 }); await sleep(400);
  await page.mouse.move(W - 4, H - 4, { steps: 8 }); await sleep(1500);
  await shot(page, `${P}-corner-shut`, corner);
}

const go = (page, x, z, yaw = 0) => page.evaluate(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
const at = (page, phase, t) => page.waitForFunction(([p, tt]) => { const s = window.__arrival?.state(); return s && s.phase === p && s.t >= tt; }, [phase, t], { timeout: 300000, polling: 16 });
async function talkThrough(page) {
  await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
  await sleep(250);
  for (let k = 1; k < 14 && await page.$("[data-testid=talk-box]"); k++) {
    await page.keyboard.press("e"); await sleep(200);
    const ready = await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]") || !!document.querySelector("[data-testid=talk-box][data-phase=speaking][data-ready]"), null, { timeout: 6000, polling: 30 })
      .then(() => page.$("[data-testid=talk-box]").then(Boolean), () => false);
    if (!ready) break;
  }
  await page.waitForFunction(() => !document.querySelector("[data-testid=talk-box]"), null, { timeout: 15000 }).catch(() => {});
  await sleep(150);
}
async function hq(page) {
  const stage = (id, st) => page.waitForFunction(([i, s]) => { const t = window.__tutorial?.(), stops = window.__arrivalStops?.(); return t && (t.done || (stops?.[t.stop]?.id === i && t.stage === s)); }, [id, st], { timeout: 120000, polling: 50 });
  const hqWait = what => page.waitForFunction(w => window.__hq?.()?.waiting === w, what, { timeout: 30000, polling: 50 });
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  await page.evaluate(() => window.__arrival.skip());
  await at(page, "creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at(page, "crossing", 0.6);
  await page.evaluate(() => window.__arrival.skip());
  await at(page, "tutorial", 1.2);
  await page.waitForFunction(() => window.__arrivalStops?.()?.length, null, { timeout: 60000 });
  const hqStand = (await page.evaluate(() => window.__arrivalStops())).find(s => s.id === "hqFirst").stand;
  await stage("hqFirst", "await");
  await go(page, hqStand.x - 1.5, hqStand.z - 1.6);
  await page.waitForFunction(() => window.__bram?.().talkable, null, { timeout: 120000, polling: 50 }); await sleep(600);
  await page.keyboard.press("e");
  await talkThrough(page);
  await stage("hqFirst", "task");
  const door = await page.evaluate(() => window.__hqWorld.door);
  await go(page, door[0], door[1]);
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Enter HQ/.test(b.textContent ?? "")), null, { timeout: 30000, polling: 50 });
  await page.keyboard.press("e");
  await page.waitForFunction(() => document.querySelector("main")?.dataset.inside === "hq", null, { timeout: 30000 });
  await sleep(4500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: 4.6, z: -7.4 } }))); await sleep(2600);
  await hqWait("wren");
  await page.waitForFunction(() => [...document.querySelectorAll("main button")].some(b => /Talk to Alice/.test(b.textContent ?? "")), null, { timeout: 20000, polling: 50 });
  await page.keyboard.press("e");
  await talkThrough(page);
  await page.waitForSelector("[data-testid=hq-lore]", { timeout: 30000 });
  for (let k = 1; k <= 3; k++) { await sleep(500); await page.click("[data-testid=hq-lore-next]"); }
  await talkThrough(page);
  await page.waitForSelector("[data-testid=hq-id]", { timeout: 30000 }); await sleep(600);
  await page.fill("[data-testid=hq-id-name]", "Marlowe");
  await page.click("[data-testid=hq-id-print]");
  await page.waitForSelector("[data-testid=hq-id-done]", { timeout: 8000 }); await sleep(600);
  await page.click("[data-testid=hq-id-done]");
  await talkThrough(page);
  await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 }); await sleep(4500);
  await talkThrough(page);
  await page.waitForSelector("[data-testid=hq-fly]", { timeout: 30000 }); await sleep(4500);
  await talkThrough(page);
  await page.waitForSelector("[data-testid=hq-checkin]", { timeout: 30000 }); await sleep(600);
  await page.click("[data-testid=hq-checkin-done]");
  await talkThrough(page);
  await page.waitForSelector("[data-testid=ui-tour]", { timeout: 30000 }); await sleep(700);
  await page.evaluate(() => { window.__hudCoins?.(1240); window.__hudGems?.(35); });
  const keyOf = { wheel: "Tab", emote: "g", chat: "Enter", bag: "i", collection: "b", quests: "j", map: "m", mail: "l", phone: "x" };
  const stepNow = () => page.evaluate(() => document.querySelector("[data-testid=ui-tour]")?.dataset.step ?? null);
  for (let k = 1; k <= 11; k++) {
    const step = await stepNow();
    if (!step) break;
    if (step === "hud") {
      // No key: it plays by itself a beat after it lights (AUTO_MS 700), then the HUD flies in (pop 380, show 1000, fly 760).
      const end = clip("a-hud");
      await page.waitForFunction(() => document.querySelector("[data-testid=ui-tour]")?.dataset.step !== "hud", null, { timeout: 8000, polling: 50 }).catch(() => log.push({ hud: "stuck" }));
      await sleep(600); end();
      continue;
    }
    await sleep(300);
    if (step === "phone") {
      const end = clip("a-phone");
      await sleep(1600);
      await page.keyboard.press("x");
      await sleep(4200); end();
      break;
    }
    await page.keyboard.down(keyOf[step]);
    await sleep(step === "wheel" || step === "emote" ? 900 : 120);
    await page.keyboard.up(keyOf[step]);
    await page.waitForFunction(s => document.querySelector("[data-testid=ui-tour]")?.dataset.step !== s || !document.querySelector("[data-testid=ui-tour]"), step, { timeout: 8000, polling: 50 })
      .catch(() => log.push({ key: step, moved: false }));
    if (await stepNow() !== "hud") await sleep(1500);
  }
  await sleep(2000);
  await shot(page, "a-tour-done");
}

const run = async (name, fn, view, extra, path) => {
  const page = await open(name, view, extra, path);
  try { await fn(page, name); } catch (e) { log.push({ failed: name, error: String(e).slice(0, 400) }); console.log("FAILED", name, String(e).slice(0, 400)); await shot(page, `${name}-zz-failed`).catch(() => {}); }
  const file = page.video();
  await page.context().close();
  const vpath = await file?.path().catch(() => null);
  writeFileSync(`${OUT}/clips-${name}.json`, JSON.stringify(clips.filter(c => c.video === name).map(c => ({ ...c, path: vpath })), null, 1));
};
if (SCENES.includes("ui")) await run("u", ui, DESKTOP);
if (SCENES.includes("ui-phone")) await run("p", ui, PHONE);
if (SCENES.includes("hq")) await run("a", hq, DESKTOP, { "tsi.dock.cleared": "1" }, "/lab/island?arrival=1&weather=clear&at=14:20");
if (SCENES.includes("keys")) await run("k", async page => {
  await free(page);
  await page.keyboard.press("x"); await sleep(1600);
  await page.click('[data-testid=phone] [aria-label^="Settings"]'); await sleep(1500);
  await page.getByRole("tab", { name: "Controls" }).click().catch(() => page.getByText("Controls", { exact: true }).click()); await sleep(800);
  await page.evaluate(() => [...document.querySelectorAll("legend")].find(l => /Menu keys/.test(l.textContent ?? ""))?.scrollIntoView({ block: "center" }));
  await sleep(500);
  await shot(page, "k-settings-keys");
}, DESKTOP);
if (SCENES.includes("reduced")) await run("r", async page => {
  await free(page);
  await page.keyboard.press("x"); await sleep(80);
  await shot(page, "r-80ms", { x: 1440 - 520, y: 900 - 640, width: 520, height: 640 });
}, { ...DESKTOP, reducedMotion: "reduce" });
if (SCENES.includes("smooth")) await run("m", async page => {
  await free(page);
  await page.keyboard.press("x"); await sleep(1800);
  await shot(page, "m-phone", { x: 1440 - 520, y: 900 - 640, width: 520, height: 640 });
}, DESKTOP, { "tsi.pixelated.v1": "false" });
writeFileSync(`${OUT}/log-${SCENES.join("-")}.json`, JSON.stringify(log, null, 1));
await browser.close();
