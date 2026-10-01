// Movement feel evidence (specs/movement-feel.md, milestone 1): slow-motion frame strips of footsteps on grass and
// sand (the village), the jump, the three landings and the dash (/lab/move), the dash close up, and FPS in the village.
//   PORT=3122 node specs/evidence/movement-feel/shots.mjs <tag> [only,only2,...]
// <tag> is "before" or "after": each strip is written as <name>-<tag>.webp in /tmp, and `pair` stacks before over after
// into specs/evidence/movement-feel/<name>.webp. Headed Chromium (WebGL), real GPU (metal), muted. Each move is driven
// by the dev route pilot or held keys and shot with the movement sim paused between steps (__move.run), so every frame
// is a known sim time.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const OUT = "specs/evidence/movement-feel";
const TMP = "/tmp/movement-feel-evidence";
const [TAG = "after", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(TMP)) if (f.endsWith(".png")) rmSync(`${TMP}/${f}`);
const FONT = "/System/Library/Fonts/Monaco.ttf";
const W = 1280, H = 760;

if (TAG === "pair") {
  // Before over after, one WebP per move.
  for (const name of ONLY ?? ["footsteps-grass", "footsteps-sand", "jump", "land-tap", "land-normal", "land-heavy", "dash", "dash-closeup", "combat-marker", "village-fps"]) {
    const [b, a] = [`${TMP}/${name}-before.webp`, `${TMP}/${name}-after.webp`];
    if (!existsSync(b) || !existsSync(a)) { console.log("missing", name); continue; }
    const lab = (f, t) => ["(", f, "-background", "#0b0e14", "-fill", "#FFD166", "-font", FONT, "-pointsize", "15", "-gravity", "northwest", "-splice", "0x24", "-annotate", "+6+4", t, ")"];
    execFileSync("magick", [...lab(b, "BEFORE"), ...lab(a, "AFTER"), "-background", "#0b0e14", "-append", "-quality", "72", `${OUT}/${name}.webp`]);
    console.log("wrote", `${OUT}/${name}.webp`);
  }
  process.exit(0);
}

const { chromium } = require("playwright");
const PORT = process.env.PORT ?? 3122;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.removeItem("tsi.moveKeys.v1"); localStorage.removeItem("tsi.moveLab.v2"); localStorage.removeItem("tsi.moveLab.v3"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
page.on("console", m => { if (m.type() === "error") console.log("console", m.text().slice(0, 200)); });

let opened = null;
async function open(url) {
  if (url === opened) return;
  opened = url;
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(5000);
}
const LAB = "/lab/move?panel=0&zoom=0.6";
const VILLAGE = "/lab/island?time=day&weather=clear&season=summer&zoom=0.6";
const state = () => page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, mode: s.mode, dashT: s.dashT, dashCd: s.dashCd }; });
const speed = s => Math.hypot(s.vx, s.vz).toFixed(1);
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", FONT, "-pointsize", "12", "-quality", "74", `${TMP}/${name}-${TAG}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${TMP}/${name}-${TAG}.webp`);
};
const pick = (frames, max) => (frames.length <= max ? frames : Array.from({ length: max }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]));
const down = new Set();
const hold = async (keys) => { for (const k of keys) if (!down.has(k)) { await page.keyboard.down(k); down.add(k); } };
const release = async () => { for (const k of down) await page.keyboard.up(k); down.clear(); };

/**
 * Teleport, then drive (a route, or `drive(t, s)` holding keys) with the sim paused between `step`s; shoot from the
 * step where `from(s)` holds until `until(s)` (then `after` more), at most `max` frames spread evenly, cropped round the avatar.
 */
async function strip(name, { url = LAB, at, facing, route, drive, from, until, after = 2, max = 8, step = 0.04, limit = 6, cols = 4, w = 420, h = 320, geometry = "280x213+3+3", label = null }) {
  await open(url);
  await page.evaluate(([x, z, f]) => { window.__move.teleport(x, z, f); window.__move.pause(); }, [at[0], at[1], facing]);
  await page.waitForTimeout(1200);
  if (route) await page.evaluate(r => window.__move.autopilot(r), route);
  const frames = [];
  let t = 0, since = null, left = null, s = await state();
  while (t < limit && left !== 0) {
    if (drive) await drive(t, s);
    await page.evaluate(d => window.__move.run(d), step);
    await page.waitForTimeout(140);
    t += step;
    s = await state();
    if (since === null && !from(s)) continue;
    since ??= t;
    if (left === null && until(s)) left = after + 1;
    if (left !== null) left--;
    const p = await page.evaluate(() => window.__move.screen());
    const clip = { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(40, Math.min(H - h, Math.round(p.y - h * 0.62))), width: w, height: h };
    const file = `${TMP}/${name}-${TAG}-${String(frames.length).padStart(2, "0")}.png`;
    await page.screenshot({ path: file, clip });
    const ground = await page.evaluate(() => window.__move.ground?.() ?? "");
    frames.push({ file, label: `${(t - since).toFixed(2)}s  ${label ? label(s) : `${speed(s)} u/s  ${s.mode}`}${ground ? `  ${ground}` : ""}` });
  }
  await release();
  await page.evaluate(() => window.__move.resume());
  const chosen = pick(frames, max);
  tile(chosen.map(f => f.file), chosen.map(f => f.label), name, cols, geometry);
}

const S = Math.PI / 2;
const MOVES = {
  // Walking across the screen (+x is screen left): the open grass of /lab/move's top stretch, and the village's south beach
  // (web/data/village-map.json) at z = -17.3, dry sand two tiles above the waterline. A foot comes down every half second.
  "footsteps-grass": { at: [-20, 19.5], facing: S, route: [{ to: [-11.5, 19.5] }], from: s => s.x > -18, until: s => s.x > -12.6, after: 0, step: 0.05, max: 12, cols: 4 },
  "footsteps-sand": { url: VILLAGE, at: [-9, -17.3], facing: S, route: [{ to: [6, -17.3] }], from: s => s.x > -7, until: s => s.x > -2.2, after: 0, step: 0.05, max: 12, cols: 4 },
  // A walking jump across the top stretch of /lab/move, side on: anticipation, take-off, rise, apex, fall, the landing (drop 0.95: normal).
  "jump": { at: [-19.5, 21], facing: S, route: [{ to: [-16.5, 21], move: "jump", r: 0.3 }, { to: [-13, 21] }],
    from: s => s.x > -17.25, until: s => s.mode === "ground" && s.x > -15.2, after: 4, step: 0.035, max: 12, label: s => `y ${s.y.toFixed(2)}  vy ${s.vy.toFixed(1)}  ${s.mode}` },
  // A tap of Space standing on the grass: a short hop, a tap landing.
  "land-tap": { at: [-15.5, 0], facing: 0, drive: async (t) => { if (t > 0.1 && t < 0.13) { await page.keyboard.press(" ", { delay: 0 }); } },
    from: s => s.mode === "air", until: s => s.mode === "ground", after: 6, step: 0.035, max: 8, label: s => `y ${s.y.toFixed(2)}  ${s.mode}` },
  // A full standing jump on the grass: the normal landing ring.
  "land-normal": { at: [-15.5, 0], facing: 0, drive: async (t) => { if (t > 0.1 && t < 0.13) await hold([" "]); if (t > 0.5) await release(); },
    from: s => s.mode === "air" && s.vy < 0 && s.y < 0.5, until: s => s.mode === "ground", after: 9, step: 0.035, max: 8, label: s => `y ${s.y.toFixed(2)}  ${s.mode}` },
  // Sneaking off the first plateau's east edge with a jump (1.5 + the jump): a heavy landing, no roll (slow).
  "land-heavy": { at: [12.3, -20], facing: S, drive: async (t, s) => { await hold(["c", "a"]); if (s.x > 13.0 && s.mode === "ground" && s.y > 1) await hold([" "]); },
    from: s => s.mode === "air" && s.vy < 0 && s.y < 1.2, until: s => s.mode === "ground", after: 12, step: 0.04, max: 8, w: 460, h: 340, geometry: "300x222+3+3", label: s => `y ${s.y.toFixed(2)}  ${s.mode}` },
  // Q on the grass from a walk: the anticipation, the burst, streaks and afterimages, the settle, the cooldown and its return.
  "dash": { at: [-15.5, -13], facing: 0, route: [{ to: [-15.5, -11], r: 0.4 }, { to: [-15.5, -2], move: "dash", r: 20 }, { to: [-15.5, -1] }],
    from: s => s.z > -11.3, until: s => s.dashCd <= 0 && s.z > -8.5, after: 3, step: 0.04, max: 12,
    label: s => `${speed(s)} u/s  ${s.dashT > 0 ? "dashing" : s.mode}  cd ${s.dashCd.toFixed(2)}` },
  // Close up and slower: the dash across the screen.
  "dash-closeup": { url: "/lab/move?panel=0&zoom=0.35", at: [-20, 20.5], facing: S, route: [{ to: [-19, 20.5], r: 0.3 }, { to: [-12.5, 20.5], move: "dash", r: 20 }, { to: [-13, 20.5] }],
    from: s => s.x > -19.2, until: s => s.dashCd <= 0, after: 3, step: 0.03, max: 12, cols: 4, w: 560, h: 400, geometry: "373x267+3+3",
    label: s => `${speed(s)} u/s  ${s.dashT > 0 ? "dashing" : s.mode}  cd ${s.dashCd.toFixed(2)}` },
};
for (const [name, move] of Object.entries(MOVES)) if (!ONLY || ONLY.has(name)) await strip(name, move);

if (!ONLY || ONLY.has("combat-marker")) {
  // The ruins (combat demo): one shadow fox held still a few tiles ahead, the mouse aimed at it: the aim marker under it.
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&ruins=1&combat=demo&zoom=0.8`, { waitUntil: "domcontentloaded" });
  opened = null;
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !!window.__combatDev?.screenOf && !!window.__combat?.rt?.kit) ? quiet + 1 : 0; }
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const rt = window.__combat.rt;
    rt.enemies = []; rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null;
    window.__move.teleport(0, -12, 0);
    window.__combatDev.spawn("shadow-fox", 3.2, -8.6, "ev-marker");
    window.__combat.freeze = true;
    for (const e of rt.enemies) e.hp = 9999;
  });
  const files = [];
  for (const [i, wait] of [600, 450, 450].entries()) {
    const p = await page.evaluate(() => { const e = window.__combat.rt.enemies[0]; return window.__combatDev.screenOf(e.x, e.z); });
    await page.mouse.move(p.x, p.y + 10);
    await page.waitForTimeout(wait);
    const file = `${TMP}/marker-${TAG}-${i}.png`;
    await page.screenshot({ path: file, clip: { x: Math.round(p.x - 130), y: Math.round(p.y - 110), width: 260, height: 180 } });
    files.push(file);
  }
  tile(files, ["aim on the fox (2x)", "breathing", "turning"], "combat-marker", 3, "520x360+3+3");
}

if (!ONLY || ONLY.has("village-fps")) {
  // FPS in the village, High, 1280x760: standing, then running a bunny-hop lap of the path (footsteps, take-offs, landings).
  await open("/lab/island?time=day&weather=clear&season=summer");
  const fps = (ms) => page.evaluate(ms => new Promise(done => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(tick); }), ms);
  await page.evaluate(() => window.__move.teleport(0, -16, 0));
  await page.waitForTimeout(1500);
  const still = await fps(4000);
  await page.evaluate(() => window.__move.autopilot([{ to: [0, -12], sprint: true, r: 0.6, move: "hops" }, { to: [0, 4], sprint: true }, { to: [-8, -12], sprint: true }, { to: [0, -15], sprint: true }]));
  await page.waitForTimeout(300);
  const moving = await fps(4000);
  await page.screenshot({ path: `${TMP}/fps-${TAG}.png` });
  const line = `village FPS (${TAG}): standing ${still}, running and hopping ${moving}`;
  console.log(line);
  writeFileSync(`${TMP}/fps-${TAG}.txt`, line + "\n");
  execFileSync("magick", [`${TMP}/fps-${TAG}.png`, "-resize", "640x", "-background", "#0b0e14", "-fill", "#f1ffff", "-font", FONT, "-pointsize", "14", "-gravity", "south", "-splice", "0x26", "-annotate", "+0+4", line, "-quality", "72", `${TMP}/village-fps-${TAG}.webp`]);
}
await browser.close();
