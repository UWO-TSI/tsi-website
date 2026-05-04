// Application period: opens May 6 12:00 AM EDT, closes May 13 12:10 AM EDT.
// Stored as UTC: May 6 04:00 → May 13 04:10 (EDT = UTC-4 in May).

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

const OPENS_AT = "2026-05-06T04:00:00Z"; // May 6, 00:00 EDT
const CLOSES_AT = "2026-05-13T04:10:00Z"; // May 13, 00:10 EDT (i.e. 12:10 AM after May 12 ends)

const SLUGS = ["vp-internal", "vp-external", "vp-marketing", "pm-internal", "advisor"];

const { error } = await admin
  .from("positions")
  .update({ opens_at: OPENS_AT, closes_at: CLOSES_AT })
  .in("slug", SLUGS);

if (error) {
  console.error("✗", error.message);
  process.exit(1);
}
console.log(`✓ Updated ${SLUGS.length} positions`);

console.log("\n=== Verify ===");
const { data: rows } = await admin
  .from("positions")
  .select("slug, opens_at, closes_at, is_active, visibility")
  .in("slug", SLUGS)
  .order("phase")
  .order("slug");
console.table(rows);

// Sanity: print human-readable
const opens = new Date(OPENS_AT);
const closes = new Date(CLOSES_AT);
const fmt = (d) =>
  d.toLocaleString("en-US", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
console.log(`\nOpens:  ${fmt(opens)}`);
console.log(`Closes: ${fmt(closes)}`);
