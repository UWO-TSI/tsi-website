// Sky-ambient stills (specs/sky-ambient.md): the new world on /lab/island, headless Chromium (WebGL), muted, signed
// out, against a dev server on PORT (Supabase blanked). One page load per weather and size; the clock and the view
// change at run time through window.__sky (components/game/SkyLab.tsx).
//   PORT=3480 PLAN=test|day|weather|phone|moon|lamps node specs/evidence/sky-ambient/shoot.mjs <out_dir>
// Names: sky2-<plan>-<size>-<weather>-<time>-<view>.jpg (moon: the night's date in place of the time).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "/tmp/sky1"] = process.argv.slice(2), PORT = process.env.PORT ?? 3480, PLAN = process.env.PLAN ?? "test";
const ZOOM = Number(process.env.ZOOM ?? 1), DATE = "2026-07-29", SPOT = process.env.SPOT ?? "14,111";
// High summer in London, Ontario, on a full moon: sunrise ~06:15, sunset ~20:45 (EDT).
const TIMES = { dawn: "06:05", midday: "12:30", golden: "20:00", sunset: "20:40", dusk: "21:10", night: "23:30" };
// "sky": toward the sun by day (the moon at night), tilted up; "island": back over the island at the lowest orbit tilt.
const VIEWS = {
  sky: t => ({ face: t === "night" ? "moon" : "sun", tilt: t === "night" ? 30 : 16, view: { pitch: 0.35, zoom: ZOOM } }),
  island: () => ({ face: null, tilt: 8, view: { yaw: Math.PI, pitch: 0.35, zoom: ZOOM } }),
  // What a player sees at the orbit's lowest tilt, looking back over the island.
  play: () => ({ face: null, tilt: 0, view: { yaw: Math.PI, pitch: 0.35, zoom: 1.4 } }),
  game: () => ({ face: null, tilt: 0, view: { yaw: Math.PI, pitch: Math.atan2(7.4, 10.8), zoom: 1 } }),
  lamps: () => ({ face: null, tilt: 4, view: { yaw: Number(process.env.LAMP_YAW ?? 2.4), pitch: 0.42, zoom: 1.25 } }),
};
// The moon through its month (2026, a full moon on 07-29 and a new moon on 08-12), each at an hour it is up.
const MOONS = { crescent: ["21:50", "2026-07-17"], quarter: ["22:00", "2026-07-21"], gibbous: ["23:30", "2026-07-25"], full: ["01:30", "2026-07-30"],
  waning: ["01:30", "2026-08-04"], new: ["23:30", "2026-08-12"] };
const PLANS = {
  test: [{ size: "desktop", weather: "clear", times: ["midday", "golden", "sunset", "night"], views: ["sky"] }],
  day: [{ size: "desktop", weather: "clear", times: Object.keys(TIMES), views: ["sky", "island", "play"] }],
  weather: ["rain", "snow", "fog", "wind"].map(weather => ({ size: "desktop", weather, times: ["midday", "sunset", "night"], views: ["sky", "play"] })),
  phone: [{ size: "phone", weather: "clear", times: Object.keys(TIMES), views: ["sky", "play"] }],
  phoneweather: ["rain", "wind"].map(weather => ({ size: "phone", weather, times: ["midday"], views: ["sky"] })),
  moon: [{ size: "desktop", weather: "clear", moons: Object.keys(MOONS), views: ["sky"] }],
  lamps: [{ size: "desktop", weather: "clear", times: ["dusk", "night"], views: ["lamps"] }, { size: "phone", weather: "clear", times: ["night"], views: ["lamps"] }],
};
const SIZES = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } };
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const run of PLANS[PLAN]) {
  const phone = run.size === "phone";
  const ctx = await browser.newContext({ viewport: SIZES[run.size], deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([look]) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.35, zoom: 1.4, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch {} }, [LOOK]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  page.on("console", m => { if ((m.type() === "error" || m.type() === "warning") && /sky|shader|GLSL|WebGL|THREE|program/i.test(m.text())) console.log("console", m.text().slice(0, 400)); });
  await page.goto(`http://localhost:${PORT}/lab/island?at=${SPOT}&at=12:30&date=${DATE}&weather=${run.weather}&season=summer${run.wind ? `&wind=${run.wind}` : ""}`, { timeout: 300000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current && !!window.__sky, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  const shots = run.moons ? run.moons.map(m => [m, ...MOONS[m]]) : run.times.map(t => [t, TIMES[t], DATE]);
  for (const [time, hhmm, date] of shots) {
    await page.evaluate(([hhmm, date]) => window.__sky.at(hhmm, date), [hhmm, date]);
    for (const v of run.views) {
      const { face, tilt, view } = VIEWS[v](run.moons ? "night" : time);
      await page.evaluate(([face, tilt, amb, wind]) => window.__sky.set({ face, tilt, amb, wind }), [face, tilt, run.amb ?? [], run.wind ?? null]);
      // After React has dropped the last view's turn toward the sun.
      await page.waitForTimeout(300);
      await page.evaluate(view => window.__sky.view(view), view);
      await page.waitForTimeout(2500);
      const name = `sky2-${PLAN}-${run.size}-${run.weather}-${time}-${v}`;
      // The page keeps a 40 px strip above the canvas: left out.
      const { width, height } = SIZES[run.size], top = 40;
      await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 85, clip: { x: 0, y: top, width, height: height - top } });
      console.log(name);
    }
  }
  await ctx.close();
}
await browser.close();
