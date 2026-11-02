// Title left-side shots (specs/lanes/title-r2.md). Headless, muted. Against next dev on PORT.
//   PORT=3330 OUT=<dir> node specs/evidence/title-r2/shoot.mjs <label>
// Desktop 1440x900 and phone 390x844, day and night, the menu; plus the sign-in view (day).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const LABEL = process.argv[2] ?? "shot", PORT = process.env.PORT ?? 3330, OUT = process.env.OUT ?? ".";
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const [size, viewport] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: size === "phone" ? 2 : 1, isMobile: size === "phone", hasTouch: size === "phone" });
  const page = await ctx.newPage();
  for (const [phase, view] of [["day", "menu"], ["night", "menu"], ["day", "signin"]]) {
    const q = new URLSearchParams({ time: phase, weather: "clear", season: "summer", ...(view !== "menu" && { view }) });
    await page.goto(`http://localhost:${PORT}/student?${q}`, { waitUntil: "domcontentloaded", timeout: 300000 });
    await page.waitForSelector("main[data-ready]", { timeout: 240000 }).catch(() => console.log("no ready", size, phase));
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // the dev badge sits on the footer
    await page.waitForTimeout(3000);
    const file = `${OUT}/${LABEL}-${size}-${phase}-${view}.jpg`;
    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    console.log(file);
  }
  await ctx.close();
}
await browser.close();
