// Starts and stops with weight (vb-anim round 2): /lab/move, the avatar walking (and sprinting) across the screen from
// a stand and stopping, the sim stepped 0.04 s at a time (window.__move.run), cropped round the avatar. Headless, muted,
// against a dev server on PORT with the Supabase env blanked. LEAN=0 shoots it with the Juice panel's lean off.
//   PORT=3473 [LEAN=0] node specs/evidence/vb-anim/startstop.mjs <out_dir>
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "/tmp/startstop"] = process.argv.slice(2), PORT = process.env.PORT ?? 3473, TAG = process.env.LEAN === "0" ? "lean0" : "lean1";
const W = 1280, H = 760, FONT = "/System/Library/Fonts/Monaco.ttf";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript(lean => {
  try {
    localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.35, autoFollow: false }));
    localStorage.setItem("tsi.moveLab.v4", JSON.stringify({ move: {}, juice: { lean }, preset: "Custom" }));
  } catch { /* defaults */ }
}, process.env.LEAN === "0" ? 0 : 1);
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/lab/move?panel=0&zoom=0.6`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas", { timeout: 240000 });
for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move) ? quiet + 1 : 0; }
await page.waitForTimeout(6000);
const state = () => page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, vx: s.vx, vz: s.vz }; });

// From a stand, across the open grass at the top of the course (the camera held at yaw 0, looking +z, and its lowest tilt: side on), and a stop.
for (const [name, sprint, to] of [["walk", false, -15.5], ["run", true, -11.5]]) {
  await page.evaluate(() => { window.__move.teleport(-20, 19.5, Math.PI / 2); window.__move.pause(); });
  await page.waitForTimeout(1500);
  await page.evaluate(r => window.__move.autopilot(r), [{ to: [to, 19.5], sprint, r: 0.3 }]);
  const frames = [];
  for (let t = 0.04; t < 3.2; t += 0.04) {
    await page.evaluate(d => window.__move.run(d), 0.04);
    await page.waitForTimeout(120);
    const s = await state(), p = await page.evaluate(() => window.__move.screen());
    const file = `${OUT}/${name}-${TAG}-${String(frames.length).padStart(3, "0")}.png`;
    await page.screenshot({ path: file, clip: { x: Math.round(p.x - 160), y: Math.round(p.y - 190), width: 320, height: 300 } });
    frames.push({ file, t, v: Math.hypot(s.vx, s.vz) });
  }
  // the start: its first 8 steps; the stop: from the last step at full pace, 10 steps
  const top = Math.max(...frames.map(f => f.v)), last = frames.findLastIndex(f => f.v > top * 0.97);
  for (const [part, pick] of [["start", frames.slice(0, 8)], ["stop", frames.slice(last, last + 10)]]) {
    const args = ["montage"];
    for (const f of pick) args.push("-label", `${f.t.toFixed(2)}s ${f.v.toFixed(1)}u/s`, f.file);
    args.push("-tile", `${pick.length}x`, "-geometry", "+2+2", "-background", "#0b0e14", "-fill", "#f1ffff", "-font", FONT, "-pointsize", "12",
      "-title", `${name} ${part}  (lean ${TAG === "lean0" ? "off" : "on"})`, `${OUT}/${name}-${part}-${TAG}.png`);
    execFileSync("magick", args);
    console.log("wrote", `${OUT}/${name}-${part}-${TAG}.png`);
  }
  await page.evaluate(() => window.__move.resume());
}
await browser.close();
