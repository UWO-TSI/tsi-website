// rod-gear round 10 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run: PW=<path to playwright/index.mjs> SHELL_BIN=<chrome-headless-shell> BASE=http://localhost:<port> [ONLY=clips,fx,cards] [CLIP=name,...] [FX=kind,...] node specs/evidence/rod-gear/r10/shots.mjs
// Clips are CDP screencasts (Playwright's own video wants its ffmpeg build) joined with the system ffmpeg, drawn on the GPU (ANGLE Metal, still headless).
//   clips  the awakening cutscene (/dev/economy?view=awakening&rod=&stage=): the Training rod, the Tempest (struck by
//          lightning), the Tidewarden (a wave), the Tempest on a phone; each with a poster (the reveal), a strip of its
//          beats and a strip of its impact frames
//   fx     each library type alone on /lab/fx?type=<kind>, its own clip (strength 1, then 2.5, then 1), and a poster
//   cards  the questions card with the awakenings table
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const OUT = dirname(fileURLToPath(import.meta.url));
const ONLY = process.env.ONLY?.split(",");
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
  return p;
}
/** Record `p` from now until `until()` resolves, as an mp4 at `file`; returns its duration. */
async function record(p, w, h, file, until, from = 0) {
  const dir = `${file}.frames`; mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p), shots = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { shots.push({ data, t: metadata.timestamp }); void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  const start = (from || Date.now() / 1000) - 0.05;
  record.start = start;
  await until();
  await cdp.send("Page.stopScreencast");
  shots.sort((a, b) => a.t - b.t);
  const kept = shots.filter((f, i) => f.t >= start || shots[i + 1]?.t > start);
  if (!kept.length) throw new Error(`no frames for ${file}: ${shots.length} shot, first at ${shots[0]?.t}, start ${start}`);
  const list = kept.map((f, i) => { const jpg = join(dir, `${String(i).padStart(5, "0")}.jpg`); writeFileSync(jpg, Buffer.from(f.data, "base64"));
    return `file '${jpg}'\nduration ${Math.max(0.001, (kept[i + 1]?.t ?? f.t + 0.04) - Math.max(f.t, start)).toFixed(4)}`; });
  writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${join(dir, `${String(kept.length - 1).padStart(5, "0")}.jpg`)}'\n`);
  ff("-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", file);
  rmSync(dir, { recursive: true });
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
}
const still = (mp4, t, png, scale) => ff("-ss", String(Math.max(0, t)), "-i", mp4, "-frames:v", "1", ...(scale ? ["-vf", `scale=${scale}:-1`] : []), png);
/**
 * The impact frames in the clip, read off its brightness at 30 fps from `from`: the first frame the screen jumps to the
 * rung's colour (impact 1), the first it falls dark again (2, the rod lit), the next jump (3); null if none.
 */
function impactAt(mp4, from, to) {
  const dir = `${mp4}.probe`; mkdirSync(dir, { recursive: true });
  ff("-ss", String(Math.max(0, from)), "-t", String(to - from), "-i", mp4, "-vf", "fps=30,scale=32:-1", join(dir, "%04d.png"));
  const means = execFileSync("magick", ["identify", "-format", "%[fx:mean]\n", join(dir, "*.png")]).toString().trim().split("\n").map(Number);
  rmSync(dir, { recursive: true });
  const base = means[0], up = (m) => m > base + 0.12, i1 = means.findIndex(up);
  if (i1 < 0) return null;
  const i2 = means.findIndex((m, i) => i > i1 && !up(m)), i3 = means.findIndex((m, i) => i > i2 && up(m));
  return [i1, i2, i3 < 0 ? i2 + 2 : i3].map((i) => Math.max(0, from) + (i + 0.5) / 30);
}
function strip(mp4, times, png, scale) {
  const parts = times.map((t, i) => { const f = `${png}.${i}.png`; still(mp4, t, f, scale); return f; });
  execFileSync("magick", [...parts, "-bordercolor", "white", "-border", "4", "+append", png]);
  parts.forEach((f) => rmSync(f));
}

if (want("clips")) {
  const warm = await page(1280, 800);
  await warm.goto(`${BASE}/dev/economy?view=awakening`); await warm.getByTestId("rod-awakening").waitFor({ timeout: 240000 });
  await warm.context().close();
  // AWAKEN_MS: frame 900, glow 1300, pulse 2800, hush 500, burst 700 (its first 210 ms the impact frames), show 1900.
  const CLIPS = [["rg10-awaken-training-1", "rod_training", 1, 1280, 800], ["rg10-awaken-tempest-1", "rod_tempest", 1, 1280, 800],
    ["rg10-awaken-tidewarden-1", "rod_tidewarden", 1, 1280, 800], ["rg10-phone-awaken-tempest-1", "rod_tempest", 1, 390, 844]];
  for (const [name, rod, stage, w, h] of CLIPS) {
    if (process.env.CLIP && !process.env.CLIP.split(",").some((c) => name.includes(c))) continue;
    const p = await page(w, h), mp4 = join(OUT, `${name}.mp4`);
    await p.goto(`${BASE}/dev/economy?view=awakening&rod=${rod}&stage=${stage}`);
    await p.locator('[data-testid="rod-awakening"]').waitFor({ timeout: 120000 });
    // When each beat came, by the page's clock (the timers run late under swiftshader, so the beats are read, not assumed).
    await p.evaluate(() => { const at = (window.__beats = {}), el = document.querySelector('[data-testid="rod-awakening"]');
      new MutationObserver(() => { const ph = el.getAttribute("data-phase"); if (!(ph in at)) at[ph] = Date.now() / 1000; }).observe(el, { attributes: true, attributeFilter: ["data-phase"] }); });
    const dur = await record(p, w, h, mp4, async () => {
      await p.locator('[data-phase="reveal"]').first().waitFor({ state: "attached", timeout: 60000 });
      await p.waitForTimeout(3600);
    });
    const beats = Object.fromEntries(Object.entries(await p.evaluate(() => window.__beats)).map(([k, t]) => [k, t - record.start]));
    await p.context().close();
    // The page paints late under swiftshader: shift the beats by how late the impact frames show in the clip.
    const hit = impactAt(mp4, beats.burst - 0.3, beats.burst + 2.5), lag = hit ? hit[0] - beats.burst : 0;
    const b = (k, d = 0) => (beats[k] ?? 0) + lag + d;
    still(mp4, dur - 0.4, join(OUT, `${name}-poster.png`));
    strip(mp4, [b("glow", 0.8), b("pulse", 1.2), b("pulse", 2.6), b("hush", 0.3), b("burst", 0.35), b("show", 0.8), b("reveal", 1.5)], join(OUT, `${name}-strip.png`), w > 600 ? 360 : 180);
    strip(mp4, [b("hush", 0.3), ...(hit ?? [b("burst"), b("burst", 0.07), b("burst", 0.14)]), b("burst", 0.45), b("show", 0.3)], join(OUT, `${name}-impact.png`), w > 600 ? 300 : 150);
    console.log(`${name}: ${dur.toFixed(1)} s, painted ${lag.toFixed(2)} s late, beats ${Object.entries(beats).map(([k, t]) => `${k} ${t.toFixed(2)}`).join(", ")}`);
  }
}

if (want("impact")) {
  // The impact frames as drawn, one at a time (the clips catch them as swiftshader paints them, late): the cutscene run to
  // its show, then the first two impact states set on it (the third is the first again).
  for (const rod of ["rod_tempest", "rod_tidewarden"]) {
    const p = await page(1280, 800), shots = [];
    await p.goto(`${BASE}/dev/economy?view=awakening&rod=${rod}&stage=1`, { timeout: 240000 });
    await p.locator('[data-phase="show"]').first().waitFor({ state: "attached", timeout: 120000 });
    for (const n of ["1", "2"]) {
      await p.evaluate((n) => { const s = document.querySelector('[data-testid="rod-awakening"]'); s.setAttribute("data-phase", "burst"); s.setAttribute("data-impact", n); }, n);
      await p.waitForTimeout(400);
      const f = join(OUT, `.impact-${n}.png`); await p.screenshot({ path: f }); shots.push(f);
    }
    await p.context().close();
    execFileSync("magick", [shots[0], shots[1], shots[0], "-resize", "420x", "-bordercolor", "white", "-border", "4", "+append", join(OUT, `rg10-impact-frames-${rod.slice(4)}.png`)]);
    shots.forEach((f) => rmSync(f));
  }
}

if (want("fx")) {
  const KINDS = process.env.FX?.split(",") ?? ["glow", "aura", "particles", "trail", "pulse", "motion", "flicker", "sparks", "burst", "water",
    "electricity", "embers", "flame", "petals", "gather", "sway", "lightning", "wave"];
  const W = 960, H = 600;
  for (const kind of KINDS) {
    const p = await page(W, H), mp4 = join(OUT, `rg10-fx-${kind}.mp4`);
    await p.goto(`${BASE}/lab/fx?type=${kind}`, { timeout: 240000 });
    await p.getByTestId("fx-solo").waitFor({ timeout: 240000 });
    await p.waitForTimeout(2500);
    // from a strength of 1 (it flips every 4 s) through 2.5 and back
    await p.waitForFunction(() => document.querySelector('[data-testid="fx-solo"]')?.getAttribute("data-k") === "1", null, { timeout: 20000 });
    await record(p, W, H, mp4, () => p.waitForTimeout(9000));
    await p.context().close();
    still(mp4, 2.0, join(OUT, `rg10-fx-${kind}-poster.png`));
    console.log(`fx ${kind}`);
  }
}

if (want("cards")) {
  // The awakenings per rod (lib/game/rods.ts): luck, bite, strength, reel, lure, control.
  const WEB = join(OUT, "../../../../web");
  const { createJiti } = await import(join(WEB, "node_modules/jiti/lib/jiti.mjs"));
  const jiti = createJiti(import.meta.url, { alias: { "@": WEB } });
  const { RODS: ALL, STAT_KEYS } = await jiti.import(join(WEB, "lib/game/rods.ts"));
  const NOTE = { rod_training: "David's: three, a surprise (its card shows only its fish count)", rod_titanium: "one, at 600: its line and its hold",
    rod_tidewarden: "one, at 600: its bite window, and its passive widens", rod_tempest: "one, at 600: its reel and its luck, and the storm on cloud" };
  const LOOK = { rod_training: ["silver blank, deep-blue wraps", "violet blank, gold fittings", "gold blank, ivory grip, brass"], rod_titanium: ["(its awakened model: game/rod-titanium)"],
    rod_tidewarden: ["bright teal, brighter gold; a wave breaks over it, its water reaches further"], rod_tempest: ["ice blue, pale white; struck by lightning, which stays crawling on it"] };
  const RODS = ALL.filter((r) => r.awakenings.length);
  const rows = RODS.map((r) => `<tr class=rod><td class=n><b>${r.name}</b></td><td class=n>${r.rarity}</td><td>base</td>${STAT_KEYS.map((k) => `<td>${r.base[k]}</td>`).join("")}<td class=p>${r.passive ? `${r.passive.name}: ${r.passive.text}` : ""}</td><td class=p>${NOTE[r.key] ?? ""}</td></tr>`
    + r.awakenings.map((a, i) => `<tr><td></td><td class=n>${a.looks}</td><td>${a.at.toLocaleString()} fish</td>${STAT_KEYS.map((k) => { const d = a.base[k] - (i ? r.awakenings[i - 1].base[k] : r.base[k]); return `<td>${a.base[k]}${d ? ` <i>+${d}</i>` : ""}</td>`; }).join("")}<td class=p>${a.passive ? `${a.passive.name}: ${a.passive.text}` : ""}${a.hooks ? `${a.passive ? " · " : ""}hooks up to ${a.hooks}` : ""}</td><td class=p>${LOOK[r.key]?.[i] ?? ""}</td></tr>`).join("")).join("");
  const QUESTIONS = [
    ["Tidewarden, Titanium and Tempest now awaken once each, at 600 fish, with what their two awakenings gave in one. 600 for all three, or spread them (550, 600, 650)?", "600 for all three"],
    ["The strike from outside plays when an awakening brings a new look or effect: the Tempest is struck by lightning (thunder) and keeps it crawling on its chain; the Tidewarden takes a wave and its water runs further down it. The Training rod's awakenings are new finishes, so no strike. Give the Training rod one too?", "No: only new looks and effects"],
    ["The Titanium's awakening (its mecha model) is on its own lane: give it a strike when it lands (sparks off a forge, a hammer blow)?", "Yes, sparks off a forge"],
    ["The impact frames: three frames of the screen in the new rung's colour with the rod cut out dark, then dark with the rod lit, then the colour again, then the shake and the flare. Stronger, or more of them?", "Keep three"],
    ["The effects library now has 16 types (glow, aura, particles, trail, pulse, motion, flicker, sparks, burst, water, electricity, fire sparks, flame, sakura petals, gather, sway) and two strikes (lightning, a wave), each drawn on any holder (a rod and a sword in the clips). Add or drop any?", "Keep these"],
    ["The Cedar's leaves are now its effect and sway after the rod (a spring), a little in the breeze too. More swing, or less?", "As it is"],
    ["Tempest: the model waits for your new reference. Its aura now sits on its body in hand.", "Send the reference"],
    ["A held rod in the world wears its stronger effect after it awakens (the electricity on an awakened Tempest in your hand too)?", "Yes, next round"],
  ];
  const html = `<!doctype html><meta charset=utf-8><style>body{font:13px system-ui;margin:24px;color:#222;background:#fff}table{border-collapse:collapse}th,td{padding:5px 8px;text-align:right}
tr.rod td{border-top:1px solid #ddd}th{font-weight:600;color:#666}td.n,th.n{text-align:left}td.p{text-align:left;color:#444;max-width:320px}i{color:#2a8a4a;font-style:normal;font-size:11px}h1{font-size:17px;margin:0 0 4px}p{margin:0 0 14px;color:#666}</style>
<h1>Questions (round 10)</h1><table class=q><tr><th class=n>Question</th><th class=n>My pick</th></tr>${QUESTIONS.map(([q, a]) => `<tr><td class=p style="max-width:760px">${q}</td><td class=p><b>${a}</b></td></tr>`).join("")}</table><br>
<h1>Awakenings per rod (round 10: the epics once each, at 600)</h1><p>Only the Training rod and the epics awaken. Green: what that awakening adds.</p>
<table><tr><th class=n>Rod</th><th class=n>Rarity</th><th>At</th><th>Luck</th><th>Bite</th><th>Line</th><th>Reel</th><th>Lure</th><th>Control</th><th class=n>Passive, hooks</th><th class=n>The look</th></tr>${rows}</table>`;
  const p = await page(1280, 600);
  await p.setContent(html); await p.screenshot({ path: join(OUT, "rg10-questions.png"), fullPage: true });
  await p.context().close();
}
await browser.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
