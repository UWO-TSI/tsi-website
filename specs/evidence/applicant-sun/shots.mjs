// Applicant island on the real sun (row 239 on the applicant scene). Headless Chromium, 1280x760, High with shadows,
// the applicant preview route (dev only, no sign-in, no submissions) with a saved look so it lands straight on the
// spawn camera. The route has no world-clock preview, so a test-only init script shifts Date by a fixed offset:
// the clock keeps running from the target time and worldNow() (Date.now() anchor) reads it, as setWorldClockOffset would.
//   node specs/evidence/applicant-sun/shots.mjs <outDir> <prefix> HH:MM [HH:MM ...]   (PORT, default 3116; DATE, default 2026-09-30)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, prefix, ...times] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const DATE = process.env.DATE ?? "2026-09-30";
const URL = `http://localhost:${process.env.PORT ?? 3116}/student/apply/portal?preview=1`;
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob",
  top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const at of times) {
  const target = Date.parse(`${DATE}T${at}:00-04:00`); // EDT
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, target]) => {
    try {
      localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false");
      localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false");
    } catch {}
    const Real = Date, offset = target - Real.now();
    globalThis.Date = class extends Real {
      constructor(...a) { if (a.length) super(...a); else super(Real.now() + offset); }
      static now() { return Real.now() + offset; }
    };
    const style = document.createElement("style");
    style.textContent = "html.shot main > :not(:has(canvas)), html.shot nextjs-portal { visibility: hidden !important; }";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  }, [LOOK, target]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  // Loading overlay gone, arrival clouds done, then shaders, the shadow bake and the environment settle.
  await page.waitForFunction(() => !document.querySelector('[role="status"] h1') && !document.querySelector('[aria-label="Arriving through the clouds"]'), null, { timeout: 300000, polling: 1000 });
  await page.waitForTimeout(10000);
  const phase = await page.evaluate(() => document.querySelector("main")?.dataset.time);
  await page.evaluate(() => document.documentElement.classList.add("shot"));
  await page.waitForTimeout(500);
  const box = await page.locator("canvas").first().boundingBox();
  const name = `${prefix}-${DATE}-${at.replace(":", "")}`;
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: box });
  console.log("shot", name, phase);
  await ctx.close();
}
await browser.close();
