// Wardrobe batch 3 evidence from the engine (specs/lanes/wardrobe-b3.md). Headless Chromium (WebGL through ANGLE/Metal),
// muted, signed out, against the dev server with the Supabase env blanked, the browser lock held.
//   HOST=http://localhost:3186 node specs/evidence/wardrobe-b3/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes:
//   hairs    /lab/avatar?sheet=roblox: the 15 new hairstyles in their own colours, front, 3/4, side and back, three a shot
//   faces    ?sheet=b2faces&keys=face-26..32: the seven whole faces, front, 3/4, side and back
//   acc      ?sheet=b2acc&keys=acc-25..27: the three face accessories over the ribbon bob, front, 3/4, side and back
//   kits     ?sheet=facekit and ?sheet=hairkit (every face option, every hat, band and glasses), 3/4
//   same     the existing hairstyles the bigger atlas touched (the default bob, a two-tone one, the ushanka, the ribbon
//            bob), in their own colours and dyed: run once on the old assets (out_dir before/) and once on the new
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3186";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 1 })).newPage();
let errors = 0;
page.on("pageerror", e => { errors++; console.log("pageerror", e.message.slice(0, 300)); });
const CSS = "#island-options, [aria-controls='island-options'], nextjs-portal, nav { display: none !important } [data-sheet] > * { min-width: 0 } [data-sheet] figcaption { font-size: 11px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }";
async function shot(name, qs, [w, h], wait = 20000) {
  await page.setViewportSize({ width: w, height: h });            // the canvas is the viewport: the whole sheet in it
  await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: CSS }).catch(() => {});
  await page.waitForSelector("canvas", { timeout: 300000 });
  await sleep(wait);
  await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
}

const HAIRS = ["hair_spiky_messy", "hair_fluffy_crop", "hair_straight_layers", "hair_long_windswept", "hair_rolled_mask", "hair_tousled_spikes",
  "hair_ski_mask_dreads", "hair_braided_pigtails", "hair_space_buns", "hair_buns_braid", "hair_messy_braid", "hair_freeform_afro",
  "hair_sponge_twists", "hair_middle_part", "hair_mod_cut"];
const V4 = "views=front,34,side,back";
for (const scene of SCENES) {
  if (scene === "hairs") for (let i = 0; i < HAIRS.length; i += 3)
    await shot(`hairs-${i / 3 + 1}`, `sheet=roblox&framing=hat&skin=3&${V4}&cols=4&ids=${HAIRS.slice(i, i + 3).join(",")}`, [1400, 1100]);
  if (scene === "faces") {
    const keys = Array.from({ length: 7 }, (_, i) => `face-${26 + i}`);
    await shot("faces-1", `sheet=b2faces&framing=head&skins=3&${V4}&cols=4&keys=${keys.slice(0, 4).join(",")}`, [1400, 1450]);
    await shot("faces-2", `sheet=b2faces&framing=head&skins=3&${V4}&cols=4&keys=${keys.slice(4).join(",")}`, [1400, 1100]);
  }
  if (scene === "acc") await shot("acc", `sheet=b2acc&groups=face&framing=head&skin=3&${V4}&cols=4&keys=acc-25,acc-26,acc-27`, [1400, 1100]);
  if (scene === "kits") {
    await shot("facekit", "sheet=facekit&framing=head&skin=3&view=34", [1800, 1500]);
    await shot("hairkit", "sheet=hairkit&framing=hat&skin=3&view=34", [1800, 1100]);
  }
  if (scene === "same") {
    const ids = "hair_bob_pigtail,hair_curly_pigtails,hair_ribbon_bob%2Bacc_ushanka_goggles,hair_ribbon_bob";
    await shot("same-own", `sheet=roblox&framing=hat&skin=3&views=front,34,back&cols=3&ids=${ids}`, [1050, 1400]);
    await shot("same-dyed", `sheet=roblox&framing=hat&skin=3&hair=4&accent=8&views=front,34,back&cols=3&ids=${ids}`, [1050, 1400]);
  }
}
console.log("errors", errors);
await browser.close();
