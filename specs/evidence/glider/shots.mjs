// Leaf glider evidence (specs/glider.md): frame strips in /lab/move's glide lane (opening, the long glide over the
// river and sea gap, a turn, the gust, the soft landing), the tuning panel, and the village (craft it in the demo
// workbench service, then jump and glide over the river), plus FPS with and without the glider.
//   PORT=3118 node specs/evidence/glider/shots.mjs [outDir] [only,only2,...]
// Headed Chromium (WebGL), real GPU (metal), muted. The sim is paused between 1/20 s steps (__move.run), so every
// frame is a known sim time; the glide is driven by the dev route pilot or by held keys. Frames are tiled into WebPs.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/glider", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/glider-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3118, W = 1280, H = 760;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.removeItem("tsi.moveLab.v2"); localStorage.removeItem("tsi.moveKeys.v1"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
page.on("console", m => { if (m.type() === "error") console.log("console", m.text().slice(0, 200)); });

let opened = null;
async function open(url) {
  opened = url;
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 180000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(4000);
}
const state = () => page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, mode: s.mode, modeT: s.modeT, events: s.events.map(e => e.kind) }; });
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "12", "-quality", "70", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};
const pick = (frames, max) => (frames.length <= max ? frames : Array.from({ length: max }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]));
const label = s => `y ${s.y.toFixed(2)}  ${Math.hypot(s.vx, s.vz).toFixed(1)} u/s  ${s.mode}`;

/**
 * Teleport and run with the sim paused between steps: `route` for the pilot, or `drive(t, s)` to hold keys. Shoot from
 * `from(s)` until `until(s)` (then `after` more frames); at most `max` kept, spread evenly.
 */
async function strip(name, { url, at, facing, route, drive, from, until, after = 2, max = 8, step = 0.05, limit = 8, cols = 4, w = 420, h = 340 }) {
  if (url !== opened) await open(url);
  await page.evaluate(([x, z, f]) => { window.__move.teleport(x, z, f); window.__move.pause(); }, [at[0], at[1], facing]);
  await page.waitForTimeout(900);
  if (route) await page.evaluate(r => window.__move.autopilot(r), route);
  const frames = [];
  let t = 0, since = null, left = null, s = await state();
  while (t < limit && left !== 0) {
    await drive?.(t, s);
    await page.evaluate(d => window.__move.run(d), step);
    await page.waitForTimeout(140);
    t += step;
    s = await state();
    if (since === null && !from(s)) continue;
    since ??= t;
    if (left === null && until(s)) left = after + 1;
    if (left !== null) left--;
    const p = await page.evaluate(() => window.__move.screen());
    const clip = { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h, Math.round(p.y - h * 0.6))), width: w, height: h };
    const file = `${TMP}/${name}-${String(frames.length).padStart(2, "0")}.png`;
    await page.screenshot({ path: file, clip });
    frames.push({ file, label: `${(t - since).toFixed(2)}s  ${label(s)}` });
  }
  await page.evaluate(() => window.__move.resume());
  for (const k of ["w", "a", "s", "d", " ", "q"]) await page.keyboard.up(k);
  const kept = pick(frames, max);
  tile(kept.map(f => f.file), kept.map(f => f.label), name, cols, `${Math.round(w * 0.7)}x${Math.round(h * 0.7)}+3+3`);
}

const LAB = "/lab/move?panel=0&zoom=0.8";
const LANE = [-18, 26], LIP = [-18, 28.15];
const glideRoute = (move = "glide", to = [-18, 42]) => [{ to: LIP, move, r: 0.2 }, { to, r: 0.5 }];
const SHOTS = {
  // The open: the jump off the tower, let go at the top, Space again: the leaf pops out of the hand.
  "G-01-open": { url: LAB, at: LANE, facing: 0, route: glideRoute(), from: s => s.z > 27.9, until: s => s.mode === "glide" && s.modeT > 0.3, after: 1, max: 8 },
  // The long glide: over the 3-tile river, the island and the 5-tile sea gap to the beach (10 tiles from the tower's edge).
  "G-02-river-and-sea-gap": { url: LAB, at: LANE, facing: 0, route: glideRoute(), from: s => s.mode === "glide", until: s => s.mode === "ground" && s.z > 30, after: 1, max: 8, step: 0.15 },
  // A turn: W held through the open, then D instead half a second in: the glide swings round to the side, banking.
  "G-03-turn": { url: LAB, at: LANE, facing: 0, from: s => s.mode === "glide", until: s => s.mode !== "glide", after: 1, max: 8, step: 0.05, w: 520,
    drive: (() => { let phase = 0; return async (t, s) => {
      if (phase === 0) { await page.keyboard.down("w"); phase = 1; }
      if (phase === 1 && s.z > 28.05) { await page.keyboard.down(" "); phase = 2; return; }
      if (phase === 2 && s.mode === "air" && s.vy <= 0) { await page.keyboard.up(" "); phase = 3; return; }
      if (phase === 3) { await page.keyboard.down(" "); phase = 4; return; }
      if (phase === 4 && s.mode === "glide" && s.modeT > 0.3) { await page.keyboard.up("w"); await page.keyboard.down("d"); phase = 5; }
    }; })() },
  // The gust: Q half a second into the glide spends the air dash forward; Space still held, the glide carries on.
  "G-04-gust": { url: LAB, at: LANE, facing: 0, route: glideRoute("glide-gust"), from: s => s.mode === "glide" && s.modeT > 0.35, until: s => s.mode === "glide" && s.modeT > 1.0, after: 0, max: 8, step: 0.08 },
  // The soft landing on the beach: no roll, no recovery, a puff.
  "G-05-soft-landing": { url: LAB, at: LANE, facing: 0, route: glideRoute(), from: s => s.mode === "glide" && s.z > 37, until: s => s.mode === "ground", after: 4, max: 8, step: 0.05 },
};

for (const [name, opts] of Object.entries(SHOTS)) if (!ONLY || ONLY.has(name)) await strip(name, opts);

// The tuning panel: the Glide group with its presets and the reach readout.
if (!ONLY || ONLY.has("G-06-tuning-panel")) {
  await open("/lab/move?panel=1");
  const box = await page.getByTestId("move-panel").boundingBox();
  await page.screenshot({ path: `${TMP}/panel-top.png`, clip: box }); // the readout: the glide's reach off a 1.5u cliff
  await page.locator("legend", { hasText: "Glide (leaf)" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${TMP}/panel.png`, clip: box });
  execFileSync("magick", [`${TMP}/panel-top.png`, `${TMP}/panel.png`, "+append", "-quality", "72", `${OUT}/G-06-tuning-panel.webp`]);
  console.log("wrote", `${OUT}/G-06-tuning-panel.webp`);
}

// FPS in the lab: idle on the tower, and gliding (real time), the glider owned; and idle without it.
if (!ONLY || ONLY.has("fps")) {
  const fps = async () => page.evaluate(() => new Promise(done => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else done(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); }));
  await open("/lab/move?panel=0&glider=0");
  const off = await fps();
  await open("/lab/move?panel=0");
  await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), LANE);
  await page.waitForTimeout(800);
  const idle = await fps();
  await page.evaluate(r => window.__move.autopilot(r), glideRoute());
  await page.waitForTimeout(700);
  const gliding = await fps();
  console.log(`FPS lab: glider off ${off}, owned idle ${idle}, gliding ${gliding}`);
}

// The village: craft the glider (the demo workbench service), the hint, then jump and glide over the river at z 2.
if (!ONLY || ONLY.has("G-07-village")) {
  const VILLAGE = "/lab/island?time=day&weather=clear&season=summer&crafting=demo&zoom=0.8";
  await open(VILLAGE);
  const crafted = await page.evaluate(async () => {
    const r = await fetch("/api/crafting/craft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipe_id: "glider-leaf", idempotency_key: "evidence-glider-0001" }) });
    window.dispatchEvent(new CustomEvent("tsi:crafted", { detail: { id: "glider-leaf" } }));
    return r.status;
  });
  console.log("crafted", crafted);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${TMP}/village-hint.png`, clip: { x: 0, y: H - 70, width: W, height: 70 } });
  execFileSync("magick", [`${TMP}/village-hint.png`, "-quality", "72", `${OUT}/G-07a-village-hint.webp`]);
  opened = VILLAGE;
  await strip("G-07-village-river", { url: VILLAGE, at: [-13.5, 2], facing: Math.PI / 2, route: [{ to: [-11.2, 2], move: "glide", r: 0.25 }, { to: [-3, 2], r: 0.5 }],
    from: s => s.x > -11.6, until: s => s.mode === "ground" && s.x > -8, after: 3, max: 8, step: 0.08, w: 520 });
}

await browser.close();
