// HUD frame and first-login evidence (specs/polish/hud-first-login.md): headed Chromium (WebGL), muted, dev server on
// :3123 with the Supabase env blanked. The member's APIs are answered here (page.route), so the island shows a
// signed-in member without touching any database. PNGs land in <out_dir>; the WebP sheets are made afterwards.
//   node specs/evidence/polish-hud/shoot.mjs <out_dir> <state.json> <scene> [<scene> ...]
// Scenes: corners-before, corners-after, cluster, loading, first-login, gift, ruins, applicant.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, STATE, ...SCENES] = process.argv.slice(2);
const HOST = "http://localhost:3123";
const fixture = JSON.parse(readFileSync(STATE, "utf8"));
const SIZES = [["1440x900", 1440, 900], ["1280x720", 1280, 720], ["1366x760", 1366, 760], ["phone", 390, 844]];
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
// A returning member: chapter 1 under way (plot claimed), two unread letters, 1,240 coins, level 7.
const returning = structuredClone(fixture.state);
returning.chapters[0].steps[0].done = true;
returning.objective = { chapter_slug: "settle-in", step_key: "first_catch", text: returning.chapters[0].steps[1].label, anchor: returning.chapters[0].steps[1].anchor };

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });

/** A page answering the member APIs: `look` saved or not, `fresh` chapter 1, `gift` unclaimed. */
async function memberPage({ width, height, look = true, fresh = false, gift = false, coins = 1240, xp = 5500 }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  // Any asset that fails (the island's "could not load" card): name it.
  page.on("requestfailed", r => { if (!r.url().includes("/api/")) console.log("requestfailed", r.url().slice(0, 160), r.failure()?.errorText); });
  page.on("response", r => { if (r.status() >= 400 && !r.url().includes("/api/") && !/\.(mp3|ogg)$/.test(r.url())) console.log("http", r.status(), r.url().slice(0, 160)); });
  const wallet = { coins, gems: 0, daily_claimed: !gift, day: "2026-10-01", recent: [] };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), m = route.request().method();
    if (url.pathname === "/api/identity/me") return json(route, { identity: { world_name: "Juniper", badge: "member", family: null, settings: null } });
    if (url.pathname === "/api/profile") return m === "GET" ? json(route, { profile: { avatar_config: look ? { look: LOOK } : {} } }) : json(route, { ok: true });
    if (url.pathname === "/api/identity/name") return json(route, { ok: true });
    if (url.pathname === "/api/economy/wallet") return json(route, { ok: true, wallet });
    if (url.pathname === "/api/economy/daily-gift") { wallet.coins += 20; wallet.daily_claimed = true; return json(route, { ok: true, gift: { coins: 20, balance: wallet.coins, claimed: true, day: "2026-10-01" } }); }
    if (url.pathname === "/api/progression/state") return json(route, { ok: true, state: fresh ? { ...fixture.state, unread_letters: 0 } : returning });
    if (url.pathname === "/api/combat/progression") {
      const p = { level: 7, xp, into: xp - 4375, needed: 1925, next_level_at: 6300, stats: null, derived: { max_hp: 100 }, weapons: [], loadout: [], traits: {}, family: null };
      return json(route, { ok: true, progression: p, gate: { level: 7, family: null, subclass: null, gateOpen: false, reason: "Sealed. Reach level 10." } });
    }
    return route.continue();
  });
  return { ctx, page, wallet };
}
/** Fresh device state: the pixel finish on, nothing greeted, no gift put off. */
async function prime(page, extra = {}) {
  await page.goto(`${HOST}/student/opening-soon`, { waitUntil: "domcontentloaded" });
  await page.evaluate(e => { localStorage.clear(); localStorage.setItem("tsi.pixelated.v1", "true"); for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v); }, extra);
}
async function waitWorld(page) {
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => console.log("still preparing"));
}
const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts }).then(() => console.log("shot", name));
const toast = (page, text, icon) => page.evaluate(([t, i]) => window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: t, icon: i } })), [text, icon]);

for (const scene of SCENES) {
  if (scene === "corners-before" || scene === "corners-after") {
    const after = scene === "corners-after";
    for (const [name, width, height] of SIZES) {
      const { ctx, page } = await memberPage({ width, height });
      await prime(page, { "tsi.welcomed.v1": "1", "tsi.look.v1": JSON.stringify(LOOK), "tsi.gift.later": "2026-10-01" });
      // Beside the notice board: the E prompt is up; a toast over it shows the lane.
      await page.goto(`${HOST}/student/dashboard?at=14:05&at=-2.6,4.3`, { waitUntil: "domcontentloaded" });
      await waitWorld(page);
      await page.waitForTimeout(6000);
      await toast(page, "A hot cocoa, extra marshmallows. The windows fog up a little.", after ? "☕" : undefined);
      await page.waitForTimeout(500);
      await shot(page, `${after ? "after" : "before"}-corners-${name}`);
      await ctx.close();
    }
  }
  if (scene === "cluster") {
    const { ctx, page, wallet } = await memberPage({ width: 1440, height: 900 });
    await prime(page, { "tsi.welcomed.v1": "1", "tsi.look.v1": JSON.stringify(LOOK), "tsi.gift.later": "2026-10-01" });
    await page.goto(`${HOST}/student/dashboard?at=14:05&at=0,-6`, { waitUntil: "domcontentloaded" });
    await waitWorld(page);
    await page.waitForTimeout(5000);
    const clip = { x: 760, y: 0, width: 680, height: 130 };
    await shot(page, "cluster-1-rest", { clip });
    // A kill's XP and a coin gain: the bar fills, the chips ping, the coins count up.
    wallet.coins += 60;
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tsi:api-write", { detail: { path: "/api/combat/missions/complete", data: { xp_awarded: 300, coins_awarded: 60, replayed: false } } }));
    });
    await page.waitForTimeout(350);
    await shot(page, "cluster-2-xp-ping", { clip });
    await page.waitForTimeout(1500);
    await shot(page, "cluster-3-coins-counting", { clip });
    await page.waitForTimeout(2400);
    await shot(page, "cluster-4-settled", { clip });
    // Night, rain: the weather icon follows the island.
    await page.goto(`${HOST}/student/dashboard?at=22:10&at=0,-6&weather=rain`, { waitUntil: "domcontentloaded" });
    await waitWorld(page);
    await page.waitForTimeout(4000);
    await shot(page, "cluster-5-night-rain", { clip });
    // Settings: the look and performance options moved in.
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForTimeout(600);
    await shot(page, "cluster-6-settings");
    await ctx.close();
  }
  if (scene === "loading") {
    const { ctx, page } = await memberPage({ width: 1440, height: 900 });
    await prime(page, { "tsi.welcomed.v1": "1", "tsi.look.v1": JSON.stringify(LOOK), "tsi.gift.later": "2026-10-01" });
    await page.goto(`${HOST}/student/dashboard?at=14:05`, { waitUntil: "commit" });
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(200);
      const text = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? "");
      if (/Rowing|Unpacking|Lighting/.test(text)) await shot(page, `loading-${String(i).padStart(2, "0")}`);
      if (!/Preparing/.test(text) && i > 4) break;
    }
    await page.waitForTimeout(300);
    await shot(page, "loading-zz-revealed");
    await ctx.close();
  }
  if (scene === "first-login") {
    const { ctx, page } = await memberPage({ width: 1440, height: 900, look: false, fresh: true, gift: true });
    await prime(page);
    await page.goto(`${HOST}/student/dashboard?at=14:05`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "That's me" }).waitFor({ timeout: 240000 });
    await page.waitForTimeout(4000);
    await shot(page, "first-1-creator");
    await page.getByRole("button", { name: "That's me" }).click();
    await page.waitForTimeout(250);
    await shot(page, "first-2-dock-fade");
    // The fade lifting on the wharf, before Wren speaks.
    await page.waitForFunction(() => document.querySelector('[class*="fade"][data-active="false"]'), null, { timeout: 60000 });
    await page.waitForTimeout(220);
    await shot(page, "first-2b-arriving");
    await page.waitForSelector("[data-welcome]", { timeout: 60000 });
    await page.waitForTimeout(300);
    await shot(page, "first-3-greeting-1");
    await page.keyboard.press("e");
    await page.waitForTimeout(700);
    await shot(page, "first-4-greeting-2");
    await page.keyboard.press("e");
    await page.waitForTimeout(700);
    await shot(page, "first-5-greeting-3");
    await page.keyboard.press("e");
    await page.waitForTimeout(450);
    await shot(page, "first-6-objective");
    await page.waitForTimeout(2600);
    await shot(page, "first-7-gift");
    await ctx.close();
  }
  if (scene === "gift") {
    const { ctx, page } = await memberPage({ width: 1440, height: 900, gift: true });
    await prime(page, { "tsi.welcomed.v1": "1", "tsi.look.v1": JSON.stringify(LOOK) });
    await page.goto(`${HOST}/student/dashboard?at=14:05&at=0,-6`, { waitUntil: "domcontentloaded" });
    await waitWorld(page);
    await page.getByRole("button", { name: "Open it" }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(700);
    await shot(page, "gift-1-offer");
    await page.getByRole("button", { name: "Open it" }).click();
    await page.waitForTimeout(300);
    await shot(page, "gift-2-opening");
    await page.waitForTimeout(650);
    await shot(page, "gift-3-burst");
    await page.waitForTimeout(500);
    await shot(page, "gift-4-counted");
    await ctx.close();
  }
  if (scene === "door") {
    // Into the clubhouse: the fade holds until the room has loaded and compiled; the title fades out and back in renamed.
    const { ctx, page } = await memberPage({ width: 1280, height: 720 });
    await prime(page, { "tsi.welcomed.v1": "1", "tsi.look.v1": JSON.stringify(LOOK), "tsi.gift.later": "2026-10-01" });
    await page.goto(`${HOST}/student/dashboard?at=14:05&at=0,5.6`, { waitUntil: "domcontentloaded" });
    await waitWorld(page);
    await page.waitForTimeout(5000);
    await shot(page, "door-1-prompt");
    await page.locator("canvas").first().click({ position: { x: 5, y: 300 } }).catch(() => {});
    const t0 = Date.now();
    await page.keyboard.press("e");
    await page.waitForTimeout(150);
    await shot(page, "door-2-fading");
    await page.waitForTimeout(500);
    await shot(page, "door-3-dark");
    await page.waitForFunction(() => document.querySelector('[class*="fade"][data-active="false"]'), null, { timeout: 20000 });
    console.log("fade lifted after", Date.now() - t0, "ms");
    await page.waitForTimeout(250);
    await shot(page, "door-4-revealing");
    await page.waitForTimeout(900);
    await shot(page, "door-5-inside");
    await ctx.close();
  }
  if (scene === "ruins") {
    const { ctx, page } = await memberPage({ width: 1280, height: 720 });
    await prime(page, { "tsi.welcomed.v1": "1", "tsi.look.v1": JSON.stringify(LOOK), "tsi.gift.later": "2026-10-01" });
    await page.goto(`${HOST}/student/dashboard?ruins=1&at=14:05`, { waitUntil: "domcontentloaded" });
    await waitWorld(page);
    await page.waitForTimeout(6000);
    await toast(page, "Sealed. Reach level 10.", "🔒");
    await page.waitForTimeout(500);
    await shot(page, "after-ruins-1280x720");
    await ctx.close();
  }
  if (scene === "applicant") {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
    // Local rehearsal (?preview=1, development only) with no positions: the applicant island still loads and plays.
    await page.route("**/api/positions**", route => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await page.goto(`${HOST}/student/apply/portal?preview=1`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(30000);
    await shot(page, "applicant-island");
    await page.getByRole("button", { name: "That's me" }).click().catch(() => {});
    await page.waitForTimeout(14000);
    await shot(page, "applicant-island-2");
    await ctx.close();
  }
}
await browser.close();
