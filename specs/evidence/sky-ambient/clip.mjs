// Sky-ambient round 1 clips (specs/sky-ambient.md): a few seconds of the wind, each weather and the ambient pitches on
// the new world (/lab/island), headless and muted, against a dev server on PORT. Needs ffmpeg.
//   PORT=3480 CLIPS="wind-calm wind-storm" [SECONDS=6] node specs/evidence/sky-ambient/clip.mjs <out_dir>
// Per clip: sky1-clip-<name>-<size>.mp4 and a -poster.jpg (its first frame).
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "/tmp/sky1-clips"] = process.argv.slice(2), PORT = process.env.PORT ?? 3480, DATE = "2026-07-29";
const MEADOW = "60,22", BEACH = "14,111";
const GROUND = { yaw: (165 * Math.PI) / 180, pitch: 0.45, zoom: 1.2 }, SEA = { yaw: Math.PI, pitch: 0.35, zoom: 1.4 };
const CLIPS = {
  // The wind: today's clear day and windy day, then the shared wind calm, breezy and stormy, on the meadow at noon.
  "wind-today": { spot: MEADOW, at: "12:30", view: GROUND },
  "wind-today-windy": { spot: MEADOW, at: "12:30", weather: "wind", view: GROUND },
  "wind-calm": { spot: MEADOW, at: "12:30", wind: "calm", view: GROUND },
  "wind-breeze": { spot: MEADOW, at: "12:30", wind: "breeze", amb: "swirls", view: GROUND },
  "wind-storm": { spot: MEADOW, at: "12:30", weather: "wind", wind: "storm", amb: "swirls", view: GROUND },
  // Today's weathers moving, sky in frame.
  "rain": { spot: BEACH, at: "12:30", weather: "rain", view: SEA, tilt: 8 },
  "snow": { spot: BEACH, at: "12:30", weather: "snow", view: SEA, tilt: 8, season: "winter" },
  "fog": { spot: BEACH, at: "12:30", weather: "fog", view: SEA, tilt: 8 },
  "windy": { spot: BEACH, at: "12:30", weather: "wind", view: SEA, tilt: 8 },
  // The ambient pitches: motes toward the low sun, and the night skies (twinkle, the moon, the odd shooting star).
  "motes": { spot: MEADOW, at: "20:00", sky: "A", amb: "motes", face: "sun", view: { pitch: 0.42, zoom: 1.2 } },
  "motes-noon": { spot: MEADOW, at: "12:30", amb: "motes", view: GROUND },
  "night-today": { spot: BEACH, at: "23:30", face: "moon", tilt: 24, view: { pitch: 0.35, zoom: 1 }, seconds: 8 },
  "night-A": { spot: BEACH, at: "23:30", sky: "A", face: "moon", tilt: 24, view: { pitch: 0.35, zoom: 1 }, seconds: 12 },
  "night-B": { spot: BEACH, at: "23:30", sky: "B", face: "moon", tilt: 24, view: { pitch: 0.35, zoom: 1 }, seconds: 12 },
  "night-C": { spot: BEACH, at: "23:30", sky: "C", face: "moon", tilt: 24, view: { pitch: 0.35, zoom: 1 }, seconds: 12 },
  "sunset-C": { spot: BEACH, at: "20:40", sky: "C", face: "sun", tilt: 14, view: { pitch: 0.35, zoom: 1 } },
};
const SIZES = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const item of (process.env.CLIPS ?? Object.keys(CLIPS).join(" ")).split(" ")) {
  const [name, size = "desktop"] = item.split(":"), c = CLIPS[name], phone = size === "phone", viewport = SIZES[size];
  const seconds = Number(process.env.SECONDS ?? c.seconds ?? 6), tmp = `${OUT}/.rec-${name}-${size}`;
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, recordVideo: { dir: tmp, size: viewport } });
  await ctx.addInitScript(([look]) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.35, zoom: 1.4, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch {} }, [LOOK]);
  const page = await ctx.newPage(), born = Date.now();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  const q = new URLSearchParams({ season: c.season ?? "summer", weather: c.weather ?? "clear", date: DATE });
  q.append("at", c.spot); q.append("at", c.at);
  for (const k of ["sky", "wind", "amb"]) if (c[k]) q.set(k, c[k]);
  await page.goto(`http://localhost:${PORT}/lab/island?${q}`, { timeout: 300000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current && !!window.__sky, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.evaluate(([face, tilt]) => window.__sky.set({ face: face ?? null, tilt: tilt ?? 0 }), [c.face, c.tilt]);
  await page.waitForTimeout(300);
  if (c.view) await page.evaluate(v => window.__sky.view(v), c.view);
  await page.waitForTimeout(1500);
  const from = (Date.now() - born) / 1000;
  await page.waitForTimeout(seconds * 1000);
  await ctx.close();
  const base = `${OUT}/sky1-clip-${name}-${size}`, webm = `${tmp}/${readdirSync(tmp).find(f => f.endsWith(".webm"))}`;
  // The page keeps a 40 px strip above the canvas: cropped out.
  const crop = ["-vf", `crop=${viewport.width}:${viewport.height - 40}:0:40`];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(from), "-t", String(seconds), "-i", webm, ...crop, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-movflags", "+faststart", "-an", `${base}.mp4`]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "4", `${base}-poster.jpg`]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(base);
}
await browser.close();
