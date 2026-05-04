// Additional edge-case verifications.
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

let exitCode = 0;
const browser = await chromium.launch({ headless: true });

// ─────────────────────────────────────────────────────────
// Test A: ?error=auth banner shows
// ─────────────────────────────────────────────────────────
console.log("\n=== A. /student/apply?error=auth shows banner ===");
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${APP_URL}/student/apply?error=auth`, {
    waitUntil: "networkidle",
  });
  const visible = await page
    .locator("text=Sign-in didn't complete")
    .isVisible()
    .catch(() => false);
  if (visible) console.log("✓ Banner visible");
  else {
    console.log("✗ Banner not found");
    exitCode = 1;
  }
  await ctx.close();
}

// ─────────────────────────────────────────────────────────
// Test B: vp-internal "upcoming" — form is gated, no apply button
// ─────────────────────────────────────────────────────────
console.log("\n=== B. Upcoming role: UpcomingCTA shown, no Sign-in CTA ===");
{
  // Ensure opens_at is in future
  await admin
    .from("positions")
    .update({ opens_at: "2026-05-06T04:00:00Z" })
    .eq("slug", "vp-internal");

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${APP_URL}/student/apply/vp-internal`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);
  const upcomingVisible = await page
    .locator("text=/Opens May/")
    .isVisible()
    .catch(() => false);
  const signInVisible = await page
    .locator("text=Sign in to apply")
    .isVisible()
    .catch(() => false);
  if (upcomingVisible && !signInVisible) {
    console.log("✓ UpcomingCTA shown, signed-in path correctly skipped");
  } else {
    console.log(
      `✗ upcoming=${upcomingVisible}, signIn=${signInVisible} (want true, false)`
    );
    exitCode = 1;
  }
  await ctx.close();
}

// ─────────────────────────────────────────────────────────
// Test C: Replace upload — verify old file deleted
// ─────────────────────────────────────────────────────────
console.log("\n=== C. Replace upload: old object removed ===");
{
  // Open vp-internal temporarily
  await admin
    .from("positions")
    .update({ opens_at: "2026-04-01T00:00:00Z" })
    .eq("slug", "vp-internal");

  const testEmail = `replace-test-${Date.now()}@tethos-test.dev`;
  const { data: u } = await admin.auth.admin.createUser({
    email: testEmail,
    password: "TestPassword12345!",
    email_confirm: true,
  });
  const userId = u.user.id;

  const pdfA = "/tmp/test-A.pdf";
  const pdfB = "/tmp/test-B.pdf";
  writeFileSync(pdfA, "%PDF-1.4\nA\n%%EOF\n");
  writeFileSync(pdfB, "%PDF-1.4\nB\n%%EOF\n");

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${APP_URL}/student/apply/vp-internal`, {
      waitUntil: "networkidle",
    });
    await page.click('button:has-text("Sign In / Sign Up")', { timeout: 8000 });
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', "TestPassword12345!");
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForURL("**/student/apply/vp-internal**");
    await page.waitForLoadState("networkidle");

    for (let i = 0; i < 6; i++) {
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })
      );
      await page.waitForTimeout(400);
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

    // Skip to step 1 without proper personal-info — just navigate via Next.
    // Fill minimal then go to step 1.
    await page.waitForTimeout(800);
    await page.fill('input[name="full_name"]', "R. Tester");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="phone"]', "555-0001");
    await page.fill('input[name="program_major"]', "SE");
    await page.click("text=4th Year");
    await page.click('text="Other"');
    await page.click('button:has-text("Next")');
    await page.waitForSelector("text=Upload your resume");

    // Upload A
    const fileInput = await page.$('input[type="file"]');
    await fileInput.setInputFiles(pdfA);
    await page.waitForSelector("text=· uploaded", { timeout: 15000 });

    const { data: objsAfterA } = await admin.storage
      .from("resumes")
      .list(userId);
    if (objsAfterA.length !== 1) {
      throw new Error(`Expected 1 object after A, got ${objsAfterA.length}`);
    }
    const pathA = `${userId}/${objsAfterA[0].name}`;
    console.log("After A:", pathA.split("/").pop());

    // Click X to remove, then upload B
    await page.click('button[aria-label="Remove resume"]');
    await page.waitForTimeout(800);
    await page.waitForSelector("text=Click to upload");
    const fileInput2 = await page.$('input[type="file"]');
    await fileInput2.setInputFiles(pdfB);
    await page.waitForSelector("text=· uploaded", { timeout: 15000 });

    // Wait for storage delete + upload
    await page.waitForTimeout(1500);
    const { data: objsAfterB } = await admin.storage
      .from("resumes")
      .list(userId);
    console.log(
      "After remove+B, files in folder:",
      objsAfterB.map((o) => o.name)
    );
    if (objsAfterB.length === 1 && !objsAfterB[0].name.includes(pathA.split("/").pop())) {
      console.log("✓ Old object replaced by new one");
    } else {
      console.log(`✗ Folder state unexpected (${objsAfterB.length} files)`);
      exitCode = 1;
    }

    // Cleanup
    for (const o of objsAfterB) {
      await admin.storage.from("resumes").remove([`${userId}/${o.name}`]);
    }
  } finally {
    await ctx.close();
    await admin.auth.admin.deleteUser(userId);
    // Restore opens_at
    await admin
      .from("positions")
      .update({ opens_at: "2026-05-06T04:00:00Z" })
      .eq("slug", "vp-internal");
  }
}

await browser.close();
console.log(exitCode === 0 ? "\n✓ Edge-case tests passed." : "\n✗ Some failed.");
process.exit(exitCode);
