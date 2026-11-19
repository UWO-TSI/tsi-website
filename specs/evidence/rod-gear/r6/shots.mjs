// rod-gear round 6 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run: PW=<path to playwright/index.mjs> SHELL_BIN=<chrome-headless-shell> BASE=http://localhost:<port> node specs/evidence/rod-gear/r6/shots.mjs
// The harness (/dev/economy) seeds the catch counts: Flimsy 50, Cedar 37, Glass 12, Training &tc= (31), Tidewarden &tdc= (120);
// the Training rod is traded for unless &found=0. The awakening strip's frames are joined with ImageMagick (magick +append).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const OUT = dirname(fileURLToPath(import.meta.url));
const ONLY = process.env.ONLY?.split(",");
const want = (k) => !ONLY || ONLY.includes(k);

const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
async function page(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style"); s.textContent = ".ld-overlay { display: none !important; }"; document.head.append(s);
  }));
  p.on("pageerror", (e) => errors.push(String(e)));
  return p;
}
const shot = (p, file, full = false) => p.screenshot({ path: join(OUT, `${file}.png`), fullPage: full });
const shop = async (p, q = "") => { await p.goto(`${BASE}/dev/economy?view=overlay&section=rods${q}`); await p.getByTestId("shop-card").first().waitFor({ timeout: 120000 }); await p.waitForTimeout(1500); };
const bagRod = async (p, q, name) => {
  await p.goto(`${BASE}/dev/economy?view=bag${q}`); await p.getByRole("button", { name: new RegExp(`^${name}`) }).waitFor({ timeout: 120000 }); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: new RegExp(`^${name}`) }).click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(3500);
};

for (const [w, h, pre] of [[1280, 800, "rg6"], [390, 844, "rg6-phone"]]) {
  const p = await page(w, h);
  if (want("shop")) {
    await shop(p, "&found=0"); await shot(p, `${pre}-shop-teaser`, true);
    await shop(p);
    await p.getByRole("button", { name: /^Glass rod,/ }).click(); await p.getByTestId("shop-detail").waitFor(); await p.waitForTimeout(3500);
    await shot(p, `${pre}-shop-glass`);
  }
  if (want("cards")) {
    await bagRod(p, "&tc=49", "Training rod"); await shot(p, `${pre}-training-before`, true);
    await bagRod(p, "&tc=50", "Training rod"); await shot(p, `${pre}-training-after`, true);
    await bagRod(p, "&tide=1", "Tidewarden rod"); await shot(p, `${pre}-tidewarden-bar`, true);
    await bagRod(p, "", "Glass rod"); await shot(p, `${pre}-glass-passive`, true);
  }
  if (want("awaken")) {
    // Where the card rests (a first load), then the frames on a second: before it, as it springs in, and at rest.
    await p.goto(`${BASE}/dev/economy?view=awaken`);
    await p.getByText("Awakened!").waitFor({ timeout: 120000 }); await p.waitForTimeout(1000);
    const bb = await p.getByText("Awakened!").boundingBox();
    const clip = { x: Math.max(0, bb.x - 120), y: Math.max(0, bb.y - 50), width: Math.min(450, w - Math.max(0, bb.x - 120)), height: 185 };
    await p.goto(`${BASE}/dev/economy?view=awaken`);
    await p.waitForFunction(() => document.querySelector("main") !== null, null, { timeout: 120000 });
    const frames = [];
    const grab = async (i) => { const f = join(OUT, `.awaken-${pre}-${i}.png`); frames.push(f); await p.screenshot({ path: f, clip }); };
    await grab(0);
    await p.getByText("Awakened!").waitFor({ state: "attached", timeout: 120000 });
    await grab(1); await grab(2); await p.waitForTimeout(900); await grab(3);
    execFileSync("magick", [...frames, "-bordercolor", "white", "-border", "6", "+append", join(OUT, `${pre}-awaken-strip.png`)]);
    execFileSync("rm", frames);
  }
  if (want("trade")) {
    await p.goto(`${BASE}/dev/economy?view=trade&found=0`); await p.getByTestId("rod-seller").waitFor({ timeout: 120000 }); await p.waitForTimeout(800);
    await shot(p, `${pre}-quest-talk`);
    await p.getByRole("button", { name: "Trade the Flimsy rod" }).click(); await p.getByText("Keep fishing with it.").waitFor(); await p.waitForTimeout(1200);
    await shot(p, `${pre}-quest-traded`);
  }
  await p.close();
}

if (want("table")) {
  // The rescaled table (lib/game/rods.ts, 2026-11-04), old beside new: luck, bite, strength, reel, lure, control.
  const OLD = { Flimsy: [10, 10, 10, 10, 10, 10], Training: [30, 40, 30, 35, 30, 40], Precision: [15, 30, 15, 15, 15, 35], Cedar: [30, 30, 20, 20, 30, 20], Carrot: [35, 25, 25, 25, 40, 20],
    Glass: [40, 40, 30, 40, 30, 50], Riptide: null, Lighthouse: [50, 60, 50, 50, 50, 40], Titanium: null, Tidewarden: [70, 80, 70, 60, 60, 60], Tempest: null };
  const NEW = [["Flimsy", "common", [10, 10, 10, 10, 10, 10], "", "starter"], ["Training", "common", [12, 12, 12, 12, 12, 12], "awakens at 50 / 250 / 1000 to 36-38 / 56-62 / 94-100 (a surprise)", "traded"],
    ["Precision", "common", [12, 22, 12, 12, 12, 26], "", "1,000 (was 200)"], ["Cedar", "uncommon", [22, 20, 18, 16, 22, 16], "", "2,500 (was 400)"], ["Carrot", "uncommon", [22, 16, 18, 18, 30, 16], "", "3,000 (was 550)"],
    ["Glass", "rare", [36, 34, 16, 36, 30, 44], "Sunlit: +10 control in sunny weather", "6,000 (was 1,200)"], ["Riptide", "rare", [30, 30, 36, 42, 34, 30], "Current: +10 reel speed in the sea", "crafted"],
    ["Lighthouse", "rare", [44, 46, 38, 36, 40, 34], "Beacon: +10 luck after dark", "crafted"],
    ["Titanium", "epic", [46, 50, 68, 56, 44, 48], "Steel line: +10 line strength in rivers and ponds; awakens +6 at 200, +12 at 800", "crafted"],
    ["Tidewarden", "epic", [56, 64, 56, 50, 50, 50], "Tide keeper: +10 line strength in the sea; awakens +6 at 200, +12 and +10 luck in the sea at 800", "crafted"],
    ["Tempest", "epic", [60, 52, 54, 64, 58, 46], "Storm born: +10 reel speed and +10 luck in the rain; awakens +6 at 200, +12 at 800", "quest or event"]];
  const cells = (a) => (a ? a.map((v) => `<td>${v}</td>`).join("") : `<td colspan=6 class=q>new</td>`);
  const html = `<!doctype html><meta charset=utf-8><style>body{font:13px system-ui;margin:24px;color:#222;background:#fff}table{border-collapse:collapse}th,td{padding:5px 8px;border-bottom:1px solid #e6e6e6;text-align:right}
th{font-weight:600;color:#666}td.n,th.n{text-align:left}td.q{color:#999;text-align:center}.sep{border-left:2px solid #ccc}td.p{text-align:left;color:#444;max-width:360px}h1{font-size:17px;margin:0 0 4px}p{margin:0 0 14px;color:#666}</style>
<h1>Rods rescaled (round 6)</h1><p>Luck, bite window, line strength, reel speed, lure, control. Legendary about 100, Divine 110 to 120 (cap 120). Glass's line is its weakest stat.</p>
<table><tr><th class=n>Rod</th><th class=n>Rarity</th><th colspan=6>Old</th><th class=sep colspan=6>New</th><th class=n>Passive and awakenings</th><th class=n>Price</th></tr>
<tr><th></th><th></th>${["L", "B", "S", "R", "Lu", "C"].map((k) => `<th>${k}</th>`).join("")}${["L", "B", "S", "R", "Lu", "C"].map((k, i) => `<th${i ? "" : " class=sep"}>${k}</th>`).join("")}<th></th><th></th></tr>
${NEW.map(([n, r, s, pas, price]) => `<tr><td class=n><b>${n}</b></td><td class=n>${r}</td>${cells(OLD[n])}${s.map((v, i) => `<td${i ? "" : " class=sep"}><b>${v}</b></td>`).join("")}<td class=p>${pas}</td><td class=n>${price}</td></tr>`).join("")}</table>`;
  const p = await page(1280, 560);
  await p.setContent(html); await shot(p, "rg6-table", true);
  await p.close();
}
await browser.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
