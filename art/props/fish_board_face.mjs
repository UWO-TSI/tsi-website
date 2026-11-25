// The fish market board's header face: fish_board_face.html in headless Chromium (never a window, muted) to header.png
// for build_fish_board.py.
//   cd web && node ../art/props/fish_board_face.mjs <out_dir>
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const OUT = process.argv[2];
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(new URL("./fish_board_face.html", import.meta.url).href);
await page.waitForTimeout(500);
await page.locator("#header").screenshot({ path: `${OUT}/header.png` });
await browser.close();
console.log("face in", OUT);
