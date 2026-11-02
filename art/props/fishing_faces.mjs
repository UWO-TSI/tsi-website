// The fishing signs' painted faces: fishing_faces.html in headless Chromium (never a window, muted), each face to a PNG
// for build_fishing_signs.py, the counts from the game's own reel (lib/game/fishing.ts FISH, the roster's habitats).
//   cd web && node ../art/props/fishing_faces.mjs <out_dir>
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { createJiti } = createRequire(`${process.cwd()}/package.json`)("jiti");
const { chromium } = require("playwright");
const OUT = process.argv[2];
const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } });
const { FISH } = await jiti.import(`${process.cwd()}/lib/game/fishing.ts`);
const { ROSTER } = await jiti.import(`${process.cwd()}/lib/collections/roster.ts`);
const biome = new Map(ROSTER.map(s => [s.key, s.biome]));
const counts = {
  river: FISH.filter(f => (f.zone ?? "river") === "river" && biome.get(f.key) !== "pond").length,
  pond: FISH.filter(f => biome.get(f.key) === "pond").length,
  sea: FISH.filter(f => f.zone === "sea").length,
};
console.log("counts", counts);
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(new URL("./fishing_faces.html", import.meta.url).href);
await page.evaluate(c => document.querySelectorAll("[data-count]").forEach(el => { el.textContent = `${c[el.dataset.count]} ${el.textContent}`; }), counts);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
for (const id of ["river", "pond", "sea", "deep", "header"]) await page.locator(`#${id}`).screenshot({ path: `${OUT}/${id}.png` });
await browser.close();
console.log("faces in", OUT);
