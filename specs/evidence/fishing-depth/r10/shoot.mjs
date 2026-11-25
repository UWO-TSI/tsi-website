// fishing-depth round 10 evidence: headless Chromium (never a window), muted, signed out, the dev server on :3147 with
// the Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new, the new world (/lab/island) with the demo data.
//   VIEW=phone node specs/evidence/fishing-depth/r10/shoot.mjs <out_dir> <flow> [<flow> ...]
// VIEW: desktop (1280 x 800, the default) or phone (390 x 844, touch).
// Flows: world (the board from the wharf, close, far), turn (the camera turned to the board's face, the stands and the
// lamp post: TURN=1500 ZOOM=-240 on a desktop, TURN=1650 ZOOM=240 on a phone), hud (the place tag under the time at each
// spot in PLACES; ONLY_PLACES=a,b for some), places (the showroom's row of every place tag). Weather pinned clear and the
// clock pinned (CLOCK, 14:00 on 2026-11-05 by default), so before and after shots share the time of day. NIGHT=1: 21:30, night.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...FLOWS] = process.argv.slice(2);
mkdirSync(`${OUT}/frames`, { recursive: true });
const HOST = "http://localhost:3147";
const SKY = process.env.NIGHT ? `time=night&at=${process.env.CLOCK ?? "21:30"}` : `time=day&at=${process.env.CLOCK ?? "14:00"}`;
const N = process.env.NIGHT ? "-night" : "";
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
/** Where to stand for the place tag: inside each painted area, away from water. */
const PLACES = { village: "17,50", meadow: "0,0", mountain: "1,-47", ruins: "45,-32", temple: "-4,-53", cave: "8,-26" };
const FLOW = {
  async world() {
    for (const [name, at, dy, n] of [[`f10-board-world${N}`, "71.74,28.4", 0, 0], [`f10-board-close${N}`, "71.74,28.4", -240, 3], [`f10-board-far${N}`, "73.5,31.5", 240, 4]]) {
      await world(`at=${at}&${SKY}&date=2026-11-05&weather=clear`, { press: false, settle: 10000 });
      if (n) await zoom(dy, n);
      await shot(name);
    }
  },
  /** The camera turned round (the arrow keys) from the deck past the stall, looking back at the board's face and the stall's front: `TURN` ms of ArrowLeft, else a sweep. */
  async turn() {
    await world(`at=${process.env.AT ?? "71.2,31.8"}&${SKY}&date=2026-11-05&weather=clear`, { press: false, settle: 10000 });
    const hold = async ms => { await page.keyboard.down("ArrowLeft"); await wait(ms); await page.keyboard.up("ArrowLeft"); await wait(900); };
    if (!process.env.TURN) { for (let i = 0; i < 10; i++) { await hold(250); await shot(`turn-${i}`); } return; }
    await hold(Number(process.env.TURN));
    if (process.env.ZOOM) await zoom(Number(process.env.ZOOM), 2);
    await shot(`f10-board-face${N}`);
  },
  async hud() {
    for (const [k, at] of Object.entries(PLACES)) {
      if (process.env.ONLY_PLACES && !process.env.ONLY_PLACES.split(",").includes(k)) continue;
      await world(`at=${at}&${SKY}&date=2026-11-05&weather=clear`, { press: false, settle: 10000 });
      await shot(`f10-hud-${k}`);
      await shot(`f10-hud-${k}-crop`, page, { clip: PHONE ? { x: VW - 200, y: 0, width: 200, height: 260 } : { x: VW - 460, y: 40, width: 460, height: 300 } });
    }
  },
  async places() {
    await page.goto(`${HOST}/lab/gui?only=flat-pieces`, { waitUntil: "domcontentloaded" });
    await wait(6000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await shot("f10-icons-row", page.locator('[data-testid="place-tags"]').first());
  },
};
for (const f of FLOWS) {
  try { await FLOW[f](); } catch (e) { console.log("flow", f, e.message.slice(0, 200)); }
}
await browser.close();
