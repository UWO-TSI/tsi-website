// game/waves evidence: the HUD with the quest line left of the minimap (playing, and Esc 1's UI view), and frame strips
// of the sea (4 frames, half a second apart): the wharf, the open water off it, the boats rocking, a beach with its
// smaller waves, and Lite. Headless Chromium on the GPU, muted; the dev server with the Supabase env blanked; the
// browser lock held.
//   HOST=http://localhost:3177 node specs/evidence/waves/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: hud, phone and v2 (checked, not kept), wharf, open, boats, shore, lite, crossing (the arrival's boat out at sea).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3177";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });

/** Headless Chromium has no Pointer Lock: a stand-in with Chrome's behaviour (as specs/evidence/hud-esc/shoot.mjs). */
const POINTER_LOCK = () => {
  let locked = null;
  const change = () => queueMicrotask(() => document.dispatchEvent(new Event("pointerlockchange")));
  Object.defineProperty(Document.prototype, "pointerLockElement", { configurable: true, get() { return locked; } });
  Element.prototype.requestPointerLock = function () { locked = this; change(); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { if (!locked) return; locked = null; change(); };
  window.addEventListener("keydown", e => { if (e.key === "Escape" && locked) { e.stopImmediatePropagation(); e.preventDefault(); document.exitPointerLock(); } }, true);
};

/** A fresh device on the island (a saved look skips the creator; greeted; no gift). */
async function client(query, { lite = false, size = { width: 1280, height: 800 }, mouseLook = true } = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(POINTER_LOCK);
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|127\.0\.0\.1:9|ERR_CONNECTION/i.test(m.text())) console.log("console", m.text().slice(0, 400)); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, lite, mouseLook]) => {
    localStorage.clear();
    localStorage.setItem("tsi.look.v1", l);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.liteMode.v1", lite ? "true" : "false");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.6, zoom: 1, sensitivity: 1, invertY: false, mouseLook, autoFollow: false }));
  }, [JSON.stringify(LOOK), lite, mouseLook]);
  await page.goto(`${HOST}/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 300000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForTimeout(6000);
  // Shots are of the settings as chosen: hold the adaptive quality where it is.
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).then(() => console.log("shot", name));

/** Stand at (x, z) and look `yaw` (forward = (sin, cos)) down `pitch`, `zoom` times the follow distance. */
async function stand(page, x, z, yaw, pitch, zoom) {
  await page.evaluate(([x, z, yaw, pitch, zoom]) => {
    window.__move.teleport(x, z, yaw);
    const o = window.__orbit.orbit;
    for (const k of ["target", "view"]) Object.assign(o[k], { yaw, pitch, zoom });
  }, [x, z, yaw, pitch, zoom]);
  await page.waitForTimeout(3500);
}
/** Four frames half a second apart, and the strip of them (2 × 2, half size). */
async function strip(page, name, crop = null) {
  const files = [], at = [];
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) {
    const wait = t0 + i * 500 - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    at.push(Date.now() - t0);
    const f = `${OUT}/${name}-f${i + 1}.png`;
    await page.screenshot({ path: f });
    files.push(f);
  }
  execFileSync("magick", ["(", files[0], files[1], "+append", ")", "(", files[2], files[3], "+append", ")", "-append", "-resize", "50%", `${OUT}/${name}-strip.png`]);
  // A close crop of each frame side by side, full size (`crop`: w, h, x, y), where the motion is small.
  if (crop) execFileSync("magick", [...files.flatMap(f => ["(", f, "-crop", `${crop[0]}x${crop[1]}+${crop[2]}+${crop[3]}`, "+repage", ")"]), "+append", `${OUT}/${name}-close.png`]);
  for (const f of files) execFileSync("rm", [f]);
  console.log("strip", name, "frames at ms", at.join(", "));
}

const WHARF = { x: 8, z: -19.5 };
for (const scene of SCENES) {
  if (scene === "hud") {
    const page = await client("bots=4&seed=3&at=13:00&weather=clear");
    await page.mouse.click(640, 560);
    await page.waitForFunction(() => window.__orbit?.capture.state === "captured", null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, "01-hud-quest-left-of-map");
    const box = await page.getByTestId("quest-tracker").boundingBox(), map = await page.locator("[data-minimap] > *").first().boundingBox();
    console.log("tracker", JSON.stringify(box), "minimap", JSON.stringify(map));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    await shot(page, "02-esc1-quest-left-of-map");
    console.log("esc1 tracker", JSON.stringify(await page.getByTestId("quest-tracker").boundingBox()), "minimap", JSON.stringify(await page.locator("[data-minimap] > *").first().boundingBox()));
    // Clicking the line opens Quests and journal.
    await page.getByTestId("quest-tracker").getByRole("button").click();
    await page.waitForTimeout(800);
    console.log("journal open:", await page.locator("[role=dialog]").count(), JSON.stringify(await page.locator("[role=dialog]").first().getAttribute("aria-label")));
    await page.context().close();
  }
  if (scene === "phone") {
    const page = await client("bots=3&seed=3&at=13:00&weather=clear&touch=1", { size: { width: 390, height: 844 } });
    await shot(page, "phone-hud");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.waitForTimeout(900);
    await shot(page, "phone-ui-view");
    await page.context().close();
  }
  if (scene === "wharf") {
    const page = await client("at=13:00&weather=clear", { mouseLook: false });
    await stand(page, WHARF.x - 0.4, WHARF.z + 1.6, Math.PI, 0.5, 1.5);
    await strip(page, "10-wharf");
    await page.context().close();
  }
  if (scene === "open") {
    const page = await client("at=13:00&weather=clear", { mouseLook: false });
    await stand(page, WHARF.x - 1.2, WHARF.z - 2.4, Math.PI + 0.25, 0.35, 1.6);
    await strip(page, "11-open-water");
    await page.context().close();
  }
  if (scene === "boats") {
    const page = await client("at=13:00&weather=clear", { mouseLook: false });
    await stand(page, WHARF.x - 1.2, WHARF.z - 2.4, Math.PI - 0.5, 0.45, 0.75);
    await strip(page, "12-boats-rocking", [560, 330, 250, 230]);
    await page.context().close();
  }
  if (scene === "shore") {
    const page = await client("at=13:00&weather=clear", { mouseLook: false });
    // The north beach (the coast at about (7.7, 18.7)), looking out over the shallows.
    await stand(page, 6.6, 16.0, 0.39, 0.62, 0.8);
    await strip(page, "13-shore");
    await page.context().close();
  }
  if (scene === "crossing") {
    // The arrival replayed (?arrival=1): past the underwater and aboard beats, the reflection's yes, then the crossing.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
    await page.goto(`${HOST}/lab/island?arrival=1&weather=clear`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
    const at = (phase, t, trip) => page.waitForFunction(([p, tt, tr]) => {
      const s = window.__arrival?.state();
      if (!s) return false;
      return tr ? s.trip && s.trip.phase === p && s.trip.t >= tt : s.phase === p && s.t >= tt;
    }, [phase, t, trip], { timeout: 300000, polling: 16 });
    await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
    await page.evaluate(() => { window.__arrival.skip(); window.__arrival.skip(); });
    await at("creator", 1.5, false);
    await page.click('[data-testid="reflection-yes"]', { force: true });
    await at("cross", 2.6, true);
    await strip(page, "16-crossing-at-sea", [1280, 560, 0, 220]);
    await at("cross", 8.4, true);
    await strip(page, "17-crossing-bow");
    await ctx.close();
  }
  if (scene === "v2") {
    // The v2 world (the smooth heightfield's own water mesh, 128-cell blocks): its sea from the spawn, four ways.
    const page = await client("fixture=v2&at=13:00&weather=clear", { mouseLook: false });
    const p = await page.evaluate(() => { const s = window.__move.sim.current.state; return [s.x, s.z]; });
    for (const [i, yaw] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) { await stand(page, p[0], p[1], yaw, 0.4, 1.6); await shot(page, `v2-check-${i}`); }
    await page.context().close();
  }
  if (scene === "lite") {
    const page = await client("at=13:00&weather=clear", { lite: true, mouseLook: false });
    await stand(page, WHARF.x - 1.2, WHARF.z - 2.4, Math.PI + 0.25, 0.35, 1.6);
    await strip(page, "14-lite-open-water");
    await stand(page, WHARF.x - 1.2, WHARF.z - 2.4, Math.PI - 0.5, 0.45, 0.75);
    await strip(page, "15-lite-boats", [560, 330, 250, 230]);
    await page.context().close();
  }
}
await browser.close();
