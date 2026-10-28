// The applicant island's fishing overlay (components/game/FishingOverlay.tsx; applicant only, unchanged by the member UI
// work), shot the same way on main and on the branch, headless and muted, signed out, against a dev server with the
// Supabase env blanked. Two modes:
//   island  /student/apply/portal?preview=1 (the real island, real time): the meter, the reel and the catch card.
//   lab     /lab/fa (a scratch page that mounts <FishingOverlay collectionScope="lab" zoneOverride="sea" /> alone, no world; same file on both), on a fake clock stepped 16 ms at a time with
//           Math.random seeded, so the same code draws the same frames: the overlay boxes can be compared pixel for pixel.
//   PORT=3172 MODE=lab node specs/evidence/fish-tiers/ui-world/applicant.mjs <out_dir> <tag>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");

const [OUT, TAG = "a"] = process.argv.slice(2);
const HOST = `http://localhost:${process.env.PORT ?? 3172}`, MODE = process.env.MODE ?? "lab";
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(TAG, ...a);
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob",
  top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} };

const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.welcomed.v1", "1"); } catch {} }, JSON.stringify(LOOK));
const page = await ctx.newPage();
page.on("pageerror", e => log("pageerror", e.message.slice(0, 300)));

// The reel as the bot sees it (the applicant overlay's DOM: a 46 px track, its bar, the fish icon).
const PARTS = `(reel) => {
  const track = reel.querySelector('div[style*="height: 46px"]');
  const win = track?.firstElementChild?.getBoundingClientRect(), fish = track?.querySelector("img")?.getBoundingClientRect();
  if (!win || !fish) return null;
  const fx = fish.left + fish.width / 2, bar = reel.querySelector('[role="progressbar"]');
  return { wx: win.left + win.width / 2, fx, inside: fx >= win.left && fx <= win.right, progress: Math.max(Number(bar?.getAttribute("aria-valuenow")) || 0, parseFloat(bar?.style.width) || 0) };
}`;
const BOT = `(() => {
  const parts = ${PARTS};
  let held = false, prev = null, ms = 0;
  const send = type => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
  window.__bot = () => {
    const reel = document.querySelector('[aria-label="Fishing reel"]'), p = reel && parts(reel);
    ms += 16;
    if (p) {
      const vel = prev === null ? 0 : (p.wx - prev) / 16; prev = p.wx;
      const want = p.fx > p.wx + vel * 300;
      if (want !== held) { send(want ? "pointerdown" : "pointerup"); held = want; }
    } else if (held) { send("pointerup"); held = false; }
    return p;
  };
})()`;
const phase = () => page.evaluate(() => document.querySelector("[data-fishing-overlay]")?.getAttribute("data-fishing-overlay") ?? (document.querySelector('[role="dialog"][aria-label^="You caught"], [role="dialog"][aria-label="A catch"]') ? "card" : "idle"));
const key = k => page.evaluate(([t, k]) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true, cancelable: true })), k);

if (MODE === "island") {
  await page.goto(`${HOST}/student/apply/portal?preview=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await sleep(14000);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: `${OUT}/island-${TAG}.png` });
  await page.evaluate(BOT);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: 0, z: 0 } })));
  await sleep(1100);
  await page.screenshot({ path: `${OUT}/meter-${TAG}.png` });
  await key(["keyup", "e"]);
  for (let i = 0; i < 400 && (await phase()) !== "bite"; i++) await sleep(50);
  await sleep(250);
  await key(["keydown", "e"]);
await sleep(60); await key(["keyup", "e"]); // a tap: the reel must not start with E held
  let shot = false;
  for (let i = 0; i < 4000; i++) {
    const p = await page.evaluate(() => window.__bot?.());
    if (p && !shot && p.inside && p.progress > 45) { await page.screenshot({ path: `${OUT}/reel-${TAG}.png` }); shot = true; }
    const ph = await phase();
    if (ph === "card" || ph === "missed") break;
    await sleep(16);
  }
  await sleep(2600);
  await page.screenshot({ path: `${OUT}/card-${TAG}.png` });
  log("phase at end", await phase(), "reel shot", shot);
  await browser.close();
  process.exit(0);
}

// lab: the fake clock. Everything before the first step is real; from then on time moves only when we say.
await page.goto(`${HOST}/lab/fa`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("[data-loop-start]", { timeout: 300000 });
await sleep(3000);
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1000);
await page.evaluate(seed => { let s = seed; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, Number(process.env.SEED ?? 12345));
await page.evaluate(BOT);
const step = async n => { for (let i = 0; i < n; i++) { await page.clock.runFor(16); } };
const shoot = async (name, selector) => { await page.locator(selector).first().screenshot({ path: `${OUT}/${name}-${TAG}.png`, animations: "disabled" }); };
await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:fish-start", { detail: { x: 0, z: 0 } })));
await step(60);
await shoot("meter", "[data-fishing-overlay]");
await key(["keyup", "e"]);
let n = 0;
while ((await phase()) !== "bite" && n++ < 1500) await step(1);
log("bite after", n, "steps");
await step(14);
await shoot("bite", "[data-fishing-overlay]");
await key(["keydown", "e"]);
await sleep(60); await key(["keyup", "e"]); // a tap: the reel must not start with E held
await step(2);
let k = 0, shots = 0;
while (n < 6000) {
  const ph = await phase();
  if (ph === "card" || ph === "missed" || ph === "idle") break;
  const p = await page.evaluate(() => window.__bot?.());
  if (p && ++k === 90 || k === 240) { await shoot(`reel-${++shots}`, '[aria-label="Fishing reel"]'); }
  await step(1); n++;
}
log("phase", await phase(), "after", n, "steps");
await step(100); // the card holds a few seconds (fake time) before it closes itself
await sleep(3000); // its CSS entrance runs on the real clock: let it settle
await page.screenshot({ path: `${OUT}/card-page-${TAG}.png` });
if ((await phase()) === "card") await shoot("card", '[role="dialog"][aria-label^="You caught"], [role="dialog"][aria-label="A catch"]');
await browser.close();
