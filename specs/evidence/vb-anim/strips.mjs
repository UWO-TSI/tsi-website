// The volleyball clips on the game's renderer: /lab/avatar?sheet=vb, one strip per clip (8 phases and its contact
// frame), headless and muted, against a dev server on PORT with the Supabase env blanked.
//   PORT=3473 node specs/evidence/vb-anim/strips.mjs <out_dir> [clip,clip,...] [view]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "specs/evidence/vb-anim/game", ONLY, VIEW = "34"] = process.argv.slice(2), PORT = process.env.PORT ?? 3473;
const CLIPS = ONLY?.split(",") ?? ["vb_ready", "vb_shuffle", "vb_bump", "vb_set", "vb_spike_jump", "vb_spike_hit", "vb_block", "vb_jump_set",
  "vb_serve_toss", "vb_serve_hit", "vb_serve_stand", "vb_dive", "vb_slide_dive", "vb_celebrate_point", "vb_celebrate_win", "vb_spectate"];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 420 }, deviceScaleFactor: 1 });
for (const id of CLIPS) {
  await page.goto(`http://localhost:${PORT}/lab/avatar?sheet=vb&ids=${id}&framing=body&zoom=0.62&look=0.7&face=512&view=${VIEW}`);
  await page.waitForSelector("[data-sheet=vb] figure");
  await page.waitForTimeout(9000);                       // the character, its hair and vb_clips.glb load, then the poses settle
  await page.addStyleTag({ content: "nav, nextjs-portal { display: none !important; }" }).catch(() => {});
  await (await page.$("[data-sheet=vb]")).screenshot({ path: `${OUT}/${id}-${VIEW}.png` });
  console.log("shot", id);
}
await browser.close();
