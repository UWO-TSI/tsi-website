// The flat UI kit, step 1 (specs/polish/flat-ui.md): the shop overlay shot before and after it moved onto the kit, in
// the same states over the in-memory economy (/dev/economy?view=overlay), to check it is pixel-identical. Headless and
// muted; the dev server on PORT with the Supabase env blanked. Each turning stage's canvas box is written to masks.json
// (the stage keeps turning, so the diff leaves it out). Run from web/:
//   PORT=3191 node ../specs/evidence/flat-ui/shots-shop.mjs <out-dir>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [out] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3191;
mkdirSync(out, { recursive: true });
const masks = {};
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
const shot = async name => {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(700);
  const boxes = await page.locator("[data-testid=shop-detail] canvas").evaluateAll(cs => cs.map(c => { const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })).catch(() => []);
  // A stage's own canvas (not the cards' pixel pictures): anything bigger than a card picture.
  masks[name] = boxes.filter(b => b[2] > 150);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log("shot", name);
};
const open = async section => {
  await page.goto(`http://localhost:${PORT}/dev/economy?view=overlay&section=${section}`);
  await page.waitForSelector("[data-testid=shop-card]", { timeout: 300000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(3000);
};
const shelf = async name => { await page.getByRole("button", { name, exact: true }).click(); await page.waitForTimeout(900); };
await open("items");
await shot("s1-items-tools");
await shelf("Clothes").catch(() => {});
await shot("s2-items-clothes");
await shelf("Today's specials").catch(async () => shelf(/special/i));
await shot("s3-items-specials");
await shelf("Sell").catch(() => {});
await page.waitForTimeout(800);
await shot("s4-items-sell");
await shelf("Tools").catch(() => {});
await page.getByRole("button", { name: /^Cedar rod/ }).click();
await page.waitForSelector("[data-testid=shop-detail] canvas", { timeout: 60000 });
await page.waitForTimeout(3000);
await shot("s5-detail-item");
await open("merch");
await shot("s6-merch-grid");
await shelf("Your pickups");
await page.waitForTimeout(800);
await shot("s7-merch-pickups");
await shelf("All merch").catch(async () => page.locator("nav[aria-label=Shelves] button").first().click());
await page.waitForTimeout(800);
await page.getByRole("button", { name: /^TSI keycap keychain/ }).click();
await page.waitForSelector("[data-testid=shop-detail] canvas", { timeout: 60000 });
await page.waitForTimeout(3500);
await shot("s8-merch-keychain");
// The lanyard has no price yet: "Price to come", Redeem off.
await page.getByRole("button", { name: /^Next: TSI lanyard/ }).click();
await page.waitForTimeout(3500);
await shot("s11-merch-lanyard");
await page.setViewportSize({ width: 390, height: 844 });
await open("items");
await shot("s9-phone-grid");
await page.getByRole("button", { name: /^Cedar rod/ }).click();
await page.waitForSelector("[data-testid=shop-detail] canvas", { timeout: 60000 });
await page.waitForTimeout(3000);
await shot("s10-phone-detail");
writeFileSync(join(out, "masks.json"), JSON.stringify(masks, null, 1));
await browser.close();
