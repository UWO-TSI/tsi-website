import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [label, outDir] = process.argv.slice(2);
const base = "http://localhost:3333";
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const lab = { residents: "/lab/avatar?sheet=residents&framing=body", styles: "/lab/avatar?sheet=styles", hats: "/lab/avatar?sheet=hats" };
for (const [name, url] of Object.entries(lab)) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(base + url, { timeout: 180000 });
  await page.waitForSelector("canvas", { timeout: 150000 });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${outDir}/${label}-${name}.png` });
  await page.context().close();
}
// the island at the spawn (a returning member: look cached), standing and mid-walk (the clip base playing)
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem("tsi.look.v1", "{}"); localStorage.setItem("tsi.welcomed.v1", "1"); } catch {} });
const page = await ctx.newPage();
await page.goto(base + "/student/dashboard?time=day&weather=clear&season=summer&at=17,104", { timeout: 180000 });
await page.getByRole("button", { name: "Skip", exact: true }).click({ timeout: 90000 }).catch(() => {});
await page.waitForFunction(() => document.querySelector("canvas") && ![...document.querySelectorAll("[role=status]")].some(e => /Preparing the island|Tethos Island/.test(e.textContent) && !e.hasAttribute("data-leaving")), null, { timeout: 150000, polling: 250 });
await page.waitForTimeout(6000);
const clip = { x: 440, y: 150, width: 400, height: 500 };
await page.screenshot({ path: `${outDir}/${label}-spawn.png`, clip });
await page.keyboard.down("w"); await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/${label}-walk.png`, clip });
await page.keyboard.up("w");
await browser.close();
