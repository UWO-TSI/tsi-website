// Movement feel milestone 2 evidence (specs/movement-feel.md): slow-motion strips of the skid, the mantle, the glide
// (opening, ribbons, set-down), splashes small and big, the landing roll, a dash away from the camera (the
// afterimage), residents' footstep dust (the dev crowd strolling), before and after; and after only: footprints on
// sand, wet sand and snow, and walk, run and crouch-walk handing over in step.
//   PORT=3125 node specs/evidence/movement-feel-2/shots.mjs <tag> [only,only2,...]
// <tag> "before" or "after" writes /tmp/movement-feel-2/<name>-<tag>.webp; "pair" stacks before over after into
// specs/evidence/movement-feel-2/<name>.webp (after-only moves are copied as they are). Headed Chromium, metal, muted;
// the sim paused between steps (__move.run), so every frame is a known sim time.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const OUT = "specs/evidence/movement-feel-2";
const TMP = "/tmp/movement-feel-2";
const [TAG = "after", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const FONT = "/System/Library/Fonts/Monaco.ttf";
const W = 1280, H = 760;
const PAIRED = ["skid", "mantle", "glide-open", "glide-ribbons", "glide-set-down", "splash-small", "splash-big", "roll", "dash-away", "residents"];
const AFTER_ONLY = ["footprints-sand", "footprints-wet-sand", "footprints-snow", "walk-run-handover"];

if (TAG === "pair") {
  for (const name of ONLY ?? [...PAIRED, ...AFTER_ONLY]) {
    const [b, a] = [`${TMP}/${name}-before.webp`, `${TMP}/${name}-after.webp`];
    if (!existsSync(a)) { console.log("missing", name); continue; }
    if (!existsSync(b)) { copyFileSync(a, `${OUT}/${name}.webp`); console.log("wrote", `${OUT}/${name}.webp`, "(after only)"); continue; }
    const lab = (f, t) => ["(", f, "-background", "#0b0e14", "-fill", "#FFD166", "-font", FONT, "-pointsize", "15", "-gravity", "northwest", "-splice", "0x24", "-annotate", "+6+4", t, ")"];
    execFileSync("magick", [...lab(b, "BEFORE"), ...lab(a, "AFTER"), "-background", "#0b0e14", "-append", "-quality", "72", `${OUT}/${name}.webp`]);
    console.log("wrote", `${OUT}/${name}.webp`);
  }
  process.exit(0);
}
for (const f of readdirSync(TMP)) if (f.endsWith(".png")) rmSync(`${TMP}/${f}`);

const { chromium } = require("playwright");
const PORT = process.env.PORT ?? 3125;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.removeItem("tsi.moveKeys.v1"); for (const v of [2, 3, 4]) localStorage.removeItem(`tsi.moveLab.v${v}`); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));

let opened = null;
async function open(url) {
  if (url === opened) return;
  opened = url;
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent === "Back to start"); if (b?.parentElement) b.parentElement.style.display = "none"; });
}
const LAB = "/lab/move?panel=0&zoom=0.6";
const VILLAGE = "/lab/island?time=day&weather=clear&season=summer&zoom=0.6";
const state = () => page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, mode: s.mode, modeT: s.modeT, dashT: s.dashT, events: s.events.map(e => e.kind) }; });
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", FONT, "-pointsize", "12", "-quality", "74", `${TMP}/${name}-${TAG}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${TMP}/${name}-${TAG}.webp`, files.length, "frames");
};
const pick = (frames, max) => (frames.length <= max ? frames : Array.from({ length: max }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]));
const label = s => `${Math.hypot(s.vx, s.vz).toFixed(1)} u/s  ${s.dashT > 0 ? "dash" : s.mode}${s.events.length ? "  " + s.events.join(",") : ""}`;

async function strip(name, { url = LAB, at, facing, route, from, until, after = 2, max = 8, step = 0.04, limit = 8, cols = 4, w = 420, h = 320, geometry = "280x213+3+3", warm = 1.5, fixed = null, count = false }) {
  await open(url);
  await page.evaluate(([x, z, f]) => { window.__move.teleport(x, z, f); window.__move.pause(); }, [at[0], at[1], facing]);
  await page.waitForTimeout(1500);
  if (route) await page.evaluate(r => window.__move.autopilot(r), route);
  if (!route) { await page.evaluate(() => window.__move.resume()); await page.waitForTimeout(warm * 1000); await page.evaluate(() => window.__move.pause()); }
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
    const clip = fixed ?? { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(40, Math.min(H - h, Math.round(p.y - h * 0.62))), width: w, height: h };
    const file = `${TMP}/${name}-${TAG}-${String(frames.length).padStart(3, "0")}.png`;
    await page.screenshot({ path: file, clip });
    const ground = await page.evaluate(() => window.__move.ground?.() ?? "");
    // With the player standing still, the scene's live particles are other walkers' steps (the residents' dust).
    const fx = count ? await page.evaluate(() => `  particles ${window.__move.particles()}`) : "";
    frames.push({ file, label: `${(t - since).toFixed(2)}s  ${label(s)}${ground ? `  ${ground}` : ""}${fx}` });
  }
  await page.evaluate(() => window.__move.resume());
  const chosen = pick(frames, max);
  tile(chosen.map(f => f.file), chosen.map(f => f.label), name, cols, geometry);
}

const S = Math.PI / 2;
const MOVES = {
  // Sprinting along the slide lane's apron, side on, then hard back the other way: the skid, its scuffs and the push-off.
  "skid": { at: [-7, 25.5], facing: S, route: [{ to: [3, 25.5], sprint: true, r: 0.4 }, { to: [-8, 25.5], sprint: true }], from: s => s.events.includes("skid") || s.mode === "skid", until: s => s.mode === "ground" && s.modeT > 0.25, after: 2, step: 0.035, max: 12 },
  // Jumping into the lap's first cliff (side on, moving screen right): hands on the lip, the pull-up, the step onto the top.
  "mantle": { at: [17.5, -20], facing: -S, route: [{ to: [15.5, -20], sprint: true, r: 0.5 }, { to: [14.25, -20], move: "mantle", r: 0.15 }, { to: [11, -22.5], r: 0.5 }], from: s => s.mode === "air", until: s => s.mode === "ground" && s.y > 1.4 && s.modeT > 0.15, after: 2, step: 0.03, max: 12 },
  // The glide lane: off the tower, the leaf opens (leaf bits, the air pushed down), ribbons at speed, the set-down.
  "glide-open": { url: "/lab/move?panel=0&zoom=0.8", at: [-18, 26], facing: 0, route: [{ to: [-18, 28.15], move: "glide", r: 0.2 }, { to: [-18, 42], r: 0.5 }], from: s => s.mode === "air" && s.vy < 1, until: s => s.mode === "glide" && s.modeT > 0.35, after: 0, step: 0.035, max: 8, w: 460, h: 380, geometry: "300x248+3+3" },
  "glide-ribbons": { url: "/lab/move?panel=0&zoom=0.8", at: [-18, 26], facing: 0, route: [{ to: [-18, 28.15], move: "glide-gust", r: 0.2 }, { to: [-18, 42], r: 0.5 }], from: s => s.mode === "glide" && s.modeT > 0.45, until: s => s.mode === "glide" && s.modeT > 1.1, after: 0, step: 0.06, max: 8, w: 460, h: 380, geometry: "300x248+3+3" },
  "glide-set-down": { url: "/lab/move?panel=0&zoom=0.8", at: [-18, 26], facing: 0, route: [{ to: [-18, 28.15], move: "glide", r: 0.2 }, { to: [-18, 42], r: 0.5 }], from: s => s.mode === "glide" && s.y < 0.6, until: s => s.mode === "ground" && s.modeT > 0.3, after: 2, step: 0.04, max: 8, w: 460, h: 380, geometry: "300x248+3+3" },
  // A walking jump into the 4-tile river (side on): a small splash; then a sprint's slide-jump short of the slide lane's gap, off 1.5u: a big one.
  "splash-small": { at: [5.5, 21], facing: S, route: [{ to: [7.25, 21], move: "jump", r: 0.3 }, { to: [12, 21] }], from: s => s.mode === "air" && s.vy < 0, until: s => s.mode === "ground", after: 0, step: 0.04, max: 10 },
  "splash-big": { url: "/lab/move?panel=0&zoom=0.8", at: [17.5, 25.5], facing: 0, route: [{ to: [17.5, 27.5], sprint: true }, { to: [17.5, 38], sprint: true }, { to: [17.5, 44.2], sprint: true, crouch: true, move: "jump", r: 0.35 }, { to: [17.5, 56] }],
    from: s => s.mode === "air" && s.z > 47.5, until: s => s.mode === "ground", after: 0, step: 0.04, max: 10, w: 460, h: 380, geometry: "300x248+3+3" },
  // Sprinting off the lap's second level (3u down): the land, the roll's tumbles and trail, popping up.
  "roll": { at: [5.5, -21], facing: -S, route: [{ to: [-4, -21], sprint: true, r: 0.8 }, { to: [-6, -21], r: 0.3 }], from: s => s.mode === "air" && s.y < 1.6, until: s => s.mode === "ground" && s.modeT > 0.2 && s.y < 0.1, after: 1, step: 0.03, max: 12 },
  // Q up the sprint lane, away from the camera, close: the afterimages left behind must not film over the character.
  "dash-away": { url: "/lab/move?panel=0&zoom=0.45", at: [-15.5, -13], facing: 0, route: [{ to: [-15.5, -11], r: 0.4 }, { to: [-15.5, -2], move: "dash", r: 20 }, { to: [-15.5, -1] }], from: s => s.dashT > 0, until: s => s.dashT <= 0, after: 3, step: 0.025, max: 8, w: 460, h: 420, geometry: "300x274+3+3" },
  // The dev crowd (?crowd=4&stroll=1) strolling on the village beach ahead of the camera: residents' footstep dust and prints in the sand (before: none).
  "residents": { url: "/lab/island?time=day&weather=clear&season=summer&crowd=4&stroll=1&zoom=0.55&at=0,-14.5", at: [0, -20], facing: 0, route: null, from: () => true, until: () => false, after: 0, step: 0.3, limit: 1.85, max: 6, cols: 2, fixed: { x: 280, y: 110, width: 800, height: 320 }, geometry: "600x240+3+3", warm: 6, count: true },
};
const AFTER = {
  // Walking down the lab's sand strip toward the camera: the prints trail behind, up the screen.
  "footprints-sand": { at: [-18.5, 8], facing: Math.PI, route: [{ to: [-18.5, -1] }], from: s => s.z < 6, until: s => s.mode === "ground" && Math.hypot(s.vx, s.vz) < 0.05, after: 5, step: 0.25, limit: 6, max: 8, w: 420, h: 460, geometry: "280x307+3+3" },
  "footprints-wet-sand": { url: VILLAGE, at: [-6.5, -19.2], facing: S, route: [{ to: [2.5, -19.2] }], from: s => s.x > -4.5, until: s => s.mode === "ground" && Math.hypot(s.vx, s.vz) < 0.05, after: 5, step: 0.25, limit: 6, max: 8, w: 560, h: 360, geometry: "350x225+3+3" },
  "footprints-snow": { url: "/lab/island?time=day&weather=clear&season=winter&zoom=0.6", at: [-6, -13], facing: S, route: [{ to: [3, -13] }], from: s => s.x > -3.5, until: s => s.mode === "ground" && Math.hypot(s.vx, s.vz) < 0.05, after: 5, step: 0.25, limit: 6, max: 8, w: 560, h: 360, geometry: "350x225+3+3" },
  // A walk building into a run on the apron, side on: the run picks up the step where the walk left it.
  "walk-run-handover": { at: [-7, 25.5], facing: S, route: [{ to: [-3, 25.5], r: 0.3 }, { to: [12, 25.5], sprint: true }], from: s => s.x > -4.2, until: s => s.x > 4.5, after: 0, step: 0.05, max: 16, cols: 4 },
};
for (const [name, move] of Object.entries(MOVES)) if (!ONLY || ONLY.has(name)) await strip(name, move);
if (TAG === "after") for (const [name, move] of Object.entries(AFTER)) if (!ONLY || ONLY.has(name)) await strip(name, move);
await browser.close();
