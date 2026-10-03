// GUI sheet evidence (specs/polish/gui-sheet.md): every surface the pass replaces, shot the same way before and after.
// Headed Chromium (WebGL) off to the side (--window-position=2400,0) and muted, never brought to the front. Dev server
// on :3135 with Supabase pointed at supa-stub.mjs (http://127.0.0.1:54399) and a forged session cookie for it: the
// middleware sees a signed-in member, the member APIs are answered here, and no database is touched.
//   node specs/evidence/gui-sheet/shoot.mjs <out_dir> [scene-prefix ...]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...ONLY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:3135";
const SUPA = "http://127.0.0.1:54399";
const b64url = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "00000000-0000-4000-8000-0000000000a1", email: "juniper@uwo.ca", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const EXP = Math.floor(Date.now() / 1000) + 6 * 3600;
const JWT = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: USER.id, exp: EXP, role: "authenticated", aud: "authenticated" })}.c2ln`;
const SESSION_COOKIE = { name: "sb-127-auth-token", value: `base64-${b64url({ access_token: JWT, token_type: "bearer", expires_in: 21600, expires_at: EXP, refresh_token: "r", user: USER })}`, domain: "localhost", path: "/" };
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const DAY = "2026-10-02";
const iso = (d, h = 18) => new Date(Date.UTC(2026, 9, d, h)).toISOString();

const PROFILE = { id: "m1", display_name: "Juniper", level: 7, xp: 5500, tier: 2, class: "Warden", onboarding_completed: true, avatar_config: { look: LOOK }, tc_balance: 1240, bio: "Builds things for the club.", position: "developer" };
const BOUNTIES = [
  { id: "b1", title: "Landing page for the food bank drive", description: "A one-page site for the Thanksgiving drive: hours, drop-off spots, a volunteer form.", client_name: "Growing Chefs", pay_cad: null, pay_tc: 400, xp_reward: 300, difficulty: 1, deadline: iso(18), tech_stack: ["Next.js", "Tailwind"], status: "open", submitted_by: null, approved_by: null, created_at: iso(1), updated_at: iso(1) },
  { id: "b2", title: "Volunteer shift scheduler", description: "Replace the shared spreadsheet with a small scheduler.", client_name: "BGC London", pay_cad: null, pay_tc: 900, xp_reward: 600, difficulty: 2, deadline: iso(28), tech_stack: ["React", "Supabase"], status: "open", submitted_by: null, approved_by: null, created_at: iso(1), updated_at: iso(1) },
  { id: "b3", title: "Accessibility audit", description: "Check the theatre's ticketing pages against WCAG AA.", client_name: "Grand Theatre", pay_cad: null, pay_tc: 650, xp_reward: 450, difficulty: 3, deadline: null, tech_stack: ["Audit"], status: "in_progress", submitted_by: null, approved_by: null, created_at: iso(1), updated_at: iso(1) },
];
const EVENTS = [
  { id: "e1", title: "GENESIS kickoff", event_type: "social", start_time: iso(3, 22), end_time: iso(4, 1), location: "UCC 56", description: "Pizza and teams.", tc_reward: 50, xp_reward: 100 },
  { id: "e2", title: "Workshop: shipping with Supabase", event_type: "workshop", start_time: iso(8, 22), end_time: iso(8, 23), location: "Middlesex 105", description: null, tc_reward: 30, xp_reward: 80 },
  { id: "e3", title: "Client check-in", event_type: "meeting", start_time: iso(10, 17), end_time: null, location: "Online", description: null, tc_reward: null, xp_reward: null },
];
const JOBS = [
  { id: "j1", company_name: "Shopify", role_title: "Developer Intern, Summer 2027", location: "Remote", type: "internship", description: "Work on checkout.", application_url: "https://example.com", posted_at: iso(1), status: "open" },
  { id: "j2", company_name: "Bank of Montreal", role_title: "Data Analyst Co-op", location: "Toronto", type: "co-op", description: "Analytics team.", application_url: "https://example.com", posted_at: iso(2), status: "open" },
];
const LEADERS = ["Juniper", "Theo", "Maya", "Sam", "Priya", "Ollie", "Ren", "Ava"].map((n, i) => ({ rank_position: i + 1, id: `m${i + 1}`, display_name: n, avatar_url: null, tier: 4, position: null, class: ["Warden", "Arcane", "Ranger", "Vanguard"][i % 4], subclass: null, level: 12 - i, xp: 9000 - i * 700, rank: "Member", is_active: true }));
const WALLET = { coins: 1240, gems: 0, daily_claimed: true, day: DAY, recent: [
  { id: "t1", kind: "daily_gift", currency: "coins", amount: 20, balance: 1240, note: "Daily gift", created_at: iso(2) },
  { id: "t2", kind: "shop_purchase", currency: "coins", amount: -220, balance: 1220, note: "Shop purchase", created_at: iso(1) },
] };

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--window-position=2400,0"] });

/** A page answering the member's APIs and Supabase; `look` saved or not, `gift` unclaimed. */
async function memberPage({ width = 1440, height = 900, look = true, gift = false, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" } : {}) });
  await ctx.addCookies([SESSION_COOKIE]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 240)));
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const wallet = { ...WALLET, daily_claimed: !gift };
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), p = url.pathname, m = route.request().method();
    if (p === "/api/identity/me") return json(route, { identity: { world_name: "Juniper", badge: "member", family: "Warden", settings: null } });
    if (p === "/api/profile") return m === "GET" ? json(route, { profile: look ? PROFILE : { ...PROFILE, avatar_config: {} } }) : json(route, { ok: true });
    if (p === "/api/admin/me") return json(route, { isAdmin: true });
    if (p === "/api/identity/name") return json(route, { ok: true });
    if (p === "/api/economy/wallet") return json(route, { ok: true, wallet });
    if (p === "/api/economy/daily-gift") { wallet.coins += 20; wallet.daily_claimed = true; return json(route, { ok: true, gift: { coins: 20, balance: wallet.coins, claimed: true, day: DAY } }); }
    if (p === "/api/bounties") return json(route, { bounties: BOUNTIES, myClaimedBountyIds: ["b3"] });
    if (p === "/api/events") return json(route, { events: EVENTS });
    if (p === "/api/jobs") return json(route, { jobs: JOBS });
    if (p === "/api/leaderboard") return json(route, { leaderboard: LEADERS, your_rank: 1 });
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
const toast = (page, text, icon) => page.evaluate(([t, i]) => window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: t, icon: i } })), [text, icon]);
/** The island at 2 pm beside the notice board, then `fn`. */
async function island(name, query, fn, { wait = 6000, size = {}, extra = {} } = {}) {
  const { ctx, page } = await memberPage(size);
  await prime(page, extra);
  await page.goto(`${HOST}/student/dashboard?at=14:05&at=-2.6,4.3&progression=demo&collections=demo${query ? `&${query}` : ""}`, { waitUntil: "domcontentloaded" });
  await waitWorld(page);
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await fn(page);
  await ctx.close();
}
async function portal(name, path, { size = {}, after } = {}) {
  const { ctx, page } = await memberPage(size);
  await prime(page);
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (after) await after(page);
  await shot(page, name);
  await ctx.close();
}

const SCENES = {
  // ── The game ──
  "game-hud": () => island("game-hud", "", async page => {
    await toast(page, "A hot cocoa, extra marshmallows. The windows fog up a little.", "/assets/icons/lounge-tea.webp");
    await page.waitForTimeout(400);
    await shot(page, "game-hud");
  }),
  "game-nameplate": () => island("game-nameplate", "zoom=0.45", async page => { await shot(page, "game-nameplate", { clip: { x: 520, y: 220, width: 400, height: 380 } }); }),
  "game-emotes": () => island("game-emotes", "", async page => { await page.keyboard.press("g"); await page.waitForTimeout(500); await shot(page, "game-emotes"); }),
  "game-settings": () => island("game-settings", "sheet=settings", async page => { await page.waitForTimeout(500); await shot(page, "game-settings"); }),
  "game-journal": () => island("game-journal", "sheet=journal", async page => { await page.waitForTimeout(800); await shot(page, "game-journal"); }),
  "game-collection": () => island("game-collection", "sheet=bag", async page => { await page.waitForTimeout(900); await shot(page, "game-collection"); }),
  "game-letters": () => island("game-letters", "sheet=letters", async page => { await page.waitForTimeout(800); await shot(page, "game-letters"); }),
  "game-notice": () => island("game-notice", "sheet=notice", async page => { await page.waitForTimeout(800); await shot(page, "game-notice"); }),
  "game-trophies": () => island("game-trophies", "sheet=trophies", async page => { await page.waitForTimeout(800); await shot(page, "game-trophies"); }),
  "game-showcase": () => island("game-showcase", "sheet=showcase", async page => { await page.waitForTimeout(800); await shot(page, "game-showcase"); }),
  "game-missions": () => island("game-missions", "sheet=missions", async page => { await page.waitForTimeout(800); await shot(page, "game-missions"); }),
  "game-tourney": () => island("game-tourney", "sheet=tourney", async page => { await page.waitForTimeout(800); await shot(page, "game-tourney"); }),
  "game-cafe": () => island("game-cafe", "sheet=cafe", async page => { await page.waitForTimeout(800); await shot(page, "game-cafe"); }),
  "game-closet": () => island("game-closet", "sheet=fitting", async page => { await page.waitForTimeout(1500); await shot(page, "game-closet"); }),
  "game-oracle": () => island("game-oracle", "sheet=oracle&oracle=demo", async page => { await page.waitForTimeout(1200); await shot(page, "game-oracle"); }),
  "game-donate": () => island("game-donate", "sheet=donate", async page => { await page.waitForTimeout(800); await shot(page, "game-donate"); }),
  "game-shop": () => island("game-shop", "sheet=shop", async page => { await page.waitForTimeout(1500); await shot(page, "game-shop"); }),
  "game-crafting": () => island("game-crafting", "hq=inside&crafting=demo", async page => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: true })));
    await page.waitForTimeout(300);
    await page.locator("canvas").first().focus().catch(() => {});
    await page.keyboard.press("e");
    await page.waitForTimeout(1200);
    await shot(page, "game-crafting");
  }),
  "game-devpanel": () => island("game-devpanel", "", async page => { await page.getByRole("button", { name: "Developer view options" }).click(); await page.waitForTimeout(400); await shot(page, "game-devpanel"); }),
  "game-minimap": () => island("game-minimap", "", async page => { await page.keyboard.press("m"); await page.waitForTimeout(600); await shot(page, "game-minimap"); }),
  "game-wheel": () => island("game-wheel", "", async page => {
    await page.keyboard.down("Tab"); await page.waitForTimeout(600); await shot(page, "game-wheel"); await page.keyboard.up("Tab");
  }),
  "game-decorate": () => island("game-decorate", "home=inside&decorate=1", async page => { await page.waitForTimeout(1500); await shot(page, "game-decorate"); }),
  "game-ruins": () => island("game-ruins", "ruins=1", async page => { await page.waitForTimeout(1500); await shot(page, "game-ruins"); }, { size: { width: 1280, height: 720 } }),
  "game-greeting": () => island("game-greeting", "welcome=1", async page => {
    await page.waitForSelector("[data-welcome]", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "game-greeting");
  }, { extra: { "tsi.welcomed.v1": null } }),
  "game-creator": () => island("game-creator", "", async page => { await page.waitForTimeout(3000); await shot(page, "game-creator"); }, { extra: { "tsi.look.v1": null }, wait: 4000 }),
  "game-gift": async () => {
    const { ctx, page } = await memberPage({ gift: true });
    await prime(page, { "tsi.gift.later": null });
    await page.goto(`${HOST}/student/dashboard?at=14:05&at=0,-6`, { waitUntil: "domcontentloaded" });
    await waitWorld(page);
    await page.getByRole("button", { name: "Open it" }).waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(700);
    await shot(page, "game-gift");
    await ctx.close();
  },
  "game-loading": async () => {
    const { ctx, page } = await memberPage();
    await prime(page);
    await page.goto(`${HOST}/student/dashboard?at=14:05`, { waitUntil: "commit" });
    await page.waitForSelector('[role="status"]', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "game-loading");
    await ctx.close();
  },
  // Overlays drawn standalone in the showroom (the same components the game mounts).
  "game-fish-reveal": () => portal("game-fish-reveal", "/lab/gui?only=fish-reveal", { after: page => page.waitForTimeout(5200) }),
  "game-oracle-reveal": () => portal("game-oracle-reveal", "/lab/gui?only=oracle-reveal", { after: page => page.waitForTimeout(2600) }),
  "game-rune": () => portal("game-rune", "/lab/gui?only=rune"),
  "game-emote-menu": () => portal("game-emote-menu", "/lab/gui?only=emotes"),
  // ── The member portal ──
  ...Object.fromEntries(["bounty", "calendar", "directory", "economy/wallet", "economy/shop", "economy/inventory", "economy/sell", "jobs", "journal", "kanban", "leaderboard", "letters",
    "marketplace", "mentorship", "oracle?oracle=demo", "portfolio", "profile", "quests", "settings", "shop", "tools", "admin"].map(p => {
    const name = `portal-${p.replace(/\?.*$/, "").replace(/\//g, "-")}`;
    return [name, () => portal(name, `/student/dashboard/${p}`)];
  })),
  "portal-menu": () => portal("portal-menu", "/student/dashboard/bounty", { after: async page => { await page.getByRole("button", { name: /menu/i }).first().click().catch(() => {}); await page.waitForTimeout(500); } }),
  "portal-onboarding": () => portal("portal-onboarding", "/student/onboarding"),
  "portal-opening-soon": () => portal("portal-opening-soon", "/student/opening-soon"),
  // ── The phone companion (390 x 844) ──
  ...Object.fromEntries([["study", null], ["club", "Club"], ["club-calendar", "Club"], ["me", "Me"], ["me-bag", "Me"], ["me-journal", "Me"], ["me-mailbox", "Me"], ["me-showcase", "Me"]].map(([n, tab]) => {
    const name = `companion-${n}`;
    return [name, () => portal(name, "/student/companion?mobile=1&collections=demo&progression=demo", { size: { width: 390, height: 844, mobile: true }, after: async page => {
      if (tab) { await page.getByRole("button", { name: tab, exact: true }).click(); await page.waitForTimeout(800); }
      if (n === "club-calendar") { await page.getByRole("tab", { name: /Calendar/ }).click(); await page.waitForTimeout(1200); }
      const sub = { "me-bag": /Bag/, "me-journal": /Journal/, "me-mailbox": /Mailbox/, "me-showcase": /Showcase/ }[n];
      if (sub) { await page.getByRole("button", { name: sub }).first().click(); await page.waitForTimeout(1200); }
    } })];
  })),
};

for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.some(o => name.startsWith(o))) continue;
  try { await run(); } catch (e) { console.log("FAILED", name, e.message.slice(0, 200)); }
}
await browser.close();
