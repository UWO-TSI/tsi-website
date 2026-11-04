// Volleyball round 6 (game/volleyball; before: p5fx.mjs and p6/p6-before-*): the Chip call tag sheet, the perfect spike's
// impact frame with its fewer, shorter lines, `checks` (real time: the frame holds one frame, none on a dig, calm none)
// and the showroom's call tag section. Headless Chromium, muted, against a dev server on PORT (vbrun.sh).
//   PORT=3472 node specs/evidence/volleyball/p6fx.mjs <out_dir> [calls,spike,checks,showroom]
// The HUD's calls are CSS animations: each frame pins every running animation to the frame's time after the event.
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "specs/evidence/volleyball/p6", ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3472, BASE = `http://localhost:${PORT}`;
const TMP = `${OUT}/.frames`, FONT = "/System/Library/Fonts/Supplemental/Arial.ttf";
mkdirSync(TMP, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
const want = n => !ONLY || ONLY.split(",").includes(n);
if (["calls", "spike", "checks"].some(want)) {
  await page.goto(`${BASE}/lab/volleyball?seed=7`);
  await page.waitForFunction(() => !!window.__volley && !!window.__volleyFx, null, { timeout: 300000 });
  await page.addStyleTag({ content: "nav, nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(6000);
}

const hold = () => page.evaluate(() => { window.__volley.dev.paused = true; window.__volleyFx.dev.paused = true; for (const a of document.getAnimations()) try { a.finish(); } catch { /* infinite */ } });
const runMatch = on => page.evaluate(o => { window.__volley.dev.paused = !o; window.__volleyFx.dev.paused = !o; }, on);
const setup = (fn, arg) => page.evaluate(`(() => { const m = window.__volley.match(); const a = ${JSON.stringify(arg ?? null)}; (${fn})(m, a); })()`);
const emit = e => page.evaluate(x => window.__volleyFx.emit(x), e);
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

// Stand you near the net facing it (rally), the ball at your hands.
const atNet = `(m, a) => { m.phase = "rally"; const p = m.players[0], side = p.s.z < 0 ? -1 : 1; p.s = { ...p.s, x: 0, z: side * (a?.z ?? 3), y: m.ground(0, side * (a?.z ?? 3)) + (a?.y ?? 0), mode: a?.y ? "air" : "ground", vy: 0, vx: 0, vz: 0 };
  Object.assign(m.ball, { x: side * 0.5, y: p.s.y + (a?.hand ?? 0.8) + 0.25, z: p.s.z - side * 0.55, vx: 0, vy: a?.vy ?? 3, vz: -side * (a?.vz ?? 4), k: 0.7 }); m.rallyTouches = a?.heat ?? 1; }`;
const contactAt = (how, timing, who = 0, team = 0) => page.evaluate(([how, timing, who, team]) => {
  const m = window.__volley.match(), b = m.ball;
  window.__volleyFx.emit({ kind: "contact", who, team, how, timing, quality: { perfect: 1, good: 0.7, early: 0.35, late: 0.35 }[timing], x: b.x, y: b.y, z: b.z, speed: how === "spike" ? 22 : how === "serve" ? 16 : 7 });
}, [how, timing, who, team]);
/** A crop of `w` × `h` centred on the call tag (or the view's middle). */
const aroundTag = (w, h) => async () => {
  const r = await page.evaluate(() => { const el = document.querySelector("[data-kind][data-live]"); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
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
  /** The sheet: a whole view, then a crop round the tag at rest for each call. */
  async calls() {
    const rows = [[], []];
    for (const [name, arg, fire] of CALLS) {
      await hold(); await setup(atNet, arg); await stepFx(2); await fire();
      const [f] = await frames(`calls-${name}`, [20], aroundTag(360, 180));
      rows[1].push(f);
      if (name === "Perfect") rows[0].push((await frames("calls-whole", [20], CLIP))[0]);
      await stepFx(70);
    }
    sheet("p6-calls", [rows[0], rows[1].slice(0, 4), rows[1].slice(4)], 360, ["In view", "Perfect, Good, Early, Block", "Saved, Miss, Max"], "png");
  },
  /** The perfect spike: the impact frame first (lines round the hit), then 2, 4, 8, 14 frames on. */
  async spike() {
    await hold(); await setup(atNet, { z: 1.2, y: 1.75, hand: 0.83, vy: -2, vz: 18 }); await stepFx(2);
    await contactAt("spike", "perfect");
    const row = await frames("spike", [1, 2, 4, 8, 14], CLIP);
    await stepFx(90);
    sheet("p6-spike", [row], 400, ["Perfect spike (r6)"]);
    execFileSync("magick", [row[0], "-resize", "1280x", `${OUT}/p6-spike-frame.png`]);
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

/** The kit's showroom: every call (last: it leaves the match). */
FX.showroom = async () => {
  const gui = await ctx.newPage();
  await gui.goto(`${BASE}/lab/gui#call-tag`);
  await gui.addStyleTag({ content: "nav, nextjs-portal { display: none !important; }" });
  const sec = gui.locator("#call-tag");
  await sec.waitFor({ timeout: 300000 }); await sec.scrollIntoViewIfNeeded(); await gui.waitForTimeout(8000);
  // The played row held a beat in (0.3 s), at rest.
  await gui.click("text=Play again"); await gui.waitForTimeout(100);
  await gui.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 300; } });
  await sec.screenshot({ path: `${OUT}/p6-calltag-showroom.png` });
  console.log("shot", `${OUT}/p6-calltag-showroom.png`);
  await gui.close();
};

for (const [name, fn] of Object.entries(FX)) {
  if (!want(name)) continue;
  try { await fn(); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
if (!process.env.KEEP) rmSync(TMP, { recursive: true, force: true });
await browser.close();
