// fishing-depth round 6 evidence: headless Chromium (never a window), muted, signed out, the dev server on :3147 with
// the Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new, the new world (/lab/island) with the demo data.
//   VIEW=phone node specs/evidence/fishing-depth/r6/shoot.mjs <out_dir> <flow> [<flow> ...]
// VIEW: desktop (1280 x 800, the default) or phone (390 x 844, touch).
// Flows: world (the board from the stall, close, far), turn (the camera turned to the board's face; frames of its fish and the sell bin),
// signs (where the water signs stood), hud (the biome tag by the sea and the river), reel (the showroom's fishing bar),
// sold (a sale: frames from the click to the wallet), showroom (the flat pieces, the coin fly).
// Frames land in <out>/frames/<name>-NN.png; strips.sh builds the strips from them.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...FLOWS] = process.argv.slice(2);
mkdirSync(`${OUT}/frames`, { recursive: true });
const HOST = "http://localhost:3147";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const PHONE = process.env.VIEW === "phone";
const VW = PHONE ? 390 : 1280, VH = PHONE ? 844 : 800;
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: PHONE ? 2 : 1, reducedMotion: "no-preference", ...(PHONE ? { isMobile: true, hasTouch: true } : {}) });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404/i.test(m.text())) console.log("console", m.text().slice(0, 240)); });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
await page.evaluate(l => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", "false"); }, JSON.stringify(LOOK));

const shot = async (name, target = page, opts = {}) => {
  await target.screenshot({ path: `${OUT}/${name}.png`, ...opts }).catch(e => console.log("shot", name, e.message.slice(0, 160)));
  console.log("shot", name);
};
const wait = ms => page.waitForTimeout(ms);
/** `n` frames of the page every `ms` into frames/<name>-NN.png. */
async function frames(name, n, ms, opts = {}) {
  for (let i = 0; i < n; i++) {
    const t = Date.now();
    await page.screenshot({ path: `${OUT}/frames/${name}-${String(i).padStart(2, "0")}.png`, ...opts }).catch(e => console.log("frame", name, e.message.slice(0, 120)));
    await wait(Math.max(0, ms - (Date.now() - t)));
  }
  console.log("frames", name, n);
}
/** The new world at (x, z), signed out with the demo's pockets; E pressed when `press`. */
async function world(query, { press = true, settle = 9000 } = {}) {
  await page.goto(`${HOST}/lab/island?collections=demo&tasks=1&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => {});
  await wait(settle);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; } p[role="status"][style*="top: 48"] { display: none !important; }' });
  await page.locator("canvas").first().click({ position: { x: VW / 2, y: VH / 2 } }).catch(() => {});
  await page.mouse.move(4, VH - 4);
  if (press) { await page.keyboard.press("e"); await wait(1800); }
}
const zoom = async (dy, n) => { await page.mouse.move(VW / 2, VH / 2); for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy); await wait(300); } await wait(1500); await page.mouse.move(4, VH - 4); };
/** Where the water signs stood (round 5): the spot a few steps short, the camera behind. */
const SIGNS = { river: "-38.0,46.0", pond: "24.5,12.8", sea: "78.2,41.1", deep: "89.6,41.7" };
/** Where to stand for the biome tag: on the deck by the sea, on the river's bank by the bridge. */
const WATERS = { sea: "71.74,28.4", river: "-38.0,46.0" };
const FLOW = {
  async world() {
    for (const [name, at, dy, n] of [["f6-board-world", "71.74,28.4", 0, 0], ["f6-board-close", "71.74,28.4", -240, 3], ["f6-board-far", "73.5,31.5", 240, 4]]) {
      await world(`at=${at}&time=day`, { press: false, settle: 10000 });
      if (n) await zoom(dy, n);
      await shot(name);
    }
  },
  /** The camera turned round (the arrow keys) from the deck past the stall, looking back at the board's face and the stall's front: `TURN` ms of ArrowLeft, else a sweep. */
  async turn() {
    await world(`at=${process.env.AT ?? "71.2,31.8"}&time=day`, { press: false, settle: 10000 });
    const hold = async ms => { await page.keyboard.down("ArrowLeft"); await wait(ms); await page.keyboard.up("ArrowLeft"); await wait(900); };
    if (!process.env.TURN) { for (let i = 0; i < 10; i++) { await hold(250); await shot(`turn-${i}`); } return; }
    await hold(Number(process.env.TURN));
    if (process.env.ZOOM) await zoom(Number(process.env.ZOOM), 2);
    await shot("f6-board-face");
    // The board's fish on its roof and the fish in the sell bin, a frame every 120 ms for 4.8 s.
    await frames("f6-motion", 40, 120);
  },
  async signs() {
    for (const [k, at] of Object.entries(SIGNS)) {
      await world(`at=${at}&time=day`, { press: false, settle: 10000 });
      await shot(`f6-sign-${k}`);
    }
  },
  async hud() {
    for (const [k, at] of Object.entries(WATERS)) {
      await world(`at=${at}&time=day`, { press: false, settle: 10000 });
      await shot(`f6-hud-${k}`);
      if (!PHONE) await shot(`f6-hud-${k}-crop`, page, { clip: { x: VW - 460, y: 40, width: 460, height: 300 } });
    }
  },
  async reel() {
    await page.goto(`${HOST}/lab/gui`, { waitUntil: "domcontentloaded" });
    await wait(6000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await shot("f6-reel", page.locator("#fishing").first());
  },
  /** A sale at the stall: the sheet, then frames from the click on a fish to the wallet, the animations at a fifth of their speed. */
  async sold() {
    await world("at=71.74,28.4&time=day", { press: false });
    // The lab's dev bar (dev only) covers a phone sheet's purse: off for the sale.
    if (PHONE) await page.addStyleTag({ content: "nav:has(> span) { display: none !important; }" });
    await page.keyboard.press("e");
    await page.waitForSelector('[data-testid="fish-market"] [role="list"] button', { timeout: 10000 }).catch(() => {});
    await wait(1500);
    await shot("f6-sell");
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.2 });
    await page.locator('[data-testid="fish-market"] [role="list"] button').nth(1).click();
    await frames("f6-sold", 36, 140);
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
    await wait(1500);
    await shot("f6-sold");
    // Sell all: every fish's coins at once.
    await page.getByRole("button", { name: "Sell all", exact: true }).click().catch(e => console.log("sell all", e.message.slice(0, 120)));
    await frames("f6-sold-all", 16, 120);
    await wait(1500);
    await shot("f6-sold-all");
  },
  async showroom() {
    await page.goto(`${HOST}/lab/gui?only=flat-pieces`, { waitUntil: "domcontentloaded" });
    await wait(6000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await shot("f6-showroom");
    await page.goto(`${HOST}/lab/gui?only=coin-fly`, { waitUntil: "domcontentloaded" });
    await wait(4000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await frames("f6-showroom-fly", 24, 100);
  },
};
for (const f of FLOWS) {
  try { await FLOW[f](); } catch (e) { console.log("flow", f, e.message.slice(0, 200)); }
}
await browser.close();
