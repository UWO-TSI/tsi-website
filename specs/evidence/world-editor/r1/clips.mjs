// World editor round 1 (specs/lanes/world-editor.md): /lab/world driven headless through its automation hook
// (window.__worldEditor; there is no pointer lock headless), recorded as webm and shot as png. Muted, desktop only.
// The dev server on PORT with the Supabase env blanked. Run from web/:
//   PORT=3482 node ../specs/evidence/world-editor/r1/clips.mjs <out-dir> [board|place|palette]
// The board scene saves to web/data/world: restore it after (git checkout -- data/world). Nothing here is a layout change.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
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
/** The fish market's catch board, as the editor holds it. */
const board = page => page.evaluate(() => window.__worldEditor.ed.objects.find(o => o.kind === "board" && o.id === "catch"));
const slot = (page, label) => page.evaluate(l => { const W = window.__worldEditor; W.setSlotItem(0, W.palette.flatMap(g => g.items).find(i => i.label === l)); W.selectSlot(1); W.selectSlot(0); }, label);
const press = async (page, key, wait = 500) => { await page.keyboard.press(key); await page.waitForTimeout(wait); };
/** Hold the right button (a drag) while the crosshair walks from `a` to `b` over `ms`, the camera at `from`. */
async function drag(page, from, a, b, ms = 2400) {
  await page.evaluate(() => window.__worldEditor.beginStroke(2, false));
  const steps = Math.round(ms / 60);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    await aim(page, from, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.__worldEditor.endStroke());
}

/**
 * The game (/student/dashboard, no editor in between) with the player beside the board's spot `at` and the camera
 * (its saved angle, lib/game/orbitCamera.ts) out in front of where the board faced before, so before and after match.
 */
async function gameShot(name, at) {
  const fx = Math.sin(at.yaw), fz = Math.cos(at.yaw), stand = [at.x + fx * 2.4 + fz * 1.4, at.z + fz * 2.4 - fx * 1.4];
  const { ctx, page } = await newPage(false);
  await ctx.addInitScript(yaw => { try { localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw, pitch: 0.55, zoom: 1.35 })); } catch {} }, Math.atan2(-fx, -fz));
  await page.goto(`${HOST}/student/dashboard?at=${stand[0].toFixed(1)},${stand[1].toFixed(1)}&time=day`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(45000);
  await shot(page, name);
  await ctx.close();
}

const SCENES = {
  // we1-01: select the catch board by aiming at it, drag it along the deck, turn it, raise it, snap it down, save, walk it.
  board: async () => {
    const before = JSON.parse(readFileSync(new URL("../../../../web/data/world/world.json", import.meta.url), "utf8")).objects.find(o => o.kind === "board" && o.id === "catch");
    await gameShot("we1-01-game-before", before);
    const { ctx, page } = await newPage(true);
    await openEditor(page);
    const b = await board(page);
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), from = [b.x + fx * 6 - fz * 2, 4.2, b.z + fz * 6 + fx * 2];
    await aim(page, from, [b.x, 1.1, b.z]);
    await page.waitForTimeout(2500);
    await shot(page, "we1-01a-board-before");
    await page.evaluate(() => { const W = window.__worldEditor; W.selectSlot(8); W.beginStroke(0, false); W.endStroke(); });
    await shot(page, "we1-01b-board-selected");
    await drag(page, from, [b.x, 1.1, b.z], [b.x - fz * 2.5, 1.1, b.z + fx * 2.5]);
    for (let i = 0; i < 4; i++) await press(page, "r", 350);
    await press(page, "]", 400); await press(page, "]", 400); await press(page, "]", 600);
    await shot(page, "we1-01c-board-moved-raised");
    await press(page, "g", 800);
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => /Saved/.test(window.__worldEditor.ed.status), null, { timeout: 30000 });
    await shot(page, "we1-01d-board-saved");
    const moved = await board(page);
    console.log("board", JSON.stringify(b), "->", JSON.stringify(moved));
    await press(page, "p", 1000);
    await page.waitForSelector("canvas", { timeout: 300000 });
    await page.waitForTimeout(45000);
    await shot(page, "we1-01e-walk-it");
    await keep(ctx, page, "we1-01-board");
    // The game itself, from the saved file (no editor in between), the same view as before the edit.
    await gameShot("we1-01f-game-after-save", b);
  },
  // we1-02: place props from the catalogue (the ghost shows the model at the world's scale), turn the ghost, raise one,
  // snap it to the ground, delete one and undo.
  place: async () => {
    const { ctx, page } = await newPage(true);
    await openEditor(page);
    const b = await board(page), from = [b.x + 7, 4.5, b.z + 9], spot = [b.x + 3.5, 1, b.z + 4];
    await aim(page, from, spot);
    await slot(page, "barrel");
    await page.waitForTimeout(2000);
    await shot(page, "we1-02a-ghost-barrel");
    for (const [dx, dz] of [[0, 0], [0.9, 0.4], [0.3, 1.1]]) {
      await aim(page, from, [spot[0] + dx, spot[1], spot[2] + dz]);
      await page.waitForTimeout(400);
      await press(page, "r", 200);
      await page.evaluate(() => { const W = window.__worldEditor; W.beginStroke(2, false); W.endStroke(); });
      await page.waitForTimeout(500);
    }
    await slot(page, "fish-crate");
    await aim(page, from, [spot[0] - 1.6, spot[1], spot[2] + 0.6]);
    await page.waitForTimeout(800);
    await page.evaluate(() => { const W = window.__worldEditor; W.beginStroke(2, false); W.endStroke(); });
    await shot(page, "we1-02b-placed");
    // Select the crate, raise it onto the barrels' height, snap it back, delete it, undo.
    await page.evaluate(() => { const W = window.__worldEditor; W.selectSlot(8); W.beginStroke(0, false); W.endStroke(); });
    await page.waitForTimeout(500);
    for (let i = 0; i < 3; i++) await press(page, "Alt+BracketRight", 450);
    await shot(page, "we1-02c-raised");
    await press(page, "g", 700);
    await press(page, "x", 900);
    await shot(page, "we1-02d-deleted");
    await press(page, "Control+z", 900);
    await shot(page, "we1-02e-undone");
    await keep(ctx, page, "we1-02-place");
  },
  // we1-03: the palette's scenery catalogue and the market's two boards.
  palette: async () => {
    const { ctx, page } = await newPage(false);
    await openEditor(page);
    await press(page, "e", 800);
    await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find(d => d.textContent === "Scenery props"); el?.scrollIntoView(); });
    await shot(page, "we1-03-palette-catalogue");
    await ctx.close();
  },
};

for (const [name, run] of Object.entries(SCENES)) if (!ONLY.length || ONLY.includes(name)) await run();
await browser.close();
