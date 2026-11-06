// vfx-library round 1 evidence: headless Chromium against a dev server (BASE), muted, never headed, drawn on the GPU (ANGLE Metal).
// Run: PW=<playwright/index.mjs> SHELL_BIN=<chrome-headless-shell> BASE=http://localhost:<port> [ONLY=fx,cards] [FX=kind,...] [SEC=9] [OUTDIR=dir] node shots.mjs
//   fx     each VFX library type alone on /lab/fx?type=<kind> on a rod and a sword: its clip (strength 1, then 2.5, then 1),
//          a poster (strength 1 | 2.5); the lightning strike also a strip of its charge, held breath, hit and shake
//   cards  the questions card
// Clips are CDP screencasts joined with the system ffmpeg (Playwright's own video wants its ffmpeg build).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const OUT = process.env.OUTDIR ?? dirname(fileURLToPath(import.meta.url));
const ONLY = process.env.ONLY?.split(",");
const SEC = Number(process.env.SEC ?? 9);
const want = (k) => !ONLY || ONLY.includes(k);
const ff = (...a) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a]);

const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const errors = [];
const hideChrome = () => document.addEventListener("DOMContentLoaded", () => {
  const s = document.createElement("style"); s.textContent = ".ld-overlay, nextjs-portal { display: none !important; } body > header, nav[aria-label] { visibility: hidden !important; }"; document.head.append(s);
});
async function page(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(hideChrome);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return p;
}
/** Record `p` until `until()` resolves, as an mp4 at `file`. */
async function record(p, w, h, file, until) {
  const dir = `${file}.frames`; mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p), shots = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { shots.push({ data, t: metadata.timestamp }); void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  const start = Date.now() / 1000 - 0.05;
  await until();
  await cdp.send("Page.stopScreencast");
  shots.sort((a, b) => a.t - b.t);
  const kept = shots.filter((f, i) => f.t >= start || shots[i + 1]?.t > start);
  if (!kept.length) throw new Error(`no frames for ${file}`);
  const list = kept.map((f, i) => { const jpg = join(dir, `${String(i).padStart(5, "0")}.jpg`); writeFileSync(jpg, Buffer.from(f.data, "base64"));
    return `file '${jpg}'\nduration ${Math.max(0.001, (kept[i + 1]?.t ?? f.t + 0.04) - Math.max(f.t, start)).toFixed(4)}`; });
  writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${join(dir, `${String(kept.length - 1).padStart(5, "0")}.jpg`)}'\n`);
  ff("-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", file);
  rmSync(dir, { recursive: true });
  return kept.length;
}
const still = (mp4, t, png) => ff("-ss", String(Math.max(0, t)), "-i", mp4, "-frames:v", "1", png);

if (want("fx")) {
  const KINDS = process.env.FX?.split(",") ?? ["energy", "glow", "pulse", "particles", "trail", "motion", "sparks", "burst", "water",
    "electricity", "embers", "flame", "petals", "gather", "sway", "lightning"];
  const W = 960, H = 600;
  for (const kind of KINDS) {
    const p = await page(W, H), mp4 = join(OUT, `vfx1-${kind}.mp4`);
    await p.goto(`${BASE}/lab/fx?type=${kind}`, { timeout: 240000 });
    await p.getByTestId("fx-solo").waitFor({ timeout: 240000 });
    await p.waitForTimeout(2500);
    // from a strength of 1 (it flips every 4 s) through 2.5 and back: wait for a flip down to 1
    const kIs = (v) => p.waitForFunction((x) => document.querySelector('[data-testid="fx-solo"]')?.getAttribute("data-k") === x, v, { timeout: 20000 });
    await kIs("2.5"); await kIs("1");
    const frames = await record(p, W, H, mp4, () => p.waitForTimeout(SEC * 1000));
    await p.context().close();
    const a = join(OUT, ".a.png"), b = join(OUT, ".b.png");
    still(mp4, Math.min(2.2, SEC / 3), a); still(mp4, Math.min(6.2, SEC * 0.7), b);
    execFileSync("magick", [a, b, "+append", "-resize", "1280x", join(OUT, `vfx1-${kind}-poster.png`)]);
    rmSync(a); rmSync(b);
    if (kind === "lightning") strike(mp4, join(OUT, "vfx1-lightning-strip.png"));
    console.log(`fx ${kind}: ${frames} frames`);
  }
}

/** The strike's beats off its clip: the brightest frame is the white flash; frames before (charge, held breath) and after (freeze, shake). */
function strike(mp4, png) {
  const dir = `${png}.d`; mkdirSync(dir, { recursive: true });
  ff("-i", mp4, "-vf", "fps=30,scale=240:-1", join(dir, "%04d.png"));
  const files = readdirSync(dir).filter(f => f.endsWith(".png")).sort();
  const means = execFileSync("magick", ["identify", "-format", "%[fx:mean]\n", ...files.map(f => join(dir, f))]).toString().trim().split("\n").map(Number);
  const peak = means.indexOf(Math.max(...means.slice(0, Math.max(1, means.length - 20))));
  const at = [-30, -9, -3, 0, 3, 6, 12].map(d => files[Math.max(0, Math.min(files.length - 1, peak + d))]);
  ff(...at.flatMap(f => ["-i", join(dir, f)]), "-filter_complex", `${at.map((_, i) => `[${i}:v]`).join("")}hstack=inputs=${at.length}`, png);
  rmSync(dir, { recursive: true });
}

if (want("cards")) {
  const p = await page(960, 640);
  await p.setContent(`<html><body style="margin:0;background:#141821;color:#eef2f8;font:16px/1.45 system-ui;padding:36px 44px">
<h1 style="font:600 24px/1.2 system-ui;margin:0 0 6px">VFX Library: questions</h1>
<p style="opacity:.7;margin:0 0 18px">Round 1. Flame and Sparks are unchanged: they wait for your references.</p>
<ol style="padding-left:22px;display:grid;gap:12px">
<li><b>Two families.</b> Auras (energy, worn on its own parts): Energy, Sun glint, Pulse. Effects (things that happen): everything else. Is that the split you mean?</li>
<li><b>Flicker deleted.</b> The Tempest's chain still crackles from its own model until its remodel. Remove that too?</li>
<li><b>Wave deleted.</b> The Tidewarden's awakening now has no strike from outside (its water still grows). Should it wear the new water instead?</li>
<li><b>Lightning's freeze frame.</b> Here the weapon and its sparks freeze for 0.12 s, white, then shake. In the game, should the hit-stop freeze the whole scene, or only the weapon?</li>
<li><b>Energy colour.</b> Energy takes the thing's rung colour (blue here). Any parts that should never light, like a grip?</li>
</ol></body></html>`);
  await p.screenshot({ path: join(OUT, "vfx1-questions.png") });
  await p.context().close();
  console.log("cards");
}

await browser.close();
if (errors.length) console.log("page errors:\n" + [...new Set(errors)].slice(0, 12).join("\n"));
