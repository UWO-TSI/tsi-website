// d-streak evidence: the gift card's welcome week (day 3 offered and opened, day 7's mystery box spinning and stopped).
//   PORT=3147 node specs/evidence/daily-social/streak.mjs <outDir>   (headless, muted)
// The wallet and the gift are the real client against mocked /api/economy answers in the shapes lib/wallet/service.ts
// returns (signed out locally there's no wallet); the server side is covered by welcome_week_smoke.sql and economy.test.ts.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/daily-social"] = process.argv.slice(2);
const TMP = process.env.SCRATCH ?? "/tmp";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const icon = k => `/assets/icons/${k}.webp`;
const REEL = [["wear-top-cardigan", "Cardigan", "top_cardigan"], ["furn-lounge-sofa", "Lounge sofa", "lounge-sofa"], ["acc-straw-hat", "Straw hat", "acc_straw_hat"],
  ["furn-bookshelf", "Bookshelf", "bookshelf"], ["wear-bottom-pleated-skirt", "Pleated skirt", "bottom_pleated_skirt"], ["furn-floor-lamp", "Floor lamp", "floor-lamp"],
  ["wear-top-sweater-vest", "Sweater vest", "top_sweater_vest"], ["furn-plant-monstera", "Monstera", "plant-monstera"], ["furn-wall-clock", "Wall clock", "wall-clock"]]
  .map(([slug, name, k]) => ({ slug, name, icon: icon(k) }));

async function scene(day, shots) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); localStorage.removeItem("tsi.gift.later"); } catch {} }, LOOK);
  await ctx.route("**/api/economy/wallet", r => r.fulfill({ json: { ok: true, wallet: { coins: 120, gems: 0, daily_claimed: false, day: "2026-11-03", welcome_day: day, recent: [] } } }));
  await ctx.route("**/api/economy/daily-gift", r => r.fulfill({ json: { ok: true, gift: { coins: 10, balance: 120 + 10 + (day < 7 ? day * 10 : 0), claimed: true, day: "2026-11-03",
    welcome: { day, coins: day < 7 ? day * 10 : 0, item: day === 7 ? REEL[1] : null, reel: day === 7 ? REEL : [] } } } }));
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  await page.goto(`http://localhost:${process.env.PORT ?? 3147}/lab/island?time=day&weather=clear`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-labelledby="daily-gift-title"]', { timeout: 300000 });
  await page.waitForTimeout(1500);
  const clip = { x: 330, y: 70, width: 440, height: 330 };
  for (const [name, act, wait] of shots) {
    if (act) await act(page);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${TMP}/${name}.png`, clip });
    console.log("shot", name, await page.locator("#daily-gift-title").innerText().catch(() => "?"));
  }
  await ctx.close();
}
const open = p => p.getByRole("button", { name: /Open it/ }).click();
await scene(3, [["streak-day3-offer", null, 300], ["streak-day3-opened", open, 1600]]);
await scene(7, [["streak-day7-offer", null, 300], ["streak-day7-spin", open, 1800], ["streak-day7-won", null, 2600]]);
await browser.close();
const names = ["streak-day3-offer", "streak-day3-opened", "streak-day7-offer", "streak-day7-spin", "streak-day7-won"];
const args = ["montage"];
names.forEach(n => args.push("-label", n.replace("streak-", ""), `${TMP}/${n}.png`));
args.push("-tile", "3x", "-geometry", "440x330+4+4", "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "13", "-quality", "75", `${OUT}/d-streak.webp`);
execFileSync("magick", args);
console.log("wrote", `${OUT}/d-streak.webp`);
