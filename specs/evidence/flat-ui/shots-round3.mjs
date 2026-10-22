// Flat UI round 3 (specs/polish/flat-ui.md): the bag's and the collection's side panels (more room, a bigger picture),
// the cells' hover and select motion (stills, and a filmstrip seeked frame by frame through the Web Animations API, so
// each frame is the exact time), and the avatar creator. Headless and muted; the dev server on PORT with the Supabase
// env blanked. Run from web/:
//   PORT=3192 node ../specs/evidence/flat-ui/shots-round3.mjs <out-dir> [panels|stills|film|creator ...]
// The creator's shots use /dev/flat-ui?surface=wardrobe|creator|creator-applicant.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3192, HOST = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const PHONE = { width: 390, height: 844, mobile: true };
async function newPage({ width = 1440, height = 900, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  return { ctx, page };
}
const hideDev = page => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
const shot = async (page, name, { move = true, wait = 700 } = {}) => {
  if (move) await page.mouse.move(1, 1);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("shot", name);
};
const go = async (page, path, settle = 5000) => { await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(settle); await hideDev(page); };
const btn = (page, name) => page.getByRole("button", { name }).first();
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const BAG = "/dev/flat-ui?surface=bag&collections=demo&bag=19", COLLECTION = "/dev/flat-ui?surface=collection&collections=demo";

/** The animations and transitions under way held at `t` ms (a filmstrip frame); the first call picks them, so the
 *  finished entrances (the panel's rise, held by its fill) stay where they ended. */
const seek = (page, t, fresh = false) => page.evaluate(([t, fresh]) => {
  if (fresh || !window.__film) window.__film = document.getAnimations().filter(a => a.playState !== "finished");
  for (const a of window.__film) { a.pause(); a.currentTime = t; }
}, [t, fresh]);
/** The box round a card and its neighbours (`ring` cells each way), for the filmstrip's crop. */
async function around(page, locator, ring = 1) {
  const b = await locator.boundingBox();
  const pad = { x: (b.width + 12) * ring + 8, y: (b.height + 12) * ring + 8 };
  return { x: Math.max(0, b.x - pad.x), y: Math.max(0, b.y - pad.y), width: b.width + 2 * pad.x, height: b.height + 2 * pad.y };
}
async function film(page, name, clip, times) {
  for (const t of times) {
    await seek(page, t);
    await page.screenshot({ path: join(OUT, `${name}-${String(t).padStart(3, "0")}.png`), clip });
  }
  await page.evaluate(() => { for (const a of window.__film ?? []) a.play(); window.__film = null; });
  console.log("film", name, times.join(","));
}

/** Open a creator category (and wear `pick`, a tile's name) and shoot it; `bottom` scrolls the options to their end too. */
async function category(page, cat, name, { pick, bottom = false, wait = 3500 } = {}) {
  await page.click(`[data-cat="${cat}"]`);
  await page.waitForTimeout(wait);
  if (pick) { await page.click(`[role="tabpanel"] ul button[aria-label="${pick}"]`); await page.waitForTimeout(3500); }
  await shot(page, name, { wait: 300 });
  if (bottom) {
    await page.evaluate(() => { const el = document.querySelector('[role="tabpanel"] > div:nth-of-type(1), [role="tabpanel"] [data-scroll]'); if (el) el.scrollTop = el.scrollHeight; });
    await shot(page, `${name}-end`, { wait: 600 });
  }
}
const creatorPage = async (surface, size) => {
  const p = await newPage(size);
  await p.page.goto(`${HOST}/dev/flat-ui?surface=${surface}`, { waitUntil: "domcontentloaded" });
  await p.page.waitForSelector('[data-cat="hair"]', { timeout: 300000 });
  await p.page.waitForTimeout(9000); await hideDev(p.page);
  return p;
};

const SCENES = {
  creator: async () => {
    // The closet (wardrobe mode): hair (a two-colour style: Own, the second colour, the wheel), eyes, accessories, tops.
    let p = await creatorPage("wardrobe");
    await category(p.page, "hair", "c-closet-hair", { pick: "Dreads with a cap", bottom: true });
    await category(p.page, "eyes", "c-closet-eyes");
    await category(p.page, "accessories", "c-closet-accessories");
    await category(p.page, "tops", "c-closet-tops");
    await p.ctx.close();
    // The member's first creator (create mode, the name field).
    p = await creatorPage("creator");
    await category(p.page, "head", "c-creator-head");
    await category(p.page, "mouth", "c-creator-mouth");
    await category(p.page, "shoes", "c-creator-shoes");
    await p.ctx.close();
    // Phone.
    p = await creatorPage("wardrobe", PHONE);
    await category(p.page, "hair", "c-phone-closet-hair", { pick: "Dreads with a cap" });
    await category(p.page, "tops", "c-phone-closet-tops");
    await p.ctx.close();
    p = await creatorPage("creator", PHONE);
    await category(p.page, "head", "c-phone-creator-head");
    await p.ctx.close();
    // The applicant island's creator: unchanged.
    p = await creatorPage("creator-applicant");
    await category(p.page, "hair", "c-applicant-hair");
    await p.ctx.close();
  },

  panels: async () => {
    const { ctx, page } = await newPage();
    await go(page, BAG);
    await btn(page, /^Apple/).click(); await shot(page, "p-bag-side");
    await btn(page, "Fish").click(); await page.waitForTimeout(400); await btn(page, /^Black Bass/).click(); await shot(page, "p-bag-fish-side");
    await btn(page, "Clothes").click(); await page.waitForTimeout(1200); await btn(page, /^Hoodie|^Sage/).click(); await shot(page, "p-bag-clothes-side");
    await go(page, COLLECTION, 6500);
    await btn(page, /^Black Bass/).click(); await shot(page, "p-collection-side");
    await btn(page, /^Bugs/).click(); await page.waitForTimeout(1500); await btn(page, /^Common Butterfly/).click(); await shot(page, "p-collection-bug-side");
    await ctx.close();
    const p = await newPage(PHONE);
    await go(p.page, BAG);
    await btn(p.page, /^Apple/).click(); await shot(p.page, "p-bag-phone-side");
    await go(p.page, COLLECTION, 6500);
    await btn(p.page, /^Pale Chub/).click(); await shot(p.page, "p-collection-phone-side", { move: false });
    await p.ctx.close();
  },
  stills: async () => {
    const { ctx, page } = await newPage();
    await go(page, BAG);
    await btn(page, /^Tree branch/).hover(); await shot(page, "s-bag-hover", { move: false });
    await btn(page, /^Apple/).click(); await btn(page, /^Tree branch/).hover(); await shot(page, "s-bag-select-hover", { move: false });
    await go(page, COLLECTION, 6500);
    await btn(page, /^Dace/).click(); await btn(page, /^Pale Chub/).hover(); await shot(page, "s-collection-select-hover", { move: false });
    await go(page, "/dev/economy?view=overlay&section=items", 2000);
    await page.waitForSelector("[data-testid=shop-card]", { timeout: 300000 }); await page.waitForTimeout(1500);
    await page.getByTestId("shop-card").nth(1).hover(); await shot(page, "s-shop-hover", { move: false });
    await ctx.close();
  },
  film: async () => {
    const { ctx, page } = await newPage();
    await go(page, BAG);
    // Hover: quick (the pointer comes onto a card, the card grows, its neighbours step aside).
    const branch = btn(page, /^Tree branch/), branchCell = branch.locator("xpath=..");
    const clip = await around(page, branchCell);
    await page.mouse.move(1, 1); await page.waitForTimeout(400);
    await branch.hover(); await seek(page, 0, true);
    await film(page, "f-hover", clip, [0, 40, 80, 120, 160, 200]);
    // Select: slower. Open a panel on one card first (so the grid has settled beside it), then pick its neighbour.
    await page.mouse.move(1, 1);
    await btn(page, /^Apple/).click(); await page.waitForTimeout(800);
    const pick = btn(page, /^Tree branch/), pickCell = pick.locator("xpath=..");
    const clip2 = await around(page, pickCell);
    await pick.click(); await page.mouse.move(1, 1); await frames(page); await seek(page, 0, true);
    await film(page, "f-select", clip2, [0, 60, 120, 180, 240, 300, 360]);
    await ctx.close();
  },
};
for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
await browser.close();
writeFileSync(join(OUT, "done.txt"), new Date().toISOString());
