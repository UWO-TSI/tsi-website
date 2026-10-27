#!/usr/bin/env node
/**
 * In-game fit shots (clothing-v2): the avatar bench's ?sheet=fit, one garment at a time (the runtime Character, its
 * body cut and design paint), in a run, a jump and a sit, front, side and back. Headless Chromium, muted.
 *
 *   PORT=3181 node web/scripts/fit-shots.mjs <out_dir> [cut=0] [ids ...]     (a dev server on PORT, Supabase env blanked)
 *
 * Writes <out_dir>/<id>.png (one row of nine cells per garment); cut=0 draws the skin the garments cut too.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [out, ...rest] = process.argv.slice(2);
const cut = rest.includes("cut=0") ? "&cut=0" : "";
const ids = rest.filter(a => a !== "cut=0");
const STARTER = ["top_tee", "top_hoodie", "top_stripe_ls", "bottom_shorts", "bottom_trousers", "bottom_joggers", "shoes_slipon", "shoes_sneakers"];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1800, height: 300 }, deviceScaleFactor: 1 });
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
for (const id of ids.length ? ids : STARTER) {
  await page.goto(`http://localhost:${process.env.PORT ?? 3181}/lab/avatar?sheet=fit&framing=body&zoom=1.25&look=0.45&ids=${id}${cut}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(out, `${id}.png`), fullPage: true });
  console.log("SHOT", id);
}
await browser.close();
