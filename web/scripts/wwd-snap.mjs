// Quick snap script: loads the home page, scrolls through the What We Do
// section, captures screenshots at 4 key scroll positions, + reports errors.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:3000/";
const OUT = process.env.OUT || "/tmp/wwd";

const shots = [
  { y: 0, name: "00-hero", wait: 2500 },
  { y: "sectionTop-500", name: "10-orb-intact", wait: 900 },
  { y: "sectionTop-100", name: "20-orb-detonating", wait: 900 },
  { y: "sectionTop+200", name: "30-headline", wait: 1200 },
  { y: "sectionTop+900", name: "40-pillars", wait: 1200 },
];

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1512, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 240)}`);
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1500);

  const sectionTop = await page.evaluate(() => {
    const s = document.querySelector("section#about");
    return s ? s.getBoundingClientRect().top + window.scrollY : 0;
  });

  for (const { y, name, wait } of shots) {
    let target = 0;
    if (typeof y === "number") target = y;
    else if (typeof y === "string") {
      const op = y.includes("+") ? "+" : "-";
      const [, num] = y.split(op);
      target = op === "+" ? sectionTop + Number(num) : sectionTop - Number(num);
    }
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: "instant" }), target);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`snapped ${name} @ y=${target}`);
  }

  // One full-section capture for overall rhythm
  await page.evaluate(() => {
    const s = document.querySelector("section#about");
    if (s) s.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/50-section-top.png`, fullPage: false });

  if (errors.length) {
    console.log("\n=== PAGE ERRORS ===");
    for (const e of errors.slice(0, 10)) console.log(e);
  } else {
    console.log("\nno page errors.");
  }

  await browser.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
