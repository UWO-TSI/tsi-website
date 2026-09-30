// Movement integration evidence (specs/movement.md step 4): the kit in the village, home island and ruins.
//   PORT=3111 node specs/evidence/move-integrate/shots.mjs <outDir> [only,only2,...]
// Headed Chromium (WebGL), real GPU (metal), muted. Moves are driven by the dev route pilot (__move.autopilot) and shot
// with the movement sim paused between steps (__move.run), so every frame is a known sim time; scenes that need the
// rest of the game running (seats, doors, the ruins) are shot in real time. Frames are tiled into small WebPs.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/move-integrate", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/move-integrate-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const BASE = `http://localhost:${process.env.PORT ?? 3111}/lab/island`;
const DAY = "time=day&weather=clear&season=summer";
const W = 1280, H = 760;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.removeItem("tsi.moveKeys.v1"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
page.on("console", m => { if (m.type() === "error") console.log("console", m.text().slice(0, 200)); });

let opened = null;
async function open(query) {
  opened = query;
  await page.goto(`${BASE}?${DAY}&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 180000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(4000);
}
const state = () => page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, mode: s.mode, hops: s.hops, dashT: s.dashT, dashCd: s.dashCd }; });
const speed = s => Math.hypot(s.vx, s.vz).toFixed(1);
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "12", "-quality", "70", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};
const crop = async (w = 420, h = 320) => {
  const p = await page.evaluate(() => window.__move.screen());
  return { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h, Math.round(p.y - h * 0.62))), width: w, height: h };
};
const pick = (frames, max) => (frames.length <= max ? frames : Array.from({ length: max }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (max - 1))]));

/** Teleport, run a route with the sim paused between steps, shoot from `from(state)` until `until(state)` (then `after` more). */
async function strip(name, { query = "zoom=0.6", at, facing, route, drive, from, until, after = 2, max = 8, step = 0.05, limit = 8, cols = 4, full = false, label = null }) {
  if (query !== opened) await open(query);
  await page.evaluate(([x, z, f]) => { window.__move.teleport(x, z, f); window.__move.pause(); }, [at[0], at[1], facing]);
  await page.waitForTimeout(900);
  if (route) await page.evaluate(r => window.__move.autopilot(r), route);
  const frames = [];
  let t = 0, since = null, left = null;
  while (t < limit && left !== 0) {
    await drive?.(t);
    await page.evaluate(s => window.__move.run(s), step);
    await page.waitForTimeout(full ? 170 : 130);
    t += step;
    const s = await state();
    if (since === null && !from(s)) continue;
    since ??= t;
    if (left === null && until(s)) left = after + 1;
    if (left !== null) left--;
    const cam = await page.evaluate(() => window.__move.camera()), p = await page.evaluate(() => window.__move.screen());
    const file = `${TMP}/${name}-${String(frames.length).padStart(2, "0")}.png`;
    await page.screenshot({ path: file, ...(full ? {} : { clip: await crop() }) });
    const time = `${(t - since).toFixed(2)}s`;
    frames.push({ file, label: `${time}  ${label ? label(s, cam, p) : `${speed(s)} u/s  y ${s.y.toFixed(2)}  ${s.mode}${s.hops ? ` hop ${s.hops}` : ""}`}` });
  }
  await drive?.(-1);
  await page.evaluate(() => window.__move.resume());
  const chosen = pick(frames, max);
  tile(chosen.map(f => f.file), chosen.map(f => f.label), name, cols, full ? "400x238+3+3" : "280x213+3+3");
}

/** Real-time frames of whatever `act` sets going (seats, doors, the ruins): `shots` of [delay ms, label]. */
async function live(name, shots, { cols = 4, w = 420, h = 320, full = false } = {}) {
  const files = [], labels = [];
  for (const [i, [delay, text, before]] of shots.entries()) {
    if (before) await before();
    await page.waitForTimeout(delay);
    const file = `${TMP}/${name}-${i}.png`;
    await page.screenshot({ path: file, ...(full ? {} : { clip: await crop(w, h) }) });
    files.push(file); labels.push(typeof text === "function" ? await text() : text);
  }
  tile(files, labels, name, cols, full ? "400x238+3+3" : `${Math.round(w * 0.667)}x${Math.round(h * 0.667)}+3+3`);
}
const key = (k, ms = 80) => async () => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
const S = Math.PI / 2;
// The live village (web/data/village-map.json): the main path runs up the screen at x = 0 from the south shore (z = -19) to the clubhouse door (0, 6.3).
const LANE = { at: [0, -18.5], facing: 0 };
const MOVES = {
  "village-sprint": { ...LANE, route: [{ to: [0, 5], sprint: true }], from: s => s.z > -18, until: s => s.z > -4, after: 0, step: 0.12, max: 8 },
  "village-bunny-hop": { ...LANE, route: [{ to: [0, -10], sprint: true, r: 0.6, move: "hops" }, { to: [0, 5], sprint: true }], from: s => s.z > -10.4, until: s => s.z > 4, after: 0, step: 0.1, max: 8 },
  "village-dash": { at: [0, -12], facing: 0, route: [{ to: [0, -10], r: 0.4 }, { to: [0, 2], move: "dash", r: 20 }, { to: [0, 3] }],
    from: s => s.z > -10.4, until: s => s.dashCd <= 0 && s.z > -7.5, after: 2, step: 0.04, max: 12,
    label: s => `${speed(s)} u/s  ${s.dashT > 0 ? "dashing" : s.mode}  cooldown ${s.dashCd.toFixed(2)}s` },
  // Rock-0 (-19, -7, scale 1.3, top 0.79; the village has no cliffs): a full jump clears it, so push into it (A: +x, screen
  // left) and tap Space for a short hop that catches the lip and mantles up.
  "village-mantle": { at: [-20.6, -7], facing: S, drive: async t => {
    if (t === 0) await page.keyboard.down("a");
    if (Math.abs(t - 0.16) < 0.01) await page.keyboard.press(" ", { delay: 0 });
    if (t < 0) await page.keyboard.up("a");
  }, from: s => s.x > -20.5, until: s => s.mode === "ground" && s.y > 0.6, after: 2, step: 0.04, max: 10 },
  // The whole view every 0.2 s bunny-hopping up the path: the avatar holds its place on screen, the camera neither lags nor bobs.
  "camera-top-speed": { ...LANE, query: "", route: [{ to: [0, -10], sprint: true, r: 0.6, move: "hops" }, { to: [0, 5], sprint: true }], full: true,
    from: s => s.z > -9, until: s => s.z > 4, after: 0, step: 0.2, max: 6, cols: 3,
    label: (s, cam, p) => `${speed(s)} u/s  on screen ${Math.round(p.x)},${Math.round(p.y)}  cam ${(s.z - cam[2]).toFixed(1)}u back, y ${cam[1].toFixed(2)}` },
};
for (const [name, move] of Object.entries(MOVES)) if (!ONLY || ONLY.has(name)) await strip(name, move);

if (!ONLY || ONLY.has("village-bench")) {
  // Bench-0 (-6, -8) faces +z: walk up from its front, E sits (the prompt, the settle ♪), W gets up into the open and walks off.
  await open("zoom=0.6");
  await page.evaluate(() => window.__move.teleport(-6, -6.9, Math.PI));
  const prompt = async () => (await page.locator("button", { hasText: "Sit on the bench" }).count()) ? "E  Sit on the bench" : "(no prompt)";
  await live("village-bench", [
    [700, prompt],
    [500, "E: sits, the settle note", key("e")],
    [1400, "seated"],
    [120, "W: gets up in front", async () => { await page.keyboard.down("w"); }],
    [260, "walks off", async () => {}],
    [300, async () => { await page.keyboard.up("w"); return prompt(); }],
  ], { cols: 3 });
}

if (!ONLY || ONLY.has("village-door")) {
  // Up to the Oracle temple's door (the clubhouse door is chapter 1's "Claim your plot" without a backend): the prompt, E, the fade, inside.
  await open("zoom=0.8");
  await page.evaluate(() => window.__move.teleport(-11, 3.8, 0));
  await live("village-door", [
    [350, "walking to the door", async () => { await page.keyboard.down("w"); }],
    [500, async () => { await page.keyboard.up("w"); return (await page.locator("button", { hasText: "Enter the Oracle temple" }).count()) ? "E  Enter the Oracle temple" : "(no prompt)"; }],
    [250, "E: the fade", key("e")],
    [2500, "inside the temple"],
  ], { full: true, cols: 2 });
}

if (!ONLY || ONLY.has("home-island")) {
  // The home island: a sprint and a jump along the south shore (x = -7 → 7 at z = -7; +x is screen left).
  await strip("home-island", { query: "home=1&zoom=0.7", at: [-7, -7], facing: S, route: [{ to: [-4, -7], sprint: true, r: 0.4 }, { to: [-1.5, -7], sprint: true, move: "jump", r: 0.35 }, { to: [6, -7], sprint: true }],
    from: s => s.x > -4.4, until: s => s.mode === "ground" && s.x > 2, after: 1, step: 0.06, max: 8 });
}

if (!ONLY || ONLY.has("ruins-dodge")) {
  // A shadow fox (-3, -9) in the outer wild: stand in front of it, and when its lunge winds up, Q dash-dodges through it.
  await open("ruins=1&zoom=0.8");
  await page.evaluate(() => { window.__move.teleport(-3, -12, 0); });
  const fox = () => page.evaluate(() => { const e = window.__combat.rt.enemies.find(x => x.id === "shadow-fox-5"); const p = window.__combat.rt.player; return { state: e.state, t: e.t, hp: p.hp, dodge: p.dodgeAge, floaters: window.__combat.rt.floaters.map(f => f.text) }; });
  for (let i = 0; i < 200; i++) { const f = await fox(); if (f.state === "windup" && f.t > 0.25) break; await page.waitForTimeout(25); }
  const hp0 = (await fox()).hp;
  const files = [], labels = [], t0 = Date.now();
  await page.keyboard.press("q");
  for (let i = 0; i < 9; i++) {
    const f = await fox(), file = `${TMP}/ruins-dodge-${i}.png`;
    await page.screenshot({ path: file, clip: await crop(460, 340) });
    files.push(file);
    labels.push(`${((Date.now() - t0) / 1000).toFixed(2)}s  fox ${f.state}  dodge ${f.dodge === null ? "-" : f.dodge.toFixed(2)}  hp ${f.hp}/${hp0}${f.floaters.includes("Dodged") ? "  Dodged" : ""}`);
    await page.waitForTimeout(40);
  }
  tile(files, labels, "ruins-dodge", 3, "307x227+3+3");
}

if (!ONLY || ONLY.has("settings-keys")) {
  // The Settings sheet's movement keys row, and the controls hint that follows a remap (Jump to G here, then back).
  await open("");
  await page.locator("button", { hasText: "Settings · text, contrast, keys" }).click({ force: true });
  const sheet = page.locator('[data-testid="settings-sheet"]');
  await sheet.locator("legend", { hasText: "Movement keys" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await sheet.boundingBox();
  await page.screenshot({ path: `${TMP}/settings.png`, clip: box });
  const jump = sheet.locator("li", { hasText: "Jump" }).locator("button");
  await jump.click(); await page.keyboard.press("g"); await page.waitForTimeout(300);
  await page.screenshot({ path: `${TMP}/settings-g.png`, clip: box });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.screenshot({ path: `${TMP}/controls.png`, clip: { x: 0, y: H - 70, width: W, height: 70 } });
  execFileSync("magick", [`${TMP}/settings.png`, `${TMP}/settings-g.png`, "-background", "#0b0e14", "-gravity", "north", "+append", `${TMP}/settings-pair.png`]);
  execFileSync("magick", [`${TMP}/settings-pair.png`, `${TMP}/controls.png`, "-background", "#0b0e14", "-gravity", "center", "-append", "-resize", "1100x>", "-quality", "72", `${OUT}/settings-keys.webp`]);
  console.log("wrote", `${OUT}/settings-keys.webp`);
}

if (!ONLY || ONLY.has("touch")) {
  // ?touch=1 shows the touch controls on a desktop: push the stick up (walk), to its rim (run), and tap Jump.
  await open("touch=1");
  const stick = await page.locator('[data-testid="touch-stick"]').boundingBox(), cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
  await live("touch", [
    [200, "the stick and the jump and dash buttons"],
    [700, "stick half up: walk", async () => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy - stick.height * 0.25, { steps: 4 }); }],
    [700, "stick to the rim: run", async () => { await page.mouse.move(cx, cy - stick.height * 0.5, { steps: 4 }); }],
    [180, "Jump", async () => { await page.locator('button[aria-label="Jump"]').dispatchEvent("pointerdown"); await page.locator('button[aria-label="Jump"]').dispatchEvent("pointerup"); }],
  ], { full: true, cols: 2 });
  await page.mouse.up();
}

if (!ONLY || ONLY.has("fps")) {
  await open("");
  await page.locator("summary", { hasText: "Performance" }).click({ force: true });
  await page.waitForTimeout(5000);
  const samples = [];
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(1100); samples.push(await page.locator("details output").first().innerText()); }
  console.log("village FPS samples:", samples.map(s => s.split("\n")[0]).join(" | "));
}
await browser.close();
