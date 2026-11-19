// rod-titanium round 2 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run under the devserver lock through serve.sh: ONLY=look|stages|clips|... node specs/evidence/rod-titanium/r2/shots.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const OUT = process.env.OUT ?? dirname(fileURLToPath(import.meta.url));
const ONLY = process.env.ONLY?.split(",");
const want = (k) => !ONLY || ONLY.includes(k);
const GPU = process.env.GPU === "1" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", ...GPU] });
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
/** The bag's Titanium rod open (ti fish landed with it). */
async function bagRod(p, ti) {
  await p.goto(`${BASE}/dev/economy?view=bag&ti=${ti}`);
  const card = p.getByRole("button", { name: /^Titanium rod/ });
  await card.waitFor({ timeout: 180000 }); await p.waitForTimeout(1200);
  await card.click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(4500);
}

if (want("look")) {
  const p = await page(900, 760);
  for (const ti of [0, 400]) {
    await bagRod(p, ti);
    for (let i = 0; i < 4; i++) { await p.getByTestId("bag-rod").locator("canvas").first().screenshot({ path: join(OUT, `look-${ti}-${i}.png`) }); await p.waitForTimeout(1400); }
  }
}
if (want("wb")) {
  const p = await page(1280, 800);
  await p.goto(`${BASE}/dev/flat-ui?surface=crafting&crafting=demo`); await p.waitForTimeout(15000);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: true })));
  await p.getByRole("button", { name: /Use the workbench/ }).click(); await p.waitForTimeout(3000);
  await p.screenshot({ path: join(OUT, "wb.png") });
  console.log((await p.getByRole("button").allTextContents()).join(" | ").slice(0, 1500));
}

if (want("stages")) {
  // The Titanium where it shows: the workbench's recipe (it isn't on the shop's shelf: epic, crafted), the bag's tools
  // shelf and the rod open in it, closed (0 fish) and awakened (400), on a desktop and a phone.
  for (const [dev, w, h] of [["desktop", 1280, 800], ["phone", 390, 844]]) {
    const p = await page(w, h);
    await p.goto(`${BASE}/dev/flat-ui?surface=crafting&crafting=demo&ti=1`);
    const bench = p.getByRole("button", { name: /Use the workbench/ });
    await p.waitForFunction(() => document.querySelector("main.gui"), null, { timeout: 180000 }); await p.waitForTimeout(2000);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: true })));
    await bench.click();
    const recipe = p.getByRole("button", { name: /^Titanium rod/ }).first();
    await recipe.waitFor({ timeout: 60000 }); await recipe.click();
    await p.getByTestId("recipe-detail").waitFor(); await p.waitForTimeout(4500);
    await p.screenshot({ path: join(OUT, `rti2-workbench-${dev}.png`) });
    for (const ti of [0, 400]) {
      await p.goto(`${BASE}/dev/economy?view=bag&ti=${ti}`);
      await p.getByRole("button", { name: /^Titanium rod/ }).waitFor({ timeout: 180000 }); await p.waitForTimeout(1500);
      await p.screenshot({ path: join(OUT, `rti2-bag-${ti ? "awakened" : "closed"}-shelf-${dev}.png`) });
      await p.getByRole("button", { name: /^Titanium rod/ }).click(); await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(4500);
      await p.screenshot({ path: join(OUT, `rti2-bag-${ti ? "awakened" : "closed"}-${dev}.png`) });
    }
    await p.context().close();
  }
}

if (want("cut")) {
  // The cutscene's first frame (the closed rod) and its reveal (the mecha form), large.
  const p = await page(1280, 800);
  await p.goto(`${BASE}/dev/economy?view=awakening&rod=rod_titanium&stage=1`);
  await p.locator('[data-testid="rod-awakening"][data-ready]').waitFor({ timeout: 180000 });
  await p.waitForTimeout(300); await p.screenshot({ path: join(OUT, "cut-start.png") });
  await p.locator('[data-phase="show"]').first().waitFor({ timeout: 30000 }); await p.waitForTimeout(900);
  await p.screenshot({ path: join(OUT, "cut-show.png") });
  await p.locator('[data-phase="reveal"]').first().waitFor({ timeout: 30000 }); await p.waitForTimeout(2500);
  await p.screenshot({ path: join(OUT, "cut-reveal.png") });
}
if (want("cards")) {
  // The draws-and-triangles card and the questions card (cards.html), each its own still.
  const p = await page(1000, 800);
  await p.goto(`file://${join(OUT, "cards.html")}`);
  for (const id of ["questions"]) await p.locator(`#${id}`).screenshot({ path: join(OUT, `rti2-${id}.png`) });
}

/** Record a page as a CDP screencast from `go` until `until` resolves, made an mp4 with ffmpeg (each frame held until the next came). */
async function record(name, w, h, go, until) {
  const ff = (...a) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a]);
  const dir = join(OUT, `.video-${name}`); mkdirSync(dir, { recursive: true });
  const p = await page(w, h), cdp = await p.context().newCDPSession(p), shots = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { shots.push({ data, t: metadata.timestamp }); void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
  await go(p);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  const start = await until(p);
  await cdp.send("Page.stopScreencast");
  await p.context().close();
  const kept = shots.filter((f, i) => f.t >= start || shots[i + 1]?.t > start);
  const list = kept.map((f, i) => { const file = join(dir, `${String(i).padStart(5, "0")}.jpg`); writeFileSync(file, Buffer.from(f.data, "base64"));
    return `file '${file}'\nduration ${((kept[i + 1]?.t ?? f.t + 0.04) - Math.max(f.t, start)).toFixed(4)}`; });
  writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${join(dir, `${String(kept.length - 1).padStart(5, "0")}.jpg`)}'\n`);
  const mp4 = join(OUT, `${name}.mp4`);
  ff("-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", mp4);
  rmSync(dir, { recursive: true });
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString());
  ff("-ss", String(Math.max(0, dur - 0.4)), "-i", mp4, "-frames:v", "1", join(OUT, `${name}-poster.png`));
  console.log(`${name}: ${dur.toFixed(1)} s`);
}

if (want("clips")) {
  // The cutscene: the closed rod to the mecha form (desktop, phone).
  for (const [name, w, h] of [["rti2-awaken", 1280, 800], ["rti2-awaken-phone", 390, 844]]) {
    await record(name, w, h, (p) => p.goto(`${BASE}/dev/economy?view=awakening&rod=rod_titanium&stage=1`), async (p) => {
      await p.locator('[data-testid="rod-awakening"][data-ready]').waitFor({ timeout: 180000 });
      const start = Date.now() / 1000 - 0.3;
      await p.locator('[data-phase="reveal"]').first().waitFor({ timeout: 30000 }); await p.waitForTimeout(3600);
      return start;
    });
  }
  // Each form turning on the bag's stage, as the game draws it (the pixel finish, the studio room in its metal).
  for (const [name, ti] of [["rti2-titanium-stage", 0], ["rti2-a1-stage", 400]]) {
    await record(name, 900, 760, (p) => bagRod(p, ti), async (p) => { const start = Date.now() / 1000; await p.waitForTimeout(11500); return start; });
  }
}

console.log("errors:", errors.length, errors.slice(0, 3).join(" | ").slice(0, 400));
await browser.close();
