// Sushi bar review views (game/sushi-bar; terrain-v3/shoot.mjs with the bar's views and the way in): in-game shots of the new world (web/data/world) on /lab/island?fixture=v2,
// headless Chromium (WebGL), muted, signed out, against a dev server on PORT with the Supabase env blanked.
//   PORT=3175 node specs/evidence/sushi-bar/shoot.mjs <out_dir> [view,view,...]
// Each view stands the player at (x, z) with the orbit camera at a heading (yaw: 0 looks toward +z, 90 toward +x), a tilt
// (pitch, radians, 0.35 to 0.82) and a zoom (0.6 to 1.6), in the summer daytime.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

// Phase A spots (specs/launch/sushi-bar.md): the bar on its stilts at (-47, 119.5), yaw pi, so its frame's (lx, lz) is the
// world's (-47 - lx, 119.5 - lz): its pier runs north (-z) to the sand at z 107.5, the entrance at (-47, 114.5), its window
// onto the sea to the south. `sit` stands you at the entrance and presses E (Enter the sushi bar); `frames` are the ms
// after E to shoot the glide in (each its own png, name-<ms>), then the seated view; `turn` then looks round from the
// stool (radians, + left) and holds it there, `tilt` tips it (the orbit's pitch, + down); `wait` waits that many ms more
// (the ?time= clock starts each shot at much the same moment of the staff's loops); `served` waits until the server's
// round (lib/game/sushiBar.ts SERVER: start, loop, the serve's time) has a geta on the shelf before that stool. `calm`
// turns the season's traditions off (?tradition=none: Halloween's fog nights darken and fog the night), to see the bar
// on a natural night. `bots` seats two dev bots side by side at the bar first (?bots=2&botbar=1: lib/net/botBrain.ts
// sitBar), so a `sit` takes the next stool beside them; `overview` switches to the overview camera once seated.
const SIT = { at: [-47, 114.8], yaw: 0, pitch: 0.42, zoom: 1.0, sit: true };
export const VIEWS = {
  "bar-day": { at: [-36, 111], yaw: 305, pitch: 0.3, zoom: 1.4 },
  "bar-evening": { at: [-36, 111], yaw: 305, pitch: 0.3, zoom: 1.4, time: "evening" },
  "bar-night": { at: [-36, 111], yaw: 305, pitch: 0.3, zoom: 1.4, time: "night", calm: true },
  "approach-day": { at: [-16, 104.6], yaw: 278, pitch: 0.3, zoom: 1.3 },
  "approach-night": { at: [-16, 104.6], yaw: 278, pitch: 0.3, zoom: 1.3, time: "night", calm: true },
  "corner": { at: [-52.4, 111.2], yaw: 22, pitch: 0.35, zoom: 0.6, time: "evening" },
  "chef-outside": { at: [-46.2, 112.2], yaw: 20, pitch: 0.3, zoom: 0.7 },
  "entrance": { at: [-46.6, 111.2], yaw: 0, pitch: 0.36, zoom: 0.75, time: "evening" },
  "entry": { ...SIT, time: "night", frames: [300, 900, 1500] },
  "seat-evening": { ...SIT, time: "evening", wait: 8000 },
  "seat-evening-left": { ...SIT, time: "evening", turn: 0.95 },
  "seat-evening-right": { ...SIT, time: "evening", turn: -0.95 },
  "seat-night": { ...SIT, time: "night", calm: true },
  "seat-night-left": { ...SIT, time: "night", turn: 0.95, calm: true },
  "seat-night-right": { ...SIT, time: "night", turn: -0.95, calm: true },
  "food": { ...SIT, time: "evening", served: 2, tilt: 0.12 },
  "pair-outside": { at: [-45.7, 114.9], yaw: -60, pitch: 0.3, zoom: 0.6, time: "evening", bots: true },
  "pair-seat": { ...SIT, time: "night", calm: true, bots: true, turn: -0.95 },
  "seat-overview": { ...SIT, time: "night", calm: true, overview: true },
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
  await page.goto(`http://localhost:${PORT}/lab/island?fixture=v2&at=${v.at.join(",")}${v.flat ? "&aerial=1" : ""}&time=${v.time ?? "day"}&weather=clear&season=summer${v.calm ? "&tradition=none" : ""}${v.bots ? "&bots=2&botbar=1" : ""}`);
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  if (await page.evaluate(() => { const g = window.__governor; if (!g) return false; g.hold = 1e9; g.set(0); return true; })) await page.waitForTimeout(1500);
  await page.addStyleTag({ content: "nav, [role=status], #island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  if (v.sit) {
    await page.keyboard.press("e");
    let t0 = 0;
    for (const ms of v.frames ?? []) { await page.waitForTimeout(ms - t0); t0 = ms; await page.screenshot({ path: `${OUT}/${name}-${ms}.png` }); }
    await page.waitForTimeout(3000 + (v.wait ?? 0));
    if (v.served !== undefined) {
      const ROUND = { start: 11.426, loop: 93.913, at: { 0: 71.617, 1: 8.052, 2: 24.4, 3: 55.113, 4: 87.374, 5: 43.026 } }, r = ((Date.now() / 1000 - ROUND.start) % ROUND.loop + ROUND.loop) % ROUND.loop;
      const from = ROUND.at[v.served] + 3, wait = ((from - r) % ROUND.loop + ROUND.loop) % ROUND.loop;
      if (wait < ROUND.loop - 30) await page.waitForTimeout(wait * 1000);
    }
    if (v.overview) { await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent === "Overview")?.click()); await page.waitForTimeout(3000); }
    if (v.turn || v.tilt) { await page.evaluate(([t, p]) => { const o = window.__orbit.orbit; o.target.yaw += t; o.target.pitch += p; o.idle = -1e9; }, [v.turn ?? 0, v.tilt ?? 0]); await page.waitForTimeout(1500); }
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  if (v.bots) console.log("remotes", JSON.stringify(await page.evaluate(() => window.__net?.remotes())));
  console.log("shot", name, JSON.stringify(await page.evaluate(() => { const p = window.__move?.sim?.current?.pos ?? window.__move?.sim?.current?.position; return p ? [p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]].map(n => +(+n).toFixed(2)) : null; })));
  await ctx.close();
}
await browser.close();
