// World editor round 2, the eraser (specs/lanes/world-editor.md; built on r1/clips.mjs): /lab/world driven headless through its automation hook
// (window.__worldEditor; there is no pointer lock headless), recorded as webm and shot as png. Muted, desktop only.
// The dev server on PORT with the Supabase env blanked. Run from web/:
//   PORT=3482 node ../specs/evidence/world-editor/r2/clips.mjs <out-dir>
// Nothing here saves: the erased props are undone at the end of the clip.
import { createRequire } from "node:module";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3482, HOST = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const SIZE = { width: 1280, height: 800 };

// A saved look, so the game's character creator doesn't open first (as specs/evidence/polish-interiors/shoot.mjs does).
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
async function newPage(video) {
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, ...(video ? { recordVideo: { dir: join(OUT, "raw"), size: SIZE } } : {}) });
  await ctx.addInitScript(l => { try { localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", "false"); } catch {} }, JSON.stringify(LOOK));
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  return { ctx, page };
}
const shot = async (page, name) => { await page.waitForTimeout(700); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log("shot", name); };
/** Close a recorded page and keep its video as <name>.webm. */
async function keep(ctx, page, name) {
  const v = page.video();
  await ctx.close();
  if (v) renameSync(await v.path(), join(OUT, `${name}.webm`));
  console.log("clip", name);
}
async function openEditor(page) {
  await page.goto(`${HOST}/lab/world`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__worldEditor?.ed.world && document.querySelector("canvas"), null, { timeout: 300000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(() => { const W = window.__worldEditor; W.ed.help = false; W.bump(); });
  await page.waitForTimeout(6000);
}
/** Put the fly camera at `from` looking at `to` (world x, y, z). */
const aim = (page, from, to) => page.evaluate(([f, t]) => {
  const p = window.__worldEditor.pose, dx = t[0] - f[0], dy = t[1] - f[1], dz = t[2] - f[2];
  Object.assign(p, { x: f[0], y: f[1], z: f[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) });
}, [from, to]);
const press = async (page, key, wait = 500) => { await page.keyboard.press(key); await page.waitForTimeout(wait); };


const left = page => page.evaluate(() => window.__worldEditor.ed.objects.filter(o => !o.gone).length);
const hover = page => page.evaluate(() => { const W = window.__worldEditor; return W.ed.hotbar[W.ed.slot].label; });

// we2-erase: the Eraser in the hotbar; a click deletes the prop under the crosshair; a held drag erases all it passes over;
// one Ctrl+Z brings the whole drag back.
const { ctx, page } = await newPage(true);
await openEditor(page);
// The prop cluster on the deck by the tackle shop: barrels, crates, a cart, a net (market-6, -7, -12, -14, -19, -20 in world.json, seen from well above so only what the crosshair is over is in its way).
const from = [62.5, 7, 49.5], over = [66.9, 1.3, 55.0];
await aim(page, from, over);
await page.evaluate(() => { const W = window.__worldEditor; W.selectSlot(6); });
await page.waitForTimeout(2500);
console.log("slot", await hover(page), "objects", await left(page));
await shot(page, "we2-01-eraser-aimed");
await page.evaluate(() => window.__worldEditor.beginStroke(0, false));
await page.evaluate(() => window.__worldEditor.endStroke());
await shot(page, "we2-02-clicked-gone");
console.log("after click", await left(page));
// A held drag across the rest of the cluster.
await page.evaluate(() => window.__worldEditor.beginStroke(0, false));
const path = [[66.9, 1.3, 55.0], [68.2, 1.3, 54.5], [66.8, 1.3, 56.9], [69.3, 1.3, 59.5], [71.1, 1.3, 58.3], [71.75, 1.3, 57.7]];
for (let i = 0; i < path.length - 1; i++) for (let k = 0; k <= 12; k++) {
  const t = k / 12;
  await aim(page, from, path[i].map((v, j) => v + (path[i + 1][j] - v) * t));
  await page.waitForTimeout(60);
}
await page.evaluate(() => window.__worldEditor.endStroke());
await shot(page, "we2-03-dragged-gone");
console.log("after drag", await left(page));
await press(page, "Control+z", 1200);
await shot(page, "we2-04-undone");
console.log("after undo", await left(page));
await keep(ctx, page, "we2-erase");
await browser.close();
