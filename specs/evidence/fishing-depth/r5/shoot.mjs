// fishing-depth round 5 evidence: headless Chromium (never a window), muted, signed out, the dev server on :3147 with
// the Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new, the new world (/lab/island) with the demo data.
//   VIEW=phone node specs/evidence/fishing-depth/r5/shoot.mjs <out_dir> <flow> [<flow> ...]
// VIEW: desktop (1280 x 800, the default) or phone (390 x 844, touch). Flows: showroom, board, world, market, signs, cover, spots.
// BOARD: the catch board's reading spot "x,z" (default the round 5 spot).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...FLOWS] = process.argv.slice(2);
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
const click = async (name, ms = 1200) => {
  await page.getByRole("button", { name, exact: true }).first().click({ timeout: 10000 }).catch(e => console.log("click", name, e.message.slice(0, 120)));
  await wait(ms);
};
const testid = id => page.locator(`[data-testid="${id}"]`).first();


const BOARD = process.env.BOARD ?? "69.07,25.70";
/** The four water signs: where to stand to see each (the sign a few steps ahead, the camera behind). */
const SIGNS = { river: "-38.0,46.0", pond: "24.5,12.8", sea: "78.2,41.1", deep: "89.6,41.7" };
const FLOW = {
  async showroom() {
    await page.goto(`${HOST}/lab/gui?only=flat-pieces`, { waitUntil: "domcontentloaded" });
    await wait(6000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await shot("f5-showroom");
  },
  async board() {
    await world(`at=${BOARD}&time=day`);
    await shot("f5-board");
    const chips = testid("catch-board").locator("dl").first();
    await shot("f5-board-chips", chips);
    const thumbs = testid("catch-board").locator("button[aria-label]");
    const n = await thumbs.count();
    console.log("board thumbs", n);
    await thumbs.nth(Math.min(5, n - 1)).hover();
    await wait(600);
    await shot("f5-board-hover");
  },
  async world() {
    const zoom = async (dy, n) => { await page.mouse.move(VW / 2, VH / 2); for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy); await wait(300); } await wait(1500); await page.mouse.move(4, VH - 4); };
    for (const [name, at, dy, n] of [["f5-board-world", "71.74,28.4", 0, 0], ["f5-board-close", "71.74,28.4", -240, 3], ["f5-board-far", "73.5,31.5", 240, 4]]) {
      await world(`at=${at}&time=day`, { press: false, settle: 10000 });
      if (n) await zoom(dy, n);
      await shot(name);
    }
  },
  /** The fish market: the first frames after E (any loading shows here), the open sheet, a sale and its click to update. */
  async market() {
    await world("at=71.74,28.4&time=day", { press: false });
    await page.evaluate(() => { const f = window.fetch; window.fetch = async (...a) => { if (/\/api\/economy\/(sell|wallet)/.test(String(a[0]))) await new Promise(r => setTimeout(r, 300)); return f(...a); }; });
    const t0 = Date.now();
    await page.keyboard.press("e");
    await page.waitForSelector('[data-testid="fish-market"]', { timeout: 10000 }).catch(() => {});
    await shot("f5-sell-open-first-frame");
    const listMs = await page.evaluate(t => new Promise(res => { const tick = () => document.querySelector('[data-testid="fish-market"] [role="list"] button') ? res(Date.now() - t) : Date.now() - t > 8000 ? res("none in 8 s") : requestAnimationFrame(tick); tick(); }), t0);
    console.log("E to fish cards ms", listMs, "(wallet and list answers held 300 ms)");
    await wait(1500);
    await shot("f5-sell");
    for (let i = 0; i < 3; i++) {
      const ms = await page.evaluate(() => new Promise(res => {
        const read = () => [...document.querySelectorAll('[data-testid="fish-market"] [role="list"] button, [data-testid="fish-market"] header')].map(e => e.textContent + e.getAttribute("aria-label")).join("|");
        const target = document.querySelector('[data-testid="fish-market"] [role="list"] button');
        if (!target) return res("no fish");
        const before = read(), t0 = performance.now();
        const tick = () => (read() !== before ? res(Math.round(performance.now() - t0)) : performance.now() - t0 > 5000 ? res("no change in 5 s") : requestAnimationFrame(tick));
        target.click();
        requestAnimationFrame(tick);
      }));
      console.log("sell click to update ms", ms);
      if (i === 0) await shot("f5-sold-instant");
      await wait(900);
    }
    await shot("f5-sold");
  },
  async signs() {
    for (const [k, at] of Object.entries(SIGNS)) {
      await world(`at=${at}&time=day`, { press: false, settle: 10000 });
      await shot(`f5-sign-${k}`);
      await page.mouse.move(VW / 2, VH / 2);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -240); await wait(300); }
      await wait(1500);
      await page.mouse.move(4, VH - 4);
      await shot(`f5-sign-${k}-close`);
    }
  },
  async cover() {
    await world("at=-47,114.4&time=19.5", { settle: 12000 });
    await page.locator("button:text-is('Menu')").first().click({ timeout: 10000 }).catch(e => console.log("menu", e.message.slice(0, 120)));
    await wait(2000);
    await shot("f5-cover");
  },
  /** Candidate spots for the catch board (world x, z and its face's turn), each from the stall and the reading spot. */
  async spots() {
    const file = new URL("../../../../web/lib/game/wharf.ts", import.meta.url), was = readFileSync(file, "utf8");
    const SPOTS = JSON.parse(process.env.SPOTS ?? "{}");
    try {
      for (const [k, spot] of Object.entries(SPOTS)) {
        writeFileSync(file, was.replace(/catch: \{ x: [^}]+\}, tasks:/, `catch: { ${spot.at} }, tasks:`));
        await wait(4000);
        for (const [view, at] of [["stall", "71.74,28.4"], ["read", spot.read], ["deck", "71.6,33.5"]]) {
          await world(`at=${at}&time=day`, { press: false, settle: 9000 });
          await shot(`spot-${k}-${view}`);
        }
      }
    } finally { writeFileSync(file, was); }
  },
};
for (const f of FLOWS) {
  try { await FLOW[f](); } catch (e) { console.log("flow", f, e.message.slice(0, 200)); }
}
await browser.close();
