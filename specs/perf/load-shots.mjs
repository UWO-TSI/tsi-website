// Day, dusk and night frames of the member island from the measurement build, for before/after look checks
// (specs/lanes/loading.md).   PORT=3151 OUT=<dir> node specs/perf/load-shots.mjs <prefix>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [PREFIX = "shot"] = process.argv.slice(2), PORT = process.env.PORT ?? 3151, OUT = process.env.OUT ?? "specs/evidence/loading";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
// LOADING=1: the loading screen itself, every 0.6 s from Let's Play until it lifts, on a slow line so it can be seen.
if (process.env.LOADING === "1") {
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: 12e6 / 8, uploadThroughput: 3e6 / 8 });
    await page.goto(`http://localhost:${PORT}/student/dashboard?arrival=1`, { waitUntil: "commit" });
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(600);
      const up = await page.evaluate(() => [...document.querySelectorAll("[role=status]")].some(e => e.textContent.includes("Tethos Island") && !e.hasAttribute("data-leaving")));
      if (!up && i > 2) break;
      await page.screenshot({ path: `${OUT}/${PREFIX}-${w}-${String(i).padStart(2, "0")}.png` });
    }
    await page.context().close();
  }
  await browser.close();
  process.exit(0);
}
for (const time of ["day", "evening", "night"]) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`http://localhost:${PORT}/student/dashboard?time=${time}&weather=clear&season=summer`);
  // Signed out with no look saved, the character creator opens first: skip it.
  await page.getByRole("button", { name: "Skip", exact: true }).click({ timeout: 120000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector("canvas") && ![...document.querySelectorAll("[role=status]")].some(e => e.textContent.includes("Preparing the island")), null, { timeout: 120000, polling: 250 })
    .catch(async e => { await page.screenshot({ path: `${OUT}/${PREFIX}-${time}-stuck.png` }); console.log(await page.evaluate(() => document.body.innerText.slice(0, 300))); throw e; });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${PREFIX}-${time}.png` });
  console.log(`${OUT}/${PREFIX}-${time}.png`);
  await page.context().close();
}
await browser.close();
