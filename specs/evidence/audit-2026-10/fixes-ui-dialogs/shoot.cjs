// Group A of the UI audit (items 1, 4, 13): Escape, focus and close-motion checks, before and after.
// Dev server on 3154 with the Supabase env blanked, then: TAG=before node shoot.cjs collection narrow companion path closet reveal gift
// Headless Chromium, --mute-audio, SwiftShader, 1280 x 720 (phone scenes 390 x 844). Writes PNGs and log.jsonl to $SHOTS.
const { chromium } = require("/opt/homebrew/lib/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const BASE = process.env.BASE || "http://localhost:3154";
const TAG = process.env.TAG || "run";
const OUT = path.join(process.env.SHOTS || path.join(require("os").tmpdir(), "ui-dialogs-shots"), TAG);
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "log.jsonl");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = o => { fs.appendFileSync(LOG, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o).slice(0, 600)); };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + ".png"), timeout: 60000 }).catch(e => log({ name, shotErr: String(e).slice(0, 160) }));

// A returning player: a saved look and the welcome seen, so the first-login creator doesn't hold the island.
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const prep = ctx => ctx.addInitScript(look => {
  try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.pixelated.v1", "false"); } catch {}
}, JSON.stringify(LOOK));

// The loading screen comes after a dark splash: wait for it to show, then to go.
async function islandReady(page, ms = 240000) {
  await page.waitForFunction(() => document.body.innerText.includes("Preparing the island"), null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => !document.body.innerText.includes("Preparing the island") && !!document.querySelector("canvas"), null, { timeout: ms }).catch(() => {});
  await sleep(3000);
}

/** Where focus is, and whether it sits in a dialog. */
const focusInfo = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a) return null;
  return { tag: a.tagName, text: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40), inDialog: !!a.closest('[role="dialog"]'), outline: getComputedStyle(a).outlineStyle };
});

/**
 * Samples `selector` every animation frame from just before `act()` for `ms`: present or not, its data-state and
 * its computed opacity. The close-motion check: a frame that closes with motion shows falling opacity before it goes.
 */
async function closeTrace(page, name, selector, act, ms = 700) {
  await page.evaluate(({ selector, ms }) => {
    const t0 = performance.now(), out = [];
    window.__trace = out;
    const tick = () => {
      const el = document.querySelector(selector);
      const host = el && (el.closest("[data-state]") || el);
      out.push({ t: Math.round(performance.now() - t0), there: !!el, state: host ? host.getAttribute("data-state") : null, opacity: el ? +(+getComputedStyle(el).opacity).toFixed(2) : null });
      if (performance.now() - t0 < ms) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { selector, ms });
  await act();
  await sleep(60);
  await shot(page, name + "-close-60ms");
  await sleep(ms + 200);
  const trace = await page.evaluate(() => window.__trace);
  const firstGone = trace.find(s => !s.there);
  const fading = trace.filter(s => s.there && s.opacity !== null && s.opacity < 0.98 && s.state !== "open");
  log({ name, close: { frames: trace.length, goneAtMs: firstGone ? firstGone.t : null, fadingFrames: fading.length, minOpacity: fading.length ? Math.min(...fading.map(s => s.opacity)) : null, sample: trace.filter((_, i) => i % 3 === 0).slice(0, 12) } });
  return trace;
}

function attach(page, name) {
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push({ t: "error", x: m.text().slice(0, 240) }); });
  page.on("pageerror", e => errs.push({ t: "pageerror", x: String(e).slice(0, 240) }));
  return () => { const uniq = [...new Map(errs.map(e => [e.t + e.x, e])).values()]; log({ name, console: uniq.slice(0, 12), count: errs.length }); };
}

async function sheetScene(ctx, name, url, opener, selector) {
  const page = await ctx.newPage(); const flush = attach(page, name);
  await page.goto(BASE + url, { waitUntil: "load", timeout: 240000 });
  await islandReady(page);
  if (opener) { await opener(page); await sleep(1200); }
  await shot(page, name + "-open");
  log({ name, opened: await page.evaluate(sel => !!document.querySelector(sel), selector), focusOnOpen: await focusInfo(page) });
  await page.keyboard.press("Tab"); await sleep(150);
  log({ name, focusAfterTab: await focusInfo(page) });
  await shot(page, name + "-tab");
  await closeTrace(page, name, selector, () => page.keyboard.press("Escape"));
  await shot(page, name + "-after");
  log({ name, focusAfterClose: await focusInfo(page), stillOpen: await page.evaluate(sel => !!document.querySelector(sel), selector) });
  flush(); await page.close();
}

// The Collection is the dialog whose title reads "Collection".
const COLLECTION = '[aria-labelledby="collection-book-title"], [data-testid="collection-sheet"]';
const collectionOpen = async page => { await page.keyboard.press("b"); };

const GROUPS = {
  collection: ctx => sheetScene(ctx, "collection", "/lab/island?collections=demo", collectionOpen, COLLECTION),
  path: ctx => sheetScene(ctx, "path", "/lab/island?combat=demo&sheet=path", null, '[data-testid="path-sheet"]'),
  closet: ctx => sheetScene(ctx, "closet", "/lab/island?collections=demo&home=inside&sheet=closet", null, '[aria-labelledby="creator-title"]'),
  async reveal(ctx) {
    const page = await ctx.newPage(); const flush = attach(page, "reveal");
    await page.goto(BASE + "/lab/island?oracle=demo&temple=inside&sheet=oracle", { waitUntil: "load", timeout: 240000 });
    await islandReady(page);
    for (let i = 0; i < 80; i++) {
      if (await page.locator('[data-testid="oracle-reveal"]').count()) break;
      const dlg = page.locator('[role="dialog"]').last();
      const scale = dlg.locator("button:has(kbd):not([disabled])").first();
      // Tie-breaks: the first option of every question not answered yet, then Reveal.
      const tied = await page.evaluate(() => {
        const groups = new Map();
        for (const b of document.querySelectorAll('[role="dialog"] button[aria-pressed]')) groups.set(b.parentElement, [...(groups.get(b.parentElement) || []), b]);
        let n = 0;
        for (const bs of groups.values()) if (!bs.some(b => b.getAttribute("aria-pressed") === "true")) { bs[0].click(); n++; }
        return n;
      });
      const tie = dlg.locator("button[aria-pressed=__never__]");
      const go = dlg.getByRole("button", { name: /^(Begin|Continue|Continue your reading|Reveal)$/ }).first();
      if (await scale.count()) await scale.click({ timeout: 4000 }).catch(() => {});
      else if (tied || await tie.count()) await sleep(200);
      else if (await go.count()) await go.click({ timeout: 4000 }).catch(() => {});
      await sleep(350);
    }
    await sleep(3000); // the card fades in after the light ceremony
    await shot(page, "reveal-open");
    const there = await page.locator('[data-testid="oracle-reveal"]').count();
    log({ name: "reveal", shown: !!there });
    if (there) await closeTrace(page, "reveal", '[data-testid="oracle-reveal"]', () => page.locator('[data-testid="oracle-reveal"] button').click());
    await shot(page, "reveal-after");
    flush(); await page.close();
  },
  async gift(base, browser) {
    for (const run of ["space", "escape", "e"]) {
      // A fresh visitor each run (a page's storage would carry into the next).
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      await prep(ctx);
      // Signed out the wallet doesn't load and there is no gift: a wallet with today's gift unclaimed, and the claim.
      await ctx.route("**/api/economy/wallet", r => r.fulfill({ json: { ok: true, wallet: { coins: 120, gems: 0, daily_claimed: false, day: "2026-10-08", recent: [] } } }));
      await ctx.route("**/api/economy/daily-gift", r => r.fulfill({ json: { ok: true, gift: { coins: 25, balance: 145, claimed: true, day: "2026-10-08" } } }));
      const page = await ctx.newPage(); const flush = attach(page, "gift-" + run);
      // No ?collections=demo: its demo wallet says today's gift is claimed.
      await page.goto(BASE + "/lab/island", { waitUntil: "load", timeout: 240000 });
      await islandReady(page);
      await page.waitForSelector('[aria-labelledby="daily-gift-title"]', { timeout: 60000 }).catch(() => {});
      await sleep(900);
      const card = '[aria-labelledby="daily-gift-title"]';
      log({ name: "gift-" + run, shown: await page.locator(card).count(), focusOnShow: await focusInfo(page) });
      if (run === "space") {
        await shot(page, "gift-shown");
        // Jump: does Space press the gift's button?
        await page.keyboard.press(" "); await sleep(1500);
        log({ name: "gift-space", afterSpace: await page.evaluate(() => document.querySelector('[aria-labelledby="daily-gift-title"]')?.getAttribute("data-phase") ?? "gone"), focus: await focusInfo(page) });
        await shot(page, "gift-after-space");
      } else if (run === "escape") {
        await page.mouse.click(640, 600); await sleep(300); // a click in the world, as when you play
        log({ name: "gift-escape", focusBeforeEsc: await focusInfo(page) });
        await closeTrace(page, "gift-escape", card, () => page.keyboard.press("Escape"));
        log({ name: "gift-escape", putOff: await page.evaluate(() => localStorage.getItem("tsi.gift.later")) });
      } else {
        await page.keyboard.press("e"); await sleep(1500);
        log({ name: "gift-e", afterE: await page.evaluate(() => document.querySelector('[aria-labelledby="daily-gift-title"]')?.getAttribute("data-phase") ?? "gone") });
        await shot(page, "gift-after-e");
      }
      flush(); await ctx.close();
    }
  },
};

const PHONE = {
  async narrow(browser) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await prep(ctx);
    await sheetScene(ctx, "narrow-collection", "/lab/island?collections=demo", collectionOpen, COLLECTION);
    await ctx.close();
  },
  async companion(browser) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // Signed out, as production answers it (the blank dev env answers otherwise).
    await ctx.route("**/api/collections", r => r.fulfill({ status: 401, json: { error: "Unauthorized" } }));
    const page = await ctx.newPage(); const flush = attach(page, "companion");
    await page.goto(BASE + "/student/companion?mobile=1", { waitUntil: "load", timeout: 240000 }).catch(() => {});
    await sleep(6000);
    const me = page.getByRole("button", { name: /^Me$/ }).or(page.getByRole("tab", { name: /^Me$/ })).first();
    await me.click().catch(() => {}); await sleep(1500);
    for (const t of ["Bag", "Collection"]) {
      await page.getByRole("button", { name: new RegExp("^" + t + "$") }).first().click().catch(e => log({ name: "companion", clickErr: String(e).slice(0, 120) }));
      await sleep(1800);
      await shot(page, "companion-" + t.toLowerCase());
      log({ name: "companion-" + t, text: await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map(d => d.innerText.slice(0, 220))) });
      await closeTrace(page, "companion-" + t.toLowerCase(), '[role="dialog"]', () => page.keyboard.press("Escape"));
    }
    flush(); await ctx.close();
  },
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
  try {
    for (const g of process.argv.slice(2)) {
      const t0 = Date.now();
      try {
        if (PHONE[g]) await PHONE[g](browser);
        else if (g === "gift") await GROUPS.gift(null, browser);
        else { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await prep(ctx); await GROUPS[g](ctx); await ctx.close(); }
      } catch (e) { log({ group: g, error: String(e).slice(0, 300) }); }
      log({ group: g, ms: Date.now() - t0 });
    }
  } finally { await browser.close(); }
})();
