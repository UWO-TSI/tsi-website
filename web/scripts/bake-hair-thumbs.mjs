#!/usr/bin/env node
/**
 * Bake the creator's hair tiles (head-v10, row 311): /lab/hairthumbs draws every whole hairstyle with the creator's own
 * thumbnail baker in its own colours; this writes them to public/assets/characters/v6/hair/thumbs/<id>.webp. Headless
 * Chromium, muted. Re-run after a hairstyle changes (art/characters/hair/import_hair.py).
 *
 *   PORT=3180 node web/scripts/bake-hair-thumbs.mjs        (a dev server on PORT with the Supabase env blanked)
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(web, "public/assets/characters/v6/hair/thumbs");
// Wardrobe batch 2: a hairstyle David priced is a shop row whose icon (lib/icons/keys.ts iconKey) is its creator tile.
const prices = JSON.parse(readFileSync(join(web, "data/characters/batch2-pricing.json"), "utf8")).items;
const sold = new Set(JSON.parse(readFileSync(join(web, "data/characters/character_catalog.json"), "utf8")).hair
  .filter(p => p.full && p.key && !["free", "skip"].includes(prices[p.key]?.mode)).map(p => p.id));   // round 2: #22's hat is an accessory icon; batch 3: unpriced ones too, ready for David's prices
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.goto(`http://localhost:${process.env.PORT ?? 3180}/lab/hairthumbs`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__hairThumbs, null, { timeout: 300000, polling: 500 });
const thumbs = await page.evaluate(() => window.__hairThumbs);
for (const [id, url] of Object.entries(thumbs)) {
  if (!url.startsWith("data:image/webp")) throw new Error(`${id}: the browser didn't encode WebP`);
  writeFileSync(join(out, `${id}.webp`), Buffer.from(url.split(",")[1], "base64"));
  if (sold.has(id)) writeFileSync(join(web, "public/assets/icons", `${id}.webp`), Buffer.from(url.split(",")[1], "base64"));
}
console.log(`baked ${Object.keys(thumbs).length} hair thumbnails into ${out} (${sold.size} also the shop icons of the sold hairstyles)`);
await browser.close();
