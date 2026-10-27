// Day, dusk and night frames of the member island from the measurement build, for before/after look checks
// (specs/lanes/loading.md).   PORT=3151 OUT=<dir> node specs/perf/load-shots.mjs <prefix>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [PREFIX = "shot"] = process.argv.slice(2), PORT = process.env.PORT ?? 3151, OUT = process.env.OUT ?? "specs/evidence/loading";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
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
