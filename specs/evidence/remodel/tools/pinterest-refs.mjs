// Remodel references (David, 2026-10-27: "use pinterest for reference photos"; this lane only). Headless Chromium,
// muted, no sign-in: Pinterest's public search page per query, the first pins' i.pinimg.com images saved OUTSIDE the repo
// (the pictures are other people's; the repo keeps URLs and notes only, specs/references/remodel-2026-10-27/README.md).
//   node specs/evidence/remodel/tools/pinterest-refs.mjs <out-dir> <per-query> "<slug>=<query>" ...
// Writes <out-dir>/<slug>/<n>.jpg and <out-dir>/manifest.json ({ slug: [{ file, img, pin, alt }] }).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, per, ...queries] = process.argv.slice(2);
const N = Number(per ?? 6);
mkdirSync(outDir, { recursive: true });
const manifestFile = join(outDir, "manifest.json");
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};

const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, locale: "en-US",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" });
const page = await ctx.newPage();
for (const q of queries) {
  const [slug, query] = q.split("=");
  try {
    await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('img[src*="i.pinimg.com"]', { timeout: 30000 });
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(2500);
    // Signed out, the grid's images carry no pin links: keep each image's own link when it has one, else the search page.
    const pins = await page.evaluate(() => [...document.querySelectorAll('img[src*="i.pinimg.com"]')].map(img => {
      const a = img.closest("a[href]");
      return { pin: a ? new URL(a.getAttribute("href"), location.origin).href.split("?")[0] : location.href, img: img.src, alt: img.alt ?? "" };
    }));
    const seen = new Set(), got = [];
    mkdirSync(join(outDir, slug), { recursive: true });
    for (const p of pins) {
      if (seen.has(p.img) || got.length >= N) continue;
      seen.add(p.img);
      const img = p.img.replace(/\/\d+x\//, "/474x/");
      const res = await ctx.request.get(img);
      if (!res.ok()) continue;
      const file = join(outDir, slug, `${got.length + 1}.jpg`);
      writeFileSync(file, await res.body());
      got.push({ file, img, pin: p.pin, alt: p.alt.slice(0, 160) });
    }
    manifest[slug] = { query, pins: got };
    console.log(slug, got.length);
  } catch (e) {
    manifest[slug] = { query, error: String(e).slice(0, 200) };
    console.log(slug, "FAILED", String(e).slice(0, 120));
  }
}
await browser.close();
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
