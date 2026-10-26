// Terrain v3 review views (specs/launch/terrain-v3.md): in-game shots of the new world (web/data/world) on /lab/island?fixture=v2,
// headless Chromium (WebGL), muted, signed out, against a dev server on PORT with the Supabase env blanked.
//   PORT=3171 node specs/evidence/terrain-v3/shoot.mjs <out_dir> [view,view,...]
// Each view stands the player at (x, z) with the orbit camera at a heading (yaw: 0 looks toward +z, 90 toward +x), a tilt
// (pitch, radians, 0.35 to 0.82) and a zoom (0.6 to 1.6), in the summer daytime.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

// R2b spots (the jetty's landing at (84.6, 46), its gangways meeting the deck boards at x 74, the plaza at (30, 50)).
export const VIEWS = {
  "01-arrival-wharf": { at: [84.6, 46], yaw: -90, pitch: 0.45, zoom: 1.6 },
  "02-wharf-from-south": { at: [62, 80], yaw: 170, pitch: 0.42, zoom: 1.6 },
  "03-path-down-to-wharf": { at: [44, 54], yaw: 90, pitch: 0.45, zoom: 1.6 },
  "04-plaza": { at: [44, 53], yaw: 250, pitch: 0.42, zoom: 1.6 },
  "06-beach": { at: [-10, 102], yaw: 75, pitch: 0.42, zoom: 1.6 },
  "09-forest-edge": { at: [60, 22], yaw: 165, pitch: 0.38, zoom: 1.6 },
  "10-river-and-meadow": { at: [-34, 60], yaw: -70, pitch: 0.42, zoom: 1.6 },
  "13-market": { at: [64, 46], yaw: 165, pitch: 0.42, zoom: 1.2 },
  "14-dock": { at: [71, 37], yaw: 60, pitch: 0.4, zoom: 1.3 },
  "16-campfire": { at: [14, 95.5], yaw: 0, pitch: 0.5, zoom: 1.2 },
  "17-deck-edge": { at: [72.5, 30], yaw: 160, pitch: 0.4, zoom: 1.0 },
};

const [OUT = "/tmp/terrain-v3", ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3171;
mkdirSync(OUT, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const [name, v] of Object.entries(VIEWS)) {
  if (ONLY && !ONLY.split(",").includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, cam]) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true");
    localStorage.setItem("tsi.camera.v1", cam);
  } catch {} }, [LOOK, JSON.stringify({ yaw: (v.yaw * Math.PI) / 180, pitch: v.pitch, zoom: v.zoom, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false })]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", name, e.message.slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/lab/island?fixture=v2&at=${v.at.join(",")}${v.flat ? "&aerial=1" : ""}&time=day&weather=clear&season=summer`);
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  if (await page.evaluate(() => { const g = window.__governor; if (!g) return false; g.hold = 1e9; g.set(0); return true; })) await page.waitForTimeout(1500);
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name, JSON.stringify(await page.evaluate(() => { const p = window.__move?.sim?.current?.pos ?? window.__move?.sim?.current?.position; return p ? [p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]].map(n => +(+n).toFixed(2)) : null; })));
  await ctx.close();
}
await browser.close();
