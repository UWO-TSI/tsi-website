// Engine evidence for avatar v8 milestone 1 (specs/avatar-v8.md): headed Chromium (WebGL), muted, signed out.
//   bench     /lab/avatar sheets (the runtime Character under the creator's camera and lights): the reworked styles and
//             the new types front, 3/4 and back, the hair accessories on several styles, the beanie and the backpack
//   creator   the real character creator's stage for each style
//   village   the game camera at village distance (untouched), after one short step toward the camera
//   node specs/evidence/avatar-v8/shots.mjs <out_dir> [bench|creator|village ...]      (dev server on :3119)
// The before shots run the same script against the previous engine and catalogue (cells it lacks are dropped).
// Then python3 specs/evidence/avatar-v8/sheets.py <after_dir> <before_dir> tiles the PNGs into the review sheets.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2];
const MODES = process.argv.slice(3).length ? process.argv.slice(3) : ["bench", "creator", "village"];
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;   // bench shots by name
const HOST = "http://localhost:3119";
const VILLAGE = "at=2,-9&time=day&weather=clear&season=summer";
const look = (x) => ({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight",
  back: "back_bob", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {}, ...x });

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
page.on("console", m => { if (m.type() === "error") console.log("console", m.text().slice(0, 200)); });
const settle = (ms = 1200) => page.waitForTimeout(ms);
const shot = async (name, target) => {
  await settle(600);
  if (target) await page.locator(target).first().screenshot({ path: `${OUT}/${name}.png` });
  else await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

if (MODES.includes("bench")) {
  const bench = async (name, qs, wait = 8000) => {
    if (ONLY && !ONLY.has(name)) return;
    await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 240000 });
    await settle(wait);
    await shot(name, "[data-sheet]");
  };
  await bench("turn-milestone", "sheet=turn&styles=bob,long,short", 12000);
  await bench("turn-milestone-black", "sheet=turn&styles=bob,long,short&hair=0");
  await bench("turn-types", "sheet=turn&styles=afro,braids");
  await bench("turn-types-black", "sheet=turn&styles=afro,braids&hair=0");
  await bench("turn-milestone-world512", "sheet=turn&styles=bob,long,short&face=512");
  await bench("turn-body", "sheet=turn&styles=bob,long,short&framing=body", 10000);
  await bench("turn-types-body", "sheet=turn&styles=afro,braids&framing=body");
  for (const [st, y] of [["bob", -0.6], ["long", -0.6], ["short", -0.6], ["bob", 2.7], ["long", 2.7]]) {
    await bench(`closeup-${st}-${y < 0 ? "34" : "back"}`, `sheet=live&style=${st}&yaw=${y}`);   // one 420 px cell: the strands
  }
  await bench("hacc", "sheet=hacc", 10000);
  await bench("beanie", "sheet=beanie");
  await bench("backpack", "sheet=backpack&framing=body");
}

const open = async (lookJson) => {
  await page.goto(`${HOST}/lab/island?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await page.evaluate((l) => { localStorage.clear(); if (l) localStorage.setItem("tsi.look.v1", l); }, lookJson);
  await page.goto(`${HOST}/lab/island?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 });
  await settle(5000);
};

if (MODES.includes("creator")) {             // the real character creator (first screen, no saved look)
  await open(null);
  await page.waitForSelector('[role="dialog"]', { timeout: 120000 });
  await settle(4000);
  const tab = (label) => page.getByRole("tab", { name: label, exact: true }).click();
  const pick = async (tabLabel, cell) => {
    await tab(tabLabel);
    for (let i = 0; i < 12; i++) {
      const b = page.getByRole("button", { name: cell, exact: true });
      if (await b.count()) { await b.first().click(); return; }
      await page.getByRole("button", { name: "Next page" }).click();
      await settle(300);
    }
    throw new Error(`no ${cell} in ${tabLabel}`);
  };
  for (const [s, back, bangs] of [["bob", "Bob", "Straight cut"], ["long", "Long straight", "Curtain"], ["short", "Short layered", "Spiky tufts"],
    ["afro", "Afro", "Curly fringe"], ["braids", "Box braids", "Braided front"]]) {
    await pick("Back hair", back);
    await pick("Bangs", bangs);
    await settle(2500);
    await shot(`creator-${s}-34`, "section[role=dialog] > div:first-child");
  }
}

if (MODES.includes("village")) {
  const LOOKS = [
    ["bob", look({})],
    ["long", look({ bangs: "bangs_curtain", back: "back_long", hair: 6 })],
    ["short", look({ bangs: "bangs_spiky", back: "back_short_spiky", hair: 0 })],
    ["afro", look({ bangs: "bangs_curls", back: "back_afro", hair: 1, skin: 8 })],
    ["braids", look({ bangs: "bangs_braids", back: "back_box_braids", hair: 0, skin: 9 })],
    ["bow", look({ acc: { hair: "hacc_bow" } })],
    ["scrunchie", look({ bangs: "bangs_swept_l", back: "back_high_pony", hair: 8, acc: { hair: "hacc_scrunchie" } })],
    ["beanie", look({ bangs: "bangs_spiky", back: "back_short_spiky", hair: 0, acc: { head: "acc_beanie" } })],
    ["backpack", look({ bangs: "bangs_curtain", back: "back_long", hair: 6, acc: { bag: "acc_backpack" } })],
  ];
  for (const [s, l] of LOOKS) {
    if (ONLY && !ONLY.has(`village-${s}`)) continue;
    await open(JSON.stringify(l));
    await page.mouse.click(1000, 780);
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(260);
    await page.keyboard.up("KeyS");
    await settle(1500);
    await shot(`village-${s}`, null);
    if (s === "backpack") {                    // and walking away from the camera, so the bag shows
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(500);
      await page.keyboard.up("KeyW");
      await settle(1500);
      await shot("village-backpack-away", null);
    }
  }
}
await browser.close();
