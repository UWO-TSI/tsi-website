// The shop overlay (ShopOverlay) over the in-memory economy at /dev/economy?view=overlay: the grid, an in-game item's
// detail, the club merch with the keycap keychain, its detail (turning, then a keycap press), and a phone. Headless and
// muted; the dev server on PORT with the Supabase env blanked. Run from web/:
//   PORT=3189 node ../specs/evidence/shop-interior/phase2/overlay-shots.mjs <out-dir>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [out] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3189;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
const shot = async name => { await page.waitForTimeout(400); await page.screenshot({ path: join(out, `${name}.png`) }); console.log("shot", name); };
const open = async section => {
  await page.goto(`http://localhost:${PORT}/dev/economy?view=overlay&section=${section}`);
  await page.waitForSelector("[data-testid=shop-card]", { timeout: 300000 });
  await page.waitForTimeout(3500);
};
await open("items");
await shot("20-overlay-grid");
await page.getByRole("button", { name: /^Cedar rod/ }).click();
await page.waitForSelector("[data-testid=shop-detail] canvas", { timeout: 60000 });
await page.waitForTimeout(4000);
await shot("21-overlay-detail-item");
await page.getByRole("button", { name: "Clothes" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^Cardigan/ }).first().click().catch(() => {});
await page.waitForTimeout(4500);
await shot("22-overlay-detail-clothes");
await open("merch");
await shot("23-overlay-merch");
await page.getByRole("button", { name: /^TSI keycap keychain/ }).click();
await page.waitForSelector("[data-testid=shop-detail] canvas", { timeout: 60000 });
await page.waitForTimeout(4500);
// It turns: a few frames, to pick the one facing front.
for (let i = 0; i < 8; i++) { await page.screenshot({ path: join(out, `24-overlay-keychain-${i}.png`) }); await page.waitForTimeout(650); }
console.log("shot 24-overlay-keychain-*");
// The keycap off (the stage's button): the bare switch.
await page.click("[data-testid=keycap-toggle]");
await page.waitForTimeout(1600);
await shot("24-overlay-keychain-cap-off");
await page.click("[data-testid=keycap-toggle]");
await page.waitForTimeout(1600);
// A drag turns it: across the stage.
const box = await page.locator("[data-testid=shop-detail] canvas").first().boundingBox();
await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x + box.width * (0.35 + i * 0.025), box.y + box.height * 0.5); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(250);
await shot("25-overlay-keychain-dragged");
await page.setViewportSize({ width: 390, height: 844 });
await open("merch");
await shot("26-overlay-phone");
await page.getByRole("button", { name: /^TSI keycap keychain/ }).click();
await page.waitForSelector("[data-testid=shop-detail] canvas", { timeout: 60000 });
await page.waitForTimeout(4500);
await shot("27-overlay-phone-keychain");
await browser.close();
