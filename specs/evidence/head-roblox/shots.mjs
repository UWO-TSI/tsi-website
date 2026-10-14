// Head-roblox evidence from the engine (specs/characters/head-roblox.md): the runtime Character on /lab/avatar under the
// creator's camera and lights. Headless Chromium (WebGL through ANGLE/Metal), muted, signed out. Dev server on :$PORT
// (default 3174) with the Supabase env blanked.
//   node specs/evidence/head-roblox/shots.mjs <out_dir> [hairs|visor|lod|faces|icon ...]
//   hairs  David's 21 (?sheet=roblox, body framing, skin 3, hair colour $HAIR or 3): <out>/frames/<id>_<view>.png,
//          for sheets.py hairs
//   visor  #8 with its split-off visor, and without, front and 3/4 head close-ups
//   lod    a few hairstyles at Full, LOD 1 and LOD 2 (?charlod=), 3/4 head close-ups
//   faces  David's 19 faces (?sheet=david) and the three styles (?sheet=styles) on the v9 head
//   icon   the visor's shop icon (/lab/icons) into web/public/assets/icons/acc_visor.webp
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2];
const MODES = process.argv.slice(3).length ? process.argv.slice(3) : ["hairs", "visor", "lod", "faces", "icon"];
const HOST = `http://localhost:${process.env.PORT ?? 3174}`;
const HAIR = process.env.HAIR ?? "3";
const WEB = join(dirname(fileURLToPath(import.meta.url)), "../../../web");
const MANIFEST = JSON.parse(require("node:fs").readFileSync(join(WEB, "../art/characters/hair/source/david/manifest.json"), "utf8"));
const IDS = MANIFEST.hairs.map(h => h.id);
mkdirSync(join(OUT, "frames"), { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const open = async (w, h) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  page.on("console", m => { if (m.type() === "error") console.log("console", m.text().slice(0, 160)); });
  return page;
};
/** One bench page: every cell's View saved as <dir>/<label with spaces as _>.png, and the whole sheet. */
async function bench(page, qs, dir, sheetName, wait = 14000) {
  await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForTimeout(wait);
  if (sheetName) await page.locator("[data-sheet]").first().screenshot({ path: join(OUT, `${sheetName}.png`) });
  if (!dir) return;
  const figs = page.locator("figure");
  for (let i = 0; i < await figs.count(); i++) {
    const label = (await figs.nth(i).locator("figcaption").innerText()).trim().replace(/\s+/g, "_");
    await figs.nth(i).locator("div").first().screenshot({ path: join(dir, `${label}.png`) });
  }
  console.log("shot", qs);
}

if (MODES.includes("hairs")) {
  const page = await open(1600, 4200);       // 7 rows of 4 body cells, every View in view (one off screen is not drawn)
  for (let k = 0; k < IDS.length; k += 7)
    await bench(page, `sheet=roblox&framing=body&skin=3&hair=${HAIR}&ids=${IDS.slice(k, k + 7).join(",")}`, join(OUT, "frames"), null);
  await page.context().close();
}
if (MODES.includes("visor")) {
  const page = await open(1300, 1400);
  await bench(page, `sheet=roblox&framing=head&skin=3&hair=${HAIR}&views=front,34&ids=hair_visor_messy%2Bacc_visor,hair_visor_messy`, join(OUT, "frames"), "visor");
  await page.context().close();
}
if (MODES.includes("lod")) {
  const ids = "hair_windy_bob,hair_hime_short,hair_messy_wolf,hair_long_pigtails,hair_dreads_cap";
  const page = await open(1300, 2600);
  for (const [tier, q] of [["full", ""], ["lod1", "&charlod=1"], ["lod2", "&charlod=2"]]) {
    const dir = join(OUT, "lod", tier);
    mkdirSync(dir, { recursive: true });
    await bench(page, `sheet=roblox&framing=head&skin=3&hair=${HAIR}&views=34,back&ids=${ids}${q}`, dir, null);
  }
  await page.context().close();
}
if (MODES.includes("faces")) {
  const page = await open(2600, 2300);
  await bench(page, "sheet=david&skins=1,5,10", null, "david-faces");
  await bench(page, "sheet=styles", null, "styles");
  await page.context().close();
}
if (MODES.includes("icon")) {
  const page = await open(900, 700);
  await page.goto(`${HOST}/lab/icons`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__icons, null, { timeout: 240000 });
  const url = await page.evaluate(k => window.__icons.render(k), "acc_visor");
  if (!url.startsWith("data:image/webp")) throw new Error("the browser didn't encode WebP");
  writeFileSync(join(WEB, "public/assets/icons/acc_visor.webp"), Buffer.from(url.split(",")[1], "base64"));
  console.log("icon acc_visor");
  await page.context().close();
}
await browser.close();
