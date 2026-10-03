// Arrival, wharf and home pier evidence (specs/polish/arrival-wharf.md): headed Chromium (WebGL), muted, kept off
// screen (or HEADLESS=1), signed out with the island's memory stores, dev server on :3141 with the Supabase env blanked (and the shared
// browser lock held). PNGs land in <out_dir>, each trip frame with its phase and time in frames.json; sheets.py makes
// the WebP sheets.
//   node specs/evidence/polish-arrival/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: wharf, home, trip-out, trip-back, skip, first-login, target, perf.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3141";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const ORDER = ["board", "castoff", "turn", "sail", "veil", "load", "arrive", "dock", "land", "reveal", "done"];
const rad = d => (Number(d) * Math.PI) / 180;
const framesFile = `${OUT}/frames.json`;
const frames = existsSync(framesFile) ? JSON.parse(readFileSync(framesFile, "utf8")) : {};

// HEADLESS=1: no window at all, WebGL on SwiftShader (looks only; frame times there say nothing about the GPU).
const HEADLESS = process.env.HEADLESS === "1";
const browser = await chromium.launch(HEADLESS
  ? { headless: true, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
  : { headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });

/** A fresh device (a saved look skips the creator; greeted; no gift put off) with the camera at yaw/pitch (degrees) and zoom. */
async function open(query, { cam = null, extra = {}, touch = false } = {}) {
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, c, e]) => {
    localStorage.clear();
    localStorage.setItem("tsi.look.v1", l);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    if (c) localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: c[0], pitch: c[1], zoom: c[2] ?? 1, sensitivity: 1, invertY: false, mouseLook: true, autoFollow: false }));
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
  }, [JSON.stringify(LOOK), cam && [rad(cam[0]), rad(cam[1]), cam[2]], extra]);
  await (await ctx.newCDPSession(page)).send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: 5 });
  await page.goto(`${HOST}/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => console.log("still preparing"));
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
}
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` }).then(() => console.log("shot", name));
const nohud = () => page.addStyleTag({ content: "main > :not(:has(canvas)):not([class*=veil]):not([class*=skip]), nav { visibility: hidden !important; }" });
const perf = async (label) => console.log("perf", label, (await page.evaluate(() => document.querySelector("#island-options output")?.textContent ?? "")).replace(/\n/g, " | "));

/** Frames of a trip at its marks ([phase, seconds into it]), each as soon as the trip gets there; their phases and times go to frames.json. */
async function strip(name, marks) {
  const out = [];
  for (let k = 0; k < marks.length; k++) {
    const [phase, t] = marks[k];
    await page.waitForFunction(([p, tt, order]) => {
      const s = window.__trip?.state();
      if (!s) return p === "done";
      const ip = order.indexOf(s.phase), iq = order.indexOf(p);
      return ip > iq || (ip === iq && s.t >= tt);
    }, [phase, t, ORDER], { timeout: 180000, polling: 16 });
    const s = await page.evaluate(() => window.__trip?.state() ?? null);
    const file = `${name}-${String(k).padStart(2, "0")}`;
    await shot(file);
    out.push({ file, phase: s ? s.phase : "done", t: s ? +s.t.toFixed(2) : 0 });
  }
  frames[name] = out;
  writeFileSync(framesFile, JSON.stringify(frames, null, 1));
}
const OUT_MARKS = [["board", 0.15], ["board", 0.62], ["board", 1.3], ["castoff", 0.7], ["turn", 0.9], ["turn", 2.2], ["sail", 0.8], ["sail", 2.4], ["veil", 0.35], ["load", 0],
  ["arrive", 0.25], ["arrive", 1.4], ["arrive", 3.2], ["dock", 0.95], ["land", 0.1], ["land", 0.62], ["land", 1.25], ["done", 0]];

for (const scene of SCENES) {
  if (scene === "wharf") {
    for (const [time, label] of [["13:00", "day"], ["22:30", "night"]]) {
      await open(`at=8,-17.2&at=${time}`, { cam: [200, 26, 1.25] });
      await page.waitForTimeout(3500);
      await nohud();
      await shot(`wharf-${label}-out`);
      await open(`at=7.2,-20.6&at=${time}`, { cam: [-55, 30, 1.15] });
      await page.waitForTimeout(3500);
      await nohud();
      await shot(`wharf-${label}-boat`);
      await open(`at=8,-16.5&at=${time}`, { cam: [0, 40, 1.5] });
      await page.waitForTimeout(3500);
      await nohud();
      await shot(`wharf-${label}-sea`);
    }
  }
  if (scene === "home") {
    for (const [time, label] of [["13:00", "day"], ["22:30", "night"]]) {
      await open(`home=1&at=${time}`, { cam: [195, 26, 1.25] });
      await page.waitForTimeout(3500);
      await nohud();
      await shot(`home-${label}-out`);
      await open(`home=1&at=${time}`, { cam: [-40, 34, 1.6] });
      await page.waitForTimeout(3500);
      await nohud();
      await shot(`home-${label}-boat`);
    }
  }
  if (scene === "trip-out" || scene === "trip-back") {
    const out = scene === "trip-out";
    await open(out ? "at=8,-21&at=13:00" : "home=1&at=13:00", { cam: [180, 30, 1] });
    await page.waitForTimeout(2500);
    // Home: walk out along the pier to the boat first (its prompt is at the tip).
    if (!out) await page.evaluate(() => window.__move?.teleport(0, -12, Math.PI));
    await page.waitForTimeout(800);
    await perf(`${scene} before`);
    await page.keyboard.press("e");
    await strip(scene, OUT_MARKS);
    await page.waitForTimeout(600);
    await perf(`${scene} after`);
  }
  if (scene === "skip") {
    await open("at=8,-21&at=13:00", { cam: [180, 30, 1] });
    await page.waitForTimeout(2500);
    await page.keyboard.press("e");
    await page.waitForFunction(() => window.__trip?.state()?.phase === "sail", null, { timeout: 60000 });
    await page.waitForTimeout(500);
    await shot("skip-pre");
    await page.keyboard.press(" ");
    await strip("skip", [["veil", 0.15], ["load", 0], ["reveal", 0.2], ["done", 0]]);
  }
  if (scene === "first-login") {
    // A first login on a signed-out bench (?welcome=1): the island loads, the boat comes in, Wren greets you on the wharf.
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(([l]) => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); }, [JSON.stringify(LOOK)]);
    await page.goto(`${HOST}/lab/island?welcome=1&progression=demo&at=13:00`, { waitUntil: "domcontentloaded" });
    await strip("first", [["load", 0], ["arrive", 0.3], ["arrive", 1.6], ["arrive", 3.0], ["dock", 0.9], ["land", 0.2], ["land", 0.65], ["land", 1.3], ["done", 0]]);
    await page.waitForSelector("[data-welcome]", { timeout: 60000 });
    await page.waitForTimeout(500);
    await shot("first-greeting");
  }
  if (scene === "first-creator") {
    // A first login that dresses up first (the creator over the loaded island): the veil comes up over the island, the
    // boat comes in, Wren greets you.
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
    await page.goto(`${HOST}/lab/island?welcome=1&progression=demo&at=13:00`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "That's me" }).waitFor({ timeout: 240000 });
    await page.waitForTimeout(3000);
    await shot("creator-pre");
    await page.getByRole("button", { name: "That's me" }).click();
    await strip("creator", [["veil", 0.3], ["load", 0], ["arrive", 0.4], ["arrive", 2.2], ["dock", 1.0], ["land", 1.3], ["done", 0]]);
    await page.waitForSelector("[data-welcome]", { timeout: 60000 });
    await page.waitForTimeout(500);
    await shot("creator-greeting");
  }
  if (scene === "target") {
    // The move target on the oracle terrace's bank (a slope), at night and by day: walked to as a tap would (the dev
    // hook), shot as it lands, holds and as you reach it; then one real tap on a touch screen (tap-to-walk is a touch
    // screen's), to show it is still reachable.
    for (const [time, label] of [["22:30", "night"], ["13:00", "day"]]) {
      // Up the temple terrace's bank (it rises away from the camera, about 11°), the marker ahead on the slope.
      await open(`at=-15.5,2.2&at=${time}`, { cam: [0, 46, 0.85] });
      await page.waitForTimeout(3000);
      await nohud();
      await page.evaluate(() => window.__move?.tapTo(-15.4, 5.9));
      for (const ms of [70, 200, 650]) { await page.waitForTimeout(ms === 70 ? 70 : ms - (ms === 200 ? 70 : 200)); await shot(`target-${label}-${ms}`); }
    }
    // A touch screen's own context (hasTouch: a coarse pointer, so a tap walks).
    const tctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: true });
    const tp = await tctx.newPage();
    await tp.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await tp.evaluate(([l]) => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 34 * Math.PI / 180, zoom: 0.62, sensitivity: 1, invertY: false, mouseLook: true, autoFollow: false })); }, [JSON.stringify(LOOK)]);
    await tp.goto(`${HOST}/lab/island?at=-10,1.4&at=13:00`, { waitUntil: "domcontentloaded" });
    await tp.waitForSelector("canvas", { timeout: 240000 });
    await tp.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => {});
    await tp.waitForTimeout(3000);
    console.log("touch pointer coarse:", await tp.evaluate(() => matchMedia("(pointer: coarse)").matches), "fine:", await tp.evaluate(() => matchMedia("(pointer: fine)").matches));
    const box = await tp.locator("canvas").first().boundingBox();
    await tp.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.34);
    await tp.waitForTimeout(160);
    await tp.screenshot({ path: `${OUT}/target-touch.png` });
    console.log("shot target-touch");
    await tctx.close();
  }
  if (scene === "perf") {
    for (const [q, label] of [["at=8,-17.2&at=13:00", "village wharf"], ["home=1&at=13:00", "home pier"], ["at=0,-2&at=13:00", "village plaza"]]) {
      await open(q, { cam: [180, 30, 1] });
      await page.waitForTimeout(6000);
      await perf(label);
    }
  }
}
await browser.close();
