// rod-gear round 11 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run: PW=<path to playwright/index.mjs> SHELL_BIN=<chrome-headless-shell> BASE=http://localhost:<port> [ONLY=clips,impact,bag,cards] [CLIP=name,...] node specs/evidence/rod-gear/r11/shots.mjs
// Clips are CDP screencasts (Playwright's own video wants its ffmpeg build) joined with the system ffmpeg, drawn on the GPU (ANGLE Metal, still headless).
//   clips   the awakening cutscene (/dev/economy?view=awakening&rod=&stage=): the Training rod (its gather building, the
//           impact frames out of the rod), the Tidewarden (its water wound on), the Tempest (its new awakened model);
//           each with a poster (the reveal), a strip of its beats and a strip of its impact frames
//   impact  the impact frames as drawn, one at a time (the Training rod)
//   bag     the bag's rod stage: the Tidewarden with its reel and line (a turn), awakened (a turn), the bobber's size
//   cards   the questions card
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
  const CLIPS = [["rg11-awaken-training-1", "rod_training", 1, 1280, 800], ["rg11-awaken-tidewarden-1", "rod_tidewarden", 1, 1280, 800],
    ["rg11-awaken-tempest-1", "rod_tempest", 1, 1280, 800], ["rg11-phone-awaken-tidewarden-1", "rod_tidewarden", 1, 390, 844]];
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
    strip(mp4, [b("glow", 0.4), b("glow", 1.1), b("pulse", 1.2), b("pulse", 2.6), b("hush", 0.3), b("burst", 0.3), b("burst", 0.6), b("show", 0.8), b("reveal", 1.5)], join(OUT, `${name}-strip.png`), w > 600 ? 360 : 180);
    strip(mp4, [b("hush", 0.3), ...(hit ?? [b("burst"), b("burst", 0.07), b("burst", 0.14)]), b("burst", 0.45), b("show", 0.3)], join(OUT, `${name}-impact.png`), w > 600 ? 300 : 150);
    console.log(`${name}: ${dur.toFixed(1)} s, painted ${lag.toFixed(2)} s late, beats ${Object.entries(beats).map(([k, t]) => `${k} ${t.toFixed(2)}`).join(", ")}`);
  }
}

if (want("impact")) {
  // The impact frames as drawn, one at a time (the clips catch them as swiftshader paints them, late): the cutscene run to
  // its show, then each impact state set on it.
  for (const rod of ["rod_training"]) {
    const p = await page(1280, 800), shots = [];
    await p.goto(`${BASE}/dev/economy?view=awakening&rod=${rod}&stage=1`, { timeout: 240000 });
    await p.locator('[data-phase="show"]').first().waitFor({ state: "attached", timeout: 120000 });
    for (const n of ["1", "2", "3"]) {
      await p.evaluate((n) => { const s = document.querySelector('[data-testid="rod-awakening"]'); s.setAttribute("data-phase", "burst"); s.setAttribute("data-impact", n); }, n);
      await p.waitForTimeout(400);
      const f = join(OUT, `.impact-${n}.png`); await p.screenshot({ path: f }); shots.push(f);
    }
    await p.context().close();
    execFileSync("magick", [...shots, "-resize", "420x", "-bordercolor", "white", "-border", "4", "+append", join(OUT, `rg11-impact-frames-${rod.slice(4)}.png`)]);
    shots.forEach((f) => rmSync(f));
  }
}

if (want("bag")) {
  // The bag's rod stage (the shop's detail uses the same stage): the Tidewarden as bought (120 fish) and awakened (600),
  // each a turn and a still, the lucky bobber hanging from its tip.
  for (const [name, tdc] of [["rg11-tidewarden", 120], ["rg11-tidewarden-a1", 600]]) {
    const p = await page(1280, 800), mp4 = join(OUT, `${name}-turn.mp4`);
    await p.goto(`${BASE}/dev/economy?view=bag&tide=1&tdc=${tdc}`); await p.getByRole("button", { name: /^Tidewarden rod/ }).waitFor({ timeout: 120000 }); await p.waitForTimeout(1500);
    await p.getByRole("button", { name: /^Tidewarden rod/ }).click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(5000);
    await p.screenshot({ path: join(OUT, `${name}-bag.png`) });
    await record(p, 1280, 800, mp4, () => p.waitForTimeout(9000));
    still(mp4, 4, join(OUT, `${name}-turn-poster.png`));
    await p.context().close();
  }
  // The bobber, before (round 9's shot) and after, the same stage.
  execFileSync("magick", [join(OUT, "../r9/rg9-bag-tidewarden.png"), join(OUT, "rg11-tidewarden-bag.png"), "-crop", "560x560+60+60", "+repage", "-resize", "420x",
    "-bordercolor", "white", "-border", "4", "+append", join(OUT, "rg11-bobbers.png")]);
}

if (want("cards")) {
  const QUESTIONS = [
    ["rg9-awaken came back redo with no note. My guess: it was the wave crashing over the Tidewarden, which you called out in rods 10. That strike is gone: its awakened water now winds on round the rod (a little further down on every beat of the pulse, drawn off in the hush, crashing all the way round on the hit), on its new awakened model. Was that it, or something else in that clip?", "That was it"],
    ["The Tidewarden's reel and line: a gold spool on a gold stem with a teal crank and knob, and a teal line up the shaft and the middle prong's face to its tip. Teal line, or cream like the other rods'?", "Teal"],
    ["All bobbers are 0.7 of their old size: the float on the water and on your line, and the bobber and bait hanging in the bag. Smaller still?", "0.7"],
    ["The awakened Tidewarden: the head half as long again and lit (mint and blue further up its prongs, a glowing rim, brighter veins), two ribbons of water wound against each other down the whole shaft and turning round it, a crest curling off under the head, foam, drops flung and dripping. Its water's turning speed: faster or slower?", "As it is"],
    ["The awakened Tempest (its base still waits for your reference): fewer, bolder links zigzagging harder, a crown of three forked ice spikes, a storm cloud for a reel, a navy grip; the same lightning strike and electricity after, all its effects stronger. Closer?", "Closer"],
    ["Training's awakening: the gather starts as a trickle and builds on every beat; the impact frames now burst out of the rod (rays from it, then dark with it lit, then a ring round it) and a shockwave runs out after, each frame held a little longer. More?", "As it is"],
  ];
  const html = `<!doctype html><meta charset=utf-8><style>body{font:13px system-ui;margin:24px;color:#222;background:#fff}table{border-collapse:collapse}th,td{padding:6px 8px;text-align:left;vertical-align:top}
th{font-weight:600;color:#666}td.p{color:#333}h1{font-size:17px;margin:0 0 8px}</style>
<h1>Questions (round 11)</h1><table><tr><th>Question</th><th>My pick</th></tr>${QUESTIONS.map(([q, a]) => `<tr><td class=p style="max-width:780px">${q}</td><td class=p><b>${a}</b></td></tr>`).join("")}</table>`;
  const p = await page(1100, 400);
  await p.setContent(html); await p.screenshot({ path: join(OUT, "rg11-questions.png"), fullPage: true });
  await p.context().close();
}
await browser.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
