// HUD and Esc evidence (specs/playtest-round1.md decision 3, "HUD and Esc, approved"): the minimal HUD under mouse-look,
// Esc 1 (the UI view over the live game), Esc 2 (the system menu), the one Settings, each sheet opened from the UI view's
// dock (and back to it), a player's card opened from the aim dot under pointer lock, the phone width, and the title's
// Settings. Headless Chromium on the GPU, muted (Pointer Lock stood in for: see POINTER_LOCK); the dev server with the
// Supabase env blanked; the browser lock held.
//   node specs/evidence/hud-esc/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: hud, sheets, card, phone, title.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3173";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const rad = d => (Number(d) * Math.PI) / 180;

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });

/**
 * Headless Chromium has no Pointer Lock (WrongDocumentError: no focused window), and the lane rules keep every run
 * headless. So the page gets a stand-in with Chrome's behaviour: requestPointerLock locks and fires pointerlockchange,
 * exitPointerLock unlocks, and Escape while locked ends the lock without reaching the page (Chrome keeps that Esc).
 * The game's own code runs unchanged on top of it.
 */
const POINTER_LOCK = () => {
  let locked = null;
  const change = () => queueMicrotask(() => document.dispatchEvent(new Event("pointerlockchange")));
  Object.defineProperty(Document.prototype, "pointerLockElement", { configurable: true, get() { return locked; } });
  Element.prototype.requestPointerLock = function () { locked = this; change(); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { if (!locked) return; locked = null; change(); };
  window.addEventListener("keydown", e => { if (e.key === "Escape" && locked) { e.stopImmediatePropagation(); e.preventDefault(); document.exitPointerLock(); } }, true);
};

/** A fresh device on the island (a saved look skips the creator; greeted; no gift), camera at yaw/pitch (degrees). */
async function client(query, { cam = [0, 34], size = { width: 1280, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(POINTER_LOCK);
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|127\.0\.0\.1:9|ERR_CONNECTION/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, c]) => {
    localStorage.clear();
    localStorage.setItem("tsi.look.v1", l);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: c[0], pitch: c[1], zoom: 1, sensitivity: 1, invertY: false, mouseLook: true, autoFollow: false }));
  }, [JSON.stringify(LOOK), [rad(cam[0]), rad(cam[1])]]);
  await page.goto(`${HOST}/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => console.log("still preparing"));
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForTimeout(6000);
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).then(() => console.log("shot", name));
const state = page => page.evaluate(() => ({ capture: window.__orbit?.capture.state, locked: !!document.pointerLockElement,
  dock: !!document.querySelector("[data-testid=menu-dock]"), system: !!document.querySelector("[data-testid=system-menu]"),
  dialogs: [...document.querySelectorAll("[role=dialog]")].map(d => d.getAttribute("data-testid") ?? d.getAttribute("aria-label") ?? "?") }));
/** Click the world to take the mouse, and wait for the lock. */
async function lock(page) {
  await page.mouse.click(640, 560);
  await page.waitForFunction(() => window.__orbit?.capture.state === "captured", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  return state(page);
}

for (const scene of SCENES) {
  if (scene === "hud") {
    const page = await client("bots=4&seed=3&at=13:00");
    console.log("before lock", JSON.stringify(await state(page)));
    console.log("after lock", JSON.stringify(await lock(page)));
    await shot(page, "01-hud-playing");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    console.log("esc 1", JSON.stringify(await state(page)));
    await shot(page, "02-esc1-ui-view");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    console.log("esc 2", JSON.stringify(await state(page)));
    await shot(page, "03-esc2-system-menu");
    await page.getByRole("button", { name: "Settings" }).last().click();
    await page.waitForTimeout(700);
    await shot(page, "04-settings-graphics");
    for (const [tab, n] of [["Sound", "05"], ["Controls", "06"], ["Account", "07"], ["Dev", "08"]]) {
      await page.getByRole("tab", { name: tab }).click();
      await page.waitForTimeout(350);
      await shot(page, `${n}-settings-${tab.toLowerCase()}`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    console.log("settings closed", JSON.stringify(await state(page)));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    console.log("esc 3", JSON.stringify(await state(page)));
    await shot(page, "09-esc3-back-to-game");
    await page.context().close();
  }
  if (scene === "sheets") {
    const page = await client("bots=4&seed=3&at=13:00");
    await lock(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    const entries = [["Map", "10-dock-map"], ["Quests and journal", "11-dock-quests-journal"], ["Bag", "12-dock-bag"], ["Collection", "13-dock-collection"],
      ["Friends", "14-dock-friends"], ["Mail", "15-dock-mail"], [/^Here/, "16-dock-people-here"]];
    for (const [name, file] of entries) {
      const dock = page.getByTestId("menu-dock");
      await dock.getByRole("button", { name }).first().click();
      await page.waitForTimeout(900);
      await shot(page, file);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      console.log(file, "closed", JSON.stringify(await state(page)));
    }
    await shot(page, "17-back-on-the-ui-view");
    await page.context().close();
  }
  if (scene === "card") {
    // A bot under the aim dot: turn the camera until one sits on the dot, then click it under the lock.
    const page = await client("bots=8&seed=5&at=13:00", { cam: [0, 30] });
    await lock(page);
    const found = await page.evaluate(async () => {
      const W = innerWidth, H = innerHeight, dotY = H * 0.425;
      for (let i = 0; i < 400; i++) {
        const live = window.__net.remotes().filter(r => r.tier !== "hidden");
        let best = null;
        for (const r of live) { const p = window.__net.screen(r.sid); if (p && (!best || Math.abs(p.x - W / 2) < Math.abs(best.p.x - W / 2))) best = { r, p }; }
        if (best) {
          const o = window.__orbit.orbit.target;
          o.yaw -= (best.p.x - W / 2) * 0.0015;
          o.pitch = Math.min(0.82, Math.max(0.35, o.pitch + (best.p.y - dotY) * 0.0006));
          if (document.querySelector("[class*=aimDot][data-on]")) return { name: best.r.name, i };
        } else window.__orbit.orbit.target.yaw += 0.08;
        await new Promise(r => setTimeout(r, 60));
      }
      return null;
    });
    console.log("aimed", JSON.stringify(found), JSON.stringify(await state(page)));
    await shot(page, "18-aim-dot-on-a-player");
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(900);
    console.log("card", JSON.stringify(await state(page)));
    await shot(page, "19-player-card-from-the-lock");
    await page.context().close();
  }
  if (scene === "phone") {
    const page = await client("bots=3&seed=3&at=13:00&touch=1", { size: { width: 390, height: 844 } });
    await shot(page, "20-phone-hud");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.waitForTimeout(700);
    await shot(page, "21-phone-ui-view");
    await page.context().close();
  }
  if (scene === "title") {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${HOST}/student`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForTimeout(800);
    await shot(page, "22-title-settings");
    await ctx.close();
  }
}
await browser.close();
