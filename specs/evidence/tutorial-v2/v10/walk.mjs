// Round 10 evidence for the tutorial-v2 lane (David 2026-11-04: the phone as a 3D slider phone): headless, muted,
// signed out against a dev server with the Supabase env blanked, on the new world.
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v10/walk.mjs <out> ui | ui-phone | reduced
//
// ui:       free roam on a desktop: Y brings the phone up (the slide as exact frames: the phone's CSS animations are
//           paused and seeked), its app grid, an app open (the phone tucked away), back; Y puts it away (frames); Esc's view.
// ui-phone: the same on a phone screen from the phone button.
// reduced:  reduced motion: it appears open, no slide.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...SCENES] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3172";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const FREE = "/lab/island?weather=clear&at=14:20";

async function open(view) {
  const ctx = await browser.newContext(view);
  const page = await ctx.newPage();
  page.on("pageerror", e => { log.push({ pageerror: e.message.slice(0, 300) }); console.log("pageerror", e.message.slice(0, 300)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION|hydrat/i.test(m.text())) log.push({ console: m.text().slice(0, 300) }); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(c => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.camera.v1", c); }, CAMERA);
  await page.goto(`${HOST}${FREE}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.waitFor({ timeout: 90000 }).then(() => skip.click()).catch(() => log.push({ creator: "no skip" }));
  await page.waitForFunction(() => window.__move?.teleport, null, { timeout: 300000, polling: 200 });
  await sleep(9000);
  return page;
}
async function shot(page, name, clip) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  log.push({ shot: name }); console.log("shot", name);
}
const box = (page, sel, pad = 20) => page.$eval(sel, (el, p) => { const r = el.getBoundingClientRect(); return { x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.width + 2 * p, height: r.height + 2 * p }; }, pad).catch(() => null);
const fit = (b, W, H) => b && { x: b.x, y: b.y, width: Math.min(b.width, W - b.x), height: Math.min(b.height, H - b.y) };

/** The phone's CSS animations paused and seeked to each time (ms from the key), one frame each. */
async function frames(page, name, times, clip) {
  await page.waitForSelector("[data-testid=phone]");
  await page.evaluate(() => { window.__phoneAnims = document.querySelector("[data-testid=phone]").getAnimations({ subtree: true }); for (const a of window.__phoneAnims) a.pause(); });
  for (const [i, t] of times.entries()) {
    await page.evaluate(ms => { for (const a of window.__phoneAnims) a.currentTime = ms; }, t);
    await page.screenshot({ path: `${OUT}/${name}-f${String(i + 1).padStart(2, "0")}.png`, clip });
  }
  log.push({ frames: name, times }); console.log("frames", name);
  await page.evaluate(() => { for (const a of window.__phoneAnims) a.play(); });
}
const OPEN_T = [0, 120, 220, 300, 380, 460, 540, 640, 760, 1400];
const CLOSE_T = [0, 60, 120, 180, 240, 300, 380];

const rects = async page => log.push({ rects: await page.evaluate(() => Object.fromEntries(["[data-hud-slot=coins]", "[data-hud-slot=gems]", "[data-testid=phone]", "[data-testid=phone] [aria-label=Settings]", "[data-hud-quest]"].map(s => {
  const r = document.querySelector(s)?.getBoundingClientRect(); return [s, r && [r.left, r.top, r.right, r.bottom].map(Math.round)];
}))) });
async function ui(page, P) {
  await page.evaluate(() => { window.__hudCoins?.(1240); window.__hudGems?.(35); });
  const phone = P === "p", W = phone ? 390 : 1440, H = phone ? 844 : 900;
  const corner = phone ? { x: 0, y: 0, width: W, height: H } : { x: W - 560, y: H - 760, width: 560, height: 760 };
  const app = async (name, label) => {
    await page.click(`[data-testid=phone] [aria-label^="${label}"]`); await sleep(1500);
    await shot(page, name);
    await page.keyboard.press("Escape"); await sleep(1200);
  };
  if (phone) await page.click('button[aria-label="Phone"]');
  else await page.keyboard.press("y");
  await frames(page, `${P}-slide`, OPEN_T, corner);
  await sleep(600);
  await shot(page, `${P}-phone`);
  await rects(page);
  await shot(page, `${P}-phone-close`, fit(await box(page, "[data-testid=phone]"), W, H));
  log.push({ apps: await page.$$eval("[data-testid=phone] button", bs => bs.map(b => b.getAttribute("aria-label"))).catch(() => null) });
  await app(`${P}-app-mail`, "Mail");
  await shot(page, `${P}-back`);
  if (phone) return;
  // Put away: hold the presence's unmount (400 ms) so the reverse can be seeked frame by frame.
  await page.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 400 ? 60000 : ms, ...a); });
  await page.keyboard.press("y");
  await frames(page, `${P}-away`, CLOSE_T, corner);
  await sleep(300);
  await page.keyboard.press("Escape"); await sleep(1500);
  await shot(page, `${P}-esc`);
  await rects(page);
}

const run = async (name, fn, view) => {
  const page = await open(view);
  try { await fn(page, name); } catch (e) { log.push({ failed: name, error: String(e).slice(0, 400) }); console.log("FAILED", name, String(e).slice(0, 400)); await shot(page, `${name}-zz-failed`).catch(() => {}); }
  await page.context().close();
};
if (SCENES.includes("ui")) await run("u", ui, DESKTOP);
if (SCENES.includes("ui-phone")) await run("p", ui, PHONE);
if (SCENES.includes("reduced")) await run("r", async page => {
  await page.keyboard.press("y"); await sleep(60);
  await shot(page, "r-60ms", { x: 1440 - 560, y: 900 - 760, width: 560, height: 760 });
}, { ...DESKTOP, reducedMotion: "reduce" });
writeFileSync(`${OUT}/log-${SCENES.join("-")}.json`, JSON.stringify(log, null, 1));
await browser.close();
