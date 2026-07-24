// Icon batch renderer: screenshots /lab/icon per species → transparent
// 128px PNGs in public/assets/acnh/icons/. Usage: node scripts/_render-icons.mjs
import { chromium } from "/Users/DavidLiu/Documents/GitHub/uwotsi/web/node_modules/playwright/index.mjs";

const SPECIES = [
  ["fish_killifish", "/assets/acnh/fish/killifish.glb"],
  ["fish_loach", "/assets/acnh/fish/loach.glb"],
  ["fish_sweetfish", "/assets/acnh/fish/sweetfish.glb"],
  ["fish_rainbow_trout", "/assets/acnh/fish/rainbow-trout.glb"],
  ["fish_salmon", "/assets/acnh/fish/salmon.glb"],
  ["fish_snakehead", "/assets/acnh/fish/snakehead.glb"],
  ["fish_gar", "/assets/acnh/fish/gar.glb"],
  ["fish_king_salmon", "/assets/acnh/fish/king-salmon.glb"],
  ["fish_stringfish", "/assets/acnh/fish/stringfish.glb"],
  ["fish_golden_trout", "/assets/acnh/fish/golden-trout.glb"],
  ["fish_arapaima", "/assets/acnh/fish/arapaima.glb"],
];

const BASE = process.env.BASE || "http://localhost:3099";
const browser = await chromium.launch({ args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
for (const [key, model] of SPECIES) {
  await page.goto(`${BASE}/lab/icon?model=${encodeURIComponent(model)}&raw=1`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1800);
  const canvas = page.locator("#icon-stage, canvas").first();
  await canvas.screenshot({ path: `public/assets/acnh/icons/${key}.png`, omitBackground: true });
  console.log("rendered", key);
}
await browser.close();
