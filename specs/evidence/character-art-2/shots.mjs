// Headed Chromium (WebGL) evidence for character art pass 2, signed out on /lab/island (dev server on :4100).
// Each look goes in through localStorage (tsi.look.v1), the player takes one step toward the camera so it faces
// us, and the shot is cropped round the player at 2x. `?study=break` seats the player at the cafe's four-seat
// table on a break (Stretch).
//   node specs/evidence/character-art-2/shots.mjs <out_dir>   then cwebp each PNG to A2-*.webp
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const BASE = "http://localhost:4100/lab/island";
const OUT = process.argv[2];
const base = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };
const dress = (x) => ({ ...base, ...x });
const VILLAGE = "at=5.6,-6.2&time=day&weather=clear";
const SHOTS = [
  ["A2-01-straw-hat", dress({ acc: { head: "acc_straw_hat" }, top: "top_stripe_ls", bottom: "bottom_overall_shorts" })],
  ["A2-02-flower-crown", dress({ acc: { head: "acc_flower_crown" }, back: "back_long", onepiece: "onepiece_sundress", top: null, bottom: null, shoes: "shoes_sandals" })],
  ["A2-03-crystal-circlet", dress({ acc: { head: "acc_crystal_circlet" }, bangs: "bangs_curtain", back: "back_wavy_long", top: "top_collar_shirt", bottom: "bottom_trousers", shoes: "shoes_loafers" })],
  ["A2-04-shell-necklace", dress({ acc: { neck: "acc_shell_necklace" }, top: "top_tee", bottom: "bottom_shorts", shoes: "shoes_sandals", hair: 5 })],
  ["A2-05-silk-sweater", dress({ top: "outfit_silk_sweater", bottom: "bottom_long_skirt", back: "back_bun", shoes: "shoes_loafers" })],
  ["A2-06-monarch-cape", dress({ onepiece: "outfit_monarch_cape", top: null, bottom: null, shoes: "shoes_boots", bangs: "bangs_choppy", back: "back_pigtails", hair: 0 })],
  ["A2-07-koi-kimono", dress({ onepiece: "outfit_koi_kimono", top: null, bottom: null, shoes: "shoes_sandals", back: "back_bun", skin: 6 })],
  ["A2-09-beanie-knit-cap", dress({ acc: { head: "acc_beanie" }, top: "top_hoodie", bottom: "bottom_joggers", shoes: "shoes_sneakers" })],
  ["A2-10-cap-wispy-bangs", dress({ acc: { head: "acc_cap" }, bangs: "bangs_wispy", top: "top_tsi_crew", bottom: "bottom_shorts", shoes: "shoes_sneakers" })],
  ["A2-11-backpack-long-hair", dress({ acc: { bag: "acc_backpack" }, back: "back_long", top: "top_raincoat", bottom: "bottom_trousers", shoes: "shoes_rainboots" }), "back"],
];

const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message));
const ready = async () => {
  await page.waitForSelector("canvas", { timeout: 180000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing the island"), null, { timeout: 180000 });
  await page.waitForTimeout(5000);
};
const step = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(1200); };
// The player stands a little below the middle of the view; crop a portrait round it.
const around = { x: 1440 / 2 - 230, y: 900 / 2 - 190, width: 460, height: 400 };
const shot = async (name, clip = around) => { await page.screenshot({ path: `${OUT}/${name}.png`, clip }); console.log("shot", name); };

await page.goto(`${BASE}?${VILLAGE}`, { waitUntil: "domcontentloaded" });
for (const [name, look, facing] of SHOTS) {
  await page.evaluate(l => localStorage.setItem("tsi.look.v1", l), JSON.stringify(look));
  await page.goto(`${BASE}?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await ready();
  if (facing !== "back") await step("ArrowDown", 140);
  else { await step("ArrowUp", 140); }
  await shot(name);
}

// Stretch at the cafe: the demo seats you at the four-seat table on a break.
await page.evaluate(l => localStorage.setItem("tsi.look.v1", l), JSON.stringify(dress({ top: "outfit_silk_sweater", bottom: "bottom_long_skirt", back: "back_bun", shoes: "shoes_loafers" })));
await page.goto(`${BASE}?cafe=inside&study=break&time=day`, { waitUntil: "domcontentloaded" });
await ready();
await page.waitForTimeout(4000);
await shot("A2-08-stretch-cafe-table", { x: 0, y: 0, width: 1440, height: 900 });
await page.waitForTimeout(700);
await shot("A2-08b-stretch-cafe-table-later", { x: 0, y: 0, width: 1440, height: 900 });

await browser.close();
