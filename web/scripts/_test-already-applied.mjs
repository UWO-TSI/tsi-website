// Verifies the already-applied UX:
// 1. After submitting, role page shows AlreadyAppliedCTA (not the form)
// 2. /student/apply shows "Applied" badge on that role's card
// 3. Direct submit POST returns 409 with friendly message
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

const testEmail = `already-${Date.now()}@tethos-test.dev`;
const { data: u } = await admin.auth.admin.createUser({
  email: testEmail,
  password: "Pass12345!",
  email_confirm: true,
});
const userId = u.user.id;

// Pre-seed an application directly via admin
const { data: vpInternal } = await admin
  .from("positions")
  .select("id")
  .eq("slug", "vp-internal")
  .single();

const { error: insertErr } = await admin.from("applications").insert({
  user_id: userId,
  position_id: vpInternal.id,
  full_name: "Already Applied",
  email: testEmail,
  phone: "555-0000",
  program_major: "SE",
  year_of_study: 4,
  heard_about_us: "Other",
  essay_answers: [],
});
if (insertErr) {
  console.error("Pre-seed failed:", insertErr.message);
  process.exit(1);
}

let exitCode = 0;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
const page = await ctx.newPage();

try {
  // Sign in via the role-page auth modal — mirrors the working e2e.
  // We sign in on the role page first; after login the page reloads
  // and should immediately render the AlreadyAppliedCTA.
  await page.goto(`${APP_URL}/student/apply/vp-internal`, {
    waitUntil: "networkidle",
  });
  await page.click('button:has-text("Sign In / Sign Up")');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', "Pass12345!");
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // ── Test 1: role page shows AlreadyAppliedCTA ────────────────
  console.log("\n=== A. Role page shows AlreadyAppliedCTA ===");
  const alreadyApplied = await page
    .locator("text=Application received")
    .isVisible()
    .catch(() => false);
  const trackButton = await page
    .locator("text=Track application")
    .isVisible()
    .catch(() => false);
  const signInVisible = await page
    .locator("text=Sign in to apply")
    .isVisible()
    .catch(() => false);
  if (alreadyApplied && trackButton && !signInVisible) {
    console.log("✓ AlreadyAppliedCTA shown, no Sign-in CTA");
  } else {
    console.log(
      `✗ alreadyApplied=${alreadyApplied}, trackButton=${trackButton}, signIn=${signInVisible}`
    );
    await page.screenshot({ path: "/tmp/already-applied-fail-A.png", fullPage: true });
    exitCode = 1;
  }

  // ── Test 2: position grid shows "Applied" badge ──────────────
  console.log("\n=== B. /student/apply shows 'Applied' badge ===");
  await page.goto(`${APP_URL}/student/apply`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Find the VP Internal card and look for "Applied"
  const cardWithApplied = await page
    .locator("a[href='/student/apply/vp-internal']")
    .first();
  const cardText = await cardWithApplied.textContent();
  if (cardText && cardText.includes("Applied") && cardText.includes("View")) {
    console.log("✓ VP Internal card shows 'Applied' badge + 'View' CTA");
  } else {
    console.log(`✗ Card text was: ${cardText?.slice(0, 200)}`);
    await page.screenshot({ path: "/tmp/already-applied-fail-B.png", fullPage: true });
    exitCode = 1;
  }

  // ── Test 3: Direct API POST returns 409 ──────────────────────
  console.log("\n=== C. Direct POST /api/applications returns 409 ===");
  const projectRef = SUPA_URL.match(/https:\/\/([^.]+)/)[1];
  const cookies = await ctx.cookies();
  const cookieHeader = cookies
    .filter((c) => c.name.startsWith(`sb-${projectRef}-auth-token`))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const res = await fetch(`${APP_URL}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({
      user_id: userId,
      position_id: vpInternal.id,
      full_name: "Already Applied",
      email: testEmail,
      phone: "555-0000",
      program_major: "SE",
      year_of_study: 4,
      heard_about_us: "Other",
      essay_answers: [],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409 && /already applied/i.test(body.error ?? "")) {
    console.log(`✓ Status 409, error: "${body.error}"`);
  } else {
    console.log(`✗ Status ${res.status}, body: ${JSON.stringify(body)}`);
    exitCode = 1;
  }

  console.log(exitCode === 0 ? "\n✓ Already-applied tests passed." : "\n✗ Failed.");
} finally {
  await browser.close();
  await admin.from("applications").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
  await admin
    .from("positions")
    .update({ opens_at: "2026-05-06T04:00:00Z" })
    .eq("slug", "vp-internal");
  process.exit(exitCode);
}
