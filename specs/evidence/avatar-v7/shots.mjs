// Engine evidence for avatar v7 milestone 1 (specs/avatar-v7.md item 5): headed Chromium (WebGL), muted, signed out.
//   bench     /lab/avatar sheets (the runtime Character under the creator's camera and lights): the three styles
//             front and 3/4, the six expressions, a blink strip and a talk strip, faces at 1024; plus a 512 (world
//             atlas) styles sheet and one live clip of the face on its own clock (blinks, talking)
//   creator   the real character creator (first screen with no saved look): the stage for each style, turned
//   village   the game camera at village distance (untouched) for the three styles, after one short step toward
//             the camera so the player faces it
//   node specs/evidence/avatar-v7/shots.mjs <out_dir> [bench|creator|village ...]     (dev server on :3113)
// Then python3 specs/evidence/avatar-v7/sheets.py <out_dir> tiles the PNGs into the review sheets.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2];
const MODES = process.argv.slice(3).length ? process.argv.slice(3) : ["bench", "creator", "village"];
const HOST = "http://localhost:3113";
const VILLAGE = "at=2,-9&time=day&weather=clear&season=summer";
const STYLES = { short: ["bangs_spiky", "back_short_spiky"], bob: ["bangs_straight", "back_bob"], long: ["bangs_curtain", "back_long"] };
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
  const bench = async (name, qs, wait = 6000) => {
    await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 240000 });
    await settle(wait);
    await shot(name, "[data-sheet]");
  };
  await bench("bench-styles", "sheet=styles", 9000);
  await bench("bench-styles-world512", "sheet=styles&face=512");
  await bench("bench-styles-black", "sheet=styles&hair=0");                          // beside hair-3d-set (black)
  await bench("bench-ref18-angle", "sheet=live&style=bob&yaw=-0.46");              // reference 18's view yaw (26 deg)
  for (const back of ["back_bob", "back_long", "back_short_spiky"]) await bench(`bench-library-bangs-${back}`, `sheet=bangs&back=${back}&yaw=-0.45`, 9000);
  for (const bangs of ["bangs_straight", "bangs_curtain"]) await bench(`bench-library-backs-${bangs}`, `sheet=backs&bangs=${bangs}&yaw=-0.45`, 9000);
  await bench("bench-hats", "sheet=hats&yaw=-0.5", 9000);
  await bench("bench-expressions", "sheet=expr");
  await bench("bench-blink", "sheet=blink");
  await bench("bench-talk", "sheet=talk");
  for (const s of Object.keys(STYLES)) await bench(`bench-body-${s}`, `sheet=live&style=${s}&framing=body&yaw=-0.6`);
  // the face on its own clock: 3 s of frames while talking (blinks land wherever the random clock puts them)
  await page.goto(`${HOST}/lab/avatar?sheet=live&style=bob&talk=1&yaw=-0.3`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await settle(6000);
  for (let i = 0; i < 12; i++) { await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/live-talk-${String(i).padStart(2, "0")}.png` }); await page.waitForTimeout(90); }
  console.log("shot live-talk x12");
}

const open = async (lookJson, pixelated = "false") => {
  await page.goto(`${HOST}/lab/island?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, px]) => {
    localStorage.clear();
    if (l) localStorage.setItem("tsi.look.v1", l);
    if (px !== null) localStorage.setItem("tsi.pixelated.v1", px);
  }, [lookJson, pixelated]);
  await page.goto(`${HOST}/lab/island?${VILLAGE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 });
  await settle(5000);
};

if (MODES.includes("creator")) {
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
  const NAMES = { bangs_spiky: "Spiky tufts", back_short_spiky: "Short layered", bangs_straight: "Straight cut", back_bob: "Bob", bangs_curtain: "Curtain", back_long: "Long straight" };
  for (const [s, [bangs, back]] of Object.entries(STYLES)) {
    await pick("Back hair", NAMES[back]);
    await pick("Bangs", NAMES[bangs]);
    await settle(2500);
    await shot(`creator-${s}-34`, "section[role=dialog] > div:first-child");
    await page.getByRole("button", { name: "Turn right" }).click();
    await settle(1500);
    await shot(`creator-${s}-front`, "section[role=dialog] > div:first-child");
    await page.getByRole("button", { name: "Turn left" }).click();
  }
  await tab("Bangs");
  await settle(3000);
  await shot("creator-bangs-grid", 'ul[aria-label="Bangs"]');
}

if (MODES.includes("village")) {
  const VILLAGE_LOOKS = [...Object.entries(STYLES).map(([s, [bangs, back]]) => [s, look({ bangs, back, hair: s === "long" ? 6 : s === "short" ? 0 : 2 })]),
    ["sunhat", look({ bangs: "bangs_curtain", back: "back_long", hair: 4, acc: { head: "acc_sunhat" } })],
    ["pony", look({ bangs: "bangs_swept_l", back: "back_high_pony", hair: 8 })]];
  for (const [s, l] of VILLAGE_LOOKS) {
    await open(JSON.stringify(l), null);   // pixel filter as shipped
    await page.mouse.click(1000, 780);
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(260);
    await page.keyboard.up("KeyS");
    await settle(1500);
    await shot(`village-${s}`, null);
  }
}
await browser.close();
