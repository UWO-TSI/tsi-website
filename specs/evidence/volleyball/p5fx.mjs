// Volleyball round 5 (game/volleyball; before: p4fx.mjs and p4/): the call tag's three directions on one sheet, the
// block's tag in each, the perfect spike's impact frame with and without round 4's lines, the dive's white blink, and
// `checks` (real time: the impact frame's frames, no impact on a dig, the blink held then given back, none calm).
// Headless Chromium, muted, against a dev server on PORT with the Supabase env blanked (vbrun.sh).
//   PORT=3472 node specs/evidence/volleyball/p5fx.mjs <out_dir> [calls,block,spike,dive,showroom,checks]
// The HUD's calls are CSS animations: each frame pins every running animation to the frame's time after the event.
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "specs/evidence/volleyball/p5", ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3472, BASE = `http://localhost:${PORT}`;
const TMP = `${OUT}/.frames`, FONT = "/System/Library/Fonts/Supplemental/Arial.ttf";
mkdirSync(TMP, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
const want = n => !ONLY || ONLY.split(",").includes(n);
if (["calls", "block", "spike", "dive", "checks"].some(want)) {
  await page.goto(`${BASE}/lab/volleyball?seed=7`);
  await page.waitForFunction(() => !!window.__volley && !!window.__volleyFx, null, { timeout: 300000 });
  await page.addStyleTag({ content: "nav, nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(6000);
}

const hold = () => page.evaluate(() => { window.__volley.dev.paused = true; window.__volleyFx.dev.paused = true; for (const a of document.getAnimations()) try { a.finish(); } catch { /* infinite */ } });
const runMatch = on => page.evaluate(o => { window.__volley.dev.paused = !o; window.__volleyFx.dev.paused = !o; }, on);
const setup = (fn, arg) => page.evaluate(`(() => { const m = window.__volley.match(); const a = ${JSON.stringify(arg ?? null)}; (${fn})(m, a); })()`);
const emit = e => page.evaluate(x => window.__volleyFx.emit(x), e);
const devFx = o => page.evaluate(o => Object.assign(window.__volleyFx.dev, o), o);
const stepFx = async n => { await page.evaluate(k => { window.__volleyFx.dev.steps = k; }, n); await page.waitForFunction(() => window.__volleyFx.dev.steps === 0); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const frame = async (name, clip) => { const p = `${TMP}/${name}.png`; await page.screenshot({ path: p, ...(clip ? { clip } : {}) }); return p; };
const cssAt = ms => page.evaluate(t => { for (const a of document.getAnimations()) if (a.playState !== "finished") { a.pause(); a.currentTime = t; } }, ms);
const cssRun = () => page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
async function frames(tag, at, clip) {
  const out = [];
  let done = 0;
  for (const k of at) { if (k > done) await stepFx(k - done); done = k; await cssAt((k / 60) * 1000); out.push(await frame(`${tag}-${k}`, typeof clip === "function" ? await clip() : clip)); }
  await cssRun();
  return out;
}
const label = (text, w, h = 34, size = 18) => { const f = `${TMP}/label-${text.replace(/\W+/g, "_")}-${w}.png`; execFileSync("magick", ["-size", `${w}x${h}`, "xc:white", "-font", FONT, "-fill", "#151515", "-gravity", "center", "-pointsize", String(size), "-annotate", "0", text, f]); return f; };
/** Rows of frames into one image (each frame scaled to `w` wide), a label on the left of each row; webp or png. */
function sheet(name, rows, w = 400, labels = [], ext = "webp") {
  const rowFiles = rows.map((r, i) => {
    const f = `${TMP}/${name}-row${i}.png`;
    execFileSync("magick", [...r, "-resize", `${w}x`, "-bordercolor", "white", "-border", "3", "+append", f]);
    if (!labels[i]) return f;
    const h = Number(execFileSync("magick", ["identify", "-format", "%h", f]).toString());
    execFileSync("magick", [label(labels[i], 150, h, 17), f, "+append", f]);
    return f;
  });
  const png = `${TMP}/${name}.png`;
  execFileSync("magick", [...rowFiles, "-background", "white", "-append", "+repage", png]);
  if (ext === "webp") execFileSync("cwebp", ["-quiet", "-q", "85", png, "-o", `${OUT}/${name}.webp`]);
  else execFileSync("magick", [png, `${OUT}/${name}.png`]);
  console.log("sheet", `${OUT}/${name}.${ext}`);
}
const CLIP = { x: 160, y: 80, width: 960, height: 640 };
const LOOKS = ["chip", "bubble", "letters"], NAMES = { chip: "A  Chip", bubble: "B  Bubble", letters: "C  Letters" };

// Stand you near the net facing it (rally), the ball at your hands.
const atNet = `(m, a) => { m.phase = "rally"; const p = m.players[0], side = p.s.z < 0 ? -1 : 1; p.s = { ...p.s, x: 0, z: side * (a?.z ?? 3), y: m.ground(0, side * (a?.z ?? 3)) + (a?.y ?? 0), mode: a?.y ? "air" : "ground", vy: 0, vx: 0, vz: 0 };
  Object.assign(m.ball, { x: side * 0.5, y: p.s.y + (a?.hand ?? 0.8) + 0.25, z: p.s.z - side * 0.55, vx: 0, vy: a?.vy ?? 3, vz: -side * (a?.vz ?? 4), k: 0.7 }); m.rallyTouches = a?.heat ?? 1; }`;
const contactAt = (how, timing, who = 0, team = 0) => page.evaluate(([how, timing, who, team]) => {
  const m = window.__volley.match(), b = m.ball;
  window.__volleyFx.emit({ kind: "contact", who, team, how, timing, quality: { perfect: 1, good: 0.7, early: 0.35, late: 0.35 }[timing], x: b.x, y: b.y, z: b.z, speed: how === "spike" ? 22 : how === "serve" ? 16 : 7 });
}, [how, timing, who, team]);
/** A crop of `w` × `h` centred on the call tag (or the view's middle). */
const aroundTag = (w, h) => async () => {
  const r = await page.evaluate(() => { const el = document.querySelector("[data-look]"); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  const c = r ?? { x: 640, y: 300 };
  return { x: Math.round(Math.min(1280 - w, Math.max(0, c.x - w / 2))), y: Math.round(Math.min(800 - h, Math.max(0, c.y - h * 0.6))), width: w, height: h };
};

// Each call, set up and fired: [name, setup arg, fire].
const CALLS = [
  ["Perfect", { z: 1.2, y: 1.75, hand: 0.83, vy: -2, vz: 18 }, () => contactAt("spike", "perfect")],
  ["Good", { z: 4, hand: 0.45 }, () => contactAt("bump", "good")],
  ["Early", { z: 4, hand: 0.45 }, () => contactAt("bump", "early")],
  ["Block", { z: 0.6, y: 1.8, hand: 0.9, vz: -10 }, () => contactAt("block", "good")],
  ["Saved", { z: 4, hand: 0.3 }, () => contactAt("dig", "good", 1, 0)],
  ["Miss", { z: 4 }, () => emit({ kind: "whiff", who: 0 })],
  ["Max", { z: 5 }, () => emit({ kind: "toss", who: 0, power: 1, max: true })],
];

const FX = {
  /** The sheet: a column per direction, a row per call, each a crop round the tag at rest; a whole view on top. */
  async calls() {
    const cols = {};
    for (const look of LOOKS) {
      await devFx({ tag: look });
      cols[look] = [];
      for (const [name, arg, fire] of CALLS) {
        await hold(); await setup(atNet, arg); await stepFx(2); await fire();
        const [f] = await frames(`calls-${look}-${name}`, [20], aroundTag(360, 180));
        cols[look].push(f);
        if (name === "Perfect") cols[look].whole = (await frames(`calls-${look}-whole`, [20], CLIP))[0];
        await stepFx(70);
      }
    }
    await devFx({ tag: null });
    const rows = [LOOKS.map(l => label(NAMES[l], 360, 40, 20)), LOOKS.map(l => cols[l].whole), ...CALLS.map((_, i) => LOOKS.map(l => cols[l][i]))];
    sheet("p5-calls", rows, 360, ["", "In view", ...CALLS.map(c => c[0])], "png");
  },
  /** The block's tag in each direction, played: frames 1 to 40 after the touch. */
  async block() {
    const rows = [];
    for (const look of LOOKS) {
      await devFx({ tag: look });
      await hold(); await setup(atNet, { z: 0.6, y: 1.8, hand: 0.9, vz: -10 }); await stepFx(2);
      await page.evaluate(() => { const b = window.__volley.match().ball; b.z = (b.z < 0 ? -1 : 1) * 0.3; });
      await contactAt("block", "good");
      rows.push(await frames(`block-${look}`, [1, 3, 6, 10, 16, 30, 46], aroundTag(480, 300)));
      await stepFx(60);
    }
    await devFx({ tag: null });
    sheet("p5-fx-block", rows, 300, LOOKS.map(l => NAMES[l]));
  },
  /** The perfect spike: round 4's lines (with) over round 5 (without), the impact frame first. */
  async spike() {
    const rows = [];
    for (const lines of [true, false]) {
      await devFx({ lines });
      await hold(); await setup(atNet, { z: 1.2, y: 1.75, hand: 0.83, vy: -2, vz: 18 }); await stepFx(2);
      await contactAt("spike", "perfect");
      rows.push(await frames(`spike-${lines}`, [1, 2, 4, 8, 14], CLIP));
      await stepFx(90);
    }
    await devFx({ lines: false });
    sheet("p5-impact-spike", rows, 400, ["With lines (r4)", "Without (r5)"]);
  },
  /** Your dive's dig: the diving body white for a beat (BLINK, 8 rendered frames), then itself; no impact frame. */
  async dive() {
    await hold(); await setup(atNet, { z: 4 });
    await setup(`(m) => { const p = m.players[0]; p.dive = { t: 0, dx: 1, dz: 0, onBall: true, dug: true }; }`);
    await page.evaluate(() => { const m = window.__volley.match(), p = m.players[0]; window.__volleyFx.emit({ kind: "dive", who: 0, onBall: true, x: p.s.x, z: p.s.z, dx: 1, dz: 0 }); });
    await runMatch(true); await page.waitForTimeout(170); await hold();
    const before = await frame("dive-0", CLIP);
    await page.evaluate(() => { const m = window.__volley.match(), p = m.players[0], b = m.ball; Object.assign(b, { x: p.s.x + 0.45, y: p.s.y + 0.4, z: p.s.z, vx: 0, vy: 6, vz: 0 }); window.__volleyFx.emit({ kind: "contact", who: 0, team: 0, how: "dig", timing: "good", quality: 0.7, x: b.x, y: b.y, z: b.z, speed: 6 }); });
    const shots = await frames("dive-dig", [1, 4, 7, 9, 12, 20], CLIP);
    // Frames 0 (before the dig), 1, 4, 7 (white), 9, 12, 20 (itself again); under them a close crop round the diver.
    const close = [before, ...shots].map(f => { const c = f.replace(".png", "-close.png"); execFileSync("magick", [f, "-crop", "400x320+170+250", "+repage", c]); return c; });
    sheet("p5-impact-dive", [[before, ...shots], close], 300, ["Dig", "Close"]);
    await stepFx(90);
  },
};

/** Real time: the spike's impact frame holds one frame; a dig shows none and blinks you white, then gives it back; calm none. */
FX.checks = async () => {
  const watch = (how, timing = "perfect") => page.evaluate(([how, timing]) => new Promise(res => {
    const m = window.__volley.match(), b = m.ball, el = document.querySelector("[class*=impact]");
    let frames = 0, run = 0, best = 0, shown = 0, blink = 0, blinkFrames = 0;
    window.__volleyFx.emit({ kind: "contact", who: 0, team: 0, how, timing, quality: 1, x: b.x, y: b.y, z: b.z, speed: 20 });
    const tick = () => {
      const on = el?.dataset.on !== undefined, k = window.__volleyFx.probe().blink;
      run = on ? run + 1 : 0; best = Math.max(best, run); shown += on ? 1 : 0; blink = Math.max(blink, k); blinkFrames += k ? 1 : 0;
      if (++frames < 40) requestAnimationFrame(tick); else res({ shown, longest: best, blink, blinkFrames, after: window.__volleyFx.probe().blink, cam: { ...window.__volleyFx.cam }, paused: window.__volleyFx.dev.paused });
    };
    requestAnimationFrame(tick);
  }), [how, timing]);
  const out = {};
  await hold(); await setup(atNet, { z: 1.2, y: 1.75, hand: 0.83, vy: -2, vz: 18 }); await runMatch(true);
  await page.waitForTimeout(1500);
  out.spike = await watch("spike");
  out.backToBack = await watch("spike");
  await page.waitForTimeout(1500);
  out.dig = await watch("dig", "good");
  await hold();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { try { localStorage.removeItem("tsi.reduceFlashing.v1"); } catch {} });
  await runMatch(true); await page.waitForTimeout(1500);
  out.reducedSpike = await watch("spike");
  out.reducedDig = await watch("dig", "good");
  await hold(); await page.emulateMedia({ reducedMotion: "no-preference" });
  const pass = out.spike.longest === 1 && out.dig.shown === 0 && out.dig.blink > 0 && out.dig.blinkFrames >= 4 && out.dig.blinkFrames <= 12 && out.dig.after === 0
    && out.backToBack.shown === 0 && out.reducedSpike.shown === 0 && out.reducedDig.blink === 0;
  console.log("checks", JSON.stringify(out), pass ? "PASS" : "FAIL");
  writeFileSync(`${OUT}/checks.json`, JSON.stringify({ pass, ...out }, null, 1));
};

/** The kit's showroom: the three directions, every call (last: it leaves the match). */
FX.showroom = async () => {
  const gui = await ctx.newPage();
  await gui.goto(`${BASE}/lab/gui#call-tag`);
  await gui.addStyleTag({ content: "nav, nextjs-portal { display: none !important; }" });
  const sec = gui.locator("#call-tag");
  await sec.waitFor({ timeout: 300000 }); await sec.scrollIntoViewIfNeeded(); await gui.waitForTimeout(8000);
  // The played row held a beat in (0.3 s), at rest.
  await gui.click("text=Play again"); await gui.waitForTimeout(100);
  await gui.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 300; } });
  await sec.screenshot({ path: `${OUT}/p5-calltag-showroom.png` });
  console.log("shot", `${OUT}/p5-calltag-showroom.png`);
  await gui.close();
};

for (const [name, fn] of Object.entries(FX)) {
  if (!want(name)) continue;
  try { await fn(); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
if (!process.env.KEEP) rmSync(TMP, { recursive: true, force: true });
await browser.close();
