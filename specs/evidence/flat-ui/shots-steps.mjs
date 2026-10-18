// The flat UI rollout's before and after (specs/polish/flat-ui.md), steps 2 to 6: each surface in the same state with
// the same data. Headless and muted; the dev server on PORT with the Supabase env blanked and
// NEXT_PUBLIC_MEMBER_WORLD=open. The portal's shop pages get their /api answers here (economy-fixture.ts, run once by
// vite-node); the in-game menus run on the in-memory services at /dev/flat-ui (collections=demo, crafting=demo).
//   PORT=3191 node ../specs/evidence/flat-ui/shots-steps.mjs <out-dir> [scene ...]   (run from web/)
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3191, HOST = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const HERE = dirname(fileURLToPath(import.meta.url));
const ECO_FILE = process.env.ECONOMY ?? join(HERE, "../../../web/.next-economy.json");
if (!existsSync(ECO_FILE)) execFileSync("npx", ["vite-node", "-c", "vitest.config.ts", join(HERE, "economy-fixture.ts"), ECO_FILE], { cwd: join(HERE, "../../../web"), stdio: "ignore" });
const ECONOMY = JSON.parse(readFileSync(ECO_FILE, "utf8"));
const PRODUCTS = [
  { id: "p1", name: "Tethos crewneck", description: "Heavyweight cotton, the island crest on the chest.", price_tc: 900, category: "apparel", stock: 12 },
  { id: "p2", name: "Sticker pack", description: "Six stickers: the HQ clock, a pear, the leaf glider and friends.", price_tc: 120, category: "merch", stock: 40 },
  { id: "p3", name: "Enamel pin", description: "The crest in gold enamel.", price_tc: 200, category: "accessories", stock: 25 },
  { id: "p4", name: "Phone wallpaper set", description: "Four island scenes, one per season.", price_tc: 60, category: "digital" },
];

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
async function newPage({ width = 1440, height = 900, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.welcomed.v1", "1"); } catch {} });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  return { ctx, page };
}
/** The portal's member APIs, answered from the fixture (the economy service's own shapes). */
async function routeApis(page) {
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/**", async route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/api/economy/shop") return json(route, { ok: true, shop: ECONOMY.shop });
    if (p === "/api/economy/wallet") return json(route, { ok: true, wallet: ECONOMY.wallet });
    if (p === "/api/economy/sell") return json(route, { ok: true, sellable: ECONOMY.sellable });
    if (p === "/api/economy/inventory") return json(route, { ok: true, inventory: ECONOMY.inventory });
    if (p === "/api/economy/merch") return json(route, { ok: true, merch: ECONOMY.merch });
    if (p === "/api/shop") return json(route, { products: PRODUCTS });
    if (p === "/api/economy") return json(route, { balance: ECONOMY.wallet.gems });
    if (p === "/api/identity/me") return json(route, { ok: true, identity: { world_name: "Juniper", badge: "member", family: "Warden", settings: null } });
    return json(route, { ok: false, error: "Not in this fixture" }, 404);
  });
}
const hideDev = page => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
const shot = async (page, name) => { await page.mouse.move(1, 1); await page.waitForTimeout(700); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log("shot", name); };
const tryClick = async (page, ...locators) => { for (const l of locators) { try { await l.first().click({ timeout: 4000 }); return true; } catch { /* next */ } } console.log("no target"); return false; };

async function portal(name, path, size, after) {
  const { ctx, page } = await newPage(size);
  await routeApis(page);
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await hideDev(page);
  if (after) await after(page);
  await shot(page, name);
  await ctx.close();
}
async function harness(query, size, fn) {
  const { ctx, page } = await newPage(size);
  await page.goto(`${HOST}/dev/flat-ui?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await hideDev(page);
  await fn(page);
  await ctx.close();
}
const PHONE = { width: 390, height: 844, mobile: true };

const SCENES = {
  // ── Step 2: the old shop copies ──
  "portal-shop": () => portal("2a-portal-shop", "/student/dashboard/shop"),
  "portal-shop-phone": () => portal("2b-portal-shop-phone", "/student/dashboard/shop", PHONE),
  "economy-shop": () => portal("2c-economy-shop", "/student/dashboard/economy/shop"),
  "economy-shop-merch": () => portal("2d-economy-shop-merch", "/student/dashboard/economy/shop", undefined, async page => {
    await tryClick(page, page.getByRole("tab", { name: /^Merch/ }), page.getByRole("button", { name: "All merch", exact: true }));
    await page.waitForTimeout(1500);
  }),
  "economy-shop-phone": () => portal("2e-economy-shop-phone", "/student/dashboard/economy/shop", PHONE),
  // ── Step 3: the bag, then the chest ──
  "bag": () => harness("surface=bag&collections=demo&bag=19", undefined, async page => {
    await page.waitForTimeout(1500);
    await shot(page, "3a-bag");
    await tryClick(page, page.getByRole("button", { name: /^Apple/ }));
    await page.waitForTimeout(2500);
    await shot(page, "3b-bag-item");
    await tryClick(page, page.getByRole("button", { name: /^All$|^Back|^Pockets$/ }), page.getByRole("tab", { name: "Pockets" }));
    await tryClick(page, page.getByRole("tab", { name: /Tools, clothes/ }), page.getByRole("button", { name: "Clothes", exact: true }));
    await page.waitForTimeout(1500);
    await shot(page, "3c-bag-owned");
  }),
  "bag-phone": () => harness("surface=bag&collections=demo&bag=19", PHONE, async page => { await page.waitForTimeout(1500); await shot(page, "3d-bag-phone"); }),
  "chest": () => harness("surface=chest&collections=demo&chest=1&bag=19", undefined, async page => {
    await page.waitForTimeout(1500);
    await shot(page, "3e-chest");
  }),
  // ── Step 4: the workbench ──
  "crafting": () => harness("surface=crafting&crafting=demo", undefined, async page => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: true })));
    await page.waitForTimeout(300);
    await tryClick(page, page.getByRole("button", { name: /Use the workbench/ }));
    await page.waitForTimeout(2500);
    await shot(page, "4a-workbench");
    await tryClick(page, page.getByRole("button", { name: /^Floor lamp/ }));
    await page.waitForTimeout(2500);
    await shot(page, "4b-workbench-recipe");
  }),
  "crafting-phone": () => harness("surface=crafting&crafting=demo", PHONE, async page => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: true })));
    await page.waitForTimeout(300);
    await tryClick(page, page.getByRole("button", { name: /Use the workbench/ }));
    await page.waitForTimeout(2500);
    await shot(page, "4c-workbench-phone");
  }),
  // ── Step 5: the furniture catalogue (over the plain sky; the in-game shot is separate) ──
  "decorate": () => harness("surface=decorate&pick=floor-lamp", undefined, async page => { await page.waitForTimeout(1500); await shot(page, "5a-decorate"); }),
  // ── Step 6: the collection book ──
  "collection": () => harness("surface=collection&collections=demo", undefined, async page => {
    await page.waitForTimeout(2500);
    await shot(page, "6a-collection");
    await tryClick(page, page.getByRole("button", { name: /^Dace/ }));
    await page.waitForTimeout(2500);
    await shot(page, "6b-collection-entry");
    await tryClick(page, page.getByRole("tab", { name: /^Bugs/ }), page.getByRole("button", { name: /^Bugs/ }));
    await page.waitForTimeout(2000);
    await shot(page, "6c-collection-bugs");
  }),
  "collection-phone": () => harness("surface=collection&collections=demo", PHONE, async page => { await page.waitForTimeout(2500); await shot(page, "6d-collection-phone"); }),
};
for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.some(o => name === o || name.startsWith(`${o}-`))) continue;
  try { await run(); } catch (e) { console.log("failed", name, e.message.slice(0, 200)); }
}
await browser.close();
