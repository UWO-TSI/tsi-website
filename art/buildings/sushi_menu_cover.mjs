// The counter menu's cover (tasting-book round 5, David: "make the menu on the table actually our menu"): the game's own
// menu cover (SushiSheets MenuCover in the kit's FoldedMenu), shot headless from the showroom on a dev server, for
// build_sushi_menu.py to print on the model. Rerun both when the cover changes.
//   node art/buildings/sushi_menu_cover.mjs [http://localhost:3476]   (headless Chromium, muted; never a window)
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const HOST = process.argv[2] ?? "http://localhost:3476";
const OUT = new URL("./sushi-menu-cover.png", import.meta.url).pathname;
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
await page.goto(`${HOST}/lab/gui?only=flat-pieces`, { waitUntil: "domcontentloaded" });
const cover = page.locator('[aria-roledescription="folded menu"] [data-side="right"]').first();
await cover.waitFor({ timeout: 300000 });
await page.waitForTimeout(3000);
await cover.screenshot({ path: OUT, animations: "disabled" });
console.log("cover", OUT, await cover.boundingBox());
await browser.close();
