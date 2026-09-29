// Movement lab evidence (specs/movement.md): frame strips of each move, the tuning panel and a lap.
//   node specs/evidence/movement/shots.mjs <outDir> [only,only2,...]
// The refine pass (2026-09-29) shoots bunny-hop, dash, dash-jump, camera-top-speed and hop-no-bob into specs/evidence/movement-refine.
// PORT picks the dev server (default 3107). Headed Chromium (WebGL), real GPU (metal). Each move is driven by the
// dev route pilot (__move.autopilot) and shot with the sim paused between 1/20 s steps (__move.run), so every
// frame is a known sim time; frames are cropped round the avatar and tiled with ImageMagick into a small WebP.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/movement", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/move-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const BASE = `http://localhost:${process.env.PORT ?? 3107}/lab/move`;
const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.removeItem("tsi.moveLab.v1"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));

let opened = null;
async function open(query) {
  opened = query;
  await page.goto(`${BASE}?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 180000 });
  await page.waitForTimeout(9000);
}
const state = () => page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, mode: s.mode, hops: s.hops, dashT: s.dashT, dashCd: s.dashCd, events: s.events.map(e => e.kind) }; });
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "12", "-quality", "72", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};

/**
 * Teleport, run a route with the sim paused between steps, and shoot from the step where `from(state)` holds until
 * `until(state)` (then `after` more); at most `max` frames kept, spread evenly. `full` keeps the whole view (the HUD),
 * `clip` a fixed part of it; `label(s, camera, screen)` replaces the default frame label.
 */
async function strip(name, { query = "panel=0&zoom=0.6", at, facing, route, from, until, after = 2, max = 8, step = 0.05, limit = 8, cols = 4, full = false, clip = null, tileGeometry = null, label = null }) {
  if (query !== opened) await open(query);
  await page.evaluate(([x, z, f]) => { window.__move.teleport(x, z, f); window.__move.pause(); }, [at[0], at[1], facing]);
  await page.waitForTimeout(900);
  await page.evaluate(r => window.__move.autopilot(r), route);
  const frames = [];
  let t = 0, since = null, left = null;
  while (t < limit && left !== 0) {
    await page.evaluate(s => window.__move.run(s), step);
    await page.waitForTimeout(full ? 160 : 130);
    t += step;
    const s = await state();
    if (since === null && !from(s)) continue;
    since ??= t;
    if (left === null && until(s)) left = after + 1;
    if (left !== null) left--;
    const [p, cam] = await page.evaluate(() => [window.__move.screen(), window.__move.camera()]);
    const w = 420, h = 320, x = Math.max(0, Math.min(1280 - w, Math.round(p.x - w / 2))), y = Math.max(40, Math.min(760 - h, Math.round(p.y - h * 0.62)));
    const file = `${TMP}/${name}-${String(frames.length).padStart(2, "0")}.png`;
    await page.screenshot({ path: file, ...(full ? {} : { clip: clip ?? { x, y, width: w, height: h } }) });
    const at = `${(t - since).toFixed(2)}s`;
    frames.push({ file, label: label ? `${at}  ${label(s, cam, p)}` : `${at}  y ${s.y.toFixed(2)}  ${Math.hypot(s.vx, s.vz).toFixed(1)} u/s  ${s.mode}${s.hops ? ` hop ${s.hops}` : ""}` });
  }
  await page.evaluate(() => window.__move.resume());
  const pick = frames.length <= max ? frames : Array.from({ length: max }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]);
  tile(pick.map(f => f.file), pick.map(f => f.label), name, cols, tileGeometry ?? (full ? "400x238+3+3" : "280x213+3+3"));
}

const S = Math.PI / 2;
const MOVES = {
  // A walking jump across the top stretch (+x is screen left): the arc side on.
  "jump-arc": { at: [-19.5, 21], facing: S, route: [{ to: [-16.5, 21], move: "jump", r: 0.3 }, { to: [-13, 21] }],
    from: s => s.x > -16.9, until: s => s.mode === "ground" && s.x > -15.5 },
  // Sprint, then hold Space: a hop on every landing, the speed pips filling to the cap (the HUD and the avatar).
  "bunny-hop": { at: [-17, -21], facing: 0, route: [{ to: [-17, -12], sprint: true, r: 0.6, move: "hops" }, { to: [-17, 16], sprint: true }],
    from: s => s.z > -12.6, until: s => s.z > 6, after: 0, step: 0.1, clip: { x: 0, y: 40, width: 900, height: 720 }, tileGeometry: "375x300+3+3", cols: 3, max: 9,
    label: s => `${Math.hypot(s.vx, s.vz).toFixed(1)} u/s  ${s.mode}${s.hops ? `  hop ${s.hops}` : ""}` },
  // Bunny-hopping at top speed, the whole view every 0.25 s: the avatar holds its place on screen, no lag behind or swing past.
  "camera-top-speed": { at: [-17, -21], facing: 0, route: [{ to: [-17, -14], sprint: true, r: 0.6, move: "hops" }, { to: [-17, 17], sprint: true }],
    query: "panel=0", from: s => s.z > -6, until: s => s.z > 12, after: 0, step: 0.2, full: true, cols: 3, max: 6,
    label: (s, cam, p) => `${Math.hypot(s.vx, s.vz).toFixed(1)} u/s  on screen ${Math.round(p.x)},${Math.round(p.y)}  cam ${(s.z - cam[2]).toFixed(1)}u back` },
  // Hops close up, about two of them: the avatar rises and lands, the camera height does not move.
  "hop-no-bob": { at: [-17, -21], facing: 0, route: [{ to: [-17, -14], sprint: true, r: 0.6, move: "hops" }, { to: [-17, 17], sprint: true }],
    from: s => s.z > -2, until: s => s.z > 8, after: 0, step: 0.04, max: 10, cols: 5,
    label: (s, cam) => `avatar y ${s.y.toFixed(2)}  camera y ${cam[1].toFixed(2)}` },
  // At sprint speed the jump is the long jump: over the 3-tile river.
  "long-jump-3-tiles": { at: [-19.8, 21], facing: S, route: [{ to: [-11.3, 21], sprint: true, move: "jump", r: 0.35 }, { to: [-3.4, 21], sprint: true, move: "jump", r: 0.35 }, { to: [3, 21], sprint: true }],
    from: s => s.x > -4.1, until: s => s.mode === "ground" && s.x > 0.6 },
  // Over the 4-tile river: a long jump, then Q on the way down: the air dash floats up a little, eases to an apex, and carries across.
  "air-dash": { at: [-19.8, 21], facing: S, route: [{ to: [-11.3, 21], sprint: true, move: "jump", r: 0.35 }, { to: [-3.4, 21], sprint: true, move: "jump", r: 0.35 },
    { to: [6.8, 21], sprint: true, move: "long-dash", r: 0.35 }, { to: [18, 21], sprint: true }],
    from: s => s.x > 6.4, until: s => s.mode === "ground" && s.x > 11.5, after: 1, step: 0.04, max: 12 },
  // Jump into the 1.5u cliff: grab, mantle up.
  "mantle": { at: [16.8, -20], facing: -S, route: [{ to: [14.25, -20], move: "mantle", r: 0.15 }, { to: [11, -22.5] }],
    from: s => s.x < 14.4, until: s => s.mode === "ground" && s.y > 1.4, step: 0.04 },
  // Run off the second level: over the one-tile ledge, a 3u drop, a roll that keeps the speed.
  "drop-roll": { at: [4, -21], facing: -S, route: [{ to: [-4, -21], sprint: true, r: 0.8 }, { to: [-6, -21] }],
    from: s => s.x < 0, until: s => s.mode === "ground" && s.y < 0.1 && s.x < -2, after: 1, step: 0.04 },
  // Q on the ground: the burst, its speed lines, the ease into the walk and the cooldown ring filling, then its flash.
  "dash": { at: [-17, -13], facing: 0, route: [{ to: [-17, -11], r: 0.4 }, { to: [-17, -2], move: "dash", r: 20 }, { to: [-17, -1] }],
    from: s => s.z > -11.4, until: s => s.dashCd <= 0 && s.z > -8.5, after: 3, step: 0.04, max: 12,
    label: s => `${Math.hypot(s.vx, s.vz).toFixed(1)} u/s  ${s.dashT > 0 ? "dashing" : s.mode}  cooldown ${s.dashCd.toFixed(2)}s` },
  // Q then Space: the dash speed carried into a long arc.
  "dash-jump": { at: [-17, -13], facing: 0, route: [{ to: [-17, -11], r: 0.4 }, { to: [-17, 4], move: "dash-jump", r: 20 }, { to: [-17, 5] }],
    from: s => s.z > -11.4, until: s => s.mode === "ground" && s.z > -8, after: 1 },
  // Sprinting, then back the other way: the skid, then off again.
  "skid": { at: [-17, -15], facing: 0, route: [{ to: [-17, 1], sprint: true, r: 0.6 }, { to: [-17, -8], sprint: true }],
    from: s => s.z > -0.4, until: s => s.mode === "ground" && s.vz < -1.5, after: 3, step: 0.04 },
};

for (const [name, move] of Object.entries(MOVES)) if (!ONLY || ONLY.has(name)) await strip(name, move);

if (!ONLY || ONLY.has("panel")) {
  await open("");
  await page.screenshot({ path: `${TMP}/panel.png` });
  // Beside it, the panel scrolled to the dash group (its presets) and the juice.
  await page.locator('[data-testid="move-panel"] legend', { hasText: "Dash (Q)" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await page.locator('[data-testid="move-panel"]').boundingBox();
  await page.screenshot({ path: `${TMP}/panel-dash.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  execFileSync("magick", [`${TMP}/panel.png`, `${TMP}/panel-dash.png`, "-background", "#0b0e14", "-gravity", "north", "+append", "-quality", "75", `${OUT}/tuning-panel.webp`]);
  console.log("wrote", `${OUT}/tuning-panel.webp`);
}

if (!ONLY || ONLY.has("lap")) {
  // The scripted lap at real time, a frame every 1.5 s, and the lap readout at the end.
  await open("panel=0");
  await page.evaluate(() => window.__move.autopilot());
  const files = [], labels = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(i === 11 ? 600 : 1500);
    const f = `${TMP}/lap-${String(i).padStart(2, "0")}.png`;
    await page.screenshot({ path: f });
    files.push(f);
    const lapText = (await page.locator('[data-testid="move-lap"]').innerText()).split("\n");
    labels.push(lapText[2]?.startsWith("Last 0") ? lapText[2] : `${lapText[0]}  ${(await page.locator('[data-testid="move-hud"]').innerText()).split("\n")[0].replace(/\s+/g, " ")}`);
  }
  const fps = await page.evaluate(() => new Promise(done => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else done(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(tick); }));
  console.log("lab FPS (High, 1280x760):", fps);
  tile(files, labels, "lap", 4, "320x190+3+3");
  console.log("lap readout:", (await page.locator('[data-testid="move-lap"]').innerText()).replace(/\n/g, " | "));
}
await browser.close();
