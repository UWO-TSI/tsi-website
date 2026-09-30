// Headed Chromium (WebGL) evidence for polish-ownership. Signed out, `?crafting=demo`
// answers /api/economy/{inventory,shop,buy} from the in-memory services.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const BASE = "http://localhost:3900/lab/island";
const OUT = process.argv[2];
const look = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_hoodie: 2 } };
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(l => { try { localStorage.setItem("tsi.look.v1", l); } catch {} }, JSON.stringify(look));
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message));
const shot = async (name, opts = {}) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png`, ...opts }); console.log("shot", name); };
const ready = async () => {
  await page.waitForSelector("canvas", { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing the island"), null, { timeout: 180000 });
  await page.waitForTimeout(4000);
};

// 1. Fitting room: owned vs locked tops, the lock note with the shop link.
await page.goto(`${BASE}?crafting=demo&at=5.6,-4.3&time=day`, { waitUntil: "domcontentloaded" });
await ready();
const prompt = await page.locator("button", { hasText: "Try on outfits" }).count();
console.log("fitting prompt", prompt);
await page.keyboard.press("e");
await page.waitForSelector('[aria-labelledby="creator-title"]', { timeout: 30000 });
await page.getByRole("tab", { name: "Tops" }).click();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Cardigan (in the shop)" }).click();
await shot("O2-01-wardrobe-owned-vs-locked");

// 2. Visit the shop: outfits tab with the six hair dyes.
await page.getByRole("button", { name: "Visit the shop" }).click();
await page.waitForSelector('[role="dialog"][aria-label="Shop"] article', { timeout: 30000 });
await page.locator('article[aria-label="Blossom pink hair dye"]').scrollIntoViewIfNeeded();
await shot("O2-02-shop-hair-dyes");

// Buy the cardigan and a dye through the real shop body.
for (const name of ["Cardigan", "Blossom pink hair dye"]) {
  await page.locator(`article[aria-label="${name}"] button`).click();
  await page.waitForSelector(`text=Bought ${name}.`, { timeout: 15000 });
}
await page.locator('article[aria-label="Cardigan"]').scrollIntoViewIfNeeded();
await shot("O2-03-shop-bought");
await page.getByRole("button", { name: "Close", exact: true }).click();

// 3. Back in the fitting room: the cardigan and the dye are owned now.
await page.waitForTimeout(800);
await page.keyboard.press("e");
await page.waitForSelector('[aria-labelledby="creator-title"]', { timeout: 30000 });
await page.getByRole("tab", { name: "Tops" }).click();
await page.getByRole("button", { name: "Cardigan", exact: true }).click();
await page.waitForTimeout(2500);
await shot("O2-04a-wardrobe-cardigan-owned");
await page.getByRole("tab", { name: "Bangs" }).click();
await page.getByRole("button", { name: "hair colour 11" }).click();
await page.getByRole("button", { name: "hair colour 9 (hair dye in the shop)" }).click();
await page.waitForTimeout(2500);
await shot("O2-04b-wardrobe-dyes-owned-vs-locked");
await page.getByRole("button", { name: "Close", exact: true }).click();

// 4. Decorate inside the house: only owned pieces, with how many are left.
await page.goto(`${BASE}?crafting=demo&home=inside&decorate=1&time=day`, { waitUntil: "domcontentloaded" });
await ready();
await page.waitForSelector('[aria-label="Decorate"] [data-piece]', { timeout: 30000 });
await shot("O2-05-decorate-owned-only");

await browser.close();
