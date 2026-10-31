// rod-gear round 2 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run: PW=<path to playwright/index.mjs> BASE=http://localhost:<port> node specs/evidence/rod-gear/r2/shots.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const OUT = dirname(fileURLToPath(import.meta.url));
const TMP = join(OUT, ".frames");
mkdirSync(TMP, { recursive: true });
const ONLY = process.env.ONLY?.split(",");
const want = (k) => !ONLY || ONLY.includes(k);

const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
async function page(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  // The site's intro curtain waits on window load, which a dev page's models can hold back: keep it out of the shots.
  await p.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style"); s.textContent = ".ld-overlay { display: none !important; }"; document.head.append(s);
  }));
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (process.env.DEBUG && m.type() === "error") console.log("console:", m.text().slice(0, 300)); });
  p.on("framenavigated", (f) => { if (process.env.DEBUG && f === p.mainFrame()) console.log("nav", f.url()); });
  return p;
}
const shop = async (p) => { await p.goto(`${BASE}/dev/economy?view=overlay&section=rods`); await p.getByTestId("shop-card").first().waitFor({ timeout: 90000 }); await p.waitForTimeout(1200); };
const open = async (p, name) => { await p.getByRole("button", { name: new RegExp(`^${name},`) }).click(); await p.getByTestId("shop-detail").waitFor(); await p.waitForTimeout(3500); };
const panel = (p) => p.getByTestId("shop-overlay");

if (want("shop")) {
  const p = await page(1280, 800);
  for (const [name, file] of [["Glass rod", "r2-shop-glass"], ["Flimsy rod", "r2-shop-flimsy"], ["Lighthouse rod", "r2-shop-lighthouse"], ["Lucky bobber", "r2-bobber-detail"], ["Sweet bait", "r2-bait-detail"]]) {
    await shop(p);
    await open(p, name);
    await p.screenshot({ path: join(OUT, `${file}.png`) });
  }
  // A corner's hover line.
  await shop(p); await open(p, "Glass rod");
  await p.locator("[data-testid=rod-radar] button").first().hover();
  await p.waitForTimeout(400);
  await p.getByTestId("rod-radar").screenshot({ path: join(OUT, "r2-radar-hover.png") });
  await shop(p); await p.waitForTimeout(1500);
  await p.screenshot({ path: join(OUT, "r2-shop-shelf.png") });
  await p.close();
}

if (want("bag")) {
  const p = await page(1280, 800);
  await p.goto(`${BASE}/dev/economy?view=bag`);
  try { await p.getByRole("button", { name: /^Glass rod/ }).click({ timeout: 60000 }); }
  catch (e) { await p.screenshot({ path: join(TMP, "../debug.png") }); console.log(await p.getByTestId("bag-sheet").innerText().catch(() => "no bag")); throw e; }
  await p.getByTestId("bag-rod").waitFor();
  if (process.env.DEBUG) for (const at of [500, 1000, 1500, 2500]) { await p.waitForTimeout(500); await p.screenshot({ path: join(OUT, `dbg-${at}.png`) }); }
  await p.waitForTimeout(3500);
  await p.screenshot({ path: join(OUT, "r2-bag-rod.png") });
  // The bait slot's list, then the strip as the sweet bait goes on (the radar slides, the bait drops from the tip).
  await p.getByTestId("slot-bait").locator("button").first().click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(OUT, "r2-bag-slot-open.png") });
  const option = p.getByRole("menuitemcheckbox", { name: /Sweet bait/ });
  const frames = [];
  const box = await p.getByTestId("bag-rod").boundingBox(), hex = await p.getByTestId("rod-radar").boundingBox();
  const radar = [];
  await option.click();
  const t0 = Date.now();
  for (const at of [0, 120, 240, 360, 480, 800, 1600]) {
    const wait = at - (Date.now() - t0);
    if (wait > 0) await p.waitForTimeout(wait);
    const f = join(TMP, `strip-${at}.png`), r = join(TMP, `radar-${at}.png`);
    await p.screenshot({ path: f, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 560) } });
    frames.push(f);
    await p.screenshot({ path: r, clip: hex });
    radar.push(r);
  }
  execFileSync("magick", [...frames, "-resize", "50%", "+append", join(OUT, "r2-bag-strip.png")]);
  execFileSync("magick", [...radar, "-resize", "60%", "+append", join(OUT, "r2-radar-strip.png")]);
  await p.screenshot({ path: join(OUT, "r2-bag-rod-both.png") });
  await p.close();
}

if (want("phone")) {
  // A phone, tall enough that the whole detail shows without the panel's own scroll.
  const p = await page(390, 1320);
  await shop(p); await open(p, "Glass rod");
  await p.screenshot({ path: join(OUT, "r2-phone-shop-glass.png") });
  await p.goto(`${BASE}/dev/economy?view=bag`);
  await p.getByRole("button", { name: /^Glass rod/ }).click({ timeout: 90000 });
  await p.getByTestId("bag-rod").waitFor();
  await p.waitForTimeout(2200);
  await p.screenshot({ path: join(OUT, "r2-phone-bag-rod.png") });
  await p.close();
}

if (want("gui")) {
  const p = await page(1280, 900);
  await p.goto(`${BASE}/lab/gui`);
  await p.locator("#radar").waitFor({ timeout: 90000 });
  await p.waitForTimeout(1500);
  // The showroom's fixed layers (toasts, the toc) would sit over a section shot.
  await p.evaluate(() => { for (const el of document.querySelectorAll("body *")) if (getComputedStyle(el).position === "fixed") el.style.display = "none"; });
  await p.locator("#radar").screenshot({ path: join(OUT, "r2-gui-radar.png") });
  await p.locator("#badges").screenshot({ path: join(OUT, "r2-gui-badges.png") });
  await p.close();
}

await browser.close();
rmSync(TMP, { recursive: true, force: true });
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
