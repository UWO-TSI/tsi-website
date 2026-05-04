import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL || "http://localhost:3001";
const admin = createClient(SUPA_URL, SVC_KEY, { auth: { persistSession: false } });

const testEmail = `mkt-shot-${Date.now()}@tethos-test.dev`;
const { data: u } = await admin.auth.admin.createUser({
  email: testEmail,
  password: "Pass12345!",
  email_confirm: true,
});
const userId = u.user.id;

const pdfPath = "/tmp/mkt-resume.pdf";
writeFileSync(pdfPath, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1700 } });
const page = await ctx.newPage();

try {
  await page.goto(`${APP_URL}/student/apply/vp-marketing`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Sign In / Sign Up")');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', "Pass12345!");
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("text=Responsibilities", { timeout: 10000 });
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(400);
    const v = await page.locator('text=/I\'ve read the full role description/').first().isVisible().catch(() => false);
    if (v) break;
  }
  await page.locator('text=/I\'ve read the full role description/').first().click();
  await page.click('button:has-text("Start application")');
  await page.waitForSelector("text=Personal Info");
  await page.waitForTimeout(800);

  await page.fill('input[name="full_name"]', "Test");
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="phone"]', "555-0100");
  await page.fill('input[name="program_major"]', "SE");
  await page.click("text=4th Year");
  await page.click('text="Other"');
  await page.click('button:has-text("Next")');
  await page.waitForSelector("text=Upload your resume");

  const fi = await page.$('input[type="file"]');
  await fi.setInputFiles(pdfPath);
  await page.waitForSelector("text=· uploaded", { timeout: 15000 });
  await page.click('button:has-text("Next")');
  await page.waitForSelector("text=Show, don't tell", { timeout: 8000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "/tmp/vp-marketing-essay.png", fullPage: true });
  console.log("✓ /tmp/vp-marketing-essay.png");
} finally {
  await browser.close();
  // Clean up storage in user folder
  for (const bucket of ["resumes", "portfolios"]) {
    const { data: items } = await admin.storage.from(bucket).list(userId);
    if (items?.length) await admin.storage.from(bucket).remove(items.map((o) => `${userId}/${o.name}`));
  }
  await admin.auth.admin.deleteUser(userId);
}
