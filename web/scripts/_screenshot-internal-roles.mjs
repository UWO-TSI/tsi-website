import { chromium } from "playwright";

const APP_URL = process.env.APP_URL || "http://localhost:3001";
const ACCESS_CODE = "tsi-alumni-2026";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
const page = await context.newPage();

// Unlock first
await page.goto(`${APP_URL}/student/apply/internal`, { waitUntil: "networkidle" });
await page.waitForSelector('input[placeholder="access code"]');
await page.fill('input[placeholder="access code"]', ACCESS_CODE);
await page.click('button:has-text("Unlock Positions")');
await page.waitForTimeout(2500);

// Internal landing
await page.screenshot({ path: "/tmp/internal-landing.png", fullPage: true });
console.log("✓ /tmp/internal-landing.png");

for (const slug of ["pm-internal", "advisor"]) {
  await page.goto(`${APP_URL}/student/apply/${slug}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `/tmp/role-${slug}.png`, fullPage: true });
  console.log(`✓ /tmp/role-${slug}.png`);
}

await browser.close();
