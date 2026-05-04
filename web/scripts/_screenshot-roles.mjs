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
const APP_URL = process.env.APP_URL || "http://localhost:3001";
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Temporarily open all 3 VPs so we can see the read phase fully
await admin
  .from("positions")
  .update({ opens_at: "2026-04-01T00:00:00Z" })
  .in("slug", ["vp-internal", "vp-external", "vp-marketing"]);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 1800 },
});

for (const slug of ["vp-external", "vp-internal", "vp-marketing"]) {
  const page = await context.newPage();
  await page.goto(`${APP_URL}/student/apply/${slug}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500);
  // Scroll once to trigger any below-the-fold animations
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForTimeout(500);
  const path = `/tmp/role-${slug}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`✓ ${slug} → ${path}`);
  await page.close();
}

await browser.close();

// Restore opens_at
await admin
  .from("positions")
  .update({ opens_at: "2026-05-06T04:00:00Z" })
  .in("slug", ["vp-internal", "vp-external", "vp-marketing"]);
console.log("\nDone.");
