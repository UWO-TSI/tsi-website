import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1800 },
});
const page = await context.newPage();
await page.goto("http://localhost:3001/student/apply", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1000);
await page.screenshot({ path: "/tmp/apply-list.png", fullPage: true });
await browser.close();
console.log("Saved /tmp/apply-list.png");
