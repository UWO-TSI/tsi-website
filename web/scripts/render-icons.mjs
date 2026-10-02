// The item icons (row 281, specs/game-ui.md §4): every key in lib/icons/manifest.ts, rendered by /lab/icons (one
// three.js stage: matte, one light rig, a fixed angle per kind, transparent) into public/assets/icons/<key>.webp.
// Needs the dev server (Supabase env blanked) and a headed Chromium for WebGL; muted.
//   BASE=http://localhost:3127 node scripts/render-icons.mjs [key ...]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB, "public/assets/icons");
const BASE = process.env.BASE ?? "http://localhost:3127";
const only = process.argv.slice(2);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--window-position=2400,0"] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.goto(`${BASE}/lab/icons`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__icons, null, { timeout: 240000 });
const keys = only.length ? only : await page.evaluate(() => window.__icons.keys);
let ok = 0;
const failed = [];
for (const key of keys) {
  try {
    const url = await page.evaluate(k => window.__icons.render(k), key);
    if (!url.startsWith("data:image/webp")) throw new Error("the browser didn't encode WebP");
    writeFileSync(join(OUT, `${key}.webp`), Buffer.from(url.split(",")[1], "base64"));
    ok++;
  } catch (e) {
    failed.push(key);
    console.log("FAILED", key, String(e).split("\n")[0].slice(0, 200));
  }
}
console.log(`icons: ${ok} written, ${failed.length} failed${failed.length ? ": " + failed.join(", ") : ""}`);
await browser.close();
process.exit(failed.length ? 1 : 0);
