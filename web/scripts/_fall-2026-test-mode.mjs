// Fall 2026 round test switch (David tests against the real DB before the
// public launch).
//   node scripts/_fall-2026-test-mode.mjs on   -> both fall rows active but
//        visibility 'internal': hidden from /student/apply, reachable via
//        /student/apply/internal with INTERNAL_ACCESS_CODE (.env.local / Vercel)
//   node scripts/_fall-2026-test-mode.mjs off  -> back to inactive
// The public launch is scripts/_apply-fall-2026-essays.mjs (questions +
// active + public).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SLUGS = ["vp-marketing", "pm"];
const mode = process.argv[2];
if (mode !== "on" && mode !== "off") {
  console.error("Usage: node scripts/_fall-2026-test-mode.mjs on|off");
  process.exit(1);
}

const patch =
  mode === "on"
    ? { is_active: true, visibility: "internal" }
    : { is_active: false, visibility: "public" };

const { data, error } = await admin
  .from("positions")
  .update(patch)
  .in("slug", SLUGS)
  .select("slug, title, is_active, visibility, opens_at, closes_at");
if (error) {
  console.error("✗", error.message);
  process.exit(1);
}
if (!data?.length) {
  console.error("✗ no fall rows. Apply migration 027 first.");
  process.exit(1);
}
console.table(data);
console.log(
  mode === "on"
    ? `\n✓ Test mode ON. Open /student/apply/internal and enter INTERNAL_ACCESS_CODE${env.INTERNAL_ACCESS_CODE ? " (set in .env.local)" : " (MISSING in .env.local)"}.`
    : "\n✓ Test mode OFF. Fall rows inactive again."
);
