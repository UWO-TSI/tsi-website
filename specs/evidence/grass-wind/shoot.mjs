// game/grass-wind evidence: the new world's grass (web/data/world on /lab/island?fixture=v2) at the same spots before
// and after, day and evening, a Lite view, and a gust rolling through the meadow as a frame strip. Headless Chromium
// (WebGL), muted, signed out, against a dev server on PORT with the Supabase env blanked; the browser lock held.
//   PORT=3184 node specs/evidence/grass-wind/shoot.mjs <out_dir> <label> [view,view,...]
// Writes <out_dir>/<label>-<view>.png; the gust as <label>-gust-strip.png (6 frames, 0.4 s apart, 3 x 2) and
// <label>-gust-close.png (the same frames, a close crop side by side).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

// The spots (terrain-v3's: the meadow by the river at (-34, 60), the plaza at (30, 50)). yaw in degrees, 0 toward +z.
const VIEWS = {
  "meadow-day": { at: [-34, 60], yaw: -70, pitch: 0.42, zoom: 1.0 },
  "meadow-evening": { at: [-34, 60], yaw: -70, pitch: 0.42, zoom: 1.0, time: "evening" },
  "plaza-edge-day": { at: [44, 53], yaw: 250, pitch: 0.42, zoom: 1.0 },
  "plaza-edge-evening": { at: [44, 53], yaw: 250, pitch: 0.42, zoom: 1.0, time: "evening" },
  "riverbank-day": { at: [-40, 58], yaw: -110, pitch: 0.5, zoom: 0.8 },
  "riverbank-evening": { at: [-40, 58], yaw: -110, pitch: 0.5, zoom: 0.8, time: "evening" },
  "close-day": { at: [-34, 60], yaw: -70, pitch: 0.3, zoom: 0.6 },
  "lite-meadow-day": { at: [-34, 60], yaw: -70, pitch: 0.42, zoom: 1.0, lite: true },
  "gust": { at: [-34, 60], yaw: -70, pitch: 0.38, zoom: 1.2, frames: 6, every: 400 },
};

const [OUT, LABEL, ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3184;
mkdirSync(OUT, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const [name, v] of Object.entries(VIEWS)) {
  if (ONLY && !ONLY.split(",").includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, cam, lite]) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", lite ? "true" : "false"); localStorage.setItem("tsi.shadows.v1", "true");
    localStorage.setItem("tsi.camera.v1", cam);
  } catch {} }, [LOOK, JSON.stringify({ yaw: (v.yaw * Math.PI) / 180, pitch: v.pitch, zoom: v.zoom, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }), !!v.lite]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", name, e.message.slice(0, 200)));
  page.on("console", m => { if (m.type() === "error" && /shader|glsl|program/i.test(m.text())) console.log("console", name, m.text().slice(0, 600)); });
  await page.goto(`http://localhost:${PORT}/lab/island?fixture=v2&at=${v.at.join(",")}&time=${v.time ?? "day"}&weather=clear&season=summer`);
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  if (await page.evaluate(() => { const g = window.__governor; if (!g) return false; g.hold = 1e9; g.set(0); return true; })) await page.waitForTimeout(1500);
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  if (v.frames) await page.waitForTimeout(4000);
  if (!v.frames) {
    await page.screenshot({ path: `${OUT}/${LABEL}-${name}.png` });
    console.log("shot", name);
  } else {
    const files = [];
    const t0 = Date.now();
    for (let i = 0; i < v.frames; i++) {
      const wait = t0 + i * v.every - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      const f = `${OUT}/${LABEL}-${name}-f${i + 1}.png`;
      await page.screenshot({ path: f });
      files.push(f);
    }
    execFileSync("magick", ["(", files[0], files[1], files[2], "+append", ")", "(", files[3], files[4], files[5], "+append", ")", "-append", "-resize", "40%", `${OUT}/${LABEL}-${name}-strip.png`]);
    execFileSync("magick", [...files.flatMap(f => ["(", f, "-crop", "640x260+0+520", "+repage", ")"]), "+append", `${OUT}/${LABEL}-${name}-close.png`]);
    if (!process.env.KEEP) for (const f of files) rmSync(f);
    console.log("strip", name);
  }
  await ctx.close();
}
await browser.close();
