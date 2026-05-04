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
const admin = createClient(SUPA_URL, SVC_KEY, {
  auth: { persistSession: false },
});

// Open vp-internal so the form is reachable
await admin
  .from("positions")
  .update({ opens_at: "2026-04-01T00:00:00Z" })
  .eq("slug", "vp-internal");

const testEmail = `screenshot-${Date.now()}@tethos-test.dev`;
const { data: u } = await admin.auth.admin.createUser({
  email: testEmail,
  password: "Pass12345!",
  email_confirm: true,
});
const userId = u.user.id;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1500 },
});
const page = await context.newPage();

try {
  await page.goto(`${APP_URL}/student/apply/vp-internal`, {
    waitUntil: "networkidle",
  });
  await page.click('button:has-text("Sign In / Sign Up")');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', "Pass12345!");
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForURL("**/student/apply/vp-internal**");
  await page.waitForLoadState("networkidle");
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })
    );
    await page.waitForTimeout(300);
    const v = await page
      .locator('text=/I\'ve read the full role description/')
      .first()
      .isVisible()
      .catch(() => false);
    if (v) break;
  }
  await page.locator('text=/I\'ve read the full role description/').first().click();
  await page.click('button:has-text("Start application")');
  await page.waitForSelector("text=Personal Info");
  await page.waitForTimeout(800);

  await page.screenshot({ path: "/tmp/form-step0.png", fullPage: true });
  console.log("✓ /tmp/form-step0.png");
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(userId);
  await admin
    .from("positions")
    .update({ opens_at: "2026-05-04T00:00:00Z" })
    .eq("slug", "vp-internal");
}
