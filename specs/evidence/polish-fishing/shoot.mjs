// Fishing polish evidence (specs/polish/fishing.md): headed Chromium (WebGL) off to the side and muted, never brought
// to the front; signed out against the dev server on :3140 with the Supabase env blanked. The catch is the server's
// answer, routed here (`fish=<key>` per scene), so a scene is the same species every run; the reel is played by a small
// bot in the page that keeps the bar on the fish. Frames come from the page's screencast (every frame the compositor
// draws, with its time), so a strip can be cut at any moment; beats.json says when each beat happened.
//   node specs/evidence/polish-fishing/shoot.mjs <out_dir> <tag> [scene ...]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, TAG = "after", ...ONLY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:3140";
const ME = "00000000-0000-4000-8000-000000000001";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
// The river north of the village spawn: stand on its bank at (2.5, -2), the water straight ahead (+z).
const BANK = "2.50,-2.00";

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--window-position=2400,0"] });
let page, ctx;
const log = (...a) => console.log(TAG, ...a);

/** A fresh device: the look, greeted, no gift, the rod in hand, the camera (`cam`: yaw, pitch, zoom) without mouse-look. */
async function open(path, { width = 1280, height = 800, cam = {}, extra = {}, fish = "fish_dace", owned = [], sizeCm = 14 } = {}) {
  ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__nibbles = []; window.addEventListener("tsi:fish-nibble", () => window.__nibbles.push(Date.now() / 1000)); });
  page = await ctx.newPage();
  page.on("pageerror", e => log("pageerror", e.message.slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|WebGL|THREE/i.test(m.text())) log("console", m.text().slice(0, 240)); });
  // The server's catch for this scene: what bites, and once landed, what it recorded.
  await page.route("**/api/collections", async route => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ collections: owned.map(k => ({ item_key: k, count: 1 })) }) });
    const body = JSON.parse(req.postData() ?? "{}");
    if (body.action === "cast") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: fish, size_cm: sizeCm, roll: "evidence-roll" } }) });
    if (body.action === "land") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: fish, size_cm: sizeCm, total_collected: owned.includes(fish) ? 2 : 1, new_record: false } }) });
    return route.fulfill({ status: 401, body: "{}" });
  });
  await page.route("**/api/collections/bag", route => route.fulfill({ status: 401, body: "{}" }));
  await page.goto(`${HOST}/student/opening-soon`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ look, me, cam, extra }) => {
    localStorage.clear();
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const base = { "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": day, "tsi.member.local.v1": me,
      "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: {} }),
      "tsi.camera.v1": JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false, ...cam }) };
    for (const [k, v] of Object.entries({ ...base, ...extra })) localStorage.setItem(k, v);
  }, { look: JSON.stringify(LOOK), me: ME, cam, extra });
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
}
async function world(query, opts = {}) {
  await open(`/lab/island?weather=clear&at=14:20&${query}`, opts);
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => log("still preparing"));
  await page.waitForTimeout(opts.wait ?? 9000);
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" });
}

/** The page's screencast: every frame with its time (s), kept in memory until `save`. */
async function recorder() {
  const cdp = await ctx.newCDPSession(page), frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { frames.push({ t: metadata.timestamp, data }); cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, everyNthFrame: 1 });
  return {
    async stop() { await cdp.send("Page.stopScreencast").catch(() => {}); },
    save(dir) {
      mkdirSync(dir, { recursive: true });
      const t0 = frames[0]?.t ?? 0;
      frames.forEach((f, i) => writeFileSync(`${dir}/${String(i).padStart(4, "0")}_${Math.round((f.t - t0) * 1000)}.jpg`, Buffer.from(f.data, "base64")));
      return t0;
    },
  };
}
/** Beats as the page sees them: the overlay's phase changes, stamped in wall-clock seconds (the screencast's clock). */
async function watchBeats() {
  await page.evaluate(() => {
    window.__beats = [];
    let last = null;
    const tick = () => {
      const el = document.querySelector("[data-fishing-overlay]"), phase = el?.getAttribute("data-fishing-overlay") ?? (document.querySelector('[aria-label="New catch"], [data-catch-card]') ? "reveal" : "idle");
      if (phase !== last) { window.__beats.push({ phase, t: Date.now() / 1000 }); last = phase; }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
/** Keep the reel's bar on the fish: hold while the fish is ahead of the bar's middle (synthetic pointer 7). */
async function reelBot(win = true) {
  await page.evaluate(win => {
    let held = false, done = false;
    const send = type => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
    const tick = () => {
      if (done) return;
      const reel = document.querySelector('[aria-label="Fishing reel"]');
      if (!reel) { if (held) { send("pointerup"); held = false; } if (window.__reelSeen) { done = true; return; } return requestAnimationFrame(tick); }
      window.__reelSeen = true;
      const track = reel.querySelector('div[style*="height: 46px"]'), bar = track?.querySelector("div"), fish = track?.querySelector("img");
      const b = parseFloat(bar?.style.left ?? "0"), w = parseFloat(bar?.style.width ?? "30"), f = parseFloat(fish?.style.left ?? "50");
      const want = win ? f > b + w * 0.5 : false;
      if (want !== held) { send(want ? "pointerdown" : "pointerup"); held = want; }
      requestAnimationFrame(tick);
    };
    window.__reelSeen = false;
    requestAnimationFrame(tick);
  }, win);
}
const centre = () => page.mouse.move(640, 380);

/** One whole cast: charge for `hold` ms, wait for the bite, hook it, let the bot reel (or not), let the reveal run. */
async function cast({ hold = 600, win = true, revealMs = 7000 } = {}) {
  await centre();
  await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.up();
  await page.waitForSelector('[data-fishing-overlay="bite"]', { timeout: 20000 });
  await page.waitForTimeout(140);
  await reelBot(win);
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
  await page.waitForFunction(() => /caught|missed|revealing/.test(document.querySelector("[data-fishing-overlay]")?.getAttribute("data-fishing-overlay") ?? "") || !!document.querySelector('[aria-label="New catch"], [data-catch-card]'), null, { timeout: 30000 }).catch(() => log("no result"));
  await page.waitForTimeout(revealMs);
}

const SCENES = {
  // The whole loop, first catch of a Dace: the cast, the wait, the bite, the reel, the reveal. A 3/4 view from the right.
  async loop() {
    await world(`at=${BANK}&hud=clean`, { cam: { yaw: 0.75, pitch: 0.48, zoom: 0.66 }, fish: "fish_dace", sizeCm: 14 });
    await watchBeats();
    const rec = await recorder();
    await page.waitForTimeout(400);
    await cast({ hold: 600, win: true, revealMs: 6500 });
    await rec.stop();
    const t0 = rec.save(`${OUT}/loop-${TAG}`);
    const beats = await page.evaluate(() => window.__beats);
    writeFileSync(`${OUT}/loop-${TAG}/beats.json`, JSON.stringify({ t0, beats }, null, 1));
    await ctx.close();
  },
  // An escape: hooked, then let go of the reel until the fish gets away.
  async escape() {
    await world(`at=${BANK}&hud=clean`, { cam: { yaw: 0.75, pitch: 0.48, zoom: 0.66 }, fish: "fish_black_bass", sizeCm: 41 });
    await watchBeats();
    const rec = await recorder();
    await cast({ hold: 500, win: false, revealMs: 3500 });
    await rec.stop();
    const t0 = rec.save(`${OUT}/escape-${TAG}`);
    writeFileSync(`${OUT}/escape-${TAG}/beats.json`, JSON.stringify({ t0, beats: await page.evaluate(() => window.__beats) }, null, 1));
    await ctx.close();
  },
  // The bobber and the water close up: a side-on view at the closest zoom, a bigger window, the whole cast recorded.
  async closeup() {
    await world(`at=${BANK}&hud=clean`, { width: 1600, height: 1000, cam: { yaw: 1.45, pitch: 0.4, zoom: 0.6 }, fish: "fish_black_bass", sizeCm: 41, ...(process.env.EXTRA ? { extra: JSON.parse(process.env.EXTRA) } : {}) });
    await watchBeats();
    const rec = await recorder();
    await page.waitForTimeout(300);
    await page.mouse.move(800, 480);
    await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
    await page.waitForSelector('[data-fishing-overlay="bite"]', { timeout: 20000 });
    await page.waitForTimeout(700);
    await reelBot(true);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(2500);
    await rec.stop();
    const dir = `${OUT}/closeup-${TAG}`;
    const t0 = rec.save(dir);
    writeFileSync(`${dir}/beats.json`, JSON.stringify({ t0, beats: await page.evaluate(() => window.__beats), nibbles: await page.evaluate(() => window.__nibbles) }, null, 1));
    await ctx.close();
  },
  // The reveal per rarity (first catches, then a repeat): `fish=<key>,<key>...` in the env, the screencast through it.
  async reveal() {
    const keys = (process.env.FISH ?? "fish_dace,fish_carp,fish_black_bass,fish_catfish,fish_golden_koi").split(",");
    const repeat = process.env.REPEAT === "1";
    for (const key of keys) {
      await world(`at=${BANK}&hud=clean`, { cam: { yaw: 0.75, pitch: 0.48, zoom: 0.66 }, fish: key, sizeCm: 42, owned: repeat ? [key] : [], wait: 8000,
        ...(process.env.EXTRA ? { extra: JSON.parse(process.env.EXTRA) } : {}) });
      await watchBeats();
      const rec = await recorder();
      await cast({ hold: 600, win: true, revealMs: 7500 });
      await rec.stop();
      const dir = `${OUT}/reveal-${repeat ? "repeat-" : ""}${key}-${TAG}`;
      const t0 = rec.save(dir);
      writeFileSync(`${dir}/beats.json`, JSON.stringify({ t0, beats: await page.evaluate(() => window.__beats) }, null, 1));
      await ctx.close();
    }
  },
  // FPS on the bank: standing, then through a cast (the wait and the reel).
  async fps() {
    await world(`at=${BANK}`, { cam: { yaw: 0.75, pitch: 0.48, zoom: 0.66 }, fish: "fish_carp", sizeCm: 40, owned: ["fish_carp"] });
    const fps = ms => page.evaluate(ms => new Promise(done => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(tick); }), ms);
    const still = await fps(4000);
    await centre();
    await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
    await page.waitForTimeout(1200);
    const waiting = await fps(3000);
    await page.waitForSelector('[data-fishing-overlay="bite"]', { timeout: 20000 }).catch(() => {});
    await reelBot(true);
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(400);
    const reeling = await fps(2500);
    const line = `fishing FPS (${TAG}, High, 1280x800): standing ${still}, waiting ${waiting}, reeling ${reeling}`;
    log(line);
    writeFileSync(`${OUT}/fps-${TAG}.txt`, line + "\n");
    await ctx.close();
  },
};

for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { log("FAILED", name, e.message.slice(0, 400)); try { await page.screenshot({ path: `${OUT}/failed-${name}-${TAG}.png` }); } catch { /* closed */ } await ctx?.close().catch(() => {}); }
}
await browser.close();
