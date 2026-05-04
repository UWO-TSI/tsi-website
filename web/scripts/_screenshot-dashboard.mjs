import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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

const testEmail = `dash-shot-${Date.now()}@tethos-test.dev`;
const { data: u } = await admin.auth.admin.createUser({
  email: testEmail,
  password: "Pass12345!",
  email_confirm: true,
});
const userId = u.user.id;

const { data: vp } = await admin
  .from("positions")
  .select("id")
  .eq("slug", "vp-external")
  .single();

const { data: app } = await admin
  .from("applications")
  .insert({
    user_id: userId,
    position_id: vp.id,
    full_name: "David Liu",
    email: testEmail,
    phone: "555-0100",
    program_major: "SE",
    year_of_study: 4,
    heard_about_us: "Other",
    resume_filename: "62509060009.pdf",
    essay_answers: [],
  })
  .select()
  .single();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1500 },
  reducedMotion: "reduce",
});
const page = await context.newPage();

try {
  // Sign in via the role page (proven flow)
  await page.goto(`${APP_URL}/student/apply/vp-internal`, {
    waitUntil: "networkidle",
  });
  await page.click('button:has-text("Sign In / Sign Up")');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', "Pass12345!");
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // Now navigate to dashboard
  await page.goto(`${APP_URL}/student/apply/dashboard`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("text=VP External", { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/tmp/dashboard.png", fullPage: true });
  console.log("✓ /tmp/dashboard.png");
} finally {
  await browser.close();
  if (app) await admin.from("applications").delete().eq("id", app.id);
  await admin.auth.admin.deleteUser(userId);
}
