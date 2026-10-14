// Head fit evidence (specs/characters/head-fit.md). Headless Chromium (WebGL through ANGLE/Metal), muted, signed out,
// no bringToFront. Dev server on :$PORT (default 3157) with the Supabase env blanked.
//   bench     /lab/avatar facekit and hairkit sheets (the runtime Character under the creator's camera and lights):
//             every face option and every hairstyle, hat, band and glasses on 3 skins x front, 3/4 and side, faces at
//             1024 (creator) and at 512 (the world atlas), plus matte close-ups
//   creator   the real character creator (no saved look): the stage for a few looks, turned
//   world     the game camera at village distance, a few looks; and the applicant island preview (shared character)
//   node specs/evidence/head-fit/shots.mjs <out_dir> [bench|creator|world ...]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2];
const MODES = process.argv.slice(3).length ? process.argv.slice(3) : ["bench", "creator", "world"];
const HOST = `http://localhost:${process.env.PORT ?? 3157}`;
const SKINS = (process.env.SKINS ?? "1,5,10").split(",");
const VIEWS = ["front", "34", "side"];
mkdirSync(OUT, { recursive: true });
const look = (x) => ({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight",
  back: "back_bob", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {}, ...x });

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const page0 = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  page.on("console", m => { if (m.type() === "error") console.log("console", m.text().slice(0, 160)); });
  return page;
};

if (MODES.includes("bench")) {
  const page = await page0(2600, 2300);   // tall enough that every cell is in view (a View off screen is not drawn)
  const bench = async (name, qs, wait = 9000) => {
    await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 300000 });
    await page.waitForTimeout(wait);
    await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${name}.png` });
    console.log("shot", name);
  };
  const only = process.env.ONLY;
  // David's 21 (head fit): every one on 3 skins x 3 hair colours (dark brown, blonde, blue), front, 3/4 and back
  if (!only || only.includes("full")) for (const skin of SKINS) for (const hair of (process.env.HAIRS ?? "1,6,11").split(",")) for (const view of ["front", "34", "back"])
    await bench(`fullkit-s${skin}-h${hair}-${view}`, `sheet=fullkit&skin=${skin}&hair=${hair}&view=${view}`, 12000);
  for (const skin of SKINS) for (const view of [...VIEWS, ...(only?.includes("hair") ? ["back"] : [])]) {
    if (!only || only.includes("face")) await bench(`facekit-s${skin}-${view}`, `sheet=facekit&skin=${skin}&view=${view}`, 14000);
    if (!only || only.includes("hair")) await bench(`hairkit-s${skin}-${view}`, `sheet=hairkit&skin=${skin}&view=${view}`, 14000);
    if (!only || only.includes("world")) await bench(`facekit512-s${skin}-${view}`, `sheet=facekit&face=512&skin=${skin}&view=${view}`, 14000);
  }
  // matte close-ups: the default look and two row-301 faces, one big head each
  for (const [name, qs] of [["closeup-default", "sheet=live&style=bob&yaw=-0.45"], ["closeup-front", "sheet=live&style=bob&yaw=0"],
    ["closeup-side", "sheet=live&style=long&yaw=-1.5708"], ["closeup-faces301", "sheet=faces&skins=1,5,10"]]) await bench(name, qs);
  await page.context().close();
}

const VILLAGE = "at=2,-9&time=day&weather=clear&season=summer";
const LOOKS = [["bob", look({})], ["long", look({ bangs: "bangs_curtain", back: "back_long", hair: 6, skin: 1, eyes: "sleepy_lash", mouth: "cat_w", extras: ["blush_band"] })],
  ["pony", look({ bangs: "bangs_swept_l", back: "back_high_pony", hair: 8, skin: 10, eyes: "dot", mouth: "grin_curl" })],
  ["sunhat", look({ bangs: "bangs_curtain", back: "back_long", hair: 4, skin: 5, acc: { head: "acc_sunhat", face: "acc_glasses_round" } })],
  ["low-pony", look({ back: "hair_messy_low_pony", hair: 9, skin: 3 })], ["dreads-cap", look({ back: "hair_dreads_cap", hair: 0, skin: 10 })],
  ["windy-bob", look({ back: "hair_windy_bob", hair: 6, skin: 1, eyes: "doll_lash", mouth: "drool" })]];

if (MODES.includes("creator")) {
  // The real creator (first entry, no saved look; the Li'l Lads layout: icon rail, lit portrait, tiles, swatches).
  // Per skin: the Eyes, Mouth and Hair panels (tiles baked live on that skin), and per hair colour the Hair panel with
  // David's hairstyles; the portrait turned for three of his styles.
  const page = await page0(1440, 900);
  const url = `${HOST}/lab/island?${VILLAGE}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[role="dialog"]', { timeout: 300000 });
  await page.waitForTimeout(9000);
  const dlg = "section[role=dialog]";
  const shot = async (name, wait = 4000) => { await page.waitForTimeout(wait); await page.locator(dlg).first().screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
  const cat = label => page.getByRole("tab", { name: label, exact: true }).click();
  const press = name => page.getByRole("button", { name, exact: true }).first().click();
  const old = !(await page.getByRole("tab", { name: "Hair", exact: true }).count());     // the earlier creator (before)
  for (const skin of SKINS) {
    await cat(old ? "Skin" : "Head & skin");
    await press(`skin colour ${Number(skin) + 1}`);
    for (const label of old ? ["Eyes", "Mouth", "Bangs", "Back hair"] : ["Eyes", "Mouth", "Hair"]) {
      await cat(label);
      await shot(`creator-s${skin}-${label.replace(/ /g, "")}`, 6000);
      if (!old) { await page.locator("[role=tabpanel]").first().evaluate(el => el.scrollTo(0, el.scrollHeight)); await shot(`creator-s${skin}-${label}-end`, 4000); }
    }
    if (old) continue;
    for (const hair of (process.env.CREATOR_HAIRS ?? "1,3,5").split(",")) {   // the free colours a new creator offers
      await cat("Hair");
      const sw = page.getByRole("button", { name: `hair colour ${Number(hair) + 1}`, exact: true });
      if (await sw.count()) await sw.first().click();
      await page.locator("[role=tabpanel]").first().evaluate(el => el.scrollTo(0, el.scrollHeight));
      await shot(`creator-s${skin}-h${hair}-hairstyles`, 7000);
    }
    for (const style of ["Messy low ponytail", "Windy bob", "Dreads with a cap"]) {
      await cat("Hair");
      await press(style);
      for (const [view, turn] of [["34", 0], ["front", 1], ["back", 4]]) {
        for (let k = 0; k < turn; k++) await page.getByRole("button", { name: /turn right/i }).first().click().catch(() => {});
        await shot(`creator-s${skin}-${style.replace(/ /g, "_")}-${view}`, 2500);
        for (let k = 0; k < turn; k++) await page.getByRole("button", { name: /turn left/i }).first().click().catch(() => {});
      }
    }
  }
  await page.context().close();
}

const openWorld = async (page, url, l) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(([lk]) => { localStorage.clear(); localStorage.setItem("tsi.look.v1", lk); localStorage.setItem("tsi.pixelated.v1", "false"); }, [JSON.stringify(l)]);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing") && !document.querySelector('[role="status"] h1') && !document.querySelector('[aria-label="Arriving through the clouds"]'), null, { timeout: 300000, polling: 1000 });
  await page.waitForTimeout(9000);
};
if (MODES.includes("world")) {
  const page = await page0(1280, 760);
  for (const [s, l] of LOOKS) {
    await openWorld(page, `${HOST}/lab/island?${VILLAGE}`, l);
    await page.mouse.click(900, 600);
    await page.keyboard.down("KeyS");
    await page.waitForTimeout(260);
    await page.keyboard.up("KeyS");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/world-${s}.png` });
    console.log("shot world", s);
  }
  await openWorld(page, `${HOST}/student/apply/portal?preview=1`, LOOKS[1][1]);
  await page.screenshot({ path: `${OUT}/applicant-island.png` });
  console.log("shot applicant-island");
  await page.context().close();
}
await browser.close();
