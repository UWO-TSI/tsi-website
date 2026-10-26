// Sushi bar review views (game/sushi-bar; terrain-v3/shoot.mjs with the bar's views and a sit): in-game shots of the new world (web/data/world) on /lab/island?fixture=v2,
// headless Chromium (WebGL), muted, signed out, against a dev server on PORT with the Supabase env blanked.
//   PORT=3175 node specs/evidence/sushi-bar/shoot.mjs <out_dir> [view,view,...]
// Each view stands the player at (x, z) with the orbit camera at a heading (yaw: 0 looks toward +z, 90 toward +x), a tilt
// (pitch, radians, 0.35 to 0.82) and a zoom (0.6 to 1.6), in the summer daytime.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

// R2c spots (the jetty: its middle finger's tip at (93.1, 46), its platform at x 78.6, the gangways meeting the deck
// boards at x 74.2; the path from (65.5, 56) winding up to the plaza at (30, 50)).
// The sushi bar at (44, 96.5), yaw -3pi/4 (terrain-v3's placement): its guests' side toward (-x, -z), its window onto the sea
// toward (+x, +z). `sit` stands you by a stool and presses E (Sit at the counter), then waits for the seated view.
export const VIEWS = {
  "bar-front": { at: [39.4, 92.6], yaw: 45, pitch: 0.42, zoom: 1.3 },
  "bar-front-night": { at: [39.4, 92.6], yaw: 45, pitch: 0.42, zoom: 1.3, time: "night" },
  "bar-seat": { at: [42.4, 94.8], yaw: 45, pitch: 0.42, zoom: 1.0, sit: true },
  "bar-seat-night": { at: [42.4, 94.8], yaw: 45, pitch: 0.42, zoom: 1.0, sit: true, time: "night" },
  "bar-sea": { at: [49.5, 101.5], yaw: 225, pitch: 0.4, zoom: 1.3 },
  "bar-chefs": { at: [40.6, 95.2], yaw: 45, pitch: 0.3, zoom: 0.8 },
};

const [OUT = "specs/evidence/sushi-bar", ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3175;
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
  await page.goto(`http://localhost:${PORT}/lab/island?fixture=v2&at=${v.at.join(",")}${v.flat ? "&aerial=1" : ""}&time=${v.time ?? "day"}&weather=clear&season=summer`);
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  if (await page.evaluate(() => { const g = window.__governor; if (!g) return false; g.hold = 1e9; g.set(0); return true; })) await page.waitForTimeout(1500);
  if (v.sit) { await page.keyboard.press("e"); await page.waitForTimeout(3000); }
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name, JSON.stringify(await page.evaluate(() => { const p = window.__move?.sim?.current?.pos ?? window.__move?.sim?.current?.position; return p ? [p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]].map(n => +(+n).toFixed(2)) : null; })));
  await ctx.close();
}
await browser.close();
