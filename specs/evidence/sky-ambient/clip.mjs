// Sky-ambient clips (specs/sky-ambient.md): a few seconds of the sky, the weathers, the wind and the lamps on the new
// world (/lab/island), headless and muted, against a dev server on PORT. Needs ffmpeg. A `lapse` clip runs the world
// clock from one time to another across the clip (the whole day in twenty seconds).
//   PORT=3480 CLIPS="day night:phone" [SECONDS=6] node specs/evidence/sky-ambient/clip.mjs <out_dir>
// Per clip: sky2-clip-<name>-<size>.mp4 and a -poster.jpg (a frame a third of the way in).
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "/tmp/sky1-clips"] = process.argv.slice(2), PORT = process.env.PORT ?? 3480, DATE = "2026-07-29";
const MEADOW = "60,22", BEACH = "14,111";
const GROUND = { yaw: (165 * Math.PI) / 180, pitch: 0.45, zoom: 1.2 }, SEA = { yaw: Math.PI, pitch: 0.35, zoom: 1.4 };
// Looking west over the sea toward the summer sunset (compass 290), tipped up to the sky.
const WEST = { yaw: -0.35, pitch: 0.35, zoom: 1.2 };
const PLAZA = "40,52", PLAZA_VIEW = { yaw: -1.57, pitch: 0.42, zoom: 1.25 };
const CLIPS = {
  // The whole day, 05:30 to 23:50, in twenty seconds.
  "day": { spot: BEACH, at: "05:30", lapse: ["05:30", "23:50"], view: WEST, tilt: 14, seconds: 20 },
  // Real time: the clouds drifting at golden hour and sunset; the stars twinkling, a full moon and a new moon.
  "golden": { spot: BEACH, at: "20:00", face: "sun", tilt: 12, view: { pitch: 0.35, zoom: 1.1 }, seconds: 8 },
  "sunset": { spot: BEACH, at: "20:40", face: "sun", tilt: 12, view: { pitch: 0.35, zoom: 1.1 }, seconds: 8 },
  "night": { spot: BEACH, at: "23:30", face: "moon", tilt: 16, view: { pitch: 0.35, zoom: 1 }, seconds: 12 },
  "night-new": { spot: BEACH, at: "23:30", date: "2026-08-12", tilt: 26, view: { yaw: 2.6, pitch: 0.35, zoom: 1 }, seconds: 12 },
  // The weathers moving, sky in frame.
  "rain": { spot: BEACH, at: "12:30", weather: "rain", view: SEA, tilt: 10 },
  "snow": { spot: BEACH, at: "12:30", weather: "snow", view: SEA, tilt: 10, season: "winter" },
  "fog": { spot: BEACH, at: "12:30", weather: "fog", view: SEA, tilt: 10 },
  // A windy day: the swirls over the meadow's trees and the shore.
  "wind": { spot: MEADOW, at: "12:30", weather: "wind", view: GROUND, seconds: 8 },
  "wind-shore": { spot: BEACH, at: "12:30", weather: "wind", view: SEA, seconds: 8 },
  // The plaza's lamps and the fireflies at night: the soft glow, breathing.
  "lamps": { spot: PLAZA, at: "23:30", view: PLAZA_VIEW, tilt: 4, seconds: 8 },
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
  const q = new URLSearchParams({ season: c.season ?? "summer", weather: c.weather ?? "clear", date: c.date ?? DATE });
  q.append("at", c.spot); q.append("at", c.at);
  for (const k of ["wind", "amb"]) if (c[k]) q.set(k, c[k]);
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
  if (c.lapse) {
    // The clock walks from the first time to the second, a step every 100 ms.
    const [h0, m0] = c.lapse[0].split(":").map(Number), [h1, m1] = c.lapse[1].split(":").map(Number), steps = seconds * 10;
    for (let i = 0; i <= steps; i++) {
      const m = Math.round(h0 * 60 + m0 + ((h1 * 60 + m1) - (h0 * 60 + m0)) * i / steps);
      await page.evaluate(([hhmm, date]) => window.__sky.at(hhmm, date), [`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, c.date ?? DATE]);
      await page.waitForTimeout(100);
    }
  } else await page.waitForTimeout(seconds * 1000);
  const length = (Date.now() - born) / 1000 - from;
  await ctx.close();
  const base = `${OUT}/sky2-clip-${name}-${size}`, webm = `${tmp}/${readdirSync(tmp).find(f => f.endsWith(".webm"))}`;
  // The page keeps a 40 px strip above the canvas: cropped out.
  const crop = ["-vf", `crop=${viewport.width}:${viewport.height - 40}:0:40`];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(from), "-t", String(length), "-i", webm, ...crop, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-movflags", "+faststart", "-an", `${base}.mp4`]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(length / 3), "-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "4", `${base}-poster.jpg`]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(base);
}
await browser.close();
