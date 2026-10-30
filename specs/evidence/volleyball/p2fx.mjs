// Volleyball effects (game/volleyball, David's approved plan 2026-10-30): one frame strip per effect from the game
// camera, each timing grade a row for the contact effects. Headless Chromium, muted, against a dev server on PORT with
// the Supabase env blanked. /lab/volleyball's dev hooks: window.__volley (the match: pause, its state) and
// window.__volleyFx (fire an effect, pause and step the effects a 60th of a second at a time).
//   PORT=3472 node specs/evidence/volleyball/p2fx.mjs <out_dir> [effect,effect,...]
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "specs/evidence/volleyball/p2/fx", ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3472, BASE = `http://localhost:${PORT}`;
const TMP = `${OUT}/.frames`;
mkdirSync(TMP, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
await page.goto(`${BASE}/lab/volleyball?seed=7`);
await page.waitForFunction(() => !!window.__volley && !!window.__volleyFx, null, { timeout: 300000 });
await page.waitForTimeout(6000);

/** Hold the match and the effects still; place things; the camera keeps following you. */
const hold = () => page.evaluate(() => { window.__volley.dev.paused = true; window.__volleyFx.dev.paused = true; });
const runMatch = on => page.evaluate(o => { window.__volley.dev.paused = !o; window.__volleyFx.dev.paused = !o; }, on);
const setup = (fn, arg) => page.evaluate(`(() => { const m = window.__volley.match(); const a = ${JSON.stringify(arg ?? null)}; (${fn})(m, a); })()`);
const emit = e => page.evaluate(x => window.__volleyFx.emit(x), e);
const stepFx = async n => { await page.evaluate(k => { window.__volleyFx.dev.steps = k; }, n); await page.waitForFunction(() => window.__volleyFx.dev.steps === 0); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const frame = async (name, clip) => { const p = `${TMP}/${name}.png`; await page.screenshot({ path: p, ...(clip ? { clip } : {}) }); return p; };
/** Frames at these fx-step counts after the event. */
async function frames(tag, at, clip) {
  const out = [];
  let done = 0;
  for (const k of at) { if (k > done) await stepFx(k - done); done = k; out.push(await frame(`${tag}-${k}`, clip)); }
  return out;
}
/** Rows of frames into one strip (each frame scaled to 400 wide), as webp. */
function strip(name, rows) {
  const rowFiles = rows.map((r, i) => { const f = `${TMP}/${name}-row${i}.png`; execFileSync("magick", [...r, "-resize", "400x", "+append", f]); return f; });
  const png = `${TMP}/${name}.png`;
  execFileSync("magick", [...rowFiles, "-append", png]);
  execFileSync("cwebp", ["-quiet", "-q", "82", png, "-o", `${OUT}/${name}.webp`]);
  console.log("strip", `${OUT}/${name}.webp`);
}
const GRADES = ["perfect", "good", "early", "late"];
const CLIP = { x: 160, y: 80, width: 960, height: 640 };

// Stand you near the net facing it (rally), the ball at your hands.
const atNet = `(m, a) => { m.phase = "rally"; const p = m.players[0], side = p.s.z < 0 ? -1 : 1; p.s = { ...p.s, x: 0, z: side * (a?.z ?? 3), y: m.ground(0, side * (a?.z ?? 3)) + (a?.y ?? 0), mode: a?.y ? "air" : "ground", vy: 0, vx: 0, vz: 0 };
  Object.assign(m.ball, { x: side * 0.5, y: p.s.y + (a?.hand ?? 0.8) + 0.25, z: p.s.z - side * 0.55, vx: 0, vy: a?.vy ?? 3, vz: -side * (a?.vz ?? 4), k: 0.7 }); m.rallyTouches = a?.heat ?? 1; }`;
const contactAt = (how, timing, who = 0, team = 0) => page.evaluate(([how, timing, who, team]) => {
  const m = window.__volley.match(), b = m.ball;
  window.__volleyFx.emit({ kind: "contact", who, team, how, timing, quality: { perfect: 1, good: 0.7, early: 0.35, late: 0.35 }[timing], x: b.x, y: b.y, z: b.z, speed: how === "spike" ? 22 : how === "serve" ? 16 : 7 });
}, [how, timing, who, team]);

const FX = {
  async debug() {
    await hold(); await setup(atNet, { z: 4, hand: 0.45 }); await stepFx(2);
    for (const g of ["perfect", "good"]) {
      await contactAt("bump", g); await stepFx(4);
      console.log(g, await page.evaluate(() => { const out = []; window.__volleyFx.scene?.traverse?.(() => {}); return JSON.stringify(window.__volleyFx.probe?.()); }));
      await stepFx(60);
    }
  },
  async bump() { const rows = []; for (const g of GRADES) { await hold(); await setup(atNet, { z: 4, hand: 0.45 }); await stepFx(2); await contactAt("bump", g); rows.push(await frames(`bump-${g}`, [1, 4, 8, 14, 22], CLIP)); await stepFx(60); } strip("bump", rows); },
  async spike() { const rows = []; for (const g of GRADES) { await hold(); await setup(atNet, { z: 1.2, y: 2.05, hand: 0.83, vy: -2, vz: 18 }); await stepFx(2); await contactAt("spike", g); rows.push(await frames(`spike-${g}`, [1, 3, 6, 10, 16], CLIP)); await stepFx(60); } strip("spike", rows); },
  async block() { const rows = []; for (const g of ["perfect", "good", "early"]) { await hold(); await setup(atNet, { z: 0.6, y: 1.8, hand: 0.9, vz: -10 }); await stepFx(2); await page.evaluate(() => { const b = window.__volley.match().ball; b.z = (b.z < 0 ? -1 : 1) * 0.3; }); await contactAt("block", g); rows.push(await frames(`block-${g}`, [1, 4, 8, 14, 22], CLIP)); await stepFx(60); } strip("block", rows); },
  async set() {
    const rows = [];
    for (const g of GRADES) {
      await hold(); await setup(atNet, { z: 3.5, hand: 0.8, vy: 7, vz: 1.5 }); await contactAt("set", g);
      // The ribbon needs the ball moving: run the match for real, a few shots.
      const shots = [];
      await runMatch(true);
      for (let i = 0; i < 5; i++) { await page.waitForTimeout(140); shots.push(await frame(`set-${g}-${i}`, CLIP)); }
      await hold(); rows.push(shots); await stepFx(60);
    }
    strip("set", rows);
  },
  async jumpset() { const rows = []; for (const g of GRADES) { await hold(); await setup(atNet, { z: 2, y: 1.6, hand: 0.8, vy: 6, vz: 1 }); await contactAt("jumpset", g); await runMatch(true); const shots = []; for (let i = 0; i < 5; i++) { await page.waitForTimeout(120); shots.push(await frame(`jumpset-${g}-${i}`, CLIP)); } await hold(); rows.push(shots); await stepFx(60); } strip("jumpset", rows); },
  async serve() {
    const rows = [];
    // The charge: the bar filling (light drawn in), then the max toss.
    await hold();
    await setup(`(m) => { m.phase = "serve"; m.meter = 0.62; }`);
    const charge = await frames("serve-charge", [6, 14, 24, 34], CLIP);
    await setup(`(m) => { m.meter = null; m.phase = "toss"; }`);
    await emit({ kind: "toss", who: 0, power: 1, max: true });
    charge.push((await frames("serve-max", [3], CLIP))[0]);
    rows.push(charge);
    await stepFx(60);
    for (const g of GRADES) { await setup(`(m) => { m.phase = "rally"; const b = m.ball, p = m.players[0], side = p.s.z < 0 ? -1 : 1; Object.assign(b, { x: p.s.x, y: p.s.y + 0.84, z: p.s.z - side * 0.3, vx: 0, vy: 2, vz: -side * 16, k: 0.6 }); }`); await contactAt("serve", g); rows.push(await frames(`serve-${g}`, [1, 3, 6, 10, 16], CLIP)); await stepFx(60); }
    strip("serve", rows);
  },
  async land() {
    const rows = [];
    for (const [tag, speed, heat] of [["slow", 8, 1], ["fast", 22, 3], ["hot", 22, 9]]) {
      await hold(); await setup(atNet, { z: 5 });
      await page.evaluate(([speed, heat]) => { const m = window.__volley.match(), side = m.players[0].s.z < 0 ? -1 : 1; window.__volleyFx.emit({ kind: "land", x: 0.6, z: -side * 3, in: true, speed, heat }); window.__volleyFx.emit({ kind: "point", team: 0, why: "in", x: 0.6, z: -side * 3, heat }); }, [speed, heat]);
      rows.push(await frames(`land-${tag}`, [1, 4, 9, 16, 30, 60], CLIP)); await stepFx(120);
    }
    strip("land", rows);
  },
  async out() { await hold(); await setup(atNet, { z: 5 }); await page.evaluate(() => { const m = window.__volley.match(), side = m.players[0].s.z < 0 ? -1 : 1; window.__volleyFx.emit({ kind: "land", x: 4.9, z: -side * 4, in: false, speed: 10, heat: 1 }); }); strip("out", [await frames("out", [2, 8, 20, 40, 80], CLIP)]); },
  async net() { const rows = []; for (const k of ["net", "tape"]) { await hold(); await setup(atNet, { z: 4 }); await emit({ kind: k, x: 0.5, y: k === "net" ? 1.7 : 2.17 }); rows.push(await frames(`net-${k}`, [1, 5, 10, 18, 28], CLIP)); await stepFx(40); } strip("net", rows); },
  async dive() {
    const rows = [];
    for (const strong of [false, true]) {
      await hold(); await setup(atNet, { z: 4 });
      await setup(`(m, a) => { const p = m.players[0]; p.dive = { t: 0, dx: 1, dz: 0, strong: a, dug: true }; }`, strong);
      await page.evaluate(strong => { const m = window.__volley.match(), p = m.players[0]; window.__volleyFx.emit({ kind: "dive", who: 0, strong, x: p.s.x, z: p.s.z, dx: 1, dz: 0 }); window.__volleyFx.emit({ kind: "contact", who: 0, team: 0, how: "dig", timing: "good", quality: 0.7, x: p.s.x + 0.4, y: p.s.y + 0.36, z: p.s.z, speed: 6 }); }, strong);
      await runMatch(true);
      const shots = [];
      for (let i = 0; i < 5; i++) { await page.waitForTimeout(110); shots.push(await frame(`dive-${strong}-${i}`, CLIP)); }
      await hold(); rows.push(shots); await stepFx(90);
    }
    strip("dive", rows);
  },
  async jump() {
    await hold(); await setup(atNet, { z: 3 });
    await page.evaluate(() => { const p = window.__volley.match().players[0]; window.__volleyFx.emit({ kind: "takeoff", who: 0, x: p.s.x, y: p.s.y, z: p.s.z }); });
    const a = await frames("jump-takeoff", [1, 5, 10], CLIP);
    await setup(atNet, { z: 1.5, y: 2.05, hand: 0.9, vy: -0.5, vz: 1 });
    await stepFx(2);
    a.push(await frame("jump-apex", CLIP));
    strip("jump", [a]);
  },
  async heat() {
    const rows = [];
    for (const heat of [2, 5, 8]) {
      await hold(); await setup(atNet, { z: 6, hand: 1.6, vy: 3, vz: 14, heat });
      await runMatch(true);
      const shots = [];
      for (let i = 0; i < 4; i++) { await page.waitForTimeout(90); shots.push(await frame(`heat-${heat}-${i}`, CLIP)); }
      await hold(); rows.push(shots); await stepFx(90);
    }
    strip("heat", rows);
  },
  async point() { await hold(); await setup(atNet, { z: 5 }); await page.evaluate(() => { const m = window.__volley.match(), side = m.players[0].s.z < 0 ? -1 : 1; window.__volleyFx.emit({ kind: "point", team: 0, why: "in", x: 0, z: -side * 2.5, heat: 2 }); }); strip("point", [await frames("point", [2, 10, 25, 45, 70], CLIP)]); },
  async call() { await hold(); await setup(atNet, { z: 5 }); await emit({ kind: "call", who: 1 }); await emit({ kind: "call", who: 0 }); strip("call", [await frames("call", [1, 4, 8, 14, 22], CLIP)]); },
  async whiff() { await hold(); await setup(atNet, { z: 4 }); await emit({ kind: "whiff", who: 0 }); strip("whiff", [await frames("whiff", [1, 4, 8, 14], CLIP)]); },
  async win() {
    await hold(); await setup(atNet, { z: 5 });
    await setup(`(m) => { m.players[0].s = { ...m.players[0].s, facing: m.players[0].s.facing }; }`);
    await page.evaluate(() => { window.__volley.dev.pitch = 0.45; });
    await emit({ kind: "win", team: 0 });
    strip("win", [await frames("win", [20, 50, 80, 110, 150, 200], { x: 0, y: 0, width: 1280, height: 800 })]);
    await page.evaluate(() => { window.__volley.dev.pitch = null; });
  },
};

for (const [name, fn] of Object.entries(FX)) {
  if (ONLY && !ONLY.split(",").includes(name)) continue;
  try { await fn(); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
if (!process.env.KEEP) rmSync(TMP, { recursive: true, force: true });
await browser.close();
