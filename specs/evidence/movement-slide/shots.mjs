// Slide evidence (specs/movement-slide.md): slow-motion frame strips of the crouch, a slide, a slide downhill, a
// dash-slide, the slide-jump over the gap, a land-slide and the ramp launch in /lab/move; a full chain in the game
// camera; the tuning panel and the momentum readout; the slide in the village, on the home island and in the ruins;
// FPS. Clip sheets come from clip_sheet.py (Blender), the speed graph from speed_graph.ts (the sim).
//   PORT=3125 node specs/evidence/movement-slide/shots.mjs [only,only2,...]
// Headed Chromium (WebGL), real GPU (metal), muted. Each move is driven by the dev route pilot with the sim paused
// between steps (__move.run), so every frame is a known sim time. Writes WebP to specs/evidence/movement-slide/.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const OUT = "specs/evidence/movement-slide";
const TMP = "/tmp/movement-slide-evidence";
const ONLY = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
mkdirSync(TMP, { recursive: true });
for (const f of readdirSync(TMP)) if (f.endsWith(".png")) rmSync(`${TMP}/${f}`);
const FONT = "/System/Library/Fonts/Monaco.ttf";
const W = 1280, H = 760;

const { chromium } = require("playwright");
const PORT = process.env.PORT ?? 3125;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.removeItem("tsi.moveKeys.v1"); for (const v of [2, 3, 4]) localStorage.removeItem(`tsi.moveLab.v${v}`); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
page.on("console", m => { if (m.type() === "error") console.log("console", m.text().slice(0, 200)); });

let opened = null;
async function open(url) {
  if (url === opened) return;
  opened = url;
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(5000);
}
const LAB = "/lab/move?panel=0&zoom=0.6";
const state = () => page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, mode: s.mode, modeT: s.modeT, dashT: s.dashT, crouch: s.crouch, keep: s.keep, bleed: s.bleed, events: s.events.map(e => e.kind) }; });
const speed = s => Math.hypot(s.vx, s.vz).toFixed(1);
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", FONT, "-pointsize", "12", "-quality", "74", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`, files.length, "frames");
};
const pick = (frames, max) => (frames.length <= max ? frames : Array.from({ length: max }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]));
const label = s => `${speed(s)} u/s  ${s.dashT > 0 ? "dash" : s.mode}${s.crouch ? " (crouch)" : ""}${s.events.length ? "  " + s.events.join(",") : ""}`;

/**
 * Teleport, then drive a route with the sim paused between `step`s; shoot from the step where `from(s)` holds until
 * `until(s)` (then `after` more), at most `max` frames spread evenly (but every frame with an event kept), cropped
 * round the avatar.
 */
async function strip(name, { url = LAB, at, facing, route, from, until, after = 2, max = 8, step = 0.04, limit = 8, cols = 4, w = 420, h = 320, geometry = "280x213+3+3" }) {
  await open(url);
  await page.evaluate(([x, z, f]) => { window.__move.teleport(x, z, f); window.__move.pause(); }, [at[0], at[1], facing]);
  await page.waitForTimeout(1500);
  await page.evaluate(r => window.__move.autopilot(r), route);
  const frames = [];
  let t = 0, since = null, left = null, s = await state();
  while (t < limit && left !== 0) {
    await page.evaluate(d => window.__move.run(d), step);
    await page.waitForTimeout(150);
    t += step;
    s = await state();
    if (since === null && !from(s)) continue;
    since ??= t;
    if (left === null && until(s)) left = after + 1;
    if (left !== null) left--;
    const p = await page.evaluate(() => window.__move.screen());
    const clip = { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(40, Math.min(H - h, Math.round(p.y - h * 0.62))), width: w, height: h };
    const file = `${TMP}/${name}-${String(frames.length).padStart(3, "0")}.png`;
    await page.screenshot({ path: file, clip });
    const ground = await page.evaluate(() => window.__move.ground?.() ?? "");
    frames.push({ file, label: `${(t - since).toFixed(2)}s  ${label(s)}${ground ? `  ${ground}` : ""}` });
  }
  await page.evaluate(() => window.__move.resume());
  const chosen = pick(frames, max);
  tile(chosen.map(f => f.file), chosen.map(f => f.label), name, cols, geometry);
}

const S = Math.PI / 2; // facing +x (screen left)
const MOVES = {
  // Crouch-walking across the slide lane's apron, side on (+x is screen left): low, careful steps, half the dust.
  "crouch": { at: [-6, 25.5], facing: S, route: [{ to: [3, 25.5], crouch: true }], from: s => s.x > -5.6, until: s => s.x > -2.6, after: 0, step: 0.12, max: 8 },
  // A sprint into a slide along the apron, side on: the drop, the slide with its trail, standing up into the crouch.
  "slide": { at: [-7, 25.5], facing: S, route: [{ to: [3, 25.5], sprint: true, r: 0.5 }, { to: [19, 25.5], crouch: true }],
    from: s => s.mode === "slide" || s.x > 2.4, until: s => s.events.includes("stand") || (s.mode === "ground" && s.x > 6 && s.crouch), after: 3, step: 0.08, max: 12 },
  // Q with the slide held, side on: the dash plays out its burst, then the sharper, lower drop at the dash's speed and the spray.
  "dash-slide": { at: [-7, 25.5], facing: S, route: [{ to: [1, 25.5], sprint: true, move: "dash", r: 0.4 }, { to: [19, 25.5], crouch: true }],
    from: s => s.x > 0.4, until: s => s.mode === "slide" && s.modeT > 0.5, after: 0, step: 0.04, max: 12 },
  // Down the long ramp from the shelf's run-up (going up the screen): faster on the slope, a long run out.
  "slide-downhill": { at: [3, 27.6], facing: 0, route: [{ to: [3, 35.5], sprint: true }, { to: [3, 58], crouch: true }],
    from: s => s.mode === "slide" && s.z > 35.8, until: s => s.z > 44, after: 0, step: 0.06, max: 10, label: true },
  // The dash-slide straight to the 7-tile water gap: dash, slide, the slide-jump at the brick lip, landing into a slide.
  "slide-jump-gap": { url: "/lab/move?panel=0&zoom=0.8", at: [17.5, 27.5], facing: 0, route: [{ to: [17.5, 40], sprint: true, move: "dash", r: 0.4 }, { to: [17.5, 44.2], crouch: true, move: "jump", r: 0.35 }, { to: [17.5, 56] }],
    from: s => s.z > 41.5, until: s => s.z > 52.6, after: 1, step: 0.04, max: 12, w: 460, h: 360, geometry: "300x235+3+3" },
  // Running off the west run-up block's 1.5u edge with the slide held: no roll, straight into a slide at speed.
  "land-slide": { at: [6.5, 27.5], facing: 0, route: [{ to: [6.5, 34], sprint: true }, { to: [6.5, 45], crouch: true }],
    from: s => s.z > 35.6, until: s => s.mode === "slide" && s.modeT > 0.25 && s.y < 0.1, after: 0, step: 0.035, max: 12 },
  // The ramp launch: up the tower, dash, slide down its ramp and off the lip, out over the striped field, into a slide.
  "ramp-launch": { url: "/lab/move?panel=0&zoom=0.8", at: [10, 27.5], facing: 0, route: [{ to: [10, 33.5], sprint: true, move: "dash", r: 0.3 }, { to: [10, 40.4], crouch: true }, { to: [10, 56], crouch: true }],
    from: s => s.z > 35.5, until: s => s.mode === "slide" && s.y < 0.1 && s.modeT > 0.15, after: 0, step: 0.045, max: 12, w: 460, h: 360, geometry: "300x235+3+3" },
  // A full chain in the game camera (the follow camera's own zoom): dash, slide, slide-jump, land into a slide, slide-jump over the gap, land into a slide.
  "chain-game-camera": { url: "/lab/move?panel=0", at: [17.5, 27.5], facing: 0,
    route: [{ to: [17.5, 31], sprint: true, move: "dash", r: 0.4 }, { to: [17.5, 34.6], crouch: true, move: "jump", r: 0.4 }, { to: [17.5, 43.9], crouch: true, move: "jump", r: 0.35 }, { to: [17.5, 56], crouch: true }],
    from: s => s.z > 30.4, until: s => s.z > 53.4, after: 0, step: 0.07, max: 16, cols: 4, w: 560, h: 420, geometry: "320x240+3+3" },
};
for (const [name, move] of Object.entries(MOVES)) if (!ONLY || ONLY.has(name)) await strip(name, move);

/** One frame of the readout and panel after a chain (the HUD's trace shows its last 3 s). */
if (!ONLY || ONLY.has("tuning-panel")) {
  await open("/lab/move?panel=1");
  opened = null;
  await page.evaluate(() => { window.__move.teleport(17.5, 27.5, 0); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__move.autopilot([{ to: [17.5, 31], sprint: true, move: "dash", r: 0.4 }, { to: [17.5, 34.6], crouch: true, move: "jump", r: 0.4 }, { to: [17.5, 43.9], crouch: true, move: "jump", r: 0.35 }, { to: [17.5, 56], sprint: true }]));
  await page.waitForTimeout(3300);
  await page.screenshot({ path: `${TMP}/hud.png`, clip: { x: 0, y: 40, width: 260, height: 300 } });
  // Scroll the panel to the Slide and Momentum groups.
  await page.evaluate(() => { const p = document.querySelector('[data-testid="move-panel"]'); const g = [...p.querySelectorAll("legend")].find(l => l.textContent === "Slide"); g?.scrollIntoView({ block: "start" }); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${TMP}/panel.png`, clip: { x: W - 360, y: 40, width: 360, height: H - 40 } });
  execFileSync("magick", [`${TMP}/hud.png`, `${TMP}/panel.png`, "-background", "#0b0e14", "-gravity", "north", "+append", "-quality", "80", `${OUT}/tuning-panel.webp`]);
  console.log("wrote", `${OUT}/tuning-panel.webp`);
}

/** The slide in the game: the village's south beach (sand spray), the home island, the ruins (no i-frames). */
const GAME = { village: "/lab/island?time=day&weather=clear&season=summer&zoom=0.7", home: "/lab/island?time=day&weather=clear&season=summer&home=1&zoom=0.7", ruins: "/lab/island?time=day&weather=clear&season=summer&ruins=1&combat=demo&zoom=0.8" };
const AREAS = {
  "village": { url: GAME.village, at: [-9, -17.3], facing: S, route: [{ to: [-2, -17.3], sprint: true, r: 0.5 }, { to: [8, -17.3], crouch: true }], from: s => s.mode === "slide", until: s => s.mode === "slide" && s.modeT > 0.7, after: 0, step: 0.06, max: 8 },
};
for (const [name, move] of Object.entries(AREAS)) if (!ONLY || ONLY.has(name)) await strip(name, move);

if (!ONLY || ONLY.has("fps")) {
  const fps = (ms) => page.evaluate(ms => new Promise(done => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(tick); }), ms);
  const lines = [];
  for (const [where, url, at, route] of [
    ["lab", "/lab/move?panel=0", [17.5, 27.5], [{ to: [17.5, 31], sprint: true, move: "dash", r: 0.4 }, { to: [17.5, 34.6], crouch: true, move: "jump", r: 0.4 }, { to: [17.5, 43.9], crouch: true, move: "jump", r: 0.35 }, { to: [17.5, 56], crouch: true }]],
    ["village", GAME.village.replace("&zoom=0.7", ""), [-9, -17.3], [{ to: [-2, -17.3], sprint: true, r: 0.5 }, { to: [8, -17.3], crouch: true }, { to: [-8, -17.3], sprint: true, move: "dash", r: 0.5 }, { to: [-14, -17.3], crouch: true }]],
  ]) {
    await open(url);
    await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), at);
    await page.waitForTimeout(1500);
    const still = await fps(3000);
    await page.evaluate(r => window.__move.autopilot(r), route);
    const moving = await fps(2500);
    lines.push(`${where}: standing ${still} FPS, sliding through the chain ${moving} FPS`);
  }
  console.log(lines.join("\n"));
  writeFileSync(`${TMP}/fps.txt`, lines.join("\n") + "\n");
}
await browser.close();
