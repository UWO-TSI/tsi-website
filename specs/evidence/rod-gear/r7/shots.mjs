// rod-gear round 7 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run: PW=<path to playwright/index.mjs> SHELL_BIN=<chrome-headless-shell> BASE=http://localhost:<port> [ONLY=clips,talk,box,table] node specs/evidence/rod-gear/r7/shots.mjs
// Clips: the awakening cutscene (/dev/economy?view=awakening&rod=&stage=), recorded as a CDP screencast (Playwright's own
// video needs its ffmpeg build), from its first frame, made mp4 with ffmpeg; each gets a poster (the reveal) and a strip of its beats.
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

const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
const hideCurtain = () => document.addEventListener("DOMContentLoaded", () => {
  const s = document.createElement("style"); s.textContent = ".ld-overlay { display: none !important; }"; document.head.append(s);
});
async function page(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(hideCurtain);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  return p;
}
const shot = (p, file, full = false) => p.screenshot({ path: join(OUT, `${file}.png`), fullPage: full });

if (want("clips")) {
  // Warm the route once (the dev server compiles it), then record each cutscene from a fresh context.
  const warm = await page(1280, 800);
  await warm.goto(`${BASE}/dev/economy?view=awakening`); await warm.getByTestId("rod-awakening").waitFor({ timeout: 180000 });
  await warm.context().close();
  const CLIPS = [["rg7-awaken-training-1", "rod_training", 1, 1280, 800], ["rg7-phone-awaken-training-1", "rod_training", 1, 390, 844],
    ["rg7-awaken-training-3", "rod_training", 3, 1280, 800], ["rg7-awaken-tidewarden-2", "rod_tidewarden", 2, 1280, 800], ["rg7-awaken-titanium-1", "rod_titanium", 1, 1280, 800]];
  for (const [name, rod, stage, w, h] of CLIPS) {
    if (process.env.CLIP && !process.env.CLIP.split(",").some((c) => name.includes(c))) continue;
    const dir = join(OUT, `.video-${name}`); mkdirSync(dir, { recursive: true });
    const p = await page(w, h);
    const cdp = await p.context().newCDPSession(p), shots = [];
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { shots.push({ data, t: metadata.timestamp }); void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
    await p.goto(`${BASE}/dev/economy?view=awakening&rod=${rod}&stage=${stage}`);
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
    await p.locator('[data-testid="rod-awakening"][data-ready]').waitFor({ timeout: 120000 });
    const start = Date.now() / 1000 - 0.3;
    await p.locator('[data-phase="reveal"]').first().waitFor({ timeout: 30000 });
    await p.waitForTimeout(3200);
    await cdp.send("Page.stopScreencast");
    await p.context().close();
    // Each frame shown until the next one came (the concat demuxer's durations), from the cutscene's mount.
    const kept = shots.filter((f, i) => f.t >= start || shots[i + 1]?.t > start);
    const list = kept.map((f, i) => { const file = join(dir, `${String(i).padStart(5, "0")}.jpg`); writeFileSync(file, Buffer.from(f.data, "base64"));
      return `file '${file}'\nduration ${((kept[i + 1]?.t ?? f.t + 0.04) - Math.max(f.t, start)).toFixed(4)}`; });
    writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${join(dir, `${String(kept.length - 1).padStart(5, "0")}.jpg`)}'\n`);
    const mp4 = join(OUT, `${name}.mp4`);
    ff("-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", mp4);
    rmSync(dir, { recursive: true });
    // The poster: the reveal, at rest. The strip: framed, glowing, pulsing, the burst, the reveal (AWAKEN_MS).
    const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString());
    ff("-ss", String(Math.max(0, dur - 0.4)), "-i", mp4, "-frames:v", "1", join(OUT, `${name}-poster.png`));
    const beats = [0.7, 1.8, 3.6, 5.1, Math.max(6.4, dur - 0.4)], frames = [];
    for (const [i, t] of beats.entries()) { const f = join(OUT, `.${name}-${i}.png`); frames.push(f); ff("-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", `scale=${w > 600 ? 400 : 200}:-1`, f); }
    execFileSync("magick", [...frames, "-bordercolor", "white", "-border", "4", "+append", join(OUT, `${name}-strip.png`)]);
    frames.forEach((f) => rmSync(f));
    console.log(`${name}: ${dur.toFixed(1)} s`);
  }
}

for (const [w, h, pre] of [[1280, 800, "rg7"], [390, 844, "rg7-phone"]]) {
  if (!want("talk") && !want("box")) break;
  const p = await page(w, h);
  if (want("talk")) {
    await p.goto(`${BASE}/dev/economy?view=trade&found=0`); await p.getByTestId("rod-seller").waitFor({ timeout: 120000 }); await p.waitForTimeout(800);
    await shot(p, `${pre}-gary-ask`);
    await p.getByRole("button", { name: "Trade the Flimsy rod" }).click(); await p.getByText("the more it grows").first().waitFor(); await p.waitForTimeout(1200);
    await shot(p, `${pre}-gary-traded`);
  }
  if (want("box")) {
    await p.goto(`${BASE}/dev/economy?view=overlay&section=rods`); await p.getByTestId("shop-card").first().waitFor({ timeout: 120000 }); await p.waitForTimeout(1500);
    await p.getByRole("button", { name: /^Glass rod,/ }).click(); await p.getByTestId("shop-detail").waitFor(); await p.waitForTimeout(3500);
    await shot(p, `${pre}-rodbox-shop`);
    // The bag's tools with the Training rod past its first awakening (60 fish): its card and its box in the rare outline.
    await p.goto(`${BASE}/dev/economy?view=bag&tc=60`); await p.getByRole("button", { name: /^Training rod/ }).waitFor({ timeout: 120000 }); await p.waitForTimeout(1500);
    await shot(p, `${pre}-awakened-cards`, true);
    await p.getByRole("button", { name: /^Training rod/ }).click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(3500);
    await shot(p, `${pre}-rodbox-bag`, true);
  }
  await p.context().close();
}

if (want("table")) {
  // The awakenings per rod (lib/game/rods.ts, proposed 2026-11-04): luck, bite, strength, reel, lure, control.
  const WEB = join(OUT, "../../../../web");
  const { createJiti } = await import(join(WEB, "node_modules/jiti/lib/jiti.mjs"));
  const { RODS: ALL, STAT_KEYS } = await createJiti(import.meta.url, { alias: { "@": WEB } }).import(join(WEB, "lib/game/rods.ts"));
  // What each rod is for, and each awakening's look (RodAwakening.tsx FINISH, a stand-in until the awakened models).
  const NOTE = { rod_training: "David's: three, a surprise (its card shows only its fish count)", rod_titanium: "one, late: its line and its hold",
    rod_tidewarden: "two, slow: its bite window, then its passive widens", rod_tempest: "two, quick (found, not made): its reel, then its luck" };
  const LOOK = { rod_training: ["silver blank, deep-blue wraps", "violet blank, gold fittings", "gold blank, ivory grip, brass"], rod_titanium: ["polished steel, glowing lilac wraps"],
    rod_tidewarden: ["brighter teal", "bright teal, brighter gold"], rod_tempest: ["paler ice", "ice blue, pale white"] };
  const RODS = ALL.filter((r) => r.awakenings.length).map((r) => ({ ...r, note: NOTE[r.key], awakenings: r.awakenings.map((a, i) => ({ ...a, finish: LOOK[r.key][i] })) }));
  const rows = RODS.map((r) => `<tr class=rod><td class=n><b>${r.name}</b></td><td class=n>${r.rarity}</td><td>base</td>${STAT_KEYS.map((k) => `<td>${r.base[k]}</td>`).join("")}<td class=p>${r.passive ? `${r.passive.name}: ${r.passive.text}` : ""}</td><td class=p>${r.note}</td></tr>`
    + r.awakenings.map((a, i) => `<tr><td></td><td class=n>${a.looks}</td><td>${a.at.toLocaleString()} fish</td>${STAT_KEYS.map((k) => { const d = a.base[k] - (i ? r.awakenings[i - 1].base[k] : r.base[k]); return `<td>${a.base[k]}${d ? ` <i>+${d}</i>` : ""}</td>`; }).join("")}<td class=p>${a.passive ? `${a.passive.name}: ${a.passive.text}` : ""}${a.hooks ? `${a.passive ? " · " : ""}hooks up to ${a.hooks}` : ""}</td><td class=p>${a.finish ?? ""}</td></tr>`).join("")).join("");
  const html = `<!doctype html><meta charset=utf-8><style>body{font:13px system-ui;margin:24px;color:#222;background:#fff}table{border-collapse:collapse}th,td{padding:5px 8px;text-align:right}
tr.rod td{border-top:1px solid #ddd}th{font-weight:600;color:#666}td.n,th.n{text-align:left}td.p{text-align:left;color:#444;max-width:300px}i{color:#2a8a4a;font-style:normal;font-size:11px}h1{font-size:17px;margin:0 0 4px}p{margin:0 0 14px;color:#666}</style>
<h1>Awakenings per rod (round 7, proposed)</h1><p>Only the Training rod and the epics awaken. Each epic its own way: Titanium once, Tidewarden twice and slow, Tempest twice and quick. Green: what that awakening adds.</p>
<table><tr><th class=n>Rod</th><th class=n>Rarity</th><th>At</th><th>Luck</th><th>Bite</th><th>Line</th><th>Reel</th><th>Lure</th><th>Control</th><th class=n>Passive, hooks</th><th class=n>The look (stand-in)</th></tr>${rows}</table>`;
  const p = await page(1280, 560);
  await p.setContent(html); await shot(p, "rg7-table", true);
  await p.context().close();
}
await browser.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
