// Sky-ambient round 1 stills (specs/sky-ambient.md): the new world on /lab/island, headless Chromium (WebGL), muted,
// signed out, against a dev server on PORT (Supabase blanked). One page load per weather and size; the sky direction,
// the clock and the view change at run time through window.__sky (components/game/SkyLab.tsx).
//   PORT=3480 PLAN=test|day|weather|phone node specs/evidence/sky-ambient/shoot.mjs <out_dir>
// Names: sky1-<plan>-<size>-<weather>-<sky>-<time>-<view>.jpg
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
  sky: t => ({ face: t === "night" ? "moon" : "sun", tilt: t === "night" ? 24 : 16, view: { pitch: 0.35, zoom: ZOOM } }),
  island: () => ({ face: null, tilt: 8, view: { yaw: Math.PI, pitch: 0.35, zoom: ZOOM } }),
  // What a player sees at the orbit's lowest tilt, looking back over the island.
  play: () => ({ face: null, tilt: 0, view: { yaw: Math.PI, pitch: 0.35, zoom: 1.4 } }),
  game: () => ({ face: null, tilt: 0, view: { yaw: Math.PI, pitch: Math.atan2(7.4, 10.8), zoom: 1 } }),
};
const SKIES = [null, "A", "B", "C"];
const PLANS = {
  amb: [{ size: "desktop", weather: "clear", skies: ["A"], times: ["midday", "golden"], views: ["sky", "island"], amb: ["motes", "swirls"], wind: "storm" }],
  spot: [{ size: "desktop", weather: "clear", skies: [null], times: ["golden", "night"], views: ["sky", "island"] }],
  test2: [{ size: "desktop", weather: "clear", skies: SKIES, times: ["golden", "sunset", "dusk", "night"], views: ["sky"] }],
  test: [{ size: "desktop", weather: "clear", skies: [null, "B"], times: ["midday", "golden", "night"], views: ["sky", "island", "game"] }],
  day: [{ size: "desktop", weather: "clear", skies: SKIES, times: Object.keys(TIMES), views: ["sky", "island"] }],
  weather: ["rain", "snow", "fog", "wind"].map(weather => ({ size: "desktop", weather, skies: SKIES, times: ["midday", "sunset"], views: ["sky"] })),
  phone: [{ size: "phone", weather: "clear", skies: SKIES, times: ["midday", "sunset", "night"], views: ["sky"] }],
  today: [{ size: "desktop", weather: "clear", skies: [null], times: Object.keys(TIMES), views: ["sky", "island", "play", "game"] },
    ...["rain", "snow", "fog", "wind"].map(weather => ({ size: "desktop", weather, skies: [null], times: ["midday"], views: ["sky", "game"] }))],
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
  page.on("console", m => { if (m.type() === "error" && /sky|shader|GLSL|WebGL/i.test(m.text())) console.log("console", m.text().slice(0, 400)); });
  await page.goto(`http://localhost:${PORT}/lab/island?at=${SPOT}&at=12:30&date=${DATE}&weather=${run.weather}&season=summer${run.wind ? `&wind=${run.wind}` : ""}`, { timeout: 300000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current && !!window.__sky, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  for (const sky of run.skies) for (const time of run.times) {
    await page.evaluate(([hhmm, date]) => window.__sky.at(hhmm, date), [TIMES[time], DATE]);
    for (const v of run.views) {
      const { face, tilt, view } = VIEWS[v](time);
      await page.evaluate(([sky, face, tilt, amb, wind]) => window.__sky.set({ sky, face, tilt, amb, wind }), [sky, face, tilt, run.amb ?? [], run.wind ?? null]);
      // After React has dropped the last view's turn toward the sun.
      await page.waitForTimeout(300);
      await page.evaluate(view => window.__sky.view(view), view);
      await page.waitForTimeout(2200);
      const name = `sky1-${PLAN}-${run.size}-${run.weather}-${sky ?? "today"}-${time}-${v}`;
      // The page keeps a 40 px strip above the canvas on desktop: left out.
      const { width, height } = SIZES[run.size], top = phone ? 0 : 40;
      await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82, clip: { x: 0, y: top, width, height: height - top } });
      console.log(name);
    }
  }
  await ctx.close();
}
await browser.close();
