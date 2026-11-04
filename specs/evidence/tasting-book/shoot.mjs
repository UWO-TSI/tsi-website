// tasting-book evidence: headless Chromium (never a window), muted, signed out, the dev server on :3476 with
// the Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new, the new world (/lab/island) with the demo data.
//   VIEW=phone node specs/evidence/tasting-book/shoot.mjs <out_dir> <flow> [<flow> ...]
// VIEW: desktop (1280 x 800, the default) or phone (390 x 844, touch). Flows: showroom, counter (choice, cook, stamp, book), aquarium.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...FLOWS] = process.argv.slice(2);
const HOST = "http://localhost:3476";
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
const centre = async locator => {
  const box = await locator.boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); else console.log("no box");
};
const turnPage = async () => { await centre(page.getByRole("button", { name: "Turn the page" })); await wait(1100); };
/** The menu crop: the book in your hands. */
const menuBox = async () => (await page.locator('[aria-roledescription="folded menu"]').first().boundingBox());
const menuShot = async name => {
  const b = await menuBox();
  await shot(name, page, b ? { clip: { x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10), width: Math.min(VW - Math.max(0, b.x - 10), b.width + 20), height: Math.min(VH - Math.max(0, b.y - 10), b.height + 20) } } : {});
};

const FLOW = {
  async showroom() {
    await page.goto(`${HOST}/lab/gui?only=flat-pieces`, { waitUntil: "domcontentloaded" });
    await wait(6000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const buffs = testid("buff-showroom");
    if (await buffs.count()) { await buffs.scrollIntoViewIfNeeded().catch(() => {}); await wait(500); const bb = await buffs.boundingBox(); if (bb) await shot("tb3-showroom-buff", page, { clip: { x: bb.x, y: bb.y, width: Math.min(bb.width, VW - bb.x), height: bb.height } }); }
    const piece = page.getByText("Tasting book (paper)").first().locator("xpath=ancestor::section[1]");
    await piece.scrollIntoViewIfNeeded().catch(() => {});
    await wait(800);
    const b = await piece.boundingBox();
    await shot("tb-showroom", page, b ? { clip: { x: b.x, y: b.y, width: Math.min(b.width, VW - b.x), height: Math.min(b.height, VH) } } : {});
  },
  /** Seated at the bar: the counter's choice, a cook and its stamp landing, the book's pages, a gift to the tank. */
  async counter() {
    await world("at=-47,114.4&time=19.5&bag=23", { settle: 12000 });
    await wait(3000);
    await page.locator("button:text-is('Menu')").first().click({ timeout: 10000 }).catch(e => console.log("menu", e.message.slice(0, 120)));
    await wait(1800);
    await centre(page.getByRole("button", { name: "Open the menu" }));
    await wait(1200);
    await turnPage();
    await page.getByRole("button", { name: /Bancha's nigiri/ }).first().click({ force: true }).catch(e => console.log("nigiri", e.message.slice(0, 120)));
    await wait(700);
    await menuShot("tb-counter-fish");
    await page.getByRole("button", { name: "Salmon", exact: true }).first().click({ force: true }).catch(e => console.log("salmon", e.message.slice(0, 120)));
    await page.mouse.move(4, VH - 4);
    await wait(700);
    await shot("tb-counter-choice");
    await menuShot("tb-counter-choice-menu");
    await page.getByRole("button", { name: /^Cook it/ }).first().click({ force: true }).catch(e => console.log("cook", e.message.slice(0, 120)));
    await wait(250); await menuShot("tb-stamp-1-turning");
    // The page lands, then the stamp presses down on the new slot: close frames of it.
    await page.waitForFunction(() => !document.querySelector('[aria-roledescription="folded menu"] [data-dir]'), null, { timeout: 5000 }).catch(() => {});
    const slot = await page.locator("[data-fresh]").first().boundingBox();
    for (let i = 2; i <= 6; i++) {
      if (slot) await shot(`tb-stamp-${i}`, page, { clip: { x: slot.x - 90, y: slot.y - 50, width: slot.width + 180, height: slot.height + 100 } });
      await wait(60);
    }
    await wait(800); await menuShot("tb-stamp-landed");
    await turnPage();
    await menuShot("tb-book-empty");
    // Back to the counter: a pond fish goes to the tank, its page marks it.
    for (let i = 0; i < 2; i++) await centre(page.getByRole("button", { name: "Turn back" })), await wait(1100);
    await page.getByRole("button", { name: /Bancha's nigiri/ }).first().click({ force: true }).catch(() => {});
    await wait(600);
    const fish = testid("sushi-menu").locator('button[aria-pressed]');
    console.log("fish", await fish.evaluateAll(els => els.map(e => e.getAttribute("aria-label")).join(",")));
    await page.getByRole("button", { name: process.env.GIFT ?? "Bluegill", exact: true }).first().click({ force: true }).catch(e => console.log("gift", e.message.slice(0, 120)));
    await page.mouse.move(4, VH - 4);
    await wait(600);
    await menuShot("tb-counter-aquarium");
    await page.getByRole("button", { name: "For the aquarium" }).first().click({ force: true }).catch(e => console.log("gift", e.message.slice(0, 120)));
    await wait(600); await menuShot("tb-aquarium-mark-1");
    await wait(1600);
    await menuShot("tb-book-aquarium-mark");
  },
  /** Round 2 (tb2-*): the book's page and its dish locked, a first cook's fee and its lesson, the stamp, the dish learnt and ordered. */
  async book2() {
    await world("at=-47,114.4&time=19.5&bag=23&dish=1", { settle: 12000 });
    await wait(3000);
    await page.locator("button:text-is('Menu')").first().click({ timeout: 10000 }).catch(e => console.log("menu", e.message.slice(0, 120)));
    await wait(1800);
    await centre(page.getByRole("button", { name: "Open the menu" }));
    await wait(1200);
    await turnPage(); await turnPage();
    await menuShot("tb2-book-locked");
    await page.getByRole("button", { name: /Snapper chazuke/ }).first().click({ force: true }).catch(e => console.log("dish", e.message.slice(0, 120)));
    await wait(600); await menuShot("tb2-dish-locked");
    await centre(page.getByRole("button", { name: "Turn back" })); await wait(1100);
    await page.getByRole("button", { name: /Bancha's nigiri/ }).first().click({ force: true }).catch(e => console.log("nigiri", e.message.slice(0, 120)));
    await wait(700); await menuShot("tb2-nigiri");
    await page.getByRole("button", { name: "Red Snapper", exact: true }).first().click({ force: true }).catch(e => console.log("snapper", e.message.slice(0, 120)));
    await page.mouse.move(4, VH - 4);
    await wait(700);
    await shot("tb2-counter-choice");
    await menuShot("tb2-counter-choice-menu");
    await page.getByRole("button", { name: /^Cook it/ }).first().click({ force: true }).catch(e => console.log("cook", e.message.slice(0, 120)));
    await page.waitForFunction(() => !document.querySelector('[aria-roledescription="folded menu"] [data-dir]'), null, { timeout: 5000 }).catch(() => {});
    await wait(1400); await shot("tb2-stamp-toast"); await menuShot("tb2-stamp-landed");
    await centre(page.getByRole("button", { name: "Turn back" })); await wait(1100);
    await page.getByRole("button", { name: /Snapper chazuke/ }).first().click({ force: true }).catch(e => console.log("dish", e.message.slice(0, 120)));
    await wait(600); await menuShot("tb2-dish-learnt");
    await page.getByRole("button", { name: /^Order/ }).first().click({ force: true }).catch(e => console.log("order", e.message.slice(0, 120)));
    await wait(1200); await shot("tb2-dish-ordered");
    await page.locator("button:text-is('Menu')").first().click({ timeout: 10000 }).catch(e => console.log("menu", e.message.slice(0, 120)));
    await wait(1800);
    await centre(page.getByRole("button", { name: "Open the menu" }));
    await wait(1200); await menuShot("tb2-meal");
  },
  /** Round 3 (tb3-*): the calmer bar on a phone, the nigiri page, a key fish to the tank teaching its dish, the dishes in
   * the rod's stats, one ordered and its faint buff on the right of the screen. */
  async book3() {
    await world("at=-47,114.4&at=19:30&time=evening&bag=23&dish=1", { settle: 12000, press: false });
    // The first load can run long: press E until the stool takes you and the bar's Menu shows.
    for (let i = 0; i < 40 && !(await page.locator("button:text-is('Menu')").count()); i++) { await page.keyboard.press("e"); await wait(5000); }
    await wait(2000);
    await shot("tb3-bar");
    await page.locator("button:text-is('Menu')").first().click({ timeout: 10000 }).catch(e => console.log("menu", e.message.slice(0, 120)));
    await wait(1800);
    await centre(page.getByRole("button", { name: "Open the menu" }));
    await wait(1200);
    await turnPage();
    await menuShot("tb3-chef");
    await page.getByRole("button", { name: /Bancha's nigiri/ }).first().click({ force: true }).catch(e => console.log("nigiri", e.message.slice(0, 120)));
    await wait(700); await menuShot("tb3-nigiri");
    await page.getByRole("button", { name: "Red Snapper", exact: true }).first().click({ force: true }).catch(e => console.log("snapper", e.message.slice(0, 120)));
    await page.mouse.move(4, VH - 4);
    await wait(700); await menuShot("tb3-choice");
    await page.getByRole("button", { name: "For the aquarium" }).first().click({ force: true }).catch(e => console.log("tank", e.message.slice(0, 120)));
    await page.waitForFunction(() => !document.querySelector('[aria-roledescription="folded menu"] [data-dir]'), null, { timeout: 5000 }).catch(() => {});
    await wait(1400); await shot("tb3-tank-toast"); await menuShot("tb3-tank-mark");
    // Back to the book's spread: its count of the tank, then the dishes.
    for (let i = 0; i < 2; i++) { await centre(page.getByRole("button", { name: "Turn back" })); await wait(1100); }
    await menuShot("tb3-book");
    await turnPage(); await menuShot("tb3-dishes-2");
    await centre(page.getByRole("button", { name: "Turn back" })); await wait(1100);
    await page.getByRole("button", { name: /Snapper chazuke/ }).first().click({ force: true }).catch(e => console.log("dish", e.message.slice(0, 120)));
    await wait(600); await menuShot("tb3-dish-learnt");
    await page.getByRole("button", { name: /^Order/ }).first().click({ force: true }).catch(e => console.log("order", e.message.slice(0, 120)));
    await wait(2500); await shot("tb3-buff");
    const b = await testid("buff-chip").boundingBox();
    if (b) await shot("tb3-buff-crop", page, { clip: { x: Math.max(0, b.x - 120), y: Math.max(0, b.y - 140), width: Math.min(VW - Math.max(0, b.x - 120), b.width + 140), height: b.height + 280 } });
    else console.log("no buff chip");
    const hud = await page.locator("[data-hud-right]").first().boundingBox();
    console.log("buff", JSON.stringify(b), "hudRight", JSON.stringify(hud));
    // The UI view (Esc 1): the minimap grows and the wallet stays; the buff stays clear under them.
    if (!PHONE) { await page.keyboard.press("Escape"); await wait(1500); await shot("tb3-buff-uiview"); }
  },
  async aquarium() {
    await world("hq=inside&at=0,4.2&time=day", { press: false, settle: 14000 });
    await page.keyboard.down("w"); await wait(400); await page.keyboard.up("w");
    await wait(2500);
    await shot("tb-aquarium");
    // Walk up to the lounge before the glass.
    await page.keyboard.down("w"); await wait(2200); await page.keyboard.up("w");
    await wait(2500);
    await shot("tb-aquarium-close");
  },
};
for (const f of FLOWS) {
  try { await FLOW[f](); } catch (e) { console.log("flow", f, e.message.slice(0, 200)); }
}
await browser.close();
