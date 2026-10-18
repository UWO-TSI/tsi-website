// The flat UI rollout's in-game shots (specs/polish/flat-ui.md): menus over the member island at /lab/island, the
// demo services behind them (collections=demo, progression=demo). Headless and muted; the dev server on PORT with the
// Supabase env blanked.   PORT=3191 node ../specs/evidence/flat-ui/shots-game.mjs <out-dir> [scene ...]   (from web/)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3191, HOST = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const iso = (d, h = 18) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
const ME = "00000000-0000-4000-8000-000000000001";
const LETTERS = [
  { id: "l1", kind: "system", sender_id: null, sender_name: "HQ", recipient_id: ME, recipient_name: "You", subject: "Welcome to the island", body: "Your plot is waiting by HQ. Bring your first catch to the museum shell when you have one.", created_at: iso(14, 14), read_at: null, reported: false, outgoing: false },
  { id: "l2", kind: "note", sender_id: "m3", sender_name: "Maya", recipient_id: ME, recipient_name: "You", subject: "Fishing derby", body: "Saturday at the pier? I'll bring the bait.", created_at: iso(15, 20), read_at: iso(15, 21), reported: false, outgoing: false },
];
async function island(query, fn, { width = 1440, height = 900, wait = 6000 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(look => { try {
    for (const [k, v] of Object.entries({ "tsi.liteMode.v1": "false", "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.look.v1": look, "tsi.gift.later": new Date().toISOString().slice(0, 10) })) localStorage.setItem(k, v);
  } catch {} }, JSON.stringify(LOOK));
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  // Mail the demo services don't answer: two letters, so the paper letters show.
  await page.route("**/api/progression/letters**", route => route.request().method() === "GET"
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, letters: LETTERS }) }) : route.fallback());
  const t0 = Date.now();
  await page.goto(`${HOST}/lab/island?at=14:05&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Preparing"), null, { timeout: 300000 }).catch(() => console.log("still preparing"));
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } nav:has(> a[href='/lab']) { display: none !important; }" });
  console.log("loaded in", Math.round((Date.now() - t0) / 1000), "s");
  await fn(page);
  await ctx.close();
}
const shot = async (page, name) => { await page.mouse.move(1, 1); await page.waitForTimeout(800); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log("shot", name); };
/** A sheet the world opens from `?sheet=` (its dev list), shot once it has loaded. */
const sheet = (name, query, extra = 900) => () => island(`${query}&collections=demo&progression=demo`, async page => { await page.waitForTimeout(extra); await shot(page, name); });
/** Escape once: the UI view and its menu dock; then `fn`. */
const dock = (name, fn) => () => island("collections=demo&progression=demo", async page => {
  await page.locator("canvas").first().click({ position: { x: 700, y: 500 } }).catch(() => {});
  await page.keyboard.press("Escape"); await page.waitForTimeout(700);
  if (await page.locator("[data-testid=menu-dock]").count() === 0) { await page.keyboard.press("Escape"); await page.waitForTimeout(700); }
  await fn(page); await page.waitForTimeout(900); await shot(page, name);
});
const SCENES = {
  decorate: () => island("home=inside&decorate=1", async page => { await shot(page, "5b-decorate-room"); }),
  "decorate-finishes": () => island("home=inside&decorate=1", async page => {
    await page.getByRole("button", { name: "Wallpaper and flooring" }).click().catch(() => console.log("no finishes filter"));
    await shot(page, "5c-decorate-finishes");
  }),
  // ── Step 7: every other in-game sheet ──
  settings: sheet("7a-settings", "sheet=settings"),
  journal: sheet("7b-journal", "sheet=journal"),
  letters: sheet("7c-mail", "sheet=letters"),
  notice: sheet("7d-notice", "sheet=notice"),
  path: sheet("7e-oracle-path", "sheet=path&oracle=demo&combat=demo", 1500),
  missions: sheet("7f-mission-board", "sheet=missions", 1500),
  wallet: sheet("7g-wallet", "sheet=wallet"),
  tourney: sheet("7h-tourney", "sheet=tourney"),
  cafe: sheet("7i-cafe-goals", "sheet=cafe"),
  trophies: sheet("7j-trophies", "sheet=trophies"),
  showcase: sheet("7k-showcase", "sheet=showcase"),
  donate: sheet("7l-donate", "sheet=donate"),
  menu: dock("7m-esc-menu", async page => { await page.keyboard.press("Escape"); }),
  friends: dock("7n-friends", async page => { await page.locator("[data-testid=menu-dock]").getByRole("button", { name: /^Friends/ }).first().click(); }),
  people: dock("7o-people", async page => { await page.locator("[data-testid=menu-dock]").getByRole("button", { name: /^Here/ }).first().click().catch(() => console.log("no people entry")); }),
  "settings-phone": () => island("sheet=settings&collections=demo&progression=demo", async page => { await page.waitForTimeout(900); await shot(page, "7p-settings-phone"); }, { width: 390, height: 844 }),
  "journal-phone": () => island("sheet=journal&collections=demo&progression=demo", async page => { await page.waitForTimeout(900); await shot(page, "7q-journal-phone"); }, { width: 390, height: 844 }),
};
for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { console.log("failed", name, e.message.slice(0, 200)); }
}
await browser.close();
