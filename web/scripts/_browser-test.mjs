// Headless browser test — drives the actual form UI to catch
// regressions the API-level e2e wouldn't see (state hydration,
// validation, button states, draft autosave behavior, etc.).

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

// Cleanup any prior test users
{
  const { data } = await admin.auth.admin.listUsers();
  for (const u of data.users) {
    if (u.email?.includes("@tethos-test.dev")) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

// Temporarily open vp-internal so the form is reachable during the test.
// Restored in finally{}.
const { data: origPos } = await admin
  .from("positions")
  .select("opens_at")
  .eq("slug", "vp-internal")
  .single();
const ORIG_OPENS_AT = origPos.opens_at;
await admin
  .from("positions")
  .update({ opens_at: "2026-04-01T00:00:00Z" })
  .eq("slug", "vp-internal");

const testEmail = `browser-test-${Date.now()}@tethos-test.dev`;
const testPassword = "BrowserTest12345!";

console.log(`\n→ Test user: ${testEmail}`);

// Pre-create user (skip the email-confirmation flow during the browser test)
const { data: u, error: cuErr } = await admin.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true,
  user_metadata: { full_name: "Browser Tester" },
});
if (cuErr) {
  console.error(cuErr.message);
  process.exit(1);
}
const userId = u.user.id;

// Write a tiny PDF for upload
const pdfPath = "/tmp/test-resume.pdf";
writeFileSync(
  pdfPath,
  Buffer.concat([
    Buffer.from("%PDF-1.4\n", "binary"),
    Buffer.from("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"),
    Buffer.from("2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"),
    Buffer.from("xref\n0 3\n"),
    Buffer.from("trailer<</Size 3/Root 1 0 R>>\n"),
    Buffer.from("startxref\n100\n"),
    Buffer.from("%%EOF\n"),
  ])
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(err.message));

let exitCode = 0;
let appId = null;
let storagePath = null;

try {
  console.log("\n=== Step 1: Open /student/apply ===");
  await page.goto(`${APP_URL}/student/apply`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=2026-27 Recruitment", { timeout: 10000 });

  // The position list should show only the 3 VPs
  const cardTitles = await page.$$eval(
    'a[href^="/student/apply/"] h3',
    (els) => els.map((e) => e.textContent.trim())
  );
  console.log("Visible positions:", cardTitles);
  if (cardTitles.length !== 3) {
    throw new Error(`Expected 3 positions, got ${cardTitles.length}`);
  }
  if (!cardTitles.some((t) => t.includes("VP Internal"))) {
    throw new Error("VP Internal not in list");
  }

  console.log("\n=== Step 2: Click VP Internal ===");
  await page.click('a[href="/student/apply/vp-internal"]');
  await page.waitForSelector("text=Sign in to apply", { timeout: 8000 });
  console.log("✓ Sign-in CTA visible (gated)");

  console.log("\n=== Step 3: Sign in via AuthModal ===");
  await page.click("text=Sign In / Sign Up");
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForURL(`**/student/apply/vp-internal**`, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  // Wait for the role page's init() async work (auth, positions, applications query)
  await page.waitForSelector("text=Responsibilities", { timeout: 10000 });
  await page.waitForTimeout(800);
  console.log("✓ Signed in, back on role page");

  console.log("\n=== Step 4: Scroll, ack, start application ===");
  // Scroll progressively to give IntersectionObserver time to fire on the
  // end-of-content sentinel. instant + a few rAF ticks usually flushes it.
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })
    );
    await page.waitForTimeout(400);
    const ackVisible = await page
      .locator('text=/I\'ve read the full role description/')
      .first()
      .isVisible()
      .catch(() => false);
    if (ackVisible) break;
  }
  await page.locator('text=/I\'ve read the full role description/').first().click();
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start application")');
  await page.waitForSelector("text=Personal Info", { timeout: 8000 });
  console.log("✓ Form opened");

  console.log("\n=== Step 5: Fill personal info (step 0) ===");
  // Wait for hydration to finish (Google name/email prefill)
  await page.waitForTimeout(800);
  await page.fill('input[name="full_name"]', "Browser Tester");
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="phone"]', "555-0100");
  await page.fill('input[name="program_major"]', "Software Engineering");
  await page.click("text=4th Year");
  await page.click('text="Friend / Word of Mouth"');
  await page.waitForTimeout(200);
  await page.click('button:has-text("Next")');
  await page.waitForSelector("text=Upload your resume", { timeout: 6000 });
  console.log("✓ Step 1 complete");

  console.log("\n=== Step 6: Upload resume ===");
  const fileInput = await page.$('input[type="file"]');
  await fileInput.setInputFiles(pdfPath);
  await page.waitForSelector("text=· uploaded", { timeout: 15000 });
  console.log("✓ Resume uploaded");

  // Snag the storage path from supabase storage so we can clean up
  const { data: objs } = await admin.storage
    .from("resumes")
    .list(userId);
  if (objs && objs.length > 0) storagePath = `${userId}/${objs[0].name}`;

  await page.click('button:has-text("Next")');
  await page.waitForSelector("textarea", { timeout: 6000 });
  console.log("\n=== Step 7: Fill essays (step 2) ===");

  const textareas = await page.$$("textarea");
  for (const t of textareas) {
    await t.fill(
      "This is a focused test answer that meets the minimum length without going overboard. It articulates a clear position. It satisfies validation. It exists primarily to verify the form's word-count handling does not erroneously trip when reasonable prose is supplied. End."
    );
  }
  await page.click('button:has-text("Next")');
  await page.waitForSelector("text=Review your application", { timeout: 6000 });
  console.log("✓ Reached review step");

  console.log("\n=== Step 8: Confirm + submit ===");
  await page.click(
    'text="I confirm the information above is accurate. Once submitted, I won\'t be able to edit this application."'
  );
  await page.waitForTimeout(200);
  await page.click('button:has-text("Submit Application")');

  // Watch for either success (Thanks message) or error
  await page.waitForSelector(
    'text=/Thanks, Browser|Your application is in/',
    { timeout: 30000 }
  );
  console.log("✓ Submission succeeded — success screen rendered");

  // Verify in DB
  const { data: appRow } = await admin
    .from("applications")
    .select("id, full_name, resume_drive_url, resume_filename")
    .eq("user_id", userId)
    .single();
  if (!appRow) throw new Error("Application row not found after submit");
  appId = appRow.id;
  console.log("✓ DB row:", {
    id: appRow.id,
    full_name: appRow.full_name,
    has_url: !!appRow.resume_drive_url,
    filename: appRow.resume_filename,
  });

  console.log("\n=== Step 9: Visit dashboard ===");
  await page.goto(`${APP_URL}/student/apply/dashboard`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("text=Your Applications", { timeout: 10000 });
  await page.waitForSelector("text=VP Internal", { timeout: 5000 });
  console.log("✓ Dashboard shows VP Internal application");

  // Try opening resume preview
  await page.click('button:has-text("test-resume")', { timeout: 6000 });
  await page.waitForSelector("iframe", { timeout: 8000 });
  console.log("✓ Resume preview opens (iframe rendered)");

  console.log("\n=== Step 10: Page errors check ===");
  if (pageErrors.length > 0) {
    console.log("⚠ Page errors detected:");
    pageErrors.forEach((e) => console.log("  -", e));
  } else {
    console.log("✓ No page errors");
  }
  if (consoleErrors.length > 0) {
    console.log("⚠ Console errors detected:");
    consoleErrors.slice(0, 10).forEach((e) => console.log("  -", e));
  } else {
    console.log("✓ No console errors");
  }

  console.log("\n✓ Browser test passed.");
} catch (err) {
  console.error("\n✗ FAILED:", err.message);
  // Capture screenshot for debugging
  try {
    await page.screenshot({ path: "/tmp/browser-test-failure.png", fullPage: true });
    console.error("Screenshot at /tmp/browser-test-failure.png");
  } catch {}
  exitCode = 1;
} finally {
  await browser.close();

  console.log("\n=== Cleanup ===");
  if (appId) {
    await admin.from("applications").delete().eq("id", appId);
  }
  if (storagePath) {
    await admin.storage.from("resumes").remove([storagePath]);
  }
  await admin.auth.admin.deleteUser(userId);

  // Restore original opens_at
  await admin
    .from("positions")
    .update({ opens_at: ORIG_OPENS_AT })
    .eq("slug", "vp-internal");

  console.log("Cleaned up.");

  process.exit(exitCode);
}
