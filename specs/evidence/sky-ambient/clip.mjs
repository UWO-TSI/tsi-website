// Sky-ambient clips (specs/sky-ambient.md): a few seconds of the sky, the weathers, the wind and the lamps on the new
// world (/lab/island), headless and muted, against a dev server on PORT. Needs ffmpeg.
//   PORT=3480 CLIPS="day night:phone" [Q="amb=motes"] [TAG=sky4] [SECONDS=6] node specs/evidence/sky-ambient/clip.mjs <out_dir>
// Per clip: <TAG>-clip-<name>-<size>.mp4 and a -poster.jpg (the frame a third of the way in).
//
// Round 3: frame by frame, so every clip plays at a steady 30 fps whatever the headless browser manages (round 2
// recorded the screen as it went, and a busy machine made the clips stutter). Once the scene has settled the page's
// clock is taken over (performance.now, Date, requestAnimationFrame): each frame the clock moves on exactly 1/30 s,
// the game draws one frame, and that frame is captured. The game sees an even 30 fps; nothing else changes.
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "/tmp/sky3-clips"] = process.argv.slice(2), PORT = process.env.PORT ?? 3480, DATE = "2026-07-29", FPS = 30;
const TAG = process.env.TAG ?? "sky4", Q = process.env.Q ?? "";
const MEADOW = "60,22", BEACH = "14,111";
// Across the meadow, side on to the wind (it blows toward +x, a little +z: worldFx WIND_DIR), so its fronts cross the view.
const GROUND = { yaw: 0, pitch: 0.42, zoom: 1.25 }, SEA = { yaw: Math.PI, pitch: 0.35, zoom: 1.4 };
// Looking west over the sea toward the summer sunset (compass 290), tipped up to the sky.
const WEST = { yaw: -0.35, pitch: 0.35, zoom: 1.2 };
const PLAZA = "40,52", PLAZA_VIEW = { yaw: -1.57, pitch: 0.42, zoom: 1.25 };
const CLIPS = {
  // The whole day, 05:30 to 23:50, in twenty seconds.
  "day": { spot: BEACH, at: "05:30", lapse: ["05:30", "23:50"], view: WEST, tilt: 14, seconds: 20 },
  // The clouds' lives sped up (about 50 times: twenty minutes in 24 s, the wind at its own pace): clouds gathering out of
  // scraps, holding, and breaking apart into tatters that thin away. Midday away from the sun, the sunset toward it, the night.
  "life-day": { spot: BEACH, at: "12:20", lapse: ["12:20", "12:40"], tilt: 22, view: { yaw: 1.2, pitch: 0.35, zoom: 1.1 }, seconds: 24 },
  "life-sunset": { spot: BEACH, at: "20:22", lapse: ["20:22", "20:40"], face: "sun", tilt: 12, view: { pitch: 0.35, zoom: 1.1 }, seconds: 24 },
  "life-night": { spot: BEACH, at: "23:10", lapse: ["23:10", "23:30"], face: "moon", tilt: 16, view: { pitch: 0.35, zoom: 1 }, seconds: 24 },
  // Real time: midday's clouds across the sky away from the sun, the clouds drifting at golden hour and sunset.
  "midday": { spot: BEACH, at: "12:30", tilt: 22, view: { yaw: 1.2, pitch: 0.35, zoom: 1.1 }, seconds: 8 },
  "golden": { spot: BEACH, at: "20:00", face: "sun", tilt: 12, view: { pitch: 0.35, zoom: 1.1 }, seconds: 8 },
  "sunset": { spot: BEACH, at: "20:40", face: "sun", tilt: 12, view: { pitch: 0.35, zoom: 1.1 }, seconds: 8 },
  "night": { spot: BEACH, at: "23:30", face: "moon", tilt: 16, view: { pitch: 0.35, zoom: 1 }, seconds: 10 },
  "night-new": { spot: BEACH, at: "23:30", date: "2026-08-12", tilt: 26, view: { yaw: 2.6, pitch: 0.35, zoom: 1 }, seconds: 10 },
  // The night sky as the camera turns: the stars and the Milky Way should turn as one sky.
  "night-turn": { spot: BEACH, at: "23:30", date: "2026-08-12", tilt: 20, view: { yaw: 1.6, pitch: 0.35, zoom: 1 }, turn: [1.6, 3.4], seconds: 8 },
  // The weathers moving, sky in frame.
  "rain": { spot: BEACH, at: "12:30", weather: "rain", view: SEA, tilt: 10 },
  "snow": { spot: BEACH, at: "12:30", weather: "snow", view: SEA, tilt: 10, season: "winter" },
  "fog": { spot: BEACH, at: "12:30", weather: "fog", view: SEA, tilt: 10 },
  // A windy day: the wind's effects over the meadow, the shore and the sea.
  "wind": { spot: MEADOW, at: "12:30", weather: "wind", view: GROUND, seconds: 10 },
  "wind-shore": { spot: BEACH, at: "12:30", weather: "wind", view: SEA, seconds: 10 },
  "breeze": { spot: MEADOW, at: "12:30", view: GROUND, seconds: 10 },
  // Golden hour's motes, over the sea toward the low sun (round 4: over the water, none over the grass).
  "motes": { spot: BEACH, at: "20:05", face: "sun", tilt: 2, view: { pitch: 0.4, zoom: 1.1 }, seconds: 8 },
  // The plaza's lamps and the fireflies at night: the soft glow, breathing.
  "lamps": { spot: PLAZA, at: "23:30", view: PLAZA_VIEW, tilt: 4, seconds: 8 },
  // The lamps' glow against the night sky, clouds going by behind it (their lives sped up 60 times): the glow shaped by
  // the glass, never covered by a cloud.
  "glow": { spot: PLAZA, at: "23:15", lapse: ["23:15", "23:27"], view: { yaw: -1.57, pitch: 0.36, zoom: 1.1 }, tilt: 14, seconds: 12 },
};
const SIZES = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });

/** The page's clock, held until `__clip.start()`, then moved only by `__clip.step(ms)` (one drawn frame each). */
function virtualClock() {
  const realPerf = performance.now.bind(performance), RealDate = Date, realRaf = window.requestAnimationFrame.bind(window);
  let on = false, now = 0, wall = 0, queue = [], id = 1;
  performance.now = () => (on ? now : realPerf());
  class ClipDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(on ? wall + now : RealDate.now()); }
    static now() { return on ? wall + now : RealDate.now(); }
  }
  window.Date = ClipDate;
  window.requestAnimationFrame = cb => { if (!on) return realRaf(cb); queue.push(cb); return id++; };
  window.__clip = {
    start() { now = realPerf(); wall = RealDate.now() - now; on = true; },
    step(ms) { now += ms; const q = queue; queue = []; for (const cb of q) { try { cb(now); } catch (e) { console.error(e); } } return q.length; },
  };
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const item of (process.env.CLIPS ?? Object.keys(CLIPS).join(" ")).split(" ")) {
  const [name, size = "desktop"] = item.split(":"), c = CLIPS[name], phone = size === "phone", viewport = SIZES[size];
  const seconds = Number(process.env.SECONDS ?? c.seconds ?? 6), frames = Math.round(seconds * FPS);
  const base = `${OUT}/${TAG}-clip-${name}-${size}`, tmp = `${base}.frames`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([look]) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.35, zoom: 1.4, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch {} }, [LOOK]);
  await ctx.addInitScript(virtualClock);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  const q = new URLSearchParams({ season: c.season ?? "summer", weather: c.weather ?? "clear", date: c.date ?? DATE });
  q.append("at", c.spot); q.append("at", c.at);
  for (const k of ["wind", "amb"]) if (c[k]) q.set(k, c[k]);
  for (const [k, v] of new URLSearchParams(Q)) q.set(k, v);
  await page.goto(`http://localhost:${PORT}/lab/island?${q}`, { timeout: 300000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current && !!window.__sky, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal, header:has(> h1) { display: none !important; }" }).catch(() => {});
  await page.evaluate(([face, tilt]) => window.__sky.set({ face: face ?? null, tilt: tilt ?? 0 }), [c.face, c.tilt]);
  await page.waitForTimeout(300);
  if (c.view) await page.evaluate(v => window.__sky.view(v), c.view);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__clip.start());
  // A few frames for the camera and the eases to settle on the stepped clock before the first captured one.
  for (let i = 0; i < 10; i++) await page.evaluate(ms => window.__clip.step(ms), 1000 / FPS);
  const lapse = c.lapse && c.lapse.map(s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; });
  const { width, height } = viewport;
  for (let f = 0; f < frames; f++) {
    const k = f / Math.max(1, frames - 1);
    if (lapse) {
      // To the second (a lapse of a few minutes, the clouds' lives, moves smoothly).
      const at = lapse[0] + (lapse[1] - lapse[0]) * k, m = Math.floor(at);
      await page.evaluate(([hhmm, date, plus]) => window.__sky.at(hhmm, date, plus), [`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, c.date ?? DATE, (at - m) * 60000]);
    }
    if (c.turn) await page.evaluate(yaw => window.__sky.view({ yaw }), c.turn[0] + (c.turn[1] - c.turn[0]) * k);
    await page.evaluate(ms => window.__clip.step(ms), 1000 / FPS);
    // The page keeps a 40 px strip above the canvas: left out.
    await page.screenshot({ path: `${tmp}/${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 90, clip: { x: 0, y: 40, width, height: height - 40 } });
  }
  await ctx.close();
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${tmp}/%04d.jpg`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", "-an", `${base}.mp4`]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(seconds / 3), "-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "4", `${base}-poster.jpg`]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(base);
}
await browser.close();
