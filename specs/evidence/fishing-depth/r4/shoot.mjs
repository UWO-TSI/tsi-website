// fishing-depth round 4 evidence: headless Chromium (never a window), muted, signed out, the dev server on :3147 with
// the Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new, the new world (/lab/island) with the demo data.
//   VIEW=phone node specs/evidence/fishing-depth/r4/shoot.mjs <out_dir> <flow> [<flow> ...]
// VIEW: desktop (1280 x 800, the default) or phone (390 x 844, touch). Flows: showroom, board, world, market, sellms, menu.
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

const FLOW = {
  async showroom() {
    await page.goto(`${HOST}/lab/gui?only=flat-pieces`, { waitUntil: "domcontentloaded" });
    await wait(6000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await shot("showroom");
    await page.locator('button[aria-label="rare"]').first().hover();
    await wait(500);
    await shot("showroom-hover", page, { clip: { x: 0, y: 0, width: VW, height: 420 } });
  },
  async board() {
    await world("at=68.2,26.6&time=day");
    await shot("board-sheet");
    const thumbs = testid("catch-board").locator("button[aria-label]");
    const n = await thumbs.count();
    console.log("board thumbs", n);
    await thumbs.nth(Math.min(5, n - 1)).hover();
    await wait(600);
    await shot("board-sheet-hover");
  },
  async world() {
    for (const [name, at] of [["board-world", "71.74,28.4"], ["board-world-close", "68.2,26.6"], ["board-world-tasks", "61.32,29.24"], ["board-world-far", "70.4,26.2"]]) {
      await world(`at=${at}&time=day`, { press: false, settle: 10000 });
      if (name.endsWith("far")) { await page.mouse.move(VW / 2, VH / 2); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 240); await wait(300); } await wait(1500); }
      await shot(name);
    }
  },
  async tasks() {
    await world("at=61.32,29.24&time=day");
    await shot("tasks-board");
    const panel = testid("task-board");
    await panel.getByRole("button", { name: "Claim" }).first().click({ force: true }).catch(e => console.log("claim", e.message.slice(0, 100)));
    for (const [i, ms] of [[1, 120], [2, 200], [3, 350], [4, 900]]) { await wait(ms); await shot(`tasks-claim-${i}`, panel); }
  },
  async market() {
    await world("at=71.74,28.4&time=day");
    await shot("market-sell");
    await click("Monthly board");
    await shot("market-board");
    await click("Fishing tasks");
    await shot("market-tasks");
  },
  async tackle() {
    await world("at=70.64,63.37&time=day");
    await shot("tackle-counter");
    await page.locator('button:has-text("×1")').first().click().catch(e => console.log("x1", e.message.slice(0, 100)));
    await wait(700);
    await shot("tackle-1-flip");
    await wait(2500);
    await shot("tackle-1");
    await page.keyboard.press("Escape").catch(() => {});
    await world("at=70.64,63.37&time=day");
    await click("Gem counter");
    await shot("tackle-gems");
    await page.locator('button:has-text("×10")').first().click().catch(e => console.log("x10", e.message.slice(0, 100)));
    await wait(900);
    await shot("tackle-10-flip");
    await wait(3600);
    await shot("tackle-10");
  },
  /** Quick sell, click to update: a sale's server answer held 300 ms (about production's round trip), three sells timed. */
  async sellms() {
    await world("at=71.74,28.4&time=day");
    // The demo answers in the page (lib/game/collectionsDemo.ts patches fetch), so hold each sale there.
    await page.evaluate(() => { const f = window.fetch; window.__held = 0; window.fetch = async (...a) => { if (String(a[0]).includes("/api/economy/sell") && a[1]?.method === "POST") { window.__held++; await new Promise(r => setTimeout(r, 300)); } return f(...a); }; });
    for (let i = 0; i < 3; i++) {
      const ms = await page.evaluate(() => new Promise(res => {
        // Each frame, read the fish and the purse afresh (React may swap the nodes); done when either changes.
        const read = () => [...document.querySelectorAll('[data-testid="fish-market"] [role="list"] button, [data-testid="fish-market"] header')].map(e => e.textContent + e.getAttribute("aria-label")).join("|");
        const target = document.querySelector('[data-testid="fish-market"] [role="list"] button');
        if (!target) return res("no fish");
        const before = read(), t0 = performance.now();
        const tick = () => (read() !== before ? res(Math.round(performance.now() - t0)) : performance.now() - t0 > 5000 ? res("no change in 5 s") : requestAnimationFrame(tick));
        target.click();
        requestAnimationFrame(tick);
      }));
      console.log("sell click to update ms", ms, "sales held so far", await page.evaluate(() => window.__held));
      await wait(1500);
    }
    await shot("market-sold");
  },
  /** The big catch board at three spots (A grass at the wharf's edge, B the boardwalk past the sell stall, C the boardwalk before the market's door), each seen from the stall and walking up the wharf. */
  async spots() {
    const file = new URL("../../../../web/lib/game/wharf.ts", import.meta.url), was = readFileSync(file, "utf8");
    const SPOTS = { A: "x: -5.4, z: 7.6, turn: Math.PI + 0.35", B: "x: 2.53, z: 10.42, turn: Math.PI - 0.2", C: "x: -0.69, z: 7.63, turn: Math.PI - 0.2" };
    try {
      for (const [k, spot] of Object.entries(SPOTS)) {
        writeFileSync(file, was.replace(/catch: \{ x: [^}]+\}, tasks:/, `catch: { ${spot} }, tasks:`));
        await wait(4000);
        for (const [view, at] of [["stall", "71.74,28.4"], ["walk", "68.6,35.5"], ["grass", "62.4,31.6"]]) {
          await world(`at=${at}&time=day`, { press: false, settle: 9000 });
          await shot(`spot-${k}-${view}`);
        }
      }
    } finally { writeFileSync(file, was); }
  },
  /** The cover with each of the three lines on offer (the first is the game's; the others written in for the review). */
  async covers() {
    await world("at=-47,114.4&time=19.5", { settle: 12000 });
    await page.locator("button:text-is('Menu')").first().click({ timeout: 10000 }).catch(e => console.log("menu", e.message.slice(0, 120)));
    await wait(2000);
    const LINES = ["Sit anywhere. The rice is still warm.", "Whatever the boats brought in today.", "Bring your best fish. Bancha knows what to do with it."];
    for (const [i, line] of LINES.entries()) {
      await page.evaluate(l => { const el = document.querySelector("[data-cover-line]"); if (el) el.textContent = l; }, line);
      await wait(300);
      await shot(`cover-option-${i + 1}`);
    }
  },
  /** The water signs mock (a proposal, not built), rendered from its HTML. */
  async signs() {
    await page.goto(new URL("./signs-mock.html", import.meta.url).href);
    await wait(800);
    await shot("signs-mock", page, { fullPage: true });
  },
  async chef() {
    await world("at=-45.25,115.6&time=day");
    await shot("chef-order");
  },
  async menudebug() {
    await world("at=-47,114.4&time=19.5", { settle: 12000 });
    await click("Menu", 1800);
    const cover = await page.getByRole("button", { name: "Open the menu" }).boundingBox();
    await page.mouse.click(cover.x + cover.width / 2, cover.y + cover.height / 2);
    await wait(1500);
    for (let k = 0; k < 3; k++) {
      const info = await page.evaluate(() => {
        const b = document.querySelector('[aria-label="Turn the page"]');
        if (!b) return "no turn button";
        const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return `turn ${Math.round(r.x)},${Math.round(r.y)} top=${top?.tagName}.${String(top?.className).slice(0, 40)} ${top?.getAttribute("aria-label")}`;
      });
      console.log(info);
      const next = await page.getByRole("button", { name: "Turn the page" }).boundingBox().catch(() => null);
      if (next) await page.mouse.click(next.x + next.width / 2, next.y + next.height / 2);
      await wait(1300);
      console.log("folio", await page.evaluate(() => [...document.querySelectorAll('[aria-roledescription="folded menu"] [data-on]')].length));
    }
  },
  async menu() {
    await world("at=-47,114.4&time=19.5", { settle: 12000 });
    await wait(3000);
    await shot("menu-1-seated");
    await page.locator("button:text-is('Menu')").first().click({ timeout: 10000 }).catch(e => console.log("menu", e.message.slice(0, 120)));
    await wait(300);
    await shot("menu-2-rising");
    await wait(1500);
    await shot("menu-3-cover");
    const cover = await page.getByRole("button", { name: "Open the menu" }).boundingBox();
    if (cover) await page.mouse.click(cover.x + cover.width / 2, cover.y + cover.height / 2);
    await wait(260); await shot("menu-4-opening-a");
    await wait(220); await shot("menu-4-opening-b");
    await wait(900);
    await shot("menu-5-spread-1");
    const rows = testid("sushi-menu").locator("button[aria-expanded]");
    for (let i = 0; i < await rows.count(); i++) {
      await rows.nth(i).hover({ force: true });
      await wait(450);
      const box = await rows.nth(i).boundingBox();
      if (box) await shot(`menu-hover-${i}`, page, { clip: { x: box.x - 12, y: box.y - 10, width: box.width + 24, height: box.height + 20 } });
    }
    await page.mouse.move(4, VH - 4);
    const next = await page.getByRole("button", { name: "Turn the page" }).boundingBox();
    if (next) await page.mouse.click(next.x + next.width / 2, next.y + next.height / 2); else console.log("no turn button");
    await wait(240); await shot("menu-6-turning-a");
    await wait(200); await shot("menu-6-turning-b");
    await wait(900);
    await shot("menu-7-spread-2");
    await rows.first().click({ force: true }).catch(() => {});
    await wait(600);
    await shot("menu-8-picked");
  },
};
for (const f of FLOWS) {
  try { await FLOW[f](); } catch (e) { console.log("flow", f, e.message.slice(0, 200)); }
}
await browser.close();
