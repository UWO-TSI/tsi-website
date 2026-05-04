// Quick toggle for live testing.
//   node scripts/_toggle-apps-open.mjs open    -> opens_at moved to the past
//   node scripts/_toggle-apps-open.mjs scheduled -> restores May 6 launch
// closes_at is left at May 13 04:10 UTC (May 13 00:10 EDT) either way.

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

const SLUGS = ["vp-internal", "vp-external", "vp-marketing", "pm-internal", "advisor"];
const SCHEDULED_OPEN = "2026-05-06T04:00:00Z";
const TEST_OPEN = "2026-05-01T00:00:00Z"; // few days in the past

const mode = process.argv[2];
if (mode !== "open" && mode !== "scheduled") {
  console.error("Usage: node scripts/_toggle-apps-open.mjs open|scheduled");
  process.exit(1);
}

const opensAt = mode === "open" ? TEST_OPEN : SCHEDULED_OPEN;
const { error } = await admin
  .from("positions")
  .update({ opens_at: opensAt })
  .in("slug", SLUGS);
if (error) {
  console.error("✗", error.message);
  process.exit(1);
}

const { data: rows } = await admin
  .from("positions")
  .select("slug, opens_at, closes_at")
  .in("slug", SLUGS)
  .order("phase")
  .order("slug");
console.table(rows);

console.log(
  mode === "open"
    ? "\n✓ Apps are OPEN for testing. Run with 'scheduled' to restore the May 6 launch."
    : "\n✓ Apps restored to scheduled launch (May 6, 12:00 AM EDT)."
);
