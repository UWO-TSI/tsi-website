// Round 11 evidence for the tutorial-v2 lane (David 2026-11-04: the phone's pixel filter and its screen in a pixel
// style): headless, muted, signed out against a dev server with the Supabase env blanked, on the new world.
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v11/walk.mjs <out> ui | ui-phone | short | smooth | reduced
//
// ui:       a desktop (1440x900): Y brings the phone up (the slide as exact frames: the phone's CSS animations paused
//           and seeked), the phone beside the world, its screen close up, a hovered tile, the keyboard's pick (the hand),
//           an app open and back; Y puts it away (frames).
// ui-phone: a phone screen (390x844 at 2x) from the phone button: the slide, the screen, an app and back.
// short:    a short window (1440x780): the phone's top against the wallet's slot.
// smooth:   the pixel finish off in the graphics settings: the body smooth, the screen still pixel art.
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

async function open(view, extra = {}) {
  const ctx = await browser.newContext(view);
  const page = await ctx.newPage();
  page.on("pageerror", e => { log.push({ pageerror: e.message.slice(0, 300) }); console.log("pageerror", e.message.slice(0, 300)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION|hydrat/i.test(m.text())) log.push({ console: m.text().slice(0, 300) }); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([c, x]) => {
    localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.camera.v1", c);
    for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v);
  }, [CAMERA, extra]);
  await page.goto(`${HOST}${FREE}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await skip.waitFor({ timeout: 90000 }).then(() => skip.click()).catch(() => log.push({ creator: "no skip" }));
  await page.waitForFunction(() => window.__move?.teleport, null, { timeout: 300000, polling: 200 });
  await sleep(9000);
  await page.evaluate(() => { window.__hudCoins?.(1240); window.__hudGems?.(35); });
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
  await page.waitForSelector("[data-testid=phone] canvas");
  await sleep(150);
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

/** Where things are, and the pixel grid: the phone's canvases (their pixels and CSS sizes) and the screen's tile. */
const rects = async (page, tag) => log.push({ tag, rects: await page.evaluate(() => {
  const r = s => { const b = document.querySelector(s)?.getBoundingClientRect(); return b && [b.left, b.top, b.right, b.bottom].map(v => Math.round(v * 100) / 100); };
  const phone = document.querySelector("[data-testid=phone]");
  return {
    window: [innerWidth, innerHeight, devicePixelRatio],
    coins: r("[data-hud-slot=coins]"), gems: r("[data-hud-slot=gems]"), phone: r("[data-testid=phone]"), settings: r("[data-testid=phone] [aria-label=Settings]"),
    tile: r("[data-testid=phone] [aria-label=Settings] > span"),
    canvases: [...(phone?.querySelectorAll("canvas") ?? [])].map(c => [c.width, c.height, c.style.width, c.style.height, c.style.imageRendering]),
    finish: getComputedStyle(document.querySelector("[role=application] canvas, canvas[role=application]") ?? document.body).imageRendering,
    world: (() => { const c = document.querySelector("[role=application] canvas, canvas[role=application]"); return c && [c.width, c.height, c.clientWidth, c.clientHeight]; })(),
  };
}) });

async function ui(page, P) {
  const phone = P === "p", W = phone ? 390 : 1440, H = phone ? 844 : 900;
  const corner = phone ? { x: 0, y: 0, width: W, height: H } : { x: W - 560, y: H - 760, width: 560, height: 760 };
  if (phone) await page.click('button[aria-label="Phone"]');
  else await page.keyboard.press("y");
  await frames(page, `${P}-slide`, OPEN_T, corner);
  await sleep(600);
  await page.mouse.move(W / 2, 80);
  await shot(page, `${P}-phone`);
  await rects(page, `${P}-open`);
  await shot(page, `${P}-phone-close`, fit(await box(page, "[data-testid=phone]"), W, H));
  const screen = await box(page, "[data-testid=phone] [class*=screen]", 6);
  if (screen) await shot(page, `${P}-screen`, fit(screen, W, H));
  if (!phone) {
    const bag = await box(page, '[data-testid=phone] [aria-label^="Bag"] > span', 0);
    await page.mouse.move(bag.x + bag.width / 2, bag.y + bag.height / 2); await sleep(400);
    await shot(page, `${P}-hover`, fit(screen, W, H));
    await page.mouse.move(W / 2, 80); await sleep(300);
    await page.evaluate(() => document.querySelector('[data-testid=phone] [aria-label^="Friends"]')?.focus());
    await sleep(500);
    log.push({ focusVisible: await page.evaluate(() => document.activeElement?.matches(":focus-visible")) });
    await shot(page, `${P}-pick`, fit(screen, W, H));
    await page.evaluate(() => document.activeElement?.blur());
  }
  await page.click('[data-testid=phone] [aria-label^="Mail"]'); await sleep(1500);
  await shot(page, `${P}-app-mail`);
  await page.keyboard.press("Escape"); await sleep(1500);
  await shot(page, `${P}-back`);
  if (phone) return;
  // Put away: hold the presence's unmount (400 ms) so the reverse can be seeked frame by frame.
  await page.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 400 ? 60000 : ms, ...a); });
  await page.keyboard.press("y");
  await frames(page, `${P}-away`, CLOSE_T, corner);
}

const run = async (name, fn, view, extra) => {
  const page = await open(view, extra);
  try { await fn(page, name); } catch (e) { log.push({ failed: name, error: String(e).slice(0, 400) }); console.log("FAILED", name, String(e).slice(0, 400)); await shot(page, `${name}-zz-failed`).catch(() => {}); }
  await page.context().close();
};
const still = (W, H) => async (page, name) => {
  await page.keyboard.press("Escape"); await sleep(1800);
  await page.mouse.move(W / 2, 80);
  await shot(page, `${name}-phone`);
  await rects(page, name);
  await shot(page, `${name}-phone-close`, fit(await box(page, "[data-testid=phone]"), W, H));
};
if (SCENES.includes("ui")) await run("u", ui, DESKTOP);
if (SCENES.includes("ui-phone")) await run("p", ui, PHONE);
if (SCENES.includes("short")) await run("s", still(1440, 780), { viewport: { width: 1440, height: 780 } });
if (SCENES.includes("smooth")) await run("m", still(1440, 900), DESKTOP, { "tsi.pixelated.v1": "false" });
if (SCENES.includes("reduced")) await run("r", async page => {
  await page.keyboard.press("y"); await sleep(60);
  await shot(page, "r-60ms", { x: 1440 - 560, y: 900 - 760, width: 560, height: 760 });
}, { ...DESKTOP, reducedMotion: "reduce" });
writeFileSync(`${OUT}/log-${SCENES.join("-")}.json`, JSON.stringify(log, null, 1));
await browser.close();
