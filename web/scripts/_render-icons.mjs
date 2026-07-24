// Icon batch renderer: screenshots /lab/icon per species → transparent
// 128px PNGs in public/assets/acnh/icons/.
//
// Species list is DERIVED from the fish tables (fishing.ts + fishCatalog.ts):
// every row with a key + model renders, so a full batch keeps the whole book
// visually consistent (one pose change re-renders everyone).
//
// Usage: node scripts/_render-icons.mjs [--only fish_key]
import { chromium } from "/Users/DavidLiu/Documents/GitHub/uwotsi/web/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname); // web/scripts
const WEB = path.join(ROOT, "..");

// Parse every `{ key: "...", ..., model: "...", ... }` species row.
function allSpecies() {
  const src =
    fs.readFileSync(path.join(WEB, "lib/game/fishing.ts"), "utf8") +
    fs.readFileSync(path.join(WEB, "lib/game/fishCatalog.ts"), "utf8");
  const out = [];
  for (const line of src.split("\n")) {
    const key = line.match(/\{ key: "((?:fish|sea)_[^"]+)"/)?.[1];
    const model = line.match(/model: "([^"]+\.glb)"/)?.[1];
    const raw = /raw: true/.test(line);
    if (key && model) out.push({ key, model, raw });
  }
  return out;
}

const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
let species = allSpecies();
if (only) species = species.filter((s) => s.key === only);
console.log(`${species.length} species to render`);

const BASE = process.env.BASE || "http://localhost:3099";
const browser = await chromium.launch({ args: ["--use-angle=metal"] });
// Viewport much larger than the 128px stage so the Next dev-tools badge
// (fixed, bottom-left) can't bleed into the element screenshot.
const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
let ok = 0;
const failed = [];
for (const { key, model, raw } of species) {
  try {
    await page.goto(`${BASE}/lab/icon?model=${encodeURIComponent(model)}${raw ? "&raw=1" : ""}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(1200);
    const canvas = page.locator("canvas#icon-stage, canvas").first();
    await canvas.screenshot({
      path: path.join(WEB, `public/assets/acnh/icons/${key}.png`),
      omitBackground: true,
    });
    ok++;
    console.log("rendered", key);
  } catch (e) {
    failed.push(key);
    console.log("FAILED", key, String(e).split("\n")[0]);
  }
}
console.log(`done: ${ok} ok, ${failed.length} failed${failed.length ? " → " + failed.join(", ") : ""}`);
await browser.close();
process.exit(failed.length ? 1 : 0);
