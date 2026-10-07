// Close-up and far screenshots for the before/after comparison (specs/perf/2026-10-results.md): the same views on
// whichever build is serving PORT, written as <dir>/<label>-<view>.png.
//   PORT=3149 node specs/perf/shots.mjs <dir> <label> [views]
// Views: near (eight standing characters round you), far (the same crowd with the camera pulled back to 3x, past the
// LOD lines), ruins (the pack before a cast), lod (development only: ?charlod=1, every character's LOD 1 up close).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [DIR = "/tmp/shots", LABEL = "after", VIEWS = "near,far,ruins"] = process.argv.slice(2), PORT = process.env.PORT ?? 3149;
mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const BASE = "time=day&weather=clear&season=summer";
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const URLS = {
  near: `/lab/island?${BASE}&crowd=8`,
  far: `/lab/island?${BASE}&crowd=8&zoom=3`,
  lod: `/lab/island?${BASE}&crowd=8&charlod=1`,
  ruins: `/lab/island?${BASE}&ruins=1&combat=demo&classes=v2&subclass=summoner&mastery=20`,
};
for (const view of VIEWS.split(",")) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(look => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.hud.full.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch {} }, LOOK);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}${URLS[view]}`);
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 240000 });
  await page.waitForTimeout(9000);
  if (await page.locator("text=Make your character").count()) throw new Error("the creator is showing, not the world");
  // A development server is slow to settle: adaptive quality may have stepped down meanwhile. Shots are of the settings as chosen.
  if (await page.evaluate(() => { const g = window.__governor; if (!g) return false; g.hold = 1e9; g.set(0); return true; })) await page.waitForTimeout(1500);
  if (view === "ruins") {
    await page.evaluate(() => {
      const rt = window.__combat.rt;
      window.__combatDev.reset();
      rt.enemies = rt.enemies.filter(e => e.type.kind === "boss");
      window.__move.teleport(2, -16, 0);
      const pack = [["shadow-fox", 5], ["thorn-crab", 3], ["mushroom-beast", 3], ["rune-wisp", 3], ["pollen-sprite", 3]];
      let k = 0;
      for (const [type, n] of pack) for (let i = 0; i < n; i++, k++) window.__combatDev.spawn(type, 2 + Math.cos(k) * 3, -11 + Math.sin(k) * 2.5, `shot-${k}`);
      window.__combat.freeze = true;
    });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${DIR}/${LABEL}-${view}.png` });
  console.log("wrote", `${DIR}/${LABEL}-${view}.png`);
  await ctx.close();
}
await browser.close();
