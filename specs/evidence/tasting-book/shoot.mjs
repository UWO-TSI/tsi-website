// tasting-book evidence: headless Chromium (never a window), muted, signed out, the dev server on :3476 with
// the Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new, the new world (/lab/island) with the demo data.
//   VIEW=phone node specs/evidence/tasting-book/shoot.mjs <out_dir> <flow> [<flow> ...]
// VIEW: desktop (1280 x 800, the default) or phone (390 x 844, touch). Flows: showroom, counter (choice, cook, stamp, book), aquarium, book3, book4, tank4, book5, tank5, book6, tank6, museum6.
// CLIP=1 records the run (Playwright's video, <out_dir>/video) and writes <out_dir>/marks.json, each clip's start and end in it.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...FLOWS] = process.argv.slice(2);
const HOST = "http://localhost:3476";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const PHONE = process.env.VIEW === "phone";
const VW = PHONE ? 390 : 1280, VH = PHONE ? 844 : 800;
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: PHONE ? 2 : 1, reducedMotion: "no-preference", ...(PHONE ? { isMobile: true, hasTouch: true } : {}),
  ...(process.env.CLIP ? { recordVideo: { dir: `${OUT}/video`, size: { width: VW, height: VH } } } : {}) });
const page = await ctx.newPage();
const T0 = Date.now(), MARKS = {};
/** A clip's start or end on the video's clock. */
const mark = (name, end = false) => { (MARKS[name] ??= {})[end ? "to" : "from"] = (Date.now() - T0) / 1000; };
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
async function world(query, { press = true, settle = 9000, click = true } = {}) {
  await page.goto(`${HOST}/lab/island?collections=demo&tasks=1&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => {});
  await wait(settle);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; } p[role="status"][style*="top: 48"] { display: none !important; }' });
  if (click) await page.locator("canvas").first().click({ position: { x: VW / 2, y: VH / 2 } }).catch(() => {});
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
  await shot(name, page, b ? { clip: { x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10), width: Math.min(VW - Math.max(0, b.x - 10), b.width + 20), height: Math.min(VH - Math.max(0, b.y - 10), b.height + 56) } } : {});
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
  /** Round 4 (tb4-*): the stool with no Menu or Leave button and no "Click to look around"; looking down (the mouse with no
   * click, a finger on a phone) at the menu on the counter shows the prompt; E (a tap) reads it; the nigiri page (Lasts:
   * Permanent, Cook it alone); looking back up (a tap outside on a phone) puts it down; moving gets you up. */
  async book4() {
    await world("at=-47,114.4&at=19:30&time=evening&bag=23&dish=1", { settle: 12000, press: false, click: false });
    const seatLine = () => page.getByText(/down (at|to) the menu/).count();
    for (let i = 0; i < 40 && !(await seatLine()); i++) { await page.keyboard.press("e"); await wait(5000); }
    await wait(2500);
    const state = async tag => console.log(tag, JSON.stringify(await page.evaluate(() => ({ pitch: window.__orbit?.orbit.target.pitch, capture: window.__orbit?.capture.state, hint: !!document.querySelector('p[role="status"]')?.textContent?.includes("Click to look") }))));
    await state("seated");
    await shot("tb4-seat");
    // Look down at the counter: the mouse alone (no click, no lock) on a desktop; a finger dragged down on a phone.
    if (PHONE) {
      await page.evaluate(async () => {
        const el = document.querySelector("canvas"), at = (type, y) => el.dispatchEvent(new PointerEvent(type, { pointerType: "touch", pointerId: 7, clientX: 195, clientY: y, bubbles: true, isPrimary: true }));
        at("pointerdown", 380);
        for (let y = 384; y <= 480; y += 4) { at("pointermove", y); await new Promise(r => setTimeout(r, 16)); }
        window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", pointerId: 7, clientX: 195, clientY: 480, bubbles: true }));
      });
    } else {
      await page.mouse.move(VW / 2, VH / 2);
      for (let i = 0; i < 25; i++) { await page.mouse.move(VW / 2, VH / 2 + 4 * (i + 1)); await wait(16); }
    }
    await wait(2000);
    await state("looked down");
    await shot("tb4-look");
    await page.getByRole("button", { name: /Read the menu/ }).first().click({ timeout: 10000 }).catch(e => console.log("read", e.message.slice(0, 120)));
    await wait(1800);
    await shot("tb4-menu-open");
    await centre(page.getByRole("button", { name: "Open the menu" }));
    await wait(1200);
    await turnPage();
    // The nigiri's page shut (a phone shows a dish's stats only shut), then open.
    await menuShot("tb4-nigiri-page");
    await page.getByRole("button", { name: /Bancha's nigiri/ }).first().click({ force: true }).catch(e => console.log("nigiri", e.message.slice(0, 120)));
    await wait(700); await menuShot("tb4-nigiri");
    await page.getByRole("button", { name: "Red Snapper", exact: true }).first().click({ force: true }).catch(e => console.log("snapper", e.message.slice(0, 120)));
    await page.mouse.move(4, VH - 4);
    await wait(700); await menuShot("tb4-choice");
    console.log("aquarium button", await page.getByRole("button", { name: /aquarium/i }).count());
    // Put it down: the arrow up (looking back up) on a desktop, a tap outside it on a phone.
    if (PHONE) await page.touchscreen.tap(VW / 2, 262); else await page.keyboard.press("ArrowUp");
    await wait(2200);
    await state("put down");
    await shot("tb4-menu-down");
    // Moving gets you up: W on a desktop, the stick on a phone.
    if (PHONE) {
      const b = await testid("touch-stick").boundingBox();
      if (b) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + 4, { steps: 4 }); await wait(700); await page.mouse.up(); }
      else console.log("no stick");
    } else { await page.keyboard.down("w"); await wait(600); await page.keyboard.up("w"); }
    await wait(2600);
    console.log("seat line after moving", await seatLine());
    await shot("tb4-leave");
  },
  /** Round 4: the give at HQ's tank (E there; the bar only cooks). */
  async tank4() {
    await world("hq=inside&at=0,4.2&time=day&bag=23&dish=1", { press: false, settle: 14000 });
    // The sectional and the beanbags stand before the glass: round the sofa's right end into the strip before the tank
    // (the room's frame, a tap's walk: tsi:interior-move).
    const prompt = () => page.getByText("Give a fish to the tank").count();
    for (const [x, z] of [[-5.2, 0], [-5.2, 6.9], [-0.6, 6.9]]) {
      await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), [x, z]);
      await wait(3200);
    }
    console.log("tank prompt", await prompt());
    await shot("tb4-tank-prompt");
    for (let i = 0; i < 6 && !(await testid("tank-sheet").count()); i++) { await page.keyboard.press("e"); await wait(1500); }
    await wait(1000);
    await shot("tb4-tank");
    await page.locator('[data-testid="tank-sheet"] [data-key="fish_red_snapper"]').first().click({ timeout: 10000 }).catch(e => console.log("give", e.message.slice(0, 120)));
    await wait(1800);
    await shot("tb4-tank-given");
    await page.keyboard.press("Escape"); await wait(3000);
    await shot("tb4-tank-swim");
  },
  /** Round 5 (tb5-*): the quiet seated reminder, the menu on the counter (the menu's own model), the menu's first page (new
   * fish, Give), a key fish given (the page turns to the dish it taught), the pages after (the dishes, then the house's). */
  async book5() {
    await world("at=-47,114.4&at=19:30&time=evening&bag=23&dish=1", { settle: 12000, press: false, click: false });
    const seatLine = () => page.getByText(/down to read the menu/).count();
    // The reminder fades after a few seconds: catch it as it comes.
    for (let i = 0; i < 40 && !(await seatLine()); i++) { await page.keyboard.press("e"); for (let t = 0; t < 20 && !(await seatLine()); t++) await wait(250); }
    await wait(1600);
    console.log("seat hint", JSON.stringify(await page.evaluate(() => {
      const el = [...document.querySelectorAll("p")].find(p => /down to read the menu/.test(p.textContent ?? ""));
      if (!el) return null;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return { cls: el.className, opacity: cs.opacity, anim: cs.animationName, bottom: cs.bottom, pos: cs.position, box: [r.x, r.y, r.width, r.height] };
    })));
    await shot("tb5-seat");
    await shot("tb5-seat-crop", page, { clip: PHONE ? { x: 0, y: VH - 300, width: VW, height: 200 } : { x: VW / 2 - 300, y: VH - 220, width: 600, height: 160 } });
    await wait(6000);
    await shot("tb5-seat-later");
    if (PHONE) {
      await page.evaluate(async () => {
        const el = document.querySelector("canvas"), at = (type, y) => el.dispatchEvent(new PointerEvent(type, { pointerType: "touch", pointerId: 7, clientX: 195, clientY: y, bubbles: true, isPrimary: true }));
        at("pointerdown", 380);
        for (let y = 384; y <= 480; y += 4) { at("pointermove", y); await new Promise(r => setTimeout(r, 16)); }
        window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", pointerId: 7, clientX: 195, clientY: 480, bubbles: true }));
      });
    } else {
      await page.mouse.move(VW / 2, VH / 2);
      for (let i = 0; i < 25; i++) { await page.mouse.move(VW / 2, VH / 2 + 4 * (i + 1)); await wait(16); }
    }
    await wait(2500);
    await shot("tb5-look");
    await shot("tb5-look-crop", page, { clip: PHONE ? { x: 0, y: VH * 0.25, width: VW, height: VH * 0.5 } : { x: VW / 2 - 320, y: VH * 0.3, width: 640, height: VH * 0.45 } });
    await page.getByRole("button", { name: /Read the menu/ }).first().click({ timeout: 10000 }).catch(e => console.log("read", e.message.slice(0, 120)));
    await wait(1800);
    await menuShot("tb5-menu-cover");
    await centre(page.getByRole("button", { name: "Open the menu" }));
    await wait(1400);
    await menuShot("tb5-newfish");
    await page.getByRole("button", { name: "Red Snapper", exact: true }).first().click({ force: true }).catch(e => console.log("snapper", e.message.slice(0, 120)));
    await page.mouse.move(4, VH - 4);
    await wait(700);
    await menuShot("tb5-newfish-key");
    await testid("give-fish").click({ force: true }).catch(e => console.log("give", e.message.slice(0, 120)));
    await wait(500);
    await shot("tb5-given-toast");
    await wait(1600);
    await menuShot("tb5-learnt");
    for (const name of ["tb5-recipes-2", "tb5-house", "tb5-house-2", "tb5-book"]) { await turnPage(); await menuShot(name); }
  },
  /** Round 5: HQ's tank on the flat kit: the cards, a fish picked (the side says what it does, Give), after the give. */
  async tank5() {
    await world("hq=inside&at=0,4.2&time=day&bag=23&dish=1", { press: false, settle: 14000 });
    for (const [x, z] of [[-5.2, 0], [-5.2, 6.9], [-0.6, 6.9]]) {
      await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), [x, z]);
      await wait(3200);
    }
    for (let i = 0; i < 6 && !(await testid("tank-sheet").count()); i++) { await page.keyboard.press("e"); await wait(1500); }
    await wait(1200);
    await shot("tb5-tank");
    await page.locator('[data-testid="tank-sheet"] [data-key="fish_squid"]').first().click({ timeout: 10000 }).catch(e => console.log("pick", e.message.slice(0, 120)));
    await wait(900);
    await shot("tb5-tank-pick");
    await page.getByRole("button", { name: "Give to the tank" }).first().click({ timeout: 10000 }).catch(e => console.log("give", e.message.slice(0, 120)));
    await wait(1800);
    await shot("tb5-tank-given");
  },
  /** Round 6 (tb6-*): the menu centred on the counter, the collection (luck for good, every fish given), your bag over the
   * menu (given fish greyed), a give landing in the collection, a key fish teaching its dish, then each part of the menu. */
  async book6() {
    await world("at=-47,114.4&at=19:30&time=evening&bag=23&dish=1", { settle: 12000, press: false, click: false });
    const seatLine = () => page.getByText(/down to read the menu/).count();
    for (let i = 0; i < 40 && !(await seatLine()); i++) { await page.keyboard.press("e"); for (let t = 0; t < 20 && !(await seatLine()); t++) await wait(250); }
    await wait(1500);
    mark("look");
    if (PHONE) {
      await page.evaluate(async () => {
        const el = document.querySelector("canvas"), at = (type, y) => el.dispatchEvent(new PointerEvent(type, { pointerType: "touch", pointerId: 7, clientX: 195, clientY: y, bubbles: true, isPrimary: true }));
        at("pointerdown", 380);
        for (let y = 384; y <= 480; y += 4) { at("pointermove", y); await new Promise(r => setTimeout(r, 16)); }
        window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", pointerId: 7, clientX: 195, clientY: 480, bubbles: true }));
      });
    } else {
      await page.mouse.move(VW / 2, VH / 2);
      for (let i = 0; i < 25; i++) { await page.mouse.move(VW / 2, VH / 2 + 4 * (i + 1)); await wait(16); }
    }
    await wait(2500);
    await shot("tb6-look");
    await shot("tb6-look-close", page, { clip: PHONE ? { x: 0, y: VH * 0.25, width: VW, height: VH * 0.5 } : { x: VW / 2 - 320, y: VH * 0.3, width: 640, height: VH * 0.45 } });
    await page.getByRole("button", { name: /Read the menu/ }).first().click({ timeout: 10000 }).catch(e => console.log("read", e.message.slice(0, 120)));
    await wait(1800);
    mark("look", true);
    await centre(page.getByRole("button", { name: "Open the menu" }));
    await wait(1600);
    await menuShot("tb6-collection");
    // Your bag over the menu: a plain fish given (it lands in the collection), then a key fish (the menu turns to its dish).
    mark("give");
    const bagGive = async (key, name) => {
      await testid("open-bag").click({ force: true }).catch(e => console.log("bag", e.message.slice(0, 120)));
      await wait(1200);
      if (name === "tb6-bag") await shot(name);
      await page.locator(`[data-testid="give-bag"] [data-key="${key}"]`).first().click({ timeout: 10000 }).catch(e => console.log("pick", key, e.message.slice(0, 120)));
      await wait(900);
      await shot(`${name}-pick`);
      await testid("give-fish").click({ timeout: 10000 }).catch(e => console.log("give", e.message.slice(0, 120)));
    };
    await bagGive("fish_carp", "tb6-bag");
    await wait(500);
    await shot("tb6-given-toast");
    await wait(1400);
    await menuShot("tb6-given");
    mark("give", true);
    mark("key");
    await bagGive("fish_red_snapper", "tb6-bag-key");
    await wait(2200);
    await menuShot("tb6-learnt");
    mark("key", true);
    // The parts, by the words under the menu, and the page after each.
    mark("pages");
    for (const [part, name] of [["Dishes", "tb6-dishes"], ["Menu", "tb6-menu"], ["All fish", "tb6-allfish"], ["Collection", "tb6-collection-after"]]) {
      // (Scoped to the parts: a phone's HUD has its own "Menu" button.)
      await page.getByRole("navigation", { name: "Parts of the menu" }).getByRole("button", { name: part, exact: true }).click({ force: true }).catch(e => console.log("part", part, e.message.slice(0, 120)));
      // (A phone has no mouse: moving it over the vignette would tilt the seated view up and put the menu down.)
      if (!PHONE) await page.mouse.move(4, VH - 4);
      await wait(1300);
      await menuShot(name);
      if (part !== "Collection") { await turnPage(); await menuShot(`${name}-2`); }
    }
    mark("pages", true);
  },
  /** Round 6: HQ's tank, a small thing: E, pick a fish, drop it in; it swims, and nothing else happens. */
  async tank6() {
    await world("hq=inside&at=0,4.2&time=day&bag=23&dish=1", { press: false, settle: 14000 });
    for (const [x, z] of [[-5.2, 0], [-5.2, 6.9], [-0.6, 6.9]]) {
      await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), [x, z]);
      await wait(3200);
    }
    console.log("tank prompt", await page.getByText("Drop a fish in").count());
    await shot("tb6-tank-prompt");
    mark("tank");
    for (let i = 0; i < 6 && !(await testid("tank-sheet").count()); i++) { await page.keyboard.press("e"); await wait(1500); }
    await wait(1000);
    await shot("tb6-tank");
    await page.locator('[data-testid="tank-sheet"] button[aria-label="Squid"]').first().click({ timeout: 10000 }).catch(e => console.log("pick", e.message.slice(0, 120)));
    await wait(800);
    await shot("tb6-tank-pick");
    await testid("tank-drop").click({ timeout: 10000 }).catch(e => console.log("drop", e.message.slice(0, 120)));
    await wait(700);
    await shot("tb6-tank-drop");
    await wait(3500);
    await shot("tb6-tank-swim");
    mark("tank", true);
  },
  /** Round 6: the kit's new paper pieces in the showroom (the collection's boost track, a fish given, a contents row, the parts under the menu). */
  async showroom6() {
    await page.goto(`${HOST}/lab/gui?only=flat-pieces`, { waitUntil: "domcontentloaded" });
    await wait(8000);
    await page.getByRole("button", { name: "Open the menu" }).first().click({ force: true }).catch(e => console.log("open", e.message.slice(0, 120)));
    await wait(1500);
    await menuShot("tb6-showroom");
  },
  /** Round 6: the museum today (the pitch's where): its aquarium wing, from the door and close. */
  async museum6() {
    await world("museum=inside&time=day", { press: false, settle: 14000 });
    await shot("tb6-museum-today");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: 5.2, z: 0.5 } })));
    await wait(4000);
    await shot("tb6-museum-aquarium");
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
if (process.env.CLIP) writeFileSync(`${OUT}/marks.json`, JSON.stringify(MARKS, null, 1));
await ctx.close();
await browser.close();
