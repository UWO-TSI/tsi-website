// Verifies the invite-only flow:
// 1. Public list at /student/apply has only the 3 VPs (no PM/Advisor)
// 2. /student/apply/internal with the right code unlocks PM + Advisor
// 3. Clicking through to /student/apply/pm-internal renders the role
//    page (no 404), with content from recruitment-content.ts
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL || "http://localhost:3001";
const ACCESS_CODE = "tsi-alumni-2026";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 } });
const page = await ctx.newPage();

let exitCode = 0;

try {
  // ── A. Public list shows only VPs ───────────────────────
  console.log("\n=== A. Public list excludes PM + Advisor ===");
  await page.goto(`${APP_URL}/student/apply`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const cardTitles = await page.$$eval(
    'a[href^="/student/apply/"] h3',
    (els) => els.map((e) => e.textContent.trim())
  );
  const hasPM = cardTitles.some((t) => t.toLowerCase().includes("project manager"));
  const hasAdvisor = cardTitles.some((t) => t.toLowerCase().includes("advisor"));
  if (cardTitles.length === 3 && !hasPM && !hasAdvisor) {
    console.log("✓ Only 3 VPs visible:", cardTitles);
  } else {
    console.log(`✗ Unexpected: ${cardTitles.length} cards: ${cardTitles}`);
    exitCode = 1;
  }

  // ── B. Internal page unlocks with code ──────────────────
  console.log("\n=== B. Internal page unlocks with code ===");
  await page.goto(`${APP_URL}/student/apply/internal`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector("text=Welcome back", { timeout: 8000 });
  await page.fill('input[placeholder="access code"]', ACCESS_CODE);
  await page.click('button:has-text("Unlock Positions")');
  await page.waitForSelector("text=Welcome back", { state: "attached" });
  await page.waitForTimeout(2000);
  const internalTitles = await page.$$eval("h2, h3", (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean)
  );
  // After unlock, the heading "Welcome back" stays but cards appear
  const hasPMCard = internalTitles.some((t) =>
    t.toLowerCase().includes("project manager")
  );
  const hasAdvisorCard = internalTitles.some((t) =>
    t.toLowerCase().includes("advisor")
  );
  if (hasPMCard && hasAdvisorCard) {
    console.log("✓ PM + Advisor cards rendered after unlock");
  } else {
    console.log(`✗ Cards visible: ${internalTitles.join(", ")}`);
    exitCode = 1;
  }

  // ── C. Role page resolves PM via sessionStorage code ────
  console.log("\n=== C. Role page resolves PM via stored code ===");
  await page.goto(`${APP_URL}/student/apply/pm-internal`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(2000);
  const pmTitle = await page
    .locator("h1:has-text('Project Manager')")
    .first()
    .isVisible()
    .catch(() => false);
  const pmTagline = await page
    .locator("text=/CEO of your own project/")
    .isVisible()
    .catch(() => false);
  const autonomyNote = await page
    .locator("text=/high degree of autonomy/")
    .isVisible()
    .catch(() => false);
  if (pmTitle && pmTagline && autonomyNote) {
    console.log("✓ PM role page renders with full content");
  } else {
    console.log(
      `✗ pmTitle=${pmTitle}, pmTagline=${pmTagline}, autonomyNote=${autonomyNote}`
    );
    await page.screenshot({ path: "/tmp/internal-flow-fail.png", fullPage: true });
    exitCode = 1;
  }

  // ── D. Advisor role page resolves too ──────────────────
  console.log("\n=== D. Advisor role page resolves ===");
  await page.goto(`${APP_URL}/student/apply/advisor`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(2000);
  const advTitle = await page
    .locator("h1:has-text('Advisor')")
    .first()
    .isVisible()
    .catch(() => false);
  const advTagline = await page
    .locator("text=/board of advisors/")
    .first()
    .isVisible()
    .catch(() => false);
  const examples = await page
    .locator("text=Examples of ideas")
    .isVisible()
    .catch(() => false);
  if (advTitle && advTagline && examples) {
    console.log("✓ Advisor role page renders with full content");
  } else {
    console.log(
      `✗ advTitle=${advTitle}, advTagline=${advTagline}, examples=${examples}`
    );
    exitCode = 1;
  }

  // ── E. Bad code is rejected ────────────────────────────
  console.log("\n=== E. Wrong code is rejected ===");
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${APP_URL}/student/apply/internal`, {
    waitUntil: "networkidle",
  });
  await p2.fill('input[placeholder="access code"]', "wrong-code-xyz");
  await p2.click('button:has-text("Unlock Positions")');
  await p2.waitForTimeout(2000);
  const errorVisible = await p2
    .locator("text=Invalid access code")
    .isVisible()
    .catch(() => false);
  if (errorVisible) {
    console.log("✓ Invalid code rejected with error message");
  } else {
    console.log("✗ No invalid-code error shown");
    exitCode = 1;
  }
  await ctx2.close();

  console.log(
    exitCode === 0
      ? "\n✓ Internal-flow tests passed."
      : "\n✗ Some failed."
  );
} finally {
  await browser.close();
  process.exit(exitCode);
}
