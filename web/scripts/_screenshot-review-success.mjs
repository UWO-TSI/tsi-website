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

const pdfPath = "/tmp/screenshot-resume.pdf";
writeFileSync(pdfPath, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1500 },
});
const page = await context.newPage();
let appId = null;
let storagePath = null;

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

  await page.fill('input[name="full_name"]', "David Liu");
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="phone"]', "555-0100");
  await page.fill('input[name="program_major"]', "Software Engineering");
  await page.click("text=4th Year");
  await page.click('text="Friend / Word of Mouth"');
  await page.click('button:has-text("Next")');
  await page.waitForSelector("text=Upload your resume");

  const fileInput = await page.$('input[type="file"]');
  await fileInput.setInputFiles(pdfPath);
  await page.waitForSelector("text=· uploaded", { timeout: 15000 });

  const { data: objs } = await admin.storage.from("resumes").list(userId);
  if (objs?.length > 0) storagePath = `${userId}/${objs[0].name}`;

  await page.click('button:has-text("Next")');
  await page.waitForSelector("textarea");

  const textareas = await page.$$("textarea");
  for (const t of textareas) {
    await t.fill(
      "This is a focused test answer that meets the minimum length without going overboard."
    );
  }
  await page.click('button:has-text("Next")');
  await page.waitForSelector("text=Review your application");
  await page.waitForTimeout(500);

  await page.screenshot({ path: "/tmp/form-review.png", fullPage: true });
  console.log("✓ /tmp/form-review.png");

  await page.click(
    'text=/I confirm the information above is accurate/'
  );
  await page.waitForTimeout(200);
  await page.click('button:has-text("Submit Application")');
  await page.waitForSelector('text=/Thanks,|Your application is in/', {
    timeout: 30000,
  });
  await page.waitForTimeout(800);

  await page.screenshot({ path: "/tmp/form-success.png", fullPage: true });
  console.log("✓ /tmp/form-success.png");

  const { data: appRow } = await admin
    .from("applications")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (appRow) appId = appRow.id;
} finally {
  await browser.close();
  if (appId) await admin.from("applications").delete().eq("id", appId);
  if (storagePath) await admin.storage.from("resumes").remove([storagePath]);
  await admin.auth.admin.deleteUser(userId);
  await admin
    .from("positions")
    .update({ opens_at: "2026-05-04T00:00:00Z" })
    .eq("slug", "vp-internal");
}
