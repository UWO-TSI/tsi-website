// flat-only lane shots (specs/lanes/flat-only.md). Headless, muted, reduced motion; the dev server on PORT with the
// Supabase env blanked.   PORT=3482 node ../specs/evidence/flat-only/shoot.mjs <out-dir> [scene ...]   (from web/)
// World scenes load the new world at /lab/island with one sheet open (`?sheet=`). `unchanged` scenes hide every
// canvas (WebGL never repeats a frame exactly) so their UI can be compared pixel for pixel.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3482, HOST = `http://localhost:${PORT}`;
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
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const HIDE = "nextjs-portal { display: none !important; } nav:has(> a[href='/lab']) { display: none !important; }";

async function open(url, fn, { size = "desktop", look = true, world = true, hideCanvas = false, wait = 5000, motion = false, frozen = false } = {}) {
  const phone = size === "phone";
  const ctx = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, reducedMotion: motion ? "no-preference" : "reduce" });
  await ctx.addInitScript(look => { try {
    const v = { "tsi.liteMode.v1": "false", "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": new Date().toISOString().slice(0, 10) };
    if (look) v["tsi.look.v1"] = look;
    for (const [k, x] of Object.entries(v)) localStorage.setItem(k, x);
  } catch {} }, look ? JSON.stringify(LOOK) : null);
  // Frozen (the marketing home's moving glyphs): a seeded Math.random and a clock that only moves when told, so two runs
  // draw the same frame.
  if (frozen) await ctx.addInitScript(() => { let x = 42; Math.random = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646; });
  const page = await ctx.newPage();
  if (frozen) await page.clock.install({ time: new Date("2026-11-14T12:00:00Z") });
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 160)));
  await page.route("**/api/progression/letters**", route => route.request().method() === "GET"
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, letters: LETTERS }) }) : route.fallback());
  const t0 = Date.now();
  await page.goto(`${HOST}${url}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  if (world) {
    await page.waitForSelector("canvas", { timeout: 300000 }).catch(() => console.log("no canvas", url));
    await page.waitForFunction(() => !document.body.innerText.includes("Preparing"), null, { timeout: 300000 }).catch(() => console.log("still preparing"));
  } else await page.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
  if (frozen) await page.clock.runFor(wait); else await page.waitForTimeout(wait);
  await page.addStyleTag({ content: HIDE + (hideCanvas ? " canvas { visibility: hidden !important; }" : "") });
  console.log("loaded", url, size, Math.round((Date.now() - t0) / 1000), "s");
  await fn(page);
  await ctx.close();
}
const shot = async (page, name) => { await page.mouse.move(1, 1); await page.waitForTimeout(900).catch(() => {}); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log("shot", name); };
/** A world sheet from `?sheet=`. */
const sheet = (sheetName, extra = "", size = "desktop", theme = "") => () => open(`/lab/island?at=14:05&time=day&weather=clear&sheet=${sheetName}&collections=demo&progression=demo${extra}${theme ? `&uitheme=${theme}` : ""}`,
  async page => { await page.waitForTimeout(900); await shot(page, `sheet-${sheetName}-${size}${theme ? `-${theme}` : ""}`); }, { size });
/** Escape into the UI view (the menu dock), then `fn`. */
const dock = (name, fn, size = "desktop") => () => open("/lab/island?at=14:05&time=day&weather=clear&collections=demo&progression=demo", async page => {
  await page.locator("canvas").first().click({ position: { x: 700, y: 500 } }).catch(() => {});
  await page.keyboard.press("Escape"); await page.waitForTimeout(700);
  await fn(page); await page.waitForTimeout(900); await shot(page, `${name}-${size}`);
}, { size });
/** A page with no world, canvases hidden, for the 0 px comparisons. */
const still = (name, url, fn = async () => {}, opts = {}) => () => open(url, async page => { await fn(page); await shot(page, name); }, { world: false, hideCanvas: true, ...opts });

const SCENES = {
  // ── fo-sheets: the sheets that were cream ──
  settings: sheet("settings"), path: sheet("path", "&oracle=demo&combat=demo"), oracle: sheet("oracle", "&oracle=demo"), tourney: sheet("tourney"), posters: sheet("posters"),
  cafe: sheet("cafe"), wallet: sheet("wallet"), trophies: sheet("trophies"), donate: sheet("donate"), id: sheet("id"), chest: sheet("chest"), bag: sheet("bag"),
  "settings-phone": sheet("settings", "", "phone"), "wallet-phone": sheet("wallet", "", "phone"),
  menu: dock("esc-menu", async () => {}), "menu-phone": dock("esc-menu", async () => {}, "phone"),
  friends: dock("friends", async page => { await page.getByRole("button", { name: /^Friends/ }).first().click().catch(() => console.log("no friends")); }),
  // ── fo-paper ──
  letters: sheet("letters"), notice: sheet("notice"), journal: sheet("journal"), missions: sheet("missions"), "letters-phone": sheet("letters", "", "phone"),
  // ── fo-packs: clean and the dark sample ──
  "pack-wallet-dark": sheet("wallet", "", "desktop", "dark"), "pack-settings-dark": sheet("settings", "", "desktop", "dark"),
  "pack-hud": () => open("/lab/island?at=14:05&time=day&weather=clear&collections=demo&progression=demo", async page => {
    await page.locator("canvas").first().click({ position: { x: 700, y: 500 } }).catch(() => {}); await page.keyboard.press("Escape"); await page.waitForTimeout(1500); await shot(page, "pack-hud-clean"); }),
  "pack-hud-dark": () => open("/lab/island?at=14:05&time=day&weather=clear&collections=demo&progression=demo&uitheme=dark", async page => {
    await page.locator("canvas").first().click({ position: { x: 700, y: 500 } }).catch(() => {}); await page.keyboard.press("Escape"); await page.waitForTimeout(1500); await shot(page, "pack-hud-dark"); }),
  // ── fo-pieces ──
  "lab-gui": () => open("/lab/gui", async page => {
    for (const id of ["buttons", "tabs", "lists", "controls", "dialogue", "badges", "tooltips", "banners", "cards", "sheets", "states"]) {
      const el = page.locator(`section#${id}`);
      if (!(await el.count())) { console.log("no section", id); continue; }
      await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      await el.screenshot({ path: join(OUT, `lab-${id}.png`) }).then(() => console.log("shot lab", id), e => console.log("lab", id, e.message.slice(0, 80)));
    }
  }, { world: false, wait: 4000 }),
  // ── fo-portal ──
  bounty: still("portal-bounty", "/student/dashboard/bounty", async page => { await page.waitForTimeout(2000); }, { hideCanvas: false }),
  kanban: still("portal-kanban", "/student/dashboard/kanban", async page => { await page.waitForTimeout(2000); }, { hideCanvas: false }),
  // ── fo-unchanged: 0 px ──
  home: still("u-home-desktop", "/", undefined, { frozen: true }), "home-phone": still("u-home-phone", "/", undefined, { size: "phone", frozen: true }),
  apply: still("u-apply-desktop", "/student/apply"), "apply-phone": still("u-apply-phone", "/student/apply", undefined, { size: "phone" }),
  "apply-ui": still("u-apply-ui-preview-desktop", "/student/apply/ui-preview"),
  // The applicant island's creator and collection, as the island mounts them (/dev/flat-ui: the island's frame; the real
  // island needs Supabase, blanked here). Canvases hidden. And the member creator, which must stay as it is too.
  ...Object.fromEntries(["creator-applicant", "collection-applicant", "creator", "wardrobe"].flatMap(sf => ["desktop", "phone"].map(size => [`h-${sf}${size === "phone" ? "-phone" : ""}`,
    still(`u-${sf}-${size}`, `/dev/flat-ui?surface=${sf}&collections=demo`, async page => { await page.waitForTimeout(5000); }, { size, motion: true })]))),
  "applicant-landing-phone": still("u-applicant-landing-phone", "/student/apply/portal?preview=1", undefined, { size: "phone" }),
};
for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { console.log("failed", name, e.message.slice(0, 200)); }
}
await browser.close();
