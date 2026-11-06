// rod-gear round 9 evidence (the Water type, the Tidewarden): headless Chromium against a dev server (BASE), muted, never headed.
// Run: PW=<path to playwright/index.mjs> SHELL_BIN=<chrome-headless-shell> BASE=http://localhost:<port> [ONLY=study,fx,bag,awaken,cards] node specs/evidence/rod-gear/r9/shots.mjs
// The studies (/lab/fx?study=water|tidewarden) are drawn at their reference's own size and framing and set beside it;
// the references are third-party and untracked (specs/references/rods/), so they are read from there, never copied in.
// Clips are CDP screencasts made mp4 with the system ffmpeg (as round 8's); their frame times are swiftshader's.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const OUT = dirname(fileURLToPath(import.meta.url));
const REFS = join(OUT, "../../../references/rods");
const ONLY = process.env.ONLY?.split(",");
const want = (k) => !ONLY || ONLY.includes(k);
const ff = (...a) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a]);
const magick = (...a) => execFileSync("magick", a);

const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
const hide = () => document.addEventListener("DOMContentLoaded", () => {
  const s = document.createElement("style"); s.textContent = ".ld-overlay, nextjs-portal { display: none !important; }"; document.head.append(s);
});
async function page(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(hide);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  return p;
}
const shot = (p, file, opts = {}) => p.screenshot({ path: join(OUT, `${file}.png`), ...opts });

/** Record `p` for `ms` after `ready()`, as `${name}.mp4` with a poster at `posterAt` s (and the frame times). */
async function clip(p, name, w, h, go, ms, posterAt = 1.5) {
  const dir = join(OUT, `.video-${name}`); mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p), shots = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { shots.push({ data, t: metadata.timestamp }); void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
  await go();
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  await p.waitForTimeout(ms);
  await cdp.send("Page.stopScreencast");
  const list = shots.map((f, i) => { const file = join(dir, `${String(i).padStart(5, "0")}.jpg`); writeFileSync(file, Buffer.from(f.data, "base64"));
    return `file '${file}'\nduration ${((shots[i + 1]?.t ?? f.t + 0.04) - f.t).toFixed(4)}`; });
  writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${join(dir, `${String(shots.length - 1).padStart(5, "0")}.jpg`)}'\n`);
  const mp4 = join(OUT, `${name}.mp4`);
  ff("-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", mp4);
  rmSync(dir, { recursive: true });
  ff(posterAt < 0 ? "-sseof" : "-ss", String(posterAt), "-i", mp4, "-frames:v", "1", join(OUT, `${name}-poster.png`));   // < 0: from the end
  console.log(`${name}: ${shots.length} frames`);
}

if (want("study")) {
  // Each study beside its reference, the same size: reference | ours (one moment) | ours (a moment later: it moves).
  for (const [study, w, h, ref] of [["water", 736, 1307, "fx-aquatic-water-ref.png"], ["tidewarden", 1012, 1798, "epic-tidewarden-ref.png"]]) {
    const p = await page(w, h);
    await p.goto(`${BASE}/lab/fx?study=${study}&k=1`, { timeout: 240000 }); await p.getByTestId("fx-study").waitFor({ timeout: 240000 }); await p.waitForTimeout(6000);
    await shot(p, `.s-${study}-0`); await p.waitForTimeout(900); await shot(p, `.s-${study}-1`);
    await p.context().close();
    const name = study === "water" ? "rg9-study-water-vs-ref" : "rg9-tidewarden-vs-ref";   // *-vs-ref: holds the reference, never committed (.gitignore)
    magick(join(REFS, ref), join(OUT, `.s-${study}-0.png`), join(OUT, `.s-${study}-1.png`), "+append", "-resize", study === "water" ? "60%" : "45%", join(OUT, `${name}.png`));
    for (const i of [0, 1]) rmSync(join(OUT, `.s-${study}-${i}.png`));
  }
}

if (want("fx")) {
  // The Water type on /lab/fx, at strength 1 and 2.5 (the study, held at one strength): it runs, its foam breaks and
  // re-forms, its drops fly; at 2.5 it runs faster, holds more foam and throws more drops.
  for (const k of ["1", "2.5"]) {
    const p = await page(736, 1307);
    await clip(p, `rg9-fx-water-${k}`, 736, 1307, async () => { await p.goto(`${BASE}/lab/fx?study=water&k=${k}`, { timeout: 240000 }); await p.getByTestId("fx-study").waitFor({ timeout: 240000 }); await p.waitForTimeout(5000); }, 6000);
    await p.context().close();
  }
  // the grid with the water's card among the other types (one still)
  const p = await page(1280, 1640);
  await p.goto(`${BASE}/lab/fx?k=2.5`); await p.getByTestId("fx-lab").waitFor({ timeout: 180000 }); await p.waitForTimeout(6000);
  await p.locator('[data-fx="water"]').screenshot({ path: join(OUT, "rg9-fx-water-card.png") });
  await p.context().close();
}

if (want("bag")) {
  // The bag's rod stage (the shop's detail uses the same stage; the Tidewarden is crafted, not on the shelf): desktop
  // and phone stills, and a turning clip.
  for (const [tag, w, h] of [["", 1280, 800], ["phone-", 390, 844]]) {
    const p = await page(w, h);
    const open = async () => {
      await p.goto(`${BASE}/dev/economy?view=bag&tide=1`); await p.getByRole("button", { name: /^Tidewarden rod/ }).waitFor({ timeout: 120000 }); await p.waitForTimeout(1500);
      await p.getByRole("button", { name: /^Tidewarden rod/ }).click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(5000);
    };
    if (tag) { await open(); await shot(p, `rg9-${tag}bag-tidewarden`); }
    else await clip(p, "rg9-tidewarden-turn", w, h, async () => { await open(); await shot(p, "rg9-bag-tidewarden"); }, 9000, 4);
    await p.context().close();
  }
}

if (want("awaken")) {
  // The awakening cutscene: its effect's strength rises with each awakening (auraAt), so the water wraps further.
  const warm = await page(1280, 800);
  await warm.goto(`${BASE}/dev/economy?view=awakening&rod=rod_tidewarden&stage=1`); await warm.getByTestId("rod-awakening").waitFor({ timeout: 180000 });
  await warm.context().close();
  for (const [name, stage, w, h] of [["rg9-awaken-tidewarden-1", 1, 1280, 800], ["rg9-awaken-tidewarden-2", 2, 1280, 800], ["rg9-phone-awaken-tidewarden-2", 2, 390, 844]]) {
    const p = await page(w, h);
    await clip(p, name, w, h, async () => { await p.goto(`${BASE}/dev/economy?view=awakening&rod=rod_tidewarden&stage=${stage}`); await p.locator('[data-testid="rod-awakening"][data-ready]').waitFor({ timeout: 120000 }); }, 11000, -2.5);   // the reveal, its head face-on as the stage turns
    await p.context().close();
  }
}

if (want("cards")) {
  const card = async (file, html, w = 1100) => { const p = await page(w, 400); await p.setContent(`<!doctype html><meta charset=utf-8><style>body{font:14px/1.45 system-ui;margin:24px;color:#222;background:#fff}h1{font-size:18px;margin:0 0 10px}table{border-collapse:collapse}td,th{padding:6px 10px;text-align:left;vertical-align:top;border-top:1px solid #e4e4e4}th{color:#666;font-weight:600}b{font-weight:600}.ok{color:#2a8a4a}</style>${html}`); await shot(p, file, { fullPage: true }); await p.context().close(); };
  const BUDGET = JSON.parse(process.env.BUDGET ?? "{}");
  await card("rg9-budget", `<h1>The Tidewarden against the budget</h1><table>
<tr><th>Part</th><th>Measured</th><th>Budget</th></tr>
<tr><td>The rod (tools/rod-5.glb)</td><td><b>${BUDGET.rodTris ?? "?"} triangles, ${BUDGET.rodMats ?? "?"} materials</b> (the head white with its colours in its vertices, the shaft gold, the teal wrap; one sheen), nothing emissive; one draw in hand (heldMesh merges it)</td><td class=ok>600 triangles, 5 materials</td></tr>
<tr><td>Its effect (props/rodfx-tidewarden.glb)</td><td><b>4 draws a holder</b>: the veins (Glow), the water ribbon (Water: the wrap, the streamer, the wisp, the flung drop and the grown wrap are one mesh), the crash (Foam), the drops (Spray). ${BUDGET.fxTris ?? "?"} triangles. No halos, no aura, no lights, no shadows</td><td class=ok>5 draws a holder (RodAura.test)</td></tr>
<tr><td>Before (round 8)</td><td>3 meshes and 1 halo sprite (the pearl, the spindle aura, two ribbons of light): 4 draws</td><td></td></tr>
<tr><td>The study (props/fxlib-water.glb, /lab/fx only)</td><td>${BUDGET.studyTris ?? "?"} triangles, 6 draws (the shell's three materials, the blade, the foam, the drops); not a game item</td><td>(lab only)</td></tr>
<tr><td>perf:check</td><td>${BUDGET.perf ?? "see the report"}</td><td>6.5 ms high; within 10% of the baseline</td></tr></table>`);
  const Q = [
    ["The Water type (rg9-study-water-vs-ref, rg9-fx-water-*): does it read as your Aquatic sword's water? Where it still differs: the body's streaks are drawn by a shader (flat bands, not painted strokes), the foam has no soft painted shading (flat white with a cyan edge), and the tiny splash tendrils at the crown are fewer. The shell hilt is modelled to its landmarks, not traced: simpler and paler than drawn (it is the study's, not the effect's).", "Approve the look; I keep tuning on your notes"],
    ["The Tidewarden (rg9-tidewarden-vs-ref): its outline is traced from your sketch and smoothed into clean curves (the three prongs, the two round cut-outs opened to their drawn size, the spurs and crescents), made solid: bevelled to a fine edge and raised in a ridge down each prong and the body, gold with a sheen, each tip fading through mint into blue, the veins as branching cracks. Stylised to read at game size: the head 1.2 times the sketch's (the tip where it was), the shaft thicker than drawn (0.0095 against 0.0064), and the head faces the holder's side so in hand you see its face, not its edge. Where it still differs: no pencil outline or painted shading, its faces are low-poly (560 of the 600 triangles), and the sketch's veins are a fuller network than the cracks traced off it. OK?", "Yes"],
    ["In the bag (and the shop's detail) an effect rod is fitted 22% smaller to leave its aura room. The Tidewarden's water hugs its shaft, so I let a rod's model say how much room it needs (fxRoom) and gave the Tidewarden 4%: it fills the stage as the Cedar does. Keep that, or a different share?", "Keep it"],
    ["What grows with the water's strength (each awakening): it runs faster, the foam widens and holds more, the water wraps further down the shaft (about three more turns by 2.5), more drops are thrown. Right things to grow?", "Yes"],
    ["The Tidewarden isn't sold in the shop (epics are crafted, your round 2 rule), so it shows in the bag's rod stage, the cutscene and in hand; the shop's detail uses the same stage. Fine?", "Yes"],
    ["Its water doesn't spin round the shaft (the streamer trails one way, as drawn); it flows, its foam breaks and re-forms and its drops fly, and the rod rides its swell in the cutscene. Or should the wrap turn too?", "Keep it as drawn"],
    ["Riptide still has no reference on file. Send one when you can?", "Yes: it waits for yours"],
    ["Round 8's questions (the awakenings table and the rest, https://claude.ai/artifact/AgE5pgESXMPef71FiPT1Bx) are still open.", "Answer them there"],
  ];
  await card("rg9-questions", `<h1>Questions (round 9)</h1><table><tr><th>Question</th><th>My pick</th></tr>${Q.map(([q, a]) => `<tr><td>${q}</td><td><b>${a}</b></td></tr>`).join("")}</table>`);
}

await browser.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
