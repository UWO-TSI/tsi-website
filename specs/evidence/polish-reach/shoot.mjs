// Reachability evidence (specs/polish/reachability.md): resident talk, the wallet sheet, sign-in links, the companion.
// Headed Chromium off to the side (--window-position=2400,0), muted, never brought to the front. Dev server on :3144 with
// Supabase pointed at the GUI sheet's stand-in (specs/evidence/gui-sheet/supa-stub.mjs on :54399) and a forged session
// cookie for it: the middleware sees a signed-in member, the member APIs are answered here, no database is touched.
//   node specs/evidence/polish-reach/shoot.mjs <out_dir> [scene-prefix ...]
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...ONLY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:3144";
const b64url = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "00000000-0000-4000-8000-0000000000a1", email: "juniper@uwo.ca", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const EXP = Math.floor(Date.now() / 1000) + 6 * 3600;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USER.id, exp: EXP, role: "authenticated", aud: "authenticated" })}.c2ln`;
const SESSION_COOKIE = { name: "sb-127-auth-token", value: `base64-${b64url({ access_token: JWT, token_type: "bearer", expires_in: 21600, expires_at: EXP, refresh_token: "r", user: USER })}`, domain: "localhost", path: "/" };
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const DAY = "2026-10-03";
const iso = (d, h = 18) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
const PROFILE = { id: "m1", display_name: "Juniper", level: 7, xp: 3900, tier: 2, class: "Warden", onboarding_completed: true, avatar_config: { look: LOOK }, tc_balance: 1240, bio: "Builds things for the club.", position: "developer", created_at: "2025-09-12T16:00:00Z" };
const BOUNTIES = [
  { id: "b1", title: "Landing page for the food bank drive", description: "A one-page site for the Thanksgiving drive: hours, drop-off spots, a volunteer form.", client_name: "Growing Chefs", pay_cad: null, pay_tc: 400, xp_reward: 300, difficulty: 1, deadline: iso(18), tech_stack: ["Next.js", "Tailwind"], status: "open", submitted_by: null, approved_by: null, created_at: iso(1), updated_at: iso(1) },
  { id: "b2", title: "Volunteer shift scheduler", description: "Replace the shared spreadsheet with a small scheduler.", client_name: "BGC London", pay_cad: null, pay_tc: 900, xp_reward: 600, difficulty: 2, deadline: iso(28), tech_stack: ["React", "Supabase"], status: "open", submitted_by: null, approved_by: null, created_at: iso(1), updated_at: iso(1) },
  { id: "b3", title: "Accessibility audit", description: "Check the theatre's ticketing pages against WCAG AA.", client_name: "Grand Theatre", pay_cad: null, pay_tc: 650, xp_reward: 450, difficulty: 3, deadline: null, tech_stack: ["Audit"], status: "in_progress", submitted_by: null, approved_by: null, created_at: iso(1), updated_at: iso(1) },
];
const EVENTS = [
  { id: "e1", title: "GENESIS kickoff", event_type: "social", start_time: iso(3, 22), end_time: iso(4, 1), location: "UCC 56", description: "Pizza and teams.", tc_reward: 50, xp_reward: 100 },
  { id: "e2", title: "Workshop: shipping with Supabase", event_type: "workshop", start_time: iso(8, 22), end_time: iso(8, 23), location: "Middlesex 105", description: null, tc_reward: 30, xp_reward: 80 },
];
const LETTERS = [
  { id: "l1", kind: "system", sender_id: null, sender_name: "HQ", recipient_id: USER.id, recipient_name: "Juniper", subject: "Welcome to the island", body: "Your plot is waiting by HQ. Bring your first catch to the museum shell when you have one.", created_at: iso(2, 14), read_at: null, reported: false, outgoing: false },
  { id: "l2", kind: "note", sender_id: "m3", sender_name: "Maya", recipient_id: USER.id, recipient_name: "Juniper", subject: "Fishing derby", body: "Saturday at the pier? I'll bring the bait.", created_at: iso(1, 20), read_at: iso(1, 21), reported: false, outgoing: false },
];
// The economy (wallet, shop, sell list, bag) from the real service code, seeded like /dev/economy (the GUI sheet's fixture).
const HERE = dirname(fileURLToPath(import.meta.url)), ECONOMY_FILE = join(tmpdir(), "polish-reach-economy.json");
if (!existsSync(ECONOMY_FILE)) execFileSync("npx", ["vite-node", "-c", "vitest.config.ts", join(HERE, "../gui-sheet/economy-fixture.ts"), ECONOMY_FILE], { cwd: join(HERE, "../../../web"), stdio: "ignore" });
const ECONOMY = JSON.parse(readFileSync(ECONOMY_FILE, "utf8"));

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--window-position=2400,0"] });

/** A page answering the member's APIs (signedIn false: every member API says 401, the stub's session aside). */
async function memberPage({ width = 1440, height = 900, gift = false, mobile = false, signedIn = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" } : {}) });
  if (signedIn) await ctx.addCookies([SESSION_COOKIE]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 240)));
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const wallet = { ...ECONOMY.wallet, daily_claimed: !gift, day: DAY };
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), p = url.pathname, m = route.request().method();
    if (!signedIn) return json(route, { ok: false, error: "Unauthorized" }, 401);
    if (p === "/api/identity/me") return json(route, { ok: true, identity: { world_name: "Juniper", badge: "member", family: "Warden", settings: null } });
    if (p === "/api/profile") return m === "GET" ? json(route, { profile: PROFILE }) : json(route, { ok: true });
    if (p === "/api/admin/me") return json(route, { isAdmin: true });
    if (p === "/api/economy/wallet") return json(route, { ok: true, wallet });
    if (p === "/api/economy/shop") return json(route, { ok: true, shop: ECONOMY.shop });
    if (p === "/api/economy/sell" && m === "GET") return json(route, { ok: true, sellable: ECONOMY.sellable });
    if (p === "/api/economy/inventory") return json(route, { ok: true, inventory: ECONOMY.inventory });
    if (p === "/api/economy/daily-gift") { wallet.coins += 20; wallet.daily_claimed = true; wallet.recent = [{ currency: "coins", amount: 20, balance_after: wallet.coins, source: "daily_gift", ref: DAY, created_at: new Date().toISOString() }, ...wallet.recent]; return json(route, { ok: true, gift: { coins: 20, balance: wallet.coins, claimed: true, day: DAY } }); }
    if (p === "/api/progression/letters" && m === "GET") return json(route, { ok: true, letters: LETTERS });
    if (p === "/api/bounties") return json(route, { bounties: BOUNTIES, myClaimedBountyIds: ["b3"] });
    if (p === "/api/events") return json(route, { events: EVENTS });
    if (p === "/api/combat/progression") {
      const g = { level: 7, xp: 5500, into: 1125, needed: 1925, next_level_at: 6300, stats: null, derived: { max_hp: 100 }, weapons: [], loadout: [], traits: {}, family: "Warden" };
      return json(route, { ok: true, progression: g, gate: { level: 7, family: "Warden", subclass: null, gateOpen: true, reason: null } });
    }
    return json(route, { ok: false, error: "Not in this fixture" }, 404);
  });
  return { ctx, page };
}
/** Fresh device state on this origin (greeted, the gift put off, the pixel finish off). */
async function prime(page, extra = {}) {
  await page.goto(`${HOST}/student/opening-soon`, { waitUntil: "domcontentloaded" });
  await page.evaluate(e => {
    localStorage.clear();
    const base = { "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.look.v1": e.look, "tsi.gift.later": e.day };
    for (const [k, v] of Object.entries({ ...base, ...e.extra })) if (v !== null) localStorage.setItem(k, v); else localStorage.removeItem(k);
  }, { look: JSON.stringify(LOOK), day: DAY, extra });
}
async function waitWorld(page) {
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => console.log("still preparing"));
}
const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts }).then(() => console.log("shot", name));
const hide = page => page.addStyleTag({ content: "nextjs-portal { display: none !important; } #island-options, [aria-controls='island-options'] { display: none !important; }" });
/** The island at 2 pm (`query` extra), signed in through the stub, then `fn`. */
async function island(query, fn, { size = {}, extra = {}, wait = 6000, demo = true } = {}) {
  const { ctx, page } = await memberPage(size);
  await prime(page, extra);
  // `demo`: the progression and collections demos (they answer /api/ in the page, the economy included).
  await page.goto(`${HOST}/student/dashboard?at=14:05${demo ? "&progression=demo&collections=demo" : ""}${query ? `&${query}` : ""}`, { waitUntil: "domcontentloaded" });
  await waitWorld(page);
  await page.waitForTimeout(wait);
  await hide(page);
  try { await fn(page); } finally { await ctx.close(); }
}
async function phone(path, fn, { signedIn = true } = {}) {
  const { ctx, page } = await memberPage({ width: 390, height: 844, mobile: true, signedIn });
  await prime(page);
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await hide(page);
  try { await fn(page); } finally { await ctx.close(); }
}

/** Walk up to a resident standing still (the dev hook in NPC.tsx), a step in front of them on the camera's side. */
async function besideResident(page, prefer) {
  for (let i = 0; i < 40; i++) {
    const list = await page.evaluate(() => window.__residents?.() ?? []);
    const still = list.filter(x => !x.hidden && x.speed < 0.05);
    const r = (prefer ?? []).map(slug => still.find(x => x.slug === slug)).find(Boolean) ?? (i > 20 ? still[0] : null);
    if (r) {
      await page.evaluate(([x, z]) => window.__move.teleport(x, z - 1.35, 0), [r.x, r.z]);
      return r;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("nobody standing still");
}

const SCENES = {
  // ── Resident talk: approach, E, the turn, lines typing, the next line, goodbye, walking on ──
  "talk": () => island("", async page => {
    const r = await besideResident(page, ["mayor", "wren", "juniper", "marlo", "shopkeeper", "curator"]);
    console.log("talking to", r.slug);
    await page.waitForTimeout(1600);
    await shot(page, "talk-0-prompt");
    await page.keyboard.press("e");
    await page.waitForTimeout(180);
    await shot(page, "talk-1-turning");
    await page.waitForTimeout(700);
    await shot(page, "talk-2-typing");
    await page.waitForTimeout(2600);
    await shot(page, "talk-3-line-down");
    await page.keyboard.press("e");
    await page.waitForTimeout(900);
    await shot(page, "talk-4-next-line");
    for (let i = 0; i < 8; i++) {
      const done = await page.evaluate(() => !document.querySelector('[data-testid="talk-box"]'));
      if (done) break;
      await page.keyboard.press("e"); await page.waitForTimeout(150); await page.keyboard.press("e"); await page.waitForTimeout(250);
      const closing = await page.evaluate(() => document.querySelector('[data-testid="talk-box"]')?.getAttribute("data-phase"));
      if (closing === "closing") { await page.waitForTimeout(120); await shot(page, "talk-5-goodbye"); break; }
    }
    await page.waitForTimeout(2600);
    await shot(page, "talk-6-after");
    console.log("after", JSON.stringify((await page.evaluate(() => window.__residents())).find(x => x.slug === r.slug)));
  }),
  // ── The wallet: K on the island (the gift waiting, then opened there), and the coins' button ──
  "wallet": () => island("", async page => {
    await page.keyboard.press("k");
    await page.waitForTimeout(1500);
    await shot(page, "wallet-1-gift-waiting");
    await page.getByRole("button", { name: "Open it" }).click();
    await page.waitForTimeout(1600);
    await shot(page, "wallet-2-gift-opened");
    await page.getByRole("tab", { name: /Spent/ }).click();
    await page.waitForTimeout(600);
    await shot(page, "wallet-3-spent");
    await page.keyboard.press("k");
    await page.waitForTimeout(500);
    const chip = page.locator("[data-wallet]");
    console.log("coin chip", await chip.getAttribute("aria-label"), await chip.getAttribute("title"));
    await chip.click();
    await page.waitForTimeout(1200);
    await shot(page, "wallet-4-from-coins");
  }, { size: { gift: true }, extra: { "tsi.gift.later": "2026-10-03" }, demo: false }),
  // ── Sign-in links: signed out on the island (/lab/island, every member API answers 401) ──
  "signin": async () => {
    const { ctx, page } = await memberPage({ signedIn: false });
    await prime(page);
    await page.goto(`${HOST}/lab/island?at=14:05`, { waitUntil: "domcontentloaded" });
    await waitWorld(page);
    await page.waitForTimeout(5000);
    await hide(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "Sign in to add a room." } })));
    await page.waitForTimeout(500);
    await shot(page, "signin-1-toast");
    console.log("toast link", await page.locator("[data-sign-in]").first().getAttribute("href"));
    await page.keyboard.press("l");
    await page.waitForTimeout(1500);
    await shot(page, "signin-2-mailbox");
    console.log("mailbox link", await page.locator("[data-sign-in]").last().getAttribute("href"));
    await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    await page.keyboard.press("k");
    await page.waitForTimeout(1500);
    await shot(page, "signin-3-wallet");
    const href = await page.locator("[data-sign-in]").last().getAttribute("href");
    console.log("wallet link", href);
    // Where the link lands: the sign-in entry (the other session's page), carrying `next`.
    await page.goto(`${HOST}${href}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await hide(page);
    await shot(page, "signin-4-entry");
    console.log("entry url", page.url());
    await ctx.close();
  },
  // ── The Residents editor: a resident's conversations, as admins write them ──
  "editor": async () => {
    const { ctx, page } = await memberPage({ width: 1280, height: 2900 });
    await prime(page);
    await page.goto(`${HOST}/student/dashboard/admin/content/npcs/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    await hide(page);
    await page.getByPlaceholder("wise-shopkeeper").fill("kit");
    await page.getByPlaceholder("Marigold the Merchant").fill("Kit");
    await page.getByRole("button", { name: /Add a conversation/ }).click();
    await page.getByLabel("Conversation 1", { exact: true }).fill("[happy] Oh! Hi there, {name}.\nThe notice board has something new.\n[surprised] Did you see it?");
    await page.getByRole("button", { name: /Add a conversation/ }).click();
    await page.getByLabel("Conversation 2", { exact: true }).fill("[wizard] Hm.");
    await page.waitForTimeout(400);
    await page.waitForTimeout(300);
    const top = await page.getByText("Dialogue lines", { exact: true }).boundingBox();
    await shot(page, "editor-conversations", { clip: { x: 0, y: Math.max(0, (top?.y ?? 1400) - 20), width: 1280, height: Math.min(900, 2900 - Math.max(0, (top?.y ?? 1400) - 20)) } });
    await ctx.close();
  },
  // ── The phone companion (390 x 844) ──
  ...Object.fromEntries([["study", null], ["club", "Club"], ["club-calendar", "Club"], ["me", "Me"], ["me-bag", "Me"], ["me-collection", "Me"], ["me-mailbox", "Me"], ["me-showcase", "Me"],
    ["me-journal", "Me"], ["me-settings", "Me"], ["me-wallet", "Me"]].map(([n, tab]) => {
    const name = `companion-${n}`;
    return [name, () => phone(`/student/companion?mobile=1&collections=demo&progression=demo${n === "study" ? "&demo=focus" : ""}`, async page => {
      if (tab) { await page.getByRole("button", { name: tab, exact: true }).click(); await page.waitForTimeout(900); }
      if (n === "club-calendar") { await page.getByRole("tab", { name: /Calendar/ }).click(); await page.waitForTimeout(1200); }
      const sub = { "me-bag": /^Bag/, "me-collection": /Collection/, "me-mailbox": /Mailbox/, "me-showcase": /showcase/i, "me-journal": /^Journal/, "me-settings": /^Settings/ }[n];
      if (sub) {
        const b = page.getByRole("button", { name: sub }).first();
        if (!(await b.count())) { console.log("missing", n); return; }
        await b.click(); await page.waitForTimeout(1300);
      }
      if (n === "me-wallet") {
        const chip = page.getByRole("button", { name: /wallet/i }).first();
        if (!(await chip.count())) { console.log("missing", n); return; }
        await chip.click(); await page.waitForTimeout(1300);
      }
      await shot(page, name);
    })];
  })),
  // The bounty board's filters at their end: the row scrolled, "Completed" whole, the start edge fading.
  "companion-chips-scrolled": () => phone("/student/companion?mobile=1&collections=demo&progression=demo", async page => {
    await page.getByRole("button", { name: "Club", exact: true }).click();
    await page.waitForTimeout(1200);
    await page.locator('[role="tablist"][aria-label="Bounties"]').evaluate(el => el.scrollTo({ left: el.scrollWidth }));
    await page.waitForTimeout(600);
    await shot(page, "companion-chips-scrolled");
  }),
  "companion-signed-out": () => phone("/student/companion?mobile=1", async page => {
    await shot(page, "companion-signed-out");
    console.log("sign-in href", await page.locator("a", { hasText: /Sign in/ }).first().getAttribute("href").catch(() => null));
  }, { signedIn: false }),
};

for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.some(o => name.startsWith(o))) continue;
  try { await run(); } catch (e) { console.log("FAILED", name, e.message.slice(0, 200)); }
}
await browser.close();
